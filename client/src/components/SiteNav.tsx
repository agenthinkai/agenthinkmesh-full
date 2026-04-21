/**
 * SiteNav — responsive top navigation.
 *
 * Large  (≥1280 px): Logo | static links | Tools ▾ | [tab items that fit] | More ▾ | PlanBadge | Avatar
 * Medium (768–1279): Logo | static links | Tools ▾ | [fewer tab items]   | More ▾ | PlanBadge | Avatar
 * Mobile  (<768 px): Logo | PlanBadge | Avatar | ☰ hamburger → full-height slide-in drawer
 *
 * The tab row never overflows — items that don't fit collapse into a "More ▾" dropdown.
 * Each NAV_ITEM tab is ~94px wide (minWidth 80 + 14px padding each side).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { PlanUsageBadge } from "@/components/PlanUsageBadge";
import { trpc } from "@/lib/trpc";

/* ─── Design tokens ─────────────────────────────────────────────────── */
const NAVY   = "#080D1A";
const NAVY2  = "#0C1525";
const NAVY3  = "#0F1A2E";
const CYAN   = "#38BDF8";
const BLUE   = "#60A5FA";
const WHITE  = "#F0F4FA";
const MUTED  = "rgba(240,244,250,0.50)";
const BORDER = "rgba(56,189,248,0.10)";

/* ─── Nav item definitions ──────────────────────────────────────────── */
interface NavItem {
  label: string;
  icon: string;
  href: string;
  color: string;
  bg: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "OpenClaw",        icon: "○",  href: "/openclaw",        color: "#38BDF8", bg: "rgba(56,189,248,0.08)"   },
  { label: "AdMesh",          icon: "🎯", href: "/admesh",          color: "#F472B6", bg: "rgba(244,114,182,0.08)"  },
  { label: "Social AI",       icon: "🌐", href: "/social",          color: "#C084FC", bg: "rgba(192,132,252,0.08)"  },
  { label: "Insurance",       icon: "🏛️", href: "/insurance",       color: "#60A5FA", bg: "rgba(96,165,250,0.08)"   },
  { label: "Rosie Protocol",  icon: "🚀", href: "/rosie",           color: "#A78BFA", bg: "rgba(167,139,250,0.08)"  },
  { label: "Agent Registry",  icon: "📋", href: "/registry",        color: "#94A3B8", bg: "rgba(148,163,184,0.08)"  },
  { label: "Intel Agent",     icon: "🔍", href: "/intelligence",    color: "#22D3EE", bg: "rgba(34,211,238,0.08)"   },
  { label: "MVNO Intel",      icon: "📡", href: "/telco",           color: "#FB923C", bg: "rgba(251,146,60,0.08)"   },
  { label: "ForecastMesh",    icon: "📊", href: "/forecast",        color: "#FBBF24", bg: "rgba(251,191,36,0.08)"   },
  { label: "Knowledge Vault", icon: "🗄️", href: "/knowledge-vault", color: "#F59E0B", bg: "rgba(245,158,11,0.08)"   },
  { label: "Deal Screener",   icon: "⚖️", href: "/deals",           color: "#4ADE80", bg: "rgba(74,222,128,0.08)"   },
  { label: "Procurement Eval", icon: "🏗️", href: "/procurement",    color: "#4ADE80", bg: "rgba(74,222,128,0.08)"   },
  { label: "Pitch Triage",    icon: "⚡",  href: "/pitch-triage",   color: "#a78bfa", bg: "rgba(167,139,250,0.08)"  },
  { label: "PitchMirror",     icon: "🪞",  href: "/pitchmirror",    color: "#c084fc", bg: "rgba(192,132,252,0.08)"  },
  { label: "Contacts",        icon: "👥", href: "/contacts",        color: "#F59E0B", bg: "rgba(245,158,11,0.08)"   },
  { label: "Compare Deals",   icon: "🔷", href: "/deals/compare",   color: "#818CF8", bg: "rgba(129,140,248,0.08)"  },
  { label: "Pitch",           icon: "💡", href: "/pitch",           color: "#FF6B35", bg: "rgba(255,107,53,0.08)"   },
  { label: "Reply Tracker",   icon: "📬", href: "/tracker",         color: "#34D399", bg: "rgba(52,211,153,0.08)"   },
  { label: "PortfolioMesh",   icon: "🏦", href: "/portfolio-mesh",  color: "#7BA3D4", bg: "rgba(123,163,212,0.08)"  },
];

/* ─── Tab item width constant ───────────────────────────────────────── */
// Each tab: minWidth 80 + 14px left padding + 14px right padding = 108px worst case.
// We use 100px as a conservative estimate per item for overflow calculation.
const TAB_ITEM_WIDTH = 100;
// "More" button width (approx)
const MORE_BTN_WIDTH = 72;

/* ─── Helpers ───────────────────────────────────────────────────────── */
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

function isActivePath(href: string, currentPath: string) {
  if (href === "/deals") return currentPath === "/deals";
  return currentPath === href || (href !== "/" && currentPath.startsWith(href));
}

/* ─── Hamburger icon ────────────────────────────────────────────────── */
function HamburgerIcon({ open }: { open: boolean }) {
  const bar: React.CSSProperties = {
    display: "block",
    width: 20,
    height: 2,
    background: WHITE,
    borderRadius: 2,
    transition: "transform 0.25s, opacity 0.25s",
    transformOrigin: "center",
  };
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 5, width: 20 }}>
      <span style={{ ...bar, transform: open ? "translateY(7px) rotate(45deg)" : "none" }} />
      <span style={{ ...bar, opacity: open ? 0 : 1 }} />
      <span style={{ ...bar, transform: open ? "translateY(-7px) rotate(-45deg)" : "none" }} />
    </span>
  );
}

/* ─── Mobile Drawer ─────────────────────────────────────────────────── */
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  currentPath: string;
  isAuthenticated: boolean;
  user: { name?: string | null; email?: string | null; role?: string } | null;
  logout: () => void;
}

function MobileDrawer({ open, onClose, currentPath, isAuthenticated, user, logout }: DrawerProps) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 150,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.28s",
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 160,
          width: "min(300px, 85vw)",
          background: NAVY3,
          borderLeft: `1px solid ${BORDER}`,
          boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Drawer header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}>
          <a href="/" onClick={onClose} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <Logo size={24} />
            <span style={{ fontSize: 13, fontWeight: 700, color: WHITE, letterSpacing: "0.04em" }}>
              AgenThinkMesh
            </span>
          </a>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: MUTED, fontSize: 20, lineHeight: 1, padding: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = WHITE; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}
          >
            ✕
          </button>
        </div>

        {/* Static links */}
        <div style={{ padding: "8px 0", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          {[
            { label: "Domains", href: "/domains" },
            { label: "Deal Screener", href: "/deals" },
            { label: "Procurement Eval", href: "/procurement" },
            { label: "Pitch Triage", href: "/pitch-triage" },
            { label: "PitchMirror", href: "/pitchmirror" },
            { label: "PortfolioMesh", href: "/portfolio-mesh" },
            { label: "PortfolioMesh Demo", href: "/portfolio-mesh/demo" },
            { label: "Contact", href: "/contact" },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center",
                padding: "11px 20px",
                fontSize: 13, fontWeight: 500, color: MUTED,
                textDecoration: "none",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLAnchorElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = MUTED;
              }}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* All nav items */}
        <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {NAV_ITEMS.map(item => {
            const active = isActivePath(item.href, currentPath);
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={onClose}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 20px",
                  textDecoration: "none",
                  background: active ? item.bg : "transparent",
                  borderLeft: active ? `3px solid ${item.color}` : "3px solid transparent",
                  transition: "background 0.15s, border-left-color 0.15s",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = item.bg;
                    (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = item.color;
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = "transparent";
                  }
                }}
              >
                <span style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: `${item.color}18`,
                  border: `1px solid ${item.color}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, flexShrink: 0,
                  filter: `drop-shadow(0 0 5px ${item.color}55)`,
                }}>
                  {item.icon}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: item.color,
                  textShadow: `0 0 10px ${item.color}44`,
                  letterSpacing: "0.01em",
                }}>
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>

        {/* User section */}
        <div style={{
          borderTop: `1px solid ${BORDER}`,
          padding: "12px 16px",
          flexShrink: 0,
        }}>
          {isAuthenticated ? (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 4px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 8,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: NAVY, flexShrink: 0,
                }}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{user?.name ?? "User"}</div>
                  {user?.email && <div style={{ fontSize: 11, color: MUTED }}>{user.email}</div>}
                </div>
              </div>
              {[
                { label: "My Workspace", href: "/persona-setup" },
                { label: "Billing",       href: "/account/billing" },
                { label: "Shared Reports", href: "/reports/history" },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  style={{
                    display: "block", padding: "9px 4px",
                    fontSize: 13, color: MUTED, textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
                >
                  {item.label} →
                </a>
              ))}
              {user?.role === "admin" && (
                <a
                  href="/admin/usage"
                  onClick={onClose}
                  style={{
                    display: "block", padding: "9px 4px",
                    fontSize: 13, color: "#F59E0B", textDecoration: "none",
                  }}
                >
                  ⚡ Usage Dashboard →
                </a>
              )}
              <button
                onClick={() => { onClose(); logout(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "9px 4px", background: "none", border: "none",
                  marginTop: 4,
                  fontSize: 13, color: "#EF4444", cursor: "pointer",
                  fontFamily: "inherit",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <a
              href={getLoginUrl()}
              style={{
                display: "block", textAlign: "center",
                padding: "10px 16px", borderRadius: 8,
                background: "linear-gradient(135deg, #7BA3D4, #4ADE80)",
                color: WHITE, fontSize: 13, fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Sign in →
            </a>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Overflow "More" dropdown ──────────────────────────────────────── */
interface MoreDropdownProps {
  items: NavItem[];
  currentPath: string;
}

function MoreDropdown({ items, currentPath }: MoreDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const hasActive = items.some(item => isActivePath(item.href, currentPath));

  return (
    <div
      ref={ref}
      style={{ position: "relative", height: "100%", display: "flex", alignItems: "stretch", flexShrink: 0 }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          height: "100%",
          padding: "0 14px",
          background: open || hasActive ? "rgba(255,255,255,0.06)" : "transparent",
          border: "none",
          borderRight: `1px solid ${BORDER}`,
          borderBottom: open || hasActive ? `3px solid ${CYAN}` : "3px solid transparent",
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5,
          color: open || hasActive ? WHITE : MUTED,
          fontSize: 12, fontWeight: 700,
          letterSpacing: "0.02em",
          transition: "background 0.15s, color 0.15s, border-bottom-color 0.15s",
          whiteSpace: "nowrap",
          outline: "none",
        }}
        onFocus={e => { (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${CYAN}44`; }}
        onBlur={e => { (e.currentTarget as HTMLButtonElement).style.outline = "none"; }}
      >
        More
        <span style={{
          fontSize: 9, opacity: 0.7,
          display: "inline-block",
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.15s",
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 1px)", right: 0,
          background: "#0d1525",
          border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: "6px 0",
          minWidth: 200, maxWidth: 240,
          maxHeight: "calc(100vh - 80px)",
          overflowY: "auto",
          zIndex: 200,
          boxShadow: "0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
        }}>
          {items.map(item => {
            const active = isActivePath(item.href, currentPath);
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 14px",
                  textDecoration: "none",
                  color: active ? item.color : MUTED,
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  background: active ? item.bg : "transparent",
                  borderLeft: active ? `2px solid ${item.color}` : "2px solid transparent",
                  transition: "background 0.12s, color 0.12s",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLAnchorElement).style.color = item.color;
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.color = MUTED;
                  }
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Desktop tab row with overflow detection ───────────────────────── */
interface TabRowProps {
  currentPath: string;
  activeHover: string | null;
  setActiveHover: (v: string | null) => void;
}

function DesktopTabRow({ currentPath, activeHover, setActiveHover }: TabRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(NAV_ITEMS.length);

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const available = containerRef.current.offsetWidth;
    // Reserve space for "More" button only if we'll need it
    const totalItemsWidth = NAV_ITEMS.length * TAB_ITEM_WIDTH;
    if (totalItemsWidth <= available) {
      setVisibleCount(NAV_ITEMS.length);
      return;
    }
    // Need "More" button — reserve its width
    const spaceForItems = available - MORE_BTN_WIDTH;
    const count = Math.max(0, Math.floor(spaceForItems / TAB_ITEM_WIDTH));
    setVisibleCount(count);
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [measure]);

  const visibleItems = NAV_ITEMS.slice(0, visibleCount);
  const overflowItems = NAV_ITEMS.slice(visibleCount);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex", alignItems: "stretch",
        flex: 1,
        overflow: "hidden", // prevent any horizontal overflow
        minWidth: 0,
      }}
    >
      {visibleItems.map(item => {
        const active = isActivePath(item.href, currentPath);
        const hovered = activeHover === item.label;
        const highlight = active || hovered;

        const words = item.label.split(" ");
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(" ");
        const line2 = words.length > 1 ? words.slice(mid).join(" ") : null;

        return (
          <a
            key={item.label}
            href={item.href}
            onMouseEnter={() => setActiveHover(item.label)}
            onMouseLeave={() => setActiveHover(null)}
            style={{
              position: "relative",
              display: "flex", flexDirection: "column",
              justifyContent: "center", alignItems: "flex-start",
              gap: 1, padding: "0 14px",
              minWidth: 80, maxWidth: 110,
              textDecoration: "none", cursor: "pointer",
              background: highlight ? item.bg : "transparent",
              borderRight: `1px solid ${BORDER}`,
              borderBottom: highlight ? `3px solid ${item.color}` : "3px solid transparent",
              transition: "background 0.18s, border-bottom-color 0.18s",
              flexShrink: 0,
            }}
          >
            <span style={{
              fontSize: 13, lineHeight: 1,
              filter: `drop-shadow(0 0 4px ${item.color}${highlight ? "cc" : "77"})`,
              transition: "filter 0.18s", marginBottom: 2,
            }}>
              {item.icon}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.01em",
              color: item.color,
              opacity: highlight ? 1 : 0.85,
              transition: "opacity 0.18s", lineHeight: 1.25,
              textShadow: `0 0 8px ${item.color}${highlight ? "88" : "44"}`,
            }}>
              {line1}
              {line2 && <><br />{line2}</>}
            </span>
          </a>
        );
      })}

      {/* "More" overflow dropdown — only shown when items overflow */}
      {overflowItems.length > 0 && (
        <MoreDropdown items={overflowItems} currentPath={currentPath} />
      )}
    </div>
  );
}

/* ─── Main SiteNav component ────────────────────────────────────────── */
interface SiteNavProps {
  isLandingPage?: boolean;
}

export default function SiteNav({ isLandingPage = false }: SiteNavProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Unread signals count for Tools dropdown badge
  const { data: signalsData } = trpc.dealScreener.listSignals.useQuery(undefined, {
    refetchInterval: 60_000,
    enabled: !!user,
  });
  const unreadSignalCount = signalsData?.unreadCount ?? 0;

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  // Close desktop dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [currentPath]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* ── TOP BAR ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: `${NAVY}F5`,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: `1px solid ${BORDER}`,
          overflowX: "clip", // clip prevents horizontal bleed without clipping absolutely-positioned children below the bar
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch", height: 52, minWidth: 0 }}>

          {/* Logo + static links (always visible) */}
          <div style={{
            display: "flex", alignItems: "center",
            padding: "0 8px 0 14px",
            flexShrink: 0,
            borderRight: `1px solid ${BORDER}`,
            gap: 0,
          }}>
            <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", marginRight: isMobile ? 0 : 14 }}>
              <Logo size={26} />
            </a>

            {/* Desktop-only static links */}
            {!isMobile && [
              { label: "Domains", href: "/domains" },
              {
                label: "Contact",
                href: isLandingPage ? "#contact" : "/contact",
                scrollId: isLandingPage ? "contact" : undefined,
              },
            ].map(item => (
              <a
                key={item.label}
                href={item.href}
                onClick={item.scrollId
                  ? (e) => { e.preventDefault(); scrollTo(item.scrollId!); }
                  : undefined
                }
                style={{
                  color: MUTED, fontSize: 13, fontWeight: 500,
                  textDecoration: "none", padding: "0 10px",
                  height: "100%", display: "flex", alignItems: "center",
                  transition: "color 0.15s", whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = WHITE; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
              >
                {item.label}
              </a>
            ))}

            {/* Tools dropdown */}
            {!isMobile && (
              <div
                style={{ position: "relative", height: "100%", display: "flex", alignItems: "center" }}
                onMouseEnter={() => setToolsDropdownOpen(true)}
                onMouseLeave={() => setToolsDropdownOpen(false)}
              >
                <button
                  style={{
                    color: toolsDropdownOpen ? WHITE : MUTED,
                    fontSize: 13, fontWeight: 500,
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0 10px", height: "100%",
                    display: "flex", alignItems: "center", gap: 4,
                    transition: "color 0.15s", whiteSpace: "nowrap",
                  }}
                >
                  Tools
                  <span style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>▾</span>
                </button>
                {toolsDropdownOpen && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0,
                    background: "#0d1525",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10, padding: "8px 0",
                    minWidth: 220, zIndex: 200,
                    boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
                  }}>
                    {/* Group: Deal Intelligence */}
                    <div style={{ padding: "4px 14px 6px", fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.4)", letterSpacing: "0.12em" }}>
                      DEAL INTELLIGENCE
                    </div>
                    {[
                      { label: "Deal Screener", icon: "⚖️", href: "/deals", color: "#4ADE80", badge: unreadSignalCount > 0 ? unreadSignalCount : null },
                      { label: "Procurement Eval", icon: "🏗️", href: "/procurement", color: "#00ff87", badge: null },
                      { label: "Pitch Triage", icon: "⚡", href: "/pitch-triage", color: "#a78bfa", badge: null },
                      { label: "PitchMirror", icon: "🪞", href: "/pitchmirror", color: "#c084fc", badge: null },
                    ].map(tool => {
                      const isActive = currentPath.startsWith(tool.href);
                      return (
                        <a
                          key={tool.label}
                          href={tool.href}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 14px",
                            textDecoration: "none",
                            color: isActive ? tool.color : MUTED,
                            fontSize: 13, fontWeight: isActive ? 600 : 500,
                            background: isActive ? `${tool.color}12` : "transparent",
                            borderLeft: isActive ? `2px solid ${tool.color}` : "2px solid transparent",
                            transition: "background 0.12s, color 0.12s",
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                              (e.currentTarget as HTMLAnchorElement).style.color = tool.color;
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                              (e.currentTarget as HTMLAnchorElement).style.color = MUTED;
                            }
                          }}
                        >
                          <span style={{ fontSize: 14, opacity: isActive ? 1 : 0.7 }}>{tool.icon}</span>
                          <span style={{ flex: 1 }}>{tool.label}</span>
                          {tool.badge !== null && (
                            <span style={{
                              background: "#3B82F6", color: "#fff",
                              fontSize: 10, fontWeight: 700, borderRadius: 10,
                              padding: "1px 6px", lineHeight: "16px", minWidth: 18, textAlign: "center",
                            }}>{tool.badge}</span>
                          )}
                        </a>
                      );
                    })}
                    {/* Separator */}
                    <div style={{ height: 1, background: BORDER, margin: "6px 0" }} />
                    {/* Group: Portfolio */}
                    <div style={{ padding: "4px 14px 6px", fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.4)", letterSpacing: "0.12em" }}>
                      PORTFOLIO MANAGEMENT
                    </div>
                    {[
                      { label: "PortfolioMesh", icon: "🏦", href: "/portfolio-mesh", color: "#7BA3D4" },
                      { label: "PortfolioMesh Demo", icon: "🚀", href: "/portfolio-mesh/demo", color: "#F59E0B" },
                    ].map(tool => {
                      const isActive = currentPath === tool.href || (tool.href !== "/portfolio-mesh" && currentPath.startsWith(tool.href));
                      return (
                        <a
                          key={tool.label}
                          href={tool.href}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 14px",
                            textDecoration: "none",
                            color: isActive ? tool.color : MUTED,
                            fontSize: 13, fontWeight: isActive ? 600 : 500,
                            background: isActive ? `${tool.color}12` : "transparent",
                            borderLeft: isActive ? `2px solid ${tool.color}` : "2px solid transparent",
                            transition: "background 0.12s, color 0.12s",
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                              (e.currentTarget as HTMLAnchorElement).style.color = tool.color;
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                              (e.currentTarget as HTMLAnchorElement).style.color = MUTED;
                            }
                          }}
                        >
                          <span style={{ fontSize: 14, opacity: isActive ? 1 : 0.7 }}>{tool.icon}</span>
                          <span style={{ flex: 1 }}>{tool.label}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop tab row with overflow detection */}
          {!isMobile && (
            <DesktopTabRow
              currentPath={currentPath}
              activeHover={activeHover}
              setActiveHover={setActiveHover}
            />
          )}

          {/* Mobile: spacer */}
          {isMobile && <div style={{ flex: 1 }} />}

          {/* Right section: PlanBadge + Avatar/SignIn + (mobile) Hamburger */}
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            padding: "0 12px", flexShrink: 0,
            borderLeft: `1px solid ${BORDER}`,
          }}>
            <PlanUsageBadge />

            {/* Desktop avatar dropdown */}
            {!isMobile && (
              isAuthenticated ? (
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
                        { label: "My Workspace →",   href: "/persona-setup" },
                        { label: "Billing →",         href: "/account/billing" },
                        { label: "Shared Reports →",  href: "/reports/history" },
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
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.88"; (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.02)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; (e.currentTarget as HTMLAnchorElement).style.transform = "none"; }}
                >
                  Sign in →
                </a>
              )
            )}

            {/* Mobile hamburger button */}
            {isMobile && (
              <button
                onClick={() => setDrawerOpen(o => !o)}
                aria-label={drawerOpen ? "Close menu" : "Open menu"}
                aria-expanded={drawerOpen}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: drawerOpen ? "rgba(56,189,248,0.12)" : "transparent",
                  border: `1px solid ${drawerOpen ? CYAN + "44" : "transparent"}`,
                  borderRadius: 8, width: 36, height: 36,
                  cursor: "pointer", flexShrink: 0,
                  transition: "background 0.2s, border-color 0.2s",
                }}
              >
                <HamburgerIcon open={drawerOpen} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE DRAWER ────────────────────────────────────────────── */}
      {isMobile && (
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          currentPath={currentPath}
          isAuthenticated={isAuthenticated}
          user={user}
          logout={logout}
        />
      )}
    </>
  );
}
