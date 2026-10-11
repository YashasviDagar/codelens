"use client";

/**
 * Syntax-highlighted viewer (regex-based; swap for Monaco when heavier
 * interaction like editing/suggested-patch previews is needed).
 */
export function CodeViewer({
  file,
  startLine = 1,
  code,
  highlightLine,
}: {
  file: string;
  startLine?: number;
  code: string;
  highlightLine?: number;
}) {
  const lines = code.split("\n");
  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <div className="bg-slate-900 px-3 py-1.5 text-xs text-slate-400 border-b border-slate-800">{file}</div>
      <pre className="text-xs leading-5 overflow-x-auto p-0">
        {lines.map((line, i) => {
          const n = startLine + i;
          const isHot = highlightLine === n;
          return (
            <div key={i} className={`flex ${isHot ? "bg-yellow-500/10" : ""}`}>
              <span className="select-none w-12 shrink-0 text-right pr-3 text-slate-600">{n}</span>
              <code className={`whitespace-pre ${isHot ? "text-yellow-200" : "text-slate-300"}`}>{line}</code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
