// Photo rendered as a 1-bit dither in the surface ink on paper. Owner can toggle the original.
import { useEffect, useState } from 'react';
import { ditherBlob } from '../lib/dither';
import { surface } from '../theme/tokens';
import { useSurface } from './riso';

export default function DitherImg({ blob, className = '', owner }: { blob: Blob; className?: string; owner?: boolean }) {
  const style = useSurface();
  const [src, setSrc] = useState<string | null>(null);
  const [orig, setOrig] = useState(false);
  const [origUrl] = useState(() => URL.createObjectURL(blob));
  useEffect(() => {
    let live = true;
    ditherBlob(blob, surface[style].ink, surface[style].page, 360)
      .then((u) => live && setSrc(u))
      .catch(() => live && setSrc(origUrl));
    return () => {
      live = false;
    };
  }, [blob, style, origUrl]);
  useEffect(() => () => URL.revokeObjectURL(origUrl), [origUrl]);
  return (
    <div className="shrink-0">
      {src ? <img src={orig ? origUrl : src} alt="" className={`border-2 border-ink object-cover [image-rendering:pixelated] ${className}`} /> : <div className={`hatch border-2 border-ink ${className}`} />}
      {owner && (
        <button className="mt-1 min-h-11 w-full font-mono text-[10px] font-bold uppercase underline" onClick={() => setOrig(!orig)}>
          {orig ? 'Show dither' : 'Show original'}
        </button>
      )}
    </div>
  );
}
