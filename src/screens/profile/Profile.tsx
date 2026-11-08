import { useRef } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { todayKey } from '../../data/db';
import { changeUnits, saveProfile, useProfile } from '../../data/repo';
import { proteinTarget } from '../../data/plan';
import { exportJson, importJson, resetAll } from '../../data/backup';
import { breakPhase, type Experience, type Goal, type Sex } from '../../engine';
import { Button, Card, Label, NumberInput, PageHeader, Segmented, Stepper, TextInput } from '../../components/ui';
import { CoachDashboard, ClientDetail } from './Coach';
import AiCoachChat from './AiCoach';
import { loadDemoData } from '../../data/demo';
import { syncMeNow } from '../../services/social';

export default function Profile() {
  return (
    <Routes>
      <Route index element={<ProfileHome />} />
      <Route path="coach" element={<CoachDashboard />} />
      <Route path="coach/:clientId" element={<ClientDetail />} />
      <Route path="ai" element={<AiCoachChat />} />
    </Routes>
  );
}

function ProfileHome() {
  const nav = useNavigate();
  const p = useProfile();
  const file = useRef<HTMLInputElement>(null);
  const train = proteinTarget(p, true);
  const rest = proteinTarget(p, false);
  const phase = breakPhase(p.returnFromBreakStart, todayKey());

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" />

      <Button className="h-14 w-full text-lg" onClick={() => nav('/profile/ai')}>
        Ask the AI Coach
      </Button>

      <Card className="space-y-3">
        <div>
          <Label>Name</Label>
          <TextInput value={p.name} onChange={(e) => saveProfile({ name: e.target.value })} />
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
          <Label>Sex (optional, for calorie and DOTS formulas)</Label>
          <Segmented<Sex> options={['male', 'female']} labels={['Male', 'Female']} value={p.sex} allowClear onChange={(v) => saveProfile({ sex: v })} />
        </div>
        <div>
          <Label>Experience</Label>
          <Segmented<Experience> options={['beginner', 'intermediate', 'advanced']} labels={['Beginner', 'Intermed.', 'Advanced']} value={p.experience} onChange={(v) => v && saveProfile({ experience: v })} />
        </div>
        <div>
          <Label>Goal</Label>
          <Segmented<Goal> options={['muscle', 'strength', 'fatloss', 'recomp']} labels={['Muscle', 'Strength', 'Fat loss', 'Recomp']} value={p.goal} onChange={(v) => v && saveProfile({ goal: v })} />
        </div>
        <div>
          <Label>Program start date</Label>
          <input type="date" value={p.programStartDate} onChange={(e) => e.target.value && saveProfile({ programStartDate: e.target.value })} className="min-h-11 w-full rounded-xl border border-line px-3" />
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-bold">Daily targets</div>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          <div>
            <div className="font-head text-xs text-mute">Training day</div>
            {train.kcal} kcal
            <br />
            {train.protein}p {train.carbs}c {train.fat}f
          </div>
          <div>
            <div className="font-head text-xs text-mute">Rest day</div>
            {rest.kcal} kcal
            <br />
            {rest.protein}p {rest.carbs}c {rest.fat}f
          </div>
        </div>
        <div className="mt-2 text-xs text-mute">Mifflin–St Jeor × 1.55, adjusted for your goal.</div>
      </Card>

      <Card className="space-y-3">
        <div>
          <Label>Units</Label>
          <Segmented
            options={['lb', 'kg'] as const}
            value={p.units}
            onChange={async (v) => {
              if (v && v !== p.units && confirm(`Switch to ${v}? All stored weights will be converted.`)) await changeUnits(v);
            }}
          />
        </div>
        <div className="flex gap-2">
          <Stepper label="Rest compound" value={p.restCompoundSec} step={15} min={30} suffix="s" onChange={(v) => saveProfile({ restCompoundSec: v })} />
          <Stepper label="Rest isolation" value={p.restIsolationSec} step={15} min={15} suffix="s" onChange={(v) => saveProfile({ restIsolationSec: v })} />
        </div>
        <div>
          <Label>Return-from-break mode</Label>
          <div className="mb-1 text-xs text-mute">For coming back after 4+ weeks off. Ramps you back over 4 weeks, then switches itself off.</div>
          <Segmented
            options={['off', 'on'] as const}
            labels={['Off', 'On']}
            value={p.returnFromBreakStart ? 'on' : 'off'}
            onChange={(v) => saveProfile({ returnFromBreakStart: v === 'on' ? todayKey() : null })}
          />
          {phase && phase.name !== 'Done' && (
            <div className="mt-1 text-sm text-info">
              Week {phase.week}: {phase.name} — {phase.detail}
            </div>
          )}
        </div>
        <div>
          <Label>Coach mode</Label>
          <Segmented options={['off', 'on'] as const} labels={['Off', 'On']} value={p.isCoach ? 'on' : 'off'} onChange={(v) => saveProfile({ isCoach: v === 'on' })} />
          {p.isCoach && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => nav('/profile/coach')}>
              Open coach dashboard
            </Button>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="font-bold">Sharing with Spotters</div>
        <div>
          <Label>Finished workouts post to the feed</Label>
          <Segmented
            options={['all', 'prs', 'off'] as const}
            labels={['Full card', 'PRs only', 'Off']}
            value={p.sharePosts ?? 'all'}
            onChange={(v) => v && saveProfile({ sharePosts: v })}
          />
        </div>
        <div>
          <Label>Show me in Find a Spotter</Label>
          <div className="mb-1 text-xs text-mute">Shares your gym, training days, split and strength level so people can match with you. Spotters you've added still see them.</div>
          <Segmented
            options={['on', 'off'] as const}
            labels={['On', 'Off']}
            value={(p.discoverable ?? true) ? 'on' : 'off'}
            onChange={async (v) => {
              if (!v) return;
              await saveProfile({ discoverable: v === 'on' });
              syncMeNow();
            }}
          />
        </div>
        <div className="text-xs text-mute">Never shared: check-ins, sleep, body weight log, meals, photos and measurements.</div>
      </Card>

      <Card className="space-y-2">
        <div className="font-bold">Your data</div>
        <div className="text-xs text-mute">Everything lives on this device. Export a backup now and then.</div>
        <Button variant="ghost" className="w-full" onClick={exportJson}>
          Export backup (JSON)
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => file.current?.click()}>
          Import backup
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !confirm('Replace all data on this device with this backup?')) return;
            try {
              await importJson(f);
              alert('Backup imported.');
            } catch (err) {
              alert((err as Error).message);
            }
          }}
        />
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            if (confirm('Load 8 weeks of demo data? This replaces your current data.')) {
              await loadDemoData();
              nav('/today');
            }
          }}
        >
          Load demo data
        </Button>
        <Button variant="danger" className="w-full" onClick={() => confirm('Delete ALL data on this device? This cannot be undone.') && resetAll()}>
          Reset everything
        </Button>
      </Card>
    </div>
  );
}
