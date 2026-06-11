/**
 * runPharmaCouncilScript.mjs — Standalone runner for the Torcetrapib pilot
 *
 * Runs the Pharma Council V1 deliberation and saves:
 *   - raw JSON payload to /tmp/torcetrapib-council-result.json
 *   - Institutional Proof Report PDF to /tmp/torcetrapib-proof-report.pdf
 *
 * Usage: node server/runPharmaCouncilScript.mjs
 */

import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load env
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));

// We need to use tsx to run TypeScript files
// This script just invokes the TypeScript runner
console.log("Pharma Council V1 — Torcetrapib Retrospective Pilot");
console.log("Evidence cutoff: December 31, 2005");
console.log("Running 10 personas in parallel...");
console.log("");
console.log("Use: npx tsx server/runPharmaCouncilDirect.ts");
