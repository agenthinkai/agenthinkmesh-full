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
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const SILVER_50 = "#F0F4FA";
const SILVER_200 = "#C8D4E8";
const SILVER_400 = "#8494AA";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

interface UploadedDoc {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
}

export default function PortfolioUpload() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fundName, setFundName] = useState("");
  const [manager, setManager] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const uploadDoc = trpc.portfolio.uploadDocument.useMutation();
  const createReview = trpc.portfolio.create.useMutation();
  const analyzeReview = trpc.portfolio.analyze.useMutation();

  if (!isAuthenticated) {
    window.location.href = getLoginUrl("/portfolio-review/upload");
    return null;
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 20 MB limit.`);
        continue;
      }
      try {
        // Convert to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const result = await uploadDoc.mutateAsync({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64Data,
        });

        setDocs(prev => [...prev, {
          fileName: file.name,
          fileUrl: result.url,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }]);
        toast.success(`${file.name} uploaded`);
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeDoc = (idx: number) => {
    setDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (docs.length === 0) {
      toast.error("Please upload at least one document.");
      return;
    }
    try {
      const { id } = await createReview.mutateAsync({
        fundName: fundName.trim() || undefined,
        manager: manager.trim() || undefined,
        reviewPeriod: reviewPeriod.trim() || undefined,
        notes: notes.trim() || undefined,
        documents: docs.map(d => ({ fileName: d.fileName, fileUrl: d.fileUrl, mimeType: d.mimeType })),
      });
      navigate(`/portfolio-review/analyzing/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start review");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    background: NAVY_800,
    border: `1px solid ${STEEL}`,
    borderRadius: 10,
    fontSize: 14,
    color: SILVER_50,
    fontFamily: FONT,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    color: SILVER_400,
    fontFamily: MONO,
    letterSpacing: "0.06em",
    marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: FONT, color: SILVER_50, display: "flex", flexDirection: "column" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "20%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}06 0%, transparent 65%)`, filter: "blur(80px)" }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 40px",
        borderBottom: `1px solid ${STEEL}`,
        background: `${NAVY_900}F0`,
        backdropFilter: "blur(16px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/portfolio" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            ← Portfolio Intelligence
          </a>
        </div>
      </nav>

      {/* Main */}
      <main style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 760, margin: "0 auto", width: "100%", padding: "52px 32px 80px", boxSizing: "border-box" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: GOLD, letterSpacing: "0.08em", marginBottom: 10 }}>PORTFOLIO REVIEW · STEP 1 OF 2</div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, color: SILVER_50, marginBottom: 10, lineHeight: 1.15 }}>
            Upload fund documents
          </h1>
          <p style={{ fontSize: 14, color: SILVER_400, lineHeight: 1.65 }}>
            Upload GP quarterly reports, investment mandates, or investment memos. The analysis will assess whether the fund manager is executing the strategy they communicated.
          </p>
        </div>

        {/* Document upload zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? GOLD : STEEL}`,
            borderRadius: 14,
            padding: "40px 32px",
            textAlign: "center",
            cursor: "pointer",
            background: isDragging ? `${GOLD}08` : NAVY_800,
            transition: "all 0.2s",
            marginBottom: 20,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv"
            style={{ display: "none" }}
            onChange={e => handleFiles(e.target.files)}
          />
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: SILVER_200, marginBottom: 6 }}>
            {uploading ? "Uploading…" : "Drop documents here or click to browse"}
          </div>
          <div style={{ fontSize: 12, color: SILVER_600, fontFamily: MONO }}>
            PDF · DOCX · XLSX · PPTX · TXT · CSV · Max 20 MB per file
          </div>
        </div>

        {/* Uploaded docs list */}
        {docs.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {docs.map((doc, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px",
                background: NAVY_800,
                border: `1px solid ${STEEL}`,
                borderRadius: 10,
                marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📎</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: SILVER_50 }}>{doc.fileName}</div>
                    <div style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO }}>{(doc.size / 1024).toFixed(0)} KB</div>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeDoc(i); }}
                  style={{ background: "none", border: "none", color: SILVER_600, cursor: "pointer", fontSize: 18, padding: "2px 6px", borderRadius: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#EF4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = SILVER_600)}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Metadata fields */}
        <div style={{ background: NAVY_800, border: `1px solid ${STEEL}`, borderRadius: 14, padding: "24px 28px", marginBottom: 28 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: GOLD, letterSpacing: "0.06em", marginBottom: 20 }}>OPTIONAL CONTEXT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>FUND NAME</label>
              <input
                value={fundName}
                onChange={e => setFundName(e.target.value)}
                placeholder="e.g. GCC Equity Fund III"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = GOLD + "60")}
                onBlur={e => (e.currentTarget.style.borderColor = STEEL)}
              />
            </div>
            <div>
              <label style={labelStyle}>FUND MANAGER</label>
              <input
                value={manager}
                onChange={e => setManager(e.target.value)}
                placeholder="e.g. Wafra Capital"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = GOLD + "60")}
                onBlur={e => (e.currentTarget.style.borderColor = STEEL)}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>REVIEW PERIOD</label>
            <input
              value={reviewPeriod}
              onChange={e => setReviewPeriod(e.target.value)}
              placeholder="e.g. Q3 2025 · Jan–Sep 2025"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = GOLD + "60")}
              onBlur={e => (e.currentTarget.style.borderColor = STEEL)}
            />
          </div>
          <div>
            <label style={labelStyle}>ADDITIONAL NOTES</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any specific areas of focus or concerns you want the analysis to address…"
              rows={3}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
              onFocus={e => (e.currentTarget.style.borderColor = GOLD + "60")}
              onBlur={e => (e.currentTarget.style.borderColor = STEEL)}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={docs.length === 0 || createReview.isPending || uploading}
          style={{
            width: "100%",
            padding: "16px 32px",
            borderRadius: 12,
            border: "none",
            background: docs.length > 0 && !createReview.isPending && !uploading
              ? `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`
              : STEEL,
            color: docs.length > 0 && !createReview.isPending && !uploading ? NAVY_950 : SILVER_600,
            fontSize: 15,
            fontWeight: 700,
            cursor: docs.length > 0 && !createReview.isPending && !uploading ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            fontFamily: MONO,
            letterSpacing: "0.04em",
          }}
        >
          {createReview.isPending ? "Starting Analysis…" : "Run Portfolio Review →"}
        </button>

        {docs.length === 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: SILVER_600, marginTop: 10, fontFamily: MONO }}>
            Upload at least one document to continue
          </p>
        )}
      </main>
    </div>
  );
}
