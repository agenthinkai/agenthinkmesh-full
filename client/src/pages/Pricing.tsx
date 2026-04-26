/**
 * Pricing — /pricing
 * Three institutional tiers: Starter ($299), Professional ($999), Institutional (Custom).
 * Static page — no tRPC calls, no schema changes.
 * Tracks pricing_page_view and pricing_cta_click events.
 */

import { useEffect } from "react";
import SiteNav from "@/components/SiteNav";
import { trackEvent } from "@/lib/analytics";
import { Check } from "lucide-react";

const NAVY = "#080D1A";
const CARD = "#0D1E35";
const BORDER = "rgba(52,211,153,0.15)";
const GREEN = "#34D399";
const BLUE = "#3B82F6";
const VIOLET = "#8B5CF6";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";

type TierId = "starter" | "professional" | "institutional";

interface Tier {
  id: TierId;
  name: string;
  price: string;
  period: string;
  for: string;
  highlight: boolean;
  badge?: string;
  accentColor: string;
  highlightBorder: string;
  highlightGlow: string;
  ctaBg: string;
  ctaColor: string;
  features: string[];
  cta: string;
  ctaHref: string;
}

const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$299",
    period: "/month",
    for: "Solo analysts and small family offices",
    highlight: false,
    accentColor: GREEN,
    highlightBorder: BORDER,
    highlightGlow: "none",
    ctaBg: `linear-gradient(135deg, #10b981 0%, #06b6d4 100%)`,
    ctaColor: "#080D1A",
    features: [
      "50 deal screenings per month",
      "Full 10-agent council per deal",
      "IC Memo PDF export",
      "Pipeline tracking",
      "Email support",
    ],
    cta: "Start free trial →",
    ctaHref: "/login",
  },
  {
    id: "professional",
    name: "Professional",
    price: "$999",
    period: "/month",
    for: "Investment teams up to 5 analysts",
    highlight: true,
    badge: "Most Popular",
    accentColor: BLUE,
    highlightBorder: `2px solid ${BLUE}`,
    highlightGlow: "0 0 40px rgba(59,130,246,0.18)",
    ctaBg: `linear-gradient(135deg, ${BLUE} 0%, #6366f1 100%)`,
    ctaColor: WHITE,
    features: [
      "Everything in Starter",
      "Unlimited deal screenings",
      "Shariah compliance screening",
      "Cross-deal pattern recognition",
      "Deep Analysis mode (Sonnet)",
      "Priority support",
    ],
    cta: "Start free trial →",
    ctaHref: "/login",
  },
  {
    id: "institutional",
    name: "Institutional",
    price: "Custom",
    period: "",
    for: "Funds, family offices, sovereign wealth",
    highlight: false,
    accentColor: VIOLET,
    highlightBorder: "1px solid rgba(139,92,246,0.3)",
    highlightGlow: "none",
    ctaBg: `linear-gradient(135deg, ${VIOLET} 0%, #a855f7 100%)`,
    ctaColor: WHITE,
    features: [
      "Everything in Professional",
      "Unlimited seats",
      "Custom agent configuration",
      "On-premise deployment option",
      "Dedicated account manager",
      "SLA guarantee",
      "AES-256 encryption + compliance docs",
    ],
    cta: "Talk to us →",
    ctaHref: "mailto:farouqsultan@gmail.com",
  },
];

export default function Pricing() {
  useEffect(() => {
    trackEvent("pricing_page_view", { referrer: document.referrer });
  }, []);

  const handleCtaClick = (tier: TierId) => {
    trackEvent("pricing_cta_click", { tier });
  };

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
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 16, color: MUTED, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            Built for institutional investors. Priced to replace a junior analyst.
          </p>
        </div>

        {/* Pricing cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          alignItems: "start",
          marginBottom: 60,
        }}>
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              style={{
                background: tier.highlight ? "rgba(13,30,53,0.95)" : CARD,
                border: tier.highlightBorder,
                borderRadius: 16,
                padding: "28px 24px",
                position: "relative",
                boxShadow: tier.highlightGlow,
              }}
            >
              {/* Badge */}
              {tier.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: BLUE, color: WHITE, fontSize: 10, fontWeight: 800,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "3px 12px", borderRadius: 20,
                }}>
                  {tier.badge}
                </div>
              )}

              {/* Tier label */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: tier.accentColor,
                letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6,
              }}>
                {tier.name}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>{tier.for}</div>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: WHITE }}>{tier.price}</span>
                {tier.period && (
                  <span style={{ fontSize: 14, color: MUTED }}>{tier.period}</span>
                )}
              </div>

              {/* CTA */}
              <a
                href={tier.ctaHref}
                onClick={() => handleCtaClick(tier.id)}
                style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  padding: "11px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                  marginBottom: 24, background: tier.ctaBg, color: tier.ctaColor,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                {tier.cta}
              </a>

              {/* Divider */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }} />

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tier.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Check style={{ width: 14, height: 14, color: GREEN, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Comparison line */}
        <div style={{
          textAlign: "center", marginBottom: 72,
          background: "rgba(52,211,153,0.05)",
          border: `1px solid rgba(52,211,153,0.15)`,
          borderRadius: 16, padding: "32px 24px",
          maxWidth: 680, marginLeft: "auto", marginRight: "auto",
        }}>
          <p style={{ fontSize: 16, color: WHITE, lineHeight: 1.8, margin: 0 }}>
            A junior analyst costs{" "}
            <strong>$80,000/year</strong>.<br />
            The Mesh costs{" "}
            <strong style={{ color: GREEN }}>$11,988/year</strong>.<br />
            <span style={{ fontSize: 14, color: MUTED }}>Same judgment. 5,760× faster.</span>
          </p>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: "center" }}>
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
        </div>
      </div>
    </div>
  );
}
