// Weekly Lab Report insights: plain-language links between variables.
import { mean } from './util';

export interface InsightInput {
  sessionsDone: number;
  sessionsPlanned: number;
  sleepHours: number[]; // nights this week with data
  proteinDays: { logged: number; hit: number };
  e1rmChanges: { name: string; pct: number; isPress: boolean }[]; // this week vs last
  plateaued: string[];
  underVolume: string[]; // muscles under 10 sets
  /** Recent sessions (≈4 weeks): sleep the night before and performance (% e1RM change vs previous). */
  sessionsBySleep: { sleep: number; perf: number }[];
  avgReadiness: number;
  /** Calorie intake on logged days this week vs target. */
  kcal?: { logged: number; avg: number; target: number };
  /** Suggestive pre-workout carb line (only after 4+ weeks of data). */
  carbTiming?: string | null;
}

export interface Insights {
  insights: string[];
  focus: string;
}

const pct = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x * 10) / 10}%`;

export function weeklyInsights(i: InsightInput): Insights {
  const out: string[] = [];
  const missed = i.proteinDays.logged - i.proteinDays.hit;
  const stalledPress = i.e1rmChanges.filter((c) => c.isPress && c.pct <= 0).map((c) => c.name);

  if (i.proteinDays.logged >= 3 && missed >= 3) {
    out.push(
      `Protein under target ${missed} of ${i.proteinDays.logged} days` +
        (stalledPress.length ? ` — matches your stalled ${stalledPress[0]}` : ''),
    );
  }

  const good = i.sessionsBySleep.filter((s) => s.sleep >= 7.5);
  const poor = i.sessionsBySleep.filter((s) => s.sleep < 7.5);
  if (good.length >= 2 && poor.length >= 2) {
    const diff = mean(good.map((s) => s.perf)) - mean(poor.map((s) => s.perf));
    if (diff > 0.5) out.push('Your best sessions followed 7.5h+ sleep');
    else if (diff < -0.5) out.push('Sleep length did not predict your best sessions this month');
  }

  const sorted = [...i.e1rmChanges].sort((a, b) => b.pct - a.pct);
  if (sorted[0] && sorted[0].pct > 0) out.push(`${sorted[0].name} e1RM ${pct(sorted[0].pct)} this week`);
  const worst = sorted[sorted.length - 1];
  if (worst && worst.pct < -1) out.push(`${worst.name} e1RM ${pct(worst.pct)} this week`);

  const avgSleep = i.sleepHours.length ? mean(i.sleepHours) : NaN;
  if (Number.isFinite(avgSleep)) {
    const s = Math.round(avgSleep * 10) / 10;
    out.push(avgSleep < 7 ? `Averaged ${s}h sleep — under the 7h line` : `Averaged ${s}h sleep — recovery is covered`);
  }

  if (i.kcal && i.kcal.logged >= 3) {
    const d = Math.round(i.kcal.avg - i.kcal.target);
    out.push(
      Math.abs(d) <= i.kcal.target * 0.1
        ? `Calories on target: ${Math.round(i.kcal.avg)} kcal/day average`
        : `Calories averaged ${Math.abs(d)} kcal/day ${d > 0 ? 'over' : 'under'} target`,
    );
  }
  if (i.carbTiming) out.push(i.carbTiming);

  if (i.sessionsPlanned > 0) out.push(`Hit ${i.sessionsDone} of ${i.sessionsPlanned} planned sessions`);
  if (i.plateaued.length) out.push(`${i.plateaued.join(', ')} plateaued: no e1RM gain in 3 sessions`);
  if (i.underVolume.length) out.push(`${i.underVolume.slice(0, 3).join(', ')} under 10 sets this week`);
  if (out.length < 3 && Number.isFinite(i.avgReadiness)) out.push(`Average readiness ${Math.round(i.avgReadiness)}`);

  let focus: string;
  if (i.proteinDays.logged >= 3 && missed >= 3) focus = 'Hit your protein target at least 6 of 7 days.';
  else if (Number.isFinite(avgSleep) && avgSleep < 7) focus = 'Get 7.5h+ sleep on at least 5 nights.';
  else if (i.sessionsDone < i.sessionsPlanned) focus = 'Complete every planned session.';
  else if (i.underVolume.length) focus = `Add a set for ${i.underVolume[0]}.`;
  else focus = 'Same plan: push your top sets.';

  return { insights: out.slice(0, 5), focus };
}
