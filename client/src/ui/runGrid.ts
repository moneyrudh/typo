import type { DailyMap, SlotOutcome } from "../game/types";
import { OUTCOME_LABEL } from "./ratings";

// The run at a glance on the results screen: 20 numbered tiles in two rows of 10, one per
// word, coloured by rating. Below them a caption shows the colour legend, or the word and
// rating of whichever tile is hovered / tapped.

const LEGEND: [SlotOutcome, string][] = [
  ["perfect", "perfect"],
  ["great", "great"],
  ["nice", "nice"],
  ["phew", "phew"],
  ["missed", "miss"],
];

const legendHtml = () =>
  LEGEND.map(([o, label]) => `<span class="key"><i class="sq ${o}"></i>${label}</span>`).join("");

export function runGridHtml(map: DailyMap, outcomes: SlotOutcome[]): string {
  const tiles = outcomes
    .map((o, i) => {
      const tricky = map.slots[i].tricky ? " tricky" : "";
      // the button is a fixed hit area; only the inner face moves, so hovering near an
      // edge can't push the tile out from under the pointer
      return `<button class="tile" data-i="${i}" style="--i:${i}" aria-label="word ${i + 1}: ${map.slots[i].word}, ${OUTCOME_LABEL[o]}"><span class="face sq ${o}${tricky}">${i + 1}</span></button>`;
    })
    .join("");
  return `<div class="run-grid">
    <div class="tiles">${tiles}</div>
    <div class="caption">${legendHtml()}</div>
  </div>`;
}

/** Hover / tap a tile to see its word; leaving (or tapping it again) brings the legend back. */
export function bindRunGrid(root: HTMLElement, map: DailyMap, outcomes: SlotOutcome[]) {
  const caption = root.querySelector<HTMLElement>(".caption")!;
  let pinned: number | null = null;
  const show = (i: number | null) => {
    root.querySelectorAll(".tile.on").forEach((t) => t.classList.remove("on"));
    if (i === null) {
      caption.innerHTML = legendHtml();
      return;
    }
    root.querySelector(`.tile[data-i="${i}"]`)?.classList.add("on");
    const s = map.slots[i];
    caption.innerHTML = `<span class="num">#${i + 1}</span><b>${s.word}</b><span class="rating sq ${outcomes[i]}">${OUTCOME_LABEL[outcomes[i]]}</span>${s.tricky ? `<span class="num">tricky</span>` : ""}`;
  };
  root.querySelectorAll<HTMLElement>(".tile").forEach((t) => {
    const i = Number(t.dataset.i);
    t.addEventListener("mouseenter", () => show(i));
    t.addEventListener("mouseleave", () => show(pinned));
    t.addEventListener("click", () => {
      pinned = pinned === i ? null : i;
      show(pinned);
    });
  });
}
