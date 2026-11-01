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
# Addendum 2026-10-31 (round 3: AI patience, Dutch, splash, pest-card popup)
15. **AI "gamble happy" measured, then fixed in the bots.** Old-style bots (PR #39 build, no confirmation) placed ~2.5 summit pledges per game in stage 1 and grabbed leg tokens before any goat had moved. New: pledges are shrunk toward chance, must reach `minProb` 0.5 and are re-checked with 48 extra playouts (PR #36's idea, merged with #39's `minProb`); early leg bets are discounted by `legPatience` x share of the stage still unplayed (easy 0.8, normal 0.4, hard 0.2). 2000-game seat-rotated tournaments: pledge confirmation alone beats the old bot 55% vs 40%; adding patience 0.4 gives 51% vs 43% (a deliberate small strength cost for human-like pacing; patience 1.8 loses outright).
16. **Rule change, needs the owner's OK: wrong pledge costs 3 (was 2).** Same change as PR #36. At 2, a near-blind stage-1 pledge was +EV, so even careful bots rationally gambled early.
17. **Merged into this branch:** PR #38 safe-area (kept the 26px minimum top gap from #39), PR #39 round-2 work. PR #36 is superseded by this branch.
18. **Dutch (nl) added**, auto-picked from the phone language, switchable on the start screen and in settings. Strings go through `L(en, nl)` in `web/main.js`. Pest cards (tricks) are called "Pestkaart" in Dutch, pledges "Topgok", stage "Etappe", hay "hooi". Goat and avatar names stay as is.
19. **Short themed "How to play"** in both languages on top of the help sheet; the old full rules sit under "All the rules".
20. **Splash screen** (in-page, tap or ~3 s). The native Android splash and app icon (issue #26) are NOT done.
21. **Pest card popup:** an opponent's trick shows as a big card (who, name, effect, target goat) for ~2 s (shorter on Fast, tap to skip) before the effect plays out.

# Addendum 2026-11-01 (owner playtest of PR #40: "a lot better")
22. **Ram rewritten (owner's idea):** the first goat to reach space 17 stops *on* it (whole stack stops); only the top goat of that stack skips its next run (the "date"); then the Ram wanders off the board. Replaces "goes under the last goat". Interpretation of an ambiguous request; change in `moveGoat` if it was meant differently. Sim (400 games): goat win rates 17-25%, ties 7%, Ram fires in ~19% of stages (it can now only fire once per race, stats count stages).
23. **Goat names with colour in text:** Vincent van Goat (blue), Goatzilla (yellow), Nanny McBleat (green), ChewBAAAcca (red), Goaty Perry (white). Mapping chosen by trait; swap in `engine.js` (`GOATS`) + `GOAT_BLURB` in `web/art.js` and `web/main.js` if you want another. The orange goat is now red (`#e8412c`); its internal id stays `orange`.
24. **Texts live in `web/main.js`:** every sentence is `L("English", "Nederlands")`; trick names/descriptions are the `TRICKS` block at the top, goat blurbs `GOAT_BLURB` (art.js) and `GOAT_BLURB_NL` (main.js).

25. **Review round 4 (brutalcritic, 2026-11-01).** Run was dominated by leg tokens (6-token on best goat ~2.9 hay vs Run 1): a mostly-Run player won 1.4% vs Normal. Owner: raise Run. Sims (1200 games/variant): Run=2 keeps 6/4/2 workable; lowering tokens (5/3/2, 4/3/2) made the first-seat edge worse (seat 0 up to 32%), so seat order is neutralised by a random start player instead. Mostly-Run now wins 34.7/14.5/9.9% vs Easy/Normal/Hard.
26. **Scout is free** (owner): look, then act again; one peek at a time. Bots peek first (Easy 40%, Normal 85%, Hard always); bot peeks are silent in the UI.
27. **Earplugs** now spare only the top goat its skipped run (owner feared a back-marker could never catch a protected leader if the whole stack were immune).
28. Pledges sum then clamp once. Easy's slips never pick blind pledges. Game state is saved after each move with a Continue button (no back-button plugin: a stray back press just resumes). Fredoka self-hosted, portrait locked.
29. Still open (owner call): Loser pledge in stage 1 is +EV about 95% of games (red finishes last 26.6%, blue 13.3%).
30. **Loser pledge pays 3 less than Winner** (owner OK 2026-11-01, wants the reason visible to players: it is in the pledge sheet and help). Measured: blind stage-1 Loser EV +0.83 -> -0.05; drop of 2 was not enough (+0.24). Bot stage-1 pledges 11-14% -> 7%; Hard vs 3x Normal still 37.3%.
