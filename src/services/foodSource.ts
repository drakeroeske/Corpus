// Food lookups behind one interface. Open data only: bundled generic list, Open Food Facts, optional USDA.
// A paid database can replace these by implementing FoodSource.
import type { Food, Nutrients } from '../engine/types';
import raw from '../data/foods.json';

export interface FoodSource {
  name: string;
  search(q: string, signal?: AbortSignal): Promise<Food[]>;
  barcode?(code: string, signal?: AbortSignal): Promise<Food | null>;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(+x) ? +x : undefined);
const r1 = (x: number) => Math.round(x * 10) / 10;

// ---------- Bundled generic foods ----------

type Row = [string, number, number, number, number, number, number, number, number, string, number];

export const LOCAL_FOODS: Food[] = (raw.foods as Row[]).map(([name, kcal, protein, carbs, fat, fiber, sugar, sodium, sg, sl, pg]) => ({
  id: `local:${slug(name)}`,
  name,
  source: 'local',
  per100: { kcal, protein, carbs, fat, fiber, sugar, sodium },
  servingGrams: sg || undefined,
  servingLabel: sl || undefined,
  pieceGrams: pg || undefined,
  useCount: 0,
  lastUsed: 0,
}));

/** Match score: 0 = no match. Every query word must appear in the name. */
export function matchScore(name: string, q: string): number {
  const n = name.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  if (!words.every((w) => n.includes(w))) return 0;
  if (n.startsWith(q.toLowerCase().trim())) return 3;
  if (words.every((w) => new RegExp(`(^|[^a-z])${w.replace(/[^a-z0-9]/g, '')}`).test(n))) return 2;
  return 1;
}

export function searchLocal(q: string, foods: Food[] = LOCAL_FOODS): Food[] {
  return foods
    .map((f) => ({ f, s: matchScore(`${f.name} ${f.brand ?? ''}`, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.name.length - b.f.name.length)
    .map((x) => x.f);
}

export const localSource: FoodSource = {
  name: 'Generic foods',
  search: async (q) => searchLocal(q).slice(0, 25),
};

/**
 * Search ranking: recent (used in the last 14 days) → frequent (used before) → bundled list → remote.
 * Duplicates (same id) keep their first position.
 */
export function rankFoods(cached: Food[], local: Food[], remote: Food[], q: string, now: number): Food[] {
  const hits = cached.filter((f) => !q.trim() || matchScore(`${f.name} ${f.brand ?? ''}`, q) > 0);
  const recentCut = now - 14 * 86_400_000;
  const recent = hits.filter((f) => f.lastUsed >= recentCut).sort((a, b) => b.lastUsed - a.lastUsed);
  const frequent = hits.filter((f) => f.lastUsed < recentCut).sort((a, b) => b.useCount - a.useCount);
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const f of [...recent, ...frequent, ...local, ...remote]) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

// ---------- Open Food Facts ----------

const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';

/** Map an Open Food Facts product to a Food. Null when it lacks calories. */
export function mapOff(p: any): Food | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!p) return null;
  const n = p.nutriments ?? {};
  const kj = num(n['energy_100g']) ?? num(n['energy-kj_100g']);
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / 4.184 : undefined);
  const name = String(p.product_name ?? '').trim();
  if (kcal === undefined || !name) return null;
  const sodiumG = num(n['sodium_100g']) ?? (num(n['salt_100g']) !== undefined ? num(n['salt_100g'])! / 2.5 : undefined);
  const per100: Nutrients = {
    kcal: Math.round(kcal),
    protein: r1(num(n['proteins_100g']) ?? 0),
    carbs: r1(num(n['carbohydrates_100g']) ?? 0),
    fat: r1(num(n['fat_100g']) ?? 0),
  };
  const fiber = num(n['fiber_100g']);
  const sugar = num(n['sugars_100g']);
  if (fiber !== undefined) per100.fiber = r1(fiber);
  if (sugar !== undefined) per100.sugar = r1(sugar);
  if (sodiumG !== undefined) per100.sodium = Math.round(sodiumG * 1000);
  const sq = num(p.serving_quantity);
  return {
    id: `off:${p.code}`,
    name,
    brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
    barcode: p.code ? String(p.code) : undefined,
    source: 'off',
    per100,
    servingGrams: sq && sq > 0 ? sq : undefined,
    servingLabel: sq && sq > 0 ? String(p.serving_size ?? `${sq} g`) : undefined,
    useCount: 0,
    lastUsed: 0,
  };
}

export const offSource: FoodSource = {
  name: 'Open Food Facts',
  async search(q, signal) {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const j = await res.json();
    return ((j.products ?? []) as unknown[]).map(mapOff).filter((f): f is Food => !!f);
  },
  async barcode(code, signal) {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, { signal });
    if (!res.ok) return null;
    const j = await res.json();
    return j.status === 1 ? mapOff({ ...j.product, code: j.product?.code ?? code }) : null;
  },
};

// ---------- USDA FoodData Central (optional key) ----------

const USDA_IDS: Record<string, keyof Nutrients> = {
  '1008': 'kcal', '2047': 'kcal', '2048': 'kcal',
  '1003': 'protein', '1005': 'carbs', '1004': 'fat', '1079': 'fiber', '2000': 'sugar', '1093': 'sodium',
};

/** Map a USDA search hit (values per 100 g) to a Food. */
export function mapUsda(f: any): Food | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const per: Partial<Nutrients> = {};
  for (const n of f?.foodNutrients ?? []) {
    const k = USDA_IDS[String(n.nutrientId ?? n.nutrientNumber)];
    const v = num(n.value);
    if (k && v !== undefined && per[k] === undefined) per[k] = k === 'kcal' || k === 'sodium' ? Math.round(v) : r1(v);
  }
  if (per.kcal === undefined || !f.description) return null;
  const name = String(f.description).toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return {
    id: `usda:${f.fdcId}`,
    name,
    source: 'usda',
    per100: { protein: 0, carbs: 0, fat: 0, ...per } as Nutrients,
    useCount: 0,
    lastUsed: 0,
  };
}

export function usdaSource(key: string): FoodSource {
  return {
    name: 'USDA',
    async search(q, signal) {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&dataType=Foundation,SR%20Legacy&pageSize=15`;
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const j = await res.json();
      return ((j.foods ?? []) as unknown[]).map(mapUsda).filter((f): f is Food => !!f);
    },
  };
}

/** Remote sources in order. USDA is skipped silently without a key; failures return []. */
export async function searchRemote(q: string, usdaKey: string | undefined, signal?: AbortSignal): Promise<Food[]> {
  const sources = [...(usdaKey ? [usdaSource(usdaKey)] : []), offSource];
  const results = await Promise.all(sources.map((s) => s.search(q, signal).catch(() => [] as Food[])));
  return results.flat();
}

export const lookupBarcode = (code: string, signal?: AbortSignal) => offSource.barcode!(code, signal).catch(() => null);
