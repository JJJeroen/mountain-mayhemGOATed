// node export-art.mjs  -> writes standalone SVG files to assets/ (goats, ram, avatars)
import { mkdirSync, writeFileSync } from "node:fs";
import { goatSvg, ramSvg, avatarSvg, AVATARS } from "./art.js";
mkdirSync("assets/goats", { recursive: true });
mkdirSync("assets/avatars", { recursive: true });
for (const id of ["blue", "yellow", "green", "orange", "white"])
  for (const e of ["neutral", "effort", "dizzy", "love"]) writeFileSync(`assets/goats/${id}-${e}.svg`, goatSvg(id, e, { size: 400 }));
for (const id of ["blue", "yellow", "green", "orange", "white"]) writeFileSync(`assets/goats/${id}-mud.svg`, goatSvg(id, "effort", { mud: true, size: 400 }));
writeFileSync("assets/ram.svg", ramSvg(600));
AVATARS.forEach((a, i) => writeFileSync(`assets/avatars/${String(i + 1).padStart(2, "0")}-${a.name.toLowerCase()}.svg`, avatarSvg(i, 300)));
console.log("exported");
