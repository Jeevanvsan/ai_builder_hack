import { Composition } from "remotion";
import { PitchVideo, PITCH_TOTAL } from "./PitchVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PitchVideo"
        component={PitchVideo}
        durationInFrames={PITCH_TOTAL}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
