// Smoke test: play full games in headless Chromium (3 and 4 players) and fail on any page error.
// The human seat always Runs; the bots use every action. Usage: node smoke.mjs  (CHROME=/path to use a local browser)
import { chromium } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = join(import.meta.dirname, "web");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(ROOT, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
let failed = false;
for (const opponents of [2, 3]) {
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript((o) => localStorage.setItem("mm-settings", JSON.stringify({ opponents: o, lang: "en", sound: false, length: "quick" })), opponents);
  await page.goto(`http://localhost:${port}/index.html?speed=0.03`);
  await page.click("#splash").catch(() => {});
  await page.click("#play");
  const t0 = Date.now();
  let runs = 0, done = false;
  while (!done && Date.now() - t0 < 240000 && !errors.length) {
    if (await page.$("#again")) { done = true; break; }
    const nx = await page.$("#nx");
    if (nx && (await nx.isVisible())) { await nx.click().catch(() => {}); continue; }
    const run = await page.$("#aRun:not([disabled])");
    if (run) { await run.click().catch(() => {}); runs++; }
    await page.waitForTimeout(50);
  }
  const ok = done && !errors.length;
  console.log(`${opponents + 1} players: ${ok ? "finished" : "FAILED"} in ${((Date.now() - t0) / 1000).toFixed(1)}s, human ran ${runs} times${errors.length ? "\n  " + errors.join("\n  ") : done ? "" : " (timed out)"}`);
  if (!ok) { failed = true; await page.screenshot({ path: `smoke-fail-${opponents + 1}p.png` }); }
  await page.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
