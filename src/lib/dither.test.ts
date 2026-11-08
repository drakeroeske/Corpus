import { describe, expect, it } from 'vitest';
import { floydSteinberg, toGray } from './dither';

describe('dither', () => {
  it('converts RGBA to luminance', () => {
    expect(Array.from(toGray([255, 255, 255, 255, 0, 0, 0, 255]))).toEqual([255, 0]);
  });
  it('keeps pure black and white', () => {
    expect(Array.from(floydSteinberg(new Float32Array([0, 0, 255, 255]), 2, 2))).toEqual([1, 1, 0, 0]);
  });
  it('prints about half the pixels for mid grey', () => {
    const w = 32;
    const bits = floydSteinberg(new Float32Array(w * w).fill(128), w, w);
    const ink = bits.reduce((a, b) => a + b, 0) / bits.length;
    expect(ink).toBeGreaterThan(0.4);
    expect(ink).toBeLessThan(0.6);
  });
  it('does not mutate the input', () => {
    const g = new Float32Array([100, 100, 100, 100]);
    floydSteinberg(g, 2, 2);
    expect(Array.from(g)).toEqual([100, 100, 100, 100]);
  });
});
