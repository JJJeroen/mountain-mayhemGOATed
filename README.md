# Mountain Mayhem: GOATed

A silly goat-racing party game. Five goats climb a mountain path, stack on each other's backs, slip in the mud and fall for the Ram. You bet on who leads each stage, play trick cards, and pledge who wins the whole race. Most hay wins. (Working title; see `RULES.md`.)

## Play it

The page needs a web server (ES modules and a Web Worker don't run from `file://`):

    cd web && python3 -m http.server 8080      # open http://localhost:8080

Start screen: pick a name and avatar, 2 or 3 AI opponents, AI level, and the Quick (15-space) or Long (20-space) track. Designed for portrait phones.

## Layout

| Path | What |
|---|---|
| `RULES.md` | Current rules (v0.3), balance notes, open knobs |
| `engine.js`, `bots.js` | Pure rules engine and Monte-Carlo AI (no UI) |
| `web/` | The game UI (vanilla ES modules, inline SVG art) and its copies of `engine.js`/`bots.js` |
| `sim.js`, `hedge.mjs` | Balance simulators (`node sim.js --quick --players 3 --games 1000`) |
| `test.js` | Rules tests (`npm test`) |
| `HANDOFF.md`, `DECISIONS-*.md`, `REVIEW-*.md` | Project history and decision log |

`web/engine.js` and `web/bots.js` must stay identical to the top-level files (CI checks this; run `npm run sync` after changing the engine).

## Android APK

CI builds a debug APK with Capacitor on every PR and push to `main`; download it from the workflow run's artifacts. Pushing a `v*` tag attaches it to a GitHub Release. Local build: `npm ci && npm run cap:sync && cd android && ./gradlew assembleDebug`.

## How we work

Same board-driven flow as Cascade Break: issues with `type:`/`priority:`/`area:` labels, five epics, a GitHub Project board (Backlog, Ready, In Progress, In Review, Done), one PR per change, merge when CI is green.
