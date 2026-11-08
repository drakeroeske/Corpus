import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayKey, uid } from '../../data/db';
import { saveCheckIn, useData } from '../../data/repo';
import { bodyWeightSeries, readinessSeries, strengthChangePct } from '../../data/plan';
import {
  EXPERIMENT_TEMPLATES,
  addDays,
  daysBetween,
  experimentPhase,
  experimentReport,
  type CheckIn,
  type Experiment,
  type ProgramDay,
  type WorkoutSession,
} from '../../engine';
import { Button, Card, Label, Segmented, TextInput, prettyDate } from '../../components/ui';
import { Grain, Tag, pad3 } from '../../components/riso';

export default function Experiments() {
  const data = useData();
  const exps = useLiveQuery(() => db.experiments.toArray());
  const [custom, setCustom] = useState({ name: '', question: '' });
  if (!data || !exps) return null;
  const today = todayKey();
  const active = exps.find((e) => e.status === 'baseline' || e.status === 'testing');
  const past = exps.filter((e) => e !== active);
  const num = (e: Experiment) => pad3([...exps].sort((a, b) => a.startDate.localeCompare(b.startDate)).indexOf(e) + 1);

  const start = async (t: (typeof EXPERIMENT_TEMPLATES)[number]) => {
    const name = t.type === 'custom' ? custom.name || t.name : t.name;
    const question = t.type === 'custom' ? custom.question || t.question : t.question;
    await db.experiments.add({ id: uid(), type: t.type, name, question, startDate: today, baselineDays: 14, lengthDays: 28, status: 'baseline' });
  };

  return (
    <div className="space-y-4">
      {active ? (
        <ActiveExperiment e={active} no={num(active)} data={data} today={today} />
      ) : (
        <>
          <p className="font-mono text-xs uppercase">Test one change on yourself: 14 days of baseline, then 28 days with the change and a daily yes/no.</p>
          {EXPERIMENT_TEMPLATES.map((t) => (
            <Card key={t.type}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold uppercase">{t.name}</div>
                  <div className="font-mono text-xs">{t.question}</div>
                </div>
                <Button variant="ghost" onClick={() => start(t)}>
                  Start
                </Button>
              </div>
              {t.type === 'custom' && (
                <div className="mt-2 space-y-2">
                  <TextInput placeholder="Name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
                  <TextInput placeholder="Daily yes/no question" value={custom.question} onChange={(e) => setCustom({ ...custom, question: e.target.value })} />
                </div>
              )}
            </Card>
          ))}
        </>
      )}
      {past.length > 0 && <h2 className="display pt-2 text-4xl">Past experiments.</h2>}
      {past.map((e) => (
        <Card key={e.id}>
          <div className="flex justify-between font-mono text-[10px] font-bold uppercase">
            <span>EXP Nº {num(e)}</span>
            <span>{prettyDate(e.startDate)} · [{e.status.toUpperCase()}]</span>
          </div>
          <div className="display mt-1 mb-2 text-3xl">{e.name}.</div>
          <ReportView e={e} data={data} today={today} />
        </Card>
      ))}
    </div>
  );
}

type Data = { days: ProgramDay[]; sessions: WorkoutSession[]; checkins: CheckIn[] };

function ActiveExperiment({ e, no, data, today }: { e: Experiment; no: string; data: Data; today: string }) {
  const ph = experimentPhase(e, today);
  const ci = data.checkins.find((c) => c.date === today);

  useEffect(() => {
    if (ph.phase === 'done' || (ph.phase === 'testing' && e.status !== 'testing')) {
      db.experiments.update(e.id, { status: ph.phase === 'done' ? 'done' : 'testing' });
    }
  }, [ph.phase, e.id, e.status]);

  return (
    <Card className="space-y-3">
      <Grain />
      <div className="relative">
        <div className="flex justify-between font-mono text-[10px] font-bold uppercase">
          <span>EXP Nº {no}</span>
          <span>[{ph.phase === 'baseline' ? 'BASELINE' : 'TESTING'}] Day {ph.day} / {ph.totalDays}</span>
        </div>
        <div className="display mt-2 text-4xl">{e.name}.</div>
        <div className="track mt-2 h-2.5">
          <div className="h-full bg-ink" style={{ width: `${(ph.day / ph.totalDays) * 100}%` }} />
        </div>
        <div className="mt-1 font-mono text-xs uppercase">
          {ph.phase === 'baseline' ? `Live as normal. Test starts ${prettyDate(ph.testStart)}.` : 'Answer the daily question in your check-in or here.'}
        </div>
      </div>

      {ph.phase === 'testing' && (
        <div>
          <Label>{e.question}</Label>
          <Segmented
            options={['yes', 'no']}
            labels={['Yes', 'No']}
            value={ci?.experimentFlag === undefined ? undefined : ci.experimentFlag ? 'yes' : 'no'}
            onChange={(v) => saveCheckIn({ ...(ci ?? { date: today, soreness: {}, notes: '' }), experimentFlag: v === undefined ? undefined : v === 'yes' })}
            allowClear
          />
        </div>
      )}

      {ph.phase === 'testing' && ph.phaseDay >= 7 && <ReportView e={e} data={data} today={today} />}

      <Button variant="danger" className="w-full" onClick={() => confirm('Stop this experiment?') && db.experiments.update(e.id, { status: 'stopped' })}>
        Stop experiment
      </Button>
    </Card>
  );
}

function ReportView({ e, data, today }: { e: Experiment; data: Data; today: string }) {
  const ph = experimentPhase(e, today);
  const baseEnd = addDays(ph.testStart, -1);
  const testEnd = ph.phase === 'done' ? addDays(ph.testStart, e.lengthDays - 1) : today;
  if (daysBetween(ph.testStart, testEnd) < 0) return <p className="text-sm text-ink">Stopped before the test started.</p>;
  const testDays = daysBetween(ph.testStart, testEnd) + 1;

  const rd = (from: string, to: string) =>
    readinessSeries(data.checkins, data.days, to, daysBetween(from, to) + 1)
      .filter((r) => !r.assumed)
      .map((r) => r.score);
  const bw = bodyWeightSeries(data.checkins);
  const flags = data.checkins.filter((c) => c.date >= ph.testStart && c.date <= testEnd && c.experimentFlag !== undefined).map((c) => !!c.experimentFlag);

  const r = experimentReport({
    baselineReadiness: rd(e.startDate, baseEnd),
    testReadiness: rd(ph.testStart, testEnd),
    baselineStrengthPct: strengthChangePct(data.sessions, e.startDate, baseEnd),
    testStrengthPct: strengthChangePct(data.sessions, ph.testStart, testEnd),
    baselineDays: e.baselineDays,
    testDays,
    baselineWeights: bw.filter((w) => w.date >= e.startDate && w.date <= baseEnd),
    testWeights: bw.filter((w) => w.date >= ph.testStart && w.date <= testEnd),
    flags,
  });

  return (
    <div className="space-y-2">
      <table className="w-full border-t-[3px] border-ink font-mono text-sm">
        <thead>
          <tr className="border-b border-ink text-[10px] uppercase">
            <th className="text-left font-bold">Measure</th>
            <th className="text-right font-bold">Baseline</th>
            <th className="text-right font-bold">Test</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.label} className="border-t border-dashed border-ink first:border-t-0">
              <td className="py-1 text-xs uppercase">{row.label}</td>
              <td className="text-right">{Number.isFinite(row.baseline) ? `${row.baseline}${row.unit}` : '–'}</td>
              <td className="text-right">{Number.isFinite(row.test) ? `${row.test}${row.unit}` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="font-mono text-sm">{r.summary}</div>
      <div className="font-mono text-xs uppercase">
        Adherence {Math.round(r.adherence * 100)}% ({flags.length} answers) <Tag>CONFIDENCE: {r.confidence.toUpperCase()}</Tag>
      </div>
      <div className="font-mono text-[10px]">{r.confidenceLabel}</div>
    </div>
  );
}
