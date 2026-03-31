/**
 * PaymentHistory.tsx — /account/payments
 * Bloomberg Terminal-style payment history page.
 * Shows: subscription status, Deal Screener one-time runs, Stripe invoices.
 */

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

// ── Design tokens (matches DealScreener) ─────────────────────────────────────
const BG     = "#070b12";
const BG2    = "#0d1421";
const BG3    = "#111827";
const BORDER = "#1e2d3d";
const ACCENT = "#4a9eff";
const GREEN  = "#00ff87";
const AMBER  = "#ff9f43";
const RED    = "#ff4757";
const MUTED  = "#4a5568";
const TEXT   = "#e2e8f0";
const TEXT2  = "#94a3b8";
const MONO   = "'IBM Plex Mono', 'Fira Code', 'JetBrains Mono', monospace";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cfg =
    s === "paid" || s === "used" || s === "succeeded" || s === "active"
      ? { color: GREEN, bg: "rgba(0,255,135,0.1)", border: "rgba(0,255,135,0.3)", label: s === "used" ? "USED" : "PAID" }
    : s === "pending" || s === "trialing"
      ? { color: AMBER, bg: "rgba(255,159,67,0.1)", border: "rgba(255,159,67,0.3)", label: "PENDING" }
    : s === "canceled" || s === "cancelled" || s === "expired" || s === "void"
      ? { color: MUTED, bg: "rgba(74,85,104,0.15)", border: "rgba(74,85,104,0.3)", label: "CANCELLED" }
    : s === "failed" || s === "past_due"
      ? { color: RED, bg: "rgba(255,71,87,0.1)", border: "rgba(255,71,87,0.3)", label: "FAILED" }
    : { color: TEXT2, bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)", label: s.toUpperCase() };

  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 3,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.08em",
    }}>
      {cfg.label}
    </span>
  );
}

function VerdictChip({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return <span style={{ color: MUTED, fontSize: 11 }}>—</span>;
  const cfg: Record<string, { color: string }> = {
    APPROVED: { color: GREEN },
    APPROVED_WITH_CONDITIONS: { color: ACCENT },
    REJECTED: { color: RED },
    VETOED: { color: RED },
  };
  const c = cfg[verdict] ?? { color: TEXT2 };
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, color: c.color, fontWeight: 700 }}>
      {verdict.replace(/_/g, " ")}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  if (!plan) return <span style={{ color: MUTED, fontSize: 11 }}>—</span>;
  const p = plan.toLowerCase();
  const color = p === "enterprise" ? AMBER : p === "professional" || p === "pro" ? GREEN : ACCENT;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 3,
      background: `${color}18`,
      border: `1px solid ${color}44`,
      color,
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {plan}
    </span>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      paddingBottom: 10,
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {title}
      </span>
      {count !== undefined && (
        <span style={{
          padding: "1px 7px",
          borderRadius: 10,
          background: "rgba(74,158,255,0.12)",
          border: "1px solid rgba(74,158,255,0.25)",
          color: ACCENT,
          fontFamily: MONO,
          fontSize: 10,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding: "28px 16px",
      textAlign: "center",
      color: MUTED,
      fontFamily: MONO,
      fontSize: 12,
      border: `1px dashed ${BORDER}`,
      borderRadius: 6,
    }}>
      {message}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PaymentHistory() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading, error } = trpc.billing.getPaymentHistory.useQuery(undefined, {
    enabled: !!user,
  });

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: MONO, color: ACCENT, fontSize: 13 }}>AUTHENTICATING…</span>
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl("/account/payments");
    return null;
  }

  // ── Subscription summary card ──────────────────────────────────────────────
  const sub = data?.subscription;
  const planLabel = sub?.plan ?? sub?.planTier ?? "starter";
  const tokensLeft = sub?.tokensRemaining ?? 0;
  const tokensTotal = sub?.tokensTotal ?? 50;
  const renewsAt = sub?.renewsAt ?? sub?.currentPeriodEnd;

  const paidDsRuns = (data?.dealScreenerPayments ?? []).filter(p => p.status === "paid" || p.status === "used");
  const dsCount = paidDsRuns.length;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT }}>
      {/* ── Top bar ── */}
      <div style={{
        borderBottom: `1px solid ${BORDER}`,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: BG2,
      }}>
        <Link href="/deals" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, cursor: "pointer" }}>
            ← DEAL SCREENER
          </span>
        </Link>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "0.1em" }}>
          PAYMENT HISTORY
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
          {user.name ?? user.email}
        </span>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* ── Loading ── */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 0", fontFamily: MONO, color: ACCENT, fontSize: 13 }}>
            LOADING PAYMENT DATA…
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{
            padding: "16px 20px",
            background: "rgba(255,71,87,0.08)",
            border: `1px solid rgba(255,71,87,0.3)`,
            borderRadius: 6,
            color: RED,
            fontFamily: MONO,
            fontSize: 12,
            marginBottom: 24,
          }}>
            Failed to load payment history: {error.message}
          </div>
        )}

        {data && (
          <>
            {/* ── Summary row ── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 32,
            }}>
              {[
                {
                  label: "CURRENT PLAN",
                  value: <PlanBadge plan={planLabel} />,
                },
                {
                  label: "TOKENS REMAINING",
                  value: (
                    <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: tokensLeft > 10 ? GREEN : RED }}>
                      {tokensLeft}
                      <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}> / {tokensTotal}</span>
                    </span>
                  ),
                },
                {
                  label: "DEAL RUNS PAID",
                  value: (
                    <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: ACCENT }}>
                      {dsCount}
                    </span>
                  ),
                },
                {
                  label: "TOTAL SPENT",
                  value: (
                    <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: AMBER }}>
                      {fmtUsd(data.totalSpent)}
                    </span>
                  ),
                },
                {
                  label: "NEXT RENEWAL",
                  value: (
                    <span style={{ fontFamily: MONO, fontSize: 13, color: TEXT2 }}>
                      {renewsAt ? fmt(renewsAt) : "—"}
                    </span>
                  ),
                },
              ].map((card, i) => (
                <div key={i} style={{
                  background: BG2,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  padding: "14px 16px",
                }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em", marginBottom: 8 }}>
                    {card.label}
                  </div>
                  {card.value}
                </div>
              ))}
            </div>

            {/* ── Upgrade CTA if on starter ── */}
            {(planLabel === "starter" || planLabel === "trial") && (
              <div style={{
                background: "rgba(74,158,255,0.06)",
                border: `1px solid rgba(74,158,255,0.2)`,
                borderRadius: 8,
                padding: "16px 20px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, fontWeight: 700, marginBottom: 4 }}>
                    UPGRADE TO PROFESSIONAL
                  </div>
                  <div style={{ fontSize: 12, color: TEXT2 }}>
                    Get 5,000 tokens/month, full PDF reports, and priority support for $49/mo.
                  </div>
                </div>
                <Link href="/pricing">
                  <button style={{
                    padding: "8px 20px",
                    background: ACCENT,
                    color: BG,
                    border: "none",
                    borderRadius: 5,
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}>
                    VIEW PLANS →
                  </button>
                </Link>
              </div>
            )}

            {/* ── Deal Screener Payments ── */}
            <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 20px", marginBottom: 24 }}>
              <SectionHeader title="Deal Screener Runs" count={data.dealScreenerPayments.length} />
              {data.dealScreenerPayments.length === 0 ? (
                <EmptyState message="No deal screening payments yet. Submit a deal to get started." />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {["DATE", "DEAL NAME", "VERDICT", "AMOUNT", "STATUS", "RECEIPT"].map(h => (
                          <th key={h} style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            color: MUTED,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            fontSize: 9,
                            whiteSpace: "nowrap",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.dealScreenerPayments.map((p, i) => (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: i < data.dealScreenerPayments.length - 1 ? `1px solid ${BORDER}` : "none",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = BG3)}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 12px", color: TEXT2, whiteSpace: "nowrap" }}>
                            {fmt(p.createdAt)}
                          </td>
                          <td style={{ padding: "10px 12px", color: TEXT, maxWidth: 200 }}>
                            {p.dealName ? (
                              p.dealId ? (
                                <Link href={`/deals?dealId=${p.dealId}`} style={{ color: ACCENT, textDecoration: "none" }}>
                                  {p.dealName}
                                </Link>
                              ) : p.dealName
                            ) : (
                              <span style={{ color: MUTED }}>Pending</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <VerdictChip verdict={p.verdict} />
                          </td>
                          <td style={{ padding: "10px 12px", color: GREEN, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {fmtUsd(p.amountUsd)}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <StatusBadge status={p.status} />
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {p.stripeSessionId ? (
                              <a
                                href={`https://dashboard.stripe.com/payments/${p.stripeSessionId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: ACCENT, fontSize: 10, textDecoration: "none" }}
                              >
                                STRIPE ↗
                              </a>
                            ) : (
                              <span style={{ color: MUTED }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Stripe Invoices (subscription) ── */}
            <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 20px", marginBottom: 24 }}>
              <SectionHeader title="Subscription Invoices" count={data.stripeInvoices.length} />
              {data.stripeInvoices.length === 0 ? (
                <EmptyState message={
                  sub?.stripeCustomerId
                    ? "No subscription invoices found."
                    : "No active subscription. Upgrade to Professional or Enterprise to see invoices here."
                } />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {["DATE", "BILLING PERIOD", "AMOUNT", "CURRENCY", "STATUS", "INVOICE"].map(h => (
                          <th key={h} style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            color: MUTED,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            fontSize: 9,
                            whiteSpace: "nowrap",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.stripeInvoices.map((inv, i) => (
                        <tr
                          key={inv.id}
                          style={{
                            borderBottom: i < data.stripeInvoices.length - 1 ? `1px solid ${BORDER}` : "none",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = BG3)}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 12px", color: TEXT2, whiteSpace: "nowrap" }}>
                            {fmt(new Date(inv.created * 1000))}
                          </td>
                          <td style={{ padding: "10px 12px", color: TEXT2, whiteSpace: "nowrap" }}>
                            {inv.periodStart && inv.periodEnd
                              ? `${fmt(new Date(inv.periodStart * 1000))} – ${fmt(new Date(inv.periodEnd * 1000))}`
                              : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: GREEN, fontWeight: 700 }}>
                            {fmtUsd(inv.amount)}
                          </td>
                          <td style={{ padding: "10px 12px", color: TEXT2 }}>
                            {inv.currency}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <StatusBadge status={inv.status} />
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {inv.hostedInvoiceUrl ? (
                              <a
                                href={inv.hostedInvoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: ACCENT, fontSize: 10, textDecoration: "none" }}
                              >
                                VIEW PDF ↗
                              </a>
                            ) : (
                              <span style={{ color: MUTED }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Local subscription payments ── */}
            {data.subscriptionPayments.length > 0 && (
              <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 20px" }}>
                <SectionHeader title="Subscription Payments" count={data.subscriptionPayments.length} />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {["DATE", "PLAN", "AMOUNT", "STATUS"].map(h => (
                          <th key={h} style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            color: MUTED,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            fontSize: 9,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.subscriptionPayments.map((p, i) => (
                        <tr
                          key={p.id}
                          style={{ borderBottom: i < data.subscriptionPayments.length - 1 ? `1px solid ${BORDER}` : "none" }}
                          onMouseEnter={e => (e.currentTarget.style.background = BG3)}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 12px", color: TEXT2 }}>{fmt(p.createdAt)}</td>
                          <td style={{ padding: "10px 12px" }}><PlanBadge plan={p.planTier} /></td>
                          <td style={{ padding: "10px 12px", color: GREEN, fontWeight: 700 }}>{fmtUsd(p.amountUsd)}</td>
                          <td style={{ padding: "10px 12px" }}><StatusBadge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
