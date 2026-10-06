// SERVER API (Route Handler)
//   GET  /api/rooms/ABCD -> how does the room look now? (browsers ask this every second)
//   POST /api/rooms/ABCD -> "I did something" { playerId, type, ... }
import { USES_LIVE } from "@/lib/games";
import { getExtras } from "@/lib/extras";
import { applyAction, dropIdle, isAbandoned, publicRoom, tickRoom } from "@/lib/room";
import { deleteRoom, getLive, getRoom, saveRoom, setLive, STORAGE_ERROR, storageReady } from "@/lib/store";

export const dynamic = "force-dynamic";
const json = (data, status = 200) => Response.json(data, { status });

async function handle(code, body) {
  if (!storageReady) return json({ error: STORAGE_ERROR }, 503);
    // A game can start from "ready", "leave" or someone going idle, so always have the products ready.
  // Loaded BEFORE the room, so nothing changes the room in between.
  const extras = await getExtras();

  const room = await getRoom(code.toUpperCase());
  if (!room) return json({ error: "This room doesn't exist anymore." }, 404);
  const now = Date.now();
  const liveKey = `${room.code}:${room.gameIndex}`;

  // Live data (positions, catches) goes in its own place, so it never overwrites the room
  if (body?.type === "live") await setLive(liveKey, body.playerId, { ...body.live, at: now });
  const live = room.phase === "playing" && USES_LIVE.has(room.game.type) ? await getLive(liveKey) : {};

  const idleRemoved = dropIdle(room, now, extras);
  let changed = tickRoom(room, now, live) || idleRemoved;
  if (isAbandoned(room, now)) {
    await deleteRoom(room.code);
    return json({ error: "This room closed because everyone left." }, 404);
  }
  if (body && body.type !== "live") {
    if (room.players[body.playerId]) room.players[body.playerId].seenAt = now; // a real action = still here
    const error = applyAction(room, body.playerId, body, now, extras);
    if (error) return json({ error }, 400);
    tickRoom(room, now, live);
    changed = true;
  }
  if (changed) await saveRoom(room);
  return json(publicRoom(room, now, live));
}

export async function GET(request, { params }) {
  const { code } = await params;
  return handle(code, null);
}

export async function POST(request, { params }) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  return body?.playerId ? handle(code, body) : json({ error: "Bad request" }, 400);
}
