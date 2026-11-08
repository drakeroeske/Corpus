// Design tokens for use in JS (charts, canvas). CSS uses the same values in index.css.
export const color = {
  bg: '#0E0F0C',
  surface: '#1A1B18',
  border: '#2A2C27',
  text: '#F2F2EE',
  muted: '#A3A69D',
  lime: '#C6F432',
  warn: '#FF6A2B',
  info: '#4DA3FF',
};

export const font = {
  head: "'Space Grotesk', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

/** Lime (0) → orange (1) for fatigue colouring. */
export function fatigueColor(t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const a = [0xc6, 0xf4, 0x32];
  const b = [0xff, 0x6a, 0x2b];
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${mix.join(',')})`;
}
