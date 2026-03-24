/**
 * Pre-built OpenClaw v1 Manifests for Google A2A Agents
 * These manifests describe each Google agent's capabilities, input/output schema,
 * and integration requirements in the OpenClaw protocol format.
 */

import type { GoogleAgentType } from "../server/googleA2AAdapter";

export interface OpenClawManifest {
  openclawVersion: string;
  agentId: string;
  agentType: GoogleAgentType;
  name: string;
  description: string;
  provider: "Google";
  protocol: "A2A";
  endpoint: string;
  authMethod: "google_oauth2" | "api_key" | "vertex_sa";
  capabilities: string[];
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  outputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
  };
  gccRelevance: string[];
  latencySla: string;
  pricing: string;
  clawReady: true;
  demoMode: boolean;
  tags: string[];
  icon: string;
  color: string;
}

export const GOOGLE_AGENT_MANIFESTS: Record<GoogleAgentType, OpenClawManifest> = {
  gemini: {
    openclawVersion: "1.0",
    agentId: "google-gemini-1-5-pro",
    agentType: "gemini",
    name: "Gemini 1.5 Pro",
    description:
      "Google's flagship multimodal AI agent. Handles complex reasoning, document analysis, code generation, and long-context tasks up to 1M tokens. Ideal for institutional-grade analysis in Finance, Legal, Insurance, and Healthcare.",
    provider: "Google",
    protocol: "A2A",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/a2a",
    authMethod: "api_key",
    capabilities: [
      "long_context_analysis",
      "multimodal_understanding",
      "structured_output",
      "code_generation",
      "arabic_language",
      "document_summarization",
      "reasoning",
    ],
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "The task instruction for Gemini" },
        context: { type: "object", description: "Additional context data" },
        documents: { type: "array", description: "Documents to analyze (URLs or base64)" },
        language: { type: "string", description: "Output language (en, ar, etc.)" },
      },
      required: ["instruction"],
    },
    outputSchema: {
      type: "object",
      properties: {
        analysis: { type: "string", description: "Full analysis output" },
        summary: { type: "string", description: "Executive summary" },
        keyFindings: { type: "array", description: "Structured key findings" },
        confidence: { type: "number", description: "Confidence score 0-100" },
      },
    },
    gccRelevance: [
      "Fund DDQ analysis",
      "Arabic document processing",
      "IC memo generation",
      "Insurance policy review",
      "Legal contract analysis",
    ],
    latencySla: "1.2–2.0s",
    pricing: "Pay-per-token via Google AI Studio",
    clawReady: true,
    demoMode: true,
    tags: ["llm", "multimodal", "long-context", "arabic", "enterprise"],
    icon: "✦",
    color: "#4285F4",
  },

  google_search: {
    openclawVersion: "1.0",
    agentId: "google-search-a2a",
    agentType: "google_search",
    name: "Google Search Agent",
    description:
      "Real-time web search with structured results. Provides live market data, news, competitor intelligence, and regulatory updates. Integrates directly into AgenThinkMesh pipelines for live data enrichment.",
    provider: "Google",
    protocol: "A2A",
    endpoint: "https://customsearch.googleapis.com/v1/a2a",
    authMethod: "api_key",
    capabilities: [
      "real_time_search",
      "news_retrieval",
      "structured_results",
      "arabic_search",
      "financial_data",
      "regulatory_monitoring",
    ],
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "Search query or instruction" },
        dateRange: { type: "string", description: "Date range filter (e.g., past_week)" },
        region: { type: "string", description: "Geographic region (e.g., GCC, KW, SA)" },
        resultCount: { type: "number", description: "Number of results to return (max 10)" },
      },
      required: ["instruction"],
    },
    outputSchema: {
      type: "object",
      properties: {
        results: { type: "array", description: "Search result items with title, URL, snippet" },
        totalResults: { type: "number", description: "Total results found" },
        searchTime: { type: "number", description: "Search execution time in ms" },
      },
    },
    gccRelevance: [
      "Live GCC market news",
      "Competitor intelligence",
      "SAMA/CBUAE regulatory updates",
      "Commodity price tracking",
      "Arabic news monitoring",
    ],
    latencySla: "400–700ms",
    pricing: "100 free queries/day via Custom Search API",
    clawReady: true,
    demoMode: true,
    tags: ["search", "real-time", "news", "market-data", "gcc"],
    icon: "🔍",
    color: "#34A853",
  },

  google_workspace: {
    openclawVersion: "1.0",
    agentId: "google-workspace-a2a",
    agentType: "google_workspace",
    name: "Google Workspace Agent",
    description:
      "Automates Google Docs, Sheets, Gmail, Calendar, and Drive. AgenThinkMesh pipelines can export results directly to Workspace — IC decision memos to Docs, underwriting data to Sheets, alerts to Gmail, follow-ups to Calendar.",
    provider: "Google",
    protocol: "A2A",
    endpoint: "https://workspace.googleapis.com/v1/a2a",
    authMethod: "google_oauth2",
    capabilities: [
      "docs_creation",
      "sheets_export",
      "gmail_send",
      "calendar_create",
      "drive_upload",
      "arabic_rtl_docs",
    ],
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "Workspace action instruction" },
        action: {
          type: "string",
          description: "Action type: create_doc, export_sheet, send_email, create_event",
        },
        content: { type: "object", description: "Content to write or send" },
        recipients: { type: "array", description: "Email recipients (for Gmail actions)" },
      },
      required: ["instruction", "action"],
    },
    outputSchema: {
      type: "object",
      properties: {
        documentUrl: { type: "string", description: "URL of created/updated document" },
        actionStatus: { type: "string", description: "Status of the Workspace action" },
        resourceId: { type: "string", description: "Google resource ID" },
      },
    },
    gccRelevance: [
      "Export IC decision memos to Google Docs",
      "AdMesh campaign briefs to Sheets",
      "Insurance underwriting reports",
      "Automated stakeholder email alerts",
      "Arabic RTL document creation",
    ],
    latencySla: "600ms–1.0s",
    pricing: "Included with Google Workspace subscription",
    clawReady: true,
    demoMode: true,
    tags: ["productivity", "export", "docs", "sheets", "email", "automation"],
    icon: "📊",
    color: "#0F9D58",
  },

  vertex_ai: {
    openclawVersion: "1.0",
    agentId: "google-vertex-ai-a2a",
    agentType: "vertex_ai",
    name: "Vertex AI Agent",
    description:
      "Enterprise-grade AI on Google Cloud. Supports custom fine-tuned models, VPC-SC data residency, Cloud Audit Logs, and Model Garden. GCC enterprises can deploy their own Vertex AI agents and register them in AgenThinkMesh via OpenClaw.",
    provider: "Google",
    protocol: "A2A",
    endpoint: "https://us-central1-aiplatform.googleapis.com/v1/a2a",
    authMethod: "vertex_sa",
    capabilities: [
      "custom_model_hosting",
      "enterprise_compliance",
      "data_residency",
      "audit_logging",
      "model_fine_tuning",
      "batch_prediction",
      "gcc_region_support",
    ],
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "Task instruction for the Vertex agent" },
        modelId: { type: "string", description: "Vertex AI model ID or endpoint ID" },
        context: { type: "object", description: "Task context and parameters" },
        complianceMode: {
          type: "string",
          description: "Compliance mode: sama, cbuae, hipaa, gdpr",
        },
      },
      required: ["instruction"],
    },
    outputSchema: {
      type: "object",
      properties: {
        prediction: { type: "string", description: "Model prediction output" },
        auditTrail: { type: "object", description: "Compliance audit trail" },
        modelVersion: { type: "string", description: "Model version used" },
        dataResidency: { type: "string", description: "Data residency region confirmed" },
      },
    },
    gccRelevance: [
      "SAMA-compliant AI inference",
      "Custom Arabic LLM hosting",
      "Regulated financial AI",
      "Healthcare data processing (HIPAA-equivalent)",
      "Government AI workloads",
    ],
    latencySla: "1.5–2.5s",
    pricing: "Pay-per-use via Google Cloud billing",
    clawReady: true,
    demoMode: true,
    tags: ["enterprise", "compliance", "custom-model", "gcc", "regulated"],
    icon: "⚡",
    color: "#DB4437",
  },

  google_maps: {
    openclawVersion: "1.0",
    agentId: "google-maps-a2a",
    agentType: "google_maps",
    name: "Google Maps Intelligence",
    description:
      "Location intelligence for GCC markets. Provides store coverage analysis, delivery zone mapping, competitor location data, foot traffic heatmaps, and route optimization across Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, and Oman.",
    provider: "Google",
    protocol: "A2A",
    endpoint: "https://maps.googleapis.com/maps/api/a2a",
    authMethod: "api_key",
    capabilities: [
      "location_search",
      "route_optimization",
      "heatmap_generation",
      "competitor_mapping",
      "coverage_analysis",
      "arabic_place_names",
      "gcc_region_data",
    ],
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "Location intelligence query" },
        region: { type: "string", description: "GCC region (KW, SA, AE, QA, BH, OM)" },
        radius: { type: "number", description: "Search radius in meters" },
        placeType: { type: "string", description: "Place type filter (e.g., electronics_store)" },
      },
      required: ["instruction"],
    },
    outputSchema: {
      type: "object",
      properties: {
        locations: { type: "array", description: "Array of location objects with coordinates" },
        coverageScore: { type: "number", description: "Coverage score 0-100" },
        heatmapData: { type: "object", description: "Heatmap data for visualization" },
        insights: { type: "string", description: "Location intelligence insights" },
      },
    },
    gccRelevance: [
      "Retail store coverage analysis",
      "Insurance risk zone mapping",
      "AdMesh geo-targeted campaign planning",
      "Logistics route optimization",
      "Competitor branch mapping",
    ],
    latencySla: "300–500ms",
    pricing: "Pay-per-request via Google Maps Platform",
    clawReady: true,
    demoMode: true,
    tags: ["maps", "location", "gcc", "retail", "logistics", "heatmap"],
    icon: "🗺️",
    color: "#FBBC04",
  },

  notebooklm: {
    openclawVersion: "1.0",
    agentId: "google-notebooklm-a2a",
    agentType: "notebooklm",
    name: "NotebookLM",
    description:
      "Deep document analysis and Q&A. Feed entire fund prospectuses, insurance policy wordings, legal contracts, or clinical records — NotebookLM reads everything, extracts key information, generates audio overviews, and answers follow-up questions with source citations.",
    provider: "Google",
    protocol: "A2A",
    endpoint: "https://notebooklm.googleapis.com/v1/a2a",
    authMethod: "google_oauth2",
    capabilities: [
      "deep_document_analysis",
      "source_citation",
      "audio_overview",
      "qa_mode",
      "multi_document_synthesis",
      "arabic_documents",
      "long_context_200k",
    ],
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "Analysis instruction or question" },
        documents: {
          type: "array",
          description: "Document URLs or Drive IDs to analyze",
        },
        analysisType: {
          type: "string",
          description: "Analysis type: summary, qa, extract, compare",
        },
        outputFormat: {
          type: "string",
          description: "Output format: text, structured, audio_script",
        },
      },
      required: ["instruction"],
    },
    outputSchema: {
      type: "object",
      properties: {
        analysis: { type: "string", description: "Full document analysis" },
        citations: { type: "array", description: "Source citations with page references" },
        keyExtractions: { type: "array", description: "Structured key extractions" },
        audioScript: { type: "string", description: "Audio overview script (if requested)" },
      },
    },
    gccRelevance: [
      "Fund DDQ deep analysis",
      "Insurance policy wording review",
      "Legal contract due diligence",
      "Clinical records summarization",
      "Arabic regulatory document analysis",
    ],
    latencySla: "2.0–3.5s",
    pricing: "Free tier available via Google account",
    clawReady: true,
    demoMode: true,
    tags: ["documents", "analysis", "citations", "qa", "long-context", "arabic"],
    icon: "📓",
    color: "#9C27B0",
  },
};

export const GOOGLE_AGENT_LIST = Object.values(GOOGLE_AGENT_MANIFESTS);

export function getGoogleAgentManifest(agentType: GoogleAgentType): OpenClawManifest {
  return GOOGLE_AGENT_MANIFESTS[agentType];
}
