import type { Results } from "../game/session";
import type { DailyMap } from "../game/types";
import { formatScore } from "./hud";
import { OUTCOME_EMOJI } from "./ratings";

const BIOME_EMOJI: Record<DailyMap["biome"], string> = { city: "🏙️" };

export function shareText(map: DailyMap, r: Results): string {
  const squares = r.outcomes
    .map((o, i) => {
      const tricky = map.slots[i].tricky;
      if (tricky) return o === "missed" ? "💥" : "⭐";
      return OUTCOME_EMOJI[o];
    })
    .join("");
  return [
    `typo #${map.day} ${BIOME_EMOJI[map.biome]}`,
    `${formatScore(r.score)}/${r.total} · ${Math.round(r.wpm)} wpm · ${Math.round(r.accuracy * 100)}%`,
    squares,
    "typo.bluedotstudios.io",
  ].join("\n");
}
