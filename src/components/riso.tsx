// Riso Lab building blocks: Surface, Grain, Tag, CornerLabels, FigCaption, LabTable, NoteLine, Meter.
import { createContext, useContext, useId, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayKey } from '../data/db';
import type { SurfaceStyle } from '../theme/tokens';
import { surface } from '../theme/tokens';

// ---------- Surface ----------

const SurfaceCtx = createContext<SurfaceStyle>('lab');
export const useSurface = () => useContext(SurfaceCtx);
export const useInk = () => surface[useSurface()].ink;

/** Switches ink/page/display font for everything inside: lab = black on paper, riso = cobalt on bone. */
export function Surface({ style, children, className = '' }: { style: SurfaceStyle; children: ReactNode; className?: string }) {
  return (
    <SurfaceCtx.Provider value={style}>
      <div className={`surface-${style} ${className}`}>{children}</div>
    </SurfaceCtx.Provider>
  );
}

// ---------- Grain ----------

export type GrainSetting = 'off' | 'subtle' | 'full';

const mq = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;

/** Effective grain setting: the profile choice, else Off for high-contrast / reduced-transparency users, else Subtle. */
export function useGrainSetting(): GrainSetting {
  const p = useLiveQuery(() => db.profile.get('me'));
  if (p?.grain) return p.grain;
  return mq('(prefers-contrast: more)') || mq('(prefers-reduced-transparency: reduce)') ? 'off' : 'subtle';
}

/** Photocopy grain overlay. Parent must be `relative`. Never use on surfaces read mid-set. */
export function Grain({ amount = 0.25 }: { amount?: number }) {
  const id = useId().replace(/:/g, '');
  const setting = useGrainSetting();
  const a = setting === 'off' ? 0 : setting === 'full' ? Math.min(1, amount * 1.8) : amount;
  if (a <= 0) return null;
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" style={{ mixBlendMode: 'multiply', opacity: a }}>
      <filter id={`g${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.88" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#g${id})`} />
    </svg>
  );
}

// ---------- Tags & labels ----------

/** Bracket tag: [PR], [DELOAD], [HOLD]… `signal` puts it on pink (PRs/social only). */
export function Tag({ children, signal, className = '' }: { children: ReactNode; signal?: boolean; className?: string }) {
  return <span className={`inline-block whitespace-nowrap font-mono font-bold text-ink ${signal ? 'bg-signal px-1 text-sm' : 'text-xs'} ${className}`}>[{children}]</span>;
}

export const pad3 = (n: number) => String(Math.max(0, n)).padStart(3, '0');
export const shortDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}`;

export function CornerLabels({ left, center, right }: { left: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 font-mono text-[10px] font-bold uppercase tracking-wide">
      <span className="min-w-0 truncate">{left}</span>
      {center !== undefined && <span className="shrink-0 text-center">{center}</span>}
      <span className="min-w-0 truncate text-right">{right}</span>
    </div>
  );
}

/** Real header metadata: session count + date, and today's program day. */
export function useHeaderMeta() {
  const count = useLiveQuery(() => db.sessions.count()) ?? 0;
  const days = useLiveQuery(() => db.programDays.toArray()) ?? [];
  const today = todayKey();
  const [y, m, d] = today.split('-').map(Number);
  const day = days.find((x) => x.weekdays.includes(new Date(y, m - 1, d).getDay()));
  return { center: `SESSION ${pad3(count)} · ${shortDate(today)}`, status: day ? `${day.name.toUpperCase()} [TODAY]` : 'REST DAY' };
}

export function FigCaption({ n, title, stat }: { n: number; title: string; stat?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2 font-mono text-[10px] font-bold uppercase tracking-wide">
      <span>
        FIG. {String(n).padStart(2, '0')} — {title}
      </span>
      {stat !== undefined && <span className="text-right">{stat}</span>}
    </div>
  );
}

/** [NOTE] line: engine reasoning in one mono line. */
export function NoteLine({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase leading-snug">
      <span className="font-bold">[NOTE]</span> {children}
    </p>
  );
}

// ---------- Lab table ----------

export interface LabRow {
  key: string;
  cells: ReactNode[];
  onClick?: () => void;
}

/** 3px top rule, mono column headers, dashed row dividers. `bold` = column indexes set in bold. */
export function LabTable({ head, rows, align = [], bold = [], className = '' }: { head: string[]; rows: LabRow[]; align?: ('l' | 'r' | 'c')[]; bold?: number[]; className?: string }) {
  const cls = (i: number) => `${align[i] === 'r' ? 'text-right' : align[i] === 'c' ? 'text-center' : 'text-left'} ${bold.includes(i) ? 'font-bold' : ''}`;
  return (
    <table className={`w-full border-t-[3px] border-ink font-mono text-sm ${className}`}>
      <thead>
        <tr className="border-b border-ink">
          {head.map((h, i) => (
            <th key={i} className={`py-1 text-[10px] font-bold uppercase tracking-wide ${cls(i)}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={r.key} onClick={r.onClick} className={`${ri ? 'border-t border-dashed border-ink' : ''} ${r.onClick ? 'cursor-pointer active:bg-ink active:text-page' : ''}`}>
            {r.cells.map((c, i) => (
              <td key={i} className={`py-2 align-top ${cls(i)}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Bar meter ----------

/** Thin bar meter with mono numbers (replaces rings). */
export function Meter({ label, value, max, unit = '' }: { label: string; value: number; max: number; unit?: string }) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const over = value > max * 1.1;
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-xs uppercase">
        <span className="font-bold">{label}</span>
        <span>
          {Math.round(value)} / {max}
          {unit} {over && <span className="font-bold">[OVER]</span>}
        </span>
      </div>
      <div className="track mt-1 h-2.5">
        <div className={`h-full ${over ? 'hatch' : 'bg-ink'}`} style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}

/** Square chart marker for Recharts lines (lab ink). */
export function SquareDot(p: { cx?: number; cy?: number; index?: number }) {
  if (p.cx === undefined || p.cy === undefined) return <g key={p.index} />;
  return <rect key={p.index} x={p.cx - 3} y={p.cy - 3} width={6} height={6} fill="#F2F1EC" stroke="#111111" strokeWidth={2} />;
}
