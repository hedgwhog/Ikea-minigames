// The list of rooms, cleaned up: idle players are removed, empty rooms deleted.
// Used by the homepage and the "create / join room" buttons, so dead rooms disappear
// even when nobody has them open anymore.
import { dropIdle, isAbandoned } from "./room.js";
import { deleteRoom, listRooms, saveRoom } from "./store.js";

export async function openRooms() {
  const now = Date.now();
  const open = [];
  for (const room of await listRooms()) {
    const changed = dropIdle(room, now);
    if (isAbandoned(room, now)) await deleteRoom(room.code);
    else (open.push(room), changed && (await saveRoom(room)));
  }
  return open;
}
