// Shared design tokens for the QuickBite architecture motion graphic.
// QuickBite light brand (matches the deck / dashboard light theme), with Google accent colors.
export const COLORS = {
  bg: "#0B1020", // deep night (architecture reads better on dark for motion graphics)
  bgSoft: "#121a30",
  panel: "#18213b",
  panelLine: "#2a365c",
  text: "#F5F7FC",
  textDim: "#9FB0D0",
  // QuickBite orange + Google palette for the Gemini/Cloud bits
  orange: "#E8590C",
  blue: "#1A73E8",
  green: "#2F9E44",
  yellow: "#F9AB00",
  red: "#EA4335",
  gemini1: "#4285F4",
  gemini2: "#9B72F2",
};

export const FONT =
  '"Google Sans Flex", "Google Sans", "Segoe UI", system-ui, -apple-system, Arial, sans-serif';

// Sizes tuned for a 1920x1080 composition (scale text with width per layout rules)
export const SIZE = {
  title: 104,
  h2: 64,
  body: 44,
  label: 34,
  small: 28,
};
