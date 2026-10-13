# Decisions made while the owner was away (2026-10-12) - please review

1. **Critic agents are unusable today.** 11 sub-agent runs (brutalcritic, general-purpose, even a trivial "reply OK") all stalled with no output. Review was done inline; see REVIEW-2026-10-12.md. Re-try the independent review later.
2. **Ram fix applied** (`cfg.ramCrossOnly`, default true): only a goat that *crosses* the Ram space from below triggers it. Sim (500 games, 20-space): game shortens 153 -> 132 turns, goat win rates stay 19-22%, final bets still flip the winner 34% (was 37%), mid-race leader wins 22% (was 21%). Correction to my review: the bug was real but less damaging than I guessed. Toggle back with `--ramcross 0` in sim.js.
3. **Quick 15-space track (ram 12, mud 5-7) is the web default**, Long (20) is a start-screen toggle. Sim: 97 turns / 5.1 stages, goat win rates 19-22%, mid-race leader wins 32% (more predictable, good), final bets flip 43%, ties 6%.
4. **Tiebreak** = most correct final bets, then shared win (UI + RULES.md). Ties are ~4-6% of games.
5. **Hay clamping**: stage scoring sums then clamps once (was per token, order dependent).
6. **Seats**: start screen offers 2 or 3 AI opponents (3 or 4 seats). 3 seats not re-simulated.
7. **Not done / still open**: hedging final bets, hay floor at 0, hay inflation (~29 mean in quick mode), IP/money-structure differences vs Camel Up, Headbutt wording in RULES.md, human playtest. HANDOFF.md and the engine copies on /mnt/Shared are NOT synced (NAS too slow): the working copy is /home/kali/mountain-mayhem.
8. Web UI: `web/` (serve with `python3 -m http.server`). Whistle sheet has no cancel (the peek is committed). Debug hook `window.__mm` exposes game state (remove before online play).

---
# Addendum 2026-10-13 (owner reviewed; skipped git/sync, playtest, agent review and trademark search for now)
9. **Hedging tested, then capped.** Old rule: a bot betting all five goats from stage 1 gained +3.7 final hay (win rate 25.5-26.7% vs 24.4% baseline, 1000 games): a real hay exploit, a small win-rate one. New rule: one Winner + one Loser pledge per player; the same bot gets no edge (22.9-23.8% vs 24.0%).
10. **Camel Up distance: Summit Pledges.** Payout no longer depends on the order of correct bets, but on the stage the pledge was made (10/8/7/6/5/4), wrong costs 2. This removes both the 12/8/5/3/1 ladder and the hedging route. Untuned beyond the hedging test.
11. **3 seats re-simulated** (also 2): goat win rates 19-22%, no seat bias, pledges flip the winner 26% (3 seats) and 17% (2) vs 35% (4). Mean hay inflates as seats drop (25 / 32 / 46).
12. **Hay inflation: left alone** (presentation only). **Hay floor at 0: kept and documented** in RULES.md.
13. **Docs fixed:** Headbutt wording in RULES.md matches the engine; REVIEW and HANDOFF corrected; `window.__mm` debug hook removed from web/main.js.
14. **Web UI** updated to pledges (button "Pledge", sheet shows the current value and remaining kinds); verified by two full headless games (3 and 4 seats), no console errors.

---
# Addendum 2026-10-13 (evening): why did the AI always pledge in stage 1?
15. **Cause (measured, 150 games):** 99% of bot pledges were in stage 1 and right only 21% of the time (chance). Two causes: (a) with -2, a blind stage-1 pledge was +EV (0.2x10 - 0.8x2 = +0.4), so pledging blind early was the *correct* play, a rules flaw; (b) the bot's 12-playout estimates are noisy and the best of ten always looks good (winner's curse).
16. **Fix:** wrong pledge costs **3** (blind early pledge is now -0.4); bot shrinks its probability toward 1/5 and confirms a promising pledge with 48 more playouts (`nConfirm`). Result: 3% of pledges in stage 1, most in stages 3-5, 40-76% correct. Side effect: pledges flip the winner in 14% of 4-seat games (was 35%), so they matter less for the result. A blind stage-1 hedger now loses ~2 hay vs the table.
