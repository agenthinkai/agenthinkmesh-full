import{r as i,j as e}from"./react-vendor-ChkOGfOz.js";import{P as g}from"./index-Bx1ZaBSJ.js";import"./vendor-B43sDH1-.js";import"./date-utils-B2ZejYPs.js";import"./export-libs-suHawyUQ.js";import"./charts-Bhwmpjvm.js";import"./trpc-Dsj9agTq.js";import"./radix-BzVH_mSP.js";import"./flow-DCgLNMlO.js";import"./validation-Bu41HMwz.js";const x=["Alghanim Industries","GCC Wealth Client","Default"],p=`# policy.alghanim.yaml
# Alghanim Industries — Enterprise Policy
# Zero code changes required to add a new client

client_id: alghanim-industries
client_name: Alghanim Industries
effective_date: "2026-03-01"

allowed_verticals:
  - Finance
  - Legal
  - Enterprise

blocked_capabilities:
  - external_data_export
  - pii_transmission

hitl_triggers:
  - external_api_call
  - task_value_gt_50000

audit_log:
  enabled: true
  format: pdpl_compliant
  retention_days: 2555  # 7 years

rate_limits:
  requests_per_minute: 60
  max_concurrent_tasks: 10`,m=`# policy.gcc-wealth.yaml
# GCC Wealth Client — Shariah-compliant policy

client_id: gcc-wealth-client
client_name: GCC Wealth Client
effective_date: "2026-03-01"

allowed_verticals:
  - GCC Wealth
  - Finance
  - Legal

shariah_filter:
  enabled: true
  standard: AAOIFI
  block_non_compliant: true

hitl_triggers:
  - portfolio_rebalance
  - client_data_export

audit_log:
  enabled: true
  format: pdpl_compliant`,c=`# policy.template.yaml
# Copy this file and rename to policy.<client_id>.yaml
# No code changes required — drop the file and restart

client_id: <your-client-id>
client_name: <Your Client Name>
effective_date: "YYYY-MM-DD"

# Verticals this client is allowed to access
allowed_verticals:
  - Finance      # VC/PE, Fund Manager, SWF
  - Legal        # Law Firm, In-House Counsel
  - Healthcare   # Hospital Ops, Clinical Research
  - Enterprise   # HR, Procurement, Operations
  - GCC Wealth   # Private Wealth, Family Office
  - AdMesh       # Brand, Marketing, Campaigns

# Capabilities that are always blocked
blocked_capabilities: []

# Capabilities that require human approval
hitl_triggers: []

# Shariah compliance filter (GCC clients)
shariah_filter:
  enabled: false
  standard: AAOIFI
  block_non_compliant: false

# Audit log (PDPL-aligned)
audit_log:
  enabled: true
  format: pdpl_compliant
  retention_days: 2555`,u=[{time:"09:41:22",client:"Alghanim Industries",rule:"hitl_triggers: external_api_call",action:"HITL gate opened",type:"warn"},{time:"09:38:15",client:"GCC Wealth Client",rule:"shariah_filter: block_non_compliant",action:"Request blocked — non-Shariah instrument",type:"block"},{time:"09:35:07",client:"Default",rule:"allowed_verticals: Finance",action:"Routed to deal-screener",type:"ok"},{time:"09:31:44",client:"Alghanim Industries",rule:"allowed_verticals: Legal",action:"Routed to legal-reviewer",type:"ok"},{time:"09:28:03",client:"Default",rule:"allowed_verticals: Finance",action:"Routed to dcf-modeler",type:"ok"},{time:"09:22:51",client:"Alghanim Industries",rule:"blocked_capabilities: external_data_export",action:"Request rejected — PDPL notice sent",type:"block"}];function k(){const[l,r]=i.useState("Alghanim Industries"),[a,o]=i.useState("rules"),n=g.filter(t=>t.client===l||t.client==="Default"),d=l==="Alghanim Industries"?p:l==="GCC Wealth Client"?m:c;return e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:116",className:"p-6 max-w-5xl",children:[e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:117",className:"mb-6",children:[e.jsx("h2",{"data-loc":"client/src/pages/PolicyPage.tsx:118",className:"text-xl font-bold text-foreground mb-1",style:{fontFamily:"'Inter', sans-serif"},children:"Policy Engine"}),e.jsx("p",{"data-loc":"client/src/pages/PolicyPage.tsx:119",className:"text-xs text-muted-foreground",children:"YAML-based per-client governance. Drop one file per enterprise client — no code changes required. PDPL-aligned audit logging included."})]}),e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:123",className:"grid grid-cols-3 gap-3 mb-6",children:[e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:124",className:"bg-card border border-border rounded p-3",children:[e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:125",className:"text-2xl font-bold text-foreground mb-1",style:{fontFamily:"'Inter', sans-serif"},children:"3"}),e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:126",className:"text-xs text-muted-foreground",children:"Active client policies"})]}),e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:128",className:"bg-card border border-border rounded p-3",children:[e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:129",className:"text-2xl font-bold text-amber-400 mb-1",style:{fontFamily:"'Inter', sans-serif"},children:"2"}),e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:130",className:"text-xs text-muted-foreground",children:"HITL triggers today"})]}),e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:132",className:"bg-card border border-border rounded p-3",children:[e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:133",className:"text-2xl font-bold text-red-400 mb-1",style:{fontFamily:"'Inter', sans-serif"},children:"2"}),e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:134",className:"text-xs text-muted-foreground",children:"Requests blocked today"})]})]}),e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:139",className:"flex gap-2 mb-4",children:x.map(t=>e.jsx("button",{"data-loc":"client/src/pages/PolicyPage.tsx:141",onClick:()=>r(t),className:`px-3 py-1.5 rounded text-xs border transition-colors ${l===t?"border-primary/60 text-primary bg-primary/10":"border-border text-muted-foreground hover:text-foreground hover:border-border/80"}`,children:t},t))}),e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:152",className:"flex gap-4 border-b border-border mb-4",children:[["rules","IF→THEN Rules"],["yaml","YAML Policy"],["log","Violation Log"],["template","New Client Template"]].map(([t,s])=>e.jsx("button",{"data-loc":"client/src/pages/PolicyPage.tsx:154",onClick:()=>o(t),className:`pb-2 text-xs transition-colors ${a===t?"tab-active":"tab-inactive"}`,children:s},t))}),a==="rules"&&e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:165",className:"space-y-2",children:n.map(t=>e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:167",className:"bg-card border border-border rounded p-3 flex items-start gap-3",children:[e.jsx("span",{"data-loc":"client/src/pages/PolicyPage.tsx:168",className:`shrink-0 px-2 py-0.5 rounded text-xs font-mono border ${t.type==="allow"?"bg-green-500/10 text-green-400 border-green-500/20":t.type==="block"?"bg-red-500/10 text-red-400 border-red-500/20":"bg-amber-500/10 text-amber-400 border-amber-500/20"}`,children:t.type.toUpperCase()}),e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:171",className:"flex-1 min-w-0",children:[e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:172",className:"text-xs font-mono text-foreground mb-0.5",children:["IF ",t.condition]}),e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:173",className:"text-xs text-muted-foreground",children:["THEN ",t.action]})]}),e.jsx("span",{"data-loc":"client/src/pages/PolicyPage.tsx:175",className:"text-xs text-muted-foreground shrink-0",children:t.client})]},t.id))}),a==="yaml"&&e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:182",className:"code-block text-xs overflow-auto max-h-96",children:e.jsx("pre",{"data-loc":"client/src/pages/PolicyPage.tsx:183",className:"text-foreground whitespace-pre",children:d})}),a==="log"&&e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:188",className:"space-y-1",children:[u.map((t,s)=>e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:190",className:"bg-card border border-border rounded p-2.5 flex items-start gap-3 text-xs",children:[e.jsx("span",{"data-loc":"client/src/pages/PolicyPage.tsx:191",className:"text-muted-foreground shrink-0 font-mono",children:t.time}),e.jsx("span",{"data-loc":"client/src/pages/PolicyPage.tsx:192",className:`shrink-0 px-1.5 py-0.5 rounded text-xs ${t.type==="ok"?"bg-green-500/10 text-green-400":t.type==="warn"?"bg-amber-500/10 text-amber-400":"bg-red-500/10 text-red-400"}`,children:t.type==="ok"?"ALLOW":t.type==="warn"?"HITL":"BLOCK"}),e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:195",className:"flex-1 min-w-0",children:[e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:196",className:"text-foreground truncate",children:t.action}),e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:197",className:"text-muted-foreground truncate",children:t.rule})]}),e.jsx("span",{"data-loc":"client/src/pages/PolicyPage.tsx:199",className:"text-muted-foreground shrink-0",children:t.client})]},s)),e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:202",className:"text-xs text-muted-foreground text-center py-2",children:"* Trust Score = rolling 30-day task success rate across live Mesh executions, updated nightly."})]}),a==="template"&&e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:209",children:[e.jsxs("div",{"data-loc":"client/src/pages/PolicyPage.tsx:210",className:"text-xs text-muted-foreground mb-3",children:["Copy this template, rename to ",e.jsx("span",{"data-loc":"client/src/pages/PolicyPage.tsx:211",className:"text-primary font-mono",children:"policy.<client_id>.yaml"}),", fill in the fields, and restart the Policy Engine. No code changes required."]}),e.jsx("div",{"data-loc":"client/src/pages/PolicyPage.tsx:213",className:"code-block text-xs overflow-auto max-h-96",children:e.jsx("pre",{"data-loc":"client/src/pages/PolicyPage.tsx:214",className:"text-foreground whitespace-pre",children:c})})]})]})}export{k as default};
