/**
 * infraSimMonitor.ts — Continuous Post-IC Monitoring Engine
 *
 * Capabilities:
 *   - Thesis status tracking: GREEN / YELLOW / ORANGE / RED
 *   - Assumption drift detection vs. base case
 *   - "Would We Still Approve Today?" recomputation
 *   - Weekly governance memo generation
 *   - Alert generation for threshold breaches
 */

import { invokeLLM } from "./_core/llm";
import { generateScenarios, aggregateResults, type SimCaseConfig } from "./infraSimEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThesisStatus = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface MonitoringSnapshot {
  thesisStatus: ThesisStatus;
  approvalProbabilityPct: number;
  decisionDriftScore: number;       // 0-100, how much the decision has drifted from original
  thesisDegradationPct: number;     // % degradation from original approval probability
  wouldApproveToday: boolean;
  alerts: MonitoringAlert[];
  assumptionDrift: AssumptionDrift[];
  weeklyMemo: WeeklyGovernanceMemo;
}

export interface MonitoringAlert {
  alertType: "THRESHOLD_BREACH" | "ASSUMPTION_DRIFT" | "GOVERNANCE_TRIGGER" | "MARKET_EVENT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  impactedDimensions: string[];
  irrImpactDeltaPct: number;
  actionRequired: string;
  triggeredAt: number;
}

export interface AssumptionDrift {
  dimensionKey: string;
  dimensionName: string;
  originalValue: string;
  currentValue: string;
  irrImpactDeltaPct: number;
  driftDirection: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "CRITICAL";
}

export interface WeeklyGovernanceMemo {
  generatedAt: string;
  thesisStatus: ThesisStatus;
  executiveSummary: string;
  keyDevelopments: string[];
  riskUpdates: string[];
  wouldApproveToday: boolean;
  recommendedActions: string[];
  nextReviewDate: string;
}

export interface MonitoringEvent {
  eventType: string;
  eventTitle: string;
  eventDescription: string;
  impactedDimensions: string[];
  irrImpactDeltaPct: number;
  thesisImpact: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "CRITICAL";
}

// ── Thesis Status Engine ──────────────────────────────────────────────────────

export function computeThesisStatus(
  originalApprovalPct: number,
  currentApprovalPct: number,
  activeAlerts: MonitoringAlert[]
): ThesisStatus {
  const degradation = originalApprovalPct - currentApprovalPct;
  const hasCriticalAlert = activeAlerts.some((a) => a.severity === "CRITICAL");
  const hasHighAlert = activeAlerts.some((a) => a.severity === "HIGH");

  if (hasCriticalAlert || degradation > 50 || currentApprovalPct < 5) return "RED";
  if (hasHighAlert || degradation > 25 || currentApprovalPct < 20) return "ORANGE";
  if (degradation > 10 || currentApprovalPct < 40) return "YELLOW";
  return "GREEN";
}

// ── Assumption Drift Detection ────────────────────────────────────────────────

export function detectAssumptionDrift(
  config: SimCaseConfig,
  currentDimensionValues: Record<string, string>
): AssumptionDrift[] {
  const drifts: AssumptionDrift[] = [];

  for (const dim of config.dimensions) {
    const baseValue = dim.values.reduce((best, v) => (v.weight > best.weight ? v : best), dim.values[0]);
    const currentValueLabel = currentDimensionValues[dim.key];

    if (!currentValueLabel || currentValueLabel === baseValue.label) continue;

    const currentValue = dim.values.find((v) => v.label === currentValueLabel);
    if (!currentValue) continue;

    const irrImpact = currentValue.irrDeltaPct - baseValue.irrDeltaPct;
    const driftDirection: AssumptionDrift["driftDirection"] =
      irrImpact > 1 ? "POSITIVE" :
      irrImpact > -1 ? "NEUTRAL" :
      irrImpact > -3 ? "NEGATIVE" : "CRITICAL";

    drifts.push({
      dimensionKey: dim.key,
      dimensionName: dim.name,
      originalValue: baseValue.label,
      currentValue: currentValueLabel,
      irrImpactDeltaPct: Math.round(irrImpact * 100) / 100,
      driftDirection,
    });
  }

  return drifts.sort((a, b) => a.irrImpactDeltaPct - b.irrImpactDeltaPct);
}

// ── "Would We Still Approve Today?" Recomputation ────────────────────────────

export function recomputeApprovalProbability(
  config: SimCaseConfig,
  currentDimensionValues: Record<string, string>,
  targetCount = 1000
): number {
  // Modify config to reflect current state
  const updatedConfig: SimCaseConfig = {
    ...config,
    dimensions: config.dimensions.map((dim) => {
      const currentLabel = currentDimensionValues[dim.key];
      if (!currentLabel) return dim;

      // Adjust weights to heavily favor the current observed value
      return {
        ...dim,
        values: dim.values.map((v) => ({
          ...v,
          weight: v.label === currentLabel ? 0.80 : 0.20 / (dim.values.length - 1),
        })),
      };
    }),
  };

  const scenarios = generateScenarios(updatedConfig, targetCount);
  const result = aggregateResults(scenarios, updatedConfig);
  return Math.round(result.approveRate * 10000) / 100;
}

// ── Alert Generation ──────────────────────────────────────────────────────────

export function generateAlerts(
  config: SimCaseConfig,
  events: MonitoringEvent[],
  drifts: AssumptionDrift[],
  currentApprovalPct: number,
  originalApprovalPct: number
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];
  const now = Date.now();

  // Alerts from events
  for (const event of events) {
    if (event.thesisImpact === "CRITICAL" || event.irrImpactDeltaPct < -3) {
      alerts.push({
        alertType: "MARKET_EVENT",
        severity: event.thesisImpact === "CRITICAL" ? "CRITICAL" : "HIGH",
        title: event.eventTitle,
        description: event.eventDescription ?? "",
        impactedDimensions: event.impactedDimensions,
        irrImpactDeltaPct: event.irrImpactDeltaPct,
        actionRequired: "Immediate governance review required. Recompute approval probability.",
        triggeredAt: now,
      });
    }
  }

  // Alerts from assumption drift
  for (const drift of drifts) {
    if (drift.driftDirection === "CRITICAL") {
      alerts.push({
        alertType: "ASSUMPTION_DRIFT",
        severity: "CRITICAL",
        title: `Critical Assumption Drift: ${drift.dimensionName}`,
        description: `${drift.dimensionName} has drifted from "${drift.originalValue}" to "${drift.currentValue}" (${drift.irrImpactDeltaPct.toFixed(1)}pp IRR impact)`,
        impactedDimensions: [drift.dimensionKey],
        irrImpactDeltaPct: drift.irrImpactDeltaPct,
        actionRequired: "Escalate to IC. Consider whether original investment thesis remains valid.",
        triggeredAt: now,
      });
    } else if (drift.driftDirection === "NEGATIVE") {
      alerts.push({
        alertType: "ASSUMPTION_DRIFT",
        severity: "HIGH",
        title: `Assumption Drift: ${drift.dimensionName}`,
        description: `${drift.dimensionName} has deteriorated from "${drift.originalValue}" to "${drift.currentValue}"`,
        impactedDimensions: [drift.dimensionKey],
        irrImpactDeltaPct: drift.irrImpactDeltaPct,
        actionRequired: "Review with deal team. Update monitoring assumptions.",
        triggeredAt: now,
      });
    }
  }

  // Approval probability threshold alerts
  const degradation = originalApprovalPct - currentApprovalPct;
  if (degradation > 40) {
    alerts.push({
      alertType: "THRESHOLD_BREACH",
      severity: "CRITICAL",
      title: "Approval Probability Critical Degradation",
      description: `Approval probability has fallen from ${originalApprovalPct.toFixed(1)}% to ${currentApprovalPct.toFixed(1)}% (${degradation.toFixed(1)}pp degradation)`,
      impactedDimensions: [],
      irrImpactDeltaPct: 0,
      actionRequired: "Emergency IC review. Consider whether to continue or exit.",
      triggeredAt: now,
    });
  }

  return alerts;
}

// ── Weekly Governance Memo Generator ─────────────────────────────────────────

export async function generateWeeklyMemo(
  config: SimCaseConfig,
  snapshot: Omit<MonitoringSnapshot, "weeklyMemo">,
  recentEvents: MonitoringEvent[]
): Promise<WeeklyGovernanceMemo> {
  const eventsText = recentEvents.length > 0
    ? recentEvents.map((e) => `- ${e.eventTitle}: ${e.eventDescription} (IRR impact: ${e.irrImpactDeltaPct > 0 ? "+" : ""}${e.irrImpactDeltaPct}pp)`).join("\n")
    : "No significant events this week.";

  const driftsText = snapshot.assumptionDrift.length > 0
    ? snapshot.assumptionDrift.map((d) => `- ${d.dimensionName}: ${d.originalValue} → ${d.currentValue} (${d.irrImpactDeltaPct > 0 ? "+" : ""}${d.irrImpactDeltaPct}pp)`).join("\n")
    : "No assumption drift detected.";

  const prompt = `Generate a weekly governance memo for the following infrastructure investment:

CASE: ${config.title}
THESIS STATUS: ${snapshot.thesisStatus}
APPROVAL PROBABILITY: ${snapshot.approvalProbabilityPct.toFixed(1)}%
WOULD APPROVE TODAY: ${snapshot.wouldApproveToday ? "YES" : "NO"}
DECISION DRIFT SCORE: ${snapshot.decisionDriftScore.toFixed(0)}/100
THESIS DEGRADATION: ${snapshot.thesisDegradationPct.toFixed(1)}%

RECENT EVENTS:
${eventsText}

ASSUMPTION DRIFT:
${driftsText}

ACTIVE ALERTS: ${snapshot.alerts.length} (${snapshot.alerts.filter((a) => a.severity === "CRITICAL").length} critical)

Generate a concise, professional weekly governance memo in JSON format:
{
  "executiveSummary": "<2-3 sentence summary for IC>",
  "keyDevelopments": ["<development 1>", "<development 2>", ...],
  "riskUpdates": ["<risk update 1>", ...],
  "recommendedActions": ["<action 1>", ...]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a senior infrastructure investment analyst writing weekly governance memos for institutional investors. Be precise, factual, and action-oriented." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "weekly_memo",
          strict: true,
          schema: {
            type: "object",
            properties: {
              executiveSummary: { type: "string" },
              keyDevelopments: { type: "array", items: { type: "string" } },
              riskUpdates: { type: "array", items: { type: "string" } },
              recommendedActions: { type: "array", items: { type: "string" } },
            },
            required: ["executiveSummary", "keyDevelopments", "riskUpdates", "recommendedActions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 7);

    return {
      generatedAt: new Date().toISOString(),
      thesisStatus: snapshot.thesisStatus,
      executiveSummary: parsed.executiveSummary,
      keyDevelopments: parsed.keyDevelopments,
      riskUpdates: parsed.riskUpdates,
      wouldApproveToday: snapshot.wouldApproveToday,
      recommendedActions: parsed.recommendedActions,
      nextReviewDate: nextReview.toISOString().split("T")[0],
    };
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      thesisStatus: snapshot.thesisStatus,
      executiveSummary: `Thesis status: ${snapshot.thesisStatus}. Approval probability: ${snapshot.approvalProbabilityPct.toFixed(1)}%. Monitoring continues.`,
      keyDevelopments: recentEvents.map((e) => e.eventTitle),
      riskUpdates: snapshot.alerts.map((a) => a.title),
      wouldApproveToday: snapshot.wouldApproveToday,
      recommendedActions: snapshot.alerts.filter((a) => a.severity === "CRITICAL").map((a) => a.actionRequired),
      nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };
  }
}
