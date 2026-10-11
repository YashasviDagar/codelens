import { describe, it, expect } from "vitest";
import { runRules } from "@codelens/rules";
import { analyzeJavaScript, analyzePython } from "@codelens/analyzer";
import type { RuleContext } from "@codelens/rules";

/**
 * Evaluation dataset: known-issue samples with expected rule IDs per file.
 * Precision/recall/FP-rate measured against these ground-truth labels.
 */
interface Sample {
  name: string;
  file: string;
  source: string;
  addedLines: number[];
  expectedRuleIds: string[];
  // findings a correct system should NOT report
  notExpected?: string[];
}

const SAMPLES: Sample[] = [
  {
    name: "N+1 query in loop",
    file: "src/users.ts",
    addedLines: [2, 3, 4],
    expectedRuleIds: ["RULE002"],
    source: `export async function loadUsers(users: User[]) {
  for (const u of users) {
    await db.getUser(u.id);
  }
}`,
  },
  {
    name: "empty catch",
    file: "src/upload.ts",
    addedLines: [4, 5, 6],
    expectedRuleIds: ["RULE003"],
    source: `export function save(data: string) {
  try {
    fs.write(data);
  } catch {}
}`,
  },
  {
    name: "clean function - expect no findings",
    file: "src/add.ts",
    addedLines: [1, 2, 3],
    expectedRuleIds: [],
    source: `export function add(a: number, b: number): number {
  return a + b;
}`,
  },
  {
    name: "debug statement in added lines",
    file: "src/debug.ts",
    addedLines: [2],
    expectedRuleIds: ["RULE007"],
    source: `export function process(input: string) {
  console.log("processing", input);
  return input.trim();
}`,
  },
  {
    name: "high complexity function",
    file: "src/complex.ts",
    addedLines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    expectedRuleIds: ["RULE001"],
    source: `export function classify(items: Item[], mode: string) {
  const out = [];
  for (const item of items) {
    if (item.a && item.b) {
      out.push("ab");
    } else if (item.a || item.b) {
      if (item.c) {
        out.push("c");
      } else if (item.d ?? item.e) {
        out.push("d");
      } else if (mode === "x" || mode === "y") {
        out.push("xy");
      } else {
        while (item.more--) {
          if (item.more === 3) continue;
          if (item.more === 2) continue;
          out.push("m");
        }
      }
    } else if (item.f && item.g) {
      out.push("f");
    } else {
      out.push("z");
    }
  }
  return out;
}`,
  },
  {
    name: "bare except in python",
    file: "scripts/import.py",
    addedLines: [3, 4, 5],
    expectedRuleIds: ["RULE003"],
    source: `def load(path):
    try:
        return open(path).read()
    except:
        return None`,
  },
  {
    name: "deep nesting",
    file: "src/nested.ts",
    addedLines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    expectedRuleIds: ["RULE005"],
    source: `export function walk(grid: Grid) {
  for (const row of grid) {
    for (const cell of row) {
      if (cell.active) {
        if (cell.linked) {
          if (cell.visible) {
            return cell;
          }
        }
      }
    }
  }
  return null;
}`,
  },
];

function ctxFor(sample: Sample): RuleContext {
  const isPython = sample.file.endsWith(".py");
  const ast = isPython
    ? analyzePython(sample.file, sample.source)
    : analyzeJavaScript(sample.file, sample.source);
  return {
    file: sample.file,
    language: isPython ? "python" : "typescript",
    source: sample.source,
    lines: sample.source.split("\n"),
    addedLines: sample.addedLines,
    ast: {
      awaitInLoop: "awaitInLoop" in ast ? (ast as any).awaitInLoop : [],
      emptyCatch: "emptyCatch" in ast ? (ast as any).emptyCatch : [],
      bareExcept: "bareExcept" in ast ? (ast as any).bareExcept : [],
      functionMetrics: new Map([...ast.functionCounts]),
    },
  };
}

describe("evaluation dataset", () => {
  for (const sample of SAMPLES) {
    it(`${sample.name}: matches ground truth`, () => {
      const { findings } = runRules(ctxFor(sample));
      const reported = new Set(findings.map((f) => f.ruleId).filter((r): r is string => typeof r === "string"));
      for (const expected of sample.expectedRuleIds) {
        expect(reported, `should report ${expected}`).toContain(expected);
      }
      for (const notExpected of sample.notExpected ?? ([] as string[])) {
        expect(reported, `should NOT report ${notExpected}`).not.toContain(notExpected);
      }
    });
  }

  it("computes precision/recall/FP-rate over the dataset", () => {
    let tp = 0, fp = 0, fn = 0;
    for (const sample of SAMPLES) {
      const { findings } = runRules(ctxFor(sample));
      const reported = new Set(findings.map((f) => f.ruleId).filter((r): r is string => typeof r === "string"));
      const expected = new Set(sample.expectedRuleIds);
      for (const r of reported) {
        if (expected.has(r)) tp++; else fp++;
      }
      for (const e of expected) {
        if (!reported.has(e)) fn++;
      }
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const falsePositiveRate = tp + fp > 0 ? fp / (tp + fp) : 0;
    // thresholds for the built-in rule set on this dataset
    expect(precision).toBeGreaterThanOrEqual(0.8);
    expect(recall).toBeGreaterThanOrEqual(0.8);
    expect(falsePositiveRate).toBeLessThanOrEqual(0.2);
  });
});



