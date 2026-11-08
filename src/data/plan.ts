// Glue: turns stored data into engine inputs and back. No React.
import {
  applyBreakMode,
  applyReadiness,
  breakPhase,
  convertWeight,
  e1rm,
  firstWorkingSet,
  halfLifeHours,
  muscleFatigue,
  nextTarget,
  nutritionTargets,
  readiness,
  toKg,
  addDays,
  bodyCompSignal,
  deloadCheck,
  isPlateau,
  mean,
  plateauFix,
  weeklySets,
  type PlateauFix,
  type BreakPhase,
  type CheckIn,
  type Exercise,
  type FatigueSet,
  type HistoryPoint,
  type Meal,
  type Muscle,
  type ProgramDay,
  type ProgramExercise,
  type Readiness,
  type Target,
  type UserProfile,
  type WorkoutSession,
} from '../engine';
import { EXERCISE_BY_ID } from './exercises';

export const exById = (id: string): Exercise =>
  EXERCISE_BY_ID[id] ?? { id, name: id, primaryMuscles: [], secondaryMuscles: [], equipment: 'machine', pattern: 'isolation' };

export const isBodyweight = (ex: Exercise) => ex.equipment === 'bodyweight';

/** First working set of each session for an exercise, oldest first. */
export function historyFor(sessions: WorkoutSession[], exerciseId: string, excludeSessionId?: string): HistoryPoint[] {
  return [...sessions]
    .filter((s) => s.id !== excludeSessionId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
    .map((s) => ({ date: s.date, set: firstWorkingSet(s.sets.filter((x) => x.exerciseId === exerciseId)) }))
    .filter((x) => x.set)
    .map((x) => ({ date: x.date, weight: x.set!.weight, reps: x.set!.reps }));
}

/** HRV values from the 7 days before `today`. */
export function hrvHistory(checkins: CheckIn[], today: string): number[] {
  const from = addDays(today, -7);
  return checkins.filter((c) => c.date >= from && c.date < today && c.hrv !== undefined).map((c) => c.hrv!);
}

export function dayMuscles(day: ProgramDay): Muscle[] {
  return [...new Set(day.exercises.flatMap((e) => exById(e.exerciseId).primaryMuscles))];
}

export function dayForDate(days: ProgramDay[], date: string): ProgramDay | undefined {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return days.find((x) => x.weekdays.includes(wd));
}

export interface PlanItem {
  pe: ProgramExercise;
  programmed: Exercise;
  ex: Exercise; // what is actually done today (may be a substitute)
  target: Target;
}

export interface Plan {
  readiness: Readiness;
  phase: BreakPhase | null;
  items: PlanItem[];
}

export function buildPlan(
  day: ProgramDay,
  sessions: WorkoutSession[],
  checkin: CheckIn | undefined,
  hrv: number[],
  profile: UserProfile,
  today: string,
  opts: { excludeSessionId?: string; substitutions?: Record<string, string> } = {},
): Plan {
  const r = readiness(checkin, dayMuscles(day), hrv);
  const phase = breakPhase(profile.returnFromBreakStart, today);

  const items = day.exercises.map((pe) => {
    const programmed = exById(pe.exerciseId);
    const subId = opts.substitutions?.[pe.exerciseId];
    const ex = subId ? exById(subId) : programmed;

    let hist = historyFor(sessions, ex.id, opts.excludeSessionId);
    let t = nextTarget(pe, isBodyweight(ex), hist);
    if (subId && !hist.length) {
      // No history on the substitute: convert the programmed target by equipment ratio.
      hist = historyFor(sessions, programmed.id, opts.excludeSessionId);
      const orig = nextTarget(pe, isBodyweight(programmed), hist);
      const w = orig.weight === null ? null : isBodyweight(ex) ? 0 : convertWeight(orig.weight, programmed.equipment, ex.equipment, pe.increment);
      t = { ...orig, weight: w, baseWeight: w, why: `Swapped for ${programmed.name}: weight converted by equipment` };
    }
    t = applyReadiness(t, r.score, r.reason, pe.increment);
    t = applyBreakMode(t, phase, ex, profile.returnFromBreakStart, hist[hist.length - 1]?.date, pe.increment);
    return { pe, programmed, ex, target: t };
  });

  return { readiness: r, phase, items };
}

// ---------- Fatigue ----------

export function fatigueSets(sessions: WorkoutSession[], excludeSessionId?: string): FatigueSet[] {
  const out: FatigueSet[] = [];
  for (const s of sessions) {
    if (s.id === excludeSessionId) continue;
    for (const set of s.sets) {
      if (set.isWarmup) continue;
      const ex = exById(set.exerciseId);
      out.push({ time: set.time ?? s.startedAt, primary: ex.primaryMuscles, secondary: ex.secondaryMuscles });
    }
  }
  return out;
}

export function proteinTarget(profile: UserProfile, trainingDay = true) {
  return nutritionTargets(
    { weightKg: toKg(profile.bodyWeight, profile.units), heightCm: profile.heightCm, age: profile.age, sex: profile.sex, goal: profile.goal },
    trainingDay,
  );
}

/** True only if meals were logged for `date` and protein came in under target. */
export function proteinMissed(meals: Meal[], date: string, profile: UserProfile): boolean {
  const day = meals.filter((m) => m.date === date);
  if (!day.length) return false;
  return day.reduce((a, m) => a + m.protein, 0) < proteinTarget(profile).protein;
}

export function currentFatigue(sessions: WorkoutSession[], checkin: CheckIn | undefined, meals: Meal[], profile: UserProfile, today: string, now: number, excludeSessionId?: string) {
  const hl = halfLifeHours(checkin?.sleepHours, proteinMissed(meals, addDays(today, -1), profile));
  return { halfLife: hl, units: muscleFatigue(fatigueSets(sessions, excludeSessionId), now, hl) };
}

// ---------- Session stats ----------

export interface SessionStats {
  volume: number;
  workingSets: number;
  setsPerMuscle: Partial<Record<Muscle, number>>;
  prs: { exerciseId: string; weight: number; reps: number; e1rm: number }[];
  topSets: { exerciseId: string; weight: number; reps: number }[];
}

export function sessionStats(session: WorkoutSession, all: WorkoutSession[]): SessionStats {
  const working = session.sets.filter((s) => !s.isWarmup);
  const setsPerMuscle: Partial<Record<Muscle, number>> = {};
  for (const s of working) for (const m of exById(s.exerciseId).primaryMuscles) setsPerMuscle[m] = (setsPerMuscle[m] ?? 0) + 1;

  const earlier = all.filter((o) => o.id !== session.id && (o.date < session.date || (o.date === session.date && o.startedAt < session.startedAt)));
  const prs: SessionStats['prs'] = [];
  const topSets: SessionStats['topSets'] = [];
  for (const id of [...new Set(working.map((s) => s.exerciseId))]) {
    const mine = working.filter((s) => s.exerciseId === id);
    const best = mine.reduce((a, b) => (e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a));
    topSets.push({ exerciseId: id, weight: best.weight, reps: best.reps });
    const prevBest = Math.max(0, ...earlier.flatMap((o) => o.sets.filter((x) => x.exerciseId === id && !x.isWarmup)).map((x) => e1rm(x.weight, x.reps)));
    const v = e1rm(best.weight, best.reps);
    if (best.weight > 0 && v > prevBest) prs.push({ exerciseId: id, weight: best.weight, reps: best.reps, e1rm: v });
  }
  topSets.sort((a, b) => e1rm(b.weight, b.reps) - e1rm(a.weight, a.reps));
  return { volume: Math.round(working.reduce((a, s) => a + s.weight * s.reps, 0)), workingSets: working.length, setsPerMuscle, prs, topSets };
}

// ---------- Trends & alerts ----------

export function readinessOn(date: string, checkins: CheckIn[], days: ProgramDay[]): Readiness {
  const day = dayForDate(days, date);
  return readiness(
    checkins.find((c) => c.date === date),
    day ? dayMuscles(day) : [],
    hrvHistory(checkins, date),
  );
}

/** Readiness for each of the last `n` days ending today (oldest first). */
export function readinessSeries(checkins: CheckIn[], days: ProgramDay[], today: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    const r = readinessOn(date, checkins, days);
    return { date, score: r.score, assumed: r.assumed };
  });
}

/** Hard sets per muscle over the 7 days ending `today`. */
export function weeklySetsFor(sessions: WorkoutSession[], today: string) {
  const from = addDays(today, -6);
  return weeklySets(
    sessions
      .filter((s) => s.date >= from && s.date <= today)
      .flatMap((s) => s.sets.filter((x) => !x.isWarmup))
      .map((x) => {
        const ex = exById(x.exerciseId);
        return { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles };
      }),
  );
}

export function bodyWeightSeries(checkins: CheckIn[]): { date: string; value: number }[] {
  return checkins
    .filter((c) => c.bodyWeight !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => ({ date: c.date, value: c.bodyWeight! }));
}

/** Average e1RM change (%) across lifts trained in the window [from, to]. */
export function strengthChangePct(sessions: WorkoutSession[], from: string, to: string): number {
  const ids = [...new Set(sessions.filter((s) => s.date >= from && s.date <= to).flatMap((s) => s.sets.map((x) => x.exerciseId)))];
  const changes: number[] = [];
  for (const id of ids) {
    const pts = e1rmSeries(sessions, id).filter((p) => p.date >= from && p.date <= to);
    if (pts.length >= 2 && pts[0].e1rm > 0) changes.push(((pts[pts.length - 1].e1rm - pts[0].e1rm) / pts[0].e1rm) * 100);
  }
  return changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
}

export function bodyComp(checkins: CheckIn[], sessions: WorkoutSession[], today: string) {
  const from = addDays(today, -13);
  return bodyCompSignal(
    bodyWeightSeries(checkins).filter((w) => w.date >= from && w.date <= today),
    strengthChangePct(sessions, from, today),
  );
}

export interface PlateauAlert {
  exerciseId: string;
  fix: PlateauFix;
}

export function plateauAlerts(days: ProgramDay[], sessions: WorkoutSession[], checkins: CheckIn[], today: string): PlateauAlert[] {
  const ids = [...new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))];
  const avgR = mean(readinessSeries(checkins, days, today, 7).map((r) => r.score));
  const weekly = weeklySetsFor(sessions, today);
  const falling = bodyComp(checkins, sessions, today).weightRatePctPerWeek < -0.1;
  return ids
    .filter((id) => isPlateau(e1rmSeries(sessions, id).map((p) => p.e1rm)))
    .map((id) => {
      const primary = exById(id).primaryMuscles[0];
      return { exerciseId: id, fix: plateauFix({ avgReadiness7d: avgR, weeklySetsPrimary: primary ? weekly[primary] : 0, bodyWeightFalling: falling }) };
    });
}

export function deloadAlert(days: ProgramDay[], sessions: WorkoutSession[], checkins: CheckIn[], today: string) {
  const series = readinessSeries(checkins, days, today, 14).map((r) => r.score);
  return deloadCheck(series, plateauAlerts(days, sessions, checkins, today).length);
}

/** Best e1RM per session for an exercise, oldest first. */
export function e1rmSeries(sessions: WorkoutSession[], exerciseId: string): { date: string; e1rm: number }[] {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => {
      const sets = s.sets.filter((x) => x.exerciseId === exerciseId && !x.isWarmup && x.weight > 0);
      return sets.length ? { date: s.date, e1rm: Math.max(...sets.map((x) => e1rm(x.weight, x.reps))) } : null;
    })
    .filter((x): x is { date: string; e1rm: number } => !!x);
}
