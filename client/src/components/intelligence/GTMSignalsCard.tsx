import React from "react";

interface GTMSignal {
  signal: string;
  target?: string;
  action?: string;
  implication?: string;
}

interface GTMSignalsCardProps {
  signals: GTMSignal[];
  comparableInstitutions?: string[];
  animDelay?: number;
}

export function GTMSignalsCard({ signals, comparableInstitutions, animDelay = 0.2 }: GTMSignalsCardProps) {
  if (!signals?.length) return null;
  return (
    <div className="intel-card" style={{ animationDelay: `${animDelay}s` }}>
      <div className="intel-card-head">
        <div className="intel-card-icon ci-gold">◎</div>
        <div className="intel-card-title">GTM Signals for AgenThinkMesh</div>
      </div>
      <div className="intel-card-body">
        {signals.map((s, i) => (
          <div key={i} className="intel-gtm-item">
            <div className="intel-gtm-num">0{i + 1}</div>
            <div className="intel-gtm-body">
              <div className="intel-gtm-signal">{s.signal}</div>
              <div className="intel-gtm-meta">
                {s.target && <span>Target: <span style={{ color: "var(--intel-teal)" }}>{s.target}</span> · </span>}
                {s.action ?? s.implication ?? ""}
              </div>
            </div>
          </div>
        ))}
        {comparableInstitutions?.length ? (
          <div className="intel-peer-chips">
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--intel-muted)", marginRight: 4, alignSelf: "center" }}>GCC PEERS</span>
            {comparableInstitutions.map((p, i) => (
              <span key={i} className="intel-peer-chip">{p}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
