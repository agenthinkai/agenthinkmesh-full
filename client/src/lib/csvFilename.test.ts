import { describe, it, expect } from "vitest";
import { sanitiseSlug } from "./csvFilename";

describe("sanitiseSlug", () => {
  it("1. Normal ASCII name — 'Acme Corp' → 'Acme-Corp'", () => {
    expect(sanitiseSlug("Acme Corp", 99)).toBe("Acme-Corp");
  });

  it("2. All-Arabic name — returns 'deal-{fallbackId}'", () => {
    expect(sanitiseSlug("شركة الاستثمار", 42)).toBe("deal-42");
  });

  it("3. All-emoji name — returns 'deal-{fallbackId}'", () => {
    expect(sanitiseSlug("🚀🌟💡", 7)).toBe("deal-7");
  });

  it("4. Leading/trailing dashes — '-Acme-' → 'Acme'", () => {
    expect(sanitiseSlug("-Acme-", 1)).toBe("Acme");
  });

  it("5. Consecutive spaces/dashes — 'Acme  Corp' → 'Acme-Corp'", () => {
    expect(sanitiseSlug("Acme  Corp", 5)).toBe("Acme-Corp");
  });

  it("6. Mixed Arabic + ASCII — ASCII parts preserved, Arabic stripped, no leading/trailing dashes", () => {
    // "شركة Acme للاستثمار" → Arabic chars become hyphens, collapse → "Acme"
    expect(sanitiseSlug("شركة Acme للاستثمار", 3)).toBe("Acme");
  });
});
