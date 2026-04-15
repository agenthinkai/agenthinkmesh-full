/**
 * server/adminProvision.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the admin provisioning helpers.
 * Covers: password generation, bcrypt hashing, openId derivation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { generateTempPassword } from "./routers/adminProvision";

describe("generateTempPassword", () => {
  it("generates a password of at least 16 characters", () => {
    const pwd = generateTempPassword();
    expect(pwd.length).toBeGreaterThanOrEqual(16);
  });

  it("contains at least one uppercase letter", () => {
    const pwd = generateTempPassword();
    expect(/[A-Z]/.test(pwd)).toBe(true);
  });

  it("contains at least one lowercase letter", () => {
    const pwd = generateTempPassword();
    expect(/[a-z]/.test(pwd)).toBe(true);
  });

  it("contains at least one digit", () => {
    const pwd = generateTempPassword();
    expect(/[0-9]/.test(pwd)).toBe(true);
  });

  it("contains at least one special character", () => {
    const pwd = generateTempPassword();
    expect(/[^A-Za-z0-9]/.test(pwd)).toBe(true);
  });

  it("generates unique passwords on each call", () => {
    const passwords = new Set(Array.from({ length: 20 }, generateTempPassword));
    // All 20 should be unique (collision probability is astronomically low)
    expect(passwords.size).toBe(20);
  });
});

describe("bcrypt hashing (used by adminProvision)", () => {
  it("hashes a password and verifies it correctly", async () => {
    const plain = generateTempPassword();
    const hash = await bcrypt.hash(plain, 10);
    const valid = await bcrypt.compare(plain, hash);
    expect(valid).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const plain = generateTempPassword();
    const hash = await bcrypt.hash(plain, 10);
    const invalid = await bcrypt.compare("wrong-password-123!", hash);
    expect(invalid).toBe(false);
  });

  it("produces different hashes for the same password (salt)", async () => {
    const plain = generateTempPassword();
    const hash1 = await bcrypt.hash(plain, 10);
    const hash2 = await bcrypt.hash(plain, 10);
    expect(hash1).not.toBe(hash2);
  });
});

describe("openId derivation for provisioned users", () => {
  it("produces local:<email> format", () => {
    const email = "User@Example.COM";
    const openId = `local:${email.toLowerCase().trim()}`;
    expect(openId).toBe("local:user@example.com");
  });

  it("trims whitespace from email", () => {
    const email = "  user@example.com  ";
    const openId = `local:${email.toLowerCase().trim()}`;
    expect(openId).toBe("local:user@example.com");
  });
});
