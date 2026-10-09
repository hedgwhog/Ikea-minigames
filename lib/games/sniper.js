// Treehouse Sniper: "red light, green light" with a sniper in the Småland treehouse.
// Every player is the sniper for one round. Runners: reach the finish line = +1 point.
// Sniper: every hit = +1 point. Runners move in their own browser and send their position (live data).
import { shuffle, advance } from "./util.js";
import { MAP_W, START_Y } from "./sniperMap.js";

const READY = 3000;
const RUN = 180000; // max length of a round: 3 minutes (it ends sooner when every runner is done)
const REVEAL = 3500; // short break between rounds
export const SHOT_COOLDOWN = 1000;

function newRound(game, startAt) {
  const sniper = game.order[game.round];
  const runners = game.playerIds.filter((id) => id !== sniper);
  const spawns = Object.fromEntries(
    runners.map((id, i) => [id, { x: Math.round(((i + 1) / (runners.length + 1)) * MAP_W), y: START_Y }]),
  );
  Object.assign(game, {
    stage: "run", sniper, runners, spawns, dead: [], finished: [], shots: [],
    startAt: startAt + READY, endsAt: startAt + READY + RUN, lastShotAt: 0,
  });
}

const roundOver = (game) => game.runners.every((id) => game.dead.includes(id) || game.finished.includes(id));

export const sniperGame = {
  init(players, now) {
    const ids = players.map((p) => p.id);
    const game = { type: "sniper", playerIds: ids, order: shuffle(ids), round: 0, points: Object.fromEntries(ids.map((id) => [id, 0])) };
    if (ids.length < 2) return { ...game, solo: true, stage: "reveal", runners: [], dead: [], finished: [], shots: [], endsAt: now + 4000 };
    newRound(game, now);
    return game;
  },
  act(game, id, action, now) {
    if (game.stage !== "run" || now < game.startAt) return;
    const active = (r) => game.runners.includes(r) && !game.dead.includes(r) && !game.finished.includes(r);

    if (action.kind === "shoot" && id === game.sniper && now - game.lastShotAt >= SHOT_COOLDOWN) {
      game.lastShotAt = now;
      const hit = active(action.hit) ? action.hit : null; // the sniper's browser did the aiming
      if (hit) {
        game.dead.push(hit);
        game.points[id] += 1;
      }
      game.shots = [...game.shots.slice(-4), { x: action.x, y: action.y, h: action.h, hit, at: now }];
    }
    if (action.kind === "finish" && active(id)) {
      game.finished.push(id);
      game.points[id] += 1;
    }
    if (roundOver(game)) game.endsAt = Math.min(game.endsAt, now + 1000); // everyone done: short pause, then next
  },
  tick: (game, now) =>
    advance(game, now, {
      run(game) {
        game.stage = "reveal";
        game.endsAt += REVEAL;
      },
      reveal(game) {
        game.round += 1;
        if (game.solo || game.round >= game.order.length) return (game.done = true);
        newRound(game, game.endsAt);
      },
    }),
  score: (game, id) => game.points[id] ?? 0, // finishes + hits
};
