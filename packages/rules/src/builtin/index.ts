import type { RuleDefinition } from "../rule.js";
import { makeFinding } from "../rule.js";
import { findDuplication } from "@codelens/analyzer";
import { DEFAULT_THRESHOLDS } from "@codelens/analyzer";

/**
 * RULE001 — Excessive Function Complexity
 */
const complexity: RuleDefinition = {
  ruleId: "RULE001",
  name: "Excessive Function Complexity",
  description: "Cyclomatic complexity exceeds the configured threshold.",
  severity: "MEDIUM",
  category: "MAINTAINABILITY",
  languages: ["javascript", "typescript", "python"],
  recommendation: "Split the function into smaller units, each handling one responsibility.",
  enabledByDefault: true,
  detector: (ctx) => {
    const out: Array<Omit<import("@codelens/types").Finding, "source">> = [];
    const ast = ctx.ast?.functionMetrics;
    if (!ast) return out;
    for (const [name, m] of ast) {
      if (!ctx.addedLines.some((l) => l >= m.line && l <= m.line + m.length)) continue;
      if (m.complexity > DEFAULT_THRESHOLDS.complexityHigh) {
        out.push(makeFinding(complexity, ctx, {
          line: m.line,
          title: `High complexity in ${name} (${m.complexity})`,
          description: `Function '${name}' has a cyclomatic complexity of ${m.complexity} (threshold ${DEFAULT_THRESHOLDS.complexityHigh}). High complexity correlates strongly with defects.`,
          confidence: 0.95,
        }));
      }
    }
    return out;
  },
};

/**
 * RULE002 — await inside loop (N+1 / sequential I/O)
 */
const awaitInLoop: RuleDefinition = {
  ruleId: "RULE002",
  name: "Await inside loop",
  description: "Sequential awaits in a loop usually indicate an N+1 query or unnecessary serialization of I/O.",
  severity: "MEDIUM",
  category: "PERFORMANCE",
  languages: ["javascript", "typescript"],
  recommendation:
    "Batch the work: collect the identifiers first and perform one query/HTTP call for the whole set, or use Promise.all when operations are independent.",
  enabledByDefault: true,
  detector: (ctx) =>
    (ctx.ast?.awaitInLoop ?? []).map((hit) =>
      makeFinding(awaitInLoop, ctx, {
        line: hit.line,
        title: "Possible N+1: await inside a loop",
        description: "A request/DB operation is awaited on every iteration. This serializes I/O and can degrade latency linearly with input size.",
        evidence: hit.snippet,
        confidence: 0.85,
      })
    ),
};

/**
 * RULE003 — empty catch block / bare except
 */
const swallowedErrors: RuleDefinition = {
  ruleId: "RULE003",
  name: "Swallowed error",
  description: "Errors are caught but not handled, logged, or rethrown.",
  severity: "HIGH",
  category: "BUG",
  languages: ["javascript", "typescript", "python"],
  recommendation: "Handle the error explicitly: log with context, return an error state, or rethrow.",
  enabledByDefault: true,
  detector: (ctx) => [
    ...(ctx.ast?.emptyCatch ?? []).map((hit) =>
      makeFinding(swallowedErrors, ctx, {
        line: hit.line,
        title: "Empty catch block",
        description: "The catch block is empty, so failures are silently ignored.",
        evidence: hit.snippet,
        confidence: 0.9,
      })
    ),
    ...(ctx.ast?.bareExcept ?? []).map((hit) =>
      makeFinding(swallowedErrors, ctx, {
        line: hit.line,
        title: "Bare except",
        description: "A bare 'except:' catches everything, including KeyboardInterrupt and SystemExit.",
        evidence: hit.snippet,
        confidence: 0.9,
      })
    ),
  ],
};

/**
 * RULE004 — long function
 */
const longFunction: RuleDefinition = {
  ruleId: "RULE004",
  name: "Long function",
  description: "Function body exceeds the length threshold.",
  severity: "LOW",
  category: "MAINTAINABILITY",
  languages: ["javascript", "typescript", "python"],
  recommendation: "Extract cohesive blocks into named helpers.",
  enabledByDefault: true,
  detector: (ctx) => {
    const out: Array<Omit<import("@codelens/types").Finding, "source">> = [];
    const ast = ctx.ast?.functionMetrics;
    if (!ast) return out;
    for (const [name, m] of ast) {
      if (m.length > DEFAULT_THRESHOLDS.lengthHigh) {
        out.push(makeFinding(longFunction, ctx, {
          line: m.line,
          title: `Long function ${name} (${m.length} lines)`,
          description: `Function '${name}' spans ${m.length} lines, above the ${DEFAULT_THRESHOLDS.lengthHigh}-line guideline.`,
          confidence: 0.8,
        }));
      }
    }
    return out;
  },
};

/**
 * RULE005 — deep nesting
 */
const deepNesting: RuleDefinition = {
  ruleId: "RULE005",
  name: "Deep nesting",
  description: "Nesting depth exceeds the threshold.",
  severity: "LOW",
  category: "CODE_QUALITY",
  languages: ["javascript", "typescript", "python"],
  recommendation: "Use early returns / guard clauses to flatten the control flow.",
  enabledByDefault: true,
  detector: (ctx) => {
    const out: Array<Omit<import("@codelens/types").Finding, "source">> = [];
    for (const [name, m] of ctx.ast?.functionMetrics ?? []) {
      if (m.nesting > DEFAULT_THRESHOLDS.nestingHigh) {
        out.push(makeFinding(deepNesting, ctx, {
          line: m.line,
          title: `Deep nesting in ${name} (depth ${m.nesting})`,
          description: `Function '${name}' nests ${m.nesting} levels deep, making it hard to follow.`,
          confidence: 0.85,
        }));
      }
    }
    return out;
  },
};

/**
 * RULE006 — duplicated block within changed file
 */
const duplication: RuleDefinition = {
  ruleId: "RULE006",
  name: "Duplicated code block",
  description: "A block of at least 6 lines appears more than once in the file.",
  severity: "MEDIUM",
  category: "MAINTAINABILITY",
  languages: ["javascript", "typescript", "python"],
  recommendation: "Extract the duplicated logic into a shared function.",
  enabledByDefault: true,
  detector: (ctx) => {
    const dupes = findDuplication(ctx.source);
    return dupes
      .filter((d) => ctx.addedLines.some((l) => Math.abs(l - d.lines[0]) <= 8) || ctx.addedLines.some((l) => Math.abs(l - d.lines[1]) <= 8))
      .slice(0, 5)
      .map((d) =>
        makeFinding(duplication, ctx, {
          line: d.lines[0],
          title: "Duplicated block detected",
          description: `Lines ${d.lines[0]} and ${d.lines[1]} contain duplicated logic.`,
          evidence: d.snippet,
          confidence: 0.75,
        })
      );
  },
};

/**
 * RULE007 — debug statements left in changed code
 */
const debugStatements: RuleDefinition = {
  ruleId: "RULE007",
  name: "Debug statement",
  description: "console.log / print left in changed code.",
  severity: "INFO",
  category: "STYLE",
  languages: ["javascript", "typescript", "python"],
  recommendation: "Remove debug output or replace with a structured logger.",
  enabledByDefault: true,
  detector: (ctx) => {
    const re = /^\s*(console\.(log|debug)|print)\(/;
    const out: Array<Omit<import("@codelens/types").Finding, "source">> = [];
    for (const added of ctx.addedLines) {
      const line = ctx.lines[added - 1];
      if (line && re.test(line)) {
        out.push(makeFinding(debugStatements, ctx, {
          line: added,
          title: "Debug statement in diff",
          description: "A console.log/print statement appears in the added lines.",
          evidence: line.trim().slice(0, 120),
          confidence: 0.7,
        }));
      }
    }
    return out;
  },
};

export function builtInRules(): RuleDefinition[] {
  return [complexity, awaitInLoop, swallowedErrors, longFunction, deepNesting, duplication, debugStatements];
}

