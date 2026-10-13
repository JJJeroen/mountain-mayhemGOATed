// Can a player exploit final bets by hedging? 1 hedger + 3 smart bots, hedger seat rotates.
//   node hedge.mjs --games 400 --procs 8 --k 5 --from 0 --kind winner [--payouts ..] [--penalty ..] [--cap ..]
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { newGame, apply, ranking, legalActions } from "./engine.js";
import { smartBot } from "./bots.js";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const num = (k, d) => (args[k] === undefined ? d : Number(args[k]));
const cfg = {};
if (args.payouts) cfg.finalPayouts = String(args.payouts).split(",").map(Number);
if (args.penalty) cfg.finalPenalty = num("penalty");
if (args.finalcap) cfg.finalCap = num("finalcap");
if (args.mode2) cfg.finalMode = args.mode2;

function hedger(smart, k, from, kind) {
  return (s, p) => {
    const me = s.players[p];
    const placed = s.finalBets.filter((b) => b.player === p).length;
    if (k > 0 && placed < k && s.stage >= from) {
      const legal = legalActions(s, p).filter((a) => a.type === "final" && a.kind === kind);
      if (legal.length) { // bet on the goats in current ranking order
        const rank = ranking(s);
        legal.sort((a, b) => rank.indexOf(kind === "winner" ? a.goat : b.goat) - rank.indexOf(kind === "winner" ? b.goat : a.goat));
        return legal[0];
      }
    }
    return smart(s, p);
  };
}

function run(count, seedBase) {
  const PL = num("players", 4), n = num("n", 12), k = num("k", 5), from = num("from", 1), kind = args.kind || "winner";
  const A = { games: 0, hedgeHay: 0, hedgeWins: 0, otherHay: 0, hedgeFinal: 0, otherFinal: 0, ties: 0 };
  for (let gi = 0; gi < count; gi++) {
    const s = newGame({ players: PL, seed: seedBase + gi, cfg: { finish: 15, ram: 12, mud: [5, 7], ...cfg } });
    const h = gi % PL;
    const bots = Array.from({ length: PL }, (_, i) => i).map((i) => { const sm = smartBot({ n, maxTricks: 99 }); return i === h ? hedger(sm, k, from, kind) : sm; });
    let t = 0;
    while (!s.finished && t < 4000) { const w = s.turn; apply(s, bots[w](s, w)); t++; }
    if (!s.finished) continue;
    const hays = s.players.map((q) => q.hay), m = Math.max(...hays);
    const wins = hays.map((x, i) => (x === m ? i : -1)).filter((i) => i >= 0);
    A.games++;
    A.hedgeHay += hays[h];
    A.otherHay += (hays.reduce((a, b) => a + b, 0) - hays[h]) / (PL - 1);
    A.hedgeFinal += s.players[h].src.final;
    A.otherFinal += (s.players.reduce((a, q) => a + q.src.final, 0) - s.players[h].src.final) / (PL - 1);
    if (wins.includes(h)) A.hedgeWins += 1 / wins.length;
    if (wins.length > 1) A.ties++;
  }
  return A;
}

if (args.worker) process.stdout.write(JSON.stringify(run(num("count"), num("seed"))));
else {
  const games = num("games", 200), procs = num("procs", 8), per = Math.ceil(games / procs);
  const skip = new Set(["--games", "--procs"]);
  const pass = process.argv.slice(2).filter((x, i, arr) => !skip.has(x) && !skip.has(arr[i - 1]));
  let pending = procs, T = null;
  for (let i = 0; i < procs; i++) {
    const c = fork(fileURLToPath(import.meta.url), [...pass, "--worker", "--count", String(per), "--seed", String(5000 + i * 100000)], { silent: true });
    let buf = ""; c.stdout.on("data", (d) => (buf += d)); c.stderr.on("data", (d) => process.stderr.write(d));
    c.on("close", () => {
      const r = JSON.parse(buf);
      T = T ? Object.fromEntries(Object.keys(r).map((k) => [k, T[k] + r[k]])) : r;
      if (--pending === 0) {
        const f = (x) => (x / T.games).toFixed(2);
        console.log(`[${args.label || ""}] k=${num("k", 5)} from=${num("from", 1)} kind=${args.kind || "winner"} games=${T.games}  hedger win ${(100 * T.hedgeWins / T.games).toFixed(1)}% (25=even)  hay hedger ${f(T.hedgeHay)} vs others ${f(T.otherHay)}  final-hay hedger ${f(T.hedgeFinal)} vs others ${f(T.otherFinal)}  ties ${(100 * T.ties / T.games).toFixed(1)}%`);
      }
    });
  }
}
