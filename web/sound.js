// Sound effects synthesised with WebAudio: no asset files. Browsers only allow audio after a tap,
// so call unlockAudio() from a click handler; until then every sfx() is a silent no-op.
let ctx = null;
let enabled = true;

export function setSoundEnabled(v) { enabled = !!v; }
export function unlockAudio() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* no audio available */ }
}

function tone(freq, at, dur, { type = "sine", gain = 0.16, to = freq } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to !== freq) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(at, dur, { gain = 0.12, freq = 400 } = {}) {
  const t = ctx.currentTime + at;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf;
  f.type = "lowpass";
  f.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

const SOUNDS = {
  click: () => tone(520, 0, 0.06, { type: "triangle", gain: 0.1 }),
  coin: () => { tone(988, 0, 0.08, { type: "square", gain: 0.07 }); tone(1319, 0.07, 0.16, { type: "square", gain: 0.07 }); },
  tick: () => tone(300 + Math.random() * 200, 0, 0.04, { type: "square", gain: 0.05 }),
  land: () => { tone(180, 0, 0.14, { to: 70, gain: 0.22 }); noise(0, 0.08, { gain: 0.08, freq: 700 }); },
  mud: () => { noise(0, 0.35, { gain: 0.2, freq: 260 }); tone(110, 0, 0.3, { to: 60, type: "sawtooth", gain: 0.06 }); },
  ram: () => { [660, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.09, 0.2, { gain: 0.1 })); tone(220, 0.4, 0.5, { to: 110, type: "triangle", gain: 0.12 }); },
  trick: () => { noise(0, 0.25, { gain: 0.1, freq: 2500 }); tone(400, 0, 0.25, { to: 900, type: "triangle", gain: 0.08 }); },
  scout: () => { tone(880, 0, 0.07); tone(1175, 0.09, 0.1); },
  pledge: () => { tone(110, 0, 0.3, { to: 55, gain: 0.3 }); tone(165, 0.18, 0.4, { to: 82, gain: 0.25 }); },
  yourTurn: () => { tone(784, 0, 0.1, { gain: 0.1 }); tone(1047, 0.1, 0.18, { gain: 0.1 }); },
  stage: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.11, 0.25, { type: "triangle", gain: 0.12 })),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.3, { type: "triangle", gain: 0.13 })),
};

export function sfx(name) {
  if (!enabled || !ctx || ctx.state !== "running") return;
  try { SOUNDS[name]?.(); } catch { /* ignore audio glitches */ }
}
