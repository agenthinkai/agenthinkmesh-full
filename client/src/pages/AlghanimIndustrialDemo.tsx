import { useEffect } from "react";

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alghanim Industries — Sovereign Industrial AI Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{
  --bg:#07090f;--surface:rgba(255,255,255,.04);--border:rgba(255,255,255,.07);
  --blue:#0a2a5e;--blue-l:#1a4a8e;--blue-b:#2a6abf;--blue-t:#5a9aef;
  --steel:#2a2f3a;--steel-l:#3a4050;--steel-t:#8a9ab0;
  --red:#c0392b;--red-l:#e74c3c;--red-t:#ff6b5b;
  --gold:#d4a017;--gold-l:#f0c040;
  --text:#c8d4e8;--muted:#4a5570;--white:#e8eef8;
  --green:#27ae60;--green-t:#4cd080;--amber:#f39c12;--amber-t:#f5c842;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,#0a2a5e 40%,#c0392b 40%,#c0392b 60%,#d4a017 60%);}
.hdr{background:linear-gradient(135deg,rgba(10,42,94,.5),rgba(42,47,58,.3));border-bottom:1px solid rgba(90,154,239,.2);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:14px;}
.logo{width:50px;height:50px;background:linear-gradient(135deg,#0a2a5e,#1a4a8e);border:1px solid var(--blue-b);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;color:var(--gold-l);letter-spacing:0;text-align:center;line-height:1.3;}
.htitle{font-size:14px;font-weight:700;color:var(--blue-t);letter-spacing:2px;text-transform:uppercase;}
.hsub{color:var(--muted);font-size:9px;margin-top:2px;letter-spacing:1px;text-transform:uppercase;}
.badge{padding:3px 9px;border-radius:2px;font-size:9px;letter-spacing:1px;text-transform:uppercase;}
.b-kw{background:rgba(192,57,43,.1);border:1px solid var(--red);color:var(--red-t);}
.b-sv{background:rgba(90,154,239,.1);border:1px solid var(--blue-b);color:var(--blue-t);}
.b-zc{background:rgba(39,174,96,.1);border:1px solid var(--green);color:var(--green-t);}
.b-live{background:rgba(90,154,239,.1);border:1px solid var(--blue-t);color:var(--blue-t);}
.pulse{animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.mbar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:85px;padding:9px 12px;background:var(--bg);}
.m .v{font-size:15px;font-weight:700;color:var(--blue-t);}
.m .v.r{color:var(--red-t);}.m .v.g{color:var(--green-t);}.m .v.a{color:var(--amber-t);}.m .v.w{color:var(--white);}
.m .l{font-size:8px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:16px;overflow-y:auto;max-height:calc(100vh - 142px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-size:9px;font-weight:700;color:var(--blue-t);letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(90,154,239,.2);}
.sec{margin-bottom:16px;}
.st{font-size:8px;color:var(--blue-b);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;}
.body{color:var(--text);line-height:1.8;font-size:11px;opacity:.9;}
.tabs{display:flex;gap:1px;background:var(--border);margin-bottom:12px;overflow-x:auto;}
.tab{padding:6px 12px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;}
.tab.on{color:var(--blue-t);border-bottom:2px solid var(--blue-t);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.03);}
.sl{color:var(--muted);font-size:10px;}.sv{font-weight:600;font-size:10px;}
.blue{color:var(--blue-t);}.red{color:var(--red-t);}.green{color:var(--green-t);}.amber{color:var(--amber-t);}.gold{color:var(--gold-l);}.steel{color:var(--steel-t);}.white{color:var(--white);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.bl{width:160px;font-size:9px;color:var(--muted);flex-shrink:0;}
.bt{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;}
.bf{height:100%;border-radius:2px;}
.bv{width:65px;text-align:right;font-size:9px;}
.vc{background:rgba(10,42,94,.2);border:1px solid rgba(42,106,191,.2);border-radius:3px;padding:9px;margin-bottom:6px;}
.vc .ag{font-weight:700;font-size:10px;margin-bottom:3px;}
.vc .rt{color:var(--muted);font-size:9px;line-height:1.6;}
.va{border-left:3px solid var(--green-t);}.vco{border-left:3px solid var(--amber-t);}.vr{border-left:3px solid var(--red-t);}
.tally{display:flex;gap:14px;padding:9px 12px;background:rgba(10,42,94,.2);border:1px solid rgba(42,106,191,.2);border-radius:3px;margin:10px 0;}
.ti{text-align:center;}.ti .n{font-size:20px;font-weight:700;}.ti .l{font-size:8px;color:var(--muted);letter-spacing:1px;}
.judge{background:rgba(90,154,239,.06);border:1px solid rgba(90,154,239,.3);border-radius:3px;padding:10px;margin-top:10px;font-size:10px;line-height:1.7;color:var(--blue-t);}
.bet{background:linear-gradient(135deg,rgba(10,42,94,.3),rgba(192,57,43,.06));border:1px solid rgba(90,154,239,.3);border-radius:4px;padding:12px 14px;margin-bottom:14px;}
.bet .bt2{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:5px;}
.bet .bb{font-size:12px;font-weight:700;line-height:1.6;color:var(--blue-t);}
.tbl{width:100%;border-collapse:collapse;font-size:10px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:8px;padding:4px 6px;border-bottom:1px solid var(--border);text-align:left;}
.tbl td{padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.02);}
.tbl .win{color:var(--green-t);font-weight:700;}.tbl .lose{color:var(--red-t);}.tbl .hl{background:rgba(90,154,239,.05);}
.sav{background:linear-gradient(135deg,rgba(90,154,239,.08),rgba(192,57,43,.06));border:1px solid rgba(90,154,239,.3);border-radius:4px;padding:12px;margin:10px 0;text-align:center;}
.sav .amt{font-size:26px;font-weight:700;color:var(--green-t);}
.sav .lbl{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:1px;}
.factory{background:rgba(10,42,94,.1);border:1px solid rgba(42,106,191,.2);border-radius:3px;padding:10px;margin:10px 0;}
.factory-grid{display:grid;grid-template-columns:repeat(16,1fr);gap:2px;}
.fc{height:14px;border-radius:1px;}
.f-line{background:rgba(90,154,239,.4);}.f-ware{background:rgba(42,106,191,.25);}.f-dock{background:rgba(192,57,43,.3);}.f-srv{background:rgba(212,160,23,.35);}.f-agv{background:rgba(39,174,96,.35);}.f-empty{background:rgba(255,255,255,.03);}
.factory-legend{display:flex;gap:10px;margin-top:6px;flex-wrap:wrap;}
.fl{display:flex;align-items:center;gap:4px;font-size:8px;color:var(--muted);}
.fl-dot{width:9px;height:9px;border-radius:1px;}
.asset{background:rgba(10,42,94,.15);border:1px solid rgba(42,106,191,.2);border-radius:3px;padding:9px;margin-bottom:7px;}
.asset .an{font-size:10px;font-weight:700;margin-bottom:4px;}
.asset .am{display:flex;gap:12px;flex-wrap:wrap;}
.asset .ak{text-align:center;}.asset .ak .av{font-size:16px;font-weight:700;}.asset .ak .al{font-size:8px;color:var(--muted);letter-spacing:1px;}
.sensor{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(10,42,94,.15);border-left:2px solid var(--blue-b);margin-bottom:4px;}
.sensor .sn{font-size:9px;color:var(--blue-t);}.sensor .sv2{font-size:9px;color:var(--amber-t);}
.sensor .ss{font-size:8px;color:var(--muted);}
.scen{display:flex;gap:1px;background:var(--border);margin-bottom:12px;overflow-x:auto;}
.sc{flex:1;min-width:70px;padding:6px 8px;cursor:pointer;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);text-align:center;white-space:nowrap;}
.sc.on{color:var(--blue-t);border-bottom:2px solid var(--blue-t);}
.threat{background:rgba(10,42,94,.15);border:1px solid rgba(42,106,191,.15);border-radius:3px;padding:9px;margin-bottom:6px;}
.threat .tn{font-size:10px;font-weight:700;margin-bottom:3px;}
.threat .td{font-size:9px;color:var(--muted);line-height:1.6;}
.inf-status{background:rgba(90,154,239,.06);border:1px solid rgba(90,154,239,.3);border-radius:3px;padding:10px;margin:10px 0;text-align:center;}
.inf-status .is{font-size:11px;font-weight:700;color:var(--blue-t);letter-spacing:1px;}
.inf-status .id{font-size:9px;color:var(--muted);margin-top:3px;}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100;align-items:center;justify-content:center;}
.modal.open{display:flex;}
.mbox{background:#07090f;border:1px solid var(--blue-b);border-radius:4px;padding:28px 36px;max-width:480px;text-align:center;}
.mbox h2{color:var(--blue-t);font-size:14px;margin-bottom:10px;letter-spacing:2px;text-transform:uppercase;}
.mbox p{color:var(--muted);font-size:11px;line-height:1.7;margin-bottom:10px;}
.mbox .cbtn{background:rgba(90,154,239,.1);border:1px solid var(--blue-b);color:var(--blue-t);padding:7px 20px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;}
.lbtn{display:inline-flex;align-items:center;gap:6px;background:rgba(90,154,239,.1);border:1px solid var(--blue-b);color:var(--blue-t);padding:6px 14px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;}
.cw{position:relative;height:150px;margin-top:8px;}
.milestone{display:flex;gap:8px;align-items:flex-start;margin-bottom:9px;}
.ms-dot{width:7px;height:7px;border-radius:50%;background:var(--blue-t);margin-top:3px;flex-shrink:0;}
.ms-dot.green{background:var(--green-t);}
.ms-content .ms-t{font-size:9px;font-weight:700;color:var(--blue-t);}
.ms-content .ms-d{font-size:8px;color:var(--muted);line-height:1.5;}
.bbar{background:linear-gradient(135deg,rgba(10,42,94,.4),rgba(42,47,58,.3));border-top:1px solid rgba(90,154,239,.15);padding:8px 20px;text-align:center;font-size:9px;color:var(--steel-t);letter-spacing:1px;}
.scan-line{position:fixed;top:0;left:0;right:0;height:2px;background:rgba(90,154,239,.1);animation:scan 10s linear infinite;pointer-events:none;z-index:999;}
@keyframes scan{0%{top:0}100%{top:100vh}}
</style>
</head>
<body>
<div class="scan-line"></div>
<div class="stripe"></div>
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>⚡ SOVEREIGN INDUSTRIAL AI DEPLOYMENT</h2>
    <p>MeshPilot deploys on your existing server infrastructure inside Alghanim facilities. No cloud. No data leaves Kuwait. Predictive maintenance, supply chain twin, and quality control AI run entirely on-premises.</p>
    <p>All 340 sensor nodes feed directly into the on-prem inference engine. Fault prediction at 3ms latency. Zero external API calls. 100% operational data residency.</p>
    <p style="color:var(--blue-t);font-weight:700;font-size:11px">Made in Kuwait · Sovereign Operations · Zero Cloud Dependency</p>
    <p style="color:var(--green-t)">Contact: meshpilot@agenthinkmesh.ai</p>
    <br><button class="cbtn" onclick="cl()">CLOSE</button>
  </div>
</div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">ALGHANIM<br>⚙️<br>AI</div>
    <div>
      <div class="htitle">Alghanim Industries — Sovereign Industrial AI Command Center</div>
      <div class="hsub">Kuwait · Automotive · Engineering · Manufacturing · Industrial Services · Est. 1932</div>
    </div>
  </div>
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-kw">🇰🇼 Made in Kuwait</span>
    <span class="badge b-sv">🔒 Sovereign Operations</span>
    <span class="badge b-zc">✓ Zero Cloud Dependency</span>
    <span class="badge b-live pulse">● SYSTEM ACTIVE</span>
    <span style="color:var(--muted);font-size:9px" id="clk"></span>
  </div>
</div>
<div class="mbar">
  <div class="m"><div class="v">60+</div><div class="l">Years in Kuwait</div></div>
  <div class="m"><div class="v">30+</div><div class="l">Business Units</div></div>
  <div class="m"><div class="v g">5,000</div><div class="l">Simulated Episodes</div></div>
  <div class="m"><div class="v g">96.2%</div><div class="l">Fault Prediction Accuracy</div></div>
  <div class="m"><div class="v a">3ms</div><div class="l">Inference Latency</div></div>
  <div class="m"><div class="v g">100%</div><div class="l">Data Residency</div></div>
  <div class="m"><div class="v">340</div><div class="l">Sensor Nodes Active</div></div>
  <div class="m"><div class="v g">$56.6M</div><div class="l">10-Year Savings</div></div>
</div>
<div class="grid">

<!-- LEFT: Industrial Executive Twin -->
<div class="panel">
  <div class="pt">⚙️ Industrial Executive Twin — Alghanim Industries</div>
  <div class="bet">
    <div class="bt2">INDUSTRIAL SOVEREIGNTY MANDATE</div>
    <div class="bb">Alghanim's manufacturing operations generate millions of sensor readings daily — vibration, thermal, pressure, flow. Every cloud-based AI solution routes this operational intelligence to foreign servers. MeshPilot keeps every reading inside Kuwait. Predictive maintenance, supply chain optimisation, and quality control AI run on existing server racks. Zero data egress. Zero cloud lock-in.</div>
  </div>
  <button class="lbtn" onclick="ol()">⚡ Deploy Sovereign Industrial AI — Contact Us</button>
  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Brief</div>
    <div class="tab" onclick="st('modern',this)">Industrial Modernization</div>
    <div class="tab" onclick="st('ops',this)">Operations Scenarios</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief — Sovereign Industrial AI</div>
    <div class="body">Alghanim Industries is one of Kuwait's most established industrial conglomerates, with operations spanning automotive distribution, engineering services, manufacturing, and industrial infrastructure. Founded in 1932, the group has built deep operational expertise across Kuwait's private sector.<br><br>The industrial AI challenge is specific: predictive maintenance and supply chain optimisation require continuous ingestion of sensor data from production lines, AGV fleets, and logistics networks. Every major cloud AI vendor routes this data to foreign data centres. For an industrial group of Alghanim's scale, that represents an unacceptable operational intelligence risk — and a significant recurring cost.<br><br>MeshPilot solves this at the infrastructure level. The inference engine runs on standard x86/ARM CPU servers already present in Alghanim's facilities. No GPU procurement. No cloud subscription. No data leaves Kuwait.<br><br><strong style="color:var(--blue-t)">100% operational data residency. Zero external API calls. 41× cheaper than cloud GPU over 10 years.</strong></div>
  </div>
  <div class="tc" id="tc-modern">
    <div class="st">Kuwait Vision 2035 — Industrial Diversification</div>
    <div class="sr"><div class="sl">Kuwait Vision 2035 — Industrial Focus</div><div class="sv blue">Diversification beyond oil</div></div>
    <div class="sr"><div class="sl">Private Sector Industrial Target</div><div class="sv blue">25% GDP contribution</div></div>
    <div class="sr"><div class="sl">Alghanim Industrial Segments</div><div class="sv">Auto, Engineering, Mfg, Services</div></div>
    <div class="sr"><div class="sl">Production Lines (Active)</div><div class="sv green">8 lines / 2 standby</div></div>
    <div class="sr"><div class="sl">AGV Fleet</div><div class="sv green">14 units / 92% uptime</div></div>
    <div class="sr"><div class="sl">Sensor Nodes</div><div class="sv green">340 active (vibration, thermal, pressure, flow)</div></div>
    <div class="sr"><div class="sl">Annual Maintenance Cost (est.)</div><div class="sv amber">KD 4–8M (industry benchmark)</div></div>
    <div class="sr"><div class="sl">Unplanned Downtime Reduction (AI)</div><div class="sv green">18% (MeshPilot baseline)</div></div>
    <div style="margin-top:10px"><div class="st">Industrial AI — Cumulative Savings Trajectory (2026–2035)</div><div class="cw"><canvas id="modC"></canvas></div></div>
  </div>
  <div class="tc" id="tc-ops">
    <div class="st">Operations Scenarios — Industrial AI Use Cases</div>
    <div class="scen">
      <div class="sc on" onclick="ss('maint',this)">Predictive</div>
      <div class="sc" onclick="ss('supply',this)">Supply Chain</div>
      <div class="sc" onclick="ss('quality',this)">Quality</div>
      <div class="sc" onclick="ss('energy',this)">Energy</div>
      <div class="sc" onclick="ss('safety',this)">Safety</div>
      <div class="sc" onclick="ss('vendor',this)">Vendor Risk</div>
    </div>
    <div id="sc-maint" class="threat" style="border-left:3px solid var(--blue-t);display:block">
      <div class="tn blue">🔧 Predictive Maintenance — Vibration, Thermal, Acoustic Sensors</div>
      <div class="td">340 sensor nodes feed continuous telemetry into MeshPilot's on-prem inference engine. Vibration anomaly detection at 3ms latency. Thermal runaway prediction 48 hours ahead of failure. Acoustic signature analysis for bearing wear. 5,000 simulated maintenance episodes. 96.2% fault prediction accuracy. All sensor data stays inside Alghanim facilities — zero cloud egress.</div>
    </div>
    <div id="sc-supply" class="threat" style="border-left:3px solid var(--green-t);display:none">
      <div class="tn green">📦 Supply Chain Twin — Logistics Disruption Simulation</div>
      <div class="td">Digital twin of Alghanim's supply chain: port delays at Shuwaikh and Shuaiba, inventory buffer optimisation, supplier lead time variability. MeshPilot simulates 2,000 disruption scenarios per quarter. Route optimisation for AGV fleet. All logistics intelligence computed on-prem — no supply chain data leaves Kuwait.</div>
    </div>
    <div id="sc-quality" class="threat" style="border-left:3px solid var(--amber-t);display:none">
      <div class="tn amber">🔍 Quality Control — Computer Vision Defect Detection</div>
      <div class="td">Production line defect detection using on-prem computer vision models. Trained on 1,800 synthetic defect episodes across automotive components and manufactured parts. False positive rate: 0.3%. Defect classification: surface, dimensional, assembly. All production imagery processed on-device — no product data leaves the facility.</div>
    </div>
    <div id="sc-energy" class="threat" style="border-left:3px solid var(--gold-l);display:none">
      <div class="tn gold">⚡ Energy Optimisation — Smart Factory Power Management</div>
      <div class="td">12% energy efficiency gain through AI-driven load scheduling. MeshPilot models production line power demand, HVAC optimisation, and peak demand avoidance. All energy management decisions computed locally — no utility data leaves the facility. Estimated annual saving: KD 180,000 across active production lines.</div>
    </div>
    <div id="sc-safety" class="threat" style="border-left:3px solid var(--red-t);display:none">
      <div class="tn red">🦺 Safety Compliance — AI-Monitored Workplace Safety</div>
      <div class="td">Incident prediction using sensor fusion: proximity alerts, ergonomic stress detection, hazardous zone monitoring. 1,200 synthetic incident scenarios. Near-miss detection at 2.8s latency. All safety monitoring data processed on-prem — worker data never leaves the facility. Compliant with Kuwait Labour Law No. 6/2010.</div>
    </div>
    <div id="sc-vendor" class="threat" style="border-left:3px solid var(--steel-t);display:none">
      <div class="tn steel">🏭 Vendor Risk — Supplier Stability Assessment</div>
      <div class="td">Assess supplier financial stability, delivery performance, and geopolitical exposure using local data only. MeshPilot cross-references internal procurement records with public financial data — no supplier data sent to foreign AI services. 800 synthetic vendor risk scenarios. Risk scoring updated weekly on-prem.</div>
    </div>
  </div>
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation — Sovereign Industrial AI Pilot</div>
    <div class="body">Deploy MeshPilot sovereign industrial AI pilot at Alghanim manufacturing facility. Phase 1: predictive maintenance on 2 production lines. Phase 2: supply chain twin + quality control. Phase 3: full factory rollout across all 8 active lines and 5-factory group deployment.</div>
    <div style="margin-top:12px">
      <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Industrial AI Architect — APPROVE</div><div class="rt">CPU-only inference on existing server racks eliminates GPU procurement cost and cloud subscription dependency. Standard x86 hardware is available through existing Alghanim IT infrastructure. No new hardware required for Phase 1 pilot.</div></div>
      <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Data Sovereignty Officer — APPROVE</div><div class="rt">100% operational data residency is architecturally enforced. Sensor data, production telemetry, and supply chain records never leave Alghanim facilities. Satisfies Kuwait data localisation requirements and operational security standards.</div></div>
      <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Operations Director — APPROVE</div><div class="rt">18% reduction in unplanned downtime is operationally significant. At Alghanim's production scale, this translates to meaningful cost savings in the first year. 96.2% fault prediction accuracy exceeds industry benchmark of 85–90%.</div></div>
      <div class="vc vco"><div class="ag" style="color:var(--amber-t)">⚠️ IT Infrastructure — CONDITIONAL</div><div class="rt">Approve conditional on: (1) server capacity audit to confirm available CPU headroom, (2) network segmentation between production OT and IT networks, (3) phased rollout starting with 2 production lines before full deployment.</div></div>
      <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Kuwait Vision 2035 Alignment — APPROVE</div><div class="rt">Sovereign industrial AI directly advances Kuwait's diversification mandate. Alghanim deploying AI on existing infrastructure — rather than exporting operational data to foreign clouds — is a model for Kuwaiti industrial sovereignty.</div></div>
      <div class="tally">
        <div class="ti"><div class="n green">4</div><div class="l">APPROVE</div></div>
        <div class="ti"><div class="n amber">1</div><div class="l">CONDITIONAL</div></div>
        <div class="ti"><div class="n red">0</div><div class="l">REJECT</div></div>
      </div>
      <div class="judge"><strong>JUDGE — IMMEDIATE PILOT AUTHORISED:</strong> Industrial sovereignty is competitive advantage. Every dinar saved on cloud dependency is a dinar reinvested in Kuwaiti manufacturing capacity. Deploy MeshPilot on existing infrastructure immediately. Server capacity audit and network segmentation to run in parallel with Phase 1 deployment.</div>
    </div>
  </div>
</div>

<!-- CENTRE: Industrial Simulation Hub -->
<div class="panel">
  <div class="pt">🏭 Industrial Simulation Hub — Factory Floor Status</div>
  <div class="sec">
    <div class="st">Factory Floor Map — Alghanim Manufacturing Facility</div>
    <div class="factory">
      <div class="factory-grid" id="factGrid"></div>
      <div class="factory-legend">
        <div class="fl"><div class="fl-dot f-line"></div><span>Assembly Line</span></div>
        <div class="fl"><div class="fl-dot f-ware"></div><span>Warehouse</span></div>
        <div class="fl"><div class="fl-dot f-dock"></div><span>Loading Dock</span></div>
        <div class="fl"><div class="fl-dot f-srv"></div><span>Server Room</span></div>
        <div class="fl"><div class="fl-dot f-agv"></div><span>AGV Zone</span></div>
      </div>
    </div>
  </div>
  <div class="sec">
    <div class="st">Asset Status — Production Floor</div>
    <div class="asset" style="border-left:3px solid var(--blue-t)">
      <div class="an blue">⚙️ Production Lines</div>
      <div class="am">
        <div class="ak"><div class="av blue">8</div><div class="al">Active</div></div>
        <div class="ak"><div class="av amber">2</div><div class="al">Standby</div></div>
        <div class="ak"><div class="av red">0</div><div class="al">Fault</div></div>
        <div class="ak"><div class="av green">80%</div><div class="al">Utilisation</div></div>
      </div>
    </div>
    <div class="asset" style="border-left:3px solid var(--green-t)">
      <div class="an green">🤖 AGV Fleet — Automated Guided Vehicles</div>
      <div class="am">
        <div class="ak"><div class="av green">14</div><div class="al">Total Units</div></div>
        <div class="ak"><div class="av green">13</div><div class="al">Active</div></div>
        <div class="ak"><div class="av amber">1</div><div class="al">Charging</div></div>
        <div class="ak"><div class="av green">92%</div><div class="al">Uptime</div></div>
      </div>
    </div>
    <div class="asset" style="border-left:3px solid var(--amber-t)">
      <div class="an amber">📡 Sensor Network</div>
      <div class="am">
        <div class="ak"><div class="av green">340</div><div class="al">Active Nodes</div></div>
        <div class="ak"><div class="av blue">120</div><div class="al">Vibration</div></div>
        <div class="ak"><div class="av amber">95</div><div class="al">Thermal</div></div>
        <div class="ak"><div class="av">125</div><div class="al">Pressure/Flow</div></div>
      </div>
    </div>
  </div>
  <div class="sec">
    <div class="st">Training Metrics — Mesh Twin (5,000 Episodes)</div>
    <div class="br"><div class="bl">Fault Prediction Accuracy</div><div class="bt"><div class="bf" style="width:96%;background:var(--blue-t)"></div></div><div class="bv blue">96.2%</div></div>
    <div class="br"><div class="bl">False Positive Rate</div><div class="bt"><div class="bf" style="width:3%;background:var(--green-t)"></div></div><div class="bv green">0.3%</div></div>
    <div class="br"><div class="bl">Unplanned Downtime Reduction</div><div class="bt"><div class="bf" style="width:18%;background:var(--green-t)"></div></div><div class="bv green">18%</div></div>
    <div class="br"><div class="bl">Energy Efficiency Gain</div><div class="bt"><div class="bf" style="width:12%;background:var(--gold-l)"></div></div><div class="bv gold">12%</div></div>
    <div class="br"><div class="bl">Supply Chain Accuracy</div><div class="bt"><div class="bf" style="width:94%;background:var(--blue-t)"></div></div><div class="bv blue">94.1%</div></div>
    <div class="br"><div class="bl">Quality Defect Detection</div><div class="bt"><div class="bf" style="width:97%;background:var(--green-t)"></div></div><div class="bv green">97.4%</div></div>
  </div>
  <div class="sec">
    <div class="st">Live Sensor Feed — Simulated Industrial Telemetry</div>
    <div class="sensor"><span class="sn">Vibration (Line 3)</span><span class="sv2" id="s1">NORMAL — 2.1 mm/s RMS</span><span class="ss">ON-PREM</span></div>
    <div class="sensor"><span class="sn">Thermal (Motor Bank A)</span><span class="sv2" id="s2">NORMAL — 68°C / Δ+2°C</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Pressure (Hydraulic Line 1)</span><span class="sv2" id="s3">NORMAL — 142 bar / ±0.8</span><span class="ss">ON-PREM</span></div>
    <div class="sensor"><span class="sn">AGV-07 Position</span><span class="sv2" id="s4">ACTIVE — Zone B / 1.2 m/s</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Flow (Cooling Circuit)</span><span class="sv2" id="s5">NORMAL — 18.4 L/min</span><span class="ss">SOVEREIGN</span></div>
    <div class="sensor"><span class="sn">Acoustic (Bearing Set C)</span><span class="sv2" id="s6">NORMAL — 42 dB / No anomaly</span><span class="ss">ON-PREM</span></div>
  </div>
  <div class="inf-status">
    <div class="is pulse">⚡ MeshPilot CPU Active — On-Prem — 3ms Latency</div>
    <div class="id">All inference running on existing Alghanim server racks · Zero cloud API calls · 100% data residency · Kuwait sovereign</div>
  </div>
  <div class="sec">
    <div class="st">Fault Prediction Accuracy by System</div>
    <div class="cw" style="height:140px"><canvas id="faultC"></canvas></div>
  </div>
</div>

<!-- RIGHT: ROI + Sovereignty Calculator -->
<div class="panel">
  <div class="pt">💰 Sovereignty Calculator — On-Prem CPU vs Foreign Cloud GPU</div>
  <div class="bet">
    <div class="bt2">THE INDUSTRIAL SOVEREIGNTY EQUATION</div>
    <div class="bb">Cloud GPU AI for initial model training. MeshPilot CPU for all production inference + synthetic data generation. This hybrid eliminates the unacceptable risk: Alghanim's operational intelligence never leaves Kuwait. The 41× cost advantage is secondary to the sovereignty imperative.</div>
  </div>
  <div class="sec">
    <div class="st">Cost Comparison — On-Prem CPU vs Foreign Cloud GPU (10-Year)</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th>On-Prem CPU (MeshPilot)</th><th>Foreign Cloud GPU</th></tr></thead>
      <tbody>
        <tr><td>Cost per 1M Predictions</td><td class="win">$8,000</td><td class="lose">$320,000</td></tr>
        <tr><td>Annual Predictions (est.)</td><td class="win">50M+</td><td class="lose">50M+</td></tr>
        <tr><td>Annual Inference Cost</td><td class="win">$400,000</td><td class="lose">$16,000,000</td></tr>
        <tr><td>Data Residency</td><td class="win">100% Kuwait</td><td class="lose">0% (foreign servers)</td></tr>
        <tr><td>Unplanned Downtime Reduction</td><td class="win">18%</td><td>18% (same model)</td></tr>
        <tr><td>Energy Efficiency Gain</td><td class="win">12%</td><td>12% (same model)</td></tr>
        <tr><td>Inference Latency</td><td class="win">3ms on-prem</td><td class="lose">80–200ms + network</td></tr>
        <tr><td>Cloud Lock-in Risk</td><td class="win">ZERO</td><td class="lose">HIGH (vendor dependency)</td></tr>
        <tr><td>Hardware Capex (10yr)</td><td>$1,400,000</td><td class="lose">$0 (OPEX trap)</td></tr>
        <tr class="hl"><td><strong>10-Year Total Cost</strong></td><td class="win"><strong>$1,400,000</strong></td><td class="lose"><strong>$58,000,000</strong></td></tr>
        <tr><td>Sovereignty Status</td><td class="win">SOVEREIGN ✓</td><td class="lose">NON-SOVEREIGN ✗</td></tr>
      </tbody>
    </table>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">10-Year Cumulative Cost (On-Prem CPU vs Cloud GPU)</div>
    <div class="cw" style="height:140px"><canvas id="costC"></canvas></div>
  </div>
  <div class="sav">
    <div class="amt">$56.6M</div>
    <div class="lbl">10-Year Savings · 41× Cheaper · 100% Data Residency · Kuwait Sovereign</div>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">Scale Economics — 1 Factory → 5 Factory Group Rollout</div>
    <table class="tbl">
      <thead><tr><th>Phase</th><th>Scope</th><th>Annual Saving</th><th>Cumulative</th></tr></thead>
      <tbody>
        <tr><td>Phase 1</td><td>2 production lines</td><td class="win">$1.2M</td><td class="win">$1.2M</td></tr>
        <tr><td>Phase 2</td><td>Full factory (8 lines)</td><td class="win">$4.8M</td><td class="win">$6.0M</td></tr>
        <tr><td>Phase 3</td><td>5-factory group</td><td class="win">$24.0M</td><td class="win">$30.0M</td></tr>
        <tr class="hl"><td><strong>10-Year</strong></td><td><strong>Full group + AGV + supply chain</strong></td><td class="win"><strong>$5.66M/yr</strong></td><td class="win"><strong>$56.6M</strong></td></tr>
      </tbody>
    </table>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">Sovereignty Metrics — Non-Negotiable Requirements</div>
    <div class="br"><div class="bl">Operational Data Residency</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">CRITICAL</div></div>
    <div class="br"><div class="bl">Foreign Cloud Dependency</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">PROHIBITED</div></div>
    <div class="br"><div class="bl">Sensor Data Egress Risk</div><div class="bt"><div class="bf" style="width:90%;background:var(--amber-t)"></div></div><div class="bv amber">HIGH (cloud)</div></div>
    <div class="br"><div class="bl">Kuwait Vision 2035 Alignment</div><div class="bt"><div class="bf" style="width:100%;background:var(--blue-t)"></div></div><div class="bv blue">MANDATED</div></div>
    <div class="br"><div class="bl">Existing Server Infrastructure</div><div class="bt"><div class="bf" style="width:95%;background:var(--green-t)"></div></div><div class="bv green">AVAILABLE ✓</div></div>
    <div class="br"><div class="bl">MeshPilot On-Prem Compliance</div><div class="bt"><div class="bf" style="width:100%;background:var(--green-t)"></div></div><div class="bv green">NATIVE ✓</div></div>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">Deployment Milestones — Sovereign AI Rollout</div>
    <div class="milestone"><div class="ms-dot"></div><div class="ms-content"><div class="ms-t">Month 1 — Infrastructure Audit</div><div class="ms-d">Server capacity audit, network segmentation plan, sensor node inventory. No new hardware required for Phase 1.</div></div></div>
    <div class="milestone"><div class="ms-dot"></div><div class="ms-content"><div class="ms-t">Month 3 — Predictive Maintenance Pilot (2 Lines)</div><div class="ms-d">MeshPilot deployed on 2 production lines. 340 sensor nodes feeding on-prem inference. Baseline fault prediction established.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Month 6 — Full Factory Deployment</div><div class="ms-d">All 8 production lines + AGV fleet + supply chain twin. Quality control computer vision active. Energy optimisation running.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Month 12 — Group Rollout Begins</div><div class="ms-d">5-factory group deployment. Alghanim's full industrial AI stack running sovereign on existing infrastructure.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Year 3 — $30M Cumulative Savings</div><div class="ms-d">Full group deployment operational. $30M cumulative savings vs cloud alternative. 100% operational data residency maintained.</div></div></div>
  </div>
  <div style="margin-top:10px;text-align:center;font-size:9px;color:var(--muted)">Kuwait Vision 2035 · Industrial Sovereignty · Zero Cloud Dependency<br><strong style="color:var(--blue-t)">agenthinkmesh.ai/alghanim-demo</strong></div>
</div>

</div>
<div class="bbar">All industrial AI runs on existing CPU infrastructure inside Alghanim facilities. No data leaves Kuwait. No cloud lock-in. &nbsp;·&nbsp; <strong style="color:var(--blue-t)">Made in Kuwait · Sovereign Operations · Zero Cloud Dependency</strong></div>
<script>
setInterval(()=>{document.getElementById('clk').textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);
const sensors=[
  ['s1','NORMAL — 2.1 mm/s RMS','ALERT — 4.8 mm/s RMS (threshold exceeded)'],
  ['s2','NORMAL — 68°C / Δ+2°C','NORMAL — 71°C / Δ+5°C'],
  ['s3','NORMAL — 142 bar / ±0.8','NORMAL — 139 bar / ±1.2'],
  ['s4','ACTIVE — Zone B / 1.2 m/s','ACTIVE — Zone C / 0.9 m/s'],
  ['s5','NORMAL — 18.4 L/min','NORMAL — 17.9 L/min'],
  ['s6','NORMAL — 42 dB / No anomaly','NORMAL — 44 dB / No anomaly'],
];
setInterval(()=>{sensors.forEach(([id,a,b])=>{const el=document.getElementById(id);if(el)el.textContent=Math.random()>0.08?a:b;});},3500);
function ol(){document.getElementById('lm').classList.add('open');}
function cl(){document.getElementById('lm').classList.remove('open');}
function st(n,el){
  document.querySelectorAll('.tc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('tc-'+n).classList.add('on');
  el.classList.add('on');
}
function ss(n,el){
  ['maint','supply','quality','energy','safety','vendor'].forEach(s=>{document.getElementById('sc-'+s).style.display='none';});
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  document.getElementById('sc-'+n).style.display='block';
  el.classList.add('on');
}
const fg=document.getElementById('factGrid');
const layout=[
  'f-line','f-line','f-line','f-line','f-empty','f-ware','f-ware','f-ware','f-ware','f-empty','f-dock','f-dock','f-empty','f-srv','f-srv','f-empty',
  'f-line','f-line','f-line','f-line','f-empty','f-ware','f-ware','f-ware','f-ware','f-empty','f-dock','f-dock','f-empty','f-srv','f-srv','f-empty',
  'f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv',
  'f-line','f-line','f-line','f-line','f-empty','f-ware','f-ware','f-ware','f-ware','f-empty','f-dock','f-dock','f-empty','f-empty','f-empty','f-empty',
  'f-line','f-line','f-line','f-line','f-empty','f-ware','f-ware','f-ware','f-ware','f-empty','f-dock','f-dock','f-empty','f-empty','f-empty','f-empty',
  'f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv','f-agv',
  'f-line','f-line','f-line','f-line','f-empty','f-ware','f-ware','f-ware','f-ware','f-empty','f-empty','f-empty','f-empty','f-empty','f-empty','f-empty',
  'f-line','f-line','f-line','f-line','f-empty','f-ware','f-ware','f-ware','f-ware','f-empty','f-empty','f-empty','f-empty','f-empty','f-empty','f-empty',
];
layout.forEach(cls=>{const d=document.createElement('div');d.className='fc '+cls;fg.appendChild(d);});
new Chart(document.getElementById('modC'),{type:'line',data:{labels:['2026','2027','2028','2029','2030','2032','2035'],datasets:[{label:'On-Prem CPU Savings ($M cumulative)',data:[1.2,6,14,24,36,52,80],borderColor:'#5a9aef',backgroundColor:'rgba(90,154,239,.08)',borderWidth:2,pointRadius:3,fill:true,tension:.3},{label:'Cloud GPU Cost ($M cumulative)',data:[5.8,16,30,46,64,90,140],borderColor:'#e74c3c',backgroundColor:'rgba(231,76,60,.04)',borderWidth:2,pointRadius:3,fill:false,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#4a5570',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#4a5570',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a5570',font:{size:9},callback:v=>'$'+v+'M'},grid:{color:'rgba(255,255,255,.03)'}}}}});
new Chart(document.getElementById('faultC'),{type:'bar',data:{labels:['Vibration','Thermal','Pressure','Acoustic','Flow','Quality'],datasets:[{label:'Prediction Accuracy %',data:[97.1,96.2,94.8,95.6,93.4,97.4],backgroundColor:['rgba(90,154,239,.5)','rgba(243,156,18,.5)','rgba(90,154,239,.4)','rgba(212,160,23,.5)','rgba(90,154,239,.3)','rgba(39,174,96,.5)'],borderColor:['#5a9aef','#f39c12','#5a9aef','#d4a017','#5a9aef','#27ae60'],borderWidth:1,borderRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#4a5570',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{min:88,max:100,ticks:{color:'#4a5570',font:{size:9},callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.03)'}}}}});
new Chart(document.getElementById('costC'),{type:'line',data:{labels:['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],datasets:[{label:'On-Prem CPU ($M cumulative)',data:[0.14,0.28,0.42,0.56,0.70,0.84,0.98,1.12,1.26,1.40],borderColor:'#5a9aef',backgroundColor:'rgba(90,154,239,.08)',borderWidth:2,pointRadius:2,fill:true,tension:.2},{label:'Cloud GPU ($M cumulative)',data:[5.8,11.6,17.4,23.2,29.0,34.8,40.6,46.4,52.2,58.0],borderColor:'#e74c3c',backgroundColor:'rgba(231,76,60,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#4a5570',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#4a5570',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a5570',font:{size:9},callback:v=>'$'+v+'M'},grid:{color:'rgba(255,255,255,.03)'}}}}});
<\/script>
</body>
</html>`;

export default function AlghanimIndustrialDemo() {
  useEffect(() => {
    document.title = "Alghanim Industries — Sovereign Industrial AI Command Center";
    return () => { document.title = "AgenThinkMesh"; };
  }, []);
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <iframe
        srcDoc={HTML}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        title="Alghanim Industries Sovereign Industrial AI Command Center"
        sandbox="allow-scripts"
      />
    </div>
  );
}
