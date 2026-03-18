/**
 * Insurance & Reinsurance Intelligence Engine — Vitest Tests
 */

import { describe, it, expect } from "vitest";
import {
  INSURANCE_AGENTS,
  CHAIN_MAP,
  getInsuranceAgentById,
  UNDERWRITING_CHAIN,
  TREATY_CHAIN,
  CLAIMS_CHAIN,
  COMPLIANCE_CHAIN,
  CAT_MODEL_CHAIN,
} from "../shared/insuranceAgents";

describe("Insurance Agent Registry", () => {
  it("should have exactly 10 agents", () => {
    expect(INSURANCE_AGENTS).toHaveLength(10);
  });

  it("should have agents across all 4 clusters", () => {
    const clusters = new Set(INSURANCE_AGENTS.map(a => a.cluster));
    expect(clusters.has("intake")).toBe(true);
    expect(clusters.has("underwriting")).toBe(true);
    expect(clusters.has("reinsurance")).toBe(true);
    expect(clusters.has("decision")).toBe(true);
  });

  it("should find agent by ID", () => {
    const agent = getInsuranceAgentById("IN-DM-001");
    expect(agent).toBeDefined();
    expect(agent?.name).toBe("UnderwritingDecisionAgent");
  });

  it("should return undefined for unknown agent ID", () => {
    const agent = getInsuranceAgentById("XX-XX-999");
    expect(agent).toBeUndefined();
  });

  it("each agent should have required fields", () => {
    for (const agent of INSURANCE_AGENTS) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.cluster).toBeTruthy();
      expect(agent.function).toBeTruthy();
      expect(agent.icon).toBeTruthy();
      expect(Array.isArray(agent.outputFields)).toBe(true);
      expect(agent.outputFields.length).toBeGreaterThan(0);
    }
  });
});

describe("Insurance Workflow Chains", () => {
  it("underwriting chain should have 7 agents", () => {
    expect(UNDERWRITING_CHAIN).toHaveLength(7);
  });

  it("treaty chain should have 5 agents", () => {
    expect(TREATY_CHAIN).toHaveLength(5);
  });

  it("claims chain should have 4 agents", () => {
    expect(CLAIMS_CHAIN).toHaveLength(4);
  });

  it("compliance chain should have 3 agents", () => {
    expect(COMPLIANCE_CHAIN).toHaveLength(3);
  });

  it("cat_model chain should have 4 agents", () => {
    expect(CAT_MODEL_CHAIN).toHaveLength(4);
  });

  it("all chain agent IDs should resolve to known agents", () => {
    const allChains = [
      ...UNDERWRITING_CHAIN,
      ...TREATY_CHAIN,
      ...CLAIMS_CHAIN,
      ...COMPLIANCE_CHAIN,
      ...CAT_MODEL_CHAIN,
    ];
    for (const id of allChains) {
      const agent = getInsuranceAgentById(id);
      expect(agent, `Agent ${id} should exist`).toBeDefined();
    }
  });

  it("CHAIN_MAP should have all 5 workflow types", () => {
    expect(CHAIN_MAP).toHaveProperty("underwriting");
    expect(CHAIN_MAP).toHaveProperty("treaty");
    expect(CHAIN_MAP).toHaveProperty("claims");
    expect(CHAIN_MAP).toHaveProperty("compliance");
    expect(CHAIN_MAP).toHaveProperty("cat_model");
  });

  it("underwriting chain should end with decision agent", () => {
    const lastAgentId = UNDERWRITING_CHAIN[UNDERWRITING_CHAIN.length - 1];
    expect(lastAgentId).toBe("IN-DM-001");
  });

  it("underwriting chain should start with intake agent", () => {
    expect(UNDERWRITING_CHAIN[0]).toBe("IN-IN-001");
  });

  it("treaty chain should include reinsurance agents", () => {
    const reinsuranceAgents = INSURANCE_AGENTS
      .filter(a => a.cluster === "reinsurance")
      .map(a => a.id);
    const treatyHasReinsuranceAgent = TREATY_CHAIN.some(id => reinsuranceAgents.includes(id));
    expect(treatyHasReinsuranceAgent).toBe(true);
  });
});

describe("Insurance Agent Clusters", () => {
  it("intake cluster should have 2 agents", () => {
    const intake = INSURANCE_AGENTS.filter(a => a.cluster === "intake");
    expect(intake).toHaveLength(2);
  });

  it("underwriting cluster should have 4 agents", () => {
    const uw = INSURANCE_AGENTS.filter(a => a.cluster === "underwriting");
    expect(uw).toHaveLength(4);
  });

  it("reinsurance cluster should have 3 agents", () => {
    const re = INSURANCE_AGENTS.filter(a => a.cluster === "reinsurance");
    expect(re).toHaveLength(3);
  });

  it("decision cluster should have 1 agent", () => {
    const dm = INSURANCE_AGENTS.filter(a => a.cluster === "decision");
    expect(dm).toHaveLength(1);
  });

  it("TakafulClassifier should be in intake cluster", () => {
    const agent = getInsuranceAgentById("IN-IN-002");
    expect(agent?.cluster).toBe("intake");
    expect(agent?.name).toBe("TakafulClassifier");
  });

  it("ShariaComplianceAgent should be in underwriting cluster", () => {
    const agent = getInsuranceAgentById("IN-UW-002");
    expect(agent?.cluster).toBe("underwriting");
    expect(agent?.name).toBe("ShariaComplianceAgent");
  });

  it("CatastropheModeler should be in reinsurance cluster", () => {
    const agent = getInsuranceAgentById("IN-RE-002");
    expect(agent?.cluster).toBe("reinsurance");
    expect(agent?.name).toBe("CatastropheModeler");
  });
});
