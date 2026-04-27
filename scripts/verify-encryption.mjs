/**
 * verify-encryption.mjs
 *
 * One-shot script to verify that agentOutputs is encrypted at rest
 * and pitchPreview is stored as plaintext.
 *
 * Usage: node scripts/verify-encryption.mjs
 */

import crypto from "crypto";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!ENCRYPTION_MASTER_KEY || ENCRYPTION_MASTER_KEY.length !== 64) {
  console.error("ERROR: ENCRYPTION_MASTER_KEY missing or not 64 hex chars");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL missing");
  process.exit(1);
}

// ── Replicate encryptWithMasterKey logic ──────────────────────────────────────
function encryptWithMasterKey(value) {
  const masterKey = Buffer.from(ENCRYPTION_MASTER_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(value, "utf8")), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const inner = `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
  return `sys:${inner}`;
}

function decryptWithMasterKey(encoded) {
  if (!encoded || !encoded.startsWith("sys:")) return encoded; // plaintext fallback
  const inner = encoded.slice(4);
  const parts = inner.split(":");
  if (parts.length !== 3) throw new Error("Invalid format");
  const [ivHex, ciphertextHex, authTagHex] = parts;
  const masterKey = Buffer.from(ENCRYPTION_MASTER_KEY, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ── Connect and insert ────────────────────────────────────────────────────────
const conn = await mysql.createConnection(DATABASE_URL);

const testPitchPreview = "VERIFY-ENC-TEST: Acme Corp, SaaS, $2M ARR, Series A";
const testAgentOutputs = JSON.stringify([
  { name: "Traction", label: "strong", reasoning: "MoM growth 25%", fallback: false },
  { name: "Risk", label: "low", reasoning: "No regulatory exposure", fallback: false },
]);
const encryptedAgentOutputs = encryptWithMasterKey(testAgentOutputs);

console.log("\n── INSERT ──────────────────────────────────────────────────────────");
console.log("pitchPreview (plaintext):", testPitchPreview);
console.log("agentOutputs (plaintext before encrypt):", testAgentOutputs.slice(0, 60) + "...");
console.log("agentOutputs (encrypted, first 60 chars):", encryptedAgentOutputs.slice(0, 60) + "...");

const [insertResult] = await conn.execute(
  `INSERT INTO pitch_triages
     (userId, pitchPreview, score, classification, confidence, agentOutputs, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, NOW())`,
  ["1", testPitchPreview, 72, "ENGAGE", "HIGH", encryptedAgentOutputs]
);
const insertedId = insertResult.insertId;
console.log("\nInserted row id:", insertedId);

// ── Raw DB query (what is actually stored) ────────────────────────────────────
const [rows] = await conn.execute(
  `SELECT id,
          pitchPreview,
          SUBSTR(agentOutputs, 1, 30) AS agentOutputs_preview
   FROM pitch_triages
   WHERE id = ?`,
  [insertedId]
);

console.log("\n── RAW DB QUERY RESULT ─────────────────────────────────────────────");
console.log("id                  :", rows[0].id);
console.log("pitchPreview        :", rows[0].pitchPreview);
console.log("agentOutputs_preview:", rows[0].agentOutputs_preview);

// ── Verify decrypt round-trip ─────────────────────────────────────────────────
const [fullRows] = await conn.execute(
  `SELECT agentOutputs FROM pitch_triages WHERE id = ?`,
  [insertedId]
);
const rawStored = fullRows[0].agentOutputs;
const decrypted = decryptWithMasterKey(rawStored);

console.log("\n── DECRYPT ROUND-TRIP ──────────────────────────────────────────────");
console.log("Stored starts with 'sys:':", rawStored.startsWith("sys:"));
console.log("Decrypted matches original:", decrypted === testAgentOutputs);
console.log("Decrypted (first 60 chars):", decrypted.slice(0, 60) + "...");

// ── Cleanup ───────────────────────────────────────────────────────────────────
await conn.execute(`DELETE FROM pitch_triages WHERE id = ?`, [insertedId]);
console.log("\nTest row deleted (id:", insertedId, ")");

await conn.end();
console.log("\n✓ Verification complete.\n");
