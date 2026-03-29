/**
 * SiteNav — matches reference screenshot exactly.
 * Logo | Domains | Contact | [scrollable wide tab blocks] | PlanBadge | Avatar
 *
 * Each tab block:
 *  - dark rectangular background with subtle border
 *  - small colored icon top-left
 *  - name in neon color, bold
 *  - thick colored bottom border on hover/active
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { PlanUsageBadge } from "@/components/PlanUsageBadge";

const NAVY   = "#080D1A";
const NAVY2  = "#0C1525";
const NAVY3  = "#0F1B2D";
const CYAN   = "#38BDF8";
const BLUE   = "#60A5FA";
const WHITE  = "#F0F4FA";
const MUTED  = "rgba(240,244,250,0.50)";
const BORDER = "rgba(56,189,248,0.10)";

interface NavItem {
  label: string;
  icon: string;
  href: string;
  color: string;       // neon text + border color
  bg: string;          // subtle bg tint
  scrollId?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Deal Screener",  icon: "⚖️",  href: "/deals",         color: "#38BDF8", bg: "rgba(56,189,248,0.07)"  },
  { label: "Compare Deals",  icon: "🔷",  href: "/deals/compare", color: "#A78BFA", bg: "rgba(167,139,250,0.07)" },
  { label: "Pricing",        icon: "💎",  href: "/pricing",       color: "#4ADE80", bg: "rgba(74,222,128,0.07)"  },
  { label: "Contact",        icon: "✉️",  href: "/contact",       color: "#F97316", bg: "rgba(249,115,22,0.07)", scrollId: "contact" },
];

interface SiteNavProps {
  isLandingPage?: boolean;
}

export default function SiteNav({ isLandingPage = false }: SiteNavProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const [activeHover, setActiveHover] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
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
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: `${NAVY}F5`,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "stretch",
        height: 52,
        gap: 0,
      }}>

        {/* ── LOGO + STATIC LINKS ──────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "0 8px 0 16px",
          flexShrink: 0,
          borderRight: `1px solid ${BORDER}`,
        }}>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", marginRight: 16 }}>
            <Logo size={26} />
          </a>

          {/* Static links matching the screenshot's "Domains | Contact" style */}
          {[
            { label: "Domains", href: "/pricing" },
            { label: "Contact", href: isLandingPage ? "#contact" : "/contact", scrollId: isLandingPage ? "contact" : undefined },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              onClick={item.scrollId ? (e) => { e.preventDefault(); scrollTo(item.scrollId!); } : undefined}
              style={{
                color: MUTED,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                padding: "0 12px",
                height: "100%",
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* ── SCROLLABLE TAB BLOCKS ─────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "stretch",
          flex: 1,
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          gap: 0,
        }}>
          {NAV_ITEMS.map(item => {
            const isActive = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));
            const isHovered = activeHover === item.label;
            const highlight = isActive || isHovered;

            return (
              <a
                key={item.label}
                href={item.href}
                onClick={isLandingPage && item.scrollId
                  ? (e) => { e.preventDefault(); scrollTo(item.scrollId!); }
                  : undefined
                }
                onMouseEnter={() => setActiveHover(item.label)}
                onMouseLeave={() => setActiveHover(null)}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 1,
                  padding: "0 18px",
                  minWidth: 110,
                  textDecoration: "none",
                  cursor: "pointer",
                  background: highlight ? item.bg : "transparent",
                  borderRight: `1px solid ${BORDER}`,
                  borderBottom: highlight
                    ? `3px solid ${item.color}`
                    : "3px solid transparent",
                  transition: "background 0.18s, border-bottom-color 0.18s",
                  flexShrink: 0,
                }}
              >
                {/* Icon row */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{
                    fontSize: 14,
                    lineHeight: 1,
                    filter: highlight ? `drop-shadow(0 0 5px ${item.color}99)` : "none",
                    transition: "filter 0.18s",
                  }}>
                    {item.icon}
                  </span>
                </div>

                {/* Label */}
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  color: highlight ? item.color : MUTED,
                  transition: "color 0.18s",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                  textShadow: highlight ? `0 0 12px ${item.color}66` : "none",
                }}>
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>

        {/* ── RIGHT: PLAN BADGE + AUTH ──────────────────────────────────── */}
        <div style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "0 12px",
          flexShrink: 0,
          borderLeft: `1px solid ${BORDER}`,
        }}>
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
                  width: 32, height: 32, cursor: "pointer",
                  fontSize: 12, fontWeight: 800, color: NAVY, flexShrink: 0,
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
                  background: NAVY2, border: `1px solid ${CYAN}22`,
                  borderRadius: 10, minWidth: 190, zIndex: 200,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.55)", overflow: "hidden",
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{user?.name ?? "User"}</div>
                    {user?.email && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{user.email}</div>}
                  </div>
                  {[
                    { label: "My Workspace →",  href: "/persona-setup" },
                    { label: "Billing →",        href: "/account/billing" },
                    { label: "Shared Reports →", href: "/reports/history" },
                  ].map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setDropOpen(false)}
                      style={{ display: "block", padding: "10px 16px", fontSize: 13, color: MUTED, textDecoration: "none", transition: "background 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
                    >
                      {item.label}
                    </a>
                  ))}
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
                      fontFamily: "inherit",
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
                color: WHITE, fontSize: 13, textDecoration: "none",
                padding: "6px 16px", borderRadius: 8, fontWeight: 600,
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
    </div>
  );
}
