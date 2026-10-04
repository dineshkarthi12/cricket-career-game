# Live PvP: design and operations

Live PvP is the third game mode, alongside Career Mode and IPL Manager. You
collect real international cricketers, build an XI, and play quick one-on-one matches on the same 2D ground as Career Mode:
two overs a side, three wickets. It has its own routes (`/pvp/*`), store
(`src/store/pvpStore.ts`), saves and economy. It never reads or writes career
or IPL Manager saves.

## Architecture

```
src/engine/pvp/       pure TypeScript, shared by browser and server
  config.ts           rating bands, tiers, packs and odds, rewards, match format
  catalog.ts          the real-player cards, built from src/data/pvp/players.json
  rules.ts            the one validation service (ratings, tiers, roles, upgrades)
  economy.ts          idempotent, ledgered operations (packs, market, rewards, upgrades)
  squad.ts            XI rules (11 players, a keeper, 5 bowling options, captain/vice)
  match.ts            PvpMatch: the authoritative match (uses the Career Mode resolveDelivery)
  ranked.ts           Elo and the matchmaking queue
  protocol.ts         the WebSocket message types
src/pvp/              client backends: OfflineBackend (demo) and OnlineBackend (WebSocket)
src/screens/pvp/      the UI (match/MatchScreen2D.tsx reuses the career ground and panels)
server/pvp-server.ts  the Node WebSocket server
```

### One source of truth for every ball

`PvpMatch` owns the match. Players only send requests:

1. `SELECT_BOWLER`: only the fielding side, and only players who can bowl.
   Pure batters and keepers are refused by the authority itself, not just
   hidden in the UI.
2. `BOWL` (type, line, length, and an optional bowling aggression 1-5),
   checked against the bowler's style. A spinner cannot bowl a bouncer.
3. `PLAY` (batting aggression 1-5), the Career Mode way: the engine picks the
   shot. The match screen sends it as each ball arrives, at the level the
   batter has set. (`BAT`, a shot with a timing in ms, is still accepted.)

Each delivery has a unique id. The authority accepts a `BOWL` and a `BAT`
only for the live id, once each, and in the right phase. Actions carry an
`actionId`, so a resend after a reconnect is acknowledged and ignored. A
timed input that claims to have been played before the ball could have
arrived is refused (`TOO_EARLY`). Deadlines act for a player who does not:
an automatic bowler pick, an AI-planned delivery, or the batter's normal
game (aggression 3).

The ball is resolved by the same `resolveDelivery` engine Career Mode uses:
batter and bowler attributes, line, length, speed, the side and timing of the
shot, pitch, field, and match situation all feed in. Perfect timing improves
the odds but guarantees nothing. A poorly chosen shot (pulling a yorker)
loses a grade of timing.

The authority emits events: `MATCH_START`, `BOWLER_NEEDED`, `DELIVERY_OPEN`,
`BALL_RELEASED`, `BALL_RESULT`, `INNINGS_END` and `MATCH_END`. Every client
renders only these. `classifyContact` turns the
engine's outcome into what the bat did (`NO_SHOT`, `MISS`, `PAD`, `EDGE`,
`BAT`). `choreography.ts` turns that into animations and a ball path, and the
tests check over hundreds of real outcomes that:

- a miss never deflects off the bat
- a boundary is never caught
- only a recorded catch shows a catch, by the fielder the engine named
- the score is the running sum of the deliveries

### The match screen

`screens/pvp/match/careerView.ts` turns the events into Career Mode shapes
(innings, scorecards, the ball log, the field) so the PvP match reuses the
career `GroundView`, `Scorecard`, `CommentaryFeed` and `AggressionBar`
unchanged. After each ball the authority pauses briefly before the next
clock starts, so every client can draw the ball's path. Pause is offline demo
only (it stops the authority's clock too).

## The players and their cards

Every card is a real cricketer whose photo is in
`public/assets/players/Cricket-players.zip` (each photo is named after its
player).

1. `scripts/players/photo-names.json` maps each photo file to the player's
   name in the real player data (`src/data/real`, 2005-2026), or to `null` to
   leave a photo out. One photo is unnamed and left out.
2. `npm run cards:build` (`scripts/build-pvp-cards.ts`) writes
   `src/data/pvp/players.json`: country, role, styles and skills from the
   player's record, then a card rating placed by rank within his role, so
   every tier holds batters, bowlers, all-rounders and keepers.
   - A player with international (or, for nations outside the data, IPL)
     cricket in 2025 or later is *current*; everyone else is a *legend*,
     rated on his best season.
   - `scripts/players/pvp-overrides.ts` holds the hand-kept parts: display
     names ("SL Malinga" -> "Lasith Malinga"), greats from before 2005 with
     gameplay skills, ranking values for players whose data misses most of
     their career, and role fixes.
3. `python scripts/players/cutouts.py` cuts each player out of his photo and
   aligns the face, into `public/assets/players/cards/<id>.webp`.
4. The best current players also get special editions (+3 overall): All
   Rounder (the top four all-rounders), Team of the Tournament, Player of the
   Match and Limited Edition. Two cards of the same player never play in one
   XI (`personId`).

### Card designs

`src/screens/pvp/cards/designs.ts` and `CardFace.tsx`.

| Card | Design |
| --- | --- |
| Common 45-54, Uncommon 55-59, Rare 60-65 | the Common, Uncommon, Rare templates |
| Epic 70-79 | the earlier Epic art |
| Elite 80-89, Legendary 90-96 | the Legendary template (the label reads Elite or Legendary) |
| Icon 97-99 | the Icon template |
| Retired greats | the earlier Legends art |
| Special editions | the All Rounder, Team of the Tournament, Player of the Match and Limited Edition templates |

The templates (`public/assets/Cards template.zip`) are split into two layers
in `public/assets/cards/v2`: `<key>-base.webp` (the whole card with its
placeholder text, numbers and silhouette removed) and `<key>-frame.webp` (the
same art with the photo window cut out). The player's cut-out sits between
them; the rating, flag, country code (in the team-logo circle: no real team
logos), name, role, styles and the five stats are drawn on top as SVG.

Saves from before the real players keep their collection: each old card
becomes a real player of the same tier, era and role (`migrateProfile`, run
when the offline demo or the server loads a profile).

## Ratings and economy rules

- Free players: 45-65 (Common 45-54, Uncommon 55-59, Rare 60-65).
- Premium players: 70-99 (Epic 70-79, Elite 80-89, Legendary 90-96,
  Icon 97-99).
- Nobody may be rated 66-69. This lives in `RATING_RULES.excluded`, and the
  tests pin it.
- Upgrades add one overall point per level, up to 5 levels. They never take a
  free player past 65, or a premium player past their tier's ceiling.
- Ratings are always computed from the catalog plus validated upgrades, never
  stored. A save that claims an unknown card, a bad upgrade or a negative
  balance is reported, and those cards are quarantined (kept out of matches).
  Nothing is silently rewritten.
- Every economy change is a ledger transaction keyed by a client request id
  that is applied at most once. Match rewards are keyed by match id, so they
  can only be paid once.
- Packs publish exact per-slot odds, which add up to 100%. A test rolls them
  40,000 times and checks the results against the published numbers.
- Gems are a **development currency**. No real-money purchase exists. The
  offline demo can grant development gems; a server does so only with
  `PVP_DEV_GEMS=1`.

## Offline demo vs online server

| | Offline demo (default) | Online server |
|---|---|---|
| Opponent | AI | Real players (ranked queue, private rooms, friends) or the server AI |
| Authority | `PvpMatch` in the browser | `PvpMatch` on the server |
| Collection | IndexedDB (`cricket-career-pvp`), on this device | Server database |
| Ranked rating | Never changes | Elo, by the server |
| Tamper-proof | No: it runs on the player's own device | Yes: clients only send requests |

The UI always shows which one is in use (the badge in the header and on the
match screen). The demo is never presented as online play.

## Running it

```bash
cd cricket-career-game
npm install
npm run dev                 # app on http://localhost:5173; Live PvP at /pvp (offline demo)

# Online play, in a second terminal:
npm run pvp:server          # ws://localhost:8787  (data in server-data/pvp-db.json)
npm run pvp:server:dev      # same, with development gems enabled
```

Then, on Live PvP home → **Connection**, enter `ws://localhost:8787` and
press **Connect**. Open a second browser profile (or a private window) to get
a second account, and press **Ranked match** in both, or create and join a
private room.

To have a build connect to a server by default, set `VITE_PVP_SERVER_URL`
(for example `wss://pvp.example.com`) when building.

Server environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8787 | Port for HTTP (`/health`) and WebSocket |
| `PVP_DATA_FILE` | `server-data/pvp-db.json` | JSON storage, written atomically |
| `PVP_DEV_GEMS` | off | `1` (or the `--dev-gems` flag) allows development gems |
| `PVP_ALLOWED_ORIGINS` | any | Comma-separated list of allowed web origins |

### Production checklist (not done here)

- **Hosting.** Vercel serves the static app only. The WebSocket server needs a
  long-running host (Fly.io, Render, Railway, a VM) behind TLS (`wss://`).
- **Storage.** Replace `JsonStore` with a real database (Postgres, for
  example). The interface is small: users, tokens and profiles.
- **Accounts.** Accounts are guest accounts with a server-issued bearer token
  stored in the browser. Linking them to real sign-in (OAuth or email) is not
  implemented.
- **Payments.** None. Real-money gems would need a payment provider, server-
  side receipt validation, and the relevant consumer and loot-box rules for
  each market.
- **Scale.** One process holds the queue and the live matches in memory.
  Several instances would need shared state (Redis, for example) and sticky
  sessions.
- **Rate limits.** Per connection (12 messages/s, burst 40) and per IP for
  new accounts (5 a minute). Adjust them for real traffic.

## Tests

- `src/engine/pvp/pvp.test.ts`: rating bands, catalog validation, the starter
  XI, idempotency, odds, rewards, upgrades and caps, tampered saves, the
  authority (score consistency, single resolution per delivery, out-of-turn,
  stale, duplicate and too-early actions, bowler eligibility, replay
  determinism, career-style `PLAY` batting and bowling aggression), and
  matchmaking.
- `src/screens/pvp/match/careerView.test.ts`: the events drawn as a career
  match add up (runs, wickets, legal balls, dismissals, bowlers' wickets).
- `server/pvp-server.test.ts`: two real WebSocket clients against the real
  server. They play a full ranked match, see identical event streams,
  reconnect mid-match, and try forged and duplicate requests. Also covers
  rooms and friends.
- `scripts/qa-pvp.mjs`: browser QA in Chromium with screenshots, a practice
  match played on the 2D ground. Run
  `npm run build && CHROMIUM_PATH=/path/to/chromium npm run qa:pvp`.
