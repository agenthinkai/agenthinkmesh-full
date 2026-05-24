/**
 * ScenarioSimDashboard.tsx
 * Strategic Scenario Simulation Mode — Full Dashboard UI
 *
 * Sections:
 *   1. Decision Distribution (donut + bar)
 *   2. Failure Vector Ranking (ranked bar chart)
 *   3. Approval Pathway Matrix (pathway cards)
 *   4. Governance Heatmap (category grid)
 *   5. Variable Sensitivity Ranking (impact surface)
 */
import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

// ── Design tokens (matches DealScreener palette) ──────────────────────────────
const BG = "#070b12";
const BG2 = "#0d1421";
const BG3 = "#111827";
const BORDER = "#1e2d3d";
const ACCENT = "#4a9eff";
const GREEN = "#00ff87";
const AMBER = "#ff9f43";
const RED = "#ff4757";
const PURPLE = "#a855f7";
const MUTED = "#4a5568";
const TEXT = "#e2e8f0";
const TEXT2 = "#94a3b8";
const MONO = "'IBM Plex Mono', 'Fira Code', 'JetBrains Mono', monospace";
const TEAL = "#00d4aa";
const ORANGE = "#ff6b35";

// ── Types (mirrors server types) ──────────────────────────────────────────────
type SimMode = "quick" | "institutional" | "deep" | "infrastructure" | "extreme";

interface DecisionDistribution {
  approveCount: number;
  conditionalCount: number;
  rejectCount: number;
  approvePct: number;
  conditionalPct: number;
  rejectPct: number;
  totalScenarios: number;
  hardNoCount: number;
  hardNoPct: number;
}

interface FailureVector {
  dimensionKey: string;
  dimensionLabel: string;
  category: string;
  rejectionCount: number;
  rejectionContributionPct: number;
  avgApprovalDelta: number;
  escalationTriggerCount: number;
}

interface ApprovalPathway {
  rank: number;
  description: string;
  safeDimensions: string[];
  estimatedApprovalPct: number;
  scenarioCount: number;
}

interface GovernanceHeatmapCell {
  category: string;
  escalationCount: number;
  vetoCount: number;
  complianceCount: number;
  regulatoryFragilityScore: number;
  totalScenarios: number;
  escalationPct: number;
}

interface SensitivityEntry {
  rank: number;
  dimensionKey: string;
  dimensionLabel: string;
  category: string;
  avgDeltaWhenStressed: number;
  tippingPointSeverity: string | null;
  interactionScore: number;
  impactScore: number;
}

interface SimAggregation {
  decisionDistribution: DecisionDistribution | null;
  failureVectors: FailureVector[] | null;
  approvalPathways: ApprovalPathway[] | null;
  governanceHeatmap: GovernanceHeatmapCell[] | null;
  sensitivitySurface: SensitivityEntry[] | null;
  executiveSummary: string | null;
}

// ── Mode config ───────────────────────────────────────────────────────────────
const MODE_CONFIG: Record<SimMode, { label: string; count: number; tag: string; description: string; color: string; gated?: boolean; warningMessage?: string; costTier?: string }> = {
  quick:          { label: "Quick Stress",          count: 100,      tag: "100",  description: "Rapid sensitivity scan",                                    color: TEAL },
  institutional:  { label: "Institutional Stress",  count: 1000,     tag: "1k",   description: "Probabilistic approval mapping",                            color: ACCENT },
  deep:           { label: "Strategic Deep Stress",  count: 10000,   tag: "10k",  description: "Decision-surface analysis",                                 color: PURPLE },
  infrastructure: { label: "Infrastructure Scale",  count: 100000,   tag: "100k", description: "Continuous institutional stress testing",                   color: AMBER,  gated: true, costTier: "high",    warningMessage: "Infrastructure Scale mode runs 100,000 scenarios. This is a long-duration run with checkpointing and resumability. Estimated wall-clock time depends on RPM limits and worker configuration. Confirm only if you accept the cost and time implications." },
  extreme:        { label: "Extreme Scale",         count: 1000000,  tag: "1M",   description: "Extreme-scale stress testing across 1,000,000 strategic futures", color: RED, gated: true, costTier: "extreme", warningMessage: "You are about to launch Extreme Scale Simulation Mode. This may run for days depending on RPM limits and worker configuration. Confirm only if checkpointing, telemetry, and cost limits are acceptable." },
};

// ── Category colors ───────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  financial:   "#4a9eff",
  regulatory:  "#ff9f43",
  execution:   "#00d4aa",
  market:      "#a855f7",
  technology:  "#ff6b35",
  governance:  "#ff4757",
};

const CAT_LABEL: Record<string, string> = {
  financial:   "Financial",
  regulatory:  "Regulatory",
  execution:   "Execution",
  market:      "Market",
  technology:  "Technology",
  governance:  "Governance",
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

function SectionHeader({ label, badge }: { label: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.15em" }}>{label}</div>
      {badge && (
        <div style={{ fontFamily: MONO, fontSize: 8, color: ACCENT, background: "rgba(74,158,255,0.1)", border: `1px solid rgba(74,158,255,0.25)`, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.1em" }}>{badge}</div>
      )}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: BG2,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: "20px 22px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Section 1: Decision Distribution ─────────────────────────────────────────

function DecisionDistributionSection({ dist }: { dist: DecisionDistribution }) {
  const bars = [
    { label: "APPROVE",      pct: dist.approvePct,      count: dist.approveCount,      color: GREEN },
    { label: "CONDITIONAL",  pct: dist.conditionalPct,  count: dist.conditionalCount,  color: AMBER },
    { label: "REJECT",       pct: dist.rejectPct,       count: dist.rejectCount,       color: RED },
  ];

  return (
    <Card>
      <SectionHeader label="DECISION DISTRIBUTION" badge={`${dist.totalScenarios.toLocaleString()} SCENARIOS`} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Donut visual */}
        <div>
          <svg viewBox="0 0 120 120" width={120} height={120} style={{ display: "block", margin: "0 auto" }}>
            {(() => {
              const cx = 60, cy = 60, r = 44, strokeW = 14;
              const circumference = 2 * Math.PI * r;
              let offset = 0;
              return bars.map((b, i) => {
                const dash = (b.pct / 100) * circumference;
                const gap = circumference - dash;
                const el = (
                  <circle
                    key={i}
                    cx={cx} cy={cy} r={r}
                    fill="none"
                    stroke={b.color}
                    strokeWidth={strokeW}
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={-offset}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "60px 60px", opacity: 0.85 }}
                  />
                );
                offset += dash;
                return el;
              });
            })()}
            <text x="60" y="56" textAnchor="middle" fill={TEXT} fontSize="14" fontWeight="700" fontFamily={MONO}>{dist.approvePct}%</text>
            <text x="60" y="70" textAnchor="middle" fill={MUTED} fontSize="7" fontFamily={MONO}>APPROVE</text>
          </svg>
          {dist.hardNoPct > 0 && (
            <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 9, color: RED, marginTop: 6 }}>
              ⚠ {dist.hardNoPct}% HARD-NO TRIGGERS
            </div>
          )}
        </div>
        {/* Bar breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
          {bars.map(b => (
            <div key={b.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: b.color, letterSpacing: "0.08em" }}>{b.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT2 }}>{b.pct}% <span style={{ color: MUTED }}>({b.count.toLocaleString()})</span></span>
              </div>
              <div style={{ height: 5, background: "#1a2535", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${b.pct}%`, background: b.color, borderRadius: 3, opacity: 0.8, transition: "width 0.8s ease" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Section 2: Failure Vector Ranking ─────────────────────────────────────────

function FailureVectorSection({ vectors }: { vectors: FailureVector[] }) {
  const maxPct = Math.max(...vectors.map(v => v.rejectionContributionPct), 1);

  return (
    <Card>
      <SectionHeader label="FAILURE VECTOR RANKING" badge="REJECTION CAUSES" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vectors.slice(0, 6).map((v, i) => {
          const catKey = v.category.replace("category_", "");
          const color = CAT_COLOR[catKey] ?? ACCENT;
          return (
            <div key={v.dimensionKey}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED, width: 14 }}>#{i + 1}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT }}>{v.dimensionLabel}</span>
                  {v.escalationTriggerCount > 0 && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: RED, background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.25)", padding: "1px 5px", borderRadius: 2 }}>
                      {v.escalationTriggerCount} ESC
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: MONO, fontSize: 9, color: color }}>{v.rejectionContributionPct}%</span>
              </div>
              <div style={{ height: 4, background: "#1a2535", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(v.rejectionContributionPct / maxPct) * 100}%`, background: color, borderRadius: 2, opacity: 0.75, transition: "width 0.8s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Section 3: Approval Pathway Matrix ────────────────────────────────────────

function ApprovalPathwaySection({ pathways }: { pathways: ApprovalPathway[] }) {
  return (
    <Card>
      <SectionHeader label="APPROVAL PATHWAY MATRIX" badge="COMBINATIONS THAT APPROVE" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pathways.map((p, i) => (
          <div key={p.rank} style={{
            background: BG3,
            border: `1px solid ${i === 0 ? "rgba(0,255,135,0.25)" : BORDER}`,
            borderRadius: 6,
            padding: "12px 14px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: i === 0 ? GREEN : MUTED }}>PATHWAY #{p.rank}</span>
                {i === 0 && <span style={{ fontFamily: MONO, fontSize: 7, color: GREEN, background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.25)", padding: "1px 6px", borderRadius: 2 }}>STRONGEST</span>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: GREEN }}>{p.estimatedApprovalPct}%</div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED }}>APPROVAL RATE</div>
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, lineHeight: 1.6 }}>{p.description}</div>
            <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 8, color: MUTED }}>
              {p.scenarioCount.toLocaleString()} scenarios matched
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Section 4: Governance Heatmap ─────────────────────────────────────────────

function GovernanceHeatmapSection({ cells }: { cells: GovernanceHeatmapCell[] }) {
  return (
    <Card>
      <SectionHeader label="GOVERNANCE HEATMAP" badge="ESCALATION CLUSTERS" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {cells.map(cell => {
          const catKey = cell.category.replace("category_", "");
          const color = CAT_COLOR[catKey] ?? ACCENT;
          const fragility = cell.regulatoryFragilityScore;
          const fragColor = fragility >= 70 ? RED : fragility >= 40 ? AMBER : GREEN;
          return (
            <div key={cell.category} style={{
              background: BG3,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              padding: "10px 12px",
              borderTop: `2px solid ${color}`,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: color, letterSpacing: "0.1em", marginBottom: 6 }}>
                {CAT_LABEL[catKey] ?? catKey.toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED }}>Escalations</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: cell.escalationCount > 0 ? AMBER : TEXT2 }}>{cell.escalationCount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED }}>Vetoes</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: cell.vetoCount > 0 ? RED : TEXT2 }}>{cell.vetoCount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED }}>Fragility</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: fragColor, fontWeight: 700 }}>{fragility}/100</span>
                </div>
              </div>
              {/* Fragility bar */}
              <div style={{ height: 3, background: "#1a2535", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${fragility}%`, background: fragColor, borderRadius: 2, opacity: 0.8 }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Section 5: Variable Sensitivity Ranking ───────────────────────────────────

function SensitivitySurfaceSection({ entries }: { entries: SensitivityEntry[] }) {
  const maxScore = Math.max(...entries.map(e => e.impactScore), 1);

  return (
    <Card>
      <SectionHeader label="VARIABLE SENSITIVITY RANKING" badge="HIGHEST-IMPACT VARIABLES" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((e, i) => {
          const catKey = e.category.replace("category_", "");
          const color = CAT_COLOR[catKey] ?? ACCENT;
          const tippingLabel = e.tippingPointSeverity ? ` · TIPPING: ${e.tippingPointSeverity.toUpperCase()}` : "";
          return (
            <div key={e.dimensionKey}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED, width: 14 }}>#{e.rank}</span>
                  <div>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT }}>{e.dimensionLabel}</span>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: MUTED }}>{tippingLabel}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: color }}>{e.impactScore}</span>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: MUTED }}>/100</span>
                </div>
              </div>
              <div style={{ height: 4, background: "#1a2535", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(e.impactScore / maxScore) * 100}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}88)`,
                  borderRadius: 2,
                  transition: "width 0.8s ease",
                }} />
              </div>
              {e.interactionScore > 0.3 && (
                <div style={{ fontFamily: MONO, fontSize: 7, color: PURPLE, marginTop: 2 }}>
                  ⚡ Nonlinear interaction detected (score: {Math.round(e.interactionScore * 100)}%)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Executive Summary Banner ──────────────────────────────────────────────────

function ExecutiveSummaryBanner({ summary, totalScenarios, mode }: { summary: string; totalScenarios: number; mode: SimMode }) {
  const modeConfig = MODE_CONFIG[mode];
  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(74,158,255,0.08) 0%, rgba(168,85,247,0.06) 100%)`,
      border: `1px solid rgba(74,158,255,0.2)`,
      borderRadius: 8,
      padding: "16px 20px",
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, letterSpacing: "0.15em" }}>AI-GOVERNED STRATEGIC SIMULATION</div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: PURPLE, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", padding: "2px 7px", borderRadius: 3 }}>
          {modeConfig.label.toUpperCase()} · {totalScenarios.toLocaleString()} SCENARIOS
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, lineHeight: 1.7 }}>{summary}</div>
    </div>
  );
}

// ── Progress Indicator ────────────────────────────────────────────────────────

function SimulationProgress({ progressPct, mode, completedCount, targetCount }: {
  progressPct: number;
  mode: SimMode;
  completedCount: number;
  targetCount: number;
}) {
  const modeConfig = MODE_CONFIG[mode];
  return (
    <div style={{
      background: BG2,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: "20px 22px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, letterSpacing: "0.15em", marginBottom: 4 }}>
            PROBABILISTIC GOVERNANCE INTELLIGENCE
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>
            {modeConfig.label} — {completedCount.toLocaleString()} / {targetCount.toLocaleString()} scenarios
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: ACCENT }}>{progressPct}%</div>
      </div>
      <div style={{ height: 6, background: "#1a2535", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${progressPct}%`,
          background: `linear-gradient(90deg, ${ACCENT}, ${PURPLE})`,
          borderRadius: 3,
          transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, marginTop: 8 }}>
        Computational Investment Stress Analysis · Governed scenario variants · Audit-preserved
      </div>
    </div>
  );
}

// ── Main Dashboard Component ──────────────────────────────────────────────────

interface CompletedSimData {
  runId: string;
  mode: string;
  targetCount: number;
  completedAt: string;
  aggregation: SimAggregation;
}

interface ScenarioSimDashboardProps {
  dealId: string;
  dealName: string;
  dealText: string;
  /** If provided, load an existing run instead of starting a new one */
  existingRunId?: string;
  /** Called when a simulation completes (live or restored) — used to unlock Reports panel */
  onSimCompleted?: (data: CompletedSimData) => void;
}

export function ScenarioSimDashboard({ dealId, dealName, dealText, existingRunId, onSimCompleted }: ScenarioSimDashboardProps) {
  const [selectedMode, setSelectedMode] = useState<SimMode>("quick");
  const [runId, setRunId] = useState<string | null>(existingRunId ?? null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<number | null>(null);
  /** True when the current view was loaded via Restore Results (not a live run) */
  const [isRestored, setIsRestored] = useState(false);

  const handleRestore = useCallback((restoredRunId: string) => {
    setRunId(restoredRunId);
    setIsRunning(false);
    setIsRestored(true);
  }, []);

  const startRun = trpc.scenarioSim.startRun.useMutation();
  const { data: runStatus, refetch: refetchStatus } = trpc.scenarioSim.getRunStatus.useQuery(
    { runId: runId ?? "" },
    { enabled: !!runId, refetchInterval: runId && isRunning ? 3000 : false }
  );

  // Stop polling when complete; notify parent when aggregation is ready
  useEffect(() => {
    if (runStatus?.status === "completed" || runStatus?.status === "failed") {
      setIsRunning(false);
    }
    if (runStatus?.status === "completed" && runStatus.aggregation && onSimCompleted) {
      onSimCompleted({
        runId:       runStatus.runId,
        mode:        runStatus.mode,
        targetCount: runStatus.targetCount,
        completedAt: runStatus.completedAt ? String(runStatus.completedAt) : new Date().toISOString(),
        aggregation: runStatus.aggregation as SimAggregation,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus?.status, runStatus?.aggregation]);

  const [showGatedModal, setShowGatedModal] = useState(false);
  const [pendingGatedMode, setPendingGatedMode] = useState<SimMode | null>(null);

  const handleLaunch = async (confirmedGated = false) => {
    const cfg = MODE_CONFIG[selectedMode];
    // Show gated confirmation modal for infrastructure / extreme modes
    if (cfg.gated && !confirmedGated) {
      setPendingGatedMode(selectedMode);
      setShowGatedModal(true);
      return;
    }
    setShowGatedModal(false);
    setPendingGatedMode(null);
    setError(null);
    setIsRunning(true);
    try {
      const result = await startRun.mutateAsync({
        dealId,
        dealName,
        dealText: dealText.slice(0, 12000),
        mode: selectedMode,
        confirmedGated: cfg.gated ? true : undefined,
      });
      setRunId(result.runId);
      if (result.status === "completed" && result.aggregation) {
        setIsRunning(false);
      }
    } catch (err: any) {
      setError(err?.message ?? "Simulation failed");
      setIsRunning(false);
    }
  };

  const aggregation: SimAggregation | null = runStatus?.aggregation ?? null;
  const isComplete = runStatus?.status === "completed" && aggregation;

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, letterSpacing: "0.15em", marginBottom: 4 }}>
            STRATEGIC SCENARIO SIMULATION
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>
            Probabilistic Governance Intelligence
          </div>
        </div>
        {isComplete && (
          <div style={{ fontFamily: MONO, fontSize: 8, color: GREEN, background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.2)", padding: "4px 10px", borderRadius: 4 }}>
            ✓ SIMULATION COMPLETE · {runStatus?.targetCount?.toLocaleString()} SCENARIOS
          </div>
        )}
      </div>

      {/* Mode Selector (only shown before launch) */}
      {!runId && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.12em", marginBottom: 10 }}>
            SELECT SIMULATION SCALE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {(Object.keys(MODE_CONFIG) as SimMode[]).map(mode => {
              const cfg = MODE_CONFIG[mode];
              const isSelected = selectedMode === mode;
              // Convert hex color to RGB for rgba background
              const colorRgb: Record<SimMode, string> = {
                quick: "0,212,170", institutional: "74,158,255", deep: "168,85,247",
                infrastructure: "255,159,67", extreme: "255,71,87",
              };
              return (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  style={{
                    background: isSelected ? `rgba(${colorRgb[mode]},0.12)` : BG3,
                    border: `1px solid ${isSelected ? cfg.color : cfg.gated ? `rgba(${colorRgb[mode]},0.35)` : BORDER}`,
                    borderRadius: 6,
                    padding: "10px 8px",
                    cursor: "pointer",
                    textAlign: "center" as const,
                    transition: "all 0.2s",
                    position: "relative" as const,
                  }}
                >
                  {cfg.gated && (
                    <div style={{ position: "absolute", top: 4, right: 5, fontFamily: MONO, fontSize: 6, color: cfg.color, letterSpacing: "0.05em", opacity: 0.8 }}>⚠ GATED</div>
                  )}
                  <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: cfg.color, marginBottom: 3 }}>{cfg.tag}</div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: isSelected ? TEXT : TEXT2, marginBottom: 2 }}>{cfg.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED }}>{cfg.description}</div>
                  {cfg.costTier === "extreme" && (
                    <div style={{ fontFamily: MONO, fontSize: 6, color: RED, marginTop: 4, opacity: 0.7 }}>MULTI-DAY RUN</div>
                  )}
                  {cfg.costTier === "high" && (
                    <div style={{ fontFamily: MONO, fontSize: 6, color: AMBER, marginTop: 4, opacity: 0.7 }}>LONG-DURATION</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Launch button */}
          <button
            onClick={() => handleLaunch()}
            disabled={isRunning || startRun.isPending}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 0",
              background: isRunning ? "rgba(168,85,247,0.1)" : "rgba(168,85,247,0.15)",
              border: `1px solid ${PURPLE}`,
              borderRadius: 6,
              color: PURPLE,
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              cursor: isRunning ? "not-allowed" : "pointer",
              opacity: isRunning ? 0.6 : 1,
              transition: "all 0.2s",
            }}
          >
            {isRunning ? "⟳ LAUNCHING SIMULATION..." : `⚡ LAUNCH ${MODE_CONFIG[selectedMode].tag.toUpperCase()} SIMULATION →`}
          </button>

          {error && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: RED, marginTop: 8, padding: "8px 12px", background: "rgba(255,71,87,0.08)", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 4 }}>
              ✗ {error}
            </div>
          )}
        </div>
      )}

      {/* Gated Mode Confirmation Modal */}
      {showGatedModal && pendingGatedMode && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(7,11,18,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: BG2, border: `1px solid ${MODE_CONFIG[pendingGatedMode].color}`,
            borderRadius: 10, padding: "28px 32px", maxWidth: 520, width: "90%",
          }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MODE_CONFIG[pendingGatedMode].color, letterSpacing: "0.15em", marginBottom: 10 }}>
              ⚠ GATED MODE — CONFIRMATION REQUIRED
            </div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT, fontWeight: 700, marginBottom: 14 }}>
              {MODE_CONFIG[pendingGatedMode].label} ({MODE_CONFIG[pendingGatedMode].tag} Scenarios)
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, lineHeight: 1.7, marginBottom: 20 }}>
              {MODE_CONFIG[pendingGatedMode].warningMessage}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowGatedModal(false); setPendingGatedMode(null); }}
                style={{ flex: 1, padding: "10px 0", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 5, color: MUTED, fontFamily: MONO, fontSize: 9, cursor: "pointer" }}
              >
                CANCEL
              </button>
              <button
                onClick={() => handleLaunch(true)}
                style={{ flex: 2, padding: "10px 0", background: `rgba(${pendingGatedMode === "extreme" ? "255,71,87" : "255,159,67"},0.15)`, border: `1px solid ${MODE_CONFIG[pendingGatedMode].color}`, borderRadius: 5, color: MODE_CONFIG[pendingGatedMode].color, fontFamily: MONO, fontSize: 9, fontWeight: 700, cursor: "pointer" }}
              >
                I UNDERSTAND — LAUNCH {MODE_CONFIG[pendingGatedMode].tag} SIMULATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress indicator (while running) */}
      {runId && !isComplete && runStatus && (
        <div style={{ marginBottom: 20 }}>
          <SimulationProgress
            progressPct={runStatus.progressPct ?? 0}
            mode={runStatus.mode as SimMode}
            completedCount={runStatus.completedCount ?? 0}
            targetCount={runStatus.targetCount ?? 0}
          />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: ACCENT, animation: "pulse 1.5s infinite" }} />
              Governed scenario variants running · Audit trail preserved · Telemetry active
            </div>
          </div>
        </div>
      )}

      {/* Results Dashboard */}
      {isComplete && aggregation && (
        <div>
          {/* Executive Summary */}
          {aggregation.executiveSummary && (
            <ExecutiveSummaryBanner
              summary={aggregation.executiveSummary}
              totalScenarios={runStatus?.targetCount ?? 0}
              mode={runStatus?.mode as SimMode ?? "quick"}
            />
          )}

          {/* 5 Dashboard Sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Row 1: Decision Distribution */}
            {aggregation.decisionDistribution && (
              <DecisionDistributionSection dist={aggregation.decisionDistribution} />
            )}

            {/* Row 2: Failure Vectors + Approval Pathways side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {aggregation.failureVectors && aggregation.failureVectors.length > 0 && (
                <FailureVectorSection vectors={aggregation.failureVectors} />
              )}
              {aggregation.approvalPathways && aggregation.approvalPathways.length > 0 && (
                <ApprovalPathwaySection pathways={aggregation.approvalPathways} />
              )}
            </div>

            {/* Row 3: Governance Heatmap */}
            {aggregation.governanceHeatmap && aggregation.governanceHeatmap.length > 0 && (
              <GovernanceHeatmapSection cells={aggregation.governanceHeatmap} />
            )}

            {/* Row 4: Sensitivity Surface */}
            {aggregation.sensitivitySurface && aggregation.sensitivitySurface.length > 0 && (
              <SensitivitySurfaceSection entries={aggregation.sensitivitySurface} />
            )}
          </div>

          {/* Restored data banner */}
          {isRestored && (
            <div style={{
              marginTop: 12,
              padding: "8px 14px",
              background: "rgba(255,159,67,0.06)",
              border: "1px solid rgba(255,159,67,0.25)",
              borderRadius: 5,
              fontFamily: MONO,
              fontSize: 8,
              color: AMBER,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              ⚠ VIEWING RESTORED HISTORICAL DATA — Results loaded from a previous simulation run.
            </div>
          )}

          {/* Re-run button */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {isRestored && (
              <button
                onClick={() => { setRunId(null); setIsRunning(false); setIsRestored(false); }}
                style={{
                  background: "none",
                  border: `1px solid rgba(168,85,247,0.3)`,
                  color: PURPLE,
                  fontFamily: MONO,
                  fontSize: 9,
                  padding: "7px 16px",
                  borderRadius: 4,
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                }}
              >
                ⚡ RUN NEW SIMULATION
              </button>
            )}
            {!isRestored && (
              <button
                onClick={() => { setRunId(null); setIsRunning(false); setIsRestored(false); }}
                style={{
                  background: "none",
                  border: `1px solid ${BORDER}`,
                  color: TEXT2,
                  fontFamily: MONO,
                  fontSize: 9,
                  padding: "7px 16px",
                  borderRadius: 4,
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                }}
              >
                ↺ RUN NEW SIMULATION
              </button>
            )}
          </div>
        </div>
      )}

      {/* Simulation History Panel — always shown below results or launcher */}
      <SimulationHistoryPanel
        dealId={dealId}
        onRestore={handleRestore}
        activeRunId={runId}
      />
    </div>
  );
}

// ── Simulation History Panel ─────────────────────────────────────────────────

interface SimHistoryPanelProps {
  dealId: string;
  /** Called when user restores a historical run — sets the runId in the parent */
  onRestore: (runId: string) => void;
  /** The currently active runId so we can highlight it */
  activeRunId: string | null;
}

function SimulationHistoryPanel({ dealId, onRestore, activeRunId }: SimHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: runs, isLoading } = trpc.scenarioSim.listRunsForDeal.useQuery(
    { dealId },
    { enabled: open, staleTime: 15_000 }
  );

  const completedRuns = (runs ?? []).filter(r => r.status === "completed").slice(0, 5);

  const handleRestore = async (runId: string) => {
    setRestoringId(runId);
    try {
      // Pre-fetch the full run status so it's in the cache when the dashboard mounts
      await utils.scenarioSim.getRunStatus.fetch({ runId });
      onRestore(runId);
    } catch (e) {
      console.error("[SimHistory] Failed to restore run:", e);
    } finally {
      setRestoringId(null);
    }
  };

  const modeLabel = (mode: string) => {
    const map: Record<string, string> = {
      quick: "Quick (100)",
      institutional: "Institutional (1k)",
      deep: "Deep (10k)",
      infrastructure: "Infrastructure (100k)",
    };
    return map[mode] ?? mode;
  };

  const formatDate = (ts: string | Date | null | undefined) => {
    if (!ts) return "—";
    const d = typeof ts === "string" ? new Date(ts) : ts;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ marginTop: 20, borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: "100%",
          textAlign: "left" as const,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.15em" }}>
          PAST SIMULATIONS
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
          ▶
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {isLoading && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, padding: "12px 0" }}>Loading history…</div>
          )}
          {!isLoading && completedRuns.length === 0 && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, padding: "12px 0" }}>No completed simulations found for this deal.</div>
          )}
          {!isLoading && completedRuns.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Column headers */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 60px 60px 60px 80px 80px 100px",
                gap: 8,
                padding: "4px 10px",
                fontFamily: MONO,
                fontSize: 7,
                color: MUTED,
                letterSpacing: "0.1em",
                borderBottom: `1px solid ${BORDER}`,
              }}>
                <span>DATE / TIME</span>
                <span>MODE</span>
                <span>APPROVE</span>
                <span>COND.</span>
                <span>REJECT</span>
                <span>TOP FAILURE</span>
                <span>STATUS</span>
                <span></span>
              </div>

              {completedRuns.map(run => {
                const dd = run.decisionDistribution as DecisionDistribution | null;
                const isActive = run.runId === activeRunId;
                const isRestoring = restoringId === run.runId;

                return (
                  <div
                    key={run.runId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 60px 60px 60px 80px 80px 100px",
                      gap: 8,
                      padding: "8px 10px",
                      background: isActive ? "rgba(168,85,247,0.06)" : BG2,
                      border: `1px solid ${isActive ? "rgba(168,85,247,0.3)" : BORDER}`,
                      borderRadius: 5,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT2 }}>{formatDate(run.completedAt)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT }}>{modeLabel(run.mode)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: GREEN, fontWeight: 700 }}>{dd ? `${dd.approvePct}%` : "—"}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: AMBER, fontWeight: 700 }}>{dd ? `${dd.conditionalPct}%` : "—"}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: RED, fontWeight: 700 }}>{dd ? `${dd.rejectPct}%` : "—"}</span>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                      {run.executiveSummary ? run.executiveSummary.slice(0, 30) + "…" : "—"}
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: "0.08em",
                      color: isActive ? PURPLE : GREEN,
                      background: isActive ? "rgba(168,85,247,0.1)" : "rgba(0,255,135,0.08)",
                      border: `1px solid ${isActive ? "rgba(168,85,247,0.3)" : "rgba(0,255,135,0.2)"}`,
                      padding: "2px 6px", borderRadius: 3,
                    }}>
                      {isActive ? "ACTIVE" : "COMPLETE"}
                    </span>
                    <button
                      onClick={() => handleRestore(run.runId)}
                      disabled={isActive || isRestoring}
                      style={{
                        background: isActive ? "transparent" : "rgba(168,85,247,0.1)",
                        border: `1px solid ${isActive ? BORDER : "rgba(168,85,247,0.3)"}`,
                        color: isActive ? MUTED : PURPLE,
                        fontFamily: MONO,
                        fontSize: 8,
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: isActive ? "default" : "pointer",
                        letterSpacing: "0.06em",
                        opacity: isRestoring ? 0.6 : 1,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {isRestoring ? "⟳ LOADING…" : isActive ? "CURRENT" : "↺ RESTORE"}
                    </button>
                  </div>
                );
              })}

              {/* Restored data notice — shown when viewing a non-latest run */}
              {activeRunId && completedRuns.length > 0 && activeRunId !== completedRuns[0]?.runId && (
                <div style={{
                  marginTop: 6,
                  padding: "8px 12px",
                  background: "rgba(255,159,67,0.06)",
                  border: "1px solid rgba(255,159,67,0.25)",
                  borderRadius: 4,
                  fontFamily: MONO,
                  fontSize: 8,
                  color: AMBER,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  ⚠ VIEWING RESTORED HISTORICAL DATA — This is not the most recent simulation for this deal.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Toggle Component (used in DealForm) ───────────────────────────────────────

interface ScenarioSimToggleProps {
  enabled: boolean;
  onChange: (v: boolean) => void;
  selectedMode: SimMode;
  onModeChange: (m: SimMode) => void;
}

export function ScenarioSimToggle({ enabled, onChange, selectedMode, onModeChange }: ScenarioSimToggleProps) {
  return (
    <div style={{
      background: enabled ? "rgba(168,85,247,0.06)" : BG2,
      border: `1px solid ${enabled ? "rgba(168,85,247,0.3)" : BORDER}`,
      borderRadius: 8,
      padding: "14px 16px",
      transition: "all 0.2s",
    }}>
      {/* Toggle row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            onClick={() => onChange(!enabled)}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: enabled ? PURPLE : "#1a2535",
              border: `1px solid ${enabled ? PURPLE : BORDER}`,
              cursor: "pointer",
              position: "relative" as const,
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute" as const,
              top: 2,
              left: enabled ? 17 : 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: enabled ? "#fff" : MUTED,
              transition: "left 0.2s",
            }} />
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: enabled ? PURPLE : TEXT2, letterSpacing: "0.08em" }}>
              STRATEGIC SCENARIO SIMULATION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, marginTop: 1 }}>
              AI-Governed · Probabilistic Governance Intelligence
            </div>
          </div>
        </div>
        {enabled && (
          <div style={{ fontFamily: MONO, fontSize: 7, color: PURPLE, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", padding: "2px 7px", borderRadius: 3 }}>
            ACTIVE
          </div>
        )}
      </div>

      {/* Mode selector (shown when enabled) */}
      {enabled && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>
            SIMULATION SCALE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {(Object.keys(MODE_CONFIG) as SimMode[]).map(mode => {
              const cfg = MODE_CONFIG[mode];
              const isSelected = selectedMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => onModeChange(mode)}
                  style={{
                    background: isSelected ? `rgba(168,85,247,0.12)` : BG3,
                    border: `1px solid ${isSelected ? PURPLE : BORDER}`,
                    borderRadius: 5,
                    padding: "8px 4px",
                    cursor: "pointer",
                    textAlign: "center" as const,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: isSelected ? PURPLE : TEXT2 }}>{cfg.tag}</div>
                  <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, marginTop: 1 }}>{cfg.label.split(" ")[0]}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: MUTED, marginTop: 6 }}>
            {MODE_CONFIG[selectedMode].count.toLocaleString()} governed scenario variants · {MODE_CONFIG[selectedMode].description}
          </div>
        </div>
      )}
    </div>
  );
}
