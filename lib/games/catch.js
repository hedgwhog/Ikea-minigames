// Everyone plays on the SAME field. The meatballs come from a seed, so every browser
// sees the same meatballs without the server sending them. Each player sends their bowl
// position and the ids they caught ("live" data). A ball someone caught disappears for all.
import { seeded } from "./util.js";

export const FIELD = { W: 1600, H: 900, BOWL: 110, BALL: 36 };
const READY = 3000;
const PLAY = 30000;

export function makeBalls(seed) {
  const random = seeded(seed);
  return Array.from({ length: 110 }, (_, i) => ({
    id: i,
    at: i * 0.27, // seconds after the start
    x: 40 + random() * (FIELD.W - 80),
    speed: 230 + random() * 130 + i * 1.5, // later balls fall faster
    gold: random() < 0.07,
  }));
}
export const scoreOf = (balls, caught = []) => caught.reduce((sum, id) => sum + (balls[id]?.gold ? 5 : balls[id] ? 1 : 0), 0);

export const catchGame = {
  init: (players, now) => ({
    type: "catch",
    playerIds: players.map((p) => p.id),
    seed: Math.floor(Math.random() * 1e9),
    startAt: now + READY,
    endsAt: now + READY + PLAY,
    scores: {},
  }),
  tick(game, now, live) {
    if (now < game.endsAt + 1000) return false; // 1s extra for the last catches to arrive
    const balls = makeBalls(game.seed);
    for (const id of game.playerIds) game.scores[id] = scoreOf(balls, [...new Set(live[id]?.caught)]);
    return (game.done = true);
  },
  score: (game, id) => game.scores[id] ?? 0, // meatball points
};
