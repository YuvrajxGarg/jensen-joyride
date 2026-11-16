// Saved progress: chip bank, best distance, missions, rank, wardrobe. localStorage only.

const KEY = "jj-save-v1";

export const JACKETS = [
  { id: "leather", name: "Classic Leather", cost: 0, base: "#17181a", shine: "#4a4d55", trim: "#0b0b0c" },
  { id: "gold", name: "Keynote Gold", cost: 1500, base: "#c9971f", shine: "#ffd96a", trim: "#7d5a0c" },
  { id: "croc", name: "Crocodile Green", cost: 3000, base: "#2f5d3a", shine: "#6fa36f", trim: "#173022", pattern: "scales" },
  { id: "press", name: "Newsprint", cost: 5000, base: "#e9e3d3", shine: "#ffffff", trim: "#141414", pattern: "print" },
  { id: "red", name: "Red Alert", cost: 8000, base: "#c42a22", shine: "#ff6a5e", trim: "#6d130e" },
];

export const RANKS = [
  "Intern",
  "Junior Engineer",
  "Senior Engineer",
  "Director",
  "VP of Vibes",
  "Chief Keynote Officer",
  "Founder Energy",
  "Supreme Leather Jacket",
  "Infinite Scale",
];

// Mission templates. `stat` is what the run tracks; `n` scales with level.
const MISSIONS = [
  { id: "chips", stat: "chips", text: (n) => `Collect ${n} chips in one run`, n: [80, 150, 250, 400, 600] },
  { id: "dist", stat: "dist", text: (n) => `Fly ${n} m in one run`, n: [400, 800, 1200, 1800, 2600] },
  { id: "subpoena", stat: "dodgeMissile", text: (n) => `Dodge ${n} subpoenas`, n: [3, 6, 10, 15, 22] },
  { id: "flash", stat: "dodgeFlash", text: (n) => `Survive ${n} paparazzi flashes`, n: [2, 4, 8, 12, 18] },
  { id: "boss", stat: "bosses", text: (n) => (n === 1 ? "Beat a boss" : `Beat ${n} bosses in one run`), n: [1, 1, 2, 3, 4] },
  { id: "ground", stat: "ground", text: (n) => `Run ${n} m on the floor`, n: [60, 150, 300, 500, 800] },
  { id: "vehicle", stat: "vehicles", text: (n) => (n === 1 ? "Ride a new product" : `Ride ${n} new products in one run`), n: [1, 2, 3, 4, 5] },
  { id: "frugal", stat: "frugal", text: (n) => `Go ${n} m without a single chip`, n: [150, 300, 500, 700, 1000] },
  { id: "ceiling", stat: "ceiling", text: (n) => `Hug the ceiling for ${n} m`, n: [40, 100, 200, 300, 450] },
  { id: "laser", stat: "nearLaser", text: (n) => `Skim past ${n} export bans`, n: [5, 10, 20, 30, 45] },
];

const defaults = () => ({
  bank: 0,
  best: 0,
  runs: 0,
  done: 0,
  jacket: "leather",
  owned: ["leather"],
  missions: [],
  parachutes: 0,
});

let save = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && typeof s === "object") return { ...defaults(), ...s };
  } catch {
    /* blocked or corrupt */
  }
  return defaults();
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

export const state = () => save;
export const rank = () => RANKS[Math.min(RANKS.length - 1, Math.floor(save.done / 3))];
export const rankProgress = () => save.done % 3;
export const jacket = () => JACKETS.find((j) => j.id === save.jacket) || JACKETS[0];

function level() {
  return Math.min(4, Math.floor(save.done / 4));
}

function newMission(exclude) {
  const pool = MISSIONS.filter((m) => !exclude.includes(m.id));
  const m = pool[Math.floor(Math.random() * pool.length)];
  const n = m.n[level()];
  return { id: m.id, n, reward: 50 + level() * 50 + Math.floor(Math.random() * 3) * 25 };
}

export function missions() {
  while (save.missions.length < 3) save.missions.push(newMission(save.missions.map((m) => m.id)));
  return save.missions.map((m) => {
    const t = MISSIONS.find((x) => x.id === m.id);
    return { ...m, text: t.text(m.n), stat: t.stat };
  });
}

// Called live during a run with the run's stats. Returns missions that just completed.
export function checkMissions(stats) {
  const finished = [];
  for (const m of missions()) {
    if (m.complete) continue;
    if ((stats[m.stat] || 0) >= m.n) {
      const raw = save.missions.find((x) => x.id === m.id);
      raw.complete = true;
      finished.push(m);
    }
  }
  if (finished.length) persist();
  return finished;
}

// After a run: pay out completed missions and replace them.
export function settleMissions() {
  const paid = [];
  save.missions = save.missions.filter((m) => {
    if (!m.complete) return true;
    const t = MISSIONS.find((x) => x.id === m.id);
    paid.push({ text: t.text(m.n), reward: m.reward });
    save.bank += m.reward;
    save.done++;
    return false;
  });
  missions();
  persist();
  return paid;
}

export function endRun(dist, chips) {
  save.runs++;
  save.bank += chips;
  const record = dist > save.best;
  if (record) save.best = dist;
  persist();
  return record;
}

export function spend(n) {
  if (save.bank < n) return false;
  save.bank -= n;
  persist();
  return true;
}

export function buyJacket(id) {
  const j = JACKETS.find((x) => x.id === id);
  if (!j) return false;
  if (!save.owned.includes(id)) {
    if (!spend(j.cost)) return false;
    save.owned.push(id);
  }
  save.jacket = id;
  persist();
  return true;
}

export function resetMissionsDebug() {
  save.missions = [];
  missions();
  persist();
}
