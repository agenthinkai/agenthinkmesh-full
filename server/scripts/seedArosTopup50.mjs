/**
 * seedArosTopup50.mjs
 * Inserts 50 additional unique companies to bring total to 1,000.
 */

import mysql from 'mysql2/promise';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config();

const COMPANIES = [
  // Banks — additional unique entries
  { name: 'Handelsbanken', sector: 'Banks', country: 'Sweden', city: 'Stockholm', rev: 5.2, emp: 12000, ceo: 'Michael Green', domain: 'AI Transformation', initiative: 'AI-driven branch banking modernization', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 83 },
  { name: 'Swedbank', sector: 'Banks', country: 'Sweden', city: 'Stockholm', rev: 4.8, emp: 14000, ceo: 'Jens Henriksson', domain: 'Data Modernization', initiative: 'AI-powered fraud detection platform', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 85 },
  { name: 'SEB Group', sector: 'Banks', country: 'Sweden', city: 'Stockholm', rev: 5.5, emp: 16000, ceo: 'Johan Torgeby', domain: 'AI Transformation', initiative: 'AI-driven corporate banking advisory', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 89 },
  { name: 'Nordea Bank', sector: 'Banks', country: 'Finland', city: 'Helsinki', rev: 10.2, emp: 28000, ceo: 'Frank Vang-Jensen', domain: 'AI Transformation', initiative: 'AI-enhanced Nordic banking platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 91 },
  { name: 'DNB Bank', sector: 'Banks', country: 'Norway', city: 'Oslo', rev: 5.8, emp: 12000, ceo: 'Kjerstin Braathen', domain: 'AI Transformation', initiative: 'AI-driven digital banking transformation', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 90 },
  { name: 'Rabobank', sector: 'Banks', country: 'Netherlands', city: 'Utrecht', rev: 12.0, emp: 43000, ceo: 'Stefaan Decraene', domain: 'AI Transformation', initiative: 'AI-powered agri-food banking platform', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'ABN AMRO Bank', sector: 'Banks', country: 'Netherlands', city: 'Amsterdam', rev: 8.5, emp: 20000, ceo: 'Robert Swaak', domain: 'Data Modernization', initiative: 'AI-driven personal banking modernization', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 85 },
  { name: 'KBC Group', sector: 'Banks', country: 'Belgium', city: 'Brussels', rev: 8.2, emp: 42000, ceo: 'Johan Thijs', domain: 'AI Transformation', initiative: 'Kate AI assistant banking platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 92 },
  { name: 'ING Direct', sector: 'Banks', country: 'Netherlands', city: 'Amsterdam', rev: 18.0, emp: 57000, ceo: 'Steven van Rijswijk', domain: 'AI Transformation', initiative: 'AI-driven digital-first banking', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 93 },
  { name: 'Erste Group Bank', sector: 'Banks', country: 'Austria', city: 'Vienna', rev: 7.5, emp: 47000, ceo: 'Peter Bosek', domain: 'AI Transformation', initiative: 'George AI banking platform expansion', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 90 },
  { name: 'Raiffeisen Bank International', sector: 'Banks', country: 'Austria', city: 'Vienna', rev: 6.8, emp: 45000, ceo: 'Johann Strobl', domain: 'Data Modernization', initiative: 'AI-driven CEE banking modernization', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 84 },
  { name: 'UniCredit', sector: 'Banks', country: 'Italy', city: 'Milan', rev: 22.0, emp: 73000, ceo: 'Andrea Orcel', domain: 'AI Transformation', initiative: 'UniConnect AI banking transformation', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 93 },
  { name: 'Intesa Sanpaolo', sector: 'Banks', country: 'Italy', city: 'Turin', rev: 20.0, emp: 94000, ceo: 'Carlo Messina', domain: 'AI Transformation', initiative: 'AI-driven retail banking platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 91 },
  { name: 'Banco Santander', sector: 'Banks', country: 'Spain', city: 'Madrid', rev: 58.0, emp: 210000, ceo: 'Ana Botin', domain: 'AI Transformation', initiative: 'AI-powered global banking platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 96 },
  { name: 'BBVA', sector: 'Banks', country: 'Spain', city: 'Bilbao', rev: 24.0, emp: 111000, ceo: 'Carlos Torres Vila', domain: 'AI Transformation', initiative: 'AI-first banking transformation program', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 95 },
  // Telecom — additional unique entries
  { name: 'Proximus', sector: 'Telecom Operators', country: 'Belgium', city: 'Brussels', rev: 5.8, emp: 12000, ceo: 'Guillaume Boutin', domain: 'AI Transformation', initiative: 'AI-driven network and customer experience', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 83 },
  { name: 'Swisscom', sector: 'Telecom Operators', country: 'Switzerland', city: 'Bern', rev: 11.0, emp: 20000, ceo: 'Christoph Aeschlimann', domain: 'AI Transformation', initiative: 'AI-powered Swiss digital infrastructure', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 86 },
  { name: 'Sunrise Communications', sector: 'Telecom Operators', country: 'Switzerland', city: 'Zurich', rev: 3.2, emp: 3000, ceo: 'Andre Krause', domain: 'Data Modernization', initiative: 'AI-driven customer analytics platform', signal: 'MEDIUM', type: 'DATA_MODERNIZATION', score: 79 },
  { name: 'A1 Telekom Austria', sector: 'Telecom Operators', country: 'Austria', city: 'Vienna', rev: 4.8, emp: 18000, ceo: 'Thomas Arnoldner', domain: 'AI Transformation', initiative: 'AI-enhanced CEE telecom operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 84 },
  { name: 'Magyar Telekom', sector: 'Telecom Operators', country: 'Hungary', city: 'Budapest', rev: 1.8, emp: 8000, ceo: 'Christopher Mattheisen', domain: 'AI Transformation', initiative: 'AI-driven network modernization', signal: 'MEDIUM', type: 'AI_TRANSFORMATION', score: 78 },
  { name: 'Slovak Telekom', sector: 'Telecom Operators', country: 'Slovakia', city: 'Bratislava', rev: 0.8, emp: 3000, ceo: 'Drahomira Mandikova', domain: 'Data Modernization', initiative: 'AI-powered customer service automation', signal: 'MEDIUM', type: 'DATA_MODERNIZATION', score: 75 },
  { name: 'Telia Finland', sector: 'Telecom Operators', country: 'Finland', city: 'Helsinki', rev: 1.5, emp: 4000, ceo: 'Carin Kindbom', domain: 'AI Transformation', initiative: 'AI-driven 5G network optimization', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 82 },
  { name: 'Elisa Corporation', sector: 'Telecom Operators', country: 'Finland', city: 'Helsinki', rev: 2.0, emp: 5000, ceo: 'Veli-Matti Mattila', domain: 'AI Transformation', initiative: 'AI-powered digital services platform', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  { name: 'TDC Group', sector: 'Telecom Operators', country: 'Denmark', city: 'Copenhagen', rev: 2.5, emp: 7000, ceo: 'Henning Dyremose', domain: 'Data Modernization', initiative: 'AI-driven network and customer analytics', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 82 },
  { name: 'Telenor Norway', sector: 'Telecom Operators', country: 'Norway', city: 'Fornebu', rev: 3.2, emp: 5000, ceo: 'Sigve Brekke', domain: 'AI Transformation', initiative: 'AI-enhanced Nordic telecom operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 84 },
  // Asset Managers — additional unique entries
  { name: 'Schroders', sector: 'Asset Managers', country: 'United Kingdom', city: 'London', rev: 2.8, emp: 6000, ceo: 'Peter Harrison', domain: 'AI Transformation', initiative: 'AI-driven active management platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 91 },
  { name: 'M&G Investments', sector: 'Asset Managers', country: 'United Kingdom', city: 'London', rev: 2.2, emp: 5000, ceo: 'Andrea Rossi', domain: 'AI Transformation', initiative: 'AI-powered multi-asset investment platform', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'Invesco', sector: 'Asset Managers', country: 'United States', city: 'Atlanta', rev: 1.8, emp: 8000, ceo: 'Andrew Schlossberg', domain: 'AI Transformation', initiative: 'AI-driven ETF and factor investing', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 88 },
  { name: 'T. Rowe Price', sector: 'Asset Managers', country: 'United States', city: 'Baltimore', rev: 6.5, emp: 7500, ceo: 'Rob Sharps', domain: 'AI Transformation', initiative: 'AI-enhanced active equity research', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 92 },
  { name: 'Franklin Templeton', sector: 'Asset Managers', country: 'United States', city: 'San Mateo', rev: 8.0, emp: 9500, ceo: 'Jenny Johnson', domain: 'AI Transformation', initiative: 'AI-driven global investment platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 93 },
  { name: 'Nuveen', sector: 'Asset Managers', country: 'United States', city: 'Chicago', rev: 1.5, emp: 2500, ceo: 'Jose Minaya', domain: 'AI Transformation', initiative: 'AI-powered responsible investing platform', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  { name: 'Neuberger Berman', sector: 'Asset Managers', country: 'United States', city: 'New York', rev: 1.4, emp: 2500, ceo: 'George Walker', domain: 'AI Transformation', initiative: 'AI-driven private markets investment', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 86 },
  { name: 'Manulife Investment Management', sector: 'Asset Managers', country: 'Canada', city: 'Toronto', rev: 3.5, emp: 5000, ceo: 'Paul Lorentz', domain: 'AI Transformation', initiative: 'AI-enhanced global asset management', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'CI Financial', sector: 'Asset Managers', country: 'Canada', city: 'Toronto', rev: 2.8, emp: 3500, ceo: 'Kurt MacAlpine', domain: 'Data Modernization', initiative: 'AI-driven wealth management platform', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 84 },
  { name: 'Fidelity International', sector: 'Asset Managers', country: 'United Kingdom', city: 'London', rev: 3.2, emp: 9000, ceo: 'Anne Richards', domain: 'AI Transformation', initiative: 'AI-powered fund research and selection', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 91 },
  { name: 'Aberdeen Asset Management', sector: 'Asset Managers', country: 'United Kingdom', city: 'Edinburgh', rev: 1.8, emp: 5000, ceo: 'Stephen Bird', domain: 'AI Transformation', initiative: 'AI-driven diversified asset management', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 86 },
  { name: 'Janus Henderson Investors', sector: 'Asset Managers', country: 'United Kingdom', city: 'London', rev: 2.0, emp: 2000, ceo: 'Ali Dibadj', domain: 'AI Transformation', initiative: 'AI-enhanced active investment strategies', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  // Infrastructure Investors — additional unique entries
  { name: 'Cube Infrastructure Managers', sector: 'Infrastructure Investors', country: 'France', city: 'Paris', rev: 0.3, emp: 70, ceo: 'Pierre Buffet', domain: 'Capital Optimization', initiative: 'AI-driven European infrastructure optimization', signal: 'MEDIUM', type: 'CAPITAL_OPTIMIZATION', score: 76 },
  { name: 'Infraco Asia Development', sector: 'Infrastructure Investors', country: 'Singapore', city: 'Singapore', rev: 0.2, emp: 50, ceo: 'Romesh Dias', domain: 'Decision Intelligence', initiative: 'AI-enhanced Asian infrastructure selection', signal: 'MEDIUM', type: 'DECISION_INTELLIGENCE', score: 75 },
  { name: 'Vinci Concessions', sector: 'Infrastructure Investors', country: 'France', city: 'Rueil-Malmaison', rev: 8.5, emp: 15000, ceo: 'Nicolas Notebaert', domain: 'AI Transformation', initiative: 'AI-driven airport and highway operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'Transurban Group', sector: 'Infrastructure Investors', country: 'Australia', city: 'Melbourne', rev: 3.2, emp: 2000, ceo: 'Michelle Jablko', domain: 'AI Transformation', initiative: 'AI-powered toll road management', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  { name: 'Atlas Arteria', sector: 'Infrastructure Investors', country: 'Australia', city: 'Melbourne', rev: 0.8, emp: 200, ceo: 'Graeme Bevans', domain: 'Capital Optimization', initiative: 'AI-enhanced toll road portfolio management', signal: 'MEDIUM', type: 'CAPITAL_OPTIMIZATION', score: 78 },
  { name: 'Sydney Airport', sector: 'Infrastructure Investors', country: 'Australia', city: 'Sydney', rev: 1.5, emp: 1500, ceo: 'Geoff Culbert', domain: 'AI Transformation', initiative: 'AI-driven airport operations optimization', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 83 },
  { name: 'Auckland International Airport', sector: 'Infrastructure Investors', country: 'New Zealand', city: 'Auckland', rev: 0.7, emp: 800, ceo: 'Carrie Hurihanganui', domain: 'AI Transformation', initiative: 'AI-powered airport efficiency program', signal: 'MEDIUM', type: 'AI_TRANSFORMATION', score: 78 },
  { name: 'Ferrovial', sector: 'Infrastructure Investors', country: 'Spain', city: 'Madrid', rev: 8.2, emp: 24000, ceo: 'Ignacio Madridejos', domain: 'AI Transformation', initiative: 'AI-driven infrastructure operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'Abertis Infraestructuras', sector: 'Infrastructure Investors', country: 'Spain', city: 'Barcelona', rev: 5.8, emp: 15000, ceo: 'Jose Aljaro', domain: 'AI Transformation', initiative: 'AI-enhanced toll road management', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  { name: 'Atlantia', sector: 'Infrastructure Investors', country: 'Italy', city: 'Rome', rev: 6.5, emp: 20000, ceo: 'Carlo Bertazzo', domain: 'AI Transformation', initiative: 'AI-driven mobility infrastructure platform', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 86 },
];

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('Connected. Inserting top-up companies...');

  let inserted = 0, skipped = 0;

  for (const co of COMPANIES) {
    const [existing] = await db.execute(
      'SELECT id FROM aros_companies WHERE company_name = ? AND country = ? LIMIT 1',
      [co.name, co.country]
    );
    if (existing.length > 0) { skipped++; continue; }

    const score = co.score;
    const tier = score >= 90 ? 'HIGH_PRIORITY' : score >= 75 ? 'ACTIVE' : 'UNIVERSE';
    const freqDays = tier === 'HIGH_PRIORITY' ? 1 : tier === 'ACTIVE' ? 7 : 30;
    const confidence = co.signal === 'IMMEDIATE' ? 0.90 : co.signal === 'HIGH' ? 0.75 : 0.60;
    const verdict = score >= 90 ? 'STRONG_BUY' : score >= 75 ? 'BUY' : score >= 60 ? 'HOLD' : 'PASS';

    const [result] = await db.execute(
      `INSERT INTO aros_companies 
        (company_name, sector, country, hq_city, revenue_usd_bn, employees, ceo_name,
         key_decision_domain, active_strategic_initiative, ai_transformation_signal,
         opportunity_type, opportunity_score, agenthink_fit_score, decision_complexity_score,
         decision_twin, executive_dossier, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [co.name, co.sector, co.country, co.city, co.rev, co.emp, co.ceo,
       co.domain.slice(0, 50), co.initiative.slice(0, 200), co.signal, co.type,
       score, Math.round(score * 0.95), Math.round(score * 0.9),
       JSON.stringify({ summary: co.initiative, primaryObjective: co.domain }),
       JSON.stringify({ source: 'topup_50' }),
       Date.now(), Date.now()]
    );

    const id = result.insertId;
    await db.execute(
      `INSERT INTO aros_monitoring_jobs (company_id, funnel_tier, monitoring_frequency_days, next_monitor_at, last_monitored_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      [id, tier, freqDays, Date.now() + freqDays * 86400000, Date.now(), Date.now(), Date.now()]
    );
    await db.execute(
      `INSERT INTO aros_pipeline (company_id, stage, researched_at, deal_value_usd, notes, created_at, updated_at)
       VALUES (?, 'RESEARCHED', ?, ?, ?, ?, ?)`,
      [id, Date.now(), score * 2000, `T=0 topup. Score: ${score}`, Date.now(), Date.now()]
    );
    await db.execute(
      `INSERT INTO outcome_sessions (deal_id, council_run_id, council_mode, original_verdict, consensus_score, confidence_level, decision_date, outcome_status, outcome_notes, created_at, updated_at, primary_driver, source_confidence, source_type)
       VALUES (?, ?, 'AROS_DISCOVERY', ?, ?, ?, ?, 'UNKNOWN', ?, ?, ?, 'TECHNOLOGY', ?, 'MANUAL')`,
      [`aros-${id}`, `t0-topup-${id}`, verdict, score / 100.0, confidence, Date.now(),
       `T=0 baseline. ${co.name} | ${co.sector} | ${co.country}`,
       Date.now(), Date.now(), score >= 85 ? 'HIGH' : score >= 70 ? 'MEDIUM' : 'LOW']
    );
    inserted++;
  }

  await db.end();
  console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);

  const db2 = await mysql.createConnection(process.env.DATABASE_URL);
  const [[{ total }]] = await db2.execute('SELECT COUNT(*) as total FROM aros_companies');
  const [[{ pipeline }]] = await db2.execute('SELECT COUNT(*) as pipeline FROM aros_pipeline');
  const [[{ outcomes }]] = await db2.execute("SELECT COUNT(*) as outcomes FROM outcome_sessions WHERE council_mode = 'AROS_DISCOVERY'");
  await db2.end();

  console.log(`\n=== FINAL STATE ===`);
  console.log(`aros_companies:   ${total}`);
  console.log(`aros_pipeline:    ${pipeline}`);
  console.log(`outcome_sessions: ${outcomes}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
