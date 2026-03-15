/**
 * Persona Selector — shown once after first login if no userProfile exists.
 * 13 visual tiles. User picks one. Stage 1 fires silently. Redirect to /ask.
 * No mention of "persona", "profile", or "identity" in the UI.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Persona data ──────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    id: "BANKER",
    label: "Banker",
    icon: "🏦",
    description: "Credit, compliance, KYC/AML, GCC regulatory monitoring",
    color: "from-blue-900/60 to-blue-800/40",
    border: "border-blue-700/50 hover:border-blue-500",
  },
  {
    id: "FUND_MANAGER",
    label: "Fund Manager",
    icon: "📊",
    description: "Portfolio intelligence, deal screening, macro monitoring",
    color: "from-emerald-900/60 to-emerald-800/40",
    border: "border-emerald-700/50 hover:border-emerald-500",
  },
  {
    id: "INVESTMENT_MANAGER",
    label: "Investment Manager",
    icon: "💼",
    description: "Asset allocation, sovereign wealth, AUM reporting",
    color: "from-amber-900/60 to-amber-800/40",
    border: "border-amber-700/50 hover:border-amber-500",
  },
  {
    id: "INVESTMENT_ANALYST",
    label: "Investment Analyst",
    icon: "📈",
    description: "DCF modeling, earnings analysis, equity research",
    color: "from-violet-900/60 to-violet-800/40",
    border: "border-violet-700/50 hover:border-violet-500",
  },
  {
    id: "DOCTOR",
    label: "Doctor",
    icon: "🩺",
    description: "Clinical summaries, drug interactions, ICD coding",
    color: "from-cyan-900/60 to-cyan-800/40",
    border: "border-cyan-700/50 hover:border-cyan-500",
  },
  {
    id: "STUDENT",
    label: "Student",
    icon: "🎓",
    description: "Research assistance, citations, concept explanations",
    color: "from-indigo-900/60 to-indigo-800/40",
    border: "border-indigo-700/50 hover:border-indigo-500",
  },
  {
    id: "LAWYER",
    label: "Lawyer",
    icon: "⚖️",
    description: "Contract review, regulatory compliance, legal extraction",
    color: "from-slate-800/60 to-slate-700/40",
    border: "border-slate-600/50 hover:border-slate-400",
  },
  {
    id: "RETAILER",
    label: "Retailer",
    icon: "🛒",
    description: "Demand forecasting, inventory, supplier risk",
    color: "from-orange-900/60 to-orange-800/40",
    border: "border-orange-700/50 hover:border-orange-500",
  },
  {
    id: "OFFICE_CLERK",
    label: "Office Clerk",
    icon: "📋",
    description: "Document processing, email drafting, meeting notes",
    color: "from-teal-900/60 to-teal-800/40",
    border: "border-teal-700/50 hover:border-teal-500",
  },
  {
    id: "MANAGER",
    label: "Manager",
    icon: "🎯",
    description: "Team performance, KPIs, project tracking",
    color: "from-rose-900/60 to-rose-800/40",
    border: "border-rose-700/50 hover:border-rose-500",
  },
  {
    id: "MARKETING_MANAGER",
    label: "Marketing Manager",
    icon: "📣",
    description: "Campaign analysis, audience segmentation, content briefs",
    color: "from-pink-900/60 to-pink-800/40",
    border: "border-pink-700/50 hover:border-pink-500",
  },
  {
    id: "ENTERPRISE",
    label: "Enterprise",
    icon: "🏢",
    description: "Workflow automation, multi-domain routing, compliance",
    color: "from-gray-800/60 to-gray-700/40",
    border: "border-gray-600/50 hover:border-gray-400",
  },
  {
    id: "OTHER",
    label: "Other",
    icon: "✨",
    description: "General research, document review, task assistance",
    color: "from-purple-900/60 to-purple-800/40",
    border: "border-purple-700/50 hover:border-purple-500",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PersonaSelector() {
  const [selected, setSelected] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const classifyPersona = trpc.identity.classifyPersona.useMutation({
    onSuccess: () => {
      navigate("/ask");
    },
    onError: () => {
      // Even on error, proceed to /ask — don't block the user
      navigate("/ask");
    },
  });

  const handleConfirm = () => {
    if (!selected) return;
    classifyPersona.mutate({ selectedPersona: selected });
  };

  const handleSkip = () => {
    navigate("/ask");
  };

  return (
    <div className="min-h-screen bg-[#080D1A] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="#38BDF8" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="4" fill="#38BDF8" />
            <line x1="20" y1="2" x2="20" y2="16" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="36" y1="11" x2="24" y2="17" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="36" y1="29" x2="24" y2="23" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="20" y1="38" x2="20" y2="24" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="4" y1="29" x2="16" y2="23" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="4" y1="11" x2="16" y2="17" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.5" />
          </svg>
          <span className="font-semibold text-white tracking-wide">AGENTHINK <span className="text-sky-400">MESH</span></span>
        </div>
        <button
          onClick={handleSkip}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Skip for now →
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center px-6 py-12 max-w-5xl mx-auto w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">
            What best describes your work?
          </h1>
          <p className="text-white/50 text-base max-w-lg mx-auto">
            The Mesh will surface the most relevant agents and workflows for you.
            You can change this at any time.
          </p>
        </div>

        {/* Persona grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 w-full mb-10">
          {PERSONAS.map((p) => {
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`
                  relative flex flex-col items-start gap-2 p-4 rounded-xl border text-left
                  bg-gradient-to-br ${p.color} ${p.border}
                  transition-all duration-200 cursor-pointer
                  ${isSelected
                    ? "ring-2 ring-sky-400 border-sky-400 scale-[1.02]"
                    : "hover:scale-[1.01]"
                  }
                `}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-sky-400 flex items-center justify-center">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <div className="font-semibold text-white text-sm">{p.label}</div>
                  <div className="text-white/50 text-xs mt-0.5 leading-relaxed">{p.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!selected || classifyPersona.isPending}
          className={`
            px-10 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200
            ${selected && !classifyPersona.isPending
              ? "bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20 cursor-pointer"
              : "bg-white/10 text-white/30 cursor-not-allowed"
            }
          `}
        >
          {classifyPersona.isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Configuring your Mesh…
            </span>
          ) : (
            "Confirm & Enter Mesh →"
          )}
        </button>

        <p className="text-white/25 text-xs mt-4 text-center">
          Your selection helps the Mesh route tasks more accurately. No data is shared externally.
        </p>
      </div>
    </div>
  );
}
