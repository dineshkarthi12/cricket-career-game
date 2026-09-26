# Cricket Career

A realistic 2D cricket career simulation for the browser. You create a young
cricketer at 8-12 years old and try to earn every step of a 20-stage career:
club and school cricket, district and state age-group sides, senior domestic
cricket, the IPL, India A, and finally India in Tests, ODIs and T20Is - then
retirement and a legacy.

Nothing is automatic. Selection depends on form, fitness, age, competition for
places, team needs, conditions and injuries. Good players get dropped, late
bloomers break through, and most careers never reach India.

- **Matches, ball by ball.** A top-down 2D ground with fielders as dots, ball
  paths, commentary, scorecards, worms, Manhattans and wagon wheels. Set your
  batting or bowling intent on a 1-5 aggression bar, or simulate ahead.
- **The whole cricket year.** Training plans, fitness, injuries and rehab,
  school exams, trials, selection meetings, and real tournament names (Ranji
  Trophy, Vijay Hazare, Syed Mushtaq Ali, Cooch Behar, Duleep, Irani, ICC
  events) with fictional players and fictional IPL franchises.
- **The professional game.** IPL scouting, auctions, retention and trades;
  India selectors, central contracts, world rankings, the World Test
  Championship, ICC tournaments, awards, media and fans, captaincy offers.
- **Plays offline.** Install it to a phone's home screen; careers are saved in
  the browser (IndexedDB) in three slots with export and import.

## Run it locally

Requires Node.js 20 or newer. The app lives in the `cricket-career-game/`
folder of this repository.

```bash
cd cricket-career-game
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Type-checks and builds the production app into `dist/` (including the service worker) |
| `npm run preview` | Serves the production build at http://localhost:4173 |
| `npm test` | Runs the unit and component tests (Vitest) |
| `npm run lint` | Type-checks without building |
| `npm run qa` | Browser QA: plays a demo career in Chromium and screenshots every screen at 1440, 820 and 390 px into `qa-screenshots/` (needs `npm run build` first) |

In a development build (`npm run dev`), Settings has developer tools,
including a fast-forward that jumps a career to later stages.

## Deploy to Vercel

The repository is ready for Vercel: `vercel.json` sets the Vite build, sends
every app route to `index.html` (so deep links such as `/training` work), and
serves the service worker uncached so updates reach players.

1. Sign in at https://vercel.com with your GitHub account.
2. Click **Add New... > Project**, find `cricket-career-game` in the list of
   your GitHub repositories and click **Import** (if it is not listed, click
   **Adjust GitHub App Permissions** and give Vercel access to the repository).
3. Under **Root Directory** click **Edit** and choose the
   `cricket-career-game` folder (the app is not at the top of the repository).
   Vercel then detects **Vite**; leave the defaults - build command
   `npm run build`, output directory `dist`, install command `npm install`.
   No environment variables are needed.
4. Click **Deploy**. After a minute or two you get a public link like
   `https://cricket-career-game.vercel.app`.
5. From then on every push to `main` redeploys production, and every pull
   request gets its own preview link.

Or from the command line: `npm i -g vercel`, then `vercel` (preview) and
`vercel --prod` (production) inside the `cricket-career-game` folder.

## Tech stack

- React 19, TypeScript, Vite
- Tailwind CSS v4, lucide-react icons, recharts for charts
- Zustand for state, React Router for screens
- IndexedDB via `idb-keyval` for saves
- A hand-written service worker and web manifest (installable PWA)
- Vitest, Testing Library and fake-indexeddb for tests; Playwright for browser QA

## Project layout

Paths below are inside `cricket-career-game/`.

| Path | Holds |
|---|---|
| `src/engine` | Pure TypeScript game logic - match engine, selection, training, calendar, the professional world. No React. Balance constants live in `src/engine/config.ts` |
| `src/types` | Data models |
| `src/data` | Static data: stages, tournaments, venues, nations, franchises, name pools |
| `src/save` | Save slots, autosave, export and import, migrations |
| `src/store` | Zustand stores bridging the engine and the UI |
| `src/components`, `src/layout`, `src/screens` | The UI |
| `scripts/` | Icon rendering, the service worker template, browser QA |

In `cricket-career-game/`, `CAREER_MODE.md` describes the career rules, `GAME_SPEC.md` the technical
design, and `PROGRESS.md` what each development phase delivered.
