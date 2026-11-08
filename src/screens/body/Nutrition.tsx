// Body → Nutrition trends: 7/30-day averages, adherence calendar, macro split, adaptive TDEE.
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { todayKey } from '../../data/db';
import { useData } from '../../data/repo';
import { dailyIntake, dayForDate, proteinTarget, tdeeDays } from '../../data/plan';
import { adaptiveTdee, addDays, dayAdherence, mean, weekday, type DayAdherence } from '../../engine';
import { Card, fmt, prettyDate } from '../../components/ui';
import { chart as cs, color } from '../../theme/tokens';
import { FigCaption, SquareDot } from '../../components/riso';

const ADH_CLASS: Record<DayAdherence, string> = { hit: 'bg-ink text-page', close: 'hatch', miss: 'border-dashed', none: '' };
const ADH_TAG: Record<DayAdherence, string> = { hit: 'HIT', close: 'CLOSE', miss: 'MISS', none: '—' };
const tick = cs.tick;

export default function Nutrition() {
  const data = useData();
  if (!data) return null;
  const { meals, profile, days, checkins } = data;
  const today = todayKey();
  const intake = dailyIntake(meals);
  const target = (d: string) => proteinTarget(profile, !!dayForDate(days, d));

  const avg = (n: number) => {
    const logged = Array.from({ length: n }, (_, i) => addDays(today, -i)).filter((d) => (intake.get(d)?.kcal ?? 0) > 0);
    const m = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => Math.round(mean(logged.map((d) => intake.get(d)![k])));
    const t = (k: 'kcal' | 'protein') => Math.round(mean(logged.map((d) => target(d)[k])));
    const hit = logged.filter((d) => intake.get(d)!.protein >= target(d).protein).length;
    return { logged: logged.length, kcal: m('kcal'), protein: m('protein'), carbs: m('carbs'), fat: m('fat'), tK: t('kcal'), tP: t('protein'), hit };
  };
  const a7 = avg(7);
  const a30 = avg(30);

  // 5-week calendar ending this week (Mon–Sun rows)
  const end = addDays(today, (7 - weekday(today)) % 7);
  const cal = Array.from({ length: 35 }, (_, i) => addDays(end, i - 34));

  const split = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => {
    const n = intake.get(d);
    return { date: d.slice(5), Protein: Math.round((n?.protein ?? 0) * 4), Carbs: Math.round((n?.carbs ?? 0) * 4), Fat: Math.round((n?.fat ?? 0) * 9) };
  });

  const est = adaptiveTdee(tdeeDays(meals, checkins, profile.units), today);
  const tdeeChart = est?.weekly.map((w) => {
    const wk = Array.from({ length: 7 }, (_, i) => intake.get(addDays(w.date, -i))?.kcal ?? 0).filter((k) => k > 0);
    return { date: w.date.slice(5), Maintenance: w.tdee, Intake: wk.length ? Math.round(mean(wk)) : null };
  });

  return (
    <div className="space-y-4">
      <Card>
        <FigCaption n={4} title="Intake averages" stat="VALUE / TARGET" />
        <table className="w-full border-t-[3px] border-ink font-mono text-sm">
          <thead className="text-xs text-ink">
            <tr className="border-b border-ink text-[10px] uppercase"><th className="text-left font-bold">Metric</th><th className="text-right font-bold">7 days</th><th className="text-right font-bold">30 days</th></tr>
          </thead>
          <tbody>
            {([
              ['kcal', `${fmt(a7.kcal)} / ${fmt(a7.tK)}`, `${fmt(a30.kcal)} / ${fmt(a30.tK)}`],
              ['Protein g', `${fmt(a7.protein)} / ${fmt(a7.tP)}`, `${fmt(a30.protein)} / ${fmt(a30.tP)}`],
              ['Carbs g', fmt(a7.carbs), fmt(a30.carbs)],
              ['Fat g', fmt(a7.fat), fmt(a30.fat)],
              ['Protein hit', `${a7.hit}/${a7.logged}`, `${a30.hit}/${a30.logged}`],
            ] as const).map(([k, x, y]) => (
              <tr key={k} className="border-t border-dashed border-ink first:border-t-0"><td className="py-1 text-xs uppercase">{k}</td><td className="text-right">{x}</td><td className="text-right">{y}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-1 font-mono text-[10px] uppercase">Logged days only.</div>
      </Card>

      <Card>
        <FigCaption n={5} title="Adherence / 5 weeks" />
        <div className="grid grid-cols-7 gap-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="text-center text-xs text-ink">{d}</div>)}
          {cal.map((d) => {
            const st = d > today ? 'none' : dayAdherence(intake.get(d), target(d));
            return (
              <div
                key={d}
                title={`${prettyDate(d)}: ${st}`}
                aria-label={`${prettyDate(d)} ${ADH_TAG[st]}`}
                className={`flex aspect-square items-center justify-center border border-ink font-mono text-xs ${d > today ? 'border-dotted' : ''} ${ADH_CLASS[st]}`}
              >
                {Number(d.slice(8))}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] font-bold uppercase">
          <span><span className="inline-block h-3 w-3 border border-ink bg-ink align-middle" /> Hit</span>
          <span><span className="hatch inline-block h-3 w-3 border border-ink align-middle" /> Close</span>
          <span><span className="inline-block h-3 w-3 border border-dashed border-ink align-middle" /> Missed</span>
          <span><span className="inline-block h-3 w-3 border border-ink align-middle" /> None</span>
        </div>
      </Card>

      <Card>
        <FigCaption n={6} title="Macro split / kcal" stat="14 DAYS" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={split}>
            <defs>
              <pattern id="carbHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="5" stroke={color.ink} strokeWidth="1.5" />
              </pattern>
            </defs>
            <CartesianGrid {...cs.grid} vertical={false} />
            <XAxis dataKey="date" tick={tick} interval={2} />
            <YAxis tick={tick} width={36} />
            <Tooltip contentStyle={cs.tooltip} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'Space Mono', textTransform: 'uppercase' }} iconType="square" />
            <Bar dataKey="Protein" stackId="m" fill={color.ink} stroke={color.ink} isAnimationActive={false} />
            <Bar dataKey="Carbs" stackId="m" fill="url(#carbHatch)" stroke={color.ink} isAnimationActive={false} />
            <Bar dataKey="Fat" stackId="m" fill={color.paper} stroke={color.ink} strokeWidth={1.5} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <FigCaption n={7} title="Adaptive maintenance" stat={est ? `[CONFIDENCE: ${est.confidence.toUpperCase()}]` : undefined} />
        {est && tdeeChart ? (
          <>
            <div className="mb-2 text-sm">
              Estimated maintenance: <span className="display text-3xl">{est.tdee}</span> kcal
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={tdeeChart}>
                <CartesianGrid {...cs.grid} vertical={false} />
                <XAxis dataKey="date" tick={tick} />
                <YAxis tick={tick} width={40} domain={['dataMin - 200', 'dataMax + 200']} />
                <Tooltip contentStyle={cs.tooltip} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'Space Mono', textTransform: 'uppercase' }} iconType="square" />
                <Line dataKey="Maintenance" stroke={color.ink} dot={<SquareDot />} strokeWidth={2} isAnimationActive={false} />
                <Line dataKey="Intake" stroke={color.ink} dot={false} strokeWidth={2} strokeDasharray="5 4" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-xs text-ink">Maintenance ≈ average intake − weight trend × 7700 kcal/kg, smoothed weekly.</div>
          </>
        ) : (
          <p className="text-sm text-ink">Log food and morning weight for 14+ days to estimate your maintenance calories.</p>
        )}
      </Card>
    </div>
  );
}
