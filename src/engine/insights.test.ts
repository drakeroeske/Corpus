import { describe, expect, it } from 'vitest';
import { weeklyInsights, type InsightInput } from './insights';

const base: InsightInput = {
  sessionsDone: 4,
  sessionsPlanned: 4,
  sleepHours: [7.5, 8, 7.6],
  proteinDays: { logged: 7, hit: 7 },
  e1rmChanges: [],
  plateaued: [],
  underVolume: [],
  sessionsBySleep: [],
  avgReadiness: 78,
};

describe('Weekly insights', () => {
  it('links missed protein to a stalled press', () => {
    const r = weeklyInsights({
      ...base,
      proteinDays: { logged: 7, hit: 3 },
      e1rmChanges: [{ name: 'Bench Press', pct: -0.5, isPress: true }],
    });
    expect(r.insights[0]).toBe('Protein under target 4 of 7 days — matches your stalled Bench Press');
    expect(r.focus).toMatch(/protein/);
  });

  it('spots that the best sessions followed 7.5h+ sleep', () => {
    const r = weeklyInsights({
      ...base,
      sessionsBySleep: [
        { sleep: 8, perf: 3 },
        { sleep: 7.8, perf: 2 },
        { sleep: 6, perf: -1 },
        { sleep: 6.5, perf: 0 },
      ],
    });
    expect(r.insights).toContain('Your best sessions followed 7.5h+ sleep');
  });

  it('reports e1RM changes, sleep, adherence; 3–5 insights and one focus', () => {
    const r = weeklyInsights({
      ...base,
      sessionsDone: 3,
      sleepHours: [6, 6.5, 6.2],
      e1rmChanges: [
        { name: 'Squat', pct: 3.2, isPress: false },
        { name: 'Row', pct: -2, isPress: false },
      ],
      underVolume: ['calves'],
    });
    expect(r.insights).toContain('Squat e1RM +3.2% this week');
    expect(r.insights).toContain('Row e1RM -2% this week');
    expect(r.insights.length).toBeGreaterThanOrEqual(3);
    expect(r.insights.length).toBeLessThanOrEqual(5);
    expect(r.focus).toBe('Get 7.5h+ sleep on at least 5 nights.');
  });

  it('pads quiet weeks to at least 3 insights', () => {
    const r = weeklyInsights({ ...base, sessionsPlanned: 4 });
    expect(r.insights.length).toBeGreaterThanOrEqual(3);
    expect(r.focus).toBe('Same plan: push your top sets.');
  });
});
