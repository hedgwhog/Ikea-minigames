// Flat-Pack Runner: a (very) low budget Subway Surfers in the IKEA warehouse.
// Everyone runs the SAME track (made from a seed) at the same time, each in their own browser.
// Players send how far they got as live data. Furthest run wins.
import { seeded } from "./util.js";

const READY = 3000;
const MAX_MS = 150000; // the game ends after 2.5 minutes at the latest

// Obstacles: what you have to do to get past
//   box    -> JUMP over it      beam -> DUCK under it      pallet -> switch LANE
export function makeTrack(seed) {
  const random = seeded(seed);
  const rows = [];
  let z = 30; // metres from the start
  for (let i = 0; i < 900; i++) {
    const blocked = random() < 0.5 ? 2 : 1; // block 1 or 2 of the 3 lanes, never all 3
    const lanes = [0, 1, 2].sort(() => random() - 0.5).slice(0, blocked);
    for (const lane of lanes) {
      const r = random();
      rows.push({ z, lane, kind: r < 0.4 ? "box" : r < 0.7 ? "beam" : "pallet" });
    }
    z += 11 + random() * 8; // metres to the next row of obstacles
  }
  return rows;
}

export const runnerGame = {
  init: (players, now) => ({
    type: "runner",
    playerIds: players.map((p) => p.id),
    seed: Math.floor(Math.random() * 1e9),
    startAt: now + READY,
    endsAt: now + READY + MAX_MS,
    distances: {},
  }),
  tick(game, now, live) {
    // everyone crashed (or stopped sending for 5s) = game over
    const finished = (id) => live[id]?.dead || (now > game.startAt + 5000 && now - (live[id]?.at ?? 0) > 5000);
    if (now < game.endsAt && !game.playerIds.every(finished)) return false;
    for (const id of game.playerIds) game.distances[id] = Math.min(100000, Math.round(live[id]?.d ?? 0));
    return (game.done = true);
  },
  score: (game, id) => game.distances[id] ?? 0, // metres
};
