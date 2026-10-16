import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, random } from "remotion";
import { COLORS } from "./theme";

// Immersive animated background: a deep gradient, a slow-drifting glow, and floating
// particles. Deterministic via random(seed) so it renders identically every time.
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const driftX = interpolate(frame % 600, [0, 300, 600], [-60, 60, -60]);
  const driftY = interpolate(frame % 800, [0, 400, 800], [-40, 40, -40]);

  const particles = new Array(40).fill(0).map((_, i) => {
    const seed = `p${i}`;
    const baseX = random(seed + "x") * 1920;
    const baseY = random(seed + "y") * 1080;
    const speed = 0.2 + random(seed + "s") * 0.6;
    const size = 2 + random(seed + "z") * 4;
    const y = (baseY - frame * speed) % 1120;
    const yy = y < 0 ? y + 1120 : y;
    const twinkle = 0.25 + 0.75 * Math.abs(Math.sin((frame + i * 20) / 30));
    return { x: baseX, y: yy - 20, size, opacity: twinkle * 0.5 };
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(130% 120% at 50% 0%, ${COLORS.bgSoft} 0%, ${COLORS.bg} 60%)`,
      }}
    >
      {/* drifting color glows */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          left: 200 + driftX,
          top: -300 + driftY,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.gemini1}22, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          right: 150 - driftX,
          bottom: -250 - driftY,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.orange}1c, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      {/* floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: COLORS.text,
            opacity: p.opacity,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
