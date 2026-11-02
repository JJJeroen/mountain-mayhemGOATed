import assert from "node:assert/strict";
import { newGame, moveGoat, ranking, goatSpace, apply, legalActions, DEFAULT_CONFIG, GOAT_IDS } from "./engine.js";
import { smartBot } from "./bots.js";

function board(spaces, extra = {}) {
  return { cfg: { ...DEFAULT_CONFIG }, rng: 1, spaces, deck: [], played: [], ramUsed: false, boosts: {}, slows: {}, ears: {}, skips: {}, finished: false, ...extra };
}
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("goat lands on top of a stack", () => {
  const b = board({ 1: ["white", "green"], 3: ["yellow"] });
  moveGoat(b, "white", 2);
  assert.deepEqual(b.spaces[3], ["yellow", "white", "green"]);
  assert.equal(b.spaces[1], undefined);
});
t("bottom goat carries the whole stack", () => {
  const b = board({ 3: ["yellow", "white", "green"], 4: ["blue"] });
  moveGoat(b, "yellow", 1);
  assert.deepEqual(b.spaces[4], ["blue", "yellow", "white", "green"]);
  assert.deepEqual(ranking(b), ["green", "white", "yellow", "blue"]);
});
t("middle goat leaves the bottom goat behind", () => {
  const b = board({ 3: ["yellow", "white", "green"] });
  moveGoat(b, "white", 2);
  assert.deepEqual(b.spaces[3], ["yellow"]);
  assert.deepEqual(b.spaces[5], ["white", "green"]);
});
t("mud halves the roll (rounded up); Mudlark ignores it", () => {
  let b = board({ 7: ["yellow"] });
  const e = moveGoat(b, "yellow", 3);
  assert.equal(e.steps, 2);
  b = board({ 7: ["blue"] });
  assert.equal(moveGoat(b, "blue", 3).steps, 3);
  b = board({ 7: ["orange"] });
  assert.equal(moveGoat(b, "orange", 0).steps, 0);
});
t("Ram: the first goat to reach space 17 stops there; the stack stops, only its top goat skips its next run", () => {
  const b = board({ 2: ["green"], 16: ["yellow", "white"] });
  const e = moveGoat(b, "yellow", 2);
  assert.equal(e.ram, true);
  assert.deepEqual(b.spaces[17], ["yellow", "white"]);
  assert.equal(e.smitten, "white");
  assert.equal(b.ramUsed, true);
  const bottom = moveGoat(b, "yellow", 1); // the bottom goat is not smitten: it moves (and carries white)
  assert.equal(bottom.skipped, undefined);
  assert.deepEqual(b.spaces[18], ["yellow", "white"]);
  const skip = moveGoat(b, "white", 3); // white skips this run, then is free again
  assert.equal(skip.skipped, true);
  assert.deepEqual(b.spaces[18], ["yellow", "white"]);
  assert.equal(moveGoat(b, "white", 1).skipped, undefined);
});
t("Ram: a lone goat that reaches it stops on it and skips its next run; later goats walk past", () => {
  const b = board({ 15: ["green"], 16: ["blue"] });
  assert.equal(moveGoat(b, "green", 3).to, 17);
  assert.equal(moveGoat(b, "blue", 3).ram, false); // Ram already used this race
  assert.equal(moveGoat(b, "green", 2).skipped, true);
});
t("Earplugs on the top goat: the stack still stops, but nobody skips", () => {
  const b = board({ 2: ["green"], 16: ["yellow", "white"] }, { ears: { white: true } });
  const e = moveGoat(b, "yellow", 2);
  assert.equal(e.ram, true);
  assert.equal(e.deaf, true);
  assert.deepEqual(b.spaces[17], ["yellow", "white"]);
  assert.equal(b.skips.white, undefined);
});
t("stage summary breakdown adds up to each player's stage total (runs count as hay, last run included)", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = newGame({ players: 3, seed });
    let k = seed;
    while (!s.finished) {
      const stagesBefore = s.stats.history.length;
      const acts = legalActions(s, s.turn).filter((a) => a.type !== "scout");
      k = (k * 7 + 3) % 11; // a fixed mix of runs, leg bets, cheers and pledges
      apply(s, k < 5 ? acts.find((a) => a.type === "run") || acts[0] : acts[k % acts.length]);
      if (s.stats.history.length > stagesBefore) {
        const h = s.stats.history.at(-1), prev = s.stats.history.at(-2);
        h.breakdown.forEach((b, i) => {
          assert.equal(b.hoofD, b.hoofs * s.cfg.hoofHay);
          assert.equal(b.legs.reduce((a, l) => a + l.d, 0) + b.hoofD + b.cheers.reduce((a, c) => a + c.d, 0), b.net);
          if (prev) assert.equal(h.hays[i] - prev.hays[i], b.net); // nothing else moves hay during a stage
        });
        if (!s.finished) assert.equal(h.breakdown.reduce((a, b) => a + b.hoofs, 0), 5); // all five runs of a full stage are counted
      }
    }
  }
});
t("crossing space 20 finishes the race", () => {
  const b = board({ 19: ["green"], 2: ["blue"] }, { ramUsed: true });
  const e = moveGoat(b, "green", 2);
  assert.equal(e.finished, true);
});
t("full random games always terminate and keep goats consistent", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = newGame({ players: 4, seed });
    let guard = 0;
    while (!s.finished && guard++ < 3000) {
      const acts = legalActions(s, s.turn);
      apply(s, acts[(s.rng = (s.rng * 1103515245 + 12345) | 0, Math.abs(s.rng >> 8) % acts.length)]);
      const all = Object.values(s.spaces).flat();
      assert.equal(all.length, 5);
      assert.deepEqual([...all].sort(), [...GOAT_IDS].sort());
    }
    assert.ok(s.finished, `seed ${seed} did not finish`);
  }
});

t("pledges: placement order cannot change the result (sum, then clamp once)", () => {
  const finalHay = (order) => {
    for (let k = 1; k < 300; k++) {
      const s = newGame({ players: 2, seed: k });
      s.spaces = { 20: ["blue"], 3: ["yellow"], 1: ["white"], 2: ["green"], 4: ["orange"] };
      s.ramUsed = true; s.deck = ["blue"]; s.turn = 0;
      s.players[0].hay = 0;
      s.finalBets = order.map(([goat, kind, value]) => ({ player: 0, goat, kind, value, stage: 1 }));
      apply(s, { type: "run" });
      if (s.finished) return s.players[0].hay;
    }
    throw new Error("blue never finished");
  };
  const wrongLoser = ["green", "loser", 6], rightWinner = ["blue", "winner", 10];
  // hoof 2 + 10 - 3 = 9, whichever pledge was placed first
  assert.equal(finalHay([wrongLoser, rightWinner]), 9);
  assert.equal(finalHay([rightWinner, wrongLoser]), 9);
});
t("scout is free: the peeking player stays on turn", () => {
  const s = newGame({ players: 3, seed: 4 });
  const pi = s.turn;
  const stage = s.stage;
  apply(s, { type: "scout" });
  assert.equal(s.turn, pi);
  assert.equal(s.players[pi].knownTop, s.deck[0]);
  assert.ok(!legalActions(s, pi).some((a) => a.type === "scout"), "only one peek at a time");
  apply(s, { type: "run" });
  assert.notEqual(s.turn, pi);
  assert.equal(s.players[pi].knownTop, null, "a run makes every peek stale");
  assert.equal(s.stage, stage);
});
t("start player is random across seeds", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) seen.add(newGame({ players: 4, seed }).turn);
  assert.equal(seen.size, 4);
});
t("a run pays hoofHay per hoof at stage end, and hay never goes below 0", () => {
  const s = newGame({ players: 2, seed: 3 });
  s.players[0].hay = 0;
  s.players[0].legs = [{ goat: "blue", value: 6 }, { goat: "blue", value: 4 }];
  s.players[0].hoofs = 1;
  s.players[1].hay = 5;
  s.deck = ["blue"]; s.turn = 0;
  const before = s.stage;
  apply(s, { type: "run" });
  assert.equal(s.stage, before + 1);
  // hay: 0 + legs on blue (+6/+4 if blue leads, else -1 each) floored at 0, plus 2 per hoof: never below 2 for the runner
  assert.ok(s.players[0].hay >= s.cfg.hoofHay);
  assert.ok(s.players.every((p) => p.hay >= 0));
});
t("smart bots return legal actions whatever the hidden deck order is", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const mk = () => { const s = newGame({ players: 4, seed }); s.turn = 0; return s; };
    const a = mk(), b = mk();
    b.deck = [a.deck[0], ...[...a.deck.slice(1)].reverse()]; // same top card, different hidden order
    b.rng = a.rng;
    const bot1 = smartBot({ n: 8, nFinal: 4, nConfirm: 4, scoutChance: 0 }), bot2 = smartBot({ n: 8, nFinal: 4, nConfirm: 4, scoutChance: 0 });
    // Both bots see only the public state; they must at least return legal actions for either ordering.
    for (const [s, bot] of [[a, bot1], [b, bot2]]) {
      const act = bot(s, 0);
      assert.ok(legalActions(s, 0).some((x) => JSON.stringify(x) === JSON.stringify(act)));
    }
  }
});
t("goat already past the Ram can still finish", () => {
  const b = board({ 20: ["blue"], 3: ["yellow"], 1: ["white"], 2: ["green"], 4: ["orange"] }, { ramUsed: false });
  const ev = moveGoat(b, "blue", 2);
  assert.equal(ev.ram, false);
  assert.ok(b.finished);
});
t("summit pledges: one per kind, no repeated goat, stage-1 value", () => {
  const s = newGame({ players: 2, seed: 5 });
  s.turn = 0;
  const fin = () => legalActions(s, 0).filter((a) => a.type === "final");
  apply(s, fin().find((a) => a.kind === "winner" && a.goat === "blue"));
  s.turn = 0;
  const rest = fin();
  assert.equal(s.finalBets[0].value, s.cfg.pledgeValues[0]);
  assert.ok(rest.every((a) => a.kind === "loser" && a.goat !== "blue") && rest.length === 4);
});
console.log(n, "tests passed");
