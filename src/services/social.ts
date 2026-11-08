// Social entry point. Uses the real Supabase backend when VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set, otherwise the simulated on-device version.
import { useEffect, useState } from 'react';
import { db, todayKey } from '../data/db';
import { dayForDate, e1rmSeries } from '../data/plan';
import { addDays, crewStreak, consistency, dots, dotsLift, matchScore, toKg, type Crew, type CrewDay, type ProgramDay, type Spotter, type UserProfile, type WorkoutSession } from '../engine';
import { localSocial } from './socialLocal';
import { createSupabaseSocial } from './socialSupabase';
import type { MeSnapshot, SocialService } from './socialTypes';

export type { FeedItem, MeSnapshot, SocialService } from './socialTypes';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const social: SocialService = URL_ && KEY ? createSupabaseSocial(URL_, KEY) : localSocial;

/** Read from the social service and re-read whenever it reports a change. */
export function useSocial<T>(read: (s: SocialService) => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    const run = () => {
      read(social)
        .then((v) => alive && setValue(v))
        .catch(() => {});
    };
    run();
    const off = social.subscribe(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

// ---------- What I share ----------

export function mySplit(days: ProgramDay[]): string {
  const names = days.map((d) => d.name.toLowerCase()).join(' ');
  if (/upper|lower/.test(names)) return 'Upper/Lower';
  if (/push|pull|legs/.test(names) && days.length >= 5) return 'PPL';
  if (/full/.test(names)) return 'Full Body';
  return `${days.length}-day`;
}

/** Best e1RM (kg) per DOTS lift from my sessions. */
export function myBests(sessions: WorkoutSession[], profile: UserProfile): Record<'squat' | 'bench' | 'deadlift', number> {
  const best = { squat: 0, bench: 0, deadlift: 0 };
  const ids = new Set(sessions.flatMap((s) => s.sets.map((x) => x.exerciseId)));
  for (const id of ids) {
    const lift = dotsLift(id);
    if (!lift) continue;
    const top = Math.max(0, ...e1rmSeries(sessions, id).map((p) => p.e1rm));
    best[lift] = Math.max(best[lift], Math.round(toKg(top, profile.units) * 10) / 10);
  }
  return best;
}

export function myDots(sessions: WorkoutSession[], profile: UserProfile) {
  const b = myBests(sessions, profile);
  return dots(b.squat + b.bench + b.deadlift, toKg(profile.bodyWeight, profile.units), profile.sex);
}

/** My last 28 days as crew log entries, from the real program + sessions. */
export function myCrewLog(days: ProgramDay[], sessions: WorkoutSession[], today = todayKey()): CrewDay[] {
  return Array.from({ length: 28 }, (_, i) => {
    const date = addDays(today, i - 27);
    return { date, planned: !!dayForDate(days, date), done: sessions.some((s) => s.date === date && !!s.finishedAt) };
  });
}

export function buildMeSnapshot(profile: UserProfile, days: ProgramDay[], sessions: WorkoutSession[]): MeSnapshot {
  const b = myBests(sessions, profile);
  return {
    name: profile.name,
    gym: profile.gym ?? '',
    schedule: [...new Set(days.flatMap((d) => d.weekdays))].sort(),
    split: mySplit(days),
    bodyWeightKg: Math.round(toKg(profile.bodyWeight, profile.units) * 10) / 10,
    sex: profile.sex,
    bests: { 'back-squat': b.squat, 'bench-press': b.bench, deadlift: b.deadlift },
    discoverable: profile.discoverable ?? true,
    trainingLog: myCrewLog(days, sessions),
  };
}

/** Push my profile + training log to the server (no-op when simulated). */
export async function syncMeNow() {
  if (social.kind === 'simulated' || !(await social.account())) return;
  const [profile, days, sessions] = await Promise.all([db.profile.get('me'), db.programDays.toArray(), db.sessions.toArray()]);
  if (profile) await social.syncMe(buildMeSnapshot(profile, days, sessions));
}

// ---------- Spotters maths ----------

export function spotterBests(s: Spotter) {
  const best = { squat: 0, bench: 0, deadlift: 0 };
  for (const [id, v] of Object.entries(s.bests)) {
    const lift = dotsLift(id);
    if (lift) best[lift] = Math.max(best[lift], v);
  }
  return best;
}

export const spotterDots = (s: Spotter) => {
  const b = spotterBests(s);
  return dots(b.squat + b.bench + b.deadlift, s.bodyWeightKg, s.sex);
};

export function crewStats(crew: Crew, me: CrewDay[], today = todayKey()) {
  const log: Record<string, CrewDay[]> = { ...crew.log, me };
  return {
    streak: crewStreak(log, today),
    board: crew.memberIds.map((id) => ({ id, pct: consistency(log[id] ?? []) })).sort((a, b) => b.pct - a.pct),
  };
}

export function matches(spotters: Spotter[], me: { gym: string; schedule: number[]; split: string; dots: number }) {
  return spotters
    .filter((s) => !s.isFriend)
    .map((s) => ({ s, ...matchScore(me, { gym: s.gym, schedule: s.schedule, split: s.split, dots: spotterDots(s) }) }))
    .sort((a, b) => b.score - a.score);
}
