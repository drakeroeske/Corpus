import type { Experiment, ExperimentType } from './types';
import { daysBetween, dayNum, linreg, mean } from './util';

export const EXPERIMENT_TEMPLATES: { type: ExperimentType; name: string; question: string }[] = [
  { type: 'creatine', name: 'Creatine 5 g daily', question: 'Took 5 g creatine today?' },
  { type: 'ampm', name: 'AM vs PM training', question: 'Trained before noon today?' },
  { type: 'protein', name: 'Higher protein (2.2 g/kg)', question: 'Hit 2.2 g/kg protein yesterday?' },
  { type: 'caffeine', name: 'Pre-workout caffeine', question: 'Had caffeine before training?' },
  { type: 'sleep', name: 'Extra sleep (+45 min)', question: 'In bed 45 min earlier last night?' },
  { type: 'custom', name: 'Custom experiment', question: 'Did the thing today?' },
];

export interface ExperimentPhase {
  phase: 'baseline' | 'testing' | 'done';
  day: number; // 1-based day of the whole experiment
  totalDays: number;
  phaseDay: number; // 1-based day within the current phase
  testStart: string;
}

export function experimentPhase(e: Experiment, today: string): ExperimentPhase {
  const total = e.baselineDays + e.lengthDays;
  const d = daysBetween(e.startDate, today);
  const testStart = new Date((dayNum(e.startDate) + e.baselineDays) * 86_400_000).toISOString().slice(0, 10);
  if (d >= total) return { phase: 'done', day: total, totalDays: total, phaseDay: e.lengthDays, testStart };
  if (d >= e.baselineDays) return { phase: 'testing', day: d + 1, totalDays: total, phaseDay: d - e.baselineDays + 1, testStart };
  return { phase: 'baseline', day: Math.max(1, d + 1), totalDays: total, phaseDay: Math.max(1, d + 1), testStart };
}

export interface ExperimentInput {
  baselineReadiness: number[];
  testReadiness: number[];
  baselineStrengthPct: number; // e1RM change over the baseline window
  testStrengthPct: number;
  baselineDays: number;
  testDays: number; // days elapsed in test so far
  baselineWeights: { date: string; value: number }[];
  testWeights: { date: string; value: number }[];
  flags: boolean[]; // daily yes/no answers during test
}

export interface ExperimentReport {
  rows: { label: string; baseline: number; test: number; unit: string }[];
  adherence: number; // 0–1
  confidence: 'low' | 'medium';
  confidenceLabel: string;
  summary: string;
}

const weeklyRatePct = (pts: { date: string; value: number }[]) => {
  const fit = linreg(pts.map((p) => ({ x: dayNum(p.date), y: p.value })));
  if (!fit || pts.length < 3) return NaN;
  return Math.round(((fit.slope * 7) / mean(pts.map((p) => p.value))) * 1000) / 10;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

export function experimentReport(i: ExperimentInput): ExperimentReport {
  const rows = [
    { label: 'Avg readiness', baseline: r1(mean(i.baselineReadiness)), test: r1(mean(i.testReadiness)), unit: '' },
    {
      label: 'e1RM rate',
      baseline: r1((i.baselineStrengthPct / Math.max(1, i.baselineDays)) * 7),
      test: r1((i.testStrengthPct / Math.max(1, i.testDays)) * 7),
      unit: '%/wk',
    },
    { label: 'Weight trend', baseline: weeklyRatePct(i.baselineWeights), test: weeklyRatePct(i.testWeights), unit: '%/wk' },
  ];
  const adherence = i.flags.length ? i.flags.filter(Boolean).length / i.flags.length : 0;
  const small = i.testReadiness.length < 14 || i.flags.length < 14 || adherence < 0.7;
  const confidence = small ? 'low' : 'medium';
  const confidenceLabel = small
    ? 'Small sample — suggestive, not proof'
    : '4 weeks of data — a real signal for you, but one person is not proof';

  const rd = rows[0].test - rows[0].baseline;
  const sd = rows[1].test - rows[1].baseline;
  const parts: string[] = [];
  if (Number.isFinite(rd)) parts.push(`readiness ${rd >= 0 ? '+' : ''}${r1(rd)}`);
  if (Number.isFinite(sd)) parts.push(`strength rate ${sd >= 0 ? '+' : ''}${r1(sd)}%/wk`);
  const summary = parts.length ? `During the test: ${parts.join(', ')} vs baseline.` : 'Not enough data yet.';

  return { rows, adherence, confidence, confidenceLabel, summary };
}
