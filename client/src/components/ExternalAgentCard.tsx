import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

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
  const [status, setStatus] = useState<"running" | "done" | "error">("running");
  const [content, setContent] = useState("");
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
        const text = res.result;
        let i = 0;
        const tw = setInterval(() => {
          i += 6;
          setContent(text.slice(0, i));
          if (i >= text.length) {
            clearInterval(tw);
            setStatus(res.success ? "done" : "error");
            onDone(label, text);
          }
        }, 12);
      })
      .catch((err: unknown) => {
        clearInterval(timerRef.current!);
        const msg = err instanceof Error ? err.message : String(err);
        setContent(`Error: ${msg}`);
        setStatus("error");
        onDone(label, `Error: ${msg}`);
      });

    return () => clearInterval(timerRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chipStyle = {
    running: { label: "Running", bg: "#EEF2FF", color: "#4F46E5" },
    done: { label: "Done", bg: "#DCFCE7", color: "#16A34A" },
    error: { label: "Error", bg: "#FEE2E2", color: "#DC2626" },
  }[status];

  return (
    <div
      style={{
        background: "#FAFBFF",
        border: `1px solid ${
          status === "done"
            ? "#BBF7D0"
            : status === "error"
            ? "#FECACA"
            : "#C7D2FE"
        }`,
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 10,
        boxShadow: "0 2px 12px rgba(99,102,241,0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#6366F1",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#374151",
            flex: 1,
          }}
        >
          {agentName}
          <span
            style={{
              marginLeft: 6,
              fontSize: 8,
              padding: "1px 6px",
              borderRadius: 999,
              background: "#EEF2FF",
              color: "#4F46E5",
              border: "1px solid #C7D2FE",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            External
          </span>
        </span>
        <span
          style={{
            fontSize: 9,
            padding: "2px 8px",
            borderRadius: 999,
            background: chipStyle.bg,
            color: chipStyle.color,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 600,
          }}
        >
          {chipStyle.label}
        </span>
        <span
          style={{
            fontSize: 9,
            color: "#94A3B8",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {elapsed}s
        </span>
      </div>
      {content ? (
        <pre
          style={{
            margin: 0,
            fontSize: 10,
            color: "#374151",
            lineHeight: 1.7,
            fontFamily: "'DM Mono', monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content}
        </pre>
      ) : (
        <div
          style={{
            fontSize: 10,
            color: "#CBD5E1",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          Connecting to external agent...
        </div>
      )}
    </div>
  );
}
