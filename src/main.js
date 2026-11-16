// Screens, input, canvas sizing, the frame loop, sharing.
import * as G from "./game.js";
import * as D from "./draw.js";
import * as A from "./audio.js";
import * as Meta from "./meta.js";

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const g = canvas.getContext("2d");

const HEADLINES = [
  "Board opens independent investigation",
  "CEO resigns; CFO named interim chief",
  "Shares shed over $600B in a week",
  "Two big investors urge board to consider his return",
  "House committee seeks closed-door briefing Nov 18",
  "Export-control questions over a Singapore buyer",
  "APEC trip in doubt",
  "Leather jacket futures up 3%",
  "Analysts' price target: more chips",
  "Keynote rescheduled, slides still say 'scale'",
];

const CAUSES = {
  "export ban": ["STOPPED BY AN EXPORT BAN", "Licence pending, flight cancelled."],
  "sell-off": ["CAUGHT IN A SELL-OFF", "The chart went one way: down."],
  subpoena: ["SERVED BY SUBPOENA", "Legal says no further comment."],
  paparazzi: ["CAUGHT ON CAMERA", "The photo is everywhere by lunch."],
  question: ["STUMPED BY A QUESTION", "The committee wanted a yes or a no."],
  gavel: ["GAVELLED DOWN", "The motion carried, unfortunately."],
  "leaked memo": ["BURIED IN MEMOS", "Somebody hit reply-all."],
  scrutiny: ["UNDER SCRUTINY", "The probe saw everything."],
  crash: ["CRASHED WITH THE STOCK", "Analysts call it a 'healthy correction'."],
  stamp: ["STAMPED: DENIED", "Application returned to sender."],
  beam: ["ZAPPED", "Ouch."],
  boss: ["TAKEN DOWN", "The news cycle wins this round."],
};

let state = "title"; // title | play | pause | chute | over | wardrobe
let run = null;
let attract = null;
let W = 640;
let scale = 1;
let last = performance.now();
let chuteUses = 0;
let chuteT = 0;
let missionTimer = 0;
let toastTimer = 0;
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- layout
function resize() {
  const stage = $("stage");
  const cw = stage.clientWidth, ch = stage.clientHeight;
  W = Math.round(Math.max(480, Math.min(1000, (cw / ch) * D.H)));
  scale = Math.min(cw / W, ch / D.H);
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.style.width = `${Math.round(W * scale)}px`;
  canvas.style.height = `${Math.round(D.H * scale)}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(D.H * scale * dpr);
  g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  if (run) run.W = W;
  if (attract) attract.W = W;
  $("rotate").classList.toggle("hidden", !(ch > cw * 1.1));
}
window.addEventListener("resize", resize);

// ---------------------------------------------------------------- screens
function show(name) {
  document.body.classList.toggle("on-title", name === "title" || name === "wardrobe");
  for (const s of ["title", "wardrobe", "pause", "chute", "over"]) $(`scr-${s}`).classList.toggle("hidden", s !== name);
}

function fmt(n) {
  return Math.floor(n).toLocaleString("en-US");
}

function missionLi(m, extra = "") {
  return `<li class="${m.complete ? "done" : ""}"><span>${m.text}</span><b>+${m.reward}${extra}</b></li>`;
}

function renderTitle() {
  const s = Meta.state();
  $("t-best").textContent = `${fmt(s.best)} m`;
  $("t-bank").textContent = fmt(s.bank);
  $("t-done").textContent = s.done;
  $("t-rank").textContent = `Rank: ${Meta.rank()}`;
  $("t-missions").innerHTML = Meta.missions().map((m) => missionLi(m)).join("");
  $("btn-mute").textContent = A.isMuted() ? "Sound off" : "Sound on";
}

function goTitle() {
  state = "title";
  run = null;
  document.body.classList.remove("playing");
  $("hud").classList.add("hidden");
  $("scr-boss").classList.add("hidden");
  A.setMood("menu");
  A.thrust(false);
  renderTitle();
  show("title");
  document.body.classList.add("on-title");
}

function startRun() {
  A.start();
  A.setMood("run");
  run = G.createRun({ jacket: Meta.jacket(), best: Meta.state().best });
  run.W = W;
  chuteUses = 0;
  state = "play";
  document.body.classList.add("playing");
  show(null);
  $("hud").classList.remove("hidden");
  hold(false);
  toast("Hold to fly", "Space, click or touch");
}

function toast(text, small = "", dur = 2) {
  const t = $("toast");
  t.innerHTML = `${text}${small ? `<small>${small}</small>` : ""}`;
  t.classList.remove("hidden");
  t.style.animation = "none";
  void t.offsetWidth;
  t.style.animation = "";
  toastTimer = dur;
}

function pause() {
  if (state !== "play") return;
  state = "pause";
  A.thrust(false);
  $("p-missions").innerHTML = Meta.missions().map((m) => missionLi(m)).join("");
  $("btn-pmute").textContent = A.isMuted() ? "Sound off" : "Sound on";
  show("pause");
}

function resume() {
  state = "play";
  show(null);
  hold(false);
  last = performance.now();
}

function chuteCost() {
  return 300 * Math.pow(2, chuteUses);
}

function onDown() {
  const s = Meta.state();
  const cost = chuteCost();
  if (s.bank + run.stats.chips >= cost) {
    state = "chute";
    chuteT = 4;
    $("c-cost").textContent = fmt(cost);
    $("c-cause").textContent = (run.cause || "").toUpperCase();
    show("chute");
  } else finish();
}

function deployChute() {
  const cost = chuteCost();
  const s = Meta.state();
  if (s.bank >= cost) Meta.spend(cost);
  else {
    run.stats.chips -= cost - s.bank;
    Meta.spend(s.bank);
  }
  chuteUses++;
  G.revive(run);
  A.coinBank();
  state = "play";
  show(null);
  hold(false);
  toast("Golden parachute deployed", "Severance well spent");
}

function finish() {
  state = "over";
  A.thrust(false);
  A.setMood("menu");
  const st = run.stats;
  const d = G.dist(run);
  Meta.checkMissions(st);
  const record = Meta.endRun(d, st.chips);
  const paid = Meta.settleMissions();
  const [head, deck] = CAUSES[run.cause] || CAUSES.boss;
  $("o-head").textContent = `Jensen flies ${fmt(d)} m, ${head.toLowerCase()}`;
  $("o-deck").textContent = deck + (st.bosses ? ` Beat ${st.bosses} boss${st.bosses > 1 ? "es" : ""} on the way.` : "");
  $("o-dist").textContent = `${fmt(d)} m`;
  $("o-best").innerHTML = record ? `<span class="new-best">New best!</span>` : `Best ${fmt(Meta.state().best)} m`;
  $("o-chips").textContent = fmt(st.chips);
  $("o-boss").textContent = st.bosses;
  const now = Meta.missions();
  $("o-missions").innerHTML =
    paid.map((p) => `<li class="done"><span>${p.text}</span><b>+${p.reward}</b></li>`).join("") +
    now.map((m) => missionLi(m)).join("");
  if (paid.length) A.coinBank();
  lastResult = { d, chips: st.chips, bosses: st.bosses, head };
  show("over");
  $("hud").classList.add("hidden");
  document.body.classList.remove("playing");
}

// ---------------------------------------------------------------- wardrobe
function renderWardrobe() {
  const s = Meta.state();
  $("w-bank").textContent = fmt(s.bank);
  const list = $("w-list");
  list.innerHTML = "";
  for (const j of Meta.JACKETS) {
    const owned = s.owned.includes(j.id);
    const b = document.createElement("button");
    b.className = `jacket ${s.jacket === j.id ? "on" : ""} ${owned ? "" : "locked"}`;
    const cv = document.createElement("canvas");
    b.append(cv);
    b.insertAdjacentHTML("beforeend", `<b>${j.name}</b><span>${s.jacket === j.id ? "Wearing" : owned ? "Owned · tap to wear" : `${fmt(j.cost)} chips`}</span>`);
    b.onclick = () => {
      if (Meta.buyJacket(j.id)) {
        A.coinBank();
        renderWardrobe();
      } else {
        A.sfx.click();
        b.querySelector("span").textContent = `Need ${fmt(j.cost - s.bank)} more chips`;
      }
    };
    list.append(b);
    requestAnimationFrame(() => {
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cv.width = r.width * dpr;
      cv.height = r.height * dpr;
      const c = cv.getContext("2d");
      c.scale(dpr, dpr);
      c.translate(r.width / 2, r.height / 2 + 12);
      c.scale(1.35, 1.35);
      D.drawJensen(c, 0, 0, { t: 0, run: 0.2, jacket: j, expr: "smile" });
    });
  }
}

// ---------------------------------------------------------------- input
function hold(on) {
  if (run) G.setHold(run, on && state === "play");
}
function isUi(e) {
  return e.target.closest && e.target.closest("button, .screen, a");
}
window.addEventListener("pointerdown", (e) => {
  if (state === "play" && !isUi(e)) {
    A.start();
    hold(true);
    e.preventDefault();
  }
});
window.addEventListener("pointerup", () => hold(false));
window.addEventListener("pointercancel", () => hold(false));
window.addEventListener("blur", () => {
  hold(false);
  pause();
});
document.addEventListener("visibilitychange", () => document.hidden && pause());
window.addEventListener("keydown", (e) => {
  const k = e.code;
  if (k === "Space" || k === "ArrowUp" || k === "KeyW") {
    e.preventDefault();
    if (e.repeat) return;
    if (state === "play") hold(true);
    else if (state === "title") startRun();
    else if (state === "over") startRun();
    else if (state === "pause") resume();
  } else if (k === "Escape" || k === "KeyP") {
    if (state === "play") pause();
    else if (state === "pause") resume();
  } else if (k === "KeyM") {
    A.setMuted(!A.isMuted());
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") hold(false);
});
window.addEventListener("contextmenu", (e) => e.preventDefault());

$("btn-play").onclick = startRun;
$("btn-again").onclick = startRun;
$("btn-menu").onclick = goTitle;
$("btn-pause").onclick = pause;
$("btn-resume").onclick = resume;
$("btn-quit").onclick = () => {
  run.cause = run.cause || "boss";
  run.state = "down";
  finish();
};
$("btn-chute").onclick = deployChute;
$("btn-nochute").onclick = finish;
$("btn-wardrobe").onclick = () => {
  A.start();
  A.sfx.click();
  state = "wardrobe";
  renderWardrobe();
  show("wardrobe");
};
$("btn-wback").onclick = goTitle;
for (const id of ["btn-mute", "btn-pmute"])
  $(id).onclick = () => {
    A.start();
    A.setMuted(!A.isMuted());
    $("btn-mute").textContent = $("btn-pmute").textContent = A.isMuted() ? "Sound off" : "Sound on";
  };
$("btn-share").onclick = share;

// ---------------------------------------------------------------- events from the run
function drainEvents() {
  for (const ev of run.events) {
    if (ev.type === "bossWarn") {
      toast("Warning: incoming news", "Clear the room");
      A.sfx.warn();
    } else if (ev.type === "boss") {
      $("b-name").textContent = ev.name;
      $("b-intro").textContent = ev.intro;
      const el = $("scr-boss");
      el.classList.remove("hidden");
      const card = el.firstElementChild;
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.animation = "";
      setTimeout(() => el.classList.add("hidden"), 2400);
    } else if (ev.type === "vehicle") {
      toast(ev.name, ev.hint, 2.4);
    } else if (ev.type === "down") {
      onDown();
    }
  }
  run.events.length = 0;
}

// ---------------------------------------------------------------- share
let lastResult = null;

function shareCard() {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1080;
  const x = c.getContext("2d");
  x.fillStyle = D.C.paper;
  x.fillRect(0, 0, 1080, 1080);
  x.fillStyle = "rgba(20,20,20,.06)";
  for (let i = 0; i < 1080; i += 14) for (let j = 0; j < 1080; j += 14) x.fillRect(i, j, 2, 2);
  x.fillStyle = D.C.ink;
  x.fillRect(0, 0, 1080, 120);
  x.fillStyle = D.C.paper;
  x.font = "900 54px Unbounded, sans-serif";
  x.textBaseline = "middle";
  x.fillText("JENSEN JOYRIDE", 50, 62);
  x.fillStyle = D.C.red;
  x.fillRect(820, 38, 210, 48);
  x.fillStyle = "#fff";
  x.font = "700 26px 'Geist Mono', monospace";
  x.fillText("PARODY", 870, 63);
  x.save();
  x.translate(800, 560);
  x.rotate(-0.15);
  x.scale(7, 7);
  D.drawJensen(x, 0, 0, { t: 1, run: 0, air: true, thrust: true, expr: "grin", jacket: Meta.jacket() });
  x.restore();
  x.fillStyle = D.C.ink;
  x.font = "900 150px Unbounded, sans-serif";
  x.fillText(`${fmt(lastResult.d)}`, 50, 300);
  x.font = "900 60px Unbounded, sans-serif";
  x.fillText("METRES", 56, 410);
  x.fillStyle = D.C.yellow;
  x.fillRect(50, 470, 420, 70);
  x.fillStyle = D.C.ink;
  x.font = "800 36px Unbounded, sans-serif";
  x.fillText(`${fmt(lastResult.chips)} CHIPS`, 70, 507);
  if (lastResult.bosses) {
    x.font = "700 32px 'Geist Mono', monospace";
    x.fillText(`${lastResult.bosses} BOSS${lastResult.bosses > 1 ? "ES" : ""} BEATEN`, 56, 600);
  }
  x.fillStyle = D.C.ink;
  x.fillRect(0, 900, 1080, 180);
  x.fillStyle = D.C.yellow;
  x.font = "800 30px Unbounded, sans-serif";
  x.fillText(lastResult.head, 50, 960);
  x.fillStyle = D.C.paper;
  x.font = "600 26px 'Geist Mono', monospace";
  x.fillText(location.host || "jensen-joyride", 50, 1020);
  return c;
}

async function share() {
  if (!lastResult) return;
  const text = `I flew ${fmt(lastResult.d)} m in Jensen Joyride and grabbed ${fmt(lastResult.chips)} chips. Beat that:`;
  const url = location.origin + location.pathname;
  try {
    const blob = await new Promise((res) => shareCard().toBlob(res, "image/png"));
    const file = new File([blob], "jensen-joyride.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text, url });
      return;
    }
    if (navigator.share) {
      await navigator.share({ text, url });
      return;
    }
    await navigator.clipboard?.writeText(`${text} ${url}`);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jensen-joyride.png";
    a.click();
    $("btn-share").textContent = "Copied + saved";
  } catch {
    /* share cancelled */
  }
}

// ---------------------------------------------------------------- loop
function frame(now) {
  const dt = Math.min(1 / 20, (now - last) / 1000);
  last = now;

  if (run && (state === "play" || state === "chute" || state === "over")) {
    if (state === "play") {
      // fixed sub-steps keep collisions honest on slow phones
      let left = dt;
      while (left > 0) {
        const s = Math.min(1 / 120, left);
        G.update(run, s);
        left -= s;
      }
      drainEvents();
      $("dist").textContent = fmt(G.dist(run));
      $("chips").textContent = fmt(run.stats.chips);
      missionTimer -= dt;
      if (missionTimer <= 0 && run.state === "run") {
        missionTimer = 0.5;
        for (const m of Meta.checkMissions(run.stats)) {
          toast("Mission complete", m.text, 2.4);
          A.sfx.coinBank();
        }
      }
    } else if (state === "chute") {
      chuteT -= dt;
      $("c-bar").style.width = `${Math.max(0, (chuteT / 4) * 100)}%`;
      if (chuteT <= 0) finish();
    }
    G.render(g, run);
  } else if (run && state === "pause") {
    G.render(g, run);
  } else {
    // attract mode behind the title: Jensen cruising through HQ
    if (!attract) attract = G.createRun({ jacket: Meta.jacket(), best: 0 });
    attract.W = W;
    attract.jacket = Meta.jacket();
    attract.t += dt;
    attract.camX += 140 * dt;
    attract.p.y = 190 + Math.sin(attract.t * 1.4) * 50;
    attract.p.onGround = false;
    attract.p.run += dt;
    attract.hold = Math.cos(attract.t * 1.4) < 0;
    attract.p.expr = "smile";
    for (const q of attract.parts) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    attract.parts = attract.parts.filter((q) => q.life > 0);
    if (attract.hold && Math.random() < 0.6)
      attract.parts.push({ x: 97, y: attract.p.y + 16, vx: -120, vy: 160, life: 0.35, max: 0.35, r: 3, color: Math.random() < 0.5 ? D.C.yellow : D.C.red });
    G.render(g, attract);
  }

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $("toast").classList.add("hidden");
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot
$("ticker-track").innerHTML = [...HEADLINES, ...HEADLINES].map((h) => `<span>${h}</span>`).join("");
resize();
renderTitle();
A.setMood("menu");
document.fonts?.ready.then(() => renderTitle());
if (params.has("boss") || params.has("dist") || params.has("play")) {
  // debug: jump straight into a run
  setTimeout(startRun, 50);
}
requestAnimationFrame(frame);

// test hooks (used by the screenshot script)
window.__jj = {
  get run() {
    return run;
  },
  get state() {
    return state;
  },
  hold,
  startRun,
};
