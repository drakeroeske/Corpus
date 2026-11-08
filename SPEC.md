# Corpus — v1 Prototype Spec

Corpus is a mobile-first, science-based training engine for gymgoers. It connects training, sleep, nutrition and recovery into one system that tells the user exactly what to lift each day, learns from every set, and lets them share progress with friends ("Spotters").

Tagline: **Every rep, meal, and night's sleep — connected.**

v1 is a **frontend-only prototype** (no backend). Social, watch sync and AI coach are **simulated** with local demo data, built behind clean interfaces so a real backend can replace them later.

---

## Tech stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS
- React Router
- Zustand for app state, Dexie (IndexedDB) for persistence
- Recharts for charts
- Vitest for engine unit tests
- vite-plugin-pwa (installable, offline)
- No other dependencies unless essential

## Folder structure

```
src/
  engine/        pure logic, no React, no storage — fully unit tested
  data/          Dexie db, repositories, exercise library, demo-data seeder
  services/      interfaces + simulated implementations: watchSync, social, aiCoach
  store/         Zustand stores
  screens/       one folder per tab
  components/    shared UI
  theme/         tokens
```

---

## Design system

- Background `#0E0F0C`, surface `#1A1B18`, border `#2A2C27`, text `#F2F2EE`, muted `#A3A69D`
- Accent lime `#C6F432`, warning orange `#FF6A2B`, info blue `#4DA3FF`
- Fonts: Space Grotesk (UI/headings), JetBrains Mono (all numbers)
- Lab-instrument feel: clean, data-dense, minimal. No emoji, no gradients
- Tap targets ≥ 44px, one-handed use mid-workout
- Mobile-first at 390px; usable on desktop (centered max-width 480px column)
- Bottom tabs: **Today · Train · Body · Spotters · Profile**

---

## Data model (TypeScript types in `src/engine/types.ts`)

- `UserProfile`: name, units (lb|kg), bodyWeight, heightCm, age, sex?, experience, goal (muscle|strength|fatloss|recomp), programStartDate, returnFromBreakStart? (null = off), isCoach
- `Exercise`: id, name, primaryMuscles[], secondaryMuscles[], equipment, pattern (squat|hinge|hpush|vpush|hpull|vpull|isolation|carry)
- `ProgramDay`: id, name, weekday(s), exercises: `ProgramExercise[]`
- `ProgramExercise`: exerciseId, sets, repMin, repMax, startWeight?, increment, technique? (none|dropset|restpause|failure)
- `WorkoutSession`: id, date, programDayId, sets: `LoggedSet[]`, durationSec, notes
- `LoggedSet`: exerciseId, setIndex, weight, reps, rir?, isWarmup
- `CheckIn`: date, bodyWeight?, sleepHours?, sleepQuality?, hrv?, restingHr?, energy?, stress?, soreness: Record<Muscle, 1–5>, steps?, notes, experimentFlag?
- `Meal`: id, date, time, name, kcal, protein, carbs, fat, isFavorite
- `Experiment`: id, type, startDate, baselineDays (14), lengthDays (28), status
- Social (simulated): `Spotter`, `FeedPost`, `Comment`, `Crew`, `GymCheckIn`
- Coaching (simulated): `Client`, `CoachNote`

Muscles: chest, back, lats, upper back, front delts, side delts, rear delts, biceps, triceps, quads, hamstrings, glutes, adductors, calves, core.

---

## The engine (`src/engine/`) — implement exactly, unit-test every rule

### Progression (based on first working set)
- reps ≥ repMax → next target = weight + increment
- repMin ≤ reps < repMax → same weight, target reps + 1
- reps < repMin → hold; if below range 2 sessions in a row → reduce 10%, round to nearest increment
- Bodyweight exercises: at repMax → suggest "add load"
- No history → startWeight, or prompt user to enter on first set

### Estimated 1RM
`e1RM = weight × (1 + reps/30)`, rounded to 0.1. A new max per exercise = PR.

### Readiness (0–100)
- Sleep hours: 30 pts (8h+ = 30, linear to 0 at 4h)
- Sleep quality (1–5): 10 pts
- HRV vs personal 7-day rolling baseline: 20 pts (≥ baseline = 20, ≥15% below = 0, linear between). Missing → redistribute proportionally to other inputs
- Energy (1–5): 15 pts
- Soreness of today's target muscles (avg, 1–5, inverted): 15 pts
- Stress (1–5, inverted): 10 pts
- Confidence label: high (5–6 inputs), medium (3–4), low (≤2). No check-in → score 70, confidence low
- Output must include a human-readable reason string naming the top 1–2 negative factors, e.g. "5.5h sleep + sore quads"

Effect on targets:
- ≥ 75: normal progression
- 50–74: hold weights (no increases)
- < 50: reduce target 10% and cap effort at 3 RIR

### Muscle fatigue
- Each working set adds 1.0 to primary muscles, 0.5 to secondary
- Exponential decay, half-life 48h; 36h if last sleep ≥ 7.5h; 60h if last sleep < 6h or protein target missed
- Display 0–100% (10 units = 100%); > 60% = "still recovering"

### Return-from-break mode (optional, OFF by default)
For users coming back after 4+ weeks off. When enabled in Profile, counts weeks from the date it was turned on: weeks 1–2 "Ramp" (start at ~65% of previous working weights, stop 2–3 reps short, no failure techniques), weeks 3–4 "Build" (failure techniques allowed on upper-body isolation/machines), week 5+ turns itself off. When off, no phase is shown anywhere.

### Plateau detection
No e1RM improvement across 3 consecutive sessions of an exercise → flag. Suggest one fix:
- avg readiness < 60 last 7d → "deload"
- weekly sets for its primary muscle < 10 → "add a set"
- body-weight trend falling while strength flat → "raise calories ~200"
- otherwise → "change rep range or variation"

### Deload trigger
avg readiness < 55 for 5+ consecutive days OR ≥ 3 exercises plateaued → recommend deload week (60% volume, same weights).

### Projections
Linear regression on last 6 weeks of e1RM per exercise → projected date to reach a user-entered goal weight. What-if toggles (sleep 8h avg, protein daily) each add +10% to the rate, labeled "estimate".

### Body composition signal
14-day body-weight trend vs e1RM trend →
- weight ↑ slowly (≤0.5%/wk) + strength ↑ → "Likely building muscle"
- weight ↑ fast + strength flat → "Likely gaining fat"
- weight ↓ + strength holding → "Likely losing fat"
- weight ↓ + strength ↓ → "Muscle-loss risk"
Each with a calorie suggestion.

### Nutrition targets
Mifflin–St Jeor BMR × activity 1.55, goal adjustment (muscle +250, fatloss −400, recomp 0, strength +150). Protein 2.0 g/kg (1.8 if fat loss, 2.2 if recomp). Training days +150 kcal from carbs.

### Weekly volume
Hard sets per muscle per week vs 10–20 recommended range; flag under/over.

### DOTS score
Standard DOTS formula for leaderboards (sum of best e1RM on squat, bench, deadlift variants, bodyweight-adjusted).

---

## Screens

### Onboarding
Profile → goal → units → pick template (Upper/Lower 4-day, PPL 6-day, Full Body 3-day) or build custom → done. Skip button loads demo data.

### Today
- Readiness ring + score + confidence + reason
- Today's session card with exact targets per exercise ("185 × 6–8 · stop at 2 RIR")
- Nutrition rings (kcal, protein)
- Plateau/deload alerts (and a "Return-from-break" phase badge only if that mode is on)
- Buttons: Check in · Start workout

### Check-in (sheet from Today)
All CheckIn fields in < 20 sec. Soreness via tap-a-muscle body diagram (simple front/back SVG). "Sync from watch" fills sleep/HRV/RHR/steps via simulated `watchSync` service.

### Train
- Program builder: split, days, exercises from library (~60 exercises, searchable), sets/reps/increment/technique
- Workout logger: per exercise target + one-line "why"; log a set in 1–2 taps (prefilled, ± steppers), optional RIR; auto rest timer (3:00 compound, 1:30 isolation, adjustable); warm-up calculator (bar, 40/60/80%); plate calculator; "Equipment busy?" substitution (same pattern + primary muscles, weight converted by ratio table, keeps its own history); fatigue warning badges; finish → session summary (volume, sets/muscle, PRs, duration) → auto-post to feed
- History list of past sessions

### Nutrition (section inside Today or its own route from Today)
Quick-add meals (kcal/P/C/F), favorites for one-tap repeat, daily totals vs targets, meal time recorded.

### Body
- Front/back muscle map colored by fatigue (lime → orange)
- Weekly sets per muscle vs range
- e1RM trend charts per exercise + projection line + what-if toggles
- Body weight chart with 7-day average + body-comp signal
- Private progress vault: photos (stored locally as blobs) + measurements; never shared
- Experiments tab: start from templates (creatine, AM vs PM training, higher protein, caffeine, extra sleep, custom); 14-day baseline then 28-day test with daily yes/no item; final report comparing readiness, e1RM rate, weight trend; honest confidence label ("small sample — suggestive, not proof")
- Weekly Lab Report: sessions done/planned, volume, avg readiness, avg sleep, nutrition adherence, PRs, e1RM changes, 3–5 generated insights linking variables (e.g. "Protein under target 4 of 7 days — matches your stalled pressing", "Your best sessions followed 7.5h+ sleep"), one focus for next week

### Spotters (simulated social)
- Feed: auto-posted workout cards (session, top sets, PRs, duration), likes, comments
- PR cards: generated square PNG (canvas) with lift, weight × reps, e1RM, Corpus wordmark, a "why" stat; download/share via Web Share API
- Crews (2–8): shared streak (breaks if any member misses a planned session), consistency leaderboard
- Gym check-in: "I'm at [gym]" → shows Spotters training there now
- Find a Spotter: match by gym, schedule, split, strength level; show match %
- Leaderboards per lift by DOTS

### Profile
- Profile + targets, units, return-from-break mode (off by default), rest timer defaults
- Coach mode toggle → Coach dashboard: client list (demo) with readiness, adherence, last session, auto-flags ("readiness < 50 for 3 days", "missed 2 sessions"); open client → view data, edit program, leave notes
- AI Coach chat: rule-based simulated responses built from engine outputs (answers like "Why did my bench stall?" by citing plateau flag, protein adherence, sleep). Behind an `aiCoach` interface so a real LLM can be plugged in later
- Export / import JSON, load demo data, reset

---

## Demo data
"Load demo data": 8 weeks for one user — progressing lifts with one plateau, varied sleep/HRV, nutrition logs, check-ins, an in-progress creatine experiment — plus 5 Spotters with feed activity, 1 crew, 3 coaching clients. Every screen must look populated.

---

## Milestones (build in order; each ends with `npm test` + `npm run build` passing and a git commit)

1. **Foundation** — scaffold, theme, routing, tabs, types, Dexie schema, exercise library
2. **Engine** — all engine rules + Vitest tests
3. **Train** — program builder, templates, workout logger, timers, calculators, substitution, history
4. **Today + Check-in + Nutrition** — readiness, prescriptions, rings, alerts
5. **Body** — fatigue map, volume, charts, projections, body comp, vault, weekly report
6. **Experiments**
7. **Spotters** — feed, PR cards, crews, check-in, matching, leaderboards
8. **Profile + Coaching + AI coach + export/import**
9. **Demo data + onboarding + PWA + README** (run locally, deploy free to Vercel, add to iPhone home screen)

v1 = all 9 milestones done. If time runs short, milestones 1–5 are the must-haves.
