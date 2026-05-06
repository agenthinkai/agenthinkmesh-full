/**
 * useProspectMode — persists Prepare-for-Prospect state in localStorage.
 * Key: sado_prospect
 * Shape: { prospectName: string; organization: string; tagline: string }
 */
import { useState, useCallback } from "react";

export interface ProspectInfo {
  prospectName: string;
  organization: string;
  tagline: string;
}

const STORAGE_KEY = "sado_prospect";

function readStorage(): ProspectInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProspectInfo>;
    if (!parsed.prospectName && !parsed.organization) return null;
    return {
      prospectName: parsed.prospectName ?? "",
      organization: parsed.organization ?? "",
      tagline: parsed.tagline ?? "",
    };
  } catch {
    return null;
  }
}

export function useProspectMode() {
  const [prospect, setProspectState] = useState<ProspectInfo | null>(readStorage);

  const saveProspect = useCallback((info: ProspectInfo) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    } catch { /* noop */ }
    setProspectState(info);
  }, []);

  const clearProspect = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }
    setProspectState(null);
  }, []);

  /** Display label: "ADNOC Digital" or "ADNOC Digital · Ministry of Energy" if org differs */
  const displayLabel = prospect
    ? prospect.organization && prospect.organization !== prospect.prospectName
      ? `${prospect.prospectName} · ${prospect.organization}`
      : prospect.prospectName
    : null;

  return { prospect, displayLabel, saveProspect, clearProspect };
}
