import type { Muscle } from './types';
import { MUSCLES } from './types';

export const RECOVERING_PCT = 60;

export interface FatigueSet {
  time: number; // ms
  primary: Muscle[];
  secondary: Muscle[];
}

/** 60h if last sleep < 6h or protein target missed; 36h if last sleep ≥ 7.5h; otherwise 48h. */
export function halfLifeHours(lastSleep: number | undefined, proteinMissed: boolean): number {
  if (proteinMissed || (lastSleep !== undefined && lastSleep < 6)) return 60;
  if (lastSleep !== undefined && lastSleep >= 7.5) return 36;
  return 48;
}

/** Fatigue units per muscle at `now`. Primary +1.0, secondary +0.5 per working set. */
export function muscleFatigue(sets: FatigueSet[], now: number, halfLife: number): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const s of sets) {
    if (s.time > now) continue;
    const left = Math.pow(0.5, (now - s.time) / 3_600_000 / halfLife);
    for (const m of s.primary) out[m] += left;
    for (const m of s.secondary) out[m] += 0.5 * left;
  }
  return out;
}

/** 0–100%, 10 units = 100%. */
export const fatiguePercent = (units: number) => Math.round(Math.min(100, (units / 10) * 100));
