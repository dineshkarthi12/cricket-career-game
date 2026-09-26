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
| `/src/engine/pro` | Stages 11-20: the professional world, IPL, national selection, ICC events, rankings, awards, media, leadership, retirement, legacy. |
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

Selection has two layers (Phase 6): **squads** per competition, decided by
selectors a few times a season, and the **match-day XI**, picked fixture by
fixture from the squad.

### Squad statuses (`SquadStatus`, `career.squads[tournamentId]`)
`NOT_SELECTED`, `TRIAL_ONLY` (invited to trials, waiting on a decision),
`PROBABLES` (the wider group outside the match squad), `RESERVE` (next in
line), `SQUAD`, `DROPPED`, `FAST_TRACK` (straight into the squad after an
outstanding season). Only `SQUAD` and `FAST_TRACK` make the side's fixtures
the player's own (`involvesUser`); otherwise the AI plays them and the
player plays club cricket. Match day then adds `PLAYING_XI`, `TWELFTH_MAN`
and `BENCH` (`engine/career/selection.ts`), and the coach moves the batting
position and bowling usage with form and trust.

### Squad score (`engine/career/squads.ts`, `SQUAD_SELECTION` in config)
The player is ranked against everyone in their **role group** (batters,
keepers, all-rounders, seamers, spinners): the side's AI squad plus a few
**outside probables** generated at the side's level (the rest of the state
is in contention too).

```
score = 0.60 × overall
      + 0.14 × recent form   (last 8 match ratings, newest weighted most)
      + 0.14 × season index  (the season's figures against the same peers)
      + 0.04 × selector trust + 0.01 × reputation + 0.03 × discipline
      - fitness below 70, a failed fitness test this season (-6)
      + trial bonus × 0.3, + 2 for a player in possession
```

Figures and ratings from cricket below the competition's level count half per
level down (club runs barely move the U-19 selectors).

- **Hard gates.** Age-group cut-offs by date of birth: under X on 1 September
  of the season year (`engine/career/eligibility.ts`). A long injury → `RESERVE`.
- **Newcomers** need to rank inside the XI places plus one cover
  (`SQUAD_CUT`: 5 batters, 1 keeper, 3 all-rounders, 3 seamers, 3 spinners);
  inside the wider group (`SQUAD_PLACES`) they are `PROBABLES`, one past it
  `RESERVE`.
- **Incumbents** keep the place while they stay in the wider group; four low
  scores in a row (rating < 4.6) or falling out of it → `DROPPED`.
- **When the selectors sit:** at trials and camps, at the season's selection
  meetings (senior: the Ranji squad in October, the white-ball squads in
  November), before a competition's first match for anyone still on
  `TRIAL_ONLY`, every 28 days for a player outside the squad (call-ups only),
  and after the fourth low score.
- Every decision is announced in the inbox with its reason ("Dropped from the
  Cooch Behar Trophy squad after 4 low scores; X comes in", "picked ahead of Y
  for a better strike rate").

---

## 7. Save system

Three slots. Careers live in **IndexedDB** (`idb-keyval`, store
`cricket-career/saves`), held in an in-memory cache and written through
(`src/save/slotCache.ts`), so the save API stays synchronous. localStorage
holds only the small `cricket-career:meta:{n}` headers (the slot picker never
deserialises a career), `cricket-career:active-slot` and settings. On first
load old localStorage careers are copied to IndexedDB, verified, and removed.
Background write failures go through `onSaveError` and every failure shows a
toast. Settings shows the storage used against the quota and each slot's size.

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
  existing fixture) and older matches archived to scorecards. v6 (Phase 6):
  squad places for the current stage (a career in progress keeps its
  places), the career path, season reviews, trials, low-score and drop
  counts; AI players get a date of birth, a season line and a history in
  place of a full record; tournament records without tables are dropped.
  The season in progress carries on as scheduled.
  v7 (Phase 7): `pro` (the professional career, empty for an older save)
  and the new trophies, locked.
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
| **Career Path** | `/career` | 20-stage stepper, squad places, next targets with progress, the path taken, every stage with its target, turning points — **built in Phase 6** |
| **Calendar** | `/calendar` | Month and list views colour-coded by event type, season windows, monthly climate, filters — **built in Phase 5** |
| **Training** | `/training` | Weekly plan within the energy budget, expected gains, fatigue and injury-risk preview, lifestyle, school, aggression comfort, fitness tests, coach hints, overall by age — **built in Phase 5** |
| **Matches** | `/matches` | Fixture list, results, links to live match and scorecards |
| **Tournaments** | `/tournaments` | Points tables, bracket, run and wicket leaders with the player's rank, fixtures and results, awards — **built in Phase 6** |
| **Selection / News** | `/selection` | Squad places and reasons, Competition for places, announcements, media and rival news, trials — **built in Phase 6** |
| **IPL Auction** | `/auction` | Scouting reputation and notes, franchise interest, trials, base-price registration, the auction room with the user's lot replayed bid by bid, contract, trade offers, IPL seasons, the ten franchises — **built in Phase 7** |
| **International** | `/international` | Squad status and the competition for places per format, India A and zones, series with host conditions, world player and team rankings (with the formula), central contract, caps, workload rests, WTC table and ICC events — **built in Phase 7** |
| **Stats** | `/stats` | Career and season stats by format and competition, charts (recharts) |
| **Awards** | `/awards` | Trophy cabinet, individual awards (series, tournaments, IPL caps, annual awards), awards by season, milestones — **built in Phase 7** |
| **Legacy** | `/legacy` | Legacy rating, stats by level and format, records book, captaincy record, career timeline, retirement by format — **built in Phase 7** |
| **Community** | `/community` | Followers, public mood, media pressure, the press stories feed — **built in Phase 7** |
| **Settings** | `/settings` | Storage used (IndexedDB) and slot sizes, autosave, save now, export, slots — storage **built in Phase 6** |

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
| **Trial** | `/trial/:fixtureId` | Nets approach, fitness effort, practice match, the verdict — **built in Phase 6** |
| **Season Review** | `/season-review` | Verdict and reasons, figures, targets, squads, awards, coach's report, next goal — **built in Phase 6** |
| **Retirement** | `/retirement` | Same as Legacy (retirement tab) — **built in Phase 7** |

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

## 8e. Selection, tournaments and career stages 1-10 (built in Phase 6)

### World (`engine/world`)
- Every side in a competition has a persistent 17-player squad of
  `RivalPlayer`s with role, attributes, age and date of birth, form, a hidden
  potential and a season line. Names come from regional pools
  (`src/data/names.ts`) - Tamil, Kannada, Telugu, Malayalam, Marathi,
  Gujarati, Bengali, Punjabi, Hindi belt, North-east, and national pools for
  the 15 fictional-named U-19 nations - with famous real players blocked.
- Level profiles (`LEVELS` in `world/teams.ts`): ages, potential and how
  developed each level is, from school (10-13) to senior state (20-33).
  Weaker associations and minnow nations are a little weaker.
- Each 1 June (`progressWorld`): everyone ages and develops or declines, the
  season is archived to their history, age-group players over the cut-off
  leave (the better ones step up to the next side in the state: U-16 → U-19
  → U-23 → senior), the oldest retire, the worst performers are dropped,
  squads are refilled by role. Changes around the player's own sides are an
  inbox digest. Sides with nothing to play keep their names, not their squads.

### Tournaments (`engine/tournament`, `data/tournamentStructures.ts`)
- Real structures for stages 1-10: school and club leagues, the district
  league (2 groups + semis), Vijay Merchant, Vinoo Mankad, Cooch Behar,
  C.K. Nayudu, U-23 State A, Ranji (4×8, two windows), Vijay Hazare and
  Mushtaq Ali (4×8), India U-19 bilaterals (5 legs) and the U-19 World Cup
  (even years, 4×4 against fictional-named nations).
- Round-robin by the circle method; brackets seeded A1 v B2 with group
  winners in opposite halves. Knockouts are settled on the day: a drawn
  first-class knockout goes to the first-innings lead, a tie to a super over.
- Points: limited overs 4 / 2 (tie, no result) with net run rate (all out
  counts the full quota); first-class 6 for a win, 3 / 1 for a first-innings
  lead / deficit in a draw, quotient as tie-break.
- Every match the player is not in is played on the **fast sim**
  (`engine/sim/quickMatch.ts`): score-only, calibrated against the ball-by-
  ball engine (`calibrate.ts`) for first-innings totals, top-order averages
  and strike rates, how often the stronger side wins, and draws.
- Results feed the table, the run and wicket lists, the bracket, the AI
  players' season lines and form, and at the end the trophy and awards
  (champion, top scorer, leading wicket-taker, player of the tournament).
  Finished competitions are filed compactly in `seasonHistory`.

### Trials (`engine/career/trials.ts`)
A trial or selection camp stops the clock like a match. The player chooses a
nets approach (solid / positive / show them - more spread, more risk) and a
fitness-test effort (steady / flat out - better numbers, more fatigue); the
practice match is Probables A v B on the fast sim. The day is worth -10 to
+10 (`TRIALS` in config). A squad trial decides that season's squads on the
spot; an end-of-season trial for the next level (by invitation, at 70% of
the target) feeds the season review. "Let the coach decide" plays it with
the default choices (as does the headless simulation).

### Stage targets and season review (`data/stageTargets.ts`, `career/season.ts`)
- Every stage 1-10 shows a visible target for the next step, e.g. State
  U-16: 300 runs at 35 or 15 wickets in the Vijay Merchant, 4+ matches, pass
  the fitness test. Only that level's competitions count.
- 1 June, before anything else: `reviewSeason`.
  - **Promote** (to the next stage the player is young enough for, as
    `TRIAL_ONLY`): 72% with the target met, 18% at 80% of it, moved by the
    next-level trial, trust, ability against the next level (capped), a
    failed fitness test and not having been in the squad (`SEASON_REVIEW`).
  - **Fast-track**: 160% of the target and clearly above the next level →
    straight into its squad; at 210% a level can be skipped (as probables).
  - **Aged out**: too old for the stage next season and not promoted → on to
    the next stage they are young enough for, without the missed level
    (marked passed over).
  - **Stay**, **Bench** (under 40% of the side's matches), **Dropped**
    (dropped and not back), **Comeback** (dropped and back in the side).
- Senior (stages 7-10): separate Ranji, Vijay Hazare and Mushtaq Ali squads.
  A senior debut completes stage 7 on the day; meeting the "established"
  target in a format completes stage 8, 9 or 10.
- The review goes to the inbox and the Season Review screen, the season to
  `career.path`, and the stage records to `career.stages`.

### Fixtures that are the player's
Squad places switch a competition's remaining fixtures to the player
(`involvement.ts`). Juniors play club cricket alongside; seniors only when
they are in no squad. When two of the player's matches overlap, the smaller
competition plays without them. India U-19 players also play for their state.

### Screens
- **Trial** (`/trial/:fixtureId`): the choices, then nets, fitness test and
  practice match revealed in turn, then the selectors' verdict and squads.
- **Career Path** (`/career`): the 20-stage stepper, current squad places,
  next targets with progress, the path taken season by season, every stage
  with its target and dates, and the turning points.
- **Selection / News** (`/selection`): squad places with reasons and the
  Competition for places table per competition (the player among their role
  group, with XI / squad / outside), announcements, media and rival news,
  trials attended.
- **Season Review** (`/season-review`): the verdict and reasons, the season's
  figures, the targets, squads, awards, the coach's report and next season's
  goal. The Continue bar opens it when a season ends.
- **Tournaments** (`/tournaments`): points tables per group (NRR or
  first-innings lead and quotient), the bracket, run and wicket leaders with
  the player's rank, fixtures and results, awards and past winners.
- **Home**: the stepper, stats tabs, trophies and inbox read the real career;
  the journey card shows squad places and progress to the next target.

---

## 8f. The professional career, stages 11-20 (built in Phase 7)

All of it lives in `src/engine/pro` (pure) on top of the Phase 6 selection,
tournament, calendar and match code; state is `GameState.pro` (`types/pro.ts`,
save v7). Constants: `IPL_RULES`, `AUCTION`, `NATIONAL`, `RANKINGS`, `MEDIA`,
`LEADERSHIP`, `RETIREMENT`, `LEGACY`, `PRO` in `engine/config.ts`.

### Earlier senior debuts (step 0)
Senior selectors give a young player a **prospect credit** of
`SQUAD_SELECTION.prospectPerYear` (1.8) ability points per year under 25, for
the user and AI alike. A U-19, India U-19 or U-23 season at 110% of the target,
with (overall + credit) above the senior bar, can bring a **senior call-up**
(`SEASON_REVIEW.seniorCallUp`) straight to the senior probables; the player
keeps playing U-23 cricket while eligible. Average senior debut 25.2 → 22.3,
with the same share of careers (17.5%) reaching senior level.

### Stages as milestones
Stages 11-20 run on two parallel tracks (IPL and national), so each has its
own status (`engine/pro/stages.ts`), set current when reached and complete
when done; the headline stage is the furthest reached:

| Stage | Current when | Complete when |
|---|---|---|
| 11 IPL Scouting | scouting reputation 26+, or a trial | an IPL contract |
| 12 IPL | contracted | 8 matches in a season (or 20 in all) |
| 13 Duleep / Irani | picked for either | 3 matches, or India A |
| 14 India A | picked | invited to the national camp |
| 15 India Camp | invited | named in an India squad |
| 16 Debut | in a squad | capped |
| 17 Regular XI | capped | 25 caps |
| 18 ICC Events | in an ICC squad | 5 ICC matches |
| 19 Star / Captaincy | 40 caps, top-10 ranking or an India post | captain of India |
| 20 Legacy | retired from a format | retired from all cricket |

### The professional season (`pro/season.ts`)
From a senior state debut every season holds the Duleep Trophy (5 zones,
round-robin and final), the Irani Cup (last season's Ranji champions v Rest
of India), India A four-day and one-day series (a summer tour abroad, a home
series in February) and the IPL. Once the national selectors are watching,
India's bilateral series (`intl-test`, `intl-odi`, `intl-t20i`: a summer
tour, a September home series, a southern-hemisphere tour, a home Test
series; one tournament per format, one two-team group per series) and the
ICC events of that year are added. Competitions are fixtures like any other:
the player's only while in the squad (`career.squads`); clashes go to the
bigger competition (internationals > IPL > India A > zones > state > club).
Events on the calendar run on their day: selection meetings (India A 5 June
and 30 January, Duleep 16 August, Irani 25 September, the national selectors a
week before every series, a fortnight before an ICC event), the India camp
(20 August), IPL retention day (1 November), trade window (6 November),
franchise trials (26 November), the auction (16 December), franchise camp
and replacement signings (March), central contracts (April), awards night
(28 May). 1 June rolls the pro world over (`rolloverPro`).

### World
12 nations (`data/nations.ts`: India, Australia, England, South Africa, New
Zealand, Pakistan strong; Sri Lanka, West Indies, Afghanistan, Bangladesh
mid; Ireland, Zimbabwe associates), each with 22-man senior and 17-man A
squads of fictional players, host cities, a home pitch, bat-friendliness and
climate. New climates: England (cloud, swing), Australia (heat, pace and
bounce), South Africa, New Zealand (wind, green), Caribbean (humid, slow);
subcontinent hosts use the Indian regions. Nations drift each season
(`driftNations`), and the rest of the world's series are settled on ratings
(`backgroundSeason`) for the team rankings and the WTC. 10 fictional
franchises (`data/franchises.ts`) with a city, home ground and style; 22-man
squads with up to 8 overseas players. Five zonal sides and Rest of India.

### Selection at professional level
The Phase 6 squad score, with: the competition's format (`formatOverall`: T20
weights power, range, running, death bowling; Tests technique,
concentration, swing and seam, stamina); last season's matches at 0.7; senior
cricket discounted 0.8 per level (IPL/zones 8, India A 9, India 10) rather
than 0.5; an age drag of 1.4 a year past 32; and a field of outside
contenders ×3 (zones, India A) or ×4 (India). National statuses: selected,
standby (next in line, travels), reserves, not selected, dropped; playing XI,
12th man and bench on match day. The camp is a playable trial (fitness test,
nets, practice match) whose result counts at every meeting that season. The
board rests a player in a white-ball bilateral at fatigue 72+, a seamer with
60+ recent overs, or a seamer with two injuries in a year (T20Is).
Franchise and national XIs pick the best for the format; an IPL XI has at
most four overseas players.

### IPL (`pro/ipl.ts`)
- **Scouting reputation** (0-100): match rating above 5.5 × a competition
  weight (SMAT 2.4, VH 1.3, U-19 WC 1.6, T20I 2.2, IPL 1.8, Ranji 0.5 ...)
  plus standouts (70 in a T20, 4 wickets, a hundred); ×0.8 each season.
  26 = scouts in touch (inbox), 36 = franchise trial, 50 = auction shortlist
  (a trial bonus counts ×1.2; capped players are always in).
- **Interest** per franchise = reputation × need in the role (1.3 short,
  0.65 overstocked) × style fit (spin, pace, batting) × a little noise.
- **Value** = 20 × e^((T20 overall − 71)/3.6) lakh × form (0.8-1.25) × age
  (young +10%, −18%/year past 32); the user's × (0.55 + 0.9 × reputation/100).
- **Retention day**: mini years release players worth under 55% of their
  salary, 36+, or a few at random; mega years (every third season) keep at
  most four (two overseas) at slab prices. The user is retained on value or
  a decent share of matches, and a strong season upgrades the deal.
- **Auction**: released players, 26/60 fresh domestic and 14/34 overseas
  names, and the user (at a registered base price: 20-50 lakh uncapped,
  up to 2 crore capped). Each franchise's ceiling = value × need × style ×
  noise (× interest for the user), within its purse less a reserve for the
  slots left. Ascending bids in steps (5/10/20/25 lakh) until one bidder is
  left; nobody at the base price = unsold. Short squads fill at 20 lakh.
- Replacement signings in March (injuries), trade offers in November for a
  player on the bench (accept or decline), contracts to the next mega
  auction, salary as earnings.
- **Season**: 10 teams, 14 league matches each, NRR table, Qualifier 1
  (1 v 2), Eliminator (3 v 4), Qualifier 2 (Q1 loser v Eliminator winner,
  `SeedRef.loserOf`), final. Impact player (`IPL_RULES.impactPlayer`): on the
  fast sim each side brings one bench player on - a bowler for the side that
  batted first, a batter for the chasers - replacing the XI's weakest at the
  job.

### International (`pro/national.ts`, `pro/competitions.ts`)
Radar: an India A call-up, an IPL season of 380 runs or 16 wickets, or a
zonal season of 300 runs or 14 wickets. Caps with cap numbers, debut records
and stories; match fees (Test 15, ODI 6, T20I 3 lakh); central contracts each
April from the last year (A+ three regular formats 7 cr, A two 5 cr, B one
3 cr, C capped 1 cr). ICC events: T20 World Cup (even years, 12 teams, 2×6,
semis, final), ODI World Cup (every fourth year, 10 teams, league, semis,
final), Champions Trophy (8 teams, 2×4), all at one host's grounds with its
conditions; the WTC is a two-season table (12 a win, 4 a draw, ranked by
percentage) and a June final in England for the top two.

### Rankings (`pro/rankings.ts`)
Per format, every international match earns batting points (base + runs,
fifty/hundred bonuses, strike rate against par in white-ball) and bowling
points (base + wickets − economy over par), ×(1 + 0.02 × (opposition
strength − 80)) and +5% in a win, 0-1000. A rating moves 15% towards each
match (faster over the first five). 3 matches to be ranked; all-rounder =
batting × bowling / 1000. Teams: Elo-style per format (scale 10, K 4, home
advantage 3). Best ranks are kept for the user. Other nations' bilateral
series (`pro/worldSeries.ts`, five per format a season) are played on the
fast sim once both squads exist, so rival players earn rankings and season
figures; each keeps a lightweight scorecard (result, top three scorers and
wicket-takers) shown under Around the world on the International screen.

### Awards, media, leadership
Player of the series in every bilateral series; Orange Cap, Purple Cap and
MVP in the IPL; player of the tournament, top scorer and wicket-taker at ICC
events; the annual awards night (Indian Cricketer of the Year, Test/ODI/T20I
player of the year against the best Indian international season, Emerging
Player, Domestic Cricketer of the Year). Media: followers grow with big days
on big stages, sentiment follows ratings, failures in big matches build
pressure (60+ costs confidence, 85+ a little trust), and notable days become
stories - the Community feed. Leadership offers (vice-captain, then captain)
at state (season start), IPL (March) and India per format (season start and
January): a score of leadership 0.45 + temperament 0.2 + 8 per rating point
above 5 + seniority (max 20), which must pass a threshold and beat the side's
best other leader; accept or decline (a decline waits two seasons). A captain
gets Phase 4 captain mode for that side - for India, that format only
(`isCaptainOf(..., format)`); records per team and format.

### Decline, retirement and legacy
Decline, recurring injuries and form are the Phase 5 systems. From 34 the
selectors stop picking a player they have left out ("overlooked"), and from
32 the inbox raises retirement after a season without senior cricket. The
player retires from Tests, ODIs, T20Is, the IPL, first-class cricket or all
cricket (`retireFrom`); all cricket ends the career. The headless simulation
retires a player who never made a senior debut at 26 after two seasons
without senior cricket, others at 32+ after two empty seasons, leaves an
overlooked format from 33-34, and stops at 41. The legacy rating (0-100,
`legacyInputs` / `scoreLegacy` / `legacyTier`, `LEGACY` in config) is impact
across formats, not a caps count: runs and wickets weighted per format
(per 1000 runs: Test 9, ODI 8, T20I 10; per 50 wickets: 9 / 8 / 9; up to
40), averages (0.5 a point above a batting average of 30 or below a bowling
average of 34, with 20 innings / 30 wickets to qualify; up to 12), the best
world ranking (No. 1 10, top 3 7, top 10 4, top 20 2), ICC titles including
WTC finals (6 each, up to 18), India captaincy (5 + 0.2 a win, up to 5 more;
IPL captaincy 2), awards and records (up to 12 and 6), and a little for caps
(0.2 each, up to 10), the IPL and domestic cricket. Tiers run Club Cricketer,
State Player, Domestic Stalwart, Domestic Legend, IPL Regular, International
Cap, International Regular (25 caps), India Great (score 50, 25 caps),
All-Time Great (score 70, 30 caps - the caps floor only rules out a cameo).
Over 200 simulated careers: 2 All-Time Greats (1%), 1 India Great, 3
Regulars. The records book (`data/records.ts`,
fictional holders) covers India Test/ODI/T20I, IPL and Ranji records.

### Save size
`engine/calendar/compact.ts` thins the career each 1 June: this season's
matches keep full scorecards (the last two matches every ball), three seasons
back the top of each scorecard and the player's lines, older ones totals and
the player's performance; last season's competitions keep their tables, the
three before the player's group and award winners, older ones the champion,
awards and the player's line; old fixtures go; AI players keep three seasons
of history; old auctions keep their headline lots. A full professional
career ends at about 5-6 MB (average 2.7 MB over 200 careers).

## 8g. Polish, QA and deploy (built in Phase 8)

### Impact player in live matches
In the IPL the setup carries both benches. At the innings break the side
batting first may bring on a bowler and the chasers a batter: the AI picks
with `impactSwap`; a captain chooses In / Out (or no substitute) on the
Innings Break screen (`LiveMatch.chooseImpact`).

### Difficulty (`DIFFICULTY` in config, per career, save v8)
Easy / Realistic / Hard: +4 / 0 / -4 on the player's score in every squad
decision, and +4 / 0 / -4 on the player's batting and bowling skills in
every match the engine plays (`withDifficulty` in `simFromUser`).

### Device settings (`store/appSettings.ts`, localStorage)
Animation speed (x1.4 / x1 / x0.6 on ball flight and the auction room),
default sim speed, reduce motion (also follows `prefers-reduced-motion`),
and the tutorial tips seen. Settings also has storage usage, export, import
(with a confirm), delete this career (with a confirm), install-app help and,
in development builds, the fast-forward tools (`engine/dev/fastForward.ts`).

### Tutorial
Five one-time tips (`components/TutorialTip.tsx`): dashboard, training,
match controls, the aggression bar, selection. "Skip tutorial" hides all;
Settings resets them.

### Accessibility and performance
Visible focus ring, a skip link, dialogs that move focus in, trap Tab and
restore focus, `role=radiogroup` choices, contrast-checked text tokens, and
reduced motion. Every screen but Home is code-split; recharts loads with the
first chart; fonts are self-hosted.

### Installable app
`public/manifest.webmanifest` and crown icons (`scripts/make-icons.mjs`); a
service worker generated at build time (`scripts/sw-template.js`, the
`serviceWorker` plugin in `vite.config.ts`) precaches the whole build: pages
network-first with the app shell offline, assets cache-first. `lib/pwa.ts`
registers it, keeps the install prompt and reports updates (AppBanner).

### Browser QA (`scripts/qa.mjs`, `npm run qa`)
Plays a career through the dev server in Chromium and screenshots every
screen at 1440, 820 and 390 px into `qa-screenshots/`, logging console
errors, horizontal overflow and fast-forward results.

### Deploy
`vercel.json`: Vite build, SPA rewrite to `index.html`, `sw.js` uncached,
immutable caching for hashed assets. The Vercel project's root directory is
`cricket-career-game`.

---

## 9. Phase plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, spec, data models, save system, placeholder Home | ✅ Done |
| 2 | Design-system components + full Home dashboard | ✅ Done |
| 3 | Match engine (ball-by-ball, commentary, scorecards) | ✅ Done |
| 4 | 2D ground view and live match screen | ✅ Done |
| 5 | New career, development, training, injuries and calendar | ✅ Done |
| 6 | Selection, tournaments, career stages 1-10, IndexedDB saves | ✅ Done |
| 7 | Stages 11-20: IPL to retirement | ✅ Done |
| 8 | Polish, QA, installable app, deploy | ✅ Done |
