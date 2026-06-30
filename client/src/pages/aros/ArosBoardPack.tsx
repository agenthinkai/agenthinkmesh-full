/**
 * ArosBoardPack.tsx — Board Intelligence Pack
 *
 * The CEO selects a company, Atlas generates a board-quality 8-section
 * intelligence document, and the CEO downloads it as PDF, PPTX, or DOCX.
 *
 * Every section is derived from real operational Atlas data.
 * No fabricated examples. No simulated performance.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Presentation,
  FileType2,
  Building2,
  User,
  Globe,
  TrendingUp,
  Loader2,
  ChevronRight,
  Download,
  Shield,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: number;
  companyName: string;
  sector: string;
  country: string;
  ceoName: string | null;
  sss: number | null;
  esi: number | null;
  decisionLevel: string | null;
}

interface BoardPackSection {
  title: string;
  content: string;
  metadata?: Record<string, string | number | null>;
}

interface BoardPackData {
  packId: string;
  companyId: number;
  companyName: string;
  executiveName: string | null;
  generatedAt: number;
  constitutionVersion: string;
  modelVersion: string;
  sections: BoardPackSection[];
  auditTrail: {
    decisionTwinVersion: string;
    constitutionVersion: string;
    hiddenVariableVersion: string;
    evidenceManifestHash: string | null;
    generationTimestamp: number;
    modelVersion: string;
    packId: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Executive Summary": <Sparkles className="w-4 h-4" />,
  "Decision Twin": <BarChart3 className="w-4 h-4" />,
  "Executive Intelligence Brief": <BookOpen className="w-4 h-4" />,
  "Institutional Proof": <Shield className="w-4 h-4" />,
  "Calibration": <TrendingUp className="w-4 h-4" />,
  "Customer Proof": <CheckCircle2 className="w-4 h-4" />,
  "Recommendation": <ChevronRight className="w-4 h-4" />,
  "Audit Trail": <Clock className="w-4 h-4" />,
};

function decisionLevelColor(level: string | null): string {
  if (!level) return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  if (level === "LEVEL_1" || level === "BOARD") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (level === "LEVEL_2" || level === "C-SUITE") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (level === "LEVEL_3" || level === "DIVISIONAL") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return "text-slate-500";
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-amber-400";
  return "text-slate-400";
}

// ── Company Card ──────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  rank,
  isSelected,
  onClick,
}: {
  company: Company;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? "border-amber-500/60 bg-amber-500/10"
          : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-xs font-mono mt-0.5 w-5 flex-shrink-0 ${isSelected ? "text-amber-400" : "text-slate-500"}`}>
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-100 truncate">{company.companyName}</span>
            {company.decisionLevel && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${decisionLevelColor(company.decisionLevel)}`}>
                {company.decisionLevel.replace("LEVEL_", "L")}
              </Badge>
            )}
          </div>
          {company.ceoName && (
            <p className="text-xs text-slate-400 truncate mb-1">{company.ceoName}</p>
          )}
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />{company.country}
            </span>
            <span className={`font-mono font-semibold ${scoreColor(company.sss)}`}>SSS {company.sss ?? '—'}</span>
            <span className={`font-mono ${scoreColor(company.esi)}`}>ESI {company.esi ?? '—'}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Section Preview ───────────────────────────────────────────────────────────

function SectionPreview({ section, index }: { section: BoardPackSection; index: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          {SECTION_ICONS[section.title] ?? <FileText className="w-3 h-3 text-amber-400" />}
        </div>
        <div>
          <span className="text-[10px] text-amber-400/70 font-mono tracking-widest uppercase">Section {index + 1}</span>
          <h3 className="text-sm font-bold text-slate-100">{section.title}</h3>
        </div>
      </div>
      <div className="prose prose-sm prose-invert max-w-none text-slate-300 text-sm leading-relaxed">
        <Streamdown>{section.content}</Streamdown>
      </div>
      {section.metadata && Object.keys(section.metadata).length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-2">
          {Object.entries(section.metadata).slice(0, 4).map(([k, v]) => (
            v != null && (
              <span key={k} className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                <span className="text-slate-400">{k}:</span> {String(v).slice(0, 30)}
              </span>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ArosBoardPack() {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [generatedPack, setGeneratedPack] = useState<BoardPackData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState<"pdf" | "pptx" | "docx" | null>(null);
  const [activeSection, setActiveSection] = useState(0);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: companies, isLoading: companiesLoading } = trpc.arosBoardPack.listCompanies.useQuery();
  const generatePackMutation = trpc.arosBoardPack.generatePack.useMutation();

  // ── Generate pack ─────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!selectedCompany) return;
    setIsGenerating(true);
    setGeneratedPack(null);
    try {
      const pack = await generatePackMutation.mutateAsync({ companyId: selectedCompany.id });
      setGeneratedPack(pack as BoardPackData);
      setActiveSection(0);
      toast.success("Board Intelligence Pack generated successfully.");
    } catch (err) {
      toast.error(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedCompany, generatePackMutation]);

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async (format: "pdf" | "pptx" | "docx") => {
    if (!generatedPack) return;
    setIsDownloading(format);
    try {
      const resp = await fetch(`/api/board-pack/download/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generatedPack),
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Download failed" }));
        throw new Error(err.error ?? "Download failed");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = generatedPack.companyName.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);
      a.download = `BoardPack_${safeName}_${dateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Board Pack downloaded as ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDownloading(null);
    }
  }, [generatedPack]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-slate-900 text-slate-100">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] text-amber-400/70 font-mono tracking-widest uppercase">Atlas Intelligence System</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100">Board Intelligence Pack</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Board-quality decision intelligence. One click. Ready for a chairman.
              </p>
            </div>
            {generatedPack && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload("pdf")}
                  disabled={isDownloading !== null}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-2"
                >
                  {isDownloading === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload("pptx")}
                  disabled={isDownloading !== null}
                  className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-2"
                >
                  {isDownloading === "pptx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />}
                  PPTX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload("docx")}
                  disabled={isDownloading !== null}
                  className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 gap-2"
                >
                  {isDownloading === "docx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileType2 className="w-3.5 h-3.5" />}
                  DOCX
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left panel: Company selector ──────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-r border-slate-700/50 flex flex-col bg-slate-900/60">
            <div className="px-4 py-3 border-b border-slate-700/50">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Company</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Top 50 by Strategic Significance</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1.5">
                {companiesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  </div>
                ) : !companies?.length ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No companies in Atlas yet.
                  </div>
                ) : (
                  companies.map((company, idx) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      rank={idx + 1}
                      isSelected={selectedCompany?.id === company.id}
                      onClick={() => {
                        setSelectedCompany(company);
                        setGeneratedPack(null);
                      }}
                    />
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Generate button */}
            {selectedCompany && (
              <div className="p-4 border-t border-slate-700/50">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Pack…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate Board Pack
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                  {selectedCompany.companyName}
                </p>
              </div>
            )}
          </div>

          {/* ── Main content area ──────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedCompany ? (
              /* Empty state */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-amber-400/60" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">Select a Company</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Choose a company from the list to generate a board-quality intelligence document ready for a chairman, CEO, or investment committee.
                  </p>
                </div>
              </div>
            ) : !generatedPack ? (
              /* Selected but not yet generated */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md">
                  {isGenerating ? (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-300 mb-2">Generating Board Pack…</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Atlas is assembling 8 sections from real operational data and generating the Executive Summary and Recommendation. This takes 15–30 seconds.
                      </p>
                      <div className="mt-6 space-y-2">
                        {[
                          "Fetching Decision Twin",
                          "Retrieving Outcome Ledger",
                          "Loading Calibration Records",
                          "Generating Executive Summary",
                          "Generating Recommendation",
                          "Assembling Audit Trail",
                        ].map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                            {step}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-300 mb-2">{selectedCompany.companyName}</h3>
                      {selectedCompany.ceoName && (
                        <p className="text-sm text-slate-500 mb-1">{selectedCompany.ceoName}</p>
                      )}
                      <p className="text-sm text-slate-500 mb-6">
                        {selectedCompany.sector} · {selectedCompany.country} · SSS {selectedCompany.sss}
                      </p>
                      <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                        {[
                          { icon: <FileText className="w-4 h-4" />, label: "Executive Summary", desc: "Board-ready opening page" },
                          { icon: <BarChart3 className="w-4 h-4" />, label: "Decision Twin", desc: "Strategic decision + hidden variable" },
                          { icon: <BookOpen className="w-4 h-4" />, label: "Intelligence Brief", desc: "Exactly as delivered" },
                          { icon: <Shield className="w-4 h-4" />, label: "Institutional Proof", desc: "Accuracy metrics + API" },
                          { icon: <TrendingUp className="w-4 h-4" />, label: "Calibration", desc: "Prediction vs outcome" },
                          { icon: <CheckCircle2 className="w-4 h-4" />, label: "Customer Proof", desc: "Verified outcomes only" },
                          { icon: <ChevronRight className="w-4 h-4" />, label: "Recommendation", desc: "3 strategic options" },
                          { icon: <Clock className="w-4 h-4" />, label: "Audit Trail", desc: "Full version manifest" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-slate-800/40 border border-slate-700/30">
                            <div className="text-amber-400/60 mt-0.5 flex-shrink-0">{item.icon}</div>
                            <div>
                              <p className="text-xs font-medium text-slate-300">{item.label}</p>
                              <p className="text-[10px] text-slate-500">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={handleGenerate}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-2 px-8"
                      >
                        <Download className="w-4 h-4" />
                        Generate Board Intelligence Pack
                      </Button>
                      <p className="text-[10px] text-slate-600 mt-3">
                        Only real operational data. No simulated performance.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Pack generated — show preview */
              <div className="flex-1 flex overflow-hidden">

                {/* Section nav */}
                <div className="w-52 flex-shrink-0 border-r border-slate-700/50 bg-slate-900/40">
                  <div className="px-3 py-3 border-b border-slate-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">Pack Generated</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{generatedPack.companyName}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {new Date(generatedPack.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {generatedPack.sections.map((section, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveSection(idx)}
                        className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all flex items-center gap-2 ${
                          activeSection === idx
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
                        }`}
                      >
                        <span className="text-[10px] font-mono text-slate-600 w-4 flex-shrink-0">{idx + 1}</span>
                        <span className="truncate">{section.title}</span>
                      </button>
                    ))}
                  </div>

                  {/* Download buttons in sidebar */}
                  <div className="p-3 border-t border-slate-700/50 space-y-1.5 mt-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Export</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload("pdf")}
                      disabled={isDownloading !== null}
                      className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2 text-xs"
                    >
                      {isDownloading === "pdf" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload("pptx")}
                      disabled={isDownloading !== null}
                      className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10 gap-2 text-xs"
                    >
                      {isDownloading === "pptx" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Presentation className="w-3 h-3" />}
                      Download PPTX
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload("docx")}
                      disabled={isDownloading !== null}
                      className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 gap-2 text-xs"
                    >
                      {isDownloading === "docx" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileType2 className="w-3 h-3" />}
                      Download DOCX
                    </Button>
                  </div>
                </div>

                {/* Section content */}
                <ScrollArea className="flex-1">
                  <div className="p-6 max-w-3xl">
                    {/* Pack header */}
                    <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                            <span className="text-[10px] text-amber-400/70 font-mono tracking-widest uppercase">Board Intelligence Pack</span>
                          </div>
                          <h2 className="text-lg font-bold text-slate-100">{generatedPack.companyName}</h2>
                          {generatedPack.executiveName && (
                            <p className="text-sm text-slate-400 mt-0.5">Attention: {generatedPack.executiveName}</p>
                          )}
                        </div>
                        <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                          <p>Constitution {generatedPack.constitutionVersion}</p>
                          <p>{new Date(generatedPack.generatedAt).toLocaleDateString()}</p>
                          <p className="font-mono text-slate-600">{generatedPack.packId.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </div>

                    {/* Active section */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
                      <SectionPreview
                        section={generatedPack.sections[activeSection]}
                        index={activeSection}
                      />
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
                        disabled={activeSection === 0}
                        className="border-slate-700 text-slate-400 hover:text-slate-300 gap-1"
                      >
                        ← Previous
                      </Button>
                      <span className="text-xs text-slate-500">
                        Section {activeSection + 1} of {generatedPack.sections.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveSection(Math.min(generatedPack.sections.length - 1, activeSection + 1))}
                        disabled={activeSection === generatedPack.sections.length - 1}
                        className="border-slate-700 text-slate-400 hover:text-slate-300 gap-1"
                      >
                        Next →
                      </Button>
                    </div>

                    {/* Integrity notice */}
                    <div className="mt-6 p-3 rounded-lg border border-slate-700/30 bg-slate-800/20 flex items-start gap-2">
                      <Shield className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        This Board Intelligence Pack was generated using only verified operational data from the Atlas Outcome Ledger, Decision Twin database, and Constitution-governed generation pipeline. No simulated performance data was used.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
