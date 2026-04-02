/**
 * contacts.test.ts — Vitest tests for ARE Phase 1 & 2
 *
 * Tests:
 *  - contacts.create
 *  - contacts.list
 *  - contacts.update (auto-updates lastContacted)
 *  - contacts.generateMessage (Outreach Agent)
 *  - contacts.logInteraction (auto-updates lastContacted)
 *  - contacts.updateOutcome
 *  - contacts.saveStyleExamples + getStyleExamples
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { users, contacts, contactInteractions, outreachStyleExamples } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Test user setup ───────────────────────────────────────────────────────────

let testUserId: number;
let testContactId: number;

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable for testing");

  // Create a test user
  await db.insert(users).values({
    openId: `test-contacts-${Date.now()}`,
    name: "ARE Test User",
    email: "are-test@example.com",
  });

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, "are-test@example.com"))
    .limit(1);

  testUserId = user.id;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;

  // Clean up test data
  await db.delete(contactInteractions).where(eq(contactInteractions.userId, testUserId));
  await db.delete(contacts).where(eq(contacts.userId, testUserId));
  await db.delete(outreachStyleExamples).where(eq(outreachStyleExamples.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));
});

// ── Mock context builder ──────────────────────────────────────────────────────

function createMockContext(userId: number) {
  return {
    user: { id: userId, role: "user" as const },
    req: {} as any,
    res: {} as any,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("contacts router — ARE Phase 1 & 2", () => {
  it("should create a contact", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));
    const contact = await caller.contacts.create({
      name: "Ahmed Al-Rashid",
      company: "Gulf Capital Partners",
      role: "Managing Partner",
      region: "Kuwait",
      status: "new",
      notes: "Met at Gulf Summit 2026. Interested in healthcare deals.",
    });

    expect(contact).toBeDefined();
    expect(contact.name).toBe("Ahmed Al-Rashid");
    expect(contact.status).toBe("new");
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
    const updated = await caller.contacts.update({
      id: testContactId,
      status: "contacted",
    });

    expect(updated.status).toBe("contacted");
    expect(updated.lastContacted).toBeTruthy();
  });

  it("should save and retrieve style examples", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));

    await caller.contacts.saveStyleExamples({
      examples: [
        {
          exampleText:
            "Ahmed — following up on our Gulf Summit conversation. The healthcare diagnostic platform we discussed is now live. 3 LOIs in hand. Let me know if you want the deck.",
          label: "follow-up",
        },
        {
          exampleText:
            "Quick one: the Kuwaiti fintech roll-up closed at 8.2x. Similar multiple to what we discussed for your portfolio. Worth a call?",
          label: "conversion",
        },
      ],
    });

    const examples = await caller.contacts.getStyleExamples();
    expect(examples.length).toBe(2);
    expect(examples[0].exampleText).toContain("Ahmed");
  });

  it("should generate an outreach message using the Outreach Agent", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));

    const result = await caller.contacts.generateMessage({
      contactId: testContactId,
      goal: "follow_up",
      context: "We met at the Gulf Capital Summit last week. He mentioned interest in healthcare deals.",
    });

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(50);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.wordCount).toBeLessThanOrEqual(160); // should be under 150 words per spec
    expect(result.recipient).toBe("Ahmed Al-Rashid");
    expect(result.goal).toBe("follow_up");

    // Verify lastContacted was auto-updated
    const contact = await caller.contacts.get({ id: testContactId });
    expect(contact.lastContacted).toBeTruthy();
  });

  it("should log an interaction and auto-update lastContacted", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));

    const beforeContact = await caller.contacts.get({ id: testContactId });
    const beforeTimestamp = beforeContact.lastContacted
      ? new Date(beforeContact.lastContacted).getTime()
      : 0;

    // Wait 1 second to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 1000));

    await caller.contacts.logInteraction({
      contactId: testContactId,
      action: "Sent follow-up via WhatsApp",
      messageText: "Ahmed — following up on our Gulf Summit conversation...",
    });

    const afterContact = await caller.contacts.get({ id: testContactId });
    const afterTimestamp = afterContact.lastContacted
      ? new Date(afterContact.lastContacted).getTime()
      : 0;

    expect(afterTimestamp).toBeGreaterThan(beforeTimestamp);
    expect(afterContact.interactions.length).toBeGreaterThan(0);
    expect(afterContact.interactions[0].action).toBe("Sent follow-up via WhatsApp");
  });

  it("should update interaction outcome", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));

    const contact = await caller.contacts.get({ id: testContactId });
    const interactionId = contact.interactions[0].id;

    await caller.contacts.updateOutcome({
      interactionId,
      outcome: "response",
    });

    const updated = await caller.contacts.get({ id: testContactId });
    expect(updated.interactions[0].outcome).toBe("response");
  });

  it("should auto-update contact status to active when outcome is converted", async () => {
    const caller = appRouter.createCaller(createMockContext(testUserId));

    const contact = await caller.contacts.get({ id: testContactId });
    const interactionId = contact.interactions[0].id;

    await caller.contacts.updateOutcome({
      interactionId,
      outcome: "converted",
    });

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
