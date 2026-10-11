import { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { getSessionUser } from "../auth.js";
import { GitHubApiClient } from "@codelens/github";
import { decryptToken } from "../crypto.js";
import { ReviewConfigSchema } from "@codelens/types";

async function requireUser(request: any, reply: any) {
  const user = await getSessionUser(request);
  if (!user) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return user;
}

/**
 * Authorization: a user may only see repositories they are a member of.
 */
async function requireRepoAccess(request: any, reply: any, repositoryId: string, minPermission: "READ" | "WRITE" | "ADMIN" = "READ") {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const membership = await prisma.repositoryMember.findUnique({
    where: { repositoryId_userId: { repositoryId, userId: user.id } },
  });
  const order: Record<string, number> = { READ: 0, WRITE: 1, ADMIN: 2 };
  if (!membership || order[membership.permission] < order[minPermission]) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return { user, membership };
}

export async function repositoryRoutes(app: FastifyInstance) {
  // List repos from GitHub, marking which are already connected
  app.get("/repositories", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const client = new GitHubApiClient(decryptToken(user.githubToken));
    const repos = await client.listUserRepositories();
    const connected = await prisma.repository.findMany({
      where: { fullName: { in: repos.map((r: any) => r.full_name) } },
      include: { members: { where: { userId: user.id } } },
    });
    return repos.map((r: any) => {
      const existing = connected.find((c: any) => c.fullName === r.full_name);
      return {
        githubId: r.id.toString(),
        fullName: r.full_name,
        owner: r.owner.login,
        name: r.name,
        isPrivate: r.private,
        language: r.language,
        defaultBranch: r.default_branch,
        connected: Boolean(existing),
        codelensEnabled: existing?.webhookEnabled ?? false,
      };
    });
  });

  // Enable/disable CodeLens for a repository
  app.put("/repositories/:fullName/enable", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { fullName } = request.params as { fullName: string };
    const body = request.body as { enabled?: boolean } | null;
    const client = new GitHubApiClient(decryptToken(user.githubToken));
    const repos = await client.listUserRepositories();
    const ghRepo = repos.find((r: any) => r.full_name.toLowerCase() === fullName.toLowerCase());
    if (!ghRepo) return reply.code(403).send({ error: "repository not accessible with this token" });

    const repo = await prisma.repository.upsert({
      where: { githubId: BigInt(ghRepo.id) },
      update: { webhookEnabled: body?.enabled ?? true },
      create: {
        githubId: BigInt(ghRepo.id),
        owner: ghRepo.owner.login,
        name: ghRepo.name,
        fullName: ghRepo.full_name,
        defaultBranch: ghRepo.default_branch,
        isPrivate: ghRepo.private,
        language: ghRepo.language ?? undefined,
        webhookEnabled: body?.enabled ?? true,
      },
    });
    await prisma.repositoryMember.upsert({
      where: { repositoryId_userId: { repositoryId: repo.id, userId: user.id } },
      update: { permission: "ADMIN" },
      create: { repositoryId: repo.id, userId: user.id, permission: "ADMIN" },
    });
    return { connected: true, webhookEnabled: repo.webhookEnabled };
  });

  app.get("/repositories/:fullName", async (request, reply) => {
    const { fullName } = request.params as { fullName: string };
    const repo = await prisma.repository.findUnique({
      where: { fullName },
      include: { pullRequests: { orderBy: { createdAt: "desc" }, take: 20, include: { reviews: true } } },
    });
    if (!repo) return reply.code(404).send({ error: "not found" });
    const access = await requireRepoAccess(request, reply, repo.id);
    if (!access) return;
    return repo;
  });

  app.get("/repositories/:fullName/config", async (request, reply) => {
    const { fullName } = request.params as { fullName: string };
    const repo = await prisma.repository.findUnique({ where: { fullName } });
    if (!repo) return reply.code(404).send({ error: "not found" });
    if (!(await requireRepoAccess(request, reply, repo.id))) return;
    return repo.config;
  });

  app.put("/repositories/:fullName/config", async (request, reply) => {
    const { fullName } = request.params as { fullName: string };
    const repo = await prisma.repository.findUnique({ where: { fullName } });
    if (!repo) return reply.code(404).send({ error: "not found" });
    if (!(await requireRepoAccess(request, reply, repo.id, "WRITE"))) return;
    const parsed = ReviewConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: "invalid config", issues: parsed.error.issues.slice(0, 5) });
    }
    const updated = await prisma.repository.update({ where: { id: repo.id }, data: { config: parsed.data } });
    return updated.config;
  });

  // Dashboard aggregates
  app.get("/dashboard", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const repos = await prisma.repository.findMany({
    where: { members: { some: { userId: user.id } } },
    include: { pullRequests: { include: { reviews: true } } },
  });
  const allFindings = await prisma.finding.findMany({ where: { review: { pullRequest: { repository: { members: { some: { userId: user.id } } } } } } });
  const open = allFindings.filter((f) => f.status === "OPEN");
  const fp = allFindings.filter((f) => f.status === "FALSE_POSITIVE");
  const reviews = repos.flatMap((r) => r.pullRequests.flatMap((p) => p.reviews));
  const completed = reviews.filter((r) => r.status === "COMPLETED" && r.durationMs != null);

  return {
    repositories: repos.map((r) => {
      const prs = r.pullRequests;
      const reviewIds = new Set(prs.flatMap((p) => p.reviews.map((rev) => rev.id)));
      const repoFindings = open.filter((f) => reviewIds.has(f.reviewId));
      return {
        id: r.id,
        fullName: r.fullName,
        language: r.language,
        webhookEnabled: r.webhookEnabled,
        pullRequestCount: prs.length,
        openFindingCount: repoFindings.length,
        highSeverityCount: repoFindings.filter((f) => f.severity === "HIGH" || f.severity === "CRITICAL").length,
      };
    }),
    totals: {
      reviews: completed.length,
      findings: open.length,
      falsePositiveRate: allFindings.length > 0 ? fp.length / allFindings.length : 0,
      avgDurationMs: completed.length > 0 ? completed.reduce((s, r) => s + (r.durationMs ?? 0), 0) / completed.length : 0,
    },
  };
});

  app.get("/repositories/:fullName/dashboard", async (request, reply) => {
  const { fullName } = request.params as { fullName: string };
  const repo = await prisma.repository.findUnique({
    where: { fullName },
    include: { pullRequests: { orderBy: { createdAt: "desc" }, include: { reviews: { orderBy: { startedAt: "asc" } } } } },
  });
  if (!repo) return reply.code(404).send({ error: "not found" });
  if (!(await requireRepoAccess(request, reply, repo.id))) return;
  return repo;
});
}




