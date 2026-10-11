import { describe, it, expect } from "vitest";
import { parseUnifiedDiff, addedLineNumbers, buildChangedLineIndex } from "../packages/analyzer/src/diff-parser";

const MODIFIED = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export { a };
`;

describe("parseUnifiedDiff", () => {
  it("parses a modified file with line numbers and counts", () => {
    const diff = parseUnifiedDiff(MODIFIED);
    expect(diff.files).toHaveLength(1);
    const f = diff.files[0];
    expect(f.path).toBe("src/a.ts");
    expect(f.status).toBe("modified");
    expect(f.additions).toBe(2);
    expect(f.deletions).toBe(1);
    expect(addedLineNumbers(f)).toEqual([2, 3]);
    expect(diff.totalAdditions).toBe(2);
    expect(diff.totalDeletions).toBe(1);
  });

  it("detects added and deleted files", () => {
    const diff = parseUnifiedDiff(`diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,1 @@
+export const x = 1;
diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-export const y = 2;
`);
    expect(diff.files.map((f) => f.status)).toEqual(["added", "deleted"]);
  });

  it("detects renames and records the old path", () => {
    const diff = parseUnifiedDiff(`diff --git a/old/name.ts b/new/name.ts
similarity index 90%
rename from old/name.ts
rename to new/name.ts
--- a/old/name.ts
+++ b/new/name.ts
@@ -1,1 +1,1 @@
-a
+b
`);
    expect(diff.files[0].status).toBe("renamed");
    expect(diff.files[0].path).toBe("new/name.ts");
    expect(diff.files[0].oldPath).toBe("old/name.ts");
  });

  it("ignores the 'No newline at end of file' marker", () => {
    const diff = parseUnifiedDiff(`diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,1 +1,1 @@
-a
\ No newline at end of file
+b
\ No newline at end of file
`);
    expect(diff.files[0].additions).toBe(1);
    expect(diff.files[0].deletions).toBe(1);
  });

  it("handles CRLF input and empty diffs", () => {
    expect(parseUnifiedDiff(MODIFIED.replace(/\n/g, "\r\n")).files[0].additions).toBe(2);
    expect(parseUnifiedDiff("").files).toEqual([]);
  });

  it("builds a changed-line index and skips deleted files", () => {
    const diff = parseUnifiedDiff(MODIFIED + `diff --git a/gone.ts b/gone.ts
deleted file mode 100644
--- a/gone.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-x
`);
    const idx = buildChangedLineIndex(diff);
    expect([...(idx.get("src/a.ts") ?? [])]).toEqual([2, 3]);
    expect(idx.has("gone.ts")).toBe(false);
  });
});
