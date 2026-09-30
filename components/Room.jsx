"use client";
import { useMemo } from "react";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { joinRandomRoom, leaveRoom } from "@/app/actions";
import { useRoom } from "@/context/RoomContext";
import { GAMES } from "@/lib/constants";
import Furniture from "./Furniture";
import Lobby from "./Lobby";
import Results from "./Results";
import CartBumper from "./games/CartBumper";
import HideAndSeek from "./games/HideAndSeek";
import MeatballCatch from "./games/MeatballCatch";
import PriceGuess from "./games/PriceGuess";
import SofaSays from "./games/SofaSays";

const SCREENS = { catch: MeatballCatch, price: PriceGuess, sofa: SofaSays, bumper: CartBumper, hide: HideAndSeek };

export default function Room() {
  const { code, me, room, error, notice } = useRoom();
  const joined = room && me && room.players[me];

  if (!joined) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-10 text-center">
        <p className="text-xl font-black">{error ?? "Walking into the showroom…"}</p>
        {error && (
          <div className="flex flex-col items-center gap-3">
            <button className="btn-blue" onClick={() => location.reload()}>Join this room again</button>
            <RoomButtons code={code} me={me} />
          </div>
        )}
      </main>
    );
  }

  const Game = room.phase === "playing" && SCREENS[room.game.type];
  const info = GAMES[room.gameIndex];
  return (
    <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="tag">Room {code}</span>
          <RoomButtons code={code} me={me} />
        </div>
        {notice && <p className="rounded-full bg-ink px-4 py-2 text-center text-sm font-bold text-page">{notice}</p>}
        <section className="card min-w-0">
          {room.phase === "lobby" && <Lobby />}
          {Game && (
            <>
              <p className="text-sm font-bold text-muted">Game {room.gameIndex + 1} of {GAMES.length}</p>
              <h1 className="text-2xl font-black sm:text-3xl">{info.title}</h1>
              <p className="mb-4 text-muted">{info.howto}</p>
              <Game key={room.gameIndex} />
            </>
          )}
          {(room.phase === "results" || room.phase === "final") && <Results />}
        </section>
      </div>
      <Scoreboard />
    </main>
  );
}

function Scoreboard() {
  const { me, room } = useRoom();
  // useMemo: only sort again when players or scores change
  const board = useMemo(
    () => Object.values(room.players).sort((a, b) => room.scores[b.id] - room.scores[a.id]),
    [room.players, room.scores],
  );
  return (
    <aside className="card h-fit space-y-2">
      <h2 className="font-black">Points</h2>
      {board.map((p) => (
        <div key={p.id} className={`flex items-center gap-2 rounded-lg p-1.5 ${p.id === me ? "bg-yellow text-[#111]" : ""}`}>
          <Furniture id={p.character} className="h-8 w-8" />
          <span className="flex-1 font-bold">{p.name}</span>
          <span className="font-black">{room.scores[p.id]}</span>
        </div>
      ))}
    </aside>
  );
}

// "Join another room" and "Back to homepage" (both leave this room, so your furniture is free again)
function RoomButtons({ code, me }) {
  const [result, switchRoom] = useActionState(joinRandomRoom, null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={switchRoom}>
        <input type="hidden" name="exclude" value={code} />
        <input type="hidden" name="playerId" value={me ?? ""} />
        <Submit className="btn-yellow">Join another room</Submit>
      </form>
      <form action={leaveRoom}>
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="playerId" value={me ?? ""} />
        <Submit className="btn-line">Back to homepage</Submit>
      </form>
      {result?.error && <span className="text-sm font-bold text-red">{result.error}</span>}
    </div>
  );
}

// useFormStatus (React client API): knows if the form around it is being sent
function Submit({ className, children }) {
  const { pending } = useFormStatus();
  return <button className={`${className} min-h-9 px-4 text-sm`} disabled={pending}>{pending ? "…" : children}</button>;
}
