// Ember Court, entry point: build the table, wire the mouse and keyboard, and
// run the turns. The player's turn is theirs; Mira's turn plays itself out in
// front of them, one card at a time, so her choices can be read.
//
// ?shot=title|play|win|loss&seed=N renders one screenshot scene instead of a
// fresh duel: the state is staged by shots.js, the title overlay stays up for
// the title scene, and nothing waits for input.

import { aiTakeStep, canPlay, endTurn, newGame, playCard } from './engine.js';
import { render, renderHelp, renderTitle } from './render.js';
import { isMuted, playEvents, sounds, toggleMute } from './sound.js';
import { seedFromQuery } from './rng.js';
import { stageShot } from './shots.js';

const AI_STEP_MS = 650;

let state = null;
let shotMode = false;
let aiTimer = null;

function clearAiTimer() {
  if (aiTimer !== null) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
}

/** Re-render the table, playing the sounds the events ask for. */
function show(events = []) {
  render(state, events);
  playEvents(events);
  wireControls();
}

/** Wire the buttons and cards of the table just rendered. */
function wireControls() {
  const endBtn = document.getElementById('end-turn-btn');
  if (endBtn) endBtn.addEventListener('click', onEndTurn);
  const soundBtn = document.getElementById('sound-btn');
  if (soundBtn) {
    soundBtn.textContent = `♪ Sound: ${isMuted() ? 'off' : 'on'}`;
    soundBtn.addEventListener('click', () => {
      toggleMute();
      soundBtn.textContent = `♪ Sound: ${isMuted() ? 'off' : 'on'}`;
    });
  }
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) helpBtn.addEventListener('click', () => renderHelp(() => show()));
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => startDuel(seedFromQuery('')));
  const againBtn = document.getElementById('again-btn');
  if (againBtn) againBtn.addEventListener('click', () => startDuel(seedFromQuery('')));
  for (const card of document.querySelectorAll('.hand.yours .card')) {
    card.addEventListener('click', () => onPlayCard(Number(card.dataset.handIndex)));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPlayCard(Number(card.dataset.handIndex));
      }
    });
  }
}

function onPlayCard(handIndex) {
  if (shotMode || state.phase !== 'play' || state.active !== 0) return;
  if (!canPlay(state, 0, handIndex)) {
    sounds.click();
    return;
  }
  const events = playCard(state, 0, handIndex);
  if (events) show(events);
}

function onEndTurn() {
  if (shotMode || state.phase !== 'play' || state.active !== 0) return;
  const events = endTurn(state);
  show(events);
  if (state.phase === 'play' && state.active === 1) runAiTurn();
}

/** Mira's turn, one card at a time so the player sees what she does. */
function runAiTurn() {
  clearAiTimer();
  const step = () => {
    if (state.phase !== 'play' || state.active !== 1) return;
    const events = aiTakeStep(state, 1);
    show(events);
    if (state.phase === 'won') { sounds.win(); return; }
    if (state.phase === 'lost') { sounds.lose(); return; }
    if (state.active === 1) aiTimer = setTimeout(step, AI_STEP_MS);
  };
  aiTimer = setTimeout(step, AI_STEP_MS);
}

function startDuel(seed) {
  clearAiTimer();
  state = newGame(seed);
  shotMode = false;
  show();
}

function startShotScene(name, seed) {
  clearAiTimer();
  state = stageShot(name, seed);
  shotMode = true;
  show();
  if (name === 'title') renderTitle(() => {});
  if (state.phase === 'won') sounds.win();
  if (state.phase === 'lost') sounds.lose();
}

function onKey(event) {
  if (shotMode) return;
  if (event.key >= '1' && event.key <= '7') {
    onPlayCard(Number(event.key) - 1);
  } else if (event.key === 'Enter' && state && state.phase === 'play' && state.active === 0) {
    event.preventDefault();
    onEndTurn();
  }
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = seedFromQuery(window.location.search);
  document.addEventListener('keydown', onKey);
  if (shot) {
    // A screenshot is a still: freeze every entrance animation so the frame
    // is the finished table, not a card halfway through being dealt.
    document.documentElement.classList.add('no-anim');
    startShotScene(shot, seed);
    return;
  }
  state = newGame(seed);
  render(state);
  wireControls();
  renderTitle(() => {
    document.getElementById('overlay')?.remove();
    sounds.play();
    show();
  });
}

boot();
