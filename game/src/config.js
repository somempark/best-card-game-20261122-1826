// Emberfall — every tuning number and colour in one place.
// The table is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Life each duelist starts with. */
export const START_LIFE = 20;

/** Cards drawn at the start, and cards drawn at the start of each turn. */
export const START_HAND = 4;
export const DRAW_PER_TURN = 1;

/** Highest ember (mana) a turn can grant; ember refills every turn. */
export const MAX_EMBER = 8;

/** Turns after which a duel that somehow never ends is called a draw. */
export const MAX_TURNS = 40;

/**
 * The four elements. Each one is told apart by colour AND by its drawn shape
 * (flame, droplet, leaf, bolt), never by text alone, so a card stays readable
 * when the screenshot shrinks to a thumbnail.
 */
export const ELEMENTS = {
  ember: { name: 'Ember', color: '#e8542f', dark: '#8f2a12', light: '#ffb199', shape: 'flame' },
  tide: { name: 'Tide', color: '#2f7fe8', dark: '#144a94', light: '#a8ccf7', shape: 'droplet' },
  thorn: { name: 'Thorn', color: '#3da35d', dark: '#1d5c31', light: '#a9dcb8', shape: 'leaf' },
  storm: { name: 'Storm', color: '#e8b92f', dark: '#8a6a0c', light: '#f7e3a1', shape: 'bolt' },
};

/** Combo bonuses: resonance for a repeated element, chain for rising costs. */
export const COMBO = {
  resonanceBonus: 2, // second (or later) card of one element in a turn gains +2 power
  chainBonus: 1, // a card costlier than the last card played this turn gains +1 power
};

/** Where the best result is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';

export const PALETTE = {
  backdrop: '#14101d',
  table: '#241a33',
  tableEdge: '#3a2b52',
  felt: '#2c2140',
  panel: '#1d1529',
  panelEdge: '#4a3566',
  text: '#f4eefc',
  muted: '#a99cc4',
  gold: '#f2c94c',
  life: '#ff5d73',
  shield: '#5db9ff',
  ember: '#ff8a3d',
  button: '#6b4fa1',
  buttonEdge: '#9b7fd4',
  danger: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
