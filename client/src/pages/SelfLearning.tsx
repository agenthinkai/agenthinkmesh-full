/**
 * SelfLearning.tsx — Self-Learning Loop Dashboard
 *
 * Displays:
 *   1. Agent weight leaderboard (meritocracy table)
 *   2. Decision memory history (paginated)
 *   3. Summary stats (accuracy, outcomes, verdict breakdown)
 *   4. Admin controls (manual trigger for outcome collection + critic agent)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ── Colour palette ────────────────────────────────────────────────────────────

const NAVY = "#080D1A";
const NAVY2 = "#0D1828";
const NAVY3 = "#111C2E";
const CYAN = "#38BDF8";
const GREEN = "#34D399";
const RED = "#F87171";
const AMBER = "#FBBF24";
const MUTED = "rgba(240,244,250,0.55)";
const WHITE = "#F0F4FA";
const BORDER = "rgba(56,189,248,0.12)";

// ── Verdict badge ─────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span style={{ color: MUTED }}>—</span>;
  const colors: Record<string, string> = {
    APPROVED: GREEN,
    APPROVED_WITH_CONDITIONS: AMBER,
    REJECTED: RED,
    VETOED: "#F97316",
    CORRECT: GREEN,
    INCORRECT: RED,
    PENDING: AMBER,
    SKIPPED: MUTED,
  };
  const col = colors[verdict] ?? MUTED;
  return (
    <span
      style={{
        color: col,
        background: `${col}18`,
        border: `1px solid ${col}40`,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
      }}
    >
      {verdict.replace(/_/g, " ")}
    </span>
  );
}

// ── Weight bar ────────────────────────────────────────────────────────────────

function WeightBar({ weight }: { weight: number }) {
  // Range: 0.3 → 2.0, default = 1.0
  const pct = ((weight - 0.3) / (2.0 - 0.3)) * 100;
  const col = weight > 1.2 ? GREEN : weight < 0.8 ? RED : CYAN;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 80,
          height: 6,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(2, pct)}%`,
            height: "100%",
            background: col,
            borderRadius: 3,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ color: col, fontWeight: 700, fontSize: 13, minWidth: 36 }}>
        {weight.toFixed(2)}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SelfLearning() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [historyPage, setHistoryPage] = useState(1);

  const { data: weights, isLoading: weightsLoading } =
    trpc.selfLearning.agentWeights.useQuery();
  const { data: history, isLoading: historyLoading } =
    trpc.selfLearning.decisionHistory.useQuery({ page: historyPage, pageSize: 15 });
  const { data: stats, isLoading: statsLoading } =
    trpc.selfLearning.stats.useQuery();

  const triggerOutcomes = trpc.selfLearning.triggerOutcomes.useMutation({
    onSuccess: () => toast.success("Outcome collection started in background"),
    onError: (e) => toast.error(e.message),
  });
  const triggerCritic = trpc.selfLearning.triggerCritic.useMutation({
    onSuccess: () => toast.success("Critic agent started in background"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: NAVY,
        color: WHITE,
        fontFamily: "'Inter', sans-serif",
        padding: "32px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>🧠</span>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: WHITE, margin: 0 }}>
            Self-Learning Loop
          </h1>
          <span
            style={{
              background: `${CYAN}18`,
              border: `1px solid ${CYAN}40`,
              color: CYAN,
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            LIVE
          </span>
        </div>
        <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>
          The Council evolves. Every decision is remembered, every outcome is scored, every agent's authority is earned.
        </p>
      </div>

      {/* Stats row */}
      {!statsLoading && stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {[
            {
              label: "Total Decisions",
              value: stats.totalDecisions.toLocaleString(),
              color: CYAN,
              icon: "📋",
            },
            {
              label: "Scored Outcomes",
              value: stats.totalScored.toLocaleString(),
              color: GREEN,
              icon: "✅",
            },
            {
              label: "Overall Accuracy",
              value: stats.overallAccuracy !== null ? `${stats.overallAccuracy}%` : "—",
              color: stats.overallAccuracy !== null && stats.overallAccuracy >= 60 ? GREEN : AMBER,
              icon: "🎯",
            },
            {
              label: "Avg Weight",
              value: stats.weightStats.avg !== null ? stats.weightStats.avg.toFixed(2) : "—",
              color: AMBER,
              icon: "⚖️",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: NAVY2,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "16px 20px",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <div
          style={{
            background: NAVY3,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: MUTED, fontSize: 13 }}>Admin Controls:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerOutcomes.mutate()}
            disabled={triggerOutcomes.isPending}
            style={{ borderColor: CYAN, color: CYAN, background: "transparent" }}
          >
            {triggerOutcomes.isPending ? "Running..." : "▶ Run Outcome Collector"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerCritic.mutate()}
            disabled={triggerCritic.isPending}
            style={{ borderColor: AMBER, color: AMBER, background: "transparent" }}
          >
            {triggerCritic.isPending ? "Running..." : "▶ Run Critic Agent"}
          </Button>
          <span style={{ color: MUTED, fontSize: 11 }}>
            Cron: Outcomes @ 02:00 UTC · Critic @ 03:00 UTC
          </span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="weights">
        <TabsList
          style={{
            background: NAVY2,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            marginBottom: 24,
          }}
        >
          <TabsTrigger value="weights">Agent Weights</TabsTrigger>
          <TabsTrigger value="history">Decision Memory</TabsTrigger>
          <TabsTrigger value="verdicts">Verdict Breakdown</TabsTrigger>
        </TabsList>

        {/* ── Agent Weights Tab ── */}
        <TabsContent value="weights">
          <div
            style={{
              background: NAVY2,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: WHITE, margin: 0 }}>
                Council Meritocracy — Agent Authority Weights
              </h2>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                Weights adjust ±0.1 per evaluation. Floor: 0.3 · Ceiling: 2.0 · Default: 1.0 · 30-day decay toward 1.0
              </p>
            </div>
            {weightsLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: MUTED }}>Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: BORDER }}>
                    <TableHead style={{ color: MUTED }}>Persona</TableHead>
                    <TableHead style={{ color: MUTED }}>Weight</TableHead>
                    <TableHead style={{ color: MUTED }}>Accuracy</TableHead>
                    <TableHead style={{ color: MUTED }}>Evaluations</TableHead>
                    <TableHead style={{ color: MUTED }}>Last Evaluated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(weights ?? []).map((w, i) => (
                    <TableRow key={w.personaId} style={{ borderColor: BORDER }}>
                      <TableCell>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              background: "rgba(56,189,248,0.1)",
                              color: CYAN,
                              borderRadius: 4,
                              padding: "2px 6px",
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: "monospace",
                            }}
                          >
                            #{i + 1}
                          </span>
                          <span style={{ color: WHITE, fontWeight: 600 }}>{w.personaId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <WeightBar weight={w.weight} />
                      </TableCell>
                      <TableCell>
                        {w.accuracyRate !== null ? (
                          <span
                            style={{
                              color: w.accuracyRate >= 60 ? GREEN : w.accuracyRate >= 40 ? AMBER : RED,
                              fontWeight: 700,
                            }}
                          >
                            {w.accuracyRate}%
                          </span>
                        ) : (
                          <span style={{ color: MUTED }}>—</span>
                        )}
                      </TableCell>
                      <TableCell style={{ color: MUTED }}>
                        {w.correctPredictions}/{w.totalEvaluations}
                      </TableCell>
                      <TableCell style={{ color: MUTED, fontSize: 12 }}>
                        {w.lastEvaluatedAt
                          ? new Date(w.lastEvaluatedAt).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Decision Memory Tab ── */}
        <TabsContent value="history">
          <div
            style={{
              background: NAVY2,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: WHITE, margin: 0 }}>
                Decision Memory
              </h2>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                Every Council decision is stored and used as context for future similar tasks.
              </p>
            </div>
            {historyLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: MUTED }}>Loading...</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderColor: BORDER }}>
                      <TableHead style={{ color: MUTED }}>ID</TableHead>
                      <TableHead style={{ color: MUTED }}>Task Preview</TableHead>
                      <TableHead style={{ color: MUTED }}>Domain</TableHead>
                      <TableHead style={{ color: MUTED }}>Verdict</TableHead>
                      <TableHead style={{ color: MUTED }}>Confidence</TableHead>
                      <TableHead style={{ color: MUTED }}>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(history?.decisions ?? []).map((d) => (
                      <TableRow key={d.id} style={{ borderColor: BORDER }}>
                        <TableCell style={{ color: MUTED, fontSize: 12, fontFamily: "monospace" }}>
                          #{d.id}
                        </TableCell>
                        <TableCell style={{ color: WHITE, maxWidth: 300 }}>
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 13,
                            }}
                          >
                            {d.taskDescription}
                          </div>
                        </TableCell>
                        <TableCell>
                          {d.taskDomain ? (
                            <span
                              style={{
                                color: AMBER,
                                background: "rgba(251,191,36,0.1)",
                                borderRadius: 4,
                                padding: "2px 6px",
                                fontSize: 11,
                              }}
                            >
                              {d.taskDomain}
                            </span>
                          ) : (
                            <span style={{ color: MUTED }}>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <VerdictBadge verdict={d.finalVerdict} />
                        </TableCell>
                        <TableCell style={{ color: MUTED }}>
                          {d.confidenceScore !== null
                            ? `${(d.confidenceScore * 100).toFixed(0)}%`
                            : "—"}
                        </TableCell>
                        <TableCell style={{ color: MUTED, fontSize: 12 }}>
                          {new Date(d.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Pagination */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 20px",
                    borderTop: `1px solid ${BORDER}`,
                  }}
                >
                  <span style={{ color: MUTED, fontSize: 12 }}>
                    {history?.total ?? 0} total decisions
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      style={{ borderColor: BORDER, color: MUTED, background: "transparent" }}
                    >
                      ← Prev
                    </Button>
                    <span style={{ color: MUTED, fontSize: 12, padding: "6px 8px" }}>
                      Page {historyPage}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => p + 1)}
                      disabled={
                        !history ||
                        historyPage * (history.pageSize ?? 15) >= (history.total ?? 0)
                      }
                      style={{ borderColor: BORDER, color: MUTED, background: "transparent" }}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Verdict Breakdown Tab ── */}
        <TabsContent value="verdicts">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}
          >
            {/* Council verdicts */}
            <div
              style={{
                background: NAVY2,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "20px",
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700, color: WHITE, marginBottom: 16 }}>
                Council Verdicts
              </h3>
              {statsLoading ? (
                <div style={{ color: MUTED }}>Loading...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(stats?.verdictBreakdown ?? []).map((v) => {
                    const total = stats?.totalDecisions ?? 1;
                    const pct = total > 0 ? Math.round((v.count / total) * 100) : 0;
                    return (
                      <div key={v.verdict} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <VerdictBadge verdict={v.verdict} />
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: CYAN,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ color: WHITE, fontWeight: 700, minWidth: 30 }}>
                          {v.count}
                        </span>
                        <span style={{ color: MUTED, fontSize: 12, minWidth: 36 }}>{pct}%</span>
                      </div>
                    );
                  })}
                  {(stats?.verdictBreakdown ?? []).length === 0 && (
                    <div style={{ color: MUTED, fontSize: 13 }}>No decisions yet</div>
                  )}
                </div>
              )}
            </div>

            {/* Outcome verdicts */}
            <div
              style={{
                background: NAVY2,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "20px",
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700, color: WHITE, marginBottom: 16 }}>
                Real-World Outcomes
              </h3>
              {statsLoading ? (
                <div style={{ color: MUTED }}>Loading...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(stats?.outcomeBreakdown ?? []).map((o) => {
                    const total = stats?.totalScored ?? 1;
                    const pct = total > 0 ? Math.round((o.count / total) * 100) : 0;
                    return (
                      <div key={o.verdict} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <VerdictBadge verdict={o.verdict} />
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: o.verdict === "CORRECT" ? GREEN : o.verdict === "INCORRECT" ? RED : AMBER,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ color: WHITE, fontWeight: 700, minWidth: 30 }}>
                          {o.count}
                        </span>
                        <span style={{ color: MUTED, fontSize: 12, minWidth: 36 }}>{pct}%</span>
                      </div>
                    );
                  })}
                  {(stats?.outcomeBreakdown ?? []).length === 0 && (
                    <div style={{ color: MUTED, fontSize: 13 }}>
                      No outcomes scored yet. Outcomes are collected nightly after 30-day window.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
