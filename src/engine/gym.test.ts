import { describe, expect, it } from 'vitest';
import { convertWeight, platesPerSide, restSeconds, substitutes, warmupSets, type Exercise } from './index';

const ex = (id: string, pattern: Exercise['pattern'], equipment: Exercise['equipment'], primary: Exercise['primaryMuscles']): Exercise => ({
  id, name: id, pattern, equipment, primaryMuscles: primary, secondaryMuscles: [],
});

describe('Warm-up calculator', () => {
  it('bar, 40/60/80% rounded to 5 lb', () => {
    expect(warmupSets(225, 'lb', true).map((s) => s.weight)).toEqual([45, 90, 135, 180]);
  });
  it('skips steps at or below the bar', () => {
    expect(warmupSets(95, 'lb', true).map((s) => s.weight)).toEqual([45, 55, 75]);
  });
  it('no bar for dumbbells; kg rounds to 2.5', () => {
    expect(warmupSets(30, 'kg', false).map((s) => s.weight)).toEqual([12.5, 17.5, 25]);
  });
});

describe('Plate calculator', () => {
  it('per side, biggest plates first', () => {
    expect(platesPerSide(225, 'lb').plates).toEqual([45, 45]);
    expect(platesPerSide(185, 'lb').plates).toEqual([45, 25]);
    expect(platesPerSide(100, 'kg').plates).toEqual([25, 15]);
    expect(platesPerSide(47, 'lb').remainder).toBe(1);
    expect(platesPerSide(45, 'lb').plates).toEqual([]);
  });
});

describe('Substitution', () => {
  const bench = ex('bench', 'hpush', 'barbell', ['chest', 'triceps']);
  const lib = [
    bench,
    ex('db-bench', 'hpush', 'dumbbell', ['chest', 'triceps']),
    ex('machine-press', 'hpush', 'machine', ['chest']),
    ex('ohp', 'vpush', 'barbell', ['front delts', 'triceps']),
    ex('dip-machine', 'hpush', 'machine', ['quads']),
  ];
  it('same pattern + primary muscles, best overlap first', () => {
    expect(substitutes(bench, lib).map((e) => e.id)).toEqual(['db-bench', 'machine-press']);
  });
  it('converts weight by equipment ratio', () => {
    expect(convertWeight(200, 'barbell', 'dumbbell', 5)).toBe(80);
    expect(convertWeight(80, 'dumbbell', 'barbell', 5)).toBe(200);
    expect(convertWeight(100, 'barbell', 'bodyweight', 5)).toBeNull();
  });
});

describe('Rest timer defaults', () => {
  it('3:00 compound, 1:30 isolation', () => {
    const p = { restCompoundSec: 180, restIsolationSec: 90 };
    expect(restSeconds(ex('a', 'squat', 'barbell', ['quads']), p)).toBe(180);
    expect(restSeconds(ex('b', 'isolation', 'cable', ['biceps']), p)).toBe(90);
  });
});
