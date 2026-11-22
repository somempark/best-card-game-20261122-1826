// Emberfall — everything the player sees, drawn on one canvas.
//
// The table is a fixed 1280x720 logical area scaled to the window. Cards are
// drawn, not images: a rounded body, a big cost circle, the element's shape
// (flame, droplet, leaf, bolt) in its colour, a large power number and the
// card text — so a card stays readable when the screenshot shrinks to a
// thumbnail. The renderer also owns the layout input.js reads back: every
// clickable rect is written into LAYOUT as it is drawn.

import { ELEMENTS, FIELD, FONT, PALETTE } from './config.js';
import { effectivePower, scoreOf } from './state.js';
import { kindLabel } from './cards.js';

/** The clickable rects of the last frame, read by input.js. */
export const LAYOUT = {
  handRects: [],
  endTurnRect: null,
  playRect: null,
  titleRect: null,
  againRect: null,
  muteRect: null,
};

const CARD_W = 150;
const CARD_H = 210;
const MINI_W = 96;
const MINI_H = 134;

// ---- particles and floating text (confetti, damage numbers) ----

const particles = [];
const floaters = [];
let shake = 0;

/** Burst of confetti at (x, y) in `color`. */
export function spawnBurst(x, y, color, count = 26) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 520,
      vy: -Math.random() * 420 - 60,
      size: 4 + Math.random() * 6,
      color: Math.random() < 0.5 ? color : PALETTE.gold,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      life: 1.4 + Math.random() * 0.8,
    });
  }
}

/** Floating combat text that rises and fades. */
export function spawnFloater(x, y, text, color) {
  floaters.push({ x, y, text, color, life: 1.1 });
}

/** A short screen shake, in pixels. */
export function addShake(amount) {
  shake = Math.max(shake, amount);
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 900 * dt;
    p.rot += p.vr * dt;
    if (p.life <= 0 || p.y > FIELD.height + 20) particles.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i -= 1) {
    const f = floaters[i];
    f.life -= dt;
    f.y -= 46 * dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
  shake = Math.max(0, shake - dt * 26);
}

// ---- small drawing helpers ----

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw one element's shape, centred at (x, y), at size `s`. */
export function drawElementShape(ctx, shape, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x, y);
  if (shape === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.7, -s * 0.3, s * 0.55, s * 0.5, 0, s * 0.8);
    ctx.bezierCurveTo(-s * 0.55, s * 0.5, -s * 0.7, -s * 0.3, 0, -s);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.2);
    ctx.bezierCurveTo(s * 0.3, s * 0.1, s * 0.2, s * 0.5, 0, s * 0.55);
    ctx.bezierCurveTo(-s * 0.2, s * 0.5, -s * 0.3, s * 0.1, 0, -s * 0.2);
    ctx.fill();
  } else if (shape === 'droplet') {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.75, -s * 0.1, s * 0.7, s * 0.55, 0, s * 0.8);
    ctx.bezierCurveTo(-s * 0.7, s * 0.55, -s * 0.75, -s * 0.1, 0, -s);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    circle(ctx, -s * 0.25, s * 0.25, s * 0.16);
  } else if (shape === 'leaf') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.9);
    ctx.bezierCurveTo(s * 0.85, -s * 0.4, s * 0.7, s * 0.6, 0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.85, -s * 0.4, 0, -s * 0.9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(0, s * 0.75);
    ctx.stroke();
  } else {
    // bolt
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -s);
    ctx.lineTo(-s * 0.55, s * 0.15);
    ctx.lineTo(-s * 0.05, s * 0.15);
    ctx.lineTo(-s * 0.15, s);
    ctx.lineTo(s * 0.55, -s * 0.15);
    ctx.lineTo(s * 0.05, -s * 0.15);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function text(ctx, str, x, y, size, color, weight = 700, align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

// ---- cards ----

/**
 * Draw one card face-up at (x, y) with width `w` (height follows 7:10).
 * `power` overrides the printed power (combos included); `dim` greys the
 * card out when the player cannot afford it.
 */
export function drawCard(ctx, card, x, y, w, power = null, dim = false, selected = false) {
  const h = (w * 7) / 5;
  const el = ELEMENTS[card.element];
  const shown = power ?? card.power;
  ctx.save();
  if (dim) ctx.globalAlpha = 0.55;
  if (selected) {
    ctx.shadowColor = el.color;
    ctx.shadowBlur = 22;
  }
  roundRect(ctx, x, y, w, h, w * 0.07);
  ctx.fillStyle = '#f7f2e8';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = el.dark;
  ctx.stroke();
  // Element band across the top.
  ctx.save();
  roundRect(ctx, x, y, w, h * 0.26, w * 0.07);
  ctx.fillStyle = el.color;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = el.color;
  ctx.fillRect(x, y + h * 0.2, w, h * 0.06);
  // Cost: a big circle, top left.
  circle(ctx, x + w * 0.17, y + h * 0.13, w * 0.15);
  ctx.fillStyle = '#fff';
  circle(ctx, x + w * 0.17, y + h * 0.13, w * 0.15);
  text(ctx, String(card.cost), x + w * 0.17, y + h * 0.13 + 1, w * 0.24, '#20142e', 800);
  // Element shape, top right.
  drawElementShape(ctx, el.shape, x + w * 0.83, y + h * 0.13, w * 0.11, '#fff');
  // Big element glyph in the middle.
  drawElementShape(ctx, el.shape, x + w / 2, y + h * 0.46, w * 0.2, el.color);
  // Name.
  text(ctx, card.name, x + w / 2, y + h * 0.66, Math.max(11, w * 0.1), '#20142e', 800);
  // Power: the number that matters, large.
  text(ctx, String(shown), x + w / 2, y + h * 0.8, w * 0.26, el.dark, 800);
  text(ctx, kindLabel(card.kind), x + w / 2, y + h * 0.9, Math.max(10, w * 0.085), '#5a4a6e', 700);
  // Effect text, small, at the foot.
  ctx.fillStyle = '#5a4a6e';
  ctx.font = `600 ${Math.max(9, w * 0.07)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.text, x + w / 2, y + h * 0.97, w * 0.92);
  ctx.restore();
}

/** Draw a face-down card back (the rival's hand). */
function drawCardBack(ctx, x, y, w, color = '#6b4fa1') {
  const h = (w * 7) / 5;
  roundRect(ctx, x, y, w, h, w * 0.07);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  roundRect(ctx, x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.76, w * 0.05);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.stroke();
  drawElementShape(ctx, 'flame', x + w / 2, y + h / 2, w * 0.18, 'rgba(255,255,255,0.75)');
}

// ---- heads-up display ----

function drawLifeBar(ctx, x, y, fighter, align = 'left') {
  const w = 210;
  const ox = align === 'right' ? x - w : x;
  text(ctx, fighter.name.toUpperCase(), ox + (align === 'right' ? w : 0), y - 16, 15, PALETTE.text, 800, align === 'right' ? 'right' : 'left');
  // Life hearts as a bar with a number: readable at a glance.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, ox, y, w, 26, 13);
  ctx.fill();
  const frac = Math.max(0, fighter.life / fighter.maxLife);
  ctx.fillStyle = PALETTE.life;
  if (frac > 0) {
    roundRect(ctx, ox + 3, y + 3, (w - 6) * frac, 20, 10);
    ctx.fill();
  }
  text(ctx, `♥ ${fighter.life} / ${fighter.maxLife}`, ox + w / 2, y + 14, 15, '#fff', 800);
  if (fighter.shield > 0) {
    ctx.fillStyle = PALETTE.shield;
    roundRect(ctx, ox + w + 10, y, 64, 26, 13);
    ctx.fill();
    text(ctx, `🛡 ${fighter.shield}`, ox + w + 42, y + 14, 14, '#fff', 800);
  }
}

function drawEmber(ctx, x, y, fighter) {
  text(ctx, 'EMBER', x, y - 14, 13, PALETTE.muted, 800, 'left');
  for (let i = 0; i < fighter.maxEmber; i += 1) {
    const cx = x + 14 + i * 30;
    drawElementShape(ctx, 'flame', cx, y + 12, 11, i < fighter.ember ? PALETTE.ember : '#3a2b52');
  }
  text(ctx, `${fighter.ember}/${fighter.maxEmber}`, x + 14 + fighter.maxEmber * 30 + 8, y + 12, 15, PALETTE.text, 800, 'left');
}

function drawButton(ctx, rect, label, enabled = true) {
  ctx.save();
  if (!enabled) ctx.globalAlpha = 0.45;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fillStyle = PALETTE.button;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.buttonEdge;
  ctx.stroke();
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, 18, '#fff', 800);
  ctx.restore();
}

// ---- screens ----

function drawBackdrop(ctx) {
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.table;
  roundRect(ctx, 24, 24, FIELD.width - 48, FIELD.height - 48, 28);
  ctx.fill();
  ctx.strokeStyle = PALETTE.tableEdge;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawTitle(ctx, game, view) {
  drawBackdrop(ctx);
  // Four element glyphs in a row above the title.
  const shapes = ['flame', 'droplet', 'leaf', 'bolt'];
  const colors = ['#e8542f', '#2f7fe8', '#3da35d', '#e8b92f'];
  shapes.forEach((shape, i) => {
    drawElementShape(ctx, shape, 480 + i * 80, 150, 30, colors[i]);
  });
  text(ctx, 'EMBERFALL', FIELD.width / 2, 250, 92, PALETTE.text, 900);
  text(ctx, 'A duel of ember, tide, thorn and storm', FIELD.width / 2, 312, 24, PALETTE.gold, 600);
  text(ctx, 'Outplay the rival. Chain your elements. Take all 20 life.', FIELD.width / 2, 348, 18, PALETTE.muted, 600);
  // How to play, in three short lines.
  const rules = [
    'Play cards with ember — it refills every turn.',
    'Same element twice in a turn: +2 Resonance. Rising costs: +1 Chain.',
    'Read the rival’s intent, guard the big hits, and strike for lethal.',
  ];
  rules.forEach((line, i) => text(ctx, line, FIELD.width / 2, 420 + i * 30, 17, PALETTE.text, 600));
  // Big start button.
  const rect = { x: FIELD.width / 2 - 160, y: 520, w: 320, h: 64 };
  LAYOUT.titleRect = rect;
  drawButton(ctx, rect, '▶  START DUEL  (Enter)', true);
  text(ctx, 'Mouse or keyboard: 1–5 play a card · Space ends the turn', FIELD.width / 2, 620, 15, PALETTE.muted, 600);
  const best = view.best ?? 0;
  if (best > 0) text(ctx, `Best score: ${best}`, FIELD.width / 2, 652, 15, PALETTE.gold, 700);
}

function drawTable(ctx, game, view) {
  drawBackdrop(ctx);
  const player = game.player;
  const rival = game.rival;

  // Rival: name + life top left, hand face-down top centre, deck top right.
  drawLifeBar(ctx, 48, 52, rival, 'left');
  const rivalHandW = 54;
  const rivalTotal = rival.hand.length * (rivalHandW + 6);
  rival.hand.forEach((_, i) => {
    drawCardBack(ctx, FIELD.width / 2 - rivalTotal / 2 + i * (rivalHandW + 6), 44, rivalHandW, '#5b3f8c');
  });
  text(ctx, `RIVAL HAND ${rival.hand.length}`, FIELD.width / 2, 150, 12, PALETTE.muted, 700);
  text(ctx, `Deck ${rival.deck.length}`, FIELD.width - 48, 60, 15, PALETTE.muted, 700, 'right');
  text(ctx, `Turn ${game.turn}`, FIELD.width - 48, 84, 15, PALETTE.muted, 700, 'right');

  // Rival intent: the card it plans to open with, so the player can answer it.
  if (game.phase === 'play' && view.intent) {
    const intent = view.intent;
    const el = ELEMENTS[intent.element];
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, FIELD.width / 2 - 190, 168, 380, 34, 17);
    ctx.fill();
    drawElementShape(ctx, el.shape, FIELD.width / 2 - 158, 185, 10, el.color);
    text(ctx, `Rival plots: ${intent.name}  ·  ${intent.cost} ember  ·  ${intent.power} ${kindLabel(intent.kind).toLowerCase()}`, FIELD.width / 2 + 8, 186, 15, '#fff', 700);
  }

  // The arena: the last card played, large, in the middle.
  const last = game.lastPlay;
  if (last) {
    const cx = FIELD.width / 2 - 75;
    const cy = 232;
    const who = last.by === 'player' ? 'YOU PLAYED' : 'RIVAL PLAYED';
    text(ctx, who, FIELD.width / 2, cy - 14, 13, PALETTE.muted, 800);
    drawCard(ctx, last.card, cx, cy, 150, last.power);
    if (last.bonuses.length > 0) {
      const label = last.bonuses.map((b) => `+${b.amount} ${b.name}`).join('  ');
      text(ctx, label, FIELD.width / 2, cy + 228, 15, PALETTE.gold, 800);
    }
    // Damage, healing and shield, right beside the card that caused them.
    // (Hidden on the end screens, where the overlay carries the result.)
    if (game.phase === 'play' || game.phase === 'rival') {
      if (last.dealt > 0) text(ctx, `-${last.dealt}`, cx + 178, cy + 90, 34, PALETTE.life, 900, 'left');
      if (last.healed > 0) text(ctx, `+${last.healed}`, cx - 28, cy + 90, 26, '#7be495', 800, 'right');
      if (last.gained > 0 && last.card.kind === 'guard') text(ctx, `+${last.gained} shield`, cx + 178, cy + 90, 22, PALETTE.shield, 800, 'left');
    }
  } else {
    text(ctx, 'No card played yet — your move.', FIELD.width / 2, 330, 18, PALETTE.muted, 600);
  }

  // Player: life bottom left, ember bottom centre-left, End Turn bottom right.
  drawLifeBar(ctx, 48, 452, player, 'left');
  drawEmber(ctx, 48, 512, player);
  text(ctx, `Deck ${player.deck.length}  ·  Discard ${player.discard.length}`, 48, 556, 14, PALETTE.muted, 700, 'left');
  const endRect = { x: FIELD.width - 208, y: 448, w: 160, h: 52 };
  LAYOUT.endTurnRect = endRect;
  drawButton(ctx, endRect, game.phase === 'play' ? 'END TURN ⏎' : 'RIVAL…', game.phase === 'play');
  text(ctx, 'Space ends the turn', FIELD.width - 128, 516, 13, PALETTE.muted, 600);

  // Player hand, fanned along the bottom.
  const n = player.hand.length;
  const gap = Math.min(CARD_W + 14, (FIELD.width - 96) / Math.max(1, n));
  const startX = (FIELD.width - gap * (n - 1) - CARD_W) / 2;
  LAYOUT.handRects = [];
  player.hand.forEach((card, i) => {
    const lift = view.selected === i ? -26 : view.hover === i ? -12 : 0;
    const x = startX + i * gap;
    const y = 470 + lift;
    const affordable = player.ember >= card.cost && game.phase === 'play';
    drawCard(ctx, card, x, y, CARD_W, effectivePower(player, card), !affordable, view.selected === i);
    LAYOUT.handRects.push({ x, y, w: CARD_W, h: CARD_H, index: i });
  });

  // The flying card, mid-animation, above everything else.
  if (view.flight) {
    const f = view.flight;
    const t = Math.min(1, f.t);
    const eased = 1 - (1 - t) * (1 - t);
    const x = f.fromX + (f.toX - f.fromX) * eased;
    const y = f.fromY + (f.toY - f.fromY) * eased - Math.sin(t * Math.PI) * 60;
    drawCard(ctx, f.card, x, y, CARD_W * (1 - t * 0.25), f.power);
  }

  // The duel log, one line, bottom centre.
  const lastLog = game.log[game.log.length - 1] ?? '';
  text(ctx, lastLog, FIELD.width / 2, 700, 14, PALETTE.muted, 600);
}

function drawEndScreen(ctx, game, view, won) {
  drawTable(ctx, game, view);
  ctx.fillStyle = won ? 'rgba(16,32,12,0.9)' : 'rgba(32,10,14,0.9)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const score = scoreOf(game);
  if (won) {
    text(ctx, '★  VICTORY  ★', FIELD.width / 2, 210, 84, PALETTE.gold, 900);
    text(ctx, 'The rift is yours — the rival’s embers fade to ash.', FIELD.width / 2, 272, 22, PALETTE.text, 600);
  } else {
    text(ctx, 'DEFEAT', FIELD.width / 2, 210, 84, PALETTE.life, 900);
    text(ctx, 'Your embers fade… the rival holds the table.', FIELD.width / 2, 272, 22, PALETTE.text, 600);
  }
  const lines = [
    `Damage dealt: ${score.damage}`,
    `Cards played: ${score.cards}`,
    `Turns taken: ${score.turns}`,
    `Score: ${score.total}`,
  ];
  lines.forEach((line, i) => text(ctx, line, FIELD.width / 2, 340 + i * 34, 22, PALETTE.text, 700));
  const rect = { x: FIELD.width / 2 - 160, y: 520, w: 320, h: 64 };
  LAYOUT.againRect = rect;
  drawButton(ctx, rect, '↻  PLAY AGAIN  (Enter)', true);
  if (won && view.best > 0) text(ctx, `Best score: ${view.best}`, FIELD.width / 2, 620, 16, PALETTE.gold, 700);
}

/** Draw one frame. `view` carries the UI state (selection, flight, intent). */
export function drawGame(ctx, game, view, dt) {
  updateEffects(dt);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  LAYOUT.handRects = [];
  LAYOUT.endTurnRect = null;
  LAYOUT.titleRect = null;
  LAYOUT.againRect = null;
  if (game.phase === 'title') drawTitle(ctx, game, view);
  else if (game.phase === 'won') drawEndScreen(ctx, game, view, true);
  else if (game.phase === 'lost') drawEndScreen(ctx, game, view, false);
  else drawTable(ctx, game, view);
  // Floating combat text and confetti, above the table.
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    text(ctx, f.text, f.x, f.y, 30, f.color, 900);
  }
  ctx.globalAlpha = 1;
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }
  ctx.restore();
}
