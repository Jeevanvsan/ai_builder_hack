import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT } from "../theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// Clear 3-stage story, read left to right:
//   1) Gemini PROPOSES structured fields   2) CODE DECIDES (rules)   3) ACTION
// Then a bottom row of what runs after the call (incl. related-incident linking).
// Generous spacing, no overlapping flying elements — legibility first.

// real tool names from the build — shown firing live to make the agentic story concrete
const TOOL_CALLS = [
  "report_situation()",
  "report_coercion_signal()",
  "report_stress_level()",
  "confirm_address()",
  "report_vehicle_number()",
];

export const AiDecides: React.FC = () => {
  const frame = useCurrentFrame();
  const kO = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: EASE });

  return (
    <AbsoluteFill>
      {/* header */}
      <div style={{ position: "absolute", left: 100, top: 80, opacity: kO }}>
        <div style={{ color: COLORS.orange, fontSize: 30, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT }}>
          A verified agent, not a chatbot
        </div>
        <div style={{ color: COLORS.text, fontSize: 60, fontWeight: 800, fontFamily: FONT, marginTop: 10 }}>
          The AI proposes. Code decides.
        </div>
      </div>

      {/* three stage columns, evenly spaced */}
      <Stage1 frame={frame} />
      <ArrowBetween frame={frame} x={620} delay={70} label="proposes" color={COLORS.gemini1} />
      <Stage2 frame={frame} />
      <ArrowBetween frame={frame} x={1230} delay={92} label="decides" color={COLORS.orange} />
      <Stage3 frame={frame} />

      {/* after-the-call row (includes related incidents) */}
      <AfterRow frame={frame} />
    </AbsoluteFill>
  );
};

// Stage 1 — Gemini AGENT firing real tool-calls live (the agentic story, made concrete)
const Stage1: React.FC<{ frame: number }> = ({ frame }) => {
  const o = interpolate(frame, [20, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div style={{ position: "absolute", left: 120, top: 300, width: 470, opacity: o }}>
      <Label text="1 · GEMINI — AUTONOMOUS AGENT" c={COLORS.gemini1} />
      <div style={{ padding: "22px 24px", borderRadius: 20, background: COLORS.panel, border: `2.5px solid ${COLORS.gemini1}`, boxShadow: `0 0 40px ${COLORS.gemini1}33`, marginTop: 14 }}>
        <div style={{ color: COLORS.textDim, fontSize: 24, fontFamily: FONT, marginBottom: 14 }}>
          calls its own tools, mid-conversation:
        </div>
        {/* tool calls fire one after another, like a live console */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TOOL_CALLS.map((tc, i) => {
            const start = 40 + i * 11;
            const io = interpolate(frame, [start, start + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
            const tx = interpolate(frame, [start, start + 10], [-20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
            // brief highlight flash as it "fires"
            const flash = interpolate(frame, [start, start + 6, start + 16], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div
                key={tc}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 16px",
                  borderRadius: 10,
                  background: `${COLORS.gemini1}${flash > 0.3 ? "33" : "14"}`,
                  border: `1.5px solid ${COLORS.gemini1}${flash > 0.3 ? "ff" : "66"}`,
                  opacity: io,
                  translate: `${tx}px 0`,
                }}
              >
                <span style={{ color: COLORS.gemini2, fontSize: 22, fontWeight: 900 }}>⚡</span>
                <span style={{ color: COLORS.text, fontSize: 25, fontFamily: "monospace", fontWeight: 600 }}>{tc}</span>
              </div>
            );
          })}
        </div>
        <div style={{ color: COLORS.textDim, fontSize: 22, fontFamily: FONT, marginTop: 14 }}>
          …12 function-call tools in all — not prompt-and-reply
        </div>
      </div>
    </div>
  );
};

// Stage 2 — deterministic RULES gate
const Stage2: React.FC<{ frame: number }> = ({ frame }) => {
  const o = interpolate(frame, [76, 92], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const press = Math.max(0, Math.sin((frame / 50) * Math.PI * 2));
  return (
    <div style={{ position: "absolute", left: 760, top: 330, width: 420, opacity: o }}>
      <Label text="2 · CODE DECIDES" c={COLORS.orange} />
      <div style={{ padding: "28px 26px", borderRadius: 20, background: COLORS.panel, border: `2.5px solid ${COLORS.orange}`, boxShadow: `0 0 ${40 + press * 40}px ${COLORS.orange}55`, marginTop: 14, textAlign: "center", scale: String(1 - press * 0.02) }}>
        <div style={{ color: COLORS.orange, fontSize: 40, fontWeight: 900, fontFamily: FONT }}>Deterministic rules</div>
        <div style={{ color: COLORS.text, fontSize: 28, fontFamily: FONT, marginTop: 12 }}>set <b>severity</b> · launch the <b>route</b></div>
        <div style={{ color: COLORS.textDim, fontSize: 24, fontFamily: FONT, marginTop: 14, lineHeight: 1.3 }}>
          no hallucinated life-or-death calls
        </div>
      </div>
    </div>
  );
};

// Stage 3 — action out
const Stage3: React.FC<{ frame: number }> = ({ frame }) => {
  const o = interpolate(frame, [98, 114], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const tx = interpolate(frame, [98, 116], [-30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div style={{ position: "absolute", left: 1400, top: 330, width: 440, opacity: o, translate: `${tx}px 0` }}>
      <Label text="3 · ACTION" c={COLORS.green} />
      <div style={{ padding: "28px 26px", borderRadius: 20, background: `${COLORS.green}18`, border: `2.5px solid ${COLORS.green}`, boxShadow: `0 0 40px ${COLORS.green}44`, marginTop: 14 }}>
        <div style={{ color: COLORS.green, fontSize: 40, fontWeight: 900, fontFamily: FONT }}>▶ Route to safety</div>
        <div style={{ color: COLORS.text, fontSize: 26, fontFamily: FONT, marginTop: 12 }}>launched the moment location is known</div>
      </div>
    </div>
  );
};

const Label: React.FC<{ text: string; c: string }> = ({ text, c }) => (
  <div style={{ color: c, fontSize: 26, fontWeight: 800, letterSpacing: 1.5, fontFamily: FONT }}>{text}</div>
);

const ArrowBetween: React.FC<{ frame: number; x: number; delay: number; label: string; color: string }> = ({ frame, x, delay, label, color }) => {
  const grow = interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  // one packet repeatedly crossing
  const t = frame >= delay ? (((frame - delay) % 30) / 30) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: 470, width: 140, opacity: grow }}>
      <div style={{ position: "relative", height: 4, background: `${color}66`, borderRadius: 2 }}>
        <div style={{ position: "absolute", left: `${t * 100}%`, top: -4, width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: `0 0 12px ${color}`, translate: "-50% 0" }} />
      </div>
      <div style={{ color, fontSize: 22, fontFamily: FONT, textAlign: "center", marginTop: 10, fontWeight: 600 }}>{label}</div>
    </div>
  );
};

const AFTER = [
  { t: "Post-call summary", c: COLORS.gemini2 },
  { t: "Third-party redaction", c: COLORS.blue },
  { t: "Links related incidents", c: COLORS.yellow },
  { t: "Gemma judge validates every run", c: COLORS.red },
];
const AfterRow: React.FC<{ frame: number }> = ({ frame }) => {
  const o = interpolate(frame, [120, 136], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div style={{ position: "absolute", bottom: 120, width: 1920, opacity: o }}>
      <div style={{ textAlign: "center", color: COLORS.textDim, fontSize: 26, fontWeight: 700, letterSpacing: 2, fontFamily: FONT, marginBottom: 24 }}>
        AFTER THE CALL — GROUNDED &amp; SELF-CHECKING
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 26 }}>
        {AFTER.map((a, i) => {
          const io = interpolate(frame, [128 + i * 8, 128 + i * 8 + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          const tick = interpolate(frame, [134 + i * 8, 142 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={a.t} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderRadius: 14, background: `${a.c}18`, border: `1.5px solid ${a.c}`, opacity: io }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${a.c}`, display: "grid", placeItems: "center", color: a.c, fontSize: 18, fontWeight: 900, scale: String(tick) }}>✓</div>
              <div style={{ color: COLORS.text, fontSize: 28, fontFamily: FONT, fontWeight: 600 }}>{a.t}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
