/**
 * Tracker.tsx — Simple Email Reply Tracker
 *
 * Designed for non-technical users. Log replies in 2 clicks.
 * Add contacts manually. See your outreach at a glance.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Status options in plain English ──────────────────────────────────────────
const OUTCOMES = [
  { value: "no_response",    emoji: "⏳", label: "No reply yet",       color: "bg-slate-700 text-slate-200",   ring: "ring-slate-500" },
  { value: "new_reply",      emoji: "📬", label: "They replied",        color: "bg-blue-600 text-white",        ring: "ring-blue-400" },
  { value: "interested",     emoji: "✅", label: "They're interested",  color: "bg-emerald-600 text-white",     ring: "ring-emerald-400" },
  { value: "meeting_booked", emoji: "📅", label: "Meeting booked",      color: "bg-amber-500 text-white",       ring: "ring-amber-400" },
  { value: "pilot_started",  emoji: "🚀", label: "Pilot / trial started", color: "bg-violet-600 text-white",   ring: "ring-violet-400" },
  { value: "not_interested", emoji: "❌", label: "They said no",        color: "bg-red-700 text-white",         ring: "ring-red-400" },
] as const;

type OutcomeValue = typeof OUTCOMES[number]["value"];

const MARKETS = ["UAE", "Saudi Arabia", "Kuwait", "Bahrain", "Qatar", "Oman", "UK", "US", "Singapore", "India", "Pakistan", "Other"];

function OutcomePill({ value }: { value: string }) {
  const o = OUTCOMES.find((x) => x.value === value) ?? OUTCOMES[0];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${o.color}`}>
      {o.emoji} {o.label}
    </span>
  );
}

// ── Log Reply Modal ───────────────────────────────────────────────────────────
function LogReplyModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: { id: number; recipientName: string; recipientFirm?: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [outcome, setOutcome] = useState<OutcomeValue>("new_reply");
  const utils = trpc.useUtils();

  const updateMutation = trpc.tracker.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(`Updated ${contact.recipientName}`);
      utils.tracker.getEmails.invalidate();
      utils.tracker.getStats.invalidate();
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f1629] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-1">Log a reply</h2>
        <p className="text-sm text-slate-400 mb-5">
          From <span className="text-white font-medium">{contact.recipientName}</span>
          {contact.recipientFirm ? ` · ${contact.recipientFirm}` : ""}
        </p>

        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">What happened?</p>
        <div className="flex flex-col gap-2 mb-6">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              onClick={() => setOutcome(o.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                ${outcome === o.value
                  ? `${o.color} border-transparent ring-2 ${o.ring}`
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                }`}
            >
              <span className="text-xl">{o.emoji}</span>
              <span className="font-medium text-sm">{o.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate({ id: contact.id, status: outcome })}
            disabled={updateMutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Contact Modal ─────────────────────────────────────────────────────────
function AddContactModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firm, setFirm] = useState("");
  const [role, setRole] = useState("");
  const [market, setMarket] = useState("UAE");
  const utils = trpc.useUtils();

  const addMutation = trpc.tracker.addContact.useMutation({
    onSuccess: () => {
      toast.success(`${name} added`);
      utils.tracker.getEmails.invalidate();
      utils.tracker.getStats.invalidate();
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f1629] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-1">Add a contact</h2>
        <p className="text-sm text-slate-400 mb-5">Someone you emailed as part of your outreach</p>

        <div className="flex flex-col gap-3 mb-6">
          <input className={inputClass} placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputClass} placeholder="Email address *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={inputClass} placeholder="Firm / company" value={firm} onChange={(e) => setFirm(e.target.value)} />
          <input className={inputClass} placeholder="Their role (e.g. Partner, MD)" value={role} onChange={(e) => setRole(e.target.value)} />
          <select
            className={inputClass + " cursor-pointer"}
            value={market}
            onChange={(e) => setMarket(e.target.value)}
          >
            {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => addMutation.mutate({ name, email, firm, role, market })}
            disabled={!name || !email || addMutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {addMutation.isPending ? "Adding…" : "Add contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Tracker() {
  const [logTarget, setLogTarget] = useState<{ id: number; recipientName: string; recipientFirm?: string | null } | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeValue | "">("");

  const statsQuery = trpc.tracker.getStats.useQuery();
  const emailsQuery = trpc.tracker.getEmails.useQuery({
    page: 1,
    limit: 100,
    status: outcomeFilter || undefined,
    search: search || undefined,
  });

  const stats = statsQuery.data;
  const emails = emailsQuery.data?.emails ?? [];

  // Summary numbers
  const total = stats?.total ?? 0;
  const replied = stats?.replied ?? 0;
  const interested = (stats?.byStatus?.interested ?? 0) + (stats?.byStatus?.meeting_booked ?? 0) + (stats?.byStatus?.pilot_started ?? 0);
  const meetings = (stats?.byStatus?.meeting_booked ?? 0) + (stats?.byStatus?.pilot_started ?? 0);

  return (
    <div className="min-h-screen bg-[#080d1a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0b1220]">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">📬 Reply Tracker</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {total > 0
                ? `Tracking ${total} outreach emails — ${replied} replied`
                : "Track who replied to your outreach emails"}
            </p>
          </div>
          <button
            onClick={() => setShowAddContact(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-900/30"
          >
            <span className="text-base">＋</span> Add contact
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { emoji: "📤", label: "Emails sent", value: total, note: "total outreach" },
            { emoji: "💬", label: "Replied", value: replied, note: total > 0 ? `${Math.round((replied / total) * 100)}% reply rate` : "0% reply rate" },
            { emoji: "✅", label: "Interested", value: interested, note: "want to know more" },
            { emoji: "📅", label: "Meetings", value: meetings, note: "booked or in pilot" },
          ].map((card) => (
            <div key={card.label} className="bg-[#0f1629] border border-white/10 rounded-xl p-4">
              <div className="text-2xl mb-1">{card.emoji}</div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{card.label}</div>
              <div className="text-xs text-slate-600 mt-0.5">{card.note}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="🔍  Search by name or firm…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 w-full sm:w-64"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setOutcomeFilter("")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${outcomeFilter === "" ? "bg-white text-black" : "bg-white/10 text-slate-300 hover:bg-white/15"}`}
            >
              All
            </button>
            {OUTCOMES.filter((o) => o.value !== "no_response").map((o) => (
              <button
                key={o.value}
                onClick={() => setOutcomeFilter(outcomeFilter === o.value ? "" : o.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${outcomeFilter === o.value ? o.color : "bg-white/10 text-slate-300 hover:bg-white/15"}`}
              >
                {o.emoji} {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact list */}
        {emailsQuery.isLoading ? (
          <div className="text-center py-16 text-slate-500">Loading…</div>
        ) : emails.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-slate-400 font-medium">No contacts yet</p>
            <p className="text-slate-600 text-sm mt-1 mb-5">Add the people you've emailed and track their replies here</p>
            <button
              onClick={() => setShowAddContact(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              ＋ Add your first contact
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map((email) => (
              <div
                key={email.id}
                className="bg-[#0f1629] border border-white/10 rounded-xl px-4 py-3.5 flex items-center gap-4 hover:border-white/20 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/30 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {email.recipientName.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{email.recipientName}</span>
                    {email.recipientFirm && (
                      <span className="text-slate-500 text-xs">· {email.recipientFirm}</span>
                    )}
                    {email.market && (
                      <span className="text-slate-600 text-xs bg-white/5 px-2 py-0.5 rounded-full">{email.market}</span>
                    )}
                    {email.followUpDue && (
                      <span className="text-amber-400 text-xs bg-amber-900/30 px-2 py-0.5 rounded-full">⚠️ Follow up</span>
                    )}
                  </div>
                  <div className="mt-1">
                    <OutcomePill value={email.replyStatus} />
                  </div>
                </div>

                {/* Log reply button */}
                <button
                  onClick={() => setLogTarget({ id: email.id, recipientName: email.recipientName, recipientFirm: email.recipientFirm })}
                  className="flex-shrink-0 px-3 py-1.5 bg-white/8 hover:bg-white/15 border border-white/10 rounded-lg text-xs text-slate-300 font-medium transition-colors"
                >
                  Update
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state tip */}
        {total > 0 && (
          <p className="text-center text-xs text-slate-600 pb-4">
            Showing {emails.length} of {emailsQuery.data?.total ?? 0} contacts
          </p>
        )}
      </div>

      {/* Modals */}
      {logTarget && (
        <LogReplyModal
          contact={logTarget}
          onClose={() => setLogTarget(null)}
          onSaved={() => setLogTarget(null)}
        />
      )}
      {showAddContact && (
        <AddContactModal
          onClose={() => setShowAddContact(false)}
          onSaved={() => setShowAddContact(false)}
        />
      )}
    </div>
  );
}
