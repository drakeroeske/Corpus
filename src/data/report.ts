// Builds the Weekly Lab Report from stored data.
import { addDays, carbTimingInsight, daysBetween, e1rm, mean, weeklyInsights, type CheckIn, type Meal, type Muscle, type ProgramDay, type UserProfile, type WorkoutSession } from '../engine';
import { exById, plateauAlerts, proteinTarget, readinessSeries, sessionStats, weeklySetsFor, dayForDate } from './plan';

export interface WeeklyReport {
  from: string;
  to: string;
  done: number;
  planned: number;
  volume: number;
  avgReadiness: number;
  avgSleep: number;
  proteinHit: number;
  kcalOnTarget: number;
  daysLogged: number;
  prs: { exerciseId: string; weight: number; reps: number; e1rm: number }[];
  changes: { exerciseId: string; name: string; pct: number }[];
  insights: string[];
  focus: string;
}

const bestIn = (sessions: WorkoutSession[], id: string, from: string, to: string) => {
  const vals = sessions
    .filter((s) => s.date >= from && s.date <= to)
    .flatMap((s) => s.sets.filter((x) => x.exerciseId === id && !x.isWarmup && x.weight > 0))
    .map((x) => e1rm(x.weight, x.reps));
  return vals.length ? Math.max(...vals) : null;
};

export function weeklyReport(
  d: { profile: UserProfile; days: ProgramDay[]; sessions: WorkoutSession[]; checkins: CheckIn[]; meals: Meal[] },
  today: string,
): WeeklyReport {
  const { profile, days, sessions, checkins, meals } = d;
  const from = addDays(today, -6);
  const inWeek = (date: string) => date >= from && date <= today;
  const week = sessions.filter((s) => inWeek(s.date) && s.finishedAt);

  let planned = 0;
  for (let i = 0; i < 7; i++) if (dayForDate(days, addDays(from, i))) planned++;

  const series = readinessSeries(checkins, days, today, 7);
  const real = series.filter((r) => !r.assumed);
  const avgReadiness = mean((real.length ? real : series).map((r) => r.score));
  const sleeps = checkins.filter((c) => inWeek(c.date) && c.sleepHours !== undefined).map((c) => c.sleepHours!);

  let daysLogged = 0;
  let proteinHit = 0;
  let kcalOnTarget = 0;
  let kcalSum = 0;
  let kcalTargetSum = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i);
    const dm = meals.filter((m) => m.date === date);
    if (!dm.length) continue;
    daysLogged++;
    const t = proteinTarget(profile, !!dayForDate(days, date));
    if (dm.reduce((a, m) => a + m.protein, 0) >= t.protein) proteinHit++;
    const k = dm.reduce((a, m) => a + m.kcal, 0);
    kcalSum += k;
    kcalTargetSum += t.kcal;
    if (Math.abs(k - t.kcal) <= t.kcal * 0.1) kcalOnTarget++;
  }

  const prs = week.flatMap((s) => sessionStats(s, sessions).prs);
  const ids = [...new Set(week.flatMap((s) => s.sets.map((x) => x.exerciseId)))];
  const changes = ids
    .map((id) => {
      const now = bestIn(sessions, id, from, today);
      const before = bestIn(sessions, id, addDays(from, -7), addDays(from, -1));
      return now && before ? { exerciseId: id, name: exById(id).name, pct: Math.round(((now - before) / before) * 1000) / 10 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.pct - a.pct);

  const programMuscles = new Set<Muscle>(days.flatMap((dd) => dd.exercises.flatMap((e) => exById(e.exerciseId).primaryMuscles)));
  const weekly = weeklySetsFor(sessions, today);
  const underVolume = [...programMuscles].filter((m) => weekly[m] < 10);

  // Sleep vs performance over 4 weeks.
  const recent = sessions.filter((s) => s.finishedAt && s.date >= addDays(today, -27) && s.date <= today);
  const perfOf = (s: WorkoutSession) => {
      const deltas: number[] = [];
      for (const id of new Set(s.sets.map((x) => x.exerciseId))) {
        const now = bestIn([s], id, s.date, s.date);
        const prev = sessions
          .filter((o) => o.date < s.date)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((o) => bestIn([o], id, o.date, o.date))
          .find((v) => v !== null);
        if (now && prev) deltas.push(((now - prev) / prev) * 100);
      }
      return deltas.length ? mean(deltas) : null;
  };
  const sessionsBySleep = recent
    .map((s) => {
      const sleep = checkins.find((c) => c.date === s.date)?.sleepHours;
      const perf = perfOf(s);
      return sleep !== undefined && perf !== null ? { sleep, perf } : null;
    })
    .filter((x): x is { sleep: number; perf: number } => !!x);

  // Pre-workout carbs (3 h before start) vs performance, all history; suggestive only.
  const firstMeal = meals.reduce((a, m) => (m.date < a ? m.date : a), today);
  const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const carbSessions = sessions
    .filter((s) => s.finishedAt && s.date <= today)
    .map((s) => {
      const end = hhmm(s.startedAt);
      const start = hhmm(s.startedAt - 3 * 3_600_000);
      const preCarbs = meals.filter((m) => m.date === s.date && m.time >= start && m.time <= end).reduce((a, m) => a + m.carbs, 0);
      const perf = perfOf(s);
      return perf !== null ? { preCarbs, perf } : null;
    })
    .filter((x): x is { preCarbs: number; perf: number } => !!x);
  const carbTiming = carbTimingInsight(carbSessions, daysBetween(firstMeal, today) / 7);

  const { insights, focus } = weeklyInsights({
    sessionsDone: week.length,
    sessionsPlanned: planned,
    sleepHours: sleeps,
    proteinDays: { logged: daysLogged, hit: proteinHit },
    e1rmChanges: changes.map((c) => ({ name: c.name, pct: c.pct, isPress: ['hpush', 'vpush'].includes(exById(c.exerciseId).pattern) })),
    plateaued: plateauAlerts(days, sessions, checkins, today, { meals, profile, days }).map((p) => exById(p.exerciseId).name),
    underVolume,
    sessionsBySleep,
    avgReadiness,
    kcal: { logged: daysLogged, avg: daysLogged ? kcalSum / daysLogged : 0, target: daysLogged ? kcalTargetSum / daysLogged : 0 },
    carbTiming,
  });

  return {
    from,
    to: today,
    done: week.length,
    planned,
    volume: week.reduce((a, s) => a + sessionStats(s, sessions).volume, 0),
    avgReadiness: Math.round(avgReadiness),
    avgSleep: sleeps.length ? Math.round(mean(sleeps) * 10) / 10 : NaN,
    proteinHit,
    kcalOnTarget,
    daysLogged,
    prs,
    changes,
    insights,
    focus,
  };
}
