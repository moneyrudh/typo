import type { CanvasTexture } from "three";
import {
  BARRIER_SKINS,
  BEAM_SKINS,
  BENCH_SKINS,
  CONTAINER_SKINS,
  CRATE_SKINS,
  RAILING_SKINS,
  SIGN_SKINS,
} from "../content/skins";
import { createRng, type Rng } from "../engine/rng";
import { canvasTexture, css, speckle } from "./materials";
import type { Palette } from "./palette";

// Draws the looks listed in content/skins.ts. Textures are made on first use and cached,
// so a run only pays for the skins it actually shows. Each texture's own scuffs and blots
// come from a seed of its key, so the same skin looks identical for every player.

const DISPLAY = "'Lilita One', 'Arial Black', sans-serif";

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng) => void;

export class SkinBook {
  private cache = new Map<string, CanvasTexture>();
  constructor(private readonly pal: Palette) {}

  private tex(key: string, w: number, h: number, draw: Draw): CanvasTexture {
    let t = this.cache.get(key);
    if (!t) {
      const rng = createRng(`skin:${key}`);
      t = canvasTexture(w, h, (ctx, w, h) => draw(ctx, w, h, rng));
      this.cache.set(key, t);
    }
    return t;
  }

  // ---------- solid-colour skins ----------

  beam(i: number): number {
    const p = this.pal;
    return { pink: p.spotB, oxide: 0xb5523b, steel: 0x8e9aa6, safety: 0xff8a2a }[BEAM_SKINS[i] ?? "pink"];
  }

  bench(i: number): { slats: number; frame: number } {
    const p = this.pal;
    const skin = BENCH_SKINS[i] ?? "wood";
    return {
      wood: { slats: p.wood, frame: p.ink },
      park: { slats: 0x4f9a6a, frame: p.ink },
      red: { slats: 0xe0574f, frame: 0x3b3646 },
      blue: { slats: 0x4d7fc4, frame: p.metalDark },
    }[skin];
  }

  railing(i: number): number {
    const p = this.pal;
    return { yellow: p.spotA, grey: p.metal, blue: 0x5f8fcf }[RAILING_SKINS[i] ?? "yellow"];
  }

  // ---------- barrier ----------

  barrier(i: number): { tex: CanvasTexture; colors: [number, number] } {
    const p = this.pal;
    const skin = BARRIER_SKINS[i] ?? "pink";
    const colors: [number, number] = {
      pink: [p.paper, p.spotB] as [number, number],
      hazard: [p.spotA, p.ink] as [number, number],
      orange: [0xfff4e2, 0xff7a29] as [number, number],
      police: [0xf4f6fb, 0x3e64c8] as [number, number],
    }[skin];
    const tex = this.tex(`barrier:${skin}`, 128, 32, (ctx, w, h) => {
      ctx.fillStyle = css(colors[0]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = css(colors[1]);
      for (let x = -h; x < w + h; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 16, h);
        ctx.lineTo(x + 16 + h, 0);
        ctx.lineTo(x + h, 0);
        ctx.fill();
      }
      speckle(ctx, w, h, css(p.ink), 0.04);
    });
    return { tex, colors };
  }

  // ---------- crate ----------

  crate(i: number): { tex: CanvasTexture; debris: number[] } {
    const p = this.pal;
    const skin = CRATE_SKINS[i] ?? "pine";
    const wood = skin === "painted" ? 0x5aa0a0 : p.wood;
    const grain = skin === "painted" ? 0x3f7c7e : p.woodDark;
    const ink = css(p.ink);
    const tex = this.tex(`crate:${skin}`, 128, 128, (ctx, w, h, rng) => {
      ctx.fillStyle = css(wood);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = css(grain);
      for (let n = 0; n < 14; n++) ctx.fillRect(rng.next() * w, rng.next() * h, 12 + rng.next() * 16, 2);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      for (let y = h / 4; y < h; y += h / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      if (skin === "pine" || skin === "painted") {
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(10, 10);
        ctx.lineTo(w - 10, h - 10);
        ctx.stroke();
      }
      if (skin === "painted") {
        // chipped paint showing the pine underneath
        ctx.fillStyle = css(p.wood);
        for (let n = 0; n < 7; n++) blob(ctx, 14 + rng.next() * (w - 28), 14 + rng.next() * (h - 28), 3 + rng.next() * 5, rng);
      }
      if (skin === "fragile") {
        stencil(ctx, "FRAGILE", w / 2, h / 2, 26, "#c8343b", -0.08);
        // the classic broken glass
        ctx.strokeStyle = "#c8343b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 12, 22);
        ctx.lineTo(w / 2 + 12, 22);
        ctx.lineTo(w / 2 + 6, 40);
        ctx.lineTo(w / 2 - 6, 40);
        ctx.closePath();
        ctx.moveTo(w / 2, 40);
        ctx.lineTo(w / 2, 50);
        ctx.stroke();
      }
      if (skin === "upright") {
        ctx.fillStyle = ink;
        for (const x of [w * 0.36, w * 0.64]) {
          ctx.fillRect(x - 4, 50, 8, 34);
          ctx.beginPath();
          ctx.moveTo(x - 13, 54);
          ctx.lineTo(x, 34);
          ctx.lineTo(x + 13, 54);
          ctx.fill();
        }
        stencil(ctx, "THIS WAY UP", w / 2, 102, 15, ink);
      }
      speckle(ctx, w, h, ink);
    });
    return { tex, debris: [wood, grain, p.ink] };
  }

  // ---------- hanging sign ----------

  sign(i: number): { board: number; tex: CanvasTexture } {
    const p = this.pal;
    const skin = SIGN_SKINS[i] ?? SIGN_SKINS[0];
    const board = {
      warning: p.spotA,
      notice: 0xffffff,
      road: 0x2f63b8,
      shop: 0xd8413a,
      neon: p.ink,
      rusty: 0x9b5a3a,
    }[skin.style];
    const tex = this.tex(`sign:${i}`, 256, 96, (ctx, w, h, rng) => {
      const ink = css(p.ink);
      ctx.fillStyle = css(board);
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      switch (skin.style) {
        case "warning":
          ctx.strokeStyle = ink;
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, w - 10, h - 10);
          ctx.fillStyle = ink;
          ctx.font = `bold 44px ${DISPLAY}`;
          ctx.fillText(skin.text, w / 2, h / 2 + 3);
          ctx.lineWidth = 8;
          for (const x of [34, w - 34]) {
            ctx.beginPath();
            ctx.moveTo(x - 14, 30);
            ctx.lineTo(x, 60);
            ctx.lineTo(x + 14, 30);
            ctx.stroke();
          }
          break;
        case "notice":
          ctx.strokeStyle = "#d8413a";
          ctx.lineWidth = 12;
          ctx.strokeRect(6, 6, w - 12, h - 12);
          ctx.fillStyle = ink;
          ctx.font = `bold 30px ${DISPLAY}`;
          ctx.fillText(skin.text, w / 2, h / 2 + 2);
          break;
        case "road":
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 5;
          roundRect(ctx, 9, 9, w - 18, h - 18, 10);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold 16px ${DISPLAY}`;
          ctx.fillText(skin.small ?? "", w / 2, 27);
          ctx.font = `bold 38px ${DISPLAY}`;
          ctx.fillText(skin.text, w / 2, 60);
          // height arrows
          ctx.lineWidth = 4;
          for (const x of [36, w - 36]) {
            ctx.beginPath();
            ctx.moveTo(x, 24);
            ctx.lineTo(x, 72);
            ctx.moveTo(x - 7, 32);
            ctx.lineTo(x, 22);
            ctx.lineTo(x + 7, 32);
            ctx.moveTo(x - 7, 64);
            ctx.lineTo(x, 74);
            ctx.lineTo(x + 7, 64);
            ctx.stroke();
          }
          break;
        case "shop":
          ctx.fillStyle = css(p.spotA);
          ctx.font = `bold 46px ${DISPLAY}`;
          ctx.fillText(skin.text, w / 2 + 18, h / 2 + 3);
          // a steaming bowl
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(30, 52, 17, 0, Math.PI);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          for (const x of [24, 32, 40]) {
            ctx.beginPath();
            ctx.moveTo(x, 44);
            ctx.bezierCurveTo(x - 5, 36, x + 5, 30, x, 22);
            ctx.stroke();
          }
          ctx.strokeStyle = ink;
          ctx.lineWidth = 8;
          ctx.strokeRect(4, 4, w - 8, h - 8);
          break;
        case "neon": {
          ctx.font = `bold 44px ${DISPLAY}`;
          const glow = css(p.spotB);
          ctx.shadowColor = glow;
          ctx.shadowBlur = 14;
          ctx.strokeStyle = glow;
          ctx.lineWidth = 5;
          ctx.strokeText(skin.text, w / 2, h / 2 + 3);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#ffe1ea";
          ctx.fillText(skin.text, w / 2, h / 2 + 3);
          ctx.strokeStyle = css(p.spotA);
          ctx.lineWidth = 3;
          roundRect(ctx, 8, 8, w - 16, h - 16, 12);
          ctx.stroke();
          break;
        }
        case "rusty":
          ctx.fillStyle = "#6e3b26";
          for (let n = 0; n < 30; n++) blob(ctx, rng.next() * w, rng.next() * h, 3 + rng.next() * 12, rng);
          ctx.fillStyle = "#c98a5a";
          for (let n = 0; n < 12; n++) blob(ctx, rng.next() * w, rng.next() * h, 2 + rng.next() * 6, rng);
          // ghost of letters that were painted over long ago
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = "#f3e9d6";
          ctx.font = `bold 40px ${DISPLAY}`;
          ctx.fillText("· · · ·", w / 2, h / 2);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = ink;
          ctx.lineWidth = 6;
          ctx.strokeRect(3, 3, w - 6, h - 6);
          break;
      }
      speckle(ctx, w, h, ink, 0.04);
    });
    return { board, tex };
  }

  // ---------- container segment (front face) ----------

  /** `w` is the segment length in world units; height is fixed by the platform. */
  container(i: number, color: number, w: number, h: number): CanvasTexture {
    const p = this.pal;
    const skin = CONTAINER_SKINS[i] ?? CONTAINER_SKINS[0];
    const px = 2; // texels per world unit
    const key = `container:${i}:${color}:${Math.round(w)}:${h}`;
    return this.tex(key, Math.round(w * px), Math.round(h * px), (ctx, W, H, rng) => {
      const ink = css(p.ink);
      ctx.fillStyle = css(color);
      ctx.fillRect(0, 0, W, H);
      // corrugation
      for (let x = 0; x < W; x += 24) {
        ctx.fillStyle = "rgba(35,31,43,0.16)";
        ctx.fillRect(x, 0, 8, H);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(x + 11, 0, 4, H);
      }
      // top and bottom rails
      ctx.fillStyle = "rgba(35,31,43,0.28)";
      ctx.fillRect(0, 0, W, 8);
      ctx.fillRect(0, H - 10, W, 10);

      switch (skin.style) {
        case "plain":
          // door bars on the right end
          ctx.fillStyle = "rgba(35,31,43,0.55)";
          for (const x of [W - 70, W - 44]) ctx.fillRect(x, 14, 5, H - 30);
          ctx.fillStyle = "#f3e9d6";
          ctx.fillRect(24, 22, 46, 18);
          break;
        case "rust": {
          ctx.fillStyle = "rgba(140,62,32,0.55)";
          for (let n = 0; n < 26; n++) blob(ctx, rng.next() * W, rng.next() * H, 4 + rng.next() * 16, rng);
          // streaks running down from the top rail
          ctx.fillStyle = "rgba(120,52,28,0.45)";
          for (let n = 0; n < 14; n++) {
            const x = rng.next() * W;
            ctx.fillRect(x, 6, 3 + rng.next() * 4, 20 + rng.next() * (H * 0.6));
          }
          break;
        }
        case "brand": {
          ctx.font = `bold ${Math.round(H * 0.38)}px ${DISPLAY}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#fbf5ea";
          ctx.fillText(skin.text, 22, H * 0.48);
          const tw = ctx.measureText(skin.text).width;
          // a little logo wave after the name
          ctx.strokeStyle = "#fbf5ea";
          ctx.lineWidth = 6;
          ctx.beginPath();
          for (let k = 0; k <= 30; k++) {
            const x = 34 + tw + k * 1.6;
            const y = H * 0.48 + Math.sin(k / 4) * 9;
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.font = `bold ${Math.round(H * 0.11)}px ${DISPLAY}`;
          ctx.fillText(skin.code, W - 150, H * 0.18);
          break;
        }
        case "graffiti":
          graffiti(ctx, skin.text, W, H, rng, [p.spotA, p.spotB, 0x7fd6c8, 0xa98cf0]);
          break;
        case "posters": {
          let x = 18 + rng.next() * 20;
          while (x < W - 70) {
            const pw = 46 + rng.next() * 30;
            const ph = 60 + rng.next() * 40;
            const y = 18 + rng.next() * (H - ph - 34);
            ctx.save();
            ctx.translate(x + pw / 2, y + ph / 2);
            ctx.rotate((rng.next() - 0.5) * 0.16);
            const paper = rng.pick(["#fbf5ea", css(p.spotA), "#ffd9e1", "#d4ecf2"]);
            ctx.fillStyle = paper;
            ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
            ctx.fillStyle = rng.pick([ink, css(p.spotB), "#2f63b8"]);
            ctx.fillRect(-pw / 2 + 6, -ph / 2 + 6, pw - 12, ph * 0.38);
            ctx.fillStyle = ink;
            for (let l = 0; l < 3; l++) ctx.fillRect(-pw / 2 + 6, ph * 0.02 + l * 9, (pw - 12) * (0.5 + rng.next() * 0.5), 4);
            // torn corner
            ctx.fillStyle = css(color);
            ctx.beginPath();
            ctx.moveTo(pw / 2, ph / 2);
            ctx.lineTo(pw / 2 - 12 - rng.next() * 8, ph / 2);
            ctx.lineTo(pw / 2, ph / 2 - 10 - rng.next() * 10);
            ctx.fill();
            ctx.restore();
            x += pw + 10 + rng.next() * 40;
          }
          break;
        }
      }
      speckle(ctx, W, H, ink, 0.06);
    });
  }
}

// ---------- drawing helpers ----------

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rng: Rng) {
  ctx.beginPath();
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const rr = r * (0.65 + rng.next() * 0.5);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
  }
  ctx.fill();
}

function stencil(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `bold ${size}px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Bubble letters: fat ink outline, two-tone fill, a shine and some drips. */
function graffiti(ctx: CanvasRenderingContext2D, text: string, W: number, H: number, rng: Rng, inks: number[]) {
  const [fill, shade] = rng.shuffle(inks).map(css);
  const size = Math.round(H * 0.56);
  ctx.save();
  ctx.translate(W * (0.3 + rng.next() * 0.25), H * 0.52);
  ctx.rotate(-0.08 + rng.next() * 0.06);
  ctx.font = `bold ${size}px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // backdrop cloud
  ctx.fillStyle = "#fbf5ea";
  const tw = ctx.measureText(text).width;
  for (let k = 0; k < 8; k++) {
    ctx.beginPath();
    ctx.arc(-tw / 2 + (k / 7) * tw, (rng.next() - 0.5) * 10, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#231f2b";
  ctx.lineWidth = 14;
  ctx.strokeText(text, 0, 0);
  const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  grad.addColorStop(0, fill);
  grad.addColorStop(0.55, fill);
  grad.addColorStop(0.56, shade);
  grad.addColorStop(1, shade);
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);
  // drips
  ctx.fillStyle = shade;
  for (let k = 0; k < 5; k++) {
    const x = -tw / 2 + rng.next() * tw;
    const len = 8 + rng.next() * 18;
    ctx.fillRect(x, size * 0.3, 4, len);
    ctx.beginPath();
    ctx.arc(x + 2, size * 0.3 + len, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // shine
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(-tw / 2 + 8, -size * 0.28, tw * 0.25, 5);
  ctx.restore();
  // a small tag nearby
  ctx.save();
  ctx.translate(W * 0.82, H * 0.3);
  ctx.rotate(-0.2);
  ctx.strokeStyle = "#231f2b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, 6);
  ctx.bezierCurveTo(-10, -14, 0, 18, 10, -4);
  ctx.bezierCurveTo(16, -12, 22, 6, 28, -2);
  ctx.stroke();
  ctx.restore();
}
