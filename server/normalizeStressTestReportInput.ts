/**
 * normalizeStressTestReportInput.ts
 *
 * Normalizes raw simulation aggregation data (as stored in DB / returned by
 * scenarioAggregator) into the shape expected by the Stress Test Report PDF
 * builder (StressTestReportInput).
 *
 * The aggregator uses different field names than the PDF builder:
 *
 *   FailureVector (aggregator)         → PDF builder
 *   ─────────────────────────────────────────────────────────────
 *   dimensionKey / dimensionLabel      → category (label preferred)
 *   rejectionCount                     → frequency
 *   rejectionContributionPct           → affectedPct
 *   avgApprovalDelta (negative float)  → avgSeverity (0–1 scale, positive)
 *   (none)                             → examplePattern (optional)
 *
 *   ApprovalPathway (aggregator)       → PDF builder
 *   ─────────────────────────────────────────────────────────────
 *   description                        → conditionSet[0]
 *   safeDimensions                     → conditionSet (joined)
 *   estimatedApprovalPct               → approvalProbability
 *   (none)                             → confidenceLift (default 0)
 *   (none)                             → remainingRisks (default [])
 *
 *   SensitivityEntry (aggregator)      → PDF builder
 *   ─────────────────────────────────────────────────────────────
 *   dimensionLabel                     → variable
 *   impactScore (0–100)                → impactScore (0–1 for PDF bar)
 *   avgDeltaWhenStressed               → direction ("negative" if < 0)
 *
 *   GovernanceHeatmapCell (aggregator) → PDF builder
 *   ─────────────────────────────────────────────────────────────
 *   category                           → category
 *   escalationCount                    → escalationCount
 *   vetoCount                          → vetoCount
 *   regulatoryFragilityScore (0–100)   → avgSeverity (0–1 scale)
 *
 * This function also:
 *   - Converts numeric strings to numbers
 *   - Clamps NaN/Infinity to 0
 *   - Converts percentage strings like "0.0%" to 0
 *   - Ensures arrays default to []
 *   - Ensures missing text fields default to "Not available"
 *   - Normalises completedAt Date objects to ISO strings
 *   - Derives targetCount from totalScenarios if missing
 */

import type { StressTestReportInput } from "./stressTestReportPdf";

// ── Numeric coercion helpers ───────────────────────────────────────────────────

/** Safely coerce any value to a finite number, defaulting to `fallback` (0). */
function toNum(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    // Handle percentage strings like "0.0%" or "62.5%"
    const stripped = v.trim().replace(/%$/, "");
    const n = parseFloat(stripped);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Clamp a value to [0, max]. */
function clamp(v: number, max = Infinity): number {
  return Math.max(0, Math.min(max, v));
}

/** Safely coerce to string, defaulting to `fallback`. */
function toStr(v: unknown, fallback = "Not available"): string {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "string") return v;
  return String(v);
}

/** Safely coerce to string array, defaulting to []. */
function toStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(item => (typeof item === "string" ? item : String(item)));
}

// ── Field-level normalizers ────────────────────────────────────────────────────

/**
 * Normalize a single failure vector from either aggregator or PDF-builder shape.
 *
 * Aggregator shape:
 *   { dimensionKey, dimensionLabel, category, rejectionCount,
 *     rejectionContributionPct, avgApprovalDelta, escalationTriggerCount }
 *
 * PDF-builder shape:
 *   { category, frequency, avgSeverity, affectedPct, examplePattern? }
 */
function normalizeFailureVector(fv: Record<string, unknown>): StressTestReportInput["failureVectors"][number] {
  // Prefer PDF-builder field names; fall back to aggregator field names
  const category = toStr(fv.category ?? fv.dimensionLabel ?? fv.dimensionKey, "Unknown");
  const frequency = toNum(fv.frequency ?? fv.rejectionCount);
  // affectedPct: use directly if present, else use rejectionContributionPct
  const affectedPct = clamp(toNum(fv.affectedPct ?? fv.rejectionContributionPct));
  // avgSeverity: use directly if present, else derive from avgApprovalDelta (negative → positive 0–1)
  const rawSeverity = fv.avgSeverity !== undefined
    ? toNum(fv.avgSeverity)
    : Math.abs(toNum(fv.avgApprovalDelta));
  const avgSeverity = clamp(rawSeverity, 1);
  const examplePattern = fv.examplePattern ? toStr(fv.examplePattern) : undefined;

  return { category, frequency, avgSeverity, affectedPct, examplePattern };
}

/**
 * Normalize a single approval pathway from either aggregator or PDF-builder shape.
 *
 * Aggregator shape:
 *   { rank, description, safeDimensions, estimatedApprovalPct, scenarioCount }
 *
 * PDF-builder shape:
 *   { conditionSet, approvalProbability, confidenceLift, remainingRisks }
 */
function normalizeApprovalPathway(ap: Record<string, unknown>): StressTestReportInput["approvalPathways"][number] {
  // conditionSet: use directly if present, else build from description + safeDimensions
  let conditionSet: string[];
  if (Array.isArray(ap.conditionSet) && ap.conditionSet.length > 0) {
    conditionSet = toStrArr(ap.conditionSet);
  } else {
    const parts: string[] = [];
    if (ap.description) parts.push(toStr(ap.description));
    if (Array.isArray(ap.safeDimensions) && ap.safeDimensions.length > 0) {
      parts.push(...toStrArr(ap.safeDimensions).map(d => d.replace(/_/g, " ")));
    }
    conditionSet = parts.length > 0 ? parts : ["Stable conditions maintained"];
  }

  const approvalProbability = clamp(toNum(ap.approvalProbability ?? ap.estimatedApprovalPct), 100);
  const confidenceLift = clamp(toNum(ap.confidenceLift));
  const remainingRisks = toStrArr(ap.remainingRisks);

  return { conditionSet, approvalProbability, confidenceLift, remainingRisks };
}

/**
 * Normalize a single sensitivity surface entry from either aggregator or PDF-builder shape.
 *
 * Aggregator shape:
 *   { rank, dimensionKey, dimensionLabel, category, avgDeltaWhenStressed,
 *     tippingPointSeverity, interactionScore, impactScore (0–100) }
 *
 * PDF-builder shape:
 *   { variable, impactScore (0–1), direction }
 */
function normalizeSensitivityEntry(sv: Record<string, unknown>): StressTestReportInput["sensitivitySurface"][number] {
  const variable = toStr(sv.variable ?? sv.dimensionLabel ?? sv.dimensionKey, "Unknown variable");

  // impactScore: PDF builder expects 0–1; aggregator stores 0–100
  let impactScore: number;
  if (sv.impactScore !== undefined) {
    const raw = toNum(sv.impactScore);
    // Detect if it's already 0–1 or 0–100
    impactScore = raw > 1 ? clamp(raw / 100, 1) : clamp(raw, 1);
  } else {
    impactScore = 0;
  }

  // direction: use directly if present, else derive from avgDeltaWhenStressed
  let direction: string;
  if (typeof sv.direction === "string" && sv.direction.length > 0) {
    direction = sv.direction;
  } else {
    const delta = toNum(sv.avgDeltaWhenStressed);
    direction = delta < 0 ? "negative" : "positive";
  }

  return { variable, impactScore, direction };
}

/**
 * Normalize a single governance heatmap cell from either aggregator or PDF-builder shape.
 *
 * Aggregator shape:
 *   { category, escalationCount, vetoCount, complianceCount,
 *     regulatoryFragilityScore (0–100), totalScenarios, escalationPct }
 *
 * PDF-builder shape:
 *   { category, escalationCount, vetoCount, avgSeverity (0–1) }
 */
function normalizeGovernanceHeatmapCell(gh: Record<string, unknown>): StressTestReportInput["governanceHeatmap"][number] {
  const category = toStr(gh.category, "Unknown");
  const escalationCount = Math.round(toNum(gh.escalationCount));
  const vetoCount = Math.round(toNum(gh.vetoCount));

  // avgSeverity: use directly if present, else derive from regulatoryFragilityScore (0–100 → 0–1)
  let avgSeverity: number;
  if (gh.avgSeverity !== undefined) {
    avgSeverity = clamp(toNum(gh.avgSeverity), 1);
  } else {
    avgSeverity = clamp(toNum(gh.regulatoryFragilityScore) / 100, 1);
  }

  return { category, escalationCount, vetoCount, avgSeverity };
}

/**
 * Normalize the decisionDistribution object.
 * Handles both aggregator shape (with hardNoCount/hardNoPct) and PDF-builder shape.
 * Also handles numeric strings and percentage strings.
 */
function normalizeDecisionDistribution(
  dd: Record<string, unknown>
): StressTestReportInput["decisionDistribution"] {
  const approvePct    = clamp(toNum(dd.approvePct    ?? dd.approveRate),    100);
  const conditionalPct = clamp(toNum(dd.conditionalPct ?? dd.conditionalRate), 100);
  const rejectPct     = clamp(toNum(dd.rejectPct     ?? dd.rejectRate),     100);
  // vetoPct: use directly if present; aggregator doesn't have it — derive from hardNoPct
  const vetoPct       = clamp(toNum(dd.vetoPct       ?? dd.hardNoPct),      100);
  // totalScenarios: use directly if present, else use approveCount + conditionalCount + rejectCount
  const totalScenarios = toNum(dd.totalScenarios ?? dd.total) ||
    Math.round(toNum(dd.approveCount) + toNum(dd.conditionalCount) + toNum(dd.rejectCount));

  const result: StressTestReportInput["decisionDistribution"] = {
    approvePct,
    conditionalPct,
    rejectPct,
    vetoPct,
    totalScenarios: Math.max(1, totalScenarios),
  };

  // confidenceDistribution is optional
  if (dd.confidenceDistribution && typeof dd.confidenceDistribution === "object") {
    const cd = dd.confidenceDistribution as Record<string, unknown>;
    result.confidenceDistribution = {
      low:    clamp(toNum(cd.low),    100),
      medium: clamp(toNum(cd.medium), 100),
      high:   clamp(toNum(cd.high),   100),
    };
  }

  return result;
}

// ── Main normalizer ───────────────────────────────────────────────────────────

/**
 * Normalize raw simulation aggregation data into the shape expected by
 * `generateStressTestReportPdf` / `generateStressTestReportText`.
 *
 * Accepts any shape — aggregator output, DB-parsed JSON, or already-normalized
 * PDF-builder input. Safe to call multiple times (idempotent).
 *
 * @param raw  The raw input object (any shape)
 * @returns    A fully normalized `StressTestReportInput`
 */
export function normalizeStressTestReportInput(raw: Record<string, unknown>): StressTestReportInput {
  // ── completedAt ─────────────────────────────────────────────────────────────
  let completedAt: string;
  if (raw.completedAt instanceof Date) {
    completedAt = raw.completedAt.toISOString();
  } else if (typeof raw.completedAt === "string" && raw.completedAt.length > 0) {
    completedAt = raw.completedAt;
  } else {
    completedAt = new Date().toISOString();
  }

  // ── targetCount ─────────────────────────────────────────────────────────────
  const targetCount = Math.max(1,
    toNum(raw.targetCount ?? raw.totalScenarios ?? raw.completedCount)
  );

  // ── decisionDistribution ────────────────────────────────────────────────────
  const dd = (raw.decisionDistribution && typeof raw.decisionDistribution === "object")
    ? raw.decisionDistribution as Record<string, unknown>
    : {};
  const decisionDistribution = normalizeDecisionDistribution(dd);

  // ── failureVectors ──────────────────────────────────────────────────────────
  const failureVectors: StressTestReportInput["failureVectors"] = Array.isArray(raw.failureVectors)
    ? raw.failureVectors
        .filter((fv): fv is Record<string, unknown> => fv !== null && typeof fv === "object")
        .map(normalizeFailureVector)
    : [];

  // ── approvalPathways ────────────────────────────────────────────────────────
  const approvalPathways: StressTestReportInput["approvalPathways"] = Array.isArray(raw.approvalPathways)
    ? raw.approvalPathways
        .filter((ap): ap is Record<string, unknown> => ap !== null && typeof ap === "object")
        .map(normalizeApprovalPathway)
    : [];

  // ── sensitivitySurface ──────────────────────────────────────────────────────
  const sensitivitySurface: StressTestReportInput["sensitivitySurface"] = Array.isArray(raw.sensitivitySurface)
    ? raw.sensitivitySurface
        .filter((sv): sv is Record<string, unknown> => sv !== null && typeof sv === "object")
        .map(normalizeSensitivityEntry)
    : [];

  // ── governanceHeatmap ───────────────────────────────────────────────────────
  const governanceHeatmap: StressTestReportInput["governanceHeatmap"] = Array.isArray(raw.governanceHeatmap)
    ? raw.governanceHeatmap
        .filter((gh): gh is Record<string, unknown> => gh !== null && typeof gh === "object")
        .map(normalizeGovernanceHeatmapCell)
    : [];

  // ── executiveSummary ────────────────────────────────────────────────────────
  const executiveSummary = typeof raw.executiveSummary === "string" && raw.executiveSummary.length > 0
    ? raw.executiveSummary
    : "";

  // ── scenarioClusters ────────────────────────────────────────────────────────
  let scenarioClusters: StressTestReportInput["scenarioClusters"];
  if (raw.scenarioClusters && typeof raw.scenarioClusters === "object") {
    const sc = raw.scenarioClusters as Record<string, unknown>;
    scenarioClusters = {
      resilient:    Math.round(toNum(sc.resilient)),
      conditional:  Math.round(toNum(sc.conditional)),
      failure:      Math.round(toNum(sc.failure)),
      catastrophic: Math.round(toNum(sc.catastrophic)),
    };
  }

  return {
    dealName:             toStr(raw.dealName, "Unknown Deal"),
    baseVerdict:          toStr(raw.baseVerdict, "UNKNOWN"),
    mode:                 toStr(raw.mode, "unknown"),
    targetCount,
    completedAt,
    executiveSummary,
    decisionDistribution,
    failureVectors,
    approvalPathways,
    sensitivitySurface,
    governanceHeatmap,
    scenarioClusters,
    generatedAt:          typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
  };
}

/**
 * Log the full validation error path for a zod error response.
 * Call this before throwing so the full path is visible in server logs.
 */
export function logValidationError(
  context: string,
  issues: Array<{ path: (string | number)[]; expected?: string; received?: string; message?: string; code?: string }>
): void {
  console.error(`[StressTestReportPdf] Validation error in ${context}:`);
  for (const issue of issues) {
    console.error(`  Path: ${issue.path.join(" → ") || "(root)"}  |  Expected: ${issue.expected ?? "?"}  |  Received: ${issue.received ?? "?"}  |  Code: ${issue.code ?? "?"}  |  Message: ${issue.message ?? ""}`);
  }
}
