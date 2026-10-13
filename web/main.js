// Mountain Mayhem: GOATed - web UI. The engine decides rules; this file only renders and asks for actions.
import {
  GOAT_IDS, GOATS, newGame, legalActions, apply, ranking, goatSpace, trickOptions, pledgeValue, DEFAULT_CONFIG,
} from "./engine.js";
import { sfx, setSoundEnabled, unlockAudio } from "./sound.js";
import { goatSvg, ramSvg, avatarSvg, AVATARS, GOAT_BLURB } from "./art.js";

const $ = (id) => document.getElementById(id);
const COL = { blue: "#4f95e8", yellow: "#f7c52b", green: "#58b868", orange: "#f5882d", white: "#f8f4ee" };
const SPEEDS = { slow: 1.8, normal: 1, fast: 0.45 };
const mult = () => SPEEDS[settings.speed] ?? 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * mult()));
const gName = (g) => GOATS[g].name;
const ord = (n) => ["1st", "2nd", "3rd", "4th", "5th"][n] || n + "th";

const TRICKS = {
  headbutt: { name: "Headbutt", e: "🐐💥", d: "A goat riding on another swaps places with the goat beneath it." },
  snack: { name: "Snack", e: "🥕", d: "A goat that hasn't run this stage gets +1 to its run." },
  mudslide: { name: "Mud Slide", e: "🛝", d: "A goat that hasn't run this stage has its run halved." },
  wobble: { name: "Wobble", e: "🫨", d: "The top goat of a stack falls one space back." },
  swap: { name: "Swap Places", e: "🔀", d: "Two goats that stand alone trade spaces." },
  earplugs: { name: "Earplugs", e: "🎧", d: "A goat ignores the Ram this stage." },
  whistle: { name: "Whistle", e: "📯", d: "Peek at the next Herd card, then keep it on top or bury it." },
  cheer: { name: "Cheer", e: "📣", d: "Back the current leader: +2 hay at stage end if it still leads." },
};

// ---------------------------------------------------------------- settings
let settings = { name: "You", avatar: 0, opponents: 3, level: "normal", speed: "normal", sound: true, length: "quick" };
const LENGTHS = { quick: { finish: 15, ram: 12, mud: [5, 7] }, long: {} }; // quick = ~100 turns, long = ~150 (see sim notes)
try { Object.assign(settings, JSON.parse(localStorage.getItem("mm-settings") || "{}")); } catch { /* private mode */ }
if (settings.fast) settings.speed = "fast"; // migrate the old Normal/Fast switch
delete settings.fast;
setSoundEnabled(settings.sound);
const saveSettings = () => { try { localStorage.setItem("mm-settings", JSON.stringify(settings)); } catch { /* ignore */ } };
const LEVELS = { easy: { n: 8, nFinal: 8, nConfirm: 8, eps: 0.3 }, normal: { n: 16, nFinal: 12, nConfirm: 40, eps: 0.06 }, hard: { n: 36, nFinal: 20, nConfirm: 64, eps: 0 } };

// ---------------------------------------------------------------- game state
let s = null; // engine state
let seats = []; // [{name, avatar, human}]
let gen = 0; // bumped on new game so stale loops stop
let humanResolve = null;
const expr = {}; // goat -> {e, until}
const logLines = [];

// ---------------------------------------------------------------- bots (worker, with main-thread fallback)
let worker = null, workerDead = false, mainBots = {}, reqId = 0;
const pending = new Map();
function initWorker() {
  try {
    worker = new Worker("./bot-worker.js", { type: "module" });
    worker.onmessage = (e) => { const r = pending.get(e.data.id); if (r) { pending.delete(e.data.id); r(e.data.a); } };
    worker.onerror = () => { workerDead = true; for (const [, r] of pending) r(null); pending.clear(); };
  } catch { workerDead = true; }
}
async function botDecide(p) {
  const opts = LEVELS[settings.level];
  if (!workerDead) {
    const id = ++reqId;
    const a = await new Promise((res) => { pending.set(id, res); worker.postMessage({ id, s, p, opts }); });
    if (a) return a;
  }
  const { smartBot } = await import("./bots.js");
  mainBots[p] ||= smartBot(opts);
  return mainBots[p](s, p);
}

// ---------------------------------------------------------------- layout / board
const geo = { w: 0, h: 0, rowH: 0, colW: 0, topPad: 0, gw: 0, gh: 0, off: 0 };
const goatEls = {};
const ZONES = (c) => ({ meadow: [1, c.mud[0] - 1], mud: c.mud, climb: [c.mud[1] + 1, c.ram - 5], straight: [c.ram - 4, c.ram], sprint: [c.ram + 1, c.finish] });
function zoneOf(n, cfg) { for (const [z, [a, b]] of Object.entries(ZONES(cfg))) if (n >= a && n <= b) return z; return "meadow"; }

function cellPos(n) {
  // serpentine: 5 per row, row 0 at the bottom, even rows run left->right, odd rows right->left
  const idx = n - 1, row = Math.floor(idx / 5), k = idx % 5;
  const col = row % 2 === 0 ? k : 4 - k;
  const rows = Math.ceil(s.cfg.finish / 5);
  return { row, col, x: col * geo.colW, y: geo.topPad + (rows - 1 - row) * geo.rowH, rev: row % 2 === 1 };
}
function slotXY(space, level) {
  if (space > s.cfg.finish) {
    const rows = Math.ceil(s.cfg.finish / 5);
    const lastRowRev = (rows - 1) % 2 === 1;
    const col = lastRowRev ? 0 : 4;
    return { x: col * geo.colW + (geo.colW - geo.gw) / 2, y: geo.topPad - geo.gh * 0.45 - level * geo.off, rev: lastRowRev, z: 300 + level, row: rows };
  }
  const c = cellPos(Math.max(1, space));
  return { x: c.x + (geo.colW - geo.gw) / 2, y: c.y + geo.rowH - geo.gh - 6 - level * geo.off, rev: c.rev, z: 200 - c.row * 20 + level, row: c.row };
}

function skyHtml(w, h) {
  return `<svg class="sky" viewBox="0 0 400 600" preserveAspectRatio="none">
  <defs><linearGradient id="mt" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8aa4c4"/><stop offset="1" stop-color="#5f7d9f"/></linearGradient></defs>
  <g fill="#fff" opacity=".9" stroke="#3b2a22" stroke-width="2"><ellipse cx="60" cy="42" rx="34" ry="12"/><ellipse cx="90" cy="34" rx="22" ry="10"/><ellipse cx="320" cy="70" rx="38" ry="12"/><ellipse cx="350" cy="60" rx="22" ry="9"/></g>
  <path d="M-10 420 L80 210 L130 280 L200 120 L270 270 L320 200 L410 400 L410 610 L-10 610Z" fill="url(#mt)" stroke="#3b2a22" stroke-width="3"/>
  <path d="M200 120 L172 176 L190 168 L204 186 L216 166 L232 178Z M80 210 L62 248 L78 242 L92 252Z M320 200 L300 236 L316 230 L330 238Z" fill="#fff" stroke="#3b2a22" stroke-width="2"/>
  <path d="M-10 470 Q80 400 200 450 T410 440 L410 610 L-10 610Z" fill="#7fc46a" stroke="#3b2a22" stroke-width="3"/>
  ${[[30, 500], [360, 520], [340, 380], [50, 380]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0 -30 L12 -4 H-12z M0 -20 L16 8 H-16z" fill="#2f7d4a" stroke="#3b2a22" stroke-width="2"/><rect x="-3" y="8" width="6" height="8" fill="#6b4a35"/></g>`).join("")}
  </svg>`;
}

function buildBoard() {
  const b = $("board");
  const w = b.clientWidth, h = b.clientHeight;
  geo.w = w; geo.h = h;
  const rows = Math.ceil(s.cfg.finish / 5);
  geo.colW = w / 5;
  geo.topPad = Math.max(54, Math.min(96, h * 0.16));
  geo.rowH = (h - geo.topPad - 4) / rows;
  geo.gw = Math.min(geo.colW * 0.86, geo.rowH * 1.05, 84);
  geo.gh = (geo.gw * 116) / 138;
  geo.off = geo.gh * 0.4;
  let html = skyHtml(w, h);
  for (let n = 1; n <= s.cfg.finish; n++) {
    const c = cellPos(n);
    const z = zoneOf(n, s.cfg);
    html += `<div class="tile ${z}" style="left:${c.x + 2}px;top:${c.y + 2}px;width:${geo.colW - 4}px;height:${geo.rowH - 6}px"><span class="n">${n}</span></div>`;
  }
  // zone labels
  const zl = (n, text) => { const c = cellPos(n); return `<div class="zone" style="left:${c.x + geo.colW / 2}px;top:${c.y + geo.rowH - 17}px">${text}</div>`; };
  html += zl(s.cfg.mud[0] + 1, "MUD: half pace");
  // ram + finish
  const rc = cellPos(s.cfg.ram);
  const rw = Math.min(geo.colW * 1.35, 120), rh = (rw * 170) / 208;
  html += `<div class="ramspot" id="ram" style="left:${rc.x + geo.colW / 2 - rw / 2 + (rc.rev ? -rw * 0.28 : rw * 0.28)}px;top:${rc.y - rh + geo.rowH * 0.62}px;width:${rw}px;${rc.rev ? "" : "transform:scaleX(-1)"}">${ramSvg(rw)}</div>`;
  const lastRev = (rows - 1) % 2 === 1;
  html += `<div class="finish" style="left:${(lastRev ? 0 : 4) * geo.colW + 4}px;top:${geo.topPad - 36}px;width:${geo.colW - 8}px"><div class="flag"></div>FINISH</div>`;
  b.innerHTML = html;
  for (const g of GOAT_IDS) {
    const el = document.createElement("div");
    el.className = "goat";
    el.dataset.g = g;
    el.style.width = geo.gw + "px";
    el.innerHTML = `<div class="in"><div class="flip"></div></div><span class="tag">${gName(g)}</span>`;
    el.onclick = () => { el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 1600); };
    b.appendChild(el);
    goatEls[g] = el;
    el.dataset.key = "";
  }
}

function exprOf(g) {
  const x = expr[g];
  if (x && x.until > Date.now()) return x.e;
  return "neutral";
}
function setExpr(g, e, ms = 1800) {
  expr[g] = { e, until: Date.now() + ms };
  renderGoats();
  setTimeout(renderGoats, ms + 30);
}

function renderGoats() {
  if (!s) return;
  const rank = ranking(s);
  for (const g of GOAT_IDS) {
    const sp = goatSpace(s, g);
    const lvl = s.spaces[sp].indexOf(g);
    const p = slotXY(sp, lvl);
    const el = goatEls[g];
    const mud = sp >= s.cfg.mud[0] && sp <= s.cfg.mud[1];
    const e = exprOf(g);
    const key = `${e}|${mud}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.querySelector(".flip").innerHTML = goatSvg(g, e, { mud, size: geo.gw });
    }
    el.querySelector(".flip").style.transform = p.rev ? "scaleX(-1)" : "";
    el.style.transform = `translate(${p.x}px,${p.y}px)`;
    el.style.zIndex = p.z;
    el.classList.toggle("lead", rank[0] === g);
  }
}

function burst(g, text) {
  const el = goatEls[g];
  const m = /translate\(([-\d.]+)px,([-\d.]+)px\)/.exec(el.style.transform || "");
  const d = document.createElement("div");
  d.className = "burst";
  d.textContent = text;
  d.style.left = (m ? +m[1] + geo.gw / 2 : 0) + "px";
  d.style.top = (m ? +m[2] : 0) + "px";
  d.style.zIndex = 500;
  $("board").appendChild(d);
  setTimeout(() => d.remove(), 1500);
}
function hop(g) {
  const i = goatEls[g].querySelector(".in");
  i.classList.remove("hop"); void i.offsetWidth; i.classList.add("hop");
}
function shake(g) {
  const i = goatEls[g].querySelector(".in");
  i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake");
}

// ---------------------------------------------------------------- HUD
function renderHud() {
  $("stageNo").textContent = s.stage;
  const me = s.players[0];
  // herd cards
  let h = "";
  const played = s.played;
  for (const g of played) h += `<div class="hcard played">${goatSvg(g, "neutral", { size: 24 })}</div>`;
  for (let i = 0; i < s.deck.length; i++) {
    const known = i === 0 && me.knownTop;
    h += known ? `<div class="hcard known">${goatSvg(me.knownTop, "neutral", { size: 24 })}</div>` : `<div class="hcard"></div>`;
  }
  $("herd").innerHTML = h;
  const sc = $("scouted");
  if (me.knownTop) { sc.hidden = false; sc.innerHTML = `👀 ${gName(me.knownTop)}`; } else sc.hidden = true;

  // players
  $("players").innerHTML = s.players.map((p, i) => {
    const legs = p.legs.map((l) => `<span class="dot" style="background:${COL[l.goat]}">${l.value}</span>`).join("");
    const hoofs = p.hoofs ? `<span class="dot hoof">👣${p.hoofs}</span>` : "";
    const fin = s.finalBets.filter((b) => b.player === i).length;
    const finTag = fin ? `<span class="dot" style="background:#ffcfb8">🎯${fin}</span>` : "";
    return `<div class="pl ${s.turn === i ? "active" : ""} ${i === 0 ? "you" : ""}">${avatarSvg(seats[i].avatar, 34)}<div><div class="nm">${esc(seats[i].name)}</div><div class="hay">${p.hay}<small> hay</small></div></div><div class="tk">${legs}${hoofs}${finTag}</div></div>`;
  }).join("");

  // leg bets
  const rank = ranking(s);
  const myTurn = humanTurn();
  $("bets").innerHTML = GOAT_IDS.map((g) => {
    const rem = s.legStacks[g];
    const taken = [];
    s.players.forEach((p, i) => p.legs.forEach((l) => { if (l.goat === g) taken.push({ i, v: l.value }); }));
    const toks = s.cfg.legValues.map((v, idx) => `<span class="tok ${idx < s.cfg.legValues.length - rem.length ? "gone" : ""}" style="--c:${COL[g]}">${v}</span>`).join("");
    const holders = taken.map((t) => `<i>${t.i === 0 ? "you" : esc(seats[t.i].name.slice(0, 3))}${t.v}</i>`).join("");
    const can = myTurn && rem.length;
    return `<button class="bet ${can ? "can" : "dis"}" data-g="${g}" ${can ? "" : "disabled"}><span class="rk">${ord(rank.indexOf(g))}</span>${goatSvg(g, "neutral", { size: 44 }).replace("<svg ", '<svg class="g" ')}<div class="stack">${toks}</div><div class="holders">${holders}</div></button>`;
  }).join("");
  document.querySelectorAll(".bet.can").forEach((b) => (b.onclick = () => submit({ type: "leg", goat: b.dataset.g })));

  // actions
  const legal = myTurn ? legalActions(s, 0) : [];
  const canTrick = legal.some((a) => a.type === "trick");
  const canScout = legal.some((a) => a.type === "scout");
  const canFinal = legal.some((a) => a.type === "final");
  $("actions").innerHTML = `
    <div class="hint">${s.finished ? "" : myTurn ? "Your turn: tap a goat above to bet, or choose an action" : `<span class="turnb">${avatarSvg(seats[s.turn].avatar, 24)}<b>${esc(seats[s.turn].name)}</b> is thinking…</span>`}</div>
    <button class="abtn run" id="aRun" ${myTurn ? "" : "disabled"}><span class="ic">🏃</span>Run</button>
    <button class="abtn trick" id="aTrick" ${canTrick ? "" : "disabled"}><span class="ic">🃏</span>Trick (${me.hand.length})</button>
    <button class="abtn scout" id="aScout" ${canScout ? "" : "disabled"}><span class="ic">👀</span>Scout</button>
    <button class="abtn final" id="aFinal" ${canFinal ? "" : "disabled"}><span class="ic">🎯</span>Pledge (${me.finalsLeft.length})</button>`;
  $("aRun").onclick = () => submit({ type: "run" });
  $("aScout").onclick = () => submit({ type: "scout" });
  $("aTrick").onclick = openTricks;
  $("aFinal").onclick = openFinal;
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const humanTurn = () => !!humanResolve;

function toast(html, ms = 1500) {
  const t = document.createElement("div");
  t.className = "tst";
  t.innerHTML = html;
  $("toast").appendChild(t);
  ms *= Math.max(1, mult());
  setTimeout(() => t.classList.add("out"), ms);
  setTimeout(() => t.remove(), ms + 450);
}
function log(text) { logLines.push(`Stage ${s ? s.stage : 1}: ${text}`); if (logLines.length > 80) logLines.shift(); }

// ---------------------------------------------------------------- sheets
function openSheet(html, { dismiss = true } = {}) {
  const sh = $("sheet");
  sh.hidden = false;
  sh.innerHTML = `<div class="panel">${dismiss ? '<button class="x" id="shX" aria-label="Close">✕</button>' : ""}${html}</div>`;
  if (dismiss) { $("shX").onclick = closeSheet; sh.onclick = (e) => { if (e.target === sh) closeSheet(); }; }
  else sh.onclick = null;
  return sh.querySelector(".panel");
}
function closeSheet() { $("sheet").hidden = true; $("sheet").innerHTML = ""; }

function goatPickCard(g, extra = "") {
  const sp = goatSpace(s, g);
  const lvl = s.spaces[sp].indexOf(g);
  const where = sp > s.cfg.finish ? "over the line" : `space ${sp}${s.spaces[sp].length > 1 ? `, ${ord(lvl)} from bottom` : ""}`;
  return `<button class="card pick" data-g="${g}">${goatSvg(g, "neutral", { size: 80 })}<b>${gName(g)}</b><span>${where}${extra}</span></button>`;
}

function openTricks() {
  const me = s.players[0];
  const uniq = [...new Set(me.hand)];
  const html = `<h2>Play a trick</h2><p class="sub">One card, face up, then your turn is over. Hand: ${me.hand.length}/${s.cfg.handMax}.</p><div class="grid g2">${uniq.map((c) => {
    const n = me.hand.filter((x) => x === c).length;
    const ok = trickOptions(s, c).length > 0;
    return `<button class="card" data-c="${c}" ${ok ? "" : "disabled"}><span class="big">${TRICKS[c].e}</span><div><b>${TRICKS[c].name}${n > 1 ? " ×" + n : ""}</b><span>${TRICKS[c].d}</span></div></button>`;
  }).join("")}</div>`;
  const p = openSheet(html);
  p.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => pickTrickTarget(b.dataset.c)));
}

function pickTrickTarget(card) {
  const opts = trickOptions(s, card);
  const T = TRICKS[card];
  const back = `<p><button class="btn alt" id="bk">← Back</button></p>`;
  const wire = (p) => { const bk = p.querySelector("#bk"); if (bk) bk.onclick = openTricks; return p; };
  if (card === "cheer") {
    const g = opts[0].goat;
    const p = openSheet(`<h2>${T.e} ${T.name}</h2><p>${T.d}</p><p>Current leader: <b>${gName(g)}</b></p><div class="row"><button class="btn go" id="ok">Cheer for ${gName(g)}</button></div>${back}`);
    p.querySelector("#ok").onclick = () => { closeSheet(); submit({ type: "trick", card, args: { goat: g } }); };
    return wire(p);
  }
  if (card === "whistle") {
    const top = s.deck[0];
    const p = openSheet(`<h2>${T.e} ${T.name}</h2><p>You peek: the next goat to run is...</p><div class="center">${goatSvg(top, "neutral", { size: 140 })}<p><b>${gName(top)}</b></p></div><p>Keep it on top, or bury it at the bottom of the Herd deck?</p><div class="row"><button class="btn go" id="keep">Keep on top</button><button class="btn" id="bury">Bury it</button></div><p class="sub">Others see that you whistled, not what you saw.</p>`, { dismiss: false });
    p.querySelector("#keep").onclick = () => { closeSheet(); submit({ type: "trick", card, args: { bury: false } }); };
    p.querySelector("#bury").onclick = () => { closeSheet(); submit({ type: "trick", card, args: { bury: true } }); };
    return;
  }
  if (card === "swap") {
    const singles = [...new Set(opts.flatMap((o) => [o.a, o.b]))];
    const p = openSheet(`<h2>${T.e} ${T.name}</h2><p>Pick the first goat:</p><div class="grid g3">${singles.map((g) => goatPickCard(g)).join("")}</div>${back}`);
    p.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.g;
      const partners = opts.filter((o) => o.a === a || o.b === a).map((o) => (o.a === a ? o.b : o.a));
      const p2 = openSheet(`<h2>${T.e} ${T.name}</h2><p>Swap ${gName(a)} with:</p><div class="grid g3">${partners.map((g) => goatPickCard(g)).join("")}</div>${back}`);
      p2.querySelectorAll("[data-g]").forEach((b2) => (b2.onclick = () => { closeSheet(); submit({ type: "trick", card, args: { a, b: b2.dataset.g } }); }));
      wire(p2);
    }));
    return wire(p);
  }
  const labels = { headbutt: "Pick the goat that gets pushed down (it swaps with the goat beneath it):", wobble: "Pick the stack's top goat to fall one space back:", snack: "Who gets the snack (+1)?", mudslide: "Whose run gets halved?", earplugs: "Who ignores the Ram this stage?" };
  const extra = (g) => {
    if (card !== "headbutt") return "";
    const arr = s.spaces[goatSpace(s, g)];
    return `<br>sits on ${gName(arr[arr.indexOf(g) - 1])}`;
  };
  const p = openSheet(`<h2>${T.e} ${T.name}</h2><p>${labels[card]}</p><div class="grid g3">${opts.map((o) => goatPickCard(o.goat, extra(o.goat))).join("")}</div>${back}`);
  p.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => { closeSheet(); submit({ type: "trick", card, args: { goat: b.dataset.g } }); }));
  wire(p);
}

function openFinal() {
  const me = s.players[0];
  let kind = me.finalsLeft[0];
  const mine = s.finalBets.filter((b) => b.player === 0);
  const draw = () => {
    const goats = legalActions(s, 0).filter((a) => a.type === "final" && a.kind === kind).map((a) => a.goat);
    const placed = mine.length ? `<h3>Your secret pledges</h3><div class="row">${mine.map((b) => `<span class="pill" style="opacity:1">${b.kind === "winner" ? "🏆" : "🐌"} ${goatSvg(b.goat, "neutral", { size: 22 })} ${gName(b.goat)} <small>(${b.value})</small></span>`).join("")}</div>` : "";
    const p = openSheet(`<h2>🎯 Summit pledge</h2><p>Secretly pledge who wins or loses the whole race. You get <b>one Winner and one Loser pledge</b> per game and <b>it can never be taken back</b>. Pledging now pays <b>${pledgeValue(s)} hay</b> if right (it shrinks every stage: ${s.cfg.pledgeValues.join(" / ")}); wrong costs ${s.cfg.finalPenalty}.</p>
      <div class="seg" id="seg">${me.finalsLeft.map((k) => `<button data-k="${k}" class="${kind === k ? "on" : ""}">${k === "winner" ? "🏆 Winner" : "🐌 Loser"}</button>`).join("")}</div>
      <div class="grid g3" style="margin-top:10px">${goats.map((g) => goatPickCard(g)).join("")}</div>${placed}`);
    p.querySelectorAll("#seg button").forEach((b) => (b.onclick = () => { kind = b.dataset.k; draw(); }));
    p.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => { closeSheet(); submit({ type: "final", goat: b.dataset.g, kind }); }));
  };
  draw();
}

function openLog() {
  openSheet(`<h2>Game log</h2><div class="log">${logLines.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join("") || "<p>Nothing yet.</p>"}</div>`);
}

function openHelp() {
  const c = s ? s.cfg : DEFAULT_CONFIG;
  openSheet(`<h2>How to play</h2>
  <div class="rules">
  <p>Five goats race up the mountain. Nobody owns a goat: <b>everyone bets on all of them</b>. Most <b>hay</b> wins.</p>
  <h3>The path</h3>
  <ul><li>${c.finish} spaces then the finish. A goat that ends on a crowded space <b>climbs on top</b>; a goat carries everyone on its back.</li>
  <li><b>Mud</b> (spaces ${c.mud[0]}-${c.mud[1]}): a goat starting its move there goes half as far. Mudlark doesn't care.</li>
  <li><b>The Ram</b> (space ${c.ram}): the first goat each stage to <i>cross</i> it falls in love and drops <i>under</i> the last-place goat. Its riders stay put!</li></ul>
  <h3>A stage = five Herd cards</h3>
  <p>Every goat runs exactly once per stage, in random order. On your turn do <b>one</b> thing:</p>
  <div class="tlist">
   <div class="tl"><span class="e">🪙</span><span><b>Leg bet</b>: tap a goat's token (6, then 4, then 2). Leader at stage end pays the token, 2nd place pays 1, otherwise you lose 1.</span></div>
   <div class="tl"><span class="e">🏃</span><span><b>Run</b>: flip the next Herd card and move that goat with its own die. You earn a hoof token: +1 hay at stage end.</span></div>
   <div class="tl"><span class="e">🃏</span><span><b>Trick</b>: play a card to meddle (see the cards when you open it).</span></div>
   <div class="tl"><span class="e">👀</span><span><b>Scout</b>: secretly peek at which goat runs next.</span></div>
   <div class="tl"><span class="e">🎯</span><span><b>Summit pledge</b>: secretly pledge a goat as the overall winner and another as the loser (once each per game). A correct pledge pays ${c.pledgeValues.join("/")} depending on the stage you made it, so early is worth more; wrong costs ${c.finalPenalty}.</span></div>
  </div>
  <h3>The goats' dice</h3>
  <div class="tlist">${GOAT_IDS.map((g) => `<div class="tl"><span>${goatSvg(g, "neutral", { size: 34 })}</span><span><b>${gName(g)}</b>: ${GOATS[g].die.join(" ")}<br><small>${GOAT_BLURB[g].split(": ")[1]}</small></span></div>`).join("")}</div>
  <p>The race ends when a goat crosses the finish line. Then the pledges are revealed.</p></div>
  <div class="center"><button class="btn go" id="hOk">Got it</button></div>`);
  $("hOk").onclick = closeSheet;
}

// ---------------------------------------------------------------- overlays
function showOverlay(html, { center = true } = {}) {
  const o = $("overlay");
  o.hidden = false;
  o.innerHTML = html;
  return o;
}
function hideOverlay() { $("overlay").hidden = true; $("overlay").innerHTML = ""; }

async function showRoll(ev, pi) {
  const die = GOATS[ev.goat].die;
  const o = showOverlay(`<div class="rollbox"><div>${goatSvg(ev.goat, "effort", { size: 130 }).replace("<svg ", '<svg class="gt" ')}</div><b>${gName(ev.goat)} runs!</b>${pi === undefined ? "" : `<small class="by">${esc(seatLabel(pi))}'s run</small>`}<div><span class="die roll" id="dv">?</span></div><div class="note" id="dn"></div></div>`);
  const dv = o.querySelector("#dv");
  for (let i = 0; i < 6; i++) { dv.textContent = die[(Math.random() * 6) | 0]; sfx("tick"); await sleep(80); }
  dv.classList.remove("roll");
  dv.textContent = ev.roll;
  sfx("coin");
  let note = "";
  if (ev.slowed) note = ev.steps !== ev.roll ? `🟤 slowed to ${ev.steps}!` : "";
  if (!ev.slowed && ev.steps > ev.roll) note = `🥕 +1 snack → ${ev.steps}`;
  if (ev.slowed && ev.steps > Math.ceil(ev.roll / 2)) note += ` 🥕 +1 → ${ev.steps}`;
  o.querySelector("#dn").textContent = note || (ev.roll === 0 ? "Goes nowhere. Typical." : "");
  await sleep(ev.slowed || ev.steps !== ev.roll ? 900 : 650);
  hideOverlay();
}

function confetti() {
  sfx("win");
  const c = document.createElement("div");
  c.className = "confetti";
  const cols = ["#ff6a3d", "#ffd34a", "#4f95e8", "#58b868", "#ff7aa8", "#fff"];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "%";
    p.style.background = cols[i % cols.length];
    p.style.animationDuration = 2 + Math.random() * 2.5 + "s";
    p.style.animationDelay = Math.random() * 0.8 + "s";
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 5500);
}

const seatLabel = (i) => (i === 0 ? "You" : seats[i].name);

async function showStageScore(before, hayAfter, rank) {
  sfx("stage");
  const rows = s.players.map((p, i) => {
    const pills = [];
    for (const l of before[i].legs) {
      const d = l.goat === rank[0] ? l.value : l.goat === rank[1] ? 1 : -1;
      pills.push({ d, html: `${goatSvg(l.goat, "neutral", { size: 20 })} ${d > 0 ? "+" : ""}${d}` });
    }
    if (before[i].hoofs) pills.push({ d: before[i].hoofs, html: `👣 +${before[i].hoofs}` });
    for (const c of before[i].cheers) { const ok = rank[0] === c.goat; pills.push({ d: ok ? 2 : 0, html: `📣 ${ok ? "+2" : "0"}` }); }
    return { pills, net: hayAfter[i] - before[i].hay };
  });
  const rk = rank.map((g, i) => `<div>${goatSvg(g, i === 0 ? "love" : "neutral", { size: 52 })}${ord(i)}</div>`).join("");
  const o = showOverlay(`<div class="panel"><h2>Stage ${s.stage - (s.finished ? 0 : 1)} complete</h2><div class="rank">${rk}</div>
    ${rows.map((r, i) => `<div class="srow">${avatarSvg(seats[i].avatar, 42)}<div><b>${esc(seatLabel(i))}</b><div class="det">${r.pills.map((p, k) => `<span class="pill ${p.d > 0 ? "pos" : p.d < 0 ? "neg" : ""}" style="animation-delay:${(i * 5 + k) * 0.07 + 0.2}s">${p.html}</span>`).join("") || "<small>nothing</small>"}</div></div><div class="tot ${r.net > 0 ? "pos" : r.net < 0 ? "neg" : ""}" id="t${i}">0</div></div>`).join("")}
    <div class="center" style="margin-top:10px"><button class="btn go" id="nx">${s.finished ? "Reveal pledges" : "Next stage"}</button></div></div>`);
  rows.forEach((r, i) => countUp(o.querySelector("#t" + i), r.net, 900 + i * 100));
  await new Promise((res) => (o.querySelector("#nx").onclick = res));
  hideOverlay();
}
function countUp(el, to, ms) {
  const t0 = performance.now();
  const f = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const v = Math.round(to * k);
    el.textContent = (v > 0 ? "+" : "") + v;
    if (k < 1 && el.isConnected) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

async function showFinal(preFinal) {
  sfx("stage");
  const rank = ranking(s);
  const winner = rank[0], loser = rank.at(-1);
  const reveals = s.finalBets.map((b) => {
    const target = b.kind === "winner" ? winner : loser;
    const ok = b.goat === target;
    return { ...b, ok, d: ok ? b.value : -s.cfg.finalPenalty };
  });
  const o = showOverlay(`<div class="panel"><h2>The race is over!</h2>
    <div class="rank"><div>${goatSvg(winner, "love", { size: 90 })}🏆 ${gName(winner)}</div><div>${goatSvg(loser, "dizzy", { size: 90 })}🐌 ${gName(loser)}</div></div>
    <h3>Summit pledges, in the order placed</h3><div id="rv" class="tlist"></div><div id="st"></div></div>`);
  const rv = o.querySelector("#rv");
  const run = [...preFinal];
  for (const r of reveals) {
    run[r.player] = Math.max(0, run[r.player] + r.d);
    const div = document.createElement("div");
    div.className = "srow";
    div.innerHTML = `${avatarSvg(seats[r.player].avatar, 42)}<div><b>${esc(seatLabel(r.player))}</b><div class="det"><span class="pill ${r.ok ? "pos" : "neg"}" style="animation-delay:.1s">${r.kind === "winner" ? "🏆" : "🐌"} ${goatSvg(r.goat, "neutral", { size: 20 })} ${gName(r.goat)} ${r.ok ? "✔" : "✘"}</span></div></div><div class="tot ${r.ok ? "pos" : "neg"}">${r.d > 0 ? "+" : ""}${r.d}</div>`;
    rv.appendChild(div);
    div.scrollIntoView({ block: "nearest" });
    await sleep(650);
  }
  if (!reveals.length) rv.innerHTML = "<p>Nobody made a pledge. Brave. Or lazy.</p>";
  // Tiebreak (decision 2026-10-12): equal hay -> most correct pledges; still equal -> shared win.
  const correct = s.players.map((_, i) => reveals.filter((r) => r.player === i && r.ok).length);
  const order = s.players.map((p, i) => ({ i, hay: p.hay })).sort((a, b) => b.hay - a.hay || correct[b.i] - correct[a.i]);
  const top = order[0].hay;
  const tiedTop = order.filter((x) => x.hay === top);
  const bestC = Math.max(...tiedTop.map((x) => correct[x.i]));
  const winners = tiedTop.filter((x) => correct[x.i] === bestC);
  o.querySelector("#st").innerHTML = `<h3>Final standings</h3>${order.map((x, k) => `<div class="stand ${winners.some((w) => w.i === x.i) ? "win" : ""}"><b>${winners.some((w) => w.i === x.i) ? "👑" : k + 1}</b>${avatarSvg(seats[x.i].avatar, 54)}<div><b>${esc(seatLabel(x.i))}</b><br><small>${preFinal[x.i]} before pledges</small></div><span class="hv">${x.hay}</span></div>`).join("")}
    <p class="center"><b>${winners.length > 1 ? "It's a tie! " + winners.map((w) => seatLabel(w.i)).join(" & ") + " share the hay." : (winners[0].i === 0 ? "You win!" : esc(seats[winners[0].i].name) + " wins.")}</b></p>
    <div class="row" style="justify-content:center"><button class="btn go" id="again">Play again</button><button class="btn alt" id="menu">Menu</button></div>`;
  if (winners.some((w) => w.i === 0)) confetti();
  o.querySelector("#st").scrollIntoView({ behavior: "smooth", block: "end" });
  o.querySelector("#again").onclick = () => { hideOverlay(); startGame(); };
  o.querySelector("#menu").onclick = () => { hideOverlay(); showStart(); };
}

// ---------------------------------------------------------------- turn loop
function submit(act) {
  if (!humanResolve) return;
  const r = humanResolve;
  humanResolve = null;
  closeSheet();
  r(act);
}

function describe(ev, pi) {
  const who = seatLabel(pi);
  const a = ev.act;
  const you = pi === 0;
  switch (a.type) {
    case "leg": return `${who} bet${you ? "" : "s"} on ${gName(a.goat)}`;
    case "scout": return `${who} scouted the next card`;
    case "final": return `${who} made a secret summit pledge`;
    case "run": return `${who} ${you ? "run" : "runs"} the herd`;
    case "trick": {
      const T = TRICKS[a.card].name;
      const g = a.args?.goat;
      if (a.card === "swap") return `${who} played ${T}: ${gName(a.args.a)} ⇄ ${gName(a.args.b)}`;
      if (a.card === "whistle") return `${who} whistled (peeked at the next card)`;
      return `${who} played ${T}${g ? " on " + gName(g) : ""}`;
    }
  }
  return "";
}
function actionIcon(a) {
  return { leg: "🪙", run: "🏃", scout: "👀", final: "🎯", trick: TRICKS[a.card]?.e || "🃏" }[a.type];
}

async function playTurn(myGen) {
  const pi = s.turn;
  let act;
  renderHud();
  if (seats[pi].human) {
    sfx("yourTurn");
    act = await new Promise((res) => { humanResolve = res; renderHud(); });
  } else {
    $("toast").innerHTML = ""; // drop the previous player's message so it is clear whose turn this is
    const t0 = performance.now();
    act = await botDecide(pi);
    await new Promise((r) => setTimeout(r, Math.max(0, 1100 * mult() - (performance.now() - t0))));
  }
  if (myGen !== gen) return false;
  const before = s.players.map((p) => ({ legs: p.legs.map((l) => ({ ...l })), hoofs: p.hoofs, cheers: p.cheers.map((c) => ({ ...c })), hay: p.hay }));
  const leaderBefore = ranking(s)[0];
  const stageBefore = s.stage;
  const events = apply(s, act);
  const head = events[0];
  const text = describe(head, pi);
  log(text);
  toast(`${avatarSvg(seats[pi].avatar, 28)}<span>${esc(text)} ${actionIcon(act)}</span>`, 2200);
  sfx(act.type === "leg" ? "coin" : act.type === "final" ? "pledge" : act.type === "trick" ? "trick" : act.type === "scout" ? "scout" : "click");
  if (!seats[pi].human) { renderHud(); await sleep(1100); } // let the player read who did what before the roll covers it
  if (myGen !== gen) return false;

  for (const ev of events) {
    if (ev.t === "move") {
      await showRoll(ev, act.type === "run" ? pi : undefined);
      if (myGen !== gen) return false;
      setExpr(ev.goat, ev.ram ? "love" : ev.slowed ? "effort" : "effort", ev.ram ? 2600 : 1400);
      hop(ev.goat);
      sfx(ev.slowed ? "mud" : "land");
      renderGoats();
      renderHud();
      log(`${gName(ev.goat)} rolled ${ev.roll}${ev.slowed ? " (slowed)" : ""} and moved ${ev.from} → ${ev.to > s.cfg.finish ? "FINISH" : ev.to}${ev.carried.length ? ", carrying " + ev.carried.map(gName).join(", ") : ""}`);
      if (ev.slowed) burst(ev.goat, "💩");
      await sleep(850);
      if (myGen !== gen) return false;
      if (ev.ram) {
        $("ram").classList.remove("swoon"); void $("ram").offsetWidth; $("ram").classList.add("swoon");
        toast(`<span>💘 ${gName(ev.goat)} fell for the Ram and goes to last place!</span>`, 2300);
        log(`${gName(ev.goat)} fell for the Ram`);
        burst(ev.goat, "💕");
        sfx("ram");
        await sleep(1500);
        if (myGen !== gen) return false;
      }
    }
  }
  if (act.type === "trick") await animateTrick(act);
  if (myGen !== gen) return false;
  renderGoats();
  renderHud();
  const rankNow = ranking(s)[0];
  if (rankNow !== leaderBefore) { const el = goatEls[rankNow]; if (el) burst(rankNow, "👑"); }

  const stageEnded = events.some((e) => e.t === "stageEnd");
  const ended = events.some((e) => e.t === "end");
  if (stageEnded || ended) {
    const stageRank = ranking(s);
    const hayAfterStage = ended ? s.stats.history.at(-1).hays : s.players.map((p) => p.hay);
    await sleep(500);
    if (myGen !== gen) return false;
    await showStageScore(before, hayAfterStage, stageRank);
    if (myGen !== gen) return false;
    if (ended) { await showFinal(s.stats.preFinal); return false; }
    renderGoats(); renderHud();
    toast(`<span>🌄 Stage ${s.stage} begins. New Herd deck shuffled!</span>`, 1800);
  }
  if (!seats[pi].human) await sleep(450);
  return !s.finished;
}

async function animateTrick(act) {
  const a = act.args || {};
  const goats = [a.goat, a.a, a.b].filter(Boolean);
  if (act.card === "wobble" || act.card === "headbutt") for (const g of goats) { setExpr(g, "dizzy", 1800); shake(g); burst(g, "💫"); }
  else if (act.card === "swap") for (const g of goats) { setExpr(g, "dizzy", 1400); hop(g); }
  else if (act.card === "snack") { setExpr(a.goat, "love", 1600); burst(a.goat, "🥕"); }
  else if (act.card === "mudslide") { setExpr(a.goat, "effort", 1600); burst(a.goat, "🟤"); }
  else if (act.card === "earplugs") burst(a.goat, "🎧");
  else if (act.card === "cheer") burst(a.goat, "📣");
  renderGoats();
  await sleep(goats.length ? 900 : 300);
}

async function gameLoop(myGen) {
  while (myGen === gen && s && !s.finished) {
    const cont = await playTurn(myGen);
    if (!cont) break;
  }
}

// ---------------------------------------------------------------- start
function pickOpponents(n, mine) {
  const pool = AVATARS.map((_, i) => i).filter((i) => i !== mine);
  for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}
function settingsRows() {
  const seg = (id, key, items) => `<div class="seg" id="${id}">${items.map(([v, t]) => `<button data-v="${v}" class="${String(settings[key]) === String(v) ? "on" : ""}">${t}</button>`).join("")}</div>`;
  return `<label class="l">Game speed</label>${seg("spd", "speed", [["slow", "🐢 Slow"], ["normal", "Normal"], ["fast", "🐇 Fast"]])}
      <label class="l">Sound effects</label>${seg("snd", "sound", [[true, "🔊 On"], [false, "🔇 Off"]])}`;
}
function wireSettings(root, redraw) {
  root.querySelectorAll("#spd button").forEach((b) => (b.onclick = () => { settings.speed = b.dataset.v; saveSettings(); redraw(); }));
  root.querySelectorAll("#snd button").forEach((b) => (b.onclick = () => {
    settings.sound = b.dataset.v === "true"; setSoundEnabled(settings.sound); saveSettings(); unlockAudio(); redraw(); sfx("coin");
  }));
}
function openSettings() {
  const draw = () => { const p = openSheet(`<h2>⚙ Settings</h2><div style="text-align:left">${settingsRows()}</div>`); wireSettings(p, draw); };
  draw();
}

function startGame() {
  gen++;
  const myGen = gen;
  const n = settings.opponents + 1;
  s = newGame({ players: n, seed: (Math.random() * 2 ** 31) | 0, cfg: LENGTHS[settings.length] || {} });
  const opp = pickOpponents(n - 1, settings.avatar);
  seats = [{ name: settings.name || "You", avatar: settings.avatar, human: true }, ...opp.map((a) => ({ name: AVATARS[a].name, avatar: a, human: false }))];
  logLines.length = 0;
  for (const g of GOAT_IDS) delete expr[g];
  humanResolve = null;
  mainBots = {};
  if (!worker && !workerDead) initWorker();
  closeSheet(); hideOverlay();
  $("toast").innerHTML = "";
  requestAnimationFrame(() => {
    buildBoard();
    renderGoats();
    renderHud();
    toast(`<span>🏁 The goats are off! You start the race.</span>`, 2000);
    gameLoop(myGen);
  });
}

function showStart() {
  gen++; // stop any running game
  humanResolve = null;
  const draw = () => {
    const o = showOverlay(`<div class="panel hero"><div class="herd">${GOAT_IDS.map((g, i) => goatSvg(g, ["love", "effort", "neutral", "dizzy", "neutral"][i], { size: 90 })).join("")}</div>
      <h1>Mountain Mayhem<small>GOATed</small></h1>
      <p>Bet on goats. Climb on each other. Fall for the Ram.</p>
      <div style="text-align:left">
      <label class="l">Your name</label><input class="nameinp" id="nm" maxlength="12" value="${esc(settings.name)}">
      <label class="l">Pick your avatar</label><div class="avgrid">${AVATARS.map((a, i) => `<button class="avb ${i === settings.avatar ? "on" : ""}" data-a="${i}" aria-label="${a.name}">${avatarSvg(i, 60)}</button>`).join("")}</div>
      <label class="l">Opponents (AI)</label><div class="seg" id="opp">${[2, 3].map((n) => `<button data-n="${n}" class="${settings.opponents === n ? "on" : ""}">${n} opponents</button>`).join("")}</div>
      <label class="l">Race length</label><div class="seg" id="len">${[["quick", "Quick (15)"], ["long", "Long (20)"]].map(([v, t]) => `<button data-len="${v}" class="${settings.length === v ? "on" : ""}">${t}</button>`).join("")}</div>
      <label class="l">AI level</label><div class="seg" id="lvl">${["easy", "normal", "hard"].map((l) => `<button data-l="${l}" class="${settings.level === l ? "on" : ""}">${l}</button>`).join("")}</div>
      ${settingsRows()}
      </div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn go big" id="play">Play!</button><button class="btn alt" id="how">How to play</button></div></div>`);
    o.querySelector("#nm").oninput = (e) => { settings.name = e.target.value; saveSettings(); };
    o.querySelectorAll(".avb").forEach((b) => (b.onclick = () => { settings.avatar = +b.dataset.a; saveSettings(); const v = o.querySelector("#nm").value; draw(); o.querySelector("#nm").value = v; }));
    o.querySelectorAll("#opp button").forEach((b) => (b.onclick = () => { settings.opponents = +b.dataset.n; saveSettings(); draw(); }));
    o.querySelectorAll("#len button").forEach((b) => (b.onclick = () => { settings.length = b.dataset.len; saveSettings(); draw(); }));
    o.querySelectorAll("#lvl button").forEach((b) => (b.onclick = () => { settings.level = b.dataset.l; saveSettings(); draw(); }));
    wireSettings(o, draw);
    o.querySelector("#play").onclick = () => { unlockAudio(); settings.name = o.querySelector("#nm").value.trim() || "You"; saveSettings(); startGame(); };
    o.querySelector("#how").onclick = openHelp;
  };
  draw();
}

$("btnSet").onclick = openSettings;
$("btnHelp").onclick = openHelp;
$("btnLog").onclick = openLog;
let rz;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (s) { buildBoard(); for (const g of GOAT_IDS) goatEls[g].dataset.key = ""; renderGoats(); } }, 150); });

// A placeholder game so the HUD has something to draw behind the start screen.
(function boot() {
  s = newGame({ players: 4, seed: 7 });
  seats = [0, 1, 2, 3].map((i) => ({ name: i === 0 ? "You" : AVATARS[i].name, avatar: i, human: i === 0 }));
  buildBoard(); renderGoats(); renderHud();
  showStart();
})();
