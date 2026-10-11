import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const SECRET = vi.hoisted(() => "wh-secret");

const prismaMock = vi.hoisted(() => ({
  repository: { upsert: vi.fn() },
  pullRequest: { upsert: vi.fn(), updateMany: vi.fn() },
  review: { upsert: vi.fn() },
}));
const enqueueReview = vi.hoisted(() => vi.fn());

vi.mock("../apps/api/src/prisma", () => ({ prisma: prismaMock }));
vi.mock("../apps/api/src/queue", () => ({ enqueueReview }));
vi.mock("../apps/api/src/env", () => ({ env: { GITHUB_WEBHOOK_SECRET: SECRET } }));

import { webhookRoutes } from "../apps/api/src/routes/webhooks";
import { setRawBody } from "../apps/api/src/rawbody";
import { signPayload } from "../packages/github/src/webhook-signature";

async function buildApp() {
  const app = Fastify();
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body: Buffer, done) => {
    setRawBody(req, body);
    try {
      done(null, JSON.parse(body.toString("utf-8")));
    } catch (err) {
      done(err as Error, undefined);
    }
  });
  await app.register(webhookRoutes, { prefix: "/api" });
  return app;
}

const payload = (action = "opened") => ({
  action,
  number: 7,
  pull_request: {
    number: 7,
    title: "Add feature",
    user: { login: "dev" },
    head: { ref: "feat", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
  },
  repository: { id: 42, name: "repo", full_name: "acme/repo", owner: { login: "acme" } },
});

async function post(app: Awaited<ReturnType<typeof buildApp>>, body: unknown, event: string, sign = true) {
  const raw = JSON.stringify(body);
  return app.inject({
    method: "POST",
    url: "/api/webhooks/github",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      ...(sign ? { "x-hub-signature-256": signPayload(raw, SECRET) } : {}),
    },
    payload: raw,
  });
}

describe("POST /api/webhooks/github", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.repository.upsert.mockResolvedValue({ id: "r1", owner: "acme", name: "repo", fullName: "acme/repo" });
    prismaMock.pullRequest.upsert.mockResolvedValue({ id: "p1", githubPrNumber: 7 });
    prismaMock.review.upsert.mockResolvedValue({ id: "rev1" });
    enqueueReview.mockResolvedValue({ deduped: false, jobId: "j" });
  });

  it("rejects a missing signature with 401", async () => {
    const app = await buildApp();
    const res = await post(app, payload(), "pull_request", false);
    expect(res.statusCode).toBe(401);
    expect(enqueueReview).not.toHaveBeenCalled();
  });

  it("rejects a bad signature with 401", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks/github",
      headers: { "content-type": "application/json", "x-github-event": "pull_request", "x-hub-signature-256": "sha256=deadbeef" },
      payload: JSON.stringify(payload()),
    });
    expect(res.statusCode).toBe(401);
  });

  it("answers ping", async () => {
    const app = await buildApp();
    const res = await post(app, { zen: "hi" }, "ping");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("ignores non pull_request events", async () => {
    const app = await buildApp();
    const res = await post(app, { a: 1 }, "issues");
    expect(res.json()).toEqual({ ignored: "issues" });
  });

  it("returns 422 for an invalid pull_request payload", async () => {
    const app = await buildApp();
    const res = await post(app, { action: "opened" }, "pull_request");
    expect(res.statusCode).toBe(422);
  });

  it("queues a review for an opened PR", async () => {
    const app = await buildApp();
    const res = await post(app, payload("opened"), "pull_request");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ queued: true, reviewId: "rev1" });
    expect(enqueueReview).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryId: "r1", pullRequestId: "p1", prNumber: 7, commitSha: "abc123" })
    );
  });

  it("marks the PR closed without queuing a review", async () => {
    const app = await buildApp();
    const res = await post(app, payload("closed"), "pull_request");
    expect(res.json()).toEqual({ ignored: "closed" });
    expect(prismaMock.pullRequest.updateMany).toHaveBeenCalled();
    expect(enqueueReview).not.toHaveBeenCalled();
  });
});
