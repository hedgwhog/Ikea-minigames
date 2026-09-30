"use client";
import { useRoom } from "@/context/RoomContext";
import { GAMES, nameOf } from "@/lib/constants";
import Furniture from "./Furniture";

export default function Results() {
  const { me, room, send } = useRoom();
  const final = room.phase === "final";
  const winner = Object.keys(room.scores).sort((a, b) => room.scores[b] - room.scores[a])[0];

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
      <button onClick={() => send({ type: final ? "restart" : "next" })} className="btn-blue">
        {final ? "Play again" : room.gameIndex + 1 === GAMES.length ? "See the winner" : "Next game"}
      </button>
    </div>
  );
}
