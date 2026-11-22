// GILDED — The Midnight Vault Job: keyboard and mouse. WASD or arrows to
// move, Shift to sneak, click (or Space) to toss a coin at the cursor,
// J to fire the camera jammer, M to mute, R to restart, Enter to start.
import { WIDTH, HEIGHT } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    enter: false,
    restart: false,
    mute: false,
    clicked: false,
    jammer: false,
    clickAt: null,
  };
  let clickAt = null;

  const code = (e) => e.code;
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(code(e));
    if (e.code === 'Enter') state.enter = true;
    if (e.code === 'KeyR') state.restart = true;
    if (e.code === 'KeyM') state.mute = true;
    if (e.code === 'KeyJ') state.jammer = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(code(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    clickAt = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    state.clicked = true;
  });

  return {
    state,
    /** The movement vector and one-shot actions for this frame. */
    read() {
      let mx = 0;
      let my = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
      const out = {
        mx,
        my,
        sneak: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        throwAt: clickAt,
        jammer: state.jammer,
      };
      clickAt = null;
      return out;
    },
    clearFrame() {
      state.enter = false;
      state.restart = false;
      state.mute = false;
      state.clicked = false;
      state.jammer = false;
    },
  };
}
