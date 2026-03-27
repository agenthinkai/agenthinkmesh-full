/**
 * Contact.tsx — Book Demo contact form at /contact
 * Two-column layout: trust signals on left, form on right.
 * Calls trpc.contact.submit on submit.
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import SiteNav from "@/components/SiteNav";

// Replace with your real Calendly link once set up
const CALENDLY_URL = "https://calendly.com/farouq-agenthink/15min";

const NAVY = "#080D1A";
const CARD = "#0D1E35";
const BORDER = "rgba(56,189,248,0.15)";
const TEAL = "#38BDF8";
const GREEN = "#34D399";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";
const RED = "#F87171";
const INPUT_BG = "#0A1628";
const INPUT_BORDER = "rgba(56,189,248,0.2)";
const INPUT_FOCUS = "rgba(56,189,248,0.45)";

interface FormState {
  name: string;
  company: string;
  email: string;
  role: string;
  message: string;
}

interface FormErrors {
  name?: string;
  company?: string;
  email?: string;
  message?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim() || form.name.trim().length < 2) errors.name = "Full name is required";
  if (!form.company.trim()) errors.company = "Company is required";
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Valid email is required";
  if (!form.message.trim() || form.message.trim().length < 10) errors.message = "Please write at least 10 characters";
  return errors;
}

const inputStyle = (focused: boolean, hasError: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: `1px solid ${hasError ? RED : focused ? INPUT_FOCUS : INPUT_BORDER}`,
  background: INPUT_BG,
  color: WHITE,
  fontSize: 14,
  fontFamily: "Inter, system-ui, sans-serif",
  outline: "none",
  transition: "border-color 0.2s",
  boxSizing: "border-box" as const,
});

export default function Contact() {
  const [form, setForm] = useState<FormState>({ name: "", company: "", email: "", role: "", message: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showCalendly, setShowCalendly] = useState(false);

  // Dynamically load the Calendly widget script when the embed is revealed
  useEffect(() => {
    if (!showCalendly) return;
    if (document.getElementById("calendly-script")) return;
    const script = document.createElement("script");
    script.id = "calendly-script";
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.head.appendChild(script);
  }, [showCalendly]);

  const submitMutation = trpc.contact.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: () => setSubmitError("Something went wrong. Please email us at hello@agenthink.ai"),
  });

  function handleChange(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitError(null);
    submitMutation.mutate({
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      role: form.role.trim() || undefined,
      message: form.message.trim(),
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: WHITE, fontFamily: "Inter, system-ui, sans-serif" }}>
      <SiteNav />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 24px 100px" }}>

        {/* Breadcrumb */}
        <a href="/" style={{ color: MUTED, fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 32 }}>
          ← Back to platform
        </a>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 48,
          alignItems: "start",
        }}>

          {/* LEFT — Trust signals */}
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: WHITE, margin: "0 0 14px", lineHeight: 1.2 }}>
              Talk to the AgenThinkMesh team
            </h1>
            <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.7, margin: "0 0 36px" }}>
              We work with sovereign wealth funds, family offices, fund managers, and enterprise teams across Kuwait, Saudi Arabia, and UAE. Tell us about your use case.
            </p>

            {/* Trust signals */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "→ Response within 24 hours",
                "→ No sales pressure — we qualify together",
                "→ ADGM-registered · Kuwait · Saudi Arabia · UAE",
              ].map((line, i) => (
                <div key={i} style={{
                  fontSize: 14,
                  color: TEAL,
                  fontWeight: 500,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "rgba(56,189,248,0.06)",
                  border: "1px solid rgba(56,189,248,0.12)",
                }}>
                  {line}
                </div>
              ))}
            </div>

            {/* Contact info */}
            <div style={{ marginTop: 36, padding: "16px 18px", borderRadius: 10, background: CARD, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Direct contact
              </div>
              <div style={{ fontSize: 13, color: MUTED }}>
                <a href="mailto:hello@agenthink.ai" style={{ color: TEAL, textDecoration: "none" }}>hello@agenthink.ai</a>
              </div>
            </div>
          </div>

          {/* RIGHT — Form or success */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "28px 28px" }}>

            {submitted ? (
              /* Success state */
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: WHITE, margin: "0 0 12px" }}>
                  Message received.
                </h2>
                <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, margin: "0 0 24px" }}>
                  We'll be in touch within 24 hours. In the meantime, explore the platform in demo mode.
                </p>
                <a
                  href="/"
                  style={{
                    display: "inline-block",
                    padding: "10px 22px",
                    borderRadius: 8,
                    background: "rgba(56,189,248,0.12)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    color: TEAL,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  ← Back to platform
                </a>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ fontSize: 16, fontWeight: 700, color: WHITE, marginBottom: 20 }}>
                  Book a Demo
                </div>

                {/* Full Name */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Full Name <span style={{ color: RED }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => handleChange("name", e.target.value)}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    placeholder="Your full name"
                    style={inputStyle(focused === "name", !!errors.name)}
                  />
                  {errors.name && <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{errors.name}</div>}
                </div>

                {/* Company */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Company <span style={{ color: RED }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={e => handleChange("company", e.target.value)}
                    onFocus={() => setFocused("company")}
                    onBlur={() => setFocused(null)}
                    placeholder="Your company or fund name"
                    style={inputStyle(focused === "company", !!errors.company)}
                  />
                  {errors.company && <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{errors.company}</div>}
                </div>

                {/* Email */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Email <span style={{ color: RED }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => handleChange("email", e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    placeholder="you@company.com"
                    style={inputStyle(focused === "email", !!errors.email)}
                  />
                  {errors.email && <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{errors.email}</div>}
                </div>

                {/* Role */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Role
                  </label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={e => handleChange("role", e.target.value)}
                    onFocus={() => setFocused("role")}
                    onBlur={() => setFocused(null)}
                    placeholder="e.g. Portfolio Manager, CIO, Head of Operations"
                    style={inputStyle(focused === "role", false)}
                  />
                </div>

                {/* Message */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Message <span style={{ color: RED }}>*</span>
                  </label>
                  <textarea
                    value={form.message}
                    onChange={e => handleChange("message", e.target.value)}
                    onFocus={() => setFocused("message")}
                    onBlur={() => setFocused(null)}
                    placeholder="Tell us about your use case or the problem you want to solve"
                    rows={4}
                    style={{
                      ...inputStyle(focused === "message", !!errors.message),
                      resize: "vertical",
                      minHeight: 100,
                    }}
                  />
                  {errors.message && <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{errors.message}</div>}
                </div>

                {/* Submit error */}
                {submitError && (
                  <div style={{ fontSize: 13, color: RED, marginBottom: 14, padding: "10px 14px", background: "rgba(248,113,113,0.08)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)" }}>
                    {submitError}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: submitMutation.isPending
                      ? "rgba(52,211,153,0.3)"
                      : `linear-gradient(135deg, ${TEAL}, ${GREEN})`,
                    color: "#080D1A",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: submitMutation.isPending ? "not-allowed" : "pointer",
                    fontFamily: "Inter, system-ui, sans-serif",
                    transition: "opacity 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {submitMutation.isPending ? (
                    <>
                      <span style={{
                        width: 14, height: 14, borderRadius: "50%",
                        border: "2px solid rgba(8,13,26,0.3)",
                        borderTopColor: "#080D1A",
                        animation: "spin 0.7s linear infinite",
                        display: "inline-block",
                      }} />
                      Sending…
                    </>
                  ) : (
                    "Send Message →"
                  )}
                </button>

                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </form>
            )}
          </div>
        </div>

        {/* Calendly inline embed */}
        <div style={{ marginTop: 56 }}>
          {/* Toggle button */}
          {!showCalendly && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, color: MUTED, marginBottom: 16 }}>
                Prefer to pick a time directly?
              </p>
              <button
                onClick={() => setShowCalendly(true)}
                style={{
                  padding: "11px 28px",
                  borderRadius: 8,
                  border: `1px solid rgba(56,189,248,0.35)`,
                  background: "rgba(56,189,248,0.08)",
                  color: TEAL,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Inter, system-ui, sans-serif",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(56,189,248,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(56,189,248,0.08)")}
              >
                📅 Schedule a 15-minute call
              </button>
              <p style={{ fontSize: 11, color: "rgba(240,244,250,0.3)", marginTop: 8 }}>
                No sales pitch. We qualify together.
              </p>
            </div>
          )}

          {/* Calendly widget */}
          {showCalendly && (
            <div style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              overflow: "hidden",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>📅 Schedule a 15-minute call</span>
                <button
                  onClick={() => setShowCalendly(false)}
                  style={{
                    background: "none", border: "none", color: MUTED,
                    fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4,
                  }}
                  aria-label="Close calendar"
                >
                  ×
                </button>
              </div>
              {/* Calendly inline widget — replace CALENDLY_URL with your real link */}
              <div
                className="calendly-inline-widget"
                data-url={`${CALENDLY_URL}?hide_event_type_details=1&hide_gdpr_banner=1&background_color=0D1E35&text_color=F0F4FA&primary_color=38BDF8`}
                style={{ minWidth: 320, height: 630 }}
              />
            </div>
          )}
        </div>

        {/* Mobile responsive styles */}
        <style>{`
          @media (max-width: 700px) {
            .contact-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
