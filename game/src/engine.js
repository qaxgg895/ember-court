// The rules of Ember Court, as pure state transitions: no DOM, no sound, nothing
// the screenshots or the tests cannot run headless.
//
// The duel: two keepers, 24 life each. On your turn you gain ember (your maximum
// grows by 1 each turn, up to 8, and refills), draw a card, and play as many cards
// as you can afford. Guardians stay on the board (at most 4 a side) and strike at
// the end of your turn: their damage meets the rival's front guardian first and
// whatever is left over reaches the rival keeper. Strikes fly over the board and
// hit the rival keeper directly. Charms mend, draw, kindle or rally. Reduce the
// rival keeper to 0 life and the lantern is yours.

import { buildDeck, makeCard } from './cards.js';
import { makeRng, shuffle } from './rng.js';

export const MAX_LIFE = 24;
export const MAX_EMBER = 8;
export const MAX_BOARD = 4;
export const MAX_HAND = 7;
export const START_HAND = 3;

let nextUid = 1;

/** A fresh duel. `seed` drives the shuffles and the AI's tie-breaks. */
export function newGame(seed) {
  const rng = makeRng(seed);
  const players = [makePlayer('You', 'Keeper of the First Lantern', false, rng), makePlayer('Mira', 'Keeper of the Last Lantern', true, rng)];
  const state = {
    seed,
    rng,
    players,
    turn: 1,
    active: 0,
    phase: 'play',
    winner: null,
    log: [],
    stats: { turns: 0, cardsPlayed: [0, 0], damageDealt: [0, 0], guardiansPlayed: [0, 0] },
  };
  for (const player of players) {
    for (let i = 0; i < START_HAND; i += 1) drawCard(state, player);
  }
  startTurn(state, 0);
  return state;
}

function makePlayer(name, title, isAI, rng) {
  const deck = shuffle(buildDeck(), rng);
  return {
    name, title, isAI,
    life: MAX_LIFE, maxLife: MAX_LIFE,
    ember: 0, maxEmber: 0,
    deck, hand: [], board: [], discard: [],
  };
}

/** Draw the top card of `player`'s deck into their hand (hand caps at 7). */
export function drawCard(state, player) {
  if (player.deck.length === 0) {
    // An empty deck is reshuffled from the discard pile, minus the turn's pain:
    // running dry costs 1 life, so stalling forever is not a plan.
    if (player.discard.length === 0) return null;
    player.deck = shuffle(player.discard.splice(0), state.rng);
    player.life = Math.max(0, player.life - 1);
    addLog(state, `${player.name}'s deck ran dry — the lantern dims (−1 life).`);
  }
  const card = player.deck.pop();
  card.uid = nextUid;
  nextUid += 1;
  if (player.hand.length >= MAX_HAND) {
    player.discard.push(card);
    addLog(state, `${player.name}'s hand is full; ${card.name} slips away.`);
    return null;
  }
  player.hand.push(card);
  return card;
}

/** Begin `index`'s turn: grow and refill ember, draw, count the turn. */
export function startTurn(state, index) {
  const player = state.players[index];
  state.active = index;
  player.maxEmber = Math.min(MAX_EMBER, player.maxEmber + 1);
  player.ember = player.maxEmber;
  drawCard(state, player);
  if (index === 0) state.stats.turns += 1;
}

/** Can `player` play the card at `handIndex` right now? */
export function canPlay(state, playerIndex, handIndex) {
  if (state.phase !== 'play' || state.active !== playerIndex) return false;
  const player = state.players[playerIndex];
  const card = player.hand[handIndex];
  if (!card) return false;
  if (card.cost > player.ember) return false;
  if (card.type === 'guardian' && player.board.length >= MAX_BOARD) return false;
  return true;
}

/**
 * Play the card at `handIndex` for `playerIndex`. Returns the events it caused
 * (for the renderer and the log), or null when the play is illegal.
 * Events: {kind: 'played'|'damage'|'heal'|'draw'|'ember'|'buff'|'summon'|'died', ...}
 */
export function playCard(state, playerIndex, handIndex) {
  if (!canPlay(state, playerIndex, handIndex)) return null;
  const player = state.players[playerIndex];
  const rival = state.players[1 - playerIndex];
  const card = player.hand.splice(handIndex, 1)[0];
  player.ember -= card.cost;
  player.discard.push(card);
  state.stats.cardsPlayed[playerIndex] += 1;
  const events = [{ kind: 'played', player: playerIndex, card }];
  addLog(state, `${player.name} plays ${card.name}.`);

  if (card.type === 'guardian') {
    const guardian = makeCard(card.id);
    guardian.uid = card.uid;
    player.board.push(guardian);
    state.stats.guardiansPlayed[playerIndex] += 1;
    events.push({ kind: 'summon', player: playerIndex, card: guardian });
    if (card.effect === 'healOnPlay') {
      const healed = heal(player, card.amount);
      events.push({ kind: 'heal', player: playerIndex, amount: healed });
      addLog(state, `${card.name}'s light restores ${healed} life.`);
    }
    return finishPlay(state, events);
  }

  if (card.effect === 'damage') {
    damageRival(state, playerIndex, card.amount, events);
  } else if (card.effect === 'heal') {
    const healed = heal(player, card.amount);
    events.push({ kind: 'heal', player: playerIndex, amount: healed });
    addLog(state, `${player.name} recovers ${healed} life by the hearth.`);
  } else if (card.effect === 'draw') {
    for (let i = 0; i < card.amount; i += 1) drawCard(state, player);
    events.push({ kind: 'draw', player: playerIndex, amount: card.amount });
  } else if (card.effect === 'ember') {
    player.ember = Math.min(MAX_EMBER, player.ember + card.amount);
    events.push({ kind: 'ember', player: playerIndex, amount: card.amount });
  } else if (card.effect === 'buff') {
    for (const guardian of player.board) {
      guardian.atk += card.amount;
      guardian.hp += card.amount;
      guardian.maxHp += card.amount;
    }
    events.push({ kind: 'buff', player: playerIndex, amount: card.amount });
    addLog(state, `${player.name}'s guardians rally (+${card.amount}/+${card.amount}).`);
  }
  return finishPlay(state, events);
}

function finishPlay(state, events) {
  checkEnd(state);
  return events;
}

function heal(player, amount) {
  const healed = Math.min(amount, player.maxLife - player.life);
  player.life += healed;
  return healed;
}

/** A strike's damage, straight to the rival keeper. */
function damageRival(state, attackerIndex, amount, events) {
  const rival = state.players[1 - attackerIndex];
  rival.life = Math.max(0, rival.life - amount);
  state.stats.damageDealt[attackerIndex] += amount;
  events.push({ kind: 'damage', player: 1 - attackerIndex, amount, direct: true });
  addLog(state, `${rival.name} takes ${amount} damage.`);
}

/**
 * End the active player's turn: their guardians strike, front guardian first,
 * overflow spilling onto the rival keeper; then the other keeper's turn begins.
 */
export function endTurn(state) {
  if (state.phase !== 'play') return [];
  const attacker = state.players[state.active];
  const defender = state.players[1 - state.active];
  const events = [{ kind: 'turnEnd', player: state.active }];
  for (const guardian of [...attacker.board]) {
    if (state.phase !== 'play') break;
    if (guardian.atk <= 0) continue;
    let remaining = guardian.atk;
    while (remaining > 0 && defender.board.length > 0) {
      const front = defender.board[0];
      const dealt = Math.min(remaining, front.hp);
      front.hp -= dealt;
      remaining -= dealt;
      events.push({ kind: 'guardHit', player: 1 - state.active, card: front, amount: dealt, by: guardian });
      if (front.hp <= 0) {
        defender.board.shift();
        defender.discard.push(front);
        events.push({ kind: 'died', player: 1 - state.active, card: front });
        addLog(state, `${front.name} falls.`);
      }
    }
    if (remaining > 0) {
      defender.life = Math.max(0, defender.life - remaining);
      state.stats.damageDealt[state.active] += remaining;
      events.push({ kind: 'damage', player: 1 - state.active, amount: remaining, by: guardian });
      addLog(state, `${guardian.name} strikes ${defender.name} for ${remaining}.`);
    }
  }
  checkEnd(state);
  if (state.phase === 'play') startTurn(state, 1 - state.active);
  return events;
}

function checkEnd(state) {
  const [a, b] = state.players;
  if (a.life <= 0 && b.life <= 0) {
    // Both lanterns out on the same blow: the one who struck last keeps the flame.
    state.phase = 'won';
    state.winner = state.active;
  } else if (b.life <= 0) {
    state.phase = 'won';
    state.winner = 0;
  } else if (a.life <= 0) {
    state.phase = 'lost';
    state.winner = 1;
  }
  if (state.phase !== 'play') {
    const winner = state.players[state.winner];
    addLog(state, `${winner.name} takes the lantern — the duel is over.`);
  }
}

export function addLog(state, text) {
  state.log.push(text);
  if (state.log.length > 6) state.log.shift();
}

// ---------------------------------------------------------------------------
// The AI opponent: Mira, Keeper of the Last Lantern.
//
// She scores every card she could play and takes the best one, again and again
// until nothing scores well enough. Guardians first when the board is thin,
// strikes when they finish the duel (or when her hand is about to overflow),
// healing when she is hurt, draw when her hand is empty, kindle when she has
// something worth spending the ember on, and the banner only with a board to
// rally. Her choices are readable: she plays what the table asks for.
// ---------------------------------------------------------------------------

function scoreCard(state, aiIndex, handIndex) {
  const ai = state.players[aiIndex];
  const rival = state.players[1 - aiIndex];
  const card = ai.hand[handIndex];
  if (card.cost > ai.ember) return -1;
  if (card.type === 'guardian') {
    if (ai.board.length >= MAX_BOARD) return -1;
    let score = card.atk * 2 + card.hp + (card.effect === 'healOnPlay' ? 2 : 0);
    if (rival.board.length > 0) score += 1; // a body to meet a body
    if (ai.board.length === 0) score += 1; // never leave the board empty
    return score - card.cost * 1.5;
  }
  if (card.effect === 'damage') {
    if (card.amount >= rival.life) return 100; // the killing blow
    if (rival.life <= 8) return 12;
    if (ai.hand.length >= MAX_HAND - 1) return 6; // spend before the hand overflows
    return 2;
  }
  if (card.effect === 'heal') {
    if (ai.life >= ai.maxLife - 2) return -1;
    return ai.life <= 12 ? 12 : 5;
  }
  if (card.effect === 'draw') return ai.hand.length <= 3 ? 9 : 3;
  if (card.effect === 'ember') {
    const spendable = ai.hand.some((c, i) => i !== handIndex && c.cost <= ai.ember - card.cost + card.amount);
    return spendable ? 8 : 2;
  }
  if (card.effect === 'buff') return ai.board.length >= 2 ? 10 : -1;
  return 0;
}

/**
 * One AI action for `seat`: its best card now, or the end of its turn when
 * nothing scores well enough. Returns the events that action caused.
 */
export function aiTakeStep(state, seat) {
  if (state.phase !== 'play' || state.active !== seat) return [];
  let best = -1;
  let bestScore = 3.5;
  for (let i = 0; i < state.players[seat].hand.length; i += 1) {
    const score = scoreCard(state, seat, i) + state.rng() * 0.6;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best === -1) return endTurn(state);
  return playCard(state, seat, best) ?? [];
}

/** Play a whole turn for `seat` with the AI's brain: best card, then the next, until it rests. */
export function aiTakeTurnFor(state, seat) {
  const allEvents = [];
  let guard = 0;
  while (state.phase === 'play' && state.active === seat && guard < 12) {
    guard += 1;
    const before = state.players[seat].hand.length;
    allEvents.push(...aiTakeStep(state, seat));
    // A step that played nothing and ended the turn leaves the loop via `active`.
    if (state.players[seat].hand.length === before && state.active === seat) break;
  }
  return allEvents;
}

/** Play Mira's whole turn (seat 1) with the AI's brain. */
export function aiTakeTurn(state) {
  return aiTakeTurnFor(state, 1);
}
