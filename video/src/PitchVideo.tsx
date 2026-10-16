import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { Background } from "./Background";
import { Architecture } from "./scenes/Architecture";
import { AiDecides } from "./scenes/AiDecides";
import { UseCases } from "./scenes/UseCases";
import { Integrations } from "./scenes/Integrations";
import { Roadmap } from "./scenes/Roadmap";
import { GoogleProposal } from "./scenes/GoogleProposal";

// Scene durations (frames @ 30fps). Overlap-free; each fades at its own edges.
const SCENES: { comp: React.FC; dur: number; name: string }[] = [
  // Durations matched to the actual voiceover.mp3 scene boundaries:
  // S1 0:00-0:26 · S2 0:26-0:50 · S3 0:50-0:58 · S4 0:58-1:08 · S5 1:08-1:21 · S6 1:21-1:38
  { comp: Architecture, dur: 780, name: "Architecture" }, // 0:00–0:26 (26s)
  { comp: AiDecides, dur: 720, name: "AiDecides" }, // 0:26–0:50 (24s)
  { comp: UseCases, dur: 240, name: "UseCases" }, // 0:50–0:58 (8s)
  { comp: Integrations, dur: 300, name: "Integrations" }, // 0:58–1:08 (10s)
  { comp: Roadmap, dur: 390, name: "Roadmap" }, // 1:08–1:21 (13s)
  { comp: GoogleProposal, dur: 510, name: "GoogleProposal" }, // 1:21–1:38 (17s)
];

const FADE = 18;

const SceneWrap: React.FC<{ children: React.ReactNode; dur: number }> = ({ children, dur }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, FADE, dur - FADE, dur],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const PitchVideo: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill>
      <Audio src={staticFile("voiceover.mp3")} />
      <Background />
      {SCENES.map((s) => {
        const start = from;
        from += s.dur;
        const C = s.comp;
        return (
          <Sequence key={s.name} name={s.name} from={start} durationInFrames={s.dur}>
            <SceneWrap dur={s.dur}>
              <C />
            </SceneWrap>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const PITCH_TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
