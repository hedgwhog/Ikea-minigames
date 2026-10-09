"use client";
// Everything about the current room, shared with every component via useContext.
// It asks the server for news every second ("polling") and sends what the player does.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useInterval } from "@/hooks/useInterval";
import { getPlayerId } from "@/lib/identity";

const RoomContext = createContext(null);
export const useRoom = () => useContext(RoomContext);
const POLL = { price: 700, sofa: 400, hide: 500 }; // live games update through sendLive instead
const PING_MS = 15000; // "still here" every 15s. Must be well below IDLE_MS in lib/room.js

export function RoomProvider({ code, children }) {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const offset = useRef(0); // server clock minus my clock
  const busy = useRef(false);
  const joined = useRef(false); // was I in the room before? (to notice being removed)
  const lastInput = useRef(Date.now()); // last mouse / keyboard / touch use
  const away = useRef(false); // am I idle right now?
  const previous = useRef(null); // the players at the last update, to spot changes
  const sendRef = useRef(null);
  const noticeTimer = useRef(null);
  const pauseUntil = useRef(0); // after a server error: wait a moment before sending live data again

  const url = `/api/rooms/${code}`;

  const showNotice = useCallback((text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  // Tell everyone when another player goes away, comes back or leaves
  const announce = useCallback(
    (before, after) => {
      if (!before) return;
      for (const p of Object.values(before)) {
        if (p.id === getPlayerId()) continue;
        const now = after[p.id];
        const replaced = Object.values(after).some((q) => q.character === p.character && q.id !== p.id);
        if (!now) showNotice(replaced ? `Someone new took over ${p.name}` : `${p.name} left the room`);
        else if (!p.idle && now.idle) showNotice(`${p.name} is away`);
        else if (p.idle && !now.idle) showNotice(`${p.name} is back`);
      }
    },
    [showNotice],
  );

  const handle = useCallback(
    async (res, fatal) => {
      const data = await res.json();
      if (res.status >= 500) pauseUntil.current = Date.now() + 2000;
      if (res.ok) {
        offset.current = data.serverNow - Date.now();
        const mine = data.room.players[getPlayerId()];
        announce(previous.current, data.room.players);
        previous.current = data.room.players;
        away.current = Boolean(mine?.idle);
        setRoom(data.room);
        if (joined.current && !mine) setError("You were away too long, so you left the room.");
        else setError(null);
        joined.current = Boolean(mine);
      } else if (fatal || res.status >= 404) setError(data.error);
      else showNotice(data.error);
    },
    [announce, showNotice],
  );

  const send = useCallback(
    (action) =>
      fetch(url, { method: "POST", body: JSON.stringify({ playerId: me, ...action }) })
        .then((res) => handle(res, action.type === "join"))
        .catch(() => {}),
    [url, me, handle],
  );
  useEffect(() => {
    sendRef.current = send;
  });

  // Positions etc. Skipped when the previous one is still on its way (no traffic jam).
  const sendLive = useCallback(
    async (live) => {
      if (busy.current || Date.now() < pauseUntil.current) return;
      busy.current = true;
      await send({ type: "live", live });
      busy.current = false;
    },
    [send],
  );

  useEffect(() => setMe(getPlayerId()), []);
  useEffect(() => {
    if (me) send({ type: "join" });
  }, [me, send]);

  // Remember when the player last used mouse, keyboard or screen.
  // Coming back from "away"? Tell the server right away instead of waiting for the next ping.
  useEffect(() => {
    let lastWake = 0;
    const mark = () => {
      lastInput.current = Date.now();
      if (away.current && Date.now() - lastWake > 3000) {
        lastWake = Date.now();
        sendRef.current?.({ type: "ping" });
      }
    };
    const events = ["pointermove", "pointerdown", "keydown", "wheel"];
    events.forEach((e) => addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => removeEventListener(e, mark));
  }, []);

  // "Still here", but only if the player actually did something in the last 15 seconds
  useInterval(() => Date.now() - lastInput.current < PING_MS && send({ type: "ping" }), me && !error ? PING_MS : null);
  useInterval(
    () => fetch(url).then((res) => handle(res)).catch(() => {}),
    me && !error ? (POLL[room?.game?.type] ?? 1000) : null,
  );

  const now = useCallback(() => Date.now() + offset.current, []); // the SERVER's time
  const value = useMemo(
    () => ({ code, me, room, error, notice, send, sendLive, now }),
    [code, me, room, error, notice, send, sendLive, now],
  );
  return <RoomContext value={value}>{children}</RoomContext>;
}