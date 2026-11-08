import { describe, expect, it } from 'vitest';
import { adherencePct, clientFlags, type Client } from './index';

const c: Client = {
  id: 'c', name: 'Sam', readiness: [70, 72, 68, 75, 80, 77, 74], planned: 8, done: 8, missedInARow: 0,
  lastSession: '2026-11-05', lastSessionTitle: 'Upper', program: [],
};

describe('Coach flags', () => {
  it('no flags for a client on track', () => {
    expect(clientFlags(c)).toEqual([]);
    expect(adherencePct(c)).toBe(100);
  });
  it('readiness < 50 for 3 days, missed sessions, low adherence', () => {
    expect(clientFlags({ ...c, readiness: [70, 45, 40, 48] })).toContain('readiness < 50 for 3 days');
    expect(clientFlags({ ...c, readiness: [45, 40, 60] })).not.toContain('readiness < 50 for 3 days');
    expect(clientFlags({ ...c, missedInARow: 2 })).toContain('missed 2 sessions');
    expect(clientFlags({ ...c, done: 5 })).toContain('adherence 63%');
  });
});
