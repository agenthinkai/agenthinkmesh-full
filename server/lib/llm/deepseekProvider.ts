/**
 * deepseekProvider.ts — Thin OpenAI-compatible DeepSeek client
 *
 * Calls the DeepSeek API (OpenAI-compatible endpoint) directly.
 * Reads credentials from ENV — no SDK dependency, pure fetch.
 *
 * Used exclusively by evalRouter.ts. Do NOT import this in any
 * other file; all call sites must go through evalRouter.
 */

import { ENV } from "../../_core/env";
import type { Message } from "../../_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeepSeekCallParams {
  messages: Message[];
  model: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface DeepSeekResult {
  content: string;
  model: string;
  provider: "deepseek";
  inputTokens: number;
  outputTokens: number;
}

export class DeepSeekError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export class DeepSeekKeyMissingError extends Error {
  constructor() {
    super(
      "DEEPSEEK_API_KEY is not set. " +
      "Add it via Settings → Secrets and set ENABLE_DEEPSEEK_ROUTING=true to activate.",
    );
    this.name = "DeepSeekKeyMissingError";
  }
}

// ── Normalise messages to plain role/content pairs ────────────────────────────
// DeepSeek's OpenAI-compatible API accepts only string content.

function normaliseMessages(
  messages: Message[],
): Array<{ role: string; content: string }> {
  return messages.map((m) => {
    const content =
      typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .map((c) => (typeof c === "object" && "text" in c ? c.text : ""))
              .join("")
          : String(m.content);
    return { role: m.role, content };
  });
}

// ── Main call ─────────────────────────────────────────────────────────────────

/**
 * callDeepSeek — single inference call against the DeepSeek API.
 *
 * Throws DeepSeekKeyMissingError if the API key is absent.
 * Throws DeepSeekError on non-2xx HTTP responses.
 * Propagates AbortError when the signal fires (timeout handled by caller).
 */
export async function callDeepSeek(
  params: DeepSeekCallParams,
): Promise<DeepSeekResult> {
  const { messages, model, maxTokens = 2048, signal } = params;

  if (!ENV.deepseekApiKey) {
    throw new DeepSeekKeyMissingError();
  }

  const baseUrl = (ENV.deepseekBaseUrl || "https://api.deepseek.com").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;

  const body = JSON.stringify({
    model,
    messages: normaliseMessages(messages),
    max_tokens: maxTokens,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.deepseekApiKey}`,
    },
    body,
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unreadable)");
    throw new DeepSeekError(
      response.status,
      `DeepSeek API error ${response.status} ${response.statusText}: ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: DeepSeekUsage;
  };

  const content = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage;

  return {
    content,
    model: data?.model ?? model,
    provider: "deepseek",
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
  };
}
