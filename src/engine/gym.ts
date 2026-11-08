import type { Equipment, Exercise, Units } from './types';
import { roundTo } from './util';

export const BAR = { lb: 45, kg: 20 };
const PLATES = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };

export const isCompound = (ex: Exercise) => ex.pattern !== 'isolation';

/** Rest timer default: compound vs isolation. */
export const restSeconds = (ex: Exercise, p: { restCompoundSec: number; restIsolationSec: number }) =>
  isCompound(ex) ? p.restCompoundSec : p.restIsolationSec;

export interface WarmupSet {
  weight: number;
  reps: number;
  label: string;
}

/** Warm-ups: bar (barbell only), 40%, 60%, 80% of the working weight. */
export function warmupSets(work: number, units: Units, usesBar: boolean): WarmupSet[] {
  const step = units === 'lb' ? 5 : 2.5;
  const bar = BAR[units];
  const out: WarmupSet[] = [];
  if (usesBar) out.push({ weight: bar, reps: 10, label: 'Bar' });
  for (const [pct, reps] of [[0.4, 8], [0.6, 5], [0.8, 3]] as const) {
    const w = roundTo(work * pct, step);
    const floor = usesBar ? bar : 0;
    if (w <= floor || w >= work || out.some((s) => s.weight === w)) continue;
    out.push({ weight: w, reps, label: `${pct * 100}%` });
  }
  return out;
}

/** Plates per side for a barbell load. `remainder` = what could not be matched per side. */
export function platesPerSide(total: number, units: Units): { plates: number[]; remainder: number } {
  let side = (total - BAR[units]) / 2;
  const plates: number[] = [];
  if (side <= 0) return { plates, remainder: 0 };
  for (const p of PLATES[units]) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side -= p;
    }
  }
  return { plates, remainder: Math.round(side * 100) / 100 };
}

// ---------- Substitution ----------

/** Load relative to a barbell for the same movement (dumbbell = per hand). */
export const EQUIPMENT_RATIO: Record<Equipment, number> = {
  barbell: 1,
  smith: 0.9,
  machine: 1,
  cable: 0.7,
  dumbbell: 0.4,
  kettlebell: 0.4,
  bodyweight: 0,
};

/** Same pattern + sharing a primary muscle, best overlap first. */
export function substitutes(ex: Exercise, library: Exercise[]): Exercise[] {
  return library
    .filter((o) => o.id !== ex.id && o.pattern === ex.pattern)
    .map((o) => ({ o, overlap: o.primaryMuscles.filter((m) => ex.primaryMuscles.includes(m)).length }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.o.name.localeCompare(b.o.name))
    .map((x) => x.o);
}

/** Convert a working weight between equipment types. null if either is bodyweight. */
export function convertWeight(w: number, from: Equipment, to: Equipment, step: number): number | null {
  const a = EQUIPMENT_RATIO[from];
  const b = EQUIPMENT_RATIO[to];
  if (!a || !b) return null;
  return roundTo((w * b) / a, step);
}
