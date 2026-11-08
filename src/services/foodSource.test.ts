import { describe, expect, it } from 'vitest';
import { LOCAL_FOODS, mapOff, mapUsda, matchScore, rankFoods, searchLocal } from './foodSource';
import type { Food } from '../engine/types';

describe('food sources', () => {
  it('bundles ~150 generic foods', () => {
    expect(LOCAL_FOODS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(LOCAL_FOODS.map((f) => f.id)).size).toBe(LOCAL_FOODS.length);
  });
  it('searches the bundled list offline', () => {
    expect(searchLocal('chicken breast')[0].name).toBe('Chicken breast, cooked');
    expect(searchLocal('rice').length).toBeGreaterThanOrEqual(3);
    expect(searchLocal('zzqx')).toEqual([]);
    expect(matchScore('Egg, whole', 'egg')).toBe(3);
  });
  it('maps Open Food Facts products', () => {
    const f = mapOff({
      code: '123', product_name: 'Oat Bar', brands: 'Acme, Other', serving_size: '40 g', serving_quantity: 40,
      nutriments: { 'energy-kcal_100g': 410, proteins_100g: 8, carbohydrates_100g: 60, fat_100g: 14, fiber_100g: 6, sugars_100g: 20, sodium_100g: 0.2 },
    })!;
    expect(f).toMatchObject({ id: 'off:123', name: 'Oat Bar', brand: 'Acme', barcode: '123', servingGrams: 40 });
    expect(f.per100).toEqual({ kcal: 410, protein: 8, carbs: 60, fat: 14, fiber: 6, sugar: 20, sodium: 200 });
  });
  it('falls back to kJ and salt; rejects products without energy', () => {
    const f = mapOff({ code: '9', product_name: 'X', nutriments: { energy_100g: 418.4, salt_100g: 1 } })!;
    expect(f.per100.kcal).toBe(100);
    expect(f.per100.sodium).toBe(400);
    expect(mapOff({ code: '1', product_name: 'Y', nutriments: {} })).toBeNull();
  });
  it('maps USDA hits', () => {
    const f = mapUsda({ fdcId: 5, description: 'BANANAS, RAW', foodNutrients: [{ nutrientId: 1008, value: 89 }, { nutrientId: 1003, value: 1.09 }, { nutrientId: 1093, value: 1 }] })!;
    expect(f).toMatchObject({ id: 'usda:5', name: 'Bananas, raw', per100: { kcal: 89, protein: 1.1, carbs: 0, fat: 0, sodium: 1 } });
  });
  it('ranks recent → frequent → local → remote without duplicates', () => {
    const now = 100 * 86_400_000;
    const mk = (id: string, name: string, lastUsed: number, useCount: number): Food => ({ id, name, source: 'custom', per100: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, useCount, lastUsed });
    const cached = [mk('a', 'Rice old', now - 30 * 86_400_000, 9), mk('b', 'Rice new', now - 86_400_000, 1), mk('c', 'Beans', now, 5)];
    const local = [mk('l1', 'Rice local', 0, 0), mk('b', 'Rice new', 0, 0)];
    const remote = [mk('r1', 'Rice remote', 0, 0)];
    expect(rankFoods(cached, local, remote, 'rice', now).map((f) => f.id)).toEqual(['b', 'a', 'l1', 'r1']);
  });
});
