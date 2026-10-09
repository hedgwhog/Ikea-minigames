// Server component: rendered on the server, no JavaScript needed for this part.
import { Suspense } from "react";
import Furniture from "@/components/Furniture";
import HomeButtons from "@/components/HomeButtons";
import HomeLamp from "@/components/HomeLamp";
import OpenRooms from "@/components/OpenRooms";
import { CHARACTERS, GAMES } from "@/lib/constants";
import { openRooms } from "@/lib/openRooms";

export default async function Home({ searchParams }) {
  const { error } = await searchParams;
  const rooms = openRooms(); // NOT awaited: <OpenRooms> waits for it inside <Suspense>

  return (
    <main className="relative mx-auto max-w-6xl space-y-10 px-4 py-10">
      <HomeLamp />
      <section className="space-y-5 pt-44 sm:pt-0">
        <h1 className="text-5xl font-black leading-none text-blue sm:text-7xl [[data-theme=dark]_&]:text-yellow">
          Seven games.
          <br />
          One tiny IKEA.
        </h1>
        <p className="max-w-lg text-lg text-muted">Pick a piece of furniture, invite your victims.</p>
        <p className="max-w-lg text-lg text-muted">Tip: click the lamp to close the store for the night.</p>
        {error === "no-room" && <p className="font-bold text-red">That room is closed.</p>}
        <HomeButtons />
        <Suspense fallback={<p className="text-sm text-muted">Counting rooms…</p>}>
          <OpenRooms roomsPromise={rooms} />
        </Suspense>
      </section>

      <section className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {CHARACTERS.map((c) => (
          <div key={c.id} className="card flex flex-col items-center gap-2 !p-3">
            <Furniture id={c.id} className="h-20 w-20" />
            <span className="font-black">{c.name}</span>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {GAMES.map((g, i) => (
          <div key={g.id} className="card !p-4">
            <span className="tag text-sm">{i + 1}</span>
            <h2 className="mt-2 font-black">{g.title}</h2>
            <p className="text-sm text-muted">{g.howto}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
