function FixTheDealPanel({ result, councilMode, onRerun }: {
  result: CouncilResult;
  councilMode?: string;
  onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void;
}) {
  const isRejected = ["REJECTED", "VETOED", "HOLD"].includes(result.verdict);
  const [open, setOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [memoText, setMemoText] = useState<string | null>(null);

  const fixMutation = trpc.dealScreener.fixTheDeal.useMutation();
  const exportMutation = trpc.dealScreener.exportRepairBrief.useMutation();
  const memoMutation = trpc.dealScreener.requestRestructuringMemo.useMutation();

  if (!isRejected) return null;

  const handleFix = () => {
    if (open) { setOpen(false); return; }
    const outcome = `Verdict: ${result.verdict} · ${result.yesCount}/10 YES · Confidence: ${Math.round((result.confidenceScore ?? 0) * 100)}%\nTop blockers: ${(result.blockingIssues ?? []).slice(0, 3).join("; ")}`;
    const icSummary = result.icReport?.rawText?.slice(0, 2000) ?? "";
    fixMutation.mutate({
      dealText: result.dealText ?? result.dealTextPreview ?? "",
      councilOutcome: outcome,
      icMemoSummary: icSummary,
      councilMode: councilMode,
    });
    setOpen(true);
    setMemoText(null);
  };

  const handleDownloadPdf = async () => {
    if (!d || d.classification === "C") return;
    const dealName = result.dealName ?? "Deal";
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const filename = `${dealName.replace(/[^a-zA-Z0-9]/g, "_")}_RepairBrief_${dateStr}.pdf`;
    const res = await exportMutation.mutateAsync({
      dealName,
      councilMode: councilMode,
      classification: d.classification,
      classificationRationale: d.classificationRationale,
      rootCauses: d.rootCauses,
      revisedBrief: d.revisedBrief,
      changeSummaryTable: d.changeSummaryTable,
      predictedOutcome: d.predictedOutcome,
      approvalSensitivityLadder: d.approvalSensitivityLadder,
      residualRisks: d.residualRisks,
    });
    const blob = new Blob([Uint8Array.from(atob(res.pdfBase64), c => c.charCodeAt(0))], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRequestMemo = async () => {
    if (!d || d.classification !== "C") return;
    setMemoText(null);
    const blockers = d.rootCauses.slice(0, 3).map((rc: any) => `[${rc.category}] ${rc.description}`);
    const res = await memoMutation.mutateAsync({
      dealName: result.dealName ?? "Deal",
      classificationRationale: d.classificationRationale,
      structuralBlockers: blockers.length > 0 ? blockers : ["Fundamental structural deficiency identified by Council of 10"],
      councilMode: councilMode,
    });
    setMemoText(res.memo);
  };

  const handleRerun = () => {
    if (!fixMutation.data?.revisedBrief || !onRerun) return;
    setRerunning(true);
    onRerun(
      result.dealName + " [FIXED]",
      fixMutation.data.revisedBrief,
      (councilMode as CouncilModeType) ?? result.councilMode ?? "global_vc"
    );
    setTimeout(() => setRerunning(false), 2000);
  };

  const d = fixMutation.data as FixTheDealResult | undefined;
  const classColor = d?.classification === "A" ? GREEN : d?.classification === "B" ? AMBER : RED;
  const isClassC = d?.classification === "C";

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }} className="no-print">
      {/* Trigger button */}
      <button
        onClick={handleFix}
        disabled={fixMutation.isPending}
        style={{
          padding: "8px 18px",
          background: open ? "rgba(255,159,67,0.12)" : "none",
          border: `1px solid ${AMBER}`,
          color: AMBER,
          fontFamily: MONO, fontSize: 11, cursor: "pointer",
          borderRadius: 4, letterSpacing: "0.06em",
          opacity: fixMutation.isPending ? 0.7 : 1,
        }}
      >
        {fixMutation.isPending ? "ANALYSING DEAL..." : open ? "▲ CLOSE REPAIR REPORT" : "⚙ FIX THE DEAL"}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          marginTop: 12,
          background: "rgba(13,20,33,0.97)",
          border: `1px solid ${AMBER}44`,
          borderRadius: 8,
          padding: "20px 24px",
          boxShadow: `0 0 24px ${AMBER}12`,
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.15em", marginBottom: 4 }}>DEAL REPAIR ENGINE · STRUCTURED ANALYSIS</div>
              <div style={{ fontFamily: MONO, fontSize: 14, color: AMBER, fontWeight: 700 }}>FIX THE DEAL</div>
            </div>
            {d && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>CLASSIFICATION</span>
                <span style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, color: classColor,
                  background: `${classColor}18`, border: `1px solid ${classColor}44`,
                  borderRadius: 4, padding: "3px 10px",
                }}>{d.classification} — {d.classification === "A" ? "STRUCTURALLY REPAIRABLE" : d.classification === "B" ? "CONDITIONALLY VIABLE" : "FUNDAMENTALLY NON-VIABLE"}</span>
              </div>
            )}
          </div>

          {/* Loading state */}
          {fixMutation.isPending && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, padding: "20px 0", textAlign: "center" }}>
              ANALYSING BLOCKING ISSUES · RECONSTRUCTING DEAL BRIEF · ESTIMATING VOTE IMPACT...
            </div>
          )}

          {/* Error state */}
          {fixMutation.isError && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: RED, padding: "12px 0" }}>
              ENGINE ERROR — {fixMutation.error?.message ?? "Unknown error"}
            </div>
          )}

          {/* Results */}
          {d && !fixMutation.isPending && (
            <>
              {/* ── CLASS C: FULL EARLY-EXIT PATH ─────────────────────────────────── */}
              {isClassC && (
                <>
                  {/* Red institutional warning banner */}
                  <div
                    data-testid="class-c-warning"
                    style={{
                      marginBottom: 20,
                      padding: "20px 22px",
                      background: "rgba(255,71,87,0.07)",
                      border: `2px solid ${RED}`,
                      borderLeft: `6px solid ${RED}`,
                      borderRadius: 6,
                    }}
                  >
                    {/* Header */}
                    <div style={{ fontFamily: MONO, fontSize: 13, color: RED, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                      THIS DEAL CANNOT BE REPAIRED
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: `${RED}cc`, letterSpacing: "0.04em", marginBottom: 14 }}>
                      Fundamental restructuring required before resubmission
                    </div>

                    {/* Classification rationale — verbatim, no truncation */}
                    <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, lineHeight: 1.7, marginBottom: 16, padding: "10px 14px", background: "rgba(255,71,87,0.05)", borderRadius: 4 }}>
                      {d.classificationRationale}
                    </div>

                    {/* Structural changes required to reach Class B */}
                    {d.rootCauses.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>
                          STRUCTURAL CHANGES REQUIRED TO REACH CLASS B VIABILITY
                        </div>
                        {d.rootCauses.slice(0, 3).map((rc: any, i: number) => (
                          <div key={i} style={{
                            display: "flex", gap: 10, alignItems: "flex-start",
                            padding: "8px 12px", marginBottom: 4,
                            background: "rgba(255,71,87,0.05)",
                            borderLeft: `3px solid ${RED}66`,
                            borderRadius: 3,
                          }}>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: RED, fontWeight: 700, minWidth: 20, paddingTop: 1 }}>{i + 1}.</span>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, minWidth: 28, paddingTop: 1 }}>[{rc.category}]</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, lineHeight: 1.5 }}>{rc.description}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommended alternatives */}
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>RECOMMENDED ALTERNATIVES</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {["Phased entry", "Smaller ticket", "Different financing structure", "Strategic partnership", "Alternative instrument", "Hold / wait strategy"].map(alt => (
                          <span key={alt} style={{
                            fontFamily: MONO, fontSize: 9, color: AMBER,
                            background: `${AMBER}12`, border: `1px solid ${AMBER}33`,
                            borderRadius: 4, padding: "3px 8px",
                          }}>{alt}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* REQUEST RESTRUCTURING MEMO button */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      onClick={handleRequestMemo}
                      disabled={memoMutation.isPending}
                      data-testid="request-restructuring-memo"
                      style={{
                        padding: "9px 20px",
                        background: memoMutation.isPending ? "rgba(255,71,87,0.08)" : "rgba(255,71,87,0.12)",
                        border: `1px solid ${RED}`,
                        color: RED,
                        fontFamily: MONO, fontSize: 11, cursor: memoMutation.isPending ? "not-allowed" : "pointer",
                        borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                        opacity: memoMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      {memoMutation.isPending ? "GENERATING MEMO..." : "REQUEST RESTRUCTURING MEMO"}
                    </button>
                    {memoMutation.isError && (
                      <span style={{ fontFamily: MONO, fontSize: 10, color: RED }}>
                        Memo generation failed — {memoMutation.error?.message ?? "Unknown error"}
                      </span>
                    )}
                  </div>

                  {/* Restructuring memo output */}
                  {memoText && (
                    <div style={{
                      marginTop: 16,
                      padding: "16px 20px",
                      background: "rgba(13,20,33,0.98)",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                    }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 10 }}>
                        RESTRUCTURING MEMO — IC PARTNER TO SPONSOR
                      </div>
                      <pre style={{
                        fontFamily: MONO, fontSize: 10, color: TEXT2,
                        lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        margin: 0,
                      }}>{memoText}</pre>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                        AI-assisted deal analysis. Not investment advice. © AgenThink Mesh.
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── CLASS A / B: FULL REPAIR REPORT ──────────────────────────────── */}
              {!isClassC && (
                <>
                  {/* Classification rationale */}
                  <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, marginBottom: 16, lineHeight: 1.6, padding: "10px 14px", background: `${classColor}08`, borderRadius: 6, borderLeft: `3px solid ${classColor}` }}>
                    {d.classificationRationale}
                  </div>

                  {/* Root cause triage */}
                  {d.rootCauses.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>ROOT CAUSE TRIAGE</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {d.rootCauses.map((rc: any, i: number) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: AMBER, fontWeight: 700, minWidth: 20, paddingTop: 1 }}>#{rc.priority}</span>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, minWidth: 28, paddingTop: 1 }}>[{rc.category}]</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, lineHeight: 1.5 }}>{rc.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Change audit table */}
                  {d.changeSummaryTable.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>CHANGE AUDIT TABLE</div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 10 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                              {["CHANGE", "ORIGINAL", "REVISED", "ROOT CAUSE", "VOTE IMPACT"].map(h => (
                                <th key={h} style={{ padding: "6px 10px", color: MUTED, fontWeight: 600, textAlign: "left", letterSpacing: "0.08em", fontSize: 9 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {d.changeSummaryTable.map((row: any, i: number) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                                <td style={{ padding: "7px 10px", color: TEXT, lineHeight: 1.4 }}>{row.change}</td>
                                <td style={{ padding: "7px 10px", color: RED, lineHeight: 1.4 }}>{row.original}</td>
                                <td style={{ padding: "7px 10px", color: GREEN, lineHeight: 1.4 }}>{row.revised}</td>
                                <td style={{ padding: "7px 10px", color: ACCENT, lineHeight: 1.4 }}>{row.rootCauseAddressed}</td>
                                <td style={{ padding: "7px 10px", color: AMBER, lineHeight: 1.4, fontWeight: 700 }}>{row.estimatedVoteImpact}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Predicted outcome */}
                  {d.predictedOutcome && (
                    <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(0,255,135,0.04)", border: `1px solid ${GREEN}22`, borderRadius: 6 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>PREDICTED OUTCOME AFTER FIXES</div>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 2 }}>DECISION</div>
                          <div style={{ fontFamily: MONO, fontSize: 13, color: GREEN, fontWeight: 700 }}>{d.predictedOutcome.decision}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 2 }}>VOTE DISTRIBUTION</div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{d.predictedOutcome.voteDistribution}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 2 }}>CONSENSUS</div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{d.predictedOutcome.consensusPct}%</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 2 }}>LIKELY CONDITION</div>
                          <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER }}>{d.predictedOutcome.mostLikelyCondition}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Approval sensitivity ladder */}
                  {d.approvalSensitivityLadder.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>APPROVAL SENSITIVITY LADDER</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {d.approvalSensitivityLadder.map((step: any, i: number) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, minWidth: 16 }}>{i + 1}.</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, flex: 1, lineHeight: 1.4 }}>{step.structuralChange}</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN, minWidth: 60, textAlign: "right" }}>{step.estimatedVoteShift}</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, minWidth: 70, textAlign: "right" }}>→ {step.runningVoteEstimate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Residual risks */}
                  {d.residualRisks.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>RESIDUAL RISKS (AFTER FIXES)</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {d.residualRisks.map((risk: string, i: number) => (
                          <div key={i} style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, padding: "4px 10px", borderLeft: `2px solid ${RED}44` }}>{risk}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Revised brief + Rerun button */}
                  {d.revisedBrief && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em" }}>REVISED DEAL BRIEF (INLINE CHANGES MARKED)</div>
                        {onRerun && (
                          <button
                            onClick={handleRerun}
                            disabled={rerunning}
                            style={{
                              padding: "7px 16px",
                              background: rerunning ? "rgba(0,255,135,0.12)" : "rgba(0,255,135,0.08)",
                              border: `1px solid ${GREEN}`,
                              color: GREEN,
                              fontFamily: MONO, fontSize: 11, cursor: "pointer",
                              borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                            }}
                          >
                            {rerunning ? "SUBMITTING TO COUNCIL..." : "↻ RERUN WITH FIXES"}
                          </button>
                        )}
                      </div>
                      <pre style={{
                        fontFamily: MONO, fontSize: 10, color: TEXT2,
                        background: "rgba(255,255,255,0.02)", borderRadius: 6,
                        padding: "12px 14px", maxHeight: 320, overflowY: "auto",
                        lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>{d.revisedBrief}</pre>
                    </div>
                  )}

                  {/* DOWNLOAD REPAIR BRIEF button — Class A and B only */}
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                    <button
                      onClick={handleDownloadPdf}
                      disabled={exportMutation.isPending}
                      data-testid="download-repair-brief"
                      style={{
                        padding: "9px 20px",
                        background: exportMutation.isPending ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.12)",
                        border: `1px solid ${AMBER}`,
                        color: AMBER,
                        fontFamily: MONO, fontSize: 11, cursor: exportMutation.isPending ? "not-allowed" : "pointer",
                        borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                        opacity: exportMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      {exportMutation.isPending ? "GENERATING PDF..." : "DOWNLOAD REPAIR BRIEF"}
                    </button>
                    {exportMutation.isError && (
                      <span style={{ fontFamily: MONO, fontSize: 10, color: RED }}>
                        PDF export failed — {exportMutation.error?.message ?? "Unknown error"}
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
