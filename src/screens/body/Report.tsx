import { todayKey } from '../../data/db';
import { useData } from '../../data/repo';
import { weeklyReport } from '../../data/report';
import { exerciseName } from '../../data/exercises';
import { Card, fmt } from '../../components/ui';
import { Grain, LabTable, Tag, pad3, shortDate } from '../../components/riso';
import { daysBetween } from '../../engine';
import { Stat } from '../train/Train';

export default function Report() {
  const data = useData();
  if (!data) return null;
  const r = weeklyReport(data, todayKey());
  const u = data.profile.units;
  const no = Math.max(1, Math.floor(daysBetween(data.profile.programStartDate, r.to) / 7) + 1);

  return (
    <div className="space-y-4">
      <div className="relative border-2 border-ink p-4">
        <Grain />
        <div className="relative flex justify-between font-mono text-[10px] font-bold uppercase">
          <span>Weekly lab report</span>
          <span>Report Nº {pad3(no)}</span>
        </div>
        <div className="display relative mt-2 text-5xl">Week {no}.</div>
        <div className="relative mt-1 font-mono text-xs uppercase">
          {shortDate(r.from)} – {shortDate(r.to)} · Subject: {data.profile.name}
        </div>
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
        <div className="mb-2 font-mono text-[10px] font-bold uppercase">Findings</div>
        <ol className="rows border-t-[3px] border-ink">
          {r.insights.map((t, i) => (
            <li key={t} className="flex gap-3 py-2 font-mono text-sm">
              <span className="shrink-0 font-bold">{String(i + 1).padStart(2, '0')} /</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <div className="hatch mt-3 border-2 border-ink p-1">
          <div className="bg-page p-2">
            <Tag>Focus</Tag>
            <div className="mt-1 font-mono text-sm font-bold uppercase">{r.focus}</div>
          </div>
        </div>
      </Card>

      {r.prs.length > 0 && (
        <Card>
          <div className="mb-2 font-mono text-[10px] font-bold uppercase">Personal records</div>
          <LabTable
            head={['Lift', 'Set', 'e1RM', '']}
            align={['l', 'r', 'r', 'r']}
            bold={[2]}
            rows={r.prs.map((p, i) => ({ key: String(i), cells: [exerciseName(p.exerciseId), `${fmt(p.weight)} × ${p.reps}`, p.e1rm, <Tag signal>PR</Tag>] }))}
          />
        </Card>
      )}

      {r.changes.length > 0 && (
        <Card>
          <div className="mb-2 font-mono text-[10px] font-bold uppercase">e1RM vs last week</div>
          <LabTable
            head={['Lift', 'Change']}
            align={['l', 'r']}
            bold={[1]}
            rows={r.changes.map((c) => ({ key: c.exerciseId, cells: [c.name, `${c.pct > 0 ? '+' : ''}${c.pct}% ${c.pct > 0 ? '↑' : c.pct < 0 ? '↓' : ''}`] }))}
          />
        </Card>
      )}
    </div>
  );
}
