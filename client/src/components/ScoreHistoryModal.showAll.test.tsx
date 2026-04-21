/**
 * ScoreHistoryModal.showAll.test.tsx
 *
 * Tests for the showAll toggle logic in ScoreHistoryModal.
 * Uses @testing-library/react + jsdom — no tRPC mocking needed.
 *
 * Test cases:
 *   1. Renders only 10 rows by default when total > 10
 *   2. "Show all N entries" button is visible when total > 10
 *   3. Clicking "Show all" renders all rows
 *   4. Clicking "Show fewer" collapses back to 10 rows
 *   5. No toggle button when total <= 10
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoreHistoryModal } from "./ScoreHistoryModal";
import type { ScoreHistoryRow } from "./ScoreHistoryModal";
import React, { useState } from "react";

/** Build N synthetic ScoreHistoryRow objects (ASC order) */
function makeRows(n: number): ScoreHistoryRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    score: 50 + i,
    createdAt: new Date(2026, 0, i + 1),
    triggerType: null,
    source: "manual",
  }));
}

/** Wrapper that owns the showAllMap state (mirrors HistoryTab usage) */
function Wrapper({
  rows,
  dealId = 1,
  onClose = vi.fn(),
}: {
  rows: ScoreHistoryRow[];
  dealId?: number;
  onClose?: () => void;
}) {
  const [showAllMap, setShowAllMap] = useState<Record<number, boolean>>({});
  return (
    <ScoreHistoryModal
      rows={rows}
      dealName="Test Deal"
      dealId={dealId}
      onClose={onClose}
      showAllMap={showAllMap}
      setShowAllMap={setShowAllMap}
    />
  );
}

describe("ScoreHistoryModal — showAll toggle", () => {
  it("1. renders only 10 rows by default when total > 10", () => {
    render(<Wrapper rows={makeRows(15)} />);
    const rows = screen.getAllByTestId("score-history-row");
    expect(rows).toHaveLength(10);
  });

  it("2. shows 'Show all N entries' button when total > 10", () => {
    render(<Wrapper rows={makeRows(15)} />);
    const toggle = screen.getByTestId("score-history-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle.textContent).toBe("Show all 15 entries");
  });

  it("3. clicking 'Show all' renders all rows", () => {
    render(<Wrapper rows={makeRows(15)} />);
    fireEvent.click(screen.getByTestId("score-history-toggle"));
    const rows = screen.getAllByTestId("score-history-row");
    expect(rows).toHaveLength(15);
  });

  it("4. clicking 'Show fewer' collapses back to 10 rows", () => {
    render(<Wrapper rows={makeRows(15)} />);
    // Expand
    fireEvent.click(screen.getByTestId("score-history-toggle"));
    expect(screen.getAllByTestId("score-history-row")).toHaveLength(15);
    // Collapse
    fireEvent.click(screen.getByTestId("score-history-toggle"));
    expect(screen.getAllByTestId("score-history-row")).toHaveLength(10);
  });

  it("5. no toggle button when total <= 10", () => {
    render(<Wrapper rows={makeRows(10)} />);
    expect(screen.queryByTestId("score-history-toggle")).toBeNull();
  });
});
