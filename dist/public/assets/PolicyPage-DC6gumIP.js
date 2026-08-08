import{r as s,P as m,j as e}from"./index-THH9YYiu.js";const d=["Alghanim Industries","GCC Wealth Client","Default"],g=`# policy.alghanim.yaml
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
  max_concurrent_tasks: 10`,h=`# policy.gcc-wealth.yaml
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
  format: pdpl_compliant`,n=`# policy.template.yaml
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
  retention_days: 2555`,x=[{time:"09:41:22",client:"Alghanim Industries",rule:"hitl_triggers: external_api_call",action:"HITL gate opened",type:"warn"},{time:"09:38:15",client:"GCC Wealth Client",rule:"shariah_filter: block_non_compliant",action:"Request blocked — non-Shariah instrument",type:"block"},{time:"09:35:07",client:"Default",rule:"allowed_verticals: Finance",action:"Routed to deal-screener",type:"ok"},{time:"09:31:44",client:"Alghanim Industries",rule:"allowed_verticals: Legal",action:"Routed to legal-reviewer",type:"ok"},{time:"09:28:03",client:"Default",rule:"allowed_verticals: Finance",action:"Routed to dcf-modeler",type:"ok"},{time:"09:22:51",client:"Alghanim Industries",rule:"blocked_capabilities: external_data_export",action:"Request rejected — PDPL notice sent",type:"block"}];function p(){const[a,c]=s.useState("Alghanim Industries"),[t,r]=s.useState("rules"),o=m.filter(l=>l.client===a||l.client==="Default"),u=a==="Alghanim Industries"?g:a==="GCC Wealth Client"?h:n;return e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:116",className:"p-6 max-w-5xl",children:[e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:117",className:"mb-6",children:[e.jsxDEV("h2",{"data-loc":"client/src/pages/PolicyPage.tsx:118",className:"text-xl font-bold text-foreground mb-1",style:{fontFamily:"'Inter', sans-serif"},children:"Policy Engine"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:118,columnNumber:9},this),e.jsxDEV("p",{"data-loc":"client/src/pages/PolicyPage.tsx:119",className:"text-xs text-muted-foreground",children:"YAML-based per-client governance. Drop one file per enterprise client — no code changes required. PDPL-aligned audit logging included."},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:119,columnNumber:9},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:117,columnNumber:7},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:123",className:"grid grid-cols-3 gap-3 mb-6",children:[e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:124",className:"bg-card border border-border rounded p-3",children:[e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:125",className:"text-2xl font-bold text-foreground mb-1",style:{fontFamily:"'Inter', sans-serif"},children:"3"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:125,columnNumber:11},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:126",className:"text-xs text-muted-foreground",children:"Active client policies"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:126,columnNumber:11},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:124,columnNumber:9},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:128",className:"bg-card border border-border rounded p-3",children:[e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:129",className:"text-2xl font-bold text-amber-400 mb-1",style:{fontFamily:"'Inter', sans-serif"},children:"2"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:129,columnNumber:11},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:130",className:"text-xs text-muted-foreground",children:"HITL triggers today"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:130,columnNumber:11},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:128,columnNumber:9},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:132",className:"bg-card border border-border rounded p-3",children:[e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:133",className:"text-2xl font-bold text-red-400 mb-1",style:{fontFamily:"'Inter', sans-serif"},children:"2"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:133,columnNumber:11},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:134",className:"text-xs text-muted-foreground",children:"Requests blocked today"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:134,columnNumber:11},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:132,columnNumber:9},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:123,columnNumber:7},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:139",className:"flex gap-2 mb-4",children:d.map(l=>e.jsxDEV("button",{"data-loc":"client/src/pages/PolicyPage.tsx:141",onClick:()=>c(l),className:`px-3 py-1.5 rounded text-xs border transition-colors ${a===l?"border-primary/60 text-primary bg-primary/10":"border-border text-muted-foreground hover:text-foreground hover:border-border/80"}`,children:l},l,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:141,columnNumber:11},this))},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:139,columnNumber:7},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:152",className:"flex gap-4 border-b border-border mb-4",children:[["rules","IF→THEN Rules"],["yaml","YAML Policy"],["log","Violation Log"],["template","New Client Template"]].map(([l,i])=>e.jsxDEV("button",{"data-loc":"client/src/pages/PolicyPage.tsx:154",onClick:()=>r(l),className:`pb-2 text-xs transition-colors ${t===l?"tab-active":"tab-inactive"}`,children:i},l,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:154,columnNumber:11},this))},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:152,columnNumber:7},this),t==="rules"&&e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:165",className:"space-y-2",children:o.map(l=>e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:167",className:"bg-card border border-border rounded p-3 flex items-start gap-3",children:[e.jsxDEV("span",{"data-loc":"client/src/pages/PolicyPage.tsx:168",className:`shrink-0 px-2 py-0.5 rounded text-xs font-mono border ${l.type==="allow"?"bg-green-500/10 text-green-400 border-green-500/20":l.type==="block"?"bg-red-500/10 text-red-400 border-red-500/20":"bg-amber-500/10 text-amber-400 border-amber-500/20"}`,children:l.type.toUpperCase()},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:168,columnNumber:15},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:171",className:"flex-1 min-w-0",children:[e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:172",className:"text-xs font-mono text-foreground mb-0.5",children:["IF ",l.condition]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:172,columnNumber:17},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:173",className:"text-xs text-muted-foreground",children:["THEN ",l.action]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:173,columnNumber:17},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:171,columnNumber:15},this),e.jsxDEV("span",{"data-loc":"client/src/pages/PolicyPage.tsx:175",className:"text-xs text-muted-foreground shrink-0",children:l.client},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:175,columnNumber:15},this)]},l.id,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:167,columnNumber:13},this))},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:165,columnNumber:9},this),t==="yaml"&&e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:182",className:"code-block text-xs overflow-auto max-h-96",children:e.jsxDEV("pre",{"data-loc":"client/src/pages/PolicyPage.tsx:183",className:"text-foreground whitespace-pre",children:u},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:183,columnNumber:11},this)},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:182,columnNumber:9},this),t==="log"&&e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:188",className:"space-y-1",children:[x.map((l,i)=>e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:190",className:"bg-card border border-border rounded p-2.5 flex items-start gap-3 text-xs",children:[e.jsxDEV("span",{"data-loc":"client/src/pages/PolicyPage.tsx:191",className:"text-muted-foreground shrink-0 font-mono",children:l.time},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:191,columnNumber:15},this),e.jsxDEV("span",{"data-loc":"client/src/pages/PolicyPage.tsx:192",className:`shrink-0 px-1.5 py-0.5 rounded text-xs ${l.type==="ok"?"bg-green-500/10 text-green-400":l.type==="warn"?"bg-amber-500/10 text-amber-400":"bg-red-500/10 text-red-400"}`,children:l.type==="ok"?"ALLOW":l.type==="warn"?"HITL":"BLOCK"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:192,columnNumber:15},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:195",className:"flex-1 min-w-0",children:[e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:196",className:"text-foreground truncate",children:l.action},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:196,columnNumber:17},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:197",className:"text-muted-foreground truncate",children:l.rule},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:197,columnNumber:17},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:195,columnNumber:15},this),e.jsxDEV("span",{"data-loc":"client/src/pages/PolicyPage.tsx:199",className:"text-muted-foreground shrink-0",children:l.client},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:199,columnNumber:15},this)]},i,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:190,columnNumber:13},this)),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:202",className:"text-xs text-muted-foreground text-center py-2",children:"* Trust Score = rolling 30-day task success rate across live Mesh executions, updated nightly."},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:202,columnNumber:11},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:188,columnNumber:9},this),t==="template"&&e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:209",children:[e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:210",className:"text-xs text-muted-foreground mb-3",children:["Copy this template, rename to ",e.jsxDEV("span",{"data-loc":"client/src/pages/PolicyPage.tsx:211",className:"text-primary font-mono",children:"policy.<client_id>.yaml"},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:211,columnNumber:43},this),", fill in the fields, and restart the Policy Engine. No code changes required."]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:210,columnNumber:11},this),e.jsxDEV("div",{"data-loc":"client/src/pages/PolicyPage.tsx:213",className:"code-block text-xs overflow-auto max-h-96",children:e.jsxDEV("pre",{"data-loc":"client/src/pages/PolicyPage.tsx:214",className:"text-foreground whitespace-pre",children:n},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:214,columnNumber:13},this)},void 0,!1,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:213,columnNumber:11},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:209,columnNumber:9},this)]},void 0,!0,{fileName:"/home/ubuntu/agenthinkmesh-full/client/src/pages/PolicyPage.tsx",lineNumber:116,columnNumber:5},this)}export{p as default};
