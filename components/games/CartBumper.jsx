"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRoom } from "@/context/RoomContext";
import { useTheme } from "@/context/ThemeContext";
import { useInterval } from "@/hooks/useInterval";
import { useKeys } from "@/hooks/useKeys";
import { STORM_MAX } from "@/lib/games/bumper";
import { CART_R, MAP_H, MAP_W, moveWithWalls, WALLS, ZONES, zoneAt } from "@/lib/games/bumperMap";
import Furniture from "../Furniture";

// Driving
const TURN = 3.4; // radians per second
const GAS = 750, MAX = 430; // normal driving
const BOOST = 1900, MAX_BOOST = 1300; // hold Space
const BOOST_USE = 34, BOOST_REFILL = 14; // boost meter -> from 0 to 100
const BRAKE = 900, MAX_REVERSE = 220;
// Bumping
const BUMP_R = 20; // the front part of the cart, hitbox
const MIN_BUMP = 160; // slower than this = no bump
const KNOCK = 1.9; // more speed = more knockback
const MAX_KNOCK = 14000;
const STUN_MS = 900; // after being hit, amount of ms you are stunned
const COLORS = { furniture: "#c9ad84", table: "#d9c7a6", counter: "#0058a3", shelf: "#b58c5a", rack: "#0058a3" };

const unit = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

export default function CartBumper() {
  const { me, room, now, sendLive } = useRoom();
  const { dark } = useTheme();
  const game = room.game;
  const live = game.live ?? {};
  const alive = game.alive.includes(me);
  const [, redraw] = useReducer((n) => n + 1, 0);
  const keys = useKeys();

  const spawn = game.spawns[me] ?? { x: MAP_W / 2, y: MAP_H / 2 };
  const s = useRef({
    ...spawn, a: Math.atan2(MAP_H / 2 - spawn.y, MAP_W / 2 - spawn.x),
    vx: 0, vy: 0, spin: 0, boost: 100, boosting: false, storm: 0,
    stunUntil: 0, shakeUntil: 0, bumps: [], bumpN: 0, lastHit: {}, seen: {},
  });

  const others = useRef({});
  others.current = Object.fromEntries(game.alive.filter((id) => id !== me && live[id]).map((id) => [id, live[id]]));

  useEffect(() => {
    let last = performance.now();
    let frame;
    const loop = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      const c = s.current;
      const t = now();
      if (alive && t >= game.startAt) {
        const k = keys.current;
        const gas = k.has("w") || k.has("arrowup");
        const brake = k.has("s") || k.has("arrowdown");
        const steer = (k.has("d") || k.has("arrowright")) - (k.has("a") || k.has("arrowleft"));
        const stunned = t < c.stunUntil;
        c.boosting = k.has(" ") && c.boost > 0 && !stunned;

        const speedNow = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
        c.a += steer * TURN * dt * Math.min(1, Math.abs(speedNow) / 150 + 0.3) * (speedNow < -10 ? -1 : 1);
        c.a += c.spin * dt; 
        c.spin *= Math.pow(0.1, dt);

        const hx = Math.cos(c.a), hy = Math.sin(c.a);
        let forward = c.vx * hx + c.vy * hy;
        let side = -c.vx * hy + c.vy * hx;

        if (c.boosting) {
          forward += BOOST * dt;
          c.boost = Math.max(0, c.boost - BOOST_USE * dt);
        } else {
          c.boost = Math.min(100, c.boost + BOOST_REFILL * dt);
          if (gas && !stunned) forward += GAS * dt;
        }
        if (brake && !stunned) forward -= BRAKE * dt;
        const top = c.boosting ? MAX_BOOST : MAX;
        if (!stunned && forward > top) forward -= (forward - top) * Math.min(1, 2 * dt);
        if (!stunned) forward = Math.max(-MAX_REVERSE, forward);

        if (stunned) (forward *= Math.pow(0.12, dt)), (side *= Math.pow(0.12, dt));
        else if (c.boosting) side *= Math.pow(0.55, dt);
        else (side *= Math.pow(0.002, dt)), (forward *= Math.pow(gas || brake ? 0.8 : 0.25, dt));

        c.vx = forward * hx - side * hy;
        c.vy = forward * hy + side * hx;

        const wantX = c.vx * dt, wantY = c.vy * dt;
        const startX = c.x;
        moveWithWalls(c, wantX, 0);
        if (Math.abs(c.x - startX) < Math.abs(wantX) * 0.5) c.vx *= -0.45;
        const startY = c.y;
        moveWithWalls(c, 0, wantY);
        if (Math.abs(c.y - startY) < Math.abs(wantY) * 0.5) c.vy *= -0.45;

        const fwd = c.vx * hx + c.vy * hy;
        const front = { x: c.x + hx * CART_R * 1.2, y: c.y + hy * CART_R * 1.2 };
        for (const [id, o] of Object.entries(others.current)) {
          if (stunned || fwd < MIN_BUMP || t - (c.lastHit[id] ?? 0) < 600) continue; 
          if (Math.hypot(o.x - front.x, o.y - front.y) > CART_R + BUMP_R) continue;
          c.lastHit[id] = t;
          const force = Math.round(Math.min(MAX_KNOCK, fwd * (1 + fwd / 350) * KNOCK * (demo ? 1.5 : 1)));
          const away = unit(o.x - c.x, o.y - c.y);
          const dir = unit(hx * 0.6 + away.x * 0.4, hy * 0.6 + away.y * 0.4);
          c.bumps = [...c.bumps.filter((b) => t - b.at < 1000), { n: ++c.bumpN, target: id, dx: dir.x, dy: dir.y, force, demo, at: t }];
          c.vx *= 0.35;
          c.vy *= 0.35;
        }

        const zone = zoneAt(game.zones, game.startAt, t);
        const outside = Math.hypot(c.x - zone.x, c.y - zone.y) > zone.r;
        c.storm = outside ? c.storm + dt : Math.max(0, c.storm - dt * 0.5);
      }
      redraw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [alive, game.startAt, game.zones, keys, now]);

  useEffect(() => {
    const c = s.current;
    for (const [id, l] of Object.entries(live)) {
      if (id === me) continue;
      for (const b of l.bumps ?? []) {
        if (b.target !== me || b.n <= (c.seen[id] ?? 0)) continue;
        c.seen[id] = b.n;
        if (!alive || now() - b.at > 1500) continue;
        c.vx += b.dx * b.force;
        c.vy += b.dy * b.force;
        c.stunUntil = now() + STUN_MS * (b.demo ? 1.6 : 1);
        c.spin = (Math.random() - 0.5) * (b.demo ? 30 : 14);
        c.shakeUntil = now() + 400;
      }
    }
  }, [live, me, alive, now]);

  useInterval(() => {
    const c = s.current;
    sendLive({ x: Math.round(c.x), y: Math.round(c.y), a: +c.a.toFixed(2), b: c.boosting, storm: +c.storm.toFixed(2), bumps: c.bumps });
  }, 100);

  const view = useRef(null);
  const [vw, setVw] = useState(800);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setVw(e.contentRect.width));
    ro.observe(view.current);
    return () => ro.disconnect();
  }, []);
  const t = now();
  const c = s.current;
  const zone = zoneAt(game.zones, game.startAt, t);
  const scale = Math.min(0.7, Math.max(0.3, vw / 1500));
  const vh = Math.max(320, Math.min(620, vw * 0.7));
  const focus = alive ? c : zone;
  const camX = Math.max(0, Math.min(MAP_W * scale - vw, focus.x * scale - vw / 2));
  const camY = Math.max(0, Math.min(MAP_H * scale - vh, focus.y * scale - vh / 2));
  const shake = t < c.shakeUntil ? `${Math.random() * 12 - 6}px ${Math.random() * 12 - 6}px` : "0 0";

  const carts = game.playerIds.map((id) => ({ id, ...(id === me ? { x: c.x, y: c.y, a: c.a, b: c.boosting } : live[id] ?? { ...game.spawns[id], a: 0 }) }));
  const byId = Object.fromEntries(carts.map((p) => [p.id, p]));
  // "BUMP!" / "DEMOLISHED!" pop-ups, visible for everyone
  const hits = [...c.bumps, ...Object.entries(live).filter(([id]) => id !== me).flatMap(([, l]) => l.bumps ?? [])]
    .filter((b) => t - b.at < 800 && byId[b.target]);
  const walls = useMemo(
    () => WALLS.map((w, i) => <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} rx={w.kind ? 10 : 2} fill={COLORS[w.kind] ?? "#7d858c"} />),
    [],
  );
  const speed = Math.round(Math.hypot(c.vx, c.vy));

  return (
    <div className="space-y-3 select-none">
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
        <span className="rounded-full bg-ink px-3 py-1 text-page">{game.alive.length} still rolling</span>
        <span className="rounded-full bg-page px-3 py-1">
          {zone.next ? `Zone ${zone.shrinking ? "shrinking" : "closes in"} ${Math.ceil(zone.msLeft / 1000)}s` : "Final zone"}
        </span>
        {alive && <Meter label="Boost" value={c.boost} color="bg-yellow" />}
        {alive && c.storm > 0 && <Meter label="Storm!" value={(c.storm / STORM_MAX) * 100} color="bg-red" />}
        {!alive && <span className="rounded-full bg-red px-3 py-1 text-white">You're out!</span>}
      </div>

      <div ref={view} className="relative overflow-hidden rounded-xl border-4 border-ink bg-[#efefea]" style={{ height: vh, translate: shake }}>
        <div className="absolute left-0 top-0" style={{ width: MAP_W * scale, height: MAP_H * scale, transform: `translate(${-camX}px, ${-camY}px)` }}>
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full">
            <defs>
              <mask id="storm">
                <rect width={MAP_W} height={MAP_H} fill="white" />
                <circle cx={zone.x} cy={zone.y} r={zone.r} fill="black" />
              </mask>
            </defs>
            {ZONES.map((z) => (
              <g key={z.label}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={z.color} />
                <text x={z.x + z.w / 2} y={z.y + z.h - 36} textAnchor="middle" fontSize="44" fontWeight="900" fill="#0058a3" opacity=".35">{z.label}</text>
              </g>
            ))}
            {walls}
            <rect width={MAP_W} height={MAP_H} fill={dark ? "#1a0b2e" : "#5b2a86"} opacity={dark ? 0.85 : 0.55} mask="url(#storm)" />
            <circle cx={zone.x} cy={zone.y} r={zone.r} fill="none" stroke="#b07cff" strokeWidth="12" />
            {zone.next && <circle cx={zone.next.x} cy={zone.next.y} r={zone.next.r} fill="none" stroke="#fff" strokeWidth="8" strokeDasharray="30 20" />}
          </svg>

          {carts.map((p) => (
            <Cart key={p.id} p={p} scale={scale} mine={p.id === me} out={!game.alive.includes(p.id)}
              character={room.players[p.id]?.character} name={p.id === me ? "You" : room.players[p.id]?.name} />
          ))}

          {hits.map((b) => (
            <span key={`${b.target}${b.at}`} className={`pointer-events-none absolute z-20 -translate-x-1/2 font-black ${b.demo ? "text-2xl text-red" : "text-lg text-ink"}`}
              style={{ left: byId[b.target].x * scale, top: byId[b.target].y * scale - 50 - ((t - b.at) / 800) * 30, opacity: 1 - (t - b.at) / 800 }}>
              {b.demo ? "DEMOLISHED!" : "BUMP!"}
            </span>
          ))}
        </div>

        <MiniMap carts={carts} zone={zone} me={me} />
        {t < game.startAt && <p className="absolute inset-0 grid place-items-center text-7xl font-black text-blue">{Math.ceil((game.startAt - t) / 1000)}</p>}
      </div>

      <p className="hidden text-sm text-muted sm:block">W / ↑ drive · S / ↓ brake · A D / ← → steer · hold Space to BOOST (slippery!) · ram others with your front bumper</p>
      <TouchPad keys={keys} />
    </div>
  );
}

function Cart({ p, scale, mine, out, character, name }) {
  const size = Math.max(24, CART_R * 2.6 * scale); 
  return (
    <div className={`absolute ${mine ? "z-10" : "transition-[left,top] duration-100 ease-linear"} ${out ? "opacity-30 grayscale" : ""}`}
      style={{ left: p.x * scale, top: p.y * scale, width: size, height: size, translate: "-50% -50%" }}>
      <svg viewBox="0 0 80 56" className="absolute inset-0 h-full w-full overflow-visible" style={{ rotate: `${p.a ?? 0}rad` }}>
        {p.b && <ellipse cx="-10" cy="28" rx="20" ry="11" fill="#ffdb00" opacity=".85" className="animate-pulse" />}
        <rect x="12" y="0" width="12" height="5" rx="2" fill="#111" />
        <rect x="56" y="0" width="12" height="5" rx="2" fill="#111" />
        <rect x="12" y="51" width="12" height="5" rx="2" fill="#111" />
        <rect x="56" y="51" width="12" height="5" rx="2" fill="#111" />
        <rect x="2" y="10" width="6" height="36" rx="3" fill="#cc0008" />
        <rect x="8" y="4" width="62" height="48" rx="6" fill="#dde1e5" stroke="#5f676e" strokeWidth="3" />
        <path d="M20 4V52 M32 4V52 M44 4V52 M56 4V52 M8 20H70 M8 36H70" stroke="#a7afb7" strokeWidth="2" />
        <rect x="70" y="6" width="9" height="44" rx="3" fill={mine ? "#ffdb00" : "#0058a3"} />
        <path d="M86 14 L104 28 L86 42 Z" fill={mine ? "#ffdb00" : "#0058a3"} />
      </svg>
      <Furniture id={character} className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2" />
      <span className={`absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded px-1 text-[10px] font-bold ${mine ? "bg-yellow text-[#111]" : "bg-white text-[#111]"}`}>{name}</span>
    </div>
  );
}

function Meter({ label, value, color }) {
  return (
    <span className="flex items-center gap-2 rounded-full bg-page px-3 py-1">
      {label}
      <span className="h-2 w-16 overflow-hidden rounded-full bg-line">
        <span className={`block h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </span>
    </span>
  );
}

function MiniMap({ carts, zone, me }) {
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute right-2 top-2 w-20 rounded border-2 border-ink bg-white/90 sm:w-40">
      <circle cx={zone.x} cy={zone.y} r={zone.r} fill="#b07cff" opacity=".35" />
      {zone.next && <circle cx={zone.next.x} cy={zone.next.y} r={zone.next.r} fill="none" stroke="#111" strokeWidth="30" />}
      {carts.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="90" fill={p.id === me ? "#0058a3" : "#111"} />)}
    </svg>
  );
}

function TouchPad({ keys }) {
  const hold = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      keys.current.add(key);
    },
    onPointerUp: () => keys.current.delete(key),
    onPointerCancel: () => keys.current.delete(key),
    onLostPointerCapture: () => keys.current.delete(key),
    onContextMenu: (e) => e.preventDefault(),
  });
  const btn = "grid touch-none select-none place-items-center rounded-2xl font-black [-webkit-touch-callout:none] [-webkit-user-select:none] active:scale-95";
  return (
    <div className="flex select-none items-end justify-between gap-3 sm:hidden [-webkit-touch-callout:none]">
      <div className="flex gap-2">
        <button className={`${btn} h-16 w-14 bg-ink text-2xl text-page`} {...hold("a")}>◀</button>
        <button className={`${btn} h-16 w-14 bg-ink text-2xl text-page`} {...hold("d")}>▶</button>
      </div>
      <div className="flex gap-2">
        <button className={`${btn} h-16 w-12 bg-line text-xs`} {...hold("s")}>Brake</button>
        <button className={`${btn} h-16 w-12 bg-blue text-xs text-white`} {...hold("w")}>Gas</button>
        <button className={`${btn} h-20 w-16 bg-yellow text-xs text-[#111]`} {...hold(" ")}>BOOST</button>
      </div>
    </div>
  );
}