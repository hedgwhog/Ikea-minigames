"use client";
import { useRoom } from "@/context/RoomContext";
import { GAMES, nameOf } from "@/lib/constants";
import Furniture from "./Furniture";

export default function Results() {
  const { me, room, send } = useRoom();
  const final = room.phase === "final";
  // Everyone with the highest total wins (a tie = shared win)
  const best = Math.max(...Object.keys(room.players).map((id) => room.scores[id] ?? 0));
  const winners = Object.keys(room.players).filter((id) => (room.scores[id] ?? 0) === best);
  // Place in this game: 1 + players with more points. Same points = same place.
  const placeOf = (points) => 1 + room.results.filter((r) => r.points > points).length;
  const myReady = room.players[me].ready;
  const active = Object.values(room.players).filter((p) => !p.idle);
  const readyCount = active.filter((p) => p.ready).length;

  return (
    <div className="space-y-4">
      {final ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-blue p-6 text-center text-white">
          <div className="flex gap-2">
            {winners.map((id) => <Furniture key={id} id={room.players[id]?.character} className="h-24 w-24" />)}
          </div>
          <h1 className="text-3xl font-black">
            {winners.map((id) => nameOf(room, id)).join(" & ")} {winners.length > 1 ? "win together!" : "wins!"}
          </h1>
          <p className="text-white/80">{best} points</p>
        </div>
      ) : (
        <h1 className="text-2xl font-black">Results: {GAMES[room.gameIndex].title}</h1>
      )}
      <ol className="space-y-2">
        {room.results.map(({ id, points }) => (
          <li key={id} className={`flex items-center gap-3 rounded-xl bg-page p-3 ${id === me ? "ring-2 ring-blue" : ""}`}>
            <span className="w-6 text-xl font-black">{placeOf(points)}</span>
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
