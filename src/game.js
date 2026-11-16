// The run: physics, spawning, hazards, vehicles, bosses, collisions. Pure simulation plus a render pass.
import * as D from "./draw.js";
import { sfx, thrust as thrustSound, setMood } from "./audio.js";

const { FLOOR, CEIL, H } = D;
const M = 20; // world units per metre
const PX = 110; // player screen x

export const BOSSES = {
  board: {
    name: "THE BOARD",
    intro: "The board has called a vote",
    outro: "MOTION DENIED",
    attacks: ["vote", "gavel", "vote"],
  },
  probe: {
    name: "THE PROBE",
    intro: "An independent investigation opens",
    outro: "CASE CLOSED (FOR NOW)",
    attacks: ["docs", "sweep", "docs"],
  },
  hearing: {
    name: "THE HEARING",
    intro: "The committee will come to order",
    outro: "NO FURTHER QUESTIONS",
    attacks: ["questions", "record", "questions"],
  },
  short: {
    name: "THE SHORT SELLER",
    intro: "A short report just dropped",
    outro: "SHORT SQUEEZED",
    attacks: ["candles", "crash", "candles"],
  },
  press: {
    name: "THE PRESS PACK",
    intro: "The press pack has found you",
    outro: "NO COMMENT",
    attacks: ["flashes", "lenses", "flashes"],
  },
  regulator: {
    name: "THE REGULATOR",
    intro: "Your export licence is under review",
    outro: "LICENCE GRANTED",
    attacks: ["stamp", "bans", "stamp"],
  },
};
const BOSS_ORDER = ["board", "probe", "hearing", "short", "press", "regulator"];
const BOSS_AT = [450, 1100, 1850, 2700, 3600, 4600];

const VEHICLES = {
  podium: { name: "KEYNOTE PODIUM", hint: "Tap to flip gravity" },
  mech: { name: "SUPERCHIP MECH", hint: "Tap to jump" },
  rack: { name: "SERVER RACK GLIDER", hint: "Hold to rise, let go to glide" },
};

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createRun(opts) {
  const params = new URLSearchParams(location.search);
  const startDist = Number(params.get("dist")) || 0;
  const run = {
    W: 640,
    t: 0,
    camX: startDist * M,
    speed: 250,
    hold: false,
    jacket: opts.jacket,
    best: opts.best,
    p: { y: FLOOR - 24, vy: 0, mode: "jet", grav: 1, inv: 0, onGround: true, run: 0, rot: 0, expr: "smile", exprT: 0, flip: false },
    chips: [],
    items: [],
    lasers: [],
    missiles: [],
    flashes: [],
    projs: [],
    beams: [],
    ballots: [],
    shots: [],
    parts: [],
    boss: null,
    bossIdx: 0,
    bossPending: 0,
    banner: null,
    spawnX: startDist * M + 700,
    missileCd: 4,
    flashCd: 9,
    itemCd: 250,
    magnetCd: 350,
    magnet: 0,
    state: "run", // run | dying | down
    deadT: 0,
    lastChipDist: startDist,
    stats: { chips: 0, dist: 0, dodgeMissile: 0, dodgeFlash: 0, bosses: 0, ground: 0, vehicles: 0, frugal: 0, ceiling: 0, nearLaser: 0, parachutes: 0 },
    events: [], // for UI: {type, ...}
    shake: 0,
  };
  // skip past bosses already behind a debug start
  while (run.bossIdx < BOSS_AT.length && BOSS_AT[run.bossIdx] < startDist) run.bossIdx++;
  const forced = params.get("boss");
  if (forced && BOSSES[forced]) run.forceBoss = forced;
  return run;
}

export const dist = (r) => Math.floor(r.camX / M);

function nextBossDist(r) {
  if (r.bossIdx < BOSS_AT.length) return BOSS_AT[r.bossIdx];
  return BOSS_AT[BOSS_AT.length - 1] + (r.bossIdx - BOSS_AT.length + 1) * 1000;
}

// ---------------------------------------------------------------- input
export function setHold(r, on) {
  const was = r.hold;
  r.hold = on;
  if (on && !was) tap(r);
}

function tap(r) {
  const p = r.p;
  if (r.state !== "run") return;
  if (p.mode === "podium") {
    p.grav *= -1;
    p.vy = 0;
    sfx.zap();
  } else if (p.mode === "mech" && p.onGround) {
    p.vy = -620;
    p.onGround = false;
    sfx.launch();
  }
}

// ---------------------------------------------------------------- bounds and hitboxes
function bounds(p) {
  switch (p.mode) {
    case "podium":
      return [CEIL + 27, FLOOR - 27];
    case "mech":
      return [CEIL + 66, FLOOR - 33];
    case "rack":
      return [CEIL + 56, FLOOR - 20];
    default:
      return [CEIL + 36, FLOOR - 24];
  }
}

function hitCircles(p) {
  const g = p.mode === "podium" ? p.grav : 1;
  const L = {
    jet: [[0, -20, 9], [0, 0, 9], [0, 14, 6]],
    dead: [],
    podium: [[0, -40, 9], [0, -20, 9], [0, 10, 15]],
    mech: [[0, -62, 9], [0, -36, 11], [0, 0, 19], [0, 22, 11]],
    rack: [[0, -50, 9], [0, -28, 9], [0, 2, 16]],
  }[p.mode];
  return L.map(([x, y, rr]) => [PX + x, p.y + y * g, rr]);
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy || 1;
  const k = clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1);
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}

function hitsSegment(r, ax, ay, bx, by, thick) {
  let min = 1e9;
  for (const [cx, cy, cr] of hitCircles(r.p)) {
    const d = segDist(cx, cy, ax, ay, bx, by) - cr;
    if (d < min) min = d;
  }
  return min - thick;
}

function hitsCircle(r, x, y, rad) {
  for (const [cx, cy, cr] of hitCircles(r.p)) if (Math.hypot(cx - x, cy - y) < cr + rad) return true;
  return false;
}

// ---------------------------------------------------------------- spawning
function spawnPattern(r) {
  const d = dist(r);
  const diff = clamp(d / 2600, 0, 1);
  const x0 = r.spawnX;
  const roll = Math.random();
  let len = 0;
  if (roll < 0.34) len = spawnChips(r, x0);
  else if (roll < 0.86) len = spawnLasers(r, x0, diff);
  else len = spawnCrash(r, x0, diff);
  r.spawnX += len + rnd(260, 420) - diff * 120;
}

const CHIP_GAP = 18;

function spawnChips(r, x0) {
  const kind = pick(["rows", "wave", "block", "word", "arc"]);
  const yc = rnd(CEIL + 60, FLOOR - 50);
  const put = (x, y) => r.chips.push({ x, y, vx: 0, vy: 0 });
  if (kind === "rows") {
    const rows = pick([1, 2, 3]);
    const n = Math.floor(rnd(10, 18));
    for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) put(x0 + i * CHIP_GAP, yc + (j - (rows - 1) / 2) * CHIP_GAP);
    return n * CHIP_GAP;
  }
  if (kind === "wave") {
    const n = 26;
    for (let i = 0; i < n; i++) put(x0 + i * CHIP_GAP, clamp(yc + Math.sin(i / 3.2) * 60, CEIL + 20, FLOOR - 20));
    return n * CHIP_GAP;
  }
  if (kind === "arc") {
    const n = 20;
    for (let i = 0; i < n; i++) put(x0 + i * CHIP_GAP, FLOOR - 30 - Math.sin((i / (n - 1)) * Math.PI) * 180);
    return n * CHIP_GAP;
  }
  if (kind === "block") {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) put(x0 + i * CHIP_GAP, clamp(yc, CEIL + 60, FLOOR - 60) + (j - 2) * CHIP_GAP);
    return 8 * CHIP_GAP;
  }
  // a word in chips
  const glyphs = {
    A: ["01110", "10001", "11111", "10001", "10001"],
    I: ["111", "010", "010", "010", "111"],
    G: ["01111", "10000", "10011", "10001", "01110"],
    P: ["11110", "10001", "11110", "10000", "10000"],
    U: ["10001", "10001", "10001", "10001", "01110"],
    $: ["01111", "10100", "01110", "00101", "11110"],
  };
  const word = pick(["AI", "GPU", "$$$"]);
  let cx = x0;
  const top = clamp(yc, CEIL + 70, FLOOR - 70) - 2 * CHIP_GAP;
  for (const ch of word) {
    const gl = glyphs[ch];
    for (let row = 0; row < gl.length; row++)
      for (let col = 0; col < gl[row].length; col++) if (gl[row][col] === "1") put(cx + col * CHIP_GAP, top + row * CHIP_GAP);
    cx += (gl[0].length + 1) * CHIP_GAP;
  }
  return cx - x0;
}

function spawnLasers(r, x0, diff) {
  const n = Math.random() < 0.3 + diff * 0.4 ? 2 : 1;
  let x = x0;
  for (let i = 0; i < n; i++) {
    const len = rnd(70, 130 + diff * 50);
    const ang = pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI / 2]);
    const hy = (Math.abs(Math.sin(ang)) * len) / 2 + 12;
    const y = rnd(CEIL + hy, FLOOR - hy);
    const L = { x: x + 40, y, len, ang, spin: 0, minD: 1e9, counted: false };
    if (Math.random() < diff * 0.5) {
      L.spin = pick([-1, 1]) * rnd(0.8, 1.6);
      L.len = Math.min(L.len, 110);
      L.y = clamp(L.y, CEIL + L.len / 2 + 12, FLOOR - L.len / 2 - 12);
    }
    r.lasers.push(L);
    // a line of chips to tempt you around it
    if (Math.random() < 0.5) {
      const cy = y < (CEIL + FLOOR) / 2 ? FLOOR - 40 : CEIL + 40;
      for (let k = 0; k < 6; k++) r.chips.push({ x: x + k * CHIP_GAP, y: cy, vx: 0, vy: 0 });
    }
    x += rnd(150, 230);
  }
  return x - x0;
}

function spawnCrash(r, x0, diff) {
  // stock-crash bars that slide up and down
  const n = 1 + (Math.random() < diff ? 1 : 0);
  for (let i = 0; i < n; i++) {
    r.lasers.push({
      x: x0 + 40 + i * 180,
      y: (CEIL + FLOOR) / 2,
      base: (CEIL + FLOOR) / 2,
      amp: 90,
      freq: rnd(1.2, 2),
      phase: Math.random() * 6,
      len: 120,
      ang: 0.35,
      spin: 0,
      style: "crash",
      minD: 1e9,
      counted: false,
    });
  }
  return n * 180;
}

function spawnMissile(r, kind = "subpoena", delay = 0, fixedY = null) {
  r.missiles.push({ phase: "warn", t: -delay, y: fixedY ?? r.p.y, x: r.W + 40, kind, track: fixedY == null, warned: false });
}

function spawnFlash(r, y, delay = 0) {
  r.flashes.push({ y: clamp(y, CEIL + 22, FLOOR - 22), phase: "wait", t: -delay, hit: false });
}

// ---------------------------------------------------------------- update
export function update(r, dt) {
  r.t += dt;
  const p = r.p;
  if (r.shake > 0) r.shake = Math.max(0, r.shake - dt * 30);

  if (r.state === "run") {
    const target = 250 + Math.min(330, dist(r) * 0.11);
    r.speed += (target - r.speed) * Math.min(1, dt * 0.5);
  }
  const prevDist = dist(r);
  r.camX += r.speed * dt;
  const d = dist(r);
  if (r.state === "run") r.stats.dist = d;

  // ---- player physics
  const [ymin, ymax] = bounds(p);
  if (r.state === "run") {
    if (p.mode === "jet") {
      p.vy += (r.hold ? -2500 : 1500) * dt;
      p.vy = clamp(p.vy, -460, 560);
    } else if (p.mode === "podium") {
      p.vy += p.grav * 2600 * dt;
      p.vy = clamp(p.vy, -700, 700);
    } else if (p.mode === "mech") {
      p.vy += 1700 * dt;
    } else if (p.mode === "rack") {
      p.vy += (r.hold ? -1300 : 700) * dt;
      p.vy = clamp(p.vy, -300, 180);
    }
    p.y += p.vy * dt;
    p.onGround = false;
    if (p.y >= ymax) {
      p.y = ymax;
      if (p.vy > 0) p.vy = 0;
      p.onGround = true;
    }
    if (p.y <= ymin) {
      p.y = ymin;
      if (p.vy < 0) p.vy = 0;
      if (p.mode === "podium") p.onGround = true;
    }
    p.run += dt * r.speed * 0.012;
    if (p.inv > 0) p.inv -= dt;
    if (p.exprT > 0) p.exprT -= dt;
    else p.expr = r.hold && p.mode === "jet" ? "strain" : "smile";
    thrustSound(r.hold && (p.mode === "jet" || p.mode === "rack"));

    // stats
    const dm = d - prevDist;
    if (dm > 0) {
      if (p.mode === "jet" && p.onGround) r.stats.ground += dm;
      if (p.y <= ymin + 1 && p.mode === "jet") r.stats.ceiling += dm;
      r.stats.frugal = Math.max(r.stats.frugal, d - r.lastChipDist);
    }
    // exhaust
    if (r.hold && (p.mode === "jet" || p.mode === "rack") && Math.random() < 0.8) {
      r.parts.push({ x: PX - 13, y: p.y + 16, vx: -r.speed * 0.6 + rnd(-30, 30), vy: rnd(120, 220), life: 0.35, max: 0.35, r: rnd(2, 4), color: Math.random() < 0.5 ? D.C.yellow : D.C.red });
    }
  } else {
    // ragdoll: bounce along the floor, slow the world down
    thrustSound(false);
    p.vy += 1600 * dt;
    p.y += p.vy * dt;
    p.rot += dt * r.speed * 0.04;
    if (p.y >= FLOOR - 12) {
      p.y = FLOOR - 12;
      if (Math.abs(p.vy) > 120) {
        p.vy *= -0.45;
        r.shake = 4;
        sfx.stamp();
      } else p.vy = 0;
      r.speed *= Math.pow(0.18, dt);
    }
    if (r.speed < 12 && p.vy === 0) {
      r.speed = 0;
      if (r.state === "dying") {
        r.state = "down";
        r.events.push({ type: "down" });
      }
    }
  }

  // ---- spawning (paused while a boss is near or active)
  const bossDue = d >= (r.forceBoss ? -1 : nextBossDist(r));
  if (r.state === "run" && !r.boss && !r.bossPending && (bossDue || r.forceBoss)) {
    r.bossPending = 2.2;
    r.events.push({ type: "bossWarn", id: r.forceBoss || BOSS_ORDER[r.bossIdx % BOSS_ORDER.length] });
  }
  if (r.bossPending > 0) {
    r.bossPending -= dt;
    if (r.bossPending <= 0) {
      r.bossPending = 0;
      startBoss(r);
    }
  }
  const calm = r.boss || r.bossPending;
  if (r.state === "run" && !calm) {
    while (r.spawnX < r.camX + r.W + 200) spawnPattern(r);
    r.missileCd -= dt;
    if (r.missileCd <= 0 && d > 60) {
      const diff = clamp(d / 2500, 0, 1);
      const burst = Math.random() < diff * 0.6 ? 3 : 1;
      for (let i = 0; i < burst; i++) spawnMissile(r, "subpoena", i * 0.45, i ? rnd(CEIL + 40, FLOOR - 30) : null);
      r.missileCd = rnd(5.5, 9) - diff * 3;
    }
    r.flashCd -= dt;
    if (r.flashCd <= 0 && d > 200) {
      const diff = clamp(d / 3000, 0, 1);
      const rows = 1 + Math.floor(Math.random() * (1 + diff * 2.5));
      const used = [];
      for (let i = 0; i < rows; i++) {
        let y;
        do y = rnd(CEIL + 30, FLOOR - 30);
        while (used.some((u) => Math.abs(u - y) < 60) && used.length < 4);
        used.push(y);
        spawnFlash(r, y, i * 0.2);
      }
      r.flashCd = rnd(10, 16) - diff * 4;
    }
    r.itemCd -= d - prevDist;
    if (r.itemCd <= 0) {
      if (p.mode === "jet") r.items.push({ kind: "box", x: r.camX + r.W + 60, y: rnd(CEIL + 60, FLOOR - 60) });
      r.itemCd = rnd(320, 520);
    }
    r.magnetCd -= d - prevDist;
    if (r.magnetCd <= 0) {
      r.items.push({ kind: "magnet", x: r.camX + r.W + 60, y: rnd(CEIL + 50, FLOOR - 50) });
      r.magnetCd = rnd(400, 700);
    }
  } else {
    // keep the spawn cursor ahead so the field restarts cleanly after a boss
    r.spawnX = Math.max(r.spawnX, r.camX + r.W + 400);
  }

  const pwx = r.camX + PX; // player world x
  const alive = r.state === "run";

  // ---- chips
  for (const c of r.chips) {
    if (r.magnet > 0 && alive) {
      const dx = pwx - c.x, dy = p.y - c.y;
      const dd = Math.hypot(dx, dy);
      if (dd < 190) {
        c.x += (dx / dd) * 520 * dt + r.speed * dt;
        c.y += (dy / dd) * 520 * dt;
      }
    }
    if (alive && !c.got && Math.abs(c.x - pwx) < 26 && hitsCircle(r, c.x - r.camX, c.y, 7)) {
      c.got = true;
      r.stats.chips++;
      r.lastChipDist = d;
      sfx.chip();
      r.parts.push({ kind: "dot", x: c.x - r.camX, y: c.y, vx: 0, vy: -40, life: 0.25, max: 0.25, r: 6, color: D.C.yellow });
      if (Math.random() < 0.08) {
        p.expr = "grin";
        p.exprT = 0.5;
      }
    }
  }
  r.chips = r.chips.filter((c) => !c.got && c.x > r.camX - 40);
  if (r.magnet > 0) r.magnet -= dt;

  // ---- items
  for (const it of r.items) {
    if (alive && !it.got && hitsCircle(r, it.x - r.camX, it.y, 14)) {
      it.got = true;
      if (it.kind === "magnet") {
        r.magnet = 10;
        sfx.power();
        floatText(r, PX, p.y - 50, "CHIP MAGNET", D.C.red);
      } else if (p.mode === "jet") {
        const v = pick(Object.keys(VEHICLES));
        p.mode = v;
        p.grav = 1;
        p.vy = -200;
        r.stats.vehicles++;
        sfx.power();
        r.events.push({ type: "vehicle", name: VEHICLES[v].name, hint: VEHICLES[v].hint });
      }
    }
  }
  r.items = r.items.filter((it) => !it.got && it.x > r.camX - 60);

  // ---- lasers
  for (const L of r.lasers) {
    L.ang += L.spin * dt;
    if (L.style === "crash") L.y = L.base + Math.sin(r.t * L.freq + L.phase) * L.amp;
    const c = Math.cos(L.ang), s = Math.sin(L.ang), h = L.len / 2;
    const sx = L.x - r.camX;
    if (alive && Math.abs(sx - PX) < L.len) {
      const gap = hitsSegment(r, sx - c * h, L.y - s * h, sx + c * h, L.y + s * h, L.style === "crash" ? 4 : 3.5);
      L.minD = Math.min(L.minD, gap);
      if (gap < 0) hurt(r, L.style === "crash" ? "sell-off" : "export ban");
    }
    if (!L.counted && sx < PX - L.len) {
      L.counted = true;
      if (L.minD < 26 && L.minD >= 0 && alive) {
        r.stats.nearLaser++;
        floatText(r, PX + 10, p.y - 44, "CLOSE CALL", D.C.ink, 8);
      }
    }
  }
  r.lasers = r.lasers.filter((L) => L.x - r.camX > -200);

  // ---- missiles (screen space)
  for (const m of r.missiles) {
    m.t += dt;
    if (m.t < 0) continue;
    if (m.phase === "warn") {
      if (!m.warned) {
        m.warned = true;
        sfx.warn();
      }
      if (m.track && alive) m.y += (p.y - m.y) * Math.min(1, dt * 4);
      if (m.t > 1.3) {
        m.phase = "lock";
        m.t = 0;
      }
    } else if (m.phase === "lock") {
      if (m.t > 0.35) {
        m.phase = "fly";
        m.t = 0;
        sfx.launch();
      }
    } else {
      m.x -= (r.speed + 380) * dt;
      if (alive && hitsCircle(r, m.x, m.y, m.kind === "question" ? 11 : 10)) {
        m.dead = true;
        boom(r, m.x, m.y);
        hurt(r, m.kind === "question" ? "question" : "subpoena");
      }
      if (m.x < -60) {
        m.dead = true;
        if (alive) r.stats.dodgeMissile++;
      }
    }
  }
  r.missiles = r.missiles.filter((m) => !m.dead);

  // ---- flash rows (screen space)
  for (const f of r.flashes) {
    f.t += dt;
    if (f.t < 0) continue;
    if (f.phase === "wait") {
      f.phase = "warn";
      f.t = 0;
      sfx.charge();
    } else if (f.phase === "warn" && f.t > 1.5) {
      f.phase = "fire";
      f.t = 0;
      sfx.flash();
      r.shake = Math.max(r.shake, 2);
    } else if (f.phase === "fire") {
      if (alive && f.t < 0.6 && hitsSegment(r, 0, f.y, r.W, f.y, 9) < 0) {
        f.hit = true;
        hurt(r, "paparazzi");
      }
      if (f.t > 0.7) {
        f.dead = true;
        if (!f.hit && alive) r.stats.dodgeFlash++;
      }
    }
  }
  r.flashes = r.flashes.filter((f) => !f.dead);

  // ---- boss
  if (r.boss) updateBoss(r, dt);

  // ---- boss projectiles (screen space)
  for (const q of r.projs) {
    q.t = (q.t || 0) + dt;
    if (q.t < 0) continue;
    q.vy += (q.g || 0) * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.kind === "candle" && q.y > FLOOR - q.h / 2) {
      q.y = FLOOR - q.h / 2;
      q.vy = 0;
      q.g = 0;
      q.vx = -r.speed;
    }
    if (alive) {
      const hit = q.kind === "candle" ? hitsSegment(r, q.x, q.y - q.h / 2, q.x, q.y + q.h / 2, 6) < 0 : hitsCircle(r, q.x, q.y, q.r || 9);
      if (hit) {
        q.dead = true;
        boom(r, q.x, q.y);
        hurt(r, q.label || "boss");
      }
    }
    if (q.x < -80 || q.x > r.W + 200 || q.y > H + 60 || q.y < -100) q.dead = true;
  }
  r.projs = r.projs.filter((q) => !q.dead);

  // ---- boss beams (screen space segments with a warning phase)
  for (const b of r.beams) {
    b.t += dt;
    if (b.update) b.update(b, dt, r);
    if (b.phase === "fire" && alive && hitsSegment(r, b.ax, b.ay, b.bx, b.by, b.w || 4) < 0) hurt(r, b.label || "beam");
    if (b.t > b.end) b.dead = true;
  }
  r.beams = r.beams.filter((b) => !b.dead);

  // ---- ballots (boss ammo, world)
  for (const b of r.ballots) {
    if (alive && !b.got && hitsCircle(r, b.x - r.camX, b.y, 12)) {
      b.got = true;
      sfx.click();
      if (r.boss) r.shots.push({ x: PX + 10, y: p.y - 10, t: 0 });
    }
  }
  r.ballots = r.ballots.filter((b) => !b.got && b.x > r.camX - 40);
  for (const s of r.shots) {
    s.t += dt;
    const B = r.boss;
    if (!B) {
      s.dead = true;
      continue;
    }
    const dx = B.x - s.x, dy = B.y - s.y, dd = Math.hypot(dx, dy) || 1;
    const sp = 560;
    s.x += (dx / dd) * sp * dt;
    s.y += (dy / dd) * sp * dt;
    if (dd < 30) {
      s.dead = true;
      bossDamage(r);
    }
  }
  r.shots = r.shots.filter((s) => !s.dead);

  // ---- particles
  for (const q of r.parts) {
    q.life -= dt;
    q.x += (q.vx || 0) * dt;
    q.y += (q.vy || 0) * dt;
    if (q.g) q.vy += q.g * dt;
    if (q.kind === "chip") {
      q.t = (q.t || 0) + dt;
      if (q.home) {
        const dx = PX - q.x, dy = p.y - q.y, dd = Math.hypot(dx, dy) || 1;
        if (q.life < q.max - 0.35) {
          q.vx += (dx / dd) * 2600 * dt;
          q.vy += (dy / dd) * 2600 * dt;
          q.vx *= 0.92;
          q.vy *= 0.92;
        }
        if (dd < 16) {
          q.life = 0;
          r.stats.chips++;
          sfx.chip();
        }
      }
    }
  }
  r.parts = r.parts.filter((q) => q.life > 0);
  if (r.parts.length > 260) r.parts.splice(0, r.parts.length - 260);

  if (r.banner) {
    r.banner.t += dt;
    if (r.banner.t > r.banner.dur) r.banner = null;
  }
}

function floatText(r, x, y, text, color, size = 10) {
  r.parts.push({ kind: "text", x, y, vx: 0, vy: -30, life: 1, max: 1, text, color, size });
}

function boom(r, x, y) {
  sfx.boom();
  r.shake = Math.max(r.shake, 5);
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(60, 220);
    r.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 300, life: 0.6, max: 0.6, r: rnd(2, 5), color: pick([D.C.red, D.C.yellow, D.C.ink]) });
  }
}

function hurt(r, cause) {
  const p = r.p;
  if (r.state !== "run" || p.inv > 0) return;
  if (p.mode !== "jet") {
    // vehicle takes the hit
    boom(r, PX, p.y);
    floatText(r, PX, p.y - 40, "PRODUCT RECALLED", D.C.red, 9);
    p.mode = "jet";
    p.grav = 1;
    p.vy = -320;
    p.inv = 1.6;
    const [a, b] = bounds(p);
    p.y = clamp(p.y, a, b);
    return;
  }
  sfx.hit();
  r.shake = 8;
  r.state = "dying";
  r.cause = cause;
  p.expr = "shock";
  p.exprT = 99;
  p.vy = -300;
  p.mode = "jet";
  r.events.push({ type: "hit", cause });
}

// Golden parachute: back in the air, nearby hazards cleared.
export function revive(r) {
  const p = r.p;
  r.state = "run";
  r.speed = Math.max(250, 250 + Math.min(330, dist(r) * 0.11) * 0.7);
  p.y = (CEIL + FLOOR) / 2;
  p.vy = -100;
  p.rot = 0;
  p.inv = 2.5;
  p.expr = "grin";
  p.exprT = 1;
  r.missiles = [];
  r.flashes = [];
  r.projs = [];
  r.beams = [];
  r.lasers = r.lasers.filter((L) => L.x - r.camX > r.W + 100);
  r.stats.parachutes++;
  r.events.push({ type: "revive" });
}

// ---------------------------------------------------------------- bosses
function startBoss(r) {
  const id = r.forceBoss || BOSS_ORDER[r.bossIdx % BOSS_ORDER.length];
  const cycle = Math.floor(r.bossIdx / BOSS_ORDER.length);
  r.forceBoss = null;
  const hp = 7 + cycle * 4;
  r.boss = {
    id,
    hp,
    max: hp,
    x: r.W + 160,
    y: (CEIL + FLOOR) / 2 - 20,
    homeY: (CEIL + FLOOR) / 2 - 20,
    t: 0,
    hurt: 0,
    atk: 2.2,
    ai: 0,
    vote: 0,
    slam: 0,
    look: 0,
    ballotCd: 1.2,
    state: "enter",
    cycle,
  };
  setMood("boss");
  sfx.bossIn();
  r.events.push({ type: "boss", id, name: BOSSES[id].name, intro: BOSSES[id].intro });
}

function updateBoss(r, dt) {
  const B = r.boss;
  const p = r.p;
  B.t += dt;
  if (B.hurt > 0) B.hurt -= dt;
  if (B.vote > 0) B.vote -= dt;
  if (B.slam > 0) B.slam -= dt;
  B.look = clamp((p.y - B.y) / 80, -1, 1);
  const homeX = r.W - 110;

  if (B.state === "enter") {
    B.x += (homeX - B.x) * Math.min(1, dt * 2.2);
    if (Math.abs(B.x - homeX) < 3) B.state = "fight";
    return;
  }
  if (B.state === "leave") {
    B.y -= 120 * dt;
    B.x += 60 * dt;
    if (B.t > 1.6) {
      r.boss = null;
      setMood("run");
    }
    return;
  }
  if (B.state === "stamp") return stampStep(r, B, dt, homeX);

  // hover
  B.x += (homeX - B.x) * Math.min(1, dt * 2);
  B.y = B.homeY + Math.sin(B.t * 1.3) * 50;

  if (r.state !== "run") return;

  // ballots to fight back
  B.ballotCd -= dt;
  if (B.ballotCd <= 0) {
    r.ballots.push({ x: r.camX + r.W + 30, y: rnd(CEIL + 40, FLOOR - 30) });
    B.ballotCd = rnd(0.8, 1.2);
  }

  B.atk -= dt;
  if (B.atk > 0) return;
  const list = BOSSES[B.id].attacks;
  const a = list[B.ai % list.length];
  B.ai++;
  const harder = 1 + B.cycle * 0.25 + (1 - B.hp / B.max) * 0.3;
  B.atk = rnd(2.4, 3.2) / harder;
  ATTACKS[a](r, B, harder);
}

const ATTACKS = {
  vote(r, B) {
    B.vote = 1.2;
    for (let i = 0; i < 3; i++) spawnMissile(r, "subpoena", i * 0.35, i === 0 ? null : rnd(CEIL + 40, FLOOR - 30));
  },
  gavel(r, B, k) {
    // gavels lobbed from the table, arcing down
    const n = 3 + Math.floor(k);
    for (let i = 0; i < n; i++)
      r.projs.push({ kind: "gavel", x: B.x - 40, y: B.y, vx: -rnd(180, 340), vy: rnd(-300, -80), g: 600, r: 9, t: -i * 0.18, label: "gavel" });
    sfx.launch();
  },
  docs(r, B, k) {
    const n = 4 + Math.floor(k * 1.5);
    const base = Math.atan2(r.p.y - B.y, PX - B.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.16;
      r.projs.push({ kind: "doc", x: B.x - 30, y: B.y, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, r: 9, t: -i * 0.05, label: "leaked memo" });
    }
    sfx.launch();
  },
  sweep(r, B) {
    // the magnifier's beam: warns, then sweeps the room top to bottom (or back)
    const down = Math.random() < 0.5;
    const len = 900;
    r.beams.push({
      t: 0,
      end: 3.2,
      phase: "warn",
      label: "scrutiny",
      w: 6,
      update(b, dt, r2) {
        const Bs = r2.boss;
        if (!Bs) return (b.dead = true);
        b.ax = Bs.x - 20;
        b.ay = Bs.y;
        // sweep across the left side, from up-left to down-left (or back)
        const k = clamp((b.t - 1) / 2, 0, 1);
        const ang = Math.PI + (down ? -0.62 + 1.24 * k : 0.62 - 1.24 * k);
        b.bx = b.ax + Math.cos(ang) * len;
        b.by = b.ay + Math.sin(ang) * len;
        b.phase = b.t < 1 ? "warn" : "fire";
      },
    });
    sfx.charge();
  },
  questions(r, B, k) {
    const n = 3 + Math.floor(k);
    for (let i = 0; i < n; i++) spawnMissile(r, "question", i * 0.3, i === 0 ? null : CEIL + 30 + ((FLOOR - CEIL - 60) * i) / n);
  },
  record(r) {
    spawnFlash(r, r.p.y);
    spawnFlash(r, r.p.y < 170 ? rnd(220, FLOOR - 30) : rnd(CEIL + 30, 130), 0.4);
  },
  candles(r, B, k) {
    // red candlesticks drop from the ceiling and slide past on the floor
    const n = 3 + Math.floor(k);
    for (let i = 0; i < n; i++) {
      const h = rnd(60, 130);
      r.projs.push({ kind: "candle", x: rnd(PX + 40, r.W - 160), y: CEIL - h, h, vx: -r.speed * 0.3, vy: 0, g: 900, t: -i * 0.25, label: "sell-off" });
    }
    sfx.warn();
  },
  crash(r, B) {
    for (let i = 0; i < 4; i++)
      r.projs.push({ kind: "arrow", x: B.x - 30, y: B.y - 40 + i * 10, vx: -rnd(260, 360), vy: rnd(40, 160) * (i % 2 ? 1 : -0.4), r: 9, t: -i * 0.2, label: "crash" });
    sfx.launch();
  },
  flashes(r, B, k) {
    const rows = 2 + Math.floor(k);
    for (let i = 0; i < rows; i++) spawnFlash(r, CEIL + 30 + Math.random() * (FLOOR - CEIL - 60), i * 0.35);
  },
  lenses(r, B, k) {
    for (let i = 0; i < 2 + Math.floor(k); i++) spawnMissile(r, "subpoena", i * 0.4, i ? rnd(CEIL + 40, FLOOR - 30) : null);
  },
  stamp(r, B) {
    B.state = "stamp";
    B.st = 0;
    B.stx = PX + 10;
  },
  bans(r, B, k) {
    // two export-ban beams that sweep the room
    for (let i = 0; i < 1 + (k > 1.3 ? 1 : 0); i++) {
      const fromTop = i === 0 ? r.p.y > 170 : r.p.y <= 170;
      r.beams.push({
        t: -i * 0.8,
        end: 3.4,
        phase: "warn",
        label: "export ban",
        w: 4,
        update(b) {
          const y = fromTop ? CEIL + 10 + clamp(b.t - 0.9, 0, 3) * 120 : FLOOR - 10 - clamp(b.t - 0.9, 0, 3) * 120;
          b.ax = 0;
          b.bx = r.W - 200;
          b.ay = b.by = y;
          b.phase = b.t < 0.9 ? "warn" : "fire";
        },
      });
    }
    sfx.charge();
  },
};

function stampStep(r, B, dt, homeX) {
  B.st += dt;
  const top = CEIL + 70;
  if (B.st < 1.1) {
    // glide over the player and hover, shadow on the floor
    B.x += (B.stx - B.x) * Math.min(1, dt * 4);
    B.y += (top - B.y) * Math.min(1, dt * 4);
    B.shadow = true;
  } else if (B.st < 1.35) {
    B.y += 1400 * dt;
    if (B.y > FLOOR - 24) {
      B.y = FLOOR - 24;
      if (!B.slammed) {
        B.slammed = true;
        sfx.stamp();
        r.shake = 9;
      }
    }
    if (r.state === "run" && hitsCircle(r, B.x, B.y, 40)) hurt(r, "stamp");
  } else if (B.st < 2.2) {
    B.y += (B.homeY - B.y) * Math.min(1, dt * 3);
    B.x += (homeX - B.x) * Math.min(1, dt * 3);
    B.shadow = false;
  } else {
    B.state = "fight";
    B.slammed = false;
  }
}

function bossDamage(r) {
  const B = r.boss;
  if (!B || B.state !== "fight" && B.state !== "stamp") return;
  B.hp--;
  B.hurt = 0.25;
  sfx.bossHit();
  if (B.hp <= 0) {
    B.state = "leave";
    B.t = 0;
    r.beams = [];
    r.projs = [];
    r.missiles = r.missiles.filter((m) => m.phase === "fly");
    r.stats.bosses++;
    r.bossIdx++;
    sfx.win();
    boom(r, B.x, B.y);
    // chip shower that flies to the player
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(100, 300);
      r.parts.push({ kind: "chip", home: true, x: B.x, y: B.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 2.5, max: 2.5 });
    }
    r.banner = { text: BOSSES[B.id].outro, sub: `${BOSSES[B.id].name} defeated · +40 chips`, t: 0, dur: 2.6 };
    r.events.push({ type: "bossDown", id: B.id });
    r.p.inv = Math.max(r.p.inv, 1);
  }
}

// ---------------------------------------------------------------- render
export function render(g, r) {
  const W = r.W;
  const t = r.t;
  g.save();
  if (r.shake > 0) g.translate((Math.random() - 0.5) * r.shake, (Math.random() - 0.5) * r.shake);
  D.drawBackdrop(g, W, r.camX, t, r.best);

  // stamp shadow
  if (r.boss && r.boss.shadow) {
    g.fillStyle = "rgba(232,53,43,.25)";
    g.beginPath();
    g.ellipse(r.boss.x, FLOOR - 2, 50, 7, 0, 0, Math.PI * 2);
    g.fill();
  }

  for (const c of r.chips) {
    const sx = c.x - r.camX;
    if (sx > -20 && sx < W + 20) D.drawChip(g, sx, c.y, t);
  }
  for (const b of r.ballots) D.drawBallot(g, b.x - r.camX, b.y, t);
  for (const it of r.items) {
    const sx = it.x - r.camX;
    if (it.kind === "box") D.drawBox(g, sx, it.y, t);
    else D.drawMagnet(g, sx, it.y, t);
  }
  for (const L of r.lasers) {
    const sx = L.x - r.camX;
    if (sx > -200 && sx < W + 200) D.drawLaser(g, { ...L, x: sx }, t);
  }

  if (r.boss) D.drawBoss(g, r.boss, t);

  for (const b of r.beams) {
    if (b.ax == null || b.t < 0) continue;
    g.save();
    if (b.phase === "warn") {
      g.setLineDash([6, 6]);
      g.strokeStyle = (t * 8) % 2 < 1 ? D.C.red : D.C.ink;
      g.lineWidth = 2;
    } else {
      g.strokeStyle = "rgba(232,53,43,.3)";
      g.lineWidth = 16;
      g.beginPath();
      g.moveTo(b.ax, b.ay);
      g.lineTo(b.bx, b.by);
      g.stroke();
      g.strokeStyle = D.C.red;
      g.lineWidth = 6;
    }
    g.beginPath();
    g.moveTo(b.ax, b.ay);
    g.lineTo(b.bx, b.by);
    g.stroke();
    if (b.phase === "fire") {
      g.strokeStyle = "#fff6d8";
      g.lineWidth = 2;
      g.stroke();
    }
    g.restore();
  }

  for (const q of r.projs) {
    if (q.t < 0) continue;
    if (q.kind === "doc") D.drawMissile(g, q.x, q.y, t, "doc");
    else if (q.kind === "candle") {
      g.fillStyle = D.C.red;
      g.strokeStyle = D.C.ink;
      g.lineWidth = 1.6;
      g.fillRect(q.x - 2, q.y - q.h / 2 - 10, 4, q.h + 20);
      g.fillRect(q.x - 8, q.y - q.h / 2, 16, q.h);
      g.strokeRect(q.x - 8, q.y - q.h / 2, 16, q.h);
    } else if (q.kind === "arrow") {
      D.drawLaser(g, { x: q.x, y: q.y, len: 26, ang: Math.atan2(q.vy, q.vx), style: "crash" }, t);
    } else {
      // gavel
      g.save();
      g.translate(q.x, q.y);
      g.rotate(t * 10);
      g.fillStyle = "#7a4b28";
      g.strokeStyle = D.C.ink;
      g.lineWidth = 1.5;
      g.fillRect(-2, -2, 4, 16);
      g.strokeRect(-2, -2, 4, 16);
      g.fillRect(-9, -8, 18, 8);
      g.strokeRect(-9, -8, 18, 8);
      g.restore();
    }
  }

  // player
  const p = r.p;
  const blink = p.inv > 0 && r.state === "run" && (t * 14) % 2 < 1;
  if (!blink) {
    const o = { t, run: p.run % 1, air: !p.onGround || p.mode !== "jet", thrust: r.hold && r.state === "run", expr: p.expr, jacket: r.jacket };
    if (r.state !== "run") D.drawJensen(g, PX, p.y, { ...o, rot: p.rot, thrust: false, air: true });
    else if (p.mode === "jet") D.drawJensen(g, PX, p.y, o);
    else D.drawVehicle(g, p.mode, PX, p.y, t, { ...o, flip: p.grav < 0 });
  }
  if (r.magnet > 0 && r.state === "run") {
    g.strokeStyle = `rgba(232,53,43,${0.25 + Math.sin(t * 10) * 0.15})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(PX, p.y, 34, 0, Math.PI * 2);
    g.stroke();
  }

  for (const s of r.shots) D.drawShot(g, s, t);
  for (const m of r.missiles) {
    if (m.t < 0) continue;
    if (m.phase === "fly") D.drawMissile(g, m.x, m.y, t, m.kind);
    else D.drawMissileWarn(g, W - 22, m.y, t, m.phase === "lock");
  }
  for (const f of r.flashes) if (f.t >= 0 && f.phase !== "wait") D.drawFlashRow(g, f.y, W, t, f.phase, f.phase === "fire" ? f.t / 0.7 : 0);
  for (const q of r.parts) D.drawParticle(g, q);

  // boss hp bar
  if (r.boss && r.boss.state !== "enter") {
    const B = r.boss;
    const bw = Math.min(260, W * 0.42);
    const bx = W / 2 - bw / 2;
    g.fillStyle = D.C.paper;
    g.fillRect(bx - 2, CEIL + 4, bw + 4, 22);
    g.strokeStyle = D.C.ink;
    g.lineWidth = 2;
    g.strokeRect(bx - 2, CEIL + 4, bw + 4, 22);
    g.fillStyle = D.C.red;
    g.fillRect(bx, CEIL + 16, (bw * Math.max(0, B.hp)) / B.max, 8);
    g.fillStyle = D.C.ink;
    g.font = "800 7px Unbounded, sans-serif";
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(BOSSES[B.id].name, bx + 3, CEIL + 10.5);
    g.textAlign = "right";
    g.font = "600 7px 'Geist Mono', monospace";
    g.fillText("GRAB VOTES TO FIGHT BACK", bx + bw, CEIL + 10.5);
  }

  if (r.banner) {
    const k = r.banner.t / r.banner.dur;
    const a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
    g.globalAlpha = a;
    g.fillStyle = D.C.ink;
    g.fillRect(0, 130, W, 70);
    g.fillStyle = D.C.yellow;
    g.fillRect(0, 196, W, 4);
    g.fillStyle = D.C.paper;
    g.font = "900 24px Unbounded, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(r.banner.text, W / 2, 158);
    g.font = "600 9px 'Geist Mono', monospace";
    g.fillStyle = D.C.yellow;
    g.fillText(r.banner.sub.toUpperCase(), W / 2, 184);
    g.globalAlpha = 1;
  }
  g.restore();
}

export { VEHICLES, M, PX };
