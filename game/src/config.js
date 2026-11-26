// AEROLITH: ARCHIPELAGO RESCUE — tuning & world constants.
// All units are metres / seconds / degrees where noted. Speeds are in
// knots-style arcade units (1 unit ~ 1 m/s) so HUD numbers feel familiar.

export const WORLD = {
  seed: 1,
  size: 2400,            // playable ocean square, centred on origin
  oceanSize: 6000,
  waterLevel: 0,
  fogNear: 220,
  fogFar: 1500,
  skyTop: 0x7ec8e3,
  skyBottom: 0xbfe8f2,
  fogColor: 0xa8d8e8,
  sunPosition: [320, 420, 180],
  shadowMapSize: 2048,
};

export const PLANE = {
  stallSpeed: 28,
  takeoffSpeed: 55,
  maxSpeed: 118,
  cruiseSpeed: 72,
  minSpeed: 0,
  accelPerThrottle: 34,   // speed gain per second at full throttle
  drag: 0.055,            // quadratic-ish drag factor
  pitchRate: 42,          // deg/s at full deflection, scaled by speed
  rollRate: 95,
  yawRate: 26,
  autoLevelRate: 18,      // deg/s roll levelling when no roll input
  gravity: 9.8,
  stallSink: 14,          // extra sink rate when stalled
  fuelCapacity: 100,
  fuelBurnFull: 1.15,     // % per second at full throttle
  fuelBurnIdle: 0.12,
  crashVerticalSpeed: 14, // m/s downward at impact = crash
  hardImpactSpeed: 22,    // horizontal impact speed into terrain = crash
  gearDrag: 4,
};

export const RUNWAY = {
  // Home Island runway, aligned with +Z axis for a simple approach.
  centerX: 0,
  centerZ: 40,
  headingDeg: 0,          // runway points north (+Z is 0 deg here)
  length: 220,
  width: 18,
  touchdownZone: 60,      // metres from threshold that count as ideal
  maxLandingSpeed: 45,
  maxLandingSink: 6,
  maxCenterlineOffset: 9,
};

export const CAMERA = {
  fov: 60,
  chaseDistance: 18,
  chaseHeight: 6.5,
  chaseLookAhead: 18,
  smooth: 5.5,
  cockpitOffset: [0, 1.5, 0.6],
};

export const COLORS = {
  fuselageRed: 0xd43d2a,
  fuselageWhite: 0xf5f2ea,
  teal: 0x0e9aa7,
  amber: 0xffb020,
  gold: 0xffc94d,
  ringOrange: 0xff7a1a,
  sand: 0xe8d29a,
  grass: 0x4fae5a,
  grassDark: 0x37924a,
  rock: 0x8a7f72,
  volcanoRock: 0x4a3f3a,
  lava: 0xff5a1f,
  water: 0x1e7fa8,
  waterDeep: 0x0f5e86,
  palmTrunk: 0x7a5230,
  palmLeaf: 0x2fae5e,
  cloud: 0xffffff,
};

export const MISSIONS = [
  {
    id: 'ring-run',
    key: '1',
    name: 'Ring Run',
    short: 'M1 · Ring Run',
    timeLimit: 240,
    description: 'Fly through all 5 glowing rings in order before the timer runs out.',
    objective: 'Fly through ring {current} of 5',
    ringReward: 100,
    timeBonusPerSecond: 2,
  },
  {
    id: 'supply-drop',
    key: '2',
    name: 'Supply Drop',
    short: 'M2 · Supply Drop',
    timeLimit: 300,
    description: 'Fly to Far Atoll and press Space to drop supplies inside the marked zone.',
    objective: 'Reach Far Atoll and drop supplies in the zone',
    dropReward: 250,
    timeBonusPerSecond: 2,
  },
  {
    id: 'volcano-rescue',
    key: '3',
    name: 'Volcano Rescue',
    short: 'M3 · Volcano Rescue',
    timeLimit: 360,
    description: 'Pick up the stranded hiker low over the Volcano Isle helipad, then fly home and make a precision landing on the home runway.',
    objective: 'Pick up the hiker, then land precisely on the home runway',
    pickupReward: 200,
    landingReward: 300,
    timeBonusPerSecond: 2,
  },
  {
    id: 'free-flight',
    key: '4',
    name: 'Free Flight',
    short: 'Free Flight',
    timeLimit: 0,
    description: 'No timer, no score pressure. Explore the archipelago at your own pace.',
    objective: 'Explore the archipelago',
    ringReward: 0,
    timeBonusPerSecond: 0,
  },
];

export const ISLANDS = [
  { name: 'Home Island', x: 0, z: 0, radius: 190, peak: 26, kind: 'home' },
  { name: 'Palm Cay', x: -330, z: -260, radius: 110, peak: 14, kind: 'lighthouse' },
  { name: 'Twin Peaks', x: 360, z: -300, radius: 170, peak: 72, kind: 'peaks' },
  { name: 'Volcano Isle', x: 420, z: 380, radius: 180, peak: 96, kind: 'volcano' },
  { name: 'Far Atoll', x: -430, z: 420, radius: 130, peak: 10, kind: 'atoll' },
];

export const RING_POSITIONS = [
  [60, 46, -120],
  [-40, 58, -260],
  [-260, 52, -300],
  [120, 70, 60],
  [300, 64, 260],
];

export const DROP_ZONE = { x: -430, z: 420, radius: 26 };
export const HELIPAD = { x: 420, z: 380, y: 96, radius: 14 };

export const VERSION = 'aerolith-1.0.0';
