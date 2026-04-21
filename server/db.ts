import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertPitchTriage, InsertUser, PitchTriage, pitchTriages, pitchMirrorShares, users, autoTriggerLog, InsertAutoTriggerLog, dealSignals, InsertDealSignal, DealSignal } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

// ── Pitch Triage History helpers ───────────────────────────────────────────────────────────────
export async function savePitchTriage(data: InsertPitchTriage): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save pitch triage: database not available");
    return null;
  }
  try {
    const result = await db.insert(pitchTriages).values(data);
    // MySQL2 returns insertId on the result
    return (result as unknown as { insertId: number }[])[0]?.insertId ?? null;
  } catch (error) {
    console.error("[Database] Failed to save pitch triage:", error);
    return null;
  }
}

export async function getPitchTriageHistory(userId: string, limit = 50): Promise<PitchTriage[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pitchTriages)
    .where(eq(pitchTriages.userId, userId))
    .orderBy(desc(pitchTriages.createdAt))
    .limit(limit);
}

export async function getPitchTriageById(id: number, userId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pitchTriages)
    .where(eq(pitchTriages.id, id))
    .limit(1);
  const row = rows[0] ?? null;
  // Ownership check
  if (row && row.userId !== userId) return null;
  return row;
}

export async function markPitchTriageEscalated(id: number, userId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db
      .update(pitchTriages)
      .set({ escalatedAt: new Date() })
      .where(and(eq(pitchTriages.id, id), eq(pitchTriages.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark pitch triage escalated:", error);
    return false;
  }
}

/**
 * updateTriageStage — Update the stage field of a pitch triage record.
 * Ownership-checked: only the record owner can update.
 * Valid stages: 'triaged' | 'diligence' | 'ic_ready' | 'decision_made' | 'archived'
 */
export async function updateTriageStage(
  id: number,
  userId: string,
  stage: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db
      .update(pitchTriages)
      .set({ stage })
      .where(and(eq(pitchTriages.id, id), eq(pitchTriages.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update triage stage:", error);
    return false;
  }
}

/**
 * recordOutcome — Record the real investment decision outcome for a triage record.
 * Ownership-checked. Valid outcomes: 'invested' | 'passed'
 */
export async function recordOutcome(
  id: number,
  userId: string,
  outcome: "invested" | "passed"
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db
      .update(pitchTriages)
      .set({ decisionOutcome: outcome })
      .where(and(eq(pitchTriages.id, id), eq(pitchTriages.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Failed to record outcome:", error);
    return false;
  }
}

/**
 * getOutcomeHistory — Fetch last N triage records with a real decision outcome.
 * Used by pitch.patternInsight to compute cross-deal pattern matching.
 */
export async function getOutcomeHistory(
  userId: string,
  limit = 20
): Promise<PitchTriage[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(pitchTriages)
      .where(
        and(
          eq(pitchTriages.userId, userId),
          sql`${pitchTriages.decisionOutcome} IN ('invested', 'passed')`
        )
      )
      .orderBy(desc(pitchTriages.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to fetch outcome history:", error);
    return [];
  }
}

// ── PitchMirror Share helpers ─────────────────────────────────────────────────────────────────
export async function createPitchMirrorShare(
  mirrorResultJson: string,
  founderStage?: string | null
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const { randomBytes } = await import("crypto");
    const shareToken = randomBytes(24).toString("hex"); // 48-char hex token
    await db.insert(pitchMirrorShares).values({
      shareToken,
      mirrorResultJson,
      ...(founderStage ? { founderStage } : {}),
    });
    return shareToken;
  } catch (error) {
    console.error("[Database] Failed to create pitch mirror share:", error);
    return null;
  }
}

export async function getPitchMirrorShare(shareToken: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pitchMirrorShares)
    .where(eq(pitchMirrorShares.shareToken, shareToken))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * insertAutoTriggerLog — Write one row to auto_trigger_log.
 * Called after every deal that fires in the sweep or manual re-evaluate.
 */
export async function insertAutoTriggerLog(data: InsertAutoTriggerLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(autoTriggerLog).values(data);
  } catch (error) {
    console.error("[Database] insertAutoTriggerLog failed:", error);
  }
}

/**
 * getAutoTriggerLogCount — Returns count of auto_trigger_log rows
 * where firedAt >= 30 days ago for a given userId.
 */
export async function getAutoTriggerLogCount(userId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM auto_trigger_log WHERE userId = ${userId} AND firedAt >= ${cutoff}`
    );
    const rawRows = Array.isArray(rows) ? rows[0] : rows;
    if (!Array.isArray(rawRows) || rawRows.length === 0) return 0;
    const first = rawRows[0] as { cnt: number | string };
    return typeof first.cnt === "number" ? first.cnt : parseInt(String(first.cnt), 10) || 0;
  } catch (error) {
    console.error("[Database] getAutoTriggerLogCount failed:", error);
    return 0;
  }
}

/**
 * getActiveUsersWithDeals — Returns distinct userIds that have at least one
 * pitch_triage record in 'diligence' or 'ic_ready' stage with no outcome.
 *
 * Used by the daily pitch sweep cron job to find users who need re-evaluation.
 */
export async function getActiveUsersWithDeals(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    // Raw SQL: SELECT DISTINCT userId FROM pitch_triages WHERE stage IN (...) AND decisionOutcome IS NULL
    const rows = await db.execute(
      sql`SELECT DISTINCT userId FROM pitch_triages WHERE stage IN ('diligence', 'ic_ready') AND decisionOutcome IS NULL`
    );
    // drizzle mysql2 execute returns [rows, fields]; rows is an array of row objects
    const rawRows = Array.isArray(rows) ? rows[0] : rows;
    if (!Array.isArray(rawRows)) return [];
    return (rawRows as Array<{ userId: string }>)
      .map((r) => r.userId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch (error) {
    console.error("[Database] getActiveUsersWithDeals failed:", error);
    return [];
  }
}

// ── Deal Signals helpers ───────────────────────────────────────────────────────

/**
 * insertDealSignal — Insert a new signal row into deal_signals.
 * Returns the inserted row's id, or null on failure.
 */
export async function insertDealSignal(data: InsertDealSignal): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.insert(dealSignals).values(data);
    return (result as unknown as { insertId: number }[])[0]?.insertId ?? null;
  } catch (error) {
    console.error("[Database] insertDealSignal failed:", error);
    return null;
  }
}

/**
 * markDealSignalProcessed — Set processed=true for a signal row.
 */
export async function markDealSignalProcessed(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(dealSignals).set({ processed: true }).where(eq(dealSignals.id, id));
  } catch (error) {
    console.error("[Database] markDealSignalProcessed failed:", error);
  }
}

/**
 * getDealSignals — Fetch last N signals for a deal, ordered by createdAt DESC.
 * Ownership-checked: only returns signals where userId matches.
 */
export async function getDealSignals(dealId: string, userId: string, limit = 10): Promise<DealSignal[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(dealSignals)
      .where(and(eq(dealSignals.dealId, dealId), eq(dealSignals.userId, userId)))
      .orderBy(desc(dealSignals.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] getDealSignals failed:", error);
    return [];
  }
}

/**
 * getSignalCountsForUser — Returns a map of dealId → signal count for all deals
 * belonging to the given user that have at least one signal.
 */
export async function getSignalCountsForUser(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};
  try {
    const rows = await db
      .select({ dealId: dealSignals.dealId, cnt: count(dealSignals.id) })
      .from(dealSignals)
      .where(eq(dealSignals.userId, userId))
      .groupBy(dealSignals.dealId);
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.dealId] = row.cnt;
    }
    return result;
  } catch (error) {
    console.error("[Database] getSignalCountsForUser failed:", error);
    return {};
  }
}

/**
 * getPreviousTriageForDeal — Returns the most recent triage for the same deal
 * (same pitchPreview prefix, same userId) that was created BEFORE the given timestamp.
 * Used to compute score diff on signal-triggered re-triages.
 */
export async function getPreviousTriageForDeal(
  userId: string,
  pitchPreviewPrefix: string,
  beforeCreatedAt: Date
): Promise<PitchTriage | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(pitchTriages)
      .where(
        and(
          eq(pitchTriages.userId, userId),
          sql`${pitchTriages.pitchPreview} LIKE ${pitchPreviewPrefix + "%"}`,
          sql`${pitchTriages.createdAt} < ${beforeCreatedAt}`
        )
      )
      .orderBy(desc(pitchTriages.createdAt))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error("[Database] getPreviousTriageForDeal failed:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Signal type summary — count per signalType for processed signals
// ---------------------------------------------------------------------------
export async function getSignalTypeSummary(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};
  try {
    const rows = await db
      .select({ signalType: dealSignals.signalType, cnt: count(dealSignals.id) })
      .from(dealSignals)
      .where(and(eq(dealSignals.userId, userId), eq(dealSignals.processed, true)))
      .groupBy(dealSignals.signalType);
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.signalType] = Number(row.cnt);
    }
    return result;
  } catch (error) {
    console.error("[Database] getSignalTypeSummary failed:", error);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Score history — last N scores for a deal (pitchPreview prefix match)
// ---------------------------------------------------------------------------
export async function getScoreHistory(
  userId: string,
  pitchPreviewPrefix: string,
  limit: number = 5
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({ score: pitchTriages.score, createdAt: pitchTriages.createdAt })
      .from(pitchTriages)
      .where(
        and(
          eq(pitchTriages.userId, userId),
          sql`${pitchTriages.pitchPreview} LIKE ${pitchPreviewPrefix + "%"}`
        )
      )
      .orderBy(desc(pitchTriages.createdAt))
      .limit(limit);
    // Return in ascending order (oldest first, newest last)
    return rows.reverse().map((r) => r.score);
  } catch (error) {
    console.error("[Database] getScoreHistory failed:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Command Center data — aggregated summary for the /command homepage
// ---------------------------------------------------------------------------
export interface CommandCenterData {
  needsAttention: Array<{
    id: number;
    pitchPreview: string;
    score: number;
    stage: string;
    triggerType: string | null;
    createdAt: Date;
  }>;
  pipelineCounts: { triaged: number; diligence: number; ic_ready: number; decision_made: number };
  recentSignals: Array<{ id: number; dealId: string; signalType: string; signalText: string; source: string; createdAt: Date }>;
  autoTriggerCount30d: number;
}

export async function getCommandCenterData(userId: string): Promise<CommandCenterData> {
  const db = await getDb();
  const empty: CommandCenterData = {
    needsAttention: [],
    pipelineCounts: { triaged: 0, diligence: 0, ic_ready: 0, decision_made: 0 },
    recentSignals: [],
    autoTriggerCount30d: 0,
  };
  if (!db) return empty;
  try {
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stale30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch recent deals for pipeline counts + needs-attention detection
    const allDeals = await db
      .select({
        id: pitchTriages.id,
        pitchPreview: pitchTriages.pitchPreview,
        score: pitchTriages.score,
        stage: pitchTriages.stage,
        triggerType: pitchTriages.triggerType,
        createdAt: pitchTriages.createdAt,
        decisionOutcome: pitchTriages.decisionOutcome,
      })
      .from(pitchTriages)
      .where(eq(pitchTriages.userId, userId))
      .orderBy(desc(pitchTriages.createdAt))
      .limit(200);

    // Needs attention: auto-triggered rows in last 7 days OR stale active deals
    const needsAttention = allDeals
      .filter((r) => {
        const isAutoTriggered = r.triggerType != null && r.createdAt >= cutoff7d;
        const isStale =
          (r.stage === "diligence" || r.stage === "ic_ready") &&
          r.decisionOutcome == null &&
          r.createdAt <= stale30d;
        return isAutoTriggered || isStale;
      })
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        pitchPreview: r.pitchPreview,
        score: r.score,
        stage: r.stage,
        triggerType: r.triggerType,
        createdAt: r.createdAt,
      }));

    // Pipeline counts
    const pipelineCounts = { triaged: 0, diligence: 0, ic_ready: 0, decision_made: 0 };
    for (const r of allDeals) {
      if (r.stage === "triaged") pipelineCounts.triaged++;
      else if (r.stage === "diligence") pipelineCounts.diligence++;
      else if (r.stage === "ic_ready") pipelineCounts.ic_ready++;
      else if (r.stage === "decision_made") pipelineCounts.decision_made++;
    }

    // Recent signals (last 10)
    const recentSignals = await db
      .select({
        id: dealSignals.id,
        dealId: dealSignals.dealId,
        signalType: dealSignals.signalType,
        signalText: dealSignals.signalText,
        source: dealSignals.source,
        createdAt: dealSignals.createdAt,
      })
      .from(dealSignals)
      .where(eq(dealSignals.userId, userId))
      .orderBy(desc(dealSignals.createdAt))
      .limit(10);

    // Auto-trigger count 30d (reuse existing helper)
    const autoTriggerCount30d = await getAutoTriggerLogCount(userId);

    return { needsAttention, pipelineCounts, recentSignals, autoTriggerCount30d };
  } catch (error) {
    console.error("[Database] getCommandCenterData failed:", error);
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Full score history — all triages for a deal (by id) ordered by createdAt ASC
// ---------------------------------------------------------------------------
export interface ScoreHistoryRow {
  id: number;
  score: number;
  createdAt: Date;
  triggerType: string | null;
  source: string | null;
}

export async function getFullScoreHistory(
  dealId: number
): Promise<ScoreHistoryRow[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: pitchTriages.id,
        score: pitchTriages.score,
        createdAt: pitchTriages.createdAt,
        triggerType: pitchTriages.triggerType,
        source: pitchTriages.source,
      })
      .from(pitchTriages)
      .where(eq(pitchTriages.id, dealId))
      .orderBy(pitchTriages.createdAt);
    return rows as ScoreHistoryRow[];
  } catch (error) {
    console.error("[Database] getFullScoreHistory failed:", error);
    return [];
  }
}
