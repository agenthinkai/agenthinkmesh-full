import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const NAVY_950 = "#060A14";
const NAVY_900 = "#0A0E1A";
const NAVY_800 = "#111827";
const NAVY_700 = "#1E2A3A";
const GREEN_400 = "#4ADE80";
const GREEN_500 = "#22C55E";
const SILVER_300 = "#CBD5E1";
const SILVER_400 = "#94A3B8";
const SILVER_500 = "#64748B";
const RED_400 = "#F87171";
const AMBER_400 = "#FBBF24";
const MONO = "'JetBrains Mono', 'Fira Mono', monospace";
const SANS = "'Inter', system-ui, sans-serif";

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontFamily: MONO,
        fontWeight: 600,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {children}
    </span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: NAVY_800,
        border: `1px solid rgba(74,222,128,0.12)`,
        borderRadius: 12,
        padding: "24px 28px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: GREEN_400,
        margin: "0 0 16px 0",
      }}
    >
      {children}
    </h2>
  );
}

export default function SecurityKeysPage() {
  const utils = trpc.useUtils();

  const { data: status, isLoading: statusLoading } = trpc.cmk.getStatus.useQuery();
  const { data: auditData, isLoading: auditLoading } = trpc.cmk.getAuditLog.useQuery({
    limit: 50,
    offset: 0,
  });

  const generateKey = trpc.cmk.generateKey.useMutation({
    onSuccess: () => {
      toast.success("Encryption key generated", { description: "Your data will now be encrypted at rest." });
      utils.cmk.getStatus.invalidate();
      utils.cmk.getAuditLog.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rotateKey = trpc.cmk.rotateKey.useMutation({
    onSuccess: (data) => {
      toast.success("Key rotated", { description: `${data.reEncryptedRows} records re-encrypted with key v${data.newKeyVersion}.` });
      utils.cmk.getStatus.invalidate();
      utils.cmk.getAuditLog.invalidate();
    },
    onError: (e) => toast.error(`Rotation failed: ${e.message}`),
  });

  const revokeKey = trpc.cmk.revokeKey.useMutation({
    onSuccess: () => {
      toast.error("Key revoked — encrypted data is no longer accessible.");
      utils.cmk.getStatus.invalidate();
      utils.cmk.getAuditLog.invalidate();
      setRevokeConfirm("");
      setShowRevokeDialog(false);
    },
    onError: (e) => toast.error(`Revocation failed: ${e.message}`),
  });

  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState("");

  const opLabel: Record<string, string> = {
    key_generated: "Key generated",
    key_rotated: "Key rotated",
    key_revoked: "Key revoked",
    field_encrypted: "Field encrypted",
    field_decrypted: "Field decrypted",
  };

  const opColor: Record<string, string> = {
    key_generated: GREEN_400,
    key_rotated: AMBER_400,
    key_revoked: RED_400,
    field_encrypted: GREEN_500,
    field_decrypted: SILVER_400,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: NAVY_950,
        color: SILVER_300,
        fontFamily: SANS,
        padding: "48px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Back link */}
        <Link href="/security">
          <a
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: MONO,
              fontSize: 12,
              color: SILVER_500,
              textDecoration: "none",
              marginBottom: 32,
            }}
          >
            ← Back to Security
          </a>
        </Link>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: GREEN_400,
              marginBottom: 10,
            }}
          >
            Customer-Managed Keys
          </div>
          <h1
            style={{
              fontFamily: SANS,
              fontSize: 28,
              fontWeight: 700,
              color: "#F1F5F9",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Encryption Key Management
          </h1>
          <p style={{ color: SILVER_400, marginTop: 12, lineHeight: 1.7, maxWidth: 580 }}>
            Each account has a unique AES-256 encryption key. Your deal analysis, pitch content, and vault
            documents are encrypted with this key before being stored. Revoking your key permanently
            destroys access to all encrypted data — including ours.
          </p>
        </div>

        {/* Key Status Card */}
        <Card style={{ marginBottom: 24 }}>
          <SectionTitle>Key Status</SectionTitle>
          {statusLoading ? (
            <p style={{ color: SILVER_500, fontFamily: MONO, fontSize: 13 }}>Loading…</p>
          ) : status?.hasKey ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <Badge color={status.status === "active" ? GREEN_400 : RED_400}>
                  {status.status === "active" ? "Active" : "Revoked"}
                </Badge>
                <span style={{ fontFamily: MONO, fontSize: 12, color: SILVER_500 }}>
                  Version {status.keyVersion}
                </span>
                {status.createdAt && (
                  <span style={{ fontFamily: MONO, fontSize: 12, color: SILVER_500 }}>
                    Generated {new Date(status.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
                {status.rotatedAt && (
                  <span style={{ fontFamily: MONO, fontSize: 12, color: AMBER_400 }}>
                    Last rotated {new Date(status.rotatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>

              {status.status === "active" && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    onClick={() => {
                      if (confirm("Rotate your encryption key? All your encrypted data will be re-encrypted with the new key. This may take a few seconds.")) {
                        rotateKey.mutate();
                      }
                    }}
                    disabled={rotateKey.isPending}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 8,
                      border: `1px solid ${AMBER_400}40`,
                      background: `${AMBER_400}10`,
                      color: AMBER_400,
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: rotateKey.isPending ? "not-allowed" : "pointer",
                      opacity: rotateKey.isPending ? 0.6 : 1,
                    }}
                  >
                    {rotateKey.isPending ? "Rotating…" : "Rotate Key"}
                  </button>
                  <button
                    onClick={() => setShowRevokeDialog(true)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 8,
                      border: `1px solid ${RED_400}40`,
                      background: `${RED_400}10`,
                      color: RED_400,
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Revoke Key
                  </button>
                </div>
              )}

              {status.status === "revoked" && (
                <div
                  style={{
                    background: `${RED_400}10`,
                    border: `1px solid ${RED_400}30`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    color: RED_400,
                    fontFamily: MONO,
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  Your key has been revoked on{" "}
                  {status.revokedAt
                    ? new Date(status.revokedAt).toLocaleString("en-GB")
                    : "unknown date"}
                  . All encrypted data is permanently inaccessible. Contact{" "}
                  <a href="mailto:security@agenthink.ai" style={{ color: RED_400 }}>
                    security@agenthink.ai
                  </a>{" "}
                  if this was in error.
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Badge color={SILVER_500}>No key</Badge>
                <span style={{ color: SILVER_500, fontSize: 13 }}>
                  Your data is stored without field-level encryption. Generate a key to enable CMK.
                </span>
              </div>
              <button
                onClick={() => generateKey.mutate()}
                disabled={generateKey.isPending}
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: `1px solid ${GREEN_400}40`,
                  background: `${GREEN_400}15`,
                  color: GREEN_400,
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: generateKey.isPending ? "not-allowed" : "pointer",
                  opacity: generateKey.isPending ? 0.6 : 1,
                }}
              >
                {generateKey.isPending ? "Generating…" : "Generate Encryption Key"}
              </button>
            </div>
          )}
        </Card>

        {/* How it works */}
        <Card style={{ marginBottom: 24 }}>
          <SectionTitle>How It Works</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                step: "01",
                title: "Unique key per account",
                desc: "The platform generates a 256-bit AES key exclusively for your account. No two accounts share a key.",
              },
              {
                step: "02",
                title: "Envelope encryption",
                desc: "Your data key is itself encrypted with a server-side master key before storage. The raw data key is never persisted in plaintext.",
              },
              {
                step: "03",
                title: "In-memory only during requests",
                desc: "Your data key is decrypted into memory only for the duration of a request, then discarded. It is never logged or returned to the client.",
              },
              {
                step: "04",
                title: "Revocation is permanent",
                desc: "Revoking your key destroys the wrapped key in the database. Without it, all encrypted fields are permanently inaccessible — including to AgenThinkMesh.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ display: "flex", gap: 16 }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: GREEN_400,
                    fontWeight: 700,
                    minWidth: 24,
                    paddingTop: 2,
                  }}
                >
                  {step}
                </span>
                <div>
                  <div style={{ color: "#F1F5F9", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                    {title}
                  </div>
                  <div style={{ color: SILVER_400, fontSize: 13, lineHeight: 1.65 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Audit Log */}
        <Card>
          <SectionTitle>Audit Log</SectionTitle>
          {auditLoading ? (
            <p style={{ color: SILVER_500, fontFamily: MONO, fontSize: 13 }}>Loading…</p>
          ) : !auditData?.entries.length ? (
            <p style={{ color: SILVER_500, fontSize: 13 }}>No events recorded yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
                <thead>
                  <tr>
                    {["Timestamp (Kuwait)", "Operation", "Field", "Key Version"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "6px 12px 10px 0",
                          color: SILVER_500,
                          fontWeight: 600,
                          borderBottom: `1px solid rgba(255,255,255,0.06)`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditData.entries.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                      <td style={{ padding: "8px 12px 8px 0", color: SILVER_500, whiteSpace: "nowrap" }}>
                        {new Date(entry.performedAt).toLocaleString("en-GB", {
                          timeZone: "Asia/Kuwait",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td style={{ padding: "8px 12px 8px 0" }}>
                        <Badge color={opColor[entry.operation] ?? SILVER_400}>
                          {opLabel[entry.operation] ?? entry.operation}
                        </Badge>
                      </td>
                      <td style={{ padding: "8px 12px 8px 0", color: SILVER_400 }}>
                        {entry.fieldRef ?? "—"}
                      </td>
                      <td style={{ padding: "8px 0", color: SILVER_500 }}>v{entry.keyVersion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Revoke confirmation dialog */}
      {showRevokeDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,10,20,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRevokeDialog(false);
          }}
        >
          <div
            style={{
              background: NAVY_800,
              border: `1px solid ${RED_400}40`,
              borderRadius: 16,
              padding: "32px 36px",
              maxWidth: 480,
              width: "100%",
            }}
          >
            <h2
              style={{
                fontFamily: SANS,
                fontSize: 20,
                fontWeight: 700,
                color: RED_400,
                margin: "0 0 12px 0",
              }}
            >
              Revoke Encryption Key
            </h2>
            <p style={{ color: SILVER_300, lineHeight: 1.7, marginBottom: 20 }}>
              This action is <strong style={{ color: RED_400 }}>permanent and irreversible</strong>. All
              encrypted data — deal analysis, pitch content, vault documents — will become permanently
              inaccessible. This cannot be undone.
            </p>
            <p style={{ color: SILVER_400, fontSize: 13, marginBottom: 8 }}>
              Type <strong style={{ color: RED_400, fontFamily: MONO }}>REVOKE MY KEY</strong> to confirm:
            </p>
            <input
              type="text"
              value={revokeConfirm}
              onChange={(e) => setRevokeConfirm(e.target.value)}
              placeholder="REVOKE MY KEY"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${RED_400}40`,
                background: NAVY_900,
                color: RED_400,
                fontFamily: MONO,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 20,
              }}
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowRevokeDialog(false);
                  setRevokeConfirm("");
                }}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: `1px solid rgba(255,255,255,0.1)`,
                  background: "transparent",
                  color: SILVER_400,
                  fontFamily: MONO,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => revokeKey.mutate({ confirmationText: revokeConfirm })}
                disabled={revokeConfirm !== "REVOKE MY KEY" || revokeKey.isPending}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: `1px solid ${RED_400}40`,
                  background: `${RED_400}15`,
                  color: RED_400,
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor:
                    revokeConfirm !== "REVOKE MY KEY" || revokeKey.isPending ? "not-allowed" : "pointer",
                  opacity: revokeConfirm !== "REVOKE MY KEY" || revokeKey.isPending ? 0.5 : 1,
                }}
              >
                {revokeKey.isPending ? "Revoking…" : "Permanently Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
