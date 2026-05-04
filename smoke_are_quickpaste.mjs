// smoke_are_quickpaste.mjs
// Tests the Quick Paste extraction endpoint + council run pipeline
// Run: node_modules/.bin/tsx /home/ubuntu/smoke_are_quickpaste.mjs

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const BASE = "http://localhost:3000";

const client = createTRPCClient({
  links: [
    httpBatchLink({
      url: `${BASE}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

// ── Test 1: Ready property paste ──────────────────────────────────────────────
const READY_PASTE = `
Emaar Beachfront — Sunrise Bay Tower 2, 2-bedroom apartment, 1,200 sqft.
Asking price AED 3,200,000. Ready unit, motivated seller, vacant for 3 months.
Annual rent potential AED 180,000. DLD comp PPSF: AED 2,400.
Service charge AED 18 per sqft per year. Sea-facing, high floor.
Developer: Emaar. Location: Dubai Marina / Emaar Beachfront.
`.trim();

// ── Test 2: Off-plan property paste ──────────────────────────────────────────
const OFFPLAN_PASTE = `
DAMAC Lagoons — Marbella Phase 3, 3BR villa, 2,100 sqft.
Launch price AED 2,850,000. Off-plan project by DAMAC Properties.
Payment plan: 60% during construction, 40% on handover Q3 2026.
Construction progress: 25%. RERA escrow account confirmed.
Expected completion December 2026. Dubai, Dubailand area.
`.trim();

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

// ── Run extraction tests ──────────────────────────────────────────────────────
console.log("\n=== Quick Paste Smoke Test ===\n");

// Test 1: Ready property extraction
console.log("--- Test 1: Ready property extraction ---");
let ex1;
try {
  ex1 = await client.uaeRealestate.extractPropertyDetails.mutate({ text: READY_PASTE });
  console.log("  Extraction result:", JSON.stringify(ex1, null, 2));
} catch (err) {
  console.error("  EXTRACTION FAILED:", err.message);
  process.exit(1);
}

check("community extracted",          ex1.community != null,                       ex1.community);
check("developer extracted",          ex1.developer != null,                       ex1.developer);
check("askingPriceAED extracted",     ex1.askingPriceAED != null && ex1.askingPriceAED > 0, ex1.askingPriceAED);
check("areaSqft extracted",           ex1.areaSqft != null && ex1.areaSqft > 0,   ex1.areaSqft);
check("annualRentAED extracted",      ex1.annualRentAED != null,                   ex1.annualRentAED);
check("offPlanDetected = false",      ex1.offPlanDetected === false,               ex1.offPlanDetected);
check("missingCritical is array",     Array.isArray(ex1.missingCritical),          ex1.missingCritical);
check("confidencePenalty 0-0.4",      ex1.confidencePenalty >= 0 && ex1.confidencePenalty <= 0.4, ex1.confidencePenalty);

// Test 2: Off-plan property extraction
console.log("\n--- Test 2: Off-plan property extraction ---");
let ex2;
try {
  ex2 = await client.uaeRealestate.extractPropertyDetails.mutate({ text: OFFPLAN_PASTE });
  console.log("  Extraction result:", JSON.stringify(ex2, null, 2));
} catch (err) {
  console.error("  EXTRACTION FAILED:", err.message);
  process.exit(1);
}

check("offPlanDetected = true",       ex2.offPlanDetected === true,                ex2.offPlanDetected);
check("propertyType = off_plan",      ex2.propertyType === "off_plan",             ex2.propertyType);
check("developer extracted",          ex2.developer != null,                       ex2.developer);
check("completionDate extracted",     ex2.completionDate != null,                  ex2.completionDate);
check("paymentPlan extracted",        ex2.paymentPlan != null,                     ex2.paymentPlan);
check("constructionProgress 0-100",   ex2.constructionProgress != null && ex2.constructionProgress >= 0 && ex2.constructionProgress <= 100, ex2.constructionProgress);
check("escrowVerified = true",        ex2.escrowVerified === true,                 ex2.escrowVerified);

// Test 3: Council run from extracted ready property
console.log("\n--- Test 3: Council run from extracted ready property ---");
if (ex1.askingPriceAED && ex1.areaSqft) {
  let councilResult;
  try {
    councilResult = await client.uaeRealestate.run.mutate({
      propertyType:    ex1.propertyType ?? "ready",
      assetClass:      ex1.assetClass ?? "apartment",
      emirate:         ex1.emirate ?? "dubai",
      community:       ex1.community ?? "Emaar Beachfront",
      developer:       ex1.developer ?? "Emaar",
      tower:           ex1.tower ?? undefined,
      askingPriceAED:  ex1.askingPriceAED,
      areaSqft:        ex1.areaSqft,
      ppsfAsking:      Math.round(ex1.askingPriceAED / ex1.areaSqft),
      ppsfComps:       ex1.ppsfComps ?? undefined,
      annualRentAED:   ex1.annualRentAED ?? undefined,
      serviceChargePerSqft: ex1.serviceChargePerSqft ?? undefined,
      notes:           ex1.notes ?? undefined,
    });
  } catch (err) {
    console.error("  COUNCIL RUN FAILED:", err.message);
    process.exit(1);
  }

  check("decision is valid",          ["BUY","WAIT","NEGOTIATE","AVOID"].includes(councilResult.decision), councilResult.decision);
  check("confidenceScore 0-1",        councilResult.confidenceScore >= 0 && councilResult.confidenceScore <= 1, councilResult.confidenceScore);
  check("agents array non-empty",     councilResult.agents.length > 0,            councilResult.agents.length);
  check("entryRange present",         councilResult.entryRange != null,            councilResult.entryRange);
  check("investmentThesis present",   councilResult.investmentThesis?.length > 0,  councilResult.investmentThesis?.slice(0,50));
  check("no offPlanRisk on ready",    councilResult.offPlanRisk == null,           councilResult.offPlanRisk);
  check("silentFails = 0",            councilResult.silentFails.length === 0,      councilResult.silentFails);

  console.log(`\n  Council decision: ${councilResult.decision} (${(councilResult.confidenceScore*100).toFixed(0)}% confidence)`);
  console.log(`  Duration: ${(councilResult.durationMs/1000).toFixed(1)}s`);
  console.log(`  Votes: ${councilResult.buyCount} BUY · ${councilResult.negotiateCount} NEG · ${councilResult.waitCount} WAIT · ${councilResult.avoidCount} AVOID`);
} else {
  console.log("  SKIPPED — extraction missing price/area");
  failed++;
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
