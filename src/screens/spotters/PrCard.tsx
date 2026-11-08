import { useState } from 'react';
import { addDays, e1rm as calcE1rm, mean } from '../../engine';
import { db, todayKey } from '../../data/db';
import { exerciseName } from '../../data/exercises';
import { sessionStats } from '../../data/plan';
import { color, font } from '../../theme/tokens';
import { Button, Sheet, fmt } from '../../components/ui';
import { Surface, pad3 } from '../../components/riso';
import { bakeGrain, drawDiagram, drawLogo, loadRisoFonts, risoCanvas, sharePng, toPng } from '../../lib/risoCanvas';

/** Draw a 1080×1080 Riso PR card (bone, pink band, diagram, number, lift, weight, delta, why) as PNG. */
export async function makePrCard(p: { no: number; lift: string; weight: number; reps: number; e1rm: number; prev: number | null; units: string; why: string }): Promise<Blob> {
  await loadRisoFonts();
  const { c, g, S } = risoCanvas();
  const ink = color.cobalt;
  const U = p.units.toUpperCase();

  // pink header band
  g.fillStyle = color.signal;
  g.fillRect(0, 0, S, 230);
  g.fillStyle = ink;
  g.fillRect(0, 230, S, 6);
  g.font = `700 26px ${font.mono}`;
  g.fillText('SPOTTER // PR', 60, 70);
  g.textAlign = 'right';
  g.fillText(`PR CARD Nº ${pad3(p.no)}`, S - 60, 70);
  g.textAlign = 'left';
  g.font = `150px ${font.archivo}`;
  g.fillText('NEW PR.', 52, 200);

  // diagram
  drawDiagram(g, 820, 520, 190, ink);

  // lift + weight + delta
  g.fillStyle = ink;
  g.font = `700 34px ${font.mono}`;
  g.fillText(p.lift.toUpperCase(), 60, 320);
  g.font = `190px ${font.archivo}`;
  g.fillText(`${fmt(p.weight)}`, 52, 500);
  g.font = `700 54px ${font.mono}`;
  g.fillText(`${U} × ${p.reps}`, 60, 570);

  g.fillRect(60, 640, S - 120, 3);
  g.font = `700 30px ${font.mono}`;
  const delta = p.prev !== null ? `PREV ${p.prev} · +${Math.round((p.e1rm - p.prev) * 10) / 10} ${U}` : 'FIRST LOGGED BEST';
  g.fillText(`e1RM ${p.e1rm} ${U}`, 60, 700);
  g.fillText(delta, 60, 745);
  g.fillText('VERIFIED BY CORPUS', 60, 790);
  g.font = `400 30px ${font.mono}`;
  g.fillText(`WHY: ${p.why.toUpperCase()}`, 60, 860);

  // footer wordmark + mark
  g.fillRect(60, 920, S - 120, 3);
  drawLogo(g, 60, 950, 80, ink);
  g.font = `64px ${font.archivo}`;
  g.fillText('CORPUS', 160, 1015);
  g.font = `700 22px ${font.mono}`;
  g.textAlign = 'right';
  g.fillText(todayKey().split('-').reverse().join('.'), S - 60, 1010);
  g.textAlign = 'left';

  bakeGrain(g, S, 0.25);
  return toPng(c);
}

/** One "why" stat from the past week. */
async function whyStat(): Promise<string> {
  const today = todayKey();
  const cis = (await db.checkins.toArray()).filter((c) => c.date > addDays(today, -7));
  const sleep = cis.filter((c) => c.sleepHours !== undefined).map((c) => c.sleepHours!);
  if (sleep.length) return `avg sleep ${Math.round(mean(sleep) * 10) / 10}h this week`;
  const sessions = (await db.sessions.toArray()).filter((s) => s.date > addDays(today, -7) && s.finishedAt);
  return `${sessions.length} sessions this week`;
}

export function PrCardButton({ exerciseId, weight, reps, e1rm }: { exerciseId: string; weight: number; reps: number; e1rm: number }) {
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    const units = (await db.profile.get('me'))?.units ?? 'lb';
    const sessions = await db.sessions.toArray();
    const no = Math.max(1, sessions.reduce((a, s) => a + (s.finishedAt ? sessionStats(s, sessions).prs.length : 0), 0));
    const below = sessions.flatMap((s) => s.sets).filter((x) => x.exerciseId === exerciseId && !x.isWarmup && x.weight > 0).map((x) => calcE1rm(x.weight, x.reps)).filter((v) => v < e1rm);
    const blob = await makePrCard({ no, lift: exerciseName(exerciseId), weight, reps, e1rm, prev: below.length ? Math.max(...below) : null, units, why: await whyStat() });
    setCard({ blob, url: URL.createObjectURL(blob) });
    setBusy(false);
  };

  return (
    <>
      <Button variant="social" className="shrink-0" onClick={open} disabled={busy}>
        {busy ? '…' : 'PR card'}
      </Button>
      {card && (
        <Surface style="riso">
          <Sheet title="PR card" onClose={() => setCard(null)}>
            <img src={card.url} alt="PR card" className="w-full border-2 border-ink" />
            <Button className="mt-4 min-h-14 w-full" onClick={() => sharePng(card.blob, `corpus-pr-${exerciseId}.png`, 'New PR')}>
              Share or save
            </Button>
          </Sheet>
        </Surface>
      )}
    </>
  );
}
