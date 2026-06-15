import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronUp,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Users,
  BarChart3,
  Lock,
  ExternalLink,
  ArrowRight,
  Info,
  Gavel,
  Activity,
  TrendingDown,
  BookOpen,
  Mail,
} from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const VALIDATION_CASES = [
  { id: 1, drug: "Torcetrapib", company: "Pfizer", area: "Cardiovascular", year: 2005, verdict: "WAIT", outcome: "FAILURE", ovs: 9.8, alignment: "CORRECT", votes: "0/8/2", financialImpact: "$21B market cap loss" },
  { id: 2, drug: "Semagacestat", company: "Eli Lilly", area: "Neurology", year: 2010, verdict: "WAIT", outcome: "FAILURE", ovs: 9.9, alignment: "CORRECT", votes: "1/5/4", financialImpact: "$3B+ write-off" },
  { id: 3, drug: "Muraglitazar", company: "Bristol-Myers Squibb", area: "Metabolic", year: 2005, verdict: "NO-GO", outcome: "WITHDRAWN", ovs: 10.0, alignment: "CORRECT", votes: "0/4/6", financialImpact: "Regulatory withdrawal" },
  { id: 4, drug: "Sofosbuvir", company: "Gilead Sciences", area: "Infectious Disease", year: 2012, verdict: "GO", outcome: "SUCCESS", ovs: 9.2, alignment: "CORRECT", votes: "8/2/0", financialImpact: "$84B acquisition" },
  { id: 5, drug: "Aducanumab", company: "Biogen / Eisai", area: "Neurology", year: 2019, verdict: "WAIT", outcome: "CONTROVERSIAL", ovs: 9.2, alignment: "PARTIAL", votes: "3/5/2", financialImpact: "$6B+ commercial failure" },
  { id: 6, drug: "Verubecestat", company: "Merck", area: "Neurology", year: 2016, verdict: "GO", outcome: "FAILURE", ovs: 4.5, alignment: "INCORRECT", votes: "6/2/2", financialImpact: "Phase III futility" },
  { id: 7, drug: "Evolocumab", company: "Amgen", area: "Cardiovascular", year: 2013, verdict: "GO", outcome: "SUCCESS", ovs: 9.8, alignment: "CORRECT", votes: "7/3/0", financialImpact: "$1B+ annual revenue" },
  { id: 8, drug: "Eteplirsen", company: "Sarepta", area: "Rare Disease", year: 2014, verdict: "GO", outcome: "APPROVED", ovs: 7.5, alignment: "PARTIAL", votes: "7/1/2", financialImpact: "Accelerated approval" },
  { id: 9, drug: "Ticagrelor", company: "AstraZeneca", area: "Cardiovascular", year: 2007, verdict: "WAIT", outcome: "SUCCESS", ovs: 9.7, alignment: "CORRECT", votes: "3/6/1", financialImpact: "$1.5B+ annual revenue" },
  { id: 10, drug: "Entrectinib", company: "Roche / Genentech", area: "Oncology", year: 2016, verdict: "GO", outcome: "SUCCESS", ovs: 8.65, alignment: "CORRECT", votes: "7/3/0", financialImpact: "Breakthrough approval" },
];

const PERSONAS = [
  { name: "Chief Biostatistician", vote: "WAIT", confidence: 95, icon: "📊", key_flag: "BP signal mechanistic investigation pending — +2 mmHg unexplained", color: "amber" },
  { name: "Clinical Pharmacologist", vote: "WAIT", confidence: 85, icon: "🔬", key_flag: "Competitive landscape discrepancy — BP signal not seen with other CETP inhibitors", color: "amber" },
  { name: "Regulatory Strategist", vote: "WAIT", confidence: 95, icon: "📋", key_flag: "Unvalidated surrogate-to-clinical pathway — HDL-C increase not validated as CV event surrogate", color: "amber" },
  { name: "Drug Safety Expert", vote: "WAIT", confidence: 95, icon: "⚕️", key_flag: "Unexplained BP signal requires mechanistic investigation before Phase III", color: "amber" },
  { name: "Portfolio Manager", vote: "WAIT", confidence: 90, icon: "💼", key_flag: "Potential off-target effect — financial pressure ($800M invested) flagged as bias risk", color: "amber" },
  { name: "Scientific Skeptic", vote: "WAIT", confidence: 95, icon: "🔍", key_flag: "Lack of mechanistic understanding — cannot attribute BP signal to CETP inhibition", color: "amber" },
  { name: "Commercial Assessor", vote: "WAIT", confidence: 85, icon: "📈", key_flag: "Uninvestigated BP signal undermines commercial case; Lipitor patent cliff creates pressure bias", color: "amber" },
  { name: "Patient Advocate", vote: "NO-GO", confidence: 95, icon: "🤝", key_flag: "DSMB charter gap — no explicit BP stopping rules in proposed Phase III charter", color: "red" },
  { name: "Quality / Compliance Expert", vote: "WAIT", confidence: 90, icon: "✅", key_flag: "Protocol gap — Phase III design does not include mandatory BP mechanistic sub-study", color: "amber" },
  { name: "Devil's Advocate", vote: "NO-GO", confidence: 85, icon: "⚡", key_flag: "Financial pressure documented — $800M investment and Lipitor patent cliff create advancement bias", color: "red" },
];

const CONSTITUTION_RULES = [
  { id: "PC-001", title: "Safety Signal Primacy", text: "Any unexplained safety signal in Phase II must be mechanistically investigated before Phase III advancement. Financial pressure does not override this requirement.", triggered: true },
  { id: "PC-002", title: "Surrogate Endpoint Validation", text: "Phase II surrogate endpoints must be validated as predictors of clinical outcomes before Phase III. HDL-C elevation is not a validated surrogate for cardiovascular event reduction.", triggered: true },
  { id: "PC-003", title: "Financial Pressure Disclosure", text: "When investment exceeds $500M or patent cliff pressure exists, the council must explicitly flag and document financial bias risk in the deliberation record.", triggered: true },
  { id: "PC-004", title: "Mechanistic Coherence", text: "The mechanism of action must be fully characterised before Phase III. Off-target effects must be investigated, not assumed benign.", triggered: true },
  { id: "PC-005", title: "DSMB Charter Adequacy", text: "Phase III DSMB charter must include explicit stopping rules for all Phase II safety signals before advancement is approved.", triggered: true },
  { id: "PC-006", title: "Competitive Signal Discordance", text: "When a safety signal is not observed in competing molecules with the same mechanism, the discordance must be mechanistically explained before advancement.", triggered: false },
  { id: "PC-007", title: "Independent Replication", text: "Phase II efficacy findings must be replicated in at least one independent cohort before Phase III advancement for primary endpoints.", triggered: false },
  { id: "PC-008", title: "Regulatory Alignment", text: "Regulatory pathway must be confirmed with FDA/EMA before Phase III initiation. Surrogate endpoint acceptance must be pre-agreed.", triggered: false },
  { id: "PC-009", title: "Patient Population Generalisability", text: "Phase II population must be representative of the intended Phase III population. Demographic gaps require bridging studies.", triggered: false },
  { id: "PC-010", title: "Evidence Boundary Integrity", text: "All council deliberations must be bounded by pre-decision evidence only. Post-failure data must be clearly separated in all documentation.", triggered: false },
];

const EVIDENCE_MANIFEST = [
  { id: "DOC-001", title: "Brousseau et al. (2004)", type: "Clinical Trial", source: "NEJM 350:1505-1515", date: "Apr 2004", status: "ADMITTED", note: "Primary Phase II efficacy data — HDL-C +46%, LDL-C −12%" },
  { id: "DOC-002", title: "Nissen et al. (2004)", type: "Phase II Safety", source: "NEJM 352:2109-2121", date: "Nov 2004", status: "ADMITTED", note: "Phase II safety data — BP signal +2 mmHg systolic identified" },
  { id: "DOC-003", title: "Pfizer Q3 2005 Earnings", type: "Financial Filing", source: "SEC 10-Q", date: "Nov 2005", status: "ADMITTED", note: "$800M torcetrapib investment disclosed; Lipitor patent cliff 2011 noted" },
  { id: "DOC-004", title: "CETP Mechanism Review", type: "Review Article", source: "Arterioscler Thromb Vasc Biol", date: "2003", status: "ADMITTED", note: "CETP inhibition mechanism — HDL maturation pathway" },
  { id: "DOC-005", title: "Anacetrapib Phase I Data", type: "Comparative", source: "Merck IND filing", date: "2005", status: "ADMITTED", note: "Competing CETP inhibitor — no BP signal observed in Phase I" },
  { id: "DOC-006", title: "ILLUMINATE Protocol (draft)", type: "Protocol", source: "ClinicalTrials.gov", date: "Dec 2005", status: "ADMITTED", note: "Phase III protocol — DSMB charter reviewed; no BP stopping rules identified" },
  { id: "DOC-007", title: "Forrest et al. (2008)", type: "Mechanism Study", source: "NEJM 359:789-799", date: "Aug 2008", status: "EXCLUDED — POST-CUTOFF", note: "Off-target aldosterone mechanism confirmed. EXCLUDED from council input." },
];

const FAQ_ITEMS = [
  { q: "The AI already knew the answer — the model was trained on post-failure data.", a: "This is the most important objection and we disclose it explicitly. The LLM used in council deliberations has a training cutoff that may include post-failure data. We cannot fully override this with a prompt instruction. Our current evidence boundary is Tier 1: documented and disclosed, not technically enforced. We are building Tier 2 (document-retrieval architecture with verified pre-cutoff corpus) over the next 3–4 months. Until then, every case report carries a prominent LLM limitation disclosure. We do not claim the model is blind to outcomes — we claim the governance architecture is valuable regardless." },
  { q: "This is just a language model generating plausible text.", a: "The council output is text. The value is not in the text — it is in the governance architecture: structured deliberation, constitutional rules, evidence boundary, audit trail, and vote distribution. A human council with the same constitution and the same evidence would have produced the same WAIT verdict. The LLM operationalises the governance framework at scale." },
  { q: "You selected famous cases — of course the council gets them right.", a: "Correct. The 10 initial cases include some of the most cited pharmaceutical failures in the literature. This is disclosed as case selection bias. We are pre-specifying the next 40 cases using published criteria before executing any deliberations. The selection criteria are available on GitHub." },
  { q: "The BP signal was well-known. Any competent reviewer would have flagged it.", a: "Correct — and that is precisely the finding. Pfizer had access to competent reviewers. The governance failure was not a lack of knowledge; it was a lack of a structured, documented, constitutional process that required the signal to be mechanistically resolved before advancement. The council's value is not signal identification — it is governance enforcement." },
  { q: "What about verubecestat? The council issued a GO and the drug failed.", a: "Verubecestat is our documented failure case. The council issued a GO (6/2/2). The Phase III EPOCH trial was terminated for futility in 2017. The failure is attributed to a constitutional gap: PC-011 (Alzheimer's Disease Evidence Threshold) was not yet in the constitution. This case is reported honestly in every document. We do not hide failures." },
  { q: "How do you handle contradictory verdicts between personas?", a: "Vote distribution is the output, not consensus. A 6/2/2 split is a different governance signal than 0/8/2. The constitution specifies escalation thresholds: any NO-GO vote triggers mandatory safety review; any split of 4+ WAIT/NO-GO triggers a WAIT verdict regardless of GO majority." },
  { q: "What is the sample size? 10 cases is not statistically significant.", a: "Correct. At 10 cases, we cannot claim statistical significance. We can report descriptive statistics: 70% strict alignment, 90% broad alignment, 0% false positive rate, 80% failure detection rate. We are targeting 50 cases for the first peer-review submission. We do not make statistical claims beyond what the data supports." },
  { q: "What regulatory status does this have?", a: "None. AgenThink's council methodology has no regulatory approval, clearance, or certification from FDA, EMA, or any regulatory body. It is not a regulatory submission tool. It is a governance and decision-support framework. Any regulatory use would require independent validation and regulatory engagement." },
  { q: "What does a 30-day pilot actually produce?", a: "One retrospective case run with your team's selected drug. Full council deliberation with 10 personas. Evidence manifest with all admitted and excluded documents. Institutional Proof Report with vote distribution, constitutional rules triggered, and blocker analysis. Retrospective outcome appendix. Methodology documentation sufficient for internal review. Delivered within 30 days." },
  { q: "How is the evidence boundary enforced technically?", a: "Currently: documented and disclosed (Tier 1). The evidence manifest lists every document admitted to the council with source, date, and admissibility decision. Excluded documents are listed with exclusion reason. Technical enforcement (Tier 2: document-retrieval architecture with verified pre-cutoff corpus) is in development. We disclose this limitation in every case report." },
  { q: "What is the cost of a 30-day pilot?", a: "$25,000 for a single retrospective case. Includes full council deliberation, evidence manifest, Institutional Proof Report, and methodology documentation. Payment is milestone-based: 50% on engagement, 50% on delivery." },
  { q: "Who are the 10 personas? Are they real people?", a: "No. The 10 personas are defined roles: Chief Biostatistician, Clinical Pharmacologist, Regulatory Strategist, Drug Safety Expert, Portfolio Manager, Scientific Skeptic, Commercial Assessor, Patient Advocate, Quality/Compliance Expert, and Devil's Advocate. Each is an LLM instantiation with a defined role, constitutional obligations, and voting weight. They are not real individuals." },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  const map: Record<string, string> = {
    GO: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    WAIT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "NO-GO": "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border ${map[verdict] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
      {verdict}
    </span>
  );
}

function AlignmentBadge({ alignment }: { alignment: string }) {
  const map: Record<string, string> = {
    CORRECT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    PARTIAL: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    INCORRECT: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${map[alignment] ?? ""}`}>
      {alignment}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    SUCCESS: "text-emerald-400",
    APPROVED: "text-emerald-400",
    FAILURE: "text-red-400",
    WITHDRAWN: "text-red-400",
    CONTROVERSIAL: "text-amber-400",
  };
  return <span className={`text-xs font-mono ${map[outcome] ?? "text-slate-400"}`}>{outcome}</span>;
}

function SectionHeader({ id, label, icon: Icon }: { id: string; label: string; icon: React.ElementType }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-8 pt-4">
      <div className="w-8 h-8 rounded-lg bg-[oklch(0.22_0.06_255)] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[oklch(0.72_0.010_255)]" />
      </div>
      <h2 className="text-xl font-semibold text-[oklch(0.93_0.004_255)] tracking-tight">{label}</h2>
      <div className="flex-1 h-px bg-[oklch(0.22_0.06_255)]" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PharmaDemoPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedPersona, setExpandedPersona] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "manifest" | "brief">("timeline");

  const stats = {
    total: 10,
    correct: 7,
    partial: 2,
    incorrect: 1,
    avgOvs: (VALIDATION_CASES.reduce((s, c) => s + c.ovs, 0) / 10).toFixed(1),
    fpRate: "0%",
    fnRate: "20%",
  };

  return (
    <div className="min-h-screen" style={{ background: "#0B1629", color: "#E2E8F0" }}>

      {/* ── Disclosure strip ── */}
      <div className="bg-[oklch(0.17_0.05_255)] border-b border-[oklch(0.22_0.06_255)] px-4 py-2">
        <p className="text-center text-xs text-[oklch(0.63_0.012_255)] font-mono">
          RESEARCH DEMONSTRATION ONLY — Not for regulatory use. LLM limitation disclosed.{" "}
          <a href="#governance" className="underline hover:text-[oklch(0.80_0.008_255)]">View evidence boundary statement →</a>
        </p>
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[oklch(0.13_0.04_255)]/95 backdrop-blur border-b border-[oklch(0.22_0.06_255)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-[oklch(0.63_0.012_255)]">AGENTHINKMESH</span>
            <span className="text-[oklch(0.35_0.08_255)]">/</span>
            <span className="text-sm font-semibold text-[oklch(0.93_0.004_255)]">Pharma Council</span>
            <Badge variant="outline" className="text-xs font-mono border-amber-500/40 text-amber-400 ml-1">DEMO</Badge>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs font-mono text-[oklch(0.63_0.012_255)]">
            {[["#library", "Library"], ["#torcetrapib", "Case"], ["#council", "Council"], ["#governance", "Governance"], ["#pilot", "Pilot"]].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-[oklch(0.93_0.004_255)] transition-colors">{label}</a>
            ))}
          </div>
          <Button size="sm" className="bg-[oklch(0.38_0.08_255)] hover:bg-[oklch(0.35_0.08_255)] text-white text-xs font-mono">
            <Mail className="w-3 h-3 mr-1.5" /> Request Pilot
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24">

        {/* ── SECTION 1: HERO ── */}
        <section id="hero" className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[oklch(0.22_0.06_255)] border border-[oklch(0.28_0.07_255)] text-xs font-mono text-[oklch(0.63_0.012_255)]">
            <Activity className="w-3 h-3" />
            PHARMA VALIDATION LIBRARY v1.0 — 10 CASES COMPLETED
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[oklch(0.97_0.002_255)] leading-none">
              The Council Said{" "}
              <span className="text-amber-400">WAIT.</span>
            </h1>
            <p className="text-xl sm:text-2xl text-[oklch(0.63_0.012_255)] font-light max-w-3xl mx-auto">
              Torcetrapib. Phase III advanced. 82 deaths. $21B lost.
            </p>
          </div>

          <p className="text-base text-[oklch(0.72_0.010_255)] max-w-2xl mx-auto leading-relaxed">
            In 2005, Pfizer had a Phase II blood pressure signal they could not explain. A structured 10-persona council, bounded to pre-decision evidence, voted 0 GO / 8 WAIT / 2 NO-GO. Pfizer advanced anyway. The ILLUMINATE trial was terminated December 2, 2006.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="bg-[oklch(0.38_0.08_255)] hover:bg-[oklch(0.35_0.08_255)] text-white font-mono" asChild>
              <a href="#torcetrapib">Explore the Case <ArrowRight className="ml-2 w-4 h-4" /></a>
            </Button>
            <Button size="lg" variant="outline" className="border-[oklch(0.28_0.07_255)] text-[oklch(0.80_0.008_255)] hover:bg-[oklch(0.17_0.05_255)] font-mono" asChild>
              <a href="#library">View All 10 Cases</a>
            </Button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto pt-8">
            {[
              { label: "Cases Completed", value: "10" },
              { label: "Alignment Rate", value: "90%" },
              { label: "False Positive Rate", value: "0%" },
              { label: "Avg OVS", value: stats.avgOvs + "/10" },
            ].map((s) => (
              <div key={s.label} className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[oklch(0.97_0.002_255)] font-mono">{s.value}</div>
                <div className="text-xs text-[oklch(0.63_0.012_255)] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 2: VALIDATION LIBRARY ── */}
        <section id="library">
          <SectionHeader id="library-header" label="Validation Library" icon={BarChart3} />

          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Correct", value: stats.correct, color: "text-emerald-400" },
              { label: "Partial", value: stats.partial, color: "text-amber-400" },
              { label: "Incorrect", value: stats.incorrect, color: "text-red-400" },
              { label: "Total", value: stats.total, color: "text-[oklch(0.93_0.004_255)]" },
            ].map((s) => (
              <div key={s.label} className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs text-[oklch(0.63_0.012_255)]">{s.label}</span>
                <span className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[oklch(0.22_0.06_255)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[oklch(0.17_0.05_255)] border-b border-[oklch(0.22_0.06_255)]">
                  {["#", "Drug", "Company", "Area", "Year", "Verdict", "Vote (G/W/N)", "OVS", "Outcome", "Alignment"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[oklch(0.63_0.012_255)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VALIDATION_CASES.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b border-[oklch(0.22_0.06_255)] hover:bg-[oklch(0.17_0.05_255)]/50 transition-colors ${c.id === 1 ? "bg-amber-500/5" : ""}`}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-[oklch(0.63_0.012_255)]">{c.id}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${c.id === 1 ? "text-amber-400" : "text-[oklch(0.93_0.004_255)]"}`}>
                        {c.drug}
                        {c.id === 1 && <span className="ml-1.5 text-xs font-mono text-amber-500/70">★ FLAGSHIP</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[oklch(0.72_0.010_255)]">{c.company}</td>
                    <td className="px-4 py-3 text-xs text-[oklch(0.63_0.012_255)]">{c.area}</td>
                    <td className="px-4 py-3 text-xs font-mono text-[oklch(0.63_0.012_255)]">{c.year}</td>
                    <td className="px-4 py-3"><VerdictBadge verdict={c.verdict} /></td>
                    <td className="px-4 py-3 text-xs font-mono text-[oklch(0.72_0.010_255)]">{c.votes}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-mono font-bold ${c.ovs >= 9 ? "text-emerald-400" : c.ovs >= 7 ? "text-amber-400" : "text-red-400"}`}>
                        {c.ovs}
                      </span>
                    </td>
                    <td className="px-4 py-3"><OutcomeBadge outcome={c.outcome} /></td>
                    <td className="px-4 py-3"><AlignmentBadge alignment={c.alignment} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-lg">
            <p className="text-xs text-[oklch(0.63_0.012_255)] font-mono">
              <span className="text-amber-400">DISCLOSURE:</span> Cases were selected from historically significant Phase II→III decisions. Selection bias is documented. Case selection criteria for Cases 11–50 are pre-specified. Statistical significance requires n≥20. Current metrics are descriptive only.
            </p>
          </div>
        </section>

        {/* ── SECTION 3: TORCETRAPIB DEEP DIVE ── */}
        <section id="torcetrapib">
          <SectionHeader id="torcetrapib-header" label="Torcetrapib — Deep Dive" icon={TrendingDown} />

          {/* Tab selector */}
          <div className="flex gap-1 mb-6 bg-[oklch(0.17_0.05_255)] p-1 rounded-lg w-fit">
            {(["timeline", "manifest", "brief"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-xs font-mono transition-colors ${activeTab === tab ? "bg-[oklch(0.22_0.06_255)] text-[oklch(0.93_0.004_255)]" : "text-[oklch(0.63_0.012_255)] hover:text-[oklch(0.80_0.008_255)]"}`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {activeTab === "timeline" && (
            <div className="space-y-4">
              {[
                { date: "2001–2003", label: "CETP Inhibitor Discovery", detail: "Pfizer identifies torcetrapib as a potent CETP inhibitor. Mechanism: raises HDL-C by blocking cholesteryl ester transfer protein. Preclinical data shows +40–60% HDL-C increase.", type: "neutral" },
                { date: "2004 (Apr)", label: "Phase II Efficacy — Brousseau et al.", detail: "NEJM 350:1505-1515. HDL-C +46%, LDL-C −12%. Efficacy signal confirmed. No safety concerns reported in primary endpoint analysis.", type: "positive" },
                { date: "2004 (Nov)", label: "Phase II Safety Signal — Nissen et al.", detail: "NEJM 352:2109-2121. Blood pressure increase of +2 mmHg systolic observed. Signal is statistically significant. Mechanism not explained. Not seen with competing CETP inhibitors (anacetrapib).", type: "warning" },
                { date: "2005 (Q3)", label: "Pfizer Advancement Decision", detail: "$800M invested. Lipitor patent cliff 2011. ILLUMINATE Phase III initiated. DSMB charter does not include explicit BP stopping rules. Council evidence cutoff: December 31, 2005.", type: "warning" },
                { date: "2006 (Dec 2)", label: "ILLUMINATE Terminated", detail: "Independent DSMB terminates trial. 82 deaths in torcetrapib arm vs 51 in control arm. Pfizer halts all torcetrapib development. $800M write-off. Market cap loss: $21B in one trading session.", type: "failure" },
                { date: "2008 (Aug)", label: "Mechanism Confirmed — Forrest et al.", detail: "NEJM 359:789-799. Off-target aldosterone stimulation confirmed as cause of BP elevation. The Phase II signal was real, molecule-specific, and fatal. NOTE: This data was EXCLUDED from council input.", type: "excluded" },
              ].map((event) => {
                const colors: Record<string, string> = {
                  neutral: "border-[oklch(0.35_0.08_255)] bg-[oklch(0.17_0.05_255)]",
                  positive: "border-emerald-500/30 bg-emerald-500/5",
                  warning: "border-amber-500/30 bg-amber-500/5",
                  failure: "border-red-500/30 bg-red-500/10",
                  excluded: "border-[oklch(0.35_0.08_255)] bg-[oklch(0.17_0.05_255)] opacity-60",
                };
                const dotColors: Record<string, string> = {
                  neutral: "bg-[oklch(0.63_0.012_255)]",
                  positive: "bg-emerald-400",
                  warning: "bg-amber-400",
                  failure: "bg-red-400",
                  excluded: "bg-[oklch(0.52_0.02_255)]",
                };
                return (
                  <div key={event.date} className={`flex gap-4 p-4 rounded-lg border ${colors[event.type]}`}>
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full mt-1 ${dotColors[event.type]}`} />
                      <div className="w-px flex-1 bg-[oklch(0.22_0.06_255)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <span className="text-xs font-mono text-[oklch(0.63_0.012_255)]">{event.date}</span>
                        {event.type === "excluded" && (
                          <Badge variant="outline" className="text-xs border-[oklch(0.35_0.08_255)] text-[oklch(0.52_0.02_255)]">POST-CUTOFF — EXCLUDED</Badge>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[oklch(0.93_0.004_255)] mt-0.5">{event.label}</p>
                      <p className="text-xs text-[oklch(0.72_0.010_255)] mt-1 leading-relaxed">{event.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "manifest" && (
            <div className="space-y-3">
              <div className="p-3 bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-lg mb-4">
                <p className="text-xs font-mono text-[oklch(0.63_0.012_255)]">
                  <span className="text-amber-400">EVIDENCE CUTOFF:</span> December 31, 2005 — All documents dated after this date are EXCLUDED from council input. Post-failure data appears only in the Retrospective Appendix.
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[oklch(0.22_0.06_255)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[oklch(0.17_0.05_255)] border-b border-[oklch(0.22_0.06_255)]">
                      {["ID", "Document", "Type", "Source", "Date", "Status", "Note"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[oklch(0.63_0.012_255)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EVIDENCE_MANIFEST.map((doc) => (
                      <tr key={doc.id} className={`border-b border-[oklch(0.22_0.06_255)] ${doc.status.includes("EXCLUDED") ? "opacity-50" : "hover:bg-[oklch(0.17_0.05_255)]/50"}`}>
                        <td className="px-4 py-3 text-xs font-mono text-[oklch(0.63_0.012_255)]">{doc.id}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-[oklch(0.93_0.004_255)]">{doc.title}</td>
                        <td className="px-4 py-3 text-xs text-[oklch(0.72_0.010_255)]">{doc.type}</td>
                        <td className="px-4 py-3 text-xs font-mono text-[oklch(0.63_0.012_255)]">{doc.source}</td>
                        <td className="px-4 py-3 text-xs font-mono text-[oklch(0.63_0.012_255)]">{doc.date}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${doc.status.includes("EXCLUDED") ? "border-red-500/30 text-red-400 bg-red-500/10" : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"}`}>
                            {doc.status.includes("EXCLUDED") ? "EXCLUDED" : "ADMITTED"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[oklch(0.63_0.012_255)] max-w-xs">{doc.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "brief" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Drug", value: "Torcetrapib" },
                { label: "Company", value: "Pfizer Inc." },
                { label: "Mechanism", value: "CETP inhibitor — raises HDL-C by blocking cholesteryl ester transfer protein" },
                { label: "Decision", value: "Advance Phase II → Phase III (ILLUMINATE)" },
                { label: "Evidence Cutoff", value: "December 31, 2005" },
                { label: "Phase II HDL-C Effect", value: "+46% (Brousseau et al., NEJM 2004)" },
                { label: "Phase II LDL-C Effect", value: "−12% (Brousseau et al., NEJM 2004)" },
                { label: "Phase II BP Signal", value: "+2 mmHg systolic — UNEXPLAINED (Nissen et al., NEJM 2004)" },
                { label: "Investment at Decision", value: "$800M (Pfizer Q3 2005 10-Q)" },
                { label: "Financial Pressure", value: "Lipitor patent cliff 2011 — documented bias risk" },
                { label: "Competing CETP Inhibitor", value: "Anacetrapib (Merck) — no BP signal in Phase I" },
                { label: "Phase III Charter Gap", value: "No explicit BP stopping rules in DSMB charter" },
              ].map((item) => (
                <div key={item.label} className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-lg p-4">
                  <div className="text-xs font-mono text-[oklch(0.63_0.012_255)] mb-1">{item.label}</div>
                  <div className={`text-sm font-medium ${item.label.includes("BP Signal") || item.label.includes("Charter Gap") ? "text-amber-400" : "text-[oklch(0.93_0.004_255)]"}`}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── SECTION 4: COUNCIL CHAMBER ── */}
        <section id="council">
          <SectionHeader id="council-header" label="Council Chamber" icon={Users} />

          {/* Vote summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "GO", count: 0, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
              { label: "WAIT", count: 8, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
              { label: "NO-GO", count: 2, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
            ].map((v) => (
              <div key={v.label} className={`rounded-xl border p-6 text-center ${v.bg}`}>
                <div className={`text-4xl font-bold font-mono ${v.color}`}>{v.count}</div>
                <div className={`text-sm font-mono mt-1 ${v.color}`}>{v.label}</div>
              </div>
            ))}
          </div>

          {/* Verdict */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-8 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-lg font-bold text-amber-400 font-mono">FINAL VERDICT: WAIT</div>
              <p className="text-sm text-[oklch(0.80_0.008_255)] mt-1">
                Unanimous WAIT/NO-GO. Primary blocker: unexplained blood pressure signal (+2 mmHg systolic) requires mechanistic investigation before Phase III advancement. Constitutional rules PC-001, PC-002, PC-003, PC-004, PC-005 triggered.
              </p>
            </div>
          </div>

          {/* Persona cards */}
          <div className="space-y-3">
            {PERSONAS.map((p, i) => (
              <div key={p.name} className="border border-[oklch(0.22_0.06_255)] rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-4 p-4 hover:bg-[oklch(0.17_0.05_255)]/50 transition-colors text-left"
                  onClick={() => setExpandedPersona(expandedPersona === i ? null : i)}
                >
                  <span className="text-xl flex-shrink-0">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[oklch(0.93_0.004_255)]">{p.name}</span>
                      <VerdictBadge verdict={p.vote} />
                      <span className="text-xs font-mono text-[oklch(0.63_0.012_255)]">{p.confidence}% confidence</span>
                    </div>
                    <p className="text-xs text-[oklch(0.63_0.012_255)] mt-0.5 truncate">{p.key_flag}</p>
                  </div>
                  {expandedPersona === i ? <ChevronUp className="w-4 h-4 text-[oklch(0.63_0.012_255)] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[oklch(0.63_0.012_255)] flex-shrink-0" />}
                </button>
                {expandedPersona === i && (
                  <div className="px-4 pb-4 pt-0 border-t border-[oklch(0.22_0.06_255)] bg-[oklch(0.17_0.05_255)]/30">
                    <div className="mt-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-[oklch(0.63_0.012_255)] flex-shrink-0 mt-0.5">PRIMARY FLAG:</span>
                        <span className="text-xs text-[oklch(0.80_0.008_255)]">{p.key_flag}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[oklch(0.63_0.012_255)]">VOTE:</span>
                        <VerdictBadge verdict={p.vote} />
                        <span className="text-xs font-mono text-[oklch(0.63_0.012_255)]">at {p.confidence}% confidence</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 5: GOVERNANCE LAYER ── */}
        <section id="governance">
          <SectionHeader id="governance-header" label="Governance Layer" icon={Shield} />

          {/* Evidence boundary statement */}
          <div className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.28_0.07_255)] rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[oklch(0.72_0.010_255)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-[oklch(0.93_0.004_255)] mb-2">Evidence Boundary Statement — EBS-001</div>
                <p className="text-xs text-[oklch(0.72_0.010_255)] leading-relaxed mb-3">
                  All evidence provided to the council is dated on or before <strong className="text-[oklch(0.93_0.004_255)]">December 31, 2005</strong>. The ILLUMINATE Phase III trial results (December 2, 2006), the 82 vs 51 death finding, the $800M write-off, the market cap loss, and the Forrest et al. 2008 off-target mechanism confirmation are <strong className="text-red-400">EXCLUDED</strong> from council input. These post-failure data points appear only in the Retrospective Outcome Appendix, clearly separated from the council deliberation record.
                </p>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-xs font-mono text-amber-400">
                    LLM LIMITATION DISCLOSURE (LDS-001): The language model used in this council deliberation has a training cutoff that may include post-failure data for torcetrapib. We cannot fully override this with a prompt instruction. The evidence boundary is documented and disclosed (Tier 1) but not technically enforced (Tier 2 in development). This limitation is disclosed in all case documentation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Constitution */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Gavel className="w-4 h-4 text-[oklch(0.72_0.010_255)]" />
              <span className="text-sm font-semibold text-[oklch(0.93_0.004_255)]">Pharma Constitution v1 — 10 Rules</span>
              <Badge variant="outline" className="text-xs font-mono border-[oklch(0.28_0.07_255)] text-[oklch(0.63_0.012_255)]">FROZEN</Badge>
            </div>
            <div className="space-y-2">
              {CONSTITUTION_RULES.map((rule) => (
                <div key={rule.id} className={`flex gap-3 p-4 rounded-lg border ${rule.triggered ? "border-amber-500/30 bg-amber-500/5" : "border-[oklch(0.22_0.06_255)] bg-[oklch(0.17_0.05_255)]/30"}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {rule.triggered
                      ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                      : <CheckCircle2 className="w-4 h-4 text-[oklch(0.52_0.02_255)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-[oklch(0.63_0.012_255)]">{rule.id}</span>
                      <span className="text-sm font-semibold text-[oklch(0.93_0.004_255)]">{rule.title}</span>
                      {rule.triggered && <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400">TRIGGERED</Badge>}
                    </div>
                    <p className="text-xs text-[oklch(0.72_0.010_255)] mt-1 leading-relaxed">{rule.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 6: INSTITUTIONAL PROOF REPORT ── */}
        <section id="proof-report">
          <SectionHeader id="proof-header" label="Institutional Proof Report" icon={FileText} />

          <div className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-xl overflow-hidden">
            {/* Report header */}
            <div className="p-6 border-b border-[oklch(0.22_0.06_255)]">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs font-mono text-[oklch(0.63_0.012_255)] mb-1">INSTITUTIONAL PROOF REPORT</div>
                  <h3 className="text-lg font-bold text-[oklch(0.97_0.002_255)]">Torcetrapib — Phase II → III Advancement</h3>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs font-mono text-[oklch(0.63_0.012_255)]">Session: PHARMA-RETRO-TORCETRAPIB-001</span>
                    <span className="text-xs font-mono text-[oklch(0.63_0.012_255)]">Constitution: v1.0</span>
                    <span className="text-xs font-mono text-[oklch(0.63_0.012_255)]">Evidence Cutoff: 2005-12-31</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold font-mono text-amber-400">WAIT</div>
                  <div className="text-xs font-mono text-[oklch(0.63_0.012_255)] mt-1">0 GO / 8 WAIT / 2 NO-GO</div>
                  <div className="text-xs font-mono text-emerald-400 mt-1">OVS: 9.8 / 10</div>
                </div>
              </div>
            </div>

            {/* Report sections */}
            <div className="divide-y divide-[oklch(0.22_0.06_255)]">
              {[
                {
                  title: "Decision Drivers",
                  content: [
                    "PRIMARY: Unexplained blood pressure signal (+2 mmHg systolic) with no mechanistic explanation",
                    "SECONDARY: Unvalidated surrogate endpoint — HDL-C elevation not confirmed as CV event surrogate",
                    "TERTIARY: Financial pressure bias — $800M investment and Lipitor patent cliff documented",
                    "QUATERNARY: DSMB charter gap — no explicit BP stopping rules in Phase III protocol",
                  ],
                },
                {
                  title: "Governance Findings",
                  content: [
                    "5 constitutional rules triggered: PC-001, PC-002, PC-003, PC-004, PC-005",
                    "Vote distribution: 0 GO / 8 WAIT / 2 NO-GO — unanimous WAIT/NO-GO",
                    "Highest-confidence blocker: PC-001 Safety Signal Primacy (95% confidence, 9 of 10 personas)",
                    "Financial pressure flag: PC-003 triggered — $800M investment documented as bias risk",
                  ],
                },
                {
                  title: "Release Gate Determination",
                  content: [
                    "GATE STATUS: BLOCKED — Phase III advancement not approved",
                    "Required to unblock: Mechanistic investigation of BP signal (minimum 6-month study)",
                    "Required to unblock: HDL-C surrogate validation or alternative primary endpoint",
                    "Required to unblock: DSMB charter amendment with explicit BP stopping rules",
                  ],
                },
                {
                  title: "Retrospective Outcome (Post-Decision Data — Excluded from Council Input)",
                  content: [
                    "ILLUMINATE trial terminated: December 2, 2006",
                    "Deaths: 82 (torcetrapib arm) vs 51 (control arm)",
                    "Financial impact: $800M write-off + $21B market cap loss",
                    "Mechanism confirmed (Forrest et al., NEJM 2008): Off-target aldosterone stimulation — the Phase II BP signal was real, molecule-specific, and fatal",
                    "COUNCIL VERDICT RETROSPECTIVELY CORRECT",
                  ],
                },
              ].map((section) => (
                <div key={section.title} className="p-6">
                  <h4 className="text-xs font-mono text-[oklch(0.63_0.012_255)] uppercase tracking-wider mb-3">{section.title}</h4>
                  <ul className="space-y-2">
                    {section.content.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[oklch(0.52_0.02_255)] text-xs mt-0.5 flex-shrink-0">—</span>
                        <span className={`text-xs leading-relaxed ${item.includes("CORRECT") ? "text-emerald-400 font-semibold" : item.includes("BLOCKED") ? "text-red-400 font-semibold" : item.includes("Post-Decision") ? "text-[oklch(0.52_0.02_255)]" : "text-[oklch(0.80_0.008_255)]"}`}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Proof score */}
            <div className="p-6 bg-[oklch(0.13_0.04_255)] border-t border-[oklch(0.22_0.06_255)] flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs font-mono text-[oklch(0.63_0.012_255)]">PROOF SCORE</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">93 / 100</div>
                </div>
                <Separator orientation="vertical" className="h-10 bg-[oklch(0.22_0.06_255)]" />
                <div>
                  <div className="text-xs font-mono text-[oklch(0.63_0.012_255)]">AUDIT REFERENCES</div>
                  <div className="text-xs text-[oklch(0.72_0.010_255)] font-mono">AUD-001 through AUD-007</div>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-mono text-xs">RETROSPECTIVELY VALIDATED</Badge>
            </div>
          </div>
        </section>

        {/* ── SECTION 7: PILOT PROPOSAL ── */}
        <section id="pilot">
          <SectionHeader id="pilot-header" label="30-Day Retrospective Pilot" icon={BookOpen} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main proposal */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-xl p-6">
                <h3 className="text-base font-semibold text-[oklch(0.93_0.004_255)] mb-4">What You Get</h3>
                <div className="space-y-3">
                  {[
                    { icon: FileText, label: "Institutional Proof Report", detail: "Full council deliberation record with vote distribution, constitutional rules triggered, blocker analysis, and audit trail" },
                    { icon: Users, label: "10-Persona Council Run", detail: "Complete deliberation with all 10 personas — Chief Biostatistician, Clinical Pharmacologist, Regulatory Strategist, Drug Safety Expert, Portfolio Manager, Scientific Skeptic, Commercial Assessor, Patient Advocate, Quality/Compliance Expert, Devil's Advocate" },
                    { icon: Lock, label: "Evidence Manifest", detail: "Complete inventory of all admitted and excluded documents with source, date, and admissibility decision" },
                    { icon: Shield, label: "Constitutional Audit", detail: "All 10 Pharma Constitution v1 rules evaluated — triggered rules documented with evidence citations" },
                    { icon: Activity, label: "Retrospective Outcome Appendix", detail: "Post-decision outcome data clearly separated from council input — validation of verdict accuracy" },
                    { icon: FileText, label: "Methodology Documentation", detail: "Full methodology sufficient for internal review, legal review, and independent replication" },
                  ].map((item) => (
                    <div key={item.label} className="flex gap-3">
                      <item.icon className="w-4 h-4 text-[oklch(0.63_0.012_255)] flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-[oklch(0.93_0.004_255)]">{item.label}</div>
                        <div className="text-xs text-[oklch(0.63_0.012_255)] mt-0.5">{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-xl p-6">
                <h3 className="text-base font-semibold text-[oklch(0.93_0.004_255)] mb-4">30-Day Timeline</h3>
                <div className="space-y-3">
                  {[
                    { days: "Days 1–5", label: "Case Selection & Scoping", detail: "Select drug, define evidence cutoff, agree on council configuration" },
                    { days: "Days 6–12", label: "Evidence Corpus Assembly", detail: "Compile all pre-cutoff documents, build evidence manifest, confirm admissibility" },
                    { days: "Days 13–20", label: "Council Deliberation", detail: "10-persona council run, vote collection, constitutional audit" },
                    { days: "Days 21–26", label: "IPR Generation", detail: "Institutional Proof Report drafted, retrospective appendix compiled" },
                    { days: "Days 27–30", label: "Delivery & Review", detail: "Final report delivered, methodology documentation, debrief call" },
                  ].map((step) => (
                    <div key={step.days} className="flex gap-4">
                      <div className="text-xs font-mono text-[oklch(0.63_0.012_255)] w-24 flex-shrink-0 pt-0.5">{step.days}</div>
                      <div>
                        <div className="text-sm font-semibold text-[oklch(0.93_0.004_255)]">{step.label}</div>
                        <div className="text-xs text-[oklch(0.63_0.012_255)]">{step.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pricing card */}
            <div className="space-y-4">
              <div className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.38_0.08_255)]/50 rounded-xl p-6">
                <div className="text-xs font-mono text-[oklch(0.63_0.012_255)] mb-1">30-DAY PILOT</div>
                <div className="text-3xl font-bold font-mono text-[oklch(0.97_0.002_255)]">$25,000</div>
                <div className="text-xs text-[oklch(0.63_0.012_255)] mt-1">Single retrospective case</div>
                <Separator className="my-4 bg-[oklch(0.22_0.06_255)]" />
                <ul className="space-y-2 mb-6">
                  {["1 drug case", "10-persona council", "Evidence manifest", "Institutional Proof Report", "Methodology documentation", "Debrief call"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-[oklch(0.72_0.010_255)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-[oklch(0.63_0.012_255)] mb-4">Payment: 50% on engagement, 50% on delivery</div>
                <Button className="w-full bg-[oklch(0.38_0.08_255)] hover:bg-[oklch(0.35_0.08_255)] text-white font-mono text-sm">
                  <Mail className="w-4 h-4 mr-2" /> Request Pilot
                </Button>
              </div>

              <div className="bg-[oklch(0.17_0.05_255)] border border-[oklch(0.22_0.06_255)] rounded-xl p-4">
                <div className="text-xs font-mono text-[oklch(0.63_0.012_255)] mb-2">WHAT THIS IS NOT</div>
                <ul className="space-y-1.5">
                  {[
                    "Not a regulatory submission tool",
                    "Not a replacement for human review",
                    "Not a prospective decision system",
                    "Not statistically validated at n=10",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-[oklch(0.63_0.012_255)]">
                      <XCircle className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 8: FAQ ── */}
        <section id="faq">
          <SectionHeader id="faq-header" label="Frequently Asked Questions" icon={Info} />
          <p className="text-sm text-[oklch(0.63_0.012_255)] mb-6">
            The 12 hardest objections we receive — answered directly, without marketing language.
          </p>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-[oklch(0.22_0.06_255)] rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-start gap-3 p-4 hover:bg-[oklch(0.17_0.05_255)]/50 transition-colors text-left"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <span className="text-xs font-mono text-[oklch(0.52_0.02_255)] flex-shrink-0 mt-0.5">Q{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-sm font-medium text-[oklch(0.93_0.004_255)]">{item.q}</span>
                  {expandedFaq === i ? <ChevronUp className="w-4 h-4 text-[oklch(0.63_0.012_255)] flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-[oklch(0.63_0.012_255)] flex-shrink-0 mt-0.5" />}
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4 pt-0 border-t border-[oklch(0.22_0.06_255)] bg-[oklch(0.17_0.05_255)]/30">
                    <p className="text-sm text-[oklch(0.72_0.010_255)] leading-relaxed mt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER CTA ── */}
        <section className="text-center py-12 border-t border-[oklch(0.22_0.06_255)]">
          <h2 className="text-2xl font-bold text-[oklch(0.97_0.002_255)] mb-3">Ready to run a retrospective pilot?</h2>
          <p className="text-sm text-[oklch(0.63_0.012_255)] mb-6 max-w-xl mx-auto">
            Select a Phase II → III advancement decision from your pipeline. We'll run the council, produce the Institutional Proof Report, and deliver within 30 days.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="bg-[oklch(0.38_0.08_255)] hover:bg-[oklch(0.35_0.08_255)] text-white font-mono">
              <Mail className="w-4 h-4 mr-2" /> Request a Pilot
            </Button>
            <Button size="lg" variant="outline" className="border-[oklch(0.28_0.07_255)] text-[oklch(0.80_0.008_255)] hover:bg-[oklch(0.17_0.05_255)] font-mono" asChild>
              <a href="https://github.com/agenthinkmesh/pharma-council-v1" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" /> View Methodology
              </a>
            </Button>
          </div>
          <p className="text-xs font-mono text-[oklch(0.52_0.02_255)] mt-8">
            AgenThinkMesh Pharma Council v1 · Constitution v1.0 · 10 Cases Completed · Not for regulatory use
          </p>
        </section>

      </div>
    </div>
  );
}
