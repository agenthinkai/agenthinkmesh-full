/**
 * arabicRefinementTypes.ts
 * Shared TypeScript types for the SADO Arabic Data Refinement module.
 */

// ─── Pipeline status ──────────────────────────────────────────────────────────

export type AgentStatus = 'idle' | 'running' | 'complete' | 'error';

export interface PipelineStatus {
  ingest: AgentStatus;
  normalize: AgentStatus;
  dialect: AgentStatus;
  compliance: AgentStatus;
}

// ─── Dialect marker config ────────────────────────────────────────────────────

export interface DialectDef {
  name: string;
  markers: string[];
}

export type DialectMarkerConfig = Record<string, DialectDef>;

// ─── Dialect score map ────────────────────────────────────────────────────────

export interface DialectScore {
  name: string;
  hits: number;
  found: Array<{ marker: string; hits: number }>;
}

export type DialectScoreMap = Record<string, DialectScore>;

export interface DialectResult {
  primary: string;
  primaryName: string;
  confidence: number;
  scores: DialectScoreMap;
  totalHits: number;
  llmFallbackUsed?: boolean;
}

// ─── PII pattern config ───────────────────────────────────────────────────────

export type PIISeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type PIITier = 'identifier' | 'government-id' | 'financial' | 'contact' | 'identity';

export interface PIIPatternConfig {
  type: string;
  regex: RegExp;
  severity: PIISeverity;
  tier: PIITier;
}

export interface PIIMatch {
  type: string;
  count: number;
  severity: PIISeverity;
  tier: PIITier;
  examples: string[];
}

export interface PIIResult {
  found: PIIMatch[];
  sensitivity: PIISeverity;
  highCount: number;
  mediumCount: number;
}

// ─── Encoding / ingest result ─────────────────────────────────────────────────

export interface IngestResult {
  issues: string[];
  direction: 'RTL-dominant' | 'LTR-dominant' | 'mixed bidi' | 'unknown';
  arabicChars: number;
  latinChars: number;
  charCount: number;
  lineCount: number;
}

// ─── Normalization output log ─────────────────────────────────────────────────

export interface NormalizationLogEntry {
  step: string;
  count: number;
}

export interface NormalizationResult {
  text: string;
  log: NormalizationLogEntry[];
}

// ─── Recommendation object ────────────────────────────────────────────────────

export type RecommendationCode = 'ALLOW' | 'REVIEW' | 'ESCALATE';

export interface RecommendationObject {
  code: RecommendationCode;
  reason: string;
}

// ─── Full pipeline results ────────────────────────────────────────────────────

export interface PipelineResults {
  ingest: IngestResult;
  normalize: NormalizationResult;
  dialect: DialectResult;
  pii: PIIResult;
  recommendation: RecommendationObject;
}

// ─── Audit export schema ──────────────────────────────────────────────────────

export interface AuditExportSchema {
  schema_version: '1.0';
  processor: string;
  tenant: string;
  deployment_mode: string;
  trace_id: string;
  timestamp: string;
  input: {
    char_count: number;
    line_count: number;
    content_hash_sha256: string | null;
  };
  ingest: {
    encoding_issues: string[];
    direction: string;
    arabic_char_count: number;
    latin_char_count: number;
  };
  normalization: {
    actions: NormalizationLogEntry[];
    output_char_count: number;
  };
  dialect: {
    primary: string;
    primary_name: string;
    confidence_percent: number;
    scores: Record<string, { name: string; hits: number }>;
  };
  pii: {
    found: Array<{ type: string; count: number; severity: PIISeverity; tier: PIITier }>;
    sensitivity: PIISeverity;
    high_count: number;
    medium_count: number;
  };
  recommendation: RecommendationObject;
  disclaimer: string;
}
