import { useEffect } from "react";
import { Link } from "wouter";
import { trackEvent } from "@/lib/analytics";

// ─── SEO helper ──────────────────────────────────────────────────────────────
function useSEO(title: string, description: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = meta?.content ?? "";
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
    return () => {
      document.title = prev;
      if (meta) meta.content = prevDesc;
    };
  }, [title, description]);
}

// ─── Sample output data (fictional company) ──────────────────────────────────
const SAMPLE = {
  company: "NestPath",
  tagline: "Affordable co-living for young professionals in Riyadh",
  strengths: [
    "Clear target segment with a specific pain point.",
    "Lean unit economics framing — cost per bed is stated.",
  ],
  fixes: [
    "The revenue model is described in one sentence. Investors will want to see monthly recurring revenue, occupancy rates, or signed LOIs.",
    "No mention of how NestPath acquires its first 100 tenants. Add a concrete go-to-market step.",
  ],
  missing: "No information on the founding team's background or relevant experience.",
};

// ─── Reusable components ──────────────────────────────────────────────────────
function CTAButton({ className = "" }: { className?: string }) {
  return (
    <Link href="/pitchmirror">
      <button
        className={`inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-base shadow-lg ${className}`}
      >
        Evaluate my pitch
      </button>
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PitchMirrorLanding() {
  useSEO(
    "PitchMirror — See your pitch the way investors do",
    "Get structured feedback on your startup pitch before you send it."
  );

  // Fire landing view event once on mount (fire-and-forget)
  useEffect(() => {
    trackEvent("pitchmirror_landing_view", { source: "landing_page" });
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1629] text-white font-sans">

      {/* ── Minimal Header ── */}
      <header className="sticky top-0 z-50 bg-[#0B1629]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-white">
            Pitch<span className="text-emerald-400">Mirror</span>
          </span>
          <Link href="/pitchmirror">
            <button className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Try it free
            </button>
          </Link>
        </div>
      </header>

      {/* ── Section 1: Hero ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-8">
          Free to try · No account required
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-white">
          See your pitch the way<br className="hidden sm:block" />{" "}
          <span className="text-emerald-400">investors do.</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          Paste your pitch. Get clear feedback in under 60 seconds.
        </p>
        <CTAButton />
        <p className="mt-4 text-sm text-slate-500">Free to try. No account required.</p>
      </section>

      {/* ── Section 2: What You Get ── */}
      <section className="bg-[#0F1E35] py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
            What you get
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Three clear sections that tell you exactly where your pitch stands.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: "👁",
                title: "What investors see",
                body: "The strengths that will land well and the concerns that will come up in the first meeting — before you're in the room.",
              },
              {
                icon: "🔧",
                title: "What to fix before sending",
                body: "Specific, actionable improvements mapped directly to the weaknesses in your pitch. Not generic advice.",
              },
              {
                icon: "📋",
                title: "What's missing",
                body: "Critical gaps investors expect to see — traction, unit economics, GTM — flagged clearly so you can fill them in.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-[#0B1629] border border-white/10 rounded-xl p-6 flex flex-col gap-3"
              >
                <span className="text-3xl">{card.icon}</span>
                <h3 className="font-semibold text-white text-lg">{card.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works ── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
            How it works
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Three steps. Under a minute.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Paste your pitch",
                body: "Copy in your pitch deck summary, one-pager, or email pitch. Any format works.",
              },
              {
                step: "02",
                title: "Evaluation runs in seconds",
                body: "Your pitch is reviewed across the same dimensions investors use to make decisions.",
              },
              {
                step: "03",
                title: "Get clear, structured feedback",
                body: "Receive three focused sections — what lands, what to fix, and what's missing.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-3">
                <span className="text-4xl font-bold text-emerald-500/30 font-mono">
                  {item.step}
                </span>
                <h3 className="font-semibold text-white text-lg">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Sample Output ── */}
      <section className="bg-[#0F1E35] py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 border border-slate-700 px-3 py-1 rounded-full">
              Example output
            </span>
            <span className="text-slate-600 text-sm">— fictional company</span>
          </div>

          {/* Company label */}
          <div className="mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Company</p>
            <p className="font-semibold text-white">{SAMPLE.company}</p>
            <p className="text-slate-400 text-sm">{SAMPLE.tagline}</p>
          </div>

          <div className="space-y-6">
            {/* What investors see */}
            <div className="bg-[#0B1629] border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                👁 What investors see
              </h3>
              <div className="space-y-2">
                {SAMPLE.strengths.map((s, i) => (
                  <div key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What to fix */}
            <div className="bg-[#0B1629] border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">
                🔧 What to fix before sending
              </h3>
              <div className="space-y-3">
                {SAMPLE.fixes.map((f, i) => (
                  <div key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-amber-400 mt-0.5 shrink-0 font-bold">{i + 1}.</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What's missing */}
            <div className="bg-[#0B1629] border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">
                📋 What's missing
              </h3>
              <div className="flex gap-2 text-sm text-slate-300">
                <span className="text-red-400 mt-0.5 shrink-0">!</span>
                <span>{SAMPLE.missing}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: CTA Repeat ── */}
      <section className="py-24 text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to see your pitch clearly?
          </h2>
          <p className="text-slate-400 mb-10 text-lg">
            Paste your pitch and get structured feedback in under 60 seconds.
          </p>
          <Link href="/pitchmirror">
            <button className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg shadow-lg">
              Evaluate my pitch free
            </button>
          </Link>
          <p className="mt-4 text-sm text-slate-500">Free to try. No account required.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <span>
            Pitch<span className="text-emerald-500">Mirror</span>
          </span>
          <Link href="/pitchmirror" className="text-slate-500 hover:text-slate-300 transition-colors">
            Try PitchMirror →
          </Link>
        </div>
      </footer>

    </div>
  );
}
