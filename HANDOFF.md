# Mountain Mayhem: GOATed - handoff & plan

Written for a fresh session. Read this first, then `RULES.md`. Date of last work: 2026-10-12.

## 1. What this is
A mobile party game, inspired by the board game **Camel Up** (rules PDF: `D:\claude\spelregels-camel-up.pdf`, Dutch). Five goats race up a mountain path; goats that land on other goats climb on top and carry whoever sits on their back. Players bet on who leads each stage and on the overall winner/loser, and play trick cards. Name chosen: **Mountain Mayhem: GOATed** (trademark/store search NOT done yet).

Target: **phone-friendly web page**, **1 human vs AI** first. Later a quick party game with 4 humans (pass-and-play first, online much later). Art direction: **beautiful and humorous, NOT pixel art**.

> **Seats (updated 2026-10-13):** "3 players" was ambiguous, so the start screen offers 1 human + 2 or 3 AI (3 or 4 seats). Both are now simulated (`node sim.js --quick --players 3`); 2 seats also work. Balance is similar across seat counts, but mean hay rises as seats drop (25 / 32 / 46 for 4 / 3 / 2 seats).

> **Newer than this document (2026-10-13):** final bets were replaced by **Summit Pledges** (one Winner + one Loser per player, payout 10/8/7/6/5/4 by stage placed, wrong -2). Read RULES.md v0.3 for the current rules; sections 3-4 below describe the older final-bet economy.

## 2. How we got here (conversation summary)
1. User shared a YouTube video (channel "Count Grey Matter", "Is Anyone Home Inside an AI?"). It could not be fetched; the description gave no production details. User's actual goal: make a similar pixel-art explainer.
2. We built a pixel-art **Camel Up rules video** (pixel sprites as text grids, Pillow renderer, ffmpeg, local Kokoro English TTS). Result: `D:\claude\camelup\out\camelup_rules.mp4` (3:45). Tools: `D:\claude\camelup\build_full.py` (21 narrated beats). Edge TTS got 403 so narration is English; Dutch needs the unfinished Chatterbox test from `D:\claude\SESSION_HANDOFF.md`. User liked it.
3. User then wanted a **mobile game inspired by Camel Up** with goats (they climb), a **mud** zone that halves pace, and a **straight with a beautiful Ram** at the end: the first goat there falls in love and goes to last place, underneath the last goat.
4. **IP discussion** (not legal advice): game mechanics/rules are not copyrightable; art, name, rulebook text and component designs are; trademark ("Camel Up") is the real risk, plus app-store takedowns for clones. Decision: own name, own art, own rules text, and replace Camel Up's pyramid/tiles with different mechanics. Do a trademark + App Store/Google Play search for "Mountain Mayhem" and a quick patent look before launch; consult an IP lawyer if commercial.
5. Pyramid replacement: **Herd deck** (one card per goat, shuffled each stage) + that goat's own die. Mobile makes this easy. Added **Scout** (secretly peek at the next card) and later **Whistle** (peek, then keep or bury the card).
6. Prank tokens were rejected by the user (too close to desert tiles) and replaced with **trick cards** (8 types).
7. Built `engine.js` (pure rules), `bots.js`, `sim.js` (balance simulator), `test.js`; tuned payouts and tricks. See section 4.

## 3. Current rules (see RULES.md for full text)
- 20-space track + finish. Mud spaces 6-8 (halves roll rounded up, Mudlark ignores). Ram at space 17.
- 5 goats, each with its own die (avg 2): Blue Mudlark `1 2 2 2 2 3` (ignores mud), Yellow Sprinter `1 1 1 3 3 3`, Green Steady `2 2 2 2 1 3`, Orange Leaper `0 1 2 2 3 4`, White Diva `1 1 2 2 3 3`.
- Stage = 5 Herd cards, each goat moves exactly once. Turn = one of 5 actions: **Leg bet** (tokens 6/4/2 per goat, second place +1, wrong -1), **Play a trick**, **Run** (flip Herd card, roll that goat's die, +1 hoof token = +1 hay at stage end), **Scout**, **Final bet** (face-down Winner/Loser token, can't be taken back).
- Ram: first goat in a stage to end a move on/past space 17 goes under the last-place goat; its riders stay. Resets each stage. Earplugs trick makes a goat ignore it.
- Final scoring: correct final bets in placement order pay **12, 8, 5, 3, then 1**; wrong costs 1. Most hay wins. Start: 3 hay, 3 trick cards (draw 1 per stage, hand max 4).
- Tricks (8 types, 20 cards): Headbutt x3, Snack x3, Mud Slide x2, Wobble x3, Swap Places x2, Earplugs x2, **Whistle x2**, Cheer x3 (+2 hay if goat still leads).

## 4. What was tested (Monte-Carlo, 4 smart bots, ~800 games per run, `node sim.js`)
**Baseline health:** each goat wins 17-23%; no seat advantage; ~8 stages, ~150 turns per game; ties 3-6%. Smart bot beats 3 random bots 98.7% (decisions matter).

**Hay sources per player per game:** leg bets ~22, hoofs ~10, Cheer ~2.5, final bets ~4.7. (User wants leg betting to stay the main source: it is.)

**Final-bet incentives:**
| Variant | Final bets flip the overall winner | Final-bet hay/player |
|---|---|---|
| 9/6/4/2/1 | 29% | 3.5 |
| **12/8/5/3/1 (adopted)** | **~38-41%** | 4.7 |
| 6/5/4/3/2 (flat) | 18% (boring) | 3.7 |
| penalty -2 | 31% | 2.5 |
Bot boldness (margin 0 vs 1.5) barely matters.

**Trick strength** (bot's average best EV in hay, plays per game, copies): Swap 1.0 (4.2, 2) strongest; Cheer 0.83 at +2 (6.6, 3; was never played at +1); Whistle 0.72 (3.2, 2); Headbutt 0.43; Snack 0.51; Mud Slide 0.39; Wobble 0.25; Earplugs 0.24 (weak). Old Shake the Herd was ~0 and was replaced by Whistle. Opponent-aware valuation (my gain minus the others' average gain) raised trick use from 14% to ~21% of actions.

**The Ram:** adds ~1.4 stages and ~2 lead changes per race. Off: 6.7 stages. Ram at 19: 7.5 stages.
**Length:** a 15-space track (ram 12, mud 5-7) gives ~5.8 stages / ~98 turns (candidate "quick mode").
**"Is it fun?" proxies:** ~9.5 lead changes per race; winner margin ~0.2x mean hay (close finishes); ~35-50% of decisions are near-ties between options; **but** the goat leading at the midpoint wins only ~22% of races (chance = 20%), so the race is very swingy even without the Ram. Fine for a party game, makes early final bets gambles. Real fun = needs human playtests; the sim only proxies it.

**Known limits of the bots:** heuristic; they ignore opponents' hidden hands, don't model Whistle/Scout knowledge of others, and are not human-like. Mean hay (~40) inflates because hoofs/legs are positive-sum; payouts could be scaled down.

## 5. Files
```
D:\claude\mountain-mayhem\
  RULES.md      full rules draft v0.1 + balance notes + open questions
  HANDOFF.md    this file
  engine.js     pure rules engine (ES module): newGame, legalActions, apply -> events, ranking, moveGoat, trickOptions
  bots.js       randomBot, smartBot (Monte-Carlo, hidden-info safe); bot.info has EV/gap data
  sim.js        balance + fun-proxy simulator   (node sim.js --games 800 --procs 8 --mode balance --n 16 [--payouts .. --penalty .. --legs .. --finish .. --ram .. --cheer .. --margin ..])
  test.js       8 rule tests incl. 200 random full games   (node test.js)
  package.json  {"type":"module"}
D:\claude\camelup\          Camel Up rules video project (pixel art; build_full.py, out\camelup_rules.mp4)
```
Node 22 is installed. Python deps used by the video: Pillow, kokoro, soundfile, imageio-ffmpeg.

## 6. Plan: phone-friendly web prototype (1 human + 3 AI)
**Tech:** static site, **no framework**: vanilla ES modules + **inline SVG** + CSS/Web Animations. Reuse `engine.js` and `bots.js` unchanged (copy into a `web/` folder or import by relative path). Run bots in a **Web Worker** (a smart decision takes ~50-100 ms; keep UI smooth). Serve with `npx serve` or Vite only if needed. Optional PWA manifest so it can be added to the home screen.

**Architecture (keeps 4-human and online options open):**
1. `engine.js` - rules, no UI. State changes only through `apply(state, action)`, which returns an **events array** (`move`: goat, from, to, carried, ram, slowed; `stageEnd`; `end`).
2. Controller - turn loop. Each seat is a **controller** with `decide(state, seat) -> action`: `HumanController` waits for UI input, `BotController` calls `smartBot`. Adding humans later = swapping controllers; online later = run the engine on a server and send each client only its own view.
3. View - SVG renderer + animation queue driven by events. The view only reads state; it never decides rules.
4. **Hidden information:** show only the human's own hand and own `knownTop`. Opponents' hands/scouted card are not rendered. (Bots currently receive the full state object but do not read the deck order; fine for local play.)

**UI (portrait, one-handed):**
- Top: stage number, Herd deck count (backs), hay counters for all players.
- Middle: the mountain path as a winding SVG track (20 spaces + finish), mud patch, the Ram on a hill at space 17, goats as stacked tokens.
- Bottom sheet: 5 big action buttons (Leg bet / Trick / Run / Scout / Final bet), the trick hand as cards, leg-token stacks per goat colour. Touch targets >= 44 px.
- Whistle needs a 2-step UI: show the engine's `s.deck[0]` privately, then choose Keep/Bury, then submit `{type:'trick', card:'whistle', args:{bury}}` (`legalActions` lists both bury options; dedupe in the UI).
- Stage-end scoring screen (count-up animation), race-end screen revealing final bets in placement order, and a "How to play" screen (can reuse the explainer-video storyboard from `D:\claude\camelup\build_full.py`).

**Art (humorous vector, placeholder first):** five goat characters with distinct personalities and expressions (neutral, effort, mud-splattered, dizzy, in love), plus a handsome Ram with hearts. Built as SVG symbols with CSS-variable colours so final art can be swapped in. I (Claude) can hand-write SVG; for painted final art the user would use an image model or illustrator. Write an art brief + character sheet before drawing.

**Milestones:**
1. **M1 playable skeleton**: web page, engine + Web Worker bots, plain boxes for goats, all 5 actions usable, full game to the end. (Goal: validate flow and rules by playing.)
2. **M2 SVG board + goats + animations**: hop arcs, carry, Ram heartbreak, mud splash, score count-up.
3. **M3 polish**: how-to-play, sound (optional), tutorial hints, settings (track length 15/20 "quick/long game"), AI difficulty (`n`, `eps` in `smartBot`).
4. **M4 playtest + tuning**: have people play; re-run `sim.js` for any rule change. Revisit: leg-token values, hay inflation, Earplugs/Wobble strength, trick copies, hand size, tie-break rule.
5. **M5 naming/IP**: trademark + store searches, original rules wording (not Camel Up's text), art not derived from Camel Up.
6. Later: 4-human pass-and-play (needs hand-over screen to hide hands), then online (server runs the engine, per-player views).

**Testing:** keep `node test.js` green; add a Playwright smoke test (load page, play a full game with bots) once M1 exists.

## 7. Open questions for the user
- Confirm seat count (we assumed 1 human + 3 AI).
- Quick (15 spaces, ~100 turns) vs long (20 spaces, ~150 turns) as the default.
- Is the swinginess OK (leader at midpoint wins only ~22%)? Options: smaller Ram, shorter stages, or more info tools (Scout/Whistle).
- Tie-break for equal hay at the end (not defined yet).
- Hay inflation: scale payouts down ~25%?
- Final name check: "Mountain Mayhem: GOATed".

## 8. Gotchas
- `engine.js` mutates state in place; use `cloneBoard` only for simulation boards (it does not copy `players`).
- Ram vs finish: with `ramCrossOnly` (default) the Ram only triggers for a goat that *crosses* the Ram space from below. A goat that jumps past both the Ram and the finish in one move still goes to last place (its riders may cross the finish: funny, intended, untested). A goat already past the Ram can always finish (covered by test.js).
- `engine.js`/`bots.js` exist twice (top level and `web/`); copy top-level to `web/` after every engine change.
- `legalActions` hands the human a Whistle with two `bury` variants; the UI must collapse them.
- Edge TTS is blocked (403). For narration use Kokoro (English) or finish the Chatterbox Dutch test in `SESSION_HANDOFF.md`.
- Don't use the Camel Up name/logo/art anywhere in the game or store listing.
