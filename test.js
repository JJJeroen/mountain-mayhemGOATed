import assert from "node:assert/strict";
import { newGame, moveGoat, ranking, goatSpace, apply, legalActions, DEFAULT_CONFIG, GOAT_IDS } from "./engine.js";

function board(spaces, extra = {}) {
  return { cfg: { ...DEFAULT_CONFIG }, rng: 1, spaces, deck: [], played: [], ramUsed: false, boosts: {}, slows: {}, ears: {}, finished: false, ...extra };
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
t("Ram: first goat past space 17 goes under the last goat; riders stay", () => {
  const b = board({ 2: ["green"], 16: ["yellow", "white"] });
  const e = moveGoat(b, "yellow", 2);
  assert.equal(e.ram, true);
  assert.deepEqual(b.spaces[2], ["yellow", "green"]);
  assert.deepEqual(b.spaces[18], ["white"]);
  assert.equal(b.ramUsed, true);
  const e2 = moveGoat(b, "white", 1); // Ram already used this stage
  assert.equal(e2.ram, false);
});
t("Earplugs: goat ignores the Ram and the Ram stays available", () => {
  const b = board({ 2: ["green"], 16: ["yellow"] }, { ears: { yellow: true } });
  const e = moveGoat(b, "yellow", 2);
  assert.equal(e.ram, false);
  assert.equal(b.ramUsed, false);
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
      apply(s, acts[(Math.random() * acts.length) | 0]);
      const all = Object.values(s.spaces).flat();
      assert.equal(all.length, 5);
      assert.deepEqual([...all].sort(), [...GOAT_IDS].sort());
    }
    assert.ok(s.finished, `seed ${seed} did not finish`);
  }
});
console.log(n, "tests passed");

// Ram only triggers for a goat that crosses the Ram space from below (not for goats already past it)
{
  const b = newGame({ players: 3, seed: 3 });
  b.spaces = { 20: ["blue"], 3: ["yellow"], 1: ["white"], 2: ["green"], 4: ["orange"] };
  b.ramUsed = false; b.finished = false;
  const ev = moveGoat(b, "blue", 2);
  console.log(ev.ram === false && b.finished ? "ok - goat already past the Ram can finish" : "FAIL - Ram caught a goat that was already past it");
}

// Summit pledges: one Winner + one Loser per player, never the same goat twice, value falls with the stage
{
  const s = newGame({ players: 2, seed: 5 });
  const fin = () => legalActions(s, 0).filter((a) => a.type === "final");
  const first = fin().find((a) => a.kind === "winner" && a.goat === "blue");
  apply(s, first);
  const v = s.finalBets[0].value;
  s.turn = 0;
  const rest = fin();
  const ok = v === s.cfg.pledgeValues[0] && rest.every((a) => a.kind === "loser" && a.goat !== "blue") && rest.length === 4;
  console.log(ok ? "ok - pledges: one per kind, no repeated goat, stage-1 value" : "FAIL - pledge rules");
}
