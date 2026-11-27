import type { SlotOutcome } from "../game/types";

export const OUTCOME_LABEL: Record<SlotOutcome, string> = {
  perfect: "PERFECT!",
  great: "GREAT!",
  nice: "NICE",
  phew: "PHEW!",
  missed: "MISS",
};

export const OUTCOME_EMOJI: Record<SlotOutcome, string> = {
  perfect: "🟩",
  great: "🟦",
  nice: "🟨",
  phew: "🟧",
  missed: "🟥",
};
