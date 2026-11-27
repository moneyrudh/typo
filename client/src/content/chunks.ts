import type { Biome, ObstacleKind } from "../game/types";

// A chunk is a short, hand-authored stretch of course. The generator strings chunks
// together and fills each slot with a word. `lead` adds extra run-up (game-seconds)
// before a slot on top of the minimum spacing the generator enforces.
// Chunks must end at the elevation they start at: every "ledge" needs a matching "edge".

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
const UP: ChunkSlot = { obstacles: ["ledge"], lead: 0.2 };
const DOWN: ChunkSlot = { obstacles: ["edge"], lead: 0.15 };

export const CHUNKS: Chunk[] = [
  { id: "single_jump", biomes: ["city"], difficulty: 1, slots: [{ obstacles: JUMP, lead: 0.4 }] },
  { id: "single_slide", biomes: ["city"], difficulty: 1, slots: [{ obstacles: SLIDE, lead: 0.4 }] },
  { id: "single_vault", biomes: ["city"], difficulty: 1, slots: [{ obstacles: VAULT, lead: 0.4 }] },
  { id: "rooftop_quick", biomes: ["city"], difficulty: 1, slots: [UP, DOWN] },
  {
    id: "jump_slide",
    biomes: ["city"],
    difficulty: 1,
    slots: [{ obstacles: JUMP, lead: 0.3 }, { obstacles: SLIDE, lead: 0.2 }],
  },
  { id: "double_jump", biomes: ["city"], difficulty: 2, slots: [{ obstacles: JUMP }, { obstacles: JUMP }] },
  { id: "vault_slide", biomes: ["city"], difficulty: 2, slots: [{ obstacles: VAULT }, { obstacles: SLIDE }] },
  { id: "rooftop_hop", biomes: ["city"], difficulty: 2, slots: [UP, { obstacles: ["crate", "acunit"] }, DOWN] },
  { id: "rooftop_rail", biomes: ["city"], difficulty: 2, slots: [UP, { obstacles: ["railing"] }, DOWN] },
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
    slots: [UP, { obstacles: ["acunit", "crate"] }, { obstacles: SLIDE }, DOWN],
  },
  {
    id: "gauntlet",
    biomes: ["city"],
    difficulty: 3,
    slots: [{ obstacles: SLIDE }, { obstacles: JUMP }, { obstacles: VAULT }],
  },
  {
    id: "street_to_roof",
    biomes: ["city"],
    difficulty: 3,
    slots: [{ obstacles: VAULT }, UP, { obstacles: JUMP }, DOWN],
  },
];

/** Word length range used for each chunk difficulty. */
export const LENGTH_BY_DIFFICULTY: Record<1 | 2 | 3, [number, number]> = {
  1: [2, 5],
  2: [3, 6],
  3: [4, 8],
};
