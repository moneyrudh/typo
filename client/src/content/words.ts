import type { Action, Biome } from "../game/types";

// Every word must describe the move the runner actually performs, so pools are synonyms of
// the action. Lowercase a–z only. A word may appear in more than one pool (e.g. "hurdle").

export const CORE: Record<Action, string[]> = {
  // Running jump over a low obstacle.
  jump: [
    "jump", "hop", "leap", "bound", "spring", "bounce", "skip", "pounce", "hurdle", "soar",
    "clear", "launch", "boing",
  ],
  // Baseball slide under something low.
  slide: [
    "slide", "duck", "crouch", "slip", "skid", "glide", "scoot", "skim", "limbo", "stoop",
    "squat", "hunker", "dip", "lower", "skate", "slink",
  ],
  // Hands on the obstacle, legs swing over.
  vault: [
    "vault", "kong", "swing", "straddle", "scissor", "flip", "overleap", "leapfrog",
  ],
  // Jump at a wall, grab the ledge, pull up.
  climb: [
    "climb", "scale", "mount", "mantle", "ascend", "clamber", "scramble", "grab", "hoist",
    "shin", "pull", "haul", "rise",
  ],
  // Step off a ledge and land.
  drop: [
    "drop", "descend", "fall", "plunge", "dive", "sink", "alight", "land", "plop",
  ],
};

/** Longer / trickier synonyms, used once per run on the finale obstacle. */
export const TRICKY: Partial<Record<Action, string[]>> = {
  jump: ["catapult", "skyrocket", "springboard", "bunnyhop", "somersault", "leapfrog"],
  slide: ["hydroplane", "toboggan", "powerslide", "kneeslide", "slither"],
  vault: ["handspring", "somersault", "overleap", "springboard"],
  climb: ["mountaineer", "surmount", "clamber", "scramble", "boulder"],
};

/** Optional biome-flavoured synonyms (still must match the action). */
export const BIOME_EXTRAS: Record<Biome, Partial<Record<Action, string[]>>> = {
  city: {},
};

export function poolFor(action: Action, biome: Biome): string[] {
  return [...new Set([...CORE[action], ...(BIOME_EXTRAS[biome][action] ?? [])])];
}
