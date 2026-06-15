# AgenThink Pharma — 28-Day Credibility Sprint

**Classification:** Internal Execution Document — Confidential  
**Day 0:** June 15, 2026  
**Day 28:** July 13, 2026  
**Purpose:** Close every P0 blocker and maximum P1 blockers before first outreach  
**Standard:** Board-ready execution package

---

## PART 1 — P0 BLOCKER CLOSURE PLAN

Each of the seven P0 blockers is addressed below with the exact deliverable required, the owner, effort, cost, and a binary completion criterion. A blocker is not closed until its completion criterion is met in full.

---

### P0-1 — LLM Contamination Disclosure

**Why it matters.** The single most damaging objection a scientific reviewer can raise is: *"The model was trained on data that includes the outcome. Your evidence boundary is a prompt instruction, not a verifiable control."* This objection is correct. It cannot be refuted. It can only be disclosed. A scientific reviewer who discovers the limitation independently — rather than reading it in the document — will dismiss the entire methodology. A reviewer who reads the disclosure first will evaluate the methodology on its merits.

**Exact deliverable required.** A single-page Limitation Disclosure Statement (LDS-001) containing: (a) a plain-language description of the LLM training data contamination risk; (b) the specific implication for the AgenThink retrospective validation library; (c) the three-tier mitigation architecture (Tier 1: prompt-level controls, Tier 2: evidence corpus, Tier 3: model fine-tuning); (d) the current tier status (Tier 1 only); and (e) a statement that the library results should be interpreted as proof-of-concept only until Tier 2 is implemented. This statement must be appended to every case report, the cumulative library update, the Institutional Proof Package, and the sales deck.

**Owner.** CEO / Research Lead.

**Effort.** 6 hours (writing: 3 hours; review: 2 hours; integration into all documents: 1 hour).

**Cost.** $0.

**Completion criterion.** LDS-001 is appended to all 10 case reports, the cumulative library update, the Institutional Proof Package v1.0, and the sales deck. A git commit confirms the update. The document is dated and version-controlled.

---

### P0-2 — Published Methodology

**Why it matters.** "Where is the methodology published?" is the second question a scientific reviewer asks. If the answer is "it's in our internal documents," the conversation ends. Publication on GitHub is not peer review. It is not even close to peer review. But it is the minimum signal of transparency that separates a credible vendor from a black-box AI tool. A Roche scientific advisor who can read the exact system prompts, the constitutional rules, the persona definitions, and the OVS rubric will evaluate the methodology. A Roche scientific advisor who cannot read any of these will not.

**Exact deliverable required.** A public GitHub repository (`agenthinkmesh/pharma-council-v1`) containing: (a) `README.md` — methodology overview, evidence boundary statement, known limitations, how to cite; (b) `methodology/constitution-v1.md` — all 10 constitutional rules with rationale; (c) `methodology/personas-v1.md` — all 10 persona definitions with voting weights; (d) `methodology/ovs-rubric-v1.md` — OVS scoring rubric with anchored descriptors for each dimension; (e) `methodology/evidence-manifest-schema.json` — JSON schema for evidence manifests; (f) `cases/torcetrapib/evidence-manifest.json` — completed manifest for Case 1; (g) `cases/torcetrapib/council-output.json` — sanitised council output (no proprietary data); (h) `LIMITATIONS.md` — LDS-001 in full; (i) `LICENSE` — CC BY 4.0 for methodology files; (j) `CITATION.cff` — citation file for academic reference.

**Owner.** Engineering Lead + Research Lead.

**Effort.** 32 hours (repository setup: 4 hours; content writing: 20 hours; review: 6 hours; publication: 2 hours).

**Cost.** $0 (GitHub public repository).

**Completion criterion.** Repository is public. README renders correctly. All 10 files listed above are present. The repository URL is included in the sales deck and all external documents.

---

### P0-3 — Case Selection Bias Disclosure

**Why it matters.** The 10 original cases include torcetrapib, sofosbuvir, BNT162b2, aducanumab, and verubecestat — five of the most cited pharmaceutical development decisions in the literature. A Big Four diligence team will identify this immediately: *"You selected famous cases. The model knows these cases. Your validation is circular."* The disclosure does not eliminate the bias. It demonstrates that AgenThink is aware of it and has a plan to address it.

**Exact deliverable required.** A Case Selection Disclosure Statement (CSDS-001) containing: (a) the selection criteria used for the original 10 cases (retrospective suitability score, therapeutic area diversity, decision type diversity, public data availability); (b) an explicit acknowledgment that all 10 cases are well-documented in the published literature and therefore likely present in LLM training data; (c) the pre-specification plan for Cases 11–50 (selection criteria published before execution, independent case nomination process, inclusion of ambiguous-signal cases); (d) a statement that the 10-case library is a proof-of-concept corpus, not a validation dataset. This statement is appended to the cumulative library update and the Institutional Proof Package.

**Owner.** Research Lead.

**Effort.** 4 hours.

**Cost.** $0.

**Completion criterion.** CSDS-001 is appended to the cumulative library update and the Institutional Proof Package v1.0. A pre-specification document for Cases 11–50 selection criteria is drafted (does not need to be finalised before Day 28, but must exist as a draft).

---

### P0-4 — Pilot Agreement Template

**Why it matters.** No pharmaceutical company will begin a pilot without a signed agreement. The agreement defines scope, deliverables, IP ownership, liability, confidentiality, and data handling. Without a template, the first meeting that reaches "let's do a pilot" will stall for 4–8 weeks while legal teams draft from scratch. A pre-drafted template reduces that to 1–2 weeks of negotiation.

**Exact deliverable required.** A Pilot Agreement Template (PAT-001) containing: (a) Scope of Work — retrospective pilot only, named case, public data only, 30-day timeline; (b) Deliverables — Evidence Manifest, Council Output JSON, Institutional Proof Report PDF; (c) IP Ownership — AgenThink retains methodology IP; client retains any proprietary data provided; joint ownership of the specific pilot output; (d) Liability Limitation — AgenThink liability capped at pilot fee; no warranty of fitness for regulatory purpose; explicit statement that the output is not a regulatory submission; (e) Confidentiality — mutual NDA; client's case selection is confidential; AgenThink's methodology is confidential except for published GitHub content; (f) Data Handling — no proprietary data in retrospective pilot; all evidence from public sources; evidence corpus made available to client for review; (g) Pricing — $25,000 fixed fee for 30-day retrospective pilot; (h) Termination — either party may terminate with 5 business days notice; (i) Governing Law — to be specified per client jurisdiction.

**Owner.** CEO + External Legal Counsel.

**Effort.** 16 hours (legal briefing: 2 hours; first draft by counsel: 8 hours; internal review: 4 hours; final version: 2 hours).

**Cost.** $5,000–$12,000 (legal fees).

**Completion criterion.** PAT-001 is reviewed and approved by legal counsel. It is stored in a secure document repository. It is referenced in the sales deck as "available on request."

---

### P0-5 — Data Processing Agreement Template

**Why it matters.** Any pharmaceutical company with a legal team will ask for a DPA before sharing any data, even if the pilot uses only public data. A missing DPA signals that AgenThink has not thought through data governance. A pre-drafted DPA signals the opposite.

**Exact deliverable required.** A Data Processing Agreement Template (DPAT-001) containing: (a) Data Controller / Data Processor roles; (b) Categories of data processed — public pharmaceutical development data only for retrospective pilots; (c) Purpose limitation — pilot execution only; (d) Retention — evidence corpus deleted or returned within 30 days of pilot completion; (e) Security measures — encryption in transit and at rest; access controls; (f) Sub-processors — list of any third-party services used (LLM API, cloud storage); (g) Data subject rights — not applicable for public data pilots; (h) Breach notification — 72-hour notification to client; (i) GDPR / CCPA compliance statements; (j) Governing Law.

**Owner.** CEO + External Legal Counsel.

**Effort.** 12 hours (legal briefing: 2 hours; first draft by counsel: 6 hours; internal review: 2 hours; final version: 2 hours).

**Cost.** $3,000–$8,000 (legal fees, often combined with PAT-001 engagement).

**Completion criterion.** DPAT-001 is reviewed and approved by legal counsel. It is stored in the same secure document repository as PAT-001.

---

### P0-6 — Evidence Boundary Statement

**Why it matters.** The evidence boundary statement is the single most important credibility signal in the entire package. It answers: *"How do you know the council only saw pre-decision information?"* The answer must be specific, verifiable, and honest about its current limitations.

**Exact deliverable required.** A standalone Evidence Boundary Statement (EBS-001) — one page, suitable for inclusion in any external document — containing: (a) Definition of the evidence cutoff date (Decision Date − 30 days, with source hierarchy); (b) Current implementation tier (Tier 1: prompt-level controls); (c) What Tier 1 controls do and do not guarantee; (d) The Evidence Manifest system — what it is, what it contains, how it is constructed; (e) The corpus locking protocol — when the corpus is locked, who locks it, what the lock record contains; (f) The known limitation: LLM training data cannot be verified as pre-cutoff; (g) The path to Tier 2 (document-retrieval architecture); (h) A statement that all 10 case reports include an evidence boundary section documenting the specific cutoff date and admitted evidence for that case.

**Owner.** Research Lead.

**Effort.** 6 hours.

**Cost.** $0.

**Completion criterion.** EBS-001 is published on GitHub, appended to the Institutional Proof Package, and referenced in the sales deck. It is dated and version-controlled.

---

### P0-7 — Sales Deck

**Why it matters.** The sales deck is the first document a prospect reads after the outreach email. It must answer five questions in 12–15 slides: What is it? Does it work? How does it work? What does it cost? Why should I trust it? A deck that answers these questions in under 10 minutes of reading time gets a meeting. A deck that does not gets archived.

**Exact deliverable required.** A 14-slide Sales Deck (SD-001) with the following structure:

- **Slide 1 — Cover:** AgenThink Pharma Council v1. Retrospective Validation Pilot. [Date].
- **Slide 2 — The Problem:** One sentence. One statistic. No more.
- **Slide 3 — The Solution:** What the council is. What it is not. One diagram.
- **Slide 4 — How It Works:** Five steps. One page. No jargon.
- **Slide 5 — The 10-Case Library:** Table: drug, verdict, outcome, alignment. No claims beyond the data.
- **Slide 6 — Case Study: Torcetrapib:** One case. Full story. Evidence boundary stated. Verdict: WAIT. Outcome: correct.
- **Slide 7 — The Methodology:** Constitution v1 (10 rules). 10 personas. OVS rubric. GitHub link.
- **Slide 8 — Known Limitations:** LDS-001 summary. Three bullets. No hedging.
- **Slide 9 — The Pilot:** 30-day retrospective pilot. Scope. Deliverables. Price: $25,000.
- **Slide 10 — Why Now:** First-mover. Evidence corpus architecture in development. Independent validation in progress.
- **Slide 11 — The Ask:** One meeting. 30 minutes. Propose a case.
- **Slide 12 — Team:** Names, titles, relevant credentials.
- **Slide 13 — References:** GitHub URL. Methodology paper (if available). Contact.
- **Slide 14 — Appendix:** OVS rubric. Constitutional rules. Evidence manifest schema.

**Owner.** CEO + Commercial Lead.

**Effort.** 24 hours (content: 12 hours; design: 8 hours; review: 4 hours).

**Cost.** $0 (internal) or $500–$2,000 (design contractor).

**Completion criterion.** SD-001 exists as a PDF and a PowerPoint. It has been reviewed by at least one person with pharmaceutical industry experience. The GitHub URL is live and correct. LDS-001 is included.

---

## PART 2 — DOCUMENT PACKAGE

The following documents must exist before first outreach. Status is assessed as of Day 0.

| # | Document Name | Purpose | Length | Audience | Status (Day 0) | Priority |
|---|---|---|---|---|---|---|
| 1 | Limitation Disclosure Statement (LDS-001) | Disclose LLM contamination risk | 1 page | All external audiences | **Does not exist** | P0 |
| 2 | Case Selection Disclosure Statement (CSDS-001) | Disclose selection bias | 1 page | Scientific reviewers, Big Four | **Does not exist** | P0 |
| 3 | Evidence Boundary Statement (EBS-001) | Explain evidence boundary architecture | 1 page | Scientific reviewers, regulatory | **Draft exists** | P0 |
| 4 | Pilot Agreement Template (PAT-001) | Legal framework for pilots | 6–8 pages | Legal, procurement | **Does not exist** | P0 |
| 5 | Data Processing Agreement Template (DPAT-001) | Data governance framework | 4–6 pages | Legal, compliance | **Does not exist** | P0 |
| 6 | Sales Deck (SD-001) | First-meeting presentation | 14 slides | Commercial, R&D leadership | **Does not exist** | P0 |
| 7 | GitHub README | Methodology overview, public | 2–3 pages | Scientific reviewers, technical | **Does not exist** | P0 |
| 8 | Methodology: Constitution v1 | 10 constitutional rules with rationale | 3–4 pages | Scientific reviewers | **Exists (internal)** | P0 |
| 9 | Methodology: Personas v1 | 10 persona definitions | 2–3 pages | Scientific reviewers | **Exists (internal)** | P0 |
| 10 | Methodology: OVS Rubric v1 | Scoring rubric with anchors | 2 pages | Scientific reviewers, Big Four | **Exists (internal)** | P0 |
| 11 | Evidence Manifest: Torcetrapib | Verified evidence corpus for Case 1 | 2–3 pages | Scientific reviewers, auditors | **Does not exist** | P1 |
| 12 | Council Output JSON: Torcetrapib | Machine-readable council result | JSON file | Technical reviewers | **Exists** | P1 |
| 13 | Institutional Proof Report: Torcetrapib | Full case report with appendix | 4 pages | R&D leadership, governance | **Exists** | P1 |
| 14 | Cumulative Library Update (10 cases) | All 10 cases, running metrics | 15–20 pages | R&D leadership, Big Four | **Exists** | P1 |
| 15 | Institutional Proof Package v1.0 | Pre-meeting evidence package | 40–55 pages | Enterprise buyers | **Exists** | P1 |
| 16 | Independent Validation Report (Torcetrapib) | Named expert review of Case 1 | 3–5 pages | Scientific reviewers, enterprise | **Does not exist** | P1 |
| 17 | Reproducibility Study Report | 10-rerun verdict agreement data | 2–3 pages | Scientific reviewers | **Does not exist** | P1 |
| 18 | One-Page Executive Summary | CEO-level summary of the library | 1 page | CEO, CSO, Board | **Does not exist** | P1 |
| 19 | Outreach Email Template (Recursion) | First outreach email | 150–200 words | Commercial Lead | **Does not exist** | P1 |
| 20 | Outreach Email Template (IQVIA) | Partnership framing email | 150–200 words | Commercial Lead | **Does not exist** | P1 |
| 21 | NDA Template | Standard mutual NDA | 3–4 pages | Legal | **Standard available** | P2 |
| 22 | Pre-specification: Cases 11–50 | Selection criteria for next 40 cases | 2–3 pages | Scientific reviewers | **Does not exist** | P2 |
| 23 | Penetration Test Brief | Security assessment scope | 1–2 pages | Security, IT | **Does not exist** | P2 |

---

## PART 3 — GITHUB PUBLICATION PACKAGE

### What to Publish

The GitHub repository serves one purpose: allowing a scientific reviewer to verify the methodology independently. Everything that enables independent verification should be published. Everything that constitutes a competitive advantage in the council execution should remain proprietary.

**Publish (public repository):**

The `README.md` is the most important file. It must be written for a pharmaceutical scientist, not a software engineer. It answers: what is this, what does it claim, what does it not claim, how was it built, what are its limitations, how do I cite it. The README links to every other file in the repository.

The `LIMITATIONS.md` file contains LDS-001 in full. Publishing the limitations prominently is a credibility signal, not a weakness. A vendor that hides limitations is a vendor that has something to hide.

The `methodology/` directory contains the constitution, persona definitions, and OVS rubric. These are the core intellectual property of the methodology — but they must be published to be credible. The competitive moat is not the rules; it is the execution, the case library, and the validation track record.

The `cases/torcetrapib/` directory contains the evidence manifest and the sanitised council output. This is the proof that the methodology was actually executed, not just described.

The `schema/` directory contains the JSON schemas for evidence manifests and council outputs. This enables independent replication.

**Keep Proprietary (private repository or internal only):**

The full council engine source code (the LLM invocation logic, the prompt templates, the report generation pipeline) is the core product. It should not be published.

The full case library beyond torcetrapib (cases 2–10 council outputs) should not be published until independent validation is complete. Publishing unvalidated outputs creates a larger attack surface than it closes.

The client pilot outputs are confidential by default under the pilot agreement.

The commercial pricing, the target list, and the outreach strategy are internal documents.

### Exact Repository Structure

```
agenthinkmesh/pharma-council-v1/
│
├── README.md                          ← Methodology overview, limitations, citation
├── LIMITATIONS.md                     ← LDS-001 in full
├── LICENSE                            ← CC BY 4.0
├── CITATION.cff                       ← Academic citation file
│
├── methodology/
│   ├── constitution-v1.md             ← 10 constitutional rules with rationale
│   ├── personas-v1.md                 ← 10 persona definitions, voting weights
│   ├── ovs-rubric-v1.md               ← OVS scoring rubric, anchored descriptors
│   ├── evidence-boundary-v1.md        ← EBS-001 in full
│   └── council-process-v1.md          ← Step-by-step council execution protocol
│
├── schema/
│   ├── evidence-manifest-schema.json  ← JSON schema for evidence manifests
│   └── council-output-schema.json     ← JSON schema for council outputs
│
├── cases/
│   └── torcetrapib/
│       ├── evidence-manifest.json     ← Completed manifest for Case 1
│       ├── council-output.json        ← Sanitised council output
│       └── README.md                  ← Case summary, evidence boundary, verdict
│
└── validation/
    ├── library-summary.md             ← 10-case summary table (no full outputs)
    └── reproducibility-notes.md       ← Placeholder until study complete
```

### What a Roche Reviewer Expects to See

A Roche scientific reviewer opening the repository for the first time will spend 15–20 minutes on it. They will read the README, check the LIMITATIONS file, open the constitution, and look at the torcetrapib evidence manifest. They will ask four questions:

First: *"Is the evidence boundary verifiable?"* The manifest answers this. If the manifest lists specific documents with DOIs, publication dates, and access dates, the reviewer can spot-check three or four of them. If they check out, the boundary is credible.

Second: *"Are the constitutional rules reasonable?"* The constitution must be written in pharmaceutical development language, not AI language. Rules like "Phase II safety signals must be mechanistically investigated before Phase III advancement" are credible. Rules like "The council must apply a holistic governance framework" are not.

Third: *"Is the limitation disclosure honest?"* The reviewer will read LIMITATIONS.md carefully. If it says "the model may have been trained on data that includes the outcome of these cases, and we cannot verify otherwise," the reviewer will respect the honesty. If it hedges, they will not.

Fourth: *"Can I replicate this?"* The schemas and the council process document must be specific enough that a technically capable reviewer could, in principle, run the council themselves. They will not actually do it. But the ability to do so is the credibility signal.

---

## PART 4 — FIRST DEMO ENVIRONMENT SPECIFICATION

### Purpose

The demo environment is not a product demo. It is a credibility demo. Its purpose is to show a pharmaceutical R&D leader, in 20–30 minutes, that the council methodology is real, structured, and produces outputs that a pharmaceutical governance team would recognise as useful. It is not designed to close a sale. It is designed to get a second meeting.

### Minimum Viable Demo — Five Components

**Component 1: Case Library View**

A single-page display showing the 10-case library in a structured table. Columns: Case Number, Drug, Company, Therapeutic Area, Phase II Year, Council Verdict, Actual Outcome, Alignment (Yes / Partial / No), OVS Score. The table is sortable by verdict, outcome, and alignment. A filter allows the viewer to show only failures, only successes, or only partial alignments. No charts, no animations. The table is the content.

*Specification:* Static HTML page or simple React component. Data loaded from a JSON file (the library summary JSON). No backend required. Hosted on a subdomain of agenthink.com or as a GitHub Pages site.

**Component 2: Council Output View (Torcetrapib)**

A structured display of the torcetrapib council output. The view has four panels: (a) Decision Brief — drug, company, decision, evidence cutoff date, admitted evidence list; (b) Vote Distribution — 10 personas, each with vote (GO/WAIT/NO-GO), confidence level, and one-sentence rationale; (c) Key Blockers — the five primary blockers identified by the council, each with the constitutional rule invoked; (d) Final Verdict — WAIT, with proof score and confidence range.

*Specification:* Static HTML page or React component. Data loaded from the council-output.json file. The view must be printable as a single PDF (for leaving behind after a meeting). No interactive elements beyond expand/collapse for individual persona rationales.

**Component 3: Constitution View**

A display of the 10 constitutional rules. Each rule has: rule number, rule title, rule text, rationale (one paragraph), and the cases in the library where this rule was invoked. The view is searchable by keyword.

*Specification:* Static HTML page. Data loaded from constitution-v1.md or a JSON version of it. No backend required.

**Component 4: Evidence Boundary View (Torcetrapib)**

A display of the torcetrapib evidence manifest. The view shows: evidence cutoff date (November 30, 2005), admitted documents (list with title, authors, publication date, DOI, and relevance note), excluded documents (list with title, exclusion reason), and the corpus lock record (date locked, who locked it, hash of the corpus).

*Specification:* Static HTML page. Data loaded from evidence-manifest.json. Each DOI is a clickable link to the source. The corpus lock hash is displayed prominently.

**Component 5: Audit Trail View**

A display of the governance audit log for the torcetrapib case. The log shows: session ID, date, operator, model version, constitution version, evidence manifest version, council output hash, and report generation timestamp. Each entry is immutable (displayed as a read-only log, not an editable table).

*Specification:* Static HTML page. Data loaded from a governance-audit-log.json file. No backend required.

### Demo Flow (20-Minute Walkthrough)

| Minute | Component | Key Message |
|---|---|---|
| 0–2 | Case Library | "We have run 10 retrospective cases. Here is the full record." |
| 2–8 | Council Output (Torcetrapib) | "Here is what the council saw and what it decided — before the failure." |
| 8–12 | Evidence Boundary | "Here is exactly what evidence the council had access to." |
| 12–15 | Constitution | "Here are the 10 rules that governed the decision." |
| 15–18 | Audit Trail | "Here is the complete audit record for this case." |
| 18–20 | Q&A | "What case would you want us to run for you?" |

### What the Demo Is Not

The demo is not a live system. It does not run the council in real time during the meeting. It does not connect to a database. It does not require a login. It is a structured presentation of a completed case, designed to be shown on a laptop in a conference room or shared as a link before a call. The live council execution happens during the pilot, not during the demo.

---

*[End of Parts 1–4]*

---

## PART 5 — INDEPENDENT VALIDATION PLAN

### Objective

Commission the cheapest credible independent review of the torcetrapib case that a Roche or Novartis scientific reviewer would accept as meaningful. "Cheapest credible" means: a named, qualified reviewer with verifiable pharmaceutical development credentials, who reviews the evidence boundary and the council verdict against the pre-cutoff evidence, and produces a signed written opinion. It does not mean peer review. It does not mean a clinical trial. It means one qualified person saying, in writing: "I reviewed the evidence corpus, I confirmed the cutoff date, and I agree or disagree with the council's primary risk identification."

### Who Should Review

The reviewer must meet three criteria: (a) pharmaceutical development experience at Phase II/III level; (b) no financial relationship with AgenThink; (c) willingness to be named publicly in the validation report.

**Ideal profile:** Former pharmaceutical R&D executive (VP Clinical Development or equivalent), former CRO medical director, or academic clinical pharmacologist with industry experience. The reviewer does not need to be a CETP expert. They need to understand Phase II → III advancement decision-making.

**Specific candidate categories to approach:**

*Category A — Former pharma R&D executives (retired or consulting):* Former VPs of Clinical Development at mid-to-large pharmaceutical companies who have transitioned to consulting. These individuals are credible, available, and typically charge $300–$600 per hour for advisory work. A 10-hour engagement costs $3,000–$6,000.

*Category B — Academic clinical pharmacologists:* Faculty at medical schools with industry collaboration experience. Typically charge $200–$400 per hour. A 10-hour engagement costs $2,000–$4,000. The academic affiliation adds credibility but the review timeline may be longer (4–6 weeks vs. 2–3 weeks for a consultant).

*Category C — CRO medical directors (former):* Former medical directors at ICON, Medpace, or Covance who have left to consult independently. Deep Phase II/III experience. Charge $250–$500 per hour. A 10-hour engagement costs $2,500–$5,000.

**Where to find them:** LinkedIn (search "VP Clinical Development" + "consulting" or "advisory"); pharmaceutical industry advisory networks (Guidepoint, GLG, AlphaSights); academic medical school faculty directories.

**Approach:** Email or LinkedIn message explaining the project, the review scope, the timeline, and the fee. Offer a 30-minute call to discuss before committing. Do not disclose the full methodology before an NDA is signed.

### What They Review

The reviewer receives a structured review package containing: (a) the torcetrapib evidence manifest (list of admitted documents with DOIs); (b) the torcetrapib decision brief (as presented to the council); (c) the council output (vote distribution, key blockers, final verdict); (d) the Institutional Proof Report; (e) a review questionnaire with five specific questions.

**Review Questionnaire (five questions):**

1. *Evidence Boundary:* "Based on the evidence manifest, do you believe the council had access only to information that was publicly available before Pfizer's Phase III advancement decision in 2005? If not, identify any documents that appear to post-date the cutoff."

2. *Risk Identification:* "The council identified the Phase II blood pressure signal (+2 mmHg systolic) as the primary blocker. Do you agree that this signal was a material risk factor that warranted investigation before Phase III advancement? Please provide your reasoning."

3. *Constitutional Rules:* "The council applied Constitutional Rule PC-001 (Phase II safety signals must be mechanistically investigated before Phase III advancement). Do you consider this rule appropriate for this decision context?"

4. *Verdict Assessment:* "The council issued a WAIT verdict. Based on the pre-cutoff evidence, do you consider this verdict reasonable? Would you have reached the same conclusion?"

5. *Overall Assessment:* "Does the council methodology, as demonstrated in this case, represent a credible approach to Phase II → III advancement governance? What are its primary strengths and limitations from your perspective?"

### Deliverables

The reviewer produces a signed, dated Review Opinion (2–3 pages) containing: (a) reviewer credentials and declaration of independence; (b) answers to the five review questions; (c) overall assessment statement; (d) any caveats or limitations noted. The Review Opinion is published as a standalone document and appended to the Institutional Proof Report as Appendix B.

### Cost Range

| Reviewer Category | Hourly Rate | Hours Required | Total Cost |
|---|---|---|---|
| Former pharma R&D executive (consulting) | $300–$600 | 8–12 | $2,400–$7,200 |
| Academic clinical pharmacologist | $200–$400 | 8–12 | $1,600–$4,800 |
| Former CRO medical director | $250–$500 | 8–12 | $2,000–$6,000 |
| **Recommended budget** | | | **$5,000–$10,000** |

Budget $10,000 for the first review. This covers the reviewer fee, the NDA legal review, and a contingency for a second reviewer if the first declines or is unavailable.

### Timeline

| Day | Activity |
|---|---|
| Day 1–3 | Identify 5–8 candidate reviewers. Prepare outreach message. |
| Day 4–7 | Send outreach. Schedule 30-minute calls with interested candidates. |
| Day 8–10 | Select reviewer. Sign NDA. Send review package. |
| Day 11–21 | Reviewer conducts review. |
| Day 22–24 | Receive draft Review Opinion. Internal review. |
| Day 25–27 | Finalise Review Opinion. Reviewer signs. |
| Day 28 | Review Opinion published. Appended to Institutional Proof Report. |

This timeline is tight. The reviewer must be identified and contracted by Day 10 to meet the Day 28 deadline. If the reviewer cannot complete by Day 28, the Review Opinion is listed as "in progress" in the launch package, with an expected completion date.

---

## PART 6 — 28-DAY SCHEDULE

Every day is assigned. No gaps. Activities are grouped by workstream: **[D]** = Disclosures, **[G]** = GitHub, **[L]** = Legal, **[V]** = Validation, **[S]** = Sales Deck, **[Dm]** = Demo.

---

**Day 1 (Monday, June 16)**
- [D] Draft LDS-001 (LLM contamination disclosure). Target: complete draft by end of day. *Owner: Research Lead. 3 hours.*
- [L] Brief external legal counsel on pilot agreement and DPA requirements. Send brief. *Owner: CEO. 2 hours.*
- [V] Identify 5–8 candidate independent reviewers. Build contact list with LinkedIn profiles and email addresses. *Owner: CEO. 3 hours.*

**Day 2 (Tuesday, June 17)**
- [D] Draft CSDS-001 (case selection bias disclosure). *Owner: Research Lead. 3 hours.*
- [D] Draft EBS-001 (evidence boundary statement). *Owner: Research Lead. 3 hours.*
- [V] Draft reviewer outreach message (email + LinkedIn version). *Owner: CEO. 2 hours.*

**Day 3 (Wednesday, June 18)**
- [D] Internal review of LDS-001, CSDS-001, EBS-001. Revise. *Owner: CEO + Research Lead. 4 hours.*
- [G] Create GitHub repository (`agenthinkmesh/pharma-council-v1`). Set to public. Add placeholder README. *Owner: Engineering Lead. 2 hours.*
- [V] Send reviewer outreach to all 5–8 candidates. *Owner: CEO. 1 hour.*

**Day 4 (Thursday, June 19)**
- [G] Write `LIMITATIONS.md` (LDS-001 formatted for GitHub). *Owner: Research Lead. 2 hours.*
- [G] Write `methodology/constitution-v1.md` (10 rules, formatted for public). *Owner: Research Lead. 4 hours.*
- [L] Receive legal counsel acknowledgment. Confirm engagement. *Owner: CEO. 1 hour.*

**Day 5 (Friday, June 20)**
- [G] Write `methodology/personas-v1.md` (10 persona definitions). *Owner: Research Lead. 3 hours.*
- [G] Write `methodology/ovs-rubric-v1.md` (OVS rubric with anchors). *Owner: Research Lead. 3 hours.*
- [V] Schedule 30-minute calls with reviewer candidates who responded. *Owner: CEO. 1 hour.*

**Day 6 (Saturday, June 21)**
- [G] Write `methodology/evidence-boundary-v1.md` (EBS-001 formatted). *Owner: Research Lead. 2 hours.*
- [G] Write `methodology/council-process-v1.md` (step-by-step execution protocol). *Owner: Research Lead. 3 hours.*

**Day 7 (Sunday, June 22)**
- [G] Write `schema/evidence-manifest-schema.json`. *Owner: Engineering Lead. 3 hours.*
- [G] Write `schema/council-output-schema.json`. *Owner: Engineering Lead. 2 hours.*
- Buffer day. Catch up on any Day 1–6 items not completed.

**Day 8 (Monday, June 23)**
- [G] Write `README.md` (full methodology overview, limitations, citation). *Owner: Research Lead + CEO. 4 hours.*
- [L] Receive first draft of pilot agreement (PAT-001) from legal counsel. *Owner: Legal Counsel.*
- [V] Conduct 30-minute calls with reviewer candidates. Select reviewer. *Owner: CEO. 3 hours.*

**Day 9 (Tuesday, June 24)**
- [G] Write `cases/torcetrapib/README.md` (case summary). *Owner: Research Lead. 2 hours.*
- [G] Prepare `cases/torcetrapib/council-output.json` (sanitise existing output for public release). *Owner: Engineering Lead. 3 hours.*
- [V] Sign NDA with selected reviewer. Send review package. *Owner: CEO. 2 hours.*

**Day 10 (Wednesday, June 25)**
- [G] Build `cases/torcetrapib/evidence-manifest.json` — this is the most effort-intensive GitHub task. Requires identifying all documents cited in the torcetrapib decision brief, verifying publication dates against the November 30, 2005 cutoff, and recording DOIs. *Owner: Research Lead. 6 hours.*
- [L] Internal review of PAT-001 draft. Mark up comments. *Owner: CEO. 3 hours.*

**Day 11 (Thursday, June 26)**
- [G] Complete `cases/torcetrapib/evidence-manifest.json`. Spot-check 5 DOIs for accessibility. *Owner: Research Lead. 4 hours.*
- [L] Send PAT-001 comments to legal counsel. Request DPA first draft. *Owner: CEO. 1 hour.*
- [S] Begin sales deck content outline (14 slides). *Owner: CEO + Commercial Lead. 3 hours.*

**Day 12 (Friday, June 27)**
- [G] Add `LICENSE` (CC BY 4.0) and `CITATION.cff` to repository. *Owner: Engineering Lead. 1 hour.*
- [G] Internal review of all GitHub files. Check for proprietary content that should not be public. *Owner: CEO + Research Lead. 3 hours.*
- [S] Complete sales deck content (all 14 slides, text only). *Owner: CEO + Commercial Lead. 4 hours.*

**Day 13 (Saturday, June 28)**
- [G] Publish all GitHub files. Verify repository renders correctly. Test all DOI links. *Owner: Engineering Lead. 2 hours.*
- [D] Integrate LDS-001, CSDS-001, and EBS-001 into all existing case reports and the Institutional Proof Package. *Owner: Research Lead. 4 hours.*

**Day 14 (Sunday, June 29)**
- Buffer day. Catch up on any Day 8–13 items not completed.
- [V] Check in with reviewer on progress. *Owner: CEO. 30 minutes.*

**Day 15 (Monday, June 30)**
- [L] Receive DPA first draft from legal counsel. *Owner: Legal Counsel.*
- [S] Begin sales deck design. Apply AgenThink brand. *Owner: Commercial Lead (or design contractor). 8 hours.*
- [Dm] Begin demo environment build — Component 1 (Case Library View). *Owner: Engineering Lead. 4 hours.*

**Day 16 (Tuesday, July 1)**
- [L] Internal review of DPA draft. Mark up comments. *Owner: CEO. 2 hours.*
- [S] Sales deck design continues. *Owner: Commercial Lead. 8 hours.*
- [Dm] Demo Component 2 (Council Output View — Torcetrapib). *Owner: Engineering Lead. 6 hours.*

**Day 17 (Wednesday, July 2)**
- [L] Send DPA comments to legal counsel. Request final versions of PAT-001 and DPAT-001. *Owner: CEO. 1 hour.*
- [S] Sales deck design complete. Internal review. *Owner: CEO + Research Lead. 3 hours.*
- [Dm] Demo Component 3 (Constitution View). *Owner: Engineering Lead. 3 hours.*

**Day 18 (Thursday, July 3)**
- [S] Sales deck revisions. Final version. Export as PDF and PowerPoint. *Owner: Commercial Lead. 3 hours.*
- [Dm] Demo Component 4 (Evidence Boundary View). *Owner: Engineering Lead. 4 hours.*
- [V] Reviewer check-in. Confirm on track for Day 22 draft. *Owner: CEO. 30 minutes.*

**Day 19 (Friday, July 4)**
- [L] Receive final PAT-001 and DPAT-001 from legal counsel. *Owner: Legal Counsel.*
- [Dm] Demo Component 5 (Audit Trail View). *Owner: Engineering Lead. 4 hours.*
- [Dm] Internal demo walkthrough. Test 20-minute flow. *Owner: CEO + Engineering Lead. 2 hours.*

**Day 20 (Saturday, July 5)**
- [L] Final review of PAT-001 and DPAT-001. Approve. Store in secure document repository. *Owner: CEO. 2 hours.*
- [Dm] Demo environment deployed to subdomain. Test on mobile and desktop. *Owner: Engineering Lead. 3 hours.*

**Day 21 (Sunday, July 6)**
- Buffer day. Catch up on any Day 15–20 items not completed.
- Write one-page executive summary (Document #18 in the document package). *Owner: CEO. 2 hours.*

**Day 22 (Monday, July 7)**
- [V] Receive draft Review Opinion from independent reviewer. *Owner: Reviewer.*
- [V] Internal review of draft Review Opinion. Prepare comments. *Owner: CEO + Research Lead. 3 hours.*
- Write outreach email template for Recursion (Document #19). *Owner: CEO + Commercial Lead. 2 hours.*

**Day 23 (Tuesday, July 8)**
- [V] Send comments on draft Review Opinion to reviewer. *Owner: CEO. 1 hour.*
- Write outreach email template for IQVIA (Document #20). *Owner: CEO + Commercial Lead. 2 hours.*
- Write pre-specification document for Cases 11–50 selection criteria (Document #22). *Owner: Research Lead. 3 hours.*

**Day 24 (Wednesday, July 9)**
- Run reproducibility study: re-run torcetrapib council 5 times (minimum). Record verdict agreement rate. *Owner: Engineering Lead. 4 hours.*
- Internal review of all outreach email templates. *Owner: CEO. 2 hours.*

**Day 25 (Thursday, July 10)**
- [V] Receive final Review Opinion from reviewer. *Owner: Reviewer.*
- [V] Append Review Opinion to Institutional Proof Report as Appendix B. Update all documents. *Owner: Research Lead. 2 hours.*
- Write reproducibility study report (Document #17). *Owner: Research Lead. 3 hours.*

**Day 26 (Friday, July 11)**
- Full document audit: verify all 23 documents in the document package exist and are current. *Owner: CEO + Research Lead. 4 hours.*
- Update GitHub repository with any final changes. *Owner: Engineering Lead. 2 hours.*
- Demo environment final test. *Owner: Engineering Lead. 1 hour.*

**Day 27 (Saturday, July 12)**
- Full launch package assembly: compile all files into a structured folder. Verify naming conventions. *Owner: Commercial Lead. 3 hours.*
- Internal launch readiness review: score each dimension against the readiness rubric. *Owner: CEO. 2 hours.*

**Day 28 (Sunday, July 13)**
- Final review. CEO sign-off on launch package. *Owner: CEO. 2 hours.*
- Prepare first outreach email (Recursion). Schedule for Monday morning (Day 29). *Owner: Commercial Lead. 1 hour.*
- **Day 28 complete. Launch package ready. First outreach authorised for Day 29.**

---

## PART 7 — LAUNCH PACKAGE (DAY 28)

The following assets must exist, be current, and be accessible at Day 28. This is the complete inventory.

### External-Facing Documents (for prospects)

| # | Asset | Format | Location | Status Target |
|---|---|---|---|---|
| 1 | Sales Deck (SD-001) | PDF + PPTX | Secure link (Google Drive or Dropbox) | Complete |
| 2 | One-Page Executive Summary | PDF | Same secure link | Complete |
| 3 | Institutional Proof Package v1.0 | PDF | Same secure link | Complete (updated with disclosures) |
| 4 | Torcetrapib Institutional Proof Report | PDF | Same secure link | Complete (updated with Appendix B) |
| 5 | Independent Validation Report (Appendix B) | PDF | Appended to IPR | Complete |
| 6 | Limitation Disclosure Statement (LDS-001) | PDF | Same secure link | Complete |
| 7 | Evidence Boundary Statement (EBS-001) | PDF | Same secure link | Complete |
| 8 | Pilot Agreement Template (PAT-001) | PDF | Available on request (not in prospect package) | Complete |
| 9 | DPA Template (DPAT-001) | PDF | Available on request | Complete |
| 10 | NDA Template | PDF | Available on request | Complete |

### GitHub Repository (public)

| # | File | Status Target |
|---|---|---|
| 11 | README.md | Complete |
| 12 | LIMITATIONS.md | Complete |
| 13 | LICENSE (CC BY 4.0) | Complete |
| 14 | CITATION.cff | Complete |
| 15 | methodology/constitution-v1.md | Complete |
| 16 | methodology/personas-v1.md | Complete |
| 17 | methodology/ovs-rubric-v1.md | Complete |
| 18 | methodology/evidence-boundary-v1.md | Complete |
| 19 | methodology/council-process-v1.md | Complete |
| 20 | schema/evidence-manifest-schema.json | Complete |
| 21 | schema/council-output-schema.json | Complete |
| 22 | cases/torcetrapib/README.md | Complete |
| 23 | cases/torcetrapib/evidence-manifest.json | Complete |
| 24 | cases/torcetrapib/council-output.json | Complete |
| 25 | validation/library-summary.md | Complete |
| 26 | validation/reproducibility-notes.md | Complete |

### Demo Environment

| # | Asset | Format | Location | Status Target |
|---|---|---|---|---|
| 27 | Demo environment (5 components) | Web (hosted) | demo.agenthink.ai or GitHub Pages | Complete |
| 28 | Demo walkthrough video (3–5 minutes) | MP4 | Secure link | Optional (nice-to-have) |

### Internal Documents (not shared with prospects)

| # | Asset | Format | Location | Status Target |
|---|---|---|---|---|
| 29 | Outreach email template — Recursion | DOCX | Internal folder | Complete |
| 30 | Outreach email template — IQVIA | DOCX | Internal folder | Complete |
| 31 | Target contact list (Recursion, Insilico, Medpace, IQVIA) | XLSX | Internal folder | Complete |
| 32 | Pre-specification: Cases 11–50 | PDF | Internal folder | Draft complete |
| 33 | Reproducibility Study Report | PDF | Internal folder | Complete |
| 34 | Case Selection Disclosure Statement (CSDS-001) | PDF | Internal folder | Complete |
| 35 | Launch Readiness Audit (this document) | PDF | Internal folder | Complete |
| 36 | 28-Day Credibility Sprint (this document) | PDF | Internal folder | Complete |

**Total assets at Day 28: 36 items (26 complete, 10 in progress at Day 0 → all 36 complete at Day 28).**

---

## PART 8 — FINAL READINESS RE-SCORE

### Projected Scores at Day 28

| Dimension | Day 0 Score | Day 28 Score | Change | Key Driver |
|---|---|---|---|---|
| Product | 62/100 | 72/100 | +10 | Demo environment complete; reproducibility data available |
| Validation | 38/100 | 58/100 | +20 | Independent validation complete; reproducibility study complete |
| Governance | 31/100 | 65/100 | +34 | Evidence manifests complete; GitHub published; disclosures added |
| Regulatory | 12/100 | 32/100 | +20 | Disclosures added; limitations documented; EBS-001 published |
| Security | 18/100 | 28/100 | +10 | Legal package complete; penetration test brief drafted |
| Commercial | 55/100 | 78/100 | +23 | Sales deck complete; demo ready; outreach templates ready |
| Procurement Readiness | 22/100 | 52/100 | +30 | PAT-001 and DPAT-001 complete; NDA ready |
| Referenceability | 0/100 | 15/100 | +15 | Independent reviewer named; Review Opinion published |
| **Composite** | **30/100** | **50/100** | **+20** | |

The composite score moves from 30/100 (not ready) to 50/100 (conditionally ready for exploratory outreach). It does not reach 70/100 (ready for enterprise procurement) because the P1 gaps that require 8–12 weeks (SOC 2, penetration test, peer review, prospective validation) are not addressable in 28 days.

### Response Probability Predictions

| Target | Day 0 Probability | Day 28 Probability | Change | Primary Driver |
|---|---|---|---|---|
| **Recursion Pharmaceuticals** | 15–20% | 40–55% | +25–35% | Sales deck + demo + GitHub methodology + independent validation |
| **Insilico Medicine** | 10–15% | 30–45% | +20–30% | Same as Recursion; AI-native culture reduces procurement friction |
| **Medpace** | 10–15% | 35–50% | +25–35% | CRO model means pilot is a service purchase, not an enterprise procurement |
| **IQVIA** | 10–15% | 25–35% | +15–20% | Partnership framing reduces procurement barrier; but IQVIA is large and slow |
| **Roche** | 3–5% | 8–15% | +5–10% | Independent validation is the key unlock; but Roche requires more than 1 case |

**Important caveat:** These probabilities represent the likelihood of receiving a substantive response (a meeting request or a request for more information) — not the likelihood of signing a pilot agreement. The conversion from response to pilot agreement is a separate process that depends on the quality of the meeting, the relevance of the proposed case, and the internal champion at the target company.

### What Day 28 Does Not Fix

The 28-day sprint closes the P0 blockers and makes significant progress on P1 blockers. It does not close the following gaps, which remain open at Day 28:

The LLM contamination risk is disclosed but not remediated. The evidence corpus architecture (Tier 2) requires 3–4 months of engineering work. Any scientific reviewer who presses on this point will not be fully satisfied by the disclosure alone. The answer to "Can you prove the model didn't know the answer?" remains "No, but we've disclosed the limitation and here is our remediation plan."

The case selection bias is disclosed but not remediated. The pre-specification document for Cases 11–50 is a draft at Day 28. It is not published, not peer-reviewed, and not independently verified. A Big Four diligence team will note this.

The security posture is documented but not tested. The penetration test brief is drafted but the test has not been commissioned. SOC 2 Type II is not in progress. These gaps are not blocking for a public-data retrospective pilot, but they will be raised in any enterprise procurement process.

The validation library has one independently validated case (torcetrapib). The other nine cases are self-assessed. A scientific reviewer will ask about the other nine. The answer is: "We are commissioning independent validation for the next two cases. The full library will be independently validated by Month 6."

### The Honest Assessment at Day 28

At Day 28, AgenThink is ready to have a credible first conversation with Recursion, Insilico, and Medpace. It is not ready to have a credible first conversation with Roche or Novartis. The difference is not the quality of the product. The difference is the procurement threshold. Recursion and Medpace will evaluate the methodology on its merits and decide based on scientific interest. Roche and Novartis will route the inquiry through a procurement process that requires SOC 2, a DPA, legal review, and multiple internal approvals before a pilot can begin.

The recommended sequence remains: Recursion first (Day 29), Insilico and Medpace in Week 5–6, IQVIA in Week 8 (partnership framing), Roche and Novartis in Week 12–16 (after first pilot signed and independent validation of two cases complete).

---

*AgenThink Pharma — 28-Day Credibility Sprint*  
*Day 0: June 15, 2026 | Day 28: July 13, 2026*  
*Classification: Internal Board Document — Confidential*  
*Standard: Board-Ready Execution Package*
