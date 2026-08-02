import{r as e,j as s}from"./react-vendor-ChkOGfOz.js";import"./vendor-B43sDH1-.js";import"./date-utils-B2ZejYPs.js";import"./export-libs-suHawyUQ.js";import"./charts-Bhwmpjvm.js";import"./trpc-Dsj9agTq.js";import"./radix-BzVH_mSP.js";import"./flow-DCgLNMlO.js";const i=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Floward — Sovereign E-Commerce & Perishable Logistics AI</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#fdf8f5;--bg2:#fef9f7;--surface:#fff;
  --pink:#e8a0a8;--pink-l:#f5c6cc;--pink-d:#c97880;--pink-t:#b05060;
  --rose:#c9956a;--rose-l:#e8c4a0;--rose-t:#a07040;
  --green:#6a9a70;--green-l:#a8c8a8;--green-t:#4a7a50;
  --text:#2a1a1a;--muted:#8a7070;--light:#f0e8e4;
  --border:rgba(200,150,150,.2);--border2:rgba(200,150,150,.12);
  --gold:#c9a050;--gold-l:#e8c880;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:12px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,var(--pink) 0%,var(--rose-l) 40%,var(--pink-l) 70%,var(--green-l) 100%);}
.hdr{background:linear-gradient(135deg,rgba(232,160,168,.12),rgba(201,149,106,.08),rgba(255,255,255,.95));border-bottom:1px solid var(--border);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;backdrop-filter:blur(8px);}
.hdr-l{display:flex;align-items:center;gap:12px;}
.logo{width:52px;height:52px;background:linear-gradient(135deg,var(--pink),var(--rose));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 2px 12px rgba(232,160,168,.4);}
.htitle{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:700;color:var(--pink-t);letter-spacing:1px;}
.hsub{color:var(--muted);font-size:9px;margin-top:2px;letter-spacing:1px;text-transform:uppercase;}
.badge{padding:3px 9px;border-radius:20px;font-size:8px;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;font-weight:500;}
.b-f2d{background:rgba(232,160,168,.15);border:1px solid var(--pink-l);color:var(--pink-d);}
.b-gcc{background:rgba(106,154,112,.12);border:1px solid var(--green-l);color:var(--green-t);}
.b-fr{background:rgba(201,160,80,.12);border:1px solid var(--gold-l);color:var(--rose-t);}
.b-zc{background:rgba(201,149,106,.12);border:1px solid var(--rose-l);color:var(--rose-t);}
.b-live{background:rgba(106,154,112,.12);border:1px solid var(--green-l);color:var(--green-t);}
.pulse{animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.mbar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:80px;padding:8px 10px;background:var(--bg2);}
.m .v{font-size:14px;font-weight:700;color:var(--pink-t);font-family:'Cormorant Garamond',serif;}
.m .v.g{color:var(--green-t);}.m .v.r{color:var(--rose-t);}.m .v.gold{color:var(--gold);}
.m .l{font-size:8px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg2);padding:14px;overflow-y:auto;max-height:calc(100vh - 140px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-family:'Cormorant Garamond',serif;font-size:11px;font-weight:700;color:var(--pink-t);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid var(--border);}
.sec{margin-bottom:14px;}
.st{font-size:8px;color:var(--rose-t);text-transform:uppercase;letter-spacing:2px;margin-bottom:7px;font-weight:600;}
.body{color:var(--text);line-height:1.8;font-size:11px;opacity:.9;}
.tabs{display:flex;gap:1px;background:var(--border);margin-bottom:10px;overflow-x:auto;border-radius:4px;overflow:hidden;}
.tab{padding:6px 11px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg2);white-space:nowrap;font-weight:500;}
.tab.on{color:var(--pink-t);border-bottom:2px solid var(--pink);background:rgba(232,160,168,.08);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border2);}
.sl{color:var(--muted);font-size:10px;}.sv{font-weight:600;font-size:10px;}
.pink{color:var(--pink-t);}.green{color:var(--green-t);}.rose{color:var(--rose-t);}.gold{color:var(--gold);}.muted{color:var(--muted);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.bl{width:180px;font-size:9px;color:var(--muted);flex-shrink:0;}
.bt{flex:1;height:4px;background:rgba(200,150,150,.1);border-radius:2px;overflow:hidden;}
.bf{height:100%;border-radius:2px;}
.bv{width:70px;text-align:right;font-size:9px;}
.vc{background:rgba(232,160,168,.06);border:1px solid rgba(232,160,168,.2);border-radius:8px;padding:8px;margin-bottom:6px;}
.vc .ag{font-weight:600;font-size:10px;margin-bottom:3px;}
.vc .rt{color:var(--muted);font-size:9px;line-height:1.6;}
.va{border-left:3px solid var(--pink);}
.tally{display:flex;gap:12px;padding:8px 10px;background:rgba(232,160,168,.08);border:1px solid rgba(232,160,168,.2);border-radius:8px;margin:8px 0;}
.ti{text-align:center;}.ti .n{font-size:18px;font-weight:700;font-family:'Cormorant Garamond',serif;}.ti .l{font-size:8px;color:var(--muted);letter-spacing:1px;}
.judge{background:linear-gradient(135deg,rgba(232,160,168,.08),rgba(201,149,106,.06));border:1px solid rgba(232,160,168,.3);border-radius:8px;padding:9px;margin-top:8px;font-size:10px;line-height:1.7;color:var(--pink-t);font-style:italic;}
.bet{background:linear-gradient(135deg,rgba(232,160,168,.1),rgba(201,149,106,.06));border:1px solid rgba(232,160,168,.3);border-radius:8px;padding:11px 13px;margin-bottom:12px;}
.bet .bt2{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;}
.bet .bb{font-size:11px;font-weight:600;line-height:1.6;color:var(--pink-t);}
.tbl{width:100%;border-collapse:collapse;font-size:10px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:8px;padding:4px 5px;border-bottom:1px solid var(--border);text-align:left;font-weight:600;}
.tbl td{padding:4px 5px;border-bottom:1px solid var(--border2);}
.tbl .win{color:var(--green-t);font-weight:600;}.tbl .lose{color:var(--rose-t);}.tbl .hl{background:rgba(232,160,168,.05);}
.sav{background:linear-gradient(135deg,rgba(232,160,168,.1),rgba(201,149,106,.08));border:1px solid rgba(232,160,168,.3);border-radius:8px;padding:10px;margin:8px 0;text-align:center;}
.sav .amt{font-size:28px;font-weight:700;color:var(--pink-t);font-family:'Cormorant Garamond',serif;}
.sav .lbl{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:1px;}
/* GCC map */
.gcc-map{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin:8px 0;}
.gcc-cell{border-radius:8px;padding:7px;font-size:9px;text-align:center;}
.gcc-kw{background:rgba(232,160,168,.12);border:1px solid rgba(232,160,168,.3);}
.gcc-ae{background:rgba(201,149,106,.12);border:1px solid rgba(201,149,106,.3);}
.gcc-sa{background:rgba(201,160,80,.12);border:1px solid rgba(201,160,80,.3);}
.gcc-qa{background:rgba(106,154,112,.12);border:1px solid rgba(106,154,112,.3);}
.gcc-bh{background:rgba(232,160,168,.08);border:1px solid rgba(232,160,168,.2);}
.gcc-om{background:rgba(201,149,106,.08);border:1px solid rgba(201,149,106,.2);}
.gcc-flag{font-size:18px;margin-bottom:3px;}
.gcc-name{font-weight:700;font-size:9px;margin-bottom:2px;}
.gcc-kw .gcc-name{color:var(--pink-t);}
.gcc-ae .gcc-name{color:var(--rose-t);}
.gcc-sa .gcc-name{color:var(--gold);}
.gcc-qa .gcc-name{color:var(--green-t);}
.gcc-bh .gcc-name{color:var(--pink-d);}
.gcc-om .gcc-name{color:var(--rose-t);}
.gcc-stat{font-size:8px;color:var(--muted);line-height:1.5;}
/* Cold chain */
.chain{display:flex;align-items:center;gap:4px;margin:8px 0;overflow-x:auto;padding:6px 0;}
.chain-node{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 8px;text-align:center;min-width:70px;font-size:8px;}
.chain-node .cn{font-size:14px;margin-bottom:2px;}
.chain-node .ct{font-weight:600;color:var(--pink-t);font-size:8px;}
.chain-node .cs{color:var(--muted);font-size:7px;}
.chain-arrow{color:var(--pink-l);font-size:14px;flex-shrink:0;}
/* Sensor feed */
.sensor{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(232,160,168,.06);border-left:2px solid var(--pink-l);margin-bottom:3px;border-radius:0 4px 4px 0;}
.sn{font-size:9px;color:var(--pink-t);}.sv2{font-size:9px;color:var(--rose-t);}.ss{font-size:8px;color:var(--muted);}
/* Scenario tabs */
.scen{display:flex;gap:1px;background:var(--border);margin-bottom:10px;overflow-x:auto;border-radius:4px;overflow:hidden;}
.sc{flex:1;min-width:60px;padding:5px 7px;cursor:pointer;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg2);text-align:center;white-space:nowrap;font-weight:500;}
.sc.on{color:var(--pink-t);border-bottom:2px solid var(--pink);background:rgba(232,160,168,.08);}
.threat{background:rgba(232,160,168,.06);border:1px solid rgba(232,160,168,.2);border-radius:8px;padding:8px;margin-bottom:5px;}
.threat .tn{font-size:10px;font-weight:600;margin-bottom:3px;}
.threat .td{font-size:9px;color:var(--muted);line-height:1.6;}
/* Inf status */
.inf-status{background:linear-gradient(135deg,rgba(232,160,168,.08),rgba(201,149,106,.06));border:1px solid rgba(232,160,168,.25);border-radius:8px;padding:9px;margin:8px 0;text-align:center;}
.inf-status .is{font-size:11px;font-weight:600;color:var(--pink-t);letter-spacing:1px;}
.inf-status .id{font-size:9px;color:var(--muted);margin-top:3px;}
/* Modal */
.modal{display:none;position:fixed;inset:0;background:rgba(42,26,26,.85);z-index:100;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
.modal.open{display:flex;}
.mbox{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px 32px;max-width:480px;text-align:center;box-shadow:0 20px 60px rgba(232,160,168,.3);}
.mbox h2{font-family:'Cormorant Garamond',serif;color:var(--pink-t);font-size:16px;margin-bottom:9px;letter-spacing:1px;}
.mbox p{color:var(--muted);font-size:11px;line-height:1.7;margin-bottom:9px;}
.mbox .cbtn{background:linear-gradient(135deg,var(--pink),var(--rose));border:none;color:#fff;padding:8px 22px;border-radius:20px;cursor:pointer;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:600;}
.lbtn{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--pink),var(--rose));border:none;color:#fff;padding:6px 16px;border-radius:20px;cursor:pointer;font-family:'Inter',sans-serif;font-size:9px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;font-weight:600;box-shadow:0 2px 12px rgba(232,160,168,.4);}
.cw{position:relative;height:140px;margin-top:7px;}
.milestone{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}
.ms-dot{width:7px;height:7px;border-radius:50%;background:var(--pink);margin-top:3px;flex-shrink:0;}
.ms-dot.rose{background:var(--rose);}
.ms-t{font-size:9px;font-weight:600;color:var(--pink-t);}
.ms-d{font-size:8px;color:var(--muted);line-height:1.5;}
.bbar{background:linear-gradient(135deg,rgba(232,160,168,.08),rgba(201,149,106,.06));border-top:1px solid var(--border);padding:7px 18px;text-align:center;font-size:9px;color:var(--muted);letter-spacing:.5px;font-style:italic;}
/* Farm origins */
.farm-row{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap;}
.farm-tag{padding:3px 9px;border-radius:20px;font-size:8px;background:rgba(106,154,112,.1);border:1px solid rgba(106,154,112,.25);color:var(--green-t);font-weight:500;}
/* Seasonal chart note */
.chart-note{font-size:8px;color:var(--muted);margin-top:4px;text-align:center;}
</style>
</head>
<body>
<!-- MODAL -->
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>&#127800; Sovereign E-Commerce AI — GCC Deployment</h2>
    <p>MeshPilot deploys on Floward's existing GCC infrastructure (AWS local regions or private servers in Kuwait, UAE, KSA, Qatar, Bahrain, Oman). All customer data, delivery patterns, and floral preferences stay inside the Gulf. Zero foreign inference API calls.</p>
    <p style="color:var(--pink-t);font-weight:600;font-size:11px">Farm to Door · GCC Data Residency · Freshness Guaranteed</p>
    <p style="color:var(--rose-t)">Contact: meshpilot@agenthinkmesh.ai</p>
    <br><button class="cbtn" onclick="cl()">Close</button>
  </div>
</div>

<!-- HEADER -->
<div class="stripe"></div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">&#127800;</div>
    <div>
      <div class="htitle">Floward — Sovereign E-Commerce &amp; Perishable Logistics AI</div>
      <div class="hsub">Kuwait HQ · UAE · KSA · Qatar · Bahrain · Oman · Farm to Door · 2M+ Customer Profiles</div>
    </div>
  </div>
  <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-f2d">&#127800; Farm to Door</span>
    <span class="badge b-gcc">&#127758; GCC Data Residency</span>
    <span class="badge b-fr">&#10024; Freshness Guaranteed</span>
    <span class="badge b-zc">&#128274; Zero Cloud Dependency</span>
    <span class="badge b-live pulse">&#9679; SYSTEM ACTIVE</span>
    <span style="color:var(--muted);font-size:9px" id="clk"></span>
  </div>
</div>

<!-- METRICS BAR -->
<div class="mbar">
  <div class="m"><div class="v">2M+</div><div class="l">Customer Profiles</div></div>
  <div class="m"><div class="v">500K+</div><div class="l">Annual Orders</div></div>
  <div class="m"><div class="v g">12,400</div><div class="l">Active Orders Today</div></div>
  <div class="m"><div class="v g">340</div><div class="l">Delivery Vans (6 Markets)</div></div>
  <div class="m"><div class="v">2°C</div><div class="l">Cold Hub Temp (Optimal)</div></div>
  <div class="m"><div class="v g">100%</div><div class="l">GCC Data Residency</div></div>
  <div class="m"><div class="v g">$37.1M</div><div class="l">10-Year AI Savings</div></div>
  <div class="m"><div class="v gold">20×</div><div class="l">Valentine's Day Surge</div></div>
</div>

<div class="grid">

<!-- ═══════════════════════════════════════════════════════════════
     LEFT PANEL — E-COMMERCE EXECUTIVE TWIN
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#127800; E-Commerce Executive Twin — Floward GCC</div>
  <div class="bet">
    <div class="bt2">SOVEREIGN E-COMMERCE AI — GCC DATA RESIDENCY</div>
    <div class="bb">Floward: Farm-to-door flower and gift delivery across 6 GCC markets. Owns sourcing, arrangement, photography, last-mile. 2M+ customer profiles, 500K+ annual orders — zero data leaves the GCC. MeshPilot runs on Floward's existing GCC infrastructure, keeping all customer, inventory, and logistics data inside the Gulf.</div>
  </div>
  <button class="lbtn" onclick="ol()">&#9889; Deploy Sovereign E-Commerce AI</button>

  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Strategic Brief</div>
    <div class="tab" onclick="st('modern',this)">GCC E-Commerce</div>
    <div class="tab" onclick="st('ops',this)">Perishable Scenarios</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>

  <!-- TAB 1: STRATEGIC BRIEF -->
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief — Floward Sovereign AI</div>
    <div class="body">Floward is the Middle East's largest online flower and gift destination, operating across the GCC (UAE, Saudi Arabia, Kuwait, Qatar, Bahrain, Oman). Founded in Kuwait, they own their supply chain from farm to door — sourcing, arrangement, photography, last-mile delivery.<br><br><strong style="color:var(--pink-t)">The Data Sovereignty Challenge:</strong> Customer data (addresses, purchase patterns, recipient preferences), inventory data (flower freshness, perishable stock), and logistics data (driver routes, delivery times) all touch foreign cloud AI for demand forecasting, route optimisation, and customer service chatbots. This violates GCC data residency requirements and exposes competitive customer insights to foreign jurisdictions.<br><br><strong style="color:var(--green-t)">The MeshPilot Solution:</strong> CPU-only inference on Floward's existing AWS local regions or private servers in each GCC market. All demand forecasting, route optimisation, churn prediction, and personalisation models run inside the GCC. No customer data, delivery patterns, or floral preferences cross any border.<br><br><strong style="color:var(--rose-t)">The Perishable Imperative:</strong> Flowers have a 3–7 day shelf life. Cold chain integrity, demand forecasting accuracy, and last-mile timing are not optional — they are the product. A 2% spoilage rate improvement is worth millions in margin. A 20× Valentine's Day surge requires AI that knows the GCC customer, not a generic global model.</div>
    <div style="margin-top:10px">
      <div class="sr"><div class="sl">Customer Profiles (GCC)</div><div class="sv pink">2M+ (all GCC-resident)</div></div>
      <div class="sr"><div class="sl">Annual Orders</div><div class="sv pink">500K+ across 6 markets</div></div>
      <div class="sr"><div class="sl">GCC Data Residency (MeshPilot)</div><div class="sv green">100% inside GCC</div></div>
      <div class="sr"><div class="sl">Foreign Cloud Data Exposure</div><div class="sv rose">ZERO (on-prem MeshPilot)</div></div>
      <div class="sr"><div class="sl">Valentine's Day Order Surge</div><div class="sv gold">20× baseline volume</div></div>
      <div class="sr"><div class="sl">Ramadan/Eid Gifting Surge</div><div class="sv gold">10–15× baseline volume</div></div>
      <div class="sr"><div class="sl">Cold Chain Spoilage (target)</div><div class="sv green">&lt;0.5% freshness complaints</div></div>
      <div class="sr"><div class="sl">Last-Mile On-Time (Valentine's)</div><div class="sv green">99.2% at 20× volume</div></div>
      <div class="sr"><div class="sl">Churn Prediction Accuracy</div><div class="sv green">89.4% (local GCC model)</div></div>
      <div class="sr"><div class="sl">10-Year AI Infrastructure Savings</div><div class="sv pink">$37.1M (42× cheaper)</div></div>
    </div>
  </div>

  <!-- TAB 2: GCC E-COMMERCE MODERNIZATION -->
  <div class="tc" id="tc-modern">
    <div class="st">GCC E-Commerce Modernization — Floward's Market</div>
    <div class="body" style="margin-bottom:10px">Floward operates in the fastest-growing e-commerce markets in the world. Saudi Arabia's e-commerce market reached $13.9B. UAE: $17B+. Kuwait: $2B+. Floward leads the floral and gifts vertical and is expanding into perfumes, chocolates, and personalised gifts. The AI layer — demand forecasting, personalisation, route optimisation — is the competitive moat. That moat must be sovereign.</div>
    <div class="sr"><div class="sl">Saudi E-Commerce Market</div><div class="sv gold">$13.9B (2024)</div></div>
    <div class="sr"><div class="sl">UAE E-Commerce Market</div><div class="sv rose">$17B+ (2024)</div></div>
    <div class="sr"><div class="sl">Kuwait E-Commerce Market</div><div class="sv pink">$2B+ (2024)</div></div>
    <div class="sr"><div class="sl">GCC E-Commerce CAGR (2024–2030)</div><div class="sv green">~14% per year</div></div>
    <div class="sr"><div class="sl">Floward Markets</div><div class="sv pink">6 GCC + Egypt expansion</div></div>
    <div class="sr"><div class="sl">Floward Product Expansion</div><div class="sv rose">Flowers → Perfumes, Chocolates, Gifts</div></div>
    <div class="sr"><div class="sl">Peak Season: Valentine's Day</div><div class="sv gold">20× baseline, 99.2% on-time target</div></div>
    <div class="sr"><div class="sl">Peak Season: Ramadan/Eid</div><div class="sv gold">10–15× baseline, gifting surge</div></div>
    <div style="margin-top:10px"><div class="st">Seasonal Demand Surge — Order Volume Index (Baseline = 1×)</div><div class="cw"><canvas id="seasonC"></canvas></div></div>
    <div class="chart-note">Source: Floward public disclosures, GCC e-commerce industry reports. Surge multiples based on public seasonal data.</div>
  </div>

  <!-- TAB 3: PERISHABLE LOGISTICS SCENARIOS -->
  <div class="tc" id="tc-ops">
    <div class="st">Perishable Logistics Scenarios — Six GCC Contexts</div>
    <div class="scen">
      <div class="sc on" onclick="ss('val',this)">Valentine's</div>
      <div class="sc" onclick="ss('cold',this)">Cold Chain</div>
      <div class="sc" onclick="ss('route',this)">Last-Mile</div>
      <div class="sc" onclick="ss('churn',this)">Churn</div>
      <div class="sc" onclick="ss('customs',this)">Customs</div>
      <div class="sc" onclick="ss('personal',this)">Personalise</div>
    </div>

    <div id="sc-val" class="threat" style="border-left:3px solid var(--pink);display:block">
      <div class="tn pink">&#10084;&#65039; Valentine's Day Surge — 20× Volume Management</div>
      <div class="td">Demand forecasting 30 days out for Valentine's Day across all 6 GCC markets. Farm pre-ordering from Kenya, Ecuador, and Netherlands 3 weeks in advance. Arrangement capacity planning across 23 stations. Last-mile driver surge allocation in Riyadh, Dubai, Kuwait City, Doha, Manama, Muscat. Target: 99.2% on-time delivery at 20× baseline volume. MeshPilot trains on 3 years of Floward's own GCC seasonal data — no generic global model. All customer address data and delivery patterns processed on GCC-resident servers only.</div>
    </div>
    <div id="sc-cold" class="threat" style="border-left:3px solid var(--green);display:none">
      <div class="tn green">&#10052;&#65039; Cold Chain Integrity — Farm to Customer Door</div>
      <div class="td">Temperature monitoring from farm origin (Kenya/Ecuador/Netherlands) through air freight, regional cold hub (2°C optimal), arrangement centre, last-mile van, to customer door. AI predicts spoilage risk per batch based on transit time, temperature variance, and humidity. Target: &lt;0.5% freshness complaints. 18 farm shipments in transit at any time, 4 flagged for delay risk. 0.8% spoilage rate in simulated cold chain vs 2.1% baseline. All cold chain telemetry and inventory data processed on Floward's GCC infrastructure — no perishable stock data leaves the Gulf.</div>
    </div>
    <div id="sc-route" class="threat" style="border-left:3px solid var(--rose);display:none">
      <div class="tn rose">&#128652; Last-Mile Route Optimisation — 6 GCC Cities</div>
      <div class="td">Real-time driver routing across Riyadh, Dubai, Kuwait City, Doha, Manama, and Muscat. Accounts for traffic, parking restrictions, building access codes, recipient availability windows, and time-sensitive delivery (flowers wilt in heat). 340 active delivery vans. Target: 18% fuel reduction, 12% faster delivery. 50,000 simulated last-mile delivery episodes. 94.7% on-time delivery prediction accuracy. 21% route efficiency improvement vs baseline. All driver GPS, route, and customer address data processed on GCC-resident servers — zero foreign jurisdiction over customer location data.</div>
    </div>
    <div id="sc-churn" class="threat" style="border-left:3px solid var(--pink);display:none">
      <div class="tn pink">&#128101; Customer Churn Prediction — 2M+ Profile Twin</div>
      <div class="td">RAG-based decision twin that knows each customer's order history, recipient preferences (mother prefers lilies, spouse prefers roses), price sensitivity, and seasonal gifting patterns. Predicts churn 14 days before lapse, triggering personalised re-engagement. Target: 23% churn reduction. 89.4% churn prediction accuracy (local GCC model) vs 84.2% (generic cloud model) — because GCC gifting culture, Eid patterns, and local preferences are not well-represented in global training data. All 2M+ customer profiles processed exclusively on GCC-resident infrastructure.</div>
    </div>
    <div id="sc-customs" class="threat" style="border-left:3px solid var(--gold);display:none">
      <div class="tn gold">&#128196; Cross-Border Customs &amp; Compliance — GCC Clearance</div>
      <div class="td">GCC customs clearance prediction for imported flowers (phyto-sanitary certificates, temperature logs, CITES compliance for certain species). AI predicts delay risk per shipment based on origin country, documentation completeness, and historical clearance patterns at each GCC port of entry. Target: 34% customs delay reduction. Critical for Valentine's Day: a 24-hour customs delay on a Kenya rose shipment means 10,000 wilted bouquets. All import documentation and customs data processed on GCC servers — no trade intelligence leaves the region.</div>
    </div>
    <div id="sc-personal" class="threat" style="border-left:3px solid var(--rose);display:none">
      <div class="tn rose">&#127775; Personalisation Engine — GCC Cultural Intelligence</div>
      <div class="td">Product recommendation twin trained on 2M+ GCC customer profiles, seasonal trends, and regional preferences. Saudi customers prefer oud-scented arrangements and luxury packaging. Kuwaiti customers prefer premium gift sets. UAE customers skew international luxury brands. Emirati gifting occasions differ from Saudi and Kuwaiti. Target: 15% basket size increase. A generic global recommendation model misses these distinctions — MeshPilot trains on Floward's own GCC data, on GCC servers, producing a model that understands the Gulf customer. All customer preference data stays inside the GCC.</div>
    </div>
  </div>

  <!-- TAB 4: RECOMMENDATION -->
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation — Sovereign E-Commerce AI Across 6 GCC Markets</div>
    <div class="body" style="margin-bottom:10px">Deploy MeshPilot sovereign e-commerce AI across all 6 Floward GCC markets: demand forecasting, cold chain integrity, last-mile optimisation, churn prediction, customs intelligence, and personalisation — all running on GCC-resident infrastructure. Phase 1: Kuwait HQ + UAE hub. Phase 2: KSA + Qatar. Phase 3: Bahrain + Oman + Egypt expansion.</div>
    <div class="vc va"><div class="ag" style="color:var(--pink-t)">&#9989; Chief Logistics Officer — APPROVE</div><div class="rt">Cold chain integrity and last-mile route optimisation are immediate operational priorities. 0.8% simulated spoilage rate vs 2.1% baseline, 18% fuel reduction, and 99.2% on-time at 20× Valentine's surge justify immediate deployment. All logistics data stays inside GCC.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--rose-t)">&#9989; Head of Customer Experience — APPROVE</div><div class="rt">23% churn reduction and 15% basket size increase from GCC-trained personalisation model directly impact revenue. Customer trust requires that their address, gifting preferences, and recipient data never leave the Gulf. Sovereign AI is a customer promise, not just a compliance requirement.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; Supply Chain Director — APPROVE</div><div class="rt">34% customs delay reduction and farm pre-ordering accuracy for Valentine's Day surge are supply chain imperatives. Floward's competitive advantage is supply chain ownership — sovereign AI extends that ownership to the intelligence layer. All supplier and inventory data stays inside GCC.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--gold)">&#9989; CTO — APPROVE</div><div class="rt">MeshPilot deploys on Floward's existing AWS GCC local regions or private servers. No new infrastructure required for Phase 1. CPU-only inference at 3ms latency meets real-time personalisation and routing requirements. 89.4% churn accuracy vs 84.2% cloud baseline validates the local-model advantage.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--pink-t)">&#9989; CFO — APPROVE</div><div class="rt">$37.1M 10-year savings vs foreign GPU cloud (42× cheaper). $3K vs $120K per 1M predictions. Phase 1 ROI positive within 8 months from churn reduction alone. Valentine's Day surge handling improvement pays for the full deployment in a single peak season.</div></div>
    <div class="tally">
      <div class="ti"><div class="n pink">5</div><div class="l">APPROVE</div></div>
      <div class="ti"><div class="n muted">0</div><div class="l">CONDITIONAL</div></div>
      <div class="ti"><div class="n muted">0</div><div class="l">REJECT</div></div>
    </div>
    <div class="judge">"Perishable e-commerce lives or dies on data freshness. Customer trust requires data sovereignty. Foreign cloud AI is a wilting risk."</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     CENTRE PANEL — PERISHABLE LOGISTICS SIMULATION HUB
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#127758; Perishable Logistics Simulation Hub — GCC Network</div>

  <div class="sec">
    <div class="st">GCC Six-Market Network — Floward Operations</div>
    <div class="gcc-map">
      <div class="gcc-cell gcc-kw">
        <div class="gcc-flag">&#127472;&#127484;</div>
        <div class="gcc-name">Kuwait HQ</div>
        <div class="gcc-stat">Founded here · HQ<br>Market: $2B+<br>Cold hub: Al Rai<br>Vans: 48 active</div>
      </div>
      <div class="gcc-cell gcc-ae">
        <div class="gcc-flag">&#127462;&#127466;</div>
        <div class="gcc-name">UAE Hub</div>
        <div class="gcc-stat">Largest market<br>Market: $17B+<br>Cold hub: Dubai DIP<br>Vans: 112 active</div>
      </div>
      <div class="gcc-cell gcc-sa">
        <div class="gcc-flag">&#127462;&#127480;</div>
        <div class="gcc-name">Saudi Arabia</div>
        <div class="gcc-stat">Fastest growing<br>Market: $13.9B<br>Cold hub: Riyadh<br>Vans: 98 active</div>
      </div>
      <div class="gcc-cell gcc-qa">
        <div class="gcc-flag">&#127478;&#127462;</div>
        <div class="gcc-name">Qatar</div>
        <div class="gcc-stat">Premium market<br>Cold hub: Doha<br>Vans: 36 active</div>
      </div>
      <div class="gcc-cell gcc-bh">
        <div class="gcc-flag">&#127463;&#127469;</div>
        <div class="gcc-name">Bahrain</div>
        <div class="gcc-stat">Growing market<br>Cold hub: Manama<br>Vans: 24 active</div>
      </div>
      <div class="gcc-cell gcc-om">
        <div class="gcc-flag">&#127476;&#127474;</div>
        <div class="gcc-name">Oman</div>
        <div class="gcc-stat">Expanding<br>Cold hub: Muscat<br>Vans: 22 active</div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="st">Farm Origins — Supply Chain Sources</div>
    <div class="farm-row">
      <span class="farm-tag">&#127808; Kenya — Roses (primary)</span>
      <span class="farm-tag">&#127808; Ecuador — Summer flowers</span>
      <span class="farm-tag">&#127808; Netherlands — Tulips</span>
      <span class="farm-tag">&#127808; GCC Greenhouses — Local seasonal</span>
    </div>
  </div>

  <div class="sec">
    <div class="st">Cold Chain Flow — Farm to Customer Door</div>
    <div class="chain">
      <div class="chain-node"><div class="cn">&#127808;</div><div class="ct">Farm</div><div class="cs">Kenya/Ecuador/NL</div></div>
      <div class="chain-arrow">&#8594;</div>
      <div class="chain-node"><div class="cn">&#9992;&#65039;</div><div class="ct">Air Freight</div><div class="cs">18 in transit</div></div>
      <div class="chain-arrow">&#8594;</div>
      <div class="chain-node"><div class="cn">&#10052;&#65039;</div><div class="ct">Cold Hub</div><div class="cs">2°C · 6 hubs</div></div>
      <div class="chain-arrow">&#8594;</div>
      <div class="chain-node"><div class="cn">&#9986;&#65039;</div><div class="ct">Arrangement</div><div class="cs">23 stations · 98%</div></div>
      <div class="chain-arrow">&#8594;</div>
      <div class="chain-node"><div class="cn">&#128665;</div><div class="ct">Last-Mile Van</div><div class="cs">340 active</div></div>
      <div class="chain-arrow">&#8594;</div>
      <div class="chain-node"><div class="cn">&#127800;</div><div class="ct">Customer Door</div><div class="cs">99.2% on-time</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="st">Training Metrics — Sovereign AI (All Scenarios)</div>
    <div class="br"><div class="bl">Last-Mile On-Time Prediction</div><div class="bt"><div class="bf" style="width:95%;background:var(--pink)"></div></div><div class="bv pink">94.7%</div></div>
    <div class="br"><div class="bl">Churn Prediction (Local GCC Model)</div><div class="bt"><div class="bf" style="width:89%;background:var(--rose)"></div></div><div class="bv rose">89.4%</div></div>
    <div class="br"><div class="bl">Churn Prediction (Foreign Cloud)</div><div class="bt"><div class="bf" style="width:84%;background:var(--muted)"></div></div><div class="bv muted">84.2%</div></div>
    <div class="br"><div class="bl">Cold Chain Spoilage Rate</div><div class="bt"><div class="bf" style="width:8%;background:var(--green)"></div></div><div class="bv green">0.8%</div></div>
    <div class="br"><div class="bl">Route Efficiency Improvement</div><div class="bt"><div class="bf" style="width:21%;background:var(--green)"></div></div><div class="bv green">21%</div></div>
    <div class="br"><div class="bl">Customs Delay Reduction</div><div class="bt"><div class="bf" style="width:34%;background:var(--gold)"></div></div><div class="bv gold">34%</div></div>
    <div class="br"><div class="bl">Basket Size Increase</div><div class="bt"><div class="bf" style="width:15%;background:var(--pink)"></div></div><div class="bv pink">15%</div></div>
  </div>

  <div class="sec">
    <div class="st">Live Sensor Feed — GCC Operations</div>
    <div class="sensor"><span class="sn">Cold Hub Dubai DIP — Temperature</span><span class="sv2" id="s1">2.1°C · Humidity 88% · 4,200 stems optimal</span><span class="ss">GCC-RESIDENT</span></div>
    <div class="sensor"><span class="sn">Van KW-047 — Kuwait City Route</span><span class="sv2" id="s2">12 deliveries remaining · ETA 14:32 · on-time</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Air Freight KQ-441 — Nairobi to Dubai</span><span class="sv2" id="s3">In transit · 6h remaining · temp nominal</span><span class="ss">SOVEREIGN</span></div>
    <div class="sensor"><span class="sn">Arrangement Station RUH-3 — Riyadh</span><span class="sv2" id="s4">340 bouquets/hr · 97% capacity · Valentine's prep</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Customer Churn Model — UAE</span><span class="sv2" id="s5">14 high-risk profiles flagged · re-engagement triggered</span><span class="ss">GCC-RESIDENT</span></div>
    <div class="sensor"><span class="sn">Customs — Bahrain Airport</span><span class="sv2" id="s6">Shipment BH-2241 cleared · phyto cert verified</span><span class="ss">LOCAL</span></div>
  </div>

  <div class="inf-status">
    <div class="is pulse">&#127800; MeshPilot Active — GCC Infrastructure — 3ms Latency — Zero Foreign API</div>
    <div class="id">Kuwait · UAE · Saudi Arabia · Qatar · Bahrain · Oman · 2M+ customer profiles · 100% GCC data residency · Zero foreign cloud dependency</div>
  </div>

  <div class="sec">
    <div class="st">Order Volume by Market — Today</div>
    <div class="cw" style="height:130px"><canvas id="ordersC"></canvas></div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     RIGHT PANEL — ROI + CUSTOMER TRUST CALCULATOR
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#128200; ROI + Customer Trust Calculator — Floward GCC</div>
  <div class="bet">
    <div class="bt2">THE TRUST EQUATION — PERISHABLE E-COMMERCE AI</div>
    <div class="bb">In perishable e-commerce, trust is the product. Sovereign AI preserves it. $37.1M saved vs foreign GPU cloud is the financial case. The strategic case is that 2M+ GCC customer profiles — their addresses, gifting preferences, and recipient relationships — never leave the Gulf.</div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Cost &amp; Performance Comparison — MeshPilot vs Foreign Cloud GPU</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th>MeshPilot On-Prem</th><th>Foreign Cloud GPU</th></tr></thead>
      <tbody>
        <tr><td>Customer Data Residency</td><td class="win">100% GCC &#10003;</td><td class="lose">0% — foreign servers</td></tr>
        <tr><td>Cost per 1M Predictions</td><td class="win">$3,000</td><td class="lose">$120,000</td></tr>
        <tr><td>Churn Prediction Accuracy</td><td class="win">89.4% (GCC-trained)</td><td class="lose">84.2% (generic model)</td></tr>
        <tr><td>Valentine's 20× Surge</td><td class="win">99.2% on-time &#10003;</td><td class="lose">96.1% baseline</td></tr>
        <tr><td>Cold Chain Spoilage</td><td class="win">0.8% simulated</td><td class="lose">2.1% baseline</td></tr>
        <tr><td>Last-Mile Fuel Savings</td><td class="win">18% reduction</td><td class="lose">Baseline (0%)</td></tr>
        <tr><td>Inference Latency</td><td class="win">3ms on-prem</td><td class="lose">80–200ms + network</td></tr>
        <tr><td>GCC Cultural Intelligence</td><td class="win">Native (trained on GCC data)</td><td class="lose">Generic global model</td></tr>
        <tr><td>Basket Size Increase</td><td class="win">15% (personalisation)</td><td class="lose">Baseline</td></tr>
        <tr class="hl"><td><strong>10-Year Total Cost</strong></td><td class="win"><strong>$890K</strong></td><td class="lose"><strong>$38M</strong></td></tr>
      </tbody>
    </table>
  </div>

  <div class="sav">
    <div class="amt">$37.1M</div>
    <div class="lbl">10-Year AI Infrastructure Savings · 42× Cheaper · 100% GCC Data Residency · 2M+ Customer Profiles Protected</div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">10-Year Cumulative Cost — Infrastructure Only</div>
    <div class="cw" style="height:130px"><canvas id="costC"></canvas></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Customer Trust Metrics — GCC Data Sovereignty</div>
    <div class="br"><div class="bl">Customer Addresses (Foreign Exposure)</div><div class="bt"><div class="bf" style="width:1%;background:var(--green)"></div></div><div class="bv green">ZERO &#10003;</div></div>
    <div class="br"><div class="bl">Purchase Patterns (Foreign API)</div><div class="bt"><div class="bf" style="width:1%;background:var(--green)"></div></div><div class="bv green">ZERO &#10003;</div></div>
    <div class="br"><div class="bl">Recipient Preferences (Foreign Cloud)</div><div class="bt"><div class="bf" style="width:1%;background:var(--green)"></div></div><div class="bv green">ZERO &#10003;</div></div>
    <div class="br"><div class="bl">GCC Data Residency Compliance</div><div class="bt"><div class="bf" style="width:100%;background:var(--pink)"></div></div><div class="bv pink">100% &#10003;</div></div>
    <div class="br"><div class="bl">Driver GPS &amp; Route Data (GCC)</div><div class="bt"><div class="bf" style="width:100%;background:var(--pink)"></div></div><div class="bv pink">100% &#10003;</div></div>
    <div class="br"><div class="bl">Cold Chain Telemetry (GCC)</div><div class="bt"><div class="bf" style="width:100%;background:var(--green)"></div></div><div class="bv green">100% &#10003;</div></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Scale Economics — Kuwait to Full GCC + Egypt</div>
    <div class="sr"><div class="sl">Phase 1: Kuwait HQ + UAE (Year 1)</div><div class="sv pink">$89K/yr · 160 vans · 1.2M profiles</div></div>
    <div class="sr"><div class="sl">Phase 2: + KSA + Qatar (Year 2)</div><div class="sv rose">$89K/yr · 246 vans · 1.8M profiles</div></div>
    <div class="sr"><div class="sl">Phase 3: Full GCC (Year 3)</div><div class="sv green">$89K/yr · 340 vans · 2M+ profiles</div></div>
    <div class="sr"><div class="sl">Phase 4: + Egypt Expansion (Year 4+)</div><div class="sv gold">$89K/yr · 400+ vans · 2.5M+ profiles</div></div>
    <div class="sr"><div class="sl">Cost per Market (Full GCC)</div><div class="sv green">$14.8K/yr per market</div></div>
    <div class="sr"><div class="sl">Cost per Customer Profile/yr</div><div class="sv green">$0.044 (MeshPilot) vs $1.90 (cloud)</div></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Deployment Milestones — Floward Sovereign AI Rollout</div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Month 1 — Kuwait HQ Deployment</div><div class="ms-d">MeshPilot on Floward Kuwait servers. Cold chain integrity model + last-mile route optimisation live. No new infrastructure required.</div></div></div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Month 2 — UAE Hub + Valentine's Day Readiness</div><div class="ms-d">Dubai DIP cold hub integration. Valentine's Day demand forecasting model trained on 3 years of Floward GCC data. 20× surge capacity validated.</div></div></div>
    <div class="milestone"><div class="ms-dot rose"></div><div><div class="ms-t">Month 4 — Churn Prediction + Personalisation Live</div><div class="ms-d">2M+ customer profile twin active. 89.4% churn prediction. GCC cultural personalisation engine: Saudi oud preferences, Kuwaiti luxury packaging, UAE international brands.</div></div></div>
    <div class="milestone"><div class="ms-dot rose"></div><div><div class="ms-t">Month 6 — Full GCC Rollout</div><div class="ms-d">KSA, Qatar, Bahrain, Oman hubs live. Customs intelligence model active across all 6 markets. 34% customs delay reduction.</div></div></div>
    <div class="milestone"><div class="ms-dot rose"></div><div><div class="ms-t">Year 2 — Egypt Expansion + Full Sovereign AI Stack</div><div class="ms-d">Egypt market onboarded. All 7 markets on sovereign AI. Zero customer data leaves GCC/Egypt. $37.1M 10-year savings trajectory locked in.</div></div></div>
  </div>

  <div style="margin-top:8px;text-align:center;font-size:9px;color:var(--muted)">Floward · Kuwait HQ · 6 GCC Markets · Farm to Door · 2M+ Customer Profiles<br><strong style="color:var(--pink-t)">Sovereign E-Commerce AI · Zero Foreign Cloud · GCC Data Residency · agenthinkmesh.ai/floward-demo</strong></div>
</div>

</div>

<div class="bbar">All e-commerce AI runs on Floward's existing GCC infrastructure. Customer data, delivery patterns, and floral preferences never leave the Gulf. Freshness guaranteed — in flowers and in data sovereignty. &nbsp;·&nbsp; <strong style="color:var(--pink-t)">Farm to Door · GCC Data Residency · Sovereign AI</strong></div>

<script>
setInterval(()=>{const el=document.getElementById('clk');if(el)el.textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);

const sensors=[
  ['s1','2.1°C · Humidity 88% · 4,200 stems optimal','2.3°C · Humidity 86% · batch KE-2241 arriving'],
  ['s2','12 deliveries remaining · ETA 14:32 · on-time','11 deliveries remaining · traffic delay Salmiya · rerouting'],
  ['s3','In transit · 6h remaining · temp nominal','In transit · 5h 40m remaining · temp nominal'],
  ['s4','340 bouquets/hr · 97% capacity · Valentine's prep','342 bouquets/hr · 98% capacity · surge mode'],
  ['s5','14 high-risk profiles flagged · re-engagement triggered','16 high-risk profiles flagged · WhatsApp campaign sent'],
  ['s6','Shipment BH-2241 cleared · phyto cert verified','Shipment QA-0892 pending · phyto cert uploading'],
];
setInterval(()=>{sensors.forEach(([id,a,b])=>{const el=document.getElementById(id);if(el)el.textContent=Math.random()>0.1?a:b;});},4500);

function ol(){document.getElementById('lm').classList.add('open');}
function cl(){document.getElementById('lm').classList.remove('open');}

function st(n,el){
  document.querySelectorAll('.tc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('tc-'+n).classList.add('on');
  el.classList.add('on');
}

function ss(n,el){
  ['val','cold','route','churn','customs','personal'].forEach(s=>{
    const el2=document.getElementById('sc-'+s);
    if(el2)el2.style.display='none';
  });
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  const target=document.getElementById('sc-'+n);
  if(target)target.style.display='block';
  el.classList.add('on');
}

// Seasonal demand chart
new Chart(document.getElementById('seasonC'),{
  type:'bar',
  data:{
    labels:["Jan","Feb
Valentine's","Mar","Apr","May
Mother's","Jun","Jul","Aug","Sep
Ramadan","Oct","Nov","Dec
New Year"],
    datasets:[{
      label:'Order Volume (×Baseline)',
      data:[1.2,20,1.1,1.3,8,1.0,0.9,1.1,12,1.2,1.4,3.5],
      backgroundColor:['rgba(232,160,168,.4)','rgba(232,160,168,.9)','rgba(232,160,168,.4)','rgba(232,160,168,.4)','rgba(201,149,106,.7)','rgba(232,160,168,.3)','rgba(232,160,168,.3)','rgba(232,160,168,.3)','rgba(201,160,80,.7)','rgba(232,160,168,.4)','rgba(232,160,168,.4)','rgba(106,154,112,.5)'],
      borderColor:'rgba(232,160,168,.6)',borderWidth:1,borderRadius:3
    }]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{
      x:{ticks:{color:'#8a7070',font:{size:7}},grid:{color:'rgba(200,150,150,.08)'}},
      y:{ticks:{color:'#8a7070',font:{size:8},callback:function(v){return v+'×'}},grid:{color:'rgba(200,150,150,.08)'},min:0}
    }
  }
});

// Orders by market chart
new Chart(document.getElementById('ordersC'),{
  type:'bar',
  data:{
    labels:['Kuwait','UAE','Saudi','Qatar','Bahrain','Oman'],
    datasets:[{
      label:'Active Orders Today',
      data:[1840,4200,3800,1420,680,460],
      backgroundColor:['rgba(232,160,168,.7)','rgba(201,149,106,.7)','rgba(201,160,80,.6)','rgba(106,154,112,.6)','rgba(232,160,168,.5)','rgba(201,149,106,.5)'],
      borderColor:['#e8a0a8','#c9956a','#c9a050','#6a9a70','#e8a0a8','#c9956a'],
      borderWidth:1,borderRadius:3
    }]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{
      x:{ticks:{color:'#8a7070',font:{size:8}},grid:{color:'rgba(200,150,150,.08)'}},
      y:{ticks:{color:'#8a7070',font:{size:8}},grid:{color:'rgba(200,150,150,.08)'}}
    }
  }
});

// Cost chart
new Chart(document.getElementById('costC'),{
  type:'line',
  data:{
    labels:['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],
    datasets:[
      {label:'MeshPilot On-Prem ($K)',data:[89,178,267,356,445,534,623,712,801,890],borderColor:'#6a9a70',backgroundColor:'rgba(106,154,112,.08)',borderWidth:2,pointRadius:2,fill:true,tension:.2},
      {label:'Foreign Cloud GPU ($K)',data:[3800,7600,11400,15200,19000,22800,26600,30400,34200,38000],borderColor:'#e8a0a8',backgroundColor:'rgba(232,160,168,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.2}
    ]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#8a7070',font:{size:8},boxWidth:8}}},
    scales:{
      x:{ticks:{color:'#8a7070',font:{size:8}},grid:{color:'rgba(200,150,150,.08)'}},
      y:{ticks:{color:'#8a7070',font:{size:8},callback:function(v){return '$'+v+'K'}},grid:{color:'rgba(200,150,150,.08)'}}
    }
  }
});
<\/script>
</body>
</html>`;function v(){return e.useEffect(()=>(document.title="Floward — Sovereign E-Commerce & Perishable Logistics AI",()=>{document.title="AgenThinkMesh"}),[]),s.jsx("div",{"data-loc":"client/src/pages/FlowardDemo.tsx:578",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:s.jsx("iframe",{"data-loc":"client/src/pages/FlowardDemo.tsx:579",srcDoc:i,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"Floward Sovereign E-Commerce & Perishable Logistics AI Command Center",sandbox:"allow-scripts"})})}export{v as default};
