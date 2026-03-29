/**
 * ReportsHistory.tsx — Shared Report links management page
 * Shows all shared report links created by the authenticated user,
 * with view counts, expiry, and one-click revocation.
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ── Design tokens (matches DealScreener palette) ─────────────────────────────
const BG = "#0a0e1a";
const BG2 = "#0f1623";
const BORDER = "#1e2a3a";
const TEXT = "#e2e8f0";
const TEXT2 = "#8899aa";
const MUTED = "#4a5568";
const ACCENT = "#4a9eff";
const GREEN = "#00d4aa";
const RED = "#ff4444";
const PURPLE = "#a855f7";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatExpiry(ts: number) {
  const diff = ts - Date.now();
  if (diff <= 0) return "EXPIRED";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${days}d remaining`;
}

export default function ReportsHistory() {
  const { user, loading: authLoading } = useAuth();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: reports, isLoading, refetch } = trpc.shareReport.list.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  const revokeMutation = trpc.shareReport.revoke.useMutation({
    onSuccess: () => {
      refetch();
      setRevoking(null);
    },
    onError: () => setRevoking(null),
  });

  const handleRevoke = (tokenHash: string) => {
    setRevoking(tokenHash);
    revokeMutation.mutate({ tokenHash });
  };

  // Raw token is never returned from the list endpoint for security.
  // Copy link is only available immediately after creating a share (on the report page).
  const handleCopyLink = async (tokenHash: string) => {
    // We can't reconstruct the URL from tokenHash alone — show a note instead
    await navigator.clipboard.writeText(`[Link available on the report page — token hash: ${tokenHash.slice(0, 8)}...]`);
    setCopiedToken(tokenHash);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, letterSpacing: "0.1em" }}>LOADING...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT2 }}>Login required to view shared reports.</div>
        <a href={getLoginUrl("/reports/history")} style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, textDecoration: "none", border: `1px solid ${ACCENT}`, padding: "8px 20px", borderRadius: 4 }}>
          LOGIN →
        </a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Inter', sans-serif" }}>
      {/* Nav bar */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/deals" style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, textDecoration: "none", letterSpacing: "0.08em" }}>
          ← DEAL SCREENER
        </Link>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.08em" }}>SHARED REPORTS</span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 8 }}>
            REPORT SHARING HISTORY
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>Shared Report Links</h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>
            Manage all report links you have shared. Links expire after 7 days by default. You can revoke any link at any time.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: 48, fontFamily: MONO, fontSize: 11, color: TEXT2, letterSpacing: "0.1em" }}>
            LOADING REPORTS...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!reports || reports.length === 0) && (
          <div style={{ textAlign: "center", padding: 64, background: BG2, borderRadius: 8, border: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: MONO, fontSize: 28, marginBottom: 12, opacity: 0.3 }}>↗</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, letterSpacing: "0.1em", marginBottom: 8 }}>NO SHARED REPORTS YET</div>
            <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>
              Run a deal screening and click "↗ SHARE" to create a shareable read-only link.
            </p>
            <Link href="/deals" style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, textDecoration: "none", border: `1px solid ${ACCENT}`, padding: "8px 20px", borderRadius: 4 }}>
              GO TO DEAL SCREENER →
            </Link>
          </div>
        )}

        {/* Reports table */}
        {!isLoading && reports && reports.length > 0 && (
          <div>
            {/* Summary row */}
            <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "TOTAL LINKS", value: reports.length },
                { label: "ACTIVE", value: reports.filter(r => !r.revokedAt && r.expiresAt > Date.now()).length, color: GREEN },
                { label: "EXPIRED / REVOKED", value: reports.filter(r => r.revokedAt || r.expiresAt <= Date.now()).length, color: MUTED },
                { label: "TOTAL VIEWS", value: reports.reduce((s, r) => s + (r.viewCount ?? 0), 0), color: ACCENT },
              ].map(stat => (
                <div key={stat.label} style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "12px 18px", minWidth: 120 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em", marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: stat.color ?? TEXT }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 110px 90px 80px 120px", gap: 0, borderBottom: `1px solid ${BORDER}`, padding: "10px 16px" }}>
                {["REPORT", "TYPE", "CREATED", "EXPIRES", "VIEWS", "ACTIONS"].map(h => (
                  <div key={h} style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {reports.map((report) => {
                const isActive = !report.revokedAt && report.expiresAt > Date.now();
                const isRevoked = !!report.revokedAt;
                const isExpired = !isRevoked && report.expiresAt <= Date.now();

                return (
                  <div
                    key={report.tokenHash}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 100px 110px 90px 80px 120px",
                      gap: 0,
                      padding: "12px 16px",
                      borderBottom: `1px solid ${BORDER}`,
                      opacity: isActive ? 1 : 0.55,
                      alignItems: "center",
                    }}
                  >
                    {/* Report name */}
                    <div>
                      <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, marginBottom: 2 }}>
                        {report.dealName ?? report.comparisonId ?? "Report"}
                      </div>
                      {isRevoked && (
                        <span style={{ fontFamily: MONO, fontSize: 9, color: RED, letterSpacing: "0.08em" }}>REVOKED</span>
                      )}
                      {isExpired && !isRevoked && (
                        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>EXPIRED</span>
                      )}
                      {isActive && (
                        <span style={{ fontFamily: MONO, fontSize: 9, color: GREEN, letterSpacing: "0.08em" }}>ACTIVE</span>
                      )}
                    </div>

                    {/* Type */}
                    <div style={{ fontFamily: MONO, fontSize: 10, color: report.reportType === "comparison" ? PURPLE : ACCENT }}>
                      {report.reportType === "comparison" ? "COMPARE" : "SINGLE"}
                    </div>

                    {/* Created */}
                    <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>
                      {formatDate(report.createdAt)}
                    </div>

                    {/* Expires */}
                    <div style={{ fontFamily: MONO, fontSize: 10, color: isActive ? TEXT2 : MUTED }}>
                      {isRevoked ? "—" : formatExpiry(report.expiresAt)}
                    </div>

                    {/* Views */}
                    <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT, fontWeight: 600 }}>
                      {report.viewCount ?? 0}
                      {report.lastViewedAt && (
                        <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, fontWeight: 400 }}>
                          last {formatDate(report.lastViewedAt)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6 }}>
                      {isActive && (
                        <>
                          <button
                            onClick={() => handleCopyLink(report.tokenHash)}
                            style={{
                              padding: "4px 10px", background: "none",
                              border: `1px solid ${copiedToken === report.tokenHash ? GREEN : BORDER}`,
                              color: copiedToken === report.tokenHash ? GREEN : TEXT2,
                              fontFamily: MONO, fontSize: 9, cursor: "pointer", borderRadius: 3,
                            }}
                          >{copiedToken === report.tokenHash ? "✓" : "⎘ COPY"}</button>
                          <button
                            onClick={() => handleRevoke(report.tokenHash)}
                            disabled={revoking === report.tokenHash}
                            style={{
                              padding: "4px 10px", background: "none",
                              border: `1px solid ${RED}44`,
                              color: RED,
                              fontFamily: MONO, fontSize: 9, cursor: "pointer", borderRadius: 3,
                              opacity: revoking === report.tokenHash ? 0.5 : 1,
                            }}
                          >{revoking === report.tokenHash ? "..." : "REVOKE"}</button>
                        </>
                      )}
                      {!isActive && (
                        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 11, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
              Revoked links immediately return a 410 Gone page. View counts are updated in real time.
              Links are rate-limited to 15 requests/min per IP.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
