import { z } from "zod";
import { CategorySchema, SeveritySchema } from "./finding.js";

// AI must use lowercase severity/category; we normalize on validation
const AiSeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);
const AiCategorySchema = z.enum([
  "bug",
  "code_quality",
  "performance",
  "maintainability",
  "testing",
  "documentation",
  "security",
  "style",
]);

export const AiReviewRequestSchema = z.object({
  repositoryLanguage: z.string(),
  prTitle: z.string(),
  prDescription: z.string().default(""),
  files: z.array(
    z.object({
      path: z.string(),
      language: z.string(),
      // Diff hunks with a few context lines, not whole files
      diffContent: z.string(),
      // Relevant source snippets (changed functions)
      snippets: z.array(
        z.object({
          symbolName: z.string(),
          startLine: z.number(),
          code: z.string(),
        })
      ),
    })
  ),
  staticFindings: z.array(
    z.object({
      file: z.string(),
      line: z.number().nullable().optional(),
      ruleId: z.string().optional(),
      message: z.string(),
      severity: SeveritySchema,
      category: CategorySchema,
    })
  ),
  testsTouched: z.boolean(),
});
export type AiReviewRequest = z.infer<typeof AiReviewRequestSchema>;

export const AiFindingSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  severity: AiSeveritySchema,
  category: AiCategorySchema,
  title: z.string(),
  description: z.string(),
  evidence: z.string(),
  recommendation: z.string(),
  suggestedPatch: z.string().optional(),
  confidence: z.number().min(0).max(1),
});
export type AiFinding = z.infer<typeof AiFindingSchema>;

export const AiReviewResponseSchema = z.object({
  summary: z.string(),
  findings: z.array(AiFindingSchema).max(30),
});
export type AiReviewResponse = z.infer<typeof AiReviewResponseSchema>;

// The interface every provider adapter implements
export interface AIReviewProvider {
  readonly name: string;
  generateReview(request: AiReviewRequest): Promise<AiReviewResponse>;
  explainFinding(input: {
    file: string;
    snippet: string;
    findingTitle: string;
    findingDescription: string;
  }): Promise<string>;
  suggestFix(input: {
    file: string;
    snippet: string;
    findingTitle: string;
    recommendation: string;
  }): Promise<string | undefined>;
  summarizePR(input: {
    prTitle: string;
    findings: Array<{ title: string; severity: string; category: string }>;
  }): Promise<string>;
}
