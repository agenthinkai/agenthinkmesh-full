/**
 * ProspectModal — "Prepare for Prospect" dialog.
 * Opens from SADO Landing and Command Centre header.
 * Persists to localStorage via useProspectMode.
 */
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, UserCheck, X, Briefcase, Link2, Check } from "lucide-react";
import { type ProspectInfo } from "@/hooks/useProspectMode";

const QUICK_PICKS: Array<{ name: string; org: string }> = [
  { name: "STC",                   org: "Saudi Telecom Company" },
  { name: "ADNOC Digital",         org: "Abu Dhabi National Oil Company" },
  { name: "Kuwait Finance House",  org: "Kuwait Finance House" },
  { name: "Core42",                org: "Core42 (G42 Group)" },
  { name: "G42",                   org: "G42 Group" },
  { name: "Ministry of Health",    org: "Ministry of Health" },
];

interface ProspectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: ProspectInfo | null;
  onSave: (info: ProspectInfo) => void;
  onClear: () => void;
}

export default function ProspectModal({
  open, onOpenChange, current, onSave, onClear,
}: ProspectModalProps) {
  const [name, setName]         = useState(current?.prospectName ?? "");
  const [org, setOrg]           = useState(current?.organization ?? "");
  const [tagline, setTagline]   = useState(current?.tagline ?? "");
  const [linkCopied, setLinkCopied] = useState(false);

  function handleCopyLink() {
    const url = `${window.location.origin}/sado?prospect=${encodeURIComponent(name.trim())}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      // Fallback for browsers that block clipboard without HTTPS
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  // Sync form when modal opens with existing values
  useEffect(() => {
    if (open) {
      setName(current?.prospectName ?? "");
      setOrg(current?.organization ?? "");
      setTagline(current?.tagline ?? "");
    }
  }, [open, current]);

  function applyQuickPick(pick: { name: string; org: string }) {
    setName(pick.name);
    setOrg(pick.org);
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({ prospectName: name.trim(), organization: org.trim(), tagline: tagline.trim() });
    onOpenChange(false);
  }

  function handleClear() {
    onClear();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[oklch(0.12_0.03_255)] border-slate-700 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white text-base">
            <div className="w-7 h-7 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            </div>
            Prepare for Prospect
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Personalise the SADO demo experience. Prospect details appear in the
            Command Centre header, landing page, and PDF export. SADO branding
            remains primary.
          </p>
        </DialogHeader>

        {/* Quick picks */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400 uppercase tracking-wide">Quick-pick prospect</Label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PICKS.map(p => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyQuickPick(p)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  name === p.name
                    ? "border-blue-500 bg-blue-500/15 text-blue-300"
                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-blue-500/60 hover:text-blue-300"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="prospect-name" className="text-xs text-slate-400 flex items-center gap-1.5">
              <UserCheck className="w-3 h-3" /> Prospect Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="prospect-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. ADNOC Digital"
              className="bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm h-9"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prospect-org" className="text-xs text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> Organization
            </Label>
            <Input
              id="prospect-org"
              value={org}
              onChange={e => setOrg(e.target.value)}
              placeholder="e.g. Abu Dhabi National Oil Company"
              className="bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prospect-tagline" className="text-xs text-slate-400">
              Subtitle / Tagline override <span className="text-slate-600">(optional)</span>
            </Label>
            <Input
              id="prospect-tagline"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="e.g. Data Governance Readiness Assessment"
              className="bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm h-9"
            />
          </div>
        </div>

        {/* Preview pill */}
        {name.trim() && (
          <div className="space-y-2">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <div className="text-xs text-blue-300 leading-relaxed">
                Command Centre will show: <span className="font-medium text-blue-200">Prepared for {name.trim()}</span>
                {tagline.trim() && <span className="text-blue-400"> · {tagline.trim()}</span>}
              </div>
            </div>
            {/* Copy shareable link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-all ${
                linkCopied
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-600 bg-slate-800/60 text-slate-400 hover:border-blue-500/50 hover:text-blue-300 hover:bg-blue-500/5"
              }`}
            >
              {linkCopied ? (
                <><Check className="w-3 h-3" /> Copied!</>
              ) : (
                <><Link2 className="w-3 h-3" /> Copy shareable link</>
              )}
            </button>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-1">
          <div>
            {current && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 gap-1.5 px-2"
              >
                <X className="w-3 h-3" /> Clear Prospect Mode
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!name.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
            >
              <UserCheck className="w-3 h-3" /> Save & Activate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
