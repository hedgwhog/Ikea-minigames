// The sofa names one real product. Every round the buttons are new products in new
// random spots, there are more of them and less time. Wrong or too slow = lose a life.
import { advance, pick, shuffle, survivorOrder } from "./util.js";

export const GRID = 16; // 4 x 4
export const LIVES = 2;
export const timeFor = (round) => Math.max(2500, 7000 - round * 300);
const REVEAL = 1800;

function newRound(game, startAt) {
  const count = Math.min(GRID, 4 + game.round, game.pool.length);
  const cells = shuffle([...Array(GRID).keys()]);
  game.buttons = shuffle(game.pool).slice(0, count).map((p, i) => ({ ...p, cell: cells[i] }));
  game.target = pick(game.buttons).id;
  Object.assign(game, { answers: {}, stage: "play", startedAt: startAt, endsAt: startAt + timeFor(game.round) });
}

export const sofaGame = {
  init(players, now, { products }) {
    const ids = players.map((p) => p.id);
    const game = {
      type: "sofa",
      playerIds: ids,
      alive: ids,
      out: [],
      lives: Object.fromEntries(ids.map((id) => [id, LIVES])),
      pool: products.slice(0, 24).map(({ id, name, type, image }) => ({ id, name, type, image })),
      round: 0,
      last: null,
    };
    newRound(game, now + 2000); // 2s to get ready
    return game;
  },
  act(game, id, { value }, now) {
    if (game.stage !== "play" || now < game.startedAt || !game.alive.includes(id) || game.answers[id]) return;
    game.answers[id] = value; // first tap counts
    if (game.alive.every((p) => game.answers[p])) game.endsAt = now;
  },
  tick: (game, now) =>
    advance(game, now, {
      play(game) {
        const lost = game.alive.filter((id) => game.answers[id] !== game.target);
        lost.forEach((id) => (game.lives[id] -= 1));
        const out = lost.filter((id) => game.lives[id] === 0);
        if (out.length) game.out.push(out);
        game.alive = game.alive.filter((id) => !out.includes(id));
        game.last = { lost, out };
        game.stage = "reveal";
        game.endsAt += REVEAL;
      },
      reveal(game) {
        game.round += 1;
        const over = game.alive.length === 0 || (game.playerIds.length > 1 && game.alive.length === 1) || game.round >= 25;
        if (over) return (game.done = true);
        newRound(game, game.endsAt);
      },
    }),
  placements: (game) => {
    game.alive.sort((a, b) => game.lives[b] - game.lives[a]);
    return survivorOrder(game);
  },
};
