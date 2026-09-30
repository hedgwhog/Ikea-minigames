// The Cart Bumper store: a real IKEA route. Showroom -> Restaurant -> Market hall ->
// Self-serve -> Cash registers. Shared by the server (who is out) and the browser (moving + drawing).

export const CART_R = 24; // player radius
export const MAP_W = 4800;
export const MAP_H = 3400;
const T = 16; // wall thickness
const DOOR = 200;

// Walls of a box. Each side is "wall", "door" (wall with an opening in the middle) or "open".
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
// n copies of a rectangle, stepping by (dx, dy)
const repeat = (n, r, dx, dy) => Array.from({ length: n }, (_, i) => ({ ...r, x: r.x + i * dx, y: r.y + i * dy }));
const solid = (list, kind) => list.map((r) => ({ ...r, kind }));

// The floor areas (drawn as coloured zones with a label), in the order you walk through IKEA
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
  ...box(0, 0, MAP_W, MAP_H, "wall wall wall wall"), // the building
  // Showroom: 6 rooms in a row, the path runs through their side doors and below them
  ...ZONES.slice(0, 6).flatMap((z) => box(z.x, z.y, z.w, z.h, "wall door door door")),
  ...solid([0, 1, 2, 3, 4, 5].map((i) => ({ x: 330 + i * 680, y: 330, w: 260, h: 90 })), "furniture"),
  // Restaurant: food counter + lots of tables
  ...box(200, 900, 1700, 600, "door door door wall"),
  ...solid([{ x: 280, y: 980, w: 700, h: 50 }], "counter"),
  ...solid([0, 1, 2].flatMap((row) => repeat(9, { x: 300 + (row % 2) * 60, y: 1130 + row * 120, w: 70, h: 70 }, 170, 0)), "table"),
  // Småland, bathrooms, kids
  ...box(2100, 900, 600, 600, "wall wall door wall"),
  ...box(2900, 900, 600, 600, "door door door door"),
  ...box(3700, 900, 600, 600, "door wall door door"),
  ...solid([{ x: 3040, y: 1020, w: 140, h: 90 }, { x: 3300, y: 1260, w: 120, h: 120 }, { x: 3820, y: 1040, w: 200, h: 80 }], "furniture"),
  // Market hall: long rows of shelves with gaps
  ...solid([0, 1, 2, 3, 4, 5].flatMap((row) => repeat(3, { x: 320, y: 1900 + row * 200, w: 520, h: 34 }, 620, 0)), "shelf"),
  // Self-serve warehouse: tall racks
  ...solid(repeat(8, { x: 2520, y: 1880, w: 40, h: 1100 }, 175, 0), "rack"),
  // Cash registers: checkout counters with lanes between them
  ...solid(repeat(6, { x: 4180, y: 1880, w: 300, h: 50 }, 0, 160), "counter"),
  ...solid(repeat(3, { x: 4150, y: 3010, w: 70, h: 70 }, 140, 0), "table"),
];

// Push a circle out of every wall it overlaps
function resolveWalls(p) {
  for (const w of WALLS) {
    const cx = Math.max(w.x, Math.min(p.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(p.y, w.y + w.h));
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist >= CART_R) continue;
    if (dist === 0) { p.y = w.y - CART_R; continue; } // centre inside a wall: pop out on top
    p.x = cx + ((p.x - cx) / dist) * CART_R;
    p.y = cy + ((p.y - cy) / dist) * CART_R;
  }
}
// Move in small steps so fast moves (dash, pushes) can't go through walls
export function moveWithWalls(p, dx, dy) {
  const steps = Math.ceil(Math.hypot(dx, dy) / 10) || 1;
  for (let i = 0; i < steps; i++) {
    p.x += dx / steps;
    p.y += dy / steps;
    resolveWalls(p);
  }
}
export const inWall = (p) => WALLS.some((w) => p.x > w.x - CART_R && p.x < w.x + w.w + CART_R && p.y > w.y - CART_R && p.y < w.y + w.h + CART_R);

// The 3 push modes. `test` gets the target position relative to the pusher:
// ahead = distance in front of the pusher, side = distance to the left/right.
export const PUSH_MODES = [
  { name: "Ring", hint: "all around, short", range: 150, force: 1000, test: () => true },
  { name: "Wall", hint: "one side, longer", range: 290, force: 1100, test: (ahead) => ahead > 0 },
  { name: "Beam", hint: "thin, very far", range: 600, force: 1250, test: (ahead, side) => ahead > 0 && side < CART_R + 22 },
];
// Does a push hit this target? Returns the knockback (x, y) or null.
export function pushHit(push, target) {
  const dx = target.x - push.x, dy = target.y - push.y, dist = Math.hypot(dx, dy);
  const mode = PUSH_MODES[push.mode];
  const ahead = dx * push.dx + dy * push.dy;
  const side = Math.abs(dx * push.dy - dy * push.dx);
  if (!dist || dist > mode.range + CART_R || !mode.test(ahead, side)) return null;
  const [ux, uy] = push.mode === 0 ? [dx / dist, dy / dist] : [push.dx, push.dy];
  return { x: ux * mode.force, y: uy * mode.force };
}

// The light circle: it shrinks from the whole store towards a RANDOM final spot.
export const LIGHT = { delay: 4000, shrink: 80000, finalR: 260 };
export function circleAt(game, time) {
  const p = Math.min(1, Math.max(0, (time - game.startAt - LIGHT.delay) / LIGHT.shrink));
  const start = { x: MAP_W / 2, y: MAP_H / 2, r: Math.hypot(MAP_W, MAP_H) / 2 + 100 };
  const end = { ...game.final, r: LIGHT.finalR };
  const mix = (a, b) => a + (b - a) * p;
  return { x: mix(start.x, end.x), y: mix(start.y, end.y), r: mix(start.r, end.r) };
}
