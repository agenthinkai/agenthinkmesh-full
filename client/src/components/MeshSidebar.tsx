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
}

const NAV_ITEMS: NavItem[] = [
  { path: "/command-center", icon: "⚡", label: "Command", exact: true },
  { path: "/pitch-triage", icon: "📋", label: "Evaluate" },
  { path: "/deals", icon: "📁", label: "Pipeline" },
  { path: "/mesh-intelligence", icon: "📊", label: "Intelligence" },
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
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
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
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
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
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
            const active = isActive(item.path, location, item.exact);
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
                  {!collapsed && <span>{item.label}</span>}
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
