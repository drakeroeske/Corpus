import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, todayKey } from '../../data/db';
import { applyTemplate, saveProfile, useProfile } from '../../data/repo';
import { TEMPLATES } from '../../data/templates';
import { loadDemoData } from '../../data/demo';
import { LB_PER_KG, type Goal, type Units } from '../../engine';
import { Button, Card, Label, NumberInput, Segmented, TextInput } from '../../components/ui';
import { CornerLabels, Grain } from '../../components/riso';
import { Logo, Orbit } from '../../components/diagrams';
import { Pledge } from './Pledge';

const STEPS = ['Profile', 'Goal', 'Units', 'Program', 'Pledge'];

export default function Onboarding() {
  const nav = useNavigate();
  const p = useProfile();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dest, setDest] = useState('/today');

  const finish = async (templateId: string | null) => {
    setBusy(true);
    if (templateId) await applyTemplate(templateId);
    else await db.programDays.clear();
    await saveProfile({ programStartDate: todayKey() });
    setDest(templateId ? '/today' : '/train/program');
    setBusy(false);
    setStep(4);
  };

  const done = async () => {
    await saveProfile({ onboarded: true });
    nav(dest, { replace: true });
  };

  const skip = async () => {
    setBusy(true);
    await loadDemoData();
    nav('/today', { replace: true });
  };

  return (
    <div className="space-y-5">
      <CornerLabels left="SPOTTER // SETUP" center={`STEP 0${step + 1} / 0${STEPS.length}`} right={step === 4 ? '[SIGN]' : '[NEW]'} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={36} />
          <span className="display text-3xl">CORPUS</span>
        </div>
        {step < 4 && (
          <Button variant="ghost" className="text-xs" onClick={skip} disabled={busy}>
            Skip: load demo
          </Button>
        )}
      </div>
      <div className="relative -mx-4 border-y-[3px] border-ink bg-signal px-4 py-4">
        <Grain />
        <div className="relative flex items-end justify-between gap-2">
          <h1 className="display text-[clamp(48px,17vw,72px)]">{STEPS[step]}.</h1>
          {step === 0 && <Orbit size={64} />}
        </div>
        <p className="relative mt-1 text-sm font-bold uppercase">Every rep, meal, and night's sleep — connected.</p>
      </div>
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-3 flex-1 border-2 border-ink ${i <= step ? 'bg-ink' : ''}`} />
        ))}
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
            <Card key={g} onClick={() => saveProfile({ goal: g })} className={p.goal === g ? 'bg-ink text-page' : ''}>
              <div className="font-bold uppercase">
                {p.goal === g ? '[x] ' : '[ ] '}
                {label}
              </div>
              <div className="text-xs uppercase">{sub}</div>
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
              <div className="font-bold uppercase">{t.name}</div>
              <div className="text-xs">{t.description}</div>
            </Card>
          ))}
          <Card onClick={() => !busy && finish(null)}>
            <div className="font-bold uppercase">Build my own</div>
            <div className="text-xs">Start empty and add days in the program builder.</div>
          </Card>
        </div>
      )}

      {step === 4 && <Pledge onDone={done} allowLater />}

      {step < 3 && (
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="ghost" className="min-h-14 flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button className="min-h-14 flex-1" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
