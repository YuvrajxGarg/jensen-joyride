// Procedural sound, all WebAudio, no files. Starts on the first gesture.
// Two music moods (run, boss) share one sequencer; SFX are short synth one-shots.

let ctx = null;
let master, musicBus, sfxBus, thrustGain, thrustFilter;
let timer = null;
let next = 0;
let step = 0;
let mood = "run";
let muted = false;
try {
  muted = localStorage.getItem("jj-muted") === "1";
} catch {
  /* storage blocked */
}

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Run: bright major loop (C - Am - F - G). Boss: driving minor loop (Dm - Bb - C - A).
const SONGS = {
  run: {
    bpm: 132,
    bass: [36, 33, 29, 31],
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    lead: [0, 4, 7, 12, 7, 4, 9, 7, 0, 4, 7, 11, 12, 11, 7, 4],
  },
  boss: {
    bpm: 150,
    bass: [38, 34, 36, 33],
    chords: [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 61, 64]],
    lead: [0, 3, 7, 3, 12, 7, 3, 7, 0, 3, 8, 7, 3, 2, 0, 2],
  },
  menu: {
    bpm: 104,
    bass: [36, 33, 29, 31],
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    lead: null,
  },
};

export const isMuted = () => muted;

export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem("jj-muted", m ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}

export function start() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.2;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(master);
    // looping jet noise, gain driven by thrust
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2);
    src.loop = true;
    thrustFilter = ctx.createBiquadFilter();
    thrustFilter.type = "bandpass";
    thrustFilter.frequency.value = 900;
    thrustFilter.Q.value = 0.8;
    thrustGain = ctx.createGain();
    thrustGain.gain.value = 0;
    src.connect(thrustFilter);
    thrustFilter.connect(thrustGain);
    thrustGain.connect(sfxBus);
    src.start();
  }
  if (ctx.state === "suspended") ctx.resume();
  if (!timer) {
    next = ctx.currentTime + 0.08;
    timer = setInterval(schedule, 40);
  }
}

export function setMood(m) {
  if (m !== mood) {
    mood = m;
    step = 0;
  }
}

export function thrust(on) {
  if (!thrustGain) return;
  thrustGain.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, on ? 0.03 : 0.08);
  thrustFilter.frequency.setTargetAtTime(on ? 1300 : 600, ctx.currentTime, 0.1);
}

let noiseCache = null;
function noiseBuffer(sec = 1) {
  if (noiseCache && sec <= 1) return noiseCache;
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (sec <= 1) noiseCache = b;
  return b;
}

function schedule() {
  const song = SONGS[mood];
  const six = 60 / song.bpm / 4;
  while (next < ctx.currentTime + 0.18) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const t = next;
    const busy = mood !== "menu";
    if (s === 0 || s === 8 || (busy && s === 10) || (mood === "boss" && s === 6)) kick(t);
    if (s === 4 || s === 12) snare(t);
    if (busy ? s % 2 === 0 : s % 4 === 2) hat(t, s % 4 === 2 ? 0.5 : 0.25);
    if (s % 4 === 0 || (busy && s % 4 === 3)) bass(t, hz(song.bass[bar] + (s === 12 ? 12 : 0)), six * 1.6);
    if (s === 0) pad(t, song.chords[bar], six * 16);
    if (song.lead && s % 2 === 0) {
      const n = song.lead[(s + bar * 2) % 16];
      if (!(bar === 3 && s > 10)) lead(t, hz(song.chords[bar][0] + 12 + n - (n > 9 ? 12 : 0)), six * 1.4);
    }
    next += six;
    step++;
  }
}

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function osc(type, f, t, dur, peak, bus = sfxBus, a = 0.005) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  env(g, t, a, peak, dur);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + a + dur + 0.05);
  return o;
}

function noise(t, dur, peak, freq = 2000, type = "highpass", bus = sfxBus) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  env(g, t, 0.002, peak, dur);
  s.connect(f);
  f.connect(g);
  g.connect(bus);
  s.start(t);
  s.stop(t + dur + 0.05);
  return f;
}

function kick(t) {
  const o = osc("sine", 150, t, 0.22, 0.9, musicBus);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
}
function snare(t) {
  noise(t, 0.14, 0.5, 1500, "highpass", musicBus);
  osc("triangle", 190, t, 0.08, 0.3, musicBus);
}
function hat(t, v) {
  noise(t, 0.035, 0.22 * v, 7000, "highpass", musicBus);
}
function bass(t, f, d) {
  const o = osc("sawtooth", f, t, d, 0.35, musicBus);
  o.detune.value = -4;
}
function pad(t, notes, d) {
  for (const n of notes) osc("triangle", hz(n), t, d * 0.9, 0.07, musicBus, 0.04);
}
function lead(t, f, d) {
  osc("square", f, t, d, 0.08, musicBus);
}

const now = () => (ctx ? ctx.currentTime : 0);
const ready = () => ctx && !muted;

export const sfx = {
  chip() {
    if (!ready()) return;
    const t = now();
    osc("square", 1320, t, 0.05, 0.12);
    osc("square", 1760, t + 0.04, 0.07, 0.1);
  },
  hit() {
    if (!ready()) return;
    const t = now();
    noise(t, 0.4, 0.8, 600, "lowpass");
    const o = osc("sawtooth", 220, t, 0.4, 0.4);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.4);
  },
  zap() {
    if (!ready()) return;
    const t = now();
    const o = osc("sawtooth", 900, t, 0.25, 0.25);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.25);
  },
  warn() {
    if (!ready()) return;
    const t = now();
    osc("square", 1046, t, 0.07, 0.14);
    osc("square", 1046, t + 0.12, 0.07, 0.14);
  },
  launch() {
    if (!ready()) return;
    const t = now();
    const f = noise(t, 0.5, 0.45, 400, "bandpass");
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.45);
  },
  flash() {
    if (!ready()) return;
    const t = now();
    noise(t, 0.08, 0.7, 4000);
    osc("sine", 3000, t, 0.25, 0.08);
  },
  charge() {
    if (!ready()) return;
    const t = now();
    const o = osc("sine", 400, t, 0.9, 0.12, sfxBus, 0.6);
    o.frequency.exponentialRampToValueAtTime(1600, t + 1.2);
  },
  power() {
    if (!ready()) return;
    const t = now();
    [0, 4, 7, 12, 16].forEach((n, i) => osc("square", hz(72 + n), t + i * 0.06, 0.12, 0.12));
  },
  boom() {
    if (!ready()) return;
    const t = now();
    noise(t, 0.8, 0.9, 300, "lowpass");
    const o = osc("sine", 120, t, 0.6, 0.6);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
  },
  bossIn() {
    if (!ready()) return;
    const t = now();
    [50, 53, 57, 62].forEach((n, i) => osc("sawtooth", hz(n), t + i * 0.12, 0.5, 0.2));
    noise(t + 0.48, 0.5, 0.4, 800, "lowpass");
  },
  bossHit() {
    if (!ready()) return;
    const t = now();
    osc("square", 330, t, 0.1, 0.2);
    osc("square", 660, t + 0.05, 0.12, 0.15);
    noise(t, 0.12, 0.3, 2500);
  },
  win() {
    if (!ready()) return;
    const t = now();
    [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => osc("square", hz(n + 12), t + i * 0.08, 0.16, 0.12));
  },
  stamp() {
    if (!ready()) return;
    const t = now();
    noise(t, 0.25, 0.9, 500, "lowpass");
    osc("sine", 80, t, 0.3, 0.6);
  },
  click() {
    if (!ready()) return;
    osc("square", 880, now(), 0.04, 0.1);
  },
  coinBank() {
    if (!ready()) return;
    const t = now();
    for (let i = 0; i < 6; i++) osc("square", 1400 + i * 120, t + i * 0.05, 0.05, 0.08);
  },
};
