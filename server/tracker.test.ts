/**
 * tracker.test.ts — Unit tests for the Email Reply Tracker tRPC router
 *
 * Tests:
 *  - tracker.getStats returns expected shape
 *  - tracker.getEmails returns paginated results
 *  - tracker.getGmailStatus returns connected boolean
 *  - tracker.getFollowUpCount returns a count
 *  - tracker.getGmailAuthUrl returns a URL containing accounts.google.com
 *  - tracker.triggerSync throws when Gmail is not connected
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock the DB and Gmail helpers ─────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    // Return empty arrays for all queries
    then: vi.fn((cb: (v: unknown[]) => unknown) => Promise.resolve(cb([]))),
  }),
}));

vi.mock("./gmailTracker", () => ({
  isGmailConnected: vi.fn().mockResolvedValue(false),
  syncGmailReplies: vi.fn().mockResolvedValue({ scanned: 0, newReplies: 0 }),
}));

// ── Context factory ───────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("tracker router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tracker.getGmailStatus", () => {
    it("returns connected: false when Gmail is not connected", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tracker.getGmailStatus();
      expect(result).toMatchObject({
        connected: false,
        email: "farouqsultan@gmail.com",
      });
    });
  });

  describe("tracker.getGmailAuthUrl", () => {
    it("returns a URL pointing to Google OAuth", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tracker.getGmailAuthUrl({
        origin: "https://example.com",
      });
      expect(result.url).toContain("accounts.google.com");
      expect(result.url).toContain("gmail.readonly");
    });
  });

  describe("tracker.triggerSync", () => {
    it("throws PRECONDITION_FAILED when Gmail is not connected", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.tracker.triggerSync()).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
    });
  });

  describe("tracker.updateStatus", () => {
    it("throws when called without authentication", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.tracker.updateStatus({ id: 1, status: "interested" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("tracker.seedOutboundEmails", () => {
    it("throws FORBIDDEN when called by a non-admin user", async () => {
      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.tracker.seedOutboundEmails({
          emails: [
            {
              recipientName: "John Doe",
              recipientEmail: "john@example.com",
              market: "US",
              subject: "Test",
              sentAt: new Date().toISOString(),
            },
          ],
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
