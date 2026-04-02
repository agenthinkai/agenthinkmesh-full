/**
 * contacts.ts — ARE Phase 1 & 2 tRPC router
 *
 * Procedures:
 *  contacts.list           — list all contacts for the user
 *  contacts.get            — get a single contact with interactions
 *  contacts.create         — add a new contact
 *  contacts.update         — edit contact fields (auto-updates lastContacted when status changes to contacted)
 *  contacts.delete         — remove a contact
 *  contacts.generateMessage — Outreach Agent: generate a message for a contact
 *  contacts.logInteraction  — log a sent message + outcome; auto-updates lastContacted
 *  contacts.updateOutcome   — update outcome on an existing interaction
 *  contacts.getStyleExamples — get the user's few-shot style examples
 *  contacts.saveStyleExamples — save/replace the user's few-shot style examples
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  contacts,
  contactInteractions,
  outreachStyleExamples,
} from "../../drizzle/schema";
import { generateOutreachMessage, type OutreachGoal } from "../agents/outreachAgent";

// ── Validation schemas ────────────────────────────────────────────────────────

const contactStatusEnum = z.enum(["new", "contacted", "active", "closed"]);
const outcomeEnum = z.enum(["no_response", "response", "converted"]);
const goalEnum = z.enum(["follow_up", "conversion", "engagement"]);

// ── Router ────────────────────────────────────────────────────────────────────

export const contactsRouter = router({

  // ── List all contacts ──────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      status: contactStatusEnum.optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(contacts)
        .where(
          input?.status
            ? and(eq(contacts.userId, ctx.user.id), eq(contacts.status, input.status))
            : eq(contacts.userId, ctx.user.id)
        )
        .orderBy(desc(contacts.lastContacted), desc(contacts.createdAt));

      return rows;
    }),

  // ── Get single contact with interactions ───────────────────────────────────
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.id), eq(contacts.userId, ctx.user.id)))
        .limit(1);

      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });

      const interactions = await db
        .select()
        .from(contactInteractions)
        .where(eq(contactInteractions.contactId, input.id))
        .orderBy(desc(contactInteractions.createdAt));

      return { ...contact, interactions };
    }),

  // ── Create contact ─────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255).trim(),
      company: z.string().max(255).trim().optional(),
      role: z.string().max(255).trim().optional(),
      region: z.string().max(100).trim().optional(),
      status: contactStatusEnum.optional().default("new"),
      notes: z.string().max(5000).trim().optional(),
      phoneNumber: z.string().max(20).trim().optional(),
      email: z.string().email().max(255).optional(),
      linkedinUrl: z.string().url().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(contacts).values({
        userId: ctx.user.id,
        name: input.name,
        company: input.company ?? null,
        role: input.role ?? null,
        region: input.region ?? null,
        status: input.status ?? "new",
        notes: input.notes ?? null,
        phoneNumber: input.phoneNumber ?? null,
        email: input.email ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
      });

      const [created] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.userId, ctx.user.id))
        .orderBy(desc(contacts.createdAt))
        .limit(1);

      return created;
    }),

  // ── Update contact ─────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).trim().optional(),
      company: z.string().max(255).trim().nullable().optional(),
      role: z.string().max(255).trim().nullable().optional(),
      region: z.string().max(100).trim().nullable().optional(),
      status: contactStatusEnum.optional(),
      notes: z.string().max(5000).trim().nullable().optional(),
      phoneNumber: z.string().max(20).trim().nullable().optional(),
      email: z.string().email().max(255).nullable().optional(),
      linkedinUrl: z.string().url().max(255).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...fields } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.userId, ctx.user.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      // Auto-update lastContacted when status changes to "contacted" or "active"
      const updatePayload: Record<string, unknown> = { ...fields };
      if (
        fields.status &&
        (fields.status === "contacted" || fields.status === "active") &&
        existing.status !== fields.status
      ) {
        updatePayload.lastContacted = new Date();
      }

      await db
        .update(contacts)
        .set(updatePayload)
        .where(and(eq(contacts.id, id), eq(contacts.userId, ctx.user.id)));

      const [updated] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);

      return updated;
    }),

  // ── Delete contact ─────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.id), eq(contacts.userId, ctx.user.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .delete(contacts)
        .where(and(eq(contacts.id, input.id), eq(contacts.userId, ctx.user.id)));

      return { ok: true };
    }),

  // ── Generate outreach message (Outreach Agent) ─────────────────────────────
  generateMessage: protectedProcedure
    .input(z.object({
      contactId: z.number(),
      goal: goalEnum,
      context: z.string().max(1000).trim().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load contact
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id)))
        .limit(1);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      // Load style examples
      const examples = await db
        .select()
        .from(outreachStyleExamples)
        .where(eq(outreachStyleExamples.userId, ctx.user.id))
        .orderBy(outreachStyleExamples.sortOrder);

      const styleExamples = examples.map((e) => e.exampleText);

      // Run Outreach Agent
      const result = await generateOutreachMessage({
        contact: {
          name: contact.name,
          company: contact.company,
          role: contact.role,
          region: contact.region,
          notes: contact.notes,
          status: contact.status,
          lastContacted: contact.lastContacted,
          phoneNumber: contact.phoneNumber,
        },
        context: input.context,
        goal: input.goal as OutreachGoal,
        styleExamples,
      });

      // Auto-update lastContacted when message is generated
      await db
        .update(contacts)
        .set({ lastContacted: new Date() })
        .where(eq(contacts.id, input.contactId));

      return result;
    }),

  // ── Log an interaction (message sent + optional outcome) ───────────────────
  logInteraction: protectedProcedure
    .input(z.object({
      contactId: z.number(),
      action: z.string().min(1).max(1000).trim(),
      messageText: z.string().max(5000).trim().optional(),
      outcome: outcomeEnum.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify contact ownership
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id)))
        .limit(1);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });

      // Insert interaction
      await db.insert(contactInteractions).values({
        contactId: input.contactId,
        userId: ctx.user.id,
        action: input.action,
        messageText: input.messageText ?? null,
        outcome: input.outcome ?? null,
      });

      // Auto-update lastContacted on the contact
      await db
        .update(contacts)
        .set({
          lastContacted: new Date(),
          // If status is still "new", bump to "contacted"
          ...(contact.status === "new" ? { status: "contacted" as const } : {}),
        })
        .where(eq(contacts.id, input.contactId));

      return { ok: true };
    }),

  // ── Update outcome on an existing interaction ──────────────────────────────
  updateOutcome: protectedProcedure
    .input(z.object({
      interactionId: z.number(),
      outcome: outcomeEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify ownership via userId
      const [interaction] = await db
        .select()
        .from(contactInteractions)
        .where(
          and(
            eq(contactInteractions.id, input.interactionId),
            eq(contactInteractions.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!interaction) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(contactInteractions)
        .set({ outcome: input.outcome })
        .where(eq(contactInteractions.id, input.interactionId));

      // If converted, update contact status
      if (input.outcome === "converted") {
        await db
          .update(contacts)
          .set({ status: "active" })
          .where(eq(contacts.id, interaction.contactId));
      }

      return { ok: true };
    }),

  // ── Get style examples ─────────────────────────────────────────────────────
  getStyleExamples: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db
      .select()
      .from(outreachStyleExamples)
      .where(eq(outreachStyleExamples.userId, ctx.user.id))
      .orderBy(outreachStyleExamples.sortOrder);

    return rows;
  }),

  // ── Save style examples (replace all) ─────────────────────────────────────
  saveStyleExamples: protectedProcedure
    .input(z.object({
      examples: z.array(z.object({
        exampleText: z.string().min(10).max(2000).trim(),
        label: z.string().max(128).trim().optional(),
      })).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Delete existing examples for this user
      await db
        .delete(outreachStyleExamples)
        .where(eq(outreachStyleExamples.userId, ctx.user.id));

      // Insert new examples
      if (input.examples.length > 0) {
        await db.insert(outreachStyleExamples).values(
          input.examples.map((ex, i) => ({
            userId: ctx.user.id,
            exampleText: ex.exampleText,
            label: ex.label ?? null,
            sortOrder: i,
          }))
        );
      }

      return { ok: true, count: input.examples.length };
    }),
});
