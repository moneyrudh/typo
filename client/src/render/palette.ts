import type { Biome } from "../game/types";

// Risograph-style palettes: a paper colour, a dark ink and a couple of spot inks.
export type Palette = {
  paper: number;
  paperDark: number;
  ink: number;
  spotA: number; // main spot ink
  spotB: number; // misregistration / accent ink
  muted: number;
};

export const PALETTES: Record<Biome, Palette> = {
  city: {
    paper: 0xf3e9d6,
    paperDark: 0xe4d6bd,
    ink: 0x231f2b,
    spotA: 0xf5c518,
    spotB: 0xff5a7d,
    muted: 0xa79d93,
  },
};

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Expose the palette to CSS so the DOM UI matches the canvas. */
export function applyPaletteToCss(p: Palette) {
  const root = document.documentElement.style;
  root.setProperty("--paper", hex(p.paper));
  root.setProperty("--paper-dark", hex(p.paperDark));
  root.setProperty("--ink", hex(p.ink));
  root.setProperty("--spot-a", hex(p.spotA));
  root.setProperty("--spot-b", hex(p.spotB));
  root.setProperty("--muted", hex(p.muted));
}
