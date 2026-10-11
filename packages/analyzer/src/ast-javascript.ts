import { Project, SyntaxKind, type SourceFile } from "ts-morph";
import type { ChangedSymbol } from "@codelens/types";

export interface JsAstInfo {
  symbols: ChangedSymbol[];
  imports: Array<{ module: string; names: string[] }>;
  // await calls inside for/for-of/while loops (N+1 indicator)
  awaitInLoop: Array<{ line: number; snippet: string }>;
  // try blocks with empty catch or missing catch
  emptyCatch: Array<{ line: number; snippet: string }>;
  functionCounts: Map<string, { complexity: number; length: number; nesting: number; line: number }>;
}

/** Parses JS/TS source and extracts structure used by rules + AI context. */
export function analyzeJavaScript(path: string, source: string): JsAstInfo {
  const project = new Project({ useInMemoryFileSystem: true });
  const file: SourceFile = project.createSourceFile(path, source);
  const symbols: ChangedSymbol[] = [];
  const imports: Array<{ module: string; names: string[] }> = [];
  const awaitInLoop: Array<{ line: number; snippet: string }> = [];
  const emptyCatch: Array<{ line: number; snippet: string }> = [];
  const functionCounts = new Map<string, { complexity: number; length: number; nesting: number; line: number }>();

  for (const imp of file.getImportDeclarations()) {
    imports.push({ module: imp.getModuleSpecifierValue(), names: imp.getNamedImports().map((n) => n.getName()) });
  }

  for (const fn of file.getFunctions()) {
    recordFunction(fn.getName() ?? "(anonymous)", fn.getStartLineNumber(), fn.getEndLineNumber(), fn.getStatements().length);
  }
  for (const cls of file.getClasses()) {
    symbols.push({
      name: cls.getName() ?? "(anonymous class)",
      kind: "class",
      file: path,
      startLine: cls.getStartLineNumber(),
      endLine: cls.getEndLineNumber(),
      touched: true,
    });
    for (const method of cls.getMethods()) {
      recordFunction(`${cls.getName()}.${method.getName()}`, method.getStartLineNumber(), method.getEndLineNumber(), method.getStatements().length);
    }
  }
  for (const vr of file.getVariableStatements()) {
    for (const decl of vr.getDeclarations()) {
      const init = decl.getInitializer();
      const isFn =
        init && (init.getKindName() === "ArrowFunction" || init.getKindName() === "FunctionExpression");
      if (isFn) {
        recordFunction(decl.getName(), vr.getStartLineNumber(), vr.getEndLineNumber(), 0);
      }
    }
  }

  // await inside loops & empty catch - walk statements
  for (const stmt of file.getDescendantsOfKind(SyntaxKind.ExpressionStatement)) {
    const text = stmt.getText();
    let node = stmt.getParent() as any;
    let depth = 0;
    while (node) {
      const kind = node.getKindName();
      if (kind === "ForStatement" || kind === "ForOfStatement" || kind === "ForInStatement" || kind === "WhileStatement" || kind === "DoStatement") {
        depth++;
      }
      node = node.getParent();
    }
    if (depth > 0 && text.includes("await ")) {
      awaitInLoop.push({ line: stmt.getStartLineNumber(), snippet: text.slice(0, 120) });
    }
  }

  for (const catchClause of file.getDescendantsOfKind(SyntaxKind.CatchClause)) {
    const block = catchClause.getBlock();
    if (block.getStatements().length === 0) {
      emptyCatch.push({ line: catchClause.getStartLineNumber(), snippet: "catch {} // empty" });
    }
  }

  function recordFunction(name: string, startLine: number, endLine: number, _statements: number): void {
    const complexity = estimateComplexity(file, startLine, endLine);
    const nesting = maxNesting(file, startLine, endLine);
    functionCounts.set(name, { complexity, length: endLine - startLine + 1, nesting, line: startLine });
    symbols.push({ name, kind: "function", file: path, startLine, endLine, touched: true });
  }

  return { symbols, imports, awaitInLoop, emptyCatch, functionCounts };
}

/**
 * Cyclomatic complexity estimate: 1 + decision points
 * (if/else-if/for/while/case/catch/&&/||/??).
 */
export function estimateComplexity(file: SourceFile, startLine: number, endLine: number): number {
  let complexity = 1;
  for (const node of file.getDescendants()) {
    const line = node.getStartLineNumber();
    if (line < startLine || line > endLine) continue;
    const kind = node.getKindName();
    if (
      kind === "IfStatement" ||
      kind === "ForStatement" ||
      kind === "ForOfStatement" ||
      kind === "ForInStatement" ||
      kind === "WhileStatement" ||
      kind === "DoStatement" ||
      kind === "CatchClause" ||
      kind === "CaseClause"
    ) {
      complexity++;
    } else if (kind === "BinaryExpression") {
      const op = (node as any).getOperatorToken?.()?.getKindName?.() ?? "";
      if (op === "AmpersandAmpersandToken" || op === "BarBarToken" || op === "QuestionQuestionToken") {
        complexity++;
      }
    }
  }
  return complexity;
}

function maxNesting(file: SourceFile, startLine: number, endLine: number): number {
  let max = 0;
  let current = 0;
  for (const node of file.getDescendants()) {
    const line = node.getStartLineNumber();
    if (line < startLine || line > endLine) continue;
    const kind = node.getKindName();
    if (
      kind === "Block" ||
      kind === "IfStatement" ||
      kind === "ForStatement" ||
      kind === "ForOfStatement" ||
      kind === "WhileStatement" ||
      kind === "TryStatement"
    ) {
      current++;
      max = Math.max(max, current);
    }
    // simplistic reset at function boundaries
  }
  return Math.max(1, Math.min(max, 12));
}


