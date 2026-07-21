/**
 * FounderDiagnostic — English landing page at /founder
 *
 * Layout mirrors /zh exactly. All copy is native marketing English.
 * Analytics events fire identically to the Chinese variant.
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DiagnosticFlow from "@/components/DiagnosticFlow";

// ── Analytics helper ──────────────────────────────────────────────────────────
function trackEvent(name: string, props?: Record<string, unknown>) {
  try {
    const w = window as any;
    if (w.umami?.track) w.umami.track(name, props);
    if (w.gtag) w.gtag("event", name, props);
  } catch { /* non-fatal */ }
}

// ── Pricing section ───────────────────────────────────────────────────────────
function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  highlight,
  onCta,
  loading,
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  onCta?: () => void;
  loading?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col gap-4 ${
        highlight
          ? "border-cyan-400/40 bg-cyan-400/5"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{name}</div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-black text-white">{price}</span>
          {period && <span className="text-sm text-slate-500 mb-1">{period}</span>}
        </div>
      </div>
      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
            <svg className="mt-0.5 flex-shrink-0 text-cyan-400" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onCta}
        disabled={loading}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
          highlight
            ? "bg-cyan-500 hover:bg-cyan-400 text-white"
            : "border border-white/20 hover:border-white/40 text-slate-300 hover:text-white"
        }`}
      >
        {loading ? "…" : cta}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FounderDiagnostic() {
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const checkoutMutation = trpc.diagnosis.createCheckout.useMutation({
    onSuccess: (data) => {
      setCheckoutLoading(null);
      if (data.url) {
        trackEvent("checkout_redirect", { product: checkoutLoading, lang: "en" });
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      setCheckoutLoading(null);
      toast.error(err.message ?? "Checkout failed. Please try again.");
    },
  });

  function handleCheckout(product: "deep_report" | "ai_partner") {
    setCheckoutLoading(product);
    trackEvent("checkout_started", { product, lang: "en" });
    checkoutMutation.mutate({ product, origin: window.location.origin });
  }

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-100" lang="en">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#080D1A]/90 backdrop-blur border-b border-white/1010 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-white font-bold text-base tracking-tight">
          <span className="text-cyan-400">创诊</span>
          <span className="text-slate-400 font-normal text-sm">AgenThinkMesh</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/zh" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            中文版
          </Link>
          <a
            href="#pricing"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Pricing
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-4 py-1.5 text-xs text-cyan-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Free · No sign-up required
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight mb-5">
          Does your startup idea<br />
          <span className="text-cyan-400">hold up under pressure?</span>
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-2xl mx-auto">
          90% of startups fail for the same reason: founders never truly stress-tested their assumptions.
          Describe your idea and get a cold, investor-grade diagnostic in 60 seconds — not encouragement, answers.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 mb-10">
          <span>✓ 12,000+ founders diagnosed</span>
          <span>·</span>
          <span>✓ Saves ~6 months of trial and error on average</span>
          <span>·</span>
          <span>✓ No sign-up, no credit card</span>
        </div>

        {/* Diagnostic input */}
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6 text-left">
          <DiagnosticFlow lang="en" buSource="diaspora" />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-10">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              n: "01",
              title: "Describe your idea",
              body: "Plain language. No business plan required. Write it the way you'd explain it to a friend.",
            },
            {
              n: "02",
              title: "Deep stress-test",
              body: "The engine pressure-tests four dimensions: business model, market size, competitive moat, and cash flow.",
            },
            {
              n: "03",
              title: "Get the diagnosis",
              body: "Not 'you've got this.' More like: 'Assumption 3 has a fatal flaw — here's how to fix it.'",
            },
          ].map((s) => (
            <div key={s.n} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-3xl font-black text-cyan-400/30 font-mono mb-3">{s.n}</div>
              <h3 className="text-sm font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-10">
          Other AI tools vs <span className="text-cyan-400">创诊</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 pr-6 text-slate-500 font-normal">Other AI tools say…</th>
                <th className="text-left py-3 text-cyan-300 font-semibold">创诊 says…</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                ["\"Great idea! Here's a business plan template.\"", "\"Your target market is overestimated by 3×.\""],
                ["Generates polished-looking templates", "Identifies the 3 most fatal logical flaws"],
                ["Makes you feel ready", "Makes you ready for an investor's hardest questions"],
                ["Generic frameworks applied to your idea", "Specific critique of your specific assumptions"],
              ].map(([other, ours], i) => (
                <tr key={i}>
                  <td className="py-3 pr-6 text-slate-500">{other}</td>
                  <td className="py-3 text-slate-200">{ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-3">Pricing</h2>
        <p className="text-sm text-slate-400 text-center mb-10">
          Start free. Pay only when you need the full picture.
        </p>
        <div className="grid sm:grid-cols-3 gap-5">
          <PricingCard
            name="Free"
            price="$0"
            features={[
              "Basic stress-test",
              "4-dimension score",
              "3 fatal gap titles",
              "No sign-up required",
            ]}
            cta="Start free →"
            onCta={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
          <PricingCard
            name="Deep Report"
            price="$14"
            period="one-time"
            highlight
            features={[
              "Full gap analysis (why fatal + fix)",
              "Industry benchmarks",
              "Investor Q&A simulation",
              "PDF report",
            ]}
            cta="Get deep report →"
            onCta={() => handleCheckout("deep_report")}
            loading={checkoutLoading === "deep_report"}
          />
          <PricingCard
            name="AI Partner"
            price="$39"
            period="/month"
            features={[
              "Unlimited diagnostics",
              "Weekly progress check-in",
              "Ongoing decision support",
              "Priority access to new features",
            ]}
            cta="Start AI Partner →"
            onCta={() => handleCheckout("ai_partner")}
            loading={checkoutLoading === "ai_partner"}
          />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-10">FAQ</h2>
        <div className="space-y-5">
          {[
            {
              q: "Is my data secure?",
              a: "Your idea is encrypted in transit and at rest on international cloud servers. It is never used for model training. You can request deletion at any time.",
            },
            {
              q: "Does it support Chinese input?",
              a: "Yes — the engine handles both English and Chinese input. The report language matches the language you write in.",
            },
            {
              q: "What stage is this for?",
              a: "From \"I have a vague idea\" to \"I'm preparing my fundraising pitch\" — the diagnostic is calibrated for all pre-Series A stages.",
            },
            {
              q: "Is this a real investor analysis?",
              a: "It's an AI-powered stress-test modelled on how early-stage investors evaluate ideas. It won't replace a real IC, but it will surface the same questions they'll ask.",
            },
          ].map((item) => (
            <div key={item.q} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-sm font-semibold text-white mb-2">{item.q}</div>
              <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-white/10 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          Don't let "feels right" cost you six months.
        </h2>
        <p className="text-slate-400 text-sm mb-8">
          The diagnostic is free. The cost of skipping it isn't.
        </p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          Diagnose my idea — free →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-slate-600">
        <p>© 2026 AgenThinkMesh · <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms</Link> · <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link></p>
      </footer>
    </div>
  );
}
