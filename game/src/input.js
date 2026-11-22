// Emberfall — mouse and keyboard.
//
// Click a card to play it (when you can afford it), click End Turn or press
// Space to hand the table over, use 1–5 to play from the keyboard, arrows to
// move the selection, Enter to start or play again, Esc for the title screen.
// All coordinates are converted from the window into the 1280x720 logical
// table, so the game plays the same at any window size.

import { FIELD } from './config.js';
import { LAYOUT } from './render.js';

/** Convert a mouse event into logical table coordinates. */
export function toTableCoords(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = FIELD.width / rect.width;
  const scaleY = FIELD.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function inside(point, rect) {
  return rect && point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

/**
 * Handle a click at logical `point`. `actions` is the set of callbacks the
 * game loop provides: playCard(index), endTurn(), start(), again(), toTitle().
 * Returns true when the click did something.
 */
export function handleClick(game, point, actions) {
  if (game.phase === 'title') {
    if (inside(point, LAYOUT.titleRect)) {
      actions.start();
      return true;
    }
    return false;
  }
  if (game.phase === 'won' || game.phase === 'lost') {
    if (inside(point, LAYOUT.againRect)) {
      actions.again();
      return true;
    }
    return false;
  }
  if (game.phase === 'play') {
    for (const rect of LAYOUT.handRects) {
      if (inside(point, rect)) {
        actions.playCard(rect.index);
        return true;
      }
    }
    if (inside(point, LAYOUT.endTurnRect)) {
      actions.endTurn();
      return true;
    }
  }
  return false;
}

/**
 * Handle a key press. `actions` adds select(index) and toggleMute() to the
 * click set. Returns true when the key did something.
 */
export function handleKey(game, key, actions) {
  const lower = key.toLowerCase();
  if (lower === 'm') {
    actions.toggleMute();
    return true;
  }
  if (game.phase === 'title') {
    if (key === 'Enter' || key === ' ') {
      actions.start();
      return true;
    }
    return false;
  }
  if (game.phase === 'won' || game.phase === 'lost') {
    if (key === 'Enter' || key === ' ') {
      actions.again();
      return true;
    }
    if (key === 'Escape') {
      actions.toTitle();
      return true;
    }
    return false;
  }
  if (game.phase === 'play') {
    if (key >= '1' && key <= '9') {
      const index = Number(key) - 1;
      if (index < game.player.hand.length) {
        actions.playCard(index);
        return true;
      }
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const dir = key === 'ArrowLeft' ? -1 : 1;
      const count = game.player.hand.length;
      if (count > 0) {
        const next = ((actions.selected ?? 0) + dir + count) % count;
        actions.select(next);
      }
      return true;
    }
    if (key === 'Enter' && actions.selected != null) {
      actions.playCard(actions.selected);
      return true;
    }
    if (key === ' ') {
      actions.endTurn();
      return true;
    }
    if (key === 'Escape') {
      actions.toTitle();
      return true;
    }
  }
  if (game.phase === 'rival' && key === 'Escape') {
    actions.toTitle();
    return true;
  }
  return false;
}

/** Find the hand card under a hover point, or -1. */
export function hoverIndex(point) {
  for (const rect of LAYOUT.handRects) {
    if (inside(point, rect)) return rect.index;
  }
  return -1;
}
