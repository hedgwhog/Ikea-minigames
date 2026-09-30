"use client";
// 3 x 3 room. Hide, then watch the seeker walk to ONE spot.
// Dark mode: the room is dark, you only see what your flashlight (pointer) shines on.
import { useState } from "react";
import { useRoom } from "@/context/RoomContext";
import { useTheme } from "@/context/ThemeContext";
import { useTimeLeft } from "@/hooks/useTimeLeft";
import { nameOf, SPOTS } from "@/lib/constants";
import Furniture from "../Furniture";

// centre of a spot on the board, in percent
const spotCenter = (id) => {
  const i = SPOTS.findIndex((s) => s.id === id);
  return { x: (i % 3) * 33.3 + 16.7, y: Math.floor(i / 3) * 33.3 + 16.7 };
};

export default function HideAndSeek() {
  const { me, room, send } = useRoom();
  const { dark } = useTheme();
  const game = room.game;
  const seconds = useTimeLeft(game.endsAt);
  const [light, setLight] = useState({ x: 50, y: 50 }); // flashlight position in percent
  const [myPick, setMyPick] = useState({ round: -1, spot: null }); // where I hid this round
  const reveal = game.stage === "reveal";
  const closed = game.closed; // spots the seeker already checked
  const alive = game.alive.includes(me);
  const hidden = game.hidden.includes(me);
  const checked = reveal ? game.last.checked : null;
  const seeker = checked ? spotCenter(checked) : { x: 50, y: 108 }; // waits at the door

  let message = `Round ${game.round + 1}: pick an open spot. ${Math.ceil(seconds)}s`;
  if (!alive && !reveal) message = "You were caught. Watch the others.";
  else if (hidden && !reveal) message = `Hiding… ${game.hidden.length} of ${game.alive.length} hidden`;
  else if (reveal) {
    const caught = game.last.caught.map((id) => nameOf(room, id));
    message = caught.length ? `Found: ${caught.join(", ")}` : "Nobody was found!";
  }

  return (
    <div className="space-y-3">
      <p className="text-center font-bold">{message}</p>
      <div
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setLight({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        className="relative mx-auto mb-10 grid max-w-xl touch-none grid-cols-3 gap-2 rounded-2xl bg-[#e7d5b5] p-2"
      >
        {SPOTS.map((spot) => {
          const isUsed = closed.includes(spot.id) && checked !== spot.id; // the spot checked right now stays visible
          const mine = reveal ? game.last.spots[me] === spot.id : myPick.round === game.round && myPick.spot === spot.id;
          const here = reveal ? Object.keys(game.last.spots).filter((id) => game.last.spots[id] === spot.id) : [];
          return (
            <button
              key={spot.id}
              disabled={!alive || hidden || reveal || isUsed}
              onClick={() => (setMyPick({ round: game.round, spot: spot.id }), send({ type: "game", value: spot.id }))}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl bg-white p-2 text-[#111] transition enabled:hover:scale-105 ${
                isUsed && !mine ? "opacity-40 grayscale" : ""
              } ${checked === spot.id ? "ring-4 ring-red" : ""} ${mine ? "outline-4 outline-blue" : ""}`}
            >
              <img src={`/spots/${spot.id}.png`} alt="" className="h-3/5 w-3/5 object-contain" />
              <span className="text-xs font-bold sm:text-sm">{spot.label}</span>
              {isUsed && <span className="text-[10px] font-bold">already checked</span>}
              {here.length > 0 && (
                <span className="absolute right-1 top-1 flex">
                  {here.map((id) => <Furniture key={id} id={room.players[id]?.character} className="h-6 w-6" />)}
                </span>
              )}
            </button>
          );
        })}

        {/* the seeker walks to the checked spot */}
        <Seeker
          className="pointer-events-none absolute z-10 w-[16%] -translate-x-1/2 -translate-y-1/2 transition-all duration-[1500ms] ease-in-out"
          style={{ left: `${seeker.x}%`, top: `${seeker.y}%` }}
        />

        {/* dark mode: only a flashlight circle is visible */}
        {dark && (
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background: reveal
                ? `radial-gradient(circle at ${seeker.x}% ${seeker.y}%, transparent 12%, #000d 22%)`
                : `radial-gradient(circle at ${light.x}% ${light.y}%, transparent 14%, #000e 24%)`,
            }}
          />
        )}
      </div>
      {dark && <p className="text-center text-sm text-muted">Lights are off. Move your mouse or finger to use your flashlight.</p>}
    </div>
  );
}

// The seeker: an IKEA co-worker in a yellow shirt with a flashlight
function Seeker(props) {
  return (
    <svg viewBox="0 0 100 120" aria-label="seeker" {...props}>
      <path d="M68 58 L98 44 L98 72 Z" fill="#fff59a" opacity=".8" />
      <rect x="62" y="54" width="12" height="8" rx="2" fill="#111" />
      <rect x="30" y="86" width="14" height="30" rx="5" fill="#0058a3" />
      <rect x="50" y="86" width="14" height="30" rx="5" fill="#0058a3" />
      <path d="M24 50 Q47 38 70 50 L66 92 L28 92 Z" fill="#ffdb00" stroke="#111" strokeWidth="3" />
      <path d="M66 56 L74 58" stroke="#111" strokeWidth="6" strokeLinecap="round" />
      <circle cx="47" cy="26" r="17" fill="#f2c9a0" stroke="#111" strokeWidth="3" />
      <path d="M30 22 Q47 2 64 22 Z" fill="#0058a3" />
      <circle cx="53" cy="27" r="2.5" fill="#111" />
      <circle cx="42" cy="27" r="2.5" fill="#111" />
      <rect x="36" y="62" width="22" height="10" rx="2" fill="#fff" />
    </svg>
  );
}
