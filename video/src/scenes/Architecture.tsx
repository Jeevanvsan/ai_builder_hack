import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT, SIZE } from "../theme";
import { Packets, pulse, EASE } from "../flow";

// ---- stage layout (1920x1080) ----
// Left: 4 ways in -> app. Center: Gemini Live (with tags). Then Firestore -> dashboard.
// Below Firestore: location (2-stage), consolidate/redact, Gemma judge.
const NODES = {
  app: { x: 470, y: 430, w: 250, h: 130, work: "Disguised\nfood app", google: "Firebase\nHosting", c: COLORS.orange },
  live: { x: 900, y: 430, w: 320, h: 170, work: "Live AI call\nvoice + vision", google: "Gemini Live\n(3.8-live)", c: COLORS.gemini1 },
  store: { x: 1330, y: 430, w: 250, h: 130, work: "Structured\nincident data", google: "Cloud\nFirestore", c: COLORS.yellow },
  dash: { x: 1720, y: 430, w: 250, h: 130, work: "Responder\ndashboard", google: "Firebase\nHosting", c: COLORS.green },
  loc: { x: 1120, y: 770, w: 250, h: 120, work: "Location\n& route", google: "Nominatim /\nPhoton · OSRM", c: COLORS.blue },
  cons: { x: 1400, y: 770, w: 250, h: 120, work: "Consolidate\n& redact", google: "Flash-Lite\n(3.5 / 3.1)", c: COLORS.gemini2 },
  judge: { x: 1680, y: 770, w: 250, h: 120, work: "Validate\nevery run", google: "Gemma 4 31B\njudge", c: COLORS.red },
};

const FLIP = 600; // 20s — matches VO: the Gemini/Firebase tech line starts at ~0:20

const WAYS = ["Call to order", "Click & order", "Silent taps + photo", "Heart double-tap SOS"];

const GNode: React.FC<{ n: (typeof NODES)[keyof typeof NODES]; delay: number; activeFrom: number; big?: boolean }> = ({ n, delay, activeFrom, big }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const pop = interpolate(frame, [delay, delay + 18], [0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
  const pz = pulse(frame, activeFrom);
  const toG = interpolate(frame, [FLIP, FLIP + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const flip = interpolate(frame, [FLIP, FLIP + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div
      style={{
        position: "absolute",
        left: n.x - n.w / 2,
        top: n.y - n.h / 2,
        width: n.w,
        height: n.h,
        borderRadius: 18,
        background: COLORS.panel,
        border: `2.5px solid ${n.c}`,
        boxShadow: `0 0 ${26 + pz * 60}px ${n.c}${Math.round((0.3 + pz) * 180).toString(16).padStart(2, "0")}`,
        opacity: o,
        scale: String(pop + pz * 0.03),
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ gridArea: "1 / 1", opacity: 1 - toG, rotate: `x ${flip * 90}deg`, color: COLORS.text, fontSize: big ? SIZE.body : 32, fontWeight: 700, fontFamily: FONT, whiteSpace: "pre-line", lineHeight: 1.15 }}>
        {n.work}
      </div>
      <div style={{ gridArea: "1 / 1", opacity: toG, rotate: `x ${(1 - flip) * -90}deg`, color: n.c, fontSize: big ? SIZE.body : 32, fontWeight: 800, fontFamily: FONT, whiteSpace: "pre-line", lineHeight: 1.15 }}>
        {n.google}
      </div>
    </div>
  );
};

// a small floating tag attached under/over a node
const Tag: React.FC<{ x: number; y: number; label: string; c: string; delay: number; align?: "l" | "r" | "c" }> = ({ x, y, label, c, delay, align = "c" }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const ty = interpolate(frame, [delay, delay + 12], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: `${align === "c" ? "-50%" : align === "r" ? "-100%" : "0"} ${ty}px`,
        padding: "7px 14px",
        borderRadius: 999,
        background: `${c}22`,
        border: `1.5px solid ${c}`,
        color: COLORS.text,
        fontSize: 23,
        fontWeight: 600,
        fontFamily: FONT,
        opacity: o,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

export const Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const headWork = interpolate(frame, [FLIP - 10, FLIP + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headGoogle = interpolate(frame, [FLIP, FLIP + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kO = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: EASE });
  const sweepX = interpolate(frame, [FLIP - 6, FLIP + 22], [-200, 2100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const sweepO = interpolate(frame, [FLIP - 6, FLIP, FLIP + 22], [0, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      {/* header */}
      <div style={{ position: "absolute", left: 90, top: 70, opacity: kO }}>
        <div style={{ color: COLORS.orange, fontSize: 30, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT }}>How QuickBite works</div>
        <div style={{ position: "relative", height: 70, marginTop: 8, width: 1700 }}>
          <div style={{ position: "absolute", opacity: headWork, color: COLORS.text, fontSize: 56, fontWeight: 800, fontFamily: FONT }}>One disguised call → one live incident → responders</div>
          <div style={{ position: "absolute", opacity: headGoogle, color: COLORS.blue, fontSize: 52, fontWeight: 800, fontFamily: FONT }}>Gemini for intelligence · Firebase for realtime</div>
        </div>
      </div>

      {/* 4 ways in — a stacked column on the far left feeding the app node */}
      <WaysIn />

      {/* SVG links + packets */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Link a={NODES.app} b={NODES.live} />
        <Link a={NODES.live} b={NODES.store} />
        <Link a={NODES.store} b={NODES.dash} />
        <LinkV a={NODES.store} b={NODES.loc} />
        <LinkV a={NODES.store} b={NODES.cons} />
        <LinkV a={NODES.store} b={NODES.judge} />
        <Packets x1={NODES.app.x + 125} y1={NODES.app.y} x2={NODES.live.x - 160} y2={NODES.live.y} color={COLORS.gemini1} from={70} />
        <Packets x1={NODES.live.x + 160} y1={NODES.live.y} x2={NODES.store.x - 125} y2={NODES.store.y} color={COLORS.yellow} from={92} />
        <Packets x1={NODES.store.x + 125} y1={NODES.store.y} x2={NODES.dash.x - 125} y2={NODES.dash.y} color={COLORS.green} from={110} />
        <Packets x1={NODES.store.x} y1={NODES.store.y + 65} x2={NODES.loc.x} y2={NODES.loc.y - 60} color={COLORS.blue} from={140} count={2} />
        <Packets x1={NODES.store.x} y1={NODES.store.y + 65} x2={NODES.cons.x} y2={NODES.cons.y - 60} color={COLORS.gemini2} from={148} count={2} />
        <Packets x1={NODES.store.x} y1={NODES.store.y + 65} x2={NODES.judge.x} y2={NODES.judge.y - 60} color={COLORS.red} from={156} count={2} />
      </svg>

      {/* nodes */}
      <GNode n={NODES.app} delay={40} activeFrom={70} />
      <GNode n={NODES.live} delay={58} activeFrom={92} big />
      <GNode n={NODES.store} delay={78} activeFrom={110} />
      <GNode n={NODES.dash} delay={98} activeFrom={128} />
      <GNode n={NODES.loc} delay={132} activeFrom={150} />
      <GNode n={NODES.cons} delay={144} activeFrom={158} />
      <GNode n={NODES.judge} delay={156} activeFrom={166} />

      {/* Gemini Live capability tags (voice-stress, 12 tools, vision) — stacked below, centered */}
      <Tag x={NODES.live.x} y={NODES.live.y + 100} label="voice-stress / duress detection" c={COLORS.gemini1} delay={112} align="c" />
      <Tag x={NODES.live.x} y={NODES.live.y + 142} label="12 function-call tools (autonomous agent)" c={COLORS.gemini2} delay={120} align="c" />
      <Tag x={NODES.live.x} y={NODES.live.y - 128} label="+ Gemini Vision (silent photo)" c={COLORS.gemini1} delay={128} align="c" />

      {/* dashboard: 'alert at call START' tag */}
      <Tag x={NODES.dash.x} y={NODES.dash.y + 90} label="alert at call START" c={COLORS.green} delay={135} align="c" />
      {/* location 2-stage detail */}
      <Tag x={NODES.loc.x} y={NODES.loc.y + 78} label="GPS / IP → address → route to police / hospital" c={COLORS.blue} delay={160} align="c" />

      {/* flip sweep */}
      <div style={{ position: "absolute", left: sweepX, top: 0, width: 160, height: 1080, background: `linear-gradient(90deg, transparent, ${COLORS.blue}cc, transparent)`, opacity: sweepO, filter: "blur(6px)" }} />

      <FootNote />
    </AbsoluteFill>
  );
};

const WaysIn: React.FC = () => {
  const frame = useCurrentFrame();
  const headO = interpolate(frame, [14, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <>
      <div style={{ position: "absolute", left: 90, top: 340, color: COLORS.textDim, fontSize: 24, fontWeight: 700, fontFamily: FONT, letterSpacing: 1, opacity: headO }}>
        4 WAYS IN
      </div>
      {WAYS.map((w, i) => {
        const delay = 20 + i * 7;
        const o = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        const tx = interpolate(frame, [delay, delay + 12], [-24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        return (
          <div
            key={w}
            style={{
              position: "absolute",
              left: 90,
              top: 376 + i * 46,
              width: 250,
              padding: "8px 14px",
              borderRadius: 10,
              background: `${COLORS.orange}18`,
              border: `1.5px solid ${COLORS.orange}88`,
              color: COLORS.text,
              fontSize: 22,
              fontFamily: FONT,
              opacity: o,
              translate: `${tx}px 0`,
            }}
          >
            {w}
          </div>
        );
      })}
      {/* merge arrows into app node */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {WAYS.map((_, i) => {
          const y = 376 + i * 46 + 16;
          const o = interpolate(frame, [34 + i * 4, 46 + i * 4], [0, 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <path key={i} d={`M 345 ${y} C 400 ${y}, 345 430, 345 430`} fill="none" stroke={COLORS.orange} strokeWidth={2} opacity={o} />;
        })}
      </svg>
    </>
  );
};

const Link: React.FC<{ a: { x: number; y: number; w: number }; b: { x: number; y: number; w: number } }> = ({ a, b }) => (
  <line x1={a.x + a.w / 2} y1={a.y} x2={b.x - b.w / 2} y2={b.y} stroke={COLORS.panelLine} strokeWidth={3} opacity={0.6} />
);
const LinkV: React.FC<{ a: { x: number; y: number; h: number }; b: { x: number; y: number; h: number } }> = ({ a, b }) => (
  <path d={`M ${a.x} ${a.y + a.h / 2} C ${a.x} ${a.y + 130}, ${b.x} ${b.y - 130}, ${b.x} ${b.y - b.h / 2}`} fill="none" stroke={COLORS.panelLine} strokeWidth={3} opacity={0.5} />
);

const FootNote: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [175, 193], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div style={{ position: "absolute", bottom: 48, width: 1920, textAlign: "center", color: COLORS.textDim, fontSize: 26, fontFamily: FONT, opacity: o }}>
      Real-time listeners stream each field the instant Gemini extracts it — no custom socket server to run.
    </div>
  );
};
