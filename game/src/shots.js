// GILDED — The Midnight Vault Job: the staged scenes behind
// ?shot=title|play|alarm|win. Each one plays the real rules forward from
// a fresh world for a fixed number of steps, steered by a simple
// autopilot (sneak toward the next waypoint; hold still while the alarm
// is high and nobody is watching, so it decays), so the frame is what a
// real game looks like and the same seed always gives the same frame.
// Nothing here is drawn by hand: the screenshots are renders of the
// game itself.

import { STEP, TILE, HUD_H, LASER } from './config.js';
import {
  createWorld, stepWorld, stepCaught,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN,
} from './world.js';
import { LEVELS } from './levels.js';

const SAMPLE = STEP;

/** Distance from a point to a segment (the laser beam). */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Whether a laser bank is live at sim time `t` (same cycle as world.js). */
function laserLiveAt(laser, t) {
  if (laser.off) return false;
  const cycle = LASER.onTime + LASER.offTime;
  return ((t + laser.phase) % cycle) < LASER.onTime;
}

/** Pixel centre of a tile. */
function tileCenter(col, row) {
  return { x: (col + 0.5) * TILE, y: HUD_H + (row + 0.5) * TILE };
}

/**
 * Sneak Rook along `waypoints` (tile [col, row] pairs). Holds still while
 * the alarm is high but no watcher currently sees him, so it decays;
 * keeps moving while seen, since standing in a cone only lets the alarm
 * climb. Waits out a live laser instead of walking into it, and
 * sidesteps a guard that wanders too close to bump into. Returns
 * { ok, steps, reason }.
 */
export function drive(world, waypoints, maxSeconds = 400) {
  let wp = 0;
  let steps = 0;
  const maxSteps = Math.floor(maxSeconds / SAMPLE);
  while (wp < waypoints.length && steps < maxSteps) {
    if (world.status !== 'play') {
      return { ok: world.status === 'levelclear' || world.status === 'win', reason: world.status, wp, steps };
    }
    const target = tileCenter(waypoints[wp][0], waypoints[wp][1]);
    const dx = target.x - world.player.x;
    const dy = target.y - world.player.y;
    if (Math.hypot(dx, dy) < 10) {
      wp += 1;
      continue;
    }
    // Wait out a hot alarm in cover; never wait while watched. A chasing
    // guard is faster than a sneak, so run at full speed when hunted.
    const watched = world.guards.some((g) => {
      const ddx = world.player.x - g.x;
      const ddy = world.player.y - g.y;
      return Math.hypot(ddx, ddy) < 200;
    });
    const chased = world.guards.some((g) => g.state === 'chase');
    let input = { mx: 0, my: 0, sneak: true, throwAt: null, jammer: false };
    // A guard about to bump into Rook: step away from it, fast.
    let nearest = null;
    let nearestDist = Infinity;
    for (const g of world.guards) {
      const d = Math.hypot(world.player.x - g.x, world.player.y - g.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = g;
      }
    }
    if (nearest && nearest.state !== 'chase' && nearestDist < 48) {
      const ax = world.player.x - nearest.x;
      const ay = world.player.y - nearest.y;
      const len = Math.hypot(ax, ay) || 1;
      input = { mx: ax / len, my: ay / len, sneak: false, throwAt: null, jammer: false };
      stepWorld(world, input);
      steps += 1;
      continue;
    }
    // A live laser just ahead: wait for the dark half of its cycle.
    let beamHot = false;
    for (const laser of world.lasers) {
      if (laser.off) continue;
      const d = distToSegment(world.player.x, world.player.y, laser.ax, laser.ay, laser.bx, laser.by);
      if (d < 70 && laserLiveAt(laser, world.time)) {
        beamHot = true;
        break;
      }
    }
    if (beamHot) {
      stepWorld(world, input);
      steps += 1;
      continue;
    }
    // Wait out a hot alarm in cover; never wait while watched, and never
    // wait while a guard is hunting — a chaser closes in while you stand.
    if (world.alarm <= 40 || watched || chased) {
      const len = Math.hypot(dx, dy);
      input = { mx: dx / len, my: dy / len, sneak: !chased, throwAt: null, jammer: false };
    }
    stepWorld(world, input);
    steps += 1;
  }
  return { ok: wp >= waypoints.length, reason: wp >= waypoints.length ? 'done' : 'timeout', wp, steps };
}

/** Step the world with no input for `seconds`. */
export function idle(world, seconds, sneak = true) {
  const n = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < n; i += 1) {
    if (world.status !== 'play') break;
    stepWorld(world, { mx: 0, my: 0, sneak, throwAt: null, jammer: false });
  }
}

/** Step with a fixed movement direction for `seconds`. */
export function moveFor(world, mx, my, seconds, sneak = false) {
  const n = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < n; i += 1) {
    if (world.status !== 'play') break;
    stepWorld(world, { mx, my, sneak, throwAt: null, jammer: false });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * title: the title card over a live lobby. play: mid-sneak, two gold
 * bars pocketed, a guard's cone sweeping close by. alarm: Rook caught
 * in a camera's sweep, the meter climbing past halfway. win: all three
 * rooms cleared for real, the Star Diamond pocketed.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    const r = drive(world, [[1, 18], [6, 14], [5, 4], [12, 4]]);
    if (!r.ok) return { screen: SCREEN_PLAY, note: `play route failed: ${r.reason} at wp ${r.wp}` };
    moveFor(world, 1, 0, 1.0, true);
    return { screen: SCREEN_PLAY, note: `play staged in ${r.steps} steps` };
  }
  if (name === 'alarm') {
    const r = drive(world, [[1, 18], [6, 14], [5, 4], [20, 4]]);
    if (!r.ok) return { screen: SCREEN_PLAY, note: `alarm route failed: ${r.reason} at wp ${r.wp}` };
    // Stand under the lobby camera and wait for its sweep to find Rook.
    for (let i = 0; i < 60 * 25 && world.status === 'play'; i += 1) {
      if (world.alarm >= 55) break;
      stepWorld(world, { mx: 0, my: 0, sneak: false, throwAt: null, jammer: false });
    }
    return { screen: SCREEN_PLAY, note: `alarm staged, alarm ${Math.round(world.alarm)}%` };
  }
  if (name === 'win') {
    for (let level = 0; level < LEVELS.length; level += 1) {
      const r = drive(world, LEVELS[level].route);
      if (!r.ok) return { screen: SCREEN_PLAY, note: `win route failed level ${level + 1}: ${r.reason} at wp ${r.wp}` };
      if (world.status !== 'levelclear' && world.status !== 'win') {
        return { screen: SCREEN_PLAY, note: `win route ended level ${level + 1} as ${world.status}` };
      }
      if (world.status === 'win') return { screen: SCREEN_WIN, note: `win staged, score ${world.score}` };
      let waited = 0;
      while (world.status === 'levelclear' && waited < 300) {
        stepCaught(world);
        waited += 1;
      }
      if (world.status !== 'play') return { screen: SCREEN_PLAY, note: `level ${level + 1} did not advance (${world.status})` };
    }
    return { screen: SCREEN_PLAY, note: 'win route ended without a win' };
  }
  idle(world, 4, false);
  return { screen: SCREEN_TITLE, note: 'title staged' };
}
