/**
 * Contacts.tsx — ARE Phase 1 & 2: Contacts CRM + Outreach Agent
 *
 * Features:
 *  - Contact list table (sortable by last contacted)
 *  - Add / Edit contact form (slide-over panel)
 *  - Status badge with update
 *  - Generate Message panel (Outreach Agent)
 *  - Message Style Examples (few-shot calibration)
 *  - Interaction log with outcome tracking
 */

import { useState, useMemo } from "react";
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
import { format, formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContactStatus = "new" | "contacted" | "active" | "closed";
type OutcomeType = "no_response" | "response" | "converted";
type GoalType = "follow_up" | "conversion" | "engagement";

interface Contact {
  id: number;
  name: string;
  company?: string | null;
  role?: string | null;
  region?: string | null;
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

// ── Status helpers ────────────────────────────────────────────────────────────

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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyContacts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 text-2xl">
        ◎
      </div>
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
  });

  const utils = trpc.useUtils();
  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Contact added");
      utils.contacts.list.invalidate();
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("Contact updated");
      utils.contacts.list.invalidate();
      if (contact) utils.contacts.get.invalidate({ id: contact.id });
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (isEdit && contact) {
      updateMutation.mutate({ id: contact.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  // Reset form when contact changes
  useMemo(() => {
    setForm({
      name: contact?.name ?? "",
      company: contact?.company ?? "",
      role: contact?.role ?? "",
      region: contact?.region ?? "",
      status: (contact?.status ?? "new") as ContactStatus,
      notes: contact?.notes ?? "",
    });
  }, [contact]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">{isEdit ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Company</label>
              <Input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Firm / organisation"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Role</label>
              <Input
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Title / position"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Region</label>
              <Input
                value={form.region}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                placeholder="Kuwait / GCC / London"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Status</label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as ContactStatus }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {(["new", "contacted", "active", "closed"] as ContactStatus[]).map((s) => (
                    <SelectItem key={s} value={s} className="text-zinc-100">
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
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
  onClose: () => void;
}

function GenerateMessagePanel({ contact, onClose }: GenerateMessagePanelProps) {
  const [goal, setGoal] = useState<GoalType>("follow_up");
  const [context, setContext] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [logAction, setLogAction] = useState("");
  const [logMessage, setLogMessage] = useState("");
  const [showLogForm, setShowLogForm] = useState(false);

  const utils = trpc.useUtils();

  const generateMutation = trpc.contacts.generateMessage.useMutation({
    onSuccess: (data) => {
      setGeneratedMessage(data.message);
      setWordCount(data.wordCount);
      setLogMessage(data.message);
      setLogAction(`Generated ${GOAL_LABELS[goal]} message`);
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

  const handleGenerate = () => {
    generateMutation.mutate({
      contactId: contact.id,
      goal,
      context: context.trim() || undefined,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMessage);
    toast.success("Copied to clipboard");
  };

  const handleLogSend = () => {
    if (!logAction.trim()) return toast.error("Action description required");
    logMutation.mutate({
      contactId: contact.id,
      action: logAction,
      messageText: logMessage.trim() || undefined,
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
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                goal === g
                  ? "bg-amber-500 text-black"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Additional context */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">
          Additional Context <span className="text-zinc-600">(optional)</span>
        </label>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. We met at the Gulf Capital Summit last week. He mentioned interest in healthcare deals."
          rows={2}
          className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm resize-none"
        />
      </div>

      <Button
        onClick={handleGenerate}
        disabled={generateMutation.isPending}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
      >
        {generateMutation.isPending ? "Generating..." : "Generate Message"}
      </Button>

      {/* Generated message output */}
      {generatedMessage && (
        <div className="space-y-3">
          <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500">Generated message — {wordCount} words</span>
              <button
                onClick={handleCopy}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Copy
              </button>
            </div>
            <Textarea
              value={generatedMessage}
              onChange={(e) => setGeneratedMessage(e.target.value)}
              rows={6}
              className="bg-transparent border-none text-zinc-200 text-sm resize-none p-0 focus-visible:ring-0"
            />
          </div>

          {!showLogForm ? (
            <Button
              variant="outline"
              onClick={() => setShowLogForm(true)}
              className="w-full border-zinc-700 text-zinc-300 hover:text-zinc-100 bg-transparent"
            >
              Log as Sent
            </Button>
          ) : (
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700 space-y-3">
              <p className="text-xs text-zinc-400 font-medium">Log this interaction</p>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Action description</label>
                <Input
                  value={logAction}
                  onChange={(e) => setLogAction(e.target.value)}
                  placeholder="Sent follow-up via WhatsApp"
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleLogSend}
                  disabled={logMutation.isPending}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                >
                  {logMutation.isPending ? "Logging..." : "Log It"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLogForm(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Interaction Log ───────────────────────────────────────────────────────────

interface InteractionLogProps {
  contactId: number;
}

function InteractionLog({ contactId }: InteractionLogProps) {
  const { data: contactData } = trpc.contacts.get.useQuery({ id: contactId });
  const utils = trpc.useUtils();

  const updateOutcomeMutation = trpc.contacts.updateOutcome.useMutation({
    onSuccess: () => {
      toast.success("Outcome updated");
      utils.contacts.get.invalidate({ id: contactId });
      utils.contacts.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const interactions: Interaction[] = contactData?.interactions ?? [];

  if (interactions.length === 0) {
    return (
      <p className="text-sm text-zinc-600 italic">No interactions logged yet.</p>
    );
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
                <Select
                  onValueChange={(v) =>
                    updateOutcomeMutation.mutate({
                      interactionId: interaction.id,
                      outcome: v as OutcomeType,
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-400 w-32">
                    <SelectValue placeholder="Set outcome" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {(["no_response", "response", "converted"] as OutcomeType[]).map((o) => (
                      <SelectItem key={o} value={o} className="text-zinc-200 text-xs">
                        {OUTCOME_LABELS[o]}
                      </SelectItem>
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

interface StyleExamplesDialogProps {
  open: boolean;
  onClose: () => void;
}

function StyleExamplesDialog({ open, onClose }: StyleExamplesDialogProps) {
  const { data: existingExamples } = trpc.contacts.getStyleExamples.useQuery();
  const [examples, setExamples] = useState<{ text: string; label: string }[]>([
    { text: "", label: "" },
  ]);
  const utils = trpc.useUtils();

  // Populate from DB when dialog opens
  useMemo(() => {
    if (existingExamples && existingExamples.length > 0) {
      setExamples(
        existingExamples.map((e) => ({ text: e.exampleText, label: e.label ?? "" }))
      );
    }
  }, [existingExamples]);

  const saveMutation = trpc.contacts.saveStyleExamples.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} style example${data.count !== 1 ? "s" : ""} saved`);
      utils.contacts.getStyleExamples.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const valid = examples.filter((e) => e.text.trim().length >= 10);
    if (valid.length === 0) return toast.error("Add at least one example (min 10 characters)");
    saveMutation.mutate({
      examples: valid.map((e) => ({ exampleText: e.text.trim(), label: e.label.trim() || undefined })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Message Style Examples</DialogTitle>
          <p className="text-sm text-zinc-400 mt-1">
            Paste 2–3 real messages you have written. The Outreach Agent will match your exact tone and style.
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {examples.map((ex, i) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400 font-medium">Example {i + 1}</label>
                {examples.length > 1 && (
                  <button
                    onClick={() => setExamples((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-zinc-600 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
              <Input
                value={ex.label}
                onChange={(e) =>
                  setExamples((prev) =>
                    prev.map((item, idx) => (idx === i ? { ...item, label: e.target.value } : item))
                  )
                }
                placeholder="Label (optional): e.g. follow-up, intro"
                className="bg-zinc-900 border-zinc-700 text-zinc-300 text-xs h-8"
              />
              <Textarea
                value={ex.text}
                onChange={(e) =>
                  setExamples((prev) =>
                    prev.map((item, idx) => (idx === i ? { ...item, text: e.target.value } : item))
                  )
                }
                placeholder="Paste a real message you wrote here..."
                rows={4}
                className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm resize-none"
              />
            </div>
          ))}
          {examples.length < 5 && (
            <Button
              variant="ghost"
              onClick={() => setExamples((prev) => [...prev, { text: "", label: "" }])}
              className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
              + Add another example
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
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
          <p className="text-sm text-zinc-400">
            {[contact.role, contact.company].filter(Boolean).join(" · ")}
          </p>
          {contact.region && (
            <p className="text-xs text-zinc-600 mt-0.5">{contact.region}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg leading-none px-1"
          >
            ×
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[contact.status]}`}>
          {STATUS_LABELS[contact.status]}
        </span>
        {contact.lastContacted && (
          <span className="text-xs text-zinc-600">
            Last contact: {formatDistanceToNow(new Date(contact.lastContacted), { addSuffix: true })}
          </span>
        )}
      </div>

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
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "message" ? "Generate Message" : "Interaction History"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "message" ? (
          <GenerateMessagePanel contact={contact} onClose={onClose} />
        ) : (
          <InteractionLog contactId={contact.id} />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800">
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-400"
        >
          Delete contact
        </button>
      </div>
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
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");

  const utils = trpc.useUtils();
  const { data: contacts = [], isLoading } = trpc.contacts.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted");
      utils.contacts.list.invalidate();
      setSelectedContact(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = (contact: Contact) => {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    deleteMutation.mutate({ id: contact.id });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-zinc-400 text-sm">Please sign in to access Contacts.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Contacts</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              ARE Phase 1 — {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStyleExamples(true)}
              className="text-zinc-400 hover:text-zinc-100 text-xs border border-zinc-700"
            >
              Message Style
            </Button>
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
            >
              + Add Contact
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Status filter */}
        <div className="flex items-center gap-2 mb-6">
          {(["all", "new", "contacted", "active", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-amber-500 text-black"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s as ContactStatus]}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-20 text-zinc-600 text-sm">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <EmptyContacts onAdd={() => setShowAddForm(true)} />
        ) : (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Company / Role</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Region</th>
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
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-sm text-zinc-400">
                        {[contact.role, contact.company].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-sm text-zinc-500">{contact.region || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[contact.status as ContactStatus]}`}>
                        {STATUS_LABELS[contact.status as ContactStatus]}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <p className="text-xs text-zinc-600">
                        {contact.lastContacted
                          ? formatDistanceToNow(new Date(contact.lastContacted), { addSuffix: true })
                          : "Never"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditContact(contact as Contact);
                        }}
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
      <ContactForm
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSaved={() => {}}
      />
      {editContact && (
        <ContactForm
          open={!!editContact}
          onClose={() => setEditContact(null)}
          contact={editContact}
          onSaved={() => setEditContact(null)}
        />
      )}
      <StyleExamplesDialog
        open={showStyleExamples}
        onClose={() => setShowStyleExamples(false)}
      />
      {selectedContact && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-30"
            onClick={() => setSelectedContact(null)}
          />
          <ContactDetailPanel
            contact={selectedContact}
            onEdit={() => {
              setEditContact(selectedContact);
              setSelectedContact(null);
            }}
            onClose={() => setSelectedContact(null)}
            onDelete={() => handleDelete(selectedContact)}
          />
        </>
      )}
    </div>
  );
}
