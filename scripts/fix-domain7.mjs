import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);
const data = JSON.parse(readFileSync('/home/ubuntu/agenthinkmesh-full/synthetic-data/domain7_social_media.json', 'utf-8'));
const allIds = data.map(s => s.scenario_id);

const [existing] = await db.execute('SELECT scenarioId FROM knowledge_scenarios WHERE domain = "social_media"');
const existingIds = new Set(existing.map(r => r.scenarioId));

const missing = allIds.filter(id => existingIds.has(id) === false);
console.log(`Missing ${missing.length} IDs:`, missing.join(', '));

let inserted = 0;
for (const scenario of data) {
  if (missing.indexOf(scenario.scenario_id) === -1) continue;
  const title = scenario.brand_name || scenario.company_name || scenario.client_name || scenario.scenario_id;
  const geography = scenario.market || scenario.geography || 'GCC';
  const sector = Array.isArray(scenario.platform_mix) ? scenario.platform_mix.join(', ') : (scenario.sector || '');
  const tags = ['social_media', geography, sector].filter(Boolean).join(',');
  const summary = scenario.recommended_action
    ? `Brand: ${title}. Market: ${geography}. Action: ${scenario.recommended_action.substring(0, 120)}`
    : `Scenario ${scenario.scenario_id}`;
  try {
    await db.execute(
      'INSERT INTO knowledge_scenarios (scenarioId, domain, title, summary, content, geography, sector, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [scenario.scenario_id, 'social_media', title, summary, JSON.stringify(scenario), geography, sector, tags]
    );
    inserted++;
    console.log(`  ✓ Inserted ${scenario.scenario_id}`);
  } catch(e) {
    console.log(`  ✗ Error on ${scenario.scenario_id}:`, e.message);
  }
}
console.log(`\nInserted: ${inserted}`);

const [count] = await db.execute('SELECT COUNT(*) as cnt FROM knowledge_scenarios WHERE domain = "social_media"');
console.log(`Social media total: ${count[0].cnt}`);

const [grand] = await db.execute('SELECT COUNT(*) as cnt FROM knowledge_scenarios');
console.log(`Grand total: ${grand[0].cnt}`);

await db.end();
