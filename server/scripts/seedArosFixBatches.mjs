/**
 * seedArosFixBatches.mjs
 * Seeds the 2 fix batches (Infrastructure Investors + Asset Managers) to reach 1,000 total.
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config();

const DATA_FILE = '/home/ubuntu/aros_fix_batches.json';

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('Connected to database.');

  const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  const batches = raw.results;

  let totalParsed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const batch of batches) {
    if (batch.error) {
      console.warn(`Batch error: ${batch.error}`);
      continue;
    }

    let companies;
    try {
      let jsonStr = batch.output.companies_json;
      // Strip markdown fences
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      // Find the first [ and last ]
      const start = jsonStr.indexOf('[');
      const end = jsonStr.lastIndexOf(']');
      if (start === -1 || end === -1) throw new Error('No JSON array found');
      jsonStr = jsonStr.slice(start, end + 1);
      companies = JSON.parse(jsonStr);
    } catch (e) {
      console.warn(`Failed to parse batch ${batch.output?.batch_id}: ${e.message}`);
      totalErrors++;
      continue;
    }

    if (!Array.isArray(companies)) {
      console.warn(`Batch ${batch.output?.batch_id} did not return an array.`);
      continue;
    }

    totalParsed += companies.length;
    console.log(`Batch ${batch.output?.batch_id}: ${companies.length} companies parsed.`);

    for (const co of companies) {
      try {
        const name = (co.company_name || co.companyName || '').trim();
        const country = (co.country || '').trim();
        if (!name || !country) { totalSkipped++; continue; }

        // Dedup check
        const [existing] = await db.execute(
          'SELECT id FROM aros_companies WHERE company_name = ? AND country = ? LIMIT 1',
          [name, country]
        );
        if (existing.length > 0) { totalSkipped++; continue; }

        const sector = co.sector || 'Asset Managers';
        const opportunityScore = Math.min(100, Math.max(0, Number(co.opportunity_score ?? 70)));
        const agenthinkFitScore = Math.min(100, Math.max(0, Number(co.agenthink_fit_score ?? 65)));
        const decisionComplexityScore = Math.min(100, Math.max(0, Number(co.decision_complexity_score ?? 60)));
        const aiSignal = co.ai_transformation_signal ?? 'MEDIUM';
        const opportunityType = co.opportunity_type ?? 'AI_TRANSFORMATION';
        // Truncate key_decision_domain to 50 chars
        const keyDecisionDomain = (co.key_decision_domain ?? 'AI Transformation').slice(0, 50);
        const activeStrategicInitiative = (co.active_strategic_initiative ?? '').slice(0, 200);
        const decisionTwin = JSON.stringify({
          summary: (co.decision_twin_summary ?? '').slice(0, 200),
          executiveBrief: (co.executive_brief ?? '').slice(0, 150),
          primaryObjective: keyDecisionDomain,
          aiReadiness: aiSignal,
          agenthinkFitScore,
          opportunityType,
        });

        const [result] = await db.execute(
          `INSERT INTO aros_companies 
            (company_name, sector, country, hq_city, revenue_usd_bn, employees, ceo_name,
             key_decision_domain, active_strategic_initiative, ai_transformation_signal,
             opportunity_type, opportunity_score, agenthink_fit_score, decision_complexity_score,
             decision_twin, executive_dossier, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name, sector, country,
            co.hq_city ?? null,
            co.revenue_usd_bn ?? null,
            co.employees ?? null,
            co.ceo_name ?? null,
            keyDecisionDomain,
            activeStrategicInitiative,
            aiSignal,
            opportunityType,
            opportunityScore,
            agenthinkFitScore,
            decisionComplexityScore,
            decisionTwin,
            JSON.stringify({ source: 'aros_fix_batch', generatedAt: Date.now() }),
            Date.now(),
            Date.now(),
          ]
        );

        const companyId = result.insertId;
        const tier = opportunityScore >= 90 ? 'HIGH_PRIORITY' : opportunityScore >= 75 ? 'ACTIVE' : 'UNIVERSE';
        const freqDays = tier === 'HIGH_PRIORITY' ? 1 : tier === 'ACTIVE' ? 7 : 30;

        await db.execute(
          `INSERT INTO aros_monitoring_jobs 
            (company_id, funnel_tier, monitoring_frequency_days, next_monitor_at, last_monitored_at, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
          [companyId, tier, freqDays, Date.now() + freqDays * 86400000, Date.now(), Date.now(), Date.now()]
        );

        await db.execute(
          `INSERT INTO aros_pipeline 
            (company_id, stage, researched_at, deal_value_usd, notes, created_at, updated_at)
           VALUES (?, 'RESEARCHED', ?, ?, ?, ?, ?)`,
          [companyId, Date.now(), Math.round(opportunityScore * 2000),
           `T=0 fix batch. Score: ${opportunityScore}. Signal: ${aiSignal}`, Date.now(), Date.now()]
        );

        const verdict = opportunityScore >= 90 ? 'STRONG_BUY' : opportunityScore >= 75 ? 'BUY' : opportunityScore >= 60 ? 'HOLD' : 'PASS';
        const confidence = aiSignal === 'IMMEDIATE' ? 0.90 : aiSignal === 'HIGH' ? 0.75 : 0.60;
        await db.execute(
          `INSERT INTO outcome_sessions 
            (deal_id, council_run_id, council_mode, original_verdict, consensus_score, confidence_level,
             decision_date, outcome_status, outcome_notes, created_at, updated_at, primary_driver, source_confidence, source_type)
           VALUES (?, ?, 'AROS_DISCOVERY', ?, ?, ?, ?, 'UNKNOWN', ?, ?, ?, 'TECHNOLOGY', ?, 'MANUAL')`,
          [
            `aros-${companyId}`, `t0-fix-${companyId}`,
            verdict, opportunityScore / 100.0, confidence, Date.now(),
            `T=0 baseline. ${name} | ${sector} | ${country} | Score: ${opportunityScore}`,
            Date.now(), Date.now(),
            opportunityScore >= 85 ? 'HIGH' : opportunityScore >= 70 ? 'MEDIUM' : 'LOW',
          ]
        );

        totalInserted++;
      } catch (e) {
        console.warn(`Error inserting ${co.company_name ?? '?'}: ${e.message}`);
        totalErrors++;
      }
    }
  }

  await db.end();

  console.log('\n=== FIX SEED COMPLETE ===');
  console.log(`Parsed:   ${totalParsed}`);
  console.log(`Inserted: ${totalInserted}`);
  console.log(`Skipped:  ${totalSkipped}`);
  console.log(`Errors:   ${totalErrors}`);

  const db2 = await mysql.createConnection(process.env.DATABASE_URL);
  const [[{ total }]] = await db2.execute('SELECT COUNT(*) as total FROM aros_companies');
  const [[{ pipeline }]] = await db2.execute('SELECT COUNT(*) as pipeline FROM aros_pipeline');
  const [[{ outcomes }]] = await db2.execute("SELECT COUNT(*) as outcomes FROM outcome_sessions WHERE council_mode = 'AROS_DISCOVERY'");
  await db2.end();

  console.log('\n=== FINAL DATABASE STATE ===');
  console.log(`aros_companies:   ${total}`);
  console.log(`aros_pipeline:    ${pipeline}`);
  console.log(`outcome_sessions: ${outcomes}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
