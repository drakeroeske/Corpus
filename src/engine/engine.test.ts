import { describe, expect, it } from 'vitest';
import {
  applyBreakMode,
  applyReadiness,
  bodyCompSignal,
  breakPhase,
  deloadCheck,
  dots,
  dotsLift,
  e1rm,
  fatiguePercent,
  firstWorkingSet,
  halfLifeHours,
  isPlateau,
  isPR,
  muscleFatigue,
  nextTarget,
  nutritionTargets,
  plateauFix,
  projectGoal,
  readiness,
  roundTo,
  volumeStatus,
  weeklySets,
  addDays,
  type CheckIn,
  type Exercise,
  type ProgramExercise,
} from './index';

const pe: ProgramExercise = { exerciseId: 'lat-pulldown', sets: 2, repMin: 8, repMax: 10, startWeight: 85, increment: 5 };
const h = (weight: number, reps: number, date = '2026-11-01') => ({ date, weight, reps });

describe('Progression', () => {
  it('uses the first working set, skipping warm-ups', () => {
    const s = firstWorkingSet([
      { exerciseId: 'a', setIndex: 0, weight: 45, reps: 10, isWarmup: true },
      { exerciseId: 'a', setIndex: 1, weight: 85, reps: 9, isWarmup: false },
      { exerciseId: 'a', setIndex: 2, weight: 90, reps: 7, isWarmup: false },
    ]);
    expect(s?.weight).toBe(85);
  });

  it('no history → start weight, or ask when there is none', () => {
    expect(nextTarget(pe, false, []).weight).toBe(85);
    const t = nextTarget({ ...pe, startWeight: undefined }, false, []);
    expect(t.weight).toBeNull();
    expect(t.action).toBe('ask');
  });

  it('reps ≥ repMax → weight + increment', () => {
    const t = nextTarget(pe, false, [h(85, 10)]);
    expect(t.weight).toBe(90);
    expect(t.action).toBe('increase');
  });

  it('repMin ≤ reps < repMax → same weight, reps + 1', () => {
    const t = nextTarget(pe, false, [h(85, 8)]);
    expect(t.weight).toBe(85);
    expect(t.repGoal).toBe(9);
  });

  it('reps < repMin once → hold', () => {
    expect(nextTarget(pe, false, [h(85, 6)]).action).toBe('hold');
    expect(nextTarget(pe, false, [h(85, 9), h(85, 6)]).weight).toBe(85);
  });

  it('below range 2 sessions in a row → −10% rounded to nearest increment', () => {
    expect(nextTarget(pe, false, [h(85, 7), h(85, 6)]).weight).toBe(75); // 76.5 → 75 (step 5)
    expect(nextTarget({ ...pe, increment: 2.5 }, false, [h(85, 7), h(85, 6)]).weight).toBe(77.5);
  });

  it('bodyweight at repMax → "add load"', () => {
    const t = nextTarget({ ...pe, increment: 0 }, true, [h(0, 10)]);
    expect(t.action).toBe('add-load');
    expect(t.why).toMatch(/add load/);
  });

  it('roundTo', () => {
    expect(roundTo(76.5, 5)).toBe(75);
    expect(roundTo(76.5, 2.5)).toBe(77.5);
    expect(roundTo(76.5, 0)).toBe(77.5);
  });
});

describe('e1RM and PRs', () => {
  it('weight × (1 + reps/30), 0.1', () => {
    expect(e1rm(100, 10)).toBe(133.3);
    expect(e1rm(135, 5)).toBe(157.5);
  });
  it('PR = new max; ties and bodyweight are not', () => {
    const prev = [{ weight: 100, reps: 8 }];
    expect(isPR({ weight: 100, reps: 9 }, prev)).toBe(true);
    expect(isPR({ weight: 100, reps: 8 }, prev)).toBe(false);
    expect(isPR({ weight: 0, reps: 20 }, [])).toBe(false);
  });
});

describe('Readiness', () => {
  const ci = (p: Partial<CheckIn>): CheckIn => ({ date: '2026-11-06', soreness: {}, notes: '', ...p });

  it('all six inputs perfect → 100, high confidence', () => {
    const r = readiness(ci({ sleepHours: 8, sleepQuality: 5, hrv: 60, energy: 5, stress: 1, soreness: { quads: 1 } }), ['quads'], [55, 60, 65]);
    expect(r.score).toBe(100);
    expect(r.confidence).toBe('high');
  });

  it('sleep: 8h = full, linear to 0 at 4h; missing inputs redistribute', () => {
    expect(readiness(ci({ sleepHours: 6 }), [], []).score).toBe(50);
    expect(readiness(ci({ sleepHours: 4 }), [], []).score).toBe(0);
    expect(readiness(ci({ sleepHours: 9 }), [], []).score).toBe(100);
  });

  it('HRV vs 7-day baseline: ≥ baseline full, 15% below = 0, linear between', () => {
    // sleep 30/30 + HRV 10% below → 6.67/20 → 36.67/50 = 73
    const r = readiness(ci({ sleepHours: 8, hrv: 54 }), [], [60, 60, 60]);
    expect(r.score).toBe(73);
    expect(r.reason).toBe('HRV 10% below baseline');
    expect(readiness(ci({ sleepHours: 8, hrv: 50 }), [], [60]).score).toBe(60);
    expect(readiness(ci({ sleepHours: 8, hrv: 70 }), [], [60]).score).toBe(100);
  });

  it('HRV without a baseline is treated as missing', () => {
    expect(readiness(ci({ sleepHours: 8, hrv: 30 }), [], []).score).toBe(100);
  });

  it('soreness of target muscles only, stress and energy inverted correctly', () => {
    expect(readiness(ci({ soreness: { quads: 5, chest: 1 } }), ['chest'], []).score).toBe(100);
    expect(readiness(ci({ stress: 5 }), [], []).score).toBe(0);
    expect(readiness(ci({ energy: 3 }), [], []).score).toBe(50);
  });

  it('reason names the top 2 negative factors', () => {
    const r = readiness(ci({ sleepHours: 5.5, energy: 3, soreness: { quads: 4 } }), ['quads'], []);
    expect(r.reason).toBe('5.5h sleep + sore quads');
    expect(r.score).toBe(38);
    expect(r.confidence).toBe('medium');
    expect(r.level).toBe('low');
  });

  it('confidence: ≤2 inputs low', () => {
    expect(readiness(ci({ sleepHours: 8, energy: 4 }), [], []).confidence).toBe('low');
  });

  it('no check-in → 70, low confidence', () => {
    const r = readiness(undefined, ['quads'], []);
    expect(r.score).toBe(70);
    expect(r.confidence).toBe('low');
    expect(r.reason).toMatch(/No check-in/);
  });

  it('effect: ≥75 normal, 50–74 hold, <50 −10% and 3 RIR cap', () => {
    const up = nextTarget(pe, false, [h(85, 10)]);
    expect(applyReadiness(up, 80, '', 5).weight).toBe(90);
    const held = applyReadiness(up, 60, '', 5);
    expect(held.weight).toBe(85);
    expect(held.why).toBe('Readiness moderate — holding weights');
    const low = applyReadiness(nextTarget(pe, false, [h(85, 9)]), 40, '5.5h sleep', 5);
    expect(low.weight).toBe(75);
    expect(low.rirCap).toBe(3);
    expect(low.why).toMatch(/5\.5h sleep/);
  });
});

describe('Muscle fatigue', () => {
  const H = 3_600_000;
  const now = 1000 * H;
  it('primary +1.0, secondary +0.5', () => {
    const f = muscleFatigue([{ time: now, primary: ['chest'], secondary: ['triceps'] }], now, 48);
    expect(f.chest).toBe(1);
    expect(f.triceps).toBe(0.5);
  });
  it('half-life 48h; 36h if sleep ≥ 7.5h; 60h if sleep < 6h or protein missed', () => {
    expect(halfLifeHours(7, false)).toBe(48);
    expect(halfLifeHours(undefined, false)).toBe(48);
    expect(halfLifeHours(8, false)).toBe(36);
    expect(halfLifeHours(5.5, false)).toBe(60);
    expect(halfLifeHours(8, true)).toBe(60);
    expect(muscleFatigue([{ time: now - 48 * H, primary: ['quads'], secondary: [] }], now, 48).quads).toBeCloseTo(0.5);
  });
  it('display 0–100%, 10 units = 100%', () => {
    expect(fatiguePercent(6.1)).toBe(61);
    expect(fatiguePercent(15)).toBe(100);
  });
});

describe('Return-from-break mode', () => {
  const start = '2026-11-02';
  const squat: Exercise = { id: 'back-squat', name: 'Back Squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: [], equipment: 'barbell', pattern: 'squat' };
  const curl: Exercise = { id: 'cable-curl', name: 'Cable Curl', primaryMuscles: ['biceps'], secondaryMuscles: [], equipment: 'cable', pattern: 'isolation' };

  it('off by default; weeks 1–2 Ramp, 3–4 Build, 5+ Done', () => {
    expect(breakPhase(null, start)).toBeNull();
    expect(breakPhase(start, '2026-11-15')?.name).toBe('Ramp');
    expect(breakPhase(start, '2026-11-16')?.name).toBe('Build');
    expect(breakPhase(start, '2026-11-30')?.name).toBe('Done');
  });

  it('Ramp: 65% of pre-break weight, stop 2–3 short, no failure techniques', () => {
    const t = { ...nextTarget({ ...pe, technique: 'failure' }, false, [h(200, 9, '2026-09-01')]) };
    const r = applyBreakMode(t, breakPhase(start, start), squat, start, '2026-09-01', 5);
    expect(r.weight).toBe(130);
    expect(r.technique).toBe('none');
    expect(r.rirCap).toBe(2);
    // After the first ramp session, progression continues from logged weights.
    expect(applyBreakMode(t, breakPhase(start, '2026-11-05'), squat, start, '2026-11-03', 5).weight).toBe(200);
  });

  it('Build: failure techniques only on upper-body isolation/machines', () => {
    const t = nextTarget({ ...pe, technique: 'failure' }, false, [h(50, 9)]);
    const phase = breakPhase(start, '2026-11-20');
    expect(applyBreakMode(t, phase, curl, start, '2026-11-19', 5).technique).toBe('failure');
    expect(applyBreakMode(t, phase, squat, start, '2026-11-19', 5).technique).toBe('none');
  });
});

describe('Plateau and deload', () => {
  it('no e1RM improvement across 3 sessions → plateau', () => {
    expect(isPlateau([100, 105, 104, 105, 103])).toBe(true);
    expect(isPlateau([100, 102, 104, 106])).toBe(false);
    expect(isPlateau([100, 100, 100])).toBe(false);
  });
  it('suggests one fix in priority order', () => {
    expect(plateauFix({ avgReadiness7d: 55, weeklySetsPrimary: 5, bodyWeightFalling: true })).toBe('deload');
    expect(plateauFix({ avgReadiness7d: 70, weeklySetsPrimary: 8, bodyWeightFalling: true })).toBe('add a set');
    expect(plateauFix({ avgReadiness7d: 70, weeklySetsPrimary: 12, bodyWeightFalling: true })).toBe('raise calories ~200');
    expect(plateauFix({ avgReadiness7d: 70, weeklySetsPrimary: 12, bodyWeightFalling: false })).toBe('change rep range or variation');
  });
  it('deload: readiness < 55 for 5+ days, or ≥ 3 plateaus', () => {
    expect(deloadCheck([60, 54, 50, 52, 53, 54], 0).deload).toBe(true);
    expect(deloadCheck([50, 50, 50, 50, 60], 0).deload).toBe(false);
    expect(deloadCheck([80], 3).deload).toBe(true);
  });
});

describe('Projections', () => {
  const pts = [0, 7, 14, 21, 28, 35].map((d) => ({ date: addDays('2026-10-02', d), e1rm: 100 + 0.5 * d }));
  pts.unshift({ date: '2026-08-01', e1rm: 10 }); // older than 6 weeks: ignored
  it('linear regression to a goal date', () => {
    const p = projectGoal(pts, 125, '2026-11-06')!;
    expect(p.current).toBe(117.5);
    expect(p.ratePerWeek).toBe(3.5);
    expect(p.projectedDate).toBe('2026-11-21');
  });
  it('what-ifs each add +10% to the rate', () => {
    const p = projectGoal(pts, 125, '2026-11-06', { sleep8h: true, proteinDaily: true })!;
    expect(p.ratePerWeek).toBe(4.2);
    expect(p.projectedDate).toBe('2026-11-19');
  });
  it('goal already reached → today; too little data → null', () => {
    expect(projectGoal(pts, 110, '2026-11-06')!.projectedDate).toBe('2026-11-06');
    expect(projectGoal(pts.slice(0, 2), 200, '2026-11-06')).toBeNull();
  });
});

describe('Body composition signal', () => {
  const series = (from: number, to: number) =>
    Array.from({ length: 8 }, (_, i) => ({ date: addDays('2026-10-24', i * 2), value: from + ((to - from) * i) / 7 }));
  it('maps weight and strength trends', () => {
    expect(bodyCompSignal(series(180, 180.7), 3).label).toBe('Likely building muscle');
    expect(bodyCompSignal(series(180, 183), 0).label).toBe('Likely gaining fat');
    expect(bodyCompSignal(series(180, 178), 0).label).toBe('Likely losing fat');
    expect(bodyCompSignal(series(180, 178), -3).label).toBe('Muscle-loss risk');
    expect(bodyCompSignal(series(180, 178), -3).suggestion).toMatch(/kcal/);
    expect(bodyCompSignal(series(180, 178).slice(0, 3), 0).label).toBe('Not enough data');
  });
});

describe('Nutrition targets', () => {
  const p = { weightKg: 80, heightCm: 180, age: 30, sex: 'male' as const };
  it('Mifflin–St Jeor × 1.55 + goal; protein by goal; +150 on training days', () => {
    const t = nutritionTargets({ ...p, goal: 'muscle' }, false);
    expect(t.bmr).toBe(1780);
    expect(t.kcal).toBe(3010);
    expect(t.protein).toBe(160);
    expect(nutritionTargets({ ...p, goal: 'muscle' }, true).kcal).toBe(3160);
    expect(nutritionTargets({ ...p, goal: 'fatloss' }, false)).toMatchObject({ kcal: 2360, protein: 144 });
    expect(nutritionTargets({ ...p, goal: 'recomp' }, false).protein).toBe(176);
    expect(nutritionTargets({ ...p, goal: 'strength' }, false).kcal).toBe(2910);
    expect(nutritionTargets({ ...p, sex: 'female', goal: 'recomp' }, false).bmr).toBe(1614);
  });
});

describe('Weekly volume and DOTS', () => {
  it('counts hard sets per muscle and flags the 10–20 range', () => {
    const v = weeklySets([{ primary: ['chest'], secondary: ['triceps'] }, { primary: ['chest'], secondary: [] }]);
    expect(v.chest).toBe(2);
    expect(v.triceps).toBe(0.5);
    expect(volumeStatus(8)).toBe('under');
    expect(volumeStatus(15)).toBe('ok');
    expect(volumeStatus(22)).toBe('over');
  });
  it('DOTS formula', () => {
    expect(dots(500, 100, 'male')).toBeCloseTo(307.76, 1);
    expect(dots(300, 60, 'female')).toBeGreaterThan(dots(300, 60, 'male'));
    expect(dotsLift('back-squat')).toBe('squat');
    expect(dotsLift('bench-press')).toBe('bench');
    expect(dotsLift('romanian-deadlift')).toBeNull();
    expect(dotsLift('trap-bar-deadlift')).toBe('deadlift');
  });
});
