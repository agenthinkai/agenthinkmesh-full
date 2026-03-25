import React from "react";

interface Gap {
  domain?: string;
  priority?: string;
  suggestion?: string;
  // plain string fallback
  text?: string;
}

interface CoverageGapsCardProps {
  gaps: (Gap | string)[];
  animDelay?: number;
}

export function CoverageGapsCard({ gaps, animDelay = 0.25 }: CoverageGapsCardProps) {
  if (!gaps?.length) return null;
  return (
    <div className="intel-card" style={{ animationDelay: `${animDelay}s` }}>
      <div className="intel-card-head">
        <div className="intel-card-icon ci-red">△</div>
        <div className="intel-card-title">AgenThinkMesh Coverage Gaps</div>
        <div className="intel-card-count">{gaps.length} flagged</div>
      </div>
      <div className="intel-card-body">
        {gaps.map((g, i) => {
          if (typeof g === "string") {
            return (
              <div key={i} className="intel-gap-item gap-medium">
                <div className="intel-gap-content">
                  <div className="intel-gap-name">{g}</div>
                </div>
                <span className="intel-gap-pri gp-medium">MEDIUM</span>
              </div>
            );
          }
          const priority = (g.priority ?? "medium").toLowerCase();
          const priCls = priority === "high" ? "gp-high" : priority === "low" ? "gp-low" : "gp-medium";
          const gapCls = priority === "high" ? "gap-high" : priority === "low" ? "gap-low" : "gap-medium";
          return (
            <div key={i} className={`intel-gap-item ${gapCls}`}>
              <div className="intel-gap-content">
                <div className="intel-gap-name">{g.domain ?? g.text ?? "Gap"}</div>
                {g.suggestion && <div className="intel-gap-suggest">{g.suggestion}</div>}
              </div>
              <span className={`intel-gap-pri ${priCls}`}>{priority.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
