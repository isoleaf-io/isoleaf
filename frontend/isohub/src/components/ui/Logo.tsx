interface LogoProps {
  size?: number;
  variant?: "icon" | "full" | "wordmark";
  className?: string;
}

interface Quad {
  x: number;
  y: number;
  fill: string;
  mti?: string;
  textX?: number;
  textOpacity?: number;
}

const QUADS: Quad[] = [
  // Row 1 — 1 quad
  { x: 136, y: 18, fill: "#2176C7", mti: "0200", textX: 155, textOpacity: 0.5 },

  // Row 2 — 3 quads
  { x: 94, y: 60, fill: "#378ADD" },
  { x: 136, y: 60, fill: "#1D9E75", mti: "0210", textX: 155, textOpacity: 0.85 },
  { x: 178, y: 60, fill: "#5DCAA5" },

  // Row 3 — 5 quads
  { x: 52, y: 102, fill: "#7F77DD", mti: "0100", textX: 71, textOpacity: 0.4 },
  { x: 94, y: 102, fill: "#9F9AE8" },
  { x: 136, y: 102, fill: "#F59E0B", mti: "0400", textX: 155, textOpacity: 0.9 },
  { x: 178, y: 102, fill: "#E8A838" },
  { x: 220, y: 102, fill: "#D85A30", mti: "0410", textX: 239, textOpacity: 0.5 },

  // Row 4 — 7 quads (center)
  { x: 10, y: 144, fill: "#0C447C" },
  { x: 52, y: 144, fill: "#185FA5", mti: "0110", textX: 71, textOpacity: 0.35 },
  { x: 94, y: 144, fill: "#E24B4A" },
  { x: 136, y: 144, fill: "#F87171", mti: "0800", textX: 155, textOpacity: 0.9 },
  { x: 178, y: 144, fill: "#BA7517" },
  { x: 220, y: 144, fill: "#F5C4B3", mti: "0810", textX: 239, textOpacity: 0.5 },
  { x: 262, y: 144, fill: "#0F6E56" },

  // Row 5 — 5 quads
  { x: 52, y: 186, fill: "#CECBF6" },
  { x: 94, y: 186, fill: "#AFA9EC", mti: "0420", textX: 113, textOpacity: 0.6 },
  { x: 136, y: 186, fill: "#34D399" },
  { x: 178, y: 186, fill: "#9FE1CB", mti: "0430", textX: 197, textOpacity: 0.4 },
  { x: 220, y: 186, fill: "#EF9F27" },

  // Row 6 — 3 quads
  { x: 94, y: 228, fill: "#85B7EB" },
  { x: 136, y: 228, fill: "#B5D4F4", mti: "0120", textX: 155, textOpacity: 0.7 },
  { x: 178, y: 228, fill: "#5DCAA5" },

  // Row 7 — 1 quad
  { x: 136, y: 270, fill: "#378ADD", mti: "0220", textX: 155, textOpacity: 0.45 },
];

const QUAD_W = 38;
const QUAD_H = 38;
const QUAD_RX = 6;
const TEXT_DY = 23; // baseline offset within a 38px quad

function Diamond() {
  return (
    <>
      {QUADS.map((q, i) => (
        <g key={i}>
          <rect x={q.x} y={q.y} width={QUAD_W} height={QUAD_H} rx={QUAD_RX} fill={q.fill} />
          {q.mti && q.textX !== undefined && (
            <text
              x={q.textX}
              y={q.y + TEXT_DY}
              fontFamily="monospace"
              fontSize={8}
              fontWeight={700}
              fill="white"
              textAnchor="middle"
              opacity={q.textOpacity ?? 1}
            >
              {q.mti}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

function Wordmark({ x }: { x: number }) {
  return (
    <>
      <text
        x={x}
        y={148}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={52}
        fontWeight={700}
        fill="#0C447C"
        letterSpacing={-2}
      >
        ISO
      </text>
      <text
        x={x}
        y={202}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={52}
        fontWeight={300}
        fill="#185FA5"
        letterSpacing={-2}
      >
        Hub
      </text>
      <text
        x={x + 2}
        y={222}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={9.5}
        fill="#bbb"
        letterSpacing={3}
      >
        ISO 8583 TOOLKIT
      </text>
    </>
  );
}

export function Logo({ size = 40, variant = "icon", className }: LogoProps) {
  if (variant === "icon") {
    return (
      <svg
        role="img"
        aria-label="ISOLeaf"
        viewBox="0 0 310 308"
        height={size}
        width={(size * 310) / 308}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        <Diamond />
      </svg>
    );
  }

  if (variant === "wordmark") {
    return (
      <svg
        role="img"
        aria-label="ISOLeaf"
        viewBox="0 0 200 230"
        height={size}
        width={(size * 200) / 230}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        <Wordmark x={0} />
      </svg>
    );
  }

  // full
  return (
    <svg
      role="img"
      aria-label="ISOLeaf — ISO 8583 Toolkit"
      viewBox="0 0 520 308"
      height={size}
      width={(size * 520) / 308}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Diamond />
      <Wordmark x={336} />
    </svg>
  );
}
