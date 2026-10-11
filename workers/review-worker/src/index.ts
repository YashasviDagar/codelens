import { Worker } from "bullmq";
import { REVIEW_QUEUE } from "./queue.js";
import { runReviewPipeline, type PipelineJobData } from "./pipeline.js";
import { prisma } from "./prisma.js";

const worker = new Worker<PipelineJobData>(
  REVIEW_QUEUE,
  async (job) => {
    await runReviewPipeline(job.data, {
      info: (obj, msg) => console.log("[review]", msg ?? "", JSON.stringify(obj)),
    });
  },
  {
    connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
    limiter: { max: 10, duration: 60_000 },
  }
);

worker.on("completed", async (job) => {
  console.log(`[review] job ${job.id} completed`);
});
worker.on("failed", async (job, err) => {
  console.error(`[review] job ${job?.id} failed after ${job?.attemptsMade} attempts: ${err.message}`);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const data = job.data;
    if (data?.pullRequestId && data?.commitSha) {
      await prisma.review.updateMany({
        where: { pullRequestId: data.pullRequestId, commitSha: data.commitSha },
        data: { status: "FAILED", error: err.message.slice(0, 500) },
      });
    }
  }
});

// graceful shutdown
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`[review] ${signal} received, closing worker`);
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

console.log("[review] worker started");
