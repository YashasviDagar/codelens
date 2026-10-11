import Link from "next/link";
import { apiFetch, SEVERITY_DOT } from "../../../lib/api";
import { ConfigEditor } from "../../../components/config-editor";

export const dynamic = "force-dynamic";

export default async function RepositoryPage({ params }: { params: { fullName: string } }) {
  const data = await apiFetch<any>(`/api/repositories/${params.fullName}/dashboard`);
  if (!data) {
    return <p className="text-slate-400">Repository not found or not connected.</p>;
  }
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">{params.fullName}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {data.defaultBranch ?? "main"} branch • {data.pullRequests?.length ?? 0} pull requests tracked
        </p>
      </section>

      <ConfigEditor fullName={params.fullName} initialConfig={data.config ? JSON.stringify(data.config, null, 2) : null} />


      <section>
        <h2 className="text-lg font-medium mb-3">Pull Requests</h2>
        <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg">
          {(data.pullRequests ?? []).map((pr: any) => {
            const latest = pr.reviews?.[pr.reviews.length - 1];
            const counts = latest?.severityCounts ?? {};
            return (
              <li key={pr.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    #{pr.githubPrNumber} {pr.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {pr.authorLogin} • latest review: {latest?.status ?? "none"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) =>
                    counts[s] ? (
                      <span key={s} className="flex items-center gap-1 text-xs">
                        <span className={`inline-block w-2 h-2 rounded-full ${SEVERITY_DOT[s]}`} />
                        {counts[s]}
                      </span>
                    ) : null
                  )}
                  {latest && (
                    <Link href={`/review/${latest.id}`} className="text-xs text-emerald-400 hover:underline ml-3">
                      review →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
