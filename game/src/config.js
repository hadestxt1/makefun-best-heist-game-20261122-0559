// GILDED — The Midnight Vault Job: every tuning number and colour in one
// place. The playfield is a fixed 1280x720 logical area; the renderer
// scales it to the window, so no rule below depends on the screen size.
export const TILE = 32;
export const COLS = 40;
export const ROWS = 20;
export const HUD_H = 80;
export const WIDTH = 1280;
export const HEIGHT = 720;
export const FIELD_W = COLS * TILE;
export const FIELD_H = ROWS * TILE;

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 11,
  walk: 140,
  sneak: 66,
  /** Seconds the thief is stunned after tripping a live laser. */
  laserStun: 0.6,
};

export const GUARD = {
  radius: 12,
  patrol: 62,
  chase: 124,
  investigate: 98,
  /** How far a guard can see, in pixels. */
  viewRange: 195,
  /** Half of the vision cone's angle. */
  halfAngle: 0.6,
  /** Seconds a guard waits at each patrol waypoint. */
  pause: 1.5,
  /** Seconds of lost sight before a chasing guard gives up and searches. */
  loseSight: 4,
  /** Seconds a guard looks around a last-seen spot before going back. */
  searchTime: 3,
};

export const CAMERA = {
  /** How far a camera can see, in pixels. */
  viewRange: 210,
  /** Half of the vision cone's angle. */
  halfAngle: 0.5,
  /** Alarm fill per second while a camera watches the thief. */
  alarmRate: 42,
  /** Radians per second the camera head sweeps. */
  sweepSpeed: 0.55,
  /** How far the head swings from its base angle, in radians. */
  sweepArc: 1.0,
  /** Seconds a jammer freezes every camera. */
  jamSeconds: 6,
};

/** Alarm fill rates, per second, while a guard watches the thief. */
export const DETECT = {
  close: 55,
  mid: 30,
  far: 16,
  /** Distance under which the "close" rate applies. */
  closeDist: 70,
  /** Distance under which the "mid" rate applies. */
  midDist: 130,
  /** Alarm decay per second while nobody sees the thief. */
  decay: 9,
  /** Alarm at which a guard stops and stares ("?"). */
  suspicious: 45,
  /** Alarm at which guards give chase ("!"). */
  alarmed: 65,
  sneakMul: 0.55,
  runMul: 1.5,
  /** One live laser trip adds this much alarm at once. */
  laserTrip: 35,
};

export const LASER = {
  /** Seconds a bank stays live, then dark, in its cycle. */
  onTime: 2.2,
  offTime: 1.6,
};

export const COIN = {
  /** How far a thrown coin's clatter carries, in pixels. */
  noiseRadius: 170,
  /** How far a guard will walk to investigate a coin. */
  hearRange: 340,
  count: 4,
};

export const SCORE = {
  gold: 100,
  diamond: 300,
  levelTimeBonus: 300,
  levelTimeRate: 2,
  /** Bonus for clearing a level without the alarm ever passing 50. */
  cleanBonus: 250,
};

export const LIVES = 3;

export const PALETTE = {
  backdrop: '#0b0d12',
  floorA: '#262b38',
  floorB: '#222634',
  floorLine: '#313747',
  carpet: '#3a2430',
  carpetLine: '#4a2f3e',
  wall: '#454e63',
  wallTop: '#6a7590',
  wallDark: '#2a2f3e',
  crate: '#6b4f2a',
  crateEdge: '#8a6a3c',
  crateDark: '#4a3519',
  vaultDoor: '#8a6a2a',
  vaultDoorDark: '#5c4718',
  exit: '#39d98a',
  exitDark: '#1d7a4c',
  exitLocked: '#5c6675',
  gold: '#f2c94c',
  goldDark: '#a8842a',
  diamond: '#7dd3fc',
  diamondDark: '#0369a1',
  player: '#2dd4bf',
  playerDark: '#0f766e',
  guard: '#f87171',
  guardDark: '#7f1d1d',
  camera: '#c084fc',
  cameraDark: '#6b21a8',
  laser: 'rgba(239, 68, 68, 0.85)',
  laserOff: 'rgba(239, 68, 68, 0.12)',
  cone: 'rgba(250, 204, 21, 0.20)',
  coneEdge: 'rgba(250, 204, 21, 0.45)',
  coneSus: 'rgba(251, 146, 60, 0.28)',
  coneSusEdge: 'rgba(251, 146, 60, 0.55)',
  coneAlarm: 'rgba(239, 68, 68, 0.32)',
  coneAlarmEdge: 'rgba(239, 68, 68, 0.6)',
  camCone: 'rgba(192, 132, 252, 0.20)',
  camConeEdge: 'rgba(192, 132, 252, 0.5)',
  panel: '#141821',
  panelEdge: '#2c3240',
  text: '#eef1f5',
  muted: '#8b93a3',
  goldText: '#f2c94c',
  danger: '#ef4444',
  warn: '#fb923c',
  alarmFill: '#ef4444',
  alarmFillMid: '#fb923c',
  alarmFillLow: '#f2c94c',
  switchOn: '#39d98a',
  switchOff: '#5c6675',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best result is kept between visits (this browser only). */
export const BEST_KEY = 'gilded.best';
