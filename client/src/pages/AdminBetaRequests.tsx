import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

type BetaStatus = "pending" | "approved" | "rejected";

const STATUS_COLOR: Record<BetaStatus, string> = {
  pending: "#FBBF24",
  approved: "#4ADE80",
  rejected: "#F87171",
};

const STATUS_BG: Record<BetaStatus, string> = {
  pending: "rgba(251,191,36,0.1)",
  approved: "rgba(74,222,128,0.1)",
  rejected: "rgba(248,113,113,0.1)",
};

export default function AdminBetaRequests() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"requests" | "orgs">("requests");
  const [filterStatus, setFilterStatus] = useState<BetaStatus | "all">("all");
  const [newDomain, setNewDomain] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);

  // Fetch beta requests
  const { data: requests, isLoading: reqLoading, refetch: refetchRequests } =
    trpc.workflow.listBetaRequests.useQuery();

  // Fetch organizations
  const { data: orgs, isLoading: orgsLoading, refetch: refetchOrgs } =
    trpc.workflow.listOrgs.useQuery();

  // Update beta request status
  const updateStatus = trpc.workflow.updateBetaStatus.useMutation({
    onSuccess: () => refetchRequests(),
  });

  // Add domain to whitelist
  const addOrg = trpc.workflow.addOrg.useMutation({
    onSuccess: () => {
      setNewDomain("");
      setNewOrgName("");
      setAddingDomain(false);
      refetchOrgs();
    },
  });

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050D1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid rgba(56,189,248,0.3)", borderTopColor: "#38BDF8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: "#050D1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F0F4FA", margin: "0 0 8px" }}>Admin Access Required</h2>
          <p style={{ fontSize: 14, color: "rgba(240,244,250,0.4)", margin: "0 0 24px" }}>This panel is restricted to admin users only.</p>
          <button onClick={() => navigate("/")} style={{ padding: "10px 20px", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, color: "#38BDF8", fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const filteredRequests = (requests ?? []).filter(r =>
    filterStatus === "all" ? true : r.status === filterStatus
  );

  const pendingCount = (requests ?? []).filter(r => r.status === "pending").length;

  return (
    <div style={{ minHeight: "100vh", background: "#050D1A", fontFamily: "Inter, sans-serif", color: "#F0F4FA" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Top bar */}
      <div style={{ height: 52, background: "rgba(5,13,26,0.95)", borderBottom: "1px solid rgba(56,189,248,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(240,244,250,0.4)", fontSize: 12, fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L3 6L8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Home
          </button>
          <span style={{ color: "rgba(240,244,250,0.15)" }}>›</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#38BDF8", letterSpacing: "0.08em" }}>ADMIN</span>
          <span style={{ color: "rgba(240,244,250,0.15)" }}>›</span>
          <span style={{ fontSize: 12, color: "rgba(240,244,250,0.6)" }}>Beta Access Requests</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pendingCount > 0 && (
            <div style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "3px 10px", fontSize: 11, color: "#FBBF24", fontWeight: 700 }}>
              {pendingCount} pending
            </div>
          )}
          <div style={{ fontSize: 11, color: "rgba(240,244,250,0.3)" }}>Logged in as {user.name}</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F0F4FA", margin: "0 0 6px" }}>Beta Access Management</h1>
          <p style={{ fontSize: 13, color: "rgba(240,244,250,0.4)", margin: 0 }}>Review institutional access requests and manage the domain whitelist for the Fortress Gateway.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "rgba(10,22,40,0.6)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {(["requests", "orgs"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer",
              background: activeTab === tab ? "rgba(56,189,248,0.12)" : "transparent",
              color: activeTab === tab ? "#38BDF8" : "rgba(240,244,250,0.4)",
              fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif",
              transition: "all 0.15s ease",
            }}>
              {tab === "requests" ? `Access Requests${pendingCount > 0 ? ` (${pendingCount})` : ""}` : "Domain Whitelist"}
            </button>
          ))}
        </div>

        {/* ── Requests Tab ── */}
        {activeTab === "requests" && (
          <div style={{ animation: "slideIn 0.2s ease" }}>
            {/* Filter bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["all", "pending", "approved", "rejected"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: "5px 14px", borderRadius: 6, border: `1px solid ${filterStatus === s ? "rgba(56,189,248,0.4)" : "rgba(56,189,248,0.1)"}`,
                  background: filterStatus === s ? "rgba(56,189,248,0.1)" : "transparent",
                  color: filterStatus === s ? "#38BDF8" : "rgba(240,244,250,0.4)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  textTransform: "capitalize",
                }}>
                  {s}
                </button>
              ))}
            </div>

            {reqLoading ? (
              <div style={{ textAlign: "center", padding: 48, color: "rgba(240,244,250,0.3)", fontSize: 13 }}>Loading requests…</div>
            ) : filteredRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "rgba(240,244,250,0.3)", fontSize: 13 }}>
                {filterStatus === "all" ? "No beta access requests yet." : `No ${filterStatus} requests.`}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredRequests.map((req: any) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onApprove={() => updateStatus.mutate({ id: req.id, status: "approved" })}
                    onReject={() => updateStatus.mutate({ id: req.id, status: "rejected" })}
                    isPending={updateStatus.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Domain Whitelist Tab ── */}
        {activeTab === "orgs" && (
          <div style={{ animation: "slideIn 0.2s ease" }}>
            {/* Add new org */}
            <div style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(56,189,248,0.12)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F0F4FA", margin: "0 0 16px" }}>Add Approved Domain</h3>
              {!addingDomain ? (
                <button onClick={() => setAddingDomain(true)} style={{ padding: "9px 18px", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, color: "#38BDF8", fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  + Add Domain
                </button>
              ) : (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <input
                    value={newOrgName}
                    onChange={e => setNewOrgName(e.target.value)}
                    placeholder="Organisation name (e.g. National Bank of Kuwait)"
                    style={{ flex: 2, minWidth: 200, padding: "9px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 8, color: "#F0F4FA", fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }}
                  />
                  <input
                    value={newDomain}
                    onChange={e => setNewDomain(e.target.value)}
                    placeholder="Domain (e.g. nbk.com)"
                    style={{ flex: 1, minWidth: 160, padding: "9px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 8, color: "#F0F4FA", fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }}
                  />
                  <button
                    onClick={() => addOrg.mutate({ name: newOrgName, domain: newDomain })}
                    disabled={!newDomain.trim() || !newOrgName.trim() || addOrg.isPending}
                    style={{ padding: "9px 18px", background: "linear-gradient(135deg, #38BDF8, #0EA5E9)", border: "none", borderRadius: 8, color: "#050D1A", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    {addOrg.isPending ? "Adding…" : "Add"}
                  </button>
                  <button onClick={() => setAddingDomain(false)} style={{ padding: "9px 14px", background: "transparent", border: "1px solid rgba(240,244,250,0.1)", borderRadius: 8, color: "rgba(240,244,250,0.4)", fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                    Cancel
                  </button>
                </div>
              )}
              {addOrg.isError && (
                <p style={{ marginTop: 8, fontSize: 12, color: "#F87171" }}>{addOrg.error?.message}</p>
              )}
            </div>

            {/* Org list */}
            {orgsLoading ? (
              <div style={{ textAlign: "center", padding: 48, color: "rgba(240,244,250,0.3)", fontSize: 13 }}>Loading organisations…</div>
            ) : !orgs || orgs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "rgba(240,244,250,0.3)", fontSize: 13 }}>No organisations in whitelist yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orgs.map((org: any) => (
                  <div key={org.id} style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏢</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F4FA" }}>{org.name}</div>
                        <div style={{ fontSize: 11, color: "#38BDF8", fontFamily: "JetBrains Mono, monospace" }}>{org.slug}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "rgba(240,244,250,0.4)", marginBottom: 2 }}>Daily token limit</div>
                        <div style={{ fontSize: 12, color: "#F0F4FA", fontFamily: "JetBrains Mono, monospace" }}>{(org.dailyTokenLimit ?? 0).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "rgba(240,244,250,0.4)", marginBottom: 2 }}>Used today</div>
                        <div style={{ fontSize: 12, color: org.dailyTokensUsed > org.dailyTokenLimit * 0.8 ? "#FBBF24" : "#4ADE80", fontFamily: "JetBrains Mono, monospace" }}>{(org.dailyTokensUsed ?? 0).toLocaleString()}</div>
                      </div>
                      <div style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: org.status === "active" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                        color: org.status === "active" ? "#4ADE80" : "#F87171",
                        border: `1px solid ${org.status === "active" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                        textTransform: "uppercase",
                      }}>
                        {org.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Request Card ──────────────────────────────────────────────────────────────

function RequestCard({ req, onApprove, onReject, isPending }: {
  req: any;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = req.status as BetaStatus;
  const date = req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div style={{ background: "rgba(10,22,40,0.8)", border: `1px solid ${status === "pending" ? "rgba(251,191,36,0.15)" : "rgba(56,189,248,0.1)"}`, borderRadius: 12, overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>👤</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F0F4FA" }}>{req.name}</span>
            <span style={{ fontSize: 11, color: "rgba(240,244,250,0.4)" }}>·</span>
            <span style={{ fontSize: 12, color: "rgba(240,244,250,0.6)" }}>{req.role}</span>
          </div>
          <div style={{ fontSize: 11, color: "#38BDF8" }}>{req.firm}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "rgba(240,244,250,0.3)" }}>{date}</span>
          <div style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: STATUS_BG[status], color: STATUS_COLOR[status], border: `1px solid ${STATUS_COLOR[status]}33`, textTransform: "uppercase" }}>
            {status}
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "rgba(240,244,250,0.3)" }}>
            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid rgba(56,189,248,0.06)" }}>
          <div style={{ paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(240,244,250,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 12, color: "#F0F4FA" }}>{req.email}</div>
            </div>
            {req.linkedinUrl && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(240,244,250,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>LinkedIn</div>
                <a href={req.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38BDF8", textDecoration: "none" }}>{req.linkedinUrl.replace("https://linkedin.com/in/", "@")}</a>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "rgba(240,244,250,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Use Case</div>
            <div style={{ fontSize: 13, color: "rgba(240,244,250,0.7)", lineHeight: 1.6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(56,189,248,0.08)", borderRadius: 8, padding: "10px 14px" }}>
              {req.useCase}
            </div>
          </div>
          {status === "pending" && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onApprove}
                disabled={isPending}
                style={{ padding: "9px 20px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 8, color: "#4ADE80", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >
                ✓ Approve
              </button>
              <button
                onClick={onReject}
                disabled={isPending}
                style={{ padding: "9px 20px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, color: "#F87171", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >
                ✗ Reject
              </button>
            </div>
          )}
          {status !== "pending" && (
            <div style={{ fontSize: 12, color: "rgba(240,244,250,0.3)" }}>
              This request has been {status}. No further action needed.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
