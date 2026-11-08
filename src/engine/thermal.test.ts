import { describe, expect, it } from 'vitest';
import { hoursToRecovered, readinessAdjusted, recommendation, thermalCss, thermalRgb, volumeHeat } from './index';

describe('thermal body', () => {
  it('hits every palette stop', () => {
    expect(thermalCss(0)).toBe('rgb(11,26,58)');
    expect(thermalCss(0.25)).toBe('rgb(75,44,140)');
    expect(thermalCss(0.5)).toBe('rgb(194,48,107)');
    expect(thermalCss(0.75)).toBe('rgb(255,106,43)');
    expect(thermalCss(1)).toBe('rgb(255,232,107)');
  });
  it('interpolates and clamps', () => {
    expect(thermalRgb(0.125)).toEqual([43, 35, 99]);
    expect(thermalRgb(-1)).toEqual(thermalRgb(0));
    expect(thermalRgb(2)).toEqual(thermalRgb(1));
    expect(thermalRgb(NaN)).toEqual(thermalRgb(0));
  });
  it('maps weekly sets to heat against the 10–20 range', () => {
    expect(volumeHeat(0)).toBe(0);
    expect(volumeHeat(10)).toBe(0.5);
    expect(volumeHeat(25)).toBe(1);
  });
  it('adjusts fatigue by readiness', () => {
    expect(readinessAdjusted(50, 70)).toBe(50);
    expect(readinessAdjusted(50, 40)).toBe(65);
    expect(readinessAdjusted(50, 90)).toBe(40);
    expect(readinessAdjusted(0, 30)).toBe(0);
    expect(readinessAdjusted(95, 20)).toBe(100);
  });
  it('recommends Ready / Train light / Rest', () => {
    expect(recommendation(10)).toBe('Ready');
    expect(recommendation(45)).toBe('Train light');
    expect(recommendation(60)).toBe('Train light');
    expect(recommendation(61)).toBe('Rest');
  });
  it('estimates hours until recovered', () => {
    expect(hoursToRecovered(2, 48)).toBe(0);
    expect(hoursToRecovered(6, 48)).toBe(48);
    expect(hoursToRecovered(12, 36)).toBe(72);
  });
});
