// Sound for Ember Court, synthesized with the Web Audio API: no audio files,
// nothing to download, just a few oscillators shaped into clicks and chimes.

let context = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function audio() {
  if (muted) return null;
  try {
    if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** One short tone: frequency, seconds, shape, and how loud. */
function tone(freq, seconds, type = 'sine', volume = 0.08, when = 0) {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

export const sounds = {
  click() { tone(660, 0.06, 'triangle', 0.05); },
  play() { tone(523, 0.09, 'triangle', 0.07); tone(784, 0.12, 'triangle', 0.06, 0.06); },
  summon() { tone(392, 0.12, 'sawtooth', 0.04); tone(587, 0.14, 'triangle', 0.06, 0.07); },
  hit() { tone(180, 0.16, 'sawtooth', 0.09); tone(120, 0.2, 'square', 0.05, 0.02); },
  heal() { tone(880, 0.14, 'sine', 0.06); tone(1174, 0.18, 'sine', 0.05, 0.08); },
  draw() { tone(740, 0.07, 'triangle', 0.05); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, i * 0.11)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, 'sine', 0.07, i * 0.13)); },
};

/** Play the sound a batch of engine events asks for. */
export function playEvents(events) {
  for (const event of events) {
    if (event.kind === 'played') sounds.play();
    if (event.kind === 'summon') sounds.summon();
    if (event.kind === 'damage' || event.kind === 'guardHit') sounds.hit();
    if (event.kind === 'heal') sounds.heal();
    if (event.kind === 'draw') sounds.draw();
  }
}
