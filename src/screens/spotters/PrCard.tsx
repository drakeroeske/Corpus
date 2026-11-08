import { useState } from 'react';
import { addDays, mean } from '../../engine';
import { db, todayKey } from '../../data/db';
import { exerciseName } from '../../data/exercises';
import { color, font } from '../../theme/tokens';
import { Button, Sheet, fmt } from '../../components/ui';

/** Draw a 1080×1080 PR card and return it as a PNG blob. */
export async function makePrCard(p: { lift: string; weight: number; reps: number; e1rm: number; units: string; why: string }): Promise<Blob> {
  await Promise.all([document.fonts.load(`700 80px ${font.head}`), document.fonts.load(`600 80px ${font.mono}`)]).catch(() => {});
  const S = 1080;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = color.bg;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = color.border;
  g.lineWidth = 4;
  g.strokeRect(40, 40, S - 80, S - 80);

  g.fillStyle = color.lime;
  g.fillRect(80, 80, 24, 24);
  g.font = `700 44px ${font.head}`;
  g.fillStyle = color.text;
  g.fillText('CORPUS', 124, 104);
  g.font = `600 30px ${font.mono}`;
  g.fillStyle = color.lime;
  g.textAlign = 'right';
  g.fillText('NEW PR', S - 80, 104);
  g.textAlign = 'left';

  g.fillStyle = color.muted;
  g.font = `500 52px ${font.head}`;
  g.fillText(p.lift, 80, 340);
  g.fillStyle = color.text;
  g.font = `600 150px ${font.mono}`;
  g.fillText(`${fmt(p.weight)}×${p.reps}`, 80, 510);
  g.font = `600 44px ${font.mono}`;
  g.fillStyle = color.muted;
  g.fillText(p.units, 86, 575);

  g.fillStyle = color.lime;
  g.fillRect(80, 650, S - 160, 4);
  g.font = `500 36px ${font.head}`;
  g.fillStyle = color.muted;
  g.fillText('Estimated 1RM', 80, 730);
  g.font = `600 96px ${font.mono}`;
  g.fillStyle = color.lime;
  g.fillText(`${p.e1rm}`, 80, 840);

  g.font = `500 34px ${font.head}`;
  g.fillStyle = color.text;
  g.fillText(p.why, 80, 960);

  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
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
    const blob = await makePrCard({ lift: exerciseName(exerciseId), weight, reps, e1rm, units, why: await whyStat() });
    setCard({ blob, url: URL.createObjectURL(blob) });
    setBusy(false);
  };

  const share = async () => {
    if (!card) return;
    const file = new File([card.blob], `corpus-pr-${exerciseId}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'New PR' }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = card.url;
      a.download = file.name;
      a.click();
    }
  };

  return (
    <>
      <Button variant="ghost" className="shrink-0 text-sm" onClick={open} disabled={busy}>
        {busy ? '…' : 'PR card'}
      </Button>
      {card && (
        <Sheet title="PR card" onClose={() => setCard(null)}>
          <img src={card.url} alt="PR card" className="w-full rounded-xl border border-line" />
          <Button className="mt-4 h-14 w-full text-lg" onClick={share}>
            Share or save
          </Button>
        </Sheet>
      )}
    </>
  );
}
