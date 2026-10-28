import {
  HalfFloatType, LinearFilter, NearestFilter, NoBlending, ShaderMaterial, Vector2, Vector4, WebGLRenderTarget,
  type Texture, type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import * as S from './shaders';

/** Velocity grid height (short side): 128 on touch / small screens, 256 otherwise. The dye runs at twice that. */
export const simResolution = ({ coarse }: { coarse: boolean }) => (coarse ? 128 : 256);

/** Brush radius (fraction of viewport height): ~90 px / viewport width, so it reads alike on any screen; clamped. */
export function splatRadius(viewportW: number) {
  const r = 90 / viewportW;
  return Number.isFinite(r) && r > 0 ? Math.min(0.12, Math.max(0.03, r)) : 0.12;
}

export type FluidOptions = {
  res: number;
  pressureIterations: number;
  curl: number;
  velocityDissipation: number;
  /** Per dye channel: R core smoke, G soft haze, B green tint. */
  dyeDissipation: [number, number, number, number];
};

const target = (w: number, h: number, linear: boolean) =>
  new WebGLRenderTarget(w, h, {
    type: HalfFloatType,
    minFilter: linear ? LinearFilter : NearestFilter,
    magFilter: linear ? LinearFilter : NearestFilter,
    depthBuffer: false,
  });

class Double {
  constructor(public read: WebGLRenderTarget, public write: WebGLRenderTarget) {}
  swap() {
    [this.read, this.write] = [this.write, this.read];
  }
  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}

const material = (frag: string, uniforms: Record<string, unknown>) =>
  new ShaderMaterial({
    vertexShader: S.baseVert,
    fragmentShader: frag,
    uniforms: Object.fromEntries(Object.entries({ texelSize: new Vector2(), ...uniforms }).map(([k, value]) => [k, { value }])),
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
  });

/** GPU Navier-Stokes on half-float targets: splat → curl → vorticity → divergence → pressure → gradient subtract → advection. */
export class Fluid {
  velocity!: Double;
  dye!: Double;
  private divergence!: WebGLRenderTarget;
  private curlRT!: WebGLRenderTarget;
  private pressure!: Double;
  private simTexel = new Vector2();
  private aspect = 1;
  private quad = new FullScreenQuad();
  private m = {
    splat: material(S.splatFrag, { uTarget: null, aspect: 1, color: [0, 0, 0], point: new Vector2(), prevPoint: new Vector2(), stretch: new Vector2(1, 1), radius: 0.05 }),
    advect: material(S.advectionFrag, { uVelocity: null, uSource: null, dt: 0, dissipation: new Vector4() }),
    curl: material(S.curlFrag, { uVelocity: null }),
    vorticity: material(S.vorticityFrag, { uVelocity: null, uCurl: null, curl: 0, dt: 0 }),
    divergence: material(S.divergenceFrag, { uVelocity: null }),
    clear: material(S.clearFrag, { uTexture: null, value: 0.8 }),
    pressure: material(S.pressureFrag, { uPressure: null, uDivergence: null }),
    gradient: material(S.gradientSubtractFrag, { uPressure: null, uVelocity: null }),
  };

  constructor(private gl: WebGLRenderer, public opts: FluidOptions) {}

  get dyeTexture(): Texture {
    return this.dye.read.texture;
  }
  get velocityTexture(): Texture {
    return this.velocity.read.texture;
  }

  /** (Re)allocates the grids for a viewport aspect, carrying the current smoke over. */
  resize(width: number, height: number) {
    const aspect = width / Math.max(height, 1);
    const size = (res: number): [number, number] =>
      aspect >= 1 ? [Math.round(res * aspect), res] : [res, Math.round(res / aspect)];
    const [sw, sh] = size(this.opts.res);
    const [dw, dh] = size(this.opts.res * 2);
    if (this.velocity && this.velocity.read.width === sw && this.velocity.read.height === sh) return;
    this.aspect = aspect;
    this.simTexel.set(1 / sw, 1 / sh);
    const carry = (old: Double | undefined, next: Double) => {
      if (!old) return next;
      this.splatInto(next.read, old.read.texture, 0, 0, 0, 0, [0, 0, 0], 1);
      old.dispose();
      return next;
    };
    this.velocity = carry(this.velocity, new Double(target(sw, sh, true), target(sw, sh, true)));
    this.dye = carry(this.dye, new Double(target(dw, dh, true), target(dw, dh, true)));
    this.pressure?.dispose();
    this.divergence?.dispose();
    this.curlRT?.dispose();
    this.pressure = new Double(target(sw, sh, false), target(sw, sh, false));
    this.divergence = target(sw, sh, false);
    this.curlRT = target(sw, sh, false);
  }

  private pass(mat: ShaderMaterial, out: WebGLRenderTarget, texel: Vector2) {
    mat.uniforms.texelSize.value.copy(texel);
    this.quad.material = mat;
    this.gl.setRenderTarget(out);
    this.quad.render(this.gl);
  }

  private splatInto(out: WebGLRenderTarget, src: Texture, x: number, y: number, px: number, py: number, color: number[], radius: number, sx = 1, sy = 1) {
    const u = this.m.splat.uniforms;
    u.uTarget.value = src;
    u.aspect.value = this.aspect;
    u.point.value.set(x, y);
    u.prevPoint.value.set(px, py);
    u.stretch.value.set(sx, sy);
    u.color.value = color;
    u.radius.value = radius;
    this.pass(this.m.splat, out, this.simTexel);
  }

  /**
   * Adds velocity (sim texels/s) and dye along the segment (px,py)→(x,y), in UV (0..1, y up).
   * `radius` is a fraction of the viewport height; `stretch` scales the brush into an ellipse.
   */
  splat(x: number, y: number, px: number, py: number, vel: [number, number], dye: [number, number, number], radius: number, stretch: [number, number] = [1, 1]) {
    if (vel[0] || vel[1]) {
      this.splatInto(this.velocity.write, this.velocity.read.texture, x, y, px, py, [vel[0], vel[1], 0], radius, ...stretch);
      this.velocity.swap();
    }
    this.splatInto(this.dye.write, this.dye.read.texture, x, y, px, py, dye, radius, ...stretch);
    this.dye.swap();
  }

  step(dt: number) {
    const { m, simTexel } = this;
    m.curl.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass(m.curl, this.curlRT, simTexel);

    m.vorticity.uniforms.uVelocity.value = this.velocity.read.texture;
    m.vorticity.uniforms.uCurl.value = this.curlRT.texture;
    m.vorticity.uniforms.curl.value = this.opts.curl;
    m.vorticity.uniforms.dt.value = dt;
    this.pass(m.vorticity, this.velocity.write, simTexel);
    this.velocity.swap();

    m.divergence.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass(m.divergence, this.divergence, simTexel);

    m.clear.uniforms.uTexture.value = this.pressure.read.texture;
    this.pass(m.clear, this.pressure.write, simTexel);
    this.pressure.swap();

    m.pressure.uniforms.uDivergence.value = this.divergence.texture;
    for (let i = 0; i < this.opts.pressureIterations; i++) {
      m.pressure.uniforms.uPressure.value = this.pressure.read.texture;
      this.pass(m.pressure, this.pressure.write, simTexel);
      this.pressure.swap();
    }

    m.gradient.uniforms.uPressure.value = this.pressure.read.texture;
    m.gradient.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass(m.gradient, this.velocity.write, simTexel);
    this.velocity.swap();

    const a = m.advect.uniforms;
    a.dt.value = dt;
    a.uVelocity.value = this.velocity.read.texture;
    a.uSource.value = this.velocity.read.texture;
    a.dissipation.value.setScalar(this.opts.velocityDissipation);
    this.pass(m.advect, this.velocity.write, simTexel);
    this.velocity.swap();

    a.uVelocity.value = this.velocity.read.texture;
    a.uSource.value = this.dye.read.texture;
    a.dissipation.value.fromArray(this.opts.dyeDissipation);
    // Velocity is in sim texels, so the dye lookup offsets by sim texels as well.
    this.pass(m.advect, this.dye.write, simTexel);
    this.dye.swap();
  }

  dispose() {
    [this.velocity, this.dye, this.pressure].forEach((d) => d?.dispose());
    this.divergence?.dispose();
    this.curlRT?.dispose();
    Object.values(this.m).forEach((mat) => mat.dispose());
  }
}
