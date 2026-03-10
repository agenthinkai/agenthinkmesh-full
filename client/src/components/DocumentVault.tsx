/**
 * DocumentVault — file upload panel for the MeshDashboard.
 * Allows users to upload PDF or text documents that are injected
 * as context into every agent task prompt.
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

export function DocumentVault({
  onVaultTextChange,
  activeDocId,
  onActiveDocChange,
}: DocumentVaultProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], refetch } = trpc.vault.list.useQuery(undefined, {
    staleTime: 30000,
  });

  const uploadMutation = trpc.vault.upload.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.filename} uploaded`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.vault.delete.useMutation({
    onSuccess: () => {
      toast.success("Document removed");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const processFile = async (file: File) => {
    setUploading(true);
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
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large — max 5 MB"); return; }
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large — max 5 MB"); return; }
    await processFile(file);
  };

  const handleSelect = (doc: VaultDoc) => {
    if (activeDocId === doc.id) {
      // Deselect
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Upload button */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${uploading ? INDIGO : dragOver ? "#7BA3D4" : BORDER}`,
          borderRadius: 10,
          padding: "12px 16px",
          textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          background: uploading ? "rgba(123,163,212,0.15)" : dragOver ? "rgba(123,163,212,0.08)" : "#0F1E38",
          transition: "all 0.15s",
          transform: dragOver ? "scale(1.01)" : "scale(1)",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <div style={{ fontSize: 18, marginBottom: 4 }}>
          {uploading ? "⏳" : "📎"}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: uploading ? INDIGO : SLATE,
            fontFamily: MONO,
          }}
        >
          {uploading ? "Uploading..." : dragOver ? "Drop to upload" : "Upload document"}
        </div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
          Any format · max 5 MB · drag & drop supported
        </div>
      </div>

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
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${isActive ? INDIGO : BORDER}`,
                  background: isActive ? "rgba(123,163,212,0.1)" : "#0F1E38",
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {doc.mimeType?.includes("pdf") ? "📄"
                    : doc.mimeType?.includes("image") ? "🖼️"
                    : doc.mimeType?.includes("spreadsheet") || doc.filename.match(/\.(xlsx|xls|csv)$/i) ? "📊"
                    : doc.mimeType?.includes("word") || doc.filename.match(/\.(docx|doc)$/i) ? "📝"
                    : doc.mimeType?.includes("presentation") || doc.filename.match(/\.(pptx|ppt)$/i) ? "📊"
                    : doc.mimeType?.includes("video") ? "🎥"
                    : doc.mimeType?.includes("audio") ? "🎧"
                    : doc.mimeType?.includes("zip") || doc.filename.match(/\.(zip|rar|gz|tar)$/i) ? "🗂️"
                    : "📎"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isActive ? INDIGO : SLATE,
                      fontFamily: MONO,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: 9, color: MUTED }}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {isActive && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: INDIGO,
                      color: "#0B1629",
                      fontFamily: MONO,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    Active
                  </span>
                )}
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#637080",
                    fontSize: 14,
                    padding: "0 2px",
                    flexShrink: 0,
                    lineHeight: 1,
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

      {docs.length === 0 && (
        <div
          style={{
            fontSize: 10,
            color: MUTED,
            textAlign: "center",
            fontFamily: MONO,
            padding: "8px 0",
          }}
        >
          No documents in vault yet.
          <br />
          Upload a client profile or brief to inject context.
        </div>
      )}
    </div>
  );
}
