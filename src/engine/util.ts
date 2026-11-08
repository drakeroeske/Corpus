// Small pure helpers. Dates are 'YYYY-MM-DD' strings; no Date.now() here.

export const dayNum = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
};

export const daysBetween = (a: string, b: string) => Math.round(dayNum(b) - dayNum(a));

export function addDays(d: string, n: number): string {
  const t = new Date((dayNum(d) + n) * 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** Day of week, 0 = Sunday. */
export const weekday = (d: string) => new Date(dayNum(d) * 86_400_000).getUTCDay();

/** Round to the nearest step (e.g. 2.5 lb). Step 0 falls back to 2.5. */
export const roundTo = (x: number, step: number) => {
  const s = step > 0 ? step : 2.5;
  return Math.round(Math.round(x / s) * s * 100) / 100;
};

export const round1 = (x: number) => Math.round(x * 10) / 10;

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function linreg(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

export const LB_PER_KG = 2.20462;
export const toKg = (w: number, units: 'lb' | 'kg') => (units === 'kg' ? w : w / LB_PER_KG);
