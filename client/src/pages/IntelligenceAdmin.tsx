/**
 * IntelligenceAdmin — Admin-only view of all analyses with CSV export
 */
import { useState } from "react";
import SiteNav from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const NAVY_950 = "#080D1A";
const NAVY_800 = "#0F1E38";
const NAVY_700 = "#162847";
const SILVER_50 = "#F0F4FA";
const SILVER_300 = "#94A3B8";
const SILVER_400 = "#64748B";
const BLUE = "#7BA3D4";
const RED = "#F87171";
const GOLD = "#F59E0B";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', sans-serif";

function TagBadge({ label, color = BLUE }: { label: string; color?: string }) {
  return (
    <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, letterSpacing: "0.08em", color, background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 4, padding: "2px 8px", display: "inline-block" }}>
      {label}
    </span>
  );
}

function exportToCSV(data: Array<Record<string, unknown>>, filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h];
    const str = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  }).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function IntelligenceAdmin() {
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");

  const { data: analyses = [], isLoading } = trpc.intelligence.adminListAnalyses.useQuery(
    { limit: 200, offset: 0 },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
        <SiteNav />
        <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: SILVER_50, marginBottom: 8 }}>Admin Access Required</div>
          <div style={{ fontSize: 14, color: SILVER_300 }}>This page is restricted to admin users only.</div>
        </div>
      </div>
    );
  }

  const filtered = analyses.filter(a =>
    a.institution.toLowerCase().includes(search.toLowerCase()) ||
    (a.domain ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    const rows = filtered.map(a => {
      let result: Record<string, unknown> = {};
      try { result = JSON.parse(a.result ?? "{}"); } catch { /* ignore */ }
      return {
        id: a.id,
        userId: a.userId,
        institution: a.institution,
        domain: a.domain ?? "",
        aum: a.aum ?? "",
        isInternal: a.isInternal ? "Yes" : "No",
        executive_summary: (result.executive_summary as string) ?? "",
        build_buy_stance: (result.build_buy_stance as Record<string, string> | undefined)?.stance ?? "",
        use_case_count: ((result.use_cases as unknown[]) ?? []).length,
        tech_stack_count: ((result.tech_stack as unknown[]) ?? []).length,
        createdAt: new Date(a.createdAt).toISOString(),
      };
    });
    exportToCSV(rows, `agenthinkmesh-intel-admin-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${rows.length} analyses to CSV`);
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
      <SiteNav />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: RED, textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: MONO, fontWeight: 600, marginBottom: 8 }}>Admin · Intelligence Agent</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: SILVER_50, margin: "0 0 8px" }}>All Analyses</h1>
            <p style={{ fontSize: 14, color: SILVER_300, margin: 0 }}>
              {analyses.length} total analyses across all users
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            style={{
              padding: "10px 22px", background: `rgba(123,163,212,0.1)`, border: `1px solid rgba(123,163,212,0.25)`,
              borderRadius: 8, color: BLUE, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
            }}
          >
            ↓ Export CSV ({filtered.length})
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 24 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by institution or domain…"
            style={{
              width: "100%", background: NAVY_800, border: `1px solid rgba(123,163,212,0.2)`,
              borderRadius: 8, padding: "10px 16px", color: SILVER_50, fontSize: 14,
              fontFamily: FONT, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total Analyses", value: analyses.length },
            { label: "Institutions", value: new Set(analyses.map(a => a.institution)).size },
            { label: "Internal Docs", value: analyses.filter(a => a.isInternal).length },
            { label: "This Week", value: analyses.filter(a => new Date(a.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length },
          ].map(stat => (
            <div key={stat.label} style={{ background: NAVY_800, border: `1px solid rgba(123,163,212,0.15)`, borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: SILVER_50, fontFamily: MONO }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 60, color: SILVER_400, fontFamily: MONO, fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ background: NAVY_800, border: `1px solid rgba(123,163,212,0.15)`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid rgba(123,163,212,0.15)` }}>
                    {["ID", "User ID", "Institution", "Domain", "AUM", "Type", "Use Cases", "Build/Buy", "Date"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, idx) => {
                    let result: Record<string, unknown> = {};
                    try { result = JSON.parse(a.result ?? "{}"); } catch { /* ignore */ }
                    const useCases = (result.use_cases as unknown[] | undefined) ?? [];
                    const stance = (result.build_buy_stance as Record<string, string> | undefined)?.stance ?? "—";
                    return (
                      <tr key={a.id} style={{ borderBottom: `1px solid rgba(123,163,212,0.08)`, background: idx % 2 === 0 ? "transparent" : `rgba(123,163,212,0.03)` }}>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: SILVER_400, fontFamily: MONO }}>{a.id}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: SILVER_400, fontFamily: MONO }}>{a.userId}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: SILVER_50, whiteSpace: "nowrap" }}>{a.institution}</td>
                        <td style={{ padding: "12px 16px" }}>{a.domain && <TagBadge label={a.domain} color={BLUE} />}</td>
                        <td style={{ padding: "12px 16px" }}>{a.aum && <TagBadge label={a.aum} color={GOLD} />}</td>
                        <td style={{ padding: "12px 16px" }}>{a.isInternal ? <TagBadge label="INTERNAL" color={GOLD} /> : <TagBadge label="PUBLIC" color={SILVER_400} />}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: SILVER_300, fontFamily: MONO }}>{useCases.length}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <TagBadge label={stance} color={stance === "Build" ? "#4ADE80" : stance === "Buy" ? "#38BDF8" : stance === "Hybrid" ? GOLD : SILVER_400} />
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: SILVER_400, fontFamily: MONO, whiteSpace: "nowrap" }}>
                          {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
