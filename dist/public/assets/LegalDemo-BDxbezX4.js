import{r as e,j as i}from"./react-vendor-ChkOGfOz.js";import"./vendor-B43sDH1-.js";import"./date-utils-B2ZejYPs.js";import"./export-libs-suHawyUQ.js";import"./charts-Bhwmpjvm.js";import"./trpc-Dsj9agTq.js";import"./radix-BzVH_mSP.js";import"./flow-DCgLNMlO.js";const a=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Legal Case Twin — Sovereign Legal Intelligence</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0e0a08;--bg2:#120d0a;--surface:#180f0b;--surface2:#1c1208;
  --burg:#6b1a1a;--burg-l:#8b2222;--burg-t:#c0392b;--burg-dim:#3a0d0d;
  --gold:#c9a050;--gold-l:#e8c880;--gold-t:#f0d060;--gold-dim:#5a4010;
  --cream:#f5f0e8;--cream-d:#d4c9b0;--cream-dim:rgba(245,240,232,.08);
  --slate:#1a2030;--slate-l:#222a3a;
  --text:#e8e0d0;--muted:#7a6a5a;--light:#2a1e18;
  --border:rgba(201,160,80,.2);--border2:rgba(201,160,80,.1);--border3:rgba(107,26,26,.4);
  --green:#2e7d52;--green-t:#3daa6e;
  --red:#c0392b;--red-dim:#3a0d0d;
  --mono:'JetBrains Mono',monospace;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:12px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,var(--burg) 0%,var(--gold) 50%,var(--burg-l) 100%);}
.hdr{background:linear-gradient(135deg,rgba(14,10,8,.98),rgba(24,15,11,.95));border-bottom:1px solid var(--border);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:12px;}
.logo{width:52px;height:52px;background:linear-gradient(135deg,var(--burg),var(--gold-dim));border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:22px;border:1px solid var(--border);}
.htitle{font-family:'EB Garamond',serif;font-size:16px;font-weight:700;color:var(--gold-l);letter-spacing:.5px;}
.hsub{color:var(--muted);font-size:9px;margin-top:2px;letter-spacing:1px;text-transform:uppercase;}
.badge{padding:3px 9px;border-radius:2px;font-size:8px;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;font-weight:600;font-family:var(--mono);}
.b-priv{background:rgba(107,26,26,.2);border:1px solid var(--burg-dim);color:#e88080;}
.b-zc{background:rgba(201,160,80,.1);border:1px solid var(--gold-dim);color:var(--gold);}
.b-bar{background:rgba(46,125,82,.1);border:1px solid rgba(46,125,82,.3);color:var(--green-t);}
.b-case{background:rgba(201,160,80,.08);border:1px solid rgba(201,160,80,.2);color:var(--gold-t);}
.b-live{background:rgba(107,26,26,.15);border:1px solid var(--burg-dim);color:#e88080;}
.pulse{animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.mbar{display:flex;gap:1px;background:rgba(201,160,80,.08);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:80px;padding:8px 10px;background:var(--bg2);}
.m .v{font-size:14px;font-weight:700;color:var(--gold-l);font-family:'EB Garamond',serif;}
.m .v.g{color:var(--green-t);}.m .v.r{color:var(--red);}.m .v.w{color:var(--text);}
.m .l{font-size:8px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;font-family:var(--mono);}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:rgba(201,160,80,.08);}
.panel{background:var(--bg2);padding:14px;overflow-y:auto;max-height:calc(100vh - 140px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-family:'EB Garamond',serif;font-size:12px;font-weight:700;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid var(--border);}
.sec{margin-bottom:14px;}
.st{font-size:8px;color:var(--gold-t);text-transform:uppercase;letter-spacing:2px;margin-bottom:7px;font-weight:600;font-family:var(--mono);}
.body{color:var(--text);line-height:1.8;font-size:11px;opacity:.9;}
.tabs{display:flex;gap:1px;background:rgba(201,160,80,.08);margin-bottom:10px;overflow-x:auto;border-radius:2px;overflow:hidden;}
.tab{padding:6px 11px;cursor:pointer;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg2);white-space:nowrap;font-weight:600;font-family:var(--mono);}
.tab.on{color:var(--gold-t);border-bottom:2px solid var(--gold);background:rgba(201,160,80,.06);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border2);}
.sl{color:var(--muted);font-size:10px;font-family:var(--mono);}.sv{font-weight:600;font-size:10px;font-family:var(--mono);}
.green{color:var(--green-t);}.gold{color:var(--gold);}.red{color:var(--red);}.muted{color:var(--muted);}.white{color:var(--text);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.bl{width:200px;font-size:9px;color:var(--muted);flex-shrink:0;font-family:var(--mono);}
.bt{flex:1;height:4px;background:rgba(201,160,80,.08);border-radius:2px;overflow:hidden;}
.bf{height:100%;border-radius:2px;}
.bv{width:70px;text-align:right;font-size:9px;font-family:var(--mono);}
.vc{background:rgba(18,13,10,.8);border:1px solid var(--border);border-radius:3px;padding:8px;margin-bottom:6px;}
.vc .ag{font-weight:600;font-size:10px;margin-bottom:3px;font-family:var(--mono);}
.vc .rt{color:var(--muted);font-size:9px;line-height:1.6;}
.va{border-left:3px solid var(--green);}
.vc-cond{border-left:3px solid var(--gold);}
.tally{display:flex;gap:12px;padding:8px 10px;background:rgba(107,26,26,.08);border:1px solid var(--border);border-radius:3px;margin:8px 0;}
.ti{text-align:center;}.ti .n{font-size:18px;font-weight:700;font-family:'EB Garamond',serif;}.ti .l{font-size:8px;color:var(--muted);letter-spacing:1px;font-family:var(--mono);}
.judge{background:linear-gradient(135deg,rgba(107,26,26,.08),rgba(201,160,80,.06));border:1px solid var(--border);border-radius:3px;padding:9px;margin-top:8px;font-size:11px;line-height:1.7;color:var(--gold-l);font-style:italic;font-family:'EB Garamond',serif;}
.bet{background:linear-gradient(135deg,rgba(107,26,26,.1),rgba(201,160,80,.06));border:1px solid var(--border);border-radius:3px;padding:11px 13px;margin-bottom:12px;}
.bet .bt2{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;font-family:var(--mono);}
.bet .bb{font-size:11px;font-weight:600;line-height:1.6;color:var(--gold-l);font-family:'EB Garamond',serif;}
.tbl{width:100%;border-collapse:collapse;font-size:10px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:8px;padding:4px 5px;border-bottom:1px solid var(--border);text-align:left;font-weight:600;font-family:var(--mono);}
.tbl td{padding:4px 5px;border-bottom:1px solid var(--border2);font-family:var(--mono);}
.tbl .win{color:var(--green-t);font-weight:600;}.tbl .lose{color:var(--red);}.tbl .hl{background:rgba(107,26,26,.05);}
.sav{background:linear-gradient(135deg,rgba(107,26,26,.1),rgba(201,160,80,.08));border:1px solid var(--border);border-radius:3px;padding:10px;margin:8px 0;text-align:center;}
.sav .amt{font-size:22px;font-weight:700;color:var(--gold-t);font-family:'EB Garamond',serif;}
.sav .lbl{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:1px;font-family:var(--mono);}
/* Case room */
.casegrid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:8px 0;}
.casenode{border-radius:3px;padding:8px;font-size:9px;}
.cn-lit{background:rgba(107,26,26,.15);border:1px solid var(--border3);}
.cn-corp{background:rgba(201,160,80,.1);border:1px solid var(--border);}
.cn-re{background:rgba(18,13,10,.8);border:1px solid rgba(201,160,80,.25);}
.cn-isl{background:rgba(46,125,82,.1);border:1px solid rgba(46,125,82,.25);}
.cn-reg{background:rgba(18,13,10,.8);border:1px solid var(--border);}
.cn-fam{background:rgba(201,160,80,.08);border:1px solid rgba(201,160,80,.2);}
.cn-icon{font-size:16px;margin-bottom:3px;}
.cn-name{font-weight:700;font-size:9px;font-family:var(--mono);}
.cn-lit .cn-name{color:#e88080;}
.cn-corp .cn-name{color:var(--gold-t);}
.cn-re .cn-name{color:var(--gold);}
.cn-isl .cn-name{color:var(--green-t);}
.cn-reg .cn-name{color:var(--text);}
.cn-fam .cn-name{color:var(--gold);}
.cn-stat{font-size:8px;color:var(--muted);line-height:1.5;font-family:var(--mono);}
/* Sensor feed */
.sensor{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(107,26,26,.06);border-left:2px solid var(--burg-dim);margin-bottom:3px;border-radius:0 3px 3px 0;}
.sn{font-size:9px;color:#e88080;font-family:var(--mono);}.sv2{font-size:9px;color:var(--gold);font-family:var(--mono);}.ss{font-size:8px;color:var(--muted);font-family:var(--mono);}
/* Scenario tabs */
.scen{display:flex;gap:1px;background:rgba(201,160,80,.08);margin-bottom:10px;overflow-x:auto;border-radius:2px;overflow:hidden;}
.sc{flex:1;min-width:60px;padding:5px 7px;cursor:pointer;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg2);text-align:center;white-space:nowrap;font-weight:600;font-family:var(--mono);}
.sc.on{color:var(--gold-t);border-bottom:2px solid var(--gold);background:rgba(201,160,80,.06);}
.threat{background:rgba(18,13,10,.8);border:1px solid var(--border);border-radius:3px;padding:8px;margin-bottom:5px;}
.threat .tn{font-size:10px;font-weight:600;margin-bottom:3px;font-family:var(--mono);}
.threat .td{font-size:9px;color:var(--muted);line-height:1.6;}
/* Sovereignty metrics */
.sov{background:rgba(18,13,10,.8);border:1px solid var(--border);border-radius:3px;padding:7px;margin-bottom:5px;}
.sov .sk{font-size:9px;color:var(--gold);font-family:var(--mono);font-weight:600;}
.sov .sv3{font-size:8px;color:var(--red);font-family:var(--mono);margin-top:2px;font-weight:700;}
/* Inf status */
.inf-status{background:linear-gradient(135deg,rgba(107,26,26,.08),rgba(201,160,80,.06));border:1px solid var(--border);border-radius:3px;padding:9px;margin:8px 0;text-align:center;}
.inf-status .is{font-size:11px;font-weight:600;color:#e88080;letter-spacing:1px;font-family:var(--mono);}
.inf-status .id{font-size:9px;color:var(--muted);margin-top:3px;font-family:var(--mono);}
/* Modal */
.modal{display:none;position:fixed;inset:0;background:rgba(14,10,8,.92);z-index:100;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
.modal.open{display:flex;}
.mbox{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:28px 32px;max-width:480px;text-align:center;box-shadow:0 20px 60px rgba(107,26,26,.3);}
.mbox h2{font-family:'EB Garamond',serif;color:var(--gold-l);font-size:16px;margin-bottom:9px;}
.mbox p{color:var(--muted);font-size:11px;line-height:1.7;margin-bottom:9px;}
.mbox .cbtn{background:linear-gradient(135deg,var(--burg),var(--gold-dim));border:none;color:var(--cream);padding:8px 22px;border-radius:2px;cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:600;}
.lbtn{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--burg),var(--gold-dim));border:none;color:var(--cream);padding:6px 16px;border-radius:2px;cursor:pointer;font-family:var(--mono);font-size:9px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;font-weight:600;}
.cw{position:relative;height:140px;margin-top:7px;}
.milestone{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}
.ms-dot{width:7px;height:7px;border-radius:50%;background:var(--burg-l);margin-top:3px;flex-shrink:0;}
.ms-dot.gold{background:var(--gold);}
.ms-t{font-size:9px;font-weight:600;color:var(--gold);font-family:var(--mono);}
.ms-d{font-size:8px;color:var(--muted);line-height:1.5;}
.bbar{background:linear-gradient(135deg,rgba(107,26,26,.08),rgba(201,160,80,.06));border-top:1px solid var(--border);padding:7px 18px;text-align:center;font-size:9px;color:var(--muted);letter-spacing:.5px;font-family:var(--mono);}
.alert{display:flex;gap:8px;align-items:center;padding:5px 8px;background:rgba(201,160,80,.06);border-left:2px solid var(--gold-dim);margin-bottom:3px;border-radius:0 3px 3px 0;}
.alert .at{font-size:9px;color:var(--gold);font-family:var(--mono);}
.alert .ad{font-size:8px;color:var(--muted);font-family:var(--mono);}
.chart-note{font-size:8px;color:var(--muted);margin-top:4px;text-align:center;font-family:var(--mono);}
/* Privilege shield */
.shield{background:linear-gradient(135deg,rgba(107,26,26,.15),rgba(201,160,80,.08));border:1px solid var(--border);border-radius:3px;padding:9px;margin:8px 0;text-align:center;}
.shield .st2{font-size:20px;margin-bottom:4px;}
.shield .sl2{font-size:10px;color:var(--gold-l);font-family:'EB Garamond',serif;font-weight:600;line-height:1.6;}
.shield .sd{font-size:9px;color:var(--muted);margin-top:3px;font-family:var(--mono);}
</style>
</head>
<body>
<!-- MODAL -->
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>&#9878; Sovereign Case Twin — Law Firm Deployment</h2>
    <p>The Case Twin deploys on your firm's existing server infrastructure. All case files, client communications, pleadings, precedents, and legal research are processed on-prem. Zero external API calls. Attorney-client privilege preserved by architecture, not by contract.</p>
    <p style="color:var(--gold);font-weight:600;font-size:11px;font-family:var(--mono)">Privilege Protected · Air-Gapped · Bar Association Compliant · Fiduciary Grade</p>
    <p style="color:#e88080;font-family:var(--mono)">Contact: meshpilot@agenthinkmesh.ai</p>
    <br><button class="cbtn" onclick="cl()">Close</button>
  </div>
</div>

<!-- HEADER -->
<div class="stripe"></div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">&#9878;</div>
    <div>
      <div class="htitle">Legal Case Twin — Sovereign Legal Intelligence</div>
      <div class="hsub">Attorney-Client Privilege · Air-Gapped Inference · GCC Legal Practice · Zero Cloud Exposure</div>
    </div>
  </div>
  <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-priv">&#9679; Privilege Protected</span>
    <span class="badge b-zc">&#9679; Zero Cloud Exposure</span>
    <span class="badge b-bar">&#9679; Bar Association Compliant</span>
    <span class="badge b-case">&#9679; Case-by-Case Deployment</span>
    <span class="badge b-live pulse">&#9679; SYSTEM ACTIVE</span>
    <span style="color:var(--muted);font-size:9px;font-family:var(--mono)" id="clk"></span>
  </div>
</div>

<!-- METRICS BAR -->
<div class="mbar">
  <div class="m"><div class="v">28</div><div class="l">Active Cases</div></div>
  <div class="m"><div class="v">47,000</div><div class="l">Pages Processed</div></div>
  <div class="m"><div class="v g">847</div><div class="l">Precedents Indexed</div></div>
  <div class="m"><div class="v g">96.3%</div><div class="l">Ruling Prediction Accuracy</div></div>
  <div class="m"><div class="v r">0.4%</div><div class="l">Privilege Breach Risk</div></div>
  <div class="m"><div class="v g">100%</div><div class="l">Files On-Prem</div></div>
  <div class="m"><div class="v">3×</div><div class="l">Case Capacity Multiplier</div></div>
  <div class="m"><div class="v g">0</div><div class="l">Cloud API Calls</div></div>
</div>

<div class="grid">

<!-- ═══════════════════════════════════════════════════════════════
     LEFT PANEL — LEGAL EXECUTIVE TWIN
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#9878; Legal Executive Twin — Sovereign Case Intelligence</div>
  <div class="bet">
    <div class="bt2">ATTORNEY-CLIENT PRIVILEGE — THE STRONGEST CONFIDENTIALITY RULE ON EARTH</div>
    <div class="bb">Legal privilege is absolute. A lawyer who uploads client files to a foreign cloud AI breaches privilege and faces disbarment. The Case Twin runs entirely on the law firm's local server. Zero external API calls. Zero files leave the server room. Privilege preserved by architecture, not by contract.</div>
  </div>
  <button class="lbtn" onclick="ol()">&#9889; Deploy Sovereign Case Twin</button>

  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Strategic Brief</div>
    <div class="tab" onclick="st('modern',this)">GCC Legal 2035</div>
    <div class="tab" onclick="st('ops',this)">Practice Areas</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>

  <!-- TAB 1: STRATEGIC BRIEF -->
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief — The Privilege Architecture Imperative</div>
    <div class="body">Attorney-client privilege is the strongest confidentiality rule in any legal system. It is not a preference — it is a fiduciary duty. When a lawyer uploads a client file to ChatGPT, Harvey, or CoCounsel, that file is processed on foreign servers, potentially stored, potentially accessed by foreign jurisdiction legal process, and potentially exposed to subprocessors. Every major bar association — ABA, Kuwait Bar Association, Saudi Bar Association — has issued guidance warning against cloud AI for privileged legal work.<br><br><strong style="color:var(--gold)">The Malpractice Architecture Problem:</strong> Foreign cloud legal AI is not just a data risk — it is malpractice by architecture. The moment a privileged file crosses a foreign API, privilege is potentially waived. No data processing agreement can restore privilege once waived. No indemnity clause can undo disbarment.<br><br><strong style="color:#e88080">The Case Twin Solution:</strong> Runs entirely on the law firm's local server. Ingests case files, pleadings, discovery, depositions, judge rulings, client communications, and precedents — all processed on-prem. Zero external API calls. Zero network egress. The privilege boundary is the server room door.<br><br><strong style="color:var(--green-t)">The Capacity Multiplier:</strong> A partner who spends 40 hours on M&A due diligence now spends 4 hours. The Case Twin handles first-draft motions, DD memos, compliance certificates, and estate distribution memos — in the partner's voice, trained on the firm's prior work. Same quality. 3× the case capacity.</div>
    <div style="margin-top:10px">
      <div class="sr"><div class="sl">Attorney-Client Privilege Status</div><div class="sv green">PRESERVED — air-gap architecture</div></div>
      <div class="sr"><div class="sl">Cloud API Calls</div><div class="sv green">ZERO — on-prem only</div></div>
      <div class="sr"><div class="sl">Files Leaving Server Room</div><div class="sv green">ZERO — privilege by architecture</div></div>
      <div class="sr"><div class="sl">Bar Association Compliance</div><div class="sv green">Automatic — no legal opinion required</div></div>
      <div class="sr"><div class="sl">Privilege Breach Risk</div><div class="sv green">0.4% (air-gap verified)</div></div>
      <div class="sr"><div class="sl">M&amp;A DD Memo: Hours Saved</div><div class="sv gold">40 hrs → 4 hrs per transaction</div></div>
      <div class="sr"><div class="sl">Motion Drafting Time Reduction</div><div class="sv gold">80% reduction (partner's voice)</div></div>
      <div class="sr"><div class="sl">Case Capacity Multiplier</div><div class="sv gold">3× more cases, same quality</div></div>
      <div class="sr"><div class="sl">Judge Ruling Prediction Accuracy</div><div class="sv gold">96.3% (based on 200 prior rulings)</div></div>
      <div class="sr"><div class="sl">Sharia Compliance Screening</div><div class="sv gold">99.5% accuracy (AAOIFI standards)</div></div>
    </div>
  </div>

  <!-- TAB 2: GCC LEGAL MODERNIZATION 2035 -->
  <div class="tc" id="tc-modern">
    <div class="st">GCC Legal Modernization — Jurisdiction by Jurisdiction</div>
    <div class="sec">
      <div class="sr"><div class="sl">Kuwait — New Companies Law</div><div class="sv gold">Law No. 1 of 2016 — ongoing reform</div></div>
      <div class="sr"><div class="sl">Kuwait — Real Estate Regulatory Authority</div><div class="sv gold">RERA digital transformation</div></div>
      <div class="sr"><div class="sl">Kuwait — CMA Digital Transformation</div><div class="sv gold">Automated regulatory reporting</div></div>
      <div class="sr"><div class="sl">Saudi — SAGIA/MISA Foreign Investment</div><div class="sv gold">Vision 2030 legal framework</div></div>
      <div class="sr"><div class="sl">Saudi — New Civil Transactions Law</div><div class="sv gold">Effective 2023 — major reform</div></div>
      <div class="sr"><div class="sl">UAE — DIFC/LCIA Arbitration</div><div class="sv gold">Regional arbitration hub</div></div>
      <div class="sr"><div class="sl">UAE — ADGM Digital Assets</div><div class="sv gold">Crypto/digital asset regulation</div></div>
      <div class="sr"><div class="sl">UAE — Corporate Tax Implementation</div><div class="sv gold">9% CT effective June 2023</div></div>
    </div>
    <div class="st">Legal AI Adoption — GCC (2026–2035)</div>
    <div class="cw"><canvas id="adoptC"></canvas></div>
    <div class="chart-note">Source: ABA AI Ethics guidance, Kuwait Bar Association circulars, Saudi Bar Association advisory notes, GCC legal market reports. Projections based on published regulatory timelines.</div>
  </div>

  <!-- TAB 3: PRACTICE AREA SCENARIOS -->
  <div class="tc" id="tc-ops">
    <div class="st">Practice Area Scenarios — Six Legal Contexts</div>
    <div class="scen">
      <div class="sc on" onclick="ss('lit',this)">Litigation</div>
      <div class="sc" onclick="ss('ma',this)">M&amp;A DD</div>
      <div class="sc" onclick="ss('re',this)">Real Estate</div>
      <div class="sc" onclick="ss('isl',this)">Islamic Finance</div>
      <div class="sc" onclick="ss('reg',this)">Regulatory</div>
      <div class="sc" onclick="ss('fam',this)">Inheritance</div>
    </div>

    <div id="sc-lit" class="threat" style="border-left:3px solid var(--burg-l);display:block">
      <div class="tn" style="color:#e88080">&#9878; Litigation Case Twin — Judge Ruling Prediction</div>
      <div class="td">Ingests pleadings, discovery documents, deposition transcripts, and the judge's prior 200 rulings. Predicts ruling probability on pending motions. Drafts motions in the partner's voice, trained on the firm's prior successful pleadings. Flags witness inconsistencies across deposition transcripts. Identifies precedent conflicts in cited cases. Target: 80% reduction in first-draft motion preparation time. 96.3% judge ruling prediction accuracy. All case files, client communications, and discovery materials processed exclusively on the firm's local server — privilege preserved by architecture. Zero cloud API calls. Zero network egress.</div>
    </div>
    <div id="sc-ma" class="threat" style="border-left:3px solid var(--gold);display:none">
      <div class="tn gold">&#128196; M&amp;A Due Diligence Twin — 40 Hours to 4 Hours</div>
      <div class="td">Ingests target company contracts, cap table, employment agreements, IP portfolio, regulatory filings, and corporate governance documents. Identifies red-flag clauses benchmarked against the firm's 500 prior M&A transactions. Drafts the DD memo in the partner's voice. Flags material adverse change triggers, change-of-control provisions, and non-compete enforceability issues. Target: 40 hours → 4 hours per transaction. All target company confidential information, trade secrets, and proprietary financial data processed on the firm's local server. Foreign cloud AI for M&A DD is a privilege breach and a competitive intelligence risk.</div>
    </div>
    <div id="sc-re" class="threat" style="border-left:3px solid var(--gold);display:none">
      <div class="tn gold">&#127963; Real Estate Closing Twin — Title Defect Detection</div>
      <div class="td">Ingests title deeds, municipal approvals, contractor agreements, LDI policies, and survey reports. Flags title defects benchmarked against the firm's 1,000 prior real estate closings. Identifies encumbrances, easements, and zoning violations. Drafts bilingual (Arabic + English) sale contracts and transfer documentation. Understands Kuwait Real Estate Regulatory Authority (RERA) requirements and Saudi Ministry of Justice property registration procedures. Target: 60% reduction in closing preparation time. All property records, client financial information, and title documents processed on-prem.</div>
    </div>
    <div id="sc-isl" class="threat" style="border-left:3px solid var(--green-t);display:none">
      <div class="tn green">&#9733; Islamic Finance / Sharia Twin — AAOIFI Standards</div>
      <div class="td">Ingests sukuk prospectuses, Sharia board opinions, AAOIFI standards, and Islamic finance transaction documentation. Screens transactions for riba (interest), gharar (uncertainty), maysir (speculation), and prohibited sectors. Drafts Sharia compliance certificates and fatwa summaries. Understands Kuwait Finance House standards, Al Rajhi Bank Sharia board precedents, and AAOIFI Financial Accounting Standards. Target: 99.5% Sharia screening accuracy. All Sharia board opinions, client transaction structures, and proprietary Islamic finance documentation processed on the firm's local server — religious compliance records never leave the jurisdiction.</div>
    </div>
    <div id="sc-reg" class="threat" style="border-left:3px solid var(--gold);display:none">
      <div class="tn gold">&#128196; Regulatory Compliance Twin — CBK + CMA + MOCI</div>
      <div class="td">Ingests CBK circulars, CMA regulations, MOCI updates, Zakat guidance, and AML/CFT framework changes. Monitors regulatory changes daily across Kuwait, Saudi Arabia, and UAE. Drafts compliance memos in Arabic and English. Flags regulatory changes affecting active client matters. Understands CBK Circular numbering system, CMA Disclosure Standards, and MOCI commercial registration requirements. Target: 89% reduction in regulatory memo preparation time. All client regulatory exposure data, compliance assessments, and advisory opinions processed on-prem.</div>
    </div>
    <div id="sc-fam" class="threat" style="border-left:3px solid var(--gold);display:none">
      <div class="tn gold">&#128101; Family Office / Inheritance Twin — Sharia + Civil Law</div>
      <div class="td">Ingests family trees, wills, waqf (endowment) documents, asset registers, and trust structures. Applies Kuwaiti inheritance law (Law No. 70 of 2015), Saudi Personal Status Law, and UAE Federal Law No. 28 of 2005 on Personal Status. Calculates Sharia inheritance shares (faraid) and identifies conflicts with civil law provisions. Drafts estate distribution memos and waqf management plans. Target: 100% compliance with local inheritance statutes. All family wealth structures, asset registers, and estate planning documents processed on the firm's local server — family office confidentiality is absolute.</div>
    </div>
  </div>

  <!-- TAB 4: RECOMMENDATION -->
  <div class="tc" id="tc-rec">
    <div class="st">Recommendation — Sovereign Case Twin Deployment</div>
    <div class="body" style="margin-bottom:10px">Deploy the Case Twin at pilot law firm — starting with one litigation case and one M&A transaction. Phase 1: 1 partner pilot. Phase 2: 10 partners. Phase 3: Full firm (50+ lawyers). All deployments on firm's existing server infrastructure. No cloud dependency. No data processing agreements. No bar association approval process.</div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; Managing Partner — APPROVE</div><div class="rt">The privilege argument is dispositive. We cannot use cloud AI for client work — the bar association guidance is clear. The Case Twin is the only architecture that preserves privilege by design. The 3× case capacity multiplier and 80% motion drafting reduction justify the deployment cost in the first quarter. Pilot on one litigation matter and one M&A transaction to validate.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; Head of Litigation — APPROVE</div><div class="rt">96.3% judge ruling prediction accuracy based on 200 prior rulings is operationally significant. The ability to draft motions in the partner's voice, trained on our prior successful pleadings, is a genuine capability multiplier. Witness inconsistency flagging across deposition transcripts alone justifies deployment. All case files remain on our server — privilege is preserved.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; Head of Corporate — APPROVE</div><div class="rt">M&A due diligence at 4 hours instead of 40 hours is a fundamental change in deal economics. Target company confidential information, trade secrets, and cap table data processed on our server — not on a cloud provider's infrastructure in San Francisco. The competitive intelligence protection alone justifies deployment. Red-flag clause detection benchmarked against 500 prior deals is immediately valuable.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green-t)">&#9989; Head of Real Estate — APPROVE</div><div class="rt">Title defect detection benchmarked against 1,000 prior closings, bilingual Arabic/English contract drafting, and RERA compliance checking are all capabilities we currently do manually. 60% reduction in closing preparation time is conservative. All property records and client financial information remain on-prem.</div></div>
    <div class="vc vc-cond"><div class="ag" style="color:var(--gold)">&#9888; IT Director — CONDITIONAL APPROVE</div><div class="rt">Conditional on: (1) Server security audit completed before deployment; (2) Access controls reviewed — only authorised fee earners can access Case Twin; (3) Audit log architecture reviewed by firm's data protection officer; (4) Backup and disaster recovery procedures updated. Subject to these conditions, on-prem deployment is strongly preferable to cloud AI from a security standpoint.</div></div>
    <div class="tally">
      <div class="ti"><div class="n green">4</div><div class="l">APPROVE</div></div>
      <div class="ti"><div class="n gold">1</div><div class="l">CONDITIONAL</div></div>
      <div class="ti"><div class="n muted">0</div><div class="l">REJECT</div></div>
    </div>
    <div class="judge">"Attorney-client privilege is not a feature — it is a fiduciary duty. Any AI that touches foreign cloud is malpractice by architecture. The Case Twin is the only compliant option."</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     CENTRE PANEL — CASE FILE INTELLIGENCE HUB
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#9878; Case File Intelligence Hub — On-Prem Library</div>

  <div class="shield">
    <div class="st2">&#9878;</div>
    <div class="sl2">Attorney-Client Privilege Preserved by Architecture<br>All case files, pleadings, and client communications remain on the firm's local server.<br>Zero external API calls. Zero network egress. Privilege boundary = server room door.</div>
    <div class="sd">Air-gap verified · 0.4% privilege breach risk · Bar association compliant · Fiduciary grade</div>
  </div>

  <div class="sec">
    <div class="st">Case Room — Active Practice Areas</div>
    <div class="casegrid">
      <div class="casenode cn-lit">
        <div class="cn-icon">&#9878;</div>
        <div class="cn-name">Litigation</div>
        <div class="cn-stat">12 active cases<br>Judge profiles: 23 loaded<br>Ruling prediction: 96.3%<br>Motions drafted: 47</div>
      </div>
      <div class="casenode cn-corp">
        <div class="cn-icon">&#128196;</div>
        <div class="cn-name">Corporate / M&amp;A</div>
        <div class="cn-stat">8 active transactions<br>DD memos: 12 completed<br>Red-flag clauses: 847 flagged<br>500 prior deals indexed</div>
      </div>
      <div class="casenode cn-re">
        <div class="cn-icon">&#127963;</div>
        <div class="cn-name">Real Estate</div>
        <div class="cn-stat">5 active closings<br>Title defects flagged: 23<br>1,000 prior closings indexed<br>Bilingual contracts: 8</div>
      </div>
      <div class="casenode cn-isl">
        <div class="cn-icon">&#9733;</div>
        <div class="cn-name">Islamic Finance</div>
        <div class="cn-stat">3 active transactions<br>Sharia screening: 99.5%<br>AAOIFI standards loaded<br>Compliance certs: 6</div>
      </div>
      <div class="casenode cn-reg">
        <div class="cn-icon">&#128196;</div>
        <div class="cn-name">Regulatory</div>
        <div class="cn-stat">CBK + CMA + MOCI<br>Daily monitoring active<br>Compliance memos: 34<br>Arabic + English</div>
      </div>
      <div class="casenode cn-fam">
        <div class="cn-icon">&#128101;</div>
        <div class="cn-name">Family / Inheritance</div>
        <div class="cn-stat">4 active estates<br>Faraid calculations: 12<br>Waqf documents: 8<br>KW + SA + UAE law</div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="st">Document Ingestion Status — On-Prem Library</div>
    <div class="sr"><div class="sl">Total Pages Processed</div><div class="sv gold">47,000 pages (all on-prem)</div></div>
    <div class="sr"><div class="sl">Precedents Indexed</div><div class="sv gold">847 (Kuwait + Saudi + UAE)</div></div>
    <div class="sr"><div class="sl">Judge Profiles Loaded</div><div class="sv gold">23 (prior rulings + patterns)</div></div>
    <div class="sr"><div class="sl">Client Communications Archived</div><div class="sv gold">12,400 (privilege protected)</div></div>
    <div class="sr"><div class="sl">Pleadings &amp; Motions Indexed</div><div class="sv gold">2,847 (firm's prior work)</div></div>
    <div class="sr"><div class="sl">Cloud API Calls</div><div class="sv green">ZERO — air-gap verified</div></div>
  </div>

  <div class="sec">
    <div class="st">Live Case Intelligence Feed</div>
    <div class="alert"><span class="at">&#9888; CASE #2026-0442</span><span class="ad">Judge ruling prediction updated: 73% → 81% in favour. New precedent from Court of Appeal indexed. Motion draft ready for partner review.</span></div>
    <div class="alert"><span class="at">&#9888; CBK CIRCULAR 3/2026</span><span class="ad">New CBK circular affecting 3 active client matters. Compliance memo drafted in Arabic + English. Partner notification sent.</span></div>
    <div class="alert"><span class="at">&#9888; DEPOSITION #DD-2026-0118</span><span class="ad">Witness inconsistency flagged: Statement on p.47 contradicts deposition testimony on p.12. Litigation team alerted.</span></div>
  </div>

  <div class="sec">
    <div class="st">Training Metrics — Case Twin Intelligence</div>
    <div class="br"><div class="bl">Judge Ruling Prediction</div><div class="bt"><div class="bf" style="width:96%;background:var(--burg-l)"></div></div><div class="bv" style="color:#e88080">96.3%</div></div>
    <div class="br"><div class="bl">Sharia Compliance Screening</div><div class="bt"><div class="bf" style="width:99%;background:var(--gold)"></div></div><div class="bv gold">99.5%</div></div>
    <div class="br"><div class="bl">Motion Drafting Time Reduction</div><div class="bt"><div class="bf" style="width:80%;background:var(--burg-l)"></div></div><div class="bv" style="color:#e88080">80%</div></div>
    <div class="br"><div class="bl">DD Memo: Hours Saved</div><div class="bt"><div class="bf" style="width:90%;background:var(--gold)"></div></div><div class="bv gold">40→4 hrs</div></div>
    <div class="br"><div class="bl">Privilege Breach Risk</div><div class="bt"><div class="bf" style="width:4%;background:var(--green)"></div></div><div class="bv green">0.4%</div></div>
    <div class="br"><div class="bl">Regulatory Memo Prep Reduction</div><div class="bt"><div class="bf" style="width:89%;background:var(--burg-l)"></div></div><div class="bv" style="color:#e88080">89%</div></div>
    <div class="br"><div class="bl">Litigation Episodes (Simulated)</div><div class="bt"><div class="bf" style="width:100%;background:var(--gold)"></div></div><div class="bv gold">10,000</div></div>
  </div>

  <div class="sec">
    <div class="st">Live Inference Feed — All On-Prem</div>
    <div class="sensor"><span class="sn">Litigation Case #2026-0442</span><span class="sv2" id="s1">Ruling prediction: 81% · Motion draft: Ready · Privilege: PRESERVED</span><span class="ss">AIR-GAP</span></div>
    <div class="sensor"><span class="sn">M&amp;A DD — Target Co. #KW-2241</span><span class="sv2" id="s2">Red-flag clauses: 12 · DD memo: 94% complete · Cloud calls: ZERO</span><span class="ss">ON-PREM</span></div>
    <div class="sensor"><span class="sn">Real Estate Closing — Sharq Plot</span><span class="sv2" id="s3">Title defects: 2 flagged · RERA compliance: PASS · Bilingual contract: Ready</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Sukuk Screening — Tranche B</span><span class="sv2" id="s4">Sharia: PASS · Riba check: CLEAN · AAOIFI: Compliant · Cert: Ready</span><span class="ss">PRIVILEGED</span></div>
    <div class="sensor"><span class="sn">CBK Regulatory Monitor</span><span class="sv2" id="s5">3 new circulars indexed · 5 client matters affected · Memos: Drafted</span><span class="ss">LOCAL</span></div>
    <div class="sensor"><span class="sn">Estate #FAM-2026-0034</span><span class="sv2" id="s6">Faraid calculated · Waqf reviewed · KW Law 70/2015: Compliant</span><span class="ss">FIDUCIARY</span></div>
  </div>

  <div class="inf-status">
    <div class="is pulse">&#9878; Case Twin Active — On-Prem Only — 0 Cloud API Calls — Privilege Preserved</div>
    <div class="id">28 active cases · 47,000 pages · 847 precedents · 23 judge profiles · 100% on-prem · Zero network egress · Fiduciary grade</div>
  </div>

  <div class="sec">
    <div class="st">Practice Area Distribution — Active Case Load</div>
    <div class="cw" style="height:130px"><canvas id="caseC"></canvas></div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     RIGHT PANEL — ROI + PRIVILEGE COMPLIANCE CALCULATOR
═══════════════════════════════════════════════════════════════ -->
<div class="panel">
  <div class="pt">&#128200; ROI + Privilege Compliance Calculator</div>
  <div class="bet">
    <div class="bt2">THE PRIVILEGE EQUATION — NOT SAVINGS, RISK ELIMINATION</div>
    <div class="bb">The question is not whether AI can draft a motion. The question is whether you can afford to have your client's trade secrets stored on a server in San Francisco. The Case Twin eliminates that question. The ROI is not savings — it is malpractice risk elimination plus case capacity multiplication.</div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Privilege &amp; Capability Comparison — Case Twin vs Foreign Cloud Legal AI</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th>Case Twin (On-Prem)</th><th>Cloud AI (Harvey/CoCounsel)</th></tr></thead>
      <tbody>
        <tr><td>Attorney-Client Privilege</td><td class="win">PRESERVED — air-gap &#10003;</td><td class="lose">BREACHED — foreign servers</td></tr>
        <tr><td>Bar Association Compliance</td><td class="win">Automatic &#10003;</td><td class="lose">Requires legal opinion</td></tr>
        <tr><td>Privilege Breach Risk</td><td class="win">0.4% (air-gap verified)</td><td class="lose">Unknown (subprocessors)</td></tr>
        <tr><td>Malpractice Exposure</td><td class="win">ZERO &#10003;</td><td class="lose">HIGH — disbarment risk</td></tr>
        <tr><td>Judge Ruling Prediction</td><td class="win">96.3% (local judge data)</td><td class="lose">Generic (no local data)</td></tr>
        <tr><td>Sharia Compliance Accuracy</td><td class="win">99.5% (AAOIFI trained)</td><td class="lose">~90% (generic model)</td></tr>
        <tr><td>M&amp;A DD: Hours per Transaction</td><td class="win">4 hours &#10003;</td><td class="lose">40 hours (manual)</td></tr>
        <tr><td>Malpractice Insurance Impact</td><td class="win">8–15% premium reduction</td><td class="lose">Potential increase</td></tr>
        <tr><td>Case Capacity Multiplier</td><td class="win">3× more cases &#10003;</td><td class="lose">1× (same capacity)</td></tr>
        <tr class="hl"><td><strong>Privilege Architecture</strong></td><td class="win"><strong>Server room = privilege boundary</strong></td><td class="lose"><strong>Foreign jurisdiction exposure</strong></td></tr>
      </tbody>
    </table>
  </div>

  <div class="sav">
    <div class="amt">3× Case Capacity</div>
    <div class="lbl">Per Partner · Same Quality · Privilege Preserved · Zero Malpractice Exposure · 80% Motion Drafting Reduction</div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Billable Efficiency — Case Twin Impact per Partner</div>
    <div class="sr"><div class="sl">M&amp;A DD Memo: Before Case Twin</div><div class="sv" style="color:#e88080">40 hours per transaction</div></div>
    <div class="sr"><div class="sl">M&amp;A DD Memo: With Case Twin</div><div class="sv green">4 hours per transaction</div></div>
    <div class="sr"><div class="sl">Time Saved per M&amp;A Transaction</div><div class="sv gold">36 hours (90% reduction)</div></div>
    <div class="sr"><div class="sl">Motion Drafting Time Reduction</div><div class="sv gold">80% (partner's voice)</div></div>
    <div class="sr"><div class="sl">Regulatory Memo Prep Reduction</div><div class="sv gold">89% (Arabic + English)</div></div>
    <div class="sr"><div class="sl">Case Capacity Multiplier</div><div class="sv gold">3× more cases per partner</div></div>
    <div class="sr"><div class="sl">Malpractice Insurance Premium</div><div class="sv gold">8–15% reduction (air-gap AI)</div></div>
    <div class="sr"><div class="sl">Competitive Differentiator</div><div class="sv gold">"Your files never leave our building"</div></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">10-Year Cost Trajectory — Infrastructure</div>
    <div class="cw" style="height:130px"><canvas id="costC"></canvas></div>
    <div class="chart-note">Note: Cloud legal AI cost is near-zero in direct fees but carries immeasurable malpractice risk. The Case Twin cost is the infrastructure investment that eliminates that risk.</div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Privilege Data Classification — Case Twin Architecture</div>
    <div class="sov"><div class="sk">Client Case Files</div><div class="sv3">ATTORNEY-CLIENT PRIVILEGE — NEVER EXPORT. Foreign cloud = privilege waiver + disbarment risk.</div></div>
    <div class="sov"><div class="sk">M&amp;A Target Company Data</div><div class="sv3">CONFIDENTIAL — TRADE SECRETS. Foreign cloud = competitive intelligence exposure.</div></div>
    <div class="sov"><div class="sk">Judge Ruling Profiles</div><div class="sv3">WORK PRODUCT — PROPRIETARY. Firm's competitive advantage. Never expose to cloud.</div></div>
    <div class="sov"><div class="sk">Client Communications</div><div class="sv3">PRIVILEGED — ABSOLUTE PROTECTION. Foreign API = privilege waiver by architecture.</div></div>
    <div class="sov"><div class="sk">Sharia Board Opinions</div><div class="sv3">RELIGIOUS COMPLIANCE — IMMUTABLE. Local records required by Sharia supervisory committee.</div></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Scale Economics — 1 Partner Pilot to Full Firm</div>
    <div class="sr"><div class="sl">Phase 1: 1 Partner Pilot (Month 1)</div><div class="sv gold">1 litigation + 1 M&A transaction</div></div>
    <div class="sr"><div class="sl">Phase 2: 10 Partners (Month 3)</div><div class="sv green">All practice areas · Full firm integration</div></div>
    <div class="sr"><div class="sl">Phase 3: Full Firm 50+ Lawyers (Month 6)</div><div class="sv green">3× case capacity across all fee earners</div></div>
    <div class="sr"><div class="sl">Infrastructure Cost (Full Firm)</div><div class="sv gold">$120K/yr (on-prem server)</div></div>
    <div class="sr"><div class="sl">Malpractice Risk Eliminated</div><div class="sv green">IMMEASURABLE — privilege by architecture</div></div>
    <div class="sr"><div class="sl">Bar Association Approval Required</div><div class="sv green">NONE — air-gap is automatic compliance</div></div>
  </div>

  <div class="sec" style="margin-top:10px">
    <div class="st">Deployment Milestones</div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Week 1 — Server Audit + Security Review</div><div class="ms-d">IT Director security audit. Access controls configured. Audit log architecture reviewed by data protection officer. Backup procedures updated.</div></div></div>
    <div class="milestone"><div class="ms-dot"></div><div><div class="ms-t">Week 2 — Pilot: 1 Litigation + 1 M&amp;A</div><div class="ms-d">Case Twin deployed on firm server. Pleadings, DD documents, and judge profiles ingested. First motion draft and DD memo generated in partner's voice.</div></div></div>
    <div class="milestone"><div class="ms-dot gold"></div><div><div class="ms-t">Month 1 — Privilege Verification</div><div class="ms-d">Air-gap verified. Zero cloud API calls confirmed. Bar association compliance confirmed. Privilege breach risk: 0.4%. Managing Partner sign-off.</div></div></div>
    <div class="milestone"><div class="ms-dot gold"></div><div><div class="ms-t">Month 3 — 10 Partner Rollout</div><div class="ms-d">All practice areas live. Islamic finance Sharia screening active. Regulatory monitoring live. 3× case capacity per partner confirmed.</div></div></div>
    <div class="milestone"><div class="ms-dot gold"></div><div><div class="ms-t">Month 6 — Full Firm 50+ Lawyers</div><div class="ms-d">Full firm deployment. Malpractice insurance premium reduction negotiated. "Your files never leave our building" as competitive differentiator in client pitches.</div></div></div>
  </div>

  <div style="margin-top:8px;text-align:center;font-size:9px;color:var(--muted);font-family:var(--mono)">Legal Case Twin · Sovereign Legal Intelligence · GCC Law Firm Deployment<br><strong style="color:var(--gold)">Attorney-Client Privilege Preserved by Architecture · agenthinkmesh.ai/legal-demo</strong></div>
</div>

</div>

<div class="bbar">All case files, client communications, and legal research remain on the law firm's local server. Attorney-client privilege is preserved by architecture, not by contract. &nbsp;·&nbsp; <strong style="color:var(--gold)">Sovereign Legal Intelligence · agenthinkmesh.ai</strong></div>

<script>
setInterval(()=>{const el=document.getElementById('clk');if(el)el.textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);

const sensors=[
  ['s1','Ruling prediction: 81% · Motion draft: Ready · Privilege: PRESERVED','Ruling prediction: 83% · New precedent indexed · Motion: Updated'],
  ['s2','Red-flag clauses: 12 · DD memo: 94% complete · Cloud calls: ZERO','Change-of-control clause flagged · NCA enforceability: Review · DD: 97%'],
  ['s3','Title defects: 2 flagged · RERA compliance: PASS · Bilingual contract: Ready','Easement identified · Municipality approval: Pending · Contract: Updated'],
  ['s4','Sharia: PASS · Riba check: CLEAN · AAOIFI: Compliant · Cert: Ready','Sukuk tranche C screened · Gharar: NONE · Compliance cert: Generated'],
  ['s5','3 new circulars indexed · 5 client matters affected · Memos: Drafted','CBK Circular 4/2026 indexed · 2 client matters affected · Memo: Arabic ready'],
  ['s6','Faraid calculated · Waqf reviewed · KW Law 70/2015: Compliant','Estate distribution memo: Complete · Waqf endowment: Registered'],
];
setInterval(()=>{sensors.forEach(([id,a,b])=>{const el=document.getElementById(id);if(el)el.textContent=Math.random()>0.15?a:b;});},5000);

function ol(){document.getElementById('lm').classList.add('open');}
function cl(){document.getElementById('lm').classList.remove('open');}

function st(n,el){
  document.querySelectorAll('.tc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('tc-'+n).classList.add('on');
  el.classList.add('on');
}

function ss(n,el){
  ['lit','ma','re','isl','reg','fam'].forEach(s=>{
    const el2=document.getElementById('sc-'+s);
    if(el2)el2.style.display='none';
  });
  document.querySelectorAll('.sc').forEach(e=>e.classList.remove('on'));
  const target=document.getElementById('sc-'+n);
  if(target)target.style.display='block';
  el.classList.add('on');
}

// Legal AI adoption chart
new Chart(document.getElementById('adoptC'),{
  type:'line',
  data:{
    labels:['2026','2027','2028','2029','2030','2031','2032','2033','2034','2035'],
    datasets:[
      {label:'Sovereign AI Adoption (%)',data:[3,8,16,28,42,55,66,75,82,88],borderColor:'#c9a050',backgroundColor:'rgba(201,160,80,.06)',borderWidth:2,pointRadius:2,fill:true,tension:.3},
      {label:'Cloud Malpractice Risk Score',data:[90,87,82,75,65,53,42,33,26,20],borderColor:'#c0392b',backgroundColor:'rgba(192,57,43,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.3,borderDash:[4,4]}
    ]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#7a6a5a',font:{size:8},boxWidth:8}}},
    scales:{
      x:{ticks:{color:'#7a6a5a',font:{size:8}},grid:{color:'rgba(201,160,80,.06)'}},
      y:{ticks:{color:'#7a6a5a',font:{size:8},callback:function(v){return v+'%'}},grid:{color:'rgba(201,160,80,.06)'},min:0,max:100}
    }
  }
});

// Case distribution chart
new Chart(document.getElementById('caseC'),{
  type:'doughnut',
  data:{
    labels:['Litigation','Corporate/M&A','Real Estate','Islamic Finance','Regulatory','Family/Inheritance'],
    datasets:[{
      data:[12,8,5,3,4,4],
      backgroundColor:['rgba(107,26,26,.7)','rgba(201,160,80,.7)','rgba(139,34,34,.6)','rgba(46,125,82,.6)','rgba(201,160,80,.4)','rgba(107,26,26,.4)'],
      borderColor:['#8b2222','#c9a050','#6b1a1a','#3daa6e','#c9a050','#6b1a1a'],
      borderWidth:1
    }]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#7a6a5a',font:{size:8},boxWidth:8},position:'right'}}
  }
});

// Cost chart
new Chart(document.getElementById('costC'),{
  type:'line',
  data:{
    labels:['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],
    datasets:[
      {label:'Case Twin On-Prem ($K)',data:[120,240,360,480,600,720,840,960,1080,1200],borderColor:'#c9a050',backgroundColor:'rgba(201,160,80,.06)',borderWidth:2,pointRadius:2,fill:true,tension:.2},
      {label:'Malpractice Risk (Relative)',data:[90,87,82,75,65,53,42,33,26,20],borderColor:'#c0392b',backgroundColor:'rgba(192,57,43,.04)',borderWidth:2,pointRadius:2,fill:false,tension:.2,borderDash:[4,4],yAxisID:'y1'}
    ]
  },
  options:{
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#7a6a5a',font:{size:8},boxWidth:8}}},
    scales:{
      x:{ticks:{color:'#7a6a5a',font:{size:8}},grid:{color:'rgba(201,160,80,.06)'}},
      y:{ticks:{color:'#7a6a5a',font:{size:8},callback:function(v){return '$'+v+'K'}},grid:{color:'rgba(201,160,80,.06)'},position:'left'},
      y1:{ticks:{color:'#c0392b',font:{size:8},callback:function(v){return v+'%'}},grid:{display:false},position:'right',min:0,max:100}
    }
  }
});
<\/script>
</body>
</html>`;function v(){return e.useEffect(()=>(document.title="Legal Case Twin — Sovereign Legal Intelligence",()=>{document.title="AgenThinkMesh"}),[]),i.jsx("div",{"data-loc":"client/src/pages/LegalDemo.tsx:587",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:i.jsx("iframe",{"data-loc":"client/src/pages/LegalDemo.tsx:588",srcDoc:a,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"Legal Case Twin — Sovereign Legal Intelligence",sandbox:"allow-scripts"})})}export{v as default};
