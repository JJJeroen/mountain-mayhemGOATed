// Mountain Mayhem: GOATed - rules engine (no UI, no I/O). See RULES.md.
// State is a plain object mutated by apply(); players (human or bot) only choose actions.

export const GOAT_IDS = ["blue", "yellow", "green", "orange", "white"];
export const GOATS = {
  blue: { name: "Mudlark", die: [1, 2, 2, 2, 2, 3], mudImmune: true },
  yellow: { name: "Sprinter", die: [1, 1, 1, 3, 3, 3] },
  green: { name: "Steady", die: [2, 2, 2, 2, 1, 3] },
  orange: { name: "Leaper", die: [0, 1, 2, 2, 3, 4] },
  white: { name: "Diva", die: [1, 1, 2, 2, 3, 3] },
};
export const TRICK_COPIES = { headbutt: 3, snack: 3, mudslide: 2, wobble: 3, swap: 2, earplugs: 2, whistle: 2, cheer: 3 };
export const DEFAULT_CONFIG = {
  finish: 20, mud: [6, 8], ram: 17, startHay: 3,
  legValues: [6, 4, 2], pledgeValues: [10, 8, 7, 6, 5, 4], hoofHay: 1,
  startHand: 3, handMax: 4, mudHalves: true, ramCrossOnly: true, finalPenalty: 3, cheerHay: 2,
};

// ---- seeded rng (state kept in o.rng so a board can be cloned and replayed) ----
export function rngNext(o) {
  o.rng = (o.rng + 0x6d2b79f5) | 0;
  let t = o.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (o, n) => Math.floor(rngNext(o) * n);
export function shuffle(o, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(o, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- board helpers (board = the part of state that moves goats) ----
export function cloneBoard(s) {
  const spaces = {};
  for (const k in s.spaces) spaces[k] = s.spaces[k].slice();
  return { ...s, spaces, deck: s.deck.slice(), played: s.played.slice(),
    boosts: { ...s.boosts }, slows: { ...s.slows }, ears: { ...s.ears } };
}

/** Goats from first place to last: furthest space first, top of a stack first. */
export function ranking(b) {
  const out = [];
  const keys = Object.keys(b.spaces).map(Number).sort((a, c) => c - a);
  for (const k of keys) for (let i = b.spaces[k].length - 1; i >= 0; i--) out.push(b.spaces[k][i]);
  return out;
}
export function goatSpace(b, g) {
  for (const k in b.spaces) if (b.spaces[k].includes(g)) return Number(k);
  return null;
}
const stackAt = (b, sp) => (b.spaces[sp] ||= []);

function inMud(b, sp) {
  return sp >= b.cfg.mud[0] && sp <= b.cfg.mud[1];
}

/** Move a goat (carrying everyone above it). Returns an event describing what happened. */
export function moveGoat(b, goat, roll) {
  const from = goatSpace(b, goat);
  let steps = roll;
  const muddy = inMud(b, from) && !GOATS[goat].mudImmune;
  const slowed = muddy || !!b.slows[goat];
  if (slowed && steps > 0) steps = Math.ceil(steps / 2);
  steps += b.boosts[goat] || 0;

  const arr = b.spaces[from];
  const carried = arr.splice(arr.indexOf(goat));
  if (arr.length === 0) delete b.spaces[from];
  const dest = from + steps;
  const ev = { goat, roll, steps, from, to: dest, slowed, carried: carried.slice(1), ram: false, finished: false };

  if (!b.ramUsed && dest >= b.cfg.ram && (from < b.cfg.ram || !b.cfg.ramCrossOnly) && !b.ears[goat]) {
    // The goat falls in love: riders stay on the landing space, the goat goes under the last goat.
    b.ramUsed = true;
    ev.ram = true;
    if (carried.length > 1) stackAt(b, dest).push(...carried.slice(1));
    const last = ranking(b).at(-1);
    if (last) b.spaces[goatSpace(b, last)].unshift(goat);
    else stackAt(b, dest).push(goat);
    ev.to = goatSpace(b, goat);
  } else {
    stackAt(b, dest).push(...carried);
  }
  if (Math.max(...Object.keys(b.spaces).map(Number)) > b.cfg.finish) {
    b.finished = true;
    ev.finished = true;
  }
  return ev;
}

export function resetStageBoard(b) {
  b.deck = shuffle(b, [...GOAT_IDS]);
  b.played = [];
  b.ramUsed = false;
  b.boosts = {};
  b.slows = {};
  b.ears = {};
}

// ---- tricks ----
export function trickOptions(b, card) {
  const goats = GOAT_IDS;
  const lvl = (g) => b.spaces[goatSpace(b, g)].indexOf(g);
  const notMoved = (g) => !b.played.includes(g);
  switch (card) {
    case "headbutt": return goats.filter((g) => lvl(g) >= 1).map((goat) => ({ goat }));
    case "snack": return goats.filter((g) => notMoved(g) && !b.boosts[g]).map((goat) => ({ goat }));
    case "mudslide": return goats.filter((g) => notMoved(g) && !b.slows[g]).map((goat) => ({ goat }));
    case "wobble": {
      const out = [];
      for (const k in b.spaces) if (b.spaces[k].length >= 2 && Number(k) > 1) out.push({ goat: b.spaces[k].at(-1) });
      return out;
    }
    case "swap": {
      const singles = goats.filter((g) => b.spaces[goatSpace(b, g)].length === 1);
      const out = [];
      for (let i = 0; i < singles.length; i++) for (let j = i + 1; j < singles.length; j++) out.push({ a: singles[i], b: singles[j] });
      return out;
    }
    case "earplugs": return goats.filter((g) => !b.ears[g]).map((goat) => ({ goat }));
    case "whistle": return b.deck.length > 1 ? [{ bury: false }, { bury: true }] : []; // UI: peek first, then choose
    case "cheer": return [{ goat: ranking(b)[0] }];
    default: return [];
  }
}

/** Board effect of a trick (cheer is scoring-only and handled by apply). */
export function applyTrickBoard(b, card, a) {
  switch (card) {
    case "headbutt": {
      const arr = b.spaces[goatSpace(b, a.goat)];
      const i = arr.indexOf(a.goat);
      [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
      break;
    }
    case "snack": b.boosts[a.goat] = 1; break;
    case "mudslide": b.slows[a.goat] = true; break;
    case "earplugs": b.ears[a.goat] = true; break;
    case "wobble": {
      const sp = goatSpace(b, a.goat);
      b.spaces[sp].pop();
      stackAt(b, sp - 1).push(a.goat);
      break;
    }
    case "swap": {
      const sa = goatSpace(b, a.a), sb = goatSpace(b, a.b);
      b.spaces[sa] = [a.b];
      b.spaces[sb] = [a.a];
      break;
    }
    case "whistle": if (a.bury) b.deck.push(b.deck.shift()); break;
    default: break;
  }
}

// ---- game setup ----
export function newGame({ players = 4, seed = 1, cfg = {} } = {}) {
  const c = { ...DEFAULT_CONFIG, ...cfg };
  const s = {
    cfg: c, rng: seed | 0, nPlayers: players, spaces: {}, deck: [], played: [], ramUsed: false,
    boosts: {}, slows: {}, ears: {}, finished: false, legStacks: {}, finalBets: [], trickDeck: [],
    discard: [], turn: 0, stage: 0, players: [],
    stats: { actions: {}, tricks: {}, ramTriggers: 0, stages: 0, runs: 0, mudSlowed: 0, leadChanges: 0, history: [], preFinal: null },
  };
  for (const g of shuffle(s, [...GOAT_IDS])) {
    const sp = Math.max(1, GOATS[g].die[randInt(s, 6)]);
    stackAt(s, sp).push(g);
  }
  for (const [card, n] of Object.entries(TRICK_COPIES)) for (let i = 0; i < n; i++) s.trickDeck.push(card);
  shuffle(s, s.trickDeck);
  for (let i = 0; i < players; i++) {
    s.players.push({ hay: c.startHay, src: { leg: 0, hoof: 0, cheer: 0, final: 0 }, hoofs: 0, legs: [], cheers: [], hand: [], finalsLeft: ["winner", "loser"], knownTop: null });
  }
  for (const p of s.players) for (let i = 0; i < c.startHand; i++) drawTrick(s, p);
  startStage(s);
  return s;
}

function drawTrick(s, p) {
  if (!s.trickDeck.length) {
    s.trickDeck = shuffle(s, s.discard);
    s.discard = [];
  }
  if (s.trickDeck.length) p.hand.push(s.trickDeck.pop());
}

function startStage(s) {
  resetStageBoard(s);
  s.stage++;
  s.stats.stages++;
  s.legStacks = {};
  for (const g of GOAT_IDS) s.legStacks[g] = [...s.cfg.legValues];
  for (const p of s.players) {
    p.hoofs = 0;
    p.legs = [];
    p.cheers = [];
    p.knownTop = null;
    if (s.stage > 1 && p.hand.length < s.cfg.handMax) drawTrick(s, p);
  }
}

const pay = (p, d, src) => {
  const before = p.hay;
  p.hay = Math.max(0, p.hay + d);
  if (src) p.src[src] += p.hay - before;
};

function scoreStage(s) {
  const rank = ranking(s);
  for (const p of s.players) {
    // Sum the stage first, then clamp at 0 once (clamping per token made the result depend on token order).
    const start = p.hay;
    let legD = 0, cheerD = 0;
    for (const leg of p.legs) legD += leg.goat === rank[0] ? leg.value : leg.goat === rank[1] ? 1 : -1;
    for (const c of p.cheers) if (rank[0] === c.goat) cheerD += s.cfg.cheerHay;
    const hoofD = p.hoofs * s.cfg.hoofHay;
    p.hay = Math.max(0, start + legD + hoofD + cheerD);
    p.src.leg += legD; p.src.hoof += hoofD; p.src.cheer += cheerD;
  }
  s.stats.history.push({ stage: s.stage, hays: s.players.map((q) => q.hay), leader: rank[0], progress: Math.max(...Object.keys(s.spaces).map(Number)) });
}

/** Hay a Summit Pledge placed right now would pay if correct: it shrinks as the race goes on. */
export function pledgeValue(s) {
  const v = s.cfg.pledgeValues;
  return v[Math.min(s.stage - 1, v.length - 1)];
}

function scoreFinal(s) {
  const rank = ranking(s);
  s.stats.preFinal = s.players.map((q) => q.hay);
  for (const bet of s.finalBets) {
    const target = bet.kind === "winner" ? rank[0] : rank.at(-1);
    pay(s.players[bet.player], bet.goat === target ? bet.value : -s.cfg.finalPenalty, "final");
  }
}

// ---- actions ----
export function legalActions(s, pi) {
  const p = s.players[pi];
  const acts = [];
  for (const g of GOAT_IDS) if (s.legStacks[g].length) acts.push({ type: "leg", goat: g });
  for (const card of new Set(p.hand)) for (const args of trickOptions(s, card)) acts.push({ type: "trick", card, args });
  acts.push({ type: "run" });
  if (s.deck.length > 1 && !p.knownTop) acts.push({ type: "scout" });
  const used = s.finalBets.filter((b) => b.player === pi).map((b) => b.goat);
  for (const kind of p.finalsLeft) for (const g of GOAT_IDS) if (!used.includes(g)) acts.push({ type: "final", goat: g, kind });
  return acts;
}

/** Apply the current player's action. Returns events for the UI/log. */
export function apply(s, act) {
  if (s.finished) throw new Error("game over");
  const pi = s.turn;
  const p = s.players[pi];
  const events = [{ t: "action", player: pi, act }];
  s.stats.actions[act.type] = (s.stats.actions[act.type] || 0) + 1;

  switch (act.type) {
    case "leg": {
      const value = s.legStacks[act.goat].shift();
      p.legs.push({ goat: act.goat, value });
      break;
    }
    case "trick": {
      const i = p.hand.indexOf(act.card);
      if (i < 0) throw new Error("card not in hand");
      p.hand.splice(i, 1);
      s.discard.push(act.card);
      s.stats.tricks[act.card] = (s.stats.tricks[act.card] || 0) + 1;
      if (act.card === "cheer") p.cheers.push({ goat: act.args.goat });
      else applyTrickBoard(s, act.card, act.args);
      if (act.card === "whistle") {
        // The caller saw s.deck[0] before choosing. Burying changes the top card, so old peeks go stale.
        if (act.args.bury) for (const q of s.players) q.knownTop = null;
        else p.knownTop = s.deck[0];
      }
      break;
    }
    case "scout": p.knownTop = s.deck[0]; break;
    case "final": {
      p.finalsLeft.splice(p.finalsLeft.indexOf(act.kind), 1);
      s.finalBets.push({ player: pi, goat: act.goat, kind: act.kind, value: pledgeValue(s) });
      break;
    }
    case "run": {
      const goat = s.deck.shift();
      s.played.push(goat);
      const roll = GOATS[goat].die[randInt(s, 6)];
      const leaderBefore = ranking(s)[0];
      const ev = moveGoat(s, goat, roll);
      if (ranking(s)[0] !== leaderBefore) s.stats.leadChanges++;
      ev.t = "move";
      events.push(ev);
      p.hoofs++;
      s.stats.runs++;
      if (ev.slowed) s.stats.mudSlowed++;
      if (ev.ram) s.stats.ramTriggers++;
      for (const q of s.players) q.knownTop = null;
      break;
    }
    default: throw new Error("unknown action " + act.type);
  }

  if (s.finished) {
    scoreStage(s);
    scoreFinal(s);
    events.push({ t: "end" });
  } else if (!s.deck.length) {
    scoreStage(s);
    events.push({ t: "stageEnd" });
    startStage(s);
    s.turn = (pi + 1) % s.nPlayers;
  } else {
    s.turn = (pi + 1) % s.nPlayers;
  }
  return events;
}
