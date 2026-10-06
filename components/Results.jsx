"use client";
import { useRoom } from "@/context/RoomContext";
import { GAMES, nameOf } from "@/lib/constants";
import Furniture from "./Furniture";

export default function Results() {
  const { me, room, send } = useRoom();
  const final = room.phase === "final";
  const winner = Object.keys(room.scores).sort((a, b) => room.scores[b] - room.scores[a])[0];
  const myReady = room.players[me].ready;
  const active = Object.values(room.players).filter((p) => !p.idle);
  const readyCount = active.filter((p) => p.ready).length;

  return (
    <div className="space-y-4">
      {final ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-blue p-6 text-center text-white">
          <Furniture id={room.players[winner]?.character} className="h-24 w-24" />
          <h1 className="text-3xl font-black">{nameOf(room, winner)} wins!</h1>
        </div>
      ) : (
        <h1 className="text-2xl font-black">Results: {GAMES[room.gameIndex].title}</h1>
      )}
      <ol className="space-y-2">
        {room.results.map(({ id, points }, i) => (
          <li key={id} className={`flex items-center gap-3 rounded-xl bg-page p-3 ${id === me ? "ring-2 ring-blue" : ""}`}>
            <span className="w-6 text-xl font-black">{i + 1}</span>
            <Furniture id={room.players[id]?.character} />
            <span className="flex-1 font-bold">{nameOf(room, id)}</span>
            <span className="tag">+{points}</span>
          </li>
        ))}
      </ol>
      {final ? (
      <button onClick={() => send({ type: "restart" })} className="btn-blue">Play again</button>
      ) : (
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => send({ type: "ready" })} className={myReady ? "btn-line" : "btn-blue"}>
          {myReady ? "Not ready" : room.gameIndex + 1 === GAMES.length ? "Ready to see the winner" : "Ready for the next game"}
        </button>
        <span className="font-bold text-muted">{readyCount} of {active.length} ready</span>
      </div>
    )}
    </div>
  );
}
