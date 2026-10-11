import { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { getSessionUser } from "../auth.js";
import { FeedbackTypeSchema } from "@codelens/types";
import { GitHubApiClient } from "@codelens/github";
import { decryptToken } from "../crypto.js";

async function requireUser(request: any, reply: any) {
  const user = await getSessionUser(request);
  if (!user) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return user;
}

async function authorizeReview(request: any, reply: any, reviewId: string) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { pullRequest: { include: { repository: { include: { members: true } } } } },
  });
  if (!review) {
    reply.code(404).send({ error: "review not found" });
    return null;
  }
  const isMember = review.pullRequest.repository.members.some((m: any) => m.userId === user.id);
  if (!isMember) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return { user, review };
}

export async function reviewRoutes(app: FastifyInstance) {
  app.get("/reviews/:reviewId", async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const ctx = await authorizeReview(request, reply, reviewId);
    if (!ctx) return;
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        findings: { orderBy: [{ severity: "asc" }, { confidence: "desc" }] },
        pullRequest: { include: { repository: true } },
      },
    });
    return review;
  });

  app.get("/reviews/:reviewId/status", async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const ctx = await authorizeReview(request, reply, reviewId);
    if (!ctx) return;
    const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { status: true, completedAt: true, error: true } });
    return review;
  });

  // File content around a finding line, for the code viewer
  app.get("/reviews/:reviewId/file", async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const ctx = await authorizeReview(request, reply, reviewId);
    if (!ctx) return;
    const q = request.query as { path?: string; line?: string };
    if (!q.path) return reply.code(422).send({ error: "path required" });

    const member = await prisma.repositoryMember.findFirst({
      where: { repositoryId: ctx.review.pullRequest.repository.id },
      include: { user: true },
    });
    if (!member) return reply.code(403).send({ error: "no token available" });

    const client = new GitHubApiClient(decryptToken(member.user.githubToken));
    const { owner, name } = ctx.review.pullRequest.repository;
    const content = await client.getFileContent(owner, name, q.path, ctx.review.commitSha);
    if (content == null) return reply.code(404).send({ error: "file not found at review commit" });

    const lines = content.split(/\r?\n/);
    const target = q.line ? parseInt(q.line, 10) : 1;
    const around = 12;
    const start = Math.max(1, target - around);
    const end = Math.min(lines.length, target + around);
    return {
      path: q.path,
      startLine: start,
      lines: lines.slice(start - 1, end),
      targetLine: target,
    };
  });

  // Developer feedback on a finding
  app.post("/findings/:findingId/feedback", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { findingId } = request.params as { findingId: string };
    const parsed = FeedbackTypeSchema.safeParse((request.body as any)?.type);
    if (!parsed.success) return reply.code(422).send({ error: "invalid feedback type" });

    const finding = await prisma.finding.findUnique({
      where: { id: findingId },
      include: { review: { include: { pullRequest: { include: { repository: { include: { members: true } } } } } } },
    });
    if (!finding) return reply.code(404).send({ error: "not found" });
    const isMember = finding.review.pullRequest.repository.members.some((m: any) => m.userId === user.id);
    if (!isMember) return reply.code(403).send({ error: "forbidden" });

    const feedback = await prisma.findingFeedback.upsert({
      where: { findingId_userId: { findingId, userId: user.id } },
      update: { type: parsed.data },
      create: { findingId, userId: user.id, type: parsed.data },
    });

    // feedback also sets finding status for FALSE_POSITIVE / FIXED / WONT_FIX
    const statusMap: Record<string, "OPEN" | "FIXED" | "FALSE_POSITIVE" | "WONT_FIX"> = {
      FALSE_POSITIVE: "FALSE_POSITIVE",
      FIXED: "FIXED",
      WONT_FIX: "WONT_FIX",
    };
    const status = statusMap[parsed.data];
    if (status) {
      await prisma.finding.update({
        where: { id: findingId },
        data: { status, resolvedAt: status === "OPEN" ? null : new Date() },
      });
    }
    return feedback;
  });
}

