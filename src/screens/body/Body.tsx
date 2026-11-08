import { lazy, Suspense, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, todayKey, uid } from '../../data/db';
import { useData } from '../../data/repo';
import { bodyComp, bodyWeightSeries, currentFatigue, exById, readinessOn, weeklySetsFor } from '../../data/plan';
import {
  MUSCLES, THERMAL_STOPS, VOLUME_RANGE, fatiguePercent, hoursToRecovered, readinessAdjusted, recommendation, volumeHeat, volumeStatus,
  type HeatMode, type Measurement, type Muscle, type WorkoutSession,
} from '../../engine';
import { canUse3D, prefersReducedMotion } from '../../components/body3d/support';

const ThermalBody = lazy(() => import('../../components/body3d/ThermalBody'));
import BodyMap from '../../components/BodyMap';
import { Button, Card, Label, NumberInput, PageHeader, Segmented, SubTabs, TextInput, fmt, prettyDate } from '../../components/ui';
import { chart as cs, color } from '../../theme/tokens';
import { FigCaption, SquareDot, Tag } from '../../components/riso';
import DitherImg from '../../components/DitherImg';
import Strength from './Strength';
import Report from './Report';
import Experiments from './Experiments';
import Nutrition from './Nutrition';

type Tab = 'recovery' | 'strength' | 'weight' | 'nutrition' | 'vault' | 'experiments' | 'report';

export default function Body() {
  const [tab, setTab] = useState<Tab>('recovery');
  return (
    <div>
      <PageHeader title="Body" />
      <SubTabs
        tabs={[
          { id: 'recovery', label: 'Recovery' },
          { id: 'strength', label: 'Strength' },
          { id: 'weight', label: 'Weight' },
          { id: 'nutrition', label: 'Nutrition' },
          { id: 'report', label: 'Lab Report' },
          { id: 'experiments', label: 'Experiments' },
          { id: 'vault', label: 'Vault' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'recovery' && <Recovery />}
      {tab === 'strength' && <Strength />}
      {tab === 'weight' && <Weight />}
      {tab === 'nutrition' && <Nutrition />}
      {tab === 'report' && <Report />}
      {tab === 'experiments' && <Experiments />}
      {tab === 'vault' && <Vault />}
    </div>
  );
}

function Recovery() {
  const data = useData();
  const [mode, setMode] = useState<HeatMode>('fatigue');
  const [selected, setSelected] = useState<Muscle | null>(null);
  const [list, setList] = useState(false);
  const [use3d] = useState(canUse3D);
  if (!data) return null;
  const today = todayKey();
  const now = Date.now();
  const { sessions, checkins, meals, profile, days } = data;
  const { units, halfLife } = currentFatigue(sessions, checkins.find((c) => c.date === today), meals, profile, today, now);
  const pct = Object.fromEntries(MUSCLES.map((m) => [m, fatiguePercent(units[m])])) as Record<Muscle, number>;
  const weekly = weeklySetsFor(sessions, today);
  const ready = readinessOn(today, checkins, days).score;
  const value = (m: Muscle) => (mode === 'fatigue' ? pct[m] : mode === 'volume' ? weekly[m] : readinessAdjusted(pct[m], ready));
  const heat = Object.fromEntries(MUSCLES.map((m) => [m, mode === 'volume' ? volumeHeat(weekly[m]) : value(m) / 100])) as Record<Muscle, number>;
  const show = (m: Muscle) => (mode === 'volume' ? `${fmt(weekly[m])} sets` : `${value(m)}%`);
  const map2d = <BodyMap heat={(m) => heat[m]} onTap={setSelected} />;
  const thermal = use3d && !list;
  const figTitle = mode === 'volume' ? 'WEEKLY VOLUME' : mode === 'readiness' ? 'FATIGUE / READINESS-ADJ.' : 'FATIGUE';

  return (
    <div className="space-y-4">
      <Segmented options={['fatigue', 'volume', 'readiness'] as HeatMode[]} labels={['Fatigue', 'Volume', 'Readiness-adj.']} value={mode} onChange={(v) => v && setMode(v)} />
      <div className="border-2 border-ink p-3">
        <FigCaption n={1} title={figTitle} stat={`T½ ${halfLife}H${mode === 'readiness' ? ` · READY ${ready}` : ''}`} />
        {list ? (
          <div className="rows">
            {[...MUSCLES]
              .sort((a, b) => heat[b] - heat[a])
              .map((m) => (
                <button key={m} className="flex min-h-11 w-full items-center gap-2 text-left font-mono text-xs uppercase" onClick={() => setSelected(m)}>
                  <span className="w-24 shrink-0">{m}</span>
                  <div className="track h-2.5 flex-1">
                    <div className="h-full bg-ink" style={{ width: `${heat[m] * 100}%` }} />
                  </div>
                  <span className="w-16 text-right font-bold">{show(m)}</span>
                  <span className="w-24 text-right">
                    <Tag>{(mode === 'volume' ? volumeStatus(weekly[m]) : recommendation(value(m))).toUpperCase()}</Tag>
                  </span>
                </button>
              ))}
          </div>
        ) : use3d ? (
          <Suspense fallback={map2d}>
            <ThermalBody heat={heat} selected={selected} onSelect={setSelected} reducedMotion={prefersReducedMotion()} />
          </Suspense>
        ) : (
          map2d
        )}
        <div className="mt-3">
          <div className="flex gap-1" aria-hidden>
            {THERMAL_STOPS.map(([t, c]) => (
              <div key={t} className={`h-3 flex-1 border border-ink ${thermal ? '' : t === 0 ? '' : t === 1 ? 'bg-ink' : 'hatch'}`} style={thermal ? { background: c } : undefined} />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] font-bold uppercase">
            <span>{mode === 'volume' ? '0 sets' : '0% Recovered'}</span>
            <span>{mode === 'volume' ? '10' : '50%'}</span>
            <span>{mode === 'volume' ? `${VOLUME_RANGE.max}+ sets` : '100% Fatigued'}</span>
          </div>
        </div>
        <div className="mt-1 flex justify-end">
          <button className="min-h-11 border-2 border-ink px-3 font-mono text-xs font-bold uppercase" onClick={() => setList(!list)}>
            {list ? 'Body view' : 'List view'}
          </button>
        </div>
      </div>

      {selected && <MuscleCard m={selected} pct={pct[selected]} units={units[selected]} halfLife={halfLife} weekly={weekly[selected]} sessions={sessions} now={now} onClose={() => setSelected(null)} />}

      <Card>
        <FigCaption n={2} title="Weekly hard sets" stat={`TARGET ${VOLUME_RANGE.min}–${VOLUME_RANGE.max}`} />
        {MUSCLES.map((m) => {
          const n = weekly[m];
          const st = volumeStatus(n);
          return (
            <div key={m} className="flex items-center gap-2 py-0.5 font-mono text-xs uppercase">
              <span className="w-24 shrink-0">{m}</span>
              <div className="track relative h-2.5 flex-1">
                <div className="absolute inset-y-0 border-x-2 border-ink" style={{ left: '40%', width: '40%' }} />
                <div className={`h-full ${st === 'over' ? 'hatch' : 'bg-ink'}`} style={{ width: `${Math.min(100, (n / 25) * 100)}%` }} />
              </div>
              <span className="w-16 text-right font-mono text-xs">
                {fmt(n)} {st !== 'ok' && <span className="font-bold">[{st.toUpperCase()}]</span>}
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function MuscleCard(p: { m: Muscle; pct: number; units: number; halfLife: number; weekly: number; sessions: WorkoutSession[]; now: number; onClose: () => void }) {
  const last = [...p.sessions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)
    .map((s) => ({ s, sets: s.sets.filter((x) => !x.isWarmup && exById(x.exerciseId).primaryMuscles.includes(p.m)).length }))
    .find((x) => x.sets > 0);
  const h = hoursToRecovered(p.units, p.halfLife);
  const rec = recommendation(p.pct);
  const when = new Date(p.now + h * 3_600_000).toLocaleString(undefined, { weekday: 'short', hour: 'numeric' });
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between">
        <div className="display text-4xl">{p.m}.</div>
        <button className="min-h-11 min-w-11 border-2 border-ink font-mono font-bold" aria-label="Close" onClick={p.onClose}>×</button>
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
        <div><Label>Fatigue</Label><span className="display text-3xl">{p.pct}%</span></div>
        <div><Label>Recommendation</Label><Tag>{rec.toUpperCase()}</Tag></div>
        <div><Label>Last trained</Label>{last ? <span className="font-mono">{prettyDate(last.s.date)} · {last.sets} sets</span> : <span className="text-ink">Not yet</span>}</div>
        <div><Label>Recovered</Label><span className="font-mono">{h === 0 ? 'Now' : `~${h} h (${when})`}</span></div>
      </div>
      <div className="font-mono text-xs text-ink">{fmt(p.weekly)} hard sets this week · target {VOLUME_RANGE.min}–{VOLUME_RANGE.max}</div>
    </Card>
  );
}

function Weight() {
  const data = useData();
  if (!data) return null;
  const { checkins, sessions, profile, meals, days } = data;
  const today = todayKey();
  const series = bodyWeightSeries(checkins);
  const chart = series.map((p, i) => {
    const win = series.slice(0, i + 1).filter((q) => q.date > addDaysLocal(p.date, -7));
    return { date: p.date, weight: p.value, avg: Math.round((win.reduce((a, q) => a + q.value, 0) / win.length) * 10) / 10 };
  });
  const signal = bodyComp(checkins, sessions, today, { meals, profile, days });

  return (
    <div className="space-y-4">
      <Card>
        <FigCaption n={3} title="Body weight" stat={chart.length ? `AVG7 ${chart[chart.length - 1].avg} ${profile.units.toUpperCase()}` : undefined} />
        {chart.length >= 2 ? (
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid {...cs.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke={color.ink} tick={cs.tick} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke={color.ink} tick={cs.tick} />
                <Tooltip contentStyle={cs.tooltip} />
                <Line dataKey="weight" stroke={color.ink} dot={<SquareDot />} strokeWidth={0} isAnimationActive={false} />
                <Line dataKey="avg" stroke={color.ink} dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-ink">Log body weight in your morning check-in to see a trend.</p>
        )}
      </Card>
      <Card>
        <div className="font-mono text-[10px] font-bold uppercase tracking-wide">Body composition signal · 14 days</div>
        <div className="display mt-1 text-3xl">{signal.label}.</div>
        <div className="text-sm">{signal.suggestion}</div>
        <div className="mt-1 font-mono text-xs text-ink">Weight trend {signal.weightRatePctPerWeek > 0 ? '+' : ''}{signal.weightRatePctPerWeek}%/week</div>
      </Card>
    </div>
  );
}

const addDaysLocal = (d: string, n: number) => {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return t.toISOString().slice(0, 10);
};

function Vault() {
  const items = useLiveQuery(() => db.measurements.orderBy('date').reverse().toArray());
  const [form, setForm] = useState<Partial<Measurement>>({});
  const [photo, setPhoto] = useState<Blob | undefined>();
  if (!items) return null;

  const save = async () => {
    await db.measurements.add({ id: uid(), date: todayKey(), ...form, photo });
    setForm({});
    setPhoto(undefined);
  };

  return (
    <div className="space-y-4">
      <p className="font-mono text-xs uppercase"><span className="font-bold">[PRIVATE]</span> Stored only on this device and never shared. Photos show as a dither print.</p>
      <Card className="space-y-2">
        <div className="font-bold">New entry</div>
        <div className="grid grid-cols-2 gap-2">
          {(['waistCm', 'chestCm', 'armCm', 'thighCm'] as const).map((k) => (
            <div key={k}>
              <Label>{k.replace('Cm', '')} cm</Label>
              <NumberInput value={form[k]} onChange={(v) => setForm({ ...form, [k]: v })} />
            </div>
          ))}
        </div>
        <TextInput placeholder="Note" value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <label className="flex min-h-11 cursor-pointer items-center justify-center border-2 border-ink text-sm">
          {photo ? 'Photo added' : 'Add photo'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0])} />
        </label>
        <Button className="w-full" onClick={save}>
          Save
        </Button>
      </Card>
      {items.map((m) => (
        <VaultItem key={m.id} m={m} />
      ))}
    </div>
  );
}

function VaultItem({ m }: { m: Measurement }) {
  return (
    <Card className="flex gap-3">
      {m.photo && <DitherImg blob={m.photo} owner className="h-28 w-24" />}
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs font-bold uppercase">{prettyDate(m.date)}</div>
        <div className="font-mono text-sm text-ink">
          {[m.waistCm && `waist ${m.waistCm}`, m.chestCm && `chest ${m.chestCm}`, m.armCm && `arm ${m.armCm}`, m.thighCm && `thigh ${m.thighCm}`].filter(Boolean).join(' · ')}
        </div>
        {m.note && <div className="text-sm">{m.note}</div>}
      </div>
      <button className="min-h-11 min-w-11 self-start border-2 border-ink font-mono font-bold" aria-label="Delete entry" onClick={() => confirm('Delete this entry?') && db.measurements.delete(m.id)}>
        ×
      </button>
    </Card>
  );
}
