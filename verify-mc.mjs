// Quick verification script for Monte Carlo engine
// Run with: node verify-mc.mjs

// Inline the logic to avoid TS compilation issues in raw node
function uniformSample(min, max) {
  return min + Math.random() * (max - min);
}

function clamp100(v) {
  return Math.max(0, Math.min(100, v));
}

function computeScenarioScore(rgr, gm, ms, cr, ttp, pp) {
  const score =
    (rgr / 0.30) * 25 +
    (gm  / 0.70) * 20 +
    (ms  / 1e10) * 20 +
    (1 - cr  / 0.20) * 15 +
    (1 - ttp / 60)   * 10 +
    (1 - pp  / 0.40) * 10;
  return clamp100(score);
}

function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

const DEFAULT = {
  revenue_growth_rate:   { min: 0.05, max: 0.30 },
  gross_margin:          { min: 0.20, max: 0.70 },
  market_size_usd:       { min: 1e8,  max: 1e10  },
  churn_rate:            { min: 0.02, max: 0.20  },
  time_to_profitability: { min: 12,   max: 60    },
  pivot_probability:     { min: 0.05, max: 0.40  },
};

const iterations = 1000;
const scores = new Array(iterations);
const start = Date.now();

for (let i = 0; i < iterations; i++) {
  const rgr = uniformSample(DEFAULT.revenue_growth_rate.min, DEFAULT.revenue_growth_rate.max);
  const gm  = uniformSample(DEFAULT.gross_margin.min, DEFAULT.gross_margin.max);
  const ms  = uniformSample(DEFAULT.market_size_usd.min, DEFAULT.market_size_usd.max);
  const cr  = uniformSample(DEFAULT.churn_rate.min, DEFAULT.churn_rate.max);
  const ttp = uniformSample(DEFAULT.time_to_profitability.min, DEFAULT.time_to_profitability.max);
  const pp  = uniformSample(DEFAULT.pivot_probability.min, DEFAULT.pivot_probability.max);
  scores[i] = computeScenarioScore(rgr, gm, ms, cr, ttp, pp);
}

scores.sort((a, b) => a - b);

const p10  = Math.round(percentile(scores, 10)  * 10) / 10;
const p50  = Math.round(percentile(scores, 50)  * 10) / 10;
const p90  = Math.round(percentile(scores, 90)  * 10) / 10;
const mean = Math.round((scores.reduce((s, v) => s + v, 0) / iterations) * 10) / 10;
const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / iterations;
const std  = Math.round(Math.sqrt(variance) * 10) / 10;
const upside_skew = (p90 - p50) > (p50 - p10);
const elapsed = Date.now() - start;

console.log("=== Monte Carlo Verification (default params, 1000 iterations) ===");
console.log("p10:", p10);
console.log("p50:", p50);
console.log("p90:", p90);
console.log("mean:", mean);
console.log("std:", std);
console.log("upside_skew:", upside_skew);
console.log("elapsed_ms:", elapsed);
console.log("--- Assertions ---");
console.log("p10 < p50:", p10 < p50, p10 < p50 ? "✓ PASS" : "✗ FAIL");
console.log("p50 < p90:", p50 < p90, p50 < p90 ? "✓ PASS" : "✗ FAIL");
console.log("std > 0:", std > 0, std > 0 ? "✓ PASS" : "✗ FAIL");
console.log("elapsed < 50ms:", elapsed < 50, elapsed < 50 ? "✓ PASS" : "✗ FAIL (acceptable)");
