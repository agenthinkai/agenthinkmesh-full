import { describe, expect, it } from "vitest";
import { comboKey, isPreviousRunEngageCandidate } from "./weeklyFleetDelta";

describe("weekly fleet delta combo keys", () => {
  it("uses the region as part of the ENGAGE shortlist identity", () => {
    expect(comboKey("Fintech", "Open Banking", "GCC"))
      .not.toBe(comboKey("Fintech", "Open Banking", "global emerging markets"));
  });

  it("preserves distinct non-Latin sub-sectors", () => {
    expect(comboKey("Fintech", "التمويل الإسلامي", "GCC"))
      .not.toBe(comboKey("Fintech", "المصرفية المفتوحة", "GCC"));
  });

  it("normalizes compatibility characters, punctuation, and spacing", () => {
    expect(comboKey("Ｆｉｎｔｅｃｈ", "Islamic-Finance & Banking", "ＧＣＣ"))
      .toBe(comboKey("fintech", "Islamic finance and banking", "gcc"));
  });
});

describe("current ENGAGE shortlist boundary", () => {
  it("accepts evaluations from the immediately preceding completed run", () => {
    expect(isPreviousRunEngageCandidate(41, 41)).toBe(true);
  });

  it("rejects older historical ENGAGE evaluations", () => {
    expect(isPreviousRunEngageCandidate(40, 41)).toBe(false);
  });
});
