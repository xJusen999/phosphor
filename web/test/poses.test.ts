import { describe, expect, it } from 'vitest';
import { poseAt, poses, scrollProgress, SECTION_ORDER } from '../src/scene/poses';

describe('poseAt', () => {
  it('0 is the top pose', () => {
    expect(poseAt(0)).toEqual(poses.top);
  });

  it('1 is the order pose', () => {
    expect(poseAt(1)).toEqual(poses.order);
  });

  it('midway between two sections averages their explode', () => {
    const step = 1 / (SECTION_ORDER.length - 1);
    const i = SECTION_ORDER.indexOf('specs');
    const a = poses[SECTION_ORDER[i - 1]], b = poses.specs;
    expect(poseAt((i - 0.5) * step).explode).toBeCloseTo((a.explode + b.explode) / 2);
    expect(poseAt((i + 0.5) * step).explode).toBeCloseTo((b.explode + poses[SECTION_ORDER[i + 1]].explode) / 2);
  });

  it('clamps below 0 and above 1', () => {
    expect(poseAt(-1)).toEqual(poses.top);
    expect(poseAt(2)).toEqual(poses.order);
  });

  it('lands exactly on each section pose', () => {
    SECTION_ORDER.forEach((id, i) => expect(poseAt(i / (SECTION_ORDER.length - 1))).toEqual(poses[id]));
  });
});

describe('scrollProgress', () => {
  const tops = [0, 100, 300];
  it('maps section tops to evenly spaced progress', () => {
    expect(scrollProgress(tops, 0)).toBe(0);
    expect(scrollProgress(tops, 100)).toBe(0.5);
    expect(scrollProgress(tops, 300)).toBe(1);
  });
  it('is linear inside a section and clamps outside', () => {
    expect(scrollProgress(tops, 200)).toBe(0.75);
    expect(scrollProgress(tops, -50)).toBe(0);
    expect(scrollProgress(tops, 900)).toBe(1);
  });
});
