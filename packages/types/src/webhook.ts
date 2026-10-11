import { z } from "zod";

export const GitHubEventTypeSchema = z.enum([
  "pull_request.opened",
  "pull_request.synchronize",
  "pull_request.reopened",
  "pull_request.closed",
  "ping",
  "installation",
  "installation_repositories",
]);
export type GitHubEventType = z.infer<typeof GitHubEventTypeSchema>;

export const PullRequestActionSchema = z.enum([
  "opened",
  "synchronize",
  "reopened",
  "closed",
  "edited",
]);

export const WebhookPullRequestPayloadSchema = z.object({
  action: PullRequestActionSchema,
  number: z.number().int().positive(),
  pull_request: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string().nullable().optional(),
    user: z.object({ login: z.string() }),
    head: z.object({ ref: z.string(), sha: z.string() }),
    base: z.object({ ref: z.string(), sha: z.string() }),
    changed_files: z.number().int().optional(),
    additions: z.number().int().optional(),
    deletions: z.number().int().optional(),
  }),
  repository: z.object({
    id: z.number().int(),
    name: z.string(),
    full_name: z.string(),
    owner: z.object({ login: z.string() }),
    default_branch: z.string().optional(),
    private: z.boolean().optional(),
    language: z.string().nullable().optional(),
    html_url: z.string().optional(),
  }),
  installation: z.object({ id: z.number().int() }).optional(),
  sender: z.object({ login: z.string() }).optional(),
});

export type WebhookPullRequestPayload = z.infer<typeof WebhookPullRequestPayloadSchema>;

// Which actions trigger a review
export const REVIEW_TRIGGERS = new Set(["opened", "synchronize", "reopened"]);
