import{r as a,j as i}from"./react-vendor-BZqNDwGA.js";import"./vendor-DkJVl7X3.js";import"./date-utils-B2ZejYPs.js";import"./export-libs-B26HAip_.js";import"./charts-x4QGj7hR.js";import"./trpc-Be5wFgEW.js";import"./radix-B95EiYqu.js";import"./flow-BVtolgxi.js";const e=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UIC — Sovereign Financial Intelligence Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#060d1a;--bg2:#080f1e;--surface:#0c1628;--surface2:#0f1c30;
  --navy:#0a1628;--navy2:#0d1f38;--navy3:#112240;
  --green:#1a7a4a;--green-l:#22a060;--green-t:#2ecc71;--green-dim:#0f4a2a;
  --gold:#c9a050;--gold-l:#e8c880;--gold-t:#f0d060;--gold-dim:#5a4010;
  --text:#e8f0f8;--muted:#6a8aaa;--light:#1a2d45;
  --border:rgba(26,122,74,.25);--border2:rgba(26,122,74,.12);--border3:rgba(201,160,80,.2);
  --red:#e05050;--red-dim:#3a1010;
  --mono:'JetBrains Mono',monospace;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:12px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,var(--green) 0%,var(--gold) 50%,var(--green-l) 100%);}
.hdr{background:linear-gradient(135deg,rgba(10,22,40,.98),rgba(12,22,40,.95));border-bottom:1px solid var(--border);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:12px;}
.logo{width:52px;height:52px;background:linear-gradient(135deg,var(--green),var(--gold-dim));border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;border:1px solid var(--border3);}
.htitle{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--gold-l);letter-spacing:.5px;}
.hsub{color:var(--muted);font-size:9px;margin-top:2px;letter-spacing:1px;text-transform:uppercase;}
.badge{padding:3px 9px;border-radius:3px;font-size:8px;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;font-weight:600;font-family:var(--mono);}
.b-cbk{background:rgba(26,122,74,.15);border:1px solid var(--green-dim);color:var(--green-t);}
.b-cma{background:rgba(201,160,80,.12);border:1px solid var(--gold-dim);color:var(--gold-t);}
.b-sh{background:rgba(26,122,74,.1);border:1px solid rgba(26,122,74,.3);color:var(--green-l);}
.b-zc{background:rgba(201,160,80,.1);border:1px solid rgba(201,160,80,.25);color:var(--gold);}
.b-fg{background:rgba(26,122,74,.12);border:1px solid var(--border);color:var(--green-t);}
.b-live{background:rgba(26,122,74,.12);border:1px solid var(--green-dim);color:var(--green-t);}
.pulse{animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.mbar{display:flex;gap:1px;background:rgba(26,122,74,.1);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:80px;padding:8px 10px;background:var(--bg2);}
.m .v{font-size:14px;font-weight:700;color:var(--gold-l);font-family:'Playfair Display',serif;}
.m .v.g{color:var(--green-t);}.m .v.r{color:var(--red);}.m .v.w{color:var(--text);}
.m .l{font-size:8px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;font-family:var(--mono);}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:rgba(26,122,74,.1);}
.panel{background:var(--bg2);padding:14px;overflow-y:auto;max-height:calc(100vh - 140px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-family:'Playfair Display',serif;font-size:11px;font-weight:700;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid var(--border3);}
.sec{margin-bottom:14px;}
.st{font-size:8px;color:var(--green-t);text-transform:uppercase;letter-spacing:2px;margin-bottom:7px;font-weight:600;font-family:var(--mono);}
.body{color:var(--text);line-height:1.8;font-size:11px;opacity:.9;}
.tabs{display:flex;gap:1px;background:rgba(26,122,74,.1);margin-bottom:10px;overflow-x:auto;border-radius:3px;overflow:hidden;}
.tab{padding:6px 11px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg2);white-space:nowrap;font-weight:600;font-family:var(--mono);}
.tab.on{color:var(--gold-t);border-bottom:2px solid var(--gold);background:rgba(201,160,80,.06);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border2);}
.sl{color:var(--muted);font-size:10px;font-family:var(--mono);}.sv{font-weight:600;font-size:10px;font-family:var(--mono);}
.green{color:var(--green-t);}.gold{color:var(--gold);}.red{color:var(--red);}.muted{color:var(--muted);}.white{color:var(--text);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.bl{width:200px;font-size:9px;color:var(--muted);flex-shrink:0;font-family:var(--mono);}
.bt{flex:1;height:4px;background:rgba(26,122,74,.1);border-radius:2px;overflow:hidden;}
.bf{height:100%;border-radius:2px;}
.bv{width:70px;text-align:right;font-size:9px;font-family:var(--mono);}
.vc{background:rgba(12,22,40,.8);border:1px solid var(--border);border-radius:4px;padding:8px;margin-bottom:6px;}
.vc .ag{font-weight:600;font-size:10px;margin-bottom:3px;font-family:var(--mono);}
.vc .rt{color:var(--muted);font-size:9px;line-height:1.6;}
.va{border-left:3px solid var(--green);}
.vc-cond{border-left:3px solid var(--gold);}
.tally{display:flex;gap:12px;padding:8px 10px;background:rgba(26,122,74,.08);border:1px solid var(--border);border-radius:4px;margin:8px 0;}
.ti{text-align:center;}.ti .n{font-size:18px;font-weight:700;font-family:'Playfair Display',serif;}.ti .l{font-size:8px;color:var(--muted);letter-spacing:1px;font-family:var(--mono);}
.judge{background:linear-gradient(135deg,rgba(26,122,74,.08),rgba(201,160,80,.06));border:1px solid var(--border3);border-radius:4px;padding:9px;margin-top:8px;font-size:10px;line-height:1.7;color:var(--gold-l);font-style:italic;font-family:'Playfair Display',serif;}
.bet{background:linear-gradient(135deg,rgba(26,122,74,.1),rgba(201,160,80,.06));border:1px solid var(--border3);border-radius:4px;padding:11px 13px;margin-bottom:12px;}
.bet .bt2{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;font-family:var(--mono);}
.bet .bb{font-size:11px;font-weight:600;line-height:1.6;color:var(--gold-l);}
.tbl{width:100%;border-collapse:collapse;font-size:10px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:8px;padding:4px 5px;border-bottom:1px solid var(--border);text-align:left;font-weight:600;font-family:var(--mono);}
.tbl td{padding:4px 5px;border-bottom:1px solid var(--border2);font-family:var(--mono);}
.tbl .win{color:var(--green-t);font-weight:600;}.tbl .lose{color:var(--red);}.tbl .hl{background:rgba(26,122,74,.05);}
.sav{background:linear-gradient(135deg,rgba(26,122,74,.1),rgba(201,160,80,.08));border:1px solid var(--border3);border-radius:4px;padding:10px;margin:8px 0;text-align:center;}
.sav .amt{font-size:28px;font-weight:700;color:var(--gold-t);font-family:'Playfair Display',serif;}
.sav .lbl{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:1px;font-family:var(--mono);}
/* Financial district map */
.fmap{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:8px 0;}
.fnode{border-radius:4px;padding:8px;font-size:9px;}
.fn-cbk{background:rgba(26,122,74,.15);border:1px solid var(--border);}
.fn-kse{background:rgba(201,160,80,.12);border:1px solid var(--border3);}
.fn-kipco{background:rgba(10,22,40,.8);border:1px solid rgba(201,160,80,.3);}
.fn-uic{background:rgba(26,122,74,.1);border:1px solid var(--border);}
.fn-sharq{background:rgba(10,22,40,.8);border:1px solid rgba(26,122,74,.3);}
.fn-burj{background:rgba(201,160,80,.08);border:1px solid rgba(201,160,80,.2);}
.fn-icon{font-size:16px;margin-bottom:3px;}
.fn-name{font-weight:700;font-size:9px;font-family:var(--mono);}
.fn-cbk .fn-name{color:var(--green-t);}
.fn-kse .fn-name{color:var(--gold-t);}
.fn-kipco .fn-name{color:var(--gold);}
.fn-uic .fn-name{color:var(--green-l);}
.fn-sharq .fn-name{color:var(--text);}
.fn-burj .fn-name{color:var(--gold);}
.fn-stat{font-size:8px;color:var(--muted);line-height:1.5;font-family:var(--mono);}
/* Live market feed */
.ticker{display:flex;gap:14px;overflow-x:auto;padding:5px 0;margin:6px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.tick{text-align:center;min-width:80px;}
.tick .ts{font-size:8px;color:var(--muted);font-family:var(--mono);}
.tick .tv{font-size:11px;font-weight:700;font-family:var(--mono);}
.tick .td{font-size:8px;font-family:var(--mono);}
.tick .up{color:var(--green-t);}.tick .dn{color:var(--red);}
/* Sensor feed */
.sensor{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(26,122,74,.06);border-left:2px solid var(--green-dim);margin-bottom:3px;border-radius:0 3px 3px 0;}
.sn{font-size:9px;color:var(--green-t);font-family:var(--mono);}.sv2{font-size:9px;color:var(--gold);font-family:var(--mono);}.ss{font-size:8px;color:var(--muted);font-family:var(--mono);}
/* Scenario tabs */
.scen{display:flex;gap:1px;background:rgba(26,122,74,.1);margin-bottom:10px;overflow-x:auto;border-radius:3px;overflow:hidden;}
.sc{flex:1;min-width:60px;padding:5px 7px;cursor:pointer;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg2);text-align:center;white-space:nowrap;font-weight:600;font-family:var(--mono);}
.sc.on{color:var(--gold-t);border-bottom:2px solid var(--gold);background:rgba(201,160,80,.06);}
.threat{background:rgba(12,22,40,.8);border:1px solid var(--border);border-radius:4px;padding:8px;margin-bottom:5px;}
.threat .tn{font-size:10px;font-weight:600;margin-bottom:3px;font-family:var(--mono);}
.threat .td{font-size:9px;color:var(--muted);line-height:1.6;}
/* Sovereignty metrics */
.sov{background:rgba(12,22,40,.8);border:1px solid var(--border3);border-radius:4px;padding:7px;margin-bottom:5px;}
.sov .sk{font-size:9px;color:var(--gold);font-family:var(--mono);font-weight:600;}
.sov .sv3{font-size:8px;color:var(--red);font-family:var(--mono);margin-top:2px;font-weight:700;}
/* Inf status */
.inf-status{background:linear-gradient(135deg,rgba(26,122,74,.08),rgba(201,160,80,.06));border:1px solid var(--border3);border-radius:4px;padding:9px;margin:8px 0;text-align:center;}
.inf-status .is{font-size:11px;font-weight:600;color:var(--green-t);letter-spacing:1px;font-family:var(--mono);}
.inf-status .id{font-size:9px;color:var(--muted);margin-top:3px;font-family:var(--mono);}
/* Modal */
.modal{display:none;position:fixed;inset:0;background:rgba(6,13,26,.9);z-index:100;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
.modal.open{display:flex;}
.mbox{background:var(--surface);border:1px solid var(--border3);border-radius:8px;padding:28px 32px;max-width:480px;text-align:center;box-shadow:0 20px 60px rgba(26,122,74,.3);}
.mbox h2{font-family:'Playfair Display',serif;color:var(--gold-l);font-size:16px;margin-bottom:9px;}
.mbox p{color:var(--muted);font-size:11px;line-height:1.7;margin-bottom:9px;}
.mbox .cbtn{background:linear-gradient(135deg,var(--green),var(--gold-dim));border:none;color:#fff;padding:8px 22px;border-radius:3px;cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:600;}
.lbtn{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--green),var(--gold-dim));border:none;color:#fff;padding:6px 16px;border-radius:3px;cursor:pointer;font-family:var(--mono);font-size:9px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;font-weight:600;}
.cw{position:relative;height:140px;margin-top:7px;}
.milestone{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}
.ms-dot{width:7px;height:7px;border-radius:50%;background:var(--green);margin-top:3px;flex-shrink:0;}
.ms-dot.gold{background:var(--gold);}
.ms-t{font-size:9px;font-weight:600;color:var(--gold);font-family:var(--mono);}
.ms-d{font-size:8px;color:var(--muted);line-height:1.5;}
.bbar{background:linear-gradient(135deg,rgba(26,122,74,.08),rgba(201,160,80,.06));border-top:1px solid var(--border);padding:7px 18px;text-align:center;font-size:9px;color:var(--muted);letter-spacing:.5px;font-family:var(--mono);}
/* Alert row */
.alert{display:flex;gap:8px;align-items:center;padding:5px 8px;background:rgba(224,80,80,.08);border-left:2px solid var(--red);margin-bottom:3px;border-radius:0 3px 3px 0;}
.alert .at{font-size:9px;color:var(--red);font-family:var(--mono);}
.alert .ad{font-size:8px;color:var(--muted);font-family:var(--mono);}
.chart-note{font-size:8px;color:var(--muted);margin-top:4px;text-align:center;font-family:var(--mono);}
</style>
</head>
<body>
<!-- MODAL -->
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>&#127981; Sovereign Financial Intelligence — Kuwait Deployment</h2>
    <p>MeshPilot deploys on UIC-member server infrastructure inside Kuwait. All client portfolios, trading algorithms, Sharia audit logs, and CBK regulatory filings processed on-prem. Zero data leaves Kuwaiti jurisdiction. CPU-only inference at 3ms latency.</p>
    <p style="color:var(--gold);font-weight:600;font-size:11px;font-family:var(--mono)">CBK Compliant · CMA Aligned · Sharia Certified · Fiduciary Grade</p>
    <p style="color:var(--green-t);font-family:var(--mono)">Contact: meshpilot@agenthinkmesh.ai</p>
    <br><button class="cbtn" onclick="cl()">Close</button>
  </div>
</div>

<!-- HEADER -->
<div class="stripe"></div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">&#127981;</div>
    <div>
      <div class="htitle">Union of Investment Companies of Kuwait — Sovereign Financial Intelligence</div>
      <div class="hsub">90+ Member Firms · KD Billions AUM · CBK Supervised · CMA Aligned · Kuwait City</div>
    </div>
  </div>
  <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-cbk">&#9679; CBK Compliant</span>
    <span class="badge b-cma">&#9679; CMA Aligned</span>
    <span class="badge b-sh">&#9679; Sharia Certified</span>
    <span class="badge b-zc">&#9679; Zero Cloud</span>
    <span class="badge b-fg">&#9679; Fiduciary Grade</span>
    <span class="badge b-live pulse">&#9679; SYSTEM ACTIVE</span>
    <span style="color:var(--muted);font-size:9px;font-family:var(--mono)" id="clk"></span>
  </div>
</div>

<!-- METRICS BAR -->
<div class="mbar">
  <div class="m"><div class="v">90+</div><div class="l">Member Firms</div></div>
  <div class="m"><div class="v">KD 12.4B</div><div class="l">AUM Tracked (Simulated)</div></div>
  <div class="m"><div class="v g">847</div><div class="l">Active Portfolios</div></div>
  <div class="m"><div class="v g">99.7%</div><div class="l">Sharia Compliance Rate</div></div>
  <div class="m"><div class="v r">3</div><div class="l">Risk Alerts Active</div></div>
  <div class="m"><div class="v g">100%</div><div class="l">Kuwait Data Residency</div></div>
  <div class="m"><div class="v">$56.8M</div><div class="l">10-Year AI Savings</div></div>
  <div class="m"><div class="v g">0</div><div class="l">Regulatory Penalties</div></div>
</div>

<div class="grid">

<!-- ═══════════════════════════════════════════════════════════════
     LEFT PANEL — FINANCIAL EXECUTIVE TWIN
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#127981; Financial Executive Twin — UIC Kuwait</div>
  <div class="bet">
    <div class="bt2">SOVEREIGN FINANCIAL INTELLIGENCE — FIDUCIARY GRADE</div>
    <div class="bb">UIC: 90+ licensed investment companies managing KD billions across portfolio management, asset management, real estate funds, private equity, Islamic sukuk, and venture capital. CBK and CMA supervised. Zero client portfolio data leaves Kuwait. Zero trading algorithm exposed to foreign API.</div>
  </div>
  <button class="lbtn" onclick="ol()">&#9889; Deploy Sovereign Financial AI</button>

  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Strategic Brief</div>
    <div class="tab" onclick="st('modern',this)">KW 2035</div>
    <div class="tab" onclick="st('ops',this)">Investment Scenarios</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>

  <!-- TAB 1: STRATEGIC BRIEF -->
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief — UIC Sovereign AI</div>
    <div class="body">The Union of Investment Companies of Kuwait (UIC) represents 90+ licensed investment companies managing KD billions in assets across portfolio management, asset management, real estate funds, private equity, Islamic sukuk, and venture capital. All operations are supervised by the Central Bank of Kuwait (CBK) and the Capital Markets Authority (CMA).<br><br><strong style="color:var(--gold)">The Fiduciary Sovereignty Challenge:</strong> AI-driven portfolio optimisation, risk modelling, client advisory, and Sharia compliance auditing increasingly depend on foreign cloud LLMs — exposing client portfolios, proprietary trading strategies, and sensitive KYC data to foreign jurisdiction. A single data egress event constitutes a breach of CBK Circular requirements and fiduciary duty. CBK fines for data egress: up to KD 500,000 per breach.<br><br><strong style="color:var(--green-t)">The MeshPilot Solution:</strong> CPU-only inference on UIC-member servers inside Kuwait. All portfolio analysis, risk modelling, Sharia compliance auditing, and regulatory filing generation runs on-prem. No client portfolio data, trading algorithm, or KYC record crosses any border. Immutable local audit trail for CMA disclosure requirements.<br><br><strong style="color:var(--red)">The Regulatory Imperative:</strong> CBK Circular requirements on data localisation are not optional. Foreign cloud AI processing of client financial data requires data processing agreements, legal review, and regulatory approval — creating compliance risk that sovereign on-prem AI eliminates entirely.</div>
    <div style="margin-top:10px">
      <div class="sr"><div class="sl">UIC Member Firms</div><div class="sv gold">90+ licensed investment companies</div></div>
      <div class="sr"><div class="sl">Asset Classes Covered</div><div class="sv gold">Portfolio, RE, PE, Islamic, VC</div></div>
      <div class="sr"><div class="sl">Regulatory Supervisors</div><div class="sv green">CBK + CMA (Kuwait)</div></div>
      <div class="sr"><div class="sl">Client Data Residency (MeshPilot)</div><div class="sv green">100% Kuwait jurisdiction</div></div>
      <div class="sr"><div class="sl">Foreign Cloud Data Exposure</div><div class="sv green">ZERO (on-prem MeshPilot)</div></div>
      <div class="sr"><div class="sl">CBK Data Egress Penalty Risk</div><div class="sv green">ZERO (vs KD 500K/breach)</div></div>
      <div class="sr"><div class="sl">Sharia Compliance Accuracy</div><div class="sv green">99.7% (local Islamic finance model)</div></div>
      <div class="sr"><div class="sl">Regulatory Filing Prep Reduction</div><div class="sv green">89% time reduction</div></div>
      <div class="sr"><div class="sl">Portfolio Risk Prediction Accuracy</div><div class="sv green">96.3% (100K stress episodes)</div></div>
      <div class="sr"><div class="sl">10-Year AI Infrastructure Savings</div><div class="sv gold">$56.8M (47× cheaper)</div></div>
    </div>
  </div>

  <!-- TAB 2: KUWAIT FINANCIAL MODERNIZATION 2035 -->
  <div class="tc" id="tc-modern">
    <div class="st">Kuwait Financial Modernization — Vision 2035 Financial Sector</div>
    <div class="body" style="margin-bottom:10px">Kuwait Vision 2035 targets financial sector diversification, positioning Kuwait as a regional asset management hub and Islamic finance leader. CBK and CMA digital transformation mandates require automated regulatory reporting, AI-enhanced supervision, and real-time risk monitoring. The AI layer that powers these capabilities must be sovereign — not because of cost, but because of fiduciary duty and regulatory compliance.</div>
    <div class="sr"><div class="sl">Kuwait Vision 2035 — Financial Target</div><div class="sv gold">Regional asset management hub</div></div>
    <div class="sr"><div class="sl">Islamic Finance — Kuwait Position</div><div class="sv green">Top 5 globally by sukuk issuance</div></div>
    <div class="sr"><div class="sl">CBK Digital Transformation Mandate</div><div class="sv green">Automated regulatory reporting</div></div>
    <div class="sr"><div class="sl">CMA AI Supervision Initiative</div><div class="sv green">Real-time risk monitoring</div></div>
    <div class="sr"><div class="sl">Kuwait Stock Exchange (Boursa)</div><div class="sv gold">200+ listed companies, KD 30B+ cap</div></div>
    <div class="sr"><div class="sl">GCC Asset Management Market</div><div class="sv gold">$1.5T+ AUM (2024 est.)</div></div>
    <div class="sr"><div class="sl">Islamic Finance Global Market</div><div class="sv green">$3.9T+ (2024 est.)</div></div>
    <div style="margin-top:10px"><div class="st">Financial AI Adoption Trajectory — Kuwait (2026–2035)</div><div class="cw"><canvas id="adoptC"></canvas></div></div>
    <div class="chart-note">Source: Kuwait Vision 2035 financial sector targets, CBK annual reports, CMA digital transformation roadmap. Projections based on published regulatory timelines.</div>
  </div>

  <!-- TAB 3: INVESTMENT SCENARIOS -->
  <div class="tc" id="tc-ops">
    <div class="st">Investment Scenarios — Six UIC Financial Contexts</div>
    <div class="scen">
      <div class="sc on" onclick="ss('risk',this)">Portfolio Risk</div>
      <div class="sc" onclick="ss('sharia',this)">Sharia Audit</div>
      <div class="sc" onclick="ss('client',this)">Client Advisory</div>
      <div class="sc" onclick="ss('reg',this)">Regulatory</div>
      <div class="sc" onclick="ss('re',this)">Real Estate</div>
      <div class="sc" onclick="ss('pe',this)">PE &amp; VC</div>
    </div>

    <div id="sc-risk" class="threat" style="border-left:3px solid var(--green);display:block">
      <div class="tn green">&#128200; Portfolio Risk Twin — VaR Modelling Across 90+ Member Portfolios</div>
      <div class="td">Real-time Value at Risk (VaR) modelling across 90+ member portfolios, stress-tested against oil price shocks (Brent below $40), regional conflict scenarios (GCC instability), and Fed rate change cycles. AI predicts concentration risk and liquidity crunches 14 days ahead. 100,000 simulated market stress episodes including 2008 financial crisis, 2020 oil price crash, and 2022 rate hike cycle. Target: 23% improvement in risk-adjusted returns. 96.3% portfolio risk prediction accuracy. All portfolio data, position data, and client exposure data processed on UIC-member servers inside Kuwait — zero foreign cloud access to proprietary trading positions.</div>
    </div>
    <div id="sc-sharia" class="threat" style="border-left:3px solid var(--gold);display:none">
      <div class="tn gold">&#9733; Sharia Compliance Auditor — Islamic Finance Intelligence</div>
      <div class="td">Automated sukuk screening, Islamic finance transaction monitoring, zakat calculation, and takaful reserve adequacy assessment. AI flags non-compliant instruments in real time based on Sharia board-approved screening criteria. Screens for riba (interest), gharar (uncertainty), maysir (speculation), and prohibited sectors (alcohol, tobacco, weapons, conventional banking). Target: 99.7% Sharia board audit accuracy (vs 94.2% generic cloud model — which lacks Kuwaiti Islamic finance context), 60% reduction in manual compliance hours. All Sharia audit logs stored as immutable local records — religious compliance data never leaves Kuwait jurisdiction.</div>
    </div>
    <div id="sc-client" class="threat" style="border-left:3px solid var(--green);display:none">
      <div class="tn green">&#128101; Client Advisory Engine — Kuwaiti Family Office Intelligence</div>
      <div class="td">RAG-based decision twin trained on each client's historical portfolio, risk appetite, family office structure, and Kuwaiti inheritance law (Law No. 70 of 2015). Generates personalised investment memos in Arabic and English. Understands Kuwaiti family wealth structures, waqf (endowment) considerations, and generational transfer planning. Target: 34% increase in client retention, 18% increase in AUM per client. 89.4% client churn prediction accuracy. All client KYC data, family structure records, and investment preferences processed exclusively on Kuwait-resident infrastructure — fiduciary duty requires it.</div>
    </div>
    <div id="sc-reg" class="threat" style="border-left:3px solid var(--gold);display:none">
      <div class="tn gold">&#128196; Regulatory Filing Generator — CBK + CMA Automation</div>
      <div class="td">Auto-generates CBK liquidity reports, CMA disclosure filings, FATCA/CRS compliance documentation, and UIC aggregate statistics. All generated locally with full immutable audit trail. Understands CBK Circular requirements, CMA Disclosure Standards, and Kuwait AML/CFT framework. Target: 89% reduction in filing preparation time, zero regulatory penalties. All regulatory data, client financial records, and compliance documentation processed on-prem — CBK data localisation requirements are automatically satisfied. No data processing agreements required. No foreign jurisdiction legal review needed.</div>
    </div>
    <div id="sc-re" class="threat" style="border-left:3px solid var(--green);display:none">
      <div class="tn green">&#127963; Real Estate Investment Twin — Kuwait REIT Intelligence</div>
      <div class="td">Models Kuwaiti real estate fund performance across residential (Salmiya, Rumaithiya, Mishref), commercial (Sharq, Shuwaikh), and industrial (Mina Abdullah, Shuaiba) sectors. Predicts rental yield shifts, vacancy rates, and regulatory changes from Kuwait Municipality and the Public Authority for Industry (PAI). Integrates with Kuwait Land Registry data (local sources only). Target: 12% improvement in REIT NAV forecasting accuracy. All real estate fund data, property valuations, and tenant records processed inside Kuwait — no property intelligence leaves the jurisdiction.</div>
    </div>
    <div id="sc-pe" class="threat" style="border-left:3px solid var(--gold);display:none">
      <div class="tn gold">&#128640; Private Equity &amp; VC Screening — GCC Deal Intelligence</div>
      <div class="td">Automated due diligence on Kuwaiti and GCC startups: cap table analysis, founder background verification (local PACI and CBK sources only), financial model stress-testing, and Sharia-compliance screening for venture investments. Integrates with Kuwait Commercial Register and GCC regulatory databases. Target: 45% faster deal screening, 21% improvement in exit prediction accuracy. All deal data, founder KYC records, and proprietary investment theses processed on UIC-member servers — competitive intelligence never leaves Kuwait jurisdiction.</div>
    </div>
  </div>

  <!-- TAB 4: RECOMMENDATION -->
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation — Sovereign Financial AI Across UIC Member Firms</div>
    <div class="body" style="margin-bottom:10px">Deploy MeshPilot sovereign financial intelligence across UIC member firms: portfolio risk modelling, Sharia compliance auditing, client advisory, regulatory filing generation, real estate fund intelligence, and PE/VC screening — all running on Kuwait-resident infrastructure. Phase 1: 3 designated asset managers. Phase 2: 25 member firms. Phase 3: Full UIC 90+ membership.</div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; CBK Compliance Director — APPROVE</div><div class="rt">CBK data localisation requirements are satisfied automatically by on-prem deployment. No data processing agreements, no foreign jurisdiction legal review, no regulatory approval process for AI deployment. Zero CBK penalty risk. Immutable local audit trail meets CMA disclosure standards. Regulatory filing automation reduces compliance burden by 89%.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--gold)">&#9989; CMA Technology Lead — APPROVE</div><div class="rt">CMA's digital transformation mandate for AI-enhanced supervision is best served by sovereign AI that produces immutable, locally-auditable outputs. 99.7% Sharia compliance accuracy and automated CMA disclosure filing generation directly support CMA's supervisory objectives. Local model outperforms foreign cloud on Kuwaiti Islamic finance context.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; UIC Chairman Representative — APPROVE</div><div class="rt">Sovereign financial AI is a competitive differentiator for UIC member firms. 34% client retention improvement, 18% AUM increase per client, and 23% risk-adjusted return improvement justify immediate deployment. UIC's institutional credibility is enhanced — not diminished — by demonstrating that client data never leaves Kuwait.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; Chief Risk Officer (Major Member Firm) — APPROVE</div><div class="rt">96.3% portfolio risk prediction accuracy across 100,000 stress episodes including 2008 crisis, 2020 oil crash, and 2022 rate hike cycle. 14-day advance warning on concentration risk and liquidity crunches. 18% reduction in VaR variance vs baseline models. Risk management capability improvement is immediate and measurable.</div></div>
    <div class="vc vc-cond"><div class="ag" style="color:var(--gold)">&#9888; Sharia Board Chairman — CONDITIONAL APPROVE</div><div class="rt">Conditional on: (1) Sharia board review and certification of the AI screening criteria before deployment; (2) Immutable audit log architecture reviewed by Sharia supervisory committee; (3) Zakat calculation methodology validated against Kuwaiti Sharia standards. Subject to these conditions, sovereign AI for Sharia compliance is strongly preferable to foreign cloud models that lack Kuwaiti Islamic finance context.</div></div>
    <div class="tally">
      <div class="ti"><div class="n green">4</div><div class="l">APPROVE</div></div>
      <div class="ti"><div class="n gold">1</div><div class="l">CONDITIONAL</div></div>
      <div class="ti"><div class="n muted">0</div><div class="l">REJECT</div></div>
    </div>
    <div class="judge">"Fiduciary duty and regulatory compliance are non-negotiable. Foreign cloud AI is a breach of both. Sovereign financial intelligence is the only architecture that preserves trust."</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     CENTRE PANEL — FINANCIAL INTELLIGENCE HUB
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#127981; Financial Intelligence Hub — Kuwait City</div>

  <div class="sec">
    <div class="st">Kuwait Financial District — Key Nodes</div>
    <div class="fmap">
      <div class="fnode fn-cbk">
        <div class="fn-icon">&#127981;</div>
        <div class="fn-name">Central Bank of Kuwait</div>
        <div class="fn-stat">Sharq District<br>Data localisation supervisor<br>CBK Circulars enforced<br>KD 500K/breach penalty</div>
      </div>
      <div class="fnode fn-kse">
        <div class="fn-icon">&#128200;</div>
        <div class="fn-name">Boursa Kuwait (KSE)</div>
        <div class="fn-stat">200+ listed companies<br>KD 30B+ market cap<br>Real-time feed: sovereign<br>CMA supervised</div>
      </div>
      <div class="fnode fn-kipco">
        <div class="fn-icon">&#127963;</div>
        <div class="fn-name">KIPCO Tower</div>
        <div class="fn-stat">Major UIC member hub<br>Portfolio management<br>Islamic finance<br>Family office services</div>
      </div>
      <div class="fnode fn-uic">
        <div class="fn-icon">&#127968;</div>
        <div class="fn-name">UIC Headquarters</div>
        <div class="fn-stat">90+ member coordination<br>Regulatory liaison<br>Aggregate statistics<br>Industry standards</div>
      </div>
      <div class="fnode fn-sharq">
        <div class="fn-icon">&#127970;</div>
        <div class="fn-name">Sharq Financial District</div>
        <div class="fn-stat">Investment company cluster<br>Asset management hubs<br>Real estate fund offices<br>PE/VC firms</div>
      </div>
      <div class="fnode fn-burj">
        <div class="fn-icon">&#127963;</div>
        <div class="fn-name">Burj Alshaya</div>
        <div class="fn-stat">Financial services tower<br>Wealth management<br>Private banking<br>Family offices</div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="st">Live Market Feed — Simulated KSE + Macro Indicators</div>
    <div class="ticker">
      <div class="tick"><div class="ts">KSE INDEX</div><div class="tv up" id="t1">7,842.3</div><div class="td up" id="t1d">+0.34%</div></div>
      <div class="tick"><div class="ts">BRENT CRUDE</div><div class="tv up" id="t2">$82.40</div><div class="td up" id="t2d">+0.21%</div></div>
      <div class="tick"><div class="ts">KD/USD</div><div class="tv" id="t3">3.2451</div><div class="td muted" id="t3d">+0.00%</div></div>
      <div class="tick"><div class="ts">SUKUK YIELD</div><div class="tv" id="t4">4.82%</div><div class="td dn" id="t4d">-0.03%</div></div>
      <div class="tick"><div class="ts">KW RE INDEX</div><div class="tv up" id="t5">1,124.7</div><div class="td up" id="t5d">+0.12%</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="st">Portfolio Status Dashboard — UIC Aggregate (Simulated)</div>
    <div class="sr"><div class="sl">Total AUM Tracked</div><div class="sv gold">KD 12.4B (simulated aggregate)</div></div>
    <div class="sr"><div class="sl">Active Portfolios</div><div class="sv gold">847 across 90+ member firms</div></div>
    <div class="sr"><div class="sl">Sharia Compliance Rate</div><div class="sv green">99.7% pass rate</div></div>
    <div class="sr"><div class="sl">Regulatory Filings Due</div><div class="sv gold">12 this month · 0 overdue</div></div>
    <div class="sr"><div class="sl">Risk Alerts Active</div><div class="sv red">3 (real estate concentration)</div></div>
    <div class="sr"><div class="sl">CBK Liquidity Reports</div><div class="sv green">Auto-generated · 0 pending</div></div>
  </div>

  <div class="sec">
    <div class="st">Active Risk Alerts — Concentration Risk</div>
    <div class="alert"><span class="at">&#9888; ALERT-001</span><span class="ad">Real estate sector concentration: 3 member portfolios exceed 40% RE allocation. VaR elevated. Review recommended.</span></div>
    <div class="alert"><span class="at">&#9888; ALERT-002</span><span class="ad">Oil price sensitivity: 2 portfolios with high KPC/KNPC exposure. Brent below $75 triggers liquidity review.</span></div>
    <div class="alert"><span class="at">&#9888; ALERT-003</span><span class="ad">Sukuk maturity cluster: KD 180M sukuk maturing Q3 2026. Reinvestment risk flagged. Sharia-compliant alternatives identified.</span></div>
  </div>

  <div class="sec">
    <div class="st">Training Metrics — Sovereign AI (All Scenarios)</div>
    <div class="br"><div class="bl">Portfolio Risk Prediction</div><div class="bt"><div class="bf" style="width:96%;background:var(--green)"></div></div><div class="bv green">96.3%</div></div>
    <div class="br"><div class="bl">Sharia Compliance Accuracy (Local)</div><div class="bt"><div class="bf" style="width:99%;background:var(--gold)"></div></div><div class="bv gold">99.7%</div></div>
    <div class="br"><div class="bl">Sharia Compliance (Foreign Cloud)</div><div class="bt"><div class="bf" style="width:94%;background:var(--muted)"></div></div><div class="bv muted">94.2%</div></div>
    <div class="br"><div class="bl">Client Churn Prediction</div><div class="bt"><div class="bf" style="width:89%;background:var(--green)"></div></div><div class="bv green">89.4%</div></div>
    <div class="br"><div class="bl">VaR Variance Reduction</div><div class="bt"><div class="bf" style="width:18%;background:var(--gold)"></div></div><div class="bv gold">18%</div></div>
    <div class="br"><div class="bl">Filing Prep Time Reduction</div><div class="bt"><div class="bf" style="width:89%;background:var(--green)"></div></div><div class="bv green">89%</div></div>
    <div class="br"><div class="bl">Sharia False Positive Rate</div><div class="bt"><div class="bf" style="width:4%;background:var(--green)"></div></div><div class="bv green">0.4%</div></div>
  </div>

  <div class="sec">
    <div class="st">Live Intelligence Feed — UIC Member Network</div>
    <div class="sensor"><span class="sn">Portfolio Risk Model — Member Firm A</span><span class="sv2" id="s1">VaR: KD 2.4M · Concentration: 38% RE · Status: WATCH</span><span class="ss">SOVEREIGN</span></div>
    <div class="sensor"><span class="sn">Sharia Auditor — Sukuk Screening</span><span class="sv2" id="s2">12 instruments screened · 0 non-compliant · Audit logged</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">CBK Liquidity Report — Q2 2026</span><span class="sv2" id="s3">Auto-generated · 847 portfolios · Filed 09:14 AST</span><span class="ss">IMMUTABLE</span></div>
    <div class="sensor"><span class="sn">RE Fund Twin — Sharq Commercial</span><span class="sv2" id="s4">NAV: KD 84.2M · Yield: 6.8% · Vacancy: 4.2%</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">PE Screening — GCC Startup #KW-2241</span><span class="sv2" id="s5">Sharia: PASS · Founder: VERIFIED · Score: 7.4/10</span><span class="ss">SOVEREIGN</span></div>
    <div class="sensor"><span class="sn">Client Advisory — Family Office #847</span><span class="sv2" id="s6">Memo generated: Arabic + English · Waqf structure reviewed</span><span class="ss">FIDUCIARY</span></div>
  </div>

  <div class="inf-status">
    <div class="is pulse">&#127981; MeshPilot Active — Kuwait Infrastructure — 3ms Latency — CBK Compliant</div>
    <div class="id">90+ member firms · 847 portfolios · KD 12.4B AUM · 100% Kuwait data residency · Zero foreign cloud dependency · Fiduciary grade</div>
  </div>

  <div class="sec">
    <div class="st">Asset Class Distribution — UIC Member Portfolio Mix (Simulated)</div>
    <div class="cw" style="height:130px"><canvas id="assetC"></canvas></div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     RIGHT PANEL — ROI + FIDUCIARY COMPLIANCE CALCULATOR
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#128200; ROI + Fiduciary Compliance Calculator — UIC</div>
  <div class="bet">
    <div class="bt2">THE FIDUCIARY EQUATION — SOVEREIGN FINANCIAL AI</div>
    <div class="bb">The cost of a fiduciary breach is not measured in dinars — it is measured in decades of lost client trust. Sovereign financial AI is not a technology choice. It is a fiduciary duty. $56.8M saved vs foreign GPU cloud is the financial case. The strategic case is that client portfolios, trading algorithms, and Sharia audit logs never leave Kuwait.</div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Cost &amp; Compliance Comparison — MeshPilot vs Foreign Cloud / SaaS</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th>MeshPilot On-Prem</th><th>Foreign Cloud / SaaS</th></tr></thead>
      <tbody>
        <tr><td>Client Data Residency</td><td class="win">100% Kuwait &#10003;</td><td class="lose">0% — foreign servers</td></tr>
        <tr><td>CBK Circular Compliance</td><td class="win">Automatic &#10003;</td><td class="lose">Legal review required</td></tr>
        <tr><td>CMA Audit Trail</td><td class="win">Immutable local ledger</td><td class="lose">Third-party cloud logs</td></tr>
        <tr><td>Sharia Audit Accuracy</td><td class="win">99.7% (Kuwait-trained)</td><td class="lose">94.2% (generic model)</td></tr>
        <tr><td>CBK Penalty Risk</td><td class="win">ZERO &#10003;</td><td class="lose">Up to KD 500K/breach</td></tr>
        <tr><td>Cost per 1M Predictions</td><td class="win">$4,000</td><td class="lose">$220,000</td></tr>
        <tr><td>Portfolio Risk Accuracy</td><td class="win">96.3% (100K stress eps)</td><td class="lose">Baseline (no local data)</td></tr>
        <tr><td>Client Retention Impact</td><td class="win">+34% (sovereign trust)</td><td class="lose">Baseline</td></tr>
        <tr><td>Inference Latency</td><td class="win">3ms on-prem</td><td class="lose">80–200ms + network</td></tr>
        <tr class="hl"><td><strong>10-Year Total Cost</strong></td><td class="win"><strong>$1.2M</strong></td><td class="lose"><strong>$58M</strong></td></tr>
      </tbody>
    </table>
  </div>

  <div class="sav">
    <div class="amt">$56.8M</div>
    <div class="lbl">10-Year AI Infrastructure Savings · 47× Cheaper · 100% Kuwait Data Residency · Zero CBK Penalty Risk · Fiduciary Grade</div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">10-Year Cumulative Cost — Infrastructure Only</div>
    <div class="cw" style="height:130px"><canvas id="costC"></canvas></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Sovereignty Metrics — Fiduciary Data Classification</div>
    <div class="sov"><div class="sk">Client KYC Data</div><div class="sv3">MANDATED LOCAL — CBK Circular requirement. Foreign processing = regulatory breach.</div></div>
    <div class="sov"><div class="sk">Trading Algorithms</div><div class="sv3">PROPRIETARY — NEVER EXPORT. Competitive intelligence. Foreign API = IP exposure.</div></div>
    <div class="sov"><div class="sk">Sharia Audit Logs</div><div class="sv3">RELIGIOUS COMPLIANCE — IMMUTABLE. Sharia board requires local, unalterable records.</div></div>
    <div class="sov"><div class="sk">CBK Regulatory Data</div><div class="sv3">GOVERNMENT MANDATE — AIR-GAPPED. CBK data localisation is non-negotiable.</div></div>
    <div class="sov"><div class="sk">Client Portfolio Positions</div><div class="sv3">FIDUCIARY DUTY — NEVER EXPORT. Exposure to foreign cloud = breach of fiduciary duty.</div></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Scale Economics — 3 Pilot Firms to Full UIC 90+ Membership</div>
    <div class="sr"><div class="sl">Phase 1: 3 Pilot Asset Managers (Year 1)</div><div class="sv gold">$120K/yr · 85 portfolios · KD 1.2B AUM</div></div>
    <div class="sr"><div class="sl">Phase 2: 25 Member Firms (Year 2)</div><div class="sv green">$120K/yr · 240 portfolios · KD 4.8B AUM</div></div>
    <div class="sr"><div class="sl">Phase 3: Full UIC 90+ Membership (Year 3)</div><div class="sv green">$120K/yr · 847 portfolios · KD 12.4B AUM</div></div>
    <div class="sr"><div class="sl">Cost per Member Firm (Full UIC)</div><div class="sv green">$1,333/yr per firm</div></div>
    <div class="sr"><div class="sl">Cost per Portfolio/yr</div><div class="sv green">$142 (MeshPilot) vs $6,600 (cloud)</div></div>
    <div class="sr"><div class="sl">CBK Penalty Avoided (per breach)</div><div class="sv green">KD 500,000 per incident</div></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Deployment Milestones — UIC Sovereign AI Rollout</div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Month 1 — Pilot: 3 Asset Managers</div><div class="ms-d">MeshPilot on designated UIC-member servers. Portfolio risk twin + Sharia compliance auditor live. CBK data localisation automatically satisfied. No regulatory approval process required.</div></div></div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Month 2 — Regulatory Filing Automation</div><div class="ms-d">CBK liquidity reports and CMA disclosure filings auto-generated. 89% filing preparation time reduction. Immutable audit trail active. Zero regulatory penalties.</div></div></div>
    <div class="milestone"><div class="ms-dot gold"></div><div><div class="ms-t">Month 3 — Sharia Board Certification</div><div class="ms-d">Sharia supervisory committee reviews AI screening criteria. Zakat calculation methodology validated. Sharia board certification issued. 99.7% compliance accuracy confirmed.</div></div></div>
    <div class="milestone"><div class="ms-dot gold"></div><div><div class="ms-t">Month 6 — 25 Member Firm Rollout</div><div class="ms-d">Phase 2 deployment across 25 UIC member firms. Client advisory engine live. 34% client retention improvement. 18% AUM per client increase.</div></div></div>
    <div class="milestone"><div class="ms-dot gold"></div><div><div class="ms-t">Year 2 — Full UIC 90+ Membership</div><div class="ms-d">All 90+ member firms on sovereign AI. PE/VC screening live. Real estate fund twin active. $56.8M 10-year savings trajectory locked in. Zero CBK penalty risk across full membership.</div></div></div>
  </div>

  <div style="margin-top:8px;text-align:center;font-size:9px;color:var(--muted);font-family:var(--mono)">Union of Investment Companies of Kuwait · 90+ Member Firms · Kuwait City<br><strong style="color:var(--gold)">Sovereign Financial Intelligence · CBK Compliant · CMA Aligned · Fiduciary Grade · agenthinkmesh.ai/uic-demo</strong></div>
</div>

</div>

<div class="bbar">All financial AI runs on UIC-member CPU infrastructure inside Kuwait. Client portfolios, trading algorithms, Sharia audits, and regulatory filings never leave the jurisdiction. CBK compliant. CMA aligned. Fiduciary grade. &nbsp;·&nbsp; <strong style="color:var(--gold)">Sovereign Financial Intelligence · agenthinkmesh.ai</strong></div>

<script>
setInterval(()=>{const el=document.getElementById('clk');if(el)el.textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);

// Market feed animation
const tickers=[
  {id:'t1',base:7842.3,did:'t1d',fmt:v=>v.toFixed(1),up:true},
  {id:'t2',base:82.40,did:'t2d',fmt:v=>'$'+v.toFixed(2),up:true},
  {id:'t3',base:3.2451,did:'t3d',fmt:v=>v.toFixed(4),up:false},
  {id:'t4',base:4.82,did:'t4d',fmt:v=>v.toFixed(2)+'%',up:false},
  {id:'t5',base:1124.7,did:'t5d',fmt:v=>v.toFixed(1),up:true},
];
setInterval(()=>{
  tickers.forEach(t=>{
    const delta=(Math.random()-0.5)*0.002;
    const newVal=t.base*(1+delta);
    const pct=(delta*100).toFixed(2);
    const el=document.getElementById(t.id);
    const del=document.getElementById(t.did);
    if(el)el.textContent=t.fmt(newVal);
    if(del){del.textContent=(delta>=0?'+':'')+pct+'%';del.className='td '+(delta>=0?'up':'dn');}
  });
},3000);

const sensors=[
  ['s1','VaR: KD 2.4M · Concentration: 38% RE · Status: WATCH','VaR: KD 2.1M · Concentration: 36% RE · Status: NORMAL'],
  ['s2','12 instruments screened · 0 non-compliant · Audit logged','8 sukuk screened · 0 non-compliant · Zakat calc updated'],
  ['s3','Auto-generated · 847 portfolios · Filed 09:14 AST','CBK Circular 2/2024 compliance verified · 0 exceptions'],
  ['s4','NAV: KD 84.2M · Yield: 6.8% · Vacancy: 4.2%','NAV: KD 84.6M · Yield: 6.9% · Vacancy: 4.1%'],
  ['s5','Sharia: PASS · Founder: VERIFIED · Score: 7.4/10','Sharia: PASS · Cap table: CLEAN · Score: 7.6/10'],
  ['s6','Memo generated: Arabic + English · Waqf structure reviewed','Family office brief updated · Inheritance law section added'],
];
setInterval(()=>{sensors.forEach(([id,a,b])=>{const el=document.getElementById(id);if(el)el.textContent=Math.random()>0.1?a:b;});},5000);

function ol(){document.getElementById('lm').classList.add('open');}
function cl(){document.getElementById('lm').classList.remove('open');}

function st(n,el){
  document.querySelectorAll('.tc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('tc-'+n).classList.add('on');
  el.classList.add('on');
}

function ss(n,el){
  ['risk','sharia','client','reg','re','pe'].forEach(s=>{
    const el2=document.getElementById('sc-'+s);
    if(el2)el2.style.display='none';
  });
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  const target=document.getElementById('sc-'+n);
  if(target)target.style.display='block';
  el.classList.add('on');
}

// Financial AI adoption chart
new Chart(document.getElementById('adoptC'),{
  type:'line',
  data:{
    labels:['2026','2027','2028','2029','2030','2031','2032','2033','2034','2035'],
    datasets:[
      {label:'Sovereign AI Adoption (%)',data:[5,12,22,35,50,62,72,80,87,92],borderColor:'#22a060',backgroundColor:'rgba(34,160,96,.08)',borderWidth:2,pointRadius:2,fill:true,tension:.3},
      {label:'Foreign Cloud Risk Score',data:[85,82,78,72,65,55,44,35,28,20],borderColor:'#e05050',backgroundColor:'rgba(224,80,80,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.3,borderDash:[4,4]}
    ]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#6a8aaa',font:{size:8},boxWidth:8}}},
    scales:{
      x:{ticks:{color:'#6a8aaa',font:{size:8}},grid:{color:'rgba(26,122,74,.08)'}},
      y:{ticks:{color:'#6a8aaa',font:{size:8},callback:function(v){return v+'%'}},grid:{color:'rgba(26,122,74,.08)'},min:0,max:100}
    }
  }
});

// Asset class chart
new Chart(document.getElementById('assetC'),{
  type:'doughnut',
  data:{
    labels:['Real Estate','Portfolio Mgmt','Islamic Finance','Private Equity','Venture Capital','Other'],
    datasets:[{
      data:[32,28,22,10,5,3],
      backgroundColor:['rgba(201,160,80,.7)','rgba(34,160,96,.7)','rgba(26,122,74,.7)','rgba(201,160,80,.5)','rgba(34,160,96,.4)','rgba(106,138,170,.3)'],
      borderColor:['#c9a050','#22a060','#1a7a4a','#c9a050','#22a060','#6a8aaa'],
      borderWidth:1
    }]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#6a8aaa',font:{size:8},boxWidth:8},position:'right'}}
  }
});

// Cost chart
new Chart(document.getElementById('costC'),{
  type:'line',
  data:{
    labels:['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],
    datasets:[
      {label:'MeshPilot On-Prem ($K)',data:[120,240,360,480,600,720,840,960,1080,1200],borderColor:'#22a060',backgroundColor:'rgba(34,160,96,.08)',borderWidth:2,pointRadius:2,fill:true,tension:.2},
      {label:'Foreign Cloud SaaS ($K)',data:[5800,11600,17400,23200,29000,34800,40600,46400,52200,58000],borderColor:'#e05050',backgroundColor:'rgba(224,80,80,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.2}
    ]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#6a8aaa',font:{size:8},boxWidth:8}}},
    scales:{
      x:{ticks:{color:'#6a8aaa',font:{size:8}},grid:{color:'rgba(26,122,74,.08)'}},
      y:{ticks:{color:'#6a8aaa',font:{size:8},callback:function(v){return '$'+v+'K'}},grid:{color:'rgba(26,122,74,.08)'}}
    }
  }
});
<\/script>
</body>
</html>`;function v(){return a.useEffect(()=>(document.title="UIC — Sovereign Financial Intelligence Command Center",()=>{document.title="AgenThinkMesh"}),[]),i.jsx("div",{"data-loc":"client/src/pages/UicDemo.tsx:598",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:i.jsx("iframe",{"data-loc":"client/src/pages/UicDemo.tsx:599",srcDoc:e,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"UIC Sovereign Financial Intelligence Command Center",sandbox:"allow-scripts"})})}export{v as default};
