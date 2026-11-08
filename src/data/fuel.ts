// Fuel diary reads/writes. Engine maths lives in src/engine/fuel.ts.
import { useLiveQuery } from 'dexie-react-hooks';
import { nutrientsFor, recipeNutrition, slotForTime, sumNutrients, type DiaryItem, type Food, type Meal, type Nutrients, type ServingUnit, type UserProfile } from '../engine';
import { db, nowTime, uid } from './db';

export const DEFAULT_MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export const mealNames = (p: UserProfile) => DEFAULT_MEAL_NAMES.map((d, i) => p.mealNames?.[i] || d);
export const slotOf = (m: Meal) => m.slot ?? slotForTime(m.time);

const SLOT_TIME = ['08:00', '12:30', '19:00', '16:00'];

export function useFuel() {
  const foods = useLiveQuery(() => db.foods.toArray());
  const savedMeals = useLiveQuery(() => db.savedMeals.toArray());
  const water = useLiveQuery(() => db.water.toArray());
  if (!foods || !savedMeals || !water) return null;
  return { foods, savedMeals, water };
}

/** Remember a food (recent/frequent lists work offline). */
export async function cacheFood(f: Food) {
  const cur = await db.foods.get(f.id);
  await db.foods.put({ ...f, useCount: (cur?.useCount ?? 0) + 1, lastUsed: Date.now() });
}

const entryTime = (date: string, today: string, slot: number) => (date === today ? nowTime() : SLOT_TIME[slot]);

function toItem(f: Food, qty: number, unit: ServingUnit): DiaryItem {
  const n = nutrientsFor(f, qty, unit);
  return { name: f.brand ? `${f.name} (${f.brand})` : f.name, foodId: f.id, qty, unit, ...n };
}

export async function logFood(f: Food, qty: number, unit: ServingUnit, date: string, slot: number, today: string) {
  await cacheFood(f);
  await db.meals.add({ ...toItem(f, qty, unit), id: uid(), date, time: entryTime(date, today, slot), slot, isFavorite: false });
}

export async function updateServing(m: Meal, f: Food, qty: number, unit: ServingUnit) {
  await db.meals.put({ ...m, ...toItem(f, qty, unit) });
}

export async function quickAdd(n: Nutrients & { name?: string }, date: string, slot: number, today: string) {
  await db.meals.add({ name: n.name || 'Quick add', kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, id: uid(), date, time: entryTime(date, today, slot), slot, isFavorite: false });
}

export const updateEntry = (m: Meal) => db.meals.put(m);
export const moveEntry = (id: string, slot: number) => db.meals.update(id, { slot });

export async function logItems(items: DiaryItem[], date: string, slot: number, today: string) {
  const time = entryTime(date, today, slot);
  await db.meals.bulkAdd(items.map((it) => ({ ...it, id: uid(), date, time, slot, isFavorite: false })));
}

const itemOf = ({ id: _i, date: _d, time: _t, slot: _s, isFavorite: _f, ...rest }: Meal): DiaryItem => rest;

/** Copy one diary slot from a date to another date. */
export async function copySlot(meals: Meal[], from: string, to: string, slot: number, today: string) {
  await logItems(meals.filter((m) => m.date === from && slotOf(m) === slot).map(itemOf), to, slot, today);
}

export async function copyDay(meals: Meal[], from: string, to: string) {
  await db.meals.bulkAdd(meals.filter((m) => m.date === from).map((m) => ({ ...m, id: uid(), date: to, slot: slotOf(m), isFavorite: false })));
}

export async function saveMealAs(name: string, entries: Meal[]) {
  await db.savedMeals.add({ id: uid(), name, items: entries.map(itemOf) });
}
export const deleteSavedMeal = (id: string) => db.savedMeals.delete(id);

export async function saveCustomFood(f: Omit<Food, 'id' | 'source' | 'useCount' | 'lastUsed'>): Promise<Food> {
  const food: Food = { ...f, id: `custom:${uid()}`, source: 'custom', useCount: 0, lastUsed: Date.now() };
  await db.foods.put(food);
  return food;
}

export async function saveRecipe(name: string, items: { food: Food; grams: number }[], servings: number): Promise<Food> {
  const r = recipeNutrition(items.map((i) => ({ per100: i.food.per100, grams: i.grams })), servings);
  const food: Food = {
    id: `recipe:${uid()}`,
    name,
    source: 'recipe',
    per100: r.per100,
    servingGrams: Math.round(r.servingGrams),
    servingLabel: `1 of ${servings} servings`,
    recipe: { items: items.map((i) => ({ foodId: i.food.id, name: i.food.name, grams: i.grams })), servings },
    useCount: 0,
    lastUsed: Date.now(),
  };
  for (const i of items) await cacheFood(i.food);
  await db.foods.put(food);
  return food;
}

export async function addWater(date: string, ml: number) {
  const cur = await db.water.get(date);
  await db.water.put({ date, ml: Math.max(0, Math.round((cur?.ml ?? 0) + ml)) });
}

export const totals = (ms: Partial<Nutrients>[]) => sumNutrients(ms);
