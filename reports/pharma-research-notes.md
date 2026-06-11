# Pharma Research Notes — AgenThink Mesh Vertical Analysis

## Source 1: Tufts CSDD — Quantifying the Value of a Day of Delay in Drug Development (2024)
Authors: Zachary Smith MA, Joseph DiMasi PhD, Kenneth Getz MBA

### Key Data Points
- **Lost sales per day of delay:** ~$800,000 per drug (2023 USD) — down from the widely-cited $4–5M figure (based on 1990s blockbuster era)
- **Cardiovascular drugs:** $1.97M/day mean sales
- **Hematology:** $1.89M/day
- **Immunology/Infectious diseases:** $1.90M/day
- **Oncology:** $1.50M/day median
- **Average daily direct cost to run Phase II/III trial:** ~$40,000/day (2023 USD)
  - Phase III: $23,737/day
  - Phase I: $7,829/day
  - Phase IV: $14,091/day
- **Trend:** Average sales per day declining by $80,000–$100,000 per year as drugs target narrower populations
- **Dataset:** 645 drugs launched since 2000; 409 clinical trial budgets

## Source 2: DiMasi et al. (2016) — Cost per Approved Drug
- **Out-of-pocket cost per approved NME:** $1,395M (2013 USD)
- **Capitalized cost (including cost of capital):** $2,558M (~$2.6B)
- **Post-approval development:** +$312M

## Source 3: Sertkaya et al. (2024) — JAMA Network Open
- **Mean clinical phase cost per drug candidate:** $117.4M
- Lower than most estimates — reflects smaller-scale trials

## Source 4: Global Market Sizes (2024–2026)
- **Global clinical trials market:** ~$80B+ (2024), growing at ~6% CAGR
- **AI-based clinical trials solution provider market:** $3.50B (2026) → $30.15B (2034) [Fortune Business Insights]
- **Pharmacovigilance market:** North America >32% share (2024)
- **AI in pharmacovigilance market:** Growing rapidly — IQVIA, Oracle, Accenture, WNS as leaders

## Source 5: Top Pharma R&D Budgets 2024 (FierceBiotech)
- Merck & Co., J&J, Roche, AstraZeneca, AbbVie, BMS, Eli Lilly, Pfizer
- Combined top-10 R&D spend: ~$150B+/year
- Roche: CHF 11.5B ($12.1B); Novartis: $12.1B

## Source 6: Trial Failure Rates
- Phase I → Phase II success rate: ~63%
- Phase II → Phase III: ~31% (oncology: ~12%)
- Phase III → Approval: ~58%
- **Overall Phase I to Approval: ~12%** (oncology: ~5%)
- 90%+ of drug candidates fail before approval

## Source 7: FDA AI/ML SaMD Framework (finalized December 2024)
- Final guidance: "Marketing Submission Recommendations for a Predetermined Change Control Plan (PCCP)"
- Three submission pathways: 510(k), De Novo, PMA
- ~1,000 AI/ML-powered medical devices cleared by FDA by 2024
- EU AI Act entered force August 2024

## Source 8: EMA Reflection Paper on AI (September 2024)
- Adopted September 2024
- Covers: drug discovery, non-clinical development, clinical trials, manufacturing, post-marketing
- AI/ML in clinical trials must meet ICH E6 (Good Clinical Practice) requirements
- CHMP accepts clinical trial evidence from AI tools supervised by human pathologist

## Key Competitive Landscape
- **Medidata (Dassault Systèmes):** CTMS, eClinical, AI-powered trial design
- **Veeva Systems:** Vault Clinical, Vault Regulatory, Vault Safety — dominant in pharma SaaS
- **Oracle Health Sciences:** Clinical One, Argus Safety, InForm
- **IQVIA:** Decentralized trials, pharmacovigilance, regulatory intelligence
- **Parexel, Covance (Labcorp), ICON:** CRO leaders with AI integration
- **Medidata AI:** Predictive analytics for site selection, patient recruitment
- **Unlearn.ai:** Digital twins for clinical trials
- **Saama Technologies:** AI-powered clinical data analytics
- **Trials.ai / Mendel.ai:** AI for trial matching and protocol optimization

## Regulatory Classification for AgenThink Mesh in Pharma
- **Not SaMD** if used purely for internal investment/governance decisions (no patient-facing outputs)
- **Potentially CDS** if outputs influence trial continuation decisions that affect patient safety
- **SaMD pathway required** if outputs are used to make or support clinical decisions about individual patients
- **Key question:** Is the output a recommendation to an investment committee (NOT regulated) or a recommendation to a clinical investigator (REGULATED)?
- **Safe harbor:** Position as "Institutional Investment Governance Tool" — keeps it outside FDA/EMA clinical device regulation
- **Timeline if SaMD:** 3–5 years, $10–50M for 510(k) or De Novo clearance
- **Timeline if CDS (non-device):** 6–18 months for internal validation and compliance documentation
- **Timeline if investment governance only:** No regulatory clearance required — deploy immediately

## Source 9: FDA CDS Guidance (September 2022, updated December 2024)

### Four Criteria for Non-Device CDS (exempt from FDA regulation):
1. The software does NOT acquire, process, or analyze a medical image, signal, or pattern
2. The software displays, analyzes, or prints medical information that is NOT time-critical
3. The software supports or provides recommendations to a healthcare professional who is able to independently review the basis of the recommendation
4. The software is intended for use by a healthcare professional — NOT for direct patient use

**Key implication for AgenThink Mesh:**
If AgenThink Mesh outputs are directed to an **investment committee** (not a healthcare professional making patient care decisions), the tool falls OUTSIDE the CDS definition entirely. It is not a medical device. No FDA clearance required.

If outputs are used by a clinical investigator to make trial continuation decisions affecting individual patients, it may cross into Device CDS territory.

**Safe positioning:** "Institutional Investment Governance Platform" — outputs go to portfolio managers, investment committees, and governance boards. NOT to physicians or patients. This keeps the product outside FDA jurisdiction entirely.

### FDA Predetermined Change Control Plan (PCCP) — December 2024
- Final guidance issued December 2024
- Allows AI/ML medical devices to update their algorithms without a new 510(k) submission
- Only applies to regulated SaMD — not relevant if AgenThink Mesh is positioned as non-device

## Source 10: EMA Reflection Paper on AI (September 2024)
- Adopted by CHMP September 2024
- Covers AI from drug discovery through post-marketing
- Clinical trial AI must comply with ICH E6 (GCP)
- Requires human oversight and explainability for AI-assisted clinical decisions
- Does NOT regulate investment governance tools
- Key quote: "AI/ML used in clinical trials should meet applicable requirements in the ICH E6 guideline for good clinical practice"

## Source 11: EU AI Act (August 2024)
- Entered force August 2024, phased implementation through 2027
- High-risk AI systems include: medical devices, critical infrastructure, employment decisions
- Investment governance AI = General Purpose AI (GPAI) — lower risk tier
- Compliance requirements for GPAI: transparency, documentation, copyright compliance
- NOT in the high-risk category if positioned as investment governance

## Source 12: AI Landscape in Clinical Trials — Key Vendors (2024)
| Vendor | Core Capability | Revenue/Valuation |
|---|---|---|
| Medidata (Dassault Systèmes) | CTMS, eClinical, AI trial design | ~$1.5B ARR (est.) |
| Veeva Systems | Vault Clinical, Vault Safety, Vault Regulatory | $2.4B revenue FY2024 |
| Oracle Health Sciences | Clinical One, Argus Safety, InForm | Part of $53B Oracle |
| IQVIA | Decentralized trials, PV, regulatory intelligence | $15.4B revenue 2024 |
| Parexel | CRO + AI site selection | ~$2B revenue |
| Unlearn.ai | Digital twins for clinical trials | Series B, ~$50M raised |
| Saama Technologies | AI clinical data analytics | Acquired by Bain Capital |
| Mendel.ai | Trial matching, protocol optimization | ~$30M raised |
| Medable | Decentralized trial platform | ~$304M raised |

**Critical gap in the landscape:** No vendor provides a multi-persona deliberative governance layer for investment-level decisions. All existing tools operate at the operational/data layer. None provide a constitutional, auditable, multi-agent council for portfolio-level go/no-go decisions.

## Source 13: Where Pharma Loses Money — Quantified
| Loss Category | Magnitude | Source |
|---|---|---|
| Cost per day of trial delay | $800K lost sales + $40K direct costs | Tufts CSDD 2024 |
| Protocol amendment cost | $453,932 per amendment | Tufts CSDD |
| Trials with ≥1 amendment | 76% | Precision for Medicine 2025 |
| Trials failing to recruit | 85% | ACRP 2024 |
| Trials delayed (all causes) | 80% | PMC 2020 |
| Phase II failure rate | 72% (28% success) | Citeline 2024 |
| Phase III failure rate | 42% (58% success) | BIO 2020 |
| Overall Phase I → Approval | ~12% (oncology: ~5%) | Multiple sources |
| Cost of failed Phase III | $800M–$1.4B | Clinical Leader 2016 |
| Patient recruitment cost | 40% of total trial budget | Clinical Leader |
| Site activation delay cost | $600K–$8M per trial | Syncora 2025 |
