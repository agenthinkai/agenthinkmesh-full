/**
 * SiteNav — clean single-row sticky nav with slide-down products sub-bar.
 * Primary bar: Logo | Products ▾ | Pricing | Contact | [PlanBadge] | [Auth]
 * Products bar: slides down on "Products" click, collapses on outside click or product selection.
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { PlanUsageBadge } from "@/components/PlanUsageBadge";
import { isDemoMode } from "@/lib/demo";

const NAVY     = "#080D1A";
const NAVY2    = "#0D1828";
const CYAN     = "#38BDF8";
const BLUE     = "#60A5FA";
const WHITE    = "#F0F4FA";
const MUTED    = "rgba(240,244,250,0.55)";
const BORDER   = "rgba(56,189,248,0.12)";

interface SiteNavProps {
  isLandingPage?: boolean;
}

interface Product {
  label: string;
  emoji: string;
  href: string;
  color: string;
  bg: string;
  border: string;
  bgHover: string;
}

export default function SiteNav({ isLandingPage = false }: SiteNavProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const demoMode = isDemoMode();
  const ds = demoMode ? "?demo=true" : "";

  const [productsOpen, setProductsOpen] = useState(false);
  const [dropOpen, setDropOpen]         = useState(false);
  const navRef  = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close products bar when clicking outside the entire nav wrapper
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setProductsOpen(false);
      }
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setProductsOpen(false);
  };

  const PRODUCTS: Product[] = [
    { label: "OpenClaw",       emoji: "⬡",  href: "/openclaw",                    color: "#22D3EE", bg: "rgba(34,211,238,0.08)",   border: "rgba(34,211,238,0.25)",   bgHover: "rgba(34,211,238,0.16)" },
    { label: "AdMesh",         emoji: "🎯", href: "/admesh",                      color: "#F97316", bg: "rgba(249,115,22,0.08)",   border: "rgba(249,115,22,0.25)",   bgHover: "rgba(249,115,22,0.16)" },
    { label: "Social AI",      emoji: "📲", href: "/social",                      color: "#EC4899", bg: "rgba(236,72,153,0.08)",   border: "rgba(236,72,153,0.25)",   bgHover: "rgba(236,72,153,0.16)" },
    { label: "Insurance",      emoji: "🏛️", href: "/insurance",                   color: "#0EA5E9", bg: "rgba(14,165,233,0.08)",   border: "rgba(14,165,233,0.25)",   bgHover: "rgba(14,165,233,0.16)" },
    { label: "Rosie Protocol", emoji: "🧬", href: "/rosie",                       color: "#A78BFA", bg: "rgba(167,139,250,0.08)",  border: "rgba(167,139,250,0.25)",  bgHover: "rgba(167,139,250,0.16)" },
    { label: "Agent Registry", emoji: "🤖", href: "/registry",                    color: CYAN,      bg: "rgba(56,189,248,0.08)",   border: "rgba(56,189,248,0.25)",   bgHover: "rgba(56,189,248,0.16)" },
    { label: "Intel Agent",    emoji: "🔍", href: "/intelligence",                color: "#7BA3D4", bg: "rgba(123,163,212,0.08)",  border: "rgba(123,163,212,0.25)",  bgHover: "rgba(123,163,212,0.16)" },
    { label: "MVNO Intel",     emoji: "📡", href: `/telco${ds}`,                  color: "#D4A843", bg: "rgba(212,168,67,0.08)",   border: "rgba(212,168,67,0.25)",   bgHover: "rgba(212,168,67,0.16)" },
    { label: "ForecastMesh",   emoji: "📊", href: `/forecast${ds}`,               color: "#34D399", bg: "rgba(52,211,153,0.08)",   border: "rgba(52,211,153,0.25)",   bgHover: "rgba(52,211,153,0.16)" },
    { label: "Knowledge Vault",emoji: "🧠", href: `/knowledge-vault${ds}`,        color: "#F59E0B", bg: "rgba(245,158,11,0.08)",   border: "rgba(245,158,11,0.25)",   bgHover: "rgba(245,158,11,0.16)" },
    { label: "Self-Learning",   emoji: "🔄", href: "/self-learning",                 color: "#A3E635", bg: "rgba(163,230,53,0.08)",   border: "rgba(163,230,53,0.25)",   bgHover: "rgba(163,230,53,0.16)" },
    { label: "Pitch Evaluator",  emoji: "⚡", href: "/pitch",                          color: "#C9A84C", bg: "rgba(201,168,76,0.08)",   border: "rgba(201,168,76,0.25)",   bgHover: "rgba(201,168,76,0.16)" },
  ];

  const navLink = (label: string, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: MUTED, fontSize: 14, padding: "6px 14px", borderRadius: 8,
        transition: "color 0.18s", fontFamily: "inherit", whiteSpace: "nowrap",
      }}
      onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
    >
      {label}
    </button>
  );

  const navAnchor = (label: string, href: string) => (
    <a
      key={label}
      href={href}
      style={{
        color: MUTED, fontSize: 14, textDecoration: "none",
        padding: "6px 14px", borderRadius: 8, transition: "color 0.18s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
    >
      {label}
    </a>
  );

  return (
    <div
      ref={navRef}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: `${NAVY}F0`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: productsOpen ? "none" : `1px solid ${BORDER}`,
      }}
    >
      {/* ── PRIMARY NAV BAR ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        height: 58,
        borderBottom: productsOpen ? `1px solid ${BORDER}` : "none",
      }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Logo size={30} />
        </a>

        {/* Centre links */}
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {/* Products toggle */}
          <button
            onClick={() => setProductsOpen(o => !o)}
            style={{
              background: productsOpen ? "rgba(56,189,248,0.10)" : "none",
              border: productsOpen ? `1px solid rgba(56,189,248,0.22)` : "1px solid transparent",
              cursor: "pointer",
              color: productsOpen ? CYAN : MUTED,
              fontSize: 14,
              padding: "6px 14px",
              borderRadius: 8,
              transition: "all 0.18s",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (!productsOpen) (e.currentTarget as HTMLButtonElement).style.color = WHITE;
            }}
            onMouseLeave={e => {
              if (!productsOpen) (e.currentTarget as HTMLButtonElement).style.color = MUTED;
            }}
          >
            Products
            <span style={{
              display: "inline-block",
              transform: productsOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              fontSize: 10,
              opacity: 0.7,
            }}>▼</span>
          </button>

          {/* Pricing */}
          {navAnchor("Pricing", "/pricing")}

          {/* Contact — scroll on landing, link elsewhere */}
          {isLandingPage
            ? navLink("Contact", () => scrollTo("contact"))
            : navAnchor("Contact", "/contact")
          }
        </div>

        {/* Right side: plan badge + auth */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <PlanUsageBadge />

          {isAuthenticated ? (
            <div ref={dropRef} style={{ position: "relative" }}>
              <button
                onClick={() => setDropOpen(o => !o)}
                title={user?.name ?? "Account"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
                  border: "none", borderRadius: "50%",
                  width: 34, height: 34, cursor: "pointer",
                  fontSize: 13, fontWeight: 800, color: NAVY, flexShrink: 0,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.82"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </button>

              {dropOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  background: "#0D1E35", border: `1px solid ${CYAN}25`,
                  borderRadius: 10, minWidth: 180, zIndex: 200,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden",
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{user?.name ?? "User"}</div>
                    {user?.email && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{user.email}</div>}
                  </div>
                  <a
                    href="/persona-setup"
                    onClick={() => setDropOpen(false)}
                    style={{ display: "block", padding: "10px 16px", fontSize: 13, color: MUTED, textDecoration: "none", transition: "background 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
                  >
                    My Workspace →
                  </a>
                  {user?.role === "admin" && (
                    <a
                      href="/admin/usage"
                      onClick={() => setDropOpen(false)}
                      style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "#F59E0B", textDecoration: "none", transition: "background 0.15s", borderTop: "1px solid rgba(245,158,11,0.12)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(245,158,11,0.08)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                    >
                      ⚡ Usage Dashboard
                    </a>
                  )}
                  <button
                    onClick={() => { setDropOpen(false); logout(); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "10px 16px", background: "none", border: "none",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      fontSize: 13, color: "#EF4444", cursor: "pointer",
                      fontFamily: "inherit", transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a
              href={getLoginUrl()}
              style={{
                color: WHITE, fontSize: 14, textDecoration: "none",
                padding: "7px 18px", borderRadius: 8, fontWeight: 600,
                background: "linear-gradient(135deg, #7BA3D4, #4ADE80)",
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = "0.88";
                (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.02)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
                (e.currentTarget as HTMLAnchorElement).style.transform = "none";
              }}
            >
              Sign in →
            </a>
          )}
        </div>
      </div>

      {/* ── SLIDE-DOWN PRODUCTS BAR ─────────────────────────────────────── */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: productsOpen ? 72 : 0,
          opacity: productsOpen ? 1 : 0,
          transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
          background: NAVY2,
          borderBottom: productsOpen ? `1px solid ${BORDER}` : "none",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 32px",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}>
          {PRODUCTS.map(p => (
            <a
              key={p.label}
              href={p.href}
              onClick={() => setProductsOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: p.color,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                padding: "6px 14px",
                borderRadius: 8,
                border: `1px solid ${p.border}`,
                background: p.bg,
                transition: "all 0.18s",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = p.bgHover;
                el.style.color = WHITE;
                el.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = p.bg;
                el.style.color = p.color;
                el.style.transform = "none";
              }}
            >
              <span style={{ fontSize: 14 }}>{p.emoji}</span>
              {p.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
