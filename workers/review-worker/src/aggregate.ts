import type { Finding, ReviewConfig } from "@codelens/types";

const SEVERITY_RANK: Record<string, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export interface AggregatedReview {
  findings: Finding[];
  severityCounts: Record<string, number>;
  qualityScore: number;
  summary: string;
}

/**
 * Merges deterministic + AI findings:
 *  - dedupes by (file, line, category)
 *  - drops findings below minimum severity
 *  - caps total findings (comment fatigue control)
 *  - computes transparent quality score from weighted penalties
 */
export function aggregateFindings(
  all: Finding[],
  config: ReviewConfig,
  metricsScore: number | null
): AggregatedReview {
  const minRank = SEVERITY_RANK[config.severity.minimum] ?? 1;
  const byKey = new Map<string, Finding>();

  for (const f of all) {
    if (SEVERITY_RANK[f.severity] < minRank) continue;
    const key = `${f.file}:${f.line ?? 0}:${f.category}:${f.ruleId ?? f.source}`;
    const existing = byKey.get(key);
    // keep the higher-confidence/severity representative
    if (!existing || rank(f) > rank(existing)) byKey.set(key, f);
  }

  let findings = [...byKey.values()].sort((a, b) => rank(b) - rank(a));

  // Only comments-worthy findings go to GitHub; dashboard keeps all
  findings = findings.slice(0, 30);

  const severityCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) severityCounts[f.severity]++;

  const penalty =
    severityCounts.CRITICAL * 25 + severityCounts.HIGH * 10 + severityCounts.MEDIUM * 4 + severityCounts.LOW * 1;
  const findingsScore = Math.max(0, 100 - penalty);
  // Blend metric-based score with finding-based score when both exist
  const qualityScore = metricsScore == null ? findingsScore : Math.round(0.4 * metricsScore + 0.6 * findingsScore);

  const summary = buildSummary(findings);
  return { findings, severityCounts, qualityScore, summary };
}

function rank(f: Finding): number {
  return SEVERITY_RANK[f.severity] * 2 + (f.source === "AI" ? 0 : 1);
}

function buildSummary(findings: Finding[]): string {
  if (findings.length === 0) return "No significant findings.";
  const byCategory = new Map<string, number>();
  for (const f of findings) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
  const areas = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c.toLowerCase());
  return `Main areas: ${areas.join(", ")}`;
}

