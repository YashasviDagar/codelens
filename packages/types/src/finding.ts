import { z } from "zod";

export const SeveritySchema = z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const CategorySchema = z.enum([
  "BUG",
  "CODE_QUALITY",
  "PERFORMANCE",
  "MAINTAINABILITY",
  "TESTING",
  "DOCUMENTATION",
  "SECURITY",
  "STYLE",
]);
export type Category = z.infer<typeof CategorySchema>;

export const FindingSourceSchema = z.enum([
  "STATIC_ANALYSIS",
  "AST",
  "METRICS",
  "RULE_ENGINE",
  "AI",
]);
export type FindingSource = z.infer<typeof FindingSourceSchema>;

export const FindingStatusSchema = z.enum([
  "OPEN",
  "FIXED",
  "FALSE_POSITIVE",
  "WONT_FIX",
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const FindingSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive().nullable().optional(),
  endLine: z.number().int().positive().nullable().optional(),
  category: CategorySchema,
  severity: SeveritySchema,
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.string().optional(),
  recommendation: z.string().optional(),
  suggestedPatch: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  source: FindingSourceSchema,
  ruleId: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const FeedbackTypeSchema = z.enum(["HELPFUL", "NOT_HELPFUL", "FALSE_POSITIVE", "WONT_FIX", "FIXED"]);
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;
