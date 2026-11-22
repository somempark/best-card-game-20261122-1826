// Emberfall — the duel itself: state, turns, combos and damage.
//
// A duel is two fighters (player and rival), each with life, shield, ember,
// a deck, a hand and a discard pile. Turns alternate; on your turn your ember
// refills to the turn number (capped), you draw a card, and you may play as
// many cards as your ember allows. Playing ends nothing by itself — you press
// End Turn, the rival takes its turn, and the next turn begins.
//
// Combos make every hand a decision:
//   Resonance — the second (or later) card of one element in a turn gains +2.
//   Rising Chain — a card costlier than the last card played gains +1.
// Both bonuses show on the card as it is played, so the player learns them.

import { COMBO, DRAW_PER_TURN, MAX_EMBER, MAX_TURNS, START_HAND, START_LIFE } from './config.js';
import { buildDeck, cardById, makeRng } from './cards.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_RIVAL = 'rival';
export const PHASE_WON = 'won';
export const PHASE_LOST = 'lost';

/** One side of the duel. */
function makeFighter(name, deck) {
  return {
    name,
    life: START_LIFE,
    maxLife: START_LIFE,
    shield: 0,
    ember: 0,
    maxEmber: 0,
    deck,
    hand: [],
    discard: [],
    playedThisTurn: [], // card ids, in play order, for the combo rules
    damageDealt: 0,
    cardsPlayed: 0,
  };
}

/** A fresh duel, shuffled from `seed`. */
export function newGame(seed = 1) {
  const rng = makeRng(seed);
  const game = {
    seed,
    rng,
    phase: PHASE_TITLE,
    turn: 1,
    winner: null,
    log: [],
    player: makeFighter('You', buildDeck(rng)),
    rival: makeFighter('Rival', buildDeck(rng)),
    lastPlay: null, // { by: 'player' | 'rival', card, power, bonuses } — the arena shows it
    floaters: [], // floating combat text, filled by the renderer through events
    events: [], // one-frame notices the renderer and sound can react to
  };
  for (let i = 0; i < START_HAND; i += 1) drawCard(game.player);
  for (let i = 0; i < START_HAND; i += 1) drawCard(game.rival);
  return game;
}

/** Move the top card of a fighter's deck into their hand (reshuffle discards when empty). */
export function drawCard(fighter) {
  if (fighter.deck.length === 0) {
    if (fighter.discard.length === 0) return null;
    fighter.deck = fighter.discard;
    fighter.discard = [];
    // A plain reverse is a fair reshuffle for a reshuffled discard pile.
    fighter.deck.reverse();
  }
  const id = fighter.deck.pop();
  const card = cardById(id);
  if (card) fighter.hand.push(card);
  return card;
}

/** Start a fighter's turn: clear old shield, refill ember, draw a card. */
export function startTurn(game, fighter) {
  fighter.shield = 0;
  fighter.playedThisTurn = [];
  fighter.maxEmber = Math.min(game.turn, MAX_EMBER);
  fighter.ember = fighter.maxEmber;
  drawCard(fighter);
}

/** Begin the duel from the title screen. */
export function startDuel(game) {
  game.phase = PHASE_PLAY;
  game.turn = 1;
  startTurn(game, game.player);
  game.log.push('The duel begins — your move.');
}

/**
 * The combo bonus for `card` when played by `fighter` right now:
 * +2 when an earlier card this turn shares its element, +1 when it costs
 * more than the last card played. Returns the bonuses found, each named.
 */
export function comboBonuses(fighter, card) {
  const bonuses = [];
  const played = fighter.playedThisTurn.map((id) => cardById(id));
  if (played.some((c) => c && c.element === card.element)) {
    bonuses.push({ name: 'Resonance', amount: COMBO.resonanceBonus });
  }
  const last = played[played.length - 1];
  if (last && card.cost > last.cost) {
    bonuses.push({ name: 'Rising Chain', amount: COMBO.chainBonus });
  }
  return bonuses;
}

/** The power a card has when played right now, combos included. */
export function effectivePower(fighter, card) {
  return card.power + comboBonuses(fighter, card).reduce((sum, b) => sum + b.amount, 0);
}

/** Can `fighter` afford and play the card at `handIndex` right now? */
export function canPlay(game, fighter, handIndex) {
  if (game.phase !== PHASE_PLAY && game.phase !== PHASE_RIVAL) return false;
  const card = fighter.hand[handIndex];
  return Boolean(card) && fighter.ember >= card.cost;
}

/** Deal `amount` damage to `defender`, shield absorbing first. Returns life lost. */
export function dealDamage(game, defender, amount) {
  let rest = amount;
  if (defender.shield > 0) {
    const absorbed = Math.min(defender.shield, rest);
    defender.shield -= absorbed;
    rest -= absorbed;
  }
  const lost = Math.min(defender.life, rest);
  defender.life -= lost;
  if (defender.life <= 0) {
    defender.life = 0;
    game.winner = defender === game.player ? 'rival' : 'player';
    game.phase = game.winner === 'player' ? PHASE_WON : PHASE_LOST;
  }
  return lost;
}

/** Heal a fighter, never above their maximum life. */
export function heal(fighter, amount) {
  fighter.life = Math.min(fighter.maxLife, fighter.life + amount);
}

/**
 * Play the card at `handIndex` for `fighter` against `opponent`.
 * Returns the play record, or null when the card cannot be played.
 * The record carries the bonuses so the renderer can show them.
 */
export function playCard(game, fighter, opponent, handIndex) {
  const card = fighter.hand[handIndex];
  if (!card || fighter.ember < card.cost) return null;
  const bonuses = comboBonuses(fighter, card);
  const power = card.power + bonuses.reduce((sum, b) => sum + b.amount, 0);
  fighter.ember -= card.cost;
  fighter.hand.splice(handIndex, 1);
  fighter.discard.push(card.id);
  fighter.playedThisTurn.push(card.id);
  fighter.cardsPlayed += 1;

  let dealt = 0;
  let healed = 0;
  let gained = 0;
  if (card.kind === 'strike' || card.kind === 'drain') {
    dealt = dealDamage(game, opponent, power);
    fighter.damageDealt += dealt;
    if (card.kind === 'drain') {
      healed = Math.floor(power / 2);
      heal(fighter, healed);
    }
  } else if (card.kind === 'guard') {
    fighter.shield += power;
    gained = power;
  } else if (card.kind === 'surge') {
    for (let i = 0; i < power; i += 1) drawCard(fighter);
    gained = power;
  }
  const play = {
    by: fighter === game.player ? 'player' : 'rival',
    card,
    power,
    bonuses,
    dealt,
    healed,
    gained,
  };
  game.lastPlay = play;
  game.events.push({ type: 'play', play });
  game.log.push(fighter === game.player ? `You play ${card.name} (${power}).` : `Rival plays ${card.name} (${power}).`);
  if (game.phase === PHASE_WON || game.phase === PHASE_LOST) {
    game.log.push(game.winner === 'player' ? 'You win the duel!' : 'The rival wins the duel.');
  }
  return play;
}

/** End the player's turn and hand the table to the rival. */
export function endPlayerTurn(game) {
  if (game.phase !== PHASE_PLAY) return false;
  game.phase = PHASE_RIVAL;
  startTurn(game, game.rival);
  game.log.push('Rival’s turn.');
  return true;
}

/** Finish the rival's turn and start the player's next turn. */
export function endRivalTurn(game) {
  if (game.phase !== PHASE_RIVAL) return false;
  game.turn += 1;
  if (game.turn > MAX_TURNS) {
    game.winner = game.player.life >= game.rival.life ? 'player' : 'rival';
    game.phase = game.winner === 'player' ? PHASE_WON : PHASE_LOST;
    return true;
  }
  game.phase = PHASE_PLAY;
  startTurn(game, game.player);
  game.log.push(`Turn ${game.turn} — your move.`);
  return true;
}

/** Is the duel over? */
export function isOver(game) {
  return game.phase === PHASE_WON || game.phase === PHASE_LOST;
}

/** The duel's score: damage dealt, cards played and turns taken. */
export function scoreOf(game) {
  const p = game.player;
  return {
    damage: p.damageDealt,
    cards: p.cardsPlayed,
    turns: game.turn,
    total: p.damageDealt * 10 + p.cardsPlayed * 5 + Math.max(0, (MAX_TURNS - game.turn)) * 2,
  };
}
