import { FastifyInstance } from "fastify";
import { verifyWebhookSignature } from "@codelens/github";
import { WebhookPullRequestPayloadSchema, REVIEW_TRIGGERS } from "@codelens/types";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { getRawBody } from "../rawbody.js";
import { enqueueReview } from "../queue.js";

/**
 * GitHub webhook endpoint.
 * 1. Verify HMAC signature (timing safe)
 * 2. Validate payload with Zod
 * 3. Persist PR state
 * 4. Enqueue deduped review job
 */
export async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/github", {
    
    handler: async (request, reply) => {
      const signature = request.headers["x-hub-signature-256"] as string | undefined;
      const eventType = request.headers["x-github-event"] as string | undefined;

      if (!verifyWebhookSignature(getRawBody(request) ?? Buffer.alloc(0), signature, env.GITHUB_WEBHOOK_SECRET)) {
        return reply.code(401).send({ error: "invalid signature" });
      }
      if (eventType === "ping") return { ok: true };

      if (eventType !== "pull_request") {
        return reply.code(200).send({ ignored: eventType });
      }

      const parsed = WebhookPullRequestPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send({ error: "invalid payload", issues: parsed.error.issues.slice(0, 5) });
      }
      const payload = parsed.data;

      if (!REVIEW_TRIGGERS.has(payload.action)) {
        // closed/edited: update state only
        if (payload.action === "closed") {
          await prisma.pullRequest.updateMany({
            where: { repository: { githubId: payload.repository.id }, githubPrNumber: payload.number },
            data: { status: payload.pull_request.base ? "CLOSED" : "CLOSED", closedAt: new Date() },
          });
        }
        return { ignored: payload.action };
      }

      const repo = await prisma.repository.upsert({
        where: { githubId: payload.repository.id },
        update: { defaultBranch: payload.repository.default_branch ?? "main" },
        create: {
          githubId: payload.repository.id,
          owner: payload.repository.owner.login,
          name: payload.repository.name,
          fullName: payload.repository.full_name,
          defaultBranch: payload.repository.default_branch ?? "main",
          isPrivate: payload.repository.private ?? false,
          language: payload.repository.language ?? undefined,
        },
      });

      const pr = await prisma.pullRequest.upsert({
        where: { repositoryId_githubPrNumber: { repositoryId: repo.id, githubPrNumber: payload.number } },
        update: { title: payload.pull_request.title, headSha: payload.pull_request.head.sha, status: "OPEN" },
        create: {
          repositoryId: repo.id,
          githubPrNumber: payload.number,
          title: payload.pull_request.title,
          authorLogin: payload.pull_request.user.login,
          branchName: payload.pull_request.head.ref,
          baseSha: payload.pull_request.base.sha,
          headSha: payload.pull_request.head.sha,
        },
      });

      const review = await prisma.review.upsert({
        where: { pullRequestId_commitSha: { pullRequestId: pr.id, commitSha: payload.pull_request.head.sha } },
        update: { status: "QUEUED", error: null },
        create: {
          pullRequestId: pr.id,
          commitSha: payload.pull_request.head.sha,
          status: "QUEUED",
        },
      });

      await enqueueReview({
        repositoryId: repo.id,
        pullRequestId: pr.id,
        owner: repo.owner,
        repo: repo.name,
        prNumber: pr.githubPrNumber,
        commitSha: payload.pull_request.head.sha,
      });

      app.log.info({ repo: repo.fullName, pr: pr.githubPrNumber, reviewId: review.id }, "review queued");
      return { queued: true, reviewId: review.id };
    },
  });
}


