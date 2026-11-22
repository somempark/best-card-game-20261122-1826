// Emberfall — the rival's mind.
//
// The rival is deliberately readable: every turn it shows the card it plans
// to open with (its "intent"), so the player can answer it — guard against a
// big strike, race a slow rival, or hold a surge for the turn after. The AI
// itself is a small set of rules, no hidden dice: it strikes when you are
// weak, guards when it is weak, and otherwise plays the best value it can
// afford, preferring a combo when one is on the table.

import { effectivePower, playCard } from './state.js';

/**
 * Score one possible play. Higher is better. The weights below are the whole
 * of the rival's personality: finish a low-life player, protect a low-life
 * self, and never waste ember on a draw when a strike would land.
 */
function scorePlay(game, rival, card, index) {
  const power = effectivePower(rival, card);
  const player = game.player;
  let score = 0;
  if (card.kind === 'strike' || card.kind === 'drain') {
    score = power * 2;
    if (player.life <= power) score += 100; // lethal — take it
    if (player.life <= 8) score += power; // press a wounded player
    if (card.kind === 'drain' && rival.life < rival.maxLife - 4) score += 4;
  } else if (card.kind === 'guard') {
    score = power;
    if (rival.life <= 8) score += power * 2; // guard hard when hurt
    if (player.life <= 6) score -= power; // ...unless the player is nearly done
  } else if (card.kind === 'surge') {
    score = rival.hand.length <= 2 ? 8 : 2; // draw when the hand is thin
    if (player.life <= power + 3) score -= 6;
  }
  // A combo on the table is worth chasing: a resonance or chain bonus.
  const bonus = power - card.power;
  score += bonus * 3;
  // Prefer cheaper cards when two plays are close, so ember is not wasted.
  score -= card.cost * 0.5;
  return { score, index };
}

/** The rival's best play right now, or null when it cannot afford anything.
 * `ember` overrides the rival's current ember: the intent banner asks what
 * the rival will open with next turn, when its ember has refilled. */
export function bestPlay(game, ember = null) {
  const rival = game.rival;
  const available = ember ?? rival.ember;
  let best = null;
  for (let i = 0; i < rival.hand.length; i += 1) {
    const card = rival.hand[i];
    if (available < card.cost) continue;
    const scored = scorePlay(game, rival, card, i);
    if (!best || scored.score > best.score) best = scored;
  }
  return best;
}

/**
 * The card the rival plans to open with on its next turn, for the intent
 * banner. It is computed from the rival's current hand and next turn's
 * ember, so what the player reads is what the rival will actually try to do.
 */
export function rivalIntent(game) {
  const nextEmber = Math.min(game.turn + 1, 8);
  const pick = bestPlay(game, nextEmber);
  if (!pick) return null;
  return game.rival.hand[pick.index];
}

/**
 * Play the rival's whole turn at once (used by the screenshot scenes and by
 * the animated turn in main.js, which calls it one card at a time instead).
 * Returns the plays made, in order.
 */
export function playRivalTurn(game) {
  const plays = [];
  for (let guard = 0; guard < 12; guard += 1) {
    const pick = bestPlay(game);
    if (!pick) break;
    const play = playCard(game, game.rival, game.player, pick.index);
    if (!play) break;
    plays.push(play);
    if (game.phase !== 'rival') break; // the duel ended mid-turn
  }
  return plays;
}

/** The rival's next single play, for the animated turn. Null when it is done. */
export function nextRivalPlay(game) {
  const pick = bestPlay(game);
  if (!pick) return null;
  return playCard(game, game.rival, game.player, pick.index);
}
