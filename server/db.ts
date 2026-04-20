import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertPitchTriage, InsertUser, pitchTriages, pitchMirrorShares, users } from "../drizzle/schema";
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

export async function getPitchTriageHistory(userId: string, limit = 50) {
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
