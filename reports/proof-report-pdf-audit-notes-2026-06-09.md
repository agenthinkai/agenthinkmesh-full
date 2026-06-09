# Institutional Proof Report PDF Audit Notes — 2026-06-09

## Source files reviewed

| Source | Path | Notes |
|---|---|---|
| Uploaded/sample PDF | `/home/ubuntu/Downloads/Helios-North_Institutional_Proof_Report_SAMPLE.pdf` | 15-page PDF used to inspect layout behavior |

## Visual findings

| Area | Observation | Likely implication |
|---|---|---|
| Cover / page 1 | Summary cards are placed high on page with large empty areas below; subsequent content begins too close to previous elements | Vertical cursor / absolute positioning logic is inconsistent |
| Executive Summary | Bullet text collapses into one-character-per-line vertical columns | Width calculations or x/y cursor reuse is broken for long wrapped content |
| Governance Findings | Section starts after massive white-space drift and entries are split across pages | Page-break logic is not checking remaining space before heading + rows |
| Subsequent pages | Many pages contain a single fragment line at top and large blank remainder | Content rows are being written after page breaks without grouped block estimation |
| Labels / badges | Colored label blocks appear near text and may collide with adjacent content | Absolute-position label rendering is not reserving row height |
| General | Document is technically generated but visually unreadable in multiple sections | PDF generator requires layout rewrite, not minor spacing patch |

## Root-cause hypotheses from visual audit

1. The PDF generator appears to mix manual absolute `x,y` placement with flowing `doc.y`-based content, causing cursor desynchronization.
2. Wrapped text blocks are likely rendered in columns that are too narrow, which explains one-character-per-line collapse.
3. Tables and section headings are not protected by a shared `ensureSpace()` or block-height estimation guard.
4. Long rows are probably drawn cell-by-cell without first calculating the maximum row height across wrapped cells.
5. Some pages suggest that content fragments are written after a page break without repeating table context or rechecking available space.

## Content issues already confirmed from earlier code audit

| Issue | Current cause in code |
|---|---|
| Governance Findings empty | `governanceFindings: []` hardcoded in `server/routers/proofEngine.ts` |
| Calibration weights empty | `calibrationContext.personaWeights: []` hardcoded in `server/routers/proofEngine.ts` |
| Contradictions empty | `contradictions: []` hardcoded in `server/routers/proofEngine.ts` |
| Confidence level missing | `confidenceLevel` currently set to `null` in report assembly |
| Outcome Session ID missing | outcome lookup depends on `outcomeSessions.councilRunId === sessionId`; if no row exists, traceability stays null |
| Minimal audit references | only three possible references are assembled; if CFA/outcome rows are missing, audit trail becomes thin |

## Additional structural concern

`RELEASE GATE: RELEASED` is semantically ambiguous when the council verdict is `REJECTED`. The PDF should distinguish:

- Council Verdict
- Governance Compliance / Export Eligibility
- Report Release Status

instead of implying decision approval.
