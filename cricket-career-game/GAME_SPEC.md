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

**Growth.** Training converts into attribute points via `TRAINING` config:
`baseWeeklyGain` × intensity multiplier × `workRate`, shrinking as an attribute
nears its potential (`potentialFalloff`). Past `declineAge` (32) attributes fall
by `declinePerSeason` unless maintained.

**XP and level.** `XP` config: appearance + per run + per wicket + per catch,
scaled by tournament prestige. Level *n* costs `levelBase × n^levelCurve`.

---

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

**Injuries.** `Injury` carries `severity` (NIGGLE → SEVERE), `bodyPart`,
`expectedReturn`, `attributePenalty`, `matchesMissed` and `recurrence`.
Per-match risk = `baseInjuryChance` (1.2%) + `fatigueInjuryChance` (up to 9%)
scaled by fatigue, reduced by `durability`, raised by a prior `recurrence`.

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
  (`career.aggression`, default 3/3).
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
| **Calendar** | `/calendar` | Season calendar of fixtures, camps, trials, assessments; advance-day control |
| **Training** | `/training` | Weekly plan editor, drill slots and intensity, fatigue/injury-risk preview, attribute growth |
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
| **Slot Picker / New Career** | `/slots`, `/new` | 3 save slots, create / load / delete / import, player creation — **built in Phase 2** |
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

## 9. Phase plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, spec, data models, save system, placeholder Home | ✅ Done |
| 2 | Design-system components + full Home dashboard | ✅ Done |
| 3 | Match engine (ball-by-ball, commentary, scorecards) | ✅ Done |
| 4 | 2D ground view and live match screen | ✅ Done |
| 5 | Selection, training and progression engines | Next |
| 6 | Season, calendar and tournament flow | Planned |
| 7 | IPL scouting and auction | Planned |
| 8 | Stats, awards, community, settings, polish | Planned |
