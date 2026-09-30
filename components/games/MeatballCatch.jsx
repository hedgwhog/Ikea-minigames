"use client";
// Everyone's bowl is on the same field. My bowl moves locally (smooth), the others
// come from the live data. Every browser builds the same meatballs from the seed.
import { useEffect, useMemo, useReducer, useRef } from "react";
import { useRoom } from "@/context/RoomContext";
import { useInterval } from "@/hooks/useInterval";
import { direction, useKeys } from "@/hooks/useKeys";
import { FIELD, makeBalls, scoreOf } from "@/lib/games/catch";
import { useTheme } from "@/context/ThemeContext";
import Furniture from "../Furniture";

const { W, H, BOWL, BALL } = FIELD;
const BOWL_Y = H - 110;
const pct = (n, of) => `${(n / of) * 100}%`;

export default function MeatballCatch() {
  const { me, room, now, sendLive } = useRoom();
  const { dark } = useTheme();
  const game = room.game;
  const live = game.live ?? {};
  const keys = useKeys();
  const field = useRef(null);
  const [, redraw] = useReducer((n) => n + 1, 0);
  const s = useRef({ x: W / 2, target: null, caught: new Set() });

  const balls = useMemo(() => makeBalls(game.seed), [game.seed]); // same balls for everyone
  // balls other players already caught (only recalculated when live data changes)
  const takenByOthers = useMemo(
    () => new Set(Object.entries(live).flatMap(([id, l]) => (id === me ? [] : l.caught ?? []))),
    [live, me],
  );
  const taken = useRef(takenByOthers);
  taken.current = takenByOthers;

  // game loop: 60 times a second
  useEffect(() => {
    let last = performance.now();
    let frame;
    const loop = (t) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const me = s.current;
      const dx = direction(keys).x;
      if (dx) (me.target = null), (me.x += dx * 800 * dt);
      else if (me.target != null) me.x += Math.sign(me.target - me.x) * Math.min(Math.abs(me.target - me.x), 1200 * dt);
      me.x = Math.max(BOWL / 2, Math.min(W - BOWL / 2, me.x));

      const time = (now() - game.startAt) / 1000;
      if (time > 0 && now() < game.endsAt) {
        for (const b of balls) {
          const y = (time - b.at) * b.speed;
          const inBowl = y > BOWL_Y - 10 && y < BOWL_Y + 20 && Math.abs(b.x - me.x) < BOWL / 2 + 6;
          if (inBowl && !taken.current.has(b.id)) me.caught.add(b.id);
        }
      }
      redraw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [balls, game.startAt, game.endsAt, keys, now]);

  useInterval(() => sendLive({ x: Math.round(s.current.x), caught: [...s.current.caught] }), 120);

  const time = (now() - game.startAt) / 1000;
  const others = game.playerIds.filter((id) => id !== me && live[id]);
  const scores = game.playerIds
    .map((id) => ({ id, score: scoreOf(balls, id === me ? [...s.current.caught] : live[id]?.caught) }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm font-bold">
        {scores.map(({ id, score }) => (
          <span key={id} className={`rounded-full px-3 py-1 ${id === me ? "bg-yellow text-[#111]" : "bg-page"}`}>
            {room.players[id]?.name} {score}
          </span>
        ))}
        <span className="ml-auto rounded-full bg-ink px-3 py-1 text-page">{Math.max(0, Math.ceil((game.endsAt - now()) / 1000))}s</span>
      </div>

      <div
        ref={field}
        onPointerMove={(e) => {
          const r = field.current.getBoundingClientRect();
          s.current.target = ((e.clientX - r.left) / r.width) * W;
        }}
        className={`relative w-full touch-none select-none overflow-hidden rounded-xl ${dark ? "bg-[#0b0e13]" : "bg-page"}`}
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        {balls.map((b) => {
          const y = (time - b.at) * b.speed;
          const gone = s.current.caught.has(b.id) || takenByOthers.has(b.id);
          if (y < -BALL || y > H || gone) return null;
          return (
            <div
              key={b.id}
              className="absolute aspect-square rounded-full"
              style={{
                left: pct(b.x - BALL / 2, W),
                top: pct(y - BALL / 2, H),
                width: pct(BALL, W),
                background: b.gold
                  ? "radial-gradient(circle at 35% 30%, #fff6c2, #ffcf2e 45%, #c98a00)"
                  : "radial-gradient(circle at 35% 30%, #b97a4a, #7a4524 60%, #5a3118)",
                animation: b.gold ? `glow ${dark ? 0.6 : 0.8}s ease-in-out infinite` : undefined,
              }}
            />
          );
        })}

        {[...others, me].map((id) => {
          const x = id === me ? s.current.x : live[id].x;
          return (
            <div
              key={id}
              className={`absolute flex flex-col items-center ${id === me ? "z-10" : "opacity-60 transition-[left] duration-150 ease-linear"}`}
              style={{ left: pct(x - BOWL / 2, W), top: pct(BOWL_Y - 30, H), width: pct(BOWL, W) }}
            >
              <Furniture id={room.players[id]?.character} className="h-[45%] w-[45%]" />
              <svg viewBox="0 0 140 48" className="-mt-1 w-full drop-shadow">
                <path d="M4 6 H136 C132 34 108 46 70 46 C32 46 8 34 4 6 Z" fill="#fff" stroke="#111" strokeWidth="4" />
                <path d="M16 16 H124" stroke="#0058a3" strokeWidth="5" />
              </svg>
              <span className="text-[clamp(8px,1vw,12px)] font-bold">{id === me ? "You" : room.players[id]?.name}</span>
            </div>
          );
        })}

        {time < 0 && (
          <p className="absolute inset-0 grid place-items-center text-6xl font-black text-blue">{Math.ceil(-time)}</p>
        )}
      </div>
      <p className="text-sm text-muted">Move with A / D, the arrow keys, your mouse or your finger.</p>
    </div>
  );
}
