// Every browser moves its OWN cart (smooth!) and sends its position as live data.
// The server only decides who is outside the light, and when the game ends.
import { circleAt, inWall, MAP_H, MAP_W } from "./bumperMap.js";
import { survivorOrder } from "./util.js";

const randomSpot = (margin) => ({
  x: Math.round(margin + Math.random() * (MAP_W - margin * 2)),
  y: Math.round(margin + Math.random() * (MAP_H - margin * 2)),
});

export const bumperGame = {
  init(players, now) {
    const spawns = {};
    for (const p of players) {
      let spot;
      do spot = randomSpot(100);
      while (inWall(spot) || Object.values(spawns).some((s) => Math.hypot(s.x - spot.x, s.y - spot.y) < 500));
      spawns[p.id] = spot;
    }
    const ids = players.map((p) => p.id);
    return { type: "bumper", playerIds: ids, alive: ids, out: [], spawns, final: randomSpot(500), startAt: now + 3000, endsAt: now + 3000 + 100000 };
  },
  tick(game, now, live) {
    const light = circleAt(game, now);
    const pos = (id) => live[id] ?? game.spawns[id];
    const outside = game.alive.filter((id) => Math.hypot(pos(id).x - light.x, pos(id).y - light.y) > light.r + 10);
    if (outside.length) game.out.push(outside);
    game.alive = game.alive.filter((id) => !outside.includes(id));
    const over = game.alive.length === 0 || (game.playerIds.length > 1 && game.alive.length === 1) || now > game.endsAt;
    if (over) game.done = true;
    return outside.length > 0 || over;
  },
  placements: survivorOrder,
};
