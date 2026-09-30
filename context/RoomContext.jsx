"use client";
// Everything about the current room, shared with every component via useContext.
// It asks the server for news every second ("polling") and sends what the player does.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useInterval } from "@/hooks/useInterval";
import { getPlayerId } from "@/lib/identity";

const RoomContext = createContext(null);
export const useRoom = () => useContext(RoomContext);
const POLL = { price: 700, sofa: 400, hide: 500 }; // live games update through sendLive instead

export function RoomProvider({ code, children }) {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const offset = useRef(0); // server clock minus my clock
  const busy = useRef(false);
  const joined = useRef(false); // was I in the room before? (to notice being removed)
  const lastInput = useRef(Date.now()); // last mouse / keyboard / touch use

  const url = `/api/rooms/${code}`;
  const handle = useCallback(async (res, fatal) => {
    const data = await res.json();
    if (res.ok) {
      offset.current = data.serverNow - Date.now();
      setRoom(data.room);
      const inRoom = Boolean(data.room.players[getPlayerId()]);
      if (joined.current && !inRoom) setError("You were inactive for a minute, so you left the room.");
      else setError(null);
      joined.current = inRoom;
    } else if (fatal || res.status >= 404) setError(data.error);
    else setNotice(data.error), setTimeout(() => setNotice(null), 3000);
  }, []);

  const send = useCallback(
    (action) =>
      fetch(url, { method: "POST", body: JSON.stringify({ playerId: me, ...action }) })
        .then((res) => handle(res, action.type === "join"))
        .catch(() => {}),
    [url, me, handle],
  );

  // Positions etc. Skipped when the previous one is still on its way (no traffic jam).
  const sendLive = useCallback(
    async (live) => {
      if (busy.current) return;
      busy.current = true;
      await send({ type: "live", live });
      busy.current = false;
    },
    [send],
  );

  useEffect(() => setMe(getPlayerId()), []);

  // Remember when the player last touched mouse, keyboard or screen...
  useEffect(() => {
    const mark = () => (lastInput.current = Date.now());
    const events = ["pointermove", "pointerdown", "keydown", "wheel"];
    events.forEach((e) => addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => removeEventListener(e, mark));
  }, []);
  // ...and every 15s, if they did, tell the server "still here". No input for 1 min = removed.
  useInterval(() => Date.now() - lastInput.current < 15000 && send({ type: "ping" }), me && !error ? 15000 : null);
  useEffect(() => {
    if (me) send({ type: "join" });
  }, [me, send]);
  useInterval(() => fetch(url).then((res) => handle(res)).catch(() => {}), me && !error ? (POLL[room?.game?.type] ?? 1000) : null);

  const now = useCallback(() => Date.now() + offset.current, []); // the SERVER's time
  const value = useMemo(() => ({ code, me, room, error, notice, send, sendLive, now }), [code, me, room, error, notice, send, sendLive, now]);
  return <RoomContext value={value}>{children}</RoomContext>;
}
