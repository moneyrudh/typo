import type { Biome } from "../game/types";

// Risograph-style palettes: a paper colour, a dark ink and a couple of spot inks, plus a
// handful of material tints mixed from them for the 3D scene.
/** The hero's outfit — each biome can dress the runner differently. */
export type Outfit = {
  jacket: number;
  trim: number;
  pants: number;
  boots: number;
  soles: number;
  scarf: number;
  hair: number;
  gloves: number;
};

export type Palette = {
  paper: number;
  paperDark: number;
  ink: number;
  spotA: number; // main spot ink
  spotB: number; // misregistration / accent ink
  muted: number;
  sky: number;
  skin: number;
  wood: number;
  woodDark: number;
  metal: number;
  metalDark: number;
  brick: number;
  container: number;
  asphalt: number;
  window: number;
  buildings: number[];
  farBuildings: number[];
  skyline: [number, number];
  hero: Outfit;
};

export const PALETTES: Record<Biome, Palette> = {
  city: {
    paper: 0xf3e9d6,
    paperDark: 0xe4d6bd,
    ink: 0x231f2b,
    spotA: 0xf5c518,
    spotB: 0xff5a7d,
    muted: 0xa79d93,
    sky: 0xf6ead2,
    skin: 0xf6c48e,
    wood: 0xe9b44c,
    woodDark: 0xb9802f,
    metal: 0xc9c2b8,
    metalDark: 0x8f877e,
    brick: 0xe0705f,
    container: 0xff7d93,
    asphalt: 0x3a3540,
    window: 0x8fa6b3,
    buildings: [0xe9d9bb, 0xf3b9a6, 0xf2d27a, 0xd8cfc4, 0xffc2cd],
    farBuildings: [0xd9c7c0, 0xe3cfc6, 0xcfc0bb],
    skyline: [0xefc9c3, 0xe2c4bc],
    hero: {
      jacket: 0x2f3a62,
      trim: 0xf5c518,
      pants: 0x2c2934,
      boots: 0xf4efe4,
      soles: 0x231f2b,
      scarf: 0xff4f6d,
      hair: 0x1d1a26,
      gloves: 0x231f2b,
    },
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
