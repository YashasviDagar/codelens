import { z } from "zod";
import { SeveritySchema } from "./finding.js";
import type { Category, Severity } from "./finding.js";

export const ReviewConfigSchema = z.object({
  review: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({ enabled: true }),
  severity: z
    .object({
      // Minimum severity to include in PR comments (not dashboard)
      minimum: SeveritySchema.default("LOW"),
    })
    .default({ minimum: "LOW" }),
  categories: z
    .object({
      bugs: z.boolean().default(true),
      performance: z.boolean().default(true),
      security: z.boolean().default(true),
      codeQuality: z.boolean().default(true),
      maintainability: z.boolean().default(true),
      testing: z.boolean().default(false),
      documentation: z.boolean().default(false),
      style: z.boolean().default(false),
    })
    .default({
      bugs: true,
      performance: true,
      security: true,
      codeQuality: true,
      maintainability: true,
      testing: false,
      documentation: false,
      style: false,
    }),
  languages: z
    .object({
      javascript: z.boolean().default(true),
      typescript: z.boolean().default(true),
      python: z.boolean().default(true),
    })
    .default({ javascript: true, typescript: true, python: true }),
  ai: z
    .object({
      enabled: z.boolean().default(true),
      maxFindings: z.number().int().min(0).max(50).default(15),
    })
    .default({ enabled: true, maxFindings: 15 }),
  // Post inline comments only at or above this severity; lower ones grouped
  inlineCommentMinimum: SeveritySchema.default("MEDIUM"),
});

export type ReviewConfig = z.infer<typeof ReviewConfigSchema>;

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = ReviewConfigSchema.parse({});

const CATEGORY_TO_CONFIG_KEY: Record<Category, keyof ReviewConfig["categories"]> = {
  BUG: "bugs",
  CODE_QUALITY: "codeQuality",
  PERFORMANCE: "performance",
  MAINTAINABILITY: "maintainability",
  TESTING: "testing",
  DOCUMENTATION: "documentation",
  SECURITY: "security",
  STYLE: "style",
};

const SEVERITY_ORDER: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function categoryEnabled(config: ReviewConfig, category: Category): boolean {
  return config.categories[CATEGORY_TO_CONFIG_KEY[category]];
}

export function severityAtLeast(severity: Severity, minimum: Severity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[minimum];
}

