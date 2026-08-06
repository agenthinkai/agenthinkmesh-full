// ─────────────────────────────────────────────────────────────────────────────
// CapTwin Shared Module — server-safe barrel export
// Consumed by:
//   - server/routers/lpTwin.ts  (scoring engine, LP registry)
//   - client/src/lib/*          (existing client imports unchanged)
// ─────────────────────────────────────────────────────────────────────────────

// Engine version — increment when scoring logic changes so historical
// session results remain reproducible after future updates.
export const CAPTWIN_ENGINE_VERSION = "1.0.0";
export const CAPTWIN_REGISTRY_VERSION = "1.0.0";

export * from "./lpRegistry";
export * from "./engine";
export * from "./icAgents";

// ── WP4 modules ───────────────────────────────────────────────────────────────
export * from "./agentBank";
export * from "./fitEngine";
export * from "./objectionEngine";
