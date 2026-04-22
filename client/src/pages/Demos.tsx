import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Demo card data ────────────────────────────────────────────────────────────
const DEMOS = [
  {
    tag: "Southeast Asia",
    title: "Series B Fintech — SEA Payments",
    description:
      "Cross-border payments infrastructure, Singapore → Malaysia → Thailand",
    href: "/sg-ic",
    tagColor: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  },
  {
    tag: "Japan",
    title: "Series B Deeptech — Industrial AI",
    description:
      "Robotics and industrial AI, Tokyo → Osaka manufacturing corridor",
    href: "/jp-ic",
    tagColor: "bg-blue-400/15 text-blue-300 border-blue-400/30",
  },
  {
    tag: "United States",
    title: "Series B SaaS — Enterprise Automation",
    description: "Enterprise workflow automation, $9.1M ARR, 124% NRR",
    href: "/us-ic",
    tagColor: "bg-violet-400/15 text-violet-300 border-violet-400/30",
  },
];

// ── Waitlist capture ──────────────────────────────────────────────────────────
function WaitlistCapture({
  sourcePage,
  heading = "Get early access",
  subheading = "Join institutional investors already using AgenThink Mesh",
}: {
  sourcePage: string;
  heading?: string;
  subheading?: string;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message ?? "Something went wrong. Please try again."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    join.mutate({ email: trimmed, sourcePage, workflow: "institutional" });
  }

  return (
    <div className="border border-white/10 bg-white/5 rounded-xl p-6 mt-10">
      <h2 className="text-base font-semibold text-white mb-1">{heading}</h2>
      <p className="text-sm text-slate-400 mb-5">{subheading}</p>
      {submitted ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
          </svg>
          Request received — we'll be in touch.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@fund.com"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            required
          />
          <button
            type="submit"
            disabled={join.isPending}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {join.isPending ? "Submitting…" : "Request access →"}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Demos() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100">
      {/* Context strip */}
      <div className="bg-slate-800/60 border-b border-white/10 px-4 py-2 text-center">
        <span className="text-xs text-slate-400">
          Simulated IC memos using real deal patterns — not real companies or transactions
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
            Live Deal Memos
          </h1>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            See how AgenThink Mesh evaluates real deals across different markets
            and deal types.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-3 gap-5">
          {DEMOS.map((demo) => (
            <div
              key={demo.href}
              className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-block text-xs font-mono font-semibold px-2.5 py-1 rounded border ${demo.tagColor}`}
                >
                  {demo.tag}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-white mb-2 leading-snug">
                  {demo.title}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {demo.description}
                </p>
              </div>
              <Link
                href={demo.href}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                View memo
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.75 7.25a.75.75 0 0 0 0 1.5h6.69l-2.22 2.22a.75.75 0 1 0 1.06 1.06l3.5-3.5a.75.75 0 0 0 0-1.06l-3.5-3.5a.75.75 0 1 0-1.06 1.06l2.22 2.22H3.75z" />
                </svg>
              </Link>
            </div>
          ))}
        </div>

        {/* Waitlist capture */}
        <WaitlistCapture
          sourcePage="demos"
          heading="Ready to evaluate your own deals?"
          subheading="Join institutional investors already on the early access list."
        />

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/10 text-center text-xs text-slate-600">
          AgenThinkMesh · Institutional Decision Intelligence
        </div>
      </div>
    </div>
  );
}
