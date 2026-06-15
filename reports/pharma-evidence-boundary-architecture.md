# Evidence Boundary Architecture
## AgenThink Mesh Pharma Validation Library
### Institutional-Grade Governance Framework for Retrospective Phase II → Phase III Validation
**Classification:** Governance Document — Internal & External Review  
**Version:** 1.0  
**Date:** June 2026  
**Prepared by:** AgenThink Mesh Governance Office  
**Review standard:** FDA 21 CFR Part 11 / ICH E6(R2) / ISO 9001:2015 / GxP Compliance

---

## EXECUTIVE VERDICT (Opinion First)

**Would this architecture satisfy a skeptical FDA reviewer who believes the Council may have known the answer?**

> **PARTIALLY — with a clear path to YES.**

The architecture described in this document, if fully implemented, would satisfy the FDA's reproducibility and audit trail requirements. It would satisfy the EMA's methodology transparency requirements. It would satisfy Big Four chain-of-custody requirements. It would not fully satisfy the FDA's requirement for verifiable LLM training data exclusion — because that problem cannot be solved by architecture alone. It requires a fundamental change to the council execution model: replacing LLM-native knowledge with a document-retrieval-only architecture (Retrieval-Augmented Generation with a verified, date-bounded corpus).

The minimum viable version described in Part 10 is implementable in 60–90 days. The enterprise version requires 6–12 months. The regulator-ready version requires 18–24 months and a formal FDA/EMA pre-submission meeting.

**The single most important action:** Build the Evidence Corpus before running any more cases. Every case run without a verified evidence corpus is a case that cannot be defended.

---

## TABLE OF CONTENTS

1. Part 1 — Evidence Boundary Framework
2. Part 2 — Time Cutoff Governance
3. Part 3 — Evidence Manifest System
4. Part 4 — Leakage Prevention Protocol
5. Part 5 — Blinded Case Methodology
6. Part 6 — Reproducibility Standard
7. Part 7 — Independent Review Protocol
8. Part 8 — Validation Library Admission Rules
9. Part 9 — Governance and Audit Layer
10. Part 10 — Gold Standard Architecture
11. Deliverable 1 — Full Architecture Summary
12. Deliverable 2 — Governance Framework
13. Deliverable 3 — Evidence Manifest Schema
14. Deliverable 4 — Leakage Prevention Matrix
15. Deliverable 5 — Independent Review Protocol
16. Deliverable 6 — Reproducibility Protocol
17. Deliverable 7 — Validation Admission Standard
18. Deliverable 8 — Gap Analysis of Current Approach
19. Deliverable 9 — Prioritised Implementation Roadmap
20. Deliverable 10 — Executive Verdict

---

## PART 1 — Evidence Boundary Framework

### The Fundamental Problem

The Evidence Boundary Framework exists to answer one question: **"How do we know the Council did not already know the outcome?"**

This question has two distinct components. The first is architectural: was the council's input restricted to pre-decision evidence? The second is epistemological: was the council's underlying model trained on post-decision information? The architecture can fully solve the first. It can partially mitigate the second. It cannot eliminate the second without replacing the LLM execution model entirely.

This framework addresses both components with different tools and different honesty about what each tool achieves.

### Evidence Admissibility Standard

#### Category A — Admissible Evidence (Pre-Decision Corpus)

All evidence in this category is admissible for council input, provided it was publicly available before the Evidence Cutoff Date (defined in Part 2).

| Evidence Type | Admissibility Condition | Verification Method |
|---|---|---|
| Phase I clinical trial results | Published or registered before cutoff | PubMed DOI + ClinicalTrials.gov NCT registration date |
| Phase II clinical trial results | Published or registered before cutoff | PubMed DOI + ClinicalTrials.gov NCT registration date |
| Investigator Brochure (IB) | Version dated before cutoff (if public) | FDA/EMA public disclosure or company press release with date |
| IND/CTA filing data | Only if publicly disclosed before cutoff | FDA public disclosure database; EMA clinical data portal |
| Preclinical data | Published before cutoff | PubMed DOI |
| Regulatory guidance documents | Issued before cutoff | FDA.gov / EMA.europa.eu with issue date |
| Published safety data | Published before cutoff | PubMed DOI; MedWatch if public |
| Competitive landscape | Published market analyses dated before cutoff | Source URL + publication date |
| Scientific literature | Published before cutoff | PubMed DOI; EMBASE; Cochrane |
| Conference abstracts | Presented before cutoff | Conference proceedings with date; PubMed abstract |
| ClinicalTrials.gov registry entries | Posted before cutoff | NCT registration date (verifiable) |
| FDA Advisory Committee transcripts | Published before cutoff | FDA.gov with meeting date |
| EMA Scientific Advice | Public disclosure before cutoff | EMA.europa.eu |
| Analyst reports | Published before cutoff | Source URL + publication date |
| Patent filings | Filed before cutoff | USPTO/EPO with filing date |

#### Category B — Prohibited Evidence (Post-Decision Corpus)

All evidence in this category is prohibited from council input. Inclusion of any Category B evidence constitutes an Evidence Boundary Violation (EBV) and requires case invalidation.

| Evidence Type | Prohibition Reason | Detection Method |
|---|---|---|
| Phase III trial results | Post-decision outcome | Publication date check |
| FDA approval/rejection decisions | Post-decision regulatory outcome | FDA.gov decision date |
| EMA approval/rejection decisions | Post-decision regulatory outcome | EMA.europa.eu decision date |
| MHRA decisions | Post-decision regulatory outcome | MHRA.gov.uk decision date |
| Post-decision press releases | Outcome disclosure | Company press release date |
| Market performance data | Revenue outcome | Financial report date |
| Post-decision analyst commentary | Outcome-informed analysis | Publication date check |
| Retrospective review articles | Outcome-informed synthesis | Publication date check |
| Post-decision safety updates | Outcome-informed safety data | Publication date check |
| DSMB interim analysis results | Outcome-informed safety data | Unless publicly disclosed before cutoff |
| Post-decision academic commentary | Outcome-informed analysis | Publication date check |
| Wikipedia articles | May contain post-decision information | Excluded entirely — not a primary source |
| News articles | May contain post-decision information | Date-checked; excluded if post-cutoff |
| LLM-generated summaries | May contain post-decision information | Excluded entirely — not a primary source |

#### Category C — Conditional Evidence (Requires Review)

Evidence in this category requires case-by-case review by the Evidence Curator before admission.

| Evidence Type | Condition for Admission | Review Required |
|---|---|---|
| Conference abstracts | Must be from conference held before cutoff | Evidence Curator review |
| Preprints (bioRxiv, medRxiv) | Must be posted before cutoff; note preprint status | Evidence Curator review |
| FDA correspondence | Only if publicly disclosed before cutoff | Evidence Curator review |
| Unpublished company data | Only if disclosed in public forum before cutoff | Evidence Curator review |
| Systematic reviews | Must be published before cutoff; check included studies | Evidence Curator review |
| Meta-analyses | Must be published before cutoff; check included studies | Evidence Curator review |

### The Formal Admissibility Standard

> **AgenThink Mesh Evidence Admissibility Standard v1.0**
>
> A document or data element is admissible as council input if and only if:
>
> (a) It is a primary source (peer-reviewed publication, regulatory document, clinical trial registry entry, or company press release); AND
>
> (b) It was publicly available before the Evidence Cutoff Date for the case; AND
>
> (c) It has been assigned a Document ID in the Evidence Manifest for the case; AND
>
> (d) Its retrieval date has been recorded; AND
>
> (e) It has been reviewed and approved by the Evidence Curator.
>
> Any document that fails conditions (a)–(e) is inadmissible. Inclusion of an inadmissible document constitutes an Evidence Boundary Violation requiring case review.

---

## PART 2 — Time Cutoff Governance

### Decision Date Definition

The **Decision Date** is the date on which the sponsor made the formal internal decision to advance the drug from Phase II to Phase III. This is the date that defines the evidence boundary.

**Establishing the Decision Date — Priority Order:**

1. **Board or executive committee minutes** (if publicly disclosed) — highest reliability
2. **Phase III IND/CTA filing date** — the IND/CTA cannot be filed without a prior advancement decision; filing date is a reliable upper bound
3. **Phase III ClinicalTrials.gov registration date** — NCT registration is required before first patient enrolment; registration date is a reliable upper bound
4. **First patient enrolled date** — lower bound; advancement decision preceded this
5. **Company press release announcing Phase III** — reliable if dated; may lag the internal decision by weeks
6. **Phase III protocol publication** — reliable if dated

**Decision Date Rule:** When multiple sources are available, the earliest verifiable date is used as the Decision Date. This is the most conservative approach — it minimises the risk of including post-decision evidence.

**Decision Date Uncertainty:** When the Decision Date cannot be established within a 90-day window, the case is flagged as **Decision Date Uncertain (DDU)**. DDU cases are admitted to the library with a disclosed uncertainty range and are excluded from sensitivity/specificity calculations until the date is resolved.

### Evidence Cutoff Date

The **Evidence Cutoff Date** is defined as: **Decision Date minus 30 days.**

The 30-day buffer accounts for:
- Publication lag between data availability and formal publication
- Internal review periods before public disclosure
- The realistic information environment of a decision-maker at the time

**Rationale for 30-day buffer:** A decision-maker advancing a drug to Phase III in January 2006 would not have had access to a paper published in December 2005 if it appeared online in late December. The 30-day buffer is conservative and defensible.

**Evidence Cutoff Date = Decision Date − 30 days**

### Publication Cutoff Rules

| Source Type | Cutoff Rule | Verification |
|---|---|---|
| Peer-reviewed journals | Online publication date (Epub ahead of print) | PubMed "Epub" date field |
| Conference abstracts | Abstract submission date OR conference date, whichever is earlier | Conference proceedings |
| ClinicalTrials.gov | Record posting date | NCT record "First Posted" field |
| Analyst reports | Report publication date | Source URL + date stamp |
| Company press releases | Press release date | Company website + PR Newswire |
| FDA documents | Document publication date | FDA.gov |
| EMA documents | Document publication date | EMA.europa.eu |
| Preprints | Preprint posting date | bioRxiv/medRxiv "Posted" date |
| Patents | Filing date (not grant date) | USPTO/EPO filing date |

### Governance Rules — Edge Cases

**Rule 2.1 — Embargo Violations:** If a paper was published after the Evidence Cutoff Date but was presented at a conference before the cutoff, the conference abstract (not the full paper) is admissible. The full paper is not admissible.

**Rule 2.2 — Retrospective Registrations:** ClinicalTrials.gov registrations that were posted after the trial started (retrospective registrations) are admissible only if the registration date is before the Evidence Cutoff Date. The registration date, not the trial start date, governs admissibility.

**Rule 2.3 — Rolling Publications:** For papers published in parts (e.g., interim analyses), each publication is evaluated independently. The first publication is admissible if before the cutoff; subsequent publications are evaluated by their own publication dates.

**Rule 2.4 — Corrected Publications:** If a paper was corrected after the Evidence Cutoff Date, the original version (as published before the cutoff) is admissible. The correction is not admissible.

**Rule 2.5 — Withdrawn Publications:** If a paper was withdrawn after the Evidence Cutoff Date, the original version is admissible if it was published before the cutoff. The withdrawal notice is not admissible.

**Rule 2.6 — Analyst Reports:** Analyst reports are admissible as Category A evidence only if they are from a named analyst at a named firm with a verifiable publication date. Anonymous or undated analyst commentary is inadmissible.

**Rule 2.7 — Wikipedia:** Wikipedia is never admissible as a primary source. It may be used to identify primary sources, which are then independently verified.

---

## PART 3 — Evidence Manifest System

### Evidence Manifest Purpose

The Evidence Manifest is the chain-of-custody document for each case. It records every document considered for council input, whether admitted or excluded, with the rationale for each decision. An independent reviewer must be able to reconstruct the council's evidence package from the manifest alone.

### Evidence Manifest Schema

#### Case-Level Fields

| Field | Type | Description | Required |
|---|---|---|---|
| `case_id` | String | Unique case identifier (format: ATM-PHARMA-[YEAR]-[SEQ]) | Yes |
| `drug_name` | String | Generic drug name | Yes |
| `brand_name` | String | Brand name (if approved) or "N/A" | Yes |
| `sponsor` | String | Sponsor company at time of decision | Yes |
| `indication` | String | Specific disease/condition | Yes |
| `therapeutic_area` | String | Therapeutic area (controlled vocabulary) | Yes |
| `decision_date` | Date | ISO 8601 format (YYYY-MM-DD) | Yes |
| `decision_date_source` | String | Source used to establish decision date | Yes |
| `decision_date_confidence` | Enum | HIGH / MEDIUM / LOW / DDU | Yes |
| `evidence_cutoff_date` | Date | Decision Date − 30 days (ISO 8601) | Yes |
| `manifest_version` | String | Semantic version (e.g., "1.0.0") | Yes |
| `manifest_created_date` | Date | ISO 8601 | Yes |
| `manifest_created_by` | String | Evidence Curator name and role | Yes |
| `manifest_reviewed_by` | String | Independent reviewer name and role | Yes |
| `manifest_approved_date` | Date | ISO 8601 | Yes |
| `constitution_version` | String | Pharma Constitution version used | Yes |
| `council_run_date` | Date | ISO 8601 | Yes |
| `council_session_id` | String | Unique session identifier | Yes |
| `total_documents_considered` | Integer | Total documents reviewed for admission | Yes |
| `total_documents_admitted` | Integer | Documents admitted to evidence corpus | Yes |
| `total_documents_excluded` | Integer | Documents excluded with rationale | Yes |
| `evidence_boundary_violations` | Integer | Count of EBVs detected and resolved | Yes |
| `case_status` | Enum | ACTIVE / SUSPENDED / INVALIDATED | Yes |

#### Document-Level Fields (per admitted document)

| Field | Type | Description | Required |
|---|---|---|---|
| `doc_id` | String | Unique document identifier (format: DOC-[CASE_ID]-[SEQ]) | Yes |
| `doc_type` | Enum | JOURNAL_ARTICLE / CONFERENCE_ABSTRACT / REGULATORY_DOCUMENT / CLINICAL_TRIAL_REGISTRY / PRESS_RELEASE / ANALYST_REPORT / PATENT / OTHER | Yes |
| `title` | String | Full document title | Yes |
| `authors` | String | Author list (last name, first initial) | Yes |
| `publication_name` | String | Journal, conference, or source name | Yes |
| `publication_date` | Date | ISO 8601 (online publication date for journals) | Yes |
| `doi_or_url` | String | DOI (preferred) or URL | Yes |
| `retrieval_date` | Date | Date document was retrieved by Evidence Curator | Yes |
| `admissibility_category` | Enum | A / B / C | Yes |
| `admission_decision` | Enum | ADMITTED / EXCLUDED | Yes |
| `exclusion_reason` | String | Required if EXCLUDED; must reference specific rule | Conditional |
| `evidence_type` | String | What the document provides (e.g., "Phase II efficacy data") | Yes |
| `key_data_points` | String | Specific data points extracted for council input | Yes |
| `leakage_risk_flag` | Boolean | True if document required leakage review | Yes |
| `leakage_review_notes` | String | Required if leakage_risk_flag is True | Conditional |
| `curator_notes` | String | Any additional notes from Evidence Curator | No |

#### Exclusion Log Fields (per excluded document)

| Field | Type | Description | Required |
|---|---|---|---|
| `doc_id` | String | Unique document identifier | Yes |
| `title` | String | Full document title | Yes |
| `publication_date` | Date | ISO 8601 | Yes |
| `doi_or_url` | String | DOI or URL | Yes |
| `exclusion_category` | Enum | POST_CUTOFF / OUTCOME_CONTAMINATION / NOT_PRIMARY_SOURCE / INSUFFICIENT_DATE_VERIFICATION / OTHER | Yes |
| `exclusion_rule` | String | Specific admissibility rule violated | Yes |
| `curator_decision` | String | Evidence Curator's decision rationale | Yes |

### Sample Evidence Manifest Entry — Torcetrapib Case

```json
{
  "case_id": "ATM-PHARMA-2006-001",
  "drug_name": "torcetrapib",
  "brand_name": "N/A (never approved)",
  "sponsor": "Pfizer Inc.",
  "indication": "Dyslipidaemia / cardiovascular risk reduction",
  "therapeutic_area": "Cardiovascular",
  "decision_date": "2004-10-01",
  "decision_date_source": "Phase III ClinicalTrials.gov registration NCT00134264 (posted 2004-08-23); Pfizer press release October 2004",
  "decision_date_confidence": "MEDIUM",
  "evidence_cutoff_date": "2004-09-01",
  "manifest_version": "1.0.0",
  "manifest_created_date": "2026-06-14",
  "manifest_created_by": "Evidence Curator — AgenThink Mesh",
  "manifest_reviewed_by": "Independent Pharmaceutical Expert — [Name]",
  "manifest_approved_date": "2026-06-14",
  "constitution_version": "Pharma Constitution V1.0",
  "council_run_date": "2026-06-11",
  "council_session_id": "PHARMA-RETRO-TORCETRAPIB-1781180831427",
  "total_documents_considered": 12,
  "total_documents_admitted": 8,
  "total_documents_excluded": 4,
  "evidence_boundary_violations": 0,
  "case_status": "ACTIVE",
  "admitted_documents": [
    {
      "doc_id": "DOC-ATM-2006-001-001",
      "doc_type": "JOURNAL_ARTICLE",
      "title": "Effects of torcetrapib on HDL cholesterol and atherosclerosis",
      "authors": "Brousseau ME, Schaefer EJ, Wolfe ML, et al.",
      "publication_name": "New England Journal of Medicine",
      "publication_date": "2004-06-03",
      "doi_or_url": "10.1056/NEJMoa031766",
      "retrieval_date": "2026-06-10",
      "admissibility_category": "A",
      "admission_decision": "ADMITTED",
      "evidence_type": "Phase II efficacy data — HDL-C increase, LDL-C reduction",
      "key_data_points": "HDL-C increase 46-106% dose-dependent; LDL-C reduction 17%; blood pressure increase +2.1 mmHg systolic in highest dose group",
      "leakage_risk_flag": false
    },
    {
      "doc_id": "DOC-ATM-2006-001-002",
      "doc_type": "JOURNAL_ARTICLE",
      "title": "CETP inhibition: from bench to bedside",
      "authors": "Tall AR, Yvan-Charvet L, Wang N",
      "publication_name": "Arteriosclerosis, Thrombosis, and Vascular Biology",
      "publication_date": "2007-02-01",
      "doi_or_url": "10.1161/01.ATV.0000261081.02375.d0",
      "retrieval_date": "2026-06-10",
      "admissibility_category": "B",
      "admission_decision": "EXCLUDED",
      "exclusion_category": "POST_CUTOFF",
      "exclusion_rule": "Rule 1.1 — Published after Evidence Cutoff Date (2004-09-01)",
      "curator_decision": "Published February 2007, 28 months after evidence cutoff. Excluded."
    }
  ]
}
```

---

## PART 4 — Leakage Prevention Protocol

### Leakage Pathway Classification

Evidence leakage occurs when information about the Phase III outcome influences the council's deliberation, either directly (explicit outcome reference) or indirectly (outcome-informed framing). The following matrix identifies all known leakage pathways, ranked by severity.

### Leakage Prevention Matrix

| Rank | Pathway | Severity | Detection Method | Mitigation Strategy |
|---|---|---|---|---|
| 1 | **LLM latent knowledge** | CRITICAL | Undetectable by architecture alone | RAG-only execution model; disclosed limitation |
| 2 | **Training-data contamination** | CRITICAL | Undetectable | Model version locking; disclosed limitation |
| 3 | **Direct outcome reference in evidence corpus** | CRITICAL | Automated date-check + manual review | Evidence Manifest + Evidence Curator review |
| 4 | **Retrospective review articles** | HIGH | Publication date check | Category B exclusion; date-check automation |
| 5 | **Summary articles citing Phase III results** | HIGH | Content review for outcome references | Evidence Curator content review |
| 6 | **Wikipedia and encyclopaedic sources** | HIGH | Source type check | Category B exclusion; blanket prohibition |
| 7 | **Analyst reports citing Phase III** | HIGH | Content review | Date-check + content review |
| 8 | **Indirect outcome references** | HIGH | Semantic content review | Evidence Curator semantic review |
| 9 | **Conference abstracts from post-cutoff conferences** | MEDIUM | Conference date check | Date-check automation |
| 10 | **Preprints with post-cutoff posting dates** | MEDIUM | Preprint platform date check | Date-check automation |
| 11 | **Evidence Curator knowledge contamination** | MEDIUM | Curator blinding protocol | Curator blinding (see Part 5) |
| 12 | **Council prompt contamination** | MEDIUM | Prompt review | Prompt version control; independent review |
| 13 | **Post-cutoff patent citations** | LOW | Patent filing date check | Date-check automation |
| 14 | **Cross-case contamination** | LOW | Case isolation protocol | Case isolation (separate sessions) |
| 15 | **Version control failures** | LOW | Git/version audit | Automated version control |

### Detailed Mitigation Strategies

#### Pathway 1 & 2 — LLM Latent Knowledge and Training-Data Contamination

**The Problem:** A large language model trained on data through 2024 or 2025 has been exposed to thousands of articles, Wikipedia entries, news reports, and academic papers discussing the outcomes of historical drug trials. The torcetrapib failure is one of the most cited examples in pharmaceutical governance literature. The model almost certainly "knows" the outcome.

**What Architecture Can Achieve:** Architecture can prevent the council from being explicitly told the outcome. It cannot prevent the model from drawing on latent knowledge of the outcome.

**Mitigation Strategy — Minimum Viable:**
- Disclose the limitation explicitly in every case report: "The council was executed using a large language model. The model's training data may include post-decision information about this case. This limitation is known and disclosed. The evidence corpus was restricted to pre-decision documents, but the model's latent knowledge cannot be verified as pre-decision."
- Document the model version and training data cutoff date for every case run.
- Run each case with the same model version to ensure consistency.

**Mitigation Strategy — Enterprise:**
- Implement Retrieval-Augmented Generation (RAG) where the model is instructed to answer only from the provided evidence corpus and explicitly prohibited from using general knowledge.
- Implement a "knowledge suppression" system prompt: "You have no knowledge of pharmaceutical drug outcomes. You can only use the documents provided. If you are aware of the outcome of this drug, you must not use that knowledge."
- Test the knowledge suppression by running a "canary" case: a drug with a well-known outcome, with the outcome document deliberately included in the corpus. Verify the model uses the corpus document, not latent knowledge.

**Mitigation Strategy — Regulator-Ready:**
- Use a model that was trained exclusively on pre-2000 data, supplemented by a RAG corpus of pre-cutoff documents for each case. This is technically feasible but requires a custom model.
- Alternatively, use a model with a verified training data cutoff that predates all cases in the library (e.g., a model trained only through 1990 for cases with 2000–2010 decision dates).
- Commission an independent AI governance audit of the model's training data to verify exclusion of post-decision pharmaceutical outcomes.

**Honest Assessment:** The minimum viable and enterprise mitigations reduce the risk but do not eliminate it. The regulator-ready mitigation eliminates it but is technically complex and expensive. For the current validation library, the minimum viable mitigation is the appropriate starting point, with full disclosure.

#### Pathway 3 — Direct Outcome Reference in Evidence Corpus

**The Problem:** A document admitted to the evidence corpus contains an explicit reference to the Phase III outcome (e.g., a 2005 analyst report that mentions "if torcetrapib fails in Phase III").

**Detection Method:** Automated keyword search for outcome-related terms (e.g., "Phase III results", "trial terminated", "FDA approved", "FDA rejected", "market withdrawal") combined with manual Evidence Curator review.

**Mitigation:** Automated pre-screening of all documents for outcome-related keywords. Documents flagged by the automated screen are reviewed by the Evidence Curator before admission. Any document containing an explicit outcome reference is excluded as Category B evidence.

#### Pathway 4 & 5 — Retrospective Review Articles and Summary Articles

**The Problem:** A review article published after the Evidence Cutoff Date summarises the Phase II data in the context of the Phase III outcome. Even if the review article is excluded from the corpus, the Evidence Curator may have read it and been influenced by its framing.

**Detection Method:** Publication date check (automated). Content review for outcome-informed framing (manual).

**Mitigation:** Automated exclusion of all documents published after the Evidence Cutoff Date. Evidence Curator blinding protocol (see Part 5).

#### Pathway 8 — Indirect Outcome References

**The Problem:** A document admitted to the corpus does not explicitly mention the Phase III outcome but frames the Phase II data in a way that implies knowledge of the outcome. Example: "The blood pressure increase observed in Phase II was later confirmed to be a mechanism-based effect" — this sentence implies knowledge of the post-Phase III confirmation.

**Detection Method:** Semantic content review by Evidence Curator. Automated keyword search for temporal markers ("later", "subsequently", "was confirmed", "proved to be").

**Mitigation:** Evidence Curator semantic review of all admitted documents. Automated flagging of temporal markers for manual review.

#### Pathway 11 — Evidence Curator Knowledge Contamination

**The Problem:** The Evidence Curator knows the outcome of the case and unconsciously selects documents that support the correct verdict, or frames the evidence summary in outcome-informed language.

**Detection Method:** Curator blinding protocol (see Part 5). Independent review of evidence summary by a blinded reviewer.

**Mitigation:** The Evidence Curator is blinded to the Phase III outcome before completing the evidence manifest. The outcome is revealed only after the council run is complete and the manifest is locked.

---

## PART 5 — Blinded Case Methodology

### Blinding Protocol

The blinded case methodology ensures that the council's deliberation is conducted without knowledge of the Phase III outcome, and that the evidence package cannot be altered after the council run.

### Workflow

```
PHASE 1 — CASE SELECTION
├── Case Selector identifies candidate case
├── Case Selector records: Drug, Sponsor, Indication, Approximate Decision Year
└── Case Selector does NOT record Phase III outcome at this stage

PHASE 2 — EVIDENCE CURATION (BLINDED)
├── Evidence Curator receives: Drug, Sponsor, Indication, Decision Year
├── Evidence Curator does NOT receive: Phase III outcome
├── Evidence Curator builds Evidence Corpus:
│   ├── Searches PubMed, ClinicalTrials.gov, FDA.gov, EMA.europa.eu
│   ├── Applies Evidence Cutoff Date (Decision Date − 30 days)
│   ├── Assigns Document IDs
│   ├── Completes Evidence Manifest
│   └── Signs Evidence Manifest (digital signature)
├── Evidence Corpus is LOCKED (hash recorded)
└── Evidence Curator is BLINDED to Phase III outcome throughout

PHASE 3 — COUNCIL EXECUTION
├── Council receives ONLY the Evidence Corpus (no additional context)
├── Council session ID is generated and recorded
├── Council deliberation is executed
├── Council output is recorded (votes, rationales, verdict)
├── Council output is LOCKED (hash recorded)
└── Council output is NOT reviewed before Phase 4

PHASE 4 — OUTCOME REVELATION
├── Phase III outcome is retrieved from public sources
├── Outcome is recorded in Retrospective Outcome Record
├── Outcome is compared to Council verdict
└── Comparison result is recorded

PHASE 5 — VALIDATION SCORING
├── Independent Reviewer receives: Evidence Corpus, Council Output, Outcome
├── Independent Reviewer scores: Verdict Alignment, OVS, DDIA
├── Independent Reviewer signs Validation Scorecard
└── Validation Scorecard is LOCKED

PHASE 6 — AUDIT TRAIL GENERATION
├── All records are compiled into Case Audit Package
├── Case Audit Package includes:
│   ├── Evidence Manifest (signed, locked)
│   ├── Council Output (signed, locked)
│   ├── Retrospective Outcome Record
│   ├── Validation Scorecard (signed, locked)
│   └── Hash verification for all locked records
└── Case Audit Package is archived
```

### Governance Checkpoints

| Checkpoint | Trigger | Required Action | Responsible Party |
|---|---|---|---|
| CP-1 | Evidence Corpus completed | Evidence Curator signs manifest | Evidence Curator |
| CP-2 | Evidence Corpus locked | Hash recorded; no further changes permitted | System |
| CP-3 | Council execution complete | Council output locked | System |
| CP-4 | Outcome revealed | Outcome recorded; comparison completed | Validation Director |
| CP-5 | Validation scoring complete | Independent Reviewer signs scorecard | Independent Reviewer |
| CP-6 | Case Audit Package complete | Archived; hash verified | Governance Office |

### Immutability Controls

**Evidence Corpus Lock:** The evidence corpus is locked (SHA-256 hash recorded) before the council is executed. Any subsequent modification to the corpus invalidates the case.

**Council Output Lock:** The council output is locked (SHA-256 hash recorded) immediately after execution. Any subsequent modification to the output invalidates the case.

**Manifest Lock:** The evidence manifest is locked after Evidence Curator sign-off. Any subsequent modification requires a new manifest version and a new council run.

**Audit Trail:** All lock events are recorded in the Governance Audit Log with timestamp, user ID, and hash value.

---

## PART 6 — Reproducibility Standard

### The Reproducibility Problem

An independent party must be able to:
1. Access the same evidence package
2. Rerun the council with the same configuration
3. Compare outputs
4. Reach the same conclusion about verdict alignment

This requires full publication of the methodology, the evidence corpus, the constitutional rules, the persona definitions, and the exact system configuration.

### Step-by-Step Reproducibility Framework

#### Step 1 — Access the Evidence Package

The Evidence Package for each case is published in a public repository (GitHub or equivalent) containing:
- Evidence Manifest (JSON, signed)
- All admitted documents (PDF or DOI links)
- Evidence Corpus Summary (structured text)
- Exclusion Log (JSON)
- Hash values for all locked records

**Access requirement:** Any party with internet access can download the Evidence Package. No proprietary access required.

#### Step 2 — Verify the Evidence Boundary

The independent party verifies:
- Decision Date (check against published sources)
- Evidence Cutoff Date (Decision Date − 30 days)
- All admitted documents have publication dates before the Evidence Cutoff Date
- All excluded documents have correct exclusion rationales

**Verification tool:** Automated date-check script (Python, open source, published in repository).

#### Step 3 — Access the Methodology

The Methodology Document is published and includes:
- Pharma Constitution version used (full text)
- Persona definitions (full text)
- Decision Brief template (full text)
- System prompt (full text)
- Model name and version
- Temperature and other generation parameters
- Council execution protocol

**Access requirement:** Public repository.

#### Step 4 — Rerun the Council

The independent party executes the council using:
- The published Evidence Corpus Summary as input
- The published Methodology Document as configuration
- The same model version (or a documented alternative if the original is unavailable)

**Expected output:** The independent party's council output will not be identical to the original (LLM outputs are non-deterministic) but should produce the same verdict in ≥80% of reruns. This is the **Reproducibility Threshold**.

**Reproducibility Threshold:** A case is considered reproducible if an independent party running the council with the published methodology produces the same verdict (GO / WAIT / NO-GO) in ≥80% of 10 independent reruns.

#### Step 5 — Compare Outputs

The independent party compares:
- Verdict (GO / WAIT / NO-GO)
- Primary blockers identified
- Constitutional rules triggered
- Confidence levels

**Comparison metric:** Verdict agreement rate across 10 reruns. Primary blocker overlap (Jaccard similarity).

#### Step 6 — Report Reproducibility Finding

The independent party publishes:
- Verdict agreement rate
- Primary blocker overlap
- Any systematic differences between original and reproduced outputs
- Conclusion: REPRODUCIBLE / PARTIALLY REPRODUCIBLE / NOT REPRODUCIBLE

**Reproducibility thresholds:**
- REPRODUCIBLE: ≥80% verdict agreement across 10 reruns
- PARTIALLY REPRODUCIBLE: 60–79% verdict agreement
- NOT REPRODUCIBLE: <60% verdict agreement

---

## PART 7 — Independent Review Protocol

### FDA Reviewer

**Profile:** Former FDA reviewer with experience in pharmaceutical governance and clinical trial methodology. Focused on GxP compliance, audit trail integrity, and evidence quality.

**Primary Objections:**
1. "The evidence boundary is a prompt instruction, not a verifiable constraint."
2. "The LLM training data may include post-decision information."
3. "The audit trail is not 21 CFR Part 11 compliant."
4. "The methodology is not reproducible."

**Required Evidence:**
- Full Evidence Manifest for each case (signed, locked, with hash values)
- Published methodology document (model version, temperature, system prompt)
- Reproducibility data (inter-run consistency across 10 reruns)
- Disclosure of LLM training data limitation
- 21 CFR Part 11 compliance assessment

**Acceptance Threshold:** The FDA will not formally accept or endorse this methodology for regulatory use without a prospective validation study. For informal review, the FDA will accept the methodology as "exploratory" if the evidence boundary limitation is fully disclosed and the audit trail is complete.

**Recommended Documentation:**
- Evidence Boundary Architecture document (this document)
- Case Audit Packages for all completed cases
- Reproducibility study report
- LLM training data limitation disclosure

### EMA Reviewer

**Profile:** Former EMA reviewer with experience in scientific advice and methodology review. Focused on transparency, reproducibility, and methodology documentation.

**Primary Objections:**
1. "The methodology is not published in a peer-reviewed journal."
2. "The reproducibility has not been demonstrated."
3. "The constitutional rules have not been validated against a pre-specified case set."

**Required Evidence:**
- Published methodology paper (or preprint)
- Reproducibility data
- Pre-specified case selection criteria
- Constitutional rule validation data

**Acceptance Threshold:** The EMA will accept the methodology for informal review if it is published (preprint acceptable) and reproducibility data is provided. Formal acceptance requires peer-reviewed publication.

**Recommended Documentation:**
- Methodology preprint (bioRxiv or SSRN)
- Reproducibility study report
- Pre-specified case selection criteria document

### Top-20 Pharmaceutical Company

**Profile:** Head of R&D or Chief Medical Officer. Focused on practical value-add over existing processes.

**Primary Objections:**
1. "What does this catch that our internal teams miss?"
2. "Show me a prospective example."
3. "What is the liability if your council is wrong?"

**Required Evidence:**
- Torcetrapib case study (the clearest value-add example)
- Prospective pilot proposal
- Liability framework

**Acceptance Threshold:** The pharma company will engage in a pilot discussion if presented with the torcetrapib case and a clear prospective pilot design. They will not pay for a service based solely on retrospective validation.

**Recommended Documentation:**
- Torcetrapib Institutional Proof Report
- Prospective pilot proposal (blinded, 5 current Phase II drugs)
- Liability and confidentiality framework

### CRO (IQVIA, ICON, Covance)

**Profile:** Head of Regulatory Affairs or Scientific Advisory. Focused on integration with existing trial management processes.

**Primary Objections:**
1. "How does this integrate with our existing governance processes?"
2. "Who is responsible for the council output?"
3. "Is this compatible with ICH E6(R2) GCP requirements?"

**Required Evidence:**
- Integration protocol with existing Phase II review processes
- Responsibility matrix (who owns the council output)
- ICH E6(R2) compatibility assessment

**Acceptance Threshold:** The CRO will engage if the methodology can be positioned as a supplementary governance layer, not a replacement for existing processes.

**Recommended Documentation:**
- Integration protocol
- Responsibility matrix
- ICH E6(R2) compatibility assessment

### Big Four Advisory Team

**Profile:** Life sciences diligence partner. Focused on methodology defensibility in an IC memo.

**Primary Objections:**
1. "Can I cite this in a diligence report?"
2. "Is the methodology independently verifiable?"
3. "What are the disclosed limitations?"

**Required Evidence:**
- Published methodology (peer-reviewed or preprint)
- Full disclosure of limitations
- Independent expert validation of at least one case

**Acceptance Threshold:** The Big Four will cite the methodology in a diligence report if it is published, limitations are fully disclosed, and at least one case has been independently validated.

**Recommended Documentation:**
- Published methodology paper
- Limitations disclosure document
- Independent expert validation report (torcetrapib)

---

## PART 8 — Validation Library Admission Rules

### Admission Criteria

A historical case may be admitted to the Validation Library if and only if it satisfies all of the following criteria:

#### Criterion 1 — Minimum Evidence Availability

The case must have at least **three** Category A documents available in the public domain, covering:
- Phase II efficacy data (at least one published trial result)
- Phase II safety data (at least one safety report or adverse event summary)
- Regulatory context (at least one regulatory guidance document or advisory committee transcript)

**Minimum Evidence Score:** 3 Category A documents. Cases with fewer than 3 documents are classified as **Evidence-Insufficient (EI)** and excluded.

#### Criterion 2 — Minimum Documentation Quality

All admitted documents must be:
- Primary sources (peer-reviewed publications, regulatory documents, clinical trial registry entries)
- Publicly accessible (DOI or URL verifiable)
- Date-verified (publication date confirmed independently)

**Documentation Quality Score:** 100% of admitted documents must satisfy all three quality criteria.

#### Criterion 3 — Known Outcome

The Phase III outcome must be publicly documented and unambiguous. Cases where the Phase III outcome is disputed or unknown are excluded.

**Known Outcome Types:** Successful approval / Failed Phase III / Withdrawn / Regulatory Controversy (with documented basis) / Terminated for futility / Terminated for safety

#### Criterion 4 — Decision Traceability

The Phase II → Phase III advancement decision must be traceable to a verifiable source (press release, ClinicalTrials.gov registration, IND filing date, or equivalent). Cases where the decision date cannot be established within a 180-day window are classified as **Decision Date Uncertain (DDU)** and excluded until the date is resolved.

#### Criterion 5 — Therapeutic Area Coverage

The case must be in one of the pre-specified therapeutic areas for the current library expansion. Cases outside the pre-specified areas are deferred to future library expansions.

#### Criterion 6 — No Active Litigation

Cases where the Phase III outcome or regulatory decision is the subject of active litigation are excluded until the litigation is resolved.

### Exclusion Criteria

A case is excluded from the Validation Library if any of the following apply:

| Exclusion Criterion | Rationale |
|---|---|
| Fewer than 3 Category A documents | Insufficient evidence for meaningful council deliberation |
| Decision date cannot be established within 180 days | Evidence boundary cannot be reliably defined |
| Phase III outcome is disputed or unknown | Verdict alignment cannot be assessed |
| Active litigation involving the Phase III outcome | Legal risk; outcome may change |
| Case involves a drug currently in active development | Outcome contamination risk; prospective, not retrospective |
| Evidence Boundary Violation detected and not resolved | Case integrity compromised |
| Case was selected after Phase III outcome was known to the case selector | Selection bias; excluded unless pre-specification criteria are documented |

### Conditional Admission

Cases that satisfy Criteria 1–4 but have one or more of the following characteristics are admitted with a **Conditional Admission Flag (CAF)**:

| Condition | CAF Code | Disclosure Required |
|---|---|---|
| Decision date confidence is MEDIUM or LOW | CAF-01 | Disclose uncertainty range |
| Fewer than 5 Category A documents | CAF-02 | Disclose evidence limitation |
| Phase III outcome is Regulatory Controversy | CAF-03 | Disclose outcome ambiguity |
| Case involves accelerated approval pathway | CAF-04 | Disclose pathway-specific considerations |
| Case involves ultra-rare disease (n<100 in pivotal) | CAF-05 | Disclose evidence threshold limitations |

---

## PART 9 — Governance and Audit Layer

### Governance Structure

The Validation Library governance structure consists of four roles:

| Role | Responsibilities | Independence Requirement |
|---|---|---|
| **Validation Director** | Overall library governance; case selection; final approval | Must not be involved in council execution |
| **Evidence Curator** | Evidence corpus construction; manifest completion; blinding protocol | Must be blinded to Phase III outcome during curation |
| **Council Operator** | Council execution; session management; output locking | Must not be involved in evidence curation |
| **Independent Reviewer** | Validation scoring; DDIA assessment; reproducibility testing | Must be external to AgenThink Mesh |

### Audit Log Schema

Every action in the Validation Library is recorded in the Governance Audit Log.

| Field | Type | Description |
|---|---|---|
| `log_id` | String | Unique log entry identifier |
| `timestamp` | DateTime | ISO 8601 with timezone |
| `actor_id` | String | User or system ID |
| `actor_role` | Enum | VALIDATION_DIRECTOR / EVIDENCE_CURATOR / COUNCIL_OPERATOR / INDEPENDENT_REVIEWER / SYSTEM |
| `action_type` | Enum | CASE_CREATED / DOCUMENT_ADMITTED / DOCUMENT_EXCLUDED / CORPUS_LOCKED / COUNCIL_EXECUTED / OUTPUT_LOCKED / OUTCOME_RECORDED / SCORE_RECORDED / AMENDMENT_PROPOSED / AMENDMENT_RATIFIED / EBV_DETECTED / EBV_RESOLVED |
| `case_id` | String | Associated case ID |
| `doc_id` | String | Associated document ID (if applicable) |
| `action_detail` | String | Free-text description of action |
| `hash_before` | String | SHA-256 hash of affected record before action |
| `hash_after` | String | SHA-256 hash of affected record after action |
| `signature` | String | Digital signature of actor |

### Chain of Custody

The chain of custody for each case follows this sequence:

```
Case Created → Evidence Corpus Built → Corpus Locked → Council Executed → 
Output Locked → Outcome Revealed → Validation Scored → Audit Package Compiled → 
Audit Package Archived
```

Each step is recorded in the Governance Audit Log with timestamp, actor, and hash values. The chain is unbroken if every step has a corresponding log entry with valid hash values.

### Version Control

**Constitutional Version Tracking:**
- Each version of the Pharma Constitution is stored in a version-controlled repository (Git)
- Each case is tagged with the constitutional version used
- Amendments are tracked with: amendment ID, rationale, cases affected, ratification date, ratifying authority

**Evidence Package Versioning:**
- Each Evidence Manifest has a semantic version (major.minor.patch)
- Major version: new documents admitted or excluded
- Minor version: metadata corrections
- Patch version: formatting corrections
- Version history is preserved; no version is deleted

**Council Output Versioning:**
- Each council output is immutable after locking
- If a case requires re-execution (e.g., after an Evidence Boundary Violation is resolved), a new council session is created with a new session ID
- The original output is preserved; the new output is tagged as a revision

### Amendment Tracking

| Field | Description |
|---|---|
| `amendment_id` | Unique identifier (format: PC-[VERSION]-[SEQ]) |
| `proposed_by` | Proposing party |
| `proposed_date` | ISO 8601 |
| `trigger_case` | Case ID that triggered the amendment |
| `rule_text` | Full text of proposed rule |
| `rationale` | Detailed rationale |
| `cases_affected` | List of case IDs where rule would have applied |
| `validation_cases` | List of case IDs used to validate the amendment |
| `validation_result` | VALIDATED / NOT_VALIDATED / PENDING |
| `ratification_date` | ISO 8601 (if ratified) |
| `ratifying_authority` | Name and role |
| `status` | PROPOSED / VALIDATED / RATIFIED / REJECTED |

---

## PART 10 — Gold Standard Architecture

### Three Architecture Tiers

#### Tier 1 — Minimum Viable Architecture (60–90 days)

**What it achieves:** Defensible evidence boundary with disclosed limitations. Sufficient for internal demonstration and early pilot discussions.

**Components:**
- Evidence Manifest System (manual, structured JSON)
- Evidence Cutoff Date governance (Decision Date − 30 days)
- Blinded Case Methodology (curator blinding; corpus locking)
- Governance Audit Log (manual entry)
- Published methodology document (model version, temperature, prompts)
- LLM training data limitation disclosure

**What it does not achieve:**
- Verifiable LLM knowledge exclusion
- Automated date-check and leakage detection
- Reproducibility testing
- Independent expert validation

**Cost estimate:** 2–3 FTE for 60–90 days. No new technology required.

**Reviewer verdict:** PARTIALLY ACCEPTABLE to FDA/EMA. Acceptable for internal demonstration. Not sufficient for enterprise pilots without additional disclosures.

#### Tier 2 — Enterprise Architecture (6–12 months)

**What it achieves:** Verifiable evidence boundary with automated controls. Sufficient for enterprise pilots and peer-review submission.

**Components (all Tier 1 components, plus):**
- Automated date-check pipeline (Python; PubMed API; ClinicalTrials.gov API)
- Automated leakage detection (keyword search; temporal marker flagging)
- Retrieval-Augmented Generation (RAG) execution model
- Knowledge suppression system prompt with canary testing
- Reproducibility testing protocol (10 reruns per case)
- Independent expert validation (3 external reviewers per case)
- Public evidence corpus repository (GitHub)
- 21 CFR Part 11 compliant audit log (electronic signatures; timestamp authority)

**What it does not achieve:**
- Fully verifiable LLM knowledge exclusion (RAG reduces but does not eliminate latent knowledge risk)
- Regulatory submission use
- Prospective validation track record

**Cost estimate:** 5–8 FTE for 6–12 months. Technology investment: $200K–$500K (RAG infrastructure, audit log system, repository).

**Reviewer verdict:** ACCEPTABLE to FDA/EMA for informal review. Sufficient for enterprise pilot discussions. Peer-review eligible.

#### Tier 3 — Regulator-Ready Architecture (18–24 months)

**What it achieves:** Fully verifiable evidence boundary. Sufficient for regulatory submission consideration and peer-reviewed publication.

**Components (all Tier 2 components, plus):**
- Custom model with verified training data cutoff (pre-dates all library cases)
- OR: Model with verified pharmaceutical outcome exclusion from training data
- Formal FDA/EMA pre-submission meeting
- Prospective validation pilot (blinded, 5–10 current Phase II drugs)
- Peer-reviewed methodology paper (published)
- Independent AI governance audit (third-party)
- Liability framework (legal opinion on advisory liability)
- GxP-compliant quality management system

**What it does not achieve:**
- Regulatory approval for clinical decision-making use (requires prospective validation at scale)

**Cost estimate:** 10–15 FTE for 18–24 months. Technology investment: $1M–$3M (custom model or model audit, QMS, prospective pilot infrastructure).

**Reviewer verdict:** ACCEPTABLE to FDA/EMA for formal review. Sufficient for peer-reviewed publication. Sufficient for enterprise deployment with disclosed limitations.

### Architecture Comparison

| Dimension | Tier 1 (MVP) | Tier 2 (Enterprise) | Tier 3 (Regulator-Ready) |
|---|---|---|---|
| Evidence boundary verifiability | Partial (manual) | High (automated) | Full (verified model) |
| LLM knowledge exclusion | Disclosed limitation | Partially mitigated (RAG) | Fully mitigated (custom model) |
| Audit trail completeness | Manual | 21 CFR Part 11 compliant | GxP compliant |
| Reproducibility | Not tested | Tested (10 reruns) | Tested + published |
| Independent validation | None | 3 experts per case | Peer-reviewed |
| FDA/EMA acceptance | Informal only | Informal review | Formal review eligible |
| Enterprise pilot eligibility | With disclosure | Yes | Yes |
| Peer-review eligibility | No | Yes | Yes |
| Timeline | 60–90 days | 6–12 months | 18–24 months |
| Cost estimate | $50K–$100K | $500K–$1M | $2M–$5M |

---

## DELIVERABLE 1 — Full Architecture Summary

The Evidence Boundary Architecture consists of ten integrated components:

1. **Evidence Admissibility Standard** — formal rules governing which documents may enter the council's evidence corpus, with three categories (Admissible, Prohibited, Conditional) and specific verification methods for each document type.

2. **Time Cutoff Governance** — rules for establishing the Decision Date and Evidence Cutoff Date, with priority order for source selection and specific governance rules for edge cases (embargoes, retrospective registrations, rolling publications).

3. **Evidence Manifest System** — a structured JSON schema recording every document considered for council input, with case-level and document-level fields, digital signatures, and hash-based immutability controls.

4. **Leakage Prevention Protocol** — a 15-pathway leakage matrix ranked by severity, with detection methods and mitigation strategies for each pathway, including the honest acknowledgement that LLM latent knowledge cannot be fully mitigated by architecture alone.

5. **Blinded Case Methodology** — a six-phase workflow with governance checkpoints, immutability controls, and role separation ensuring the council cannot see the outcome and the evidence package cannot be altered after execution.

6. **Reproducibility Standard** — a six-step framework enabling independent parties to access the same evidence package, rerun the council, and compare outputs, with a defined Reproducibility Threshold (≥80% verdict agreement across 10 reruns).

7. **Independent Review Protocol** — reviewer-specific objections, required evidence, acceptance thresholds, and recommended documentation for FDA, EMA, top-20 pharma, CRO, and Big Four reviewers.

8. **Validation Library Admission Rules** — six admission criteria and eight exclusion criteria governing case entry, with a Conditional Admission Flag system for cases with disclosed limitations.

9. **Governance and Audit Layer** — four-role governance structure, Governance Audit Log schema, chain-of-custody protocol, version control for constitutional amendments and evidence packages, and 21 CFR Part 11 compliance pathway.

10. **Gold Standard Architecture** — three implementation tiers (Minimum Viable, Enterprise, Regulator-Ready) with cost estimates, timelines, and reviewer acceptance verdicts for each.

---

## DELIVERABLE 8 — Gap Analysis of AgenThink's Current Approach

| Gap | Current State | Required State | Severity | Priority |
|---|---|---|---|---|
| Evidence boundary verifiability | Prompt instruction only | Evidence Manifest + automated date-check | CRITICAL | P1 |
| LLM knowledge exclusion | Undisclosed limitation | Disclosed limitation + RAG (Tier 2) | CRITICAL | P1 |
| Audit trail | None | Governance Audit Log with hash values | HIGH | P1 |
| Methodology publication | Unpublished | Published (preprint minimum) | HIGH | P1 |
| Reproducibility testing | Not performed | 10 reruns per case | HIGH | P2 |
| Independent expert validation | None | 3 experts per case (Tier 2) | HIGH | P2 |
| Case selection pre-specification | Retrospective | Pre-specified criteria before case selection | HIGH | P2 |
| Constitutional amendment freeze | Not implemented | 5-case validation test before ratification | MEDIUM | P2 |
| 21 CFR Part 11 compliance | Not assessed | Compliance assessment (Tier 2) | MEDIUM | P3 |
| Prospective validation | Not started | Blinded pilot (5–10 current Phase II drugs) | MEDIUM | P3 |
| Liability framework | None | Legal opinion on advisory liability | MEDIUM | P3 |
| GxP compliance | Not assessed | GxP assessment (Tier 3) | LOW | P4 |

---

## DELIVERABLE 9 — Prioritised Implementation Roadmap

### Phase 1 — Foundation (Weeks 1–8): Minimum Viable Architecture

**Week 1–2:**
- Draft and publish the Evidence Boundary Architecture document (this document)
- Disclose the LLM training data limitation in all existing case reports
- Document the model version and temperature used for all 10 completed cases

**Week 3–4:**
- Build the Evidence Manifest template (JSON schema)
- Retroactively complete Evidence Manifests for all 10 completed cases
- Identify and document all documents used in each case

**Week 5–6:**
- Implement the curator blinding protocol for future cases
- Implement corpus locking (SHA-256 hash) for future cases
- Implement council output locking for future cases

**Week 7–8:**
- Publish the methodology document (model version, temperature, system prompt, constitutional rules, persona definitions)
- Create the public evidence corpus repository (GitHub)
- Publish Evidence Manifests for all 10 completed cases

**Milestone:** Minimum Viable Architecture complete. Cases 1–10 retroactively documented. Ready for early pilot discussions with full disclosure.

### Phase 2 — Automation (Months 3–6): Enterprise Architecture

**Month 3:**
- Build automated date-check pipeline (PubMed API, ClinicalTrials.gov API)
- Build automated leakage detection (keyword search, temporal marker flagging)
- Implement Governance Audit Log

**Month 4:**
- Implement RAG execution model
- Implement knowledge suppression system prompt
- Run canary test cases to validate knowledge suppression

**Month 5:**
- Run reproducibility testing for all 10 completed cases (10 reruns each)
- Publish reproducibility data
- Commission 3 independent pharmaceutical experts to validate DDIA for 5 cases

**Month 6:**
- Submit methodology preprint (bioRxiv or SSRN)
- Pre-specify case selection criteria for Cases 11–50
- Begin Cases 11–20 (Oncology batch) with full Enterprise Architecture

**Milestone:** Enterprise Architecture complete. Peer-review submission ready. Enterprise pilot discussions can begin.

### Phase 3 — Validation (Months 7–18): Regulator-Ready Architecture

**Month 7–9:**
- Complete Cases 11–30 with Enterprise Architecture
- Publish interim results (20-case library)
- Design prospective pilot (5 current Phase II drugs, blinded)

**Month 10–12:**
- Complete Cases 31–50 with Enterprise Architecture
- Submit peer-reviewed methodology paper
- Launch prospective pilot

**Month 13–18:**
- Complete peer-review process
- Engage FDA/EMA for informal methodology review
- Engage legal counsel on advisory liability framework
- Assess GxP compliance requirements
- Prepare Regulator-Ready Architecture implementation plan

**Milestone:** Regulator-Ready Architecture implementation plan complete. Peer-reviewed publication submitted. Prospective pilot underway.

---

## DELIVERABLE 10 — Executive Verdict

### The Final Answer

**Would this architecture satisfy a skeptical FDA reviewer who believes the Council may have known the answer?**

> **PARTIALLY — with a clear path to YES.**

**At Tier 1 (Minimum Viable):** PARTIALLY. The architecture provides a documented evidence boundary, a disclosed limitation, and an audit trail. The FDA reviewer will acknowledge the effort but will note: "You've documented what you gave the model. You haven't proven the model didn't already know the answer." This is correct. The honest response is: "You're right. We can't prove it. We've disclosed it. Here's what we're doing about it."

**At Tier 2 (Enterprise):** PARTIALLY — approaching YES. The RAG execution model reduces (but does not eliminate) the latent knowledge risk. The reproducibility data demonstrates methodological consistency. The independent expert validation provides a human-readable audit trail. The FDA reviewer will say: "This is better. The RAG architecture is a meaningful control. But I still can't verify the model's training data." The honest response is: "Correct. We're working on it."

**At Tier 3 (Regulator-Ready):** YES — for informal review. The custom model with verified training data cutoff eliminates the latent knowledge objection. The prospective pilot provides a forward-looking track record. The peer-reviewed publication provides independent methodology validation. The FDA reviewer will say: "This is defensible for exploratory use. I'm not endorsing it for regulatory decision-making, but I'm not objecting to it either."

### The Three Things That Must Be True

For this architecture to satisfy a skeptical FDA reviewer:

1. **The LLM training data limitation must be disclosed, not hidden.** Every case report, every presentation, every pilot proposal must include the sentence: "The council was executed using a large language model. The model's training data may include post-decision information about this case. This limitation is known, disclosed, and partially mitigated by [specific mitigation]."

2. **The evidence corpus must be independently verifiable.** Every document in the corpus must have a DOI or URL, a verified publication date, and a documented admission decision. An independent party must be able to download every document and verify that it was published before the Evidence Cutoff Date.

3. **The methodology must be published.** The exact prompts, model version, constitutional rules, and persona definitions must be in the public domain before any enterprise discussion. A methodology that cannot be independently replicated is not a methodology — it is a black box.

### The Single Most Important Action

**Build the Evidence Corpus before running any more cases.**

Every case run without a verified evidence corpus is a case that cannot be defended. The 10 completed cases are currently defended by a prompt instruction. That is not sufficient. The retroactive Evidence Manifests (Phase 1, Weeks 3–4) will partially address this. The automated date-check pipeline (Phase 2, Month 3) will fully address it.

The architecture described in this document is implementable. The timeline is realistic. The cost is proportionate to the commercial opportunity. The honest limitation is known and manageable.

**Run the architecture. Then run the cases.**

---

*End of Document*  
*AgenThink Mesh Evidence Boundary Architecture v1.0 | June 2026*  
*Classification: Governance Document — Internal & External Review*
