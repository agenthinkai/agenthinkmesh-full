# AgenThink Pharma — Launch Readiness Audit

**Classification:** Internal Board Document — Confidential  
**Date:** Day 0 — June 2026  
**Purpose:** Commercial go/no-go determination for outbound pharmaceutical outreach  
**Standard:** Big Four Transaction Advisory Quality  
**Author:** AgenThink Strategic Review

---

> **THE BET:** Pharmaceutical companies will pay for a structured, auditable, multi-persona governance council that identifies Phase II → Phase III advancement risks — if and only if AgenThink can prove the methodology is credible before the first meeting ends.

---

## OVERALL VERDICT

> **GO WITH LIMITATIONS**

Outreach should begin in **3–4 weeks**, not tomorrow. The gap between today and launch-ready is not a product gap. It is a credibility gap. Four specific assets — none of which require engineering — close that gap. The company that waits for 50 cases or peer review will wait 18 months and lose the first-mover window. The company that emails Roche tomorrow will be dismissed in 48 hours.

The correct answer is Option B: complete 3–5 specific actions, then launch.

---

## PART 1 — LAUNCH READINESS SCORE

### Dimension Scores

| Dimension | Score | Status | Primary Reason |
|---|---|---|---|
| **Product** | 62/100 | 🟡 AMBER | Council engine operational; evidence corpus not verifiable; no RAG |
| **Validation** | 38/100 | 🔴 RED | 10 cases; no independent validation; no reproducibility data; no peer review |
| **Governance** | 31/100 | 🔴 RED | Prompt-instruction evidence boundary; no corpus locking; LLM contamination undisclosed in reports |
| **Regulatory** | 12/100 | 🔴 RED | No GxP; no 21 CFR Part 11; no FDA/EMA engagement; no regulatory position document |
| **Security** | 18/100 | 🔴 RED | No SOC 2 Type II; no penetration test; no DPA template; no ISQ |
| **Commercial** | 55/100 | 🟡 AMBER | GTM strategy complete; no sales deck; no demo environment; no signed pilots |
| **Procurement Readiness** | 22/100 | 🔴 RED | No MSA; no DPA; no SOC 2; no insurance certificates on file; no vendor registration |
| **Referenceability** | 0/100 | 🔴 RED | Zero reference customers; zero signed pilots; zero independent validators on record |

### Composite Score: **30/100**

### Score Interpretation

A composite score of 30/100 means AgenThink is not ready for enterprise outreach to Roche, Novartis, or Pfizer. It is ready for exploratory conversations with innovation-oriented targets (Recursion, Insilico, Exscientia) who evaluate methodology on scientific merit rather than procurement compliance.

The score is not a reflection of product quality. The council engine works. The score reflects the gap between what the product can do and what a pharmaceutical company's procurement, legal, regulatory, and scientific teams will require before signing a pilot agreement.

### Score by Buyer Type

| Buyer Type | Minimum Score Required | Current Score | Gap |
|---|---|---|---|
| AI-native biotech (Recursion, Insilico) | 35–45 | 30 | **−5 to −15** |
| Mid-size CRO (Medpace, Fortrea) | 45–55 | 30 | **−15 to −25** |
| Large CRO (IQVIA, ICON, Parexel) | 55–65 | 30 | **−25 to −35** |
| Big Pharma (Roche, Novartis, Pfizer, AZ) | 65–75 | 30 | **−35 to −45** |
| Big Four (Deloitte, EY) | 60–70 | 30 | **−30 to −40** |
| FDA/EMA engagement | 80+ | 30 | **−50+** |

The gap to AI-native biotech is closeable in 3–4 weeks. The gap to Big Pharma is closeable in 12–16 weeks. The gap to FDA/EMA is 18–24 months.

---

## PART 2 — CRITICAL BLOCKERS

### Top 10 Blockers

The following 10 blockers are ranked by the product of Severity × Likelihood. Each is assessed for ease of resolution.

---

**Blocker 1 — LLM Training Data Contamination**

*Severity: CRITICAL | Likelihood: CERTAIN | Ease of Fix: HARD (long-term) / EASY (disclosure)*

The model used to run the council was trained on data that almost certainly includes post-decision information about every case in the library. Torcetrapib, sofosbuvir, aducanumab — all are extensively documented in the public literature. The model cannot be prevented from using this knowledge by a prompt instruction alone. This is not a theoretical risk. It is a structural limitation of every LLM-based retrospective validation system.

The fix has two components: (1) immediate disclosure in every case report and every external communication — this takes one week and costs nothing; (2) architectural remediation via a RAG system that restricts the model to a verified pre-cutoff document corpus — this takes 6–12 months and costs significant engineering resources.

Failing to disclose this limitation before the first meeting with a sophisticated buyer is the single fastest way to permanently damage credibility. A Roche or Novartis scientific reviewer will raise this in the first five minutes. If AgenThink has not already disclosed it, the meeting ends.

---

**Blocker 2 — No Independent Validation**

*Severity: CRITICAL | Likelihood: CERTAIN | Ease of Fix: MEDIUM (6–10 weeks)*

Every performance metric in the library is self-reported. AgenThink built the methodology, selected the cases, ran the council, scored the outcomes, and wrote the reports. No external pharmaceutical expert has reviewed a single case. This is the definition of non-independent validation.

A Big Four diligence team will not cite self-reported metrics. A pharmaceutical company's scientific advisory board will not accept self-reported metrics. A peer-reviewed journal will not publish self-reported metrics. The fix requires identifying three external pharmaceutical experts with no affiliation to AgenThink, having them independently score at least three cases using a pre-specified rubric, and publishing the results. This takes 6–10 weeks and costs $15,000–$40,000 in expert fees.

---

**Blocker 3 — No Published Methodology**

*Severity: HIGH | Likelihood: CERTAIN | Ease of Fix: EASY (3–4 weeks)*

The exact prompts, model version, temperature settings, constitutional rules, and persona definitions are not publicly available. Any sophisticated buyer will ask: "Can I read the methodology?" The current answer is no. This makes every claim unverifiable.

The fix is a public GitHub repository containing the full methodology documentation. This does not require engineering. It requires writing. It takes 3–4 weeks and costs nothing.

---

**Blocker 4 — No Minimum Viable Legal Package**

*Severity: HIGH | Likelihood: CERTAIN | Ease of Fix: EASY (2–3 weeks)*

There is no master services agreement template, no data processing agreement, no pilot agreement, and no terms of service. The moment a buyer says "send me your standard agreement," the conversation stalls. This is a procurement blocker, not a scientific one.

The fix is a legal review of a standard MSA-lite template adapted for an AI advisory tool. This takes 2–3 weeks and costs $5,000–$15,000 in legal fees.

---

**Blocker 5 — No Demo Environment**

*Severity: HIGH | Likelihood: HIGH | Ease of Fix: MEDIUM (3–5 weeks)*

There is no live demo environment. A buyer who asks "can you show me how it works?" currently receives a PDF. A PDF is not a demo. A demo is a live, interactive session where the buyer watches the council deliberate on a case they recognise.

The fix is a scripted demo environment: a pre-loaded case (torcetrapib), a live council run, and a real-time Institutional Proof Report generation. This takes 3–5 weeks and requires engineering resources.

---

**Blocker 6 — No Reproducibility Data**

*Severity: HIGH | Likelihood: HIGH | Ease of Fix: MEDIUM (4–6 weeks)*

The council has been run once per case. There is no evidence that running the council again on the same case produces the same result. A statistician or scientific reviewer will ask: "What is the test-retest reliability?" The current answer is: unknown.

The fix is running each of the 10 completed cases 10 times and reporting the verdict agreement rate. This takes 4–6 weeks and costs LLM API fees (estimated $500–$2,000).

---

**Blocker 7 — No Security Package**

*Severity: HIGH | Likelihood: CERTAIN for enterprise buyers | Ease of Fix: MEDIUM (4–8 weeks)*

No SOC 2 Type II, no penetration test report, no data processing agreement. Every enterprise buyer — pharma, CRO, Big Four — will require at minimum a completed security questionnaire and a DPA before any data is shared. Without these, the procurement process cannot begin.

The fix for the immediate term (4–8 weeks) is a penetration test, a completed ISQ, and a DPA template. SOC 2 Type II takes 6–12 months.

---

**Blocker 8 — Case Selection Bias Undisclosed**

*Severity: HIGH | Likelihood: HIGH | Ease of Fix: EASY (1–2 weeks)*

The 10 cases were selected by the team that built the methodology. They include the most famous pharmaceutical failures in the literature. The selection criteria were not pre-specified. This is selection bias, and it is not currently disclosed in the library documentation.

The fix is a one-paragraph disclosure in every case report and the cumulative library document, acknowledging that the initial 10 cases were selected post-hoc from well-known historical cases and that pre-specified selection criteria will be applied to Cases 11–50.

---

**Blocker 9 — Verubecestat Failure Not Adequately Contextualised**

*Severity: MEDIUM | Likelihood: HIGH | Ease of Fix: EASY (1 week)*

The council issued a GO verdict on verubecestat, which failed Phase III. The failure is documented, but the proposed fix (PC-011 constitutional amendment) has not been validated against out-of-sample cases. A buyer who reads the library will ask: "You failed on one case and then changed the rules. How do I know you won't keep changing the rules every time you're wrong?"

The fix is a clear statement in the library documentation: PC-011 is proposed, not ratified; it will not be applied to any case until validated against 5 out-of-sample Alzheimer's cases; the verubecestat failure is a genuine failure, not a methodology error.

---

**Blocker 10 — No Reference Customer or Named Validator**

*Severity: HIGH | Likelihood: CERTAIN | Ease of Fix: HARD (3–6 months)*

There are zero reference customers, zero signed pilots, and zero named independent validators. In pharmaceutical enterprise sales, the first reference customer is the hardest to acquire and the most valuable asset. Without one, every conversation is a first-principles credibility argument.

The fix is a 30-day pilot with a willing partner at below-cost pricing. The most likely first partner is an AI-native biotech (Recursion, Insilico, Exscientia) or a mid-size CRO (Medpace) who evaluates on scientific merit rather than procurement compliance. This takes 3–6 months.

### Blocker Priority Matrix

| Blocker | Severity | Likelihood | Fix Time | Fix Cost | Priority |
|---|---|---|---|---|---|
| LLM contamination disclosure | CRITICAL | CERTAIN | 1 week | $0 | **P0** |
| No published methodology | HIGH | CERTAIN | 3–4 weeks | $0 | **P0** |
| No legal package | HIGH | CERTAIN | 2–3 weeks | $5–15K | **P0** |
| No independent validation | CRITICAL | CERTAIN | 6–10 weeks | $15–40K | **P1** |
| No demo environment | HIGH | HIGH | 3–5 weeks | Engineering | **P1** |
| Case selection bias undisclosed | HIGH | HIGH | 1–2 weeks | $0 | **P1** |
| Verubecestat contextualisation | MEDIUM | HIGH | 1 week | $0 | **P1** |
| No reproducibility data | HIGH | HIGH | 4–6 weeks | $500–2K | **P2** |
| No security package | HIGH | CERTAIN | 4–8 weeks | $10–25K | **P2** |
| No reference customer | HIGH | CERTAIN | 3–6 months | Below-cost pilot | **P3** |

---

## PART 3 — FIRST EMAIL TEST

*Scenario: AgenThink sends an outreach email tomorrow to Roche, Novartis, AstraZeneca, Recursion, and IQVIA.*

*The email describes the council methodology, references the 10-case library, and proposes a 30-day retrospective pilot.*

---

### Roche (Basel / Pharma R&D)

**Probability of response: 5–10%**

**Why they might engage:** Roche has one of the most sophisticated R&D governance cultures in the industry. If the email reaches the right person in the Pharma R&D innovation team or the Governance & Risk function, the concept of a structured multi-persona governance council for Phase II → III decisions is genuinely interesting to them. Roche has invested in AI-assisted drug discovery (Flatiron, Foundation Medicine) and is not philosophically opposed to AI governance tools.

**Why they ignore (most likely):** The email arrives in a generic inbox. No named contact. No warm introduction. No peer-reviewed publication. No reference customer. Roche receives hundreds of AI vendor pitches per month. Without a warm introduction from a known contact or a publication that their scientific team has already read, the email is filtered as vendor noise. Probability: 70%.

**Why they reject:** If the email reaches a scientific reviewer, the first question is: "Can you prove the model didn't know the answer?" The current answer is no. The second question is: "Who has independently validated this?" The current answer is no one. The third question is: "Where is the methodology published?" The current answer is nowhere. Three no's in the first five minutes ends the conversation permanently. Probability: 20%.

**Assessment:** Do not email Roche tomorrow. Email Roche in 12–16 weeks, after independent validation of at least 3 cases and methodology publication. The cost of a premature Roche approach is not just a failed email — it is a permanently closed door at one of the highest-value targets.

---

### Novartis (Basel / Institutes for BioMedical Research)

**Probability of response: 5–10%**

**Why they might engage:** Novartis NIBR has a strong culture of methodological innovation. The Novartis AI Innovation Lab has been active since 2019. If the email reaches someone in the NIBR governance or R&D strategy function, the concept is relevant. Novartis has also been publicly vocal about the need for better Phase II → III decision frameworks following several high-profile failures.

**Why they ignore:** Same structural reasons as Roche. No warm introduction, no publication, no reference customer. Novartis procurement requires SOC 2 Type II before any vendor can process data. The pilot cannot begin without it. Probability: 75%.

**Why they reject:** Novartis has an internal AI governance committee that reviews all AI tools used in clinical development. The committee will ask for the full methodology documentation, the independent validation report, and the regulatory position document. None of these exist. Probability: 20%.

**Assessment:** Do not email Novartis tomorrow. Same timeline as Roche: 12–16 weeks minimum.

---

### AstraZeneca (Cambridge / R&D)

**Probability of response: 10–15%**

**Why they might engage:** AstraZeneca has been more publicly aggressive in AI adoption than Roche or Novartis. The AZ AI and Data Science team has published on AI-assisted clinical development. AZ has a known interest in governance tools following the COVID-19 vaccine regulatory complexity. There is a slightly higher probability that the email reaches someone with both the authority and the inclination to engage.

**Why they ignore:** AZ receives a high volume of AI vendor pitches. Without a named contact or warm introduction, the probability of reaching the right person is low. Probability: 65%.

**Why they reject:** AZ's procurement team will ask for SOC 2 Type II, a DPA, and a completed ISQ before any pilot can begin. None of these exist. The scientific team will ask for the published methodology. It does not exist. Probability: 20%.

**Assessment:** AstraZeneca is a slightly better first-contact target than Roche or Novartis due to its AI culture, but the same structural blockers apply. A warm introduction through the AZ AI and Data Science network would materially change the probability. Without one, do not email tomorrow.

---

### Recursion Pharmaceuticals (Salt Lake City)

**Probability of response: 25–35%**

**Why they might engage:** Recursion is an AI-native drug discovery company. Their entire value proposition is that AI can improve pharmaceutical development decisions. They are philosophically aligned with the council concept. They have a smaller procurement bureaucracy than Big Pharma. The scientific team makes faster decisions. They are the most likely first responder of the five targets.

**Why they ignore:** Recursion has its own internal AI governance tools and a sophisticated data science team. They may view the council as redundant with their existing capabilities. They may also be concerned about the evidence boundary limitation — Recursion's scientific team is technically sophisticated enough to identify it immediately. Probability: 45%.

**Why they reject:** If the email reaches the wrong person (commercial rather than scientific), it is filtered as a vendor pitch. If it reaches the right person (Head of R&D, Chief Scientific Officer), the response is more likely to be a meeting than a rejection. Probability: 20%.

**Assessment:** Email Recursion in 3–4 weeks, after the P0 blockers are resolved (disclosure, methodology published, legal package). This is the highest-probability first engagement. A Recursion pilot would generate the reference customer needed for all subsequent outreach.

---

### IQVIA (Durham, NC)

**Probability of response: 15–20%**

**Why they might engage:** IQVIA is a data and analytics company, not a drug developer. They are actively building an AI services portfolio. A governance council tool that they can white-label and offer to their pharma clients is commercially interesting. The business development team at IQVIA is incentivised to find new service offerings. If the email reaches BD rather than procurement, the response probability is higher.

**Why they ignore:** IQVIA's procurement process for new technology vendors is extensive. They will require SOC 2 Type II, a DPA, a completed ISQ, and a reference customer before any commercial discussion. Without these, the conversation stalls at the procurement stage even if the BD team is interested. Probability: 55%.

**Why they reject:** If IQVIA's scientific team reviews the methodology, they will identify the same limitations as any other sophisticated buyer. Additionally, IQVIA may view the council as a potential competitor to their own advisory services rather than a complementary tool. Probability: 25%.

**Assessment:** IQVIA is a viable target for a partnership conversation (white-label, not pilot) in 8–12 weeks. The partnership angle is more compelling than the pilot angle for IQVIA — they are a distributor, not an end user. Do not pitch a pilot to IQVIA. Pitch a partnership.

---

## PART 4 — MINIMUM VIABLE CREDIBILITY PACKAGE

*The following assets are required before outreach. Each is assessed against the question: "Would the absence of this asset kill a first meeting with a sophisticated buyer?"*

### MUST HAVE (Required before any outreach)

**1. LLM Training Data Limitation Disclosure Statement**
A one-paragraph standard disclosure that appears in every case report, every external communication, and the methodology documentation. States clearly: the LLM used to run the council was trained on data that may include post-decision information; the evidence boundary is enforced by prompt instruction at Tier 1; this limitation is being mitigated by the Tier 2 and Tier 3 architecture roadmap. *Timeline: 1 week. Cost: $0.*

**2. Published Methodology Document**
A public GitHub repository containing: exact system prompts for each persona, model version and temperature settings, constitutional rules (verbatim), persona definitions, Evidence Manifest schema, OVS rubric, and case execution protocol. Without this, every claim is unverifiable. *Timeline: 3–4 weeks. Cost: $0.*

**3. Case Selection Bias Disclosure**
A one-paragraph statement in the library documentation acknowledging that the initial 10 cases were selected post-hoc from well-known historical cases and that pre-specified selection criteria will be applied to Cases 11–50. *Timeline: 1 week. Cost: $0.*

**4. Pilot Agreement Template (MSA-Lite)**
A 5–8 page pilot agreement covering: scope, deliverables, timeline, pricing, IP ownership (client owns all outputs), data processing terms (no proprietary data used in retrospective pilot), liability limitation, and termination. *Timeline: 2–3 weeks. Cost: $5,000–$15,000 in legal fees.*

**5. Data Processing Agreement Template**
A standard DPA covering GDPR and HIPAA requirements, data residency, breach notification, and sub-processor disclosure. Required before any client data is processed. *Timeline: 2 weeks. Cost: $3,000–$8,000 in legal fees.*

**6. One-Page Evidence Boundary Statement**
A standalone document (not buried in a case report) that explains the evidence boundary in plain language: what was admitted, what was excluded, how the cutoff date was determined, and what the current limitations are. *Timeline: 1 week. Cost: $0.*

**7. Sales Deck (12–15 slides)**
A board-quality presentation covering: the problem (Phase II → III advancement decisions), the solution (structured multi-persona council), the evidence (10-case library summary with honest limitations), the pilot offer (30-day, one case, fixed fee), and the ask (30-minute call). *Timeline: 2–3 weeks. Cost: $0 (internal) or $5,000–$15,000 (design agency).*

### SHOULD HAVE (Required before first meeting, not before outreach)

**8. Demo Environment**
A live, interactive demo that shows a council deliberation in real time. The minimum viable version is a scripted walkthrough of the torcetrapib case with a live council run. *Timeline: 3–5 weeks. Cost: Engineering resources.*

**9. Independent Expert Validation (1 case)**
One external pharmaceutical expert (no AgenThink affiliation) who has reviewed the torcetrapib case and confirmed: (a) the evidence corpus was restricted to pre-decision information, and (b) the council identified at least one material risk factor. This person's name and title appear in the case report. *Timeline: 6–8 weeks. Cost: $5,000–$15,000 in expert fees.*

**10. Reproducibility Data (1 case)**
10 reruns of the torcetrapib case with verdict agreement rate reported. Minimum acceptable: ≥80% agreement. *Timeline: 4–6 weeks. Cost: $200–$500 in LLM API fees.*

**11. Penetration Test Report**
A basic penetration test of the council engine and report generation system. Required before any client data is processed. *Timeline: 4–6 weeks. Cost: $5,000–$15,000.*

**12. Insurance Certificates**
Professional liability and general commercial liability insurance certificates. Required by most enterprise procurement teams before vendor onboarding. *Timeline: 2–3 weeks. Cost: $3,000–$8,000/year.*

### NICE TO HAVE (Strengthens credibility but not blocking)

**13. Preprint (arXiv or SSRN)**
A preprint of the methodology paper. Demonstrates academic seriousness. Not required for a first meeting but materially increases credibility with scientific buyers. *Timeline: 8–12 weeks. Cost: $0.*

**14. Advisory Board Member (Named)**
One named pharmaceutical industry advisor (former VP R&D, former FDA reviewer, or similar) who has reviewed the methodology and is willing to be named. *Timeline: 4–12 weeks. Cost: Equity or advisory fee.*

**15. Video Demo (3–5 minutes)**
A recorded walkthrough of the council deliberation and report generation. Useful for email outreach where a live demo is not possible. *Timeline: 2–3 weeks after demo environment is ready. Cost: $1,000–$5,000.*

**16. SOC 2 Type II (in progress)**
Evidence that SOC 2 Type II audit has been initiated. Not required for the pilot but demonstrates enterprise readiness. *Timeline: 6–12 months. Cost: $30,000–$80,000.*

**17. Peer-Reviewed Publication (submitted)**
Evidence that a peer-reviewed submission has been made. Not required for a first meeting but required for any enterprise contract above $500K ACV. *Timeline: 12–18 months. Cost: $0 (open access) or $2,000–$5,000 (journal fees).*

---

---

## PART 5 — FIRST PILOT READINESS

*Can AgenThink execute a 30-day retrospective pilot today, starting from a signed agreement?*

### Assessment: PARTIALLY READY — with 4 gaps that must be resolved before execution

The council engine can run. The Institutional Proof Report can be generated. The case execution protocol exists. These are the core components of a 30-day pilot. However, four gaps make it impossible to deliver a pilot that a pharmaceutical client would consider credible.

### Staffing Assessment

| Role | Required | Available | Gap |
|---|---|---|---|
| Evidence Curator | 40 hours (5 days) | Unknown — no dedicated resource identified | **GAP** |
| Council Operator | 8 hours (1 day) | Available (engineering team) | Ready |
| Project Manager | 20 hours (2.5 days) | Unknown — no dedicated resource identified | **GAP** |
| External Expert Reviewer | 16 hours (2 days) | Not identified | **GAP** |
| Legal / Contract | 8 hours (1 day) | Not available internally | **GAP** |

The staffing gap is the most immediately limiting constraint. A 30-day pilot requires a dedicated Evidence Curator — someone with pharmaceutical development knowledge who can identify, retrieve, and date-verify the pre-cutoff evidence corpus for the client's case. This person does not currently exist as a named, available resource.

**Fix:** Identify and contract an Evidence Curator before accepting a pilot engagement. This is a freelance or part-time role. Estimated cost: $5,000–$15,000 per pilot. Timeline to fill: 2–4 weeks.

### Expertise Assessment

| Expertise Area | Required | Available | Gap |
|---|---|---|---|
| Pharmaceutical development (Phase II/III) | Required for evidence curation | Not available internally | **GAP** |
| Regulatory affairs | Required for constitutional rule application | Not available internally | **GAP** |
| LLM/AI engineering | Required for council operation | Available | Ready |
| Project management | Required for client delivery | Partially available | PARTIAL |
| Scientific writing | Required for report quality | Partially available | PARTIAL |

The expertise gap is significant. AgenThink is an AI company, not a pharmaceutical company. The council's value proposition is that it brings pharmaceutical expertise to the governance process. But the Evidence Curator, the constitutional rule application, and the report quality review all require pharmaceutical development expertise that does not currently exist inside the company.

**Fix:** Contract a pharmaceutical development consultant (former CRO director, former pharma R&D VP, or similar) as an Evidence Curator and expert reviewer for the first pilot. This person also serves as the independent validator. Estimated cost: $15,000–$40,000 for the first pilot. This is a feature, not a bug — the external expert adds credibility to the pilot output.

### Data Requirements Assessment

| Requirement | Status | Notes |
|---|---|---|
| Client provides case selection | Client responsibility | Included in pilot agreement |
| Client provides Phase III advancement decision date | Client responsibility | Included in pilot agreement |
| AgenThink constructs evidence corpus | AgenThink responsibility | Requires Evidence Curator |
| Client approves evidence corpus | Client responsibility | Requires 4 hours of client expert time |
| Evidence corpus locked before council run | AgenThink responsibility | Tier 1: manual; Tier 2: automated (not yet built) |

The data requirements are manageable for a retrospective pilot using public data. The constraint is the Evidence Curator capacity, not the data availability.

**Note:** If the client wants to include proprietary Phase II data in the evidence corpus, a DPA is required before any data is shared. The DPA does not currently exist.

### Legal Requirements Assessment

| Requirement | Status | Gap |
|---|---|---|
| Pilot agreement (MSA-lite) | Does not exist | **BLOCKING** |
| Data processing agreement | Does not exist | **BLOCKING if proprietary data** |
| IP ownership clause | Not documented | **BLOCKING** |
| Liability limitation | Not documented | **BLOCKING** |
| Confidentiality agreement | Standard NDA available | Ready |

No pilot can begin without a signed pilot agreement. The pilot agreement does not exist. This is the fastest-to-fix blocking gap: 2–3 weeks and $5,000–$15,000 in legal fees.

### Security Requirements Assessment

| Requirement | Status | Gap |
|---|---|---|
| No proprietary data used (retrospective pilot) | Confirmed | Ready |
| Standard cloud infrastructure | Available | Ready |
| Penetration test report | Does not exist | **GAP (not blocking for public-data pilot)** |
| SOC 2 Type II | Does not exist | **BLOCKING for enterprise procurement** |
| DPA | Does not exist | **BLOCKING if proprietary data** |

For a retrospective pilot using only public data, the security requirements are manageable. The pilot agreement must explicitly state that no proprietary data is used. SOC 2 Type II is not required for a public-data retrospective pilot, but it is required before any enterprise procurement process can begin.

### 30-Day Pilot Readiness Score: **45/100**

The pilot can be executed in concept. It cannot be executed in a way that a pharmaceutical client would consider credible without resolving the staffing, expertise, and legal gaps. The minimum time to pilot-ready is **4–6 weeks** from today.

---

## PART 6 — RECOMMENDED SEQUENCE

### Option Analysis

**Option A — Start outreach immediately**

*Verdict: NO.*

The P0 blockers (LLM contamination undisclosed, no published methodology, no legal package) are not resolved. Emailing Roche or Novartis tomorrow produces one of two outcomes: the email is ignored (70% probability) or the email reaches a scientific reviewer who identifies the limitations and permanently closes the door (20% probability). The 10% probability of a positive response does not justify the 20% probability of permanent reputational damage at the highest-value targets.

**Option B — Complete 3–5 specific actions first**

*Verdict: YES. This is the recommended option.*

The P0 blockers can be resolved in 3–4 weeks. The SHOULD HAVE assets can be completed in 8–12 weeks. Outreach to Recursion and Medpace (the highest-probability first responders) begins in Week 4. Outreach to IQVIA (partnership angle) begins in Week 8. Outreach to Roche, Novartis, AstraZeneca, and Pfizer begins in Week 12–16.

**Option C — Wait until 50-case validation library**

*Verdict: NO.*

A 50-case library takes 12–18 months to complete. The first-mover window in AI-assisted pharmaceutical governance is open now. Waiting 18 months cedes the category to competitors. The 10-case library is sufficient for exploratory conversations with the right targets. The 50-case library is required for enterprise contracts, not first meetings.

**Option D — Wait until prospective evidence**

*Verdict: NO.*

Prospective evidence requires running the council on current Phase II drugs without knowing the outcome, then waiting for Phase III results. This takes 3–7 years. No commercial strategy can be built on a 3–7 year validation timeline.

### Recommended Sequence: Option B

**Weeks 1–2 (P0 blockers):**
1. Add LLM contamination disclosure to all 10 case reports and all external documents
2. Add case selection bias disclosure to the library documentation
3. Add verubecestat contextualisation (PC-011 proposed, not ratified)
4. Begin legal package drafting (pilot agreement + DPA)

**Weeks 3–4 (P0 completion + outreach preparation):**
5. Publish methodology on GitHub
6. Complete pilot agreement and DPA
7. Build sales deck (12–15 slides)
8. Identify and contract Evidence Curator
9. Begin outreach to Recursion (first email)

**Weeks 5–8 (SHOULD HAVE assets + first meetings):**
10. Commission independent expert validation (torcetrapib case)
11. Run reproducibility study (torcetrapib, 10 reruns)
12. Build demo environment (scripted torcetrapib walkthrough)
13. Begin outreach to Medpace and Insilico
14. First meetings with Recursion (if response received)

**Weeks 9–12 (enterprise preparation + broader outreach):**
15. Complete independent expert validation report
16. Begin outreach to IQVIA (partnership angle)
17. Begin outreach to AstraZeneca
18. Commission penetration test
19. Begin SOC 2 Type II audit process
20. First pilot agreement signed (target: Recursion or Medpace)

**Weeks 13–16 (Big Pharma outreach):**
21. Begin outreach to Roche, Novartis, Pfizer (with independent validation complete)
22. Submit preprint
23. First pilot execution begins

---

## PART 7 — 90-DAY COMMERCIAL PLAN

### Week-by-Week Activities

**Week 1**

*Product:* Add LLM contamination disclosure to all 10 case reports. Add case selection bias disclosure. Add verubecestat contextualisation. *Owner: CEO / Research Lead. Effort: 20 hours.*

*Legal:* Engage legal counsel for pilot agreement and DPA. Provide brief and template. *Owner: CEO. Effort: 4 hours.*

*Commercial:* Define target contact list for Recursion, Insilico, Medpace, Exscientia. Identify named contacts (Head of R&D, Chief Scientific Officer, VP Clinical Development). *Owner: Commercial Lead. Effort: 8 hours.*

*Governance:* Begin retroactive Evidence Manifest for torcetrapib case. *Owner: Research Lead. Effort: 16 hours.*

---

**Week 2**

*Product:* Complete retroactive Evidence Manifest for torcetrapib. Begin manifests for sofosbuvir and semagacestat. *Owner: Research Lead. Effort: 24 hours.*

*Legal:* Review pilot agreement draft. Review DPA draft. *Owner: CEO + Legal Counsel. Effort: 8 hours.*

*Commercial:* Draft outreach email for Recursion (scientific framing, not sales framing). Draft LinkedIn connection request messages for named contacts. *Owner: Commercial Lead. Effort: 8 hours.*

*Governance:* Identify external pharmaceutical expert for independent validation. Send engagement letter. *Owner: CEO. Effort: 8 hours.*

---

**Week 3**

*Product:* Publish methodology on GitHub. Includes: system prompts, model version, constitutional rules, persona definitions, Evidence Manifest schema, OVS rubric. *Owner: Engineering + Research Lead. Effort: 32 hours.*

*Legal:* Finalise pilot agreement and DPA. *Owner: Legal Counsel. Effort: 8 hours.*

*Commercial:* Finalise sales deck (12–15 slides). Internal review. *Owner: Commercial Lead + CEO. Effort: 16 hours.*

*Staffing:* Post Evidence Curator role. Begin interviews. *Owner: CEO. Effort: 8 hours.*

---

**Week 4**

*Commercial:* Send first outreach email to Recursion (named contact: Head of R&D or Chief Scientific Officer). Send LinkedIn connection requests to Insilico and Exscientia contacts. *Owner: Commercial Lead. Effort: 4 hours.*

*Product:* Begin demo environment build (scripted torcetrapib walkthrough). *Owner: Engineering. Effort: 40 hours.*

*Governance:* Begin independent expert validation of torcetrapib case. *Owner: External Expert + Research Lead. Effort: 16 hours (AgenThink) + 8 hours (expert).*

*Staffing:* Select and contract Evidence Curator. *Owner: CEO. Effort: 8 hours.*

---

**Week 5**

*Commercial:* Follow up Recursion outreach (if no response). Send first outreach to Medpace (named contact: VP Clinical Development or Head of Oncology). *Owner: Commercial Lead. Effort: 4 hours.*

*Product:* Continue demo environment build. *Owner: Engineering. Effort: 40 hours.*

*Validation:* Run torcetrapib reproducibility study (10 reruns). Record verdict agreement rate. *Owner: Engineering + Research Lead. Effort: 16 hours.*

---

**Week 6**

*Commercial:* First meeting with Recursion (if response received). Demo walkthrough. Propose 30-day pilot. *Owner: CEO + Research Lead. Effort: 8 hours.*

*Product:* Complete demo environment. Internal testing. *Owner: Engineering. Effort: 24 hours.*

*Validation:* Complete independent expert validation report for torcetrapib. Publish reproducibility data. *Owner: External Expert + Research Lead. Effort: 16 hours.*

---

**Week 7**

*Commercial:* Send first outreach to Insilico Medicine. Send first outreach to IQVIA (partnership framing, not pilot framing). *Owner: Commercial Lead. Effort: 4 hours.*

*Product:* Demo environment live. Record 3–5 minute video walkthrough. *Owner: Engineering + Commercial Lead. Effort: 16 hours.*

*Validation:* Begin independent expert validation of sofosbuvir case (second case). *Owner: External Expert + Research Lead. Effort: 8 hours.*

---

**Week 8**

*Commercial:* Follow up Medpace and Insilico. First meeting with IQVIA (if response received). Partnership discussion. *Owner: CEO + Commercial Lead. Effort: 8 hours.*

*Legal:* Finalise insurance certificates. Complete penetration test brief. *Owner: CEO + Legal. Effort: 4 hours.*

*Governance:* Complete Evidence Manifests for all 10 cases. Publish manifest index on GitHub. *Owner: Research Lead. Effort: 24 hours.*

---

**Week 9**

*Commercial:* Send first outreach to AstraZeneca (named contact: AI and Data Science team or R&D Governance). *Owner: Commercial Lead. Effort: 4 hours.*

*Security:* Commission penetration test. *Owner: Engineering. Effort: 8 hours (briefing).*

*Validation:* Complete independent expert validation of sofosbuvir case. Publish updated validation report. *Owner: External Expert + Research Lead. Effort: 8 hours.*

*Commercial:* Pilot agreement negotiation with Recursion or Medpace (if meeting held). *Owner: CEO + Legal. Effort: 16 hours.*

---

**Week 10**

*Commercial:* First pilot agreement signed (target: Recursion or Medpace). Pilot execution begins. *Owner: CEO + Evidence Curator. Effort: 40 hours.*

*Security:* Penetration test in progress. *Owner: External Security Firm.*

*Governance:* Begin SOC 2 Type II audit process. *Owner: CEO + Engineering. Effort: 16 hours.*

---

**Week 11**

*Commercial:* Pilot execution continues. Weekly status call with client. *Owner: Project Manager + Evidence Curator. Effort: 24 hours.*

*Commercial:* Send first outreach to Roche (named contact: Pharma R&D innovation or Governance function). *Owner: Commercial Lead. Effort: 4 hours.*

*Research:* Begin preprint drafting. *Owner: Research Lead. Effort: 24 hours.*

---

**Week 12**

*Commercial:* Pilot execution complete (if 30-day pilot started Week 10). Deliver Institutional Proof Report to client. Client review meeting. *Owner: CEO + Research Lead. Effort: 16 hours.*

*Commercial:* Send first outreach to Novartis and Pfizer (if Roche response received or independent of it). *Owner: Commercial Lead. Effort: 4 hours.*

*Research:* Preprint draft complete. Internal review. *Owner: Research Lead + CEO. Effort: 16 hours.*

*Security:* Penetration test report received. *Owner: Engineering.*

### 90-Day Milestones

| Milestone | Target Week | Owner | Success Criteria |
|---|---|---|---|
| P0 blockers resolved | Week 3 | CEO + Research Lead | All disclosures added; methodology on GitHub; legal package complete |
| First outreach sent | Week 4 | Commercial Lead | Email sent to Recursion with named contact |
| Demo environment live | Week 6 | Engineering | Live torcetrapib walkthrough operational |
| Independent validation complete (1 case) | Week 6 | External Expert | Named expert confirms evidence boundary and risk identification |
| First meeting held | Week 6–8 | CEO | Meeting with Recursion or Medpace |
| Pilot agreement signed | Week 10 | CEO + Legal | Signed agreement with named client |
| Pilot execution complete | Week 12 | Project Manager | IPR delivered to client; client review meeting held |
| Preprint submitted | Week 12 | Research Lead | Preprint on arXiv or SSRN |
| Penetration test complete | Week 12 | Engineering | Report received; critical findings remediated |

---

## PART 8 — FINAL VERDICT

### "If I were CEO, would I authorise outbound outreach tomorrow?"

**No.**

Not because the product is not ready. The council engine works. The 10-case library is real. The Institutional Proof Report is a genuinely useful governance document. The concept is sound and the market need is real.

No, because the credibility package is not ready. And in pharmaceutical enterprise sales, credibility is the product.

Here is what happens if outreach begins tomorrow. An email arrives in the inbox of a Head of R&D at Roche. The subject line is interesting. They open it. They read the 10-case library claim. They forward it to their scientific advisor. The scientific advisor spends 20 minutes reading the methodology. They ask three questions: "Can you prove the model didn't know the answer?" "Who independently validated this?" "Where is the methodology published?" The current answers are: no, no one, and nowhere. The scientific advisor replies to the Head of R&D: "Not credible. Vendor noise." The door closes. It does not reopen.

That is not a hypothetical. That is the standard operating procedure for AI vendor evaluation at every top-20 pharmaceutical company. The scientific team is the gatekeeper. The scientific team is not impressed by case counts or proof scores. The scientific team asks: "Can I verify this independently?" The current answer is no.

The four weeks between today and launch-ready are not a delay. They are an investment. The LLM contamination disclosure takes one week and costs nothing. The methodology publication takes three weeks and costs nothing. The legal package takes three weeks and costs $8,000–$23,000. These three actions transform the answer to the scientific advisor's questions from "no, no one, nowhere" to "we've disclosed it, it's on GitHub, and here's the pilot agreement." That is the difference between a closed door and a 30-minute call.

The recommended sequence is not cautious. It is strategic. The first-mover window in AI-assisted pharmaceutical governance is open. The window is not closing in four weeks. The window is closing in 12–18 months, when a well-funded competitor with a peer-reviewed publication and a reference customer at Roche enters the market. AgenThink's advantage is not the 10-case library — any competitor can build a 10-case library. AgenThink's advantage is the head start. The head start is worth protecting by not wasting it on premature outreach that permanently closes the doors that matter most.

Begin outreach in four weeks. Target Recursion first. Get one signed pilot. Get one named reference. Then email Roche.

**The bet is simple:** If AgenThink can get one pharmaceutical company to say "the methodology is credible and the council identified a risk we would have missed," the market opens. If AgenThink emails Roche tomorrow and gets dismissed as vendor noise, the market does not close — but the highest-value door does. Four weeks is a small price to protect against that outcome.

**Authorise outreach in Week 4. Not tomorrow.**

---

*AgenThink Pharma Launch Readiness Audit | Day 0 — June 2026*  
*Classification: Internal Board Document — Confidential*  
*Standard: Big Four Transaction Advisory Quality*  
*Verdict: GO WITH LIMITATIONS — Begin outreach Week 4, not Day 0*
