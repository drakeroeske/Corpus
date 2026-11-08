import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayKey } from '../../data/db';
import { saveCheckIn, useProfile } from '../../data/repo';
import { watchSync } from '../../services/watchSync';
import type { CheckIn, Experiment, Muscle } from '../../engine';
import BodyMap from '../../components/BodyMap';
import { Button, Label, NumberInput, Segmented, Sheet, Stepper } from '../../components/ui';

export default function CheckInSheet() {
  const nav = useNavigate();
  const date = todayKey();
  const data = useLiveQuery(async () => ({
    today: await db.checkins.get(date),
    last: await db.checkins.orderBy('date').last(),
    exp: (await db.experiments.toArray()).find((e) => e.status === 'baseline' || e.status === 'testing'),
  }));
  const close = () => nav('/today');
  if (!data) return null;
  return (
    <Sheet title="Morning check-in" onClose={close}>
      <Form date={date} today={data.today} last={data.last} exp={data.exp} done={close} />
    </Sheet>
  );
}

function Form({ date, today, last, exp, done }: { date: string; today?: CheckIn; last?: CheckIn; exp?: Experiment; done: () => void }) {
  const profile = useProfile();
  const [c, setC] = useState<CheckIn>(
    today ?? { date, bodyWeight: last?.bodyWeight ?? profile.bodyWeight, sleepHours: 7.5, energy: 3, stress: 2, sleepQuality: 3, soreness: {}, notes: '' },
  );
  const [syncing, setSyncing] = useState(false);
  const set = (patch: Partial<CheckIn>) => setC({ ...c, ...patch });
  const tapMuscle = (m: Muscle) => {
    const cur = c.soreness[m] ?? 1;
    set({ soreness: { ...c.soreness, [m]: cur >= 5 ? 1 : cur + 1 } });
  };
  const sore = Object.entries(c.soreness).filter(([, v]) => v! > 1);

  const sync = async () => {
    setSyncing(true);
    const w = await watchSync.fetchDay(date);
    set({ sleepHours: w.sleepHours, hrv: w.hrv, restingHr: w.restingHr, steps: w.steps });
    setSyncing(false);
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" className="w-full" onClick={sync} disabled={syncing}>
        {syncing ? 'Syncing…' : 'Sync from watch'}
      </Button>

      <div className="flex gap-2">
        <Stepper label="Sleep" value={c.sleepHours ?? 7.5} step={0.25} suffix="h" onChange={(v) => set({ sleepHours: v })} />
        <Stepper label="Body weight" value={c.bodyWeight ?? profile.bodyWeight} step={0.2} suffix={profile.units} onChange={(v) => set({ bodyWeight: v })} />
      </div>

      <div>
        <Label>Sleep quality</Label>
        <Segmented options={[1, 2, 3, 4, 5]} value={c.sleepQuality} allowClear onChange={(v) => set({ sleepQuality: v })} />
      </div>
      <div>
        <Label>Energy</Label>
        <Segmented options={[1, 2, 3, 4, 5]} value={c.energy} allowClear onChange={(v) => set({ energy: v })} />
      </div>
      <div>
        <Label>Stress</Label>
        <Segmented options={[1, 2, 3, 4, 5]} value={c.stress} allowClear onChange={(v) => set({ stress: v })} />
      </div>

      <div>
        <Label>Soreness — tap a muscle to raise it (1–5)</Label>
        <BodyMap onTap={tapMuscle} heat={(m) => ((c.soreness[m] ?? 1) - 1) / 4} />
        <div className="mt-2 flex flex-wrap gap-1 font-mono text-xs uppercase">
          {sore.length ? (
            sore.map(([m, v]) => (
              <button key={m} className="min-h-11 border-2 border-ink px-2" onClick={() => set({ soreness: { ...c.soreness, [m]: 1 } })}>
                {m} {v} ×
              </button>
            ))
          ) : (
            <span className="text-ink">Nothing sore.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>HRV ms</Label>
          <NumberInput value={c.hrv} onChange={(v) => set({ hrv: v })} />
        </div>
        <div>
          <Label>Resting HR</Label>
          <NumberInput value={c.restingHr} onChange={(v) => set({ restingHr: v })} />
        </div>
        <div>
          <Label>Steps</Label>
          <NumberInput value={c.steps} onChange={(v) => set({ steps: v })} />
        </div>
      </div>

      {exp && exp.status === 'testing' && (
        <div>
          <Label>Experiment: {exp.question}</Label>
          <Segmented
            options={['yes', 'no']}
            labels={['Yes', 'No']}
            value={c.experimentFlag === undefined ? undefined : c.experimentFlag ? 'yes' : 'no'}
            allowClear
            onChange={(v) => set({ experimentFlag: v === undefined ? undefined : v === 'yes' })}
          />
        </div>
      )}

      <textarea
        value={c.notes}
        onChange={(e) => set({ notes: e.target.value })}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full border-2 border-ink p-3 font-mono"
      />

      <Button
        className="min-h-14 w-full text-base"
        onClick={async () => {
          await saveCheckIn(c);
          done();
        }}
      >
        Save check-in
      </Button>
    </div>
  );
}
