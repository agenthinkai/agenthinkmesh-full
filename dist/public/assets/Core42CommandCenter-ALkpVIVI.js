import{r as e,j as i}from"./react-vendor-ChkOGfOz.js";import"./vendor-B43sDH1-.js";import"./date-utils-B2ZejYPs.js";import"./export-libs-suHawyUQ.js";import"./charts-Bhwmpjvm.js";import"./trpc-Dsj9agTq.js";import"./radix-BzVH_mSP.js";import"./flow-DCgLNMlO.js";const s=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Core42 × MeshPilot — Sovereign AI Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{
  --bg:#040810;--surface:rgba(255,255,255,.04);--border:rgba(255,255,255,.08);
  --blue:#0066ff;--blue-l:#3385ff;--glow:#00aaff;--silver:#b0bec5;
  --teal:#00e5ff;--green:#00e676;--red:#ff1744;--amber:#ffd740;--purple:#7c4dff;
  --text:#e3eaf2;--muted:#607d8b;--gpu:#ff6d00;--cpu:#00e5ff;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code',monospace;font-size:13px;min-height:100vh;}
.stripe{height:3px;background:linear-gradient(90deg,#0066ff,#00aaff,#00e5ff);}
.hdr{background:linear-gradient(135deg,rgba(0,102,255,.15),rgba(0,170,255,.05));border-bottom:1px solid rgba(0,102,255,.4);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.hdr-l{display:flex;align-items:center;gap:14px;}
.logo{width:40px;height:40px;background:linear-gradient(135deg,#0066ff,#00aaff);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;letter-spacing:-1px;}
.htitle{font-size:16px;font-weight:700;color:var(--glow);letter-spacing:2px;text-transform:uppercase;}
.hsub{color:var(--muted);font-size:10px;margin-top:2px;}
.badge{padding:3px 10px;border-radius:12px;font-size:10px;}
.b-star{background:rgba(255,109,0,.1);border:1px solid var(--gpu);color:var(--gpu);}
.b-g42{background:rgba(0,102,255,.15);border:1px solid var(--blue-l);color:var(--glow);}
.b-live{background:rgba(0,230,118,.1);border:1px solid var(--green);color:var(--green);}
.mbar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.m{flex:1;min-width:90px;padding:10px 14px;background:var(--bg);text-align:center;}
.m .v{font-size:17px;font-weight:700;color:var(--glow);}
.m .v.g{color:var(--gpu);}.m .v.c{color:var(--cpu);}.m .v.gr{color:var(--green);}
.m .l{font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:18px;overflow-y:auto;max-height:calc(100vh - 148px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.pt{font-size:10px;font-weight:700;color:var(--glow);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(0,102,255,.3);}
.sec{margin-bottom:18px;}
.st{font-size:9px;color:var(--teal);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
.body{color:var(--text);line-height:1.75;font-size:12px;opacity:.9;}
.tabs{display:flex;gap:1px;background:var(--border);margin-bottom:14px;overflow-x:auto;}
.tab{padding:7px 14px;cursor:pointer;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;}
.tab.on{color:var(--glow);border-bottom:2px solid var(--glow);}
.tc{display:none;}.tc.on{display:block;}
.sr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);}
.sl{color:var(--muted);}.sv{font-weight:600;}
.blue{color:var(--glow);}.green{color:var(--green);}.red{color:var(--red);}.amber{color:var(--amber);}.gc{color:var(--gpu);}.cc{color:var(--cpu);}
.br{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.bl{width:140px;font-size:10px;color:var(--muted);flex-shrink:0;}
.bt{flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;}
.bf{height:100%;border-radius:3px;}
.bv{width:80px;text-align:right;font-size:10px;}
.vc{background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:10px;margin-bottom:7px;}
.vc .ag{font-weight:700;font-size:11px;margin-bottom:3px;}
.vc .rt{color:var(--muted);font-size:10px;line-height:1.55;}
.va{border-left:3px solid var(--green);}.vco{border-left:3px solid var(--amber);}
.tally{display:flex;gap:16px;padding:10px 14px;background:rgba(0,102,255,.05);border:1px solid rgba(0,102,255,.2);border-radius:5px;margin:10px 0;}
.ti{text-align:center;}.ti .n{font-size:22px;font-weight:700;}.ti .l{font-size:9px;color:var(--muted);}
.judge{background:rgba(0,102,255,.1);border:1px solid rgba(0,102,255,.4);border-radius:5px;padding:12px;margin-top:10px;font-size:11px;line-height:1.7;color:var(--glow);}
.km{background:linear-gradient(135deg,rgba(255,109,0,.12),rgba(0,229,255,.08));border:1px solid rgba(0,170,255,.4);border-radius:6px;padding:14px 16px;margin-bottom:16px;}
.km .kmt{font-size:10px;color:var(--silver);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.km .kmb{font-size:13px;font-weight:700;line-height:1.6;}
.rack-leg{display:flex;gap:10px;margin-bottom:6px;flex-wrap:wrap;}
.rack-leg span{font-size:9px;}
.rg{color:#ff6d00;}.rc{color:#00e5ff;}.rs{color:#7c4dff;}.rn{color:#b0bec5;}.re{color:#1a2332;}
.rack-sec{display:flex;gap:12px;flex-wrap:wrap;}
.rack-u{flex:1;min-width:140px;}
.rack-lbl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
.rack-grid{font-family:monospace;font-size:8px;line-height:1.05;letter-spacing:.5px;}
.tbl{width:100%;border-collapse:collapse;font-size:11px;}
.tbl th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:9px;padding:5px 7px;border-bottom:1px solid var(--border);text-align:left;}
.tbl td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.03);}
.tbl .win{color:var(--green);font-weight:700;}.tbl .lose{color:var(--red);}.tbl .hyb{color:var(--glow);font-weight:700;}.tbl .hl{background:rgba(0,102,255,.06);}
.lbtn{display:inline-flex;align-items:center;gap:8px;background:rgba(0,102,255,.15);border:1px solid var(--blue-l);color:var(--glow);padding:7px 18px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:100;align-items:center;justify-content:center;}
.modal.open{display:flex;}
.mbox{background:#040810;border:1px solid var(--blue-l);border-radius:8px;padding:32px 40px;max-width:480px;text-align:center;}
.mbox h2{color:var(--glow);font-size:16px;margin-bottom:12px;letter-spacing:1px;}
.mbox p{color:var(--muted);font-size:12px;line-height:1.7;margin-bottom:16px;}
.mbox .cbtn{background:rgba(0,102,255,.2);border:1px solid var(--blue-l);color:var(--glow);padding:8px 24px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:1px;}
.mbox .ct{color:var(--teal);font-size:11px;margin-top:12px;}
.cw{position:relative;height:180px;margin-top:8px;}
.g42g{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;}
.g42c{background:rgba(0,102,255,.06);border:1px solid rgba(0,102,255,.2);border-radius:4px;padding:8px 10px;}
.g42c .n{font-size:10px;font-weight:700;color:var(--glow);margin-bottom:2px;}
.g42c .d{font-size:9px;color:var(--muted);}
.sav{background:linear-gradient(135deg,rgba(0,230,118,.08),rgba(0,229,255,.06));border:1px solid rgba(0,230,118,.3);border-radius:5px;padding:12px;margin:10px 0;text-align:center;}
.sav .amt{font-size:28px;font-weight:700;color:var(--green);}
.sav .lbl{font-size:10px;color:var(--muted);margin-top:2px;}
</style>
</head>
<body>
<div class="stripe"></div>
<div class="modal" id="lm" onclick="if(event.target===this)cl()">
  <div class="mbox">
    <h2>⚡ MESHPILOT CPU INFERENCE</h2>
    <p>Real-time AI inference using <strong>Llama 3.2 1B GGUF</strong> on standard x86 CPU — no additional GPU cost, no cloud egress, no data leaving the sovereign perimeter.</p>
    <p>Core42's GPU cluster handles <strong style="color:var(--gpu)">model training and fine-tuning</strong>. MeshPilot CPU handles <strong style="color:var(--cpu)">inference, data generation, and synthetic data pipelines</strong> at 94% lower cost per inference call.</p>
    <p style="color:var(--glow);font-weight:700;font-size:12px">Full hybrid deployment available on Core42 infrastructure.</p>
    <div class="ct">Contact: <strong>core42@agenthinkmesh.ai</strong></div>
    <br><button class="cbtn" onclick="cl()">CLOSE</button>
  </div>
</div>
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">C42</div>
    <div>
      <div class="htitle">Core42 × MeshPilot — Sovereign AI Command Center</div>
      <div class="hsub">G42 Portfolio · Abu Dhabi · Hybrid GPU Brain + CPU Body Architecture</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <span class="badge b-star">⚡ Stargate UAE</span>
    <span class="badge b-g42">G42 Family</span>
    <span class="badge b-live">● LIVE</span>
    <span style="color:var(--muted);font-size:10px" id="clk"></span>
  </div>
</div>
<div class="mbar">
  <div class="m"><div class="v">$550M</div><div class="l">Core42 Financing</div></div>
  <div class="m"><div class="v g">70MW+</div><div class="l">GPU Cluster</div></div>
  <div class="m"><div class="v c">∞</div><div class="l">CPU Inference Nodes</div></div>
  <div class="m"><div class="v">20%</div><div class="l">UAE Non-Oil GDP Target</div></div>
  <div class="m"><div class="v">2031</div><div class="l">UAE AI Strategy</div></div>
  <div class="m"><div class="v c">94%</div><div class="l">CPU vs GPU Cost Saving</div></div>
  <div class="m"><div class="v">6</div><div class="l">G42 AI Companies</div></div>
  <div class="m"><div class="v gr">HYBRID</div><div class="l">Architecture Verdict</div></div>
</div>
<div class="grid">

<!-- LEFT: Executive Twin -->
<div class="panel">
  <div class="pt">🧠 Executive Digital Twin — Core42</div>
  <div class="km">
    <div class="kmt">The Architecture Thesis</div>
    <div class="kmb"><span class="gc">Core42 has the GPU brain.</span><br><span class="cc">MeshPilot provides the CPU body.</span></div>
  </div>
  <button class="lbtn" onclick="ol()">⚡ MeshPilot CPU Inference Demo</button>
  <div class="tabs">
    <div class="tab on" onclick="st('brief',this)">Brief</div>
    <div class="tab" onclick="st('uae',this)">UAE 2031</div>
    <div class="tab" onclick="st('g42',this)">G42 Portfolio</div>
    <div class="tab" onclick="st('rec',this)">Recommendation</div>
  </div>
  <div class="tc on" id="tc-brief">
    <div class="st">Strategic Brief</div>
    <div class="body">Core42 is the sovereign AI infrastructure arm of G42 — Abu Dhabi's most consequential technology holding group. With $550 million in financing secured in May 2025, a Stargate UAE partnership, and a Microsoft sovereign cloud agreement, Core42 is building the GPU-heavy training and hosting layer for the UAE's national AI ambition.<br><br>The gap in their architecture is the inference and data generation layer: GPU clusters are expensive to run at inference scale, and synthetic data pipelines require continuous CPU-bound workloads that do not justify GPU allocation. MeshPilot fills this gap precisely — CPU-only, air-gapped, sovereign, and 94% cheaper per inference call than running the same workload on GPU.<br><br>The partnership thesis is not competitive. It is complementary: <strong style="color:var(--gpu)">Core42 trains the models</strong>, <strong style="color:var(--cpu)">MeshPilot runs them at scale</strong>.</div>
  </div>
  <div class="tc" id="tc-uae">
    <div class="st">UAE National AI Strategy 2031</div>
    <div class="sr"><div class="sl">Non-Oil GDP from AI by 2031</div><div class="sv blue">20% target</div></div>
    <div class="sr"><div class="sl">AI Sector Investment (UAE)</div><div class="sv blue">$100B+ committed</div></div>
    <div class="sr"><div class="sl">Stargate UAE (G42 + OpenAI)</div><div class="sv amber">$500B global / UAE anchor</div></div>
    <div class="sr"><div class="sl">Core42 Financing Round</div><div class="sv green">$550M (May 2025)</div></div>
    <div class="sr"><div class="sl">Microsoft Sovereign Cloud</div><div class="sv blue">Abu Dhabi partnership (2025)</div></div>
    <div class="sr"><div class="sl">Core42 US Expansion</div><div class="sv">70MW+ TeraWulf + 20MW Minneapolis</div></div>
    <div class="sr"><div class="sl">MBZUAI (G42 Research)</div><div class="sv blue">World's 1st AI university</div></div>
    <div class="sr"><div class="sl">UAE AI Strategy Pillars</div><div class="sv">Talent · Data · Regulation · Infra</div></div>
    <div style="margin-top:12px"><div class="st">UAE AI GDP Contribution Trajectory</div><div class="cw" style="height:140px"><canvas id="gdpC"></canvas></div></div>
  </div>
  <div class="tc" id="tc-g42">
    <div class="st">G42 AI Portfolio — Core42's Ecosystem</div>
    <div class="g42g">
      <div class="g42c"><div class="n">Core42</div><div class="d">Sovereign AI infrastructure, GPU clusters, cloud</div></div>
      <div class="g42c"><div class="n">Inception</div><div class="d">LLM development, Jais Arabic model, foundation AI</div></div>
      <div class="g42c"><div class="n">AIQ</div><div class="d">AI-powered enterprise solutions, decision intelligence</div></div>
      <div class="g42c"><div class="n">Khazna</div><div class="d">Data centres, colocation, sovereign cloud hosting</div></div>
      <div class="g42c"><div class="n">CPX</div><div class="d">Cybersecurity, threat intelligence, zero-trust</div></div>
      <div class="g42c"><div class="n">Astratech</div><div class="d">Digital health, genomics, AI-driven diagnostics</div></div>
    </div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted);line-height:1.7">MeshPilot integrates with <strong style="color:var(--glow)">Inception</strong> (Jais model inference at scale), <strong style="color:var(--glow)">AIQ</strong> (enterprise decision pipelines), and <strong style="color:var(--glow)">Khazna</strong> (sovereign DC hosting). GPU brain + CPU body covers the full AI lifecycle: train → fine-tune → infer → generate → decide.</div>
  </div>
  <div class="tc" id="tc-rec">
    <div class="st">Board Recommendation</div>
    <div class="body">PROCEED with a structured partnership proposal to Core42 / G42. The recommended entry point is a pilot agreement with Inception (Jais model inference at scale using MeshPilot CPU nodes) — this demonstrates the cost arbitrage immediately and creates a reference case for the broader G42 portfolio.<br><br>Hard trigger: pilot must demonstrate sub-$0.002 per inference call vs Core42's current GPU inference cost of ~$0.038. That is a 19× cost reduction on the inference layer alone. Engage G42 Ventures and the Core42 BD team simultaneously.</div>
  </div>
  <div style="margin-top:18px">
    <div class="st">Council of 5 — Partnership Vote</div>
    <div style="color:var(--muted);font-size:9px;margin-bottom:10px">Q: Should MeshPilot pursue a formal hybrid architecture partnership with Core42 / G42?</div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Infrastructure Twin — APPROVE</div><div class="rt">Core42 GPU clusters are optimised for training throughput, not inference efficiency. MeshPilot CPU nodes at $0.002/call vs $0.038/call GPU inference = 19× cost reduction. At 1B inference calls/month, that is $36M/month in savings routed back to Core42's clients.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Sovereignty Twin — APPROVE</div><div class="rt">MeshPilot's air-gapped CPU architecture is fully compatible with UAE data residency law and Core42's sovereign cloud mandate. No additional compliance overhead. The CPU body runs inside Core42's perimeter.</div></div>
    <div class="vc vco"><div class="ag" style="color:var(--amber)">⚠️ Commercial Twin — CONDITIONAL</div><div class="rt">Approve only after Inception pilot validates latency SLA. Jais model inference on MeshPilot CPU must deliver &lt;3s response time for Arabic NLP workloads. Achievable with Q4 GGUF quantisation but must be demonstrated before G42 Ventures commits.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Market Intel — APPROVE</div><div class="rt">Core42 is expanding to the US (90MW+) and needs a cost-efficient inference layer for enterprise clients who cannot justify GPU pricing for production workloads. MeshPilot is the only sovereign CPU inference platform that integrates with GGUF models natively.</div></div>
    <div class="vc va"><div class="ag" style="color:var(--green)">✅ Strategic Fit — APPROVE</div><div class="rt">G42 portfolio covers training (Core42), models (Inception), enterprise (AIQ), hosting (Khazna), security (CPX). The only gap is cost-efficient sovereign inference at scale. MeshPilot fills the gap without competing with any existing G42 company.</div></div>
    <div class="tally">
      <div class="ti"><div class="n green">4</div><div class="l">APPROVE</div></div>
      <div class="ti"><div class="n amber">1</div><div class="l">CONDITIONAL</div></div>
      <div class="ti"><div class="n red">0</div><div class="l">REJECT</div></div>
    </div>
    <div class="judge"><strong>JUDGE:</strong> APPROVED. Initiate Inception pilot immediately. Demonstrate Jais model inference on MeshPilot CPU at &lt;$0.002/call and &lt;3s latency. Use this as the entry point to G42 Ventures partnership discussion. The GPU brain + CPU body architecture is the most capital-efficient sovereign AI stack available in the UAE today.</div>
  </div>
</div>

<!-- CENTRE: Abu Dhabi DC + Hybrid Rack -->
<div class="panel">
  <div class="pt">🏗️ Abu Dhabi AI Cluster — Hybrid Rack Visualization</div>
  <div class="sec">
    <div class="st">Hybrid Architecture — GPU Brain + CPU Body</div>
    <div class="rack-leg">
      <span class="rg">█ GPU (Training)</span>
      <span class="rc">▓ CPU (Inference)</span>
      <span class="rs">▪ Storage</span>
      <span class="rn">· Network</span>
      <span class="re">░ Reserved</span>
    </div>
    <div class="rack-sec">
      <div class="rack-u"><div class="rack-lbl">GPU Cluster — Core42 (Training)</div><div class="rack-grid" id="gpuR"></div></div>
      <div class="rack-u"><div class="rack-lbl">CPU Cluster — MeshPilot (Inference)</div><div class="rack-grid" id="cpuR"></div></div>
    </div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st">Abu Dhabi Cluster Performance</div>
    <div class="br"><div class="bl">GPU Utilisation (Training)</div><div class="bt"><div class="bf" style="width:87%;background:var(--gpu)"></div></div><div class="bv gc">87% — Core42</div></div>
    <div class="br"><div class="bl">CPU Utilisation (Inference)</div><div class="bt"><div class="bf" style="width:64%;background:var(--cpu)"></div></div><div class="bv cc">64% — MeshPilot</div></div>
    <div class="br"><div class="bl">Storage (Khazna)</div><div class="bt"><div class="bf" style="width:71%;background:var(--purple)"></div></div><div class="bv">71%</div></div>
    <div class="br"><div class="bl">Network Fabric</div><div class="bt"><div class="bf" style="width:43%;background:var(--silver)"></div></div><div class="bv">43%</div></div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st">Workload Routing — GPU vs CPU Decision Matrix</div>
    <table class="tbl">
      <thead><tr><th>Workload Type</th><th>Route To</th><th>Cost/Call</th></tr></thead>
      <tbody>
        <tr><td>Model Training</td><td class="gc">GPU (Core42)</td><td class="gc">$0.85/hr</td></tr>
        <tr><td>Fine-Tuning</td><td class="gc">GPU (Core42)</td><td class="gc">$0.62/hr</td></tr>
        <tr><td>Production Inference</td><td class="cc hl">CPU (MeshPilot)</td><td class="cc hl">$0.002/call</td></tr>
        <tr><td>Synthetic Data Gen</td><td class="cc hl">CPU (MeshPilot)</td><td class="cc hl">$0.001/call</td></tr>
        <tr><td>RAG / Search</td><td class="cc hl">CPU (MeshPilot)</td><td class="cc hl">$0.0008/call</td></tr>
        <tr><td>Embedding Generation</td><td class="cc hl">CPU (MeshPilot)</td><td class="cc hl">$0.0003/call</td></tr>
        <tr><td>Real-time Chat (prod)</td><td class="cc hl">CPU (MeshPilot)</td><td class="cc hl">$0.002/call</td></tr>
        <tr><td>Batch Analytics</td><td class="cc hl">CPU (MeshPilot)</td><td class="cc hl">$0.0005/call</td></tr>
      </tbody>
    </table>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st">Inference Volume — Jais Model Cost (GPU vs CPU)</div>
    <div class="cw" style="height:150px"><canvas id="infC"></canvas></div>
    <div style="font-size:9px;color:var(--muted);margin-top:4px">Projected inference calls/month as Core42 enterprise clients scale. CPU routing saves 94% vs GPU.</div>
  </div>
  <div class="sec" style="margin-top:14px">
    <div class="st">Data Sovereignty Architecture</div>
    <div class="sr"><div class="sl">Data Residency</div><div class="sv green">100% UAE (Abu Dhabi)</div></div>
    <div class="sr"><div class="sl">Egress to Foreign Cloud</div><div class="sv green">ZERO</div></div>
    <div class="sr"><div class="sl">GPU Export Compliance</div><div class="sv green">EAR99 — CPU exempt</div></div>
    <div class="sr"><div class="sl">UAE NESA Compliance</div><div class="sv green">Full</div></div>
    <div class="sr"><div class="sl">Encryption</div><div class="sv">AES-256 at rest + in transit</div></div>
  </div>
</div>

<!-- RIGHT: ROI Calculator -->
<div class="panel">
  <div class="pt">📊 ROI — Hybrid (GPU Brain + CPU Body) vs GPU-Only</div>
  <div class="km" style="margin-bottom:14px">
    <div class="kmt">The Cost Arbitrage</div>
    <div class="kmb" style="font-size:12px">GPU inference costs <span class="gc">$0.038/call</span>.<br>MeshPilot CPU inference costs <span class="cc">$0.002/call</span>.<br>At 1B calls/month: <span style="color:var(--green)">$36M/month saved.</span></div>
  </div>
  <div class="sec">
    <div class="st">10-Year Economics — 1B Inference Calls/Month</div>
    <table class="tbl">
      <thead><tr><th>Metric</th><th class="gc">GPU-Only</th><th class="cc">Hybrid ✅</th></tr></thead>
      <tbody>
        <tr><td>Inference Cost/Call</td><td class="lose">$0.038</td><td class="hyb">$0.002</td></tr>
        <tr><td>Monthly Inference Cost</td><td class="lose">$38M</td><td class="hyb">$2M</td></tr>
        <tr><td>Annual Inference Cost</td><td class="lose">$456M</td><td class="hyb">$24M</td></tr>
        <tr><td>10-yr Inference Cost</td><td class="lose">$4.56B</td><td class="hyb">$240M</td></tr>
        <tr><td>Training Cost (GPU)</td><td>$85M/yr</td><td>$85M/yr</td></tr>
        <tr><td>Total 10-yr TCO</td><td class="lose">$5.41B</td><td class="hyb">$1.09B</td></tr>
        <tr><td>10-yr Savings</td><td>—</td><td class="win">$4.32B</td></tr>
        <tr><td>GPU Utilisation</td><td class="lose">Mixed (inefficient)</td><td class="win">87% (training only)</td></tr>
        <tr><td>Inference Latency</td><td>1.2s avg</td><td class="win">2.1s avg</td></tr>
        <tr><td>Sovereignty</td><td class="win">Full</td><td class="win">Full</td></div></tr>
      </tbody>
    </table>
  </div>
  <div class="sav">
    <div class="amt">$4.32B</div>
    <div class="lbl">10-Year Savings — Hybrid vs GPU-Only Architecture</div>
  </div>
  <div class="sec" style="margin-top:18px">
    <div class="st">Annual Cost Comparison ($ Millions)</div>
    <div class="cw"><canvas id="costC"></canvas></div>
  </div>
  <div class="sec" style="margin-top:18px">
    <div class="st">Hybrid Architecture — Annual Cost Breakdown</div>
    <div class="br"><div class="bl">GPU Training (Core42)</div><div class="bt"><div class="bf" style="width:100%;background:var(--gpu)"></div></div><div class="bv gc">$85M/yr</div></div>
    <div class="br"><div class="bl">CPU Inference (MeshPilot)</div><div class="bt"><div class="bf" style="width:28%;background:var(--cpu)"></div></div><div class="bv cc">$24M/yr</div></div>
    <div class="br"><div class="bl">Storage (Khazna)</div><div class="bt"><div class="bf" style="width:12%;background:var(--purple)"></div></div><div class="bv">$10M/yr</div></div>
    <div class="br"><div class="bl">Network + Security (CPX)</div><div class="bt"><div class="bf" style="width:6%;background:var(--silver)"></div></div><div class="bv">$5M/yr</div></div>
  </div>
  <div class="sec" style="margin-top:18px">
    <div class="st">IC Verdict</div>
    <div style="background:rgba(0,102,255,.08);border:1px solid rgba(0,102,255,.35);border-radius:5px;padding:12px">
      <div style="color:var(--teal);font-weight:700;margin-bottom:6px;font-size:11px">THE BET</div>
      <div style="font-size:11px;line-height:1.7;margin-bottom:10px">Core42's GPU infrastructure is world-class for training. The 19× cost gap between GPU and CPU inference means every production workload that can run on CPU should run on CPU — and MeshPilot is the only sovereign CPU inference platform that integrates natively with Core42's GGUF model stack.</div>
      <div style="color:var(--green);font-weight:700;margin-bottom:8px;font-size:11px">✅ VERDICT: HYBRID ARCHITECTURE — APPROVED</div>
      <div style="font-size:10px;color:var(--muted);line-height:1.7">
        <div style="margin-bottom:4px"><span class="green">▶</span> $4.32B saved over 10 years at 1B calls/month</div>
        <div style="margin-bottom:4px"><span class="green">▶</span> GPU utilisation improves to 87% (training-only)</div>
        <div style="margin-bottom:4px"><span class="green">▶</span> Full UAE data sovereignty — no foreign cloud egress</div>
        <div style="margin-bottom:4px"><span class="green">▶</span> Inception Jais model at $0.002/call vs $0.038/call GPU</div>
        <div style="margin-bottom:4px"><span style="color:var(--amber)">▷</span> Latency trade-off: 2.1s CPU vs 1.2s GPU — acceptable for 90% of enterprise workloads</div>
        <div><span style="color:var(--red)">▷</span> Reassess if GPU inference drops below $0.005/call</div>
      </div>
    </div>
  </div>
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
function rack(id,gRatio){
  let s=id==='gpuR'?42:99;
  function r(){s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/0xffffffff;}
  let h='';
  for(let row=0;row<12;row++){
    for(let col=0;col<40;col++){
      const v=r();let cls,ch;
      if(v<gRatio){cls='rg';ch='█';}
      else if(v<gRatio+.05){cls='rs';ch='▪';}
      else if(v<gRatio+.08){cls='rn';ch='·';}
      else if(v<gRatio+.12){cls='re';ch='░';}
      else{cls=id==='gpuR'?'re':'rc';ch=id==='gpuR'?'░':'▓';}
      h+=\`<span class="\${cls}">\${ch}</span>\`;
    }
    h+='\\n';
  }
  document.getElementById(id).innerHTML=h;
}
rack('gpuR',.75);rack('cpuR',.02);
new Chart(document.getElementById('gdpC'),{type:'bar',data:{labels:['2020','2022','2024','2026E','2028E','2031T'],datasets:[{label:'AI % Non-Oil GDP',data:[2.1,4.8,8.3,12.1,16.4,20.0],backgroundColor:['rgba(0,102,255,.3)','rgba(0,102,255,.4)','rgba(0,102,255,.55)','rgba(0,102,255,.65)','rgba(0,102,255,.75)','rgba(0,170,255,.9)'],borderColor:'#0066ff',borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#607d8b',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#607d8b',font:{size:9},callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.04)'}}}}});
new Chart(document.getElementById('infC'),{type:'line',data:{labels:['M1','M3','M6','M9','M12','M18','M24'],datasets:[{label:'GPU Cost ($M/mo)',data:[3.8,8.7,19.0,28.5,38.0,57.0,76.0],borderColor:'#ff6d00',backgroundColor:'rgba(255,109,0,.1)',borderWidth:2,pointRadius:3,fill:true,tension:.3},{label:'CPU Cost ($M/mo)',data:[0.2,0.46,1.0,1.5,2.0,3.0,4.0],borderColor:'#00e5ff',backgroundColor:'rgba(0,229,255,.08)',borderWidth:2,pointRadius:3,fill:true,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#607d8b',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#607d8b',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#607d8b',font:{size:9},callback:v=>'$'+v+'M'},grid:{color:'rgba(255,255,255,.04)'}}}}});
new Chart(document.getElementById('costC'),{type:'bar',data:{labels:['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],datasets:[{label:'GPU-Only ($M/yr)',data:[541,541,541,541,541,541,541,541,541,541],backgroundColor:'rgba(255,109,0,.5)',borderColor:'#ff6d00',borderWidth:1,borderRadius:2},{label:'Hybrid ($M/yr)',data:[124,124,124,124,124,124,124,124,124,124],backgroundColor:'rgba(0,229,255,.4)',borderColor:'#00e5ff',borderWidth:1,borderRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#607d8b',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#607d8b',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#607d8b',font:{size:9},callback:v=>'$'+v+'M'},grid:{color:'rgba(255,255,255,.04)'}}}}});
<\/script>
</body>
</html>`;function v(){return e.useEffect(()=>(document.title="Core42 × MeshPilot — Sovereign AI Command Center",()=>{document.title="AgenThinkMesh"}),[]),i.jsx("div",{"data-loc":"client/src/pages/Core42CommandCenter.tsx:351",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:i.jsx("iframe",{"data-loc":"client/src/pages/Core42CommandCenter.tsx:352",srcDoc:s,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"Core42 × MeshPilot Sovereign AI Command Center",sandbox:"allow-scripts"})})}export{v as default};
