import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  review: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  repository: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  user: { findUnique: vi.fn() },
  finding: { deleteMany: vi.fn(), create: vi.fn() },
}));
const gh = vi.hoisted(() => ({
  getPullRequestDiff: vi.fn(),
  getFileContent: vi.fn(),
  createInlineComment: vi.fn(),
  createIssueComment: vi.fn(),
}));

vi.mock("../workers/review-worker/src/prisma", () => ({ prisma: prismaMock }));
vi.mock("../workers/review-worker/src/decrypt", () => ({ decryptToken: (t: string) => t }));
vi.mock("@codelens/github", () => ({
  GitHubApiClient: class {
    getPullRequestDiff = gh.getPullRequestDiff;
    getFileContent = gh.getFileContent;
    createInlineComment = gh.createInlineComment;
    createIssueComment = gh.createIssueComment;
  },
}));

import { runReviewPipeline } from "../workers/review-worker/src/pipeline";

const JOB = { repositoryId: "r1", pullRequestId: "p1", owner: "acme", repo: "repo", prNumber: 7, commitSha: "abc123" };
const log = { info: vi.fn() };

const SOURCE = `export function load() {
  try {
    run();
  } catch (e) {}
  console.log("done");
}
`;
const DIFF = `diff --git a/src/load.ts b/src/load.ts
new file mode 100644
--- /dev/null
+++ b/src/load.ts
@@ -0,0 +1,6 @@
${SOURCE.trimEnd().split("\n").map((l) => "+" + l).join("\n")}
`;

describe("runReviewPipeline (mocked I/O)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = "machine-token";
    delete process.env.OPENAI_API_KEY;
    prismaMock.review.findUnique.mockResolvedValue({ id: "rev1", pullRequest: { title: "Add load", repository: {} } });
    prismaMock.review.findFirst.mockResolvedValue(null);
    prismaMock.repository.findUnique.mockResolvedValue({ members: [] });
    prismaMock.repository.findUniqueOrThrow.mockResolvedValue({ config: {} });
    gh.getPullRequestDiff.mockResolvedValue(DIFF);
    gh.getFileContent.mockResolvedValue(SOURCE);
  });

  it("analyzes the diff, persists findings and posts comments", async () => {
    await runReviewPipeline(JOB, log);

    const statuses = prismaMock.review.update.mock.calls.map((c) => c[0].data.status).filter(Boolean);
    expect(statuses).toEqual(["ANALYZING", "STATIC_ANALYSIS", "COMPLETED"]);

    const created = prismaMock.finding.create.mock.calls.map((c) => c[0].data.ruleId);
    expect(created).toContain("RULE003");
    expect(prismaMock.finding.deleteMany).toHaveBeenCalledWith({ where: { reviewId: "rev1" } });

    // summary comment is always posted
    expect(gh.createIssueComment).toHaveBeenCalled();
  });

  it("reuses a completed analysis (cache hit) without calling GitHub", async () => {
    prismaMock.review.findFirst.mockResolvedValue({ id: "old" });
    await runReviewPipeline(JOB, log);
    expect(gh.getPullRequestDiff).not.toHaveBeenCalled();
    expect(prismaMock.review.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("throws when the review row is missing", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null);
    await expect(runReviewPipeline(JOB, log)).rejects.toThrow(/Review row missing/);
  });

  it("throws when no GitHub token is available", async () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.OPENAI_GITHUB_TOKEN;
    await expect(runReviewPipeline(JOB, log)).rejects.toThrow(/No GitHub token/);
  });

  it("skips ignored paths under default ignore patterns", async () => {
    gh.getPullRequestDiff.mockResolvedValue(`diff --git a/dist/bundle.js b/dist/bundle.js
--- a/dist/bundle.js
+++ b/dist/bundle.js
@@ -1,1 +1,1 @@
-a
+b
`);
    await runReviewPipeline(JOB, log);
    expect(gh.getFileContent).not.toHaveBeenCalled();
    expect(prismaMock.finding.create).not.toHaveBeenCalled();
  });
});
