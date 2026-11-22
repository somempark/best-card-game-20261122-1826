// Emberfall — sound, synthesized live with WebAudio.
//
// No audio files ship with the game: every effect is a short oscillator
// phrase built here, so the game still loads nothing over the network. The
// context is created on the first user gesture (browsers demand that) and
// every call is guarded, so a browser without audio simply plays silent.

let context = null;
let muted = false;

/** Create (or reuse) the audio context. Safe to call before any gesture. */
export function ensureAudio() {
  if (context) return context;
  try {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  } catch {
    context = null;
  }
  return context;
}

/** Toggle sound on or off; returns the new state. */
export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

/** One note: an oscillator that slides from `from` Hz to `to` Hz. */
function note(from, to, seconds, type = 'sine', volume = 0.12, delay = 0) {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  } catch {
    // A browser that refuses audio plays silent; the game goes on.
  }
}

/** A card snapping onto the table. */
export function playCardSound() {
  note(520, 340, 0.09, 'triangle', 0.14);
  note(780, 620, 0.07, 'sine', 0.08, 0.04);
}

/** A hit landing: a low thud. */
export function hitSound() {
  note(180, 60, 0.18, 'sawtooth', 0.16);
}

/** A shield rising: a soft chime. */
export function guardSound() {
  note(420, 640, 0.16, 'sine', 0.1);
  note(640, 880, 0.14, 'sine', 0.07, 0.08);
}

/** Drawing cards: a quick paper flick. */
export function drawSound() {
  note(900, 1200, 0.06, 'triangle', 0.06);
}

/** The turn changing hands. */
export function turnSound() {
  note(330, 330, 0.08, 'sine', 0.09);
  note(440, 440, 0.08, 'sine', 0.09, 0.09);
}

/** Victory: a rising fanfare. */
export function winSound() {
  [523, 659, 784, 1047].forEach((freq, i) => note(freq, freq, 0.22, 'triangle', 0.12, i * 0.12));
}

/** Defeat: a falling phrase. */
export function loseSound() {
  [392, 330, 262, 196].forEach((freq, i) => note(freq, freq * 0.9, 0.25, 'sine', 0.1, i * 0.14));
}

/** A click on a button or the title screen. */
export function clickSound() {
  note(660, 660, 0.05, 'sine', 0.07);
}
