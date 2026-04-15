/**
 * Demo runner: tests the Decision Upgrade Engine against two real database cases
 * Uses the BUILT_IN_FORGE_API directly (same as server-side invokeLLM)
 */

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: '/home/ubuntu/agenthinkmesh-full/.env' });

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!FORGE_URL || !FORGE_KEY) {
  console.error('Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY');
  process.exit(1);
}

async function callLLM(systemPrompt, userPrompt) {
  const res = await fetch(`${FORGE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FORGE_KEY}`
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 3000
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const content = data.choices[0].message.content;
  return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
}

async function generateUpgradeProtocol({ domain, originalInput, verdictBefore, confidenceBefore, blockingIssues, strictMode }) {
  const domainContext = {
    deal: "VC/PE investment evaluation. Focus on: CAC/LTV, growth rate, burn multiple, market size, technical moat, team completeness, exit optionality.",
    procurement: "Vendor/supplier procurement evaluation. Focus on: SLA compliance, data residency, regulatory compliance, pricing benchmarks, contractual protections, vendor stability."
  };

  const strictNote = strictMode
    ? 'STRICT MODE ACTIVE: Do NOT make any assumptions. Tag ALL items as USER_REQUIRED only. Do not fill in synthetic data. The assumedValue field must always be null.'
    : 'Tag each fix clearly: [ASSUMED] = synthetic placeholder you filled in, [IMPROVED] = existing data reframed, [USER_REQUIRED] = must be provided by user.';

  const prompt = `A ${domain} evaluation returned verdict: ${verdictBefore} (confidence: ${Math.round(confidenceBefore * 100)}%).

ORIGINAL INPUT:
${originalInput}

BLOCKING ISSUES:
${blockingIssues.map((b, i) => `${i+1}. ${b}`).join('\n')}

DOMAIN CONTEXT: ${domainContext[domain]}

${strictNote}

Generate a Decision Upgrade Protocol JSON with this exact schema:
{
  "missingInputs": [{"field": string, "importance": string, "tag": "ASSUMED"|"IMPROVED"|"USER_REQUIRED", "assumedValue": string|null}],
  "performanceGaps": [{"metric": string, "current": string, "benchmark": string, "improvement": string}],
  "structuralIssues": [{"issue": string, "severity": "HIGH"|"MEDIUM"|"LOW", "mitigation": string}],
  "narrativeFix": {"original": string, "improved": string, "rationale": string},
  "riskMitigation": [{"action": string, "tag": "ASSUMED"|"IMPROVED"|"USER_REQUIRED", "impact": string}],
  "expectedOutcome": {"predictedVerdict": string, "confidenceDelta": number, "explanation": string}
}

Rules:
- missingInputs: 3-5 items
- performanceGaps: 2-4 items
- structuralIssues: 2-3 items
- riskMitigation: 3-4 items
- predictedVerdict must be realistic (do not jump from REJECTED to APPROVED unless all blocking issues are resolved)
- confidenceDelta is a number between -0.15 and +0.25
- Be specific, not generic`;

  return callLLM(
    "You are a senior decision upgrade analyst. Return only valid JSON matching the schema exactly. No markdown, no explanation.",
    prompt
  );
}

// ─── CASE 1: Deal ─────────────────────────────────────────────────────────────

const dealInput = `Company: Kuwait F&B Franchise Roll-Up — Al-Reef Catering Company
Stage: Growth Equity / PE
Ask: $8M for 60% stake at $13.3M post-money valuation
Sector: F&B / Quick Service Restaurants (QSR), Kuwait

Business Model: Al-Reef Catering Company operates master franchise rights for 3 international QSR brands 
in Kuwait (Burger Barn, Taco Fiesta, Noodle House). Currently 12 outlets, targeting 25 by 2026.
Revenue: $4.2M (2023), projected $7.1M (2024). EBITDA margin: 18%. Revenue growth: 35% YoY.

Team: CEO with 15 years F&B operations experience, no prior exit. No CFO, no tech hire.

Financials: EBITDA $756K (2023). Target IRR: 20% over 5 years.
Exit strategy: Trade sale to Americana Group or Kout Food Group.

Market: Kuwait QSR market $1.8B TAM. No proprietary technology, no data moat, no network effects.
Competitive moat: brand recognition and operational efficiency only.

Risks: Franchise agreements not owned (dependent on master franchisor renewal). No tech differentiation.
Exit market concentrated (2 potential buyers). Regulatory risk in Kuwait F&B sector.`;

const dealBlockingIssues = [
  "Not a venture investment opportunity — this is a PE/growth equity deal",
  "No clear path to 10x venture return; 20% IRR is insufficient for VC risk/reward",
  "No technical moat (no proprietary tech, data, or network effects)",
  "Fund stage mandate mismatch (PE vs. VC)",
  "Fundamental IP ownership issue: company does not own its core assets (the brands)",
  "Concentrated exit market with only 2 potential buyers (Americana, Kout)",
  "No founding team information; no CFO; no enterprise/international experience"
];

// ─── CASE 2: Procurement ──────────────────────────────────────────────────────

const procurementInput = `Vendor: Alibaba Cloud MENA
Category: IT Infrastructure / Cloud Hosting
Contract Value: $2.4M over 3 years ($800K/year)
Procurement Context: Regional financial services firm requiring cloud infrastructure with full data residency in Kuwait/GCC.

Vendor Proposal:
- Primary data centers: UAE (Dubai) and Singapore — NO Kuwait or Saudi Arabia data center
- SLA uptime: 99.9% (meets standard)
- ISO 27001 certified (certificate provided)
- Support: 24/7 enterprise support included
- References: 3 enterprise clients (Lazada, Cainiao, Alibaba Group internal) — none in GCC financial services
- Pricing: $800K/year Year 1 (fixed); Years 2-3 CPI-linked, uncapped

Compliance Gaps:
- Data residency: UAE and Singapore only — violates Kuwait Central Bank data localization requirements
- No GDPR/PDPL (Kuwait Personal Data Protection Law) compliance documentation
- No penetration test results for GCC region infrastructure
- Contractual liability cap: 3 months of fees (industry standard is 12 months)
- No disaster recovery SLA for GCC region specifically
- Geopolitical risk: Chinese-owned entity, subject to PRC data access laws (Article 35 National Security Law)
- Exit clause: 6-month notice, no data portability guarantee`;

const vendorBlockingIssues = [
  "Data residency violation: UAE and Singapore only — Kuwait Central Bank requires in-country data storage",
  "Subject to PRC data access laws — direct conflict with financial services data sovereignty requirements",
  "No GCC financial services references — unproven in regulated regional market",
  "Contractual liability cap at 3 months (should be minimum 12 months for financial services)",
  "No disaster recovery SLA for GCC region",
  "Uncapped pricing in Years 2-3 creates uncontrolled cost exposure",
  "No data portability guarantee in exit clause"
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const results = {};

  // ── DEAL: Standard Mode ──
  console.log('\n' + '═'.repeat(70));
  console.log('CASE 1: Deal Screener — Kuwait F&B Franchise Roll-Up');
  console.log('BEFORE: REJECTED | Confidence: 81% | Blocking Issues: 7');
  console.log('═'.repeat(70));
  console.log('Running upgrade protocol (standard mode)...');
  
  const dealProtocol = await generateUpgradeProtocol({
    domain: 'deal',
    originalInput: dealInput,
    verdictBefore: 'REJECTED',
    confidenceBefore: 0.81,
    blockingIssues: dealBlockingIssues,
    strictMode: false
  });
  
  results.deal = {
    case: 'Kuwait F&B Franchise Roll-Up — Al-Reef Catering Company',
    domain: 'deal',
    before: { verdict: 'REJECTED', confidence: 0.81, blockingIssues: dealBlockingIssues },
    protocol: dealProtocol,
    strictMode: false
  };
  
  console.log('\n✓ PREDICTED VERDICT AFTER FIXES:', dealProtocol.expectedOutcome?.predictedVerdict);
  console.log('✓ CONFIDENCE DELTA:', (dealProtocol.expectedOutcome?.confidenceDelta * 100).toFixed(1) + '%');
  console.log('✓ EXPLANATION:', dealProtocol.expectedOutcome?.explanation);
  console.log('\nFix Tags breakdown:');
  const dealTags = [...(dealProtocol.missingInputs || []), ...(dealProtocol.riskMitigation || [])];
  const dealAssumed = dealTags.filter(t => t.tag === 'ASSUMED').length;
  const dealImproved = dealTags.filter(t => t.tag === 'IMPROVED').length;
  const dealUserReq = dealTags.filter(t => t.tag === 'USER_REQUIRED').length;
  console.log(`  [ASSUMED]: ${dealAssumed}  [IMPROVED]: ${dealImproved}  [USER_REQUIRED]: ${dealUserReq}`);

  // ── DEAL: Strict Mode ──
  console.log('\nRunning strict mode test...');
  const dealStrictProtocol = await generateUpgradeProtocol({
    domain: 'deal',
    originalInput: dealInput,
    verdictBefore: 'REJECTED',
    confidenceBefore: 0.81,
    blockingIssues: dealBlockingIssues,
    strictMode: true
  });
  
  results.dealStrict = {
    case: 'Kuwait F&B — Strict Mode',
    strictMode: true,
    protocol: dealStrictProtocol
  };
  
  const strictTags = [...(dealStrictProtocol.missingInputs || []), ...(dealStrictProtocol.riskMitigation || [])];
  const strictAssumed = strictTags.filter(t => t.tag === 'ASSUMED').length;
  const strictUserReq = strictTags.filter(t => t.tag === 'USER_REQUIRED').length;
  console.log(`\nStrict Mode — [ASSUMED]: ${strictAssumed} (should be 0), [USER_REQUIRED]: ${strictUserReq}`);
  console.log('Strict mode verdict:', dealStrictProtocol.expectedOutcome?.predictedVerdict);
  
  const strictWorking = strictAssumed === 0;
  console.log('Strict mode working correctly:', strictWorking ? '✓ YES' : '✗ NO — ASSUMED tags found in strict mode');

  // ── PROCUREMENT ──
  console.log('\n' + '═'.repeat(70));
  console.log('CASE 2: Procurement — Alibaba Cloud MENA');
  console.log('BEFORE: REJECT | Score: 5.3/10 | Blocking Issues: 7');
  console.log('═'.repeat(70));
  console.log('Running upgrade protocol (standard mode)...');
  
  const vendorProtocol = await generateUpgradeProtocol({
    domain: 'procurement',
    originalInput: procurementInput,
    verdictBefore: 'REJECT',
    confidenceBefore: 0.62,
    blockingIssues: vendorBlockingIssues,
    strictMode: false
  });
  
  results.procurement = {
    case: 'Alibaba Cloud MENA',
    domain: 'procurement',
    before: { verdict: 'REJECT', score: 5.3, confidence: 0.62, blockingIssues: vendorBlockingIssues },
    protocol: vendorProtocol,
    strictMode: false
  };
  
  console.log('\n✓ PREDICTED VERDICT AFTER FIXES:', vendorProtocol.expectedOutcome?.predictedVerdict);
  console.log('✓ CONFIDENCE DELTA:', (vendorProtocol.expectedOutcome?.confidenceDelta * 100).toFixed(1) + '%');
  console.log('✓ EXPLANATION:', vendorProtocol.expectedOutcome?.explanation);
  console.log('\nFix Tags breakdown:');
  const vendorTags = [...(vendorProtocol.missingInputs || []), ...(vendorProtocol.riskMitigation || [])];
  const vendorAssumed = vendorTags.filter(t => t.tag === 'ASSUMED').length;
  const vendorImproved = vendorTags.filter(t => t.tag === 'IMPROVED').length;
  const vendorUserReq = vendorTags.filter(t => t.tag === 'USER_REQUIRED').length;
  console.log(`  [ASSUMED]: ${vendorAssumed}  [IMPROVED]: ${vendorImproved}  [USER_REQUIRED]: ${vendorUserReq}`);

  // ── SAVE ALL RESULTS ──
  writeFileSync('/home/ubuntu/demo_upgrade_results.json', JSON.stringify(results, null, 2));
  console.log('\n' + '═'.repeat(70));
  console.log('ALL RESULTS SAVED → /home/ubuntu/demo_upgrade_results.json');
  console.log('═'.repeat(70));
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
