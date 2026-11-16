// All art is hand-drawn here with canvas paths: the caricature, hazards, bosses, the HQ backdrop.
// Editorial look: cream paper, ink outlines, flat red / yellow accents.

export const C = {
  paper: "#f2eee3",
  paper2: "#e9e3d3",
  paper3: "#ddd5c0",
  ink: "#141414",
  ink2: "#4a4740",
  ink3: "#8a857a",
  red: "#e8352b",
  yellow: "#ffc93c",
  blue: "#2f6fed",
  green: "#1f9d55",
  skin: "#eab991",
  skinShade: "#d39b74",
  hair: "#d3d6db",
  hairShade: "#9fa4ab",
};

export const H = 360;
export const FLOOR = 322;
export const CEIL = 30;

const TAU = Math.PI * 2;

function line(g, w = 1.8, c = C.ink) {
  g.lineWidth = w;
  g.strokeStyle = c;
  g.lineJoin = "round";
  g.lineCap = "round";
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
}

// ---------------------------------------------------------------- the caricature
// (x, y) is the body centre, facing right. opts: t, run (0..1 phase) or null, air, thrust, expr, jacket, rot.
export function drawJensen(g, x, y, o) {
  const j = o.jacket;
  g.save();
  g.translate(x, y);
  if (o.rot) g.rotate(o.rot);
  if (o.flipY) g.scale(1, -1);
  if (o.scale) g.scale(o.scale, o.scale);
  const t = o.t || 0;
  const running = o.run != null && !o.air;
  const ph = running ? o.run * TAU : 0;
  const swing = running ? Math.sin(ph) * 0.7 : o.air ? 0.35 : 0;
  line(g);

  // jetpack: two stacked graphics cards with fans
  if (!o.noPack) {
    g.save();
    g.translate(-15, -8);
    for (let i = 0; i < 2; i++) {
      rr(g, -3 + i * 5, -6, 8, 24, 2);
      g.fillStyle = i ? "#2a2b30" : "#3a3c43";
      g.fill();
      g.stroke();
    }
    // fans
    for (const fy of [0, 10]) {
      g.beginPath();
      g.arc(3, fy, 3.2, 0, TAU);
      g.fillStyle = C.yellow;
      g.fill();
      g.stroke();
      g.save();
      g.translate(3, fy);
      g.rotate(t * 20);
      g.beginPath();
      g.moveTo(-2.4, 0);
      g.lineTo(2.4, 0);
      g.moveTo(0, -2.4);
      g.lineTo(0, 2.4);
      line(g, 1);
      g.stroke();
      g.restore();
      line(g);
    }
    // nozzle
    rr(g, -1, 18, 9, 4, 1);
    g.fillStyle = C.ink2;
    g.fill();
    g.stroke();
    if (o.thrust) {
      const fl = 14 + Math.random() * 10;
      g.beginPath();
      g.moveTo(0, 22);
      g.quadraticCurveTo(3.5, 22 + fl, 7, 22);
      g.fillStyle = C.yellow;
      g.fill();
      g.beginPath();
      g.moveTo(1.8, 22);
      g.quadraticCurveTo(3.5, 22 + fl * 0.6, 5.2, 22);
      g.fillStyle = C.red;
      g.fill();
    }
    g.restore();
  }

  // back leg, back arm (darker)
  leg(g, -1, 8, -swing, o.air, "#26272b");
  arm(g, -2, -4, swing * 0.9, j.trim, o);

  // torso (jacket)
  g.beginPath();
  g.moveTo(-8, -7);
  g.quadraticCurveTo(-10, 4, -8, 11);
  g.lineTo(9, 11);
  g.quadraticCurveTo(11, 2, 8, -7);
  g.quadraticCurveTo(0, -10, -8, -7);
  g.fillStyle = j.base;
  g.fill();
  if (j.pattern === "scales") {
    g.save();
    g.clip();
    g.strokeStyle = j.trim;
    g.lineWidth = 0.8;
    for (let sy = -8; sy < 12; sy += 4)
      for (let sx = -10; sx < 12; sx += 4) {
        g.beginPath();
        g.arc(sx + ((sy / 4) % 2) * 2, sy, 2, 0, Math.PI);
        g.stroke();
      }
    g.restore();
  } else if (j.pattern === "print") {
    g.save();
    g.clip();
    g.fillStyle = C.ink3;
    for (let sy = -6; sy < 11; sy += 2.5) g.fillRect(-9, sy, 18, 0.7);
    g.restore();
  }
  line(g);
  g.stroke();
  // tee + lapels
  g.beginPath();
  g.moveTo(1, -8);
  g.lineTo(5, 3);
  g.lineTo(8, -7);
  g.closePath();
  g.fillStyle = C.ink;
  g.fill();
  g.beginPath();
  g.moveTo(1, -8);
  g.lineTo(3, 0);
  g.moveTo(8, -7);
  g.lineTo(6.5, 1);
  line(g, 1.2, j.trim);
  g.stroke();
  // leather shine
  g.beginPath();
  g.moveTo(-6, -4);
  g.quadraticCurveTo(-7, 2, -5, 7);
  line(g, 1.6, j.shine);
  g.stroke();
  // zip
  g.beginPath();
  g.moveTo(5, 3);
  g.lineTo(5, 10);
  line(g, 0.9, j.shine);
  g.stroke();

  // front leg
  leg(g, 3, 8, swing, o.air, "#303136");

  // head
  head(g, 3, -21, o.expr || "smile", t);

  // front arm
  arm(g, 4, -4, -swing * 0.9, j.base, o, true);
  g.restore();
}

function leg(g, hx, hy, a, air, col) {
  g.save();
  g.translate(hx, hy);
  g.rotate(a * 0.8 + (air ? 0.25 : 0));
  rr(g, -2.8, 0, 5.6, 14, 2);
  g.fillStyle = col;
  g.fill();
  line(g);
  g.stroke();
  // shoe
  g.translate(0, 14);
  g.rotate(air ? 0.3 : -a * 0.3);
  rr(g, -3, -1, 9, 4.2, 2);
  g.fillStyle = C.ink;
  g.fill();
  g.restore();
}

function arm(g, sx, sy, a, col, o, front) {
  g.save();
  g.translate(sx, sy);
  let rot = a * 0.9;
  if (o.air && front) rot = -0.9; // fist up while flying
  if (o.wave && front) rot = -2.3 + Math.sin((o.t || 0) * 10) * 0.3;
  g.rotate(rot);
  rr(g, -2.6, -1, 5.2, 13, 2.5);
  g.fillStyle = col;
  g.fill();
  line(g);
  g.stroke();
  g.beginPath();
  g.arc(0, 13.5, 2.6, 0, TAU);
  g.fillStyle = C.skin;
  g.fill();
  g.stroke();
  g.restore();
}

function head(g, hx, hy, expr, t) {
  g.save();
  g.translate(hx, hy);
  line(g);
  // neck
  rr(g, -3, 6, 6, 6, 2);
  g.fillStyle = C.skinShade;
  g.fill();
  // face: big round caricature head, slightly wider jaw
  g.beginPath();
  g.ellipse(1, 0, 11.5, 12.5, 0, 0, TAU);
  g.fillStyle = C.skin;
  g.fill();
  g.stroke();
  // cheek shade
  g.beginPath();
  g.ellipse(-3, 5, 5, 3, 0, 0, TAU);
  g.fillStyle = "rgba(211,120,90,.25)";
  g.fill();
  // ear
  g.beginPath();
  g.ellipse(-8, 1, 2.6, 3.6, 0, 0, TAU);
  g.fillStyle = C.skinShade;
  g.fill();
  g.stroke();
  // hair: big swept silver pompadour, combed back
  const spike = expr === "shock" ? 3 : 0;
  g.beginPath();
  g.moveTo(-10, 4);
  g.quadraticCurveTo(-14, -8, -6, -14 - spike);
  g.quadraticCurveTo(2, -19 - spike, 10, -15 - spike);
  g.quadraticCurveTo(15, -12, 13, -6);
  g.quadraticCurveTo(7, -10, 1, -8);
  g.quadraticCurveTo(-4, -6, -6, -1);
  g.quadraticCurveTo(-7, 2, -10, 4);
  g.fillStyle = C.hair;
  g.fill();
  g.stroke();
  // comb lines
  g.beginPath();
  g.moveTo(9, -13 - spike);
  g.quadraticCurveTo(0, -13, -8, -6);
  g.moveTo(11, -9);
  g.quadraticCurveTo(2, -11, -6, -3);
  line(g, 1, C.hairShade);
  g.stroke();
  line(g);
  // brows
  g.beginPath();
  if (expr === "strain") {
    g.moveTo(4, -6);
    g.lineTo(9, -4);
    g.moveTo(10.5, -4);
    g.lineTo(13, -5.5);
  } else if (expr === "shock") {
    g.moveTo(4, -8);
    g.quadraticCurveTo(7, -10, 9, -8);
  } else {
    g.moveTo(4, -6.5);
    g.quadraticCurveTo(7, -8, 9.5, -6.5);
  }
  line(g, 1.4);
  g.stroke();
  // glasses: chunky black frames
  line(g, 1.8);
  rr(g, 3.5, -4.5, 7.5, 5.5, 1.5);
  g.fillStyle = "rgba(255,255,255,.55)";
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(3.5, -2.5);
  g.lineTo(-7, -1.5);
  g.moveTo(11, -2.5);
  g.lineTo(12.6, -2.8);
  g.stroke();
  // eye
  g.beginPath();
  const er = expr === "shock" ? 1.8 : 1.2;
  g.arc(7.6, -1.8, er, 0, TAU);
  g.fillStyle = C.ink;
  g.fill();
  // nose
  g.beginPath();
  g.moveTo(12, -1);
  g.quadraticCurveTo(15, 2.5, 11.5, 3.5);
  line(g, 1.4);
  g.stroke();
  // mouth
  g.beginPath();
  if (expr === "shock") {
    g.ellipse(8.5, 7.5, 2.4, 3, 0, 0, TAU);
    g.fillStyle = C.ink;
    g.fill();
  } else if (expr === "strain") {
    rr(g, 5, 6, 7, 3, 1);
    g.fillStyle = "#fff";
    g.fill();
    line(g, 1.2);
    g.stroke();
    g.beginPath();
    g.moveTo(7.3, 6);
    g.lineTo(7.3, 9);
    g.moveTo(9.6, 6);
    g.lineTo(9.6, 9);
    g.stroke();
  } else if (expr === "grin") {
    g.moveTo(4, 5);
    g.quadraticCurveTo(9, 12, 13, 5);
    g.closePath();
    g.fillStyle = "#fff";
    g.fill();
    line(g, 1.3);
    g.stroke();
  } else {
    g.moveTo(5, 6);
    g.quadraticCurveTo(9, 9.5, 12.5, 5.5);
    line(g, 1.4);
    g.stroke();
  }
  g.restore();
}

// ---------------------------------------------------------------- collectibles
export function drawChip(g, x, y, t, s = 1) {
  const sx = Math.cos(t * 4 + x * 0.02);
  g.save();
  g.translate(x, y);
  g.scale(Math.max(0.18, Math.abs(sx)) * s, s);
  line(g, 1.3);
  // pins
  g.beginPath();
  for (let i = -1; i <= 1; i++) {
    g.moveTo(i * 3, -6);
    g.lineTo(i * 3, -8.5);
    g.moveTo(i * 3, 6);
    g.lineTo(i * 3, 8.5);
    g.moveTo(-6, i * 3);
    g.lineTo(-8.5, i * 3);
    g.moveTo(6, i * 3);
    g.lineTo(8.5, i * 3);
  }
  g.stroke();
  rr(g, -6, -6, 12, 12, 1.5);
  g.fillStyle = sx > 0 ? "#26272b" : "#33353b";
  g.fill();
  g.stroke();
  g.fillStyle = C.yellow;
  g.fillRect(-3, -3, 6, 6);
  g.restore();
}

export function drawBallot(g, x, y, t) {
  g.save();
  g.translate(x, y);
  g.rotate(Math.sin(t * 5 + x) * 0.15);
  line(g, 1.4);
  rr(g, -9, -11, 18, 22, 1.5);
  g.fillStyle = "#fff";
  g.fill();
  g.stroke();
  g.fillStyle = C.ink;
  g.font = "700 5px 'Geist Mono', monospace";
  g.textAlign = "center";
  g.fillText("VOTE", 0, -4);
  g.beginPath();
  g.moveTo(-4, 3);
  g.lineTo(-1, 6);
  g.lineTo(5, -1);
  line(g, 2, C.red);
  g.stroke();
  g.restore();
}

export function drawBox(g, x, y, t) {
  g.save();
  g.translate(x, y + Math.sin(t * 3) * 3);
  g.rotate(Math.sin(t * 2) * 0.08);
  line(g, 1.8);
  rr(g, -13, -11, 26, 22, 2);
  g.fillStyle = C.yellow;
  g.fill();
  g.stroke();
  g.fillStyle = C.red;
  g.fillRect(-2.5, -11, 5, 22);
  g.fillRect(-13, -2.5, 26, 5);
  g.strokeRect(-13, -2.5, 26, 5);
  g.beginPath();
  g.ellipse(-5, -14, 5, 3, -0.4, 0, TAU);
  g.ellipse(5, -14, 5, 3, 0.4, 0, TAU);
  g.fillStyle = C.red;
  g.fill();
  g.stroke();
  g.fillStyle = C.ink;
  g.font = "800 6px Unbounded, sans-serif";
  g.textAlign = "center";
  g.fillText("NEW", 0, 21);
  g.restore();
}

export function drawMagnet(g, x, y, t) {
  g.save();
  g.translate(x, y + Math.sin(t * 3) * 3);
  g.rotate(Math.sin(t * 2.4) * 0.2);
  g.beginPath();
  g.arc(0, 0, 9, Math.PI, 0);
  g.lineTo(9, 9);
  g.lineTo(4, 9);
  g.lineTo(4, 0);
  g.arc(0, 0, 4, 0, Math.PI, true);
  g.lineTo(-4, 9);
  g.lineTo(-9, 9);
  g.closePath();
  g.fillStyle = C.red;
  g.fill();
  line(g, 1.6);
  g.stroke();
  g.fillStyle = "#fff";
  g.fillRect(-9, 6, 5, 3);
  g.fillRect(4, 6, 5, 3);
  g.restore();
}

// ---------------------------------------------------------------- hazards
export function drawLaser(g, h, t) {
  const c = Math.cos(h.ang), s = Math.sin(h.ang);
  const half = h.len / 2;
  const ax = h.x - c * half, ay = h.y - s * half, bx = h.x + c * half, by = h.y + s * half;
  if (h.style === "crash") {
    // a falling red stock line
    g.beginPath();
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const px = ax + (bx - ax) * k, py = ay + (by - ay) * k + (i % 2 ? -5 : 5) * (i > 0 && i < n ? 1 : 0);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    line(g, 7, C.ink);
    g.stroke();
    line(g, 4, C.red);
    g.stroke();
    // arrow head
    g.save();
    g.translate(bx, by);
    g.rotate(h.ang);
    g.beginPath();
    g.moveTo(8, 0);
    g.lineTo(-4, -7);
    g.lineTo(-4, 7);
    g.closePath();
    g.fillStyle = C.red;
    g.fill();
    line(g, 1.6);
    g.stroke();
    g.restore();
    return;
  }
  // beam
  const flick = 0.75 + Math.random() * 0.25;
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  line(g, 10, "rgba(232,53,43,.25)");
  g.stroke();
  line(g, 5 * flick, C.red);
  g.stroke();
  line(g, 1.6, "#fff6d8");
  g.stroke();
  // label along beam
  g.save();
  g.translate(h.x, h.y);
  let a = h.ang;
  if (Math.cos(a) < 0) a += Math.PI;
  g.rotate(a);
  g.fillStyle = C.paper;
  const w = 46;
  g.fillRect(-w / 2, -4.5, w, 9);
  g.strokeStyle = C.ink;
  g.lineWidth = 1;
  g.strokeRect(-w / 2, -4.5, w, 9);
  g.fillStyle = C.ink;
  g.font = "700 6px 'Geist Mono', monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("EXPORT BAN", 0, 0.5);
  g.restore();
  // end nodes
  for (const [px, py] of [[ax, ay], [bx, by]]) {
    g.beginPath();
    g.arc(px, py, 8, 0, TAU);
    g.fillStyle = C.ink;
    g.fill();
    g.beginPath();
    g.arc(px, py, 4.5, 0, TAU);
    g.fillStyle = (t * 6) % 2 < 1 ? C.red : C.yellow;
    g.fill();
  }
}

export function drawMissileWarn(g, x, y, t, locked) {
  g.save();
  g.translate(x, y);
  const pulse = locked ? 1 : 0.8 + Math.sin(t * 20) * 0.2;
  g.scale(pulse, pulse);
  g.beginPath();
  g.moveTo(0, -12);
  g.lineTo(12, 9);
  g.lineTo(-12, 9);
  g.closePath();
  g.fillStyle = locked ? C.red : C.yellow;
  g.fill();
  line(g, 2);
  g.stroke();
  g.fillStyle = locked ? "#fff" : C.ink;
  g.font = "900 13px Unbounded, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("!", 0, 3);
  g.restore();
}

export function drawMissile(g, x, y, t, kind = "subpoena") {
  g.save();
  g.translate(x, y);
  // exhaust trail to the right
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(16 + i * 7 + Math.random() * 3, (Math.random() - 0.5) * 4, 4 - i * 0.7, 0, TAU);
    g.fillStyle = i < 2 ? C.yellow : "rgba(20,20,20,.25)";
    g.fill();
  }
  line(g, 1.6);
  if (kind === "question") {
    g.fillStyle = C.red;
    g.font = "900 26px Unbounded, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 3;
    g.strokeText("?", 0, 0);
    g.fillText("?", 0, 0);
  } else if (kind === "doc") {
    g.rotate(t * 8);
    rr(g, -9, -11, 18, 22, 1);
    g.fillStyle = "#fff";
    g.fill();
    g.stroke();
    g.fillStyle = C.ink;
    for (let i = 0; i < 4; i++) g.fillRect(-6, -7 + i * 4, 12 - (i % 2) * 4, 2.4);
  } else {
    // envelope
    rr(g, -14, -9, 28, 18, 1.5);
    g.fillStyle = "#fffaf0";
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-14, -9);
    g.lineTo(0, 2);
    g.lineTo(14, -9);
    g.stroke();
    g.beginPath();
    g.arc(0, 2, 4, 0, TAU);
    g.fillStyle = C.red;
    g.fill();
    g.stroke();
    g.fillStyle = C.ink;
    g.font = "700 4.2px 'Geist Mono', monospace";
    g.textAlign = "center";
    g.fillText("SUBPOENA", 0, 8);
  }
  g.restore();
}

export function drawCamera(g, x, y, t, firing, face = 1) {
  g.save();
  g.translate(x, y);
  g.scale(face, 1);
  line(g, 1.6);
  rr(g, -12, -8, 22, 16, 2);
  g.fillStyle = C.ink;
  g.fill();
  rr(g, -9, -12, 8, 4, 1);
  g.fill();
  g.beginPath();
  g.arc(2, 0, 6, 0, TAU);
  g.fillStyle = firing ? "#fff" : C.ink2;
  g.fill();
  line(g, 1.6, C.paper);
  g.stroke();
  g.beginPath();
  g.arc(2, 0, 2.5, 0, TAU);
  g.fillStyle = firing ? C.yellow : "#111";
  g.fill();
  g.restore();
}

export function drawFlashRow(g, y, w, t, phase, k) {
  if (phase === "warn") {
    g.save();
    g.setLineDash([8, 7]);
    g.lineDashOffset = -t * 60;
    line(g, 2, (t * 8) % 2 < 1 ? C.red : C.ink);
    g.beginPath();
    g.moveTo(26, y);
    g.lineTo(w - 26, y);
    g.stroke();
    g.restore();
    g.fillStyle = C.ink;
    g.font = "700 7px 'Geist Mono', monospace";
    g.textAlign = "center";
    g.fillText("NO PHOTOS", w / 2, y - 6);
  } else if (phase === "fire") {
    const a = 1 - k * 0.5;
    g.fillStyle = `rgba(255,201,60,${0.45 * a})`;
    g.fillRect(0, y - 18, w, 36);
    g.fillStyle = `rgba(255,255,255,${0.95 * a})`;
    g.fillRect(0, y - 10, w, 20);
  }
  drawCamera(g, 14, y, t, phase === "fire", 1);
  drawCamera(g, w - 14, y, t, phase === "fire", -1);
}

// ---------------------------------------------------------------- vehicles
export function drawVehicle(g, v, x, y, t, o) {
  g.save();
  g.translate(x, y);
  line(g, 1.8);
  if (v === "podium") {
    // keynote podium hover-stage: flips gravity
    if (o.flip) g.scale(1, -1);
    drawJensen(g, 0, -20, { ...o, run: null, air: false, noPack: true, wave: true, flipY: false });
    g.beginPath();
    g.moveTo(-18, -4);
    g.lineTo(18, -4);
    g.lineTo(13, 22);
    g.lineTo(-13, 22);
    g.closePath();
    g.fillStyle = C.ink;
    g.fill();
    g.fillStyle = C.yellow;
    g.font = "800 6px Unbounded, sans-serif";
    g.textAlign = "center";
    g.fillText("KEYNOTE", 0, 10);
    // mic
    g.beginPath();
    g.moveTo(12, -4);
    g.lineTo(18, -16);
    line(g, 1.4);
    g.stroke();
    g.beginPath();
    g.arc(18.5, -17, 2, 0, TAU);
    g.fillStyle = C.ink;
    g.fill();
    // hover glow
    g.beginPath();
    g.ellipse(0, 26, 14, 3 + Math.random() * 1.5, 0, 0, TAU);
    g.fillStyle = C.yellow;
    g.fill();
  } else if (v === "mech") {
    // superchip walker
    const ph = o.air ? 0.4 : Math.sin(t * 14);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * 9, 8);
      g.rotate(ph * 0.5 * side);
      rr(g, -3.5, 0, 7, 22, 2);
      g.fillStyle = "#2a2b30";
      g.fill();
      g.stroke();
      rr(g, -6, 20, 14, 5, 2);
      g.fillStyle = C.ink;
      g.fill();
      g.restore();
    }
    rr(g, -20, -14, 40, 26, 4);
    g.fillStyle = "#26272b";
    g.fill();
    g.stroke();
    g.fillStyle = C.yellow;
    g.fillRect(-12, -7, 24, 12);
    g.fillStyle = C.ink;
    g.font = "800 6px Unbounded, sans-serif";
    g.textAlign = "center";
    g.fillText("SUPERCHIP", 0, 2);
    for (let i = -2; i <= 2; i++) {
      g.fillStyle = C.yellow;
      g.fillRect(i * 6 - 1, -17, 2, 3);
      g.fillRect(i * 6 - 1, 12, 2, 3);
    }
    drawJensen(g, 2, -34, { ...o, run: null, air: false, noPack: true, scale: 0.85 });
  } else if (v === "rack") {
    // server-rack glider with wings
    g.beginPath();
    g.moveTo(-6, -4);
    g.lineTo(-34, -12 + Math.sin(t * 8) * 4);
    g.lineTo(-10, 6);
    g.closePath();
    g.fillStyle = C.paper2;
    g.fill();
    g.stroke();
    rr(g, -16, -10, 34, 26, 2);
    g.fillStyle = C.ink2;
    g.fill();
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.fillStyle = "#1c1c1e";
      g.fillRect(-13, -7 + i * 5.5, 28, 4);
      g.fillStyle = (t * 6 + i) % 2 < 1 ? C.green : C.yellow;
      g.fillRect(10, -6 + i * 5.5, 2, 2);
    }
    g.beginPath();
    g.moveTo(-18, 16);
    g.quadraticCurveTo(-22, 22 + Math.random() * 6, -14, 18);
    g.fillStyle = C.yellow;
    g.fill();
    drawJensen(g, 2, -26, { ...o, run: null, air: true, noPack: true, scale: 0.85 });
  }
  g.restore();
}

// ---------------------------------------------------------------- bosses
export function drawBoss(g, b, t) {
  g.save();
  g.translate(b.x, b.y);
  if (b.hurt > 0) g.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  line(g, 2);
  const flash = b.hurt > 0 && (t * 30) % 2 < 1;
  BOSS_ART[b.id](g, t, b, flash);
  g.restore();
}

function propeller(g, x, y, t) {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - 8);
  line(g, 2);
  g.stroke();
  const w = 16 * Math.abs(Math.sin(t * 30));
  g.beginPath();
  g.ellipse(x, y - 9, w, 2.2, 0, 0, TAU);
  g.fillStyle = C.ink2;
  g.fill();
}

const BOSS_ART = {
  board(g, t, b, flash) {
    // floating boardroom table with a row of empty chairs that vote on their own
    for (const px of [-50, 50]) propeller(g, px, -36, t);
    for (let i = 0; i < 6; i++) {
      const cx = -50 + i * 20;
      const bob = Math.sin(t * 4 + i) * 2;
      rr(g, cx - 7, -36 + bob, 14, 22, 3);
      g.fillStyle = flash ? "#fff" : "#2b2c31";
      g.fill();
      line(g, 1.8);
      g.stroke();
      // a raised hand from each chair when voting
      if (b.vote > 0 && i % 2 === Math.floor(t * 4) % 2) {
        g.beginPath();
        g.moveTo(cx, -36 + bob);
        g.lineTo(cx + 2, -48 + bob);
        line(g, 3, C.skin);
        g.stroke();
      }
    }
    rr(g, -66, -16, 132, 14, 3);
    g.fillStyle = flash ? "#fff" : "#7a4b28";
    g.fill();
    line(g, 2);
    g.stroke();
    g.fillStyle = "#5e3a1f";
    g.fillRect(-58, -2, 8, 24);
    g.fillRect(50, -2, 8, 24);
    g.strokeRect(-58, -2, 8, 24);
    g.strokeRect(50, -2, 8, 24);
    nameplate(g, 0, 12, "THE BOARD");
  },
  probe(g, t, b, flash) {
    // the independent investigation: a giant magnifier on a drone
    for (const px of [-28, 28]) propeller(g, px, -50, t);
    rr(g, -34, -50, 68, 10, 3);
    g.fillStyle = C.ink;
    g.fill();
    g.save();
    g.rotate(Math.sin(t * 1.5) * 0.2);
    g.beginPath();
    g.arc(0, 0, 34, 0, TAU);
    g.fillStyle = flash ? "#fff" : "rgba(170,210,235,.55)";
    g.fill();
    line(g, 7);
    g.stroke();
    // big eye in the lens
    g.beginPath();
    g.ellipse(0, 0, 18, 11, 0, 0, TAU);
    g.fillStyle = "#fff";
    g.fill();
    line(g, 2);
    g.stroke();
    const look = b.look || 0;
    g.beginPath();
    g.arc(-6 + look * 4, look * 3, 6, 0, TAU);
    g.fillStyle = C.ink;
    g.fill();
    rr(g, 26, 22, 12, 40, 4);
    g.save();
    g.translate(30, 26);
    g.rotate(-0.6);
    rr(g, -5, 0, 10, 40, 4);
    g.fillStyle = "#7a4b28";
    g.fill();
    line(g, 2);
    g.stroke();
    g.restore();
    g.restore();
    nameplate(g, 0, 50, "THE PROBE");
  },
  hearing(g, t, b, flash) {
    // a flying committee dais with a row of microphones and a big gavel
    for (const px of [-56, 0, 56]) propeller(g, px, -34, t);
    rr(g, -72, -34, 144, 46, 4);
    g.fillStyle = flash ? "#fff" : "#4b2f1a";
    g.fill();
    line(g, 2);
    g.stroke();
    g.fillStyle = C.paper;
    g.fillRect(-64, -31, 128, 9);
    g.fillStyle = C.ink;
    g.font = "700 6px 'Geist Mono', monospace";
    g.textAlign = "center";
    g.fillText("COMMITTEE IN SESSION", 0, -24.5);
    for (let i = 0; i < 5; i++) {
      const mx = -48 + i * 24;
      g.beginPath();
      g.moveTo(mx, 2);
      g.lineTo(mx - 5, -8);
      line(g, 1.6);
      g.stroke();
      g.beginPath();
      g.arc(mx - 6, -9, 2.4, 0, TAU);
      g.fillStyle = (t * 3 + i) % 3 < 1 ? C.red : C.ink;
      g.fill();
    }
    // gavel
    g.save();
    g.translate(-80, -6);
    g.rotate(b.slam > 0 ? 0.9 : -0.4 + Math.sin(t * 3) * 0.1);
    rr(g, -3, -3, 6, 30, 2);
    g.fillStyle = "#7a4b28";
    g.fill();
    line(g, 1.6);
    g.stroke();
    rr(g, -12, -12, 24, 12, 3);
    g.fill();
    g.stroke();
    g.restore();
    nameplate(g, 0, 22, "THE HEARING");
  },
  short(g, t, b, flash) {
    // a short-seller's bear balloon, top hat, red down-arrow tie
    g.beginPath();
    g.moveTo(0, 36);
    g.lineTo(0, 60);
    line(g, 1.2);
    g.stroke();
    rr(g, -14, 58, 28, 14, 2);
    g.fillStyle = "#7a4b28";
    g.fill();
    g.stroke();
    for (const ex of [-26, 26]) {
      g.beginPath();
      g.arc(ex, -28, 11, 0, TAU);
      g.fillStyle = flash ? "#fff" : "#6b4a33";
      g.fill();
      line(g, 2);
      g.stroke();
    }
    g.beginPath();
    g.ellipse(0, 0, 38, 36, 0, 0, TAU);
    g.fillStyle = flash ? "#fff" : "#7d5a40";
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(-8, 10, 16, 12, 0, 0, TAU);
    g.fillStyle = "#c7a17f";
    g.fill();
    line(g, 1.6);
    g.stroke();
    g.beginPath();
    g.ellipse(-16, 6, 4, 3, 0, 0, TAU);
    g.fillStyle = C.ink;
    g.fill();
    // smug eyes (angled)
    g.beginPath();
    g.moveTo(-22, -10);
    g.lineTo(-12, -7);
    g.moveTo(2, -7);
    g.lineTo(12, -10);
    line(g, 3);
    g.stroke();
    // top hat
    rr(g, -20, -58, 34, 26, 2);
    g.fillStyle = C.ink;
    g.fill();
    rr(g, -28, -34, 50, 5, 2);
    g.fill();
    g.fillStyle = C.red;
    g.fillRect(-20, -40, 34, 4);
    // down arrow tie
    g.beginPath();
    g.moveTo(-4, 26);
    g.lineTo(4, 26);
    g.lineTo(4, 34);
    g.lineTo(9, 34);
    g.lineTo(0, 44);
    g.lineTo(-9, 34);
    g.lineTo(-4, 34);
    g.closePath();
    g.fillStyle = C.red;
    g.fill();
    line(g, 1.4);
    g.stroke();
    nameplate(g, 0, 84, "THE SHORT SELLER");
  },
  press(g, t, b, flash) {
    // a blimp of cameras and boom mics
    g.beginPath();
    g.ellipse(0, -10, 64, 28, 0, 0, TAU);
    g.fillStyle = flash ? "#fff" : C.paper2;
    g.fill();
    line(g, 2);
    g.stroke();
    g.fillStyle = C.ink;
    g.font = "900 13px Unbounded, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("BREAKING", 0, -12);
    g.fillStyle = C.red;
    g.fillRect(-46, 0, 92, 6);
    for (let i = 0; i < 4; i++) {
      const cx = -36 + i * 24;
      drawCamera(g, cx, 32 + Math.sin(t * 5 + i) * 3, t, (t * 2 + i) % 4 < 0.3, -1);
      g.beginPath();
      g.moveTo(cx, 18);
      g.lineTo(cx, 24 + Math.sin(t * 5 + i) * 3);
      line(g, 1.4);
      g.stroke();
    }
    // boom mic
    g.beginPath();
    g.moveTo(-60, -10);
    g.lineTo(-92, 14);
    line(g, 2);
    g.stroke();
    rr(g, -104, 10, 18, 10, 5);
    g.fillStyle = C.ink2;
    g.fill();
    nameplate(g, 0, 56, "THE PRESS PACK");
  },
  regulator(g, t, b, flash) {
    // an export-control stamp the size of a building
    for (const px of [-26, 26]) propeller(g, px, -58, t);
    rr(g, -10, -58, 20, 34, 3);
    g.fillStyle = "#7a4b28";
    g.fill();
    line(g, 2);
    g.stroke();
    g.beginPath();
    g.ellipse(0, -60, 18, 8, 0, 0, TAU);
    g.fillStyle = "#5e3a1f";
    g.fill();
    g.stroke();
    rr(g, -44, -24, 88, 16, 3);
    g.fillStyle = C.ink;
    g.fill();
    rr(g, -48, -8, 96, 30, 2);
    g.fillStyle = flash ? "#fff" : C.red;
    g.fill();
    line(g, 2);
    g.stroke();
    g.fillStyle = "#fff";
    g.font = "900 15px Unbounded, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("DENIED", 0, 8);
    nameplate(g, 0, 36, "THE REGULATOR");
  },
};

function nameplate(g, x, y, text) {
  g.font = "800 8px Unbounded, sans-serif";
  const w = g.measureText(text).width + 12;
  g.fillStyle = C.yellow;
  g.fillRect(x - w / 2, y - 7, w, 14);
  g.strokeStyle = C.ink;
  g.lineWidth = 1.5;
  g.strokeRect(x - w / 2, y - 7, w, 14);
  g.fillStyle = C.ink;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x, y + 0.5);
}

export function drawShot(g, s, t) {
  g.save();
  g.translate(s.x, s.y);
  g.rotate(t * 12);
  rr(g, -6, -7, 12, 14, 1);
  g.fillStyle = "#fff";
  g.fill();
  line(g, 1.4);
  g.stroke();
  g.beginPath();
  g.moveTo(-3, 0);
  g.lineTo(-1, 3);
  g.lineTo(3, -3);
  line(g, 1.8, C.red);
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- backdrop
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export const ROOMS = ["LOBBY", "SERVER HALL", "KEYNOTE STAGE", "CHIP LAB", "TRADING FLOOR", "BOARDROOM"];
const ROOM_LEN = 1800;

export function roomAt(x) {
  return ROOMS[Math.floor(Math.max(0, x) / ROOM_LEN) % ROOMS.length];
}

export function drawBackdrop(g, W, camX, t, best) {
  // paper
  g.fillStyle = C.paper;
  g.fillRect(0, 0, W, H);

  // far layer: triangle-truss facade (HQ architecture), slow parallax
  const far = camX * 0.2;
  g.save();
  g.strokeStyle = "rgba(20,20,20,.09)";
  g.lineWidth = 1.2;
  const tw = 60;
  const off = -(far % (tw * 2));
  for (let row = 0; row < 6; row++) {
    const y0 = CEIL + row * 50;
    for (let x = off - tw * 2; x < W + tw * 2; x += tw) {
      const flip = (Math.round((x - off) / tw) + row) % 2;
      g.beginPath();
      if (flip) {
        g.moveTo(x, y0);
        g.lineTo(x + tw, y0);
        g.lineTo(x + tw / 2, y0 + 50);
      } else {
        g.moveTo(x, y0 + 50);
        g.lineTo(x + tw, y0 + 50);
        g.lineTo(x + tw / 2, y0);
      }
      g.closePath();
      g.stroke();
    }
  }
  g.restore();

  // mid layer: room furniture, full speed, chosen by hash per slot
  const slot = 140;
  const first = Math.floor(camX / slot) - 1;
  for (let i = first; i < first + Math.ceil(W / slot) + 3; i++) {
    const wx = i * slot;
    const sx = wx - camX;
    const room = roomAt(wx);
    const r = hash(i);
    drawProp(g, room, sx, r, t, i);
  }

  // room sign every room start
  const ri = Math.floor(camX / ROOM_LEN);
  for (let k = ri; k <= ri + 1; k++) {
    const sx = k * ROOM_LEN - camX + 40;
    if (sx > -200 && sx < W + 50) {
      const name = ROOMS[k % ROOMS.length];
      g.font = "900 22px Unbounded, sans-serif";
      const w = g.measureText(name).width + 24;
      g.fillStyle = C.ink;
      g.fillRect(sx, 46, w, 34);
      g.fillStyle = C.paper;
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.fillText(name, sx + 12, 64);
      g.fillStyle = C.yellow;
      g.fillRect(sx, 80, w, 4);
    }
  }

  // ceiling
  g.fillStyle = C.ink;
  g.fillRect(0, 0, W, CEIL - 6);
  g.fillStyle = C.paper3;
  g.fillRect(0, CEIL - 6, W, 6);
  // lights in ceiling
  for (let x = -((camX * 1) % 120); x < W; x += 120) {
    g.fillStyle = C.yellow;
    g.fillRect(x + 40, CEIL - 6, 40, 3);
  }

  // floor
  g.fillStyle = C.paper2;
  g.fillRect(0, FLOOR, W, H - FLOOR);
  g.fillStyle = C.ink;
  g.fillRect(0, FLOOR, W, 3);
  // ruler ticks
  g.fillStyle = C.ink;
  g.font = "600 8px 'Geist Mono', monospace";
  g.textAlign = "left";
  g.textBaseline = "top";
  const step = 20; // 1 m = 20 units
  const firstTick = Math.floor(camX / step);
  for (let i = firstTick; i < firstTick + W / step + 2; i++) {
    const sx = i * step - camX;
    const big = i % 10 === 0;
    g.fillRect(sx, FLOOR + 3, 1.2, big ? 10 : 4);
    if (i % 50 === 0 && i > 0) g.fillText(`${i} M`, sx + 3, FLOOR + 6);
  }
  // best marker
  if (best > 0) {
    const bx = best * step - camX + 120;
    if (bx > -20 && bx < W + 20) {
      g.fillStyle = C.red;
      g.fillRect(bx, CEIL, 3, FLOOR - CEIL);
      g.fillStyle = C.red;
      g.fillRect(bx, CEIL + 10, 46, 16);
      g.fillStyle = "#fff";
      g.font = "800 8px Unbounded, sans-serif";
      g.textBaseline = "middle";
      g.fillText("BEST", bx + 6, CEIL + 18.5);
    }
  }
}

function drawProp(g, room, x, r, t, i) {
  line(g, 1.5);
  const base = FLOOR;
  if (room === "SERVER HALL" || (room === "CHIP LAB" && r < 0.3)) {
    if (r < 0.75) {
      rr(g, x + 20, base - 170, 60, 170, 2);
      g.fillStyle = "#2a2b30";
      g.fill();
      g.stroke();
      for (let k = 0; k < 14; k++) {
        g.fillStyle = "#1a1b1e";
        g.fillRect(x + 25, base - 164 + k * 11.5, 50, 8);
        g.fillStyle = (Math.floor(t * 4 + k * 1.7 + i) % 3) === 0 ? C.yellow : C.green;
        g.fillRect(x + 68, base - 162 + k * 11.5, 3, 3);
      }
    }
    return;
  }
  if (room === "LOBBY") {
    if (r < 0.35) plant(g, x + 50, base);
    else if (r < 0.7) {
      // tall window with skyline
      rr(g, x + 20, 100, 90, 160, 2);
      g.fillStyle = "#e0e6e4";
      g.fill();
      g.stroke();
      g.fillStyle = "rgba(20,20,20,.12)";
      for (let k = 0; k < 5; k++) g.fillRect(x + 26 + k * 17, 200 - hash(i + k) * 70, 12, 60 + hash(i + k) * 70);
      g.beginPath();
      g.moveTo(x + 65, 100);
      g.lineTo(x + 65, 260);
      g.stroke();
    } else {
      // reception sofa
      rr(g, x + 20, base - 30, 90, 30, 6);
      g.fillStyle = C.ink2;
      g.fill();
      g.stroke();
    }
    return;
  }
  if (room === "KEYNOTE STAGE") {
    if (r < 0.5) {
      // giant screen with a rising chart
      rr(g, x + 10, 96, 120, 74, 2);
      g.fillStyle = C.ink;
      g.fill();
      g.beginPath();
      g.moveTo(x + 18, 160);
      g.lineTo(x + 50, 150);
      g.lineTo(x + 75, 132);
      g.lineTo(x + 100, 120);
      g.lineTo(x + 122, 104);
      line(g, 3, C.yellow);
      g.stroke();
      g.fillStyle = C.paper;
      g.font = "800 9px Unbounded, sans-serif";
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.fillText(["MORE CHIPS", "BIGGER", "SCALE!", "THE MORE YOU BUY"][Math.floor(r * 8) % 4], x + 18, 112);
    } else {
      // spotlight cone
      g.beginPath();
      g.moveTo(x + 60, CEIL);
      g.lineTo(x + 20, base);
      g.lineTo(x + 110, base);
      g.closePath();
      g.fillStyle = "rgba(255,201,60,.16)";
      g.fill();
    }
    return;
  }
  if (room === "CHIP LAB") {
    // microscope desk + wafer poster
    rr(g, x + 10, base - 40, 100, 6, 1);
    g.fillStyle = C.ink;
    g.fill();
    g.fillRect(x + 16, base - 34, 4, 34);
    g.fillRect(x + 100, base - 34, 4, 34);
    g.beginPath();
    g.arc(x + 60, 140, 34, 0, TAU);
    g.fillStyle = "#cfd6dc";
    g.fill();
    line(g, 1.5);
    g.stroke();
    g.strokeStyle = "rgba(20,20,20,.25)";
    for (let k = -30; k <= 30; k += 8) {
      g.beginPath();
      g.moveTo(x + 60 + k, 108);
      g.lineTo(x + 60 + k, 172);
      g.moveTo(x + 28, 140 + k);
      g.lineTo(x + 92, 140 + k);
      g.stroke();
    }
    return;
  }
  if (room === "TRADING FLOOR") {
    // monitors with red tickers
    for (let k = 0; k < 2; k++) {
      rr(g, x + 14 + k * 54, base - 92, 48, 32, 2);
      g.fillStyle = C.ink;
      g.fill();
      g.beginPath();
      g.moveTo(x + 18 + k * 54, base - 86);
      for (let p = 1; p < 8; p++) g.lineTo(x + 18 + k * 54 + p * 5.5, base - 86 + p * 3 + Math.sin(p + i) * 3);
      line(g, 2, C.red);
      g.stroke();
      g.fillStyle = C.ink2;
      g.fillRect(x + 34 + k * 54, base - 60, 6, 20);
    }
    rr(g, x + 6, base - 40, 116, 6, 1);
    g.fillStyle = C.ink;
    g.fill();
    return;
  }
  if (room === "BOARDROOM") {
    if (r < 0.5) {
      // portrait frame: blank, with a sticky note
      rr(g, x + 30, 100, 60, 76, 2);
      g.fillStyle = C.paper2;
      g.fill();
      line(g, 4, "#7a4b28");
      g.stroke();
      g.fillStyle = C.yellow;
      g.fillRect(x + 48, 126, 24, 22);
      g.fillStyle = C.ink;
      g.font = "700 5px 'Geist Mono', monospace";
      g.textAlign = "center";
      g.fillText("TBD", x + 60, 139);
    } else {
      // chairs
      for (let k = 0; k < 3; k++) {
        rr(g, x + 14 + k * 36, base - 48, 24, 48, 4);
        g.fillStyle = "#2b2c31";
        g.fill();
        line(g, 1.5);
        g.stroke();
      }
    }
  }
}

function plant(g, x, base) {
  rr(g, x - 14, base - 30, 28, 30, 3);
  g.fillStyle = C.ink;
  g.fill();
  for (let k = 0; k < 7; k++) {
    g.save();
    g.translate(x, base - 30);
    g.rotate(-1.2 + k * 0.4);
    g.beginPath();
    g.ellipse(0, -22, 6, 22, 0, 0, TAU);
    g.fillStyle = k % 2 ? C.green : "#2f7d4a";
    g.fill();
    line(g, 1.2);
    g.stroke();
    g.restore();
  }
}

// particles helper drawn by main
export function drawParticle(g, p) {
  g.globalAlpha = Math.max(0, p.life / p.max);
  if (p.kind === "chip") drawChip(g, p.x, p.y, p.t, 0.6);
  else if (p.kind === "text") {
    g.font = `800 ${p.size || 10}px Unbounded, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 3;
    g.strokeStyle = C.paper;
    g.strokeText(p.text, p.x, p.y);
    g.fillStyle = p.color || C.ink;
    g.fillText(p.text, p.x, p.y);
  } else {
    g.beginPath();
    g.arc(p.x, p.y, p.r || 3, 0, TAU);
    g.fillStyle = p.color || C.ink;
    g.fill();
  }
  g.globalAlpha = 1;
}
