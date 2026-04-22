/**
 * CMK Field Encryption Wrappers
 *
 * These helpers wrap the raw DB helpers in db.ts with CMK encrypt/decrypt.
 * They are the ONLY place that should read or write sensitive fields.
 *
 * Sensitive fields encrypted:
 *   pitchTriages   → agentOutputs, keySignals, missingInfo, topMissingFields
 *   sovereignVault → payload
 *   dealSignals    → signalText
 *   vaultDocuments → extractedText
 *
 * If a user has no active CMK key, data is stored/returned in plaintext
 * (graceful degradation — existing rows are not broken).
 * Once a key is generated, all new writes are encrypted.
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  pitchTriages,
  sovereignVault,
  dealSignals,
  vaultDocuments,
  clientEncryptionKeys,
  cmkAuditLog,
  type PitchTriage,
  type SovereignVaultEntry,
  type DealSignal,
  type VaultDocument,
} from "../drizzle/schema";
import {
  loadUserDataKey,
  encryptField,
  decryptField,
  getUserKeyRecord,
} from "./cmk";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a numeric or string userId to number for CMK key lookup */
function toNumericUserId(userId: string | number): number {
  return typeof userId === "string" ? parseInt(userId, 10) : userId;
}

async function logAudit(
  userId: number,
  operation: "field_encrypted" | "field_decrypted",
  fieldRef: string,
  keyVersion: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(cmkAuditLog)
    .values({ userId, operation, fieldRef, keyVersion })
    .catch(() => {});
}

// ── pitchTriages ──────────────────────────────────────────────────────────────

const PITCH_ENCRYPTED_FIELDS = [
  "agentOutputs",
  "keySignals",
  "missingInfo",
  "topMissingFields",
] as const;

type PitchEncryptedField = (typeof PITCH_ENCRYPTED_FIELDS)[number];

/**
 * Encrypt sensitive fields on a pitchTriage record before writing to DB.
 * Returns a new object with encrypted values (original is not mutated).
 */
export async function encryptPitchTriage(
  userId: string | number,
  data: Partial<PitchTriage>
): Promise<Partial<PitchTriage>> {
  const numId = toNumericUserId(userId);
  const dataKey = await loadUserDataKey(numId);
  if (!dataKey) return data; // no key — store plaintext

  const keyRecord = await getUserKeyRecord(numId);
  const keyVersion = keyRecord?.keyVersion ?? 1;

  const encrypted: Partial<PitchTriage> = { ...data };
  for (const field of PITCH_ENCRYPTED_FIELDS) {
    if (field in data && data[field] != null) {
      encrypted[field] = encryptField(data[field] as string, dataKey) as never;
      await logAudit(numId, "field_encrypted", `pitchTriages.${field}`, keyVersion);
    }
  }
  return encrypted;
}

/**
 * Decrypt sensitive fields on a pitchTriage record after reading from DB.
 */
export async function decryptPitchTriage(
  userId: string | number,
  row: PitchTriage
): Promise<PitchTriage> {
  const numId = toNumericUserId(userId);
  const dataKey = await loadUserDataKey(numId);
  if (!dataKey) return row;

  const keyRecord = await getUserKeyRecord(numId);
  const keyVersion = keyRecord?.keyVersion ?? 1;

  const decrypted: PitchTriage = { ...row };
  for (const field of PITCH_ENCRYPTED_FIELDS) {
    if (row[field] != null) {
      decrypted[field] = decryptField(row[field] as string, dataKey) as never;
      await logAudit(numId, "field_decrypted", `pitchTriages.${field}`, keyVersion);
    }
  }
  return decrypted;
}

export async function decryptPitchTriages(
  userId: string | number,
  rows: PitchTriage[]
): Promise<PitchTriage[]> {
  return Promise.all(rows.map((r) => decryptPitchTriage(userId, r)));
}

// ── sovereignVault ────────────────────────────────────────────────────────────

export async function encryptSovereignVaultPayload(
  userId: string | number,
  data: Partial<SovereignVaultEntry>
): Promise<Partial<SovereignVaultEntry>> {
  const numId = toNumericUserId(userId);
  const dataKey = await loadUserDataKey(numId);
  if (!dataKey || data.payload == null) return data;

  const keyRecord = await getUserKeyRecord(numId);
  const keyVersion = keyRecord?.keyVersion ?? 1;

  await logAudit(numId, "field_encrypted", "sovereignVault.payload", keyVersion);
  return { ...data, payload: encryptField(data.payload, dataKey)! };
}

export async function decryptSovereignVaultPayload(
  userId: string | number,
  row: SovereignVaultEntry
): Promise<SovereignVaultEntry> {
  const numId = toNumericUserId(userId);
  const dataKey = await loadUserDataKey(numId);
  if (!dataKey) return row;

  const keyRecord = await getUserKeyRecord(numId);
  const keyVersion = keyRecord?.keyVersion ?? 1;

  await logAudit(numId, "field_decrypted", "sovereignVault.payload", keyVersion);
  return { ...row, payload: decryptField(row.payload, dataKey) ?? row.payload };
}

// ── dealSignals ───────────────────────────────────────────────────────────────

export async function encryptDealSignal(
  userId: string | number,
  data: Partial<DealSignal>
): Promise<Partial<DealSignal>> {
  const numId = toNumericUserId(userId);
  const dataKey = await loadUserDataKey(numId);
  if (!dataKey || data.signalText == null) return data;

  const keyRecord = await getUserKeyRecord(numId);
  const keyVersion = keyRecord?.keyVersion ?? 1;

  await logAudit(numId, "field_encrypted", "dealSignals.signalText", keyVersion);
  return { ...data, signalText: encryptField(data.signalText, dataKey)! };
}

export async function decryptDealSignal(
  userId: string | number,
  row: DealSignal
): Promise<DealSignal> {
  const numId = toNumericUserId(userId);
  const dataKey = await loadUserDataKey(numId);
  if (!dataKey) return row;

  const keyRecord = await getUserKeyRecord(numId);
  const keyVersion = keyRecord?.keyVersion ?? 1;

  await logAudit(numId, "field_decrypted", "dealSignals.signalText", keyVersion);
  return { ...row, signalText: decryptField(row.signalText, dataKey) ?? row.signalText };
}

export async function decryptDealSignals(
  userId: string | number,
  rows: DealSignal[]
): Promise<DealSignal[]> {
  return Promise.all(rows.map((r) => decryptDealSignal(userId, r)));
}

// ── vaultDocuments ────────────────────────────────────────────────────────────

export async function encryptVaultDocument(
  userId: string | number,
  data: Partial<VaultDocument>
): Promise<Partial<VaultDocument>> {
  const numId = toNumericUserId(userId);
  const dataKey = await loadUserDataKey(numId);
  if (!dataKey || data.extractedText == null) return data;

  const keyRecord = await getUserKeyRecord(numId);
  const keyVersion = keyRecord?.keyVersion ?? 1;

  await logAudit(numId, "field_encrypted", "vaultDocuments.extractedText", keyVersion);
  return { ...data, extractedText: encryptField(data.extractedText, dataKey) };
}

export async function decryptVaultDocument(
  userId: string | number,
  row: VaultDocument
): Promise<VaultDocument> {
  const numId = toNumericUserId(userId);
  const dataKey = await loadUserDataKey(numId);
  if (!dataKey) return row;

  const keyRecord = await getUserKeyRecord(numId);
  const keyVersion = keyRecord?.keyVersion ?? 1;

  await logAudit(numId, "field_decrypted", "vaultDocuments.extractedText", keyVersion);
  return { ...row, extractedText: decryptField(row.extractedText, dataKey) };
}

export async function decryptVaultDocuments(
  userId: string | number,
  rows: VaultDocument[]
): Promise<VaultDocument[]> {
  return Promise.all(rows.map((r) => decryptVaultDocument(userId, r)));
}

// ── Key rotation helper: re-encrypt all user data with a new key ──────────────

/**
 * Re-encrypt all sensitive fields for a user with a new data key.
 * Called by the rotateKey tRPC procedure after generating the new key.
 * Old key is used to decrypt; new key is used to re-encrypt.
 */
export async function reEncryptUserData(
  userId: number,
  oldDataKey: Buffer,
  newDataKey: Buffer
): Promise<{ reEncryptedRows: number }> {
  const db = await getDb();
  if (!db) throw new Error("[CMK] Database unavailable");

  let count = 0;
  const numUserId = String(userId);

  // pitchTriages
  const pitchRows = await db
    .select()
    .from(pitchTriages)
    .where(eq(pitchTriages.userId, numUserId));

  for (const row of pitchRows) {
    const updates: Partial<PitchTriage> = {};
    for (const field of PITCH_ENCRYPTED_FIELDS) {
      const val = row[field] as string | null;
      if (val != null) {
        const plain = decryptField(val, oldDataKey);
        updates[field] = (plain != null ? encryptField(plain, newDataKey) : val) as never;
      }
    }
    if (Object.keys(updates).length > 0) {
      await db.update(pitchTriages).set(updates).where(eq(pitchTriages.id, row.id));
      count++;
    }
  }

  // sovereignVault — uses dealId as userId proxy; filter by rows this user owns
  // (sovereignVault doesn't have a userId column — skip for now, document as known gap)

  // dealSignals
  const signalRows = await db
    .select()
    .from(dealSignals)
    .where(eq(dealSignals.userId, numUserId));

  for (const row of signalRows) {
    if (row.signalText) {
      const plain = decryptField(row.signalText, oldDataKey);
      const newVal = plain != null ? encryptField(plain, newDataKey) : row.signalText;
      await db.update(dealSignals).set({ signalText: newVal! }).where(eq(dealSignals.id, row.id));
      count++;
    }
  }

  // vaultDocuments
  const docRows = await db
    .select()
    .from(vaultDocuments)
    .where(eq(vaultDocuments.userId, userId));

  for (const row of docRows) {
    if (row.extractedText) {
      const plain = decryptField(row.extractedText, oldDataKey);
      const newVal = plain != null ? encryptField(plain, newDataKey) : row.extractedText;
      await db.update(vaultDocuments).set({ extractedText: newVal }).where(eq(vaultDocuments.id, row.id));
      count++;
    }
  }

  return { reEncryptedRows: count };
}
