/**
 * DiasporaLeadsAdmin — admin page at /admin/diaspora-leads
 *
 * Shows all captured diaspora leads with CSV export.
 * Admin-only: redirects to home if not admin.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

// ── CSV export helper ─────────────────────────────────────────────────────────
function leadsToCSV(leads: any[]): string {
  const headers = [
    "id",
    "email",
    "diagnosis_date",
    "idea_health_score",
    "gap1",
    "gap2",
    "gap3",
    "language",
    "bu_source",
    "idea_snippet",
    "created_at",
  ];

  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = leads.map((l) =>
    [
      l.id,
      l.email,
      new Date(l.diagnosisDate).toISOString(),
      l.ideaHealthScore,
      l.gap1 ?? "",
      l.gap2 ?? "",
      l.gap3 ?? "",
      l.language,
      l.buSource,
      l.ideaSnippet ?? "",
      new Date(l.createdAt).toISOString(),
    ]
      .map(escape)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-400/15 text-emerald-300"
      : score >= 45
      ? "bg-amber-400/15 text-amber-300"
      : "bg-red-400/15 text-red-300";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${color}`}>
      {score}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DiasporaLeadsAdmin() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = trpc.diagnosis.getLeads.useQuery(
    { limit: 2000 },
    { enabled: !!user && user.role === "admin" }
  );

  // Auth guard
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080D1A] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#080D1A] flex flex-col items-center justify-center gap-4 text-slate-400">
        <p className="text-sm">Admin access required.</p>
        <Link href="/" className="text-xs text-cyan-400 hover:underline">← Home</Link>
      </div>
    );
  }

  const leads = data?.leads ?? [];

  const filtered = search.trim()
    ? leads.filter(
        (l) =>
          l.email.toLowerCase().includes(search.toLowerCase()) ||
          (l.ideaSnippet ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (l.gap1 ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : leads;

  function handleExport() {
    const csv = leadsToCSV(filtered);
    const ts = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `diaspora-leads-${ts}.csv`);
  }

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#080D1A]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/mesh-core" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Admin
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm font-semibold text-white">Diaspora Leads</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{filtered.length} records</span>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 border border-cyan-400/30 text-cyan-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.47 10.78a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0-1.06-1.06L8.75 8.44V1.75a.75.75 0 0 0-1.5 0v6.69L4.78 5.97a.75.75 0 0 0-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5z" />
            </svg>
            Export CSV
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Diaspora Founder Leads</h1>
          <p className="text-sm text-slate-500">
            Email captures from /zh and /founder diagnostic flows. Source: <code className="text-cyan-400 text-xs">diaspora</code>
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total leads", value: leads.length },
            { label: "ZH leads", value: leads.filter((l) => l.language === "zh").length },
            { label: "EN leads", value: leads.filter((l) => l.language === "en").length },
            {
              label: "Avg score",
              value:
                leads.length > 0
                  ? Math.round(leads.reduce((s, l) => s + l.ideaHealthScore, 0) / leads.length)
                  : "—",
            },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">{s.label}</div>
              <div className="text-2xl font-black text-white font-mono">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, idea snippet, or gap title…"
            className="w-full sm:w-80 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400/50 transition-colors"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-400 py-10 text-center">Failed to load leads.</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-500 py-10 text-center">
            {leads.length === 0 ? "No leads captured yet." : "No results match your search."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/3">
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Score</th>
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Lang</th>
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Gap 1</th>
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Gap 2</th>
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Gap 3</th>
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/3 transition-colors group">
                    <td className="py-3 px-4 text-slate-200 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        {lead.email}
                        <button
                          onClick={() => navigator.clipboard.writeText(lead.email)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-slate-300"
                          title="Copy email"
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <ScoreBadge score={lead.ideaHealthScore} />
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${lead.language === "zh" ? "bg-red-400/15 text-red-300" : "bg-blue-400/15 text-blue-300"}`}>
                        {lead.language}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 max-w-[160px] truncate" title={lead.gap1 ?? ""}>
                      {lead.gap1 ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 max-w-[160px] truncate" title={lead.gap2 ?? ""}>
                      {lead.gap2 ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 max-w-[160px] truncate" title={lead.gap3 ?? ""}>
                      {lead.gap3 ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(lead.diagnosisDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
