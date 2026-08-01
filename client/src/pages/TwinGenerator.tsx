/**
 * Twin Generator — 11-Step Admin Wizard
 * Allows an admin to create a new Decision Twin Blueprint without writing TypeScript.
 * Route: /admin/twin-generator
 */
import React, { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight, ChevronLeft, Check, Loader2, AlertCircle,
  Building2, Users, BookOpen, BarChart3, FileText, Cpu,
  Database, Layers, Palette, Settings, Rocket
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WizardState {
  // Step 1 — Identity
  blueprintId: string;
  name: string;
  industry: string;
  subIndustry: string;
  geography: string;
  description: string;
  // Step 2 — Council
  councilPersonaSetId: string;
  // Step 3 — Ontology
  ontologyId: string;
  // Step 4 — Decision Types
  selectedDecisionTypeIds: string[];
  // Step 5 — KPIs
  kpiSetId: string;
  // Step 6 — Simulation
  defaultSimulationMode: string;
  simulationPluginId: string;
  // Step 7 — Reports
  reportTypeIds: string[];
  // Step 8 — Data Connectors
  connectorIds: string[];
  // Step 9 — Branding
  primaryColor: string;
  accentColor: string;
  uiTheme: string;
  // Step 10 — Governance
  securityProfile: string;
  // Step 11 — Review (no extra fields)
}

const DEFAULT_STATE: WizardState = {
  blueprintId: "",
  name: "",
  industry: "",
  subIndustry: "",
  geography: "GCC",
  description: "",
  councilPersonaSetId: "",
  ontologyId: "",
  selectedDecisionTypeIds: [],
  kpiSetId: "",
  defaultSimulationMode: "institutional",
  simulationPluginId: "macro-stress",
  reportTypeIds: ["executive-brief"],
  connectorIds: ["manual-entry"],
  primaryColor: "#3b82f6",
  accentColor: "#f59e0b",
  uiTheme: "dark",
  securityProfile: "standard",
};

const STEPS = [
  { id: 1, title: "Identity", description: "Name, industry, geography", icon: Building2 },
  { id: 2, title: "Council", description: "Who deliberates", icon: Users },
  { id: 3, title: "Ontology", description: "Domain language", icon: BookOpen },
  { id: 4, title: "Decision Types", description: "What decisions to support", icon: Layers },
  { id: 5, title: "KPIs", description: "How to measure success", icon: BarChart3 },
  { id: 6, title: "Simulation", description: "Scenario engine", icon: Cpu },
  { id: 7, title: "Reports", description: "Output formats", icon: FileText },
  { id: 8, title: "Data Sources", description: "Connectors", icon: Database },
  { id: 9, title: "Branding", description: "Visual identity", icon: Palette },
  { id: 10, title: "Governance", description: "Security profile", icon: Settings },
  { id: 11, title: "Review & Create", description: "Confirm and launch", icon: Rocket },
];

const INDUSTRIES = [
  "banking", "insurance", "investment", "healthcare", "manufacturing",
  "telecom", "retail", "logistics", "energy", "real_estate",
  "defense", "government", "education", "hospitality", "legal",
];

const GEOGRAPHIES = ["GCC", "Saudi Arabia", "UAE", "Kuwait", "Qatar", "Bahrain", "Oman", "MENA", "Global"];

const SIMULATION_MODES = [
  { value: "institutional", label: "Institutional — Structured council deliberation" },
  { value: "adversarial", label: "Adversarial — Devil's advocate stress testing" },
  { value: "consensus", label: "Consensus — Convergence-seeking" },
  { value: "rapid", label: "Rapid — Fast single-pass" },
  { value: "deep", label: "Deep — Multi-round with calibration" },
];

const SECURITY_PROFILES = [
  { value: "standard", label: "Standard — Internal use" },
  { value: "confidential", label: "Confidential — Restricted access" },
  { value: "sovereign", label: "Sovereign — Air-gapped, CMK encrypted" },
  { value: "classified", label: "Classified — Defense/government" },
];

// ── Slug generator ─────────────────────────────────────────────────────────────
function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TwinGenerator() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: personaSets } = trpc.twinFactory.councilPersonas.listSets.useQuery();
  const { data: ontologies } = trpc.twinFactory.ontologies.list.useQuery();
  const { data: decisionTypes } = trpc.twinFactory.decisionTypes.list.useQuery();
  const { data: kpiSets } = trpc.twinFactory.kpis.listSets.useQuery();
  const { data: simPlugins } = trpc.twinFactory.simulations.list.useQuery();
  const { data: reportTypes } = trpc.twinFactory.reports.list.useQuery();
  const { data: connectors } = trpc.twinFactory.connectors.list.useQuery();

  // ── Mutation ──────────────────────────────────────────────────────────────
  const createBlueprint = trpc.twinFactory.blueprints.create.useMutation({
    onSuccess: () => setCreated(true),
    onError: (err) => setError(err.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const update = useCallback((patch: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const toggleItem = useCallback((field: keyof WizardState, value: string) => {
    setState(prev => {
      const arr = (prev[field] as string[]) ?? [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  }, []);

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!state.name && !!state.industry;
      case 2: return !!state.councilPersonaSetId;
      case 3: return !!state.ontologyId;
      case 4: return state.selectedDecisionTypeIds.length > 0;
      case 5: return !!state.kpiSetId;
      case 6: return !!state.defaultSimulationMode;
      case 7: return state.reportTypeIds.length > 0;
      case 8: return true;
      case 9: return !!state.primaryColor;
      case 10: return !!state.securityProfile;
      default: return true;
    }
  };

  const handleCreate = () => {
    setError(null);
    const blueprintId = state.blueprintId || toSlug(state.name);
    createBlueprint.mutate({
      blueprintId,
      name: state.name,
      industry: state.industry,
      subIndustry: state.subIndustry || undefined,
      geography: state.geography,
      description: state.description || undefined,
      defaultCouncilPersonaSetId: state.councilPersonaSetId || undefined,
      defaultKpiSetId: state.kpiSetId || undefined,
      defaultSimulationMode: state.defaultSimulationMode,
      defaultDecisionTypeId: state.selectedDecisionTypeIds[0] || undefined,
      brandingConfig: {
        primaryColor: state.primaryColor,
        accentColor: state.accentColor,
        uiTheme: state.uiTheme,
      },
      status: "ACTIVE",
    });
  };

  // ── Guard: admin only ─────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">Please log in to access the Twin Generator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="font-semibold mb-2">Admin Access Required</p>
            <p className="text-muted-foreground text-sm">The Twin Generator is only available to platform administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (created) {
    const blueprintId = state.blueprintId || toSlug(state.name);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="pt-10 pb-8">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Twin Blueprint Created</h2>
            <p className="text-muted-foreground mb-1">
              <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{blueprintId}</span>
            </p>
            <p className="text-muted-foreground text-sm mt-4 mb-8">
              <strong>{state.name}</strong> is now registered in the Twin Blueprint Registry.
              The simulation engine can use it immediately via the fallback-aware service layer.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setState(DEFAULT_STATE); setCreated(false); setStep(1); }}>
                Create Another
              </Button>
              <Button onClick={() => navigate("/admin")}>
                Back to Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepMeta = STEPS[step - 1];
  const StepIcon = currentStepMeta.icon;
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Decision Twin Generator</h1>
            <p className="text-sm text-muted-foreground">Create a new Twin Blueprint without writing code</p>
          </div>
          <Badge variant="outline" className="font-mono">
            Step {step} of {STEPS.length}
          </Badge>
        </div>
        <div className="max-w-5xl mx-auto px-6 pb-4">
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-4 gap-8">
        {/* Sidebar — step list */}
        <div className="col-span-1">
          <nav className="space-y-1">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isCompleted = s.id < step;
              const isCurrent = s.id === step;
              return (
                <button
                  key={s.id}
                  onClick={() => s.id < step && setStep(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm
                    ${isCurrent ? "bg-primary text-primary-foreground" : ""}
                    ${isCompleted ? "text-foreground hover:bg-muted cursor-pointer" : ""}
                    ${!isCurrent && !isCompleted ? "text-muted-foreground cursor-default" : ""}
                  `}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0
                    ${isCurrent ? "bg-primary-foreground/20" : ""}
                    ${isCompleted ? "bg-green-500/10" : ""}
                    ${!isCurrent && !isCompleted ? "bg-muted" : ""}
                  `}>
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.title}</div>
                    <div className={`text-xs truncate ${isCurrent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {s.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main content */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <StepIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{currentStepMeta.title}</CardTitle>
                  <CardDescription>{currentStepMeta.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* ── Step 1: Identity ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Twin Name *</label>
                      <Input
                        placeholder="e.g. Kuwait Banking Twin"
                        value={state.name}
                        onChange={e => {
                          update({ name: e.target.value, blueprintId: toSlug(e.target.value) });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Blueprint ID</label>
                      <Input
                        placeholder="auto-generated from name"
                        value={state.blueprintId}
                        onChange={e => update({ blueprintId: e.target.value })}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Industry *</label>
                      <Select value={state.industry} onValueChange={v => update({ industry: v, councilPersonaSetId: v, ontologyId: v, kpiSetId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map(i => (
                            <SelectItem key={i} value={i} className="capitalize">{i.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sub-Industry</label>
                      <Input
                        placeholder="e.g. Islamic Finance, Automotive"
                        value={state.subIndustry}
                        onChange={e => update({ subIndustry: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Geography</label>
                    <Select value={state.geography} onValueChange={v => update({ geography: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GEOGRAPHIES.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="Brief description of what decisions this twin supports..."
                      value={state.description}
                      onChange={e => update({ description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* ── Step 2: Council Personas ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose the council persona set that will deliberate on decisions for this twin.
                    Each set contains 3–6 expert personas with industry-specific expertise and bias profiles.
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {(personaSets ?? []).map((setId: string) => (
                      <button
                        key={setId}
                        onClick={() => update({ councilPersonaSetId: setId })}
                        className={`p-4 rounded-lg border text-left transition-colors
                          ${state.councilPersonaSetId === setId
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium capitalize">{setId.replace(/_/g, " ")} Council</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Industry-specific expert personas
                            </div>
                          </div>
                          {state.councilPersonaSetId === setId && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {state.industry && !personaSets?.includes(state.industry) && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
                      No pre-built council for "{state.industry}" — a generic council will be used.
                      You can create a custom council via the Council Registry.
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: Ontology ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select the domain ontology that defines the language, entities, and regulatory context
                    for this twin's LLM prompts.
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {(ontologies ?? []).map((o: any) => (
                      <button
                        key={o.ontologyId}
                        onClick={() => update({ ontologyId: o.ontologyId })}
                        className={`p-4 rounded-lg border text-left transition-colors
                          ${state.ontologyId === o.ontologyId
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{o.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {o.entities?.length ?? 0} entities · {o.relationships?.length ?? 0} relationships
                            </div>
                          </div>
                          {state.ontologyId === o.ontologyId && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 4: Decision Types ── */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select the decision types this twin will support. Each type defines the evaluation
                    framework and required input fields.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(decisionTypes ?? []).map((dt: any) => {
                      const selected = state.selectedDecisionTypeIds.includes(dt.decisionTypeId);
                      return (
                        <button
                          key={dt.decisionTypeId}
                          onClick={() => toggleItem("selectedDecisionTypeIds", dt.decisionTypeId)}
                          className={`p-3 rounded-lg border text-left transition-colors
                            ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-sm">{dt.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                                {dt.category}
                              </div>
                            </div>
                            {selected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {state.selectedDecisionTypeIds.length} selected
                  </p>
                </div>
              )}

              {/* ── Step 5: KPIs ── */}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose the KPI set that defines how decisions will be measured and calibrated.
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {(kpiSets ?? []).map((setId: string) => (
                      <button
                        key={setId}
                        onClick={() => update({ kpiSetId: setId })}
                        className={`p-4 rounded-lg border text-left transition-colors
                          ${state.kpiSetId === setId
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium capitalize">{setId.replace(/_/g, " ")} KPIs</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Industry-calibrated performance metrics
                            </div>
                          </div>
                          {state.kpiSetId === setId && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 6: Simulation ── */}
              {step === 6 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Deliberation Mode</label>
                    <div className="grid grid-cols-1 gap-2">
                      {SIMULATION_MODES.map(m => (
                        <button
                          key={m.value}
                          onClick={() => update({ defaultSimulationMode: m.value })}
                          className={`p-3 rounded-lg border text-left transition-colors
                            ${state.defaultSimulationMode === m.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm">{m.label}</div>
                            {state.defaultSimulationMode === m.value && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Simulation Plugin</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(simPlugins ?? []).map((p: any) => (
                        <button
                          key={p.pluginId}
                          onClick={() => update({ simulationPluginId: p.pluginId })}
                          className={`p-3 rounded-lg border text-left transition-colors
                            ${state.simulationPluginId === p.pluginId
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium">{p.name}</div>
                              <Badge variant="outline" className="text-xs mt-1 capitalize">{p.costTier}</Badge>
                            </div>
                            {state.simulationPluginId === p.pluginId && <Check className="w-4 h-4 text-primary shrink-0" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 7: Reports ── */}
              {step === 7 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select the report types this twin will generate after each decision session.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(reportTypes ?? []).map((rt: any) => {
                      const selected = state.reportTypeIds.includes(rt.reportTypeId);
                      return (
                        <button
                          key={rt.reportTypeId}
                          onClick={() => toggleItem("reportTypeIds", rt.reportTypeId)}
                          className={`p-3 rounded-lg border text-left transition-colors
                            ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-sm">{rt.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                                {rt.outputFormat} · {rt.category}
                              </div>
                            </div>
                            {selected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Step 8: Data Connectors ── */}
              {step === 8 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select data connectors to feed context into this twin's simulations.
                    Manual entry is always available.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(connectors ?? []).map((c: any) => {
                      const selected = state.connectorIds.includes(c.connectorId);
                      return (
                        <button
                          key={c.connectorId}
                          onClick={() => toggleItem("connectorIds", c.connectorId)}
                          className={`p-3 rounded-lg border text-left transition-colors
                            ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-sm">{c.name}</div>
                              <Badge variant="outline" className="text-xs mt-1 capitalize">{c.connectorType}</Badge>
                            </div>
                            {selected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Step 9: Branding ── */}
              {step === 9 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Primary Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={state.primaryColor}
                          onChange={e => update({ primaryColor: e.target.value })}
                          className="w-10 h-10 rounded cursor-pointer border"
                        />
                        <Input
                          value={state.primaryColor}
                          onChange={e => update({ primaryColor: e.target.value })}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Accent Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={state.accentColor}
                          onChange={e => update({ accentColor: e.target.value })}
                          className="w-10 h-10 rounded cursor-pointer border"
                        />
                        <Input
                          value={state.accentColor}
                          onChange={e => update({ accentColor: e.target.value })}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">UI Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      {["dark", "light", "system"].map(t => (
                        <button
                          key={t}
                          onClick={() => update({ uiTheme: t })}
                          className={`p-3 rounded-lg border text-sm capitalize transition-colors
                            ${state.uiTheme === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Preview swatch */}
                  <div className="p-4 rounded-lg border" style={{ background: state.uiTheme === "light" ? "#fff" : "#0f1117" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded" style={{ background: state.primaryColor }} />
                      <div>
                        <div className="font-medium text-sm" style={{ color: state.primaryColor }}>{state.name || "Twin Name"}</div>
                        <div className="text-xs" style={{ color: state.accentColor }}>{state.industry || "industry"} · {state.geography}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 10: Governance ── */}
              {step === 10 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose the security profile that governs data handling, encryption, and access control
                    for this twin.
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {SECURITY_PROFILES.map(sp => (
                      <button
                        key={sp.value}
                        onClick={() => update({ securityProfile: sp.value })}
                        className={`p-4 rounded-lg border text-left transition-colors
                          ${state.securityProfile === sp.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{sp.label.split(" — ")[0]}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {sp.label.split(" — ")[1]}
                            </div>
                          </div>
                          {state.securityProfile === sp.value && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 11: Review ── */}
              {step === 11 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      ["Blueprint ID", state.blueprintId || toSlug(state.name)],
                      ["Name", state.name],
                      ["Industry", state.industry],
                      ["Sub-Industry", state.subIndustry || "—"],
                      ["Geography", state.geography],
                      ["Council", state.councilPersonaSetId || "—"],
                      ["Ontology", state.ontologyId || "—"],
                      ["Decision Types", state.selectedDecisionTypeIds.length.toString()],
                      ["KPI Set", state.kpiSetId || "—"],
                      ["Simulation Mode", state.defaultSimulationMode],
                      ["Security Profile", state.securityProfile],
                      ["Report Types", state.reportTypeIds.length.toString()],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium font-mono text-xs">{value}</span>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleCreate}
                      disabled={createBlueprint.isPending}
                    >
                      {createBlueprint.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Blueprint...</>
                      ) : (
                        <><Rocket className="w-4 h-4 mr-2" /> Create Decision Twin Blueprint</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step < 11 && (
              <Button
                onClick={() => setStep(s => Math.min(11, s + 1))}
                disabled={!canProceed()}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
