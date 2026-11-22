// The screenshot scenes behind ?shot=title|play|win|loss. Each one plays the real
// rules forward from a fresh duel, both seats steered by the same AI the game
// ships, so the frame is what a short game really looks like — and the same seed
// always gives the same frame.
//
// Finding the scene: try seeds in order, simulate the duel headless (no DOM),
// and keep the first seed whose duel ends the way the scene wants. The play
// scene stops mid-duel, once both boards hold guardians and both hands are full.

import { aiTakeTurn, aiTakeTurnFor, newGame } from './engine.js';

/** Play a whole duel headless with the AI on both seats; returns the final state. */
function simulate(seed, maxTurns = 40) {
  const state = newGame(seed);
  while (state.phase === 'play' && state.stats.turns <= maxTurns) {
    if (state.active === 0) aiTakeTurnFor(state, 0);
    else aiTakeTurn(state);
  }
  return state;
}

/** First seed (from `base`) whose headless duel ends with `seat` winning. */
function findSeed(base, seat, tries = 80) {
  for (let n = 0; n < tries; n += 1) {
    const state = simulate(base + n);
    if (state.phase !== 'play' && state.winner === seat) return state;
  }
  return null;
}

/**
 * Build the state for the named scene.
 * title: a fresh duel, a few turns in, title overlay on top.
 * play: mid-duel, both boards busy, both hands full.
 * win: a duel the player won, on the win screen.
 * loss: a duel the player lost, on the loss screen.
 */
export function stageShot(name, baseSeed) {
  if (name === 'win') {
    const found = findSeed(baseSeed, 0);
    if (found) return found;
  }
  if (name === 'loss') {
    const found = findSeed(baseSeed, 1);
    if (found) return found;
  }
  if (name === 'play') {
    // Walk seeds until a mid-duel frame has guardians on both sides.
    for (let n = 0; n < 80; n += 1) {
      const state = newGame(baseSeed + n);
      let steps = 0;
      while (state.phase === 'play' && steps < 16) {
        steps += 1;
        if (state.active === 0) aiTakeTurnFor(state, 0);
        else aiTakeTurn(state);
        if (state.players[0].board.length >= 2 && state.players[1].board.length >= 2
          && state.players[0].hand.length >= 4 && state.players[1].hand.length >= 3
          && state.phase === 'play') {
          return state;
        }
      }
    }
  }
  // Title (and any fallback): a fresh duel, a few turns in, overlay on top.
  const state = newGame(baseSeed);
  let steps = 0;
  while (state.phase === 'play' && steps < 4) {
    steps += 1;
    if (state.active === 0) aiTakeTurnFor(state, 0);
    else aiTakeTurn(state);
  }
  return state;
}
