import type { Action, Biome } from "../game/types";

// Word pools per action. Words only need to *feel* like the move — variety matters more
// than strict synonyms, so nobody can just memorise "jump". Lowercase a–z only.

type Pools = Partial<Record<Exclude<Action, "leap">, string[]>>;

export const CORE: Required<Pools> = {
  jump: [
    "jump", "hop", "leap", "bound", "spring", "bounce", "skip", "pounce", "soar", "rise",
    "lift", "launch", "fly", "boing", "ascend", "rocket", "up", "hup", "upward", "airborne",
    "elevate", "liftoff", "takeoff", "sky", "float", "lofty", "frog", "flea", "bunny", "kick",
    "pop", "spry", "zoom", "whoosh", "boost", "heave", "hoist", "jolt", "perk", "vaunt",
    "cloud", "orbit", "glide", "high", "upsy", "flutter", "bop", "jetpack", "pogo", "hurl",
  ],
  slide: [
    "slide", "duck", "crouch", "slip", "skid", "scoot", "dive", "drop", "dip", "low",
    "limbo", "squat", "stoop", "bend", "sweep", "swoop", "skate", "coast", "slither", "sneak",
    "crawl", "tuck", "hunker", "lean", "slink", "lower", "floor", "sink", "flat", "under",
    "belly", "glide", "sled", "skim", "snake", "zip", "whizz", "surf", "drift", "scurry",
    "kneel", "bow", "nod", "shrink", "squish", "squeeze", "lay", "hug", "slick", "smooth",
  ],
  vault: [
    "vault", "flip", "hurdle", "clamber", "swing", "flick", "roll", "tumble", "spin", "twist",
    "cartwheel", "kip", "palm", "push", "plant", "swivel", "pivot", "over", "fence", "scale",
    "clear", "arc", "loop", "whirl", "twirl", "cross", "hand", "grip", "brace", "spring",
    "lunge", "thrust", "pike", "split", "hurl", "rail", "step", "stride", "stunt", "trick",
    "swoosh", "dash", "dart", "zigzag", "weave", "scoop", "swerve", "flail", "monkey", "lemur",
  ],
};

export const BIOME_EXTRAS: Record<Biome, Pools> = {
  city: {
    jump: ["rooftop", "ledge", "skyline", "antenna", "chimney", "pigeon", "tower", "crane"],
    slide: ["alley", "gutter", "awning", "sewer", "tunnel", "manhole", "pavement", "kerb"],
    vault: ["railing", "bench", "curb", "hydrant", "taxi", "bollard", "scooter", "mailbox"],
  },
};

// One tricky, relatively long word per run (the finale).
export const TRICKY: string[] = [
  "somersault", "kerfuffle", "labyrinth", "rhythm", "bamboozle", "hullabaloo", "flabbergast",
  "skedaddle", "gymnastics", "trampoline", "pirouette", "mischievous", "quizzical",
  "zigzagging", "juxtapose", "acrobatics", "catapult", "parkour", "conundrum", "whirligig",
  "kaleidoscope", "hippopotamus", "rendezvous", "silhouette", "cacophony", "serendipity",
  "phenomenon", "boomerang", "xylophone", "synchronize", "choreography", "aerodynamic",
  "pneumatic", "quixotic", "mnemonic", "bureaucracy", "embarrass", "accommodate",
  "onomatopoeia", "chrysanthemum", "discombobulate", "gobbledygook", "lollygag", "persnickety",
  "rambunctious", "shenanigans", "brouhaha", "cattywampus", "nincompoop", "flibbertigibbet",
];

export function poolFor(action: Exclude<Action, "leap">, biome: Biome): string[] {
  const words = [...CORE[action], ...(BIOME_EXTRAS[biome][action] ?? [])];
  return [...new Set(words)];
}
