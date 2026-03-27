/**
 * contact.ts — tRPC router for the /contact Book Demo form
 * Procedures: submit (public) — saves submission, notifies owner
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  company: z.string().min(1, "Company is required"),
  email: z.string().email("Valid email required"),
  role: z.string().optional(),
  message: z.string().min(10, "Please write at least 10 characters"),
});

export const contactDemoRouter = router({
  submit: publicProcedure
    .input(contactSchema)
    .mutation(async ({ input }) => {
      // Always log to console
      console.log("[CONTACT FORM SUBMISSION]", {
        timestamp: new Date().toISOString(),
        ...input,
      });

      // Notify owner via Manus notification service — catch silently on failure
      try {
        const content = [
          `New Book Demo request from ${input.name}`,
          ``,
          `Name: ${input.name}`,
          `Company: ${input.company}`,
          `Email: ${input.email}`,
          `Role: ${input.role ?? "Not provided"}`,
          ``,
          `Message:`,
          input.message,
          ``,
          `Submitted at: ${new Date().toUTCString()}`,
        ].join("\n");

        await notifyOwner({
          title: `📬 Book Demo: ${input.name} — ${input.company}`,
          content,
        });
      } catch (err) {
        console.warn("[CONTACT FORM] notifyOwner failed silently:", err);
      }

      // Also try FormSubmit.co to kishore@agenthink.ai
      try {
        await fetch("https://formsubmit.co/ajax/kishore@agenthink.ai", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: input.name,
            email: input.email,
            company: input.company,
            role: input.role ?? "Not provided",
            message: input.message,
            _subject: `Book Demo: ${input.name} from ${input.company}`,
            _replyto: input.email,
            _template: "table",
            _captcha: "false",
          }),
        });
      } catch (err) {
        console.warn("[CONTACT FORM] FormSubmit failed silently:", err);
      }

      return { success: true, message: "Submission received" };
    }),
});
