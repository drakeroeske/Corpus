import type { Client } from './types';

export const adherencePct = (c: Pick<Client, 'planned' | 'done'>) => (c.planned ? Math.round((c.done / c.planned) * 100) : 0);

/** Auto-flags for the coach dashboard. */
export function clientFlags(c: Client): string[] {
  const flags: string[] = [];
  const last3 = c.readiness.slice(-3);
  if (last3.length === 3 && last3.every((r) => r < 50)) flags.push('readiness < 50 for 3 days');
  if (c.missedInARow >= 2) flags.push(`missed ${c.missedInARow} sessions`);
  if (c.planned >= 4 && adherencePct(c) < 70) flags.push(`adherence ${adherencePct(c)}%`);
  return flags;
}
