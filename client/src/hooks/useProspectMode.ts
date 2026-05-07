/**
 * useProspectMode — persists Prepare-for-Prospect state in localStorage.
 * Key: sado_prospect
 * Shape: { prospectName: string; organization: string; tagline: string }
 */
import { useState, useCallback, useEffect } from "react";

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

/**
 * buildProspectQuery — returns a URL query string (including leading "?") that
 * encodes the current prospect context, or an empty string when no prospect is
 * active.  Use this to append context to internal SADO navigation links so the
 * prospect mode survives page transitions.
 *
 * Usage:
 *   const qs = buildProspectQuery(prospect);
 *   <Link href={`/sado/audit-trail${qs}`}>
 */
export function buildProspectQuery(prospect: ProspectInfo | null): string {
  if (!prospect?.prospectName?.trim()) return "";
  const p = new URLSearchParams();
  p.set("prospect", prospect.prospectName);
  if (prospect.organization && prospect.organization !== prospect.prospectName) {
    p.set("org", prospect.organization);
  }
  if (prospect.tagline?.trim()) {
    p.set("tagline", prospect.tagline);
  }
  return `?${p.toString()}`;
}

/**
 * useProspectFromUrl — call this in any SADO page component.
 * Reads ?prospect=, ?org=, and ?tagline= from the URL.
 * Writes to localStorage synchronously so the initial render already
 * picks up the correct prospect (avoids a one-frame flash of stale data).
 * Does nothing if ?prospect= is absent.
 *
 * Supported params:
 *   prospect= — prospect / company short name (required to activate)
 *   org=      — full organisation name (falls back to prospect= value)
 *   tagline=  — demo subtitle / tagline override (optional)
 *
 * Example:
 *   /sado?prospect=STC&org=Saudi+Telecom+Company&tagline=Sovereign+Data+Engineering+Control+Layer
 */
export function useProspectFromUrl() {
  // Runs synchronously on every call (before first render).
  // Writing to localStorage here means readStorage() in useProspectMode
  // picks up the URL-supplied value on the very first render.
  // Idempotent: if ?prospect= is absent, nothing changes.
  try {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("prospect");
    if (name) {
      const org     = params.get("org")     || name;
      const tagline = params.get("tagline") || "";
      const info: ProspectInfo = { prospectName: name, organization: org, tagline };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    }
  } catch { /* noop */ }
}
