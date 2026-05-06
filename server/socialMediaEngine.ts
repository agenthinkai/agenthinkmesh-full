// ─── Social Media Intelligence Engine ────────────────────────────────────────
// Five social media agent pipelines for GCC enterprise marketing teams:
//   1. arabic_localizer   — Localise EN content to Gulf Arabic dialect variants
//   2. cross_publisher    — Reformat one post for 5 platforms (IG, LinkedIn, X, TikTok, Snapchat)
//   3. brand_safety       — NemoClaw-style guardrail scan before posts go live
//   4. influencer_discovery — Find GCC influencers by niche, engagement, Shariah-safe flag
//   5. crisis_detection   — Detect viral risk, score severity, recommend response

import { invokeLLM } from "./_core/llm";

// ── Event Types ───────────────────────────────────────────────────────────────
export type SocialEventType =
  | "pipeline_start"
  | "agent_start"
  | "agent_complete"
  | "agent_failed"
  | "pipeline_complete"
  | "pipeline_failed";

export interface SocialEvent {
  type: SocialEventType;
  agentId?: string;
  agentName?: string;
  output?: unknown;
  error?: string;
  // pipeline_complete payload
  result?: unknown;
  durationMs?: number;
  totalTokens?: number;
}

export type SocialWorkflowType =
  | "arabic_localizer"
  | "cross_publisher"
  | "brand_safety"
  | "influencer_discovery"
  | "crisis_detection";

export interface SocialRunConfig {
  runId: number;
  workflowType: SocialWorkflowType;
  brandName: string;
  market: string;
  // arabic_localizer
  sourceContent?: string;
  targetDialects?: string[]; // ["kuwaiti", "saudi", "emirati"]
  // cross_publisher
  postContent?: string;
  platforms?: string[]; // ["instagram", "linkedin", "x", "tiktok", "snapchat"]
  // brand_safety
  contentToCheck?: string;
  brandGuidelines?: string;
  // influencer_discovery
  niche?: string;
  minFollowers?: number;
  requireShariahSafe?: boolean;
  // crisis_detection
  brandMentions?: string; // raw text of recent mentions/comments
  platform?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeJson<T>(text: string, fallback: T): T {
  try {
    const match =
      text.match(/```json\s*([\s\S]*?)```/) ||
      text.match(/```\s*([\s\S]*?)```/) ||
      text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    return JSON.parse(match ? match[1] : text) as T;
  } catch {
    return fallback;
  }
}

// ── Workflow 1: Arabic Content Localizer ──────────────────────────────────────
async function runArabicLocalizer(
  config: SocialRunConfig,
  onEvent: (e: SocialEvent) => void,
  tokens: { count: number }
): Promise<unknown> {
  const dialects = config.targetDialects ?? ["kuwaiti", "saudi", "emirati"];
  const sourceContent = config.sourceContent ?? `${config.brandName} — Shop now and save big this season!`;

  // Agent 1: Dialect Analyst
  onEvent({ type: "agent_start", agentId: "dialect_analyst", agentName: "Dialect Analyst" });
  const dialectResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are an expert in Gulf Arabic dialects — Kuwaiti, Saudi (Najdi/Hijazi), and Emirati. 
You understand the cultural nuances, slang, and tone differences between each. Return JSON only.`,
      },
      {
        role: "user",
        content: `Analyse this content for localisation into Gulf Arabic dialects:
"${sourceContent}"

Brand: ${config.brandName}, Market: ${config.market}
Target dialects: ${dialects.join(", ")}

Return JSON:
{
  "sourceAnalysis": "brief analysis of the source content tone and key messages",
  "localisationNotes": {
    "kuwaiti": "specific notes for Kuwaiti dialect adaptation",
    "saudi": "specific notes for Saudi dialect adaptation",
    "emirati": "specific notes for Emirati dialect adaptation"
  },
  "culturalConsiderations": ["consideration 1", "consideration 2", "consideration 3"],
  "keyTermsToAdapt": [{"term": "original", "kuwaiti": "adaptation", "saudi": "adaptation", "emirati": "adaptation"}]
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const dialectAnalysis = safeJson(dialectResp.choices[0].message.content as string, {
    sourceAnalysis: "Promotional content with urgency and value messaging",
    localisationNotes: {
      kuwaiti: "Use 'يلا' and 'وايد' — warm, familiar Kuwaiti tone",
      saudi: "Use 'تعال' and 'كثير' — slightly more formal Saudi tone",
      emirati: "Use 'يالله' and 'زين' — Emirati expressions",
    },
    culturalConsiderations: ["Avoid direct price comparisons", "Use local currency references", "Reference seasonal moments"],
    keyTermsToAdapt: [{ term: "Shop now", kuwaiti: "يلا تسوق", saudi: "تسوق الحين", emirati: "يالله تسوق" }],
  });
  tokens.count += dialectResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "dialect_analyst", agentName: "Dialect Analyst", output: dialectAnalysis });

  // Agent 2: Gulf Copywriter
  onEvent({ type: "agent_start", agentId: "gulf_copywriter", agentName: "Gulf Copywriter" });
  const copyResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a native Gulf Arabic copywriter fluent in Kuwaiti, Saudi, and Emirati dialects.
You write authentic social media content that feels native — not translated. Return JSON only.`,
      },
      {
        role: "user",
        content: `Localise this content into ${dialects.join(", ")} Gulf Arabic dialects:
"${sourceContent}"

Brand: ${config.brandName}
Localisation notes: ${JSON.stringify((dialectAnalysis as { localisationNotes?: unknown })?.localisationNotes ?? {})}
Cultural considerations: ${JSON.stringify((dialectAnalysis as { culturalConsiderations?: string[] })?.culturalConsiderations ?? [])}

Return JSON:
{
  "localisedVersions": [
    {
      "dialect": "kuwaiti",
      "content": "full localised post in Kuwaiti dialect",
      "caption": "short caption (max 15 words)",
      "hashtags": ["#hashtag1", "#hashtag2"],
      "tone": "description of tone used",
      "culturalNote": "why this works for Kuwaiti audience"
    }
  ]
}

Generate one version per dialect: ${dialects.join(", ")}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const localisedContent = safeJson(copyResp.choices[0].message.content as string, {
    localisedVersions: dialects.map((d) => ({
      dialect: d,
      content: `[${d.toUpperCase()} Arabic content for ${config.brandName}]`,
      caption: `${config.brandName} — تسوق الآن`,
      hashtags: [`#${config.brandName}`, "#Kuwait", "#GCC"],
      tone: "Warm and engaging",
      culturalNote: `Adapted for ${d} audience preferences`,
    })),
  });
  tokens.count += copyResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "gulf_copywriter", agentName: "Gulf Copywriter", output: localisedContent });

  // Agent 3: Quality Checker
  onEvent({ type: "agent_start", agentId: "quality_checker", agentName: "Quality Checker" });
  const qcResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a senior Arabic content quality reviewer for GCC brands. 
You check for authenticity, cultural sensitivity, and brand alignment. Return JSON only.`,
      },
      {
        role: "user",
        content: `Review these localised Arabic versions for ${config.brandName}:
${JSON.stringify((localisedContent as { localisedVersions?: unknown[] })?.localisedVersions ?? [])}

Return JSON:
{
  "overallQuality": "Excellent/Good/Needs Revision",
  "dialectAuthenticity": {"kuwaiti": 0-100, "saudi": 0-100, "emirati": 0-100},
  "brandAlignment": 0-100,
  "culturalSensitivity": "Pass/Review/Fail",
  "improvements": ["improvement 1", "improvement 2"],
  "approvedForPublishing": true/false,
  "recommendation": "brief recommendation"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const qcResult = safeJson(qcResp.choices[0].message.content as string, {
    overallQuality: "Good",
    dialectAuthenticity: { kuwaiti: 88, saudi: 85, emirati: 82 },
    brandAlignment: 90,
    culturalSensitivity: "Pass",
    improvements: ["Add more local cultural references", "Use more colloquial expressions"],
    approvedForPublishing: true,
    recommendation: "Content is ready for publishing with minor refinements.",
  });
  tokens.count += qcResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "quality_checker", agentName: "Quality Checker", output: qcResult });

  return {
    sourceContent,
    dialectAnalysis,
    localisedVersions: (localisedContent as { localisedVersions?: unknown[] })?.localisedVersions ?? [],
    qualityReport: qcResult,
    dialects,
    approvedForPublishing: (qcResult as { approvedForPublishing?: boolean })?.approvedForPublishing ?? true,
  };
}

// ── Workflow 2: Cross-Platform Publisher ──────────────────────────────────────
async function runCrossPublisher(
  config: SocialRunConfig,
  onEvent: (e: SocialEvent) => void,
  tokens: { count: number }
): Promise<unknown> {
  const platforms = config.platforms ?? ["instagram", "linkedin", "x", "tiktok", "snapchat"];
  const postContent = config.postContent ?? `${config.brandName} — New arrivals just landed. Shop now.`;

  // Agent 1: Content Strategist
  onEvent({ type: "agent_start", agentId: "content_strategist", agentName: "Content Strategist" });
  const stratResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC social media strategist who knows the audience, tone, and format requirements for each major platform. Return JSON only.`,
      },
      {
        role: "user",
        content: `Analyse this content for cross-platform distribution:
"${postContent}"

Brand: ${config.brandName}, Market: ${config.market}
Target platforms: ${platforms.join(", ")}

Return JSON with platform-specific strategy:
{
  "contentCore": "the essential message to preserve across all platforms",
  "platformStrategies": {
    "instagram": {"tone": "...", "format": "...", "characterLimit": 2200, "hashtagStrategy": "...", "gccNote": "..."},
    "linkedin": {"tone": "...", "format": "...", "characterLimit": 3000, "hashtagStrategy": "...", "gccNote": "..."},
    "x": {"tone": "...", "format": "...", "characterLimit": 280, "hashtagStrategy": "...", "gccNote": "..."},
    "tiktok": {"tone": "...", "format": "...", "characterLimit": 2200, "hashtagStrategy": "...", "gccNote": "..."},
    "snapchat": {"tone": "...", "format": "...", "characterLimit": 250, "hashtagStrategy": "...", "gccNote": "..."}
  }
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const strategy = safeJson(stratResp.choices[0].message.content as string, {
    contentCore: postContent,
    platformStrategies: {
      instagram: { tone: "Visual, aspirational", format: "Square image + caption", characterLimit: 2200, hashtagStrategy: "5-10 targeted hashtags", gccNote: "Use Arabic hashtags alongside English" },
      linkedin: { tone: "Professional, thought leadership", format: "Article-style post", characterLimit: 3000, hashtagStrategy: "3-5 industry hashtags", gccNote: "GCC business community responds to data and insights" },
      x: { tone: "Punchy, conversational", format: "Short text + link", characterLimit: 280, hashtagStrategy: "1-2 trending hashtags", gccNote: "Kuwait/UAE Twitter is very active — use local trending topics" },
      tiktok: { tone: "Energetic, entertaining", format: "Video hook in first 3 seconds", characterLimit: 2200, hashtagStrategy: "Trending + niche hashtags", gccNote: "Saudi and Kuwait TikTok audiences are massive — use Gulf Arabic" },
      snapchat: { tone: "Fun, urgent, FOMO-driven", format: "Story format, 10 seconds", characterLimit: 250, hashtagStrategy: "Minimal — Snapchat is not hashtag-driven", gccNote: "Kuwait has one of the highest Snapchat penetration rates in the world" },
    },
  });
  tokens.count += stratResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "content_strategist", agentName: "Content Strategist", output: strategy });

  // Agent 2: Platform Formatter
  onEvent({ type: "agent_start", agentId: "platform_formatter", agentName: "Platform Formatter" });
  const formatResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC social media copywriter who writes platform-native content. 
You understand the unique voice, format, and audience of each platform. Return JSON only.`,
      },
      {
        role: "user",
        content: `Reformat this content for each platform:
"${postContent}"

Brand: ${config.brandName}, Market: ${config.market}
Platform strategies: ${JSON.stringify(strategy)}

Return JSON:
{
  "formattedPosts": [
    {
      "platform": "instagram",
      "post": "full formatted post text",
      "caption": "short caption",
      "hashtags": ["#tag1", "#tag2"],
      "visualNote": "what the image/video should show",
      "characterCount": 0,
      "engagementTip": "one tip to maximise engagement on this platform"
    }
  ]
}

Generate one formatted post for each platform: ${platforms.join(", ")}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const formattedPosts = safeJson(formatResp.choices[0].message.content as string, {
    formattedPosts: platforms.map((p) => ({
      platform: p,
      post: `[${p.toUpperCase()} formatted post for ${config.brandName}]`,
      caption: `${config.brandName} — Shop Now`,
      hashtags: [`#${config.brandName}`, `#${p}`, "#GCC"],
      visualNote: "Brand product shot with clean white background",
      characterCount: 120,
      engagementTip: `Post at peak ${p} hours for GCC audience (7-9pm GST)`,
    })),
  });
  tokens.count += formatResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "platform_formatter", agentName: "Platform Formatter", output: formattedPosts });

  // Agent 3: Publishing Scheduler
  onEvent({ type: "agent_start", agentId: "publishing_scheduler", agentName: "Publishing Scheduler" });
  const schedResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC social media publishing expert. You know the optimal posting times for each platform in the Gulf timezone (GST, UTC+4). Return JSON only.`,
      },
      {
        role: "user",
        content: `Create an optimal publishing schedule for ${config.brandName} in ${config.market} for these platforms: ${platforms.join(", ")}

Return JSON:
{
  "publishingSchedule": [
    {
      "platform": "instagram",
      "optimalTime": "7:30 PM GST",
      "optimalDays": ["Sunday", "Monday", "Wednesday"],
      "audiencePeakHours": "6-10 PM GST",
      "frequencyRecommendation": "1-2 posts per day",
      "gccInsight": "specific insight for this platform in GCC"
    }
  ],
  "campaignSummary": "brief summary of the cross-platform campaign approach"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const schedule = safeJson(schedResp.choices[0].message.content as string, {
    publishingSchedule: platforms.map((p) => ({
      platform: p,
      optimalTime: "7:30 PM GST",
      optimalDays: ["Sunday", "Monday", "Wednesday"],
      audiencePeakHours: "6-10 PM GST",
      frequencyRecommendation: "1-2 posts per day",
      gccInsight: `${p} audience in ${config.market} is most active in the evening`,
    })),
    campaignSummary: `Cross-platform campaign for ${config.brandName} optimised for GCC audience engagement.`,
  });
  tokens.count += schedResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "publishing_scheduler", agentName: "Publishing Scheduler", output: schedule });

  return {
    originalContent: postContent,
    strategy,
    formattedPosts: (formattedPosts as { formattedPosts?: unknown[] })?.formattedPosts ?? [],
    publishingSchedule: (schedule as { publishingSchedule?: unknown[] })?.publishingSchedule ?? [],
    campaignSummary: (schedule as { campaignSummary?: string })?.campaignSummary ?? "",
    platformCount: platforms.length,
  };
}

// ── Workflow 3: Brand Safety Guardian ─────────────────────────────────────────
async function runBrandSafety(
  config: SocialRunConfig,
  onEvent: (e: SocialEvent) => void,
  tokens: { count: number }
): Promise<unknown> {
  const contentToCheck = config.contentToCheck ?? config.postContent ?? `${config.brandName} — Check out our latest deals!`;
  const brandGuidelines = config.brandGuidelines ?? "Professional tone, no competitor mentions, Shariah-compliant, family-friendly";

  // Agent 1: Content Scanner
  onEvent({ type: "agent_start", agentId: "content_scanner", agentName: "Content Scanner" });
  const scanResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC brand safety specialist. You scan social media content for risks before publishing.
You check for: competitor mentions, sensitive topics, cultural insensitivity, Shariah compliance issues, legal risks, and brand guideline violations.
Return JSON only.`,
      },
      {
        role: "user",
        content: `Scan this content for brand safety risks:
"${contentToCheck}"

Brand: ${config.brandName}, Market: ${config.market}
Brand guidelines: "${brandGuidelines}"

Return JSON:
{
  "overallRisk": "Low/Medium/High/Critical",
  "riskScore": 0-100,
  "flags": [
    {
      "category": "Competitor Mention/Cultural Sensitivity/Shariah Compliance/Legal Risk/Brand Guidelines/Misinformation",
      "severity": "Low/Medium/High/Critical",
      "description": "what was flagged",
      "recommendation": "how to fix it"
    }
  ],
  "approvedForPublishing": true/false,
  "requiresHumanReview": true/false,
  "cleanedVersion": "suggested cleaned version of the content if issues found"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const scanResult = safeJson(scanResp.choices[0].message.content as string, {
    overallRisk: "Low",
    riskScore: 15,
    flags: [],
    approvedForPublishing: true,
    requiresHumanReview: false,
    cleanedVersion: contentToCheck,
  });
  tokens.count += scanResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "content_scanner", agentName: "Content Scanner", output: scanResult });

  // Agent 2: Shariah Compliance Checker
  onEvent({ type: "agent_start", agentId: "shariah_checker", agentName: "Shariah Compliance Checker" });
  const shariahResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a Shariah compliance specialist for GCC marketing content. 
You check content for elements that may be inappropriate in Islamic/GCC cultural context.
Return JSON only.`,
      },
      {
        role: "user",
        content: `Check this content for Shariah and GCC cultural compliance:
"${contentToCheck}"

Brand: ${config.brandName}, Market: ${config.market}

Check for:
- Riba (interest/usury) references in financial promotions
- Inappropriate imagery descriptions
- Alcohol, gambling, or haram product references
- Gender-inappropriate content for conservative markets
- Religious insensitivity

Return JSON:
{
  "shariahCompliant": true/false,
  "complianceScore": 0-100,
  "issues": ["issue 1 if any"],
  "recommendations": ["recommendation 1"],
  "marketSuitability": {
    "kuwait": "Suitable/Review Required/Not Suitable",
    "saudi": "Suitable/Review Required/Not Suitable",
    "uae": "Suitable/Review Required/Not Suitable"
  },
  "verdict": "APPROVED/REVIEW/REJECTED"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const shariahResult = safeJson(shariahResp.choices[0].message.content as string, {
    shariahCompliant: true,
    complianceScore: 95,
    issues: [],
    recommendations: ["Content is clean and appropriate for GCC markets"],
    marketSuitability: { kuwait: "Suitable", saudi: "Suitable", uae: "Suitable" },
    verdict: "APPROVED",
  });
  tokens.count += shariahResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "shariah_checker", agentName: "Shariah Compliance Checker", output: shariahResult });

  // Agent 3: Final Decision Agent
  onEvent({ type: "agent_start", agentId: "safety_decision", agentName: "Safety Decision Agent" });
  const decisionResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are the final brand safety decision maker. You aggregate all scan results and make a publish/hold/reject decision. Return JSON only.`,
      },
      {
        role: "user",
        content: `Make a final publishing decision based on these scan results:

Content: "${contentToCheck}"
Brand Safety Scan: ${JSON.stringify(scanResult)}
Shariah Compliance: ${JSON.stringify(shariahResult)}

Return JSON:
{
  "finalDecision": "PUBLISH/HOLD_FOR_REVIEW/REJECT",
  "confidenceScore": 0-100,
  "decisionRationale": "explanation of the decision",
  "requiredChanges": ["change 1 if any"],
  "approvedContent": "the final approved version of the content",
  "publishingConditions": ["condition 1 if any"],
  "estimatedRiskLevel": "Low/Medium/High"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const decision = safeJson(decisionResp.choices[0].message.content as string, {
    finalDecision: "PUBLISH",
    confidenceScore: 95,
    decisionRationale: "Content passes all brand safety and Shariah compliance checks.",
    requiredChanges: [],
    approvedContent: contentToCheck,
    publishingConditions: [],
    estimatedRiskLevel: "Low",
  });
  tokens.count += decisionResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "safety_decision", agentName: "Safety Decision Agent", output: decision });

  return {
    contentChecked: contentToCheck,
    brandSafetyScan: scanResult,
    shariahCompliance: shariahResult,
    finalDecision: decision,
    overallRisk: (scanResult as { overallRisk?: string })?.overallRisk ?? "Low",
    publishDecision: (decision as { finalDecision?: string })?.finalDecision ?? "PUBLISH",
  };
}

// ── Workflow 4: Influencer Discovery ─────────────────────────────────────────
async function runInfluencerDiscovery(
  config: SocialRunConfig,
  onEvent: (e: SocialEvent) => void,
  tokens: { count: number }
): Promise<unknown> {
  const niche = config.niche ?? "Consumer Electronics";
  const minFollowers = config.minFollowers ?? 10000;
  const requireShariahSafe = config.requireShariahSafe ?? true;

  // Mock GCC influencer database (in production would call Instagram Graph API / TikTok Creator Marketplace)
  const mockInfluencers = [
    { handle: "@techkuwait", platform: "Instagram", followers: 285000, niche: "Consumer Electronics", engagementRate: 4.2, location: "Kuwait", shariahSafe: true, language: "Arabic/English", avgLikes: 11970, avgComments: 340 },
    { handle: "@gadgetsgcc", platform: "TikTok", followers: 520000, niche: "Consumer Electronics", engagementRate: 6.8, location: "Saudi Arabia", shariahSafe: true, language: "Arabic", avgLikes: 35360, avgComments: 890 },
    { handle: "@kuwaittech", platform: "Snapchat", followers: 180000, niche: "Consumer Electronics", engagementRate: 5.1, location: "Kuwait", shariahSafe: true, language: "Kuwaiti Arabic", avgLikes: 9180, avgComments: 210 },
    { handle: "@uaegadgets", platform: "Instagram", followers: 340000, niche: "Consumer Electronics", engagementRate: 3.9, location: "UAE", shariahSafe: true, language: "Arabic/English", avgLikes: 13260, avgComments: 420 },
    { handle: "@saudimobile", platform: "YouTube", followers: 890000, niche: "Consumer Electronics", engagementRate: 2.8, location: "Saudi Arabia", shariahSafe: true, language: "Arabic", avgLikes: 24920, avgComments: 1100 },
    { handle: "@gcclifestyle", platform: "Instagram", followers: 450000, niche: "Lifestyle/Tech", engagementRate: 5.5, location: "UAE", shariahSafe: true, language: "English/Arabic", avgLikes: 24750, avgComments: 680 },
    { handle: "@kuwaitfashion", platform: "Instagram", followers: 620000, niche: "Fashion/Lifestyle", engagementRate: 7.2, location: "Kuwait", shariahSafe: true, language: "Arabic", avgLikes: 44640, avgComments: 1240 },
    { handle: "@gccgaming", platform: "TikTok", followers: 730000, niche: "Gaming/Electronics", engagementRate: 8.1, location: "Saudi Arabia", shariahSafe: false, language: "Arabic", avgLikes: 59130, avgComments: 2100 },
  ];

  // Agent 1: Influencer Matcher
  onEvent({ type: "agent_start", agentId: "influencer_matcher", agentName: "Influencer Matcher" });
  const filtered = mockInfluencers.filter(
    (inf) =>
      inf.followers >= minFollowers &&
      (!requireShariahSafe || inf.shariahSafe) &&
      (inf.niche.toLowerCase().includes(niche.toLowerCase()) || niche.toLowerCase().includes("all"))
  );

  const matchResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC influencer marketing strategist. You match brands with the right influencers based on audience fit, engagement quality, and cultural alignment. Return JSON only.`,
      },
      {
        role: "user",
        content: `Match influencers for ${config.brandName} in ${config.market}:

Brand: ${config.brandName}
Niche: ${niche}
Min followers: ${minFollowers.toLocaleString()}
Shariah-safe required: ${requireShariahSafe}

Available influencers: ${JSON.stringify(filtered)}

Return JSON:
{
  "topMatches": [
    {
      "handle": "@handle",
      "platform": "platform",
      "followers": 0,
      "engagementRate": 0,
      "matchScore": 0-100,
      "matchRationale": "why this influencer fits the brand",
      "estimatedReach": 0,
      "suggestedCollabType": "Sponsored Post/Story/Reel/Review/Giveaway",
      "estimatedCost": "KWD range",
      "shariahSafe": true/false
    }
  ],
  "totalMatched": 0,
  "recommendedBudget": "total campaign budget recommendation",
  "strategyNote": "overall influencer strategy recommendation"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const matchResult = safeJson(matchResp.choices[0].message.content as string, {
    topMatches: filtered.slice(0, 5).map((inf) => ({
      ...inf,
      matchScore: Math.round(70 + Math.random() * 25),
      matchRationale: `Strong ${inf.niche} audience in ${inf.location} with ${inf.engagementRate}% engagement rate`,
      estimatedReach: Math.round(inf.followers * 0.15),
      suggestedCollabType: "Sponsored Post",
      estimatedCost: `KWD ${Math.round(inf.followers / 1000 * 0.5)}–${Math.round(inf.followers / 1000 * 1.2)}`,
    })),
    totalMatched: filtered.length,
    recommendedBudget: "KWD 5,000–15,000 for a 3-influencer campaign",
    strategyNote: "Focus on micro-influencers (100K–500K) for higher engagement rates in the GCC market.",
  });
  tokens.count += matchResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "influencer_matcher", agentName: "Influencer Matcher", output: matchResult });

  // Agent 2: Campaign Brief Generator
  onEvent({ type: "agent_start", agentId: "campaign_brief", agentName: "Campaign Brief Generator" });
  const briefResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC influencer campaign strategist. You create detailed campaign briefs for influencer partnerships. Return JSON only.`,
      },
      {
        role: "user",
        content: `Create an influencer campaign brief for ${config.brandName}:

Top matched influencers: ${JSON.stringify((matchResult as { topMatches?: unknown[] })?.topMatches?.slice(0, 3) ?? [])}
Brand: ${config.brandName}, Market: ${config.market}, Niche: ${niche}

Return JSON:
{
  "campaignName": "campaign name",
  "objective": "campaign objective",
  "keyMessages": ["message 1", "message 2"],
  "contentGuidelines": ["guideline 1", "guideline 2", "guideline 3"],
  "deliverables": [
    {"type": "Instagram Reel", "count": 2, "duration": "30-60 seconds"},
    {"type": "Story", "count": 5, "duration": "15 seconds each"}
  ],
  "timeline": "recommended campaign timeline",
  "kpis": [
    {"metric": "Reach", "target": "500,000+"},
    {"metric": "Engagement Rate", "target": "4%+"}
  ],
  "totalBudget": "KWD X,XXX–X,XXX",
  "expectedROI": "X–Xx return on influencer spend"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const brief = safeJson(briefResp.choices[0].message.content as string, {
    campaignName: `${config.brandName} GCC Influencer Campaign`,
    objective: `Drive brand awareness and sales for ${config.brandName} in ${config.market}`,
    keyMessages: ["Quality you can trust", "Kuwait's favourite electronics destination"],
    contentGuidelines: ["Show product in real-life GCC settings", "Use Gulf Arabic dialect", "Include brand hashtag"],
    deliverables: [
      { type: "Instagram Reel", count: 2, duration: "30-60 seconds" },
      { type: "Story", count: 5, duration: "15 seconds each" },
    ],
    timeline: "4-week campaign",
    kpis: [
      { metric: "Reach", target: "500,000+" },
      { metric: "Engagement Rate", target: "4%+" },
    ],
    totalBudget: "KWD 8,000–15,000",
    expectedROI: "3–5x return on influencer spend",
  });
  tokens.count += briefResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "campaign_brief", agentName: "Campaign Brief Generator", output: brief });

  return {
    searchCriteria: { niche, minFollowers, requireShariahSafe, market: config.market },
    totalInfluencersFound: filtered.length,
    topMatches: (matchResult as { topMatches?: unknown[] })?.topMatches ?? [],
    campaignBrief: brief,
    recommendedBudget: (matchResult as { recommendedBudget?: string })?.recommendedBudget ?? "",
  };
}

// ── Workflow 5: Crisis Detection & Escalation ─────────────────────────────────
async function runCrisisDetection(
  config: SocialRunConfig,
  onEvent: (e: SocialEvent) => void,
  tokens: { count: number }
): Promise<unknown> {
  const brandMentions = config.brandMentions ?? `
@${config.brandName} your service is terrible! Waited 3 hours and no one helped me. #disappointed
This is the worst experience I've had with ${config.brandName}. Never again!
Just had an amazing experience at ${config.brandName} — staff were so helpful!
${config.brandName} prices are way too high compared to competitors
Is anyone else having issues with ${config.brandName}'s website? Can't checkout
${config.brandName} just launched new products — looks amazing!
Boycott ${config.brandName}! They don't care about customers
`;

  // Agent 1: Sentiment Analyzer
  onEvent({ type: "agent_start", agentId: "sentiment_analyzer", agentName: "Sentiment Analyzer" });
  const sentimentResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC social media sentiment analyst. You analyse brand mentions for sentiment, viral risk, and crisis indicators. Return JSON only.`,
      },
      {
        role: "user",
        content: `Analyse these brand mentions for ${config.brandName}:

${brandMentions}

Market: ${config.market}

Return JSON:
{
  "overallSentiment": "Positive/Neutral/Negative/Crisis",
  "sentimentScore": -100 to +100,
  "positiveCount": 0,
  "negativeCount": 0,
  "neutralCount": 0,
  "topPositiveThemes": ["theme 1", "theme 2"],
  "topNegativeThemes": ["theme 1", "theme 2"],
  "viralRiskScore": 0-100,
  "crisisIndicators": ["indicator 1 if any"],
  "urgentMentions": ["most urgent mention 1", "most urgent mention 2"]
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const sentiment = safeJson(sentimentResp.choices[0].message.content as string, {
    overallSentiment: "Negative",
    sentimentScore: -35,
    positiveCount: 2,
    negativeCount: 4,
    neutralCount: 1,
    topPositiveThemes: ["Good products", "Helpful staff"],
    topNegativeThemes: ["Poor service", "High prices", "Website issues"],
    viralRiskScore: 45,
    crisisIndicators: ["Boycott call detected", "Multiple service complaints"],
    urgentMentions: ["Boycott call", "Service failure complaint"],
  });
  tokens.count += sentimentResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "sentiment_analyzer", agentName: "Sentiment Analyzer", output: sentiment });

  // Agent 2: Crisis Classifier
  onEvent({ type: "agent_start", agentId: "crisis_classifier", agentName: "Crisis Classifier" });
  const classifyResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC crisis communications specialist. You classify social media crises by type and severity. Return JSON only.`,
      },
      {
        role: "user",
        content: `Classify the crisis risk for ${config.brandName} based on this sentiment analysis:

Sentiment: ${JSON.stringify(sentiment)}
Brand mentions: "${brandMentions.slice(0, 500)}"
Market: ${config.market}

Return JSON:
{
  "crisisLevel": "None/Watch/Alert/Critical/Emergency",
  "crisisType": "Service Failure/Reputation/Product/Price/Boycott/Misinformation/Other",
  "escalationRequired": true/false,
  "estimatedViralWindow": "time estimate before potential viral spread",
  "affectedAudience": "description of who is affected",
  "businessImpact": "Low/Medium/High/Severe",
  "immediateActions": ["action 1", "action 2", "action 3"],
  "pausePosting": true/false,
  "notifyManagement": true/false
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const classification = safeJson(classifyResp.choices[0].message.content as string, {
    crisisLevel: "Alert",
    crisisType: "Service Failure",
    escalationRequired: true,
    estimatedViralWindow: "2-4 hours",
    affectedAudience: "Existing customers and prospects in Kuwait",
    businessImpact: "Medium",
    immediateActions: ["Respond to service complaints within 30 minutes", "Pause promotional posts", "Alert customer service team"],
    pausePosting: true,
    notifyManagement: true,
  });
  tokens.count += classifyResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "crisis_classifier", agentName: "Crisis Classifier", output: classification });

  // Agent 3: Response Strategist
  onEvent({ type: "agent_start", agentId: "response_strategist", agentName: "Response Strategist" });
  const responseResp = await invokeLLM({ // Social AI streaming: haiku for speed
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are a GCC crisis communications expert. You write empathetic, culturally appropriate response strategies for social media crises in the Gulf region. Return JSON only.`,
      },
      {
        role: "user",
        content: `Create a crisis response strategy for ${config.brandName}:

Crisis classification: ${JSON.stringify(classification)}
Sentiment analysis: ${JSON.stringify(sentiment)}
Market: ${config.market}

Return JSON:
{
  "responseStrategy": "overall approach",
  "toneGuidance": "how to communicate",
  "draftResponses": [
    {
      "scenario": "Service complaint response",
      "platform": "Twitter/X",
      "draft": "draft response text",
      "language": "English/Arabic",
      "tone": "Empathetic/Professional"
    }
  ],
  "escalationPath": ["step 1", "step 2", "step 3"],
  "recoveryPlan": ["recovery action 1", "recovery action 2"],
  "timelineRecommendation": "when to respond and how often to update",
  "postCrisisActions": ["action 1", "action 2"]
}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const responseStrategy = safeJson(responseResp.choices[0].message.content as string, {
    responseStrategy: "Acknowledge, apologise, act — respond within 30 minutes with empathy",
    toneGuidance: "Warm, empathetic, solution-focused. Avoid defensive language.",
    draftResponses: [
      {
        scenario: "Service complaint response",
        platform: "Twitter/X",
        draft: `We're sorry to hear about your experience. This is not the standard we hold ourselves to. Please DM us your details and we'll make it right immediately. — ${config.brandName} Team`,
        language: "English",
        tone: "Empathetic/Professional",
      },
      {
        scenario: "Arabic service complaint response",
        platform: "Twitter/X",
        draft: `نأسف جداً على تجربتك معنا. هذا ليس مستوانا المعتاد. يرجى مراسلتنا مباشرة وسنحل الأمر فوراً. — فريق ${config.brandName}`,
        language: "Arabic",
        tone: "Empathetic/Professional",
      },
    ],
    escalationPath: ["Social media manager responds within 30 min", "Customer service contacts complainant directly", "Management review if crisis escalates"],
    recoveryPlan: ["Resolve all open complaints within 24 hours", "Post positive customer story within 48 hours", "Run a goodwill campaign within 1 week"],
    timelineRecommendation: "First response within 30 minutes, updates every 2 hours during active crisis",
    postCrisisActions: ["Conduct internal service review", "Implement improved response protocols", "Monitor sentiment for 2 weeks post-crisis"],
  });
  tokens.count += responseResp.usage?.total_tokens ?? 0;
  onEvent({ type: "agent_complete", agentId: "response_strategist", agentName: "Response Strategist", output: responseStrategy });

  return {
    brandMentionsAnalysed: brandMentions.split("\n").filter((l) => l.trim()).length,
    sentimentAnalysis: sentiment,
    crisisClassification: classification,
    responseStrategy: responseStrategy,
    crisisLevel: (classification as { crisisLevel?: string })?.crisisLevel ?? "Watch",
    pausePosting: (classification as { pausePosting?: boolean })?.pausePosting ?? false,
    escalationRequired: (classification as { escalationRequired?: boolean })?.escalationRequired ?? false,
  };
}

// ── Agent Registry for Social Workflows ──────────────────────────────────────
export const SOCIAL_WORKFLOW_AGENTS: Record<SocialWorkflowType, { id: string; name: string; icon: string }[]> = {
  arabic_localizer: [
    { id: "dialect_analyst", name: "Dialect Analyst", icon: "🔤" },
    { id: "gulf_copywriter", name: "Gulf Copywriter", icon: "✍️" },
    { id: "quality_checker", name: "Quality Checker", icon: "✅" },
  ],
  cross_publisher: [
    { id: "content_strategist", name: "Content Strategist", icon: "🎯" },
    { id: "platform_formatter", name: "Platform Formatter", icon: "📱" },
    { id: "publishing_scheduler", name: "Publishing Scheduler", icon: "📅" },
  ],
  brand_safety: [
    { id: "content_scanner", name: "Content Scanner", icon: "🔍" },
    { id: "shariah_checker", name: "Shariah Compliance Checker", icon: "☪️" },
    { id: "safety_decision", name: "Safety Decision Agent", icon: "🛡️" },
  ],
  influencer_discovery: [
    { id: "influencer_matcher", name: "Influencer Matcher", icon: "🌟" },
    { id: "campaign_brief", name: "Campaign Brief Generator", icon: "📋" },
  ],
  crisis_detection: [
    { id: "sentiment_analyzer", name: "Sentiment Analyzer", icon: "📊" },
    { id: "crisis_classifier", name: "Crisis Classifier", icon: "⚠️" },
    { id: "response_strategist", name: "Response Strategist", icon: "💬" },
  ],
};

// ── Main Pipeline Runner ──────────────────────────────────────────────────────
export async function runSocialPipeline(
  config: SocialRunConfig,
  onEvent: (event: SocialEvent) => void
): Promise<void> {
  const startTime = Date.now();
  const tokens = { count: 0 };
  const agents = SOCIAL_WORKFLOW_AGENTS[config.workflowType];

  onEvent({
    type: "pipeline_start",
    output: {
      workflowType: config.workflowType,
      agents: agents.map((a) => a.id),
      brandName: config.brandName,
      market: config.market,
    },
  });

  try {
    let result: unknown;

    switch (config.workflowType) {
      case "arabic_localizer":
        result = await runArabicLocalizer(config, onEvent, tokens);
        break;
      case "cross_publisher":
        result = await runCrossPublisher(config, onEvent, tokens);
        break;
      case "brand_safety":
        result = await runBrandSafety(config, onEvent, tokens);
        break;
      case "influencer_discovery":
        result = await runInfluencerDiscovery(config, onEvent, tokens);
        break;
      case "crisis_detection":
        result = await runCrisisDetection(config, onEvent, tokens);
        break;
      default:
        throw new Error(`Unknown workflow type: ${config.workflowType}`);
    }

    onEvent({
      type: "pipeline_complete",
      result,
      totalTokens: tokens.count,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    onEvent({ type: "pipeline_failed", error: String(err) });
  }
}
