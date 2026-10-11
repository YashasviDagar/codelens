"use client";

import { useState } from "react";

const DEFAULT_CONFIG = `{
  "review": { "enabled": true },
  "severity": { "minimum": "low" },
  "categories": {
    "bugs": true,
    "performance": true,
    "security": true,
    "codeQuality": true,
    "maintainability": true,
    "testing": false,
    "documentation": false,
    "style": false
  },
  "ai": { "enabled": true, "maxFindings": 15 },
  "inlineCommentMinimum": "medium"
}`;

export function ConfigEditor({ fullName, initialConfig }: { fullName: string; initialConfig: string | null }) {
  const [text, setText] = useState(initialConfig || DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const body = JSON.parse(text);
      const res = await fetch(`/api/repositories/${encodeURIComponent(fullName)}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setMessage(res.ok ? "Saved." : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-slate-400">Review configuration</h2>
        <button
          onClick={save}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <textarea
        className="w-full h-64 bg-slate-900 border border-slate-800 rounded p-3 text-xs font-mono text-slate-300"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      {message && <p className="text-xs text-slate-400 mt-2">{message}</p>}
      <p className="text-xs text-slate-500 mt-2">
        Stored per repository; the worker reads it before every review.
      </p>
    </div>
  );
}
