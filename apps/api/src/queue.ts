import { Queue } from "bullmq";
import { env } from "./env.js";

export const REVIEW_QUEUE = "codelens-review";

let queue: Queue | null = null;

export function getReviewQueue(): Queue {
  if (!queue) {
    queue = new Queue(REVIEW_QUEUE, {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }
  return queue;
}

export interface ReviewJobData {
  repositoryId: string;
  pullRequestId: string;
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
  installationToken?: string;
  userToken?: string;
}

/**
 * Dedupe key: one job per (repo, pr, commit).
 * Duplicate webhooks for the same commit become no-ops.
 */
export async function enqueueReview(job: ReviewJobData) {
  const jobId = `review:${job.repositoryId}:${job.pullRequestId}:${job.commitSha}`;
  const queue = getReviewQueue();
  const existing = await queue.getJob(jobId);
  if (existing && !(await existing.isFailed())) {
    return { deduped: true, jobId };
  }
  await queue.add("review", job, { jobId });
  return { deduped: false, jobId };
}
