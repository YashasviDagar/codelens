import type { ParsedDiff, ChangedSymbol } from "@codelens/types";
import { addedLineNumbers } from "./diff-parser.js";
import { normalizeLanguage } from "./language.js";
import { analyzeJavaScript } from "./ast-javascript.js";
import { analyzePython } from "./ast-python.js";

export interface FileAnalysis {
  path: string;
  language: string;
  symbols: ChangedSymbol[];
  metrics: Array<{ name: string; line: number; cyclomaticComplexity: number; length: number; nesting: number }>;
  awaitInLoop: Array<{ line: number; snippet: string }>;
  emptyCatch: Array<{ line: number; snippet: string }>;
  bareExcept: Array<{ line: number; snippet: string }>;
  duplication: Array<{ lines: [number, number]; snippet: string }>;
}

/**
 * Maps changed diff lines onto functions/classes so analysis
 * focuses on the code the PR actually touched.
 */
export function mapChangedSymbols(file: { path: string }, symbols: ChangedSymbol[], addedLines: number[]): ChangedSymbol[] {
  return symbols.map((s) => ({
    ...s,
    touched: addedLines.some((l) => l >= s.startLine && l <= s.endLine),
  }));
}

/**
 * Analyzes a set of source files that appear in the diff.
 * Only changed functions produce detailed metrics.
 */
export function analyzeSources(sources: Map<string, string>, diff: ParsedDiff): FileAnalysis[] {
  const results: FileAnalysis[] = [];
  for (const [path, source] of sources) {
    const lang = normalizeLanguage(path);
    const diffFile = diff.files.find((f) => f.path === path);
    const added = diffFile ? addedLineNumbers(diffFile) : [];

    if (lang === "typescript" || lang === "javascript") {
      const info = analyzeJavaScript(path, source);
      const touchedSymbols = mapChangedSymbols({ path }, info.symbols, added);
      results.push({
        path,
        language: lang,
        symbols: touchedSymbols,
        metrics: [...info.functionCounts.entries()].map(([name, m]) => ({ name, line: m.line, cyclomaticComplexity: m.complexity, length: m.length, nesting: m.nesting })),
        awaitInLoop: info.awaitInLoop,
        emptyCatch: info.emptyCatch,
        bareExcept: [],
        duplication: findDup(source),
      });
    } else if (lang === "python") {
      const info = analyzePython(path, source);
      const touchedSymbols = mapChangedSymbols({ path }, info.symbols, added);
      results.push({
        path,
        language: lang,
        symbols: touchedSymbols,
        metrics: [...info.functionCounts.entries()].map(([name, m]) => ({ name, line: m.line, cyclomaticComplexity: m.complexity, length: m.length, nesting: m.nesting })),
        awaitInLoop: [],
        emptyCatch: [],
        bareExcept: info.bareExcept,
        duplication: findDup(source),
      });
    }
  }
  return results;
}

import { findDuplication } from "./metrics.js";
function findDup(source: string) {
  return findDuplication(source);
}
