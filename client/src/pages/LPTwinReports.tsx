import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, FileText, Download, Clock, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const REPORT_TYPES = [
  { value: "global_investor_readiness", label: "Global Investor Readiness", description: "14-dimension readiness assessment with blockers, corrections, and accessible segments" },
  { value: "lp_targeting", label: "LP Targeting", description: "Ranked fit scores across all 9 LP archetypes with principal fit reasons" },
  { value: "fund_objection_map", label: "Fund Objection Map", description: "Likely objections by segment with severity, evidence needed, and recommended responses" },
  { value: "fund_term_sensitivity", label: "Fund-Term Sensitivity", description: "Impact of fee and term changes on fit scores across segments" },
  { value: "fundraising_sequence", label: "Fundraising Sequence", description: "Recommended outreach sequence with timing and segment prioritisation" },
  { value: "lp_meeting_brief", label: "LP Meeting Brief", description: "Structured pre-meeting preparation for a specific LP segment" },
  { value: "capital_formation_strategy", label: "Capital Formation Strategy", description: "Comprehensive fundraising strategy across all segments and scenarios" },
  { value: "scenario_comparison", label: "Scenario Comparison", description: "Side-by-side comparison of fund term scenarios and their impact on LP fit" },
  { value: "synthetic_lp_panel", label: "Synthetic LP Panel", description: "Multi-agent panel simulation results with consensus and disagreement analysis" },
  { value: "simulation_vs_actual", label: "Simulation vs Actual", description: "Comparison of synthetic predictions against actual meeting outcomes" },
];

export default function LPTwinReports() {
  const [selectedFundId, setSelectedFundId] = useState<string>("");
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [generatedReport, setGeneratedReport] = useState<{ reportId: number; reportTitle: string; markdownContent: string } | null>(null);

  const { data: fundsData } = trpc.lpTwin.listFunds.useQuery({ includeArchived: false });
  const { data: reportsData, refetch: refetchReports } = trpc.lpTwinMeeting.listReports.useQuery(
    { fundId: selectedFundId ? parseInt(selectedFundId) : undefined },
    { enabled: true }
  );

  const generateReport = trpc.lpTwinMeeting.generateReport.useMutation({
    onSuccess: (data) => {
      toast.success(`Report generated: ${data.reportTitle}`);
      setGeneratedReport(data);
      refetchReports();
    },
    onError: (e) => toast.error(`Report generation failed: ${e.message}`),
  });

  const { data: reportDetail } = trpc.lpTwinMeeting.getReport.useQuery(
    { reportId: generatedReport?.reportId ?? 0 },
    { enabled: !!generatedReport?.reportId }
  );

  const funds = fundsData?.funds ?? [];
  const reports = reportsData?.reports ?? [];

  const handleGenerate = () => {
    if (!selectedFundId || !selectedReportType) {
      toast.error("Select a fund and report type");
      return;
    }
    generateReport.mutate({
      fundId: parseInt(selectedFundId),
      reportType: selectedReportType as "global_investor_readiness",
    });
  };

  const handleDownloadMarkdown = () => {
    if (!generatedReport?.markdownContent) return;
    const blob = new Blob([generatedReport.markdownContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedReport.reportTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    if (!reportDetail?.report) return;
    const blob = new Blob([reportDetail.report.reportDataJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedReport?.reportTitle?.replace(/[^a-z0-9]/gi, "_").toLowerCase() ?? "report"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/captwin/lp-twin">
              <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="w-4 h-4" />Back to LP Twin</Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Capital Formation Reports</h1>
              <p className="text-sm text-muted-foreground">Generate, download, and review capital formation reports</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Report Types */}
          <div className="col-span-1 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Report Types</h2>
            {REPORT_TYPES.map((rt) => (
              <button
                key={rt.value}
                onClick={() => setSelectedReportType(rt.value)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedReportType === rt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 bg-card"
                }`}
              >
                <p className="text-sm font-medium">{rt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{rt.description}</p>
              </button>
            ))}
          </div>

          {/* Generate + View */}
          <div className="col-span-2 space-y-4">
            {/* Generate Controls */}
            <Card>
              <CardHeader><CardTitle className="text-base">Generate Report</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">Fund</label>
                    <Select value={selectedFundId} onValueChange={setSelectedFundId}>
                      <SelectTrigger><SelectValue placeholder="Select a fund..." /></SelectTrigger>
                      <SelectContent>
                        {funds.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.fundName} v{f.version}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">Report Type</label>
                    <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                      <SelectTrigger><SelectValue placeholder="Select report type..." /></SelectTrigger>
                      <SelectContent>
                        {REPORT_TYPES.map((rt) => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleGenerate} disabled={generateReport.isPending || !selectedFundId || !selectedReportType} className="gap-2">
                    {generateReport.isPending ? "Generating..." : "Generate"}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Generated Report */}
            {generatedReport && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{generatedReport.reportTitle}</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleDownloadMarkdown} className="gap-2">
                        <Download className="w-4 h-4" />Markdown
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownloadJSON} className="gap-2">
                        <Download className="w-4 h-4" />JSON
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground bg-muted/30 rounded-md p-4 overflow-auto max-h-96 whitespace-pre-wrap">
                    {generatedReport.markdownContent}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Report History */}
            {reports.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Report History</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {reports.slice(0, 10).map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.reportTitle}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">{r.reportType.replace(/_/g, " ")}</Badge>
                          <span className="text-xs text-muted-foreground">v{r.engineVersion}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(r.generatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
