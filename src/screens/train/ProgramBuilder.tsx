import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../data/db';
import { addDay, applyTemplate, deleteDay, saveDay, useProfile, useProgram } from '../../data/repo';
import { EXERCISES } from '../../data/exercises';
import { TEMPLATES } from '../../data/templates';
import { exById } from '../../data/plan';
import { isCompound, type ProgramDay, type ProgramExercise, type Technique } from '../../engine';
import { Button, Card, Label, NumberInput, PageHeader, Segmented, Sheet, Stepper, TextInput } from '../../components/ui';
import { weekdayLabel } from './Train';

export function ProgramList() {
  const nav = useNavigate();
  const days = useProgram();
  if (!days) return null;
  return (
    <div className="space-y-4">
      <PageHeader title="Program" back />
      <div className="space-y-2">
        {days.map((d) => (
          <Card key={d.id} onClick={() => nav(`/train/program/${d.id}`)}>
            <div className="font-bold">{d.name}</div>
            <div className="text-sm text-mute">
              {weekdayLabel(d.weekdays)} · {d.exercises.map((e) => exById(e.exerciseId).name).join(', ') || 'No exercises'}
            </div>
          </Card>
        ))}
        <Button variant="ghost" className="w-full" onClick={async () => nav(`/train/program/${await addDay()}`)}>
          Add day
        </Button>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">Start from a template</h2>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold">{t.name}</div>
                  <div className="text-sm text-mute">{t.description}</div>
                </div>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (confirm(`Replace your program with ${t.name}? Your workout history is kept.`)) await applyTemplate(t.id);
                  }}
                >
                  Use
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

const TECHS: Technique[] = ['none', 'dropset', 'restpause', 'failure'];
const TECH_LABELS = ['None', 'Drop', 'Rest-P', 'Failure'];
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DayEditor() {
  const { dayId } = useParams();
  const nav = useNavigate();
  const profile = useProfile();
  const [day, setDay] = useState<ProgramDay | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    db.programDays.get(dayId!).then((d) => setDay(d ?? null));
  }, [dayId]);
  if (!day) return null;

  const update = (next: ProgramDay) => {
    setDay(next);
    saveDay(next);
  };
  const setEx = (i: number, patch: Partial<ProgramExercise>) =>
    update({ ...day, exercises: day.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const move = (i: number, d: number) => {
    const list = [...day.exercises];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    update({ ...day, exercises: list });
  };
  const small = profile.units === 'lb' ? 2.5 : 1.25;

  return (
    <div className="space-y-4">
      <PageHeader title="Edit day" back />
      <TextInput value={day.name} onChange={(e) => update({ ...day, name: e.target.value })} />
      <div>
        <Label>Weekdays</Label>
        <div className="flex gap-1.5">
          {WD.map((l, i) => {
            const on = day.weekdays.includes(i);
            return (
              <button
                key={i}
                onClick={() => update({ ...day, weekdays: on ? day.weekdays.filter((x) => x !== i) : [...day.weekdays, i] })}
                className={`min-h-11 flex-1 rounded-lg border ${on ? 'border-lime bg-lime font-bold text-bg' : 'border-line'}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {day.exercises.map((pe, i) => {
        const ex = exById(pe.exerciseId);
        return (
          <Card key={`${pe.exerciseId}-${i}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-bold">{ex.name}</div>
              <div className="flex shrink-0">
                <button className="min-h-11 min-w-11 text-mute" aria-label="Move up" onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button className="min-h-11 min-w-11 text-mute" aria-label="Move down" onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button
                  className="min-h-11 min-w-11 text-warn"
                  aria-label="Remove"
                  onClick={() => update({ ...day, exercises: day.exercises.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stepper label="Sets" value={pe.sets} min={1} step={1} onChange={(v) => setEx(i, { sets: v })} />
              <Stepper label={`Increment ${profile.units}`} value={pe.increment} step={small} onChange={(v) => setEx(i, { increment: v })} />
              <Stepper label="Rep min" value={pe.repMin} min={1} step={1} onChange={(v) => setEx(i, { repMin: Math.min(v, pe.repMax) })} />
              <Stepper label="Rep max" value={pe.repMax} min={1} step={1} onChange={(v) => setEx(i, { repMax: Math.max(v, pe.repMin) })} />
            </div>
            {ex.equipment !== 'bodyweight' && (
              <div className="mt-2">
                <Label>Start weight ({profile.units}) — blank = ask on first set</Label>
                <NumberInput value={pe.startWeight} onChange={(v) => setEx(i, { startWeight: v })} />
              </div>
            )}
            <div className="mt-2">
              <Label>Technique</Label>
              <Segmented options={TECHS} labels={TECH_LABELS} value={pe.technique ?? 'none'} onChange={(v) => setEx(i, { technique: v ?? 'none' })} />
            </div>
          </Card>
        );
      })}

      <Button className="w-full" onClick={() => setAdding(true)}>
        Add exercise
      </Button>
      <Button
        variant="danger"
        className="w-full"
        onClick={async () => {
          if (confirm(`Delete ${day.name}?`)) {
            await deleteDay(day.id);
            nav('/train/program');
          }
        }}
      >
        Delete day
      </Button>

      {adding && (
        <ExercisePicker
          onClose={() => setAdding(false)}
          onPick={(id) => {
            const ex = exById(id);
            const bw = ex.equipment === 'bodyweight';
            const inc = bw ? 0 : isCompound(ex) ? (profile.units === 'lb' ? 5 : 2.5) : small;
            update({
              ...day,
              exercises: [...day.exercises, { exerciseId: id, sets: 3, repMin: isCompound(ex) ? 6 : 10, repMax: isCompound(ex) ? 10 : 15, increment: inc, technique: 'none', startWeight: bw ? 0 : undefined }],
            });
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

export function ExercisePicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const list = EXERCISES.filter(
    (e) => !s || e.name.toLowerCase().includes(s) || e.primaryMuscles.some((m) => m.includes(s)) || e.equipment.includes(s),
  );
  return (
    <Sheet title="Exercise library" onClose={onClose}>
      <TextInput autoFocus placeholder="Search name, muscle or equipment" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 divide-y divide-line">
        {list.map((e) => (
          <button key={e.id} className="flex min-h-12 w-full items-center justify-between py-2 text-left" onClick={() => onPick(e.id)}>
            <span>{e.name}</span>
            <span className="text-xs text-mute">
              {e.equipment} · {e.primaryMuscles.join(', ')}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
