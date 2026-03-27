/**
 * Pricing — /pricing
 * 3-tier pricing page: Starter / Professional / Enterprise
 * Matches the AgenThinkMesh dark design system (navy + green accent).
 */

import SiteNav from "@/components/SiteNav";
import { getLoginUrl } from "@/const";

const NAVY = "#080D1A";
const CARD = "#0D1E35";
const BORDER = "rgba(52,211,153,0.15)";
const GREEN = "#34D399";
const GOLD = "#F59E0B";
const TEAL = "#38BDF8";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";

const TIERS = [
  {
    name: "Starter",
    price: "$499",
    period: "/month",
    tagline: "For teams exploring AI-driven analysis",
    highlight: false,
    accentColor: TEAL,
    features: [
      "5 specialist agents",
      "50 agent runs / month",
      "Deal Screener module",
      "ForecastMesh (3 active forecasts)",
      "Knowledge Vault (read-only)",
      "Standard email support",
      "Single workspace",
    ],
    cta: "Start Free Trial",
    ctaHref: getLoginUrl("/forecast"),
    ctaStyle: "outline",
  },
  {
    name: "Professional",
    price: "$1,999",
    period: "/month",
    tagline: "For institutional teams running live workflows",
    highlight: true,
    accentColor: GREEN,
    badge: "Most Popular",
    features: [
      "25 specialist agents",
      "500 agent runs / month",
      "All modules: Deal Screener, MVNO Intel, ForecastMesh, Insurance, Legal, Wealth, Social AI",
      "Knowledge Vault with RAG context injection",
      "Consensus engine + trigger system",
      "Priority Slack support",
      "Up to 5 team members",
      "API access (beta)",
    ],
    cta: "Start Free Trial",
    ctaHref: getLoginUrl("/forecast"),
    ctaStyle: "filled",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "For large institutions with bespoke requirements",
    highlight: false,
    accentColor: GOLD,
    features: [
      "Unlimited agents",
      "Unlimited agent runs",
      "All Professional features",
      "Custom RAG training on your institutional data",
      "Dedicated onboarding & success manager",
      "SLA-backed uptime (99.9%)",
      "SSO / SAML integration",
      "On-premise deployment option",
      "Custom agent development",
    ],
    cta: "Book a Demo",
    ctaHref: "/contact",
    ctaStyle: "gold",
  },
];

const FAQ = [
  {
    q: "What counts as an agent run?",
    a: "Each time an agent analyses a task, screens a deal, or runs a forecast cycle counts as one run. Viewing existing results does not consume a run.",
  },
  {
    q: "Can I upgrade or downgrade at any time?",
    a: "Yes. Plan changes take effect at the start of your next billing cycle. Unused runs do not roll over.",
  },
  {
    q: "What is the Knowledge Vault RAG?",
    a: "The Knowledge Vault contains 460 GCC institutional scenarios across 8 domains. When RAG is enabled, agents automatically retrieve the most relevant scenarios before generating outputs — making every analysis more grounded in real GCC market context.",
  },
  {
    q: "Is my data used to train the models?",
    a: "No. Your data is never used to train shared models. Enterprise customers can optionally provide institutional data to train a private, dedicated model for their workspace.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes. Starter and Professional plans include a 14-day free trial with no credit card required.",
  },
];

export default function Pricing() {
  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
      <SiteNav />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 100px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{
            display: "inline-block", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: GREEN, background: "rgba(52,211,153,0.1)",
            border: "1px solid rgba(52,211,153,0.25)",
            padding: "4px 14px", borderRadius: 20, marginBottom: 16,
          }}>
            Transparent Pricing
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, color: WHITE, margin: "0 0 14px", lineHeight: 1.15 }}>
            Institutional AI for the GCC
          </h1>
          <p style={{ fontSize: 16, color: MUTED, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            From first pilot to full enterprise deployment. Every plan includes the AgenThinkMesh platform, ForecastMesh, and the GCC Knowledge Vault.
          </p>
        </div>

        {/* Pricing cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          alignItems: "start",
          marginBottom: 80,
        }}>
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              style={{
                background: tier.highlight ? "rgba(13,30,53,0.95)" : CARD,
                border: tier.highlight
                  ? `2px solid ${GREEN}`
                  : `1px solid ${BORDER}`,
                borderRadius: 16,
                padding: "28px 24px",
                position: "relative",
                boxShadow: tier.highlight
                  ? "0 0 40px rgba(52,211,153,0.12)"
                  : "none",
              }}
            >
              {/* Badge */}
              {tier.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: GREEN, color: "#080D1A", fontSize: 10, fontWeight: 800,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "3px 12px", borderRadius: 20,
                }}>
                  {tier.badge}
                </div>
              )}

              {/* Tier name */}
              <div style={{ fontSize: 11, fontWeight: 700, color: tier.accentColor, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                {tier.name}
              </div>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: WHITE }}>{tier.price}</span>
                {tier.period && <span style={{ fontSize: 14, color: MUTED }}>{tier.period}</span>}
              </div>

              <p style={{ fontSize: 13, color: MUTED, marginBottom: 24, lineHeight: 1.5 }}>{tier.tagline}</p>

              {/* CTA */}
              <a
                href={tier.ctaHref}
                style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  padding: "11px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                  marginBottom: 24,
                  ...(tier.ctaStyle === "filled"
                    ? { background: GREEN, color: "#080D1A", border: "none" }
                    : tier.ctaStyle === "gold"
                    ? { background: "rgba(245,158,11,0.15)", color: GOLD, border: `1px solid rgba(245,158,11,0.35)` }
                    : { background: "rgba(56,189,248,0.1)", color: TEAL, border: `1px solid rgba(56,189,248,0.3)` }),
                }}
              >
                {tier.cta}
              </a>

              {/* Divider */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }} />

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tier.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ color: tier.accentColor, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: WHITE, textAlign: "center", marginBottom: 32 }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {FAQ.map((item, i) => (
              <div
                key={i}
                style={{
                  background: CARD, border: `1px solid ${BORDER}`,
                  borderRadius: 12, padding: "18px 20px",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: WHITE, marginBottom: 8 }}>
                  {item.q}
                </div>
                <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{
          textAlign: "center", marginTop: 72,
          background: "rgba(52,211,153,0.05)",
          border: `1px solid rgba(52,211,153,0.15)`,
          borderRadius: 16, padding: "40px 24px",
        }}>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: WHITE, marginBottom: 10 }}>
            Not sure which plan is right for you?
          </h3>
          <p style={{ fontSize: 14, color: MUTED, marginBottom: 24 }}>
            Book a 30-minute demo and we'll walk you through the platform with your specific use case.
          </p>
          <a
            href="/contact"
            style={{
              display: "inline-block", textDecoration: "none",
              padding: "12px 28px", borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: GREEN, color: "#080D1A",
            }}
          >
            Book a Demo →
          </a>
          <div style={{ marginTop: 16 }}>
            <a
              href="/contact"
              style={{
                fontSize: 13,
                color: "rgba(240,244,250,0.4)",
                textDecoration: "none",
                borderBottom: "1px solid transparent",
                transition: "color 0.2s, border-color 0.2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = "rgba(240,244,250,0.75)";
                e.currentTarget.style.borderBottomColor = "rgba(240,244,250,0.4)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "rgba(240,244,250,0.4)";
                e.currentTarget.style.borderBottomColor = "transparent";
              }}
            >
              Not sure which plan is right for you? Book a 15-minute call — no sales pitch.
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
