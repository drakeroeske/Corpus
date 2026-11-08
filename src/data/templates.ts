import type { ProgramDay, ProgramExercise } from '../engine/types';

const pe = (exerciseId: string, sets: number, repMin: number, repMax: number, increment: number, startWeight?: number): ProgramExercise => ({
  exerciseId, sets, repMin, repMax, increment, startWeight, technique: 'none',
});

let n = 0;
const day = (name: string, weekdays: number[], exercises: ProgramExercise[]): ProgramDay => ({
  id: `day-${++n}`, name, weekdays, order: n, exercises,
});

export interface Template {
  id: string;
  name: string;
  description: string;
  days: () => ProgramDay[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: '4 days: Mon, Tue, Thu, Fri',
    days: () => [
      day('Upper A', [1], [
        pe('bench-press', 3, 6, 8, 5, 135), pe('barbell-row', 3, 6, 10, 5, 115), pe('db-shoulder-press', 2, 8, 12, 5, 35),
        pe('lat-pulldown', 2, 8, 12, 5, 100), pe('standing-lateral-raise', 3, 12, 15, 2.5, 15), pe('db-curl', 2, 10, 15, 2.5, 25),
        pe('cable-tricep-pressdown', 2, 10, 15, 5, 40),
      ]),
      day('Lower A', [2], [
        pe('back-squat', 3, 5, 8, 10, 185), pe('romanian-deadlift', 3, 8, 10, 10, 155), pe('leg-press', 2, 10, 12, 20, 270),
        pe('ham-curl', 2, 10, 15, 5, 80), pe('standing-calf-raise', 3, 10, 15, 10, 120), pe('cable-crunch', 2, 10, 15, 5, 60),
      ]),
      day('Upper B', [4], [
        pe('incline-db-press', 3, 8, 10, 5, 50), pe('pull-up', 3, 6, 10, 0, 0), pe('machine-chest-press', 2, 10, 12, 10, 120),
        pe('seated-cable-row', 2, 10, 12, 5, 120), pe('face-pull', 2, 12, 15, 5, 40), pe('incline-db-curl', 2, 10, 15, 2.5, 20),
        pe('overhead-cable-extension', 2, 10, 15, 5, 40),
      ]),
      day('Lower B', [5], [
        pe('deadlift', 3, 4, 6, 10, 225), pe('hack-squat', 3, 8, 12, 10, 180), pe('bulgarian-split-squat', 2, 8, 12, 5, 30),
        pe('seated-ham-curl', 2, 10, 15, 5, 80), pe('seated-calf-raise', 3, 12, 15, 10, 90), pe('hanging-leg-raise', 2, 10, 15, 0, 0),
      ]),
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: '6 days: Mon–Sat',
    days: () => {
      const push = (name: string, w: number[]) => day(name, w, [
        pe('bench-press', 3, 6, 8, 5, 135), pe('overhead-press', 3, 6, 10, 5, 85), pe('incline-db-press', 2, 8, 12, 5, 45),
        pe('cable-lateral-raise', 3, 12, 15, 2.5, 15), pe('cable-tricep-pressdown', 3, 10, 15, 5, 40),
      ]);
      const pull = (name: string, w: number[]) => day(name, w, [
        pe('deadlift', 2, 4, 6, 10, 225), pe('pull-up', 3, 6, 10, 0, 0), pe('chest-supported-row', 3, 8, 12, 5, 90),
        pe('face-pull', 3, 12, 15, 5, 40), pe('db-curl', 3, 10, 15, 2.5, 25),
      ]);
      const legs = (name: string, w: number[]) => day(name, w, [
        pe('back-squat', 3, 5, 8, 10, 185), pe('romanian-deadlift', 3, 8, 10, 10, 155), pe('leg-press', 2, 10, 12, 20, 270),
        pe('ham-curl', 2, 10, 15, 5, 80), pe('standing-calf-raise', 3, 10, 15, 10, 120),
      ]);
      return [push('Push A', [1]), pull('Pull A', [2]), legs('Legs A', [3]), push('Push B', [4]), pull('Pull B', [5]), legs('Legs B', [6])];
    },
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: '3 days: Mon, Wed, Fri',
    days: () => [
      day('Full Body A', [1], [
        pe('back-squat', 3, 5, 8, 10, 185), pe('bench-press', 3, 6, 8, 5, 135), pe('barbell-row', 3, 8, 10, 5, 115),
        pe('standing-lateral-raise', 2, 12, 15, 2.5, 15), pe('db-curl', 2, 10, 15, 2.5, 25),
      ]),
      day('Full Body B', [3], [
        pe('deadlift', 3, 4, 6, 10, 225), pe('overhead-press', 3, 6, 10, 5, 85), pe('lat-pulldown', 3, 8, 12, 5, 100),
        pe('leg-press', 2, 10, 12, 20, 270), pe('cable-tricep-pressdown', 2, 10, 15, 5, 40),
      ]),
      day('Full Body C', [5], [
        pe('front-squat', 3, 6, 8, 10, 135), pe('incline-db-press', 3, 8, 10, 5, 50), pe('seated-cable-row', 3, 8, 12, 5, 120),
        pe('ham-curl', 2, 10, 15, 5, 80), pe('face-pull', 2, 12, 15, 5, 40),
      ]),
    ],
  },
  {
    id: 'corpus-5',
    name: 'Corpus 5-Day',
    description: 'Pull+Hams, Push, Back+Arms, Legs (Mon, Tue, Thu, Fri)',
    days: () => [
      day('Pull + Hams', [1], [
        pe('pullover', 1, 10, 12, 2.5, 30), pe('ham-curl', 2, 12, 15, 5, 75), pe('lat-pulldown', 2, 8, 10, 5, 85),
        pe('close-grip-pulldown', 1, 10, 12, 5, 70), pe('chest-supported-row', 2, 6, 10, 5), pe('db-curl', 3, 12, 15, 2.5, 15),
      ]),
      day('Push', [2], [
        pe('incline-db-press', 2, 6, 10, 5, 45), pe('machine-chest-press', 2, 10, 12, 5), pe('seated-lateral-raise', 3, 10, 15, 2.5, 10),
        pe('incline-machine-press', 2, 8, 12, 5, 40), pe('dip-machine', 2, 8, 12, 5), pe('skull-crusher', 3, 12, 15, 5, 35),
      ]),
      day('Back + Arms', [4], [
        pe('pull-up', 2, 6, 10, 0, 0), pe('single-arm-db-row', 2, 8, 10, 5, 40), pe('cable-chin-up', 2, 8, 10, 2.5, 40),
        pe('db-shoulder-press', 2, 6, 10, 5, 35), pe('standing-lateral-raise', 3, 10, 15, 2.5, 10), pe('incline-db-curl', 2, 10, 15, 2.5, 15),
        pe('cable-tricep-pressdown', 2, 10, 15, 5),
      ]),
      day('Legs', [5], [
        pe('back-squat', 2, 5, 8, 10, 135), pe('leg-press', 3, 8, 12, 20, 180), pe('ham-curl', 2, 12, 15, 5, 75),
        pe('quad-extension', 2, 10, 15, 5), pe('adductor', 2, 10, 15, 10, 90), pe('abductor', 2, 10, 15, 10),
      ]),
    ],
  },
];
