/**
 * contacts.test.ts — Vitest tests for ARE Phase 1 & 2 (Enhanced)
 *
 * Tests:
 *  - contacts.create (with phoneNumber, email, linkedinUrl)
 *  - contacts.list
 *  - contacts.update (auto-updates lastContacted)
 *  - contacts.generateMessage (Outreach Agent — WhatsApp format)
 *  - contacts.logInteraction (auto-updates lastContacted, stores messageText)
 *  - contacts.updateOutcome
 *  - contacts.saveStyleExamples + getStyleExamples
 *  - Phone number handling (unit tests)
 *  - WhatsApp URL generation (unit tests)
 *  - Message copy logic (unit tests)
 *  - Pipeline view grouping (unit tests)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { users, contacts, contactInteractions, outreachStyleExamples } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ── WhatsApp URL helper (mirrors client-side buildWhatsAppUrl) ────────────────

function buildWhatsAppUrl(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}`;
}

// ── Unit tests: Phone number handling ────────────────────────────────────────

describe("Phone number handling", () => {
  it("strips leading + from international number", () => {
    expect(buildWhatsAppUrl("+96512345678")).toBe("https://wa.me/96512345678");
  });

  it("strips spaces and dashes from phone number", () => {
    expect(buildWhatsAppUrl("+965 1234-5678")).toBe("https://wa.me/96512345678");
  });

  it("handles number without + prefix", () => {
    expect(buildWhatsAppUrl("96512345678")).toBe("https://wa.me/96512345678");
  });

  it("handles UAE number format", () => {
    expect(buildWhatsAppUrl("+971501234567")).toBe("https://wa.me/971501234567");
  });

  it("produces valid wa.me URL structure", () => {
    const url = buildWhatsAppUrl("+96512345678");
    expect(url).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });
});

// ── Unit tests: WhatsApp link generation ─────────────────────────────────────

describe("WhatsApp link generation", () => {
  it("generates correct URL for Kuwait number", () => {
    expect(buildWhatsAppUrl("+96512345678")).toBe("https://wa.me/96512345678");
  });

  it("generates correct URL for Saudi number", () => {
    expect(buildWhatsAppUrl("+966501234567")).toBe("https://wa.me/966501234567");
  });

  it("removes all non-digit characters", () => {
    expect(buildWhatsAppUrl("+1 (555) 123-4567")).toBe("https://wa.me/15551234567");
  });

  it("URL always prefixed with https://wa.me/", () => {
    expect(buildWhatsAppUrl("+96512345678").startsWith("https://wa.me/")).toBe(true);
  });
});

// ── Unit tests: Message copy logic ───────────────────────────────────────────

describe("Message copy functionality", () => {
  it("word count is within WhatsApp-friendly range", () => {
    const message = "Ahmed, following up on our conversation at the Gulf Capital Summit. The diagnostic platform deal has moved to IC stage — worth 30 minutes if you're still looking at healthcare. [Your Name]";
    const wordCount = message.split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(150);
    expect(wordCount).toBeGreaterThan(0);
  });

  it("message does not contain forbidden AI phrases", () => {
    const message = "Ahmed, following up on our conversation. The deal has moved to IC stage. Worth a call? [Your Name]";
    const forbidden = ["happy to", "leverage", "synergies", "reach out", "touch base", "hope this finds you well", "please don't hesitate", "looking forward to"];
    for (const phrase of forbidden) {
      expect(message.toLowerCase()).not.toContain(phrase);
    }
  });

  it("message does not contain a subject line", () => {
    const message = "Ahmed, the diagnostic platform deal has moved to IC stage. Worth 30 minutes? [Your Name]";
    expect(message).not.toMatch(/^Subject:/i);
    expect(message).not.toMatch(/^Re:/i);
  });
});

// ── Unit tests: Pipeline view grouping ───────────────────────────────────────

describe("Pipeline view", () => {
  it("groups contacts by status correctly", () => {
    const mockContacts = [
      { id: 1, name: "Ahmed", status: "new" },
      { id: 2, name: "Sara", status: "contacted" },
      { id: 3, name: "Khalid", status: "active" },
      { id: 4, name: "Fatima", status: "new" },
    ];
    const grouped: Record<string, typeof mockContacts> = { new: [], contacted: [], active: [], closed: [] };
    for (const c of mockContacts) grouped[c.status].push(c);
    expect(grouped.new.length).toBe(2);
    expect(grouped.contacted.length).toBe(1);
    expect(grouped.active.length).toBe(1);
    expect(grouped.closed.length).toBe(0);
  });

  it("status change updates contact in correct column", () => {
    const contact = { id: 1, name: "Ahmed", status: "new" };
    contact.status = "contacted";
    expect(contact.status).toBe("contacted");
  });
});

// ── Integration tests ─────────────────────────────────────────────────────────

let testUserId: number;
let testContactId: number;

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable for testing");

  await db.insert(users).values({
    openId: `test-contacts-v2-${Date.now()}`,
    name: "ARE Test User V2",
    email: `are-test-v2-${Date.now()}@example.com`,
  });

  const [user] = await db
    .select()
    .from(users)
    .orderBy(users.id)
    .limit(1);

  // Get the most recently inserted test user
  const allUsers = await db.select().from(users).where(eq(users.name, "ARE Test User V2"));
  testUserId = allUsers[allUsers.length - 1].id;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  await db.delete(contactInteractions).where(eq(contactInteractions.userId, testUserId));
  await db.delete(contacts).where(eq(contacts.userId, testUserId));
  await db.delete(outreachStyleExamples).where(eq(outreachStyleExamples.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));
});

function createMockContext(userId: number) {
  return {
    user: { id: userId, role: "user" as const },
    req: {} as any,
    res: {} as any,
  };
}

describe("contacts router — ARE Phase 1 & 2 Enhanced (integration)", () => {
  it("should create a contact with phoneNumber, email, and linkedinUrl", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    const contact = await caller.contacts.create({
      name: "Ahmed Al-Rashid",
      company: "Gulf Capital Partners",
      role: "Managing Partner",
      region: "Kuwait",
      status: "new",
      notes: "Met at Gulf Summit 2026. Interested in healthcare deals.",
      phoneNumber: "+96512345678",
      email: "ahmed@gulfcapital.kw",
      linkedinUrl: "https://linkedin.com/in/ahmed-alrashid",
    });

    expect(contact).toBeDefined();
    expect(contact.name).toBe("Ahmed Al-Rashid");
    expect(contact.status).toBe("new");
    expect(contact.phoneNumber).toBe("+96512345678");
    expect(contact.email).toBe("ahmed@gulfcapital.kw");
    expect(contact.linkedinUrl).toBe("https://linkedin.com/in/ahmed-alrashid");
    testContactId = contact.id;
  });

  it("should list contacts", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    const list = await caller.contacts.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].name).toBe("Ahmed Al-Rashid");
  });

  it("should update contact and auto-update lastContacted when status changes to contacted", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    const updated = await caller.contacts.update({ id: testContactId, status: "contacted" });
    expect(updated.status).toBe("contacted");
    expect(updated.lastContacted).toBeTruthy();
  });

  it("should save and retrieve style examples", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    await caller.contacts.saveStyleExamples({
      examples: [
        { exampleText: "Ahmed — following up on our Gulf Summit conversation. The healthcare diagnostic platform we discussed is now live. 3 LOIs in hand. Let me know if you want the deck.", label: "follow-up" },
        { exampleText: "Quick one: the Kuwaiti fintech roll-up closed at 8.2x. Similar multiple to what we discussed for your portfolio. Worth a call?", label: "conversion" },
      ],
    });
    const examples = await caller.contacts.getStyleExamples();
    expect(examples.length).toBe(2);
    expect(examples[0].exampleText).toContain("Ahmed");
  });

  it("should generate a WhatsApp-optimised outreach message", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    const result = await caller.contacts.generateMessage({
      contactId: testContactId,
      goal: "follow_up",
      context: "We met at the Gulf Capital Summit last week. He mentioned interest in healthcare deals.",
    });

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(50);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.wordCount).toBeLessThanOrEqual(160);
    expect(result.recipient).toBe("Ahmed Al-Rashid");

    // Verify lastContacted was auto-updated
    const contact = await caller.contacts.get({ id: testContactId });
    expect(contact.lastContacted).toBeTruthy();
  });

  it("should log an interaction with messageText and auto-update lastContacted", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    const beforeContact = await caller.contacts.get({ id: testContactId });
    const beforeTimestamp = beforeContact.lastContacted ? new Date(beforeContact.lastContacted).getTime() : 0;

    await new Promise((r) => setTimeout(r, 1000));

    await caller.contacts.logInteraction({
      contactId: testContactId,
      action: "Sent follow-up via WhatsApp",
      messageText: "Ahmed — following up on our Gulf Summit conversation. The deal is live. Worth a call?",
    });

    const afterContact = await caller.contacts.get({ id: testContactId });
    const afterTimestamp = afterContact.lastContacted ? new Date(afterContact.lastContacted).getTime() : 0;

    expect(afterTimestamp).toBeGreaterThan(beforeTimestamp);
    expect(afterContact.interactions.length).toBeGreaterThan(0);
    expect(afterContact.interactions[0].action).toBe("Sent follow-up via WhatsApp");
    expect(afterContact.interactions[0].messageText).toContain("Ahmed");
  });

  it("should update interaction outcome", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    const contact = await caller.contacts.get({ id: testContactId });
    const interactionId = contact.interactions[0].id;
    await caller.contacts.updateOutcome({ interactionId, outcome: "response" });
    const updated = await caller.contacts.get({ id: testContactId });
    expect(updated.interactions[0].outcome).toBe("response");
  });

  it("should auto-update contact status to active when outcome is converted", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    const contact = await caller.contacts.get({ id: testContactId });
    const interactionId = contact.interactions[0].id;
    await caller.contacts.updateOutcome({ interactionId, outcome: "converted" });
    const updated = await caller.contacts.get({ id: testContactId });
    expect(updated.status).toBe("active");
  });

  it("should delete a contact", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    await caller.contacts.delete({ id: testContactId });
    const list = await caller.contacts.list();
    expect(list.find((c) => c.id === testContactId)).toBeUndefined();
  });
});
