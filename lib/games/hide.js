// Every round everyone hides (several players may pick the same spot).
// Then the seeker checks ONE random open spot. After that, that spot is closed for everyone.
// Not hiding in time = caught.
import { SPOTS } from "../constants.js";
import { advance, pick, survivorOrder } from "./util.js";

const HIDE = 8000;
const REVEAL = 4000;
const ROUNDS = 8; // 9 spots: the last round has 2 open spots left

const newRound = (game, startAt) =>
  Object.assign(game, { stage: "hide", hidden: [], secret: { spots: {} }, endsAt: startAt + HIDE });

export const hideGame = {
  init(players, now) {
    const ids = players.map((p) => p.id);
    return newRound({ type: "hide", playerIds: ids, alive: ids, out: [], closed: [], round: 0, last: null }, now + 2000);
  },
  act(game, id, { value }) {
    const open = !game.closed.includes(value) && SPOTS.some((s) => s.id === value);
    if (game.stage !== "hide" || !game.alive.includes(id) || game.hidden.includes(id) || !open) return;
    game.secret.spots[id] = value;
    game.hidden.push(id);
  },
  tick: (game, now) =>
    advance(game, now, {
      hide(game) {
        const spots = game.secret.spots;
        const open = SPOTS.map((s) => s.id).filter((id) => !game.closed.includes(id));
        const checked = pick(open); // a completely random open spot
        game.closed.push(checked);
        const caught = game.alive.filter((id) => !spots[id] || spots[id] === checked);
        if (caught.length) game.out.push(caught);
        game.alive = game.alive.filter((id) => !caught.includes(id));
        game.last = { checked, spots, caught };
        game.stage = "reveal";
        game.endsAt += REVEAL;
      },
      reveal(game) {
        game.round += 1;
        const over = game.alive.length === 0 || (game.playerIds.length > 1 && game.alive.length === 1) || game.round >= ROUNDS;
        if (over) return (game.done = true);
        newRound(game, game.endsAt);
      },
    }),
  placements: survivorOrder,
};