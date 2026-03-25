import React from "react";

interface UseCase {
  title?: string;
  name?: string;
  metric?: string;
  description: string;
  maturity?: string;
}

interface UseCasesCardProps {
  useCases: UseCase[];
  animDelay?: number;
}

export function UseCasesCard({ useCases, animDelay = 0.1 }: UseCasesCardProps) {
  if (!useCases?.length) return null;
  return (
    <div className="intel-card" style={{ animationDelay: `${animDelay}s` }}>
      <div className="intel-card-head">
        <div className="intel-card-icon ci-teal">⚡</div>
        <div className="intel-card-title">AI Use Cases</div>
        <div className="intel-card-count">{useCases.length} identified</div>
      </div>
      <div className="intel-card-body">
        <div className="intel-uc-grid">
          {useCases.map((u, i) => {
            const name = u.name ?? u.title ?? "Use Case";
            const maturity = (u.maturity ?? "unknown").toLowerCase().replace(/\s+/g, "");
            const badgeCls = maturity === "production" ? "ub-prod" : maturity === "pilot" ? "ub-pilot" : "ub-unknown";
            return (
              <div key={i} className="intel-uc-item">
                <div className="intel-uc-name">{name}</div>
                {u.metric && <div className="intel-uc-metric">{u.metric}</div>}
                <div className="intel-uc-desc">{u.description}</div>
                <span className={`intel-uc-badge ${badgeCls}`}>{u.maturity ?? "unknown"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
