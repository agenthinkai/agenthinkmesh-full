/**
 * EnterpriseSetupWizard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-service enterprise onboarding wizard — /enterprise/setup
 *
 * 9 Steps:
 *   1. Organisation Details  (name, slug, plan, industry, geography, governance)
 *   2. Departments           (create / select)
 *   3. Administrator         (first admin user)
 *   4. Users & Roles         (invite users, assign departments & roles)
 *   5. Decision Twins        (select & deploy from blueprints)
 *   6. Data Sources          (connector placeholders)
 *   7. Review                (full summary before provisioning)
 *   8. Provision             (atomic mutation — calls enterprise.provisionOrg)
 *   9. Confirmation          (enterprise URL, deployed twins, next actions)
 *
 * Uses adminProcedure — only role=admin users can access.
 * No database editing. No shell commands. No engineering intervention.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  Users,
  Shield,
  Brain,
  Database,
  ClipboardList,
  Zap,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department {
  name: string;
  slug: string;
  description?: string;
}

interface AdminUser {
  userId: number;
  jobTitle?: string;
}

interface TwinSelection {
  blueprintId: string;
  instanceSlug: string;
  displayName: string;
  description?: string;
  councilPersonaSetId?: string;
  ontologyId?: string;
  kpiSetId?: string;
}

interface ConnectorPlaceholder {
  name: string;
  type: "csv" | "excel" | "rest" | "sql";
  owner?: string;
  classification: "public" | "internal" | "confidential" | "restricted";
}

interface WizardState {
  // Step 1
  orgName: string;
  orgSlug: string;
  plan: "trial" | "standard" | "enterprise";
  approvedDomains: string[];
  dailyTokenLimit: number;
  industry: string;
  geography: string;
  governanceProfile: "STANDARD" | "CONFIDENTIAL" | "SOVEREIGN" | "CLASSIFIED";
  // Step 2
  departments: Department[];
  // Step 3
  adminUserId: string;
  adminJobTitle: string;
  // Step 4 (informational — invitations happen post-provision)
  plannedUsers: string;
  // Step 5
  selectedTwins: TwinSelection[];
  // Step 6
  connectors: ConnectorPlaceholder[];
}

const DEFAULT_STATE: WizardState = {
  orgName: "",
  orgSlug: "",
  plan: "trial",
  approvedDomains: [],
  dailyTokenLimit: 50000,
  industry: "",
  geography: "",
  governanceProfile: "STANDARD",
  departments: [],
  adminUserId: "",
  adminJobTitle: "",
  plannedUsers: "",
  selectedTwins: [],
  connectors: [],
};

const PLAN_LIMITS: Record<string, number> = {
  trial: 50000,
  standard: 200000,
  enterprise: 1000000,
};

const SUGGESTED_DEPARTMENTS = [
  { name: "Corporate Strategy", slug: "corporate-strategy" },
  { name: "Procurement", slug: "procurement" },
  { name: "Finance", slug: "finance" },
  { name: "Operations", slug: "operations" },
  { name: "Human Resources", slug: "human-resources" },
  { name: "Technology", slug: "technology" },
  { name: "Legal & Compliance", slug: "legal-compliance" },
  { name: "Risk Management", slug: "risk-management" },
];

const SUGGESTED_BLUEPRINTS = [
  { blueprintId: "bp-alghanim", name: "Alghanim Industries Decision Twin", description: "M&A screening, capital allocation, and vendor risk for diversified conglomerates" },
  { blueprintId: "bp-core42", name: "Core42 Enterprise AI Decision Twin", description: "Enterprise AI strategy and capital allocation" },
  { blueprintId: "bp-uic", name: "UIC Financial Intelligence Decision Twin", description: "Investment screening and portfolio management" },
  { blueprintId: "bp-damac", name: "DAMAC Properties Decision Twin", description: "Real estate investment and development decisions" },
  { blueprintId: "bp-sami", name: "SAMI Defense AI Decision Twin", description: "Defense procurement and vendor risk" },
  { blueprintId: "bp-agenthink", name: "AgenThink Mesh Executive Decision Twin", description: "Executive-level strategic decisions" },
];

const STEPS = [
  { id: 1, label: "Organisation", icon: Building2 },
  { id: 2, label: "Departments", icon: Building2 },
  { id: 3, label: "Administrator", icon: Shield },
  { id: 4, label: "Users & Roles", icon: Users },
  { id: 5, label: "Decision Twins", icon: Brain },
  { id: 6, label: "Data Sources", icon: Database },
  { id: 7, label: "Review", icon: ClipboardList },
  { id: 8, label: "Provision", icon: Zap },
  { id: 9, label: "Confirmation", icon: CheckCircle2 },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EnterpriseSetupWizard() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [domainInput, setDomainInput] = useState("");
  const [newDept, setNewDept] = useState<Department>({ name: "", slug: "", description: "" });
  const [newConnector, setNewConnector] = useState<ConnectorPlaceholder>({ name: "", type: "csv", owner: "", classification: "internal" });
  const [provisionResult, setProvisionResult] = useState<any>(null);

  const provisionMutation = trpc.enterprise.provisionOrg.useMutation({
    onSuccess: (data) => {
      setProvisionResult(data);
      setStep(9);
      toast.success("Organisation provisioned successfully!");
    },
    onError: (err) => {
      toast.error(`Provisioning failed: ${err.message}`);
    },
  });

  const update = useCallback((patch: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  // ─── Step helpers ──────────────────────────────────────────────────────────

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function addDomain() {
    const d = domainInput.trim().toLowerCase();
    if (!d) return;
    if (!state.approvedDomains.includes(d)) {
      update({ approvedDomains: [...state.approvedDomains, d] });
    }
    setDomainInput("");
  }

  function addDept(dept: Department) {
    if (!dept.name || !dept.slug) return;
    if (!state.departments.find(d => d.slug === dept.slug)) {
      update({ departments: [...state.departments, dept] });
    }
  }

  function removeDept(slug: string) {
    update({ departments: state.departments.filter(d => d.slug !== slug) });
  }

  function toggleBlueprint(bp: typeof SUGGESTED_BLUEPRINTS[0]) {
    const existing = state.selectedTwins.find(t => t.blueprintId === bp.blueprintId);
    if (existing) {
      update({ selectedTwins: state.selectedTwins.filter(t => t.blueprintId !== bp.blueprintId) });
    } else {
      update({
        selectedTwins: [...state.selectedTwins, {
          blueprintId: bp.blueprintId,
          instanceSlug: `${state.orgSlug || "org"}-${bp.blueprintId.replace("bp-", "")}`,
          displayName: bp.name,
          description: bp.description,
        }],
      });
    }
  }

  function addConnector() {
    if (!newConnector.name) return;
    update({ connectors: [...state.connectors, { ...newConnector }] });
    setNewConnector({ name: "", type: "csv", owner: "", classification: "internal" });
  }

  function removeConnector(idx: number) {
    update({ connectors: state.connectors.filter((_, i) => i !== idx) });
  }

  function handleProvision() {
    provisionMutation.mutate({
      org: {
        name: state.orgName,
        slug: state.orgSlug,
        plan: state.plan,
        approvedDomains: state.approvedDomains,
        dailyTokenLimit: state.dailyTokenLimit,
        industry: state.industry || undefined,
        geography: state.geography || undefined,
        governanceProfile: state.governanceProfile,
      },
      departments: state.departments,
      adminUser: state.adminUserId ? { userId: parseInt(state.adminUserId), jobTitle: state.adminJobTitle || undefined } : undefined,
      twins: state.selectedTwins,
      connectors: state.connectors,
    });
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  function canProceed(): boolean {
    if (step === 1) return !!(state.orgName.trim() && state.orgSlug.trim());
    return true;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Enterprise Setup</h1>
            <p className="text-sm text-muted-foreground">Self-service onboarding — no engineering required</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="border-b bg-muted/30 px-6 py-3 overflow-x-auto">
        <div className="max-w-5xl mx-auto flex items-center gap-1 min-w-max">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <div key={s.id} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" :
                  isDone ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                  "text-muted-foreground"
                }`}>
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Step 1: Organisation Details ── */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Organisation Details</CardTitle>
              <CardDescription>Define the organisation identity, plan, and governance profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organisation Name *</Label>
                  <Input
                    placeholder="Alghanim Industries"
                    value={state.orgName}
                    onChange={e => {
                      update({ orgName: e.target.value, orgSlug: autoSlug(e.target.value) });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL identifier) *</Label>
                  <Input
                    placeholder="alghanim-industries"
                    value={state.orgSlug}
                    onChange={e => update({ orgSlug: autoSlug(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">Lowercase, hyphens only. Cannot be changed later.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={state.plan} onValueChange={v => update({ plan: v as any, dailyTokenLimit: PLAN_LIMITS[v] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input placeholder="Conglomerate" value={state.industry} onChange={e => update({ industry: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Geography</Label>
                  <Input placeholder="Kuwait" value={state.geography} onChange={e => update({ geography: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Token Limit</Label>
                  <Input
                    type="number"
                    value={state.dailyTokenLimit}
                    onChange={e => update({ dailyTokenLimit: parseInt(e.target.value) || PLAN_LIMITS[state.plan] })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Governance Profile</Label>
                  <Select value={state.governanceProfile} onValueChange={v => update({ governanceProfile: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                      <SelectItem value="SOVEREIGN">Sovereign</SelectItem>
                      <SelectItem value="CLASSIFIED">Classified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Approved Email Domains</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="@alghanim.com"
                    value={domainInput}
                    onChange={e => setDomainInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addDomain()}
                  />
                  <Button variant="outline" onClick={addDomain} type="button"><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {state.approvedDomains.map(d => (
                    <Badge key={d} variant="secondary" className="gap-1">
                      {d}
                      <button onClick={() => update({ approvedDomains: state.approvedDomains.filter(x => x !== d) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Departments ── */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Departments</CardTitle>
              <CardDescription>Add departments. You can use the suggestions below or create custom ones.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-medium mb-2">Suggested departments</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_DEPARTMENTS.map(d => {
                    const added = state.departments.find(x => x.slug === d.slug);
                    return (
                      <Button
                        key={d.slug}
                        variant={added ? "default" : "outline"}
                        size="sm"
                        onClick={() => added ? removeDept(d.slug) : addDept(d)}
                      >
                        {added ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                        {d.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Add custom department</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Department name"
                    value={newDept.name}
                    onChange={e => setNewDept(p => ({ ...p, name: e.target.value, slug: autoSlug(e.target.value) }))}
                  />
                  <Input
                    placeholder="slug"
                    value={newDept.slug}
                    onChange={e => setNewDept(p => ({ ...p, slug: autoSlug(e.target.value) }))}
                  />
                </div>
                <Input
                  placeholder="Description (optional)"
                  value={newDept.description}
                  onChange={e => setNewDept(p => ({ ...p, description: e.target.value }))}
                />
                <Button variant="outline" onClick={() => { addDept(newDept); setNewDept({ name: "", slug: "", description: "" }); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add Department
                </Button>
              </div>

              {state.departments.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Selected ({state.departments.length})</p>
                  <div className="space-y-1.5">
                    {state.departments.map(d => (
                      <div key={d.slug} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2">
                        <div>
                          <span className="text-sm font-medium">{d.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">/{d.slug}</span>
                        </div>
                        <button onClick={() => removeDept(d.slug)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Administrator ── */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> First Administrator</CardTitle>
              <CardDescription>Assign the first enterprise administrator. They will receive full administrative access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input
                    type="number"
                    placeholder="Enter user ID"
                    value={state.adminUserId}
                    onChange={e => update({ adminUserId: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">The user must already have a platform account. Find their ID in Admin → User List.</p>
                </div>
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input
                    placeholder="Chief Digital Officer"
                    value={state.adminJobTitle}
                    onChange={e => update({ adminJobTitle: e.target.value })}
                  />
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 flex gap-3">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Administrator permissions:</strong> The assigned user will receive the Enterprise Admin role with full access to all organisation resources, members, twins, and audit logs. Additional users can be invited after provisioning from the Enterprise Dashboard.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Users & Roles ── */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Users & Roles</CardTitle>
              <CardDescription>Plan your user structure. Invitations are sent after provisioning.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Planned users (optional note)</Label>
                <Textarea
                  placeholder="e.g. 5 analysts in Finance, 2 executives in Corporate Strategy, 1 IT admin"
                  value={state.plannedUsers}
                  onChange={e => update({ plannedUsers: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">This is a planning note only. Actual invitations are sent from the Enterprise Dashboard after provisioning.</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Roles created automatically at provisioning:</p>
                <div className="space-y-1">
                  {[
                    { name: "Enterprise Admin", desc: "Full access — assigned to the administrator above" },
                    { name: "Decision Analyst", desc: "Can run Decision Twins and view reports" },
                    { name: "Viewer", desc: "Read-only access to dashboards and reports" },
                  ].map(r => (
                    <div key={r.name} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>{r.name}</strong> — {r.desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-1">Additional roles can be created from the Enterprise Dashboard after provisioning.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 5: Decision Twins ── */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> Decision Twins</CardTitle>
              <CardDescription>Select the Decision Twins to deploy. Each twin is deployed from a reusable blueprint.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {SUGGESTED_BLUEPRINTS.map(bp => {
                  const selected = state.selectedTwins.find(t => t.blueprintId === bp.blueprintId);
                  return (
                    <div
                      key={bp.blueprintId}
                      onClick={() => toggleBlueprint(bp)}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{bp.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{bp.description}</p>
                        {selected && (
                          <div className="mt-2">
                            <Input
                              className="text-xs h-7"
                              placeholder="Instance slug"
                              value={selected.instanceSlug}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                update({
                                  selectedTwins: state.selectedTwins.map(t =>
                                    t.blueprintId === bp.blueprintId ? { ...t, instanceSlug: autoSlug(e.target.value) } : t
                                  ),
                                });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {state.selectedTwins.length > 0 && (
                <p className="text-sm text-muted-foreground">{state.selectedTwins.length} twin{state.selectedTwins.length !== 1 ? "s" : ""} selected</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 6: Data Sources ── */}
        {step === 6 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Data Sources</CardTitle>
              <CardDescription>Register data source placeholders. Actual connections are configured after provisioning.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Source Name</Label>
                  <Input placeholder="ERP Financial Data" value={newConnector.name} onChange={e => setNewConnector(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newConnector.type} onValueChange={v => setNewConnector(p => ({ ...p, type: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="rest">REST API</SelectItem>
                      <SelectItem value="sql">SQL Database</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Owner</Label>
                  <Input placeholder="Finance Team" value={newConnector.owner} onChange={e => setNewConnector(p => ({ ...p, owner: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Classification</Label>
                  <Select value={newConnector.classification} onValueChange={v => setNewConnector(p => ({ ...p, classification: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="confidential">Confidential</SelectItem>
                      <SelectItem value="restricted">Restricted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" onClick={addConnector} disabled={!newConnector.name}>
                <Plus className="h-4 w-4 mr-1" /> Add Data Source
              </Button>

              {state.connectors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Registered ({state.connectors.length})</p>
                  {state.connectors.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{c.type.toUpperCase()}</Badge>
                        <span className="text-sm font-medium">{c.name}</span>
                        {c.owner && <span className="text-xs text-muted-foreground">· {c.owner}</span>}
                        <Badge variant="secondary" className="text-xs">{c.classification}</Badge>
                        <Badge variant="outline" className="text-xs text-amber-600">pending</Badge>
                      </div>
                      <button onClick={() => removeConnector(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 7: Review ── */}
        {step === 7 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Review</CardTitle>
              <CardDescription>Review the complete onboarding configuration before provisioning.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ReviewSection title="Organisation">
                <ReviewRow label="Name" value={state.orgName} />
                <ReviewRow label="Slug" value={state.orgSlug} />
                <ReviewRow label="Plan" value={state.plan} />
                <ReviewRow label="Industry" value={state.industry || "—"} />
                <ReviewRow label="Geography" value={state.geography || "—"} />
                <ReviewRow label="Governance" value={state.governanceProfile} />
                <ReviewRow label="Daily Token Limit" value={state.dailyTokenLimit.toLocaleString()} />
                <ReviewRow label="Approved Domains" value={state.approvedDomains.length > 0 ? state.approvedDomains.join(", ") : "None"} />
              </ReviewSection>

              <ReviewSection title={`Departments (${state.departments.length})`}>
                {state.departments.length === 0
                  ? <p className="text-sm text-muted-foreground">No departments configured</p>
                  : state.departments.map(d => <ReviewRow key={d.slug} label={d.name} value={`/${d.slug}`} />)
                }
              </ReviewSection>

              <ReviewSection title="Administrator">
                {state.adminUserId
                  ? <><ReviewRow label="User ID" value={state.adminUserId} /><ReviewRow label="Job Title" value={state.adminJobTitle || "—"} /></>
                  : <p className="text-sm text-muted-foreground">No administrator assigned (can be set later)</p>
                }
              </ReviewSection>

              <ReviewSection title={`Decision Twins (${state.selectedTwins.length})`}>
                {state.selectedTwins.length === 0
                  ? <p className="text-sm text-muted-foreground">No twins selected</p>
                  : state.selectedTwins.map(t => <ReviewRow key={t.blueprintId} label={t.displayName} value={t.instanceSlug} />)
                }
              </ReviewSection>

              <ReviewSection title={`Data Sources (${state.connectors.length})`}>
                {state.connectors.length === 0
                  ? <p className="text-sm text-muted-foreground">No data sources registered</p>
                  : state.connectors.map((c, i) => <ReviewRow key={i} label={c.name} value={`${c.type.toUpperCase()} · ${c.classification}`} />)
                }
              </ReviewSection>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Provisioning will create the organisation, departments, roles, memberships, and twin instances in the database. This action cannot be undone from this wizard.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 8: Provision ── */}
        {step === 8 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Provision</CardTitle>
              <CardDescription>Click Provision to create the organisation and all configured resources.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">The following will be provisioned:</p>
                <div className="space-y-1.5">
                  {[
                    `Organisation: ${state.orgName} (/${state.orgSlug})`,
                    `${state.departments.length} department${state.departments.length !== 1 ? "s" : ""}`,
                    `Enterprise Admin role (system role)`,
                    state.adminUserId ? `Administrator membership (User ID: ${state.adminUserId})` : "No administrator assigned",
                    `${state.selectedTwins.length} Decision Twin${state.selectedTwins.length !== 1 ? "s" : ""}`,
                    `${state.connectors.length} data source placeholder${state.connectors.length !== 1 ? "s" : ""}`,
                    "Audit record",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleProvision}
                disabled={provisionMutation.isPending}
              >
                {provisionMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Provisioning…</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" /> Provision Enterprise</>
                )}
              </Button>

              {provisionMutation.isError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{provisionMutation.error.message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 9: Confirmation ── */}
        {step === 9 && provisionResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-6 w-6" /> Organisation Provisioned
              </CardTitle>
              <CardDescription>The enterprise has been successfully created. Share the details below with the administrator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Enterprise URL</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-background px-2 py-0.5 rounded border">{provisionResult.enterpriseUrl}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(provisionResult.enterpriseUrl); toast.success("Copied!"); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <ReviewRow label="Organisation ID" value={String(provisionResult.orgId)} />
                <ReviewRow label="Slug" value={provisionResult.slug} />
                <ReviewRow label="Provisioned at" value={new Date(provisionResult.provisionedAt).toLocaleString()} />
              </div>

              <ReviewSection title={`Deployed Twins (${provisionResult.twins.length})`}>
                {provisionResult.twins.length === 0
                  ? <p className="text-sm text-muted-foreground">No twins deployed</p>
                  : provisionResult.twins.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <span>{t.instanceSlug}</span>
                      <Badge variant="outline" className="text-xs">{t.status}</Badge>
                    </div>
                  ))
                }
              </ReviewSection>

              <ReviewSection title="Connector Status">
                {provisionResult.connectorPlaceholders.length === 0
                  ? <p className="text-sm text-muted-foreground">No connectors registered</p>
                  : provisionResult.connectorPlaceholders.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span>{c.name}</span>
                      <Badge variant="outline" className="text-xs text-amber-600">pending configuration</Badge>
                    </div>
                  ))
                }
              </ReviewSection>

              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium">Recommended next actions</p>
                <div className="space-y-1.5">
                  {[
                    "Log in as the enterprise administrator and verify access",
                    "Invite additional users from the Enterprise Dashboard",
                    "Configure data source connections (replace placeholders)",
                    "Run a test decision through each deployed Decision Twin",
                    "Review audit logs to confirm provisioning is recorded",
                  ].map((action, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{i + 1}.</span>
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => navigate("/admin/create-org")} variant="outline">
                  Create Another Organisation
                </Button>
                <Button onClick={() => navigate("/enterprise")}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Go to Enterprise Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        {step < 9 && (
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => step > 1 ? setStep(s => s - 1) : navigate("/admin/create-org")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Step {step} of 8</span>
              {step < 7 && (
                <Button variant="ghost" size="sm" onClick={() => setStep(s => s + 1)}>
                  Skip
                </Button>
              )}
              <Button
                onClick={() => step === 8 ? handleProvision() : setStep(s => s + 1)}
                disabled={!canProceed() || (step === 8 && provisionMutation.isPending)}
              >
                {step === 7 ? "Proceed to Provision" : step === 8 ? (
                  provisionMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Provisioning…</> : "Provision"
                ) : (
                  <><ChevronRight className="h-4 w-4 mr-1" /> Next</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b">
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="px-4 py-3 space-y-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
