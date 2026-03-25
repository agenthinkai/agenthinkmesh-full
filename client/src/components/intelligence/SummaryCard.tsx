import React from "react";

interface SummaryCardProps {
  institution: string;
  domain?: string;
  aum?: string;
  summary: string;
  keyQuote?: string;
  animDelay?: number;
}

export function SummaryCard({ institution, domain, aum, summary, keyQuote, animDelay = 0.05 }: SummaryCardProps) {
  return (
    <div
      className="intel-card"
      style={{ animationDelay: `${animDelay}s` }}
    >
      <div className="intel-card-head">
        <div className="intel-card-icon ci-gold">🏛</div>
        <div className="intel-card-title">
          {institution}
          {domain && <span style={{ color: "var(--intel-muted)", fontWeight: 400 }}> · {domain}</span>}
          {aum && <span style={{ color: "var(--intel-muted)", fontWeight: 400 }}> · {aum}</span>}
        </div>
      </div>
      <div className="intel-card-body">
        <p className="intel-summary-text">{summary}</p>
        {keyQuote && (
          <div className="intel-quote-block">"{keyQuote}"</div>
        )}
      </div>
    </div>
  );
}
