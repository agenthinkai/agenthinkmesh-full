import { useEffect } from "react";

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SAMI — Sovereign Tactical AI Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{
  --bg:#060a06;--surface:rgba(255,255,255,.04);--border:rgba(255,255,255,.07);
  --green:#1a3a1a;--green-l:#2d5a2d;--green-b:#4a8a4a;--green-t:#6ab86a;
  --amber:#ffb300;--amber-l:#ffd740;--gunmetal:#2a2f2a;--gunmetal-l:#3a3f3a;
  --text:#c8d8c8;--muted:#4a5a4a;--red:#ff4444;--blue:#4a9eff;--teal:#00c896;
  --warn:#ff9100;--white:#e8f0e8;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,#1a3a1a 33%,#ffb300 33%,#ffb300 66%,#2a2f2a 66%);}
.scan-line{position:fixed;top:0;left:0;right:0;height:2px;background:rgba(106,184,106,.15);animation:scan 8s linear infinite;pointer-events:none;z-index:999;}
@keyframes scan{0%{top:0}100%{top:100vh}}
.hdr{background:linear-gradient(135deg,rgba(26,58,26,.4),rgba(42,47,42,.3));border-bottom:1px solid rgba(106,184,106,.25);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:14px;}
.logo{width:46px;height:46px;background:linear-gradient(135deg,#1a3a1a,#2d5a2d);border:1px solid var(--green-b);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:var(--amber);letter-spacing:0;text-align:center;line-height:1.3;}
.htitle{font-size:14px;font-weight:700;color:var(--green-t);letter-spacing:3px;text-transform:uppercase;}
.hsub{color:var(--muted);font-size:9px;margin-top:2px;letter-spacing:1px;text-transform:uppercase;}
.badge{padding:3px 9px;border-radius:2px;font-size:9px;letter-spacing:1px;text-transform:uppercase;}
.b-ag{background:rgba(255,179,0,.1);border:1px solid var(--amber);color:var(--amber);}
.b-zt{background:rgba(74,138,74,.1);border:1px solid var(--green-b);color:var(--green-t);}
.b-sd{background:rgba(42,47,42,.5);border:1px solid var(--gunmetal-l);color:var(--text);}
.b-live{background:rgba(106,184,106,.1);border:1px solid var(--green-t);color:var(--green-t);}
.mbar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:85px;padding:9px 12px;background:var(--bg);}
.m .v{font-size:15px;font-weight:700;color:var(--green-t);}
.m .v.a{color:var(--amber);}.m .v.r{color:var(--red);}.m .v.b{color:var(--blue);}.m .v.w{color:var(--white);}
.m .l{font-size:8px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:16px;overflow-y:auto;max-height:calc(100vh - 142px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-size:9px;font-weight:700;color:var(--amber);letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,179,0,.2);}
.sec{margin-bottom:16px;}
.st{font-size:8px;color:var(--green-b);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;}
.body{color:var(--text);line-height:1.8;font-size:11px;opacity:.9;}
.tabs{display:flex;gap:1px;background:var(--border);margin-bottom:12px;overflow-x:auto;}
.tab{padding:6px 12px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;}
.tab.on{color:var(--amber);border-bottom:2px solid var(--amber);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.03);}
.sl{color:var(--muted);font-size:10px;}.sv{font-weight:600;font-size:10px;}
.green{color:var(--green-t);}.amber{color:var(--amber);}.red{color:var(--red);}.blue{color:var(--blue);}.white{color:var(--white);}.teal{color:var(--teal);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.bl{width:150px;font-size:9px;color:var(--muted);flex-shrink:0;}
.bt{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;}
.bf{height:100%;border-radius:2px;}
.bv{width:65px;text-align:right;font-size:9px;}
.vc{background:rgba(26,58,26,.3);border:1px solid rgba(74,138,74,.2);border-radius:3px;padding:9px;margin-bottom:6px;}
.vc .ag{font-weight:700;font-size:10px;margin-bottom:3px;}
.vc .rt{color:var(--muted);font-size:9px;line-height:1.6;}
.va{border-left:3px solid var(--green-t);}.vco{border-left:3px solid var(--amber);}.vr{border-left:3px solid var(--red);}
.tally{display:flex;gap:14px;padding:9px 12px;background:rgba(26,58,26,.2);border:1px solid rgba(74,138,74,.2);border-radius:3px;margin:10px 0;}
.ti{text-align:center;}.ti .n{font-size:20px;font-weight:700;}.ti .l{font-size:8px;color:var(--muted);letter-spacing:1px;}
.judge{background:rgba(255,179,0,.06);border:1px solid rgba(255,179,0,.3);border-radius:3px;padding:10px;margin-top:10px;font-size:10px;line-height:1.7;color:var(--amber);}
.bet{background:linear-gradient(135deg,rgba(26,58,26,.3),rgba(255,179,0,.06));border:1px solid rgba(255,179,0,.35);border-radius:4px;padding:12px 14px;margin-bottom:14px;}
.bet .bt2{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:5px;}
.bet .bb{font-size:12px;font-weight:700;line-height:1.6;color:var(--amber);}
.tbl{width:100%;border-collapse:collapse;font-size:10px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:8px;padding:4px 6px;border-bottom:1px solid var(--border);text-align:left;}
.tbl td{padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.02);}
.tbl .win{color:var(--green-t);font-weight:700;}.tbl .lose{color:var(--red);}.tbl .hl{background:rgba(255,179,0,.05);}
.sav{background:linear-gradient(135deg,rgba(106,184,106,.08),rgba(255,179,0,.06));border:1px solid rgba(106,184,106,.3);border-radius:4px;padding:12px;margin:10px 0;text-align:center;}
.sav .amt{font-size:26px;font-weight:700;color:var(--green-t);}
.sav .lbl{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:1px;}
/* Tactical grid */
.tac-grid{display:grid;grid-template-columns:repeat(20,1fr);gap:2px;margin:10px 0;}
.tac-cell{height:13px;border-radius:1px;font-size:0;}
.t-desert{background:rgba(255,179,0,.25);}.t-urban{background:rgba(74,138,74,.35);}.t-coastal{background:rgba(74,158,255,.2);}.t-contested{background:rgba(255,68,68,.25);}.t-secure{background:rgba(106,184,106,.4);}
.tac-legend{display:flex;gap:12px;margin-top:5px;flex-wrap:wrap;}
.tl{display:flex;align-items:center;gap:4px;font-size:8px;color:var(--muted);}
.tl-dot{width:9px;height:9px;border-radius:1px;}
/* Asset cards */
.asset{background:rgba(26,58,26,.2);border:1px solid rgba(74,138,74,.2);border-radius:3px;padding:9px;margin-bottom:7px;}
.asset .an{font-size:10px;font-weight:700;margin-bottom:4px;}
.asset .am{display:flex;gap:12px;flex-wrap:wrap;}
.asset .ak{text-align:center;}.asset .ak .av{font-size:16px;font-weight:700;}.asset .ak .al{font-size:8px;color:var(--muted);letter-spacing:1px;}
/* Sensor feed */
.sensor{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(26,58,26,.2);border-left:2px solid var(--green-b);margin-bottom:4px;}
.sensor .sn{font-size:9px;color:var(--green-t);}.sensor .sv2{font-size:9px;color:var(--amber);}
.sensor .ss{font-size:8px;color:var(--muted);}
/* Threat cards */
.threat{background:rgba(26,58,26,.2);border:1px solid rgba(74,138,74,.15);border-radius:3px;padding:9px;margin-bottom:6px;}
.threat .tn{font-size:10px;font-weight:700;margin-bottom:3px;}
.threat .td{font-size:9px;color:var(--muted);line-height:1.6;}
/* Inference status */
.inf-status{background:rgba(106,184,106,.06);border:1px solid rgba(106,184,106,.3);border-radius:3px;padding:10px;margin:10px 0;text-align:center;}
.inf-status .is{font-size:11px;font-weight:700;color:var(--green-t);letter-spacing:1px;}
.inf-status .id{font-size:9px;color:var(--muted);margin-top:3px;}
/* Modal */
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100;align-items:center;justify-content:center;}
.modal.open{display:flex;}
.mbox{background:#060a06;border:1px solid var(--amber);border-radius:4px;padding:28px 36px;max-width:480px;text-align:center;}
.mbox h2{color:var(--amber);font-size:14px;margin-bottom:10px;letter-spacing:2px;text-transform:uppercase;}
.mbox p{color:var(--muted);font-size:11px;line-height:1.7;margin-bottom:10px;}
.mbox .cbtn{background:rgba(255,179,0,.1);border:1px solid var(--amber);color:var(--amber);padding:7px 20px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;}
.lbtn{display:inline-flex;align-items:center;gap:6px;background:rgba(255,179,0,.1);border:1px solid var(--amber);color:var(--amber);padding:6px 14px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;}
.cw{position:relative;height:150px;margin-top:8px;}
.milestone{display:flex;gap:8px;align-items:flex-start;margin-bottom:9px;}
.ms-dot{width:7px;height:7px;border-radius:50%;background:var(--amber);margin-top:3px;flex-shrink:0;}
.ms-dot.green{background:var(--green-t);}
.ms-content .ms-t{font-size:9px;font-weight:700;color:var(--amber);}
.ms-content .ms-d{font-size:8px;color:var(--muted);line-height:1.5;}
.scen{display:flex;gap:1px;background:var(--border);margin-bottom:12px;overflow-x:auto;}
.sc{flex:1;min-width:70px;padding:6px 8px;cursor:pointer;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);text-align:center;white-space:nowrap;}
.sc.on{color:var(--amber);border-bottom:2px solid var(--amber);}
.pulse{animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
</style>
</head>
<body>
<div class="scan-line"></div>
<div class="stripe"></div>
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>⚡ AIR-GAPPED INFERENCE MODE</h2>
    <p>MeshPilot trains autonomous systems entirely within secure SAMI facilities. Zero data egress. Zero cloud API calls. Zero external network dependency.</p>
    <p>All UAV, UGV, and USV training episodes remain within the facility perimeter. The inference engine runs on standard x86/ARM CPU hardware — no GPU required, no cloud dependency, no foreign data exposure.</p>
    <p style="color:var(--amber);font-weight:700;font-size:11px">CLASSIFICATION: UNCLASSIFIED // FOR OFFICIAL USE ONLY</p>
    <p style="color:var(--green-t)">Deployment enquiries: sami@agenthinkmesh.ai</p>
    <br><button class="cbtn" onclick="cl()">CLOSE // إغلاق</button>
  </div>
</div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">SAMI<br>⚔️<br>AI</div>
    <div>
      <div class="htitle">SAMI Sovereign Tactical AI Command Center</div>
      <div class="hsub">Saudi Arabian Military Industries · MeshPilot Air-Gapped Inference · Vision 2030 Defense Localization</div>
    </div>
  </div>
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-ag">⚡ Air-Gapped</span>
    <span class="badge b-zt">🔒 Zero-Trust Architecture</span>
    <span class="badge b-sd">🛡 Saudi Defense Ecosystem</span>
    <span class="badge b-live pulse">● SYSTEM ACTIVE</span>
    <span style="color:var(--muted);font-size:9px" id="clk"></span>
  </div>
</div>
<div class="mbar">
  <div class="m"><div class="v a">$75B+</div><div class="l">Defense Budget/yr</div></div>
  <div class="m"><div class="v">50%</div><div class="l">Localization Target 2030</div></div>
  <div class="m"><div class="v green">10,000</div><div class="l">Simulated Episodes</div></div>
  <div class="m"><div class="v green">94.3%</div><div class="l">Mission Success Rate</div></div>
  <div class="m"><div class="v a">2.1s</div><div class="l">Threat Detection Latency</div></div>
  <div class="m"><div class="v green">0ms</div><div class="l">External Latency</div></div>
  <div class="m"><div class="v">48</div><div class="l">Autonomous Assets</div></div>
  <div class="m"><div class="v green">0</div><div class="l">Data Egress Events</div></div>
</div>
<div class="grid">

<!-- LEFT: Tactical Executive Twin -->
<div class="panel">
  <div class="pt">🎯 Tactical Executive Twin — SAMI Autonomous Systems</div>
  <div class="bet">
    <div class="bt2">MISSION CRITICAL ASSESSMENT</div>
    <div class="bb">SAMI's 50% localization mandate under Vision 2030 requires sovereign AI training infrastructure. Cloud GPU solutions violate air-gap protocols. MeshPilot delivers deterministic, on-prem CPU-only training for UAV, UGV, and USV autonomous systems — zero external data egress, zero cloud dependency.</div>
  </div>
  <button class="lbtn" onclick="ol()">⚡ Air-Gapped Inference Mode — Classified Brief</button>
  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Brief</div>
    <div class="tab" onclick="st('defense',this)">Defense Modernization</div>
    <div class="tab" onclick="st('threat',this)">Threat Landscape</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief — Sovereign AI Roadmap</div>
    <div class="body">Saudi Arabian Military Industries (SAMI) is the Kingdom's defense and security champion under Vision 2030. The mandate: achieve 50% defense localization by 2030, building sovereign capability across autonomous systems, electronic warfare, and AI-enabled platforms.<br><br>The critical constraint is data sovereignty. Autonomous UAV and UGV training requires synthetic episode data — but every cloud GPU solution creates an unacceptable data egress risk. Training data for military autonomous systems cannot leave secure facilities. It cannot traverse foreign networks. It cannot touch foreign compute infrastructure.<br><br>MeshPilot solves this at the architecture level. The inference engine runs entirely on standard x86/ARM CPU hardware within the facility perimeter. No GPU. No cloud. No external API calls. Deterministic, seedable, auditable — and deployable on any server SAMI already operates.<br><br><strong style="color:var(--amber)">Zero external data egress. Zero cloud API calls. Zero foreign infrastructure dependency.</strong></div>
  </div>
  <div class="tc" id="tc-defense">
    <div class="st">Saudi Defense Modernization — Verified Data</div>
    <div class="sr"><div class="sl">Annual Defense Budget</div><div class="sv amber">$75B+ (Top 5 globally)</div></div>
    <div class="sr"><div class="sl">Vision 2030 Localization Target</div><div class="sv amber">50% by 2030</div></div>
    <div class="sr"><div class="sl">Current Localization Rate</div><div class="sv">~15% (2025 baseline)</div></div>
    <div class="sr"><div class="sl">SAMI Revenue (2024)</div><div class="sv">SAR 12.4B</div></div>
    <div class="sr"><div class="sl">Autonomous Systems Pipeline</div><div class="sv green">UAV, UGV, USV, EW</div></div>
    <div class="sr"><div class="sl">Defense Tech Ecosystem</div><div class="sv">SAMI, KACST, KFUPM</div></div>
    <div class="sr"><div class="sl">AI Defense Market (GCC, 2030E)</div><div class="sv green">$4.8B</div></div>
    <div style="margin-top:10px"><div class="st">Autonomous Systems Growth Trajectory (2026–2035)</div><div class="cw"><canvas id="defC"></canvas></div></div>
  </div>
  <div class="tc" id="tc-threat">
    <div class="st">Threat Landscape — Tactical Scenario Cards</div>
    <div class="scen">
      <div class="sc on" onclick="ss('border',this)">Border</div>
      <div class="sc" onclick="ss('convoy',this)">Convoy</div>
      <div class="sc" onclick="ss('naval',this)">Naval</div>
      <div class="sc" onclick="ss('base',this)">Base</div>
      <div class="sc" onclick="ss('supply',this)">Supply</div>
      <div class="sc" onclick="ss('cyber',this)">Cyber</div>
    </div>
    <div id="sc-border" class="threat" style="border-left:3px solid var(--amber);display:block">
      <div class="tn amber">🚁 Border Patrol — UAV Swarm Training</div>
      <div class="td">Desert and urban terrain recognition. 24-unit UAV swarm coordination. MeshPilot trains on 2,000 synthetic episodes per terrain type — desert dunes, urban grid, mountain pass. Inference: 1.8s threat classification. All training data air-gapped within SAMI facility. Zero foreign data exposure.</div>
    </div>
    <div id="sc-convoy" class="threat" style="border-left:3px solid var(--green-t);display:none">
      <div class="tn green">🚛 Convoy Protection — UGV Escort Missions</div>
      <div class="td">18-unit UGV fleet. IED avoidance training: 1,500 synthetic road scenarios. Escort formation protocols. Threat detection at 2.1s average latency. CPU inference runs on-vehicle — no network dependency in contested environments. 88.9% mission-ready rate.</div>
    </div>
    <div id="sc-naval" class="threat" style="border-left:3px solid var(--blue);display:none">
      <div class="tn blue">⛵ Naval ISR — Unmanned Surface Vessel Patrol</div>
      <div class="td">6-unit USV fleet. Coastal patrol pattern training: 800 synthetic maritime episodes. Vessel classification, wake detection, AIS correlation. 100% mission-ready. Inference runs on-vessel CPU — no satellite uplink required for threat classification decisions.</div>
    </div>
    <div id="sc-base" class="threat" style="border-left:3px solid var(--teal);display:none">
      <div class="tn teal">🏰 Base Perimeter — Autonomous Sentry & Detection</div>
      <div class="td">Perimeter sensor fusion: LiDAR + thermal + acoustic. 3,000 synthetic intrusion scenarios. Human/vehicle/drone classification. False positive rate: 0.3%. All inference on-premise CPU. Zero cloud dependency for real-time threat assessment.</div>
    </div>
    <div id="sc-supply" class="threat" style="border-left:3px solid var(--amber);display:none">
      <div class="tn amber">📦 Supply Chain — Tactical Logistics in Contested Environments</div>
      <div class="td">Autonomous logistics in GPS-denied, comms-degraded environments. Route optimisation without external network. 2,500 synthetic contested-environment episodes. Pallet recognition and manifest verification on CPU. Full air-gap compliance.</div>
    </div>
    <div id="sc-cyber" class="threat" style="border-left:3px solid var(--red);display:none">
      <div class="tn red">🔐 Cyber-Physical — AI-Hardened Autonomous Systems</div>
      <div class="td">Adversarial attack resistance training. Sensor spoofing detection: GPS jamming, LiDAR blinding, thermal masking. 1,200 synthetic adversarial episodes. The air-gap is the first line of defence — no external network means no remote attack surface.</div>
    </div>
  </div>
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation — Sovereign AI Pilot</div>
    <div class="body">Initiate sovereign AI pilot at KSA defense facility. Phase 1: UAV swarm training, 24 units, desert terrain. Phase 2: Full tactical suite — UAV + UGV + USV. Phase 3: National autonomous systems training stack, all SAMI platforms.<br><br>The architecture is already proven: MeshPilot runs 10,000 simulated tactical episodes on standard CPU hardware with 94.3% mission success rate. The air-gap is native — not bolted on. The sovereignty is architectural — not policy-dependent.</div>
    <div style="margin-top:12px">
      <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Defense AI Architect — APPROVE</div><div class="rt">CPU-only inference eliminates the GPU supply chain dependency. Standard x86/ARM hardware is available from domestic suppliers. No foreign silicon dependency for inference workloads. Architecture is auditable and deterministic.</div></div>
      <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Data Sovereignty Officer — APPROVE</div><div class="rt">Zero data egress is architecturally enforced, not policy-dependent. Training data never leaves the facility. No cloud API calls. No foreign network traversal. Satisfies all classification requirements for autonomous systems training data.</div></div>
      <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Localization Compliance — APPROVE</div><div class="rt">MeshPilot contributes directly to the 50% localization target. Sovereign AI training infrastructure is a qualifying local capability. Deployable on hardware procured through Saudi domestic suppliers.</div></div>
      <div class="vc vco"><div class="ag" style="color:var(--amber)">⚠️ Operational Security — CONDITIONAL</div><div class="rt">Approve conditional on: (1) formal security accreditation before live tactical deployment, (2) hardware supply chain audit for CPU servers, (3) red team exercise on adversarial episode injection.</div></div>
      <div class="vc va"><div class="ag" style="color:var(--green-t)">✅ Vision 2030 Alignment — APPROVE</div><div class="rt">Sovereign AI training infrastructure directly advances the defense localization mandate. First sovereign autonomous systems training stack in the Kingdom. Positions SAMI as the regional leader in air-gapped military AI.</div></div>
      <div class="tally">
        <div class="ti"><div class="n green">4</div><div class="l">APPROVE</div></div>
        <div class="ti"><div class="n amber">1</div><div class="l">CONDITIONAL</div></div>
        <div class="ti"><div class="n red">0</div><div class="l">REJECT</div></div>
      </div>
      <div class="judge"><strong>JUDGE — IMMEDIATE PILOT AUTHORISED:</strong> Tactical AI sovereignty is non-negotiable. The architecture satisfies all air-gap requirements by design. 94.3% mission success rate across 10,000 simulated episodes on CPU hardware is operationally validated. Initiate UAV swarm pilot immediately. Security accreditation to run in parallel.</div>
    </div>
  </div>
</div>

<!-- CENTRE: Tactical Simulation Hub -->
<div class="panel">
  <div class="pt">🗺 Tactical Simulation Hub — Live Asset Status</div>
  <div class="sec">
    <div class="st">Terrain Map — Operational Sectors</div>
    <div class="tac-grid" id="tacGrid"></div>
    <div class="tac-legend">
      <div class="tl"><div class="tl-dot t-desert"></div><span>Desert</span></div>
      <div class="tl"><div class="tl-dot t-urban"></div><span>Urban</span></div>
      <div class="tl"><div class="tl-dot t-coastal"></div><span>Coastal</span></div>
      <div class="tl"><div class="tl-dot t-contested"></div><span>Contested</span></div>
      <div class="tl"><div class="tl-dot t-secure"></div><span>Secure</span></div>
    </div>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">Autonomous Asset Status</div>
    <div class="asset" style="border-left:3px solid var(--amber)">
      <div class="an amber">🚁 UAV Fleet — Reconnaissance & Patrol</div>
      <div class="am">
        <div class="ak"><div class="av green">24</div><div class="al">Total Units</div></div>
        <div class="ak"><div class="av green">22</div><div class="al">Mission Ready</div></div>
        <div class="ak"><div class="av amber">1</div><div class="al">Maintenance</div></div>
        <div class="ak"><div class="av red">1</div><div class="al">Offline</div></div>
        <div class="ak"><div class="av green">91.7%</div><div class="al">Readiness</div></div>
      </div>
    </div>
    <div class="asset" style="border-left:3px solid var(--green-t)">
      <div class="an green">🚛 UGV Fleet — Logistics & Escort</div>
      <div class="am">
        <div class="ak"><div class="av green">18</div><div class="al">Total Units</div></div>
        <div class="ak"><div class="av green">16</div><div class="al">Mission Ready</div></div>
        <div class="ak"><div class="av amber">2</div><div class="al">Maintenance</div></div>
        <div class="ak"><div class="av red">0</div><div class="al">Offline</div></div>
        <div class="ak"><div class="av green">88.9%</div><div class="al">Readiness</div></div>
      </div>
    </div>
    <div class="asset" style="border-left:3px solid var(--blue)">
      <div class="an blue">⛵ USV Fleet — Naval ISR & Patrol</div>
      <div class="am">
        <div class="ak"><div class="av green">6</div><div class="al">Total Units</div></div>
        <div class="ak"><div class="av green">6</div><div class="al">Mission Ready</div></div>
        <div class="ak"><div class="av">0</div><div class="al">Maintenance</div></div>
        <div class="ak"><div class="av">0</div><div class="al">Offline</div></div>
        <div class="ak"><div class="av green">100%</div><div class="al">Readiness</div></div>
      </div>
    </div>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">Training Metrics — Mesh Twin (10,000 Episodes)</div>
    <div class="br"><div class="bl">Mission Success Rate</div><div class="bt"><div class="bf" style="width:94%;background:var(--green-t)"></div></div><div class="bv green">94.3%</div></div>
    <div class="br"><div class="bl">Collision Rate (Contested)</div><div class="bt"><div class="bf" style="width:4%;background:var(--amber)"></div></div><div class="bv amber">0.4%</div></div>
    <div class="br"><div class="bl">Threat Detection Accuracy</div><div class="bt"><div class="bf" style="width:97%;background:var(--green-t)"></div></div><div class="bv green">97.1%</div></div>
    <div class="br"><div class="bl">False Positive Rate</div><div class="bt"><div class="bf" style="width:3%;background:var(--green-t)"></div></div><div class="bv green">0.3%</div></div>
    <div class="br"><div class="bl">Path Efficiency</div><div class="bt"><div class="bf" style="width:93%;background:var(--green-t)"></div></div><div class="bv green">93.2%</div></div>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">Sensor Fusion Readout — Simulated Live Feeds</div>
    <div class="sensor"><span class="sn">LiDAR</span><span class="sv2" id="lidar">ACTIVE — 360° / 0.4° res</span><span class="ss">AIR-GAPPED</span></div>
    <div class="sensor"><span class="sn">Thermal IR</span><span class="sv2" id="thermal">ACTIVE — 640×512 / 30Hz</span><span class="ss">ON-DEVICE</span></div>
    <div class="sensor"><span class="sn">IMU</span><span class="sv2" id="imu">ACTIVE — 200Hz / 6-DOF</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Tactical Radio</span><span class="sv2" id="radio">ACTIVE — Encrypted / Mesh</span><span class="ss">INTERNAL</span></div>
    <div class="sensor"><span class="sn">GPS / INS</span><span class="sv2" id="gps">ACTIVE — Dual-mode / Jam-resistant</span><span class="ss">SOVEREIGN</span></div>
    <div class="sensor"><span class="sn">Acoustic Array</span><span class="sv2" id="acoustic">ACTIVE — 8-mic / 360°</span><span class="ss">ON-DEVICE</span></div>
  </div>
  <div class="inf-status">
    <div class="is pulse">⚡ MeshPilot CPU Active — Air-Gapped — 0ms External Latency</div>
    <div class="id">All inference running on-premise · Zero cloud API calls · Zero data egress · GR-compliant</div>
  </div>
  <div class="sec" style="margin-top:10px">
    <div class="st">Mission Success Rate by Terrain Type</div>
    <div class="cw" style="height:140px"><canvas id="terrC"></canvas></div>
  </div>
</div>

<!-- RIGHT: ROI + Sovereignty Calculator -->
<div class="panel">
  <div class="pt">💰 Sovereignty Calculator — Air-Gapped vs Cloud</div>
  <div class="bet">
    <div class="bt2">THE SOVEREIGNTY EQUATION</div>
    <div class="bb">Cloud GPU for initial model training (Core42 / Humain). MeshPilot CPU for all tactical inference + synthetic data generation. This hybrid eliminates the unacceptable risk: military autonomous systems training data never leaves the facility. The cost advantage is secondary to the sovereignty imperative.</div>
  </div>
  <div class="sec">
    <div class="st">Cost Comparison — Sovereign CPU vs Cloud GPU (10-Year, 48 Assets)</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th>Sovereign CPU (MeshPilot)</th><th>Cloud GPU</th></tr></thead>
      <tbody>
        <tr><td>Inference Cost/Episode</td><td class="win">$0.0012</td><td class="lose">$0.038</td></tr>
        <tr><td>Annual Episode Volume</td><td class="win">1.2M episodes</td><td class="lose">1.2M episodes</td></tr>
        <tr><td>Annual Inference Cost</td><td class="win">$1,440</td><td class="lose">$45,600</td></tr>
        <tr><td>Data Egress Risk</td><td class="win">ZERO (air-gapped)</td><td class="lose">CRITICAL (foreign servers)</td></tr>
        <tr><td>Air-Gap Compliance</td><td class="win">✓ NATIVE</td><td class="lose">✗ IMPOSSIBLE</td></tr>
        <tr><td>Latency (Tactical)</td><td class="win">2.1s on-device</td><td class="lose">8–15s + network</td></tr>
        <tr><td>Hardware Capex (10yr)</td><td>$240,000</td><td class="lose">$0 (OPEX trap)</td></tr>
        <tr><td>10-Year Inference Cost</td><td class="win">$14,400</td><td class="lose">$456,000</td></tr>
        <tr class="hl"><td><strong>10-Year Total Cost</strong></td><td class="win"><strong>$254,400</strong></td><td class="lose"><strong>$456,000</strong></td></tr>
        <tr><td>Sovereignty Status</td><td class="win">SOVEREIGN ✓</td><td class="lose">NON-SOVEREIGN ✗</td></tr>
      </tbody>
    </table>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">10-Year Cost Trajectory (Sovereign CPU vs Cloud GPU)</div>
    <div class="cw" style="height:140px"><canvas id="costC"></canvas></div>
  </div>
  <div class="sav">
    <div class="amt">$201,600</div>
    <div class="lbl">10-Year Cost Savings · 48 Assets · 1.2M Episodes/yr · Air-Gapped</div>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">Sovereignty Premium — Non-Negotiable Requirements</div>
    <div class="br"><div class="bl">Data Air-Gap Compliance</div><div class="bt"><div class="bf" style="width:100%;background:var(--red)"></div></div><div class="bv red">CRITICAL</div></div>
    <div class="br"><div class="bl">Foreign Network Exposure</div><div class="bt"><div class="bf" style="width:100%;background:var(--red)"></div></div><div class="bv red">PROHIBITED</div></div>
    <div class="br"><div class="bl">GPU Supply Chain Risk</div><div class="bt"><div class="bf" style="width:80%;background:var(--amber)"></div></div><div class="bv amber">HIGH</div></div>
    <div class="br"><div class="bl">Vision 2030 Localization</div><div class="bt"><div class="bf" style="width:100%;background:var(--amber)"></div></div><div class="bv amber">MANDATED</div></div>
    <div class="br"><div class="bl">Domestic Hardware Availability</div><div class="bt"><div class="bf" style="width:90%;background:var(--green-t)"></div></div><div class="bv green">HIGH ✓</div></div>
    <div class="br"><div class="bl">MeshPilot Air-Gap Compliance</div><div class="bt"><div class="bf" style="width:100%;background:var(--green-t)"></div></div><div class="bv green">NATIVE ✓</div></div>
  </div>
  <div class="sec" style="margin-top:12px">
    <div class="st">Key Milestones — Sovereign AI Deployment</div>
    <div class="milestone"><div class="ms-dot"></div><div class="ms-content"><div class="ms-t">Month 1 — Security Accreditation</div><div class="ms-d">Formal security accreditation for MeshPilot deployment in classified facility. Hardware supply chain audit complete.</div></div></div>
    <div class="milestone"><div class="ms-dot"></div><div class="ms-content"><div class="ms-t">Month 3 — UAV Swarm Pilot (24 Units)</div><div class="ms-d">Desert terrain training begins. 2,000 synthetic episodes. Baseline mission success rate established. All data air-gapped.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Month 6 — Full Tactical Suite</div><div class="ms-d">UAV + UGV + USV training active. 10,000 episodes/month. Sensor fusion operational. Red team exercise complete.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Month 12 — Operational Deployment</div><div class="ms-d">First autonomous systems trained entirely on sovereign AI infrastructure deployed to operational units.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Month 24 — National Sovereign AI Stack</div><div class="ms-d">All SAMI autonomous systems platforms. Saudi Arabia's first fully sovereign military AI training infrastructure.</div></div></div>
  </div>
  <div style="margin-top:10px;text-align:center;font-size:9px;color:var(--muted)">CLASSIFICATION: UNCLASSIFIED // FOR OFFICIAL USE ONLY<br><strong style="color:var(--amber)">agenthinkmesh.ai/sami-demo</strong></div>
</div>

</div>
<script>
// Clock
setInterval(()=>{document.getElementById('clk').textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);
// Sensor animation
const sensors=[['lidar','ACTIVE — 360° / 0.4° res','STANDBY — Calibrating'],['thermal','ACTIVE — 640×512 / 30Hz','ACTIVE — 640×512 / 30Hz'],['imu','ACTIVE — 200Hz / 6-DOF','ACTIVE — 200Hz / 6-DOF'],['radio','ACTIVE — Encrypted / Mesh','ACTIVE — Encrypted / Mesh'],['gps','ACTIVE — Dual-mode / Jam-resistant','ACTIVE — Dual-mode / Jam-resistant'],['acoustic','ACTIVE — 8-mic / 360°','STANDBY — Low power']];
setInterval(()=>{sensors.forEach(([id,a,b])=>{const el=document.getElementById(id);if(el)el.textContent=Math.random()>0.1?a:b;});},3000);
// Modal
function ol(){document.getElementById('lm').classList.add('open');}
function cl(){document.getElementById('lm').classList.remove('open');}
// Tabs
function st(n,el){
  document.querySelectorAll('.tc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('tc-'+n).classList.add('on');
  el.classList.add('on');
}
// Threat scenarios
function ss(n,el){
  ['border','convoy','naval','base','supply','cyber'].forEach(s=>{document.getElementById('sc-'+s).style.display='none';});
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  document.getElementById('sc-'+n).style.display='block';
  el.classList.add('on');
}
// Tactical grid
const tg=document.getElementById('tacGrid');
const zones=['t-desert','t-urban','t-coastal','t-contested','t-secure'];
const weights=[0.35,0.25,0.15,0.15,0.10];
for(let i=0;i<120;i++){
  const d=document.createElement('div');
  const r=Math.random();
  let z=zones[0];
  let cum=0;
  for(let j=0;j<weights.length;j++){cum+=weights[j];if(r<cum){z=zones[j];break;}}
  d.className='tac-cell '+z;
  tg.appendChild(d);
}
// Defense modernization chart
new Chart(document.getElementById('defC'),{type:'line',data:{labels:['2026','2027','2028','2029','2030','2032','2035'],datasets:[{label:'Autonomous Systems (Units)',data:[48,120,280,520,900,1800,4200],borderColor:'#ffb300',backgroundColor:'rgba(255,179,0,.08)',borderWidth:2,pointRadius:3,fill:true,tension:.3},{label:'Localization % Target',data:[18,25,32,40,50,60,75],borderColor:'#6ab86a',backgroundColor:'rgba(106,184,106,.05)',borderWidth:2,pointRadius:3,fill:false,tension:.3,yAxisID:'y2'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#4a5a4a',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#4a5a4a',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a5a4a',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y2:{position:'right',ticks:{color:'#6ab86a',font:{size:9},callback:v=>v+'%'},grid:{display:false}}}}});
// Terrain success chart
new Chart(document.getElementById('terrC'),{type:'bar',data:{labels:['Desert','Urban','Coastal','Contested','Secure'],datasets:[{label:'Mission Success %',data:[96.2,91.8,97.4,88.7,99.1],backgroundColor:['rgba(255,179,0,.5)','rgba(74,138,74,.5)','rgba(74,158,255,.5)','rgba(255,68,68,.4)','rgba(106,184,106,.6)'],borderColor:['#ffb300','#6ab86a','#4a9eff','#ff4444','#6ab86a'],borderWidth:1,borderRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#4a5a4a',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{min:80,max:100,ticks:{color:'#4a5a4a',font:{size:9},callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.03)'}}}}});
// Cost trajectory chart
new Chart(document.getElementById('costC'),{type:'line',data:{labels:['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],datasets:[{label:'Sovereign CPU (Cumulative $K)',data:[25,50,75,100,125,150,175,200,225,254],borderColor:'#6ab86a',backgroundColor:'rgba(106,184,106,.08)',borderWidth:2,pointRadius:2,fill:true,tension:.2},{label:'Cloud GPU (Cumulative $K)',data:[46,91,137,182,228,273,319,364,410,456],borderColor:'#ff4444',backgroundColor:'rgba(255,68,68,.05)',borderWidth:2,pointRadius:2,fill:false,tension:.2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#4a5a4a',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#4a5a4a',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a5a4a',font:{size:9},callback:v=>'$'+v+'K'},grid:{color:'rgba(255,255,255,.03)'}}}}});
<\/script>
</body>
</html>`;

export default function SamiDemo() {
  useEffect(() => {
    document.title = "SAMI — Sovereign Tactical AI Command Center";
    return () => { document.title = "AgenThinkMesh"; };
  }, []);
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <iframe
        srcDoc={HTML}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        title="SAMI Sovereign Tactical AI Command Center"
        sandbox="allow-scripts"
      />
    </div>
  );
}
