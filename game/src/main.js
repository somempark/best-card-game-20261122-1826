// Emberfall — the loop that ties the duel together.
//
// Boot: read ?shot= and ?seed= from the URL, stage a screenshot scene when
// one is asked for, and otherwise open on the title screen. The loop runs at
// the display's rate, advances the rival's animated turn one card at a time,
// flies a played card from the hand to the arena, and hands every frame to
// the renderer. Sound effects fire off the game's own event list.

import { FIELD, BEST_KEY, STEP } from './config.js';
import {
  endPlayerTurn, endRivalTurn, isOver, newGame, PHASE_LOST, PHASE_PLAY,
  PHASE_RIVAL, PHASE_TITLE, PHASE_WON, playCard, scoreOf, startDuel,
} from './state.js';
import { nextRivalPlay, rivalIntent } from './ai.js';
import { drawGame, spawnBurst, spawnFloater, addShake } from './render.js';
import { handleClick, handleKey, hoverIndex, toTableCoords } from './input.js';
import {
  clickSound, drawSound, ensureAudio, guardSound, hitSound, isMuted,
  loseSound, playCardSound, toggleMute, turnSound, winSound,
} from './audio.js';
import { gameForShot, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? '1') || 1;

let game = shotName ? gameForShot(shotName) : newGame(seed);
let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
} catch {
  best = 0;
}

/** The UI state the renderer reads each frame. */
const view = {
  selected: 0,
  hover: -1,
  flight: null,
  intent: null,
  best,
};

let rivalTimer = 0; // seconds until the rival plays its next card
let announcedOver = false;

if (shotName) {
  stageShot(shotName, game);
  // The staged turns already happened: their events must not fire sounds
  // and floating text over the finished frame.
  game.events.splice(0);
  if (game.phase === PHASE_WON) {
    view.best = Math.max(best, scoreOf(game).total);
    winSound();
  }
  if (game.phase === PHASE_LOST) loseSound();
}

function refreshIntent() {
  view.intent = game.phase === PHASE_PLAY ? rivalIntent(game) : null;
}

/** Keep the screen-reader status line in step with the table. */
function announce() {
  if (!status) return;
  const p = game.player;
  const r = game.rival;
  status.textContent =
    `Emberfall. Turn ${game.turn}. Your life ${p.life}, shield ${p.shield}, ember ${p.ember}. ` +
    `Rival life ${r.life}, shield ${r.shield}. Hand: ${p.hand.map((c) => c.name).join(', ')}.`;
}

function onDuelOver() {
  if (announcedOver) return;
  announcedOver = true;
  const score = scoreOf(game);
  if (game.phase === PHASE_WON) {
    view.best = Math.max(best, score.total);
    try {
      window.localStorage.setItem(BEST_KEY, String(view.best));
    } catch {
      // Private browsing may refuse storage; the score still shows.
    }
    winSound();
    spawnBurst(FIELD.width / 2, 200, '#f2c94c', 80);
    spawnBurst(FIELD.width / 2 - 300, 300, '#e8542f', 50);
    spawnBurst(FIELD.width / 2 + 300, 300, '#2f7fe8', 50);
  } else if (game.phase === PHASE_LOST) {
    loseSound();
  }
}

/** React to the game's own events: sounds, floaters and shake. */
function drainEvents() {
  for (const event of game.events.splice(0)) {
    if (event.type !== 'play') continue;
    const play = event.play;
    if (play.card.kind === 'strike' || play.card.kind === 'drain') {
      hitSound();
      addShake(7);
      const x = play.by === 'player' ? FIELD.width - 200 : 200;
      spawnFloater(x, 300, `-${play.dealt}`, '#ff5d73');
    } else if (play.card.kind === 'guard') {
      guardSound();
      const x = play.by === 'player' ? 200 : FIELD.width - 200;
      spawnFloater(x, 300, `+${play.gained}`, '#5db9ff');
    } else if (play.card.kind === 'surge') {
      drawSound();
    }
  }
}

/** The callbacks input.js calls into. */
const actions = {
  get selected() {
    return view.selected;
  },
  select(index) {
    view.selected = index;
    clickSound();
  },
  playCard(index) {
    if (game.phase !== PHASE_PLAY) return;
    const card = game.player.hand[index];
    if (!card || game.player.ember < card.cost) return;
    ensureAudio();
    // The flight starts where the card sits in the hand; find it there.
    const handCount = game.player.hand.length;
    const gap = Math.min(164, (FIELD.width - 96) / Math.max(1, handCount));
    const startX = (FIELD.width - gap * (handCount - 1) - 150) / 2;
    view.flight = {
      card,
      power: null,
      fromX: startX + index * gap,
      fromY: 470,
      toX: FIELD.width / 2 - 75,
      toY: 232,
      t: 0,
    };
    playCardSound();
    // Play it for real once the flight has had a moment to start.
    setTimeout(() => {
      const play = playCard(game, game.player, game.rival, index);
      if (play) {
        view.flight.power = play.power;
        if (view.selected >= game.player.hand.length) {
          view.selected = Math.max(0, game.player.hand.length - 1);
        }
      }
      refreshIntent();
      announce();
    }, 120);
  },
  endTurn() {
    if (game.phase !== PHASE_PLAY) return;
    ensureAudio();
    turnSound();
    endPlayerTurn(game);
    rivalTimer = 0.7;
    announce();
  },
  start() {
    ensureAudio();
    clickSound();
    startDuel(game);
    announcedOver = false;
    refreshIntent();
    announce();
  },
  again() {
    ensureAudio();
    clickSound();
    const freshSeed = (game.seed + 1) % 100000;
    game = newGame(freshSeed);
    view.flight = null;
    view.selected = 0;
    announcedOver = false;
    startDuel(game);
    refreshIntent();
    announce();
  },
  toTitle() {
    game = newGame(game.seed);
    view.flight = null;
    view.selected = 0;
    announcedOver = false;
    refreshIntent();
    announce();
  },
  toggleMute() {
    toggleMute();
  },
};

canvas.addEventListener('click', (event) => {
  ensureAudio();
  const point = toTableCoords(canvas, event);
  if (handleClick(game, point, actions)) clickSound();
});

canvas.addEventListener('mousemove', (event) => {
  const point = toTableCoords(canvas, event);
  const index = hoverIndex(point);
  if (index !== view.hover) {
    view.hover = index;
    if (index >= 0) view.selected = index;
  }
});

window.addEventListener('keydown', (event) => {
  if ([' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
  ensureAudio();
  handleKey(game, event.key, actions);
});

/** Fit the canvas to the window while keeping the 1280x720 table. */
function resize() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += dt;

  // The rival's turn, one card at a time, so each play can be seen.
  if (game.phase === PHASE_RIVAL) {
    rivalTimer -= dt;
    if (rivalTimer <= 0) {
      const play = nextRivalPlay(game);
      if (play) {
        rivalTimer = 0.85;
      } else {
        endRivalTurn(game);
        turnSound();
        refreshIntent();
      }
      announce();
    }
  }

  if (view.flight) {
    view.flight.t += dt / 0.45;
    if (view.flight.t >= 1) view.flight = null;
  }

  while (accumulator >= STEP) {
    accumulator -= STEP;
  }
  drainEvents();
  if (isOver(game)) onDuelOver();
  drawGame(ctx, game, view, dt);
  requestAnimationFrame(frame);
}

refreshIntent();
announce();
requestAnimationFrame(frame);
