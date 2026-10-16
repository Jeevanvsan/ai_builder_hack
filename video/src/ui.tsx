import React from "react";
import { interpolate, Easing, useCurrentFrame } from "remotion";
import { COLORS, FONT, SIZE } from "./theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// Fade + rise in, driven by the local frame, starting at `delay`.
export const appear = (frame: number, delay: number, dur = 18) => ({
  opacity: interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  }),
  translateY: interpolate(frame, [delay, delay + dur], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  }),
});

export const Node: React.FC<{
  title: string;
  sub?: string;
  color: string;
  delay?: number;
  width?: number;
}> = ({ title, sub, color, delay = 0, width = 420 }) => {
  const frame = useCurrentFrame();
  const a = appear(frame, delay);
  return (
    <div
      style={{
        width,
        padding: "26px 30px",
        borderRadius: 20,
        background: COLORS.panel,
        border: `2px solid ${color}`,
        boxShadow: `0 0 40px ${color}33`,
        opacity: a.opacity,
        translate: `0 ${a.translateY}px`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ color, fontSize: SIZE.label, fontWeight: 700, fontFamily: FONT }}>
        {title}
      </div>
      {sub ? (
        <div style={{ color: COLORS.textDim, fontSize: SIZE.small, fontFamily: FONT, lineHeight: 1.25 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
};

// A horizontal connector that "draws" from left to right between `delay` frames.
export const Arrow: React.FC<{ delay?: number; color?: string; width?: number }> = ({
  delay = 0,
  color = COLORS.textDim,
  width = 90,
}) => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [delay, delay + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <div style={{ width, display: "flex", alignItems: "center" }}>
      <div style={{ height: 4, background: color, width: `${grow * 100}%`, borderRadius: 2 }} />
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: "9px solid transparent",
          borderBottom: "9px solid transparent",
          borderLeft: `14px solid ${color}`,
          opacity: grow > 0.85 ? 1 : 0,
        }}
      />
    </div>
  );
};

export const Pill: React.FC<{ label: string; color: string; delay?: number }> = ({
  label,
  color,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const a = appear(frame, delay, 12);
  return (
    <div
      style={{
        padding: "12px 22px",
        borderRadius: 999,
        background: `${color}22`,
        border: `1.5px solid ${color}`,
        color: COLORS.text,
        fontSize: SIZE.small,
        fontWeight: 600,
        fontFamily: FONT,
        opacity: a.opacity,
        translate: `0 ${a.translateY}px`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

export const Kicker: React.FC<{ text: string; color?: string }> = ({ text, color = COLORS.orange }) => (
  <div
    style={{
      color,
      fontSize: SIZE.label,
      fontWeight: 700,
      letterSpacing: 3,
      textTransform: "uppercase",
      fontFamily: FONT,
    }}
  >
    {text}
  </div>
);
