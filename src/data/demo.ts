// "Load demo data": 8 weeks for one user + simulated social and coaching data.
// Workouts are generated with the real progression engine so the numbers behave like a real log.
import { ALL_TABLES, db, todayKey } from './db';
import { TEMPLATES } from './templates';
import { exerciseName } from './exercises';
import { dayForDate, exById, historyFor, isBodyweight, sessionStats } from './plan';
import {
  MUSCLES,
  addDays,
  nextTarget,
  type CheckIn,
  type Client,
  type Comment,
  type Crew,
  type FeedPost,
  type LoggedSet,
  type Meal,
  type Muscle,
  type Spotter,
  type UserProfile,
  type WorkoutSession,
} from '../engine';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const at = (date: string, h: number, m = 0) => {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).getTime();
};

const MEALS = {
  breakfast: { name: 'Greek yogurt bowl', kcal: 650, protein: 38, carbs: 80, fat: 16, fav: true, time: '07:30' },
  lunch: { name: 'Chicken rice bowl', kcal: 850, protein: 52, carbs: 105, fat: 20, fav: true, time: '12:30' },
  shake: { name: 'Protein shake', kcal: 160, protein: 30, carbs: 4, fat: 2, fav: true, time: '16:00' },
  salmon: { name: 'Salmon, potatoes, greens', kcal: 950, protein: 45, carbs: 90, fat: 38, fav: false, time: '19:30' },
  burrito: { name: 'Beef burrito', kcal: 980, protein: 42, carbs: 110, fat: 36, fav: false, time: '19:45' },
  snack: { name: 'Bagel + peanut butter', kcal: 480, protein: 15, carbs: 60, fat: 18, fav: false, time: '21:00' },
};

export async function loadDemoData(): Promise<void> {
  const r = rng(7);
  const today = todayKey();
  const start = addDays(today, -56);

  const profile: UserProfile = {
    id: 'me', name: 'Alex', units: 'lb', bodyWeight: 182, heightCm: 180, age: 29, sex: 'male', experience: 'intermediate',
    goal: 'muscle', programStartDate: start, returnFromBreakStart: null, isCoach: true, restCompoundSec: 180, restIsolationSec: 90,
    gym: 'Iron Works Downtown', onboarded: true, liftGoals: { 'back-squat': 275, 'bench-press': 205 },
  };
  const days = TEMPLATES.find((t) => t.id === 'upper-lower')!.days().map((d, i) => ({ ...d, id: `demo-day-${i}`, order: i }));

  // ---------- Experiment ----------
  const expStart = addDays(today, -20);
  const testStart = addDays(expStart, 14);

  // ---------- Sessions ----------
  const sessions: WorkoutSession[] = [];
  const sleepOn: Record<string, number> = {};
  for (let i = 0; i <= 56; i++) sleepOn[addDays(start, i)] = Math.round((6.2 + r() * 2.3) * 4) / 4;

  for (let i = 0; i < 56; i++) {
    const date = addDays(start, i);
    const day = dayForDate(days, date);
    if (!day || (i > 3 && r() < 0.06)) continue; // a couple of missed sessions
    const startedAt = at(date, 18, Math.floor(r() * 30));
    const sets: LoggedSet[] = [];
    let t = startedAt;
    for (const pe of day.exercises) {
      const ex = exById(pe.exerciseId);
      const bw = isBodyweight(ex);
      const hist = historyFor(sessions, ex.id);
      const target = nextTarget(pe, bw, hist);
      const last = hist[hist.length - 1];
      let weight = target.weight ?? pe.startWeight ?? 50;
      let reps: number;
      if (ex.id === 'bench-press' && i >= 28 && last) {
        weight = last.weight; // the plateau: bench stops moving in weeks 5–8
        reps = Math.max(pe.repMin, last.reps - (r() < 0.3 ? 1 : 0));
      } else if (target.action === 'start') reps = pe.repMin + 1;
      else if (target.action === 'increase') reps = pe.repMin + (r() < 0.5 ? 1 : 0);
      else if (target.action === 'add-load') reps = pe.repMax;
      else reps = Math.min(pe.repMax, (last?.reps ?? pe.repMin) + (r() < (sleepOn[date] >= 7.5 ? 0.85 : 0.6) ? 1 : 0));
      if (bw) weight = 0;
      for (let k = 0; k < pe.sets; k++) {
        sets.push({ exerciseId: ex.id, setIndex: k, weight, reps: Math.max(1, reps - (k === 0 ? 0 : 1)), rir: k === 0 ? 2 : 1, isWarmup: false, time: t });
        t += 3 * 60_000;
      }
    }
    const durationSec = Math.round((t - startedAt) / 1000) + 300;
    sessions.push({ id: `demo-s-${i}`, date, programDayId: day.id, sets, durationSec, notes: '', startedAt, finishedAt: startedAt + durationSec * 1000, substitutions: {} });
  }

  // ---------- Check-ins ----------
  const checkins: CheckIn[] = [];
  for (let i = 0; i <= 56; i++) {
    const date = addDays(start, i);
    if (date !== today && r() < 0.08) continue;
    const sleep = sleepOn[date];
    const yesterday = sessions.find((s) => s.date === addDays(date, -1));
    const soreness: Partial<Record<Muscle, number>> = {};
    for (const m of MUSCLES) soreness[m] = 1;
    if (yesterday) for (const m of new Set(yesterday.sets.flatMap((s) => exById(s.exerciseId).primaryMuscles))) soreness[m] = r() < 0.5 ? 3 : 2;
    checkins.push({
      date,
      bodyWeight: Math.round((180 + i * 0.045 + (r() - 0.5) * 1.2) * 10) / 10,
      sleepHours: sleep,
      sleepQuality: Math.max(1, Math.min(5, Math.round(sleep - 3.5 + r()))),
      hrv: Math.round(50 + (sleep - 6) * 6 + r() * 8),
      restingHr: Math.round(60 - (sleep - 6) * 2 + r() * 4),
      energy: Math.max(1, Math.min(5, Math.round(1 + (sleep - 5.5) * 1.1 + r()))),
      stress: 1 + Math.floor(r() * 3),
      soreness,
      steps: Math.round(6000 + r() * 7000),
      notes: '',
      experimentFlag: date >= testStart ? r() < 0.88 : undefined,
    });
  }

  // ---------- Meals ----------
  const meals: Meal[] = [];
  let n = 0;
  for (let i = 0; i <= 56; i++) {
    const date = addDays(start, i);
    const recent = i >= 50;
    const hit = recent ? [50, 52, 55].includes(i) : r() < 0.8;
    const list = date === today ? [MEALS.breakfast, MEALS.lunch] : hit ? [MEALS.breakfast, MEALS.lunch, MEALS.shake, MEALS.salmon, MEALS.snack] : [MEALS.breakfast, MEALS.lunch, MEALS.burrito, MEALS.snack];
    for (const m of list) meals.push({ id: `demo-m-${n++}`, date, time: m.time, name: m.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, isFavorite: m.fav });
  }

  // ---------- Social ----------
  const spotters: Spotter[] = [
    { id: 'sp-maya', name: 'Maya R.', gym: 'Iron Works Downtown', schedule: [1, 2, 4, 5], split: 'Upper/Lower', bodyWeightKg: 63, sex: 'female', bests: { 'back-squat': 105, 'bench-press': 62, deadlift: 135 }, isFriend: true, trainingNow: true },
    { id: 'sp-jordan', name: 'Jordan K.', gym: 'Iron Works Downtown', schedule: [1, 2, 3, 4, 5, 6], split: 'PPL', bodyWeightKg: 88, sex: 'male', bests: { 'back-squat': 170, 'bench-press': 125, deadlift: 210 }, isFriend: true, trainingNow: true },
    { id: 'sp-priya', name: 'Priya S.', gym: 'Northside Barbell', schedule: [1, 3, 5], split: 'Full Body', bodyWeightKg: 58, sex: 'female', bests: { 'back-squat': 95, 'bench-press': 50, deadlift: 120 }, isFriend: true },
    { id: 'sp-leo', name: 'Leo M.', gym: 'Iron Works Downtown', schedule: [1, 2, 4, 5], split: 'Upper/Lower', bodyWeightKg: 80, sex: 'male', bests: { 'back-squat': 140, 'bench-press': 100, deadlift: 180 }, isFriend: false, trainingNow: true },
    { id: 'sp-sam', name: 'Sam T.', gym: 'Northside Barbell', schedule: [2, 4, 6], split: 'PPL', bodyWeightKg: 92, sex: 'male', bests: { 'back-squat': 200, 'bench-press': 140, deadlift: 240 }, isFriend: false },
  ];
  const now = Date.now();
  const posts: FeedPost[] = [];
  const comments: Comment[] = [];
  const friendIds = spotters.map((s) => s.id);
  for (const s of sessions.filter((x) => x.date >= addDays(today, -21))) {
    const st = sessionStats(s, sessions);
    posts.push({
      id: `post-${s.id}`, authorId: 'me', time: s.finishedAt!, title: days.find((d) => d.id === s.programDayId)?.name ?? 'Workout', durationSec: s.durationSec,
      topSets: st.topSets.slice(0, 3).map((x) => `${exerciseName(x.exerciseId)} ${x.weight || 'BW'}${x.weight ? ' lb' : ''} × ${x.reps}`),
      prs: st.prs.map((x) => `${exerciseName(x.exerciseId)} e1RM ${x.e1rm} lb`),
      likes: friendIds.filter(() => r() < 0.5),
    });
  }
  const friendPosts: [string, string, string[], string[], number][] = [
    ['sp-maya', 'Lower A', ['Back Squat 95 kg × 6', 'Romanian Deadlift 80 kg × 8'], ['Back Squat e1RM 114 kg'], 3],
    ['sp-jordan', 'Push A', ['Bench Press 110 kg × 5', 'Overhead Press 65 kg × 6'], [], 8],
    ['sp-priya', 'Full Body B', ['Deadlift 110 kg × 4', 'Lat Pulldown 50 kg × 10'], ['Deadlift e1RM 125 kg'], 20],
    ['sp-leo', 'Upper B', ['Incline DB Press 34 kg × 8', 'Pull-Up BW × 10'], [], 30],
    ['sp-sam', 'Legs A', ['Back Squat 180 kg × 5'], ['Back Squat e1RM 210 kg'], 45],
    ['sp-maya', 'Upper A', ['Bench Press 55 kg × 7'], [], 50],
    ['sp-jordan', 'Pull A', ['Deadlift 200 kg × 3'], [], 70],
  ];
  friendPosts.forEach(([author, title, topSets, prs, hoursAgo], i) =>
    posts.push({ id: `post-f${i}`, authorId: author, time: now - hoursAgo * 3_600_000, title, durationSec: 3300 + i * 300, topSets, prs, likes: r() < 0.5 ? ['me'] : [] }),
  );
  const myLatest = posts.filter((p) => p.authorId === 'me').sort((a, b) => b.time - a.time)[0];
  if (myLatest) {
    comments.push({ id: 'c1', postId: myLatest.id, authorId: 'sp-maya', time: myLatest.time + 3_600_000, text: 'Strong session' });
    comments.push({ id: 'c2', postId: myLatest.id, authorId: 'sp-jordan', time: myLatest.time + 5_400_000, text: 'Bench next week?' });
  }
  comments.push({ id: 'c3', postId: 'post-f0', authorId: 'me', time: now - 2 * 3_600_000, text: 'Huge squat PR' });

  const crewLog = (schedule: number[], seed: number) => {
    const rr = rng(seed);
    return Array.from({ length: 28 }, (_, i) => {
      const date = addDays(today, i - 27);
      const [y, m, d] = date.split('-').map(Number);
      const planned = schedule.includes(new Date(y, m - 1, d).getDay());
      return { date, planned, done: planned && date < today && (i > 20 || rr() < 0.9) };
    });
  };
  const crews: Crew[] = [{ id: 'crew-1', name: 'Iron Works 6PM', memberIds: ['me', 'sp-maya', 'sp-jordan'], log: { 'sp-maya': crewLog([1, 2, 4, 5], 3), 'sp-jordan': crewLog([1, 2, 3, 4, 5, 6], 5) } }];

  // ---------- Coaching ----------
  const ct = TEMPLATES.find((t) => t.id === 'full-body')!;
  const clients: Client[] = [
    { id: 'cl-1', name: 'Dana W.', readiness: [78, 82, 75, 80, 77, 84, 79], planned: 6, done: 6, missedInARow: 0, lastSession: addDays(today, -1), lastSessionTitle: 'Full Body C', program: ct.days() },
    { id: 'cl-2', name: 'Chris P.', readiness: [66, 61, 58, 52, 47, 44, 41], planned: 6, done: 5, missedInARow: 0, lastSession: addDays(today, -2), lastSessionTitle: 'Full Body B', program: ct.days() },
    { id: 'cl-3', name: 'Morgan L.', readiness: [72, 70, 68, 71, 69, 73, 70], planned: 6, done: 3, missedInARow: 2, lastSession: addDays(today, -6), lastSessionTitle: 'Full Body A', program: ct.days() },
  ];

  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
    await db.profile.put(profile);
    await db.programDays.bulkAdd(days);
    await db.sessions.bulkAdd(sessions);
    await db.checkins.bulkAdd(checkins);
    await db.meals.bulkAdd(meals);
    await db.experiments.add({ id: 'exp-1', type: 'creatine', name: 'Creatine 5 g daily', question: 'Took 5 g creatine today?', startDate: expStart, baselineDays: 14, lengthDays: 28, status: 'testing' });
    await db.measurements.bulkAdd([
      { id: 'ms-1', date: start, waistCm: 84, chestCm: 102, armCm: 37, thighCm: 58, note: 'Start of block' },
      { id: 'ms-2', date: addDays(today, -7), waistCm: 84.5, chestCm: 104, armCm: 38, thighCm: 59.5, note: 'Week 7' },
    ]);
    await db.spotters.bulkAdd(spotters);
    await db.posts.bulkAdd(posts);
    await db.comments.bulkAdd(comments);
    await db.crews.bulkAdd(crews);
    await db.clients.bulkAdd(clients);
    await db.coachNotes.add({ id: 'cn-1', clientId: 'cl-2', time: now - 86_400_000, text: 'Sleep has dropped since the new job. Keep volume, cap RIR at 2.' });
  });
}
