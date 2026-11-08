import { Route, Routes, useNavigate } from 'react-router-dom';
import { todayKey } from '../../data/db';
import { startSession, useData } from '../../data/repo';
import { buildPlan, dayForDate, deloadAlert, hrvHistory, plateauAlerts, proteinTarget, readinessOn } from '../../data/plan';
import { exerciseName } from '../../data/exercises';
import { DELOAD_PRESCRIPTION, breakPhase, type Target } from '../../engine';
import { Button, Card, PageHeader, fmt } from '../../components/ui';
import { LabTable, Meter, NoteLine, Tag } from '../../components/riso';
import { Rings } from '../../components/diagrams';
import CheckInSheet from './CheckIn';
import Fuel from './Fuel';

export default function Today() {
  return (
    <Routes>
      <Route index element={<TodayHome />} />
      <Route
        path="checkin"
        element={
          <>
            <TodayHome />
            <CheckInSheet />
          </>
        }
      />
      <Route path="fuel" element={<Fuel />} />
    </Routes>
  );
}

const EFFECT = {
  normal: 'Normal progression today.',
  moderate: 'Readiness moderate — holding weights.',
  low: 'Targets cut 10%, stop 3 reps short.',
};
const VERDICT = { normal: 'RECOVERY OK — PROGRESSION APPROVED.', moderate: 'RECOVERY MODERATE — HOLDING WEIGHTS.', low: 'RECOVERY LOW — TARGETS CUT 10%.' };

/** NEXT column: +2.5 ↑, +1 REP, HOLD… and whether it is a progression (bold). */
function nextLabel(t: Target): [string, boolean] {
  const d = t.weight !== null && t.baseWeight !== null ? Math.round((t.weight - t.baseWeight) * 100) / 100 : 0;
  switch (t.action) {
    case 'increase':
    case 'add-load':
      return [d > 0 ? `+${fmt(d)} ↑` : '+LOAD ↑', true];
    case 'repeat':
      return ['+1 REP', true];
    case 'hold':
      return ['HOLD', false];
    case 'deload':
      return [d < 0 ? `${fmt(d)} ↓` : 'DELOAD ↓', false];
    case 'start':
      return ['START', false];
    default:
      return ['SET WT', false];
  }
}

const hm = (h: number) => `${Math.floor(h)}H${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

function TodayHome() {
  const nav = useNavigate();
  const data = useData();
  if (!data) return null;
  const { profile, days, sessions, checkins, meals } = data;
  const today = todayKey();
  const day = dayForDate(days, today);
  const checkin = checkins.find((c) => c.date === today);
  const plan = day ? buildPlan(day, sessions, checkin, hrvHistory(checkins, today), profile, today) : null;
  const readiness = plan?.readiness ?? readinessOn(today, checkins, days);
  const phase = breakPhase(profile.returnFromBreakStart, today);
  const plateaus = plateauAlerts(days, sessions, checkins, today, { meals, profile, days });
  const deload = deloadAlert(days, sessions, checkins, today, { meals, profile, days });
  const todaysSession = day ? sessions.find((s) => s.date === today && s.programDayId === day.id) : undefined;

  const targets = proteinTarget(profile, !!day);
  const eaten = meals.filter((m) => m.date === today);
  const kcal = eaten.reduce((a, m) => a + m.kcal, 0);
  const protein = eaten.reduce((a, m) => a + m.protein, 0);
  const note = [
    checkin?.sleepHours !== undefined ? `SLEEP ${hm(checkin.sleepHours)}` : 'SLEEP —',
    checkin?.steps !== undefined ? `STEPS ${(checkin.steps / 1000).toFixed(1)}K` : null,
    checkin?.hrv !== undefined ? `HRV ${checkin.hrv}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4">
      <PageHeader
        title={day ? day.name : 'Rest day'}
        status={todaysSession && !todaysSession.finishedAt ? `${day!.name.toUpperCase()} [LIVE]` : undefined}
        sub={phase && phase.name !== 'Done' ? <Tag>RETURN: {phase.name.toUpperCase()} WK {phase.week}</Tag> : undefined}
      />

      <Card>
        <div className="flex items-center gap-4">
          <Rings value={readiness.score} size={136} label={`Readiness ${readiness.score} of 100`}>
            <span className="display bg-page px-1 text-5xl">{readiness.score}</span>
          </Rings>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold uppercase">Readiness</div>
            <Tag>CONFIDENCE: {readiness.confidence.toUpperCase()}</Tag>
            <div className="mt-2 font-mono text-sm">{readiness.reason}</div>
            {day && <div className="mt-1 font-mono text-xs uppercase">{EFFECT[readiness.level]}</div>}
          </div>
        </div>
        <div className="mt-3 border-t border-dashed border-ink pt-2">
          <NoteLine>
            {note} — {VERDICT[readiness.level]}
          </NoteLine>
        </div>
      </Card>

      {deload.deload && (
        <div className="hatch border-2 border-ink p-1">
          <div className="bg-page p-3">
            <Tag>DELOAD</Tag>
            <div className="mt-1 font-mono text-sm">
              {deload.reason}. {DELOAD_PRESCRIPTION}
            </div>
          </div>
        </div>
      )}
      {plateaus.length > 0 && (
        <div className="hatch border-2 border-ink p-1">
          <div className="space-y-1 bg-page p-3">
            <Tag>PLATEAU</Tag>
            {plateaus.map((p) => (
              <div key={p.exerciseId} className="font-mono text-sm">
                {exerciseName(p.exerciseId)}: no e1RM gain in 3 sessions → <span className="font-bold uppercase">{p.fix}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan && (
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] font-bold uppercase">
            <span>Today's session</span>
            <span>{plan.items.length} exercises</span>
          </div>
          <LabTable
            head={['Exercise', 'Sets', 'Next']}
            align={['l', 'r', 'r']}
            rows={plan.items.map(({ ex, pe, target }) => {
              const [next, prog] = nextLabel(target);
              const effort = [target.rirCap !== undefined ? `${target.rirCap} RIR` : '', target.technique !== 'none' ? target.technique : ''].filter(Boolean).join(' · ');
              return {
                key: pe.exerciseId,
                cells: [
                  <div>
                    <div className="uppercase">{ex.name}</div>
                    {effort && <div className="text-[10px] uppercase">[{effort}]</div>}
                  </div>,
                  <span className="whitespace-nowrap">
                    {pe.sets}× {ex.equipment === 'bodyweight' ? 'BW' : target.weight === null ? '?' : fmt(target.weight)} × {pe.repMin}–{pe.repMax}
                  </span>,
                  <span className={`whitespace-nowrap ${prog ? 'font-bold' : ''}`}>{next}</span>,
                ],
              };
            })}
          />
        </div>
      )}

      <Card onClick={() => nav('/today/fuel')} className="space-y-3">
        <div className="flex justify-between font-mono text-[10px] font-bold uppercase">
          <span>Fuel</span>
          <span>Tap to log food →</span>
        </div>
        <Meter label="kcal" value={kcal} max={targets.kcal} />
        <Meter label="Protein" value={protein} max={targets.protein} unit=" g" />
      </Card>

      <div className="flex gap-2">
        <Button variant={checkin ? 'ghost' : 'primary'} className="min-h-14 flex-1" onClick={() => nav('/today/checkin')}>
          {checkin ? 'Edit check-in' : 'Check in'}
        </Button>
        {day ? (
          <Button
            variant={checkin ? 'primary' : 'ghost'}
            className="min-h-14 flex-1"
            onClick={async () => nav(todaysSession?.finishedAt ? `/train/session/${todaysSession.id}` : `/train/workout/${await startSession(day.id)}`)}
          >
            {todaysSession?.finishedAt ? 'View workout' : todaysSession ? 'Continue' : 'Start workout'}
          </Button>
        ) : (
          <Button variant="ghost" className="min-h-14 flex-1" onClick={() => nav('/train')}>
            Train anyway
          </Button>
        )}
      </div>
    </div>
  );
}
