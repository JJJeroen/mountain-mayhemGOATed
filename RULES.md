# Mountain Mayhem: GOATed - rules draft v0.3 (2026-10-13: Summit Pledges replace final bets, Headbutt wording fixed, 2-4 seats simulated)

Working title. 2-4 players (v1: 1 human + 1-3 AI). Race five goats up the mountain and win the most **hay** by betting on who leads. Every number below is a tuning knob, to be balanced by simulation.

## The idea
Five goats run one lap of the Mountain Path. Goats that end a move on an occupied space **climb on top** of the goats there. A goat carries every goat riding on its back. Nobody owns a goat: everyone bets on all of them.

## The track (20 spaces + finish)
| Spaces | Zone | Effect |
|---|---|---|
| 1-5 | Meadow | Plain |
| 6-8 | **Mud** | A goat whose move *starts* in mud moves **half** its roll (rounded up, min 1). A stack in mud moves by its bottom goat's halved roll. |
| 9-12 | Climb | Plain |
| 13-17 | **The Straight** | Plain. The **Ram** stands at its end (space 17). |
| 18-20 | Sprint | Plain. The finish line is after space 20. |

## The five goats
Each goat has its own six-sided die. Averages are about equal; the spread differs, which is what makes bets interesting.

| Goat | Die faces | Trait |
|---|---|---|
| Blue "Mudlark" | 1 2 2 2 2 3 | Ignores mud |
| Yellow "Sprinter" | 1 1 1 3 3 3 | Boom or bust |
| Green "Steady" | 2 2 2 2 1 3 | Very predictable |
| Orange "Leaper" | 0 1 2 2 3 4 | Wild swings |
| White "Diva" | 1 1 2 2 3 3 | Average (placeholder for a special trait) |

## Setup
Shuffle the five goats' dice rolls for the start: each goat rolls its die once and starts on that space (0 is treated as 1). Goats on the same space form a stack, in random order. Each player starts with **3 hay**, one **Winner pledge** and one **Loser pledge** and **3 trick cards** drawn from the Trick deck. At the start of every later stage each player draws 1 trick card (hand limit 4, discard down).

## A stage (round)
A stage uses a **Herd deck**: five cards, one per goat, shuffled at the start of every stage. The stage ends when the last card has been played. Each goat therefore moves **exactly once per stage**.

## On your turn: do exactly one of five actions
1. **Leg bet.** Take the top **leg-bet token** of a goat colour (each colour has a stack worth 6, then 4, then 2). You bet that this goat leads at the end of the stage.
2. **Play a trick.** Play one trick card from your hand, face up, and do what it says (see Tricks). Used cards go to the discard pile. Earns nothing by itself.
3. **Run.** Flip the top card of the Herd deck, roll that goat's die, and move it. Take a **hoof token**: +1 hay at stage end.
4. **Scout.** Secretly look at the next card in the Herd deck. Other players see that you scouted but not what you saw. Costs your turn, earns nothing.
5. **Summit pledge.** Secretly pledge a goat as the **Winner** or the **Loser** of the whole race. You get one of each per game (on two different goats) and a pledge can never be taken back. A pledge is worth more the earlier you make it: **10 / 8 / 7 / 6 / 5 / 4 hay** in stage 1 / 2 / 3 / 4 / 5 / 6+. A wrong pledge costs 3.

## Tricks (v1 set, face-up, one per action)
| Card | Effect |
|---|---|
| **Headbutt** | Pick a goat that is riding on another goat: it swaps places with the goat directly beneath it. |
| **Snack** | Pick a goat that has not moved this stage: add **+1** to its run. |
| **Mud Slide** | Pick a goat that has not moved this stage: its run is **halved** (like mud), even outside mud. |
| **Wobble** | The top goat of any stack with 2+ goats falls **one space back**. |
| **Swap Places** | Two single goats (not stacked) trade spaces. |
| **Earplugs** | Pick a goat: it **ignores the Ram** this stage. |
| **Whistle** | Secretly look at the top Herd card, then keep it on top or **bury** it at the bottom of the deck. Others see you used it, not what you saw. |
| **Cheer** | Pick a goat that leads: you earn **2 hay** at stage end if it still leads. |


## Movement
- A goat moves its rolled number of spaces forward, carrying all goats on its back.
- If it ends on a space with goats, it lands **on top** of them.
- Ranking: furthest space leads; within a stack, the goat on top leads.

## The Ram (once per stage)
The first goat in each stage to **cross** space 17 (start below it, end on or past it) falls madly in love with the Ram. The goat that moved (the bottom goat of a moving stack) is immediately moved to the **last-place space and placed underneath** whichever goat currently ranks last. Its riders stay where they landed. The Ram resets at the start of each stage.

## End of a stage: scoring
Based on the current ranking:
- Leg-bet tokens on the **leading** goat pay their value (6 / 4 / 2).
- Leg-bet tokens on the **second** goat pay **1 hay**.
- Every other leg-bet token costs **1 hay** (never below 0).
- Each hoof token pays **1 hay**.

Then discard leg-bet tokens, reset the Herd deck, and the next player starts a new stage.

## End of the race
The race ends when the first goat crosses the finish line (after space 20, or 15 in the quick game). Do a last stage scoring. Then reveal every Summit pledge:
- Correct: the hay value it carries (fixed when you made it, see action 5).
- Wrong: **-3 hay**.
- A Loser pledge is correct if that goat finishes last.

Most hay wins. **Tiebreak:** most correct pledges; still equal = shared win.

**Hay floor.** Hay never drops below 0: each stage's total is summed first and then clamped once. This is deliberate: it stops a player who starts badly from being punished further, at the cost of letting a broke player gamble freely. Revisit after playtests.

## Balance notes (simulation, smart bots, quick 15-space track, 1000 games each)
| Seats | Turns | Goat race wins | Seat wins | Pledges flip the winner | Ties |
|---|---|---|---|---|---|
| 4 | 96 | 18-24% each | 23-27% | 14% | 5.3% |
| 3 | 89 | 19-21% each | 31-35% | 8% | 3.8% |
| 2 | 80 | 19-22% each | 50/50 | 6% | 2.1% |
- Quick track: ~5 stages, mid-race goat leader wins ~30%, ~6 lead changes per race, ~33% of decisions are near-ties.
- Hay per player per game (4 seats): leg bets ~14, hoofs ~6, Cheer ~1.5, pledges ~3.5. Mean final hay ~28 (about 36 with 3 seats, 49 with 2: fewer players share the same tokens, so inflation grows as seats drop).
- **Hedging test.** Under the old rule (a final bet on every goat, payout by placement order), a bot that bet five goats from stage 1 earned +3.7 final hay over the table and won about 1-2 points more often (25.5-26.7% vs 24.4%, roughly noise). With Summit Pledges (one Winner + one Loser, timing-based payout) the same bot gains nothing: win rate 22.9-23.8% vs 24.0% baseline; with the -3 penalty a blind stage-1 hedger loses about 2 hay against the table.
- Tricks (average best EV): Swap ~1.0, Cheer ~0.8, Whistle ~0.8, Snack ~0.6, Headbutt ~0.5, Mud Slide ~0.4, Wobble ~0.3, Earplugs ~0.2.

## Open questions / knobs
- **Whistle** replaced the dead Shake the Herd card; check its simulated strength (see BALANCE/PLAN notes).
- **Trick set:** 8 cards in v1; how many copies of each, and whether to add reaction cards (play out of turn), needs playtesting. Reactions make online play harder, so they are v2.
- **Hand size and draw rate** (3 start, +1 per stage, max 4) are guesses.
- **Track length** (20) and **die faces** need Monte Carlo balancing.
- **Peek** may need a limit, e.g. one scout per player per stage.
- **Ram detail:** is it fair that riders profit when their carrier gets heartbroken? Playtest.
- **Name/IP:** run trademark and store searches for "Mountain Mayhem" before branding (deferred by the owner).
- **Hay inflation:** payouts could be scaled down; held back until a playtest shows whether it matters.
- **Pledge ladder** (10/8/7/6/5/4, wrong -3): with -2 a blind stage-1 guess was +EV (0.2x10 - 0.8x2), so everyone pledged at once; -3 makes blind early pledges lose and pushes sensible pledges to stages 3-5. Cost: pledges now flip the winner far less (see table). Revisit with playtests.
