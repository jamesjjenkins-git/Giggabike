import { mulberry32 } from './util.js';
import { START_X, LAPS } from './config.js';

// Ramp height profiles: [dx, height] points. Ramps span all four lanes.
export const SHAPES = {
  bump:    [[0, 0], [10, 7], [20, 0]],
  small:   [[0, 0], [26, 14], [36, 14], [56, 0]],
  kicker:  [[0, 0], [34, 24], [35, 0]],
  big:     [[0, 0], [50, 34], [66, 34], [126, 0]],
  table:   [[0, 0], [32, 20], [150, 20], [190, 0]],
  double:  [[0, 0], [24, 16], [44, 0], [68, 16], [92, 0]],
  launch:  [[0, 0], [44, 34], [45, 0]],
  landing: [[0, 0], [1, 26], [90, 0]],
};

const shapeWidth = (k) => SHAPES[k][SHAPES[k].length - 1][0];

const PAL_DAY = {
  sky: ['#4fb4f0', '#7fcdf6', '#b8e6fb'],
  hills: '#5f9f6a', hills2: '#3f7d52', cloud: '#ffffff',
  roof: '#e04848', roof2: '#f6f6f6', stands: '#3c4a70', standsDark: '#27304b', wall: '#2f6fd0',
  fence: '#f4f4f4', grass: '#45a845',
  dirt: ['#c98a4b', '#c08043'], dirtLight: '#ddaa6e', dirtDark: '#9e6634', line: '#e6bd8a',
  rampUp: '#e9b073', rampFlat: '#d69a5a', rampDown: '#a96c37', rampWall: '#7d4a22',
  rampFace: '#8f5629', rampFaceLine: '#77441e',
  mud: '#5b3a1d', mudLight: '#734c27', kerb: ['#e83a3a', '#f4f4f4'], night: false,
};

const PAL_CANYON = {
  sky: ['#ff8a4c', '#ffb36b', '#ffd59a'],
  hills: '#b4553a', hills2: '#8a3d2b', cloud: '#ffe6c7',
  roof: '#2f8f83', roof2: '#f4e2c4', stands: '#5a3c48', standsDark: '#3e2832', wall: '#c4472d',
  fence: '#f7ead2', grass: '#9a8a3a',
  dirt: ['#d9844a', '#cf7a41'], dirtLight: '#efa86f', dirtDark: '#a85a2c', line: '#f3c08f',
  rampUp: '#f2a568', rampFlat: '#de8d52', rampDown: '#b0602f', rampWall: '#7f3f1d',
  rampFace: '#96502a', rampFaceLine: '#7c4020',
  mud: '#5e2f1b', mudLight: '#7a4226', kerb: ['#2f8f83', '#f7ead2'], night: false,
};

const PAL_NIGHT = {
  sky: ['#0b0f2a', '#141a44', '#20285e'],
  hills: '#1d2a4a', hills2: '#141d36', cloud: '#2b3566',
  roof: '#7b3fe4', roof2: '#d9d2ff', stands: '#262b45', standsDark: '#171a2c', wall: '#7b3fe4',
  fence: '#d8dcf0', grass: '#2f6b4a',
  dirt: ['#9a6a45', '#91623e'], dirtLight: '#b88a60', dirtDark: '#6e4628', line: '#c3a07c',
  rampUp: '#b98657', rampFlat: '#a47448', rampDown: '#7e5432', rampWall: '#5a3a20',
  rampFace: '#6b4426', rampFaceLine: '#563620',
  mud: '#3f2a18', mudLight: '#563a22', kerb: ['#7b3fe4', '#d8dcf0'], night: true,
};

export const TRACKS = [
  { name: 'DUSTBOWL', seed: 11, difficulty: 0, length: 4200, qualify: 47, palette: PAL_DAY },
  { name: 'CANYON RUN', seed: 23, difficulty: 1, length: 4800, qualify: 55, palette: PAL_CANYON },
  { name: 'THUNDER RIDGE', seed: 37, difficulty: 2, length: 5400, qualify: 62, palette: PAL_NIGHT },
];

function generate(def) {
  const rng = mulberry32(def.seed);
  const d = def.difficulty;
  const items = [];
  const pickLanes = (n) => {
    const a = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  };
  let x = 170;
  let lastArrow = 0;
  const end = def.length - 230;
  let afterJump = false; // previous feature throws you far: leave room to land
  while (x < end) {
    let w;
    const r = rng();
    let jump = false;
    if (afterJump) x += 110;
    if (x - lastArrow > 650) {
      const lanes = pickLanes(rng() < 0.5 ? 1 : 2);
      for (const l of lanes) items.push({ t: 'arrow', x, lane: l });
      lastArrow = x; w = 18;
    } else if (r < 0.15) {
      const n = 1 + Math.floor(rng() * (d >= 2 ? 3 : 2));
      const mw = 50 + Math.floor(rng() * (50 + d * 25));
      items.push({ t: 'mud', x, w: mw, lanes: pickLanes(n) });
      w = mw;
    } else if (r < 0.23) {
      items.push({ t: 'boost', x, lane: Math.floor(rng() * 4) });
      w = 26;
    } else if (r < 0.33) {
      const n = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) items.push({ t: 'ramp', x: x + i * 22, kind: 'bump' });
      w = n * 22;
    } else if (r < 0.41 + d * 0.06) {
      x += 90; // run-up so you can hit the launch at full speed
      jump = true;
      const gap = 58 + d * 8 + Math.floor(rng() * 8);
      items.push({ t: 'ramp', x, kind: 'launch' });
      items.push({ t: 'ramp', x: x + 45 + gap, kind: 'landing' });
      w = 45 + gap + shapeWidth('landing');
    } else {
      const pool = d === 0
        ? ['small', 'small', 'big', 'table', 'kicker', 'double']
        : d === 1
          ? ['small', 'big', 'table', 'kicker', 'double', 'kicker']
          : ['big', 'table', 'kicker', 'double', 'kicker', 'big'];
      const k = pool[Math.floor(rng() * pool.length)];
      items.push({ t: 'ramp', x, kind: k });
      w = shapeWidth(k);
      jump = k === 'kicker' || k === 'big';
    }
    afterJump = jump;
    x += w + 50 + Math.floor(rng() * (110 - d * 25));
  }
  return items;
}

export class Track {
  constructor(index) {
    const def = TRACKS[index];
    this.index = index;
    this.def = def;
    this.lapLength = def.length;
    this.laps = LAPS;
    this.finishX = START_X + def.length * LAPS;
    this.ramps = [];
    this.decals = [];
    const items = generate(def);
    for (let lap = 0; lap < LAPS; lap++) {
      const off = START_X + lap * def.length;
      for (const it of items) {
        const x0 = off + it.x;
        if (it.t === 'ramp') {
          const pts = SHAPES[it.kind].map(([dx, h]) => [x0 + dx, h]);
          this.ramps.push({
            kind: it.kind, x0, x1: pts[pts.length - 1][0], pts,
            wall: pts[1][0] - pts[0][0] < 3,
            top: Math.max(...pts.map((p) => p[1])),
          });
        } else if (it.t === 'mud') {
          this.decals.push({ t: 'mud', x0, x1: x0 + it.w, lanes: it.lanes });
        } else if (it.t === 'arrow') {
          this.decals.push({ t: 'arrow', x0, x1: x0 + 16, lanes: [it.lane] });
        } else if (it.t === 'boost') {
          this.decals.push({ t: 'boost', x0, x1: x0 + 24, lanes: [it.lane] });
        }
      }
    }
    this.ramps.sort((a, b) => a.x0 - b.x0);
    this.decals.sort((a, b) => a.x0 - b.x0);
  }

  // index of last ramp with x0 <= x, or -1
  _idx(x) {
    let lo = 0, hi = this.ramps.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (this.ramps[m].x0 <= x) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans;
  }

  rampAt(x) {
    const i = this._idx(x);
    if (i < 0) return null;
    const r = this.ramps[i];
    return x < r.x1 ? r : null;
  }

  nextRamp(x) {
    const i = this._idx(x) + 1;
    return this.ramps[i] || null;
  }

  height(x) {
    const r = this.rampAt(x);
    if (!r) return 0;
    const p = r.pts;
    for (let i = 1; i < p.length; i++) {
      if (x <= p[i][0]) {
        const [xa, ha] = p[i - 1];
        const [xb, hb] = p[i];
        return xb === xa ? Math.max(ha, hb) : ha + ((hb - ha) * (x - xa)) / (xb - xa);
      }
    }
    return 0;
  }

  slopeBack(x) { return (this.height(x) - this.height(x - 2)) / 2; }
  slopeFwd(x) { return (this.height(x + 2) - this.height(x)) / 2; }

  decalAt(x, lane) {
    for (const d of this.decals) {
      if (d.x0 > x) break;
      if (x < d.x1 && d.lanes.includes(lane)) return d;
    }
    return null;
  }

  // A sensible place to put a rider back on the bike after a crash.
  safeX(x) {
    for (let guard = 0; guard < 12; guard++) {
      const r = this.rampAt(x);
      if (r) { x = r.x1 + 6; continue; }
      const nr = this.nextRamp(x);
      if (nr && nr.wall && nr.x0 - x < 170) { x = nr.x1 + 6; continue; }
      break;
    }
    return x;
  }

  rampsInRange(a, b) {
    const out = [];
    for (const r of this.ramps) {
      if (r.x0 > b) break;
      if (r.x1 >= a) out.push(r);
    }
    return out;
  }

  decalsInRange(a, b) {
    const out = [];
    for (const d of this.decals) {
      if (d.x0 > b) break;
      if (d.x1 >= a) out.push(d);
    }
    return out;
  }
}
