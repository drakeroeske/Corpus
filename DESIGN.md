# Corpus — Design System v2 ("Riso Lab")

Milestone 12 re-skins the whole app. It **replaces** the dark/lime look in SPEC.md's "Design system" section. No features change — only presentation, plus the small additions listed under "New UI pieces".

Style: neo-brutalist / risograph / lab-report. Body-as-data, clinical diagrams, photocopy grain, hard edges. It must look nothing like MyFitnessPal (soft blue cards) or Nike (black/white).

---

## Two sub-styles, one system

| | **Lab Report** (Corpus engine) | **Riso** (Spotter social) |
|---|---|---|
| Used on | Today, Train/Log, workout logger, Body, Fuel, Reports, Experiments, Profile, Coach | Feed, Crews, Gym check-in, Find a Spotter, Leaderboards, PR cards, onboarding pledge |
| Background | Paper `#F2F1EC` | Bone `#ECE8DF` |
| Ink (text, borders, data) | Black `#111111` | Cobalt `#2B3FD6` (pressed/hover `#1A2A9E`) |
| Signal | Pink `#E9A6D8` for PRs and social moments only | Pink `#E9A6D8` header band, Respect button, celebrations |
| Display font | **Anton**, uppercase, line-height 0.88 | **Archivo Black**, line-height 0.9, letter-spacing −0.03em |
| Data / labels / body | **Space Mono** 400/700 | **Space Mono** 400/700 |

Both are loaded from Google Fonts. Remove Space Grotesk and JetBrains Mono.

### Color rules
- Each spot color has **one job**: ink = all data; pink = "something social/celebratory happened" (PR, Respect, crew streak, challenge). Users should learn pink means an event.
- Pink is **never used for text** (fails contrast). Text on pink is always ink.
- No gradients anywhere. No shadows. No opacity tricks except the grain overlay.
- Warning state (deload, plateau, recovering): ink text in a bracket tag, optionally on a hatched background (repeating 45° 1px ink lines at 6px). No orange.
- Tokens live in `src/theme/tokens.ts` and Tailwind config: `paper, bone, ink, cobalt, cobaltDeep, signal, black`. Components read the sub-style from context (`<Surface style="lab|riso">`) so screens switch ink color automatically.

### Shape rules
- Square corners everywhere (`border-radius: 0`), including buttons, inputs, cards, sheets, the app icon frame inside the app.
- Borders: 2px ink for containers and buttons; 3px for section rules (top of tables, tab bar); 1px dashed ink between table rows.
- Primary button: filled ink, paper/bone text. Secondary: 2px ink outline, transparent. Social primary: pink fill, ink text, 2px ink border.
- Tap targets ≥ 44px (logger buttons ≥ 56px).

---

## Signature elements (use these consistently)

1. **Corner metadata labels.** Every main screen header has three tiny Space Mono 10px bold labels across the top: left `CORPUS // ENGINE` (or `SPOTTER // FEED`), center session number + date (`SESSION 041 · 07.11.26`), right split/status (`PUSH A [LIVE]`). Real data, not decoration.
2. **Huge display titles.** Screen titles set very large (64–76px) in Anton/Archivo Black, e.g. "PUSH DAY.", "BODY.", "FUEL.", with a full stop.
3. **Bracket tags instead of pill badges:** `[PR]`, `[DELOAD]`, `[HOLD]`, `[+2.5 ↑]`, `[RECOVERING]`, `[VERIFIED]`, `[SKIPPED]`, `[LIVE]`, `[NOTE]`. Space Mono bold, ink. `[PR]` sits on pink.
4. **Figure captions.** Charts and diagrams get `FIG. 01 — LOAD`, `FIG. 02 — e1RM / BENCH` labels in a corner, plus a stat in the opposite corner (`VOL 9,840 KG`).
5. **Lab-report tables.** Exercise lists are tables: 3px top rule, mono column headers (EXERCISE · SETS · NEXT), dashed row dividers, the NEXT column bold when it's a progression (`+2.5 ↑`, `+1 REP`, `HOLD`).
6. **Diagram imagery.** Concentric rings, crosshair bars, orbit ellipses and a simple silhouette figure (as in the mockups) used for: the Today readiness visual (rings fill by readiness), loading states, empty states, onboarding, PR cards. Build as inline SVG components in `src/components/diagrams/`.
7. **Numbered artifacts.** PR cards are numbered `PR CARD Nº 017`; sessions `SESSION 041`; experiments `EXP Nº 003`.
8. **Notes line.** Engine reasoning shown as one mono line: `[NOTE] SLEEP 7H12 · STEPS 11.2K · RECOVERY OK — PROGRESSION APPROVED.`

---

## Grain & dither

- **Grain overlay:** an absolutely positioned SVG with `feTurbulence` fractalNoise (baseFrequency ~0.85–0.9, numOctaves 2, desaturated), `mix-blend-mode: multiply`, `pointer-events: none`. Component `<Grain amount={0.25} />`.
- Use grain on: headers, PR cards, feed cards, empty states, onboarding, report covers. Default 0.25.
- **No grain** (amount 0) on anything read mid-set: workout logger, rest timer, weight/rep inputs, check-in inputs. These are clean, max-contrast surfaces.
- Setting in Profile: Grain Off / Subtle / Full (respects `prefers-reduced-transparency`; Off by default if `prefers-contrast: more`).
- **Dithered photos:** profile photos, progress-vault photos and any feed images are rendered through a 1-bit dither (Floyd–Steinberg or ordered Bayer) on a canvas, output in the current ink color on paper/bone. Original photo kept locally; toggle "Show original" only for the owner. Utility in `src/lib/dither.ts` with a small test.

---

## Screen-by-screen

- **Today (Lab):** corner labels; title = today's session ("PUSH DAY."); readiness as a ring diagram with the score in Anton and a bracket confidence tag; `[NOTE]` reason line; session table with NEXT column; nutrition as two thin bar meters (kcal, protein) with mono numbers instead of rings.
- **Workout logger (Lab, no grain):** one exercise per screen section; huge Anton current target ("185 × 8"); typed weight/reps fields with 2px borders and 32px mono digits; LOG SET full-width black button ≥ 56px; rest timer as a giant mono countdown on paper with a 3px progress bar; set history as a mini table.
- **Body (Lab):** title "BODY."; the 3D thermal body stays as the **one deliberate exception** to the palette (it's a scientific instrument readout) but sits in a 2px ink frame with `FIG. 01 — FATIGUE` caption and a mono legend; the 2D fallback map is drawn as a wireframe/diagram figure with hatching density = fatigue. Charts: 2px ink lines, no fills, square markers, mono axis labels, grid in 1px dashed ink at 20% (the only allowed tint).
- **Fuel (Lab):** diary as a ledger table per meal; macro bars; barcode scanner screen with crosshair-bar diagram overlay.
- **Reports & Experiments (Lab):** styled as printed lab reports: report number, date range, numbered findings (`01 / Protein under target 4 of 7 days — matches stalled pressing`), `[CONFIDENCE: LOW]` tags.
- **Spotter feed (Riso):** pink header band with `SPOTTER` in Archivo Black and corner labels; filter chips CREW / GYM / FIND PARTNER as square outlined buttons (active = filled cobalt); feed cards with 2px cobalt border, `@USERNAME · 2H` and `PR CARD Nº` header row, diagram/dithered image area, result in Archivo Black (`180 KG`), `PREV 172.5 · +7.5 KG · VERIFIED BY CORPUS`; buttons RESPECT ↑ 24 (pink) and CHALLENGE (outline). Rename "Like" to **Respect** everywhere.
- **Crews / Gym / Find a Spotter / Leaderboards (Riso):** tables and cards in cobalt; streaks as a row of square cells (filled = trained); match % in Archivo Black.
- **PR card PNG export (Riso):** 1080×1080, bone background, pink header band, diagram figure, number, lift, weight, delta, "why" stat, `CORPUS` wordmark + connected-C mark in cobalt, grain baked in.
- **Profile & Coach (Lab):** settings as a spec sheet (label left, value right, dashed rows).
- **Bottom tab bar (both):** square 4–5 column grid, 3px top rule, mono 11px bold uppercase labels (TODAY · LOG · BODY · SPOTTER · ME), active tab = filled ink with paper text, others transparent with 1–2px dividers.

---

## New UI pieces

- **Onboarding pledge (Riso):** after setup, a manifesto screen the user "signs" by holding a button for 1.5s: `I WILL LOG EVERY SESSION. / I WILL NOT SKIP LEGS. / I WILL SLEEP LIKE IT'S TRAINING. / I WILL TRUST THE DATA.` Saved with date; shareable as a PNG card in the same style.
- **Logo:** the connected-C mark (a C made of nodes and lines with a hub) redrawn in ink — cobalt in Riso contexts, black in Lab contexts. Update the PWA icon and splash to cobalt mark on bone.

---

## Accessibility (non-negotiable)

- Contrast: ink on paper/bone and ink on pink all pass 4.5:1; never pink text, never cobalt on pink below 14px.
- Grain never sits under small text it would make illegible; respect reduced-motion (no pulsing) and the grain setting.
- Bracket tags are text, so screen readers read them; diagrams are `aria-hidden` unless they carry data (then `role="img"` + label).

---

## Milestone 12 — done means
- Tokens, fonts, `<Surface>`, `<Grain>`, bracket `<Tag>`, `<CornerLabels>`, `<FigCaption>`, `<LabTable>`, diagram SVG components, dither utility.
- Every screen restyled per this doc; no leftover lime/dark styles (grep for the old hex values).
- Onboarding pledge + new logo/PWA icon.
- `npm test` and `npm run build` pass; commit `M12: Riso Lab redesign`; PROGRESS.md updated.
