/**
 * sado.ts — SADO Phase A tRPC router
 *
 * Procedures:
 *  sado.getAgents          — list all 6 agents with live status
 *  sado.getSources         — list source systems + their columns
 *  sado.getKnowledgeGraph  — nodes + edges for the graph view
 *  sado.getGovernanceAlerts — list governance events
 *  sado.getEscalations     — list escalation queue items
 *  sado.resolveEscalation  — approve or reject an escalation
 *  sado.getAuditTrail      — paginated audit log
 *  sado.runDemoCycle       — seed + animate the full demo workflow
 *  sado.resetDemo          — clear all SADO data and re-seed
 */
import { z } from "zod";
import { desc, eq, and, or, like } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  sadoAgents,
  sadoSources,
  sadoColumns,
  sadoGovernanceAlerts,
  sadoEscalations,
  sadoAuditTrail,
} from "../../drizzle/sadoSchema";

// ── Helpers ───────────────────────────────────────────────────────────────────
function traceId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const AGENT_DEFS = [
  { name: "SchemaExtractorAgent", status: "idle" as const },
  { name: "SemanticMapperAgent",  status: "idle" as const },
  { name: "PIIDetectorAgent",     status: "idle" as const },
  { name: "SchemaDriftAgent",     status: "idle" as const },
  { name: "SQLRewriteAgent",      status: "idle" as const },
  { name: "GovernanceAgent",      status: "idle" as const },
];

const SOURCE_DEFS = [
  {
    name: "Oracle CRM", type: "oracle", schema: "oracle_crm", table: "customers",
    rowCount: 4_200_000,
    columns: [
      { columnName: "customer_id",    dataType: "NUMBER(10)",      businessMeaning: "Unique customer identifier",         classification: "INTERNAL",  confidence: 0.99 },
      { columnName: "full_name",      dataType: "VARCHAR2(255)",   businessMeaning: "Customer full legal name",           classification: "PII",       confidence: 0.97 },
      { columnName: "national_id",    dataType: "VARCHAR2(20)",    businessMeaning: "Saudi/GCC national identity number", classification: "SENSITIVE", confidence: 0.98 },
      { columnName: "phone_number",   dataType: "VARCHAR2(20)",    businessMeaning: "Primary contact phone",              classification: "PII",       confidence: 0.95 },
      { columnName: "email",          dataType: "VARCHAR2(320)",   businessMeaning: "Customer email address",             classification: "PII",       confidence: 0.96 },
      { columnName: "city",           dataType: "VARCHAR2(100)",   businessMeaning: "Customer city of residence",         classification: "INTERNAL",  confidence: 0.91 },
      { columnName: "account_status", dataType: "VARCHAR2(20)",    businessMeaning: "CRM account lifecycle status",       classification: "INTERNAL",  confidence: 0.99 },
    ],
  },
  {
    name: "SAP HR", type: "sap", schema: "sap_hr", table: "employees",
    rowCount: 18_400,
    columns: [
      { columnName: "employee_id",    dataType: "NVARCHAR(20)",    businessMeaning: "Unique employee identifier",         classification: "INTERNAL",  confidence: 0.99 },
      { columnName: "full_name",      dataType: "NVARCHAR(255)",   businessMeaning: "Employee full legal name",           classification: "PII",       confidence: 0.97 },
      { columnName: "civil_id",       dataType: "NVARCHAR(20)",    businessMeaning: "Kuwait/GCC civil ID number",         classification: "SENSITIVE", confidence: 0.98 },
      { columnName: "salary",         dataType: "DECIMAL(12,2)",   businessMeaning: "Monthly gross salary",               classification: "SENSITIVE", confidence: 0.96 },
      { columnName: "department",     dataType: "NVARCHAR(100)",   businessMeaning: "Organizational department",          classification: "INTERNAL",  confidence: 0.99 },
      { columnName: "manager_id",     dataType: "NVARCHAR(20)",    businessMeaning: "Direct manager employee ID",         classification: "INTERNAL",  confidence: 0.99 },
      { columnName: "work_location",  dataType: "NVARCHAR(100)",   businessMeaning: "Physical work location / office",    classification: "INTERNAL",  confidence: 0.93 },
    ],
  },
  {
    name: "SQL Server Billing", type: "sqlserver", schema: "sqlserver_billing", table: "invoices",
    rowCount: 9_200_000,
    columns: [
      { columnName: "invoice_id",      dataType: "INT IDENTITY",    businessMeaning: "Unique invoice identifier",          classification: "INTERNAL",  confidence: 0.99 },
      { columnName: "customer_id",     dataType: "INT",             businessMeaning: "Foreign key to CRM customer",        classification: "INTERNAL",  confidence: 0.99 },
      { columnName: "amount",          dataType: "DECIMAL(14,2)",   businessMeaning: "Invoice total amount (SAR)",          classification: "SENSITIVE", confidence: 0.95 },
      { columnName: "billing_address", dataType: "NVARCHAR(500)",   businessMeaning: "Customer billing address",           classification: "PII",       confidence: 0.68 }, // intentionally low → escalation
      { columnName: "payment_status",  dataType: "NVARCHAR(20)",    businessMeaning: "Invoice payment lifecycle status",   classification: "INTERNAL",  confidence: 0.99 },
      { columnName: "created_at",      dataType: "DATETIME2",       businessMeaning: "Invoice creation timestamp (UTC)",   classification: "PUBLIC",    confidence: 0.99 },
    ],
  },
];

const GOVERNANCE_DEFS = [
  {
    ruleId: "PDPL_SA_ART29_001",
    jurisdiction: "SA",
    regulation: "Saudi PDPL Article 29",
    dataClassification: "SENSITIVE",
    sourceCountry: "SA",
    destinationCountry: "DE",
    action: "INTERCEPTED",
    severity: "HIGH",
    description: "Saudi national ID data (oracle_crm.customers.national_id) attempted transfer to Germany (eu-central-1). Cross-border transfer of personal data outside KSA requires SDAIA approval or contractual safeguards.",
    recommendedAction: "Quarantine payload. Reroute to me-south-1 (Riyadh) or obtain SDAIA transfer approval before proceeding.",
  },
  {
    ruleId: "CITRA_KW_DATA_RESIDENCY_001",
    jurisdiction: "KW",
    regulation: "CITRA Decree No. 20/2014",
    dataClassification: "PII",
    sourceCountry: "KW",
    destinationCountry: "SG",
    action: "INTERCEPTED",
    severity: "HIGH",
    description: "Kuwait telecom subscriber data (sap_hr.employees.civil_id) attempted transfer to Singapore. CITRA requires telecom subscriber data to remain within Kuwait jurisdiction.",
    recommendedAction: "Block transfer. Retain data in Kuwait-hosted infrastructure. File CITRA notification within 72 hours.",
  },
  {
    ruleId: "INTERNAL_POLICY_001",
    jurisdiction: "UAE",
    regulation: "Internal Enterprise Policy v2.1",
    dataClassification: "INTERNAL",
    sourceCountry: "AE",
    destinationCountry: "AE",
    action: "ALLOWED",
    severity: "LOW",
    description: "Billing metadata (sqlserver_billing.invoices) transferred within UAE (Azure UAE North → G42 Cloud Abu Dhabi). Intra-UAE transfer of non-PII billing metadata complies with internal policy.",
    recommendedAction: "No action required. Transfer logged for audit purposes.",
  },
];

const ESCALATION_DEFS = [
  {
    agentName: "PIIDetectorAgent",
    title: "Ambiguous PII classification: billing_address",
    description: "Column sqlserver_billing.invoices.billing_address contains mixed address formats (PO Box, street address, and compound address strings). Pattern matching confidence is below the 0.70 threshold for automatic PII classification.",
    confidence: 0.68,
    recommendedAction: "Classify as PII. Billing addresses are personal data under PDPL Article 1 and DIFC Data Protection Law Section 2.",
  },
  {
    agentName: "SQLRewriteAgent",
    title: "SQL rewrite confidence below threshold",
    description: "Schema drift detected: column national_id removed from oracle_crm.customers. Candidate SQL rewrite for pipeline ETL_CRM_DAILY_SYNC generated with confidence 0.82 (threshold: 0.85). Rewrite involves a LEFT JOIN to the new identity_documents table — human review required before applying.",
    confidence: 0.82,
    recommendedAction: "Review the candidate rewrite. If the JOIN logic is correct, approve. If the identity_documents table has a different schema than assumed, reject and provide the correct table structure.",
  },
];

// ── Seed function ─────────────────────────────────────────────────────────────
async function seedSadoData(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const now = Date.now();

  // Agents
  for (const a of AGENT_DEFS) {
    await db.insert(sadoAgents).values({ ...a, updatedAt: now });
  }

  // Sources + columns
  for (const s of SOURCE_DEFS) {
    const [src] = await db.insert(sadoSources).values({
      name: s.name, type: s.type, schema: s.schema, table: s.table,
      rowCount: s.rowCount, status: "classified", discoveredAt: now,
    }).$returningId();
    for (const c of s.columns) {
      await db.insert(sadoColumns).values({ ...c, sourceId: src.id, classifiedAt: now });
    }
  }

  // Governance alerts
  for (const g of GOVERNANCE_DEFS) {
    await db.insert(sadoGovernanceAlerts).values({ ...g, traceId: traceId(), createdAt: now });
  }

  // Escalations
  for (const e of ESCALATION_DEFS) {
    await db.insert(sadoEscalations).values({ ...e, status: "pending", traceId: traceId(), createdAt: now });
  }

  // Seed audit trail with initial events
  const auditEvents = [
    { actor: "SchemaExtractorAgent", agentName: "SchemaExtractorAgent", action: "AGENT_STARTED",    entity: "oracle_crm.customers",             confidence: 1.0,  result: "success",     severity: "INFO",   details: "Connected to Oracle CRM via MCP connector. Read-only service account authenticated." },
    { actor: "SchemaExtractorAgent", agentName: "SchemaExtractorAgent", action: "SCHEMA_EXTRACTED", entity: "oracle_crm.customers (7 columns)",  confidence: 0.99, result: "success",     severity: "INFO",   details: "Extracted 7 columns, 4,200,000 row count estimate." },
    { actor: "SchemaExtractorAgent", agentName: "SchemaExtractorAgent", action: "SCHEMA_EXTRACTED", entity: "sap_hr.employees (7 columns)",      confidence: 0.99, result: "success",     severity: "INFO",   details: "Extracted 7 columns, 18,400 row count estimate." },
    { actor: "SchemaExtractorAgent", agentName: "SchemaExtractorAgent", action: "SCHEMA_EXTRACTED", entity: "sqlserver_billing.invoices (6 col)", confidence: 0.99, result: "success",     severity: "INFO",   details: "Extracted 6 columns, 9,200,000 row count estimate." },
    { actor: "SemanticMapperAgent",  agentName: "SemanticMapperAgent",  action: "ENTITY_MAPPED",    entity: "Customer (oracle_crm.customers)",   confidence: 0.94, result: "success",     severity: "INFO",   details: "Mapped oracle_crm.customers to business entity: Customer." },
    { actor: "SemanticMapperAgent",  agentName: "SemanticMapperAgent",  action: "ENTITY_MAPPED",    entity: "Employee (sap_hr.employees)",        confidence: 0.91, result: "success",     severity: "INFO",   details: "Mapped sap_hr.employees to business entity: Employee." },
    { actor: "SemanticMapperAgent",  agentName: "SemanticMapperAgent",  action: "ENTITY_MAPPED",    entity: "Invoice (sqlserver_billing.invoices)", confidence: 0.95, result: "success",  severity: "INFO",   details: "Mapped sqlserver_billing.invoices to business entity: Invoice." },
    { actor: "PIIDetectorAgent",     agentName: "PIIDetectorAgent",     action: "COLUMN_CLASSIFIED", entity: "national_id → SENSITIVE",           confidence: 0.98, result: "success",    severity: "INFO",   details: "Pattern: GCC national ID format. Classified as SENSITIVE." },
    { actor: "PIIDetectorAgent",     agentName: "PIIDetectorAgent",     action: "COLUMN_CLASSIFIED", entity: "full_name → PII",                   confidence: 0.97, result: "success",    severity: "INFO",   details: "Pattern: personal name field. Classified as PII." },
    { actor: "PIIDetectorAgent",     agentName: "PIIDetectorAgent",     action: "ESCALATION_CREATED", entity: "billing_address (conf: 0.68)",     confidence: 0.68, result: "escalated",  severity: "MEDIUM", details: "Confidence below 0.70 threshold. Routed to human review queue." },
    { actor: "SchemaDriftAgent",     agentName: "SchemaDriftAgent",     action: "DRIFT_DETECTED",   entity: "oracle_crm.customers.national_id",  confidence: 0.99, result: "escalated",   severity: "HIGH",   details: "Column national_id removed from baseline snapshot. 3 dependent pipelines affected." },
    { actor: "SQLRewriteAgent",      agentName: "SQLRewriteAgent",      action: "REWRITE_GENERATED", entity: "ETL_CRM_DAILY_SYNC",               confidence: 0.82, result: "escalated",   severity: "MEDIUM", details: "Candidate rewrite generated. Confidence 0.82 below 0.85 threshold. Routed to human review." },
    { actor: "GovernanceAgent",      agentName: "GovernanceAgent",      action: "TRANSFER_INTERCEPTED", entity: "oracle_crm → eu-central-1",     confidence: 0.99, result: "intercepted", severity: "HIGH",   details: "Rule PDPL_SA_ART29_001 triggered. Saudi PII transfer to Germany blocked." },
    { actor: "GovernanceAgent",      agentName: "GovernanceAgent",      action: "TRANSFER_INTERCEPTED", entity: "sap_hr → Singapore",            confidence: 0.99, result: "intercepted", severity: "HIGH",   details: "Rule CITRA_KW_DATA_RESIDENCY_001 triggered. Kuwait civil ID transfer to SG blocked." },
    { actor: "GovernanceAgent",      agentName: "GovernanceAgent",      action: "TRANSFER_ALLOWED",  entity: "sqlserver_billing → AE",           confidence: 0.97, result: "allowed",     severity: "LOW",    details: "Rule INTERNAL_POLICY_001. Intra-UAE billing metadata transfer approved." },
    { actor: "SemanticMapperAgent",  agentName: "SemanticMapperAgent",  action: "GRAPH_UPDATED",    entity: "Knowledge Graph (6 nodes, 4 edges)", confidence: 0.95, result: "success",    severity: "INFO",   details: "Knowledge graph updated: Customer, Employee, Invoice, Department, Payment, Location nodes created." },
  ];

  for (let i = 0; i < auditEvents.length; i++) {
    const e = auditEvents[i];
    await db.insert(sadoAuditTrail).values({
      ...e,
      timestamp: now - (auditEvents.length - i) * 45_000,
      traceId: traceId(),
    });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
export const sadoRouter = router({
  // ── Agents ─────────────────────────────────────────────────────────────────
  getAgents: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const agents = await db.select().from(sadoAgents).orderBy(sadoAgents.id);
    if (agents.length === 0) {
      await seedSadoData(db);
      return db.select().from(sadoAgents).orderBy(sadoAgents.id);
    }
    return agents;
  }),

  // ── Sources + columns ───────────────────────────────────────────────────────
  getSources: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const sources = await db.select().from(sadoSources).orderBy(sadoSources.id);
    if (sources.length === 0) {
      await seedSadoData(db);
      return db.select().from(sadoSources).orderBy(sadoSources.id);
    }
    const columns = await db.select().from(sadoColumns).orderBy(sadoColumns.sourceId, sadoColumns.id);
    return sources.map(s => ({
      ...s,
      columns: columns.filter(c => c.sourceId === s.id),
    }));
  }),

  // ── Knowledge graph ─────────────────────────────────────────────────────────
  getKnowledgeGraph: publicProcedure.query(async () => {
    // Static graph definition — matches the synthetic schema
    return {
      nodes: [
        { id: "customer",   label: "Customer",   type: "entity",       count: 4200000, color: "#3b82f6", x: 300, y: 200 },
        { id: "employee",   label: "Employee",   type: "entity",       count: 18400,   color: "#8b5cf6", x: 700, y: 200 },
        { id: "invoice",    label: "Invoice",    type: "entity",       count: 9200000, color: "#06b6d4", x: 300, y: 500 },
        { id: "department", label: "Department", type: "reference",    count: 42,      color: "#f59e0b", x: 700, y: 500 },
        { id: "payment",    label: "Payment",    type: "transaction",  count: 8700000, color: "#10b981", x: 100, y: 350 },
        { id: "location",   label: "Location",   type: "reference",    count: 18,      color: "#ef4444", x: 500, y: 350 },
      ],
      edges: [
        { id: "e1", source: "customer",   target: "invoice",    label: "HAS",          count: 9200000 },
        { id: "e2", source: "invoice",    target: "customer",   label: "LINKED_TO",    count: 9200000 },
        { id: "e3", source: "employee",   target: "department", label: "BELONGS_TO",   count: 18400   },
        { id: "e4", source: "customer",   target: "location",   label: "LOCATED_IN",   count: 4200000 },
        { id: "e5", source: "invoice",    target: "payment",    label: "SETTLED_BY",   count: 8700000 },
      ],
    };
  }),

  // ── Governance alerts ───────────────────────────────────────────────────────
  getGovernanceAlerts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const alerts = await db.select().from(sadoGovernanceAlerts).orderBy(desc(sadoGovernanceAlerts.createdAt));
    if (alerts.length === 0) {
      await seedSadoData(db);
      return db.select().from(sadoGovernanceAlerts).orderBy(desc(sadoGovernanceAlerts.createdAt));
    }
    return alerts;
  }),

  // ── Escalation queue ────────────────────────────────────────────────────────
  getEscalations: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const escalations = await db.select().from(sadoEscalations).orderBy(desc(sadoEscalations.createdAt));
    if (escalations.length === 0) {
      await seedSadoData(db);
      return db.select().from(sadoEscalations).orderBy(desc(sadoEscalations.createdAt));
    }
    return escalations;
  }),

  // ── Resolve escalation ──────────────────────────────────────────────────────
  resolveEscalation: publicProcedure
    .input(z.object({
      id: z.number(),
      decision: z.enum(["approved", "rejected"]),
      rationale: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("DB unavailable");
      const now = Date.now();
      await db.update(sadoEscalations)
        .set({ status: input.decision, operatorDecision: input.rationale ?? null, resolvedAt: now })
        .where(eq(sadoEscalations.id, input.id));

      // Write to audit trail
      const [esc] = await db.select().from(sadoEscalations).where(eq(sadoEscalations.id, input.id));
      await db.insert(sadoAuditTrail).values({
        timestamp: now,
        actor: "operator",
        agentName: esc?.agentName ?? "unknown",
        action: input.decision === "approved" ? "OPERATOR_APPROVED" : "OPERATOR_REJECTED",
        entity: esc?.title ?? `escalation #${input.id}`,
        confidence: 1.0,
        result: input.decision,
        severity: "INFO",
        traceId: esc?.traceId ?? traceId(),
        details: input.rationale ?? null,
      });
      return { ok: true };
    }),

  // ── Audit trail ─────────────────────────────────────────────────────────────
  getAuditTrail: publicProcedure
    .input(z.object({
      agentFilter: z.string().optional(),
      severityFilter: z.string().optional(),
      actionFilter: z.string().optional(),
      limit: z.number().min(1).max(200).default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("DB unavailable");
      let rows = await db.select().from(sadoAuditTrail).orderBy(desc(sadoAuditTrail.timestamp)).limit(200);
      if (rows.length === 0) {
        await seedSadoData(db);
        rows = await db.select().from(sadoAuditTrail).orderBy(desc(sadoAuditTrail.timestamp)).limit(200);
      }
      if (input.agentFilter && input.agentFilter !== "all") {
        rows = rows.filter(r => r.agentName === input.agentFilter);
      }
      if (input.severityFilter && input.severityFilter !== "all") {
        rows = rows.filter(r => r.severity === input.severityFilter);
      }
      if (input.actionFilter && input.actionFilter !== "all") {
        rows = rows.filter(r => r.action.includes((input.actionFilter ?? "").toUpperCase()));
      }
      return rows.slice(0, input.limit);
    }),

  // ── Demo cycle ──────────────────────────────────────────────────────────────
  // Returns a sequence of step descriptors; the frontend animates them.
  getDemoCycleSteps: publicProcedure.query(() => {
    return [
      { step: 1, agentName: "SchemaExtractorAgent", action: "AGENT_STARTED",     duration: 1500, message: "Connecting to Oracle CRM, SAP HR, SQL Server Billing via MCP connectors…" },
      { step: 2, agentName: "SchemaExtractorAgent", action: "SCHEMA_EXTRACTED",  duration: 3000, message: "Extracted 3 source schemas: 20 columns, 13.4M total rows." },
      { step: 3, agentName: "SemanticMapperAgent",  action: "ENTITY_MAPPED",     duration: 3500, message: "Mapping schemas to business entities: Customer, Employee, Invoice…" },
      { step: 4, agentName: "PIIDetectorAgent",     action: "COLUMN_CLASSIFIED", duration: 3000, message: "Classifying 20 columns. Detected 6 PII/SENSITIVE fields." },
      { step: 5, agentName: "PIIDetectorAgent",     action: "ESCALATION_CREATED",duration: 1500, message: "billing_address confidence 0.68 — below threshold. Escalating to human queue." },
      { step: 6, agentName: "SemanticMapperAgent",  action: "GRAPH_UPDATED",     duration: 2000, message: "Knowledge graph updated: 6 nodes, 5 edges written to Neo4j." },
      { step: 7, agentName: "SchemaDriftAgent",     action: "DRIFT_DETECTED",    duration: 2500, message: "Schema drift detected: national_id removed from oracle_crm.customers. 3 pipelines affected." },
      { step: 8, agentName: "SQLRewriteAgent",      action: "REWRITE_GENERATED", duration: 3000, message: "Candidate SQL rewrite generated (conf: 0.82). Below 0.85 threshold — escalating." },
      { step: 9, agentName: "GovernanceAgent",      action: "TRANSFER_INTERCEPTED", duration: 2000, message: "INTERCEPTED: Saudi PII transfer to Germany. Rule PDPL_SA_ART29_001 triggered." },
      { step: 10, agentName: "GovernanceAgent",     action: "TRANSFER_INTERCEPTED", duration: 1500, message: "INTERCEPTED: Kuwait civil ID transfer to Singapore. Rule CITRA_KW_DATA_RESIDENCY_001 triggered." },
      { step: 11, agentName: "GovernanceAgent",     action: "TRANSFER_ALLOWED",  duration: 1000, message: "ALLOWED: UAE billing metadata intra-country transfer. Rule INTERNAL_POLICY_001." },
    ];
  }),

  // ── Apply demo cycle step (update agent status + write audit event) ─────────
  applyDemoStep: publicProcedure
    .input(z.object({
      step: z.number(),
      agentName: z.string(),
      action: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("DB unavailable");
      const now = Date.now();

      // Determine agent status for this step
      const isEscalation = input.action.includes("ESCALATION") || input.action.includes("REWRITE");
      const isIntercepted = input.action.includes("INTERCEPTED");
      const isCompleted = input.action.includes("ALLOWED") || input.action.includes("GRAPH_UPDATED");

      const newStatus = isEscalation ? "escalated" : isIntercepted ? "completed" : isCompleted ? "completed" : "running";

      await db.update(sadoAgents)
        .set({
          status: newStatus,
          currentTask: input.message,
          lastAction: input.action,
          confidence: isEscalation ? 0.75 : isIntercepted ? 0.99 : 0.95,
          updatedAt: now,
        })
        .where(eq(sadoAgents.name, input.agentName));

      // Write audit event
      await db.insert(sadoAuditTrail).values({
        timestamp: now,
        actor: input.agentName,
        agentName: input.agentName,
        action: input.action,
        entity: input.message.split(".")[0],
        confidence: isEscalation ? 0.75 : 0.95,
        result: isEscalation ? "escalated" : isIntercepted ? "intercepted" : "success",
        severity: isIntercepted ? "HIGH" : isEscalation ? "MEDIUM" : "INFO",
        traceId: traceId(),
        details: input.message,
      });

      return { ok: true, status: newStatus };
    }),

  // ── Reset demo ──────────────────────────────────────────────────────────────
  resetDemo: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(sadoAuditTrail);
    await db.delete(sadoEscalations);
    await db.delete(sadoGovernanceAlerts);
    await db.delete(sadoColumns);
    await db.delete(sadoSources);
    await db.delete(sadoAgents);
    await seedSadoData(db);
    return { ok: true };
  }),
});
