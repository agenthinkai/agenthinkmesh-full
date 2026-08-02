import{r as e,j as a}from"./index-CMFS-KMs.js";const t=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DAMAC Sovereign AI Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{--bg:#0a0e1a;--surface:rgba(255,255,255,0.04);--border:rgba(255,255,255,0.08);--gold:#d4a843;--teal:#00d4aa;--red:#ff4d6d;--blue:#4d9fff;--text:#e8eaf0;--muted:#8892a4;--green:#00c853;--amber:#ffab00;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code',monospace;font-size:13px;min-height:100vh;}
.header{background:linear-gradient(135deg,rgba(212,168,67,.15),rgba(0,212,170,.08));border-bottom:1px solid var(--gold);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.header-title{font-size:17px;font-weight:700;color:var(--gold);letter-spacing:2px;text-transform:uppercase;}
.header-sub{color:var(--muted);font-size:10px;margin-top:2px;}
.badge{background:rgba(0,200,83,.15);border:1px solid var(--green);color:var(--green);padding:3px 10px;border-radius:12px;font-size:10px;}
.badge-demo{background:rgba(212,168,67,.15);border:1px solid var(--gold);color:var(--gold);padding:3px 10px;border-radius:12px;font-size:10px;}
.metrics-bar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);overflow-x:auto;}
.metric{flex:1;min-width:100px;padding:10px 14px;background:var(--bg);text-align:center;}
.metric .val{font-size:18px;font-weight:700;color:var(--gold);}
.metric .lbl{font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);}
.panel{background:var(--bg);padding:18px;overflow-y:auto;max-height:calc(100vh - 148px);}
@media(max-width:1100px){.grid{grid-template-columns:1fr 1fr;}}
@media(max-width:720px){.grid{grid-template-columns:1fr;}.panel{max-height:none;}}
.panel-title{font-size:10px;font-weight:700;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border);}
.section{margin-bottom:18px;}
.section-title{font-size:9px;color:var(--teal);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
.body-text{color:var(--text);line-height:1.75;font-size:12px;opacity:.9;}
.tab-bar{display:flex;gap:1px;background:var(--border);margin-bottom:14px;overflow-x:auto;}
.tab{padding:7px 14px;cursor:pointer;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--bg);white-space:nowrap;transition:color .2s;}
.tab.active{color:var(--gold);border-bottom:2px solid var(--gold);}
.tab-content{display:none;}.tab-content.active{display:block;}
.stat-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);}
.stat-label{color:var(--muted);}
.stat-value{font-weight:600;}
.gold{color:var(--gold);}.green{color:var(--green);}.red{color:var(--red);}.amber{color:var(--amber);}
.bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.bar-label{width:110px;font-size:10px;color:var(--muted);flex-shrink:0;}
.bar-track{flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;}
.bar-fill{height:100%;border-radius:3px;}
.bar-val{width:70px;text-align:right;font-size:10px;color:var(--text);}
.vote-card{background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:10px;margin-bottom:7px;}
.vote-card .agent{font-weight:700;font-size:11px;margin-bottom:3px;}
.vote-card .rationale{color:var(--muted);font-size:10px;line-height:1.55;}
.vote-approve{border-left:3px solid var(--green);}
.vote-conditional{border-left:3px solid var(--amber);}
.tally{display:flex;gap:16px;padding:10px 14px;background:rgba(0,200,83,.05);border:1px solid rgba(0,200,83,.2);border-radius:5px;margin:10px 0;}
.tally-item{text-align:center;}
.tally-item .n{font-size:22px;font-weight:700;}
.tally-item .l{font-size:9px;color:var(--muted);}
.judge-box{background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.3);border-radius:5px;padding:12px;margin-top:10px;font-size:11px;line-height:1.7;color:var(--gold);}
.rack-grid{font-family:monospace;font-size:8px;line-height:1.05;letter-spacing:.5px;overflow-x:auto;}
.rack-legend{display:flex;gap:12px;margin-bottom:6px;flex-wrap:wrap;}
.rack-legend span{font-size:9px;}
.r-active{color:#00c853;}.r-standby{color:#ffab00;}.r-reserved{color:#4d9fff;}.r-critical{color:#ff4d6d;}.r-offline{color:#333;}
.roi-table{width:100%;border-collapse:collapse;font-size:11px;}
.roi-table th{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:9px;padding:5px 7px;border-bottom:1px solid var(--border);text-align:left;}
.roi-table td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.03);}
.roi-table .win{color:var(--green);font-weight:700;}
.roi-table .lose{color:var(--red);}
.live-btn{display:inline-flex;align-items:center;gap:8px;background:rgba(0,212,170,.1);border:1px solid var(--teal);color:var(--teal);padding:7px 18px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;}
.live-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center;}
.live-modal.open{display:flex;}
.live-modal-box{background:#0f1526;border:1px solid var(--gold);border-radius:8px;padding:32px 40px;max-width:480px;text-align:center;}
.live-modal-box h2{color:var(--gold);font-size:16px;margin-bottom:12px;letter-spacing:1px;}
.live-modal-box p{color:var(--muted);font-size:12px;line-height:1.7;margin-bottom:20px;}
.live-modal-box .close-btn{background:rgba(212,168,67,.15);border:1px solid var(--gold);color:var(--gold);padding:8px 24px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:1px;}
.live-modal-box .contact{color:var(--teal);font-size:11px;margin-top:12px;}
.chart-wrap{position:relative;height:180px;margin-top:8px;}
</style>
</head>
<body>
<div class="live-modal" id="liveModal" onclick="if(event.target===this)closeLive()">
  <div class="live-modal-box">
    <h2>⚡ FULL CPU INFERENCE</h2>
    <p>Real-time sovereign AI inference using <strong>Llama 3.2 1B GGUF</strong> running on standard x86 CPU — no GPU, no cloud, no API keys.</p>
    <p>Generation time: <strong style="color:var(--teal)">~45 seconds</strong> on a 4-core laptop.<br>Air-gapped deployment. Zero external calls. Full data sovereignty.</p>
    <p style="color:var(--gold);font-size:12px;font-weight:700;">Full CPU inference available on deployment.</p>
    <div class="contact">Contact us for access → <strong>meshpilot@agenthinkmesh.ai</strong></div>
    <br><button class="close-btn" onclick="closeLive()">CLOSE</button>
  </div>
</div>
<div class="header">
  <div>
    <div class="header-title">DAMAC Sovereign AI Command Center</div>
    <div class="header-sub">MeshPilot Unified Platform · CPU-Only · Air-Gapped · Jakarta DC Phase 1</div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <span class="badge-demo">DEMO MODE</span>
    <span class="badge">● DATA LIVE</span>
    <span style="color:var(--muted);font-size:10px" id="clock"></span>
  </div>
</div>
<div class="metrics-bar">
  <div class="metric"><div class="val">$4.1B</div><div class="lbl">2024 Revenue</div></div>
  <div class="metric"><div class="val">$24B</div><div class="lbl">Backlog</div></div>
  <div class="metric"><div class="val">3,200</div><div class="lbl">Live Racks</div></div>
  <div class="metric"><div class="val">134MW</div><div class="lbl">Power Draw</div></div>
  <div class="metric"><div class="val">78%</div><div class="lbl">Utilisation</div></div>
  <div class="metric"><div class="val">847</div><div class="lbl">Active AMRs</div></div>
  <div class="metric"><div class="val">34.2%</div><div class="lbl">CPU IRR</div></div>
  <div class="metric"><div class="val">$400M</div><div class="lbl">Capex Saved</div></div>
</div>
<div class="grid">
  <div class="panel">
    <div class="panel-title">🏢 Executive Digital Twin</div>
    <button class="live-btn" onclick="openLive()">⚡ Live Inference Mode</button>
    <div class="tab-bar">
      <div class="tab active" onclick="showTab('brief',this)">Brief</div>
      <div class="tab" onclick="showTab('revenue',this)">Revenue</div>
      <div class="tab" onclick="showTab('risk',this)">Risk</div>
      <div class="tab" onclick="showTab('rec',this)">Recommendation</div>
    </div>
    <div class="tab-content active" id="tab-brief">
      <div class="section-title">Strategic Brief</div>
      <div class="body-text">DAMAC Properties has executed a decisive strategic pivot from luxury real estate developer to sovereign AI infrastructure operator. The $1B Jakarta data centre — 500MW capacity, 12,000 CPU-only racks, powered by geothermal and solar — represents the most differentiated infrastructure play in Southeast Asia. With $24B in backlog and $4.1B in 2024 revenue, the core real estate business funds the AI buildout without dilution. The CPU-only architecture eliminates GPU export control risk (EAR99/BIS) entirely — a structural advantage no competitor can replicate without abandoning NVIDIA.</div>
    </div>
    <div class="tab-content" id="tab-revenue">
      <div class="section-title">Revenue Trajectory ($B)</div>
      <div class="chart-wrap"><canvas id="revenueChart"></canvas></div>
      <div style="margin-top:14px">
        <div class="stat-row"><div class="stat-label">2024 Revenue</div><div class="stat-value gold">$4.1B</div></div>
        <div class="stat-row"><div class="stat-label">Net Profit 2024</div><div class="stat-value gold">$1.8B (43.9% margin)</div></div>
        <div class="stat-row"><div class="stat-label">Backlog</div><div class="stat-value gold">$24.0B</div></div>
        <div class="stat-row"><div class="stat-label">DC Revenue (full cap)</div><div class="stat-value green">$180M/yr</div></div>
        <div class="stat-row"><div class="stat-label">DC EBITDA Margin</div><div class="stat-value green">65%</div></div>
      </div>
    </div>
    <div class="tab-content" id="tab-risk">
      <div class="section-title">Risk Assessment</div>
      <div class="body-text">Three material risks. First: GPU export controls are a tailwind — DAMAC's CPU-only architecture is immune to BIS restrictions that could strand a GPU-based competitor's entire capex. Second: Indonesia's regulatory environment requires 12–18 months for full licensing; the Singapore holding structure mitigates this. Third: the 24-month first-mover window is real — NVIDIA's sovereign AI product roadmap targets 2026–2027. The single risk that would change the thesis: if latency requirements for &gt;30% of workloads drop below 500ms, GPU becomes necessary.</div>
    </div>
    <div class="tab-content" id="tab-rec">
      <div class="section-title">Board Recommendation</div>
      <div class="body-text">PROCEED with Phase 2 expansion to 250MW immediately. Initiate dual-track process: (1) IPO preparation for the data centre as a Singapore-listed entity, targeting Q3 2027 after $80M annual revenue milestone; (2) strategic minority stake sale to a GCC sovereign fund as a bridge to listing. Engage Goldman Sachs and Morgan Stanley. Hard trigger: list only after Phase 2 operational and $80M revenue threshold confirmed.</div>
    </div>
    <div style="margin-top:18px">
      <div class="section-title">Council of 5 — Strategic Vote</div>
      <div style="color:var(--muted);font-size:9px;margin-bottom:10px">Q: Should DAMAC spin out the Jakarta DC as a separate listed entity?</div>
      <div class="vote-card vote-approve"><div class="agent" style="color:var(--green)">✅ CFO Twin — APPROVE</div><div class="rationale">Technology multiples (15–25× EBITDA) vs real estate multiples (8–12×) unlock $2–4B of trapped value. At full capacity, the DC generates $117M EBITDA — worth $1.75–2.9B standalone.</div></div>
      <div class="vote-card vote-conditional"><div class="agent" style="color:var(--amber)">⚠️ Risk Officer — CONDITIONAL</div><div class="rationale">Approve only after Phase 2 (250MW) is operational and revenue exceeds $80M/year. A pre-revenue tech IPO will price at a discount. Wait 18 months.</div></div>
      <div class="vote-card vote-approve"><div class="agent" style="color:var(--green)">✅ Strategy Twin — APPROVE</div><div class="rationale">First-mover window is 24 months. Every major GCC sovereign fund is evaluating this space. Act before NVIDIA launches its own sovereign AI product.</div></div>
      <div class="vote-card vote-conditional"><div class="agent" style="color:var(--amber)">⚠️ Legal Twin — CONDITIONAL</div><div class="rationale">Indonesian regulatory approval requires 12–18 months. Structure as a Singapore-listed entity with Indonesian operating subsidiary to accelerate timeline.</div></div>
      <div class="vote-card vote-approve"><div class="agent" style="color:var(--green)">✅ Market Intel — APPROVE</div><div class="rationale">Southeast Asia sovereign AI market is $4.2B by 2028. DAMAC captures 4.3% at full capacity. Comparable: Equinix trades at 22× EBITDA.</div></div>
      <div class="tally">
        <div class="tally-item"><div class="n green">3</div><div class="l">APPROVE</div></div>
        <div class="tally-item"><div class="n amber">2</div><div class="l">CONDITIONAL</div></div>
        <div class="tally-item"><div class="n red">0</div><div class="l">REJECT</div></div>
      </div>
      <div class="judge-box"><strong>JUDGE:</strong> APPROVED WITH CONDITIONS. Proceed with IPO preparation immediately. Hard trigger: list only after Phase 2 operational (Q3 2027) and $80M revenue threshold. Structure as Singapore-listed entity. Engage Goldman Sachs and Morgan Stanley for dual-track process.</div>
    </div>
  </div>
  <div class="panel">
    <div class="panel-title">🏗️ Jakarta DC + Logistics Fleet</div>
    <div class="section">
      <div class="section-title">Jakarta Rack Map — Phase 1 (3,200 / 12,000 racks)</div>
      <div class="rack-legend"><span class="r-active">█ ACTIVE</span><span class="r-standby">▓ STANDBY</span><span class="r-reserved">▪ RESERVED</span><span class="r-critical">▒ CRITICAL</span><span class="r-offline">░ OFFLINE</span></div>
      <div class="rack-grid" id="rackGrid">Generating...</div>
    </div>
    <div class="section" style="margin-top:14px">
      <div class="section-title">DC Performance</div>
      <div class="bar-row"><div class="bar-label">Power Draw</div><div class="bar-track"><div class="bar-fill" style="width:26.8%;background:var(--teal)"></div></div><div class="bar-val">134MW / 500MW</div></div>
      <div class="bar-row"><div class="bar-label">Rack Utilisation</div><div class="bar-track"><div class="bar-fill" style="width:78%;background:var(--teal)"></div></div><div class="bar-val">78%</div></div>
      <div class="bar-row"><div class="bar-label">CPU Cores Active</div><div class="bar-track"><div class="bar-fill" style="width:26.7%;background:var(--blue)"></div></div><div class="bar-val">6,400 / 24,000</div></div>
      <div class="stat-row" style="margin-top:8px"><div class="stat-label">PUE</div><div class="stat-value green">1.18 (world-class)</div></div>
      <div class="stat-row"><div class="stat-label">Avg Inference Latency</div><div class="stat-value">2,300ms</div></div>
      <div class="stat-row"><div class="stat-label">Cooling</div><div class="stat-value">Liquid Immersion</div></div>
      <div class="stat-row"><div class="stat-label">Power Source</div><div class="stat-value green">Geothermal + Solar</div></div>
    </div>
    <div class="section" style="margin-top:14px">
      <div class="section-title">Logistics Fleet Health (847 AMRs)</div>
      <div class="bar-row"><div class="bar-label">GREEN — Operational</div><div class="bar-track"><div class="bar-fill" style="width:94.2%;background:var(--green)"></div></div><div class="bar-val green">94.2%</div></div>
      <div class="bar-row"><div class="bar-label">AMBER — Scheduled</div><div class="bar-track"><div class="bar-fill" style="width:4.8%;background:var(--amber)"></div></div><div class="bar-val amber">4.8%</div></div>
      <div class="bar-row"><div class="bar-label">RED — Offline</div><div class="bar-track"><div class="bar-fill" style="width:1%;background:var(--red)"></div></div><div class="bar-val red">1.0%</div></div>
    </div>
    <div class="section" style="margin-top:14px">
      <div class="section-title">500-Episode Analytics</div>
      <div class="stat-row"><div class="stat-label">Mission Success Rate</div><div class="stat-value green">94.7%</div></div>
      <div class="stat-row"><div class="stat-label">Collision Rate</div><div class="stat-value green">0.8%</div></div>
      <div class="stat-row"><div class="stat-label">Path Efficiency</div><div class="stat-value green">91.3%</div></div>
      <div class="stat-row"><div class="stat-label">Schedule Acceleration</div><div class="stat-value gold">+11 days (Lagoons Ph3)</div></div>
    </div>
    <div class="section" style="margin-top:14px">
      <div class="section-title">Backlog Conversion ($B)</div>
      <div class="chart-wrap" style="height:140px"><canvas id="backlogChart"></canvas></div>
    </div>
  </div>
  <div class="panel">
    <div class="panel-title">📊 ROI Calculator — CPU vs GPU</div>
    <div class="section">
      <div class="section-title">10-Year Economics</div>
      <table class="roi-table">
        <thead><tr><th>Metric</th><th>CPU-Only ✅</th><th>GPU-Based</th></tr></thead>
        <tbody>
          <tr><td>Initial Capex</td><td class="win">$180M ✅</td><td class="lose">$580M</td></tr>
          <tr><td>Annual Opex</td><td class="win">$42M ✅</td><td class="lose">$95M</td></tr>
          <tr><td>EBITDA Margin</td><td class="win">65% ✅</td><td class="lose">48%</td></tr>
          <tr><td>Hardware Refresh</td><td class="win">8 years ✅</td><td class="lose">3 years</td></tr>
          <tr><td>10-yr IRR</td><td class="win">34.2% ✅</td><td class="lose">N/A (neg FCF)</td></tr>
          <tr><td>Payback Period</td><td class="win">1.8 yr ✅</td><td class="lose">Never</td></tr>
          <tr><td>Export Control</td><td class="win">NONE ✅</td><td class="lose">HIGH (EAR99)</td></tr>
          <tr><td>Capex Saved</td><td class="win" colspan="2">$400M by choosing CPU</td></tr>
        </tbody>
      </table>
    </div>
    <div style="background:rgba(0,200,83,.07);border:1px solid rgba(0,200,83,.25);border-radius:5px;padding:12px;margin-top:10px;font-size:11px;line-height:1.7;">
      <strong style="color:var(--green)">VERDICT:</strong> CPU-ONLY WINS on IRR (34.2% vs N/A), payback (1.8yr vs Never), and strategic risk. The $400M capex delta funds 9.5 years of CPU opex.
    </div>
    <div class="section" style="margin-top:18px">
      <div class="section-title">10-Year FCF — CPU Stack ($M)</div>
      <div class="chart-wrap"><canvas id="fcfChart"></canvas></div>
    </div>
    <div class="section" style="margin-top:18px">
      <div class="section-title">IC Verdict</div>
      <div style="background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.3);border-radius:5px;padding:12px">
        <div style="color:var(--teal);font-weight:700;margin-bottom:6px;font-size:11px">THE BET</div>
        <div style="font-size:11px;line-height:1.7;margin-bottom:10px">CPU inference at &lt;5s latency is sufficient for all sovereign AI workloads — and the $400M capex delta makes it the only economically rational choice.</div>
        <div style="color:var(--green);font-weight:700;margin-bottom:8px;font-size:11px">✅ VERDICT: APPROVED — CPU-ONLY ARCHITECTURE</div>
        <div style="font-size:10px;color:var(--muted);line-height:1.7">
          <div style="margin-bottom:4px"><span class="green">▶</span> IRR 34.2% vs GPU "Never" payback</div>
          <div style="margin-bottom:4px"><span class="green">▶</span> Zero EAR99 export control exposure</div>
          <div style="margin-bottom:4px"><span class="green">▶</span> $400M capex saved funds 9.5 years of opex</div>
          <div style="margin-bottom:4px"><span class="red">▷</span> Reassess if &lt;100ms latency needed for &gt;30% of workloads</div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
setInterval(()=>{document.getElementById('clock').textContent=new Date().toUTCString().slice(0,25)+' UTC';},1000);
function openLive(){document.getElementById('liveModal').classList.add('open');}
function closeLive(){document.getElementById('liveModal').classList.remove('open');}
function showTab(name,el){
  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  el.classList.add('active');
}
function buildRackMap(){
  let seed=42;
  function rng(){seed=(seed*1664525+1013904223)&0xffffffff;return(seed>>>0)/0xffffffff;}
  const chars={A:['█','r-active'],S:['▓','r-standby'],R:['▪','r-reserved'],C:['▒','r-critical']};
  let html='';
  for(let row=0;row<32;row++){
    for(let col=0;col<80;col++){
      const idx=row*80+col;
      if(idx>=3200){html+='<span class="r-offline">░</span>';continue;}
      const r=rng();
      let s=r<0.78?'A':r<0.90?'S':r<0.97?'R':'C';
      const[ch,cls]=chars[s];
      html+=\`<span class="\${cls}">\${ch}</span>\`;
    }
    html+='\\n';
  }
  document.getElementById('rackGrid').innerHTML=html;
}
buildRackMap();
new Chart(document.getElementById('revenueChart'),{type:'bar',data:{labels:['2020','2021','2022','2023','2024'],datasets:[{label:'Revenue ($B)',data:[1.1,1.6,2.3,3.2,4.1],backgroundColor:['rgba(212,168,67,.3)','rgba(212,168,67,.4)','rgba(212,168,67,.5)','rgba(212,168,67,.7)','rgba(212,168,67,.9)'],borderColor:'#d4a843',borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8892a4',font:{size:10}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#8892a4',font:{size:10},callback:v=>\`$\${v}B\`},grid:{color:'rgba(255,255,255,.04)'}}}}});
new Chart(document.getElementById('backlogChart'),{type:'line',data:{labels:['2022','2023','2024'],datasets:[{label:'Backlog ($B)',data:[12.0,18.5,24.0],borderColor:'#00d4aa',backgroundColor:'rgba(0,212,170,.1)',borderWidth:2,pointRadius:4,pointBackgroundColor:'#00d4aa',fill:true,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8892a4',font:{size:10}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#8892a4',font:{size:10},callback:v=>\`$\${v}B\`},grid:{color:'rgba(255,255,255,.04)'}}}}});
const fcfData=[-180,18,42,65,82,95,103,108,108,108,108];
const cumData=fcfData.reduce((acc,v,i)=>{acc.push((acc[i-1]||0)+v);return acc;},[]);
new Chart(document.getElementById('fcfChart'),{type:'bar',data:{labels:['Y0','Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10'],datasets:[{label:'Annual FCF',data:fcfData,backgroundColor:fcfData.map(v=>v>=0?'rgba(0,200,83,.5)':'rgba(255,77,109,.5)'),borderColor:fcfData.map(v=>v>=0?'#00c853':'#ff4d6d'),borderWidth:1,borderRadius:2,order:2},{label:'Cumulative',data:cumData,type:'line',borderColor:'#d4a843',backgroundColor:'transparent',borderWidth:2,pointRadius:3,pointBackgroundColor:'#d4a843',order:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8892a4',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#8892a4',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#8892a4',font:{size:9},callback:v=>\`$\${v}M\`},grid:{color:'rgba(255,255,255,.04)'}}}}});
<\/script>
</body>
</html>`;function s(){return e.useEffect(()=>(document.title="DAMAC Sovereign AI Command Center",()=>{document.title="AgenThinkMesh"}),[]),a.jsx("div",{"data-loc":"client/src/pages/DamacDemo.tsx:277",style:{width:"100vw",height:"100vh",overflow:"hidden"},children:a.jsx("iframe",{"data-loc":"client/src/pages/DamacDemo.tsx:278",srcDoc:t,style:{width:"100%",height:"100%",border:"none",display:"block"},title:"DAMAC Sovereign AI Command Center",sandbox:"allow-scripts"})})}export{s as default};
