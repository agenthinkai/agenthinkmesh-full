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
          <p style={{ fontSize: 14, color: SILVER_400, lineHeight: 1.7 }}>
            Assign documents to each specialist agent. Financial Sentinel requires at least one document. All other agents will run with whatever context is available.
          </p>
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
