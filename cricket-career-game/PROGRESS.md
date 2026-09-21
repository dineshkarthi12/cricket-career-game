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

## ✅ Phase 2 — Design system + Home dashboard (complete)

**Shared components** (`/src/components`, barrel at `@/components`)
- `Card` / `CardHeader` / `CardAction` — white surface, 16px radius, soft shadow,
  20px padding, with the light-blue "View All →" pill.
- `StatTile` (bordered figure tile) and `HeroStatTile` (the floating OVR / Form /
  Fitness / Morale tiles on the hero).
- `ProgressBar` — clamped 0-100, six tones, `role="progressbar"`.
- `Tabs` — pill tab strip with proper `tablist` / `tab` roles.
- `Badge`, `Avatar` (photo or deterministic initials), `Modal`, `Tooltip`.
- `Stepper` — the 20-stage career strip: green tick done, glowing blue current,
  grey locked, crowned end node, sideways scroll on narrow screens.
- `SkillRadar` + `RadarLegend` — recharts wrapper, current against potential.
- `Crest` — generic SVG shield / roundel / banner / diamond built from a team's
  own two colours and monogram. No real association logos anywhere.

**App shell** (`/src/layout`)
- `Sidebar` — crown wordmark, `PLAY • IMPROVE • BELONG`, the eleven primary
  routes, active item in `#E8EFFE` with a blue rail, and the handwritten
  "Discipline today, International tomorrow." over `sidebar-player.jpg`.
- `TopBar` — search, notification bell with unread count, avatar + name +
  stage-derived title, level and XP bar.
- `MobileTabBar` — bottom tabs plus a "More" sheet for the remaining routes.
- `AppShell` — desktop sidebar (≥1024px), tablet icon rail (≥768px), mobile
  bottom tab bar, one frame for every screen in the game.

**Home dashboard** (`/src/screens/home`), matching `design/dashboard.png`
1. `HeroBanner` — `hero-bg.jpg` with a readability wash on the left,
   `player-hero.png` on the right-centre, name + edit, styles, hometown, age,
   flag, the Caveat motto, the four condition tiles, the handwritten mottos and
   "Watch Story", which opens `StoryModal` (the career timeline).
2. `NextMatchCard` — laps over the right of the hero on wide screens, stacks
   below it otherwise. Generic crests, date, venue; "Play Match" and "Quick Sim"
   are disabled with a "Coming in match engine phase" tooltip until Phase 3.
3. `CareerJourneyCard` — all 20 stages plus the crowned Retirement node.
4. `UpcomingScheduleCard`, `TrainingFocusCard`, `PlayerStatsCard` (tabs by level
   and format), `InboxCard`.
5. `RecentMatchCard`, `SkillDevelopmentCard`, `TrophiesCard` (padlocked tiles),
   `CommunityCard`.
6. `BottomBanner` — navy `banner-bg.jpg`, "More Than A Game." in Caveat,
   "REAL PLAYERS. REAL JOURNEYS." and the gold "Continue Career" button.

**Other routes**
- Every sidebar route resolves to a `Placeholder` screen using the same shell
  and components, listing what its own phase will build.

**Data**
- `src/data/demoCareer.ts` — the career from the design: Dinesh, 16, Chennai,
  right-hand batter / right-arm medium, stage 3 (State U-16), OVR 68 against a
  potential of 85, form Good, fitness 92%, morale High, level 12 on 820/1200 XP,
  6 matches for 248 runs at 49.60 (SR 71.7, best 78), five upcoming fixtures, a
  34-run win over Andhra U-16, three inbox messages and one unlocked trophy.
- `useGameStore.bootstrap()` resumes the active slot, falls back to the first
  occupied slot, and only seeds the demo career when the browser has no save.
- `src/data/community.ts` — simulated fan posts. Generated chatter, so it sits
  outside the save file; everything else on the dashboard reads from the store.
- `src/lib/selectors.ts` — every dashboard figure derived from `GameState`
  (stepper nodes, upcoming fixtures, next match, recent match, stat tabs, radar
  axes, featured trophies, unread count).
- `src/lib/format.ts` — timezone-safe dates, in-game relative times, overs.

**Tests — 86 passing across 9 files** (52 new)
- Date, overs and in-game relative-time formatting, including timezone safety.
- Demo career: identity, derived OVR 68 / potential 85, condition, stage
  statuses for all 20 stages, season figures, fixtures, match, trophies, and
  that it is serialisable into a slot.
- Selectors: unread count, stepper statuses, fixture ordering and filtering,
  next-match pick, stat-tab roll-ups, radar axes, featured trophies.
- Components: card header and action, progress clamping and ARIA, tab
  selection, stepper node states, badge, initials, crest, stat tile.
- Home: hero, next match (buttons disabled with the tooltip), 20-stage journey,
  schedule, training, stats, inbox, recent match, trophies, community, banner.
- Store bootstrap: seeds the demo only when nothing is saved, resumes the
  active slot, falls back to an occupied slot, and is idempotent.

**Deviations from `design/dashboard.png`** (deliberate, both noted for review)
- The mock's Next Match and Recent Match read "Cooch Behar Trophy" with U-16
  sides; Cooch Behar is the U-19 competition, so the demo career uses the Vijay
  Merchant Trophy, which is what stage 3 actually plays (`stages.ts`).
- The mock dates the next match "Tue, 15 Oct 2026"; 15 Oct 2026 is a Thursday,
  and the card derives the weekday from the date.

---

## ▶️ Next — Phase 3: match engine

1. Ball-by-ball resolution from attributes, condition, pitch, weather, ball age,
   format, phase and pressure (`GAME_SPEC.md` §5).
2. Text commentary, full innings scorecards and match reports.
3. Wire "Play Match" and "Quick Sim" on the Home dashboard to the engine and
   drop the "Coming in match engine phase" tooltip.
4. Build the Matches screen over the placeholder.
