# GAME_SPEC.md — Cricket Career technical spec

Living document. Created in Phase 1; updated at the end of every phase.
Source of truth for rules is `CAREER_MODE.md`; source of truth for visuals is
`design/dashboard.png`. This file is how those two become code.

---

## 1. Design principles

1. **Nothing is automatic.** Every promotion, selection and contract is earned.
2. **The engine is pure.** `/src/engine` is plain TypeScript — no React, no DOM,
   no `localStorage`. It takes state in and returns state out, so it can be
   tested and replayed deterministically from a seed.
3. **Every number is tunable.** Balance constants live in `/src/engine/config.ts`.
4. **Storage never throws.** Every save path returns a `SaveResult`, never an
   exception (`src/save/storage.ts`).

### Folder map

| Path | Holds |
|---|---|
| `/src/types` | Data models only. No logic. |
| `/src/engine` | Pure game logic: match sim, selection, training, progression. |
| `/src/engine/match` | The ball-by-ball engine: delivery resolution, innings and match state machines, AI captain, DLS, post-match effects. |
| `/src/engine/development` | Player creation, hidden potential, traits, age curve, training, injuries and rehab, fitness tests, school, XP, the career simulation. |
| `/src/engine/calendar` | Season calendar per stage, climate by region, the weekly clock and season rollover. |
| `/src/data` | Static data: stages, tournaments, venues, trophies, name pools. |
| `/src/save` | 3-slot localStorage save system, autosave, export/import. |
| `/src/store` | Zustand stores; the only bridge between engine and UI. |
| `/src/components` | Reusable UI: Card, StatTile, ProgressBar, Tabs, Badge, Avatar, Stepper, SkillRadar, Crest, Modal, Tooltip. |
| `/src/layout` | The app shell: sidebar, icon rail, top bar, mobile tab bar. |
| `/src/lib` | UI-side helpers: formatting and `GameState` selectors. |
| `/src/screens` | Routed pages. |
| `/public/assets` | Images. |

---

## 2. The 20 career stages

Defined in `src/data/stages.ts` as `CareerStage[]`. Requirements are the *case*
a player builds; meeting them makes promotion **possible**, never certain.

| # | Stage | Id | Age | Formats | Competitions |
|---|---|---|---|---|---|
| 1 | Cricket Beginner | `BEGINNER` | 8–12 | One-day | Inter-School, Chennai Club League |
| 2 | District Age-Group | `DISTRICT_AGE_GROUP` | 12–14 | One-day | District League |
| 3 | State U-16 | `STATE_U16` | 14–16 | One-day, Multi-day | Vijay Merchant Trophy |
| 4 | U-19 Pathway | `U19_PATHWAY` | 16–19 | T20, One-day, Multi-day | Vinoo Mankad, Cooch Behar |
| 5 | India U-19 | `INDIA_U19` | 16–19 | One-day, Multi-day | U-19 bilaterals, U-19 World Cup |
| 6 | U-23 / Emerging | `U23_EMERGING` | 18–23 | T20, One-day, Multi-day | C.K. Nayudu, U-23 State A |
| 7 | Senior State Team | `SENIOR_STATE` | 18+ | All | Ranji, Vijay Hazare, SMAT |
| 8 | Ranji Trophy | `RANJI_TROPHY` | 18+ | Multi-day (FC) | Ranji Trophy |
| 9 | Vijay Hazare Trophy | `VIJAY_HAZARE` | 18+ | One-day (List-A) | Vijay Hazare Trophy |
| 10 | Syed Mushtaq Ali Trophy | `SYED_MUSHTAQ_ALI` | 18+ | T20 | SMAT |
| 11 | IPL Scouting | `IPL_SCOUTING` | 17+ | T20 | SMAT, franchise trials |
| 12 | IPL Career | `IPL_CAREER` | 17+ | T20 | IPL |
| 13 | High-Level Domestic | `HIGH_LEVEL_DOMESTIC` | 19+ | Multi-day | Duleep Trophy, Irani Cup |
| 14 | India A | `INDIA_A` | 19+ | One-day, Multi-day | India A tours |
| 15 | India Senior Camp | `INDIA_SENIOR_CAMP` | 19+ | T20I, ODI, Test | National camp |
| 16 | International Debut | `INTERNATIONAL_DEBUT` | 19+ | T20I / ODI / Test | Bilateral series |
| 17 | Establish India Career | `ESTABLISH_INDIA` | 19+ | All international | Bilaterals, WTC |
| 18 | ICC Tournaments | `ICC_TOURNAMENTS` | 19+ | All international | T20 WC, ODI WC, CT, WTC |
| 19 | International Star | `INTERNATIONAL_STAR` | 21+ | All international | All |
| 20 | Legacy / End Career | `LEGACY` | 30+ | All | All |

Each stage carries:

- `steps[]` — the sub-path inside the stage, straight from `CAREER_MODE.md`.
- `requirements[]` — measurable targets (`MATCHES_PLAYED`, `RUNS`, `WICKETS`,
  `BATTING_AVERAGE`, `BOWLING_AVERAGE`, `STRIKE_RATE`, `ECONOMY`,
  `AVERAGE_RATING`, `FORM`, `FITNESS`, `REPUTATION`, `OVERALL`) measured over a
  `SEASON`, the `STAGE`, the whole `CAREER`, or `LAST_5_MATCHES`. Optional
  requirements strengthen the case without being mandatory.
- `nextStageIds[]`, `fastTrackStageIds[]`, `fallbackStageId`.
- `softAgeLimit` — past this the career starts to stall (see §6).

### Progression rule

At each season boundary (and after a stage-defining tournament):

```
if every mandatory requirement met:
    score  = basePromotionChance (0.55)
    score *= form / fitness / morale modifiers
    score *= team-need and squad-competition modifiers
    score *= age modifier (penalty past softAgeLimit)
    if performance clears requirements by exceptionalMultiplier (x2):
        fastTrackChance (0.12) to skip to a fastTrackStageId
    roll → PROMOTE | STAY
else:
    STAY, or BENCH / DROPPED per §5
```

Outcomes are the six from `CAREER_MODE.md`: `PROMOTE`, `STAY`, `BENCH`,
`DROPPED`, `INJURED`, `FAST_TRACK` (plus `RETIRE` at stage 20).
Being dropped moves the player to `fallbackStageId` and increments
`CareerState.comebacks`.

---

## 3. Player attributes

All ratings are integers **1–99** (`clampRating`). Bands: 1–29 raw, 30–49 club,
50–64 state, 65–79 first-class, 80–89 international, 90–99 all-time great.

Every player carries a current `Attributes` and a `potential` `Attributes` —
the ceiling training can reach. The radar chart on the dashboard plots the six
batting axes marked ★ below, current vs. potential.

| Group | Attributes |
|---|---|
| `batting` | ★technique, ★timing, ★power, ★shotRange, ★vsPace, ★vsSpin, vsSwing, footwork, running, concentration |
| `bowling` | pace, accuracy, swing, seam, spin, flight, bounce, variation, newBall, deathBowling, control |
| `fielding` | catching, groundFielding, throwing, agility, wicketKeeping |
| `physical` | stamina, strength, speed, durability |
| `mental` | temperament, matchAwareness, aggression, discipline, leadership, workRate |

**Overall (OVR)** — `computeOverall(attributes, role)` collapses the five group
means into one 1–99 number using role weights from `OVERALL_WEIGHTS`. A pace
bowler is not judged on their cover drive:

| Role | batting | bowling | fielding | physical | mental |
|---|---|---|---|---|---|
| Batter / Opener | 0.62 | 0.04 | 0.14 | 0.10 | 0.10 |
| Keeper-batter | 0.46 | 0.00 | 0.34 | 0.10 | 0.10 |
| Batting all-rounder | 0.44 | 0.28 | 0.13 | 0.08 | 0.07 |
| Bowling all-rounder | 0.28 | 0.44 | 0.13 | 0.08 | 0.07 |
| Pace bowler | 0.10 | 0.58 | 0.10 | 0.14 | 0.08 |
| Spin bowler | 0.10 | 0.60 | 0.10 | 0.10 | 0.10 |

**Growth (Phase 5).** Every player has a hidden potential (60-95) for their
overall; per-attribute ceilings (`Player.potential`) are shaped by role,
bowling type, batting approach and traits, then shifted as a whole so their
role-weighted overall lands on the hidden potential. Training and growing up
move each attribute towards `ceiling × maturity(age) − decline(age)`, with
diminishing returns near it. See §8d.

**XP and level.** Matches (appearance, runs, wickets, catches, prestige, plus
bonuses for fifties, hundreds and five-fors) and training sessions earn XP.
Level *n* costs `levelBase × n^levelCurve` (150 × n^0.83: level 12 needs
~1,180), one curve for both (`engine/development/xp.ts`).

## 4. Player condition

Attributes are what the player *can* do; `Condition` is how well they can do it
right now. It is the single most important input to selection.

| Field | Range | Moves with |
|---|---|---|
| `form` / `formBand` | 0–100 / TERRIBLE…EXCELLENT | Mean of the last 5 match ratings |
| `fitness` | 0–100 | Falls with fatigue and injury, recovers with rest |
| `fatigue` | 0–100 | +6 per match day, −9 per rest day, + training intensity |
| `morale` / `moraleBand` | 0–100 / BROKEN…FLYING | Selection, results, media, awards |
| `confidence` | 0–100 | Damps or amplifies form swings |
| `injury` | `Injury \| null` | See below |
| `recentRatings` | number[] (0–10) | One per appearance |
| `recentWorkload` | overs in last 14 days | Drives workload management |
| `reputation` | 1–99 | What selectors and scouts actually know about you |

**Injuries.** `Injury` carries a `type` (hamstring, side strain, lumbar
stress fracture, fractured finger, ankle sprain, concussion, shoulder, knee,
groin, niggle - `src/data/injuries.ts`, each with a realistic recovery range),
`severity` derived from the weeks out, `bodyPart`, `expectedReturn`,
`attributePenalty` and `recurrence`. Per-match risk = `baseInjuryChance`
(1.2%) + `fatigueInjuryChance` (up to 9%) scaled by fatigue, raised by overs
bowled and traits, reduced by `durability`. Training has its own weekly roll
(§8d). Injured players go into rehab (§8d).

---

## 5. Match factors

Every delivery is resolved from the batter's and bowler's attributes, both
players' condition, and the following match factors.

### Pitch (`Pitch`)
Type is one of GREEN, HARD, FLAT, DRY, DUSTY, CRACKED, DAMP, SPORTING. Each
match generates numeric axes around the venue's `defaultPitchType`:
`seamMovement`, `swing`, `turn`, `bounce`, `pace`, `battingEase`,
`deterioration`. Deterioration rises each day of a multi-day match, pushing
`turn` up and `battingEase` down.

### Weather (`Weather`)
SUNNY, HOT, OVERCAST, HUMID, CLOUDY, LIGHT_RAIN, HEAVY_RAIN, WINDY with
`temperature`, `humidity`, `cloudCover`, `wind`, `rainRisk`, `rainDelay`.
Overcast + humid assists swing; heat accelerates fatigue; rain interrupts play
and can force a revised target (`Innings.dlsTarget`).

### Ball age (`BallState`)
`ageInBalls`, `shine`, `hardness`, `roughness`, `reverseSwingAvailable`,
`ballNumber`. Shine and hardness decay with age; conventional swing fades,
then reverse swing becomes available on abrasive surfaces. A second new ball in
a Test resets the state and spikes danger.

### Format (`MatchFormat`)
T20 (20 ov), ODI (50), ONE_DAY (50), MULTI_DAY (unlimited), TEST (unlimited).
Format sets over limits, field restrictions, default intent and how heavily a
dismissal is punished.

### Phase (`MatchPhase`)
POWERPLAY, MIDDLE, DEATH for limited overs; NEW_BALL, OLD_BALL,
SECOND_NEW_BALL for multi-day. Phase changes field settings, bowler choice and
scoring rates.

### Pressure
`MatchConditions.pressure` (0–100) from the match situation: required rate,
wickets in hand, knockout stage, crowd size, tournament prestige and the
player's own reputation. Pressure is resolved against `temperament` and
`confidence` — a nervy player's `contactQuality` drops under it.

### Resolution order per ball
```
bowler picks line / length / variation   (attributes + phase + plan)
batter picks intent / shot               (user input or AI)
contactQuality  = f(batting attrs, condition, pitch, ball, pressure, match-up)
outcome         = runs | boundary | dot | wicket | extra
commentary + ball path + 2D fielder positions are derived from the outcome
```
Every delivery is stored as a `Ball` in `Innings.deliveries`, which is what
drives commentary, the scorecard and the 2D ground view.

---

## 6. Selection rules and statuses

### Statuses (`SelectionStatus`)
`NOT_IN_SETUP`, `TRIALIST`, `CAMP_INVITEE`, `SQUAD`, `RESERVE`, `STANDBY`,
`BENCH`, `PLAYING_XI`, `ROTATED`, `RESTED`, `DROPPED`, `INJURED_OUT`,
`VICE_CAPTAIN`, `CAPTAIN`.

### Selection score
For each squad candidate (the user and every `RivalPlayer`), selectors compute:

```
score = abilityWeight    (0.40) × overall
      + formWeight       (0.35) × form
      + reputationWeight (0.15) × reputation
      + teamNeedWeight   (0.10) × role-matches-team-need
```

Then:

- **Hard gates.** `fitness < minFitness` (65) or an active injury → `INJURED_OUT`.
  Over the stage's `ageLimit` → not eligible for that age-group competition.
- **The XI.** Top 11 eligible by score, subject to a balanced side (openers, a
  keeper, enough bowling). The rest of the top 15 are `SQUAD` / `BENCH`.
- **Bench.** `poorMatchesBeforeBench` (3) consecutive ratings below par → `BENCH`.
- **Dropped.** `benchedMatchesBeforeDrop` (4) consecutive matches benched, or
  form collapse → `DROPPED`, and the career falls back a stage.
- **Rotation and rest.** High `recentWorkload` or high fatigue in a congested
  block → `ROTATED` / `RESTED` (no form penalty; it still costs you matches).
- **Comeback.** A dropped player re-enters through `TRIALIST` → `CAMP_INVITEE` →
  `SQUAD`, and `CareerState.comebacks` increments.
- **Leadership.** High `leadership` + reputation + seniority → `VICE_CAPTAIN`,
  then `CAPTAIN` (stage 19).

Difficulty (`CASUAL` / `REALISTIC` / `BRUTAL`) scales rival `selectorFavour` and
squad strength.

---

## 7. Save system

Three slots in `localStorage`, keys `cricket-career:slot:{1,2,3}` with a
matching `cricket-career:meta:{n}` header so the slot picker never has to
deserialise a whole career. `cricket-career:active-slot` remembers where to
resume.

- **Autosave** — debounced (`autosaveDebounceMs` 800 ms), flushed on
  `beforeunload` and on tab hide. Every gameplay mutation goes through
  `useGameStore.update()`, which queues one.
- **Export / import** — `exportSave` writes an envelope
  `{ app: 'cricket-career', version, exportedAt, meta, state }`. `importSave`
  rejects a file that is not JSON (`CORRUPT`), not from this game (`WRONG_APP`),
  not shaped like a career (`CORRUPT`), or from a newer build
  (`UNSUPPORTED_VERSION`).
- **Migrations** — `SAVE_VERSION` in `src/types/save.ts`; add a step to
  `MIGRATIONS` in `src/save/migrate.ts` whenever `GameState` changes. Old
  careers must keep loading. v2 (Phase 3): shot geometry, selector trust.
  v3 (Phase 4): captaincy, relationships, media reputation, team morale, the
  dev captain toggle. v4: the player's 1-5 batting and bowling aggression
  (`career.aggression`, default 3/3). v5 (Phase 5): `player.development`
  (hidden potential from the old `potentialOverall`, traits drawn from the
  seed, comfort around the saved aggression, rehab for a current injury),
  the session-based `trainingPlan` (old slots mapped to the matching drills),
  `calendar` (the rest of the current season generated after the last
  existing fixture) and older matches archived to scorecards.
- **Size** - a multi-day match is over 1 MB of deliveries and a browser gives
  an origin ~5 MB, so only the latest `SAVE.ballByBallMatches` (2) matches
  keep every ball (`engine/match/archive.ts`); older ones keep full
  scorecards. The Matches screen says so where the charts would be.
- **Errors** — `STORAGE_UNAVAILABLE`, `QUOTA_EXCEEDED`, `NOT_FOUND`, `CORRUPT`,
  `WRONG_APP`, `UNSUPPORTED_VERSION`, `UNKNOWN`. Nothing throws.

---

## 8. Screen list

Design system for all of them: page `#F4F6FB`, white cards, 12–16px radius,
soft shadow, 20px padding; Poppins UI, Caveat for handwritten quotes; shared
`Card`, `CardHeader`, `StatTile`, `ProgressBar`, `Tabs`, `Badge`, `Avatar`,
`Stepper`. Desktop sidebar → tablet icon rail → mobile bottom tab bar.

### Primary navigation (sidebar, from `design/dashboard.png`)

| Screen | Route | Contents |
|---|---|---|
| **Home** | `/` | Hero banner, OVR/Form/Fitness/Morale tiles, Next Match, 20-stage stepper, Upcoming Schedule, Training Focus, Player Stats, Inbox, Recent Match, Skill radar, Trophies, Community |
| **Career Path** | `/career` | Full 20-stage path, per-stage steps, requirement progress, career event timeline |
| **Calendar** | `/calendar` | Month and list views colour-coded by event type, season windows, monthly climate, filters — **built in Phase 5** |
| **Training** | `/training` | Weekly plan within the energy budget, expected gains, fatigue and injury-risk preview, lifestyle, school, aggression comfort, fitness tests, coach hints, overall by age — **built in Phase 5** |
| **Matches** | `/matches` | Fixture list, results, links to live match and scorecards |
| **Selection / News** | `/selection` | Current status, selector feedback, squad list, rivals for your spot, inbox/news feed |
| **IPL Auction** | `/auction` | Scouting reputation, franchise interest, trials, auction lots and outcomes |
| **Stats** | `/stats` | Career and season stats by format and competition, charts (recharts) |
| **Awards** | `/awards` | Trophy cabinet, milestones, series and tournament awards |
| **Community** | `/community` | Fan and media reaction feed |
| **Settings** | `/settings` | Slots, autosave, export/import, difficulty, commentary detail, accessibility |

### Supporting screens

| Screen | Route | Contents |
|---|---|---|
| **Start** | `/start` | Title screen on `banner-bg.jpg`: Continue, New Career, Load slot, Import save, the demo career — **built in Phase 5** |
| **Slot Picker / New Career** | `/slots`, `/new` | 3 save slots, create / load / delete / import; the four-step creation wizard (Phase 5) |
| **Rehab** | `/training/rehab` | Injury, rehab plan, return-to-play test, early return, injury record — **built in Phase 5** |
| **Live Match** | `/match/:fixtureId` | Selection and role, toss, 2D ground with the player's controls (and captain's, when appointed), innings break, post-match with career effects and press — **built in Phase 4** |
| **Scorecard** | `/matches/:matchId` | Full innings scorecards, fall of wickets, bowling figures, charts, commentary — **built in Phase 4** |
| **Squad / Team** | `/team/:id` | Squad list, XI, rivals, team needs |
| **Player Profile** | `/player/:id` | Attributes, radar, condition, full record |
| **Tournament** | `/tournament/:id` | Standings, fixtures, knockout bracket |
| **Season Review** | `/season/:year` | Season summary, awards, progression verdict |
| **Retirement** | `/retirement` | Final career statistics and legacy summary |

---

## 8a. Design system (built in Phase 2)

Tokens live in `src/index.css` under `@theme`; nothing hard-codes a colour.

| Token | Value | Used for |
|---|---|---|
| `--color-page` | `#F4F6FB` | Page background |
| `--color-surface` | `#FFFFFF` | Cards |
| `--color-brand-blue` / `-soft` | `#1E5EF0` / `#E8EFFE` | Primary actions, active nav |
| `--color-brand-green` | `#22A45D` | OVR, good form, wins |
| `--color-brand-orange` | `#F59E0B` | Assessments, "vs" |
| `--color-brand-red` | `#E5484D` | Selection meetings, fatigue, alerts |
| `--color-brand-gold` | `#F5C518` | Crown, trophies, banner CTA |
| `--color-brand-navy` | `#0F1B33` | Ink, bottom banner |
| `--radius-card` / `--radius-tile` | 16px / 12px | Cards / tiles |
| `--font-sans` / `--font-hand` | Poppins / Caveat | UI / handwritten quotes |

Components in `/src/components` (barrel `@/components`): `Card`, `CardHeader`,
`CardAction`, `StatTile`, `HeroStatTile`, `ProgressBar`, `Tabs`, `Badge`,
`Avatar`, `Stepper`, `SkillRadar`, `RadarLegend`, `Crest`, `Modal`, `Tooltip`.
Every screen must build from these rather than restyling a div.

The shell in `/src/layout` (`AppShell`, `Sidebar`, `TopBar`, `MobileTabBar`,
`Logo`, `navItems`) wraps every route:

| Width | Navigation | Dashboard grid |
|---|---|---|
| ≥1536px | 200px sidebar | Hero with Next Match lapped over it, 4 cards per row |
| ≥1024px | 200px sidebar | Next Match under the hero, 2 cards per row |
| ≥768px | 72px icon rail | Next Match under the hero, 2 cards per row |
| <768px | Bottom tab bar + "More" sheet | Everything stacked |

The entry screens (`/slots`, `/new`) sit outside the shell entirely - there is
nothing to navigate to until a career is loaded.

UI-side derivations live in `/src/lib`: `format.ts` (timezone-safe dates,
in-game relative times, overs, style labels) and `selectors.ts` (every
dashboard figure read out of `GameState`). Screens never reach into the save
shape directly.

---

## 8b. Match engine (built in Phase 3)

Pure TypeScript in `/src/engine/match`, driven entirely by a seeded RNG so a
match replays ball for ball. Public surface is the barrel `@/engine/match`.

| Module | Holds |
|---|---|
| `rng.ts` | Deterministic mulberry32 generator and seed derivation. |
| `skill.ts` | Attributes + condition -> batter and bowler ability; pressure. |
| `conditions.ts` | Pitch and weather generation, ball ageing, deterioration, swing/seam/turn/bounce on offer, dew, phase. |
| `field.ts` | Named positions, seven field presets, nearest-fielder and catch maths. |
| `ai.ts` | AI captain (bowling changes, fields) and AI batter aggression. |
| `delivery.ts` | Resolves one ball into runs, extras or a dismissal. |
| `commentary.ts` | A commentary line for every delivery. |
| `innings.ts` | Innings state machine: overs, strike, extras, partnerships, spells, scorecards. |
| `simulate.ts` | Match state machine: toss, formats, days, declarations, follow-on, DLS, ties, super over, player of the match. |
| `dls.ts` | Resource curve and revised targets. |
| `aftermath.ts` | Post-match form, confidence, morale, fatigue, fitness, injury, reputation, selector trust, XP. |
| `squad.ts` | Generates balanced AI XIs at a given strength. |
| `balance.ts` | The harness the config was tuned against. |

### Shot geometry

Every delivery the batter makes contact with records `shotAngle` (0-360
degrees) and `shotDistance` (metres), plus the normalised `landingPoint` the
2D ground view draws. Angles are always written for a right-handed batter and
mirrored for a left-hander: **0 straight down the ground, 90 square on the off
side, 180 back past the keeper, 270 square leg.**

### Situational behaviour

Everything in this table changes the ball outcome; none of it is cosmetic.

| Area | What the engine does |
|---|---|
| Acceleration | Reads wickets in hand against overs left. Two down: go from 70% of the innings; three down 75%; five down 82%; seven down protect the tail. Scales to any format length. |
| Roles | Openers and number threes anchor, five to seven finish, tailenders block, a recognised batter with the tail in farms the strike. |
| Milestones | Inside ten runs of 50/100/150/200 a batter takes fewer risks and carries more danger. |
| Left-right pair | Costs the bowler accuracy, because the line resets every single. |
| Nightwatchman | Can go in late on a day of a multi-day match, once per innings. |
| Field restrictions | T20: 2 outside the circle for 6 overs, then 5. ODI: 2 / 4 / 5 across the three blocks. Enforced by pulling outfielders into the ring. |
| Bowling changes | Spells, rest, per-format over limits, death bowlers held back, part-timers when the game is safe, seamers with the new ball. |
| Match-ups | Spin turning away from the bat is the dangerous one; left-arm seam angles across a right-hander; each batter has a pace/spin preference. |
| Toss | Batting ease vs grass and cloud, dew under lights, batting first worth more in the longer game. The user calls it when captain. |
| Dew | Builds through a night innings: spinners lose grip, every bowler loses execution. |
| Ground size | Straight and square boundaries feed the six chance. Home side gets a small skill bonus. |
| DRS | Two reviews a side an innings; overturned, upheld or umpire's call. |
| Free hit | Follows a no-ball in limited overs; only a run-out can end it. |
| Fielding incidents | Dropped catches on catching skill, misfields worth an extra run, direct-hit run-outs on the arm. |
| In-match injury | Retired hurt, including concussion. |
| Pressure | Dot balls build; wickets cluster; a rising required rate forces the pace. |

### Balance targets

`config.ts` was tuned against 1000 matches per format. Current output and the
bands the tests enforce are recorded in `PROGRESS.md`.

---

## 8c. Live match and the career model (built in Phase 4)

**Who controls what.** Career mode is the default: the player controls only
their own cricketer. `BallOverrides.battingFor` / `bowlingFor` confine their
intent, shot direction, leave, rotate, line, length, variation and angle to
their own batter on strike and their own overs. Team controls - the toss,
XI and order, instructions to batters, the bowler each over, the field,
reviews, declarations and the follow-on - unlock only through
`isCaptainOf()` (a real appointment, or the dev-only toggle in a development
build), and each can be delegated to the AI vice-captain
(`CaptaincyState.delegate`).

**Questions.** `DecisionHooks` on a catch, a run-out and a review default to
the engine's own roll. When the question is the player's, the live controller
throws `DecisionNeeded`; `resumeBall` replays the delivery from the saved
random state with their answer. Catch and run-out success =
`timedChance(fielder's chance, timing)`. Bulk sims never ask.

**Parity.** `createLiveMatch` follows `simulateMatch` call for call; with no
decisions from the player the two produce identical matches (tested).

**Selection** (`engine/career/selection.ts`): §6 score + `(selectorTrust -
50) × 0.12` - fatigue, per-fixture whim, hard gates, balanced XI. Status per
match: `PLAYING_XI`, `TWELFTH_MAN`, `BENCH`, `NOT_SELECTED`. The coach moves an
in-form batter up to two places (down on a lean run); `bowlerTrust` weights
how often the AI captain picks the player. A captain's XI is reviewed change
by change; acceptance rises with captaincy rating, reputation and merit.

**After the match** (`engine/career/afterMatch.ts`, `press.ts`): team morale
for both sides; relationships; the selectors' note; for a captain, the record,
rating (`CAPTAINCY` constants: result 55%, tactics 25%, morale 20%), tactics
score from their actual calls, stress and its cost to form, sacking after five
straight defeats or a rating at 24 or below, and a recommendation after a
strong record; appointment when the case is made; press conference after big
matches (knockouts, a hundred or five-for, a thrashing as captain).

**Aggression 1-5.** Batting: 1 Very Defensive, 2 Defensive, 3 Balanced,
4 Aggressive, 5 Very Aggressive; bowling: 1 contain to 5 all-out attack.
The player sets theirs (`career.aggression`); it holds until they change it
and is sent with every ball (`BallOverrides.intentLevel` /
`bowlingAggression`, confined by `battingFor` / `bowlingFor`). One-ball
intents override it for one ball. A captain can set a level per batter and
per bowler (`batterLevels`, `bowlerLevels`); anyone without one is the AI.
- Multipliers are relative to the format's `defaultIntent`, which is 3 for
  every format. The AI's read starts at `defaultIntent +
  MATCH.batting.aiIntentStart` so its situational drops leave it averaging
  about 3: `MATCH.intent` (wicket, boundary, dot, running), plus
  `MATCH.aggression` - contact (false shots), leaving outside off, the share
  of aerial shots at 5, and the risk scale.
- Risk scale for attacking (`aggressionRiskScale`, clamped 0.4-2.5): 1 +
  0.6 × unsettled + 0.5 × pitch difficulty + 0.2 × (bowler - batter) +
  0.3 × poor temperament - 0.12 × power. It multiplies only the extra
  wicket risk above the normal game. Power also adds boundaries when
  attacking (`powerReward`).
- Bowling (`MATCH.bowlingAggression`): wicket, boundary, dot and wide
  multipliers, and length / line / variation weights in `choosePlan`; all 1
  at level 3, so the AI's normal plan is unchanged.
- Risk label: `estimateRisk(state, batterId, level)` builds the next ball's
  context with a neutral plan and no random numbers and returns the wicket
  chance and ratio to the format's base rate; Low below 0.6, Medium below
  1.2, High below 2.1, else Very High (`MATCH.aggression.riskLabels`).
- Stats: `Ball.intent` records the batting level and `Ball.bowlingAggression`
  the bowling level when it is not 3; `src/lib/aggressionStats.ts` builds the
  post-match per-level tables.

**Engine additions**: leave (`MATCH.leave`), rotate (`MATCH.rotate`),
captain's instructions and a bowler to target, fielding-side lbw reviews
(`MATCH.umpiring.appeal*`), round the wicket (`MATCH.aroundTheWicket`), quotas
enforced for a forced bowler.

**Geometry and rendering.** Metres throughout (`src/lib/ground.ts`); angle 0
up the screen, 90 screen-right for a right-hander; the circle is 27.43 m round
both sets of stumps. Field rules in `src/lib/fieldRules.ts`; an illegal field
never reaches the engine. Ground, fielders and ball are separate memoised SVG
layers; motion is SVG `animateMotion`.

---

## 8d. Career, development, training and calendar (built in Phase 5)

### New career
`/start` is the title screen; a browser that has never played lands there (the
demo career is an option, not seeded). The wizard (`/new`) asks for name, age
8-12 and birthday (the date of birth is derived so the age is exact on
1 June 2026), hometown (38 Tamil Nadu districts first, then towns in every
other state; the state follows), role (batter / bowler / all-rounder /
wicketkeeper), batting hand, batting style (anchor / stroke-maker /
finisher), bowling type (right/left-arm fast, right/left-arm medium, off-spin,
leg-spin, left-arm orthodox, left-arm wrist spin, none), jersey number,
preferred aggression (1-5) and 2-3 personality traits, then previews day one
with the same seed the career will use. Roles map onto the engine's roles
(an anchor batter opens, a spin bowler is a `SPIN_BOWLER`, ...).

`engine/development/creation.ts`: hidden potential is the mean of three
uniforms stretched to 60-95 (most players low 70s). Ceilings = potential +
role/style/approach/trait offsets + noise, calibrated to the potential.
Starting attributes = `reachable(ceiling, age) × U(0.66, 0.84)`.

### Traits (`src/data/traits.ts`)
| Trait | Effect |
|---|---|
| Hard worker | Training ×1.15; work-rate and discipline ceilings up |
| Big-match temperament | +12 temperament in knockouts / prestige ≥ 60 |
| Nervous starter | −5 temperament ceiling, −5 temperament in every match |
| Injury-prone | Injury chance ×1.6, slower recovery, lower durability ceiling |
| Natural leader | Leadership ceiling +14; captaincy relief |
| Fitness freak | Injury ×0.85, faster recovery, +1 energy, fitness ceilings up, decline a year later |
| Late bloomer / Early bloomer | Maturity curve 1.8 years behind / 1.2 ahead; coaches under/over-rate while young |
| Quick learner | Training ×1.12 |
| Easily distracted | Training ×0.88; discipline and concentration ceilings down |

Exclusive pairs (hard worker / distracted, big match / nervous, prone /
freak, late / early) cannot be picked together.

### Age curve (`engine/development/curves.ts`, `DEVELOPMENT` in config)
- **Maturity** — share of a ceiling reachable at an age: 0.36 at 8, 0.53 at
  12, 0.73 at 16, 0.9 at 20, 1.0 from 24.
- **Learning rate** — multiplier on training: 1.2 at 8, 1.35 at 13, 1.1 at
  20, 0.55 at 26, 0.32 at 30, 0.2 at 33.
- **Decline** — from 31.5 the ceiling falls and the current level erodes
  weekly: batting 1.3 / bowling 1.6 / fielding 1.9 / physical 3.0 / mental 0
  points a year, rising to 3 / 3.5 / 4 / 5.5 / 0.5 from 35.5. Mental keeps
  growing with experience until 34.

### Training (`engine/development/training.ts`, `TRAINING` in config)
A plan is up to 7 sessions (`TrainingSession`: drill, LIGHT/NORMAL/HARD,
practised aggression). 18 drills in `src/data/drills.ts`: nets vs pace, vs
spin, power hitting, defence; line & length, pace & seam, variations, death
bowling, spin; fielding & catching, wicketkeeping; strength, speed &
agility, endurance; temperament, focus; match simulation; rest. Drills a
player cannot use (spin for a seamer, keeping for a non-keeper) are skipped.

- **Energy** — 9 a week at 8, 11 at 12, 12 from 16 (11 at 40). Light 1,
  Normal 2, Hard 3, rest 0. Sessions run in order until the energy is spent.
  −2 when fatigue ≥ 65; +1 for late nights (sleep); −1 for the full recovery
  routine; up to −4 for school work (study focus) under 16; ×0.5 in exam weeks.
- **Gain per session per target** = 0.52 × target weight × intensity (0.55 /
  1 / 1.45) × learning rate(age) × traits × coach (0.85 + 0.3 × quality) ×
  work rate (0.8 + 0.35 × workRate) × fatigue (falls to 0.45 above 55) ×
  confidence (0.95-1.05) × consistency (+1% a week unchanged, max +10%) ×
  headroom (1 − e^(−room/9), room = reachable − current).
- **Growing up** — every attribute creeps 5% of a session's rate towards the
  reachable level each week.
- Gains accumulate fractionally in `development.progress`; whole points pay out.
- **Fatigue** — each session adds its drill's fatigue × intensity (0.5 / 1 /
  1.75). Weekly recovery = 14 + 25% of the week's peak + 8 per rest session
  + lifestyle + traits. A sensible plan settles low; a hard one settles ~70.
- **Comfort** — training at a level adds 7 × intensity × (1 − comfort) there
  and 30% of that either side; unused levels fade slowly. In a match, the
  player's contact drops by up to 0.06 (bowling skill by 0.05) in proportion
  to how far below 70 their comfort is at the level they play
  (`comfortShortfall`); matches also build comfort at the level used.
- **Lifestyle** — sleep (late nights / normal / full), diet (anything goes /
  balanced / strict), recovery (none / stretching / ice + physio): small
  energy, recovery, fitness, morale and injury multipliers.
- **School (under 16)** — study focus 0-100: below 35 grades slide; exam
  weeks at low focus cost more; grades under 45 upset the family, and a
  family below 35 costs morale. Exam results arrive in the inbox.
- **Coach** — a weekly note in the inbox and on the Training screen;
  monthly the coaches' potential estimate moves towards the truth (noisy when
  young, biased by bloomer traits and recent form) and their hints are
  rewritten. The radar's "Potential" is this estimate, never the truth.

### Injuries and rehab (`engine/development/injuries.ts`, `INJURY`)
Weekly training chance = (0.35% + 6% × fatigue² + 0.16% × load) ×
(1 − 0.5 × durability) × traits × lifestyle × 2.2 if rushed back in the last
10 weeks. Type is weighted by role (side strains and stress fractures for
fast bowlers, more so when young and bowling a lot; fingers for keepers;
concussion only in matches). Rehab plans: cautious (×1.25 time, ½ re-injury,
94% test pass), standard, aggressive (×0.75, counts as rushed, 62%). After
the weeks, a return-to-play test; a fail adds 1-2 weeks. From halfway the
player may return early (rushed). On return match fitness is 88 − 2.2 per
week out (min 40); it feeds match-day fitness (`simFromUser`) and is rebuilt
by match simulation and matches. Six weeks out costs 10 selector trust;
twelve costs the squad place (`RESERVE`).

### Fitness tests (`fitnessTest.ts`)
Yo-yo = 11 + 9 × stamina + 3 × (fitness − 75) − 2.2 × fatigue (±0.7);
sprint (20 m) = 3.78 − 0.95 × speed + 0.003 × fatigue. Pass marks: beginner
12 / 3.85 s, district 13.5 / 3.65, U-16 15 / 3.5, U-19 16 / 3.4, senior
16.5 / 3.3, India 17.1 / 3.2. Pass +2 selector trust, fail −8.

### Form
Form and confidence chase match ratings (aftermath); three ratings ≥ 7 is a
hot streak (+4 confidence), three ≤ 4.5 a slump (−4). In weeks without a
match both drift back towards normal.

### Calendar (`engine/calendar`)
- **Season** — 1 June to 31 May. `buildSeasonCalendar` builds windows and
  fixtures for the current stage only, from `src/data/schedule.ts`: school
  terms, holidays and exams (quarterly Sep, half-yearly Dec, annual Mar; Class
  10 boards at 15) while under 16; school league on Saturdays and club league
  on Sundays for beginners; district league Aug-Feb; Vijay Merchant Nov-Jan;
  Vinoo Mankad Oct; Cooch Behar Nov-Jan; C.K. Nayudu Oct-Feb; Ranji Oct-Nov
  and late Jan; SMAT Nov-Dec; Vijay Hazare Dec-Jan; IPL late Mar-May;
  Duleep Aug-Sep; Irani Oct; India A tours Jun-Jul; bilaterals Sep-Oct and
  Jan-Mar; ICC events in their years (T20 WC even years, ODI WC 2027/2031,
  Champions Trophy 2028-29, WTC final odd Junes, U-19 WC even Januaries).
  Plus each stage's trials, camps, fitness tests and selection meetings,
  travel days before away state-level matches, recovery days after long
  ones, and the birthday. Matches avoid exams and never overlap.
- **Sides** (`sides.ts`) — fictional schools, clubs and franchises; district,
  state, zone and national sides by name; strengths by level tuned to the
  age curve (school 25, club 30, district 37, U-16 46, U-19 53, U-23 59,
  senior 65, zone 70, franchise 71, India 77). A team already in the save
  (by id or name) is reused.
- **Clock** (`advance.ts`) — `advanceWeek` ticks day by day: events run on
  their day (fitness tests, trial verdicts from the player's level, camps
  raise coach quality, birthdays age the player, rest and travel move
  fatigue); it stops on the morning of a match and waits (`pendingFixtureId`)
  until it is played or simmed. The days advanced then run one
  `developmentWeek` (training scaled to the share of the week, rehab, school,
  form drift, monthly coach review, XP). Crossing 31 May files the season and
  generates the next.
- **Climate** (`climate.ts`) — rain, heat and dew by region and month (Tamil
  Nadu's north-east monsoon Oct-Dec; Kerala and the west coast Jun-Sep; hot
  northern summers and dewy winters). `createWeather(rng, month, region)`
  reshapes the weather draw and temperature for the venue's region with the
  same random draws; without a region it is unchanged, so the balance suite
  and live/sim parity hold.

### Dashboard
Upcoming Schedule, Next Match, Inbox, the four hero tiles, Lv/XP and the
Skill radar all read live state. Training Focus shows this week's plan by
kind of work with its share of the energy (rest shows fatigue). The Continue
bar (every screen) shows the date, the month's climate, exam and injury
status, and becomes Play / Sim on a match day.

---

## 9. Phase plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, spec, data models, save system, placeholder Home | ✅ Done |
| 2 | Design-system components + full Home dashboard | ✅ Done |
| 3 | Match engine (ball-by-ball, commentary, scorecards) | ✅ Done |
| 4 | 2D ground view and live match screen | ✅ Done |
| 5 | New career, development, training, injuries and calendar | ✅ Done |
| 6 | Tournament flow, stage progression and promotion | Next |
| 7 | IPL scouting and auction | Planned |
| 8 | Stats, awards, community, settings, polish | Planned |
