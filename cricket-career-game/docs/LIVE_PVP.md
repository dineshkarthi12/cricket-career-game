# Live PvP: design and operations

Live PvP is the third game mode, alongside Career Mode and IPL Manager. You
collect player cards, build an XI, and play quick one-on-one matches on a 2D
ground against another person: two overs a side, three wickets. It has its own
routes (`/pvp/*`), store (`src/store/pvpStore.ts`), saves and economy. It never
reads or writes career or IPL Manager saves.

Phase 14 removed the 3D match (three.js, `src/game3d`) and replaced it with a
2D battle screen; premium 3D-style effects now live on the cards only.

## Architecture

```
src/engine/pvp/       pure TypeScript, shared by browser and server
  config.ts           rating tiers, editions, packs and odds, rewards, match format, matchmaking
  catalog.ts          178 fictional cards from a fixed seed + the real cards
  realCards.ts        real cricketers: verified records -> cards, by a published formula
  weights.ts          role weights for the overall rating, rating -> tier
  rules.ts            the one validation service (ratings, tiers, roles, upgrades, real records)
  economy.ts          idempotent, ledgered operations (packs, market, rewards, upgrades, migration)
  squad.ts            XI rules (11 players, a keeper, 5 bowling options, captain/vice)
  match.ts            PvpMatch: the authoritative match (uses the Career Mode resolveDelivery)
  ranked.ts           Elo, squad strength and the matchmaking queue
  protocol.ts         the WebSocket message types
src/pvp/              client backends: OfflineBackend (demo) and OnlineBackend (WebSocket)
src/screens/pvp/      the UI
  cards/              PlayerCard (one layout, ten designs in cardThemes.ts), flags, icons
  match/              MatchScreen2D, PitchView (ground + pitch strip), controls, view.ts
src/data/pvp/         real-players.json, photo reviews/labels, generated manifest
server/pvp-server.ts  the Node WebSocket server
```

### One source of truth for every ball

`PvpMatch` owns the match. Players only send requests:

1. `SELECT_BOWLER`: only the fielding side, and only players who can bowl.
   Pure batters and keepers are refused by the authority itself, not just
   hidden in the UI.
2. `BOWL` (type, line, length, field), checked against the bowler's style. A
   spinner cannot bowl a bouncer. The field is `ATTACKING` (catchers in),
   `BALANCED` (the automatic field for the phase) or `DEFENSIVE` (boundary
   riders); it moves the fielders the engine resolves against and sets how
   hard the bowler attacks the stumps. Powerplay restrictions still apply.
3. `BAT` (intent, direction, timing in ms after the ball left the hand).
   Intent is `DEFENSIVE`, `NORMAL`, `AGGRESSIVE` or `LOFTED` (the engine's
   approach level 1/3/4/5: more runs, more risk); direction is `OFF`,
   `STRAIGHT` or `LEG`. The authority derives the stroke itself from the two
   (`composeShot`) and ignores any stroke the client claims. Playing against
   the line (leg side to a wide one) costs timing (`directionFit`), as does a
   stroke that does not suit the length (`shotSuitability`). A `LEAVE` lets the
   ball go. Older clients may still send a bare stroke.

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
`BALL_RELEASED` (with the field the bowling side set), `BALL_RESULT` (with
the batter's intent and direction), `INNINGS_END` and `MATCH_END`. Every
client renders only these. `classifyContact` turns the engine's outcome into
what the bat did (`NO_SHOT`, `MISS`, `PAD`, `EDGE`, `BAT`), and the tests check
that the score is always the running sum of the deliveries.

### The 2D match screen

`MatchScreen2D` renders only the authority's events (`deriveView`):

- **Scoreboard**: score, wickets, overs, CRR; in a chase the target, RRR and
  "need N from M balls".
- **Ground** (`PitchView.GroundView`, SVG in metres via `src/lib/ground`): the
  rope, the 30-yard circle, the field the bowling side set (every fielder),
  keeper, both batters and the bowler. After each ball the shot is drawn from
  the bat along the engine's `shotAngle` and `shotDistance`, coloured by
  outcome; a four or six runs to the rope, the fielder who took it turns gold.
- **Pitch strip** (`PitchStrip`): the 22 yards up close - the ball's flight
  from release to the bat, where it pitched (line and length), swing or turn
  after pitching, and the stumps falling for a bowled ball.
- **Ball timing**: the ball reaches the bat at `releaseAt + window.idealMs` on
  the authority's clock (`backend.serverNow()`, RTT-compensated online), so the
  ball on screen, the timing meter and the authority agree.
- **Controls** (`controls.tsx`): bowler picker (cards of eligible bowlers);
  bowling - delivery type from the bowler's pace or spin repertoire, a
  tappable line x length pitch map, the field, Bowl; batting - intent and
  direction (chosen while the bowler sets up), a timing meter, Play shot,
  Leave. Keyboard: Space plays, L leaves, 1-4 intent, arrows direction.
- **Cards**: the striker's and bowler's player cards with live figures.
- **Feeds**: ball-by-ball commentary, an over-by-over log, a scorecard for
  both innings, and both squads.
- **States**: innings break with the target, the result with top performers,
  then back to the lobby, play again (practice), find another match (ranked)
  or a new private room. A replay button re-runs the last ball's flight and
  shot. Online, a lost connection shows "reconnecting" and the client resumes
  from the last event it saw. Pause exists only in the offline demo.

Reduced motion (the OS setting or the in-game toggle) turns off the card
effects and the result pop; the ball's flight is gameplay and stays.

## Ratings and economy rules

Rating tiers (`config.ts`, the only place they live):

| Tier | Overall |
|---|---|
| Common | 40-55 |
| Uncommon | 56-65 |
| Rare | 66-79 |
| Epic | 80-89 |
| Legendary | 90-96 |
| Icon | 97-99 |

- The tiers are contiguous from 40 to 99; the tests check every boundary.
- The overall is computed from five attributes - batting, bowling, fielding,
  fitness, mental - with role weights (`weights.ts`): a bowler's batting does
  not count, a keeper's fielding counts more. The catalog check fails any card
  whose attributes do not add up to its overall.
- **Class** is how a card is obtained, not how good it is: FREE cards come
  from coins, play and rewards; PREMIUM cards from gems. Free cards reach Rare
  in packs and Epic through rewards.
- **Editions** are special printings with their own design: Limited Edition
  (only in the Limited pack), Team of the Tournament (weekly mission reward),
  Player of the Match (every 5th win), Legends (retired greats).
- Upgrades add one overall point per level, up to 5, and never past the
  card's tier ceiling: training never moves a card up a tier.
- Ratings are always computed from the catalog plus validated upgrades, never
  stored. A save that claims an unknown card, a bad upgrade or a negative
  balance is reported, and those cards are quarantined (kept out of matches).
- Every economy change is a ledger transaction keyed by a client request id
  that is applied at most once. Match rewards are keyed by match id, so they
  (and any reward card in them) can only be paid once.
- Packs publish exact per-slot odds, which add up to 100%, and the store shows
  the rating range a pack can actually roll in each tier.
- Gems are a **development currency**. No real-money purchase exists. The
  offline demo can grant development gems; a server does so only with
  `PVP_DEV_GEMS=1`.

### Real cricketers

`src/data/pvp/real-players.json` holds facts only - every figure labelled by
format (Test, ODI, T20I) with its sources and the date checked; unknown
facts are null. `realCards.ts` turns each record into a card with a published
formula (bowling from average and wickets per match against format
benchmarks, batting from batting average, plus a longevity bonus; fielding,
fitness and mental use stated design defaults because the data has no basis
for them). A player whose record cannot rate their main skill is left out,
not guessed. The ratings are game-design values, not official statistics.
Photos: see `docs/assets/ASSET_MANIFEST.md` (none is shown until it is
labelled and its rights are confirmed).

### Save migration

Profiles are `schema: 2` since the tier change. `migrateProfile` upgrades a
version 1 profile when it loads (offline in the browser, online in the
server's store): every card is kept, ratings simply follow the catalog,
training levels above a card's new tier ceiling are reduced and refunded in
full, and the change is one `MIGRATION` ledger entry.

## Matchmaking

`ranked.ts` `matchCost` pairs the longest-waiting player with the cheapest
acceptable opponent:

- **Rating**: Elo gap within a window that widens with waiting (75 -> 600).
- **Squad strength**: 75% the XI's average overall + 25% its best three -
  never the single best card. Gap window 5 -> 30 points as players wait.
  Computed on the server from its own copy of the collection.
- **Experience**: a newcomer (under 10 matches) paired with a veteran (50+)
  costs extra, so they meet only if nobody closer is waiting.
- **Connection**: the server measures each connection's round trip with
  WebSocket ping frames; high combined latency costs more, and above 900 ms
  the pair is refused.

All numbers are in `MATCHMAKING` / `RANKED` in `config.ts`. The lobby shows
searching (with elapsed time and what is matched on), matched (the match
opens), reconnecting, completed and error states.

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
- `src/engine/pvp/phase14.test.ts`: real cards and their formula, the v1 -> v2
  migration, reward cards paid once, market limits, pack pools, intent and
  direction, the field setting, matchmaking costs, and 60 bot matches showing
  a stronger XI usually wins while a Common XI still wins some and hits
  boundaries (and every score is the sum of its balls).
- `src/screens/pvp/cards/cards.test.tsx`: all ten designs render live data,
  every card maps to one design, portraits only for approved photos.
- `server/assets.test.ts`: the photo pipeline against the real ZIP.
- `server/pvp-server.test.ts`: two real WebSocket clients against the real
  server. They play a full ranked match with the 2D controls (field settings,
  intent and direction), see identical event streams, reconnect mid-match,
  and try forged and duplicate requests. Also rooms and friends, and the
  migration of a version 1 profile when the server loads its data.
- `scripts/qa-pvp.mjs`: browser QA in Chromium with screenshots, including
  the ten card designs and two complete practice matches (desktop and phone).
  Run `npm run build && CHROMIUM_PATH=/path/to/chromium npm run qa:pvp`.
