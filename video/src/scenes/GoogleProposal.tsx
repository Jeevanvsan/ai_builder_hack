import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT } from "../theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const GOOGLE = [COLORS.gemini1, COLORS.red, COLORS.yellow, COLORS.green];

// Bespoke: an Android phone mockup. The Personal Safety screen builds, then a new
// "Discreet Mode" row slides in and highlights — QuickBite as a native Google feature.
// Right side: the product-path points build beside it.

const SAFETY_ROWS = [
  { label: "Emergency SOS", sub: "Press power 5× to call for help", on: false },
  { label: "Emergency sharing", sub: "Share location with contacts", on: false },
  { label: "Crisis alerts", sub: "Natural-disaster warnings", on: false },
];

const POINTS = [
  { k: "Discreet Mode", rest: "a Gemini Live covert persona inside Emergency SOS", c: COLORS.gemini1 },
  { k: "Gemini Nano", rest: "on-device — private extraction, nothing leaves the phone", c: COLORS.green },
  { k: "Google Cloud", rest: "the public-safety backend for agencies", c: COLORS.yellow },
];

export const GoogleProposal: React.FC = () => {
  const frame = useCurrentFrame();
  const kO = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: EASE });

  // phone slides up
  const phoneY = interpolate(frame, [10, 34], [60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const phoneO = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // the special Discreet Mode row slides in at frame 70 and pulses
  const discreetIn = interpolate(frame, [70, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.4, 0.64, 1) });
  const discreetGlow = frame > 90 ? 0.4 + 0.3 * Math.sin(frame / 10) : 0;

  return (
    <AbsoluteFill>
      {/* header */}
      <div style={{ position: "absolute", left: 100, top: 72, opacity: kO }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {GOOGLE.map((c, i) => {
            const w = interpolate(frame, [i * 5, i * 5 + 16], [0, 56], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
            return <div key={c} style={{ width: w, height: 9, borderRadius: 5, background: c }} />;
          })}
        </div>
        <div style={{ color: COLORS.textDim, fontSize: 28, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT }}>
          The Google opportunity
        </div>
        <div style={{ color: COLORS.text, fontSize: 58, fontWeight: 900, fontFamily: FONT, marginTop: 8 }}>
          A native mode inside Android
        </div>
      </div>

      {/* PHONE MOCKUP (left-center) */}
      <div
        style={{
          position: "absolute",
          left: 250,
          top: 300,
          width: 380,
          height: 720,
          borderRadius: 54,
          background: "#0d1326",
          border: "10px solid #050a14",
          boxShadow: `0 30px 90px #000a, 0 0 60px ${COLORS.gemini1}22`,
          opacity: phoneO,
          translate: `0 ${phoneY}px`,
          padding: 22,
          overflow: "hidden",
        }}
      >
        {/* notch */}
        <div style={{ width: 130, height: 26, borderRadius: 14, background: "#05080f", margin: "0 auto 18px" }} />
        {/* screen title */}
        <div style={{ color: COLORS.text, fontSize: 30, fontWeight: 800, fontFamily: FONT, marginBottom: 6 }}>Personal Safety</div>
        <div style={{ color: COLORS.textDim, fontSize: 19, fontFamily: FONT, marginBottom: 22 }}>Google · Safety &amp; emergency</div>

        {/* standard rows */}
        {SAFETY_ROWS.map((r, i) => {
          const o = interpolate(frame, [34 + i * 9, 34 + i * 9 + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          return (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 10px", opacity: o, borderBottom: `1px solid ${COLORS.panelLine}66` }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${COLORS.textDim}22`, flexShrink: 0 }} />
              <div>
                <div style={{ color: COLORS.text, fontSize: 21, fontWeight: 600, fontFamily: FONT }}>{r.label}</div>
                <div style={{ color: COLORS.textDim, fontSize: 16, fontFamily: FONT }}>{r.sub}</div>
              </div>
            </div>
          );
        })}

        {/* NEW Discreet Mode row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 12px",
            marginTop: 12,
            borderRadius: 14,
            background: `${COLORS.gemini1}${Math.round((0.12 + discreetGlow * 0.15) * 255).toString(16).padStart(2, "0")}`,
            border: `2px solid ${COLORS.gemini1}`,
            boxShadow: `0 0 ${20 + discreetGlow * 40}px ${COLORS.gemini1}88`,
            opacity: discreetIn,
            translate: `0 ${(1 - discreetIn) * 30}px`,
            scale: String(0.9 + 0.1 * discreetIn),
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${COLORS.gemini1}, ${COLORS.gemini2})`, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 24 }}>🍔</div>
          <div>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, fontFamily: FONT }}>Discreet Mode</div>
            <div style={{ color: COLORS.textDim, fontSize: 16, fontFamily: FONT }}>Covert help via a disguised app</div>
          </div>
          <div style={{ marginLeft: "auto", width: 46, height: 26, borderRadius: 13, background: COLORS.green, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", right: 3, top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff" }} />
          </div>
        </div>
        <div style={{ color: COLORS.gemini1, fontSize: 15, fontFamily: FONT, marginTop: 10, fontStyle: "italic", opacity: discreetIn }}>
          ↑ QuickBite, shipped as a Google feature
        </div>
      </div>

      {/* product-path points (right) */}
      <div style={{ position: "absolute", left: 760, top: 360, width: 920, display: "flex", flexDirection: "column", gap: 30 }}>
        {POINTS.map((p, i) => {
          const start = 56 + i * 20;
          const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          const tx = interpolate(frame, [start, start + 14], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          const bar = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          return (
            <div key={p.k} style={{ display: "flex", alignItems: "center", gap: 22, opacity: o, translate: `${tx}px 0` }}>
              <div style={{ width: 8, height: 64 * bar, background: p.c, borderRadius: 4, flexShrink: 0 }} />
              <div style={{ fontSize: 40, fontFamily: FONT, color: COLORS.text, fontWeight: 600 }}>
                <span style={{ color: p.c, fontWeight: 900 }}>{p.k}</span> — {p.rest}
              </div>
            </div>
          );
        })}

        {/* proof */}
        <ProofBar frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

const ProofBar: React.FC<{ frame: number }> = ({ frame }) => {
  const o = interpolate(frame, [120, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const sc = interpolate(frame, [120, 142], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.5, 0.64, 1) });
  return (
    <div style={{ marginTop: 24, padding: "22px 32px", borderRadius: 16, background: `${COLORS.blue}1c`, border: `2px solid ${COLORS.blue}`, color: COLORS.text, fontSize: 34, fontWeight: 700, fontFamily: FONT, opacity: o, scale: String(sc), alignSelf: "flex-start" }}>
      ✓ The same Gemini Live pattern already runs in 911 centres today.
    </div>
  );
};
