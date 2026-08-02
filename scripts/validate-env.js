#!/usr/bin/env node
/**
 * Mesh Enterprise Platform — Environment Validation Script
 * Enterprise Certification Sprint — CR-2
 *
 * Validates all required environment variables are set before startup.
 * Exits with code 1 if any required variable is missing.
 * Run automatically by start-onprem.sh before starting the server.
 */

const REQUIRED = [
  { key: "DATABASE_URL",           desc: "MySQL connection string" },
  { key: "JWT_SECRET",             desc: "Session cookie signing secret (min 32 chars)" },
  { key: "VITE_APP_ID",            desc: "Manus OAuth application ID" },
  { key: "OAUTH_SERVER_URL",       desc: "Manus OAuth backend base URL" },
  { key: "VITE_OAUTH_PORTAL_URL",  desc: "Manus login portal URL" },
  { key: "BUILT_IN_FORGE_API_URL", desc: "Manus built-in API base URL" },
  { key: "BUILT_IN_FORGE_API_KEY", desc: "Manus built-in API bearer token (server-side)" },
  { key: "DATA_ENCRYPTION_KEY",    desc: "AES-256 data encryption key (hex, 64 chars)" },
  { key: "ENCRYPTION_MASTER_KEY",  desc: "Master key for key rotation envelope" },
  { key: "OWNER_OPEN_ID",          desc: "Platform owner OpenID" },
  { key: "OWNER_NAME",             desc: "Platform owner display name" },
];

const OPTIONAL_WARN = [
  { key: "RESEND_API_KEY",         desc: "Email delivery (notifications disabled without this)" },
  { key: "NEWS_API_KEY",           desc: "News feed connector (disabled without this)" },
  { key: "S3_BUCKET",              desc: "File storage (local fallback used without this)" },
];

let errors = 0;
let warnings = 0;

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║   Mesh Enterprise Platform — Environment Validation      ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

// Check required variables
for (const { key, desc } of REQUIRED) {
  const val = process.env[key];
  if (!val || val.trim() === "" || val.includes("CHANGE_ME")) {
    console.error(`  ✗ MISSING  ${key.padEnd(30)} ${desc}`);
    errors++;
  } else {
    const masked = val.length > 8 ? val.slice(0, 4) + "****" + val.slice(-4) : "****";
    console.log(`  ✓ OK       ${key.padEnd(30)} ${masked}`);
  }
}

// Validate JWT_SECRET length
const jwtSecret = process.env.JWT_SECRET;
if (jwtSecret && jwtSecret.length < 32) {
  console.error(`  ✗ WEAK     JWT_SECRET must be at least 32 characters (got ${jwtSecret.length})`);
  errors++;
}

// Validate encryption key format
const dataKey = process.env.DATA_ENCRYPTION_KEY;
if (dataKey && !/^[0-9a-fA-F]{64}$/.test(dataKey)) {
  console.error(`  ✗ INVALID  DATA_ENCRYPTION_KEY must be 64 hex characters`);
  errors++;
}

console.log("");

// Check optional variables
for (const { key, desc } of OPTIONAL_WARN) {
  const val = process.env[key];
  if (!val || val.trim() === "" || val.includes("CHANGE_ME")) {
    console.warn(`  ⚠ MISSING  ${key.padEnd(30)} ${desc}`);
    warnings++;
  }
}

console.log("");
console.log(`Validation complete: ${errors} error(s), ${warnings} warning(s)`);

if (errors > 0) {
  console.error("\n✗ Environment validation FAILED. Fix the errors above before starting the platform.\n");
  process.exit(1);
} else {
  console.log("\n✓ Environment validation PASSED. Starting Mesh Enterprise Platform...\n");
  process.exit(0);
}
