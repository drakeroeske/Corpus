import type { Exercise, LoggedSet, ProgramExercise, Technique } from './types';
import { UPPER_BODY } from './types';
import { daysBetween, round1, roundTo } from './util';

// ---------- e1RM / PRs ----------

export const e1rm = (weight: number, reps: number) => round1(weight * (1 + reps / 30));

/** True if this set beats every previous e1RM for the exercise (ties are not PRs). */
export function isPR(set: { weight: number; reps: number }, previous: { weight: number; reps: number }[]): boolean {
  if (set.weight <= 0) return false;
  const v = e1rm(set.weight, set.reps);
  return previous.every((p) => e1rm(p.weight, p.reps) < v);
}

/** First working (non-warm-up) set of a session for one exercise. */
export function firstWorkingSet(sets: LoggedSet[]): LoggedSet | null {
  return sets.find((s) => !s.isWarmup) ?? null;
}

// ---------- Progression ----------

export interface HistoryPoint {
  date: string;
  weight: number;
  reps: number;
}

export type TargetAction = 'start' | 'ask' | 'increase' | 'repeat' | 'hold' | 'deload' | 'add-load';

export interface Target {
  weight: number | null; // null = ask the user
  baseWeight: number | null; // weight used last time
  repMin: number;
  repMax: number;
  repGoal: number;
  rirCap?: number; // stop with at least this many reps in reserve
  technique: Technique;
  action: TargetAction;
  why: string;
}

/**
 * Double progression from the first working set of each previous session (oldest first).
 */
export function nextTarget(pe: ProgramExercise, bodyweight: boolean, history: HistoryPoint[]): Target {
  const base = { repMin: pe.repMin, repMax: pe.repMax, technique: pe.technique ?? 'none' } as const;
  const range = `${pe.repMin}–${pe.repMax}`;
  const last = history[history.length - 1];

  if (!last) {
    const w = bodyweight ? 0 : pe.startWeight ?? null;
    return {
      ...base,
      weight: w,
      baseWeight: w,
      repGoal: pe.repMin,
      action: w === null ? 'ask' : 'start',
      why: w === null ? `First time: enter a weight you can do for ${range} reps` : `First session: aim for ${pe.repMin}+ reps`,
    };
  }

  const lastW = bodyweight ? 0 : last.weight;

  if (last.reps >= pe.repMax) {
    if (bodyweight) {
      return { ...base, weight: 0, baseWeight: 0, repGoal: pe.repMax, action: 'add-load', why: `Hit ${last.reps} reps (top of ${range}): add load` };
    }
    return {
      ...base,
      weight: lastW + pe.increment,
      baseWeight: lastW,
      repGoal: pe.repMin,
      action: 'increase',
      why: `Hit ${last.reps} at ${lastW} (top of ${range}): +${pe.increment}`,
    };
  }

  if (last.reps >= pe.repMin) {
    return {
      ...base,
      weight: lastW,
      baseWeight: lastW,
      repGoal: last.reps + 1,
      action: 'repeat',
      why: `${last.reps} reps last time: same weight, aim for ${last.reps + 1}`,
    };
  }

  const prev = history[history.length - 2];
  const twiceBelow = !!prev && prev.reps < pe.repMin;
  if (twiceBelow && !bodyweight) {
    const w = roundTo(lastW * 0.9, pe.increment);
    return {
      ...base,
      weight: w,
      baseWeight: lastW,
      repGoal: pe.repMin,
      action: 'deload',
      why: `Below ${pe.repMin} reps 2 sessions in a row: −10% to ${w}`,
    };
  }
  return {
    ...base,
    weight: lastW,
    baseWeight: lastW,
    repGoal: pe.repMin,
    action: 'hold',
    why: `${last.reps} reps last time (below ${pe.repMin}): hold weight`,
  };
}

/** Adjust a target for today's readiness. */
export function applyReadiness(t: Target, score: number, reason: string, increment: number): Target {
  if (score >= 75) return t;
  if (score >= 50) {
    if (t.action !== 'increase') return t;
    return { ...t, weight: t.baseWeight, action: 'hold', why: 'Readiness moderate — holding weights' };
  }
  return {
    ...t,
    weight: t.weight ? roundTo(t.weight * 0.9, increment) : t.weight,
    rirCap: Math.max(3, t.rirCap ?? 0),
    technique: 'none',
    why: `Readiness low (${reason}): −10%, stop 3 reps short`,
  };
}

// ---------- Return-from-break mode ----------

export interface BreakPhase {
  week: number;
  name: 'Ramp' | 'Build' | 'Done';
  detail: string;
}

/** null when the mode is off. 'Done' (week 5+) means the app should switch it off. */
export function breakPhase(start: string | null, today: string): BreakPhase | null {
  if (!start) return null;
  const week = Math.max(1, Math.floor(daysBetween(start, today) / 7) + 1);
  if (week <= 2) return { week, name: 'Ramp', detail: '~65% of old weights, stop 2–3 reps short, no failure work' };
  if (week <= 4) return { week, name: 'Build', detail: 'failure techniques on upper-body isolation and machines' };
  return { week, name: 'Done', detail: 'back to the full program' };
}

const failureOk = (ex: Exercise) =>
  ex.primaryMuscles.every((m) => UPPER_BODY.includes(m)) && (ex.pattern === 'isolation' || ex.equipment === 'machine');

/**
 * Apply return-from-break rules. `lastSessionDate` = date of the most recent logged session for this
 * exercise; weights drop to 65% only if that session happened before the break mode started.
 */
export function applyBreakMode(
  t: Target,
  phase: BreakPhase | null,
  ex: Exercise,
  breakStart: string | null,
  lastSessionDate: string | undefined,
  increment: number,
): Target {
  if (!phase || phase.name === 'Done' || !breakStart) return t;
  if (phase.name === 'Ramp') {
    const fromBeforeBreak = !!lastSessionDate && lastSessionDate < breakStart;
    const weight = fromBeforeBreak && t.baseWeight ? roundTo(t.baseWeight * 0.65, increment) : t.weight;
    return {
      ...t,
      weight,
      technique: 'none',
      rirCap: Math.max(2, t.rirCap ?? 0),
      why: fromBeforeBreak ? `Return from break: 65% of your last ${t.baseWeight}` : `Ramp week ${phase.week}: ${t.why}`,
    };
  }
  return failureOk(ex) ? t : { ...t, technique: 'none' };
}
