/**
 * ScoreHistoryModal — standalone modal component for score history.
 *
 * Extracted from HistoryTab so it can be:
 *   1. Mounted in isolation by Vitest + RTL tests (no tRPC mocking needed)
 *   2. Used with a focus trap (Task 2) without coupling to HistoryTab state
 *
 * Props:
 *   rows      — ScoreHistoryRow[] already fetched by the parent (ASC order)
 *   dealName  — human-readable deal name for the modal title / CSV filename
 *   dealId    — numeric deal ID used as CSV filename fallback
 *   onClose   — callback to close the modal
 *   showAllMap / setShowAllMap — Task 3: persist showAll per dealId across open/close
 */
import React, { useState, useEffect, useRef } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { sanitiseSlug } from "@/lib/csvFilename";

export interface ScoreHistoryRow {
  id: number;
  score: number;
  createdAt: Date;
  triggerType: string | null;
  source: string | null;
}

interface ScoreHistoryModalProps {
  rows: ScoreHistoryRow[];
  dealName: string;
  dealId: number;
  onClose: () => void;
  /** Task 3: per-deal showAll map so preference persists across open/close */
  showAllMap: Record<number, boolean>;
  setShowAllMap: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.45)";
const TEXT2 = "rgba(255,255,255,0.7)";

const TRIGGER_LABELS: Record<string, string> = {
  stale_diligence: "Stale in diligence",
  stale_ic_ready: "Stale at IC ready",
  score_drop: "Score drop",
  pattern_shift: "Pattern shift",
  signal_triggered: "External signal",
};

const VISIBLE_CAP = 10;

export function ScoreHistoryModal({
  rows,
  dealName,
  dealId,
  onClose,
  showAllMap,
  setShowAllMap,
}: ScoreHistoryModalProps) {
  const showAll = showAllMap[dealId] ?? false;
  const toggleShowAll = () =>
    setShowAllMap((prev) => ({ ...prev, [dealId]: !showAll }));

  const [focusedBadgeKey, setFocusedBadgeKey] = useState<string | null>(null);

  // ── Task 2: focus trap ──────────────────────────────────────────────────────
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move focus to the ✕ close button when modal opens
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (!modalRef.current) return;

      // Esc closes the modal
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Tab / Shift+Tab: cycle within modal
      if (e.key === "Tab") {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));

        if (focusable.length === 0) { e.preventDefault(); return; }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const allRows2 = rows;
  const totalRows = allRows2.length;
  const rows2 =
    showAll || totalRows <= VISIBLE_CAP
      ? allRows2
      : allRows2.slice(totalRows - VISIBLE_CAP);

  const allScores = allRows2.map((r) => r.score);
  const scores = rows2.map((r) => r.score);

  const W = 320, H = 60;
  const minS = Math.min(...allScores);
  const maxS = Math.max(...allScores);
  const range2 = maxS - minS || 1;
  const pts2 = allScores
    .map((s, i) => {
      const x = (i / (allScores.length - 1)) * (W - 8) + 4;
      const y = H - 4 - ((s - minS) / range2) * (H - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const first2 = allScores[0];
  const last2 = allScores[allScores.length - 1];
  const diff2 = last2 - first2;
  const lineColor2 = diff2 > 3 ? "#22c55e" : diff2 < -3 ? "#ef4444" : "#6b7280";

  const deltas: (number | null)[] = scores.map((s, i) =>
    i === 0 ? null : s - scores[i - 1]
  );

  let maxDeltaIdx = -1;
  let maxDeltaAbs = 0;
  deltas.forEach((d, i) => {
    if (d !== null && Math.abs(d) > maxDeltaAbs) {
      maxDeltaAbs = Math.abs(d);
      maxDeltaIdx = i;
    }
  });

  // ── CSV export ──────────────────────────────────────────────────────────────
  function handleExportCsv() {
    const slug = sanitiseSlug(dealName.slice(0, 40).trim(), dealId);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `score-history-${slug}-${today}.csv`;
    const TRIGGER_LABELS_CSV: Record<string, string> = {
      stale_diligence: "Stale in diligence",
      stale_ic_ready: "Stale at IC ready",
      score_drop: "Score drop",
      pattern_shift: "Pattern shift",
      signal_triggered: "External signal",
    };
    const scores3 = allRows2.map((r) => r.score);
    const lines = ["Date,Score,Delta,Trigger,Source"];
    allRows2.forEach((r, i) => {
      const d = i === 0 ? null : scores3[i] - scores3[i - 1];
      const deltaStr =
        d === null
          ? ""
          : Math.abs(d) <= 3
          ? "flat"
          : d > 0
          ? `+${d}`
          : `\u2212${Math.abs(d)}`;
      const dateStr = new Date(r.createdAt).toLocaleDateString("en-GB", {
        timeZone: "Asia/Kuwait",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const trigger = r.triggerType
        ? (TRIGGER_LABELS_CSV[r.triggerType] ?? r.triggerType)
        : "Manual";
      const source = r.source === "auto" ? "Auto" : "Manual";
      lines.push(`${dateStr},${r.score},${deltaStr},${trigger},${source}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    /* Backdrop */
    <div
      data-testid="score-history-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        ref={modalRef}
        data-testid="score-history-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Score History"
        style={{
          background: "#1a1a2e",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: "24px 28px",
          minWidth: 340,
          maxWidth: 480,
          width: "90vw",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <span
            style={{ fontSize: 13, fontWeight: 700, color: TEXT2, letterSpacing: 0.5 }}
          >
            Score History
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {rows.length > 0 && (
              <button
                onClick={handleExportCsv}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                  cursor: "pointer",
                  fontSize: 10,
                  borderRadius: 5,
                  padding: "2px 8px",
                  lineHeight: 1.6,
                  letterSpacing: 0.3,
                }}
              >
                ↓ CSV
              </button>
            )}
            <button
              data-testid="score-history-close"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: MUTED,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Sparkline */}
        {allScores.length > 1 && (
          <svg
            width={W}
            height={H}
            style={{ display: "block", marginBottom: 16 }}
          >
            <polyline
              points={pts2}
              fill="none"
              stroke={lineColor2}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {scores.map((s, i) => {
              const x = (i / (scores.length - 1)) * (W - 8) + 4;
              const y = H - 4 - ((s - minS) / range2) * (H - 8);
              return <circle key={i} cx={x} cy={y} r={3} fill={lineColor2} />;
            })}
          </svg>
        )}

        {/* Row list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows2.map((r, i) => {
            const delta = deltas[i];
            const isFlat = delta !== null && Math.abs(delta) <= 3;
            const isUp = delta !== null && delta > 3;
            const isDown = delta !== null && delta < -3;
            const isHighlight = i === maxDeltaIdx && maxDeltaAbs > 3;
            const rowBg = isHighlight
              ? isUp
                ? "rgba(34,197,94,0.05)"
                : "rgba(239,68,68,0.05)"
              : "transparent";

            return (
              <div
                key={r.id}
                data-testid="score-history-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 12,
                  background: rowBg,
                  borderRadius: 6,
                  padding: "2px 4px",
                  marginLeft: -4,
                  marginRight: -4,
                }}
              >
                <span style={{ color: MUTED, minWidth: 80, flexShrink: 0 }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    color:
                      r.score >= 62
                        ? "#22c55e"
                        : r.score >= 38
                        ? "#f59e0b"
                        : "#ef4444",
                    minWidth: 28,
                  }}
                >
                  {r.score}
                </span>

                {delta === null && (
                  <span style={{ fontSize: 10, color: MUTED, minWidth: 60 }}>—</span>
                )}

                {isFlat && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        style={{
                          display: "contents",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "default",
                        }}
                        aria-label={`Score change: flat. Previous score ${rows2[i - 1].score}`}
                        onFocus={() => setFocusedBadgeKey(`${r.id}-flat`)}
                        onBlur={() => setFocusedBadgeKey(null)}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: MUTED,
                            minWidth: 60,
                            borderRadius: 3,
                            ...(focusedBadgeKey === `${r.id}-flat`
                              ? { outline: "2px solid rgba(124,58,237,0.6)", outlineOffset: 2 }
                              : {}),
                          }}
                        >
                          → flat
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      Previous score: {rows2[i - 1].score} (date:{" "}
                      {new Date(rows2[i - 1].createdAt).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Kuwait",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      )
                    </TooltipContent>
                  </Tooltip>
                )}

                {isUp && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        style={{
                          display: "contents",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "default",
                        }}
                        aria-label={`Score change: +${delta} points. Previous score ${rows2[i - 1].score}`}
                        onFocus={() => setFocusedBadgeKey(`${r.id}-up`)}
                        onBlur={() => setFocusedBadgeKey(null)}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "#22c55e",
                            fontWeight: 600,
                            minWidth: 60,
                            borderRadius: 3,
                            ...(focusedBadgeKey === `${r.id}-up`
                              ? { outline: "2px solid rgba(124,58,237,0.6)", outlineOffset: 2 }
                              : {}),
                          }}
                        >
                          ↑ +{delta} pts
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      Previous score: {rows2[i - 1].score} (date:{" "}
                      {new Date(rows2[i - 1].createdAt).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Kuwait",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      )
                    </TooltipContent>
                  </Tooltip>
                )}

                {isDown && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        style={{
                          display: "contents",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "default",
                        }}
                        aria-label={`Score change: ${delta} points. Previous score ${rows2[i - 1].score}`}
                        onFocus={() => setFocusedBadgeKey(`${r.id}-down`)}
                        onBlur={() => setFocusedBadgeKey(null)}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "#ef4444",
                            fontWeight: 600,
                            minWidth: 60,
                            borderRadius: 3,
                            ...(focusedBadgeKey === `${r.id}-down`
                              ? { outline: "2px solid rgba(124,58,237,0.6)", outlineOffset: 2 }
                              : {}),
                          }}
                        >
                          ↓ {delta} pts
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      Previous score: {rows2[i - 1].score} (date:{" "}
                      {new Date(rows2[i - 1].createdAt).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Kuwait",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      )
                    </TooltipContent>
                  </Tooltip>
                )}

                {r.source === "auto" && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color:
                        r.triggerType === "signal_triggered" ? "#60a5fa" : "#f59e0b",
                      background:
                        r.triggerType === "signal_triggered"
                          ? "rgba(96,165,250,0.12)"
                          : "rgba(245,158,11,0.12)",
                      borderRadius: 4,
                      padding: "1px 6px",
                    }}
                  >
                    {r.triggerType === "signal_triggered"
                      ? "📡 Signal"
                      : `⚡ ${TRIGGER_LABELS[r.triggerType ?? ""] ?? "Auto"}`}
                  </span>
                )}

                {i === rows2.length - 1 && (
                  <span style={{ fontSize: 10, color: MUTED, marginLeft: "auto" }}>
                    latest
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Show all / Show fewer toggle */}
        {totalRows > VISIBLE_CAP && (
          <button
            data-testid="score-history-toggle"
            type="button"
            onClick={toggleShowAll}
            style={{
              marginTop: 6,
              background: "none",
              border: "none",
              color: MUTED,
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
              alignSelf: "flex-start",
            }}
          >
            {showAll ? "Show fewer" : `Show all ${totalRows} entries`}
          </button>
        )}
      </div>
    </div>
  );
}
