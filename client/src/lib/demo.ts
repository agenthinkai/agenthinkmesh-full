// AgenThinkMesh — Demo Mode utilities and synthetic GCC data
// All data is synthetic and for demonstration purposes only.

export const DEMO_USER = {
  id: 'demo-guest',
  name: 'Khalid Al Rashidi',
  email: 'demo@agenthink.ai',
  role: 'Portfolio Manager',
  company: 'Gulf Capital Advisors',
  isDemo: true,
}

export const DEMO_DEAL_SCREENER_DATA = [
  {
    id: 'ds-001',
    company: 'Al Nakheel Logistics Group',
    sector: 'Logistics',
    geography: 'Kuwait',
    dealType: 'PE Buyout',
    revenue: 8400000,
    ebitda: 1680000,
    ebitdaMargin: 20,
    askingMultiple: 7.5,
    impliedEV: 12600000,
    currency: 'KWD',
    icRecommendation: 'Proceed to due diligence',
    confidenceScore: 82,
    keyRisk: 'Customer concentration: top 3 clients represent 41% of revenue',
    analystName: 'Faisal Al Mutairi',
    date: '2023-03-14',
  },
  {
    id: 'ds-002',
    company: 'Rawabi Medical Centers',
    sector: 'Healthcare',
    geography: 'KSA',
    dealType: 'Growth Equity',
    revenue: 62000000,
    ebitda: 11160000,
    ebitdaMargin: 18,
    askingMultiple: 9.2,
    impliedEV: 102720000,
    currency: 'SAR',
    icRecommendation: 'Proceed to due diligence',
    confidenceScore: 78,
    keyRisk: 'NHIF reimbursement rate risk: 38% of revenue is NHIF-linked',
    analystName: 'Noura Al Qahtani',
    date: '2023-07-22',
  },
  {
    id: 'ds-003',
    company: 'Gulf Star Food Industries',
    sector: 'F&B',
    geography: 'UAE',
    dealType: 'Co-investment',
    revenue: 94000000,
    ebitda: 16920000,
    ebitdaMargin: 18,
    askingMultiple: 10.9,
    impliedEV: 185000000,
    currency: 'AED',
    icRecommendation: 'Hold',
    confidenceScore: 65,
    keyRisk: 'Seasonal concentration: 34% of revenue in Ramadan and Eid periods',
    analystName: 'Khalid Al Mansoori',
    date: '2022-11-03',
  },
  {
    id: 'ds-004',
    company: 'Murooj Technology Solutions',
    sector: 'Tech',
    geography: 'Kuwait',
    dealType: 'Growth Equity',
    revenue: 4200000,
    ebitda: 756000,
    ebitdaMargin: 18,
    askingMultiple: 8.0,
    impliedEV: 6048000,
    currency: 'KWD',
    icRecommendation: 'Proceed to due diligence',
    confidenceScore: 74,
    keyRisk: 'Government payment cycles average 190 days — persistent working capital deficit',
    analystName: 'Ahmad Al Shammari',
    date: '2024-02-08',
  },
  {
    id: 'ds-005',
    company: 'Barr Al Aman Real Estate Development',
    sector: 'Real Estate',
    geography: 'KSA',
    dealType: 'PE Buyout',
    revenue: 118000000,
    ebitda: 23600000,
    ebitdaMargin: 20,
    askingMultiple: 8.5,
    impliedEV: 200600000,
    currency: 'SAR',
    icRecommendation: 'Proceed to due diligence',
    confidenceScore: 80,
    keyRisk: 'Jeddah municipality zoning amendments delayed 2 projects totalling SAR 38M in revenue',
    analystName: 'Turki Al Zahrani',
    date: '2023-09-18',
  },
]

export const DEMO_MVNO_DATA = [
  {
    id: 'mv-001',
    mvnoName: 'Wajd Mobile',
    hostMno: 'Zain Kuwait',
    market: 'Kuwait',
    segment: 'Youth',
    subscribers: 85000,
    arpu: 18,
    churnMonthlyPct: 3.8,
    differentiator: 'Arabic UX',
    regulatoryStatus: 'Licensed',
    sentimentScore: 78,
    opportunitySignal:
      'Kuwait youth TikTok daily usage 68% — zero-rating partnership would accelerate acquisition at below-market CAC.',
    riskFlag:
      'Zain host agreement renewal due Q3 2025 — wholesale tariff renegotiation risk.',
  },
  {
    id: 'mv-002',
    mvnoName: 'Nakhla Telecom',
    hostMno: 'STC',
    market: 'KSA',
    segment: 'Expat Workers',
    subscribers: 320000,
    arpu: 12,
    churnMonthlyPct: 5.2,
    differentiator: 'Price',
    regulatoryStatus: 'Licensed',
    sentimentScore: 62,
    opportunitySignal:
      'South Asian expat remittance behavior creates demand for integrated mobile money bundles — ARPU uplift of USD 4 per subscriber.',
    riskFlag:
      'High churn structurally driven by expat visa cycle — subscriber base turns over every 19 months.',
  },
  {
    id: 'mv-003',
    mvnoName: 'Majd Mobile',
    hostMno: 'du',
    market: 'UAE',
    segment: 'Youth',
    subscribers: 95000,
    arpu: 22,
    churnMonthlyPct: 3.2,
    differentiator: 'Data Bundles',
    regulatoryStatus: 'Licensed',
    sentimentScore: 84,
    opportunitySignal:
      'Dubai youth gaming community underserved — dedicated low-latency gaming SIM at AED 99/month could capture 15,000 incremental subscribers.',
    riskFlag:
      'du network sharing limits Majd to 4G LTE only — growing competitive disadvantage as UAE 5G penetration exceeds 40%.',
  },
]

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.location.search.includes('demo=true') ||
    sessionStorage.getItem('agenthink_demo') === 'true'
  )
}

export function activateDemo(): void {
  sessionStorage.setItem('agenthink_demo', 'true')
  window.location.href = '/forecast?demo=true'
}

export function deactivateDemo(): void {
  sessionStorage.removeItem('agenthink_demo')
  window.location.href = '/'
}
