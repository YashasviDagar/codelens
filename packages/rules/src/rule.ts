import type { Finding, Category, Severity } from "@codelens/types";

export type Language = "javascript" | "typescript" | "python" | "other";

export interface RuleContext {
  file: string;
  language: Language;
  source: string;
  lines: string[];
  addedLines: number[];
  // precomputed AST info, if available
  ast?: {
    awaitInLoop: Array<{ line: number; snippet: string }>;
    emptyCatch: Array<{ line: number; snippet: string }>;
    bareExcept: Array<{ line: number; snippet: string }>;
    functionMetrics: Map<string, { complexity: number; length: number; nesting: number; line: number }>;
  };
  config?: Record<string, unknown>;
}

export interface RuleDefinition {
  ruleId: string;
  name: string;
  description: string;
  severity: Severity;
  category: Category;
  languages: Language[];
  detector: (ctx: RuleContext) => Array<Omit<Finding, "source">>;
  recommendation: string;
  enabledByDefault: boolean;
}

export function makeFinding(
  rule: RuleDefinition,
  ctx: RuleContext,
  partial: { line?: number; endLine?: number; title?: string; description?: string; evidence?: string; confidence?: number }
): Omit<Finding, "source"> {
  return {
    file: ctx.file,
    line: partial.line,
    endLine: partial.endLine,
    category: rule.category,
    severity: rule.severity,
    title: partial.title ?? rule.name,
    description: partial.description ?? rule.description,
    evidence: partial.evidence,
    recommendation: rule.recommendation,
    confidence: partial.confidence ?? 0.9,
    ruleId: rule.ruleId,
  };
}

