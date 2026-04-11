/**
 * Unit tests for the Domains nav feature:
 * - DomainsPage slug encoding must round-trip through DomainAgents decoding
 * - SiteNav Domains link must point to /domains
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT_SRC = path.join(__dirname, "../client/src");

describe("Domains nav feature", () => {
  it("DomainsPage slug uses encodeURIComponent on the original domain name", () => {
    const domainsPageSrc = fs.readFileSync(
      path.join(CLIENT_SRC, "pages/DomainsPage.tsx"),
      "utf-8"
    );
    // Must use encodeURIComponent(domain) — not a lowercased/hyphenated slug
    expect(domainsPageSrc).toContain("encodeURIComponent(domain)");
    // Must link to /domain/:slug
    expect(domainsPageSrc).toContain("/domain/${slug}");
  });

  it("DomainAgents decodes the :name param with decodeURIComponent", () => {
    const domainAgentsSrc = fs.readFileSync(
      path.join(CLIENT_SRC, "pages/DomainAgents.tsx"),
      "utf-8"
    );
    expect(domainAgentsSrc).toContain("decodeURIComponent(params.name");
  });

  it("DomainAgents AgentCard navigates to /ask with agent id and name", () => {
    const domainAgentsSrc = fs.readFileSync(
      path.join(CLIENT_SRC, "pages/DomainAgents.tsx"),
      "utf-8"
    );
    expect(domainAgentsSrc).toContain("/ask?agent=${agent.id}&agentName=");
  });

  it("SiteNav Domains link points to /domains (not /pricing)", () => {
    const siteNavSrc = fs.readFileSync(
      path.join(CLIENT_SRC, "components/SiteNav.tsx"),
      "utf-8"
    );
    // Both desktop and mobile occurrences should be /domains
    const pricingMatches = (siteNavSrc.match(/href.*\/pricing/g) ?? []).length;
    expect(pricingMatches).toBe(0);
    const domainsMatches = (siteNavSrc.match(/href.*\/domains/g) ?? []).length;
    expect(domainsMatches).toBeGreaterThanOrEqual(2); // desktop + mobile
  });

  it("App.tsx registers /domains route", () => {
    const appSrc = fs.readFileSync(
      path.join(CLIENT_SRC, "App.tsx"),
      "utf-8"
    );
    expect(appSrc).toContain('path="/domains"');
    expect(appSrc).toContain("DomainsPage");
  });

  it("slug round-trip: encodeURIComponent then decodeURIComponent returns original domain", () => {
    const domains = ["Finance", "Legal", "GCC Wealth", "Healthcare", "Enterprise", "Education"];
    for (const domain of domains) {
      const slug = encodeURIComponent(domain);
      const decoded = decodeURIComponent(slug);
      expect(decoded).toBe(domain);
    }
  });

  it("DomainsPage uses platformStats for total agent count (not domain-bucket sum)", () => {
    const domainsPageSrc = fs.readFileSync(
      path.join(CLIENT_SRC, "pages/DomainsPage.tsx"),
      "utf-8"
    );
    // Must query platformStats for the authoritative count
    expect(domainsPageSrc).toContain("platformStats");
    // Must use verifiedAgents from that query
    expect(domainsPageSrc).toContain("verifiedAgents");
    // Must NOT rely solely on domain-bucket sum for the displayed total
    // (the reduce is kept as fallback, but platformStats takes precedence)
    expect(domainsPageSrc).toContain("statsQuery.data?.verifiedAgents");
  });

  it("platformStats procedure filters to active agents only", () => {
    const routersSrc = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    // The agentCount query must include a status='active' filter
    // Check that the line with count(*) from agents also has .where(eq(agents.status
    const platformStatsBlock = routersSrc.slice(
      routersSrc.indexOf("platformStats:"),
      routersSrc.indexOf("platformStats:") + 1200
    );
    expect(platformStatsBlock).toContain('agents.status, "active"');
  });

  it("DomainAgents DOMAIN_META includes Education entry with correct fields", () => {
    const domainAgentsSrc = fs.readFileSync(
      path.join(CLIENT_SRC, "pages/DomainAgents.tsx"),
      "utf-8"
    );
    expect(domainAgentsSrc).toContain('"Education"');
    // Must have icon, color, gradient, description, contexts
    expect(domainAgentsSrc).toContain('"\u{1F393}"'); // 🎓
    expect(domainAgentsSrc).toContain('"#818CF8"');
    expect(domainAgentsSrc).toContain('"Student Research"');
  });
});
