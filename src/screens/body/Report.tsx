import { todayKey } from '../../data/db';
import { useData } from '../../data/repo';
import { weeklyReport } from '../../data/report';
import { exerciseName } from '../../data/exercises';
import { Card, fmt, prettyDate } from '../../components/ui';
import { Stat } from '../train/Train';

export default function Report() {
  const data = useData();
  if (!data) return null;
  const r = weeklyReport(data, todayKey());
  const u = data.profile.units;

  return (
    <div className="space-y-4">
      <div className="text-sm text-mute">
        Weekly Lab Report · {prettyDate(r.from)} – {prettyDate(r.to)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Sessions" value={`${r.done}/${r.planned}`} />
        <Stat label="Readiness" value={String(r.avgReadiness)} />
        <Stat label="Sleep" value={Number.isFinite(r.avgSleep) ? `${r.avgSleep}h` : '–'} />
        <Stat label={`Volume ${u}`} value={r.volume.toLocaleString()} />
        <Stat label="Protein" value={`${r.proteinHit}/${r.daysLogged}`} sub="days hit" />
        <Stat label="Calories" value={`${r.kcalOnTarget}/${r.daysLogged}`} sub="within 10%" />
      </div>

      <Card>
        <div className="mb-2 font-bold">Insights</div>
        <ul className="space-y-2">
          {r.insights.map((t) => (
            <li key={t} className="flex gap-2 text-sm">
              <span className="text-lime">›</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-xl border border-lime/60 p-3">
          <div className="text-xs uppercase tracking-wide text-mute">Focus for next week</div>
          <div className="font-bold">{r.focus}</div>
        </div>
      </Card>

      {r.prs.length > 0 && (
        <Card>
          <div className="mb-2 font-bold">PRs</div>
          {r.prs.map((p, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{exerciseName(p.exerciseId)}</span>
              <span className="font-mono">
                {fmt(p.weight)} × {p.reps} · {p.e1rm}
              </span>
            </div>
          ))}
        </Card>
      )}

      {r.changes.length > 0 && (
        <Card>
          <div className="mb-2 font-bold">e1RM vs last week</div>
          {r.changes.map((c) => (
            <div key={c.exerciseId} className="flex justify-between text-sm">
              <span>{c.name}</span>
              <span className={`font-mono ${c.pct > 0 ? 'text-lime' : c.pct < 0 ? 'text-warn' : 'text-mute'}`}>
                {c.pct > 0 ? '+' : ''}
                {c.pct}%
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
