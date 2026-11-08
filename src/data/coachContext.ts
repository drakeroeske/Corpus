// Builds the AI coach's context from engine outputs.
import { RECOVERING_PCT, fatiguePercent, MUSCLES, type CheckIn, type Meal, type ProgramDay, type UserProfile, type WorkoutSession } from '../engine';
import type { CoachContext } from '../services/aiCoach';
import { buildPlan, currentFatigue, dayForDate, deloadAlert, e1rmSeries, exById, hrvHistory, plateauAlerts, proteinTarget, readinessOn } from './plan';
import { weeklyReport } from './report';
import { fmt } from '../components/ui';

export function coachContext(
  d: { profile: UserProfile; days: ProgramDay[]; sessions: WorkoutSession[]; checkins: CheckIn[]; meals: Meal[] },
  today: string,
): CoachContext {
  const { profile, days, sessions, checkins, meals } = d;
  const day = dayForDate(days, today);
  const checkin = checkins.find((c) => c.date === today);
  const r = readinessOn(today, checkins, days);
  const plan = day ? buildPlan(day, sessions, checkin, hrvHistory(checkins, today), profile, today) : null;
  const report = weeklyReport(d, today);
  const fat = currentFatigue(sessions, checkin, meals, profile, today, Date.now()).units;
  const ids = [...new Set(sessions.flatMap((s) => s.sets.filter((x) => x.weight > 0).map((x) => x.exerciseId)))];

  return {
    readiness: { score: r.score, reason: r.reason, confidence: r.confidence },
    todayTargets:
      plan?.items.map(
        ({ ex, pe, target }) =>
          `${ex.name} ${ex.equipment === 'bodyweight' ? 'BW' : fmt(target.weight)} × ${pe.repMin}–${pe.repMax}${target.rirCap !== undefined ? ` · stop at ${target.rirCap} RIR` : ''}`,
      ) ?? [],
    plateaus: plateauAlerts(days, sessions, checkins, today, { meals, profile, days }).map((p) => ({ name: exById(p.exerciseId).name, fix: p.fix })),
    deload: deloadAlert(days, sessions, checkins, today, { meals, profile, days }),
    protein: { hit: report.proteinHit, logged: report.daysLogged, target: proteinTarget(profile).protein },
    avgSleep: report.avgSleep,
    insights: report.insights,
    focus: report.focus,
    lifts: ids.map((id) => {
      const s = e1rmSeries(sessions, id);
      return { name: exById(id).name, e1rm: s[s.length - 1].e1rm, changePct: report.changes.find((c) => c.exerciseId === id)?.pct };
    }),
    fatigued: MUSCLES.filter((m) => fatiguePercent(fat[m]) > RECOVERING_PCT),
    units: profile.units,
  };
}
