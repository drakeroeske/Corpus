import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { todayKey } from '../../data/db';
import { saveProfile, useData } from '../../data/repo';
import { e1rmSeries, exById } from '../../data/plan';
import { dayNum, projectGoal } from '../../engine';
import { Card, Label, NumberInput, prettyDate } from '../../components/ui';
import { color, font } from '../../theme/tokens';

const toDate = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

export default function Strength() {
  const data = useData();
  const [picked, setPicked] = useState<string | null>(null);
  const [sleep8h, setSleep] = useState(false);
  const [proteinDaily, setProtein] = useState(false);
  if (!data) return null;
  const { sessions, profile } = data;
  const today = todayKey();

  const ids = [...new Set(sessions.flatMap((s) => s.sets.filter((x) => x.weight > 0).map((x) => x.exerciseId)))]
    .map((id) => ({ id, n: e1rmSeries(sessions, id).length }))
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n);
  if (!ids.length) return <p className="text-mute">Log at least two sessions of a lift to see its trend.</p>;

  const id = picked && ids.some((x) => x.id === picked) ? picked : ids[0].id;
  const series = e1rmSeries(sessions, id);
  const latest = series[series.length - 1].e1rm;
  const goal = profile.liftGoals?.[id];
  const proj = goal ? projectGoal(series, goal, today, { sleep8h, proteinDaily }) : projectGoal(series, latest * 1.1, today, { sleep8h, proteinDaily });

  const points = new Map<number, { x: number; e1rm?: number; proj?: number }>();
  for (const p of series) points.set(dayNum(p.date), { x: dayNum(p.date), e1rm: p.e1rm });
  for (const p of proj?.line ?? []) {
    const x = dayNum(p.date);
    points.set(x, { ...(points.get(x) ?? { x }), proj: p.value });
  }
  const chart = [...points.values()].sort((a, b) => a.x - b.x);

  return (
    <div className="space-y-4">
      <select
        value={id}
        onChange={(e) => setPicked(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-line px-3"
      >
        {ids.map((x) => (
          <option key={x.id} value={x.id}>
            {exById(x.id).name} ({x.n} sessions)
          </option>
        ))}
      </select>

      <Card>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-bold">e1RM</span>
          <span className="font-mono">
            {latest} {profile.units}
          </span>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid stroke={color.border} vertical={false} />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(n) => toDate(n).slice(5)} stroke={color.muted} fontSize={10} fontFamily={font.mono} />
              <YAxis domain={['auto', 'auto']} stroke={color.muted} fontSize={10} fontFamily={font.mono} />
              <Tooltip labelFormatter={(n) => prettyDate(toDate(Number(n)))} contentStyle={{ background: color.surface, border: `1px solid ${color.border}` }} />
              {goal && <ReferenceLine y={goal} stroke={color.info} strokeDasharray="4 4" />}
              <Line dataKey="e1rm" stroke={color.lime} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
              <Line dataKey="proj" stroke={color.info} strokeDasharray="5 5" dot={false} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 text-xs text-mute">Dashed blue = projection from the last 6 weeks</div>
      </Card>

      <Card className="space-y-3">
        <div>
          <Label>Goal e1RM ({profile.units})</Label>
          <NumberInput
            value={goal}
            placeholder={`e.g. ${Math.round(latest * 1.1)}`}
            onChange={(v) => saveProfile({ liftGoals: { ...profile.liftGoals, [id]: v as number } })}
          />
        </div>
        <div className="flex gap-2">
          <Toggle on={sleep8h} onClick={() => setSleep(!sleep8h)}>
            What if: 8h sleep avg
          </Toggle>
          <Toggle on={proteinDaily} onClick={() => setProtein(!proteinDaily)}>
            What if: protein daily
          </Toggle>
        </div>
        {proj ? (
          <div className="text-sm">
            Rate <span className="font-mono">{proj.ratePerWeek > 0 ? '+' : ''}{proj.ratePerWeek} {profile.units}/week</span>
            {goal && (
              <div>
                {proj.projectedDate ? (
                  <>
                    Projected to reach <span className="font-mono">{goal}</span> by <span className="font-bold text-lime">{prettyDate(proj.projectedDate, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </>
                ) : (
                  'Not trending toward this goal yet.'
                )}
              </div>
            )}
            <div className="mt-1 text-xs text-mute">Estimate{sleep8h || proteinDaily ? ' (what-ifs add +10% each)' : ''}.</div>
          </div>
        ) : (
          <div className="text-sm text-mute">Not enough data in the last 6 weeks for a projection.</div>
        )}
      </Card>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`min-h-11 flex-1 rounded-xl border px-2 text-xs ${on ? 'border-info text-info' : 'border-line text-mute'}`}>
      {children}
    </button>
  );
}
