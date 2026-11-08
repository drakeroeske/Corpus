import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, todayKey, uid } from '../../data/db';
import { useData } from '../../data/repo';
import { bodyComp, bodyWeightSeries, currentFatigue, weeklySetsFor } from '../../data/plan';
import { MUSCLES, RECOVERING_PCT, VOLUME_RANGE, fatiguePercent, volumeStatus, type Measurement } from '../../engine';
import BodyMap from '../../components/BodyMap';
import { Button, Card, Label, NumberInput, PageHeader, SubTabs, TextInput, fmt, prettyDate } from '../../components/ui';
import { color, fatigueColor, font } from '../../theme/tokens';
import Strength from './Strength';
import Report from './Report';
import Experiments from './Experiments';

type Tab = 'recovery' | 'strength' | 'weight' | 'vault' | 'experiments' | 'report';

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
      {tab === 'report' && <Report />}
      {tab === 'experiments' && <Experiments />}
      {tab === 'vault' && <Vault />}
    </div>
  );
}

function Recovery() {
  const data = useData();
  if (!data) return null;
  const today = todayKey();
  const { sessions, checkins, meals, profile } = data;
  const { units, halfLife } = currentFatigue(sessions, checkins.find((c) => c.date === today), meals, profile, today, Date.now());
  const pct = Object.fromEntries(MUSCLES.map((m) => [m, fatiguePercent(units[m])])) as Record<string, number>;
  const weekly = weeklySetsFor(sessions, today);

  return (
    <div className="space-y-4">
      <Card>
        <BodyMap fill={(m) => fatigueColor(pct[m] / 100)} />
        <div className="mt-2 flex items-center justify-between text-xs text-mute">
          <span className="text-lime">Recovered</span>
          <span>Half-life {halfLife}h</span>
          <span className="text-warn">Fatigued</span>
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-bold">Fatigue by muscle</div>
        {[...MUSCLES]
          .sort((a, b) => pct[b] - pct[a])
          .map((m) => (
            <div key={m} className="flex items-center gap-2 py-0.5 text-sm">
              <span className="w-24 shrink-0 capitalize">{m}</span>
              <div className="h-2 flex-1 rounded bg-line">
                <div className="h-2 rounded" style={{ width: `${pct[m]}%`, background: fatigueColor(pct[m] / 100) }} />
              </div>
              <span className={`w-10 text-right font-mono ${pct[m] > RECOVERING_PCT ? 'text-warn' : ''}`}>{pct[m]}%</span>
            </div>
          ))}
      </Card>

      <Card>
        <div className="mb-1 font-bold">Weekly hard sets</div>
        <div className="mb-2 text-xs text-mute">
          Last 7 days vs the {VOLUME_RANGE.min}–{VOLUME_RANGE.max} set range
        </div>
        {MUSCLES.map((m) => {
          const n = weekly[m];
          const st = volumeStatus(n);
          return (
            <div key={m} className="flex items-center gap-2 py-0.5 text-sm">
              <span className="w-24 shrink-0 capitalize">{m}</span>
              <div className="relative h-2 flex-1 rounded bg-line">
                <div className="absolute h-2 border-x border-mute/60" style={{ left: '40%', width: '40%' }} />
                <div className={`h-2 rounded ${st === 'ok' ? 'bg-lime' : st === 'over' ? 'bg-warn' : 'bg-info'}`} style={{ width: `${Math.min(100, (n / 25) * 100)}%` }} />
              </div>
              <span className="w-16 text-right font-mono text-xs">
                {fmt(n)} {st !== 'ok' && <span className={st === 'over' ? 'text-warn' : 'text-info'}>{st}</span>}
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function Weight() {
  const data = useData();
  if (!data) return null;
  const { checkins, sessions, profile } = data;
  const today = todayKey();
  const series = bodyWeightSeries(checkins);
  const chart = series.map((p, i) => {
    const win = series.slice(0, i + 1).filter((q) => q.date > addDaysLocal(p.date, -7));
    return { date: p.date, weight: p.value, avg: Math.round((win.reduce((a, q) => a + q.value, 0) / win.length) * 10) / 10 };
  });
  const signal = bodyComp(checkins, sessions, today);

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2 flex justify-between">
          <span className="font-bold">Body weight</span>
          <span className="font-mono text-sm text-mute">
            {chart.length ? `${chart[chart.length - 1].avg} ${profile.units} 7-day avg` : ''}
          </span>
        </div>
        {chart.length >= 2 ? (
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke={color.border} vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke={color.muted} fontSize={10} fontFamily={font.mono} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke={color.muted} fontSize={10} fontFamily={font.mono} />
                <Tooltip contentStyle={{ background: color.surface, border: `1px solid ${color.border}` }} />
                <Line dataKey="weight" stroke={color.muted} dot={{ r: 2 }} strokeWidth={1} isAnimationActive={false} />
                <Line dataKey="avg" stroke={color.lime} dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-mute">Log body weight in your morning check-in to see a trend.</p>
        )}
      </Card>
      <Card>
        <div className="text-xs uppercase tracking-wide text-mute">Body composition signal · 14 days</div>
        <div className="mt-1 text-lg font-bold">{signal.label}</div>
        <div className="text-sm">{signal.suggestion}</div>
        <div className="mt-1 font-mono text-xs text-mute">Weight trend {signal.weightRatePctPerWeek > 0 ? '+' : ''}{signal.weightRatePctPerWeek}%/week</div>
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
      <p className="text-sm text-mute">Private: stored only on this device and never shared.</p>
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
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line text-sm">
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
  const [url] = useState(() => (m.photo ? URL.createObjectURL(m.photo) : null));
  return (
    <Card className="flex gap-3">
      {url && <img src={url} alt="" className="h-24 w-20 rounded-lg object-cover" />}
      <div className="min-w-0 flex-1">
        <div className="font-bold">{prettyDate(m.date)}</div>
        <div className="font-mono text-sm text-mute">
          {[m.waistCm && `waist ${m.waistCm}`, m.chestCm && `chest ${m.chestCm}`, m.armCm && `arm ${m.armCm}`, m.thighCm && `thigh ${m.thighCm}`].filter(Boolean).join(' · ')}
        </div>
        {m.note && <div className="text-sm">{m.note}</div>}
      </div>
      <button className="min-h-11 min-w-11 self-start text-mute" aria-label="Delete entry" onClick={() => confirm('Delete this entry?') && db.measurements.delete(m.id)}>
        ×
      </button>
    </Card>
  );
}
