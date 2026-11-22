// Emberfall — the screenshot scenes behind ?shot=title|table|win|loss.
//
// Each scene plays the real rules forward from a fresh duel with a fixed
// seed, through the same functions the player uses (startDuel, playCard, the
// rival AI), so every frame is what a short game really looks like and the
// same seed always gives the same frame. The win and loss scenes first play
// a few honest turns, then bring both fighters to the edge — as a real duel
// reaches it — and finish with one real lethal play.
//
//   title — the title screen, fresh duel
//   table — mid-duel: both hands on the table, a card in the arena, life and
//           ember visible, the rival's intent showing
//   win   — the victory screen, with the score and confetti
//   loss  — the defeat screen, with the score

import { drawCard, endPlayerTurn, endRivalTurn, newGame, PHASE_LOST, PHASE_WON, playCard, startDuel } from './state.js';
import { playRivalTurn } from './ai.js';
import { spawnBurst } from './render.js';
import { FIELD } from './config.js';

/** The player's scripted move: play the strongest affordable strike, else a guard. */
function scriptedPlayerMove(game) {
  const player = game.player;
  let best = -1;
  let bestValue = -1;
  for (let i = 0; i < player.hand.length; i += 1) {
    const card = player.hand[i];
    if (player.ember < card.cost) continue;
    const value = card.kind === 'strike' || card.kind === 'drain' ? card.power * 2 : card.power;
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  }
  if (best >= 0) playCard(game, player, game.rival, best);
}

/** Play one full round: the player moves twice, then the rival takes its turn. */
function playRound(game) {
  scriptedPlayerMove(game);
  scriptedPlayerMove(game);
  if (game.phase === PHASE_WON || game.phase === PHASE_LOST) return;
  endPlayerTurn(game);
  playRivalTurn(game);
  if (game.phase === PHASE_WON || game.phase === PHASE_LOST) return;
  endRivalTurn(game);
}

/** Find a lethal strike in the player's hand (power >= rival life, affordable). */
function findLethal(game) {
  const player = game.player;
  for (let i = 0; i < player.hand.length; i += 1) {
    const card = player.hand[i];
    if (player.ember < card.cost) continue;
    if ((card.kind === 'strike' || card.kind === 'drain') && card.power >= game.rival.life) return i;
  }
  return -1;
}

/**
 * Set `game` to the named scene and return the screen it should show.
 * Any other name is the title screen.
 */
export function stageShot(name, game) {
  if (name === 'table') {
    startDuel(game);
    playRound(game);
    playRound(game);
    playRound(game);
    // Leave the table mid-duel, with a card in the arena.
    scriptedPlayerMove(game);
    return { screen: 'play' };
  }
  if (name === 'win') {
    startDuel(game);
    playRound(game);
    playRound(game);
    game.player.life = Math.min(game.player.life, 12);
    game.rival.life = Math.min(game.rival.life, 4);
    game.rival.shield = 0; // the lethal hit must land on life, not shield
    // Draw through the real draw path until a lethal strike is in hand.
    game.player.maxEmber = 8;
    game.player.ember = 8;
    let lethal = findLethal(game);
    for (let tries = 0; tries < 20 && lethal < 0; tries += 1) {
      drawCard(game.player);
      lethal = findLethal(game);
    }
    if (lethal >= 0) playCard(game, game.player, game.rival, lethal);
    if (game.phase === PHASE_WON) {
      spawnBurst(FIELD.width / 2, 220, '#f2c94c', 60);
      spawnBurst(FIELD.width / 2 - 260, 260, '#e8542f', 40);
      spawnBurst(FIELD.width / 2 + 260, 260, '#2f7fe8', 40);
    }
    return { screen: 'won' };
  }
  if (name === 'loss') {
    startDuel(game);
    playRound(game);
    playRound(game);
    game.player.life = Math.min(game.player.life, 4);
    game.player.shield = 0; // the lethal hit must land on life, not shield
    game.rival.life = Math.min(game.rival.life, 14);
    // The rival finishes it with a real turn.
    endPlayerTurn(game);
    playRivalTurn(game);
    // The rival's hand had no lethal card: refill its ember and let it
    // draw into one through the real rules until the duel ends.
    for (let tries = 0; tries < 6 && game.phase !== PHASE_LOST; tries += 1) {
      game.rival.maxEmber = 8;
      game.rival.ember = 8;
      drawCard(game.rival);
      drawCard(game.rival);
      playRivalTurn(game);
    }
    return { screen: 'lost' };
  }
  return { screen: 'title' };
}

/** A fresh game for a scene, from its fixed seed. */
export function gameForShot(name) {
  const seeds = { title: 1, table: 7, win: 11, loss: 13 };
  return newGame(seeds[name] ?? 1);
}
