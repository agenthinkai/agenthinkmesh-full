import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import GateScreen from "@/components/GateScreen";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Design tokens ──────────────────────────────────────────────────────────────
const NAVY = "#0B1628";
const NAVY_CARD = "#0F1E35";
const NAVY_BORDER = "#1E3050";
const SILVER_50 = "#F0F4FA";
const SILVER_400 = "#94A3B8";
const SILVER_600 = "#4A5A72";
const EMERALD = "#10B981";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

// ── Alert type metadata ────────────────────────────────────────────────────────
const ALERT_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  gharar: { icon: "🎲", label: "Gharar (Uncertainty)", color: "#F59E0B" },
  riba: { icon: "💰", label: "Riba (Interest)", color: "#EF4444" },
  maysir: { icon: "🎰", label: "Maysir (Gambling)", color: "#EF4444" },
  non_halal_investment: { icon: "🚫", label: "Non-Halal Investment", color: "#EF4444" },
  shariah_compliance: { icon: "⚖️", label: "Shariah Compliance", color: "#F59E0B" },
  wakala_fee: { icon: "📋", label: "Wakala Fee Issue", color: "#F59E0B" },
  surplus_distribution: { icon: "📊", label: "Surplus Distribution", color: "#8B5CF6" },
  product_structure: { icon: "🏗️", label: "Product Structure", color: "#F59E0B" },
  default: { icon: "⚠️", label: "Compliance Alert", color: "#F59E0B" },
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: "bg-red-900/30", text: "text-red-300", border: "border-red-700/40", label: "CRITICAL" },
  warning: { bg: "bg-amber-900/30", text: "text-amber-300", border: "border-amber-700/40", label: "WARNING" },
  info: { bg: "bg-blue-900/30", text: "text-blue-300", border: "border-blue-700/40", label: "INFO" },
};

// ── Simulated compliance health metrics ───────────────────────────────────────
const COMPLIANCE_METRICS = [
  { label: "Gharar Level", value: "Acceptable", status: "ok", icon: "🎲" },
  { label: "Riba Exposure", value: "None Detected", status: "ok", icon: "💰" },
  { label: "Wakala Fee", value: "15% — Within Range", status: "ok", icon: "📋" },
  { label: "Investment Mix", value: "Sukuk 80% / Equity 20%", status: "warning", icon: "📊" },
  { label: "Surplus Distribution", value: "70/30 Split", status: "ok", icon: "⚖️" },
  { label: "AAOIFI Standard", value: "FAS 12 Compliant", status: "ok", icon: "✅" },
];

// ── Shariah Board Checklist ────────────────────────────────────────────────────
const SSB_CHECKLIST = [
  { item: "Product structure reviewed by SSB", done: true },
  { item: "Wakala fee within AAOIFI guidelines (max 30%)", done: true },
  { item: "Investment portfolio screened for halal compliance", done: true },
  { item: "Surplus distribution formula documented", done: true },
  { item: "Qard Hassan mechanism for deficit coverage", done: false },
  { item: "Annual SSB fatwa renewal", done: false },
  { item: "Retakaful arrangement with Shariah-compliant reinsurer", done: false },
];

function HeartbeatPulse({ status }: { status: "healthy" | "warning" | "critical" }) {
  const color = status === "healthy" ? EMERALD : status === "warning" ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
      <div
        className="absolute rounded-full animate-ping"
        style={{
          width: 48, height: 48,
          background: `${color}15`,
          border: `1px solid ${color}40`,
          animationDuration: status === "critical" ? "0.8s" : "2s",
        }}
      />
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: 36, height: 36,
          background: `${color}20`,
          border: `2px solid ${color}60`,
        }}
      >
        <span style={{ fontSize: 16 }}>
          {status === "healthy" ? "☪️" : status === "warning" ? "⚠️" : "🚨"}
        </span>
      </div>
    </div>
  );
}

export default function TakafulAlerts() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [showAll, setShowAll] = useState(false);
  const [heartbeatTick, setHeartbeatTick] = useState(0);
  const [lastScan, setLastScan] = useState(new Date());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: alerts, refetch } = trpc.insurance.getTakafulAlerts.useQuery(
    { includeAcknowledged: showAll },
    { enabled: !!user }
  );

  const acknowledgeMutation = trpc.insurance.acknowledgeAlert.useMutation({
    onSuccess: () => refetch(),
  });

  const startRunMutation = trpc.insurance.startRun.useMutation({
    onSuccess: (data) => {
      setLocation(`/insurance/run/${data.runType}/${data.runId}`);
    },
  });

  // Simulated heartbeat
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setHeartbeatTick(t => t + 1);
      setLastScan(new Date());
    }, 10000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  if (loading) return null;
  if (!user) return <GateScreen />;

  const activeAlerts = alerts?.filter(a => !a.isAcknowledged) || [];
  const criticalCount = activeAlerts.filter(a => a.severity === "critical").length;
  const overallStatus: "healthy" | "warning" | "critical" =
    criticalCount > 0 ? "critical" : activeAlerts.length > 0 ? "warning" : "healthy";

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: SILVER_50, fontFamily: FONT }}>
      <SiteNav />

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${NAVY_BORDER}`, background: `${NAVY_CARD}80` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <button
                  onClick={() => setLocation("/insurance")}
                  style={{ color: SILVER_600, fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  ← Insurance Intelligence
                </button>
                <span style={{ color: SILVER_600 }}>/</span>
                <span style={{ fontSize: 13, color: SILVER_50 }}>Takaful Compliance</span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: SILVER_50, margin: 0 }}>
                ☪️ Takaful Compliance Monitor
              </h1>
              <p style={{ fontSize: 13, color: SILVER_400, marginTop: 6 }}>
                Always-on Shariah compliance surveillance · AAOIFI standards · GCC Takaful market
              </p>
            </div>
            <Button
              onClick={() => startRunMutation.mutate({
                runType: "compliance",
                inputText: "Full Takaful compliance scan: review product structure, Wakala fee, investment mix, surplus distribution, and AAOIFI compliance.",
              })}
              disabled={startRunMutation.isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {startRunMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning...
                </span>
              ) : "▶ Run Compliance Scan"}
            </Button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" }}>

          {/* Left: Status + Alerts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Status Panel */}
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <HeartbeatPulse status={overallStatus} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-bold text-white">
                        {overallStatus === "healthy" ? "All Shariah Checks Passed" :
                         overallStatus === "warning" ? "Compliance Issues Detected" :
                         "Critical Shariah Violation"}
                      </h2>
                      <Badge className={`text-xs ${
                        overallStatus === "healthy"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : overallStatus === "warning"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-red-500/20 text-red-300 border-red-500/30"
                      }`}>
                        {overallStatus.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400">
                      Last scan: {lastScan.toLocaleTimeString()} · Heartbeat #{heartbeatTick + 1}
                    </p>
                    <div className="flex gap-4 mt-3 text-xs text-slate-500">
                      <span>🤖 3 compliance agents</span>
                      <span>📋 AAOIFI FAS 12 / FAS 26</span>
                      <span>⏱ 10s simulated interval</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Metrics Grid */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 16 }}>
                SHARIAH COMPLIANCE METRICS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {COMPLIANCE_METRICS.map(metric => (
                  <div
                    key={metric.label}
                    style={{
                      background: NAVY_CARD,
                      border: `1px solid ${metric.status === "warning" ? "#F59E0B40" : NAVY_BORDER}`,
                      borderRadius: 10, padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>{metric.icon}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                        color: metric.status === "ok" ? EMERALD : "#F59E0B",
                        background: metric.status === "ok" ? "#052E1640" : "#1C1A0040",
                        border: `1px solid ${metric.status === "ok" ? "#16A34A40" : "#CA8A0440"}`,
                        borderRadius: 4, padding: "2px 6px", fontFamily: MONO,
                      }}>
                        {metric.status === "ok" ? "OK" : "REVIEW"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_50, marginBottom: 4 }}>{metric.label}</div>
                    <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO }}>{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alert Feed */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_600, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 10 }}>
                  SHARIAH ALERT FEED
                  {activeAlerts.length > 0 && (
                    <span style={{
                      background: "#EF444420", color: "#F87171",
                      border: "1px solid #EF444430",
                      borderRadius: 12, padding: "2px 8px", fontSize: 10, fontFamily: MONO,
                    }}>
                      {activeAlerts.length} active
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAll(!showAll)}
                  style={{ fontSize: 11, color: SILVER_400, background: "none", border: "none", cursor: "pointer" }}
                >
                  {showAll ? "Show active only" : "Show all"}
                </button>
              </div>

              {alerts && alerts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {alerts.map((alert) => {
                    const alertMeta = ALERT_TYPE_META[alert.alertType] || ALERT_TYPE_META.default;
                    const severityStyle = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.warning;
                    return (
                      <div
                        key={alert.id}
                        className={`rounded-xl border p-4 ${severityStyle.bg} ${severityStyle.border} ${
                          alert.isAcknowledged ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-xl mt-0.5">{alertMeta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-sm font-semibold ${severityStyle.text}`}>
                                  {alert.title}
                                </span>
                                <Badge variant="outline" className={`text-xs ${severityStyle.text} border-current`}>
                                  {severityStyle.label}
                                </Badge>
                                <span style={{
                                  fontSize: 10, color: alertMeta.color,
                                  background: `${alertMeta.color}15`,
                                  border: `1px solid ${alertMeta.color}30`,
                                  borderRadius: 4, padding: "1px 6px",
                                  fontFamily: MONO,
                                }}>
                                  {alertMeta.label}
                                </span>
                              </div>
                              {alert.description && (
                                <p className="text-xs text-slate-400 leading-relaxed">{alert.description}</p>
                              )}
                              {alert.recommendedAction && (
                                <p className="text-xs text-slate-500 mt-1.5">
                                  → {alert.recommendedAction}
                                </p>
                              )}
                              <p className="text-xs text-slate-600 mt-2">
                                {new Date(Number(alert.createdAt)).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {!alert.isAcknowledged && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-slate-600 text-slate-400 hover:text-white shrink-0"
                              onClick={() => acknowledgeMutation.mutate({ alertId: alert.id })}
                              disabled={acknowledgeMutation.isPending}
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  background: NAVY_CARD, border: `1px solid ${NAVY_BORDER}`,
                  borderRadius: 16, padding: 40, textAlign: "center",
                }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>☪️</div>
                  <p style={{ color: SILVER_400, fontSize: 14 }}>No active Shariah alerts</p>
                  <p style={{ color: SILVER_600, fontSize: 12, marginTop: 6 }}>
                    Run a Takaful Compliance Scan to generate alerts from the pipeline
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: SSB Checklist + Quick Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Shariah Supervisory Board Checklist */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  SSB Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {SSB_CHECKLIST.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                      background: item.done ? "#052E16" : "#1E3050",
                      border: `1px solid ${item.done ? "#16A34A" : NAVY_BORDER}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, color: item.done ? EMERALD : SILVER_600,
                    }}>
                      {item.done ? "✓" : "○"}
                    </span>
                    <span style={{ color: item.done ? SILVER_400 : SILVER_600, fontSize: 12, lineHeight: 1.5 }}>
                      {item.item}
                    </span>
                  </div>
                ))}
                <p style={{ fontSize: 10, color: SILVER_600, paddingTop: 8, borderTop: `1px solid ${NAVY_BORDER}` }}>
                  {SSB_CHECKLIST.filter(i => i.done).length}/{SSB_CHECKLIST.length} items complete
                </p>
              </CardContent>
            </Card>

            {/* Compliance Agents */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Compliance Agents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { id: "IN-IN-002", name: "TakafulClassifier", icon: "☪️" },
                  { id: "IN-UW-002", name: "ShariaComplianceAgent", icon: "⚖️" },
                  { id: "IN-IN-001", name: "RiskIntakeParser", icon: "📄" },
                ].map(agent => (
                  <div key={agent.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 8,
                    background: "#0A1525", border: `1px solid ${NAVY_BORDER}`,
                  }}>
                    <span style={{ fontSize: 16 }}>{agent.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: SILVER_50 }}>{agent.name}</div>
                      <div style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO }}>{agent.id}</div>
                    </div>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: EMERALD }} className="animate-pulse" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm"
                  onClick={() => startRunMutation.mutate({
                    runType: "compliance",
                    inputText: "Full Takaful compliance scan: review product structure, Wakala fee, investment mix, surplus distribution, and AAOIFI compliance.",
                  })}
                  disabled={startRunMutation.isPending}
                >
                  ▶ Run Compliance Scan
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-sm border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => setLocation("/insurance")}
                >
                  📋 Underwriting Engine
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-sm border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => startRunMutation.mutate({
                    runType: "underwriting",
                    inputText: "Takaful product underwriting: Family Takaful with Wakala model. Review full compliance and pricing.",
                  })}
                  disabled={startRunMutation.isPending}
                >
                  ⚖️ Full Underwriting Run
                </Button>
              </CardContent>
            </Card>

            {/* Standards Reference */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Standards Reference
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { code: "AAOIFI FAS 12", desc: "General Takaful" },
                  { code: "AAOIFI FAS 26", desc: "Investment in Sukuk" },
                  { code: "AAOIFI SS 26", desc: "Insurance & Reinsurance" },
                  { code: "SAMA Takaful Reg.", desc: "Saudi Arabia" },
                  { code: "CBUAE Takaful Reg.", desc: "UAE" },
                  { code: "CBK Takaful Reg.", desc: "Kuwait" },
                ].map(std => (
                  <div key={std.code} style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 11, paddingBottom: 6,
                    borderBottom: `1px solid ${NAVY_BORDER}`,
                  }}>
                    <span style={{ color: "#A78BFA", fontFamily: MONO }}>{std.code}</span>
                    <span style={{ color: SILVER_600 }}>{std.desc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
