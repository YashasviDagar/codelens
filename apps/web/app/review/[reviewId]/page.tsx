import { apiFetch, type ReviewDto } from "../../../lib/api";
import { FindingList } from "../../../components/finding-list";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: { reviewId: string } }) {
  const review = await apiFetch<ReviewDto>(`/api/reviews/${params.reviewId}`);
  if (!review) return <p className="text-slate-400">Review not found.</p>;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            #{review.pullRequest.githubPrNumber} {review.pullRequest.title}
          </h1>
          <StatusBadge status={review.status} />
        </div>
        <p className="text-slate-400 text-sm mt-1">
          {review.pullRequest.repository.fullName} • {review.filesAnalyzed} files • {review.linesChanged} lines changed
          {review.durationMs ? ` • ${(review.durationMs / 1000).toFixed(1)}s` : ""}
        </p>
      </section>

      {review.qualityScore != null && (
        <section className="border border-slate-800 rounded-lg p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold">{review.qualityScore}</span>
            <span className="text-slate-500">/100 code quality</span>
          </div>
          <div className="h-2 mt-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                review.qualityScore >= 80 ? "bg-emerald-500" : review.qualityScore >= 60 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${review.qualityScore}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Transparent heuristic from findings + metrics. See the findings below for substance.
          </p>
        </section>
      )}

      {review.summary && (
        <section className="border border-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-medium text-slate-400 mb-2">Review summary</h2>
          <p className="text-sm">{review.summary}</p>
        </section>
      )}

      <FindingList findings={review.findings} reviewId={review.id} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "COMPLETED"
      ? "border-emerald-500/40 text-emerald-400"
      : status === "FAILED"
        ? "border-red-500/40 text-red-400"
        : "border-yellow-500/40 text-yellow-400";
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>{status}</span>;
}
