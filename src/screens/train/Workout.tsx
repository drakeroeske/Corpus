import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { deleteSet, finishSession, logSet, saveDay, setSessionNotes, setSubstitution, useProfile, useSessions } from '../../data/repo';
import { buildPlan, currentFatigue, hrvHistory, isBodyweight, sessionNumber, type PlanItem } from '../../data/plan';
import { EXERCISES } from '../../data/exercises';
import {
  RECOVERING_PCT,
  e1rm,
  fatiguePercent,
  isPR,
  platesPerSide,
  restSeconds,
  substitutes,
  warmupSets,
  type LoggedSet,
  type Muscle,
  type UserProfile,
  type WorkoutSession,
} from '../../engine';
import { useApp } from '../../store/app';
import { Button, Label, NumberInput, PageHeader, Segmented, Stepper, fmt } from '../../components/ui';
import { LabTable, NoteLine, Tag, pad3 } from '../../components/riso';

export default function WorkoutLogger() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const session = useLiveQuery(() => db.sessions.get(sessionId!), [sessionId]);
  const sessions = useSessions();
  const day = useLiveQuery(async () => (session ? (await db.programDays.get(session.programDayId)) ?? null : undefined), [session?.programDayId]);
  const checkins = useLiveQuery(() => db.checkins.toArray());
  const meals = useLiveQuery(() => db.meals.toArray());
  const profile = useProfile();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!session || !sessions || day === undefined || !checkins || !meals) return null;
  if (day === null) return <p className="text-ink">This program day was deleted.</p>;

  const checkin = checkins.find((c) => c.date === session.date);
  const plan = buildPlan(day, sessions, checkin, hrvHistory(checkins, session.date), profile, session.date, {
    excludeSessionId: session.id,
    substitutions: session.substitutions,
  });
  const fatigue = currentFatigue(sessions, checkin, meals, profile, session.date, Date.now(), session.id).units;
  const minutes = Math.floor(((session.finishedAt ?? Date.now()) - session.startedAt) / 60000);

  return (
    <div>
      {/* Read mid-set: no grain on this screen. */}
      <PageHeader
        title={day.name}
        section="LOG"
        grain={false}
        back
        status={`${day.name.toUpperCase()} [${session.finishedAt ? 'DONE' : 'LIVE'}]`}
        sub={`SESSION ${pad3(sessionNumber(sessions, session.id) || sessions.length + 1)} · ${minutes} MIN`}
      />
      <div className="mb-4">
        <NoteLine>
          READINESS {plan.readiness.score} · {plan.readiness.reason}
          {plan.phase && plan.phase.name !== 'Done' && ` · RETURN ${plan.phase.name} WK ${plan.phase.week}`}
        </NoteLine>
      </div>

      <div className="space-y-4">
        {plan.items.map((item, i) => (
          <ExerciseCard
            key={`${item.pe.exerciseId}-${item.ex.id}-${i}`}
            item={item}
            session={session}
            sessions={sessions}
            profile={profile}
            recovering={item.ex.primaryMuscles.map((m) => ({ m, pct: fatiguePercent(fatigue[m]) })).filter((x) => x.pct > RECOVERING_PCT)}
            onStartWeight={(w) =>
              saveDay({ ...day, exercises: day.exercises.map((e) => (e.exerciseId === item.pe.exerciseId ? { ...e, startWeight: w } : e)) })
            }
          />
        ))}
      </div>

      <textarea
        defaultValue={session.notes}
        onBlur={(e) => e.target.value !== session.notes && setSessionNotes(session.id, e.target.value)}
        placeholder="Session notes (optional)"
        rows={2}
        className="mt-4 w-full border-2 border-ink p-3 font-mono"
      />

      <Button
        className="mt-4 min-h-14 w-full text-base"
        disabled={!session.sets.length}
        onClick={async () => {
          await finishSession(session.id);
          useApp.getState().stopRest();
          nav(`/train/session/${session.id}`, { replace: true });
        }}
      >
        {session.finishedAt ? 'View summary' : 'Finish workout'}
      </Button>
    </div>
  );
}

function ExerciseCard({
  item,
  session,
  sessions,
  profile,
  recovering,
  onStartWeight,
}: {
  item: PlanItem;
  session: WorkoutSession;
  sessions: WorkoutSession[];
  profile: UserProfile;
  recovering: { m: Muscle; pct: number }[];
  onStartWeight: (w: number) => void;
}) {
  const { ex, pe, target, programmed } = item;
  const bw = isBodyweight(ex);
  const indexed = session.sets.map((s, i) => ({ s, i })).filter((x) => x.s.exerciseId === ex.id);
  const working = indexed.filter((x) => !x.s.isWarmup);
  const lastWorking = working[working.length - 1]?.s;
  const units = profile.units;

  const [weight, setWeight] = useState<number | null>(lastWorking?.weight ?? target.weight);
  const [reps, setReps] = useState(lastWorking?.reps ?? target.repGoal);
  const [rir, setRir] = useState<number | undefined>(target.rirCap);
  const [warm, setWarm] = useState(false);
  const [tool, setTool] = useState<'warmup' | 'plates' | 'swap' | null>(null);
  const [startInput, setStartInput] = useState<number | undefined>();
  const [pr, setPr] = useState<number | null>(null);
  const done = working.length >= pe.sets;
  const startRest = useApp((s) => s.startRest);

  const log = async () => {
    if (weight === null) return;
    if (!warm) {
      const previous: LoggedSet[] = sessions.flatMap((o) => o.sets).filter((x) => x.exerciseId === ex.id && !x.isWarmup);
      setPr(isPR({ weight, reps }, previous) ? e1rm(weight, reps) : null);
    }
    await logSet(session.id, { exerciseId: ex.id, weight: bw ? 0 : weight, reps, rir, isWarmup: warm });
    if (!warm) startRest(restSeconds(ex, profile));
    setWarm(false);
  };

  const subs = substitutes(programmed, EXERCISES).slice(0, 6);
  const usesBar = ex.equipment === 'barbell';
  const effort = [
    target.rirCap !== undefined ? `stop at ${target.rirCap} RIR` : null,
    target.technique !== 'none' ? target.technique : null,
  ].filter(Boolean);

  return (
    <section className="border-2 border-ink bg-page p-4">
      <div className="flex items-start justify-between gap-2 border-b-[3px] border-ink pb-2">
        <h2 className="font-mono text-base font-bold uppercase">{ex.name}</h2>
        <span className="shrink-0 font-mono text-sm font-bold">
          {done ? <Tag>DONE</Tag> : `SET ${Math.min(working.length + 1, pe.sets)}/${pe.sets}`}
        </span>
      </div>
      {ex.id !== programmed.id && <div className="mt-1 font-mono text-[10px] uppercase">[SWAP] for {programmed.name}</div>}
      <div className="mt-3 font-mono text-[10px] font-bold uppercase">Target</div>
      <div className="display text-[64px]">
        {bw ? 'BW' : target.weight === null ? '?' : fmt(target.weight)} × {target.repGoal}
      </div>
      <div className="mt-1 font-mono text-xs uppercase">
        {units} · range {pe.repMin}–{pe.repMax}
        {effort.length ? ` · ${effort.join(' · ')}` : ''}
      </div>
      <div className="mt-2">
        <NoteLine>{target.why}</NoteLine>
      </div>
      {recovering.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {recovering.map((r) => (
            <span key={r.m} className="font-mono text-xs uppercase">
              <Tag>RECOVERING</Tag> {r.m} {r.pct}%
            </span>
          ))}
        </div>
      )}

      {indexed.length > 0 && (
        <LabTable
          className="mt-3"
          head={['Set', 'Load', 'Reps', 'RIR', '']}
          align={['l', 'r', 'r', 'r', 'r']}
          bold={[1, 2]}
          rows={indexed.map(({ s, i }, n) => ({
            key: String(i),
            cells: [
              s.isWarmup ? 'W' : String(n + 1 - indexed.slice(0, n).filter((x) => x.s.isWarmup).length).padStart(2, '0'),
              bw ? 'BW' : fmt(s.weight),
              s.reps,
              s.rir ?? '–',
              <button aria-label="Delete set" className="min-h-11 min-w-11 border-2 border-ink font-bold" onClick={() => deleteSet(session.id, i)}>
                ×
              </button>,
            ],
          }))}
        />
      )}
      {pr !== null && (
        <p className="mt-2 font-mono text-sm font-bold uppercase">
          <Tag signal>PR</Tag> New best — e1RM {pr} {units}
        </p>
      )}

      {weight === null ? (
        <div className="mt-3 flex gap-2">
          <NumberInput placeholder={`Starting weight (${units})`} value={startInput} onChange={setStartInput} />
          <Button
            onClick={() => {
              if (startInput && startInput > 0) {
                setWeight(startInput);
                if (ex.id === programmed.id) onStartWeight(startInput);
              }
            }}
          >
            Set
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            {!bw && <Stepper label="Weight" value={weight} onChange={setWeight} step={pe.increment || (units === 'lb' ? 2.5 : 1.25)} suffix={units} />}
            <Stepper label="Reps" value={reps} onChange={setReps} step={1} min={1} />
          </div>
          <div className="mt-3">
            <Label>RIR (optional)</Label>
            <Segmented options={[0, 1, 2, 3, 4]} labels={['0', '1', '2', '3', '4+']} value={rir} onChange={setRir} allowClear />
          </div>
          <button
            aria-pressed={warm}
            onClick={() => setWarm(!warm)}
            className={`mt-3 min-h-11 w-full border-2 border-ink font-mono text-xs font-bold uppercase ${warm ? 'bg-ink text-page' : ''}`}
          >
            {warm ? '[x] Warm-up set' : '[ ] Warm-up set'}
          </button>
          <Button className="mt-2 min-h-16 w-full text-lg" onClick={log}>
            {warm ? 'Log warm-up' : done ? 'Log extra set' : 'Log set'}
          </Button>
        </>
      )}

      <div className="mt-3 flex gap-1.5">
        {!bw && weight !== null && (
          <ToolButton on={tool === 'warmup'} onClick={() => setTool(tool === 'warmup' ? null : 'warmup')}>
            Warm-up calc
          </ToolButton>
        )}
        {usesBar && weight !== null && (
          <ToolButton on={tool === 'plates'} onClick={() => setTool(tool === 'plates' ? null : 'plates')}>
            Plates
          </ToolButton>
        )}
        <ToolButton on={tool === 'swap'} onClick={() => setTool(tool === 'swap' ? null : 'swap')}>
          Equipment busy?
        </ToolButton>
      </div>

      {tool === 'warmup' && weight !== null && (
        <div className="mt-2 space-y-1 font-mono text-sm">
          <LabTable head={['Warm-up', 'Load × reps']} align={['l', 'r']} rows={warmupSets(weight, units, usesBar).map((w) => ({ key: w.label, cells: [w.label, `${fmt(w.weight)} × ${w.reps}`] }))} />
          <div className="text-[10px] uppercase">Tap Warm-up before logging these so they don't count as work sets.</div>
        </div>
      )}
      {tool === 'plates' && weight !== null && <PlateView total={weight} units={units} />}
      {tool === 'swap' && (
        <div className="mt-2 space-y-1">
          {ex.id !== programmed.id && (
            <Button variant="ghost" className="w-full" onClick={() => setSubstitution(session.id, programmed.id, null)}>
              Back to {programmed.name}
            </Button>
          )}
          {subs.map((o) => (
            <button
              key={o.id}
              className={`flex min-h-11 w-full items-center justify-between border-t border-dashed border-ink px-2 text-left font-mono text-sm uppercase ${o.id === ex.id ? 'bg-ink text-page' : ''}`}
              onClick={() => {
                setSubstitution(session.id, programmed.id, o.id);
                setTool(null);
              }}
            >
              <span>{o.name}</span>
              <span className="text-[10px]">[{o.equipment}]</span>
            </button>
          ))}
          {!subs.length && <p className="text-sm text-ink">No close substitutes in the library.</p>}
        </div>
      )}
    </section>
  );
}

function ToolButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`min-h-11 flex-1 border-2 border-ink px-2 font-mono text-[11px] font-bold uppercase ${on ? 'bg-ink text-page' : ''}`}>
      {children}
    </button>
  );
}

function PlateView({ total, units }: { total: number; units: 'lb' | 'kg' }) {
  const { plates, remainder } = platesPerSide(total, units);
  return (
    <div className="mt-2 font-mono text-sm">
      <div>
        Per side: {plates.length ? plates.join(' + ') : 'empty bar'}
        {remainder > 0 && <span className="text-ink font-bold"> (+{remainder} unmatched)</span>}
      </div>
      <div className="text-xs text-ink">
        Bar {units === 'lb' ? 45 : 20} {units}
      </div>
    </div>
  );
}
