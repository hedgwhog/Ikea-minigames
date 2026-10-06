"use client";
import { startTransition, useOptimistic } from "react";
import { useRoom } from "@/context/RoomContext";
import { CHARACTERS, GAMES } from "@/lib/constants";
import Furniture from "./Furniture";

export default function Lobby() {
  const { me, room, send } = useRoom();
  const [mine, setMine] = useOptimistic(room.players[me].character);
  const owner = (id) => Object.values(room.players).find((p) => p.character === id)?.id;

  const pick = (id) =>
    startTransition(async () => {
      setMine(id);
      await send({ type: "pick", character: id });
    });

  const myReady = room.players[me].ready;
  const active = Object.values(room.players).filter((p) => !p.idle);
  const readyCount = active.filter((p) => p.ready).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Pick your furniture</h1>
        <p className="text-muted">Your furniture is your identity.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CHARACTERS.map((c) => {
          const isMine = mine === c.id;
          const taken = !isMine && owner(c.id) && owner(c.id) !== me;
          return (
            <button
              key={c.id}
              onClick={() => pick(c.id)}
              disabled={taken}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-page p-3 transition ${isMine ? "border-blue" : "border-transparent hover:border-line"} disabled:opacity-40`}
            >
              <Furniture id={c.id} className="h-20 w-20" />
              <span className="font-black">{c.name}</span>
              <span className="text-xs font-bold text-muted">{isMine ? "You" : taken ? "Taken" : "Free"}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => send({ type: "ready" })} className={myReady ? "btn-line" : "btn-blue"}>
          {myReady ? "Not ready" : "Ready"}
        </button>
        <span className="font-bold text-muted">{readyCount} of {active.length} ready</span>
      </div>


            {/* DEV ONLY: only visible with "npm run dev" */}
      {process.env.NODE_ENV !== "production" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-line p-3">
          <span className="text-sm font-bold text-muted">Test one game:</span>
          {GAMES.map((g) => (
            <button key={g.id} onClick={() => send({ type: "test", game: g.id })} className="btn-line min-h-8 px-3 text-sm">
              {g.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
