/**
 * IntelligenceTracking — Track institutions and view diffs over time
 */
import { useState } from "react";
import SiteNav from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const NAVY_950 = "#080D1A";
const NAVY_800 = "#0F1E38";
const NAVY_700 = "#162847";
const SILVER_50 = "#F0F4FA";
const SILVER_100 = "#E2E8F0";
const SILVER_300 = "#94A3B8";
const SILVER_400 = "#64748B";
const BLUE = "#7BA3D4";
const CYAN = "#38BDF8";
const GREEN = "#4ADE80";
const RED = "#F87171";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', sans-serif";

function TagBadge({ label, color = BLUE }: { label: string; color?: string }) {
  return (
    <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, letterSpacing: "0.08em", color, background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 4, padding: "2px 8px" }}>
      {label}
    </span>
  );
}

export default function IntelligenceTracking() {
  const { isAuthenticated } = useAuth();
  const loginUrl = getLoginUrl("/intelligence/tracking");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: tracked = [], refetch } = trpc.intelligence.listTracked.useQuery(undefined, { enabled: isAuthenticated });

  const untrackMutation = trpc.intelligence.untrack.useMutation({
    onSuccess: () => { toast.success("Untracked"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const refreshMutation = trpc.intelligence.refreshTracked.useMutation({
    onSuccess: (data) => {
      const diffKeys = Object.keys(data.diff ?? {});
      if (diffKeys.length) toast.success(`Updated — ${diffKeys.length} change(s) detected`);
      else toast.info("No changes detected since last analysis");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: history = [] } = trpc.intelligence.getTrackingHistory.useQuery(
    { trackedId: expandedId! },
    { enabled: expandedId !== null }
  );

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
        <SiteNav />
        <div style={{ maxWidth: 800, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: SILVER_300, marginBottom: 20 }}>Sign in to view your tracked institutions</div>
          <a href={loginUrl} style={{ padding: "10px 28px", background: `linear-gradient(135deg, ${BLUE} 0%, #4A90D4 100%)`, color: NAVY_950, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
      <SiteNav />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: BLUE, textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: MONO, fontWeight: 600, marginBottom: 8 }}>Intelligence Agent</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: SILVER_50, margin: "0 0 8px" }}>Track Institutions</h1>
            <p style={{ fontSize: 14, color: SILVER_300, margin: 0 }}>Monitor AI programme developments across tracked institutions with automated news ingestion and diff detection.</p>
          </div>
          <a href="/intelligence" style={{ padding: "8px 18px", background: `rgba(123,163,212,0.1)`, border: `1px solid rgba(123,163,212,0.25)`, borderRadius: 8, color: BLUE, fontSize: 12, fontWeight: 700, textDecoration: "none", fontFamily: MONO }}>
            + New Analysis
          </a>
        </div>

        {tracked.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", background: NAVY_800, borderRadius: 12, border: `1px solid rgba(123,163,212,0.12)` }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: SILVER_50, marginBottom: 8 }}>No tracked institutions yet</div>
            <div style={{ fontSize: 14, color: SILVER_300, marginBottom: 24 }}>Run an analysis and click "Track Institution" to start monitoring</div>
            <a href="/intelligence" style={{ padding: "10px 24px", background: `linear-gradient(135deg, ${BLUE} 0%, #4A90D4 100%)`, color: NAVY_950, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              Run First Analysis →
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {tracked.map((t) => {
              let lastResult: Record<string, unknown> = {};
              try { lastResult = JSON.parse(t.lastAnalysis ?? "{}"); } catch { /* ignore */ }
              const isExpanded = expandedId === t.id;
              return (
                <div key={t.id} style={{ background: NAVY_800, border: `1px solid rgba(123,163,212,0.18)`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: SILVER_50 }}>{t.institution}</span>
                        {t.domain && <TagBadge label={t.domain} color={BLUE} />}
                        {t.aum && <TagBadge label={t.aum} color="#F59E0B" />}
                      </div>
                      {(lastResult.executive_summary as string) && (
                        <p style={{ fontSize: 13, color: SILVER_300, margin: 0, lineHeight: 1.6, maxWidth: 600 }}>
                          {(lastResult.executive_summary as string).slice(0, 180)}…
                        </p>
                      )}
                      <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, marginTop: 8 }}>
                        Last updated: {new Date(t.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                      <button
                        onClick={() => refreshMutation.mutate({ id: t.id })}
                        disabled={refreshMutation.isPending}
                        style={{
                          padding: "7px 14px", background: `rgba(56,189,248,0.1)`, border: `1px solid rgba(56,189,248,0.25)`,
                          borderRadius: 7, color: CYAN, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: MONO,
                        }}
                      >
                        {refreshMutation.isPending ? "…" : "↻ Refresh"}
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                        style={{
                          padding: "7px 14px", background: `rgba(123,163,212,0.1)`, border: `1px solid rgba(123,163,212,0.25)`,
                          borderRadius: 7, color: BLUE, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: MONO,
                        }}
                      >
                        {isExpanded ? "▲ Hide" : "▼ History"}
                      </button>
                      <button
                        onClick={() => untrackMutation.mutate({ id: t.id })}
                        style={{
                          padding: "7px 14px", background: "transparent", border: `1px solid rgba(248,113,113,0.25)`,
                          borderRadius: 7, color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: MONO,
                        }}
                      >
                        Untrack
                      </button>
                    </div>
                  </div>

                  {/* Expanded history */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid rgba(123,163,212,0.12)`, padding: "20px 24px" }}>
                      <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Analysis History</div>
                      {history.length === 0 ? (
                        <div style={{ fontSize: 13, color: SILVER_400 }}>No history yet. Click "Refresh" to fetch the latest news and run a new analysis.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {history.map((h) => {
                            let diff: Record<string, unknown> = {};
                            try { diff = JSON.parse(h.diff ?? "{}"); } catch { /* ignore */ }
                            const diffKeys = Object.keys(diff);
                            return (
                              <div key={h.id} style={{ padding: "14px 16px", background: NAVY_700, borderRadius: 8, border: `1px solid rgba(123,163,212,0.1)` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: diffKeys.length ? 10 : 0, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12, color: SILVER_300, fontFamily: MONO }}>{new Date(h.createdAt).toLocaleString()}</span>
                                  {diffKeys.length === 0 && <TagBadge label="No changes" color={SILVER_400} />}
                                  {diffKeys.includes("use_cases") && <TagBadge label="Use Cases changed" color={GREEN} />}
                                  {diffKeys.includes("tech_stack") && <TagBadge label="Tech Stack changed" color={CYAN} />}
                                  {diffKeys.includes("build_buy_stance") && <TagBadge label="Build/Buy changed" color="#F59E0B" />}
                                </div>
                                {diffKeys.length > 0 && (
                                  <div style={{ fontSize: 12, color: SILVER_400, fontFamily: MONO }}>
                                    {diffKeys.map(k => {
                                      const d = diff[k] as Record<string, unknown>;
                                      if (k === "build_buy_stance") return <div key={k}>Build/Buy: {String(d.from)} → {String(d.to)}</div>;
                                      const added = (d.added as unknown[])?.length ?? 0;
                                      const removed = (d.removed as unknown[])?.length ?? 0;
                                      return <div key={k}>{k}: +{added} added, -{removed} removed</div>;
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
