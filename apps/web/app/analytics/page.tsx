import { apiFetch } from "../../lib/api";
import { FindingsOverTime, SeverityPie, CategoryBars, RepoCompare, QualityTrend } from "../../components/charts";

export const dynamic = "force-dynamic";

interface AnalyticsData {
  total: number;
  findingsByDay: Array<{ date: string; count: number }>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byRepo: Record<string, number>;
  qualityTrend: Array<{ date: string; score: number }>;
  avgReviewMs: number;
  falsePositiveRate: number;
  recurringCategories: Array<[string, number]>;
}

export default async function AnalyticsPage() {
  const data = await apiFetch<AnalyticsData>("/api/analytics");
  if (!data) return <p className="text-slate-400">Connect GitHub to see analytics.</p>;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">
          {data.total} findings • avg review {(data.avgReviewMs / 1000).toFixed(1)}s •{" "}
          {Math.round(data.falsePositiveRate * 100)}% marked false-positive
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Findings over time (7 days)">
          <FindingsOverTime data={data.findingsByDay} />
        </Panel>
        <Panel title="Severity distribution">
          <SeverityPie bySeverity={data.bySeverity} />
        </Panel>
        <Panel title="Findings by category">
          <CategoryBars byCategory={data.byCategory} />
        </Panel>
        <Panel title="Repository comparison">
          <RepoCompare byRepo={data.byRepo} />
        </Panel>
        <Panel title="Code quality trend">
          <QualityTrend data={data.qualityTrend} />
        </Panel>
        <Panel title="Recurring issue types">
          <ul className="space-y-2 text-sm">
            {data.recurringCategories.length === 0 ? (
              <li className="text-slate-500">No data yet.</li>
            ) : (
              data.recurringCategories.map(([cat, n]) => (
                <li key={cat} className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="capitalize">{cat.toLowerCase().replace("_", " ")}</span>
                  <span className="text-slate-400">{n}</span>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-800 rounded-lg p-4">
      <h2 className="text-sm font-medium text-slate-400 mb-3">{title}</h2>
      {children}
    </div>
  );
}
