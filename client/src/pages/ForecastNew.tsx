/**
 * ForecastNew — create a new forecast at /forecast/new
 * Submits to trpc.forecast.create and redirects to the detail page.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import SiteNav from "@/components/SiteNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const NAVY = "#080D1A";
const CARD = "#0D1E35";
const BORDER = "rgba(52,211,153,0.15)";
const GREEN = "#34D399";
const GOLD = "#F59E0B";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";
const RED = "#F87171";

const FORECAST_TYPES = [
  {
    value: "deadline_risk",
    label: "Deadline Risk",
    icon: "⏱️",
    description: "Will this project, milestone, or initiative meet its deadline?",
    color: "#FB923C",
    example: "Will the ERP migration complete by Q3 2026?",
  },
  {
    value: "budget_risk",
    label: "Budget Risk",
    icon: "💰",
    description: "Will this project stay within its approved budget?",
    color: RED,
    example: "Will the cloud infrastructure project stay within the $2.4M budget?",
  },
  {
    value: "target_probability",
    label: "Target Probability",
    icon: "🎯",
    description: "What is the probability of achieving a specific business target or KPI?",
    color: GREEN,
    example: "Will we achieve 85% customer satisfaction score by year-end?",
  },
];

const BUSINESS_AREAS = [
  "Technology & IT", "Finance & Treasury", "Operations", "Sales & Revenue",
  "HR & Talent", "Legal & Compliance", "Marketing", "Supply Chain",
  "Product Development", "Customer Success", "M&A & Strategy", "Risk Management",
];

export default function ForecastNew() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const [selectedType, setSelectedType] = useState<string>("");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [threshold, setThreshold] = useState("");
  const [businessArea, setBusinessArea] = useState("");
  const [error, setError] = useState("");

  const createMutation = trpc.forecast.create.useMutation({
    onSuccess: (data: { forecastId: string }) => {
      navigate(`/forecast/${data.forecastId}`);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Failed to create forecast. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedType) { setError("Please select a forecast type."); return; }
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (!question.trim()) { setError("Please enter the forecast question."); return; }

    createMutation.mutate({
      title: title.trim(),
      forecastType: selectedType as "deadline_risk" | "budget_risk" | "target_probability",
      question: question.trim(),
      description: description.trim() || undefined,
      deadline: deadline || undefined,
      threshold: threshold ? parseFloat(threshold) : undefined,
      businessArea: businessArea || undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
        <SiteNav />
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <h2 style={{ color: GREEN }}>Sign in to create a forecast</h2>
          <a href={getLoginUrl()} style={{ color: GREEN }}>Sign In →</a>
        </div>
      </div>
    );
  }

  const selectedTypeConf = FORECAST_TYPES.find(t => t.value === selectedType);

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
      <SiteNav />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <a href="/forecast" style={{ color: MUTED, fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            ← Back to ForecastMesh
          </a>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: GREEN, margin: 0, marginBottom: 6 }}>
            New Forecast
          </h1>
          <p style={{ color: MUTED, margin: 0, fontSize: 14 }}>
            5 AI agents will analyse your scenario and return a probability consensus.
          </p>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Step 1: Type */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              1. Forecast Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {FORECAST_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setSelectedType(t.value);
                    if (!question) setQuestion(t.example);
                  }}
                  style={{
                    padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                    textAlign: "left", border: "2px solid",
                    borderColor: selectedType === t.value ? t.color : "rgba(255,255,255,0.1)",
                    background: selectedType === t.value ? `${t.color}15` : CARD,
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: selectedType === t.value ? t.color : WHITE, marginBottom: 4 }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Core fields */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px", marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              2. Forecast Details
            </label>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 6 }}>Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={selectedTypeConf ? `e.g. ${selectedTypeConf.label} — Q3 Initiative` : "Short descriptive title"}
                maxLength={255}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "#0A1628", border: "1px solid rgba(255,255,255,0.12)",
                  color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = GREEN; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />
            </div>

            {/* Question */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 6 }}>
                Forecast Question * <span style={{ color: MUTED, fontWeight: 400 }}>(resolve YES or NO)</span>
              </label>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder={selectedTypeConf?.example ?? "Will [outcome] happen by [date]?"}
                rows={3}
                maxLength={1000}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "#0A1628", border: "1px solid rgba(255,255,255,0.12)",
                  color: WHITE, fontSize: 14, outline: "none", resize: "vertical",
                  boxSizing: "border-box", fontFamily: "inherit",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = GREEN; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 6 }}>
                Context & Background <span style={{ color: MUTED, fontWeight: 400 }}>(optional — helps agents)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Provide relevant context: current status, key risks, dependencies, recent developments…"
                rows={4}
                maxLength={2000}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "#0A1628", border: "1px solid rgba(255,255,255,0.12)",
                  color: WHITE, fontSize: 14, outline: "none", resize: "vertical",
                  boxSizing: "border-box", fontFamily: "inherit",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = GREEN; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />
            </div>

            {/* Row: Business Area + Deadline */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 6 }}>Business Area</label>
                <select
                  value={businessArea}
                  onChange={e => setBusinessArea(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    background: "#0A1628", border: "1px solid rgba(255,255,255,0.12)",
                    color: businessArea ? WHITE : MUTED, fontSize: 14, outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">Select area…</option>
                  {BUSINESS_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 6 }}>
                  Target Deadline {selectedType === "deadline_risk" ? "*" : "(optional)"}
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    background: "#0A1628", border: "1px solid rgba(255,255,255,0.12)",
                    color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box",
                    colorScheme: "dark",
                  }}
                />
              </div>
            </div>

            {/* Threshold (budget/target only) */}
            {(selectedType === "budget_risk" || selectedType === "target_probability") && (
              <div>
                <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 6 }}>
                  {selectedType === "budget_risk" ? "Budget Threshold (USD)" : "Target KPI Value"}
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  placeholder={selectedType === "budget_risk" ? "e.g. 2400000" : "e.g. 85"}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    background: "#0A1628", border: "1px solid rgba(255,255,255,0.12)",
                    color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            )}
          </div>

          {/* Agent preview */}
          <div style={{
            background: "rgba(52,211,153,0.06)", border: `1px solid rgba(52,211,153,0.2)`,
            borderRadius: 10, padding: "14px 18px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 2 }}>
                5-Agent Consensus Engine
              </div>
              <div style={{ fontSize: 12, color: MUTED }}>
                Operations · Finance · Legal · Market Signals · Execution Risk — all running in parallel (~15s)
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 16,
              background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
              color: RED, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={createMutation.isPending}
            style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              background: createMutation.isPending ? "rgba(52,211,153,0.4)" : GREEN,
              color: NAVY, fontWeight: 800, fontSize: 15, cursor: createMutation.isPending ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
            }}
          >
            {createMutation.isPending ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                Running 5 agents… (~15 seconds)
              </span>
            ) : (
              "Run Forecast Analysis →"
            )}
          </button>

          {/* Confidence note */}
          {createMutation.isPending && (
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: MUTED }}>
              Operations · Finance · Legal · Market Signals · Execution Risk agents running in parallel…
            </div>
          )}
        </form>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
