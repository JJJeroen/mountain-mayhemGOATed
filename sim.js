// Monte-Carlo balance + "fun proxy" simulator.
//   node sim.js --games 600 --procs 8 --mode balance --n 16
// modes: balance (4 smart bots), skill (1 smart vs 3 random), random (4 random bots)
// overrides: --finish --ram --mudstart --mudend --pledges 10,8,7,6,5,4 --penalty 1 --legs 6,4,2
//            --quick (15-space track) --players 3 --margin 0.5 (bots' final-bet caution) --label text
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { newGame, apply, ranking, GOAT_IDS, TRICK_COPIES } from "./engine.js";
import { smartBot, randomBot } from "./bots.js";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const num = (k, d) => (args[k] === undefined ? d : Number(args[k]));
const list = (k) => String(args[k]).split(",").map(Number);

function cfgFromArgs() {
  const c = {};
  if (args.quick) { c.finish = 15; c.ram = 12; c.mud = [5, 7]; }
  if (args.finish) c.finish = num("finish");
  if (args.ram) c.ram = num("ram");
  if (args.mudstart || args.mudend) c.mud = [num("mudstart", 6), num("mudend", 8)];
  if (args.pledges) c.pledgeValues = list("pledges");
  if (args.penalty) c.finalPenalty = num("penalty");
  if (args.legs) c.legValues = list("legs");
  if (args.cheer) c.cheerHay = num("cheer");
  if (args.ramonce !== undefined) c.ramOnce = num("ramonce") === 1;
  if (args.ramcross !== undefined) c.ramCrossOnly = num("ramcross") === 1;
  return c;
}

const argmaxSet = (a) => { const m = Math.max(...a); return a.map((x, i) => (x === m ? i : -1)).filter((i) => i >= 0); };

function runGames(count, seedBase) {
  const mode = args.mode || "balance";
  const PL = num("players", 4);
  const n = num("n", 16);
  const sm = () => smartBot({ n, finalMargin: num("margin", 0.5), minProb: num("minprob", 0.55), maxTricks: 99 });
  const A = { games: 0, stages: 0, turns: 0, ramTriggers: 0, runs: 0, mudSlowed: 0, leadChanges: 0,
    actions: {}, tricks: {}, winGoat: {}, loseGoat: {}, seatWins: Array(num("players", 4)).fill(0), ties: 0, hayN: 0, haySum: 0,
    src: { leg: 0, hoof: 0, cheer: 0, final: 0 }, finalSwing: 0, finalSwingable: 0, winnerFirstAtMid: 0, leaderMidIsWinner: 0,
    marginSum: 0, decisions: 0, close03: 0, close01: 0, chosen: {}, trickHeld: {}, trickEvSum: {}, trickEvN: {}, trickChosen: {},
    botWins: 0, botGames: 0, finalsPlaced: 0, pledgeStageSum: 0 };
  for (const g of GOAT_IDS) A.winGoat[g] = A.loseGoat[g] = 0;
  for (let gi = 0; gi < count; gi++) {
    const s = newGame({ players: PL, seed: seedBase + gi, cfg: cfgFromArgs() });
    const special = gi % PL;
    const bots = Array.from({ length: PL }, (_, i) => i).map((i) => (mode === "balance" ? sm() : mode === "random" ? randomBot() : i === special ? sm() : randomBot()));
    let turns = 0;
    while (!s.finished && turns < 4000) {
      const who = s.turn;
      const act = bots[who](s, who);
      const info = bots[who].info;
      if (info) {
        A.decisions++;
        if (info.gap < 0.3) A.close03++;
        if (info.gap < 0.1) A.close01++;
        A.chosen[info.chosen] = (A.chosen[info.chosen] || 0) + 1;
        for (const card of new Set(info.hand)) {
          A.trickHeld[card] = (A.trickHeld[card] || 0) + 1;
          if (info.trickEv[card] !== undefined) {
            A.trickEvSum[card] = (A.trickEvSum[card] || 0) + info.trickEv[card];
            A.trickEvN[card] = (A.trickEvN[card] || 0) + 1;
          }
        }
      }
      apply(s, act);
      turns++;
    }
    if (!s.finished) continue;
    const rank = ranking(s);
    A.games++; A.stages += s.stats.stages; A.turns += turns;
    A.ramTriggers += s.stats.ramTriggers; A.runs += s.stats.runs; A.mudSlowed += s.stats.mudSlowed; A.leadChanges += s.stats.leadChanges;
    for (const k in s.stats.actions) A.actions[k] = (A.actions[k] || 0) + s.stats.actions[k];
    for (const k in s.stats.tricks) A.tricks[k] = (A.tricks[k] || 0) + s.stats.tricks[k];
    A.finalsPlaced += s.finalBets.length;
    for (const b of s.finalBets) A.pledgeStageSum += b.stage / s.stats.stages;
    A.winGoat[rank[0]]++; A.loseGoat[rank.at(-1)]++;
    const hays = s.players.map((p) => p.hay);
    const winners = argmaxSet(hays);
    if (winners.length > 1) A.ties++;
    for (const w of winners) A.seatWins[w] += 1 / winners.length;
    A.haySum += hays.reduce((a, b) => a + b, 0); A.hayN += hays.length;
    for (const p of s.players) for (const k in p.src) A.src[k] += p.src[k];
    const sorted = [...hays].sort((a, b) => b - a);
    A.marginSum += (sorted[0] - sorted[1]) / (hays.reduce((a, b) => a + b, 0) / PL || 1);
    const pre = argmaxSet(s.stats.preFinal);
    if (pre.length === 1 && winners.length === 1) { A.finalSwingable++; if (pre[0] !== winners[0]) A.finalSwing++; }
    const h = s.stats.history;
    if (h.length >= 2) {
      const mid = h[Math.floor((h.length - 1) / 2)];
      const rkMid = argmaxSet(mid.hays);
      if (winners.length === 1 && rkMid.includes(winners[0])) A.winnerFirstAtMid++;
      if (mid.leader === rank[0]) A.leaderMidIsWinner++;
    }
    if (mode === "skill") { A.botGames++; A.botWins += winners.includes(special) ? 1 / winners.length : 0; }
  }
  return A;
}

function merge(a, b) {
  if (typeof a === "number") return a + b;
  if (Array.isArray(a)) return a.map((x, i) => merge(x, b[i]));
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = a[k] === undefined ? b[k] : b[k] === undefined ? a[k] : merge(a[k], b[k]);
  return out;
}

function report(a) {
  const pct = (x, d) => ((100 * x) / (d || 1)).toFixed(1) + "%";
  const f = (x, d = 1) => (x).toFixed(d);
  const label = args.label ? ` [${args.label}]` : "";
  console.log(`\n=== ${args.mode || "balance"}${label}: ${a.games} games ===`);
  console.log(`LENGTH   stages ${f(a.stages / a.games)}  turns ${f(a.turns / a.games, 0)}  mean hay ${f(a.haySum / a.hayN)}  ties ${pct(a.ties, a.games)}`);
  console.log(`BOARD    Ram fires in ${pct(a.ramTriggers, a.stages)} of stages  mud-slowed ${pct(a.mudSlowed, a.runs)} of runs  winners: ${GOAT_IDS.map((g) => pct(a.winGoat[g], a.games)).join(" ")}`);
  const totalA = Object.values(a.actions).reduce((p, c) => p + c, 0);
  console.log(`ACTIONS  ${Object.entries(a.actions).map(([k, v]) => `${k} ${pct(v, totalA)}`).join("  ")}   finals placed/game ${f(a.finalsPlaced / a.games)}  avg pledge timing ${pct(a.pledgeStageSum, a.finalsPlaced)} of the way through`);
  const per = a.games * num("players", 4);
  console.log(`HAY/PLAYER/GAME  leg ${f(a.src.leg / per)}  hoof ${f(a.src.hoof / per)}  cheer ${f(a.src.cheer / per)}  final ${f(a.src.final / per)}`);
  console.log(`FUN      lead changes/race ${f(a.leadChanges / a.games)}  final bets flip the winner in ${pct(a.finalSwing, a.finalSwingable)}  winner already 1st at midpoint ${pct(a.winnerFirstAtMid, a.games)}  mid goat-leader wins race ${pct(a.leaderMidIsWinner, a.games)}`);
  console.log(`         avg winning margin ${f(a.marginSum / a.games, 2)}x mean hay   seats ${a.seatWins.map((x) => pct(x, a.games)).join(" ")}`);
  if (a.decisions) {
    console.log(`TENSION  close calls (best vs 2nd < 0.3 hay) ${pct(a.close03, a.decisions)}  (< 0.1) ${pct(a.close01, a.decisions)}`);
    const cards = Object.keys(TRICK_COPIES);
    console.log("TRICKS   card        plays/game  copies   avg best EV");
    for (const c of cards) {
      const held = a.trickHeld[c] || 0, evn = a.trickEvN[c] || 0;
      console.log(`         ${c.padEnd(10)}  ${f((a.tricks[c] || 0) / a.games, 2).padStart(8)}  ${String(TRICK_COPIES[c]).padStart(6)}   ${f((a.trickEvSum[c] || 0) / (evn || 1), 2).padStart(8)}`);
    }
  }
  if (a.botGames) console.log(`SKILL    smart bot win rate vs 3 random: ${pct(a.botWins, a.botGames)} (25% = no edge)`);
}

if (args.worker) {
  process.stdout.write(JSON.stringify(runGames(num("count"), num("seed"))));
} else {
  const games = num("games", 100), procs = num("procs", 4);
  const per = Math.ceil(games / procs);
  const skip = new Set(["--games", "--procs"]);
  const pass = process.argv.slice(2).filter((x, i, arr) => !skip.has(x) && !skip.has(arr[i - 1]));
  let pending = procs, total = null;
  for (let i = 0; i < procs; i++) {
    const child = fork(fileURLToPath(import.meta.url), [...pass, "--worker", "--count", String(per), "--seed", String(1000 + i * 100000)], { silent: true });
    let buf = "";
    child.stdout.on("data", (d) => (buf += d));
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("close", () => {
      const r = JSON.parse(buf);
      total = total ? merge(total, r) : r;
      if (--pending === 0) report(total);
    });
  }
}
