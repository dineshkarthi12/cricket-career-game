# PROGRESS.md

## ✅ Phase 1 — Project setup (complete)

**Toolchain**
- React 19 + Vite 8 + TypeScript 7, strict mode, `@/*` path alias to `/src`.
- Tailwind CSS v4 via `@tailwindcss/vite`, design tokens in `src/index.css`.
- Zustand, React Router, recharts, lucide-react.
- Vitest + jsdom + Testing Library. `npm run build` and `npm test` both clean.
- Poppins + Caveat loaded from Google Fonts in `index.html`.

**Documents**
- `GAME_SPEC.md` — all 20 stages, attributes, condition, match factors
  (pitch / weather / ball age / format / phase / pressure), selection rules and
  statuses, save system, full screen list, phase plan.

**Data models** (`/src/types`, barrel at `@/types`)
- `primitives.ts` — rating scale, formats, phases, styles, roles, levels.
- `attributes.ts` — batting / bowling / fielding / physical / mental groups.
- `condition.ts` — form, fitness, fatigue, morale, confidence, injuries.
- `player.ts` — `Player`, `RivalPlayer`, career records, contracts.
- `team.ts` — `Team`, generic crests, team needs.
- `venue.ts` — `Venue`, `Pitch`, `Weather`, `BallState`, `MatchConditions`.
- `match.ts` — `Ball`, `Innings`, `Match`, scorecard lines, results.
- `tournament.ts` — `Tournament`, standings, `Fixture`, `Season`.
- `career.ts` — `CareerStage`, requirements, `SelectionStatus`, `CareerState`.
- `inbox.ts`, `trophy.ts`, `training.ts`, `save.ts`.

**Static data** (`/src/data`)
- `stages.ts` — all 20 career stages with steps, requirements and links.
- `tournaments.ts` — 22 competitions (real names, fictional teams).
- `venues.ts`, `trophies.ts`.

**Engine** (`/src/engine`, no React imports)
- `config.ts` — every balance constant (ratings, condition, XP, selection,
  progression, training, save).
- `ratings.ts` — role-weighted overall. `records.ts` — empty records and averages.
- `newCareer.ts` — builds a complete, valid `GameState` for a new career.
- `id.ts` — id generation.

**Save system** (`/src/save`)
- 3 localStorage slots with separate lightweight headers, active-slot memory.
- Debounced autosave, flushed on `beforeunload` and tab hide.
- Export / import JSON with an app marker and structural validation.
- Version migrations scaffold.
- Every path returns a `SaveResult`; nothing throws on storage failure.

**Store / UI**
- `src/store/gameStore.ts` — Zustand store; all mutations go through `update()`,
  which queues an autosave.
- `src/screens/Home.tsx` — placeholder "Setup complete" page in the design
  system colours and fonts.

**Tests — 34 passing across 4 files**
- Save round-trip, slot independence, delete, active slot, header derivation.
- Corrupt JSON, non-career JSON, newer-version saves, quota exhaustion.
- Export/import round-trip, wrong-app rejection, import to slot.
- Autosave debounce, disabled autosave, flush, no-op flush.
- All 20 stages present, unique, links valid, tournament references valid.
- New career starts locked and empty, overall derived, serialisable.
- Home renders.

---

## ▶️ Next — Phase 2: design system + Home dashboard

1. Build the shared components: `Card`, `CardHeader`, `StatTile`, `ProgressBar`,
   `Tabs`, `Badge`, `Avatar`, `Stepper`.
2. Build the app shell: desktop sidebar, tablet icon rail, mobile bottom tabs.
3. Build the full Home dashboard to match `design/dashboard.png` — hero banner,
   Next Match, 20-stage stepper, Upcoming Schedule, Training Focus, Player
   Stats, Inbox, Recent Match, Skill radar, Trophies, Community, bottom banner.
4. Add the slot picker / new-career screen on top of the save system.
5. Seed a demo career (the `CAREER_MODE.md` Dinesh save) so the dashboard has
   real data to render.
