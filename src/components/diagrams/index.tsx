// Diagram imagery as inline SVG: rings, crosshair bars, orbit ellipses, silhouette figure, connected-C logo.
// All draw in currentColor (the surface ink). Decorative unless a label is given.
import type { ReactNode } from 'react';
import { Grain } from '../riso';

const a11y = (label?: string) => (label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const });

/** Concentric rings that fill by value (0–100): one solid ring per 20 points, the rest dashed. */
export function Rings({ value, size = 180, label, children }: { value: number; size?: number; label?: string; children?: ReactNode }) {
  const n = 5;
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * n);
  const c = 50;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} {...a11y(label)}>
        <line x1="0" y1={c} x2="100" y2={c} stroke="currentColor" strokeWidth="0.4" />
        <line x1={c} y1="0" x2={c} y2="100" stroke="currentColor" strokeWidth="0.4" />
        {Array.from({ length: n }, (_, i) => {
          const r = 14 + i * 8.5;
          const on = i < filled;
          return <circle key={i} cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={on ? 3 : 0.6} strokeDasharray={on ? undefined : '1.5 2'} />;
        })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}

/** Crosshair bars with corner brackets (scanner overlay, PR cards). */
export function Crosshair({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 75" preserveAspectRatio="none" className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke">
        <path d="M6 18V6h12M82 6h12v12M94 57v12H82M18 69H6V57" strokeWidth="3" />
        <line x1="50" y1="26" x2="50" y2="49" />
        <line x1="34" y1="37.5" x2="66" y2="37.5" />
        <line x1="12" y1="37.5" x2="28" y2="37.5" strokeDasharray="2 2" />
        <line x1="72" y1="37.5" x2="88" y2="37.5" strokeDasharray="2 2" />
      </g>
    </svg>
  );
}

/** Orbit ellipses around a hub (loading/empty states). */
export function Orbit({ size = 120, spin, label }: { size?: number; spin?: boolean; label?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} {...a11y(label)} className={spin ? 'animate-spin [animation-duration:6s]' : ''}>
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <ellipse cx="50" cy="50" rx="44" ry="16" />
        <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(60 50 50)" />
        <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(120 50 50)" strokeDasharray="2 2" />
      </g>
      <rect x="45" y="45" width="10" height="10" fill="currentColor" />
      <rect x="90" y="47" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

/** Simple standing silhouette in line art, with an optional crosshair on the chest. */
export function Silhouette({ height = 200, label, marks }: { height?: number; label?: string; marks?: boolean }) {
  return (
    <svg viewBox="0 0 100 200" height={height} width={height / 2} {...a11y(label)}>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter">
        <circle cx="50" cy="20" r="12" />
        <path d="M50 32v8M30 44h40l6 52-8 2-4-40M30 44l-6 52 8 2 4-40M36 58v40l-4 90h12l6-70 6 70h12l-4-90V58" />
      </g>
      {marks && (
        <g stroke="currentColor" strokeWidth="1">
          <line x1="8" y1="70" x2="92" y2="70" strokeDasharray="2 2" />
          <line x1="8" y1="120" x2="92" y2="120" strokeDasharray="2 2" />
          <circle cx="50" cy="70" r="6" fill="none" />
        </g>
      )}
    </svg>
  );
}

/** Geometry of the connected-C mark in a 100×100 box: nodes on an open arc, a hub, and links. */
export function logoGeometry() {
  const nodes = Array.from({ length: 7 }, (_, i) => {
    const a = ((50 + (i * 260) / 6) * Math.PI) / 180; // arc from 50° to 310°, gap on the right
    return [50 + 36 * Math.cos(a), 50 - 36 * Math.sin(a)] as [number, number];
  });
  const hub: [number, number] = [50, 50];
  const links: [[number, number], [number, number]][] = [];
  for (let i = 0; i < nodes.length - 1; i++) links.push([nodes[i], nodes[i + 1]]);
  for (const i of [0, 2, 4, 6]) links.push([hub, nodes[i]]);
  return { nodes, hub, links };
}

/** Connected-C logo mark. Ink follows the surface (cobalt in riso, black in lab). */
export function Logo({ size = 40, label = 'Corpus' }: { size?: number; label?: string }) {
  const g = logoGeometry();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} {...a11y(label)}>
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="square">
        {g.links.map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        ))}
      </g>
      <g fill="currentColor">
        {g.nodes.map(([x, y], i) => (
          <rect key={i} x={x - 6} y={y - 6} width="12" height="12" />
        ))}
        <rect x={g.hub[0] - 9} y={g.hub[1] - 9} width="18" height="18" />
      </g>
    </svg>
  );
}

/** Empty state: orbit diagram + message. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center gap-2 border-2 border-dashed border-ink py-6 text-center font-mono text-xs uppercase">
      <Grain />
      <Orbit size={72} />
      <div className="relative px-3">{children}</div>
    </div>
  );
}
