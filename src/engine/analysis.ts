import type { Goal, Muscle, Sex } from './types';
import { MUSCLES } from './types';
import { addDays, daysBetween, dayNum, linreg, mean } from './util';

// ---------- Plateau ----------

/** Per-session best e1RM, oldest first. Plateau = the last 3 sessions never beat the best before them. */
export function isPlateau(e1rms: number[]): boolean {
  if (e1rms.length < 4) return false;
  const before = Math.max(...e1rms.slice(0, -3));
  return Math.max(...e1rms.slice(-3)) <= before;
}

export type PlateauFix = 'deload' | 'add a set' | 'raise calories ~200' | 'change rep range or variation';

export function plateauFix(p: { avgReadiness7d: number; weeklySetsPrimary: number; bodyWeightFalling: boolean }): PlateauFix {
  if (p.avgReadiness7d < 60) return 'deload';
  if (p.weeklySetsPrimary < 10) return 'add a set';
  if (p.bodyWeightFalling) return 'raise calories ~200';
  return 'change rep range or variation';
}

// ---------- Deload trigger ----------

/** `dailyReadiness`: consecutive days, oldest first. */
export function deloadCheck(dailyReadiness: number[], plateauCount: number): { deload: boolean; reason: string } {
  let streak = 0;
  for (let i = dailyReadiness.length - 1; i >= 0 && dailyReadiness[i] < 55; i--) streak++;
  if (streak >= 5) return { deload: true, reason: `Readiness under 55 for ${streak} days straight` };
  if (plateauCount >= 3) return { deload: true, reason: `${plateauCount} lifts have plateaued` };
  return { deload: false, reason: '' };
}

export const DELOAD_PRESCRIPTION = 'Deload week: 60% of your usual sets, same weights.';

// ---------- Projections ----------

export interface Projection {
  ratePerWeek: number; // e1RM units per week, after what-ifs
  projectedDate: string | null;
  current: number;
  line: { date: string; value: number }[]; // fitted + projected points for charting
}

/**
 * Linear regression on the last 6 weeks of e1RM. What-ifs each add +10% to the rate (an estimate).
 */
export function projectGoal(
  points: { date: string; e1rm: number }[],
  goal: number,
  today: string,
  whatIf: { sleep8h?: boolean; proteinDaily?: boolean } = {},
): Projection | null {
  const recent = points.filter((p) => daysBetween(p.date, today) <= 42 && daysBetween(p.date, today) >= 0);
  const fit = linreg(recent.map((p) => ({ x: dayNum(p.date), y: p.e1rm })));
  if (!fit) return null;
  const mult = 1 + (whatIf.sleep8h ? 0.1 : 0) + (whatIf.proteinDaily ? 0.1 : 0);
  const slope = fit.slope * mult;
  const t0 = dayNum(today);
  const current = fit.intercept + fit.slope * t0;
  let projectedDate: string | null = null;
  if (current >= goal) projectedDate = today;
  else if (slope > 0) projectedDate = addDays(today, Math.ceil((goal - current) / slope - 1e-6));

  const first = recent[0].date;
  const end = projectedDate && daysBetween(today, projectedDate) < 365 ? projectedDate : addDays(today, 56);
  const line = [
    { date: first, value: fit.intercept + fit.slope * dayNum(first) },
    { date: today, value: current },
    { date: end, value: current + slope * daysBetween(today, end) },
  ].map((p) => ({ ...p, value: Math.round(p.value * 10) / 10 }));

  return { ratePerWeek: Math.round(slope * 7 * 10) / 10, projectedDate, current: Math.round(current * 10) / 10, line };
}

// ---------- Body composition signal ----------

export interface BodyCompSignal {
  label: string;
  suggestion: string;
  weightRatePctPerWeek: number;
}

/**
 * @param weights body weights from the last 14 days
 * @param strengthChangePct average e1RM change over the same 14 days, in %
 */
export function bodyCompSignal(weights: { date: string; value: number }[], strengthChangePct: number): BodyCompSignal {
  const fit = linreg(weights.map((w) => ({ x: dayNum(w.date), y: w.value })));
  if (weights.length < 4 || !fit) {
    return { label: 'Not enough data', suggestion: 'Log body weight most mornings for 2 weeks.', weightRatePctPerWeek: 0 };
  }
  const rate = Math.round(((fit.slope * 7) / mean(weights.map((w) => w.value))) * 1000) / 10; // %/week
  const strength = strengthChangePct > 1 ? 'up' : strengthChangePct < -1 ? 'down' : 'flat';
  const r = { weightRatePctPerWeek: rate };

  if (rate > 0.1 && rate <= 0.5 && strength === 'up')
    return { ...r, label: 'Likely building muscle', suggestion: 'Keep calories where they are.' };
  if (rate > 0.5 && strength !== 'up')
    return { ...r, label: 'Likely gaining fat', suggestion: 'Cut ~200 kcal/day.' };
  if (rate < -0.1 && strength !== 'down')
    return { ...r, label: 'Likely losing fat', suggestion: 'Deficit is working: keep protein high.' };
  if (rate < -0.1 && strength === 'down')
    return { ...r, label: 'Muscle-loss risk', suggestion: 'Add ~200–300 kcal/day and keep protein at 2.2 g/kg.' };
  return { ...r, label: 'Holding steady', suggestion: 'No change needed; adjust calories to match your goal.' };
}

// ---------- Nutrition targets ----------

export interface NutritionTargets {
  bmr: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function nutritionTargets(
  p: { weightKg: number; heightCm: number; age: number; sex?: Sex; goal: Goal },
  trainingDay: boolean,
): NutritionTargets {
  const sexAdj = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sexAdj;
  const goalAdj = { muscle: 250, fatloss: -400, recomp: 0, strength: 150 }[p.goal];
  const kcal = Math.round((bmr * 1.55 + goalAdj + (trainingDay ? 150 : 0)) / 10) * 10;
  const perKg = p.goal === 'fatloss' ? 1.8 : p.goal === 'recomp' ? 2.2 : 2.0;
  const protein = Math.round(p.weightKg * perKg);
  const fat = Math.round(p.weightKg * 0.8);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), kcal, protein, carbs, fat };
}

// ---------- Weekly volume ----------

export const VOLUME_RANGE = { min: 10, max: 20 };

/** Hard sets per muscle: primary counts 1, secondary 0.5. */
export function weeklySets(sets: { primary: Muscle[]; secondary: Muscle[] }[]): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const s of sets) {
    for (const m of s.primary) out[m] += 1;
    for (const m of s.secondary) out[m] += 0.5;
  }
  return out;
}

export const volumeStatus = (n: number) => (n < VOLUME_RANGE.min ? 'under' : n > VOLUME_RANGE.max ? 'over' : 'ok');

// ---------- DOTS ----------

const DOTS_COEF = {
  male: [-0.000001093, 0.0007391293, -0.1918759221, 24.0900756, -307.75076],
  female: [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288],
};

/** DOTS score for a total (kg) at a body weight (kg). Unknown sex uses the men's formula. */
export function dots(totalKg: number, bodyWeightKg: number, sex: Sex = 'male'): number {
  const [a, b, c, d, e] = DOTS_COEF[sex];
  const x = Math.min(Math.max(bodyWeightKg, 40), sex === 'male' ? 210 : 150);
  const denom = a * x ** 4 + b * x ** 3 + c * x ** 2 + d * x + e;
  return Math.round(((totalKg * 500) / denom) * 100) / 100;
}

/** Which DOTS lift an exercise counts toward. */
export function dotsLift(exerciseId: string): 'squat' | 'bench' | 'deadlift' | null {
  if (/squat/.test(exerciseId) && !/split|goblet/.test(exerciseId)) return 'squat';
  if (/bench-press/.test(exerciseId)) return 'bench';
  if (/deadlift/.test(exerciseId) && !/romanian/.test(exerciseId)) return 'deadlift';
  return null;
}
