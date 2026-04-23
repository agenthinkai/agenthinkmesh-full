/**
 * CMK (Customer-Managed Keys) tRPC Router
 *
 * Procedures:
 *   cmk.getStatus      — get current key status for the authenticated user
 *   cmk.generateKey    — generate a new AES-256 data key (first-time setup)
 *   cmk.rotateKey      — rotate the key and re-encrypt all user data
 *   cmk.revokeKey      — permanently revoke the key (data becomes inaccessible)
 *   cmk.getAuditLog    — paginated audit log of key lifecycle + decrypt events
 */

import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { clientEncryptionKeys, cmkAuditLog } from "../../drizzle/schema";
import {
  generateUserKey,
  rotateUserKey,
  revokeUserKey,
  getUserKeyRecord,
  getAnyKeyRecord,
  loadUserDataKey,
} from "../cmk";
import { reEncryptUserData } from "../cmkFields";

export const cmkRouter = router({
  /** Get the current CMK status for the authenticated user. */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const record = await getAnyKeyRecord(ctx.user.id);
    if (!record) {
      return {
        hasKey: false,
        status: null,
        keyVersion: null,
        createdAt: null,
        rotatedAt: null,
        revokedAt: null,
      };
    }
    return {
      hasKey: true,
      status: record.status,
      keyVersion: record.keyVersion,
      createdAt: record.createdAt,
      rotatedAt: record.rotatedAt ?? null,
      revokedAt: record.revokedAt ?? null,
    };
  }),

  /** Generate a new AES-256 data key for the user (first-time setup only). */
  generateKey: protectedProcedure.mutation(async ({ ctx }) => {
    const ipAddress = ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? ctx.req.socket.remoteAddress;
    try {
      const result = await generateUserKey(ctx.user.id, ipAddress);
      return { success: true, keyVersion: result.keyVersion };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "BAD_REQUEST", message: msg });
    }
  }),

  /**
   * Rotate the user's data key.
   * Generates a new key, re-encrypts all sensitive fields, then replaces the stored key.
   * This is a long-running operation — the client should show a loading state.
   */
  rotateKey: protectedProcedure.mutation(async ({ ctx }) => {
    const ipAddress = ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? ctx.req.socket.remoteAddress;

    const oldDataKey = await loadUserDataKey(ctx.user.id);
    if (!oldDataKey) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active key to rotate." });
    }

    try {
      // 1. Generate new key and update DB record
      const { newDataKey, newKeyVersion } = await rotateUserKey(ctx.user.id, oldDataKey, ipAddress);

      // 2. Re-encrypt all user data with the new key
      const { reEncryptedRows } = await reEncryptUserData(ctx.user.id, oldDataKey, newDataKey);

      return { success: true, newKeyVersion, reEncryptedRows };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
    }
  }),

  /**
   * Revoke the user's data key.
   * WARNING: This permanently destroys access to all encrypted data.
   * Requires explicit confirmation string from the client.
   */
  revokeKey: protectedProcedure
    .input(
      z.object({
        confirmationText: z
          .string()
          .refine((v) => v === "REVOKE MY KEY", {
            message: 'You must type "REVOKE MY KEY" to confirm.',
          }),
      })
    )
    .mutation(async ({ ctx, input: _ }) => {
      const ipAddress = ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? ctx.req.socket.remoteAddress;
      try {
        await revokeUserKey(ctx.user.id, ipAddress);
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
    }),

  /** Paginated audit log of key lifecycle and field-level decrypt events. */
  getAuditLog: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { entries: [], total: 0 };

      const [entries, countResult] = await Promise.all([
        db
          .select()
          .from(cmkAuditLog)
          .where(eq(cmkAuditLog.userId, ctx.user.id))
          .orderBy(desc(cmkAuditLog.performedAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: cmkAuditLog.id })
          .from(cmkAuditLog)
          .where(eq(cmkAuditLog.userId, ctx.user.id)),
      ]);

      return {
        entries,
        total: countResult.length,
      };
    }),
});
