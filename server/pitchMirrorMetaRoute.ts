/**
 * server/pitchMirrorMetaRoute.ts
 *
 * Intercepts GET /pitchmirror/r/:token requests from social crawlers and
 * injects OG / Twitter meta tags into the HTML before serving it.
 *
 * Strategy:
 *   - For real browsers: serve the SPA as normal (no interception).
 *   - For social crawlers (Twitterbot, facebookexternalhit, LinkedInBot, etc.):
 *     fetch the share record, build safe meta strings, inject into <head>, serve.
 *
 * Safety rules:
 *   - Title: "PitchMirror Result" or "PitchMirror Result — [Stage]"
 *   - Description: "Evaluated at: [Stage] · Founder-facing pitch feedback"
 *     or generic fallback for legacy links.
 *   - Image: static branded card — no user data, no stage text, no result details.
 *   - No strengths, concerns, fix items, missing items, user IDs, emails, or
 *     raw pitch text are ever included.
 */

import { type Express } from "express";
import fs from "fs";
import path from "path";

// ── Static branded preview image ─────────────────────────────────────────────
// Permanent CDN URL tied to the webdev project lifecycle — never expires.
// Image: dark background, "PitchMirror" title, subtitle, no private data.
export const PITCHMIRROR_OG_IMAGE_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663268376562/7EnctkaNppkKLbjFfnH6YY/pitchmirror-og-card-KFUdoyQzYGtghnEhMxtrKY.png";

export const PITCHMIRROR_OG_IMAGE_ALT = "PitchMirror shared result preview";

// ── Stage label map (mirrors server/routers/pitch.ts) ────────────────────────
const STAGE_LABELS: Record<string, string> = {
  idea: "Exploring idea",
  building: "Building (no revenue)",
  early_revenue: "Early revenue",
  scaling: "Scaling",
};

/** Resolve a human-readable label from a raw stage key. Returns null for unknown/absent. */
export function resolveShareMetaStageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return STAGE_LABELS[stage] ?? null;
}

/** Build safe OG title — never includes private data. */
export function buildShareMetaTitle(stageLabel: string | null): string {
  if (stageLabel) return `PitchMirror Result — ${stageLabel}`;
  return "PitchMirror Result";
}

/** Build safe OG description — never includes private data. */
export function buildShareMetaDescription(stageLabel: string | null): string {
  if (stageLabel) {
    return `Evaluated at: ${stageLabel} · Founder-facing pitch feedback`;
  }
  return "Shared PitchMirror result · Founder-facing pitch feedback";
}

/** Returns true if the User-Agent belongs to a known social/link crawler. */
export function isSocialCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("twitterbot") ||
    ua.includes("facebookexternalhit") ||
    ua.includes("linkedinbot") ||
    ua.includes("slackbot") ||
    ua.includes("whatsapp") ||
    ua.includes("telegrambot") ||
    ua.includes("discordbot") ||
    ua.includes("googlebot") ||
    ua.includes("bingbot") ||
    ua.includes("applebot") ||
    ua.includes("iframely") ||
    ua.includes("embedly") ||
    ua.includes("outbrain") ||
    ua.includes("pinterest") ||
    ua.includes("vkshare") ||
    ua.includes("w3c_validator")
  );
}

/** Inject OG meta tags (including og:image and canonical link) into an HTML string's <head> section. */
export function injectOgMetaTags(
  html: string,
  title: string,
  description: string,
  url: string,
  imageUrl: string = PITCHMIRROR_OG_IMAGE_URL,
  imageAlt: string = PITCHMIRROR_OG_IMAGE_ALT
): string {
  const escapedTitle = escapeHtml(title);
  const escapedDesc = escapeHtml(description);
  const escapedUrl = escapeHtml(url);
  const escapedImageUrl = escapeHtml(imageUrl);
  const escapedImageAlt = escapeHtml(imageAlt);

  const metaTags = [
    `  <title>${escapedTitle}</title>`,
    // Canonical URL — no user data, no stage, no query params
    `  <link rel="canonical" href="${escapedUrl}" />`,
    `  <meta name="description" content="${escapedDesc}" />`,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:title" content="${escapedTitle}" />`,
    `  <meta property="og:description" content="${escapedDesc}" />`,
    `  <meta property="og:url" content="${escapedUrl}" />`,
    `  <meta property="og:image" content="${escapedImageUrl}" />`,
    `  <meta property="og:image:alt" content="${escapedImageAlt}" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${escapedTitle}" />`,
    `  <meta name="twitter:description" content="${escapedDesc}" />`,
    `  <meta name="twitter:image" content="${escapedImageUrl}" />`,
    `  <meta name="twitter:image:alt" content="${escapedImageAlt}" />`,
  ].join("\n");

  // Replace the existing <title> tag and inject all tags before </head>
  const withoutTitle = html.replace(/<title>[^<]*<\/title>/, "");
  return withoutTitle.replace("</head>", `${metaTags}\n</head>`);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Register the PitchMirror shared-link meta-injection middleware. */
export function registerPitchMirrorMetaRoute(app: Express): void {
  app.get("/pitchmirror/r/:token", async (req, res, next) => {
    const ua = req.headers["user-agent"] ?? "";

    // Only intercept social crawlers — real browsers get the normal SPA flow
    if (!isSocialCrawler(ua)) {
      return next();
    }

    try {
      const { getPitchMirrorShare } = await import("./db");
      const token = req.params.token;

      // Validate token format (48-char hex)
      if (!/^[a-f0-9]{48}$/.test(token)) {
        return next();
      }

      const row = await getPitchMirrorShare(token);
      const stageLabel = row ? resolveShareMetaStageLabel(row.founderStage) : null;
      const title = buildShareMetaTitle(stageLabel);
      const description = buildShareMetaDescription(stageLabel);
      const canonicalUrl = `${req.protocol}://${req.get("host")}/pitchmirror/r/${token}`;

      // Locate the HTML template
      const isDev = process.env.NODE_ENV === "development";
      const htmlPath = isDev
        ? path.resolve(process.cwd(), "client", "index.html")
        : path.resolve(import.meta.dirname, "public", "index.html");

      if (!fs.existsSync(htmlPath)) {
        return next();
      }

      let html = await fs.promises.readFile(htmlPath, "utf-8");
      html = injectOgMetaTags(html, title, description, canonicalUrl);

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      console.error("[PitchMirrorMeta] Error injecting meta tags:", err);
      next();
    }
  });
}
