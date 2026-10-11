import type { DiffHunkLine, DiffHunk, DiffFile, ParsedDiff } from "@codelens/types";
import { detectLanguage } from "./language.js";

const FILE_HEADER = /^diff --git a\/(.+?) b\/(.+)$/;
const OLD_PATH = /^--- (?:a\/(.*)|\/dev\/null)$/;
const NEW_PATH = /^\+\+\+ (?:b\/(.*)|\/dev\/null)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parses a unified git diff into a structured form.
 * Handles added/modified/deleted/renamed files and tracks
 * old/new line numbers per hunk line.
 */
export function parseUnifiedDiff(diffText: string): ParsedDiff {
  const files: DiffFile[] = [];
  const lines = diffText.split(/\r?\n/);

  let current: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldCur = 0;
  let newCur = 0;

  for (const line of lines) {
    const header = line.match(FILE_HEADER);
    if (header) {
      flush(files, current);
      const [, a, b] = header;
      current = {
        path: renameTarget(line, lines, b),
        status: "modified",
        additions: 0,
        deletions: 0,
        hunks: [],
        language: detectLanguage(b),
      };
      // detect rename origin for display
      current.oldPath = a !== b ? a : undefined;
      currentHunk = null;
      continue;
    }

    if (!current) continue;

    if (line.startsWith("new file mode")) {
      current.status = "added";
      continue;
    }
    if (line.startsWith("deleted file mode")) {
      current.status = "deleted";
      continue;
    }
    if (line.startsWith("rename from ")) {
      current.oldPath = line.slice("rename from ".length);
      continue;
    }
    if (line.startsWith("rename to ")) {
      current.path = line.slice("rename to ".length);
      current.status = "renamed";
      continue;
    }

    const oldMatch = line.match(OLD_PATH);
    if (oldMatch && !oldMatch[1]) {
      // /dev/null => file created
      if (current.status === "modified") current.status = "added";
      continue;
    }
    const newMatch = line.match(NEW_PATH);
    if (newMatch && !newMatch[1]) {
      if (current.status === "modified") current.status = "deleted";
      continue;
    }

    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch) {
      oldCur = parseInt(hunkMatch[1], 10);
      newCur = parseInt(hunkMatch[3], 10);
      currentHunk = {
        oldStart: oldCur,
        oldLines: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
        newStart: newCur,
        newLines: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
        lines: [],
      };
      current.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk) {
      if (line.startsWith("+")) {
        push(currentHunk, { type: "added", newLine: newCur, oldLine: null, content: line.slice(1) });
        current.additions++;
        newCur++;
      } else if (line.startsWith("-")) {
        push(currentHunk, { type: "removed", oldLine: oldCur, newLine: null, content: line.slice(1) });
        current.deletions++;
        oldCur++;
      } else if (line.startsWith(" ")) {
        push(currentHunk, { type: "context", oldLine: oldCur, newLine: newCur, content: line.slice(1) });
        oldCur++;
        newCur++;
      } else if (line.startsWith("\\") || line === "") {
        // "\ No newline at end of file" or trailing blank
      }
    }
  }

  flush(files, current);

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);
  return { files, totalAdditions, totalDeletions };
}

function renameTarget(headerLine: string, _lines: string[], fallback: string): string {
  return fallback;
}

function push(hunk: DiffHunk, line: DiffHunkLine): void {
  hunk.lines.push(line);
}

function flush(files: DiffFile[], current: DiffFile | null): void {
  if (current) {
    if (current.oldPath === current.path) current.oldPath = undefined;
    if (current.status === "renamed" && !current.oldPath) current.status = "modified";
    files.push(current);
  }
}

/**
 * Returns added line numbers (in the new file) for a given file.
 * These are the lines reviewers should focus on.
 */
export function addedLineNumbers(file: DiffFile): number[] {
  const out: number[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === "added" && line.newLine != null) out.push(line.newLine);
    }
  }
  return out;
}

/**
 * Builds a per-file hunk index for fast "is this line changed?" checks.
 */
export function buildChangedLineIndex(diff: ParsedDiff): Map<string, Set<number>> {
  const index = new Map<string, Set<number>>();
  for (const file of diff.files) {
    if (file.status === "deleted") continue;
    const set = new Set<number>(addedLineNumbers(file));
    // context lines are not "changed", but they anchor surrounding code
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === "added" && line.newLine != null) set.add(line.newLine);
      }
    }
    index.set(file.path, set);
  }
  return index;
}
