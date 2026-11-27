import {
  BackSide,
  CanvasTexture,
  Color,
  DataTexture,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  type BufferGeometry,
  type Texture,
} from "three";
import type { Palette } from "./palette";

// Cartoon look: stepped (toon) lighting, inverted-hull ink outlines, and small procedurally
// drawn canvas textures in the riso palette.

let gradient: DataTexture | undefined;
function toonGradient(): DataTexture {
  if (!gradient) {
    // Three bands: shadow, mid, lit.
    gradient = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat);
    gradient.minFilter = gradient.magFilter = NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const toonCache = new Map<string, MeshToonMaterial>();
export function toon(color: number, map?: Texture, opts: { transparent?: boolean } = {}): MeshToonMaterial {
  const key = `${color}:${map?.uuid ?? ""}:${opts.transparent ?? false}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new MeshToonMaterial({ color, gradientMap: toonGradient() });
    if (map) m.map = map;
    if (opts.transparent) m.transparent = true;
    toonCache.set(key, m);
  }
  return opts.transparent ? m.clone() : m;
}

// ---------- outlines ----------

type FogRef = { color: Color; near: number; far: number };
export const outlineFog: FogRef = { color: new Color(0xffffff), near: 1e9, far: 1e9 + 1 };

const outlineCache = new Map<string, ShaderMaterial>();
export function outlineMaterial(thickness: number, color: number, opacity = 1): ShaderMaterial {
  const key = `${thickness}:${color}`;
  const cached = outlineCache.get(key);
  if (cached && opacity === 1) return cached;
  const m = new ShaderMaterial({
    side: BackSide,
    transparent: opacity < 1,
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      uFogColor: { value: outlineFog.color },
      uFogNear: { value: outlineFog.near },
      uFogFar: { value: outlineFog.far },
    },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position + normal * uThickness, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying float vDepth;
      void main() {
        float f = smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(mix(uColor, uFogColor, f), uOpacity);
        #include <colorspace_fragment>
      }`,
  });
  if (opacity === 1) outlineCache.set(key, m);
  return m;
}

/** Point every outline material at the scene's fog settings. */
export function setOutlineFog(color: number, near: number, far: number) {
  outlineFog.color.set(color);
  outlineFog.near = near;
  outlineFog.far = far;
  for (const m of outlineCache.values()) {
    m.uniforms.uFogNear.value = near;
    m.uniforms.uFogFar.value = far;
  }
}

/** A toon mesh with an ink outline shell. */
export function inked(
  geometry: BufferGeometry,
  material: MeshToonMaterial,
  thickness: number,
  ink: number,
  shadows = true,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  if (thickness > 0) {
    const shell = new Mesh(geometry, outlineMaterial(thickness, ink));
    shell.name = "outline";
    mesh.add(shell);
  }
  return mesh;
}

export function setShadows(obj: Object3D, cast: boolean, receive = true) {
  obj.traverse((o) => {
    if (o instanceof Mesh && o.name !== "outline") {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

// ---------- canvas textures ----------

export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = false,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export const css = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Sprinkle a little riso grain / speckle onto a canvas. */
export function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, amount = 0.05) {
  ctx.fillStyle = color;
  const n = Math.floor(w * h * amount * 0.02);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.15 + Math.random() * 0.25;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  ctx.globalAlpha = 1;
}

export type Textures = ReturnType<typeof makeTextures>;

export function makeTextures(pal: Palette) {
  const ink = css(pal.ink);
  return {
    crate: canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = css(pal.wood);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      for (let y = 0; y <= h; y += h / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(w - 10, h - 10);
      ctx.stroke();
      ctx.fillStyle = css(pal.woodDark);
      for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 12 + Math.random() * 16, 2);
      speckle(ctx, w, h, ink);
    }),
    stripes: canvasTexture(128, 32, (ctx, w, h) => {
      ctx.fillStyle = css(pal.paper);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = css(pal.spotB);
      for (let x = -h; x < w + h; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 16, h);
        ctx.lineTo(x + 16 + h, 0);
        ctx.lineTo(x + h, 0);
        ctx.fill();
      }
    }),
    grille: canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = css(pal.metal);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = css(pal.metalDark);
      ctx.lineWidth = 4;
      for (let y = 14; y < h; y += 12) {
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(w - 8, y);
        ctx.stroke();
      }
      speckle(ctx, w, h, ink);
    }),
    fan: canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = css(pal.metal);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = css(pal.ink);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = css(pal.metal);
      ctx.lineWidth = 3;
      for (let r = 12; r < w * 0.42; r += 9) {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(w / 2 - w * 0.42, h / 2);
      ctx.lineTo(w / 2 + w * 0.42, h / 2);
      ctx.moveTo(w / 2, h / 2 - w * 0.42);
      ctx.lineTo(w / 2, h / 2 + w * 0.42);
      ctx.stroke();
    }),
    sign: canvasTexture(256, 96, (ctx, w, h) => {
      ctx.fillStyle = css(pal.spotA);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = ink;
      ctx.font = "bold 44px 'Lilita One', 'Arial Black', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("LOW", w / 2, h / 2 + 3);
      for (const x of [34, w - 34]) {
        ctx.beginPath();
        ctx.moveTo(x - 14, 30);
        ctx.lineTo(x, 60);
        ctx.lineTo(x + 14, 30);
        ctx.lineWidth = 8;
        ctx.stroke();
      }
    }),
    container: canvasTexture(
      128,
      128,
      (ctx, w, h) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 16) {
          ctx.fillStyle = "#c8c0c4";
          ctx.fillRect(x, 0, 5, h);
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(x + 7, 0, 3, h);
        }
        speckle(ctx, w, h, ink, 0.06);
      },
      true,
    ),
    roof: canvasTexture(
      128,
      128,
      (ctx, w, h) => {
        ctx.fillStyle = css(pal.paperDark);
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = css(pal.muted);
        ctx.lineWidth = 2;
        for (let x = 0; x < w; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        speckle(ctx, w, h, ink, 0.05);
      },
      true,
    ),
    asphalt: canvasTexture(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = css(pal.asphalt);
        ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, css(pal.paper), 0.25);
        speckle(ctx, w, h, "#000", 0.2);
      },
      true,
    ),
    sidewalk: canvasTexture(
      128,
      128,
      (ctx, w, h) => {
        ctx.fillStyle = css(pal.paperDark);
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = css(pal.muted);
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, w, h);
        speckle(ctx, w, h, ink, 0.06);
      },
      true,
    ),
  };
}

/** A building facade texture: wall colour with a grid of windows, some lit. */
export function facadeTexture(pal: Palette, wall: number, cols: number, rows: number, seed: () => number): CanvasTexture {
  const cw = 32;
  const ch = 40;
  return canvasTexture(
    cols * cw,
    rows * ch,
    (ctx, w, h) => {
    ctx.fillStyle = css(wall);
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + 7;
        const y = r * ch + 8;
        const lit = seed() < 0.3;
        ctx.fillStyle = css(pal.ink);
        ctx.fillRect(x - 2, y - 2, cw - 10, ch - 12);
        ctx.fillStyle = lit ? css(pal.spotA) : css(pal.window);
        ctx.fillRect(x, y, cw - 14, ch - 16);
        // sill
        ctx.fillStyle = css(pal.paper);
        ctx.fillRect(x - 3, y + ch - 16, cw - 8, 3);
      }
    }
    speckle(ctx, w, h, css(pal.ink), 0.05);
    },
    true,
  );
}
