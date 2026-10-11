import { type ReviewConfig } from "@codelens/types";

export function configHash(config: ReviewConfig): string {
  return Buffer.from(JSON.stringify(config)).toString("base64url");
}

/**
 * Cache key: same repo + same PR head commit + same config => reuse.
 * The Review model has a unique (pullRequestId, commitSha) index; a COMPLETED
 * review for the same pair means cached results are reusable.
 */
export const CACHE_ENABLED = true;
