import{r as e,j as a}from"./react-vendor-ChkOGfOz.js";import"./vendor-B43sDH1-.js";import"./date-utils-B2ZejYPs.js";import"./export-libs-suHawyUQ.js";import"./charts-Bhwmpjvm.js";import"./trpc-Dsj9agTq.js";import"./radix-BzVH_mSP.js";import"./flow-DCgLNMlO.js";const i=`<!DOCTYPE html>
<html lang="en" id="root">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Indonesia Logistics — Sovereign AI Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{
  --bg:#0a0202;--surface:rgba(255,255,255,.04);--border:rgba(255,255,255,.07);
  --red:#e53935;--red-l:#ff5252;--white:#f5f5f5;--gold:#ffd740;
  --green:#00e676;--amber:#ffd740;--blue:#4a9eff;--teal:#00c896;
  --text:#f5e8e8;--muted:#7a4040;--warn:#ff9100;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code',monospace;font-size:13px;min-height:100vh;}
.stripe{height:4px;background:linear-gradient(90deg,#e53935 50%,#f5f5f5 50%);}
.hdr{background:linear-gradient(135deg,rgba(229,57,53,.12),rgba(245,245,245,.03));border-bottom:1px solid rgba(229,57,53,.35);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:14px;}
.logo{width:44px;height:44px;background:linear-gradient(135deg,#e53935,#c62828);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#fff;letter-spacing:-1px;text-align:center;line-height:1.2;}
.htitle{font-size:16px;font-weight:700;color:var(--red-l);letter-spacing:2px;text-transform:uppercase;}
.hsub{color:var(--muted);font-size:10px;margin-top:2px;}
.badge{padding:3px 10px;border-radius:12px;font-size:10px;}
.b-id{background:rgba(229,57,53,.1);border:1px solid var(--red);color:var(--red-l);}
.b-kw{background:rgba(0,200,150,.1);border:1px solid var(--teal);color:var(--teal);}
.b-live{background:rgba(0,230,118,.1);border:1px solid var(--green);color:var(--green);}
.b-sov{background:rgba(255,215,64,.1);border:1px solid var(--gold);color:var(--gold);}
.lang-btn{padding:5px 14px;border-radius:4px;cursor:pointer;font-size:10px;letter-spacing:1px;text-transform:uppercase;background:rgba(229,57,53,.15);border:1px solid var(--red);color:var(--red-l);font-family:inherit;}
.mbar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:90px;padding:10px 14px;background:var(--bg);text-align:center;}
.m .v{font-size:17px;font-weight:700;color:var(--red-l);}
.m .v.g{color:var(--green);}.m .v.a{color:var(--amber);}.m .v.b{color:var(--blue);}.m .v.w{color:var(--white);}
.m .l{font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:18px;overflow-y:auto;max-height:calc(100vh - 148px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-size:10px;font-weight:700;color:var(--red-l);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(229,57,53,.25);}
.sec{margin-bottom:18px;}
.st{font-size:9px;color:var(--red);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
.body{color:var(--text);line-height:1.75;font-size:12px;opacity:.9;}
.tabs{display:flex;gap:1px;background:var(--border);margin-bottom:14px;overflow-x:auto;}
.tab{padding:7px 14px;cursor:pointer;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;}
.tab.on{color:var(--red-l);border-bottom:2px solid var(--red-l);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);}
.sl{color:var(--muted);}.sv{font-weight:600;}
.red{color:var(--red-l);}.green{color:var(--green);}.amber{color:var(--amber);}.blue{color:var(--blue);}.white{color:var(--white);}.teal{color:var(--teal);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.bl{width:160px;font-size:10px;color:var(--muted);flex-shrink:0;}
.bt{flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;}
.bf{height:100%;border-radius:3px;}
.bv{width:70px;text-align:right;font-size:10px;}
.vc{background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:10px;margin-bottom:7px;}
.vc .ag{font-weight:700;font-size:11px;margin-bottom:3px;}
.vc .rt{color:var(--muted);font-size:10px;line-height:1.55;}
.va{border-left:3px solid var(--green);}.vco{border-left:3px solid var(--amber);}.vr{border-left:3px solid var(--red);}
.tally{display:flex;gap:16px;padding:10px 14px;background:rgba(229,57,53,.05);border:1px solid rgba(229,57,53,.2);border-radius:5px;margin:10px 0;}
.ti{text-align:center;}.ti .n{font-size:22px;font-weight:700;}.ti .l{font-size:9px;color:var(--muted);}
.judge{background:rgba(229,57,53,.08);border:1px solid rgba(229,57,53,.35);border-radius:5px;padding:12px;margin-top:10px;font-size:11px;line-height:1.7;color:var(--red-l);}
.bet{background:linear-gradient(135deg,rgba(229,57,53,.1),rgba(255,215,64,.06));border:1px solid rgba(229,57,53,.4);border-radius:6px;padding:14px 16px;margin-bottom:16px;}
.bet .bt2{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.bet .bb{font-size:13px;font-weight:700;line-height:1.6;color:var(--red-l);}
.tbl{width:100%;border-collapse:collapse;font-size:11px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:9px;padding:5px 7px;border-bottom:1px solid var(--border);text-align:left;}
.tbl td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.03);}
.tbl .win{color:var(--green);font-weight:700;}.tbl .lose{color:var(--red-l);}.tbl .hl{background:rgba(229,57,53,.05);}
.sav{background:linear-gradient(135deg,rgba(0,230,118,.08),rgba(0,200,150,.06));border:1px solid rgba(0,230,118,.3);border-radius:5px;padding:12px;margin:10px 0;text-align:center;}
.sav .amt{font-size:28px;font-weight:700;color:var(--green);}
.sav .lbl{font-size:10px;color:var(--muted);margin-top:2px;}
.rack-grid{display:grid;grid-template-columns:repeat(20,1fr);gap:2px;margin:10px 0;}
.rack{height:14px;border-radius:1px;font-size:0;}
.r-act{background:rgba(229,57,53,.7);}.r-stb{background:rgba(255,255,255,.15);}.r-res{background:rgba(255,215,64,.4);}.r-mnt{background:rgba(255,145,0,.5);}
.rack-legend{display:flex;gap:14px;margin-top:6px;flex-wrap:wrap;}
.rl{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--muted);}
.rl-dot{width:10px;height:10px;border-radius:2px;}
.pallet{background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:10px;margin-bottom:7px;}
.pallet .pn{font-size:11px;font-weight:700;margin-bottom:4px;}
.pallet .pd{font-size:10px;color:var(--muted);line-height:1.6;}
.scen{display:flex;gap:1px;background:var(--border);margin-bottom:14px;overflow-x:auto;}
.sc{flex:1;min-width:80px;padding:7px 10px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);text-align:center;white-space:nowrap;}
.sc.on{color:var(--red-l);border-bottom:2px solid var(--red-l);}
.cw{position:relative;height:160px;margin-top:8px;}
.lbtn{display:inline-flex;align-items:center;gap:8px;background:rgba(229,57,53,.12);border:1px solid var(--red);color:var(--red-l);padding:7px 18px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:100;align-items:center;justify-content:center;}
.modal.open{display:flex;}
.mbox{background:#0a0202;border:1px solid var(--red);border-radius:8px;padding:32px 40px;max-width:500px;text-align:center;}
.mbox h2{color:var(--red-l);font-size:16px;margin-bottom:12px;letter-spacing:1px;}
.mbox p{color:var(--muted);font-size:12px;line-height:1.7;margin-bottom:12px;}
.mbox .cbtn{background:rgba(229,57,53,.15);border:1px solid var(--red);color:var(--red-l);padding:8px 24px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:1px;}
.mbox .ct{color:var(--red);font-size:11px;margin-top:12px;}
.milestone{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;}
.ms-dot{width:8px;height:8px;border-radius:50%;background:var(--red);margin-top:3px;flex-shrink:0;}
.ms-dot.green{background:var(--green);}
.ms-content .ms-t{font-size:10px;font-weight:700;color:var(--red-l);}
.ms-content .ms-d{font-size:9px;color:var(--muted);line-height:1.5;}
.sov-box{background:rgba(229,57,53,.07);border:1px solid rgba(229,57,53,.3);border-radius:5px;padding:12px;margin:10px 0;}
.sov-box .bt2{font-size:9px;color:var(--red-l);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.sov-box .bb{font-size:11px;line-height:1.7;}
</style>
</head>
<body>
<div class="stripe"></div>
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>⚡ SOVEREIGN INFERENCE MODE</h2>
    <p>MeshPilot runs AGV training and inference entirely within Indonesia — no data leaves the country. All robot episode data, pallet recognition models, and route optimisation runs on local CPU infrastructure.</p>
    <p>This satisfies Indonesia's <strong style="color:var(--red-l)">Government Regulation No. 71/2019</strong> (GR 71) on electronic systems classification, which requires strategic sector data to be processed domestically.</p>
    <p style="color:var(--red-l);font-weight:700;font-size:12px">Full deployment: agenthinkmesh.ai/meshpilot-demo</p>
    <div class="ct">Contact: <strong>indonesia@agenthinkmesh.ai</strong></div>
    <br><button class="cbtn" onclick="cl()">TUTUP / CLOSE</button>
  </div>
</div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">🇮🇩<br>LOG</div>
    <div>
      <div class="htitle" id="h-title">Indonesia Logistics — Sovereign AI Command Center</div>
      <div class="hsub" id="h-sub">Autonomous Warehouse Intelligence · Jakarta Hub · In-Country AI Training & Inference</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-id">🇮🇩 Indonesia</span>
    <span class="badge b-sov">⚡ Data Sovereignty</span>
    <span class="badge b-kw">GR 71/2019 Compliant</span>
    <span class="badge b-live">● LIVE TWIN</span>
    <button class="lang-btn" onclick="toggleLang()" id="lang-btn">🇮🇩 Bahasa Indonesia</button>
    <span style="color:var(--muted);font-size:10px" id="clk"></span>
  </div>
</div>
<div class="mbar">
  <div class="m"><div class="v w">$130B+</div><div class="l" id="m1l">Digital Economy</div></div>
  <div class="m"><div class="v a">$300B</div><div class="l" id="m2l">2030 Target</div></div>
  <div class="m"><div class="v g">$33.2M</div><div class="l" id="m3l">AGV Market 2025</div></div>
  <div class="m"><div class="v g">28.6%</div><div class="l" id="m4l">SEA Automation Share</div></div>
  <div class="m"><div class="v red">85ms</div><div class="l" id="m5l">Singapore Latency</div></div>
  <div class="m"><div class="v g">3ms</div><div class="l" id="m6l">In-Country Latency</div></div>
  <div class="m"><div class="v a">270M</div><div class="l" id="m7l">Population</div></div>
  <div class="m"><div class="v b">17,000+</div><div class="l" id="m8l">Islands Served</div></div>
</div>
<div class="grid">

<!-- LEFT: Executive Twin -->
<div class="panel">
  <div class="pt" id="p1-title">🧠 Executive Digital Twin — Indonesia Logistics</div>
  <div class="bet">
    <div class="bt2" id="bet-label">THE BET</div>
    <div class="bb" id="bet-text">Indonesia's $300B digital economy target by 2030 requires sovereign AI infrastructure. Every AGV trained in Singapore costs 28× more per inference call and violates GR 71/2019. The bet is: build the CPU training stack in-country before the cloud incumbents lock in the contracts.</div>
  </div>
  <button class="lbtn" onclick="ol()" id="council-btn">⚡ Sovereign Inference Mode — Learn More</button>
  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)" id="tab-brief">Brief</div>
    <div class="tab" onclick="st('econ',this)" id="tab-econ">Digital Economy</div>
    <div class="tab" onclick="st('agv',this)" id="tab-agv">AGV Market</div>
    <div class="tab" onclick="st('rec',this)" id="tab-rec">Recommendation</div>
  </div>
  <div class="tc on" id="tc-brief">
    <div class="st" id="st-brief">Strategic Brief</div>
    <div class="body" id="body-brief">Indonesia is Southeast Asia's largest digital economy — $130B+ GMV achieved in 2025, on a trajectory to $300B by 2030. The country leads the region in warehouse automation with 28.6% of SEA revenue, anchored by government-funded logistics parks along the Cikarang and Jakarta-Surabaya corridor.<br><br>The critical constraint is data sovereignty. Government Regulation No. 71/2019 classifies logistics and supply chain systems as strategic electronic systems, requiring all data processing to occur within Indonesian territory. Every AGV fleet currently sending training data to Singapore is non-compliant — and exposed to regulatory action as enforcement tightens.<br><br>MeshPilot provides the only CPU-native, air-gapped AGV training and inference stack that runs entirely within Indonesia. No data leaves the country. No cloud dependency. Full GR 71/2019 compliance from day one.</div>
  </div>
  <div class="tc" id="tc-econ">
    <div class="st">Indonesia Digital Economy — Verified Data</div>
    <div class="sr"><div class="sl">Digital Economy GMV (2025)</div><div class="sv white">$130B+ (exceeded target)</div></div>
    <div class="sr"><div class="sl">2030 Target</div><div class="sv amber">$300B</div></div>
    <div class="sr"><div class="sl">GDP Contribution by 2040</div><div class="sv green">+$2.8T</div></div>
    <div class="sr"><div class="sl">E-commerce CAGR</div><div class="sv">12.5%</div></div>
    <div class="sr"><div class="sl">Internet Users</div><div class="sv">212M (77% penetration)</div></div>
    <div class="sr"><div class="sl">Logistics Market Size</div><div class="sv">$38B (2025)</div></div>
    <div class="sr"><div class="sl">Warehouse Robotics (2025)</div><div class="sv">$219.6M</div></div>
    <div class="sr"><div class="sl">Warehouse Robotics (2035E)</div><div class="sv green">$829.1M</div></div>
    <div style="margin-top:12px"><div class="st">Digital Economy Growth Trajectory</div><div class="cw"><canvas id="econC"></canvas></div></div>
  </div>
  <div class="tc" id="tc-agv">
    <div class="st">AGV & Warehouse Automation — Indonesia</div>
    <div class="sr"><div class="sl">AGV Market Value (2025)</div><div class="sv">$33.2M</div></div>
    <div class="sr"><div class="sl">AGV Market Value (2030E)</div><div class="sv green">$41.9M</div></div>
    <div class="sr"><div class="sl">SEA Automation Market (2025)</div><div class="sv">$870M</div></div>
    <div class="sr"><div class="sl">SEA Automation Market (2032E)</div><div class="sv green">$1.95B</div></div>
    <div class="sr"><div class="sl">Indonesia SEA Market Share</div><div class="sv red">28.6% (largest)</div></div>
    <div class="sr"><div class="sl">Key Corridors</div><div class="sv">Cikarang, Jakarta-Surabaya</div></div>
    <div style="margin-top:12px"><div class="st">In-Country vs Singapore Training Cost</div>
    <div class="br"><div class="bl">In-Country (MeshPilot)</div><div class="bt"><div class="bf" style="width:4%;background:var(--green)"></div></div><div class="bv green">$0.0008/call</div></div>
    <div class="br"><div class="bl">Singapore Cloud</div><div class="bt"><div class="bf" style="width:100%;background:var(--red)"></div></div><div class="bv red">$0.022/call</div></div>
    <div class="br"><div class="bl">Latency (In-Country)</div><div class="bt"><div class="bf" style="width:4%;background:var(--green)"></div></div><div class="bv green">3ms</div></div>
    <div class="br"><div class="bl">Latency (Singapore)</div><div class="bt"><div class="bf" style="width:100%;background:var(--red)"></div></div><div class="bv red">85ms</div></div>
    </div>
  </div>
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation</div>
    <div class="body">Deploy MeshPilot as the sovereign AI training stack for the Jakarta logistics hub. Phase 1: 50 AGV units, Cikarang corridor. Phase 2: full Jakarta-Surabaya corridor, 500 AGVs. Phase 3: national rollout across all government-classified logistics parks.<br><br>The regulatory case is already made: GR 71/2019 mandates in-country processing. The economic case is equally clear: $0.0008 per inference call vs $0.022 on Singapore cloud — a 27.5× cost advantage that compounds at every scale milestone.<br><br>First mover advantage is available. The cloud incumbents are not GR 71/2019 compliant. Lock in the anchor tenant contracts before they adapt.</div>
  </div>

  <!-- Scenarios -->
  <div style="margin-top:18px">
    <div class="st" id="st-scen">Scenario Selector</div>
    <div class="scen">
      <div class="sc on" onclick="ss('base',this)">Base</div>
      <div class="sc" onclick="ss('sov',this)">Sovereignty</div>
      <div class="sc" onclick="ss('cloud',this)">Cloud Risk</div>
      <div class="sc" onclick="ss('scale',this)">National Scale</div>
      <div class="sc" onclick="ss('stress',this)">Stress</div>
    </div>
    <div id="sc-base" class="vc va" style="display:block">
      <div class="ag" style="color:var(--green)">✅ BASE CASE — Jakarta Hub Pilot · Confidence: 82%</div>
      <div class="rt">50 AGVs, Cikarang corridor. In-country training: $0.0008/call. Annual inference cost: $480K vs $13.2M on Singapore cloud. ROI positive at Month 8. GR 71/2019 compliant from day one. <strong style="color:var(--green)">VERDICT: APPROVED — proceed to pilot.</strong></div>
    </div>
    <div id="sc-sov" class="vc va" style="display:none">
      <div class="ag" style="color:var(--green)">✅ SOVEREIGNTY PREMIUM — Regulatory Tailwind · Confidence: 90%</div>
      <div class="rt">Government enforcement of GR 71/2019 tightens in 2026. All Singapore-hosted AGV fleets face compliance notices. MeshPilot becomes the only compliant option. Contract pipeline accelerates 3× as logistics operators seek compliant alternatives. <strong style="color:var(--green)">VERDICT: APPROVED — accelerate sales cycle.</strong></div>
    </div>
    <div id="sc-cloud" class="vc vco" style="display:none">
      <div class="ag" style="color:var(--amber)">⚠️ CLOUD LOCK-IN RISK — Singapore Dependency · Confidence: 75%</div>
      <div class="rt">Hyperscalers (AWS, Azure, GCP) open Jakarta regions and claim GR 71/2019 compliance. Pricing pressure increases. MeshPilot's advantage shifts from regulatory to cost + air-gap. CPU inference cost advantage ($0.0008 vs $0.018) remains intact. <strong style="color:var(--amber)">VERDICT: CONDITIONAL — accelerate air-gap differentiation.</strong></div>
    </div>
    <div id="sc-scale" class="vc va" style="display:none">
      <div class="ag" style="color:var(--green)">✅ NATIONAL SCALE — 500 AGVs, All Corridors · Confidence: 65%</div>
      <div class="rt">Full Jakarta-Surabaya corridor + Medan + Makassar. 500 AGVs. Annual inference volume: 2.4B calls. In-country cost: $1.92M/yr vs Singapore: $52.8M/yr. 10-year savings: $509M. National logistics sovereignty achieved. <strong style="color:var(--green)">VERDICT: APPROVED — anchor government partnership required.</strong></div>
    </div>
    <div id="sc-stress" class="vc vr" style="display:none">
      <div class="ag" style="color:var(--red-l)">🔴 STRESS TEST — No Regulatory Enforcement · Confidence: 88%</div>
      <div class="rt">GR 71/2019 enforcement delayed indefinitely. Cloud incumbents retain market. MeshPilot competes on cost alone. At 50 AGUs, cost advantage still delivers $12.7M savings over 10 years. Business viable but growth slower. <strong style="color:var(--red-l)">VERDICT: VIABLE — cost case alone justifies deployment even without regulatory tailwind.</strong></div>
    </div>
  </div>
</div>

<!-- CENTRE: Jakarta Hub + Logistics Fleet -->
<div class="panel">
  <div class="pt" id="p2-title">🏭 Jakarta Logistics Hub — Sovereign AI Infrastructure</div>
  <div class="sec">
    <div class="st" id="st-rack">Rack Map — Jakarta Hub (Active / Standby / Reserved / Maintenance)</div>
    <div class="rack-grid" id="rackGrid"></div>
    <div class="rack-legend">
      <div class="rl"><div class="rl-dot r-act"></div><span id="rl-act">Active (AGV Training)</span></div>
      <div class="rl"><div class="rl-dot r-stb"></div><span id="rl-stb">Standby</span></div>
      <div class="rl"><div class="rl-dot r-res"></div><span id="rl-res">Reserved</span></div>
      <div class="rl"><div class="rl-dot r-mnt"></div><span id="rl-mnt">Maintenance</span></div>
    </div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st" id="st-dc">Jakarta DC Metrics</div>
    <div class="sr"><div class="sl" id="dc1l">Total Capacity</div><div class="sv">45MW (Phase 1)</div></div>
    <div class="sr"><div class="sl" id="dc2l">Live Utilisation</div><div class="sv green">68%</div></div>
    <div class="sr"><div class="sl" id="dc3l">PUE</div><div class="sv">1.45 (tropical cooling)</div></div>
    <div class="sr"><div class="sl" id="dc4l">Data Residency</div><div class="sv green">100% In-Country ✓</div></div>
    <div class="sr"><div class="sl" id="dc5l">GR 71/2019 Status</div><div class="sv green">COMPLIANT ✓</div></div>
    <div class="sr"><div class="sl" id="dc6l">Latency to AGV Fleet</div><div class="sv green">3ms avg</div></div>
    <div class="sr"><div class="sl" id="dc7l">vs Singapore</div><div class="sv red">85ms (28× slower)</div></div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st" id="st-pal">Pallet Intelligence — Indonesian Export Commodities</div>
    <div class="pallet" style="border-left:3px solid var(--amber)">
      <div class="pn amber" id="pal1n">🌴 Palm Oil — 47.2M tonnes/yr (World #1)</div>
      <div class="pd" id="pal1d">AGV routing: temperature-controlled zones, bulk liquid handling, ISO tank compatibility. MeshPilot trains pallet recognition on-device — no palm oil supply chain data leaves Indonesia. 847 SKUs, 23 port destinations.</div>
    </div>
    <div class="pallet" style="border-left:3px solid var(--blue)">
      <div class="pn blue" id="pal2n">👕 Textiles & Garments — $8.7B export value</div>
      <div class="pd" id="pal2d">AGV routing: mixed SKU pallets, fragile handling protocols, barcode + RFID dual-scan. Training dataset: 500 episodes, 12 garment categories. Inference: 0.8ms per pallet classification. In-country model — no IP leakage.</div>
    </div>
    <div class="pallet" style="border-left:3px solid var(--teal)">
      <div class="pn teal" id="pal3n">💻 Electronics & Components — $12.3B export value</div>
      <div class="pd" id="pal3d">AGV routing: ESD-safe zones, weight-sensitive handling, customs manifest integration. MeshPilot runs full inference on CPU — no GPU required. 94.7% pallet classification accuracy. Sub-5ms latency for real-time routing decisions.</div>
    </div>
    <div class="pallet" style="border-left:3px solid var(--green)">
      <div class="pn green" id="pal4n">☕ Coffee & Agricultural — $1.2B export value</div>
      <div class="pd" id="pal4d">AGV routing: humidity-controlled storage, FIFO rotation, phytosanitary compliance scanning. Seasonal demand spikes handled by dynamic fleet reallocation. 91.3% mission success rate across 500 training episodes.</div>
    </div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st" id="st-fleet">AGV Fleet Health — Jakarta Hub</div>
    <div class="br"><div class="bl">GREEN (Operational)</div><div class="bt"><div class="bf" style="width:91%;background:var(--green)"></div></div><div class="bv green">91.2% (46/50)</div></div>
    <div class="br"><div class="bl">AMBER (Maintenance Due)</div><div class="bt"><div class="bf" style="width:6%;background:var(--amber)"></div></div><div class="bv amber">6.0% (3/50)</div></div>
    <div class="br"><div class="bl">RED (Offline)</div><div class="bt"><div class="bf" style="width:3%;background:var(--red)"></div></div><div class="bv red">2.8% (1/50)</div></div>
    <div style="margin-top:10px"><div class="st" id="st-vol">Inference Volume Growth (Monthly Calls)</div><div class="cw" style="height:130px"><canvas id="volC"></canvas></div></div>
  </div>
</div>

<!-- RIGHT: ROI Calculator + Council -->
<div class="panel">
  <div class="pt" id="p3-title">💰 ROI Calculator — In-Country vs Singapore Cloud</div>
  <div class="sov-box">
    <div class="bt2" id="sov-title">⚡ The Sovereignty Equation</div>
    <div class="bb" id="sov-text">GPU for training (Core42 / Humain / cloud). MeshPilot CPU for inference + data generation. This hybrid eliminates the most expensive part of the AI stack — the 24/7 inference cost — while keeping training on the best available hardware. Every call that stays in Indonesia saves $0.0212 and satisfies GR 71/2019.</div>
  </div>
  <div class="sec">
    <div class="st" id="st-roi">10-Year Cost Comparison (50 AGVs, 1.6M calls/month)</div>
    <table class="tbl">
      <thead><tr><th id="th-metric">Metric</th><th id="th-incountry">In-Country (MeshPilot)</th><th id="th-sg">Singapore Cloud</th></tr></thead>
      <tbody>
        <tr><td id="tr1l">Inference Cost/Call</td><td class="win">$0.0008</td><td class="lose">$0.022</td></tr>
        <tr><td id="tr2l">Annual Inference Cost</td><td class="win">$15,360</td><td class="lose">$422,400</td></tr>
        <tr><td id="tr3l">Latency</td><td class="win">3ms</td><td class="lose">85ms</td></tr>
        <tr><td id="tr4l">GR 71/2019 Compliance</td><td class="win">✓ COMPLIANT</td><td class="lose">✗ NON-COMPLIANT</td></tr>
        <tr><td id="tr5l">Data Sovereignty</td><td class="win">100% In-Country</td><td class="lose">Data Leaves Indonesia</td></tr>
        <tr><td id="tr6l">Hardware Capex (10yr)</td><td>$180,000</td><td class="lose">$0 (OPEX trap)</td></tr>
        <tr><td id="tr7l">10-Year Total Cost</td><td class="win">$333,600</td><td class="lose">$4,224,000</td></tr>
        <tr class="hl"><td id="tr8l"><strong>10-Year Savings</strong></td><td class="win" colspan="2"><strong>$3,890,400 (11.6× cheaper)</strong></td></tr>
        <tr><td id="tr9l">Regulatory Risk</td><td class="win">ZERO</td><td class="lose">HIGH (GR 71 enforcement)</td></tr>
        <tr><td id="tr10l">Payback Period</td><td class="win">8 months</td><td class="lose">Never (OPEX only)</td></tr>
      </tbody>
    </table>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st" id="st-scale-roi">Scale Economics (Annual Savings at Different Fleet Sizes)</div>
    <div class="cw" style="height:150px"><canvas id="scaleC"></canvas></div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st" id="st-council">Council of 5 — Sovereign AI Verdict</div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Infrastructure Analyst — APPROVE</div><div class="rt">In-country CPU inference at $0.0008/call vs $0.022 Singapore cloud is a 27.5× cost advantage. At 50 AGVs and 1.6M monthly calls, annual savings of $407K compound to $3.89M over 10 years. Hardware payback at Month 8. No viable counter-argument on economics alone.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Regulatory Counsel — APPROVE</div><div class="rt">GR 71/2019 classifies AGV logistics systems as strategic electronic systems. All data processing must occur within Indonesian territory. Singapore-hosted inference is non-compliant. MeshPilot is the only CPU-native, air-gapped stack that satisfies this requirement from deployment day one.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Logistics Sector Analyst — APPROVE</div><div class="rt">Indonesia leads SEA warehouse automation at 28.6% market share. The Cikarang and Jakarta-Surabaya corridors are government-prioritised. Palm oil, textiles, and electronics represent $68B+ in annual export value that flows through these corridors. The AGV training data for these commodities must not leave the country.</div></div>
    <div class="vc vco"><div class="ag" style="color:var(--amber)">⚠️ Risk Officer — CONDITIONAL</div><div class="rt">Approve conditional on: (1) formal GR 71/2019 compliance certification before commercial deployment, (2) anchor tenant LOI from at least one Tier-1 logistics operator before Phase 2 capex, (3) tropical cooling solution for PUE optimisation (current 1.45 vs Singapore 1.20 target).</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Market Intelligence — APPROVE</div><div class="rt">First-mover window is open. AWS Jakarta, Azure Indonesia, and GCP have not achieved GR 71/2019 strategic sector compliance for AGV inference workloads. MeshPilot can lock in 12–18 months of regulatory advantage before hyperscalers adapt. The $300B digital economy target creates structural demand for compliant AI infrastructure.</div></div>
    <div class="tally">
      <div class="ti"><div class="n green">4</div><div class="l" id="tl-app">APPROVE</div></div>
      <div class="ti"><div class="n amber">1</div><div class="l" id="tl-con">CONDITIONAL</div></div>
      <div class="ti"><div class="n red">0</div><div class="l" id="tl-rej">REJECT</div></div>
    </div>
    <div class="judge" id="judge-text"><strong>JUDGE — APPROVED WITH CONDITIONS:</strong> The case is unambiguous on both dimensions — economics and regulation. $3.89M in 10-year savings at 50 AGVs, 27.5× cost advantage per inference call, and full GR 71/2019 compliance from day one. The condition is a formal compliance certification and anchor tenant LOI before Phase 2. The first-mover window is 12–18 months. Move now.</div>
  </div>
  <div class="sav">
    <div class="amt">$3.89M</div>
    <div class="lbl" id="sav-lbl">10-Year Savings vs Singapore Cloud · 50 AGVs · 1.6M Calls/Month</div>
  </div>
  <div style="margin-top:10px">
    <div class="st" id="st-ms">Key Milestones</div>
    <div class="milestone"><div class="ms-dot"></div><div class="ms-content"><div class="ms-t" id="ms1t">Month 1 — GR 71/2019 Certification</div><div class="ms-d" id="ms1d">Formal compliance certification from KOMINFO. Required before commercial deployment to any strategic sector operator.</div></div></div>
    <div class="milestone"><div class="ms-dot"></div><div class="ms-content"><div class="ms-t" id="ms2t">Month 3 — Cikarang Pilot (10 AGVs)</div><div class="ms-d" id="ms2d">First 10 AGVs deployed. Palm oil and electronics pallet recognition training begins. Baseline inference cost established.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t" id="ms3t">Month 8 — ROI Positive</div><div class="ms-d" id="ms3d">Hardware capex recovered. Cumulative savings exceed initial investment. Expand to 50 AGVs.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t" id="ms4t">Month 18 — Jakarta-Surabaya Corridor</div><div class="ms-d" id="ms4d">500 AGVs. Full corridor coverage. Annual savings: $4.07M. National rollout planning begins.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t" id="ms5t">Month 36 — National Sovereign AI Stack</div><div class="ms-d" id="ms5d">All government-classified logistics parks covered. Indonesia's AGV fleet runs 100% on sovereign AI infrastructure.</div></div></div>
  </div>
  <div style="margin-top:10px;text-align:center;font-size:10px;color:var(--muted)">Full MeshPilot platform:<br><strong style="color:var(--red-l)">agenthinkmesh.ai/meshpilot-demo</strong></div>
</div>

</div>
<script>
// Clock
setInterval(()=>{document.getElementById('clk').textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);
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
// Scenarios
function ss(n,el){
  ['base','sov','cloud','scale','stress'].forEach(s=>{document.getElementById('sc-'+s).style.display='none';});
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  document.getElementById('sc-'+n).style.display='block';
  el.classList.add('on');
}
// Rack map
const rg=document.getElementById('rackGrid');
for(let i=0;i<120;i++){
  const d=document.createElement('div');
  const r=Math.random();
  d.className='rack '+(r<0.68?'r-act':r<0.82?'r-stb':r<0.94?'r-res':'r-mnt');
  d.title=r<0.68?'Active — AGV Training':r<0.82?'Standby':r<0.94?'Reserved':'Maintenance';
  rg.appendChild(d);
}
// Digital economy chart
new Chart(document.getElementById('econC'),{type:'bar',data:{labels:['2020','2021','2022','2023','2024','2025','2030T'],datasets:[{label:'Digital Economy GMV ($B)',data:[44,70,77,82,90,130,300],backgroundColor:['rgba(229,57,53,.3)','rgba(229,57,53,.35)','rgba(229,57,53,.4)','rgba(229,57,53,.45)','rgba(229,57,53,.55)','rgba(229,57,53,.75)','rgba(0,230,118,.7)'],borderColor:['#e53935','#e53935','#e53935','#e53935','#e53935','#e53935','#00e676'],borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#7a4040',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#7a4040',font:{size:9},callback:v=>'$'+v+'B'},grid:{color:'rgba(255,255,255,.03)'}}}}});
// Volume chart
new Chart(document.getElementById('volC'),{type:'line',data:{labels:['M1','M3','M6','M9','M12','M18','M24','M36'],datasets:[{label:'In-Country Calls (M)',data:[0.2,0.5,1.0,1.6,2.4,6.0,12.0,28.0],borderColor:'#e53935',backgroundColor:'rgba(229,57,53,.08)',borderWidth:2,pointRadius:3,fill:true,tension:.3},{label:'Cost Savings ($K)',data:[4,10,20,32,48,120,240,560],borderColor:'#00e676',backgroundColor:'rgba(0,230,118,.05)',borderWidth:2,pointRadius:3,fill:false,tension:.3,yAxisID:'y2'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7a4040',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#7a4040',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#7a4040',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y2:{position:'right',ticks:{color:'#00e676',font:{size:9},callback:v=>'$'+v+'K'},grid:{display:false}}}}});
// Scale economics chart
new Chart(document.getElementById('scaleC'),{type:'bar',data:{labels:['50 AGVs','100 AGVs','250 AGVs','500 AGVs','1,000 AGVs'],datasets:[{label:'Annual Savings vs Singapore ($K)',data:[407,814,2035,4070,8140],backgroundColor:'rgba(229,57,53,.5)',borderColor:'#e53935',borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#7a4040',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#7a4040',font:{size:9},callback:v=>'$'+v+'K'},grid:{color:'rgba(255,255,255,.03)'}}}}});

// Bahasa Indonesia toggle
let lang='en';
const tr={
  'h-title':['Indonesia Logistics — Sovereign AI Command Center','Pusat Komando AI Berdaulat — Logistik Indonesia'],
  'h-sub':['Autonomous Warehouse Intelligence · Jakarta Hub · In-Country AI Training & Inference','Kecerdasan Gudang Otonom · Hub Jakarta · Pelatihan & Inferensi AI Dalam Negeri'],
  'm1l':['Digital Economy','Ekonomi Digital'],
  'm2l':['2030 Target','Target 2030'],
  'm3l':['AGV Market 2025','Pasar AGV 2025'],
  'm4l':['SEA Automation Share','Pangsa Otomasi Asia Tenggara'],
  'm5l':['Singapore Latency','Latensi Singapura'],
  'm6l':['In-Country Latency','Latensi Dalam Negeri'],
  'm7l':['Population','Populasi'],
  'm8l':['Islands Served','Pulau Terlayani'],
  'p1-title':['🧠 Executive Digital Twin — Indonesia Logistics','🧠 Kembaran Digital Eksekutif — Logistik Indonesia'],
  'bet-label':['THE BET','TARUHAN UTAMA'],
  'bet-text':["Indonesia's $300B digital economy target by 2030 requires sovereign AI infrastructure. Every AGV trained in Singapore costs 28× more per inference call and violates GR 71/2019. The bet is: build the CPU training stack in-country before the cloud incumbents lock in the contracts.","Target ekonomi digital Indonesia $300M pada 2030 membutuhkan infrastruktur AI berdaulat. Setiap AGV yang dilatih di Singapura biayanya 28× lebih mahal per panggilan inferensi dan melanggar PP 71/2019. Taruhannya: bangun tumpukan pelatihan CPU dalam negeri sebelum incumbent cloud mengunci kontrak."],
  'council-btn':['⚡ Sovereign Inference Mode — Learn More','⚡ Mode Inferensi Berdaulat — Pelajari Lebih Lanjut'],
  'tab-brief':['Brief','Ringkasan'],
  'tab-econ':['Digital Economy','Ekonomi Digital'],
  'tab-agv':['AGV Market','Pasar AGV'],
  'tab-rec':['Recommendation','Rekomendasi'],
  'p2-title':['🏭 Jakarta Logistics Hub — Sovereign AI Infrastructure','🏭 Hub Logistik Jakarta — Infrastruktur AI Berdaulat'],
  'st-rack':['Rack Map — Jakarta Hub (Active / Standby / Reserved / Maintenance)','Peta Rak — Hub Jakarta (Aktif / Siaga / Dicadangkan / Pemeliharaan)'],
  'rl-act':['Active (AGV Training)','Aktif (Pelatihan AGV)'],
  'rl-stb':['Standby','Siaga'],
  'rl-res':['Reserved','Dicadangkan'],
  'rl-mnt':['Maintenance','Pemeliharaan'],
  'st-dc':['Jakarta DC Metrics','Metrik DC Jakarta'],
  'dc1l':['Total Capacity','Kapasitas Total'],
  'dc2l':['Live Utilisation','Utilisasi Langsung'],
  'dc3l':['PUE','PUE'],
  'dc4l':['Data Residency','Residensi Data'],
  'dc5l':['GR 71/2019 Status','Status PP 71/2019'],
  'dc6l':['Latency to AGV Fleet','Latensi ke Armada AGV'],
  'dc7l':['vs Singapore','vs Singapura'],
  'st-pal':['Pallet Intelligence — Indonesian Export Commodities','Kecerdasan Palet — Komoditas Ekspor Indonesia'],
  'pal1n':['🌴 Palm Oil — 47.2M tonnes/yr (World #1)','🌴 Minyak Sawit — 47,2 Juta ton/thn (No. 1 Dunia)'],
  'pal2n':['👕 Textiles & Garments — $8.7B export value','👕 Tekstil & Garmen — Nilai ekspor $8,7M'],
  'pal3n':['💻 Electronics & Components — $12.3B export value','💻 Elektronik & Komponen — Nilai ekspor $12,3M'],
  'pal4n':['☕ Coffee & Agricultural — $1.2B export value','☕ Kopi & Pertanian — Nilai ekspor $1,2M'],
  'st-fleet':['AGV Fleet Health — Jakarta Hub','Kesehatan Armada AGV — Hub Jakarta'],
  'st-vol':['Inference Volume Growth (Monthly Calls)','Pertumbuhan Volume Inferensi (Panggilan Bulanan)'],
  'p3-title':['💰 ROI Calculator — In-Country vs Singapore Cloud','💰 Kalkulator ROI — Dalam Negeri vs Cloud Singapura'],
  'sov-title':['⚡ The Sovereignty Equation','⚡ Persamaan Kedaulatan'],
  'sov-text':['GPU for training (Core42 / Humain / cloud). MeshPilot CPU for inference + data generation. This hybrid eliminates the most expensive part of the AI stack — the 24/7 inference cost — while keeping training on the best available hardware. Every call that stays in Indonesia saves $0.0212 and satisfies GR 71/2019.','GPU untuk pelatihan (Core42 / Humain / cloud). CPU MeshPilot untuk inferensi + pembuatan data. Hibrida ini menghilangkan bagian termahal dari tumpukan AI — biaya inferensi 24/7 — sambil menjaga pelatihan pada perangkat keras terbaik. Setiap panggilan yang tetap di Indonesia menghemat $0,0212 dan memenuhi PP 71/2019.'],
  'st-roi':['10-Year Cost Comparison (50 AGVs, 1.6M calls/month)','Perbandingan Biaya 10 Tahun (50 AGV, 1,6 Juta panggilan/bulan)'],
  'th-metric':['Metric','Metrik'],
  'th-incountry':['In-Country (MeshPilot)','Dalam Negeri (MeshPilot)'],
  'th-sg':['Singapore Cloud','Cloud Singapura'],
  'tr1l':['Inference Cost/Call','Biaya Inferensi/Panggilan'],
  'tr2l':['Annual Inference Cost','Biaya Inferensi Tahunan'],
  'tr3l':['Latency','Latensi'],
  'tr4l':['GR 71/2019 Compliance','Kepatuhan PP 71/2019'],
  'tr5l':['Data Sovereignty','Kedaulatan Data'],
  'tr6l':['Hardware Capex (10yr)','Capex Perangkat Keras (10 thn)'],
  'tr7l':['10-Year Total Cost','Total Biaya 10 Tahun'],
  'tr8l':['10-Year Savings','Penghematan 10 Tahun'],
  'tr9l':['Regulatory Risk','Risiko Regulasi'],
  'tr10l':['Payback Period','Periode Pengembalian Modal'],
  'st-scale-roi':['Scale Economics (Annual Savings at Different Fleet Sizes)','Ekonomi Skala (Penghematan Tahunan pada Berbagai Ukuran Armada)'],
  'st-council':['Council of 5 — Sovereign AI Verdict','Dewan 5 — Putusan AI Berdaulat'],
  'tl-app':['APPROVE','SETUJU'],
  'tl-con':['CONDITIONAL','BERSYARAT'],
  'tl-rej':['REJECT','TOLAK'],
  'judge-text':['<strong>JUDGE — APPROVED WITH CONDITIONS:</strong> The case is unambiguous on both dimensions — economics and regulation. $3.89M in 10-year savings at 50 AGVs, 27.5× cost advantage per inference call, and full GR 71/2019 compliance from day one. The condition is a formal compliance certification and anchor tenant LOI before Phase 2. The first-mover window is 12–18 months. Move now.','<strong>HAKIM — DISETUJUI DENGAN SYARAT:</strong> Kasusnya tidak ambigu pada kedua dimensi — ekonomi dan regulasi. Penghematan $3,89 juta dalam 10 tahun pada 50 AGV, keunggulan biaya 27,5× per panggilan inferensi, dan kepatuhan penuh PP 71/2019 sejak hari pertama. Syaratnya adalah sertifikasi kepatuhan formal dan LOI penyewa jangkar sebelum Fase 2. Jendela keunggulan pertama adalah 12-18 bulan. Bergerak sekarang.'],
  'sav-lbl':['10-Year Savings vs Singapore Cloud · 50 AGVs · 1.6M Calls/Month','Penghematan 10 Tahun vs Cloud Singapura · 50 AGV · 1,6 Juta Panggilan/Bulan'],
  'st-ms':['Key Milestones','Tonggak Utama'],
  'ms1t':['Month 1 — GR 71/2019 Certification','Bulan 1 — Sertifikasi PP 71/2019'],
  'ms1d':['Formal compliance certification from KOMINFO. Required before commercial deployment to any strategic sector operator.','Sertifikasi kepatuhan formal dari KOMINFO. Diperlukan sebelum penerapan komersial ke operator sektor strategis mana pun.'],
  'ms2t':['Month 3 — Cikarang Pilot (10 AGVs)','Bulan 3 — Pilot Cikarang (10 AGV)'],
  'ms2d':['First 10 AGVs deployed. Palm oil and electronics pallet recognition training begins. Baseline inference cost established.','10 AGV pertama dikerahkan. Pelatihan pengenalan palet minyak sawit dan elektronik dimulai. Biaya inferensi dasar ditetapkan.'],
  'ms3t':['Month 8 — ROI Positive','Bulan 8 — ROI Positif'],
  'ms3d':['Hardware capex recovered. Cumulative savings exceed initial investment. Expand to 50 AGVs.','Capex perangkat keras terpulihkan. Penghematan kumulatif melebihi investasi awal. Perluas ke 50 AGV.'],
  'ms4t':['Month 18 — Jakarta-Surabaya Corridor','Bulan 18 — Koridor Jakarta-Surabaya'],
  'ms4d':['500 AGVs. Full corridor coverage. Annual savings: $4.07M. National rollout planning begins.','500 AGV. Cakupan koridor penuh. Penghematan tahunan: $4,07 juta. Perencanaan peluncuran nasional dimulai.'],
  'ms5t':['Month 36 — National Sovereign AI Stack','Bulan 36 — Tumpukan AI Berdaulat Nasional'],
  'ms5d':['All government-classified logistics parks covered. Indonesia AGV fleet runs 100% on sovereign AI infrastructure.','Semua taman logistik yang diklasifikasikan pemerintah tercakup. Armada AGV Indonesia berjalan 100% pada infrastruktur AI berdaulat.'],
  'st-scen':['Scenario Selector','Pemilih Skenario'],
  'lang-btn':['🇮🇩 Bahasa Indonesia','🇬🇧 English'],
};
function toggleLang(){
  lang=lang==='en'?'id':'en';
  const i=lang==='id'?1:0;
  Object.entries(tr).forEach(([id,vals])=>{
    const el=document.getElementById(id);
    if(el)el.innerHTML=vals[i];
  });
}
<\/script>
</body>
</html>`;function v(){return e.useEffect(()=>(document.title="Indonesia Logistics — Sovereign AI Command Center",()=>{document.title="AgenThinkMesh"}),[]),a.jsx("div",{"data-loc":"client/src/pages/IndonesiaLogisticsDemo.tsx:472",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:a.jsx("iframe",{"data-loc":"client/src/pages/IndonesiaLogisticsDemo.tsx:473",srcDoc:i,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"Indonesia Logistics Sovereign AI Command Center",sandbox:"allow-scripts"})})}export{v as default};
