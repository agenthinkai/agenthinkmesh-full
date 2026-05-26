function FixTheDealPanel({ result, councilMode, onRerun }: {
  result: CouncilResult;
  councilMode?: string;
  onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void;
}) {
  const isRejected = ["REJECTED", "VETOED", "HOLD"].includes(result.verdict);
  const [open, setOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [memoText, setMemoText] = useState<string | null>(null);

  // ── Quick Simulation state ────────────────────────────────────────────────
  const [showSimPrompt, setShowSimPrompt] = useState(false);
  const [simRunId, setSimRunId] = useState<string | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [upgradedSimData, setUpgradedSimData] = useState<null | {
    runId: string;
    mode: string;
    targetCount: number;
    completedAt: string;
    aggregation: {
      decisionDistribution: {
        approveCount: number; conditionalCount: number; rejectCount: number;
        approvePct: number; conditionalPct: number; rejectPct: number;
        totalScenarios: number; hardNoCount: number; hardNoPct: number;
      };
    };
  }>(null);

  const fixMutation = trpc.dealScreener.fixTheDeal.useMutation();
  const exportMutation = trpc.dealScreener.exportRepairBrief.useMutation();
  const memoMutation = trpc.dealScreener.requestRestructuringMemo.useMutation();
  const startSimMutation = trpc.scenarioSim.startRun.useMutation();

  // Poll upgraded simulation status
  const { data: upgradedSimStatus } = trpc.scenarioSim.getRunStatus.useQuery(
    { runId: simRunId ?? "" },
    { enabled: !!simRunId && simRunning, refetchInterval: simRunId && simRunning ? 3000 : false }
  );

  // Stop polling when complete
  React.useEffect(() => {
    if (!upgradedSimStatus) return;
    if (upgradedSimStatus.status === "completed" && upgradedSimStatus.aggregation) {
      setSimRunning(false);
      setUpgradedSimData({
        runId: upgradedSimStatus.runId,
        mode: upgradedSimStatus.mode,
        targetCount: upgradedSimStatus.targetCount,
        completedAt: upgradedSimStatus.completedAt ? String(upgradedSimStatus.completedAt) : new Date().toISOString(),
        aggregation: upgradedSimStatus.aggregation as typeof upgradedSimData extends null ? never : NonNullable<typeof upgradedSimData>["aggregation"],
      });
    }
    if (upgradedSimStatus.status === "failed") {
      setSimRunning(false);
      setSimError("Simulation failed. Please try again.");
    }
  }, [upgradedSimStatus?.status, upgradedSimStatus?.aggregation]);

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
    setShowSimPrompt(false);
    setUpgradedSimData(null);
    setSimRunId(null);
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
    if (!d?.revisedBrief || !onRerun) return;
    setRerunning(true);
    // Show the Quick Simulation prompt before navigating away
    setShowSimPrompt(true);
    setTimeout(() => setRerunning(false), 2000);
  };

  const handleRunQuickSim = async () => {
    if (!d?.revisedBrief) return;
    setSimError(null);
    setSimRunning(true);
    const upgradedDealId = `${result.dealId ?? result.dealName ?? "deal"}-fixed`;
    const upgradedDealName = `${result.dealName ?? "Deal"} [UPGRADED]`;
    const effectiveMode = (councilMode as CouncilModeType) ?? result.councilMode ?? "global_vc";
    try {
      const res = await startSimMutation.mutateAsync({
        dealId: upgradedDealId,
        dealName: upgradedDealName,
        dealText: d.revisedBrief.slice(0, 12000),
        mode: "quick",
        councilMode: effectiveMode as "gcc" | "global_vc" | "india_pe" | "gcc_equities" | "infrastructure",
      });
      setSimRunId(res.runId);
      // If synchronous completion (quick mode)
      if (res.status === "completed" && res.aggregation) {
        setSimRunning(false);
        setUpgradedSimData({
          runId: res.runId,
          mode: res.mode,
          targetCount: res.targetCount,
          completedAt: new Date().toISOString(),
          aggregation: res.aggregation as typeof upgradedSimData extends null ? never : NonNullable<typeof upgradedSimData>["aggregation"],
        });
      }
    } catch (err: any) {
      setSimRunning(false);
      setSimError(err?.message ?? "Simulation failed");
    }
  };

  const handleContinueToCouncil = () => {
    if (!d?.revisedBrief || !onRerun) return;
    onRerun(
      result.dealName + " [FIXED]",
      d.revisedBrief,
      (councilMode as CouncilModeType) ?? result.councilMode ?? "global_vc"
    );
  };

  const d = fixMutation.data as FixTheDealResult | undefined;
  const classColor = d?.classification === "A" ? GREEN : d?.classification === "B" ? AMBER : RED;
  const isClassC = d?.classification === "C";

  // ── Comparison helpers ────────────────────────────────────────────────────
  const origApprovalPct = upgradedSimData ? null : null; // original sim not available in this panel
  const upgApprovalPct = upgradedSimData?.aggregation?.decisionDistribution
    ? Math.round(upgradedSimData.aggregation.decisionDistribution.approvePct + upgradedSimData.aggregation.decisionDistribution.conditionalPct)
    : null;

  // Determine if fixes improved investability
  const predictedYes = d?.predictedOutcome?.voteDistribution
    ? parseInt(d.predictedOutcome.voteDistribution.split("/")[0] ?? "0")
    : null;
  const originalYes = result.yesCount ?? 0;
  const fixesImproved = predictedYes !== null ? predictedYes > originalYes : null;

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
                    <div style={{ fontFamily: MONO, fontSize: 13, color: RED, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                      THIS DEAL CANNOT BE REPAIRED
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: `${RED}cc`, letterSpacing: "0.04em", marginBottom: 14 }}>
                      Fundamental restructuring required before resubmission
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, lineHeight: 1.7, marginBottom: 16, padding: "10px 14px", background: "rgba(255,71,87,0.05)", borderRadius: 4 }}>
                      {d.classificationRationale}
                    </div>
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
                  {memoText && (
                    <div style={{ marginTop: 16, padding: "16px 20px", background: "rgba(13,20,33,0.98)", border: `1px solid ${BORDER}`, borderRadius: 6 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 10 }}>
                        RESTRUCTURING MEMO — IC PARTNER TO SPONSOR
                      </div>
                      <pre style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{memoText}</pre>
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
                            data-testid="apply-fixes-rerun"
                            style={{
                              padding: "7px 16px",
                              background: rerunning ? "rgba(0,255,135,0.12)" : "rgba(0,255,135,0.08)",
                              border: `1px solid ${GREEN}`,
                              color: GREEN,
                              fontFamily: MONO, fontSize: 11, cursor: "pointer",
                              borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                            }}
                          >
                            {rerunning ? "PREPARING..." : "↻ APPLY FIXES & RE-RUN"}
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

                  {/* ── QUICK SIMULATION PROMPT CARD ─────────────────────────────── */}
                  {showSimPrompt && !upgradedSimData && (
                    <div
                      data-testid="quick-sim-prompt"
                      style={{
                        marginTop: 20,
                        padding: "18px 22px",
                        background: "rgba(74,158,255,0.05)",
                        border: `1px solid ${ACCENT}44`,
                        borderLeft: `4px solid ${ACCENT}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, letterSpacing: "0.15em", marginBottom: 6 }}>
                        NEXT STEP — STRESS TEST
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT, fontWeight: 700, marginBottom: 8 }}>
                        Run Quick Stress Simulation?
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, lineHeight: 1.7, marginBottom: 16 }}>
                        The deal has been upgraded and re-evaluated. Run a 100-scenario Quick Stress Simulation to test whether the fixes meaningfully improved the approval distribution?
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          onClick={handleRunQuickSim}
                          disabled={simRunning}
                          data-testid="run-quick-simulation"
                          style={{
                            padding: "9px 20px",
                            background: simRunning ? "rgba(74,158,255,0.08)" : "rgba(74,158,255,0.15)",
                            border: `1px solid ${ACCENT}`,
                            color: ACCENT,
                            fontFamily: MONO, fontSize: 11, cursor: simRunning ? "not-allowed" : "pointer",
                            borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                            opacity: simRunning ? 0.7 : 1,
                          }}
                        >
                          {simRunning ? "RUNNING 100 SCENARIOS..." : "RUN QUICK SIMULATION"}
                        </button>
                        <button
                          onClick={() => { setShowSimPrompt(false); handleContinueToCouncil(); }}
                          data-testid="sim-not-now"
                          style={{
                            padding: "9px 16px",
                            background: "none",
                            border: `1px solid ${BORDER}`,
                            color: MUTED,
                            fontFamily: MONO, fontSize: 11, cursor: "pointer",
                            borderRadius: 4, letterSpacing: "0.06em",
                          }}
                        >
                          NOT NOW — SUBMIT TO COUNCIL
                        </button>
                      </div>
                      {simError && (
                        <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginTop: 10 }}>
                          {simError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── SIMULATION RUNNING INDICATOR ─────────────────────────────── */}
                  {simRunning && (
                    <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11, color: ACCENT, padding: "10px 14px", background: "rgba(74,158,255,0.05)", borderRadius: 4, border: `1px solid ${ACCENT}22` }}>
                      RUNNING 100-SCENARIO QUICK SIMULATION ON UPGRADED DEAL...
                    </div>
                  )}

                  {/* ── ORIGINAL vs UPGRADED COMPARISON CARD ────────────────────── */}
                  {upgradedSimData && (
                    <div
                      data-testid="original-vs-upgraded"
                      style={{
                        marginTop: 20,
                        padding: "18px 22px",
                        background: "rgba(13,20,33,0.98)",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.15em", marginBottom: 12 }}>
                        ORIGINAL vs UPGRADED — COMPARATIVE ANALYSIS
                      </div>

                      {/* Investability verdict */}
                      {fixesImproved !== null && (
                        <div style={{
                          marginBottom: 14,
                          padding: "10px 14px",
                          background: fixesImproved ? "rgba(0,255,135,0.06)" : "rgba(255,71,87,0.06)",
                          border: `1px solid ${fixesImproved ? GREEN : RED}33`,
                          borderRadius: 6,
                          fontFamily: MONO, fontSize: 11, color: fixesImproved ? GREEN : RED, fontWeight: 700,
                        }}>
                          {fixesImproved
                            ? `FIXES IMPROVED INVESTABILITY — Predicted vote count: ${originalYes}/10 → ${predictedYes}/10`
                            : `FIXES DID NOT IMPROVE INVESTABILITY — Vote count unchanged: ${originalYes}/10 → ${predictedYes}/10`
                          }
                        </div>
                      )}

                      {/* Comparison grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                        {/* Original */}
                        <div style={{ padding: "12px 14px", background: "rgba(255,71,87,0.04)", border: `1px solid ${RED}22`, borderRadius: 6 }}>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: RED, letterSpacing: "0.12em", marginBottom: 8 }}>ORIGINAL DEAL</div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, marginBottom: 4 }}>
                            <span style={{ color: MUTED }}>Verdict: </span>{result.verdict}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, marginBottom: 4 }}>
                            <span style={{ color: MUTED }}>Council Vote: </span>{result.yesCount ?? "—"}/10 YES
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, marginBottom: 8 }}>
                            <span style={{ color: MUTED }}>Confidence: </span>{result.confidenceScore ? `${Math.round(result.confidenceScore * 100)}%` : "—"}
                          </div>
                          {(result.blockingIssues ?? []).length > 0 && (
                            <div>
                              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 4 }}>TOP BLOCKERS BEFORE</div>
                              {(result.blockingIssues ?? []).slice(0, 3).map((b: string, i: number) => (
                                <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: RED, padding: "2px 0", borderLeft: `2px solid ${RED}44`, paddingLeft: 8, marginBottom: 2 }}>{b}</div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Upgraded */}
                        <div style={{ padding: "12px 14px", background: "rgba(0,255,135,0.04)", border: `1px solid ${GREEN}22`, borderRadius: 6 }}>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: GREEN, letterSpacing: "0.12em", marginBottom: 8 }}>UPGRADED DEAL</div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, marginBottom: 4 }}>
                            <span style={{ color: MUTED }}>Predicted Verdict: </span>{d.predictedOutcome?.decision ?? "—"}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, marginBottom: 4 }}>
                            <span style={{ color: MUTED }}>Predicted Vote: </span>{d.predictedOutcome?.voteDistribution ?? "—"}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, marginBottom: 8 }}>
                            <span style={{ color: MUTED }}>Consensus: </span>{d.predictedOutcome?.consensusPct ? `${d.predictedOutcome.consensusPct}%` : "—"}
                          </div>
                          {d.residualRisks.length > 0 && (
                            <div>
                              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 4 }}>RESIDUAL RISKS AFTER</div>
                              {d.residualRisks.slice(0, 3).map((r: string, i: number) => (
                                <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: AMBER, padding: "2px 0", borderLeft: `2px solid ${AMBER}44`, paddingLeft: 8, marginBottom: 2 }}>{r}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Upgraded simulation distribution */}
                      {upgradedSimData.aggregation?.decisionDistribution && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>
                            UPGRADED STRESS SIMULATION — {upgradedSimData.targetCount} SCENARIOS
                          </div>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            {[
                              { label: "APPROVE", val: upgradedSimData.aggregation.decisionDistribution.approvePct, color: GREEN },
                              { label: "CONDITIONAL", val: upgradedSimData.aggregation.decisionDistribution.conditionalPct, color: AMBER },
                              { label: "REJECT", val: upgradedSimData.aggregation.decisionDistribution.rejectPct, color: RED },
                            ].map(({ label, val, color }) => (
                              <div key={label} style={{ textAlign: "center", minWidth: 80 }}>
                                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color }}>{Math.round(val)}%</div>
                                <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED }}>{label}</div>
                              </div>
                            ))}
                          </div>
                          {/* Distribution bar */}
                          <div style={{ marginTop: 10, height: 8, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                            <div style={{ width: `${upgradedSimData.aggregation.decisionDistribution.approvePct}%`, background: GREEN }} />
                            <div style={{ width: `${upgradedSimData.aggregation.decisionDistribution.conditionalPct}%`, background: AMBER }} />
                            <div style={{ width: `${upgradedSimData.aggregation.decisionDistribution.rejectPct}%`, background: RED }} />
                          </div>
                        </div>
                      )}

                      {/* Continue to Council button */}
                      {onRerun && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            onClick={handleContinueToCouncil}
                            data-testid="continue-to-council"
                            style={{
                              padding: "9px 20px",
                              background: "rgba(0,255,135,0.08)",
                              border: `1px solid ${GREEN}`,
                              color: GREEN,
                              fontFamily: MONO, fontSize: 11, cursor: "pointer",
                              borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                            }}
                          >
                            SUBMIT UPGRADED DEAL TO COUNCIL
                          </button>
                        </div>
                      )}
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
