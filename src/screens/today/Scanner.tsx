// Camera barcode scanner (lazy-loaded). @zxing/browser works in iPhone Safari over HTTPS.
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Button, Label, TextInput } from '../../components/ui';
import { Crosshair } from '../../components/diagrams';

export default function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const [manual, setManual] = useState('');
  const done = useRef(false);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (result) => {
        if (result && !done.current) {
          done.current = true;
          controls?.stop();
          cb.current(result.getText());
        }
      })
      .then((c) => {
        controls = c;
        if (stopped) c.stop();
      })
      .catch(() => setErr('Camera not available. Allow camera access, or type the barcode below.'));
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden border-2 border-ink bg-ink">
        <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
        <Crosshair className="pointer-events-none absolute inset-0 h-full w-full text-paper" />
        <div className="absolute top-1 left-2 font-mono text-[10px] font-bold text-paper uppercase">FIG. 01 — BARCODE</div>
      </div>
      {err ? <p className="font-mono text-xs uppercase"><span className="font-bold">[NO CAMERA]</span> {err}</p> : <p className="font-mono text-xs uppercase">Point the camera at a barcode.</p>}
      <Label>Or type it</Label>
      <div className="flex gap-2">
        <TextInput inputMode="numeric" placeholder="Barcode number" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} />
        <Button disabled={manual.length < 6} onClick={() => onCode(manual)}>Look up</Button>
      </div>
    </div>
  );
}
