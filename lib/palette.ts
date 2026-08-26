export type Palette = "green" | "red" | "gold" | "teal";

export const paletteGradient: Record<Palette, string> = {
  green: "linear-gradient(135deg, #004a37 0%, #006a4e 55%, #0e8a64 100%)",
  red: "linear-gradient(135deg, #a3172a 0%, #f42a41 60%, #ff6b5e 100%)",
  gold: "linear-gradient(135deg, #8a5a10 0%, #c98a1b 55%, #e8b64c 100%)",
  teal: "linear-gradient(135deg, #063f3c 0%, #0e7d78 55%, #35a89f 100%)",
};

export const paletteSoft: Record<Palette, string> = {
  green: "#e3efe9",
  red: "#fbe5e7",
  gold: "#f7edd8",
  teal: "#e0efee",
};

export const paletteText: Record<Palette, string> = {
  green: "#006a4e",
  red: "#c71f33",
  gold: "#8a5a10",
  teal: "#0e7d78",
};
