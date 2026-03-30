/**
 * lib/region/vaultClient.ts
 *
 * Sovereign Vault Client — AgenThinkMesh V2.2
 *
 * Enforces logical vault separation at the ORM query layer:
 *   - China-tagged deals write ONLY to china_sovereign_vault
 *   - Global deals write ONLY to global_vault
 *   - Cross-vault reads are blocked by policy (not just convention)
 *
 * All reads and writes go through this client — never query sovereignVault directly.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { sovereignVault, type InsertSovereignVaultEntry, type SovereignVaultEntry } from "../../../drizzle/schema";
import { REGION_CONFIG, type RegionProfile, type VaultName } from "./types";

// ── Cross-vault policy error ──────────────────────────────────────────────────

export class CrossVaultAccessError extends Error {
  constructor(attemptedVault: VaultName, allowedVault: VaultName, region: RegionProfile) {
    super(
      `Cross-vault access denied: region "${region}" may only access "${allowedVault}", ` +
      `but "${attemptedVault}" was requested. This is a policy violation.`
    );
    this.name = "CrossVaultAccessError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * getVaultName — returns the vault name for a given region.
 * This is the canonical mapping — always use this, never hardcode vault names.
 */
export function getVaultName(region: RegionProfile): VaultName {
  return REGION_CONFIG[region].vault;
}

/**
 * assertVaultAccess — throws CrossVaultAccessError if the requested vault
 * does not match the region's allowed vault.
 */
function assertVaultAccess(region: RegionProfile, requestedVault: VaultName): void {
  const allowedVault = getVaultName(region);
  if (requestedVault !== allowedVault) {
    throw new CrossVaultAccessError(requestedVault, allowedVault, region);
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * vaultWrite — insert a payload into the correct sovereign vault for the region.
 *
 * The vault name is derived automatically from the region — callers cannot
 * override it. This is the enforcement mechanism.
 *
 * @example
 *   await vaultWrite({
 *     region: "China",
 *     dealId: "deal-uuid",
 *     agentId: "COMPLIANCE_AUDITOR",
 *     payload: { verdict: "APPROVED", notes: "..." },
 *     classification: "CONFIDENTIAL",
 *   });
 */
export async function vaultWrite(params: {
  region: RegionProfile;
  dealId: string;
  agentId: string;
  payload: Record<string, unknown>;
  classification?: "RESTRICTED" | "CONFIDENTIAL" | "TOP_SECRET";
}): Promise<SovereignVaultEntry> {
  const vaultName = getVaultName(params.region);
  const db = await getDb();
  if (!db) throw new Error("Database connection unavailable");

  const entry: InsertSovereignVaultEntry = {
    vaultName,
    dealId: params.dealId,
    agentId: params.agentId,
    payload: JSON.stringify(params.payload),
    classification: params.classification ?? "RESTRICTED",
    region: params.region,
  };

  await db.insert(sovereignVault).values(entry);

  // Return the inserted row
  const [inserted] = await db
    .select()
    .from(sovereignVault)
    .where(
      and(
        eq(sovereignVault.dealId, params.dealId),
        eq(sovereignVault.agentId, params.agentId),
        eq(sovereignVault.vaultName, vaultName)
      )
    )
    .orderBy(sovereignVault.createdAt)
    .limit(1);

  return inserted;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * vaultRead — fetch all vault entries for a deal, scoped to the region's vault.
 *
 * Cross-vault reads are blocked: if you pass region="Global" but somehow
 * request china_sovereign_vault, CrossVaultAccessError is thrown.
 *
 * @example
 *   const entries = await vaultRead({ region: "China", dealId: "deal-uuid" });
 */
export async function vaultRead(params: {
  region: RegionProfile;
  dealId: string;
  /** Optional: restrict to a specific vault (must match region's vault or throws). */
  vaultName?: VaultName;
}): Promise<SovereignVaultEntry[]> {
  const allowedVault = getVaultName(params.region);

  // Enforce cross-vault policy
  if (params.vaultName) {
    assertVaultAccess(params.region, params.vaultName);
  }

  const db = await getDb();
  if (!db) throw new Error("Database connection unavailable");

  return db
    .select()
    .from(sovereignVault)
    .where(
      and(
        eq(sovereignVault.dealId, params.dealId),
        eq(sovereignVault.vaultName, allowedVault)  // ← ORM-level vault filter
      )
    )
    .orderBy(sovereignVault.createdAt);
}

/**
 * vaultReadByAgent — fetch vault entries for a specific agent within a deal.
 */
export async function vaultReadByAgent(params: {
  region: RegionProfile;
  dealId: string;
  agentId: string;
}): Promise<SovereignVaultEntry[]> {
  const allowedVault = getVaultName(params.region);
  const db = await getDb();
  if (!db) throw new Error("Database connection unavailable");

  return db
    .select()
    .from(sovereignVault)
    .where(
      and(
        eq(sovereignVault.dealId, params.dealId),
        eq(sovereignVault.agentId, params.agentId),
        eq(sovereignVault.vaultName, allowedVault)  // ← ORM-level vault filter
      )
    )
    .orderBy(sovereignVault.createdAt);
}
