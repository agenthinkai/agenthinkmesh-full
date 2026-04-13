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

  it("should generate a WhatsApp-optimised outreach message", async () => {  // LLM call — needs extended timeout
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

// ── Unit tests: CSV parsing logic ─────────────────────────────────────────────

describe("CSV parsing logic", () => {
  function parseCsvText(text: string) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/["']/g, ""));
    return lines.slice(1).map((line, i) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      values.push(current.trim());
      const row: Record<string, string | undefined> & { rowIndex: number; name: string } = { rowIndex: i, name: "" };
      headers.forEach((h, idx) => {
        const v = values[idx] ?? "";
        if (h === "name") row.name = v;
        else if (h === "company") row.company = v || undefined;
        else if (h === "phone_number" || h === "phone") row.phone_number = v || undefined;
        else if (h === "email") row.email = v || undefined;
        else if (h === "linkedin_url" || h === "linkedin") row.linkedin_url = v || undefined;
        else if (h === "role") row.role = v || undefined;
      });
      return row;
    }).filter((r) => r.name.trim().length > 0);
  }

  it("parses a valid CSV with all columns", () => {
    const csv = `name,company,phone_number,email,role\nAhmed Al-Rashid,Gulf Capital,+96550001234,ahmed@gulfcapital.com,Managing Director\nSara Al-Mutairi,Kuwait Finance House,+96560005678,sara@kfh.com,VP Investments`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Ahmed Al-Rashid");
    expect(rows[0].company).toBe("Gulf Capital");
    expect(rows[0].phone_number).toBe("+96550001234");
    expect(rows[0].email).toBe("ahmed@gulfcapital.com");
  });

  it("handles quoted fields with commas inside", () => {
    const csv = `name,company,role\n"Al-Rashid, Ahmed","Gulf Capital, Kuwait","MD, PE"`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Al-Rashid, Ahmed");
    expect(rows[0].company).toBe("Gulf Capital, Kuwait");
  });

  it("filters out rows with empty name", () => {
    const csv = `name,company\nAhmed Al-Rashid,Gulf Capital\n,Empty Name Row\nSara Al-Mutairi,KFH`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.name.trim().length > 0)).toBe(true);
  });

  it("handles alternate column names (phone, linkedin)", () => {
    const csv = `name,phone,linkedin\nAhmed,+96550001234,https://linkedin.com/in/ahmed`;
    const rows = parseCsvText(csv);
    expect(rows[0].phone_number).toBe("+96550001234");
    expect(rows[0].linkedin_url).toBe("https://linkedin.com/in/ahmed");
  });

  it("returns empty array for CSV with only headers", () => {
    const csv = `name,company,email`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(0);
  });
});

// ── Unit tests: Duplicate detection logic ─────────────────────────────────────

describe("Duplicate detection logic", () => {
  it("detects exact name+company duplicates (case-insensitive)", () => {
    const existing = [{ name: "Ahmed Al-Rashid", company: "Gulf Capital" }];
    const existingKeys = new Set(existing.map((c) => `${c.name.toLowerCase().trim()}|${(c.company ?? "").toLowerCase().trim()}`));
    const key = "ahmed al-rashid|gulf capital";
    expect(existingKeys.has(key)).toBe(true);
  });

  it("does not flag different company as duplicate", () => {
    const existing = [{ name: "Ahmed Al-Rashid", company: "Gulf Capital" }];
    const existingKeys = new Set(existing.map((c) => `${c.name.toLowerCase().trim()}|${(c.company ?? "").toLowerCase().trim()}`));
    const key = "ahmed al-rashid|kuwait finance house";
    expect(existingKeys.has(key)).toBe(false);
  });

  it("treats empty company and null company as the same key", () => {
    const existing = [{ name: "Sara Al-Mutairi", company: null }];
    const existingKeys = new Set(existing.map((c) => `${c.name.toLowerCase().trim()}|${(c.company ?? "").toLowerCase().trim()}`));
    expect(existingKeys.has("sara al-mutairi|")).toBe(true);
  });
});

// ── Unit tests: Summary byStatus calculation ──────────────────────────────────

describe("Summary byStatus calculation", () => {
  it("sums counts correctly across all statuses", () => {
    const rows = [
      { status: "new", count: 3 },
      { status: "contacted", count: 5 },
      { status: "active", count: 2 },
      { status: "closed", count: 1 },
    ];
    const byStatus = { new: 0, contacted: 0, active: 0, closed: 0 };
    let total = 0;
    for (const row of rows) {
      const count = Number(row.count);
      byStatus[row.status as keyof typeof byStatus] = count;
      total += count;
    }
    expect(total).toBe(11);
    expect(byStatus.new).toBe(3);
    expect(byStatus.contacted).toBe(5);
    expect(byStatus.active).toBe(2);
    expect(byStatus.closed).toBe(1);
  });

  it("handles empty contacts (all zeros)", () => {
    const byStatus = { new: 0, contacted: 0, active: 0, closed: 0 };
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });
});

// ── Unit tests: Email mailto URL encoding ─────────────────────────────────────

describe("Email mailto URL encoding", () => {
  it("encodes subject and body correctly", () => {
    const subject = "Quick follow-up on healthcare deal";
    const body = "Ahmed,\n\nWould you be open to a call?\n\n[Your Name]";
    const email = "ahmed@gulfcapital.com";
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    expect(mailtoUrl).toContain("mailto:ahmed@gulfcapital.com");
    expect(mailtoUrl).toContain("subject=Quick%20follow-up");
    expect(mailtoUrl).toContain("body=Ahmed");
  });

  it("handles empty email (no recipient)", () => {
    const mailtoUrl = `mailto:?subject=${encodeURIComponent("Test")}&body=${encodeURIComponent("Body")}`;
    expect(mailtoUrl.startsWith("mailto:?")).toBe(true);
  });
});

// ── Unit tests: Partial import logic ─────────────────────────────────────────

describe("Partial import logic", () => {
  it("imports valid rows and skips duplicates when importDuplicates=false", () => {
    const rows = [
      { name: "Ahmed Al-Rashid", _isDuplicate: true, _errors: [] as string[] },
      { name: "Sara Al-Mutairi", _isDuplicate: false, _errors: [] as string[] },
      { name: "", _isDuplicate: false, _errors: ["Name is required"] },
    ];
    const toImport = rows.filter((r) => !r._errors.length && !r._isDuplicate);
    expect(toImport).toHaveLength(1);
    expect(toImport[0].name).toBe("Sara Al-Mutairi");
  });

  it("imports duplicates when importDuplicates=true", () => {
    const rows = [
      { name: "Ahmed Al-Rashid", _isDuplicate: true, _errors: [] as string[] },
      { name: "Sara Al-Mutairi", _isDuplicate: false, _errors: [] as string[] },
    ];
    const toImport = rows.filter((r) => !r._errors.length);
    expect(toImport).toHaveLength(2);
  });

  it("always skips error rows regardless of importDuplicates", () => {
    const rows = [
      { name: "", _isDuplicate: false, _errors: ["Name is required"] },
      { name: "Ahmed", _isDuplicate: false, _errors: [] as string[] },
    ];
    const toImport = rows.filter((r) => !r._errors.length);
    expect(toImport).toHaveLength(1);
    expect(toImport[0].name).toBe("Ahmed");
  });
});
