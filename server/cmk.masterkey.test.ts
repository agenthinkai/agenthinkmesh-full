/**
 * Tests for system-level master-key encryption helpers:
 *   encryptWithMasterKey / decryptWithMasterKey
 *
 * These helpers are used to encrypt agentOutputs on every new pitch_triages
 * insert, using ENCRYPTION_MASTER_KEY directly (no per-user data key needed).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { encryptWithMasterKey, decryptWithMasterKey } from "./cmk";

// Provide a deterministic 32-byte test key (64 hex chars)
const TEST_KEY = "a".repeat(64);

beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = TEST_KEY;
});

describe("encryptWithMasterKey", () => {
  it("returns null for null input", () => {
    expect(encryptWithMasterKey(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(encryptWithMasterKey(undefined)).toBeNull();
  });

  it("returns a string starting with 'sys:'", () => {
    const result = encryptWithMasterKey("hello world");
    expect(result).not.toBeNull();
    expect(result!.startsWith("sys:")).toBe(true);
  });

  it("produces different ciphertext on each call (random IV)", () => {
    const a = encryptWithMasterKey("same plaintext");
    const b = encryptWithMasterKey("same plaintext");
    expect(a).not.toEqual(b);
  });

  it("encrypted value is not readable as plaintext", () => {
    const plaintext = "sensitive agent reasoning output";
    const encrypted = encryptWithMasterKey(plaintext)!;
    expect(encrypted).not.toContain(plaintext);
  });
});

describe("decryptWithMasterKey", () => {
  it("returns null for null input", () => {
    expect(decryptWithMasterKey(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(decryptWithMasterKey(undefined)).toBeNull();
  });

  it("round-trips a short string", () => {
    const plaintext = "hello world";
    const encrypted = encryptWithMasterKey(plaintext)!;
    expect(decryptWithMasterKey(encrypted)).toBe(plaintext);
  });

  it("round-trips a long JSON string (typical agentOutputs payload)", () => {
    const payload = JSON.stringify([
      { name: "Traction", label: "strong", reasoning: "MoM growth of 25%", fallback: false },
      { name: "Market Signal", label: "clear", reasoning: "TAM > $5B", fallback: false },
      { name: "Founder Signal", label: "strong", reasoning: "Serial founder, 2 exits", fallback: false },
      { name: "Business Model", label: "complete", reasoning: "SaaS, 80% gross margin", fallback: false },
      { name: "Risk", label: "low", reasoning: "No regulatory exposure", fallback: false },
    ]);
    const encrypted = encryptWithMasterKey(payload)!;
    const decrypted = decryptWithMasterKey(encrypted);
    expect(decrypted).toBe(payload);
    // Confirm we can JSON.parse the decrypted value
    const parsed = JSON.parse(decrypted!);
    expect(parsed).toHaveLength(5);
    expect(parsed[0].name).toBe("Traction");
  });

  it("returns legacy plaintext as-is when no 'sys:' prefix (old records)", () => {
    const legacyPlaintext = '[{"name":"Traction","label":"strong"}]';
    expect(decryptWithMasterKey(legacyPlaintext)).toBe(legacyPlaintext);
  });

  it("returns null and warns on tampered ciphertext", () => {
    const encrypted = encryptWithMasterKey("sensitive data")!;
    // Format: "sys:<iv_hex>:<ciphertext_hex>:<authTag_hex>"
    // Flip every character in the ciphertext segment to guarantee auth tag mismatch
    const [sys, iv, ciphertext, authTag] = encrypted.split(":");
    const flippedCiphertext = ciphertext.split("").map((c) =>
      c === "0" ? "f" : "0"
    ).join("");
    const tampered = [sys, iv, flippedCiphertext, authTag].join(":");
    const result = decryptWithMasterKey(tampered);
    expect(result).toBeNull();
  });

  it("encrypted value does NOT start with plaintext content", () => {
    const plaintext = "agent reasoning: strong traction signal";
    const encrypted = encryptWithMasterKey(plaintext)!;
    // The encrypted blob must not expose the plaintext
    expect(encrypted).not.toContain("agent reasoning");
    expect(encrypted).not.toContain("traction");
  });
});

describe("savePitchTriage encryption contract", () => {
  it("encryptWithMasterKey output fits in a TEXT column (no size limit)", () => {
    // agentOutputs is TEXT — no size constraint. Verify a realistic payload encrypts fine.
    const bigPayload = JSON.stringify(
      Array.from({ length: 10 }, (_, i) => ({
        name: `Agent ${i}`,
        label: "strong",
        reasoning: "A".repeat(500),
        fallback: false,
      }))
    );
    const encrypted = encryptWithMasterKey(bigPayload)!;
    expect(encrypted.startsWith("sys:")).toBe(true);
    expect(decryptWithMasterKey(encrypted)).toBe(bigPayload);
  });
});
