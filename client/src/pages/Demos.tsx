import { Link } from "wouter";

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

        {/* Footer */}
        <div className="mt-14 pt-6 border-t border-white/10 text-center text-xs text-slate-600">
          AgenThinkMesh · Institutional Decision Intelligence
        </div>
      </div>
    </div>
  );
}
