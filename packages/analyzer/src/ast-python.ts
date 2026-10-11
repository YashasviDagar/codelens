import type { ChangedSymbol } from "@codelens/types";

export interface PyAstInfo {
  symbols: ChangedSymbol[];
  functionCounts: Map<string, { complexity: number; length: number; nesting: number; line: number }>;
  bareExcept: Array<{ line: number; snippet: string }>;
}

// Regex-based Python analyzer (lightweight, no external Python dependency).
// For production-grade analysis, swap in tree-sitter-python.
const FUNC_RE = /^(\s*)def\s+(\w+)\s*\(/;
const CLASS_RE = /^(\s*)class\s+(\w+)/;
const BARE_EXCEPT_RE = /^\s*except\s*:/;

export function analyzePython(path: string, source: string): PyAstInfo {
  const lines = source.split(/\r?\n/);
  const symbols: ChangedSymbol[] = [];
  const functionCounts = new Map<string, { complexity: number; length: number; nesting: number; line: number }>();
  const bareExcept: Array<{ line: number; snippet: string }> = [];

  const funcStack: Array<{ name: string; start: number; indent: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const funcMatch = line.match(FUNC_RE);
    if (funcMatch) {
      const indent = funcMatch[1].length;
      funcStack.push({ name: funcMatch[2], start: i + 1, indent });
    } else {
      const classMatch = line.match(CLASS_RE);
      if (classMatch) {
        symbols.push({
          name: classMatch[2],
          kind: "class",
          file: path,
          startLine: i + 1,
          endLine: i + 1, // refined below
          touched: true,
        });
      }
    }
    if (BARE_EXCEPT_RE.test(line)) {
      bareExcept.push({ line: i + 1, snippet: line.trim() });
    }
  }

  // compute function ends by next same-or-lower indent or EOF
  for (let f = 0; f < funcStack.length; f++) {
    const fn = funcStack[f];
    let end = lines.length;
    for (let j = fn.start; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === "") continue;
      const indent = l.length - l.trimStart().length;
      if (indent <= fn.indent) {
        end = j;
        break;
      }
    }
    const body = lines.slice(fn.start, end).join("\n");
    functionCounts.set(fn.name, {
      complexity: 1 + countDecisions(body),
      length: end - fn.start + 1,
      nesting: maxPyIndent(body),
      line: fn.start,
    });
    symbols.push({
      name: fn.name,
      kind: "function",
      file: path,
      startLine: fn.start,
      endLine: end,
      touched: true,
    });
  }

  return { symbols, functionCounts, bareExcept };
}

function countDecisions(body: string): number {
  const matches = body.match(/\b(if|elif|for|while|except|and|\|\||or)\b/g);
  return matches ? matches.length : 0;
}

function maxPyIndent(body: string): number {
  let max = 0;
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    max = Math.max(max, Math.floor((line.length - line.trimStart().length) / 4));
  }
  return max + 1;
}
