"use client";
import { useRoom } from "@/context/RoomContext";
import { useTimeLeft } from "@/hooks/useTimeLeft";
import { GRID, LIVES, timeFor } from "@/lib/games/sofa";
import Furniture from "../Furniture";
import ProductImage from "./ProductImage";

export default function SofaSays() {
  const { me, room, now, send } = useRoom();
  const game = room.game;
  const seconds = useTimeLeft(game.endsAt);
  const reveal = game.stage === "reveal";
  const ready = now() < game.startedAt;
  const target = game.buttons.find((b) => b.id === game.target);
  const myAnswer = game.answers[me];
  const canTap = game.alive.includes(me) && !reveal && !ready && !myAnswer;
  const byCell = Object.fromEntries(game.buttons.map((b) => [b.cell, b]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {game.playerIds.map((id) => (
          <span key={id} className={`flex items-center gap-1 rounded-full bg-page py-1 pl-1 pr-3 text-sm font-bold ${game.alive.includes(id) ? "" : "opacity-40"}`}>
            <Furniture id={room.players[id]?.character} className="h-6 w-6" />
            {room.players[id]?.name} {"♥".repeat(game.lives[id])}{"♡".repeat(LIVES - game.lives[id])}
          </span>
        ))}
      </div>

      <div className="rounded-xl bg-blue p-4 text-white">
        <p className="text-sm font-bold text-yellow">Round {game.round + 1}. The sofa says:</p>
        <p className="text-2xl font-black">{ready ? "Get ready…" : `Tap ${target.name} (${target.type})`}</p>
        <div className="mt-2 h-2 rounded-full bg-white/20">
          <div className="h-full rounded-full bg-yellow" style={{ width: reveal || ready ? "0%" : `${(seconds * 100000) / timeFor(game.round)}%` }} />
        </div>
      </div>

      <div className="mx-auto grid max-w-2xl grid-cols-4 gap-2" key={game.round}>
        {Array.from({ length: GRID }, (_, cell) => {
          const b = byCell[cell];
          if (!b) return <div key={cell} />;
          const isTarget = reveal && b.id === game.target;
          return (
            <button
              key={cell}
              disabled={!canTap}
              onClick={() => send({ type: "game", value: b.id })}
              className={`flex flex-col items-center rounded-xl border-2 bg-white p-1.5 text-[#111] transition enabled:hover:-translate-y-0.5 ${
                myAnswer === b.id ? "border-blue" : "border-transparent"
              } ${reveal && !isTarget ? "opacity-30" : ""} ${isTarget ? "ring-4 ring-yellow" : ""}`}
            >
              <ProductImage product={b} className="aspect-square w-full" />
              <span className="w-full truncate text-xs font-black sm:text-sm">{b.name}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center font-bold">
        {reveal && game.last.lost.includes(me) ? <span className="text-red">{myAnswer ? "Wrong one! -1 life" : "Too slow! -1 life"}</span>
          : reveal && game.alive.includes(me) ? <span className="text-green">Correct!</span>
          : !game.alive.includes(me) ? "You're out. Cheer for the others!" : myAnswer ? "Locked in…" : ""}
      </p>
    </div>
  );
}
