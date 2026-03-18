import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import GateScreen from "@/components/GateScreen";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Simulated portfolio health metrics ────────────────────────────────────────
const SIMULATED_METRICS = [
  { label: "Concentration Risk", value: 72, threshold: 75, unit: "/100", color: "#F59E0B" },
  { label: "Liquidity Score", value: 58, threshold: 50, unit: "/100", color: "#4ADE80" },
  { label: "Oil Beta", value: 0.68, threshold: 0.5, unit: "β", color: "#F87171" },
  { label: "Drawdown YTD", value: -8.2, threshold: -10, unit: "%", color: "#F59E0B" },
  { label: "Mandate Drift", value: 12, threshold: 15, unit: "%", color: "#4ADE80" },
  { label: "Benchmark Gap", value: -5.1, threshold: -3, unit: "%", color: "#F87171" },
];

const ALERT_ICONS: Record<string, string> = {
  threshold_breach: "⚠",
  concentration: "🎯",
  liquidity: "💧",
  mandate_drift: "📐",
  drawdown: "📉",
  default: "🔔",
};

const THREAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-900/30", text: "text-red-300", border: "border-red-700/40" },
  medium: { bg: "bg-amber-900/30", text: "text-amber-300", border: "border-amber-700/40" },
  low: { bg: "bg-blue-900/30", text: "text-blue-300", border: "border-blue-700/40" },
};

function HeartbeatPulse({ status }: { status: "healthy" | "warning" | "critical" }) {
  const color =
    status === "healthy" ? "#4ADE80" : status === "warning" ? "#F59E0B" : "#F87171";
  return (
    <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
      {/* Outer ring */}
      <div
        className="absolute rounded-full animate-ping"
        style={{
          width: 56, height: 56,
          background: `${color}15`,
          border: `1px solid ${color}40`,
          animationDuration: status === "critical" ? "0.8s" : "2s",
        }}
      />
      {/* Inner circle */}
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: 40, height: 40,
          background: `${color}20`,
          border: `2px solid ${color}60`,
        }}
      >
        <span style={{ fontSize: 18 }}>
          {status === "healthy" ? "🛡️" : status === "warning" ? "⚠️" : "🚨"}
        </span>
      </div>
    </div>
  );
}

function MetricGauge({ label, value, threshold, unit, color }: typeof SIMULATED_METRICS[0]) {
  const isBreached = unit === "%" || unit === "β"
    ? (threshold < 0 ? value < threshold : value > threshold)
    : value > threshold;

  const displayValue = typeof value === "number" && value % 1 !== 0
    ? value.toFixed(2)
    : value;

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
        {isBreached && (
          <span className="text-xs text-amber-400 bg-amber-900/30 border border-amber-700/30 rounded px-1.5 py-0.5">
            BREACH
          </span>
        )}
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold" style={{ color }}>
          {displayValue}
        </span>
        <span className="text-sm text-slate-400 mb-0.5">{unit}</span>
      </div>
      <div className="text-xs text-slate-500 mt-1">
        Threshold: {threshold}{unit}
      </div>
    </div>
  );
}

export default function PortfolioGuardian() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [heartbeatTick, setHeartbeatTick] = useState(0);
  const [lastScan, setLastScan] = useState(new Date());
  const [simulatedStatus, setSimulatedStatus] = useState<"healthy" | "warning" | "critical">("warning");
  const [showAll, setShowAll] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: alerts, refetch: refetchAlerts } = trpc.portfolioIntel.getGuardianAlerts.useQuery(
    { includeAcknowledged: showAll },
    { enabled: !!user }
  );

  const acknowledgeMutation = trpc.portfolioIntel.acknowledgeAlert.useMutation({
    onSuccess: () => refetchAlerts(),
  });

  const startRunMutation = trpc.portfolioIntel.startRun.useMutation({
    onSuccess: (data) => {
      setLocation(`/portfolio/intel/run/${data.runType}/${data.runId}`);
    },
  });

  // Simulated heartbeat — frontend setInterval, no real polling
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setHeartbeatTick(t => t + 1);
      setLastScan(new Date());
      // Randomly vary simulated status for demo
      const rand = Math.random();
      setSimulatedStatus(rand < 0.1 ? "critical" : rand < 0.4 ? "warning" : "healthy");
    }, 8000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  if (loading) return null;
  if (!user) return <GateScreen />;

  const activeAlerts = alerts?.filter(a => !a.is_acknowledged) || [];
  const statusLabel =
    simulatedStatus === "healthy" ? "All Systems Normal" :
    simulatedStatus === "warning" ? "Threshold Breach Detected" :
    "Critical Risk Alert";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />

      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setLocation("/portfolio/intel")}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ← Portfolio Intelligence
                </button>
                <span className="text-slate-600">/</span>
                <span className="text-sm text-white font-medium">Guardian Mode</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Portfolio Guardian Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1">
                Always-on portfolio surveillance · Simulated heartbeat every 8s
              </p>
            </div>
            <Button
              onClick={() => startRunMutation.mutate({ runType: "guardian", inputText: "Guardian scan: check all portfolio thresholds and generate alerts for any breaches." })}
              disabled={startRunMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              {startRunMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning...
                </span>
              ) : "▶ Run Guardian Scan"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Status + Metrics */}
          <div className="lg:col-span-2 space-y-6">

            {/* Heartbeat Status Panel */}
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <HeartbeatPulse status={simulatedStatus} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-bold text-white">{statusLabel}</h2>
                      <Badge
                        className={`text-xs ${
                          simulatedStatus === "healthy"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : simulatedStatus === "warning"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-red-500/20 text-red-300 border-red-500/30"
                        }`}
                      >
                        {simulatedStatus.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400">
                      Last scan: {lastScan.toLocaleTimeString()} · Heartbeat #{heartbeatTick + 1}
                    </p>
                    <div className="flex gap-4 mt-3 text-xs text-slate-500">
                      <span>🤖 3 monitoring agents</span>
                      <span>⏱ 8s simulated interval</span>
                      <span>📊 6 active thresholds</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Grid */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                Portfolio Health Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {SIMULATED_METRICS.map(metric => (
                  <MetricGauge key={metric.label} {...metric} />
                ))}
              </div>
            </div>

            {/* Alert Feed */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Alert Feed
                  {activeAlerts.length > 0 && (
                    <span className="ml-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-2 py-0.5 text-xs">
                      {activeAlerts.length} active
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  {showAll ? "Show active only" : "Show all"}
                </button>
              </div>

              {alerts && alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((alert) => {
                    const threatStyle = THREAT_COLORS[alert.threat_level] || THREAT_COLORS.low;
                    const icon = ALERT_ICONS[alert.alert_type] || ALERT_ICONS.default;
                    return (
                      <div
                        key={alert.id}
                        className={`rounded-lg border p-4 ${threatStyle.bg} ${threatStyle.border} ${
                          alert.is_acknowledged ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-lg mt-0.5">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm font-semibold ${threatStyle.text}`}>
                                  {alert.title}
                                </span>
                                <Badge variant="outline" className={`text-xs ${threatStyle.text} border-current`}>
                                  {alert.threat_level?.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {alert.description}
                              </p>
                              {alert.recommended_action && (
                                <p className="text-xs text-slate-500 mt-1.5">
                                  → {alert.recommended_action}
                                </p>
                              )}
                              <p className="text-xs text-slate-600 mt-2">
                                {new Date(Number(alert.created_at)).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {!alert.is_acknowledged && (
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
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
                  <div className="text-3xl mb-3">🛡️</div>
                  <p className="text-slate-400 text-sm">No active alerts</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Run a Guardian Scan to generate real alerts from the pipeline
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Configuration + Quick Actions */}
          <div className="space-y-5">

            {/* Guardian Configuration */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Trigger Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Concentration Threshold", value: "25%", active: true },
                  { label: "Drawdown Alert", value: "-10%", active: true },
                  { label: "Oil Beta Limit", value: "0.50 β", active: true },
                  { label: "Mandate Drift", value: "15%", active: true },
                  { label: "Liquidity Floor", value: "50/100", active: false },
                  { label: "Benchmark Gap", value: "-3%", active: false },
                ].map(cfg => (
                  <div key={cfg.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{cfg.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-xs">{cfg.value}</span>
                      <span className={`w-2 h-2 rounded-full ${cfg.active ? "bg-emerald-400" : "bg-slate-600"}`} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-600 pt-2 border-t border-slate-700">
                  Configuration editing coming soon
                </p>
              </CardContent>
            </Card>

            {/* Monitoring Agents */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Monitoring Agents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { id: "PF-RS-001", name: "RiskModeler", status: "active", icon: "⚡" },
                  { id: "PF-RS-002", name: "ExposureMapper", status: "active", icon: "🗺️" },
                  { id: "PF-DM-004", name: "PortfolioGuardian", status: "active", icon: "🛡️" },
                ].map(agent => (
                  <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
                    <span className="text-lg">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{agent.name}</div>
                      <div className="text-xs text-slate-500">{agent.id}</div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm"
                  onClick={() => startRunMutation.mutate({
                    runType: "guardian",
                    inputText: "Guardian scan: check all portfolio thresholds and generate alerts for any breaches.",
                  })}
                  disabled={startRunMutation.isPending}
                >
                  ▶ Run Guardian Scan
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-sm border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => setLocation("/portfolio/intel")}
                >
                  ⚖️ IC Decision Engine
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-sm border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => startRunMutation.mutate({
                    runType: "crisis",
                    inputText: "Crisis simulation: 2008-style global recession scenario. Analyze worst-case drawdown and survival.",
                  })}
                  disabled={startRunMutation.isPending}
                >
                  ⚡ Run Crisis Simulation
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
