// Canvas helpers for Riso exports (PR card, pledge card): bone page, pink band, logo, baked grain.
import { logoGeometry } from '../components/diagrams';
import { color, font } from '../theme/tokens';

export async function loadRisoFonts() {
  await Promise.all([document.fonts.load(`80px ${font.archivo}`), document.fonts.load(`700 40px ${font.mono}`), document.fonts.load(`400 40px ${font.mono}`)]).catch(() => {});
}

export function risoCanvas(S = 1080) {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = color.bone;
  g.fillRect(0, 0, S, S);
  return { c, g, S };
}

/** Connected-C mark at (x, y) with the given box size. */
export function drawLogo(g: CanvasRenderingContext2D, x: number, y: number, size: number, ink = color.cobalt) {
  const k = size / 100;
  const geo = logoGeometry();
  g.save();
  g.translate(x, y);
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 5 * k;
  g.lineCap = 'square';
  for (const [a, b] of geo.links) {
    g.beginPath();
    g.moveTo(a[0] * k, a[1] * k);
    g.lineTo(b[0] * k, b[1] * k);
    g.stroke();
  }
  for (const [nx, ny] of geo.nodes) g.fillRect((nx - 6) * k, (ny - 6) * k, 12 * k, 12 * k);
  g.fillRect((geo.hub[0] - 9) * k, (geo.hub[1] - 9) * k, 18 * k, 18 * k);
  g.restore();
}

/** Concentric rings + crosshair + silhouette diagram centred at (cx, cy). */
export function drawDiagram(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, ink = color.cobalt) {
  g.save();
  g.strokeStyle = ink;
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    g.setLineDash(i % 2 ? [6, 8] : []);
    g.beginPath();
    g.arc(cx, cy, r * (0.45 + i * 0.18), 0, Math.PI * 2);
    g.stroke();
  }
  g.setLineDash([]);
  g.beginPath();
  g.moveTo(cx - r * 1.05, cy);
  g.lineTo(cx + r * 1.05, cy);
  g.moveTo(cx, cy - r * 1.05);
  g.lineTo(cx, cy + r * 1.05);
  g.stroke();
  // silhouette
  const h = r * 1.5;
  const t = cy - h / 2;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx, t + h * 0.08, h * 0.06, 0, Math.PI * 2);
  g.stroke();
  g.strokeRect(cx - h * 0.1, t + h * 0.16, h * 0.2, h * 0.36);
  g.strokeRect(cx - h * 0.08, t + h * 0.52, h * 0.07, h * 0.46);
  g.strokeRect(cx + h * 0.01, t + h * 0.52, h * 0.07, h * 0.46);
  g.strokeRect(cx - h * 0.17, t + h * 0.17, h * 0.06, h * 0.32);
  g.strokeRect(cx + h * 0.11, t + h * 0.17, h * 0.06, h * 0.32);
  g.restore();
}

/** Bake photocopy grain into the canvas (multiply-style darkening noise). */
export function bakeGrain(g: CanvasRenderingContext2D, S: number, amount = 0.25, seed = 7) {
  const img = g.getImageData(0, 0, S, S);
  let x = seed >>> 0;
  for (let i = 0; i < img.data.length; i += 4) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const n = 1 - (x / 2 ** 32) * amount * 0.6;
    img.data[i] *= n;
    img.data[i + 1] *= n;
    img.data[i + 2] *= n;
  }
  g.putImageData(img, 0, 0);
}

export const toPng = (c: HTMLCanvasElement) => new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));

/** Share a PNG with the system sheet, or download it. */
export async function sharePng(blob: Blob, name: string, title: string) {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title }).catch(() => {});
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }
}
