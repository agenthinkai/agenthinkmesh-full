/**
 * Domain Ontology Service
 * Pattern: DB → 5-min cache → hardcoded fallback → null
 */
import { getDb } from "../db";
import { domainOntologies, DomainOntology, InsertDomainOntology } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface OntologyRecord {
  ontologyId: string;
  name: string;
  industryTag: string;
  version: string;
  entities: string[];
  relationships: string[];
  terminology: Record<string, string>;
  regulatoryContext: Record<string, unknown>;
  geographicContext: Record<string, unknown>;
  systemPromptFragment?: string;
  evaluationCriteria?: string;
  status: string;
}

const FALLBACK_ONTOLOGIES: Record<string, OntologyRecord> = {
  "gcc-finance": {
    ontologyId: "gcc-finance",
    name: "GCC Financial Services Ontology",
    industryTag: "financial-services",
    version: "1.0.0",
    entities: ["Bank", "Investment Company", "Insurance", "Sukuk", "Murabaha", "Ijara", "CBK", "CMA", "DFSA", "ADGM"],
    relationships: ["issues", "regulates", "invests_in", "guarantees", "underwrites"],
    terminology: {
      "NIM": "Net Interest Margin",
      "NPL": "Non-Performing Loan",
      "CAR": "Capital Adequacy Ratio",
      "ROE": "Return on Equity",
      "ARPU": "Average Revenue Per User",
    },
    regulatoryContext: { cbk: "Central Bank of Kuwait", cma: "Capital Markets Authority", basell3: true },
    geographicContext: { region: "GCC", countries: ["Kuwait", "UAE", "Saudi Arabia", "Qatar", "Bahrain", "Oman"] },
    systemPromptFragment: "You are operating in the GCC financial services context. Apply CBK, CMA, DFSA, and ADGM regulatory frameworks. Consider Islamic finance principles (Sharia compliance) where applicable. All monetary values default to KWD unless specified.",
    evaluationCriteria: "Regulatory compliance, capital adequacy, Sharia compliance, customer protection",
    status: "ACTIVE",
  },
  "gcc-industrial": {
    ontologyId: "gcc-industrial",
    name: "GCC Industrial & Manufacturing Ontology",
    industryTag: "manufacturing",
    version: "1.0.0",
    entities: ["Factory", "Assembly Line", "OEE", "HVAC", "Automotive", "MEP", "MODON", "KIIFCO"],
    relationships: ["manufactures", "supplies_to", "maintains", "certifies", "contracts_with"],
    terminology: {
      "OEE": "Overall Equipment Effectiveness",
      "MTBF": "Mean Time Between Failures",
      "MTTR": "Mean Time To Repair",
      "PPM": "Parts Per Million (defect rate)",
    },
    regulatoryContext: { modon: "Saudi Industrial Development Authority", kiifco: "Kuwait Industrial Investment Company" },
    geographicContext: { region: "GCC", industrial_zones: ["Shuwaikh", "KIZAD", "MODON", "JAFZA"] },
    systemPromptFragment: "You are operating in the GCC industrial and manufacturing context. Apply GCC industrial standards, MODON/KIIFCO regulations, and ISO manufacturing certifications.",
    evaluationCriteria: "OEE, quality rates, safety compliance, energy efficiency, localisation",
    status: "ACTIVE",
  },
  "gcc-defense": {
    ontologyId: "gcc-defense",
    name: "GCC Defense & Security Ontology",
    industryTag: "defense",
    version: "1.0.0",
    entities: ["SAMI", "GAMI", "RSLF", "RSAF", "RSNF", "UAV", "UGV", "USV", "ITAR", "EAR", "Vision2030"],
    relationships: ["procures", "manufactures", "deploys", "regulates", "certifies"],
    terminology: {
      "ITAR": "International Traffic in Arms Regulations",
      "EAR": "Export Administration Regulations",
      "GAMI": "General Authority for Military Industries",
      "SAMI": "Saudi Arabian Military Industries",
    },
    regulatoryContext: { itar: "22 CFR Parts 120-130", ear: "15 CFR Parts 730-774", gami: true },
    geographicContext: { region: "GCC", focus: "Saudi Arabia", operational_zones: ["Najran", "Red Sea", "Eastern Province", "Arabian Gulf"] },
    systemPromptFragment: "You are operating in the GCC defense and security context. ITAR/EAR compliance is mandatory. Data sovereignty is a national security requirement. All defense data must remain within sovereign infrastructure.",
    evaluationCriteria: "Sovereignty compliance, ITAR/EAR adherence, operational security, localisation percentage",
    status: "ACTIVE",
  },
  "gcc-ecommerce": {
    ontologyId: "gcc-ecommerce",
    name: "GCC E-Commerce & Logistics Ontology",
    industryTag: "e-commerce",
    version: "1.0.0",
    entities: ["SKU", "Cold Chain", "Last Mile", "3PL", "Marketplace", "Perishable", "PDPL", "NCA"],
    relationships: ["ships", "stores", "delivers", "returns", "regulates"],
    terminology: {
      "ARPU": "Average Revenue Per User",
      "CAC": "Customer Acquisition Cost",
      "LTV": "Lifetime Value",
      "GMV": "Gross Merchandise Value",
      "PDPL": "Personal Data Protection Law (Saudi)",
    },
    regulatoryContext: { pdpl: "Saudi Personal Data Protection Law", nca: "National Cybersecurity Authority" },
    geographicContext: { region: "GCC", markets: ["Kuwait", "UAE", "Saudi Arabia", "Qatar", "Bahrain", "Oman"] },
    systemPromptFragment: "You are operating in the GCC e-commerce context. Consider PDPL data localisation requirements, GCC customs regulations, and the perishable logistics challenge of 3-7 day shelf life products.",
    evaluationCriteria: "Data residency compliance, delivery SLA, cold chain integrity, customer satisfaction",
    status: "ACTIVE",
  },
  "gcc-legal": {
    ontologyId: "gcc-legal",
    name: "GCC Legal Services Ontology",
    industryTag: "legal",
    version: "1.0.0",
    entities: ["Attorney-Client Privilege", "Work Product", "Bar Association", "DIFC", "ADGM", "LCIA", "Sharia Board", "AAOIFI"],
    relationships: ["represents", "advises", "litigates", "arbitrates", "certifies"],
    terminology: {
      "ACP": "Attorney-Client Privilege",
      "WPD": "Work Product Doctrine",
      "DIFC": "Dubai International Financial Centre",
      "ADGM": "Abu Dhabi Global Market",
    },
    regulatoryContext: { kuwait_bar: "Kuwait Bar Association", saudi_bar: "Saudi Bar Association", uae_bar: "UAE Bar Association" },
    geographicContext: { region: "GCC", jurisdictions: ["Kuwait Civil Law", "Saudi Sharia Law", "DIFC Common Law", "ADGM Common Law"] },
    systemPromptFragment: "You are operating in the GCC legal services context. Attorney-client privilege is absolute. All client data must remain within the law firm's sovereign infrastructure. Sharia law principles apply in Saudi Arabia.",
    evaluationCriteria: "Privilege protection, regulatory compliance, Sharia adherence, malpractice risk elimination",
    status: "ACTIVE",
  },
  "gcc-healthcare": {
    ontologyId: "gcc-healthcare",
    name: "GCC Healthcare Ontology",
    industryTag: "healthcare",
    version: "1.0.0",
    entities: ["Hospital", "Clinic", "MOH", "DHA", "HAAD", "CCHI", "JCI", "NABIDH", "Malaffi"],
    relationships: ["treats", "refers", "licenses", "accredits", "insures"],
    terminology: {
      "CCHI": "Council of Cooperative Health Insurance (Saudi)",
      "DHA": "Dubai Health Authority",
      "HAAD": "Health Authority Abu Dhabi",
      "JCI": "Joint Commission International",
      "NABIDH": "Network and Analysis Backbone for Integrated Dubai Health",
    },
    regulatoryContext: { moh: "Ministry of Health", cchi: "Saudi CCHI", dha: "Dubai Health Authority" },
    geographicContext: { region: "GCC", health_systems: ["Kuwait MOH", "Saudi MOH", "Dubai DHA", "Abu Dhabi HAAD"] },
    systemPromptFragment: "You are operating in the GCC healthcare context. Patient data sovereignty is mandatory. Apply MOH, DHA, HAAD, and CCHI regulatory frameworks. JCI accreditation standards apply.",
    evaluationCriteria: "Patient safety, regulatory compliance, data sovereignty, clinical outcomes",
    status: "ACTIVE",
  },
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: OntologyRecord; expiresAt: number }>();

function fromRow(row: DomainOntology): OntologyRecord {
  return {
    ontologyId: row.ontologyId,
    name: row.name,
    industryTag: row.industryTag,
    version: row.version,
    entities: JSON.parse(row.entities || "[]"),
    relationships: JSON.parse(row.relationships || "[]"),
    terminology: JSON.parse(row.terminology || "{}"),
    regulatoryContext: JSON.parse(row.regulatoryContext || "{}"),
    geographicContext: JSON.parse(row.geographicContext || "{}"),
    systemPromptFragment: row.systemPromptFragment ?? undefined,
    evaluationCriteria: row.evaluationCriteria ?? undefined,
    status: row.status,
  };
}

export async function getOntology(ontologyId: string): Promise<OntologyRecord | null> {
  const cacheKey = `ont:${ontologyId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(domainOntologies)
        .where(and(eq(domainOntologies.ontologyId, ontologyId), eq(domainOntologies.status, "ACTIVE")))
        .limit(1);
      if (rows.length > 0) {
        const data = fromRow(rows[0]);
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch (e) {
      console.warn("[OntologyService] DB error, falling back:", e);
    }
  }

  const fallback = FALLBACK_ONTOLOGIES[ontologyId] ?? null;
  if (fallback) cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function getOntologyByIndustry(industryTag: string): Promise<OntologyRecord | null> {
  // Map industry tags to ontology IDs
  const mapping: Record<string, string> = {
    "financial-services": "gcc-finance",
    "banking": "gcc-finance",
    "manufacturing": "gcc-industrial",
    "defense": "gcc-defense",
    "e-commerce": "gcc-ecommerce",
    "legal": "gcc-legal",
    "healthcare": "gcc-healthcare",
  };
  const ontologyId = mapping[industryTag] ?? `gcc-${industryTag}`;
  return getOntology(ontologyId);
}

export async function listOntologies(): Promise<OntologyRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(domainOntologies)
        .where(eq(domainOntologies.status, "ACTIVE"));
      if (rows.length > 0) return rows.map(fromRow);
    } catch (e) {
      console.warn("[OntologyService] DB error, falling back:", e);
    }
  }
  return Object.values(FALLBACK_ONTOLOGIES);
}

export async function createOntology(input: Omit<InsertDomainOntology, "id" | "createdAt" | "updatedAt">): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = Date.now();
  await db.insert(domainOntologies).values({
    ...input,
    entities: JSON.stringify(input.entities ?? []),
    relationships: JSON.stringify(input.relationships ?? []),
    terminology: JSON.stringify(input.terminology ?? {}),
    regulatoryContext: JSON.stringify(input.regulatoryContext ?? {}),
    geographicContext: JSON.stringify(input.geographicContext ?? {}),
    createdAt: now,
    updatedAt: now,
  } as any);
  cache.clear();
  return true;
}

export function invalidateOntologyCache(): void {
  cache.clear();
}

export { FALLBACK_ONTOLOGIES };
