/**
 * DomainsPage — top-level Domains directory
 *
 * Shows every active domain with its agent count.
 * Clicking a domain navigates to /domain/:name (DomainAgents page),
 * which already handles the agent list + agent detail (same logic as role).
 */
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import SiteNav from "@/components/SiteNav";
import Logo from "@/components/Logo";
import { Link } from "wouter";

/* ─── Design tokens ─────────────────────────────────────────────────── */
const NAVY   = "#080D1A";
const NAVY2  = "#0C1525";
const NAVY3  = "#0F1A2E";
const CYAN   = "#38BDF8";
const WHITE  = "#F0F4FA";
const MUTED  = "rgba(240,244,250,0.50)";
const BORDER = "rgba(56,189,248,0.10)";
const MONO   = "'JetBrains Mono', monospace";

/* ─── Domain metadata (icon + colour + description) ─────────────────── */
const DOMAIN_META: Record<string, { icon: string; color: string; desc: string }> = {
  "Education":    { icon: "🎓", color: "#818CF8", desc: "Research assistance, citations, essay outlining, study planning" },
  "Enterprise":   { icon: "🏢", color: "#E879F9", desc: "HR, procurement, SLA management, workflow automation" },
  "Finance":      { icon: "📈", color: "#4ADE80", desc: "Deal screening, DCF models, comps, macro monitoring, KYC/AML" },
  "GCC Wealth":   { icon: "💎", color: "#C9A84C", desc: "Private wealth, HNWI profiling, Shariah compliance, family office" },
  "Healthcare":   { icon: "🩺", color: "#22D3EE", desc: "Clinical summaries, drug interactions, ICD coding, patient records" },
  "Legal":        { icon: "⚖️", color: "#94A3B8", desc: "Contract review, clause extraction, GCC compliance, risk scoring" },
};

function getDomainMeta(domain: string) {
  if (DOMAIN_META[domain]) return DOMAIN_META[domain];
  const key = Object.keys(DOMAIN_META).find(k => k.toLowerCase() === domain.toLowerCase());
  if (key) return DOMAIN_META[key];
  return { icon: "🤖", color: "#7BA3D4", desc: `Specialist agents for ${domain}` };
}

/* ─── Domain Card ────────────────────────────────────────────────────── */
function DomainCard({ domain, count }: { domain: string; count: number }) {
  const meta = getDomainMeta(domain);
  // Use the original domain name URL-encoded so DomainAgents can decode it back exactly
  const slug = encodeURIComponent(domain);

  return (
    <Link href={`/domain/${slug}`}>
      <a
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "24px",
          borderRadius: 18,
          border: `1.5px solid ${meta.color}30`,
          background: `${meta.color}08`,
          textDecoration: "none",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.border = `1.5px solid ${meta.color}60`;
          el.style.background = `${meta.color}12`;
          el.style.transform = "translateY(-3px)";
          el.style.boxShadow = `0 12px 36px ${meta.color}18`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.border = `1.5px solid ${meta.color}30`;
          el.style.background = `${meta.color}08`;
          el.style.transform = "none";
          el.style.boxShadow = "none";
        }}
      >
        {/* Icon + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `${meta.color}18`,
            border: `1px solid ${meta.color}35`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, flexShrink: 0,
            filter: `drop-shadow(0 0 8px ${meta.color}44)`,
          }}>
            {meta.icon}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: WHITE, letterSpacing: "-0.01em" }}>
              {domain}
            </div>
            <div style={{
              marginTop: 4,
              display: "inline-flex", alignItems: "center",
              fontSize: 10, fontFamily: MONO, fontWeight: 700,
              background: `${meta.color}18`,
              border: `1px solid ${meta.color}35`,
              color: meta.color,
              borderRadius: 8, padding: "2px 9px",
            }}>
              {count} {count === 1 ? "agent" : "agents"}
            </div>
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontSize: 12, color: MUTED, lineHeight: 1.65, margin: 0,
          fontFamily: "'Inter', sans-serif",
        }}>
          {meta.desc}
        </p>

        {/* CTA */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 2,
        }}>
          <span style={{
            fontSize: 10, fontFamily: MONO, color: MUTED,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, padding: "2px 8px",
          }}>
            {domain.toUpperCase()} DOMAIN
          </span>
          <span style={{ fontSize: 13, color: meta.color, fontWeight: 700 }}>
            Explore →
          </span>
        </div>
      </a>
    </Link>
  );
}

/* ─── Skeleton card ──────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      height: 180, borderRadius: 18,
      background: "rgba(255,255,255,0.03)",
      border: "1.5px solid rgba(255,255,255,0.06)",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */
export default function DomainsPage() {
  const domainsQuery = trpc.agent.listDomains.useQuery(undefined, { staleTime: 60_000 });
  const domains = domainsQuery.data ?? [];
  const totalAgents = domains.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: NAVY,
      color: WHITE,
      fontFamily: "'Inter', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <SiteNav />

      <div style={{
        flex: 1,
        maxWidth: 1080,
        width: "100%",
        margin: "0 auto",
        padding: "48px 24px 80px",
      }}>
        {/* Page header */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 10, fontFamily: MONO, fontWeight: 700,
            color: CYAN, letterSpacing: "0.14em",
            background: `${CYAN}12`, border: `1px solid ${CYAN}30`,
            borderRadius: 8, padding: "4px 12px", marginBottom: 16,
          }}>
            ◈ AGENT DOMAINS
          </div>
          <h1 style={{
            fontSize: "clamp(26px, 5vw, 40px)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            marginBottom: 14,
            background: `linear-gradient(135deg, ${WHITE} 40%, ${CYAN}CC)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Explore Agent Domains
          </h1>
          <p style={{ fontSize: 15, color: MUTED, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            Browse specialist AI agents organised by professional domain.
            Select a domain to view its agents and launch one in the Mesh.
          </p>
          {!domainsQuery.isLoading && domains.length > 0 && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 16,
              marginTop: 20, fontSize: 12, fontFamily: MONO, color: MUTED,
            }}>
              <span>{domains.length} domains</span>
              <span style={{ color: BORDER }}>·</span>
              <span>{totalAgents} specialist agents</span>
            </div>
          )}
        </div>

        {/* Domain grid */}
        {domainsQuery.isLoading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 18,
          }}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : domains.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 24px",
            border: `1px dashed ${BORDER}`, borderRadius: 16,
            color: MUTED,
          }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No domains found</div>
            <div style={{ fontSize: 13 }}>Register agents to populate domains.</div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 18,
          }}>
            {domains.map(d => (
              <DomainCard key={d.domain} domain={d.domain} count={d.count} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
