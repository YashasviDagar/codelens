import YAML from "yaml";
import { ReviewConfigSchema, DEFAULT_REVIEW_CONFIG, type ReviewConfig } from "@codelens/types";
import ignore from "ignore";

/**
 * Parses repository-level .codelens.yml config.
 * Falls back to defaults per-key on invalid content.
 */
export function parseRepoConfig(raw: string | null | undefined): ReviewConfig {
  if (!raw || !raw.trim()) return DEFAULT_REVIEW_CONFIG;
  try {
    const parsed = YAML.parse(raw);
    if (parsed == null || typeof parsed !== "object") return DEFAULT_REVIEW_CONFIG;
    const result = ReviewConfigSchema.safeParse(parsed);
    return result.success ? result.data : DEFAULT_REVIEW_CONFIG;
  } catch {
    return DEFAULT_REVIEW_CONFIG;
  }
}

/**
 * .codelensignore support (gitignore syntax).
 */
export function createIgnoreFilter(ignoreFileContent: string | null | undefined) {
  const ig = ignore();
  if (ignoreFileContent) ig.add(ignoreFileContent);
  return {
    ignores(path: string): boolean {
      return ignoreFileContent ? ig.ignores(path) : false;
    },
  };
}

export const DEFAULT_CODELENSIGNORE = `dist/
build/
node_modules/
*.min.js
*.lock
coverage/
vendor/
fixtures/
snapshots/
`;
