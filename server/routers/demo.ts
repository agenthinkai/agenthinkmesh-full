import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { demoRequests } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

export const demoRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        name:        z.string().min(1).max(200),
        institution: z.string().min(1).max(300),
        email:       z.string().email().max(300),
        useCase:     z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(demoRequests).values({
        name:        input.name,
        institution: input.institution,
        email:       input.email,
        useCase:     input.useCase,
        status:      "pending",
        createdAt:   Date.now(),
      });

      // Notify owner asynchronously — don't fail the request if notification fails
      notifyOwner({
        title: `New demo request from ${input.institution}`,
        content: `**Name:** ${input.name}\n**Institution:** ${input.institution}\n**Email:** ${input.email}\n\n**Use case:**\n${input.useCase}`,
      }).catch(() => {/* swallow */});

      return { success: true };
    }),
});
