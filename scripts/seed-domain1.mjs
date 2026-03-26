import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;

async function seedFile(conn, filePath, domain) {
  const raw = readFileSync(filePath, "utf-8");
  const jsonStart = raw.indexOf("[");
  const scenarios = JSON.parse(raw.slice(jsonStart));
  console.log(`Seeding ${scenarios.length} scenarios from ${filePath}`);
  let inserted = 0, skipped = 0;
  for (const s of scenarios) {
    const scenarioId = s.scenario_id;
    if (!scenarioId) { skipped++; continue; }
    const title = s.company_name || s.mvno_name || s.brand_name || scenarioId;
    const geo = s.geography || s.market || "GCC";
    const sector = s.sector || domain;
    const rev = s.key_financials?.revenue_kwd || s.key_financials?.revenue_sar || s.key_financials?.revenue_aed;
    const summary = [
      s.deal_type ? `Type: ${s.deal_type}` : null,
      s.sector ? `Sector: ${s.sector}` : null,
      rev ? `Revenue: ${rev.toLocaleString()}` : null,
      s.ic_recommendation ? `IC: ${s.ic_recommendation}` : null,
    ].filter(Boolean).join(". ");
    const tags = [s.deal_type, s.sector, geo, s.ic_recommendation].filter(Boolean).join(",");
    const content = JSON.stringify(s);
    try {
      await conn.execute(
        `INSERT IGNORE INTO knowledge_scenarios (scenarioId, domain, title, summary, content, geography, sector, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [scenarioId, domain, title, summary || "", content, geo, sector, tags]
      );
      inserted++;
    } catch (e) {
      console.error(`  Error ${scenarioId}: ${e.message}`);
      skipped++;
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, Skipped: ${skipped}`);
  return inserted;
}

async function main() {
  const conn = await createConnection(DATABASE_URL);
  const synDir = join(__dirname, "../synthetic-data");
  
  // Seed all available domain1 parts
  const files = [
    ["domain1_partA.json", "deal_screening"],
    ["domain1_partB.json", "deal_screening"],
    ["domain1_partC.json", "deal_screening"],
    ["domain1_partD.json", "deal_screening"],
    ["domain1_partE.json", "deal_screening"],
    ["domain2_partA.json", "wealth_management"],
    ["domain2_partB.json", "wealth_management"],
    ["domain2_partC.json", "wealth_management"],
    ["domain2_partD.json", "wealth_management"],
    ["domain2_partE.json", "wealth_management"],
  ];
  
  let total = 0;
  for (const [file, domain] of files) {
    const fp = join(synDir, file);
    try {
      readFileSync(fp); // check exists
      total += await seedFile(conn, fp, domain);
    } catch (e) {
      if (e.code === "ENOENT") {
        console.log(`Skipping ${file} (not yet received)`);
      } else {
        console.error(`Error with ${file}: ${e.message}`);
      }
    }
  }
  
  // Final count
  const [rows] = await conn.execute("SELECT domain, COUNT(*) as count FROM knowledge_scenarios GROUP BY domain ORDER BY domain");
  console.log("\n═══ Knowledge Vault Status ═══");
  let grandTotal = 0;
  for (const row of rows) {
    console.log(`  ${row.domain}: ${row.count}`);
    grandTotal += Number(row.count);
  }
  console.log(`  TOTAL: ${grandTotal}`);
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
