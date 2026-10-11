"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
  INFO: "#94a3b8",
};

export function FindingsOverTime({ data }: { data: Array<{ date: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
        <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
        <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SeverityPie({ bySeverity }: { bySeverity: Record<string, number> }) {
  const data = Object.entries(bySeverity).map(([name, value]) => ({ name, value }));
  if (data.length === 0) return <p className="text-sm text-slate-500">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
          {data.map((d) => (
            <Cell key={d.name} fill={SEVERITY_COLORS[d.name] ?? "#64748b"} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({ byCategory }: { byCategory: Record<string, number> }) {
  const data = Object.entries(byCategory).map(([name, value]) => ({ name: name.toLowerCase(), value }));
  if (data.length === 0) return <p className="text-sm text-slate-500">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid stroke="#1e293b" />
        <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={110} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
        <Bar dataKey="value" fill="#34d399" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RepoCompare({ byRepo }: { byRepo: Record<string, number> }) {
  const data = Object.entries(byRepo).map(([name, value]) => ({ name, value }));
  if (data.length === 0) return <p className="text-sm text-slate-500">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="name" stroke="#64748b" fontSize={11} hide={data.length > 3} />
        <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
        <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function QualityTrend({ data }: { data: Array<{ date: string; score: number }> }) {
  if (data.length === 0) return <p className="text-sm text-slate-500">No reviews yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
        <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
        <Line type="monotone" dataKey="score" stroke="#facc15" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
