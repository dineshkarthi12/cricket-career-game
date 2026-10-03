# Live PvP: design and operations

Live PvP is the third game mode, alongside Career Mode and IPL Manager. You
collect real international cricketers, build an XI, and play quick 3D one-on-one matches:
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
src/game3d/           the 3D layer (three.js)
  characters/         procedural rig, props, Cricketer, GLB inspection
  animation/          keyframe clips, AnimationController, two-bone IK, state table
  physics/            ball flight segments
  choreography.ts     what everyone does after a ball, derived from the authority's result
  scene/              Stadium, MatchScene (the director), LabScene
  camera/, render/    camera rig, renderer (adaptive quality, WebGL detection)
src/screens/pvp/      the UI
server/pvp-server.ts  the Node WebSocket server
```

### One source of truth for every ball

`PvpMatch` owns the match. Players only send requests:

1. `SELECT_BOWLER`: only the fielding side, and only players who can bowl.
   Pure batters and keepers are refused by the authority itself, not just
   hidden in the UI.
2. `BOWL` (type, line, length), checked against the bowler's style. A spinner
   cannot bowl a bouncer.
3. `BAT` (shot, timing in ms after the ball left the hand).

Each delivery has a unique id. The authority accepts a `BOWL` and a `BAT`
only for the live id, once each, and in the right phase. Actions carry an
`actionId`, so a resend after a reconnect is acknowledged and ignored. A
timed input that claims to have been played before the ball could have
arrived is refused (`TOO_EARLY`). Deadlines act for a player who does not:
an automatic bowler pick, an AI-planned delivery, or no shot offered.

The ball is resolved by the same `resolveDelivery` engine Career Mode uses:
batter and bowler attributes, line, length, speed, the side and timing of the
shot, pitch, field, and match situation all feed in. Perfect timing improves
the odds but guarantees nothing. A poorly chosen shot (pulling a yorker)
loses a grade of timing.

The authority emits events: `MATCH_START`, `BOWLER_NEEDED`, `DELIVERY_OPEN`,
`BALL_RELEASED`, `BALL_RESULT`, `INNINGS_END` and `MATCH_END`. Every client,
the 3D scene included, renders only these. `classifyContact` turns the
engine's outcome into what the bat did (`NO_SHOT`, `MISS`, `PAD`, `EDGE`,
`BAT`). `choreography.ts` turns that into animations and a ball path, and the
tests check over hundreds of real outcomes that:

- a miss never deflects off the bat
- a boundary is never caught
- only a recorded catch shows a catch, by the fielder the engine named
- the score is the running sum of the deliveries

### The 3D timeline

`MatchScene` processes events in order. On `BALL_RELEASED` the bowler runs
in, the delivery clip starts so the release frame lands on time, and the ball
leaves the bowler's actual hand. It reaches the batter at the timing window's
ideal moment, so the timing meter, the ball and the authority agree. A local
press starts the chosen shot at once, so early and late swings look early and
late. If the result is a miss, the clip switches to the missed-shot version
at the same moment. Fielders run to where the engine sent the ball, catches
happen where the hands are, and batters run the number of runs scored. After
each ball the authority pauses before the next clock starts, so every client
can show the replay. A new ball cuts any replay still running.

The camera director (`camera/CameraRig.ts`) follows a cue list that
`planAfterContact` writes for each ball: RUNUP while the bowler waits and runs
in, DELIVERY (batter-facing, from behind the bowler's end) for the ball,
SIDE_ON at contact, BALL_FOLLOW (high for sixes and skiers), RUNNING for both
batters, CLOSE_UP for catches, wickets, appeals and celebrations, and WIDE
between balls. Each shot names the box it must frame, and the field of view is
solved for the screen's aspect ratio, so an upright phone frames the batter as
well as a desktop. Moves use critically damped springs; changes of angle cut.

Swing and spin only shape the path (`movementFor`, `deliveryPath`): the ball
still arrives where the authority placed it. Contact is played at the bat's
sweet spot. On a run-out the dismissed batter is still short of the crease
when the bails come off (`runLegs`). The scorebug holds back a result until
the scene shows it, so the score never runs ahead of the picture.

The match screen offers replay of the last ball, pause (offline demo only:
pausing stops the authority's clock too), and settings for camera, graphics
quality, lighting and a frame-rate readout (kept in localStorage).

## The players and their cards

Every card is a real cricketer whose photo is in
`public/assets/players/Cricketcareer.zip`.

1. Each photo is tagged with the player it shows
   (`scripts/players/photo-tags.json`, exported from the tagging page).
2. `npm run cards:build` (`scripts/build-pvp-cards.ts`) looks every tagged
   name up in the real player data (`src/data/real`, 2005-2026) and writes
   `src/data/pvp/players.json`: country, role, styles and skills from the
   player's record, then a card rating placed by rank within his role, so
   every tier holds batters, bowlers, all-rounders and keepers. Players in the
   current international squads are *current*; everyone else is a *legend*
   (their best season counts). Greats from before 2005 are entered by hand in
   `scripts/players/pvp-overrides.ts`, which also fixes display names.
3. `python scripts/players/cutouts.py` cuts each player out of his photo and
   aligns the face, into `public/assets/players/cards/<id>.webp`.
4. The best current players also get special editions: Team of the
   Tournament, Player of the Match and Limited Edition (+3 overall). Two
   cards of the same player never play in one XI (`personId`).

The card face (`src/screens/pvp/cards/CardFace.tsx`) puts the photo inside
one of ten frames (`public/assets/cards/frames`, the original card art with
the window cut out and the numbers removed) and draws the rating, flag, name,
styles and the five stats on top as SVG. Which frame: Common, Uncommon, Rare,
Epic (70-79), Legendary (80-96, labelled Elite or Legendary), Icon (97-99),
Legends for retired players, and the three edition frames.

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
  determinism), and matchmaking.
- `src/game3d/game3d.test.ts`: the skinned rig, clips (every track hits a real
  bone), mirroring, the controller (no duplicate one-shots, stale completions
  ignored, disposal), batting IK (hands on the handle for both handedness),
  the GLB pipeline on a real file, ball flight, and choreography against
  hundreds of real engine outcomes.
- `server/pvp-server.test.ts`: two real WebSocket clients against the real
  server. They play a full ranked match, see identical event streams,
  reconnect mid-match, and try forged and duplicate requests. Also covers
  rooms and friends.
- `scripts/qa-pvp.mjs`: browser QA in Chromium (WebGL) with screenshots. Run
  `npm run build && CHROMIUM_PATH=/path/to/chromium npm run qa:pvp`.
