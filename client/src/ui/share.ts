import type { Results } from "../game/session";
import type { DailyMap } from "../game/types";

const BIOME_EMOJI: Record<DailyMap["biome"], string> = { city: "🏙️" };

export function shareText(map: DailyMap, r: Results): string {
  const squares = r.outcomes
    .map((o, i) => {
      const tricky = map.slots[i].tricky;
      if (tricky) return o === "missed" ? "💥" : "⭐";
      return o === "perfect" ? "🟩" : o === "clean" ? "🟨" : "🟥";
    })
    .join("");
  return [
    `typo #${map.day} ${BIOME_EMOJI[map.biome]}`,
    `${r.score.toLocaleString()} pts · ${Math.round(r.accuracy * 100)}% · 🔥${r.bestCombo}`,
    squares,
    "typo.bluedotstudios.io",
  ].join("\n");
}
