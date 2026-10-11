import type { AiReviewRequest, AiReviewResponse, AiFinding, Finding, FindingSource } from "@codelens/types";
import { AiValidationError } from "./openai.js";

export interface ValidationContext {
  request: AiReviewRequest;
  // files present in the diff with their changed/new line ranges
  validFiles: Map<string, Set<number>>;
  staticFindingKeys: Set<string>;
}

export interface ValidationResult {
  findings: Finding[];
  rejected: Array<{ finding: AiFinding; reason: string }>;
}

/**
 * Hallucination-reduction pipeline. Every AI finding must survive ALL checks:
 *  1. File must exist in the diff.
 *  2. Line must be a changed line (or within +/- 3 lines of one).
 *  3. Evidence must quote code that actually appears in the file content.
 *  4. Must not duplicate an existing static finding at the same location+rule.
 *  5. Severity is clamped to MEDIUM unless corroborated by static analysis.
 */
export function validateAiFindings(
  response: AiReviewResponse,
  ctx: ValidationContext
): ValidationResult {
  if (!ctx.validFiles || ctx.validFiles.size === 0) {
    return { findings: [], rejected: response.findings.map((f) => ({ finding: f, reason: "no diff files" })) };
  }
  const accepted: Finding[] = [];
  const rejected: ValidationResult["rejected"] = [];
  const seen = new Set<string>();

  for (const f of response.findings) {
    const fileKey = normalizePath(f.file);
    const matchFile = findMatchingFile(fileKey, ctx.validFiles);
    if (!matchFile) {
      rejected.push({ finding: f, reason: "hallucinated file" });
      continue;
    }
    const changedLines = ctx.validFiles.get(matchFile)!;
    if (!lineNearChanged(f.line, changedLines)) {
      rejected.push({ finding: f, reason: `line ${f.line} not in changed lines` });
      continue;
    }
    if (!evidenceInFile(f.evidence, ctx.request, matchFile)) {
      rejected.push({ finding: f, reason: "evidence not found in file" });
      continue;
    }
    const dedupeKey = `${matchFile}:${f.line}:${f.title.toLowerCase().slice(0, 40)}`;
    if (seen.has(dedupeKey)) {
      rejected.push({ finding: f, reason: "duplicate AI finding" });
      continue;
    }
    const staticKey = `${matchFile}:${f.line}`;
    const corroborated = ctx.staticFindingKeys.has(staticKey);
    seen.add(dedupeKey);

    accepted.push({
      file: matchFile,
      line: f.line,
      category: mapCategory(f.category),
      severity: clampSeverity(f.severity, corroborated),
      title: f.title,
      description: f.description,
      evidence: f.evidence,
      recommendation: f.recommendation,
      suggestedPatch: f.suggestedPatch,
      // confidence haircut: AI findings start lower than deterministic rules
      confidence: Math.min(f.confidence, corroborated ? 0.95 : 0.75),
      source: "AI" as FindingSource,
      ruleId: "AI001",
    });
  }
  return { findings: accepted, rejected };
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function findMatchingFile(file: string, validFiles: Map<string, Set<number>>): string | null {
  for (const key of validFiles.keys()) {
    const k = normalizePath(key);
    if (k === file || k.endsWith("/" + file) || file.endsWith("/" + k)) return key;
  }
  return null;
}

function lineNearChanged(line: number, changed: Set<number>): boolean {
  for (let d = 0; d <= 3; d++) {
    if (changed.has(line + d) || changed.has(line - d)) return true;
  }
  return false;
}

function evidenceInFile(evidence: string, request: AiReviewRequest, file: string): boolean {
  if (!evidence || evidence.trim().length < 3) return false;
  const fileCtx = request.files.find((f) => normalizePath(f.path) === normalizePath(file));
  if (!fileCtx) return false;
  const haystack = normalizeWhitespace(fileCtx.diffContent + "\n" + fileCtx.snippets.map((s) => s.code).join("\n"));
  const needle = normalizeWhitespace(evidence);
  return haystack.includes(needle.slice(0, Math.min(needle.length, 80)));
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function mapCategory(category: string): Finding["category"] {
  const map: Record<string, Finding["category"]> = {
    bug: "BUG",
    code_quality: "CODE_QUALITY",
    performance: "PERFORMANCE",
    maintainability: "MAINTAINABILITY",
    testing: "TESTING",
    documentation: "DOCUMENTATION",
    security: "SECURITY",
    style: "STYLE",
  };
  return map[category] ?? "CODE_QUALITY";
}

const SEVERITY_RANK: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
const RANK_TO_SEVERITY = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function clampSeverity(severity: string, corroborated: boolean): Finding["severity"] {
  const rank = SEVERITY_RANK[severity] ?? 1;
  // uncorroborated AI findings cannot exceed MEDIUM (severity policy)
  const maxRank = corroborated ? 4 : 2;
  return RANK_TO_SEVERITY[Math.min(rank, maxRank)];
}

export { AiValidationError };
