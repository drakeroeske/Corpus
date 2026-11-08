import { describe, expect, it } from 'vitest';
import { ruleBasedAnswer, type CoachContext } from './aiCoach';

const ctx: CoachContext = {
  readiness: { score: 62, reason: '6h sleep + sore chest', confidence: 'medium' },
  todayTargets: ['Bench Press 185 × 6–8'],
  plateaus: [{ name: 'Bench Press', fix: 'raise calories ~200' }],
  deload: { deload: false, reason: '' },
  protein: { hit: 3, logged: 7, target: 160 },
  avgSleep: 6.4,
  insights: ['Protein under target 4 of 7 days'],
  focus: 'Hit your protein target at least 6 of 7 days.',
  lifts: [{ name: 'Bench Press', e1rm: 230, changePct: 0 }],
  fatigued: [],
  units: 'lb',
};

describe('Rule-based AI coach', () => {
  it('explains a bench stall with plateau flag, protein and sleep', () => {
    const a = ruleBasedAnswer('Why did my bench stall?', ctx);
    expect(a).toMatch(/Bench Press has had no e1RM gain in 3 sessions/);
    expect(a).toMatch(/Protein hit 3 of 7/);
    expect(a).toMatch(/6\.4h sleep/);
    expect(a).toMatch(/raise calories/);
  });
  it('answers readiness and today questions from engine outputs', () => {
    expect(ruleBasedAnswer('why is my readiness low', ctx)).toMatch(/62.*6h sleep \+ sore chest/);
    expect(ruleBasedAnswer('what should I do today?', ctx)).toMatch(/Bench Press 185/);
  });
});
