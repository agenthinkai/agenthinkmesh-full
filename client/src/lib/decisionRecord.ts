// AgenThink Decision Twin — Decision Record / Outcome Ledger
// Auto-saves every simulation run to localStorage

import type { ScenarioKey } from "./companyData";
import type { WhatIfAssumptions, WhatIfOutputs } from "./whatIfEngine";

export interface DecisionRecord {
  id: string;
  timestamp: string;
  companyId: string;
  companyName: string;
  scenario: ScenarioKey;
  scenarioLabel: string;
  assumptions: WhatIfAssumptions;
  outputs: WhatIfOutputs;
  recommendation: string;
  recommendationConfidence: number;
  councilSentiment: string;
}

const STORAGE_KEY = "agenthinkmesh_decision_ledger";
const MAX_RECORDS = 50;

export function saveDecisionRecord(record: Omit<DecisionRecord, "id" | "timestamp">): DecisionRecord {
  const full: DecisionRecord = {
    ...record,
    id: `DR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    timestamp: new Date().toISOString(),
  };

  const existing = loadDecisionRecords();
  const updated = [full, ...existing].slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be full; remove oldest half
    const trimmed = [full, ...existing.slice(0, MAX_RECORDS / 2)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
  return full;
}

export function loadDecisionRecords(): DecisionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DecisionRecord[];
  } catch {
    return [];
  }
}

export function clearDecisionRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function scenarioLabel(key: ScenarioKey): string {
  const map: Record<ScenarioKey, string> = {
    statusQuo: "Status Quo",
    aiAugmented: "AI-Augmented",
    marginCompression: "Margin Compression",
    growthScenario: "Growth Scenario",
    competitiveThreat: "Competitive Threat",
  };
  return map[key];
}
