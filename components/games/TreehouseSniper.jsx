"use client";
// Treehouse Sniper, seen through your own eyes.
//  - Sniper: looks from the treehouse down the hall, through a SCOPE (zoomed circle around the mouse).
//  - Runners: a camera behind their own furniture, looking at the treehouse.
// The game itself is still a flat map (lib/games/sniperMap.js). We only DRAW it in perspective:
// things further away are smaller and closer to the horizon. Not real 3D, just one division.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRoom } from "@/context/RoomContext";
import { useInterval } from "@/hooks/useInterval";
import { direction, useKeys } from "@/hooks/useKeys";
import { characterImage, nameOf } from "@/lib/constants";
import { SHOT_COOLDOWN } from "@/lib/games/sniper";
import { EYE, FINISH_Y, MAP_H, MAP_W, moveRunner, OBSTACLES, shadowOf, shoot, TREE } from "@/lib/games/sniperMap";

const SPEED = 250; // runner speed (cm per second)
const VW = 900, VH = 560; // size of the view
const F = 450; // "lens": bigger = more zoomed in
const NEAR = 25; // don't draw things closer than this to the camera
const ZOOM = 5; // sniper scope zoom (far away runners are small, like with a real scope)
const SCOPE_R = 140;
const WALL_H = 450;
const COLORS = {
  ballpit: "#0058a3", house: "#ffdb00", tunnel: "#cc0008", slide: "#3e8e5e",
  toybox: "#0058a3", tent: "#ffdb00", foam: "#f29c38", kitchen: "#f4f4f4",
};

// ---------- the camera ----------
// A camera looks along the hall: towards the tree (look = -1) or away from it (look = 1),
// tilted down by `pitch` (radians). cy = where the middle of the view is on screen.
function makeCam({ x, y, h, look, pitch, cy }) {
  const c = Math.cos(pitch), s = Math.sin(pitch);
  return { x, y, h, look, cy, fwd: { y: look * c, h: -s }, down: { y: -look * s, h: -c } };
}
const sniperCam = makeCam({ x: EYE.x, y: EYE.y, h: EYE.h, look: 1, pitch: 0.3, cy: 196 }); // high up, looking down the hall
const runnerCam = (p) => makeCam({ x: p.x, y: p.y + 380, h: 170, look: -1, pitch: 0, cy: 300 }); // behind my furniture

// map position (x, y) at height h -> screen position. z = how far in front of the camera.
function project(cam, x, y, h = 0) {
  const dy = y - cam.y, dh = h - cam.h;
  const z = dy * cam.fwd.y + dh * cam.fwd.h;
  const right = (x - cam.x) * -cam.look;
  const down = dy * cam.down.y + dh * cam.down.h;
  return { z, x: VW / 2 + (right * F) / z, y: cam.cy + (down * F) / z };
}
// The other way round: a point on the sniper's screen -> the direction a bullet flies (3D, length 1)
function screenToDirection(cam, sx, sy) {
  const u = (sx - VW / 2) / F, v = (sy - cam.cy) / F;
  const d = { x: -cam.look * u, y: cam.fwd.y + cam.down.y * v, h: cam.fwd.h + cam.down.h * v };
  const len = Math.hypot(d.x, d.y, d.h);
  return { x: d.x / len, y: d.y / len, h: d.h / len };
}
const pts = (list) => list.map((p) => `${p.x},${p.y}`).join(" ");

// A y-range clipped to what's in front of the camera
function inFront(cam, y1, y2) {
  const limit = cam.y + NEAR * cam.look;
  const [a, b] = cam.look > 0 ? [Math.max(y1, limit), y2] : [y1, Math.min(y2, limit)];
  return a < b ? [a, b] : null;
}

export default function TreehouseSniper() {
  const { me, room, now, send, sendLive } = useRoom();
  const game = room.game;
  const live = game.live ?? {};
  const [, redraw] = useReducer((n) => n + 1, 0);
  const keys = useKeys();
  const amSniper = game.sniper === me;
  const isRunner = game.runners.includes(me);
  const out = game.dead.includes(me);
  const done = game.finished.includes(me);

  // other runners, smoothed (predict + glide, like Cart Bumper)
  const shown = useRef({});
  const liveRef = useRef(live);
  liveRef.current = live;

  // my runner. Everything resets when a new round starts.
  const s = useRef({ round: -1, x: 0, y: 0, vx: 0, vy: 0, sentFinish: false });
  if (s.current.round !== game.round) {
    s.current = { round: game.round, ...(game.spawns?.[me] ?? { x: MAP_W / 2, y: MAP_H - 100 }), vx: 0, vy: 0, sentFinish: false };
    shown.current = {};
  }
  const [aim, setAim] = useState({ x: VW / 2, y: VH / 2 });
  const [myShots, setMyShots] = useState([]);
  const lastShot = useRef(0);

  useEffect(() => {
    let last = performance.now();
    let frame;
    const loop = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      const t = now();
      for (const [id, l] of Object.entries(liveRef.current)) {
        if (id === me || l.round !== game.round) continue;
        const age = Math.min(0.3, Math.max(0, (t - l.at) / 1000));
        const target = { x: l.x + (l.vx ?? 0) * age, y: l.y + (l.vy ?? 0) * age };
        const d = (shown.current[id] ??= { ...target });
        const k = Math.min(1, dt * 12);
        d.x += (target.x - d.x) * k;
        d.y += (target.y - d.y) * k;
      }
      const c = s.current;
      if (isRunner && !out && !done && game.stage === "run" && t >= game.startAt) {
        const dir = direction(keys); // W = towards the tree (up the map), A/D = left/right
        c.vx = dir.x * SPEED;
        c.vy = dir.y * SPEED;
        moveRunner(c, c.vx * dt, c.vy * dt);
        if (c.y < FINISH_Y && !c.sentFinish) {
          c.sentFinish = true;
          send({ type: "game", kind: "finish" });
        }
      } else (c.vx = 0), (c.vy = 0);
      redraw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [isRunner, out, done, game.stage, game.startAt, game.round, keys, me, now, send]);

  useInterval(() => {
    const c = s.current;
    sendLive(isRunner ? { round: game.round, x: Math.round(c.x), y: Math.round(c.y), vx: Math.round(c.vx), vy: Math.round(c.vy) } : { round: game.round });
  }, 100);

  // ---------- shooting (only the sniper) ----------
  const svg = useRef(null);
  const toView = (e) => {
    const r = svg.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VW, y: ((e.clientY - r.top) / r.height) * VH };
  };
  const positions = (id) => (id === me ? s.current : shown.current[id] ?? game.spawns?.[id]);
  function fire(point) {
    const t = now();
    if (!amSniper || game.stage !== "run" || t < game.startAt || t - lastShot.current < SHOT_COOLDOWN) return;
    lastShot.current = t;
    // A real 3D line from the sniper's eye through the crosshair: the first thing it touches is hit
    const targets = game.runners
      .filter((id) => !game.dead.includes(id) && !game.finished.includes(id) && positions(id))
      .map((id) => ({ id, ...positions(id) }));
    const result = shoot(screenToDirection(sniperCam, point.x, point.y), targets);
    setMyShots((list) => [...list.slice(-3), { ...result, at: t }]);
    send({ type: "game", kind: "shoot", ...result });
  }

  // ---------- drawing ----------
  const t = now();
  const cam = amSniper || !isRunner ? sniperCam : runnerCam(s.current);
  const runners = game.runners.map((id) => ({ id, ...positions(id) })).filter((p) => p.x != null);
  const shots = [...game.shots, ...(amSniper ? myShots : [])].filter((sh) => t - sh.at < 400);
  const cooldown = Math.max(0, SHOT_COOLDOWN - (t - lastShot.current));
  const scene = (
    <Scene cam={cam} runners={runners} me={me} room={room} game={game} shots={shots} t={t} showTree={cam !== sniperCam} />
  );

  let banner = null;
  if (game.solo) banner = "Treehouse Sniper needs at least 2 players.";
  else if (game.stage === "reveal") banner = "Round over! Next sniper coming up…";
  else if (t < game.startAt) banner = amSniper ? "You're the sniper! Get ready…" : "Get ready to run…";

  let status = "";
  if (amSniper) status = cooldown > 0 ? "Reloading…" : "Move the scope, click to shoot";
  else if (out) status = "You got hit :(";
  else if (done) status = "You made it :)";

  return (
    <div className="space-y-3 select-none">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
        {!game.solo && <span className="rounded-full bg-ink px-3 py-1 text-page">Round {game.round + 1} of {game.order.length}</span>}
        {!game.solo && <span className="rounded-full bg-yellow px-3 py-1 text-[#111]">Sniper: {nameOf(room, game.sniper)}</span>}
        {game.stage === "run" && t >= game.startAt && <span className="rounded-full bg-page px-3 py-1">{Math.ceil((game.endsAt - t) / 1000)}s</span>}
        <span className="rounded-full bg-page px-3 py-1">{status}</span>
      </div>

      <div className="relative">
        <svg
          ref={svg}
          viewBox={`0 0 ${VW} ${VH}`}
          className={`w-full touch-none rounded-xl border-4 border-ink bg-[#f3ead7] ${amSniper ? "cursor-none" : ""}`}
          onPointerMove={(e) => amSniper && setAim(toView(e))}
          onPointerDown={(e) => {
            if (!amSniper) return;
            const p = toView(e);
            setAim(p);
            fire(p);
          }}
        >
          <defs>
            <clipPath id="scope">
              <circle cx={aim.x} cy={aim.y} r={SCOPE_R} />
            </clipPath>
          </defs>
          {scene}

          {amSniper && (
            <>
              {/* outside the scope it's dark; inside the scope it's zoomed in */}
              <rect width={VW} height={VH} fill="#000" opacity=".55" />
              <g clipPath="url(#scope)">
                <g transform={`translate(${aim.x} ${aim.y}) scale(${ZOOM}) translate(${-aim.x} ${-aim.y})`}>{scene}</g>
              </g>
              <circle cx={aim.x} cy={aim.y} r={SCOPE_R} fill="none" stroke="#111" strokeWidth="14" />
              <g stroke={cooldown > 0 ? "#888" : "#cc0008"} strokeWidth="2.5">
                <line x1={aim.x - SCOPE_R} y1={aim.y} x2={aim.x - 12} y2={aim.y} />
                <line x1={aim.x + 12} y1={aim.y} x2={aim.x + SCOPE_R} y2={aim.y} />
                <line x1={aim.x} y1={aim.y - SCOPE_R} x2={aim.x} y2={aim.y - 12} />
                <line x1={aim.x} y1={aim.y + 12} x2={aim.x} y2={aim.y + SCOPE_R} />
              </g>
              <circle cx={aim.x} cy={aim.y} r="3" fill={cooldown > 0 ? "#888" : "#cc0008"} />
              {cooldown > 0 && (
                <path
                  d={`M ${aim.x} ${aim.y - SCOPE_R - 14} A ${SCOPE_R + 14} ${SCOPE_R + 14} 0 ${cooldown / SHOT_COOLDOWN > 0.5 ? 1 : 0} 1 ${aim.x + (SCOPE_R + 14) * Math.sin((cooldown / SHOT_COOLDOWN) * 2 * Math.PI)} ${aim.y - (SCOPE_R + 14) * Math.cos((cooldown / SHOT_COOLDOWN) * 2 * Math.PI)}`}
                  fill="none" stroke="#ffdb00" strokeWidth="6"
                />
              )}
            </>
          )}
        </svg>

        {isRunner && <MiniMap runners={runners} me={me} game={game} />}
        {banner && <p className="absolute inset-0 grid place-items-center rounded-xl bg-white/60 p-4 text-center text-3xl font-black text-blue">{banner}</p>}
      </div>

      <p className="text-sm text-muted">
        Runners: W / ↑ runs towards the treehouse, A D / ← → sidestep. Stay behind the play things, the sniper can't shoot through them.
        Sniper: move the scope with the mouse and click to shoot (on a phone: tap).
      </p>
      {isRunner && !out && !done && <TouchPad keys={keys} />}

      <ul className="flex flex-wrap gap-2 text-sm font-bold">
        {[...game.playerIds].sort((a, b) => game.points[b] - game.points[a]).map((id) => (
          <li key={id} className={`rounded-full px-3 py-1 ${id === me ? "bg-yellow text-[#111]" : "bg-page"}`}>{nameOf(room, id)}: {game.points[id]}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------- everything in the hall, drawn from one camera ----------
function Scene({ cam, runners, me, room, game, shots, t, showTree }) {
  const far = cam.look > 0 ? MAP_H : 0; // the wall at the end of the hall we look at
  const items = []; // everything that can hide something else: drawn far -> near

  for (const o of OBSTACLES) {
    const near = cam.look > 0 ? o.y : o.y + o.h; // the side facing the camera
    const z = (near - cam.y) * cam.look;
    if ((o.y + (cam.look > 0 ? o.h : 0) - cam.y) * cam.look < NEAR) continue; // completely behind the camera
    items.push({ z, draw: <Box key={`o${o.x}${o.y}`} o={o} cam={cam} /> });
  }
  for (const p of runners) {
    const z = (p.y - cam.y) * cam.look;
    if (z < NEAR) continue;
    items.push({ z, draw: <Runner key={p.id} p={p} cam={cam} me={p.id === me} name={p.id === me ? "You" : nameOf(room, p.id)}
      character={room.players[p.id]?.character} dead={game.dead.includes(p.id)} finished={game.finished.includes(p.id)} /> });
  }
  if (showTree) items.push({ z: (TREE.y - cam.y) * cam.look, draw: <Treehouse key="tree" cam={cam} sniper={room.players[game.sniper]?.character} /> });
  items.sort((a, b) => b.z - a.z);

  const ground = (y) => [project(cam, 0, y), project(cam, MAP_W, y)];
  const [g1, g2] = ground(far);
  const nearY = cam.y + NEAR * cam.look;
  const [n1, n2] = ground(nearY);
  const finish = (FINISH_Y - cam.y) * cam.look > NEAR ? ground(FINISH_Y) : null;

  return (
    <g>
      {/* soft green floor (the ceiling is the background colour) */}
      <polygon points={pts([n1, n2, g2, g1])} fill="#c9e7b8" />
      {Array.from({ length: 20 }, (_, i) => i * 300 + 150).map((y) => {
        if ((y - cam.y) * cam.look < NEAR) return null;
        const [a, b] = ground(y);
        return <line key={y} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#b3d9a0" strokeWidth={Math.max(1, (F / a.z) * 4)} />;
      })}
      {finish && <line x1={finish[0].x} y1={finish[0].y} x2={finish[1].x} y2={finish[1].y} stroke="#111" strokeWidth={Math.max(2, (F / finish[0].z) * 12)} strokeDasharray="12 8" />}

      <Walls cam={cam} far={far} />
      {items.map((i) => i.draw)}

      {/* shots: a bright flash from the treehouse */}
      {shots.map((sh, i) => {
        const end = project(cam, sh.x, sh.y, sh.h ?? 100);
        const from = cam === sniperCam ? { x: VW / 2, y: VH } : project(cam, EYE.x, EYE.y, EYE.h);
        if (end.z < NEAR) return null;
        return <line key={`${i}-${sh.at}`} x1={from.x} y1={from.y} x2={end.x} y2={end.y} stroke="#fff59a" strokeWidth={8 * (1 - (t - sh.at) / 400)} />;
      })}

    </g>
  );
}

// The walls of the hall: Småland yellow with a blue stripe, a big sign on the far wall
function Walls({ cam, far }) {
  const wall = (x) => {
    const range = inFront(cam, 0, MAP_H);
    const [a, b] = range;
    return (
      <g key={x}>
        <polygon points={pts([project(cam, x, a), project(cam, x, b), project(cam, x, b, WALL_H), project(cam, x, a, WALL_H)])} fill="#ffdb00" stroke="#e0c000" />
        <polygon points={pts([project(cam, x, a, 90), project(cam, x, b, 90), project(cam, x, b, 140), project(cam, x, a, 140)])} fill="#0058a3" />
      </g>
    );
  };
  const c = [project(cam, 0, far), project(cam, MAP_W, far), project(cam, MAP_W, far, WALL_H), project(cam, 0, far, WALL_H)];
  const mid = project(cam, MAP_W / 2, far, 260);
  return (
    <g>
      <polygon points={pts(c)} fill="#0058a3" />
      <text x={mid.x} y={mid.y} textAnchor="middle" fontSize={(F / mid.z) * 110} fontWeight="900" fill="#ffdb00">SMÅLAND</text>
      {wall(0)}
      {wall(MAP_W)}
    </g>
  );
}

// A play thing as a box: the side facing us, the left/right side we can see, and the top
function Box({ o, cam }) {
  const H = o.h3;
  const color = COLORS[o.kind];
  const faces = [];
  const front = cam.look > 0 ? o.y : o.y + o.h;
  if ((front - cam.y) * cam.look >= NEAR) {
    faces.push([[o.x, front, 0], [o.x + o.w, front, 0], [o.x + o.w, front, H], [o.x, front, H]]);
  }
  const range = inFront(cam, o.y, o.y + o.h);
  if (range) {
    const [a, b] = range;
    if (cam.x < o.x) faces.push([[o.x, a, 0], [o.x, b, 0], [o.x, b, H], [o.x, a, H]]);
    if (cam.x > o.x + o.w) faces.push([[o.x + o.w, a, 0], [o.x + o.w, b, 0], [o.x + o.w, b, H], [o.x + o.w, a, H]]);
    if (cam.h > H) faces.push([[o.x, a, H], [o.x + o.w, a, H], [o.x + o.w, b, H], [o.x, b, H]]);
  }
  const label = (front - cam.y) * cam.look >= NEAR && o.label ? project(cam, o.x + o.w / 2, front, H / 2) : null;
  return (
    <g>
      {faces.map((f, i) => (
        <polygon key={i} points={pts(f.map(([x, y, h]) => project(cam, x, y, h)))} fill={color} stroke="#111" strokeOpacity=".35" strokeWidth="1.5"
          style={{ filter: i === 0 ? "none" : "brightness(.8)" }} />
      ))}
      {o.kind === "ballpit" && (front - cam.y) * cam.look >= NEAR &&
        Array.from({ length: 12 }, (_, j) => {
          const b = project(cam, o.x + 20 + (j % 6) * 44, front, H - 30 - Math.floor(j / 6) * 60);
          return <circle key={j} cx={b.x} cy={b.y} r={(F / b.z) * 16} fill={["#cc0008", "#ffdb00", "#fff"][j % 3]} />;
        })}
      {label && (
        <text x={label.x} y={label.y} textAnchor="middle" fontSize={(F / label.z) * 34} fontWeight="900" fill="#fff" stroke="#111" strokeWidth={(F / label.z) * 6} paintOrder="stroke">
          {o.label}
        </text>
      )}
    </g>
  );
}

// A runner: furniture with an IKEA KNORVA bucket hat and a hot dog on a stick
function Runner({ p, cam, me, name, character, dead, finished }) {
  const at = project(cam, p.x, p.y, 0);
  const sc = F / at.z;
  return (
    <g transform={`translate(${at.x} ${at.y}) scale(${sc})`} opacity={dead ? 0.45 : 1}>
      <ellipse cx="0" cy="0" rx="36" ry="10" fill={me ? "#ffdb00" : "#000"} opacity={me ? 0.9 : 0.2} />
      <g transform={dead ? "rotate(-80)" : undefined}>
        {/* hot dog on a stick */}
        <line x1="30" y1="-20" x2="52" y2="-110" stroke="#8a5a2b" strokeWidth="5" strokeLinecap="round" />
        <g transform="rotate(15 50 -118)">
          <rect x="39" y="-142" width="22" height="48" rx="11" fill="#e8b36a" />
          <rect x="44" y="-148" width="12" height="58" rx="6" fill="#b5442c" />
          <path d="M46 -132 q4 6 0 12 q-4 6 0 12" stroke="#ffdb00" strokeWidth="3" fill="none" />
        </g>
        {/* the furniture: exactly as wide (60) and, with the hat, as tall (160) as the hitbox */}
        <image href={characterImage(character)} x="-32" y="-122" width="64" height="120" preserveAspectRatio="none" />
        {/* IKEA KNORVA bucket hat, sitting right on top */}
        <path d="M-38 -120 Q0 -132 38 -120 L28 -128 Q25 -160 0 -160 Q-25 -160 -28 -128 Z" fill="#0058a3" stroke="#00407a" strokeWidth="2" />
        <rect x="-27" y="-136" width="54" height="8" fill="#ffdb00" />
      </g>
      <text y="22" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff" stroke="#111" strokeWidth="5" paintOrder="stroke">
        {dead ? "💥 " : finished ? "✅ " : ""}{name}
      </text>
    </g>
  );
}

// The treehouse at the end of the hall, with the sniper sitting in it (6.5 m up)
function Treehouse({ cam, sniper }) {
  const at = project(cam, TREE.x, TREE.y, 0);
  if (at.z < NEAR) return null;
  const sc = F / at.z;
  return (
    <g transform={`translate(${at.x} ${at.y}) scale(${sc})`}>
      <rect x="-40" y="-640" width="80" height="640" fill="#7a5230" />
      <circle cx="-190" cy="-700" r="140" fill="#3e8e5e" />
      <circle cx="190" cy="-700" r="140" fill="#3e8e5e" />
      <rect x="-180" y="-690" width="360" height="110" rx="14" fill="#b58c5a" stroke="#7a5230" strokeWidth="10" />
      <path d="M-200 -690 L0 -820 L200 -690 Z" fill="#cc0008" />
      {sniper && <image href={characterImage(sniper)} x="-55" y="-790" width="110" height="110" />}
    </g>
  );
}

// Small map from above, for runners: where am I, where is the cover (the shadows)
function MiniMap({ runners, me, game }) {
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute right-2 top-2 h-[92%] rounded border-2 border-ink bg-[#c9e7b8]">
      <rect width={MAP_W} height={FINISH_Y} fill="#f3ead7" />
      {OBSTACLES.map((o, i) => <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} fill={COLORS[o.kind]} stroke="#111" strokeWidth="10" />)}
      <circle cx={TREE.x} cy={TREE.y} r="90" fill="#cc0008" />
      {runners.map((p) => (
        <circle key={p.id} cx={p.x} cy={p.y} r="70" fill={p.id === me ? "#ffdb00" : game.dead.includes(p.id) ? "#999" : "#111"} stroke="#111" strokeWidth="8" />
      ))}
    </svg>
  );
}

// Phone controls (no text selecting while holding)
function TouchPad({ keys }) {
  const hold = (key) => ({
    onPointerDown: (e) => (e.preventDefault(), e.currentTarget.setPointerCapture(e.pointerId), keys.current.add(key)),
    onPointerUp: () => keys.current.delete(key),
    onPointerCancel: () => keys.current.delete(key),
    onLostPointerCapture: () => keys.current.delete(key),
    onContextMenu: (e) => e.preventDefault(),
  });
  const btn = "grid h-14 w-14 touch-none select-none place-items-center rounded-xl bg-ink text-xl text-page [-webkit-touch-callout:none]";
  return (
    <div className="grid w-fit grid-cols-3 gap-1 sm:hidden">
      <span /><button className={btn} {...hold("w")}>▲</button><span />
      <button className={btn} {...hold("a")}>◀</button><button className={btn} {...hold("s")}>▼</button><button className={btn} {...hold("d")}>▶</button>
    </div>
  );
}
