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
  status: mysqlEnum("status", ["active", "inactive", "pending"]).notNull().default("active"),
  connectionTested: boolean("connectionTested").notNull().default(false), // true if endpoint passed validation
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
  reviewNote: text("reviewNote"),
  latencyMs: int("latencyMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = typeof annotations.$inferInsert;

export const annotationExports = mysqlTable("annotation_exports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  format: mysqlEnum("format", ["jsonl", "csv"]).notNull().default("jsonl"),
  recordCount: int("recordCount").notNull().default(0),
  agentFilter: varchar("agentFilter", { length: 128 }), // null = all agents
  statusFilter: varchar("statusFilter", { length: 32 }),  // approved/all
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: text("fileUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnnotationExport = typeof annotationExports.$inferSelect;
export type InsertAnnotationExport = typeof annotationExports.$inferInsert;