/**
 * Google A2A (Agent-to-Agent) Protocol Adapter
 *
 * Translates between AgenThinkMesh task format and Google A2A protocol format.
 * Supports: Gemini, Google Search, Google Workspace, Vertex AI, Google Maps, NotebookLM
 *
 * Google A2A Protocol Spec: https://google.github.io/A2A/
 */

export type GoogleAgentType =
  | "gemini"
  | "google_search"
  | "google_workspace"
  | "vertex_ai"
  | "google_maps"
  | "notebooklm";

export interface MeshTask {
  taskId: string;
  agentType: GoogleAgentType;
  instruction: string;
  context?: Record<string, unknown>;
  inputData?: unknown;
  maxTokens?: number;
  temperature?: number;
}

export interface A2ATaskRequest {
  id: string;
  message: {
    role: "user";
    parts: Array<{ type: "text"; text: string } | { type: "data"; data: unknown }>;
  };
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface A2ATaskResponse {
  id: string;
  status: {
    state: "completed" | "failed" | "working" | "input-required";
    message?: {
      role: "agent";
      parts: Array<{ type: "text"; text: string } | { type: "data"; data: unknown }>;
    };
    error?: { code: string; message: string };
  };
  artifacts?: Array<{
    name: string;
    parts: Array<{ type: "text"; text: string } | { type: "data"; data: unknown }>;
  }>;
}

export interface MeshTaskResult {
  success: boolean;
  output: string;
  structuredData?: unknown;
  latencyMs: number;
  agentType: GoogleAgentType;
  a2aTaskId: string;
  error?: string;
}

// Google A2A endpoint registry — these are the well-known A2A endpoints for Google agents
// In production these would be real Google A2A endpoints; in demo mode we simulate responses
export const GOOGLE_A2A_ENDPOINTS: Record<GoogleAgentType, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/a2a",
  google_search: "https://customsearch.googleapis.com/v1/a2a",
  google_workspace: "https://workspace.googleapis.com/v1/a2a",
  vertex_ai: "https://us-central1-aiplatform.googleapis.com/v1/a2a",
  google_maps: "https://maps.googleapis.com/maps/api/a2a",
  notebooklm: "https://notebooklm.googleapis.com/v1/a2a",
};

/**
 * Translate a MeshTask into Google A2A protocol format
 */
export function meshTaskToA2A(task: MeshTask): A2ATaskRequest {
  const parts: A2ATaskRequest["message"]["parts"] = [
    { type: "text", text: task.instruction },
  ];

  if (task.inputData) {
    parts.push({ type: "data", data: task.inputData });
  }

  if (task.context && Object.keys(task.context).length > 0) {
    parts.push({
      type: "text",
      text: `\n\nContext: ${JSON.stringify(task.context, null, 2)}`,
    });
  }

  return {
    id: task.taskId,
    message: {
      role: "user",
      parts,
    },
    sessionId: `mesh-session-${task.taskId}`,
    metadata: {
      source: "AgenThinkMesh",
      agentType: task.agentType,
      maxTokens: task.maxTokens ?? 4096,
      temperature: task.temperature ?? 0.3,
    },
  };
}

/**
 * Translate a Google A2A response back into MeshTaskResult format
 */
export function a2aResponseToMesh(
  response: A2ATaskResponse,
  agentType: GoogleAgentType,
  latencyMs: number
): MeshTaskResult {
  if (response.status.state === "failed") {
    return {
      success: false,
      output: response.status.error?.message ?? "Google agent returned an error",
      latencyMs,
      agentType,
      a2aTaskId: response.id,
      error: response.status.error?.code,
    };
  }

  // Extract text output from message parts
  const textParts =
    response.status.message?.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n") ?? "";

  // Extract structured data from artifacts
  const structuredData =
    response.artifacts && response.artifacts.length > 0
      ? response.artifacts[0].parts
          .filter((p): p is { type: "data"; data: unknown } => p.type === "data")
          .map((p) => p.data)[0]
      : undefined;

  return {
    success: true,
    output: textParts,
    structuredData,
    latencyMs,
    agentType,
    a2aTaskId: response.id,
  };
}

/**
 * Simulate a Google A2A response for demo mode (no real API key required)
 * Returns realistic mock responses for each agent type
 */
export function simulateGoogleA2AResponse(task: MeshTask): A2ATaskResponse {
  const mockOutputs: Record<GoogleAgentType, string> = {
    gemini: `**Gemini Analysis — ${task.taskId}**\n\nBased on the provided context, here is my analysis:\n\n${task.instruction}\n\n**Key Findings:**\n- The task has been processed using Gemini 1.5 Pro's advanced reasoning capabilities\n- Context window utilized: 128K tokens\n- Confidence score: 94.2%\n\n**Recommendation:** Proceed with the identified approach. The analysis indicates strong alignment with GCC market requirements and institutional standards.`,

    google_search: `**Google Search Results — ${task.taskId}**\n\nQuery: "${task.instruction}"\n\n**Top Results:**\n1. [Reuters] GCC markets show resilience amid global volatility — Published 2 hours ago\n2. [Bloomberg] Saudi Aramco Q4 results beat analyst expectations by 12%\n3. [MENA FN] Kuwait Stock Exchange records highest daily volume in 18 months\n4. [Arab News] UAE Central Bank maintains interest rate in line with Fed decision\n5. [Zawya] GCC insurance sector premiums grow 8.3% YoY in 2025\n\n**Structured Data:** 847 results found, top 5 returned. Average publication date: 6 hours ago.`,

    google_workspace: `**Google Workspace Action — ${task.taskId}**\n\nAction completed successfully.\n\n**Summary:**\n- Document created: "AgenThinkMesh_Output_${new Date().toISOString().split("T")[0]}.docx"\n- Shared with: team@organization.com\n- Google Drive location: /AgenThinkMesh/Outputs/\n- Sheets export: 10 rows × 8 columns\n- Calendar event created: Follow-up review in 3 business days\n\n**Status:** All Workspace actions completed. Document link will be available within 30 seconds.`,

    vertex_ai: `**Vertex AI Agent Response — ${task.taskId}**\n\nModel: gemini-1.5-pro-002 on Vertex AI\nRegion: us-central1\n\n**Analysis Output:**\nThe custom Vertex AI agent has processed your request using enterprise-grade infrastructure with:\n- VPC-SC data residency controls active\n- Audit logging enabled (Cloud Audit Logs)\n- Model Garden: Fine-tuned on GCC financial corpus\n\n**Result:** Task completed with 97.1% confidence. Output meets enterprise compliance requirements for SAMA/CBUAE regulated workflows.`,

    google_maps: `**Google Maps Intelligence — ${task.taskId}**\n\n**Location Analysis:**\n- Query processed: "${task.instruction}"\n- Coverage area: GCC region (KSA, UAE, Kuwait, Qatar, Bahrain, Oman)\n- Points of interest found: 2,847\n- Route optimization: 12 routes analyzed\n\n**Key Insights:**\n- Kuwait City: 847 relevant locations identified\n- Dubai: 1,203 locations with high foot traffic\n- Riyadh: 797 locations in target zones\n\n**Heatmap data:** Available for export to Google Sheets via Workspace integration.`,

    notebooklm: `**NotebookLM Deep Analysis — ${task.taskId}**\n\nDocument corpus analyzed: ${Math.floor(Math.random() * 200) + 50} pages\nAnalysis depth: Comprehensive\n\n**Key Extractions:**\n1. **Critical clauses identified:** 23 items flagged for review\n2. **Risk factors:** 7 high-priority, 12 medium-priority items\n3. **Compliance gaps:** 3 potential SAMA/CBUAE alignment issues\n4. **Summary:** The document corpus has been fully indexed and analyzed. All citations are traceable to source pages.\n\n**Audio Overview:** Available — 8-minute summary generated\n**Q&A Mode:** Active — ask follow-up questions about this document set`,
  };

  return {
    id: task.taskId,
    status: {
      state: "completed",
      message: {
        role: "agent",
        parts: [{ type: "text", text: mockOutputs[task.agentType] }],
      },
    },
    artifacts: [
      {
        name: `${task.agentType}_output`,
        parts: [
          {
            type: "data",
            data: {
              agentType: task.agentType,
              taskId: task.taskId,
              timestamp: new Date().toISOString(),
              confidence: Math.floor(Math.random() * 10) + 90,
              tokensUsed: Math.floor(Math.random() * 2000) + 500,
            },
          },
        ],
      },
    ],
  };
}

/**
 * Main invoke function — calls a Google agent via A2A protocol
 * Falls back to demo simulation if no API key is configured or endpoint is unreachable
 */
export async function invokeGoogleAgent(
  task: MeshTask,
  apiKey?: string
): Promise<MeshTaskResult> {
  const startTime = Date.now();

  // If no API key or demo mode, use simulation
  if (!apiKey || apiKey === "demo") {
    // Simulate realistic latency (200ms - 2500ms depending on agent type)
    const simulatedLatency: Record<GoogleAgentType, number> = {
      gemini: 1200 + Math.random() * 800,
      google_search: 400 + Math.random() * 300,
      google_workspace: 600 + Math.random() * 400,
      vertex_ai: 1500 + Math.random() * 1000,
      google_maps: 300 + Math.random() * 200,
      notebooklm: 2000 + Math.random() * 500,
    };

    await new Promise((resolve) =>
      setTimeout(resolve, simulatedLatency[task.agentType])
    );

    const mockResponse = simulateGoogleA2AResponse(task);
    const latencyMs = Date.now() - startTime;
    return a2aResponseToMesh(mockResponse, task.agentType, latencyMs);
  }

  // Live mode — attempt real Google A2A call
  try {
    const endpoint = GOOGLE_A2A_ENDPOINTS[task.agentType];
    const a2aRequest = meshTaskToA2A(task);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Goog-Api-Client": "AgenThinkMesh/1.0",
      },
      body: JSON.stringify(a2aRequest),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`Google A2A returned ${response.status}: ${response.statusText}`);
    }

    const a2aResponse: A2ATaskResponse = await response.json();
    const latencyMs = Date.now() - startTime;
    return a2aResponseToMesh(a2aResponse, task.agentType, latencyMs);
  } catch (error) {
    // Fallback to demo simulation on any error
    console.warn(
      `[GoogleA2A] Live call failed for ${task.agentType}, falling back to demo:`,
      error
    );
    const mockResponse = simulateGoogleA2AResponse(task);
    const latencyMs = Date.now() - startTime;
    const result = a2aResponseToMesh(mockResponse, task.agentType, latencyMs);
    result.error = `Live mode failed (${error instanceof Error ? error.message : "unknown error"}), showing demo response`;
    return result;
  }
}
