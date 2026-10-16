import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT } from "../theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// Radar screen: the four real "ways in" from the deck, in plain words. The sweep beam
// reveals each one as it passes. Center = the person in danger.
const CX = 820;
const CY = 640;
const R = 320;

const WAYS = [
  { a: -90, icon: "🤫", label: "Being watched", sub: "orders food quietly", c: COLORS.orange },
  { a: 0, icon: "🗣️", label: "Can speak freely", sub: "uses the open menu", c: COLORS.green },
  { a: 90, icon: "🏃", label: "Being followed", sub: "gets a safe route", c: COLORS.red },
  { a: 180, icon: "💗", label: "Can't touch the phone", sub: "silent heart double-tap", c: COLORS.gemini2 },
];

const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r };
};

export const UseCases: React.FC = () => {
  const frame = useCurrentFrame();
  const kO = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: EASE });
  const sweepStart = 20;
  const sweepAngle = -90 + Math.max(0, frame - sweepStart) * 3.0;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 72, opacity: kO }}>
        <div style={{ color: COLORS.orange, fontSize: 30, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT }}>
          No matter the danger
        </div>
        <div style={{ color: COLORS.text, fontSize: 58, fontWeight: 800, fontFamily: FONT, marginTop: 10 }}>
          Four quiet ways to reach help
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[0.33, 0.66, 1].map((f, i) => {
          const ro = interpolate(frame, [10 + i * 5, 24 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <circle key={i} cx={CX} cy={CY} r={R * f} fill="none" stroke={COLORS.panelLine} strokeWidth={2} opacity={0.5 * ro} />;
        })}
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke={COLORS.panelLine} strokeWidth={1.5} opacity={0.3} />
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke={COLORS.panelLine} strokeWidth={1.5} opacity={0.3} />
        <defs>
          <radialGradient id="sweep" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${CX} ${CY}) rotate(${sweepAngle})`}>
            <stop offset="0%" stopColor={COLORS.orange} stopOpacity="0.5" />
            <stop offset="100%" stopColor={COLORS.orange} stopOpacity="0" />
          </radialGradient>
        </defs>
        {frame > sweepStart && (
          <g transform={`rotate(${sweepAngle} ${CX} ${CY})`}>
            <path d={`M ${CX} ${CY} L ${CX + R} ${CY - 120} A ${R} ${R} 0 0 1 ${CX + R} ${CY + 10} Z`} fill="url(#sweep)" opacity={0.8} />
            <line x1={CX} y1={CY} x2={CX + R} y2={CY} stroke={COLORS.orange} strokeWidth={3} opacity={0.9} />
          </g>
        )}
      </svg>

      {/* center = the person */}
      <div
        style={{
          position: "absolute",
          left: CX,
          top: CY,
          translate: "-50% -50%",
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.orange}, ${COLORS.orange}55)`,
          border: `2.5px solid ${COLORS.orange}`,
          boxShadow: `0 0 60px ${COLORS.orange}88`,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          opacity: interpolate(frame, [14, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 26, fontFamily: FONT, padding: "0 8px" }}>In danger</div>
      </div>

      {WAYS.map((w) => {
        const p = polar(w.a, R);
        const trig = sweepAngle >= w.a ? 1 : 0;
        const since = sweepAngle - w.a;
        const flash = trig ? Math.max(0, 1 - since / 60) : 0;
        const appear = trig ? interpolate(since, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }) : 0;
        const lp = polar(w.a, R + 36);
        const leftSide = Math.cos((w.a * Math.PI) / 180) < -0.1;
        const topSide = Math.sin((w.a * Math.PI) / 180) < -0.1;
        return (
          <React.Fragment key={w.label}>
            <div style={{ position: "absolute", left: p.x, top: p.y, translate: "-50% -50%", width: 28 + flash * 24, height: 28 + flash * 24, borderRadius: "50%", background: w.c, boxShadow: `0 0 ${20 + flash * 50}px ${w.c}`, opacity: appear }} />
            <div
              style={{
                position: "absolute",
                left: leftSide ? lp.x - 24 : lp.x + 24,
                top: topSide ? lp.y - 20 : lp.y,
                translate: `${leftSide ? "-100%" : "0"} -50%`,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 22px",
                borderRadius: 16,
                background: COLORS.panel,
                border: `2px solid ${w.c}`,
                boxShadow: `0 0 ${16 + flash * 30}px ${w.c}66`,
                opacity: appear,
                scale: String(0.8 + 0.2 * appear),
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 40 }}>{w.icon}</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: w.c, fontSize: 30, fontWeight: 800, fontFamily: FONT }}>{w.label}</span>
                <span style={{ color: COLORS.textDim, fontSize: 23, fontFamily: FONT }}>{w.sub}</span>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
