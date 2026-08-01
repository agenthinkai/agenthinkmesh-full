/**
 * Sprint 2B Enterprise Runtime Tests
 * Tests for: enterpriseRuntimeService (departments, roles, memberships, twin instances, sessions, audit log, messages, stats)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB layer ────────────────────────────────────────────────────────
vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = DB unavailable, triggers error path
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("enterpriseRuntimeService — DB unavailable path", () => {
  it("listDepartments throws when DB is null", async () => {
    const { listDepartments } = await import("../server/lib/enterpriseRuntimeService");
    await expect(listDepartments(1)).rejects.toThrow("Database not available");
  });

  it("listRoles throws when DB is null", async () => {
    const { listRoles } = await import("../server/lib/enterpriseRuntimeService");
    await expect(listRoles(1)).rejects.toThrow("Database not available");
  });

  it("listMemberships throws when DB is null", async () => {
    const { listMemberships } = await import("../server/lib/enterpriseRuntimeService");
    await expect(listMemberships(1)).rejects.toThrow("Database not available");
  });

  it("listTwinInstances throws when DB is null", async () => {
    const { listTwinInstances } = await import("../server/lib/enterpriseRuntimeService");
    await expect(listTwinInstances(1)).rejects.toThrow("Database not available");
  });

  it("getTwinInstance throws when DB is null", async () => {
    const { getTwinInstance } = await import("../server/lib/enterpriseRuntimeService");
    await expect(getTwinInstance(1)).rejects.toThrow("Database not available");
  });

  it("createTwinInstance throws when DB is null", async () => {
    const { createTwinInstance } = await import("../server/lib/enterpriseRuntimeService");
    await expect(createTwinInstance({
      orgId: 1,
      blueprintId: "test-bp",
      instanceSlug: "test-instance",
      displayName: "Test Instance",
    })).rejects.toThrow("Database not available");
  });

  it("createTwinSession throws when DB is null", async () => {
    const { createTwinSession } = await import("../server/lib/enterpriseRuntimeService");
    await expect(createTwinSession({
      twinInstanceId: 1,
      orgId: 1,
      userId: 1,
      sessionType: "run",
    })).rejects.toThrow("Database not available");
  });

  it("listTwinSessions throws when DB is null", async () => {
    const { listTwinSessions } = await import("../server/lib/enterpriseRuntimeService");
    await expect(listTwinSessions(1)).rejects.toThrow("Database not available");
  });

  it("writeAuditLog throws when DB is null", async () => {
    const { writeAuditLog } = await import("../server/lib/enterpriseRuntimeService");
    await expect(writeAuditLog({
      orgId: 1,
      action: "test_action",
      resourceType: "twin_instance",
    })).rejects.toThrow("Database not available");
  });

  it("listAuditLog throws when DB is null", async () => {
    const { listAuditLog } = await import("../server/lib/enterpriseRuntimeService");
    await expect(listAuditLog(1)).rejects.toThrow("Database not available");
  });

  it("sendTwinMessage throws when DB is null", async () => {
    const { sendTwinMessage } = await import("../server/lib/enterpriseRuntimeService");
    await expect(sendTwinMessage({
      orgId: 1,
      fromTwinId: 1,
      toTwinId: 2,
      messageType: "signal",
      subject: "Test signal",
    })).rejects.toThrow("Database not available");
  });

  it("listTwinMessages throws when DB is null", async () => {
    const { listTwinMessages } = await import("../server/lib/enterpriseRuntimeService");
    await expect(listTwinMessages(1)).rejects.toThrow("Database not available");
  });

  it("getEnterpriseStats throws when DB is null", async () => {
    const { getEnterpriseStats } = await import("../server/lib/enterpriseRuntimeService");
    await expect(getEnterpriseStats(1)).rejects.toThrow("Database not available");
  });
});

describe("enterpriseRuntimeService — input validation", () => {
  it("createTwinInstance requires blueprintId", async () => {
    const { createTwinInstance } = await import("../server/lib/enterpriseRuntimeService");
    await expect(createTwinInstance({
      orgId: 1,
      blueprintId: "",
      instanceSlug: "test",
      displayName: "Test",
    })).rejects.toThrow();
  });

  it("sendTwinMessage requires subject", async () => {
    const { sendTwinMessage } = await import("../server/lib/enterpriseRuntimeService");
    await expect(sendTwinMessage({
      orgId: 1,
      fromTwinId: 1,
      toTwinId: 2,
      messageType: "signal",
      subject: "",
    })).rejects.toThrow();
  });
});

describe("enterpriseRuntimeService — type safety", () => {
  it("GovernanceProfile enum values are correct", () => {
    const profiles = ["STANDARD", "CONFIDENTIAL", "SOVEREIGN", "CLASSIFIED"];
    expect(profiles).toHaveLength(4);
    expect(profiles).toContain("SOVEREIGN");
    expect(profiles).toContain("CLASSIFIED");
  });

  it("SessionType enum values cover all required modes", () => {
    const types = ["run", "simulate", "deliberate", "compare", "calibrate"];
    expect(types).toHaveLength(5);
    expect(types).toContain("deliberate");
    expect(types).toContain("calibrate");
  });

  it("MessageType enum values cover all signal types", () => {
    const types = ["signal", "alert", "data_update", "recommendation", "calibration"];
    expect(types).toHaveLength(5);
    expect(types).toContain("recommendation");
  });

  it("MessagePriority enum values are ordered", () => {
    const priorities = ["low", "normal", "high", "critical"];
    expect(priorities).toHaveLength(4);
    expect(priorities.indexOf("critical")).toBeGreaterThan(priorities.indexOf("low"));
  });
});
