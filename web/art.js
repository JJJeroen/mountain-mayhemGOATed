// Mountain Mayhem: GOATed - artwork. Everything is hand-written vector SVG, returned as strings.
// goatSvg(id, expr, {mud})  expr: neutral | effort | dizzy | love
// ramSvg()                  the handsome Ram
// avatarSvg(i)              12 player avatars (AVATARS[i])
const O = "#3b2a22"; // outline

const GOAT_ART = {
  blue:   { main: "#4f95e8", dark: "#2f6fc0", light: "#cfe5ff", horn: "#f3e6c4" },
  yellow: { main: "#f7c52b", dark: "#d89a0c", light: "#fff0a8", horn: "#fff4d8" },
  green:  { main: "#58b868", dark: "#388a48", light: "#d3f2d3", horn: "#efe3bf" },
  orange: { main: "#f5882d", dark: "#d0621a", light: "#ffd9a8", horn: "#fff0cf" },
  white:  { main: "#f8f4ee", dark: "#d6cdc2", light: "#ffffff", horn: "#f0d9b5" },
};

const heart = (x, y, s, fill = "#e8355a") =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4 C-9 -3 -5 -10 0 -5 C5 -10 9 -3 0 4Z" fill="${fill}" stroke="${O}" stroke-width="${1.6 / s}" stroke-linejoin="round"/>`;
const spiral = (cx, cy, r) => {
  let d = `M${cx} ${cy}`;
  for (let a = 0; a <= 4.2 * Math.PI; a += 0.4) d += ` L${(cx + (r * a) / 13 * Math.cos(a)).toFixed(1)} ${(cy + (r * a) / 13 * Math.sin(a)).toFixed(1)}`;
  return `<path d="${d}" fill="none" stroke="${O}" stroke-width="1.7" stroke-linecap="round"/>`;
};

/** Goat facing right. viewBox 0 0 130 112. */
export function goatSvg(id, expr = "neutral", { mud = false, size = 100 } = {}) {
  const c = GOAT_ART[id];
  const wellies = id === "blue", springs = id === "orange";
  const S = `stroke="${O}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
  const leg = (x, fill) => {
    let s = `<rect x="${x}" y="76" width="9" height="24" rx="4" fill="${fill}" ${S}/>`;
    if (wellies) s += `<path d="M${x - 2} 88 h13 v14 q0 4 -4 4 h-9 q-3 0 -3 -4z" fill="#f3c63a" ${S}/><rect x="${x - 2}" y="88" width="13" height="4" fill="#d9a914" stroke="${O}" stroke-width="1.5"/>`;
    else if (springs) s += `<path d="M${x + 4.5} 98 l-6 2 l12 3 l-12 3 l12 3 l-6 2" fill="none" ${S}/><rect x="${x - 1}" y="106" width="11" height="3" rx="1.5" fill="${O}"/>`;
    else s += `<path d="M${x - 1} 98 h11 v4 q0 3 -3 3 h-5 q-3 0 -3 -3z" fill="#4a3a30" ${S}/>`;
    return s;
  };
  let g = "";
  // tail
  g += `<path d="M26 66 Q10 60 14 44 Q22 50 30 58z" fill="${c.main}" ${S}/>`;
  if (id === "white") g += `<circle cx="14" cy="44" r="6" fill="#fff" ${S}/><circle cx="20" cy="40" r="4.5" fill="#ffd5e6" ${S}/>`;
  // far legs
  g += leg(38, c.dark) + leg(74, c.dark);
  // body
  g += `<ellipse cx="54" cy="68" rx="33" ry="22" fill="${c.main}" ${S}/>`;
  g += `<ellipse cx="56" cy="80" rx="22" ry="8" fill="${c.light}" opacity=".75"/>`;
  g += `<path d="M30 58 Q42 50 56 52" fill="none" stroke="${c.dark}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`;
  if (id === "yellow") g += `<path d="M48 54 l12 -2 l-5 12 l9 -1 l-16 18 l4 -14 l-8 1z" fill="#f08a1c" ${S} stroke-width="1.8"/>`;
  if (id === "white") for (const [x, y, r] of [[28, 58, 7], [38, 50, 8], [50, 47, 8], [62, 48, 8], [72, 54, 7], [74, 66, 6]]) g += `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffd0e4" ${S} stroke-width="2"/>`;
  // near legs
  g += leg(30, c.main) + leg(66, c.main);
  // neck
  g += `<ellipse cx="82" cy="54" rx="13" ry="20" transform="rotate(-30 82 54)" fill="${c.main}" ${S}/>`;
  if (id === "green") g += `<path d="M74 60 l-9 -7 q-2 -2 -2 3 l2 10 q1 3 4 0z M74 60 l9 -4 q3 -1 3 2 l-1 9 q-1 3 -4 1z" fill="#c64fb0" ${S} stroke-width="2"/><circle cx="75" cy="60" r="3.2" fill="#8d2f7d" ${S} stroke-width="1.6"/>`;
  if (id === "white") for (const [x, y] of [[76, 40], [84, 46], [80, 54], [88, 58]]) g += `<circle cx="${x}" cy="${y}" r="6" fill="#ffd0e4" ${S} stroke-width="2"/>`;
  // beard
  g += `<path d="M99 52 Q94 70 101 76 Q108 68 108 54z" fill="${c.dark}" ${S}/>`;
  if (id === "green") g += `<path d="M96 52 Q88 70 100 80 Q112 70 110 54z" fill="${c.dark}" ${S}/>`;
  // ears + horns (behind head)
  if (id === "blue") g += `<path d="M84 36 Q70 40 72 60 Q82 58 88 44z" fill="${c.dark}" ${S}/><path d="M82 42 Q76 48 77 55" fill="none" stroke="#ffb3c1" stroke-width="3" stroke-linecap="round"/>`;
  else g += `<g transform="rotate(14 82 38)"><ellipse cx="78" cy="38" rx="15" ry="6.5" fill="${c.dark}" ${S}/><ellipse cx="76" cy="38" rx="9" ry="3" fill="#ffb3c1"/></g>`;
  const horn = (d, w = 6) => `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c.horn}" stroke-width="${w}" stroke-linecap="round"/>`;
  if (id === "orange") g += horn("M88 28 Q80 12 92 2") + horn("M99 26 Q112 18 108 6 Q116 6 118 14", 5);
  else if (id === "white") g += horn("M90 28 Q84 12 94 6 Q92 14 98 18") + horn("M100 26 Q106 12 98 8", 5);
  else g += horn("M90 28 Q82 10 96 4") + horn("M100 26 Q108 14 100 6", 5);
  // head
  g += `<ellipse cx="96" cy="40" rx="18" ry="16" fill="${c.main}" ${S}/>`;
  g += `<ellipse cx="110" cy="48" rx="12" ry="9.5" fill="${c.light}" ${S}/>`;
  g += `<ellipse cx="118" cy="44" rx="2.4" ry="2" fill="${O}"/><ellipse cx="114" cy="42" rx="1.4" ry="1.1" fill="${O}" opacity=".6"/>`;
  if (id === "yellow") g += `<path d="M82 31 Q98 20 113 33" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M82 31 Q98 20 113 33" fill="none" stroke="#e53b3b" stroke-width="5.5" stroke-linecap="round"/><path d="M82 31 q-10 -2 -14 6 M82 31 q-9 4 -10 12" fill="none" stroke="#e53b3b" stroke-width="3.6" stroke-linecap="round"/>`;
  if (id === "white") g += `<g transform="translate(96 22)"><path d="M0 0 l-13 -8 q-4 8 0 14z M0 0 l13 -8 q4 8 0 14z" fill="#ff5ca8" ${S} stroke-width="2"/><circle r="3.6" fill="#ff8cc4" ${S} stroke-width="2"/></g>`;
  // cheek blush
  g += `<ellipse cx="103" cy="49" rx="5" ry="3" fill="#ff7a8a" opacity="${expr === "love" ? 0.7 : 0.35}"/>`;

  // eyes & mouth by expression
  const ex = 99, ey = 37;
  const bigEye = (x, y, r, px = 1.2, py = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S} stroke-width="2"/><circle cx="${x + px}" cy="${y + py}" r="${r * 0.45}" fill="${O}"/><circle cx="${x + px + r * 0.15}" cy="${y + py - r * 0.18}" r="${r * 0.14}" fill="#fff"/>`;
  let eyes = "", mouth = "", extra = "";
  const sunnies = id === "white";
  if (expr === "neutral") {
    eyes = id === "orange" ? bigEye(ex - 4, ey, 8.2, 2, 1) + bigEye(ex + 9, ey + 3, 4.6, -1, 1) : id === "yellow" ? bigEye(ex, ey, 7.4, 2.4, 0) : bigEye(ex, ey, 6.4);
    if (id === "green") eyes += `<path d="M${ex - 7} ${ey - 2} h14" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/><path d="M${ex - 7} ${ey - 2} h14 v-5 h-14z" fill="${c.main}" opacity=".0"/>`;
    mouth = id === "yellow" ? `<path d="M104 53 Q112 59 118 52" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/><rect x="109" y="55" width="4.6" height="6" rx="1" fill="#fff" ${S} stroke-width="1.6"/><rect x="114" y="54" width="4.6" height="6" rx="1" fill="#fff" ${S} stroke-width="1.6"/>`
      : `<path d="M104 53 Q111 59 118 52" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>`;
  } else if (expr === "effort") {
    eyes = `<path d="M${ex - 7} ${ey + 1} Q${ex} ${ey - 5} ${ex + 7} ${ey + 1}" fill="#fff" ${S} stroke-width="2"/><circle cx="${ex + 1}" cy="${ey}" r="2.2" fill="${O}"/><path d="M${ex - 9} ${ey - 8} L${ex + 8} ${ey - 3}" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>`;
    mouth = `<path d="M103 51 h16 q0 8 -8 8 q-8 0 -8 -8z" fill="#7a2b2b" ${S} stroke-width="2"/><path d="M105 52 h12 v3 h-12z" fill="#fff"/>`;
    extra = `<path d="M84 22 q-4 8 0 11 q4 -3 0 -11z" fill="#7fd0ff" ${S} stroke-width="1.6"/><path d="M122 58 l9 3 M121 63 l9 6" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>`;
  } else if (expr === "dizzy") {
    eyes = `<circle cx="${ex}" cy="${ey}" r="7.2" fill="#fff" ${S} stroke-width="2"/>${spiral(ex, ey, 6.4)}`;
    mouth = `<path d="M104 53 q4 3 8 0 q3 -2 6 1" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/><path d="M110 55 q1 12 6 9 q3 -3 0 -9z" fill="#ff6f8a" ${S} stroke-width="1.8"/>`;
    extra = `<g transform="translate(92 10)"><path d="M-14 0 l2 -5 l2 5 l5 1 l-5 2 l-2 5 l-2 -5 l-5 -2z" fill="#ffe14a" ${S} stroke-width="1.5"/><path d="M12 -2 l1.6 -4 l1.6 4 l4 1 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6z" fill="#ffe14a" ${S} stroke-width="1.5"/></g>`;
  } else if (expr === "love") {
    eyes = heart(ex, ey + 1, 1.15) + `<path d="M${ex + 6} ${ey - 5} q4 0 4 4" fill="none" stroke="#fff" stroke-width="1.5" opacity="0"/>`;
    mouth = `<path d="M104 52 Q111 62 118 51" fill="#7a2b2b" ${S} stroke-width="2.2"/><path d="M108 56 q3 4 8 0" fill="#ff6f8a" stroke="none"/>`;
    extra = heart(78, 12, 1.1) + heart(122, 20, 0.9, "#ff7aa8") + heart(64, 28, 0.7, "#ff9ec0");
  }
  if (id === "yellow" && expr !== "love" && expr !== "neutral") { /* keep buck teeth only when neutral */ }
  g += eyes + mouth;
  // glasses / sunglasses (over eyes)
  if (id === "green") {
    g += `<circle cx="${ex}" cy="${ey}" r="9.4" fill="#fff" fill-opacity=".25" ${S} stroke-width="2.2"/><path d="M${ex - 9.4} ${ey} L84 33" stroke="${O}" stroke-width="2.2"/>`;
  }
  if (sunnies) {
    const lens = expr === "love" ? heart(ex + 1, ey + 2, 1.9, "#ff3d77") : expr === "dizzy" ? `<ellipse cx="${ex + 1}" cy="${ey + 1}" rx="10" ry="8" fill="#222" ${S} stroke-width="2.2" transform="rotate(-18 ${ex} ${ey})"/>${spiral(ex + 1, ey + 1, 6).replace(O, "#ff9ad0")}` : `<path d="M${ex - 10} ${ey - 5} h20 q0 14 -10 14 q-10 0 -10 -14z" fill="#262033" ${S} stroke-width="2.2"/><path d="M${ex - 6} ${ey - 2} l5 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
    g += lens + `<path d="M${ex - 10} ${ey - 3} L84 32" stroke="${O}" stroke-width="2.4"/>` + `<path d="M${ex + 6} ${ey - 7} l5 -3 M${ex + 10} ${ey - 3} l6 -1" stroke="${O}" stroke-width="2" stroke-linecap="round"/>`;
  }
  g += extra;
  if (mud) {
    const m = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#7a5230" stroke="#5a3a20" stroke-width="1.4" opacity=".92"/>`;
    g += m(40, 74, 9, 5) + m(64, 62, 7, 4) + m(32, 96, 8, 5) + m(70, 98, 8, 5) + m(104, 38, 4, 3) + m(90, 48, 3, 2.4) + m(80, 82, 6, 3.4) + m(86, 64, 3, 2);
    g += `<circle cx="22" cy="94" r="2.2" fill="#7a5230"/><circle cx="52" cy="90" r="1.8" fill="#7a5230"/><circle cx="108" cy="28" r="1.8" fill="#7a5230"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -2 138 116" width="${size}" height="${(size * 116) / 138}">${g}</svg>`;
}

/** The Ram: stands on a little hill, faces left, very pleased with himself. */
export function ramSvg(size = 160) {
  const S = `stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  let g = "";
  g += `<ellipse cx="100" cy="150" rx="86" ry="14" fill="#6aa84f" ${S}/>`;
  // legs
  for (const x of [58, 82, 112, 134]) g += `<rect x="${x}" y="108" width="12" height="38" rx="5" fill="#8a6a50" ${S}/><path d="M${x - 1} 140 h14 v6 q0 4 -4 4 h-6 q-4 0 -4 -4z" fill="#3b2a22" ${S}/>`;
  // fluffy wool body
  const wool = [[60, 92, 22], [82, 84, 24], [106, 84, 24], [130, 92, 22], [74, 108, 20], [100, 110, 22], [124, 108, 18], [90, 70, 20], [116, 72, 18]];
  for (const [x, y, r] of wool) g += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff8ea" ${S}/>`;
  for (const [x, y, r] of wool) g += `<circle cx="${x + 1}" cy="${y - 1}" r="${r - 4}" fill="#fff8ea"/>`;
  // neck + head (facing left)
  g += `<ellipse cx="48" cy="82" rx="16" ry="22" transform="rotate(20 48 82)" fill="#c9a37a" ${S}/>`;
  // horns: big spirals
  const hornPath = "M34 56 C14 40 18 6 50 8 C72 10 74 40 54 42 C42 44 40 30 50 26";
  g += `<path d="${hornPath}" fill="none" stroke="${O}" stroke-width="17" stroke-linecap="round"/><path d="${hornPath}" fill="none" stroke="#f1d27a" stroke-width="12" stroke-linecap="round"/><path d="${hornPath}" fill="none" stroke="#b8902e" stroke-width="2" stroke-dasharray="4 7" stroke-linecap="round"/>`;
  g += `<ellipse cx="56" cy="64" rx="22" ry="22" fill="#d9b48a" ${S}/>`;
  // muzzle
  g += `<ellipse cx="42" cy="76" rx="18" ry="14" fill="#f0d6b8" ${S}/><ellipse cx="30" cy="72" rx="4.4" ry="3.4" fill="${O}"/>`;
  // ear
  g += `<ellipse cx="72" cy="66" rx="12" ry="6" transform="rotate(30 72 66)" fill="#c9a37a" ${S}/>`;
  // sunglasses + brow
  g += `<path d="M36 52 h20 q0 14 -10 14 q-10 0 -10 -14z" fill="#1d1b2a" ${S} stroke-width="2.4"/><path d="M60 54 h16 q0 12 -8 12 q-8 0 -8 -12z" fill="#1d1b2a" ${S} stroke-width="2.4"/><path d="M56 56 h4" stroke="${O}" stroke-width="2.6"/><path d="M39 56 l6 0 M63 58 l5 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
  // smug smile + moustache + chin tuft
  g += `<path d="M24 84 Q40 98 52 84" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`;
  g += `<path d="M42 76 q-10 -4 -18 4 q8 8 18 -2z M42 76 q10 -4 14 4 q-6 6 -14 -2z" fill="#6b4a35" ${S} stroke-width="2"/>`;
  g += `<path d="M34 94 q-2 12 4 16 q6 -6 4 -16z" fill="#6b4a35" ${S} stroke-width="2"/>`;
  // flower behind the ear
  g += `<g transform="translate(76 52)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-6" rx="3.6" ry="5.4" transform="rotate(${a})" fill="#ff6fa5" ${S} stroke-width="1.6"/>`).join("")}<circle r="3.2" fill="#ffe14a" ${S} stroke-width="1.6"/></g>`;
  // hearts
  g += heart(14, 24, 1.3) + heart(30, 6, 0.9, "#ff7aa8") + heart(4, 46, 0.8, "#ff9ec0");
  // bow tie
  g += `<path d="M62 94 l-12 -6 v14z M62 94 l12 -6 v14z" fill="#e8355a" ${S} stroke-width="2.2"/><circle cx="62" cy="94" r="3.6" fill="#b01c3f" ${S} stroke-width="1.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 208 170" width="${size}" height="${(size * 170) / 208}">${g}</svg>`;
}

/** Avatars: big-headed, friendly caricatures. */
export const AVATARS = [
  { name: "Amara",  skin: "#8d5a3b", hair: "#1c1410", style: "afro",   shirt: "#e8683a", acc: "earrings" },
  { name: "Kenji",  skin: "#f1c9a0", hair: "#14110f", style: "spiky",  shirt: "#3a6fd8", acc: "none" },
  { name: "Sofia",  skin: "#d9a07a", hair: "#4a2a18", style: "long",   shirt: "#c2398b", acc: "none" },
  { name: "Omar",   skin: "#c68b5f", hair: "#1c1410", style: "short",  shirt: "#2f9e6b", acc: "beard" },
  { name: "Priya",  skin: "#b9774a", hair: "#140d0a", style: "braid",  shirt: "#f2b620", acc: "earrings" },
  { name: "Lars",   skin: "#fbd9c0", hair: "#e6b84a", style: "beanie", shirt: "#4f6d7a", acc: "beard" },
  { name: "Mei",    skin: "#f6d3ae", hair: "#0f0d0d", style: "bun",    shirt: "#d6405a", acc: "glasses" },
  { name: "Tunde",  skin: "#5b3a26", hair: "#0f0b09", style: "bald",   shirt: "#7b4fd1", acc: "glasses" },
  { name: "Rosa",   skin: "#f3cfb2", hair: "#d9d9de", style: "granny", shirt: "#6a9e4a", acc: "glasses" },
  { name: "Jack",   skin: "#fbd5bd", hair: "#d2551f", style: "curly",  shirt: "#2b8aa8", acc: "freckles" },
  { name: "Zara",   skin: "#a96a45", hair: "#2f6bd8", style: "hijab",  shirt: "#f06a8e", acc: "none" },
  { name: "Mateo",  skin: "#d2956a", hair: "#2a170e", style: "cap",    shirt: "#e3a21a", acc: "stache" },
];

export function avatarSvg(i = 0, size = 80) {
  const a = AVATARS[i % AVATARS.length];
  const S = `stroke="${O}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
  const sk = a.skin;
  const shade = "rgba(0,0,0,.14)";
  let back = "", front = "";
  const hairF = `fill="${a.hair}" ${S}`;
  switch (a.style) {
    case "afro": back = `<circle cx="50" cy="38" r="37" ${hairF}/>`; front = `<path d="M26 40 Q30 18 50 18 Q70 18 74 40 Q62 28 50 28 Q38 28 26 40z" ${hairF} stroke-width="0"/>`; break;
    case "spiky": front = `<path d="M24 40 L22 20 L34 28 L38 10 L48 24 L56 8 L62 24 L74 12 L74 32 L78 42 Q64 26 50 26 Q36 26 24 40z" ${hairF}/>`; break;
    case "long": back = `<path d="M22 44 Q20 14 50 14 Q80 14 78 44 L82 86 L18 86z" ${hairF}/>`; front = `<path d="M26 42 Q34 22 52 24 Q66 26 74 42 Q60 32 48 34 Q36 34 26 42z" ${hairF} stroke-width="0"/>`; break;
    case "short": front = `<path d="M24 42 Q22 16 50 16 Q78 16 76 42 Q64 26 50 28 Q36 26 24 42z" ${hairF}/>`; break;
    case "braid": back = `<path d="M70 44 Q86 52 80 72 Q76 84 80 92" fill="none" stroke="${O}" stroke-width="13" stroke-linecap="round"/><path d="M70 44 Q86 52 80 72 Q76 84 80 92" fill="none" stroke="${a.hair}" stroke-width="9" stroke-linecap="round"/><circle cx="80" cy="90" r="4.4" fill="#e8355a" ${S} stroke-width="1.8"/>`; front = `<path d="M24 42 Q22 16 50 16 Q78 16 76 42 Q60 22 50 30 Q38 24 24 42z" ${hairF}/>`; break;
    case "beanie": front = `<path d="M23 40 Q22 12 50 12 Q78 12 77 40z" fill="#e8553a" ${S}/><rect x="21" y="34" width="58" height="10" rx="5" fill="#f3d9a4" ${S}/><circle cx="50" cy="10" r="6" fill="#fff" ${S}/>`; break;
    case "bun": back = `<circle cx="50" cy="12" r="11" ${hairF}/>`; front = `<path d="M24 42 Q22 16 50 16 Q78 16 76 42 Q64 28 50 30 Q36 28 24 42z" ${hairF}/>`; break;
    case "bald": front = `<ellipse cx="42" cy="26" rx="7" ry="3.2" fill="#fff" opacity=".35" stroke="none"/>`; break;
    case "granny": back = `<circle cx="50" cy="13" r="12" ${hairF}/><circle cx="50" cy="13" r="5" fill="none" stroke="${O}" stroke-width="1.6"/>`; front = `<path d="M24 44 Q22 16 50 16 Q78 16 76 44 Q66 28 50 30 Q34 28 24 44z" ${hairF}/>`; break;
    case "curly": back = [[28, 30], [40, 18], [54, 14], [68, 20], [76, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12" ${hairF}/>`).join(""); front = `<path d="M26 42 Q34 26 50 28 Q66 26 74 42 Q62 34 50 36 Q38 34 26 42z" fill="${a.hair}" stroke="none"/>`; break;
    case "hijab": back = `<path d="M18 90 Q10 20 50 12 Q90 20 82 90z" fill="${a.hair}" ${S}/>`; front = ""; break;
    case "cap": back = ""; front = `<path d="M23 40 Q22 14 50 14 Q78 14 77 40z" fill="#e63b3b" ${S}/><path d="M28 40 h56 q6 0 6 5 h-62z" fill="#c42a2a" ${S}/><circle cx="50" cy="14" r="3" fill="#c42a2a" ${S} stroke-width="1.6"/>`; break;
  }
  // shoulders + neck
  let g = back;
  if (a.style === "hijab") { /* scarf covers the neck: drawn in back */ }
  g += `<path d="M10 100 Q12 74 36 70 L64 70 Q88 74 90 100z" fill="${a.shirt}" ${S}/>`;
  g += `<rect x="42" y="62" width="16" height="12" rx="4" fill="${sk}" ${S}/>`;
  if (a.acc === "beard") g += `<path d="M26 54 Q28 84 50 84 Q72 84 74 54 Q62 66 50 66 Q38 66 26 54z" fill="${a.hair}" ${S}/>`;
  // ears
  g += `<circle cx="24" cy="50" r="6" fill="${sk}" ${S}/><circle cx="76" cy="50" r="6" fill="${sk}" ${S}/>`;
  if (a.acc === "earrings") g += `<circle cx="24" cy="58" r="3" fill="#ffd34a" ${S} stroke-width="1.6"/><circle cx="76" cy="58" r="3" fill="#ffd34a" ${S} stroke-width="1.6"/>`;
  // head
  g += `<ellipse cx="50" cy="48" rx="27" ry="28" fill="${sk}" ${S}/>`;
  g += `<ellipse cx="38" cy="58" rx="5" ry="3" fill="#ff7a8a" opacity=".35"/><ellipse cx="62" cy="58" rx="5" ry="3" fill="#ff7a8a" opacity=".35"/>`;
  if (a.style === "hijab") g += `<path d="M22 50 Q22 18 50 18 Q78 18 78 50 Q76 30 50 30 Q24 30 22 50z" fill="${a.hair}" ${S}/>`;
  // eyes
  g += `<ellipse cx="39" cy="48" rx="4.6" ry="5.4" fill="#fff" ${S} stroke-width="2"/><ellipse cx="61" cy="48" rx="4.6" ry="5.4" fill="#fff" ${S} stroke-width="2"/><circle cx="40" cy="49" r="2.4" fill="${O}"/><circle cx="62" cy="49" r="2.4" fill="${O}"/>`;
  // brows
  g += `<path d="M32 40 q7 -5 14 -1 M54 39 q7 -4 14 1" fill="none" stroke="${a.style === "granny" ? "#999" : a.style === "hijab" ? "#3a2a1a" : a.hair}" stroke-width="3" stroke-linecap="round"/>`;
  // nose (varies)
  const nose = [`<path d="M50 50 q-5 8 0 9" fill="none" ${S} stroke-width="2.2"/>`, `<ellipse cx="50" cy="56" rx="5" ry="4" fill="${sk}" ${S} stroke-width="2.2"/><path d="M45 56 h10" stroke="${shade}" stroke-width="0"/>`, `<path d="M47 54 q3 5 6 0" fill="none" ${S} stroke-width="2.2"/>`][AVATARS.indexOf(a) % 3];
  g += nose;
  // mouth (varies)
  const mouths = [
    `<path d="M38 66 Q50 78 62 66z" fill="#8a2f3a" ${S} stroke-width="2.2"/><path d="M41 67 h18 v3 h-18z" fill="#fff"/>`,
    `<path d="M39 66 Q50 74 61 65" fill="none" ${S}/>`,
    `<path d="M40 66 Q50 76 60 66 Q50 70 40 66z" fill="#8a2f3a" ${S} stroke-width="2.2"/>`,
    `<path d="M38 65 Q52 72 63 63" fill="none" ${S}/><path d="M63 63 l3 -2" ${S} stroke-width="2"/>`,
  ];
  g += mouths[AVATARS.indexOf(a) % 4];
  if (a.acc === "stache") g += `<path d="M50 62 q-8 -5 -16 2 q8 7 16 -2z M50 62 q8 -5 16 2 q-8 7 -16 -2z" fill="${a.hair}" ${S} stroke-width="2"/>`;
  if (a.acc === "freckles") g += [[36, 56], [40, 59], [33, 59], [60, 59], [64, 56], [67, 59]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#b4623a"/>`).join("");
  if (a.acc === "glasses") g += `<circle cx="39" cy="48" r="9" fill="#fff" fill-opacity=".25" ${S} stroke-width="2.2"/><circle cx="61" cy="48" r="9" fill="#fff" fill-opacity=".25" ${S} stroke-width="2.2"/><path d="M48 48 h4" ${S} stroke-width="2.2"/>`;
  g += front;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${g}</svg>`;
}

export const GOAT_BLURB = {
  blue: "Mudlark: mud? what mud. Wears wellies.",
  yellow: "Sprinter: all gas, no brakes, buck teeth.",
  green: "Steady: reads the paper, never rushes.",
  orange: "Leaper: springs on the hooves, eyes on vacation.",
  white: "Diva: sunglasses indoors, outdoors, always.",
};
