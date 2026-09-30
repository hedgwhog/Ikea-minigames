"use client";
// React `use(promise)`: the server started loading, this waits for it inside <Suspense>.
import { use } from "react";
import { MAX_ROOMS } from "@/lib/constants";

export default function OpenRooms({ roomsPromise }) {
  const rooms = use(roomsPromise);
  return <p className="text-sm text-muted">{rooms.length} of {MAX_ROOMS} rooms open</p>;
}
