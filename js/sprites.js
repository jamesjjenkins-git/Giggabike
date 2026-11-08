// Procedurally drawn pixel-art dirt bike + rider (original artwork).
// Sprites are 24x20; origin (ground contact) is bottom-centre (12, 20).
export const SW = 24, SH = 20;

const WHEEL = [
  '..kkkk..',
  '.kttttk.',
  'kttggttk',
  'ktgrrgtk',
  'ktgrrgtk',
  'kttggttk',
  '.kttttk.',
  '..kkkk..',
];

const BASE = { k: '#141414', t: '#2c2c2c', g: '#8f979e', r: '#d6dbe0' };

function px(c, x, y, col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function line(c, x0, y0, x1, y1, col) {
  c.fillStyle = col;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function map(c, rows, ox, oy, pal) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) px(c, ox + x, oy + y, col);
    }
  });
}

function canvas() {
  const cv = document.createElement('canvas');
  cv.width = SW; cv.height = SH;
  return cv;
}

function drawBike(c, col) {
  const f = col.frame, fd = col.frameDark;
  // wheels
  map(c, WHEEL, 1, 12, BASE);
  map(c, WHEEL, 15, 12, BASE);
  // swingarm (rear hub -> engine)
  line(c, 5, 15, 10, 13, BASE.g);
  line(c, 5, 16, 10, 14, BASE.k);
  // engine block
  rect(c, 8, 11, 5, 4, '#4a4f55');
  line(c, 9, 12, 12, 12, '#7d858c');
  line(c, 9, 14, 12, 14, '#2a2d31');
  // exhaust pipe sweeping back
  line(c, 8, 13, 4, 10, '#c9ced3');
  rect(c, 2, 9, 3, 2, '#9aa1a8');
  // main frame + tank
  line(c, 6, 10, 15, 9, f);
  line(c, 7, 11, 14, 10, fd);
  rect(c, 11, 8, 4, 2, f);
  // seat + rear fender
  rect(c, 4, 9, 7, 1, '#1d1d1d');
  line(c, 0, 9, 5, 10, f);
  line(c, 0, 10, 4, 11, fd);
  // fork
  line(c, 18, 15, 15, 7, BASE.g);
  line(c, 19, 15, 16, 7, BASE.k);
  // front fender
  line(c, 17, 11, 22, 11, f);
  line(c, 18, 10, 21, 10, f);
  // handlebar + number plate
  rect(c, 14, 6, 4, 1, BASE.k);
  rect(c, 15, 8, 2, 2, '#ffffff');
}

function drawRider(c, col) {
  const j = col.jersey, jd = col.jerseyDark, p = col.pants, h = col.helmet;
  // boot on the peg
  rect(c, 10, 13, 3, 2, '#262626');
  // thigh + shin
  rect(c, 7, 8, 6, 2, p);
  line(c, 12, 9, 11, 13, p);
  line(c, 13, 9, 12, 13, p);
  // torso leaning forward
  line(c, 7, 8, 10, 4, jd);
  line(c, 8, 8, 11, 4, j);
  line(c, 9, 8, 12, 4, j);
  line(c, 10, 7, 12, 5, j);
  // arm to the bars
  line(c, 12, 5, 15, 6, j);
  line(c, 11, 5, 14, 7, jd);
  px(c, 15, 6, '#262626');
  // helmet
  rect(c, 11, 0, 4, 4, h);
  rect(c, 10, 1, 1, 2, h);
  px(c, 15, 3, h);
  rect(c, 13, 1, 2, 2, col.visor);
  px(c, 11, 0, col.helmetStripe);
  px(c, 12, 0, col.helmetStripe);
}

const cache = new Map();
const keyOf = (col, kind) => kind + JSON.stringify(col);

export function bikeSprite(col) {
  const k = keyOf(col, 'b');
  if (!cache.has(k)) { const cv = canvas(); drawBike(cv.getContext('2d'), col); cache.set(k, cv); }
  return cache.get(k);
}

export function riderSprite(col) {
  const k = keyOf(col, 'r');
  if (!cache.has(k)) { const cv = canvas(); drawRider(cv.getContext('2d'), col); cache.set(k, cv); }
  return cache.get(k);
}

export const PLAYER_COLORS = {
  frame: '#ffd21f', frameDark: '#c99a00', jersey: '#ffd21f', jerseyDark: '#d1a300',
  pants: '#1f4fd8', helmet: '#ffffff', helmetStripe: '#1f4fd8', visor: '#2b2b2b',
};

export const RIVAL_COLORS = [
  { frame: '#e8338a', frameDark: '#a61f60', jersey: '#e8338a', jerseyDark: '#a61f60', pants: '#2b2b2b', helmet: '#e8338a', helmetStripe: '#ffffff', visor: '#9fe8ff' },
  { frame: '#5fd13b', frameDark: '#3a9420', jersey: '#5fd13b', jerseyDark: '#3a9420', pants: '#f4f4f4', helmet: '#2b2b2b', helmetStripe: '#5fd13b', visor: '#ffe14d' },
  { frame: '#ff7a1a', frameDark: '#c45200', jersey: '#ff7a1a', jerseyDark: '#c45200', pants: '#3b2b6b', helmet: '#ff7a1a', helmetStripe: '#2b2b2b', visor: '#2b2b2b' },
  { frame: '#29b6ff', frameDark: '#0a7bc0', jersey: '#29b6ff', jerseyDark: '#0a7bc0', pants: '#ffffff', helmet: '#ffffff', helmetStripe: '#29b6ff', visor: '#2b2b2b' },
  { frame: '#a46bff', frameDark: '#6b3bc8', jersey: '#a46bff', jerseyDark: '#6b3bc8', pants: '#ffd21f', helmet: '#a46bff', helmetStripe: '#ffd21f', visor: '#9fe8ff' },
];
