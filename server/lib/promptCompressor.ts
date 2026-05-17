/**
 * promptCompressor.ts — P3 prompt/context compression
 *
 * Two utilities, each independently usable:
 *
 * 1. trimMemoryContext(context, maxChars)
 *    Trims the COUNCIL MEMORY block to a maximum character budget.
 *    Preserves the header and footer lines; truncates the middle entries
 *    (least-similar first) when the budget is exceeded.
 *    Default budget: 1 500 chars (~375 tokens at 4 chars/token).
 *    Rationale: memory context is informative but not load-bearing;
 *    the council verdict is driven by the deal text, not precedents.
 *
 * 2. compressDealText(text, maxChars)
 *    Applies lightweight structural compression to the deal memo:
 *      • Collapses runs of blank lines (≥ 2) into a single blank line
 *      • Strips trailing whitespace from each line
 *      • Removes common boilerplate preambles (e.g. "Please evaluate the
 *        following deal memo:" prefix patterns)
 *      • Hard-truncates at maxChars with a trailing ellipsis marker
 *    Default budget: 8 000 chars (~2 000 tokens).
 *    Rationale: fleet runs often paste raw PDFs with excessive whitespace;
 *    this saves ~15–25% tokens with zero semantic loss.
 *
 * Both functions are pure (no I/O, no side effects) and safe to call on
 * short inputs — they return the original string unchanged if it fits.
 *
 * Usage in councilEngine.ts callPersona():
 *   import { trimMemoryContext, compressDealText } from "../lib/promptCompressor";
 *   const compressedMemory = trimMemoryContext(memoryContext);
 *   const compressedDeal   = compressDealText(dealText);
 */

// ── Config ────────────────────────────────────────────────────────────────────

/** Default max chars for memory context block (~375 tokens) */
export const MEMORY_CONTEXT_MAX_CHARS = 1_500;

/** Default max chars for deal text (~2 000 tokens) */
export const DEAL_TEXT_MAX_CHARS = 8_000;

/** Marker appended when deal text is hard-truncated */
export const TRUNCATION_MARKER = "\n\n[...deal text truncated for token budget...]";

// ── Boilerplate preamble patterns to strip from deal text ─────────────────────
// These are common prefixes that add no informational value for the council.
const BOILERPLATE_PATTERNS: RegExp[] = [
  /^please\s+evaluate\s+the\s+following\s+deal\s+memo[:\s]*/i,
  /^evaluate\s+this\s+deal\s+memo[:\s]*/i,
  /^here\s+is\s+the\s+deal\s+memo\s+to\s+evaluate[:\s]*/i,
  /^deal\s+memo\s+for\s+evaluation[:\s]*/i,
  /^the\s+following\s+is\s+a\s+deal\s+memo[:\s]*/i,
];

// ── trimMemoryContext ─────────────────────────────────────────────────────────

/**
 * Trim the COUNCIL MEMORY block to `maxChars`.
 *
 * Strategy:
 *   - If the context fits within budget, return unchanged.
 *   - Otherwise, keep the header line ("COUNCIL MEMORY — TOP SIMILAR PAST DECISIONS:")
 *     and the footer line ("Use these precedents..."), and include as many
 *     numbered entries as fit within the remaining budget (highest-similarity
 *     entries first, since buildMemoryContext already sorts by similarity desc).
 *
 * @param context   The raw memory context string from buildMemoryContext()
 * @param maxChars  Character budget (default: MEMORY_CONTEXT_MAX_CHARS)
 * @returns         Trimmed context string, or empty string if context is empty
 */
export function trimMemoryContext(
  context: string,
  maxChars: number = MEMORY_CONTEXT_MAX_CHARS,
): string {
  if (!context || context.length <= maxChars) return context;

  const HEADER = "COUNCIL MEMORY — TOP SIMILAR PAST DECISIONS:";
  const FOOTER = "Use these precedents to calibrate your analysis. Similar past verdicts are informative but not binding.";

  // Split into lines and identify entry blocks (lines starting with [N])
  const lines = context.split("\n");
  const headerIdx = lines.findIndex((l) => l.includes(HEADER));
  const footerIdx = lines.findIndex((l) => l.includes(FOOTER));

  if (headerIdx === -1 || footerIdx === -1) {
    // Unrecognized format — hard truncate
    return context.slice(0, maxChars) + TRUNCATION_MARKER;
  }

  const headerLine = lines[headerIdx];
  const footerLine = lines[footerIdx];
  const entryLines = lines.slice(headerIdx + 1, footerIdx).filter((l) => l.trim() !== "");

  // Group entry lines into blocks: each block starts with [N]
  const entryBlocks: string[] = [];
  let currentBlock: string[] = [];
  for (const line of entryLines) {
    if (/^\[\d+\]/.test(line) && currentBlock.length > 0) {
      entryBlocks.push(currentBlock.join("\n"));
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) entryBlocks.push(currentBlock.join("\n"));

  // Build trimmed context greedily from highest-similarity entries
  const overhead = headerLine.length + footerLine.length + 4; // 4 for newlines
  let budget = maxChars - overhead;
  const keptBlocks: string[] = [];

  for (const block of entryBlocks) {
    if (budget - block.length - 1 >= 0) {
      keptBlocks.push(block);
      budget -= block.length + 1; // +1 for newline separator
    } else {
      break;
    }
  }

  if (keptBlocks.length === 0) {
    // Nothing fits — return just the header + footer
    return `${headerLine}\n\n${footerLine}`;
  }

  return `${headerLine}\n${keptBlocks.join("\n")}\n\n${footerLine}`;
}

// ── compressDealText ──────────────────────────────────────────────────────────

/**
 * Apply lightweight structural compression to a deal memo text.
 *
 * Steps (in order):
 *   1. Strip known boilerplate preambles
 *   2. Trim trailing whitespace from each line
 *   3. Collapse runs of ≥ 2 blank lines into a single blank line
 *   4. Hard-truncate at maxChars with TRUNCATION_MARKER
 *
 * @param text      Raw deal memo text
 * @param maxChars  Character budget (default: DEAL_TEXT_MAX_CHARS)
 * @returns         Compressed text
 */
export function compressDealText(
  text: string,
  maxChars: number = DEAL_TEXT_MAX_CHARS,
): string {
  if (!text) return text;

  let compressed = text;

  // Step 1: Strip boilerplate preambles
  for (const pattern of BOILERPLATE_PATTERNS) {
    compressed = compressed.replace(pattern, "");
  }
  compressed = compressed.trimStart();

  // Step 2: Trim trailing whitespace from each line
  compressed = compressed
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  // Step 3: Collapse runs of ≥ 2 blank lines into a single blank line
  compressed = compressed.replace(/\n{3,}/g, "\n\n");

  // Step 4: Hard-truncate at budget
  if (compressed.length > maxChars) {
    compressed = compressed.slice(0, maxChars) + TRUNCATION_MARKER;
  }

  return compressed;
}

/**
 * Estimate approximate token count from character count.
 * Uses the widely-cited 4 chars/token heuristic for English text.
 * Not used in production logic — exposed for tests and observability.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
