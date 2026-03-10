import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

// ── Friendly error message helper ─────────────────────────────────────────────
function friendlyError(raw: string): { message: string; hint: string | null } {
  const s = raw.toLowerCase();
  if (s.includes("429") || s.includes("rate limit") || s.includes("too many requests")) {
    return {
      message: "External agent is rate-limited — the endpoint has received too many requests.",
      hint: "This is a temporary limit on the external agent's API. Try again in a few minutes, or remove the agent from the registry if it is no longer available.",
    };
  }
  if (s.includes("timeout") || s.includes("timed out") || s.includes("econnreset")) {
    return {
      message: "External agent did not respond in time.",
      hint: "The endpoint may be offline or slow. Check the agent's status in the Registry.",
    };
  }
  if (s.includes("401") || s.includes("403") || s.includes("unauthorized") || s.includes("forbidden")) {
    return {
      message: "External agent rejected the request (authentication error).",
      hint: "The agent endpoint may require an API key or has revoked access.",
    };
  }
  if (s.includes("404") || s.includes("not found")) {
    return {
      message: "External agent endpoint not found (HTTP 404).",
      hint: "The agent may have moved or been decommissioned. Update the endpoint URL in the Registry.",
    };
  }
  if (s.includes("500") || s.includes("502") || s.includes("503") || s.includes("internal server")) {
    return {
      message: "External agent returned a server error.",
      hint: "The agent's server is experiencing issues. Try again later.",
    };
  }
  return { message: raw, hint: null };
}

// ExternalAgentCard — routes a task to a registered external agent endpoint
// and displays the result in the same card format as internal AgentCards.
export function ExternalAgentCard({
  agentId,
  agentName,
  taskText,
  contextLabel,
  onDone,
}: {
  agentId: number;
  agentName: string;
  taskText: string;
  contextLabel: string;
  onDone: (label: string, text: string) => void;
}) {
  const [status, setStatus] = useState<"running" | "done" | "error" | "skipped">("running");
  const [content, setContent] = useState("");
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());
  const routeTask = trpc.agent.routeTask.useMutation();
  const label = `[External] ${agentName}`;

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1000
    );

    routeTask
      .mutateAsync({ agentId, task: taskText, context: contextLabel })
      .then((res) => {
        clearInterval(timerRef.current!);

        // If the server returned success:false with an error message, treat as error
        if (!res.success && res.result) {
          const { message, hint } = friendlyError(res.result);
          setContent(message);
          setErrorHint(hint);
          setStatus("error");
          onDone(label, `[External agent error] ${message}`);
          return;
        }

        const text = res.result;
        let i = 0;
        const tw = setInterval(() => {
          i += 6;
          setContent(text.slice(0, i));
          if (i >= text.length) {
            clearInterval(tw);
            setStatus("done");
            onDone(label, text);
          }
        }, 12);
      })
      .catch((err: unknown) => {
        clearInterval(timerRef.current!);
        const raw = err instanceof Error ? err.message : String(err);
        const { message, hint } = friendlyError(raw);
        setContent(message);
        setErrorHint(hint);
        setStatus("error");
        // Still call onDone so the completion gate isn't blocked
        onDone(label, `[External agent error] ${message}`);
      });

    return () => clearInterval(timerRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chipStyle = {
    running: { label: "Running", bg: "rgba(123,163,212,0.15)", color: "#7BA3D4" },
    done:    { label: "Done",    bg: "rgba(74,222,128,0.12)",  color: "#4ADE80" },
    error:   { label: "Error",   bg: "rgba(239,68,68,0.12)",   color: "#EF4444" },
    skipped: { label: "Skipped", bg: "rgba(74,85,104,0.12)",   color: "#4A5568" },
  }[status];

  const isError = status === "error";

  return (
    <div
      style={{
        background: "#0F1E38",
        border: `1px solid ${
          status === "done"
            ? "rgba(74,222,128,0.3)"
            : isError
            ? "rgba(239,68,68,0.2)"
            : "rgba(123,163,212,0.25)"
        }`,
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 10,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        opacity: isError ? 0.85 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: content ? 8 : 0 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isError ? "#EF4444" : "#7BA3D4",
            display: "inline-block", flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600,
            color: "#E8ECF2", flex: 1,
          }}
        >
          {agentName}
          <span
            style={{
              marginLeft: 6, fontSize: 8, padding: "1px 6px", borderRadius: 999,
              background: "rgba(123,163,212,0.12)", color: "#7BA3D4",
              border: "1px solid rgba(123,163,212,0.25)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            External
          </span>
        </span>
        <span
          style={{
            fontSize: 9, padding: "2px 8px", borderRadius: 999,
            background: chipStyle.bg, color: chipStyle.color,
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
          }}
        >
          {chipStyle.label}
        </span>
        <span style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>
          {elapsed}s
        </span>
      </div>

      {/* Content / error display */}
      {content ? (
        <div>
          <pre
            style={{
              margin: 0, fontSize: 10,
              color: isError ? "#F87171" : "#A8B4C8",
              lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
          >
            {content}
          </pre>
          {isError && errorHint && (
            <div
              style={{
                marginTop: 8, padding: "7px 10px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 8, fontSize: 10,
                color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1.6,
              }}
            >
              💡 {errorHint}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "'DM Mono', monospace" }}>
          Connecting to external agent...
        </div>
      )}
    </div>
  );
}
