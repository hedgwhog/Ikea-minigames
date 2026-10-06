import { dropIdle, isAbandoned } from "./room.js";
import { deleteRoom, listRooms, saveRoom } from "./store.js";
import { getExtras } from "./extras.js";

export async function openRooms() {
  const now = Date.now();
  const extras = await getExtras();
  const open = [];
  for (const room of await listRooms()) {
        const changed = dropIdle(room, now, extras);
    if (isAbandoned(room, now)) await deleteRoom(room.code);
    else (open.push(room), changed && (await saveRoom(room)));
  }
  return open;
}
