/**
 * DocumentVault — file upload panel for the MeshDashboard.
 * Supports single or batch file uploads (click or drag-and-drop).
 * Each file shows individual upload progress. Uploaded docs are
 * injected as context into every agent task prompt.
 */
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { toast } from "sonner";

const MONO = "'JetBrains Mono', monospace";
const INDIGO = "#7BA3D4";
const BORDER = "#1C3057";
const MUTED = "#8494AA";
const SLATE = "#E8ECF2";

interface VaultDoc {
  id: number;
  filename: string;
  fileUrl: string;
  mimeType: string | null;
  extractedText: string | null;
  createdAt: Date;
}

interface DocumentVaultProps {
  onVaultTextChange: (text: string) => void;
  activeDocId: number | null;
  onActiveDocChange: (id: number | null) => void;
}

interface UploadingFile {
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

function fileIcon(mimeType: string | null, filename: string): string {
  if (!mimeType) mimeType = "";
  if (mimeType.includes("pdf") || filename.match(/\.pdf$/i)) return "📄";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("spreadsheet") || filename.match(/\.(xlsx|xls|csv)$/i)) return "📊";
  if (mimeType.includes("word") || filename.match(/\.(docx|doc)$/i)) return "📝";
  if (mimeType.includes("presentation") || filename.match(/\.(pptx|ppt)$/i)) return "📊";
  if (mimeType.includes("video")) return "🎥";
  if (mimeType.includes("audio")) return "🎧";
  if (mimeType.includes("zip") || filename.match(/\.(zip|rar|gz|tar)$/i)) return "🗂️";
  return "📎";
}

export function DocumentVault({
  onVaultTextChange,
  activeDocId,
  onActiveDocChange,
}: DocumentVaultProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], refetch } = trpc.vault.list.useQuery(undefined, {
    staleTime: 30000,
  });

  const uploadMutation = trpc.vault.upload.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.vault.delete.useMutation({
    onSuccess: () => {
      toast.success("Document removed");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const [reparsing, setReparsing] = useState<number | null>(null);
  const reparseMutation = trpc.vault.reparse.useMutation({
    onSuccess: async (data, variables) => {
      toast.success(`Re-parsed: ${data.charCount.toLocaleString()} chars extracted`);
      const freshResult = await refetch();
      // If this doc is currently active, update the vault text with fresh content
      if (activeDocId === variables.id) {
        const freshDoc = freshResult.data?.find((d: VaultDoc) => d.id === variables.id);
        if (freshDoc?.extractedText) onVaultTextChange(freshDoc.extractedText);
      }
      setReparsing(null);
    },
    onError: (e) => { toast.error(`Re-parse failed: ${e.message}`); setReparsing(null); },
  });

  const handleReparse = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setReparsing(id);
    reparseMutation.mutate({ id });
  };

  const uploadFile = async (file: File): Promise<void> => {
    if (file.size > 5 * 1024 * 1024) {
      setUploadingFiles(prev =>
        prev.map(f => f.name === file.name ? { ...f, status: "error", error: "Too large (max 5 MB)" } : f)
      );
      toast.error(`${file.name}: File too large — max 5 MB`);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
      );
      await uploadMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Content: base64,
      });
      setUploadingFiles(prev =>
        prev.map(f => f.name === file.name ? { ...f, status: "done" } : f)
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadingFiles(prev =>
        prev.map(f => f.name === file.name ? { ...f, status: "error", error: msg } : f)
      );
    }
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Add all files to uploading state
    setUploadingFiles(prev => [
      ...prev,
      ...files.map(f => ({ name: f.name, status: "uploading" as const })),
    ]);

    // Upload all in parallel
    await Promise.all(files.map(uploadFile));

    // Refresh list and clear done entries after a short delay
    await refetch();
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(f => f.status !== "done"));
    }, 1500);

    const succeeded = files.length;
    toast.success(`${succeeded} file${succeeded > 1 ? "s" : ""} uploaded`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleSelect = (doc: VaultDoc) => {
    if (activeDocId === doc.id) {
      onActiveDocChange(null);
      onVaultTextChange("");
    } else {
      onActiveDocChange(doc.id);
      onVaultTextChange(doc.extractedText ?? "");
      toast.success(`"${doc.filename}" added to task context`);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (activeDocId === id) {
      onActiveDocChange(null);
      onVaultTextChange("");
    }
    deleteMutation.mutate({ id });
  };

  const isUploading = uploadingFiles.some(f => f.status === "uploading");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Drop zone */}
      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${isUploading ? INDIGO : dragOver ? "#7BA3D4" : BORDER}`,
          borderRadius: 10,
          padding: "12px 16px",
          textAlign: "center",
          cursor: isUploading ? "not-allowed" : "pointer",
          background: isUploading
            ? "rgba(123,163,212,0.15)"
            : dragOver
            ? "rgba(123,163,212,0.08)"
            : "#0F1E38",
          transition: "all 0.15s",
          transform: dragOver ? "scale(1.01)" : "scale(1)",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <div style={{ fontSize: 18, marginBottom: 4 }}>
          {isUploading ? "⏳" : dragOver ? "📂" : "📎"}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: isUploading ? INDIGO : SLATE, fontFamily: MONO }}>
          {isUploading
            ? `Uploading ${uploadingFiles.filter(f => f.status === "uploading").length} file(s)...`
            : dragOver
            ? "Drop files to upload"
            : "Upload documents"}
        </div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
          Any format · max 5 MB each · drag & drop or click
        </div>
      </div>

      {/* Per-file upload progress */}
      {uploadingFiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {uploadingFiles.map((f, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 8,
              background: f.status === "error" ? "rgba(239,68,68,0.08)" : "rgba(123,163,212,0.06)",
              border: `1px solid ${f.status === "error" ? "rgba(239,68,68,0.2)" : "rgba(123,163,212,0.15)"}`,
            }}>
              <span style={{ fontSize: 12 }}>
                {f.status === "uploading" ? "⏳" : f.status === "done" ? "✅" : "❌"}
              </span>
              <span style={{
                flex: 1, fontSize: 10, fontFamily: MONO,
                color: f.status === "error" ? "#EF4444" : f.status === "done" ? "#4ADE80" : INDIGO,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {f.name}
              </span>
              <span style={{ fontSize: 9, color: MUTED, fontFamily: MONO, flexShrink: 0 }}>
                {f.status === "uploading" ? "uploading…" : f.status === "done" ? "done" : f.error ?? "error"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Document list */}
      {docs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {docs.map((doc) => {
            const isActive = activeDocId === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => handleSelect(doc)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 8,
                  border: `1px solid ${isActive ? INDIGO : BORDER}`,
                  background: isActive ? "rgba(123,163,212,0.1)" : "#0F1E38",
                  cursor: "pointer", transition: "all 0.12s",
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {fileIcon(doc.mimeType, doc.filename)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: isActive ? INDIGO : SLATE,
                    fontFamily: MONO,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: 9, color: MUTED }}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {isActive && (
                  <span style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 999,
                    background: INDIGO, color: "#0B1629",
                    fontFamily: MONO, fontWeight: 700, flexShrink: 0,
                  }}>
                    Active
                  </span>
                )}
                <button
                  onClick={(e) => handleReparse(e, doc.id)}
                  disabled={reparsing === doc.id}
                  style={{
                    background: "none", border: "none", cursor: reparsing === doc.id ? "wait" : "pointer",
                    color: reparsing === doc.id ? INDIGO : "#637080",
                    fontSize: 11, padding: "0 2px",
                    flexShrink: 0, lineHeight: 1, fontFamily: MONO,
                  }}
                  title="Re-parse document (refresh text extraction)"
                >
                  {reparsing === doc.id ? "⟳" : "↺"}
                </button>
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#637080", fontSize: 14, padding: "0 2px",
                    flexShrink: 0, lineHeight: 1,
                  }}
                  title="Remove document"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {docs.length === 0 && uploadingFiles.length === 0 && (
        <div style={{
          fontSize: 10, color: MUTED, textAlign: "center",
          fontFamily: MONO, padding: "8px 0",
        }}>
          No documents in vault yet.
          <br />
          Upload a client profile or brief to inject context.
        </div>
      )}
    </div>
  );
}
