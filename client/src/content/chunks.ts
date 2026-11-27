import type { Biome, ObstacleKind } from "../game/types";

// A chunk is a short, hand-authored stretch of course. The generator strings chunks
// together and fills each slot with a word. `lead` adds extra run-up (game-seconds)
// before a slot on top of the minimum spacing the generator enforces.

export type ChunkSlot = {
  obstacles: ObstacleKind[]; // one is picked at random
  lead?: number;
};

export type Chunk = {
  id: string;
  biomes: Biome[];
  difficulty: 1 | 2 | 3;
  slots: ChunkSlot[];
};

const JUMP: ObstacleKind[] = ["crate", "barrier", "acunit"];
const SLIDE: ObstacleKind[] = ["beam", "sign"];
const VAULT: ObstacleKind[] = ["railing", "bench"];

export const CHUNKS: Chunk[] = [
  { id: "single_jump", biomes: ["city"], difficulty: 1, slots: [{ obstacles: JUMP, lead: 0.4 }] },
  { id: "single_slide", biomes: ["city"], difficulty: 1, slots: [{ obstacles: SLIDE, lead: 0.4 }] },
  { id: "single_vault", biomes: ["city"], difficulty: 1, slots: [{ obstacles: VAULT, lead: 0.4 }] },
  {
    id: "jump_slide",
    biomes: ["city"],
    difficulty: 1,
    slots: [{ obstacles: JUMP, lead: 0.3 }, { obstacles: SLIDE, lead: 0.2 }],
  },
  {
    id: "double_jump",
    biomes: ["city"],
    difficulty: 2,
    slots: [{ obstacles: JUMP }, { obstacles: JUMP }],
  },
  {
    id: "vault_slide",
    biomes: ["city"],
    difficulty: 2,
    slots: [{ obstacles: VAULT }, { obstacles: SLIDE }],
  },
  {
    id: "slide_vault_jump",
    biomes: ["city"],
    difficulty: 2,
    slots: [{ obstacles: SLIDE }, { obstacles: VAULT }, { obstacles: JUMP }],
  },
  {
    id: "rooftop_run",
    biomes: ["city"],
    difficulty: 3,
    slots: [{ obstacles: JUMP }, { obstacles: VAULT }, { obstacles: JUMP }],
  },
  {
    id: "gauntlet",
    biomes: ["city"],
    difficulty: 3,
    slots: [{ obstacles: SLIDE }, { obstacles: JUMP }, { obstacles: SLIDE }, { obstacles: VAULT }],
  },
];

/** Word length range used for each chunk difficulty. */
export const LENGTH_BY_DIFFICULTY: Record<1 | 2 | 3, [number, number]> = {
  1: [2, 5],
  2: [3, 6],
  3: [4, 8],
};
