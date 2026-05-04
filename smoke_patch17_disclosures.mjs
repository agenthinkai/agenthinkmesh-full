// smoke_patch17_disclosures.mjs
// Verifies Patch 17: real Boursa Kuwait endpoint is wired and DISCLOSURES
// section reflects actual feed data.
//
// Run from project root: node_modules/.bin/tsx smoke_patch17_disclosures.mjs

import { SignJWT } from "/home/ubuntu/agenthinkmesh-full/node_modules/.pnpm/jose@6.1.0/node_modules/jose/dist/webapi/index.js";
import { readFileSync } from "fs";

// ── Auth ──────────────────────────────────────────────────────────────────────
const envFile = "/home/ubuntu/agenthinkmesh-full/.env";
const envVars = {};
try {
  const lines = readFileSync(envFile, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) envVars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const JWT_SECRET   = envVars.JWT_SECRET   || process.env.JWT_SECRET;
const VITE_APP_ID  = envVars.VITE_APP_ID  || process.env.VITE_APP_ID;
const OWNER_OPEN_ID = envVars.OWNER_OPEN_ID || process.env.OWNER_OPEN_ID;
const OWNER_NAME   = envVars.OWNER_NAME   || process.env.OWNER_NAME || "SmokeTest";

if (!JWT_SECRET || !VITE_APP_ID || !OWNER_OPEN_ID) {
  console.error("Missing JWT_SECRET, VITE_APP_ID, or OWNER_OPEN_ID");
  process.exit(1);
}

const secretKey = new TextEncoder().encode(JWT_SECRET);
const token = await new SignJWT({ openId: OWNER_OPEN_ID, appId: VITE_APP_ID, name: OWNER_NAME })
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setExpirationTime(Math.floor((Date.now() + 365 * 24 * 3600 * 1000) / 1000))
  .sign(secretKey);

const DEV_URL     = "http://localhost:3000";
const COOKIE_NAME = "app_session_id";

async function runCouncil(ticker, sideHint = "BUY") {
  const payload = {
    "0": {
      json: {
        dealName: `Patch17 · ${ticker}`,
        dealText: `Trading signal review — FRIDAY_GAP on ${ticker} (${sideHint}). Patch 17 disclosure test.`,
        councilMode: "gcc_equities",
        signalPayload: {
          strategy: "FRIDAY_GAP",
          symbol: ticker,
          sideHint,
          constituentQuotes: [
            { symbol: ticker, last: 0.500 },
          ],
          kwtThursdayClose: 36.10,
          kwtFridayClose:   36.55,
          thresholdBps: 15,
        },
      },
    },
  };

  const start = Date.now();
  const res = await fetch(`${DEV_URL}/api/trpc/dealScreener.screen?batch=1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `${COOKIE_NAME}=${token}`,
      "Origin": DEV_URL,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const result = data[0]?.result?.data?.json ?? data[0]?.result?.data;
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function check(label, condition, actual) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — got: ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log("\n=== Patch 17 — Boursa Kuwait Disclosure Smoke Test ===\n");
console.log("Session JWT created for owner:", OWNER_OPEN_ID);

// ── Test 1: KFH — endpoint reachable, no crash, DISCLOSURES section present ──
console.log("\n--- Test 1: KFH (maps to KFIN) — no disclosure expected today ---");
let kfhRun;
try {
  kfhRun = await runCouncil("KFH", "BUY");
  console.log(`  Duration: ${(kfhRun.durationMs / 1000).toFixed(1)}s`);
} catch (err) {
  console.error("  COUNCIL RUN FAILED:", err.message);
  process.exit(1);
}

const kfh = kfhRun.result;
check("result returned",                   kfh != null,                                   kfh);
check("verdict present",                   kfh?.verdict != null,                          kfh?.verdict);
check("evidenceBlob present",              kfh?.evidenceBlob != null,                     null);
check("evidenceBlob has DISCLOSURES",      kfh?.evidenceBlob?.includes("DISCLOSURES"),    null);

const kfhDiscLines = (kfh?.evidenceBlob ?? "")
  .split("\n")
  .filter(l => l.includes("DISCLOSURES") || l.includes("Boursa Kuwait") || l.includes("no items"));
console.log(`  KFH DISCLOSURES lines:\n    ${kfhDiscLines.join("\n    ") || "(none found)"}`);

// ── Test 2: MUNTAZAHAT — confirmed corporate action today ─────────────────────
console.log("\n--- Test 2: MUNTAZAHAT — expect Corporate Action Confirmation ---");
let muntRun;
try {
  muntRun = await runCouncil("MUNTAZAHAT", "BUY");
  console.log(`  Duration: ${(muntRun.durationMs / 1000).toFixed(1)}s`);
} catch (err) {
  console.error("  COUNCIL RUN FAILED:", err.message);
  process.exit(1);
}

const munt = muntRun.result;
check("result returned",                   munt != null,                                  munt);
check("verdict present",                   munt?.verdict != null,                         munt?.verdict);
check("evidenceBlob present",              munt?.evidenceBlob != null,                    null);
check("evidenceBlob has DISCLOSURES",      munt?.evidenceBlob?.includes("DISCLOSURES"),   null);

const hasBoursa          = munt?.evidenceBlob?.includes("Boursa Kuwait");
const hasCorporateAction = munt?.evidenceBlob?.toLowerCase().includes("corporate action") ||
                           munt?.evidenceBlob?.toLowerCase().includes("timetable");

check("Boursa Kuwait item in evidenceBlob",     hasBoursa,          hasBoursa);
check("Corporate Action headline in evidence",  hasCorporateAction, hasCorporateAction);

const muntDiscLines = (munt?.evidenceBlob ?? "")
  .split("\n")
  .filter(l =>
    l.includes("DISCLOSURES") ||
    l.includes("Boursa Kuwait") ||
    l.includes("no items") ||
    l.toLowerCase().includes("corporate") ||
    l.toLowerCase().includes("timetable"),
  );
console.log(`  MUNTAZAHAT DISCLOSURES lines:\n    ${muntDiscLines.join("\n    ") || "(none found)"}`);
console.log(`  MUNTAZAHAT verdict: ${munt?.verdict}`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
