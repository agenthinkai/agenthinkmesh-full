/**
 * SiteNav — single-row sticky nav.
 * Logo | Deal Screener | Compare Deals | Pricing | Contact | [PlanBadge] | [Auth]
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { PlanUsageBadge } from "@/components/PlanUsageBadge";

const NAVY   = "#080D1A";
const CYAN   = "#38BDF8";
const BLUE   = "#60A5FA";
const WHITE  = "#F0F4FA";
const MUTED  = "rgba(240,244,250,0.55)";
const BORDER = "rgba(56,189,248,0.12)";

interface SiteNavProps {
  isLandingPage?: boolean;
}

export default function SiteNav({ isLandingPage = false }: SiteNavProps) {
  const { isAuthenticated, user, logout } = useAuth();

  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close user dropdown when clicking outside
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

  const linkStyle: React.CSSProperties = {
    color: MUTED,
    fontSize: 14,
    textDecoration: "none",
    padding: "6px 14px",
    borderRadius: 8,
    transition: "color 0.18s",
    whiteSpace: "nowrap",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const hoverOn  = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.color = WHITE; };
  const hoverOff = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.color = MUTED; };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: `${NAVY}F0`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        height: 58,
      }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Logo size={30} />
        </a>

        {/* Centre nav links — icon-prefixed neon colors */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {([
            { label: "Deal Screener",  icon: "⚖️",  href: "/deals",         color: "#38BDF8", glow: "rgba(56,189,248,0.18)" },
            { label: "Compare Deals", icon: "⬡",   href: "/deals/compare", color: "#A78BFA", glow: "rgba(167,139,250,0.18)" },
            { label: "Pricing",       icon: "💎",  href: "/pricing",       color: "#4ADE80", glow: "rgba(74,222,128,0.18)" },
          ] as const).map(item => (
            <a
              key={item.label}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: MUTED, fontSize: 13, fontWeight: 600,
                textDecoration: "none",
                padding: "5px 13px", borderRadius: 8,
                border: "1px solid transparent",
                transition: "all 0.18s",
                whiteSpace: "nowrap",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.color = item.color;
                el.style.background = item.glow;
                el.style.border = `1px solid ${item.color}33`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.color = MUTED;
                el.style.background = "transparent";
                el.style.border = "1px solid transparent";
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
          {isLandingPage ? (
            <button
              onClick={() => scrollTo("contact")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: MUTED, fontSize: 13, fontWeight: 600,
                background: "none", border: "1px solid transparent",
                padding: "5px 13px", borderRadius: 8, cursor: "pointer",
                transition: "all 0.18s", whiteSpace: "nowrap",
                fontFamily: "inherit", letterSpacing: "0.01em",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = "#F97316";
                el.style.background = "rgba(249,115,22,0.15)";
                el.style.border = "1px solid rgba(249,115,22,0.3)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = MUTED;
                el.style.background = "none";
                el.style.border = "1px solid transparent";
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>✉️</span>
              Contact
            </button>
          ) : (
            <a
              href="/contact"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: MUTED, fontSize: 13, fontWeight: 600,
                textDecoration: "none",
                padding: "5px 13px", borderRadius: 8,
                border: "1px solid transparent",
                transition: "all 0.18s",
                whiteSpace: "nowrap",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.color = "#F97316";
                el.style.background = "rgba(249,115,22,0.15)";
                el.style.border = "1px solid rgba(249,115,22,0.3)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.color = MUTED;
                el.style.background = "transparent";
                el.style.border = "1px solid transparent";
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>✉️</span>
              Contact
            </a>
          )}
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
                  <a
                    href="/account/billing"
                    onClick={() => setDropOpen(false)}
                    style={{ display: "block", padding: "10px 16px", fontSize: 13, color: MUTED, textDecoration: "none", transition: "background 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
                  >
                    Billing →
                  </a>
                  <a
                    href="/reports/history"
                    onClick={() => setDropOpen(false)}
                    style={{ display: "block", padding: "10px 16px", fontSize: 13, color: MUTED, textDecoration: "none", transition: "background 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
                  >
                    Shared Reports →
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
    </div>
  );
}
