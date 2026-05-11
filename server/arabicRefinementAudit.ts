/**
 * arabicRefinementAudit.ts
 * Server-side helpers for SADO Arabic Refinement v1.1:
 *   - Tenant policy CRUD (with key generation)
 *   - ed25519 signing / verification via Node crypto
 *   - AuditStorageAdapter interface + LocalFileAdapter + S3CompatibleAdapter
 *
 * No new npm dependencies — uses Node built-in `crypto` and the existing
 * `storagePut` / `storageGet` helpers from server/storage.ts.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { arabicRefinementPolicy } from "../drizzle/sadoSchema";
import { eq } from "drizzle-orm";
import { storagePut, storageGet } from "./storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TenantPolicy {
  tenantId: string;
  dialectLlmFallbackThreshold: number;
  encodingIssuesReviewCutoff: number;
  piiSeverityOverrides: Record<string, "HIGH" | "MEDIUM" | "LOW">;
  llmFallbackEnabled: boolean;
  auditStorageAdapter: "local" | "s3";
  signingPublicKey: string | null; // base64 DER SPKI
}

export interface SignedAuditRecord {
  payload: string;          // JSON string of the audit record
  signature: string;        // hex-encoded ed25519 signature
  publicKey: string;        // base64 DER SPKI
  signedAt: string;         // ISO timestamp
  schemaVersion: "1.1";
}

export interface VerifyResult {
  valid: boolean;
  reason: string;
}

// ─── Default policy (matches v1.0 hardcoded constants) ───────────────────────

export const DEFAULT_POLICY: Omit<TenantPolicy, "tenantId" | "signingPublicKey"> = {
  dialectLlmFallbackThreshold: 40,
  encodingIssuesReviewCutoff: 3,
  piiSeverityOverrides: {},
  llmFallbackEnabled: true,
  auditStorageAdapter: "local",
};

// ─── Policy helpers ───────────────────────────────────────────────────────────

/**
 * Load tenant policy from DB. Returns defaults if no row exists.
 * Never throws — returns defaults on any DB error.
 */
export async function loadPolicy(tenantId: string): Promise<TenantPolicy> {
  try {
    const db = await getDb();
    if (!db) return { ...DEFAULT_POLICY, tenantId, signingPublicKey: null };
    const rows = await db
      .select()
      .from(arabicRefinementPolicy)
      .where(eq(arabicRefinementPolicy.tenantId, tenantId))
      .limit(1);
    if (rows.length === 0) return { ...DEFAULT_POLICY, tenantId, signingPublicKey: null };
    const row = rows[0];
    let piiOverrides: Record<string, "HIGH" | "MEDIUM" | "LOW"> = {};
    if (row.piiSeverityOverrides) {
      try { piiOverrides = JSON.parse(row.piiSeverityOverrides); } catch { /* ignore */ }
    }
    return {
      tenantId: row.tenantId,
      dialectLlmFallbackThreshold: row.dialectLlmFallbackThreshold,
      encodingIssuesReviewCutoff: row.encodingIssuesReviewCutoff,
      piiSeverityOverrides: piiOverrides,
      llmFallbackEnabled: row.llmFallbackEnabled,
      auditStorageAdapter: (row.auditStorageAdapter as "local" | "s3") ?? "local",
      signingPublicKey: row.signingPublicKey ?? null,
    };
  } catch {
    return { ...DEFAULT_POLICY, tenantId, signingPublicKey: null };
  }
}

/**
 * Upsert a tenant policy row. Generates a new ed25519 key pair if none exists.
 * Returns the public key (base64 DER SPKI).
 */
export async function upsertPolicy(
  tenantId: string,
  updates: Partial<Omit<TenantPolicy, "tenantId" | "signingPublicKey">>,
): Promise<TenantPolicy> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await db
    .select()
    .from(arabicRefinementPolicy)
    .where(eq(arabicRefinementPolicy.tenantId, tenantId))
    .limit(1);

  let privateKeyB64: string;
  let publicKeyB64: string;

  if (existing.length > 0 && existing[0].signingPrivateKey && existing[0].signingPublicKey) {
    privateKeyB64 = existing[0].signingPrivateKey;
    publicKeyB64 = existing[0].signingPublicKey;
  } else {
    // Generate a new ed25519 key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "der" },
      publicKeyEncoding: { type: "spki", format: "der" },
    });
    privateKeyB64 = (privateKey as unknown as Buffer).toString("base64");
    publicKeyB64 = (publicKey as unknown as Buffer).toString("base64");
  }

  const now = Date.now();
  const piiJson = updates.piiSeverityOverrides
    ? JSON.stringify(updates.piiSeverityOverrides)
    : (existing[0]?.piiSeverityOverrides ?? null);

  const row = {
    tenantId,
    dialectLlmFallbackThreshold:
      updates.dialectLlmFallbackThreshold ??
      existing[0]?.dialectLlmFallbackThreshold ??
      DEFAULT_POLICY.dialectLlmFallbackThreshold,
    encodingIssuesReviewCutoff:
      updates.encodingIssuesReviewCutoff ??
      existing[0]?.encodingIssuesReviewCutoff ??
      DEFAULT_POLICY.encodingIssuesReviewCutoff,
    piiSeverityOverrides: piiJson,
    llmFallbackEnabled:
      updates.llmFallbackEnabled ??
      existing[0]?.llmFallbackEnabled ??
      DEFAULT_POLICY.llmFallbackEnabled,
    auditStorageAdapter:
      updates.auditStorageAdapter ??
      existing[0]?.auditStorageAdapter ??
      DEFAULT_POLICY.auditStorageAdapter,
    signingPrivateKey: privateKeyB64,
    signingPublicKey: publicKeyB64,
    updatedAt: now,
    createdAt: existing[0]?.createdAt ?? now,
  };

  if (existing.length > 0) {
    await db
      .update(arabicRefinementPolicy)
      .set(row)
      .where(eq(arabicRefinementPolicy.tenantId, tenantId));
  } else {
    await db.insert(arabicRefinementPolicy).values(row);
  }

  return {
    tenantId,
    dialectLlmFallbackThreshold: row.dialectLlmFallbackThreshold,
    encodingIssuesReviewCutoff: row.encodingIssuesReviewCutoff,
    piiSeverityOverrides: updates.piiSeverityOverrides ?? {},
    llmFallbackEnabled: row.llmFallbackEnabled,
    auditStorageAdapter: row.auditStorageAdapter as "local" | "s3",
    signingPublicKey: publicKeyB64,
  };
}

/**
 * Load the raw private key for a tenant (for signing).
 * Returns null if not found.
 */
async function loadPrivateKey(tenantId: string): Promise<crypto.KeyObject | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select({ signingPrivateKey: arabicRefinementPolicy.signingPrivateKey })
      .from(arabicRefinementPolicy)
      .where(eq(arabicRefinementPolicy.tenantId, tenantId))
      .limit(1);
    if (rows.length === 0 || !rows[0].signingPrivateKey) return null;
    const der = Buffer.from(rows[0].signingPrivateKey, "base64");
    return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  } catch {
    return null;
  }
}

// ─── Signing / verification ───────────────────────────────────────────────────

/**
 * Sign an audit payload JSON string with the tenant's ed25519 private key.
 * If no key exists, upserts a policy row to generate one first.
 */
export async function signAuditRecord(
  tenantId: string,
  payloadJson: string,
  publicKeyB64: string,
): Promise<SignedAuditRecord> {
  let privKey = await loadPrivateKey(tenantId);
  if (!privKey) {
    // Auto-provision keys
    const policy = await upsertPolicy(tenantId, {});
    privKey = await loadPrivateKey(tenantId);
    if (!privKey) throw new Error("Failed to provision signing key");
    publicKeyB64 = policy.signingPublicKey ?? publicKeyB64;
  }
  const sig = crypto.sign(null, Buffer.from(payloadJson, "utf8"), privKey);
  return {
    payload: payloadJson,
    signature: sig.toString("hex"),
    publicKey: publicKeyB64,
    signedAt: new Date().toISOString(),
    schemaVersion: "1.1",
  };
}

/**
 * Verify a signed audit record.
 * Accepts the SignedAuditRecord object and verifies the signature against the embedded public key.
 */
export function verifySignedAuditRecord(record: SignedAuditRecord): VerifyResult {
  try {
    const pubDer = Buffer.from(record.publicKey, "base64");
    const pubKey = crypto.createPublicKey({ key: pubDer, format: "der", type: "spki" });
    const sigBuf = Buffer.from(record.signature, "hex");
    const payloadBuf = Buffer.from(record.payload, "utf8");
    const valid = crypto.verify(null, payloadBuf, pubKey, sigBuf);
    return valid
      ? { valid: true, reason: "Signature valid — record has not been tampered with." }
      : { valid: false, reason: "Signature mismatch — record may have been tampered with." };
  } catch (err) {
    return { valid: false, reason: `Verification error: ${String(err)}` };
  }
}

// ─── Storage adapters ─────────────────────────────────────────────────────────

export interface AuditStorageAdapter {
  save(traceId: string, content: string, contentType: string): Promise<string>; // returns URL or path
  load(traceId: string): Promise<string | null>;
}

/** LocalFileAdapter — writes to /tmp/sado-audit/<traceId>.json */
export class LocalFileAdapter implements AuditStorageAdapter {
  private dir: string;
  constructor(dir = "/tmp/sado-audit") {
    this.dir = dir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  async save(traceId: string, content: string, _contentType: string): Promise<string> {
    const filePath = path.join(this.dir, `${traceId}.json`);
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
  }
  async load(traceId: string): Promise<string | null> {
    const filePath = path.join(this.dir, `${traceId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
  }
}

/** S3CompatibleAdapter — uses the project's storagePut/storageGet helpers */
export class S3CompatibleAdapter implements AuditStorageAdapter {
  private prefix: string;
  constructor(prefix = "sado-audit") {
    this.prefix = prefix;
  }
  async save(traceId: string, content: string, contentType: string): Promise<string> {
    const key = `${this.prefix}/${traceId}.json`;
    const { url } = await storagePut(key, Buffer.from(content, "utf8"), contentType);
    return url;
  }
  async load(traceId: string): Promise<string | null> {
    try {
      const key = `${this.prefix}/${traceId}.json`;
      const { url } = await storageGet(key);
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return await resp.text();
    } catch {
      return null;
    }
  }
}

/** Factory: returns the correct adapter based on policy */
export function getStorageAdapter(adapter: "local" | "s3"): AuditStorageAdapter {
  if (adapter === "s3") return new S3CompatibleAdapter();
  return new LocalFileAdapter();
}
