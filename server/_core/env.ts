export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleApiKey: process.env.GOOGLE_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  // ── DeepSeek eval infrastructure ──────────────────────────────────────────
  /** DeepSeek API key — set via Settings → Secrets when ready to activate */
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  /** DeepSeek API base URL (OpenAI-compatible) */
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  /**
   * Feature flag — set to "true" to activate DeepSeek-first eval routing.
   * Default "false" keeps existing Claude/Forge path unchanged.
   */
  enableDeepseekRouting: process.env.ENABLE_DEEPSEEK_ROUTING === "true",
  /** Default eval model (DeepSeek Flash / deepseek-chat) */
  defaultEvalModel: process.env.AGENTHINK_DEFAULT_EVAL_MODEL ?? "deepseek-chat",
  /** Escalation eval model (DeepSeek Reasoner / deepseek-reasoner) */
  strongEvalModel: process.env.AGENTHINK_STRONG_EVAL_MODEL ?? "deepseek-reasoner",
  /**
   * Emergency fallback model identifier.
   * "claude" → use existing invokeLLM() Forge/Claude path.
   */
  fallbackModel: process.env.AGENTHINK_FALLBACK_MODEL ?? "claude",
};
