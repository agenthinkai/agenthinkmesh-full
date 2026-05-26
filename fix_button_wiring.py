with open("client/src/pages/DealScreener.tsx", "r") as f:
    content = f.read()

# ── Fix 1: Convert FixTheDealPanel to forwardRef with useImperativeHandle ────
# Change the function declaration to use React.forwardRef
old_fn_decl = '''function FixTheDealPanel({ result, councilMode, onRerun, onUpgradedSimCompleted, onFixesApplied, onRerunCompleted }: {
  result: CouncilResult;
  councilMode?: string;
  onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void;
  onUpgradedSimCompleted?: (data: { runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any }) => void;
  onFixesApplied?: () => void;
  onRerunCompleted?: () => void;
}) {'''

new_fn_decl = '''interface FixTheDealPanelHandle {
  triggerFix: () => void;
  isPending: () => boolean;
}

const FixTheDealPanel = React.forwardRef<FixTheDealPanelHandle, {
  result: CouncilResult;
  councilMode?: string;
  onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void;
  onUpgradedSimCompleted?: (data: { runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any }) => void;
  onFixesApplied?: () => void;
  onRerunCompleted?: () => void;
}>(function FixTheDealPanel({ result, councilMode, onRerun, onUpgradedSimCompleted, onFixesApplied, onRerunCompleted }, ref) {'''

if old_fn_decl in content:
    content = content.replace(old_fn_decl, new_fn_decl, 1)
    print("Fix 1: FixTheDealPanel converted to forwardRef")
else:
    print("Fix 1: PATTERN NOT FOUND")

# ── Fix 2: Add useImperativeHandle after fixMutation declaration ──────────────
old_after_fix = '''  const fixMutation = trpc.dealScreener.fixTheDeal.useMutation();
  const exportMutation = trpc.dealScreener.exportRepairBrief.useMutation();
  const memoMutation = trpc.dealScreener.requestRestructuringMemo.useMutation();'''

new_after_fix = '''  const fixMutation = trpc.dealScreener.fixTheDeal.useMutation();
  const exportMutation = trpc.dealScreener.exportRepairBrief.useMutation();
  const memoMutation = trpc.dealScreener.requestRestructuringMemo.useMutation();

  // Expose triggerFix so parent (ICReport next-step card) can call it imperatively
  React.useImperativeHandle(ref, () => ({
    triggerFix: () => { handleFix(); },
    isPending: () => fixMutation.isPending,
  }));'''

if old_after_fix in content:
    content = content.replace(old_after_fix, new_after_fix, 1)
    print("Fix 2: useImperativeHandle added")
else:
    print("Fix 2: PATTERN NOT FOUND")

# ── Fix 3: Close the forwardRef wrapper — add ); after the component's closing } ──
# The component currently ends with a single } for the function body.
# We need to add ); to close the forwardRef call.
# Find the end of FixTheDealPanel by looking for the next top-level function after it.
# The component ends just before "function InfraReEngagePanel"
old_infra_start = '''function InfraReEngagePanel('''
new_infra_start = ''');

function InfraReEngagePanel('''

if old_infra_start in content:
    # Only replace the first occurrence (right after FixTheDealPanel ends)
    content = content.replace(old_infra_start, new_infra_start, 1)
    print("Fix 3: forwardRef closing ); added before InfraReEngagePanel")
else:
    print("Fix 3: InfraReEngagePanel not found")

# ── Fix 4: Add fixPanelRef to BoardroomICReport props and thread it through ───
old_boardroom_sig = '''function BoardroomICReport({ ic, result, onCopy, onNewDeal, patternContext, stressTested, councilMode, onRerun, onUpgradedSimCompleted, onFixesApplied, onRerunCompleted }: { ic: ICReportData; result: CouncilResult; onCopy: (text: string) => void; onNewDeal: () => void; patternContext?: "invested_match" | "passed_match"; stressTested?: boolean; councilMode?: string; onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void; onUpgradedSimCompleted?: (data: { runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any }) => void; onFixesApplied?: () => void; onRerunCompleted?: () => void }) {'''

new_boardroom_sig = '''function BoardroomICReport({ ic, result, onCopy, onNewDeal, patternContext, stressTested, councilMode, onRerun, onUpgradedSimCompleted, onFixesApplied, onRerunCompleted, fixPanelRef }: { ic: ICReportData; result: CouncilResult; onCopy: (text: string) => void; onNewDeal: () => void; patternContext?: "invested_match" | "passed_match"; stressTested?: boolean; councilMode?: string; onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void; onUpgradedSimCompleted?: (data: { runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any }) => void; onFixesApplied?: () => void; onRerunCompleted?: () => void; fixPanelRef?: React.Ref<FixTheDealPanelHandle> }) {'''

if old_boardroom_sig in content:
    content = content.replace(old_boardroom_sig, new_boardroom_sig, 1)
    print("Fix 4: BoardroomICReport signature updated with fixPanelRef")
else:
    print("Fix 4: BoardroomICReport signature NOT FOUND")

# ── Fix 5: Thread fixPanelRef into FixTheDealPanel call inside BoardroomICReport ──
old_fix_panel_call = '      <FixTheDealPanel result={result} councilMode={councilMode} onRerun={onRerun} onUpgradedSimCompleted={onUpgradedSimCompleted} onFixesApplied={onFixesApplied} onRerunCompleted={onRerunCompleted} />'
new_fix_panel_call = '      <FixTheDealPanel ref={fixPanelRef} result={result} councilMode={councilMode} onRerun={onRerun} onUpgradedSimCompleted={onUpgradedSimCompleted} onFixesApplied={onFixesApplied} onRerunCompleted={onRerunCompleted} />'

if old_fix_panel_call in content:
    content = content.replace(old_fix_panel_call, new_fix_panel_call, 1)
    print("Fix 5: fixPanelRef threaded into FixTheDealPanel call")
else:
    print("Fix 5: FixTheDealPanel call NOT FOUND")

# ── Fix 6: Add fixPanelRef to ICReport and thread it to BoardroomICReport ─────
# Add the ref declaration in ICReport state section
old_icreport_ref_anchor = '''  const [fixesApplied,   setFixesApplied]   = useState(false);
  const [rerunCompleted, setRerunCompleted] = useState(false);'''

new_icreport_ref_anchor = '''  const [fixesApplied,   setFixesApplied]   = useState(false);
  const [rerunCompleted, setRerunCompleted] = useState(false);
  const fixPanelRef = React.useRef<FixTheDealPanelHandle>(null);'''

if old_icreport_ref_anchor in content:
    content = content.replace(old_icreport_ref_anchor, new_icreport_ref_anchor, 1)
    print("Fix 6: fixPanelRef declared in ICReport")
else:
    print("Fix 6: ICReport ref anchor NOT FOUND")

# ── Fix 7: Thread fixPanelRef into BoardroomICReport call in ICReport ─────────
old_boardroom_call = '        <BoardroomICReport ic={result.icReport} result={result} onCopy={handleCopyICReport} onNewDeal={onNewDeal} patternContext={patternContext} stressTested={simBadgeData?.hasCompleted} councilMode={result.councilMode ?? councilModeProp} onRerun={onRerun} onUpgradedSimCompleted={handleSimCompleted} onFixesApplied={() => setFixesApplied(true)} onRerunCompleted={() => setRerunCompleted(true)} />'
new_boardroom_call = '        <BoardroomICReport ic={result.icReport} result={result} onCopy={handleCopyICReport} onNewDeal={onNewDeal} patternContext={patternContext} stressTested={simBadgeData?.hasCompleted} councilMode={result.councilMode ?? councilModeProp} onRerun={onRerun} onUpgradedSimCompleted={handleSimCompleted} onFixesApplied={() => setFixesApplied(true)} onRerunCompleted={() => setRerunCompleted(true)} fixPanelRef={fixPanelRef} />'

if old_boardroom_call in content:
    content = content.replace(old_boardroom_call, new_boardroom_call, 1)
    print("Fix 7: fixPanelRef threaded into BoardroomICReport call")
else:
    print("Fix 7: BoardroomICReport call NOT FOUND")

# ── Fix 8: Replace the next-step card button onClick with real triggerFix call ──
old_next_step_btn = '''          <button
            onClick={() => {
              const el = document.getElementById("decision-upgrade-panel");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{ padding: "7px 16px", background: PURPLE, border: "none", color: "#fff", fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em", whiteSpace: "nowrap" }}
          >APPLY FIXES &amp; RE-RUN →</button>'''

new_next_step_btn = '''          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <button
              onClick={() => { fixPanelRef.current?.triggerFix(); }}
              disabled={fixPanelRef.current?.isPending() ?? false}
              style={{ padding: "7px 16px", background: PURPLE, border: "none", color: "#fff", fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em", whiteSpace: "nowrap", opacity: (fixPanelRef.current?.isPending() ?? false) ? 0.6 : 1 }}
            >{(fixPanelRef.current?.isPending() ?? false) ? "APPLYING FIXES & RE-RUNNING COUNCIL…" : "APPLY FIXES & RE-RUN →"}</button>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>Scroll down to view the repair report and re-run results</div>
          </div>'''

if old_next_step_btn in content:
    content = content.replace(old_next_step_btn, new_next_step_btn, 1)
    print("Fix 8: next-step card button wired to triggerFix")
else:
    print("Fix 8: next-step card button NOT FOUND")

with open("client/src/pages/DealScreener.tsx", "w") as f:
    f.write(content)

print("Done.")
