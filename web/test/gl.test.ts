import { describe, expect, it } from 'vitest';
import { canRenderGL } from '../src/three/quality';
import { fx, GL_LOST_EVENT, markGLLost } from '../src/three/bus';

const fakeGL = (exts: string[]) => ({ getExtension: (name: string) => (exts.includes(name) ? {} : null) });

describe('canRenderGL', () => {
  it('rejects a missing context', () => {
    expect(canRenderGL(null)).toBe(false);
  });

  it('rejects WebGL2 without renderable half-float targets', () => {
    expect(canRenderGL(fakeGL(['OES_texture_float_linear']))).toBe(false);
  });

  it('accepts EXT_color_buffer_float or EXT_color_buffer_half_float', () => {
    expect(canRenderGL(fakeGL(['EXT_color_buffer_float']))).toBe(true);
    expect(canRenderGL(fakeGL(['EXT_color_buffer_half_float']))).toBe(true);
  });
});

describe('markGLLost', () => {
  it('hands the headline back to the DOM and tells listeners', () => {
    fx.glReady = true;
    fx.headlineGL = 1;
    const target = new EventTarget();
    let heard = 0;
    target.addEventListener(GL_LOST_EVENT, () => heard++);
    markGLLost(target);
    expect(fx.glReady).toBe(false);
    expect(fx.headlineGL).toBe(0);
    expect(heard).toBe(1);
  });
});
