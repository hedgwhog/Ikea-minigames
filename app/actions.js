"use server";
// React SERVER FUNCTIONS ("server actions"): run on the server, used as <form action={...}>.
import { redirect } from "next/navigation";
import { MAX_ROOMS } from "@/lib/constants";
import { applyAction, isFull, makeCode, newRoom } from "@/lib/room";
import { openRooms } from "@/lib/openRooms";
import { deleteRoom, getRoom, saveRoom, STORAGE_ERROR, storageReady } from "@/lib/store";
import { getExtras } from "@/lib/extras";

export async function createRoom() {
  if (!storageReady) return { error: STORAGE_ERROR };
  const rooms = await openRooms();
  if (rooms.length >= MAX_ROOMS) return { error: `All ${MAX_ROOMS} rooms are in use. Join one instead.` };
  const code = makeCode();
  await saveRoom(newRoom(code));
  redirect(`/room/${code}`);
}

async function leave(code, playerId) {
  const room = code && (await getRoom(code));
  if (!room || !playerId) return;
  applyAction(room, playerId, { type: "leave" }, Date.now(), await getExtras());
  await (Object.keys(room.players).length ? saveRoom(room) : deleteRoom(code)); // empty room = gone
}

// Homepage: join any room. Inside a room: `exclude` = current room, and you leave it first.
export async function joinRandomRoom(_previous, formData) {
  if (!storageReady) return { error: STORAGE_ERROR };
  const exclude = formData.get("exclude");
  const rooms = (await openRooms()).filter((r) => r.code !== exclude && !isFull(r));
  if (!rooms.length) return { error: exclude ? "No other room has space." : "No rooms open yet. Create one!" };
  const target = rooms.find((r) => r.phase === "lobby") ?? rooms[0];
  await leave(exclude, formData.get("playerId"));
  redirect(`/room/${target.code}`);
}

export async function leaveRoom(formData) {
  await leave(formData.get("code"), formData.get("playerId"));
  redirect("/");
}
