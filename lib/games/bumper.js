import { inWall, MAP_H, MAP_W, makeZones, ZONE_TOTAL, zoneAt } from "./bumperMap.js";
import { survivorScore } from "./util.js";

export const STORM_MAX = 3; // seconds you survive in the storm

const randomSpot = () => ({ x: Math.round(150 + Math.random() * (MAP_W - 300)), y: Math.round(150 + Math.random() * (MAP_H - 300)) });

export const bumperGame = {
  init(players, now) {
    const spawns = {};
    for (const p of players) {
      let spot;
      do spot = randomSpot();
      while (inWall(spot) || Object.values(spawns).some((s) => Math.hypot(s.x - spot.x, s.y - spot.y) < 500));
      spawns[p.id] = spot;
    }
    const ids = players.map((p) => p.id);
    const startAt = now + 3000;
    return { type: "bumper", playerIds: ids, alive: ids, out: [], spawns, zones: makeZones(), startAt, endsAt: startAt + ZONE_TOTAL + 25000 };
  },
  tick(game, now, live) {
    const zone = zoneAt(game.zones, game.startAt, now);
    const outside = (p) => Math.hypot(p.x - zone.x, p.y - zone.y) > zone.r;
    const gone = game.alive.filter((id) => {
      const l = live[id];
      return (l?.storm ?? 0) >= STORM_MAX || (now - (l?.at ?? 0) > 5000 && outside(l ?? game.spawns[id]));
    });
    if (gone.length) game.out.push(gone);
    game.alive = game.alive.filter((id) => !gone.includes(id));
    const over = game.alive.length === 0 || (game.playerIds.length > 1 && game.alive.length === 1) || now > game.endsAt;
    if (over) game.done = true;
    return gone.length > 0 || over;
  },
  score: survivorScore,
};