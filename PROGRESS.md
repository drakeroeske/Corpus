# Progress

Current milestone: **v1 complete (M1–M9)**

## Done
- M1 Foundation — Vite + React 18 + TS, Tailwind theme tokens, HashRouter with 5 bottom tabs, all types (`src/engine/types.ts`), Dexie schema (`src/data/db.ts`, DB name `corpus-v1`), 75-exercise library, 4 program templates, Zustand rest-timer store, shared UI kit (`src/components/ui.tsx`).
- M2 Engine — progression, e1RM/PR, readiness (6 inputs, HRV baseline, confidence, reason), fatigue (secondary 0.5, 36/48/60h half-life), return-from-break, plateau + fix, deload trigger, projections + what-ifs, body-comp signal, nutrition targets, weekly volume, DOTS.
- M3 Train — program builder + templates, workout logger (targets + why, 1–2 tap logging, RIR, warm-up flag, auto rest timer 3:00/1:30, warm-up + plate calculators, "Equipment busy?" substitution with ratio conversion and own history, fatigue badges), finish → summary → auto-post to feed, history.
- M4 Today + Check-in + Nutrition — readiness ring, exact targets, nutrition rings, plateau/deload alerts, break badge; check-in sheet with tap-a-muscle body map and simulated watch sync; nutrition quick add, favorites, totals vs targets.
- M5 Body — Recovery map + weekly sets, Strength charts + projection + what-ifs, Weight 7-day avg + body-comp signal, Lab Report with insights + focus, private Vault.
- M6 Experiments — templates, 14-day baseline → 28-day test, daily yes/no, report with honest confidence label.
- M7 Spotters — feed, PR card PNG, crews + streak, gym check-in, matching, DOTS leaderboards (simulated `services/social.ts`).
- M8 Profile — profile/targets, units switch, rest defaults, break mode, coach dashboard + client detail, rule-based AI coach (`services/aiCoach.ts`), export/import JSON, reset.
- M9 — demo seeder (`src/data/demo.ts`: 8 weeks generated with the real engine, bench plateau, creatine experiment mid-test, 5 Spotters, 1 crew, 3 clients), onboarding (profile → goal → units → template/custom, skip loads demo), PWA (vite-plugin-pwa, icons from `scripts/make-icons.mjs`, offline font cache, iOS meta tags), README.

- Real Spotters (post-v1) — every social read/write goes through `SocialService` (`services/socialTypes.ts`); `services/social.ts` picks `socialSupabase.ts` when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set, else `socialLocal.ts` (simulated). Email-code sign-in, invite links (`#/spotters?add=<id>`), realtime feed, offline outbox (`services/outbox.ts`, Dexie table `outbox`, DB version 2), profile/training-day sync for matching and crew streaks. Sharing settings in Profile (posts: full / PRs only / off; discoverable on/off). Schema + access rules in `supabase/schema.sql`; setup steps in README.

Tests: 62 passing (`npm test`). `npm run build` produces `dist/` with service worker + manifest.

## Next
- Owner walkthrough on a phone; fix anything that feels off.
- Owner creates the Supabase project (README → "Turn on real Spotters"), then test sign-in, invites, feed, crews and offline posting with two accounts. The Supabase path has not been run against a live project yet.

## Known issues / decisions
- Not browser-tested by Claude (per CLAUDE.md); verified by unit tests + type-check + build only.
- Weights are stored in the user's chosen unit; switching units converts stored data.
- HashRouter is used so static hosting and iPhone home-screen launches need no server config.
- Deload trigger reads "readiness < 55 for 5+ consecutive days" as a trailing streak of daily scores under 55.
- Readiness: any missing input (not just HRV) is redistributed proportionally; HRV needs at least one prior-week value as baseline.
- Weekly volume counts secondary muscles as 0.5 sets.
- The Phase 1 prototype's data (DB `corpus`) is not migrated; v1 uses a fresh DB `corpus-v1`.
