import type { Equipment, Exercise, Muscle, Pattern } from '../engine/types';

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function x(name: string, pattern: Pattern, equipment: Equipment, primary: Muscle[], secondary: Muscle[] = []): Exercise {
  return { id: slug(name), name, pattern, equipment, primaryMuscles: primary, secondaryMuscles: secondary };
}

export const EXERCISES: Exercise[] = [
  // Squat pattern
  x('Back Squat', 'squat', 'barbell', ['quads', 'glutes'], ['adductors', 'core', 'back']),
  x('Front Squat', 'squat', 'barbell', ['quads'], ['glutes', 'core', 'upper back']),
  x('Hack Squat', 'squat', 'machine', ['quads'], ['glutes']),
  x('Leg Press', 'squat', 'machine', ['quads', 'glutes'], ['adductors']),
  x('Smith Squat', 'squat', 'smith', ['quads', 'glutes'], ['adductors']),
  x('Goblet Squat', 'squat', 'dumbbell', ['quads', 'glutes'], ['core']),
  x('Bulgarian Split Squat', 'squat', 'dumbbell', ['quads', 'glutes'], ['adductors']),
  x('Walking Lunge', 'squat', 'dumbbell', ['quads', 'glutes'], ['hamstrings']),
  // Hinge
  x('Deadlift', 'hinge', 'barbell', ['hamstrings', 'glutes', 'back'], ['upper back', 'quads', 'core']),
  x('Romanian Deadlift', 'hinge', 'barbell', ['hamstrings', 'glutes'], ['back']),
  x('DB Romanian Deadlift', 'hinge', 'dumbbell', ['hamstrings', 'glutes'], ['back']),
  x('Trap Bar Deadlift', 'hinge', 'barbell', ['quads', 'glutes', 'hamstrings'], ['back', 'upper back']),
  x('Hip Thrust', 'hinge', 'barbell', ['glutes'], ['hamstrings']),
  x('Machine Hip Thrust', 'hinge', 'machine', ['glutes'], ['hamstrings']),
  x('Back Extension', 'hinge', 'bodyweight', ['back', 'glutes'], ['hamstrings']),
  x('Cable Pull-Through', 'hinge', 'cable', ['glutes', 'hamstrings']),
  // Horizontal push
  x('Bench Press', 'hpush', 'barbell', ['chest', 'triceps'], ['front delts']),
  x('Incline Bench Press', 'hpush', 'barbell', ['chest', 'front delts'], ['triceps']),
  x('DB Bench Press', 'hpush', 'dumbbell', ['chest', 'triceps'], ['front delts']),
  x('Incline DB Press', 'hpush', 'dumbbell', ['chest', 'front delts'], ['triceps']),
  x('Machine Chest Press', 'hpush', 'machine', ['chest', 'triceps'], ['front delts']),
  x('Incline Machine Press', 'hpush', 'machine', ['chest', 'front delts'], ['triceps']),
  x('Smith Bench Press', 'hpush', 'smith', ['chest', 'triceps'], ['front delts']),
  x('Push-Up', 'hpush', 'bodyweight', ['chest', 'triceps'], ['front delts', 'core']),
  x('Dip', 'hpush', 'bodyweight', ['chest', 'triceps'], ['front delts']),
  x('Dip Machine', 'hpush', 'machine', ['triceps', 'chest']),
  // Vertical push
  x('Overhead Press', 'vpush', 'barbell', ['front delts', 'triceps'], ['side delts', 'core']),
  x('DB Shoulder Press', 'vpush', 'dumbbell', ['front delts', 'triceps'], ['side delts']),
  x('Machine Shoulder Press', 'vpush', 'machine', ['front delts', 'triceps'], ['side delts']),
  x('Smith Shoulder Press', 'vpush', 'smith', ['front delts', 'triceps'], ['side delts']),
  // Horizontal pull
  x('Barbell Row', 'hpull', 'barbell', ['upper back', 'lats'], ['biceps', 'rear delts', 'back']),
  x('Chest-Supported Row', 'hpull', 'machine', ['upper back', 'lats'], ['biceps', 'rear delts']),
  x('Single-Arm DB Row', 'hpull', 'dumbbell', ['lats', 'upper back'], ['biceps']),
  x('Seated Cable Row', 'hpull', 'cable', ['upper back', 'lats'], ['biceps', 'rear delts']),
  x('T-Bar Row', 'hpull', 'barbell', ['upper back', 'lats'], ['biceps', 'back']),
  x('Inverted Row', 'hpull', 'bodyweight', ['upper back', 'lats'], ['biceps']),
  // Vertical pull
  x('Pull-Up', 'vpull', 'bodyweight', ['lats', 'biceps'], ['upper back']),
  x('Chin-Up', 'vpull', 'bodyweight', ['lats', 'biceps'], ['upper back']),
  x('Lat Pulldown', 'vpull', 'cable', ['lats', 'biceps'], ['upper back']),
  x('Close-Grip Pulldown', 'vpull', 'cable', ['lats', 'biceps'], ['upper back']),
  x('Cable Chin-Up', 'vpull', 'cable', ['lats', 'biceps']),
  x('Machine Pulldown', 'vpull', 'machine', ['lats', 'biceps'], ['upper back']),
  // Isolation — arms
  x('Barbell Curl', 'isolation', 'barbell', ['biceps']),
  x('DB Curl', 'isolation', 'dumbbell', ['biceps']),
  x('Incline DB Curl', 'isolation', 'dumbbell', ['biceps']),
  x('Hammer Curl', 'isolation', 'dumbbell', ['biceps']),
  x('Cable Curl', 'isolation', 'cable', ['biceps']),
  x('Preacher Curl Machine', 'isolation', 'machine', ['biceps']),
  x('Skull Crusher', 'isolation', 'barbell', ['triceps']),
  x('Cable Tricep Pressdown', 'isolation', 'cable', ['triceps']),
  x('Overhead Cable Extension', 'isolation', 'cable', ['triceps']),
  x('DB Overhead Extension', 'isolation', 'dumbbell', ['triceps']),
  // Isolation — shoulders / chest / back
  x('Seated Lateral Raise', 'isolation', 'dumbbell', ['side delts']),
  x('Standing Lateral Raise', 'isolation', 'dumbbell', ['side delts']),
  x('Cable Lateral Raise', 'isolation', 'cable', ['side delts']),
  x('Machine Lateral Raise', 'isolation', 'machine', ['side delts']),
  x('Reverse Pec Deck', 'isolation', 'machine', ['rear delts'], ['upper back']),
  x('Face Pull', 'isolation', 'cable', ['rear delts', 'upper back']),
  x('Pec Deck', 'isolation', 'machine', ['chest']),
  x('Cable Fly', 'isolation', 'cable', ['chest']),
  x('DB Fly', 'isolation', 'dumbbell', ['chest']),
  x('Pullover', 'isolation', 'dumbbell', ['lats'], ['chest']),
  x('Cable Pullover', 'isolation', 'cable', ['lats']),
  x('DB Shrug', 'isolation', 'dumbbell', ['upper back']),
  // Isolation — legs
  x('Ham Curl', 'isolation', 'machine', ['hamstrings']),
  x('Seated Ham Curl', 'isolation', 'machine', ['hamstrings']),
  x('Quad Extension', 'isolation', 'machine', ['quads']),
  x('Adductor', 'isolation', 'machine', ['adductors']),
  x('Abductor', 'isolation', 'machine', ['glutes']),
  x('Standing Calf Raise', 'isolation', 'machine', ['calves']),
  x('Seated Calf Raise', 'isolation', 'machine', ['calves']),
  // Core / carry
  x('Cable Crunch', 'isolation', 'cable', ['core']),
  x('Hanging Leg Raise', 'isolation', 'bodyweight', ['core']),
  x('Plank', 'isolation', 'bodyweight', ['core']),
  x('Farmer Carry', 'carry', 'dumbbell', ['core', 'upper back'], ['glutes']),
  x('Suitcase Carry', 'carry', 'kettlebell', ['core'], ['upper back']),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export const exerciseName = (id: string) => EXERCISE_BY_ID[id]?.name ?? id;
