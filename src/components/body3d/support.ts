// Decide whether the 3D body can run: WebGL present and not a low-power device.
export function canUse3D(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if ((nav.hardwareConcurrency ?? 4) <= 2) return false;
    if (nav.deviceMemory !== undefined && nav.deviceMemory < 2) return false;
    if (nav.connection?.saveData) return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
