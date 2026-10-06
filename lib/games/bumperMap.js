export const CART_R = 32; 
export const MAP_W = 4800;
export const MAP_H = 3400;
const T = 16;
const DOOR = 200;

function box(x, y, w, h, sides) {
  const side = (kind, sx, sy, len, horizontal) => {
    if (kind === "open") return [];
    const rect = (a, l) => (horizontal ? { x: sx + a, y: sy, w: l, h: T } : { x: sx, y: sy + a, w: T, h: l });
    if (kind === "wall") return [rect(0, len)];
    const part = (len - DOOR) / 2;
    return [rect(0, part), rect(part + DOOR, part)];
  };
  const [top, right, bottom, left] = sides.split(" ");
  return [
    ...side(top, x, y, w, true), ...side(bottom, x, y + h - T, w, true),
    ...side(left, x, y, h, false), ...side(right, x + w - T, y, h, false),
  ];
}

const repeat = (n, r, dx, dy) => Array.from({ length: n }, (_, i) => ({ ...r, x: r.x + i * dx, y: r.y + i * dy }));
const solid = (list, kind) => list.map((r) => ({ ...r, kind }));

export const ZONES = [
  ...["Living rooms", "Sofas", "Workspaces", "Kitchens", "Dining", "Bedrooms"].map((label, i) =>
    ({ label, x: 200 + i * 680, y: 200, w: 560, h: 520, color: "#ffffff" })),
  { label: "Restaurant", x: 200, y: 900, w: 1700, h: 600, color: "#e6eef6" },
  { label: "Småland", x: 2100, y: 900, w: 600, h: 600, color: "#fff4c2" },
  { label: "Bathrooms", x: 2900, y: 900, w: 600, h: 600, color: "#ffffff" },
  { label: "Children's IKEA", x: 3700, y: 900, w: 600, h: 600, color: "#ffffff" },
  { label: "Market hall", x: 200, y: 1750, w: 2000, h: 1400, color: "#f6efe2" },
  { label: "Self-serve", x: 2400, y: 1750, w: 1500, h: 1400, color: "#e7e9ec" },
  { label: "Cash registers", x: 4050, y: 1750, w: 550, h: 1100, color: "#fff4c2" },
  { label: "Bistro & Exit", x: 4050, y: 2900, w: 550, h: 300, color: "#e6eef6" },
];

export const WALLS = [
  ...box(0, 0, MAP_W, MAP_H, "wall wall wall wall"), 
  ...ZONES.slice(0, 6).flatMap((z) => box(z.x, z.y, z.w, z.h, "wall door door door")),
  ...solid([0, 1, 2, 3, 4, 5].map((i) => ({ x: 330 + i * 680, y: 330, w: 260, h: 90 })), "furniture"),
  ...box(200, 900, 1700, 600, "door door door wall"),
  ...solid([{ x: 280, y: 980, w: 700, h: 50 }], "counter"),
  ...solid([0, 1, 2].flatMap((row) => repeat(9, { x: 300 + (row % 2) * 60, y: 1130 + row * 120, w: 70, h: 70 }, 170, 0)), "table"),
  ...box(2100, 900, 600, 600, "wall wall door wall"),
  ...box(2900, 900, 600, 600, "door door door door"),
  ...box(3700, 900, 600, 600, "door wall door door"),
  ...solid([{ x: 3040, y: 1020, w: 140, h: 90 }, { x: 3300, y: 1260, w: 120, h: 120 }, { x: 3820, y: 1040, w: 200, h: 80 }], "furniture"),
  ...solid([0, 1, 2, 3, 4, 5].flatMap((row) => repeat(3, { x: 320, y: 1900 + row * 200, w: 520, h: 34 }, 620, 0)), "shelf"),
  ...solid(repeat(8, { x: 2520, y: 1880, w: 40, h: 1100 }, 175, 0), "rack"),
  ...solid(repeat(6, { x: 4180, y: 1880, w: 300, h: 50 }, 0, 160), "counter"),
  ...solid(repeat(3, { x: 4150, y: 3010, w: 70, h: 70 }, 140, 0), "table"), 
];

function resolveWalls(p) {
  for (const w of WALLS) {
    const cx = Math.max(w.x, Math.min(p.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(p.y, w.y + w.h));
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist >= CART_R) continue;
    if (dist === 0) { p.y = w.y - CART_R; continue; }
    p.x = cx + ((p.x - cx) / dist) * CART_R;
    p.y = cy + ((p.y - cy) / dist) * CART_R;
  }
}

export function moveWithWalls(p, dx, dy) {
  const steps = Math.ceil(Math.hypot(dx, dy) / 10) || 1;
  for (let i = 0; i < steps; i++) {
    p.x += dx / steps;
    p.y += dy / steps;
    resolveWalls(p);
  }
}
export const inWall = (p) => WALLS.some((w) => p.x > w.x - CART_R && p.x < w.x + w.w + CART_R && p.y > w.y - CART_R && p.y < w.y + w.h + CART_R);


export const ZONE = { wait: 10000, shrink: 12000, radii: [1400, 950, 600, 340, 150] };
export const ZONE_TOTAL = ZONE.radii.length * (ZONE.wait + ZONE.shrink);

export function makeZones() {
  const zones = [{ x: MAP_W / 2, y: MAP_H / 2, r: Math.round(Math.hypot(MAP_W, MAP_H) / 2 + 100) }];
  for (const r of ZONE.radii) {
    const last = zones.at(-1);
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * Math.max(0, last.r - r); // stays inside the previous circle
    const x = Math.min(MAP_W - 300, Math.max(300, last.x + Math.cos(angle) * dist));
    const y = Math.min(MAP_H - 300, Math.max(300, last.y + Math.sin(angle) * dist));
    zones.push({ x: Math.round(x), y: Math.round(y), r });
  }
  return zones;
}
export function zoneAt(zones, startAt, time) {
  const step = ZONE.wait + ZONE.shrink;
  const t = Math.max(0, time - startAt);
  const i = Math.floor(t / step);
  if (i >= zones.length - 1) return { ...zones.at(-1), next: null, shrinking: false, msLeft: 0 };
  const [from, to] = [zones[i], zones[i + 1]];
  const inStep = t - i * step;
  if (inStep < ZONE.wait) return { ...from, next: to, shrinking: false, msLeft: ZONE.wait - inStep };
  const p = (inStep - ZONE.wait) / ZONE.shrink;
  const mix = (a, b) => a + (b - a) * p;
  return { x: mix(from.x, to.x), y: mix(from.y, to.y), r: mix(from.r, to.r), next: to, shrinking: true, msLeft: step - inStep };
}