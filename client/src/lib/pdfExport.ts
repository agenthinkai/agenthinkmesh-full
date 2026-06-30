// AgenThink Decision Twin — Executive PDF Export
// 2-page board-ready brief using browser print API
// No external libraries needed.

import type { Company, ScenarioKey } from "./companyData";
import type { WhatIfAssumptions, WhatIfOutputs } from "./whatIfEngine";
import { scenarioLabel } from "./decisionRecord";

function fmt(n: number, unit: string): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}B ${unit}`;
  return `${n} ${unit}`;
}

function deltaStr(d: number): string {
  return `${d >= 0 ? "+" : ""}${d}%`;
}

function statusColor(status: string): string {
  if (status === "safe") return "#22c55e";
  if (status === "alert") return "#ef4444";
  return "#f59e0b";
}

export function exportExecutivePDF(
  company: Company,
  scenario: ScenarioKey,
  assumptions: WhatIfAssumptions,
  outputs: WhatIfOutputs
): void {
  const sLabel = scenarioLabel(scenario);
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${company.name} — Decision Twin Brief</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; font-size: 9pt; line-height: 1.45; }
  .page { page-break-after: always; min-height: 257mm; }
  .page:last-child { page-break-after: avoid; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
  .header-left h1 { font-size: 18pt; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; }
  .header-left .sub { font-size: 8pt; color: #64748b; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-right .badge { display: inline-block; background: #0f172a; color: #fff; font-size: 7pt; font-weight: 700; letter-spacing: 1px; padding: 3px 8px; border-radius: 3px; text-transform: uppercase; }
  .header-right .date { font-size: 7.5pt; color: #64748b; margin-top: 4px; }

  /* Verdict banner */
  .verdict-banner { background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; }
  .verdict-banner .verdict-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 3px; }
  .verdict-banner .verdict-text { font-size: 10pt; font-weight: 700; color: #0f172a; }
  .verdict-banner .verdict-sub { font-size: 8.5pt; color: #334155; margin-top: 4px; line-height: 1.4; }

  /* Section headers */
  .section-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }

  /* Metrics grid */
  .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
  .metric-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 10px; }
  .metric-box .m-label { font-size: 6.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 3px; }
  .metric-box .m-value { font-size: 13pt; font-weight: 800; color: #0f172a; }
  .metric-box .m-delta { font-size: 7.5pt; font-weight: 600; margin-top: 2px; }
  .positive { color: #16a34a; }
  .negative { color: #dc2626; }
  .neutral { color: #64748b; }

  /* Scores row */
  .scores-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
  .score-box { text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; }
  .score-box .s-label { font-size: 6.5pt; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
  .score-box .s-value { font-size: 16pt; font-weight: 800; }

  /* Pathways */
  .pathway-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .pathway-row:last-child { border-bottom: none; }
  .pathway-type { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 2px 6px; border-radius: 2px; margin-bottom: 3px; display: inline-block; }
  .pathway-type.growth { background: #f0fdf4; color: #16a34a; }
  .pathway-type.risk { background: #fef2f2; color: #dc2626; }
  .pathway-name { font-size: 8.5pt; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .pathway-desc { font-size: 7.5pt; color: #475569; line-height: 1.4; max-width: 80%; }
  .pathway-prob { font-size: 11pt; font-weight: 800; }

  /* Assumptions table */
  .assumptions-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .assumptions-table th { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; text-align: left; padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
  .assumptions-table td { font-size: 8pt; padding: 5px 6px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .assumptions-table tr:last-child td { border-bottom: none; }
  .assumption-value { font-weight: 700; color: #0f172a; }

  /* EWI */
  .ewi-row { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
  .ewi-row:last-child { border-bottom: none; }
  .ewi-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
  .ewi-name { font-size: 8pt; font-weight: 700; color: #0f172a; }
  .ewi-desc { font-size: 7.5pt; color: #64748b; }

  /* Council */
  .council-row { padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
  .council-row:last-child { border-bottom: none; }
  .council-header { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .council-persona { font-size: 8pt; font-weight: 700; color: #0f172a; }
  .council-verdict { font-size: 7pt; font-weight: 700; padding: 1px 6px; border-radius: 2px; }
  .council-verdict.support { background: #f0fdf4; color: #16a34a; }
  .council-verdict.oppose { background: #fef2f2; color: #dc2626; }
  .council-verdict.neutral { background: #fefce8; color: #ca8a04; }
  .council-concern { font-size: 7.5pt; color: #475569; }

  /* Footer */
  .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 6px 16mm; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; }
  .footer-text { font-size: 6.5pt; color: #94a3b8; }

  /* Scenario badge */
  .scenario-badge { display: inline-block; background: #1e293b; color: #94a3b8; font-size: 7pt; font-weight: 600; padding: 2px 8px; border-radius: 3px; margin-left: 8px; }
</style>
</head>
<body>

<!-- ═══════════════════════ PAGE 1 ═══════════════════════ -->
<div class="page">

  <div class="header">
    <div class="header-left">
      <h1>${company.name}</h1>
      <div class="sub">${company.sector} · ${company.geography} · ${company.employees} employees · Scenario: ${sLabel}</div>
    </div>
    <div class="header-right">
      <div class="badge">Decision Twin Brief</div>
      <div class="date">${date} · Public Data Only</div>
    </div>
  </div>

  <!-- Verdict -->
  <div class="verdict-banner">
    <div class="verdict-label">Executive Recommendation · ${outputs.recommendationConfidence}% Confidence</div>
    <div class="verdict-text">${outputs.recommendation}</div>
    <div class="verdict-sub">${company.finalRecommendation.text}</div>
  </div>

  <!-- Six Engine Outputs -->
  <div class="section-title">Six Engine Outputs — ${sLabel}</div>
  <div class="metrics-grid">
    <div class="metric-box">
      <div class="m-label">Revenue</div>
      <div class="m-value">${fmt(outputs.revenue, outputs.revenueUnit)}</div>
      <div class="m-delta ${outputs.revenueDelta >= 0 ? "positive" : "negative"}">${deltaStr(outputs.revenueDelta)} vs base</div>
    </div>
    <div class="metric-box">
      <div class="m-label">EBITDA Margin</div>
      <div class="m-value">${outputs.ebitdaMargin}%</div>
      <div class="m-delta ${outputs.ebitdaMarginDelta >= 0 ? "positive" : "negative"}">${outputs.ebitdaMarginDelta >= 0 ? "+" : ""}${outputs.ebitdaMarginDelta}pp vs base</div>
    </div>
    <div class="metric-box">
      <div class="m-label">Enterprise Value</div>
      <div class="m-value">${fmt(outputs.enterpriseValue, outputs.evUnit)}</div>
      <div class="m-delta ${outputs.evDelta >= 0 ? "positive" : "negative"}">${deltaStr(outputs.evDelta)} vs base</div>
    </div>
    <div class="metric-box">
      <div class="m-label">EBITDA</div>
      <div class="m-value">${fmt(outputs.ebitda, outputs.revenueUnit)}</div>
      <div class="m-delta neutral">EV / EBITDA: ${outputs.evMultiple}×</div>
    </div>
    <div class="metric-box">
      <div class="m-label">Council Sentiment</div>
      <div class="m-value" style="font-size:11pt">${outputs.councilSentiment}</div>
      <div class="m-delta neutral">Model confidence: ${company.confidenceScore}%</div>
    </div>
    <div class="metric-box">
      <div class="m-label">AI Leverage Score</div>
      <div class="m-value">${outputs.aiLeverageScore}</div>
      <div class="m-delta neutral">/ 100</div>
    </div>
  </div>

  <!-- Strategic Scores -->
  <div class="section-title">Strategic Signal Scores</div>
  <div class="scores-row" style="margin-bottom:14px">
    <div class="score-box">
      <div class="s-label">AI Leverage</div>
      <div class="s-value" style="color:${outputs.aiLeverageScore >= 60 ? "#16a34a" : outputs.aiLeverageScore >= 40 ? "#ca8a04" : "#dc2626"}">${outputs.aiLeverageScore}</div>
    </div>
    <div class="score-box">
      <div class="s-label">Resilience</div>
      <div class="s-value" style="color:${outputs.resilienceScore >= 60 ? "#16a34a" : outputs.resilienceScore >= 40 ? "#ca8a04" : "#dc2626"}">${outputs.resilienceScore}</div>
    </div>
    <div class="score-box">
      <div class="s-label">Growth Momentum</div>
      <div class="s-value" style="color:${outputs.growthMomentum >= 60 ? "#16a34a" : outputs.growthMomentum >= 40 ? "#ca8a04" : "#dc2626"}">${outputs.growthMomentum}</div>
    </div>
  </div>

  <!-- Top Pathways -->
  <div class="section-title">Top Strategic Pathways</div>
  ${company.growthPathways.slice(0, 2).map(p => `
  <div class="pathway-row">
    <div style="flex:1">
      <span class="pathway-type growth">Growth</span>
      <div class="pathway-name">${p.name}</div>
      <div class="pathway-desc">${p.description.slice(0, 140)}…</div>
    </div>
    <div style="text-align:right;padding-left:12px">
      <div class="pathway-prob positive">${p.probability}%</div>
      <div style="font-size:6.5pt;color:#94a3b8">Probability</div>
    </div>
  </div>`).join("")}
  ${company.failurePathways.slice(0, 1).map(p => `
  <div class="pathway-row">
    <div style="flex:1">
      <span class="pathway-type risk">Risk</span>
      <div class="pathway-name">${p.name}</div>
      <div class="pathway-desc">${p.description.slice(0, 140)}…</div>
    </div>
    <div style="text-align:right;padding-left:12px">
      <div class="pathway-prob negative">${p.probability}%</div>
      <div style="font-size:6.5pt;color:#94a3b8">Probability</div>
    </div>
  </div>`).join("")}

</div>

<!-- ═══════════════════════ PAGE 2 ═══════════════════════ -->
<div class="page">

  <div class="header">
    <div class="header-left">
      <h1>${company.name} — Risk & Assumptions</h1>
      <div class="sub">Scenario: ${sLabel} · ${date}</div>
    </div>
    <div class="header-right">
      <div class="badge">Page 2 of 2</div>
    </div>
  </div>

  <!-- Top Failure Pathways -->
  <div class="section-title">Failure Pathways</div>
  ${company.failurePathways.map(p => `
  <div class="pathway-row">
    <div style="flex:1">
      <span class="pathway-type risk">Risk</span>
      <div class="pathway-name">${p.name}</div>
      <div class="pathway-desc">${p.description.slice(0, 160)}…</div>
      <div style="font-size:7pt;color:#94a3b8;margin-top:3px">Early Warning: ${p.earlyWarning.slice(0, 100)}</div>
    </div>
    <div style="text-align:right;padding-left:12px">
      <div class="pathway-prob negative">${p.probability}%</div>
      <div style="font-size:6.5pt;color:#94a3b8">Probability</div>
    </div>
  </div>`).join("")}

  <!-- Early Warning Indicators -->
  <div class="section-title" style="margin-top:12px">Early Warning Indicators</div>
  ${company.earlyWarningIndicators.map(e => `
  <div class="ewi-row">
    <div class="ewi-dot" style="background:${statusColor(e.status)}"></div>
    <div>
      <div class="ewi-name">${e.name} <span style="font-size:6.5pt;font-weight:600;text-transform:uppercase;color:${statusColor(e.status)}">${e.status.toUpperCase()}</span></div>
      <div class="ewi-desc">${e.description}</div>
    </div>
  </div>`).join("")}

  <!-- Simulation Assumptions -->
  <div class="section-title" style="margin-top:12px">Simulation Assumptions Used</div>
  <table class="assumptions-table">
    <thead>
      <tr>
        <th>Assumption</th>
        <th>Value</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>AI Adoption</td><td class="assumption-value">${assumptions.aiAdoption}%</td><td>% of AI efficiency gains captured</td></tr>
      <tr><td>Market Share</td><td class="assumption-value">${assumptions.marketShare > 0 ? "+" : ""}${assumptions.marketShare}pp</td><td>Percentage point change in market share</td></tr>
      <tr><td>Pricing Power</td><td class="assumption-value">${assumptions.pricingPower > 0 ? "+" : ""}${assumptions.pricingPower}%</td><td>Change in average selling price</td></tr>
      <tr><td>Cost Inflation</td><td class="assumption-value">${assumptions.costInflation}%</td><td>Annual operating cost inflation</td></tr>
      <tr><td>Revenue Growth</td><td class="assumption-value">${assumptions.revenueGrowth > 0 ? "+" : ""}${assumptions.revenueGrowth}%</td><td>Annual revenue growth delta vs base</td></tr>
      <tr><td>Geographic Mix</td><td class="assumption-value">${assumptions.geographicMix}%</td><td>% international / diversified revenue</td></tr>
      <tr><td>Digital Revenue</td><td class="assumption-value">${assumptions.digitalRevenue}%</td><td>% digital / new business model revenue</td></tr>
    </tbody>
  </table>

  <!-- Council Review -->
  <div class="section-title">Council Review Summary</div>
  ${company.councilReview.map(m => `
  <div class="council-row">
    <div class="council-header">
      <span class="council-persona">${m.persona} <span style="font-weight:400;color:#64748b;font-size:7.5pt">— ${m.role}</span></span>
      <span class="council-verdict ${m.verdict.toLowerCase()}">${m.verdict}</span>
    </div>
    <div class="council-concern">${m.keyConcern}</div>
  </div>`).join("")}

  <!-- Disclaimer -->
  <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0">
    <p style="font-size:6.5pt;color:#94a3b8;line-height:1.5">
      This brief was generated by AgenThink Mesh Decision Twin v1 using public data and industry benchmarks. 
      No proprietary or confidential company data was used. Model confidence: ${company.confidenceScore}%. 
      This document is for strategic discussion purposes only and does not constitute investment advice.
      Generated: ${date}.
    </p>
  </div>

</div>

<div class="footer">
  <span class="footer-text">AgenThink Mesh Decision Twin v1 · Public Data Only · ${date}</span>
  <span class="footer-text">${company.name} · ${sLabel} · Confidential</span>
</div>

</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}
