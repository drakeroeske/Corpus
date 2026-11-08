import { Route, Routes, useNavigate } from 'react-router-dom';
import { todayKey } from '../../data/db';
import { startSession, useData } from '../../data/repo';
import { buildPlan, dayForDate, deloadAlert, hrvHistory, plateauAlerts, proteinTarget, readinessOn } from '../../data/plan';
import { exerciseName } from '../../data/exercises';
import { DELOAD_PRESCRIPTION, breakPhase } from '../../engine';
import { Button, Card, Ring, fmt, prettyDate } from '../../components/ui';
import { color } from '../../theme/tokens';
import CheckInSheet from './CheckIn';
import Nutrition from './Nutrition';

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
      <Route path="nutrition" element={<Nutrition />} />
    </Routes>
  );
}

const EFFECT = {
  normal: 'Normal progression today.',
  moderate: 'Readiness moderate — holding weights.',
  low: 'Targets cut 10%, stop 3 reps short.',
};

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
  const plateaus = plateauAlerts(days, sessions, checkins, today);
  const deload = deloadAlert(days, sessions, checkins, today);
  const todaysSession = day ? sessions.find((s) => s.date === today && s.programDayId === day.id) : undefined;

  const targets = proteinTarget(profile, !!day);
  const eaten = meals.filter((m) => m.date === today);
  const kcal = eaten.reduce((a, m) => a + m.kcal, 0);
  const protein = eaten.reduce((a, m) => a + m.protein, 0);
  const ringColor = readiness.level === 'normal' ? color.lime : readiness.level === 'moderate' ? color.info : color.warn;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-mute">{prettyDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-bold">{day?.name ?? 'Rest day'}</h1>
          {phase && phase.name !== 'Done' && (
            <span className="shrink-0 rounded-full border border-info px-3 py-1 text-xs text-info">
              Return: {phase.name} wk {phase.week}
            </span>
          )}
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-4">
          <Ring value={readiness.score} max={100} size={104} ringColor={ringColor} center={<span className="text-3xl">{readiness.score}</span>} />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-mute">Readiness · {readiness.confidence} confidence</div>
            <div className="mt-1">{readiness.reason}</div>
            {day && <div className="mt-1 text-sm text-mute">{EFFECT[readiness.level]}</div>}
          </div>
        </div>
      </Card>

      {deload.deload && (
        <Card className="border-warn">
          <div className="font-bold text-warn">Deload recommended</div>
          <div className="text-sm">{deload.reason}. {DELOAD_PRESCRIPTION}</div>
        </Card>
      )}
      {plateaus.length > 0 && (
        <Card className="border-warn/60">
          <div className="mb-1 font-bold text-warn">Plateau{plateaus.length > 1 ? 's' : ''}</div>
          {plateaus.map((p) => (
            <div key={p.exerciseId} className="text-sm">
              {exerciseName(p.exerciseId)}: no e1RM gain in 3 sessions → <span className="text-ink">{p.fix}</span>
            </div>
          ))}
        </Card>
      )}

      {plan && (
        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-bold">Today's targets</span>
            <span className="text-xs text-mute">{plan.items.length} exercises</span>
          </div>
          <ul className="space-y-2">
            {plan.items.map(({ ex, pe, target }) => (
              <li key={pe.exerciseId} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span>{ex.name}</span>
                  <span className="shrink-0 font-mono">
                    {pe.sets}× {ex.equipment === 'bodyweight' ? 'BW' : target.weight === null ? '?' : fmt(target.weight)} × {pe.repMin}–{pe.repMax}
                  </span>
                </div>
                {(target.rirCap !== undefined || target.technique !== 'none') && (
                  <div className="text-right font-mono text-xs text-mute">
                    {[target.rirCap !== undefined ? `stop at ${target.rirCap} RIR` : '', target.technique !== 'none' ? target.technique : ''].filter(Boolean).join(' · ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card onClick={() => nav('/today/nutrition')}>
        <div className="flex items-center justify-around">
          <Ring value={kcal} max={targets.kcal} label={`of ${targets.kcal} kcal`} center={<span className="text-lg">{kcal}</span>} />
          <Ring value={protein} max={targets.protein} ringColor={color.info} label={`of ${targets.protein} g protein`} center={<span className="text-lg">{protein}</span>} />
        </div>
        <div className="mt-2 text-center text-xs text-mute">Tap to log food</div>
      </Card>

      <div className="flex gap-2">
        <Button variant={checkin ? 'ghost' : 'primary'} className="h-14 flex-1" onClick={() => nav('/today/checkin')}>
          {checkin ? 'Edit check-in' : 'Check in'}
        </Button>
        {day ? (
          <Button
            variant={checkin ? 'primary' : 'ghost'}
            className="h-14 flex-1"
            onClick={async () => nav(todaysSession?.finishedAt ? `/train/session/${todaysSession.id}` : `/train/workout/${await startSession(day.id)}`)}
          >
            {todaysSession?.finishedAt ? 'View workout' : todaysSession ? 'Continue' : 'Start workout'}
          </Button>
        ) : (
          <Button variant="ghost" className="h-14 flex-1" onClick={() => nav('/train')}>
            Train anyway
          </Button>
        )}
      </div>
    </div>
  );
}
