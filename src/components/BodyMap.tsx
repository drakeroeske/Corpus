import { useId, type ReactElement } from 'react';
import type { Muscle } from '../engine/types';

type Shape = ['e', number, number, number, number] | ['r', number, number, number, number];

/** Simple front/back figure. Each muscle maps to mirrored shapes. */
const FRONT: [Muscle, Shape[]][] = [
  ['front delts', [['e', 70, 72, 11, 9], ['e', 130, 72, 11, 9]]],
  ['side delts', [['e', 54, 80, 7, 11], ['e', 146, 80, 7, 11]]],
  ['chest', [['r', 74, 78, 25, 26], ['r', 101, 78, 25, 26]]],
  ['biceps', [['e', 54, 114, 8, 16], ['e', 146, 114, 8, 16]]],
  ['core', [['r', 80, 108, 40, 50]]],
  ['quads', [['r', 74, 168, 17, 68], ['r', 109, 168, 17, 68]]],
  ['adductors', [['r', 92, 168, 7, 42], ['r', 101, 168, 7, 42]]],
  ['calves', [['e', 82, 280, 8, 22], ['e', 118, 280, 8, 22]]],
];

const BACK: [Muscle, Shape[]][] = [
  ['upper back', [['r', 80, 62, 40, 26]]],
  ['rear delts', [['e', 68, 74, 10, 9], ['e', 132, 74, 10, 9]]],
  ['side delts', [['e', 54, 80, 7, 11], ['e', 146, 80, 7, 11]]],
  ['lats', [['r', 72, 90, 20, 42], ['r', 108, 90, 20, 42]]],
  ['triceps', [['e', 54, 114, 8, 16], ['e', 146, 114, 8, 16]]],
  ['back', [['r', 88, 116, 24, 34]]],
  ['glutes', [['e', 88, 166, 13, 14], ['e', 112, 166, 13, 14]]],
  ['hamstrings', [['r', 74, 184, 17, 54], ['r', 109, 184, 17, 54]]],
  ['calves', [['e', 82, 276, 9, 22], ['e', 118, 276, 9, 22]]],
];

const LEVELS = [0, 8, 6, 4.5, 3.2, 2.2]; // hatch spacing per level (0 = no hatch)
const level = (t: number) => (t <= 0.04 ? 0 : Math.min(5, 1 + Math.floor(Math.min(0.999, t) * 5)));

/** Wireframe diagram figure: hatching density = value (0–1). */
function Figure({
  regions,
  label,
  heat,
  onTap,
}: {
  regions: [Muscle, Shape[]][];
  label: string;
  heat: (m: Muscle) => number;
  onTap?: (m: Muscle) => void;
}) {
  const id = useId().replace(/:/g, '');
  const draw = (s: Shape, i: number, f: string): ReactElement =>
    s[0] === 'e' ? (
      <ellipse key={i} cx={s[1]} cy={s[2]} rx={s[3]} ry={s[4]} fill={f} />
    ) : (
      <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} fill={f} />
    );
  return (
    <div className="flex-1">
      <svg viewBox="30 0 140 320" className="w-full text-ink">
        <defs>
          {LEVELS.map((sp, i) =>
            sp ? (
              <pattern key={i} id={`${id}h${i}`} width={sp} height={sp} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2={sp} stroke="currentColor" strokeWidth={i === 5 ? 1.6 : 1} />
              </pattern>
            ) : null,
          )}
        </defs>
        {/* wireframe silhouette */}
        <g fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx={100} cy={30} r={17} />
          <rect x={64} y={58} width={72} height={104} />
          <rect x={44} y={66} width={20} height={110} />
          <rect x={136} y={66} width={20} height={110} />
          <rect x={72} y={155} width={27} height={150} />
          <rect x={101} y={155} width={27} height={150} />
          <line x1={100} y1={0} x2={100} y2={320} strokeWidth={0.5} strokeDasharray="2 3" />
        </g>
        {regions.map(([m, shapes]) => {
          const lv = level(heat(m));
          return (
            <g
              key={m}
              role={onTap ? 'button' : undefined}
              aria-label={`${m} ${Math.round(heat(m) * 100)}%`}
              onClick={onTap ? () => onTap(m) : undefined}
              style={{ cursor: onTap ? 'pointer' : undefined }}
              stroke="currentColor"
              strokeWidth={1}
            >
              {shapes.map((sh, i) => draw(sh, i, lv ? `url(#${id}h${lv})` : 'transparent'))}
            </g>
          );
        })}
      </svg>
      <div className="text-center font-mono text-[10px] font-bold uppercase">{label}</div>
    </div>
  );
}

export default function BodyMap({ heat, onTap }: { heat: (m: Muscle) => number; onTap?: (m: Muscle) => void }) {
  return (
    <div className="flex gap-2">
      <Figure regions={FRONT} label="Front" heat={heat} onTap={onTap} />
      <Figure regions={BACK} label="Back" heat={heat} onTap={onTap} />
    </div>
  );
}
