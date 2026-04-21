// This file is imported by .tsx test files that run in the jsdom environment.
// @testing-library/jest-dom extends vitest's expect with DOM matchers.
import "@testing-library/jest-dom/vitest";

// jsdom does not implement ResizeObserver; Radix UI (Tooltip, Popover, etc.)
// calls it inside layout effects. Stub it so tests don't crash.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
