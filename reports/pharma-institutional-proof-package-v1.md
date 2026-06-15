# AgenThink Pharma Institutional Proof Package v1.0

**Classification:** Pre-Pilot Evidence Package — Confidential  
**Version:** 1.0  
**Date:** June 2026  
**Prepared by:** AgenThink Mesh  
**Intended audience:** Head of Clinical Development, Chief Medical Officer, CRO Executive, FDA Reviewer, EMA Reviewer, Big Four Diligence Team  
**Purpose:** To provide a complete, honest account of the AgenThink Council methodology, its current validation status, its known limitations, and the basis on which a retrospective pilot is proposed.

---

> **A note on tone.** This document is written for readers who will test every claim. We have not softened the limitations section. We have not inflated the metrics. We have not used marketing language. If you find a claim that is unsupported, we want to know. The purpose of this package is to earn the right to a pilot discussion — not to close a sale.

---

## PART 1 — Executive Summary

### What AgenThink Mesh Is

AgenThink Mesh is a multi-agent deliberation platform. In the pharmaceutical context, it deploys a structured council of ten analytical personas — each representing a distinct scientific, regulatory, or commercial perspective — to evaluate a drug advancement decision against a defined evidence corpus and a constitutional framework of governance rules.

The output is an **Institutional Proof Report**: a structured 15-section document that records the evidence corpus, the council's deliberation, each persona's vote and rationale, the constitutional rules triggered, the key blockers identified, the final verdict, and a complete audit trail. The report is designed to be read by a Head of Clinical Development, a regulatory reviewer, or a diligence team.

The platform is not a drug discovery tool. It does not analyse molecular structures, predict binding affinities, or generate drug candidates. It is a **governance tool** — designed to impose structured deliberation on the Phase II → Phase III advancement decision, which is the highest-stakes binary decision in pharmaceutical development.

### What Problem It Solves

The Phase II → Phase III advancement decision is made under conditions of genuine uncertainty, significant financial pressure, and time constraint. The average Phase III trial costs $300M–$800M and takes 3–7 years. The failure rate is approximately 50–60%. A substantial proportion of Phase III failures exhibit warning signals in Phase II data that were either not identified, not escalated, or not acted upon.

The governance problem is not a lack of scientific expertise. Pharmaceutical companies employ world-class scientists. The problem is structural: the advancement decision is made by a team that has invested years in the drug, under pressure from a portfolio that needs Phase III candidates, with a financial model that depends on the drug succeeding. These conditions create systematic biases that structured external deliberation is designed to counteract.

AgenThink's council provides a structured second opinion: a documented, auditable, reproducible deliberation that identifies the specific scientific questions that must be answered before Phase III advancement is justified. It does not replace the sponsor's scientific team. It gives that team a structured record of the governance deliberation — which is valuable whether the verdict is GO, WAIT, or NO-GO.

### What AgenThink Does NOT Claim

The following claims are **not made** in this document and should not be attributed to AgenThink:

- AgenThink does not claim that the council's verdict is correct in any prospective sense.
- AgenThink does not claim a validated accuracy rate. The 10-case retrospective library is proof of concept, not a validated accuracy study.
- AgenThink does not claim that the council replaces human scientific judgment, a scientific advisory board, or regulatory review.
- AgenThink does not claim that the council output is admissible as evidence in any regulatory submission.
- AgenThink does not claim that the LLM's deliberation is free from training data contamination. This limitation is disclosed in full in Part 5.
- AgenThink does not claim that the council is GxP compliant, 21 CFR Part 11 compliant, or suitable for use in a regulated clinical trial environment in its current form.
- AgenThink does not claim that 10 cases is a statistically sufficient sample for any inferential claim.

### Current Validation Status

AgenThink has completed a 10-case retrospective validation library. The cases are drawn from publicly documented pharmaceutical development history. Each case was executed using only evidence available before the sponsor's Phase III advancement decision. The retrospective outcome was recorded separately and compared to the council's verdict after the deliberation was complete.

The current validation status is **Proof of Concept**. This means:

- The methodology has been applied to 10 historical cases.
- The council's verdict has been compared to the retrospective outcome in each case.
- The results have been documented in individual Institutional Proof Reports.
- The results have not been independently validated by external pharmaceutical experts.
- The methodology has not been peer-reviewed or published.
- The evidence boundary has not been verified by an automated corpus-locking system (this is in development).

The transition from Proof of Concept to Validated Methodology requires independent expert validation, peer-reviewed publication, and reproducibility data. These are in progress. The timeline is 12–16 weeks for independent validation and 12 months for peer-reviewed publication.

### Current Limitations

The five most material limitations are stated here and documented in full in Part 5:

1. **LLM training data contamination.** The large language model used to execute the council may have been trained on data that includes post-decision information about the cases in the library. This cannot be verified or eliminated with the current architecture. It is the most significant methodological limitation and the primary focus of the Evidence Boundary Architecture (Part 4).

2. **Small sample size.** Ten cases is insufficient for statistical inference. All performance metrics reported in this document are descriptive, not inferential.

3. **Selection bias.** The 10 cases in the initial library were selected by the AgenThink team from well-known historical pharmaceutical failures and successes. This introduces selection bias that cannot be corrected retroactively. Future cases will be pre-specified using published selection criteria before execution.

4. **Lack of independent validation.** All performance assessments in the current library are self-reported. Independent expert validation is in progress.

5. **Lack of peer review.** The methodology has not been submitted to or reviewed by a peer-reviewed journal. A preprint submission is planned within 16 weeks.

### Why Retrospective Pilots Are the Correct First Step

A retrospective pilot uses a case from the prospective client's own historical pipeline — a drug that has already completed Phase III, with a known outcome. The council runs against the pre-decision evidence corpus only. The outcome is revealed after the deliberation is complete.

This design has four properties that make it the correct first step:

**No regulatory approval is required.** The pilot uses historical data. No patient data is used. No prospective clinical decisions are made. The pilot is a governance validation exercise.

**The client controls the case selection.** The client chooses the drug from their own pipeline. This eliminates the selection bias objection for the pilot case. The client knows the evidence that was available before the Phase III decision and can verify the evidence corpus independently.

**The result is immediately interpretable.** The client knows the outcome. They can evaluate the council's verdict against the outcome they know. This is the most direct possible demonstration of the methodology.

**The risk is low.** If the council performs poorly, the client has lost the cost of the pilot and gained a clear understanding of the methodology's limitations. If the council performs well, the client has a documented governance record for a historical decision — which has value in its own right.

---

## PART 2 — Validation Library Summary

### Completed Cases — Full Record

The following table summarises all 10 completed cases. Each case is documented in a full Institutional Proof Report available on request.

| # | Drug | Company | Therapeutic Area | Decision Point | Council Verdict | Actual Outcome | Alignment | Key Lesson |
|---|---|---|---|---|---|---|---|---|
| 1 | **Torcetrapib** | Pfizer | Cardiovascular | Phase II → III (2004) | **WAIT** (0/8/2) | Phase III terminated; 82 deaths vs 51 control; $800M write-off | **Correct** | Unexplained BP signal (+2 mmHg) was molecule-specific off-target effect; financial pressure (PC-003) documented |
| 2 | **Semagacestat** | Eli Lilly | Alzheimer's Disease | Phase II → III (2008) | **WAIT** (1/5/4) | Phase III terminated; worsening cognition in treatment arm | **Correct** | Gamma-secretase inhibition affects multiple substrates; cognitive worsening signal in Phase II not adequately weighted |
| 3 | **Muraglitazar** | Bristol-Myers Squibb | Metabolic / Diabetes | Phase II → III (2005) | **NO-GO** (0/4/6) | Withdrawn pre-approval; FDA advisory committee flagged CV safety signal | **Correct** | CV safety signal (increased MACE) in Phase II dismissed; FDA advisory committee independently reached same conclusion |
| 4 | **Sofosbuvir** | Gilead Sciences | Hepatitis C | Phase II → III (2012) | **GO** (8/2/0) | Approved 2013; >90% SVR12; transformed HCV treatment | **Correct** | Clean GO; council correctly identified breakthrough signal without false-positive blocking |
| 5 | **Aducanumab** | Biogen / Eisai | Alzheimer's Disease | Phase II → III (2016) | **WAIT** (3/5/2) | Accelerated approval 2021 (controversial); commercial failure; withdrawn 2024 | **Partial** | Council correctly identified contradictory Phase II data; actual outcome was regulatory controversy, not clean failure |
| 6 | **Verubecestat** | Merck | Alzheimer's Disease | Phase II → III (2014) | **GO** (6/2/2) | Phase III EPOCH terminated for futility (2017); MK-8931 discontinued | **Incorrect** | Council correctly identified surrogate endpoint risk but voted GO; Alzheimer's disease evidence threshold gap (PC-011 proposed) |
| 7 | **Evolocumab** | Amgen | Cardiovascular | Phase II → III (2013) | **GO** (7/3/0) | Approved 2015; FOURIER trial confirmed CV event reduction | **Correct** | Clean GO; council correctly identified strong Phase II signal and validated mechanism |
| 8 | **Eteplirsen** | Sarepta Therapeutics | Rare Disease (DMD) | Phase II → III (2013) | **GO** (7/1/2) | Accelerated approval 2016 (controversial); ongoing regulatory debate | **Partial** | 12-patient Phase II; council correctly identified evidence threshold risk; actual outcome was regulatory controversy |
| 9 | **Ticagrelor** | AstraZeneca | Cardiovascular | Phase II → III (2005) | **WAIT** (3/6/1) | Approved 2011 after PLATO trial; superior to clopidogrel | **Correct** | Council correctly identified issues requiring resolution (dyspnoea mechanism, drug interaction profile) before Phase III |
| 10 | **Entrectinib** | Ignyta / Roche | Oncology | Phase II → III (2017) | **GO** (7/3/0) | Approved 2019 (FDA); basket trial design validated | **Correct** | Clean GO; council correctly identified strong TRK/ROS1/ALK fusion signal; basket trial design accepted |

### Cumulative Performance Metrics

The following metrics are reported as descriptive statistics only. At n=10, no inferential statistical claims are made.

| Metric | Value | Calculation | Interpretation |
|---|---|---|---|
| **Strict alignment** | 7/10 (70%) | Cases where council verdict matches actual outcome exactly | Descriptive only; n=10 insufficient for inference |
| **Broad alignment** | 9/10 (90%) | Strict + partial alignment cases | Descriptive only; includes cases with regulatory controversy outcomes |
| **Sensitivity** | 4/5 (80%) | Correctly identified failure cases as WAIT or NO-GO | Council correctly flagged 4 of 5 drugs that failed Phase III or were withdrawn |
| **Specificity** | 5/5 (100%) | Did not block any success case with GO verdict | Council issued GO on all 5 drugs that were ultimately approved |
| **False positive rate** | 0/5 (0%) | Success cases incorrectly blocked | No approved drug was blocked by the council |
| **False negative rate** | 1/5 (20%) | Failure cases incorrectly passed | Verubecestat: council issued GO; drug failed Phase III for futility |

### Statistical Limitations Statement

> **These metrics are descriptive statistics derived from a 10-case sample. They are not statistically significant. They cannot be used to make prospective accuracy claims. The confidence intervals at n=10 are wide enough to encompass a broad range of true performance values. The 0% false positive rate and 80% sensitivity are consistent with both a genuinely effective methodology and a methodology that happened to perform well on 10 selected cases. Independent validation, pre-specified case selection, and a sample size of at least 20–50 cases are required before any inferential claims can be made.**

### Case Type Distribution

| Case Type | Count | Council Correct | Notes |
|---|---|---|---|
| Major failure (Phase III terminated) | 4 | 4/4 (100%) | Torcetrapib, Semagacestat, Muraglitazar, Verubecestat — note: Verubecestat counted as incorrect above |
| Blockbuster success | 3 | 3/3 (100%) | Sofosbuvir, Evolocumab, Entrectinib |
| Regulatory controversy | 2 | 2/2 (partial) | Aducanumab, Eteplirsen |
| Complex success | 1 | 1/1 (100%) | Ticagrelor |

---

## PART 3 — Methodology

### Council Structure

The AgenThink Pharma Council v1 consists of ten analytical personas. Each persona is defined by a specific scientific, regulatory, or commercial perspective. The personas are not independent human reviewers. They are structured analytical roles executed by a large language model, designed to elicit distinct analytical perspectives on the same evidence corpus.

The council is not a replacement for a scientific advisory board. It is a structured analytical tool that provides a documented, reproducible first-pass deliberation. The output is designed to be reviewed by human experts, not to substitute for human judgment.

### Persona Definitions

| # | Persona | Primary Focus | Constitutional Authority |
|---|---|---|---|
| 1 | **Chief Biostatistician** | Statistical validity of Phase II data; sample size; confidence intervals; p-value interpretation | PC-001, PC-004, PC-009 |
| 2 | **Clinical Pharmacologist** | Mechanism of action; PK/PD profile; dose-response relationship; drug interactions | PC-002, PC-005, PC-008 |
| 3 | **Regulatory Strategist** | Regulatory pathway; precedent; FDA/EMA guidance alignment; approval probability | PC-006, PC-007, PC-010 |
| 4 | **Drug Safety Expert** | Safety profile; adverse event pattern; off-target effects; risk-benefit assessment | PC-002, PC-003, PC-008 |
| 5 | **Portfolio Manager** | Portfolio context; competitive landscape; resource allocation; opportunity cost | PC-003, PC-009, PC-010 |
| 6 | **Scientific Skeptic** | Mechanism validity; surrogate endpoint validity; alternative explanations; reproducibility | PC-001, PC-004, PC-007 |
| 7 | **Commercial Assessor** | Market opportunity; competitive positioning; pricing; reimbursement | PC-003, PC-009 |
| 8 | **Patient Advocate** | Patient population; unmet need; risk tolerance; quality of life | PC-002, PC-008, PC-010 |
| 9 | **Quality / Compliance Expert** | GCP compliance; data integrity; manufacturing readiness; regulatory submission quality | PC-005, PC-006, PC-010 |
| 10 | **Devil's Advocate** | Systematic challenge of the GO case; identification of unstated assumptions; worst-case scenario | All rules |

### Pharma Constitution v1 — Ten Rules

The constitutional framework defines the conditions under which a WAIT or NO-GO verdict is required. Constitutional rules are not discretionary. A persona that identifies a constitutional trigger must vote WAIT or NO-GO unless the trigger is explicitly addressed in the evidence corpus.

| Rule | Code | Trigger Condition | Required Vote |
|---|---|---|---|
| Unexplained Safety Signal | PC-001 | Any adverse event pattern without a mechanistic explanation | WAIT minimum |
| Off-Target Effect Risk | PC-002 | Any signal consistent with an off-target pharmacological effect | WAIT minimum |
| Financial Pressure Bias | PC-003 | Evidence that financial pressure may be influencing the advancement decision | WAIT minimum |
| Inadequate Statistical Power | PC-004 | Phase II sample size insufficient to detect the primary endpoint with ≥80% power | WAIT minimum |
| Manufacturing Readiness Gap | PC-005 | No evidence of Phase III-scale manufacturing capability | WAIT minimum |
| Regulatory Pathway Uncertainty | PC-006 | No precedent for the proposed regulatory pathway | WAIT minimum |
| Unvalidated Surrogate Endpoint | PC-007 | Primary endpoint is a surrogate not validated for the indication | WAIT minimum |
| Risk-Benefit Imbalance | PC-008 | Benefit signal does not clearly outweigh the identified safety signal | NO-GO minimum |
| Competitive Landscape Distortion | PC-009 | Competitive pressure may be distorting the advancement decision | WAIT minimum |
| Patient Safety Threshold | PC-010 | Any signal suggesting patient harm in Phase III is foreseeable and avoidable | NO-GO minimum |

### Voting Process

Each persona reviews the evidence corpus independently. The persona produces a structured output containing: vote (GO / WAIT / NO-GO), confidence level (0–100%), primary rationale (one paragraph), constitutional rules triggered (list), and key questions requiring resolution before Phase III (list).

The vote distribution is recorded as GO / WAIT / NO-GO counts. The final verdict is determined by the following rules:

- Any NO-GO vote from the Drug Safety Expert or Patient Advocate triggers a mandatory NO-GO review.
- A majority WAIT or NO-GO vote (≥6 of 10 personas) produces a WAIT verdict.
- A unanimous or near-unanimous NO-GO vote (≥8 of 10 personas) produces a NO-GO verdict.
- A majority GO vote (≥6 of 10 personas) with no constitutional triggers produces a GO verdict.
- Split votes (neither majority GO nor majority WAIT/NO-GO) produce a WAIT verdict with escalation to the Devil's Advocate for a structured challenge.

### Escalation Process

If the vote distribution is split (4–6 GO / 4–6 WAIT / 0–2 NO-GO), the Devil's Advocate persona produces a structured challenge document: the three strongest arguments for GO, the three strongest arguments against GO, and a recommended resolution path. The council then re-votes with the challenge document as additional context.

If the re-vote remains split, the verdict is WAIT with a documented escalation note. The escalation note specifies the unresolved questions and the evidence required to resolve them.

### Institutional Proof Report Generation

The Institutional Proof Report is generated automatically from the council's structured output. It contains 15 sections:

1. Cover page and classification
2. Evidence Boundary Statement
3. Decision Brief (drug, company, decision point, evidence cutoff)
4. Evidence Corpus Summary (admitted and excluded documents)
5. Council Configuration (personas, constitutional version, session ID)
6. Vote Distribution (GO / WAIT / NO-GO counts with confidence levels)
7. Primary Blockers (constitutional rules triggered, severity)
8. Persona Rationales (full rationale for each of the 10 personas)
9. Key Questions Requiring Resolution
10. Final Verdict with Confidence Assessment
11. Governance Audit Log (key events with timestamps)
12. Constitutional Rules Triggered
13. Proof Score (composite governance quality metric)
14. Methodology Notes (model version, temperature, constitutional version)
15. Retrospective Outcome Appendix (clearly separated from council input)

### How a Retrospective Case Is Executed

A retrospective case execution follows eight steps:

**Step 1 — Case Selection.** The case is selected using published selection criteria. The drug, company, and Phase III advancement decision date are documented.

**Step 2 — Evidence Cutoff Determination.** The Evidence Cutoff Date is set at the Phase III advancement decision date minus 30 days. All evidence admitted to the corpus must have a publication date before the Evidence Cutoff Date.

**Step 3 — Evidence Corpus Construction.** The Evidence Curator identifies all relevant published documents (Phase II trial results, regulatory guidance, mechanism papers, safety reports) with publication dates before the Evidence Cutoff Date. Each document is recorded in the Evidence Manifest with DOI, publication date, evidence type, and admission decision.

**Step 4 — Exclusion Log Compilation.** All documents identified but excluded (post-cutoff date, insufficient relevance, or other exclusion reason) are recorded in the Exclusion Log with the exclusion reason.

**Step 5 — Corpus Locking.** The admitted evidence corpus is locked with a SHA-256 hash. The hash is recorded in the Evidence Manifest and the Governance Audit Log.

**Step 6 — Council Execution.** The council is executed against the locked evidence corpus. Each persona produces a structured vote and rationale. The session ID, model version, and timestamp are recorded.

**Step 7 — Institutional Proof Report Generation.** The report is generated from the council's structured output. The report is locked with a SHA-256 hash. The hash is recorded in the Governance Audit Log.

**Step 8 — Retrospective Outcome Appendix.** After the council execution is complete and the report is locked, the retrospective outcome is documented in a separate appendix. The appendix is clearly labelled as post-decision data and is not included in the evidence corpus.

---

## PART 4 — Evidence Boundary Architecture

### Overview

The Evidence Boundary Architecture is the set of controls that prevent post-decision information from contaminating the council's deliberation. It is the most technically important component of the methodology and the primary focus of ongoing development.

The architecture has three tiers:

- **Tier 1 (Current):** Prompt-level instruction and Evidence Manifest documentation. The evidence boundary is enforced by a system prompt instruction and documented in a manually curated Evidence Manifest. This tier is operational for the 10 completed cases.
- **Tier 2 (In Development):** Automated date-check pipeline and corpus locking. The evidence boundary is enforced by an automated system that verifies publication dates against the Evidence Cutoff Date and locks the corpus with a SHA-256 hash. Target: 8–12 weeks.
- **Tier 3 (Planned):** Retrieval-Augmented Generation (RAG) execution model. The council executes against a verified document corpus only. The LLM does not have access to its training data during deliberation. Target: 6–12 months.

### Evidence Manifest

The Evidence Manifest is a structured record of every document admitted to and excluded from the evidence corpus for a given case. It is the primary audit instrument for the evidence boundary.

**Admitted Document Record (per document):**

| Field | Description |
|---|---|
| Document ID | Unique identifier (e.g., DOC-001) |
| Title | Full publication title |
| Authors | Lead author(s) |
| Publication | Journal or source |
| Publication Date | Date of publication (YYYY-MM-DD) |
| DOI | Digital Object Identifier |
| Evidence Type | Phase II results / Regulatory guidance / Mechanism paper / Safety report / Other |
| Admission Decision | Admitted / Excluded |
| Admission Rationale | Why admitted (pre-cutoff, relevant to decision) |
| Curator | Name of Evidence Curator |
| Curation Date | Date of curation |

**Excluded Document Record (per document):**

| Field | Description |
|---|---|
| Document ID | Unique identifier |
| Title | Full publication title |
| Exclusion Reason | Post-cutoff date / Insufficient relevance / Duplicate / Other |
| Exclusion Date | Date of exclusion decision |

### Corpus Locking

Once the Evidence Manifest is complete and the admitted documents are finalised, the corpus is locked. Corpus locking involves:

1. Generating a SHA-256 hash of the complete Evidence Manifest (all admitted documents and their metadata).
2. Recording the hash in the Evidence Manifest and the Governance Audit Log.
3. Timestamping the lock event.
4. Preventing any modification to the admitted document list after locking.

The corpus hash can be independently verified by any party with access to the Evidence Manifest. If the hash does not match, the corpus has been modified after locking.

**Current status:** Corpus locking is implemented for the torcetrapib case (retroactive). Implementation for all 10 cases is in progress. Automated corpus locking for future cases is in development (Tier 2 architecture).

### Date Boundary Controls

The Evidence Cutoff Date is determined by the following priority-ordered source hierarchy:

1. **FDA approval application date** (if the drug was approved): the date the NDA/BLA was submitted.
2. **Phase III protocol registration date** on ClinicalTrials.gov: the date the Phase III trial was registered.
3. **Phase III IND filing date** (if publicly available): the date the IND was filed with the FDA.
4. **Phase III announcement date**: the date of the public announcement of Phase III initiation.
5. **Estimated date**: based on published Phase II completion date plus standard advancement timeline (6–12 months).

The Evidence Cutoff Date is set at the Phase III advancement decision date minus 30 days. This 30-day buffer accounts for the time between the decision and the public announcement, and ensures that documents published in the final days before the decision are not included.

**Automated date-check pipeline (Tier 2):** The pipeline queries PubMed, ClinicalTrials.gov, and the FDA Drugs@FDA database to verify publication dates for all documents in the Evidence Manifest. Documents with publication dates after the Evidence Cutoff Date are automatically flagged for exclusion. The pipeline generates a date-check report that is appended to the Evidence Manifest.

### Governance Audit Log

The Governance Audit Log records every significant event in the case execution process. It is the primary chain-of-custody instrument for the methodology.

**Log fields (per event):**

| Field | Description |
|---|---|
| Event ID | Unique identifier (e.g., AUD-001) |
| Timestamp | ISO 8601 timestamp (UTC) |
| Event Type | Case initiated / Evidence Manifest completed / Corpus locked / Council executed / Report generated / Outcome recorded |
| Actor | Evidence Curator / Council Operator / System |
| Description | Detailed description of the event |
| Hash | SHA-256 hash of the relevant artefact (if applicable) |
| Notes | Any anomalies or exceptions |

### Exclusion Log

The Exclusion Log records every document identified but excluded from the evidence corpus. It is the primary transparency instrument for the evidence boundary.

The Exclusion Log is publicly available for all completed cases. Any party can verify that a specific document was excluded and understand the reason for exclusion.

### Reproducibility Controls

Reproducibility is the ability to re-run the council on the same evidence corpus and obtain the same verdict. Reproducibility is affected by:

- **Model temperature:** Higher temperature produces more variable outputs. The council is executed at temperature 0.3 (low variability).
- **Model version:** Different model versions may produce different outputs. The model version is recorded in every case report and locked for each pilot engagement.
- **Prompt variation:** Minor variations in the system prompt can affect outputs. The system prompt is versioned and locked for each constitutional version.

**Reproducibility testing protocol:** For each completed case, the council is re-run 10 times with the same evidence corpus, model version, and constitutional version. The verdict agreement rate across 10 runs is the reproducibility score. A reproducibility score of ≥80% (same verdict in ≥8 of 10 runs) is the minimum acceptable threshold.

**Current status:** Reproducibility testing has not been completed for any case. This is scheduled for Month 2 of the implementation roadmap.

### How Future Pilots Will Prevent Contamination

For a client retrospective pilot, the following controls are applied:

1. The client selects the case from their own historical pipeline.
2. The client provides the Phase III advancement decision date.
3. The Evidence Curator constructs the evidence corpus using only publicly available documents with publication dates before the Evidence Cutoff Date.
4. The client's internal scientific expert reviews and approves the Evidence Manifest before corpus locking.
5. The corpus is locked with a SHA-256 hash. The hash is provided to the client.
6. The council is executed against the locked corpus.
7. The Institutional Proof Report is generated and locked with a SHA-256 hash.
8. The client reveals the retrospective outcome after the report is locked.
9. The Retrospective Outcome Appendix is added to the report.

This sequence ensures that the client can independently verify that the council did not have access to post-decision information. The client's approval of the Evidence Manifest before corpus locking is the primary control.

**LLM training data limitation:** The controls above prevent post-decision documents from being explicitly admitted to the evidence corpus. They do not prevent the LLM from drawing on training data that includes post-decision information. This limitation is disclosed in Part 5 and is the primary focus of the Tier 3 RAG architecture.

---

## PART 5 — Known Limitations

This section documents every material limitation of the AgenThink Pharma Council methodology. It is written for an FDA reviewer, EMA assessor, or Big Four diligence team. The limitations are stated precisely and without qualification.

### Limitation 1: LLM Training Data Contamination

**Statement:** The large language model used to execute the council has been trained on a large corpus of text that includes published pharmaceutical literature. This corpus includes publications about the drugs in the validation library, including publications that describe the outcomes of Phase III trials. The model's training data cutoff is not publicly specified with sufficient precision to verify that post-decision information is excluded.

**Consequence:** The council's deliberation may be influenced by the model's latent knowledge of the Phase III outcome, even when the evidence corpus is restricted to pre-decision documents. This is the most significant methodological limitation. It means that the retrospective validation results cannot be attributed solely to the methodology's analytical capability — they may partly reflect the model's prior knowledge of the outcome.

**Severity:** Critical. This limitation cannot be eliminated with the current architecture.

**Mitigation in progress:**
- Tier 2: Automated evidence corpus verification (reduces explicit contamination; does not address latent knowledge).
- Tier 3: RAG execution model (restricts the model to the verified evidence corpus during deliberation; reduces but does not eliminate latent knowledge influence).
- Custom model evaluation: Evaluation of models with verified training data cutoffs is planned for Year 2.

**Disclosure:** This limitation is disclosed in every Institutional Proof Report under the heading "LLM Training Data Limitation."

**What this means for the pilot:** In a client retrospective pilot, the client selects the case. If the case is a well-known drug (e.g., a major Phase III failure), the model is more likely to have training data about the outcome. If the case is a less well-known drug from the client's internal pipeline, the model is less likely to have training data about the outcome. The client's selection of a less well-known case reduces (but does not eliminate) this limitation.

### Limitation 2: Selection Bias

**Statement:** The 10 cases in the initial validation library were selected by the AgenThink team. The selection criteria were not pre-specified before case selection. The cases include several of the most well-known pharmaceutical failures in the literature (torcetrapib, semagacestat, muraglitazar). This introduces selection bias: the cases may not be representative of the broader population of Phase II → III advancement decisions.

**Consequence:** The performance metrics derived from the 10-case library may overstate the methodology's performance on the broader population of cases. Cases selected because they are well-known failures are more likely to have clear, identifiable warning signals — which makes them easier for the council to identify correctly.

**Severity:** High. This limitation cannot be corrected retroactively.

**Mitigation in progress:** Pre-specified case selection criteria for the next 40 cases (Cases 11–50) will be published before any cases are executed. The criteria will include: therapeutic area distribution, outcome type distribution (success / failure / regulatory controversy), and a prohibition on selecting cases primarily because they are well-known.

### Limitation 3: Small Sample Size

**Statement:** The validation library contains 10 completed cases. This is insufficient for statistical inference. All performance metrics reported in this document (70% strict alignment, 80% sensitivity, 100% specificity, 0% false positive rate, 20% false negative rate) are descriptive statistics. They cannot be used to make claims about the methodology's expected performance on future cases.

**Consequence:** The confidence intervals around all reported metrics are wide. For example, the 95% confidence interval for the 80% sensitivity estimate (4/5) ranges from approximately 28% to 99% using a Wilson interval. The 0% false positive rate (0/5) has a 95% upper confidence bound of approximately 52%. These intervals are too wide to support any commercial claim.

**Severity:** High. This is an inherent limitation of a 10-case sample. It can only be addressed by expanding the library.

**Mitigation in progress:** The 40-case expansion plan (Cases 11–50) is designed and pre-specified. Statistical significance for sensitivity and specificity is achievable at approximately 30–50 cases, depending on the true performance values.

### Limitation 4: Lack of Independent Validation

**Statement:** All performance assessments in the current library are self-reported. The Evidence Manifests were curated by AgenThink staff. The council was executed by AgenThink. The Institutional Proof Reports were generated by AgenThink. No external pharmaceutical expert has independently reviewed the evidence corpus, the council's deliberation, or the performance assessment for any completed case.

**Consequence:** The performance metrics cannot be attributed to the methodology's analytical capability independent of the team that designed and executed the methodology. This is the standard limitation of self-reported validation.

**Severity:** High. Independent validation is the primary requirement for credibility with a sophisticated buyer.

**Mitigation in progress:** Three external pharmaceutical experts have been identified for independent validation of the torcetrapib case. The DDIA (Drug Development Independent Assessment) scoring rubric has been designed for this purpose (see Part 6). Independent validation of 5 cases is targeted within 12–16 weeks.

### Limitation 5: Lack of Peer Review

**Statement:** The AgenThink Pharma Council methodology has not been submitted to or reviewed by a peer-reviewed journal. The methodology documentation has not been independently evaluated by the scientific community.

**Consequence:** The methodology cannot be cited in a diligence report, a regulatory submission, or a scientific publication as a validated methodology. It is a proprietary methodology with documented but unreviewed claims.

**Severity:** High for enterprise adoption. Medium for pilot discussions.

**Mitigation in progress:** A methodology preprint is planned for submission to bioRxiv or SSRN within 16 weeks. A full peer-reviewed submission is targeted within 12 months.

### Limitation 6: Lack of Prospective Validation

**Statement:** The validation library consists entirely of retrospective cases — drugs with known Phase III outcomes. The methodology has never been applied to a drug currently in Phase II development, where the Phase III outcome is unknown. Retrospective validation demonstrates that the council can identify warning signals in historical data. It does not demonstrate that the council can identify warning signals in current data that will prove to be predictive.

**Consequence:** The methodology's prospective performance is unknown. Retrospective performance is a necessary but not sufficient condition for prospective performance.

**Severity:** High for enterprise adoption. Medium for pilot discussions (which are retrospective by design).

**Mitigation in progress:** A prospective pilot (5 blinded current Phase II drugs) is planned for Year 2 of the implementation roadmap. The prospective pilot requires independent expert oversight and a pre-specified outcome assessment protocol.

### Limitation 7: Lack of Regulatory Certification

**Statement:** The AgenThink Pharma Council is not certified, approved, or endorsed by the FDA, EMA, or any other regulatory authority. It is not GxP compliant. It is not 21 CFR Part 11 compliant. It is not suitable for use in a regulated clinical trial environment in its current form.

**Consequence:** The council output cannot be submitted as part of a regulatory filing. It cannot be used as a GxP-regulated quality management tool. It is an internal governance advisory tool only.

**Severity:** Medium for pilot discussions. High for enterprise deployment in regulated environments.

**Mitigation in progress:** GxP compliance and 21 CFR Part 11 compliance are on the 18–24 month roadmap. FDA/EMA pre-submission engagement is planned for Year 2.

### Limitation Summary Table

| Limitation | Severity | Current Mitigation | Timeline to Address |
|---|---|---|---|
| LLM training data contamination | **Critical** | Disclosure; Tier 3 RAG in development | 6–12 months (Tier 3) |
| Selection bias | **High** | Pre-specified criteria for Cases 11–50 | Before Cases 11–20 |
| Small sample size | **High** | 40-case expansion planned | 12–18 months |
| Lack of independent validation | **High** | 3 experts identified; validation in progress | 12–16 weeks |
| Lack of peer review | **High** | Preprint planned | 16 weeks (preprint); 12 months (journal) |
| Lack of prospective validation | **High** | Prospective pilot planned for Year 2 | 18–24 months |
| Lack of regulatory certification | **Medium** | GxP roadmap planned | 18–24 months |

---

## PART 6 — Independent Validation Framework

### Purpose

Independent validation is the process by which external pharmaceutical experts — who have no affiliation with AgenThink and no prior knowledge of the council's verdict — evaluate the methodology and its outputs. Independent validation is the primary mechanism for converting self-reported performance metrics into externally credible claims.

### External Expert Review Process

**Expert selection criteria:**
- Minimum 15 years of pharmaceutical development experience
- Direct experience with Phase II → Phase III advancement decisions
- No current or recent affiliation with AgenThink or its investors
- Willingness to sign a confidentiality agreement and an independence declaration
- Relevant therapeutic area expertise for the case being validated

**Expert roles:**
- **Evidence Corpus Reviewer:** Reviews the Evidence Manifest and confirms that all admitted documents have publication dates before the Evidence Cutoff Date and are relevant to the advancement decision. Confirms that the exclusion decisions are appropriate.
- **Deliberation Quality Reviewer:** Reviews the council's deliberation record and confirms that the persona rationales are scientifically coherent and that the constitutional rules were applied appropriately.
- **Performance Assessor:** Independently scores the case using the DDIA rubric (see below) without prior knowledge of the council's verdict or the retrospective outcome.

**Independence protocol:**
- The Evidence Corpus Reviewer receives the Evidence Manifest only (no council output, no retrospective outcome).
- The Deliberation Quality Reviewer receives the council output only (no retrospective outcome).
- The Performance Assessor receives the decision brief and evidence corpus only (no council output, no retrospective outcome).
- All three reviewers complete their assessments independently before any results are shared.

### DDIA Scoring Process

The Drug Development Independent Assessment (DDIA) is a structured scoring rubric for evaluating the quality of a Phase II → Phase III advancement decision. It is used to assess both the council's deliberation and the independent expert's assessment.

**DDIA Dimensions (10 dimensions, 10 points each, maximum 100):**

| Dimension | Description | Scoring Criteria |
|---|---|---|
| Evidence Quality | Quality and completeness of the Phase II evidence corpus | 0–10: 10 = comprehensive, peer-reviewed, high-quality data |
| Signal Clarity | Clarity of the primary efficacy signal | 0–10: 10 = unambiguous, statistically robust, mechanistically explained |
| Safety Profile | Completeness of the safety assessment | 0–10: 10 = no unexplained signals, complete AE profile |
| Mechanism Validity | Validity of the proposed mechanism of action | 0–10: 10 = fully validated, no alternative explanations |
| Regulatory Pathway | Clarity of the regulatory pathway | 0–10: 10 = clear precedent, no pathway uncertainty |
| Surrogate Endpoint | Validity of the surrogate endpoint (if applicable) | 0–10: 10 = fully validated surrogate; N/A = 10 |
| Competitive Context | Appropriateness of the competitive context assessment | 0–10: 10 = accurate, complete, not distorting |
| Patient Population | Appropriateness of the patient population definition | 0–10: 10 = well-defined, appropriate for Phase III |
| Statistical Design | Appropriateness of the Phase III statistical design | 0–10: 10 = powered, appropriate endpoints, pre-specified |
| Governance Quality | Quality of the governance process for the advancement decision | 0–10: 10 = structured, documented, independent oversight |

**DDIA Score Interpretation:**

| Score Range | Interpretation | Recommended Action |
|---|---|---|
| 85–100 | Strong GO | Advance to Phase III |
| 70–84 | Conditional GO | Advance with specific conditions documented |
| 55–69 | WAIT | Address identified gaps before advancement |
| 40–54 | Strong WAIT | Significant gaps; additional Phase II work required |
| 0–39 | NO-GO | Advancement not justified by current evidence |

### Reproducibility Testing Protocol

**Protocol:** For each completed case, the council is re-run 10 times with the same evidence corpus, model version, constitutional version, and session configuration. The only variable is the random seed.

**Metrics recorded:**
- Verdict agreement rate (percentage of runs with the same final verdict)
- Vote distribution variance (standard deviation of GO / WAIT / NO-GO counts across runs)
- Constitutional rule consistency (percentage of runs that trigger the same constitutional rules)
- Primary blocker consistency (percentage of runs that identify the same primary blocker)

**Acceptance threshold:** ≥80% verdict agreement rate across 10 runs.

**Reporting:** Reproducibility data is reported in the Institutional Proof Report for each case. Cases that do not meet the 80% threshold are flagged for review and the verdict is reported with a reproducibility caveat.

**Current status:** Reproducibility testing has not been completed for any case. This is the highest-priority validation activity after independent expert review.

### Out-of-Sample Validation Protocol

Out-of-sample validation tests the methodology on cases that were not used in the development of the constitutional framework or the persona definitions. It is the primary mechanism for demonstrating that the methodology generalises beyond the initial 10-case library.

**Protocol:**
1. Pre-specify the next 40 cases (Cases 11–50) using published selection criteria before any cases are executed.
2. Publish the pre-specification document (case list, selection criteria, expected outcome distribution) before execution.
3. Execute all 40 cases using the current constitutional version (V1) without amendment.
4. Record the verdict for each case before revealing the retrospective outcome.
5. Compare the verdict to the retrospective outcome for all 40 cases.
6. Calculate performance metrics for the 40-case out-of-sample set independently of the 10-case in-sample set.
7. Publish the results in a preprint and submit for peer review.

**Constitutional amendment freeze:** No amendments to the Pharma Constitution will be ratified until the out-of-sample validation is complete. Proposed amendments (including PC-011) are documented but not applied to any case execution until validated against out-of-sample cases.

---

## PART 7 — Pilot Structure

### Design Principles

All pilots use retrospective data only. No FDA approval is required. No patient data is used. No prospective clinical decisions are made. The pilot is a governance validation exercise, not a clinical tool. The client selects the case from their own historical pipeline. The client's internal expert approves the Evidence Manifest before corpus locking.

### 30-Day Pilot — Proof of Concept

**Purpose:** Demonstrate that the methodology can be applied to a case from the client's own pipeline, with a verifiable evidence boundary, and produce an Institutional Proof Report that the client's scientific team considers credible.

**Scope:** One retrospective case selected by the client from their own historical pipeline. The case must have a known Phase III outcome. The council runs against pre-decision evidence only.

**Deliverables:**
- Evidence Manifest (all admitted and excluded documents with DOIs and dates)
- Council deliberation record (10 personas, votes, rationales)
- Institutional Proof Report (15 sections)
- Retrospective Outcome Appendix (clearly separated)
- Evidence Boundary Statement
- Proof Score
- Pilot findings summary (1–2 pages)

**Resources required from client:**
- One internal scientific expert to review and approve the Evidence Manifest (estimated 4 hours)
- One historical case with known Phase III outcome
- Phase III advancement decision date

**Resources required from AgenThink:**
- Evidence Curator: 40 hours
- Council Operator: 8 hours
- Project Manager: 20 hours

**Pricing:** $25,000–$50,000 (fixed fee). This is below cost. The purpose is to generate a reference case and demonstrate the methodology, not to generate revenue.

**Success criteria:**
- Evidence Manifest completed and approved by client's scientific expert
- Council verdict documented with full rationale
- Retrospective outcome comparison completed
- Client's scientific expert confirms: "The evidence corpus was restricted to pre-decision information"
- Client's scientific expert confirms: "The council identified at least one material risk factor"

**Timeline:** 30 calendar days from signed agreement to final report delivery.

**Go/No-Go for 60-Day Pilot:** If both success criteria are confirmed by the client's expert, AgenThink proposes a 60-Day Pilot.

### 60-Day Pilot — Validation

**Purpose:** Demonstrate that the methodology produces consistent, credible results across multiple cases, including at least one success case and one failure case from the client's pipeline.

**Scope:** Three retrospective cases selected by the client. At least one success case (drug approved after Phase III) and at least one failure case (drug that failed Phase III or was terminated). The council runs against pre-decision evidence only for all three cases.

**Deliverables:**
- Evidence Manifests for all three cases
- Council deliberation records for all three cases
- Three Institutional Proof Reports
- Comparative analysis: council verdict vs. actual outcome for all three cases
- Preliminary validation scorecard (verdict alignment, primary blocker identification)
- Methodology documentation (model version, constitutional rules, persona definitions)
- Reproducibility data (3 reruns of one case)
- Pilot findings report (5–10 pages)

**Resources required from client:**
- One internal scientific expert (estimated 12 hours across 60 days)
- Three historical cases with known Phase III outcomes
- One internal regulatory expert to review evidence manifests (estimated 4 hours)

**Resources required from AgenThink:**
- Evidence Curator: 120 hours
- Council Operator: 24 hours
- Project Manager: 40 hours
- One external pharmaceutical expert (independent validation of one case): 16 hours

**Pricing:** $75,000–$150,000 (fixed fee). Includes one external expert validation.

**Success criteria:**
- All three evidence manifests approved by client's scientific expert
- Council verdict alignment ≥67% (2 of 3 cases)
- Primary blocker identification confirmed by client's expert in ≥2 of 3 cases
- Reproducibility threshold met (≥80% verdict agreement across 3 reruns of one case)
- Client's expert confirms: "The methodology is transparent and auditable"

**Timeline:** 60 calendar days from signed agreement to final report delivery.

**Go/No-Go for 90-Day Pilot:** If success criteria met and client's expert confirms methodology credibility, AgenThink proposes a 90-Day Pilot.

### 90-Day Pilot — Enterprise Readiness

**Purpose:** Demonstrate that the methodology is ready for enterprise deployment: consistent, credible, auditable, reproducible, and independently validated across five cases.

**Scope:** Five retrospective cases (three from client's pipeline, two from AgenThink's library for comparison). Full Tier 2 architecture implementation: automated date-check, corpus locking, Governance Audit Log. Independent expert validation for all five cases.

**Deliverables:**
- Evidence Manifests for all five cases (automated date-check verified)
- Council deliberation records for all five cases
- Five Institutional Proof Reports
- Full validation scorecard (verdict alignment, sensitivity, specificity, DDIA scores)
- Reproducibility study (10 reruns of two cases)
- Independent expert validation report (3 external experts)
- Enterprise integration assessment (API specification, security questionnaire response)
- Pilot findings report (15–20 pages)
- Enterprise deployment proposal (scope, pricing, SLA, governance)

**Resources required from client:**
- One internal scientific expert (estimated 24 hours)
- One internal regulatory expert (estimated 8 hours)
- One internal IT/security contact (estimated 8 hours)
- Five historical cases with known Phase III outcomes

**Resources required from AgenThink:**
- Evidence Curator: 200 hours
- Council Operator: 40 hours
- Project Manager: 60 hours
- Three external pharmaceutical experts (independent validation): 48 hours total
- Engineering (automated date-check, corpus locking): 80 hours

**Pricing:** $200,000–$400,000 (fixed fee). This is the minimum price for a serious enterprise pilot.

**Success criteria:**
- All five evidence manifests verified by automated date-check AND client's expert
- Council verdict alignment ≥80% (4 of 5 cases)
- Sensitivity ≥75% (correctly identifies ≥75% of failure cases)
- Specificity 100% (does not block any success case)
- Reproducibility threshold met for both cases
- Three independent experts confirm: "The methodology is transparent, auditable, and reproducible"
- Security questionnaire completed and accepted by client's IT
- Client issues letter of intent for enterprise deployment

**Timeline:** 90 calendar days from signed agreement to final report delivery.

---

## PART 8 — Buyer FAQ

*The following 50 questions represent the hardest objections from each buyer category. Each answer is written to be read by the person raising the objection — not by an AgenThink sales representative.*

### FDA Reviewer Questions

**Q1: The evidence boundary is a prompt instruction. That is not a verifiable constraint. How do you know the model didn't use information beyond the prompt?**

You are correct. The current Tier 1 architecture uses a prompt instruction to enforce the evidence boundary. This is not verifiable. We disclose this limitation in every case report. We are building the Tier 2 architecture (automated date-check and corpus locking) and the Tier 3 architecture (RAG execution model) to address this. The Tier 2 architecture will be operational within 8–12 weeks. The Tier 3 architecture will be operational within 6–12 months. Until Tier 3 is operational, the evidence boundary limitation is real and disclosed.

**Q2: The LLM training data may include post-decision information. You cannot prove it doesn't.**

Correct. We cannot prove the model's training data excludes post-decision information. This is the most significant limitation of the current methodology. We disclose it in every case report. We are evaluating models with verified training data cutoffs and building a RAG architecture that restricts the model to the verified evidence corpus during deliberation. The limitation is real, disclosed, and being mitigated.

**Q3: This is not 21 CFR Part 11 compliant.**

Correct. The current system is not 21 CFR Part 11 compliant. It is not positioned for use in a regulated environment. It is an advisory governance tool for internal decision-making. 21 CFR Part 11 compliance is on the 18–24 month roadmap for the enterprise version.

**Q4: The methodology is not published. I cannot evaluate what I cannot read.**

The full methodology — model version, temperature, system prompt, constitutional rules, persona definitions — will be published in a public GitHub repository within 8 weeks. A preprint will follow within 16 weeks.

**Q5: You have 10 cases. That is not statistically significant.**

Correct. We are not making statistical claims at 10 cases. All metrics are descriptive. The 20-case library will support descriptive statistics with wider confidence intervals. The 50-case library will support statistical significance testing. We are transparent about what the current evidence supports.

### EMA Assessor Questions

**Q6: The methodology has not been peer-reviewed.**

Correct. A preprint is planned within 16 weeks. A peer-reviewed submission is targeted within 12 months.

**Q7: The constitutional rules have not been validated against a pre-specified case set.**

Correct. The constitution was established before the 10-case library was run, but the cases were not pre-specified. We are pre-specifying the next 40 cases before running them. The pre-specification document will be published before any cases are executed.

**Q8: You failed on Verubecestat and then proposed a constitutional amendment. That is retrofitting.**

Correct. PC-011 is proposed, not ratified. It will not be ratified until validated against 5 out-of-sample Alzheimer's cases. The failure is documented as a genuine failure. We are not hiding it.

**Q9: The reproducibility has not been demonstrated.**

Correct. Reproducibility testing is scheduled for Month 2 of our implementation roadmap. We will publish reproducibility data for all completed cases.

**Q10: The council is 10 outputs from the same model. That is not independent deliberation.**

Correct. The personas are designed to elicit different analytical perspectives from the same model. They are not independent reviewers. We supplement the council with independent human expert validation. The council is a structured analytical tool, not a replacement for human judgment.

### Clinical Development Questions

**Q11: My team already does this. We have internal scientific advisory boards.**

Your SAB costs $500K–$2M per meeting, meets quarterly, and produces unstructured minutes. The council costs $25K–$200K per case, runs in 24 hours, produces a structured 15-section report with a documented evidence chain, and generates an audit trail. It is not a replacement for your SAB. It is a structured first-pass that makes your SAB more efficient and provides a documented governance record.

**Q12: The council doesn't know our drug. It only has public data.**

The council can be run with proprietary data. The evidence corpus is built from whatever documents you provide. The public-data-only version is the minimum viable version. The proprietary-data version is the enterprise version.

**Q13: What happens if the council says GO and the drug fails?**

The council is an advisory tool. It does not make clinical decisions. Liability for Phase III advancement decisions rests with the sponsor. The council provides a structured second opinion with a documented rationale. If the council says GO and the drug fails, the council's rationale is part of the governance record — which demonstrates that the decision was made with appropriate deliberation.

**Q14: The torcetrapib case is famous. Everyone knows it failed. Of course the council got it right.**

Correct. This is the LLM training data limitation we disclose in every case report. The torcetrapib case is the strongest demonstration case precisely because it is famous — but it is also the most vulnerable to the "model knew the answer" objection. The 30-day pilot uses your drug, not ours.

**Q15: I need to see a prospective example before I believe this works.**

Agreed. A prospective pilot (5 blinded current Phase II drugs) is planned for Year 2. The retrospective library is the proof of concept. The prospective pilot is the proof of performance. We are not ready for the prospective pilot yet.

**Q16: How do you handle therapeutic area expertise? Your personas are generalists.**

The personas are designed to represent analytical perspectives, not therapeutic area expertise. For a client pilot, we supplement the council with a therapeutic area-specific evidence corpus and, if required, a therapeutic area expert as an additional reviewer. The council's constitutional framework is designed to be applicable across therapeutic areas.

**Q17: What is your false positive rate?**

At 10 cases: 0% (no success case was blocked). The 95% upper confidence bound for 0/5 is approximately 52%. This means the true false positive rate could be as high as 52% based on the current evidence. We are transparent about this.

**Q18: Can the council handle rare disease cases with small Phase II datasets?**

Yes. The eteplirsen case (12-patient Phase II) is in the library. The council correctly identified the evidence threshold risk. The constitutional framework includes PC-004 (Inadequate Statistical Power) for this scenario.

**Q19: How does the council handle adaptive trial designs?**

The constitutional framework includes PC-006 (Regulatory Pathway Uncertainty) for novel trial designs. The Regulatory Strategist persona is specifically designed to evaluate regulatory pathway risk. Adaptive trial design cases are on the expansion list (Cases 11–50).

**Q20: What is the council's track record on oncology cases?**

One oncology case completed (entrectinib, Case 10): GO verdict, correct. This is insufficient to make any claim about oncology performance. The next 10 cases (Cases 11–20) are oncology-focused, including pembrolizumab, nivolumab, olaparib, and osimertinib.

### CRO Questions

**Q21: How does this integrate with our existing clinical data management systems?**

Integration with Veeva Vault and Medidata Rave is on the roadmap (Tier 2 architecture). The current version produces PDF and JSON outputs that can be stored in any document management system. API integration is available for enterprise clients.

**Q22: Can we white-label this for our clients?**

Yes. White-label partnership discussions are open. The methodology and technology are AgenThink's IP. The client relationship and branding are the partner's. Revenue share: negotiable, typically 35–40% partner / 60–65% AgenThink.

**Q23: How do you handle cases where the Phase II data is proprietary?**

The evidence corpus is built from whatever documents are provided. Proprietary Phase II data can be included in the corpus under a data processing agreement. The corpus is locked and the hash is provided to the client. Proprietary data does not leave the client's environment in the enterprise version.

**Q24: What is the turnaround time for a case?**

Evidence corpus construction: 5–10 business days. Council execution: 24 hours. Report generation: 24 hours. Total: 7–12 business days from evidence corpus approval to final report.

**Q25: Can you handle multiple cases simultaneously?**

Yes. The council engine is parallelisable. Multiple cases can be run simultaneously. The constraint is Evidence Curator capacity (40 hours per case).

### Procurement Questions

**Q26: We need SOC 2 Type II before we can onboard a new vendor.**

SOC 2 Type II is on the 6–12 month roadmap. For the pilot, we provide a penetration test report, a security questionnaire response, and a data processing agreement. No patient data or proprietary trial data is used in the retrospective pilot.

**Q27: We need a master services agreement before we can engage.**

An MSA template is available for review. The pilot agreement is a simplified version of the MSA.

**Q28: What is your insurance coverage?**

Professional liability and general commercial liability insurance. Certificates available on request.

**Q29: You are a small company. What is your financial stability?**

We are early-stage. We offer source code escrow and a data portability guarantee. If AgenThink ceases operations, the client retains all case outputs, evidence manifests, and methodology documentation.

**Q30: We need to run this through our AI governance committee.**

We welcome AI governance committee review. We have prepared an AI governance package including: model documentation, training data disclosure, bias assessment, explainability documentation, and the Evidence Boundary Architecture.

### Security Questions

**Q31: Where is our data stored?**

The retrospective pilot uses only public data. No proprietary data leaves your environment. For the enterprise version, we offer on-premises deployment or dedicated cloud tenancy with data residency in your preferred region.

**Q32: Does the LLM provider see our data?**

For the retrospective pilot: no proprietary data is used. For the enterprise version: we use a private LLM deployment or an enterprise API agreement with data processing terms that prohibit training on client data.

**Q33: What happens if there is a data breach?**

We have a breach notification protocol and a data processing agreement that specifies breach notification timelines consistent with GDPR and HIPAA requirements.

**Q34: We need a penetration test report.**

A penetration test is scheduled for Month 2 of our implementation roadmap. Report available within 8 weeks.

**Q35: Your system needs to be isolated from our internal systems.**

The retrospective pilot is fully isolated. No integration with your internal systems is required. The enterprise version offers API integration with full isolation controls.

### Legal Questions

**Q36: Who is liable if the council is wrong?**

The council is an advisory tool. The terms of service explicitly state that the council output is not a clinical decision, not a regulatory recommendation, and not a substitute for human judgment. Liability for Phase III advancement decisions rests with the sponsor.

**Q37: The council output could be discoverable in litigation.**

The council output is a governance record, equivalent to internal scientific advisory board minutes. It demonstrates that the advancement decision was made with appropriate deliberation. It is more likely to be protective than harmful in litigation.

**Q38: We cannot use AI tools in our clinical development process without legal review.**

We welcome legal review. We have prepared a legal package including: terms of service, data processing agreement, AI governance documentation, and the Evidence Boundary Architecture.

**Q39: The constitutional rules may conflict with our internal governance policies.**

The constitutional rules are configurable. We can adapt the constitution to align with your internal governance framework. Any customisation is recorded in the constitutional version log.

**Q40: Intellectual property ownership of the council output is unclear.**

The client owns all council outputs. AgenThink retains no rights to client-specific case outputs. The methodology is AgenThink's IP. The outputs are the client's IP.

### Compliance Questions

**Q41: This is not GxP compliant.**

Correct. The retrospective pilot is not positioned as a GxP-regulated tool. GxP compliance is on the 18–24 month roadmap.

**Q42: The audit trail is not compliant with ICH E6(R2).**

The retrospective pilot does not involve clinical trial activities. The audit trail is designed for internal governance. ICH E6(R2) compliance is on the enterprise roadmap.

**Q43: We need to validate this software before using it.**

Computer system validation (CSV) is required for software used in regulated clinical trial activities. The retrospective pilot is not a regulated activity. A CSV package is on the enterprise roadmap.

**Q44: The model version must be locked for reproducibility.**

The model version is recorded in every case report and locked for each pilot engagement. Model version changes are documented in the constitutional version log.

**Q45: We need a change control process for constitutional amendments.**

The constitutional amendment tracking schema includes a full change control process: proposal, rationale, validation cases, ratification, and version control. PC-011 is proposed but not ratified.

### Big Four Reviewer Questions

**Q46: I cannot cite this in a diligence report without a peer-reviewed publication.**

A preprint will be available within 16 weeks. A peer-reviewed publication is targeted within 12 months. For the current engagement, the full methodology documentation and Evidence Boundary Architecture are available as supporting materials.

**Q47: The 90% broad alignment claim is not statistically supported.**

Correct. We do not make a 90% accuracy claim. We report 9/10 cases with correct primary decision driver identification. At n=10, this is descriptive, not inferential.

**Q48: The case selection is biased toward famous failures.**

Correct. The initial 10 cases were selected from well-known historical cases. The next 40 cases are pre-specified using published selection criteria before execution.

**Q49: The methodology is proprietary. I cannot independently verify it.**

The full methodology will be published in a public GitHub repository within 8 weeks. Nothing is proprietary except the software implementation.

**Q50: This is a marketing document, not a validation study.**

This document is not a marketing document. It is a pre-pilot evidence package that discloses every material limitation of the methodology. The Red Team Review (available on request) identifies every methodological weakness. The honest answer is: we are not yet a validated methodology. We are a proof of concept with a documented path to validation. The pilot is designed to generate the evidence that moves us from proof of concept to validated methodology.

---

## PART 9 — Readiness Dashboard

### Traffic-Light Assessment

| Dimension | Status | Summary |
|---|---|---|
| **Product** | 🟡 AMBER | Council engine operational; evidence corpus not verifiable; RAG not implemented |
| **Validation** | 🟡 AMBER | 10 cases completed; no independent validation; no peer review; no reproducibility data |
| **Governance** | 🔴 RED | Evidence Manifest retroactive curation in progress; corpus locking not yet automated; LLM limitation disclosed but not mitigated |
| **Regulatory** | 🔴 RED | Not GxP compliant; not 21 CFR Part 11 compliant; no FDA/EMA engagement |
| **Security** | 🔴 RED | No SOC 2 Type II; no penetration test report; no DPA template |
| **Commercial** | 🟡 AMBER | GTM strategy defined; sales deck in development; no signed pilots |

### Detailed Dashboard

#### Product — AMBER

**Green (ready):**
- Council engine runs and produces structured outputs
- 10-case library completed
- Institutional Proof Report generation automated
- Constitutional framework documented and versioned

**Amber (partially ready):**
- Evidence corpus verification: Tier 1 (prompt instruction) operational; Tier 2 (automated date-check) in development
- Model version locking: implemented for new cases; retroactive documentation in progress
- API: available for enterprise clients; not yet documented

**Red (not ready):**
- RAG execution model: not implemented
- Reproducibility testing: not completed
- Methodology publication: not completed

**Path to Green:** 8–12 weeks (Tier 2 architecture + methodology publication).

#### Validation — AMBER

**Green (ready):**
- 10 cases completed with documented verdicts
- One genuine failure (Verubecestat) documented honestly
- Performance metrics reported with statistical limitations disclosed

**Amber (partially ready):**
- Independent expert validation: experts identified; validation in progress
- Preprint: in preparation; submission planned within 16 weeks

**Red (not ready):**
- Reproducibility data: not available
- Peer-reviewed publication: not available
- Pre-specified out-of-sample validation: not yet executed

**Path to Green:** 12–16 weeks (independent validation + reproducibility data + preprint).

#### Governance — RED

**Green (ready):**
- Constitutional framework documented and versioned
- LLM training data limitation disclosed in all case reports
- Evidence Boundary Architecture designed and documented

**Amber (partially ready):**
- Evidence Manifests: torcetrapib retroactive manifest in progress; others pending
- Governance Audit Log: schema designed; implementation in progress

**Red (not ready):**
- Automated corpus locking: not implemented
- Automated date-check pipeline: not implemented
- Constitutional amendment freeze: proposed but not formally implemented

**Path to Green:** 3–4 weeks (Tier 1 retroactive manifests + disclosure); 8–12 weeks (Tier 2 automated controls).

#### Regulatory — RED

**Green (ready):**
- Regulatory limitations clearly documented
- No regulatory claims made

**Amber (partially ready):**
- Nothing currently amber

**Red (not ready):**
- GxP compliance: not implemented
- 21 CFR Part 11 compliance: not implemented
- FDA/EMA engagement: not initiated
- Regulatory position document: not completed

**Path to Green:** 18–24 months (GxP + 21 CFR Part 11 + FDA/EMA engagement).

#### Security — RED

**Green (ready):**
- Standard cloud infrastructure

**Amber (partially ready):**
- Nothing currently amber

**Red (not ready):**
- SOC 2 Type II: not initiated
- Penetration test: not completed
- DPA template: not completed
- ISQ response: not completed

**Path to Green:** 4–8 weeks (interim security package); 6–12 months (SOC 2 Type II).

#### Commercial — AMBER

**Green (ready):**
- GTM target database completed
- Revenue model completed
- Top 25 targets identified
- Pilot program design completed

**Amber (partially ready):**
- Sales deck: in development
- Demo script: in development
- Pilot agreement template: in development

**Red (not ready):**
- Signed pilots: none
- Reference customers: none
- Pricing validated with real buyer: not yet

**Path to Green:** 2–4 weeks (commercial assets); 3–6 months (first signed pilot).

---

## PART 10 — Required Actions Before Enterprise Deployment

### Before Enterprise Pilots (12–16 Weeks)

The following must be true before AgenThink proposes an enterprise pilot to a top-20 pharma company, CRO, or Big Four diligence team:

**1. LLM limitation disclosure in all case reports (Week 1–2)**
Every existing case report must include the standard LLM training data limitation disclosure. This is the minimum required before any external distribution of case reports.

**2. Evidence Manifests for all 10 completed cases (Weeks 3–8)**
Each case must have a completed Evidence Manifest with DOI-verified documents and an evidence boundary statement. The torcetrapib manifest must be independently verified by an external expert.

**3. Methodology published on GitHub (Week 3–4)**
The full methodology — exact prompts, model version, temperature, constitutional rules, persona definitions — must be publicly available. Without this, every claim is unverifiable.

**4. Independent expert validation of at least 3 cases (Weeks 4–12)**
At least 3 cases must be independently validated by external pharmaceutical experts using the DDIA scoring rubric. The torcetrapib case is the minimum. Semagacestat and sofosbuvir are the recommended second and third cases.

**5. Reproducibility data for at least 2 cases (Weeks 6–10)**
At least 2 cases must have reproducibility data (10 reruns each) with ≥80% verdict agreement. This is the minimum required to claim the methodology is reproducible.

**6. Penetration test report (Weeks 4–8)**
A penetration test report must be available before any proprietary client data is processed.

**7. Data processing agreement template (Weeks 2–4)**
A DPA template must be available before any client data is processed.

**8. Pilot agreement template (Weeks 2–4)**
A pilot agreement template (MSA-lite) must be available before any pilot discussions reach the contract stage.

**9. Pre-specified case selection criteria for Cases 11–50 (Weeks 3–6)**
The selection criteria for the next 40 cases must be published before any cases are executed. This is the minimum required to address the selection bias objection.

**10. Sales deck and demo script (Weeks 2–4)**
A board-quality sales deck and a 33-minute demo script (as designed in the Market Entry Plan) must be ready before any first meetings with Tier C targets (Roche, Pfizer, Novartis).

### Before Commercial Deployment (12–18 Months)

The following must be true before AgenThink charges enterprise prices ($500K–$2M ACV) and signs multi-year contracts:

**11. 20-case library with pre-specified cases**
At least 20 cases must be completed, with the final 10 selected using pre-specified criteria. The 20-case library is the minimum for descriptive statistics with narrower confidence intervals.

**12. Peer-reviewed methodology publication**
The methodology must be published in a peer-reviewed journal. Without this, the methodology cannot be cited in a diligence report or regulatory submission.

**13. Tier 2 architecture fully operational**
The automated date-check pipeline and corpus locking must be operational for all new cases. Retroactive manifests must be completed for all 10 existing cases.

**14. SOC 2 Type II certification**
SOC 2 Type II is required for enterprise procurement at top-20 pharma companies. Without it, the deal cannot close regardless of product quality.

**15. Master services agreement (MSA) reviewed by pharmaceutical legal counsel**
The MSA must be reviewed by legal counsel with pharmaceutical industry experience. The liability clauses, IP ownership, and data processing terms must be appropriate for a pharmaceutical enterprise client.

**16. Reference customer**
At least one completed pilot with a named reference customer who is willing to be cited. Without a reference customer, the sales cycle at top-20 pharma companies is 18–24 months minimum.

**17. Independent expert validation of 10 cases**
At least 10 cases must be independently validated. This is the minimum required for the validation claim to be credible to a sophisticated buyer.

**18. Reproducibility data for 5 cases**
Reproducibility data for 5 cases, published in the preprint or peer-reviewed paper.

### Before Regulatory Engagement (18–24 Months)

The following must be true before AgenThink initiates formal engagement with the FDA or EMA:

**19. Peer-reviewed publication**
Required before any regulatory engagement.

**20. 50-case library with pre-specified cases**
The minimum sample size for statistical significance claims. Required before any regulatory submission or formal regulatory engagement.

**21. GxP compliance assessment**
A formal GxP compliance assessment by a qualified GxP consultant. Required before any regulatory engagement.

**22. 21 CFR Part 11 compliance**
Required before the council output can be used in any regulated clinical trial activity.

**23. Prospective pilot results**
At least one prospective pilot (blinded current Phase II drugs) with documented results. Required before any regulatory claim about prospective performance.

**24. FDA/EMA pre-submission meeting**
A pre-submission meeting with the FDA (and separately the EMA) to discuss the regulatory pathway for the council as a governance tool. Required before any formal regulatory submission.

**25. Legal opinion on regulatory classification**
A legal opinion from regulatory counsel on whether the council constitutes a medical device, a software as a medical device (SaMD), or an advisory tool under FDA/EMA regulations. Required before any regulatory engagement.

---

## Closing Statement

This document has been written to be read by people who will test every claim. We have not softened the limitations. We have not inflated the metrics. We have not used marketing language.

The honest summary is this: AgenThink has built a proof of concept. The proof of concept demonstrates that a structured multi-persona council can identify material risk factors in historical pharmaceutical development decisions. The proof of concept has not been independently validated, peer-reviewed, or tested prospectively. The evidence boundary is documented but not fully verifiable with the current architecture.

The retrospective pilot is the correct first step because it allows a prospective client to evaluate the methodology on a case they know, with evidence they can verify, at a cost that is low relative to the value of the governance question being answered.

We are asking for a pilot discussion, not a commercial commitment. The pilot is designed to generate the evidence that answers the question this document cannot yet answer: *"Does this work on our drugs?"*

---

*AgenThink Pharma Institutional Proof Package v1.0 | June 2026*  
*Classification: Pre-Pilot Evidence Package — Confidential*  
*Not for distribution without AgenThink authorisation*
