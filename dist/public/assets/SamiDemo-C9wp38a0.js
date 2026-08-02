import{r as i,p as e}from"./react-vendor-BrGGxYsc.js";import"./vendor-Dr5lqDiX.js";import"./date-utils-B2ZejYPs.js";import"./export-libs-DgzmJaah.js";import"./charts-TJkwmQEJ.js";import"./trpc-B-5kfHfL.js";import"./radix-BE0vSiGo.js";import"./flow-LRL6wAp0.js";const s=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SAMI — Sovereign Defense AI Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{
  --bg:#060a07;--border:rgba(255,255,255,.07);
  --green:#1a3a1a;--green-l:#2a5a2a;--green-b:#3a8a3a;--green-t:#5aaa5a;
  --gun:#1a1f1a;--gun-t:#6a7a6a;
  --amber:#d4a017;--amber-l:#f0c040;--amber-t:#f5c842;
  --red:#c0392b;--red-t:#ff6b5b;
  --text:#c8d4c8;--muted:#4a5a4a;--white:#e8f0e8;
  --blue:#2a4a8a;--blue-t:#5a8adf;
  --gold:#d4a017;--gold-l:#f0c040;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,#006400 33%,#ffffff 33%,#ffffff 66%,#006400 66%);}
.hdr{background:linear-gradient(135deg,rgba(26,58,26,.5),rgba(26,31,26,.3));border-bottom:1px solid rgba(90,170,90,.2);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:12px;}
.logo{width:52px;height:52px;background:linear-gradient(135deg,#1a3a1a,#2a5a2a);border:1px solid var(--green-b);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:var(--amber-l);text-align:center;line-height:1.3;}
.htitle{font-size:13px;font-weight:700;color:var(--green-t);letter-spacing:2px;text-transform:uppercase;}
.hsub{color:var(--muted);font-size:9px;margin-top:2px;letter-spacing:1px;text-transform:uppercase;}
.badge{padding:3px 8px;border-radius:2px;font-size:8px;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;}
.b-sa{background:rgba(0,100,0,.15);border:1px solid #006400;color:#5aaa5a;}
.b-sv{background:rgba(90,138,223,.1);border:1px solid var(--blue-t);color:var(--blue-t);}
.b-it{background:rgba(192,57,43,.1);border:1px solid var(--red);color:var(--red-t);}
.b-v30{background:rgba(212,160,23,.1);border:1px solid var(--gold);color:var(--gold-l);}
.b-live{background:rgba(90,170,90,.1);border:1px solid var(--green-t);color:var(--green-t);}
.pulse{animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.mbar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:80px;padding:8px 10px;background:var(--bg);}
.m .v{font-size:14px;font-weight:700;color:var(--green-t);}
.m .v.a{color:var(--amber-t);}.m .v.r{color:var(--red-t);}.m .v.b{color:var(--blue-t);}
.m .l{font-size:8px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:14px;overflow-y:auto;max-height:calc(100vh - 140px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-size:9px;font-weight:700;color:var(--green-t);letter-spacing:3px;text-transform:uppercase;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid rgba(90,170,90,.2);}
.sec{margin-bottom:14px;}
.st{font-size:8px;color:var(--green-b);text-transform:uppercase;letter-spacing:2px;margin-bottom:7px;}
.body{color:var(--text);line-height:1.8;font-size:11px;opacity:.9;}
.tabs{display:flex;gap:1px;background:var(--border);margin-bottom:10px;overflow-x:auto;}
.tab{padding:6px 11px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;}
.tab.on{color:var(--green-t);border-bottom:2px solid var(--green-t);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.03);}
.sl{color:var(--muted);font-size:10px;}.sv{font-weight:600;font-size:10px;}
.green{color:var(--green-t);}.red{color:var(--red-t);}.amber{color:var(--amber-t);}.gold{color:var(--gold-l);}.blue{color:var(--blue-t);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.bl{width:180px;font-size:9px;color:var(--muted);flex-shrink:0;}
.bt{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;}
.bf{height:100%;border-radius:2px;}
.bv{width:70px;text-align:right;font-size:9px;}
.vc{background:rgba(26,58,26,.2);border:1px solid rgba(58,138,58,.2);border-radius:3px;padding:8px;margin-bottom:6px;}
.vc .ag{font-weight:700;font-size:10px;margin-bottom:3px;}
.vc .rt{color:var(--muted);font-size:9px;line-height:1.6;}
.va{border-left:3px solid var(--green-t);}.vco{border-left:3px solid var(--amber-t);}
.tally{display:flex;gap:12px;padding:8px 10px;background:rgba(26,58,26,.2);border:1px solid rgba(58,138,58,.2);border-radius:3px;margin:8px 0;}
.ti{text-align:center;}.ti .n{font-size:18px;font-weight:700;}.ti .l{font-size:8px;color:var(--muted);letter-spacing:1px;}
.judge{background:rgba(90,170,90,.06);border:1px solid rgba(90,170,90,.3);border-radius:3px;padding:9px;margin-top:8px;font-size:10px;line-height:1.7;color:var(--green-t);}
.bet{background:linear-gradient(135deg,rgba(26,58,26,.3),rgba(192,57,43,.06));border:1px solid rgba(90,170,90,.3);border-radius:4px;padding:11px 13px;margin-bottom:12px;}
.bet .bt2{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;}
.bet .bb{font-size:11px;font-weight:700;line-height:1.6;color:var(--green-t);}
.tbl{width:100%;border-collapse:collapse;font-size:10px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:8px;padding:4px 5px;border-bottom:1px solid var(--border);text-align:left;}
.tbl td{padding:4px 5px;border-bottom:1px solid rgba(255,255,255,.02);}
.tbl .win{color:var(--green-t);font-weight:700;}.tbl .lose{color:var(--red-t);}.tbl .hl{background:rgba(90,170,90,.05);}
.sav{background:linear-gradient(135deg,rgba(90,170,90,.08),rgba(192,57,43,.06));border:1px solid rgba(90,170,90,.3);border-radius:4px;padding:10px;margin:8px 0;text-align:center;}
.sav .amt{font-size:24px;font-weight:700;color:var(--green-t);}
.sav .lbl{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:1px;}
.zone-map{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0;}
.zone-cell{border-radius:3px;padding:8px;font-size:9px;}
.zc-s{background:rgba(212,160,23,.08);border:1px solid rgba(212,160,23,.25);}
.zc-r{background:rgba(90,138,223,.08);border:1px solid rgba(90,138,223,.25);}
.zc-e{background:rgba(192,57,43,.08);border:1px solid rgba(192,57,43,.25);}
.zc-n{background:rgba(90,170,90,.08);border:1px solid rgba(90,170,90,.25);}
.zc-title{font-weight:700;margin-bottom:5px;font-size:9px;text-transform:uppercase;letter-spacing:1px;}
.zc-s .zc-title{color:var(--amber-t);}
.zc-r .zc-title{color:var(--blue-t);}
.zc-e .zc-title{color:var(--red-t);}
.zc-n .zc-title{color:var(--green-t);}
.zc-row{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.03);}
.zc-k{color:var(--muted);font-size:8px;}.zc-v{font-size:8px;font-weight:600;}
.sensor{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(26,58,26,.15);border-left:2px solid var(--green-b);margin-bottom:3px;}
.sn{font-size:9px;color:var(--green-t);}.sv2{font-size:9px;color:var(--amber-t);}.ss{font-size:8px;color:var(--muted);}
.scen{display:flex;gap:1px;background:var(--border);margin-bottom:10px;overflow-x:auto;}
.sc{flex:1;min-width:65px;padding:5px 7px;cursor:pointer;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);text-align:center;white-space:nowrap;}
.sc.on{color:var(--green-t);border-bottom:2px solid var(--green-t);}
.threat{background:rgba(26,58,26,.15);border:1px solid rgba(58,138,58,.15);border-radius:3px;padding:8px;margin-bottom:5px;}
.threat .tn{font-size:10px;font-weight:700;margin-bottom:3px;}
.threat .td{font-size:9px;color:var(--muted);line-height:1.6;}
.inf-status{background:rgba(90,170,90,.06);border:1px solid rgba(90,170,90,.3);border-radius:3px;padding:9px;margin:8px 0;text-align:center;}
.inf-status .is{font-size:11px;font-weight:700;color:var(--green-t);letter-spacing:1px;}
.inf-status .id{font-size:9px;color:var(--muted);margin-top:3px;}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100;align-items:center;justify-content:center;}
.modal.open{display:flex;}
.mbox{background:#060a07;border:1px solid var(--green-b);border-radius:4px;padding:26px 32px;max-width:500px;text-align:center;}
.mbox h2{color:var(--green-t);font-size:13px;margin-bottom:9px;letter-spacing:2px;text-transform:uppercase;}
.mbox p{color:var(--muted);font-size:11px;line-height:1.7;margin-bottom:9px;}
.mbox .cbtn{background:rgba(90,170,90,.1);border:1px solid var(--green-b);color:var(--green-t);padding:6px 18px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;}
.lbtn{display:inline-flex;align-items:center;gap:6px;background:rgba(90,170,90,.1);border:1px solid var(--green-b);color:var(--green-t);padding:5px 12px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;}
.cw{position:relative;height:140px;margin-top:7px;}
.milestone{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}
.ms-dot{width:7px;height:7px;border-radius:50%;background:var(--green-t);margin-top:3px;flex-shrink:0;}
.ms-dot.amber{background:var(--amber-t);}
.ms-t{font-size:9px;font-weight:700;color:var(--green-t);}
.ms-d{font-size:8px;color:var(--muted);line-height:1.5;}
.bbar{background:linear-gradient(135deg,rgba(26,58,26,.4),rgba(26,31,26,.3));border-top:1px solid rgba(90,170,90,.15);padding:7px 18px;text-align:center;font-size:9px;color:var(--gun-t);letter-spacing:1px;}
.scan-line{position:fixed;top:0;left:0;right:0;height:2px;background:rgba(90,170,90,.08);animation:scan 10s linear infinite;pointer-events:none;z-index:999;}
@keyframes scan{0%{top:0}100%{top:100vh}}
.itar-block{background:rgba(192,57,43,.08);border:1px solid rgba(192,57,43,.3);border-radius:3px;padding:8px;margin:6px 0;}
.itar-block .it{font-size:9px;font-weight:700;color:var(--red-t);margin-bottom:3px;text-transform:uppercase;letter-spacing:1px;}
.itar-block .id2{font-size:9px;color:var(--muted);line-height:1.6;}
</style>
</head>
<body>
<div class="scan-line"></div>
<div class="stripe"></div>
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>SOVEREIGN DEFENSE AI — SAMI KINGDOM DEPLOYMENT</h2>
    <p>MeshPilot deploys on SAMI server infrastructure inside the Kingdom. All training data for RSLF, RSAF, and RSNF autonomous systems is generated and processed inside Saudi territory. Zero ITAR/EAR exposure. Zero foreign cloud dependency. 3ms CPU inference latency.</p>
    <p style="color:var(--green-t);font-weight:700;font-size:11px">SAMI · Saudi Vision 2030 · 50% Localization · Sovereign Defense</p>
    <p style="color:var(--amber-t)">Contact: meshpilot@agenthinkmesh.ai</p>
    <br><button class="cbtn" onclick="cl()">CLOSE</button>
  </div>
</div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">SAMI<br>&#128737;&#65039;<br>KSA</div>
    <div>
      <div class="htitle">SAMI — Sovereign Defense AI Command Center</div>
      <div class="hsub">Saudi Arabia · RSLF · RSAF · RSNF · Vision 2030 · 50% Defense Localization</div>
    </div>
  </div>
  <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-v30">&#11088; Vision 2030</span>
    <span class="badge b-sa">&#127462;&#127480; 50% Localization</span>
    <span class="badge b-sv">&#128274; Sovereign Defense</span>
    <span class="badge b-it">&#9940; Zero ITAR</span>
    <span class="badge b-live pulse">&#9679; SYSTEM ACTIVE</span>
    <span style="color:var(--muted);font-size:9px" id="clk"></span>
  </div>
</div>
<div class="mbar">
  <div class="m"><div class="v a">48</div><div class="l">Border Patrol UAVs</div></div>
  <div class="m"><div class="v">12</div><div class="l">Red Sea USVs</div></div>
  <div class="m"><div class="v">24</div><div class="l">Base UGVs</div></div>
  <div class="m"><div class="v">18</div><div class="l">Gulf Naval UAVs</div></div>
  <div class="m"><div class="v green">2,400km</div><div class="l">Border Coverage</div></div>
  <div class="m"><div class="v green">100%</div><div class="l">Data Inside Kingdom</div></div>
  <div class="m"><div class="v green">ZERO</div><div class="l">ITAR/EAR Exposure</div></div>
  <div class="m"><div class="v green">$201.6K</div><div class="l">Saved vs Cloud GPU</div></div>
</div>
<div class="grid">
<div class="panel">
  <div class="pt">&#128737;&#65039; Tactical Executive Twin — SAMI / Saudi Defense</div>
  <div class="bet">
    <div class="bt2">SOVEREIGN AI MANDATE — VISION 2030 / 50% LOCALIZATION</div>
    <div class="bb">SAMI's mandate under Saudi Vision 2030: 50% localization of defense spending. Autonomous systems for Royal Saudi Land Forces, Royal Saudi Air Force, and Royal Saudi Naval Forces — all training data generated inside the Kingdom on CPU-only infrastructure. Zero training data leaves Saudi territory. Zero foreign cloud dependency. Zero ITAR/EAR exposure.</div>
  </div>
  <button class="lbtn" onclick="ol()">&#9889; Deploy Sovereign Defense AI — Contact SAMI</button>
  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Strategic Brief</div>
    <div class="tab" onclick="st('modern',this)">Localization</div>
    <div class="tab" onclick="st('ops',this)">Tactical Scenarios</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief — SAMI Sovereign Defense AI</div>
    <div class="body">Saudi Arabian Military Industries (SAMI) was established under Vision 2030 to achieve 50% localization of Saudi defense spending by 2030. Autonomous systems are the critical frontier: UAVs, UGVs, and USVs for the Royal Saudi Land Forces (RSLF), Royal Saudi Air Force (RSAF), and Royal Saudi Naval Forces (RSNF).<br><br><strong style="color:var(--amber-t)">The ITAR/EAR Problem:</strong> Every foreign cloud AI vendor — AWS, Azure, Google — is subject to US ITAR (International Traffic in Arms Regulations) and EAR (Export Administration Regulations). Training Saudi defense autonomous systems on foreign cloud infrastructure creates a legal vulnerability: US authorities can restrict, audit, or revoke access to training data and models at any time.<br><br><strong style="color:var(--green-t)">The MeshPilot Solution:</strong> CPU-only inference on SAMI's existing server infrastructure inside the Kingdom. All training data for border patrol UAV swarms, Red Sea USV escorts, base perimeter UGVs, and Arabian Gulf naval ISR is generated, processed, and stored inside Saudi territory. No data crosses any border.<br><br><strong style="color:var(--amber-t)">Operational Context:</strong> Southern border (Najran, Jizan, Asir) requires 24/7 Houthi drone detection across 2,400km. Red Sea commercial shipping lanes require autonomous convoy escort. Eastern Province ARAMCO infrastructure requires counter-drone perimeter. Arabian Gulf naval zone requires unmanned mine detection.</div>
    <div style="margin-top:10px">
      <div class="sr"><div class="sl">Vision 2030 Defense Localization Target</div><div class="sv amber">50% by 2030</div></div>
      <div class="sr"><div class="sl">ITAR/EAR Risk (MeshPilot on-prem)</div><div class="sv green">ZERO</div></div>
      <div class="sr"><div class="sl">ITAR/EAR Risk (foreign cloud GPU)</div><div class="sv red">HIGH — US jurisdiction</div></div>
      <div class="sr"><div class="sl">Training Data Residency (MeshPilot)</div><div class="sv green">100% inside Kingdom</div></div>
      <div class="sr"><div class="sl">Southern Border Coverage</div><div class="sv amber">2,400km (Najran–Jizan–Asir)</div></div>
      <div class="sr"><div class="sl">Border Patrol UAV Readiness</div><div class="sv green">91.7% (48 units)</div></div>
      <div class="sr"><div class="sl">Red Sea USV Readiness</div><div class="sv green">100% (12 units)</div></div>
      <div class="sr"><div class="sl">Base UGV Readiness</div><div class="sv amber">88.9% (24 units, 6 facilities)</div></div>
      <div class="sr"><div class="sl">Arabian Gulf Naval UAV Readiness</div><div class="sv green">94.4% (18 units)</div></div>
      <div class="sr"><div class="sl">Inference Latency (on-prem CPU)</div><div class="sv green">3ms — no network dependency</div></div>
    </div>
  </div>
  <div class="tc" id="tc-modern">
    <div class="st">Vision 2030 — SAMI Defense Localization Trajectory</div>
    <div class="body" style="margin-bottom:10px">SAMI's 50% localization mandate requires not just manufacturing local defense hardware — it requires sovereign AI capability. A UAV trained on foreign cloud infrastructure is not a sovereign asset. MeshPilot enables SAMI to train, update, and operate autonomous system AI entirely inside the Kingdom.</div>
    <div class="itar-block">
      <div class="it">ITAR/EAR RISK — FOREIGN CLOUD TRAINING</div>
      <div class="id2">US ITAR (22 CFR Parts 120-130) and EAR (15 CFR Parts 730-774) govern defense-related AI training data and models. Training Saudi autonomous defense systems on AWS/Azure/Google Cloud creates: (1) US government audit rights over training data, (2) potential export license requirements for AI model updates, (3) risk of access revocation during geopolitical tension.</div>
    </div>
    <div class="sr"><div class="sl">SAMI Defense Localization (2020)</div><div class="sv red">~8%</div></div>
    <div class="sr"><div class="sl">SAMI Defense Localization (2024 est.)</div><div class="sv amber">~36%</div></div>
    <div class="sr"><div class="sl">SAMI Defense Localization Target (2030)</div><div class="sv green">50%</div></div>
    <div class="sr"><div class="sl">Autonomous Systems — Localization Gap</div><div class="sv red">AI training still foreign-cloud dependent</div></div>
    <div class="sr"><div class="sl">MeshPilot Contribution to Localization</div><div class="sv green">100% sovereign AI training stack</div></div>
    <div class="sr"><div class="sl">Saudi Defense Budget (est.)</div><div class="sv amber">~$75B/yr (2024)</div></div>
    <div style="margin-top:10px"><div class="st">SAMI Localization Progress (%) — 2020 to 2030 Target</div><div class="cw"><canvas id="locC"></canvas></div></div>
  </div>
  <div class="tc" id="tc-ops">
    <div class="st">Tactical Scenarios — Saudi Defense Operational Contexts</div>
    <div class="scen">
      <div class="sc on" onclick="ss('border',this)">S. Border</div>
      <div class="sc" onclick="ss('redsea',this)">Red Sea</div>
      <div class="sc" onclick="ss('najran',this)">Najran Base</div>
      <div class="sc" onclick="ss('eastern',this)">E. Province</div>
      <div class="sc" onclick="ss('desert',this)">Desert Log.</div>
      <div class="sc" onclick="ss('gulf',this)">Gulf Naval</div>
    </div>
    <div id="sc-border" class="threat" style="border-left:3px solid var(--amber-t);display:block">
      <div class="tn amber">&#128641; Southern Border Patrol — Najran / Jizan / Asir</div>
      <div class="td">UAV swarm for Houthi drone detection along the Yemen border (Najran, Jizan, Asir governorates). 2,400km border coverage. 48 patrol UAVs at 91.7% readiness. Radar cross-section optimisation for low-observable Houthi drone detection. 24/7 autonomous coverage. 15,000 simulated Houthi drone detection episodes. 96.3% identification accuracy. 2.1s threat classification time. All training data on SAMI servers inside the Kingdom — zero ITAR exposure on border intelligence.</div>
    </div>
    <div id="sc-redsea" class="threat" style="border-left:3px solid var(--blue-t);display:none">
      <div class="tn blue">&#9875; Red Sea Convoy Protection — Commercial Shipping Lanes</div>
      <div class="td">USV escort for commercial shipping against Houthi maritime threats. 12 USVs at 100% readiness. Autonomous perimeter defense for vessels transiting the Bab-el-Mandeb and Red Sea shipping lanes. 8,000 simulated convoy escort episodes. 97.1% anomaly detection accuracy. 0.4% false positive rate on civilian vessels — critical for maintaining commercial shipping relations. All maritime pattern-of-life data processed on SAMI on-prem infrastructure.</div>
    </div>
    <div id="sc-najran" class="threat" style="border-left:3px solid var(--green-t);display:none">
      <div class="tn green">&#127957; Najran Base Perimeter — UGV Sentry &amp; IED Detection</div>
      <div class="td">UGV sentry patrol for 6 critical RSLF facilities in the Najran region. IED detection using ground-penetrating radar and thermal anomaly analysis. Facial recognition for authorised personnel at perimeter checkpoints. 24 UGVs at 88.9% readiness. 12,000 simulated IED/sentry episodes. 94.7% unauthorised detection accuracy. 18% reduction in false alarms. All biometric and facility security data processed on-prem — no personnel data leaves Saudi military facilities.</div>
    </div>
    <div id="sc-eastern" class="threat" style="border-left:3px solid var(--red-t);display:none">
      <div class="tn red">&#128738; Eastern Province — ARAMCO Critical Infrastructure</div>
      <div class="td">Pipeline inspection drones for ARAMCO facility perimeter monitoring in the Eastern Province. Counter-drone systems for protection of Abqaiq, Ras Tanura, and Khurais infrastructure. AI-driven anomaly detection for pipeline integrity and perimeter breach. All ARAMCO facility telemetry processed on SAMI on-prem servers — no critical national infrastructure data leaves the Kingdom. Compliant with Saudi CITC and NCA data localisation requirements.</div>
    </div>
    <div id="sc-desert" class="threat" style="border-left:3px solid var(--amber-t);display:none">
      <div class="tn amber">&#128665; Desert Logistics Autonomy — RSLF Supply Convoys</div>
      <div class="td">Autonomous supply convoy navigation for Royal Saudi Land Forces in GPS-denied desert environments. Sandstorm resilience through multi-sensor fusion (LiDAR, thermal, acoustic). Route optimisation across Rub' al Khali and Nafud desert terrain. GPS-denied operation is a core requirement: foreign cloud dependency creates a single point of failure in contested electromagnetic environments. All navigation and logistics data processed on-prem.</div>
    </div>
    <div id="sc-gulf" class="threat" style="border-left:3px solid var(--blue-t);display:none">
      <div class="tn blue">&#127754; Naval ISR — Arabian Gulf / RSNF Operations</div>
      <div class="td">Unmanned surface vessel patrol for Royal Saudi Naval Forces in the Arabian Gulf. Underwater mine detection using sonar and AI classification. Port security for Saudi naval installations and offshore platform approaches (Jubail to Khobar). 18 naval UAVs at 94.4% readiness. 6,000 simulated mine detection episodes. 93.4% mine classification accuracy. All RSNF operational data and sonar signatures processed on SAMI on-prem infrastructure — zero foreign jurisdiction over Saudi naval intelligence.</div>
    </div>
  </div>
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation — Sovereign Defense AI Across RSLF / RSAF / RSNF</div>
    <div class="body" style="margin-bottom:10px">Deploy MeshPilot sovereign defense AI across all three Saudi armed services: RSLF (southern border + base perimeter + desert logistics), RSAF (border UAV swarms + Eastern Province counter-drone), RSNF (Red Sea USV escort + Arabian Gulf naval ISR). Phase 1: southern border + Red Sea. Phase 2: base perimeter + Eastern Province. Phase 3: full tri-service deployment.</div>
    <div class="vc va"><div class="ag" style="color:var(--amber-t)">&#9989; Royal Saudi Land Forces Rep — APPROVE</div><div class="rt">Southern border UAV swarm and Najran base perimeter UGV deployment addresses highest-priority operational requirements. 96.3% Houthi drone detection accuracy and 2.1s classification time meets operational tempo. All border intelligence data stays inside the Kingdom.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--blue-t)">&#9989; Royal Saudi Air Force Rep — APPROVE</div><div class="rt">RSAF autonomous systems require sovereign AI training. Foreign cloud training for RSAF UAV swarms creates ITAR exposure on classified flight envelope data. MeshPilot on-prem eliminates this vulnerability. Eastern Province counter-drone capability is operationally critical for ARAMCO infrastructure protection.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; Royal Saudi Naval Forces Rep — APPROVE</div><div class="rt">Red Sea USV convoy escort and Arabian Gulf mine detection are immediate operational requirements. 97.1% anomaly detection with 0.4% false positive on civilian vessels meets RSNF rules of engagement constraints. All naval pattern-of-life data processed on-prem.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--amber-t)">&#9989; SAMI CTO — APPROVE</div><div class="rt">MeshPilot deploys on existing SAMI server infrastructure. No new hardware required for Phase 1. CPU-only inference at 3ms latency meets real-time autonomous system requirements. Vision 2030 50% localization mandate requires sovereign AI — this is the highest-value localization target in the SAMI portfolio.</div></div>
    <div class="vc vco"><div class="ag" style="color:var(--amber-t)">&#9888;&#65039; MODON Rep — CONDITIONAL</div><div class="rt">Approve conditional on: (1) formal SAMI data governance policy for tri-service AI training data, (2) NCSC (National Cybersecurity Authority) certification for on-prem AI infrastructure, (3) phased deployment starting with southern border. $201.6K savings vs cloud GPU justifies immediate Phase 1.</div></div>
    <div class="tally">
      <div class="ti"><div class="n green">4</div><div class="l">APPROVE</div></div>
      <div class="ti"><div class="n amber">1</div><div class="l">CONDITIONAL</div></div>
      <div class="ti"><div class="n red">0</div><div class="l">REJECT</div></div>
    </div>
    <div class="judge"><strong>JUDGE — IMMEDIATE PILOT AUTHORISED:</strong> Sovereign defense AI is not a procurement preference — it is a national security mandate. Foreign cloud training is a vulnerability. ITAR/EAR exposure on Saudi defense autonomous system training data is incompatible with Vision 2030 sovereignty objectives. The cost of a sovereign defense AI capability is not measured in riyals — it is measured in operational security. MeshPilot eliminates the foreign dependency.</div>
  </div>
</div>
<div class="panel">
  <div class="pt">&#128506;&#65039; Tactical Simulation Hub — Saudi Operational Zones</div>
  <div class="sec">
    <div class="st">Saudi Arabia — Four Operational Zones</div>
    <div class="zone-map">
      <div class="zone-cell zc-s">
        <div class="zc-title">&#127956;&#65039; Southern Border Zone</div>
        <div class="zc-row"><div class="zc-k">Governorates</div><div class="zc-v amber">Najran, Jizan, Asir</div></div>
        <div class="zc-row"><div class="zc-k">Border Length</div><div class="zc-v amber">2,400km (Yemen)</div></div>
        <div class="zc-row"><div class="zc-k">Terrain</div><div class="zc-v">Mountainous, wadis</div></div>
        <div class="zc-row"><div class="zc-k">Primary Threat</div><div class="zc-v" style="color:var(--red-t)">Houthi UAV swarms</div></div>
        <div class="zc-row"><div class="zc-k">Patrol UAVs</div><div class="zc-v amber">48 units / 91.7%</div></div>
        <div class="zc-row"><div class="zc-k">Detection Accuracy</div><div class="zc-v" style="color:var(--green-t)">96.3%</div></div>
        <div class="zc-row"><div class="zc-k">Classification Time</div><div class="zc-v" style="color:var(--green-t)">2.1s</div></div>
        <div class="zc-row"><div class="zc-k">Training Episodes</div><div class="zc-v">15,000 simulated</div></div>
      </div>
      <div class="zone-cell zc-r">
        <div class="zc-title">&#9875; Red Sea Maritime Zone</div>
        <div class="zc-row"><div class="zc-k">Area</div><div class="zc-v blue">Bab-el-Mandeb to Yanbu</div></div>
        <div class="zc-row"><div class="zc-k">Shipping Lanes</div><div class="zc-v blue">Commercial + military</div></div>
        <div class="zc-row"><div class="zc-k">Primary Threat</div><div class="zc-v" style="color:var(--red-t)">Houthi maritime attacks</div></div>
        <div class="zc-row"><div class="zc-k">USV Fleet</div><div class="zc-v blue">12 units / 100%</div></div>
        <div class="zc-row"><div class="zc-k">Anomaly Detection</div><div class="zc-v" style="color:var(--green-t)">97.1%</div></div>
        <div class="zc-row"><div class="zc-k">Civilian False Positive</div><div class="zc-v" style="color:var(--green-t)">0.4%</div></div>
        <div class="zc-row"><div class="zc-k">Training Episodes</div><div class="zc-v">8,000 simulated</div></div>
        <div class="zc-row"><div class="zc-k">Data Residency</div><div class="zc-v" style="color:var(--green-t)">100% Kingdom</div></div>
      </div>
      <div class="zone-cell zc-e">
        <div class="zc-title">&#128738; Eastern Province Industrial</div>
        <div class="zc-row"><div class="zc-k">Key Asset</div><div class="zc-v" style="color:var(--red-t)">ARAMCO infrastructure</div></div>
        <div class="zc-row"><div class="zc-k">Sites</div><div class="zc-v">Abqaiq, Ras Tanura, Khurais</div></div>
        <div class="zc-row"><div class="zc-k">Primary Threat</div><div class="zc-v" style="color:var(--red-t)">Drone + missile attack</div></div>
        <div class="zc-row"><div class="zc-k">Counter-Drone</div><div class="zc-v" style="color:var(--green-t)">AI perimeter active</div></div>
        <div class="zc-row"><div class="zc-k">Data Classification</div><div class="zc-v" style="color:var(--red-t)">Critical national infra</div></div>
        <div class="zc-row"><div class="zc-k">Cloud Dependency</div><div class="zc-v" style="color:var(--red-t)">PROHIBITED</div></div>
        <div class="zc-row"><div class="zc-k">NCA Compliance</div><div class="zc-v" style="color:var(--green-t)">On-prem SAMI &#10003;</div></div>
        <div class="zc-row"><div class="zc-k">ITAR Exposure</div><div class="zc-v" style="color:var(--green-t)">ZERO &#10003;</div></div>
      </div>
      <div class="zone-cell zc-n">
        <div class="zc-title">&#127754; Arabian Gulf Naval Zone</div>
        <div class="zc-row"><div class="zc-k">Area</div><div class="zc-v green">Jubail to Khobar</div></div>
        <div class="zc-row"><div class="zc-k">Offshore Assets</div><div class="zc-v green">Platforms + port approaches</div></div>
        <div class="zc-row"><div class="zc-k">Primary Threat</div><div class="zc-v" style="color:var(--red-t)">Mines + fast boats</div></div>
        <div class="zc-row"><div class="zc-k">Naval UAVs</div><div class="zc-v green">18 units / 94.4%</div></div>
        <div class="zc-row"><div class="zc-k">Mine Detection</div><div class="zc-v" style="color:var(--green-t)">93.4% accuracy</div></div>
        <div class="zc-row"><div class="zc-k">Training Episodes</div><div class="zc-v">6,000 simulated</div></div>
        <div class="zc-row"><div class="zc-k">RSNF Data</div><div class="zc-v" style="color:var(--green-t)">100% on-prem</div></div>
        <div class="zc-row"><div class="zc-k">Foreign Jurisdiction</div><div class="zc-v" style="color:var(--green-t)">ZERO</div></div>
      </div>
    </div>
  </div>
  <div class="sec">
    <div class="st">Training Metrics — Sovereign AI (All Scenarios)</div>
    <div class="br"><div class="bl">Border: Houthi Drone Detection</div><div class="bt"><div class="bf" style="width:96%;background:var(--amber-t)"></div></div><div class="bv amber">96.3%</div></div>
    <div class="br"><div class="bl">Red Sea: Maritime Anomaly Detection</div><div class="bt"><div class="bf" style="width:97%;background:var(--blue-t)"></div></div><div class="bv blue">97.1%</div></div>
    <div class="br"><div class="bl">Base: IED / Unauthorized Detection</div><div class="bt"><div class="bf" style="width:95%;background:var(--green-t)"></div></div><div class="bv green">94.7%</div></div>
    <div class="br"><div class="bl">Gulf: Mine Classification</div><div class="bt"><div class="bf" style="width:93%;background:var(--green-t)"></div></div><div class="bv green">93.4%</div></div>
    <div class="br"><div class="bl">Red Sea: Civilian False Positive</div><div class="bt"><div class="bf" style="width:4%;background:var(--green-t)"></div></div><div class="bv green">0.4%</div></div>
    <div class="br"><div class="bl">Border: Threat Classification Time</div><div class="bt"><div class="bf" style="width:80%;background:var(--amber-t)"></div></div><div class="bv amber">2.1s</div></div>
  </div>
  <div class="sec">
    <div class="st">Live Sensor Feed — Active Operational Zones</div>
    <div class="sensor"><span class="sn">Southern Border — UAV Swarm #4 (Najran)</span><span class="sv2" id="s1">PATROL — 2,400km / 48 active / 0 threats</span><span class="ss">SOVEREIGN</span></div>
    <div class="sensor"><span class="sn">Red Sea — USV Escort Bravo (Bab-el-Mandeb)</span><span class="sv2" id="s2">ESCORT — 3 vessels / perimeter clear</span><span class="ss">ON-PREM</span></div>
    <div class="sensor"><span class="sn">Najran Base — UGV Sentry Alpha</span><span class="sv2" id="s3">PATROL — perimeter secure / IED clear</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Eastern Province — Counter-Drone Grid</span><span class="sv2" id="s4">ACTIVE — ARAMCO perimeter / 0 incursions</span><span class="ss">SOVEREIGN</span></div>
    <div class="sensor"><span class="sn">Arabian Gulf — Naval UAV Delta (Jubail)</span><span class="sv2" id="s5">ISR — port approach clear / 0 mines detected</span><span class="ss">ON-PREM</span></div>
    <div class="sensor"><span class="sn">Desert Convoy — RSLF Logistics Alpha</span><span class="sv2" id="s6">AUTONOMOUS — GPS-denied nav / sandstorm mode</span><span class="ss">LOCAL</span></div>
  </div>
  <div class="inf-status">
    <div class="is pulse">&#9889; MeshPilot CPU Active — SAMI On-Prem — 3ms Latency — Zero ITAR</div>
    <div class="id">Southern Border (Najran/Jizan/Asir) · Red Sea Maritime · Eastern Province (ARAMCO) · Arabian Gulf (RSNF) · 100% Kingdom data residency · Zero foreign cloud dependency</div>
  </div>
  <div class="sec">
    <div class="st">Asset Readiness — All Four Operational Zones</div>
    <div class="cw" style="height:130px"><canvas id="readyC"></canvas></div>
  </div>
</div>
<div class="panel">
  <div class="pt">&#128274; Sovereignty Calculator — SAMI / Saudi Ministry of Defense</div>
  <div class="bet">
    <div class="bt2">THE SOVEREIGNTY EQUATION — DEFENSE AI</div>
    <div class="bb">The cost of a sovereign defense AI capability is not measured in riyals — it is measured in operational security. MeshPilot eliminates the foreign dependency. $201,600 saved vs foreign GPU cloud is a secondary argument. The primary argument is ITAR/EAR zero-risk and 100% Kingdom data residency.</div>
  </div>
  <div class="itar-block">
    <div class="it">ITAR/EAR EXPOSURE — FOREIGN CLOUD TRAINING</div>
    <div class="id2">Training Saudi defense autonomous system AI on AWS/Azure/Google Cloud creates: (1) US ITAR jurisdiction over defense AI training data, (2) potential export license requirements for AI model updates, (3) US government audit rights over Saudi military operational patterns, (4) risk of access revocation during geopolitical tension. MeshPilot on SAMI on-prem: ZERO ITAR/EAR exposure at any layer.</div>
  </div>
  <div class="sec" style="margin-top:10px">
    <div class="st">Sovereignty Comparison — MeshPilot vs Foreign Cloud GPU</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th>MeshPilot On-Prem</th><th>Foreign Cloud GPU</th></tr></thead>
      <tbody>
        <tr><td>ITAR/EAR Export Control Risk</td><td class="win">ZERO &#10003;</td><td class="lose">HIGH — US jurisdiction</td></tr>
        <tr><td>Saudi Training Data Residency</td><td class="win">100% inside Kingdom</td><td class="lose">0% — foreign servers</td></tr>
        <tr><td>Operational Security</td><td class="win">Training data never crosses border</td><td class="lose">Vulnerable to foreign jurisdiction</td></tr>
        <tr><td>Access Revocation Risk</td><td class="win">ZERO — no foreign dependency</td><td class="lose">HIGH — geopolitical exposure</td></tr>
        <tr><td>Vision 2030 Localization</td><td class="win">100% sovereign AI stack</td><td class="lose">0% — foreign vendor dependency</td></tr>
        <tr><td>Cost per 1M Predictions</td><td class="win">$8,000</td><td class="lose">$320,000</td></tr>
        <tr><td>Inference Latency</td><td class="win">3ms on-prem</td><td class="lose">80-200ms + network</td></tr>
        <tr><td>GPS-Denied Operation</td><td class="win">NATIVE — no cloud needed</td><td class="lose">FAILS — cloud dependency</td></tr>
        <tr><td>NCSA Compliance (Saudi)</td><td class="win">NATIVE &#10003;</td><td class="lose">Requires exemption</td></tr>
        <tr class="hl"><td><strong>10-Year Infrastructure Cost</strong></td><td class="win"><strong>$1,400</strong></td><td class="lose"><strong>$203,000</strong></td></tr>
      </tbody>
    </table>
  </div>
  <div class="sav">
    <div class="amt">$201,600</div>
    <div class="lbl">10-Year Infrastructure Savings · 41x Cheaper · ITAR/EAR Risk: ZERO · 100% Kingdom Data Residency</div>
  </div>
  <div class="sec" style="margin-top:10px">
    <div class="st">10-Year Cumulative Cost — Infrastructure Only</div>
    <div class="cw" style="height:130px"><canvas id="costC"></canvas></div>
  </div>
  <div class="sec" style="margin-top:10px">
    <div class="st">Sovereignty Metrics — Saudi Defense Requirements</div>
    <div class="br"><div class="bl">ITAR/EAR Exposure (MeshPilot)</div><div class="bt"><div class="bf" style="width:1%;background:var(--green-t)"></div></div><div class="bv green">ZERO &#10003;</div></div>
    <div class="br"><div class="bl">ITAR/EAR Exposure (Foreign Cloud)</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">CRITICAL &#10007;</div></div>
    <div class="br"><div class="bl">Border Intelligence Data Residency</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">MANDATED LOCAL</div></div>
    <div class="br"><div class="bl">ARAMCO Infra Data (Critical National)</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">PROHIBITED EXPORT</div></div>
    <div class="br"><div class="bl">RSNF Naval Pattern-of-Life Data</div><div class="bt"><div class="bf" style="width:100%;background:var(--red-t)"></div></div><div class="bv red">CLASSIFIED</div></div>
    <div class="br"><div class="bl">MeshPilot Kingdom Compliance</div><div class="bt"><div class="bf" style="width:100%;background:var(--green-t)"></div></div><div class="bv green">NATIVE &#10003;</div></div>
    <div class="br"><div class="bl">Vision 2030 Localization Contribution</div><div class="bt"><div class="bf" style="width:100%;background:var(--green-t)"></div></div><div class="bv green">100% &#10003;</div></div>
  </div>
  <div class="sec" style="margin-top:10px">
    <div class="st">Deployment Milestones — SAMI Sovereign AI Rollout</div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Month 1 — NCSA Certification + Infrastructure Audit</div><div class="ms-d">National Cybersecurity Authority certification for SAMI on-prem AI infrastructure. Server capacity audit at SAMI facilities. No new hardware required for Phase 1.</div></div></div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Month 3 — Phase 1: Southern Border + Red Sea</div><div class="ms-d">MeshPilot on SAMI servers for border UAV swarm (Najran/Jizan/Asir) and Red Sea USV escort. 96.3% Houthi drone detection live. 97.1% maritime anomaly detection live.</div></div></div>
    <div class="milestone"><div class="ms-dot amber"></div><div><div class="ms-t">Month 6 — Phase 2: Base Perimeter + Eastern Province</div><div class="ms-d">Najran base UGV sentry + IED detection. Eastern Province ARAMCO counter-drone perimeter. 94.7% unauthorized detection live.</div></div></div>
    <div class="milestone"><div class="ms-dot amber"></div><div><div class="ms-t">Month 9 — Phase 3: Arabian Gulf + Desert Logistics</div><div class="ms-d">RSNF Arabian Gulf naval ISR + mine detection. RSLF desert logistics autonomous convoy. Full tri-service deployment.</div></div></div>
    <div class="milestone"><div class="ms-dot amber"></div><div><div class="ms-t">Year 3 — Full Sovereign Defense AI Stack</div><div class="ms-d">All RSLF/RSAF/RSNF autonomous systems training on SAMI on-prem. Zero ITAR/EAR exposure. 100% Vision 2030 localization contribution for AI layer.</div></div></div>
  </div>
  <div style="margin-top:8px;text-align:center;font-size:9px;color:var(--muted)">SAMI · Saudi Vision 2030 · 50% Defense Localization · RSLF · RSAF · RSNF<br><strong style="color:var(--green-t)">Sovereign Defense AI · Zero ITAR · Zero Cloud Dependency · agenthinkmesh.ai/sami-demo</strong></div>
</div>
</div>
<div class="bbar">All AI training runs on SAMI CPU infrastructure inside the Kingdom — Southern Border (Najran/Jizan/Asir) · Red Sea Maritime · Eastern Province (ARAMCO) · Arabian Gulf (RSNF). Zero ITAR/EAR exposure. &nbsp;·&nbsp; <strong style="color:var(--green-t)">Saudi Vision 2030 · 50% Localization · Sovereign Defense AI</strong></div>
<script>
setInterval(()=>{const el=document.getElementById('clk');if(el)el.textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);
const sensors=[
  ['s1','PATROL — 2,400km / 48 active / 0 threats','ALERT — Houthi UAV signature detected (Najran sector) — classifying...'],
  ['s2','ESCORT — 3 vessels / perimeter clear','ESCORT — 3 vessels / anomaly detected — classifying vessel type'],
  ['s3','PATROL — perimeter secure / IED clear','ALERT — thermal anomaly at gate 3 — UGV responding'],
  ['s4','ACTIVE — ARAMCO perimeter / 0 incursions','ALERT — small UAV detected (Abqaiq sector) — counter-drone engaging'],
  ['s5','ISR — port approach clear / 0 mines detected','ISR — sonar contact at approach channel — classifying'],
  ['s6','AUTONOMOUS — GPS-denied nav / sandstorm mode','AUTONOMOUS — GPS-denied nav / rerouting around obstacle'],
];
setInterval(()=>{sensors.forEach(([id,a,b])=>{const el=document.getElementById(id);if(el)el.textContent=Math.random()>0.08?a:b;});},4200);
function ol(){document.getElementById('lm').classList.add('open');}
function cl(){document.getElementById('lm').classList.remove('open');}
function st(n,el){
  document.querySelectorAll('.tc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('tc-'+n).classList.add('on');
  el.classList.add('on');
}
function ss(n,el){
  ['border','redsea','najran','eastern','desert','gulf'].forEach(s=>{
    const el2=document.getElementById('sc-'+s);
    if(el2)el2.style.display='none';
  });
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  const target=document.getElementById('sc-'+n);
  if(target)target.style.display='block';
  el.classList.add('on');
}
new Chart(document.getElementById('locC'),{
  type:'line',
  data:{
    labels:['2020','2021','2022','2023','2024','2025','2026','2027','2028','2029','2030'],
    datasets:[
      {label:'SAMI Localization %',data:[8,12,18,26,36,42,45,47,48,49,50],borderColor:'#5aaa5a',backgroundColor:'rgba(90,170,90,.08)',borderWidth:2,pointRadius:2,fill:true,tension:.3},
      {label:'Vision 2030 Target (50%)',data:[null,null,null,null,null,null,null,null,null,null,50],borderColor:'#f5c842',backgroundColor:'transparent',borderWidth:1,borderDash:[4,4],pointRadius:0,fill:false},
    ]
  },
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#4a5a4a',font:{size:8},boxWidth:8}}},scales:{x:{ticks:{color:'#4a5a4a',font:{size:8}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a5a4a',font:{size:8},callback:function(v){return v+'%'}},grid:{color:'rgba(255,255,255,.03)'},min:0,max:55}}}
});
new Chart(document.getElementById('readyC'),{
  type:'bar',
  data:{
    labels:['Border UAVs (48)','Red Sea USVs (12)','Base UGVs (24)','Gulf UAVs (18)'],
    datasets:[{label:'Readiness %',data:[91.7,100,88.9,94.4],backgroundColor:['rgba(245,200,66,.5)','rgba(90,138,223,.5)','rgba(90,170,90,.5)','rgba(90,170,90,.4)'],borderColor:['#f5c842','#5a8adf','#5aaa5a','#5aaa5a'],borderWidth:1,borderRadius:2}]
  },
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#4a5a4a',font:{size:8}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a5a4a',font:{size:8},callback:function(v){return v+'%'}},grid:{color:'rgba(255,255,255,.03)'},min:80,max:102}}}
});
new Chart(document.getElementById('costC'),{
  type:'line',
  data:{
    labels:['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],
    datasets:[
      {label:'MeshPilot On-Prem ($K)',data:[0.14,0.28,0.42,0.56,0.70,0.84,0.98,1.12,1.26,1.40],borderColor:'#5aaa5a',backgroundColor:'rgba(90,170,90,.08)',borderWidth:2,pointRadius:2,fill:true,tension:.2},
      {label:'Foreign Cloud GPU ($K)',data:[20.3,40.6,60.9,81.2,101.5,121.8,142.1,162.4,182.7,203.0],borderColor:'#e74c3c',backgroundColor:'rgba(231,76,60,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.2}
    ]
  },
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#4a5a4a',font:{size:8},boxWidth:8}}},scales:{x:{ticks:{color:'#4a5a4a',font:{size:8}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a5a4a',font:{size:8},callback:function(v){return '$'+v+'K'}},grid:{color:'rgba(255,255,255,.03)'}}}}
});
<\/script>
</body>
</html>`;function v(){return i.useEffect(()=>(document.title="SAMI — Sovereign Defense AI Command Center",()=>{document.title="AgenThinkMesh"}),[]),e.jsxDEV("div",{"data-loc":"client/src/pages/SamiDemo.tsx:464",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:e.jsxDEV("iframe",{"data-loc":"client/src/pages/SamiDemo.tsx:465",srcDoc:s,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"SAMI Sovereign Defense AI Command Center",sandbox:"allow-scripts"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/SamiDemo.tsx",lineNumber:465,columnNumber:7},this)},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/SamiDemo.tsx",lineNumber:464,columnNumber:5},this)}export{v as default};
