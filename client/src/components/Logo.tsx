/**
 * AgenThinkMesh Logo Component
 * Mark: Hexagonal mesh node — outer hex ring + inner connected node graph
 * Wordmark: "AgenThink" bold + "Mesh" in indigo mono
 */

interface LogoProps {
  /** Size of the mark in px. Default 32. */
  size?: number;
  /** Show the wordmark next to the mark. Default true. */
  wordmark?: boolean;
  /** Invert colors for dark backgrounds. Default false. */
  inverted?: boolean;
  className?: string;
}

export default function Logo({ size = 32, wordmark = true, inverted = false, className }: LogoProps) {
  const textColor = inverted ? "#FFFFFF" : "#0F172A";
  const mutedColor = inverted ? "rgba(255,255,255,0.55)" : "#94A3B8";
  const accentColor = "#4F46E5";
  const accentLight = inverted ? "rgba(99,102,241,0.25)" : "#EEF2FF";

  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: 9, userSelect: "none" }}>
      {/* ── SVG Mark ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="AgenThinkMesh logo mark"
      >
        {/* Outer hexagon */}
        <path
          d="M20 2L35.59 11V29L20 38L4.41 29V11L20 2Z"
          fill={accentLight}
          stroke={accentColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Inner mesh edges */}
        {/* Center to top */}
        <line x1="20" y1="20" x2="20" y2="9" stroke={accentColor} strokeWidth="1.4" strokeOpacity="0.6" />
        {/* Center to top-right */}
        <line x1="20" y1="20" x2="29" y2="14.5" stroke={accentColor} strokeWidth="1.4" strokeOpacity="0.6" />
        {/* Center to bottom-right */}
        <line x1="20" y1="20" x2="29" y2="25.5" stroke={accentColor} strokeWidth="1.4" strokeOpacity="0.6" />
        {/* Center to bottom */}
        <line x1="20" y1="20" x2="20" y2="31" stroke={accentColor} strokeWidth="1.4" strokeOpacity="0.6" />
        {/* Center to bottom-left */}
        <line x1="20" y1="20" x2="11" y2="25.5" stroke={accentColor} strokeWidth="1.4" strokeOpacity="0.6" />
        {/* Center to top-left */}
        <line x1="20" y1="20" x2="11" y2="14.5" stroke={accentColor} strokeWidth="1.4" strokeOpacity="0.6" />

        {/* Outer node dots */}
        <circle cx="20" cy="9"   r="2.2" fill={accentColor} />
        <circle cx="29" cy="14.5" r="2.2" fill={accentColor} />
        <circle cx="29" cy="25.5" r="2.2" fill={accentColor} />
        <circle cx="20" cy="31"  r="2.2" fill={accentColor} />
        <circle cx="11" cy="25.5" r="2.2" fill={accentColor} />
        <circle cx="11" cy="14.5" r="2.2" fill={accentColor} />

        {/* Center core */}
        <circle cx="20" cy="20" r="4.5" fill={accentColor} />
        <circle cx="20" cy="20" r="2.2" fill="white" />
      </svg>

      {/* ── Wordmark ── */}
      {wordmark && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{
            fontSize: size * 0.5,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: textColor,
            lineHeight: 1,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            AgenThink
          </span>
          <span style={{
            fontSize: size * 0.34,
            fontWeight: 500,
            color: accentColor,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.01em",
            lineHeight: 1,
            padding: "1px 6px",
            background: accentLight,
            borderRadius: 4,
            border: `1px solid ${inverted ? "rgba(99,102,241,0.4)" : "#C7D2FE"}`,
          }}>
            Mesh
          </span>
        </div>
      )}
    </div>
  );
}
