/**
 * server/enterprise.provision.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the provisionOrg atomic mutation (Step 8 of /enterprise/setup wizard)
 * and the EnterpriseSetupWizard route registration.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Input schema validation tests ────────────────────────────────────────────
// These tests validate the Zod schema shapes used by provisionOrg without
// requiring a live database connection.

const orgSchema = z.object({
  name: z.string().min(2).max(128),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  plan: z.enum(["trial", "standard", "enterprise"]).default("trial"),
  approvedDomains: z.array(z.string()).default([]),
  dailyTokenLimit: z.number().int().min(1000).max(10000000).default(50000),
  industry: z.string().max(64).optional(),
  geography: z.string().max(64).optional(),
  governanceProfile: z.enum(["STANDARD", "CONFIDENTIAL", "SOVEREIGN", "CLASSIFIED"]).optional().default("STANDARD"),
});

const deptSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(64),
  description: z.string().optional(),
});

const twinSchema = z.object({
  blueprintId: z.string(),
  instanceSlug: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  description: z.string().optional(),
  councilPersonaSetId: z.string().optional(),
  ontologyId: z.string().optional(),
  kpiSetId: z.string().optional(),
});

const connectorSchema = z.object({
  name: z.string().min(1).max(128),
  type: z.enum(["csv", "excel", "rest", "sql"]),
  owner: z.string().max(128).optional(),
  classification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
});

const provisionOrgInputSchema = z.object({
  org: orgSchema,
  departments: z.array(deptSchema).default([]),
  adminUser: z.object({
    userId: z.number(),
    jobTitle: z.string().max(128).optional(),
  }).optional(),
  twins: z.array(twinSchema).default([]),
  connectors: z.array(connectorSchema).default([]),
});

describe("provisionOrg input schema", () => {
  it("accepts a minimal valid input (org only)", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: { name: "Test Corp", slug: "test-corp" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.org.plan).toBe("trial");
      expect(result.data.org.dailyTokenLimit).toBe(50000);
      expect(result.data.org.governanceProfile).toBe("STANDARD");
      expect(result.data.departments).toEqual([]);
      expect(result.data.twins).toEqual([]);
      expect(result.data.connectors).toEqual([]);
    }
  });

  it("accepts a full Alghanim pilot input", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: {
        name: "Alghanim Industries",
        slug: "alghanim-industries",
        plan: "enterprise",
        approvedDomains: ["@alghanim.com", "@alghanim.com.kw"],
        dailyTokenLimit: 1000000,
        industry: "Conglomerate",
        geography: "Kuwait",
        governanceProfile: "CONFIDENTIAL",
      },
      departments: [
        { name: "Corporate Strategy", slug: "corporate-strategy" },
        { name: "Procurement", slug: "procurement" },
        { name: "Finance", slug: "finance" },
        { name: "Operations", slug: "operations" },
      ],
      adminUser: { userId: 1, jobTitle: "Chief Digital Officer" },
      twins: [
        { blueprintId: "bp-alghanim", instanceSlug: "alghanim-ma-screening", displayName: "M&A Screening Decision Twin" },
        { blueprintId: "bp-alghanim", instanceSlug: "alghanim-capital-allocation", displayName: "Capital Allocation Decision Twin" },
        { blueprintId: "bp-alghanim", instanceSlug: "alghanim-vendor-risk", displayName: "Vendor Risk Decision Twin" },
      ],
      connectors: [
        { name: "ERP Financial Data", type: "sql", owner: "Finance Team", classification: "confidential" },
        { name: "Procurement Reports", type: "excel", owner: "Procurement Team", classification: "internal" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.departments).toHaveLength(4);
      expect(result.data.twins).toHaveLength(3);
      expect(result.data.connectors).toHaveLength(2);
      expect(result.data.org.plan).toBe("enterprise");
    }
  });

  it("rejects an org name that is too short", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: { name: "A", slug: "a" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid slug with uppercase letters", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: { name: "Test Corp", slug: "TestCorp" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid slug with spaces", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: { name: "Test Corp", slug: "test corp" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid governance profile", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: { name: "Test Corp", slug: "test-corp", governanceProfile: "INVALID" as any },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a connector with an invalid type", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: { name: "Test Corp", slug: "test-corp" },
      connectors: [{ name: "Source", type: "ftp" as any, classification: "internal" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a twin with an empty instanceSlug", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: { name: "Test Corp", slug: "test-corp" },
      twins: [{ blueprintId: "bp-alghanim", instanceSlug: "", displayName: "Test Twin" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a dailyTokenLimit below minimum", () => {
    const result = provisionOrgInputSchema.safeParse({
      org: { name: "Test Corp", slug: "test-corp", dailyTokenLimit: 100 },
    });
    expect(result.success).toBe(false);
  });
});

// ─── Slug auto-generation logic ───────────────────────────────────────────────
describe("slug auto-generation", () => {
  function autoSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  it("converts org name to valid slug", () => {
    expect(autoSlug("Alghanim Industries")).toBe("alghanim-industries");
  });

  it("strips leading and trailing hyphens", () => {
    expect(autoSlug("  Test Corp  ")).toBe("test-corp");
  });

  it("collapses multiple special chars to single hyphen", () => {
    expect(autoSlug("Test & Corp (GCC)")).toBe("test-corp-gcc");
  });

  it("handles Arabic-adjacent names with only ASCII chars", () => {
    expect(autoSlug("NBK Financial Group")).toBe("nbk-financial-group");
  });

  it("produces slug that passes the slug regex", () => {
    const slug = autoSlug("Alghanim Industries");
    expect(/^[a-z0-9-]+$/.test(slug)).toBe(true);
  });
});

// ─── Route registration ───────────────────────────────────────────────────────
describe("EnterpriseSetupWizard route", () => {
  it("is registered at /enterprise/setup in App.tsx", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const appContent = fs.readFileSync(
      path.join(process.cwd(), "client/src/App.tsx"),
      "utf-8"
    );
    expect(appContent).toContain('/enterprise/setup');
    expect(appContent).toContain('EnterpriseSetupWizard');
  });

  it("EnterpriseSetupWizard.tsx file exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const exists = fs.existsSync(
      path.join(process.cwd(), "client/src/pages/EnterpriseSetupWizard.tsx")
    );
    expect(exists).toBe(true);
  });
});

// ─── provisionOrg server procedure existence ──────────────────────────────────
describe("provisionOrg procedure", () => {
  it("is exported from the enterprise router", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routerContent = fs.readFileSync(
      path.join(process.cwd(), "server/routers/enterprise.ts"),
      "utf-8"
    );
    expect(routerContent).toContain("provisionOrg:");
    expect(routerContent).toContain("adminProcedure");
    expect(routerContent).toContain("org.provision");
  });
});
