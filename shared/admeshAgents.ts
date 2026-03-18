// ─── AdMesh Agent Registry ────────────────────────────────────────────────────
// 6-agent creative intelligence pipeline for GCC enterprise marketing teams.
// Wave 1 (parallel): Ingestor + Analyzer + Strategist
// Wave 2 (sequential): Copywriter → Scoring → VideoProducer → Performance

export interface AdmeshAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  wave: 1 | 2;
  waveOrder?: number; // position within wave 2
  color: string;
  icon: string;
}

export const ADMESH_AGENTS: AdmeshAgent[] = [
  // ── Wave 1: Parallel ──────────────────────────────────────────────────────
  {
    id: "ingestor",
    name: "Ingestor",
    role: "Competitive Intelligence Loader",
    description: "Loads and structures competitor ad data from mock library or live Meta API. Normalises hooks, CTAs, offers, formats, and spend signals.",
    wave: 1,
    color: "#60A5FA",
    icon: "📥",
  },
  {
    id: "analyzer",
    name: "Analyzer",
    role: "Ad Pattern Extractor",
    description: "Extracts winning patterns: hook formulas, CTA structures, audience signals, emotional triggers, and offer mechanics from competitor ads.",
    wave: 1,
    color: "#34D399",
    icon: "🔍",
  },
  {
    id: "strategist",
    name: "Strategist",
    role: "Creative Strategy Engine",
    description: "Identifies market gaps, defines the winning creative angle, produces a 3–5 bullet strategy brief, and flags what to avoid.",
    wave: 1,
    color: "#A78BFA",
    icon: "🎯",
  },
  // ── Wave 2: Sequential ────────────────────────────────────────────────────
  {
    id: "copywriter",
    name: "Copywriter",
    role: "Multilingual Ad Generator",
    description: "Generates 10 ads (5 English + 5 Arabic Gulf dialect). Each ad includes hook, body copy, CTA, visual direction, and target audience.",
    wave: 2,
    waveOrder: 1,
    color: "#F59E0B",
    icon: "✍️",
  },
  {
    id: "scoring",
    name: "Scoring",
    role: "Ad Performance Predictor",
    description: "Scores each ad on hook strength, clarity, brand fit, local relevance, and CTR potential. Selects top 2 ads for video production.",
    wave: 2,
    waveOrder: 2,
    color: "#EC4899",
    icon: "📊",
  },
  {
    id: "video",
    name: "VideoProducer",
    role: "Storyboard & Video Director",
    description: "Produces storyboards (scenes, voiceover script, visual direction, text overlays) for the top 2 ads. Optionally generates via HeyGen in Live Mode.",
    wave: 2,
    waveOrder: 3,
    color: "#F97316",
    icon: "🎬",
  },
  {
    id: "performance",
    name: "Performance",
    role: "Campaign Intelligence Analyst",
    description: "Analyses CTR/ROAS/CPM inputs against GCC benchmarks and outputs actionable next-step recommendations for media buyers.",
    wave: 2,
    waveOrder: 4,
    color: "#14B8A6",
    icon: "📈",
  },
];

export const ADMESH_AGENT_MAP = Object.fromEntries(
  ADMESH_AGENTS.map((a) => [a.id, a])
);

// ── Brand Voice Presets ───────────────────────────────────────────────────────
export interface BrandVoicePreset {
  id: string;
  label: string;
  description: string;
  tone: string;
  emoji: string;
}

export const BRAND_VOICE_PRESETS: BrandVoicePreset[] = [
  {
    id: "premium",
    label: "Premium / Luxury",
    description: "Aspirational, refined, exclusive. Speaks to quality and status.",
    tone: "sophisticated, aspirational, confident, exclusive",
    emoji: "💎",
  },
  {
    id: "value",
    label: "Value / Deals",
    description: "Direct, urgent, price-led. Drives action with offers and savings.",
    tone: "urgent, direct, deal-focused, savings-driven",
    emoji: "🔥",
  },
  {
    id: "family",
    label: "Family",
    description: "Warm, trusted, inclusive. Speaks to family values and shared moments.",
    tone: "warm, trustworthy, inclusive, family-oriented",
    emoji: "👨‍👩‍👧‍👦",
  },
  {
    id: "youth",
    label: "Youth / Gen-Z",
    description: "Bold, energetic, culturally fluent. Speaks the language of young GCC consumers.",
    tone: "bold, energetic, trendy, culturally-aware, youthful",
    emoji: "⚡",
  },
  {
    id: "b2b",
    label: "B2B Enterprise",
    description: "Professional, ROI-focused, credibility-led. Speaks to decision makers.",
    tone: "professional, ROI-focused, credible, data-driven",
    emoji: "🏢",
  },
];

// ── X-cite Demo Data ──────────────────────────────────────────────────────────
export interface MockCompetitorAd {
  brand: string;
  headline: string;
  body: string;
  cta: string;
  format: string;
  hook: string;
  offer: string;
  audience: string;
  estimatedSpend: string;
}

export const XCITE_DEMO_CONFIG = {
  brandName: "X-cite",
  brandVoice: "value",
  category: "Consumer Electronics",
  market: "Kuwait",
  competitors: ["Eureka", "Sharaf DG", "iStyle"],
  languages: "en,ar",
};

export const XCITE_MOCK_COMPETITOR_ADS: MockCompetitorAd[] = [
  // Eureka
  {
    brand: "Eureka",
    headline: "Ramadan Mega Sale — Up to 50% Off",
    body: "Shop the biggest electronics deals of the year. Samsung, Apple, Sony and more. Free delivery across Kuwait.",
    cta: "Shop Now",
    format: "Carousel",
    hook: "Ramadan Mega Sale — Up to 50% Off",
    offer: "50% discount + free delivery",
    audience: "Kuwait families, 25–45, household decision makers",
    estimatedSpend: "KWD 8,000–12,000/month",
  },
  {
    brand: "Eureka",
    headline: "New iPhone 15 Pro — Available Now",
    body: "Be the first in Kuwait to own the iPhone 15 Pro. 0% installments over 12 months. Visit any Eureka branch.",
    cta: "Reserve Yours",
    format: "Single Image",
    hook: "New iPhone 15 Pro — Available Now",
    offer: "0% installments 12 months",
    audience: "Tech enthusiasts, 18–35, Apple loyalists",
    estimatedSpend: "KWD 5,000–8,000/month",
  },
  // Sharaf DG
  {
    brand: "Sharaf DG",
    headline: "DG Deal of the Day — Samsung Galaxy S24",
    body: "Today only: Samsung Galaxy S24 at KWD 189. While stocks last. Order online, collect in 2 hours.",
    cta: "Grab the Deal",
    format: "Story",
    hook: "Today only — 40% off Samsung Galaxy S24",
    offer: "Flash sale price KWD 189",
    audience: "Deal hunters, 20–40, Android users",
    estimatedSpend: "KWD 6,000–10,000/month",
  },
  {
    brand: "Sharaf DG",
    headline: "Back to School — Laptops from KWD 99",
    body: "Set your students up for success. Laptops, tablets, accessories. Easy installments available.",
    cta: "Shop Laptops",
    format: "Video",
    hook: "Back to school laptops from KWD 99",
    offer: "Starting price KWD 99 + installments",
    audience: "Parents, 30–50, back-to-school season",
    estimatedSpend: "KWD 4,000–7,000/month",
  },
  // iStyle
  {
    brand: "iStyle",
    headline: "Authorised Apple Reseller Kuwait",
    body: "The only place in Kuwait for the full Apple experience. AppleCare+, trade-in, and expert setup included.",
    cta: "Explore Apple",
    format: "Single Image",
    hook: "Kuwait's official Apple experience",
    offer: "AppleCare+ + trade-in + expert setup",
    audience: "Apple loyalists, 22–45, premium buyers",
    estimatedSpend: "KWD 3,000–5,000/month",
  },
  {
    brand: "iStyle",
    headline: "MacBook Pro M3 — Now in Kuwait",
    body: "The most powerful MacBook ever. Available exclusively at iStyle Kuwait. Book a demo today.",
    cta: "Book a Demo",
    format: "Video",
    hook: "MacBook Pro M3 — most powerful ever",
    offer: "Exclusive availability + free demo",
    audience: "Professionals, creatives, 25–45",
    estimatedSpend: "KWD 2,500–4,000/month",
  },
];

// ── GCC Benchmark Performance Data ───────────────────────────────────────────
export const GCC_BENCHMARKS = {
  electronics: {
    avgCTR: 1.8,        // %
    avgROAS: 3.2,       // x
    avgCPM: 12.5,       // USD
    avgCPC: 0.69,       // USD
    topPerformerCTR: 3.5,
    topPerformerROAS: 6.0,
  },
};
