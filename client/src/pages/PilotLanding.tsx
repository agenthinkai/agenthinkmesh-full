/**
 * PilotLanding — public prospect-facing page at /pilot/:slug
 * Shows the pilot welcome screen, evaluation counter, and CTA to run a council evaluation.
 * No authentication required — accessed via the unique pilot slug.
 */
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    INVITED:   { label: "Invited",   color: "#06b6d4" },
    ACTIVE:    { label: "Active",    color: "#10b981" },
    COMPLETED: { label: "Completed", color: "#f59e0b" },
    CONVERTED: { label: "Converted", color: "#8b5cf6" },
    CHURNED:   { label: "Churned",   color: "#6b7280" },
  };
  const c = config[status] ?? { label: status, color: "#6b7280" };
  return (
    <span
      style={{
        background: `${c.color}20`,
        color: c.color,
        border: `1px solid ${c.color}40`,
        borderRadius: 6,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {c.label}
    </span>
  );
}

export default function PilotLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const { data: pilot, isLoading, error } = trpc.pilotConversion.getBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  if (isLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0a0f1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "#94a3b8", fontSize: 14 }}>Loading pilot access…</div>
      </div>
    );
  }

  if (error || !pilot) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0a0f1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
      }}>
        <div style={{ color: "#ef4444", fontSize: 18, fontWeight: 600 }}>Access Unavailable</div>
        <div style={{ color: "#64748b", fontSize: 14, maxWidth: 360, textAlign: "center" }}>
          {error?.message === "Pilot access revoked"
            ? "This pilot access has been revoked. Please contact your AgenThink representative."
            : error?.message === "Pilot access expired"
            ? "This pilot access period has expired. Please contact your AgenThink representative to extend."
            : "This pilot link is not valid. Please check the URL or contact your AgenThink representative."}
        </div>
        <Button
          variant="outline"
          style={{ marginTop: 8, borderColor: "#334155", color: "#94a3b8" }}
          onClick={() => navigate("/")}
        >
          Return to Home
        </Button>
      </div>
    );
  }

  const utilizationPct = pilot.maxEvaluations > 0
    ? Math.round((pilot.evaluationsUsed / pilot.maxEvaluations) * 100)
    : 0;

  const isExpired = pilot.expiresAt ? pilot.expiresAt < Date.now() : false;
  const isExhausted = pilot.evaluationsRemaining <= 0;
  const canRun = !isExpired && !isExhausted && pilot.status !== "CHURNED";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f1a",
      color: "#e2e8f0",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1e293b",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#fff",
          }}>A</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>AgenThink</span>
          <span style={{ color: "#334155", fontSize: 14 }}>·</span>
          <span style={{ color: "#64748b", fontSize: 13 }}>Institutional Pilot</span>
        </div>
        <StatusBadge status={pilot.status} />
      </div>

      {/* Main content */}
      <div style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "60px 24px 80px",
      }}>
        {/* Welcome */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "#3b82f6",
            textTransform: "uppercase",
            marginBottom: 12,
          }}>
            Institutional Pilot Program
          </div>
          <h1 style={{
            fontSize: 36,
            fontWeight: 800,
            color: "#f1f5f9",
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            Welcome, {pilot.orgName}
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, maxWidth: 580 }}>
            You have exclusive access to AgenThink's Council of 10 — a multi-agent governance
            framework for institutional deal evaluation. Run your evaluations below.
          </p>
        </div>

        {/* Usage card */}
        <div style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 16,
          padding: "28px 32px",
          marginBottom: 32,
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginBottom: 24,
          }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Evaluations Used
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9" }}>
                {pilot.evaluationsUsed}
                <span style={{ fontSize: 16, color: "#475569", fontWeight: 400 }}>
                  /{pilot.maxEvaluations}
                </span>
              </div>
            </div>
            <div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Remaining
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: isExhausted ? "#ef4444" : "#10b981" }}>
                {pilot.evaluationsRemaining}
              </div>
            </div>
            <div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Access Expires
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: isExpired ? "#ef4444" : "#f1f5f9" }}>
                {pilot.expiresAt ? formatDate(pilot.expiresAt) : "Open-ended"}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: "#1e293b", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{
              width: `${utilizationPct}%`,
              height: "100%",
              background: utilizationPct >= 90 ? "#ef4444" : utilizationPct >= 70 ? "#f59e0b" : "#3b82f6",
              borderRadius: 4,
              transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
            {utilizationPct}% utilized
          </div>
        </div>

        {/* Council mode */}
        <div style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 16,
          padding: "24px 32px",
          marginBottom: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Council Mode
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", textTransform: "capitalize" }}>
              {pilot.councilMode.replace(/_/g, " ")}
            </div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
              10 specialist agents · Parallel deliberation · Consensus verdict
            </div>
          </div>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #1e3a5f, #1e1b4b)",
            border: "1px solid #334155",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>
            ⚖️
          </div>
        </div>

        {/* CTA */}
        {canRun ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button
              style={{
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                padding: "14px 32px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(59,130,246,0.3)",
              }}
              onClick={() => navigate(`/council?mode=${pilot.councilMode}&pilot=${pilot.pilotSlug}`)}
            >
              Run Council Evaluation →
            </Button>
            <Button
              variant="outline"
              style={{
                borderColor: "#334155",
                color: "#94a3b8",
                fontWeight: 600,
                fontSize: 14,
                padding: "14px 24px",
                borderRadius: 10,
              }}
              onClick={() => navigate("/demo")}
            >
              View Demo Guide
            </Button>
          </div>
        ) : (
          <div style={{
            background: "#1a0f0f",
            border: "1px solid #7f1d1d",
            borderRadius: 12,
            padding: "20px 24px",
            color: "#fca5a5",
            fontSize: 14,
          }}>
            {isExhausted
              ? "You have used all evaluations in this pilot. Contact your AgenThink representative to extend access."
              : isExpired
              ? "Your pilot access period has expired. Contact your AgenThink representative to renew."
              : "Pilot access is currently unavailable."}
          </div>
        )}

        {/* Footer note */}
        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid #1e293b",
          color: "#475569",
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          This is a private institutional pilot. Results are confidential and for evaluation purposes only.
          For support or to discuss a full deployment, contact{" "}
          <a href="mailto:farouqsultan@gmail.com" style={{ color: "#3b82f6", textDecoration: "none" }}>
            farouqsultan@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
