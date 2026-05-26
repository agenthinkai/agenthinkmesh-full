with open("client/src/pages/DealScreener.tsx", "r") as f:
    content = f.read()

# Fix 1: BoardroomICReport signature — the line wraps at "number; com\npletedAt"
old_sig = 'function BoardroomICReport({ ic, result, onCopy, onNewDeal, patternContext, stressTested, councilMode, onRerun, onUpgradedSimCompleted }: { ic: ICReportData; result: CouncilResult; onCopy: (text: string) => void; onNewDeal: () => void; patternContext?: "invested_match" | "passed_match"; stressTested?: boolean; councilMode?: string; onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void; onUpgradedSimCompleted?: (data: { runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any }) => void }) {'
new_sig = 'function BoardroomICReport({ ic, result, onCopy, onNewDeal, patternContext, stressTested, councilMode, onRerun, onUpgradedSimCompleted, onFixesApplied, onRerunCompleted }: { ic: ICReportData; result: CouncilResult; onCopy: (text: string) => void; onNewDeal: () => void; patternContext?: "invested_match" | "passed_match"; stressTested?: boolean; councilMode?: string; onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void; onUpgradedSimCompleted?: (data: { runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any }) => void; onFixesApplied?: () => void; onRerunCompleted?: () => void }) {'

# The file has a line break mid-word: "number; com\npletedAt" — join the two lines first
content_joined = content.replace(
    'onUpgradedSimCompleted?: (data: { runId: string; mode: string; targetCount: number; com\npletedAt: string; aggregation: any }) => void }) {',
    'onUpgradedSimCompleted?: (data: { runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any }) => void }) {'
)

if old_sig in content_joined:
    content_joined = content_joined.replace(old_sig, new_sig, 1)
    print("Fix 1: BoardroomICReport signature updated")
else:
    print("Fix 1: STILL NOT FOUND after join — checking what's there")
    idx = content_joined.find("function BoardroomICReport")
    if idx >= 0:
        snippet = content_joined[idx:idx+600]
        print(repr(snippet))

# Fix 2: FixTheDealPanel call inside BoardroomICReport — add onFixesApplied and onRerunCompleted
old_call = '      <FixTheDealPanel result={result} councilMode={councilMode} onRerun={onRerun} onUpgradedSimCompleted={onUpgradedSimCompleted} />'
new_call = '      <FixTheDealPanel result={result} councilMode={councilMode} onRerun={onRerun} onUpgradedSimCompleted={onUpgradedSimCompleted} onFixesApplied={onFixesApplied} onRerunCompleted={onRerunCompleted} />'

if old_call in content_joined:
    content_joined = content_joined.replace(old_call, new_call, 1)
    print("Fix 2: FixTheDealPanel call updated")
else:
    print("Fix 2: FixTheDealPanel call NOT FOUND")

with open("client/src/pages/DealScreener.tsx", "w") as f:
    f.write(content_joined)

print("Done.")
