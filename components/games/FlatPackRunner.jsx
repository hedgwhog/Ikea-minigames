"use client";
// Flat-Pack Runner: low budget Subway Surfers in the IKEA self-serve warehouse.
// Everything runs in MY browser. The track comes from a seed, so everyone gets the same obstacles.
// I send how far I got (live data). The others only show up in the scores at the top.
import { useEffect, useMemo, useReducer, useRef } from "react";
import { useRoom } from "@/context/RoomContext";
import { useInterval } from "@/hooks/useInterval";
import { useKeys } from "@/hooks/useKeys";
import { characterImage, nameOf } from "@/lib/constants";
import { makeTrack } from "@/lib/games/runner";

// --- the "3D" view: things further away (bigger z) are smaller and closer to the horizon ---
const VW = 600, VH = 420;
const HORIZON = 110, GROUND = 380, CENTER = 300;
const LANE_W = 150; // lane width (px) right in front of the camera
const PX = 85; // pixels per metre, right in front of the camera
const CAMERA = 6; // how far the camera is behind the player (metres)
const VIEW = 75; // how far we can see (metres)
const scaleAt = (z) => CAMERA / (CAMERA + z);
const groundY = (z) => HORIZON + (GROUND - HORIZON) * scaleAt(z);
const laneX = (lane, z) => CENTER + (lane - 1) * LANE_W * scaleAt(z);
// The hall around the aisle: walls left and right (in "lanes" from the middle) and the ceiling height
const WALL_L = -2.4, WALL_R = 4.4, HALL_H = 7;
// A flat piece of floor, wall or ceiling from lane a to lane b, at heights ha / hb, from near to far
const quad = (a, b, ha, hb) => {
  const p = (lane, z, h) => `${laneX(lane, z)},${groundY(z) - h * PX * scaleAt(z)}`;
  return `${p(a, -2, ha)} ${p(a, 300, ha)} ${p(b, 300, hb)} ${p(b, -2, hb)}`;
};

// --- running ---
const speedAt = (seconds) => Math.min(38, 11 + seconds * 0.35); // metres per second, faster and faster
const JUMP = 6.4, GRAVITY = 19; // jump peak is about 1.1 m
const CROUCH_MS = 750;
const HEIGHT = { box: 0.6, beamLow: 1.0, beamHigh: 1.35, pallet: 2.2 }; // metres

export default function FlatPackRunner() {
  const { me, room, now, sendLive } = useRoom();
  const game = room.game;
  const live = game.live ?? {};
  const [, redraw] = useReducer((n) => n + 1, 0);
  const track = useMemo(() => makeTrack(game.seed), [game.seed]); // same track for everyone
  const s = useRef({ dist: 0, lane: 1, x: 1, y: 0, vy: 0, crouchUntil: 0, dead: null, next: 0, speed: 0 });

  const act = (move) => {
    const c = s.current;
    const t = now();
    if (c.dead || t < game.startAt) return;
    if (move === "left") c.lane = Math.max(0, c.lane - 1);
    if (move === "right") c.lane = Math.min(2, c.lane + 1);
    if (move === "jump" && c.y === 0) (c.vy = JUMP), (c.crouchUntil = 0);
    if (move === "crouch") {
      c.crouchUntil = t + CROUCH_MS;
      if (c.y > 0) c.vy = -14; // in the air: drop down fast
    }
  };
  useKeys((key) => {
    if (key === "a" || key === "arrowleft") act("left");
    if (key === "d" || key === "arrowright") act("right");
    if (key === "w" || key === "arrowup" || key === " ") act("jump");
    if (key === "s" || key === "arrowdown") act("crouch");
  });

  // swipe on phones, like the real game
  const swipe = useRef(null);
  const onPointerDown = (e) => (swipe.current = { x: e.clientX, y: e.clientY });
  const onPointerUp = (e) => {
    if (!swipe.current) return;
    const dx = e.clientX - swipe.current.x, dy = e.clientY - swipe.current.y;
    swipe.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
    if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? "right" : "left");
    else act(dy < 0 ? "jump" : "crouch");
  };

  // game loop
  useEffect(() => {
    let last = performance.now();
    let frame;
    const loop = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      const c = s.current;
      const t = now();
      if (!c.dead && t >= game.startAt) {
        c.speed = speedAt((t - game.startAt) / 1000);
        c.dist += c.speed * dt;
        c.x += (c.lane - c.x) * Math.min(1, dt * 14); // slide smoothly to the new lane
        if (c.y > 0 || c.vy > 0) {
          c.vy -= GRAVITY * dt;
          c.y = Math.max(0, c.y + c.vy * dt);
          if (c.y === 0) c.vy = 0;
        }
        const crouching = t < c.crouchUntil && c.y === 0;

        // hit something? Only look at obstacles right around me.
        while (track[c.next] && track[c.next].z < c.dist - 1) c.next++;
        for (let i = c.next; track[i] && track[i].z < c.dist + 1; i++) {
          const o = track[i];
          if (Math.abs(o.z - c.dist) > 0.6 || Math.abs(c.x - o.lane) > 0.45) continue;
          const hit = o.kind === "pallet" || (o.kind === "box" && c.y < HEIGHT.box + 0.05) || (o.kind === "beam" && !crouching);
          if (hit) c.dead = o.kind;
        }
      }
      redraw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [game.startAt, track, now]);

  useInterval(() => {
    const c = s.current;
    sendLive({ d: Math.round(c.dist), x: +c.x.toFixed(2), y: +c.y.toFixed(2), c: now() < c.crouchUntil, dead: Boolean(c.dead) });
  }, 150);

  // ---------- drawing ----------
  const c = s.current;
  const t = now();
  const crouching = t < c.crouchUntil && c.y === 0;
  const offset = c.dist; // everything is drawn relative to me
  const visible = [];
  for (let i = Math.max(0, c.next - 2); track[i] && track[i].z < offset + VIEW; i++) {
    if (track[i].z > offset - 1) visible.push(track[i]);
  }
  const standings = game.playerIds
    .map((id) => ({ id, d: id === me ? Math.round(c.dist) : live[id]?.d ?? 0, dead: id === me ? !!c.dead : live[id]?.dead }))
    .sort((a, b) => b.d - a.d);

  return (
    <div className="space-y-3 select-none">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
        <span className="rounded-full bg-ink px-3 py-1 text-page">{Math.round(c.dist)} m</span>
        <span className="rounded-full bg-page px-3 py-1">{Math.round(c.speed * 3.6)} km/h</span>
        {standings.map((p) => (
          <span key={p.id} className={`rounded-full px-3 py-1 ${p.id === me ? "bg-yellow text-[#111]" : "bg-page"} ${p.dead ? "line-through opacity-60" : ""}`}>
            {nameOf(room, p.id)} {p.d} m
          </span>
        ))}
      </div>

      <div className="relative" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: "none" }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full rounded-xl border-4 border-ink bg-[#3a4049]">
          {/* the warehouse hall: concrete floor, metal walls, a ceiling with lights */}
          <polygon points={quad(WALL_L, WALL_R, 0, 0)} fill="#80878f" />
          <polygon points={quad(-0.6, 2.6, 0, 0)} fill="#9da4ad" />
          <polygon points={quad(WALL_L, WALL_L, 0, HALL_H)} fill="#5d6670" />
          <polygon points={quad(WALL_R, WALL_R, 0, HALL_H)} fill="#5d6670" />
          <polygon points={quad(WALL_L, WALL_R, HALL_H, HALL_H)} fill="#23272e" />
          {Array.from({ length: 30 }, (_, k) => k * 5 + 3 - (offset % 5)).map((z) =>
            [WALL_L, WALL_R].map((lane) => (
              <line key={`${z}${lane}`} x1={laneX(lane, z)} y1={groundY(z)} x2={laneX(lane, z)} y2={groundY(z) - HALL_H * PX * scaleAt(z)} stroke="#4c545d" strokeWidth={Math.max(1, 6 * scaleAt(z))} />
            )),
          )}
          {Array.from({ length: 12 }, (_, k) => k * 10 + 4 - (offset % 10)).map((z) => {
            const sc = scaleAt(z), y = groundY(z) - HALL_H * PX * sc;
            return <rect key={z} x={CENTER - LANE_W * 0.9 * sc} y={y} width={LANE_W * 1.8 * sc} height={8 * sc} fill="#fff6c8" opacity=".9" />;
          })}
          {/* the far wall with the self-serve sign */}
          <rect x={laneX(WALL_L, 300)} y={groundY(300) - HALL_H * PX * scaleAt(300)} width={laneX(WALL_R, 300) - laneX(WALL_L, 300)} height={HALL_H * PX * scaleAt(300)} fill="#4c545d" />
          <rect x={CENTER - 90} y="30" width="180" height="44" rx="6" fill="#0058a3" />
          <text x={CENTER} y="60" textAnchor="middle" fontSize="20" fontWeight="900" fill="#ffdb00">SELF-SERVE</text>
          {[0.5, 1.5].map((edge) => (
            <line key={edge} x1={laneX(edge, -2)} y1={groundY(-2)} x2={laneX(edge, 300)} y2={groundY(300)} stroke="#ffdb00" strokeWidth="3" />
          ))}

          {/* warehouse racks on both sides, moving past you = speed */}
          {Array.from({ length: 12 }, (_, k) => k * 8 + 4 - (offset % 8)).reverse().map((z) => // never behind the camera
            [-0.95, 2.95].map((side) => {
              const x = laneX(side, z), y = groundY(z), sc = scaleAt(z);
              return (
                <g key={`${z}${side}`}>
                  <rect x={x - 6 * sc} y={y - 3.2 * PX * sc} width={12 * sc} height={3.2 * PX * sc} fill="#0058a3" />
                  <rect x={side < 0 ? x - 70 * sc : x} y={y - 1.4 * PX * sc} width={70 * sc} height={9 * sc} fill="#f29c38" />
                  <rect x={side < 0 ? x - 70 * sc : x} y={y - 2.6 * PX * sc} width={70 * sc} height={9 * sc} fill="#f29c38" />
                  <rect x={side < 0 ? x - 60 * sc : x + 8 * sc} y={y - 2.6 * PX * sc - 40 * sc} width={50 * sc} height={40 * sc} fill="#c8a26b" />
                </g>
              );
            }),
          )}

          {/* obstacles, far ones first so near ones are drawn on top */}
          {[...visible].reverse().map((o, i) => <Obstacle key={`${o.z}${o.lane}${i}`} o={o} z={o.z - offset} />)}

          {/* me */}
          <Runner id={room.players[me]?.character} x={c.x} y={c.y} z={0} crouch={crouching} />
        </svg>

        {t < game.startAt && (
          <p className="absolute inset-0 grid place-items-center text-7xl font-black text-yellow">{Math.ceil((game.startAt - t) / 1000)}</p>
        )}
        {c.dead && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/60 p-4 text-center text-white">
            <div>
              <p className="text-3xl font-black text-yellow">
                {c.dead === "box" ? "Tripped over a box!" : c.dead === "beam" ? "Bonk! Hit a shelf." : "Crashed into a pallet!"}
              </p>
              <p className="text-xl font-bold">{Math.round(c.dist)} metres</p>
              <p className="text-sm">Waiting for the others…</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-muted">
        ← → / A D switch lane · ↑ / W / Space jump over boxes · ↓ / S duck under shelves · go around pallets. On a phone: swipe.
      </p>
    </div>
  );
}

// One obstacle at distance z in front of me
function Obstacle({ o, z }) {
  const sc = scaleAt(z), x = laneX(o.lane, z), y = groundY(z);
  const w = LANE_W * 0.82 * sc;
  if (o.kind === "box") {
    const h = HEIGHT.box * PX * sc;
    return (
      <g>
        <rect x={x - w / 2} y={y - h} width={w} height={h} fill="#c8a26b" stroke="#8a6a3c" strokeWidth={3 * sc} />
        <rect x={x - 6 * sc} y={y - h} width={12 * sc} height={h} fill="#0058a3" />
      </g>
    );
  }
  if (o.kind === "beam") {
    const top = y - HEIGHT.beamHigh * PX * sc, bottom = y - HEIGHT.beamLow * PX * sc;
    return (
      <g>
        <rect x={x - w / 2 + 4 * sc} y={y - 3.2 * PX * sc} width={6 * sc} height={top - (y - 3.2 * PX * sc)} fill="#555" />
        <rect x={x + w / 2 - 10 * sc} y={y - 3.2 * PX * sc} width={6 * sc} height={top - (y - 3.2 * PX * sc)} fill="#555" />
        <rect x={x - w / 2} y={top} width={w} height={bottom - top} fill="#f29c38" stroke="#111" strokeWidth={3 * sc} />
        <text x={x} y={(top + bottom) / 2 + 6 * sc} textAnchor="middle" fontSize={16 * sc} fontWeight="900" fill="#111">DUCK</text>
      </g>
    );
  }
  const h = HEIGHT.pallet * PX * sc;
  return (
    <g>
      <rect x={x - w / 2} y={y - 12 * sc} width={w} height={12 * sc} fill="#b58c5a" />
      <rect x={x - w / 2} y={y - h} width={w} height={h - 12 * sc} fill="#0058a3" stroke="#00407a" strokeWidth={3 * sc} />
      <rect x={x - w / 2} y={y - h * 0.55} width={w} height={8 * sc} fill="#ffdb00" />
    </g>
  );
}

// A runner: the furniture picture. Crouching = the picture gets squashed down.
function Runner({ id, x, y, z, crouch }) {
  const sc = scaleAt(z);
  const size = 1.3 * PX * sc;
  const px = laneX(x, z), ground = groundY(z);
  const lift = y * PX * sc;
  const h = crouch ? size * 0.5 : size;
  return (
    <g>
      <ellipse cx={px} cy={ground} rx={size * 0.35 * (1 - Math.min(0.5, y / 2))} ry={size * 0.08} fill="#000" opacity=".3" />
      <image href={characterImage(id)} x={px - size / 2} y={ground - lift - h} width={size} height={h} preserveAspectRatio="none" />
    </g>
  );
}
