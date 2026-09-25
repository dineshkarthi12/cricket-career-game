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

**Slot picker and new career** (`/slots`, `/new`)
- `SlotPicker` — the three save slots on one branded entry screen (no sidebar;
  there is nothing to navigate to until a career is loaded). An occupied slot
  shows the player, stage, age, OVR, matches, runs, season, in-game date and
  real last-saved time, and offers Continue / Export / Delete. Delete asks for
  confirmation inline. An empty slot offers "Start new career" or importing a
  save file. Storage failures surface as an alert, never an exception.
- `NewCareer` — player creation: name, date of birth, hometown, state, country,
  role, batting and bowling style, shirt number and motto, plus the target
  slot with an overwrite warning. Validates the name, the 8-16 age window a
  career may start in, and the 1-99 shirt number, and shows the age the chosen
  date of birth gives on day one. The career it creates starts at stage 1 with
  no record, no trophies and no reputation.
- Reachable from the top-bar avatar ("Switch career") and from Settings.

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
  It sets a `booted` flag so screens can tell "still starting up" apart from
  "the player deleted their career"; Home redirects to `/slots` in the latter
  case. `exportSlot(slot)` downloads any slot, loaded or not.
- `src/data/community.ts` — simulated fan posts. Generated chatter, so it sits
  outside the save file; everything else on the dashboard reads from the store.
- `src/lib/selectors.ts` — every dashboard figure derived from `GameState`
  (stepper nodes, upcoming fixtures, next match, recent match, stat tabs, radar
  axes, featured trophies, unread count).
- `src/lib/format.ts` — timezone-safe dates, in-game relative times, overs.

**Tests — 103 passing across 11 files** (69 new)
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
  active slot, falls back to an occupied slot, sets `booted`, and is idempotent.
- Slot picker: three empty slots on a fresh browser, saved-career summary,
  load-and-go, routing to the new-career form, two-step delete, "Current"
  marker, and a storage failure surfacing as an alert rather than a crash.
- New career: creates and opens a career, starts at stage 1 with nothing won,
  rejects a missing name / out-of-range age / bad shirt number, honours the
  slot in the URL, defaults to the first empty slot, and warns on overwrite.

**Fixed while building the entry screens**
- The dashboard's four-across card grid moved from `xl` (1280px) to `2xl`
  (1536px, what the design is drawn at). Between the two it stays two-up, and
  the Next Match card stacks under the hero instead of lapping over it — at
  1280 the four-column row squeezed every card header onto two lines.
- `Avatar` gained a `decorative` flag, so an avatar sitting next to a visible
  name no longer makes a screen reader announce that name twice.

**Deviations from `design/dashboard.png`** (deliberate, both noted for review)
- The mock's Next Match and Recent Match read "Cooch Behar Trophy" with U-16
  sides; Cooch Behar is the U-19 competition, so the demo career uses the Vijay
  Merchant Trophy, which is what stage 3 actually plays (`stages.ts`).
- The mock dates the next match "Tue, 15 Oct 2026"; 15 Oct 2026 is a Thursday,
  and the card derives the weekday from the date.

---

## ✅ Phase 3 — Ball-by-ball match engine (complete)

Pure TypeScript in `/src/engine/match`. No React, no DOM, no `localStorage`,
and no `Math.random` — there is a test that breaks `Math.random` and replays a
match to prove it. Every tunable number is in `/src/engine/config.ts`.

**Delivery resolution** (`delivery.ts`, `skill.ts`, `conditions.ts`, `field.ts`)
Each ball is resolved in the order GAME_SPEC §5 lays out:
1. The bowler executes a plan — length (yorker / full / good / back of a length
   / short / full toss), line (wide of off through to down leg) and a variation
   (slower ball, cutter, bouncer, googly, arm ball, doosra, carrom ball…) — with
   an execution error driven by accuracy, control and fatigue. Wides and
   no-balls come out of the same roll.
2. **Threat** is built from what the conditions offer: swing (pitch + cloud
   cover + humidity + wind, multiplied up for a new ball, and reverse swing once
   the ball is old and the square abrasive), seam off a hard ball, turn (less
   under dew), bounce, and how hard the surface is to bat on. It saturates
   softly rather than clamping, so extra movement is never wasted.
3. **Contact quality** comes from the batter's technique, timing, shot range,
   footwork and the vs-pace / vs-spin match-up, scaled by form, confidence,
   fatigue and match fitness, damped by pressure resolved against temperament,
   and reduced while a batter is still playing themselves in.
4. The outcome falls out: dot, 1, 2, 3, 4, 6, wide, no-ball, bye, leg-bye, or a
   dismissal — bowled, caught (the fielder is named), lbw, run out, stumped,
   caught behind, caught and bowled, hit wicket. Which dismissal depends on the
   delivery: full and straight bowls and traps lbw, short is caught, wide edges
   behind, spin stumps an advancing batter.
5. Every ball also carries a shot type, a **direction (0-360°) and distance in
   metres** for the 2D ground view in Phase 4, and a commentary line.

**Field placement** — nine named positions from seven presets (attacking new
ball, attacking spin, standard, defensive ring, boundary protection, death,
powerplay). The nearest fielder to a shot decides catches, saved runs and
whether a boundary rider pulls one back on the rope. Run-outs are rolled while
the batters are actually running, off their running against the fielder's arm.

**State machines** (`innings.ts`, `simulate.ts`)
Overs, strike rotation, extras, partnerships, fall of wickets and full batting
and bowling scorecards. Bowler spells, workload, fatigue, no consecutive overs
and the per-format over limit (4 in a T20, 10 in an ODI). Multi-day matches run
days and a pitch that wears with them, with declarations, the follow-on, draws
and innings victories. Limited-overs matches handle rain, a **DLS** revised
target, no-results, ties and a **super over** in a knockout.

**AI** (`ai.ts`) — the opposition captain picks bowlers by match-up, phase,
spell length, fatigue and remaining overs, sets a field to the situation, and
AI batters choose an aggression level (1-5) from the format, the phase, wickets
in hand, the required rate and their own temperament.

**After the match** (`aftermath.ts`) — a 0-10 rating built from runs, wickets,
catches and the result feeds form, confidence, morale, fatigue, fitness,
injury risk (with severity and a return date), reputation, selector trust and
XP. `Condition.selectorTrust` is new, alongside a `flight` bowling attribute
and the shot direction on `Ball`; `SAVE_VERSION` is 2 with a migration.

### Balance report — 1000 matches per format

```
--- T20 (1000 matches) ---
1st innings      158.56/6.34  (RR 8.08)
Top-six batting  avg 25.36, SR 138.78
Bowling          econ 7.99, avg 24.31
Dismissals       CAUGHT 54.8%, BOWLED 14.0%, CAUGHT_BEHIND 12.9%, LBW 8.3%,
                 STUMPED 4.2%, C&B 2.8%, RUN_OUT 2.7%, HIT_WICKET 0.4%

--- ODI (1000 matches) ---
1st innings      279.03/7.18  (RR 5.75)
Top-six batting  avg 39.41, SR 96.8
Bowling          econ 5.56, avg 37.9
Dismissals       CAUGHT 49.7%, BOWLED 15.4%, CAUGHT_BEHIND 14.1%, LBW 9.6%,
                 RUN_OUT 4.1%, STUMPED 3.6%, C&B 3.1%, HIT_WICKET 0.4%

--- MULTI_DAY (1000 matches) ---
1st innings      326.16/10 in 106.11 overs  (RR 3.07)
Top-six batting  avg 34.31, SR 57.17
Bowling          econ 2.94, avg 31.94
Results          WIN 79.7%, DRAW 20.2%, TIE 0.1%
Dismissals       CAUGHT 47.5%, BOWLED 16.3%, CAUGHT_BEHIND 14.4%, LBW 11.2%,
                 RUN_OUT 3.9%, C&B 3.1%, STUMPED 3.1%, HIT_WICKET 0.5%

Good first-class top order averages 47.1
```

Every target from the brief is met: T20 first innings 150-190 ✓, ODI 250-320 ✓,
first-class 250-400 ✓; good first-class batters average 35-50 ✓; T20 strike
rates 130-160 ✓; economy realistic per format ✓; caught is the most common
dismissal, then bowled, then lbw ✓.

**Tests — 154 passing across 14 files** (51 new)
- `balance.test.ts` — 1000 matches per format, prints the report above and
  asserts every band; a separate run checks a good first-class batter's average
  and that the dismissal ordering holds in all three formats.
- `factors.test.ts` — pitch, weather and ball age each move outcomes the way a
  cricketer would expect: a green seamer beats a flat deck, a worn pitch turns
  and takes more wickets, overcast skies swing it and take more new-ball
  wickets than sunshine, dew kills a spinner's grip, the new ball takes more
  wickets than the same ball once soft, and reverse swing arrives late and only
  on an abrasive square.
- `engine.test.ts` — determinism (same seed replays ball for ball, and the
  engine never touches `Math.random`), scorecard arithmetic, over limits, no
  consecutive overs, bowler fatigue, format state machines, follow-on,
  declarations, draws, DLS, super over, field placement, and every post-match
  effect including injuries.

**Two bugs the tests caught, both fixed**
- Threat was hard-clamped at 1, so on a seaming pitch it saturated and extra
  swing from cloud cover changed nothing at all. It now saturates softly.
- The dew figure passed into the turn calculation was the pitch's own turn
  value rather than the dew level.

---

## ▶️ Next — Phase 4: 2D ground view and live match screen

1. Top-down 2D ground with fielders as dots, drawn from `FieldSetting`.
2. Ball-path lines from each delivery's `shotAngle` and `shotDistance`.
3. Live match screen: commentary feed, intent controls, over-by-over scorecard.
4. Wire "Play Match" and "Quick Sim" on the Home dashboard to the engine and
   drop the "Coming in match engine phase" tooltip.
5. Build the Matches screen and the scorecard over their placeholders.
