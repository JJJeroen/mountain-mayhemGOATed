// Mountain Mayhem: GOATed - web UI. The engine decides rules; this file only renders and asks for actions.
import {
  GOAT_IDS, GOATS, newGame, legalActions, apply, ranking, goatSpace, trickOptions, pledgeValue, DEFAULT_CONFIG,
} from "./engine.js";
import { sfx, setSoundEnabled, unlockAudio } from "./sound.js";
import { goatSvg, ramSvg, avatarSvg, AVATARS, GOAT_BLURB } from "./art.js";

const $ = (id) => document.getElementById(id);
const COL = { blue: "#4f95e8", yellow: "#f7c52b", green: "#58b868", orange: "#e8412c", white: "#f8f4ee" };
const SPEEDS = { slow: 1.8, normal: 1, fast: 0.45 };
const mult = () => SPEEDS[settings.speed] ?? 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * mult()));
// Goat names always carry their colour ("Goatzilla (yellow)"); orange goat is drawn red. gShort = name only (board tags).
const COLNAME = { blue: ["blue", "blauw"], yellow: ["yellow", "geel"], green: ["green", "groen"], orange: ["red", "rood"], white: ["white", "wit"] };
const gShort = (g) => GOATS[g].name;
const gName = (g) => `${GOATS[g].name} (${L(...COLNAME[g])})`;
// Language: L(english, dutch). Everything the player reads goes through it.
const L = (en, nl) => (settings.lang === "nl" ? nl : en);
const ord = (n) => L(["1st", "2nd", "3rd", "4th", "5th"], ["1e", "2e", "3e", "4e", "5e"])[n] || (n + 1) + L("th", "e");

// "Pestkaarten" (tricks). name/d are getters so they follow the language setting.
const trick = (e, name, d) => ({ e, get name() { return L(...name); }, get d() { return L(...d); } });
const TRICKS = {
  headbutt: trick("🐐💥", ["Headbutt", "Kopstoot"], ["A goat riding on another swaps places with the goat beneath it.", "Een geit die op een andere zit, wisselt van plek met de geit eronder."]),
  snack: trick("🥕", ["Snack", "Hapje"], ["A goat that hasn't run this stage gets +1 to its run.", "Een geit die deze etappe nog niet gerend heeft, krijgt +1 erbij."]),
  mudslide: trick("🛝", ["Mud Slide", "Modderglijbaan"], ["A goat that hasn't run this stage has its run halved.", "Een geit die deze etappe nog niet gerend heeft, rent maar half zo ver."]),
  wobble: trick("🫨", ["Wobble", "Wankelen"], ["The top goat of a stack falls one space back.", "De bovenste geit van een stapel valt één vakje terug."]),
  swap: trick("🔀", ["Swap Places", "Plekwissel"], ["Two goats that stand alone trade spaces.", "Twee geiten die alleen staan, ruilen van vakje."]),
  earplugs: trick("🎧", ["Earplugs", "Oordoppen"], ["This goat does not skip a run if the Ram stops its stack.", "Deze geit slaat geen ren over als de Ram zijn stapel tegenhoudt."]),
  whistle: trick("📯", ["Whistle", "Fluitje"], ["Peek at the next Herd card, then keep it on top or bury it.", "Gluur naar de volgende kudde-kaart en laat hem bovenop of stop hem onderaan."]),
  cheer: trick("📣", ["Cheer", "Aanmoedigen"], ["Back the current leader: +2 hay at stage end if it still leads.", "Steun de koploper: +2 hooi aan het eind van de etappe als hij nog voorop ligt."]),
};
const GOAT_BLURB_NL = {
  blue: "Vincent van Goat: modder? Welke modder. Draagt laarzen.",
  yellow: "Goatzilla: vol gas, geen remmen, vooruitstekende tanden.",
  green: "Nanny McBleat: leest de krant, haast zich nooit.",
  orange: "ChewBAAAcca: veren onder de hoeven, hoofd op vakantie.",
  white: "Goaty Perry: zonnebril binnen, buiten, altijd.",
};
const blurb = (g) => (settings.lang === "nl" ? GOAT_BLURB_NL[g] : GOAT_BLURB[g]).split(": ")[1];

// ---------------------------------------------------------------- settings
let settings = { name: "You", avatar: 0, opponents: 3, level: "normal", speed: "normal", sound: true, length: "quick", hints: true, lang: (navigator.language || "en").toLowerCase().startsWith("nl") ? "nl" : "en" };
const LENGTHS = { quick: { finish: 15, ram: 12, mud: [5, 7] }, long: {} }; // quick = ~100 turns, long = ~150 (see sim notes)
try { Object.assign(settings, JSON.parse(localStorage.getItem("mm-settings") || "{}")); } catch { /* private mode */ }
if (settings.lang !== "nl") settings.lang = "en";
if (settings.fast) settings.speed = "fast"; // migrate the old Normal/Fast switch
delete settings.fast;
setSoundEnabled(settings.sound);
// The running game is saved after every move so a stray back press or an app kill only costs the animation.
const SAVE_KEY = "mm-save-v1";
const saveGame = () => { try { if (s && !s.finished && gen > 0) localStorage.setItem(SAVE_KEY, JSON.stringify({ s, seats, level: settings.level })); else localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } };
const loadSave = () => { try { const o = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); return o && o.s && Array.isArray(o.s.players) && Array.isArray(o.seats) && !o.s.finished ? o : null; } catch { return null; } };
const saveSettings = () => { try { localStorage.setItem("mm-settings", JSON.stringify(settings)); } catch { /* ignore */ } };
// legPatience: how much an early leg bet is discounted (the bots used to grab tokens before a single goat had moved).
const LEVELS = {
  easy: { n: 8, nFinal: 8, eps: 0.3, legPatience: 0.8, scoutChance: 0.4 },
  normal: { n: 16, nFinal: 12, eps: 0.06, legPatience: 0.4, scoutChance: 0.85 },
  hard: { n: 36, nFinal: 20, eps: 0, legPatience: 0.2 },
};

// ---------------------------------------------------------------- game state
let s = null; // engine state
let seats = []; // [{name, avatar, human}]
let gen = 0; // bumped on new game so stale loops stop
let humanResolve = null;
let hudActor = null; // while an opponent's move is being shown, the HUD still names that opponent (not the next player)
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

/** The Ram waits for the first goat; once that goat has had its "date" (served its skipped run) he wanders off. */
const ramPresent = () => !s.ramUsed || Object.values(s.skips || {}).some(Boolean);
function ramLeaves() {
  const r = $("ram");
  if (!r || r.classList.contains("ramgone")) return;
  r.classList.add("ramleave");
  setTimeout(() => r.classList.add("ramgone"), 1600);
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
  html += zl(s.cfg.mud[0] + 1, L("MUD: half pace", "MODDER: half tempo"));
  // ram + finish
  const rc = cellPos(s.cfg.ram);
  const rw = Math.min(geo.colW * 1.35, 120), rh = (rw * 170) / 208;
  html += `<div class="ramspot ${ramPresent() ? "" : "ramgone"}" id="ram" style="--dir:${rc.col >= 2 ? 1 : -1};left:${rc.x + geo.colW / 2 - rw / 2 + (rc.rev ? -rw * 0.28 : rw * 0.28)}px;top:${rc.y - rh + geo.rowH * 0.62}px;width:${rw}px;${rc.rev ? "" : "transform:scaleX(-1)"}">${ramSvg(rw)}</div>`;
  const lastRev = (rows - 1) % 2 === 1;
  html += `<div class="finish" style="left:${(lastRev ? 0 : 4) * geo.colW + 4}px;top:${geo.topPad - 36}px;width:${geo.colW - 8}px"><div class="flag"></div>${L("FINISH", "FINISH")}</div>`;
  b.innerHTML = html;
  for (const g of GOAT_IDS) {
    const el = document.createElement("div");
    el.className = "goat";
    el.dataset.g = g;
    el.style.width = geo.gw + "px";
    el.innerHTML = `<div class="in"><div class="flip"></div></div><span class="tag">${gShort(g)}</span>`;
    el.onclick = () => openGoatInfo(g);
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
    el.querySelector(".tag").textContent = gShort(g) + (s.skips?.[g] ? " 💕💤" : "");
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
const sub = (t) => (settings.hints ? `<small class="sb">${t}</small>` : "");
/** "Learn to play" coaching line for the human's turn. */
function coachText(me) {
  const stageLeft = s.deck.length;
  if (me.knownTop) return L(`👀 Only <b>you</b> know <b>${gName(me.knownTop)}</b> runs next (glowing card above). Use it: take a leg bet before it moves, or Run to play it out. Peeking is free; then take one more action.`,
    `👀 Alleen <b>jij</b> weet dat <b>${gName(me.knownTop)}</b> als volgende rent (gloeiende kaart boven). Gebruik dat: neem een etappegok voordat hij rent, of ren zelf. Gluren is gratis; daarna doe je nog één actie.`);
  return L(`<b>Pick one action</b> (it ends your turn): tap a goat to bet it finishes the stage 1st (6/4/2 hay, 2nd place +1, wrong −1). <b>Run</b> plays the next Herd card (+${s.cfg.hoofHay} hoof hay). ${stageLeft} card${stageLeft === 1 ? "" : "s"} left this stage.`,
    `<b>Kies één actie</b> (daarna is de volgende aan de beurt): tik op een geit om te gokken dat hij de etappe wint (6/4/2 hooi, 2e plek +1, fout −1). <b>Ren</b> speelt de volgende kudde-kaart (+${s.cfg.hoofHay} hoefhooi). Nog ${stageLeft} kaart${stageLeft === 1 ? "" : "en"} in deze etappe.`);
}
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
    return `<div class="pl ${(hudActor ?? s.turn) === i ? "active" : ""} ${i === 0 ? "you" : ""}" data-you="${L("YOU", "JIJ")}">${avatarSvg(seats[i].avatar, 34)}<div><div class="nm">${esc(i === 0 ? myName() : seats[i].name)}</div><div class="hay">${p.hay}<small> ${L("hay", "hooi")}</small></div></div><div class="tk">${legs}${hoofs}${finTag}</div></div>`;
  }).join("");

  // leg bets
  const rank = ranking(s);
  const myTurn = humanTurn();
  $("bets").innerHTML = GOAT_IDS.map((g) => {
    const rem = s.legStacks[g];
    const taken = [];
    s.players.forEach((p, i) => p.legs.forEach((l) => { if (l.goat === g) taken.push({ i, v: l.value }); }));
    const toks = s.cfg.legValues.map((v, idx) => `<span class="tok ${idx < s.cfg.legValues.length - rem.length ? "gone" : ""}" style="--c:${COL[g]}">${v}</span>`).join("");
    const holders = taken.map((t) => `<i>${t.i === 0 ? L("you", "jij") : esc(seats[t.i].name.slice(0, 3))}${t.v}</i>`).join("");
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
    <div class="hint ${settings.hints && myTurn ? "coach" : ""}">${s.finished ? "" : myTurn ? (settings.hints ? coachText(me) : L("Your turn: tap a goat above to bet, or choose an action", "Jouw beurt: tik op een geit om te gokken, of kies een actie")) : `<span class="turnb">${avatarSvg(seats[hudActor ?? s.turn].avatar, 24)}<b>${esc(seats[hudActor ?? s.turn].name)}</b> ${L(hudActor === null ? "is thinking…" : "just played", hudActor === null ? "denkt na…" : "was net aan de beurt")}</span>`}</div>
    <button class="abtn run" id="aRun" ${myTurn ? "" : "disabled"}><span class="ic">🏃</span>${L("Run", "Ren")}${sub(L("roll the next goat", "gooi voor de volgende geit"))}</button>
    <button class="abtn trick" id="aTrick" ${canTrick ? "" : "disabled"}><span class="ic">🃏</span>${L("Trick", "Pestkaart")} (${me.hand.length})${sub(L("play a card", "speel een kaart"))}</button>
    <button class="abtn scout" id="aScout" ${canScout ? "" : "disabled"}><span class="ic">👀</span>${L("Scout", "Gluren")}${sub(L("free, then act", "gratis, dan nog iets"))}</button>
    <button class="abtn final" id="aFinal" ${canFinal ? "" : "disabled"}><span class="ic">🎯</span>${L("Pledge", "Topgok")} (${me.finalsLeft.length})${sub(L("bet on the winner", "gok op de winnaar"))}</button>`;
  $("aRun").onclick = () => submit({ type: "run" });
  $("aScout").onclick = () => submit({ type: "scout" });
  $("aTrick").onclick = openTricks;
  $("aFinal").onclick = openFinal;
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const humanTurn = () => !!humanResolve;

function toast(html, ms = 1500, keep = false) {
  const t = document.createElement("div");
  t.className = "tst";
  t.innerHTML = html;
  $("toast").appendChild(t);
  if (keep) t.classList.add("keep");
  ms *= Math.max(1, mult());
  setTimeout(() => t.classList.add("out"), ms);
  setTimeout(() => t.remove(), ms + 450);
}
function log(text) { logLines.push(`${L("Stage", "Etappe")} ${s ? s.stage : 1}: ${text}`); if (logLines.length > 80) logLines.shift(); }

// ---------------------------------------------------------------- sheets

// What makes each goat different: its own die (the faces are shown) and a one-line trait.
const GOAT_TRAIT = {
  blue: ["Steady and never slowed by mud.", "Gelijkmatig en mud houdt hem niet tegen."],
  yellow: ["All or nothing: it moves 1 or 3, never 2.", "Alles of niets: hij rent 1 of 3, nooit 2."],
  green: ["Reliable: it almost always moves 2.", "Betrouwbaar: hij rent bijna altijd 2."],
  orange: ["Wild: anything from standing still (0) to 4.", "Wild: alles van blijven staan (0) tot 4."],
  white: ["Middle of the road: 1 to 3.", "Middenmoot: 1 tot 3."],
};
function openGoatInfo(g) {
  if (!$("sheet").hidden) return;
  const faces = GOATS[g].die.map((d) => `<span class="die">${d}</span>`).join("");
  openSheet(`<div class="center">${goatSvg(g, "neutral", { size: 120 })}<h2>${gName(g)}</h2><div class="dice">${faces}</div><p><b>${L(...GOAT_TRAIT[g])}</b></p><p class="sub">${blurb(g)}</p><p class="sub">${L("Every goat has its own die. Know them, bet smarter.", "Elke geit heeft zijn eigen dobbelsteen. Ken ze, gok slimmer.")}</p></div>`);
}
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
  const where = sp > s.cfg.finish ? L("over the line", "over de streep") : L(`space ${sp}${s.spaces[sp].length > 1 ? `, ${ord(lvl)} from bottom` : ""}`, `vakje ${sp}${s.spaces[sp].length > 1 ? `, ${ord(lvl)} van onder` : ""}`);
  return `<button class="card pick" data-g="${g}">${goatSvg(g, "neutral", { size: 80 })}<b>${gName(g)}</b><span>${where}${extra}</span></button>`;
}

function openTricks() {
  const me = s.players[0];
  const uniq = [...new Set(me.hand)];
  const html = `<h2>${L("Play a trick card", "Speel een pestkaart")}</h2><p class="sub">${L("One card, face up, then your turn is over.", "Eén kaart, open op tafel, daarna is je beurt voorbij.")} ${L("Hand", "Hand")}: ${me.hand.length}/${s.cfg.handMax}.</p><div class="grid g2">${uniq.map((c) => {
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
  const back = `<p><button class="btn alt" id="bk">${L("← Back", "← Terug")}</button></p>`;
  const wire = (p) => { const bk = p.querySelector("#bk"); if (bk) bk.onclick = openTricks; return p; };
  if (card === "cheer") {
    const g = opts[0].goat;
    const p = openSheet(`<h2>${T.e} ${T.name}</h2><p>${T.d}</p><p>${L("Current leader", "Huidige koploper")}: <b>${gName(g)}</b></p><div class="row"><button class="btn go" id="ok">${L("Cheer for", "Moedig aan:")} ${gName(g)}</button></div>${back}`);
    p.querySelector("#ok").onclick = () => { closeSheet(); submit({ type: "trick", card, args: { goat: g } }); };
    return wire(p);
  }
  if (card === "whistle") {
    const top = s.deck[0];
    const p = openSheet(`<h2>${T.e} ${T.name}</h2><p>${L("You peek: the next goat to run is...", "Je gluurt: de volgende geit die rent is...")}</p><div class="center">${goatSvg(top, "neutral", { size: 140 })}<p><b>${gName(top)}</b></p></div><p>${L("Keep it on top, or bury it at the bottom of the Herd deck?", "Laat je hem bovenop liggen, of stop je hem onderaan de kudde-stapel?")}</p><div class="row"><button class="btn go" id="keep">${L("Keep on top", "Bovenop laten")}</button><button class="btn" id="bury">${L("Bury it", "Onderop stoppen")}</button></div><p class="sub">${L("Others see that you whistled, not what you saw.", "De anderen zien dát je floot, niet wat je zag.")}</p>`, { dismiss: false });
    p.querySelector("#keep").onclick = () => { closeSheet(); submit({ type: "trick", card, args: { bury: false } }); };
    p.querySelector("#bury").onclick = () => { closeSheet(); submit({ type: "trick", card, args: { bury: true } }); };
    return;
  }
  if (card === "swap") {
    const singles = [...new Set(opts.flatMap((o) => [o.a, o.b]))];
    const p = openSheet(`<h2>${T.e} ${T.name}</h2><p>${L("Pick the first goat:", "Kies de eerste geit:")}</p><div class="grid g3">${singles.map((g) => goatPickCard(g)).join("")}</div>${back}`);
    p.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.g;
      const partners = opts.filter((o) => o.a === a || o.b === a).map((o) => (o.a === a ? o.b : o.a));
      const p2 = openSheet(`<h2>${T.e} ${T.name}</h2><p>${L(`Swap ${gName(a)} with:`, `Wissel ${gName(a)} met:`)}</p><div class="grid g3">${partners.map((g) => goatPickCard(g)).join("")}</div>${back}`);
      p2.querySelectorAll("[data-g]").forEach((b2) => (b2.onclick = () => { closeSheet(); submit({ type: "trick", card, args: { a, b: b2.dataset.g } }); }));
      wire(p2);
    }));
    return wire(p);
  }
  const labels = { headbutt: L("Pick the goat that gets pushed down (it swaps with the goat beneath it):", "Kies de geit die naar beneden wordt gestoten (hij wisselt met de geit eronder):"), wobble: L("Pick the stack's top goat to fall one space back:", "Kies de bovenste geit van de stapel die een vakje terugvalt:"), snack: L("Who gets the snack (+1)?", "Wie krijgt het hapje (+1)?"), mudslide: L("Whose run gets halved?", "Wiens ren wordt gehalveerd?"), earplugs: L("Who does not skip a run at the Ram this stage?", "Wie slaat bij de Ram deze etappe geen ren over?") };
  const extra = (g) => {
    if (card !== "headbutt") return "";
    const arr = s.spaces[goatSpace(s, g)];
    return `<br>${L("sits on", "zit op")} ${gName(arr[arr.indexOf(g) - 1])}`;
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
    const placed = mine.length ? `<h3>${L("Your secret pledges", "Jouw geheime topgokken")}</h3><div class="row">${mine.map((b) => `<span class="pill" style="opacity:1">${b.kind === "winner" ? "🏆" : "🐌"} ${goatSvg(b.goat, "neutral", { size: 22 })} ${gName(b.goat)} <small>(${b.value})</small></span>`).join("")}</div>` : "";
    const p = openSheet(`<h2>🎯 ${L("Summit pledge", "Topgok")}</h2><p>${L(`Secretly pledge who wins or loses the whole race. You get <b>one Winner and one Loser pledge</b> per game and <b>it can never be taken back</b>. Pledging now pays <b>${pledgeValue(s, kind)} hay</b> if right (it shrinks every stage: ${s.cfg.pledgeValues.join(" / ")}); wrong costs ${s.cfg.finalPenalty}. Picking the loser is easier, so it pays ${s.cfg.loserDrop} less than picking the winner.`,
        `Gok in het geheim wie de hele race wint of als laatste eindigt. Je hebt per spel <b>één Winnaar- en één Verliezer-gok</b> en <b>je kunt hem nooit meer terugnemen</b>. Nu gokken levert <b>${pledgeValue(s, kind)} hooi</b> op als je gelijk hebt (het wordt elke etappe minder: ${s.cfg.pledgeValues.join(" / ")}); fout kost ${s.cfg.finalPenalty}. De laatste kiezen is makkelijker, dus dat levert ${s.cfg.loserDrop} minder op dan de winnaar kiezen.`)}</p>
      <div class="seg" id="seg">${me.finalsLeft.map((k) => `<button data-k="${k}" class="${kind === k ? "on" : ""}">${k === "winner" ? L("🏆 Winner", "🏆 Winnaar") : L("🐌 Loser", "🐌 Verliezer")}</button>`).join("")}</div>
      <div class="grid g3" style="margin-top:10px">${goats.map((g) => goatPickCard(g)).join("")}</div>${placed}`);
    p.querySelectorAll("#seg button").forEach((b) => (b.onclick = () => { kind = b.dataset.k; draw(); }));
    p.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => { closeSheet(); submit({ type: "final", goat: b.dataset.g, kind }); }));
  };
  draw();
}

function openLog() {
  openSheet(`<h2>${L("Game log", "Spellogboek")}</h2><div class="log">${logLines.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join("") || `<p>${L("Nothing yet.", "Nog niks.")}</p>`}</div>`);
}

function openHelp() {
  const c = gen > 0 && s ? s.cfg : { ...DEFAULT_CONFIG, ...(LENGTHS[settings.length] || {}) }; // before a game starts, show the selected track
  const quick = L(`
  <div class="quick">
   <h2>🐐 How to play</h2>
   <p class="lead">Five goats climb the mountain. <b>None of them is yours</b>: you bet on all of them. Whoever collects the most <b>hay</b> 🌾 wins.</p>
   <ol class="steps">
    <li><b>🪙 Bet:</b> grab a hay token on the goat you think leads when the stage ends. Right: 6, 4 or 2 hay (2nd place +1). Wrong: −1.</li>
    <li><b>🏃 Run:</b> flip a Herd card and that goat rolls its own dice. Goats that land on each other <b>stack up</b> and the bottom goat does the carrying. Mud halves your pace, and the lovesick <b>Ram</b> stops the first goat that reaches him, together with its whole stack: only the goat on top skips its next run.</li>
    <li><b>🃏 Pest card:</b> play a nasty little trick: shove, swap, snack or slow a goat down, and more. Everybody sees it.</li>
    <li><b>🎯 Summit pledge:</b> once per game, secretly bet on who wins (and who comes last). The earlier you dare, the more hay it pays.</li>
   </ol>
   <p>Every goat has its own die (tap a goat on the mountain to see it): some are steady, some wild. One action per turn. When all five goats have run, the stage is scored. First goat over the line ends the race!</p>
  </div>`, `
  <div class="quick">
   <h2>🐐 Zo speel je het</h2>
   <p class="lead">Vijf geiten klimmen de berg op. <b>Geen enkele is van jou</b>: je moet gokken op wie de etappe wint en op degene die de wedstrijd wint. Wie het meeste <b>hooi</b> 🌾 verzamelt, wint.</p>
   <ol class="steps">
    <li><b>🪙 Etappe gokken:</b> pak een hooitoken op de geit waarvan jij denkt dat hij aan het eind van de etappe voorop ligt. Goed: 6, 4 of 2 hooi (2e plek +1). Fout: −1.</li>
    <li><b>🏃 Rennen:</b> draai een kudde-kaart om en die geit gooit zijn eigen dobbelsteen. Geiten die op elkaar landen <b>stapelen</b> zich op en de onderste geit draagt de rest. Modder halveert je tempo, en de smoorverliefde <b>Ram</b> houdt de eerste geit die hem bereikt tegen, samen met zijn hele stapel: alleen de bovenste geit slaat zijn volgende ren over.</li>
    <li><b>🃏 Pestkaart:</b> Er zijn 8 soorten, zoals duwen, wisselen, extra hard rennen of een geit afremmen. </li>
    <li><b>🎯 Topgokken:</b> één keer per spel gok je in het geheim wie wint (en wie laatste wordt). Hoe eerder je durft, hoe meer hooi het oplevert als je het goed hebt.</li>
   </ol>
   <p>Elke geit heeft zijn eigen dobbelsteen (tik op een geit op de berg om hem te zien): sommige zijn gelijkmatig, andere wild. Eén actie per beurt. Als alle vijf geiten gerend hebben, is de etappe klaar en worden de punten geteld. Loopt een geit tijdens het spel over de finish? Dan is de race meteen ten einde!</p>
  </div>`);
  const full = L(`
  <h3>The path</h3>
  <ul><li>${c.finish} spaces then the finish. A goat that ends on a crowded space <b>climbs on top</b>; a goat carries everyone on its back.</li>
  <li><b>Mud</b> (spaces ${c.mud[0]}-${c.mud[1]}): a goat starting its move there goes half as far. ${GOATS.blue.name} doesn't care.</li>
  <li><b>The Ram</b> (space ${c.ram}): the first goat of the whole race to reach it falls head over hooves in love and <b>stops right there</b>, and so does its whole stack. Only the <b>top goat</b> of that stack is so dreamy that it <b>skips its next run</b>: that is the date. Afterwards the Ram wanders off.</li></ul>
  <h3>A stage = five Herd cards</h3>
  <p>Every goat runs exactly once per stage, in random order. On your turn do <b>one</b> thing:</p>
  <div class="tlist">
   <div class="tl"><span class="e">🪙</span><span><b>Leg bet</b>: tap a goat's token (6, then 4, then 2). Leader at stage end pays the token, 2nd place pays 1, otherwise you lose 1.</span></div>
   <div class="tl"><span class="e">🏃</span><span><b>Run</b>: flip the next Herd card and move that goat with its own die. You earn a hoof token: +${c.hoofHay} hay at stage end.</span></div>
   <div class="tl"><span class="e">🃏</span><span><b>Trick</b>: play a card to meddle (see the cards when you open it).</span></div>
   <div class="tl"><span class="e">👀</span><span><b>Scout</b>: secretly peek at which goat runs next. It is free: you stay on turn.</span></div>
   <div class="tl"><span class="e">🎯</span><span><b>Summit pledge</b>: secretly pledge a goat as the overall winner and another as the loser (once each per game). A correct pledge pays ${c.pledgeValues.join("/")} depending on the stage you made it, so early is worth more (picking the loser pays ${c.loserDrop} less); wrong costs ${c.finalPenalty}.</span></div>
  </div>
  <h3>The goats' dice</h3>`, `
  <h3>Het pad</h3>
  <ul><li>${c.finish} vakjes en dan de finish. Een geit die op een bezet vakje eindigt, <b>klimt erbovenop</b>; een geit draagt iedereen op zijn rug.</li>
  <li><b>Modder</b> (vakjes ${c.mud[0]}-${c.mud[1]}): een geit die daar begint, komt maar half zo ver. ${GOATS.blue.name} geeft er niks om.</li>
  <li><b>De Ram</b> (vakje ${c.ram}): de eerste geit van de héle race die hem bereikt wordt smoorverliefd en <b>blijft daar staan</b>, en zijn hele stapel ook. Alleen de <b>bovenste geit</b> van die stapel is zo dromerig dat hij <b>zijn volgende ren overslaat</b>. Dat is de date. Daarna loopt de Ram weg.</li></ul>
  <h3>Een etappe = vijf kudde-kaarten</h3>
  <p>Elke geit rent precies één keer per etappe, in willekeurige volgorde. Op jouw beurt doe je <b>één</b> ding:</p>
  <div class="tlist">
   <div class="tl"><span class="e">🪙</span><span><b>Etappegok</b>: tik op het token van een geit (eerst 6, dan 4, dan 2). De koploper aan het eind van de etappe betaalt het token uit, nummer 2 levert 1 op, anders verlies je 1.</span></div>
   <div class="tl"><span class="e">🏃</span><span><b>Ren</b>: draai de volgende kudde-kaart om en verplaats die geit met zijn eigen dobbelsteen. Je krijgt een hoeftoken: +${c.hoofHay} hooi aan het eind van de etappe.</span></div>
   <div class="tl"><span class="e">🃏</span><span><b>Pestkaart</b>: speel een kaart om te dwarsbomen (je ziet de kaarten als je ze opent).</span></div>
   <div class="tl"><span class="e">👀</span><span><b>Gluren</b>: gluur in het geheim welke geit als volgende rent. Het is gratis: je blijft aan de beurt.</span></div>
   <div class="tl"><span class="e">🎯</span><span><b>Topgok</b>: gok in het geheim op één winnaar en één laatste (elk één keer per spel). Goed gokken levert ${c.pledgeValues.join("/")} op, afhankelijk van de etappe waarin je gokte, dus vroeg is meer waard (de laatste kiezen levert ${c.loserDrop} minder op); fout kost ${c.finalPenalty}.</span></div>
  </div>
  <h3>De dobbelstenen van de geiten</h3>`);
  const end = L("The race ends when a goat crosses the finish line. Then the pledges are revealed.", "De race eindigt als een geit over de finishlijn gaat. Dan worden de topgokken onthuld.");
  openSheet(`<div class="rules">${quick}
  <details class="full"><summary>${L("📖 All the rules", "📖 Alle regels")}</summary>${full}
  <h3>${L("Pest cards", "Pestkaarten")}</h3><ul>${Object.values(TRICKS).map((t) => `<li>${t.e} <b>${t.name}</b>: ${t.d}</li>`).join("")}</ul>
  <div class="tlist">${GOAT_IDS.map((g) => `<div class="tl"><span>${goatSvg(g, "neutral", { size: 34 })}</span><span><b>${gName(g)}</b>: ${GOATS[g].die.join(" ")}<br><small>${blurb(g)}</small></span></div>`).join("")}</div>
  <p>${end}</p></details></div>
  <div class="center"><button class="btn go" id="hOk">${L("Got it", "Begrepen")}</button></div>`);
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
  const o = showOverlay(`<div class="rollbox"><div>${goatSvg(ev.goat, "effort", { size: 130 }).replace("<svg ", '<svg class="gt" ')}</div><b>${gName(ev.goat)} ${L("runs!", "rent!")}</b>${pi === undefined ? "" : `<small class="by">${esc(L(`${seatLabel(pi)}'s run`, `${seatLabel(pi)} laat rennen`))}</small>`}<div><span class="die roll" id="dv">?</span></div><div class="note" id="dn"></div></div>`);
  const dv = o.querySelector("#dv");
  if (ev.skipped) {
    dv.classList.remove("roll");
    dv.textContent = "💤";
    o.querySelector("#dn").textContent = L("Still dreaming about the Ram. Skips this run!", "Droomt nog van de Ram. Slaat deze ren over!");
    sfx("annoyed", ev.goat);
    await sleep(1500);
    hideOverlay();
    return;
  }
  for (let i = 0; i < 6; i++) { dv.textContent = die[(Math.random() * 6) | 0]; sfx("tick"); await sleep(80); }
  dv.classList.remove("roll");
  dv.textContent = ev.roll;
  sfx("coin");
  let note = ev.ram ? L("💘 The Ram stops it here!", "💘 De Ram houdt hem hier tegen!") : "";
  if (ev.slowed) note = ev.steps !== ev.roll ? L(`🟤 slowed to ${ev.steps}!`, `🟤 vertraagd tot ${ev.steps}!`) : "";
  if (!ev.slowed && ev.steps > ev.roll) note = L(`🥕 +1 snack → ${ev.steps}`, `🥕 +1 hapje → ${ev.steps}`);
  if (ev.slowed && ev.steps > Math.ceil(ev.roll / 2)) note += ` 🥕 +1 → ${ev.steps}`;
  o.querySelector("#dn").textContent = note || (ev.roll === 0 ? L("Goes nowhere. Typical.", "Komt nergens. Typisch.") : "");
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

const myName = () => (settings.name && settings.name !== "You" ? settings.name : L("You", "Jij"));
const seatLabel = (i) => (i === 0 ? L("You", "Jij") : seats[i].name);

async function showStageScore(rank) {
  sfx("stage");
  // Everything comes from the engine's own stage score, so the pills always add up to the total.
  const rows = s.stats.history.at(-1).breakdown.map((b) => {
    const pills = b.legs.map((l) => ({ d: l.d, html: `${goatSvg(l.goat, "neutral", { size: 20 })} ${l.d > 0 ? "+" : ""}${l.d}` }));
    if (b.hoofs) pills.push({ d: b.hoofD, html: `👣 +${b.hoofD}` });
    for (const c of b.cheers) pills.push({ d: c.d, html: `📣 ${c.d ? "+" + c.d : "0"}` });
    return { pills, net: b.net };
  });
  const rk = rank.map((g, i) => `<div>${goatSvg(g, i === 0 ? "love" : "neutral", { size: 52 })}${ord(i)}</div>`).join("");
  const o = showOverlay(`<div class="panel"><h2>${L("Stage", "Etappe")} ${s.stage - (s.finished ? 0 : 1)} ${L("complete", "klaar")}</h2><div class="rank">${rk}</div>
    ${rows.map((r, i) => `<div class="srow">${avatarSvg(seats[i].avatar, 42)}<div><b>${esc(seatLabel(i))}</b><div class="det">${r.pills.map((p, k) => `<span class="pill ${p.d > 0 ? "pos" : p.d < 0 ? "neg" : ""}" style="animation-delay:${(i * 5 + k) * 0.07 + 0.2}s">${p.html}</span>`).join("") || `<small>${L("nothing", "niks")}</small>`}</div></div><div class="tot ${r.net > 0 ? "pos" : r.net < 0 ? "neg" : ""}" id="t${i}">0</div></div>`).join("")}
    <div class="center" style="margin-top:10px"><button class="btn go" id="nx">${s.finished ? L("Reveal pledges", "Onthul de topgokken") : L("Next stage", "Volgende etappe")}</button></div></div>`);
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
  const o = showOverlay(`<div class="panel"><h2>${L("The race is over!", "De race is voorbij!")}</h2>
    <div class="rank"><div>${goatSvg(winner, "love", { size: 90 })}🏆 ${gName(winner)}</div><div>${goatSvg(loser, "dizzy", { size: 90 })}🐌 ${gName(loser)}</div></div>
    <h3>${L("Summit pledges, in the order placed", "Topgokken, in volgorde van plaatsing")}</h3><div id="rv" class="tlist"></div><div id="st"></div></div>`);
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
  if (!reveals.length) rv.innerHTML = `<p>${L("Nobody made a pledge. Brave. Or lazy.", "Niemand deed een topgok. Dapper. Of lui.")}</p>`;
  // Tiebreak (decision 2026-10-12): equal hay -> most correct pledges; still equal -> shared win.
  const correct = s.players.map((_, i) => reveals.filter((r) => r.player === i && r.ok).length);
  const order = s.players.map((p, i) => ({ i, hay: p.hay })).sort((a, b) => b.hay - a.hay || correct[b.i] - correct[a.i]);
  const top = order[0].hay;
  const tiedTop = order.filter((x) => x.hay === top);
  const bestC = Math.max(...tiedTop.map((x) => correct[x.i]));
  const winners = tiedTop.filter((x) => correct[x.i] === bestC);
  o.querySelector("#st").innerHTML = `<h3>${L("Final standings", "Eindstand")}</h3>${order.map((x, k) => `<div class="stand ${winners.some((w) => w.i === x.i) ? "win" : ""}"><b>${winners.some((w) => w.i === x.i) ? "👑" : k + 1}</b>${avatarSvg(seats[x.i].avatar, 54)}<div><b>${esc(seatLabel(x.i))}</b><br><small>${preFinal[x.i]} ${L("before pledges", "vóór de topgokken")}</small></div><span class="hv">${x.hay}</span></div>`).join("")}
    <p class="center"><b>${winners.length > 1 ? L("It's a tie! ", "Gelijkspel! ") + winners.map((w) => seatLabel(w.i)).join(" & ") + L(" share the hay.", " delen het hooi.") : (winners[0].i === 0 ? L("You win!", "Jij wint!") : esc(seats[winners[0].i].name) + L(" wins.", " wint."))}</b></p>
    <div class="row" style="justify-content:center"><button class="btn go" id="again">${L("Play again", "Nog een keer")}</button><button class="btn alt" id="menu">${L("Menu", "Menu")}</button></div>`;
  if (winners.some((w) => w.i === 0)) confetti();
  o.querySelector("#st").scrollIntoView({ behavior: "smooth", block: "end" });
  o.querySelector("#again").onclick = () => { hideOverlay(); try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } startGame(); };
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
    case "leg": return L(`${who} bet${you ? "" : "s"} on ${gName(a.goat)}`, `${who} gokt op ${gName(a.goat)}`);
    case "scout": return L(`${who} scouted the next card`, `${who} gluurde naar de volgende kaart`);
    case "final": return L(`${who} made a secret summit pledge`, `${who} deed een geheime topgok`);
    case "run": return L(`${who} ${you ? "run" : "runs"} the herd`, `${who} laat de kudde rennen`);
    case "trick": {
      const T = TRICKS[a.card].name;
      const g = a.args?.goat;
      if (a.card === "swap") return L(`${who} played ${T}: ${gName(a.args.a)} ⇄ ${gName(a.args.b)}`, `${who} speelde ${T}: ${gName(a.args.a)} ⇄ ${gName(a.args.b)}`);
      if (a.card === "whistle") return L(`${who} whistled (peeked at the next card)`, `${who} floot (en gluurde naar de volgende kaart)`);
      return L(`${who} played ${T}${g ? " on " + gName(g) : ""}`, `${who} speelde ${T}${g ? " op " + gName(g) : ""}`);
    }
  }
  return "";
}
function actionIcon(a) {
  return { leg: "🪙", run: "🏃", scout: "👀", final: "🎯", trick: TRICKS[a.card]?.e || "🃏" }[a.type];
}

async function playTurn(myGen) {
  try { return await playTurnInner(myGen); } finally { hudActor = null; }
}
async function playTurnInner(myGen) {
  const pi = s.turn;
  let act;
  renderHud();
  if (seats[pi].human) {
    if (!s.players[pi].knownTop) sfx("yourTurn");
    act = await new Promise((res) => { humanResolve = res; renderHud(); });
  } else {
    $("toast").querySelectorAll(".tst:not(.keep)").forEach((t) => t.remove()); // drop the previous player's message so it is clear whose turn this is
    const t0 = performance.now();
    act = await botDecide(pi);
    if (act.type !== "scout") await new Promise((r) => setTimeout(r, Math.max(0, 1100 * mult() - (performance.now() - t0))));
  }
  if (myGen !== gen) return false;
  const leaderBefore = ranking(s)[0];
  const stageBefore = s.stage;
  const events = apply(s, act);
  saveGame();
  hudActor = seats[pi].human ? null : pi;
  const head = events[0];
  const text = describe(head, pi);
  log(text);
  // A bot's free peek is silent: the hidden card is nobody else's business and it is straight back to the same player.
  if (act.type === "scout" && !seats[pi].human) return true;
  if (seats[pi].human || act.type !== "trick") toast(`${avatarSvg(seats[pi].avatar, 28)}<span>${esc(text)} ${actionIcon(act)}</span>`, 2200); // an opponent's pest card gets the big card instead
  if (settings.hints && seats[pi].human && (act.type === "scout" || (act.type === "trick" && act.card === "whistle" && !act.args.bury))) {
    toast(`<span>${L(`👀 You peeked: <b>${gName(s.players[pi].knownTop)}</b> runs next. Only you know, shown as the glowing card in the top bar. Bet on it, or Run to move it.`, `👀 Je gluurde: <b>${gName(s.players[pi].knownTop)}</b> rent als volgende. Alleen jij weet het, zie de gloeiende kaart bovenin. Gok erop, of Ren om hem te verplaatsen.`)}</span>`, 6000, true);
  }
  sfx(act.type === "leg" ? "coin" : act.type === "final" ? "pledge" : act.type === "trick" ? "trick" : act.type === "scout" ? "scout" : "click");
  if (!seats[pi].human) {
    renderHud();
    // A pest card played by an opponent gets a big card on screen first, so nobody misses what just happened.
    if (act.type === "trick") await showTrickCard(act, pi);
    else await sleep(1100); // let the player read who did what before the roll covers it
  }
  if (myGen !== gen) return false;

  for (const ev of events) {
    if (ev.t === "move") {
      await showRoll(ev, act.type === "run" ? pi : undefined);
      if (myGen !== gen) return false;
      if (ev.skipped) {
        log(L(`${gName(ev.goat)} was still dreaming about the Ram and skipped its run`, `${gName(ev.goat)} droomde nog van de Ram en sloeg de ren over`));
        renderGoats(); renderHud();
        if (!ramPresent()) { toast(`<span>💘 ${L("The Ram has had his date and wanders off. Bye, handsome!", "De Ram heeft zijn date gehad en loopt weg. Doeg, knapperd!")}</span>`, 2300); ramLeaves(); sfx("ram"); await sleep(1700); }
        else await sleep(300);
        continue;
      }
      setExpr(ev.goat, ev.ram ? "love" : "effort", ev.ram ? 2600 : 1400);
      if (ev.ram && !ev.deaf) setExpr(ev.smitten, "love", 2600);
      hop(ev.goat);
      sfx(ev.slowed ? "mud" : "land");
      sfx(ev.slowed ? "annoyed" : "baa", ev.goat, 120);
      renderGoats();
      renderHud();
      log(L(`${gName(ev.goat)} rolled ${ev.roll}${ev.slowed ? " (slowed)" : ""} and moved ${ev.from} → ${ev.to > s.cfg.finish ? "FINISH" : ev.to}${ev.carried.length ? ", carrying " + ev.carried.map(gName).join(", ") : ""}`,
        `${gName(ev.goat)} gooide ${ev.roll}${ev.slowed ? " (vertraagd)" : ""} en ging van ${ev.from} → ${ev.to > s.cfg.finish ? "FINISH" : ev.to}${ev.carried.length ? ", met op de rug " + ev.carried.map(gName).join(", ") : ""}`));
      if (ev.slowed) burst(ev.goat, "💩");
      await sleep(850);
      if (myGen !== gen) return false;
      if (ev.ram) {
        $("ram").classList.remove("swoon"); void $("ram").offsetWidth; $("ram").classList.add("swoon");
        toast(ev.deaf ? `<span>🎧 ${L(`${gName(ev.smitten)} fell for the Ram, but the earplugs help: the stack stops, nobody skips a run.`, `${gName(ev.smitten)} viel voor de Ram, maar de oordoppen helpen: de stapel stopt, niemand slaat een ren over.`)}</span>` : `<span>💘 ${L(`${gName(ev.smitten)} fell for the Ram! The stack stops here and ${gShort(ev.smitten)} skips its next run.`, `${gName(ev.smitten)} werd smoorverliefd op de Ram! De stapel stopt hier en ${gShort(ev.smitten)} slaat de volgende ren over.`)}</span>`, 2300);
        log(L(`${gName(ev.smitten)} fell for the Ram`, `${gName(ev.smitten)} werd verliefd op de Ram`));
        burst(ev.smitten, "💕");
        sfx("ram");
        if (!ev.deaf) sfx("annoyed", ev.smitten, 700);
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
    await sleep(500);
    if (myGen !== gen) return false;
    await showStageScore(stageRank);
    if (myGen !== gen) return false;
    if (ended) { saveGame(); await showFinal(s.stats.preFinal); return false; }
    renderGoats(); renderHud();
    toast(`<span>🌄 ${L(`Stage ${s.stage} begins. New Herd deck shuffled!`, `Etappe ${s.stage} begint. Nieuwe kudde-stapel geschud!`)}</span>`, 1800);
  }
  if (!seats[pi].human) await sleep(450);
  return !s.finished;
}

/** Big face-up card for a pest card (trick) an opponent plays; tap to skip. */
async function showTrickCard(act, pi) {
  const T = TRICKS[act.card], a = act.args || {};
  let target = "";
  if (act.card === "swap") target = `${goatSvg(a.a, "neutral", { size: 44 })}<span>⇄</span>${goatSvg(a.b, "neutral", { size: 44 })}`;
  else if (act.card === "whistle") target = `<span>${L("peeks at the next Herd card", "gluurt naar de volgende kudde-kaart")}</span>`;
  else if (a.goat) target = `${goatSvg(a.goat, "dizzy", { size: 52 })}<b>${gName(a.goat)}</b>`;
  const o = showOverlay(`<div class="pestwrap"><div class="pc-who">${avatarSvg(seats[pi].avatar, 44)}<b>${esc(seatLabel(pi))}</b> ${L("plays a pest card!", "speelt een pestkaart!")}</div>
    <div class="pestcard c-${act.card}"><div class="pc-tag">${L("PEST CARD", "PESTKAART")}</div><div class="pc-emoji">${T.e}</div><h2>${T.name}</h2><p>${T.d}</p>${target ? `<div class="pc-target">${target}</div>` : ""}</div></div>`);
  sfx("trick");
  await new Promise((res) => { const tm = setTimeout(res, Math.max(1300, 2000 * mult())); o.onclick = () => { clearTimeout(tm); res(); }; });
  o.onclick = null;
  hideOverlay();
}

async function animateTrick(act) {
  const a = act.args || {};
  const goats = [a.goat, a.a, a.b].filter(Boolean);
  if (act.card === "wobble" || act.card === "headbutt") for (const g of goats) { setExpr(g, "dizzy", 1800); shake(g); burst(g, "💫"); sfx("annoyed", g, 150); }
  else if (act.card === "swap") for (const g of goats) { setExpr(g, "dizzy", 1400); hop(g); sfx("annoyed", g, 150); }
  else if (act.card === "snack") { setExpr(a.goat, "love", 1600); burst(a.goat, "🥕"); sfx("baa", a.goat, 150); }
  else if (act.card === "mudslide") { setExpr(a.goat, "effort", 1600); burst(a.goat, "🟤"); sfx("annoyed", a.goat, 150); }
  else if (act.card === "earplugs") burst(a.goat, "🎧");
  else if (act.card === "cheer") { burst(a.goat, "📣"); sfx("baa", a.goat, 150); }
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
function langRow() {
  return `<div class="seg langseg" id="lng">${[["en", "English"], ["nl", "Nederlands"]].map(([v, t]) => `<button data-v="${v}" class="${settings.lang === v ? "on" : ""}">${t}</button>`).join("")}</div>`;
}
function settingsRows(withLang = true) {
  const seg = (id, key, items) => `<div class="seg" id="${id}">${items.map(([v, t]) => `<button data-v="${v}" class="${String(settings[key]) === String(v) ? "on" : ""}">${t}</button>`).join("")}</div>`;
  return `${withLang ? `<label class="l">Language / Taal</label>${langRow()}` : ""}
      <label class="l">${L("Game speed", "Speltempo")}</label>${seg("spd", "speed", [["slow", L("🐢 Slow", "🐢 Traag")], ["normal", L("Normal", "Normaal")], ["fast", L("🐇 Fast", "🐇 Snel")]])}
      <label class="l">${L("Learn to play (hints)", "Leren spelen (tips)")}</label>${seg("hnt", "hints", [[true, L("💡 On", "💡 Aan")], [false, L("Off", "Uit")]])}
      <label class="l">${L("Sound effects", "Geluidseffecten")}</label>${seg("snd", "sound", [[true, L("🔊 On", "🔊 Aan")], [false, L("🔇 Off", "🔇 Uit")]])}`;
}
function applyLang() {
  document.documentElement.lang = settings.lang;
  $("stageLbl").textContent = L("Stage", "Etappe");
  $("stageSub").textContent = L("herd", "kudde");
  $("btnSet").setAttribute("aria-label", L("Settings", "Instellingen"));
  $("btnLog").setAttribute("aria-label", L("Game log", "Spellogboek"));
  $("btnHelp").setAttribute("aria-label", L("How to play", "Uitleg"));
  if (s) { buildBoard(); for (const g of GOAT_IDS) goatEls[g].dataset.key = ""; renderGoats(); renderHud(); }
}
function wireSettings(root, redraw) {
  root.querySelectorAll("#lng button").forEach((b) => (b.onclick = () => { settings.lang = b.dataset.v; saveSettings(); applyLang(); redraw(); }));
  root.querySelectorAll("#spd button").forEach((b) => (b.onclick = () => { settings.speed = b.dataset.v; saveSettings(); redraw(); }));
  root.querySelectorAll("#hnt button").forEach((b) => (b.onclick = () => { settings.hints = b.dataset.v === "true"; saveSettings(); redraw(); if (s && $("actions")) renderHud(); }));
  root.querySelectorAll("#snd button").forEach((b) => (b.onclick = () => {
    settings.sound = b.dataset.v === "true"; setSoundEnabled(settings.sound); saveSettings(); unlockAudio(); redraw(); sfx("coin");
  }));
}
function openSettings() {
  const draw = () => { const p = openSheet(`<h2>⚙ ${L("Settings", "Instellingen")}</h2><div style="text-align:left">${settingsRows()}</div>`); wireSettings(p, draw); };
  draw();
}

function startGame(saved) {
  gen++;
  const myGen = gen;
  if (saved) { s = saved.s; seats = saved.seats; seats[0].name = myName(); } else {
    const n = settings.opponents + 1;
    s = newGame({ players: n, seed: (Math.random() * 2 ** 31) | 0, cfg: LENGTHS[settings.length] || {} });
    const opp = pickOpponents(n - 1, settings.avatar);
    seats = [{ name: myName(), avatar: settings.avatar, human: true }, ...opp.map((a) => ({ name: AVATARS[a].name, avatar: a, human: false }))];
  }
  logLines.length = 0;
  for (const g of GOAT_IDS) delete expr[g];
  humanResolve = null;
  mainBots = {};
  if (!worker && !workerDead) initWorker();
  closeSheet(); hideOverlay();
  $("toast").querySelectorAll(".tst:not(.keep)").forEach((t) => t.remove());
  requestAnimationFrame(() => {
    buildBoard();
    renderGoats();
    renderHud();
    toast(`<span>🏁 ${saved ? L("Welcome back! Your game goes on.", "Welkom terug! Je spel gaat verder.") : L(`The goats are off! ${seats[s.turn].human ? "You start" : esc(seats[s.turn].name) + " starts"} the race.`, `De geiten zijn los! ${seats[s.turn].human ? "Jij begint" : esc(seats[s.turn].name) + " begint"} de race.`)}</span>`, 2600);
    if (!saved) setTimeout(() => { if (myGen === gen) toast(`<span>🎲 ${L("Every goat rolled its own die to start, that is why they are spread out. Tap a goat to see its die.", "Elke geit gooide zijn eigen dobbelsteen om te starten, daarom staan ze verspreid. Tik op een geit om zijn dobbelsteen te zien.")}</span>`, 5200, true); }, 2700);
    gameLoop(myGen);
  });
}

function showStart() {
  gen++; // stop any running game
  humanResolve = null;
  const saved = loadSave();
  const draw = () => {
    const o = showOverlay(`<div class="panel hero"><div class="herd">${GOAT_IDS.map((g, i) => goatSvg(g, ["love", "effort", "neutral", "dizzy", "neutral"][i], { size: 90 })).join("")}</div>
      ${langRow()}
      <h1>Mountain Mayhem<small>GOATed</small></h1>
      <p>${L("Bet on goats. Climb on each other. Fall for the Ram.", "Gok op geiten. Klim op elkaar. Val voor de Ram.")}</p>
      <div style="text-align:left">
      <label class="l">${L("Your name", "Jouw naam")}</label><input class="nameinp" id="nm" maxlength="12" value="${esc(settings.name === "You" ? "" : settings.name)}" placeholder="${L("You", "Jij")}">
      <label class="l">${L("Pick your avatar", "Kies je avatar")}</label><div class="avgrid">${AVATARS.map((a, i) => `<button class="avb ${i === settings.avatar ? "on" : ""}" data-a="${i}" aria-label="${a.name}">${avatarSvg(i, 60)}</button>`).join("")}</div>
      <label class="l">${L("Opponents (AI)", "Tegenstanders (AI)")}</label><div class="seg" id="opp">${[2, 3].map((n) => `<button data-n="${n}" class="${settings.opponents === n ? "on" : ""}">${n} ${L("opponents", "tegenstanders")}</button>`).join("")}</div>
      <label class="l">${L("Race length", "Racelengte")}</label><div class="seg" id="len">${[["quick", L("Quick (15)", "Kort (15)")], ["long", L("Long (20)", "Lang (20)")]].map(([v, t]) => `<button data-len="${v}" class="${settings.length === v ? "on" : ""}">${t}</button>`).join("")}</div>
      <label class="l">${L("AI level", "AI-niveau")}</label><div class="seg" id="lvl">${[["easy", L("easy", "makkelijk")], ["normal", L("normal", "normaal")], ["hard", L("hard", "moeilijk")]].map(([l, nm]) => `<button data-l="${l}" class="${settings.level === l ? "on" : ""}">${nm}</button>`).join("")}</div>
      ${settingsRows(false)}
      </div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn go big" id="play">${L("Play!", "Spelen!")}</button><button class="btn alt" id="how">${L("How to play", "Uitleg")}</button></div>${saved ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" id="resume">${L("▶ Continue last game", "▶ Verder met vorig spel")}</button></div>` : ""}</div>`);
    o.querySelector("#nm").oninput = (e) => { settings.name = e.target.value; saveSettings(); };
    o.querySelectorAll(".avb").forEach((b) => (b.onclick = () => { settings.avatar = +b.dataset.a; saveSettings(); const v = o.querySelector("#nm").value; draw(); o.querySelector("#nm").value = v; }));
    o.querySelectorAll("#opp button").forEach((b) => (b.onclick = () => { settings.opponents = +b.dataset.n; saveSettings(); draw(); }));
    o.querySelectorAll("#len button").forEach((b) => (b.onclick = () => { settings.length = b.dataset.len; saveSettings(); draw(); }));
    o.querySelectorAll("#lvl button").forEach((b) => (b.onclick = () => { settings.level = b.dataset.l; saveSettings(); draw(); }));
    wireSettings(o, draw);
    o.querySelector("#play").onclick = () => { unlockAudio(); settings.name = o.querySelector("#nm").value.trim(); saveSettings(); startGame(); };
    const rs = o.querySelector("#resume");
    if (rs) rs.onclick = () => { unlockAudio(); startGame(saved); };
    o.querySelector("#how").onclick = openHelp;
  };
  draw();
}

$("btnSet").onclick = openSettings;
$("btnHelp").onclick = openHelp;
$("btnLog").onclick = openLog;
// Rebuild the board whenever its box really changes size (the footer text above changes height as turns go by,
// which used to leave the bottom row clipped until the window was resized).
let rz;
const refit = () => { if (s && (Math.abs($("board").clientWidth - geo.w) > 1 || Math.abs($("board").clientHeight - geo.h) > 1)) { buildBoard(); for (const g of GOAT_IDS) goatEls[g].dataset.key = ""; renderGoats(); } };
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(refit, 100); });
if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(refit, 60); }).observe($("board"));

// ---------------------------------------------------------------- splash
function showSplash() {
  const sp = $("splash");
  sp.innerHTML = `<div class="sp-in"><div class="sp-sun"></div>
    <div class="sp-goats">${GOAT_IDS.map((g, i) => `<span style="animation-delay:${i * 0.12}s">${goatSvg(g, ["love", "effort", "neutral", "dizzy", "neutral"][i], { size: 78 })}</span>`).join("")}</div>
    <h1>Mountain Mayhem<small>GOATed</small></h1>
    <p class="sp-tag">${L("Bet on goats. Climb on each other. Fall for the Ram.", "Gok op geiten. Klim op elkaar. Val voor de Ram.")}</p>
    <div class="sp-bar"><i></i></div><p class="sp-tap">${L("tap to start", "tik om te starten")}</p></div>`;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    unlockAudio(); sfx("baa", "yellow");
    sp.classList.add("gone");
    setTimeout(() => sp.remove(), 600);
  };
  sp.onclick = go;
  setTimeout(go, 3200);
}

// A placeholder game so the HUD has something to draw behind the start screen.
(function boot() {
  s = newGame({ players: 4, seed: 7 });
  seats = [0, 1, 2, 3].map((i) => ({ name: i === 0 ? myName() : AVATARS[i].name, avatar: i, human: i === 0 }));
  showSplash(); // first, so a boot error below can never leave an undismissable cover
  applyLang();
  buildBoard(); renderGoats(); renderHud();
  showStart();
})();
