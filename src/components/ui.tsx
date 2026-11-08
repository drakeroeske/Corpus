// Shared UI kit, Riso Lab style: square corners, 2px ink borders, mono labels, display titles.
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerLabels, Grain, useHeaderMeta, useSurface } from './riso';

export function Card({ children, className = '', onClick, grain }: { children: ReactNode; className?: string; onClick?: () => void; grain?: boolean }) {
  return (
    <div onClick={onClick} className={`relative border-2 border-ink bg-page p-4 ${onClick ? 'cursor-pointer active:bg-ink active:text-page' : ''} ${className}`}>
      {grain && <Grain />}
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'social';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const style =
    variant === 'primary'
      ? 'bg-ink text-page border-ink active:bg-ink-deep'
      : variant === 'social'
        ? 'bg-signal text-ink border-ink'
        : variant === 'danger'
          ? 'border-ink border-dashed text-ink'
          : 'border-ink text-ink active:bg-ink active:text-page';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 border-2 px-4 font-mono text-sm font-bold uppercase tracking-wide disabled:bg-transparent disabled:text-ink ${style} ${className}`}
    >
      {children}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wide">{children}</div>;
}

export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  label?: string;
  suffix?: string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100));
  const [text, setText] = useState(fmt(value));
  useEffect(() => setText(fmt(value)), [value]);
  return (
    <div className="min-w-0 flex-1">
      {label && <Label>{label}</Label>}
      <div className="flex items-center border-2 border-ink">
        <button aria-label={`Decrease ${label ?? ''}`} className="h-14 w-14 shrink-0 border-r-2 border-ink text-3xl active:bg-ink active:text-page" onClick={() => set(value - step)}>
          −
        </button>
        <label className="flex min-w-0 flex-1 items-baseline justify-center">
          <input
            inputMode="decimal"
            aria-label={label}
            value={text}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              setText(e.target.value);
              const v = parseFloat(e.target.value.replace(',', '.'));
              if (Number.isFinite(v)) onChange(Math.max(min, v));
            }}
            onBlur={() => setText(fmt(value))}
            className="w-full min-w-0 bg-transparent text-center font-mono text-[32px] leading-none font-bold outline-none"
          />
          {suffix && <span className="font-mono text-sm">{suffix}</span>}
        </label>
        <button aria-label={`Increase ${label ?? ''}`} className="h-14 w-14 shrink-0 border-l-2 border-ink text-3xl active:bg-ink active:text-page" onClick={() => set(value + step)}>
          +
        </button>
      </div>
    </div>
  );
}

/** Row of choice buttons. Tapping the selected one clears it if `allowClear`. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  allowClear,
  labels,
}: {
  options: T[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  allowClear?: boolean;
  labels?: string[];
}) {
  return (
    <div className="flex border-2 border-ink">
      {options.map((o, i) => {
        const on = o === value;
        return (
          <button
            key={String(o)}
            aria-pressed={on}
            onClick={() => onChange(on && allowClear ? undefined : o)}
            className={`min-h-11 flex-1 px-1 font-mono text-xs font-bold uppercase ${i ? 'border-l-2 border-ink' : ''} ${on ? 'bg-ink text-page' : 'text-ink'}`}
          >
            {labels?.[i] ?? String(o)}
          </button>
        );
      })}
    </div>
  );
}

/** Circular meter, square caps, ink only. */
export function Ring({
  value,
  max,
  size = 96,
  stroke = 8,
  label,
  center,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  label?: string;
  center?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="2 3" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeDasharray={`${c * frac} ${c}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono font-bold">{center ?? Math.round(value)}</div>
      </div>
      {label && <div className="mt-1 font-mono text-[10px] uppercase">{label}</div>}
    </div>
  );
}

/** Full-screen sheet: page colour, 3px top rule, display title. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-page">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col overflow-hidden border-t-[3px] border-ink bg-page">
        <div className="flex items-end justify-between gap-2 border-b-2 border-ink px-4 py-3">
          <h2 className="display text-4xl">{title}.</h2>
          <button className="min-h-11 min-w-11 border-2 border-ink px-3 font-mono text-xs font-bold uppercase" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10">{children}</div>
      </div>
    </div>
  );
}

/** Screen header: corner metadata labels, huge display title with a full stop, optional sub line. */
export function PageHeader({
  title,
  sub,
  back,
  right,
  status,
  section,
  grain = true,
}: {
  title: string;
  sub?: ReactNode;
  back?: boolean;
  right?: ReactNode;
  status?: string;
  section?: string;
  grain?: boolean;
}) {
  const nav = useNavigate();
  const style = useSurface();
  const meta = useHeaderMeta();
  const t = title.toUpperCase().replace(/[.!?]$/, '');
  return (
    <div className="relative -mx-4 mb-4 border-b-[3px] border-ink px-4 pt-1 pb-3">
      {grain && <Grain />}
      <CornerLabels left={`${style === 'riso' ? 'SPOTTER' : 'CORPUS'} // ${section ?? (style === 'riso' ? 'FEED' : 'ENGINE')}`} center={meta.center} right={status ?? meta.status} />
      {back && (
        <button className="relative mt-2 min-h-11 border-2 border-ink px-3 font-mono text-xs font-bold uppercase" onClick={() => nav(-1)}>
          ← Back
        </button>
      )}
      <div className="relative mt-3 flex items-end justify-between gap-2">
        <h1 className="display min-w-0 text-[clamp(44px,17vw,72px)] break-words">{t}.</h1>
        {right && <div className="shrink-0 pb-1">{right}</div>}
      </div>
      {sub && <div className="relative mt-2 font-mono text-xs uppercase">{sub}</div>}
    </div>
  );
}

/** Square tab switcher inside a screen. */
export function SubTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          aria-pressed={t.id === value}
          onClick={() => onChange(t.id)}
          className={`min-h-11 shrink-0 border-2 border-ink px-3 font-mono text-xs font-bold uppercase ${t.id === value ? 'bg-ink text-page' : 'text-ink'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      inputMode="decimal"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : undefined);
      }}
      className={`min-h-11 w-full border-2 border-ink px-3 font-mono ${className}`}
    />
  );
}

export const TextInput = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`min-h-11 w-full border-2 border-ink px-3 font-mono ${p.className ?? ''}`} />
);

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

export const fmtDuration = (sec: number) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

export const prettyDate = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, opts);
};
