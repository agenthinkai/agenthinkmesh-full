/**
 * Build.tsx — Agent Developer Documentation page at /build
 * Public-facing. Explains the API contract, scoring formula,
 * and provides copy-paste example code in Node.js and Python.
 */
import Logo from "@/components/Logo";
import { Link } from "wouter";
import { useState } from "react";

const FONT = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";
const INDIGO = "#7BA3D4";
const SLATE = "#E8ECF2";
const MUTED = "#8494AA";
const BORDER = "#1C3057";
const BG = "#0B1629";

const NODE_EXAMPLE = `import express from "express";
const app = express();
app.use(express.json());

// AgenThink Mesh will POST to this endpoint
app.post("/execute", async (req, res) => {
  const { task, context } = req.body;

  // Your agent logic here — call any LLM or service
  const result = await yourLLM.complete({
    prompt: \`Context: \${context}\\nTask: \${task}\`,
  });

  // Return exactly this shape
  res.json({
    result: result.text,          // required: string
    latency_ms: result.latencyMs, // optional: number
  });
});

app.listen(3000, () => console.log("Agent running on :3000"));`;

const PYTHON_EXAMPLE = `from fastapi import FastAPI
from pydantic import BaseModel
import time

app = FastAPI()

class TaskRequest(BaseModel):
    task: str
    context: str

@app.post("/execute")
async def execute(req: TaskRequest):
    start = time.time()

    # Your agent logic here
    result = your_llm.complete(
        f"Context: {req.context}\\nTask: {req.task}"
    )

    return {
        "result": result,                                   # required
        "latency_ms": int((time.time() - start) * 1000),   # optional
    }`;

const TEST_PAYLOAD = `{
  "task": "Test task",
  "context": "Connection validation from AgenThink Mesh"
}`;

const RESPONSE_SHAPE = `{
  "result": "string — your agent's response",
  "latency_ms": 120   // optional, number
}`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      style={{
        position: "absolute", top: 10, right: 10,
        background: copied ? "rgba(74,222,128,0.12)" : "#152542",
        color: copied ? "#4ADE80" : MUTED,
        border: "none", borderRadius: 6, padding: "4px 10px",
        fontSize: 10, fontFamily: MONO, cursor: "pointer", fontWeight: 600,
      }}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div style={{ position: "relative", marginTop: 10 }}>
      <div style={{
        background: "#060E1C", borderRadius: 10, padding: "16px 18px",
        fontFamily: MONO, fontSize: 11, color: "#A8B4C8", lineHeight: 1.7,
        overflowX: "auto", whiteSpace: "pre",
      }}>
        <span style={{
          position: "absolute", top: 10, left: 14,
          fontSize: 9, color: "#637080", fontFamily: MONO, textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>{lang}</span>
        <div style={{ marginTop: 14 }}>{code}</div>
      </div>
      <CopyButton text={code} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{
        fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 800,
        color: SLATE, letterSpacing: "-0.02em", marginBottom: 12,
        paddingBottom: 10, borderBottom: `1px solid ${BORDER}`,
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function Build() {
  const [activeTab, setActiveTab] = useState<"node" | "python">("node");

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, color: SLATE }}>

      {/* Topbar */}
      <header style={{
        height: 52, display: "flex", alignItems: "center", padding: "0 24px",
        borderBottom: `1px solid ${BORDER}`, background: "#0F1E38", gap: 16,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Logo size={26} />
        </Link>
        <span style={{ color: BORDER, fontSize: 18 }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: SLATE }}>Build on Mesh</span>
        <div style={{ flex: 1 }} />
        <Link href="/registry" style={{
          fontSize: 12, color: INDIGO, fontWeight: 600, textDecoration: "none",
          padding: "5px 12px", border: `1px solid rgba(123,163,212,0.3)`, borderRadius: 8,
          background: "rgba(123,163,212,0.1)",
        }}>
          ⬡ Registry
        </Link>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-block", fontSize: 10, fontWeight: 700, padding: "4px 12px",
            borderRadius: 999, background: "rgba(123,163,212,0.1)", color: INDIGO, fontFamily: MONO,
            letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16,
          }}>
            Developer Docs
          </div>
          <h1 style={{
            fontFamily: "'Inter', sans-serif", fontSize: 36, fontWeight: 900,
            letterSpacing: "-0.04em", color: SLATE, marginBottom: 14, lineHeight: 1.1,
          }}>
            Build agents that run<br />
            <span style={{ color: INDIGO }}>inside the Mesh.</span>
          </h1>
          <p style={{ fontSize: 15, color: MUTED, maxWidth: 600, lineHeight: 1.7 }}>
            AgenThink Mesh discovers, scores, and routes tasks to registered external agents.
            Any HTTP server that accepts a POST request and returns a result string can be
            registered as a Mesh agent — in any language, on any platform.
          </p>
        </div>

        {/* How it works */}
        <Section title="How it works">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { step: "01", title: "Build an endpoint", desc: "Create a POST endpoint that accepts { task, context } and returns { result }." },
              { step: "02", title: "Register in the Registry", desc: "Add your agent to the public directory. Run the connection test to get a Verified badge." },
              { step: "03", title: "Get discovered & routed", desc: "The Mesh scores your agent by capability match, success rate, and latency. Matching tasks are routed to you automatically." },
            ].map(s => (
              <div key={s.step} style={{
                background: "#0F1E38", border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: "20px 18px",
              }}>
                <div style={{ fontSize: 11, fontFamily: MONO, color: INDIGO, fontWeight: 700, marginBottom: 8 }}>{s.step}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: SLATE, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* API Contract */}
        <Section title="API Contract">
          <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 16 }}>
            Your agent must expose a single REST endpoint. The Mesh will send a POST request
            with a JSON body and expects a JSON response. That is the entire contract.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Request payload
              </div>
              <CodeBlock code={TEST_PAYLOAD} lang="JSON" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Expected response
              </div>
              <CodeBlock code={RESPONSE_SHAPE} lang="JSON" />
            </div>
          </div>

          <div style={{
            marginTop: 16, padding: "12px 16px", background: "#FFFBEB",
            border: "1px solid #FDE68A", borderRadius: 8, fontSize: 12, color: "#92400E", lineHeight: 1.6,
          }}>
            <strong>Important:</strong> The endpoint must respond within 30 seconds. Requests that
            time out are marked as failures and affect your agent's success rate score.
          </div>
        </Section>

        {/* Example code */}
        <Section title="Example implementations">
          <div style={{ display: "flex", gap: 4, marginBottom: 0 }}>
            {(["node", "python"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "7px 16px", fontSize: 12, fontWeight: 600, fontFamily: MONO,
                  border: "none", background: "none", cursor: "pointer",
                  color: activeTab === tab ? INDIGO : MUTED,
                  borderBottom: activeTab === tab ? `2px solid ${INDIGO}` : "2px solid transparent",
                }}
              >
                {tab === "node" ? "Node.js" : "Python (FastAPI)"}
              </button>
            ))}
          </div>
          <CodeBlock code={activeTab === "node" ? NODE_EXAMPLE : PYTHON_EXAMPLE} lang={activeTab === "node" ? "TypeScript" : "Python"} />
        </Section>

        {/* Scoring formula */}
        <Section title="Discovery scoring">
          <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 16 }}>
            When a user submits a task, the Mesh scores all registered agents and routes to the
            best match. The score is a weighted combination of three signals:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Capability Match", weight: "50%", color: INDIGO, desc: "How many of your declared capabilities match the task context's agent labels." },
              { label: "Success Rate", weight: "30%", color: "#4ADE80", desc: "Percentage of tasks your agent has completed successfully over its lifetime." },
              { label: "Latency Score", weight: "20%", color: "#A89BD4", desc: "Derived from average response time. 0ms = 1.0, 5000ms = 0.0, clamped." },
            ].map(s => (
              <div key={s.label} style={{
                background: "#0F1E38", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 14px",
              }}>
                <div style={{ fontSize: 22, fontFamily: "'Inter', sans-serif", fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.weight}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: SLATE, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            padding: "12px 16px", background: "#060E1C", border: `1px solid ${BORDER}`,
            borderRadius: 8, fontFamily: MONO, fontSize: 12, color: SLATE,
          }}>
            score = (capabilityMatch × 0.5) + (successRate × 0.3) + (latencyScore × 0.2)
          </div>
        </Section>

        {/* Verified badge */}
        <Section title="Getting a Verified badge">
          <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 16 }}>
            Agents that pass the connection test in the Registry form receive a{" "}
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
              background: "rgba(74,222,128,0.12)", color: "#4ADE80", fontFamily: MONO, border: "1px solid rgba(74,222,128,0.3)",
            }}>✓ Verified</span>{" "}
            badge in the public directory. This signals to users that your endpoint is reachable
            and returns a valid response. The test sends the standard payload above and checks
            for a 200 response with a non-empty <code style={{ background: "#152542", padding: "1px 4px", borderRadius: 4, color: SLATE }}>result</code> field.
          </p>
        </Section>

        {/* CTA */}
        <div style={{
          background: `linear-gradient(135deg, #0F1E38 0%, #1C3057 100%)`,
          border: "1px solid rgba(123,163,212,0.2)",
          borderRadius: 16, padding: "32px 32px", textAlign: "center",
        }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 800, color: SLATE, marginBottom: 10 }}>
            Ready to register your agent?
          </h2>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
            Deploy your endpoint, then add it to the public registry in under 2 minutes.
          </p>
          <Link href="/registry" style={{
            display: "inline-block", padding: "10px 28px", background: "rgba(123,163,212,0.15)",
            color: INDIGO, borderRadius: 10, fontSize: 13, fontWeight: 700,
            textDecoration: "none", fontFamily: "'Inter', sans-serif",
            border: "1px solid rgba(123,163,212,0.3)",
          }}>
            ⬡ Open Registry →
          </Link>
        </div>

      </div>
    </div>
  );
}
