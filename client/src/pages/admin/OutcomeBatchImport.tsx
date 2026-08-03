/**
 * OutcomeBatchImport.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin tool for bulk-importing historical decision outcomes into the
 * Outcome Ledger. Supports:
 *   - CSV paste (tab-separated or comma-separated)
 *   - JSON paste
 *   - Dry-run validation before commit
 *   - Per-row error reporting
 *   - Audit trail (all inserts are timestamped)
 *
 * Route: /admin/outcome-batch-import
 * Access: Admin only
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload, CheckCircle2, AlertCircle, Loader2, FileText, X, Info, Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CouncilMode = "gcc" | "global_vc" | "india_pe" | "infrastructure" | "gcc_equities";
type OutcomeStatus = "UNKNOWN" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "ABANDONED" | "RESTRUCTURED";
type Verdict = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED" | "INSUFFICIENT_DATA";

interface ImportRow {
  dealId: string;
  councilMode: CouncilMode;
  originalVerdict: Verdict;
  outcomeStatus: OutcomeStatus;
  consensusScore?: number;
  confidenceLevel?: number;
  decisionDate?: number;
  outcomeNotes?: string;
  primaryDriver?: string;
  sourceConfidence?: string;
  sourceType?: string;
  sourceUrl?: string;
}

type ParseError = { row: number; message: string };

// ─── CSV Template ─────────────────────────────────────────────────────────────

const CSV_TEMPLATE = `dealId,councilMode,originalVerdict,outcomeStatus,consensusScore,confidenceLevel,decisionDate,outcomeNotes,primaryDriver,sourceConfidence,sourceType,sourceUrl
deal-001,gcc,APPROVED,SUCCEEDED,0.82,0.90,,Acquisition completed successfully,FINANCIAL,HIGH,ANNUAL_REPORT,
deal-002,gcc,REJECTED,FAILED,0.35,0.75,,Target failed to meet governance threshold,REGULATORY,MEDIUM,FILING,
deal-003,global_vc,APPROVED,IN_PROGRESS,0.78,0.85,,Series B round still in progress,FINANCIAL,LOW,ANNOUNCEMENT,`;

const JSON_TEMPLATE = `[
  {
    "dealId": "deal-001",
    "councilMode": "gcc",
    "originalVerdict": "APPROVED",
    "outcomeStatus": "SUCCEEDED",
    "consensusScore": 0.82,
    "confidenceLevel": 0.90,
    "outcomeNotes": "Acquisition completed successfully",
    "primaryDriver": "FINANCIAL",
    "sourceConfidence": "HIGH",
    "sourceType": "ANNUAL_REPORT"
  }
]`;

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCSV(text: string): { rows: ImportRow[]; errors: ParseError[] } {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: [{ row: 0, message: "No data rows found (need header + at least 1 row)" }] };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const rows: ImportRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    const get = (field: string) => {
      const idx = header.indexOf(field);
      return idx >= 0 ? cols[idx] ?? "" : "";
    };

    const dealId = get("dealid");
    if (!dealId) {
      errors.push({ row: i, message: "Missing dealId" });
      continue;
    }

    const councilMode = get("councilmode") as CouncilMode;
    const validModes: CouncilMode[] = ["gcc", "global_vc", "india_pe", "infrastructure", "gcc_equities"];
    if (councilMode && !validModes.includes(councilMode)) {
      errors.push({ row: i, message: `Invalid councilMode: "${councilMode}"` });
      continue;
    }

    const originalVerdict = get("originalverdict") as Verdict;
    const validVerdicts: Verdict[] = ["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "VETOED", "INSUFFICIENT_DATA"];
    if (originalVerdict && !validVerdicts.includes(originalVerdict)) {
      errors.push({ row: i, message: `Invalid originalVerdict: "${originalVerdict}"` });
      continue;
    }

    const outcomeStatus = get("outcomestatus") as OutcomeStatus;
    const validStatuses: OutcomeStatus[] = ["UNKNOWN", "IN_PROGRESS", "SUCCEEDED", "FAILED", "ABANDONED", "RESTRUCTURED"];
    if (outcomeStatus && !validStatuses.includes(outcomeStatus)) {
      errors.push({ row: i, message: `Invalid outcomeStatus: "${outcomeStatus}"` });
      continue;
    }

    const consensusScoreStr = get("consensusscore");
    const consensusScore = consensusScoreStr ? parseFloat(consensusScoreStr) : undefined;
    if (consensusScore !== undefined && (isNaN(consensusScore) || consensusScore < 0 || consensusScore > 1)) {
      errors.push({ row: i, message: `Invalid consensusScore: "${consensusScoreStr}" (must be 0–1)` });
      continue;
    }

    const confidenceLevelStr = get("confidencelevel");
    const confidenceLevel = confidenceLevelStr ? parseFloat(confidenceLevelStr) : undefined;
    if (confidenceLevel !== undefined && (isNaN(confidenceLevel) || confidenceLevel < 0 || confidenceLevel > 1)) {
      errors.push({ row: i, message: `Invalid confidenceLevel: "${confidenceLevelStr}" (must be 0–1)` });
      continue;
    }

    const decisionDateStr = get("decisiondate");
    const decisionDate = decisionDateStr ? parseInt(decisionDateStr) : undefined;

    rows.push({
      dealId,
      councilMode: councilMode || "gcc",
      originalVerdict: originalVerdict || "APPROVED",
      outcomeStatus: outcomeStatus || "UNKNOWN",
      consensusScore,
      confidenceLevel,
      decisionDate,
      outcomeNotes: get("outcomenotes") || undefined,
      primaryDriver: get("primarydriver") || undefined,
      sourceConfidence: get("sourceconfidence") || undefined,
      sourceType: get("sourcetype") || undefined,
      sourceUrl: get("sourceurl") || undefined,
    });
  }

  return { rows, errors };
}

function parseJSON(text: string): { rows: ImportRow[]; errors: ParseError[] } {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { rows: [], errors: [{ row: 0, message: "JSON must be an array of objects" }] };
    }
    const rows: ImportRow[] = [];
    const errors: ParseError[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      if (!item.dealId) {
        errors.push({ row: i + 1, message: "Missing dealId" });
        continue;
      }
      rows.push({
        dealId: item.dealId,
        councilMode: item.councilMode ?? "gcc",
        originalVerdict: item.originalVerdict ?? "APPROVED",
        outcomeStatus: item.outcomeStatus ?? "UNKNOWN",
        consensusScore: item.consensusScore,
        confidenceLevel: item.confidenceLevel,
        decisionDate: item.decisionDate,
        outcomeNotes: item.outcomeNotes,
        primaryDriver: item.primaryDriver,
        sourceConfidence: item.sourceConfidence,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
      });
    }
    return { rows, errors };
  } catch (err: any) {
    return { rows: [], errors: [{ row: 0, message: `JSON parse error: ${err.message}` }] };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OutcomeBatchImport() {
  const [inputFormat, setInputFormat] = useState<"csv" | "json">("csv");
  const [rawInput, setRawInput] = useState("");
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [step, setStep] = useState<"input" | "preview" | "result">("input");

  const batchImportMutation = trpc.outcomeLedger.batchImport.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setStep("result");
      if (data.dryRun) {
        toast.success(`Dry run complete — ${data.rowCount} rows validated`);
      } else {
        toast.success(`Import complete — ${data.insertedCount} rows inserted`);
      }
    },
    onError: (err) => {
      toast.error(`Import failed: ${err.message}`);
    },
  });

  const handleParse = useCallback(() => {
    if (!rawInput.trim()) {
      toast.error("Please paste some data first");
      return;
    }
    const { rows, errors } = inputFormat === "csv" ? parseCSV(rawInput) : parseJSON(rawInput);
    setParsedRows(rows);
    setParseErrors(errors);
    if (rows.length > 0) {
      setStep("preview");
    } else {
      toast.error(`No valid rows found. ${errors.length} parse error${errors.length !== 1 ? "s" : ""}.`);
    }
  }, [rawInput, inputFormat]);

  function handleDryRun() {
    batchImportMutation.mutate({ rows: parsedRows as any, dryRun: true });
  }

  function handleImport() {
    batchImportMutation.mutate({ rows: parsedRows as any, dryRun: false });
  }

  function downloadTemplate() {
    const content = inputFormat === "csv" ? CSV_TEMPLATE : JSON_TEMPLATE;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outcome-ledger-template.${inputFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setRawInput("");
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setStep("input");
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Upload className="h-6 w-6" /> Outcome Ledger Batch Import
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Bulk-import historical decision outcomes. Supports CSV and JSON. Max 500 rows per batch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {step !== "input" && (
              <Button variant="outline" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Start Over
              </Button>
            )}
          </div>
        </div>

        {/* Step: Input */}
        {step === "input" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Paste Data
              </CardTitle>
              <CardDescription>
                Paste CSV or JSON data below. Download a template to see the expected format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={inputFormat} onValueChange={v => setInputFormat(v as any)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-5">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-1" /> Download Template
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Textarea
                  className="font-mono text-xs min-h-[280px]"
                  placeholder={inputFormat === "csv"
                    ? "dealId,councilMode,originalVerdict,outcomeStatus,consensusScore,…\ndeal-001,gcc,APPROVED,SUCCEEDED,0.82,…"
                    : '[{"dealId":"deal-001","councilMode":"gcc","originalVerdict":"APPROVED","outcomeStatus":"SUCCEEDED"}]'
                  }
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4 flex gap-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong className="text-foreground">Required fields:</strong> dealId, councilMode, originalVerdict, outcomeStatus</p>
                  <p><strong className="text-foreground">councilMode:</strong> gcc | global_vc | india_pe | infrastructure | gcc_equities</p>
                  <p><strong className="text-foreground">originalVerdict:</strong> APPROVED | APPROVED_WITH_CONDITIONS | REJECTED | VETOED | INSUFFICIENT_DATA</p>
                  <p><strong className="text-foreground">outcomeStatus:</strong> UNKNOWN | IN_PROGRESS | SUCCEEDED | FAILED | ABANDONED | RESTRUCTURED</p>
                  <p><strong className="text-foreground">decisionDate:</strong> Unix timestamp in milliseconds (optional, defaults to now)</p>
                </div>
              </div>

              <Button onClick={handleParse} disabled={!rawInput.trim()}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Parse & Preview
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <Card className="border-amber-300 dark:border-amber-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2 text-base">
                    <AlertCircle className="h-4 w-4" /> {parseErrors.length} Parse Warning{parseErrors.length !== 1 ? "s" : ""}
                  </CardTitle>
                  <CardDescription>These rows were skipped. Fix and re-paste to include them.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {parseErrors.slice(0, 10).map((e, i) => (
                      <div key={i} className="text-sm text-amber-700 dark:text-amber-300">
                        Row {e.row}: {e.message}
                      </div>
                    ))}
                    {parseErrors.length > 10 && (
                      <p className="text-xs text-muted-foreground">…and {parseErrors.length - 10} more</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  {parsedRows.length} Valid Row{parsedRows.length !== 1 ? "s" : ""} Ready
                </CardTitle>
                <CardDescription>
                  Run a dry-run to validate against the server, or import directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg overflow-auto max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Deal ID</TableHead>
                        <TableHead className="text-xs">Mode</TableHead>
                        <TableHead className="text-xs">Verdict</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Score</TableHead>
                        <TableHead className="text-xs">Driver</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">{row.dealId}</TableCell>
                          <TableCell className="text-xs"><Badge variant="outline" className="text-xs">{row.councilMode}</Badge></TableCell>
                          <TableCell className="text-xs">
                            <Badge variant={row.originalVerdict.startsWith("APPROVED") ? "default" : "destructive"} className="text-xs">
                              {row.originalVerdict}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary" className="text-xs">{row.outcomeStatus}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{row.consensusScore !== undefined ? (row.consensusScore * 100).toFixed(0) + "%" : "—"}</TableCell>
                          <TableCell className="text-xs">{row.primaryDriver ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedRows.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Showing 50 of {parsedRows.length} rows</p>
                  )}
                </div>

                {/* Dry-run result */}
                {importResult?.dryRun && (
                  <div className={`rounded-lg p-4 flex gap-3 ${importResult.valid ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"}`}>
                    {importResult.valid
                      ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      : <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    }
                    <div className="text-sm">
                      <p className="font-medium">{importResult.valid ? "Dry run passed — ready to import" : "Dry run found issues"}</p>
                      <p className="text-muted-foreground">{importResult.rowCount} rows · {importResult.duplicatesInBatch.length} duplicates in batch</p>
                      {importResult.duplicatesInBatch.length > 0 && (
                        <p className="text-amber-600 dark:text-amber-400 mt-1">Duplicate dealIds: {importResult.duplicatesInBatch.slice(0, 5).join(", ")}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleDryRun}
                    disabled={batchImportMutation.isPending}
                  >
                    {batchImportMutation.isPending && !importResult ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Validating…</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-1" /> Dry Run</>
                    )}
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={batchImportMutation.isPending}
                  >
                    {batchImportMutation.isPending && importResult?.dryRun === false ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing…</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-1" /> Import {parsedRows.length} Row{parsedRows.length !== 1 ? "s" : ""}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Result */}
        {step === "result" && importResult && !importResult.dryRun && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-6 w-6" /> Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{importResult.insertedCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">Rows Inserted</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{importResult.duplicatesInBatch.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Duplicates in Batch</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{importResult.errorCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">Insert Errors</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="border border-destructive/20 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-destructive">Insert Errors</p>
                  {importResult.errors.map((e: any, i: number) => (
                    <div key={i} className="text-xs text-destructive">
                      {e.dealId}: {e.error}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={reset}>Import Another Batch</Button>
                <Button onClick={() => window.location.href = "/admin/outcome-ledger"}>
                  View Outcome Ledger
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
