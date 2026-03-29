import { boolean, decimal, index, int, longtext, mysqlEnum, mysqlTable, text, tinyint, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  orgId: varchar("orgId", { length: 64 }), // Gap 8: multi-tenant isolation
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),

  // ── Billing & Trial ──────────────────────────────────────────────────────────
  planTier: mysqlEnum("planTier", ["trial", "standard", "pro", "professional", "enterprise"]).notNull().default("trial"),
  trialRunsRemaining: int("trialRunsRemaining").notNull().default(50),
  trialStartedAt: timestamp("trialStartedAt"),
  trialExpiresAt: timestamp("trialExpiresAt"),
  monthlyRunsLimit: int("monthlyRunsLimit"),
  monthlyRunsUsed: int("monthlyRunsUsed").notNull().default(0),
  billingCycleAnchor: timestamp("billingCycleAnchor"),
  convertedAt: timestamp("convertedAt"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),

  // ── Email drip tracking ───────────────────────────────────────────────────────
  emailDay1SentAt: timestamp("emailDay1SentAt"),
  emailDay15SentAt: timestamp("emailDay15SentAt"),
  emailDay45SentAt: timestamp("emailDay45SentAt"),
  emailDay55SentAt: timestamp("emailDay55SentAt"),
  emailDay60SentAt: timestamp("emailDay60SentAt"),

  // ── Usage totals ──────────────────────────────────────────────────────────────
  totalCompletedRuns: int("totalCompletedRuns").notNull().default(0),
  totalAgentsFired: int("totalAgentsFired").notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// AgenThinkMesh tables
export const taskHistory = mysqlTable("task_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  task: text("task").notNull(),
  contextKey: varchar("contextKey", { length: 64 }).notNull(),
  contextLabel: varchar("contextLabel", { length: 128 }).notNull(),
  agentCount: int("agentCount").notNull().default(0),
  outputs: text("outputs"), // JSON string of { agentLabel: output }
  agentsUsed: text("agentsUsed"), // JSON array of agent IDs used in routing
  executionTime: int("executionTime"), // ms
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskHistory = typeof taskHistory.$inferSelect;
export type InsertTaskHistory = typeof taskHistory.$inferInsert;

export const vaultDocuments = mysqlTable("vault_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  extractedText: text("extractedText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VaultDocument = typeof vaultDocuments.$inferSelect;
export type InsertVaultDocument = typeof vaultDocuments.$inferInsert;

// ── Agent Registry ────────────────────────────────────────────────────────────
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // FK → users.id
  agentName: varchar("agentName", { length: 128 }).notNull(),
  developerName: varchar("developerName", { length: 128 }).notNull(),
  description: text("description").notNull(),
  capabilities: text("capabilities").notNull(), // JSON array of capability strings
  endpointUrl: varchar("endpointUrl", { length: 512 }).notNull(),
  averageLatency: int("averageLatency").notNull().default(500), // ms, self-reported
  pricingModel: mysqlEnum("pricingModel", ["free", "per_task", "subscription"]).notNull().default("free"),
  status: mysqlEnum("status", ["active", "inactive", "pending", "degraded"]).notNull().default("active"),
  connectionTested: boolean("connectionTested").notNull().default(false), // true if endpoint passed validation
  webhookUrl: varchar("webhookUrl", { length: 512 }), // optional: POST result payload here after task execution
  orgId: varchar("orgId", { length: 64 }), // optional: tenant isolation
  domain: varchar("domain", { length: 64 }), // e.g. Finance, Legal, Healthcare, Enterprise, GCC Wealth
  isBuiltIn: boolean("isBuiltIn").notNull().default(false), // true for platform-seeded agents
  isCustom: boolean("isCustom").notNull().default(false), // true for user-created AI-generated agents
  // Registry versioning & health tracking
  version: varchar("version", { length: 32 }).notNull().default("1.0.0"),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  failCount: int("failCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

// ── Roles (personas shown on Step 1 of persona-setup) ────────────────────────
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(), // e.g. Doctor, Lawyer
  icon: varchar("icon", { length: 8 }).notNull().default("🤖"),
  color: varchar("color", { length: 16 }).notNull().default("#7BA3D4"),
  domain: varchar("domain", { length: 64 }).notNull(), // maps to agents.domain
  persona: varchar("persona", { length: 64 }).notNull(), // e.g. FUND_MANAGER
  description: text("description").notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

// ── Agent Reputation / Metrics ────────────────────────────────────────────────
export const agentMetrics = mysqlTable("agent_metrics", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull().unique(), // FK → agents.id
  tasksCompleted: int("tasksCompleted").notNull().default(0),
  successRate: decimal("successRate", { precision: 5, scale: 2 }).notNull().default("80.00"), // neutral default
  avgLatency: int("avgLatency").notNull().default(500), // ms, measured
  errorRate: decimal("errorRate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentMetrics = typeof agentMetrics.$inferSelect;
export type InsertAgentMetrics = typeof agentMetrics.$inferInsert;

// ── Arabic Annotation Pipeline ────────────────────────────────────────────────
export const annotations = mysqlTable("annotations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agentId: int("agentId").notNull(),           // FK → agents.id
  agentName: varchar("agentName", { length: 128 }).notNull(),
  inputText: text("inputText").notNull(),       // original Arabic text submitted
  context: varchar("context", { length: 256 }), // optional domain context
  label: varchar("label", { length: 128 }).notNull(),  // top-level label
  confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull(), // 0.000–1.000
  dialect: varchar("dialect", { length: 64 }),  // gulf/msa/levantine/etc
  rationale: text("rationale"),                 // agent's explanation
  structuredResult: text("structuredResult").notNull(), // full JSON from agent
  requiresReview: boolean("requiresReview").notNull().default(false),
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "approved", "rejected"]).notNull().default("pending"),
  reviewedBy: int("reviewedBy"),                // FK → users.id
  reviewNote: text("reviewNote"),               // optional reviewer note
  latencyMs: int("latencyMs").default(0),       // agent response time
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = typeof annotations.$inferInsert;

export const annotationExports = mysqlTable("annotation_exports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  format: mysqlEnum("format", ["jsonl", "csv", "openai"]).notNull().default("jsonl"),
  recordCount: int("recordCount").notNull().default(0),
  agentFilter: varchar("agentFilter", { length: 128 }), // null = all agents
  statusFilter: varchar("statusFilter", { length: 32 }),  // approved/all
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: text("fileUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnnotationExport = typeof annotationExports.$inferSelect;
export type InsertAnnotationExport = typeof annotationExports.$inferInsert;

// ── Contact Form Submissions ──────────────────────────────────────────────────
export const contactSubmissions = mysqlTable("contact_submissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 128 }),
  message: text("message").notNull(),
  notified: boolean("notified").notNull().default(false), // true if owner notification was sent
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;

// ── Mesh Tasks (3-screen MVP) ─────────────────────────────────────────────────
export const meshTasks = mysqlTable("mesh_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  query: text("query").notNull(),                     // raw user input
  taskType: varchar("taskType", { length: 128 }),     // classified intent
  confidenceScore: int("confidenceScore").default(0), // 0-100
  agentsUsed: int("agentsUsed").default(0),
  executionTimeMs: int("executionTimeMs").default(0),
  // Structured result fields
  keyFindings: text("keyFindings"),                   // JSON string[]
  risks: text("risks"),                               // JSON string[]
  segmentInsights: text("segmentInsights"),           // JSON {segment, likelihood}[]
  recommendation: text("recommendation"),
  meshRoute: text("meshRoute"),                       // JSON string[] of agent names
  sentimentPositive: int("sentimentPositive").default(0),
  sentimentNeutral: int("sentimentNeutral").default(0),
  sentimentNegative: int("sentimentNegative").default(0),
  structuredReport: text("structuredReport"),              // JSON: financial/detailed analysis sections
  fileUrl: text("fileUrl"),                                  // S3 URL of attached file (if any)
  fileName: varchar("fileName", { length: 255 }),            // original filename of attached file
  status: mysqlEnum("status", ["running", "complete", "error"]).notNull().default("running"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MeshTask = typeof meshTasks.$inferSelect;
export type InsertMeshTask = typeof meshTasks.$inferInsert;

// ── Portfolio Intelligence Reviews ────────────────────────────────────────────
export const portfolioReviews = mysqlTable("portfolio_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fundName: varchar("fundName", { length: 255 }),
  manager: varchar("manager", { length: 255 }),
  reviewPeriod: varchar("reviewPeriod", { length: 128 }),
  notes: text("notes"),
  // Uploaded documents (JSON array of { fileName, fileUrl, mimeType })
  documents: text("documents"),
  // Analysis results (JSON)
  reportJson: text("reportJson"),
  // Status
  status: mysqlEnum("status", ["pending", "analyzing", "complete", "error"]).notNull().default("pending"),
  errorMessage: text("errorMessage"),
  // PPTX export job
  pptxStatus: mysqlEnum("pptxStatus", ["idle", "generating", "ready", "error"]).notNull().default("idle"),
  pptxUrl: text("pptxUrl"),
  pptxJobStartedAt: timestamp("pptxJobStartedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PortfolioReview = typeof portfolioReviews.$inferSelect;
export type InsertPortfolioReview = typeof portfolioReviews.$inferInsert;

// ── 100-Hour Turnaround Sessions ────────────────────────────────────────────────
export const turnaroundSessions = mysqlTable("turnaround_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyName: varchar("companyName", { length: 255 }),
  industry: varchar("industry", { length: 128 }),
  crisisType: varchar("crisisType", { length: 255 }),
  // Uploaded documents per agent slot (JSON: { slot: string, fileName: string, fileUrl: string }[])
  documents: text("documents"),
  // Per-agent status and output (JSON: { agentId: string, status: string, output: object | null, alerts: string[] }[])
  agentOutputs: text("agentOutputs"),
  // Leadership alerts that fired (JSON: { agentId: string, level: 'critical'|'high', message: string, timestamp: number }[])
  alertsJson: text("alertsJson"),
  // Resilience Logger synthesis + full structured report
  reportJson: text("reportJson"),
  // Overall status
  status: mysqlEnum("status", ["pending", "running", "complete", "error"]).notNull().default("pending"),
  errorMessage: text("errorMessage"),
  // PDF export job
  pdfStatus: mysqlEnum("pdfStatus", ["idle", "generating", "ready", "error"]).notNull().default("idle"),
  pdfUrl: text("pdfUrl"),
  pdfJobStartedAt: timestamp("pdfJobStartedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TurnaroundSession = typeof turnaroundSessions.$inferSelect;
export type InsertTurnaroundSession = typeof turnaroundSessions.$inferInsert;

// ── Mesh Identity Layer — User Profiles ──────────────────────────────────────
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // FK → users.id, one profile per user
  // Stage 1 — Signup Classifier
  basePersona: varchar("basePersona", { length: 64 }), // tile selected at signup
  // Stage 2 & 3 — updated by inference and refinement
  activePersona: varchar("activePersona", { length: 64 }),
  agentBundle: text("agentBundle"),           // JSON string[]
  suggestedWorkflows: text("suggestedWorkflows"), // JSON string[]
  tone: varchar("tone", { length: 64 }),
  domainTags: text("domainTags"),             // JSON string[] from Stage 1
  queryDomainTags: text("queryDomainTags"),   // JSON string[] from Stage 2
  dominantDomain: varchar("dominantDomain", { length: 64 }), // Stage 3
  personaDrift: boolean("personaDrift").notNull().default(false),
  homepageReorder: boolean("homepageReorder").notNull().default(false),
  nudgeMessage: text("nudgeMessage"),         // shown once then cleared
  sessionCount: int("sessionCount").notNull().default(0),
  agentsUsedList: text("agentsUsedList"),     // JSON string[] — append each use
  domainTagFrequency: text("domainTagFrequency"), // JSON { tag: count }
  workflowsCompleted: text("workflowsCompleted"), // JSON string[]
  confidence: mysqlEnum("confidence", ["HIGH", "MEDIUM", "LOW"]).default("HIGH"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;
// ── ETF Partner CRM ───────────────────────────────────────────────────────────
export const partnerInstitutions = mysqlTable("partner_institutions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  type: mysqlEnum("type", ["asset_manager", "custodian", "exchange", "regulator", "index_provider", "law_firm", "auditor", "other"]).notNull().default("other"),
  country: varchar("country", { length: 64 }).notNull().default("Kuwait"),
  contactName: varchar("contactName", { length: 128 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  website: varchar("website", { length: 256 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["prospect", "contacted", "in_discussion", "partner", "declined"]).notNull().default("prospect"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PartnerInstitution = typeof partnerInstitutions.$inferSelect;
export type InsertPartnerInstitution = typeof partnerInstitutions.$inferInsert;

export const partnershipRequests = mysqlTable("partnership_requests", {
  id: int("id").autoincrement().primaryKey(),
  institutionName: varchar("institutionName", { length: 128 }).notNull(),
  contactName: varchar("contactName", { length: 128 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  role: varchar("role", { length: 128 }),
  message: text("message"),
  partnerType: mysqlEnum("partnerType", ["asset_manager", "custodian", "exchange", "regulator", "index_provider", "law_firm", "auditor", "other"]).notNull().default("other"),
  notified: boolean("notified").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnershipRequest = typeof partnershipRequests.$inferSelect;
export type InsertPartnershipRequest = typeof partnershipRequests.$inferInsert;

// Rate limiter + usage tracking tables
export const llmUsage = mysqlTable("llm_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // null for unauthenticated requests
  ipAddress: varchar("ipAddress", { length: 64 }).notNull(),
  endpoint: varchar("endpoint", { length: 128 }).notNull(), // e.g. "game-theory", "force-majeure", "mesh", "etf"
  tokensUsed: int("tokensUsed").notNull().default(0),
  requestDate: varchar("requestDate", { length: 10 }).notNull(), // YYYY-MM-DD for daily bucketing
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LlmUsage = typeof llmUsage.$inferSelect;
export type InsertLlmUsage = typeof llmUsage.$inferInsert;

export const highDemandLog = mysqlTable("high_demand_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  ipAddress: varchar("ipAddress", { length: 64 }).notNull(),
  endpoint: varchar("endpoint", { length: 128 }).notNull(),
  requestDate: varchar("requestDate", { length: 10 }).notNull(),
  dailyTotalAtTime: int("dailyTotalAtTime").notNull(), // total tokens when limit was hit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HighDemandLog = typeof highDemandLog.$inferSelect;
export type InsertHighDemandLog = typeof highDemandLog.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// SEQUENTIAL OUTCOME ENGINE — DATA MODELS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Organization (multi-tenant, Fortress Gateway) ─────────────────────────────
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(), // e.g. "nbk", "vets"
  // Approved email domains (JSON string[]) e.g. ["@nbk.com","@nbk.com.kw"]
  approvedDomains: text("approvedDomains").notNull(),
  // Token quota management
  dailyTokenLimit: int("dailyTokenLimit").notNull().default(50000),
  dailyTokensUsed: int("dailyTokensUsed").notNull().default(0),
  quotaResetDate: varchar("quotaResetDate", { length: 10 }), // YYYY-MM-DD
  // Status
  status: mysqlEnum("status", ["active", "suspended", "trial"]).notNull().default("trial"),
  plan: mysqlEnum("plan", ["trial", "standard", "enterprise"]).notNull().default("trial"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ── Beta Access Request (Fortress Gateway waitlist) ───────────────────────────
export const betaAccessRequests = mysqlTable("beta_access_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  firm: varchar("firm", { length: 128 }).notNull(),
  role: varchar("role", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  useCase: text("useCase").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  reviewedBy: int("reviewedBy"), // FK → users.id (admin who reviewed)
  reviewNote: text("reviewNote"),
  notified: boolean("notified").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BetaAccessRequest = typeof betaAccessRequests.$inferSelect;
export type InsertBetaAccessRequest = typeof betaAccessRequests.$inferInsert;

// ── Workflow Run (top-level session for multiAgentSolve) ──────────────────────
export const workflowRuns = mysqlTable("workflow_runs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(), // UUID
  workflowType: varchar("workflowType", { length: 64 }).notNull(), // e.g. "rosie_protocol"
  userId: int("userId").notNull(),
  organizationId: int("organizationId"), // FK → organizations.id (nullable for non-org users)
  // Execution state
  status: mysqlEnum("status", ["pending", "running", "complete", "failed", "paused"]).notNull().default("pending"),
  currentStep: int("currentStep").notNull().default(0), // 0-indexed step number
  totalSteps: int("totalSteps").notNull().default(6),
  // Blackboard memory — full shared context object (JSON)
  blackboardMemory: text("blackboardMemory").notNull(),
  // Source documents (JSON array of { fileName, fileUrl, extractedText })
  sourceDocuments: text("sourceDocuments").notNull(),
  // Risk flags accumulated across all steps (JSON string[])
  riskFlags: text("riskFlags").notNull(),
  // Route log — which agents ran in order (JSON string[])
  routeLog: text("routeLog").notNull(),
  // Token tracking
  totalTokensUsed: int("totalTokensUsed").notNull().default(0),
  // Failure tracking
  failedAtStep: int("failedAtStep"), // step index where failure occurred
  failureReason: text("failureReason"),
  retryCount: int("retryCount").notNull().default(0),
  // Timing
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type InsertWorkflowRun = typeof workflowRuns.$inferInsert;

// ── Workflow Step (per-agent execution record) ────────────────────────────────
export const workflowSteps = mysqlTable("workflow_steps", {
  id: int("id").autoincrement().primaryKey(),
  workflowRunId: int("workflowRunId").notNull(), // FK → workflow_runs.id
  sessionId: varchar("sessionId", { length: 64 }).notNull(), // denormalized for easy lookup
  stepIndex: int("stepIndex").notNull(), // 0-indexed position in pipeline
  agentName: varchar("agentName", { length: 128 }).notNull(), // e.g. "Intake Agent"
  agentRole: varchar("agentRole", { length: 128 }), // e.g. "Case Parser"
  // Execution
  status: mysqlEnum("status", ["pending", "running", "complete", "failed", "skipped"]).notNull().default("pending"),
  // Structured handoff output (JSON)
  // { summary, entities, unresolvedQuestions, confidenceLevel, warnings, rawOutput }
  structuredOutput: text("structuredOutput"),
  // Input summary (what was passed in from blackboard)
  inputSummary: text("inputSummary"),
  // Metrics
  tokensUsed: int("tokensUsed").notNull().default(0),
  durationMs: int("durationMs"),
  confidenceLevel: int("confidenceLevel"), // 0-100
  warningCount: int("warningCount").notNull().default(0),
  // Error info
  errorMessage: text("errorMessage"),
  retryCount: int("retryCount").notNull().default(0),
  // Timing
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

// ── Subscriptions ─────────────────────────────────────────────────────────────
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  planTier: mysqlEnum("planTier", ["trial", "standard", "pro", "professional", "enterprise"]).notNull().default("trial"),
  plan: mysqlEnum("plan", ["starter", "professional", "enterprise"]).notNull().default("starter"),
  status: mysqlEnum("status", ["active", "canceled", "cancelled", "past_due", "trialing", "incomplete"]).notNull().default("active"),
  monthlyRunsLimit: int("monthlyRunsLimit"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 64 }),
  tokensRemaining: int("tokensRemaining").notNull().default(50),
  tokensTotal: int("tokensTotal").notNull().default(50),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  renewsAt: timestamp("renewsAt"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  subUserIdx: index("sub_user_idx").on(table.userId),
  subStripeIdx: index("sub_stripe_idx").on(table.stripeSubscriptionId),
}));
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ── Token Usage Log ───────────────────────────────────────────────────────────
export const tokenUsage = mysqlTable("token_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: varchar("sessionId", { length: 64 }),
  tokensUsed: int("tokensUsed").notNull().default(1),
  action: varchar("action", { length: 64 }).notNull().default("council_run"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tuUserIdx: index("tu_user_idx").on(table.userId),
  tuSessionIdx: index("tu_session_idx").on(table.sessionId),
}));
export type TokenUsage = typeof tokenUsage.$inferSelect;
export type InsertTokenUsage = typeof tokenUsage.$inferInsert;

// ── Payments ──────────────────────────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amountUsd: decimal("amountUsd", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("USD"),
  status: varchar("status", { length: 32 }).notNull(), // succeeded, pending, failed
  provider: varchar("provider", { length: 32 }).notNull().default("stripe"),
  providerPaymentId: varchar("providerPaymentId", { length: 255 }),
  planTier: mysqlEnum("planTier", ["standard", "pro", "professional", "enterprise"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ── Email Events (drip deduplication) ────────────────────────────────────────
export const emailEvents = mysqlTable("email_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  emailType: varchar("emailType", { length: 64 }).notNull(), // day_1, day_15, day_45, day_55, day_60
  status: varchar("status", { length: 32 }).notNull().default("sent"), // sent, failed, skipped
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});
export type EmailEvent = typeof emailEvents.$inferSelect;
export type InsertEmailEvent = typeof emailEvents.$inferInsert;

// ── Insurance & Reinsurance Intelligence Engine ───────────────────────────────

export const insuranceRuns = mysqlTable("insurance_runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  runType: mysqlEnum("runType", ["underwriting", "claims", "treaty", "compliance", "cat_model"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).notNull().default("pending"),
  inputSummary: text("inputSummary"),
  // Decision outputs
  uwDecision: mysqlEnum("uwDecision", ["APPROVE", "REFER", "DECLINE"]),
  confidenceScore: int("confidenceScore"),       // 0-100
  premiumIndication: varchar("premiumIndication", { length: 64 }), // e.g. "USD 1.2M"
  riskScore: int("riskScore"),                   // 0-100
  takafulCompliant: boolean("takafulCompliant"),
  threatLevel: mysqlEnum("threatLevel", ["low", "medium", "high", "critical"]),
  // Treaty / Reinsurance outputs
  treatyRecommendation: varchar("treatyRecommendation", { length: 32 }), // ACCEPT / DECLINE / NEGOTIATE
  cessionRate: varchar("cessionRate", { length: 32 }),
  // Full blackboard JSON
  blackboard: text("blackboard"),
  // Metrics
  totalTokens: int("totalTokens"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type InsuranceRun = typeof insuranceRuns.$inferSelect;
export type InsertInsuranceRun = typeof insuranceRuns.$inferInsert;

export const insuranceSteps = mysqlTable("insurance_steps", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  agentId: varchar("agentId", { length: 32 }).notNull(),
  agentName: varchar("agentName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).notNull().default("pending"),
  output: text("output"),       // JSON blob
  tokensUsed: int("tokensUsed").notNull().default(0),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type InsuranceStep = typeof insuranceSteps.$inferSelect;
export type InsertInsuranceStep = typeof insuranceSteps.$inferInsert;

export const takafulAlerts = mysqlTable("takaful_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  insuranceRunId: int("insuranceRunId"),
  alertType: varchar("alertType", { length: 64 }).notNull(), // e.g. "gharar", "riba", "maysir", "non_halal_investment"
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull().default("warning"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  recommendedAction: text("recommendedAction"),
  isAcknowledged: boolean("isAcknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TakafulAlert = typeof takafulAlerts.$inferSelect;
export type InsertTakafulAlert = typeof takafulAlerts.$inferInsert;

// ─── AdMesh — AI Creative Intelligence ────────────────────────────────────────
export const admeshRuns = mysqlTable("admesh_runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  brandVoice: varchar("brandVoice", { length: 64 }).notNull().default("premium"),
  category: varchar("category", { length: 128 }).notNull(),
  market: varchar("market", { length: 64 }).notNull().default("Kuwait"),
  competitors: text("competitors"),
  languages: varchar("languages", { length: 32 }).notNull().default("en,ar"),
  mode: mysqlEnum("mode", ["demo", "live"]).notNull().default("demo"),
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).notNull().default("pending"),
  competitorInsights: text("competitorInsights"),
  strategy: text("strategy"),
  performanceInsights: text("performanceInsights"),
  blackboard: text("blackboard"),
  totalTokens: int("totalTokens"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type AdmeshRun = typeof admeshRuns.$inferSelect;
export type InsertAdmeshRun = typeof admeshRuns.$inferInsert;

export const admeshSteps = mysqlTable("admesh_steps", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  agentId: varchar("agentId", { length: 32 }).notNull(),
  agentName: varchar("agentName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).notNull().default("pending"),
  output: text("output"),
  tokensUsed: int("tokensUsed").notNull().default(0),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type AdmeshStep = typeof admeshSteps.$inferSelect;
export type InsertAdmeshStep = typeof admeshSteps.$inferInsert;

export const admeshAds = mysqlTable("admesh_ads", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  language: mysqlEnum("language", ["en", "ar"]).notNull(),
  adIndex: int("adIndex").notNull(),
  hook: text("hook").notNull(),
  body: text("body").notNull(),
  cta: varchar("cta", { length: 255 }).notNull(),
  visualDirection: text("visualDirection"),
  targetAudience: varchar("targetAudience", { length: 255 }),
  hookScore: int("hookScore"),
  clarityScore: int("clarityScore"),
  brandFitScore: int("brandFitScore"),
  localRelevanceScore: int("localRelevanceScore"),
  ctrPotentialScore: int("ctrPotentialScore"),
  overallScore: int("overallScore"),
  isTopPick: boolean("isTopPick").notNull().default(false),
  isApproved: boolean("isApproved").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdmeshAd = typeof admeshAds.$inferSelect;
export type InsertAdmeshAd = typeof admeshAds.$inferInsert;

// ── Deal Screener — Council of 10 ────────────────────────────────────────────
export const dealScreenings = mysqlTable("deal_screenings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),              // FK → users.id
  dealId: varchar("dealId", { length: 64 }).notNull().unique(), // UUID generated server-side
  dealName: varchar("dealName", { length: 255 }).notNull(),
  dealText: text("dealText").notNull(),         // raw input (pasted or extracted from PDF)
  pdfFileKey: varchar("pdfFileKey", { length: 512 }), // S3 key if PDF was uploaded
  pdfFileUrl: text("pdfFileUrl"),               // S3 URL if PDF was uploaded

  // Verdict
  verdict: mysqlEnum("verdict", ["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "VETOED"]).notNull(),

  // Vote counts
  yesCount: int("yesCount").notNull().default(0),
  noCount: int("noCount").notNull().default(0),
  hardYesCount: int("hardYesCount").notNull().default(0),
  softYesCount: int("softYesCount").notNull().default(0),
  softNoCount: int("softNoCount").notNull().default(0),
  hardNoCount: int("hardNoCount").notNull().default(0),

  // Confidence
  confidenceScore: decimal("confidenceScore", { precision: 4, scale: 3 }).notNull(), // 0.000–1.000

  // Special flags
  gccVetoTriggered: boolean("gccVetoTriggered").notNull().default(false),
  tiebreakerTriggered: boolean("tiebreakerTriggered").notNull().default(false),
  tiebreakerSwingAgent: varchar("tiebreakerSwingAgent", { length: 64 }), // persona ID that was flipped

  // Aggregated outputs (JSON)
  conditionsToProceed: text("conditionsToProceed").notNull(), // JSON string[]
  blockingIssues: text("blockingIssues").notNull(),           // JSON string[]
  votes: text("votes").notNull(),                             // JSON PersonaVote[]

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DealScreening = typeof dealScreenings.$inferSelect;
export type InsertDealScreening = typeof dealScreenings.$inferInsert;

// ── Deal Screener — Rate Limit Tracker ───────────────────────────────────────
export const dealScreeningRateLimit = mysqlTable("deal_screening_rate_limit", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  windowStart: timestamp("windowStart").notNull(), // midnight UTC — start of daily window
  count: int("count").notNull().default(1),        // screens used today
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DealScreeningRateLimit = typeof dealScreeningRateLimit.$inferSelect;
export type InsertDealScreeningRateLimit = typeof dealScreeningRateLimit.$inferInsert;

// ── Intelligence Agent — Analyses ────────────────────────────────────────────
export const intelAnalyses = mysqlTable("intel_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  institution: varchar("institution", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 128 }),
  aum: varchar("aum", { length: 64 }),
  inputText: text("inputText"),
  result: text("result").notNull(),
  modules: text("modules"),
  lens: text("lens"),
  isInternal: boolean("isInternal").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IntelAnalysis = typeof intelAnalyses.$inferSelect;
export type InsertIntelAnalysis = typeof intelAnalyses.$inferInsert;

// ── Intelligence Agent — Tracked Institutions ─────────────────────────────────
export const intelTracked = mysqlTable("intel_tracked", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  institution: varchar("institution", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 128 }),
  aum: varchar("aum", { length: 64 }),
  lastAnalysis: text("lastAnalysis"),
  lastFetchedContent: text("lastFetchedContent"),
  trackingSource: varchar("trackingSource", { length: 64 }).default("news_api"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type IntelTracked = typeof intelTracked.$inferSelect;
export type InsertIntelTracked = typeof intelTracked.$inferInsert;

// ── Intelligence Agent — Analysis History (diffs) ─────────────────────────────
export const intelHistory = mysqlTable("intel_history", {
  id: int("id").autoincrement().primaryKey(),
  trackedInstitutionId: int("trackedInstitutionId").notNull(),
  result: text("result").notNull(),
  diff: text("diff"),
  fetchedContent: text("fetchedContent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IntelHistory = typeof intelHistory.$inferSelect;
export type InsertIntelHistory = typeof intelHistory.$inferInsert;

// ── Intelligence Agent — Weekly Briefs ────────────────────────────────────────
export const intelBriefs = mysqlTable("intel_briefs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  weekOf: timestamp("weekOf").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IntelBrief = typeof intelBriefs.$inferSelect;
export type InsertIntelBrief = typeof intelBriefs.$inferInsert;

// ── Kuwait MVNO Intelligence ──────────────────────────────────────────────────

export const mvnoSubscribers = mysqlTable("mvno_subscribers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  subscriberName: varchar("subscriberName", { length: 255 }).notNull(),
  msisdn: varchar("msisdn", { length: 20 }).notNull(),
  simStatus: mysqlEnum("simStatus", ["active", "suspended", "ported_out"]).notNull().default("active"),
  plan: mysqlEnum("plan", ["basic", "worker", "remittance_plus"]).notNull().default("basic"),
  nationality: varchar("nationality", { length: 100 }),
  kycStatus: mysqlEnum("kycStatus", ["pending", "verified", "rejected"]).notNull().default("pending"),
  monthlyArpu: decimal("monthlyArpu", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MvnoSubscriber = typeof mvnoSubscribers.$inferSelect;
export type InsertMvnoSubscriber = typeof mvnoSubscribers.$inferInsert;

export const mvnoAgentRuns = mysqlTable("mvno_agent_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  subscriberContext: text("subscriberContext").notNull(), // JSON blob
  agentResults: text("agentResults").notNull(),           // JSON blob
  overallRecommendation: varchar("overallRecommendation", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MvnoAgentRun = typeof mvnoAgentRuns.$inferSelect;
export type InsertMvnoAgentRun = typeof mvnoAgentRuns.$inferInsert;

// ─── ForecastMesh Tables ──────────────────────────────────────────────────────

export const forecasts = mysqlTable("forecasts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  forecastType: mysqlEnum("forecastType", ["deadline_risk", "budget_risk", "target_probability"]).notNull(),
  question: text("question").notNull(),
  description: text("description"),
  deadline: timestamp("deadline"),
  threshold: decimal("threshold", { precision: 15, scale: 2 }),
  businessArea: varchar("businessArea", { length: 100 }),
  currentProbability: decimal("currentProbability", { precision: 5, scale: 4 }).notNull().default("0.5000"),
  previousProbability: decimal("previousProbability", { precision: 5, scale: 4 }),
  confidenceScore: decimal("confidenceScore", { precision: 5, scale: 4 }).notNull().default("0.5000"),
  status: mysqlEnum("status", ["on_track", "watchlist", "at_risk", "critical", "resolved"]).notNull().default("watchlist"),
  agentsJson: text("agentsJson"),
  documentUrl: varchar("documentUrl", { length: 512 }),
  isSeeded: boolean("isSeeded").notNull().default(false),
  // Financial fields (for seeded demo scenarios)
  geography: varchar("geography", { length: 100 }),
  currency: varchar("currency", { length: 10 }),
  baseRevenue: decimal("baseRevenue", { precision: 15, scale: 2 }),
  ebitdaMargin: decimal("ebitdaMargin", { precision: 5, scale: 4 }),
  growthRate: decimal("growthRate", { precision: 5, scale: 4 }),
  assumptions: text("assumptions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Forecast = typeof forecasts.$inferSelect;
export type InsertForecast = typeof forecasts.$inferInsert;

export const forecastAgents = mysqlTable("forecast_agents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  forecastId: varchar("forecastId", { length: 36 }).notNull().references(() => forecasts.id, { onDelete: "cascade" }),
  agentName: varchar("agentName", { length: 100 }).notNull(),
  agentRole: varchar("agentRole", { length: 100 }).notNull(),
  probabilityEstimate: decimal("probabilityEstimate", { precision: 5, scale: 4 }).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  upwardForces: text("upwardForces").notNull(),
  downwardForces: text("downwardForces").notNull(),
  summary: text("summary").notNull(),
  recommendedActions: text("recommendedActions").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ForecastAgent = typeof forecastAgents.$inferSelect;
export type InsertForecastAgent = typeof forecastAgents.$inferInsert;

export const forecastHistory = mysqlTable("forecast_history", {
  id: varchar("id", { length: 36 }).primaryKey(),
  forecastId: varchar("forecastId", { length: 36 }).notNull().references(() => forecasts.id, { onDelete: "cascade" }),
  probability: decimal("probability", { precision: 5, scale: 4 }).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  delta: decimal("delta", { precision: 5, scale: 4 }).notNull().default("0.0000"),
  cause: varchar("cause", { length: 255 }).notNull(),
  agentSource: varchar("agentSource", { length: 100 }),
  eventType: mysqlEnum("eventType", ["agent_update", "manual_update", "trigger_fired", "document_added", "status_change"]).notNull().default("agent_update"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  // Financial history fields (for seeded demo scenarios)
  month: varchar("month", { length: 20 }),
  revenue: decimal("revenue", { precision: 15, scale: 2 }),
  ebitda: decimal("ebitda", { precision: 15, scale: 2 }),
  sortOrder: int("sortOrder"),
});
export type ForecastHistory = typeof forecastHistory.$inferSelect;
export type InsertForecastHistory = typeof forecastHistory.$inferInsert;

export const forecastTriggers = mysqlTable("forecast_triggers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  forecastId: varchar("forecastId", { length: 36 }).notNull().references(() => forecasts.id, { onDelete: "cascade" }),
  triggerType: mysqlEnum("triggerType", ["probability_drop", "low_confidence", "status_worsened", "deadline_approaching"]).notNull(),
  threshold: decimal("threshold", { precision: 5, scale: 4 }),
  firedAt: timestamp("firedAt").defaultNow().notNull(),
  description: text("description").notNull(),
  actionsTaken: text("actionsTaken"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolvedAt"),
});
export type ForecastTrigger = typeof forecastTriggers.$inferSelect;
export type InsertForecastTrigger = typeof forecastTriggers.$inferInsert;

export const forecastDocuments = mysqlTable("forecast_documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  forecastId: varchar("forecastId", { length: 36 }).notNull().references(() => forecasts.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  s3Url: varchar("s3Url", { length: 512 }).notNull(),
  extractedText: text("extractedText"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});
export type ForecastDocument = typeof forecastDocuments.$inferSelect;
export type InsertForecastDocument = typeof forecastDocuments.$inferInsert;

// ── Knowledge Vault (RAG Synthetic Data) ─────────────────────────────────────
export const knowledgeScenarios = mysqlTable("knowledge_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  scenarioId: varchar("scenarioId", { length: 32 }).notNull().unique(),
  domain: mysqlEnum("domain", [
    "deal_screening",
    "wealth_management",
    "insurance_underwriting",
    "mvno_intelligence",
    "legal_review",
    "budget_forecasting",
    "social_media",
    "ic_reports"
  ]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  geography: varchar("geography", { length: 128 }),
  sector: varchar("sector", { length: 128 }),
  tags: text("tags"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeScenario = typeof knowledgeScenarios.$inferSelect;
export type InsertKnowledgeScenario = typeof knowledgeScenarios.$inferInsert;

// ── Self-Learning Loop ────────────────────────────────────────────────────────
// Phase 1: Agent Weights — meritocracy table for council personas
export const agentWeights = mysqlTable("agent_weights", {
  id: int("id").autoincrement().primaryKey(),
  personaId: varchar("personaId", { length: 100 }).unique().notNull(),
  weight: decimal("weight", { precision: 4, scale: 2 }).default("1.00").notNull(),
  totalEvaluations: int("totalEvaluations").default(0).notNull(),
  correctPredictions: int("correctPredictions").default(0).notNull(),
  lastEvaluatedAt: timestamp("lastEvaluatedAt"),
  updatedAt: timestamp("updatedAt").onUpdateNow(),
});
export type AgentWeight = typeof agentWeights.$inferSelect;
export type InsertAgentWeight = typeof agentWeights.$inferInsert;

// Phase 2: Decision Memory — the "brain" storage with embeddings
export const decisionMemory = mysqlTable("decision_memory", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 100 }),
  taskDescription: text("taskDescription").notNull(),
  taskDomain: varchar("taskDomain", { length: 50 }),
  embedding: text("embedding").notNull(), // JSON-serialised float[] (1536-dim)
  finalVerdict: varchar("finalVerdict", { length: 30 }),
  confidenceScore: decimal("confidenceScore", { precision: 5, scale: 3 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  domainIdx: index("dm_domain_idx").on(table.taskDomain),
}));
export type DecisionMemory = typeof decisionMemory.$inferSelect;
export type InsertDecisionMemory = typeof decisionMemory.$inferInsert;

// Phase 3: Agent Votes Log — full audit trail per decision
export const agentVotesLog = mysqlTable("agent_votes_log", {
  id: int("id").autoincrement().primaryKey(),
  decisionMemoryId: int("decisionMemoryId").notNull().references(() => decisionMemory.id, { onDelete: "cascade" }),
  personaId: varchar("personaId", { length: 100 }).notNull(),
  personaName: varchar("personaName", { length: 100 }),
  vote: varchar("vote", { length: 20 }),
  confidence: decimal("confidence", { precision: 4, scale: 3 }),
  rationale: text("rationale"),
  wasCorrect: boolean("wasCorrect"),
  scoredAt: timestamp("scoredAt"),
}, (table) => ({
  memIdx: index("avl_mem_idx").on(table.decisionMemoryId),
  personaIdx: index("avl_persona_idx").on(table.personaId),
}));
export type AgentVoteLog = typeof agentVotesLog.$inferSelect;
export type InsertAgentVoteLog = typeof agentVotesLog.$inferInsert;

// Phase 4: Decision Outcomes — ground truth from automated data feeds
export const decisionOutcomes = mysqlTable("decision_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  decisionMemoryId: int("decisionMemoryId").notNull().references(() => decisionMemory.id, { onDelete: "cascade" }),
  outcomeSource: varchar("outcomeSource", { length: 50 }),
  outcomeData: text("outcomeData"),
  outcomeVerdict: varchar("outcomeVerdict", { length: 20 }).default("PENDING"),
  outcomeRecordedAt: timestamp("outcomeRecordedAt").defaultNow().notNull(),
}, (table) => ({
  memIdx: index("do_mem_idx").on(table.decisionMemoryId),
}));
export type DecisionOutcome = typeof decisionOutcomes.$inferSelect;
export type InsertDecisionOutcome = typeof decisionOutcomes.$inferInsert;

// ── Revenue Bridge: Pitch Sessions ───────────────────────────────────────────
export const pitchSessions = mysqlTable("pitch_sessions", {
  id: int("id").autoincrement().primaryKey(),
  pitchToken: varchar("pitchToken", { length: 64 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  pitchText: text("pitchText"),
  decisionMemoryId: int("decisionMemoryId"),
  verdict: varchar("verdict", { length: 30 }),
  confidenceScore: decimal("confidenceScore", { precision: 5, scale: 3 }),
  paymentStatus: varchar("paymentStatus", { length: 20 }).default("FREE"),
  reportUnlocked: tinyint("reportUnlocked").default(0),
  voteSummaryJson: longtext("voteSummaryJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tokenIdx: index("ps_token_idx").on(table.pitchToken),
}));
export type PitchSession = typeof pitchSessions.$inferSelect;
export type InsertPitchSession = typeof pitchSessions.$inferInsert;

// ── v3.0 Consensus Node: Audit Log (append-only) ─────────────────────────────
export const consensusSessions = mysqlTable("consensus_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  thesis: varchar("thesis", { length: 200 }),
  yesCount: int("yesCount").notNull().default(0),
  noCount: int("noCount").notNull().default(0),
  verdict: varchar("verdict", { length: 30 }).notNull(),
  consensusReached: tinyint("consensusReached").notNull().default(0),
  hardFlags: text("hardFlags"),
  silentFails: text("silentFails"),
  votesJson: longtext("votesJson"),
  resultJson: longtext("resultJson"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("cs_session_idx").on(table.sessionId),
  verdictIdx: index("cs_verdict_idx").on(table.verdict),
}));
export type ConsensusSession = typeof consensusSessions.$inferSelect;
export type InsertConsensusSession = typeof consensusSessions.$inferInsert;

// ── v3.0 Cost Guard: DB-backed atomic counters ────────────────────────────────
export const costCounters = mysqlTable("cost_counters", {
  counterKey: varchar("counter_key", { length: 64 }).primaryKey(),
  value: varchar("value", { length: 32 }).notNull().default("0"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CostCounter = typeof costCounters.$inferSelect;
export type InsertCostCounter = typeof costCounters.$inferInsert;

// ── Deal Screener: Pay-Per-Run Payments ───────────────────────────────────────
// Each Council run requires a $32.50 Stripe Checkout payment.
// Status lifecycle: "pending" → "paid" (via webhook) → "used" (after council run)
export const dealScreenerPayments = mysqlTable("deal_screener_payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeSessionId: varchar("stripeSessionId", { length: 255 }).notNull().unique(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | paid | used | expired
  dealId: varchar("dealId", { length: 64 }), // set after council run completes
  amountUsd: decimal("amountUsd", { precision: 8, scale: 2 }).notNull().default("32.50"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("dsp_user_idx").on(table.userId),
  sessionIdx: index("dsp_session_idx").on(table.stripeSessionId),
  statusIdx: index("dsp_status_idx").on(table.status),
}));
export type DealScreenerPayment = typeof dealScreenerPayments.$inferSelect;
export type InsertDealScreenerPayment = typeof dealScreenerPayments.$inferInsert;
