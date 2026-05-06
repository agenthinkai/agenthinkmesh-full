/**
 * MeshSidebar — Collapsible left sidebar for the authenticated AgenThink Mesh app shell.
 *
 * Expanded: 220px | Collapsed: 48px | Mobile (<768px): bottom nav bar
 *
 * Usage:
 *   <MeshSidebar>
 *     <YourPageContent />
 *   </MeshSidebar>
 */
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

// ── Constants ──────────────────────────────────────────────────────────────────
const EXPANDED_W = 220;
const COLLAPSED_W = 48;
const MOBILE_BREAKPOINT = 768;

const BG = "#0e0e10";
const SIDEBAR_BG = "#111114";
const BORDER = "rgba(255,255,255,0.07)";
const ACCENT = "#3b82f6"; // blue-500
const ACCENT_BG = "rgba(59,130,246,0.12)";
const TEXT = "#e2e8f0";
const MUTED = "#64748b";

interface NavItem {
  path: string;
  icon: string;
  label: string;
  exact?: boolean;
  adminOnly?: boolean;
  badge?: string;  // short pill text, e.g. "NEW"
  subItems?: { path: string; label: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { path: "/command-center", icon: "⚡", label: "Command", exact: true },
  { path: "/pitch-triage", icon: "📋", label: "Evaluate" },
  { path: "/deals", icon: "📁", label: "Pipeline" },
  { path: "/gcc-equities", icon: "📈", label: "GCC Equities", badge: "NEW" },
  { path: "/uae-realestate", icon: "🏢", label: "UAE Real Estate", badge: "NEW" },
  { path: "/mesh-intelligence", icon: "📊", label: "Intelligence" },
  {
    path: "/sado",
    icon: "🛡️",
    label: "SADO",
    badge: "NEW",
    subItems: [
      { path: "/sado",                 label: "Overview" },
      { path: "/sado/command-centre",  label: "Command Centre" },
      { path: "/sado/discovery",       label: "Discovery Layer" },
      { path: "/sado/knowledge-graph", label: "Knowledge Graph" },
      { path: "/sado/governance",      label: "Governance" },
      { path: "/sado/escalations",     label: "Escalations" },
      { path: "/sado/audit-trail",     label: "Audit Trail" },
    ],
  },
  { path: "/admin/usage", icon: "⚙️", label: "Admin", adminOnly: true },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function isActive(navPath: string, location: string, exact?: boolean) {
  if (exact) return location === navPath;
  return location.startsWith(navPath);
}

interface MeshSidebarProps {
  children: React.ReactNode;
}

export default function MeshSidebar({ children }: MeshSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("mesh_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const [sadoOpen, setSadoOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.startsWith("/sado");
  });
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();

  // ── NEW-badge dismiss on first visit ──────────────────────────────
  const SEEN_KEY = "seen_gcc_equities";
  const [seenGccEquities, setSeenGccEquities] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SEEN_KEY) === "1";
  });
  useEffect(() => {
    if (!seenGccEquities && location.startsWith("/gcc-equities")) {
      window.localStorage.setItem(SEEN_KEY, "1");
      setSeenGccEquities(true);
    }
  }, [location, seenGccEquities]);
  const navItems = NAV_ITEMS.map((item) =>
    item.path === "/gcc-equities"
      ? { ...item, badge: seenGccEquities ? undefined : "NEW" }
      : item,
  );
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const sidebarW = collapsed ? COLLAPSED_W : EXPANDED_W;

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("mesh_sidebar_collapsed", next ? "1" : "0"); } catch { /* noop */ }
  }

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  // ── Mobile: bottom nav ─────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG }}>
        {/* Page content */}
        <div style={{ flex: 1, paddingBottom: 64, overflowY: "auto" }}>
          {children}
        </div>
        {/* Bottom nav */}
        <nav
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, height: 56,
            background: SIDEBAR_BG, borderTop: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "space-around",
            zIndex: 50,
          }}
        >
          {navItems.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
            const active = isActive(item.path, location, item.exact);
            return (
              <Link key={item.path} href={item.path}>
                <div
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 2, padding: "4px 8px", borderRadius: 8,
                    color: active ? ACCENT : MUTED,
                    background: active ? ACCENT_BG : "transparent",
                    cursor: "pointer", minWidth: 44,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{item.label}</span>
                </div>
              </Link>
            );
          })}
          {/* Profile */}
          <button
            onClick={() => logoutMutation.mutate()}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 2, padding: "4px 8px", borderRadius: 8,
              color: MUTED, background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "rgba(59,130,246,0.2)", color: ACCENT,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
              }}
            >
              {initials}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600 }}>Sign out</span>
          </button>
        </nav>
      </div>
    );
  }

  // ── Desktop: left sidebar ──────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG }}>
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarW, minWidth: sidebarW, maxWidth: sidebarW,
          background: SIDEBAR_BG, borderRight: `1px solid ${BORDER}`,
          display: "flex", flexDirection: "column",
          position: "sticky", top: 0, height: "100vh",
          transition: "width 0.18s ease, min-width 0.18s ease, max-width 0.18s ease",
          zIndex: 40, flexShrink: 0, overflowX: "hidden",
        }}
      >
        {/* Logo + collapse toggle */}
        <div
          style={{
            display: "flex", alignItems: "center",
            padding: collapsed ? "16px 0" : "16px 14px",
            justifyContent: collapsed ? "center" : "space-between",
            borderBottom: `1px solid ${BORDER}`, minHeight: 56,
          }}
        >
          {!collapsed && (
            <Link href="/command-center">
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0,
                  }}
                >
                  A
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>AgenThink</div>
                  <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.2 }}>Mesh</div>
                </div>
              </div>
            </Link>
          )}
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: MUTED, padding: 4, borderRadius: 4, lineHeight: 1,
              fontSize: 16, display: "flex", alignItems: "center",
            }}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
            const active = isActive(item.path, location, item.exact);
            const hasSub = !collapsed && item.subItems && item.subItems.length > 0;
            const isExpanded = hasSub && sadoOpen;

            if (hasSub) {
              // Expandable parent row (SADO)
              return (
                <div key={item.path}>
                  <div
                    title={collapsed ? item.label : undefined}
                    onClick={() => setSadoOpen((o) => !o)}
                    style={{
                      display: "flex", alignItems: "center",
                      gap: 10, padding: "10px 14px",
                      margin: "2px 6px", borderRadius: 8,
                      cursor: "pointer",
                      background: active ? ACCENT_BG : "transparent",
                      borderLeft: active ? `3px solid ${ACCENT}` : "3px solid transparent",
                      color: active ? ACCENT : TEXT,
                      fontWeight: active ? 600 : 400,
                      fontSize: 13,
                      transition: "background 0.12s, color 0.12s",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                        padding: "1px 5px", borderRadius: 4,
                        background: "rgba(245,158,11,0.18)", color: "#f59e0b",
                        flexShrink: 0,
                      }}>{item.badge}</span>
                    )}
                    <span style={{
                      fontSize: 10, color: MUTED, marginLeft: 2, flexShrink: 0,
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s",
                      display: "inline-block",
                    }}>›</span>
                  </div>
                  {/* Sub-items */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 8, paddingBottom: 4 }}>
                      {item.subItems!.map((sub) => {
                        const subActive = location === sub.path;
                        return (
                          <Link key={sub.path} href={sub.path}>
                            <div
                              style={{
                                display: "flex", alignItems: "center",
                                gap: 8, padding: "7px 14px 7px 28px",
                                margin: "1px 6px", borderRadius: 6,
                                cursor: "pointer",
                                background: subActive ? ACCENT_BG : "transparent",
                                borderLeft: subActive ? `2px solid ${ACCENT}` : "2px solid transparent",
                                color: subActive ? ACCENT : MUTED,
                                fontWeight: subActive ? 600 : 400,
                                fontSize: 12,
                                transition: "background 0.1s, color 0.1s",
                              }}
                            >
                              <span style={{
                                width: 4, height: 4, borderRadius: "50%",
                                background: subActive ? ACCENT : MUTED,
                                flexShrink: 0,
                              }} />
                              {sub.label}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular nav item
            return (
              <Link key={item.path} href={item.path}>
                <div
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: collapsed ? 0 : 10,
                    padding: collapsed ? "10px 0" : "10px 14px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    margin: "2px 6px", borderRadius: 8,
                    cursor: "pointer",
                    background: active ? ACCENT_BG : "transparent",
                    borderLeft: active ? `3px solid ${ACCENT}` : "3px solid transparent",
                    color: active ? ACCENT : TEXT,
                    fontWeight: active ? 600 : 400,
                    fontSize: 13,
                    transition: "background 0.12s, color 0.12s",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                      padding: "1px 5px", borderRadius: 4,
                      background: "rgba(245,158,11,0.18)", color: "#f59e0b",
                      flexShrink: 0,
                    }}>{item.badge}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Profile at bottom */}
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: collapsed ? "12px 0" : "12px 14px",
          }}
        >
          {collapsed ? (
            <button
              onClick={() => logoutMutation.mutate()}
              title="Sign out"
              style={{
                width: "100%", background: "transparent", border: "none",
                cursor: "pointer", display: "flex", justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(59,130,246,0.15)", color: ACCENT,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}
              >
                {initials}
              </div>
            </button>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(59,130,246,0.15)", color: ACCENT,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user?.name ?? user?.email ?? "User"}
                  </div>
                  {user?.name && (
                    <div style={{ fontSize: 10, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.email}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => logoutMutation.mutate()}
                style={{
                  width: "100%", background: "transparent", border: `1px solid ${BORDER}`,
                  borderRadius: 6, padding: "5px 0", cursor: "pointer",
                  color: MUTED, fontSize: 12, fontWeight: 500,
                  transition: "color 0.12s, border-color 0.12s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = TEXT; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, overflowX: "hidden", background: BG }}>
        {children}
      </main>
    </div>
  );
}
