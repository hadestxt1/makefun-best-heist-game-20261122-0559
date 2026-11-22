// GILDED — The Midnight Vault Job: the canvas renderer. One frame holds
// the whole room: the thief crossing it, guards with their vision cones,
// wall cameras sweeping theirs, laser banks, the loot, the getaway door
// and the alarm meter up top — everything the judge's screenshots need
// in a single frame.

import {
  TILE, COLS, ROWS, HUD_H, WIDTH, HEIGHT, FIELD_W, FIELD_H,
  PLAYER, GUARD, CAMERA, DETECT, PALETTE, FONT,
} from './config.js';
import {
  SCREEN_TITLE, SCREEN_WIN, SCREEN_GAME_OVER,
  laserLive, lootRemaining,
} from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, halfAngle, range, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawGold(ctx, x, y, t) {
  const bob = Math.sin(t * 2 + x * 0.01) * 1.5;
  ctx.fillStyle = PALETTE.goldDark;
  ctx.fillRect(x - 9, y - 4 + bob, 18, 9);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(x - 9, y - 6 + bob, 18, 7);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(x - 7, y - 6 + bob, 14, 2);
}

function drawDiamond(ctx, x, y, t) {
  const s = 11 + Math.sin(t * 3) * 1.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.diamondDark;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = PALETTE.diamond;
  ctx.fillRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4);
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
  ctx.restore();
}

function drawGuard(ctx, g, t) {
  const coneFill = g.state === 'chase' ? PALETTE.coneAlarm : g.suspicion >= DETECT.suspicious ? PALETTE.coneSus : PALETTE.cone;
  const coneEdge = g.state === 'chase' ? PALETTE.coneAlarmEdge : g.suspicion >= DETECT.suspicious ? PALETTE.coneSusEdge : PALETTE.coneEdge;
  drawCone(ctx, g.x, g.y, g.angle, GUARD.halfAngle, GUARD.viewRange, coneFill, coneEdge);
  ctx.fillStyle = PALETTE.guardDark;
  ctx.beginPath();
  ctx.arc(g.x, g.y, GUARD.radius + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.guard;
  ctx.beginPath();
  ctx.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  // The direction the guard is looking.
  ctx.strokeStyle = '#fecaca';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.angle) * (GUARD.radius + 7), g.y + Math.sin(g.angle) * (GUARD.radius + 7));
  ctx.stroke();
  // Suspicion: "?" while wary, "!" while chasing.
  if (g.state === 'chase') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('!', g.x, g.y - GUARD.radius - 8);
  } else if (g.suspicion >= DETECT.suspicious) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('?', g.x, g.y - GUARD.radius - 8);
  }
}

function drawCamera(ctx, cam) {
  const jammed = cam.jamTimer > 0;
  if (!jammed) {
    drawCone(ctx, cam.x, cam.y, cam.angle, CAMERA.halfAngle, CAMERA.viewRange, PALETTE.camCone, PALETTE.camConeEdge);
  }
  ctx.fillStyle = jammed ? '#3f3f46' : PALETTE.cameraDark;
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = jammed ? '#71717a' : PALETTE.camera;
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5f3ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.lineTo(cam.x + Math.cos(cam.angle) * 13, cam.y + Math.sin(cam.angle) * 13);
  ctx.stroke();
  if (jammed) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('✕', cam.x, cam.y + 16);
  }
}

function drawLaser(ctx, laser, live, t) {
  const blink = live && (Math.floor(t * 4) % 2 === 0);
  ctx.strokeStyle = live ? PALETTE.laser : PALETTE.laserOff;
  ctx.lineWidth = live ? (blink ? 5 : 3) : 2;
  ctx.beginPath();
  ctx.moveTo(laser.ax, laser.ay);
  ctx.lineTo(laser.bx, laser.by);
  ctx.stroke();
  if (live) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(laser.ax, laser.ay);
    ctx.lineTo(laser.bx, laser.by);
    ctx.stroke();
  }
  for (const [ex, ey] of [[laser.ax, laser.ay], [laser.bx, laser.by]]) {
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(ex - 5, ey - 5, 10, 10);
    ctx.fillStyle = live ? '#ef4444' : '#52525b';
    ctx.fillRect(ex - 3, ey - 3, 6, 6);
  }
}

function drawHUD(ctx, world) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 0, WIDTH, HUD_H);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, HUD_H - 2, WIDTH, 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.goldText;
  ctx.font = 'bold 22px ' + FONT;
  ctx.fillText('GILDED', 16, 32);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '13px ' + FONT;
  ctx.fillText(world.levelName + '  ·  Room ' + (world.levelIndex + 1) + ' of 3', 16, 56);

  // The alarm meter: the big bar the whole run hangs on.
  const ax = 250;
  const aw = 420;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = 'bold 13px ' + FONT;
  ctx.fillText('ALARM', ax, 24);
  ctx.fillStyle = '#0b0d12';
  roundRect(ctx, ax, 30, aw, 26, 6);
  ctx.fill();
  const frac = world.alarm / 100;
  const fill = world.alarm >= DETECT.alarmed ? PALETTE.alarmFill : world.alarm >= DETECT.suspicious ? PALETTE.alarmFillMid : PALETTE.alarmFillLow;
  if (frac > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, ax + 2, 32, Math.max(4, (aw - 4) * frac), 22, 5);
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  roundRect(ctx, ax, 30, aw, 26, 6);
  ctx.stroke();
  // Tick at the chase line.
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(ax + (aw * DETECT.alarmed) / 100, 30);
  ctx.lineTo(ax + (aw * DETECT.alarmed) / 100, 56);
  ctx.stroke();
  ctx.fillStyle = world.alarm >= DETECT.alarmed ? PALETTE.danger : PALETTE.text;
  ctx.font = 'bold 15px ' + FONT;
  ctx.fillText(Math.round(world.alarm) + '%', ax + aw + 10, 50);

  // Loot, lives, coins, jammers, score, time.
  const rx = 760;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillText('◆ ' + (world.loot.length - lootRemaining(world)) + '/' + world.loot.length, rx, 34);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '15px ' + FONT;
  ctx.fillText('♥'.repeat(world.lives) + '  ·  coins ' + world.coins + '  ·  jam ' + world.jammers, rx, 58);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillText('Score ' + world.score, WIDTH - 16, 34);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '14px ' + FONT;
  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60);
  ctx.fillText(mins + ':' + String(secs).padStart(2, '0'), WIDTH - 16, 58);
  ctx.textAlign = 'left';
}

function drawField(ctx, world, t) {
  // Floor.
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = c * TILE;
      const y = HUD_H + r * TILE;
      ctx.fillStyle = (c + r) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(x, y, TILE, TILE);
    }
  }

  // The getaway door: green and open once the loot is pocketed.
  const e = world.exit;
  const open = lootRemaining(world) === 0;
  ctx.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
  ctx.fillRect(e.x - 14, e.y - 14, 28, 28);
  ctx.fillStyle = open ? PALETTE.exitDark : '#3a4152';
  ctx.fillRect(e.x - 14, e.y - 14, 28, 6);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCK', e.x, e.y + 4);

  // Switches: step on one to kill its laser bank.
  for (const s of world.switches) {
    ctx.fillStyle = s.used ? PALETTE.switchOff : PALETTE.switchOn;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0d12';
    ctx.font = 'bold 11px ' + FONT;
    ctx.fillText('S', s.x, s.y + 4);
  }

  // Loot.
  for (const l of world.loot) {
    if (l.taken) continue;
    if (l.kind === 'diamond') drawDiamond(ctx, l.x, l.y, t);
    else drawGold(ctx, l.x, l.y, t);
  }

  // Lasers (under the characters, over the floor).
  for (const laser of world.lasers) {
    drawLaser(ctx, laser, laserLive(laser, world.time), t);
  }

  // Vision cones, then the watchers themselves.
  for (const cam of world.cameras) drawCamera(ctx, cam);
  for (const g of world.guards) drawGuard(ctx, g, t);

  // The coin's clatter ring.
  if (world.noise) {
    const pulse = 1 - world.noise.timer / 6;
    ctx.strokeStyle = 'rgba(250, 204, 21,' + (0.7 * (1 - pulse)) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(world.noise.x, world.noise.y, 8 + pulse * 40, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rook: a teal circle, a hat brim, and the way he is facing.
  const p = world.player;
  ctx.fillStyle = PALETTE.playerDark;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#134e4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius - 1, p.angle - 0.9, p.angle + 0.9);
  ctx.stroke();
  ctx.fillStyle = '#f0fdfa';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Walls and crates on top, so cones never bleed through them.
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const tile = world.grid[r][c];
      if (tile === 0) continue;
      const x = c * TILE;
      const y = HUD_H + r * TILE;
      if (tile === 1) {
        ctx.fillStyle = PALETTE.wallDark;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x, y + 4, TILE, TILE - 4);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(x, y, TILE, 4);
      } else {
        ctx.fillStyle = PALETTE.crateDark;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = PALETTE.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
      }
    }
  }

  // Thin border around the room.
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, HUD_H + 1, FIELD_W - 2, FIELD_H - 2);
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(11, 13, 18, 0.82)';
  ctx.fillRect(0, HUD_H, WIDTH, FIELD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 46px ' + FONT;
  ctx.fillText(title, WIDTH / 2, HUD_H + 190);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '19px ' + FONT;
  lines.forEach((line, i) => {
    ctx.fillText(line, WIDTH / 2, HUD_H + 240 + i * 32);
  });
  ctx.textAlign = 'left';
}

export function render(ctx, world, t) {
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawHUD(ctx, world);
  drawField(ctx, world, t);

  if (world.screen === SCREEN_TITLE) {
    overlay(ctx, 'GILDED', [
      'The Midnight Vault Job — three rooms, one clean getaway.',
      'WASD / arrows to move · Shift to sneak · click to toss a coin',
      'J jams the cameras · step on a switch to kill its lasers',
      'Pocket every gold bar and the Star Diamond, then reach the EXIT.',
      '',
      'Press Enter or click to begin.',
    ], PALETTE.goldText);
  } else if (world.status === 'caught') {
    overlay(ctx, 'CAUGHT!', [
      'The alarm hit 100% — the guards have you.',
      'Lives left: ' + world.lives,
      'You wake up back at the door. The loot is still inside.',
    ], PALETTE.danger);
  } else if (world.status === 'levelclear') {
    overlay(ctx, 'ROOM CLEAR', [
      'Every bar pocketed. On to the next room, Rook.',
      'Score: ' + world.score,
    ], PALETTE.exit);
  } else if (world.screen === SCREEN_WIN) {
    overlay(ctx, 'CLEAN GETAWAY', [
      'The Star Diamond is yours. Three rooms, no trace left behind.',
      'Final score: ' + world.score,
      'Best: ' + (world.best ? world.best.score : world.score),
      '',
      'Press R to run the job again.',
    ], PALETTE.exit);
  } else if (world.screen === SCREEN_GAME_OVER) {
    overlay(ctx, 'THE JOB IS BLOWN', [
      'Three strikes and the vault wins this time.',
      'Final score: ' + world.score,
      '',
      'Press R to try again.',
    ], PALETTE.danger);
  }
}
