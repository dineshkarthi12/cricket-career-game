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

## ✅ Phase 5 — New career, development, training and calendar (complete)

A career now runs week by week: create a cricketer at 8-12, press Continue,
train within an energy budget, sit exams, get injured and come back, play
the matches the calendar puts in front of you. Still a career game — the user
controls only their own player; captain controls stay behind the captain
flag (Phase 4).

**New career flow**
- `/start` title screen on `banner-bg.jpg`: Continue (last career), New
  Career, Load slot (the three slots), Import save, and the Dinesh demo as an
  option. A browser that has never played lands here — the demo is no longer
  seeded automatically.
- Four-step wizard (reuses `Stepper`, `Card`, `AggressionBar`): name, age
  8-12 and birthday, hometown (38 Tamil Nadu districts first, then towns in
  every other state), jersey number, motto; role (batter / bowler /
  all-rounder / wicketkeeper), batting hand, batting style (anchor /
  stroke-maker / finisher), bowling type (or none — not allowed for a
  bowler), preferred aggression 1-5; 2-3 personality traits (exclusive pairs
  blocked, "Surprise me"); review with the day-one attributes and the academy
  coach's words, and the slot.
- Starting attributes by role, style and age; a **hidden potential** (60-95)
  the UI never shows — coaches give vague hints ("High ceiling", "Late
  bloomer - give it time") and a noisy estimate that firms up with age.
- Ten traits that change training gains, injury chance, recovery,
  temperament in big matches or at the start of an innings, leadership and
  the shape of the age curve.

**Time and calendar**
- Continue bar on every screen: date, the month's climate, exam and injury
  status. It advances a week a day at a time and stops on a match day (Play
  or Sim) — the week cannot go on without the match.
- Season calendar for the player's stage only: school terms, holidays and
  exams (Class 10 boards at 15) under 16; school and club leagues for
  beginners; district league; Vijay Merchant, Vinoo Mankad, Cooch Behar,
  C.K. Nayudu; Ranji, Vijay Hazare, SMAT; the IPL window; Duleep and Irani;
  India A, bilaterals and ICC events in their years. Trials, camps, fitness
  tests, selection meetings, travel and recovery days, birthdays. Matches
  never clash with each other or with exams.
- Calendar screen: month grid and list, colour-coded (match, training/camp,
  fitness test, trial/selection, rest, travel, exams, other), season windows
  as bands, per-month climate note, filters, Play and Scorecard links.
- Birthdays age the player; 1 June files the season and draws up the next.
- Weather by region and month — Tamil Nadu's north-east monsoon Oct-Dec, the
  west-coast monsoon Jun-Sep, northern summer heat and winter dew — feeds
  the match engine through the venue's region.

**Training**
- Weekly plan of up to 7 sessions from 18 drills (nets vs pace / spin /
  power hitting / defence; line & length, pace & seam, variations, death,
  spin; fielding & catching; wicketkeeping; strength, speed, endurance;
  temperament, focus; match simulation; rest), each Light / Normal / Hard,
  inside an energy budget that depends on age, fatigue, exams and studies.
- Nets, bowling and match simulation practise an aggression level; comfort
  there rises, and in matches the player loses up to 0.06 contact (bowling
  skill 0.05) at levels they are not comfortable with.
- Gains by age, potential, traits, coaching, fatigue, form and consistency,
  with diminishing returns near the ceiling. Overtraining raises fatigue and
  injury risk; rest and lifestyle (sleep, diet, recovery) bring it down.
- Coach feedback in the inbox after every week; the Training screen shows
  the preview (expected gains, fatigue, injury risk), last week, overall by
  age, lifestyle, school, comfort, fitness tests and the coaches' hints.
- Fitness tests (yo-yo + 20 m sprint) at camps with pass marks per level;
  failing costs selector trust.
- Under 16: study focus vs cricket; exam weeks halve training; poor grades
  upset the family and cost morale.

**Development**
- Age curve: growth to ~24, peak ~26-31, slow decline after 32-33, faster
  after 36; physical first, mental last.
- XP from matches (with fifty / hundred / five-for bonuses) and training; one
  level curve (150 × n^0.83) for both; Lv and XP bar in the top bar.
- OVR from role-weighted attributes; form streaks (three good or bad matches
  in a row move confidence); form drifts back to normal between matches.
- Skill radar shows current against the coaches' estimate, never the truth.

**Injuries**
- Hamstring, side strain, lumbar stress fracture, fractured finger, ankle
  sprain, concussion (matches only), shoulder, knee, groin and niggles, with
  realistic recovery ranges; young fast bowlers under load get the side
  strains and stress fractures. Causes: fatigue, workload, traits, lifestyle,
  bad luck, matches.
- Rehab screen (`/training/rehab`): cautious / standard / aggressive plans,
  return-to-play test, early return from halfway (rushed: 2.2× risk for ten
  weeks), reduced match fitness on return, injury record. Six weeks out
  costs selector trust; twelve costs the squad place.

**Dashboard** — Upcoming Schedule, Training Focus (this week's plan by kind
of work), Inbox, Next Match, the OVR / Form / Fitness / Morale tiles, Lv/XP
and the Skill radar all read the live career; Training and Calendar in the
sidebar are real screens.

**Save** — `SAVE_VERSION` 5. The migration derives the hidden potential from
the old `potentialOverall`, draws traits from the seed, builds comfort around
the saved aggression, starts rehab for a current injury, maps the old
training slots onto drills, and generates the rest of the current season
after the last existing fixture. A v1 save migrates all the way.

**Bug found and fixed** — a multi-day match stores over 1 MB of deliveries;
with a full season scheduled, the save passed localStorage's ~5 MB after
three matches and autosave failed silently (a reload lost the week). Only the
two latest matches now keep ball-by-ball; older ones keep full scorecards.
A test plays a season and checks the save stays under 3.5 MB.

### 50 careers of training only, age 10 to 35

`src/engine/development/simulation.test.ts` creates 50 random players (role,
bowling type, traits, approach) at 10 and runs the coach's plan every week
until 35 — no matches — and asserts the bands below.

| Age | OVR mean | p10 | p90 | % of potential | Bat | Bowl | Field | Phys | Mental |
|---|---|---|---|---|---|---|---|---|---|
| 10 | 24.3 | 20 | 28 | 32% | 23.3 | 16.2 | 22.3 | 25.2 | 25.3 |
| 11 | 30.1 | 24 | 35 | 40% | 28.9 | 19.5 | 28.6 | 28.5 | 27.5 |
| 12 | 33.5 | 27 | 38 | 45% | 32.2 | 21.8 | 32 | 31.3 | 30.2 |
| 13 | 36.9 | 30 | 42 | 49% | 35.4 | 23.9 | 35.5 | 35.7 | 33.2 |
| 14 | 40.2 | 33 | 45 | 54% | 38.6 | 26.1 | 38.9 | 39.5 | 36.1 |
| 15 | 43.7 | 37 | 49 | 58% | 42 | 28.3 | 42.3 | 42.9 | 39.1 |
| 16 | 47.1 | 40 | 53 | 63% | 45.2 | 30.6 | 45.6 | 46.2 | 42 |
| 17 | 50.4 | 43 | 57 | 67% | 48.4 | 32.8 | 48.9 | 49.5 | 45.4 |
| 18 | 53.6 | 46 | 60 | 72% | 51.5 | 34.9 | 52 | 52.5 | 48.4 |
| 19 | 56.5 | 49 | 63 | 75% | 54.4 | 36.9 | 54.8 | 55.5 | 51.3 |
| 20 | 59.3 | 53 | 66 | 79% | 57.1 | 38.8 | 57.4 | 58.3 | 54 |
| 21 | 61.8 | 55 | 69 | 82% | 59.5 | 40.5 | 59.7 | 60.7 | 56.6 |
| 22 | 64.1 | 58 | 71 | 85% | 61.7 | 42 | 61.9 | 63 | 58.9 |
| 23 | 65.9 | 60 | 73 | 88% | 63.6 | 43.3 | 63.6 | 65 | 61 |
| 24 | 67.4 | 61 | 75 | 90% | 65.1 | 44.4 | 64.9 | 66.6 | 62.9 |
| 25 | 68.4 | 62 | 76 | 91% | 66 | 45.1 | 65.7 | 67.7 | 64.4 |
| 26 | 69.1 | 63 | 76 | 92% | 66.8 | 45.6 | 66.2 | 68.6 | 65.7 |
| 27 | 69.5 | 63 | 76 | 93% | 67.2 | 46 | 66.5 | 69.2 | 66.8 |
| 28 | 69.9 | 64 | 77 | 93% | 67.5 | 46.3 | 66.6 | 69.7 | 67.7 |
| 29 | 70.1 | 64 | 77 | 94% | 67.8 | 46.5 | 66.7 | 70.1 | 68.4 |
| 30 | 70.4 | 64 | 77 | 94% | 68 | 46.7 | 66.8 | 70.5 | 69.1 |
| 31 | 70.6 | 64 | 77 | 94% | 68.2 | 46.9 | 66.9 | 70.8 | 69.6 |
| 32 | 70.7 | 64 | 78 | 94% | 68.3 | 47 | 66.9 | 70.8 | 70.1 |
| 33 | 70 | 65 | 77 | 93% | 67.8 | 46.1 | 66.1 | 68.6 | 70.5 |
| 34 | 68.7 | 63 | 75 | 92% | 66.9 | 44.6 | 64.3 | 65.8 | 70.8 |
| 35 | 67.4 | 62 | 74 | 90% | 65.7 | 43.2 | 62.4 | 63 | 71 |

Injuries per career 12.1, weeks injured 58; peak age median 29 (p10 27, p90 31).

- Raw at 10 (24), state-age-group standard at 16 (47), first-class by the
  mid-twenties (67 at 24, 90% of potential).
- A plateau from 26 to 32 (+1.6), the peak median at 29, then −3.3 by 35 —
  physical (−7.8 from 32) and fielding go first, batting holds better, and
  mental keeps rising with experience.
- The spread is real: p10-p90 is 13-14 points from 16 on, and high-potential
  players (80+) peak well above low ones (≤ 68). Nobody passes their
  potential; training alone reaches ~94% of it (matches add the rest).
- About one training injury every two years, 58 weeks out over a career.

**Tests — 425 passing across 35 files** (54 new): creation and potential
calibration, traits, the age curve, training gains by age, diminishing
returns, the gain multipliers, energy and exam weeks, comfort, fatigue and
recovery, injury rates by workload (and fast-bowler injury types), fitness
tests, studies, XP, streaks; calendar generation for every stage (only the
stage's competitions, real windows, no double-booking, exams avoided, ICC
years, travel and rest, school ending at 16), climate and the engine's
regional weather, the weekly clock (stops for matches, fitness tests,
birthdays, season rollover), save size over a season, the v5 migration, the
comfort penalty, the wizard and the store. The balance suite and live/sim
parity are unchanged.

**Known limits / next**
- Stage progression is not wired yet: the calendar is generated for the
  current stage and the player stays there. Promotion, trials that actually
  select, tournament standings and knockouts are Phase 6.
- Only the player's own fixtures are simulated; other results are not.

---

## ✅ Phase 6 — Selection, tournaments and career stages 1-10 (complete)

The career now moves. Squads are picked, tournaments are played out in full
around the player, and seasons end with a verdict: promote, stay, bench,
dropped, comeback, fast-track, or move on after ageing out. Nothing is
automatic. Still a career game: the user controls only their own player;
captain controls stay behind the captain flag.

**Storage upgrade (done first)**
- Careers moved to IndexedDB (`idb-keyval`) behind an in-memory write-through
  cache, so the synchronous save API is unchanged; localStorage keeps only
  slot headers, the active slot and settings.
- Old localStorage careers are migrated automatically on first load (copied,
  verified, removed) with a toast saying so.
- Ball-by-ball is kept for the user's last 2 matches only; AI-vs-AI matches
  keep results and scorecard lines.
- Every save failure shows a toast (errors stay until dismissed); background
  IndexedDB failures report through `onSaveError`.
- Settings shows the storage used against the quota and each slot's size.
- CLAUDE.md updated. Tests run on `fake-indexeddb`.

**Teams and rivals**
- Sides for every level: schools, clubs, the 38 Tamil Nadu districts, every
  Indian state and association (38 sides), and 15 fictional-named U-19
  nations. Names come from regional pools, with real players blocked.
- 17-man AI squads, each player with a role, attributes, age and date of
  birth, form, hidden potential and a season line. Each season they age and
  develop, age-group players step up the state lineage or leave, veterans
  retire, poor performers are dropped and replaced. Rival news reaches the
  inbox.
- The Competition for places panel ranks the player among their role group:
  the squad plus outside probables at that level.

**Tournaments**
- Real structures for stages 1-10: groups, round-robins, points tables (win /
  loss / draw / first-innings lead for multi-day, NRR for limited overs),
  quarter-finals, semi-finals and finals, knockouts settled on the day.
- Every other match is played on a fast score-only sim calibrated against
  the ball-by-ball engine: T20 first innings 156 v 159, ODI 235 v 240, the
  stronger side winning about 80% in both, four-day draws 32-43% v 37%.
- Tournament screen: fixtures, results, points tables, the bracket, top
  scorers and wicket-takers with the player's rank, awards and past winners.
- Trophies for titles the player played in; individual awards (top scorer,
  leading wicket-taker, player of the tournament); career firsts (state cap,
  Ranji debut, first hundred, first five-for).

**Selection**
- Selectors weigh ability, recent form (last 8 matches, newest weighted
  most), the season's figures against the rivals (lower-level cricket
  discounted by level), fitness and fitness tests, trust, reputation,
  discipline, incumbency and trials. Age cut-offs by date of birth (under X on
  1 September); injuries keep players out.
- Statuses: not selected, trial only, probables, reserve, squad, dropped,
  fast-track; on match day playing XI, 12th man or bench. Batting position and
  bowling usage move with form and trust (Phase 4 coach logic).
- Squad announcements in the inbox with reasons: "Dropped from the Cooch
  Behar Trophy squad after 4 low scores; X comes in", "picked ahead of Y for a
  better strike rate", "in the probables, stuck behind A and B".
- Playable trials and camps: nets (solid / positive / show them), fitness test
  (steady / flat out) and a practice match, or let the coach decide.
- A good player can be stuck behind a better rival; a strong season can
  fast-track (and at 210% of the target, skip a level).

**Career progression, stages 1-10**
- Beginner → District U-14 → State U-16 → U-19 → India U-19 → U-23 → TN
  Senior → Ranji / Vijay Hazare / Mushtaq Ali, as in CAREER_MODE.md.
- Visible targets per stage make selection likely, never certain.
- Ageing out: too old for a level and not promoted means moving on without it
  (marked passed over on the Career Path).
- India U-19 plays bilaterals and the U-19 World Cup (even years) against
  fictional-named nations, and its players still play for their state.
- Senior state has separate Ranji, Vijay Hazare and Mushtaq Ali squads; a
  debut completes stage 7, and meeting the established target in a format
  completes stage 8, 9 or 10.
- Juniors play club cricket alongside; seniors play it only without a squad.
  Clashes go to the bigger competition.

**Screens**
- Career Path (stepper, squad places, next targets with progress, the path
  taken, all 20 stages, turning points), Selection / News (squads and reasons,
  Competition for places, announcements, media and rival news, trials), Trial,
  Season Review, Tournaments. Home's journey card shows squad places and
  progress to the next target; the stepper, stats tabs, trophies and inbox
  read the real career. The Continue bar handles trial days and opens the
  season review.

**Save migration v6**: squad places for the current stage, path, reviews,
trials, low-score and drop counts; AI players converted to the new shape;
old tournament records without tables dropped. The season in progress carries
on as scheduled.

### 100 careers from age 10 (the balance run)

`CAREER_SIM=100 npx vitest run careerSim.report` plays whole careers
headless: the real calendar, the default training plan, every match of the
player's on the fast sim, every trial with the coach's choices, every
selection meeting and season review, to age 30.

| Stage (selected and played there) | Careers | Avg age |
|---|---|---|
| 1. Beginner | 100 | 9.5 |
| 2. District U-14 | 69 | 12.2 |
| 3. State U-16 | 57 | 14.9 |
| 4. State U-19 | 48 | 17.4 |
| 5. India U-19 | 8 | 18.1 |
| 6. U-23 | 33 | 20.9 |
| 7. TN Senior (debut) | **18** | 25.2 |
| 8. Ranji (debut made, working to establish) | 18 | 25.3 |

| Established regular (stages 8-10 completed) | Careers | Avg age |
|---|---|---|
| Ranji Trophy | **5** | 24.8 |
| Vijay Hazare | 7 | 26.6 |
| Mushtaq Ali | 8 | 26.9 |

- Season outcomes over 1,956 seasons: stay 1,277, aged out 335, bench 165,
  promote 155, dropped 17, comeback 4, fast-track 3.
- 33 careers were dropped at least once (54 drops in all); 13 fought back
  into the side.
- 152 matches per career on average (age 10 to 30).
- Against the targets: two-thirds never get past district or state
  age-group cricket, 18% reach senior state (target 10-20%), and a few
  (5%) become Ranji regulars.

How it got there: the first run put 99% into senior cricket. Two things
fixed it. The player's club form and trust outweighed a real ability gap, so
ability now carries 0.60 of the score and lower-level figures count half per
level down. And an age-group squad had only about six players per role for
six places, so outside probables now join the contest and newcomers must
break into the XI places plus one cover. The level profiles were then
raised (state U-16 83, U-19 84, U-23 87.5, senior 88.5 potential) so a
senior place needs roughly the top fifth of peaks.

**Tests - 478 passing across 40 files** (53 new; the balance run is a 41st, skipped unless `CAREER_SIM` is set): points tables, NRR and quotient, bracket
seeding, a full competition to its final, knockouts settled on the day, no
double recording; the fast sim against the engine; age eligibility and cut-off
dates; selection (weighted form, better and worse rivals, drops after low
scores, incumbency, trials, the competition panel, involvement and clashes);
trials (deterministic, showy riskier than solid, squads decided); season
reviews (targets, stay, aged out, promotion likely but not certain, the path,
senior debut, separate senior squads); IndexedDB persistence, migration from
localStorage and failure toasts; the v6 migration; smoke tests for the five
new screens.

**Known limits / next**
- Stages 11+ (IPL scouting onwards) are Phase 7: a player who establishes in
  all three senior formats reaches IPL Scouting and keeps playing senior
  domestic cricket until then.
- Club cricket counts only a little towards selection; a player stuck at a
  level for years mostly waits for ageing out or a strong season.
- The balance run uses the coach's default trial choices; a player making
  good choices does a little better.

---

## ✅ Phase 7 — Stages 11-20: IPL to retirement (complete)

Still a career game: the user controls only their own player; captain
controls unlock only with a real appointment (for India, per format). Nothing
is automatic - every stage from the IPL scouts to the India captaincy is
earned through selection against real rivals.

**0. Earlier senior debuts** - the average TN senior debut was 25.2. Senior
selectors now give young players a prospect credit (1.8 ability points a year
under 25, for the AI too), and a strong U-19 / India U-19 / U-23 season can
bring a senior call-up (the player keeps playing U-23 cricket while
eligible). Result: debut at 22.3 on average (most between 19 and 23) with the
same share reaching senior level (17.5% v 18%).

**1. IPL (stages 11-12)**
- 10 fictional franchises with cities, home grounds, a style (spin, pace,
  batting, balanced), 22-man squads with up to 8 overseas players, purses.
- Scouting reputation from SMAT, Vijay Hazare, India U-19, U-23 and standout
  days; per-franchise interest from their needs and style; scouts in the
  inbox; franchise trials as a playable trial (nets, fitness test, a T20
  practice match).
- Retention day, then the auction: base-price bands the player registers at,
  lots under the hammer with ascending bids from franchises valuing ability,
  form, age, need, style and purse; not shortlisted / shortlisted / unsold /
  bought / replacement / retained / released / traded. Mega auction every
  third season (four retentions at slab prices).
- IPL season: 14-match league, points table and NRR, Qualifier 1,
  Eliminator, Qualifier 2 (the Q1 loser's second chance), final; four
  overseas players in an XI; a configurable impact substitute.
- Bench v XI by the franchise's own selection; contracts run to the next
  mega auction; strong seasons raise the retention deal and bring the
  national selectors; trade offers for a benched player.

**2. Duleep, Irani, India A (stages 13-14)** - five zones (round-robin and
final), the Irani Cup (Ranji champions v Rest of India), India A four-day and
one-day series at home and on tour in local conditions; the zonal and A
selectors pick from a field three times the squad.

**3. India (stages 15-17)** - the national selectors weigh format-specific
ability, form, a year's figures (senior cricket discounted 0.8 a level),
fitness and the camp, age, and the 22 rivals in the India squad plus the
country's best outside it. A playable camp; squads per format before every
series: selected, standby, reserves, dropped; XI, 12th man or bench on match
day. Debut in whichever format the player's case reaches first; caps and cap
numbers, match fees, central contracts (A+/A/B/C), board rests for
workload. 12 nations of fictional players in three tiers whose strength
drifts; home conditions per country (new climates for England, Australia,
South Africa, New Zealand and the Caribbean). Four bilateral windows a
season.

**4. ICC (stage 18)** - T20 World Cup, ODI World Cup, Champions Trophy
(groups or a league, semi-finals, final, all at a host's grounds) and the
World Test Championship (a two-season table and a June final). The rest of
the world's series are settled on ratings for the team rankings and the WTC.

**5. Star (stage 19)** - world rankings per format (batting, bowling,
all-rounder) after every international match, with the formula on the
screen; team rankings. Player of the series, IPL Orange/Purple Cap and MVP,
ICC awards, the annual awards night. Leadership offers (vice-captain, then
captain) at state, IPL and India level - accept or decline; captain mode is
live; records per team and format. Media: followers, mood and pressure (which
costs confidence), and stories that feed the dashboard's Community card.

**6. Legacy (stage 20)** - decline, recurring injuries and form (Phase 5)
plus selectors who move on from ageing players; retire from Tests, ODIs,
T20Is, the IPL, first-class cricket, or everything. Legacy screen: stats by
level and format, trophies, awards, caps, IPL and domestic seasons,
captaincy, the records book (fictional record holders), a timeline and the
legacy rating.

**7. Screens** - IPL Auction (scouting, the auction room with the user's lot
replayed bid by bid, contract, franchises), International (squads, series,
rankings, contract and caps, ICC and WTC), Awards, Legacy and Community; a
decisions card (leadership and trade offers) on Home and Career Path; the
Career Path, journey card, Selection / News, stats tabs, trophies and inbox
all read the professional career. Nav gains International and Legacy.

**Save v7** - `GameState.pro` and the new trophies; older careers load with an
empty professional record. Tiered compaction each season (GAME_SPEC §8f).

### 200 careers from age 10 to retirement (the balance run)

`CAREER_SIM=200 npx vitest run careerSim.report` runs the same
`simulateCareer`; these numbers came from four parallel batches of 50 seeds.

```
200 careers from age 10 to retirement, default training, every match on the fast sim

Stage reached                            careers   share   avg age   completed
1. Beginner                                  200    100%       9.5         200
2. District                                  140     70%      12.3         141
3. State U-16                                118     59%      14.8         119
4. U-19                                      104     52%      17.3         105
5. India U-19                                  7    3.5%      17.7          15
6. U-23                                       62     31%        21          62
7. TN Senior                                  35   17.5%      22.3          35
8. Ranji                                      34     17%      22.6          13
9. Vijay Hazare                               33   16.5%      23.8          27
10. SMAT                                      33   16.5%      24.8          15
11. IPL Scouting                              32     16%      23.5          25
12. IPL                                       25   12.5%      28.6          21
13. Duleep / Irani                            30     15%      25.2          29
14. India A                                   23   11.5%      24.9          14
15. India Camp                                14      7%      26.6          12
16. Intl Debut                                12      6%      28.1          12
17. Regular XI                                12      6%      28.1           4
18. ICC Events                                 8      4%      28.4           4
19. Captaincy                                  6      3%      27.5           1
20. Legacy                                   200    100%      27.5         200
(1-10: selected and played at the stage; 11-20: entered the stage; 20: retired from a format or all cricket)

Established regular (stages 8-10)
Ranji                                         13    6.5%        28
Vijay Hazare                                  27   13.5%      25.9
SMAT                                          15    7.5%      26.7

Retired: 200; average retirement age 27.7; average career 17.7 years (from age 10)
Players with a senior debut retire at 35.3 on average
IPL players: 25 (12.5%)
Capped by India: 12 (6%); regular internationals (25+ caps): 4 (2%)
Captains: state 10, IPL 0, India 1
Legacy: Club Cricketer 165, Domestic Stalwart 15, International Cap 8, State Player 5, International Regular 4, Domestic Legend 2, IPL Regular 1
Season outcomes: promote 316, stay 2173, bench 349, dropped 91, comeback 39, fast_track 32, aged_out 642
Careers with a drop: 72; drops 307; comebacks 64
Average matches per career: 163
Save size at retirement: average 2.73 MB, largest seen 5.79 MB
```

- Very few reach India (6%), a handful become regulars (2%), one in 200
  captained India, and no All-Time Great appeared (the tier needs 150 caps
  and a legacy score of 85 - within reach of a top-potential player who
  debuts young and stays fit, but none of these 200 did).
- Players with a senior debut retire at 35 on average; careers that never
  reach senior cricket end in the mid-twenties.
- Save size stays under control: 2.7 MB on average at retirement, 5.8 MB at
  most (a full international career; 15.5 MB before compaction).
- Tuning on the way: the first run capped 8 of 13 senior players. The India
  profile rose to potential 94, contender fields grew (×3 zones and India A,
  ×4 India), and leadership now has to beat the side's other leaders, with
  level-specific vacancies.

**Tests** - 32 new: the pro season (competitions, IPL shape, playoffs with
the Qualifier 1 loser, overseas limits), the auction (hammer price, unsold,
valuation, the mega cycle, shortlist and the room, mega retention), rankings
(points, rating steps, team ratings and WTC, ranked lists), ICC progression
(years, groups, neutral venues, semis and final), format-specific selection,
leadership (per-format India captaincy, decline), retirement (per format,
all cricket, the sim), legacy, compaction, IPL and international matches on
the match screen, the five screens and the v7 migration; plus the prospect
credit.

**Known limits (addressed in Phase 8)**
- The impact substitute applied only on the fast sim.
- Other nations' bilateral series were settled on ratings, without scorecards.
- No All-Time Great in 200 careers.

---

## ✅ Phase 8 — Polish, QA, installable app and deploy (complete)

**1. Fixes from Phase 7**
- **Impact player, ball by ball.** IPL matches the player plays carry both
  benches; at the innings break the side batting first may bring on a bowler
  and the chasers a batter. The AI picks for itself; a captain gets an
  In / Out picker (or "No substitute") on the Innings Break screen.
- **Legacy on impact, not caps.** The score now adds runs and wickets
  weighted per format, averages, the best world ranking, ICC trophies (WTC
  finals included), India captaincy and wins, awards and records, with a
  little for caps, the IPL and domestic cricket. All-Time Great needs a score
  of 70 and 30 caps (the floor only rules out a cameo). The Legacy screen
  shows where the score comes from.
- **The rest of the world plays.** Other nations' series run on the fast sim
  once squads exist, so rival players earn real rankings and season figures;
  each match keeps a lightweight scorecard (result, top three scorers and
  wicket-takers) under Around the world on the International screen.

200 careers, age 10 to retirement, after the changes:

```
Senior state debut 17.5% · IPL 11.5% · India cap 5.0% · India captain 3
Legacy tiers: All-Time Great 2 (1.0%) · India Great 1 · International
Regular 3 · International Cap 4 · Domestic Legend 4 · Domestic Stalwart 17
Most caps 53 · save at retirement 2.73 MB average, 5.81 MB largest
```

Both All-Time Greats were high-potential all-rounders (hidden potential 89)
who debuted for India at 24, the youngest India debuts in the run: one with
53 caps across all three formats, 85 Test wickets, No. 1 in the world, an
ICC title and the India captaincy; the other 35 caps, a batting average of
54.5 and 65 Test wickets. A long career of modest impact (60 Tests at 29)
stays an International Regular.

**2. Browser QA** - `npm run qa` (`scripts/qa.mjs`, Playwright on the
preinstalled Chromium) starts the dev server, creates a career through the
real UI, visits every screen, plays a match ball by ball, then uses the dev
fast-forward to a senior debut, an IPL auction, an India cap, an ICC event,
a leadership offer and retirement, and screenshots each screen at 1440, 820
and 390 px (light mode) into `qa-screenshots/`, with console errors,
horizontal overflow and fast-forward results in `qa-screenshots/console.txt`.

What the screenshots and logs showed, and the fixes:
1. **Pages wider than the screen** on tablet and mobile (up to 1,277px on an
   820px viewport): the career stepper's screen-reader labels are absolutely
   positioned and escaped their unpositioned scroll container; grid items
   would not shrink below wide tables. The stepper's scroller is now
   positioned, and grid items may shrink (tables scroll inside their cards).
2. **Dashboard vs the design at 1440px**: Next Match fell below the hero with
   an empty half row, and the cards ran two to a row. Next Match now sits over
   the hero and the cards run four to a row from 1360px (a `wide` breakpoint);
   the hero's player and mottos no longer overlap; Recent Match names truncate
   and scores never wrap.
3. **Fonts never loaded** (Google Fonts unreachable; it would also fail on an
   offline first launch): Poppins and Caveat are now bundled.
4. **Training on mobile**: the drill picker collapsed to its arrow, hiding
   the drill name.
5. **Matches**: rows showed "C.." on mobile; "Still to play" listed every
   unplayed fixture in the world - other teams' games with Play / Quick Sim
   buttons - and results rendered a whole career (a 58,000px page). Now only
   the player's fixtures, and results 30 at a time.
6. **A stale "Match day" note** stayed on the Continue bar after the match
   and even years later; it is now tied to its day and match. The bar hides
   during a match or trial (its Sim button mid-match was a trap).
7. **Home after retirement** still showed a Next Match (another team's WTC
   final); the dashboard now shows only the player's own fixtures, and a
   "career is over" state.
8. **Leadership offer and journey cards** squeezed their text beside buttons
   and chips on mobile, and pushed the progress block off the card on
   desktop; both wrap now.
9. **Real brands**: two media outlets used real names (Wisden, The Hindu);
   both are fictional now.
10. **Secondary text contrast**: `ink-soft` #8A93A6 (3.2:1) is now #6B7488
    (4.7:1).
11. **No error boundary**: a render error blanked the whole app (seen when a
    QA step removed React-owned nodes); screens now fail to a Reload /
    Dashboard card.
12. **Dev fast-forward**: an "IPL auction" target never fired for a player
    who joined a franchise without an auction lot; it now stops at the first
    auction or contract.
13. **After retirement** the journey card still showed "Not selected" chips
    and "Next: an IPL contract"; it now says the journey is complete (fixed
    after the final screenshot run, so 65-home-retired still shows the old
    card).

The final run: 66 screens × 3 widths, **no console errors or warnings, no
horizontal overflow**. Mobile full-page screenshots show the fixed bottom tab
bar mid-page - an artifact of full-page capture, not the layout.

**3. Player experience**
- First-time tutorial: five short tips (dashboard, training, match
  controls, the aggression bar, selection); "Skip tutorial"; reset in
  Settings.
- Loading skeletons for code-split screens, empty states (Stats, fixtures
  after retirement), error toasts on bad save files, confirm dialogs for
  retiring (existing), deleting a career and replacing it by import.
- Settings: difficulty Easy / Realistic / Hard (selection bonus ±4 and the
  player's batting and bowling ±4 in every match; save v8), commentary,
  animation speed, default sim speed, reduce motion, reset tutorial,
  storage usage, export / import, delete, install help.
- Accessibility: focus ring, skip link, dialogs that trap and restore
  focus, radio groups for choices, darker secondary text, reduced motion
  from the system or the in-game switch.
- Performance: every screen but Home is code-split and recharts loads with
  the first chart - the main bundle went from 1.52 MB to about 0.82 MB
  (270 KB gzipped); fonts are self-hosted.
- A real Stats screen: by format, competition, level and season (with a
  chart), and the captaincy record.

**4. Installable app** - web manifest and crown icons (any, maskable,
Apple touch), a build-generated service worker that precaches the whole app
(verified: with the network off, deep links, lazy screens and fonts all
load), an Install app banner and an Update banner for new versions.

**5. Deploy** - `vercel.json` (Vite build, SPA fallback to `index.html`,
`sw.js` never cached, immutable assets), a root `README.md` (what the game
is, running locally, deploying, the tech stack). Vercel's Root Directory
must be `cricket-career-game`.

**Tests** - new: the live impact substitute (AI, captain's choice, no
substitute), legacy impact (All-Time Great without 150 caps, long modest
career, what each part adds, no cameo greats), other nations' scorecards and
rankings, difficulty (engine and selection), the v8 migration, the dev
fast-forward. 524 tests pass; `npm run build` is clean.

**Known limits**
- The dev fast-forward runs on the main thread: a jump of many seasons
  freezes the page for a few seconds (development builds only).
- World rankings for other nations' players fill in from the first season
  rollover after the national selectors start watching.
- Full-page QA screenshots are about 25 MB per run; rerun `npm run qa` rather
  than keeping old sets.

### Phase 8 addition - match sound

- Match sound synthesised in the browser (no audio files): bat on ball,
  stumps, appeal, the crowd for fours, sixes and wickets, a groan for ducks,
  drops and the player's own wicket, applause for fifties, hundreds and
  five-fors, crowd murmur during play, and the result.
- A spoken commentator (the device's text-to-speech) was added and then
  removed at the player's request: device voices sounded robotic. The
  written commentary stays on screen; its grammar was fixed on the way
  (capitalised sentences, no "clips it away it", scoring leaves and blocks
  read as steered or nudged).
- Settings: sound effects, crowd atmosphere, button clicks, volume, and
  "Test the sound".
- Tests: the effects for sixes, fours, 1/2/3, dismissals, ducks, run outs
  of the non-striker, milestones and the result. 529 tests pass.

---

## ✅ Phase 9 — Real players (complete)

The generated rivals at professional and senior state level are now real
cricketers from `github.com/dineshkarthi12/Cricket-teams-and-players`.
Real player and team names are allowed (CLAUDE.md updated); crests stay
generic, team colours are the real ones. GAME_SPEC §8h has the details.

**Converter** - `npm run import:players -- --data <clone>` (`scripts/import-players.mjs`,
logic in `scripts/players/`). Reads the zips directly: 9,207 matches (Test 895,
ODI 2,576, T20I 3,798, IPL 1,243, SMAT 695; 7,373 players) in ~45 s, the
Kaggle IPL archive for styles and full names, and the two squad lists.
Writes `src/data/real/{international,ipl,domestic}.json` (1,312 players,
~375 KB, ~100 KB gzipped, lazy chunks) and `src/data/playerOverrides.json`.

**Matching** - 1,794 listed names (Ranji + Vijay Hazare entries), 1,120
matched to figures, 671 unmatched, 3 ambiguous. Of the 1,047 players in the
state squads, 754 have figures; the 293 without get generated state-level
attributes. The overrides file lists for checking: 26 fuzzy spellings, 41
players listed for two sides (and which was kept), 670 guessed batting
hands and 437 guessed bowling styles (players outside the Kaggle archive),
288 guessed roles, 1,312 estimated ages (debut at 21 - every age is an
estimate), 11 IPL-only players assumed Indian, and the names trimmed from
long Vijay Hazare lists. Four Afghans are fixed by hand in `manual` (the data
has no Afghanistan internationals).

**Game** - ratings from the figures (`engine/world/realPlayers.ts`,
`REAL_PLAYERS` in config): India squad 78-93 (median 87), IPL 69-93 (median
80), domestic-only 62-78 (median 69); T20 against red-ball skills from the
figures, so `formatOverall` differs by format. The ten franchises (real
names, same ids), all twelve senior national squads (Afghanistan generated),
India A, the zones and the Rest of India from the real state players, and
the state sides' separate Ranji, Vijay Hazare and SMAT squads
(`Team.competitionSquads`). Real players age on their own random stream, so
every copy of a player is identical, and retire at a fixed age; generated
youngsters replace them. The IPL auction draws unsigned real players first.
India's outside contenders are real players.

**Save v9** - franchise names change at once; the real squads replace the
generated ones at the next 1 June (`realSquadsPending`,
`engine/world/realSeed.ts`). A fresh professional season is ~2.9 MB against
2.3 MB with generated squads (bigger state squads).

**Tests** - 42 new (571 in all, 1 skipped): both squad-list formats with
the (c) / (vc/wk) / Standbyes / subject-to-fitness cases, name matching
(initials, spelling, family-name-first, common surnames, ambiguity),
Cricsheet parsing and weighting, a whole conversion on a hand-made fixture
with manual overrides, the figures -> attributes mapping and the level bands,
ageing and retirement, IPL squads within the overseas limits, a new career
with real India / IPL / Ranji / Vijay Hazare / SMAT squads and the user
ranked against that competition's squad, a career reaching the top in 2036,
and the v8 -> v9 migration and rollover.

**Browser QA** - a 2026 professional career (imported) and the demo career
fast-forwarded to 2038-42: Selection (Competition for places per
competition), Tournaments, a Ranji match played ball by ball, the IPL screens
and Franchises, the auction room, International squads and rankings; no
console errors. Fixes from it: players without figures no longer rate above
proven ones, generated contenders sit behind real sides, stronger small-sample
shrinkage.

**Worth knowing** - the career starts in 2026 with the user aged 8-12, so by
their senior debut (around 2036-38) most of today's players have aged or
retired and generated players have taken their places; the youngest real
players are still there.

### Phase 9 follow-up - logo and real roles

- **Logo**: the Cricket 26 badge (`design/logo-cricket-26.png`) is the app
  icon (192/512, maskable, Apple touch), the favicon and the badge in the
  sidebar, icon rail and start screen; `npm run icons` renders every size
  from it in Chromium. The old crown SVG icons are gone.
- **Real roles checked**: every national and IPL squad player (460) and the
  well-known state players were checked against their real roles, batting
  hands and bowling styles. 262 player corrections and 12 name matches went
  into `playerOverrides.json` → `manual`, then the data was regenerated.
  Examples: Shivam Dube, Riyan Parag, Venkatesh Iyer, Rahul Tewatia, Deepak
  Hooda → all-rounders; Robin Minz, Vishnu Vinod, Tejasvi Dahiya, Aryan
  Juyal, Lhuan-dre Pretorius → keepers; Tristan Stubbs, Devon Conway →
  batters; Shaheen Afridi left-arm fast, Abrar Ahmed and Shadab Khan
  leg-spin, Kumar Kartikeya left-arm wrist spin; Shams Mulani, Tanush
  Kotian, Jalaj Saxena, Shreyas Gopal → bowling all-rounders. Duplicates
  merged: Umesh Yadav, Vaibhav Suryavanshi, KC Cariappa, Raj Bawa, Ankeet
  Bawne, Ramakrishna Ghosh, Sushant Mishra, Tejasvi Dahiya, BR Sharath;
  Haryana's Rohit Sharma is no longer matched to India's. Listed names now
  matched to figures: 1,133 of 1,794. State players unknown to me keep the
  converter's role and stay flagged in the file.
- A test pins the real roles and styles of 37 well-known players. 572 tests
  pass; build clean.

### Fix - the notifications bell

The bell in the top bar showed an unread count but did nothing when tapped,
and nothing ever marked a message read, so it sat at "9+" for good. It now
opens a panel (`layout/NotificationsPanel.tsx`) with the latest 30 messages,
unread important ones first: tap one to read it (marks it read), "Mark all
read" clears the count, a tap outside, Escape or a change of screen closes
it. Works with touch on phones and tablets. 2 new tests; 574 pass.

### Fix - who is on strike, on screen

The engine already rotated the strike correctly (checked on 21,000
deliveries: odd runs and odd byes cross, 0/2/4/6 do not, the ends change at
the end of every over; the only exceptions were a new batter after a
retirement). But the 2D ground drew only one batter, always at the
striker's end, so after a single it still looked as if the same player was
on strike. Now:
- the ground shows both batters - the striker at the batting end, the
  non-striker beside the stumps at the bowler's end - with names (the player
  in gold, "YOU"), and they run along the pitch to their new ends when they
  cross (after the ball reaches the bat; instant with reduced motion);
- the score strip keeps both batters in their rows and moves an ON STRIKE
  badge between them, instead of swapping the rows.
- `engine/match/strike.test.ts` locks the rule in, for simulated matches and
  ball by ball in a live match with the player batting.

### Fixes - aggression levels and getting out of club cricket

**Batting aggression 1-5.** For the user's own player, levels 4 and 5 were
the same: a batter already at the wicket-chance ceiling (not yet in, better
bowlers) hit it at both, so 4 got out as often as 5 and scored less, and 2
barely scored more than 1. The situation is now capped first and the level
multiplies on top of it for attacking levels; 2 and 4 were retuned (2
defensive but scoring, 4 positive but manageable). A state player in T20:
level 1 SR 42, out every ~80 balls; 2 SR 106 / 44; 3 SR 140 / 28; 4 SR 171 /
15-19; 5 SR 205 / 7-8 (was 4: SR 173 / 10, 5: SR 209 / 10). Defensive levels
and the AI's normal game keep the old limits, so the match balance tests are
unchanged. New test: a weaker batter against better bowling keeps every step
distinct.

**Stuck in club cricket.** Careers were ageing into the U-19 and U-23 stages
but never picked, so from about 14 every match was the Chennai club league:
state age-group squads are the state's best kids (potential ~84) while a new
player averaged ~72, and club figures counted 1/8 for the U-19 selectors and
1/64 for the senior ones (half per level down). Now club/district form
counts 65% per level for at most two levels, and the user's hidden potential
is 66-96 (average ~79). 32 simulated careers from age 10 to 24: state U-16
88% (median age 15), U-19 81% (17), senior state debut 38% (21, was ~17%),
Ranji 34%, Vijay Hazare 28%, SMAT 19%, IPL 6% - the talented usually get
there, nothing is guaranteed.

Tests: 577 pass. Two test adjustments: the development test compares
potential 84+ with 74- (the old "68 or less" group no longer exists), and the
fast-sim check for even first-class sides allows 0.2 (only ~55 of 80 matches
are decided).

### Commentary highlights, the road to selection, and carrying an innings

**Commentary highlights.** The ball-by-ball feed was plain text with a
coloured edge. Now (`lib/highlights.ts`, derived from the log, so older
saves get it too):
- every ball has a scorer's chip: `•`, 1-3, **4** (green), **6** (gold),
  **W** (red), `wd` / `nb` / `lb` / `b`; fours, sixes and wickets are bold;
- banners for the big moments: a batter's FIFTY / HUNDRED / 150+ (with balls,
  fours and sixes), FIVE-FOR, HAT-TRICK, the team's 100 / 150 / 200...,
  50 / 100 partnerships; wicket lines give the score (e.g. "Kerala 112/4");
- an "End of over" strip with the over's runs and the score;
- a **Highlights** filter (only 4s, 6s, wickets, drops and milestones);
- on the ground during play, a banner pops up for two seconds: FOUR!, SIX!,
  OUT!, FIFTY!, HUNDRED!, FIVE-FOR!, HAT-TRICK! (gold ring when it is you).

**Road to selection.** The Home "Next Match" card used to show the state
side's next Ranji / Vijay Hazare game even when the player was not picked,
while Continue (correctly) skips those - so the matches looked "missing".
The Next Match card now shows only a match the player is in (the one
Continue stops at); the Upcoming Schedule marks the side's other games
"not picked, played without you". A new **Road to selection** card on Home
(`engine/career/journey.ts`) shows, per competition, six steps - Scouted,
Shortlisted, Trial, Squad, Playing XI, Regular - with the step in play
highlighted and explained, where the selectors rank you among your role
group (XI and squad cut-offs), the scouts' report (figures, form, trust,
OVR), the next selection event and the next match (you play / without you).
After Continue, any selection news opens a four-step **Selection news**
walk-through: the scouts' report -> the selectors' meeting and your rank ->
the verdict (green / red) -> the road ahead.

**Carrying an innings.**
- Bug: the set batter shielding the tail did it backwards (took the single
  early in the over and refused it off the last ball), handing the strike to
  the tail. Fixed: no single early in the over (two where he can), one off
  the last ball; a turned-down single does not count as dot-ball pressure.
- New batting option **Carry the innings - farm the strike**: once set, the
  player keeps the strike; while they are at the other end their partner
  plays safe (at most level 3) and works the single to give it back.
- Limited-overs only: a set batter is "in the zone" - runs on the board make
  attacking safer as well as balls faced (`aggression.zone`, `risk.inTheZone`),
  and a collapse at the other end hurts the new batters, not the set one as
  much (`momentum.collapseSetShare`). First-class keeps its balance (farming
  strength 0.4 there; draw rate unchanged).
- Measured: a 62-rated side chasing 175 against a 66-rated attack wins 37%
  (was 31%); the player on 50+ at level 4 is out every ~35 balls (was ~32).

Tests: 8 new (highlights, the journey, farming the strike, the Next Match
card); 585 pass.

### Realism pass - white-ball scores, extras, run-outs; two fixes

Measured against real cricket (evenly matched sides, 400-600 matches):

| | before | now | real cricket |
|---|---|---|---|
| T20 1st innings | 172, sd 52 | 171, sd 41 | IPL ~180, SMAT ~160 |
| T20 under 100 / 200+ | 10% / 32% | 5% / 25% | a few % / 15-30% |
| T20 extras per innings | 3.7 | 6.5 | ~8 |
| Run-outs (T20 / ODI) | 2% / 4% | 7% / 7% | ~7% |
| ODI 1st innings, 350+ | 283, 20% | 281, 12% | 280-300, ~10-15% |
| One-day (Vijay Hazare) | - | 267 | 270-290 |
| First-class | 291, 37% draws | unchanged | 300-320, 35-45% draws |

What changed (`config.ts` -> `MATCH.limitedOvers`, white-ball only):
- a collapse brings the next wicket less readily, and a new batter walks in
  with licence to play (T20 innings were far too swingy);
- a T20 lower order keeps swinging instead of "batting the overs out" at
  seven down, and T20 tailenders no longer block (`t20WicketAllowance`);
- a slightly higher wicket floor and a smaller set-batter bonus (fewer
  runaway partnerships), wides called tighter, harder running between the
  wickets; T20 and one-day boundary rates retuned so the averages hold;
- the fast sim (the AI-vs-AI matches) was 7-11% below the engine; T20 and
  one-day now within 4-7%.
The career player at #3 in full matches: T20 level 3 about SR 145, one-day
level 3 average ~46 / SR 89, first-class level 3 average ~42 / SR 55. The
balance tests now also cap the tails (T20 under 100 < 9%, 200+ < 30%, ODI
400+ < 5%) and require real white-ball run-outs.

Fixes:
- The flaky "respected captain" test was a timeout, not a logic bug: it
  built the demo career 60 times (4.3 s against a 5 s limit), so it failed
  when the suite ran in parallel. It builds it once and clones it now.
- `npm run qa` typed the player's name before the form was ready (the
  name was lost and the run stopped at "Start career"); it waits and types
  now, and closes the selection-news walk-through.

### The modern game, by competition - and the bowler's and all-rounder's side

**Scoring by competition** (`COMPETITION_SCORING` / `scoringProfile` in
`config.ts`, passed to every delivery through `InningsSetup.tournamentId`).
Evenly matched sides, first innings:

| | average | big totals | run rate | bowling |
|---|---|---|---|---|
| IPL | 191 | 200+ in 48%, 250+ in 8% | 9.7 | econ 9.7, avg 30 |
| Mushtaq Ali / T20I | 178-180 | 200+ in ~32% | 9.0 | econ 9.0, avg 27 |
| ODI | 287 | 350+ in 22%, 400+ in 5% | 6.1 | econ 6.0, avg 39 |
| Vijay Hazare | 274 | 350+ in 11% | 5.8 | econ 5.7 |
| Test | 301 | 450+ in 15% | 3.4 | avg 33, SR 61; 7-14% draws |
| Ranji | 289 | 450+ in 9% | 3.0 | avg 30, SR 63; 35% draws |

- Bug: Tests were played over four days (the first-class length). They are
  five now (`matchDaysFor`), with a modern Test tempo (faster scoring, more
  wickets) - draws went from 50% to about 10%.
- The fast sim (AI-vs-AI matches) follows the same profiles (`quickTempo`)
  and stays within ~5% of the engine in every competition.

**The bowler's side.** Bowling aggression 5 used to be the best at
everything (Ranji: average 22 at level 5 against 31 at level 3), so there
was no reason to pick anything else. Now it is a trade - a T20 seamer:
level 1 economy 5.8 / SR 27, level 3 7.9 / 18, level 5 11.0 / 14, and the
average is no better at level 5 (`bowlingAggression.wicket`).

**Highlights for bowlers and all-rounders.**
- Commentary: THREE-FOR and MAIDEN moments, the bowler's figures on every
  end-of-over strip (e.g. "Starc 3-0-24-1", yours in gold), and the
  ALL-ROUND SHOW banner when a player has 50 runs and 3 wickets in the match
  (counting earlier innings). Your moments carry a YOU tag; the ground
  banner shows your maidens too.
- A **Match highlights** reel on the post-match screen and every scorecard:
  fifties and hundreds (with SR), three-fors and five-fors, tight spells,
  hat-tricks, the all-round double (or 30 runs + 2 wickets), and your line
  always; filters All / Batting / Bowling / Yours. Built from the
  scorecards, so archived matches have it too.
- The scouts' report judges batters on runs, bowlers on wickets, average
  and economy, and all-rounders on both.

Tests: 7 new (competition scoring, Test length, the bowling trade-off,
maidens / three-fors / all-round doubles); 592 pass.

---

## ✅ Phase 10 — Role rules, defensive batting, and IPL Manager mode

### Root causes found
1. **A Pure Batter was asked to bowl.** `bowlersOf()` treated anyone with a
   bowling style as a bowler, and new careers defaulted Batters to
   "right-arm medium"; a side with fewer than four bowlers fell back to the
   whole XI, and `chooseBowler` fell back to `bowlers[0]`. The user's
   batter became a part-timer the captain could throw the ball to.
2. **Defending barely helped.** `wicketChance()` applied the wicket *floor*
   (62% of the base rate in white-ball cricket) after the DEFEND multiplier,
   so a block was only ~2.3x safer than a normal shot in a T20. Collapse,
   dot-ball and scoreboard-pressure multipliers also hit a deliberate block
   in full, a block could still produce sixes and rope catches, and "Leave"
   left straight balls as often as wide ones.
3. **Dismissal integrity.** With a batter retired hurt, an innings could run
   out of incoming batters with fewer than ten down, leaving a dismissed
   batter at the crease to be "out" again; a wicket was written without
   checking it was a real dismissal of a batter at the crease; and the
   auto-play timer could bowl the ball the player had just chosen to defend.

### Fixes
- **`engine/roles.ts`** - one role-capability module: `roleCategory`,
  `canUserControlBatting`, `canUserControlBowling`, `canPlayerBeAssignedToBowl`,
  `getAvailableMatchActions`, `canTrainBowling`. Used by the bowler choice,
  the quick sim, the over guard (the engine throws rather than hand a
  restricted player the ball), training (no bowling drills or bowling
  growth for batters and keepers), selection notes, the match controls,
  player creation ("None (Pure Batter)") and a confirmed **role change**
  in Settings (`engine/career/roleChange.ts`). AI part-timers are unchanged.
- **Defensive batting** (`delivery.ts`, `MATCH.defence` in config): the floor
  is bounded before a sound batter's caution (scaled by technique and
  concentration, so a tail-ender's block is still fragile); collapses and dot
  pressure reach a block only in part; blocks cannot be hit for six or caught
  on the rope or stumped; defensive dismissals are edges, bowled, lbw and
  bat-pad catches; Leave picks up straight balls by judgement. White-ball AI
  batters tighten up after a cluster of wickets (`collapseCaution`).
- **Integrity**: `validOutcome()` refuses any wicket without a dismissal type
  on a batter at the crease (non-strikers only by run-out, nothing on a free
  hit); an innings with nobody left to come in ends; finished innings take
  no balls; the match store ignores stale ball requests (`ballKeyOf`).

Measured dismissal rates (balls faced per dismissal, generated batters,
300 innings each; before -> after):

| | Defend | Normal | Attack | Big shot | Leave |
|---|---|---|---|---|---|
| T20 | 49 -> 65 | 21 -> 22 | 14 | 7 | 21 -> 59 |
| T20, 4 down | 47 -> 70 | 22 -> 23 | 15 | 8 | 20 -> 59 |
| ODI | 76 -> 124 | 42 | 33 | 17 | 39 -> 123 |
| First-class | 132 -> 188 | 50 | 24 | 13 | 56 -> 168 |

A genuinely good ball still gets a defender out (bowled, lbw, edges); the
balance suites (T20/ODI/first-class, competitions, aggression) all pass.

### IPL Manager mode (new, separate game)
- `src/types/manager.ts`, `src/engine/manager/*` (pure TS), `src/store/managerStore.ts`,
  `src/save/managerSaves.ts`, `src/screens/manager/*`; routes under `/manager`,
  entered from the start screen and the career sidebar.
- Career: Head of Scouting -> Assistant Coach -> Head Coach -> Director of
  Cricket. Each rank holds a set of responsibilities; promotion only at a
  season review on reputation and the board's objectives; sacking below the
  board's confidence line, job offers, explicit retirement with the whole
  history kept.
- Full control (`profile.fullControl`, on by default for new careers, switch
  on the Profile screen for older saves): every responsibility is the
  manager's from the first week whatever the rank, so Continue never runs the
  auction, picks the XI or plays a match for them. Cannot be switched while a
  live auction is open. Under full control the first scouting week waits for
  a scout to be sent, and the auction has no "let your assistant finish".
- Season flow on screen (`src/screens/manager/PhaseFlow.tsx`): Continue opens
  the screen the next step needs (scouting, trials, retention/auction prep,
  live auction, playing XI, the next match, the season summary), and a
  Continue bar sits on every manager screen except Home and a live match.
- Scouting network (regions, trips, budgets, staff quality, analyst), reports
  with estimates and uncertainty, hidden potential, rival interest; trials
  and development contracts that can be refused or countered.
- Retention (mega auction every third season), auction preparation with
  targets and maximum bids, and a live auction against nine AI franchises
  with their own needs, styles and purse discipline. Purse, squad (18-25) and
  overseas (8) limits enforced; second round for the unsold; replacements.
- Squad and XI validation (11, keeper, 5 bowling options, 4 overseas, no
  injured players), weaknesses, default XI/plan, tactics (approach, surface
  plans, phase bowling plan, workload, impact sub).
- 14-round league + Qualifier 1 / Eliminator / Qualifier 2 / Final, NRR,
  points table. Matchday on the ball-by-ball engine with live tactical
  control (approach, next bowler, target bowler, toss, impact sub) or quick
  sim; AI fixtures on the calibrated quick sim; scorecards and reports.
- Development (focus, coaches, fatigue, injuries, ageing), staff hiring and
  courses, contracts/renewals/releases, a once-only ledger and budgets,
  awards (Orange/Purple Cap, MVP, emerging), records, milestones, legacy.
- Saves: three manager slots of their own (IndexedDB + headers), own file
  marker, validation (squads/contracts consistent, no duplicate
  transactions), versioned migrations; career and manager saves can never
  load or overwrite each other.
- Manager matches use an `ipl-manager` scoring profile so full-strength real
  XIs score at modern IPL levels (~185 +- 45 first innings).

Tests: 79 new (roles 16, dismissals 17, manager engine 30, manager saves 5,
manager screens 9, store, selection and home updates); 671 pass, 1 skipped.
`npm run lint` and `npm run build` are clean.

---

## ✅ Phase 11 — Two-touch batting, challenges, rivals and the career card

### What was found
Phase 10 had already fixed the Pure Batter bowling bug (`engine/roles.ts`,
enforced by the engine's over guard), defensive batting and the
dismissal-integrity issues, and built IPL Manager as a separate mode with its
own saves. The inspection re-ran those suites (all green) and found what
was still missing: batting had no touch control or timing - the player
chose an intent and "Play the ball", and the outcome ignored where or when
they played - and there were no challenges, no rivals view and no career
card.

### Two-touch batting
- `engine/match/touch.ts` (pure): the screen side maps to leg or off for the
  batter's hand; a timing window from delivery pace, the batter's timing and
  footwork, and difficulty; `gradeTiming` (early / good / perfect / late /
  no shot); `touchEffect` - multipliers on contact, wicket, four and six
  chances from the timing grade and how well the side suits the line.
  A deliberate block feels 30% of it, so DEFEND is never scored like an
  attacking shot. All constants in `MATCH.touch`.
- `resolveDelivery` uses the tap for shot choice (side-appropriate: cut,
  drive, loft, reverse sweep / pull, hook, flick, sweep), direction (a clean
  contact goes to the chosen side, a mishit wherever the edge takes it) and
  dismissal type (across the line to leg: lbw / bowled; late: bowled, lbw,
  caught behind; early: caught, caught and bowled). A ball without a tap uses
  exactly the same random numbers as before, so AI matches and every balance
  suite are unchanged.
- `planNextDelivery` / `live.peekDelivery`: the next ball is decided before it
  is bowled so the player sees its line, length and pace; `nextBall` bowls
  that same ball. `Ball.touch` records the tap; only the user's own batter can
  carry one (`own` overrides only).
- `TouchBatting.tsx`: intent, "Face the ball", big LEFT/RIGHT pads labelled
  leg/off, the ball on a pitch strip, the delivery read, a timing meter with
  text labels, Leave, pause, keyboard, timing assist, reduced motion, an
  aria-live result, and a replayable five-step tutorial. Each ball is
  committed once (a per-ball key, checked again by the store); a hidden tab
  or a question calls the delivery back unplayed, and the same planned ball
  comes again.

Measured (200 innings each, generated batters, balls per dismissal / SR):

| T20, level 4 (Attack) | reads the line | plays across it |
|---|---|---|
| no tap (old behaviour) | 15.0 / 188 | |
| Perfect | 23.2 / 240 | 16.0 / 185 |
| Good | 20.6 / 209 | 12.2 / 158 |
| Early | 14.8 / 159 | 11.9 / 129 |
| Late | 12.9 / 131 | 10.3 / 108 |

DEFEND stays at 60-90 balls per dismissal in a T20 whatever the timing or
side (no tap: 73), and a collapse at the other end does not make a timed
block riskier.

### Challenges (save v10)
`engine/career/challenges.ts`: three daily and three weekly challenges chosen
from the real local date and the save's seed, filtered by role (no wicket
challenges for a Pure Batter or keeper). Progress comes only from the
activity log - each committed match the player played (once per match id)
and each finished training week. A claim pays XP once and is stored in the
save, so a reload or double tap cannot claim it again. Migration v9 -> v10
adds an empty `challenges`.

### Rivals and the career card
- `engine/career/rivals.ts` + `/rivals`: squad-mates in the player's role group
  at each current side - rating, form, fitness, season figures, selector
  favour, injuries, direct rivals - and the player's rank among them.
- `engine/career/careerCard.ts`, `lib/shareCard.ts` + `/career-card`: the card
  from the save; Share (Web Share with the PNG where files are supported,
  else text), Save image (canvas PNG) and Copy text. Each reports what the
  browser actually did: cancelled, unavailable and failed are never shown as
  success.

Tests: 36 new (touch engine 14, touch controls 7, challenges 10, screens 5);
one updated (`realPlayers.test.ts` now expects `SAVE_VERSION` after the v10
bump). `npm run build` is clean.

### Follow-up: the batting screen as before; IPL Manager matchday controls and sound
- The two-touch batting screen is removed at the player's request: on strike
  the match shows the earlier controls again (aggression bar, one-ball
  intents, aim, carry the innings, sim). The touch engine (`touch.ts`,
  `peekDelivery`) stays, unused by the UI and still tested; untouched balls
  never used it, so nothing in play changes.
- IPL Manager live match: the compact Ball / Over / Wicket / Auto bar is
  pinned above the tab bar on phones and tablets (no scrolling to play), Auto
  plays a ball at the chosen speed until paused or the innings stops (the
  one-ball buttons lock meanwhile), and the match has the career match's
  sound (bat, stumps, crowd, result) through `useMatchAudio`.

### Fix: real stars retired before the game started
Kohli, Rohit, Dhoni, Bumrah, Jadeja, Starc, Cummins, Russell and 24 more of
the 388 real squad players were gone by 2027 - the season an IPL Manager
career starts. A real player was only guaranteed one season past the 2026
data, retirement ages were 34-39 (Bumrah drew 35), and IPL Manager retired
everyone at 39 (and 36-38s at 35% a season) on top. Now:
- `realRetireAge`: 35-40, +2 for the best (overall 86+), and a player active
  in the data season or the one before plays at least three more seasons
  (`REAL_PLAYERS.minSeasonsLeft`). Nobody in a real squad retires before
  2029; by 2030 about 51 of 388 have, gradually.
- IPL Manager's yearly ageing uses the same per-player retirement age for
  real cricketers; generated players keep the old rule.
- `realStars.test.ts`: no real squad player retired in 2027/2028, veterans
  still leave later, Kohli is at RCB in a new manager career and the stars
  survive the first season rollover.
Saves made before this keep the players they already lost; a new career (or
a new IPL Manager career) has them. Birth years are still estimated from a
player's first recorded match, so some are a year early (Kohli 1987 rather
than 1988); fixing that needs `npm run import:players` with Cricsheet access.

### Fix: the player's batter got out too early
Every AI batter plays one level safer for their first 8 balls; the player's
batter played their standing aggression from ball one, so on Balanced or
above they were out early far more often (T20 at Balanced: 43% of innings
over inside 10 balls; at Very Aggressive, 76%). Now:
- `MATCH.batting.playInBalls` (8) and `playInLevel`: the player's standing
  level (Balanced or above) is played one level safer until they have faced
  8 balls. A one-ball choice (Attack, Big shot...) is played exactly as
  picked; Defensive levels are unchanged.
- The batting panel says so ("Playing yourself in: Defensive for 5 more
  balls") and the risk label shows the level actually played.
- Measured over 300 T20s at number 3: out inside 10 balls 43% -> 35%
  (Balanced), 54% -> 46% (Aggressive), 76% -> 59% (Very Aggressive). AI
  batting and match balance are untouched.

### Start a career in a past season, among that season's real cricketers
Career creation has a Start year (2005-06 to 2026-27). A career begun in a
past season plays among the real cricketers of that season, and every 1 June
the real squads (nations, IPL franchises, zones, Rest of India, India A,
senior state sides) move on to the next season's real players - Tendulkar,
Dravid and Kumble for India in 2008, Kohli arriving, Sachin leaving in 2013 -
up to the latest data (2026), after which the players age as before.
- `npm run import:players -- --eras 2005-2025` writes
  `src/data/real/eras/<year>.json` from only the matches before 1 June of
  that year (one lazy chunk each, 60-380 KB). The 2026 files are unchanged.
- The Cricsheet scorecards begin in 2003 and the Mushtaq Ali ones in 2016, so
  `scripts/players/legends.ts` has the real birth years of ~240 players of
  the 2000s and the state sides of the older Indians; anyone else who was
  already playing in 2003-04 is aged from "last match at 36" when that is
  earlier than "debut at 21".
- Past seasons without squad lists build each state's squads from the Indian
  players of the day with a known side (thin before 2016; generated players
  fill the rest). Defunct franchises fill today's slots of the day: Deccan
  Chargers as Sunrisers Hyderabad, Kochi / Gujarat Lions as Gujarat Titans,
  Pune Warriors / Rising Pune as Lucknow Super Giants; before 2008 the
  franchises are generated.
- Engine: `realPlayers.ts` keeps several seasons loaded
  (`addRealData`, `activateRealSeason`, `realSeasonFor`); a save records
  `realStartYear`; `advanceWeek` puts the career's season in use and
  `startNewSeason` switches season and rebuilds the real squads
  (`realSquadsPending`). With no season that early loaded, sides are
  generated rather than given future players.
- Loading: `prepareRealSeasons` (game store: boot, load, import, new career,
  every week) fetches this season's and next season's file; IPL Manager
  puts today's players back in use.
- Tests: the converter's history mode, the wizard starting in 2008, and an
  engine test (2008 squads, the switch to 2009 on 1 June, no future players).

### Birth year instead of a start year
Career creation asks for the Birth year (1980 onwards) and the age the career
starts at (8-12); the career starts in the season the player reaches that age
(born 1985, aged 10: the 1995-96 season). Before 2005, the earliest data, the
real squads are 2005's (each player at their age that year) until real
history catches up; from 2005 they follow it season by season as before.

## ✅ Phase 12 — Live PvP: 3D matches, collectible players, online play

A third game mode at `/pvp`, separate from Career Mode and IPL Manager (own
routes, store, saves and economy). Design and operations: `docs/LIVE_PVP.md`;
3D assets and licences: `docs/assets/ASSET_MANIFEST.md`.

**Inspection findings (before building)**
- No 3D engine, models or animation files existed; the game was 2D by design
  (`CLAUDE.md`). Live PvP adds three.js for this mode only - Career Mode and
  IPL Manager are unchanged and stay 2D.
- No backend existed. A Node WebSocket server was added (`server/`).
- Mixamo, Kenney, Quaternius, Fab and Sketchfab are unreachable from the build
  environment (network policy) and/or need an account; no cricket motion
  capture could be obtained. The Khronos glTF sample models (GitHub) were
  reachable.

**Engine (`src/engine/pvp`, pure TypeScript, shared by browser and server)**
- Rating bands enforced centrally (`rules.ts`): free 45-65, premium 70-99,
  66-69 excluded; tier mapping, role and bowling-style rules, upgrade caps.
- 154 fictional cards (free, premium, retired legends) generated from a fixed
  seed; original procedural portraits; no real names or statistics.
- Economy (`economy.ts`): starter XI, coin/gem/event packs with published
  per-slot odds, market, daily and weekly rewards, match rewards, training -
  every change a ledger transaction, idempotent by request id; saves audited
  and bad cards quarantined, never silently rewritten.
- `PvpMatch`: the authoritative match (2 overs, 3 wickets) on the Career Mode
  `resolveDelivery`, with delivery ids, phase checks, duplicate/stale/too-early
  rejection, deadlines and bot play, deterministic replay; Elo and a
  matchmaking queue (`ranked.ts`).

**3D (`src/game3d`, three.js)**
- Procedural skinned cricketers on a 22-bone Mixamo-named skeleton; 30
  procedural keyframe clips (batting shots, pace and spin actions, run-up,
  running, fielding, keeping, catching, throwing, celebrations, umpire
  signals); two-bone arm IK so both hands hold the bat; mirrored clip sets for
  left-handers; an `AnimationController` with cross-fades, one-shot tokens and
  stale-completion protection.
- Procedural stadium (stands, instanced crowd, floodlights, boards, live
  scoreboard, day/night), broadcast/run-up/ball-follow/aerial/boundary/wicket
  cameras, adaptive quality, WebGL detection and fallback.
- `choreography.ts` derives every animation and ball path from the
  authority's result; `MatchScene` plays them on one timeline.
- GLB pipeline (`gltfInspect.ts`) with explicit skeleton-compatibility reports,
  verified on the Khronos RiggedFigure GLB (CC BY 4.0).

**Online (`server/pvp-server.ts`)**
- Guest accounts with hashed tokens, persistent profiles (JSON store),
  server-side economy, ranked queue, private rooms, friends and invites,
  reconnection with event resume, disconnect forfeits, rate limits, JSON logs.

**UI (`src/screens/pvp`)**
- Live PvP home, 3D match, Collection (3D tilt cards, inspection, flip,
  training), Market (current/legends/featured/transactions), Packs & Store
  (odds disclosure, confirmation, opening and reveal), Squad Builder, Rankings,
  Friends, 3D Lab. Offline demo vs online server always labelled.
- Entry points on the title screen and in the career navigation.

**Tests**: `src/engine/pvp/pvp.test.ts`, `src/game3d/game3d.test.ts`,
`server/pvp-server.test.ts` (two real WebSocket clients play a ranked match);
browser QA `scripts/qa-pvp.mjs`.

## ✅ Phase 13 — Live PvP: gameplay, motion and camera upgrade

The 3D match looked like a demo: the camera sat about 27 m back (the batter
filled about 13% of the frame), bodies were capsules with rigid skinning, and
clips moved linearly between sparse keys. This phase rebuilt those parts.

**Done**
- Anatomical procedural characters with role kit and automatic two-bone skin
  weights; low-detail builds for distant fielders.
- 41 spline-smoothed clips / 43 states: ready stance, front and back-foot
  defence, straight and cover drive, pull, cut, sweep, loft, miss; run, turn,
  slide the bat in; keeper collect; dive, catch, throw; appeal, celebration,
  disappointment; umpire out/four/six/wide/no-ball/bye. Run cycles are speed
  matched, heads track the ball, contact is at the bat's sweet spot.
- Camera director with 7 states driven by per-ball cues, framing solved for the
  screen's aspect ratio (desktop and upright phones checked in the browser).
- Ball flight: swing in the air, turn off the pitch, a seam that spins, a trail
  and a ground shadow; the ball still arrives where the authority placed it.
- Running and run-outs follow the engine (`runLegs`, `runOutEnd`).
- Stadium: grass and pitch wear, crowd colour variation, contact shadows,
  pooled particles (pitch dust, confetti, fireworks, wicket debris).
- Match screen: light scorebug (score, overs, CRR, target, RRR, need, striker
  and non-striker with runs and balls, bowler figures, this over), commentary,
  replay, pause (offline demo), settings, loading screen. The scorebug never
  runs ahead of the scene. The bowl panel stays open while the last ball plays
  out, and slow devices play in real time (frame step limit 0.25 s), so a slow
  phone no longer misses its bowling deadline.
- Tests: smoothing, run legs, camera cues, swing and turn, scorecard sums,
  scene seeding. Full suite and build pass.

**Procedural fallbacks / still needs external assets**
- All characters and motion are procedural (no motion capture). Realistic GLB
  cricketers and licensed cricket mocap would need a manual download (Mixamo,
  Fab, Sketchfab are login-gated and blocked here); see the asset manifest.


## Balance: the career player's star edge
- Players reported only 1-2 good innings in 20 and quick dismissals. The
  career player now gets `STAR_EDGE` (config.ts) in the ball-by-ball engine,
  scaled by difficulty (`DIFFICULTY.*.starEdge`: Easy 1.25, Realistic 1,
  Hard 0.5): batting, a 48% lower wicket chance and 8% more boundaries;
  bowling, 75% more wicket chance and 12% fewer boundaries conceded.
- Measured (number three at par with the team / 10 points below it):
  T20 30+ in 53% / 48% of innings (was 30% / 29%), ODI 50+ in 49% / 43%
  (was 40% / 22%), first-class 50+ in 43% / 36% (was 24% / 13%). T20 bowler
  2+ wickets in 59% of spells (was 25%). AI players are unchanged.
- The fast score-only sim (headless career sim) does not apply it.
- Tests: `engine/match/starEdge.test.ts`.
