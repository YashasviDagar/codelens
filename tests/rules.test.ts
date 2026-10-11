import { describe, it, expect } from "vitest";
import { analyzeJavaScript, analyzePython } from "../packages/analyzer/src/index";
import { runRules } from "../packages/rules/src/engine";
import type { RuleContext } from "../packages/rules/src/rule";

function ctx(file: string, source: string, addedLines?: number[]): RuleContext {
  const isPy = file.endsWith(".py");
  const ast = isPy ? analyzePython(file, source) : analyzeJavaScript(file, source);
  const lines = source.split("\n");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = ast as any;
  return {
    file,
    language: isPy ? "python" : "typescript",
    source,
    lines,
    addedLines: addedLines ?? lines.map((_, i) => i + 1),
    ast: {
      awaitInLoop: a.awaitInLoop ?? [],
      emptyCatch: a.emptyCatch ?? [],
      bareExcept: a.bareExcept ?? [],
      functionMetrics: new Map([...ast.functionCounts]),
    },
  };
}

const ids = (c: RuleContext) => new Set(runRules(c).findings.map((f) => f.ruleId));

describe("built-in rules", () => {
  it("RULE002 flags await inside a loop", () => {
    const c = ctx("a.ts", `async function f(xs: number[]) {\n  for (const x of xs) {\n    await g(x);\n  }\n}\n`);
    expect(ids(c)).toContain("RULE002");
  });

  it("RULE002 does not flag await outside loops", () => {
    const c = ctx("a.ts", `async function f(x: number) {\n  await g(x);\n}\n`);
    expect(ids(c)).not.toContain("RULE002");
  });

  it("RULE003 flags an empty catch block", () => {
    const c = ctx("a.ts", `function f() {\n  try { g(); } catch (e) {}\n}\n`);
    expect(ids(c)).toContain("RULE003");
  });

  it("RULE003 flags a bare except in python", () => {
    const c = ctx("a.py", `def f():\n    try:\n        g()\n    except:\n        pass\n`);
    expect(ids(c)).toContain("RULE003");
  });

  it("RULE003 does not flag a catch that handles the error", () => {
    const c = ctx("a.ts", `function f() {\n  try { g(); } catch (e) {\n    console.error(e);\n    throw e;\n  }\n}\n`);
    expect(ids(c)).not.toContain("RULE003");
  });

  it("RULE004 flags a very long function", () => {
    const body = Array.from({ length: 90 }, (_, i) => `  const v${i} = ${i};`).join("\n");
    const c = ctx("a.ts", `function big() {\n${body}\n}\n`);
    expect(ids(c)).toContain("RULE004");
  });

  it("RULE005 flags deep nesting", () => {
    const c = ctx("a.ts", `function f(a: any) {\n  if (a) {\n    if (a.b) {\n      if (a.c) {\n        if (a.d) {\n          if (a.e) {\n            if (a.f) {\n              return 1;\n            }\n          }\n        }\n      }\n    }\n  }\n}\n`);
    expect(ids(c)).toContain("RULE005");
  });

  it("RULE007 flags console.log in added lines", () => {
    const c = ctx("a.ts", `function f() {\n  console.log("x");\n}\n`);
    expect(ids(c)).toContain("RULE007");
  });

  it("only reports on added lines", () => {
    const c = ctx("a.ts", `function f() {\n  console.log("x");\n}\n`, [1]);
    expect(ids(c)).not.toContain("RULE007");
  });

  it("clean code produces no findings", () => {
    const c = ctx("a.ts", `export function add(a: number, b: number): number {\n  return a + b;\n}\n`);
    expect(runRules(c).findings).toEqual([]);
  });

  it("respects disabledRuleIds", () => {
    const c = ctx("a.ts", `function f() {\n  console.log("x");\n}\n`);
    const res = runRules(c, { disabledRuleIds: new Set(["RULE007"]) });
    expect(res.findings.map((f) => f.ruleId)).not.toContain("RULE007");
  });
});
