export type Language = "javascript" | "typescript" | "python" | "json" | "markdown" | "other";

const EXTENSION_MAP: Record<string, Language> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".json": "json",
  ".md": "markdown",
};

const EXTENSION_TO_LANGUAGE_ID: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
};

export function detectLanguage(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return EXTENSION_TO_LANGUAGE_ID[ext] ?? "plaintext";
}

export function normalizeLanguage(path: string): Language {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MAP[ext] ?? "other";
}

// Only these languages get AST/metric analysis in the first release.
export const SUPPORTED_LANGUAGES: Language[] = ["javascript", "typescript", "python"];

export function isAnalyzable(path: string): boolean {
  return SUPPORTED_LANGUAGES.includes(normalizeLanguage(path));
}
