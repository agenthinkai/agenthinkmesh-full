import React from "react";

interface FooterCTAProps {
  institution?: string;
}

export function FooterCTA({ institution }: FooterCTAProps) {
  return (
    <div className="intel-footer-cta">
      <div className="intel-cta-eyebrow">Ready to deploy?</div>
      <div className="intel-cta-title">
        Deploy this intelligence layer<br />
        <em>for your institution</em>
      </div>
      <p className="intel-cta-sub">
        AgenThinkMesh delivers institutional-grade AI intelligence for GCC sovereign funds,
        family offices, and enterprises. Custom deployment in under 2 weeks.
      </p>
      <div className="intel-cta-buttons">
        <a
          href={`mailto:farouq@agenthinkmesh.com?subject=Book Demo${institution ? ` — ${institution}` : ""}&body=I'd like to book a demo of AgenThinkMesh Intelligence Agent.`}
          className="intel-cta-primary"
        >
          Book a Demo
        </a>
        <a
          href="mailto:farouq@agenthinkmesh.com"
          className="intel-cta-secondary"
        >
          Contact Sales
        </a>
      </div>
      <div className="intel-cta-contact">
        Direct line: <a href="mailto:farouq@agenthinkmesh.com">farouq@agenthinkmesh.com</a>
      </div>
    </div>
  );
}
