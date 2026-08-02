/**
 * OrgCreationWizard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Platform admin wizard to create a new organisation without engineering help.
 * Steps:
 *   1. Organisation Details (name, slug, plan)
 *   2. Token Quota & Approved Domains
 *   3. Review & Confirm
 *   4. Success — copy org ID, proceed to add users
 *
 * Uses adminProcedure on the server — only role=admin users can access.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Building2, Shield, Settings, ChevronRight, ChevronLeft, Plus, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrgFormData {
  name: string;
  slug: string;
  plan: "trial" | "standard" | "enterprise";
  approvedDomains: string[];
  dailyTokenLimit: number;
}

const DEFAULT_FORM: OrgFormData = {
  name: "",
  slug: "",
  plan: "trial",
  approvedDomains: [],
  dailyTokenLimit: 50000,
};

const PLAN_LIMITS: Record<string, number> = {
  trial: 50000,
  standard: 200000,
  enterprise: 1000000,
};

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial — 50K tokens/day",
  standard: "Standard — 200K tokens/day",
  enterprise: "Enterprise — 1M tokens/day",
};

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step, current }: { step: number; current: number }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 transition-colors ${
      done ? "bg-green-600 border-green-600 text-white" :
      active ? "bg-blue-600 border-blue-600 text-white" :
      "bg-transparent border-zinc-600 text-zinc-400"
    }`}>
      {done ? <CheckCircle className="w-4 h-4" /> : step}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrgCreationWizard() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OrgFormData>(DEFAULT_FORM);
  const [domainInput, setDomainInput] = useState("");
  const [createdOrg, setCreatedOrg] = useState<{ id: number; name: string; slug: string } | null>(null);

  const createOrgMutation = trpc.enterprise.createOrganization.useMutation({
    onSuccess: (data) => {
      setCreatedOrg(data);
      setStep(4);
      toast.success(`Organisation "${data.name}" created successfully`);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create organisation");
    },
  });

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setForm(f => ({ ...f, name, slug }));
  };

  const handlePlanChange = (plan: "trial" | "standard" | "enterprise") => {
    setForm(f => ({ ...f, plan, dailyTokenLimit: PLAN_LIMITS[plan] }));
  };

  const addDomain = () => {
    const d = domainInput.trim().toLowerCase();
    if (!d) return;
    if (!d.startsWith("@")) {
      toast.error("Domain must start with @ (e.g. @company.com)");
      return;
    }
    if (form.approvedDomains.includes(d)) {
      toast.error("Domain already added");
      return;
    }
    setForm(f => ({ ...f, approvedDomains: [...f.approvedDomains, d] }));
    setDomainInput("");
  };

  const removeDomain = (d: string) => {
    setForm(f => ({ ...f, approvedDomains: f.approvedDomains.filter(x => x !== d) }));
  };

  const canProceedStep1 = form.name.trim().length >= 2 && /^[a-z0-9-]+$/.test(form.slug) && form.slug.length >= 2;
  const canProceedStep2 = form.dailyTokenLimit >= 1000;

  const handleSubmit = () => {
    createOrgMutation.mutate({
      name: form.name.trim(),
      slug: form.slug.trim(),
      plan: form.plan,
      approvedDomains: form.approvedDomains,
      dailyTokenLimit: form.dailyTokenLimit,
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-start pt-12 px-4">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="w-7 h-7 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Create Organisation</h1>
        </div>
        <p className="text-zinc-400 text-sm">
          Provision a new enterprise organisation on the Mesh platform. This wizard takes 2 minutes.
        </p>
      </div>

      {/* Step Indicator */}
      {step < 4 && (
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <StepIndicator step={s} current={step} />
                {s < 3 && <div className={`h-0.5 w-16 ${step > s ? "bg-green-600" : "bg-zinc-700"}`} />}
              </div>
            ))}
            <div className="ml-4 text-sm text-zinc-400">
              {step === 1 && "Organisation Details"}
              {step === 2 && "Quota & Domains"}
              {step === 3 && "Review & Confirm"}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Organisation Details */}
      {step === 1 && (
        <Card className="w-full max-w-2xl bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Organisation Details
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Basic identity information for the organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-zinc-300">Organisation Name *</Label>
              <Input
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Alghanim Industries"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Slug (URL identifier) *</Label>
              <Input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                placeholder="e.g. alghanim"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
              />
              <p className="text-xs text-zinc-500">Lowercase letters, numbers, and hyphens only. Cannot be changed later.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Plan *</Label>
              <Select value={form.plan} onValueChange={v => handlePlanChange(v as any)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {Object.entries(PLAN_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-zinc-200 focus:bg-zinc-700">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Quota & Domains */}
      {step === 2 && (
        <Card className="w-full max-w-2xl bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              Quota & Approved Domains
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Configure token limits and email domain restrictions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-zinc-300">Daily Token Limit</Label>
              <Input
                type="number"
                value={form.dailyTokenLimit}
                onChange={e => setForm(f => ({ ...f, dailyTokenLimit: parseInt(e.target.value) || 50000 }))}
                min={1000}
                max={10000000}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <p className="text-xs text-zinc-500">
                Recommended: {PLAN_LIMITS[form.plan].toLocaleString()} tokens/day for {form.plan} plan.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Approved Email Domains (optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addDomain()}
                  placeholder="@company.com"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
                />
                <Button onClick={addDomain} variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-700">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {form.approvedDomains.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {form.approvedDomains.map(d => (
                    <Badge key={d} variant="secondary" className="bg-zinc-700 text-zinc-200 gap-1">
                      {d}
                      <button onClick={() => removeDomain(d)} className="ml-1 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Leave empty to allow any email domain. Add domains to restrict access.
              </p>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} className="text-zinc-400 hover:text-white">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Review <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card className="w-full max-w-2xl bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Review & Confirm
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Confirm the details before creating the organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
              <ReviewRow label="Name" value={form.name} />
              <ReviewRow label="Slug" value={form.slug} mono />
              <ReviewRow label="Plan" value={PLAN_LABELS[form.plan]} />
              <ReviewRow label="Daily Token Limit" value={form.dailyTokenLimit.toLocaleString()} />
              <ReviewRow
                label="Approved Domains"
                value={form.approvedDomains.length > 0 ? form.approvedDomains.join(", ") : "Any domain allowed"}
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)} className="text-zinc-400 hover:text-white">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createOrgMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
              >
                {createOrgMutation.isPending ? "Creating..." : "Create Organisation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 4 && createdOrg && (
        <Card className="w-full max-w-2xl bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              Organisation Created
            </CardTitle>
            <CardDescription className="text-zinc-400">
              <span className="font-semibold text-green-400">{createdOrg.name}</span> is now provisioned on the Mesh platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
              <ReviewRow label="Organisation ID" value={String(createdOrg.id)} mono />
              <ReviewRow label="Slug" value={createdOrg.slug} mono />
              <ReviewRow label="Name" value={createdOrg.name} />
            </div>
            <div className="bg-blue-950/40 border border-blue-800 rounded-lg p-4 text-sm text-blue-300">
              <p className="font-semibold mb-1">Next Steps</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-200">
                <li>Add the organisation admin as a member via the Enterprise Dashboard</li>
                <li>Create departments and roles</li>
                <li>Deploy Decision Twins via the Twin Factory</li>
                <li>Invite end users</li>
              </ol>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => navigate("/admin/enterprise")}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Enterprise Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => { setForm(DEFAULT_FORM); setCreatedOrg(null); setStep(1); }}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-zinc-400 text-sm shrink-0">{label}</span>
      <span className={`text-zinc-100 text-sm text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
