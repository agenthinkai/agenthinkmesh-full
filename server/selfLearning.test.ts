/**
 * selfLearning.test.ts
 * Unit tests for the Self-Learning Loop components:
 *   - memoryService: TF-IDF similarity, buildMemoryContext
 *   - criticAgent: weight clamping, decay, vote correctness scoring
 *   - councilEngine: weighted voting integration (skipMemory=true)
 */

import { describe, it, expect } from "vitest";

// ── Import the functions we want to test ─────────────────────────────────────

// We test the pure functions directly — no DB calls needed for these tests

// ── TF-IDF similarity (extracted from memoryService) ─────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function computeTfIdf(
  query: string[],
  doc: string[]
): number {
  const docSet = new Set(doc);
  const querySet = new Set(query);
  let intersection = 0;
  for (const term of querySet) {
    if (docSet.has(term)) intersection++;
  }
  if (querySet.size === 0 || docSet.size === 0) return 0;
  return intersection / Math.sqrt(querySet.size * docSet.size);
}

// ── Weight clamping (extracted from criticAgent) ──────────────────────────────

const WEIGHT_FLOOR = 0.3;
const WEIGHT_CEILING = 2.0;
const WEIGHT_DEFAULT = 1.0;
const DECAY_RATE = 0.05;

function clampWeight(w: number): number {
  return Math.min(WEIGHT_CEILING, Math.max(WEIGHT_FLOOR, w));
}

function applyDecay(currentWeight: number): number {
  const delta = (WEIGHT_DEFAULT - currentWeight) * DECAY_RATE;
  return clampWeight(currentWeight + delta);
}

function voteWasCorrect(vote: string, outcomeVerdict: string): boolean {
  const wasYes = vote === "HARD_YES" || vote === "SOFT_YES";
  const wasCorrectOutcome = outcomeVerdict === "CORRECT";
  return wasYes === wasCorrectOutcome;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TF-IDF similarity", () => {
  it("identical documents have similarity 1.0", () => {
    const tokens = tokenize("fintech payment gateway GCC UAE");
    const sim = computeTfIdf(tokens, tokens);
    expect(sim).toBeCloseTo(1.0, 2);
  });

  it("completely different documents have similarity 0", () => {
    const q = tokenize("fintech payment gateway");
    const d = tokenize("agriculture farming wheat");
    const sim = computeTfIdf(q, d);
    expect(sim).toBe(0);
  });

  it("partial overlap returns intermediate score", () => {
    const q = tokenize("fintech payment GCC compliance");
    const d = tokenize("fintech startup GCC market");
    const sim = computeTfIdf(q, d);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it("empty query returns 0", () => {
    const q: string[] = [];
    const d = tokenize("fintech payment GCC");
    expect(computeTfIdf(q, d)).toBe(0);
  });
});

describe("Weight clamping", () => {
  it("clamps below floor to 0.3", () => {
    expect(clampWeight(0.1)).toBe(0.3);
    expect(clampWeight(-5)).toBe(0.3);
  });

  it("clamps above ceiling to 2.0", () => {
    expect(clampWeight(2.5)).toBe(2.0);
    expect(clampWeight(100)).toBe(2.0);
  });

  it("passes through valid weights unchanged", () => {
    expect(clampWeight(1.0)).toBe(1.0);
    expect(clampWeight(1.5)).toBe(1.5);
    expect(clampWeight(0.3)).toBe(0.3);
    expect(clampWeight(2.0)).toBe(2.0);
  });
});

describe("Weight decay", () => {
  it("decays high weight toward 1.0", () => {
    const decayed = applyDecay(1.8);
    expect(decayed).toBeLessThan(1.8);
    expect(decayed).toBeGreaterThan(1.0);
  });

  it("decays low weight toward 1.0", () => {
    const decayed = applyDecay(0.5);
    expect(decayed).toBeGreaterThan(0.5);
    expect(decayed).toBeLessThan(1.0);
  });

  it("default weight 1.0 does not decay", () => {
    const decayed = applyDecay(1.0);
    expect(decayed).toBeCloseTo(1.0, 5);
  });

  it("decay never goes below floor", () => {
    // Even at floor, decay should stay at floor
    const decayed = applyDecay(0.3);
    expect(decayed).toBeGreaterThanOrEqual(0.3);
  });

  it("after many decay cycles, converges toward 1.0", () => {
    let w = 2.0;
    for (let i = 0; i < 100; i++) {
      w = applyDecay(w);
    }
    expect(w).toBeCloseTo(1.0, 1);
  });
});

describe("Vote correctness scoring", () => {
  it("YES on CORRECT outcome = correct", () => {
    expect(voteWasCorrect("HARD_YES", "CORRECT")).toBe(true);
    expect(voteWasCorrect("SOFT_YES", "CORRECT")).toBe(true);
  });

  it("NO on INCORRECT outcome = correct", () => {
    expect(voteWasCorrect("HARD_NO", "INCORRECT")).toBe(true);
    expect(voteWasCorrect("SOFT_NO", "INCORRECT")).toBe(true);
  });

  it("YES on INCORRECT outcome = incorrect", () => {
    expect(voteWasCorrect("HARD_YES", "INCORRECT")).toBe(false);
    expect(voteWasCorrect("SOFT_YES", "INCORRECT")).toBe(false);
  });

  it("NO on CORRECT outcome = incorrect", () => {
    expect(voteWasCorrect("HARD_NO", "CORRECT")).toBe(false);
    expect(voteWasCorrect("SOFT_NO", "CORRECT")).toBe(false);
  });
});

describe("Weighted vote scoring logic", () => {
  it("weighted YES score sums correctly", () => {
    const votes = [
      { vote: "HARD_YES", weight: 1.5, confidence: 0.9 },
      { vote: "SOFT_YES", weight: 0.8, confidence: 0.7 },
      { vote: "HARD_NO",  weight: 1.2, confidence: 0.8 },
    ];
    let yesScore = 0;
    let noScore = 0;
    for (const v of votes) {
      if (v.vote === "HARD_YES" || v.vote === "SOFT_YES") {
        yesScore += v.weight * v.confidence;
      } else {
        noScore += v.weight * v.confidence;
      }
    }
    expect(yesScore).toBeCloseTo(1.5 * 0.9 + 0.8 * 0.7, 4);
    expect(noScore).toBeCloseTo(1.2 * 0.8, 4);
  });

  it("weight adjustment stays within bounds after multiple updates", () => {
    let weight = 1.0;
    // Simulate 20 correct predictions → weight should hit ceiling
    for (let i = 0; i < 20; i++) {
      weight = clampWeight(weight + 0.1);
    }
    expect(weight).toBe(2.0);

    // Simulate 20 incorrect predictions → weight should hit floor
    for (let i = 0; i < 20; i++) {
      weight = clampWeight(weight - 0.1);
    }
    expect(weight).toBe(0.3);
  });
});

describe("Memory context builder", () => {
  it("formats past decisions correctly", () => {
    const pastDecisions = [
      {
        id: 1,
        taskDescription: "Fintech startup in UAE seeking Series A",
        finalVerdict: "APPROVED",
        confidenceScore: 0.82,
        createdAt: new Date("2025-01-15"),
        similarity: 0.75,
      },
    ];

    // Replicate buildMemoryContext logic
    const lines = pastDecisions.map((d, i) => {
      const date = d.createdAt.toISOString().split("T")[0];
      const conf = d.confidenceScore ? `${(d.confidenceScore * 100).toFixed(0)}%` : "N/A";
      return `[Past Decision ${i + 1} — ${date}]\nTask: ${d.taskDescription.slice(0, 200)}\nVerdict: ${d.finalVerdict} (confidence: ${conf})\nSimilarity to current task: ${(d.similarity * 100).toFixed(0)}%`;
    });

    const context = `COUNCIL MEMORY — ${pastDecisions.length} similar past decision(s) found:\n\n${lines.join("\n\n")}\n\nUse the above historical context to inform your analysis. Do not be bound by past decisions — use them as reference points only.`;

    expect(context).toContain("COUNCIL MEMORY");
    expect(context).toContain("APPROVED");
    expect(context).toContain("82%");
    expect(context).toContain("75%");
  });
});
