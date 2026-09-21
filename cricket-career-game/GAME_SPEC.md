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
| `/src/data` | Static data: stages, tournaments, venues, trophies, name pools. |
| `/src/save` | 3-slot localStorage save system, autosave, export/import. |
| `/src/store` | Zustand stores; the only bridge between engine and UI. |
| `/src/components` | Reusable UI: Card, StatTile, ProgressBar, Tabs, Badge, Stepper. |
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
| `bowling` | pace, accuracy, swing, seam, spin, bounce, variation, newBall, deathBowling, control |
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
  careers must keep loading.
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
| **Slot Picker / New Career** | `/slots`, `/new` | 3 save slots, create / load / delete / import, player creation |
| **Live Match** | `/match/:id` | 2D top-down ground, fielders as dots, ball-path lines, ball-by-ball commentary, intent controls, Quick Sim |
| **Scorecard** | `/match/:id/scorecard` | Full innings scorecards, fall of wickets, bowling figures, match report |
| **Squad / Team** | `/team/:id` | Squad list, XI, rivals, team needs |
| **Player Profile** | `/player/:id` | Attributes, radar, condition, full record |
| **Tournament** | `/tournament/:id` | Standings, fixtures, knockout bracket |
| **Season Review** | `/season/:year` | Season summary, awards, progression verdict |
| **Retirement** | `/retirement` | Final career statistics and legacy summary |

---

## 9. Phase plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, spec, data models, save system, placeholder Home | ✅ Done |
| 2 | Design-system components + full Home dashboard | Next |
| 3 | Match engine (ball-by-ball, commentary, scorecards) | Planned |
| 4 | 2D ground view and live match screen | Planned |
| 5 | Selection, training and progression engines | Planned |
| 6 | Season, calendar and tournament flow | Planned |
| 7 | IPL scouting and auction | Planned |
| 8 | Stats, awards, community, settings, polish | Planned |
