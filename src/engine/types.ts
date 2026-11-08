// All shared data types. Pure TypeScript — no React, no storage.

export const MUSCLES = [
  'chest',
  'back',
  'lats',
  'upper back',
  'front delts',
  'side delts',
  'rear delts',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'core',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const UPPER_BODY: Muscle[] = [
  'chest', 'back', 'lats', 'upper back', 'front delts', 'side delts', 'rear delts', 'biceps', 'triceps',
];

export type Units = 'lb' | 'kg';
export type Goal = 'muscle' | 'strength' | 'fatloss' | 'recomp';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Sex = 'male' | 'female';

export interface UserProfile {
  id: 'me';
  name: string;
  units: Units;
  bodyWeight: number; // in profile units
  heightCm: number;
  age: number;
  sex?: Sex;
  experience: Experience;
  goal: Goal;
  programStartDate: string; // YYYY-MM-DD
  returnFromBreakStart: string | null; // null = off
  isCoach: boolean;
  restCompoundSec: number;
  restIsolationSec: number;
  gym?: string;
  onboarded: boolean;
  liftGoals?: Record<string, number>; // exerciseId → goal e1RM
  sharePosts?: 'all' | 'prs' | 'off'; // what finished workouts post to the feed (default all)
  discoverable?: boolean; // show gym/schedule/split/strength to others for matching (default true)
}

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'smith' | 'bodyweight' | 'kettlebell';
export type Pattern = 'squat' | 'hinge' | 'hpush' | 'vpush' | 'hpull' | 'vpull' | 'isolation' | 'carry';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  pattern: Pattern;
}

export type Technique = 'none' | 'dropset' | 'restpause' | 'failure';

export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  startWeight?: number;
  increment: number;
  technique?: Technique;
}

export interface ProgramDay {
  id: string;
  name: string;
  weekdays: number[]; // 0 = Sunday … 6 = Saturday
  order: number;
  exercises: ProgramExercise[];
}

export interface LoggedSet {
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  rir?: number;
  isWarmup: boolean;
  time?: number; // ms timestamp
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  programDayId: string;
  sets: LoggedSet[];
  durationSec: number;
  notes: string;
  startedAt: number;
  finishedAt?: number;
  /** programmed exerciseId → substitute exerciseId used today */
  substitutions?: Record<string, string>;
}

export interface CheckIn {
  date: string;
  bodyWeight?: number;
  sleepHours?: number;
  sleepQuality?: number;
  hrv?: number;
  restingHr?: number;
  energy?: number;
  stress?: number;
  soreness: Partial<Record<Muscle, number>>;
  steps?: number;
  notes: string;
  experimentFlag?: boolean;
}

export interface Meal {
  id: string;
  date: string;
  time: string; // HH:MM
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  isFavorite: boolean;
}

export type ExperimentType = 'creatine' | 'ampm' | 'protein' | 'caffeine' | 'sleep' | 'custom';

export interface Experiment {
  id: string;
  type: ExperimentType;
  name: string;
  question: string; // the daily yes/no item
  startDate: string;
  baselineDays: number; // 14
  lengthDays: number; // 28
  status: 'baseline' | 'testing' | 'done' | 'stopped';
}

export interface Measurement {
  id: string;
  date: string;
  waistCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  photo?: Blob;
  note?: string;
}

// ---------- Social (simulated) ----------

export interface Spotter {
  id: string;
  name: string;
  gym: string;
  schedule: number[]; // weekdays they train
  split: string;
  bodyWeightKg: number;
  sex: Sex;
  bests: Record<string, number>; // exerciseId → e1RM kg
  isFriend: boolean;
  trainingNow?: boolean;
}

export interface FeedPost {
  id: string;
  authorId: string; // 'me' or spotter id
  time: number;
  title: string;
  durationSec: number;
  topSets: string[];
  prs: string[];
  likes: string[]; // user ids
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  time: number;
  text: string;
}

export interface Crew {
  id: string;
  name: string;
  memberIds: string[]; // includes 'me'
  /** memberId → dates (YYYY-MM-DD) of planned sessions and whether done */
  log: Record<string, { date: string; planned: boolean; done: boolean }[]>;
}

export interface GymCheckIn {
  id: string;
  gym: string;
  time: number;
  userId: string;
}

// ---------- Coaching (simulated) ----------

export interface Client {
  id: string;
  name: string;
  readiness: number[]; // last 7 days, oldest first
  planned: number; // sessions planned last 14d
  done: number; // sessions done last 14d
  missedInARow: number;
  lastSession: string; // YYYY-MM-DD
  lastSessionTitle: string;
  program: ProgramDay[];
}

export interface CoachNote {
  id: string;
  clientId: string;
  time: number;
  text: string;
}
