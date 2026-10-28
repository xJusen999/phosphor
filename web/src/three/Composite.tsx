'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending, type Blending, CanvasTexture, Color, HalfFloatType, LinearFilter, NoBlending, ShaderMaterial, SRGBColorSpace,
  Vector2, Vector4, WebGLRenderTarget, type Texture,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { fx, GL_READY_EVENT, markGLLost, releaseGL } from './bus';

const BLOOM_LEVELS = 5;

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Bloom source: only light that is both bright and clearly green (keys, underglow strip).
// White caps under the key light are bright but neutral, so they stay out; the paper is not in this target at all.
const brightFrag = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float green = (c.g - max(c.r, c.b)) / max(l, 1e-3);
  float w = smoothstep(0.9, 1.8, l) * smoothstep(0.35, 0.8, green);
  gl_FragColor = vec4(c * w, 1.0);
}`;

const downFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const upFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += (texture2D(tSrc, vUv + vec2(texel.x, 0.0)).rgb + texture2D(tSrc, vUv - vec2(texel.x, 0.0)).rgb
      + texture2D(tSrc, vUv + vec2(0.0, texel.y)).rgb + texture2D(tSrc, vUv - vec2(0.0, texel.y)).rgb) * 2.0;
  c += texture2D(tSrc, vUv + texel).rgb + texture2D(tSrc, vUv - texel).rgb
     + texture2D(tSrc, vUv + vec2(texel.x, -texel.y)).rgb + texture2D(tSrc, vUv + vec2(-texel.x, texel.y)).rgb;
  gl_FragColor = vec4(c / 16.0, 1.0);
}`;

// Final pass, in display space: paper → smoke → GL headline → keyboard (RGB-shifted) → bloom → grain.
// The warp is buttermax.net's ButtermaxVFX idea, rewritten: zoom with |scroll velocity|, a band that bends
// around the cursor's column and ripples around the cursor; the fluid's velocity also pushes the pixels.
// toneMapping() and sRGBTransferOETF() come from three's ShaderMaterial prefix (renderer tone mapping is Neutral).
const finalFrag = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDye;
uniform sampler2D tVel;
uniform sampler2D tText;
uniform vec4 textRect;
uniform float textAlpha;
uniform vec2 mouse;
uniform vec2 dyeTexel;
uniform float aspect;
uniform float scroll;
uniform float time;
uniform float motion;
uniform float smokeAmt;
uniform vec3 paper;
uniform vec3 ink;
uniform vec3 smokeGrey;
uniform vec3 smokeGreen;
varying vec2 vUv;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// Premultiplied linear HDR → straight display colour.
vec3 shade(vec4 s) {
  return sRGBTransferOETF(vec4(toneMapping(s.rgb / max(s.a, 1e-4)), 1.0)).rgb;
}

void main() {
  float s = scroll * motion;
  vec2 uv = 0.5 + (vUv - 0.5) / (1.0 + abs(s) * 0.012);
  vec2 dm = uv - mouse;
  dm.x *= aspect;
  float len = length(dm);
  float warp = -s * smoothstep(0.8, 0.05, abs(mouse.x - uv.x)) * 0.004;
  warp += sin(len * 30.0 * smoothstep(0.0, 1.0, len)) * 0.0005 * abs(s) * (1.0 - smoothstep(0.5, 1.4, len));
  uv.y += warp;
  // Fluid velocity (sim texels / s), with a dead zone so the ambient drift leaves the pixels alone
  // and only the cursor's wake pushes them.
  vec2 flow = texture2D(tVel, vUv).xy * motion;
  float speed = length(flow);
  flow *= smoothstep(12.0, 60.0, speed) * min(1.0, 160.0 / max(speed, 1e-3));

  // Smoke: two greys (dense core, soft haze), lit from the top left by the density gradient,
  // and tinted toward lit green where the dye carries the keyboard's light.
  vec4 d = texture2D(tDye, uv);
  float gx = texture2D(tDye, uv + vec2(dyeTexel.x * 2.0, 0.0)).r - texture2D(tDye, uv - vec2(dyeTexel.x * 2.0, 0.0)).r;
  float gy = texture2D(tDye, uv + vec2(0.0, dyeTexel.y * 2.0)).r - texture2D(tDye, uv - vec2(0.0, dyeTexel.y * 2.0)).r;
  float lit = clamp(dot(normalize(vec3(-gx, -gy, 0.18)), normalize(vec3(-0.45, 0.7, 0.55))), 0.0, 1.0);
  float core = 1.0 - exp(-max(d.r, 0.0) * 1.3);
  float haze = 1.0 - exp(-max(d.g, 0.0) * 0.9);
  float tint = 1.0 - exp(-max(d.b, 0.0) * 1.6);
  // The keys' light also reaches smoke that drifts near them: the wide bloom doubles as their light field.
  vec3 glow = 1.0 - exp(-texture2D(tBloom, vUv).rgb * 0.9);
  float keyLight = clamp(glow.g * 2.2, 0.0, 1.0);
  vec3 smokeCol = mix(smokeGrey, smokeGreen, max(tint * 0.75, keyLight)) * (0.93 + 0.14 * lit);
  float a = clamp(core * 0.56 + haze * 0.26, 0.0, 0.64) * smokeAmt;
  vec3 col = mix(paper, smokeCol, a);

  // Headline drawn as a texture, so the smoke drags it like butter.
  // Only the cursor's own wake smears it: the vents' drift near the copy must not.
  vec2 tuv = (uv - flow * 0.00012 * smoothstep(0.32, 0.05, len) - textRect.xy) / textRect.zw;
  float inside = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
  col = mix(col, ink, texture2D(tText, tuv).a * textAlpha * inside);

  // Keyboard, with a scroll-scaled RGB shift (0.001 per screen/s: at 60+ fps a brisk flick runs 3+ screens/s,
  // and more than ~2.5 px of fringe reads as a glitch, not as speed).
  vec2 kuv = uv - flow * 0.000008; // the product only shimmers; the headline is what smears
  vec2 off = vec2(0.0, 0.001 * s);
  vec4 sg = texture2D(tScene, kuv);
  vec4 sr = texture2D(tScene, kuv + off);
  vec4 sb = texture2D(tScene, kuv - off);
  col = vec3(mix(col.r, shade(sr).r, sr.a), mix(col.g, shade(sg).g, sg.a), mix(col.b, shade(sb).b, sb.a));
  // A thin veil of the same smoke drifts in front of the keyboard, so it sits in the room, not on top of it.
  col = mix(col, smokeCol, a * 0.3 * sg.a);

  // Bloom: additive (it lives on the green channel, so the paper does not wash out) plus a soft green
  // spill that tints the paper around the glow instead of brightening it.
  col += glow * 0.32;
  col *= mix(vec3(1.0), vec3(0.78, 1.0, 0.85), clamp(dot(glow, vec3(0.3, 0.6, 0.1)) * 0.9, 0.0, 1.0));

  // Stepped grain (12 steps/s), zero mean.
  col += (hash(gl_FragCoord.xy + floor(time * 12.0) * 37.0) - 0.5) * 0.028;
  gl_FragColor = vec4(col, 1.0);
}`;

const mat = (frag: string, uniforms: Record<string, unknown>, blending: Blending = NoBlending) =>
  new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: Object.fromEntries(Object.entries(uniforms).map(([k, value]) => [k, { value }])),
    blending,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, samples = 0) =>
  new WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: samples > 0, samples,
  });

// The final pass works in display (sRGB) values; Color() would store the hex in linear.
const display = (hex: string) => new Color(hex).convertLinearToSRGB();

/**
 * Takes over R3F's render: the scene goes to an MSAA half-float target and the final full-screen pass
 * composites it over the paper with the smoke, the GL headline, bloom, warp, RGB shift and grain.
 */
export function Composite() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const quad = useMemo(() => new FullScreenQuad(), []);
  const m = useMemo(
    () => ({
      bright: mat(brightFrag, { tSrc: null }),
      down: mat(downFrag, { tSrc: null, texel: new Vector2() }),
      up: mat(upFrag, { tSrc: null, texel: new Vector2() }, AdditiveBlending),
      final: mat(finalFrag, {
        tScene: null, tBloom: null, tDye: null, tVel: null, tText: null,
        textRect: new Vector4(0, 0, 1, 1), textAlpha: 0, mouse: new Vector2(0.5, 0.5), dyeTexel: new Vector2(),
        aspect: 1, scroll: 0, time: 0, motion: 1, smokeAmt: 1,
        paper: display('#f4f4f1'), ink: display('#0d0f0c'), smokeGrey: display('#787e78'), smokeGreen: display('#8eeaab'),
      }),
    }),
    [],
  );
  const targets = useMemo(() => {
    const w = Math.round(size.width * dpr), h = Math.round(size.height * dpr);
    return {
      scene: rt(w, h, 4),
      bloom: Array.from({ length: BLOOM_LEVELS }, (_, i) => rt(w >> (i + 1), h >> (i + 1))),
    };
  }, [size.width, size.height, dpr]);
  useEffect(() => () => [targets.scene, ...targets.bloom].forEach((t) => t.dispose()), [targets]);

  const st = useRef({ text: null as Texture | null, version: -1, alpha: 0, lastY: 0, vel: 0, reduced: false, mouse: new Vector2(0.5, 0.5) });

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => (st.current.reduced = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    const move = (e: PointerEvent) => st.current.mouse.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
    addEventListener('pointermove', move, { passive: true });
    st.current.lastY = scrollY;
    const lost = () => markGLLost();
    gl.domElement.addEventListener('webglcontextlost', lost);
    if (process.env.NODE_ENV !== 'production') Object.assign(window, { __composite: m.final.uniforms });
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    return () => {
      mq.removeEventListener('change', sync);
      removeEventListener('pointermove', move);
      gl.autoClear = autoClear;
      st.current.text?.dispose();
      Object.values(m).forEach((x) => x.dispose());
      gl.domElement.removeEventListener('webglcontextlost', lost);
      releaseGL();
    };
  }, [gl, m]);

  useFrame(({ scene, camera, clock }, delta) => {
    if (gl.getContext().isContextLost()) return; // R3F keeps ticking; announcing "ready" now would hide the DOM headline
    const s = st.current;
    const dt = Math.max(delta, 1 / 240);

    // 1. Scene → MSAA half-float target, transparent where the paper shows.
    gl.setRenderTarget(targets.scene);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);

    // 2. Bloom: green-only bright pass, then a down/up mip chain (additive on the way up).
    const run = (mt: ShaderMaterial, src: Texture, out: WebGLRenderTarget | null) => {
      mt.uniforms.tSrc.value = src;
      quad.material = mt;
      gl.setRenderTarget(out);
      quad.render(gl);
    };
    const b = targets.bloom;
    run(m.bright, targets.scene.texture, b[0]);
    for (let i = 1; i < b.length; i++) {
      m.down.uniforms.texel.value.set(1 / b[i - 1].width, 1 / b[i - 1].height);
      run(m.down, b[i - 1].texture, b[i]);
    }
    for (let i = b.length - 1; i > 0; i--) {
      m.up.uniforms.texel.value.set(1 / b[i].width, 1 / b[i].height);
      run(m.up, b[i].texture, b[i - 1]);
    }

    // 3. Headline texture (redrawn by the hero on resize / font load) and its on-screen rect.
    const u = m.final.uniforms;
    const h = fx.headline;
    if (h && h.version !== s.version) {
      s.text?.dispose();
      const t = new CanvasTexture(h.canvas);
      t.colorSpace = SRGBColorSpace;
      s.text = t;
      s.version = h.version;
    }
    if (h) {
      const r = h.el.getBoundingClientRect();
      const w = r.width + 2 * h.pad, hh = r.height + 2 * h.pad;
      u.textRect.value.set((r.left - h.pad) / size.width, 1 - (r.top - h.pad + hh) / size.height, w / size.width, hh / size.height);
    }
    s.alpha += ((h ? fx.headlineGL : 0) - s.alpha) * Math.min(1, dt * 7);

    // 4. Scroll velocity in screens per second, smoothed. A jump of a screen or more in one frame is a
    // section jump made behind the transition: no velocity, or the reveal would open on a full warp.
    const y = scrollY;
    if (Math.abs(y - s.lastY) >= size.height) s.lastY = y;
    s.vel += ((y - s.lastY) / dt / size.height - s.vel) * 0.18;
    s.lastY = y;

    u.tScene.value = targets.scene.texture;
    u.tBloom.value = b[0].texture;
    u.tDye.value = fx.dye;
    u.tVel.value = fx.velocity;
    u.tText.value = s.text;
    u.textAlpha.value = s.text ? s.alpha : 0;
    if (fx.dye) u.dyeTexel.value.set(1 / fx.dye.image.width, 1 / fx.dye.image.height);
    u.mouse.value.copy(s.mouse);
    u.aspect.value = size.width / Math.max(size.height, 1);
    u.scroll.value = Math.max(-2.5, Math.min(2.5, s.vel));
    u.motion.value = s.reduced ? 0 : 1;
    // The hero's smoke holds while the headline is in view, then leaves with the hero (gone at 95%, where Smoke stops).
    const out = Math.min(Math.max((y / size.height - 0.3) / 0.65, 0), 1);
    u.smokeAmt.value = 1 - out * out * (3 - 2 * out);
    if (!s.reduced) u.time.value = clock.elapsedTime;
    quad.material = m.final;
    gl.setRenderTarget(null);
    quad.render(gl);

    if (!fx.glReady) {
      fx.glReady = true;
      dispatchEvent(new Event(GL_READY_EVENT));
    }
  }, 1);

  return null;
}
