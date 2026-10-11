import type {
  AiReviewRequest,
  AiReviewResponse,
  AIReviewProvider,
} from "@codelens/types";

/**
 * Deterministic mock provider for tests and offline development.
 * Emits a fixed, schema-valid review based on the static findings input,
 * so the full pipeline can run without an API key.
 */
export class MockReviewProvider implements AIReviewProvider {
  readonly name = "mock";

  async generateReview(request: AiReviewRequest): Promise<AiReviewResponse> {
    const findings = request.staticFindings.slice(0, 3).map((f, i) => ({
      file: f.file,
      line: f.line ?? 1,
      severity: f.severity.toLowerCase() as any,
      category: f.category.toLowerCase() as any,
      title: `AI corroboration ${i + 1}: ${f.message.slice(0, 40)}`,
      description: `Mock analysis of ${f.file}. The static layer reported: ${f.message}`,
      evidence: "mock evidence",
      recommendation: "Verify against the code and fix accordingly.",
      confidence: 0.5,
    }));
    return {
      summary: `Mock review of "${request.prTitle}" with ${findings.length} findings.`,
      findings,
    };
  }

  async explainFinding(input: { file: string; snippet: string; findingTitle: string; findingDescription: string }): Promise<string> {
    return `Mock explanation for ${input.findingTitle} in ${input.file}.`;
  }

  async suggestFix(): Promise<string | undefined> {
    return undefined;
  }

  async summarizePR(input: { prTitle: string; findings: Array<{ title: string; severity: string; category: string }> }): Promise<string> {
    return `Mock summary for ${input.prTitle}: ${input.findings.length} findings.`;
  }
}

