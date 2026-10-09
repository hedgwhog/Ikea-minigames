// Treehouse Sniper map. Shared by server and browser. Units are centimetres.
// A long hall seen from above: the treehouse is at the top (y small), runners start at the bottom.
// The sniper sits HIGH in the treehouse and looks down. Hiding works in 3D: a bullet flies in a
// straight line from the sniper's eye, so you are safe only right behind something tall.

export const MAP_W = 1000;
export const MAP_H = 6000;
export const TREE = { x: 500, y: 150 };
export const EYE = { x: 500, y: 150, h: 650 }; // the sniper's eye, 6.5 m up in the treehouse
export const FINISH_Y = 600; // run above this line = made it
export const START_Y = 5800;
export const RUNNER_R = 30;
export const RUNNER_H = 160; // furniture + KNORVA hat
export const RANGE = 9000;

// Cover: 12 rows, the same layouts repeat, so the map is fair and the same every game.
// [x, width] per object in a row.
const LAYOUTS = [
  [[80, 220], [600, 260]],
  [[340, 320]],
  [[100, 180], [410, 180], [730, 180]],
  [[230, 240], [620, 240]],
  [[60, 200], [450, 180], [800, 150]],
  [[520, 300]],
];
const KINDS = ["ballpit", "house", "tunnel", "slide", "toybox", "tent", "foam", "kitchen"];
const LABELS = { ballpit: "Ball pit", house: "Play house", tunnel: "Tunnel", slide: "Slide", toybox: "Toys", tent: "Tent", foam: "", kitchen: "Kitchen" };

// How tall each row is: chosen so the safe spot behind EVERY object is about SAFE_LEN long.
// (Far from the tree you look almost flat over things, so far objects need to be lower.)
const SAFE_LEN = 200;
const heightFor = (y) => {
  const d = y - EYE.y;
  return Math.round((SAFE_LEN * EYE.h + RUNNER_H * d) / (d + SAFE_LEN));
};

export const OBSTACLES = [];
for (let row = 0; row < 12; row++) {
  const y = 1000 + row * 400;
  const tall = heightFor(y + 120);
  LAYOUTS[row % LAYOUTS.length].forEach(([x, w], i) => {
    const kind = KINDS[(row * 3 + i) % KINDS.length];
    OBSTACLES.push({ x, y: y + (i % 2) * 60, w, h: 110 + ((row + i) % 3) * 30, h3: tall, kind, label: LABELS[kind] });
  });
}

// Keep a runner (a circle) out of obstacles and inside the hall
export function moveRunner(p, dx, dy) {
  const steps = Math.ceil(Math.hypot(dx, dy) / 8) || 1;
  for (let i = 0; i < steps; i++) {
    p.x = Math.min(MAP_W - RUNNER_R, Math.max(RUNNER_R, p.x + dx / steps));
    p.y = Math.min(MAP_H - RUNNER_R, Math.max(RUNNER_R, p.y + dy / steps));
    for (const o of OBSTACLES) {
      const cx = Math.max(o.x, Math.min(p.x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(p.y, o.y + o.h));
      const dist = Math.hypot(p.x - cx, p.y - cy);
      if (dist >= RUNNER_R) continue;
      if (dist === 0) { p.y = o.y + o.h + RUNNER_R; continue; }
      p.x = cx + ((p.x - cx) / dist) * RUNNER_R;
      p.y = cy + ((p.y - cy) / dist) * RUNNER_R;
    }
  }
}

// ---------- 3D lines ----------
// Where a line from `from` in direction `d` enters a 3D box: [enter, leave] (in steps of d), or null
function slab(from, d, box) {
  let enter = -Infinity, leave = Infinity;
  for (const [p, dir, lo, hi] of [[from.x, d.x, box.x0, box.x1], [from.y, d.y, box.y0, box.y1], [from.h, d.h, box.h0, box.h1]]) {
    if (Math.abs(dir) < 1e-9) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let t1 = (lo - p) / dir, t2 = (hi - p) / dir;
    if (t1 > t2) [t1, t2] = [t2, t1];
    enter = Math.max(enter, t1);
    leave = Math.min(leave, t2);
    if (enter > leave) return null;
  }
  return [enter, leave];
}
const obstacleBox = (o) => ({ x0: o.x, x1: o.x + o.w, y0: o.y, y1: o.y + o.h, h0: 0, h1: o.h3 });
const runnerBox = (r) => ({ x0: r.x - RUNNER_R, x1: r.x + RUNNER_R, y0: r.y - RUNNER_R, y1: r.y + RUNNER_R, h0: 0, h1: RUNNER_H });

// A bullet from the sniper's eye in direction d ({x, y, h}, length 1). The first thing it touches wins.
export function shoot(d, runners) {
  let best = { t: d.h < 0 ? EYE.h / -d.h : RANGE, hit: null }; // otherwise it hits the floor
  for (const o of OBSTACLES) {
    const s = slab(EYE, d, obstacleBox(o));
    if (s && s[0] > 0 && s[0] < best.t) best = { t: s[0], hit: null };
  }
  for (const r of runners) {
    const s = slab(EYE, d, runnerBox(r));
    if (s && s[0] > 0 && s[0] < best.t) best = { t: s[0], hit: r.id };
  }
  const t = Math.min(best.t, RANGE);
  return { hit: best.hit, x: Math.round(EYE.x + d.x * t), y: Math.round(EYE.y + d.y * t), h: Math.round(EYE.h + d.h * t) };
}

// Is this runner fully hidden? Every line from the sniper's eye to their head and body is blocked.
export function inCover(p) {
  const points = [
    { x: p.x, y: p.y, h: RUNNER_H - 15 },
    { x: p.x, y: p.y, h: 80 },
    { x: p.x - RUNNER_R * 0.8, y: p.y, h: 80 },
    { x: p.x + RUNNER_R * 0.8, y: p.y, h: 80 },
  ];
  return points.every((q) => {
    const d = { x: q.x - EYE.x, y: q.y - EYE.y, h: q.h - EYE.h }; // t = 1 is the point itself
    return OBSTACLES.some((o) => {
      const s = slab(EYE, d, obstacleBox(o));
      return s && s[0] > 0 && s[0] < 1;
    });
  });
}

// The safe spot behind an obstacle (for the minimap): the box itself plus where its top edge
// "lands" at head height, seen from the sniper's eye. Returns SVG polygon points.
export function shadowOf(o) {
  const k = (EYE.h - RUNNER_H) / (EYE.h - o.h3);
  const corners = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
  const landed = corners.map(([x, y]) => [EYE.x + (x - EYE.x) * k, EYE.y + (y - EYE.y) * k]);
  return hull([...corners, ...landed]).map((p) => p.join(",")).join(" ");
}
// Convex hull (the outline around a set of points)
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => list.reduce((h, pt) => {
    while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], pt) <= 0) h.pop();
    return [...h, pt];
  }, []);
  const lower = half(p), upper = half([...p].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
