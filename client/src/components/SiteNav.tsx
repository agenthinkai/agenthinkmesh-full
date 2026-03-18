/**
 * SiteNav — shared sticky top navigation bar used across all pages.
 * Shows: Logo | Domains · Contact (scroll anchors on landing, links elsewhere) | Sign In / Dashboard + Logout
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { PlanUsageBadge } from "@/components/PlanUsageBadge";

const NAVY = "#080D1A";
const CYAN = "#38BDF8";
const BLUE = "#60A5FA";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";

interface SiteNavProps {
  /** If true, Domains/Contact links scroll to sections on the same page */
  isLandingPage?: boolean;
}

export default function SiteNav({ isLandingPage = false }: SiteNavProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
    <nav style={{
      position: "sticky",
      top: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 32px",
      borderBottom: "1px solid rgba(56,189,248,0.12)",
      background: `${NAVY}E8`,
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
    }}>
      {/* Logo */}
      <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
        <Logo size={32} />
      </a>

      {/* Links */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {isLandingPage ? (
          <>
            <button
              onClick={() => scrollTo("domains")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: MUTED, fontSize: 14, padding: "6px 14px", borderRadius: 8,
                transition: "color 0.2s", fontFamily: "inherit",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
              onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
            >
              Domains
            </button>
            <button
              onClick={() => scrollTo("contact")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: MUTED, fontSize: 14, padding: "6px 14px", borderRadius: 8,
                transition: "color 0.2s", fontFamily: "inherit",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
              onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
            >
              Contact
            </button>
            <a
              href="/insurance"
              style={{
                color: "#0EA5E9", fontSize: 14, textDecoration: "none",
                padding: "6px 14px", borderRadius: 8, fontWeight: 600,
                transition: "all 0.2s", fontFamily: "inherit",
                border: "1px solid rgba(14,165,233,0.3)",
                background: "rgba(14,165,233,0.08)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(14,165,233,0.18)";
                (e.currentTarget as HTMLAnchorElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(14,165,233,0.08)";
                (e.currentTarget as HTMLAnchorElement).style.color = "#0EA5E9";
              }}
            >
              🏛️ Insurance
            </a>
            <a
              href="/rosie"
              style={{
                color: "#A78BFA", fontSize: 14, textDecoration: "none",
                padding: "6px 14px", borderRadius: 8, fontWeight: 600,
                transition: "all 0.2s", fontFamily: "inherit",
                border: "1px solid rgba(167,139,250,0.3)",
                background: "rgba(167,139,250,0.08)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(167,139,250,0.18)";
                (e.currentTarget as HTMLAnchorElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(167,139,250,0.08)";
                (e.currentTarget as HTMLAnchorElement).style.color = "#A78BFA";
              }}
            >
              🧬 Rosie Protocol
            </a>
            <a
              href="/registry"
              style={{
                color: CYAN, fontSize: 14, textDecoration: "none",
                padding: "6px 14px", borderRadius: 8, fontWeight: 600,
                transition: "color 0.2s", fontFamily: "inherit",
                border: `1px solid ${CYAN}35`,
                background: `${CYAN}10`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = `${CYAN}22`;
                (e.currentTarget as HTMLAnchorElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = `${CYAN}10`;
                (e.currentTarget as HTMLAnchorElement).style.color = CYAN;
              }}
            >
              Agent Registry
            </a>
          </>
        ) : (
          <>
            <a
              href="/#domains"
              style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
              onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
            >
              Domains
            </a>
            <a
              href="/#contact"
              style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
              onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
            >
              Contact
            </a>
            <a
              href="/insurance"
              style={{
                color: "#0EA5E9", fontSize: 14, textDecoration: "none",
                padding: "6px 14px", borderRadius: 8, fontWeight: 600,
                transition: "all 0.2s",
                border: "1px solid rgba(14,165,233,0.3)",
                background: "rgba(14,165,233,0.08)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(14,165,233,0.18)";
                (e.currentTarget as HTMLAnchorElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(14,165,233,0.08)";
                (e.currentTarget as HTMLAnchorElement).style.color = "#0EA5E9";
              }}
            >
              🏛️ Insurance
            </a>
            <a
              href="/rosie"
              style={{
                color: "#A78BFA", fontSize: 14, textDecoration: "none",
                padding: "6px 14px", borderRadius: 8, fontWeight: 600,
                transition: "all 0.2s",
                border: "1px solid rgba(167,139,250,0.3)",
                background: "rgba(167,139,250,0.08)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(167,139,250,0.18)";
                (e.currentTarget as HTMLAnchorElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(167,139,250,0.08)";
                (e.currentTarget as HTMLAnchorElement).style.color = "#A78BFA";
              }}
            >
              🧬 Rosie Protocol
            </a>
            <a
              href="/registry"
              style={{
                color: CYAN, fontSize: 14, textDecoration: "none",
                padding: "6px 14px", borderRadius: 8, fontWeight: 600,
                transition: "color 0.2s",
                border: `1px solid ${CYAN}35`,
                background: `${CYAN}10`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = `${CYAN}22`;
                (e.currentTarget as HTMLAnchorElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = `${CYAN}10`;
                (e.currentTarget as HTMLAnchorElement).style.color = CYAN;
              }}
            >
              Agent Registry
            </a>
          </>
        )}

        {/* Plan usage badge — visible when logged in */}
        <PlanUsageBadge />

        {/* Auth button / user dropdown */}
        {isAuthenticated ? (
          <div ref={dropRef} style={{ position: "relative" }}>
            {/* Avatar trigger */}
            <button
              onClick={() => setDropOpen(o => !o)}
              title={user?.name ?? "Account"}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
                border: "none",
                borderRadius: "50%", width: 34, height: 34, cursor: "pointer",
                fontSize: 13, fontWeight: 800, color: NAVY, flexShrink: 0,
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.82"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </button>

            {/* Dropdown */}
            {dropOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "#0D1E35", border: `1px solid ${CYAN}25`,
                borderRadius: 10, minWidth: 180, zIndex: 200,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                overflow: "hidden",
              }}>
                {/* User info */}
                <div style={{ padding: "12px 16px", borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{user?.name ?? "User"}</div>
                  {user?.email && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{user.email}</div>}
                </div>
                {/* Dashboard link */}
                <a
                  href="/persona-setup"
                  onClick={() => setDropOpen(false)}
                  style={{
                    display: "block", padding: "10px 16px",
                    fontSize: 13, color: MUTED, textDecoration: "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
                >
                  My Workspace →
                </a>
                {/* Admin-only: Usage Dashboard */}
                {user?.role === "admin" && (
                  <a
                    href="/admin/usage"
                    onClick={() => setDropOpen(false)}
                    style={{
                      display: "block", padding: "10px 16px",
                      fontSize: 13, color: "#F59E0B", textDecoration: "none",
                      transition: "background 0.15s",
                      borderTop: "1px solid rgba(245,158,11,0.12)",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(245,158,11,0.08)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                  >
                    ⚡ Usage Dashboard
                  </a>
                )}
                {/* Logout */}
                <button
                  onClick={() => { setDropOpen(false); logout(); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "10px 16px", background: "none", border: "none",
                    borderTop: `1px solid rgba(255,255,255,0.06)`,
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
              transition: "all 0.2s",
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
    </nav>
  );
}
