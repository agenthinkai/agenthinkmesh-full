/**
 * sadoSchema.ts — SADO Phase A database tables
 *
 * Tables:
 *  sado_agents           — 6 agent definitions + live status
 *  sado_sources          — synthetic enterprise source systems
 *  sado_columns          — discovered columns with classification
 *  sado_governance_alerts — governance events (INTERCEPTED / ALLOWED)
 *  sado_escalations      — pending human review items
 *  sado_audit_trail      — append-only event log
 */
import { mysqlTable, varchar, int, text, bigint, float, boolean } from "drizzle-orm/mysql-core";

// ── Agent status ──────────────────────────────────────────────────────────────
export const sadoAgents = mysqlTable("sado_agents", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("idle"),
  // idle | running | completed | escalated | error
  lastAction: text("last_action"),
  currentTask: text("current_task"),
  confidence: float("confidence"),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// ── Source systems ────────────────────────────────────────────────────────────
export const sadoSources = mysqlTable("sado_sources", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  // e.g. "Oracle CRM", "SAP HR", "SQL Server Billing"
  type: varchar("type", { length: 50 }).notNull(),
  // oracle | sap | sqlserver
  schema: varchar("schema", { length: 100 }).notNull(),
  // e.g. "oracle_crm"
  table: varchar("table", { length: 100 }).notNull(),
  // e.g. "customers"
  rowCount: int("row_count").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("discovered"),
  // discovered | mapped | classified
  discoveredAt: bigint("discovered_at", { mode: "number" }).notNull(),
});

// ── Discovered columns ────────────────────────────────────────────────────────
export const sadoColumns = mysqlTable("sado_columns", {
  id: int("id").primaryKey().autoincrement(),
  sourceId: int("source_id").notNull(),
  columnName: varchar("column_name", { length: 100 }).notNull(),
  dataType: varchar("data_type", { length: 50 }).notNull(),
  businessMeaning: text("business_meaning"),
  classification: varchar("classification", { length: 20 }).notNull().default("INTERNAL"),
  // PUBLIC | INTERNAL | PII | SENSITIVE
  confidence: float("confidence").notNull().default(0.5),
  classifiedAt: bigint("classified_at", { mode: "number" }),
});

// ── Governance alerts ─────────────────────────────────────────────────────────
export const sadoGovernanceAlerts = mysqlTable("sado_governance_alerts", {
  id: int("id").primaryKey().autoincrement(),
  ruleId: varchar("rule_id", { length: 100 }).notNull(),
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull(),
  // SA | KW | UAE | GCC
  regulation: varchar("regulation", { length: 100 }).notNull(),
  dataClassification: varchar("data_classification", { length: 20 }).notNull(),
  sourceCountry: varchar("source_country", { length: 10 }).notNull(),
  destinationCountry: varchar("destination_country", { length: 10 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  // INTERCEPTED | ALLOWED | QUARANTINED
  severity: varchar("severity", { length: 10 }).notNull(),
  // HIGH | MEDIUM | LOW
  description: text("description").notNull(),
  recommendedAction: text("recommended_action"),
  traceId: varchar("trace_id", { length: 64 }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// ── Escalation queue ──────────────────────────────────────────────────────────
export const sadoEscalations = mysqlTable("sado_escalations", {
  id: int("id").primaryKey().autoincrement(),
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  confidence: float("confidence").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // pending | approved | rejected
  operatorDecision: text("operator_decision"),
  resolvedAt: bigint("resolved_at", { mode: "number" }),
  traceId: varchar("trace_id", { length: 64 }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// ── Audit trail (append-only) ─────────────────────────────────────────────────
export const sadoAuditTrail = mysqlTable("sado_audit_trail", {
  id: int("id").primaryKey().autoincrement(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  actor: varchar("actor", { length: 100 }).notNull(),
  // agent name or "operator"
  agentName: varchar("agent_name", { length: 100 }),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 255 }),
  confidence: float("confidence"),
  result: varchar("result", { length: 50 }),
  // success | escalated | intercepted | allowed | approved | rejected
  severity: varchar("severity", { length: 10 }).default("INFO"),
  // INFO | HIGH | MEDIUM | LOW
  traceId: varchar("trace_id", { length: 64 }).notNull(),
  details: text("details"),
});
