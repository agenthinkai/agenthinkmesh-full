/**
 * server/pitch.ogimage.test.ts
 *
 * Tests for PitchMirror shared-link og:image / twitter:image injection:
 *   1. og:image tag is injected for new shared links (with stage)
 *   2. og:image tag is injected for legacy shared links (no stage)
 *   3. twitter:image tag is injected
 *   4. og:image:alt and twitter:image:alt use safe generic text
 *   5. No private content appears in image URL or alt text
 *   6. twitter:card is set to summary_large_image (not just summary)
 *   7. Image URL is a valid absolute HTTPS URL
 *   8. PITCHMIRROR_OG_IMAGE_URL constant is exported and non-empty
 */

import { describe, it, expect } from "vitest";
import {
  injectOgMetaTags,
  PITCHMIRROR_OG_IMAGE_URL,
  PITCHMIRROR_OG_IMAGE_ALT,
  buildShareMetaTitle,
  buildShareMetaDescription,
} from "./pitchMirrorMetaRoute";

const BASE_HTML = `<!doctype html><html><head><title>AgenThinkMesh</title></head><body><div id="root"></div></body></html>`;
const CANONICAL_URL = "https://agenthink-7enctkan.manus.space/pitchmirror/r/abc123def456abc123def456abc123def456abc123def456";

// ── og:image constant ─────────────────────────────────────────────────────────

describe("PITCHMIRROR_OG_IMAGE_URL constant", () => {
  it("is exported and non-empty", () => {
    expect(PITCHMIRROR_OG_IMAGE_URL).toBeTruthy();
    expect(PITCHMIRROR_OG_IMAGE_URL.length).toBeGreaterThan(0);
  });

  it("is an absolute HTTPS URL", () => {
    expect(PITCHMIRROR_OG_IMAGE_URL).toMatch(/^https:\/\//);
  });

  it("does not contain private data patterns", () => {
    const privatePatterns = ["userId", "email", "@", "pitchText", "strength", "concern", "stage"];
    for (const pattern of privatePatterns) {
      expect(PITCHMIRROR_OG_IMAGE_URL.toLowerCase()).not.toContain(pattern.toLowerCase());
    }
  });
});

describe("PITCHMIRROR_OG_IMAGE_ALT constant", () => {
  it("is exported and non-empty", () => {
    expect(PITCHMIRROR_OG_IMAGE_ALT).toBeTruthy();
  });

  it("is a safe generic string", () => {
    expect(PITCHMIRROR_OG_IMAGE_ALT).toBe("PitchMirror shared result preview");
  });

  it("does not contain private data", () => {
    const privatePatterns = ["userId", "email", "@", "pitchText", "strength", "concern"];
    for (const pattern of privatePatterns) {
      expect(PITCHMIRROR_OG_IMAGE_ALT.toLowerCase()).not.toContain(pattern.toLowerCase());
    }
  });
});

// ── og:image injection for new links (with stage) ─────────────────────────────

describe("injectOgMetaTags — og:image for stage-aware links", () => {
  const title = buildShareMetaTitle("Early revenue");
  const description = buildShareMetaDescription("Early revenue");

  it("injects og:image property tag", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain('property="og:image"');
  });

  it("og:image content is the static branded URL", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain(PITCHMIRROR_OG_IMAGE_URL);
  });

  it("injects og:image:alt property tag", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain('property="og:image:alt"');
  });

  it("og:image:alt content is the safe generic alt text", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain(PITCHMIRROR_OG_IMAGE_ALT);
  });

  it("injects twitter:image name tag", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain('name="twitter:image"');
  });

  it("twitter:image content is the static branded URL", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    // Count occurrences of the image URL — should appear at least twice (og:image + twitter:image)
    const occurrences = (result.match(new RegExp(PITCHMIRROR_OG_IMAGE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("injects twitter:image:alt name tag", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain('name="twitter:image:alt"');
  });

  it("sets twitter:card to summary_large_image (not just summary)", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain('content="summary_large_image"');
    // Must NOT use the plain "summary" card type when image is present
    const summaryOnly = result.match(/content="summary"/g) ?? [];
    expect(summaryOnly.length).toBe(0);
  });
});

// ── og:image injection for legacy links (no stage) ────────────────────────────

describe("injectOgMetaTags — og:image for legacy links (no stage)", () => {
  const title = buildShareMetaTitle(null);
  const description = buildShareMetaDescription(null);

  it("still injects og:image for legacy links", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain('property="og:image"');
    expect(result).toContain(PITCHMIRROR_OG_IMAGE_URL);
  });

  it("still injects twitter:image for legacy links", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain('name="twitter:image"');
  });

  it("still injects og:image:alt for legacy links", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain('property="og:image:alt"');
    expect(result).toContain(PITCHMIRROR_OG_IMAGE_ALT);
  });

  it("uses generic title for legacy links", () => {
    const result = injectOgMetaTags(BASE_HTML, title, description, CANONICAL_URL);
    expect(result).toContain("PitchMirror Result");
    expect(result).not.toContain("Evaluated at:");
  });
});

// ── No private data in image-related tags ─────────────────────────────────────

describe("og:image — no private data", () => {
  const PRIVATE_PATTERNS = [
    "userId", "user_id", "email", "@gmail", "pitchText",
    "strength", "concern", "missing", "whatToFix",
    "founderStage", "stage=",
  ];

  function assertNoPrivateData(str: string) {
    for (const pattern of PRIVATE_PATTERNS) {
      expect(str.toLowerCase()).not.toContain(pattern.toLowerCase());
    }
  }

  it("og:image URL contains no private data", () => {
    assertNoPrivateData(PITCHMIRROR_OG_IMAGE_URL);
  });

  it("og:image:alt contains no private data", () => {
    assertNoPrivateData(PITCHMIRROR_OG_IMAGE_ALT);
  });

  it("full injected HTML contains no private data in image tags", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Scaling"),
      buildShareMetaDescription("Scaling"),
      CANONICAL_URL
    );
    // Extract just the image-related meta lines for targeted assertion
    const imageLines = result
      .split("\n")
      .filter((line) => line.includes("og:image") || line.includes("twitter:image"));
    for (const line of imageLines) {
      assertNoPrivateData(line);
    }
  });
});

// ── All meta tags appear before </head> ───────────────────────────────────────

describe("injectOgMetaTags — tag placement", () => {
  it("og:image appears before </head>", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle("Building (no revenue)"),
      buildShareMetaDescription("Building (no revenue)"),
      CANONICAL_URL
    );
    const headEnd = result.indexOf("</head>");
    const ogImage = result.indexOf('property="og:image"');
    expect(ogImage).toBeGreaterThan(0);
    expect(ogImage).toBeLessThan(headEnd);
  });

  it("twitter:image appears before </head>", () => {
    const result = injectOgMetaTags(
      BASE_HTML,
      buildShareMetaTitle(null),
      buildShareMetaDescription(null),
      CANONICAL_URL
    );
    const headEnd = result.indexOf("</head>");
    const twitterImage = result.indexOf('name="twitter:image"');
    expect(twitterImage).toBeGreaterThan(0);
    expect(twitterImage).toBeLessThan(headEnd);
  });
});
