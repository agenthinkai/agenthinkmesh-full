/**
 * SiteNav — pill-style tabs with stacked icon + label, colored underline on hover/active.
 * Matches the reference screenshot style from the user.
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { PlanUsageBadge } from "@/components/PlanUsageBadge";

const NAVY   = "#080D1A";
const NAVY2  = "#0C1525";
const CYAN   = "#38BDF8";
const BLUE   = "#60A5FA";
const WHITE  = "#F0F4FA";
const MUTED  = "rgba(240,244,250,0.50)";
const BORDER = "rgba(56,189,248,0.10)";

// Nav items — each has a unique neon color + colored underline, matching the screenshot style
interface NavItem {
  label: string;
  icon: string;
  href: string;
  color: string;
  underline: string;
  scrollId?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Deal Screener",  icon: "⚖️",  href: "/deals",         color: "#38BDF8", underline: "#38BDF8" },
  { label: "Compare Deals",  icon: "🔷",  href: "/deals/compare", color: "#A78BFA", underline: "#A78BFA" },
  { label: "Pricing",        icon: "💎",  href: "/pricing",       color: "#4ADE80", underline: "#4ADE80" },
  { label: "Contact",        icon: "✉️",  href: "/contact",       color: "#F97316", underline: "#F97316", scrollId: "contact" },
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
        background: `${NAVY}F2`,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 56,
        gap: 8,
      }}>

        {/* ── LOGO ─────────────────────────────────────────────────────── */}
        <a
          href="/"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            marginRight: 8,
          }}
        >
          <Logo size={28} />
        </a>

        {/* ── NAV PILLS ────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "stretch",
          gap: 2,
          flex: 1,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}>
          {NAV_ITEMS.map(item => {
            const isActive = currentPath === item.href || currentPath.startsWith(item.href + "/");
            const isHovered = activeHover === item.label;
            const highlight = isActive || isHovered;

            const handleNavClick = (e: React.MouseEvent) => {
              if (isLandingPage && item.scrollId) {
                e.preventDefault();
                scrollTo(item.scrollId);
              }
            };

            return (
              <a
                key={item.label}
                href={item.href}
                onClick={handleNavClick}
                onMouseEnter={() => setActiveHover(item.label)}
                onMouseLeave={() => setActiveHover(null)}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: "0 14px",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "background 0.18s",
                  background: highlight ? `${item.color}12` : "transparent",
                  borderRadius: 0,
                  minWidth: 80,
                  flexShrink: 0,
                }}
              >
                {/* Icon */}
                <span style={{
                  fontSize: 15,
                  lineHeight: 1,
                  filter: highlight ? `drop-shadow(0 0 6px ${item.color}88)` : "none",
                  transition: "filter 0.18s",
                }}>
                  {item.icon}
                </span>

                {/* Label */}
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: highlight ? item.color : MUTED,
                  transition: "color 0.18s",
                  whiteSpace: "nowrap",
                }}>
                  {item.label}
                </span>

                {/* Colored underline bar — active/hover indicator */}
                <span style={{
                  position: "absolute",
                  bottom: 0,
                  left: "10%",
                  right: "10%",
                  height: 2,
                  borderRadius: "2px 2px 0 0",
                  background: highlight ? item.underline : "transparent",
                  boxShadow: highlight ? `0 0 8px ${item.underline}88` : "none",
                  transition: "all 0.18s",
                }} />
              </a>
            );
          })}
        </div>

        {/* ── RIGHT: PLAN BADGE + AUTH ──────────────────────────────────── */}
        <div style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexShrink: 0,
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
                    { label: "My Workspace →",   href: "/persona-setup",    color: MUTED },
                    { label: "Billing →",         href: "/account/billing",  color: MUTED },
                    { label: "Shared Reports →",  href: "/reports/history",  color: MUTED },
                  ].map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setDropOpen(false)}
                      style={{ display: "block", padding: "10px 16px", fontSize: 13, color: item.color, textDecoration: "none", transition: "background 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = item.color; }}
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
