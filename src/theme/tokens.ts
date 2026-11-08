// Riso Lab design tokens for JS (charts, canvas, SVG). CSS uses the same values in index.css.
export const color = {
  paper: '#F2F1EC',
  bone: '#ECE8DF',
  ink: '#111111', // lab ink
  black: '#111111',
  cobalt: '#2B3FD6', // riso ink
  cobaltDeep: '#1A2A9E',
  signal: '#E9A6D8', // pink: PRs and social moments only; never text
};

export type SurfaceStyle = 'lab' | 'riso';

export const surface = {
  lab: { ink: color.black, page: color.paper, display: "'Anton', Impact, sans-serif" },
  riso: { ink: color.cobalt, page: color.bone, display: "'Archivo Black', 'Arial Black', sans-serif" },
} as const;

export const font = {
  mono: "'Space Mono', ui-monospace, monospace",
  anton: "'Anton', Impact, sans-serif",
  archivo: "'Archivo Black', 'Arial Black', sans-serif",
};

/** Chart styling shared by all Recharts figures (lab ink). */
export const chart = {
  tick: { fill: color.black, fontSize: 10, fontFamily: font.mono },
  grid: { stroke: 'rgba(17,17,17,0.2)', strokeDasharray: '3 3' }, // the only allowed tint
  tooltip: { background: color.paper, border: `2px solid ${color.black}`, borderRadius: 0, fontFamily: font.mono, fontSize: 12 },
};
