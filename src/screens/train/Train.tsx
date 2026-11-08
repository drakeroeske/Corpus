import { useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayKey } from '../../data/db';
import { startSession, useProfile, useProgram, useSessions, deleteSession } from '../../data/repo';
import { dayForDate, sessionNumber, sessionStats } from '../../data/plan';
import { exerciseName } from '../../data/exercises';
import { Button, Card, PageHeader, SubTabs, fmt, fmtDuration, prettyDate } from '../../components/ui';
import { LabTable, Tag, pad3, shortDate } from '../../components/riso';
import { Empty } from '../../components/diagrams';
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
      <PageHeader title="Log" section="LOG" />
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
      <LabTable
        head={['Day', 'Schedule', '']}
        align={['l', 'l', 'r']}
        rows={days.map((d) => {
          const isOpen = open.some((s) => s.programDayId === d.id);
          const doneToday = sessions.some((s) => s.date === today && s.programDayId === d.id && s.finishedAt);
          return {
            key: d.id,
            cells: [
              <div>
                <div className="font-bold uppercase">{d.name}</div>
                <div className="text-[10px] uppercase">
                  {d.exercises.length} exercises {d.id === todays?.id && <Tag>TODAY</Tag>} {isOpen && <Tag>LIVE</Tag>}
                </div>
              </div>,
              <span className="text-xs uppercase">{weekdayLabel(d.weekdays)}</span>,
              <Button variant={d.id === todays?.id || isOpen ? 'primary' : 'ghost'} onClick={() => start(d.id)}>
                {isOpen ? 'Continue' : doneToday ? 'Again' : 'Start'}
              </Button>,
            ],
          };
        })}
      />
      {!days.length && <Empty>No program yet.</Empty>}
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
  if (!done.length) return <Empty>No finished workouts yet.</Empty>;
  return (
    <LabTable
      head={['Nº', 'Session', 'Sets', `Vol ${profile.units}`]}
      align={['l', 'l', 'r', 'r']}
      rows={done.map((s) => {
        const st = sessionStats(s, sessions);
        return {
          key: s.id,
          onClick: () => nav(`/train/session/${s.id}`),
          cells: [
            <span className="font-bold">{pad3(sessionNumber(sessions, s.id))}</span>,
            <div>
              <div className="font-bold uppercase">{days.find((d) => d.id === s.programDayId)?.name ?? 'Workout'}</div>
              <div className="text-[10px] uppercase">
                {shortDate(s.date)} · {fmtDuration(s.durationSec)} {st.prs.length > 0 && <Tag signal>{st.prs.length > 1 ? `${st.prs.length} PR` : 'PR'}</Tag>}
              </div>
            </div>,
            st.workingSets,
            st.volume.toLocaleString(),
          ],
        };
      })}
    />
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
      <PageHeader title={name} section="LOG" status={`SESSION ${pad3(sessionNumber(sessions, session.id))} [DONE]`} sub={prettyDate(session.date, { weekday: 'long', month: 'long', day: 'numeric' })} back />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Duration" value={fmtDuration(session.durationSec)} />
        <Stat label="Sets" value={String(st.workingSets)} />
        <Stat label={`Volume ${profile.units}`} value={st.volume.toLocaleString()} />
      </div>

      {st.prs.length > 0 && (
        <Card>
          <div className="mb-2 font-mono text-[10px] font-bold uppercase">Personal records</div>
          {st.prs.map((p) => (
            <div key={p.exerciseId} className="flex items-center justify-between gap-2 border-t border-dashed border-ink py-2 first:border-t-0">
              <div>
                <div className="font-mono text-sm font-bold uppercase">
                  <Tag signal>PR</Tag> {exerciseName(p.exerciseId)}
                </div>
                <div className="font-mono text-sm">
                  {fmt(p.weight)} × {p.reps} · e1RM {p.e1rm}
                </div>
              </div>
              <PrCardButton exerciseId={p.exerciseId} weight={p.weight} reps={p.reps} e1rm={p.e1rm} />
            </div>
          ))}
        </Card>
      )}

      <Card>
        <div className="mb-2 font-mono text-[10px] font-bold uppercase">Sets per muscle</div>
        {muscles.map(([m, n]) => (
          <div key={m} className="flex items-center gap-2 py-0.5 font-mono text-xs uppercase">
            <span className="w-24 shrink-0">{m}</span>
            <div className="track h-2.5 flex-1">
              <div className="h-full bg-ink" style={{ width: `${(n! / maxSets) * 100}%` }} />
            </div>
            <span className="w-6 text-right font-mono">{n}</span>
          </div>
        ))}
      </Card>

      <Card>
        <div className="mb-2 font-mono text-[10px] font-bold uppercase">Top sets</div>
        <LabTable head={['Exercise', 'Top set']} align={['l', 'r']} bold={[1]} rows={st.topSets.map((t) => ({ key: t.exerciseId, cells: [exerciseName(t.exerciseId), `${t.weight ? fmt(t.weight) : 'BW'} × ${t.reps}`] }))} />
      </Card>

      {session.finishedAt && (profile.sharePosts ?? 'all') !== 'off' && (
        <p className="text-center font-mono text-xs uppercase">{profile.sharePosts === 'prs' ? 'PRs are shared to your Spotters feed.' : 'Posted to your Spotters feed.'}</p>
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
    <div className="border-2 border-ink p-2">
      <div className="font-mono text-[10px] font-bold uppercase">{label}</div>
      <div className="display mt-1 text-3xl">{value}</div>
      {sub && <div className="font-mono text-[10px] uppercase">{sub}</div>}
    </div>
  );
}
