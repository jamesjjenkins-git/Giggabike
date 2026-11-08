// Logical resolution (scaled up with nearest-neighbour for a crisp pixel look)
export const W = 384;
export const H = 216;

// Oblique 2.5D projection: each lane further "into" the screen is drawn
// LANE_H pixels higher and SKEW pixels further right.
export const GROUND_Y = 180; // screen y of the near edge of lane 0
export const LANE_H = 16;
export const SKEW = 5;
export const LANES = 4;

export const START_X = 200;
export const LAPS = 2;

export const PHYS = {
  G: 420,            // gravity px/s^2
  V_MAX: 165,        // top speed on GO
  V_TURBO: 225,      // top speed on TURBO
  V_PAD: 285,        // speed from a boost pad
  ACC: 95,
  ACC_TURBO: 140,
  DRAG: 70,
  V_MUD: 65,
  V_MUD_WHEELIE: 115,
  LANE_SPEED: 4.5,   // lanes per second
  HEAT_UP: 28,       // % per second while holding TURBO
  HEAT_DOWN: 14,     // % per second while on GO
  HEAT_IDLE: 22,     // % per second off the throttle
  OVERHEAT_TIME: 3.0,
  CRASH_TIME: 2.2,
};
