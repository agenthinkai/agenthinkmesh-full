import{r as s,j as i}from"./index-CMFS-KMs.js";const e=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alghanim Industries — Sovereign Industrial AI Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{
  --bg:#07090f;--border:rgba(255,255,255,.07);
  --blue:#0a2a5e;--blue-l:#1a4a8e;--blue-b:#2a6abf;--blue-t:#5a9aef;
  --steel:#2a2f3a;--steel-t:#8a9ab0;
  --red:#c0392b;--red-t:#ff6b5b;
  --gold:#d4a017;--gold-l:#f0c040;
  --text:#c8d4e8;--muted:#4a5570;--white:#e8eef8;
  --green:#27ae60;--green-t:#4cd080;--amber:#f39c12;--amber-t:#f5c842;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,#0a2a5e 40%,#c0392b 40%,#c0392b 60%,#d4a017 60%);}
.hdr{background:linear-gradient(135deg,rgba(10,42,94,.5),rgba(42,47,58,.3));border-bottom:1px solid rgba(90,154,239,.2);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:12px;}
.logo{width:48px;height:48px;background:linear-gradient(135deg,#0a2a5e,#1a4a8e);border:1px solid var(--blue-b);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:var(--gold-l);text-align:center;line-height:1.3;}
.htitle{font-size:13px;font-weight:700;color:var(--blue-t);letter-spacing:2px;text-transform:uppercase;}
.hsub{color:var(--muted);font-size:9px;margin-top:2px;letter-spacing:1px;text-transform:uppercase;}
.badge{padding:3px 8px;border-radius:2px;font-size:8px;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;}
.b-kw{background:rgba(192,57,43,.1);border:1px solid var(--red);color:var(--red-t);}
.b-sv{background:rgba(90,154,239,.1);border:1px solid var(--blue-b);color:var(--blue-t);}
.b-zc{background:rgba(39,174,96,.1);border:1px solid var(--green);color:var(--green-t);}
.b-live{background:rgba(90,154,239,.1);border:1px solid var(--blue-t);color:var(--blue-t);}
.b-auto{background:rgba(243,156,18,.1);border:1px solid var(--amber);color:var(--amber-t);}
.b-mfg{background:rgba(90,154,239,.1);border:1px solid var(--blue-b);color:var(--blue-t);}
.b-eng{background:rgba(212,160,23,.1);border:1px solid var(--gold);color:var(--gold-l);}
.b-svc{background:rgba(39,174,96,.1);border:1px solid var(--green);color:var(--green-t);}
.pulse{animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.mbar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:80px;padding:8px 10px;background:var(--bg);}
.m .v{font-size:14px;font-weight:700;color:var(--blue-t);}
.m .v.g{color:var(--green-t);}.m .v.a{color:var(--amber-t);}.m .v.r{color:var(--red-t);}
.m .l{font-size:8px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:14px;overflow-y:auto;max-height:calc(100vh - 140px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-size:9px;font-weight:700;color:var(--blue-t);letter-spacing:3px;text-transform:uppercase;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid rgba(90,154,239,.2);}
.sec{margin-bottom:14px;}
.st{font-size:8px;color:var(--blue-b);text-transform:uppercase;letter-spacing:2px;margin-bottom:7px;}
.body{color:var(--text);line-height:1.8;font-size:11px;opacity:.9;}
.tabs{display:flex;gap:1px;background:var(--border);margin-bottom:10px;overflow-x:auto;}
.tab{padding:6px 11px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;}
.tab.on{color:var(--blue-t);border-bottom:2px solid var(--blue-t);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.03);}
.sl{color:var(--muted);font-size:10px;}.sv{font-weight:600;font-size:10px;}
.blue{color:var(--blue-t);}.red{color:var(--red-t);}.green{color:var(--green-t);}.amber{color:var(--amber-t);}.gold{color:var(--gold-l);}.steel{color:var(--steel-t);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.bl{width:170px;font-size:9px;color:var(--muted);flex-shrink:0;}
.bt{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;}
.bf{height:100%;border-radius:2px;}
.bv{width:70px;text-align:right;font-size:9px;}
.vc{background:rgba(10,42,94,.2);border:1px solid rgba(42,106,191,.2);border-radius:3px;padding:8px;margin-bottom:6px;}
.vc .ag{font-weight:700;font-size:10px;margin-bottom:3px;}
.vc .rt{color:var(--muted);font-size:9px;line-height:1.6;}
.va{border-left:3px solid var(--green-t);}.vco{border-left:3px solid var(--amber-t);}
.tally{display:flex;gap:12px;padding:8px 10px;background:rgba(10,42,94,.2);border:1px solid rgba(42,106,191,.2);border-radius:3px;margin:8px 0;}
.ti{text-align:center;}.ti .n{font-size:18px;font-weight:700;}.ti .l{font-size:8px;color:var(--muted);letter-spacing:1px;}
.judge{background:rgba(90,154,239,.06);border:1px solid rgba(90,154,239,.3);border-radius:3px;padding:9px;margin-top:8px;font-size:10px;line-height:1.7;color:var(--blue-t);}
.bet{background:linear-gradient(135deg,rgba(10,42,94,.3),rgba(192,57,43,.06));border:1px solid rgba(90,154,239,.3);border-radius:4px;padding:11px 13px;margin-bottom:12px;}
.bet .bt2{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;}
.bet .bb{font-size:11px;font-weight:700;line-height:1.6;color:var(--blue-t);}
.tbl{width:100%;border-collapse:collapse;font-size:10px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:8px;padding:4px 5px;border-bottom:1px solid var(--border);text-align:left;}
.tbl td{padding:4px 5px;border-bottom:1px solid rgba(255,255,255,.02);}
.tbl .win{color:var(--green-t);font-weight:700;}.tbl .lose{color:var(--red-t);}.tbl .hl{background:rgba(90,154,239,.05);}
.sav{background:linear-gradient(135deg,rgba(90,154,239,.08),rgba(192,57,43,.06));border:1px solid rgba(90,154,239,.3);border-radius:4px;padding:10px;margin:8px 0;text-align:center;}
.sav .amt{font-size:24px;font-weight:700;color:var(--green-t);}
.sav .lbl{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:1px;}
/* Division map */
.div-map{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0;}
.div-cell{border-radius:3px;padding:8px;font-size:9px;}
.dc-auto{background:rgba(243,156,18,.08);border:1px solid rgba(243,156,18,.25);}
.dc-hvac{background:rgba(90,154,239,.08);border:1px solid rgba(90,154,239,.25);}
.dc-eng{background:rgba(212,160,23,.08);border:1px solid rgba(212,160,23,.25);}
.dc-svc{background:rgba(39,174,96,.08);border:1px solid rgba(39,174,96,.25);}
.dc-title{font-weight:700;margin-bottom:5px;font-size:9px;text-transform:uppercase;letter-spacing:1px;}
.dc-auto .dc-title{color:var(--amber-t);}
.dc-hvac .dc-title{color:var(--blue-t);}
.dc-eng .dc-title{color:var(--gold-l);}
.dc-svc .dc-title{color:var(--green-t);}
.dc-row{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.03);}
.dc-k{color:var(--muted);font-size:8px;}.dc-v{font-size:8px;font-weight:600;}
/* Sensor feed */
.sensor{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(10,42,94,.15);border-left:2px solid var(--blue-b);margin-bottom:3px;}
.sn{font-size:9px;color:var(--blue-t);}.sv2{font-size:9px;color:var(--amber-t);}.ss{font-size:8px;color:var(--muted);}
/* Scenario tabs */
.scen{display:flex;gap:1px;background:var(--border);margin-bottom:10px;overflow-x:auto;}
.sc{flex:1;min-width:65px;padding:5px 7px;cursor:pointer;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);text-align:center;white-space:nowrap;}
.sc.on{color:var(--blue-t);border-bottom:2px solid var(--blue-t);}
.threat{background:rgba(10,42,94,.15);border:1px solid rgba(42,106,191,.15);border-radius:3px;padding:8px;margin-bottom:5px;}
.threat .tn{font-size:10px;font-weight:700;margin-bottom:3px;}
.threat .td{font-size:9px;color:var(--muted);line-height:1.6;}
/* Inf status */
.inf-status{background:rgba(90,154,239,.06);border:1px solid rgba(90,154,239,.3);border-radius:3px;padding:9px;margin:8px 0;text-align:center;}
.inf-status .is{font-size:11px;font-weight:700;color:var(--blue-t);letter-spacing:1px;}
.inf-status .id{font-size:9px;color:var(--muted);margin-top:3px;}
/* Modal */
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100;align-items:center;justify-content:center;}
.modal.open{display:flex;}
.mbox{background:#07090f;border:1px solid var(--blue-b);border-radius:4px;padding:26px 32px;max-width:480px;text-align:center;}
.mbox h2{color:var(--blue-t);font-size:13px;margin-bottom:9px;letter-spacing:2px;text-transform:uppercase;}
.mbox p{color:var(--muted);font-size:11px;line-height:1.7;margin-bottom:9px;}
.mbox .cbtn{background:rgba(90,154,239,.1);border:1px solid var(--blue-b);color:var(--blue-t);padding:6px 18px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;}
.lbtn{display:inline-flex;align-items:center;gap:6px;background:rgba(90,154,239,.1);border:1px solid var(--blue-b);color:var(--blue-t);padding:5px 12px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;}
.cw{position:relative;height:140px;margin-top:7px;}
.milestone{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}
.ms-dot{width:7px;height:7px;border-radius:50%;background:var(--blue-t);margin-top:3px;flex-shrink:0;}
.ms-dot.green{background:var(--green-t);}
.ms-t{font-size:9px;font-weight:700;color:var(--blue-t);}
.ms-d{font-size:8px;color:var(--muted);line-height:1.5;}
.bbar{background:linear-gradient(135deg,rgba(10,42,94,.4),rgba(42,47,58,.3));border-top:1px solid rgba(90,154,239,.15);padding:7px 18px;text-align:center;font-size:9px;color:var(--steel-t);letter-spacing:1px;}
.scan-line{position:fixed;top:0;left:0;right:0;height:2px;background:rgba(90,154,239,.1);animation:scan 10s linear infinite;pointer-events:none;z-index:999;}
@keyframes scan{0%{top:0}100%{top:100vh}}
</style>
</head>
<body>
<div class="scan-line"></div>
<div class="stripe"></div>

<!-- DEPLOY MODAL -->
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>⚡ DEPLOY SOVEREIGN AI ACROSS ALGHANIM DIVISIONS</h2>
    <p>MeshPilot deploys on Alghanim's existing server infrastructure across all four divisions — Automotive (Shuwaikh), HVAC Manufacturing, Engineering project sites, and Industrial Services. No cloud. No data leaves Kuwait.</p>
    <p>Automotive paint line AI, HVAC extrusion quality control, engineering project risk, and SLA management — all running on CPU-only infrastructure inside Alghanim facilities. 3ms inference latency. Zero external API calls.</p>
    <p style="color:var(--blue-t);font-weight:700;font-size:11px">Est. 1932 · Made in Kuwait · Sovereign Operations</p>
    <p style="color:var(--green-t)">Contact: meshpilot@agenthinkmesh.ai</p>
    <br><button class="cbtn" onclick="cl()">CLOSE</button>
  </div>
</div>

<!-- HEADER -->
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">ALGHANIM<br>⚙️<br>1932</div>
    <div>
      <div class="htitle">Alghanim Industries — Sovereign Industrial AI Command Center</div>
      <div class="hsub">Kuwait · Automotive · Engineering · Manufacturing · Industrial Services · Est. 1932</div>
    </div>
  </div>
  <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-auto">🚗 Automotive</span>
    <span class="badge b-mfg">🏭 Manufacturing</span>
    <span class="badge b-eng">🏗️ Engineering</span>
    <span class="badge b-svc">🔧 Industrial Services</span>
    <span class="badge b-kw">🇰🇼 Made in Kuwait</span>
    <span class="badge b-live pulse">● SYSTEM ACTIVE</span>
    <span style="color:var(--muted);font-size:9px" id="clk"></span>
  </div>
</div>

<!-- METRICS BAR -->
<div class="mbar">
  <div class="m"><div class="v a">12,000+</div><div class="l">Vehicles Serviced/yr</div></div>
  <div class="m"><div class="v">847</div><div class="l">HVAC Units/Month</div></div>
  <div class="m"><div class="v">7</div><div class="l">Active Eng. Sites</div></div>
  <div class="m"><div class="v g">12</div><div class="l">MOE Facilities</div></div>
  <div class="m"><div class="v g">99.2%</div><div class="l">SLA Compliance Target</div></div>
  <div class="m"><div class="v">340</div><div class="l">HVAC Sensor Nodes</div></div>
  <div class="m"><div class="v g">100%</div><div class="l">Data Residency</div></div>
  <div class="m"><div class="v g">$56.6M</div><div class="l">10-Year Savings</div></div>
</div>

<div class="grid">

<!-- ═══════════════════════════════════════════════════════════════
     LEFT PANEL — INDUSTRIAL EXECUTIVE TWIN
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">⚙️ Industrial Executive Twin — Alghanim Industries</div>
  <div class="bet">
    <div class="bt2">SOVEREIGN AI MANDATE — 4 DIVISIONS</div>
    <div class="bb">Alghanim Automotive assembly optimisation, HVAC manufacturing quality control, engineering project delivery, and industrial services SLA management — all running on CPU-only infrastructure inside Alghanim facilities. 12,000+ vehicles serviced annually. 847 HVAC units manufactured monthly. Zero production data leaves Kuwait.</div>
  </div>
  <button class="lbtn" onclick="ol()">⚡ Deploy Sovereign AI Across Alghanim — Contact Us</button>

  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Strategic Brief</div>
    <div class="tab" onclick="st('modern',this)">Modernization</div>
    <div class="tab" onclick="st('ops',this)">Operations</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>

  <!-- TAB 1: STRATEGIC BRIEF -->
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief — Alghanim Group Sovereign AI</div>
    <div class="body">Alghanim Industries has operated as Kuwait's leading industrial conglomerate since 1932. Its four divisions — Automotive, Engineering, Manufacturing, and Industrial Services — generate operational data that is currently at risk of foreign cloud exposure.<br><br><strong style="color:var(--amber-t)">Automotive Division:</strong> Distributes GM, Chevrolet, Cadillac, GMC, and ACDelco across Kuwait. Operates vehicle assembly, after-sales service, and a spare parts network of 4,200 SKUs across 12 service centres. Paint line rework currently at 4.2% — AI-driven optimisation targets 1.1%.<br><br><strong style="color:var(--blue-t)">Manufacturing Division (HVAC):</strong> Produces HVAC systems, insulation materials, building products, and metal fabrication. Extrusion line #3 runs 340 sensor nodes. 847 units/month target. Thickness variance detection at 97.1% accuracy on-prem.<br><br><strong style="color:var(--gold-l)">Engineering Division:</strong> Executes construction, infrastructure, oil &amp; gas, and MEP contracting across Kuwait. 7 active sites, 142 heavy equipment units at 89% utilisation. KOC pipeline project bids require subcontractor default prediction — currently done manually.<br><br><strong style="color:var(--green-t)">Industrial Services Division:</strong> Manages 12 Ministry of Electricity facilities under contract. 34 technician vehicles. 99.2% SLA compliance target. Dispatch optimisation and predictive maintenance for MOE assets.<br><br><strong style="color:var(--blue-t)">The AI challenge:</strong> Every cloud AI vendor routes Alghanim's production telemetry, vehicle service records, and engineering project data to foreign servers. MeshPilot runs on Alghanim's existing server racks. No data leaves Kuwait.</div>
    <div style="margin-top:10px">
      <div class="sr"><div class="sl">Automotive — Paint Line Rework (current)</div><div class="sv red">4.2%</div></div>
      <div class="sr"><div class="sl">Automotive — Paint Line Rework (AI target)</div><div class="sv green">1.1%</div></div>
      <div class="sr"><div class="sl">HVAC — Monthly Production Target</div><div class="sv blue">847 units</div></div>
      <div class="sr"><div class="sl">HVAC — Extrusion Sensor Nodes</div><div class="sv">340 nodes (line #3)</div></div>
      <div class="sr"><div class="sl">Engineering — Active Project Sites</div><div class="sv gold">7 sites</div></div>
      <div class="sr"><div class="sl">Engineering — Heavy Equipment Utilisation</div><div class="sv amber">89%</div></div>
      <div class="sr"><div class="sl">Services — MOE Facilities Under Contract</div><div class="sv green">12 facilities</div></div>
      <div class="sr"><div class="sl">Services — SLA Compliance Target</div><div class="sv green">99.2%</div></div>
      <div class="sr"><div class="sl">Spare Parts SKUs (Automotive)</div><div class="sv">4,200 SKUs / 12 centres</div></div>
      <div class="sr"><div class="sl">Data Residency (MeshPilot)</div><div class="sv green">100% Kuwait</div></div>
    </div>
  </div>

  <!-- TAB 2: INDUSTRIAL MODERNIZATION -->
  <div class="tc" id="tc-modern">
    <div class="st">Kuwait Vision 2035 — Alghanim's Industrial Localisation Role</div>
    <div class="body" style="margin-bottom:10px">Alghanim Industries is not a passive beneficiary of Vision 2035 — it is an active localisation engine. The group's four divisions directly advance Kuwait's industrial capacity targets: local vehicle assembly, domestic HVAC manufacturing, Kuwaiti engineering contracting, and national facility management. Sovereign AI is the next localisation frontier.</div>
    <div class="sr"><div class="sl">Automotive After-Sales Revenue (est.)</div><div class="sv blue">KD 45–65M/yr (industry est.)</div></div>
    <div class="sr"><div class="sl">HVAC Market Share — Kuwait</div><div class="sv blue">Leading domestic manufacturer</div></div>
    <div class="sr"><div class="sl">Engineering Backlog Value</div><div class="sv gold">KD 120–180M (active contracts)</div></div>
    <div class="sr"><div class="sl">Industrial Services Contract Renewal Rate</div><div class="sv green">~85% (MOE, MEW, government)</div></div>
    <div class="sr"><div class="sl">Vision 2035 — Industrial Localisation Target</div><div class="sv blue">25% GDP from private sector</div></div>
    <div class="sr"><div class="sl">Alghanim Contribution — Local Manufacturing</div><div class="sv green">HVAC + insulation + metal fab</div></div>
    <div class="sr"><div class="sl">Alghanim Contribution — Local Assembly</div><div class="sv amber">GM/Chevrolet/Cadillac/GMC</div></div>
    <div style="margin-top:10px"><div class="st">Alghanim Division Performance Trajectory (Indexed, 2022–2028)</div><div class="cw"><canvas id="modC"></canvas></div></div>
    <div class="body" style="margin-top:8px;font-size:9px;color:var(--muted)">Source: Public Alghanim corporate disclosures, Kuwait automotive market reports, GCC HVAC industry data. Indexed to 2022 = 100. Projections based on Vision 2035 industrial growth targets.</div>
  </div>

  <!-- TAB 3: OPERATIONS SCENARIOS -->
  <div class="tc" id="tc-ops">
    <div class="st">Operations Scenarios — Division-Specific AI Use Cases</div>
    <div class="scen">
      <div class="sc on" onclick="ss('paint',this)">Paint Line</div>
      <div class="sc" onclick="ss('hvac',this)">HVAC QC</div>
      <div class="sc" onclick="ss('eng',this)">Eng. Risk</div>
      <div class="sc" onclick="ss('parts',this)">Spare Parts</div>
      <div class="sc" onclick="ss('sla',this)">SLA Mgmt</div>
      <div class="sc" onclick="ss('energy',this)">Energy</div>
    </div>

    <div id="sc-paint" class="threat" style="border-left:3px solid var(--amber-t);display:block">
      <div class="tn amber">🚗 Automotive Paint Line Optimisation — Shuwaikh Assembly</div>
      <div class="td">Predictive maintenance for spray booths on the Shuwaikh vehicle assembly line. Current rework rate: 4.2% (industry benchmark: 2–3%). MeshPilot ingests booth temperature, viscosity, spray pressure, and conveyor speed telemetry in real time. 5,000 simulated paint line episodes. AI target: 1.1% rework rate — saving KD 1.2M/year in rework labour and materials. All vehicle production data stays inside Alghanim Shuwaikh facility. Zero cloud egress.</div>
    </div>
    <div id="sc-hvac" class="threat" style="border-left:3px solid var(--blue-t);display:none">
      <div class="tn blue">🏭 HVAC Extrusion Quality Control — Insulation Line #3</div>
      <div class="td">Computer vision defect detection on insulation rolls from extrusion line #3. 340 sensor nodes monitor thickness variance, surface defects, and dimensional tolerances. 3,500 simulated extrusion episodes. 97.1% thickness variance detection accuracy. 0.3% false positive rate. Target: reduce insulation defect rate from 2.8% to 0.7%, saving KD 890K/year in material waste and rework. All HVAC production imagery processed on-prem — no product data leaves the manufacturing plant.</div>
    </div>
    <div id="sc-eng" class="threat" style="border-left:3px solid var(--gold-l);display:none">
      <div class="tn gold">🏗️ Engineering Project Risk — KOC Pipeline &amp; Active Sites</div>
      <div class="td">KOC pipeline project bid optimisation, subcontractor default prediction, and resource allocation across 7 active sites. 142 heavy equipment units at 89% utilisation — MeshPilot models equipment failure probability and cross-site reallocation. 2,800 simulated project risk episodes. 88.4% subcontractor default prediction accuracy. Target: 18% reduction in cost overruns, saving KD 2.4M/year across active engineering contracts. All project financial and operational data computed on-prem — no contract data leaves Kuwait.</div>
    </div>
    <div id="sc-parts" class="threat" style="border-left:3px solid var(--steel-t);display:none">
      <div class="tn steel">🔩 Spare Parts Inventory Twin — ACDelco &amp; GM Parts Network</div>
      <div class="td">Demand forecasting for ACDelco, GM, Chevrolet, Cadillac, and GMC spare parts across 12 Alghanim service centres. 4,200 active SKUs. Current stockout rate: 8.3%. MeshPilot models seasonal demand, vehicle age distribution, and service centre throughput. 4,200 simulated demand episodes. Target: 23% reduction in stockouts, reducing emergency procurement costs by KD 340K/year. All customer vehicle service records and parts demand data stays inside Alghanim systems.</div>
    </div>
    <div id="sc-sla" class="threat" style="border-left:3px solid var(--green-t);display:none">
      <div class="tn green">🔧 Industrial Services SLA — Ministry of Electricity Contract</div>
      <div class="td">Facility management for 12 Ministry of Electricity (MOE) facilities under Alghanim Industrial Services contract. 34 technician vehicles. 99.2% SLA compliance target. MeshPilot optimises technician dispatch routing, predicts equipment failure at MOE sites, and models SLA risk before breach. 4,200 simulated dispatch episodes. 94.7% SLA compliance prediction accuracy. 21% fuel reduction through route optimisation. Target: avoid KD 560K/year in SLA penalty exposure. All MOE facility data processed on-prem.</div>
    </div>
    <div id="sc-energy" class="threat" style="border-left:3px solid var(--gold-l);display:none">
      <div class="tn gold">⚡ Energy Optimisation — 3 Manufacturing Plants</div>
      <div class="td">Smart factory power management across Alghanim's 3 manufacturing plants (HVAC, insulation, metal fabrication). AI-driven load scheduling, HVAC system self-optimisation, and peak demand avoidance. 12% energy efficiency gain target. Estimated annual saving: KD 180,000 across active production facilities. All energy management decisions computed locally — no utility consumption data leaves Alghanim facilities. Compliant with Kuwait MEW energy efficiency guidelines.</div>
    </div>
  </div>

  <!-- TAB 4: RECOMMENDATION -->
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation — Deploy Across All 4 Alghanim Divisions</div>
    <div class="body" style="margin-bottom:10px">Deploy MeshPilot sovereign industrial AI across Alghanim's 4 divisions: Automotive (Shuwaikh assembly + 12 service centres), Manufacturing (HVAC plant + extrusion line #3), Engineering (7 active project sites), and Industrial Services (12 MOE facilities). Phase 1: paint line + HVAC QC. Phase 2: engineering risk + spare parts. Phase 3: full group deployment.</div>
    <div class="vc va"><div class="ag" style="color:var(--amber-t)">✅ Automotive Director — APPROVE</div><div class="rt">Paint line rework reduction from 4.2% to 1.1% is operationally validated. Spare parts demand forecasting across 12 service centres eliminates emergency procurement. All vehicle service data stays inside Alghanim Shuwaikh. No customer data leaves Kuwait.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--blue-t)">✅ Manufacturing Director — APPROVE</div><div class="rt">HVAC extrusion quality control on line #3 addresses the primary source of material waste. 340 sensor nodes already installed — MeshPilot inference runs on existing server racks. No new hardware required. 97.1% defect detection accuracy exceeds current manual inspection rate.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--gold-l)">✅ Engineering Director — APPROVE</div><div class="rt">Subcontractor default prediction and resource allocation across 7 active sites addresses the highest-risk cost driver. KOC pipeline project bids currently rely on manual risk assessment. 88.4% default prediction accuracy provides material competitive advantage in bid pricing.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Services Director — APPROVE</div><div class="rt">MOE contract SLA compliance at 99.2% requires predictive dispatch — reactive maintenance is insufficient. 21% fuel reduction through route optimisation is a direct margin improvement. All MOE facility data processed on-prem satisfies government data localisation requirements.</div></div>
    <div class="vc vco"><div class="ag" style="color:var(--amber-t)">⚠️ Group CFO — CONDITIONAL</div><div class="rt">Approve conditional on: (1) phased deployment starting with highest-ROI use cases (paint line + HVAC QC), (2) server capacity audit across all 4 division facilities, (3) formal data governance policy for cross-division AI inference. $56.6M 10-year savings justifies immediate Phase 1 investment.</div></div>
    <div class="tally">
      <div class="ti"><div class="n green">4</div><div class="l">APPROVE</div></div>
      <div class="ti"><div class="n amber">1</div><div class="l">CONDITIONAL</div></div>
      <div class="ti"><div class="n red">0</div><div class="l">REJECT</div></div>
    </div>
    <div class="judge"><strong>JUDGE — IMMEDIATE PILOT AUTHORISED:</strong> Alghanim's 90-year industrial leadership requires sovereign AI. Foreign cloud dependency is unacceptable for a Kuwaiti national champion. Deploy MeshPilot across Automotive (Shuwaikh) and Manufacturing (HVAC plant) immediately. Engineering and Services to follow in Phase 2. Every dinar saved on cloud dependency is reinvested in Alghanim's Kuwaiti manufacturing capacity. Sovereignty is margin.</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     CENTRE PANEL — INDUSTRIAL SIMULATION HUB
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">🏭 Industrial Simulation Hub — Alghanim Division Map</div>

  <div class="sec">
    <div class="st">Alghanim Group — Division Operations Layout</div>
    <div class="div-map">
      <!-- AUTOMOTIVE -->
      <div class="div-cell dc-auto">
        <div class="dc-title">🚗 Automotive — Shuwaikh</div>
        <div class="dc-row"><div class="dc-k">Assembly Bays</div><div class="dc-v amber">3 active</div></div>
        <div class="dc-row"><div class="dc-k">Service Lifts</div><div class="dc-v amber">12 lifts</div></div>
        <div class="dc-row"><div class="dc-k">Paint Booths</div><div class="dc-v">4 booths</div></div>
        <div class="dc-row"><div class="dc-k">Spare Parts SKUs</div><div class="dc-v">4,200 SKUs</div></div>
        <div class="dc-row"><div class="dc-k">Service Centres</div><div class="dc-v amber">12 centres</div></div>
        <div class="dc-row"><div class="dc-k">Vehicles Serviced/yr</div><div class="dc-v amber">12,000+</div></div>
        <div class="dc-row"><div class="dc-k">Paint Rework (current)</div><div class="dc-v" style="color:var(--red-t)">4.2%</div></div>
        <div class="dc-row"><div class="dc-k">Paint Rework (AI target)</div><div class="dc-v" style="color:var(--green-t)">1.1%</div></div>
      </div>
      <!-- HVAC MANUFACTURING -->
      <div class="div-cell dc-hvac">
        <div class="dc-title">🏭 HVAC Manufacturing</div>
        <div class="dc-row"><div class="dc-k">Extrusion Lines</div><div class="dc-v blue">2 lines</div></div>
        <div class="dc-row"><div class="dc-k">Cutting Stations</div><div class="dc-v">1 station</div></div>
        <div class="dc-row"><div class="dc-k">Sensor Nodes (Line #3)</div><div class="dc-v blue">340 nodes</div></div>
        <div class="dc-row"><div class="dc-k">Monthly Production</div><div class="dc-v blue">847 units</div></div>
        <div class="dc-row"><div class="dc-k">Product Lines</div><div class="dc-v">HVAC, insulation, metal fab</div></div>
        <div class="dc-row"><div class="dc-k">Defect Rate (current)</div><div class="dc-v" style="color:var(--red-t)">2.8%</div></div>
        <div class="dc-row"><div class="dc-k">Defect Rate (AI target)</div><div class="dc-v" style="color:var(--green-t)">0.7%</div></div>
        <div class="dc-row"><div class="dc-k">Inference Latency</div><div class="dc-v" style="color:var(--green-t)">3ms on-prem</div></div>
      </div>
      <!-- ENGINEERING -->
      <div class="div-cell dc-eng">
        <div class="dc-title">🏗️ Engineering — Active Sites</div>
        <div class="dc-row"><div class="dc-k">Active Project Sites</div><div class="dc-v gold">7 sites</div></div>
        <div class="dc-row"><div class="dc-k">Heavy Equipment</div><div class="dc-v gold">142 units</div></div>
        <div class="dc-row"><div class="dc-k">Equipment Utilisation</div><div class="dc-v amber">89%</div></div>
        <div class="dc-row"><div class="dc-k">Sectors</div><div class="dc-v">Construction, O&amp;G, MEP</div></div>
        <div class="dc-row"><div class="dc-k">Key Contract</div><div class="dc-v gold">KOC Pipeline</div></div>
        <div class="dc-row"><div class="dc-k">Cost Overrun Risk</div><div class="dc-v" style="color:var(--red-t)">Manual assessment</div></div>
        <div class="dc-row"><div class="dc-k">AI Default Prediction</div><div class="dc-v" style="color:var(--green-t)">88.4% accuracy</div></div>
        <div class="dc-row"><div class="dc-k">Overrun Reduction</div><div class="dc-v" style="color:var(--green-t)">18% target</div></div>
      </div>
      <!-- INDUSTRIAL SERVICES -->
      <div class="div-cell dc-svc">
        <div class="dc-title">🔧 Industrial Services</div>
        <div class="dc-row"><div class="dc-k">MOE Facilities</div><div class="dc-v green">12 under contract</div></div>
        <div class="dc-row"><div class="dc-k">Technician Vehicles</div><div class="dc-v green">34 vehicles</div></div>
        <div class="dc-row"><div class="dc-k">SLA Target</div><div class="dc-v green">99.2%</div></div>
        <div class="dc-row"><div class="dc-k">Services</div><div class="dc-v">Facility mgmt, energy, water</div></div>
        <div class="dc-row"><div class="dc-k">Dispatch Mode</div><div class="dc-v" style="color:var(--red-t)">Reactive (current)</div></div>
        <div class="dc-row"><div class="dc-k">AI Dispatch Mode</div><div class="dc-v" style="color:var(--green-t)">Predictive (MeshPilot)</div></div>
        <div class="dc-row"><div class="dc-k">Fuel Reduction</div><div class="dc-v" style="color:var(--green-t)">21% target</div></div>
        <div class="dc-row"><div class="dc-k">SLA Prediction Accuracy</div><div class="dc-v" style="color:var(--green-t)">94.7%</div></div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="st">Training Metrics — Mesh Twin (Division-Specific Episodes)</div>
    <div class="br"><div class="bl">Automotive: Paint Line Defect Prediction</div><div class="bt"><div class="bf" style="width:96%;background:var(--amber-t)"></div></div><div class="bv amber">96.2%</div></div>
    <div class="br"><div class="bl">HVAC: Thickness Variance Detection</div><div class="bt"><div class="bf" style="width:97%;background:var(--blue-t)"></div></div><div class="bv blue">97.1%</div></div>
    <div class="br"><div class="bl">Engineering: Subcontractor Default</div><div class="bt"><div class="bf" style="width:88%;background:var(--gold-l)"></div></div><div class="bv gold">88.4%</div></div>
    <div class="br"><div class="bl">Services: SLA Compliance Prediction</div><div class="bt"><div class="bf" style="width:95%;background:var(--green-t)"></div></div><div class="bv green">94.7%</div></div>
    <div class="br"><div class="bl">Spare Parts: Demand Forecast Accuracy</div><div class="bt"><div class="bf" style="width:91%;background:var(--blue-t)"></div></div><div class="bv blue">91.3%</div></div>
    <div class="br"><div class="bl">HVAC: False Positive Rate</div><div class="bt"><div class="bf" style="width:3%;background:var(--green-t)"></div></div><div class="bv green">0.3%</div></div>
  </div>

  <div class="sec">
    <div class="st">Live Sensor Feed — HVAC Extrusion Line #3 + Automotive</div>
    <div class="sensor"><span class="sn">HVAC Extrusion #3 — Thickness</span><span class="sv2" id="s1">NORMAL — 42.1mm / ±0.3mm</span><span class="ss">ON-PREM</span></div>
    <div class="sensor"><span class="sn">HVAC Extrusion #3 — Temperature</span><span class="sv2" id="s2">NORMAL — 185°C / Δ+1.2°C</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Paint Booth #2 — Spray Pressure</span><span class="sv2" id="s3">NORMAL — 2.8 bar / ±0.05</span><span class="ss">ON-PREM</span></div>
    <div class="sensor"><span class="sn">Paint Booth #2 — Viscosity</span><span class="sv2" id="s4">NORMAL — 18 DIN / ±0.4</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">MOE Facility #4 — Chiller</span><span class="sv2" id="s5">NORMAL — 6.2°C supply / 12.1°C return</span><span class="ss">SOVEREIGN</span></div>
    <div class="sensor"><span class="sn">Engineering Site 3 — Crane Load</span><span class="sv2" id="s6">ACTIVE — 14.2T / 18T SWL</span><span class="ss">ON-PREM</span></div>
  </div>

  <div class="inf-status">
    <div class="is pulse">⚡ MeshPilot CPU Active — On-Prem — 3ms Latency — All 4 Divisions</div>
    <div class="id">Automotive (Shuwaikh) · HVAC Plant · 7 Engineering Sites · 12 MOE Facilities · Zero cloud API calls · 100% Kuwait data residency</div>
  </div>

  <div class="sec">
    <div class="st">Division AI Savings — Annual Breakdown</div>
    <div class="cw" style="height:130px"><canvas id="savingsC"></canvas></div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     RIGHT PANEL — ROI + SOVEREIGNTY CALCULATOR
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">💰 Sovereignty Calculator — Alghanim Group Kuwait Operations</div>
  <div class="bet">
    <div class="bt2">THE SOVEREIGNTY EQUATION — ALGHANIM GROUP</div>
    <div class="bb">Every dinar saved on cloud dependency is reinvested in Alghanim's Kuwaiti manufacturing capacity. Sovereignty is margin. MeshPilot on existing server racks: $1.4M over 10 years. Foreign cloud GPU: $58M over 10 years. The $56.6M difference funds Alghanim's next industrial expansion.</div>
  </div>

  <div class="sec">
    <div class="st">Alghanim-Specific Operational Savings — Annual</div>
    <table class="tbl">
      <thead><tr><th>Division / Use Case</th><th>Saving/Year</th><th>Source</th></tr></thead>
      <tbody>
        <tr><td>Automotive — Paint Line Rework (4.2%→1.1%)</td><td class="win">KD 1,200,000</td><td>Labour + materials</td></tr>
        <tr><td>HVAC — Extrusion Defect Reduction (2.8%→0.7%)</td><td class="win">KD 890,000</td><td>Material waste</td></tr>
        <tr><td>Engineering — Cost Overrun Prevention (18%)</td><td class="win">KD 2,400,000</td><td>Project overruns</td></tr>
        <tr><td>Services — SLA Penalty Avoidance (MOE)</td><td class="win">KD 560,000</td><td>Penalty clauses</td></tr>
        <tr><td>Spare Parts — Stockout Reduction (23%)</td><td class="win">KD 340,000</td><td>Emergency procurement</td></tr>
        <tr><td>Energy — 3 Plants (12% reduction)</td><td class="win">KD 180,000</td><td>Utility bills</td></tr>
        <tr class="hl"><td><strong>Total Annual Operational Savings</strong></td><td class="win"><strong>KD 5,570,000</strong></td><td><strong>~$18.2M/yr</strong></td></tr>
      </tbody>
    </table>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Infrastructure Cost — On-Prem CPU vs Foreign Cloud GPU (10-Year)</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th>MeshPilot On-Prem</th><th>Foreign Cloud GPU</th></tr></thead>
      <tbody>
        <tr><td>Cost per 1M Predictions</td><td class="win">$8,000</td><td class="lose">$320,000</td></tr>
        <tr><td>Annual Predictions (4 divisions)</td><td class="win">50M+</td><td class="lose">50M+</td></tr>
        <tr><td>Annual Inference Cost</td><td class="win">$400,000</td><td class="lose">$16,000,000</td></tr>
        <tr><td>Kuwaiti Data Residency</td><td class="win">100%</td><td class="lose">0% (foreign servers)</td></tr>
        <tr><td>Inference Latency</td><td class="win">3ms on-prem</td><td class="lose">80–200ms + network</td></tr>
        <tr><td>Cloud Lock-in Risk</td><td class="win">ZERO</td><td class="lose">HIGH</td></tr>
        <tr><td>Hardware Capex (10yr)</td><td>$1,400,000</td><td class="lose">$0 (OPEX trap)</td></tr>
        <tr class="hl"><td><strong>10-Year Infrastructure Cost</strong></td><td class="win"><strong>$1,400,000</strong></td><td class="lose"><strong>$58,000,000</strong></td></tr>
        <tr><td>Sovereignty Status</td><td class="win">SOVEREIGN ✓</td><td class="lose">NON-SOVEREIGN ✗</td></tr>
      </tbody>
    </table>
  </div>

  <div class="sav">
    <div class="amt">$56.6M</div>
    <div class="lbl">10-Year Infrastructure Savings · 41× Cheaper · + KD 5.57M/yr Operational Gains · Kuwait Sovereign</div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">10-Year Cumulative Cost — Infrastructure Only</div>
    <div class="cw" style="height:130px"><canvas id="costC"></canvas></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Sovereignty Metrics — Alghanim Group Requirements</div>
    <div class="br"><div class="bl">Vehicle Service Data Residency</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">CRITICAL</div></div>
    <div class="br"><div class="bl">HVAC Production Data Egress</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">PROHIBITED</div></div>
    <div class="br"><div class="bl">MOE Facility Data (Government)</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">MANDATED LOCAL</div></div>
    <div class="br"><div class="bl">Engineering Contract Data</div><div class="bt"><div class="bf" style="width:90%;background:var(--amber-t)"></div></div><div class="bv amber">HIGH RISK (cloud)</div></div>
    <div class="br"><div class="bl">Existing Server Infrastructure</div><div class="bt"><div class="bf" style="width:95%;background:var(--green-t)"></div></div><div class="bv green">AVAILABLE ✓</div></div>
    <div class="br"><div class="bl">MeshPilot On-Prem Compliance</div><div class="bt"><div class="bf" style="width:100%;background:var(--green-t)"></div></div><div class="bv green">NATIVE ✓</div></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Deployment Milestones — Alghanim Group Rollout</div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Month 1 — Infrastructure Audit (All 4 Divisions)</div><div class="ms-d">Server capacity audit at Shuwaikh (Automotive), HVAC plant, 7 engineering sites, MOE facilities. No new hardware required for Phase 1.</div></div></div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Month 3 — Phase 1: Paint Line + HVAC QC</div><div class="ms-d">MeshPilot on Automotive paint booths + HVAC extrusion line #3. 340 sensor nodes active. Paint rework baseline established. KD 2.09M/yr savings unlocked.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div><div class="ms-t">Month 6 — Phase 2: Engineering + Spare Parts</div><div class="ms-d">Engineering project risk AI across 7 sites. Spare parts demand forecasting across 12 service centres. KD 2.74M/yr additional savings.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div><div class="ms-t">Month 9 — Phase 3: Industrial Services + Energy</div><div class="ms-d">MOE facility dispatch optimisation. Energy management across 3 plants. Full group deployment. KD 5.57M/yr total operational savings.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div><div class="ms-t">Year 3 — Full Group Sovereign AI Stack</div><div class="ms-d">All 4 divisions running sovereign AI on existing infrastructure. $30M cumulative infrastructure savings vs cloud. 100% Kuwaiti data residency.</div></div></div>
  </div>

  <div style="margin-top:8px;text-align:center;font-size:9px;color:var(--muted)">Alghanim Industries · Est. 1932 · Kuwait · Automotive · Engineering · Manufacturing · Industrial Services<br><strong style="color:var(--blue-t)">Sovereignty is margin · agenthinkmesh.ai/alghanim-industrial-demo</strong></div>
</div>

</div>

<div class="bbar">All AI runs on existing CPU infrastructure inside Alghanim facilities — Shuwaikh Automotive · HVAC Plant · Engineering Sites · MOE Facilities. No data leaves Kuwait. &nbsp;·&nbsp; <strong style="color:var(--blue-t)">Est. 1932 · Made in Kuwait · Sovereign Operations</strong></div>

<script>
// Clock
setInterval(()=>{const el=document.getElementById('clk');if(el)el.textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);

// Sensor animation — realistic Alghanim-specific readings
const sensors=[
  ['s1','NORMAL — 42.1mm / ±0.3mm','ALERT — 41.4mm / ±0.9mm (variance threshold)'],
  ['s2','NORMAL — 185°C / Δ+1.2°C','NORMAL — 188°C / Δ+3.1°C'],
  ['s3','NORMAL — 2.8 bar / ±0.05','NORMAL — 2.7 bar / ±0.08'],
  ['s4','NORMAL — 18 DIN / ±0.4','NORMAL — 18.3 DIN / ±0.6'],
  ['s5','NORMAL — 6.2°C supply / 12.1°C return','NORMAL — 6.5°C supply / 12.4°C return'],
  ['s6','ACTIVE — 14.2T / 18T SWL','ACTIVE — 16.1T / 18T SWL'],
];
setInterval(()=>{sensors.forEach(([id,a,b])=>{const el=document.getElementById(id);if(el)el.textContent=Math.random()>0.08?a:b;});},3800);

// Modal
function ol(){document.getElementById('lm').classList.add('open');}
function cl(){document.getElementById('lm').classList.remove('open');}

// Tab switching
function st(n,el){
  document.querySelectorAll('.tc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('tc-'+n).classList.add('on');
  el.classList.add('on');
}

// Scenario switching
function ss(n,el){
  ['paint','hvac','eng','parts','sla','energy'].forEach(s=>{
    const el2=document.getElementById('sc-'+s);
    if(el2)el2.style.display='none';
  });
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  const target=document.getElementById('sc-'+n);
  if(target)target.style.display='block';
  el.classList.add('on');
}

// Division performance trajectory chart
new Chart(document.getElementById('modC'),{
  type:'line',
  data:{
    labels:['2022','2023','2024','2025','2026','2027','2028'],
    datasets:[
      {label:'Automotive After-Sales',data:[100,104,108,113,119,126,134],borderColor:'#f5c842',backgroundColor:'rgba(245,200,66,.06)',borderWidth:2,pointRadius:2,fill:false,tension:.3},
      {label:'HVAC Manufacturing',data:[100,106,112,119,127,136,146],borderColor:'#5a9aef',backgroundColor:'rgba(90,154,239,.06)',borderWidth:2,pointRadius:2,fill:false,tension:.3},
      {label:'Engineering Backlog',data:[100,108,115,124,134,145,157],borderColor:'#f0c040',backgroundColor:'rgba(240,192,64,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.3},
      {label:'Industrial Services',data:[100,103,107,112,118,125,133],borderColor:'#4cd080',backgroundColor:'rgba(76,208,128,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.3},
    ]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#4a5570',font:{size:8},boxWidth:8}}},
    scales:{
      x:{ticks:{color:'#4a5570',font:{size:8}},grid:{color:'rgba(255,255,255,.03)'}},
      y:{ticks:{color:'#4a5570',font:{size:8},callback:v=>v+''},grid:{color:'rgba(255,255,255,.03)'},title:{display:true,text:'Index (2022=100)',color:'#4a5570',font:{size:8}}}
    }
  }
});

// Annual savings by division
new Chart(document.getElementById('savingsC'),{
  type:'bar',
  data:{
    labels:['Auto Paint Line','HVAC Defects','Eng. Overruns','SLA Penalties','Spare Parts','Energy'],
    datasets:[{
      label:'Annual Savings (KD)',
      data:[1200000,890000,2400000,560000,340000,180000],
      backgroundColor:['rgba(245,200,66,.5)','rgba(90,154,239,.5)','rgba(240,192,64,.5)','rgba(76,208,128,.5)','rgba(138,154,176,.5)','rgba(240,192,64,.4)'],
      borderColor:['#f5c842','#5a9aef','#f0c040','#4cd080','#8a9ab0','#f0c040'],
      borderWidth:1,borderRadius:2
    }]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{
      x:{ticks:{color:'#4a5570',font:{size:8}},grid:{color:'rgba(255,255,255,.03)'}},
      y:{ticks:{color:'#4a5570',font:{size:8},callback:v=>'KD '+(v/1000)+'K'},grid:{color:'rgba(255,255,255,.03)'}}
    }
  }
});

// 10-year cost trajectory
new Chart(document.getElementById('costC'),{
  type:'line',
  data:{
    labels:['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],
    datasets:[
      {label:'MeshPilot On-Prem ($M)',data:[0.14,0.28,0.42,0.56,0.70,0.84,0.98,1.12,1.26,1.40],borderColor:'#5a9aef',backgroundColor:'rgba(90,154,239,.08)',borderWidth:2,pointRadius:2,fill:true,tension:.2},
      {label:'Foreign Cloud GPU ($M)',data:[5.8,11.6,17.4,23.2,29.0,34.8,40.6,46.4,52.2,58.0],borderColor:'#e74c3c',backgroundColor:'rgba(231,76,60,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.2}
    ]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#4a5570',font:{size:8},boxWidth:8}}},
    scales:{
      x:{ticks:{color:'#4a5570',font:{size:8}},grid:{color:'rgba(255,255,255,.03)'}},
      y:{ticks:{color:'#4a5570',font:{size:8},callback:v=>'$'+v+'M'},grid:{color:'rgba(255,255,255,.03)'}}
    }
  }
});
<\/script>
</body>
</html>`;function t(){return s.useEffect(()=>(document.title="Alghanim Industries — Sovereign Industrial AI Command Center",()=>{document.title="AgenThinkMesh"}),[]),i.jsx("div",{"data-loc":"client/src/pages/AlghanimIndustrialDemo.tsx:569",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:i.jsx("iframe",{"data-loc":"client/src/pages/AlghanimIndustrialDemo.tsx:570",srcDoc:e,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"Alghanim Industries Sovereign Industrial AI Command Center",sandbox:"allow-scripts"})})}export{t as default};
