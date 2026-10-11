import {
  type AiReviewRequest,
  type AiReviewResponse,
  AiReviewResponseSchema,
  type AIReviewProvider,
} from "@codelens/types";

const SYSTEM_PROMPT = `You are a code review engine. You receive:
- PR context (title, description, repository language)
- Unified diffs of changed files
- Relevant source snippets for changed functions
- Deterministic findings from static analysis and a rule engine

Your job: find HIGHER-LEVEL issues the deterministic layers cannot catch:
logical bugs, missing edge cases, API misuse, insecure patterns,
unclear error handling, architectural concerns.

STRICT RULES:
1. Only report issues you can anchor to a specific file AND line number that
   exists in the provided diff or snippets. Never guess.
2. Every finding MUST include "evidence": a short verbatim quote from the code.
3. Do not repeat findings already present in the staticFindings list unless you
   add substantially new insight.
4. Use lowercase severity: info|low|medium|high|critical and lowercase category:
   bug|code_quality|performance|maintainability|testing|documentation|security|style.
5. confidence is a number 0..1 reflecting how certain you are.
6. Respond with ONLY a JSON object matching:
   {"summary": string, "findings": [{"file": string, "line": number, "severity": string,
     "category": string, "title": string, "description": string, "evidence": string,
     "recommendation": string, "suggestedPatch"?: string, "confidence": number}]}
7. Max 15 findings. Prefer fewer, higher-quality findings.
8. Do not invent files, lines, APIs, or standards. If unsure, omit.`;

function buildUserPrompt(request: AiReviewRequest): string {
  const parts: string[] = [];
  parts.push(`Repository language: ${request.repositoryLanguage}`);
  parts.push(`PR title: ${request.prTitle}`);
  if (request.prDescription) parts.push(`PR description:\n${request.prDescription}`);
  parts.push(`Tests touched in this PR: ${request.testsTouched ? "yes" : "NO"}`);

  parts.push("\nStatic-analysis findings (do not duplicate):");
  for (const f of request.staticFindings.slice(0, 40)) {
    parts.push(`- [${f.severity}/${f.category}] ${f.file}${f.line ? ":" + f.line : ""} ${f.ruleId ? "(" + f.ruleId + ") " : ""}${f.message}`);
  }

  for (const file of request.files) {
    parts.push(`\n=== FILE: ${file.path} (${file.language}) ===`);
    parts.push("Diff:");
    parts.push(file.diffContent);
    for (const snippet of file.snippets) {
      parts.push(`Relevant function ${snippet.symbolName} (starts line ${snippet.startLine}):`);
      parts.push(snippet.code);
    }
  }
  return parts.join("\n");
}

export interface OpenAiProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

/**
 * OpenAI-compatible provider (also works with any /chat/completions endpoint).
 * - Structured JSON request/response
 * - Zod-validated output; malformed responses throw instead of leaking garbage
 */
export class OpenAiReviewProvider implements AIReviewProvider {
  readonly name = "openai";
  private fetchImpl: typeof fetch;

  constructor(private options: OpenAiProviderOptions) {
    if (!options.apiKey) throw new Error("OpenAiReviewProvider requires an API key");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateReview(request: AiReviewRequest): Promise<AiReviewResponse> {
    const raw = await this.chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(request) },
    ]);
    return this.parseStructured(raw);
  }

  async explainFinding(input: {
    file: string;
    snippet: string;
    findingTitle: string;
    findingDescription: string;
  }): Promise<string> {
    return this.chat([
      { role: "system", content: "You explain code findings concisely to developers. Max 120 words. Reference the actual code." },
      {
        role: "user",
        content: `File: ${input.file}\nCode:\n${input.snippet}\n\nFinding: ${input.findingTitle}\n${input.findingDescription}`,
      },
    ]);
  }

  async suggestFix(input: {
    file: string;
    snippet: string;
    findingTitle: string;
    recommendation: string;
  }): Promise<string | undefined> {
    const raw = await this.chat([
      { role: "system", content: "Suggest a minimal corrected code snippet. Return ONLY a fenced code block." },
      {
        role: "user",
        content: `File: ${input.file}\nCode:\n${input.snippet}\n\nIssue: ${input.findingTitle}\nRecommendation: ${input.recommendation}`,
      },
    ]);
    const match = raw.match(/```[a-z]*\n([\s\S]*?)```/);
    return match ? match[1] : undefined;
  }

  async summarizePR(input: {
    prTitle: string;
    findings: Array<{ title: string; severity: string; category: string }>;
  }): Promise<string> {
    if (input.findings.length === 0) return "No significant findings.";
    return this.chat([
      { role: "system", content: "Write a 3-5 sentence PR review summary. Group by theme. No fluff, no praise padding." },
      {
        role: "user",
        content: `PR: ${input.prTitle}\nFindings:\n${input.findings.map((f) => `- [${f.severity}/${f.category}] ${f.title}`).join("\n")}`,
      },
    ]);
  }

  private async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const base = this.options.baseUrl ?? "https://api.openai.com/v1";
    const res = await this.fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model ?? "gpt-4o-mini",
        messages,
        temperature: this.options.temperature ?? 0.1,
        max_tokens: this.options.maxOutputTokens ?? 2000,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as any;
    return json.choices?.[0]?.message?.content ?? "";
  }

  private parseStructured(raw: string): AiReviewResponse {
    let jsonText = raw.trim();
    // strip markdown fences if the model added them despite response_format
    const fence = jsonText.match(/```(?:json)?\n?([\s\S]*?)```/);
    if (fence) jsonText = fence[1];
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new AiValidationError("AI response is not valid JSON");
    }
    const result = AiReviewResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new AiValidationError(`AI response failed schema validation: ${result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    return result.data;
  }
}

export class AiValidationError extends Error {}
