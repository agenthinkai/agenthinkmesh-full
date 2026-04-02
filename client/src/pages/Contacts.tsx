/**
 * Contacts.tsx — ARE Phase 1 & 2 (Enhanced)
 *
 * Features:
 *  - Contact list table + Pipeline Kanban view (toggle)
 *  - Add / Edit contact form: name, company, role, region, phone, email, LinkedIn
 *  - Status badge with update
 *  - Generate Message panel (Outreach Agent — WhatsApp optimised)
 *  - Open WhatsApp button (wa.me link)
 *  - Copy WhatsApp Message button
 *  - Message Style Examples (few-shot calibration)
 *  - Interaction log with outcome tracking
 */

import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContactStatus = "new" | "contacted" | "active" | "closed";
type OutcomeType = "no_response" | "response" | "converted";
type GoalType = "follow_up" | "conversion" | "engagement";
type ViewMode = "table" | "pipeline";

interface CsvRow {
  rowIndex: number;
  name: string;
  company?: string;
  phone_number?: string;
  email?: string;
  linkedin_url?: string;
  role?: string;
  // preview-only fields
  _isDuplicate?: boolean;
  _errors?: string[];
}

interface ImportResult {
  rowIndex: number;
  status: "imported" | "duplicate" | "error";
  name?: string;
  company?: string;
  error?: string;
}

interface Contact {
  id: number;
  name: string;
  company?: string | null;
  role?: string | null;
  region?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  lastContacted?: Date | string | null;
  status: ContactStatus;
  notes?: string | null;
  createdAt: Date | string;
}

interface Interaction {
  id: number;
  action: string;
  messageText?: string | null;
  outcome?: OutcomeType | null;
  createdAt: Date | string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ContactStatus, string> = {
  new: "bg-slate-700 text-slate-200",
  contacted: "bg-blue-900 text-blue-200",
  active: "bg-emerald-900 text-emerald-200",
  closed: "bg-zinc-800 text-zinc-400",
};

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  contacted: "Contacted",
  active: "Active",
  closed: "Closed",
};

const GOAL_LABELS: Record<GoalType, string> = {
  follow_up: "Follow-up",
  conversion: "Conversion",
  engagement: "Re-engagement",
};

const OUTCOME_LABELS: Record<OutcomeType, string> = {
  no_response: "No Response",
  response: "Responded",
  converted: "Converted",
};

const OUTCOME_COLORS: Record<OutcomeType, string> = {
  no_response: "bg-zinc-800 text-zinc-400",
  response: "bg-blue-900 text-blue-200",
  converted: "bg-emerald-900 text-emerald-200",
};

// ── CSV Import Dialog ────────────────────────────────────────────────────────

function parseCsvText(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/["']/g, ""));
  return lines.slice(1).map((line, i) => {
    // Handle quoted fields
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());
    const row: CsvRow = { rowIndex: i, name: "" };
    headers.forEach((h, idx) => {
      const v = values[idx] ?? "";
      if (h === "name") row.name = v;
      else if (h === "company") row.company = v || undefined;
      else if (h === "phone_number" || h === "phone") row.phone_number = v || undefined;
      else if (h === "email") row.email = v || undefined;
      else if (h === "linkedin_url" || h === "linkedin") row.linkedin_url = v || undefined;
      else if (h === "role") row.role = v || undefined;
    });
    return row;
  }).filter((r) => r.name.trim().length > 0);
}

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  existingContacts: Contact[];
}

function CsvImportDialog({ open, onClose, onImported, existingContacts }: CsvImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importDuplicates, setImportDuplicates] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const utils = trpc.useUtils();

  const existingKeys = useMemo(() => new Set(
    existingContacts.map((c) => `${c.name.toLowerCase().trim()}|${(c.company ?? "").toLowerCase().trim()}`)
  ), [existingContacts]);

  const importMutation = trpc.contacts.importCsv.useMutation({
    onSuccess: (data) => {
      setImportResults(data.results);
      setStep("done");
      utils.contacts.list.invalidate();
      utils.contacts.getSummary.invalidate();
      onImported();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsvText(text);
      if (parsed.length === 0) { toast.error("No valid rows found. Ensure the CSV has a 'name' column."); return; }
      // Flag duplicates
      const flagged = parsed.map((r) => ({
        ...r,
        _isDuplicate: existingKeys.has(`${r.name.toLowerCase().trim()}|${(r.company ?? "").toLowerCase().trim()}`),
        _errors: !r.name.trim() ? ["Name is required"] : [],
      }));
      setRows(flagged);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const toImport = rows.filter((r) => !r._errors?.length && (importDuplicates || !r._isDuplicate));
    if (toImport.length === 0) { toast.error("No valid rows to import"); return; }
    importMutation.mutate({
      rows: toImport.map((r) => ({ name: r.name, company: r.company, phone_number: r.phone_number, email: r.email, linkedin_url: r.linkedin_url, role: r.role })),
      importDuplicates,
    });
  };

  const handleClose = () => {
    setRows([]); setImportResults(null); setStep("upload"); setImportDuplicates(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const validRows = rows.filter((r) => !r._errors?.length);
  const dupRows = rows.filter((r) => r._isDuplicate && !r._errors?.length);
  const errorRows = rows.filter((r) => r._errors?.length);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Import Contacts from CSV</DialogTitle>
          <p className="text-sm text-zinc-400 mt-1">
            Upload a CSV with columns: <code className="text-amber-400 text-xs">name, company, phone_number, email, linkedin_url, role</code>. Only <code className="text-amber-400 text-xs">name</code> is required.
          </p>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-2xl">↑</div>
            <p className="text-sm text-zinc-400">Select a CSV file to begin</p>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              Choose CSV File
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex gap-3 flex-wrap">
              <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">{rows.length} rows parsed</span>
              <span className="text-xs px-2 py-1 rounded bg-emerald-900 text-emerald-200">{validRows.length - dupRows.length} new</span>
              {dupRows.length > 0 && <span className="text-xs px-2 py-1 rounded bg-yellow-900 text-yellow-200">{dupRows.length} duplicates</span>}
              {errorRows.length > 0 && <span className="text-xs px-2 py-1 rounded bg-red-900 text-red-200">{errorRows.length} errors</span>}
            </div>

            {/* Duplicate option */}
            {dupRows.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={importDuplicates} onChange={(e) => setImportDuplicates(e.target.checked)} className="accent-amber-500" />
                Import duplicates anyway ({dupRows.length} contacts)
              </label>
            )}

            {/* Row preview table */}
            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-700 bg-zinc-800">
                    <th className="text-left px-3 py-2 text-zinc-400">#</th>
                    <th className="text-left px-3 py-2 text-zinc-400">Name</th>
                    <th className="text-left px-3 py-2 text-zinc-400">Company</th>
                    <th className="text-left px-3 py-2 text-zinc-400">Phone</th>
                    <th className="text-left px-3 py-2 text-zinc-400">Email</th>
                    <th className="text-left px-3 py-2 text-zinc-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowIndex} className={`border-b border-zinc-800 ${
                      row._errors?.length ? "bg-red-950/30" : row._isDuplicate ? "bg-yellow-950/20" : ""
                    }`}>
                      <td className="px-3 py-2 text-zinc-600">{row.rowIndex + 1}</td>
                      <td className="px-3 py-2 text-zinc-200 font-medium">{row.name || <span className="text-red-400">—</span>}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.company || "—"}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.phone_number || "—"}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.email || "—"}</td>
                      <td className="px-3 py-2">
                        {row._errors?.length ? (
                          <span className="text-red-400 text-xs">{row._errors.join("; ")}</span>
                        ) : row._isDuplicate ? (
                          <span className="bg-yellow-900 text-yellow-200 px-1.5 py-0.5 rounded text-xs">Duplicate</span>
                        ) : (
                          <span className="bg-emerald-900 text-emerald-200 px-1.5 py-0.5 rounded text-xs">New</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === "done" && importResults && (
          <div className="space-y-4 py-4">
            <div className="flex gap-3 flex-wrap">
              <span className="text-xs px-2 py-1 rounded bg-emerald-900 text-emerald-200">{importResults.filter((r) => r.status === "imported").length} imported</span>
              <span className="text-xs px-2 py-1 rounded bg-yellow-900 text-yellow-200">{importResults.filter((r) => r.status === "duplicate").length} skipped (duplicates)</span>
              {importResults.filter((r) => r.status === "error").length > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-red-900 text-red-200">{importResults.filter((r) => r.status === "error").length} errors</span>
              )}
            </div>
            <p className="text-sm text-zinc-400">Import complete. Your contacts list has been updated.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="text-zinc-400 hover:text-zinc-100">Close</Button>
          {step === "preview" && (
            <Button
              onClick={handleImport}
              disabled={importMutation.isPending || (validRows.length - (importDuplicates ? 0 : dupRows.length)) === 0}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              {importMutation.isPending ? "Importing..." : `Import ${validRows.length - (importDuplicates ? 0 : dupRows.length)} Contacts`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Strip leading + from phone number for wa.me URL */
function buildWhatsAppUrl(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}`;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyContacts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 text-2xl">◎</div>
      <h3 className="text-lg font-semibold text-zinc-200 mb-2">No contacts yet</h3>
      <p className="text-sm text-zinc-500 max-w-xs mb-6">
        Add your first contact to start generating outreach messages and tracking interactions.
      </p>
      <Button onClick={onAdd} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
        Add First Contact
      </Button>
    </div>
  );
}

// ── Contact Form Dialog ───────────────────────────────────────────────────────

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  contact?: Contact | null;
  onSaved: () => void;
}

function ContactForm({ open, onClose, contact, onSaved }: ContactFormProps) {
  const isEdit = !!contact;
  const [form, setForm] = useState({
    name: contact?.name ?? "",
    company: contact?.company ?? "",
    role: contact?.role ?? "",
    region: contact?.region ?? "",
    status: (contact?.status ?? "new") as ContactStatus,
    notes: contact?.notes ?? "",
    phoneNumber: contact?.phoneNumber ?? "",
    email: contact?.email ?? "",
    linkedinUrl: contact?.linkedinUrl ?? "",
  });

  const utils = trpc.useUtils();

  useMemo(() => {
    setForm({
      name: contact?.name ?? "",
      company: contact?.company ?? "",
      role: contact?.role ?? "",
      region: contact?.region ?? "",
      status: (contact?.status ?? "new") as ContactStatus,
      notes: contact?.notes ?? "",
      phoneNumber: contact?.phoneNumber ?? "",
      email: contact?.email ?? "",
      linkedinUrl: contact?.linkedinUrl ?? "",
    });
  }, [contact]);

  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => { toast.success("Contact added"); utils.contacts.list.invalidate(); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => { toast.success("Contact updated"); utils.contacts.list.invalidate(); if (contact) utils.contacts.get.invalidate({ id: contact.id }); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      role: form.role.trim() || undefined,
      region: form.region.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
      phoneNumber: form.phoneNumber.trim() || undefined,
      email: form.email.trim() || undefined,
      linkedinUrl: form.linkedinUrl.trim() || undefined,
    };
    if (isEdit && contact) {
      updateMutation.mutate({ id: contact.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const field = (key: keyof typeof form, label: string, placeholder: string, type = "text") => (
    <div>
      <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
      <Input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="bg-zinc-800 border-zinc-700 text-zinc-100"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">{isEdit ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {field("name", "Name *", "Full name")}
          <div className="grid grid-cols-2 gap-3">
            {field("company", "Company", "Firm / organisation")}
            {field("role", "Role", "Title / position")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("region", "Region", "Kuwait / GCC / London")}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ContactStatus }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {(["new", "contacted", "active", "closed"] as ContactStatus[]).map((s) => (
                    <SelectItem key={s} value={s} className="text-zinc-100">{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact details */}
          <div className="border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500 mb-3 font-medium uppercase tracking-wider">Contact Details</p>
            {field("phoneNumber", "Phone Number", "+96512345678 (international format)")}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {field("email", "Email", "name@company.com", "email")}
              {field("linkedinUrl", "LinkedIn URL", "https://linkedin.com/in/...")}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Notes</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Context, background, last conversation topic..."
              rows={3}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-zinc-100">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Generate Message Panel ────────────────────────────────────────────────────

interface GenerateMessagePanelProps {
  contact: Contact;
}

function GenerateMessagePanel({ contact }: GenerateMessagePanelProps) {
  const [goal, setGoal] = useState<GoalType>("follow_up");
  const [context, setContext] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [logAction, setLogAction] = useState("");
  const [showLogForm, setShowLogForm] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<{ subject: string; body: string; mailtoUrl: string } | null>(null);
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);

  const utils = trpc.useUtils();

  const generateMutation = trpc.contacts.generateMessage.useMutation({
    onSuccess: (data) => {
      setGeneratedMessage(data.message);
      setWordCount(data.wordCount);
      setLogAction(`Generated ${GOAL_LABELS[goal]} message`);
      utils.contacts.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const emailMutation = trpc.contacts.generateEmailTemplate.useMutation({
    onSuccess: (data) => {
      setEmailTemplate({ subject: data.subject, body: data.body, mailtoUrl: data.mailtoUrl });
      setShowEmailTemplate(true);
      utils.contacts.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const logMutation = trpc.contacts.logInteraction.useMutation({
    onSuccess: () => {
      toast.success("Interaction logged");
      utils.contacts.get.invalidate({ id: contact.id });
      utils.contacts.list.invalidate();
      setShowLogForm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMessage);
    toast.success("Message copied");
  };

  const handleOpenWhatsApp = () => {
    if (!contact.phoneNumber) return toast.error("No phone number on this contact");
    window.open(buildWhatsAppUrl(contact.phoneNumber), "_blank");
  };

  const handleLogSend = () => {
    if (!logAction.trim()) return toast.error("Action description required");
    logMutation.mutate({
      contactId: contact.id,
      action: logAction,
      messageText: generatedMessage.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Goal selector */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Goal</label>
        <div className="flex gap-2 flex-wrap">
          {(["follow_up", "conversion", "engagement"] as GoalType[]).map((g) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${goal === g ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
            >
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Additional Context <span className="text-zinc-600">(optional)</span></label>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. We met at the Gulf Capital Summit last week. He mentioned interest in healthcare deals."
          rows={2}
          className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm resize-none"
        />
      </div>

      <Button
        onClick={() => generateMutation.mutate({ contactId: contact.id, goal, context: context.trim() || undefined })}
        disabled={generateMutation.isPending}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
      >
        {generateMutation.isPending ? "Generating..." : "Generate WhatsApp Message"}
      </Button>

      {/* Generated message output */}
      {generatedMessage && (
        <div className="space-y-3">
          <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500">{wordCount} words</span>
              <div className="flex items-center gap-3">
                <button onClick={handleCopy} className="text-xs text-amber-400 hover:text-amber-300 font-medium">
                  Copy Message
                </button>
                {contact.phoneNumber && (
                  <button
                    onClick={handleOpenWhatsApp}
                    className="text-xs text-green-400 hover:text-green-300 font-medium"
                  >
                    Open WhatsApp
                  </button>
                )}
              </div>
            </div>
            <Textarea
              value={generatedMessage}
              onChange={(e) => setGeneratedMessage(e.target.value)}
              rows={6}
              className="bg-transparent border-none text-zinc-200 text-sm resize-none p-0 focus-visible:ring-0"
            />
          </div>

          {/* Action bar: WhatsApp + Email */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="flex-1 border-zinc-700 text-zinc-300 hover:text-zinc-100 bg-transparent text-xs"
            >
              Copy
            </Button>
            {contact.phoneNumber && (
              <Button
                onClick={handleOpenWhatsApp}
                size="sm"
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold"
              >
                WhatsApp →
              </Button>
            )}
            {contact.email && (
              <Button
                onClick={() => emailMutation.mutate({ contactId: contact.id, goal, context: context.trim() || undefined })}
                disabled={emailMutation.isPending}
                size="sm"
                className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold"
              >
                {emailMutation.isPending ? "Generating..." : "Email →"}
              </Button>
            )}
          </div>

          {!contact.phoneNumber && !contact.email && (
            <p className="text-xs text-zinc-600 text-center">
              Add a phone number or email to enable send actions
            </p>
          )}

          {/* Email template output */}
          {showEmailTemplate && emailTemplate && (
            <div className="bg-zinc-800/60 rounded-lg p-4 border border-blue-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-400 font-medium">Email Template</span>
                <button onClick={() => setShowEmailTemplate(false)} className="text-zinc-600 hover:text-zinc-400 text-xs">Dismiss</button>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Subject</p>
                <p className="text-sm text-zinc-200 font-medium">{emailTemplate.subject}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Body</p>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{emailTemplate.body}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => { navigator.clipboard.writeText(`Subject: ${emailTemplate.subject}\n\n${emailTemplate.body}`); toast.success("Email copied"); }}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-zinc-700 text-zinc-300 hover:text-zinc-100 bg-transparent text-xs"
                >
                  Copy Email
                </Button>
                <Button
                  onClick={() => window.open(emailTemplate.mailtoUrl, "_blank")}
                  size="sm"
                  className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold"
                >
                  Open in Email Client →
                </Button>
              </div>
            </div>
          )}

          {!showLogForm ? (
            <Button
              variant="outline"
              onClick={() => setShowLogForm(true)}
              className="w-full border-zinc-700 text-zinc-300 hover:text-zinc-100 bg-transparent text-sm"
            >
              Log as Sent
            </Button>
          ) : (
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700 space-y-3">
              <p className="text-xs text-zinc-400 font-medium">Log this interaction</p>
              <Input
                value={logAction}
                onChange={(e) => setLogAction(e.target.value)}
                placeholder="Sent via WhatsApp / Sent via email"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleLogSend} disabled={logMutation.isPending} size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                  {logMutation.isPending ? "Logging..." : "Log It"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowLogForm(false)} className="text-zinc-500 hover:text-zinc-300">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Interaction Log ───────────────────────────────────────────────────────────

function InteractionLog({ contactId }: { contactId: number }) {
  const { data: contactData } = trpc.contacts.get.useQuery({ id: contactId });
  const utils = trpc.useUtils();

  const updateOutcomeMutation = trpc.contacts.updateOutcome.useMutation({
    onSuccess: () => { toast.success("Outcome updated"); utils.contacts.get.invalidate({ id: contactId }); utils.contacts.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const interactions: Interaction[] = contactData?.interactions ?? [];

  if (interactions.length === 0) {
    return <p className="text-sm text-zinc-600 italic">No interactions logged yet.</p>;
  }

  return (
    <div className="space-y-3">
      {interactions.map((interaction) => (
        <div key={interaction.id} className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/50">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-300 font-medium">{interaction.action}</p>
              {interaction.messageText && (
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{interaction.messageText}</p>
              )}
              <p className="text-xs text-zinc-600 mt-1">
                {formatDistanceToNow(new Date(interaction.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex-shrink-0">
              {interaction.outcome ? (
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${OUTCOME_COLORS[interaction.outcome]}`}>
                  {OUTCOME_LABELS[interaction.outcome]}
                </span>
              ) : (
                <Select onValueChange={(v) => updateOutcomeMutation.mutate({ interactionId: interaction.id, outcome: v as OutcomeType })}>
                  <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-400 w-32">
                    <SelectValue placeholder="Set outcome" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {(["no_response", "response", "converted"] as OutcomeType[]).map((o) => (
                      <SelectItem key={o} value={o} className="text-zinc-200 text-xs">{OUTCOME_LABELS[o]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Style Examples Dialog ─────────────────────────────────────────────────────

function StyleExamplesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: existingExamples } = trpc.contacts.getStyleExamples.useQuery();
  const [examples, setExamples] = useState<{ text: string; label: string }[]>([{ text: "", label: "" }]);
  const utils = trpc.useUtils();

  useMemo(() => {
    if (existingExamples && existingExamples.length > 0) {
      setExamples(existingExamples.map((e) => ({ text: e.exampleText, label: e.label ?? "" })));
    }
  }, [existingExamples]);

  const saveMutation = trpc.contacts.saveStyleExamples.useMutation({
    onSuccess: (data) => { toast.success(`${data.count} style example${data.count !== 1 ? "s" : ""} saved`); utils.contacts.getStyleExamples.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const valid = examples.filter((e) => e.text.trim().length >= 10);
    if (valid.length === 0) return toast.error("Add at least one example (min 10 characters)");
    saveMutation.mutate({ examples: valid.map((e) => ({ exampleText: e.text.trim(), label: e.label.trim() || undefined })) });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Message Style Examples</DialogTitle>
          <p className="text-sm text-zinc-400 mt-1">
            Paste 2–3 real WhatsApp messages you have written. The Outreach Agent will match your exact tone.
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {examples.map((ex, i) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400 font-medium">Example {i + 1}</label>
                {examples.length > 1 && (
                  <button onClick={() => setExamples((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-zinc-600 hover:text-red-400">Remove</button>
                )}
              </div>
              <Input
                value={ex.label}
                onChange={(e) => setExamples((prev) => prev.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item))}
                placeholder="Label (optional): follow-up, intro, re-engagement"
                className="bg-zinc-900 border-zinc-700 text-zinc-300 text-xs h-8"
              />
              <Textarea
                value={ex.text}
                onChange={(e) => setExamples((prev) => prev.map((item, idx) => idx === i ? { ...item, text: e.target.value } : item))}
                placeholder="Paste a real WhatsApp message you wrote here..."
                rows={4}
                className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm resize-none"
              />
            </div>
          ))}
          {examples.length < 5 && (
            <Button variant="ghost" onClick={() => setExamples((prev) => [...prev, { text: "", label: "" }])} className="text-zinc-500 hover:text-zinc-300 text-sm">
              + Add another example
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-zinc-100">Cancel</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            {saveMutation.isPending ? "Saving..." : "Save Examples"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Contact Detail Panel ──────────────────────────────────────────────────────

interface ContactDetailPanelProps {
  contact: Contact;
  onEdit: () => void;
  onClose: () => void;
  onDelete: () => void;
}

function ContactDetailPanel({ contact, onEdit, onClose, onDelete }: ContactDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"message" | "history">("message");

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-900 border-l border-zinc-700 shadow-2xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{contact.name}</h2>
          <p className="text-sm text-zinc-400">{[contact.role, contact.company].filter(Boolean).join(" · ")}</p>
          {contact.region && <p className="text-xs text-zinc-600 mt-0.5">{contact.region}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800">Edit</button>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none px-1">×</button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[contact.status]}`}>
          {STATUS_LABELS[contact.status]}
        </span>
        {contact.lastContacted && (
          <span className="text-xs text-zinc-600">
            Last contact: {formatDistanceToNow(new Date(contact.lastContacted), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Contact details row */}
      {(contact.phoneNumber || contact.email || contact.linkedinUrl) && (
        <div className="px-5 py-3 border-b border-zinc-800 space-y-1.5">
          {contact.phoneNumber && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 w-16">Phone</span>
              <a
                href={buildWhatsAppUrl(contact.phoneNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-400 hover:text-green-300 font-medium"
              >
                {contact.phoneNumber}
              </a>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 w-16">Email</span>
              <a href={`mailto:${contact.email}`} className="text-xs text-blue-400 hover:text-blue-300">{contact.email}</a>
            </div>
          )}
          {contact.linkedinUrl && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 w-16">LinkedIn</span>
              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[220px]">
                {contact.linkedinUrl.replace("https://", "").replace("www.", "")}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {contact.notes && (
        <div className="px-5 py-3 border-b border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1">Notes</p>
          <p className="text-sm text-zinc-300">{contact.notes}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {(["message", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === tab ? "text-amber-400 border-b-2 border-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {tab === "message" ? "Generate Message" : "Interaction History"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "message" ? <GenerateMessagePanel contact={contact} /> : <InteractionLog contactId={contact.id} />}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800">
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-400">Delete contact</button>
      </div>
    </div>
  );
}

// ── Pipeline View ─────────────────────────────────────────────────────────────

const PIPELINE_COLUMNS: ContactStatus[] = ["new", "contacted", "active", "closed"];

interface PipelineViewProps {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
  onStatusChange: (id: number, status: ContactStatus) => void;
}

function PipelineView({ contacts, onSelectContact, onStatusChange }: PipelineViewProps) {
  const grouped = useMemo(() => {
    const map: Record<ContactStatus, Contact[]> = { new: [], contacted: [], active: [], closed: [] };
    for (const c of contacts) map[c.status as ContactStatus].push(c);
    return map;
  }, [contacts]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {PIPELINE_COLUMNS.map((col) => (
        <div key={col} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          {/* Column header */}
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[col]}`}>
              {STATUS_LABELS[col]}
            </span>
            <span className="text-xs text-zinc-600">{grouped[col].length}</span>
          </div>

          {/* Cards */}
          <div className="p-3 space-y-2 min-h-[120px]">
            {grouped[col].length === 0 && (
              <p className="text-xs text-zinc-700 text-center pt-4">Empty</p>
            )}
            {grouped[col].map((contact) => (
              <div
                key={contact.id}
                className="bg-zinc-800 rounded-lg p-3 border border-zinc-700/50 cursor-pointer hover:border-zinc-600 transition-colors group"
                onClick={() => onSelectContact(contact)}
              >
                <p className="text-sm font-medium text-zinc-200 truncate">{contact.name}</p>
                {contact.company && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{contact.company}</p>
                )}
                {contact.lastContacted && (
                  <p className="text-xs text-zinc-700 mt-1">
                    {formatDistanceToNow(new Date(contact.lastContacted), { addSuffix: true })}
                  </p>
                )}
                {/* Quick status change */}
                <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={contact.status}
                    onValueChange={(v) => onStatusChange(contact.id, v as ContactStatus)}
                  >
                    <SelectTrigger className="h-6 text-xs bg-zinc-900 border-zinc-700 text-zinc-400 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {PIPELINE_COLUMNS.map((s) => (
                        <SelectItem key={s} value={s} className="text-zinc-200 text-xs">{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Contacts Page ────────────────────────────────────────────────────────

export default function Contacts() {
  const { user, loading: authLoading } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showStyleExamples, setShowStyleExamples] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const utils = trpc.useUtils();
  const { data: summary } = trpc.contacts.getSummary.useQuery();
  const { data: contacts = [], isLoading } = trpc.contacts.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => { toast.success("Contact deleted"); utils.contacts.list.invalidate(); setSelectedContact(null); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.contacts.update.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = (contact: Contact) => {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    deleteMutation.mutate({ id: contact.id });
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-zinc-950"><div className="text-zinc-500 text-sm">Loading...</div></div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen bg-zinc-950"><div className="text-zinc-400 text-sm">Please sign in to access Contacts.</div></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Contacts</h1>
            {summary && (
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-zinc-400">{summary.total} total</span>
                {summary.byStatus.new > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{summary.byStatus.new} new</span>}
                {summary.byStatus.contacted > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-300">{summary.byStatus.contacted} contacted</span>}
                {summary.byStatus.active > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300">{summary.byStatus.active} active</span>}
                {summary.byStatus.closed > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{summary.byStatus.closed} closed</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setShowStyleExamples(true)} className="text-zinc-400 hover:text-zinc-100 text-xs border border-zinc-700">
              Message Style
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCsvImport(true)} className="text-zinc-400 hover:text-zinc-100 text-xs border border-zinc-700">
              Import CSV
            </Button>
            <Button onClick={() => setShowAddForm(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm">
              + Add Contact
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Controls row */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          {/* Status filter (table mode only) */}
          {viewMode === "table" && (
            <div className="flex items-center gap-2">
              {(["all", "new", "contacted", "active", "closed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${statusFilter === s ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
                >
                  {s === "all" ? "All" : STATUS_LABELS[s as ContactStatus]}
                </button>
              ))}
            </div>
          )}
          {viewMode === "pipeline" && <div />}

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "table" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode("pipeline")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "pipeline" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Pipeline
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-20 text-zinc-600 text-sm">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <EmptyContacts onAdd={() => setShowAddForm(true)} />
        ) : viewMode === "pipeline" ? (
          <PipelineView
            contacts={contacts as Contact[]}
            onSelectContact={setSelectedContact}
            onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
          />
        ) : (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Company / Role</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Last Contact</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedContact(contact as Contact)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-zinc-200">{contact.name}</p>
                      {contact.email && <p className="text-xs text-zinc-600 mt-0.5">{contact.email}</p>}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-sm text-zinc-400">{[contact.role, contact.company].filter(Boolean).join(" · ") || "—"}</p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      {contact.phoneNumber ? (
                        <a
                          href={buildWhatsAppUrl(contact.phoneNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-green-400 hover:text-green-300"
                        >
                          {contact.phoneNumber}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[contact.status as ContactStatus]}`}>
                        {STATUS_LABELS[contact.status as ContactStatus]}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <p className="text-xs text-zinc-600">
                        {contact.lastContacted ? formatDistanceToNow(new Date(contact.lastContacted), { addSuffix: true }) : "Never"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditContact(contact as Contact); }}
                        className="text-xs text-zinc-600 hover:text-zinc-300 mr-3"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs & panels */}
      <ContactForm open={showAddForm} onClose={() => setShowAddForm(false)} onSaved={() => {}} />
      {editContact && (
        <ContactForm open={!!editContact} onClose={() => setEditContact(null)} contact={editContact} onSaved={() => setEditContact(null)} />
      )}
      <StyleExamplesDialog open={showStyleExamples} onClose={() => setShowStyleExamples(false)} />
      <CsvImportDialog
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onImported={() => { utils.contacts.list.invalidate(); utils.contacts.getSummary.invalidate(); }}
        existingContacts={contacts as Contact[]}
      />
      {selectedContact && (
        <>
          <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setSelectedContact(null)} />
          <ContactDetailPanel
            contact={selectedContact}
            onEdit={() => { setEditContact(selectedContact); setSelectedContact(null); }}
            onClose={() => setSelectedContact(null)}
            onDelete={() => handleDelete(selectedContact)}
          />
        </>
      )}
    </div>
  );
}
