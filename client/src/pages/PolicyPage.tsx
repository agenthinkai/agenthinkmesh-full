// PolicyPage.tsx — Enterprise Policy Engine
// Design: Operator Dark — YAML rules, violation log, HITL triggers

import { useState } from "react";
import { POLICY_RULES } from "@/lib/meshData";

const CLIENTS = ["Alghanim Industries", "GCC Wealth Client", "Default"];

const ALGHANIM_YAML = `# policy.alghanim.yaml
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
  max_concurrent_tasks: 10`;

const GCC_YAML = `# policy.gcc-wealth.yaml
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
  format: pdpl_compliant`;

const TEMPLATE_YAML = `# policy.template.yaml
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
  retention_days: 2555`;

const VIOLATION_LOG = [
  { time: "09:41:22", client: "Alghanim Industries", rule: "hitl_triggers: external_api_call", action: "HITL gate opened", type: "warn" as const },
  { time: "09:38:15", client: "GCC Wealth Client", rule: "shariah_filter: block_non_compliant", action: "Request blocked — non-Shariah instrument", type: "block" as const },
  { time: "09:35:07", client: "Default", rule: "allowed_verticals: Finance", action: "Routed to deal-screener", type: "ok" as const },
  { time: "09:31:44", client: "Alghanim Industries", rule: "allowed_verticals: Legal", action: "Routed to legal-reviewer", type: "ok" as const },
  { time: "09:28:03", client: "Default", rule: "allowed_verticals: Finance", action: "Routed to dcf-modeler", type: "ok" as const },
  { time: "09:22:51", client: "Alghanim Industries", rule: "blocked_capabilities: external_data_export", action: "Request rejected — PDPL notice sent", type: "block" as const },
];

export default function PolicyPage() {
  const [activeClient, setActiveClient] = useState("Alghanim Industries");
  const [activeTab, setActiveTab] = useState<"rules" | "yaml" | "log" | "template">("rules");

  const clientRules = POLICY_RULES.filter(r => r.client === activeClient || r.client === "Default");
  const yaml = activeClient === "Alghanim Industries" ? ALGHANIM_YAML : activeClient === "GCC Wealth Client" ? GCC_YAML : TEMPLATE_YAML;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>Policy Engine</h2>
        <p className="text-xs text-muted-foreground">YAML-based per-client governance. Drop one file per enterprise client — no code changes required. PDPL-aligned audit logging included.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded p-3">
          <div className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>3</div>
          <div className="text-xs text-muted-foreground">Active client policies</div>
        </div>
        <div className="bg-card border border-border rounded p-3">
          <div className="text-2xl font-bold text-amber-400 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>2</div>
          <div className="text-xs text-muted-foreground">HITL triggers today</div>
        </div>
        <div className="bg-card border border-border rounded p-3">
          <div className="text-2xl font-bold text-red-400 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>2</div>
          <div className="text-xs text-muted-foreground">Requests blocked today</div>
        </div>
      </div>

      {/* Client selector */}
      <div className="flex gap-2 mb-4">
        {CLIENTS.map(c => (
          <button
            key={c}
            onClick={() => setActiveClient(c)}
            className={`px-3 py-1.5 rounded text-xs border transition-colors ${activeClient === c ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border mb-4">
        {([["rules", "IF→THEN Rules"], ["yaml", "YAML Policy"], ["log", "Violation Log"], ["template", "New Client Template"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-xs transition-colors ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "rules" && (
        <div className="space-y-2">
          {clientRules.map(rule => (
            <div key={rule.id} className="bg-card border border-border rounded p-3 flex items-start gap-3">
              <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-mono border ${rule.type === 'allow' ? 'bg-green-500/10 text-green-400 border-green-500/20' : rule.type === 'block' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                {rule.type.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-foreground mb-0.5">IF {rule.condition}</div>
                <div className="text-xs text-muted-foreground">THEN {rule.action}</div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{rule.client}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "yaml" && (
        <div className="code-block text-xs overflow-auto max-h-96">
          <pre className="text-foreground whitespace-pre">{yaml}</pre>
        </div>
      )}

      {activeTab === "log" && (
        <div className="space-y-1">
          {VIOLATION_LOG.map((entry, i) => (
            <div key={i} className="bg-card border border-border rounded p-2.5 flex items-start gap-3 text-xs">
              <span className="text-muted-foreground shrink-0 font-mono">{entry.time}</span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs ${entry.type === 'ok' ? 'bg-green-500/10 text-green-400' : entry.type === 'warn' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                {entry.type === 'ok' ? 'ALLOW' : entry.type === 'warn' ? 'HITL' : 'BLOCK'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-foreground truncate">{entry.action}</div>
                <div className="text-muted-foreground truncate">{entry.rule}</div>
              </div>
              <span className="text-muted-foreground shrink-0">{entry.client}</span>
            </div>
          ))}
          <div className="text-xs text-muted-foreground text-center py-2">
            * Trust Score = rolling 30-day task success rate across live Mesh executions, updated nightly.
          </div>
        </div>
      )}

      {activeTab === "template" && (
        <div>
          <div className="text-xs text-muted-foreground mb-3">
            Copy this template, rename to <span className="text-primary font-mono">policy.&lt;client_id&gt;.yaml</span>, fill in the fields, and restart the Policy Engine. No code changes required.
          </div>
          <div className="code-block text-xs overflow-auto max-h-96">
            <pre className="text-foreground whitespace-pre">{TEMPLATE_YAML}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
