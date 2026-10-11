import { prisma } from "./prisma.js";
import { GitHubApiClient } from "@codelens/github";
import { decryptToken } from "./decrypt.js";
import { parseUnifiedDiff, analyzeJavaScript, analyzeSources, addedLineNumbers } from "@codelens/analyzer";
import { runRules } from "@codelens/rules";
import { OpenAiReviewProvider, validateAiFindings } from "@codelens/ai";
import { createIgnoreFilter, DEFAULT_CODELENSIGNORE } from "@codelens/config";
import { ReviewConfigSchema } from "@codelens/types";
import type { ReviewConfig, Finding, AiReviewRequest, ParsedDiff } from "@codelens/types";
import type { FileAnalysis } from "@codelens/analyzer";
import { aggregateFindings } from "./aggregate.js";
import { renderInlineComment, renderSummaryComment } from "./comments.js";
import { configHash } from "./cache.js";

export interface PipelineJobData {
  repositoryId: string;
  pullRequestId: string;
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
}

const SEVERITY_RANK: Record<string, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function getToken(): string | null {
  return process.env.GITHUB_TOKEN ?? process.env.OPENAI_GITHUB_TOKEN ?? null;
}

async function githubTokenForJob(job: PipelineJobData): Promise<string> {
  // Prefer the repo owner's stored OAuth token; fall back to a machine token.
  const repo = await prisma.repository.findUnique({ where: { id: job.repositoryId }, include: { members: { take: 1, orderBy: { createdAt: "asc" } } } });
  if (repo && repo.members[0]) {
    const user = await prisma.user.findUnique({ where: { id: repo.members[0].userId } });
    if (user) return decryptToken(user.githubToken);
  }
  const machine = getToken();
  if (machine) return machine;
  throw new Error("No GitHub token available for review job");
}

export async function runReviewPipeline(job: PipelineJobData, log: { info: (o: any, m?: string) => void }): Promise<void> {
  const startedAt = Date.now();
  const review = await prisma.review.findUnique({
    where: { pullRequestId_commitSha: { pullRequestId: job.pullRequestId, commitSha: job.commitSha } },
    include: { pullRequest: { include: { repository: true } } },
  });
  if (!review) throw new Error(`Review row missing for ${job.pullRequestId}@${job.commitSha}`);

  const token = await githubTokenForJob(job);
  const client = new GitHubApiClient(token);
  const ghRepo = await prisma.repository.findUniqueOrThrow({ where: { id: job.repositoryId } });

  // ---- 0. cache check ----
  const existingCompleted = await prisma.review.findFirst({
    where: { id: { not: review.id }, pullRequestId: job.pullRequestId, commitSha: job.commitSha, status: "COMPLETED", configHash: { not: null } },
  });
  if (existingCompleted) {
    log.info({ reuse: existingCompleted.id }, "cache hit: reusing completed analysis");
    await prisma.review.update({ where: { id: review.id }, data: { status: "COMPLETED", completedAt: new Date(), durationMs: Date.now() - startedAt } });
    return;
  }

  await prisma.review.update({ where: { id: review.id }, data: { status: "ANALYZING" } });

  const stored = ghRepo.config as Record<string, unknown> | null;
  const config: ReviewConfig = ReviewConfigSchema.parse(stored && Object.keys(stored).length > 0 ? stored : {});

  // ---- 1. diff ----
  const diffText = await client.getPullRequestDiff(job.owner, job.repo, job.prNumber);
  const diff: ParsedDiff = parseUnifiedDiff(diffText);
  const linesChanged = diff.totalAdditions + diff.totalDeletions;

  const ignore = createIgnoreFilter(DEFAULT_CODELENSIGNORE);
  const analyzable = diff.files
    .filter((f) => f.status !== "deleted" && !ignore.ignores(f.path))
    .slice(0, Number(process.env.MAX_REVIEW_FILES ?? 50));

  if (linesChanged > Number(process.env.MAX_REVIEW_LINES ?? 4000)) {
    log.info({ linesChanged }, "diff too large; limiting scope");
  }

  // ---- 2. fetch sources & run AST + metrics ----
  await prisma.review.update({ where: { id: review.id }, data: { status: "STATIC_ANALYSIS" } });
  const sources = new Map<string, string>();
  for (const file of analyzable) {
    const content = await client.getFileContent(job.owner, job.repo, file.path, job.commitSha);
    if (content != null) sources.set(file.path, content);
  }
  const analyses = analyzeSources(sources, diff);

  // ---- 3. rule engine ----
  const findings: Finding[] = [];
  for (const analysis of analyses) {
    const diffFile = diff.files.find((f) => f.path === analysis.path);
    const added = diffFile ? addedLineNumbers(diffFile) : [];
    const src = sources.get(analysis.path)!;
    const info = analysis.language === "python"
      ? await import("@codelens/analyzer").then((m) => m.analyzePython(analysis.path, src)) as any
      : analyzeJavaScript(analysis.path, src) as any;
    const result = runRules({
      file: analysis.path,
      language: analysis.language as any,
      source: src,
      lines: src.split(/\r?\n/),
      addedLines: added,
      ast: {
        awaitInLoop: info.awaitInLoop ?? [],
        emptyCatch: info.emptyCatch ?? [],
        bareExcept: info.bareExcept ?? [],
        functionMetrics: new Map([...info.functionCounts].map(([k, v]) => [k, { ...v }])),
      },
    });
    findings.push(...(result.findings as Finding[]));
  }

  // ---- 4. AI layer ----
  let aiSummary: string | null = null;
  if (config.ai.enabled && process.env.OPENAI_API_KEY) {
    try {
      await prisma.review.update({ where: { id: review.id }, data: { status: "AI_REVIEW" } });
      const provider = new OpenAiReviewProvider({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        baseUrl: process.env.OPENAI_BASE_URL || undefined,
      });
      const request = buildAiRequest(diff, analyses, sources, findings, review.pullRequest.title, "");
      const response = await provider.generateReview(request);
      aiSummary = response.summary;

      // hallucination guards
      const validFiles = new Map<string, Set<number>>();
      for (const f of analyzable) validFiles.set(f.path, new Set(addedLineNumbers(f)));
      const staticKeys = new Set(findings.map((f) => `${f.file}:${f.line ?? 0}`));
      const { findings: aiFindings, rejected } = validateAiFindings(response, { request, validFiles, staticFindingKeys: staticKeys });
      log.info({ aiAccepted: aiFindings.length, aiRejected: rejected.length }, "AI findings validated");
      findings.push(...aiFindings);
    } catch (err) {
      log.info({ err: String(err) }, "AI layer failed; continuing with deterministic findings only");
    }
  }

  // ---- 5. aggregate & persist ----
  const metricsScore = computeMetricsScore(analyses);
  const aggregated = aggregateFindings(findings, config, metricsScore);
  const durationMs = Date.now() - startedAt;

  await prisma.review.update({
    where: { id: review.id },
    data: {
      status: "COMPLETED",
      filesAnalyzed: analyses.length,
      linesChanged,
      summary: aggregated.summary,
      severityCounts: aggregated.severityCounts as any,
      qualityScore: aggregated.qualityScore,
      durationMs,
      configHash: configHash(config),
      completedAt: new Date(),
    },
  });

  await prisma.finding.deleteMany({ where: { reviewId: review.id } });
  for (const f of aggregated.findings) {
    await prisma.finding.create({
      data: {
        reviewId: review.id,
        file: f.file,
        line: f.line ?? null,
        endLine: f.endLine ?? null,
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        evidence: f.evidence ?? null,
        recommendation: f.recommendation ?? null,
        suggestedPatch: f.suggestedPatch ?? null,
        confidence: f.confidence,
        source: f.source,
        ruleId: f.ruleId ?? null,
      },
    });
  }

  // ---- 6. GitHub comments ----
  await postReviewComments(client, job, aggregated, aiSummary, linesChanged, analyses.length, config);
  log.info({ reviewId: review.id, findings: aggregated.findings.length, durationMs }, "review completed");
}

function buildAiRequest(
  diff: ParsedDiff,
  analyses: FileAnalysis[],
  sources: Map<string, string>,
  findings: Finding[],
  prTitle: string,
  prDescription: string
): AiReviewRequest {
  return {
    repositoryLanguage: analyses[0]?.language ?? "typescript",
    prTitle,
    prDescription,
    files: analyses.map((a) => {
      const diffFile = diff.files.find((f) => f.path === a.path);
      const lines = (sources.get(a.path) ?? "").split(/\r?\n/);
      const snippets = a.symbols
        .filter((s) => s.touched)
        .slice(0, 5)
        .map((s) => ({
          symbolName: s.name,
          startLine: s.startLine,
          code: lines.slice(Math.max(0, s.startLine - 1), Math.min(lines.length, s.endLine)).join("\n").slice(0, 2000),
        }));
      return {
        path: a.path,
        language: a.language,
        diffContent: diffFile ? serializeHunks(diffFile, lines) : "",
        snippets,
      };
    }),
    staticFindings: findings.slice(0, 40).map((f) => ({
      file: f.file,
      line: f.line ?? null,
      ruleId: f.ruleId,
      message: `${f.title}: ${f.description}`.slice(0, 300),
      severity: f.severity,
      category: f.category,
    })),
    testsTouched: diff.files.some((f) => /test|spec/i.test(f.path)),
  };
}

function serializeHunks(diffFile: ParsedDiff["files"][number], _allLines: string[]): string {
  return diffFile.hunks
    .map((h) => {
      const header = `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`;
      const body = h.lines
        .map((l) => (l.type === "added" ? "+" : l.type === "removed" ? "-" : " ") + l.content)
        .join("\n");
      return header + "\n" + body;
    })
    .join("\n");
}

function computeMetricsScore(analyses: FileAnalysis[]): number | null {
  const all = analyses.flatMap((a) => a.metrics.map((m) => ({ ...m, file: a.path })));
  if (all.length === 0) return null;
  let penalty = 0;
  for (const m of all) {
    if (m.cyclomaticComplexity > 15) penalty += 10;
    else if (m.cyclomaticComplexity > 10) penalty += 5;
    if (m.length > 80) penalty += 8;
    if (m.nesting > 5) penalty += 6;
  }
  return Math.max(0, 100 - penalty);
}

async function postReviewComments(
  client: GitHubApiClient,
  job: PipelineJobData,
  aggregated: ReturnType<typeof aggregateFindings>,
  aiSummary: string | null,
  linesChanged: number,
  filesAnalyzed: number,
  config: ReviewConfig
) {
  const inlineMin = SEVERITY_RANK[config.inlineCommentMinimum] ?? 2;
  const inlineFindings = aggregated.findings.filter((f) => (SEVERITY_RANK[f.severity] ?? 0) >= inlineMin);

  for (const f of inlineFindings.slice(0, 10)) {
    const body = renderInlineComment({
      severity: f.severity,
      category: f.category,
      file: f.file,
      line: f.line ?? null,
      title: f.title,
      description: f.description,
      recommendation: f.recommendation,
      confidence: f.confidence,
      source: f.source,
    });
    try {
      if (f.line) {
        await client.createInlineComment(job.owner, job.repo, job.prNumber, body, job.commitSha, f.file, f.line);
      }
    } catch {
      // fall back to issue comment if inline position is invalid
      await client.createIssueComment(job.owner, job.repo, job.prNumber, `${body}\n\n<sub>(${f.file})</sub>`);
    }
  }

  const mainAreas = aggregated.summary.replace("Main areas: ", "").split(",").map((s) => s.trim()).filter(Boolean);
  await client.createIssueComment(
    job.owner,
    job.repo,
    job.prNumber,
    renderSummaryComment({
      prTitle: "",
      filesAnalyzed,
      linesChanged,
      severityCounts: aggregated.severityCounts,
      qualityScore: aggregated.qualityScore,
      mainAreas,
      aiSummary,
    })
  );
}





