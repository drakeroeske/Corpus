// Onboarding pledge (Riso): a manifesto signed by holding a button for 1.5 s. Saved with date; shareable PNG.
import { useEffect, useRef, useState } from 'react';
import { saveProfile, useProfile } from '../../data/repo';
import { todayKey } from '../../data/db';
import { Button, PageHeader } from '../../components/ui';
import { Grain, Surface, shortDate } from '../../components/riso';
import { Rings } from '../../components/diagrams';
import { color, font } from '../../theme/tokens';
import { bakeGrain, drawDiagram, drawLogo, loadRisoFonts, risoCanvas, sharePng, toPng } from '../../lib/risoCanvas';

export const PLEDGE = ['I WILL LOG EVERY SESSION.', 'I WILL NOT SKIP LEGS.', "I WILL SLEEP LIKE IT'S TRAINING.", 'I WILL TRUST THE DATA.'];
const HOLD_MS = 1500;

export async function makePledgeCard(name: string, date: string): Promise<Blob> {
  await loadRisoFonts();
  const { c, g, S } = risoCanvas();
  const ink = color.cobalt;
  g.fillStyle = color.signal;
  g.fillRect(0, 0, S, 230);
  g.fillStyle = ink;
  g.fillRect(0, 230, S, 6);
  g.font = `700 26px ${font.mono}`;
  g.fillText('SPOTTER // PLEDGE', 60, 70);
  g.textAlign = 'right';
  g.fillText(shortDate(date), S - 60, 70);
  g.textAlign = 'left';
  g.font = `150px ${font.archivo}`;
  g.fillText('PLEDGE.', 52, 200);
  drawDiagram(g, 880, 420, 120, ink);
  g.font = `56px ${font.archivo}`;
  PLEDGE.forEach((line, i) => {
    const y = 360 + i * 120;
    g.font = `700 24px ${font.mono}`;
    g.fillText(`0${i + 1} /`, 60, y - 50);
    g.font = `52px ${font.archivo}`;
    g.fillText(line, 60, y);
  });
  g.fillRect(60, 880, S - 120, 3);
  g.font = `700 28px ${font.mono}`;
  g.fillText(`SIGNED: ${name.toUpperCase()} · ${shortDate(date)}`, 60, 930);
  drawLogo(g, S - 160, 950, 90, ink);
  g.font = `56px ${font.archivo}`;
  g.fillText('CORPUS', 60, 1020);
  bakeGrain(g, S, 0.25);
  return toPng(c);
}

/** Hold-to-sign button: fills over 1.5 s, cancels on release. */
function HoldToSign({ onSigned }: { onSigned: () => void }) {
  const [p, setP] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef(0);
  const tick = () => {
    if (start.current === null) return;
    const k = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    setP(k);
    if (k >= 1) {
      start.current = null;
      navigator.vibrate?.(60);
      onSigned();
    } else raf.current = requestAnimationFrame(tick);
  };
  const down = () => {
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  const up = () => {
    start.current = null;
    cancelAnimationFrame(raf.current);
    setP(0);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <button
      className="relative min-h-16 w-full touch-none overflow-hidden border-2 border-ink bg-page text-base font-bold text-ink uppercase select-none"
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && down()}
      onKeyUp={up}
      aria-label="Hold for 1.5 seconds to sign the pledge"
    >
      <span className="absolute inset-y-0 left-0 bg-signal" style={{ width: `${p * 100}%` }} aria-hidden />
      <span className="relative">{p > 0 ? `Signing… ${Math.round(p * 100)}%` : 'Hold to sign'}</span>
    </button>
  );
}

/** The manifesto + signing. `onDone` runs after signing (or "Later"). */
export function Pledge({ onDone, allowLater }: { onDone: () => void; allowLater?: boolean }) {
  const profile = useProfile();
  const [signed, setSigned] = useState(profile.pledgeDate ?? null);
  const [busy, setBusy] = useState(false);
  const sign = async () => {
    const d = todayKey();
    await saveProfile({ pledgeDate: d });
    setSigned(d);
  };
  const share = async () => {
    setBusy(true);
    await sharePng(await makePledgeCard(profile.name, signed ?? todayKey()), 'corpus-pledge.png', 'My Corpus pledge');
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <div className="relative border-2 border-ink p-4">
        <Grain />
        <div className="relative flex items-start justify-between gap-3">
          <ol className="space-y-3">
            {PLEDGE.map((l, i) => (
              <li key={l}>
                <div className="text-[10px] font-bold">0{i + 1} /</div>
                <div className="display text-3xl">{l}</div>
              </li>
            ))}
          </ol>
          <div className="shrink-0">
            <Rings value={signed ? 100 : 40} size={80} />
          </div>
        </div>
        <div className="relative mt-4 border-t-[3px] border-ink pt-2 text-xs font-bold uppercase">
          {signed ? `Signed: ${profile.name} · ${shortDate(signed)}` : 'Signature: ____________'}
        </div>
      </div>
      {!signed ? (
        <>
          <HoldToSign onSigned={sign} />
          {allowLater && (
            <button className="min-h-11 w-full text-xs font-bold uppercase underline" onClick={onDone}>
              Later
            </button>
          )}
        </>
      ) : (
        <div className="flex gap-2">
          <Button variant="social" className="min-h-14 flex-1" onClick={share} disabled={busy}>
            {busy ? '…' : 'Share card'}
          </Button>
          <Button className="min-h-14 flex-1" onClick={onDone}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

/** Profile → pledge route. */
export function PledgeScreen() {
  return (
    <Surface style="riso" className="-mx-4 px-4">
      <PageHeader title="Pledge" section="PLEDGE" back />
      <Pledge onDone={() => history.back()} />
    </Surface>
  );
}
