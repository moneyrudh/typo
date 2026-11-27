import type { Rng } from "../engine/rng";
import type { ObstacleKind, Platform, Slot } from "../game/types";

// Obstacle shapes are fixed by gameplay; their looks vary. The daily map picks a skin per
// obstacle (and per container segment), so every player sees the same street that day.
// This file is the catalogue the generator draws from; render/skins.ts draws each entry.
// Printed text must never be a typable word, so it can't be mistaken for the prompt.

export type SignSkin = { text: string; small?: string; style: "warning" | "notice" | "road" | "shop" | "neon" | "rusty" };
export const SIGN_SKINS: SignSkin[] = [
  { text: "LOW", style: "warning" },
  { text: "MIND YOUR HEAD", style: "notice" },
  { text: "1.9 m", small: "CLEARANCE", style: "road" },
  { text: "NOODLES", small: "ラーメン", style: "shop" },
  { text: "OPEN 24H", style: "neon" },
  { text: "", style: "rusty" },
];

export type ContainerSkin =
  | { style: "plain" }
  | { style: "rust" }
  | { style: "brand"; text: string; code: string }
  | { style: "graffiti"; text: string }
  | { style: "posters" };
export const CONTAINER_SKINS: ContainerSkin[] = [
  { style: "plain" },
  { style: "rust" },
  { style: "brand", text: "KOBO LINES", code: "KBLU 402117" },
  { style: "brand", text: "ORCA", code: "ORC 88 13 0" },
  { style: "graffiti", text: "ZAP" },
  { style: "graffiti", text: "RISO" },
  { style: "posters" },
];

export const CRATE_SKINS = ["pine", "fragile", "painted", "upright"] as const;
export const BARRIER_SKINS = ["pink", "hazard", "orange", "police"] as const;
export const BEAM_SKINS = ["pink", "oxide", "steel", "safety"] as const;
export const BENCH_SKINS = ["wood", "park", "red", "blue"] as const;
export const RAILING_SKINS = ["yellow", "grey", "blue"] as const;

/** How many skins each obstacle kind has; 1 means it always looks the same. */
export const SKIN_COUNT: Record<ObstacleKind, number> = {
  crate: CRATE_SKINS.length,
  barrier: BARRIER_SKINS.length,
  acunit: 1,
  beam: BEAM_SKINS.length,
  sign: SIGN_SKINS.length,
  railing: RAILING_SKINS.length,
  bench: BENCH_SKINS.length,
  ledge: 1,
  edge: 1,
};

/** Every string printed on a skin (checked against the word pools). */
export const SKIN_TEXT: string[] = [
  ...SIGN_SKINS.flatMap((s) => [s.text, s.small ?? ""]),
  ...CONTAINER_SKINS.flatMap((s) => ("text" in s ? [s.text] : [])),
  "FRAGILE",
  "THIS WAY UP",
].filter(Boolean);

/** Platforms are built from container segments of roughly this length. */
export const CONTAINER_LEN = 240;
export const segmentsFor = (pf: Platform) => Math.max(1, Math.round((pf.x1 - pf.x0) / CONTAINER_LEN));

/** Pick today's skins. Avoids the same look twice in a row for each kind. */
export function assignSkins(rng: Rng, slots: Slot[], platforms: Platform[]) {
  const last = new Map<string, number>();
  const pick = (key: string, count: number) => {
    if (count <= 1) return 0;
    const prev = last.get(key);
    let i = rng.int(0, count - 1);
    if (i === prev) i = (i + 1 + rng.int(0, count - 2)) % count;
    last.set(key, i);
    return i;
  };
  for (const s of slots) s.skin = pick(s.obstacle, SKIN_COUNT[s.obstacle]);
  for (const pf of platforms) {
    pf.skins = Array.from({ length: segmentsFor(pf) }, () => pick("container", CONTAINER_SKINS.length));
  }
}
