// Fuel: serving maths, target overrides, adaptive TDEE, adherence, carb timing. Pure.
import type { Goal, Nutrients, ServingUnit, TargetOverride } from './types';
import type { NutritionTargets } from './analysis';
import { addDays, dayNum, linreg, mean } from './util';

export const OZ_G = 28.3495;
export const KCAL_PER_KG = 7700;
export const GOAL_KCAL_ADJ: Record<Goal, number> = { muscle: 250, fatloss: -400, recomp: 0, strength: 150 };

// ---------- Servings ----------

export interface FoodLike {
  per100: Nutrients;
  servingGrams?: number;
  pieceGrams?: number;
}

/** Units a food can be logged in. ml is treated as grams (density ≈ 1). */
export function unitsFor(f: FoodLike): ServingUnit[] {
  const u: ServingUnit[] = [];
  if (f.servingGrams) u.push('serving');
  if (f.pieceGrams) u.push('piece');
  u.push('g', 'oz', 'ml');
  return u;
}

export function gramsFor(f: FoodLike, qty: number, unit: ServingUnit): number {
  if (!(qty > 0)) return 0;
  switch (unit) {
    case 'g':
    case 'ml':
      return qty;
    case 'oz':
      return qty * OZ_G;
    case 'piece':
      return qty * (f.pieceGrams ?? 100);
    case 'serving':
      return qty * (f.servingGrams ?? 100);
  }
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const k = grams / 100;
  const out: Nutrients = { kcal: Math.round(per100.kcal * k), protein: r1(per100.protein * k), carbs: r1(per100.carbs * k), fat: r1(per100.fat * k) };
  if (per100.fiber !== undefined) out.fiber = r1(per100.fiber * k);
  if (per100.sugar !== undefined) out.sugar = r1(per100.sugar * k);
  if (per100.sodium !== undefined) out.sodium = Math.round(per100.sodium * k);
  return out;
}

export const nutrientsFor = (f: FoodLike, qty: number, unit: ServingUnit) => scaleNutrients(f.per100, gramsFor(f, qty, unit));

export function sumNutrients(list: Partial<Nutrients>[]): Nutrients {
  const s = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  for (const n of list) for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] += n[k] ?? 0;
  return { kcal: Math.round(s.kcal), protein: r1(s.protein), carbs: r1(s.carbs), fat: r1(s.fat), fiber: r1(s.fiber), sugar: r1(s.sugar), sodium: Math.round(s.sodium) };
}

/** Recipe: per-100 g values and the gram weight of one serving. */
export function recipeNutrition(items: { per100: Nutrients; grams: number }[], servings: number) {
  const totalGrams = items.reduce((a, i) => a + i.grams, 0);
  const total = sumNutrients(items.map((i) => scaleNutrients(i.per100, i.grams)));
  const per100 = totalGrams > 0 ? scaleNutrients(total, (100 / totalGrams) * 100) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return { per100, totalGrams, servingGrams: totalGrams / Math.max(1, servings), total };
}

/** Default diary slot (0 breakfast, 1 lunch, 2 dinner, 3 snacks) from an HH:MM time. */
export function slotForTime(time: string): number {
  const h = Number(time.slice(0, 2));
  if (h < 11) return 0;
  if (h < 15) return 1;
  if (h >= 17 && h < 21) return 2;
  return 3;
}

// ---------- Targets ----------

/** User overrides on top of engine targets. `pct` (of calories) beats per-macro grams. */
export function applyTargetOverride(base: NutritionTargets, o?: TargetOverride): NutritionTargets {
  if (!o) return base;
  const kcal = o.kcal ?? base.kcal;
  if (o.pct) {
    return { ...base, kcal, protein: Math.round((kcal * o.pct.protein) / 400), carbs: Math.round((kcal * o.pct.carbs) / 400), fat: Math.round((kcal * o.pct.fat) / 900) };
  }
  const protein = o.protein ?? base.protein;
  const fat = o.fat ?? base.fat;
  const carbs = o.carbs ?? (o.kcal !== undefined ? Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)) : base.carbs);
  return { ...base, kcal, protein, carbs, fat };
}

export const macroPct = (t: { protein: number; carbs: number; fat: number }) => {
  const k = t.protein * 4 + t.carbs * 4 + t.fat * 9 || 1;
  return { protein: Math.round((t.protein * 400) / k), carbs: Math.round((t.carbs * 400) / k), fat: Math.round((t.fat * 900) / k) };
};

// ---------- Adaptive TDEE ----------

export interface TdeeDay {
  date: string;
  kcal?: number; // total logged intake; undefined/0 = not logged
  weightKg?: number;
}

export type TdeeConfidence = 'low' | 'medium' | 'high';

export interface TdeeEstimate {
  tdee: number;
  confidence: TdeeConfidence;
  intakeDays: number;
  weightDays: number;
  avgIntake: number;
  trendKgPerWeek: number;
  weekly: { date: string; tdee: number }[]; // smoothed, oldest first
}

export const TDEE_MIN_DAYS = 14;

/** One raw estimate from the window (end-27 … end): avgIntake − weightTrendPerDay × 7700. */
export function rawTdee(days: TdeeDay[], end: string, windowDays = 28) {
  const from = addDays(end, -(windowDays - 1));
  const w = days.filter((d) => d.date >= from && d.date <= end);
  const intake = w.filter((d) => (d.kcal ?? 0) > 0).map((d) => d.kcal!);
  const weights = w.filter((d) => d.weightKg !== undefined).map((d) => ({ x: dayNum(d.date), y: d.weightKg! }));
  if (intake.length < TDEE_MIN_DAYS || weights.length < 7) return null;
  const fit = linreg(weights);
  if (!fit) return null;
  const avgIntake = mean(intake);
  return { tdee: avgIntake - fit.slope * KCAL_PER_KG, avgIntake, slope: fit.slope, intakeDays: intake.length, weightDays: weights.length };
}

/** Maintenance estimate, smoothed weekly (EMA over the last 8 weekly estimates). Null until 14+ days of logs. */
export function adaptiveTdee(days: TdeeDay[], today: string): TdeeEstimate | null {
  const weekly: { date: string; tdee: number }[] = [];
  let ema: number | null = null;
  for (let k = 7; k >= 0; k--) {
    const end = addDays(today, -7 * k);
    const r = rawTdee(days, end);
    if (!r) continue;
    ema = ema === null ? r.tdee : 0.5 * r.tdee + 0.5 * ema;
    weekly.push({ date: end, tdee: Math.round(ema / 10) * 10 });
  }
  const now = rawTdee(days, today);
  if (!now || ema === null) return null;
  const confidence: TdeeConfidence =
    now.intakeDays >= 24 && now.weightDays >= 20 && weekly.length >= 3 ? 'high' : now.intakeDays >= 18 && now.weightDays >= 12 ? 'medium' : 'low';
  return {
    tdee: Math.round(ema / 10) * 10,
    confidence,
    intakeDays: now.intakeDays,
    weightDays: now.weightDays,
    avgIntake: Math.round(now.avgIntake),
    trendKgPerWeek: Math.round(now.slope * 7 * 100) / 100,
    weekly,
  };
}

/** Suggested daily target from an estimated maintenance and the goal. */
export const tdeeTarget = (tdee: number, goal: Goal) => Math.round((tdee + GOAL_KCAL_ADJ[goal]) / 10) * 10;

// ---------- Adherence ----------

export type DayAdherence = 'hit' | 'close' | 'miss' | 'none';

/** hit: protein ≥ target and kcal within ±10%. close: protein ≥ 90% and kcal within ±20%. */
export function dayAdherence(total: { kcal: number; protein: number } | undefined, target: { kcal: number; protein: number }): DayAdherence {
  if (!total || total.kcal <= 0) return 'none';
  const kOff = Math.abs(total.kcal - target.kcal) / target.kcal;
  if (total.protein >= target.protein && kOff <= 0.1) return 'hit';
  if (total.protein >= target.protein * 0.9 && kOff <= 0.2) return 'close';
  return 'miss';
}

/** A day eaten under 75% of the calorie target slows recovery like a missed protein day. */
export const bigDeficit = (intake: number, targetKcal: number) => intake > 0 && intake < targetKcal * 0.75;

/** Average daily intake minus target over logged days (null if fewer than 3 logged). */
export function kcalBalance(days: { kcal: number; target: number }[]): number | null {
  const logged = days.filter((d) => d.kcal > 0);
  if (logged.length < 3) return null;
  return Math.round(mean(logged.map((d) => d.kcal - d.target)));
}

// ---------- Pre-workout carb timing ----------

export const CARB_TIMING_MIN_WEEKS = 4;

/**
 * @param sessions carbs eaten in the 3 h before each session and performance (% e1RM change vs previous)
 * Returns a suggestive (not causal) line, or null when there is not enough data.
 */
export function carbTimingInsight(sessions: { preCarbs: number; perf: number }[], weeksOfData: number): string | null {
  if (weeksOfData < CARB_TIMING_MIN_WEEKS) return null;
  const hi = sessions.filter((s) => s.preCarbs >= 40);
  const lo = sessions.filter((s) => s.preCarbs < 40);
  if (hi.length < 3 || lo.length < 3) return null;
  const diff = mean(hi.map((s) => s.perf)) - mean(lo.map((s) => s.perf));
  const d = Math.round(Math.abs(diff) * 10) / 10;
  if (diff > 0.5) return `Suggestive: sessions with 40 g+ carbs in the 3 h before averaged ${d}% better e1RM change`;
  if (diff < -0.5) return `Suggestive: pre-workout carbs did not line up with better sessions (${d}% lower)`;
  return 'Suggestive: no clear link between pre-workout carbs and performance yet';
}
