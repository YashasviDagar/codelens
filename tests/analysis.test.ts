import { describe, it, expect } from "vitest";
import { parseUnifiedDiff, addedLineNumbers } from "@codelens/analyzer";
import { runRules } from "@codelens/rules";

const DIFF = `diff --git a/src/payment.ts b/src/payment.ts
--- a/src/payment.ts
+++ b/src/payment.ts
@@ -10,6 +10,10 @@ export async function charge(users: string[]) {
-  console.log("start");
+  for (const u of users) {
+    await db.getUser(u.id);
+  }
+  try {
+    doWork();
+  } catch {}
   return result;
 }`;

const SOURCE = `export async function charge(users: string[]) {
  for (const u of users) {
    await db.getUser(u.id);
  }
  try {
    doWork();
  } catch {}
  return result;
}
function dup1() { console.log("x"); }
function dup2() { console.log("x"); }`;

describe("diff parser", () => {
  it("parses hunks with correct line numbers", () => {
    const diff = parseUnifiedDiff(DIFF);
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0].additions).toBe(6);
    expect(diff.files[0].deletions).toBe(1);
    const added = addedLineNumbers(diff.files[0]);
    expect(added).toEqual([10, 11, 12, 13, 14, 15]);
  });
});

describe("rule engine", () => {
  it("detects await-in-loop and empty catch", async () => {
    const { analyzeJavaScript } = await import("@codelens/analyzer");
    const ast = analyzeJavaScript("src/payment.ts", SOURCE);
    const lines = SOURCE.split("\n");
    const res = runRules({
      file: "src/payment.ts",
      language: "typescript",
      source: SOURCE,
      lines,
      addedLines: [2, 3],
      ast: {
        awaitInLoop: ast.awaitInLoop,
        emptyCatch: ast.emptyCatch,
        bareExcept: [],
        functionMetrics: new Map([...ast.functionCounts].map(([k, v]) => [k, { ...v }])),
      },
    });
    const ruleIds = res.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain("RULE002");
    expect(ruleIds).toContain("RULE003");
  });
});


