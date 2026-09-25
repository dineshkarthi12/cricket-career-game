# Cricket Career – Project Guide for Claude Code

## What we are building
A realistic 2D cricket career simulation web game. The player starts as a young beginner and must earn every step to become an international cricketer. Gameplay style is like cricket management sims (e.g. Cricket Captain): top-down 2D ground with fielders as dots, ball path lines, ball-by-ball text commentary, detailed scorecards and stats. NOT 3D.

## Source documents (read these before any phase)
- `CAREER_MODE.md` – the full 20-stage career path and game rules
- `design/dashboard.png` – approved UI design (Home dashboard) and design system for all screens
- `GAME_SPEC.md` – technical spec (created in Phase 1; keep it updated)
- `PROGRESS.md` – what is done / next (update at the end of every phase)

## Core game rules
- NO AUTOMATIC PROMOTION. Every stage is earned through performance, form, fitness, age, competition, selection, team needs, conditions, injuries and opportunities.
- Outcomes: win → promote, lose → stay, bad form → bench, injured → recover, dropped → comeback, exceptional → fast-track. No guaranteed superstar path.
- Match results depend on player attributes + condition + pitch + weather + ball age + format + match situation.
- Use real tournament names (Ranji Trophy, Vijay Hazare, SMAT, Cooch Behar, Vinoo Mankad, C.K. Nayudu, Duleep, Irani, ICC events) but FICTIONAL player names and FICTIONAL IPL franchise names. No real team/association logos; use generic crest designs.

## Tech stack
- React + Vite + TypeScript, Tailwind CSS, Zustand, React Router, recharts, lucide-react
- Vitest for tests
- Save data (3 slots, autosave, export/import JSON): careers in IndexedDB via `idb-keyval` (`src/save/blobStore.ts`, `slotCache.ts`), held in memory and written through; localStorage only for small slot headers, the active slot and settings. Old localStorage careers move to IndexedDB automatically on first load
- Every storage access is wrapped: sync paths return a `SaveResult`, background IndexedDB writes report through `onSaveError`, and every failure shows a visible toast - never fail silently
- Keep saves lean: only the user's last 2 matches keep ball-by-ball; older matches keep full scorecards; AI-vs-AI matches store results and scorecard lines only
- Tests run on `fake-indexeddb` (`src/test/setup.ts` resets it before every test)

## Folder structure
- `/src/engine` – pure TypeScript game logic (match sim, selection, training, career). NO React/UI imports here.
- `/src/types` – data models
- `/src/data` – static data (venues, tournaments, rival name pools, stages)
- `/src/store` – Zustand stores
- `/src/components` – reusable UI components
- `/src/screens` – pages
- `/public/assets` – images

## Assets (already present)
- `public/assets/hero-bg.jpg` – Home hero banner background (sunset stadium)
- `public/assets/player-hero.png` – transparent player cutout for hero banner
- `public/assets/sidebar-player.jpg` – sidebar bottom image
- `public/assets/banner-bg.jpg` – bottom navy banner background (night stadium)

## Design system (from design/dashboard.png)
- Page bg #F4F6FB, white cards, 12–16px radius, soft shadow, 20px padding
- Primary blue #1E5EF0 (active nav bg #E8EFFE), green #22A45D, orange #F59E0B, red #E5484D, gold #F5C518, navy #0F1B33
- Fonts: Poppins (UI), Caveat (handwritten quotes), wide bold uppercase for logo
- Icons: lucide-react
- Every new screen must reuse the same components (Card, CardHeader, StatTile, ProgressBar, Tabs, Badge, Avatar, Stepper)
- Responsive: desktop sidebar; tablet icon sidebar; mobile bottom tab bar

## Working rules
- Work only on the current phase. Do not start the next phase unless asked.
- Before finishing a phase: run `npm run build` and `npm test`, fix all errors.
- At the end of each phase: update PROGRESS.md, then make a git commit like "Phase X: <summary>".
- Keep game logic tunable via constants in `/src/engine/config.ts`.
