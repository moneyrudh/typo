import "./style.css";
import { FRAME_H, FRAME_W } from "./config";
import { generateDailyMap, todayString } from "./content/generator";
import { CONTAINER_SKINS, SKIN_COUNT } from "./content/skins";
import { Session } from "./game/session";
import type { DailyMap } from "./game/types";
import { Keyboard } from "./input/keyboard";
import { applyPaletteToCss, PALETTES } from "./render/palette";
import { Scene } from "./render/scene";
import { startGrain } from "./ui/grain";
import { formatScore, Hud } from "./ui/hud";
import { OUTCOME_LABEL } from "./ui/ratings";
import { shareText } from "./ui/share";

type Mode = "menu" | "playing" | "results";

const frame = document.getElementById("frame")!;
const overlay = document.getElementById("overlay")!;
const status = document.getElementById("panel-status")!;

function fitScale(): number {
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  return Math.min(vw / FRAME_W, vh / FRAME_H);
}

function renderResolution(scale: number) {
  return Math.min(2.5, Math.max(1, (window.devicePixelRatio || 1) * scale));
}

async function loadFonts() {
  const timeout = new Promise((r) => setTimeout(r, 1500));
  await Promise.race([
    Promise.all([document.fonts.load('44px "Lilita One"'), document.fonts.load('700 44px "Fredoka"')]),
    timeout,
  ]).catch(() => {});
}

async function main() {
  const map: DailyMap = generateDailyMap(todayString());
  if (import.meta.env.DEV) devOverrides(map);
  applyPaletteToCss(PALETTES[map.biome]);

  let scale = fitScale();
  frame.style.setProperty("--scale", String(scale));

  await loadFonts();
  const scene = await Scene.create(document.getElementById("game")!, renderResolution(scale));
  const hud = new Hud();
  startGrain(document.getElementById("grain")!);

  window.addEventListener("resize", () => {
    scale = fitScale();
    frame.style.setProperty("--scale", String(scale));
    scene.setResolution(renderResolution(scale));
  });

  let mode: Mode = "menu";
  let session = createSession();

  function createSession() {
    let done = 0;
    const s = new Session(map, {
      wordStart: (slot) => {
        hud.showWord(slot);
        status.textContent = slot.tricky ? "tricky one — take your time!" : "type it!";
      },
      typed: (slot, run) => hud.updateTyped(slot, run),
      wordComplete: (slot, run) => {
        hud.wordComplete(slot, run);
        hud.setScore(s.score);
        hud.setStreak(s.combo);
        hud.setProgress(++done, map.slots.length);
        status.textContent = OUTCOME_LABEL[run.rating ?? "phew"].toLowerCase();
      },
      wordMissed: (slot) => {
        hud.wordMissed(slot);
        hud.setStreak(0);
        hud.setProgress(++done, map.slots.length);
        status.textContent = "too slow!";
      },
      action: (slot) => scene.onAction(slot),
      crash: (slot) => scene.onCrash(slot),
      finish: () => showResults(),
    });
    return s;
  }

  function start() {
    session = createSession();
    scene.load(map);
    hud.reset(map.slots.length);
    status.textContent = "get ready…";
    overlay.className = "";
    overlay.replaceChildren();
    mode = "playing";
  }

  function showMenu() {
    mode = "menu";
    scene.load(map);
    hud.reset(map.slots.length);
    overlay.innerHTML = `
      <div class="logo">typo</div>
      <div class="sub">daily #${map.day} · ${map.biome}</div>
      <p class="how">Words appear as obstacles approach and time slows down.
        Type each word before the slow-mo ends to pull off the move.
        Every word is worth 1 point — clean and quick scores full marks.</p>
      <button class="btn" id="start-btn">START</button>
      <div class="hint">or press any letter</div>`;
    overlay.className = "open";
    overlay.querySelector("#start-btn")!.addEventListener("click", start);
    status.textContent = "";
  }

  function showResults() {
    mode = "results";
    const r = session.results();
    const text = shareText(map, r);
    overlay.innerHTML = `
      <div class="sub">typo #${map.day} · run complete</div>
      <div class="big-score">${formatScore(r.score)}<small>/${r.total}</small></div>
      <div class="sub">${r.cleared}/${r.total} words cleared</div>
      <div class="stats">
        <div class="stat"><b>${Math.round(r.wpm)}</b><span>wpm</span></div>
        <div class="stat"><b>${Math.round(r.accuracy * 100)}%</b><span>accuracy</span></div>
        <div class="stat"><b>🔥 ${r.bestCombo}</b><span>best streak</span></div>
        <div class="stat"><b>${(r.reactionMs / 1000).toFixed(2)}s</b><span>avg reaction</span></div>
      </div>
      <div class="squares">${r.outcomes
        .map((o, i) => `<span class="sq ${o}${map.slots[i].tricky ? " tricky" : ""}" title="${map.slots[i].word}"></span>`)
        .join("")}</div>
      <div class="btn-row">
        <button class="btn" id="share-btn">SHARE</button>
        <button class="btn secondary" id="again-btn">run again</button>
      </div>`;
    overlay.className = "open";
    status.textContent = "";

    const shareBtn = overlay.querySelector<HTMLButtonElement>("#share-btn")!;
    shareBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        shareBtn.textContent = "COPIED!";
      } catch {
        shareBtn.textContent = "COPY FAILED";
      }
    });
    overlay.querySelector("#again-btn")!.addEventListener("click", start);
  }

  new Keyboard(document.getElementById("keyboard")!, (key) => {
    if (mode === "menu") {
      if (key !== "backspace") start();
      return;
    }
    if (mode !== "playing") return;
    if (key === "backspace") session.backspace();
    else session.type(key);
  });

  document.addEventListener("visibilitychange", () => {
    session.paused = document.hidden;
  });

  let last = performance.now();
  const frameLoop = (now: number) => {
    const realDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Outside a run the runner jogs in place behind the overlay.
    const gameDt = mode === "playing" ? session.update(realDt) : realDt * 0.5;
    scene.update(session, realDt, gameDt);
    hud.frame(session.windowLeft, session.slowness, realDt);
    requestAnimationFrame(frameLoop);
  };
  requestAnimationFrame(frameLoop);

  showMenu();

  if (import.meta.env.DEV) {
    // Debug handle for poking at runs from the console / automated screenshots.
    Object.assign(window, { __typo: { get session() { return session; }, map, start } });
  }
}

/** Dev only: `?skin=N` dresses every obstacle and container in skin N, to review the looks. */
function devOverrides(map: DailyMap) {
  const skin = new URLSearchParams(location.search).get("skin");
  if (skin === null) return;
  const n = Number(skin);
  for (const s of map.slots) s.skin = n % SKIN_COUNT[s.obstacle];
  for (const pf of map.platforms) pf.skins = pf.skins.map(() => n % CONTAINER_SKINS.length);
}

main();
