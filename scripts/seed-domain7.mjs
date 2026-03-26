import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

async function seedFile(filePath, domain) {
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  console.log(`Seeding ${data.length} scenarios from ${filePath}`);
  let inserted = 0, skipped = 0;
  for (const scenario of data) {
    const id = scenario.scenario_id;
    const title = scenario.brand_name || scenario.company_name || scenario.client_name || id;
    const geography = scenario.market || scenario.geography || 'GCC';
    const sector = scenario.platform_mix ? scenario.platform_mix.join(', ') : (scenario.sector || '');
    const tags = [domain, geography, sector].filter(Boolean).join(',');
    const summary = scenario.recommended_action
      ? `Brand: ${title}. Market: ${geography}. Action: ${scenario.recommended_action.substring(0, 120)}...`
      : `Scenario ${id} in ${domain}`;
    try {
      await db.execute(
        `INSERT IGNORE INTO knowledge_scenarios (id, scenarioId, domain, title, summary, content, geography, sector, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, domain, title, summary, JSON.stringify(scenario), geography, sector, tags]
      );
      inserted++;
    } catch (e) {
      skipped++;
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, Skipped: ${skipped}`);
}

await seedFile('/home/ubuntu/agenthinkmesh-full/synthetic-data/domain7_social_media.json', 'social_media');

const [rows] = await db.execute('SELECT domain, COUNT(*) as cnt FROM knowledge_scenarios GROUP BY domain ORDER BY domain');
let total = 0;
for (const r of rows) {
  console.log(`  ${r.domain}: ${r.cnt}`);
  total += Number(r.cnt);
}
console.log(`  TOTAL: ${total}`);

await db.end();
