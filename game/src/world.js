// GILDED — The Midnight Vault Job: the simulation. One fixed-step world
// per room: Rook the thief, patrolling guards with vision cones,
// sweeping security cameras, toggling laser banks, gold bars and the
// Star Diamond, a global alarm meter, and the getaway door. Everything
// is deterministic: the same inputs always play the same game (no
// Math.random, no wall clock; cameras and lasers run on the sim clock).

import {
  TILE, COLS, ROWS, HUD_H, STEP, PLAYER, GUARD, CAMERA, DETECT, LASER,
  COIN, SCORE, LIVES,
} from './config.js';
import { LEVELS } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_GAME_OVER = 'gameover';

export const EVENT_NONE = 0;
export const EVENT_LOOT = 1;
export const EVENT_ALARM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL_CLEAR = 8;
export const EVENT_COIN = 16;
export const EVENT_JAM = 32;
export const EVENT_LASER = 64;
export const EVENT_SWITCH = 128;

const tileCenter = (col, row) => ({ x: (col + 0.5) * TILE, y: HUD_H + (row + 0.5) * TILE });

function parseLevel(def) {
  const grid = [];
  const loot = [];
  const switches = [];
  let start = null;
  let exit = null;
  for (let r = 0; r < ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < COLS; c += 1) {
      const ch = def.map[r][c];
      if (ch === '#') row.push(1);
      else if (ch === 'c') row.push(2);
      else row.push(0);
      if (ch === 'P') start = tileCenter(c, r);
      if (ch === 'E') exit = { col: c, row, ...tileCenter(c, r) };
      if (ch === 'g') loot.push({ col: c, row, kind: 'gold', taken: false, ...tileCenter(c, r) });
      if (ch === 'D') loot.push({ col: c, row, kind: 'diamond', taken: false, ...tileCenter(c, r) });
      if (ch === 's') switches.push({ col: c, row, ...tileCenter(c, r) });
    }
    grid.push(row);
  }
  return { grid, loot, switches, start, exit };
}

function makeGuard(def, map) {
  const first = tileCenter(def.waypoints[0][0], def.waypoints[0][1]);
  const second = tileCenter(def.waypoints[1][0], def.waypoints[1][1]);
  return {
    x: first.x,
    y: first.y,
    angle: Math.atan2(second.y - first.y, second.x - first.x),
    waypoints: def.waypoints.map(([c, r]) => tileCenter(c, r)),
    wp: 1,
    pause: 0,
    state: 'patrol',
    suspicion: 0,
    investigate: null,
    searchTimer: 0,
    lastSeen: null,
    loseTimer: 0,
    moving: false,
  };
}

export function createWorld(levelIndex) {
  const def = LEVELS[levelIndex];
  const parsed = parseLevel(def);
  const world = {
    levelIndex,
    levelName: def.name,
    grid: parsed.grid,
    player: {
      x: parsed.start.x, y: parsed.start.y, angle: -Math.PI / 2,
      sneak: false, moving: false, stun: 0, stepSound: 0,
    },
    guards: def.guards.map((g) => makeGuard(g)),
    cameras: def.cameras.map((c) => ({
      ...tileCenter(c.col, c.row), base: c.base, angle: c.base,
      jamTimer: 0, sees: false,
    })),
    lasers: def.lasers.map((l) => ({
      ax: (l.a[0] + 0.5) * TILE, ay: HUD_H + (l.a[1] + 0.5) * TILE,
      bx: (l.b[0] + 0.5) * TILE, by: HUD_H + (l.b[1] + 0.5) * TILE,
      phase: l.phase, off: false, wasLiveInside: false,
    })),
    switches: parsed.switches.map((s, i) => ({ ...s, bank: def.switches[i]?.bank ?? 0, used: false })),
    loot: parsed.loot,
    exit: parsed.exit,
    alarm: 0,
    maxAlarm: 0,
    score: 0,
    scoreAtLevelStart: 0,
    lives: LIVES,
    coins: COIN.count,
    jammers: 2,
    noise: null,
    status: 'play',
    screen: SCREEN_PLAY,
    time: 0,
    levelTime: 0,
    caughtTimer: 0,
    best: null,
  };
  return world;
}

/** The tile at pixel (x, y): 1 wall, 2 crate, 0 floor (outside is wall). */
export function tileAt(world, x, y) {
  const c = Math.floor(x / TILE);
  const r = Math.floor((y - HUD_H) / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return 1;
  return world.grid[r][c];
}

const isSolid = (t) => t !== 0;

/** Whether a circle at (x, y) with radius r overlaps a solid tile. */
function collides(world, x, y, r) {
  const c0 = Math.floor((x - r) / TILE);
  const c1 = Math.floor((x + r) / TILE);
  const r0 = Math.floor((y - r - HUD_H) / TILE);
  const r1 = Math.floor((y + r - HUD_H) / TILE);
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
      if (!isSolid(world.grid[row][col])) continue;
      const nearestX = Math.max(col * TILE, Math.min(x, (col + 1) * TILE));
      const nearestY = Math.max(HUD_H + row * TILE, Math.min(y, HUD_H + (row + 1) * TILE));
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

/** Move an entity axis by axis so it slides along walls instead of sticking. */
function tryMove(world, e, dx, dy, radius) {
  let moved = false;
  if (dx !== 0 && !collides(world, e.x + dx, e.y, radius)) {
    e.x += dx;
    moved = true;
  }
  if (dy !== 0 && !collides(world, e.x, e.y + dy, radius)) {
    e.y += dy;
    moved = true;
  }
  return moved;
}

/** Line of sight between two points: no wall or crate tile in between. */
export function hasLOS(world, x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    if (isSolid(tileAt(world, x, y))) return false;
  }
  return true;
}

const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

const turnToward = (angle, target, maxTurn) => {
  const d = angleDiff(target, angle);
  if (Math.abs(d) <= maxTurn) return target;
  return angle + Math.sign(d) * maxTurn;
};

function detectionRate(dist, sneak) {
  const base = dist < DETECT.closeDist ? DETECT.close : dist < DETECT.midDist ? DETECT.mid : DETECT.far;
  return base * (sneak ? DETECT.sneakMul : 1);
}

/** Whether a guard's cone currently holds the thief. */
function guardSees(world, guard) {
  const p = world.player;
  const dx = p.x - guard.x;
  const dy = p.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.viewRange) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), guard.angle)) > GUARD.halfAngle) return false;
  return hasLOS(world, guard.x, guard.y, p.x, p.y);
}

function cameraSees(world, cam) {
  if (cam.jamTimer > 0) return false;
  const p = world.player;
  const dx = p.x - cam.x;
  const dy = p.y - cam.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA.viewRange) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), cam.angle)) > CAMERA.halfAngle) return false;
  return hasLOS(world, cam.x, cam.y, p.x, p.y);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function laserLive(laser, time) {
  if (laser.off) return false;
  const cycle = LASER.onTime + LASER.offTime;
  return ((time + laser.phase) % cycle) < LASER.onTime;
}

export function lootRemaining(world) {
  return world.loot.filter((l) => !l.taken).length;
}

export function maxDetection(world) {
  return world.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
}

export function isPlayerSeen(world) {
  return world.guards.some((g) => guardSees(world, g)) || world.cameras.some((c) => cameraSees(world, c));
}

function stepGuard(world, guard) {
  const p = world.player;
  const seen = guardSees(world, guard);
  if (seen) {
    const dist = Math.hypot(p.x - guard.x, p.y - guard.y);
    guard.suspicion = Math.min(100, guard.suspicion + detectionRate(dist, p.sneak) * STEP);
    guard.lastSeen = { x: p.x, y: p.y };
    guard.loseTimer = 0;
    if (guard.suspicion >= DETECT.alarmed || world.alarm >= DETECT.alarmed) guard.state = 'chase';
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - DETECT.decay * STEP);
    if (guard.state === 'chase') {
      guard.loseTimer += STEP;
      if (guard.loseTimer > GUARD.loseSight) {
        guard.state = 'search';
        guard.searchTimer = 0;
      }
    }
  }

  let speed = 0;
  let tx = null;
  let ty = null;
  if (guard.state === 'chase' && guard.lastSeen) {
    speed = GUARD.chase;
    tx = seen ? p.x : guard.lastSeen.x;
    ty = seen ? p.y : guard.lastSeen.y;
    if (!seen && Math.hypot(guard.x - tx, guard.y - ty) < 14) {
      guard.state = 'search';
      guard.searchTimer = 0;
    }
  } else if (guard.state === 'investigate' && world.noise) {
    speed = GUARD.investigate;
    tx = world.noise.x;
    ty = world.noise.y;
    if (Math.hypot(guard.x - tx, guard.y - ty) < 16) {
      guard.state = 'search';
      guard.searchTimer = 0;
    }
  } else if (guard.state === 'search') {
    guard.searchTimer += STEP;
    guard.angle += STEP * 1.6;
    if (guard.searchTimer > GUARD.searchTime) {
      guard.state = 'patrol';
      guard.investigate = null;
    }
  } else {
    // Patrol: walk to the next waypoint, wait there, then the next.
    const wp = guard.waypoints[guard.wp];
    if (guard.pause > 0) {
      guard.pause -= STEP;
    } else {
      speed = GUARD.patrol;
      tx = wp.x;
      ty = wp.y;
      if (Math.hypot(guard.x - tx, guard.y - ty) < 10) {
        guard.wp = (guard.wp + 1) % guard.waypoints.length;
        guard.pause = GUARD.pause;
      }
    }
  }

  guard.moving = false;
  if (speed > 0 && tx !== null) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      const want = Math.atan2(dy, dx);
      guard.angle = turnToward(guard.angle, want, 6 * STEP);
      guard.moving = tryMove(world, guard, (dx / len) * speed * STEP, (dy / len) * speed * STEP, GUARD.radius);
    }
  }

  // A guard that reaches the thief ends the run.
  if (Math.hypot(p.x - guard.x, p.y - guard.y) < PLAYER.radius + GUARD.radius - 2) {
    return true;
  }
  return false;
}

export function stepWorld(world, input) {
  if (world.status !== 'play') return EVENT_NONE;
  let events = EVENT_NONE;
  const p = world.player;
  world.time += STEP;
  world.levelTime += STEP;

  // --- the thief moves (stunned: no input counts) ---
  if (p.stun > 0) p.stun -= STEP;
  const len = Math.hypot(input.mx, input.my);
  p.moving = false;
  if (p.stun <= 0 && len > 0.01) {
    const speed = input.sneak ? PLAYER.sneak : PLAYER.walk;
    const nx = (input.mx / len) * speed * STEP;
    const ny = (input.my / len) * speed * STEP;
    p.moving = tryMove(world, p, nx, ny, PLAYER.radius);
    if (p.moving) p.angle = Math.atan2(ny, nx);
  }
  p.sneak = !!input.sneak;

  // --- a thrown coin clatters and pulls nearby guards over ---
  if (input.throwAt && world.coins > 0) {
    world.coins -= 1;
    world.noise = { x: input.throwAt.x, y: input.throwAt.y, timer: 6 };
    events |= EVENT_COIN;
    for (const g of world.guards) {
      if (Math.hypot(g.x - input.throwAt.x, g.y - input.throwAt.y) < COIN.hearRange) {
        g.state = 'investigate';
        g.suspicion = Math.max(g.suspicion, 20);
      }
    }
  }
  if (world.noise) {
    world.noise.timer -= STEP;
    if (world.noise.timer <= 0) world.noise = null;
  }

  // --- the jammer freezes every camera for a few seconds ---
  if (input.jammer && world.jammers > 0) {
    world.jammers -= 1;
    for (const cam of world.cameras) cam.jamTimer = CAMERA.jamSeconds;
    events |= EVENT_JAM;
  }
  for (const cam of world.cameras) {
    if (cam.jamTimer > 0) cam.jamTimer -= STEP;
    else cam.angle = cam.base + Math.sin(world.time * CAMERA.sweepSpeed) * CAMERA.sweepArc;
    cam.sees = cameraSees(world, cam);
  }

  // --- the alarm: guards and cameras fill it while they watch ---
  let seen = false;
  let rate = 0;
  for (const g of world.guards) {
    if (guardSees(world, g)) {
      seen = true;
      const dist = Math.hypot(p.x - g.x, p.y - g.y);
      rate = Math.max(rate, detectionRate(dist, p.sneak));
    }
  }
  for (const cam of world.cameras) {
    if (cam.sees) {
      seen = true;
      rate = Math.max(rate, CAMERA.alarmRate);
    }
  }
  const before = world.alarm;
  if (seen) world.alarm = Math.min(100, world.alarm + rate * STEP);
  else world.alarm = Math.max(0, world.alarm - DETECT.decay * STEP);
  if (before < DETECT.alarmed && world.alarm >= DETECT.alarmed) events |= EVENT_ALARM;
  world.maxAlarm = Math.max(world.maxAlarm, world.alarm);

  // --- lasers: crossing a live beam trips it ---
  for (const laser of world.lasers) {
    const live = laserLive(laser, world.time);
    const inside = distToSegment(p.x, p.y, laser.ax, laser.ay, laser.bx, laser.by) < PLAYER.radius + 4;
    if (live && inside && !laser.wasLiveInside) {
      world.alarm = Math.min(100, world.alarm + DETECT.laserTrip);
      world.maxAlarm = Math.max(world.maxAlarm, world.alarm);
      p.stun = PLAYER.laserStun;
      events |= EVENT_LASER;
      if (world.alarm >= DETECT.alarmed) events |= EVENT_ALARM;
    }
    laser.wasLiveInside = live && inside;
  }

  // --- a switch on the wall kills its laser bank for good ---
  for (const s of world.switches) {
    if (!s.used && Math.hypot(p.x - s.x, p.y - s.y) < TILE * 0.7) {
      s.used = true;
      const bank = world.lasers[s.bank];
      if (bank) bank.off = true;
      events |= EVENT_SWITCH;
    }
  }

  // --- loot ---
  for (const l of world.loot) {
    if (!l.taken && Math.hypot(p.x - l.x, p.y - l.y) < 22) {
      l.taken = true;
      world.score += l.kind === 'diamond' ? SCORE.diamond : SCORE.gold;
      events |= EVENT_LOOT;
    }
  }

  // --- the guards move, and one catching Rook ends the run ---
  let caught = false;
  for (const g of world.guards) {
    if (stepGuard(world, g)) caught = true;
  }

  // --- the getaway door, once every loot is pocketed ---
  if (!caught && lootRemaining(world) === 0) {
    const e = world.exit;
    if (Math.abs(p.x - e.x) < TILE * 0.7 && Math.abs(p.y - e.y) < TILE * 0.7) {
      const timeBonus = Math.max(0, SCORE.levelTimeBonus - Math.floor(world.levelTime) * SCORE.levelTimeRate);
      const clean = world.maxAlarm <= 50 ? SCORE.cleanBonus : 0;
      world.score += timeBonus + clean;
      world.status = world.levelIndex >= LEVELS.length - 1 ? 'win' : 'levelclear';
      world.caughtTimer = 0;
      events |= EVENT_LEVEL_CLEAR;
      return events;
    }
  }

  if (caught || world.alarm >= 100) {
    world.status = 'caught';
    world.caughtTimer = 0;
    events |= EVENT_CAUGHT;
  }
  return events;
}

/** Advance a caught / level-clear / win world by one step. */
export function stepCaught(world) {
  world.time += STEP;
  if (world.status === 'caught') {
    world.caughtTimer += STEP;
    if (world.caughtTimer < 1.2) return;
    world.lives -= 1;
    if (world.lives <= 0) {
      world.status = 'gameover';
      world.screen = SCREEN_GAME_OVER;
      return;
    }
    const fresh = createWorld(world.levelIndex);
    fresh.score = world.scoreAtLevelStart;
    fresh.scoreAtLevelStart = world.scoreAtLevelStart;
    fresh.lives = world.lives;
    fresh.best = world.best;
    fresh.alarm = 40;
    Object.assign(world, fresh);
    world.status = 'play';
    world.screen = SCREEN_PLAY;
    return;
  }
  if (world.status === 'levelclear') {
    world.caughtTimer += STEP;
    if (world.caughtTimer < 1.2) return;
    const next = createWorld(world.levelIndex + 1);
    next.score = world.score;
    next.scoreAtLevelStart = world.score;
    next.lives = world.lives;
    next.best = world.best;
    Object.assign(world, next);
    world.status = 'play';
    world.screen = SCREEN_PLAY;
    return;
  }
  if (world.status === 'win') {
    world.screen = SCREEN_WIN;
  }
}
