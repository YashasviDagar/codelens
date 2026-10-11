import { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { getSessionUser } from "../auth.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/analytics", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const q = request.query as { repo?: string };

    const where = {
      review: {
        pullRequest: {
          repository: {
            members: { some: { userId: user.id } },
            ...(q.repo ? { fullName: q.repo } : {}),
          },
        },
      },
    };
    const findings = await prisma.finding.findMany({
      where,
      select: { severity: true, category: true, status: true, createdAt: true, reviewId: true, review: { select: { pullRequest: { select: { repository: { select: { fullName: true } } } } } } },
    });
    const reviews = await prisma.review.findMany({
      where: { pullRequest: { repository: { members: { some: { userId: user.id } }, ...(q.repo ? { fullName: q.repo } : {}) } }, status: "COMPLETED" },
      select: { id: true, startedAt: true, completedAt: true, durationMs: true, qualityScore: true },
      orderBy: { startedAt: "asc" },
    });

    // findings over time (7-day buckets)
    const byDay = new Map<string, number>();
    const dayMs = 24 * 3600 * 1000;
    const now = Date.now();
    for (let d = 6; d >= 0; d--) {
      byDay.set(new Date(now - d * dayMs).toISOString().slice(0, 10), 0);
    }
    for (const f of findings) {
      const key = f.createdAt.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byRepo: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
      const repo = f.review.pullRequest.repository.fullName;
      byRepo[repo] = (byRepo[repo] ?? 0) + 1;
    }

    return {
      total: findings.length,
      findingsByDay: [...byDay.entries()].map(([date, count]) => ({ date, count })),
      bySeverity,
      byCategory,
      byRepo,
      byStatus,
      qualityTrend: reviews.filter((r) => r.qualityScore != null).slice(-20).map((r) => ({
        date: r.startedAt.toISOString().slice(0, 10),
        score: r.qualityScore,
      })),
      avgReviewMs: reviews.length ? reviews.reduce((s, r) => s + (r.durationMs ?? 0), 0) / reviews.length : 0,
      falsePositiveRate: findings.length ? (byStatus.FALSE_POSITIVE ?? 0) / findings.length : 0,
      recurringCategories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  });
}


