import type { SectionId } from '@phosphor/shared';

export type Vec3 = [number, number, number];
export type Pose = { pos: Vec3; rot: Vec3; scale: number; explode: number };

/** Page order of the sections the keyboard poses for (the footer keeps the order pose). */
export const SECTION_ORDER: SectionId[] = ['top', 'brand', 'specs', 'sound', 'build', 'type', 'order'];

/** Where the fixed keyboard sits while each section is on screen (scene units, radians; explode 0..1). */
export const poses: Record<SectionId, Pose> = {
  top: { pos: [0.42, -0.4, 0.1], rot: [0, -0.32, 0], scale: 0.78, explode: 0 }, // the approved hero
  brand: { pos: [0.62, -0.1, -0.1], rot: [0.18, -0.62, 0.06], scale: 0.7, explode: 0 },
  specs: { pos: [-0.7, -0.15, 0.05], rot: [-0.32, -0.42, 0], scale: 0.6, explode: 1 },
  sound: { pos: [0.7, -1.05, 0.8], rot: [0.14, -0.3, 0], scale: 1.45, explode: 0 },
  build: { pos: [0.6, -0.15, 0], rot: [0.1, 0.42, 0], scale: 0.7, explode: 0 },
  type: { pos: [0.4, -0.3, 0.6], rot: [0.62, 0, 0], scale: 0.7, explode: 0 },
  order: { pos: [-0.95, -0.3, 0.05], rot: [0.08, 0.5, -0.04], scale: 0.56, explode: 0 },
};

const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t; // exact at both ends
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/**
 * Pose at a scroll progress (0 = top, 1 = order, sections evenly spaced). A smoothstep inside each
 * segment holds the keyboard near each section's pose and moves it between them.
 */
export function poseAt(progress: number): Pose {
  const last = SECTION_ORDER.length - 1;
  const f = Math.round(Math.min(Math.max(progress, 0), 1) * last * 1e6) / 1e6; // exact section stops despite float error
  const i = Math.min(Math.floor(f), last - 1);
  const u = f - i;
  const t = u * u * (3 - 2 * u);
  const a = poses[SECTION_ORDER[i]], b = poses[SECTION_ORDER[i + 1]];
  return { pos: mix3(a.pos, b.pos, t), rot: mix3(a.rot, b.rot, t), scale: mix(a.scale, b.scale, t), explode: mix(a.explode, b.explode, t) };
}

/** Scroll position → poseAt progress: each section's top maps to its stop, linear in between. */
export function scrollProgress(tops: number[], y: number): number {
  const last = tops.length - 1;
  if (y <= tops[0]) return 0;
  for (let i = 0; i < last; i++) if (y < tops[i + 1]) return (i + (y - tops[i]) / (tops[i + 1] - tops[i])) / last;
  return 1;
}

// Portrait screens: the copy takes the top, the keyboard sits centred and smaller in the lower half.
const PORTRAIT = { y: -0.5, z: 0.45, scale: 0.5 };

/** Blends a pose toward its portrait framing by `w` (0..1). */
export function fitPose(p: Pose, w: number): Pose {
  if (w <= 0) return p;
  return {
    pos: [mix(p.pos[0], 0, w), mix(p.pos[1], PORTRAIT.y, w), mix(p.pos[2], PORTRAIT.z, w)],
    rot: p.rot,
    scale: p.scale * mix(1, PORTRAIT.scale, w),
    explode: p.explode,
  };
}

/** How much of the portrait framing applies: by how portrait the screen is, and never in the hero (its pose is approved as is). */
export function narrowness(aspect: number, progress: number) {
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  return clamp((1 - aspect) / 0.4) * clamp(progress * (SECTION_ORDER.length - 1));
}
