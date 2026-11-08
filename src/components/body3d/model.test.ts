import { describe, expect, it } from 'vitest';
import { MUSCLES } from '../../engine/types';
import { MANNEQUIN, proceduralBody } from './model';

describe('body model', () => {
  it('has unique mesh names', () => expect(new Set(MANNEQUIN.map((m) => m.name)).size).toBe(MANNEQUIN.length));
  it('covers every muscle with at least one mesh', () => {
    for (const m of MUSCLES) expect(MANNEQUIN.some((x) => x.muscle === m)).toBe(true);
  });
  it('separates front and back meshes', () => {
    expect(proceduralBody.muscleOf('chest_L')).toBe('chest');
    expect(proceduralBody.muscleOf('upperBack')).toBe('upper back');
    expect(proceduralBody.muscleOf('frontDelt_R')).toBe('front delts');
    expect(proceduralBody.muscleOf('sideDelt_R')).toBe('side delts');
    expect(proceduralBody.muscleOf('rearDelt_L')).toBe('rear delts');
    expect(proceduralBody.muscleOf('head')).toBeNull();
    expect(proceduralBody.muscleOf('nope')).toBeNull();
  });
  it('mirrors left and right', () => {
    const l = MANNEQUIN.find((m) => m.name === 'quad_L')!;
    const r = MANNEQUIN.find((m) => m.name === 'quad_R')!;
    expect(r.position[0]).toBe(-l.position[0]);
  });
  it('keeps the mesh count small (~30 muscle meshes)', () => {
    const muscles = MANNEQUIN.filter((m) => m.muscle).length;
    expect(muscles).toBeGreaterThanOrEqual(25);
    expect(MANNEQUIN.length).toBeLessThanOrEqual(50);
  });
});
