import React from "react";
import { interpolate, Easing, useCurrentFrame } from "remotion";
import { COLORS } from "./theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * A connector that first DRAWS itself (dash offset), then continuously sends
 * glowing data packets travelling along its path. SVG path-based so it works
 * for straight or curved links. Returns the two endpoints for node pulsing.
 */
export const FlowLink: React.FC<{
  d: string; // SVG path
  length: number; // approximate path length in px
  color: string;
  drawAt: number; // frame to start drawing
  packetsFrom: number; // frame to start sending packets
  packetCount?: number;
}> = ({ d, length, color, drawAt, packetsFrom, packetCount = 3 }) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [drawAt, drawAt + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <>
      {/* base line draws in */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeOpacity={0.45}
        strokeDasharray={length}
        strokeDashoffset={length * (1 - draw)}
        strokeLinecap="round"
      />
      {/* travelling packets */}
      {frame >= packetsFrom &&
        new Array(packetCount).fill(0).map((_, i) => {
          const period = 40;
          const t = ((frame - packetsFrom + (i * period) / packetCount) % period) / period;
          // fade each packet in/out at the ends
          const fade = Math.sin(t * Math.PI);
          return (
            <circle key={i} r={7} fill={color} opacity={fade}>
              <animateMotion dur="0.001s" />
            </circle>
          );
        })}
    </>
  );
};

/** Position a packet along a straight line manually (SMIL-free, render-safe). */
export const Packets: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  from: number;
  count?: number;
  period?: number;
}> = ({ x1, y1, x2, y2, color, from, count = 3, period = 34 }) => {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const t = (((frame - from) + (i * period) / count) % period) / period;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        const fade = Math.sin(t * Math.PI);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={9} fill={color} opacity={fade * 0.25} />
            <circle cx={x} cy={y} r={5} fill={color} opacity={fade} />
          </g>
        );
      })}
    </>
  );
};

/** A node that glows/pulses when a packet is "arriving" (repeating). */
export const pulse = (frame: number, activeFrom: number, period = 34) => {
  if (frame < activeFrom) return 0;
  const t = ((frame - activeFrom) % period) / period;
  return Math.max(0, Math.sin(t * Math.PI * 2)) * 0.6;
};

export { EASE };
