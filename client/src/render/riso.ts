import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type Camera,
} from "three";

// Renders the 3D scene into an offscreen target, then prints it with a riso flavour:
// the dark ink layer is re-printed slightly offset in the accent ink (misregistration),
// and slow-mo desaturates and tints the frame.

export class RisoRenderer {
  readonly renderer: WebGLRenderer;
  private target: WebGLRenderTarget;
  private post = new Scene();
  private postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: ShaderMaterial;

  constructor(
    private readonly width: number,
    private readonly height: number,
    pixelRatio: number,
    ghost: number,
  ) {
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.target = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
    this.resizeTarget();

    this.material = new ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        uTexel: { value: new Vector2() },
        uGhost: { value: new Color(ghost) },
        uSlow: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform vec2 uTexel;
        uniform vec3 uGhost;
        uniform float uSlow;
        varying vec2 vUv;
        float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
        void main() {
          vec3 c = texture2D(tScene, vUv).rgb;
          vec3 o = texture2D(tScene, vUv + uTexel * vec2(-2.2, 1.8)).rgb;
          float inkO = 1.0 - smoothstep(0.012, 0.03, lum(o));
          float inkC = 1.0 - smoothstep(0.012, 0.03, lum(c));
          float ghost = inkO * (1.0 - inkC) * 0.6;
          c = mix(c, c * uGhost, ghost);
          float l = lum(c);
          vec3 tinted = mix(vec3(l), uGhost * l * 1.15, 0.3);
          c = mix(c, tinted, uSlow * 0.3);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
    });
    const tri = new BufferGeometry();
    tri.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.post.add(new Mesh(tri, this.material));
  }

  get canvas() {
    return this.renderer.domElement;
  }

  setPixelRatio(r: number) {
    if (Math.abs(this.renderer.getPixelRatio() - r) < 0.01) return;
    this.renderer.setPixelRatio(r);
    this.renderer.setSize(this.width, this.height);
    this.resizeTarget();
  }

  private resizeTarget() {
    const r = this.renderer.getPixelRatio();
    this.target.setSize(Math.round(this.width * r), Math.round(this.height * r));
  }

  render(scene: Scene, camera: Camera, slow: number) {
    const r = this.renderer.getPixelRatio();
    this.material.uniforms.uTexel.value.set(r / (this.width * r), r / (this.height * r));
    this.material.uniforms.uSlow.value = slow;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post, this.postCam);
  }
}
