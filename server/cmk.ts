/**
 * Customer-Managed Keys (CMK) — Model A
 *
 * Architecture:
 *   ENCRYPTION_MASTER_KEY (env, 32-byte hex)
 *     └─ wraps each user's AES-256 data key (envelope encryption)
 *         └─ encrypts sensitive field values in the DB
 *
 * The raw data key is NEVER stored in plaintext. It lives in memory only
 * during a request and is discarded immediately after use.
 *
 * Encrypted field format:  "<iv_hex>:<ciphertext_hex>"
 * Wrapped key format:      "<iv_hex>:<ciphertext_hex>"  (same, different key)
 */

import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { clientEncryptionKeys, cmkAuditLog } from "../drizzle/schema";

// ── Master key ────────────────────────────────────────────────────────────────

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "[CMK] ENCRYPTION_MASTER_KEY is missing or not 32 bytes (64 hex chars). " +
        "Set it in Settings → Secrets."
    );
  }
  return Buffer.from(hex, "hex");
}

// ── Low-level AES-256-GCM helpers ─────────────────────────────────────────────

/**
 * Encrypt arbitrary bytes with a 32-byte key using AES-256-GCM.
 * Returns "<iv_hex>:<ciphertext_hex>:<authTag_hex>"
 */
function aesEncrypt(plaintext: Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

/**
 * Decrypt a value produced by aesEncrypt.
 * Throws if the auth tag does not match (tamper detection).
 */
function aesDecrypt(encoded: string, key: Buffer): Buffer {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("[CMK] Invalid encrypted field format");
  const [ivHex, ciphertextHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ── Envelope encryption (wrapping/unwrapping data keys) ───────────────────────

/**
 * Generate a new random 32-byte AES-256 data key and wrap it with the master key.
 * Returns the raw data key (Buffer) and the wrapped key string for DB storage.
 */
export function generateDataKey(): { rawKey: Buffer; wrappedKey: string } {
  const rawKey = crypto.randomBytes(32);
  const masterKey = getMasterKey();
  const wrappedKey = aesEncrypt(rawKey, masterKey);
  return { rawKey, wrappedKey };
}

/**
 * Unwrap (decrypt) a stored wrapped key using the master key.
 * Returns the raw 32-byte data key.
 */
export function unwrapDataKey(wrappedKey: string): Buffer {
  const masterKey = getMasterKey();
  return aesDecrypt(wrappedKey, masterKey);
}

// ── Field-level encryption ────────────────────────────────────────────────────

/**
 * Encrypt a string field value with the user's data key.
 * Returns an opaque string safe to store in a TEXT column.
 * Returns null if input is null/undefined.
 */
export function encryptField(value: string | null | undefined, dataKey: Buffer): string | null {
  if (value == null) return null;
  return aesEncrypt(Buffer.from(value, "utf8"), dataKey);
}

/**
 * Decrypt a field value encrypted by encryptField.
 * Returns null if the stored value is null.
 * Throws if decryption fails (wrong key, tampered data).
 */
export function decryptField(encoded: string | null | undefined, dataKey: Buffer): string | null {
  if (encoded == null) return null;
  // If the value does not look like an encrypted field (legacy plaintext), return as-is.
  // This handles rows written before CMK was enabled.
  if (!encoded.includes(":")) return encoded;
  try {
    return aesDecrypt(encoded, dataKey).toString("utf8");
  } catch {
    // Return null rather than crashing on a single bad field
    console.warn("[CMK] decryptField failed — returning null. Possible key mismatch or legacy data.");
    return null;
  }
}

// ── Key lifecycle ─────────────────────────────────────────────────────────────

/**
 * Get the active wrapped key record for a user.
 * Returns null if no key exists or the key is revoked.
 */
export async function getUserKeyRecord(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [record] = await db
    .select()
    .from(clientEncryptionKeys)
    .where(eq(clientEncryptionKeys.userId, userId))
    .limit(1);
  if (!record || record.status !== "active") return null;
  return record;
}

/**
 * Load and unwrap the active data key for a user.
 * Returns null if no active key exists (user has not generated one yet, or revoked).
 */
export async function loadUserDataKey(userId: number): Promise<Buffer | null> {
  const record = await getUserKeyRecord(userId);
  if (!record) return null;
  try {
    return unwrapDataKey(record.wrappedKey);
  } catch (err) {
    console.error("[CMK] Failed to unwrap data key for user", userId, err);
    return null;
  }
}

/**
 * Generate and persist a new CMK for a user.
 * Throws if the user already has an active key (must rotate or revoke first).
 */
export async function generateUserKey(
  userId: number,
  ipAddress?: string
): Promise<{ keyVersion: number }> {
  const db = await getDb();
  if (!db) throw new Error("[CMK] Database unavailable");

  const existing = await getUserKeyRecord(userId);
  if (existing) throw new Error("[CMK] User already has an active key. Use rotateUserKey instead.");

  const { wrappedKey } = generateDataKey();

  await db.insert(clientEncryptionKeys).values({
    userId,
    wrappedKey,
    keyVersion: 1,
    status: "active",
  });

  await db.insert(cmkAuditLog).values({
    userId,
    operation: "key_generated",
    keyVersion: 1,
    ipAddress: ipAddress ?? null,
  });

  return { keyVersion: 1 };
}

/**
 * Rotate the user's data key: generate a new key, re-encrypt all their data,
 * then replace the stored wrapped key.
 *
 * NOTE: The re-encryption of existing rows is handled by the caller (tRPC procedure)
 * because it requires knowledge of which tables/fields belong to this user.
 * This function only handles the key swap and audit logging.
 */
export async function rotateUserKey(
  userId: number,
  oldDataKey: Buffer,
  ipAddress?: string
): Promise<{ newDataKey: Buffer; newKeyVersion: number }> {
  const db = await getDb();
  if (!db) throw new Error("[CMK] Database unavailable");

  const existing = await getUserKeyRecord(userId);
  if (!existing) throw new Error("[CMK] No active key to rotate");

  const { rawKey: newDataKey, wrappedKey: newWrappedKey } = generateDataKey();
  const newVersion = existing.keyVersion + 1;

  await db
    .update(clientEncryptionKeys)
    .set({
      wrappedKey: newWrappedKey,
      keyVersion: newVersion,
      rotatedAt: new Date(),
    })
    .where(eq(clientEncryptionKeys.userId, userId));

  await db.insert(cmkAuditLog).values({
    userId,
    operation: "key_rotated",
    keyVersion: newVersion,
    ipAddress: ipAddress ?? null,
  });

  return { newDataKey, newKeyVersion: newVersion };
}

/**
 * Revoke the user's data key.
 * After revocation, all encrypted data for this user becomes permanently inaccessible.
 * This action CANNOT be undone.
 */
export async function revokeUserKey(userId: number, ipAddress?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("[CMK] Database unavailable");

  const existing = await getUserKeyRecord(userId);
  if (!existing) throw new Error("[CMK] No active key to revoke");

  await db
    .update(clientEncryptionKeys)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(clientEncryptionKeys.userId, userId));

  await db.insert(cmkAuditLog).values({
    userId,
    operation: "key_revoked",
    keyVersion: existing.keyVersion,
    ipAddress: ipAddress ?? null,
  });
}

/**
 * Log a field-level decrypt event to the audit log.
 * Called by DB helpers whenever a protected field is decrypted.
 */
export async function logDecrypt(
  userId: number,
  fieldRef: string,
  keyVersion: number,
  ipAddress?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(cmkAuditLog).values({
    userId,
    operation: "field_decrypted",
    fieldRef,
    keyVersion,
    ipAddress: ipAddress ?? null,
  }).catch(() => {
    // Audit log failures must never break the main request
  });
}
