// Thermal Body: palette, heat modes, recovery estimate and recommendation. Pure.
import { VOLUME_RANGE } from './analysis';

/** Thermal palette stops (0 → 1). */
export const THERMAL_STOPS: [number, string][] = [
  [0, '#0B1A3A'],
  [0.25, '#4B2C8C'],
  [0.5, '#C2306B'],
  [0.75, '#FF6A2B'],
  [1, '#FFE86B'],
];

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** RGB (0–255) on the thermal palette for t in 0–1 (clamped). */
export function thermalRgb(t: number): [number, number, number] {
  const k = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  let i = 0;
  while (i < THERMAL_STOPS.length - 2 && k > THERMAL_STOPS[i + 1][0]) i++;
  const [t0, c0] = THERMAL_STOPS[i];
  const [t1, c1] = THERMAL_STOPS[i + 1];
  const f = (k - t0) / (t1 - t0);
  const a = hexRgb(c0);
  const b = hexRgb(c1);
  return a.map((v, j) => Math.round(v + (b[j] - v) * f)) as [number, number, number];
}

export const thermalCss = (t: number) => `rgb(${thermalRgb(t).join(',')})`;

export type HeatMode = 'fatigue' | 'volume' | 'readiness';

/** Weekly sets → heat: 0 sets = 0, top of the 10–20 range (20) or more = 1. */
export const volumeHeat = (sets: number) => Math.max(0, Math.min(1, sets / VOLUME_RANGE.max));

/**
 * Readiness-adjusted fatigue %: low readiness makes fatigue count for more, high readiness for less.
 * Each point of readiness under 70 adds 0.5 %, each point over 70 removes 0.5 % (clamped 0–100).
 */
export function readinessAdjusted(fatiguePct: number, readiness: number): number {
  if (fatiguePct <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, fatiguePct + (70 - readiness) * 0.5)));
}

export const READY_PCT = 30;

export type Recommendation = 'Ready' | 'Train light' | 'Rest';

/** Under 30 % Ready, 30–60 % Train light, over 60 % Rest. */
export function recommendation(pct: number): Recommendation {
  if (pct < READY_PCT) return 'Ready';
  if (pct <= 60) return 'Train light';
  return 'Rest';
}

/** Hours until fatigue falls under 30 % (3 units) at the given half-life. 0 if already there. */
export function hoursToRecovered(units: number, halfLifeHours: number): number {
  const limit = READY_PCT / 10;
  if (units <= limit) return 0;
  return Math.ceil(halfLifeHours * Math.log2(units / limit));
}
