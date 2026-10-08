import React from "react";
import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  Interactive,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { FPS, TOTAL_SECONDS, VOICE_SPEED, VOICE_START, VOICE_TRIM_SECONDS, sec, span, stretch } from "./timing";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "800", "900"], subsets: ["latin"] });

// Brand motion identity (motion-design skill): one signature curve for most moves, one exit curve, one pop for the
// reveal only. Entrances rise + fade from their own layout slot; exits accelerate away.
const IN = Easing.bezier(0.2, 0, 0, 1);
const OUT = Easing.bezier(0.3, 0, 1, 1);
const POP = Easing.bezier(0.34, 1.56, 0.64, 1);
const GENTLE = Easing.bezier(0.4, 0, 0.2, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const C = {
  bg: "#0b0f17",
  ink: "#f6f2ec",
  dim: "#9aa3b2",
  brand: "#e4572e",
  brand2: "#ff8a5c",
  danger: "#ef4444",
  ok: "#22c55e",
  route: "#3b82f6",
  card: "rgba(255,255,255,0.06)",
  line: "rgba(255,255,255,0.14)",
};

// voiceover: an MP3 in public/ (e.g. "voiceover.mp3"). bgVideo: a clip in public/ (e.g. "intro-bg.mp4") played,
// darkened, with its own sound at full volume, behind the first BG_VIDEO_SECONDS (hook + problem).
export type IntroProps = { voiceover: string | null; bgVideo: string | null };
const BG_VIDEO_SECONDS = 20; // = the clip length; QuickBite is revealed right after

export const MyComposition = () => (
  <Composition
    id="QuickBiteIntro"
    component={QuickBiteIntro}
    durationInFrames={sec(TOTAL_SECONDS)}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{ voiceover: "voiceover.mp3", bgVideo: "intro-bg.mp4" }}
  />
);

export const QuickBiteIntro: React.FC<IntroProps> = ({ voiceover, bgVideo }) => (
  <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily, color: C.ink }}>
    {bgVideo ? (
      <Sequence name="Background video" durationInFrames={sec(BG_VIDEO_SECONDS)}>
        <BackgroundVideo src={bgVideo} />
      </Sequence>
    ) : null}
    <Sequence name="Hook: someone is inside" {...span("hook")}>
      <Hook withVideo={Boolean(bgVideo)} />
    </Sequence>
    <Sequence name="Problem" {...span("problem")}>
      <Problem withVideo={Boolean(bgVideo)} />
    </Sequence>
    <Sequence name="Legacy systems" {...span("legacy")}>
      <Legacy withVideo={Boolean(bgVideo)} />
    </Sequence>
    <Sequence name="Reveal: QuickBite" {...span("reveal")}>
      <Reveal />
    </Sequence>
    <Sequence name="The app" {...span("app")}>
      <AppScene />
    </Sequence>
    <Sequence name="The dashboard" {...span("dashboard")}>
      <Dashboard />
    </Sequence>
    <Sequence name="Close" {...span("close")}>
      <Close />
    </Sequence>
    {voiceover ? (
      <Sequence name="Voiceover" from={sec(VOICE_START)} layout="none">
        <Audio src={staticFile(voiceover)} trimBefore={sec(VOICE_TRIM_SECONDS)} playbackRate={VOICE_SPEED} />
      </Sequence>
    ) : null}
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ shared layers */

// Ambient layer: a slowly drifting glow, a vignette and light grain, so no frame is ever static.
const Ambient: React.FC<{ tint: string; strength?: number }> = ({ tint, strength = 0.22 }) => {
  const frame = useCurrentFrame();
  const x = 50 + Math.sin(frame / 80) * 14;
  const y = 42 + Math.cos(frame / 95) * 10;
  const a = Math.round(strength * 255).toString(16).padStart(2, "0");
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${tint}${a} 0%, transparent 60%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.65) 100%)" }} />
      <AbsoluteFill
        style={{
          opacity: 0.06,
          backgroundImage: `repeating-linear-gradient(${(frame * 37) % 180}deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 3px)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Every scene leaves the same way: a quick accelerating fade + slight push in.
const SceneOut: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(frame, [dur - 10, dur], [1, 0], { ...clamp, easing: OUT }),
        scale: interpolate(frame, [dur - 10, dur], [1, 1.04], { ...clamp, easing: OUT }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Eyebrow: React.FC<{ text: string; color: string; at?: number }> = ({ text, color, at = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name={`Eyebrow: ${text}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        opacity: interpolate(frame, [at, at + 15], [0, 1], { ...clamp, easing: IN }),
        translate: interpolate(frame, [at, at + 15], ["-24px 0px", "0px 0px"], { ...clamp, easing: IN }),
      }}
    >
      <div style={{ height: 4, borderRadius: 2, background: color, width: interpolate(frame, [at, at + 20], [0, 64], { ...clamp, easing: IN }) }} />
      <div style={{ color, fontSize: 34, fontWeight: 800, letterSpacing: "0.24em" }}>{text}</div>
    </Interactive.Div>
  );
};

const BackgroundVideo: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const end = sec(BG_VIDEO_SECONDS);
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, 12, end - 15, end], [0, 1, 1, 0], clamp) }}>
      <Video src={staticFile(src)} volume={1} style={{ width: "100%", height: "100%", objectFit: "cover", scale: interpolate(frame, [0, end], [1, 1.08], clamp) }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,10,16,0.25) 0%, rgba(8,10,16,0.35) 45%, rgba(8,10,16,0.9) 100%)" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 1. hook */

const Hook: React.FC<{ withVideo: boolean }> = ({ withVideo }) => {
  const frame = useCurrentFrame() * stretch("hook");
  const dur = span("hook").durationInFrames;
  const doorOpen = interpolate(frame, [105, 150], [0, 1], { ...clamp, easing: GENTLE });
  const shake = frame > 175 && frame < 195 ? Math.sin(frame * 2.2) * 6 : 0;
  return (
    <SceneOut dur={dur}>
      {withVideo ? null : <Ambient tint="#3b5bdb" strength={0.16} />}
      {withVideo ? null : <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, rgba(239,68,68,${0.28 * doorOpen}) 0%, transparent 45%)` }} />}
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: withVideo ? "flex-end" : "center", gap: withVideo ? 20 : 48, paddingBottom: withVideo ? 110 : 0 }}>
        <Interactive.Div
          name="Clock 10:00 PM"
          style={{
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: C.dim,
            fontVariantNumeric: "tabular-nums",
            opacity: interpolate(frame, [0, 20], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [0, 20], ["0px 20px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          10:00 <span style={{ opacity: Math.floor(frame / 15) % 2 ? 0.3 : 1 }}>PM</span>
        </Interactive.Div>

        {/* The front door: frame, light spilling in as it swings open (hidden when the real clip plays). */}
        <div style={{ display: withVideo ? "none" : "block", position: "relative", width: 300, height: 420, perspective: 900, opacity: interpolate(frame, [10, 35], [0, 1], { ...clamp, easing: IN }) }}>
          <div style={{ position: "absolute", inset: 0, border: `6px solid ${C.line}`, borderRadius: 8 }} />
          <div
            style={{
              position: "absolute",
              inset: 6,
              background: `linear-gradient(90deg, rgba(255,190,120,${0.9 * doorOpen}), rgba(239,68,68,${0.5 * doorOpen}))`,
              filter: "blur(2px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 6,
              background: "linear-gradient(160deg, #2a3242, #161b26)",
              borderRadius: 4,
              transformOrigin: "left center",
              transform: `rotateY(${-72 * doorOpen}deg)`,
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ position: "absolute", right: 26, top: "50%", width: 18, height: 18, borderRadius: 9, background: "#c9a227" }} />
          </div>
          {/* Shadow of the intruder in the light. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 6,
              width: 90,
              height: 250,
              translate: `-50% 0px`,
              borderRadius: "45px 45px 10px 10px",
              background: "#05070b",
              opacity: interpolate(frame, [150, 175], [0, 0.95], { ...clamp, easing: IN }),
              scale: interpolate(frame, [150, 200], [0.9, 1.05], { ...clamp, easing: GENTLE }),
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, minHeight: 210 }}>
          <Interactive.Div
            name="Priya is alone at home"
            style={{
              fontSize: 76,
              fontWeight: 600,
              opacity: interpolate(frame, [40, 58], [0, 1], { ...clamp, easing: IN }),
              translate: interpolate(frame, [40, 58], ["0px 24px", "0px 0px"], { ...clamp, easing: IN }),
            }}
          >
            Priya is alone at home.
          </Interactive.Div>
          <Interactive.Div
            name="Someone is inside"
            style={{
              fontSize: 104,
              fontWeight: 900,
              color: C.danger,
              opacity: interpolate(frame, [170, 182], [0, 1], { ...clamp, easing: IN }),
              translate: `${shake}px ${interpolate(frame, [170, 182], [20, 0], { ...clamp, easing: IN })}px`,
            }}
          >
            Someone is inside.
          </Interactive.Div>
        </div>
      </AbsoluteFill>
    </SceneOut>
  );
};

/* ------------------------------------------------------------------ 2. problem */

const Problem: React.FC<{ withVideo: boolean }> = ({ withVideo }) => {
  const frame = useCurrentFrame() * stretch("problem");
  const dur = span("problem").durationInFrames;
  const count = Math.round(interpolate(frame, [95, 170], [0, 445256], { ...clamp, easing: IN }));
  return (
    <SceneOut dur={dur}>
      {withVideo ? <AbsoluteFill style={{ background: "rgba(8,10,16,0.72)" }} /> : <Ambient tint={C.danger} strength={0.14} />}
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 180px", gap: 40 }}>
        <Eyebrow text="THE PROBLEM" color={C.danger} />
        <Interactive.Div
          name="Asking for help can make it worse"
          style={{
            fontSize: 104,
            fontWeight: 800,
            lineHeight: 1.05,
            maxWidth: 1400,
            opacity: interpolate(frame, [12, 30], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [12, 30], ["0px 30px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          When danger is in the same room, <span style={{ color: C.danger }}>asking for help can make it worse.</span>
        </Interactive.Div>

        <Interactive.Div
          name="NCRB stat"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 36,
            marginTop: 30,
            opacity: interpolate(frame, [85, 100], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [85, 100], ["0px 24px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          <div style={{ fontSize: 180, fontWeight: 900, color: C.brand, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
            {count.toLocaleString("en-IN")}+
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 48, fontWeight: 600 }}>crimes against women in India, in one year</div>
            <div style={{ fontSize: 30, color: C.dim }}>Source: NCRB, Crime in India 2022</div>
          </div>
        </Interactive.Div>

        <Interactive.Div
          name="Victims cannot speak freely"
          style={{
            fontSize: 56,
            fontWeight: 600,
            color: C.dim,
            opacity: interpolate(frame, [215, 235], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [215, 235], ["0px 20px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          And many victims <span style={{ color: C.ink }}>cannot speak freely</span> when it matters most.
        </Interactive.Div>
      </AbsoluteFill>
    </SceneOut>
  );
};

/* ------------------------------------------------------------------ 3. legacy systems */

const LEGACY = [
  { at: 45, icon: "📞", title: "A 112 call", verdict: "Heard by the attacker" },
  { at: 105, icon: "🚨", title: "SOS apps", verdict: "Obvious on screen" },
  { at: 165, icon: "📍", title: "Panic buttons", verdict: "Location only. No context." },
];

const Legacy: React.FC<{ withVideo: boolean }> = ({ withVideo }) => {
  const frame = useCurrentFrame() * stretch("legacy");
  const dur = span("legacy").durationInFrames;
  const blind = 265;
  const dimCards = interpolate(frame, [blind, blind + 15], [1, 0.12], { ...clamp, easing: IN });
  const blurCards = interpolate(frame, [blind, blind + 15], [0, 10], { ...clamp, easing: IN });
  return (
    <SceneOut dur={dur}>
      {withVideo ? <AbsoluteFill style={{ background: "rgba(8,10,16,0.78)" }} /> : <Ambient tint="#64748b" strength={0.14} />}
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 180px", gap: 44 }}>
        <Eyebrow text="LEGACY SYSTEMS FAIL THEM" color={C.danger} />
        <div style={{ display: "flex", flexDirection: "column", gap: 28, opacity: dimCards, filter: `blur(${blurCards}px)` }}>
          {LEGACY.map((l) => (
            <Interactive.Div
              key={l.title}
              name={`Legacy: ${l.title}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 40,
                padding: "30px 44px",
                borderRadius: 24,
                background: C.card,
                border: `1px solid ${C.line}`,
                opacity: interpolate(frame, [l.at, l.at + 15], [0, 1], { ...clamp, easing: IN }),
                translate: interpolate(frame, [l.at, l.at + 15], ["60px 0px", "0px 0px"], { ...clamp, easing: IN }),
              }}
            >
              <div style={{ fontSize: 76, width: 100, textAlign: "center" }}>{l.icon}</div>
              <div style={{ position: "relative", fontSize: 64, fontWeight: 800, width: 560 }}>
                {l.title}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "54%",
                    height: 7,
                    borderRadius: 4,
                    background: C.danger,
                    width: `${interpolate(frame, [l.at + 22, l.at + 36], [0, 92], { ...clamp, easing: IN })}%`,
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 600,
                  color: C.danger,
                  opacity: interpolate(frame, [l.at + 30, l.at + 44], [0, 1], { ...clamp, easing: IN }),
                  translate: interpolate(frame, [l.at + 30, l.at + 44], ["0px 16px", "0px 0px"], { ...clamp, easing: IN }),
                }}
              >
                ✕ {l.verdict}
              </div>
            </Interactive.Div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Interactive.Div
          name="Responders arrive blind"
          style={{
            fontSize: 140,
            fontWeight: 900,
            textShadow: "0 10px 60px rgba(0,0,0,0.8)",
            opacity: interpolate(frame, [blind, blind + 18], [0, 1], { ...clamp, easing: IN }),
            scale: interpolate(frame, [blind, blind + 18], [1.12, 1], { ...clamp, easing: IN }),
          }}
        >
          Responders arrive <span style={{ color: C.danger }}>blind.</span>
        </Interactive.Div>
      </AbsoluteFill>
    </SceneOut>
  );
};

/* ------------------------------------------------------------------ 4. reveal */

const Logo: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      background: `linear-gradient(145deg, ${C.brand2}, ${C.brand})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.42,
      fontWeight: 900,
      color: "#fff",
      boxShadow: `0 ${size * 0.12}px ${size * 0.5}px rgba(228,87,46,0.45)`,
    }}
  >
    QB
  </div>
);

const Reveal = () => {
  const frame = useCurrentFrame();
  const dur = span("reveal").durationInFrames;
  return (
    <SceneOut dur={dur}>
      <AbsoluteFill style={{ background: C.bg }} />
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 100,
            background: `radial-gradient(circle, ${C.brand} 0%, rgba(228,87,46,0.0) 70%)`,
            scale: interpolate(frame, [0, 30], [0, 9], { ...clamp, easing: IN }),
            opacity: interpolate(frame, [0, 10, 40], [0, 0.9, 0.35], clamp),
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
        <Interactive.Div name="Logo" style={{ scale: interpolate(frame, [4, 22], [0, 1], { ...clamp, easing: POP }) }}>
          <Logo size={200} />
        </Interactive.Div>
        <Interactive.Div
          name="QuickBite wordmark"
          style={{
            fontSize: 150,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            opacity: interpolate(frame, [14, 30], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [14, 30], ["0px 30px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          QuickBite
        </Interactive.Div>
      </AbsoluteFill>
    </SceneOut>
  );
};

/* ------------------------------------------------------------------ 5. the app */

const FEATURES = [
  { at: 215, icon: "📷", text: "Reads the camera" },
  { at: 245, icon: "🗣️", text: "Speaks the caller's language" },
  { at: 275, icon: "🏠", text: "Confirms the exact address" },
  { at: 305, icon: "🧭", text: "Guides to the nearest police station" },
];

const AppScene = () => {
  const frame = useCurrentFrame();
  const dur = span("app").durationInFrames;
  const pick = 120; // "Extra spicy" moment
  return (
    <SceneOut dur={dur}>
      <Ambient tint={C.brand} strength={0.2} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 140, padding: "0 160px" }}>
        {/* Phone */}
        <Interactive.Div
          name="Phone mockup"
          style={{
            width: 440,
            height: 880,
            borderRadius: 64,
            padding: 18,
            background: "#11151d",
            border: "2px solid rgba(255,255,255,0.18)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
            opacity: interpolate(frame, [0, 20], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [0, 20], ["-80px 0px", "0px 0px"], { ...clamp, easing: IN }),
            rotate: `${Math.sin(frame / 50) * 1.2}deg`,
          }}
        >
          {/* Real app screens (landing/public/shots): the home menu scrolls, then the coded item sheet opens. */}
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 48, overflow: "hidden", background: "#fff7f2" }}>
            <Img
              src={staticFile("screens/qb-home.png")}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                translate: interpolate(frame, [20, pick], ["0px 0px", "0px -28px"], { ...clamp, easing: GENTLE }),
                opacity: interpolate(frame, [pick, pick + 12], [1, 0], clamp),
              }}
            />
            <Img
              src={staticFile("screens/qb-item.png")}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                opacity: interpolate(frame, [pick, pick + 12], [0, 1], { ...clamp, easing: IN }),
                translate: interpolate(frame, [pick, pick + 16], ["0px 70px", "0px 0px"], { ...clamp, easing: IN }),
              }}
            />
          </div>
        </Interactive.Div>

        {/* Message column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 34, width: 980 }}>
          <Interactive.Div
            name="Every order is a silent emergency call"
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.08,
              opacity: interpolate(frame, [10, 28], [0, 1], { ...clamp, easing: IN }),
              translate: interpolate(frame, [10, 28], ["0px 26px", "0px 0px"], { ...clamp, easing: IN }),
            }}
          >
            Every order is a <span style={{ color: C.brand2 }}>silent emergency call.</span>
          </Interactive.Div>

          <Interactive.Div
            name="Code meaning"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              fontSize: 50,
              fontWeight: 700,
              opacity: interpolate(frame, [pick + 6, pick + 20], [0, 1], { ...clamp, easing: IN }),
              translate: interpolate(frame, [pick + 6, pick + 20], ["0px 20px", "0px 0px"], { ...clamp, easing: IN }),
            }}
          >
            <span style={{ padding: "12px 26px", borderRadius: 999, background: C.brand, whiteSpace: "nowrap" }}>"Extra spicy"</span>
            <span style={{ color: C.dim }}>=</span>
            <span style={{ color: C.danger, whiteSpace: "nowrap" }}>"I'm being threatened"</span>
          </Interactive.Div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 10 }}>
            <div style={{ fontSize: 34, color: C.dim, fontWeight: 600, opacity: interpolate(frame, [190, 205], [0, 1], clamp) }}>
              Mia, our Gemini-powered agent:
            </div>
            {FEATURES.map((ft) => (
              <Interactive.Div
                key={ft.text}
                name={`Feature: ${ft.text}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  fontSize: 46,
                  fontWeight: 600,
                  opacity: interpolate(frame, [ft.at, ft.at + 12], [0, 1], { ...clamp, easing: IN }),
                  translate: interpolate(frame, [ft.at, ft.at + 12], ["40px 0px", "0px 0px"], { ...clamp, easing: IN }),
                }}
              >
                <span style={{ width: 60, textAlign: "center" }}>{ft.icon}</span>
                {ft.text}
              </Interactive.Div>
            ))}
          </div>

          <Interactive.Div
            name="Under 3 minutes badge"
            style={{
              alignSelf: "flex-start",
              marginTop: 10,
              padding: "16px 34px",
              borderRadius: 999,
              border: `2px solid ${C.ok}`,
              color: C.ok,
              fontSize: 44,
              fontWeight: 800,
              opacity: interpolate(frame, [345, 357], [0, 1], { ...clamp, easing: IN }),
              scale: interpolate(frame, [345, 360], [0.6, 1], { ...clamp, easing: POP }),
            }}
          >
            ⏱ Under 3 minutes
          </Interactive.Div>
        </div>
      </AbsoluteFill>
    </SceneOut>
  );
};

/* ------------------------------------------------------------------ 6. dashboard */

const PANELS = [
  { at: 40, label: "Live location", color: C.route },
  { at: 70, label: "Threat level", color: C.danger },
  { at: 100, label: "Scene sketch", color: C.brand2 },
  { at: 130, label: "Case report for police", color: C.ok },
];

const Dashboard = () => {
  const frame = useCurrentFrame();
  const dur = span("dashboard").durationInFrames;
  return (
    <SceneOut dur={dur}>
      <Ambient tint={C.route} strength={0.18} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 36 }}>
        <Interactive.Div
          name="Responders see it all live"
          style={{
            fontSize: 88,
            fontWeight: 800,
            opacity: interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [0, 16], ["0px 24px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          Responders see it all, <span style={{ color: C.route }}>live.</span>
        </Interactive.Div>

        <Interactive.Div
          name="Dashboard screens"
          style={{
            width: 1500,
            height: 640,
            borderRadius: 24,
            background: "#ffffff",
            border: `1px solid ${C.line}`,
            boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            opacity: interpolate(frame, [10, 28], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [10, 28], ["0px 50px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          <div style={{ height: 44, background: "#e9ecf1", display: "flex", alignItems: "center", gap: 10, padding: "0 18px" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
            ))}
            <div style={{ marginLeft: 18, fontSize: 20, color: "#5b6472" }}>quickbite-dashboard.web.app</div>
          </div>
          <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
            {/* Live queue first, then the incident view, slowly pushing in on the map and threat card. */}
            <Img
              src={staticFile("screens/queue.png")}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", opacity: interpolate(frame, [60, 74], [1, 0], clamp) }}
            />
            <Img
              src={staticFile("screens/responder.png")}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
                transformOrigin: "35% 55%",
                opacity: interpolate(frame, [60, 74], [0, 1], { ...clamp, easing: IN }),
                scale: interpolate(frame, [60, 210], [1, 1.14], { ...clamp, easing: GENTLE }),
              }}
            />
          </div>
        </Interactive.Div>

        <div style={{ display: "flex", flexDirection: "row", gap: 22 }}>
          {PANELS.map((p) => (
            <Interactive.Div
              key={p.label}
              name={`Callout: ${p.label}`}
              style={{
                padding: "14px 28px",
                borderRadius: 999,
                background: C.card,
                border: `2px solid ${p.color}`,
                fontSize: 32,
                fontWeight: 800,
                color: p.color,
                opacity: interpolate(frame, [p.at, p.at + 12], [0, 1], { ...clamp, easing: IN }),
                translate: interpolate(frame, [p.at, p.at + 12], ["0px 20px", "0px 0px"], { ...clamp, easing: IN }),
              }}
            >
              {p.label}
            </Interactive.Div>
          ))}
        </div>
      </AbsoluteFill>
    </SceneOut>
  );
};

/* ------------------------------------------------------------------ 7. close */

const Close = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Ambient tint={C.brand} strength={0.26} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
        <Interactive.Div name="Close logo" style={{ scale: interpolate(frame, [0, 18], [0, 1], { ...clamp, easing: POP }), marginBottom: 20 }}>
          <Logo size={150} />
        </Interactive.Div>
        <Interactive.Div
          name="A food order outside"
          style={{
            fontSize: 108,
            fontWeight: 800,
            opacity: interpolate(frame, [20, 36], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [20, 36], ["0px 24px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          A food order outside.
        </Interactive.Div>
        <Interactive.Div
          name="A lifeline inside"
          style={{
            fontSize: 108,
            fontWeight: 900,
            color: C.brand2,
            opacity: interpolate(frame, [62, 78], [0, 1], { ...clamp, easing: IN }),
            translate: interpolate(frame, [62, 78], ["0px 24px", "0px 0px"], { ...clamp, easing: IN }),
          }}
        >
          A lifeline inside.
        </Interactive.Div>
        <div style={{ fontSize: 32, color: C.dim, marginTop: 30, opacity: interpolate(frame, [95, 110], [0, 1], clamp) }}>
          Built with Gemini Live · Team NexMind
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
