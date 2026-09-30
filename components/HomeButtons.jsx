"use client";
import { useActionState } from "react";
import { createRoom, joinRandomRoom } from "@/app/actions";

// useActionState (React client API): runs a server action -> [result, action, isPending]
export default function HomeButtons() {
  const [created, create, creating] = useActionState(createRoom, null);
  const [joined, join, joining] = useActionState(joinRandomRoom, null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <form action={create}>
          <button className="btn-blue" disabled={creating}>{creating ? "Building…" : "Create room"}</button>
        </form>
        <form action={join}>
          <button className="btn-yellow" disabled={joining}>{joining ? "Looking…" : "Join a room"}</button>
        </form>
      </div>
      <p className="font-bold text-red">{created?.error ?? joined?.error}</p>
    </div>
  );
}
