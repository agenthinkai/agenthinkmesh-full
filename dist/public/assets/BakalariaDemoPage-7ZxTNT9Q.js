import{r as e,j as t}from"./index-THH9YYiu.js";const a=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bakalaria — Digital Decision Twin · KD 1,000,000 Facility</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{
  --bg:#030a06;--surface:rgba(255,255,255,.04);--border:rgba(255,255,255,.07);
  --teal:#00c896;--teal-l:#00e5b0;--glow:#00ffb3;--gold:#ffd740;
  --green:#00e676;--red:#ff1744;--amber:#ffd740;--blue:#4a9eff;
  --text:#dff2ea;--muted:#4a7060;--warn:#ff9100;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code',monospace;font-size:13px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,#00c896,#ffd740,#00c896);}
.hdr{background:linear-gradient(135deg,rgba(0,200,150,.12),rgba(255,215,64,.05));border-bottom:1px solid rgba(0,200,150,.35);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:14px;}
.logo{width:40px;height:40px;background:linear-gradient(135deg,#00c896,#ffd740);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#030a06;letter-spacing:-1px;}
.htitle{font-size:16px;font-weight:700;color:var(--teal-l);letter-spacing:2px;text-transform:uppercase;}
.hsub{color:var(--muted);font-size:10px;margin-top:2px;}
.badge{padding:3px 10px;border-radius:12px;font-size:10px;}
.b-kd{background:rgba(255,215,64,.1);border:1px solid var(--gold);color:var(--gold);}
.b-kw{background:rgba(0,200,150,.1);border:1px solid var(--teal);color:var(--teal);}
.b-live{background:rgba(0,230,118,.1);border:1px solid var(--green);color:var(--green);}
.b-warn{background:rgba(255,145,0,.1);border:1px solid var(--warn);color:var(--warn);}
.mbar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:90px;padding:10px 14px;background:var(--bg);text-align:center;}
.m .v{font-size:17px;font-weight:700;color:var(--teal-l);}
.m .v.g{color:var(--green);}.m .v.r{color:var(--red);}.m .v.a{color:var(--amber);}.m .v.b{color:var(--blue);}
.m .l{font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:18px;overflow-y:auto;max-height:calc(100vh - 148px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-size:10px;font-weight:700;color:var(--teal-l);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(0,200,150,.25);}
.sec{margin-bottom:18px;}
.st{font-size:9px;color:var(--teal);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
.body{color:var(--text);line-height:1.75;font-size:12px;opacity:.9;}
.tabs{display:flex;gap:1px;background:var(--border);margin-bottom:14px;overflow-x:auto;}
.tab{padding:7px 14px;cursor:pointer;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;}
.tab.on{color:var(--teal-l);border-bottom:2px solid var(--teal-l);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);}
.sl{color:var(--muted);}.sv{font-weight:600;}
.teal{color:var(--teal-l);}.green{color:var(--green);}.red{color:var(--red);}.amber{color:var(--amber);}.blue{color:var(--blue);}.warn{color:var(--warn);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.bl{width:150px;font-size:10px;color:var(--muted);flex-shrink:0;}
.bt{flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;}
.bf{height:100%;border-radius:3px;}
.bv{width:80px;text-align:right;font-size:10px;}
.vc{background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:10px;margin-bottom:7px;}
.vc .ag{font-weight:700;font-size:11px;margin-bottom:3px;}
.vc .rt{color:var(--muted);font-size:10px;line-height:1.55;}
.va{border-left:3px solid var(--green);}.vco{border-left:3px solid var(--amber);}.vr{border-left:3px solid var(--red);}
.tally{display:flex;gap:16px;padding:10px 14px;background:rgba(0,200,150,.05);border:1px solid rgba(0,200,150,.2);border-radius:5px;margin:10px 0;}
.ti{text-align:center;}.ti .n{font-size:22px;font-weight:700;}.ti .l{font-size:9px;color:var(--muted);}
.judge{background:rgba(0,200,150,.08);border:1px solid rgba(0,200,150,.35);border-radius:5px;padding:12px;margin-top:10px;font-size:11px;line-height:1.7;color:var(--teal-l);}
.bet{background:linear-gradient(135deg,rgba(0,200,150,.1),rgba(255,215,64,.06));border:1px solid rgba(0,200,150,.4);border-radius:6px;padding:14px 16px;margin-bottom:16px;}
.bet .bt2{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.bet .bb{font-size:13px;font-weight:700;line-height:1.6;color:var(--teal-l);}
.tbl{width:100%;border-collapse:collapse;font-size:11px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:9px;padding:5px 7px;border-bottom:1px solid var(--border);text-align:left;}
.tbl td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.03);}
.tbl .win{color:var(--green);font-weight:700;}.tbl .lose{color:var(--red);}.tbl .hl{background:rgba(0,200,150,.05);}
.tbl .hist{color:var(--muted);}
.sav{background:linear-gradient(135deg,rgba(0,230,118,.08),rgba(0,200,150,.06));border:1px solid rgba(0,230,118,.3);border-radius:5px;padding:12px;margin:10px 0;text-align:center;}
.sav .amt{font-size:28px;font-weight:700;color:var(--green);}
.sav .lbl{font-size:10px;color:var(--muted);margin-top:2px;}
.breach{background:rgba(255,145,0,.08);border:1px solid rgba(255,145,0,.35);border-radius:5px;padding:12px;margin:10px 0;}
.breach .bt2{font-size:9px;color:var(--warn);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.breach .bb{font-size:11px;line-height:1.7;}
.tranche{background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:10px;margin-bottom:7px;}
.tranche .tn{font-size:11px;font-weight:700;margin-bottom:4px;}
.tranche .td{font-size:10px;color:var(--muted);line-height:1.6;}
.scen{display:flex;gap:1px;background:var(--border);margin-bottom:14px;overflow-x:auto;}
.sc{flex:1;min-width:80px;padding:7px 10px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);text-align:center;white-space:nowrap;}
.sc.on{color:var(--teal-l);border-bottom:2px solid var(--teal-l);}
.cw{position:relative;height:160px;margin-top:8px;}
.lbtn{display:inline-flex;align-items:center;gap:8px;background:rgba(0,200,150,.12);border:1px solid var(--teal);color:var(--teal-l);padding:7px 18px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:100;align-items:center;justify-content:center;}
.modal.open{display:flex;}
.mbox{background:#030a06;border:1px solid var(--teal);border-radius:8px;padding:32px 40px;max-width:500px;text-align:center;}
.mbox h2{color:var(--teal-l);font-size:16px;margin-bottom:12px;letter-spacing:1px;}
.mbox p{color:var(--muted);font-size:12px;line-height:1.7;margin-bottom:12px;}
.mbox .cbtn{background:rgba(0,200,150,.15);border:1px solid var(--teal);color:var(--teal-l);padding:8px 24px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:1px;}
.mbox .ct{color:var(--teal);font-size:11px;margin-top:12px;}
.milestone{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;}
.ms-dot{width:8px;height:8px;border-radius:50%;background:var(--teal);margin-top:3px;flex-shrink:0;}
.ms-dot.warn{background:var(--warn);}
.ms-dot.green{background:var(--green);}
.ms-dot.red{background:var(--red);}
.ms-content .ms-t{font-size:10px;font-weight:700;color:var(--teal-l);}
.ms-content .ms-d{font-size:9px;color:var(--muted);line-height:1.5;}
</style>
</head>
<body>
<div class="stripe"></div>
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>⚡ COUNCIL OF 8 — LIVE AI CREDIT ANALYSIS</h2>
    <p>Eight specialist AI agents simultaneously interrogate the Bakalaria facility: Loan Underwriter, CBK Compliance, Sector Analyst, Risk Flagger, DCF Modeler, Fraud Detector, Risk Attributor, and Jurisdiction Intel.</p>
    <p>Each agent returns an independent vote. The Judge synthesises all eight into a governed credit verdict in under 30 seconds.</p>
    <p style="color:var(--teal-l);font-weight:700;font-size:12px">Full live Council available at: agenthinkmesh.ai/twin/bakalaria</p>
    <div class="ct">Contact: <strong>bakalaria@agenthinkmesh.ai</strong></div>
    <br><button class="cbtn" onclick="cl()">CLOSE</button>
  </div>
</div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">BKL</div>
    <div>
      <div class="htitle">Bakalaria — Digital Decision Twin</div>
      <div class="hsub">B2B Food Distribution · Kuwait · KD 1,000,000 Structured Corporate Debt Facility</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-kd">KD 1,000,000 Facility</span>
    <span class="badge b-kw">Kuwait</span>
    <span class="badge b-warn">⚠ DSCR Breach M1–16</span>
    <span class="badge b-live">● LIVE TWIN</span>
    <span style="color:var(--muted);font-size:10px" id="clk"></span>
  </div>
</div>
<div class="mbar">
  <div class="m"><div class="v">KD 2.44M</div><div class="l">2025 Revenue</div></div>
  <div class="m"><div class="v a">KD 48.78M</div><div class="l">2029 Target (20×)</div></div>
  <div class="m"><div class="v g">KD 7.08M</div><div class="l">Cumul. FCF 48M</div></div>
  <div class="m"><div class="v g">41.92×</div><div class="l">DSCR Month 48</div></div>
  <div class="m"><div class="v r">M1–16</div><div class="l">Breach Window</div></div>
  <div class="m"><div class="v g">1.74×</div><div class="l">DSCR Month 17</div></div>
  <div class="m"><div class="v g">87.4%</div><div class="l">Outlet Retention</div></div>
  <div class="m"><div class="v b">1,297</div><div class="l">Active Outlets</div></div>
</div>
<div class="grid">

<!-- LEFT: Executive Twin + Scenarios -->
<div class="panel">
  <div class="pt">🧠 Executive Digital Twin — Bakalaria</div>
  <div class="bet">
    <div class="bt2">The Bet</div>
    <div class="bb">MOO must grow from 1,297 to 7,500+ outlets by December 2029.<br>The demand is proven. The facility funds the supply-side scaling.</div>
  </div>
  <button class="lbtn" onclick="ol()">⚡ Council of 8 — Live Credit Analysis</button>
  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Brief</div>
    <div class="tab" onclick="st('hist',this)">History</div>
    <div class="tab" onclick="st('unit',this)">Unit Economics</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief</div>
    <div class="body">Bakalaria is a B2B and B2C food distribution platform operating across Kuwait with over a decade of trading history. The business currently serves 1,297 active outlet accounts, of which 1,134 are repeat customers — an 87.4% retention rate that confirms genuine product-market fit.<br><br>Revenue has contracted from KD 3.13M (2023) to KD 2.44M (2025) — not because outlets are leaving, but because new outlet acquisition has slowed. The retention data is the strongest indicator in the file: the demand is proven, the moat is real, and the facility funds the supply-side scaling to reverse the contraction.<br><br>The 20× target (KD 48.78M by 2029) requires MOO to grow from 1,297 to 7,500+ outlets — a 5.8× expansion over 48 months. At 87.4% retention, every outlet acquired stays. The compounding effect of that retention rate is what makes the 20× target achievable.</div>
  </div>
  <div class="tc" id="tc-hist">
    <div class="st">Verified Historical Performance (Audited)</div>
    <table class="tbl">
      <thead><tr><th>Year</th><th>Revenue</th><th>Orders</th><th>MOO</th><th>ROO</th></tr></thead>
      <tbody>
        <tr class="hist"><td>2023</td><td>KD 3.128M</td><td>48,329</td><td>1,127</td><td>1,022</td></tr>
        <tr class="hist"><td>2024</td><td>KD 2.790M</td><td>47,408</td><td>1,121</td><td>1,007</td></tr>
        <tr><td style="color:var(--teal-l)">2025</td><td class="teal">KD 2.439M</td><td class="teal">39,967</td><td class="teal">1,297</td><td class="teal">1,134</td></tr>
      </tbody>
    </table>
    <div style="margin-top:10px;font-size:10px;color:var(--muted);line-height:1.7">MOO grew from 1,127 to 1,297 (+15%) even as revenue contracted — confirming the outlet base is expanding but AOV is compressing. The facility addresses both: logistics capex reduces delivery cost (protecting AOV) and working capital accelerates outlet onboarding (growing MOO).</div>
    <div style="margin-top:10px"><div class="st">Revenue History + Projection</div><div class="cw"><canvas id="revC"></canvas></div></div>
  </div>
  <div class="tc" id="tc-unit">
    <div class="st">Unit Economics — 2025 Baseline</div>
    <div class="sr"><div class="sl">Blended Gross Margin</div><div class="sv teal">5.1%</div></div>
    <div class="sr"><div class="sl">Average Order Value (AOV)</div><div class="sv">KD 61</div></div>
    <div class="sr"><div class="sl">Annual Payroll (30 FTEs)</div><div class="sv">KD 0.270M (KD 9K/FTE)</div></div>
    <div class="sr"><div class="sl">Logistics + Fleet + Rent Opex</div><div class="sv">KD 0.050M</div></div>
    <div class="sr"><div class="sl">EBITDA (2025)</div><div class="sv red">KD (0.196M)</div></div>
    <div style="margin-top:12px"><div class="st">Margin Expansion Trajectory</div>
    <div class="br"><div class="bl">2025 (Baseline)</div><div class="bt"><div class="bf" style="width:28%;background:var(--red)"></div></div><div class="bv red">5.1%</div></div>
    <div class="br"><div class="bl">2026 (Year 1)</div><div class="bt"><div class="bf" style="width:44%;background:var(--amber)"></div></div><div class="bv amber">8.0%</div></div>
    <div class="br"><div class="bl">2027 (Year 2)</div><div class="bt"><div class="bf" style="width:64%;background:var(--teal)"></div></div><div class="bv teal">11.5%</div></div>
    <div class="br"><div class="bl">2028 (Year 3)</div><div class="bt"><div class="bf" style="width:83%;background:var(--teal-l)"></div></div><div class="bv teal">15.0%</div></div>
    <div class="br"><div class="bl">2029 (Year 4 Target)</div><div class="bt"><div class="bf" style="width:100%;background:var(--green)"></div></div><div class="bv green">18.0%</div></div>
    </div>
  </div>
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation to the Bank</div>
    <div class="body">APPROVE with a formal covenant holiday waiver for months 1–16. The DSCR breach is a modelled ramp-up artefact — not a structural default risk. The business clears 1.20× at month 17 and reaches 41.92× by month 48.<br><br>Set MOO as the primary quarterly reporting metric. Month 12 milestone: 1,600+ active outlets. If MOO reaches 1,600 by month 12, the base case trajectory is on track and the covenant holiday can be closed early.<br><br>The 87.4% outlet retention rate is the single strongest credit indicator in this file. It means the bank is not lending against a demand assumption — it is lending against a proven, sticky customer base that is waiting to be served at scale.</div>
  </div>

  <!-- Scenario selector -->
  <div style="margin-top:18px">
    <div class="st">Scenario Selector</div>
    <div class="scen">
      <div class="sc on" onclick="ss('base',this)">Base 20×</div>
      <div class="sc" onclick="ss('cons',this)">Conservative</div>
      <div class="sc" onclick="ss('comp',this)">Competitive</div>
      <div class="sc" onclick="ss('horm',this)">Hormuz</div>
      <div class="sc" onclick="ss('deesc',this)">De-escalation</div>
      <div class="sc" onclick="ss('stress',this)">Stress</div>
    </div>
    <div id="sc-base" class="vc va" style="display:block">
      <div class="ag" style="color:var(--green)">✅ BASE CASE — 20× Target · Confidence: 72%</div>
      <div class="rt">Revenue: KD 2.44M → KD 48.78M. MOO: 1,297 → 7,500+. DSCR clears at M17 (1.74×). Cumulative FCF: KD 7.08M. Financing cost: KD 127K (1.8% of FCF). <strong style="color:var(--green)">VERDICT: APPROVED</strong> — covenant holiday M1–16, MOO reporting quarterly.</div>
    </div>
    <div id="sc-cons" class="vc va" style="display:none">
      <div class="ag" style="color:var(--green)">✅ CONSERVATIVE — 10× Path · Confidence: 85%</div>
      <div class="rt">Revenue: KD 2.44M → KD 24.4M. MOO: 1,297 → 3,800. DSCR clears at M19 (1.35×). Cumulative FCF: KD 3.2M. Facility still fully serviceable. <strong style="color:var(--green)">VERDICT: APPROVED</strong> — lower growth, higher certainty, facility repaid comfortably.</div>
    </div>
    <div id="sc-comp" class="vc vco" style="display:none">
      <div class="ag" style="color:var(--amber)">⚠️ COMPETITIVE ENTRY — Sary/Regional · Confidence: 60%</div>
      <div class="rt">A funded regional entrant (e.g. Sary) captures 20% of addressable outlets by Year 2. MOO growth slows to 30% annually. Revenue reaches KD 28M by 2029. DSCR still clears at M20. <strong style="color:var(--amber)">VERDICT: CONDITIONAL</strong> — add competitive monitoring covenant; trigger review if MOO growth drops below 15% in any quarter.</div>
    </div>
    <div id="sc-horm" class="vc vr" style="display:none">
      <div class="ag" style="color:var(--warn)">🚨 HORMUZ CLOSURE — Supply Chain Shock · Confidence: 90%</div>
      <div class="rt">Kuwait imports 90%+ of food via sea. Shuaiba Port suspension (as seen Mar 2026). COGS +25–40%. Government price controls prevent pass-through. Gross margin compresses to 2–3%. Tranche A revolver provides 8–10 months runway. <strong style="color:var(--warn)">VERDICT: HIGH RISK</strong> — include force majeure clause before drawdown. This risk is not theoretical in 2026.</div>
    </div>
    <div id="sc-deesc" class="vc va" style="display:none">
      <div class="ag" style="color:var(--teal-l)">🕊️ DE-ESCALATION — Peace Dividend · Confidence: 55%</div>
      <div class="rt">Ceasefire holds, Hormuz fully reopens. Freight normalises over 6–12 months, adding +1.5–2.0pp to gross margin in Year 1. DSCR clears at M14 — 3 months early. Cumulative FCF: KD 9.2M. <strong style="color:var(--green)">VERDICT: APPROVED — ACCELERATED</strong> — lock in forward freight contracts immediately at post-ceasefire rates.</div>
    </div>
    <div id="sc-stress" class="vc vr" style="display:none">
      <div class="ag" style="color:var(--red)">🔴 STRESS TEST — Revenue Flat · Confidence: 95%</div>
      <div class="rt">Zero growth scenario. Revenue stays at KD 2.44M throughout. EBITDA remains negative. Tranche A revolver exhausted by M14. Facility cannot be serviced from operations alone. <strong style="color:var(--red)">VERDICT: VETOED</strong> — this is the floor. It confirms the facility is not viable without growth. The 87.4% retention rate is the evidence that growth is not an assumption.</div>
    </div>
  </div>
</div>

<!-- CENTRE: Financial Model -->
<div class="panel">
  <div class="pt">📊 48-Month Pro-Forma Financial Model</div>
  <div class="sec">
    <div class="st">Revenue & EBITDA Trajectory (KD Millions)</div>
    <div class="cw" style="height:180px"><canvas id="rebitC"></canvas></div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st">Full P&L Summary (KD Millions)</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th>2023</th><th>2024</th><th>2025</th><th>2026E</th><th>2027E</th><th>2028E</th><th>2029T</th></tr></thead>
      <tbody>
        <tr><td>Revenue</td><td class="hist">3.128</td><td class="hist">2.790</td><td class="teal">2.439</td><td>7.500</td><td>18.000</td><td>32.000</td><td class="win">48.780</td></tr>
        <tr><td>Gross Margin</td><td class="hist">—</td><td class="hist">—</td><td class="teal">5.1%</td><td>8.0%</td><td>11.5%</td><td>15.0%</td><td class="win">18.0%</td></tr>
        <tr><td>Gross Profit</td><td class="hist">—</td><td class="hist">—</td><td class="teal">0.124</td><td>0.600</td><td>2.070</td><td>4.800</td><td class="win">8.780</td></tr>
        <tr><td>Headcount (FTEs)</td><td class="hist">—</td><td class="hist">—</td><td class="teal">30</td><td>45</td><td>75</td><td>110</td><td>150</td></tr>
        <tr><td>Payroll</td><td class="hist">—</td><td class="hist">—</td><td class="teal">0.270</td><td>0.405</td><td>0.675</td><td>0.990</td><td>1.350</td></tr>
        <tr><td>Logistics Opex</td><td class="hist">—</td><td class="hist">—</td><td class="teal">0.050</td><td>0.077</td><td>0.300</td><td>0.500</td><td>0.843</td></tr>
        <tr><td>EBITDA</td><td class="hist">—</td><td class="hist">—</td><td class="red">(0.196)</td><td class="amber">0.118</td><td class="teal">1.745</td><td class="teal">4.310</td><td class="win">7.887</td></tr>
        <tr><td>MOO (Outlets)</td><td class="hist">1,127</td><td class="hist">1,121</td><td class="teal">1,297</td><td>2,000</td><td>3,500</td><td>5,000</td><td class="win">7,500+</td></tr>
        <tr><td>DSCR</td><td class="hist">—</td><td class="hist">—</td><td class="red">—</td><td class="amber">1.35×</td><td class="teal">2.10×</td><td class="teal">3.65×</td><td class="win">5.40×</td></tr>
      </tbody>
    </table>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st">MOO Growth — Monthly Active Outlets</div>
    <div class="cw" style="height:140px"><canvas id="mooC"></canvas></div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st">DSCR Covenant Tracker</div>
    <div class="breach">
      <div class="bt2">⚠ Covenant Breach Window: Months 1–16</div>
      <div class="bb">DSCR falls below 1.20× covenant during the ramp-up phase. This is a modelled artefact — not a structural default risk. The business is investing in outlet acquisition and logistics infrastructure before EBITDA scales. <strong style="color:var(--teal-l)">Recommended action: pre-negotiate a formal covenant holiday waiver for M1–16 before drawdown.</strong></div>
    </div>
    <table class="tbl" style="margin-top:8px">
      <thead><tr><th>Milestone</th><th>DSCR</th><th>Covenant</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>Month 6</td><td class="red">0.42×</td><td>1.20×</td><td class="red">BREACH</td></tr>
        <tr><td>Month 12</td><td class="amber">0.89×</td><td>1.20×</td><td class="amber">BREACH</td></tr>
        <tr><td>Month 16</td><td class="amber">1.14×</td><td>1.20×</td><td class="amber">BREACH</td></tr>
        <tr class="hl"><td><strong>Month 17</strong></td><td class="green"><strong>1.74×</strong></td><td>1.20×</td><td class="green"><strong>CLEAN ✓</strong></td></tr>
        <tr><td>Month 24</td><td class="teal">2.10×</td><td>1.20×</td><td class="green">CLEAN ✓</td></tr>
        <tr><td>Month 36</td><td class="teal">3.65×</td><td>1.20×</td><td class="green">CLEAN ✓</td></tr>
        <tr><td>Month 48</td><td class="win">41.92×</td><td>1.20×</td><td class="green">CLEAN ✓</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- RIGHT: Facility Structure + IC Verdict -->
<div class="panel">
  <div class="pt">🏦 Facility Structure & IC Verdict</div>
  <div class="sec">
    <div class="st">KD 1,000,000 Structured Corporate Debt — Tranche Structure</div>
    <div class="tranche" style="border-left:3px solid var(--teal)">
      <div class="tn teal">Tranche A — Working Capital Revolver · KD 350,000</div>
      <div class="td">Secured against trade receivables and inventory velocity across B2B/B2C channels. Provides 8–10 months emergency runway in Hormuz closure scenario. Revolving — drawn and repaid as working capital cycles.</div>
    </div>
    <div class="tranche" style="border-left:3px solid var(--amber)">
      <div class="tn amber">Tranche B — Logistics & Dark-Store Capex · KD 550,000</div>
      <div class="td">4-year amortising term facility. 6-month principal grace period. Funds fleet expansion, dark-store infrastructure, and hypermarket logistics buildout. Fully repaid by Month 48.</div>
    </div>
    <div class="tranche" style="border-left:3px solid var(--blue)">
      <div class="tn blue">Tranche C — Digital Platform & AI Automation · KD 100,000</div>
      <div class="td">Dedicated liquidity reserve for agentic software deployment, order management automation, and AI-powered demand forecasting. Drawn in Year 1–2.</div>
    </div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st">Council of 8 — Pre-Computed Credit Verdict</div>
    <div style="color:var(--muted);font-size:9px;margin-bottom:10px">Q: Should the bank approve the KD 1,000,000 structured facility for Bakalaria?</div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Loan Underwriter — APPROVE</div><div class="rt">DSCR clears at M17 (1.74×) and reaches 41.92× by M48. Financing cost of KD 127K represents 1.8% of KD 7.08M cumulative FCF. The facility is well-sized relative to the cash generation it enables. Recommend covenant holiday M1–16 with MOO milestone reporting.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ CBK Compliance — APPROVE</div><div class="rt">Facility structure is compliant with CBK lending regulations. Tranche A revolver against trade receivables is standard secured lending. Tranche B amortising term loan with grace period is conventional capex financing. No regulatory impediments identified.</div></div>
    <div class="vc vco"><div class="ag" style="color:var(--amber)">⚠️ Risk Flagger — CONDITIONAL</div><div class="rt">Approve conditional on: (1) force majeure clause covering Hormuz closure events, (2) formal covenant holiday waiver for M1–16 documented before drawdown, (3) MOO milestone covenant at M12 (1,600+ outlets). Revenue contraction 2023–2025 must be formally attributed in the credit memo.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Sector Analyst — APPROVE</div><div class="rt">Kuwait B2B food distribution market is $4.8B+. Bakalaria's 2.5% target market share by 2029 is not a dominant position — it is achievable. 87.4% outlet retention rate is exceptional for B2B distribution. No regional competitor has demonstrated equivalent retention in Kuwait.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ DCF Modeler — APPROVE</div><div class="rt">48-month DCF at 12% discount rate yields NPV of KD 4.2M on the base case. Even at 20% discount rate (stress), NPV remains positive at KD 2.1M. The facility IRR is approximately 38% on the base case — well above any reasonable hurdle rate for secured corporate lending.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Fraud Detector — APPROVE</div><div class="rt">Revenue decline pattern is consistent with sector-wide AOV compression and outlet acquisition slowdown — not anomalous. MOO growth (1,127 → 1,297) during revenue contraction is internally consistent. No red flags in the order-to-revenue ratio or outlet concentration.</div></div>
    <div class="vc vco"><div class="ag" style="color:var(--amber)">⚠️ Risk Attributor — CONDITIONAL</div><div class="rt">Hormuz geopolitical risk is material and not theoretical (March 2026 closure event). Force majeure clause is mandatory. Competitive entry risk from Sary or similar is moderate — Kuwait B2B market is fragmented and Bakalaria's retention moat is real but not impenetrable.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Jurisdiction Intel — APPROVE</div><div class="rt">Kuwait CBK regulations support secured B2B lending of this structure. No sanctions or regulatory barriers. KD-denominated facility eliminates FX risk. Kuwait's food import dependency creates structural demand for efficient distribution platforms — regulatory tailwind, not headwind.</div></div>
    <div class="tally">
      <div class="ti"><div class="n green">6</div><div class="l">APPROVE</div></div>
      <div class="ti"><div class="n amber">2</div><div class="l">CONDITIONAL</div></div>
      <div class="ti"><div class="n red">0</div><div class="l">REJECT</div></div>
    </div>
    <div class="judge"><strong>JUDGE — APPROVED WITH CONDITIONS:</strong> The facility is sound. The DSCR breach in M1–16 is a ramp-up artefact, not a structural default risk — the 87.4% outlet retention rate is the evidence. Conditions before drawdown: (1) formal covenant holiday waiver M1–16, (2) force majeure clause covering Hormuz closure, (3) MOO milestone covenant at M12 (1,600+ outlets). The bank's credit decision is a question of whether Bakalaria can reach Month 17 with the business intact. The answer is yes.</div>
  </div>
  <div class="sec" style="margin-top:18px">
    <div class="st">Key Milestones</div>
    <div class="milestone"><div class="ms-dot warn"></div><div class="ms-content"><div class="ms-t">Month 6 — First Tranche B Draw</div><div class="ms-d">KD 275K logistics capex deployed. Fleet expansion begins. MOO target: 1,450 outlets.</div></div></div>
    <div class="milestone"><div class="ms-dot warn"></div><div class="ms-content"><div class="ms-t">Month 12 — MOO Covenant Check</div><div class="ms-d">1,600+ outlets required. DSCR still below covenant (0.89×) — within pre-agreed holiday window.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Month 17 — DSCR Clears ✓</div><div class="ms-d">DSCR reaches 1.74×. Covenant holiday closes. Clean from this point forward.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Month 24 — Year 2 Close</div><div class="ms-d">Revenue KD 18M. DSCR 2.10×. MOO 3,500. Tranche A revolver fully cycling.</div></div></div>
    <div class="milestone"><div class="ms-dot green"></div><div class="ms-content"><div class="ms-t">Month 48 — Full Repayment</div><div class="ms-d">Tranche B fully repaid. DSCR 41.92×. Cumulative FCF KD 7.08M. 20× target achieved.</div></div></div>
  </div>
  <div class="sav">
    <div class="amt">KD 7.08M</div>
    <div class="lbl">Cumulative Free Cash Flow — 48 Months · Base Case</div>
  </div>
  <div style="margin-top:10px;text-align:center;font-size:10px;color:var(--muted)">Full live twin with 7 scenarios + Council of 8 live inference:<br><strong style="color:var(--teal-l)">agenthinkmesh.ai/twin/bakalaria</strong></div>
</div>

</div>
<script>
setInterval(()=>{document.getElementById('clk').textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);
function ol(){document.getElementById('lm').classList.add('open');}
function cl(){document.getElementById('lm').classList.remove('open');}
function st(n,el){
  document.querySelectorAll('.tc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('tc-'+n).classList.add('on');
  el.classList.add('on');
}
function ss(n,el){
  ['base','cons','comp','horm','deesc','stress'].forEach(s=>{document.getElementById('sc-'+s).style.display='none';});
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  document.getElementById('sc-'+n).style.display='block';
  el.classList.add('on');
}
// Revenue history + projection chart
new Chart(document.getElementById('revC'),{type:'bar',data:{labels:['2023','2024','2025','2026E','2027E','2028E','2029T'],datasets:[{label:'Revenue (KD M)',data:[3.128,2.790,2.439,7.5,18.0,32.0,48.78],backgroundColor:['rgba(74,160,255,.4)','rgba(74,160,255,.4)','rgba(0,200,150,.5)','rgba(0,200,150,.55)','rgba(0,200,150,.65)','rgba(0,200,150,.75)','rgba(0,230,118,.9)'],borderColor:['#4a9eff','#4a9eff','#00c896','#00c896','#00c896','#00c896','#00e676'],borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#4a7060',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a7060',font:{size:9},callback:v=>'KD '+v+'M'},grid:{color:'rgba(255,255,255,.03)'}}}}});
// Revenue + EBITDA
new Chart(document.getElementById('rebitC'),{type:'bar',data:{labels:['2025','2026E','2027E','2028E','2029T'],datasets:[{label:'Revenue (KD M)',data:[2.439,7.5,18.0,32.0,48.78],backgroundColor:'rgba(0,200,150,.4)',borderColor:'#00c896',borderWidth:1,borderRadius:2,yAxisID:'y'},{label:'EBITDA (KD M)',data:[-0.196,0.118,1.745,4.310,7.887],type:'line',borderColor:'#ffd740',backgroundColor:'rgba(255,215,64,.1)',borderWidth:2,pointRadius:4,fill:true,tension:.3,yAxisID:'y'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#4a7060',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#4a7060',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a7060',font:{size:9},callback:v=>'KD '+v+'M'},grid:{color:'rgba(255,255,255,.03)'}}}}});
// MOO growth
new Chart(document.getElementById('mooC'),{type:'line',data:{labels:['2023','2024','2025','2026E','2027E','2028E','2029T'],datasets:[{label:'MOO (Active Outlets)',data:[1127,1121,1297,2000,3500,5000,7500],borderColor:'#00e5b0',backgroundColor:'rgba(0,229,176,.08)',borderWidth:2,pointRadius:4,fill:true,tension:.3},{label:'ROO (Repeat Outlets)',data:[1022,1007,1134,1750,3150,4600,6900],borderColor:'#ffd740',backgroundColor:'rgba(255,215,64,.05)',borderWidth:2,pointRadius:3,fill:false,tension:.3,borderDash:[4,3]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#4a7060',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#4a7060',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#4a7060',font:{size:9}},grid:{color:'rgba(255,255,255,.03)'}}}}});
<\/script>
</body>
</html>`;function s(){return e.useEffect(()=>(document.title="Bakalaria — Digital Decision Twin · KD 1,000,000 Facility",()=>{document.title="AgenThinkMesh"}),[]),t.jsxDEV("div",{"data-loc":"client/src/pages/BakalariaDemoPage.tsx:362",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:t.jsxDEV("iframe",{"data-loc":"client/src/pages/BakalariaDemoPage.tsx:363",srcDoc:a,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"Bakalaria Digital Decision Twin",sandbox:"allow-scripts"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/BakalariaDemoPage.tsx",lineNumber:363,columnNumber:7},this)},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/BakalariaDemoPage.tsx",lineNumber:362,columnNumber:5},this)}export{s as default};
