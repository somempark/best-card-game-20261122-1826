// Emberfall — the cards. Sixteen original cards in four elements.
//
// Kinds:
//   strike — deal `power` damage (the defender's shield absorbs it first)
//   guard  — gain `power` shield, which absorbs damage until your next turn
//   surge  — draw `power` cards from your deck
//   drain  — deal `power` damage and heal half of it, rounded down
//
// A card's art is a drawn glyph, not a picture file: each element has its own
// shape (flame, droplet, leaf, bolt) painted by render.js, so every card is
// self-contained and the game loads nothing from the network.

/**
 * All sixteen cards. `power` is the card's base value before combo bonuses.
 * Cost is the ember it takes to play; nothing costs more than 5, so a big
 * card is always a real decision against two small ones.
 */
export const CARDS = [
  { id: 'spark-imp', name: 'Spark Imp', element: 'ember', cost: 1, kind: 'strike', power: 3, text: 'Deal 3 damage.' },
  { id: 'cinder-fang', name: 'Cinder Fang', element: 'ember', cost: 2, kind: 'strike', power: 5, text: 'Deal 5 damage.' },
  { id: 'pyre-burst', name: 'Pyre Burst', element: 'ember', cost: 4, kind: 'strike', power: 9, text: 'Deal 9 damage.' },
  { id: 'ember-wisp', name: 'Ember Wisp', element: 'ember', cost: 2, kind: 'drain', power: 4, text: 'Deal 4 damage. Heal 2.' },
  { id: 'tide-lash', name: 'Tide Lash', element: 'tide', cost: 1, kind: 'strike', power: 2, text: 'Deal 2 damage.' },
  { id: 'deep-current', name: 'Deep Current', element: 'tide', cost: 2, kind: 'surge', power: 2, text: 'Draw 2 cards.' },
  { id: 'moonwell', name: 'Moonwell', element: 'tide', cost: 3, kind: 'guard', power: 7, text: 'Gain 7 shield.' },
  { id: 'riptide', name: 'Riptide', element: 'tide', cost: 3, kind: 'strike', power: 6, text: 'Deal 6 damage.' },
  { id: 'thorn-wall', name: 'Thorn Wall', element: 'thorn', cost: 1, kind: 'guard', power: 4, text: 'Gain 4 shield.' },
  { id: 'bramble-snare', name: 'Bramble Snare', element: 'thorn', cost: 2, kind: 'guard', power: 6, text: 'Gain 6 shield.' },
  { id: 'grove-warden', name: 'Grove Warden', element: 'thorn', cost: 3, kind: 'guard', power: 8, text: 'Gain 8 shield.' },
  { id: 'seedling-burst', name: 'Seedling Burst', element: 'thorn', cost: 2, kind: 'surge', power: 1, text: 'Draw 1 card.' },
  { id: 'storm-caller', name: 'Storm Caller', element: 'storm', cost: 2, kind: 'strike', power: 4, text: 'Deal 4 damage.' },
  { id: 'lightning-rod', name: 'Lightning Rod', element: 'storm', cost: 3, kind: 'strike', power: 7, text: 'Deal 7 damage.' },
  { id: 'thunderhead', name: 'Thunderhead', element: 'storm', cost: 5, kind: 'strike', power: 12, text: 'Deal 12 damage.' },
  { id: 'static-surge', name: 'Static Surge', element: 'storm', cost: 1, kind: 'surge', power: 1, text: 'Draw 1 card.' },
];

/** Look a card definition up by id. */
export function cardById(id) {
  return CARDS.find((card) => card.id === id) ?? null;
}

/**
 * A mulberry32 seeded random generator, so a screenshot scene (or a rematch)
 * can be replayed exactly from one number.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle a copy of `items` with the given rng (Fisher-Yates). */
export function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a 30-card deck: two copies of every card, minus the two most
 * expensive, so the deck leans fast and every duel feels different.
 */
export function buildDeck(rng) {
  const ids = [];
  for (const card of CARDS) ids.push(card.id, card.id);
  ids.splice(ids.indexOf('thunderhead'), 1);
  ids.splice(ids.indexOf('pyre-burst'), 1);
  return shuffle(ids, rng);
}

/** Human words for a card kind, shown on the card itself. */
export function kindLabel(kind) {
  return { strike: 'Strike', guard: 'Guard', surge: 'Surge', drain: 'Drain' }[kind] ?? kind;
}
