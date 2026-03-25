import React from "react";

interface StackItem {
  vendor?: string;
  value?: string;
  category: string;
  decision?: string;
  evidence?: string;
  confidence?: string;
}

interface TechStackCardProps {
  techStack: StackItem[];
  buildBuyStance?: { stance?: string; rationale?: string } | string;
  animDelay?: number;
}

export function TechStackCard({ techStack, buildBuyStance, animDelay = 0.15 }: TechStackCardProps) {
  if (!techStack?.length) return null;
  const stanceText = typeof buildBuyStance === "string"
    ? buildBuyStance
    : buildBuyStance?.rationale ?? buildBuyStance?.stance ?? null;

  return (
    <div className="intel-card" style={{ animationDelay: `${animDelay}s` }}>
      <div className="intel-card-head">
        <div className="intel-card-icon ci-blue">⬡</div>
        <div className="intel-card-title">Tech Stack &amp; Build/Buy</div>
      </div>
      <div className="intel-card-body">
        {stanceText && <div className="intel-stance-text">{stanceText}</div>}
        {techStack.map((s, i) => {
          const val = s.vendor ?? s.value ?? "—";
          const decision = (s.decision ?? "hybrid").toLowerCase();
          const badgeCls = decision === "buy" ? "sb-buy" : decision === "build" ? "sb-build" : "sb-hybrid";
          return (
            <div key={i} className="intel-stack-row">
              <div className="intel-stack-cat">{s.category}</div>
              <div className="intel-stack-val">{val}</div>
              <div className={`intel-stack-badge ${badgeCls}`}>{decision}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
