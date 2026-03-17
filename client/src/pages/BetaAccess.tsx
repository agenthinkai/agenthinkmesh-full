import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function BetaAccess() {
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    firm: "",
    role: "",
    email: "",
    linkedinUrl: "",
    useCase: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const requestBeta = trpc.workflow.requestBeta.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.firm.trim()) e.firm = "Firm is required";
    if (!form.role.trim()) e.role = "Role is required";
    if (!form.email.includes("@")) e.email = "Valid email required";
    if (form.useCase.trim().length < 10) e.useCase = "Please describe your use case (min 10 characters)";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    requestBeta.mutate({
      name: form.name,
      firm: form.firm,
      role: form.role,
      email: form.email,
      linkedinUrl: form.linkedinUrl || undefined,
      useCase: form.useCase,
    });
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050D1A",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "Inter, sans-serif",
    }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>

        {/* Logo + back */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <button onClick={() => navigate("/")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(240,244,250,0.4)", fontSize: 13, fontFamily: "Inter, sans-serif",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38BDF8", boxShadow: "0 0 8px #38BDF8" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#38BDF8", letterSpacing: "0.1em" }}>AGENTHINK MESH</span>
          </div>
        </div>

        {submitted ? (
          /* ── Success state ── */
          <div style={{
            background: "rgba(10,22,40,0.9)",
            border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 16,
            padding: 48,
            textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F0F4FA", margin: "0 0 12px" }}>Request Received</h2>
            <p style={{ fontSize: 14, color: "rgba(240,244,250,0.55)", lineHeight: 1.7, margin: "0 0 32px" }}>
              Thank you, {form.name}. Your beta access request for <strong style={{ color: "#F0F4FA" }}>{form.firm}</strong> has been submitted.
              Our team will review your application and respond within 48 hours.
            </p>
            <div style={{
              background: "rgba(74,222,128,0.05)",
              border: "1px solid rgba(74,222,128,0.15)",
              borderRadius: 8, padding: "12px 16px",
              fontSize: 12, color: "rgba(240,244,250,0.4)",
              fontFamily: "JetBrains Mono, monospace",
            }}>
              Reference: {form.email} · {new Date().toISOString().split("T")[0]}
            </div>
          </div>
        ) : (
          /* ── Request form ── */
          <div>
            {/* Header */}
            <div style={{ marginBottom: 40, textAlign: "center" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(56,189,248,0.08)",
                border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: 20, padding: "6px 14px",
                fontSize: 11, color: "#38BDF8", letterSpacing: "0.1em",
                marginBottom: 20,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#38BDF8", boxShadow: "0 0 6px #38BDF8" }} />
                PRIVATE BETA · INSTITUTIONAL ACCESS
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#F0F4FA", margin: "0 0 12px", lineHeight: 1.2 }}>
                Request Access to<br />
                <span style={{ color: "#38BDF8" }}>AgenThink Mesh</span>
              </h1>
              <p style={{ fontSize: 15, color: "rgba(240,244,250,0.5)", lineHeight: 1.7, margin: 0 }}>
                AgenThink Mesh is a stateful AI outcome engine for institutional users.<br />
                Access is restricted to approved organisations. Apply below.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{
              background: "rgba(10,22,40,0.9)",
              border: "1px solid rgba(56,189,248,0.12)",
              borderRadius: 16,
              padding: 40,
            }}>
              {/* Row: Name + Firm */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Field label="Full Name" error={errors.name}>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Dr. Sarah Al-Rashidi"
                    style={inputStyle(!!errors.name)}
                  />
                </Field>
                <Field label="Firm / Institution" error={errors.firm}>
                  <input
                    value={form.firm}
                    onChange={e => setForm(f => ({ ...f, firm: e.target.value }))}
                    placeholder="National Bank of Kuwait"
                    style={inputStyle(!!errors.firm)}
                  />
                </Field>
              </div>

              {/* Row: Role + Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Field label="Role / Title" error={errors.role}>
                  <input
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    placeholder="Head of Research"
                    style={inputStyle(!!errors.role)}
                  />
                </Field>
                <Field label="Work Email" error={errors.email}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="sarah@nbk.com"
                    style={inputStyle(!!errors.email)}
                  />
                </Field>
              </div>

              {/* LinkedIn */}
              <div style={{ marginBottom: 16 }}>
                <Field label="LinkedIn URL (optional)">
                  <input
                    value={form.linkedinUrl}
                    onChange={e => setForm(f => ({ ...f, linkedinUrl: e.target.value }))}
                    placeholder="https://linkedin.com/in/sarah-alrashidi"
                    style={inputStyle(false)}
                  />
                </Field>
              </div>

              {/* Use case */}
              <div style={{ marginBottom: 28 }}>
                <Field label="Describe your use case" error={errors.useCase}>
                  <textarea
                    value={form.useCase}
                    onChange={e => setForm(f => ({ ...f, useCase: e.target.value }))}
                    placeholder="We are a GCC fund manager looking to automate deal screening, compliance checks, and LP reporting using AI agents..."
                    rows={4}
                    style={{ ...inputStyle(!!errors.useCase), resize: "vertical", minHeight: 100 }}
                  />
                </Field>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={requestBeta.isPending}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background: requestBeta.isPending ? "rgba(56,189,248,0.3)" : "linear-gradient(135deg, #38BDF8, #0EA5E9)",
                  border: "none",
                  borderRadius: 10,
                  color: "#050D1A",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: requestBeta.isPending ? "not-allowed" : "pointer",
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "0.02em",
                  transition: "all 0.2s ease",
                }}
              >
                {requestBeta.isPending ? "Submitting…" : "Request Beta Access →"}
              </button>

              {requestBeta.isError && (
                <p style={{ marginTop: 12, fontSize: 13, color: "#F87171", textAlign: "center" }}>
                  {requestBeta.error?.message || "Submission failed. Please try again."}
                </p>
              )}

              <p style={{ marginTop: 20, fontSize: 12, color: "rgba(240,244,250,0.3)", textAlign: "center", lineHeight: 1.6 }}>
                Access is reviewed manually. Approved users receive credentials within 48 hours.<br />
                AgenThink Mesh is currently available to GCC institutional users only.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(240,244,250,0.5)", letterSpacing: "0.06em", marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
      {error && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#F87171" }}>{error}</p>}
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${hasError ? "rgba(248,113,113,0.5)" : "rgba(56,189,248,0.15)"}`,
    borderRadius: 8,
    color: "#F0F4FA",
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };
}
