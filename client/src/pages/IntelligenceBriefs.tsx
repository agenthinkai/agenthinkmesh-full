/**
 * IntelligenceBriefs — Weekly intelligence brief generation and history
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
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', sans-serif";

interface BriefContent {
  headline?: string;
  trend_analysis?: string;
  institution_summaries?: Array<{ institution: string; headline: string; key_signal: string }>;
  recommended_actions?: string[];
}

function BriefCard({ brief }: { brief: { id: number; content: string; weekOf: Date; createdAt: Date } }) {
  const [expanded, setExpanded] = useState(false);
  let content: BriefContent = {};
  try { content = JSON.parse(brief.content); } catch { /* ignore */ }

  return (
    <div style={{ background: NAVY_800, border: `1px solid rgba(123,163,212,0.18)`, borderRadius: 12, overflow: "hidden" }}>
      <div
        style={{ padding: "20px 24px", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Week of {new Date(brief.weekOf).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: SILVER_50, marginBottom: 6 }}>
            {content.headline ?? "Weekly Intelligence Brief"}
          </div>
          {content.institution_summaries && (
            <div style={{ fontSize: 12, color: SILVER_400, fontFamily: MONO }}>
              {content.institution_summaries.length} institution{content.institution_summaries.length !== 1 ? "s" : ""} covered
            </div>
          )}
        </div>
        <span style={{ fontSize: 16, color: SILVER_400, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid rgba(123,163,212,0.12)`, padding: "20px 24px" }}>
          {/* Trend analysis */}
          {content.trend_analysis && (
            <div style={{ background: `rgba(123,163,212,0.08)`, border: `1px solid rgba(123,163,212,0.18)`, borderRadius: 8, padding: "16px 18px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Trend Analysis</div>
              <p style={{ fontSize: 14, color: SILVER_100, lineHeight: 1.75, margin: 0 }}>{content.trend_analysis}</p>
            </div>
          )}

          {/* Institution summaries */}
          {content.institution_summaries && content.institution_summaries.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Institution Updates</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {content.institution_summaries.map((s, i) => (
                  <div key={i} style={{ borderLeft: `3px solid ${CYAN}`, paddingLeft: 16, paddingTop: 4, paddingBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: SILVER_50, marginBottom: 4 }}>{s.institution}</div>
                    <div style={{ fontSize: 13, color: SILVER_300, marginBottom: 4 }}>{s.headline}</div>
                    <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO }}>Signal: {s.key_signal}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended actions */}
          {content.recommended_actions && content.recommended_actions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Recommended Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {content.recommended_actions.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: `rgba(123,163,212,0.15)`, border: `1px solid ${BLUE}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: BLUE, fontFamily: MONO, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.6 }}>{a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IntelligenceBriefs() {
  const { isAuthenticated } = useAuth();
  const loginUrl = getLoginUrl("/intelligence/briefs");

  const { data: briefs = [], refetch } = trpc.intelligence.listBriefs.useQuery(undefined, { enabled: isAuthenticated });
  const { data: tracked = [] } = trpc.intelligence.listTracked.useQuery(undefined, { enabled: isAuthenticated });

  const generateMutation = trpc.intelligence.generateBrief.useMutation({
    onSuccess: () => { toast.success("Weekly brief generated — check your email too!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
        <SiteNav />
        <div style={{ maxWidth: 800, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: SILVER_300, marginBottom: 20 }}>Sign in to view your weekly briefs</div>
          <a href={loginUrl} style={{ padding: "10px 28px", background: `linear-gradient(135deg, ${BLUE} 0%, #4A90D4 100%)`, color: NAVY_950, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
      <SiteNav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: BLUE, textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: MONO, fontWeight: 600, marginBottom: 8 }}>Intelligence Agent</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: SILVER_50, margin: "0 0 8px" }}>Weekly Intelligence Briefs</h1>
            <p style={{ fontSize: 14, color: SILVER_300, margin: 0 }}>
              Aggregated AI programme intelligence across all {tracked.length} tracked institution{tracked.length !== 1 ? "s" : ""} — delivered to your inbox.
            </p>
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || tracked.length === 0}
            style={{
              padding: "10px 22px",
              background: tracked.length === 0 ? NAVY_700 : `linear-gradient(135deg, ${BLUE} 0%, #4A90D4 100%)`,
              border: "none", borderRadius: 8,
              color: tracked.length === 0 ? SILVER_400 : NAVY_950,
              fontSize: 13, fontWeight: 700, cursor: tracked.length === 0 ? "not-allowed" : "pointer",
              fontFamily: FONT, flexShrink: 0,
            }}
          >
            {generateMutation.isPending ? "Generating…" : "⚡ Generate Brief"}
          </button>
        </div>

        {tracked.length === 0 && (
          <div style={{ background: `rgba(123,163,212,0.08)`, border: `1px solid rgba(123,163,212,0.2)`, borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: SILVER_300 }}>
              You need to track at least one institution before generating a brief.{" "}
              <a href="/intelligence/tracking" style={{ color: BLUE, textDecoration: "none", fontWeight: 600 }}>Go to Tracking →</a>
            </div>
          </div>
        )}

        {briefs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", background: NAVY_800, borderRadius: 12, border: `1px solid rgba(123,163,212,0.12)` }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📰</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: SILVER_50, marginBottom: 8 }}>No briefs yet</div>
            <div style={{ fontSize: 14, color: SILVER_300 }}>Track some institutions and click "Generate Brief" to create your first weekly brief</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {briefs.map((b) => <BriefCard key={b.id} brief={b} />)}
          </div>
        )}
      </div>
    </div>
  );
}
