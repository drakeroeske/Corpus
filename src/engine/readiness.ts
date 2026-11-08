import type { CheckIn, Muscle } from './types';
import { mean } from './util';

export type Confidence = 'high' | 'medium' | 'low';

export interface Readiness {
  score: number;
  confidence: Confidence;
  reason: string;
  level: 'normal' | 'moderate' | 'low';
  assumed: boolean;
}

interface Factor {
  max: number;
  pts: number;
  label: string;
}

export const levelFor = (score: number) => (score >= 75 ? 'normal' : score >= 50 ? 'moderate' : 'low') as Readiness['level'];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Readiness 0–100.
 * @param hrvHistory HRV values from the previous 7 days (for the rolling baseline).
 */
export function readiness(ci: CheckIn | undefined, targetMuscles: Muscle[], hrvHistory: number[]): Readiness {
  if (!ci) return { score: 70, confidence: 'low', reason: 'No check-in today — assuming 70', level: 'moderate', assumed: true };

  const f: Factor[] = [];
  if (ci.sleepHours !== undefined) {
    f.push({ max: 30, pts: clamp01((ci.sleepHours - 4) / 4) * 30, label: `${ci.sleepHours}h sleep` });
  }
  if (ci.sleepQuality !== undefined) {
    f.push({ max: 10, pts: ((ci.sleepQuality - 1) / 4) * 10, label: `poor sleep quality (${ci.sleepQuality}/5)` });
  }
  const baseline = hrvHistory.length ? mean(hrvHistory) : NaN;
  if (ci.hrv !== undefined && Number.isFinite(baseline)) {
    const drop = 1 - ci.hrv / baseline; // 0.1 = 10% below baseline
    const pts = drop <= 0 ? 20 : drop >= 0.15 ? 0 : 20 * (1 - drop / 0.15);
    f.push({ max: 20, pts, label: `HRV ${Math.round(drop * 100)}% below baseline` });
  }
  if (ci.energy !== undefined) {
    f.push({ max: 15, pts: ((ci.energy - 1) / 4) * 15, label: `low energy (${ci.energy}/5)` });
  }
  const targets = targetMuscles.filter((m) => ci.soreness[m] !== undefined);
  if (targets.length) {
    const avg = mean(targets.map((m) => ci.soreness[m]!));
    const sorest = [...targets].sort((a, b) => ci.soreness[b]! - ci.soreness[a]!).filter((m) => ci.soreness[m]! >= 3).slice(0, 2);
    f.push({ max: 15, pts: ((5 - avg) / 4) * 15, label: sorest.length ? `sore ${sorest.join(' & ')}` : 'soreness' });
  }
  if (ci.stress !== undefined) {
    f.push({ max: 10, pts: ((5 - ci.stress) / 4) * 10, label: `high stress (${ci.stress}/5)` });
  }

  if (!f.length) return { score: 70, confidence: 'low', reason: 'Empty check-in — assuming 70', level: 'moderate', assumed: true };

  // Missing inputs: scale the present ones up to 100.
  const maxSum = f.reduce((a, x) => a + x.max, 0);
  const score = Math.round((f.reduce((a, x) => a + x.pts, 0) / maxSum) * 100);
  const confidence: Confidence = f.length >= 5 ? 'high' : f.length >= 3 ? 'medium' : 'low';

  const negatives = f
    .filter((x) => x.max - x.pts >= x.max * 0.3)
    .sort((a, b) => b.max - b.pts - (a.max - a.pts))
    .slice(0, 2);
  const reason = negatives.length
    ? negatives.map((x) => x.label).join(' + ')
    : ci.sleepHours !== undefined
      ? `No red flags — ${ci.sleepHours}h sleep`
      : 'No red flags';

  return { score, confidence, reason, level: levelFor(score), assumed: false };
}
