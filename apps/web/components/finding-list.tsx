"use client";

import { useEffect, useMemo, useState } from "react";
import type { FindingDto } from "../lib/api";
import { CodeViewer } from "./code-viewer";

export function FindingList({ findings, reviewId }: { findings: FindingDto[]; reviewId: string; onOpen?: (f: FindingDto) => void }) {
  const [selected, setSelected] = useState<FindingDto | null>(findings[0] ?? null);
  const [sending, setSending] = useState(false);
  const [fileFilter, setFileFilter] = useState<string>("");
  const [fileData, setFileData] = useState<{ path: string; startLine: number; lines: string[]; targetLine: number } | null>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const url = `/api/reviews/${reviewId}/file?path=${encodeURIComponent(selected.file)}${selected.line ? `&line=${selected.line}` : ""}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setFileData(d);
      })
      .catch(() => setFileData(null));
    return () => {
      cancelled = true;
    };
  }, [selected, reviewId]);

  const files = useMemo(() => [...new Set(findings.map((f) => f.file))], [findings]);
  const visible = fileFilter ? findings.filter((f) => f.file === fileFilter) : findings;

  if (findings.length === 0) {
    return <p className="text-slate-400 text-sm">No findings. Clean review 🎉</p>;
  }

  async function sendFeedback(findingId: string, type: string) {
    setSending(true);
    await fetch(`/api/findings/${findingId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    setSending(false);
    location.reload();
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <select
          className="mb-3 bg-slate-900 border border-slate-800 text-sm rounded px-2 py-1.5"
          value={fileFilter}
          onChange={(e) => setFileFilter(e.target.value)}
        >
          <option value="">All files ({files.length})</option>
          {files.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
          {visible.map((f) => (
            <li
              key={f.id}
              onClick={() => setSelected(f)}
              className={`border rounded-lg p-3 cursor-pointer transition ${
                selected?.id === f.id ? "border-emerald-500/50 bg-slate-900" : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] px-1.5 py-0.5 rounded border ${severityClass(f.severity)}`}>
                  {f.severity}
                </span>
                <span className="text-xs text-slate-500 truncate">
                  {f.file}{f.line ? `:${f.line}` : ""}
                </span>
              </div>
              <div className="text-sm mt-1.5 font-medium">{f.title}</div>
              <div className="text-xs text-slate-500 mt-1">
                {f.category.toLowerCase()} • {f.source === "AI" ? "AI (validated)" : "static"} •{" "}
                {Math.round(f.confidence * 100)}% confidence
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="border border-slate-800 rounded-lg p-4 self-start sticky top-6">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] px-1.5 py-0.5 rounded border ${severityClass(selected.severity)}`}>
                {selected.severity}
              </span>
              <span className="text-xs text-slate-500">
                {selected.file}{selected.line ? `:${selected.line}` : ""}
              </span>
            </div>
            <h3 className="font-medium">{selected.title}</h3>
            <p className="text-sm text-slate-300">{selected.description}</p>
            {selected.evidence && (
              <pre className="bg-slate-900 border border-slate-800 rounded p-2 text-xs overflow-x-auto">
                {selected.evidence}
              </pre>
            )}
            {selected.recommendation && (
              <p className="text-sm">
                <span className="text-emerald-400 font-medium">How to fix: </span>
                {selected.recommendation}
              </p>
            )}
            {selected.suggestedPatch && (
              <pre className="bg-slate-900 border border-slate-800 rounded p-2 text-xs overflow-x-auto">
                {selected.suggestedPatch}
              </pre>
            )}
            {fileData && (
              <CodeViewer
                file={fileData.path}
                startLine={fileData.startLine}
                code={fileData.lines.join("\n")}
                highlightLine={fileData.targetLine}
              />
            )}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <FeedbackButton disabled={sending} onClick={() => sendFeedback(selected.id, "FALSE_POSITIVE")} label="✕ False positive" />
              <FeedbackButton disabled={sending} onClick={() => sendFeedback(selected.id, "FIXED")} label="✓ Fixed" />
              <FeedbackButton disabled={sending} onClick={() => sendFeedback(selected.id, "WONT_FIX")} label="↩ Won't fix" />
              <FeedbackButton disabled={sending} onClick={() => sendFeedback(selected.id, "NOT_HELPFUL")} label="👎 Not useful" />
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Select a finding.</p>
        )}
      </div>
    </section>
  );
}

function FeedbackButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-2 py-1 rounded border border-slate-700 hover:border-slate-500 hover:text-white disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function severityClass(sev: string): string {
  return (
    {
      CRITICAL: "bg-red-500/15 text-red-400 border-red-500/40",
      HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/40",
      MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
      LOW: "bg-blue-500/15 text-blue-400 border-blue-500/40",
      INFO: "bg-slate-500/15 text-slate-400 border-slate-500/40",
    }[sev] ?? "border-slate-600 text-slate-400"
  );
}
