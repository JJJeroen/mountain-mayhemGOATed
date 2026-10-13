// Bots choose an action given the game state. Smart bots never read the hidden deck order:
// they sample plausible orders (keeping the top card if they scouted it) and Monte-Carlo the stage.
import {
  GOAT_IDS, GOATS, ranking, cloneBoard, moveGoat, resetStageBoard, applyTrickBoard,
  legalActions, shuffle, randInt, rngNext, pledgeValue,
} from "./engine.js";

export function randomBot() {
  const o = { rng: (Math.random() * 2 ** 31) | 0 };
  return (s, p) => {
    const acts = legalActions(s, p);
    return acts[randInt(o, acts.length)];
  };
}

function playStage(b) {
  while (b.deck.length && !b.finished) {
    const g = b.deck.shift();
    b.played.push(g);
    moveGoat(b, g, GOATS[g].die[randInt(b, 6)]);
  }
}
function playToFinish(b) {
  playStage(b);
  while (!b.finished) {
    resetStageBoard(b);
    playStage(b);
  }
}
function sample(s, p, seed) {
  const b = cloneBoard(s);
  b.rng = seed | 0;
  const known = s.players[p].knownTop;
  if (known) {
    const rest = shuffle(b, b.deck.slice(1));
    b.deck = [known, ...rest];
  } else shuffle(b, b.deck);
  return b;
}
function pointsOf(b, pl, extraCheerGoat) {
  const rank = ranking(b);
  let pts = 0;
  for (const leg of pl.legs) pts += leg.goat === rank[0] ? leg.value : leg.goat === rank[1] ? 1 : -1;
  for (const c of pl.cheers) if (rank[0] === c.goat) pts += b.cfg.cheerHay;
  return pts;
}
/** Stage points for every player, from the same final board. */
function allPoints(b, s) { return s.players.map((pl) => pointsOf(b, pl)); }
/** Value of a change to the board for player p: my gain minus the average gain of the others. */
function relGain(after, before, p) {
  let others = 0;
  for (let q = 0; q < after.length; q++) if (q !== p) others += after[q] - before[q];
  return after[p] - before[p] - others / (after.length - 1);
}

/**
 * opts.n: stage playouts per decision, opts.nConfirm: extra playouts to confirm a promising pledge, opts.finalMargin: how much better than 0 a final bet must look,
 * opts.scoutValue: value assigned to scouting, opts.eps: chance of a random move (human-like slips).
 */
export function smartBot({ n = 24, nFinal = 16, nConfirm = 48, finalMargin = 0.5, scoutValue = 0.25, eps = 0, maxTricks = 10 } = {}) {
  const o = { rng: (Math.random() * 2 ** 31) | 0 };
  const fn = (s, p) => {
    const legal = legalActions(s, p);
    fn.info = null;
    if (eps && rngNext(o) < eps) return legal[randInt(o, legal.length)];
    const me = s.players[p];
    const seed0 = (rngNext(o) * 2 ** 30) | 0;

    // Base stage distribution (same seeds reused so tricks are compared fairly).
    const base = [];
    const lead = {}, second = {};
    for (const g of GOAT_IDS) lead[g] = second[g] = 0;
    for (let i = 0; i < n; i++) {
      const b = sample(s, p, seed0 + i);
      playStage(b);
      const r = ranking(b);
      lead[r[0]]++;
      second[r[1]]++;
      base.push({ all: allPoints(b, s), pts: pointsOf(b, me) });
    }
    const baseAvg = base.reduce((a, x) => a + x.pts, 0) / n;

    let best = null, bestV = -Infinity, secondV = -Infinity;
    const trickEv = {};
    const consider = (a, v) => {
      if (a.type === "trick") trickEv[a.card] = Math.max(trickEv[a.card] ?? -Infinity, v);
      if (v > bestV) { secondV = bestV; bestV = v; best = a; } else if (v > secondV) secondV = v;
    };

    for (const a of legal) {
      if (a.type === "leg") {
        const v = s.legStacks[a.goat][0];
        const pl = lead[a.goat] / n, ps = second[a.goat] / n;
        consider(a, pl * v + ps - (1 - pl - ps));
      } else if (a.type === "run") {
        consider(a, 1.0);
      } else if (a.type === "scout") {
        consider(a, scoutValue);
      }
    }

    // Tricks: simulate a random subset of options.
    const tricks = legal.filter((a) => a.type === "trick");
    for (let i = tricks.length - 1; i > 0; i--) {
      const j = randInt(o, i + 1);
      [tricks[i], tricks[j]] = [tricks[j], tricks[i]];
    }
    const whistle = tricks.find((a) => a.card === "whistle");
    for (const a of tricks.filter((x) => x.card !== "whistle").slice(0, maxTricks)) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const b = sample(s, p, seed0 + i);
        if (a.card === "cheer") {
          playStage(b);
          const after = allPoints(b, s);
          if (ranking(b)[0] === a.args.goat) after[p] += s.cfg.cheerHay;
          sum += relGain(after, base[i].all, p);
        } else {
          applyTrickBoard(b, a.card, a.args);
          playStage(b);
          sum += relGain(allPoints(b, s), base[i].all, p);
        }
      }
      consider(a, sum / n);
    }

    // Whistle: peek at the top card, then keep or bury it. Value = information; halved for optimism bias.
    if (whistle) {
      let gain = 0;
      for (let i = 0; i < n; i++) {
        const keep = sample(s, p, seed0 + i);
        const bury = cloneBoard(keep);
        bury.deck.push(bury.deck.shift());
        playStage(keep);
        playStage(bury);
        const gk = relGain(allPoints(keep, s), base[i].all, p), gb = relGain(allPoints(bury, s), base[i].all, p);
        gain += Math.max(gk, gb) - gk;
      }
      consider({ type: "trick", card: "whistle", args: { bury: false } }, scoutValue + 0.5 * (gain / n));
    }

    // Summit pledges: worth it only if a goat is a clear favourite (or clear loser) for the whole race.
    // A pledge pays little over chance when guessed blind, and the best of ten noisy estimates always looks good
    // (winner's curse: bots used to pledge blind in stage 1, right only 21% of the time = chance). So estimate with
    // few playouts first, shrink toward chance (1/5), and only if a pledge would win the turn, confirm it with many more.
    if (me.finalsLeft.length) {
      const win = {}, lose = {};
      for (const g of GOAT_IDS) win[g] = lose[g] = 0;
      let total = 0;
      const playouts = (k) => {
        for (let i = 0; i < k; i++) {
          const b = sample(s, p, seed0 + 7919 * (++total));
          playToFinish(b);
          const r = ranking(b);
          win[r[0]]++;
          lose[r.at(-1)]++;
        }
      };
      const value = pledgeValue(s);
      const pledges = legal.filter((a) => a.type === "final");
      const evOf = (a) => {
        const prob = ((a.kind === "winner" ? win[a.goat] : lose[a.goat]) + 1) / (total + 5);
        return prob * value - (1 - prob) * s.cfg.finalPenalty - finalMargin;
      };
      playouts(nFinal);
      if (pledges.some((a) => evOf(a) > bestV)) playouts(nConfirm);
      for (const a of pledges) consider(a, evOf(a));
    }
    if (best.type === "trick" && best.card === "whistle") {
      // We now see the real top card; decide keep vs bury by simulation with that card fixed on top.
      const top = s.deck[0];
      let keepV = 0, buryV = 0;
      for (let i = 0; i < n; i++) {
        const keep = cloneBoard(s);
        keep.rng = seed0 + i;
        keep.deck = [top, ...shuffle(keep, keep.deck.slice(1))];
        const bury = cloneBoard(keep);
        bury.deck.push(bury.deck.shift());
        playStage(keep);
        playStage(bury);
        keepV += relGain(allPoints(keep, s), base[i].all, p);
        buryV += relGain(allPoints(bury, s), base[i].all, p);
      }
      best = { type: "trick", card: "whistle", args: { bury: buryV > keepV } };
    }
    fn.info = { gap: bestV - secondV, chosen: best.type === "trick" ? "trick:" + best.card : best.type, trickEv, hand: [...me.hand] };
    return best;
  };
  return fn;
}
