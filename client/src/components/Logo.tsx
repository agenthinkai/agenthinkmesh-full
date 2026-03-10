/**
 * AgenThinkMesh Logo Component
 * Uses the official AGENTHINK horizontal logo image with a "MESH" badge
 */

const LOGO_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663268376562/7EnctkaNppkKLbjFfnH6YY/agenthink-logo_0604a325.png";

interface LogoProps {
  /** Height of the logo image in px. Default 36. */
  size?: number;
  /** Show the MESH badge next to the logo. Default true. */
  wordmark?: boolean;
  /** Invert for dark backgrounds — no-op now (logo has its own bg). Default false. */
  inverted?: boolean;
  className?: string;
}

export default function Logo({ size = 36, wordmark = true, className }: LogoProps) {
  // The logo image already has the navy background baked in.
  // We display it at the requested height and add a "MESH" badge.
  const imgHeight = size;
  // Approximate width based on the 4.7:1 aspect ratio of the horizontal logo
  const imgWidth = Math.round(imgHeight * 4.7);

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        userSelect: "none",
      }}
    >
      {/* Official AGENTHINK logo image */}
      <img
        src={LOGO_CDN}
        alt="AgenThink"
        height={imgHeight}
        width={imgWidth}
        style={{
          height: imgHeight,
          width: "auto",
          objectFit: "contain",
          borderRadius: 6,
          display: "block",
        }}
      />

      {/* MESH badge */}
      {wordmark && (
        <span
          style={{
            fontSize: Math.max(9, Math.round(imgHeight * 0.3)),
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "oklch(0.87 0.006 255)",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            textTransform: "uppercase",
            padding: "2px 7px",
            background: "oklch(0.19 0.05 255)",
            border: "1px solid oklch(0.87 0.006 255 / 35%)",
            borderRadius: 4,
            lineHeight: 1.4,
          }}
        >
          MESH
        </span>
      )}
    </div>
  );
}
