// 5 real products. Everyone guesses, then the real price is shown.
// Points per question: 100 for a perfect guess, minus 1 for every percent you are off.
import { advance, shuffle } from "./util.js";

export const CURRENCIES = ["EUR", "SEK"]; // what players can type their guess in
export const convert = (value, from, to, rates) => (value / (rates[from] ?? 1)) * (rates[to] ?? 1);

const QUESTIONS = 5;
const GUESS = 15000;
const REVEAL = 5000;
export const pointsFor = (guess, price) =>
  guess == null ? 0 : Math.max(0, Math.round(100 - (Math.abs(guess - price) / price) * 100));

export const priceGame = {
  init(players, now, { products, rates }) {
    const ids = players.map((p) => p.id);
    const items = shuffle(products).slice(0, QUESTIONS);
    return {
      type: "price",
      playerIds: ids,
      q: 0,
      item: { ...items[0], price: undefined }, // price stays secret
      stage: "guess",
      guessed: [],
      points: Object.fromEntries(ids.map((id) => [id, 0])),
      last: null,
      rates,
      secret: { items, guesses: {}, typed: {} },
      endsAt: now + GUESS,
    };
  },
  act(game, id, { value, currency }, now) {
    const typed = Math.round(Number(value));
    if (game.stage !== "guess" || game.guessed.includes(id) || !(typed >= 0) || !CURRENCIES.includes(currency)) return;
    // compare in the product's own currency
    game.secret.guesses[id] = convert(typed, currency, game.item.currency, game.rates);
    game.secret.typed[id] = { value: typed, currency };
    game.guessed.push(id);
    if (game.playerIds.every((p) => game.guessed.includes(p))) game.endsAt = now; // all in: reveal now
  },
  tick: (game, now) =>
    advance(game, now, {
      guess(game) {
        const price = game.secret.items[game.q].price;
        const gained = {};
        for (const id of game.playerIds) {
          gained[id] = pointsFor(game.secret.guesses[id], price);
          game.points[id] += gained[id];
        }
        game.last = { price, currency: game.secret.items[game.q].currency, typed: game.secret.typed, gained };
        game.stage = "reveal";
        game.endsAt += REVEAL;
      },
      reveal(game) {
        game.q += 1;
        if (game.q >= game.secret.items.length) return (game.done = true);
        Object.assign(game, { item: { ...game.secret.items[game.q], price: undefined }, stage: "guess", guessed: [] });
        Object.assign(game.secret, { guesses: {}, typed: {} });
        game.endsAt += GUESS;
      },
    }),
  score: (game, id) => game.points[id] ?? 0, // accuracy points of all 5 products
};
