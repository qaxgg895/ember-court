// Card data for Ember Court: every card the game can deal, and the four suits.
// A card is plain data; the engine turns it into a hand card or a board guardian.
// Suits are told apart by colour, shape and word, never by text alone.

export const SUITS = {
  ember: { name: 'Ember', color: '#ff6b4a', dark: '#a8321f', glyph: '▲', blurb: 'fire that flies over the board' },
  thorn: { name: 'Thorn', color: '#7bc96f', dark: '#2f6b2a', glyph: '◆', blurb: 'guardians that hold the line' },
  tide: { name: 'Tide', color: '#5aa9e6', dark: '#1f4e79', glyph: '●', blurb: 'water that mends and reveals' },
  star: { name: 'Star', color: '#f2c14e', dark: '#8a6d1f', glyph: '✦', blurb: 'light that kindles and rallies' },
};

/**
 * Card catalogue. Fields:
 *  id, name, suit, type ('guardian' | 'strike' | 'charm'), cost (ember),
 *  atk / hp for guardians, amount for strikes (damage) and charms, text, effect.
 *  effect is one of: 'damage' | 'heal' | 'draw' | 'ember' | 'buff' | 'healOnPlay'.
 */
export const CARDS = [
  { id: 'cinder-pup', name: 'Cinder Pup', suit: 'thorn', type: 'guardian', cost: 1, atk: 2, hp: 2, text: 'A small ember hound, quick to bite.' },
  { id: 'mothwing-scout', name: 'Mothwing Scout', suit: 'thorn', type: 'guardian', cost: 2, atk: 3, hp: 2, text: 'It reads the wind before the battle does.' },
  { id: 'lantern-wisp', name: 'Lantern Wisp', suit: 'star', type: 'guardian', cost: 2, atk: 1, hp: 3, effect: 'healOnPlay', amount: 2, text: 'When played: restore 2 life.' },
  { id: 'thorn-warden', name: 'Thorn Warden', suit: 'thorn', type: 'guardian', cost: 3, atk: 2, hp: 5, text: 'Roots deep. Hits back harder.' },
  { id: 'ashen-golem', name: 'Ashen Golem', suit: 'thorn', type: 'guardian', cost: 4, atk: 3, hp: 6, text: 'Slow, grey, and almost unmovable.' },
  { id: 'ember-drake', name: 'Ember Drake', suit: 'ember', type: 'guardian', cost: 5, atk: 5, hp: 4, text: 'It does not guard the court. It owns it.' },
  { id: 'spark', name: 'Spark', suit: 'ember', type: 'strike', cost: 1, amount: 2, effect: 'damage', text: 'Deal 2 damage to the rival keeper.' },
  { id: 'ember-burst', name: 'Ember Burst', suit: 'ember', type: 'strike', cost: 3, amount: 4, effect: 'damage', text: 'Deal 4 damage to the rival keeper.' },
  { id: 'comet-fall', name: 'Comet Fall', suit: 'ember', type: 'strike', cost: 5, amount: 6, effect: 'damage', text: 'Deal 6 damage to the rival keeper.' },
  { id: 'warm-hearth', name: 'Warm Hearth', suit: 'tide', type: 'charm', cost: 2, amount: 5, effect: 'heal', text: 'Restore 5 life.' },
  { id: 'deep-breath', name: 'Deep Breath', suit: 'tide', type: 'charm', cost: 1, amount: 2, effect: 'draw', text: 'Draw 2 cards.' },
  { id: 'kindle', name: 'Kindle', suit: 'star', type: 'charm', cost: 1, amount: 2, effect: 'ember', text: 'Gain 2 ember this turn.' },
  { id: 'banner-of-embers', name: 'Banner of Embers', suit: 'star', type: 'charm', cost: 3, amount: 1, effect: 'buff', text: 'Your guardians gain +1/+1.' },
];

/** A fresh copy of a catalogue card, as it sits in a hand or a deck. */
export function makeCard(id) {
  const def = CARDS.find((c) => c.id === id);
  if (!def) throw new Error(`unknown card ${id}`);
  return { ...def, hp: def.hp ?? null, maxHp: def.hp ?? null, uid: 0 };
}

/** The 26-card deck: two copies of every catalogue card. */
export function buildDeck() {
  const deck = [];
  for (const card of CARDS) deck.push(makeCard(card.id), makeCard(card.id));
  return deck;
}
