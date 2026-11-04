// Renders art-src/icon.html into every Android launcher icon and splash PNG.
// Usage (from the repo root): node art-src/render-icons.mjs   (CHROME=/path to use a local browser; needs devDependency playwright)
import { chromium } from "playwright";
import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const RES = join(ROOT, "android/app/src/main/res");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(ROOT, path)); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
await page.goto(`${base}/art-src/icon.html`);
await page.waitForFunction(() => document.querySelector("#stack svg"));
const layer = async (id) => (await page.locator("#" + id).screenshot({ omitBackground: true })).toString("base64");
const bg = await layer("bg"), fg = await layer("fg");

// Scale and composite on a canvas in the page: adaptive layers, legacy square/round icons, splash screens.
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
const out = await page.evaluate(async ({ bg, fg, DENS, SPLASH }) => {
  const load = (b) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + b; });
  const B = await load(bg), F = await load(fg);
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
  const png = (c) => c.toDataURL("image/png").split(",")[1];
  const files = {};
  // the launcher shows the middle 72dp of the 108dp layers
  const visible = (ctx, x, y, size) => { const k = 432 * 18 / 108; ctx.drawImage(B, k, k, 432 - 2 * k, 432 - 2 * k, x, y, size, size); ctx.drawImage(F, k, k, 432 - 2 * k, 432 - 2 * k, x, y, size, size); };
  for (const [d, m] of Object.entries(DENS)) {
    const L = Math.round(108 * m), I = Math.round(48 * m);
    for (const [name, img] of [["ic_launcher_background", B], ["ic_launcher_foreground", F]]) {
      const [c, x] = canvas(L, L); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, L, L); files[`mipmap-${d}/${name}.png`] = png(c);
    }
    for (const round of [false, true]) {
      const [c, x] = canvas(I, I); x.imageSmoothingQuality = "high";
      x.beginPath(); if (round) x.arc(I / 2, I / 2, I / 2, 0, 7); else x.roundRect(0, 0, I, I, I * 0.2); x.clip();
      visible(x, 0, 0, I); files[`mipmap-${d}/ic_launcher${round ? "_round" : ""}.png`] = png(c);
    }
    for (const land of [false, true]) {
      const [w, h] = land ? [...SPLASH[d]].reverse() : SPLASH[d];
      const [c, x] = canvas(w, h); x.imageSmoothingQuality = "high";
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#7cc4ef"); g.addColorStop(0.55, "#bfe6f7"); g.addColorStop(1, "#dff3c9");
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const s = Math.round(Math.min(w, h) * 0.45);
      x.save(); x.beginPath(); x.arc(w / 2, h / 2, s / 2, 0, 7); x.clip(); visible(x, (w - s) / 2, (h - s) / 2, s); x.restore();
      x.lineWidth = Math.max(2, s * 0.02); x.strokeStyle = "#3b2a22"; x.beginPath(); x.arc(w / 2, h / 2, s / 2, 0, 7); x.stroke();
      files[`drawable-${land ? "land" : "port"}-${d}/splash.png`] = png(c);
      if (d === "mdpi" && land) files["drawable/splash.png"] = png(c);
    }
  }
  return files;
}, { bg, fg, DENS, SPLASH });
for (const [f, b64] of Object.entries(out)) await writeFile(join(RES, f), Buffer.from(b64, "base64"));
console.log(`wrote ${Object.keys(out).length} files`);
await browser.close();
server.close();
