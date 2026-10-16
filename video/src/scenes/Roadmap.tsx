import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT } from "../theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// Bespoke: three rising HORIZON columns (Pilot -> Dispatch -> Platform). A climbing
// progress beam sweeps left to right; each column lifts and its items check in as the
// beam reaches it. Real content from the deck's Future Development slide.
const PHASES = [
  {
    tag: "NEXT 3 MONTHS",
    title: "Pilot-ready",
    c: COLORS.gemini1,
    items: ["Faster voice: pre-connect Gemini, latency metering", "Cloud Run + ADK agents: dispatch & verification", "Google Maps Platform — worldwide", "TURN relay for video on strict networks", "Full Android parity, then iOS"],
  },
  {
    tag: "6–12 MONTHS",
    title: "Real dispatch",
    c: COLORS.orange,
    items: ["112 / ERSS integration — hand incidents to the state centre", "Pilot with an NGO + police (Kerala Pol-App context)", "More languages for new regions", "Responder mobile app for field units"],
  },
  {
    tag: "PLATFORM",
    title: "Beyond calls",
    c: COLORS.green,
    items: ["Bluetooth mesh relay for no-signal areas", "On-device Gemini Nano — private & offline", "Anonymous whistleblowing on the same AI backbone", "Integration path into Android"],
  },
];

const COL_X = [150, 760, 1370];
const COL_W = 540;
const BASE_Y = 980;
const HEIGHTS = [460, 560, 660]; // rising columns

export const Roadmap: React.FC = () => {
  const frame = useCurrentFrame();
  const kO = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: EASE });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 56, opacity: kO }}>
        <div style={{ color: COLORS.orange, fontSize: 28, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT }}>
          Roadmap
        </div>
        <div style={{ color: COLORS.text, fontSize: 52, fontWeight: 800, fontFamily: FONT, marginTop: 6 }}>
          From prototype → pilot → platform
        </div>
      </div>

      {/* ground line */}
      <div style={{ position: "absolute", left: 100, right: 100, top: BASE_Y, height: 3, background: COLORS.panelLine, opacity: interpolate(frame, [16, 30], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />

      {PHASES.map((p, i) => {
        const start = 24 + i * 34;
        const h = HEIGHTS[i];
        const rise = interpolate(frame, [start, start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
        const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const colH = h * rise;
        return (
          <div key={p.title} style={{ position: "absolute", left: COL_X[i], top: BASE_Y - colH, width: COL_W, height: colH, opacity: o }}>
            {/* rising bar */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "20px 20px 0 0",
                background: `linear-gradient(180deg, ${p.c}26, ${COLORS.panel})`,
                border: `2.5px solid ${p.c}`,
                borderBottom: "none",
                boxShadow: `0 0 50px ${p.c}2a`,
              }}
            />
            {/* phase header */}
            <div style={{ position: "absolute", top: 22, left: 26, right: 26 }}>
              <div style={{ color: p.c, fontSize: 22, fontWeight: 800, letterSpacing: 2, fontFamily: FONT }}>{p.tag}</div>
              <div style={{ color: COLORS.text, fontSize: 38, fontWeight: 900, fontFamily: FONT, marginTop: 2 }}>{p.title}</div>
            </div>
            {/* items check in */}
            <div style={{ position: "absolute", top: 110, left: 26, right: 26, display: "flex", flexDirection: "column", gap: 14 }}>
              {p.items.map((it, j) => {
                const istart = start + 22 + j * 7;
                const io = interpolate(frame, [istart, istart + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
                const tx = interpolate(frame, [istart, istart + 12], [-18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
                return (
                  <div key={it} style={{ display: "flex", gap: 12, opacity: io, translate: `${tx}px 0` }}>
                    <div style={{ color: p.c, fontSize: 22, fontWeight: 900, flexShrink: 0 }}>▸</div>
                    <div style={{ color: COLORS.text, fontSize: 24, fontFamily: FONT, lineHeight: 1.25 }}>{it}</div>
                  </div>
                );
              })}
            </div>
            {/* glowing cap dot at the top of each rising column */}
            <div style={{ position: "absolute", top: -10, left: "50%", translate: "-50% 0", width: 20, height: 20, borderRadius: "50%", background: p.c, boxShadow: `0 0 24px ${p.c}`, opacity: rise }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
