// BodyModel: mesh names → muscle IDs. The procedural mannequin below can be swapped for a licensed GLB
// anatomy model by providing another BodyModel whose mesh names map to the same muscles.
import type { Muscle } from '../../engine/types';

export type Shape = 'ellipsoid' | 'capsule';

export interface MeshSpec {
  name: string;
  muscle: Muscle | null; // null = neutral body part (head, hands…)
  shape: Shape;
  position: [number, number, number];
  scale: [number, number, number]; // ellipsoid radii, or capsule [radius, length, depth factor]
  rotation?: [number, number, number];
}

export interface BodyModel {
  meshes: MeshSpec[];
  muscleOf(meshName: string): Muscle | null;
}

type Half = Omit<MeshSpec, 'name'> & { name: string };

/** Mirror a left-side spec (x > 0) to the right. */
const pair = (s: Half): MeshSpec[] => [
  { ...s, name: `${s.name}_L` },
  {
    ...s,
    name: `${s.name}_R`,
    position: [-s.position[0], s.position[1], s.position[2]],
    rotation: s.rotation ? [s.rotation[0], -s.rotation[1], -s.rotation[2]] : undefined,
  },
];

const e = (name: string, muscle: Muscle | null, position: MeshSpec['position'], scale: MeshSpec['scale'], rotation?: MeshSpec['rotation']): Half => ({
  name, muscle, shape: 'ellipsoid', position, scale, rotation,
});
const c = (name: string, position: MeshSpec['position'], radius: number, length: number, rotation?: MeshSpec['rotation'], depth = 1): Half => ({
  name, muscle: null, shape: 'capsule', position, scale: [radius, length, depth], rotation,
});

/** Athletic stylized mannequin, ~1.8 units tall, facing +z. */
export const MANNEQUIN: MeshSpec[] = [
  // neutral base
  e('head', null, [0, 1.69, 0.005], [0.095, 0.115, 0.105]),
  c('neck', [0, 1.56, -0.005], 0.052, 0.07),
  c('torso', [0, 1.26, -0.005], 0.15, 0.3, undefined, 0.72),
  e('pelvis', null, [0, 0.96, -0.005], [0.155, 0.1, 0.105]),
  ...pair(c('upperArm', [0.262, 1.27, -0.003], 0.042, 0.18, [0, 0, 0.06])),
  ...pair(c('forearm', [0.282, 0.99, 0.01], 0.036, 0.2, [0, 0, 0.04])),
  ...pair(e('hand', null, [0.29, 0.8, 0.012], [0.032, 0.058, 0.022])),
  ...pair(e('knee', null, [0.095, 0.445, 0.012], [0.048, 0.05, 0.05])),
  ...pair(c('shin', [0.095, 0.25, 0.012], 0.038, 0.28)),
  ...pair(e('foot', null, [0.097, 0.03, 0.04], [0.042, 0.03, 0.105])),

  // muscles — torso front/back
  ...pair(e('chest', 'chest', [0.082, 1.375, 0.082], [0.112, 0.085, 0.055], [0, 0.18, -0.1])),
  e('upperBack', 'upper back', [0, 1.43, -0.075], [0.16, 0.1, 0.058]),
  ...pair(e('lats', 'lats', [0.118, 1.24, -0.06], [0.072, 0.155, 0.058], [0, -0.2, 0.18])),
  e('lowerBack', 'back', [0, 1.08, -0.082], [0.1, 0.11, 0.048]),
  e('abs', 'core', [0, 1.13, 0.065], [0.105, 0.17, 0.05]),
  ...pair(e('glute', 'glutes', [0.074, 0.9, -0.072], [0.083, 0.088, 0.068])),

  // shoulders
  ...pair(e('frontDelt', 'front delts', [0.203, 1.452, 0.038], [0.052, 0.066, 0.045])),
  ...pair(e('sideDelt', 'side delts', [0.236, 1.44, 0], [0.046, 0.072, 0.052])),
  ...pair(e('rearDelt', 'rear delts', [0.203, 1.452, -0.04], [0.052, 0.066, 0.045])),

  // arms
  ...pair(e('biceps', 'biceps', [0.264, 1.27, 0.03], [0.042, 0.1, 0.04], [0, 0, 0.06])),
  ...pair(e('triceps', 'triceps', [0.262, 1.285, -0.03], [0.045, 0.11, 0.042], [0, 0, 0.06])),

  // legs
  ...pair(e('quad', 'quads', [0.097, 0.665, 0.028], [0.072, 0.2, 0.07])),
  ...pair(e('hamstring', 'hamstrings', [0.097, 0.665, -0.035], [0.066, 0.19, 0.062])),
  ...pair(e('adductor', 'adductors', [0.045, 0.71, 0.002], [0.038, 0.14, 0.048])),
  ...pair(e('calf', 'calves', [0.095, 0.275, -0.028], [0.048, 0.125, 0.052])),
];

export function createBodyModel(meshes: MeshSpec[]): BodyModel {
  const by = new Map(meshes.map((m) => [m.name, m.muscle]));
  return { meshes, muscleOf: (n) => by.get(n) ?? null };
}

export const proceduralBody = createBodyModel(MANNEQUIN);
