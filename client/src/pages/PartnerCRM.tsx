/**
 * ETF Partner CRM
 * Lists partner institutions and allows submitting a partnership request.
 * Accessible at /etf/partners
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const PARTNER_TYPES = [
  { value: "asset_manager",   label: "Asset Manager" },
  { value: "custodian",       label: "Custodian Bank" },
  { value: "exchange",        label: "Stock Exchange" },
  { value: "regulator",       label: "Regulator / CMA" },
  { value: "index_provider",  label: "Index Provider" },
  { value: "law_firm",        label: "Law Firm" },
  { value: "auditor",         label: "Auditor" },
  { value: "other",           label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  prospect:      "#94A3B8",
  contacted:     "#38BDF8",
  in_discussion: "#C9A84C",
  partner:       "#4ADE80",
  declined:      "#F87171",
};

// Seed display institutions (shown when DB is empty)
const SEED_INSTITUTIONS = [
  { id: -1, name: "Boursa Kuwait",         type: "exchange",       country: "Kuwait", status: "in_discussion", contactName: "Partnerships Team", contactEmail: "partnerships@boursakuwait.com.kw" },
  { id: -2, name: "Kuwait Finance House",  type: "asset_manager",  country: "Kuwait", status: "prospect",      contactName: "—",                 contactEmail: "—" },
  { id: -3, name: "National Bank of Kuwait", type: "custodian",    country: "Kuwait", status: "prospect",      contactName: "—",                 contactEmail: "—" },
  { id: -4, name: "Capital Market Authority (CMA)", type: "regulator", country: "Kuwait", status: "contacted", contactName: "Regulatory Affairs", contactEmail: "info@cma.gov.kw" },
  { id: -5, name: "FTSE Russell",          type: "index_provider", country: "UK",     status: "prospect",      contactName: "—",                 contactEmail: "—" },
];

export default function PartnerCRM() {
  const [, navigate] = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    institutionName: "",
    contactName: "",
    contactEmail: "",
    role: "",
    partnerType: "asset_manager",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const partnersQuery = trpc.partner.list.useQuery();
  const requestMutation = trpc.partner.requestPartnership.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setError("");
    },
    onError: (e) => setError(e.message),
  });

  const institutions = (partnersQuery.data && partnersQuery.data.length > 0)
    ? partnersQuery.data
    : SEED_INSTITUTIONS;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.institutionName || !form.contactName || !form.contactEmail) {
      setError("Institution name, contact name, and email are required.");
      return;
    }
    requestMutation.mutate(form);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070D1A", color: "#F0F4FA", fontFamily: "Inter, sans-serif" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 24px",
        background: "#0A1628",
        borderBottom: "1px solid rgba(201,168,76,0.2)",
      }}>
        <button
          onClick={() => navigate("/agents/etf-studio")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px",
            background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 8, color: "#C9A84C", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          ETF Studio
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Partner Institutions CRM
          </span>
          <span style={{ fontSize: 10, color: "rgba(201,168,76,0.5)", marginLeft: 10, fontFamily: "monospace" }}>
            ETF LAUNCH STUDIO · BOURSA KUWAIT
          </span>
        </div>
        <button
          onClick={() => { setModalOpen(true); setSubmitted(false); setError(""); }}
          style={{
            padding: "8px 18px",
            background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)",
            borderRadius: 8, color: "#38BDF8", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}
        >
          + Request Partnership
        </button>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
            Partner Institutions
          </h1>
          <p style={{ fontSize: 14, color: "rgba(240,244,250,0.45)", maxWidth: 600, lineHeight: 1.7 }}>
            Key institutions required to launch the AgenThinkMesh Boursa Kuwait ETF — asset managers, custodians, regulators, index providers, and legal partners.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
          {[
            { label: "Total", value: institutions.length, color: "#38BDF8" },
            { label: "In Discussion", value: institutions.filter(i => i.status === "in_discussion").length, color: "#C9A84C" },
            { label: "Partners", value: institutions.filter(i => i.status === "partner").length, color: "#4ADE80" },
            { label: "Prospects", value: institutions.filter(i => i.status === "prospect").length, color: "#94A3B8" },
          ].map(stat => (
            <div key={stat.label} style={{
              padding: "14px 20px",
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${stat.color}20`,
              borderRadius: 12, minWidth: 100,
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "rgba(240,244,250,0.4)", fontFamily: "monospace", marginTop: 2 }}>{stat.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, overflow: "hidden",
        }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr 0.8fr 1.2fr 1.2fr 1fr",
            padding: "12px 20px",
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            fontSize: 10, fontFamily: "monospace", color: "rgba(240,244,250,0.35)",
            letterSpacing: "0.1em", textTransform: "uppercase",
          }}>
            <span>Institution</span>
            <span>Type</span>
            <span>Country</span>
            <span>Contact</span>
            <span>Email</span>
            <span>Status</span>
          </div>

          {/* Rows */}
          {institutions.map((inst, idx: number) => (
            <div key={inst.id} style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 0.8fr 1.2fr 1.2fr 1fr",
              padding: "14px 20px",
              borderBottom: idx < institutions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              alignItems: "center",
              transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "#F0F4FA" }}>{inst.name}</span>
              <span style={{ fontSize: 12, color: "rgba(240,244,250,0.55)" }}>
                {PARTNER_TYPES.find(t => t.value === inst.type)?.label ?? inst.type}
              </span>
              <span style={{ fontSize: 12, color: "rgba(240,244,250,0.45)" }}>{inst.country}</span>
              <span style={{ fontSize: 12, color: "rgba(240,244,250,0.55)" }}>{inst.contactName ?? "—"}</span>
              <span style={{ fontSize: 11, color: "rgba(56,189,248,0.7)", fontFamily: "monospace" }}>
                {inst.contactEmail && inst.contactEmail !== "—"
                  ? <a href={`mailto:${inst.contactEmail}`} style={{ color: "inherit", textDecoration: "none" }}>{inst.contactEmail}</a>
                  : "—"
                }
              </span>
              <span>
                <span style={{
                  fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                  color: STATUS_COLORS[inst.status] ?? "#94A3B8",
                  background: `${STATUS_COLORS[inst.status] ?? "#94A3B8"}15`,
                  border: `1px solid ${STATUS_COLORS[inst.status] ?? "#94A3B8"}30`,
                  borderRadius: 6, padding: "2px 8px",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {inst.status.replace("_", " ")}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Request Partnership Modal */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10000, padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0F1E35",
              border: "1px solid rgba(56,189,248,0.2)",
              borderRadius: 20, padding: 32,
              width: "100%", maxWidth: 520,
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            {submitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#4ADE80", marginBottom: 8 }}>Request Submitted</h3>
                <p style={{ fontSize: 14, color: "rgba(240,244,250,0.55)", lineHeight: 1.7 }}>
                  Your partnership request has been received. The AgenThinkMesh team will be in touch within 2 business days.
                </p>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{
                    marginTop: 24, padding: "10px 28px",
                    background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)",
                    borderRadius: 8, color: "#4ADE80", fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "Inter, sans-serif",
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>Request Partnership</h3>
                  <p style={{ fontSize: 13, color: "rgba(240,244,250,0.45)", lineHeight: 1.6 }}>
                    Submit your institution's details to explore a partnership with the AgenThinkMesh ETF Launch Studio.
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { key: "institutionName", label: "Institution Name *", placeholder: "e.g. Kuwait Finance House" },
                    { key: "contactName",     label: "Your Name *",         placeholder: "e.g. Ahmed Al-Rashid" },
                    { key: "contactEmail",    label: "Email Address *",     placeholder: "e.g. ahmed@kfh.com.kw" },
                    { key: "role",            label: "Your Role",           placeholder: "e.g. Head of Asset Management" },
                  ].map(field => (
                    <div key={field.key}>
                      <label style={{ fontSize: 11, color: "rgba(240,244,250,0.4)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                        {field.label}
                      </label>
                      <input
                        type={field.key === "contactEmail" ? "email" : "text"}
                        placeholder={field.placeholder}
                        value={form[field.key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        style={{
                          width: "100%", padding: "10px 14px",
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8, color: "#F0F4FA", fontSize: 13,
                          fontFamily: "Inter, sans-serif", outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}

                  {/* Partner type */}
                  <div>
                    <label style={{ fontSize: 11, color: "rgba(240,244,250,0.4)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                      Partnership Type
                    </label>
                    <select
                      value={form.partnerType}
                      onChange={e => setForm(f => ({ ...f, partnerType: e.target.value }))}
                      style={{
                        width: "100%", padding: "10px 14px",
                        background: "#0A1628", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8, color: "#F0F4FA", fontSize: 13,
                        fontFamily: "Inter, sans-serif", outline: "none",
                      }}
                    >
                      {PARTNER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label style={{ fontSize: 11, color: "rgba(240,244,250,0.4)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                      Message (optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Briefly describe your interest in partnering on the ETF launch..."
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      style={{
                        width: "100%", padding: "10px 14px",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8, color: "#F0F4FA", fontSize: 13,
                        fontFamily: "Inter, sans-serif", outline: "none", resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {error && (
                    <div style={{ fontSize: 13, color: "#F87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                      {error}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      style={{
                        flex: 1, padding: "11px 0",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8, color: "rgba(240,244,250,0.5)", fontSize: 14, fontWeight: 600,
                        cursor: "pointer", fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={requestMutation.isPending}
                      style={{
                        flex: 2, padding: "11px 0",
                        background: requestMutation.isPending ? "rgba(56,189,248,0.08)" : "rgba(56,189,248,0.15)",
                        border: "1px solid rgba(56,189,248,0.3)",
                        borderRadius: 8, color: "#38BDF8", fontSize: 14, fontWeight: 700,
                        cursor: requestMutation.isPending ? "not-allowed" : "pointer",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {requestMutation.isPending ? "Submitting…" : "Submit Request"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
