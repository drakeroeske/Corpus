import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { color } from '../theme/tokens';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl border border-line bg-surface p-4 ${onClick ? 'cursor-pointer active:opacity-80' : ''} ${className}`}>
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
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const style =
    variant === 'primary'
      ? 'bg-lime text-bg font-bold'
      : variant === 'danger'
        ? 'border border-warn text-warn'
        : 'border border-line text-ink';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-xl px-4 text-base active:opacity-70 disabled:opacity-40 ${style} ${className}`}
    >
      {children}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-xs uppercase tracking-wide text-mute">{children}</div>;
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
  return (
    <div className="min-w-0 flex-1">
      {label && <Label>{label}</Label>}
      <div className="flex items-center rounded-xl border border-line">
        <button aria-label={`Decrease ${label ?? ''}`} className="h-12 w-12 shrink-0 text-2xl active:bg-line" onClick={() => set(value - step)}>
          −
        </button>
        <div className="flex-1 truncate text-center font-mono text-xl">
          {fmt(value)}
          {suffix && <span className="ml-1 text-sm text-mute">{suffix}</span>}
        </div>
        <button aria-label={`Increase ${label ?? ''}`} className="h-12 w-12 shrink-0 text-2xl active:bg-line" onClick={() => set(value + step)}>
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
    <div className="flex gap-1.5">
      {options.map((o, i) => {
        const on = o === value;
        return (
          <button
            key={String(o)}
            onClick={() => onChange(on && allowClear ? undefined : o)}
            className={`min-h-11 flex-1 rounded-lg border px-1 text-sm ${
              on ? 'border-lime bg-lime font-bold text-bg' : 'border-line text-ink'
            } ${typeof o === 'number' ? 'font-mono' : ''}`}
          >
            {labels?.[i] ?? String(o)}
          </button>
        );
      })}
    </div>
  );
}

/** Circular progress ring with a number in the middle. */
export function Ring({
  value,
  max,
  size = 96,
  stroke = 8,
  label,
  center,
  ringColor = color.lime,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  label?: string;
  center?: ReactNode;
  ringColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color.border} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={`${c * frac} ${c}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono">{center ?? Math.round(value)}</div>
      </div>
      {label && <div className="mt-1 text-xs text-mute">{label}</div>}
    </div>
  );
}

/** Full-screen bottom sheet with a title and close button. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black/70">
      <div className="mx-auto mt-8 flex w-full max-w-[480px] flex-1 flex-col overflow-hidden rounded-t-3xl border border-line bg-bg">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="min-h-11 min-w-11 text-mute" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, back, right }: { title: string; sub?: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="mb-4">
      {back && (
        <button className="-ml-1 mb-1 min-h-11 text-sm text-mute" onClick={() => nav(-1)}>
          ‹ Back
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        {right}
      </div>
      {sub && <div className="mt-1 text-sm text-mute">{sub}</div>}
    </div>
  );
}

/** Horizontal tab switcher inside a screen. */
export function SubTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${t.id === value ? 'border-lime text-lime' : 'border-line text-mute'}`}
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
      className={`min-h-11 w-full rounded-xl border border-line px-3 font-mono ${className}`}
    />
  );
}

export const TextInput = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`min-h-11 w-full rounded-xl border border-line px-3 ${p.className ?? ''}`} />
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
