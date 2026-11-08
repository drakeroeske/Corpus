import { describe, expect, it } from 'vitest';
import {
  adaptiveTdee,
  applyTargetOverride,
  bigDeficit,
  bodyCompSignal,
  carbTimingInsight,
  dayAdherence,
  gramsFor,
  halfLifeHours,
  kcalBalance,
  macroPct,
  nutrientsFor,
  plateauFix,
  rawTdee,
  recipeNutrition,
  slotForTime,
  sumNutrients,
  tdeeTarget,
  unitsFor,
  weeklyInsights,
  addDays,
  type TdeeDay,
} from './index';

const oats = { per100: { kcal: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6, sodium: 2 }, servingGrams: 40, pieceGrams: undefined };
const egg = { per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, pieceGrams: 50 };

describe('servings', () => {
  it('converts units to grams', () => {
    expect(gramsFor(oats, 2, 'serving')).toBe(80);
    expect(gramsFor(egg, 3, 'piece')).toBe(150);
    expect(gramsFor(oats, 1, 'oz')).toBeCloseTo(28.35, 1);
    expect(gramsFor(oats, 250, 'ml')).toBe(250);
    expect(gramsFor(oats, -1, 'g')).toBe(0);
  });
  it('lists only units the food supports', () => {
    expect(unitsFor(oats)).toEqual(['serving', 'g', 'oz', 'ml']);
    expect(unitsFor(egg)).toEqual(['piece', 'g', 'oz', 'ml']);
  });
  it('scales nutrients live from quantity', () => {
    const n = nutrientsFor(oats, 1, 'serving');
    expect(n).toEqual({ kcal: 156, protein: 6.8, carbs: 26.4, fat: 2.8, fiber: 4.2, sodium: 1 });
    expect(nutrientsFor(egg, 2, 'piece').kcal).toBe(143);
  });
  it('sums nutrients', () => {
    expect(sumNutrients([{ kcal: 100, protein: 10 }, { kcal: 50.4, protein: 2.25 }])).toMatchObject({ kcal: 150, protein: 12.3 });
  });
  it('builds recipe per-100 and serving weight', () => {
    const r = recipeNutrition([{ per100: oats.per100, grams: 80 }, { per100: egg.per100, grams: 120 }], 2);
    expect(r.totalGrams).toBe(200);
    expect(r.servingGrams).toBe(100);
    expect(r.total.kcal).toBe(311 + 172);
    expect(r.per100.kcal).toBe(242);
  });
  it('picks a diary slot from the time', () => {
    expect(slotForTime('07:30')).toBe(0);
    expect(slotForTime('12:30')).toBe(1);
    expect(slotForTime('16:00')).toBe(3);
    expect(slotForTime('19:30')).toBe(2);
    expect(slotForTime('21:00')).toBe(3);
  });
});

describe('target overrides', () => {
  const base = { bmr: 1800, kcal: 2800, protein: 160, carbs: 350, fat: 70 };
  it('returns engine targets with no override', () => expect(applyTargetOverride(base)).toBe(base));
  it('overrides single macros', () => expect(applyTargetOverride(base, { protein: 200 })).toMatchObject({ kcal: 2800, protein: 200, carbs: 350, fat: 70 }));
  it('recomputes carbs when only kcal is overridden', () => expect(applyTargetOverride(base, { kcal: 2400 }).carbs).toBe(Math.round((2400 - 640 - 630) / 4)));
  it('sets macros by % of calories', () => {
    expect(applyTargetOverride(base, { kcal: 2000, pct: { protein: 30, carbs: 40, fat: 30 } })).toMatchObject({ kcal: 2000, protein: 150, carbs: 200, fat: 67 });
  });
  it('reports macro split in %', () => expect(macroPct({ protein: 150, carbs: 200, fat: 67 })).toEqual({ protein: 30, carbs: 40, fat: 30 }));
});

describe('adaptive TDEE', () => {
  const today = '2026-03-31';
  // 8 weeks eating 2600 while losing 0.25 kg/week → TDEE ≈ 2600 + 0.25/7 × 7700 ≈ 2875
  const days: TdeeDay[] = Array.from({ length: 56 }, (_, i) => ({
    date: addDays(today, i - 55),
    kcal: 2600,
    weightKg: 82 - (0.25 / 7) * i,
  }));

  it('needs 14+ days of intake and weight', () => {
    expect(adaptiveTdee(days.slice(-13), today)).toBeNull();
    expect(rawTdee(days.slice(-14), today)).not.toBeNull();
  });
  it('estimates maintenance from intake and weight trend', () => {
    const e = adaptiveTdee(days, today)!;
    expect(Math.abs(e.tdee - 2875)).toBeLessThanOrEqual(10);
    expect(e.trendKgPerWeek).toBeCloseTo(-0.25, 2);
    expect(e.confidence).toBe('high');
    expect(e.weekly.length).toBeGreaterThanOrEqual(3);
  });
  it('gives low confidence with sparse logs', () => {
    const sparse = days.slice(-20).map((d, i) => ({ ...d, weightKg: i % 2 ? undefined : d.weightKg }));
    expect(adaptiveTdee(sparse, today)!.confidence).toBe('low');
  });
  it('smooths week-to-week jumps', () => {
    const jump = days.map((d, i) => (i >= 49 ? { ...d, kcal: 3600 } : d));
    const e = adaptiveTdee(jump, today)!;
    const raw = rawTdee(jump, today)!.tdee;
    expect(e.tdee).toBeLessThan(raw);
  });
  it('turns maintenance into a goal target', () => {
    expect(tdeeTarget(2875, 'fatloss')).toBe(2480);
    expect(tdeeTarget(2875, 'muscle')).toBe(3130);
  });
});

describe('adherence and calorie balance', () => {
  const t = { kcal: 2500, protein: 160 };
  it('grades days', () => {
    expect(dayAdherence({ kcal: 2550, protein: 165 }, t)).toBe('hit');
    expect(dayAdherence({ kcal: 2900, protein: 150 }, t)).toBe('close');
    expect(dayAdherence({ kcal: 1500, protein: 90 }, t)).toBe('miss');
    expect(dayAdherence(undefined, t)).toBe('none');
  });
  it('flags a big deficit', () => {
    expect(bigDeficit(1800, 2500)).toBe(true);
    expect(bigDeficit(2000, 2500)).toBe(false);
    expect(bigDeficit(0, 2500)).toBe(false);
  });
  it('big deficit slows fatigue decay to 60h', () => {
    expect(halfLifeHours(8, false, true)).toBe(60);
    expect(halfLifeHours(8, false, false)).toBe(36);
  });
  it('averages balance over logged days', () => {
    expect(kcalBalance([{ kcal: 2700, target: 2500 }, { kcal: 2600, target: 2500 }])).toBeNull();
    expect(kcalBalance([{ kcal: 2700, target: 2500 }, { kcal: 2600, target: 2500 }, { kcal: 0, target: 2500 }, { kcal: 2800, target: 2500 }])).toBe(200);
  });
  it('eating under target makes calories the plateau fix', () => {
    expect(plateauFix({ avgReadiness7d: 70, weeklySetsPrimary: 12, bodyWeightFalling: false, eatingUnder: true })).toBe('raise calories ~200');
  });
  it('body-comp suggestion uses calorie balance', () => {
    const w = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-03-01', i), value: 80 + i * 0.1 }));
    expect(bodyCompSignal(w, 0).suggestion).toBe('Cut ~200 kcal/day.');
    expect(bodyCompSignal(w, 0, 400).suggestion).toBe('You average 400 kcal over target: cut ~200 kcal/day.');
  });
  it('lab report mentions calories', () => {
    const base = { sessionsDone: 3, sessionsPlanned: 4, sleepHours: [], proteinDays: { logged: 0, hit: 0 }, e1rmChanges: [], plateaued: [], underVolume: [], sessionsBySleep: [], avgReadiness: 70 };
    expect(weeklyInsights({ ...base, kcal: { logged: 5, avg: 2100, target: 2600 } }).insights).toContain('Calories averaged 500 kcal/day under target');
    expect(weeklyInsights({ ...base, kcal: { logged: 5, avg: 2550, target: 2600 } }).insights).toContain('Calories on target: 2550 kcal/day average');
  });
});

describe('carb timing', () => {
  const s = [
    ...Array.from({ length: 4 }, () => ({ preCarbs: 70, perf: 2 })),
    ...Array.from({ length: 4 }, () => ({ preCarbs: 10, perf: 0.5 })),
  ];
  it('stays quiet before 4 weeks', () => expect(carbTimingInsight(s, 3)).toBeNull());
  it('is labeled suggestive', () => expect(carbTimingInsight(s, 5)).toMatch(/^Suggestive: .*1\.5% better/));
  it('needs enough sessions in each group', () => expect(carbTimingInsight(s.slice(0, 5), 6)).toBeNull());
});
