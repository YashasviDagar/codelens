import Link from "next/link";
import { apiFetch } from "../lib/api";

interface DashboardData {
  repositories: Array<{
    id: string;
    fullName: string;
    language: string | null;
    webhookEnabled: boolean;
    pullRequestCount: number;
    openFindingCount: number;
    highSeverityCount: number;
  }>;
  totals: { reviews: number; findings: number; falsePositiveRate: number; avgDurationMs: number };
}

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const data = await apiFetch<DashboardData>("/api/dashboard");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-slate-400 text-sm mt-1">
          Measurable engineering metrics across connected repositories.
        </p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Repositories" value={data ? data.repositories.length.toString() : "—"} />
        <Stat label="PRs analyzed" value={data ? data.totals.reviews.toString() : "—"} />
        <Stat label="Open findings" value={data ? data.totals.findings.toString() : "—"} />
        <Stat
          label="Avg review time"
          value={data && data.totals.avgDurationMs ? `${(data.totals.avgDurationMs / 1000).toFixed(1)}s` : "—"}
        />
        <Stat
          label="False-positive rate"
          value={data ? `${Math.round(data.totals.falsePositiveRate * 100)}%` : "—"}
        />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Repositories</h2>
        {!data || data.repositories.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No repositories connected yet.{" "}
            <a href="/api/auth/github" className="text-emerald-400 hover:underline">
              Connect GitHub
            </a>{" "}
            to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg">
            {data.repositories.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link href={`/repo/${r.fullName}`} className="font-medium hover:text-emerald-400">
                    {r.fullName}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">{r.language ?? "unknown"}</span>
                </div>
                <div className="flex items-center gap-6 text-sm text-slate-400">
                  <span>{r.pullRequestCount} PRs</span>
                  <span>{r.openFindingCount} findings</span>
                  {r.highSeverityCount > 0 && (
                    <span className="text-orange-400">{r.highSeverityCount} high</span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      r.webhookEnabled
                        ? "border-emerald-500/40 text-emerald-400"
                        : "border-slate-600 text-slate-500"
                    }`}
                  >
                    {r.webhookEnabled ? "active" : "inactive"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-800 rounded-lg p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
