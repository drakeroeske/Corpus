# Working rules for this repo

The full product spec is in `SPEC.md`. Build it milestone by milestone.

## Progress tracking
- Keep `PROGRESS.md` updated: current milestone, what's done, what's next, known issues.
- When starting a new session, read `PROGRESS.md` and `SPEC.md` only — do not re-explore the whole codebase.

## Token efficiency (important — the owner has a limited usage budget)
- Don't re-read files you just wrote. Don't print whole files back.
- No browser testing, screenshots or Playwright. Verify with `npm test` and `npm run build`.
- Keep messages short: one line per completed step, a brief summary per milestone.
- Don't add features, refactors or polish beyond SPEC.md.
- Prefer one well-organized file per screen over many tiny files.

## Code rules
- `src/engine/` is pure TypeScript: no React, no storage, no Date.now() inside logic (pass dates in). Every rule has a test.
- Simulated services (watchSync, social, aiCoach) sit behind interfaces in `src/services/`.
- After each milestone: tests + build pass, commit with message `M<n>: <name>`, update PROGRESS.md, continue to the next milestone without waiting unless blocked.

## The owner
Not a developer. Explain anything they must do in plain language, briefly.
