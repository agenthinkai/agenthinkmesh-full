/**
 * Enterprise Runtime Service — Sprint 2B
 * Manages organizations, departments, roles, memberships, twin instances, sessions, and audit log.
 */

import { getDb } from "../db";
import {
  departments,
  enterpriseRoles,
  enterpriseMemberships,
  twinInstances,
  twinSessions,
  enterpriseAuditLog,
  twinMessages,
  users,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TwinInstanceStatus = "provisioning" | "active" | "suspended" | "archived";
export type GovernanceProfile = "STANDARD" | "CONFIDENTIAL" | "SOVEREIGN" | "CLASSIFIED";
export type SessionType = "run" | "simulate" | "deliberate" | "compare" | "calibrate";
export type MessageType = "signal" | "alert" | "data_update" | "recommendation" | "calibration";
export type MessagePriority = "low" | "normal" | "high" | "critical";

export interface CreateTwinInstanceInput {
  orgId: number;
  deptId?: number;
  blueprintId: string;
  instanceSlug: string;
  displayName: string;
  description?: string;
  industry?: string;
  geography?: string;
  councilPersonaSetId?: string;
  ontologyId?: string;
  kpiSetId?: string;
  governanceProfile?: GovernanceProfile;
  configJson?: Record<string, unknown>;
}

export interface CreateTwinSessionInput {
  twinInstanceId: number;
  orgId: number;
  userId: number;
  sessionType: SessionType;
  inputJson?: Record<string, unknown>;
}

export interface AuditLogEntry {
  orgId: number;
  userId?: number;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  severity?: "info" | "warning" | "critical";
}

// ─── Department Service ───────────────────────────────────────────────────────

export async function listDepartments(orgId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(departments).where(eq(departments.orgId, orgId)).orderBy(departments.sortOrder);
}

export async function createDepartment(input: {
  orgId: number;
  name: string;
  slug: string;
  description?: string;
  parentDeptId?: number;
  headUserId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [result] = await db.insert(departments).values(input);
  return { id: (result as any).insertId, ...input };
}

// ─── Role Service ─────────────────────────────────────────────────────────────

export async function listRoles(orgId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(enterpriseRoles).where(eq(enterpriseRoles.orgId, orgId)).orderBy(enterpriseRoles.sortOrder);
}

export async function createRole(input: {
  orgId: number;
  name: string;
  slug: string;
  description?: string;
  permissions?: string[];
  twinAccess?: string[];
  isSystemRole?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [result] = await db.insert(enterpriseRoles).values({
    ...input,
    permissions: JSON.stringify(input.permissions ?? []),
    twinAccess: JSON.stringify(input.twinAccess ?? []),
    isSystemRole: input.isSystemRole ? 1 : 0,
  } as any);
  return { id: (result as any).insertId, ...input };
}

// ─── Membership Service ───────────────────────────────────────────────────────

export async function listMemberships(orgId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(enterpriseMemberships).where(eq(enterpriseMemberships.orgId, orgId));
}

export async function createMembership(input: {
  orgId: number;
  userId: number;
  roleId: number;
  deptId?: number;
  jobTitle?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [result] = await db.insert(enterpriseMemberships).values({
    ...input,
    status: "invited",
  } as any);
  return { id: (result as any).insertId, ...input };
}

// ─── Twin Instance Service ────────────────────────────────────────────────────

export async function listTwinInstances(orgId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db
    .select()
    .from(twinInstances)
    .where(eq(twinInstances.orgId, orgId))
    .orderBy(desc(twinInstances.createdAt));
}

export async function getTwinInstance(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select().from(twinInstances).where(eq(twinInstances.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createTwinInstance(input: CreateTwinInstanceInput) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [result] = await db.insert(twinInstances).values({
    ...input,
    configJson: JSON.stringify(input.configJson ?? {}),
    status: "provisioning",
  } as any);
  const id = (result as any).insertId;
  // Immediately mark as active (no async provisioning in Sprint 2B)
  await db.update(twinInstances).set({ status: "active", activatedAt: new Date() } as any).where(eq(twinInstances.id, id));
  return { id, ...input, status: "active" };
}

export async function updateTwinInstanceStatus(id: number, status: TwinInstanceStatus) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(twinInstances).set({ status } as any).where(eq(twinInstances.id, id));
}

export async function archiveTwinInstance(id: number) {
  return updateTwinInstanceStatus(id, "archived");
}

// ─── Twin Session Service ─────────────────────────────────────────────────────

export async function createTwinSession(input: CreateTwinSessionInput) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [result] = await db.insert(twinSessions).values({
    ...input,
    inputJson: JSON.stringify(input.inputJson ?? {}),
    status: "pending",
  } as any);
  const id = (result as any).insertId;
  return { id, ...input };
}

export async function completeTwinSession(
  id: number,
  output: Record<string, unknown>,
  durationMs: number,
  tokensUsed: number
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(twinSessions)
    .set({
      outputJson: JSON.stringify(output),
      status: "completed",
      durationMs,
      tokensUsed,
      completedAt: new Date(),
    } as any)
    .where(eq(twinSessions.id, id));
  // Increment run count on the twin instance
  const session = await db.select().from(twinSessions).where(eq(twinSessions.id, id)).limit(1);
  if (session[0]) {
    await db
      .update(twinInstances)
      .set({ lastRunAt: new Date(), runCount: sql`run_count + 1` } as any)
      .where(eq(twinInstances.id, session[0].twinInstanceId));
  }
}

export async function listTwinSessions(twinInstanceId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db
    .select()
    .from(twinSessions)
    .where(eq(twinSessions.twinInstanceId, twinInstanceId))
    .orderBy(desc(twinSessions.startedAt))
    .limit(limit);
}

// ─── Audit Log Service ────────────────────────────────────────────────────────

export async function writeAuditLog(entry: AuditLogEntry) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(enterpriseAuditLog).values({
    ...entry,
    severity: entry.severity ?? "info",
  } as any);
}

export async function listAuditLog(orgId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db
    .select()
    .from(enterpriseAuditLog)
    .where(eq(enterpriseAuditLog.orgId, orgId))
    .orderBy(desc(enterpriseAuditLog.createdAt))
    .limit(limit);
}

// ─── Twin Message Service ─────────────────────────────────────────────────────

export async function sendTwinMessage(input: {
  orgId: number;
  fromTwinId: number;
  toTwinId: number;
  messageType: MessageType;
  subject: string;
  payloadJson?: Record<string, unknown>;
  priority?: MessagePriority;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [result] = await db.insert(twinMessages).values({
    ...input,
    payloadJson: JSON.stringify(input.payloadJson ?? {}),
    priority: input.priority ?? "normal",
    status: "pending",
  } as any);
  return { id: (result as any).insertId, ...input };
}

export async function listTwinMessages(orgId: number, twinId?: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const conditions = twinId
    ? and(eq(twinMessages.orgId, orgId), eq(twinMessages.toTwinId, twinId))
    : eq(twinMessages.orgId, orgId);
  return db
    .select()
    .from(twinMessages)
    .where(conditions)
    .orderBy(desc(twinMessages.createdAt))
    .limit(limit);
}

export async function acknowledgeTwinMessage(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(twinMessages)
    .set({ status: "acknowledged", acknowledgedAt: new Date() } as any)
    .where(eq(twinMessages.id, id));
}

// ─── Membership Management (Sprint 3) ────────────────────────────────────────

export type MembershipStatus = "active" | "suspended" | "invited";

export async function updateMembershipStatus(
  membershipId: number,
  orgId: number,
  status: MembershipStatus,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existing] = await db
    .select({ id: enterpriseMemberships.id })
    .from(enterpriseMemberships)
    .where(and(eq(enterpriseMemberships.id, membershipId), eq(enterpriseMemberships.orgId, orgId)))
    .limit(1);
  if (!existing) throw new Error("Membership not found or org mismatch");
  await db
    .update(enterpriseMemberships)
    .set({ status, updatedAt: new Date() } as any)
    .where(eq(enterpriseMemberships.id, membershipId));
  return { success: true, membershipId, status };
}

export async function listOrgMembers(orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      membershipId: enterpriseMemberships.id,
      userId: enterpriseMemberships.userId,
      roleId: enterpriseMemberships.roleId,
      deptId: enterpriseMemberships.deptId,
      jobTitle: enterpriseMemberships.jobTitle,
      status: enterpriseMemberships.status,
      joinedAt: enterpriseMemberships.joinedAt,
      lastActiveAt: enterpriseMemberships.lastActiveAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(enterpriseMemberships)
    .leftJoin(users, eq(users.id, enterpriseMemberships.userId))
    .where(eq(enterpriseMemberships.orgId, orgId))
    .orderBy(desc(enterpriseMemberships.createdAt));
  return rows;
}

// ─── Enterprise Stats ─────────────────────────────────────────────────────────

export async function getEnterpriseStats(orgId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [instances] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(twinInstances)
    .where(and(eq(twinInstances.orgId, orgId), eq(twinInstances.status, "active")));
  const [sessions] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(twinSessions)
    .where(eq(twinSessions.orgId, orgId));
  const [members] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(enterpriseMemberships)
    .where(eq(enterpriseMemberships.orgId, orgId));
  const [messages] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(twinMessages)
    .where(and(eq(twinMessages.orgId, orgId), eq(twinMessages.status, "pending")));

  return {
    activeTwins: Number(instances?.count ?? 0),
    totalSessions: Number(sessions?.count ?? 0),
    totalMembers: Number(members?.count ?? 0),
    pendingMessages: Number(messages?.count ?? 0),
  };
}
