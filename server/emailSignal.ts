/**
 * emailSignal.ts
 *
 * Phase 2 Sprint 2 — Inbound email signal pipeline.
 *
 * matchEmailToDeal()  — finds the best-matching pitch_triage record for an
 *                       inbound email based on sender domain / email / subject words.
 * processInboundEmail() — orchestrates match + auto-log, fire-and-forget safe.
 */
import { getDb, insertDealSignal, markDealSignalProcessed, savePitchTriage } from "./db";
import { pitchTriages } from "../drizzle/schema";
import { runTriagePipeline } from "./routers/pitch";
import { desc } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface MatchResult {
  dealId: number;
  userId: string;
  pitchPreview: string;
  score: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract domain from an email address, e.g. "foo@acme.com" → "acme.com" */
function emailDomain(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase().trim() : "";
}

/**
 * Extract meaningful words (≥ 3 chars) from a subject line for fuzzy matching.
 * Strips common filler words to reduce false positives.
 */
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "your", "our", "has",
  "have", "are", "was", "will", "not", "but", "can", "its", "all", "any",
  "new", "get", "let", "see", "use", "via", "per", "re:", "fwd", "fw:",
]);

function subjectWords(subject: string): string[] {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

// ── matchEmailToDeal ──────────────────────────────────────────────────────────

/**
 * Find the most recent pitch_triage record that best matches the inbound email.
 *
 * Matching priority (highest wins):
 *   1. pitchPreview contains sender's full email address (exact)
 *   2. pitchPreview contains sender's domain
 *   3. pitchPreview contains ≥ 2 words from the subject
 *   4. pitchPreview contains ≥ 1 word from the subject
 *
 * Returns null if no match with score > 0.
 */
export async function matchEmailToDeal(email: InboundEmail): Promise<MatchResult | null> {
  const db = await getDb();
  if (!db) return null;

  const senderEmail = email.from.toLowerCase().trim();
  const domain = emailDomain(senderEmail);
  const words = subjectWords(email.subject);

  // Fetch the last 500 most-recent root triages (no parentTriageId = original submissions)
  // We use a broad fetch + in-process scoring to avoid complex SQL scoring logic.
  const rows = await db
    .select({
      id: pitchTriages.id,
      userId: pitchTriages.userId,
      pitchPreview: pitchTriages.pitchPreview,
    })
    .from(pitchTriages)
    .orderBy(desc(pitchTriages.createdAt))
    .limit(500);

  let best: MatchResult | null = null;
  let bestScore = 0;

  for (const row of rows) {
    const preview = row.pitchPreview.toLowerCase();
    let score = 0;

    // Priority 1: exact sender email in preview
    if (senderEmail && preview.includes(senderEmail)) {
      score = 100;
    }
    // Priority 2: sender domain in preview (only if domain is meaningful, not gmail/yahoo/etc.)
    else if (domain && domain.length > 0 && !isGenericDomain(domain) && preview.includes(domain)) {
      score = 80;
    }
    // Priority 3+: subject word matches
    else if (words.length > 0) {
      const matchCount = words.filter((w) => preview.includes(w)).length;
      if (matchCount >= 2) score = 60;
      else if (matchCount === 1) score = 20;
    }

    if (score > bestScore) {
      bestScore = score;
      best = { dealId: row.id, userId: row.userId, pitchPreview: row.pitchPreview, score };
    }
  }

  return bestScore > 0 ? best : null;
}

/** Returns true for common free/generic email providers where the domain is not a company signal */
const GENERIC_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "live.com", "me.com", "aol.com", "protonmail.com", "mail.com",
]);
function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.has(domain);
}

// ── processInboundEmail ───────────────────────────────────────────────────────

/**
 * Main entry point called by the webhook route.
 * Matches the email to a deal, logs a signal, and triggers re-triage.
 * Never throws — all errors are caught and logged.
 */
export async function processInboundEmail(email: InboundEmail): Promise<void> {
  try {
    const match = await matchEmailToDeal(email);

    if (!match) {
      console.log(
        `[EmailSignal] Unmatched inbound email from=${email.from} subject="${email.subject}"`
      );
      return;
    }

    console.log(
      `[EmailSignal] Matched email from=${email.from} to dealId=${match.dealId} (score=${match.score})`
    );

    // Build signal text: "Email from [from]: [subject] — [first 200 chars of body]"
    const bodySnippet = email.text.trim().slice(0, 200);
    const signalText = `Email from ${email.from}: ${email.subject} — ${bodySnippet}`;

    // Insert signal row with source="email"
    const signalId = await insertDealSignal({
      userId: match.userId,
      dealId: String(match.dealId),
      signalType: "founder_update",
      signalText: signalText.slice(0, 500), // respect DB max length
      source: "email",
      processed: false,
    });

    // Trigger re-triage (mirrors logSignal procedure internals)
    try {
      const result = await runTriagePipeline(match.pitchPreview);
      await savePitchTriage({
        userId: match.userId,
        pitchPreview: match.pitchPreview,
        score: result.score,
        classification: result.classification,
        confidence: result.confidence,
        agentOutputs: JSON.stringify(result.agentOutputs),
        keySignals: JSON.stringify(result.keySignals),
        missingInfo: JSON.stringify(result.missingInfo),
        topMissingFields: JSON.stringify(result.topMissingFields),
        nextStep: result.nextStep,
        parentTriageId: match.dealId,
        triggerType: "signal_triggered",
        source: "auto",
      });
      console.log(`[EmailSignal] Re-triage complete for dealId=${match.dealId}`);
    } catch (err) {
      console.error(`[EmailSignal] Re-triage failed for dealId=${match.dealId}:`, err);
    }

    // Mark signal as processed
    if (signalId) await markDealSignalProcessed(signalId);
  } catch (err) {
    console.error("[EmailSignal] processInboundEmail error:", err);
  }
}
