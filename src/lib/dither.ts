// 1-bit Floyd–Steinberg dither. Pure core + a browser helper that renders in ink on paper.

/** Luminance (0–255) per pixel from RGBA bytes. */
export function toGray(rgba: ArrayLike<number>): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return out;
}

/** Floyd–Steinberg error diffusion. Returns 1 where ink is printed (dark), 0 for paper. */
export function floydSteinberg(gray: Float32Array, w: number, h: number, threshold = 128): Uint8Array {
  const g = Float32Array.from(gray);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = g[i];
      const ink = old < threshold;
      out[i] = ink ? 1 : 0;
      const err = old - (ink ? 0 : 255);
      if (x + 1 < w) g[i + 1] += (err * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) g[i + w - 1] += (err * 3) / 16;
        g[i + w] += (err * 5) / 16;
        if (x + 1 < w) g[i + w + 1] += err / 16;
      }
    }
  }
  return out;
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Draw an image blob dithered in `ink` on `paper`; returns a PNG data URL. Browser only. */
export async function ditherBlob(blob: Blob, ink: string, paper: string, maxW = 480): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const w = Math.min(maxW, bmp.width);
  const h = Math.round((bmp.height * w) / bmp.width);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const bits = floydSteinberg(toGray(img.data), w, h);
  const [ir, ig, ib] = hex(ink);
  const [pr, pg, pb] = hex(paper);
  for (let i = 0; i < bits.length; i++) {
    const on = bits[i] === 1;
    img.data[i * 4] = on ? ir : pr;
    img.data[i * 4 + 1] = on ? ig : pg;
    img.data[i * 4 + 2] = on ? ib : pb;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
