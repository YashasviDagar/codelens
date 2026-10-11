import type { Finding } from "@codelens/types";
import type { RuleDefinition, RuleContext } from "./rule.js";
import { builtInRules } from "./builtin/index.js";

export interface RuleEngineOptions {
  disabledRuleIds?: Set<string>;
  extraRules?: RuleDefinition[];
}

export interface RuleEngineResult {
  findings: Array<Omit<Finding, "source">>;
  rulesRun: string[];
}

/**
 * Runs all applicable rules against one file's context.
 * Deterministic, no I/O, easily unit-testable.
 */
export function runRules(
  ctx: RuleContext,
  options: RuleEngineOptions = {}
): RuleEngineResult {
  const all = [...builtInRules(), ...(options.extraRules ?? [])];
  const disabled = options.disabledRuleIds ?? new Set();
  const findings: Finding[] = [];
  const rulesRun: string[] = [];

  for (const rule of all) {
    if (disabled.has(rule.ruleId)) continue;
    if (!rule.languages.includes(ctx.language) && !rule.languages.includes("other")) continue;
    const produced = rule.detector(ctx);
    if (produced.length > 0) {
      rulesRun.push(rule.ruleId);
      for (const f of produced) findings.push({ ...f, source: "RULE_ENGINE" });
    }
  }

  return { findings, rulesRun };
}

export { builtInRules };

