// Seeded randomness for Ember Court: one small generator, so a game played from a
// seed (and every screenshot scene) comes out the same way every time.

/** mulberry32: a tiny deterministic PRNG. `seed` is any 32-bit integer. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Read a `seed` query value (or fall back to the clock) as a 32-bit integer. */
export function seedFromQuery(search) {
  const params = new URLSearchParams(search || '');
  const raw = Number(params.get('seed'));
  if (Number.isFinite(raw) && raw !== 0) return raw >>> 0;
  return (Date.now() % 2147483647) >>> 0;
}

/** Fisher-Yates shuffle of `array` in place, driven by `rng`. */
export function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Pick one element of `array` with `rng`. */
export function pick(array, rng) {
  return array[Math.floor(rng() * array.length)];
}
