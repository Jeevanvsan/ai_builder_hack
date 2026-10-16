import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT } from "../theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// Bespoke: a routing hub. QuickBite sits center; adopter systems orbit it, each
// connected by a curved pipe. A data pulse travels QuickBite -> each endpoint, and
// the endpoint's "system" panel lights up to show WHERE the incident lands.
const HUB = { x: 960, y: 560 };

const ENDPOINTS = [
  { icon: "🚓", who: "Police & 112", sys: "help arrives fast", c: COLORS.blue, x: 360, y: 320 },
  { icon: "☎️", who: "Govt helplines", sys: "a quieter way to reach them", c: COLORS.orange, x: 360, y: 800 },
  { icon: "🤝", who: "NGOs & shelters", sys: "offered as their own app", c: COLORS.green, x: 1560, y: 320 },
  { icon: "🎓", who: "Colleges & workplaces", sys: "keep their people safe", c: COLORS.gemini2, x: 1560, y: 800 },
  { icon: "🚕", who: "Safety & ride apps", sys: "a hidden panic button", c: COLORS.red, x: 960, y: 920 },
];

const curve = (ax: number, ay: number, bx: number, by: number) => {
  const mx = (ax + bx) / 2;
  return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
};

export const Integrations: React.FC = () => {
  const frame = useCurrentFrame();
  const kO = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: EASE });
  const hubO = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hubPulse = 1 + Math.sin(frame / 14) * 0.03;

  return (
    <AbsoluteFill>
      {/* header */}
      <div style={{ position: "absolute", left: 100, top: 60, opacity: kO, zIndex: 5 }}>
        <div style={{ color: COLORS.orange, fontSize: 28, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT }}>
          Who can offer it
        </div>
        <div style={{ color: COLORS.text, fontSize: 52, fontWeight: 800, fontFamily: FONT, marginTop: 8 }}>
          Anyone who keeps people safe can run it
        </div>
      </div>

      {/* pipes + travelling pulses */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {ENDPOINTS.map((e, i) => {
          const start = 34 + i * 12;
          const draw = interpolate(frame, [start, start + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          const d = curve(HUB.x, HUB.y, e.x, e.y);
          const len = 900;
          // pulse travels hub -> endpoint, repeating after drawn
          const pulseT = frame > start + 18 ? (((frame - start - 18) % 30) / 30) : -1;
          const mx = (HUB.x + e.x) / 2;
          // approximate point on the cubic for the pulse
          const t = pulseT;
          const px = t >= 0 ? cubic(HUB.x, mx, mx, e.x, t) : 0;
          const py = t >= 0 ? cubic(HUB.y, HUB.y, e.y, e.y, t) : 0;
          return (
            <g key={e.who}>
              <path d={d} fill="none" stroke={e.c} strokeWidth={3.5} opacity={0.4} strokeDasharray={len} strokeDashoffset={len * (1 - draw)} strokeLinecap="round" />
              {t >= 0 && <circle cx={px} cy={py} r={9} fill={e.c} opacity={Math.sin(t * Math.PI)} />}
            </g>
          );
        })}
      </svg>

      {/* endpoint system panels */}
      {ENDPOINTS.map((e, i) => {
        const start = 34 + i * 12;
        const o = interpolate(frame, [start + 10, start + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        const sc = interpolate(frame, [start + 10, start + 28], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.4, 0.64, 1) });
        const alignRight = e.x < HUB.x; // left-side panels anchor to the right edge toward hub
        return (
          <div
            key={e.who}
            style={{
              position: "absolute",
              left: e.x,
              top: e.y,
              translate: "-50% -50%",
              width: 330,
              padding: "20px 24px",
              borderRadius: 18,
              background: COLORS.panel,
              border: `2.5px solid ${e.c}`,
              boxShadow: `0 0 36px ${e.c}30`,
              opacity: o,
              scale: String(sc),
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 14, background: `${e.c}22`, border: `1.5px solid ${e.c}66`, display: "grid", placeItems: "center", fontSize: 36, flexShrink: 0 }}>{e.icon}</div>
            <div>
              <div style={{ color: e.c, fontSize: 28, fontWeight: 800, fontFamily: FONT }}>{e.who}</div>
              <div style={{ color: COLORS.textDim, fontSize: 22, fontFamily: FONT, marginTop: 3 }}>{e.sys}</div>
            </div>
          </div>
        );
      })}

      {/* central QuickBite hub */}
      <div
        style={{
          position: "absolute",
          left: HUB.x,
          top: HUB.y,
          translate: "-50% -50%",
          width: 230,
          height: 230,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.orange}, ${COLORS.orange}44)`,
          border: `3px solid ${COLORS.orange}`,
          boxShadow: `0 0 80px ${COLORS.orange}66`,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          opacity: hubO,
          scale: String(hubPulse),
          zIndex: 3,
        }}
      >
        <div>
          <div style={{ color: "#fff", fontSize: 34, fontWeight: 900, fontFamily: FONT }}>QuickBite</div>
          <div style={{ color: "#fff", fontSize: 20, fontFamily: FONT, opacity: 0.85, marginTop: 4 }}>one app</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// cubic bezier scalar for the specific control layout used above
function cubic(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
