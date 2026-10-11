const API_URL = process.env.API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/40",
  HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  LOW: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  INFO: "bg-slate-500/15 text-slate-400 border-slate-500/40",
};

export const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-blue-500",
  INFO: "bg-slate-500",
};

export interface ReviewDto {
  id: string;
  status: string;
  filesAnalyzed: number;
  linesChanged: number;
  summary: string | null;
  severityCounts: Record<string, number> | null;
  qualityScore: number | null;
  durationMs: number | null;
  completedAt: string | null;
  pullRequest: {
    githubPrNumber: number;
    title: string;
    repository: { fullName: string };
  };
  findings: FindingDto[];
}

export interface FindingDto {
  id: string;
  file: string;
  line: number | null;
  endLine: number | null;
  category: string;
  severity: string;
  title: string;
  description: string;
  evidence: string | null;
  recommendation: string | null;
  suggestedPatch: string | null;
  confidence: number;
  source: string;
  ruleId: string | null;
  status: string;
}
