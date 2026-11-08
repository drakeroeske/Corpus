import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, todayKey } from '../../data/db';
import { applyTemplate, saveProfile, useProfile } from '../../data/repo';
import { TEMPLATES } from '../../data/templates';
import { loadDemoData } from '../../data/demo';
import { LB_PER_KG, type Goal, type Units } from '../../engine';
import { Button, Card, Label, NumberInput, Segmented, TextInput } from '../../components/ui';

const STEPS = ['Profile', 'Goal', 'Units', 'Program'];

export default function Onboarding() {
  const nav = useNavigate();
  const p = useProfile();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const finish = async (templateId: string | null) => {
    setBusy(true);
    if (templateId) await applyTemplate(templateId);
    else await db.programDays.clear();
    await saveProfile({ onboarded: true, programStartDate: todayKey() });
    nav(templateId ? '/today' : '/train/program', { replace: true });
  };

  const skip = async () => {
    setBusy(true);
    await loadDemoData();
    nav('/today', { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 bg-lime" />
          <span className="text-xl font-bold tracking-wide">CORPUS</span>
        </div>
        <Button variant="ghost" className="text-sm" onClick={skip} disabled={busy}>
          Skip: load demo
        </Button>
      </div>
      <div>
        <p className="text-sm text-mute">Every rep, meal, and night's sleep — connected.</p>
        <div className="mt-3 flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded ${i <= step ? 'bg-lime' : 'bg-line'}`} />
          ))}
        </div>
        <h1 className="mt-3 text-3xl font-bold">{STEPS[step]}</h1>
      </div>

      {step === 0 && (
        <Card className="space-y-3">
          <div>
            <Label>Name</Label>
            <TextInput value={p.name === 'You' ? '' : p.name} placeholder="Your name" onChange={(e) => saveProfile({ name: e.target.value || 'You' })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Weight {p.units}</Label>
              <NumberInput value={p.bodyWeight} onChange={(v) => v && saveProfile({ bodyWeight: v })} />
            </div>
            <div>
              <Label>Height cm</Label>
              <NumberInput value={p.heightCm} onChange={(v) => v && saveProfile({ heightCm: v })} />
            </div>
            <div>
              <Label>Age</Label>
              <NumberInput value={p.age} onChange={(v) => v && saveProfile({ age: v })} />
            </div>
          </div>
          <div>
            <Label>Sex (optional)</Label>
            <Segmented options={['male', 'female'] as const} labels={['Male', 'Female']} value={p.sex} allowClear onChange={(v) => saveProfile({ sex: v })} />
          </div>
          <div>
            <Label>Experience</Label>
            <Segmented
              options={['beginner', 'intermediate', 'advanced'] as const}
              labels={['Beginner', 'Intermed.', 'Advanced']}
              value={p.experience}
              onChange={(v) => v && saveProfile({ experience: v })}
            />
          </div>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-2">
          {(
            [
              ['muscle', 'Build muscle', '+250 kcal, 2.0 g/kg protein'],
              ['strength', 'Get stronger', '+150 kcal, 2.0 g/kg protein'],
              ['fatloss', 'Lose fat', '−400 kcal, 1.8 g/kg protein'],
              ['recomp', 'Recomp', 'Maintenance, 2.2 g/kg protein'],
            ] as [Goal, string, string][]
          ).map(([g, label, sub]) => (
            <Card key={g} onClick={() => saveProfile({ goal: g })} className={p.goal === g ? 'border-lime' : ''}>
              <div className="font-bold">{label}</div>
              <div className="text-sm text-mute">{sub}</div>
            </Card>
          ))}
        </div>
      )}

      {step === 2 && (
        <Segmented<Units>
          options={['lb', 'kg']}
          labels={['Pounds (lb)', 'Kilograms (kg)']}
          value={p.units}
          onChange={(v) => {
            if (!v || v === p.units) return;
            const bw = v === 'kg' ? p.bodyWeight / LB_PER_KG : p.bodyWeight * LB_PER_KG;
            saveProfile({ units: v, bodyWeight: Math.round(bw * 10) / 10 });
          }}
        />
      )}

      {step === 3 && (
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <Card key={t.id} onClick={() => !busy && finish(t.id)}>
              <div className="font-bold">{t.name}</div>
              <div className="text-sm text-mute">{t.description}</div>
            </Card>
          ))}
          <Card onClick={() => !busy && finish(null)}>
            <div className="font-bold">Build my own</div>
            <div className="text-sm text-mute">Start empty and add days in the program builder.</div>
          </Card>
        </div>
      )}

      {step < 3 && (
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="ghost" className="h-14 flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button className="h-14 flex-1 text-lg" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
