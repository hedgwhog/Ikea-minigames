export const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Random numbers from a seed: the server and every browser get the SAME numbers.
export function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

// For round-based games: when the clock passes endsAt, run the next step.
// "while" so a room nobody looked at for a while catches up at once.
export function advance(game, now, steps) {
  let changed = false;
  while (!game.done && now >= game.endsAt) {
    steps[game.stage](game);
    changed = true;
  }
  return changed;
}

// Survivors first, then the players who were knocked out last ... first.
export const survivorOrder = (game) => [...game.alive, ...[...game.out].reverse().flat()];
