import { useState } from 'react';
import { todayKey } from '../../data/db';
import { addMeal, deleteMeal, toggleFavorite, useData } from '../../data/repo';
import { dayForDate, proteinTarget } from '../../data/plan';
import { Button, Card, Label, NumberInput, PageHeader, TextInput } from '../../components/ui';

export default function Nutrition() {
  const data = useData();
  const [form, setForm] = useState({ name: '', kcal: undefined as number | undefined, protein: undefined as number | undefined, carbs: undefined as number | undefined, fat: undefined as number | undefined });
  if (!data) return null;
  const { profile, days, meals } = data;
  const today = todayKey();
  const training = !!dayForDate(days, today);
  const t = proteinTarget(profile, training);
  const eaten = meals.filter((m) => m.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const sum = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => eaten.reduce((a, m) => a + m[k], 0);

  const favs = [...new Map(meals.filter((m) => m.isFavorite).map((m) => [m.name, m])).values()];

  const add = async () => {
    if (!form.name || form.kcal === undefined) return;
    await addMeal({ name: form.name, kcal: form.kcal, protein: form.protein ?? 0, carbs: form.carbs ?? 0, fat: form.fat ?? 0, isFavorite: false });
    setForm({ name: '', kcal: undefined, protein: undefined, carbs: undefined, fat: undefined });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Nutrition" sub={`${training ? 'Training day' : 'Rest day'} targets`} back />

      <Card className="space-y-2">
        {(
          [
            ['Calories', 'kcal', t.kcal, ''],
            ['Protein', 'protein', t.protein, 'g'],
            ['Carbs', 'carbs', t.carbs, 'g'],
            ['Fat', 'fat', t.fat, 'g'],
          ] as const
        ).map(([label, k, target, u]) => {
          const v = sum(k);
          return (
            <div key={k}>
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="font-mono">
                  {v}/{target}
                  {u}
                </span>
              </div>
              <div className="h-2 rounded bg-line">
                <div className={`h-2 rounded ${v > target * 1.1 ? 'bg-warn' : 'bg-lime'}`} style={{ width: `${Math.min(100, (v / target) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </Card>

      {favs.length > 0 && (
        <div>
          <Label>Favorites — one tap to add</Label>
          <div className="flex flex-wrap gap-2">
            {favs.map((f) => (
              <button
                key={f.id}
                className="min-h-11 rounded-xl border border-line px-3 text-sm"
                onClick={() => addMeal({ name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, isFavorite: false })}
              >
                {f.name} <span className="font-mono text-mute">{f.protein}p</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Card className="space-y-2">
        <div className="font-bold">Quick add</div>
        <TextInput placeholder="What did you eat?" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-4 gap-2">
          {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k}>
              <Label>{k === 'kcal' ? 'kcal' : k[0].toUpperCase() + ' g'}</Label>
              <NumberInput value={form[k]} onChange={(v) => setForm({ ...form, [k]: v })} />
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={add} disabled={!form.name || form.kcal === undefined}>
          Add meal
        </Button>
      </Card>

      <div className="space-y-2">
        {eaten.map((m) => (
          <Card key={m.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate">{m.name}</div>
              <div className="font-mono text-xs text-mute">
                {m.time} · {m.kcal} kcal · {m.protein}p {m.carbs}c {m.fat}f
              </div>
            </div>
            <button className={`min-h-11 min-w-11 text-sm ${m.isFavorite ? 'text-lime' : 'text-mute'}`} onClick={() => toggleFavorite(m.id)}>
              {m.isFavorite ? 'Fav' : '+Fav'}
            </button>
            <button className="min-h-11 min-w-11 text-mute" aria-label="Delete meal" onClick={() => deleteMeal(m.id)}>
              ×
            </button>
          </Card>
        ))}
        {!eaten.length && <p className="text-sm text-mute">Nothing logged today.</p>}
      </div>
    </div>
  );
}
