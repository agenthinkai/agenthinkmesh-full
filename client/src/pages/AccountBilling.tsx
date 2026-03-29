/**
 * AccountBilling — /account/billing
 * Shows current plan, token balance, renewal date, and Stripe Customer Portal link.
 * Requires authentication.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const NAVY = "#080D1A";
const CARD = "#0D1E35";
const BORDER = "rgba(52,211,153,0.15)";
const GREEN = "#34D399";
const GOLD = "#F59E0B";
const TEAL = "#38BDF8";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";
const RED = "#F87171";

function planLabel(plan: string): string {
  if (plan === "professional") return "Professional";
  if (plan === "enterprise") return "Enterprise";
  return "Starter (Free)";
}

function planColor(plan: string): string {
  if (plan === "professional") return GREEN;
  if (plan === "enterprise") return GOLD;
  return TEAL;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function AccountBilling() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = getLoginUrl("/account/billing");
    }
  }, [user, authLoading]);

  const { data: stats, isLoading: statsLoading, refetch } = trpc.billing.getBillingStats.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: history, isLoading: historyLoading } = trpc.billing.getTokenHistory.useQuery(
    { limit: 10 },
    { enabled: !!user }
  );

  const portalMutation = trpc.billing.getBillingPortal.useMutation({
    onSuccess: (data) => {
      window.location.href = data.portalUrl;
    },
    onError: (err) => {
      alert(err.message || "Could not open billing portal. Please try again.");
    },
  });

  // Handle success redirect from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      // Refetch stats after successful subscription
      setTimeout(() => refetch(), 2000);
    }
  }, []);

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: MUTED, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const plan = stats?.plan ?? "starter";
  const tokensRemaining = stats?.tokensRemaining ?? 50;
  const tokensTotal = stats?.tokensTotal ?? 50;
  const usagePercent = stats?.usagePercent ?? 0;
  const renewsAt = stats?.renewsAt;
  const status = stats?.status ?? "active";
  const isPaid = plan === "professional" || plan === "enterprise";

  // Check for success param
  const isSuccess = new URLSearchParams(window.location.search).get("success") === "1";

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
      <SiteNav />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 100px" }}>

        {/* Success banner */}
        {isSuccess && (
          <div style={{
            background: "rgba(52,211,153,0.1)", border: `1px solid rgba(52,211,153,0.3)`,
            borderRadius: 12, padding: "16px 20px", marginBottom: 32,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>Subscription activated!</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
                Your tokens have been allocated. You can now run full Council sessions.
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: GREEN, marginBottom: 8 }}>
            Account
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: WHITE, margin: 0 }}>Billing & Usage</h1>
          <p style={{ fontSize: 14, color: MUTED, marginTop: 8 }}>
            Manage your subscription, monitor token usage, and access your Stripe billing portal.
          </p>
        </div>

        {statsLoading ? (
          <div style={{ color: MUTED, fontSize: 14 }}>Loading billing data…</div>
        ) : (
          <>
            {/* Plan card */}
            <div style={{
              background: CARD, border: isPaid ? `1px solid ${planColor(plan)}40` : `1px solid ${BORDER}`,
              borderRadius: 16, padding: "28px 24px", marginBottom: 20,
              boxShadow: isPaid ? `0 0 30px ${planColor(plan)}10` : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: planColor(plan), letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                    Current Plan
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: WHITE }}>{planLabel(plan)}</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    Status:{" "}
                    <span style={{ color: status === "active" ? GREEN : RED, fontWeight: 600 }}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                  {renewsAt && (
                    <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                      Renews: <span style={{ color: WHITE }}>{formatDate(renewsAt)}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                  {isPaid ? (
                    <button
                      onClick={() => portalMutation.mutate({ origin: window.location.origin })}
                      disabled={portalMutation.isPending}
                      style={{
                        padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        background: "rgba(52,211,153,0.1)", color: GREEN,
                        border: "1px solid rgba(52,211,153,0.3)", cursor: "pointer",
                        opacity: portalMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      {portalMutation.isPending ? "Opening…" : "Manage Billing →"}
                    </button>
                  ) : (
                    <a
                      href="/pricing"
                      style={{
                        padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        background: GREEN, color: "#080D1A", textDecoration: "none",
                        display: "inline-block",
                      }}
                    >
                      Upgrade Plan →
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Token usage card */}
            <div style={{
              background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 16, padding: "28px 24px", marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                Token Balance
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 36, fontWeight: 900, color: WHITE }}>{tokensRemaining.toLocaleString()}</span>
                  <span style={{ fontSize: 16, color: MUTED, marginLeft: 6 }}>/ {tokensTotal.toLocaleString()} tokens remaining</span>
                </div>
                <div style={{ fontSize: 13, color: MUTED }}>{usagePercent}% used</div>
              </div>

              {/* Progress bar */}
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, height: 8, overflow: "hidden" }}>
                <div style={{
                  width: `${usagePercent}%`, height: "100%", borderRadius: 8,
                  background: usagePercent > 85 ? RED : usagePercent > 60 ? GOLD : GREEN,
                  transition: "width 0.4s ease",
                }} />
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
                1 token = 1 agent call · 10 tokens = full 10-persona Council run
                {isPaid && renewsAt && (
                  <span> · Resets on {formatDate(renewsAt)}</span>
                )}
              </div>

              {tokensRemaining === 0 && (
                <div style={{
                  marginTop: 16, padding: "12px 16px", borderRadius: 8,
                  background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
                  fontSize: 13, color: RED,
                }}>
                  You've used all your tokens.{" "}
                  {isPaid ? (
                    <span>They'll renew on {formatDate(renewsAt)}.</span>
                  ) : (
                    <a href="/pricing" style={{ color: RED, fontWeight: 700 }}>Upgrade to get more →</a>
                  )}
                </div>
              )}
            </div>

            {/* Token history */}
            {history && history.length > 0 && (
              <div style={{
                background: CARD, border: `1px solid ${BORDER}`,
                borderRadius: 16, padding: "28px 24px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  Recent Token Usage
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.map((entry) => (
                    <div key={entry.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", borderRadius: 8,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <div>
                        <div style={{ fontSize: 13, color: WHITE, fontWeight: 600 }}>
                          {entry.action === "council_run" ? "Council Run" : entry.action}
                        </div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          {new Date(entry.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: RED }}>
                        -{entry.tokensUsed} tokens
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upgrade prompt for starter users */}
            {!isPaid && (
              <div style={{
                marginTop: 20, background: "rgba(52,211,153,0.05)",
                border: "1px solid rgba(52,211,153,0.15)", borderRadius: 16, padding: "28px 24px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, marginBottom: 8 }}>
                  Ready to unlock the full platform?
                </div>
                <p style={{ fontSize: 14, color: MUTED, marginBottom: 20 }}>
                  Professional gives you 5,000 tokens/month. Enterprise gives you 25,000 tokens/month with dedicated support.
                </p>
                <a
                  href="/pricing"
                  style={{
                    display: "inline-block", textDecoration: "none",
                    padding: "12px 28px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                    background: GREEN, color: "#080D1A",
                  }}
                >
                  View Plans →
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
