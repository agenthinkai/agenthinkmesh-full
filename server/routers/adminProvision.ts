/**
 * server/routers/adminProvision.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only user provisioning.
 * Allows an authenticated admin to create user accounts with a secure
 * temporary password.  The provisioned user must change their password on
 * first login.
 *
 * Auth model for provisioned users
 * ─────────────────────────────────
 * Provisioned users are stored in the same `users` table but use a synthetic
 * openId of the form  `local:<email>`.  On login they POST their email +
 * password to `adminProvision.loginWithPassword`.  The server verifies the
 * bcrypt hash, checks the 7-day expiry, and issues the same JWT session cookie
 * used by the OAuth flow — so all downstream `protectedProcedure` calls work
 * identically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, adminUserCreations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;
const TEMP_PASSWORD_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a cryptographically random password of the form:
 *   4 uppercase + 4 lowercase + 4 digits + 4 special chars, then shuffled.
 * Minimum 16 characters, guaranteed to satisfy all character classes.
 */
export function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*-_=+?";

  const pick = (charset: string, n: number) =>
    Array.from({ length: n }, () =>
      charset[Math.floor(Math.random() * charset.length)]
    );

  const chars = [
    ...pick(upper, 4),
    ...pick(lower, 4),
    ...pick(digits, 4),
    ...pick(special, 4),
  ];

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function localOpenId(email: string): string {
  return `local:${email.toLowerCase().trim()}`;
}

function setCookieHeader(
  res: import("express").Response,
  token: string
): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ONE_YEAR_MS / 1000)}`
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const adminProvisionRouter = router({
  /**
   * ADMIN ONLY — Create a provisioned user account.
   * Returns the plaintext temporary password (shown once, never stored).
   */
  createUser: protectedProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        name: z.string().max(255).optional(),
        role: z.enum(["user", "admin"]).default("user"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ── Gate: admin only ──────────────────────────────────────────────────
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required.",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const openId = localOpenId(input.email);

      // ── Duplicate check ───────────────────────────────────────────────────
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A user with email ${input.email} already exists.`,
        });
      }

      // ── Generate + hash password ──────────────────────────────────────────
      const plaintext = generateTempPassword();
      const passwordHash = await bcrypt.hash(plaintext, SALT_ROUNDS);
      const now = new Date();

      // ── Insert user ───────────────────────────────────────────────────────
      await db.insert(users).values({
        openId,
        email: input.email,
        name: input.name ?? null,
        role: input.role,
        loginMethod: "password",
        passwordHash,
        mustResetPassword: true,
        createdByAdminId: ctx.user.id,
        tempPasswordIssuedAt: now,
        lastSignedIn: now,
      });

      const newUser = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      // ── Audit log ─────────────────────────────────────────────────────────
      await db.insert(adminUserCreations).values({
        adminId: ctx.user.id,
        adminEmail: ctx.user.email ?? undefined,
        createdEmail: input.email,
        createdName: input.name ?? undefined,
        assignedRole: input.role,
        createdAt: now,
      });

      console.log(
        `[AdminProvision] Admin ${ctx.user.email ?? ctx.user.id} created user ${input.email} at ${now.toISOString()}`
      );

      // Return plaintext password — displayed once in the UI, never stored
      return {
        success: true,
        email: input.email,
        name: input.name ?? null,
        role: input.role,
        temporaryPassword: plaintext,
        userId: newUser[0]?.id ?? null,
      };
    }),

  /**
   * PUBLIC — Password-based login for provisioned users.
   * Issues the same JWT session cookie used by OAuth users.
   */
  loginWithPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const openId = localOpenId(input.email);
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      const user = rows[0];

      // Generic error — don't reveal whether email exists
      const INVALID_MSG = "Invalid email or password.";

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_MSG });
      }

      // ── 7-day expiry check ────────────────────────────────────────────────
      if (user.mustResetPassword && user.tempPasswordIssuedAt) {
        const issuedAt = user.tempPasswordIssuedAt.getTime();
        if (Date.now() - issuedAt > TEMP_PASSWORD_EXPIRY_MS) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Temporary password has expired. Please contact your administrator.",
          });
        }
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_MSG });
      }

      // ── Issue session cookie ──────────────────────────────────────────────
      const token = await sdk.createSessionToken(user.openId, {
        name: user.name ?? user.email ?? "",
      });
      setCookieHeader(ctx.res, token);

      // Update last signed in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      return {
        success: true,
        mustResetPassword: user.mustResetPassword,
        userId: user.id,
      };
    }),

  /**
   * PROTECTED — Change password for a provisioned user.
   * Clears mustResetPassword flag after successful change.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .regex(/[A-Z]/, "Must contain an uppercase letter")
          .regex(/[a-z]/, "Must contain a lowercase letter")
          .regex(/[0-9]/, "Must contain a number")
          .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const rows = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const user = rows[0];

      if (!user?.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account does not use password authentication.",
        });
      }

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect.",
        });
      }

      const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

      await db
        .update(users)
        .set({
          passwordHash: newHash,
          mustResetPassword: false,
          tempPasswordIssuedAt: null,
        })
        .where(eq(users.id, ctx.user.id));

      console.log(
        `[AdminProvision] User ${ctx.user.email ?? ctx.user.id} changed their password at ${new Date().toISOString()}`
      );

      return { success: true };
    }),

  /**
   * ADMIN ONLY — List all provisioned users (audit log).
   */
  listProvisionedUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
    }

    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        id: adminUserCreations.id,
        adminId: adminUserCreations.adminId,
        adminEmail: adminUserCreations.adminEmail,
        createdEmail: adminUserCreations.createdEmail,
        createdName: adminUserCreations.createdName,
        assignedRole: adminUserCreations.assignedRole,
        createdAt: adminUserCreations.createdAt,
      })
      .from(adminUserCreations)
      .orderBy(adminUserCreations.createdAt);

    return rows;
  }),
});
