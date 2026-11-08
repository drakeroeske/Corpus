// JSON export / import of every table. Photo blobs travel as data URLs.
import { ALL_TABLES, db, todayKey } from './db';

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });

const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();

export async function exportJson(): Promise<void> {
  const out: Record<string, unknown[]> = {};
  for (const t of ALL_TABLES) out[t] = await db.table(t).toArray();
  out.measurements = await Promise.all(
    (out.measurements as { photo?: Blob }[]).map(async (m) => (m.photo ? { ...m, photo: await blobToDataUrl(m.photo) } : m)),
  );
  const blob = new Blob([JSON.stringify({ app: 'corpus', version: 1, exportedAt: new Date().toISOString(), data: out })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `corpus-backup-${todayKey()}.json`;
  a.click();
}

export async function importJson(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text());
  if (parsed?.app !== 'corpus' || !parsed.data) throw new Error('Not a Corpus backup file.');
  const data = parsed.data as Record<string, unknown[]>;
  data.measurements = await Promise.all(
    (data.measurements ?? []).map(async (m) => {
      const x = m as { photo?: string };
      return typeof x.photo === 'string' ? { ...x, photo: await dataUrlToBlob(x.photo) } : x;
    }),
  );
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) {
      await db.table(t).clear();
      if (data[t]?.length) await db.table(t).bulkPut(data[t]);
    }
  });
}

/** Empty every table (works even with other tabs open, unlike deleting the DB), then restart. */
export async function resetAll(): Promise<void> {
  await db.transaction('rw', [...ALL_TABLES, 'outbox'].map((t) => db.table(t)), async () => {
    for (const t of [...ALL_TABLES, 'outbox']) await db.table(t).clear();
  });
  location.reload();
}
