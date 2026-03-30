/**
 * lib/llm/invokeAgent.ts
 *
 * Unified LLM Adapter — AgenThinkMesh V2.2
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  ACTIVE:  Global region → Anthropic SDK                        │
 * │  STUBBED: China region  → Activate by setting CHINA_LLM=true   │
 * │           (requires DASHSCOPE_API_KEY, DEEPSEEK_API_KEY,        │
 * │            QIANFAN_API_KEY in environment)                      │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Model mapping (Global / Anthropic):
 *   default   → claude-sonnet-4-5  (standard agent tasks)
 *   debate    → claude-opus-4-5    (council / adversarial reasoning)
 *   streaming → claude-haiku-3-5   (real-time / high-volume calls)
 *
 * All responses are normalised to AgentLLMResponse:
 *   { content: string, model: string, region: RegionProfile }
 *
 * China providers can be activated later without refactoring:
 *   1. Set env CHINA_LLM=true
 *   2. Add DASHSCOPE_API_KEY, DEEPSEEK_API_KEY, QIANFAN_API_KEY
 *   3. The stub below will route automatically.
 */

import { invokeLLM, type Message } from "../../_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegionProfile = "Global" | "China";
export type ModelRole = "default" | "debate" | "streaming";

export interface InvokeAgentParams {
  region: RegionProfile;
  role: ModelRole;
  messages: Message[];
  systemPrompt?: string;
}

export interface AgentLLMResponse {
  content: string;
  model: string;
  region: RegionProfile;
}

// ── Custom errors ─────────────────────────────────────────────────────────────

export class UnsupportedRegionError extends Error {
  constructor(region: string) {
    super(
      `Unsupported region: "${region}". ` +
      `Supported regions are "Global" and "China". ` +
      `China routing requires CHINA_LLM=true and China API keys.`
    );
    this.name = "UnsupportedRegionError";
  }
}

export class ChinaModelError extends Error {
  constructor(provider: string, message: string) {
    super(`China LLM provider "${provider}" error: ${message}`);
    this.name = "ChinaModelError";
  }
}

export class ChinaRegionNotEnabledError extends Error {
  constructor() {
    super(
      "China region routing is not enabled in this environment. " +
      "Set CHINA_LLM=true and provide DASHSCOPE_API_KEY, DEEPSEEK_API_KEY, " +
      "and QIANFAN_API_KEY to activate China model routing."
    );
    this.name = "ChinaRegionNotEnabledError";
  }
}

// ── Global model map (Anthropic) ──────────────────────────────────────────────

const GLOBAL_MODELS: Record<ModelRole, string> = {
  default:   "claude-sonnet-4-5",
  debate:    "claude-opus-4-5",
  streaming: "claude-haiku-3-5",
};

// ── China model map (stubbed — not active) ────────────────────────────────────
// These values are correct and ready. Activation: set CHINA_LLM=true in env.

const CHINA_MODELS: Record<ModelRole, { provider: "dashscope" | "deepseek" | "qianfan"; model: string }> = {
  default:   { provider: "dashscope", model: "qwen-plus" },
  debate:    { provider: "deepseek",  model: "deepseek-chat" },
  streaming: { provider: "qianfan",   model: "ernie-speed" },
};

// ── Global handler (Anthropic SDK via existing invokeLLM helper) ──────────────

async function invokeGlobal(params: InvokeAgentParams): Promise<AgentLLMResponse> {
  const model = GLOBAL_MODELS[params.role];
  const messages: Message[] = params.systemPrompt
    ? [{ role: "system", content: params.systemPrompt }, ...params.messages]
    : params.messages;

  const response = await invokeLLM({ messages, model });
  const raw = response?.choices?.[0]?.message?.content ?? "";

  return {
    content: typeof raw === "string" ? raw : JSON.stringify(raw),
    model,
    region: "Global",
  };
}

// ── China handler (stubbed — activate by setting CHINA_LLM=true) ──────────────

async function invokeChina(params: InvokeAgentParams): Promise<AgentLLMResponse> {
  // Guard: China routing is disabled unless explicitly enabled
  if (process.env.CHINA_LLM !== "true") {
    throw new ChinaRegionNotEnabledError();
  }

  const { provider, model } = CHINA_MODELS[params.role];

  // Normalise messages to plain string content for REST APIs
  const normalised = params.messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));

  if (params.systemPrompt) {
    normalised.unshift({ role: "system", content: params.systemPrompt });
  }

  let content = "";

  if (provider === "dashscope") {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new ChinaModelError("dashscope", "DASHSCOPE_API_KEY is not set");
    const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: normalised }),
    });
    if (!res.ok) throw new ChinaModelError("dashscope", `HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    content = data?.choices?.[0]?.message?.content ?? "";

  } else if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new ChinaModelError("deepseek", "DEEPSEEK_API_KEY is not set");
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: normalised }),
    });
    if (!res.ok) throw new ChinaModelError("deepseek", `HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    content = data?.choices?.[0]?.message?.content ?? "";

  } else if (provider === "qianfan") {
    const apiKey = process.env.QIANFAN_API_KEY;
    if (!apiKey) throw new ChinaModelError("qianfan", "QIANFAN_API_KEY is not set");
    const modelSlug = model.replace(/-/g, "_");
    const res = await fetch(`https://qianfan.baidubce.com/v2/chat/${modelSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ messages: normalised }),
    });
    if (!res.ok) throw new ChinaModelError("qianfan", `HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as { result?: string; choices?: Array<{ message?: { content?: string } }> };
    content = data?.result ?? data?.choices?.[0]?.message?.content ?? "";
  }

  return { content, model, region: "China" };
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * invokeAgent — unified LLM dispatcher.
 *
 * Currently routes Global → Anthropic only.
 * China routing is stubbed and activates when CHINA_LLM=true is set.
 *
 * @example
 *   const result = await invokeAgent({
 *     region: "Global",
 *     role: "default",
 *     messages: [{ role: "user", content: "Analyse this deal." }],
 *     systemPrompt: "You are a senior investment analyst.",
 *   });
 *   // result.model === "claude-sonnet-4-5"
 *   // result.region === "Global"
 */
export async function invokeAgent(params: InvokeAgentParams): Promise<AgentLLMResponse> {
  switch (params.region) {
    case "Global":
      return invokeGlobal(params);
    case "China":
      return invokeChina(params);
    default:
      throw new UnsupportedRegionError(params.region as string);
  }
}

/**
 * isChinaEnabled — returns true if China region routing is active.
 * Use this in UI/admin panels to show/hide China-specific features.
 */
export function isChinaEnabled(): boolean {
  return process.env.CHINA_LLM === "true";
}
