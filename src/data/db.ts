import Dexie, { type EntityTable } from 'dexie';
import type {
  CheckIn,
  Client,
  CoachNote,
  Comment,
  Crew,
  Experiment,
  FeedPost,
  GymCheckIn,
  Meal,
  Measurement,
  ProgramDay,
  Spotter,
  UserProfile,
  WorkoutSession,
} from '../engine/types';

export const db = new Dexie('corpus-v1') as Dexie & {
  profile: EntityTable<UserProfile, 'id'>;
  programDays: EntityTable<ProgramDay, 'id'>;
  sessions: EntityTable<WorkoutSession, 'id'>;
  checkins: EntityTable<CheckIn, 'date'>;
  meals: EntityTable<Meal, 'id'>;
  experiments: EntityTable<Experiment, 'id'>;
  measurements: EntityTable<Measurement, 'id'>;
  spotters: EntityTable<Spotter, 'id'>;
  posts: EntityTable<FeedPost, 'id'>;
  comments: EntityTable<Comment, 'id'>;
  crews: EntityTable<Crew, 'id'>;
  gymCheckins: EntityTable<GymCheckIn, 'id'>;
  clients: EntityTable<Client, 'id'>;
  coachNotes: EntityTable<CoachNote, 'id'>;
  outbox: EntityTable<OutboxOp, 'id'>;
};

db.version(1).stores({
  profile: 'id',
  programDays: 'id, order',
  sessions: 'id, date, programDayId',
  checkins: 'date',
  meals: 'id, date, isFavorite',
  experiments: 'id, status',
  measurements: 'id, date',
  spotters: 'id, gym',
  posts: 'id, time, authorId',
  comments: 'id, postId',
  crews: 'id',
  gymCheckins: 'id, gym, time',
  clients: 'id',
  coachNotes: 'id, clientId',
});

/** Social writes waiting to be sent to the server (offline queue). */
export interface OutboxOp {
  id: string;
  time: number;
  kind: 'post' | 'deletePost' | 'like' | 'unlike' | 'comment' | 'checkin' | 'follow' | 'crew' | 'syncMe';
  payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

db.version(2).stores({ outbox: 'id, time' });

export const ALL_TABLES = [
  'profile', 'programDays', 'sessions', 'checkins', 'meals', 'experiments', 'measurements',
  'spotters', 'posts', 'comments', 'crews', 'gymCheckins', 'clients', 'coachNotes',
] as const;

// ---------- Small helpers ----------

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
export const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function defaultProfile(): UserProfile {
  return {
    id: 'me',
    name: 'You',
    units: 'lb',
    bodyWeight: 180,
    heightCm: 178,
    age: 30,
    experience: 'intermediate',
    goal: 'muscle',
    programStartDate: todayKey(),
    returnFromBreakStart: null,
    isCoach: false,
    restCompoundSec: 180,
    restIsolationSec: 90,
    onboarded: false,
  };
}
