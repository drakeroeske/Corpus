// Fuel: food diary (meals by slot), rings, water, targets, adaptive TDEE.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { db, todayKey } from '../../data/db';
import { saveProfile, useData } from '../../data/repo';
import { dayForDate, engineTargets, proteinTarget, tdeeDays } from '../../data/plan';
import {
  addWater, copyDay, copySlot, deleteSavedMeal, logFood, logItems, mealNames, quickAdd, saveCustomFood, saveMealAs, saveRecipe, slotOf, totals, updateEntry, updateServing, useFuel,
} from '../../data/fuel';
import { LOCAL_FOODS, lookupBarcode, rankFoods, searchLocal, searchRemote } from '../../services/foodSource';
import {
  addDays, adaptiveTdee, macroPct, nutrientsFor, tdeeTarget, unitsFor, type Food, type Meal, type Nutrients, type SavedMeal, type ServingUnit, type TargetOverride,
} from '../../engine';
import { Button, Card, Label, NumberInput, PageHeader, Segmented, Sheet, SubTabs, TextInput, fmt, prettyDate } from '../../components/ui';
import { Meter, NoteLine, Tag, shortDate } from '../../components/riso';
import { Empty } from '../../components/diagrams';

const Scanner = lazy(() => import('./Scanner'));

const OZ_ML = 29.5735;

export default function Fuel() {
  const data = useData();
  const fuel = useFuel();
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<number | null>(null);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [sheet, setSheet] = useState<'targets' | 'rename' | null>(null);
  const [waterAmt, setWaterAmt] = useState<number | undefined>();
  if (!data || !fuel) return null;
  const { profile, days, meals, checkins } = data;
  const training = !!dayForDate(days, date);
  const t = proteinTarget(profile, training);
  const names = mealNames(profile);
  const dayMeals = meals.filter((m) => m.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const sum = totals(dayMeals);
  const yesterday = addDays(date, -1);
  const water = fuel.water.find((w) => w.date === date)?.ml ?? 0;
  const imperial = profile.units === 'lb';
  const est = adaptiveTdee(tdeeDays(meals, checkins, profile.units), today);
  const suggested = est ? tdeeTarget(est.tdee, profile.goal) : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Fuel" section="FUEL" status={`${shortDate(date)} [${training ? 'TRAINING' : 'REST'}]`} sub={`${training ? 'Training day' : 'Rest day'} targets`} back right={<Button variant="ghost" onClick={() => setSheet('targets')}>Targets</Button>} />

      <div className="flex items-stretch border-2 border-ink">
        <button className="min-h-11 min-w-12 border-r-2 border-ink font-mono text-lg font-bold" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>←</button>
        <button className="min-h-11 flex-1 font-mono text-sm font-bold uppercase" onClick={() => setDate(today)}>{date === today ? 'Today' : prettyDate(date)}</button>
        <button className="min-h-11 min-w-12 border-l-2 border-ink font-mono text-lg font-bold" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>→</button>
      </div>

      <Card className="space-y-2">
        <Meter label="kcal" value={sum.kcal} max={t.kcal} />
        <Meter label="Protein" value={sum.protein} max={t.protein} unit=" g" />
        <Meter label="Carbs" value={sum.carbs} max={t.carbs} unit=" g" />
        <Meter label="Fat" value={sum.fat} max={t.fat} unit=" g" />
        <div className="border-t border-dashed border-ink pt-2 font-mono text-[10px] uppercase">
          {Math.max(0, t.kcal - sum.kcal)} kcal left · fiber {fmt(sum.fiber)} g · sugar {fmt(sum.sugar)} g · sodium {sum.sodium} mg
        </div>
      </Card>

      {names.map((name, slot) => {
        const items = dayMeals.filter((m) => slotOf(m) === slot);
        const yItems = meals.some((m) => m.date === yesterday && slotOf(m) === slot);
        return (
          <Card key={slot} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <div className="display text-3xl">{name}.</div>
              <div className="font-mono text-sm font-bold">{totals(items).kcal} KCAL</div>
            </div>
            <div className="flex border-t-[3px] border-b border-ink py-1 font-mono text-[10px] font-bold uppercase">
              <span className="flex-1">Item</span>
              <span className="w-24 text-right">P / C / F</span>
              <span className="w-14 text-right">kcal</span>
            </div>
            {!items.length && <div className="py-2 font-mono text-[10px] uppercase">[EMPTY]</div>}
            {items.map((m) => (
              <EntryRow key={m.id} m={m} onEdit={() => setEditing(m)} onDelete={() => db.meals.delete(m.id)} />
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button className="flex-1" onClick={() => setAdding(slot)}>+ Add food</Button>
              {!items.length && yItems && <Button variant="ghost" onClick={() => copySlot(meals, yesterday, date, slot, today)}>Copy yesterday</Button>}
              {items.length > 0 && (
                <Button variant="ghost" onClick={async () => { const n = prompt('Name this meal', name); if (n) await saveMealAs(n, items); }}>Save as meal</Button>
              )}
            </div>
          </Card>
        );
      })}

      {!dayMeals.length && meals.some((m) => m.date === yesterday) && (
        <Button variant="ghost" className="w-full" onClick={() => copyDay(meals, yesterday, date)}>Copy yesterday's whole day</Button>
      )}

      <Card className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="display text-3xl">Water.</div>
          <div className="font-mono font-bold">{imperial ? `${Math.round(water / OZ_ML)} oz` : `${water} ml`}</div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => addWater(date, imperial ? 8 * OZ_ML : 250)}>{imperial ? '+8 oz' : '+250 ml'}</Button>
          <Button variant="ghost" onClick={() => addWater(date, imperial ? -8 * OZ_ML : -250)}>Undo</Button>
        </div>
        <div className="flex gap-2">
          <NumberInput value={waterAmt} onChange={setWaterAmt} placeholder={imperial ? 'oz' : 'ml'} />
          <Button variant="ghost" disabled={!waterAmt} onClick={() => { addWater(date, (waterAmt ?? 0) * (imperial ? OZ_ML : 1)); setWaterAmt(undefined); }}>Add</Button>
        </div>
      </Card>

      {est && (
        <Card className="space-y-2">
          <div className="font-mono text-sm uppercase">
            Estimated maintenance: <span className="display text-3xl">{est.tdee}</span> kcal <Tag>CONFIDENCE: {est.confidence.toUpperCase()}</Tag>
          </div>
          <div className="font-mono text-[10px] uppercase">
            From {est.intakeDays} days of food logs and your weight trend ({est.trendKgPerWeek > 0 ? '+' : ''}{imperial ? fmt(est.trendKgPerWeek * 2.20462, 2) + ' lb' : fmt(est.trendKgPerWeek, 2) + ' kg'}/week).
          </div>
          {suggested !== null && Math.abs(suggested - t.kcal) >= 100 && (
            <Button variant="ghost" className="w-full" onClick={() => saveProfile({ targetOverride: { ...withoutPct(profile.targetOverride), kcal: suggested } })}>
              Update target to {suggested} kcal for your goal
            </Button>
          )}
        </Card>
      )}

      <button className="min-h-11 w-full font-mono text-xs font-bold uppercase underline" onClick={() => setSheet('rename')}>Rename meals</button>

      {adding !== null && <AddFood slot={adding} slotName={names[adding]} date={date} today={today} usdaKey={profile.usdaKey} cached={fuel.foods} saved={fuel.savedMeals} onClose={() => setAdding(null)} />}
      {editing && <EditEntry m={editing} names={names} foods={fuel.foods} onClose={() => setEditing(null)} />}
      {sheet === 'targets' && <TargetsSheet base={engineTargets(profile, training)} current={t} override={profile.targetOverride} onClose={() => setSheet(null)} />}
      {sheet === 'rename' && <RenameSheet names={names} onClose={() => setSheet(null)} />}
    </div>
  );
}

const withoutPct = (o?: TargetOverride): TargetOverride => {
  const { pct: _p, ...rest } = o ?? {};
  return rest;
};

// ---------- Diary row: tap or long-press to edit, swipe left to delete ----------

function EntryRow({ m, onEdit, onDelete }: { m: Meal; onEdit: () => void; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const moved = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const qty = m.qty !== undefined ? `${fmt(m.qty, 2)} ${m.unit === 'serving' ? 'srv' : m.unit}` : '';
  return (
    <div className="relative overflow-hidden border-b border-dashed border-ink">
      <button className="absolute inset-y-0 right-0 w-24 bg-ink font-mono text-xs font-bold uppercase text-page" onClick={onDelete}>Delete</button>
      <div
        className="relative flex min-h-11 items-center gap-2 bg-page py-1 transition-transform"
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          start.current = e.clientX - dx;
          moved.current = false;
          timer.current = window.setTimeout(() => { start.current = null; onEdit(); }, 500);
        }}
        onPointerMove={(e) => {
          if (start.current === null) return;
          const d = e.clientX - start.current;
          if (Math.abs(d) > 8) { moved.current = true; clearTimeout(timer.current); }
          if (moved.current) setDx(Math.max(-96, Math.min(0, d)));
        }}
        onPointerUp={() => {
          clearTimeout(timer.current);
          if (start.current === null) return;
          start.current = null;
          if (moved.current) setDx(dx < -48 ? -96 : 0);
          else if (dx) setDx(0);
          else onEdit();
        }}
        onPointerCancel={() => { clearTimeout(timer.current); start.current = null; setDx(0); }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm">{m.name}</div>
          <div className="font-mono text-[10px] uppercase">{qty || 'quick add'}</div>
        </div>
        <div className="w-24 text-right font-mono text-xs">{Math.round(m.protein)} / {Math.round(m.carbs)} / {Math.round(m.fat)}</div>
        <div className="w-14 text-right font-mono text-sm font-bold">{m.kcal}</div>
      </div>
    </div>
  );
}

// ---------- Serving picker ----------

function Qty({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [s, setS] = useState(String(value));
  return (
    <input
      inputMode="decimal"
      value={s}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setS(e.target.value);
        const v = parseFloat(e.target.value.replace(',', '.'));
        onChange(Number.isFinite(v) ? v : 0);
      }}
      className="min-h-14 w-full border-2 border-ink px-3 font-mono text-[32px] font-bold"
    />
  );
}

const unitLabel = (f: Food, u: ServingUnit) => (u === 'serving' ? f.servingLabel ?? 'serving' : u === 'piece' ? 'piece' : u);

function ServingPicker({ food, initial, action, onDone }: { food: Food; initial?: { qty: number; unit: ServingUnit }; action: string; onDone: (qty: number, unit: ServingUnit) => void }) {
  const units = unitsFor(food);
  const [unit, setUnit] = useState<ServingUnit>(initial?.unit ?? units[0]);
  const [qty, setQty] = useState(initial?.qty ?? (units[0] === 'g' ? 100 : 1));
  const n = nutrientsFor(food, qty, unit);
  return (
    <div className="space-y-3">
      <div>
        <div className="display text-3xl">{food.name}.</div>
        <div className="font-mono text-[10px] uppercase">{[food.brand, food.source === 'off' ? 'Open Food Facts' : food.source === 'usda' ? 'USDA' : food.source === 'local' ? 'Generic' : food.source].filter(Boolean).join(' · ')}</div>
      </div>
      <div>
        <Label>Unit</Label>
        <div className="flex flex-wrap gap-1.5">
          {units.map((u) => (
            <button key={u} onClick={() => setUnit(u)} aria-pressed={u === unit} className={`min-h-11 border-2 border-ink px-3 font-mono text-xs font-bold uppercase ${u === unit ? 'bg-ink text-page' : ''}`}>
              {unitLabel(food, u)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Quantity</Label>
        <Qty value={qty} onChange={setQty} />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center font-mono">
        {([['kcal', n.kcal], ['P', n.protein], ['C', n.carbs], ['F', n.fat]] as const).map(([k, v]) => (
          <div key={k} className="border-2 border-ink py-2">
            <div className="text-lg font-bold">{fmt(v)}</div>
            <div className="text-[10px] font-bold uppercase">{k}</div>
          </div>
        ))}
      </div>
      <Button className="w-full" disabled={!(qty > 0)} onClick={() => onDone(qty, unit)}>{action}</Button>
    </div>
  );
}

// ---------- Add food sheet ----------

type AddTab = 'search' | 'scan' | 'quick' | 'custom' | 'meals' | 'recipe';

function AddFood(p: { slot: number; slotName: string; date: string; today: string; usdaKey?: string; cached: Food[]; saved: SavedMeal[]; onClose: () => void }) {
  const [tab, setTab] = useState<AddTab>('search');
  const [picked, setPicked] = useState<Food | null>(null);
  const [barcode, setBarcode] = useState<string | undefined>();
  const [msg, setMsg] = useState('');

  const log = async (f: Food, qty: number, unit: ServingUnit) => {
    await logFood(f, qty, unit, p.date, p.slot, p.today);
    p.onClose();
  };

  const onCode = async (code: string) => {
    setMsg('Looking up ' + code + '…');
    const local = await db.foods.where('barcode').equals(code).first();
    const f = local ?? (await lookupBarcode(code));
    if (f) { setMsg(''); setPicked(f); return; }
    setMsg(`No product found for ${code}. Create it below.`);
    setBarcode(code);
    setTab('custom');
  };

  return (
    <Sheet title={`Add to ${p.slotName}`} onClose={p.onClose}>
      {picked ? (
        <div className="space-y-3">
          <button className="min-h-11 border-2 border-ink px-3 font-mono text-xs font-bold uppercase" onClick={() => setPicked(null)}>← Back to results</button>
          <ServingPicker food={picked} action={`Add to ${p.slotName}`} onDone={(q, u) => log(picked, q, u)} />
        </div>
      ) : (
        <>
          <SubTabs
            tabs={[{ id: 'search', label: 'Search' }, { id: 'scan', label: 'Scan' }, { id: 'quick', label: 'Quick add' }, { id: 'custom', label: 'Custom' }, { id: 'meals', label: 'Meals' }, { id: 'recipe', label: 'Recipe' }]}
            value={tab}
            onChange={setTab}
          />
          {msg && <p className="mb-2 font-mono text-xs uppercase"><span className="font-bold">[NOTE]</span> {msg}</p>}
          {tab === 'search' && <FoodSearch cached={p.cached} usdaKey={p.usdaKey} onPick={setPicked} />}
          {tab === 'scan' && (
            <Suspense fallback={<Empty>Starting camera…</Empty>}>
              <Scanner onCode={onCode} />
            </Suspense>
          )}
          {tab === 'quick' && <QuickAddForm onSave={async (n) => { await quickAdd(n, p.date, p.slot, p.today); p.onClose(); }} />}
          {tab === 'custom' && <CustomFoodForm barcode={barcode} onSaved={setPicked} />}
          {tab === 'meals' && (
            <div className="space-y-2">
              {!p.saved.length && <Empty>No saved meals yet. Log a meal, then tap "Save as meal".</Empty>}
              {p.saved.map((sm) => (
                <Card key={sm.id} className="flex items-center gap-2 py-2">
                  <button className="min-h-11 min-w-0 flex-1 text-left" onClick={async () => { await logItems(sm.items, p.date, p.slot, p.today); p.onClose(); }}>
                    <div className="truncate font-mono text-sm font-bold uppercase">{sm.name}</div>
                    <div className="font-mono text-[10px] uppercase">{sm.items.length} items · {totals(sm.items).kcal} kcal · {Math.round(totals(sm.items).protein)}p</div>
                  </button>
                  <button className="min-h-11 min-w-11 border-2 border-ink font-bold" aria-label="Delete saved meal" onClick={() => deleteSavedMeal(sm.id)}>×</button>
                </Card>
              ))}
            </div>
          )}
          {tab === 'recipe' && <RecipeBuilder cached={p.cached} usdaKey={p.usdaKey} onSaved={setPicked} />}
        </>
      )}
    </Sheet>
  );
}

function useFoodResults(q: string, cached: Food[], usdaKey?: string) {
  const [remote, setRemote] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setRemote([]);
    if (q.trim().length < 3 || !navigator.onLine) return;
    const ctl = new AbortController();
    const id = window.setTimeout(async () => {
      setLoading(true);
      const r = await searchRemote(q.trim(), usdaKey, ctl.signal);
      if (!ctl.signal.aborted) { setRemote(r); setLoading(false); }
    }, 450);
    return () => { ctl.abort(); clearTimeout(id); setLoading(false); };
  }, [q, usdaKey]);
  const results = useMemo(() => rankFoods(cached, q.trim() ? searchLocal(q) : [], remote, q, Date.now()).slice(0, 40), [cached, q, remote]);
  return { results, loading };
}

function FoodSearch({ cached, usdaKey, onPick }: { cached: Food[]; usdaKey?: string; onPick: (f: Food) => void }) {
  const [q, setQ] = useState('');
  const { results, loading } = useFoodResults(q, cached, usdaKey);
  return (
    <div className="space-y-2">
      <TextInput autoFocus placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q && <Label>Recent and frequent</Label>}
      <FoodList foods={results} onPick={onPick} />
      {loading && <p className="font-mono text-xs uppercase">[SEARCHING OPEN FOOD FACTS…]</p>}
      {q && !loading && !results.length && <Empty>No matches. Try Custom or Quick add.</Empty>}
    </div>
  );
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <div className="rows border-t-[3px] border-ink">
      {foods.map((f) => (
        <button key={f.id} className="flex min-h-11 w-full items-center gap-2 py-2 text-left" onClick={() => onPick(f)}>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-sm">{f.name}</div>
            <div className="truncate font-mono text-[10px] uppercase">{[f.brand, f.servingLabel].filter(Boolean).join(' · ') || 'per 100 g'}</div>
          </div>
          <div className="text-right font-mono text-xs">
            <div className="font-bold">{f.servingGrams ? Math.round((f.per100.kcal * f.servingGrams) / 100) : f.per100.kcal} kcal</div>
            <div className="text-[10px] uppercase">{f.servingGrams ? 'serving' : '100 g'}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function MacroInputs({ v, set, extra }: { v: Partial<Nutrients>; set: (v: Partial<Nutrients>) => void; extra?: boolean }) {
  const keys: [keyof Nutrients, string][] = [['kcal', 'kcal'], ['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g']];
  if (extra) keys.push(['fiber', 'Fiber g'], ['sugar', 'Sugar g'], ['sodium', 'Sodium mg']);
  return (
    <div className="grid grid-cols-4 gap-2">
      {keys.map(([k, l]) => (
        <div key={k}>
          <Label>{l}</Label>
          <NumberInput value={v[k]} onChange={(x) => set({ ...v, [k]: x })} />
        </div>
      ))}
    </div>
  );
}

function QuickAddForm({ onSave }: { onSave: (n: Nutrients & { name?: string }) => void }) {
  const [name, setName] = useState('');
  const [v, setV] = useState<Partial<Nutrients>>({});
  return (
    <div className="space-y-3">
      <TextInput placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <MacroInputs v={v} set={setV} />
      <Button className="w-full" disabled={v.kcal === undefined} onClick={() => onSave({ name, kcal: v.kcal ?? 0, protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0 })}>Add</Button>
    </div>
  );
}

function CustomFoodForm({ barcode, onSaved }: { barcode?: string; onSaved: (f: Food) => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [code, setCode] = useState(barcode ?? '');
  const [label, setLabel] = useState('1 serving');
  const [grams, setGrams] = useState<number | undefined>(100);
  const [v, setV] = useState<Partial<Nutrients>>({});
  const ok = name && v.kcal !== undefined && grams;
  const save = async () => {
    const k = 100 / (grams || 100);
    const per = (x?: number) => (x === undefined ? undefined : Math.round(x * k * 10) / 10);
    const f = await saveCustomFood({
      name, brand: brand || undefined, barcode: code || undefined, servingGrams: grams, servingLabel: `${label} (${grams} g)`,
      per100: { kcal: Math.round((v.kcal ?? 0) * k), protein: per(v.protein) ?? 0, carbs: per(v.carbs) ?? 0, fat: per(v.fat) ?? 0, fiber: per(v.fiber), sugar: per(v.sugar), sodium: v.sodium === undefined ? undefined : Math.round(v.sodium * k) },
    });
    onSaved(f);
  };
  return (
    <div className="space-y-3">
      <TextInput placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)} />
      <TextInput placeholder="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <TextInput placeholder="Barcode (optional)" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Serving name</Label><TextInput value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><Label>Serving grams/ml</Label><NumberInput value={grams} onChange={setGrams} /></div>
      </div>
      <Label>Per serving</Label>
      <MacroInputs v={v} set={setV} extra />
      <Button className="w-full" disabled={!ok} onClick={save}>Save food</Button>
    </div>
  );
}

function RecipeBuilder({ cached, usdaKey, onSaved }: { cached: Food[]; usdaKey?: string; onSaved: (f: Food) => void }) {
  const [name, setName] = useState('');
  const [servings, setServings] = useState<number | undefined>(4);
  const [items, setItems] = useState<{ food: Food; grams: number }[]>([]);
  const [q, setQ] = useState('');
  const { results } = useFoodResults(q, cached, usdaKey);
  const total = totals(items.map((i) => nutrientsFor(i.food, i.grams, 'g')));
  const per = servings ? Math.round(total.kcal / servings) : 0;
  return (
    <div className="space-y-3">
      <TextInput placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)} />
      <div><Label>Servings</Label><NumberInput value={servings} onChange={setServings} /></div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate font-mono text-sm">{it.food.name}</div>
          <div className="w-24"><NumberInput value={it.grams} onChange={(g) => setItems(items.map((x, j) => (j === i ? { ...x, grams: g ?? 0 } : x)))} /></div>
          <span className="font-mono text-xs">g</span>
          <button className="min-h-11 min-w-11 border-2 border-ink font-bold" aria-label="Remove ingredient" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="font-mono text-xs uppercase">Total {total.kcal} kcal · {per} kcal per serving · {servings ? Math.round(total.protein / servings) : 0}p per serving</div>
      <Button className="w-full" disabled={!name || !items.length || !servings} onClick={async () => onSaved(await saveRecipe(name, items, servings!))}>Save recipe</Button>
      <Label>Add ingredient</Label>
      <TextInput placeholder="Search ingredients" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && <FoodList foods={results.slice(0, 12)} onPick={(f) => { setItems([...items, { food: f, grams: f.servingGrams ?? 100 }]); setQ(''); }} />}
    </div>
  );
}

// ---------- Edit an entry ----------

function EditEntry({ m, names, foods, onClose }: { m: Meal; names: string[]; foods: Food[]; onClose: () => void }) {
  const food = m.foodId ? foods.find((f) => f.id === m.foodId) ?? LOCAL_FOODS.find((f) => f.id === m.foodId) : undefined;
  const [slot, setSlot] = useState(slotOf(m));
  const [v, setV] = useState<Partial<Nutrients>>({ kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat });
  return (
    <Sheet title="Edit entry" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Meal</Label>
          <Segmented options={[0, 1, 2, 3]} labels={names} value={slot} onChange={(s) => s !== undefined && setSlot(s)} />
        </div>
        {food && m.qty !== undefined && m.unit ? (
          <ServingPicker food={food} initial={{ qty: m.qty, unit: m.unit }} action="Save" onDone={async (q, u) => { await updateServing({ ...m, slot }, food, q, u); onClose(); }} />
        ) : (
          <div className="space-y-3">
            <div className="display text-3xl">{m.name}.</div>
            <MacroInputs v={v} set={setV} />
            <Button className="w-full" onClick={async () => { await updateEntry({ ...m, slot, kcal: v.kcal ?? 0, protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0 }); onClose(); }}>Save</Button>
          </div>
        )}
        <Button variant="danger" className="w-full" onClick={async () => { await db.meals.delete(m.id); onClose(); }}>Delete</Button>
      </div>
    </Sheet>
  );
}

// ---------- Targets ----------

function TargetsSheet({ base, current, override, onClose }: { base: { kcal: number; protein: number; carbs: number; fat: number }; current: { kcal: number; protein: number; carbs: number; fat: number }; override?: TargetOverride; onClose: () => void }) {
  const [mode, setMode] = useState<'engine' | 'grams' | 'pct'>(override?.pct ? 'pct' : override ? 'grams' : 'engine');
  const [g, setG] = useState<Partial<Nutrients>>({ kcal: current.kcal, protein: current.protein, carbs: current.carbs, fat: current.fat });
  const [pct, setPct] = useState(override?.pct ?? macroPct(current));
  const pctSum = pct.protein + pct.carbs + pct.fat;
  const save = async () => {
    if (mode === 'engine') await saveProfile({ targetOverride: undefined });
    else if (mode === 'grams') await saveProfile({ targetOverride: { kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat } });
    else await saveProfile({ targetOverride: { kcal: g.kcal, pct } });
    onClose();
  };
  return (
    <Sheet title="Targets" onClose={onClose}>
      <div className="space-y-4">
        <p className="font-mono text-xs uppercase">
          Engine targets today: <span className="font-mono">{base.kcal} kcal · {base.protein}p {base.carbs}c {base.fat}f</span>. They follow your weight, goal and training days.
        </p>
        <Segmented options={['engine', 'grams', 'pct'] as const} labels={['Engine', 'Grams', '% of kcal']} value={mode} onChange={(m) => m && setMode(m)} />
        {mode !== 'engine' && (
          <div>
            <Label>Calories</Label>
            <NumberInput value={g.kcal} onChange={(k) => setG({ ...g, kcal: k })} />
          </div>
        )}
        {mode === 'grams' && (
          <div className="grid grid-cols-3 gap-2">
            {(['protein', 'carbs', 'fat'] as const).map((k) => (
              <div key={k}><Label>{k} g</Label><NumberInput value={g[k]} onChange={(x) => setG({ ...g, [k]: x })} /></div>
            ))}
          </div>
        )}
        {mode === 'pct' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(['protein', 'carbs', 'fat'] as const).map((k) => (
                <div key={k}><Label>{k} %</Label><NumberInput value={pct[k]} onChange={(x) => setPct({ ...pct, [k]: x ?? 0 })} /></div>
              ))}
            </div>
            <p className="font-mono text-xs uppercase">Total {pctSum}% {pctSum !== 100 && <span className="font-bold">[MUST BE 100]</span>}</p>
          </>
        )}
        <Button className="w-full" disabled={mode === 'pct' && pctSum !== 100} onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}

function RenameSheet({ names, onClose }: { names: string[]; onClose: () => void }) {
  const [v, setV] = useState(names);
  return (
    <Sheet title="Rename meals" onClose={onClose}>
      <div className="space-y-2">
        {v.map((n, i) => <TextInput key={i} value={n} onChange={(e) => setV(v.map((x, j) => (j === i ? e.target.value : x)))} />)}
        <Button className="w-full" onClick={async () => { await saveProfile({ mealNames: v }); onClose(); }}>Save</Button>
      </div>
    </Sheet>
  );
}
