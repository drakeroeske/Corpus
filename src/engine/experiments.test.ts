import { describe, expect, it } from 'vitest';
import { experimentPhase, experimentReport, addDays, type Experiment } from './index';

const exp: Experiment = {
  id: 'e', type: 'creatine', name: 'Creatine', question: 'Took it?', startDate: '2026-10-01',
  baselineDays: 14, lengthDays: 28, status: 'baseline',
};

describe('Experiment phases', () => {
  it('14-day baseline, then 28-day test, then done', () => {
    expect(experimentPhase(exp, '2026-10-01')).toMatchObject({ phase: 'baseline', day: 1 });
    expect(experimentPhase(exp, '2026-10-14')).toMatchObject({ phase: 'baseline', day: 14 });
    expect(experimentPhase(exp, '2026-10-15')).toMatchObject({ phase: 'testing', phaseDay: 1, testStart: '2026-10-15' });
    expect(experimentPhase(exp, '2026-11-11')).toMatchObject({ phase: 'testing', phaseDay: 28 });
    expect(experimentPhase(exp, '2026-11-12').phase).toBe('done');
  });
});

describe('Experiment report', () => {
  const w = (start: string, n: number, from: number, step: number) =>
    Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), value: from + step * i }));

  it('compares readiness, e1RM rate and weight trend; full data → medium confidence', () => {
    const r = experimentReport({
      baselineReadiness: Array(14).fill(70),
      testReadiness: Array(28).fill(76),
      baselineStrengthPct: 1,
      testStrengthPct: 4,
      baselineDays: 14,
      testDays: 28,
      baselineWeights: w('2026-10-01', 14, 180, 0),
      testWeights: w('2026-10-15', 28, 180, 0.05),
      flags: Array(28).fill(true),
    });
    expect(r.rows[0]).toMatchObject({ baseline: 70, test: 76 });
    expect(r.rows[1]).toMatchObject({ baseline: 0.5, test: 1 });
    expect(r.rows[2].baseline).toBe(0);
    expect(r.rows[2].test).toBeGreaterThan(0);
    expect(r.adherence).toBe(1);
    expect(r.confidence).toBe('medium');
    expect(r.summary).toBe('During the test: readiness +6, strength rate +0.5%/wk vs baseline.');
  });

  it('honest label for small samples or poor adherence', () => {
    const r = experimentReport({
      baselineReadiness: [70], testReadiness: [75], baselineStrengthPct: 0, testStrengthPct: 0,
      baselineDays: 14, testDays: 5, baselineWeights: [], testWeights: [], flags: [true, false, true],
    });
    expect(r.confidence).toBe('low');
    expect(r.confidenceLabel).toBe('Small sample — suggestive, not proof');
    expect(r.adherence).toBeCloseTo(2 / 3);
  });
});
