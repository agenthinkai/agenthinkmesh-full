// server/lib/newsFeed.ts
//
// Lightweight news/disclosure fetcher for GCC Equities Council.
// Returns at most N items per source, normalised to a common shape.
// 5-minute in-memory cache per ticker.

interface NewsItem {
  source:   string;
  ts:       string;
  headline: string;
  url?:     string;
  ticker?:  string;
}

const cache = new Map<string, { fetchedAt: number; items: NewsItem[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchWithTimeout(url: string, ms = 4000): Promise<Response | null> {
  const ctl   = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { signal: ctl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Boursa Kuwait — confirmed public endpoint (Patch 17, 2026-05-04)
// Returns the full day's disclosures for ALL companies; we filter client-side.
// ---------------------------------------------------------------------------

// Map our internal symbols to Boursa Kuwait's DisplayTicker codes.
// Add entries as you confirm them on the live feed. Unmapped symbols fall back
// to the symbol itself (case-insensitive).
const SYMBOL_TO_DISPLAY_TICKER: Record<string, string> = {
  KFH:        "KFIN",
  NBK:        "NBKK",
  ZAIN:       "ZAIN",
  WARBABANK:  "WARBA",
  GBK:        "GBK",
  MABANEE:    "MABANEE",
  NIND:       "NIND",
  ABK:        "ABK",
  ALTIJARIA:  "TIJARA",
  BOURSA:     "BURS",
  BOUBYAN:    "BOUBYAN",
  MUNTAZAHAT: "MUNTAZAHAT",
  // Verify these against actual feed data — DisplayTicker values are sometimes
  // 3–4 letter codes that don't match our symbol. If a known-disclosed name
  // returns empty, log the raw feed and update this map.
};

interface BoursaItem {
  Title?:          string;
  DisplayTicker?:  string;
  Stk?:            string;
  Url?:            string;
  NewsId?:         string;
  PostedDate?:     string;
  EventStartDate?: string;
  TitleTypeDesc?:  string;
  FalseNews?:      number;
}

// Parse Boursa's compact timestamp format: "20260504082704" → "2026-05-04T08:27:04Z"
function parseBoursaTimestamp(ts?: string): string {
  if (!ts || ts.length < 8) return new Date().toISOString();
  const y  = ts.slice(0, 4);
  const mo = ts.slice(4, 6);
  const d  = ts.slice(6, 8);
  const h  = ts.length >= 10 ? ts.slice(8, 10)  : "00";
  const mi = ts.length >= 12 ? ts.slice(10, 12) : "00";
  const s  = ts.length >= 14 ? ts.slice(12, 14) : "00";
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

async function fetchBoursaDisclosures(ticker: string): Promise<NewsItem[]> {
  // Fetch the entire day's feed (all companies) — no per-symbol filter exists.
  const url =
    `https://www.boursakuwait.com.kw/data-api/client-services` +
    `?RT=3515&AT=0&L=E`;

  const res = await fetchWithTimeout(url, 5000);
  if (!res || !res.ok) return [];

  let feed: BoursaItem[] = [];
  try {
    feed = await res.json();
  } catch {
    return [];
  }

  if (!Array.isArray(feed)) return [];

  // Translate our symbol to Boursa's DisplayTicker.
  const targetDisplay = (
    SYMBOL_TO_DISPLAY_TICKER[ticker.toUpperCase()] ?? ticker
  ).toUpperCase();

  const matches = feed.filter(
    (it) =>
      it &&
      // Filter on DisplayTicker (case-insensitive)
      (it.DisplayTicker ?? "").toUpperCase() === targetDisplay &&
      // Skip items flagged as false news
      it.FalseNews !== 1,
  );

  return matches.slice(0, 5).map((it) => ({
    source:   "Boursa Kuwait",
    ts:       parseBoursaTimestamp(it.PostedDate ?? it.EventStartDate),
    headline: [it.TitleTypeDesc, it.Title].filter(Boolean).join(" — ") ||
              "(no headline)",
    url:      it.Url,
    ticker,
  }));
}

// KUNA wire — returns HTML, not JSON; stub until HTML parsing is added.
async function fetchKunaWire(ticker: string): Promise<NewsItem[]> {
  const url =
    `https://www.kuna.net.kw/Search.aspx?language=en` +
    `&searchtext=${encodeURIComponent(ticker)}`;

  const res = await fetchWithTimeout(url, 4000);
  if (!res || !res.ok) return [];

  // HTML response — return a placeholder until a proper parser is added.
  return [
    {
      source:   "KUNA",
      ts:       new Date().toISOString(),
      headline: "(KUNA HTML feed connected; HTML parsing pending — TODO)",
      ticker,
    },
  ];
}

export async function fetchDisclosures(ticker: string): Promise<NewsItem[]> {
  const cacheKey = ticker.toUpperCase();
  const hit      = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.items;

  const [boursa, kuna] = await Promise.all([
    fetchBoursaDisclosures(ticker),
    fetchKunaWire(ticker),
  ]);

  const items = [...boursa, ...kuna].sort((a, b) => b.ts.localeCompare(a.ts));
  cache.set(cacheKey, { fetchedAt: Date.now(), items });
  return items;
}

export function formatDisclosuresForEvidence(items: NewsItem[]): string {
  if (items.length === 0) {
    return "DISCLOSURES (last 24h): no items returned by feeds.";
  }
  const lines = ["DISCLOSURES (last 24h):"];
  for (const it of items.slice(0, 8)) {
    lines.push(`  [${it.source}] ${it.ts}  ${it.headline}`);
  }
  return lines.join("\n");
}
