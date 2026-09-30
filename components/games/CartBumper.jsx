"use client";
// I move MY cart in the browser (60fps, smooth) and send my position ~10x a second.
// Pushes are sent as live data too; every browser checks itself: "did that push hit ME?"
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRoom } from "@/context/RoomContext";
import { useTheme } from "@/context/ThemeContext";
import { useInterval } from "@/hooks/useInterval";
import { direction, useKeys } from "@/hooks/useKeys";
import { CART_R, circleAt, MAP_H, MAP_W, moveWithWalls, PUSH_MODES, pushHit, WALLS, ZONES } from "@/lib/games/bumperMap";
import Furniture from "../Furniture";

const SPEED = 330;
const DASH = { speed: 1300, time: 170, cooldown: 1500 };
const PUSH_COOLDOWN = 900;
const WAVE_MS = 450; // how long the push wave animation takes
const COLORS = { furniture: "#c9ad84", table: "#d9c7a6", counter: "#0058a3", shelf: "#b58c5a", rack: "#0058a3" };

export default function CartBumper() {
  const { me, room, now, sendLive } = useRoom();
  const { dark } = useTheme();
  const game = room.game;
  const live = game.live ?? {};
  const alive = game.alive.includes(me);
  const [, redraw] = useReducer((n) => n + 1, 0);
  const [mode, setMode] = useState(0);
  const s = useRef({ ...(game.spawns[me] ?? { x: MAP_W / 2, y: MAP_H / 2 }), vx: 0, vy: 0, face: { x: 1, y: 0 }, dashUntil: 0, dashReady: 0, pushReady: 0, push: null, seen: {} });

  const push = () => {
    const c = s.current, t = now();
    if (!alive || t < game.startAt || t < c.pushReady) return;
    c.pushReady = t + PUSH_COOLDOWN;
    c.push = { n: (c.push?.n ?? 0) + 1, mode, x: Math.round(c.x), y: Math.round(c.y), dx: c.face.x, dy: c.face.y, at: t };
  };
  const dash = () => {
    const c = s.current, t = now();
    if (alive && t >= game.startAt && t >= c.dashReady) (c.dashUntil = t + DASH.time), (c.dashReady = t + DASH.cooldown);
  };
  const keys = useKeys((key) => {
    if (key === "q") setMode((m) => (m + 1) % 3);
    if (key === " ") push();
    if (key === "e") dash();
  });

  // Movement loop
  useEffect(() => {
    let last = performance.now();
    let frame;
    const loop = (t) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const c = s.current;
      if (alive && now() >= game.startAt) {
        const dir = direction(keys);
        if (dir.x || dir.y) c.face = dir;
        const dashing = now() < c.dashUntil;
        const move = dashing ? { x: c.face.x * DASH.speed, y: c.face.y * DASH.speed } : { x: dir.x * SPEED, y: dir.y * SPEED };
        moveWithWalls(c, (move.x + c.vx) * dt, (move.y + c.vy) * dt);
        const friction = Math.pow(0.03, dt); // knockback slows down quickly
        c.vx *= friction;
        c.vy *= friction;
      }
      redraw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [alive, game.startAt, keys, now]);

  // Did someone else's push hit me?
  useEffect(() => {
    const c = s.current;
    for (const [id, l] of Object.entries(live)) {
      if (id === me || !l.push || l.push.n === c.seen[id]) continue;
      c.seen[id] = l.push.n;
      const hit = alive && now() - l.push.at < 1000 && pushHit(l.push, c);
      if (hit) (c.vx += hit.x), (c.vy += hit.y);
    }
  }, [live, me, alive, now]);

  useInterval(() => sendLive({ x: Math.round(s.current.x), y: Math.round(s.current.y), push: s.current.push }), 100);

  // Camera: follows me (or the light when I'm out)
  const view = useRef(null);
  const [vw, setVw] = useState(800);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setVw(e.contentRect.width));
    ro.observe(view.current);
    return () => ro.disconnect();
  }, []);
  const t = now();
  const light = circleAt(game, t);
  const scale = Math.min(0.7, Math.max(0.3, vw / 1500));
  const vh = Math.max(320, Math.min(620, vw * 0.7));
  const focus = alive ? s.current : light;
  const camX = Math.max(0, Math.min(MAP_W * scale - vw, focus.x * scale - vw / 2));
  const camY = Math.max(0, Math.min(MAP_H * scale - vh, focus.y * scale - vh / 2));

  const players = game.playerIds.map((id) => ({ id, ...(id === me ? s.current : live[id] ?? game.spawns[id]) }));
  // active pushes: drawn at the pusher's CURRENT position, growing and fading out
  const waves = players
    .map((p) => ({ p, push: p.id === me ? s.current.push : live[p.id]?.push }))
    .filter(({ push }) => push && t - push.at < WAVE_MS);
  const walls = useMemo(() => WALLS.map((w, i) => <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} rx={w.kind ? 10 : 2} fill={COLORS[w.kind] ?? "#7d858c"} />), []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
        <span className="rounded-full bg-ink px-3 py-1 text-page">{game.alive.length} in the light</span>
        {PUSH_MODES.map((m, i) => (
          <button key={m.name} onClick={() => setMode(i)} className={`rounded-full px-3 py-1 ${mode === i ? "bg-yellow text-[#111]" : "bg-page"}`}>
            {m.name} <span className="font-normal">({m.hint})</span>
          </button>
        ))}
        {!alive && <span className="rounded-full bg-red px-3 py-1 text-white">You're out!</span>}
      </div>

      <div ref={view} className="relative overflow-hidden rounded-xl border-4 border-ink bg-[#efefea]" style={{ height: vh }}>
        <div className="absolute left-0 top-0" style={{ width: MAP_W * scale, height: MAP_H * scale, transform: `translate(${-camX}px, ${-camY}px)` }}>
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full">
            <defs>
              <mask id="dark">
                <rect width={MAP_W} height={MAP_H} fill="white" />
                <circle cx={light.x} cy={light.y} r={light.r} fill="black" />
              </mask>
            </defs>
            {ZONES.map((z) => (
              <g key={z.label}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={z.color} />
                <text x={z.x + z.w / 2} y={z.y + z.h - 36} textAnchor="middle" fontSize="44" fontWeight="900" fill="#0058a3" opacity=".35">{z.label}</text>
              </g>
            ))}
            {walls}
            {/* aim preview of my current push mode */}
            {alive && <PushShape push={{ mode, dx: s.current.face.x, dy: s.current.face.y }} at={s.current} grow={1} opacity={0.1} />}
            {waves.map(({ p, push }) => {
              const progress = (t - push.at) / WAVE_MS;
              const grow = 1 - Math.pow(1 - progress, 3); // ease-out: fast first, then slow
              return <PushShape key={p.id} push={push} at={p} grow={0.25 + 0.75 * grow} opacity={0.55 * (1 - progress)} />;
            })}
            <rect width={MAP_W} height={MAP_H} fill="#05080d" opacity={dark ? 0.9 : 0.65} mask="url(#dark)" />
            <circle cx={light.x} cy={light.y} r={light.r} fill="none" stroke="#ffdb00" strokeWidth="10" strokeDasharray="30 20" />
          </svg>

          {players.map((p) => (
            <div key={p.id}
              className={`absolute flex flex-col items-center ${p.id === me ? "z-10" : "transition-all duration-100 ease-linear"} ${game.alive.includes(p.id) ? "" : "opacity-30"}`}
              style={{ left: p.x * scale, top: p.y * scale, width: Math.max(28, CART_R * 2 * scale), translate: "-50% -50%" }}>
              <Furniture id={room.players[p.id]?.character} className={`aspect-square w-full rounded-full bg-white ${p.id === me ? "ring-4 ring-yellow" : ""}`} />
              <span className="whitespace-nowrap rounded bg-white px-1 text-[10px] font-bold text-[#111]">{p.id === me ? "You" : room.players[p.id]?.name}</span>
            </div>
          ))}
        </div>

        <MiniMap players={players} light={light} me={me} />
        {t < game.startAt && <p className="absolute inset-0 grid place-items-center text-7xl font-black text-blue">{Math.ceil((game.startAt - t) / 1000)}</p>}
      </div>

      <p className="hidden text-sm text-muted sm:block">WASD / arrows move · Space push · E dash · Q switch push mode</p>
      <TouchPad keys={keys} push={push} dash={dash} nextMode={() => setMode((m) => (m + 1) % 3)} />
    </div>
  );
}

// Draws what a push covers (a ring, a half circle or a long thin beam) at position `at`,
// scaled by `grow` (0..1) so it can expand like a shock wave.
function PushShape({ push, at, grow, opacity }) {
  const m = PUSH_MODES[push.mode];
  const angle = (Math.atan2(push.dy, push.dx) * 180) / Math.PI;
  const r = m.range + CART_R;
  const shapes = [
    <circle r={r} />,
    <path d={`M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} Z`} />,
    <rect x="0" y={-(CART_R + 22)} width={r} height={(CART_R + 22) * 2} rx="20" />,
  ];
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${angle}) scale(${grow})`} fill="#ffdb00" stroke="#f0a800" strokeWidth={8 / grow} opacity={opacity}>
      {shapes[push.mode]}
    </g>
  );
}

function MiniMap({ players, light, me }) {
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute right-2 top-2 w-20 rounded border-2 border-ink bg-white/90 sm:w-40">
      <circle cx={light.x} cy={light.y} r={light.r} fill="#ffdb00" opacity=".5" />
      {players.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="90" fill={p.id === me ? "#0058a3" : "#111"} />)}
    </svg>
  );
}

// Phone controls: hold the arrows (they fill the same key Set as the keyboard)
function TouchPad({ keys, push, dash, nextMode }) {
  const hold = (key) => ({
    onPointerDown: (e) => (e.preventDefault(), keys.current.add(key)),
    onPointerUp: () => keys.current.delete(key),
    onPointerLeave: () => keys.current.delete(key),
  });
  const pad = "grid h-14 w-14 touch-none place-items-center rounded-xl bg-ink text-xl text-page";
  return (
    <div className="flex items-center justify-between sm:hidden">
      <div className="grid grid-cols-3 gap-1">
        <span /><button className={pad} {...hold("w")}>▲</button><span />
        <button className={pad} {...hold("a")}>◀</button><button className={pad} {...hold("s")}>▼</button><button className={pad} {...hold("d")}>▶</button>
      </div>
      <div className="grid gap-2">
        <button className="btn-line min-h-9 text-sm" onClick={nextMode}>Mode</button>
        <div className="flex gap-2">
          <button className="btn-yellow h-16 w-16 !p-0" onClick={push}>Push</button>
          <button className="btn-blue h-16 w-16 !p-0" onClick={dash}>Dash</button>
        </div>
      </div>
    </div>
  );
}
