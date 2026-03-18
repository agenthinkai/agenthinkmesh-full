/**
 * Upgrade.tsx — Institutional conversion screen
 * Navy/gold design. Shows plan cards + personal usage summary.
 * Triggers Stripe Checkout via billing.createCheckoutSession.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

const PLANS = [
  {
    id: "standard" as const,
    name: "Standard",
    price: "$49",
    period: "/month",
    colour: "#38BDF8",
    border: "rgba(56,189,248,0.35)",
    bg: "rgba(56,189,248,0.06)",
    runs: "200 runs/month",
    features: [
      "All 6 Mesh domains",
      "ETF Launch Studio",
      "Rosie Protocol pipeline",
      "Document Vault (5 GB)",
      "PDF export",
      "Email support",
    ],
    cta: "Start Standard",
    highlight: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$149",
    period: "/month",
    colour: "#F59E0B",
    border: "rgba(245,158,11,0.5)",
    bg: "rgba(245,158,11,0.08)",
    runs: "500 runs/month",
    features: [
      "Everything in Standard",
      "Priority LLM processing",
      "Advanced analytics dashboard",
      "Document Vault (25 GB)",
      "API access (coming soon)",
      "Priority support",
    ],
    cta: "Start Pro",
    highlight: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "Custom",
    period: "",
    colour: "#A78BFA",
    border: "rgba(167,139,250,0.35)",
    bg: "rgba(167,139,250,0.06)",
    runs: "Unlimited runs",
    features: [
      "Everything in Pro",
      "Dedicated infrastructure",
      "Custom agent training",
      "SLA guarantee",
      "On-premise option",
      "Dedicated account manager",
    ],
    cta: "Contact Us",
    highlight: false,
  },
];

export default function Upgrade() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: usage } = trpc.billing.getUpgradeSummary.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: usageStatus } = trpc.billing.getUsageStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => {
      setError(err.message);
      setLoading(null);
    },
  });

  const handleUpgrade = async (planId: "standard" | "pro") => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl("/upgrade");
      return;
    }
    setLoading(planId);
    setError(null);
    checkout.mutate({ plan: planId, origin: window.location.origin });
  };

  const handleEnterprise = () => {
    window.location.href = "mailto:enterprise@agenthink.ai?subject=Enterprise%20Inquiry%20-%20AgenThinkMesh";
  };

  const currentPlan = usageStatus?.planTier ?? "trial";

  return (
    <div style={{ minHeight: "100vh", background: "#080D1A", color: "#F0F4FA", fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/" style={{ color: "#38BDF8", textDecoration: "none", fontSize: 13, opacity: 0.7 }}>← Back</a>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
        <span style={{ color: "#F59E0B", fontWeight: 700, fontSize: 15, letterSpacing: "0.08em" }}>AGENTHINK<span style={{ color: "#38BDF8" }}>MESH</span></span>
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Upgrade Your Plan</span>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ display: "inline-block", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "6px 18px", fontSize: 12, color: "#F59E0B", letterSpacing: "0.1em", marginBottom: 20 }}>
            INSTITUTIONAL ACCESS
          </div>
          <h1 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15 }}>
            Choose your plan
          </h1>
          <p style={{ color: "rgba(240,244,250,0.55)", fontSize: 17, maxWidth: 520, margin: "0 auto" }}>
            Unlock the full AgenThinkMesh platform — designed for GCC institutional teams.
          </p>
        </div>

        {/* Usage summary (only for logged-in trial users) */}
        {isAuthenticated && usage && currentPlan === "trial" && (
          <div style={{
            background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(56,189,248,0.2)",
            borderRadius: 16,
            padding: "24px 32px",
            marginBottom: 48,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 24,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#38BDF8", fontSize: 32, fontWeight: 700 }}>{usage.runsUsed}</div>
              <div style={{ color: "rgba(240,244,250,0.45)", fontSize: 12, marginTop: 4 }}>Runs completed</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#F59E0B", fontSize: 32, fontWeight: 700 }}>{usage.agentsFired}</div>
              <div style={{ color: "rgba(240,244,250,0.45)", fontSize: 12, marginTop: 4 }}>Agents fired</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#A78BFA", fontSize: 32, fontWeight: 700 }}>{usage.workflowsCompleted}</div>
              <div style={{ color: "rgba(240,244,250,0.45)", fontSize: 12, marginTop: 4 }}>Workflows completed</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#34D399", fontSize: 32, fontWeight: 700 }}>{usage.documentsSaved}</div>
              <div style={{ color: "rgba(240,244,250,0.45)", fontSize: 12, marginTop: 4 }}>Documents saved</div>
            </div>
            <div style={{ textAlign: "center", gridColumn: "span 1" }}>
              <div style={{ color: usageStatus?.isExpired ? "#F87171" : "#F59E0B", fontSize: 32, fontWeight: 700 }}>
                {usageStatus?.isExpired ? "Expired" : `${usageStatus?.trialRunsRemaining ?? 0} left`}
              </div>
              <div style={{ color: "rgba(240,244,250,0.45)", fontSize: 12, marginTop: 4 }}>Trial runs remaining</div>
            </div>
          </div>
        )}

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 64 }}>
          {PLANS.map(plan => {
            const isCurrent = currentPlan === plan.id;
            return (
              <div
                key={plan.id}
                style={{
                  background: plan.highlight ? `linear-gradient(135deg, rgba(245,158,11,0.08), rgba(15,23,42,0.95))` : "rgba(15,23,42,0.8)",
                  border: `1px solid ${isCurrent ? plan.colour : plan.border}`,
                  borderRadius: 20,
                  padding: "36px 32px",
                  position: "relative",
                  transition: "transform 0.2s",
                }}
              >
                {plan.highlight && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: "#F59E0B", color: "#080D1A", borderRadius: 20,
                    padding: "4px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                  }}>
                    MOST POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div style={{
                    position: "absolute", top: -12, right: 24,
                    background: plan.colour, color: "#080D1A", borderRadius: 20,
                    padding: "4px 14px", fontSize: 11, fontWeight: 700,
                  }}>
                    CURRENT
                  </div>
                )}

                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: plan.colour, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em" }}>
                    {plan.name.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, color: "#F0F4FA" }}>{plan.price}</span>
                  <span style={{ color: "rgba(240,244,250,0.45)", fontSize: 14 }}>{plan.period}</span>
                </div>
                <div style={{ color: plan.colour, fontSize: 13, marginBottom: 28 }}>{plan.runs}</div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(240,244,250,0.75)", fontSize: 14 }}>
                      <span style={{ color: plan.colour, fontSize: 16 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (plan.id === "enterprise") handleEnterprise();
                    else handleUpgrade(plan.id as "standard" | "pro");
                  }}
                  disabled={isCurrent || loading === plan.id}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    borderRadius: 10,
                    border: "none",
                    background: isCurrent
                      ? "rgba(255,255,255,0.05)"
                      : plan.highlight
                        ? "#F59E0B"
                        : `${plan.colour}22`,
                    color: isCurrent ? "rgba(255,255,255,0.3)" : plan.highlight ? "#080D1A" : plan.colour,
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: isCurrent ? "not-allowed" : "pointer",
                    outline: `1px solid ${isCurrent ? "transparent" : plan.border}`,
                    transition: "all 0.2s",
                  }}
                >
                  {loading === plan.id ? "Redirecting..." : isCurrent ? "Current Plan" : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "14px 20px", color: "#FCA5A5", marginBottom: 32, textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* FAQ / reassurance */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 48, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 32 }}>
          {[
            { q: "Can I cancel anytime?", a: "Yes. Cancel from your account settings. Your access continues until the end of the billing period." },
            { q: "What happens to my trial data?", a: "All your workflows, vault documents, and dossiers are preserved when you upgrade. Nothing is lost." },
            { q: "Is there a setup fee?", a: "No. Pay only the monthly subscription. No onboarding fees, no hidden charges." },
            { q: "Do you offer annual billing?", a: "Annual plans with 20% discount are available on request. Contact enterprise@agenthink.ai." },
          ].map(item => (
            <div key={item.q}>
              <div style={{ color: "#F0F4FA", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{item.q}</div>
              <div style={{ color: "rgba(240,244,250,0.5)", fontSize: 13, lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
