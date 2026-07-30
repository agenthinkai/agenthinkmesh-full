import { useEffect } from "react";

const KSA_HTML = `<!DOCTYPE html>
<html lang="en" id="htmlRoot">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Human KSA — Sovereign AI Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{
  --bg:#060f0a;
  --surface:rgba(255,255,255,0.04);
  --border:rgba(255,255,255,0.08);
  --green:#1a7a3c;
  --green-light:#2ea84f;
  --green-glow:#00c853;
  --white:#ffffff;
  --gold:#c9a84c;
  --teal:#00c9a7;
  --red:#ff4d6d;
  --blue:#4d9fff;
  --text:#e8f0ec;
  --muted:#7a9485;
  --amber:#ffab00;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code',monospace;font-size:13px;min-height:100vh;}

/* Saudi flag stripe at top */
.flag-stripe{height:4px;background:linear-gradient(90deg,#006C35 0%,#006C35 50%,#ffffff 50%,#ffffff 100%);}

.header{background:linear-gradient(135deg,rgba(26,122,60,.2),rgba(0,200,83,.06));border-bottom:1px solid rgba(26,122,60,.5);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.header-left{display:flex;align-items:center;gap:14px;}
.ksa-emblem{width:38px;height:38px;background:rgba(26,122,60,.3);border:1px solid var(--green-light);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;}
.header-title{font-size:16px;font-weight:700;color:var(--green-glow);letter-spacing:2px;text-transform:uppercase;}
.header-sub{color:var(--muted);font-size:10px;margin-top:2px;}
.badge{background:rgba(0,200,83,.15);border:1px solid var(--green-glow);color:var(--green-glow);padding:3px 10px;border-radius:12px;font-size:10px;}
.badge-v2030{background:rgba(201,168,76,.15);border:1px solid var(--gold);color:var(--gold);padding:3px 10px;border-radius:12px;font-size:10px;}
.lang-toggle{background:rgba(26,122,60,.2);border:1px solid var(--green-light);color:var(--green-glow);padding:5px 14px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;}

.metrics-bar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.metric{flex:1;min-width:100px;padding:10px 14px;background:var(--bg);text-align:center;}
.metric .val{font-size:18px;font-weight:700;color:var(--green-glow);}
.metric .lbl{font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}

.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:18px;overflow-y:auto;max-height:calc(100vh - 148px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}

.panel-title{font-size:10px;font-weight:700;color:var(--green-glow);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(26,122,60,.3);}
.section{margin-bottom:18px;}
.section-title{font-size:9px;color:var(--teal);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
.body-text{color:var(--text);line-height:1.75;font-size:12px;opacity:.9;}
.body-text-ar{color:var(--text);line-height:1.9;font-size:13px;opacity:.9;direction:rtl;text-align:right;font-family:'Segoe UI',Tahoma,sans-serif;}

.tab-bar{display:flex;gap:1px;background:var(--border);margin-bottom:14px;overflow-x:auto;}
.tab{padding:7px 14px;cursor:pointer;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;}
.tab.active{color:var(--green-glow);border-bottom:2px solid var(--green-glow);}
.tab-content{display:none;}.tab-content.active{display:block;}

.stat-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);}
.stat-label{color:var(--muted);}
.stat-value{font-weight:600;}
.green{color:var(--green-glow);}.red{color:var(--red);}.amber{color:var(--amber);}.gold{color:var(--gold);}

.bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.bar-label{width:130px;font-size:10px;color:var(--muted);flex-shrink:0;}
.bar-track{flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;}
.bar-fill{height:100%;border-radius:3px;}
.bar-val{width:80px;text-align:right;font-size:10px;color:var(--text);}

.vote-card{background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:10px;margin-bottom:7px;}
.vote-card .agent{font-weight:700;font-size:11px;margin-bottom:3px;}
.vote-card .rationale{color:var(--muted);font-size:10px;line-height:1.55;}
.vote-approve{border-left:3px solid var(--green-glow);}
.vote-conditional{border-left:3px solid var(--amber);}
.tally{display:flex;gap:16px;padding:10px 14px;background:rgba(0,200,83,.05);border:1px solid rgba(0,200,83,.2);border-radius:5px;margin:10px 0;}
.tally-item{text-align:center;}
.tally-item .n{font-size:22px;font-weight:700;}
.tally-item .l{font-size:9px;color:var(--muted);}
.judge-box{background:rgba(26,122,60,.12);border:1px solid rgba(26,122,60,.4);border-radius:5px;padding:12px;margin-top:10px;font-size:11px;line-height:1.7;color:var(--green-glow);}

.rack-grid{font-family:monospace;font-size:8px;line-height:1.05;letter-spacing:.5px;overflow-x:auto;}
.rack-legend{display:flex;gap:12px;margin-bottom:6px;flex-wrap:wrap;}
.rack-legend span{font-size:9px;}
.r-active{color:#00c853;}.r-standby{color:#ffab00;}.r-reserved{color:#4d9fff;}.r-critical{color:#ff4d6d;}.r-offline{color:#333;}

.roi-table{width:100%;border-collapse:collapse;font-size:11px;}
.roi-table th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:9px;padding:5px 7px;border-bottom:1px solid var(--border);text-align:left;}
.roi-table td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.03);}
.roi-table .win{color:var(--green-glow);font-weight:700;}
.roi-table .lose{color:var(--red);}

.live-btn{display:inline-flex;align-items:center;gap:8px;background:rgba(26,122,60,.15);border:1px solid var(--green-light);color:var(--green-glow);padding:7px 18px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;}
.live-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center;}
.live-modal.open{display:flex;}
.live-modal-box{background:#060f0a;border:1px solid var(--green-light);border-radius:8px;padding:32px 40px;max-width:480px;text-align:center;}
.live-modal-box h2{color:var(--green-glow);font-size:16px;margin-bottom:12px;letter-spacing:1px;}
.live-modal-box p{color:var(--muted);font-size:12px;line-height:1.7;margin-bottom:20px;}
.live-modal-box .close-btn{background:rgba(26,122,60,.2);border:1px solid var(--green-light);color:var(--green-glow);padding:8px 24px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:1px;}
.live-modal-box .contact{color:var(--teal);font-size:11px;margin-top:12px;}
.chart-wrap{position:relative;height:180px;margin-top:8px;}

.sovereignty-badge{background:rgba(0,108,53,.2);border:1px solid #006C35;border-radius:4px;padding:8px 12px;font-size:10px;color:#2ea84f;margin-bottom:10px;line-height:1.6;}
.v2030-tag{background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);border-radius:3px;padding:2px 7px;font-size:9px;color:var(--gold);display:inline-block;margin-bottom:6px;}
</style>
</head>
<body>
<div class="flag-stripe"></div>

<div class="live-modal" id="liveModal" onclick="if(event.target===this)closeLive()">
  <div class="live-modal-box">
    <h2>⚡ SOVEREIGN CPU INFERENCE</h2>
    <p>Real-time AI inference using <strong>Llama 3.2 1B GGUF</strong> on standard x86 CPU — no GPU, no cloud, no data leaving the Kingdom.</p>
    <p>Fully compliant with <strong style="color:var(--green-glow)">SDAIA National AI Policy</strong> and <strong style="color:var(--green-glow)">NCA Cloud Cybersecurity Controls</strong>. All inference runs on-premises within Saudi Arabia.</p>
    <p style="color:var(--green-glow);font-size:12px;font-weight:700;">Full sovereign deployment available on-premises.</p>
    <div class="contact">Contact us → <strong>ksa@agenthinkmesh.ai</strong></div>
    <br><button class="close-btn" onclick="closeLive()">CLOSE</button>
  </div>
</div>

<div class="header">
  <div class="header-left">
    <div class="ksa-emblem">🌴</div>
    <div>
      <div class="header-title" id="headerTitle">Human KSA — Sovereign AI Command Center</div>
      <div class="header-sub" id="headerSub">MeshPilot Unified Platform · CPU-Only · Air-Gapped · Vision 2030 Aligned</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <span class="badge-v2030">رؤية 2030</span>
    <span class="badge">● DATA LIVE</span>
    <button class="lang-toggle" onclick="toggleLang()" id="langBtn">العربية</button>
    <span style="color:var(--muted);font-size:10px" id="clock"></span>
  </div>
</div>

<div class="metrics-bar">
  <div class="metric"><div class="val">$18B</div><div class="lbl" id="m1">AI Investment</div></div>
  <div class="metric"><div class="val">19.2%</div><div class="lbl" id="m2">Digital GDP Target</div></div>
  <div class="metric"><div class="val">467MW</div><div class="lbl" id="m3">KSA DC Capacity</div></div>
  <div class="metric"><div class="val">50MW</div><div class="lbl" id="m4">Riyadh Phase 1</div></div>
  <div class="metric"><div class="val">26,500km²</div><div class="lbl" id="m5">NEOM Area</div></div>
  <div class="metric"><div class="val">1,200</div><div class="lbl" id="m6">NEOM AMRs</div></div>
  <div class="metric"><div class="val">38.5%</div><div class="lbl" id="m7">CPU IRR</div></div>
  <div class="metric"><div class="val">100K</div><div class="lbl" id="m8">Tech Jobs Target</div></div>
</div>

<div class="grid">

  <!-- LEFT: Executive Twin -->
  <div class="panel">
    <div class="panel-title" id="p1title">🏛️ Executive Digital Twin — Human KSA</div>
    <button class="live-btn" onclick="openLive()">⚡ <span id="liveLabel">Sovereign Inference Mode</span></button>
    <div class="sovereignty-badge" id="sovBadge">
      🔒 <strong>Data Sovereignty Guarantee:</strong> All AI inference runs on-premises within the Kingdom. Zero data egress. Compliant with SDAIA National AI Policy and NCA Cloud Cybersecurity Controls (CCC-1).
    </div>
    <div class="tab-bar">
      <div class="tab active" onclick="showTab('brief',this)" id="tab-brief-btn">Brief</div>
      <div class="tab" onclick="showTab('v2030',this)" id="tab-v2030-btn">Vision 2030</div>
      <div class="tab" onclick="showTab('risk',this)" id="tab-risk-btn">Risk</div>
      <div class="tab" onclick="showTab('rec',this)" id="tab-rec-btn">Recommendation</div>
    </div>

    <div class="tab-content active" id="tab-brief">
      <div class="section-title" id="briefTitle">Strategic Brief</div>
      <div class="body-text" id="briefEn">Human KSA is executing a sovereign AI infrastructure mandate aligned with Vision 2030's National AI Strategy. The Riyadh Phase 1 data centre — 50MW, 1,200 CPU-only racks, powered by renewable energy — represents the first fully sovereign, GPU-free AI compute facility in the Kingdom. With Saudi Arabia ranked 2nd globally in data centre capacity growth (467MW as of Q1 2026, +6% since January), and the national AI investment target set at $18 billion, Human KSA is positioned to capture the government and enterprise workloads that cannot leave the Kingdom under SDAIA and NCA regulations. The CPU-only architecture eliminates GPU export control risk (EAR99/BIS) entirely — a structural advantage that no cloud provider can replicate without violating Saudi data residency law.</div>
      <div class="body-text-ar" id="briefAr" style="display:none">تنفذ هيومن المملكة العربية السعودية تفويضاً سيادياً للبنية التحتية للذكاء الاصطناعي متوافقاً مع الاستراتيجية الوطنية للذكاء الاصطناعي ضمن رؤية 2030. يمثل مركز البيانات في الرياض - المرحلة الأولى - بقدرة 50 ميغاواط و1,200 رف معالج مركزي فقط، مدعوماً بالطاقة المتجددة، أول منشأة حوسبة ذكاء اصطناعي سيادية وخالية من وحدات معالجة الرسومات في المملكة. مع تصنيف المملكة العربية السعودية في المرتبة الثانية عالمياً في نمو طاقة مراكز البيانات، تتمتع هيومن المملكة بميزة استراتيجية لا يمكن لأي مزود سحابي تكرارها.</div>
    </div>

    <div class="tab-content" id="tab-v2030">
      <div class="v2030-tag">رؤية 2030 — Vision 2030 AI Targets</div>
      <div class="stat-row"><div class="stat-label">National AI Investment</div><div class="stat-value gold">$18 Billion</div></div>
      <div class="stat-row"><div class="stat-label">Digital Economy % of GDP</div><div class="stat-value gold">19.2% target by 2030</div></div>
      <div class="stat-row"><div class="stat-label">New Tech Jobs Target</div><div class="stat-value green">100,000+</div></div>
      <div class="stat-row"><div class="stat-label">AI Company Funding (2024)</div><div class="stat-value green">$9.1 Billion (+56%)</div></div>
      <div class="stat-row"><div class="stat-label">DC Capacity Target by 2030</div><div class="stat-value green">1,300 MW (1.3 GW)</div></div>
      <div class="stat-row"><div class="stat-label">Current DC Capacity (Q1 2026)</div><div class="stat-value">467 MW (Rank #2 globally)</div></div>
      <div class="stat-row"><div class="stat-label">Smart Cities Market (2025)</div><div class="stat-value">$9.6 Billion</div></div>
      <div class="stat-row"><div class="stat-label">Smart Cities Market (2032)</div><div class="stat-value gold">$32.6 Billion</div></div>
      <div class="stat-row"><div class="stat-label">NEOM Autonomous Mobility</div><div class="stat-value green">100% electric + shared</div></div>
      <div class="stat-row"><div class="stat-label">Public Transport Autonomy</div><div class="stat-value">15% autonomous by 2030</div></div>
      <div style="margin-top:12px">
        <div class="section-title">GDP Contribution — Digital Economy</div>
        <div class="chart-wrap" style="height:140px"><canvas id="gdpChart"></canvas></div>
      </div>
    </div>

    <div class="tab-content" id="tab-risk">
      <div class="section-title">Risk Assessment</div>
      <div class="body-text">Three material risks. First: SDAIA and NCA data residency regulations are a structural tailwind — any workload touching government or financial data cannot legally use foreign cloud. Human KSA's on-premises CPU architecture is the only compliant option. Second: the 1,300MW national DC target by 2030 creates a 833MW gap from today's 467MW — Human KSA's Riyadh Phase 1 (50MW) is the first mover in sovereign AI compute. Third: GPU export controls (EAR99/BIS) could strand a GPU-based competitor's entire capex with a single US policy change. The single risk that would change the thesis: if SDAIA relaxes data residency requirements for non-sensitive workloads, reducing the addressable market. Current trajectory makes this unlikely before 2030.</div>
    </div>

    <div class="tab-content" id="tab-rec">
      <div class="section-title">Board Recommendation</div>
      <div class="body-text">PROCEED with Phase 2 expansion to 200MW immediately. Initiate dual-track process: (1) Anchor tenant agreement with a Saudi government ministry or ARAMCO subsidiary — this validates the sovereign AI narrative and provides revenue certainty; (2) Strategic partnership with PIF (Public Investment Fund) as a co-investor, aligning with Vision 2030 mandate. Hard trigger: Phase 2 construction begins only after anchor tenant LOI signed. Engage KPMG Saudi Arabia and Jadwa Investment for the PIF partnership structure.</div>
    </div>

    <div style="margin-top:18px">
      <div class="section-title">Council of 5 — Strategic Vote</div>
      <div style="color:var(--muted);font-size:9px;margin-bottom:10px">Q: Should Human KSA pursue a PIF co-investment for Phase 2 expansion?</div>
      <div class="vote-card vote-approve"><div class="agent" style="color:var(--green-glow)">✅ CFO Twin — APPROVE</div><div class="rationale">PIF co-investment at Vision 2030 mandate rates reduces cost of capital to ~4.5%. At 200MW full capacity, the DC generates $220M EBITDA — PIF stake unlocks $3.3–5.5B valuation at infrastructure multiples.</div></div>
      <div class="vote-card vote-conditional"><div class="agent" style="color:var(--amber)">⚠️ Risk Officer — CONDITIONAL</div><div class="rationale">Approve only after anchor tenant LOI is signed. PIF will not co-invest in a facility without a government anchor. Secure ARAMCO, SABIC, or a Ministry contract first.</div></div>
      <div class="vote-card vote-approve"><div class="agent" style="color:var(--green-glow)">✅ Vision 2030 Alignment — APPROVE</div><div class="rationale">Sovereign AI compute is explicitly listed in the National AI Strategy. This is not a commercial bet — it is a national infrastructure mandate. First mover advantage is 18–24 months.</div></div>
      <div class="vote-card vote-conditional"><div class="agent" style="color:var(--amber)">⚠️ Regulatory Twin — CONDITIONAL</div><div class="rationale">NCA CCC-1 compliance certification required before government workloads can be onboarded. Timeline: 6–9 months. Begin certification process immediately.</div></div>
      <div class="vote-card vote-approve"><div class="agent" style="color:var(--green-glow)">✅ Market Intel — APPROVE</div><div class="rationale">833MW gap between current capacity (467MW) and 2030 target (1,300MW). Human KSA's 50MW Phase 1 captures 6% of the gap. Phase 2 at 200MW captures 24%. No comparable sovereign CPU-only facility exists in KSA today.</div></div>
      <div class="tally">
        <div class="tally-item"><div class="n green">3</div><div class="l">APPROVE</div></div>
        <div class="tally-item"><div class="n amber">2</div><div class="l">CONDITIONAL</div></div>
        <div class="tally-item"><div class="n red">0</div><div class="l">REJECT</div></div>
      </div>
      <div class="judge-box"><strong>JUDGE:</strong> APPROVED WITH CONDITIONS. Proceed with PIF co-investment preparation. Hard trigger: anchor tenant LOI (ARAMCO, SABIC, or Ministry) before Phase 2 construction. Begin NCA CCC-1 certification immediately. Engage Jadwa Investment for PIF partnership structure. Timeline to Phase 2 groundbreaking: Q3 2027.</div>
    </div>
  </div>

  <!-- CENTRE: Riyadh DC + NEOM Logistics -->
  <div class="panel">
    <div class="panel-title">🏗️ Riyadh DC + NEOM Logistics Fleet</div>
    <div class="section">
      <div class="section-title">Riyadh Phase 1 — Rack Map (1,200 / 4,800 racks)</div>
      <div class="rack-legend"><span class="r-active">█ ACTIVE</span><span class="r-standby">▓ STANDBY</span><span class="r-reserved">▪ RESERVED</span><span class="r-critical">▒ CRITICAL</span></div>
      <div class="rack-grid" id="rackGrid">Generating...</div>
    </div>
    <div class="section" style="margin-top:14px">
      <div class="section-title">Riyadh DC Performance</div>
      <div class="bar-row"><div class="bar-label">Power Draw</div><div class="bar-track"><div class="bar-fill" style="width:25%;background:var(--teal)"></div></div><div class="bar-val">12.5MW / 50MW</div></div>
      <div class="bar-row"><div class="bar-label">Rack Utilisation</div><div class="bar-track"><div class="bar-fill" style="width:72%;background:var(--teal)"></div></div><div class="bar-val">72%</div></div>
      <div class="bar-row"><div class="bar-label">CPU Cores Active</div><div class="bar-track"><div class="bar-fill" style="width:25%;background:var(--blue)"></div></div><div class="bar-val">2,400 / 9,600</div></div>
      <div class="stat-row" style="margin-top:8px"><div class="stat-label">PUE</div><div class="stat-value green">1.25 (arid-optimised)</div></div>
      <div class="stat-row"><div class="stat-label">Avg Inference Latency</div><div class="stat-value">2,800ms</div></div>
      <div class="stat-row"><div class="stat-label">Cooling</div><div class="stat-value">Adiabatic + Liquid Hybrid</div></div>
      <div class="stat-row"><div class="stat-label">Power Source</div><div class="stat-value green">Solar + Grid (NEOM Green)</div></div>
      <div class="stat-row"><div class="stat-label">Data Residency</div><div class="stat-value green">100% Kingdom of Saudi Arabia</div></div>
      <div class="stat-row"><div class="stat-label">Regulatory Compliance</div><div class="stat-value green">SDAIA · NCA CCC-1 · CITC</div></div>
    </div>
    <div class="section" style="margin-top:14px">
      <div class="section-title">NEOM Autonomous Logistics Fleet (1,200 AMRs)</div>
      <div class="bar-row"><div class="bar-label">GREEN — Operational</div><div class="bar-track"><div class="bar-fill" style="width:91.5%;background:var(--green-glow)"></div></div><div class="bar-val green">91.5%</div></div>
      <div class="bar-row"><div class="bar-label">AMBER — Scheduled Maint.</div><div class="bar-track"><div class="bar-fill" style="width:6.5%;background:var(--amber)"></div></div><div class="bar-val amber">6.5%</div></div>
      <div class="bar-row"><div class="bar-label">RED — Offline</div><div class="bar-track"><div class="bar-fill" style="width:2%;background:var(--red)"></div></div><div class="bar-val red">2.0%</div></div>
    </div>
    <div class="section" style="margin-top:14px">
      <div class="section-title">NEOM Construction Logistics Analytics</div>
      <div class="stat-row"><div class="stat-label">Active Construction Zones</div><div class="stat-value gold">THE LINE · SINDALAH · OXAGON</div></div>
      <div class="stat-row"><div class="stat-label">Daily Material Movements</div><div class="stat-value">47,200 autonomous trips</div></div>
      <div class="stat-row"><div class="stat-label">Mission Success Rate</div><div class="stat-value green">93.1%</div></div>
      <div class="stat-row"><div class="stat-label">Path Efficiency</div><div class="stat-value green">89.7%</div></div>
      <div class="stat-row"><div class="stat-label">Schedule Acceleration</div><div class="stat-value gold">+18 days (THE LINE Ph2)</div></div>
      <div class="stat-row"><div class="stat-label">Carbon Saved vs Diesel</div><div class="stat-value green">12,400 tCO₂/year</div></div>
    </div>
    <div class="section" style="margin-top:14px">
      <div class="section-title">KSA DC Capacity Growth (MW)</div>
      <div class="chart-wrap" style="height:140px"><canvas id="dcCapChart"></canvas></div>
      <div style="font-size:9px;color:var(--muted);margin-top:4px">Source: S&P Global / Saudi SPA Q1 2026 · Ranked #2 globally in DC capacity growth</div>
    </div>
  </div>

  <!-- RIGHT: ROI Calculator -->
  <div class="panel">
    <div class="panel-title">📊 ROI Calculator — Sovereign CPU vs Cloud GPU</div>
    <div class="section">
      <div class="section-title">10-Year Economics — Saudi Context</div>
      <table class="roi-table">
        <thead><tr><th>Metric</th><th>Sovereign CPU ✅</th><th>Foreign Cloud GPU</th></tr></thead>
        <tbody>
          <tr><td>Initial Capex</td><td class="win">SAR 675M ✅</td><td class="lose">SAR 2.18B</td></tr>
          <tr><td>Annual Opex</td><td class="win">SAR 157M ✅</td><td class="lose">SAR 356M</td></tr>
          <tr><td>EBITDA Margin</td><td class="win">67% ✅</td><td class="lose">51%</td></tr>
          <tr><td>Data Residency</td><td class="win">100% KSA ✅</td><td class="lose red">VIOLATION</td></div></tr>
          <tr><td>SDAIA Compliance</td><td class="win">FULL ✅</td><td class="lose">PARTIAL / RISK</td></tr>
          <tr><td>GPU Export Risk</td><td class="win">ZERO ✅</td><td class="lose">HIGH (EAR99)</td></tr>
          <tr><td>Hardware Refresh</td><td class="win">8 years ✅</td><td class="lose">3 years</td></tr>
          <tr><td>10-yr IRR</td><td class="win">38.5% ✅</td><td class="lose">N/A (neg FCF)</td></tr>
          <tr><td>Payback Period</td><td class="win">1.6 yr ✅</td><td class="lose">Never</td></tr>
          <tr><td>Capex Saved</td><td class="win" colspan="2">SAR 1.5B by choosing sovereign CPU</td></tr>
        </tbody>
      </table>
    </div>
    <div style="background:rgba(0,108,53,.1);border:1px solid rgba(0,108,53,.4);border-radius:5px;padding:12px;margin-top:10px;font-size:11px;line-height:1.7;">
      <strong style="color:var(--green-glow)">VERDICT:</strong> SOVEREIGN CPU WINS on IRR (38.5% vs N/A), payback (1.6yr vs Never), regulatory compliance (SDAIA/NCA), and strategic sovereignty. The SAR 1.5B capex delta funds 9.6 years of sovereign CPU opex. Foreign cloud GPU is not just economically inferior — it is legally non-compliant for government workloads.
    </div>
    <div class="section" style="margin-top:18px">
      <div class="section-title">10-Year FCF — Sovereign CPU Stack (SAR M)</div>
      <div class="chart-wrap"><canvas id="fcfChart"></canvas></div>
    </div>
    <div class="section" style="margin-top:18px">
      <div class="section-title">Sovereignty Premium — Why KSA Pays More</div>
      <div class="bar-row"><div class="bar-label">Data Residency Value</div><div class="bar-track"><div class="bar-fill" style="width:95%;background:var(--green-glow)"></div></div><div class="bar-val green">Critical</div></div>
      <div class="bar-row"><div class="bar-label">Regulatory Compliance</div><div class="bar-track"><div class="bar-fill" style="width:100%;background:var(--green-glow)"></div></div><div class="bar-val green">Mandatory</div></div>
      <div class="bar-row"><div class="bar-label">Export Control Immunity</div><div class="bar-track"><div class="bar-fill" style="width:90%;background:var(--teal)"></div></div><div class="bar-val">High</div></div>
      <div class="bar-row"><div class="bar-label">Vision 2030 Alignment</div><div class="bar-track"><div class="bar-fill" style="width:100%;background:var(--gold)"></div></div><div class="bar-val gold">Mandated</div></div>
    </div>
    <div class="section" style="margin-top:18px">
      <div class="section-title">IC Verdict</div>
      <div style="background:rgba(0,108,53,.1);border:1px solid rgba(0,108,53,.35);border-radius:5px;padding:12px">
        <div style="color:var(--teal);font-weight:700;margin-bottom:6px;font-size:11px">THE BET</div>
        <div style="font-size:11px;line-height:1.7;margin-bottom:10px">Saudi data sovereignty law makes foreign cloud GPU legally non-compliant for government workloads — and the $18B Vision 2030 AI mandate makes sovereign CPU the only economically rational and legally permissible choice.</div>
        <div style="color:var(--green-glow);font-weight:700;margin-bottom:8px;font-size:11px">✅ VERDICT: APPROVED — SOVEREIGN CPU ARCHITECTURE</div>
        <div style="font-size:10px;color:var(--muted);line-height:1.7">
          <div style="margin-bottom:4px"><span class="green">▶</span> IRR 38.5% vs cloud GPU "Never" payback</div>
          <div style="margin-bottom:4px"><span class="green">▶</span> 100% SDAIA + NCA CCC-1 compliant — foreign cloud is not</div>
          <div style="margin-bottom:4px"><span class="green">▶</span> SAR 1.5B capex saved funds 9.6 years of sovereign opex</div>
          <div style="margin-bottom:4px"><span class="green">▶</span> 833MW gap to 2030 target = first-mover market of SAR 3.1B</div>
          <div style="margin-bottom:4px"><span class="red">▷</span> Reassess if SDAIA relaxes data residency for non-sensitive workloads post-2030</div>
        </div>
      </div>
    </div>
  </div>

</div>

<script>
// Clock
setInterval(()=>{document.getElementById('clock').textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);

// Modal
function openLive(){document.getElementById('liveModal').classList.add('open');}
function closeLive(){document.getElementById('liveModal').classList.remove('open');}

// Tabs
function showTab(name,el){
  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  el.classList.add('active');
}

// Arabic toggle
let isArabic=false;
const EN={
  headerTitle:'Human KSA — Sovereign AI Command Center',
  headerSub:'MeshPilot Unified Platform · CPU-Only · Air-Gapped · Vision 2030 Aligned',
  langBtn:'العربية',
  liveLabel:'Sovereign Inference Mode',
  p1title:'🏛️ Executive Digital Twin — Human KSA',
  m1:'AI Investment',m2:'Digital GDP Target',m3:'KSA DC Capacity',m4:'Riyadh Phase 1',
  m5:'NEOM Area',m6:'NEOM AMRs',m7:'CPU IRR',m8:'Tech Jobs Target',
  briefTitle:'Strategic Brief',
};
const AR={
  headerTitle:'هيومن المملكة العربية السعودية — مركز قيادة الذكاء الاصطناعي السيادي',
  headerSub:'منصة ميش بايلوت · معالج مركزي فقط · معزول · متوافق مع رؤية 2030',
  langBtn:'English',
  liveLabel:'وضع الاستدلال السيادي',
  p1title:'🏛️ التوأم الرقمي التنفيذي — هيومن المملكة',
  m1:'الاستثمار في الذكاء الاصطناعي',m2:'هدف الاقتصاد الرقمي',m3:'طاقة مراكز البيانات',m4:'الرياض المرحلة 1',
  m5:'مساحة نيوم',m6:'روبوتات نيوم',m7:'معدل العائد الداخلي',m8:'هدف الوظائف التقنية',
  briefTitle:'الموجز الاستراتيجي',
};
function toggleLang(){
  isArabic=!isArabic;
  const t=isArabic?AR:EN;
  document.getElementById('headerTitle').textContent=t.headerTitle;
  document.getElementById('headerSub').textContent=t.headerSub;
  document.getElementById('langBtn').textContent=t.langBtn;
  document.getElementById('liveLabel').textContent=t.liveLabel;
  document.getElementById('p1title').textContent=t.p1title;
  document.getElementById('m1').textContent=t.m1;
  document.getElementById('m2').textContent=t.m2;
  document.getElementById('m3').textContent=t.m3;
  document.getElementById('m4').textContent=t.m4;
  document.getElementById('m5').textContent=t.m5;
  document.getElementById('m6').textContent=t.m6;
  document.getElementById('m7').textContent=t.m7;
  document.getElementById('m8').textContent=t.m8;
  document.getElementById('briefTitle').textContent=t.briefTitle;
  document.getElementById('briefEn').style.display=isArabic?'none':'block';
  document.getElementById('briefAr').style.display=isArabic?'block':'none';
  document.getElementById('htmlRoot').setAttribute('dir',isArabic?'rtl':'ltr');
}

// Rack map
function buildRackMap(){
  let seed=99;
  function rng(){seed=(seed*1664525+1013904223)&0xffffffff;return(seed>>>0)/0xffffffff;}
  const chars={A:['█','r-active'],S:['▓','r-standby'],R:['▪','r-reserved'],C:['▒','r-critical']};
  let html='';
  for(let row=0;row<15;row++){
    for(let col=0;col<80;col++){
      const idx=row*80+col;
      if(idx>=1200){html+='<span class="r-offline">░</span>';continue;}
      const r=rng();
      let s=r<0.72?'A':r<0.88?'S':r<0.96?'R':'C';
      const[ch,cls]=chars[s];
      html+=\`<span class="\${cls}">\${ch}</span>\`;
    }
    html+='\\n';
  }
  document.getElementById('rackGrid').innerHTML=html;
}
buildRackMap();

// GDP Chart
new Chart(document.getElementById('gdpChart'),{
  type:'bar',
  data:{
    labels:['2020','2022','2024','2026E','2028E','2030T'],
    datasets:[{
      label:'Digital Economy % of GDP',
      data:[5.2,7.8,11.4,14.1,16.8,19.2],
      backgroundColor:['rgba(26,122,60,.3)','rgba(26,122,60,.4)','rgba(26,122,60,.55)','rgba(26,122,60,.65)','rgba(26,122,60,.75)','rgba(0,200,83,.9)'],
      borderColor:'#1a7a3c',borderWidth:1,borderRadius:3
    }]
  },
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{
    x:{ticks:{color:'#7a9485',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}},
    y:{ticks:{color:'#7a9485',font:{size:9},callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.04)'}}
  }}
});

// DC Capacity Chart
new Chart(document.getElementById('dcCapChart'),{
  type:'line',
  data:{
    labels:['2022','2023','2024','Q1 2026','2027E','2030T'],
    datasets:[{
      label:'KSA DC Capacity (MW)',
      data:[120,185,280,467,620,1300],
      borderColor:'#00c9a7',backgroundColor:'rgba(0,201,167,.1)',
      borderWidth:2,pointRadius:4,pointBackgroundColor:'#00c9a7',fill:true,tension:.3
    },{
      label:'Human KSA Phase 1',
      data:[null,null,null,50,50,250],
      borderColor:'#00c853',backgroundColor:'transparent',
      borderWidth:2,borderDash:[4,4],pointRadius:3,pointBackgroundColor:'#00c853'
    }]
  },
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7a9485',font:{size:9},boxWidth:10}}},scales:{
    x:{ticks:{color:'#7a9485',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}},
    y:{ticks:{color:'#7a9485',font:{size:9},callback:v=>v+'MW'},grid:{color:'rgba(255,255,255,.04)'}}
  }}
});

// FCF Chart (SAR M)
const fcfData=[-675,95,185,240,285,310,325,335,335,335,335];
const cumData=fcfData.reduce((acc,v,i)=>{acc.push((acc[i-1]||0)+v);return acc;},[]);
new Chart(document.getElementById('fcfChart'),{
  type:'bar',
  data:{
    labels:['Y0','Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],
    datasets:[{
      label:'Annual FCF (SAR M)',
      data:fcfData,
      backgroundColor:fcfData.map(v=>v>=0?'rgba(0,200,83,.5)':'rgba(255,77,109,.5)'),
      borderColor:fcfData.map(v=>v>=0?'#00c853':'#ff4d6d'),
      borderWidth:1,borderRadius:2,order:2
    },{
      label:'Cumulative',
      data:cumData,
      type:'line',borderColor:'#c9a84c',backgroundColor:'transparent',
      borderWidth:2,pointRadius:3,pointBackgroundColor:'#c9a84c',order:1
    }]
  },
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7a9485',font:{size:9},boxWidth:10}}},scales:{
    x:{ticks:{color:'#7a9485',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}},
    y:{ticks:{color:'#7a9485',font:{size:9},callback:v=>'SAR '+v+'M'},grid:{color:'rgba(255,255,255,.04)'}}
  }}
});
<\/script>
</body>
</html>`;

export default function HumanKsaDemo() {
  useEffect(() => {
    document.title = "Human KSA — Sovereign AI Command Center";
    return () => { document.title = "AgenThinkMesh"; };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <iframe
        srcDoc={KSA_HTML}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        title="Human KSA Sovereign AI Command Center"
        sandbox="allow-scripts"
      />
    </div>
  );
}
