import { boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  // Registry versioning & health tracking
  version: varchar("version", { length: 32 }).notNull().default("1.0.0"),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  failCount: int("failCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

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