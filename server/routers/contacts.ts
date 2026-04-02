/**
 * contacts.ts — ARE Phase 1 & 2 tRPC router (Enhanced Round 2)
 *
 * Procedures:
 *  contacts.list                — list all contacts for the user
 *  contacts.get                 — get a single contact with interactions
 *  contacts.create              — add a new contact
 *  contacts.update              — edit contact fields (auto-updates lastContacted when status changes)
 *  contacts.delete              — remove a contact
 *  contacts.generateMessage     — Outreach Agent: generate a WhatsApp-optimised message
 *  contacts.logInteraction      — log a sent message + outcome; auto-updates lastContacted
 *  contacts.updateOutcome       — update outcome on an existing interaction
 *  contacts.getStyleExamples    — get the user's few-shot style examples
 *  contacts.saveStyleExamples   — save/replace the user's few-shot style examples
 *  contacts.importCsv           — bulk import contacts from parsed CSV rows (with duplicate detection)
 *  contacts.getSummary          — get total + count by status
 *  contacts.generateEmailTemplate — generate subject + body for mailto prefill
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  contacts,
  contactInteractions,
  outreachStyleExamples,
} from "../../drizzle/schema";
import { generateOutreachMessage, type OutreachGoal } from "../agents/outreachAgent";
import { invokeLLM } from "../_core/llm";

// ── Validation schemas ────────────────────────────────────────────────────────

const contactStatusEnum = z.enum(["new", "contacted", "active", "closed"]);
const outcomeEnum = z.enum(["no_response", "response", "converted"]);
const goalEnum = z.enum(["follow_up", "conversion", "engagement"]);

// CSV row schema — all fields optional except name
const csvRowSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  company: z.string().max(255).trim().optional(),
  phone_number: z.string().max(20).trim().optional(),
  email: z.string().email().max(255).optional().or(z.literal("")).transform(v => v || undefined),
  linkedin_url: z.string().url().max(255).optional().or(z.literal("")).transform(v => v || undefined),
  role: z.string().max(255).trim().optional(),
});

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

      const [existing] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.userId, ctx.user.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

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

      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id)))
        .limit(1);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      const examples = await db
        .select()
        .from(outreachStyleExamples)
        .where(eq(outreachStyleExamples.userId, ctx.user.id))
        .orderBy(outreachStyleExamples.sortOrder);

      const styleExamples = examples.map((e) => e.exampleText);

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

      await db
        .update(contacts)
        .set({ lastContacted: new Date() })
        .where(eq(contacts.id, input.contactId));

      return result;
    }),

  // ── Log an interaction ─────────────────────────────────────────────────────
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

      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id)))
        .limit(1);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });

      await db.insert(contactInteractions).values({
        contactId: input.contactId,
        userId: ctx.user.id,
        action: input.action,
        messageText: input.messageText ?? null,
        outcome: input.outcome ?? null,
      });

      await db
        .update(contacts)
        .set({
          lastContacted: new Date(),
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

      await db
        .delete(outreachStyleExamples)
        .where(eq(outreachStyleExamples.userId, ctx.user.id));

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

  // ── Get contacts summary ───────────────────────────────────────────────────
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db
      .select({
        status: contacts.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(contacts)
      .where(eq(contacts.userId, ctx.user.id))
      .groupBy(contacts.status);

    const byStatus = { new: 0, contacted: 0, active: 0, closed: 0 };
    let total = 0;
    for (const row of rows) {
      const count = Number(row.count);
      byStatus[row.status as keyof typeof byStatus] = count;
      total += count;
    }

    return { total, byStatus };
  }),

  // ── Bulk CSV import ────────────────────────────────────────────────────────
  importCsv: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        name: z.string(),
        company: z.string().optional(),
        phone_number: z.string().optional(),
        email: z.string().optional(),
        linkedin_url: z.string().optional(),
        role: z.string().optional(),
      })),
      // If true, import rows flagged as duplicates anyway
      importDuplicates: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load existing contacts for duplicate detection (name + company, case-insensitive)
      const existing = await db
        .select({ name: contacts.name, company: contacts.company })
        .from(contacts)
        .where(eq(contacts.userId, ctx.user.id));

      const existingKeys = new Set(
        existing.map((c) =>
          `${c.name.toLowerCase().trim()}|${(c.company ?? "").toLowerCase().trim()}`
        )
      );

      const results: Array<{
        rowIndex: number;
        status: "imported" | "duplicate" | "error";
        name?: string;
        company?: string;
        error?: string;
      }> = [];

      let importedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];

        // Validate row
        const parsed = csvRowSchema.safeParse(raw);
        if (!parsed.success) {
          const errorMessages = parsed.error.issues.map((e) => `${String(e.path.join("."))}: ${e.message}`).join("; ");
          results.push({ rowIndex: i, status: "error", name: raw.name, company: raw.company, error: errorMessages });
          errorCount++;
          continue;
        }

        const row = parsed.data;

        // Duplicate detection
        const key = `${row.name.toLowerCase().trim()}|${(row.company ?? "").toLowerCase().trim()}`;
        if (existingKeys.has(key) && !input.importDuplicates) {
          results.push({ rowIndex: i, status: "duplicate", name: row.name, company: row.company });
          duplicateCount++;
          continue;
        }

        // Import the row
        try {
          await db.insert(contacts).values({
            userId: ctx.user.id,
            name: row.name,
            company: row.company ?? null,
            role: row.role ?? null,
            region: null,
            status: "new",
            notes: null,
            phoneNumber: row.phone_number ?? null,
            email: row.email ?? null,
            linkedinUrl: row.linkedin_url ?? null,
          });

          // Add to existing keys to prevent intra-batch duplicates
          existingKeys.add(key);

          results.push({ rowIndex: i, status: "imported", name: row.name, company: row.company });
          importedCount++;
        } catch (err) {
          results.push({ rowIndex: i, status: "error", name: row.name, company: row.company, error: "Database error during insert" });
          errorCount++;
        }
      }

      return {
        imported: importedCount,
        duplicates: duplicateCount,
        errors: errorCount,
        total: input.rows.length,
        results,
      };
    }),

  // ── Generate email template (subject + body for mailto) ───────────────────
  generateEmailTemplate: protectedProcedure
    .input(z.object({
      contactId: z.number(),
      goal: goalEnum,
      context: z.string().max(1000).trim().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id)))
        .limit(1);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      const examples = await db
        .select()
        .from(outreachStyleExamples)
        .where(eq(outreachStyleExamples.userId, ctx.user.id))
        .orderBy(outreachStyleExamples.sortOrder);

      const styleExamples = examples.map((e) => e.exampleText);

      const goalLabels: Record<string, string> = {
        follow_up: "follow up after a previous interaction",
        conversion: "convert this contact into an active deal or meeting",
        engagement: "re-engage a contact who has gone quiet",
      };

      const fewShotBlock = styleExamples.length > 0
        ? `TONE CALIBRATION — match the writing style of these real messages exactly:\n${styleExamples.map((ex, i) => `[Example ${i + 1}]\n${ex}`).join("\n\n")}\n\n---\n\n`
        : "";

      const systemPrompt = `You are a senior GCC private equity professional writing a short, direct email to a business contact. You write in a confident, peer-to-peer tone — no corporate jargon, no filler phrases. Your emails are brief, specific, and always have a clear single ask.

${fewShotBlock}Rules:
- Subject line: 6 words or fewer, no spam triggers, no exclamation marks, no "Re:" or "Fwd:"
- Body: 3–5 sentences maximum, same calibrated tone as the examples above
- No "I hope this email finds you well", "Please don't hesitate", "Best regards", "Warm regards", or similar filler
- End with a single clear question or call to action
- Sign off with just "[Your Name]"
- Output ONLY valid JSON: { "subject": "...", "body": "..." }`;

      const userPrompt = `Write a professional email to ${goalLabels[input.goal] || "follow up"}.

Contact: ${contact.name}${contact.company ? ` at ${contact.company}` : ""}${contact.role ? `, ${contact.role}` : ""}${contact.region ? ` (${contact.region})` : ""}
Goal: ${goalLabels[input.goal]}
${input.context ? `Context: ${input.context}` : ""}
${contact.notes ? `Notes: ${contact.notes}` : ""}

Return JSON only: { "subject": "...", "body": "..." }`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "email_template",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subject: { type: "string", description: "Email subject line (6 words or fewer)" },
                body: { type: "string", description: "Email body (3-5 sentences, professional GCC tone)" },
              },
              required: ["subject", "body"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty response" });

      let parsed: { subject: string; body: string };
      try {
        parsed = typeof content === "string" ? JSON.parse(content) : content;
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse LLM response as JSON" });
      }

      // Auto-update lastContacted when email template is generated
      await db
        .update(contacts)
        .set({ lastContacted: new Date() })
        .where(eq(contacts.id, input.contactId));

      return {
        subject: parsed.subject,
        body: parsed.body,
        recipient: contact.name,
        email: contact.email,
        goal: input.goal,
        // Convenience: pre-encoded mailto URL
        mailtoUrl: `mailto:${contact.email ?? ""}?subject=${encodeURIComponent(parsed.subject)}&body=${encodeURIComponent(parsed.body)}`,
      };
    }),
});
