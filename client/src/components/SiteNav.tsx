/**
 * SiteNav — shared sticky top navigation bar used across all pages.
 * Shows: Logo | Domains · Contact (scroll anchors on landing, links elsewhere) | Sign In / Dashboard
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";

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
  const { isAuthenticated } = useAuth();

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
          </>
        )}

        {/* Auth button */}
        {isAuthenticated ? (
          <a
            href="/ask"
            style={{
              color: WHITE, fontSize: 14, textDecoration: "none",
              padding: "7px 18px", borderRadius: 8, fontWeight: 600,
              background: `linear-gradient(135deg, ${CYAN}30, ${BLUE}30)`,
              border: `1px solid ${CYAN}50`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = `linear-gradient(135deg, ${CYAN}50, ${BLUE}50)`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = `linear-gradient(135deg, ${CYAN}30, ${BLUE}30)`;
            }}
          >
            Dashboard →
          </a>
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
