import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

type Phase = "loading" | "confirm" | "success" | "error" | "already";

export default function Unsubscribe() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [phase, setPhase] = useState<Phase>("loading");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Validate the token exists
  const tokenCheck = trpc.unsubscribe.checkToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  useEffect(() => {
    if (!token) {
      setPhase("error");
      setErrorMsg("No unsubscribe token found in this link. Please use the link from your email.");
      return;
    }
    if (tokenCheck.isLoading) return;
    if (tokenCheck.error) {
      setPhase("error");
      setErrorMsg("This unsubscribe link is invalid or has already been used.");
      return;
    }
    if (tokenCheck.data?.alreadyUnsubscribed) {
      setPhase("already");
      return;
    }
    if (tokenCheck.data?.valid) {
      setPhase("confirm");
    }
  }, [token, tokenCheck.isLoading, tokenCheck.error, tokenCheck.data]);

  const unsubscribeMutation = trpc.unsubscribe.confirm.useMutation({
    onSuccess: () => setPhase("success"),
    onError: (err) => {
      setPhase("error");
      setErrorMsg(err.message ?? "Something went wrong. Please try again.");
    },
  });

  const handleConfirm = () => {
    unsubscribeMutation.mutate({ token, reason: reason.trim() || undefined });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0e1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#0f172a",
          border: "1px solid #1e3a5f",
          borderRadius: 12,
          padding: "40px 36px",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 32, fontSize: 18, fontWeight: 700, color: "#06b6d4", letterSpacing: "0.05em" }}>
          AgenThink<span style={{ color: "#f59e0b" }}>Mesh</span>
        </div>

        {/* Loading */}
        {phase === "loading" && (
          <div style={{ color: "#94a3b8", fontSize: 14 }}>Verifying your unsubscribe link…</div>
        )}

        {/* Confirm */}
        {phase === "confirm" && (
          <>
            <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
              Unsubscribe from emails
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
              You will no longer receive trial drip emails or weekly intelligence briefs from AgenThink Mesh.
              Your account and data remain intact — you can re-subscribe at any time from your account settings.
            </p>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", color: "#64748b", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Too many emails, not relevant, other…"
                maxLength={500}
                rows={3}
                style={{
                  width: "100%",
                  background: "#0a0e1a",
                  border: "1px solid #1e3a5f",
                  borderRadius: 8,
                  color: "#e2e8f0",
                  fontSize: 13,
                  padding: "10px 12px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={handleConfirm}
              disabled={unsubscribeMutation.isPending}
              style={{
                width: "100%",
                background: unsubscribeMutation.isPending ? "#1e3a5f" : "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 600,
                cursor: unsubscribeMutation.isPending ? "not-allowed" : "pointer",
                marginBottom: 12,
              }}
            >
              {unsubscribeMutation.isPending ? "Processing…" : "Confirm unsubscribe"}
            </button>
            <Link
              href="/"
              style={{ display: "block", textAlign: "center", color: "#475569", fontSize: 13, textDecoration: "none" }}
            >
              Cancel — keep receiving emails
            </Link>
          </>
        )}

        {/* Success */}
        {phase === "success" && (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
            <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
              You're unsubscribed
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
              You will no longer receive emails from AgenThink Mesh. Your account and all your data remain intact.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-block",
                background: "#06b6d4",
                color: "#0a0f1e",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to AgenThink Mesh
            </Link>
          </>
        )}

        {/* Already unsubscribed */}
        {phase === "already" && (
          <>
            <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
              Already unsubscribed
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
              This email address is already unsubscribed from AgenThink Mesh emails.
              If you'd like to re-subscribe, you can do so from your account settings.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-block",
                background: "#1e3a5f",
                color: "#e2e8f0",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to AgenThink Mesh
            </Link>
          </>
        )}

        {/* Error */}
        {phase === "error" && (
          <>
            <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
              Invalid link
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
              {errorMsg}
            </p>
            <Link
              href="/"
              style={{
                display: "inline-block",
                background: "#1e3a5f",
                color: "#e2e8f0",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to AgenThink Mesh
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
