// All room rules as plain functions on a `room` object. No React, no HTTP, easy to test.
import { CHARACTERS, GAMES, MAX_PLAYERS } from "./constants.js";
import { ENGINES } from "./games/index.js";

export const makeCode = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");
export const newRoom = (code) => ({ code, createdAt: Date.now(), players: {}, scores: {}, phase: "lobby", gameIndex: -1, game: null, results: null });

// Players who didn't move the mouse / press a key for 1 minute are removed.
export const IDLE_MS = 60_000;
export function dropIdle(room, now) {
  const idle = Object.values(room.players).filter((p) => now - (p.seenAt ?? 0) > IDLE_MS);
  idle.forEach((p) => applyAction(room, p.id, { type: "leave" }, now));
  return idle.length > 0;
}
// No players left (and not brand new, so the creator has time to walk in) = delete the room
export const isAbandoned = (room, now) => Object.keys(room.players).length === 0 && now - (room.createdAt ?? 0) > 30_000;
export const isFull = (room) => Object.keys(room.players).length >= MAX_PLAYERS;
const players = (room) => Object.values(room.players);
const engine = (room) => ENGINES[room.game.type];

function startGame(room, index, now, extras) {
  if (index >= GAMES.length) return (room.phase = "final");
  room.gameIndex = index;
  room.phase = "playing";
  room.game = ENGINES[GAMES[index].id].init(players(room), now, extras);
}

// After a game: last place gets 1 point, every place above +1
function finishGame(room) {
  const order = engine(room).placements(room.game).filter((id) => room.players[id]);
  room.results = order.map((id, i) => ({ id, points: order.length - i }));
  room.results.forEach(({ id, points }) => (room.scores[id] += points));
  room.phase = "results";
}

// Time passes even when nobody clicks, so every request calls this first.
export function tickRoom(room, now, live = {}) {
  if (room.phase !== "playing") return false;
  const changed = engine(room).tick(room.game, now, live);
  if (room.game.done) finishGame(room);
  return changed;
}

// A player did something. Returns an error text, or nothing when it worked.
export function applyAction(room, id, action, now, extras) {
  const me = room.players[id];
  switch (action.type) {
    case "join": {
      if (me) return;
      if (isFull(room)) return "This room is full. All furniture is taken.";
      const free = CHARACTERS.find((c) => !players(room).some((p) => p.character === c.id));
      room.players[id] = { id, character: free.id, name: free.name, seenAt: now };
      room.scores[id] = 0;
      return;
    }
    case "pick": {
      const c = CHARACTERS.find((c) => c.id === action.character);
      if (!me || !c || room.phase !== "lobby") return;
      if (players(room).some((p) => p.character === c.id && p.id !== id)) return `${c.name} is already taken`;
      Object.assign(me, { character: c.id, name: c.name }); // your name IS your furniture
      return;
    }
    case "leave": {
      delete room.players[id];
      delete room.scores[id];
      if (room.game?.playerIds) {
        for (const key of ["playerIds", "alive"]) if (room.game[key]) room.game[key] = room.game[key].filter((p) => p !== id);
      }
      return;
    }
    case "ping": // "I'm still here" (sent while the player uses mouse or keyboard)
      return;
    case "start":
      if (room.phase === "lobby") startGame(room, 0, now, extras);
      return;
    case "next":
      if (room.phase === "results") startGame(room, room.gameIndex + 1, now, extras);
      return;
    case "restart":
      if (room.phase === "final") {
        Object.keys(room.scores).forEach((p) => (room.scores[p] = 0));
        Object.assign(room, { phase: "lobby", gameIndex: -1, game: null, results: null });
      }
      return;
    case "game":
      if (room.phase === "playing" && me) engine(room).act?.(room.game, id, action, now);
      return;
    default:
      return "Unknown action";
  }
}

// What browsers may see: secrets (prices, hiding spots) are removed while a game runs.
export function publicRoom(room, now, live) {
  const game = room.game && { ...room.game, live };
  if (game && !game.done) delete game.secret;
  return { room: { ...room, game }, serverNow: now };
}
