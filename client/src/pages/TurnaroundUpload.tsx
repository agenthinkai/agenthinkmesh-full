import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { toast } from "sonner";

const NAVY_950 = "#080F1E";
const NAVY_900 = "#0C1628";
const NAVY_800 = "#111E35";
const NAVY_700 = "#162440";
const STEEL = "#1E2D47";
const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FCD34D";
const RED = "#EF4444";
const SILVER_50 = "#F0F4FA";
const SILVER_200 = "#C8D4E8";
const SILVER_400 = "#8494AA";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const AGENT_SLOTS = [
  {
    id: "financial-sentinel",
    icon: "💰",
    name: "Financial Sentinel",
    role: "Cash & Survival Analysis",
    accepts: "Balance sheets, cash flow statements, financial contracts",
    color: AMBER,
    required: true,
  },
  {
    id: "customer-pulse",
    icon: "📊",
    name: "Customer Pulse",
    role: "Churn Risk Intelligence",
    accepts: "CRM exports, support tickets, NPS survey data",
    color: "#60A5FA",
    required: false,
  },
  {
    id: "workflow-optimizer",
    icon: "⚙️",
    name: "Workflow Optimizer",
    role: "Operational Efficiency",
    accepts: "Ops logs, task tracker exports, GitHub repos",
    color: "#A78BFA",
    required: false,
  },
  {
    id: "narrative-architect",
    icon: "✍️",
    name: "Narrative Architect",
    role: "Crisis Communications",
    accepts: "CEO notes, investor decks, brand tone guide",
    color: "#34D399",
    required: false,
  },
  {
    id: "compliance-guardian",
    icon: "🛡️",
    name: "Compliance Guardian",
    role: "Risk & Regulatory",
    accepts: "Regulatory documents, contracts, internal policies",
    color: RED,
    required: false,
  },
  {
    id: "resilience-logger",
    icon: "🧠",
    name: "Resilience Logger",
    role: "Memory Backbone & Synthesis",
    accepts: "Runs automatically after all agents complete — no upload needed",
    color: AMBER_LIGHT,
    required: false,
    autoRun: true,
  },
];

interface UploadedFile {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  slot: string;
}

// Synthetic GCC demo scenario — UAE Real Estate
const UAE_DEMO_COMPANY = "Khaleeji Properties";
const UAE_DEMO_INDUSTRY = "Real Estate & Construction";
const UAE_DEMO_CRISIS = "AED 380M mixed-use tower in Dubai Marina is 68% complete but faces a critical project financing gap after the lead lender withdrew. Construction has halted, contractor claims are mounting, and the off-plan buyer refund window opens in 11 weeks.";
const UAE_DEMO_DOC = `KHALEEJI PROPERTIES — PROJECT FINANCING CRISIS BRIEF (Q4 2025)

COMPANY OVERVIEW
Khaleeji Properties is a Dubai-based mid-tier real estate developer with 14 years of operating history. The company has delivered 8 residential and commercial projects across Dubai and Abu Dhabi. Current portfolio includes 3 active developments with a combined GDV of AED 1.4B.

CRISIS PROJECT: MARINA PINNACLE TOWER
- Location: Dubai Marina, Plot JBR-44
- Asset class: Mixed-use (312 residential units + 4 retail floors + 2 hotel floors)
- GDV at launch: AED 560M
- Construction progress: 68% complete (structural work done, MEP and fit-out remaining)
- Original completion: Q2 2026
- Revised completion (if financing secured): Q4 2026

FINANCING STRUCTURE (ORIGINAL)
- Senior construction loan: AED 280M (Emirates NBD Real Estate Finance)
- Developer equity: AED 95M (fully deployed)
- Off-plan sales proceeds: AED 185M collected to date (from 218 of 312 units sold)

CRISIS TRIGGER
Emirates NBD withdrew the remaining AED 110M of the construction facility in September 2025, citing:
1. 22% cost overrun on structural phase (AED 61M above budget)
2. Contractor dispute — main contractor (Al Futtaim Engineering) issued a stop-work notice
3. Two key subcontractors filed DIFC arbitration claims totalling AED 28M
4. Project management firm resigned in August 2025

CURRENT FINANCIAL POSITION
- Cash on hand: AED 12.4M
- Monthly site holding cost (security, insurance, utilities): AED 2.1M
- Contractor mobilisation cost to restart: AED 8M (estimated)
- Outstanding contractor claims: AED 41M (disputed)
- Off-plan buyer refund exposure: AED 185M (if escrow trustee triggers refunds)
- RERA escrow balance: AED 67M (frozen pending dispute resolution)

OFF-PLAN BUYER RISK
- 218 buyers hold SPAs with a 24-month delivery clause
- Delivery deadline: March 2026 (11 weeks from now)
- If missed, buyers can apply to RERA for refund from escrow
- Estimated refund liability if all buyers claim: AED 185M
- Actual escrow balance: AED 67M — shortfall of AED 118M

ACTIONS TAKEN TO DATE
- Engaged Deloitte Real Estate Advisory for restructuring (October 2025)
- Approached 4 alternative lenders (2 declined, 2 in due diligence)
- Initiated mediation with Al Futtaim Engineering through DIAC
- Submitted RERA extension application (outcome pending)
- Exploring JV with a larger developer to inject equity and take over project management

KEY RISKS
1. RERA refund trigger in 11 weeks — existential if escrow shortfall crystallises
2. Contractor arbitration — AED 28M DIFC claims could freeze remaining assets
3. Reputational damage — 3 local media stories published; buyer WhatsApp groups active
4. Contagion to other projects — lenders on 2 other Khaleeji projects reviewing covenants
5. Key man risk — CEO and CFO both under personal guarantee exposure on the NBD facility
`;

// Synthetic GCC demo scenario — Kuwait Retail
const DEMO_COMPANY = "Al-Rashid Retail Group";
const DEMO_INDUSTRY = "Retail & Consumer Goods";
const DEMO_CRISIS = "Cash runway under 5 months, accelerating customer churn in core Kuwait City stores, and a supplier credit freeze following delayed payments to 3 key vendors.";
const DEMO_DOC = `AL-RASHID RETAIL GROUP — FINANCIAL SUMMARY (Q3 2025)

COMPANY OVERVIEW
Al-Rashid Retail Group operates 34 retail outlets across Kuwait (22), UAE (8), and Bahrain (4), with a workforce of 2,400. The group operates in mid-market fashion, home goods, and electronics segments.

CASH POSITION
- Cash & equivalents: KWD 2.1M (down from KWD 6.8M at year-start)
- Monthly cash burn: KWD 0.9M
- Projected runway at current burn: 4.8 months
- Revolving credit facility: KWD 5M (fully drawn)
- Supplier payables overdue >60 days: KWD 3.2M

REVENUE PERFORMANCE
- Q3 2025 revenue: KWD 18.4M (vs KWD 24.1M Q3 2024, -23.7% YoY)
- Kuwait City flagship stores: -31% YoY (5 stores)
- UAE stores: -12% YoY (performing relatively better)
- E-commerce: +8% YoY (small base, KWD 1.1M)

GROSS MARGIN
- Blended gross margin: 28.4% (vs 34.1% prior year)
- Margin compression driven by: aggressive discounting (-4.2pp), higher logistics costs (+1.5pp)

OPERATING EXPENSES
- Staff costs: KWD 5.2M/quarter (fixed, no redundancies yet)
- Rent: KWD 3.8M/quarter (lease renegotiations in progress for 6 stores)
- Marketing: KWD 0.8M/quarter (cut from KWD 1.6M)

DEBT STRUCTURE
- Term loan (NBK): KWD 12M outstanding, next principal repayment KWD 2M due Jan 2026
- Supplier credit lines: 3 major suppliers have suspended credit (total exposure KWD 3.2M)
- No covenant breaches yet, but DSCR at 0.91x (covenant threshold: 1.0x)

KEY RISKS
1. Covenant breach on NBK term loan if Q4 revenue misses by >15%
2. Supplier inventory freeze — 2 key product categories at risk of stockout within 8 weeks
3. Staff morale: 3 senior managers resigned in Q3; recruitment freeze in place
4. Lease renegotiations: 2 landlords have issued breach notices for late rent

MANAGEMENT ACTIONS TO DATE
- Hired turnaround advisor — engagement started Oct 2025
- Initiated sale-leaseback of 2 owned store properties (expected proceeds KWD 4.5M, Q1 2026)
- Launched Project Phoenix — internal cost reduction initiative targeting KWD 2M annualised savings
- Approached 2 strategic investors for equity injection (discussions at NDA stage)
`;

export default function TurnaroundUpload() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [crisisType, setCrisisType] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [isDemoLoaded, setIsDemoLoaded] = useState(false);
  const [isDemoUAELoaded, setIsDemoUAELoaded] = useState(false);
  const uploadDocument = trpc.turnaround.uploadDocument.useMutation();
  const createSession = trpc.turnaround.create.useMutation({
    onSuccess: (data) => {
      toast.success("Turnaround session activated — deploying agents");
      navigate(`/turnaround/command/${data.sessionId}`);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to start session");
    },
  });

  if (!isAuthenticated) {
    window.location.href = getLoginUrl("/turnaround/upload");
    return null;
  }

  const handleFileSelect = async (slotId: string, file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20 MB");
      return;
    }
    setUploadingSlot(slotId);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadDocument.mutateAsync({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data: base64,
      });
      setUploadedFiles(prev => {
        const filtered = prev.filter(f => f.slot !== slotId);
        return [...filtered, { fileName: result.fileName, fileUrl: result.url, mimeType: file.type, slot: slotId }];
      });
      toast.success(`${file.name} uploaded to ${AGENT_SLOTS.find(s => s.id === slotId)?.name}`);
    } catch {
      toast.error("Upload failed — please try again");
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleDrop = (slotId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(slotId, file);
  };

  const handleActivate = () => {
    if (!companyName.trim()) { toast.error("Company name is required"); return; }
    const sentinelFile = uploadedFiles.find(f => f.slot === "financial-sentinel");
    if (!sentinelFile) { toast.error("At least one document for Financial Sentinel is required"); return; }

    createSession.mutate({
      companyName: companyName.trim(),
      industry: industry.trim(),
      crisisType: crisisType.trim(),
      documents: uploadedFiles,
    });
  };

  const canActivate = companyName.trim() && uploadedFiles.some(f => f.slot === "financial-sentinel");

  const handleLoadUAEDemo = async () => {
    setCompanyName(UAE_DEMO_COMPANY);
    setIndustry(UAE_DEMO_INDUSTRY);
    setCrisisType(UAE_DEMO_CRISIS);
    setIsDemoUAELoaded(true);
    setIsDemoLoaded(false);
    toast.success("Demo scenario loaded — Khaleeji Properties, Dubai");
    try {
      const encoded = encodeURIComponent(UAE_DEMO_DOC);
      const base64 = btoa(unescape(encoded));
      const result = await uploadDocument.mutateAsync({
        fileName: "Khaleeji_Properties_Crisis_Brief_Q4_2025.txt",
        mimeType: "text/plain",
        base64Data: base64,
      });
      setUploadedFiles([{
        fileName: result.fileName,
        fileUrl: result.url,
        mimeType: "text/plain",
        slot: "financial-sentinel",
      }]);
      toast.success("Synthetic project financing brief assigned to Financial Sentinel");
    } catch {
      toast.error("Could not upload demo document — please upload manually");
    }
  };

  const handleLoadDemo = async () => {
    setCompanyName(DEMO_COMPANY);
    setIndustry(DEMO_INDUSTRY);
    setCrisisType(DEMO_CRISIS);
    setIsDemoLoaded(true);
    setIsDemoUAELoaded(false);
    toast.success("Demo scenario loaded — Al-Rashid Retail Group, Kuwait");
    try {
      const encoded = encodeURIComponent(DEMO_DOC);
      const base64 = btoa(unescape(encoded));
      const result = await uploadDocument.mutateAsync({
        fileName: "AlRashid_Financial_Summary_Q3_2025.txt",
        mimeType: "text/plain",
        base64Data: base64,
      });
      setUploadedFiles([{
        fileName: result.fileName,
        fileUrl: result.url,
        mimeType: "text/plain",
        slot: "financial-sentinel",
      }]);
      toast.success("Synthetic financial document assigned to Financial Sentinel");
    } catch {
      toast.error("Could not upload demo document — please upload manually");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: FONT, color: SILVER_50 }}>
      {/* Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 40px",
        borderBottom: `1px solid ${STEEL}`,
        background: `${NAVY_900}F8`,
        backdropFilter: "blur(16px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/turnaround" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            ← 100-Hour Turnaround
          </a>
        </div>
      </nav>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 40px 80px", boxSizing: "border-box" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontFamily: MONO, color: AMBER, letterSpacing: "0.08em", marginBottom: 10 }}>
            ⏱ 100-HOUR TURNAROUND · SESSION SETUP
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 900, color: SILVER_50, marginBottom: 10 }}>
            Activate Crisis Response
          </h1>
          <p style={{ fontSize: 14, color: SILVER_400, lineHeight: 1.7, marginBottom: 20 }}>
            Assign documents to each specialist agent. Financial Sentinel requires at least one document. All other agents will run with whatever context is available.
          </p>
          {/* Demo mode buttons */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* Kuwait demo */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "10px 18px", borderRadius: 10,
              background: isDemoLoaded ? "rgba(34,197,94,0.08)" : "rgba(224,123,84,0.08)",
              border: `1px solid ${isDemoLoaded ? "rgba(34,197,94,0.3)" : "rgba(224,123,84,0.3)"}`,
            }}>
              <span style={{ fontSize: 12, color: isDemoLoaded ? "#4ADE80" : "#E07B54", fontFamily: MONO }}>
                {isDemoLoaded ? "✓ Kuwait Retail loaded" : "🇰🇼 Kuwait Demo"}
              </span>
              {!isDemoLoaded && (
                <button
                  onClick={handleLoadDemo}
                  disabled={uploadDocument.isPending}
                  style={{
                    padding: "6px 14px", borderRadius: 7,
                    background: "#E07B54", border: "none",
                    color: "#fff", fontSize: 12, fontWeight: 700,
                    cursor: uploadDocument.isPending ? "not-allowed" : "pointer",
                    fontFamily: MONO, letterSpacing: "0.04em",
                    opacity: uploadDocument.isPending ? 0.6 : 1,
                  }}
                >
                  {uploadDocument.isPending && !isDemoUAELoaded ? "Loading…" : "Al-Rashid Retail"}
                </button>
              )}
              {isDemoLoaded && (
                <button
                  onClick={() => { setCompanyName(""); setIndustry(""); setCrisisType(""); setUploadedFiles([]); setIsDemoLoaded(false); }}
                  style={{ padding: "4px 10px", borderRadius: 6, background: "none", border: "1px solid rgba(34,197,94,0.3)", color: "#4ADE80", fontSize: 11, cursor: "pointer", fontFamily: MONO }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* UAE demo */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "10px 18px", borderRadius: 10,
              background: isDemoUAELoaded ? "rgba(34,197,94,0.08)" : "rgba(96,165,250,0.08)",
              border: `1px solid ${isDemoUAELoaded ? "rgba(34,197,94,0.3)" : "rgba(96,165,250,0.3)"}`,
            }}>
              <span style={{ fontSize: 12, color: isDemoUAELoaded ? "#4ADE80" : "#60A5FA", fontFamily: MONO }}>
                {isDemoUAELoaded ? "✓ UAE Real Estate loaded" : "🇦🇪 UAE Demo"}
              </span>
              {!isDemoUAELoaded && (
                <button
                  onClick={handleLoadUAEDemo}
                  disabled={uploadDocument.isPending}
                  style={{
                    padding: "6px 14px", borderRadius: 7,
                    background: "#3B82F6", border: "none",
                    color: "#fff", fontSize: 12, fontWeight: 700,
                    cursor: uploadDocument.isPending ? "not-allowed" : "pointer",
                    fontFamily: MONO, letterSpacing: "0.04em",
                    opacity: uploadDocument.isPending ? 0.6 : 1,
                  }}
                >
                  {uploadDocument.isPending && !isDemoLoaded ? "Loading…" : "Khaleeji Properties"}
                </button>
              )}
              {isDemoUAELoaded && (
                <button
                  onClick={() => { setCompanyName(""); setIndustry(""); setCrisisType(""); setUploadedFiles([]); setIsDemoUAELoaded(false); }}
                  style={{ padding: "4px 10px", borderRadius: 6, background: "none", border: "1px solid rgba(34,197,94,0.3)", color: "#4ADE80", fontSize: 11, cursor: "pointer", fontFamily: MONO }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Company details */}
        <div style={{ background: NAVY_800, border: `1px solid ${STEEL}`, borderRadius: 14, padding: "24px 28px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontFamily: MONO, color: SILVER_600, letterSpacing: "0.06em", marginBottom: 16 }}>COMPANY DETAILS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: SILVER_400, display: "block", marginBottom: 6 }}>
                Company Name <span style={{ color: RED }}>*</span>
              </label>
              <input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Al Rashid Holdings"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: NAVY_700, border: `1px solid ${STEEL}`,
                  color: SILVER_50, fontSize: 14, fontFamily: FONT,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: SILVER_400, display: "block", marginBottom: 6 }}>Industry</label>
              <input
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Real Estate, Retail, Manufacturing"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: NAVY_700, border: `1px solid ${STEEL}`,
                  color: SILVER_50, fontSize: 14, fontFamily: FONT,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: SILVER_400, display: "block", marginBottom: 6 }}>Crisis Description</label>
            <input
              value={crisisType}
              onChange={e => setCrisisType(e.target.value)}
              placeholder="e.g. Cash runway under 6 months, key customer churn, regulatory investigation"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                background: NAVY_700, border: `1px solid ${STEEL}`,
                color: SILVER_50, fontSize: 14, fontFamily: FONT,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Agent document slots */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontFamily: MONO, color: SILVER_600, letterSpacing: "0.06em", marginBottom: 16 }}>
            DOCUMENT ASSIGNMENT — 6 AGENT SLOTS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {AGENT_SLOTS.map(slot => {
              const uploadedFile = uploadedFiles.find(f => f.slot === slot.id);
              const isUploading = uploadingSlot === slot.id;
              const isDragOver = dragOverSlot === slot.id;

              return (
                <div
                  key={slot.id}
                  style={{
                    background: isDragOver ? `${slot.color}08` : NAVY_800,
                    border: `1px solid ${isDragOver ? slot.color + "50" : uploadedFile ? slot.color + "40" : STEEL}`,
                    borderRadius: 12,
                    padding: "16px 18px",
                    transition: "all 0.2s",
                  }}
                  onDragOver={e => { if (!slot.autoRun) { e.preventDefault(); setDragOverSlot(slot.id); } }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={e => { if (!slot.autoRun) handleDrop(slot.id, e); }}
                >
                  {/* Slot header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 7,
                      background: `${slot.color}12`, border: `1px solid ${slot.color}25`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, flexShrink: 0,
                    }}>{slot.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: SILVER_50 }}>{slot.name}</span>
                        {slot.required && (
                          <span style={{ fontSize: 10, color: RED, fontFamily: MONO }}>REQUIRED</span>
                        )}
                        {slot.autoRun && (
                          <span style={{ fontSize: 10, color: slot.color, fontFamily: MONO }}>AUTO</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: slot.color, fontFamily: MONO }}>{slot.role}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: SILVER_600, marginBottom: 12, lineHeight: 1.5 }}>
                    {slot.accepts}
                  </div>

                  {/* Upload area */}
                  {!slot.autoRun && (
                    <>
                      {uploadedFile ? (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 12px", borderRadius: 7,
                          background: `${slot.color}10`, border: `1px solid ${slot.color}30`,
                        }}>
                          <span style={{ fontSize: 12, color: slot.color }}>✓</span>
                          <span style={{ fontSize: 12, color: SILVER_200, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {uploadedFile.fileName}
                          </span>
                          <button
                            onClick={() => setUploadedFiles(prev => prev.filter(f => f.slot !== slot.id))}
                            style={{ background: "none", border: "none", color: SILVER_600, cursor: "pointer", fontSize: 14, padding: 0 }}
                          >×</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRefs.current[slot.id]?.click()}
                          disabled={isUploading}
                          style={{
                            width: "100%", padding: "10px", borderRadius: 7,
                            background: "transparent",
                            border: `1px dashed ${isDragOver ? slot.color : STEEL}`,
                            color: isUploading ? SILVER_600 : SILVER_400,
                            fontSize: 12, cursor: isUploading ? "not-allowed" : "pointer",
                            fontFamily: MONO, transition: "all 0.15s",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          }}
                          onMouseEnter={e => { if (!isUploading) (e.currentTarget as HTMLButtonElement).style.borderColor = slot.color; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = isDragOver ? slot.color : STEEL; }}
                        >
                          {isUploading ? (
                            <>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${STEEL}`, borderTopColor: slot.color, display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                              Uploading…
                            </>
                          ) : (
                            <>↑ Upload or drop file</>
                          )}
                        </button>
                      )}
                      <input
                        ref={el => { fileInputRefs.current[slot.id] = el; }}
                        type="file"
                        accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.json"
                        style={{ display: "none" }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(slot.id, file);
                          e.target.value = "";
                        }}
                      />
                    </>
                  )}

                  {slot.autoRun && (
                    <div style={{
                      padding: "8px 12px", borderRadius: 7,
                      background: `${slot.color}08`, border: `1px solid ${slot.color}20`,
                      fontSize: 11, color: SILVER_600, fontFamily: MONO,
                    }}>
                      Activates automatically after all other agents complete
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Activate button */}
        <div style={{
          background: NAVY_800, border: `1px solid ${STEEL}`,
          borderRadius: 14, padding: "24px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 20,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: SILVER_50, marginBottom: 4 }}>
              Ready to deploy?
            </div>
            <div style={{ fontSize: 12, color: SILVER_600 }}>
              {uploadedFiles.length} document{uploadedFiles.length !== 1 ? "s" : ""} assigned across {new Set(uploadedFiles.map(f => f.slot)).size} agent{new Set(uploadedFiles.map(f => f.slot)).size !== 1 ? "s" : ""}.
              The 100-hour countdown begins on activation.
            </div>
          </div>
          <button
            onClick={handleActivate}
            disabled={!canActivate || createSession.isPending}
            style={{
              padding: "12px 32px", borderRadius: 10,
              background: canActivate
                ? `linear-gradient(135deg, ${AMBER}, ${AMBER_LIGHT})`
                : NAVY_700,
              border: canActivate ? "none" : `1px solid ${STEEL}`,
              color: canActivate ? NAVY_950 : SILVER_600,
              fontSize: 14, fontWeight: 800, cursor: canActivate ? "pointer" : "not-allowed",
              fontFamily: MONO, letterSpacing: "0.04em",
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {createSession.isPending ? (
              <>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${NAVY_950}`, borderTopColor: "transparent", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                Activating…
              </>
            ) : (
              "⏱ Activate Turnaround"
            )}
          </button>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: ${AMBER} !important; }
      `}</style>
    </div>
  );
}
