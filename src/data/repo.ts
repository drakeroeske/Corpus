// Reads/writes against Dexie. UI calls these; no engine logic lives here.
import { useLiveQuery } from 'dexie-react-hooks';
import type { CheckIn, LoggedSet, Meal, ProgramDay, Units, UserProfile, WorkoutSession } from '../engine/types';
import { LB_PER_KG, roundTo } from '../engine/util';
import { breakPhase } from '../engine/progression';
import { db, defaultProfile, nowTime, todayKey, uid } from './db';
import { TEMPLATES } from './templates';
import { sessionStats } from './plan';
import { exerciseName } from './exercises';
import { social, syncMeNow } from '../services/social';

// ---------- Profile ----------

export function useProfile(): UserProfile {
  return useLiveQuery(() => db.profile.get('me')) ?? defaultProfile();
}

export async function ensureProfile() {
  const p = await db.profile.get('me');
  if (!p) return db.profile.put(defaultProfile());
  // Return-from-break mode switches itself off after week 4.
  if (breakPhase(p.returnFromBreakStart, todayKey())?.name === 'Done') await db.profile.update('me', { returnFromBreakStart: null });
}

export async function saveProfile(patch: Partial<UserProfile>) {
  const cur = (await db.profile.get('me')) ?? defaultProfile();
  await db.profile.put({ ...cur, ...patch });
}

// ---------- Units ----------

const INC_KG: Record<number, number> = { 2.5: 1.25, 5: 2.5, 10: 5, 20: 10 };

export function convertProgram(days: ProgramDay[], to: Units): ProgramDay[] {
  if (to === 'lb') {
    return days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => ({
        ...e,
        startWeight: e.startWeight === undefined ? undefined : roundTo(e.startWeight * LB_PER_KG, 2.5),
        increment: e.increment ? roundTo(e.increment * LB_PER_KG, 2.5) : 0,
      })),
    }));
  }
  return days.map((d) => ({
    ...d,
    exercises: d.exercises.map((e) => ({
      ...e,
      startWeight: e.startWeight === undefined ? undefined : roundTo(e.startWeight / LB_PER_KG, 2.5),
      increment: e.increment ? (INC_KG[e.increment] ?? roundTo(e.increment / LB_PER_KG, 1.25)) : 0,
    })),
  }));
}

/** Switch units and convert every stored weight. */
export async function changeUnits(to: Units) {
  const p = (await db.profile.get('me')) ?? defaultProfile();
  if (p.units === to) return;
  const f = to === 'kg' ? 1 / LB_PER_KG : LB_PER_KG;
  const r = (w: number) => roundTo(w * f, to === 'kg' ? 0.5 : 0.5);
  await db.transaction('rw', [db.profile, db.programDays, db.sessions, db.checkins], async () => {
    await db.profile.put({ ...p, units: to, bodyWeight: r(p.bodyWeight) });
    const days = await db.programDays.toArray();
    await db.programDays.bulkPut(convertProgram(days, to));
    const sessions = await db.sessions.toArray();
    await db.sessions.bulkPut(sessions.map((s) => ({ ...s, sets: s.sets.map((x) => ({ ...x, weight: r(x.weight) })) })));
    const cis = await db.checkins.toArray();
    await db.checkins.bulkPut(cis.map((c) => (c.bodyWeight ? { ...c, bodyWeight: r(c.bodyWeight) } : c)));
  });
}

// ---------- Program ----------

export function useProgram(): ProgramDay[] | undefined {
  return useLiveQuery(() => db.programDays.orderBy('order').toArray());
}

export async function applyTemplate(templateId: string) {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) return;
  const p = (await db.profile.get('me')) ?? defaultProfile();
  const days = t.days().map((d, i) => ({ ...d, id: uid(), order: i }));
  await db.transaction('rw', db.programDays, async () => {
    await db.programDays.clear();
    await db.programDays.bulkAdd(p.units === 'kg' ? convertProgram(days, 'kg') : days);
  });
}

export async function saveDay(day: ProgramDay) {
  await db.programDays.put(day);
}

export async function addDay(): Promise<string> {
  const count = await db.programDays.count();
  const id = uid();
  await db.programDays.add({ id, name: `Day ${count + 1}`, weekdays: [], order: count, exercises: [] });
  return id;
}

export const deleteDay = (id: string) => db.programDays.delete(id);

// ---------- Sessions ----------

export function useSessions(): WorkoutSession[] | undefined {
  return useLiveQuery(() => db.sessions.orderBy('date').toArray());
}

/** Reuse today's unfinished session for this day, or start a new one. */
export async function startSession(programDayId: string): Promise<string> {
  const date = todayKey();
  const open = (await db.sessions.where('date').equals(date).toArray()).find((s) => s.programDayId === programDayId && !s.finishedAt);
  if (open) return open.id;
  const id = uid();
  await db.sessions.add({ id, date, programDayId, sets: [], durationSec: 0, notes: '', startedAt: Date.now(), substitutions: {} });
  return id;
}

export async function logSet(sessionId: string, set: Omit<LoggedSet, 'setIndex' | 'time'>) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const setIndex = s.sets.filter((x) => x.exerciseId === set.exerciseId).length;
  await db.sessions.update(sessionId, { sets: [...s.sets, { ...set, setIndex, time: Date.now() }] });
}

export async function deleteSet(sessionId: string, index: number) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  await db.sessions.update(sessionId, { sets: s.sets.filter((_, i) => i !== index) });
}

export async function setSubstitution(sessionId: string, programmedId: string, substituteId: string | null) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const subs = { ...s.substitutions };
  if (substituteId) subs[programmedId] = substituteId;
  else delete subs[programmedId];
  await db.sessions.update(sessionId, { substitutions: subs });
}

export async function setSessionNotes(sessionId: string, notes: string) {
  await db.sessions.update(sessionId, { notes });
}

/** Finish: store duration and auto-post a workout card to the feed. */
export async function finishSession(sessionId: string) {
  const s = await db.sessions.get(sessionId);
  if (!s || s.finishedAt) return;
  const finishedAt = Date.now();
  const durationSec = Math.round((finishedAt - s.startedAt) / 1000);
  const done = { ...s, finishedAt, durationSec };
  await db.sessions.put(done);

  const all = await db.sessions.toArray();
  const day = await db.programDays.get(s.programDayId);
  const p = (await db.profile.get('me')) ?? defaultProfile();
  const stats = sessionStats(done, all);
  const share = p.sharePosts ?? 'all';
  if (share === 'all' || (share === 'prs' && stats.prs.length)) {
    await social.postWorkout({
      id: `post-${sessionId}`,
      time: finishedAt,
      title: day?.name ?? 'Workout',
      durationSec,
      topSets: share === 'all' ? stats.topSets.slice(0, 3).map((t) => `${exerciseName(t.exerciseId)} ${t.weight || 'BW'}${t.weight ? ' ' + p.units : ''} × ${t.reps}`) : [],
      prs: stats.prs.map((x) => `${exerciseName(x.exerciseId)} e1RM ${x.e1rm} ${p.units}`),
    });
  }
  await syncMeNow();
}

export async function deleteSession(id: string) {
  await db.sessions.delete(id);
  await social.deletePost(`post-${id}`);
}

// ---------- Everything most screens need ----------

export function useData() {
  const profile = useProfile();
  const days = useProgram();
  const sessions = useSessions();
  const checkins = useLiveQuery(() => db.checkins.orderBy('date').toArray());
  const meals = useLiveQuery(() => db.meals.toArray());
  if (!days || !sessions || !checkins || !meals) return null;
  return { profile, days, sessions, checkins, meals };
}

// ---------- Check-ins & meals ----------

export const saveCheckIn = (c: CheckIn) => db.checkins.put(c);

export async function addMeal(m: Omit<Meal, 'id' | 'date' | 'time'>) {
  await db.meals.add({ ...m, id: uid(), date: todayKey(), time: nowTime() });
}

export async function toggleFavorite(id: string) {
  const m = await db.meals.get(id);
  if (m) await db.meals.update(id, { isFavorite: !m.isFavorite });
}

export const deleteMeal = (id: string) => db.meals.delete(id);
