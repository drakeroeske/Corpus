// Generates the PWA icons (public/icon-*.png) with no dependencies.
// Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Connected-C mark (same geometry as src/components/diagrams logoGeometry) in cobalt on bone.
function logo() {
  const nodes = Array.from({ length: 7 }, (_, i) => {
    const a = ((50 + (i * 260) / 6) * Math.PI) / 180;
    return [50 + 36 * Math.cos(a), 50 - 36 * Math.sin(a)];
  });
  const hub = [50, 50];
  const links = [];
  for (let i = 0; i < nodes.length - 1; i++) links.push([nodes[i], nodes[i + 1]]);
  for (const i of [0, 2, 4, 6]) links.push([hub, nodes[i]]);
  return { nodes, hub, links };
}

const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

function icon(size, height = size, scale = 1 - 2 * 0.16) {
  const bone = [0xec, 0xe8, 0xdf];
  const cobalt = [0x2b, 0x3f, 0xd6];
  const g = logo();
  // scale = share of the width the mark fills (0.68 leaves the maskable safe zone)
  const k = (size * scale) / 100;
  const off = (size - size * scale) / 2;
  const offY = (height - size * scale) / 2;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      // 2x2 supersampling for smooth edges
      let hit = 0;
      for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const u = (x + sx - off) / k;
        const v = (y + sy - offY) / k;
        let on = g.links.some((l) => segDist(u, v, l[0], l[1]) <= 2.5);
        on ||= g.nodes.some(([nx, ny]) => Math.abs(u - nx) <= 6 && Math.abs(v - ny) <= 6);
        on ||= Math.abs(u - g.hub[0]) <= 9 && Math.abs(v - g.hub[1]) <= 9;
        if (on) hit++;
      }
      const t = hit / 4;
      row.push(...bone.map((c, i) => Math.round(c + (cobalt[i] - c) * t)));
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
for (const s of [180, 192, 512]) writeFileSync(`public/icon-${s}.png`, icon(s));
// iOS launch screen: mark on bone, portrait.
writeFileSync('public/splash.png', icon(1170, 2532, 0.32));
console.log('icons written');
