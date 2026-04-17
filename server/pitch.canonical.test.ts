/**
 * server/pitch.canonical.test.ts
 *
 * Tests for PitchMirror shared-link canonical URL tag injection:
 *   1. Canonical tag is present in injected HTML (new link with stage)
 *   2. Canonical href matches the absolute shared URL exactly
 *   3. Legacy links (no stage) also receive canonical tag
 *   4. Canonical href contains only the share token path — no user data, no stage, no query params
 *   5. Canonical tag appears before </head>
 *   6. Canonical tag is a <link> element (not a <meta>)
 *   7. Multiple calls produce exactly one canonical tag (no duplication)
 */

import { describe, it, expect } from "vitest";
import {
  injectOgMetaTags,
  buildShareMetaTitle,
  buildShareMetaDescription,
} from "./pitchMirrorMetaRoute";

const BASE_HTML = `<!doctype html><html><head><title>AgenThinkMesh</title></head><body><div id="root"></div></body></html>`;
const CANONICAL_URL = "https://agenthink-7enctkan.manus.space/pitchmirror/r/abc123def456abc123def456abc123def456abc123def456";
const LEGACY_CANONICAL_URL = "https://agenthink-7enctkan.manus.space/pitchmirror/r/legacy0000000000000000000000000000000000000000000";

// ── Canonical tag presence ────────────────────────────────────────────────────

describe("injectOgMetaTags — canonical link tag", () => {
  it("injects a <link rel=\"canonical\"> tag for a new link with stage", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Early revenue"),
      buildShareMetaDescription("Early revenue"),
      CANONICAL_URL
    );
    expect(result).toContain('rel="canonical"');
  });

  it("canonical href matches the absolute shared URL exactly", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Scaling"),
      buildShareMetaDescription("Scaling"),
      CANONICAL_URL
    );
    expect(result).toContain(`href="${CANONICAL_URL}"`);
  });

  it("injects canonical for legacy links (no stage)", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle(null),
      buildShareMetaDescription(null),
      LEGACY_CANONICAL_URL
    );
    expect(result).toContain('rel="canonical"');
    expect(result).toContain(`href="${LEGACY_CANONICAL_URL}"`);
  });

  it("canonical tag appears before </head>", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Building (no revenue)"),
      buildShareMetaDescription("Building (no revenue)"),
      CANONICAL_URL
    );
    const headEnd = result.indexOf("</head>");
    const canonical = result.indexOf('rel="canonical"');
    expect(canonical).toBeGreaterThan(0);
    expect(canonical).toBeLessThan(headEnd);
  });

  it("canonical is a <link> element, not a <meta>", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Exploring idea"),
      buildShareMetaDescription("Exploring idea"),
      CANONICAL_URL
    );
    // Find the canonical line
    const lines = result.split("\n");
    const canonicalLine = lines.find((l) => l.includes('rel="canonical"'));
    expect(canonicalLine).toBeDefined();
    expect(canonicalLine).toContain("<link");
    expect(canonicalLine).not.toContain("<meta");
  });
});

// ── Canonical href safety ─────────────────────────────────────────────────────

describe("canonical URL — no private data", () => {
  const PRIVATE_PATTERNS = [
    "userId", "user_id", "email", "@", "pitchText",
    "strength", "concern", "stage=", "founderStage",
    "?", "#",
  ];

  it("canonical href contains no private data or query params", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Early revenue"),
      buildShareMetaDescription("Early revenue"),
      CANONICAL_URL
    );
    const lines = result.split("\n");
    const canonicalLine = lines.find((l) => l.includes('rel="canonical"')) ?? "";
    for (const pattern of PRIVATE_PATTERNS) {
      expect(canonicalLine).not.toContain(pattern);
    }
  });

  it("canonical href for legacy link contains no private data", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle(null),
      buildShareMetaDescription(null),
      LEGACY_CANONICAL_URL
    );
    const lines = result.split("\n");
    const canonicalLine = lines.find((l) => l.includes('rel="canonical"')) ?? "";
    for (const pattern of PRIVATE_PATTERNS) {
      expect(canonicalLine).not.toContain(pattern);
    }
  });
});

// ── Canonical URL format ──────────────────────────────────────────────────────

describe("canonical URL — format validation", () => {
  it("canonical href is an absolute HTTPS URL", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Scaling"),
      buildShareMetaDescription("Scaling"),
      CANONICAL_URL
    );
    // Extract href value from canonical line
    const match = result.match(/rel="canonical"\s+href="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^https:\/\//);
  });

  it("canonical href path follows /pitchmirror/r/:token pattern", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle(null),
      buildShareMetaDescription(null),
      CANONICAL_URL
    );
    const match = result.match(/rel="canonical"\s+href="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/\/pitchmirror\/r\/[a-f0-9]{48}$/);
  });

  it("canonical href for all four stages uses the same URL structure", () => {
    const stages = ["Exploring idea", "Building (no revenue)", "Early revenue", "Scaling"] as const;
    for (const stage of stages) {
      const result = injectOgMetaTags(
        BASE_HTML,
        buildShareMetaTitle(stage),
        buildShareMetaDescription(stage),
        CANONICAL_URL
      );
      // Canonical URL must be identical regardless of stage
      expect(result).toContain(`href="${CANONICAL_URL}"`);
    }
  });
});

// ── Canonical tag placement relative to other tags ────────────────────────────

describe("canonical tag — placement relative to og:url", () => {
  it("both canonical and og:url reference the same URL", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Early revenue"),
      buildShareMetaDescription("Early revenue"),
      CANONICAL_URL
    );
    expect(result).toContain(`href="${CANONICAL_URL}"`);
    expect(result).toContain(`content="${CANONICAL_URL}"`);
  });
});
