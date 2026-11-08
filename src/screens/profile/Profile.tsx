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
import { LabTable, shortDate, useGrainSetting } from '../../components/riso';
import { PledgeScreen } from '../onboarding/Pledge';

export default function Profile() {
  return (
    <Routes>
      <Route index element={<ProfileHome />} />
      <Route path="coach" element={<CoachDashboard />} />
      <Route path="coach/:clientId" element={<ClientDetail />} />
      <Route path="ai" element={<AiCoachChat />} />
      <Route path="pledge" element={<PledgeScreen />} />
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
  const grain = useGrainSetting();

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" section="ME" />

      <Button className="min-h-14 w-full" onClick={() => nav('/profile/ai')}>
        Ask the AI Coach
      </Button>

      <Card className="spec">
        <h3 className="font-mono text-[10px] font-bold uppercase">Spec sheet — subject</h3>
        <div>
          <Label>Name</Label>
          <TextInput value={p.name} onChange={(e) => saveProfile({ name: e.target.value })} />
        </div>
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
          <input type="date" value={p.programStartDate} onChange={(e) => e.target.value && saveProfile({ programStartDate: e.target.value })} className="min-h-11 w-full border-2 border-ink px-3" />
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-mono text-[10px] font-bold uppercase">Daily targets</div>
        <LabTable
          head={['Day', 'kcal', 'P / C / F g']}
          align={['l', 'r', 'r']}
          bold={[1]}
          rows={[
            { key: 't', cells: ['Training', train.kcal, `${train.protein} / ${train.carbs} / ${train.fat}`] },
            { key: 'r', cells: ['Rest', rest.kcal, `${rest.protein} / ${rest.carbs} / ${rest.fat}`] },
          ]}
        />
        <div className="mt-2 font-mono text-[10px] uppercase">Mifflin–St Jeor × 1.55, adjusted for your goal.</div>
      </Card>

      <Card className="spec">
        <h3 className="font-mono text-[10px] font-bold uppercase">Spec sheet — engine</h3>
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
        <div>
          <Label>Rest compound</Label>
          <Stepper value={p.restCompoundSec} step={15} min={30} suffix="s" onChange={(v) => saveProfile({ restCompoundSec: v })} />
        </div>
        <div>
          <Label>Rest isolation</Label>
          <Stepper value={p.restIsolationSec} step={15} min={15} suffix="s" onChange={(v) => saveProfile({ restIsolationSec: v })} />
        </div>
        <div>
          <Label>Grain</Label>
          <div className="font-mono text-[10px] uppercase">Photocopy texture on headers and cards. Never on the workout logger.</div>
          <Segmented
            options={['off', 'subtle', 'full'] as const}
            labels={['Off', 'Subtle', 'Full']}
            value={p.grain ?? grain}
            onChange={(v) => v && saveProfile({ grain: v })}
          />
        </div>
        <div>
          <Label>Return-from-break mode</Label>
          <div className="font-mono text-[10px] uppercase">For coming back after 4+ weeks off. Ramps you back over 4 weeks, then switches itself off.</div>
          <Segmented
            options={['off', 'on'] as const}
            labels={['Off', 'On']}
            value={p.returnFromBreakStart ? 'on' : 'off'}
            onChange={(v) => saveProfile({ returnFromBreakStart: v === 'on' ? todayKey() : null })}
          />
          {phase && phase.name !== 'Done' && (
            <div className="font-mono text-xs uppercase">
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

      <Card className="spec">
        <h3 className="font-mono text-[10px] font-bold uppercase">Spec sheet — sharing with Spotters</h3>
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
          <div className="font-mono text-[10px] uppercase">Shares your gym, training days, split and strength level so people can match with you. Spotters you've added still see them.</div>
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
        <div className="font-mono text-[10px] uppercase">Never shared: check-ins, sleep, body weight log, meals, photos and measurements.</div>
      </Card>

      <Card className="spec">
        <h3 className="font-mono text-[10px] font-bold uppercase">Spec sheet — food database</h3>
        <div>
          <Label>USDA API key</Label>
          <div className="font-mono text-[10px] uppercase">
            Search uses a built-in list of generic foods plus Open Food Facts (free, open data). For more whole foods, add a free USDA FoodData Central key from api.data.gov (optional).
          </div>
          <TextInput key={p.usdaKey ?? ''} placeholder="Optional" defaultValue={p.usdaKey ?? ''} onBlur={(e) => saveProfile({ usdaKey: e.target.value.trim() || undefined })} />
        </div>
      </Card>

      <Card className="spec">
        <h3 className="font-mono text-[10px] font-bold uppercase">Spec sheet — pledge</h3>
        <div>
          <Label>Signed</Label>
          <div className="font-mono text-sm font-bold">{p.pledgeDate ? shortDate(p.pledgeDate) : '[NOT SIGNED]'}</div>
          <Button variant="ghost" onClick={() => nav('/profile/pledge')}>
            {p.pledgeDate ? 'View / share pledge' : 'Sign the pledge'}
          </Button>
        </div>
      </Card>

      <Card className="space-y-2">
        <div className="font-mono text-[10px] font-bold uppercase">Your data</div>
        <div className="font-mono text-xs uppercase">Everything lives on this device. Export a backup now and then.</div>
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
