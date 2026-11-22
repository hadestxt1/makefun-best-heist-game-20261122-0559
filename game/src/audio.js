// GILDED — The Midnight Vault Job: tiny WebAudio bleeps, synthesized on
// the spot — no audio files, no network. Sound starts only after a user
// gesture (the browser's rule), and M toggles it.

let ctx = null;
let muted = false;

export function unlockAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone(freq, dur, type = 'sine', gain = 0.08, slideTo = null) {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export function pickup() {
  tone(880, 0.09, 'sine', 0.07);
  setTimeout(() => tone(1318, 0.12, 'sine', 0.07), 70);
}

export function alarm() {
  tone(220, 0.5, 'sawtooth', 0.05, 440);
}

export function caught() {
  tone(392, 0.25, 'square', 0.06, 110);
}

export function win() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.07), i * 90));
}

export function throwCoin() {
  tone(1567, 0.08, 'sine', 0.06);
  setTimeout(() => tone(2093, 0.1, 'sine', 0.05), 60);
}

export function jammer() {
  tone(1200, 0.2, 'sawtooth', 0.05, 200);
}

export function laserTrip() {
  tone(180, 0.3, 'square', 0.07, 60);
}

export function switchOff() {
  tone(660, 0.1, 'sine', 0.06);
  setTimeout(() => tone(990, 0.12, 'sine', 0.06), 80);
}

export function footstep() {
  tone(140, 0.05, 'sine', 0.025);
}
