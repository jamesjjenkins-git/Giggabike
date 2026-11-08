import { W, H, GROUND_Y, LANE_H, SKEW, LANES, START_X } from './config.js';
import { hash, clamp, fmtTime, ordinal } from './util.js';
import { drawText } from './font.js';
import { bikeSprite, riderSprite, SW, SH } from './sprites.js';

export const proj = (x, d, h, cam) => [
  Math.round(x - cam + d * SKEW),
  Math.round(GROUND_Y - d * LANE_H - h),
];

const FAR_Y = GROUND_Y - LANES * LANE_H; // far edge of the track
const STANDS_Y = 34;
const STANDS_W = 512;
const FENCE_W = 576;
const HUD_Y = 188;

function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#ffdbac', '#e0ac69'];
const SHIRTS = ['#e83a3a', '#2f6fd0', '#ffd21f', '#5fd13b', '#ffffff', '#ff7a1a', '#a46bff', '#e8338a', '#29b6ff'];
const ADS = ['GIGGA', 'TURBO', 'MUD!', 'JUMP', 'ZOOM', 'DIRT', 'RACE', 'GO GO', 'BIKE', 'WOW', 'MOTO', 'FAST'];
const AD_COLS = [['#e83a3a', '#fff'], ['#1f4fd8', '#ffd21f'], ['#ffd21f', '#1d1d1d'], ['#1d1d1d', '#5fd13b'], ['#f4f4f4', '#e83a3a'], ['#5fd13b', '#1d1d1d']];

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.pal = null;
    this.stands = [];
    this.fence = null;
  }

  setTrack(track) {
    this.track = track;
    this.pal = track.def.palette;
    this.buildStands();
    this.buildFence();
  }

  buildStands() {
    const p = this.pal;
    this.stands = [0, 1].map((frame) => {
      const cv = document.createElement('canvas');
      cv.width = STANDS_W; cv.height = FAR_Y - STANDS_Y; // down to the far edge of the track
      const c = cv.getContext('2d');
      const roofY = 10;
      // scoreboard tower poking above the roof
      c.fillStyle = '#1b1b1b'; c.fillRect(300, 0, 76, 12);
      c.fillStyle = '#3a3a3a'; c.fillRect(301, 1, 74, 10);
      drawText(c, 'GIGGA', 338, 2, '#ffd21f', 1, 'center');
      if (p.night) {
        // light towers
        for (const lx of [60, 188, 444]) {
          c.fillStyle = '#555c78'; c.fillRect(lx, 0, 2, roofY);
          c.fillStyle = '#fffbd0'; c.fillRect(lx - 4, 0, 10, 3);
        }
      }
      // roof
      c.fillStyle = p.roof; c.fillRect(0, roofY, STANDS_W, 6);
      c.fillStyle = p.roof2;
      for (let x = 0; x < STANDS_W; x += 16) c.fillRect(x, roofY, 8, 6);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, roofY + 6, STANDS_W, 1);
      // tiers
      const tierTop = roofY + 7, tierBot = 60;
      c.fillStyle = p.stands; c.fillRect(0, tierTop, STANDS_W, tierBot - tierTop);
      for (let r = 0, y = tierTop + 1; y < tierBot - 3; r++, y += 4) {
        c.fillStyle = p.standsDark; c.fillRect(0, y + 3, STANDS_W, 1);
        for (let x = 1; x < STANDS_W - 2; x += 3) {
          const hv = hash(x * 31 + r * 977);
          if (hv > 0.82) continue;
          const skin = SKIN[Math.floor(hash(x * 7 + r * 13) * SKIN.length)];
          const shirt = SHIRTS[Math.floor(hash(x * 11 + r * 17) * SHIRTS.length)];
          const cheer = frame === 1 && hash(x * 5 + r * 3) < 0.35;
          const hy = y + (cheer ? -1 : 0);
          c.fillStyle = skin; c.fillRect(x, hy, 2, 2);
          c.fillStyle = shirt; c.fillRect(x, hy + 2, 2, 1);
          if (cheer) { c.fillStyle = skin; c.fillRect(x - 1, hy - 1, 1, 1); c.fillRect(x + 2, hy - 1, 1, 1); }
        }
      }
      // pillars
      c.fillStyle = p.standsDark;
      for (let x = 0; x < STANDS_W; x += 128) c.fillRect(x, tierTop, 3, tierBot - tierTop);
      // front wall
      c.fillStyle = p.wall; c.fillRect(0, tierBot, STANDS_W, cv.height - tierBot);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, tierBot, STANDS_W, 1);
      return cv;
    });
  }

  buildFence() {
    const cv = document.createElement('canvas');
    cv.width = FENCE_W; cv.height = 12;
    const c = cv.getContext('2d');
    for (let i = 0; i < FENCE_W / 48; i++) {
      const [bg, fg] = AD_COLS[i % AD_COLS.length];
      c.fillStyle = bg; c.fillRect(i * 48, 0, 47, 11);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(i * 48, 10, 47, 1);
      drawText(c, ADS[i % ADS.length], i * 48 + 24, 2, fg, 1, 'center');
    }
    c.fillStyle = '#222'; c.fillRect(0, 11, FENCE_W, 1);
    this.fence = cv;
  }

  // ---------- world ----------
  drawWorld(g) {
    const ctx = this.ctx, p = this.pal, T = g.track, cam = Math.round(g.cam), t = g.clock;
    this.drawSky(cam, t);

    // grandstand (parallax)
    const so = Math.floor(cam * 0.6) % STANDS_W;
    const st = this.stands[(g.excite > 0 && Math.floor(t * 8) % 2) || Math.floor(t * 1.5) % 4 === 0 ? 1 : 0];
    for (let x = -so; x < W; x += STANDS_W) ctx.drawImage(st, x, STANDS_Y);

    // ad fence at the far side of the track
    const fo = ((cam - LANES * SKEW) % FENCE_W + FENCE_W) % FENCE_W;
    for (let x = -fo; x < W; x += FENCE_W) ctx.drawImage(this.fence, x, FAR_Y - 14);
    ctx.fillStyle = p.grass; ctx.fillRect(0, FAR_Y - 2, W, 2);

    // lanes
    for (let l = 0; l < LANES; l++) {
      ctx.fillStyle = p.dirt[l % 2];
      ctx.fillRect(0, GROUND_Y - (l + 1) * LANE_H, W, LANE_H);
    }
    // dirt speckle (gives the sense of speed)
    const x0 = Math.floor((cam - 30) / 6) * 6;
    for (let wx = x0; wx < cam + W; wx += 6) {
      for (let l = 0; l < LANES; l++) {
        const hv = hash(wx * 13 + l * 7919);
        if (hv > 0.4) continue;
        const d = l + hash(wx * 3 + l * 101);
        const [sx, sy] = proj(wx, d, 0, cam);
        ctx.fillStyle = hv < 0.2 ? p.dirtLight : p.dirtDark;
        ctx.fillRect(sx, sy, hv < 0.07 ? 2 : 1, 1);
      }
    }
    // lane dividers
    ctx.fillStyle = p.line;
    for (let l = 1; l < LANES; l++) {
      const y = GROUND_Y - l * LANE_H;
      const off = l * SKEW;
      for (let wx = Math.floor((cam - off) / 24) * 24; wx < cam + W; wx += 24) ctx.fillRect(wx - cam + off, y, 10, 1);
    }
    // near kerb
    for (let wx = Math.floor(cam / 12) * 12; wx < cam + W; wx += 12) {
      ctx.fillStyle = p.kerb[(wx / 12) & 1];
      ctx.fillRect(wx - cam, GROUND_Y, 12, 6);
    }
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, GROUND_Y + 6, W, 2);

    // start / lap / finish lines
    for (let k = 0; k <= T.laps; k++) this.drawLine(START_X + k * T.lapLength, k, T.laps, cam);

    const a = cam - 40, b = cam + W + 40;
    for (const d of T.decalsInRange(a, b)) this.drawDecal(d, cam, t);
    for (const r of T.rampsInRange(a, b)) this.drawRamp(r, cam);
  }

  drawSky(cam, t) {
    const ctx = this.ctx, p = this.pal;
    const bands = [[0, 20, p.sky[0]], [20, 34, p.sky[1]], [34, 60, p.sky[2]]];
    for (const [y0, y1, c] of bands) { ctx.fillStyle = c; ctx.fillRect(0, y0, W, y1 - y0); }
    // dithered band edges
    for (let i = 0; i < 2; i++) {
      const [, yb] = bands[i];
      ctx.fillStyle = bands[i][2];
      for (let x = 0; x < W; x += 2) ctx.fillRect(x + (i & 1), yb, 1, 1);
      ctx.fillStyle = bands[i + 1][2];
      for (let x = 1; x < W; x += 2) ctx.fillRect(x - (i & 1), yb - 1, 1, 1);
    }
    if (p.night) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 60; i++) {
        const sx = Math.floor((hash(i * 7) * 900 - cam * 0.05) % W + W) % W;
        const sy = Math.floor(hash(i * 13) * 40);
        if (hash(i + Math.floor(t * 2)) > 0.1) ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.fillStyle = '#f4f0d0'; ctx.fillRect(320, 6, 8, 8); ctx.fillStyle = p.sky[0]; ctx.fillRect(323, 5, 6, 7);
    } else {
      // clouds
      ctx.fillStyle = p.cloud;
      for (let i = 0; i < 6; i++) {
        const cx = Math.floor(((hash(i * 17) * 800 - cam * 0.08 - t * 4) % 520 + 520) % 520) - 60;
        const cy = 6 + Math.floor(hash(i * 29) * 22);
        ctx.fillRect(cx, cy, 26, 4); ctx.fillRect(cx + 5, cy - 3, 12, 3); ctx.fillRect(cx + 14, cy - 5, 8, 3);
      }
    }
    // far hills (parallax)
    const noise = (v) => {
      const i = Math.floor(v), f = v - i;
      const s = f * f * (3 - 2 * f);
      return hash(i * 97) * (1 - s) + hash((i + 1) * 97) * s;
    };
    for (let x = 0; x < W; x += 2) {
      const wx = (x + cam * 0.2) / 40;
      const h = 8 + noise(wx) * 22;
      ctx.fillStyle = p.hills2; ctx.fillRect(x, 60 - h, 2, h);
      const h2 = 4 + noise(wx * 1.7 + 50) * 12;
      ctx.fillStyle = p.hills; ctx.fillRect(x, 60 - h2, 2, h2);
    }
  }

  drawLine(x, k, laps, cam) {
    const ctx = this.ctx;
    if (x < cam - 60 || x > cam + W + 60) return;
    for (let r = 0; r < LANES * 4; r++) {
      const d = (r + 0.5) / 4;
      const [sx, sy] = proj(x, d, 0, cam);
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#ffffff' : '#141414';
        ctx.fillRect(sx - 4 + c * 4, sy - 2, 4, 4);
      }
    }
    // banner on the far side
    const label = k === 0 ? 'START' : k === laps ? 'FINISH' : 'LAP ' + (k + 1);
    const [bx, by] = proj(x, LANES, 0, cam);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(bx - 26, by - 40, 2, 40);
    ctx.fillRect(bx + 24, by - 40, 2, 40);
    ctx.fillStyle = k === laps ? '#e83a3a' : '#1f4fd8';
    ctx.fillRect(bx - 28, by - 46, 56, 11);
    drawText(ctx, label, bx, by - 44, '#ffffff', 1, 'center');
  }

  lanePoly(x0, x1, l0, l1, h, cam) {
    return [proj(x0, l0, h, cam), proj(x1, l0, h, cam), proj(x1, l1, h, cam), proj(x0, l1, h, cam)];
  }

  drawDecal(d, cam, t) {
    const ctx = this.ctx, p = this.pal;
    for (const l of d.lanes) {
      if (d.t === 'mud') {
        poly(ctx, this.lanePoly(d.x0, d.x1, l + 0.08, l + 0.92, 0, cam), p.mud);
        for (let wx = d.x0 + 4; wx < d.x1 - 6; wx += 7) {
          const hv = hash(wx * 7 + l * 31);
          const [sx, sy] = proj(wx + hv * 4, l + 0.2 + hv * 0.6, 0, cam);
          ctx.fillStyle = p.mudLight; ctx.fillRect(sx, sy, 3, 1);
          if (hv > 0.6) { ctx.fillStyle = '#2e1d0e'; ctx.fillRect(sx + 2, sy + 2, 2, 1); }
        }
      } else {
        const boost = d.t === 'boost';
        if (boost) poly(ctx, this.lanePoly(d.x0, d.x1, l + 0.1, l + 0.9, 0, cam), (Math.floor(t * 10) % 2) ? '#1f6f8b' : '#18566c');
        const col = boost ? '#38e8ff' : '#ffe14d';
        const n = boost ? 3 : 2;
        for (let c = 0; c < n; c++) {
          for (let j = 0; j < 8; j++) {
            const dd = l + (j + 0.5) / 8;
            const off = (3.5 - Math.abs(j - 3.5)) * 1.3;
            const [sx, sy] = proj(d.x0 + 2 + c * 7 + off, dd, 0, cam);
            ctx.fillStyle = col; ctx.fillRect(sx, sy, 3, 2);
          }
        }
      }
    }
  }

  drawRamp(r, cam) {
    const ctx = this.ctx, p = this.pal, pts = r.pts;
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const [xa, ha] = pts[i - 1], [xb, hb] = pts[i];
      segs.push({ xa, ha, xb, hb, wall: xb - xa < 3 });
    }
    // walls first (left-facing ones get covered by the top surface)
    for (const s of segs) {
      if (!s.wall) continue;
      const top = Math.max(s.ha, s.hb);
      poly(ctx, [proj(s.xb, 0, 0, cam), proj(s.xb, 0, top, cam), proj(s.xb, LANES, top, cam), proj(s.xb, LANES, 0, cam)], p.rampWall);
    }
    for (const s of segs) {
      if (s.wall) continue;
      const col = s.hb > s.ha ? p.rampUp : s.hb < s.ha ? p.rampDown : p.rampFlat;
      poly(ctx, [proj(s.xa, 0, s.ha, cam), proj(s.xb, 0, s.hb, cam), proj(s.xb, LANES, s.hb, cam), proj(s.xa, LANES, s.ha, cam)], col);
      // lane lines continue across the ramp
      ctx.strokeStyle = p.line; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (let l = 1; l < LANES; l++) {
        const a = proj(s.xa, l, s.ha, cam), b = proj(s.xb, l, s.hb, cam);
        ctx.moveTo(a[0], a[1] + 0.5); ctx.lineTo(b[0], b[1] + 0.5);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // near face
    const face = pts.map(([x, h]) => proj(x, 0, h, cam));
    face.push(proj(pts[pts.length - 1][0], 0, 0, cam), proj(pts[0][0], 0, 0, cam));
    poly(ctx, face, p.rampFace);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(face[0][0], face[0][1]);
    for (let i = 1; i < face.length; i++) ctx.lineTo(face[i][0], face[i][1]);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = p.rampFaceLine;
    for (let h = 4; h < r.top; h += 5) ctx.fillRect(face[0][0], GROUND_Y - h, r.x1 - r.x0 + 2, 1);
    ctx.restore();
    // crisp top edge on the near face
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [sx, sy] = proj(pts[i][0], 0, pts[i][1], cam);
      if (i === 0) ctx.moveTo(sx, sy + 0.5); else ctx.lineTo(sx, sy + 0.5);
    }
    ctx.stroke();
  }

  // ---------- riders ----------
  drawBikes(g) {
    const ctx = this.ctx, T = g.track, cam = Math.round(g.cam), t = g.clock;
    const list = [...g.bikes].sort((a, b) => b.depth - a.depth || a.x - b.x);
    for (const b of list) {
      const d = b.depth;
      if (b.state === 'crash') {
        const c = b.crash;
        this.shadow(c.x, d, T.height(c.x), cam);
        this.shadow(c.rx, d, T.height(c.rx), cam);
        this.sprite(bikeSprite(b.colors), c.x, d, c.z, c.spin, cam, 12, 14);
        if (Math.floor(b.timer * 8) % 2 || b.timer > 1) this.sprite(riderSprite(b.colors), c.rx, d, c.rz, c.rspin, cam, 12, 8);
        continue;
      }
      if (b.x < cam - 40 || b.x > cam + W + 40) continue;
      this.shadow(b.x, d, T.height(b.x), cam);
      const [sx, sy] = proj(b.x, d, b.z, cam);
      ctx.save();
      // pivot on the rear wheel while wheelieing, otherwise the middle of the bike
      const pivot = !b.air && b.wheelie > 0.02 ? -7 : 0;
      ctx.translate(sx + pivot, sy);
      ctx.rotate(-b.pitch);
      ctx.translate(-pivot, 0);
      // bounce on rough ground
      const bob = !b.air && b.v > 40 && Math.floor(t * 20 + b.x) % 2 ? -1 : 0;
      if (b.turboOn && b.v > 20) {
        ctx.fillStyle = Math.floor(t * 30) % 2 ? '#ffd21f' : '#ff7a1a';
        ctx.fillRect(-13, -10 + bob, 2, 1);
        ctx.fillRect(-15 - Math.floor(t * 30) % 3, -10 + bob, 2, 1);
      }
      ctx.drawImage(bikeSprite(b.colors), -12, -SH + bob);
      ctx.drawImage(riderSprite(b.colors), -12, -SH + bob - (b.air ? 1 : 0));
      ctx.restore();
      if (b.isPlayer && g.bikes.length > 1) {
        ctx.fillStyle = '#ffffff';
        const ty = sy - 26 + (Math.floor(t * 3) % 2);
        ctx.fillRect(sx - 2, ty, 5, 1); ctx.fillRect(sx - 1, ty + 1, 3, 1); ctx.fillRect(sx, ty + 2, 1, 1);
      }
    }
  }

  sprite(img, x, d, z, ang, cam, cx, cy) {
    const ctx = this.ctx;
    const [sx, sy] = proj(x, d, z, cam);
    ctx.save();
    ctx.translate(sx, sy - (SH - cy));
    ctx.rotate(-ang);
    ctx.drawImage(img, -cx, -cy);
    ctx.restore();
  }

  shadow(x, d, h, cam) {
    const ctx = this.ctx;
    const [sx, sy] = proj(x, d, h, cam);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(sx - 9, sy - 1, 18, 2);
    ctx.fillRect(sx - 6, sy + 1, 12, 1);
  }

  drawParticles(g) {
    const ctx = this.ctx, cam = Math.round(g.cam);
    for (const p of g.particles) {
      const [sx, sy] = proj(p.x, p.d, p.z, cam);
      ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx, sy, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const f of g.texts) {
      const [sx, sy] = proj(f.x, f.d, f.z, cam);
      if (f.life < 0.3 && Math.floor(f.life * 20) % 2) continue;
      drawText(ctx, f.text, sx, sy, f.color, 1, 'center', '#000');
    }
  }

  // ---------- HUD ----------
  drawHUD(g) {
    const ctx = this.ctx, b = g.player, T = g.track;
    ctx.fillStyle = '#101018'; ctx.fillRect(0, HUD_Y, W, H - HUD_Y);
    ctx.fillStyle = '#2c2c40'; ctx.fillRect(0, HUD_Y, W, 1);

    const lap = clamp(Math.floor((b.x - START_X) / T.lapLength) + 1, 1, T.laps);
    drawText(ctx, 'TIME', 6, 192, '#8fa0c0');
    drawText(ctx, fmtTime(g.raceTime), 36, 192, '#ffffff');
    drawText(ctx, `LAP ${lap}/${T.laps}`, 100, 192, '#ffffff');
    if (g.mode === 'race') {
      drawText(ctx, 'POS', 160, 192, '#8fa0c0');
      drawText(ctx, `${ordinal(g.position)}`, 182, 192, '#ffd21f');
    } else {
      drawText(ctx, 'QUAL', 160, 192, '#8fa0c0');
      drawText(ctx, fmtTime(T.def.qualify), 188, 192, g.raceTime > T.def.qualify ? '#ff6b6b' : '#7dff8a');
    }
    const kmh = Math.round(b.v * 0.6);
    drawText(ctx, String(kmh).padStart(3, ' '), 330, 192, '#ffffff', 1, 'right');
    drawText(ctx, 'KM/H', 334, 192, '#8fa0c0');

    // temperature gauge
    drawText(ctx, 'TEMP', 6, 204, '#8fa0c0');
    const gx = 36, gy = 204, segs = 24, sw = 6;
    const lit = Math.ceil((b.heat / 100) * segs);
    const flash = b.heat > 80 && Math.floor(g.clock * 8) % 2;
    ctx.fillStyle = flash ? '#ff3b30' : '#2c2c40';
    ctx.fillRect(gx - 2, gy - 2, segs * sw + 3, 11);
    ctx.fillStyle = '#05050a';
    ctx.fillRect(gx - 1, gy - 1, segs * sw + 1, 9);
    for (let i = 0; i < segs; i++) {
      const f = i / segs;
      const on = i < lit;
      const col = f < 0.55 ? (on ? '#3ee05a' : '#123a1a') : f < 0.8 ? (on ? '#ffd21f' : '#3d3410') : (on ? '#ff3b30' : '#3d1210');
      ctx.fillStyle = col;
      ctx.fillRect(gx + i * sw, gy, sw - 1, 7);
    }
    if (b.state === 'overheat') {
      if (Math.floor(g.clock * 6) % 2) drawText(ctx, 'OVERHEAT!', gx + (segs * sw) / 2, gy, '#ffffff', 1, 'center', '#000');
    }
    const best = g.best;
    drawText(ctx, 'BEST', 196, 204, '#8fa0c0');
    drawText(ctx, best ? fmtTime(best) : '-:--.--', 224, 204, '#ffffff');
    if (b.state === 'crash') {
      drawText(ctx, g.touch ? 'TAP GO!' : 'MASH GO!', 378, 204, Math.floor(g.clock * 6) % 2 ? '#ffd21f' : '#ff7a1a', 1, 'right');
    } else if (b.turboOn) {
      drawText(ctx, 'TURBO', 378, 204, Math.floor(g.clock * 10) % 2 ? '#38e8ff' : '#ffffff', 1, 'right');
    }

    // race progress strip
    const px0 = 40, pw = W - 80;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px0 - 2, 2, pw + 4, 5);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(px0, 4, pw, 1);
    for (let k = 1; k < T.laps; k++) { ctx.fillStyle = '#888'; ctx.fillRect(px0 + (pw * k) / T.laps, 2, 1, 5); }
    for (const o of g.bikes) {
      const f = clamp((o.x - START_X) / (T.finishX - START_X), 0, 1);
      ctx.fillStyle = o.isPlayer ? '#ffffff' : o.colors.frame;
      ctx.fillRect(px0 + Math.round(f * pw) - 1, o.isPlayer ? 2 : 3, 3, o.isPlayer ? 5 : 3);
    }
  }
}
