import { W, H, START_X, PHYS } from './config.js';
import { Track, TRACKS } from './track.js';
import { Bike, aiInput, makeAI } from './bike.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { drawText } from './font.js';
import { PLAYER_COLORS, RIVAL_COLORS } from './sprites.js';
import { mulberry32, fmtTime, ordinal, clamp } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

function toLogical(cx, cy) {
  const r = canvas.getBoundingClientRect();
  const x = ((cx - r.left) / r.width) * W;
  const y = ((cy - r.top) / r.height) * H;
  return x >= 0 && y >= 0 && x < W && y < H ? { x, y } : null;
}

const input = new Input(canvas, toLogical);
const sfx = new Sfx();
input.onFirstGesture = () => sfx.init();
const renderer = new Renderer(ctx);

const store = {
  get(k) { try { return localStorage.getItem('giggabike.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('giggabike.' + k, v); } catch (e) { /* private mode */ } },
};
const bestTime = (i) => { const v = parseFloat(store.get('best.' + i)); return isFinite(v) ? v : null; };

const g = {
  state: 'title', // title | countdown | race | finished
  mode: 'time',
  trackIndex: 0,
  track: null,
  bikes: [],
  player: null,
  cam: 0,
  clock: 0,
  raceTime: 0,
  countdown: 0,
  particles: [],
  texts: [],
  excite: 0,
  position: 1,
  paused: false,
  best: null,
  results: null,
  menuSel: 0,
  menuItems: [],
  touch: false,
};

// ---------- setup ----------
function setupRace(mode, trackIndex, demo = false) {
  g.mode = mode;
  g.trackIndex = trackIndex;
  g.track = new Track(trackIndex);
  renderer.setTrack(g.track);
  g.particles = [];
  g.texts = [];
  g.raceTime = 0;
  g.results = null;
  g.best = bestTime(trackIndex);
  const rng = mulberry32(Date.now() & 0xffff);
  g.bikes = [];
  if (demo) {
    for (let i = 0; i < 4; i++) {
      const b = new Bike(g.track, i, START_X - 20 - (i % 2) * 30, RIVAL_COLORS[i], { ai: makeAI(rng), capScale: 0.9 + rng() * 0.1 });
      g.bikes.push(b);
    }
    g.player = g.bikes[0];
    g.player.ai.hot = 60;
    return;
  }
  g.player = new Bike(g.track, 1, START_X - 20, PLAYER_COLORS, { isPlayer: true });
  g.bikes.push(g.player);
  if (mode === 'race') {
    const grid = [[0, -20], [2, -20], [3, -20], [1, -60], [2, -60]];
    grid.forEach(([lane, dx], i) => {
      const skill = 0.86 + (TRACKS[trackIndex].difficulty * 0.03) + rng() * 0.08;
      g.bikes.push(new Bike(g.track, lane, START_X + dx, RIVAL_COLORS[i], { ai: makeAI(rng), capScale: skill }));
    });
  }
  g.cam = g.player.x - 120;
}

function startRace(mode, trackIndex) {
  setupRace(mode, trackIndex);
  g.state = 'countdown';
  g.countdown = 3.999;
  g.lastCount = 4;
  g.paused = false;
  input.clear();
}

function toTitle() {
  setupRace('race', g.trackIndex, true);
  g.state = 'title';
  g.menuSel = 0;
  input.clear();
}

// ---------- effects ----------
function spawn(x, d, z, vx, vz, color, life = 0.5, size = 1) {
  if (g.particles.length > 400) return;
  g.particles.push({ x, d, z, vx, vz, color, life, max: life, size });
}
function floatText(b, text, color = '#ffffff') {
  g.texts.push({ text, x: b.x, d: b.depth, z: b.z + 26, life: 1.1, color });
}

function handleEvents(b) {
  const near = b.x > g.cam - 40 && b.x < g.cam + W + 40;
  const pal = g.track.def.palette;
  for (const e of b.events) {
    switch (e.type) {
      case 'crash':
        if (near) {
          if (b.isPlayer || g.state === 'race') sfx.crash();
          for (let i = 0; i < 18; i++) spawn(b.x, b.depth, b.z + 2, (Math.random() - 0.3) * 120, Math.random() * 120, Math.random() < 0.5 ? pal.dirtLight : pal.dirtDark, 0.7, 2);
        }
        if (b.isPlayer) { floatText(b, 'CRASH!', '#ff6b6b'); g.excite = 1.5; }
        break;
      case 'land':
        if (near && e.impact > 120) {
          if (b.isPlayer) sfx.land();
          for (let i = 0; i < 6; i++) spawn(b.x - 6, b.depth, b.z, -20 - Math.random() * 60, 20 + Math.random() * 40, pal.dirtLight, 0.4, 1);
        }
        break;
      case 'perfect':
        if (b.isPlayer) { sfx.perfect(); floatText(b, 'NICE!', '#7dff8a'); g.excite = 1.2; }
        break;
      case 'bobble':
        if (b.isPlayer) { sfx.land(); floatText(b, 'OOF', '#ffd21f'); }
        break;
      case 'overheat':
        if (b.isPlayer) { sfx.overheat(); floatText(b, 'OVERHEAT!', '#ff3b30'); }
        break;
      case 'cool':
        if (b.isPlayer) { sfx.cool(); floatText(b, 'COOL', '#38e8ff'); }
        break;
      case 'boost':
        if (b.isPlayer) { sfx.boost(); floatText(b, 'BOOST!', '#38e8ff'); }
        if (near) for (let i = 0; i < 10; i++) spawn(b.x - 8, b.depth, 2, -60 - Math.random() * 80, Math.random() * 50, '#38e8ff', 0.4, 1);
        break;
      case 'mud':
        if (near && Math.random() < 0.3) spawn(b.x - 8, b.depth, 2, -30 - Math.random() * 50, 40 + Math.random() * 60, pal.mud, 0.5, 2);
        break;
      default:
    }
  }
  b.events.length = 0;
}

function collide() {
  const bs = g.bikes;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (a.state === 'crash' || b.state === 'crash') continue;
      if (Math.abs(a.lane - b.lane) > 0.7 || Math.abs(a.z - b.z) > 8) continue;
      const [back, front] = a.x < b.x ? [a, b] : [b, a];
      const dx = front.x - back.x;
      if (dx > 18) continue;
      if (dx > 9) {
        // front wheel clips the rear wheel of the rider ahead
        if (back.v > front.v + 5) { back.crashNow(); front.v += 8; }
      } else {
        // side by side: shove apart
        let dir = Math.sign(a.lane - b.lane);
        if (!dir) dir = a.lane < 1.5 ? -1 : 1;
        a.lane = clamp(a.lane + dir * 0.06, 0, 3);
        b.lane = clamp(b.lane - dir * 0.06, 0, 3);
      }
    }
  }
}

// ---------- simulation ----------
let goPresses = 0;

function step(dt) {
  g.clock += dt;
  g.excite = Math.max(0, g.excite - dt);

  if (g.state === 'countdown') {
    g.countdown -= dt;
    const c = Math.ceil(g.countdown);
    if (c !== g.lastCount) {
      g.lastCount = c;
      sfx.countdown(c === 0);
      if (c === 0) { g.state = 'race'; }
    }
    const pi = input.state();
    sfx.engine(true, (pi.go || pi.turbo) ? 90 : 10, pi.turbo);
    updateCamera(dt);
    return;
  }

  if (g.state === 'race' || g.state === 'finished' || g.state === 'title') {
    if (g.state === 'race') g.raceTime += dt;
    for (const b of g.bikes) {
      let inp;
      if (b.ai) inp = aiInput(b, g.track, g.bikes, dt);
      else {
        inp = input.state();
        inp.goPressed = goPresses;
        goPresses = 0;
      }
      b.update(dt, inp);
      if (!b.finished && b.x >= g.track.finishX) {
        b.finished = true;
        b.finishTime = g.raceTime;
        if (b.isPlayer) onPlayerFinish();
      }
      // dust trail
      if (b.state === 'ride' && !b.air && b.v > 50 && Math.random() < 0.35 && b.x > g.cam - 20 && b.x < g.cam + W + 20) {
        const pal = g.track.def.palette;
        spawn(b.x - 8, b.depth, b.z + 1, -10 - Math.random() * 30, 10 + Math.random() * 25, Math.random() < 0.5 ? pal.dirtLight : pal.line, 0.35, 1);
      }
      if (b.state === 'overheat' && Math.random() < 0.5) {
        spawn(b.x - 2, b.depth, b.z + 12, -10 + Math.random() * 20, 30 + Math.random() * 20, Math.random() < 0.5 ? '#9a9a9a' : '#d0d0d0', 0.8, 2);
      }
      handleEvents(b);
    }
    collide();

    if (g.mode === 'race' && g.state !== 'title') {
      const p = g.player;
      g.position = 1 + g.bikes.filter((o) => o !== p && (o.finished ? (!p.finished || o.finishTime < p.finishTime) : (!p.finished && o.x > p.x))).length;
    }
    if (g.state === 'title' && g.bikes.every((b) => b.finished && b.x > g.track.finishX + 400)) toTitle();

    const p = g.player;
    if (g.state === 'title') sfx.engine(false, 0, false);
    else sfx.engine(p.state !== 'crash', p.v, p.turboOn);
  }

  for (const pt of g.particles) {
    pt.life -= dt; pt.x += pt.vx * dt; pt.z += pt.vz * dt; pt.vz -= 220 * dt;
    if (pt.z < 0) { pt.z = 0; pt.vz = 0; pt.vx *= 0.8; }
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  for (const t of g.texts) { t.life -= dt; t.z += 18 * dt; }
  g.texts = g.texts.filter((t) => t.life > 0);
  updateCamera(dt);
}

function updateCamera(dt) {
  const target = g.player.x - 120;
  g.cam += (target - g.cam) * Math.min(1, dt * 12);
  g.cam = Math.max(0, g.cam);
}

function onPlayerFinish() {
  sfx.finish();
  const t = g.raceTime;
  const prev = bestTime(g.trackIndex);
  const isBest = prev == null || t < prev;
  if (isBest) store.set('best.' + g.trackIndex, t.toFixed(3));
  const qualified = t <= g.track.def.qualify;
  if (qualified) store.set('qual.' + g.trackIndex, '1');
  g.results = { time: t, prev, isBest, qualified, position: g.position, timer: 0 };
  g.best = isBest ? t : prev;
  g.state = 'finished';
  g.menuSel = 0;
  input.clear();
  g.excite = 2;
}

// ---------- menus ----------
function menuInput(items, onSelect, onLeftRight) {
  g.menuItems = items;
  const up = input.consume('up'), down = input.consume('down');
  const left = input.consume('left'), right = input.consume('right');
  const ok = input.consume('go') + input.consume('start');
  if (up) { g.menuSel = (g.menuSel + items.length - 1) % items.length; sfx.select(); }
  if (down) { g.menuSel = (g.menuSel + 1) % items.length; sfx.select(); }
  if ((left || right) && onLeftRight) onLeftRight(items[g.menuSel], right ? 1 : -1);
  for (const tap of input.consumeTaps()) {
    items.forEach((it, i) => {
      if (tap.y >= it.y - 3 && tap.y <= it.y + 10 && Math.abs(tap.x - W / 2) < 90) {
        if (it.lr && onLeftRight && Math.abs(tap.x - W / 2) > 45) {
          g.menuSel = i;
          onLeftRight(it, tap.x > W / 2 ? 1 : -1);
        } else if (g.menuSel === i || !it.lr) {
          g.menuSel = i;
          onSelect(it);
        } else g.menuSel = i;
      }
    });
  }
  if (ok) onSelect(items[g.menuSel]);
}

function titleItems() {
  return [
    { id: 'time', label: 'TIME TRIAL', y: 118 },
    { id: 'race', label: 'RACE', y: 132 },
    { id: 'track', label: `< ${TRACKS[g.trackIndex].name} >`, y: 146, lr: true },
  ];
}

function frameLogic() {
  g.touch = input.isTouch;
  if (input.consume('mute')) sfx.toggleMute();

  if (g.state === 'title') {
    menuInput(titleItems(), (it) => {
      sfx.select();
      if (it.id === 'time' || it.id === 'race') startRace(it.id, g.trackIndex);
      if (it.id === 'track') { g.trackIndex = (g.trackIndex + 1) % TRACKS.length; toTitle(); g.menuSel = 2; }
    }, (it, dir) => {
      if (it.id !== 'track') return;
      sfx.select();
      g.trackIndex = (g.trackIndex + dir + TRACKS.length) % TRACKS.length;
      toTitle();
      g.menuSel = 2;
    });
    input.consume('pause');
    return;
  }

  if (g.state === 'finished') {
    g.results.timer += 1 / 60;
    if (g.results.timer < 1.2) { input.clear(); return; }
    const items = [{ id: 'retry', label: 'RETRY', y: 150 }];
    if (g.trackIndex < TRACKS.length - 1) items.push({ id: 'next', label: 'NEXT TRACK', y: 164 });
    items.push({ id: 'menu', label: 'MENU', y: 164 + (items.length - 1) * 14 });
    menuInput(items, (it) => {
      sfx.select();
      if (it.id === 'retry') startRace(g.mode, g.trackIndex);
      else if (it.id === 'next') startRace(g.mode, g.trackIndex + 1);
      else toTitle();
    });
    return;
  }

  // racing / countdown
  if (input.consume('pause')) { g.paused = !g.paused; input.clear(); }
  if (g.paused) {
    if (input.consume('start') || input.consumeTaps().length) g.paused = false;
    input.consume('go');
    return;
  }
  goPresses += input.consume('go');
  input.consume('start');
  input.consumeTaps();
}

// ---------- drawing ----------
function draw() {
  ctx.imageSmoothingEnabled = false;
  renderer.drawWorld(g);
  renderer.drawBikes(g);
  renderer.drawParticles(g);

  if (g.state === 'title') { drawTitle(); return; }
  renderer.drawHUD(g);

  if (g.state === 'countdown') {
    const c = Math.ceil(g.countdown);
    drawText(ctx, c > 0 ? String(c) : 'GO!', W / 2, 70, c > 0 ? '#ffffff' : '#7dff8a', 4, 'center', '#000');
    if (c === 3 || c === 4) drawControlsHint(110);
  } else if (g.state === 'race' && g.raceTime < 0.8) {
    drawText(ctx, 'GO!', W / 2, 70, '#7dff8a', 4, 'center', '#000');
  }
  if (g.state === 'finished') drawResults();
  if (g.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'PAUSED', W / 2, 80, '#ffffff', 3, 'center', '#000');
    drawText(ctx, g.touch ? 'TAP TO RESUME' : 'P TO RESUME', W / 2, 112, '#ffd21f', 1, 'center');
  }
}

function drawControlsHint(y) {
  const lines = g.touch
    ? ['GO = RIDE   TURBO = FASTER (WATCH THE TEMP!)', 'UP/DOWN = LANE   LEFT/RIGHT = LEAN', 'RIDE OVER ARROWS TO COOL THE ENGINE']
    : ['Z = GO   X = TURBO (WATCH THE TEMP!)', 'UP/DOWN = LANE   LEFT/RIGHT = LEAN', 'RIDE OVER ARROWS TO COOL THE ENGINE'];
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(40, y - 4, W - 80, lines.length * 11 + 6);
  lines.forEach((l, i) => drawText(ctx, l, W / 2, y + i * 11, '#ffffff', 1, 'center'));
}

function drawTitle() {
  ctx.fillStyle = 'rgba(0,0,20,0.45)';
  ctx.fillRect(0, 0, W, H);
  const bob = Math.round(Math.sin(g.clock * 3) * 2);
  drawText(ctx, 'GIGGABIKE', W / 2 + 2, 36 + bob + 2, '#1f4fd8', 5, 'center');
  drawText(ctx, 'GIGGABIKE', W / 2, 36 + bob, '#ffd21f', 5, 'center', '#c45200');
  drawText(ctx, 'MOTOCROSS MAYHEM', W / 2, 80, '#ffffff', 1, 'center', '#000');

  g.menuItems = titleItems();
  g.menuItems.forEach((it, i) => {
    const sel = i === g.menuSel;
    drawText(ctx, it.label, W / 2, it.y, sel ? '#ffd21f' : '#ffffff', 1, 'center', '#000');
    if (sel && Math.floor(g.clock * 4) % 2) drawText(ctx, '>', W / 2 - 70, it.y, '#ffd21f', 1, 'left');
  });
  const best = bestTime(g.trackIndex);
  const qual = store.get('qual.' + g.trackIndex) === '1';
  drawText(ctx, `BEST ${best ? fmtTime(best) : '-:--.--'}   QUALIFY ${fmtTime(TRACKS[g.trackIndex].qualify)}${qual ? '  OK' : ''}`, W / 2, 160, '#8fa0c0', 1, 'center', '#000');
  drawControlsHint(176);
  if (Math.floor(g.clock * 2) % 2) drawText(ctx, g.touch ? 'TAP A MODE TO START' : 'ARROWS + ENTER TO START', W / 2, 100, '#ffffff', 1, 'center', '#000');
}

function drawResults() {
  const r = g.results;
  ctx.fillStyle = 'rgba(0,0,20,0.7)';
  ctx.fillRect(70, 34, W - 140, 150);
  ctx.fillStyle = '#ffd21f'; ctx.fillRect(70, 34, W - 140, 1); ctx.fillRect(70, 183, W - 140, 1);
  drawText(ctx, 'FINISH!', W / 2, 42, '#ffd21f', 3, 'center', '#000');
  let y = 72;
  if (g.mode === 'race') {
    drawText(ctx, `${ordinal(r.position)} PLACE`, W / 2, y, r.position === 1 ? '#7dff8a' : '#ffffff', 2, 'center', '#000');
    y += 22;
  }
  drawText(ctx, `TIME  ${fmtTime(r.time)}`, W / 2, y, '#ffffff', 1, 'center'); y += 11;
  drawText(ctx, r.isBest ? 'NEW BEST TIME!' : `BEST  ${fmtTime(r.prev)}`, W / 2, y, r.isBest ? '#7dff8a' : '#8fa0c0', 1, 'center'); y += 11;
  drawText(ctx, `QUALIFY ${fmtTime(g.track.def.qualify)}  ${r.qualified ? 'QUALIFIED!' : 'NOT QUALIFIED'}`, W / 2, y, r.qualified ? '#7dff8a' : '#ff6b6b', 1, 'center');
  if (r.timer < 1.2) return;
  g.menuItems.forEach((it, i) => {
    const sel = i === g.menuSel;
    drawText(ctx, it.label, W / 2, it.y, sel ? '#ffd21f' : '#ffffff', 1, 'center', '#000');
    if (sel && Math.floor(g.clock * 4) % 2) drawText(ctx, '>', W / 2 - 50, it.y, '#ffd21f');
  });
}

// ---------- main loop ----------
const STEP = 1 / 120;
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frameLogic();
  if (!g.paused) {
    acc += dt;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
  } else {
    sfx.engine(false, 0, false);
  }
  draw();
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (g.state === 'race' || g.state === 'countdown')) g.paused = true;
});

toTitle();
requestAnimationFrame(frame);

// expose for debugging / automated tests
window.__giggabike = { g, startRace, PHYS };
