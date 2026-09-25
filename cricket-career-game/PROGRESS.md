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
1st innings      165.63/6.32  (RR 8.51)
Top-six batting  avg 27.27, SR 144.42
Bowling          econ 8.33, avg 24.63
Spread (1st)     min 24 | p10 103 | p25 132 | med 167 | p75 198 | p90 226 | max 305  (sd 48.2)
Tails            under 100 8.8%, over 200 23.2%, over 240 6.1%
Dismissals       CAUGHT 51.7%, BOWLED 14.9%, CAUGHT_BEHIND 14.0%, LBW 9.4%,
                 STUMPED 4.2%, C&B 2.9%, RUN_OUT 2.5%, HIT_WICKET 0.4%

--- ODI (1000 matches) ---
1st innings      280.47/7.09  (RR 5.80)
Top-six batting  avg 41.20, SR 97.43
Bowling          econ 5.64, avg 38.81
Spread (1st)     min 31 | p10 188 | p25 236 | med 280 | p75 327 | p90 370 | max 504  (sd 71.7)
Tails            under 150 3.2%, over 350 16.5%, over 400 4.6%
Dismissals       CAUGHT 47.2%, BOWLED 16.4%, CAUGHT_BEHIND 14.8%, LBW 10.1%,
                 RUN_OUT 4.2%, STUMPED 3.5%, C&B 3.3%, HIT_WICKET 0.4%

--- MULTI_DAY (1000 matches) ---
1st innings      315.44/9.12 in 100.47 overs  (RR 3.14)
Top-six batting  avg 35.71, SR 56.29
Bowling          econ 3.04, avg 33.62
Spread (1st)     min 30 | p10 163 | p25 225 | med 323 | p75 416 | p90 457 | max 533  (sd 112.4)
Tails            under 150 8.3%, over 450 12.2%
Results          WIN 56.4%, DRAW 43.6%
Dismissals       CAUGHT 46.1%, BOWLED 16.9%, CAUGHT_BEHIND 14.8%, LBW 11.1%,
                 RUN_OUT 3.9%, STUMPED 3.4%, C&B 3.3%, HIT_WICKET 0.5%

First-class career averages: good top order 39.6, very good 44.2
```

Averages are in band for all three formats, caught leads the dismissals
everywhere followed by bowled then lbw, and each format has the spread real
cricket has rather than clustering on its mean.

### How the variance is produced

None of it is a forced result. Four mechanisms create the tails:

1. **Momentum.** Wickets cluster. Every delivery knows how many wickets have
   fallen in the last 36 balls; while a side is going down in a heap, new
   batters face a higher wicket chance and the boundaries dry up. That is what
   turns 40-3 into 70 all out.
2. **Set batters.** Surviving the first 15 balls is only the start; a batter
   keeps improving for another 80, gaining effective skill, losing a third of
   their wicket chance and hitting more boundaries. Two set batters on a flat
   pitch is how a side gets to 400.
3. **A long partnership** grinds the bowling side down, adding a little to the
   boundary rate and taking a little off the wicket chance.
4. **Conditions.** Pitch type, day-one moisture, cloud cover, ball age and the
   gap in team quality all shift the same delivery a long way.

Feedback loops need bounds or they run away - an early version produced a
1000-run first innings and 580-run ODIs. `MATCH.limits` caps how far the
stacked modifiers may push one ball in either direction: even on the flattest
day a good ball, a lapse or a run-out is always possible.

### Why first-class cricket now draws 41%

Again, through match flow rather than a forced result:

- **The pitch is not simply worse every day.** Day one carries moisture, which
  helps the seamers and makes batting harder. It bakes out over the first day
  and a half - which is why day two is so often the best batting day - and only
  then does the surface start to break up.
- **Four days is never four days of cricket.** Slow over rates cost overs every
  day, and bad light, rain and the occasional washed-out day take out sessions.
- **Set partnerships are harder to break**, so sides bat longer.
- **Captains declare, and conservatively.** A side batting first declares
  around 460 or after 140 overs rather than batting for ever, and the
  declaration point varies by captain so totals do not pile up on one number.
  A captain with little time left wants a bigger cushion before declaring.

**Tests — 190 passing across 15 files** (87 new)
- `balance.test.ts` — 1000 matches per format, prints the report above and
  asserts every band **and the spread** (standard deviation, p10, p90, min, max
  and the share of innings in each tail), the first-class draw rate, career
  batting averages and the dismissal ordering.
- `factors.test.ts` — pitch, weather and ball age each move outcomes the way a
  cricketer would expect: a green seamer beats a flat deck, a worn pitch turns
  and takes more wickets, overcast skies swing it and take more new-ball
  wickets than sunshine, dew kills a spinner's grip, the new ball takes more
  wickets than the same ball once soft, and reverse swing arrives late and only
  on an abrasive square.
- `situational.test.ts` — acceleration by wickets and overs, tail protection,
  milestone nerves, roles, dot-ball pressure, powerplay restrictions, every
  match-up, bowling changes, the toss in each condition, dew, ground size, and
  the umpiring and incident behaviours.
- `engine.test.ts` — determinism (same seed replays ball for ball, and the
  engine never touches `Math.random`), scorecard arithmetic, over limits, no
  consecutive overs, bowler fatigue, format state machines, follow-on,
  declarations, draws, DLS, super over, field placement, and every post-match
  effect including injuries.

**Three bugs the tests caught, all fixed**
- Threat was hard-clamped at 1, so on a seaming pitch it saturated and extra
  swing from cloud cover changed nothing at all. It now saturates softly.
- The dew figure passed into the turn calculation was the pitch's own turn
  value rather than the dew level.
- A side batting first never declared, so a dominant team could bat 300 overs.
  One first innings reached 1075. Captains now declare, with variation.

---

### Situational cricket

Every item below feeds the ball outcome, not the commentary.

**Batting.** Acceleration reads wickets in hand against overs left rather than
the clock: two down and a side goes from 70% of the innings, three down from
75%, five down from 82%, seven down it protects the tail and bats the overs
out. The same logic scales to fifty overs. Openers and number threes anchor
while they get in, five to seven finish, tailenders block, and a recognised
batter with the tail in takes the scoring on himself and farms the strike -
single early in the over, turn one down late. Inside ten runs of a fifty,
hundred, one-fifty or double a batter tightens up. A left-right pair costs the
bowler accuracy. A nightwatchman can go in late on a day of a multi-day match.

**Bowling and field.** Powerplay restrictions are enforced: two fielders
outside the circle for the first six T20 overs and five after; an ODI runs the
three blocks of two, four and five, and a field that breaks the restriction is
pulled into the ring. Spells, rest between spells and the per-format over
limit were already there; a captain now also holds a specialist death bowler
back for the end and throws the ball to a part-timer when the game is safe.
Seamers take the new ball; spin opens fewer than one innings in twenty.

**Match-ups.** The ball leaving the bat is the dangerous one, so left-arm
orthodox and leg spin trouble a right-hander, off spin and left-arm wrist spin
a left-hander, and spin into the pads is easier to play. A left-arm seamer
angles it across the right-hander. Each batter's own vsPace and vsSpin decide
whether they would rather face seam or spin.

**Toss and conditions.** A captain weighs batting ease against grass and cloud,
and under lights weighs the dew coming later, because a wet ball at night is
harder to bowl with than to bat against. Batting first is worth more in the
longer game. When the user is captain and wins the toss, their call is taken.
Dew builds through a night innings, taking grip from the spinners and costing
every bowler execution. Ground size feeds the six chance, and the home side
gets a small bonus for knowing the ground.

**Umpiring and incidents.** Lbw and caught-behind decisions can go upstairs,
two reviews a side an innings: a wrong one is overturned, a marginal one comes
back as umpire's call, and a speculative one costs a review. A no-ball in
limited overs buys a free hit, on which only a run-out can get you. Chances
that go to hand are caught or dropped on the fielder's catching, fumbles let
an extra run through, and a blow on the hand or helmet can force a batter to
retire hurt, with head knocks recorded as concussions.

**Pressure.** Consecutive dots raise the wicket chance and push the batter into
a release shot; wickets cluster; and a rising required rate forces the pace.

---

## ✅ Phase 4 — 2D match screen, career model (complete)

This is a career game: **the player controls only their own cricketer**.
Team controls unlock only when the player is appointed captain, and each can be
handed to the AI vice-captain. A development-only toggle turns captain mode on
early for testing.

**One code path for watching and simulating**
- `stepBall` plays one delivery; `simulateInnings` and the live controller
  (`createLiveMatch`) both run on it. The live controller follows
  `simulateMatch` call for call (rain and DLS, super overs, time loss,
  declarations, follow-on). A parity test plays 180 matches both ways and
  checks they are identical, plus a super over, a follow-on and a
  rain-revised chase - so live play and Quick Sim are exactly the matches the
  balance suite measures.
- A delivery can **pause for the player**: decision hooks on catches, run-outs
  and reviews default to the engine's own roll; the live controller throws
  `DecisionNeeded` when the question is the player's, and `resumeBall`
  replays it from the same random numbers once they answer.

**Career mode (default)**
- Selection (`engine/career/selection.ts`): the GAME_SPEC §6 score with
  selector trust blended in picks a balanced XI. The player is Playing XI,
  12th man, bench or not selected, with the selectors' reasons. The coach
  promotes an in-form batter up to two places and demotes one on a lean run;
  bowling trust decides how readily the AI captain gives them overs.
- Batting: the player's own 1-5 aggression (see below), five one-ball
  intents that override it for that ball only (leave, defend, rotate,
  attack, big shot), a direction to aim for, and sims to the end of the over
  or until out at their level. Leave and rotate are engine behaviours
  (`MATCH.leave`, `MATCH.rotate`). All of it applies only while the player's
  own batter is on strike (`battingFor`).
- Bowling: only when the AI captain throws them the ball; their 1-5 bowling
  aggression, line, length, variation and over/round the wicket for their
  own overs (`bowlingFor`).
- Fielding: a catch or run-out coming to the player opens a timing tap.
  Success is the fielder's own chance moved by timing
  (`MATCH.fielding.timingWeight`); the sweet spot widens with skill.
- Reviews of the player's own dismissal are theirs.
- Everyone else is AI-controlled; while the player is not involved the match
  plays on at watching speed, and stops the moment they are.
- Sim controls: next ball / over / wicket, until I'm in, end of innings, full
  auto, sim the rest, animation speed.

**Captain mode (only when appointed, or the dev toggle)**
- Toss with a reading of the conditions (`lib/tossHint.ts`).
- XI and batting order go to the selectors, who accept or overrule each
  change on its merits and the captain's standing.
- Instructions to the batters (attack, rotate, protect the wicket) and a
  bowler to target - they adjust each batter's own read.
- The bowler for every over, within quotas (enforced in the engine), with the
  vice-captain's suggestion.
- Field editor: drag, snap to named positions, presets (new ball, spin,
  defensive, T20 death...), validation against powerplay and leg-side rules.
- Reviews for both sides - the fielding side can now review a not-out lbw, a
  new engine event - plus declarations and the follow-on.
- Delegation of any of these to the vice-captain, remembered between matches.

**Off the field**
- Team morale (both dressing rooms) moves with results and feeds match-day
  morale; team-mates' relationships with the player move with results and,
  as captain, with who they pick and drop.
- Captaincy rating from results, a tactics score built from the captain's
  actual calls, and team morale; stress that costs the player some of their
  own form, softened by temperament and leadership; five defeats in a row or
  a collapsed rating costs the job; a strong record puts them in line for a
  bigger one. The selectors can appoint the player captain when leadership,
  reputation, trust and form make the case.
- Press conference after big matches, with answers that move team morale,
  media reputation and the player's own morale.
- Selectors' note after every match, including when not selected.
- Captaincy record (matches, won, lost, drawn, tied, win %, by team) on Stats.

**Ground view**
- Metre-based SVG drawn from each venue's boundaries; memoised layers so a
  ball redraws only the ball layer; SVG `animateMotion` for the delivery,
  the shot, the fielder running to cut it off and the throw back in.
- The player in gold wherever they are; keeper and bowler drawn differently;
  names on hover or tap; over/round the wicket; the pitching point;
  highlights for 4, 6, wicket, dropped catch and run-out; floodlit, overcast
  and rain looks; wagon wheel overlay, pitch map and beehive.

**Screens**: pre-match (selection, role, opposition, conditions, captain's XI),
toss, in-play (desktop: ground left, panels pinned right; phone: ground on
top, tabbed panels, thumb-reach sim bar), innings break, post-match (every
scorecard, the player's card, player of the match, condition, reputation,
selector trust, media, dressing room, captaincy, press conference), Matches
list and scorecards. Home's Play Match and Quick Sim run this flow.

**Aggression, 1-5 (set by the player, like a management sim)**
- Batting: 1 Very Defensive, 2 Defensive, 3 Balanced, 4 Aggressive,
  5 Very Aggressive. A five-step bar, blue to red, with - and +, tap a step,
  or keys 1-5 on a keyboard (ignored while typing). The level is the
  player's: saved in `career.aggression`, never changed for them, used for
  every ball including quick sims and "sim the rest". A one-ball intent
  overrides it for that ball only.
- Bowling: 1 (tight lines, contain) to 5 (all-out attack) for their own
  overs; changes length, line and variation choice (`choosePlan`), and
  trades runs for wickets.
- Captain mode: a bar for each batter at the crease and for every bowler,
  with Auto (the AI reads the game). The player's own bar is the same one.
- Engine (`MATCH.intent`, `MATCH.aggression`, `MATCH.bowlingAggression`):
  each level moves scoring rate, boundary %, dismissal % and false shots a
  long way. A top-six batter held at one level for a whole ODI innings:
  strike rate 28 / 62 / 89 / 114 / 127, out every 115 / 76 / 49 / 28 / 17
  balls. Level 1 leaves more outside off, level 5 goes aerial most balls. The extra risk
  of attacking is scaled by how set the batter is, the pitch, the bowler
  against the batter, temperament and power (`aggressionRiskScale`).
- Risk label next to the bar (Low / Medium / High / Very High) from
  `estimateRisk`: the chance of getting out to an ordinary ball in the
  conditions as they stand, against the format's base rate. No random
  numbers, so it never changes the match.
- Level 3 is every format's normal game (it was 4 in T20 and 2 in
  first-class), and the AI batter's read now starts a level higher
  (`MATCH.batting.aiIntentStart`) because playing in, anchoring, the tail and
  milestones pull it down - so the AI averages about 3 and "Balanced" is what
  a typical batter plays. Holding 3 all innings scores at about the AI's rate
  (ODI SR 89 v 102, T20 149 v 153).
- Post-match: balls, runs, strike rate and dismissal at each batting level,
  and overs, runs and wickets at each bowling level.

**Save**: `SAVE_VERSION` 3 adds captaincy, relationships, media reputation,
team morale and the dev toggle; v4 adds the player's aggression levels.
Migrations bring older saves forward.

**Bugs fixed on the way**
- `placeField` could place one player twice and leave another off the field.
- A bowler's figures went stale when an innings ended mid-over.
- Demo and new careers shared module-level team, fixture and venue objects,
  and the demo aliased its format and competition records (a match counted
  twice). Each career now owns copies; `commitMatch` clones defensively.
- A forced bowler could exceed the format's quota.

**Balance (1000 matches per format)** - retuned after the aggression
levels: with the AI now centred on level 3, which plays more shots than its
old mix, base wicket and boundary rates came down in every format (T20
wicket 0.0535 to 0.042, ODI 0.0271 to 0.0225, multi-day 0.0184 to 0.0164)
and first-class dot weight went up.

| | T20 | ODI | Multi-day |
|---|---|---|---|
| 1st innings | 164.6 (RR 8.49) | 270.3 (RR 5.66) | 284.1 in 97.7 ov |
| Spread p10 / med / p90 | 85 / 169 / 240 | 156 / 276 / 375 | 131 / 279 / 446 |
| Top-six avg / SR | 26.3 / 151.9 | 37.4 / 101.3 | 31.5 / 60.5 |
| LBW share of dismissals | 10.2% | 10.9% | 13.4% |
| Results | 0.4% ties | 0.3% ties | 37.7% draws |

First-class career averages against mixed opposition: 39.0 / 44.2.

**Tests - 371 passing across 32 files.**

**Known limits**
- A match in progress lives in memory: leaving the screen resumes it, a page
  reload restarts the fixture.
- "In line for a bigger captaincy" is recorded and announced; the move itself
  comes with Phase 5's progression.

---

## ▶️ Next — Phase 5: selection, training and progression engines
