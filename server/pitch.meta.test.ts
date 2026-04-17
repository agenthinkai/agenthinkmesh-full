/**
 * server/pitch.meta.test.ts
 *
 * Tests for PitchMirror shared-link OG / meta tag generation:
 *   1. Stage-aware title and description when founderStageLabel is present
 *   2. Generic fallback title and description for legacy links (no stage)
 *   3. No private content (email, userId, pitchText, strengths, concerns) in metadata
 *   4. HTML injection correctness (injectOgMetaTags)
 *   5. Social crawler detection (isSocialCrawler)
 *   6. resolveShareMetaStageLabel mapping for all 4 stages
 */

import { describe, it, expect } from "vitest";
import {
  resolveShareMetaStageLabel,
  buildShareMetaTitle,
  buildShareMetaDescription,
  injectOgMetaTags,
  isSocialCrawler,
} from "./pitchMirrorMetaRoute";

// ── Stage label resolution ────────────────────────────────────────────────────

describe("resolveShareMetaStageLabel", () => {
  it("resolves 'idea' → 'Exploring idea'", () => {
    expect(resolveShareMetaStageLabel("idea")).toBe("Exploring idea");
  });

  it("resolves 'building' → 'Building (no revenue)'", () => {
    expect(resolveShareMetaStageLabel("building")).toBe("Building (no revenue)");
  });

  it("resolves 'early_revenue' → 'Early revenue'", () => {
    expect(resolveShareMetaStageLabel("early_revenue")).toBe("Early revenue");
  });

  it("resolves 'scaling' → 'Scaling'", () => {
    expect(resolveShareMetaStageLabel("scaling")).toBe("Scaling");
  });

  it("returns null for null input (legacy)", () => {
    expect(resolveShareMetaStageLabel(null)).toBeNull();
  });

  it("returns null for undefined input (legacy)", () => {
    expect(resolveShareMetaStageLabel(undefined)).toBeNull();
  });

  it("returns null for unknown stage string", () => {
    expect(resolveShareMetaStageLabel("unknown")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveShareMetaStageLabel("")).toBeNull();
  });
});

// ── Title generation ──────────────────────────────────────────────────────────

describe("buildShareMetaTitle", () => {
  it("includes stage label when present", () => {
    expect(buildShareMetaTitle("Early revenue")).toBe("PitchMirror Result — Early revenue");
  });

  it("uses generic title when stageLabel is null (legacy)", () => {
    expect(buildShareMetaTitle(null)).toBe("PitchMirror Result");
  });

  it("does not include private data in title", () => {
    const title = buildShareMetaTitle("Scaling");
    expect(title).not.toContain("@");
    expect(title).not.toContain("userId");
    expect(title).not.toContain("email");
    expect(title).not.toContain("strength");
    expect(title).not.toContain("concern");
  });
});

// ── Description generation ────────────────────────────────────────────────────

describe("buildShareMetaDescription", () => {
  it("includes 'Evaluated at: [stage]' when stage is present", () => {
    const desc = buildShareMetaDescription("Exploring idea");
    expect(desc).toContain("Evaluated at: Exploring idea");
  });

  it("includes 'Founder-facing pitch feedback' always", () => {
    expect(buildShareMetaDescription("Scaling")).toContain("Founder-facing pitch feedback");
    expect(buildShareMetaDescription(null)).toContain("Founder-facing pitch feedback");
  });

  it("uses generic fallback when stageLabel is null (legacy)", () => {
    const desc = buildShareMetaDescription(null);
    expect(desc).toBe("Shared PitchMirror result · Founder-facing pitch feedback");
  });

  it("does not include private data in description", () => {
    const desc = buildShareMetaDescription("Building (no revenue)");
    expect(desc).not.toContain("@");
    expect(desc).not.toContain("userId");
    expect(desc).not.toContain("email");
    expect(desc).not.toContain("strength");
    expect(desc).not.toContain("concern");
    expect(desc).not.toContain("missing");
  });

  it("stage-aware description does not include stage of other stages", () => {
    const desc = buildShareMetaDescription("Early revenue");
    expect(desc).not.toContain("Scaling");
    expect(desc).not.toContain("Exploring idea");
    expect(desc).not.toContain("Building");
  });
});

// ── HTML injection ────────────────────────────────────────────────────────────

describe("injectOgMetaTags", () => {
  const baseHtml = `<!doctype html><html><head><title>AgenThinkMesh</title></head><body><div id="root"></div></body></html>`;

  it("replaces the <title> tag with the new title", () => {
    const result = injectOgMetaTags(baseHtml, "PitchMirror Result — Scaling", "desc", "https://example.com/r/abc");
    expect(result).toContain("<title>PitchMirror Result — Scaling</title>");
    expect(result).not.toContain("<title>AgenThinkMesh</title>");
  });

  it("injects og:title meta tag", () => {
    const result = injectOgMetaTags(baseHtml, "PitchMirror Result", "desc", "https://example.com/r/abc");
    expect(result).toContain('property="og:title"');
    expect(result).toContain("PitchMirror Result");
  });

  it("injects og:description meta tag", () => {
    const result = injectOgMetaTags(baseHtml, "title", "Evaluated at: Early revenue · Founder-facing pitch feedback", "https://example.com/r/abc");
    expect(result).toContain('property="og:description"');
    expect(result).toContain("Evaluated at: Early revenue");
  });

  it("injects twitter:card meta tag (summary_large_image when image is present)", () => {
    const result = injectOgMetaTags(baseHtml, "title", "desc", "https://example.com/r/abc");
    expect(result).toContain('name="twitter:card"');
    expect(result).toContain('content="summary_large_image"');
  });

  it("injects og:url meta tag", () => {
    const result = injectOgMetaTags(baseHtml, "title", "desc", "https://example.com/r/abc123");
    expect(result).toContain('property="og:url"');
    expect(result).toContain("https://example.com/r/abc123");
  });

  it("injects og:type meta tag", () => {
    const result = injectOgMetaTags(baseHtml, "title", "desc", "https://example.com/r/abc");
    expect(result).toContain('property="og:type"');
    expect(result).toContain('content="website"');
  });

  it("all meta tags appear before </head>", () => {
    const result = injectOgMetaTags(baseHtml, "title", "desc", "https://example.com/r/abc");
    const headEnd = result.indexOf("</head>");
    const ogTitle = result.indexOf('property="og:title"');
    expect(ogTitle).toBeGreaterThan(0);
    expect(ogTitle).toBeLessThan(headEnd);
  });

  it("escapes HTML special characters in title and description", () => {
    const result = injectOgMetaTags(baseHtml, 'Title with "quotes" & <tags>', "Desc & more", "https://example.com");
    expect(result).toContain("&quot;quotes&quot;");
    expect(result).toContain("&amp;");
    expect(result).toContain("&lt;tags&gt;");
  });

  it("does not expose private data in injected HTML", () => {
    const result = injectOgMetaTags(baseHtml, "PitchMirror Result", "Shared PitchMirror result · Founder-facing pitch feedback", "https://example.com/r/abc");
    expect(result).not.toContain("userId");
    expect(result).not.toContain("email");
    expect(result).not.toContain("pitchText");
    expect(result).not.toContain("strength");
    expect(result).not.toContain("concern");
  });
});

// ── Social crawler detection ──────────────────────────────────────────────────

describe("isSocialCrawler", () => {
  it("detects Twitterbot", () => {
    expect(isSocialCrawler("Twitterbot/1.0")).toBe(true);
  });

  it("detects facebookexternalhit", () => {
    expect(isSocialCrawler("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
  });

  it("detects LinkedInBot", () => {
    expect(isSocialCrawler("LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1 +http://www.linkedin.com)")).toBe(true);
  });

  it("detects Slackbot", () => {
    expect(isSocialCrawler("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
  });

  it("detects WhatsApp", () => {
    expect(isSocialCrawler("WhatsApp/2.19.81 A")).toBe(true);
  });

  it("detects TelegramBot", () => {
    expect(isSocialCrawler("TelegramBot (like TwitterBot)")).toBe(true);
  });

  it("detects Discordbot", () => {
    expect(isSocialCrawler("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)")).toBe(true);
  });

  it("does NOT flag a regular Chrome browser", () => {
    expect(isSocialCrawler("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBe(false);
  });

  it("does NOT flag a regular Safari browser", () => {
    expect(isSocialCrawler("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15")).toBe(false);
  });

  it("does NOT flag an empty user-agent", () => {
    expect(isSocialCrawler("")).toBe(false);
  });
});

// ── End-to-end meta string safety ────────────────────────────────────────────

describe("meta string safety — no private data", () => {
  const PRIVATE_PATTERNS = [
    "userId", "user_id", "email", "@", "pitchText", "pitch_text",
    "strength", "concern", "missing", "whatToFix", "whatsMissing",
    "mirrorResultJson",
  ];

  function assertNoPrivateData(str: string) {
    for (const pattern of PRIVATE_PATTERNS) {
      expect(str.toLowerCase()).not.toContain(pattern.toLowerCase());
    }
  }

  it("stage-aware title contains no private data", () => {
    assertNoPrivateData(buildShareMetaTitle("Early revenue"));
  });

  it("generic title contains no private data", () => {
    assertNoPrivateData(buildShareMetaTitle(null));
  });

  it("stage-aware description contains no private data", () => {
    assertNoPrivateData(buildShareMetaDescription("Scaling"));
  });

  it("generic description contains no private data", () => {
    assertNoPrivateData(buildShareMetaDescription(null));
  });
});
