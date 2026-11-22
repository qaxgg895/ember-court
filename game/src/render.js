// The table: everything the player sees, as DOM. The engine owns the rules;
// this file only turns a state into cards, bars and banners, and turns events
// (a hit, a heal, a death) into motion: a lunge, a shake, a floating number.

import { MAX_BOARD, MAX_LIFE } from './engine.js';
import { SUITS } from './cards.js';

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function suitBadge(suitKey) {
  const suit = SUITS[suitKey];
  const badge = el('span', 'suit-badge');
  badge.style.setProperty('--suit', suit.color);
  badge.style.setProperty('--suit-dark', suit.dark);
  const glyph = el('span', 'suit-glyph', suit.glyph);
  const name = el('span', 'suit-name', suit.name);
  badge.append(glyph, name);
  return badge;
}

/** One card, face up. `opts.playable` lifts it and marks it; `opts.small` shrinks it for the board. */
export function cardElement(card, opts = {}) {
  const suit = SUITS[card.suit];
  const node = el('article', `card suit-${card.suit}${opts.small ? ' small' : ''}${opts.playable ? ' playable' : ''}`);
  node.dataset.uid = String(card.uid);
  node.style.setProperty('--suit', suit.color);
  node.style.setProperty('--suit-dark', suit.dark);

  const cost = el('div', 'card-cost', String(card.cost));
  cost.title = 'Ember cost';
  const art = el('div', 'card-art');
  art.append(el('span', 'card-glyph', suit.glyph));
  const name = el('h3', 'card-name', card.name);
  const type = el('div', 'card-type', card.type === 'guardian' ? 'Guardian' : card.type === 'strike' ? 'Strike' : 'Charm');
  const text = el('p', 'card-text', card.text);
  node.append(cost, suitBadge(card.suit), art, name, type, text);
  if (card.type === 'guardian') {
    const stats = el('div', 'card-stats');
    stats.append(el('span', 'stat-atk', `⚔ ${card.atk}`), el('span', 'stat-hp', `♥ ${card.hp}`));
    node.append(stats);
  } else {
    const stats = el('div', 'card-stats');
    const label = card.effect === 'damage' ? `Damage ${card.amount}`
      : card.effect === 'heal' ? `Heal ${card.amount}`
      : card.effect === 'draw' ? `Draw ${card.amount}`
      : card.effect === 'ember' ? `+${card.amount} ember`
      : card.effect === 'buff' ? `+${card.amount}/+${card.amount}`
      : '';
    stats.append(el('span', 'stat-effect', label));
    node.append(stats);
  }
  return node;
}

/** A face-down card back, for Mira's hand. */
function cardBackElement() {
  const node = el('article', 'card card-back small');
  node.append(el('span', 'back-glyph', '✦'));
  return node;
}

function lifeBar(player) {
  const wrap = el('div', 'life-wrap');
  const hearts = el('span', 'life-hearts', `♥ ${player.life}`);
  const bar = el('div', 'life-bar');
  const fill = el('div', 'life-fill');
  fill.style.width = `${Math.max(0, (player.life / player.maxLife) * 100)}%`;
  bar.append(fill);
  const max = el('span', 'life-max', `/ ${player.maxLife}`);
  wrap.append(hearts, bar, max);
  return wrap;
}

function emberPips(player) {
  const wrap = el('div', 'ember-wrap');
  wrap.append(el('span', 'ember-label', 'Ember'));
  for (let i = 0; i < player.maxEmber; i += 1) {
    wrap.append(el('span', `ember-pip${i < player.ember ? ' lit' : ''}`, '●'));
  }
  wrap.append(el('span', 'ember-count', `${player.ember}/${player.maxEmber}`));
  return wrap;
}

function keeperPanel(player, isRival) {
  const panel = el('section', `keeper ${isRival ? 'rival' : 'you'}`);
  const avatar = el('div', 'avatar', player.name[0]);
  avatar.style.setProperty('--suit', isRival ? '#b06fd6' : '#f2c14e');
  const names = el('div', 'keeper-names');
  names.append(el('h2', 'keeper-name', player.name), el('div', 'keeper-title', player.title));
  panel.append(avatar, names, lifeBar(player), emberPips(player));
  const deck = el('div', 'deck-count', `Deck ${player.deck.length}`);
  panel.append(deck);
  return panel;
}

/** Render the whole table for `state`. `events` (from the last action) drive the motion. */
export function render(state, events = []) {
  const app = $('#app');
  app.innerHTML = '';

  const table = el('main', 'table');
  const topbar = el('header', 'topbar');
  topbar.append(el('div', 'brand', '✦ Ember Court'));
  const turn = el('div', 'turn-banner', state.phase === 'play'
    ? (state.active === 0 ? 'Your turn — play a card, then end your turn' : 'Mira is thinking…')
    : state.phase === 'won' ? 'The lantern is yours' : 'The lantern goes dark');
  topbar.append(turn);
  const controls = el('div', 'controls');
  const soundBtn = el('button', 'ctl-btn', '♪ Sound: on');
  soundBtn.id = 'sound-btn';
  const helpBtn = el('button', 'ctl-btn', '? How to play');
  helpBtn.id = 'help-btn';
  const restartBtn = el('button', 'ctl-btn', '↺ New duel');
  restartBtn.id = 'restart-btn';
  controls.append(soundBtn, helpBtn, restartBtn);
  topbar.append(controls);
  table.append(topbar);

  // Mira's side: her panel, her face-down hand, her guardians.
  const rival = state.players[1];
  const rivalRow = el('section', 'side rival-side');
  rivalRow.append(keeperPanel(rival, true));
  const rivalHand = el('div', 'hand backs');
  for (let i = 0; i < rival.hand.length; i += 1) rivalHand.append(cardBackElement());
  rivalHand.append(el('div', 'hand-count', `${rival.hand.length} cards`));
  rivalRow.append(rivalHand);
  table.append(rivalRow);

  const rivalBoard = el('div', 'board-row rival-board');
  for (let i = 0; i < MAX_BOARD; i += 1) {
    const slot = el('div', 'board-slot');
    if (rival.board[i]) slot.append(cardElement(rival.board[i], { small: true }));
    rivalBoard.append(slot);
  }
  table.append(rivalBoard);

  // The middle of the table: the log, and the End Turn button.
  const middle = el('div', 'middle');
  const log = el('div', 'log');
  for (const line of state.log.slice(-3)) log.append(el('div', 'log-line', line));
  middle.append(log);
  const endBtn = el('button', 'end-turn', state.active === 0 && state.phase === 'play' ? 'End turn ⏎' : 'Mira’s turn…');
  endBtn.id = 'end-turn-btn';
  endBtn.disabled = !(state.active === 0 && state.phase === 'play');
  middle.append(endBtn);
  table.append(middle);

  const yourBoard = el('div', 'board-row your-board');
  for (let i = 0; i < MAX_BOARD; i += 1) {
    const slot = el('div', 'board-slot');
    if (state.players[0].board[i]) slot.append(cardElement(state.players[0].board[i], { small: true }));
    yourBoard.append(slot);
  }
  table.append(yourBoard);

  // Your side: your panel and your hand of playable cards.
  const you = state.players[0];
  const yourRow = el('section', 'side your-side');
  yourRow.append(keeperPanel(you, false));
  const hand = el('div', `hand yours${you.hand.length >= 6 ? ' many' : ''}`);
  you.hand.forEach((card, index) => {
    const node = cardElement(card, { playable: state.active === 0 && state.phase === 'play' && card.cost <= you.ember && !(card.type === 'guardian' && you.board.length >= MAX_BOARD) });
    node.dataset.handIndex = String(index);
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.title = `${card.name} — ${card.text} (${card.cost} ember, press ${index + 1})`;
    hand.append(node);
  });
  yourRow.append(hand);
  table.append(yourRow);

  const hint = el('footer', 'hint', 'Click a card to play it (keys 1–7 work too) · Guardians strike when you end your turn · First keeper to 0 life loses the lantern');
  table.append(hint);
  app.append(table);

  // Motion from the last action: a shake on the keeper who was hurt, a floater
  // over the damage, a glow on what was just played.
  for (const event of events) {
    if (event.kind === 'damage') {
      const panel = event.player === 0 ? $('.keeper.you', app) : $('.keeper.rival', app);
      if (panel) {
        panel.classList.add('hurt');
        const floater = el('span', 'floater damage', `−${event.amount}`);
        panel.append(floater);
        setTimeout(() => floater.remove(), 1200);
      }
    }
    if (event.kind === 'heal') {
      const panel = event.player === 0 ? $('.keeper.you', app) : $('.keeper.rival', app);
      if (panel) {
        const floater = el('span', 'floater heal', `+${event.amount}`);
        panel.append(floater);
        setTimeout(() => floater.remove(), 1200);
      }
    }
    if (event.kind === 'died') {
      const board = event.player === 0 ? $('.your-board', app) : $('.rival-board', app);
      if (board) board.classList.add('shake');
    }
  }

  renderOverlay(state);
  return app;
}

function renderOverlay(state) {
  const old = $('#overlay');
  if (old) old.remove();
  if (state.phase === 'play') return;
  const overlay = el('div', 'overlay');
  overlay.id = 'overlay';
  const panel = el('div', 'overlay-panel');
  if (state.phase === 'won') {
    panel.append(el('div', 'overlay-glyph', '✦'));
    panel.append(el('h1', 'overlay-title win', 'The lantern is yours'));
    panel.append(el('p', 'overlay-text', 'Mira bows, and the last lantern burns a little brighter. The Ember Court has a new keeper.'));
  } else {
    panel.append(el('div', 'overlay-glyph', '☾'));
    panel.append(el('h1', 'overlay-title lose', 'The lantern goes dark'));
    panel.append(el('p', 'overlay-text', 'Mira keeps the flame tonight. Shuffle the deck, steady your hand, and challenge her again.'));
  }
  const stats = el('div', 'overlay-stats');
  stats.append(
    statBox('Turns', String(state.stats.turns)),
    statBox('Cards played', String(state.stats.cardsPlayed[0])),
    statBox('Damage dealt', String(state.stats.damageDealt[0])),
    statBox('Guardians raised', String(state.stats.guardiansPlayed[0])),
  );
  panel.append(stats);
  const again = el('button', 'overlay-btn', '↺ Duel again');
  again.id = 'again-btn';
  panel.append(again);
  overlay.append(panel);
  $('#app').append(overlay);
}

function statBox(label, value) {
  const box = el('div', 'stat-box');
  box.append(el('div', 'stat-value', value), el('div', 'stat-label', label));
  return box;
}

/** The title screen, shown over the table until the duel begins. */
export function renderTitle(onStart) {
  const app = $('#app');
  const overlay = el('div', 'overlay title-screen');
  overlay.id = 'overlay';
  const panel = el('div', 'overlay-panel title-panel');
  panel.append(el('div', 'overlay-glyph big', '✦'));
  panel.append(el('h1', 'game-title', 'Ember Court'));
  panel.append(el('p', 'game-subtitle', 'A duel of lantern-keepers, played with cards of ember, thorn, tide and star.'));
  const rules = el('div', 'rules');
  rules.append(
    ruleLine('♥ 24 life', 'Reduce Mira, Keeper of the Last Lantern, to 0 life before she does the same to you.'),
    ruleLine('● Ember', 'Each turn your ember grows and refills. Cards cost ember to play.'),
    ruleLine('◆ Guardians', 'Guardians hold the board and strike at the end of your turn — the rival’s front guardian takes the hit first.'),
    ruleLine('▲ Strikes', 'Strikes fly over the board and hit Mira directly.'),
    ruleLine('✦ Charms', 'Charms mend, draw, kindle ember, or rally your guardians.'),
  );
  panel.append(rules);
  const start = el('button', 'overlay-btn big', 'Light the lantern — begin the duel');
  start.id = 'start-btn';
  start.addEventListener('click', onStart);
  panel.append(start);
  panel.append(el('p', 'title-hint', 'Mouse or keyboard: click a card (or press 1–7) to play it, Enter to end your turn.'));
  overlay.append(panel);
  app.append(overlay);
}

function ruleLine(bold, rest) {
  const line = el('div', 'rule-line');
  line.append(el('strong', null, bold), document.createTextNode(` — ${rest}`));
  return line;
}

/** The how-to-play panel, toggled from the top bar. */
export function renderHelp(onClose) {
  const old = $('#help-overlay');
  if (old) {
    old.remove();
    return;
  }
  const overlay = el('div', 'overlay help-screen');
  overlay.id = 'help-overlay';
  const panel = el('div', 'overlay-panel');
  panel.append(el('h2', 'overlay-title', 'How to play'));
  const list = el('div', 'rules');
  list.append(
    ruleLine('Your turn', 'Ember grows by 1 (up to 8) and refills; you draw a card. Play as many cards as you can afford, then press End turn.'),
    ruleLine('Guardians', 'They stay on the board (at most 4). At the end of your turn each one strikes: damage meets the rival’s front guardian first, and the rest reaches the rival keeper.'),
    ruleLine('Strikes', 'Instant damage to the rival keeper, over the top of her guardians.'),
    ruleLine('Charms', 'Warm Hearth heals, Deep Breath draws, Kindle adds ember, Banner of Embers strengthens every guardian you have.'),
    ruleLine('Running dry', 'An empty deck reshuffles your discard — and costs 1 life. Don’t stall.'),
    ruleLine('Keys', '1–7 play a card from your hand. Enter ends your turn.'),
  );
  panel.append(list);
  const close = el('button', 'overlay-btn', 'Back to the table');
  close.addEventListener('click', onClose);
  panel.append(close);
  overlay.append(panel);
  $('#app').append(overlay);
}
