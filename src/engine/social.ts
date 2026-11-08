// Social rules: crew streaks, consistency, Spotter matching.

export type CrewDay = { date: string; planned: boolean; done: boolean };

/**
 * Shared streak = planned days in a row (newest first) where every member did their planned session.
 * Breaks as soon as any member misses one. Today doesn't break it while still in progress.
 */
export function crewStreak(log: Record<string, CrewDay[]>, today: string): number {
  const byDate = new Map<string, CrewDay[]>();
  for (const days of Object.values(log)) for (const d of days) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]);
  const dates = [...byDate.keys()].filter((d) => d <= today).sort().reverse();
  let streak = 0;
  for (const date of dates) {
    const entries = byDate.get(date)!;
    const planned = entries.filter((e) => e.planned);
    if (!planned.length) continue;
    const allDone = planned.every((e) => e.done);
    if (!allDone) {
      if (date === today) continue;
      break;
    }
    streak++;
  }
  return streak;
}

/** Done / planned, 0–100. */
export function consistency(days: CrewDay[]): number {
  const planned = days.filter((d) => d.planned);
  if (!planned.length) return 0;
  return Math.round((planned.filter((d) => d.done).length / planned.length) * 100);
}

export interface MatchProfile {
  gym: string;
  schedule: number[];
  split: string;
  dots: number;
}

/** Match %: gym 35, schedule overlap 25, split 20, strength level 20. */
export function matchScore(me: MatchProfile, other: MatchProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (me.gym && me.gym.toLowerCase() === other.gym.toLowerCase()) {
    score += 35;
    reasons.push('same gym');
  }
  const union = new Set([...me.schedule, ...other.schedule]);
  const shared = me.schedule.filter((d) => other.schedule.includes(d)).length;
  if (union.size) {
    score += (shared / union.size) * 25;
    if (shared) reasons.push(`${shared} shared training day${shared > 1 ? 's' : ''}`);
  }
  if (me.split.toLowerCase() === other.split.toLowerCase()) {
    score += 20;
    reasons.push('same split');
  }
  const closeness = Math.max(0, 1 - Math.abs(me.dots - other.dots) / 150);
  score += closeness * 20;
  if (closeness >= 0.7) reasons.push('similar strength');
  return { score: Math.round(score), reasons };
}
