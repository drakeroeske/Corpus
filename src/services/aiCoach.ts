// AI Coach behind an interface. v1 answers with rules built from engine outputs;
// a real LLM can implement `AiCoach` later and receive the same context.

export interface CoachContext {
  readiness: { score: number; reason: string; confidence: string };
  todayTargets: string[]; // "Bench Press 185 × 6–8 · stop at 2 RIR"
  plateaus: { name: string; fix: string }[];
  deload: { deload: boolean; reason: string };
  protein: { hit: number; logged: number; target: number };
  avgSleep: number;
  insights: string[];
  focus: string;
  lifts: { name: string; e1rm: number; changePct?: number }[];
  fatigued: string[]; // muscles above 60%
  units: string;
}

export interface AiCoach {
  ask(question: string, ctx: CoachContext): Promise<string>;
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

export function ruleBasedAnswer(question: string, ctx: CoachContext): string {
  const q = question.toLowerCase();
  const lift = ctx.lifts.find((l) => q.includes(l.name.toLowerCase()) || l.name.toLowerCase().split(' ').some((w) => w.length > 3 && q.includes(w)));
  const sleepLine = Number.isFinite(ctx.avgSleep) ? `You averaged ${ctx.avgSleep}h sleep this week.` : 'Log sleep in your check-in so I can factor it in.';
  const proteinLine = ctx.protein.logged
    ? `Protein hit ${ctx.protein.hit} of ${ctx.protein.logged} logged days (target ${ctx.protein.target} g).`
    : 'No meals logged this week, so I can\'t judge protein.';

  if (has(q, 'stall', 'plateau', 'stuck', 'not going up', 'progress on')) {
    const p = lift ? ctx.plateaus.find((x) => x.name === lift.name) : ctx.plateaus[0];
    if (p) return `${p.name} has had no e1RM gain in 3 sessions — that's the plateau flag. ${proteinLine} ${sleepLine} Suggested fix: ${p.fix}.`;
    if (lift) return `${lift.name} isn't flagged as plateaued (e1RM ${lift.e1rm} ${ctx.units}${lift.changePct !== undefined ? `, ${lift.changePct > 0 ? '+' : ''}${lift.changePct}% this week` : ''}). ${proteinLine} ${sleepLine}`;
    return `No lifts are flagged as plateaued right now. ${proteinLine} ${sleepLine}`;
  }
  if (has(q, 'deload')) {
    return ctx.deload.deload ? `Yes — ${ctx.deload.reason}. Take a week at 60% of your usual sets with the same weights.` : 'No deload needed: readiness and progress are holding up.';
  }
  if (has(q, 'readiness', 'tired', 'recover', 'sore', 'fatigue')) {
    const f = ctx.fatigued.length ? ` Still recovering: ${ctx.fatigued.join(', ')}.` : '';
    return `Readiness today is ${ctx.readiness.score} (${ctx.readiness.confidence} confidence): ${ctx.readiness.reason}.${f}`;
  }
  if (has(q, 'protein', 'eat', 'calorie', 'diet', 'food', 'nutrition')) return `${proteinLine} Spread it over 3–5 meals of 30–50 g.`;
  if (has(q, 'sleep')) return `${sleepLine} ${ctx.insights.find((i) => /sleep/i.test(i)) ?? 'Aim for 7.5h+ — it shortens muscle recovery from 48h to 36h in your fatigue model.'}`;
  if (has(q, 'today', 'what should i', 'workout', 'lift today')) {
    return ctx.todayTargets.length ? `Today: ${ctx.todayTargets.join('; ')}.` : 'Rest day on your program. Walk, eat your protein, sleep well.';
  }
  if (has(q, 'how am i', 'week', 'doing', 'report')) return `${ctx.insights.join('. ')}. Focus next week: ${ctx.focus}`;
  if (lift) return `${lift.name}: e1RM ${lift.e1rm} ${ctx.units}${lift.changePct !== undefined ? `, ${lift.changePct > 0 ? '+' : ''}${lift.changePct}% vs last week` : ''}.`;
  return 'I can answer questions about stalls and plateaus, readiness, deloads, protein, sleep, today\'s workout, or how your week went.';
}

export const ruleBasedCoach: AiCoach = {
  async ask(question, ctx) {
    await new Promise((r) => setTimeout(r, 300));
    return ruleBasedAnswer(question, ctx);
  },
};

export const aiCoach: AiCoach = ruleBasedCoach;
