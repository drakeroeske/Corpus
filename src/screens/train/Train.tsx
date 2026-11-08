import { useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayKey } from '../../data/db';
import { startSession, useProfile, useProgram, useSessions, deleteSession } from '../../data/repo';
import { dayForDate, sessionStats } from '../../data/plan';
import { exerciseName } from '../../data/exercises';
import { Button, Card, PageHeader, SubTabs, fmt, fmtDuration, prettyDate } from '../../components/ui';
import { ProgramList, DayEditor } from './ProgramBuilder';
import WorkoutLogger from './Workout';
import { PrCardButton } from '../spotters/PrCard';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const weekdayLabel = (w: number[]) => (w.length ? [...w].sort().map((d) => WD[d]).join(' · ') : 'Unscheduled');

export default function Train() {
  return (
    <Routes>
      <Route index element={<TrainHome />} />
      <Route path="program" element={<ProgramList />} />
      <Route path="program/:dayId" element={<DayEditor />} />
      <Route path="workout/:sessionId" element={<WorkoutLogger />} />
      <Route path="session/:sessionId" element={<SessionSummary />} />
    </Routes>
  );
}

function TrainHome() {
  const [tab, setTab] = useState<'workouts' | 'history'>('workouts');
  return (
    <div>
      <PageHeader title="Train" />
      <SubTabs
        tabs={[
          { id: 'workouts', label: 'Workouts' },
          { id: 'history', label: 'History' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'workouts' ? <Workouts /> : <History />}
    </div>
  );
}

function Workouts() {
  const nav = useNavigate();
  const days = useProgram();
  const sessions = useSessions();
  if (!days || !sessions) return null;
  const today = todayKey();
  const todays = dayForDate(days, today);
  const open = sessions.filter((s) => s.date === today && !s.finishedAt);

  const start = async (dayId: string) => nav(`/train/workout/${await startSession(dayId)}`);

  return (
    <div className="space-y-3">
      {days.map((d) => {
        const isOpen = open.some((s) => s.programDayId === d.id);
        const doneToday = sessions.some((s) => s.date === today && s.programDayId === d.id && s.finishedAt);
        return (
          <Card key={d.id} className={d.id === todays?.id ? 'border-lime/60' : ''}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold">{d.name}</div>
                <div className="text-sm text-mute">
                  {weekdayLabel(d.weekdays)} · {d.exercises.length} exercises{d.id === todays?.id ? ' · today' : ''}
                </div>
              </div>
              <Button variant={d.id === todays?.id || isOpen ? 'primary' : 'ghost'} onClick={() => start(d.id)}>
                {isOpen ? 'Continue' : doneToday ? 'Again' : 'Start'}
              </Button>
            </div>
          </Card>
        );
      })}
      {!days.length && <p className="text-mute">No program yet.</p>}
      <Button variant="ghost" className="w-full" onClick={() => nav('/train/program')}>
        Edit program
      </Button>
    </div>
  );
}

function History() {
  const nav = useNavigate();
  const sessions = useSessions();
  const days = useProgram();
  const profile = useProfile();
  if (!sessions || !days) return null;
  const done = sessions.filter((s) => s.finishedAt).reverse();
  if (!done.length) return <p className="text-mute">No finished workouts yet.</p>;
  return (
    <div className="space-y-2">
      {done.map((s) => {
        const st = sessionStats(s, sessions);
        return (
          <Card key={s.id} onClick={() => nav(`/train/session/${s.id}`)}>
            <div className="flex justify-between">
              <span className="font-bold">{days.find((d) => d.id === s.programDayId)?.name ?? 'Workout'}</span>
              <span className="text-sm text-mute">{prettyDate(s.date)}</span>
            </div>
            <div className="font-mono text-sm text-mute">
              {fmtDuration(s.durationSec)} · {st.workingSets} sets · {st.volume.toLocaleString()} {profile.units}
              {st.prs.length > 0 && <span className="text-lime"> · {st.prs.length} PR</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SessionSummary() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const session = useLiveQuery(() => db.sessions.get(sessionId!), [sessionId]);
  const sessions = useSessions();
  const days = useProgram();
  const profile = useProfile();
  if (!session || !sessions || !days) return null;
  const st = sessionStats(session, sessions);
  const name = days.find((d) => d.id === session.programDayId)?.name ?? 'Workout';
  const muscles = Object.entries(st.setsPerMuscle).sort((a, b) => b[1]! - a[1]!);
  const maxSets = Math.max(1, ...muscles.map((m) => m[1]!));

  return (
    <div className="space-y-4">
      <PageHeader title={name} sub={prettyDate(session.date, { weekday: 'long', month: 'long', day: 'numeric' })} back />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Duration" value={fmtDuration(session.durationSec)} />
        <Stat label="Sets" value={String(st.workingSets)} />
        <Stat label={`Volume ${profile.units}`} value={st.volume.toLocaleString()} />
      </div>

      {st.prs.length > 0 && (
        <Card className="border-lime/60">
          <div className="mb-2 font-bold text-lime">Personal records</div>
          {st.prs.map((p) => (
            <div key={p.exerciseId} className="flex items-center justify-between gap-2 py-1">
              <div>
                <div>{exerciseName(p.exerciseId)}</div>
                <div className="font-mono text-sm text-mute">
                  {fmt(p.weight)} × {p.reps} · e1RM {p.e1rm}
                </div>
              </div>
              <PrCardButton exerciseId={p.exerciseId} weight={p.weight} reps={p.reps} e1rm={p.e1rm} />
            </div>
          ))}
        </Card>
      )}

      <Card>
        <div className="mb-2 font-bold">Sets per muscle</div>
        {muscles.map(([m, n]) => (
          <div key={m} className="flex items-center gap-2 py-0.5 text-sm">
            <span className="w-24 shrink-0 capitalize">{m}</span>
            <div className="h-2 flex-1 rounded bg-line">
              <div className="h-2 rounded bg-lime" style={{ width: `${(n! / maxSets) * 100}%` }} />
            </div>
            <span className="w-6 text-right font-mono">{n}</span>
          </div>
        ))}
      </Card>

      <Card>
        <div className="mb-2 font-bold">Top sets</div>
        {st.topSets.map((t) => (
          <div key={t.exerciseId} className="flex justify-between py-0.5 text-sm">
            <span>{exerciseName(t.exerciseId)}</span>
            <span className="font-mono">
              {t.weight ? fmt(t.weight) : 'BW'} × {t.reps}
            </span>
          </div>
        ))}
      </Card>

      {session.finishedAt && (profile.sharePosts ?? 'all') !== 'off' && (
        <p className="text-center text-sm text-mute">{profile.sharePosts === 'prs' ? 'PRs are shared to your Spotters feed.' : 'Posted to your Spotters feed.'}</p>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => nav('/today')}>
          Done
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (confirm('Delete this workout?')) {
              await deleteSession(session.id);
              nav('/train');
            }
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-mute">{label}</div>
      <div className="font-mono text-xl">{value}</div>
      {sub && <div className="text-xs text-mute">{sub}</div>}
    </Card>
  );
}
