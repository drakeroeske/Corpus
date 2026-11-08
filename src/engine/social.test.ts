import { describe, expect, it } from 'vitest';
import { consistency, crewStreak, matchScore } from './social';

const d = (date: string, planned: boolean, done: boolean) => ({ date, planned, done });

describe('Crew streak', () => {
  it('counts planned days where everyone trained, newest first', () => {
    const log = {
      me: [d('2026-11-03', true, true), d('2026-11-04', true, true), d('2026-11-05', false, false)],
      ana: [d('2026-11-03', true, true), d('2026-11-04', false, false), d('2026-11-05', true, true)],
    };
    expect(crewStreak(log, '2026-11-05')).toBe(3);
  });
  it('breaks if any member misses a planned session', () => {
    const log = {
      me: [d('2026-11-03', true, true), d('2026-11-04', true, true)],
      ana: [d('2026-11-03', true, false), d('2026-11-04', true, true)],
    };
    expect(crewStreak(log, '2026-11-04')).toBe(1);
  });
  it("today's unfinished session doesn't break it yet", () => {
    const log = { me: [d('2026-11-04', true, true), d('2026-11-05', true, false)] };
    expect(crewStreak(log, '2026-11-05')).toBe(1);
  });
});

describe('Consistency', () => {
  it('done / planned %', () => {
    expect(consistency([d('a', true, true), d('b', true, false), d('c', false, false)])).toBe(50);
    expect(consistency([])).toBe(0);
  });
});

describe('Spotter matching', () => {
  const me = { gym: 'Iron Works', schedule: [1, 2, 4, 5], split: 'Upper/Lower', dots: 300 };
  it('perfect match = 100', () => {
    expect(matchScore(me, { ...me }).score).toBe(100);
  });
  it('weights gym, schedule, split, strength', () => {
    const r = matchScore(me, { gym: 'Other', schedule: [1, 2], split: 'PPL', dots: 450 });
    // schedule 2/4 × 25 = 12.5, strength 0 → 13
    expect(r.score).toBe(13);
    expect(r.reasons).toEqual(['2 shared training days']);
  });
});
