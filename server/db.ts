import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
