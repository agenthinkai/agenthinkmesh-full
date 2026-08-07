# LP Twin v1 — Founding Customer E2E Rehearsal

**Version:** 1.0.0
**Status:** READY FOR EXECUTION
**Last Updated:** 2026-08-07

> This document is the authoritative E2E rehearsal script for the founding validation customer.
> Every step must be executed and attested before a founding customer is onboarded.

---

## Rehearsal Scope

This rehearsal validates the complete LP Twin v1 user journey from account creation to
simulation export, using the Atlas Growth Fund I demo fund as the test vehicle.

**Rehearsal fund:** Atlas Growth Fund I (Synthetic Demonstration Fund — not a real fund)
**Rehearsal org:** AgenThinkMesh (org ID 1)
**Rehearsal user:** Founding customer representative (enterprise member)

---

## Pre-Rehearsal Checklist

- [ ] Feature branch `feature/captwin-lp-twin-v1` deployed to staging or production
- [ ] Database migrations applied (13 LP Twin tables confirmed)
- [ ] TypeScript: 0 errors
- [ ] Full LP Twin test suite: 222/222 passed
- [ ] Pen-test suite: 35/35 passed
- [ ] Demo fund seed script executed (`scripts/seed-lp-twin-demo.ts`)
- [ ] Founding customer user account created and assigned to org

---

## Step 1 — Authentication and Navigation

1. Open `https://www.agenthinkmesh.ai/captwin/lp-twin` in an incognito browser.
2. Confirm redirect to login page.
3. Log in with founding customer credentials.
4. Confirm redirect back to `/captwin/lp-twin` (not homepage).
5. Confirm LP Twin Home renders with fund cards and session history tabs.

**Pass criteria:** LP Twin Home loads with correct org data. No KEO or other tenant data visible.

---

## Step 2 — Fund Profile Creation

1. Click "New Fund" button.
2. Complete all 8 wizard steps for Atlas Growth Fund I:
   - Step 1 (Identity): Fund name, GP name, strategy=growth_equity, geography=North America, domicile=Cayman Islands, currency=USD
   - Step 2 (Economics): Management fee 2%, carry 20%, hurdle 8%, target size $150M
   - Step 3 (Proposition): 3 bullet points describing the fund's edge
   - Step 4 (Risk): Liquidity terms, risk factors
   - Step 5 (Credibility): Track record 8 years, prior fund IRR 22%, vintage 2018
   - Step 6 (Institutional): Min ticket $5M, ILPA compliant, audited financials
   - Step 7 (Evidence): Mark all evidence items as present
   - Step 8 (Confirm): Review and confirm
3. Click "Create Fund".
4. Confirm redirect to fund detail page.
5. Confirm all fields display correctly.

**Pass criteria:** Fund created with evidence_status=complete, version=1.

---

## Step 3 — Session Creation

1. From the fund detail page, click "Start Simulation".
2. On the session creation page:
   - Select 3 LP segments: SWF-001 (Sovereign Wealth Fund), PPF-001 (Public Pension Fund), SFO-001 (Single Family Office)
   - Set scenario type: Baseline
   - Add assumption: "Fund targets institutional LPs with $500M+ AUM"
3. Review the disclaimer and confirm.
4. Click "Run Analysis".
5. Confirm session status transitions: pending → running → completed.

**Pass criteria:** Session completes with 3 segment results. No errors.

---

## Step 4 — Results Review

1. Open the completed session.
2. Confirm the executive summary panel shows:
   - Overall fit score (0–100)
   - Fit category (strong/moderate/weak/poor)
   - Confidence level
   - SYNTHETIC SIMULATION disclaimer visible
3. Review each of the 3 segment result cards:
   - Fit score and category
   - Top 3 objections with severity
   - Evidence gaps
   - Positioning recommendations
4. Confirm the objection map renders (if implemented in UI).
5. Confirm the targeting recommendations panel renders.

**Pass criteria:** All 3 segment results display correctly. Disclaimer visible on all result panels.

---

## Step 5 — Ask-an-LP

1. In the session results view, click "Ask an LP" for the SWF-001 segment.
2. Select question type: "overall_verdict"
3. Enter question: "Based on this fund profile, would you invest?"
4. Submit and wait for response.
5. Confirm response includes:
   - Verdict (invest/conditional/decline)
   - Reasoning grounded in deterministic scores
   - SYNTHETIC SIMULATION disclaimer
   - Confidence level

**Pass criteria:** Ask-an-LP returns a structured response within 30 seconds.

---

## Step 6 — Fund-Term Laboratory

1. Navigate to `/captwin/lp-twin/laboratory`.
2. Select the Atlas Growth Fund I fund.
3. Create a new scenario: "Reduced Carry Test"
4. Adjust carry from 20% to 17.5% using the slider.
5. Click "Preview Impact".
6. Confirm the live preview shows:
   - Score delta for each segment
   - Which objections were resolved or added
   - Net impact summary
7. Click "Save Scenario".
8. Create a second scenario: "Lower Hurdle Test" (hurdle 6%).
9. Compare the two scenarios in the comparison table.

**Pass criteria:** Both scenarios saved. Comparison table shows delta columns. No errors.

---

## Step 7 — Meeting Preparation

1. Navigate to `/captwin/lp-twin/meeting/<session_id>`.
2. Select segment: SWF-001.
3. Set meeting type: first_meeting.
4. Set meeting objective: "Introduce fund and gauge initial interest".
5. Click "Generate Brief".
6. Confirm the brief includes:
   - Investor archetype profile
   - Fund fit summary
   - 5+ likely questions with evidence requirements
   - 3+ likely objections with recommended responses
   - Suggested next action
7. Click "Download Brief" (printable format).
8. Navigate to "Objection Rehearsal" tab.
9. Select an objection and submit a GP response.
10. Confirm coaching feedback is returned.

**Pass criteria:** Meeting brief generated. Rehearsal returns coaching feedback. Download works.

---

## Step 8 — Export

1. Return to the session results view.
2. Click "Export" → JSON.
3. Confirm the JSON file downloads with:
   - Fund profile snapshot
   - All 3 segment results
   - Engine version and registry version
   - Export timestamp
   - SYNTHETIC SIMULATION disclaimer
4. Click "Export" → CSV.
5. Confirm the CSV file downloads with headers and 3 data rows.

**Pass criteria:** Both exports download successfully. Disclaimer present in JSON.

---

## Step 9 — Reports

1. Navigate to `/captwin/lp-twin/reports`.
2. Select fund: Atlas Growth Fund I.
3. Generate report type: "LP Targeting Report".
4. Confirm report renders with:
   - Fund summary
   - Segment ranking table
   - Top objections per segment
   - Recommended outreach sequence
5. Click "Download Markdown".

**Pass criteria:** Report generated and downloaded. No errors.

---

## Step 10 — Investor Readiness Score

1. Navigate to the fund detail page for Atlas Growth Fund I.
2. Click "Investor Readiness" (or navigate to the readiness tab in the meeting room).
3. Confirm the Global Investor Readiness Score displays:
   - Overall score (0–100)
   - 14 dimension breakdown
   - Readiness label (not_ready/developing/ready/investor_grade)
   - Top 3 improvement actions

**Pass criteria:** Readiness score renders with all 14 dimensions.

---

## Step 11 — Validation Foundation

1. Navigate to `/captwin/lp-twin/validation`.
2. Confirm the validation dashboard renders with:
   - Participant count (0 for new org)
   - Validation quality score (N/A until data collected)
   - Import tool accessible
3. Click "Add Participant".
4. Fill in participant details (test allocator).
5. Confirm participant created with consent_status=granted.

**Pass criteria:** Validation dashboard renders. Participant creation works.

---

## Step 12 — Security Verification

1. Note the org ID of the founding customer org.
2. Attempt to access a fund from a different org by modifying the URL:
   `/captwin/lp-twin/fund/1` (if fund 1 belongs to a different org)
3. Confirm: either NOT_FOUND or access denied — no cross-tenant data displayed.
4. Attempt to access a session from a different org.
5. Confirm: access denied.

**Pass criteria:** All cross-tenant access attempts return NOT_FOUND or access denied.

---

## Rehearsal Attestation

```
REHEARSAL_ATTESTATION
  Rehearsal date:
  Rehearsal operator:
  Environment: staging / production
  Demo fund used: Atlas Growth Fund I (Synthetic Demonstration Fund)
  Steps completed: __ / 12
  Steps passed: __ / 12
  Blocking issues found:
  Non-blocking issues found:
  Operator signature or typed confirmation:
END_REHEARSAL_ATTESTATION
```

---

## Founding Customer Readiness Verdict

The founding customer onboarding may proceed when:

1. All 12 rehearsal steps pass.
2. No blocking issues remain.
3. The rehearsal attestation is completed and signed.
4. The pen-test suite (35/35) passes on the target environment.
5. The full LP Twin test suite (222/222) passes on the target environment.

**Current status:** REHEARSAL SCRIPT READY — EXECUTION PENDING
