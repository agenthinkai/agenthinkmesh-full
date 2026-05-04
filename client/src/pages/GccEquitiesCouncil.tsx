// client/src/pages/GccEquitiesCouncil.tsx
//
// Council of 10 — GCC Equities — user-facing intake page.
//
// Stack assumptions (adjust if yours differs):
//   • Tailwind CSS for styling
//   • tRPC client at "@/lib/trpc" with dealScreener.screen mutation
//   • React 18+ with hooks
//
// The page is one-shot — no multi-step wizard. Users see all fields,
// fill what applies to their chosen strategy, and submit. The deterministic
// evidence block is computed server-side in runCouncil() before dispatch
// to the ten personas, so the client just collects and forwards the inputs.
//
// First-run UX: the form is prefilled with the smoke-test payload from
// patch-4 so users can hit Submit immediately and see a verdict end-to-end
// before they bother typing real quotes.

import { useState } from "react";
import { trpc } from "@/lib/trpc";

// ── Types ───────────────────────────────────────────────────────────
type Strategy = "FRIDAY_GAP" | "NAV_DEPEG" | "SPREAD_CAPTURE";

interface QuoteRow {
  symbol: string;
  bid: string;
  ask: string;
  last: string;
}

// Top-10 KWT basket constituents — match server/lib/navMath.ts:KWT_BASKET
const SEED_QUOTES: QuoteRow[] = [
  { symbol: "KFH",       bid: "0.619", ask: "0.621", last: "0.620" },
  { symbol: "NBK",       bid: "1.039", ask: "1.041", last: "1.040" },
  { symbol: "ZAIN",      bid: "0.489", ask: "0.491", last: "0.490" },
  { symbol: "WARBABANK", bid: "0.254", ask: "0.256", last: "0.255" },
  { symbol: "GBK",       bid: "0.309", ask: "0.311", last: "0.310" },
  { symbol: "MABANEE",   bid: "0.814", ask: "0.816", last: "0.815" },
  { symbol: "NIND",      bid: "",      ask: "",       last: "0.235" },
  { symbol: "ABK",       bid: "",      ask: "",       last: "0.300" },
  { symbol: "ALTIJARIA", bid: "",      ask: "",       last: "0.108" },
  { symbol: "BOURSA",    bid: "",      ask: "",       last: "3.700" },
];


export default function GccEquitiesCouncil() {
  // ── form state ────────────────────────────────────────────────────
  const [strategy, setStrategy] = useState<Strategy>("FRIDAY_GAP");
  const [symbol, setSymbol] = useState("KFH");
  const [sideHint, setSideHint] = useState<"BUY" | "SELL" | "">("BUY");
  const [kwtThu, setKwtThu] = useState("36.10");
  const [kwtFri, setKwtFri] = useState("36.55");
  const [thresholdBps, setThresholdBps] = useState("15");
  const [notes, setNotes] = useState("");
  const [macroTape, setMacroTape] = useState(
    "S&P 500 +0.4%, STOXX 600 +0.2%, Brent +1.8% to USD 78.50, " +
      "DXY -0.3%. No major GCC headlines. Tadawul Thu close +0.5%."
  );
  const [quotes, setQuotes] = useState<QuoteRow[]>(SEED_QUOTES);

  const screen = trpc.dealScreener.screen.useMutation();

  // ── handlers ──────────────────────────────────────────────────────
  const updateQuote = (i: number, field: keyof QuoteRow, val: string) => {
    setQuotes((qs) =>
      qs.map((q, j) => (i === j ? { ...q, [field]: val } : q)),
    );
  };

  const onSubmit = () => {
    const constituentQuotes = quotes
      .filter((q) => q.bid || q.ask || q.last)
      .map((q) => ({
        symbol: q.symbol,
        bid:  q.bid  ? parseFloat(q.bid)  : undefined,
        ask:  q.ask  ? parseFloat(q.ask)  : undefined,
        last: q.last ? parseFloat(q.last) : undefined,
      }));

    const payload = {
      strategy,
      symbol: symbol.trim().toUpperCase(),
      sideHint: sideHint || undefined,
      constituentQuotes,
      kwtThursdayClose: kwtThu ? parseFloat(kwtThu) : undefined,
      kwtFridayClose:   kwtFri ? parseFloat(kwtFri) : undefined,
      thresholdBps: thresholdBps ? parseInt(thresholdBps, 10) : 15,
      notes: notes || undefined,
      macroTape: macroTape || undefined,
    };

    const dealText =
      `Trading signal review — ${strategy} on ${payload.symbol}` +
      (sideHint ? ` (${sideHint})` : "") +
      `. Threshold ${payload.thresholdBps} bps.` +
      (notes ? ` Analyst notes: ${notes}` : "");

    screen.mutate({
      dealName: `${strategy} · ${payload.symbol}${sideHint ? ` (${sideHint})` : ""}`,
      dealText,
      councilMode: "gcc_equities",
      signalPayload: payload,
    });
  };

  // ── render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ─ Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-amber-200 pb-4">
        <div className="text-xs uppercase tracking-widest text-amber-700">
          AgenThink Mesh · Markets Division
        </div>
        <h1 className="text-3xl font-serif mt-1 text-slate-900">
          Council of 10 — <em className="text-amber-600">GCC Equities</em>
        </h1>
        <p className="text-sm text-slate-600 mt-2 italic">
          Ten specialised agents. Eight-vote floor. Two hard vetoes
          (Shariah · Regulatory). Submit a trading signal for council review.
        </p>
        <div className="mt-3">
          <MarketStatusBadge />
        </div>
      </header>

      {/* ─ Strategy / target / side hint ──────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Strategy
          </span>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as Strategy)}
            className="mt-1 block w-full border rounded px-3 py-2 bg-white"
          >
            <option value="FRIDAY_GAP">Friday Gap</option>
            <option value="NAV_DEPEG">NAV De-peg</option>
            <option value="SPREAD_CAPTURE">Spread Capture</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Target Symbol
          </span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2 font-mono"
            placeholder="KFH"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Side Hint
          </span>
          <select
            value={sideHint}
            onChange={(e) =>
              setSideHint(e.target.value as "BUY" | "SELL" | "")
            }
            className="mt-1 block w-full border rounded px-3 py-2 bg-white"
          >
            <option value="">— none —</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </label>
      </section>

      {/* ─ Friday Gap inputs (shown only for that strategy) ───────── */}
      {strategy === "FRIDAY_GAP" && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50 border border-amber-200 p-4 rounded">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-600">
              KWT Thursday Close (USD)
            </span>
            <input
              value={kwtThu}
              onChange={(e) => setKwtThu(e.target.value)}
              className="mt-1 block w-full border rounded px-3 py-2 font-mono"
              placeholder="36.10"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-600">
              KWT Friday Close (USD)
            </span>
            <input
              value={kwtFri}
              onChange={(e) => setKwtFri(e.target.value)}
              className="mt-1 block w-full border rounded px-3 py-2 font-mono"
              placeholder="36.55"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-600">
              Threshold (bps)
            </span>
            <input
              value={thresholdBps}
              onChange={(e) => setThresholdBps(e.target.value)}
              className="mt-1 block w-full border rounded px-3 py-2 font-mono"
              placeholder="15"
            />
          </label>
        </section>
      )}

      {/* ─ Constituent quotes table ───────────────────────────────── */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-500 mb-2">
          Constituent Quotes (KWD) — leave blank to skip a name
        </h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2 font-medium text-slate-700">
                  Symbol
                </th>
                <th className="text-left p-2 font-medium text-slate-700">
                  Bid
                </th>
                <th className="text-left p-2 font-medium text-slate-700">
                  Ask
                </th>
                <th className="text-left p-2 font-medium text-slate-700">
                  Last
                </th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => (
                <tr key={q.symbol} className="border-t">
                  <td className="p-2 font-mono text-slate-900">{q.symbol}</td>
                  {(["bid", "ask", "last"] as const).map((f) => (
                    <td key={f} className="p-2">
                      <input
                        value={q[f]}
                        onChange={(e) => updateQuote(i, f, e.target.value)}
                        className="w-24 border rounded px-2 py-1 font-mono text-xs"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─ Macro tape ────────────────────────────────────────────── */}
      <section>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Macro Tape (Friday global close)
          </span>
          <textarea
            value={macroTape}
            onChange={(e) => setMacroTape(e.target.value)}
            rows={2}
            className="mt-1 block w-full border rounded px-3 py-2 font-mono text-xs"
            placeholder="S&P 500 +X%, Brent +Y%, DXY ±Z%, GCC headlines..."
          />
        </label>
      </section>
      {/* ─ Analyst notes ──────────────────────────────────────────── */}
      <section>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Analyst Notes (optional)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full border rounded px-3 py-2"
            placeholder="Context the council should consider — recent news, prior positioning, etc."
          />
        </label>
      </section>

      {/* ─ Submit ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={onSubmit}
          disabled={screen.isPending}
          className="bg-slate-900 text-amber-200 px-6 py-3 rounded font-mono uppercase tracking-wider text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {screen.isPending ? "Council deliberating…" : "Submit to Council of 10"}
        </button>
        {screen.error && (
          <span className="text-red-600 text-sm">{screen.error.message}</span>
        )}
      </div>

      {/* ─ Verdict ────────────────────────────────────────────────── */}
      {screen.data && <CouncilVerdictCard result={screen.data} />}
    </div>
  );
}


// ── Market-hours helpers (Patch 16) ─────────────────────────────────
type MarketPhase =
  | "OPEN"
  | "PRE_OPEN"
  | "OVERNIGHT_CLOSED"
  | "AFTER_HOURS_CLOSED"
  | "WEEKEND_CLOSED";

function clientMarketPhase(now = new Date()): MarketPhase {
  const kwt = new Date(now.getTime() + 3 * 3600 * 1000);
  const dow = kwt.getUTCDay();
  if (dow === 5 || dow === 6) return "WEEKEND_CLOSED";
  const m = kwt.getUTCHours() * 60 + kwt.getUTCMinutes();
  if (m < 510) return "OVERNIGHT_CLOSED";
  if (m < 540) return "PRE_OPEN";
  if (m < 750) return "OPEN";
  return "AFTER_HOURS_CLOSED";
}

function MarketStatusBadge() {
  const phase   = clientMarketPhase();
  const isOpen  = phase === "OPEN";
  const isPreOp = phase === "PRE_OPEN";

  const palette =
    isOpen   ? "bg-green-100 text-green-800 border-green-300" :
    isPreOp  ? "bg-amber-100 text-amber-800 border-amber-300" :
               "bg-slate-100 text-slate-700 border-slate-300";

  const dot =
    isOpen   ? "bg-green-500 animate-pulse" :
    isPreOp  ? "bg-amber-500" :
               "bg-slate-400";

  const label = phase.replace(/_/g, " ");

  const note =
    isOpen   ? "All ten seats can fully evaluate." :
    isPreOp  ? "Microstructure may have limited book depth." :
               "Microstructure & Liquidity will structurally refuse without live data.";

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono ${palette}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span>BOURSA KUWAIT · {label}</span>
      <span className="hidden md:inline text-[10px] opacity-70 ml-1 italic font-sans">
        {note}
      </span>
    </div>
  );
}

// ── Verdict card ────────────────────────────────────────────────────
function CouncilVerdictCard({ result }: { result: any }) {
  const verdictColor =
    result.verdict === "APPROVED" || result.verdict === "EXECUTE"
      ? "bg-green-50 border-green-600"
      : result.verdict === "BLOCK" || result.verdict === "REJECTED"
      ? "bg-red-50 border-red-600"
      : "bg-amber-50 border-amber-600";

  return (
    <section className={`border-l-4 p-5 mt-6 ${verdictColor}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">
            Verdict
          </div>
          <div className="text-2xl font-serif text-slate-900">
            {result.verdict}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-mono">
            {result.yesCount} YES · {result.noCount} NO
          </div>

          {result.structuralNoCount > 0 && (
            <div className="text-amber-700 text-xs mt-1 italic">
              {result.structuralNoCount} of {result.noCount}{" "}
              {result.noCount === 1 ? "NO is a" : "NOs are"} missing-data refusal
              {result.structuralNoCount > 1 ? "s" : ""}
              {result.structuralNoSeats?.[0]?.blockers?.[0] && (
                <> ({result.structuralNoSeats[0].blockers[0].toLowerCase().replace(/_/g, " ")})</>
              )}
            </div>
          )}

          {result.hardFlags?.length > 0 && (
            <div className="text-red-700 text-xs mt-1 font-mono">
              {result.hardFlags.join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {result.votes?.map((v: any) => (
          <div
            key={v.personaId}
            className={`border rounded p-3 ${
              v.vote === "HARD_NO"
                ? "border-red-500 bg-red-50"
                : v.vote === "NO"
                ? "border-amber-400 bg-amber-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex justify-between items-baseline">
              <div className="font-semibold text-slate-900">
                {v.personaName ?? v.personaId}
              </div>
              <div className="text-xs font-mono text-slate-600">
                {v.vote} · {Math.round((v.confidence ?? 0) * 100)}%
              </div>
            </div>
            <div className="text-sm text-slate-700 mt-1">{v.rationale}</div>
            {v.blockers?.length > 0 && (
              <div className="text-xs text-red-700 mt-2 font-mono">
                blockers: {v.blockers.join(", ")}
              </div>
            )}
            {v.conditions?.length > 0 && (
              <div className="text-xs text-slate-600 mt-1 font-mono">
                conditions: {v.conditions.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
