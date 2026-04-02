/**
 * outreachAgent.ts — ARE Phase 2: Outreach Agent (WhatsApp-optimised)
 *
 * Generates high-quality, institutionally-toned outreach messages for a given contact.
 * Supports few-shot style calibration via user-provided example messages.
 *
 * Rules enforced in prompt:
 *  - WhatsApp-friendly format: no subject line, short paragraphs
 *  - Institutional, private equity / investment tone — GCC appropriate
 *  - Direct, no fluff — max 120–150 words
 *  - No AI phrases: no "happy to", "leverage", "synergies", "reach out", "touch base"
 *  - Every message must reference real context from the contact record
 */

import { invokeLLM } from "../_core/llm";

export type OutreachGoal = "follow_up" | "conversion" | "engagement";

export interface OutreachInput {
  contact: {
    name: string;
    company?: string | null;
    role?: string | null;
    region?: string | null;
    notes?: string | null;
    status: string;
    lastContacted?: Date | null;
    phoneNumber?: string | null;
  };
  context?: string;          // additional manual context from the user
  goal: OutreachGoal;
  styleExamples?: string[];  // 2–3 real messages from the user for tone calibration
}

export interface OutreachOutput {
  recipient: string;
  message: string;
  goal: OutreachGoal;
  wordCount: number;
}

const GOAL_LABELS: Record<OutreachGoal, string> = {
  follow_up: "follow-up on a previous conversation or meeting",
  conversion: "convert the contact into a paying client or scheduled meeting",
  engagement: "re-engage a contact who has gone quiet",
};

export async function generateOutreachMessage(input: OutreachInput): Promise<OutreachOutput> {
  const { contact, context, goal, styleExamples } = input;

  // Build few-shot block if examples provided
  let fewShotBlock = "";
  if (styleExamples && styleExamples.length > 0) {
    fewShotBlock = `
TONE CALIBRATION — match the style of these real messages exactly:
${styleExamples.map((ex, i) => `[Example ${i + 1}]\n${ex.trim()}`).join("\n\n")}

---
`;
  }

  // Build contact context block
  const daysSinceContact = contact.lastContacted
    ? Math.floor((Date.now() - new Date(contact.lastContacted).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const contactBlock = [
    `Name: ${contact.name}`,
    contact.company ? `Company: ${contact.company}` : null,
    contact.role ? `Role: ${contact.role}` : null,
    contact.region ? `Region: ${contact.region}` : null,
    contact.status ? `Pipeline status: ${contact.status}` : null,
    daysSinceContact !== null ? `Last contacted: ${daysSinceContact} days ago` : "Last contacted: never",
    contact.notes ? `Notes: ${contact.notes}` : null,
    context ? `Additional context: ${context}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are a senior private equity professional writing a short WhatsApp message to a business contact in the GCC.

STRICT RULES:
- Maximum 150 words. Aim for 100–120.
- WhatsApp format ONLY: no subject line, no email greeting, no "Dear [Name]".
- Start directly with the person's first name or the key point — no preamble.
- Short paragraphs (2–3 sentences max per paragraph). One blank line between paragraphs.
- Institutional tone. Professional but not stiff. GCC-appropriate directness.
- Reference specific details from the contact record — never write a generic message.
- Forbidden words and phrases: "happy to", "leverage", "synergies", "reach out", "touch base", "hope this finds you well", "I wanted to", "please don't hesitate", "looking forward to", "exciting opportunity", "circle back", "ping you", "as per", "kindly".
- No sign-off formalities. End with a clear, single call to action or question.
- Sign off with name placeholder: [Your Name]

OUTPUT FORMAT:
Return only the message text. No labels, no JSON, no explanation. No subject line.`;

  const userPrompt = `${fewShotBlock}CONTACT:
${contactBlock}

GOAL: ${GOAL_LABELS[goal]}

Write the WhatsApp message now.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const message = (typeof rawContent === "string" ? rawContent : "").trim();
  const wordCount = message.split(/\s+/).filter(Boolean).length;

  return {
    recipient: contact.name,
    message,
    goal,
    wordCount,
  };
}
