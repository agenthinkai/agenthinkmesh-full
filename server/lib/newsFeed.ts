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

// Boursa Kuwait disclosure portal — best-effort URL; update if portal changes.
async function fetchBoursaDisclosures(ticker: string): Promise<NewsItem[]> {
  const url =
    `https://www.boursakuwait.com.kw/api/disclosures` +
    `?symbol=${encodeURIComponent(ticker)}&lang=en&limit=10`;

  const res = await fetchWithTimeout(url, 4000);
  if (!res || !res.ok) return [];

  try {
    const data  = await res.json();
    const items = data.items ?? data.disclosures ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (items as any[]).slice(0, 5).map((x) => ({
      source:   "Boursa Kuwait",
      ts:       x.publishedAt ?? x.timestamp ?? new Date().toISOString(),
      headline: x.title ?? x.headline ?? "(no headline)",
      url:      x.url,
      ticker,
    }));
  } catch {
    return [];
  }
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
