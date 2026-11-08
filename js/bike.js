import { PHYS as P, LANES } from './config.js';
import { clamp } from './util.js';

export class Bike {
  constructor(track, lane, x, colors, opts = {}) {
    this.track = track;
    this.x = x;
    this.lane = lane;
    this.z = 0;
    this.vz = 0;
    this.v = 0;
    this.pitch = 0;
    this.wheelie = 0;
    this.air = false;
    this.airTime = 0;
    this.heat = 0;
    this.state = 'ride'; // ride | overheat | crash
    this.timer = 0;
    this.colors = colors;
    this.isPlayer = !!opts.isPlayer;
    this.capScale = opts.capScale || 1;
    this.name = opts.name || '';
    this.ai = opts.ai || null;
    this.finished = false;
    this.finishTime = 0;
    this.events = [];
    this.lastDecal = null;
    this.turboOn = false;
    this.crash = { x: 0, z: 0, vx: 0, vz: 0, spin: 0, spinV: 0, rx: 0, rz: 0, rvx: 0, rvz: 0, rspin: 0 };
  }

  get depth() { return this.lane + 0.5; }
  emit(type, data) { this.events.push({ type, ...data }); }

  crashNow() {
    if (this.state === 'crash') return;
    const c = this.crash;
    c.x = this.x; c.z = this.z;
    c.vx = Math.max(30, this.v * 0.45); c.vz = 80 + this.v * 0.25;
    c.spin = this.pitch; c.spinV = -(8 + this.v * 0.03);
    c.rx = this.x; c.rz = this.z + 6;
    c.rvx = this.v * 0.7 + 20; c.rvz = 130 + this.v * 0.2; c.rspin = 0;
    this.state = 'crash';
    this.timer = P.CRASH_TIME;
    this.v = 0; this.air = false; this.airTime = 0; this.wheelie = 0;
    this.emit('crash');
  }

  updateCrash(dt, inp) {
    const T = this.track;
    const c = this.crash;
    const step = (px, pz, vxk, vzk) => {
      c[vzk] -= P.G * dt;
      c[pz] += c[vzk] * dt;
      c[px] += c[vxk] * dt;
      const g = T.height(c[px]);
      if (c[pz] < g) {
        c[pz] = g;
        c[vzk] = Math.abs(c[vzk]) > 40 ? -c[vzk] * 0.35 : 0;
        c[vxk] *= 0.6;
        return true;
      }
      return false;
    };
    if (step('x', 'z', 'vx', 'vz')) c.spinV *= 0.5;
    c.spin += c.spinV * dt;
    if (!step('rx', 'rz', 'rvx', 'rvz')) c.rspin -= 9 * dt;
    else c.rspin *= 0.8;
    this.x = c.x;
    this.heat = Math.max(0, this.heat - P.HEAT_IDLE * dt);
    // mashing GO gets you back on the bike faster
    if (inp.goPressed) this.timer -= 0.12 * inp.goPressed;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.state = 'ride';
      this.x = T.safeX(c.x);
      this.z = T.height(this.x);
      this.pitch = 0;
      this.vz = 0;
      this.air = false;
      this.emit('recover');
    }
  }

  update(dt, inp) {
    const T = this.track;
    this.events.length = this.events.length > 32 ? 0 : this.events.length;
    if (this.state === 'crash') { this.updateCrash(dt, inp); return; }

    const over = this.state === 'overheat';
    if (over) {
      this.timer -= dt;
      this.heat = Math.max(0, (100 * this.timer) / P.OVERHEAT_TIME);
      if (this.timer <= 0) { this.state = 'ride'; this.heat = 0; this.emit('recover'); }
    }
    const fin = this.finished;
    const go = over ? false : fin ? true : (inp.go || inp.turbo);
    const turbo = !over && !fin && inp.turbo;
    this.turboOn = turbo;
    const steerOk = !over && !fin;

    // ---- heat ----
    if (!over) {
      if (turbo) this.heat += P.HEAT_UP * dt;
      else this.heat -= (go ? P.HEAT_DOWN : P.HEAT_IDLE) * dt;
      this.heat = clamp(this.heat, 0, 100);
      if (this.heat >= 100) {
        this.state = 'overheat';
        this.timer = P.OVERHEAT_TIME;
        this.emit('overheat');
      }
    }

    if (!this.air) {
      // ---- lane changes (only on the ground) ----
      const ls = P.LANE_SPEED * clamp(this.v / 50, 0, 1);
      if (steerOk && inp.up) this.lane += ls * dt;
      else if (steerOk && inp.down) this.lane -= ls * dt;
      else {
        const t = Math.round(this.lane);
        const dl = t - this.lane;
        const s = Math.max(ls, 1.5) * dt;
        this.lane += Math.abs(dl) <= s ? dl : Math.sign(dl) * s;
      }
      this.lane = clamp(this.lane, 0, LANES - 1);

      // ---- surface ----
      const li = Math.round(this.lane);
      const dec = T.decalAt(this.x, li);
      let cap = (turbo ? P.V_TURBO : P.V_MAX) * this.capScale;
      let decay = 1.2;
      if (dec) {
        if (dec.t === 'mud') {
          cap = Math.min(cap, this.wheelie > 0.25 ? P.V_MUD_WHEELIE : P.V_MUD);
          decay = 4;
          if (this.v > 25) this.emit('mud');
        } else if (dec.t === 'arrow') {
          if (dec !== this.lastDecal && this.heat > 1) this.emit('cool');
          if (!over) this.heat = 0;
        } else if (dec.t === 'boost' && dec !== this.lastDecal) {
          this.v = Math.max(this.v, P.V_PAD * this.capScale);
          this.emit('boost');
        }
      }
      this.lastDecal = dec;

      if (go) {
        if (this.v < cap) this.v = Math.min(cap, this.v + (turbo ? P.ACC_TURBO : P.ACC) * dt);
        else this.v -= (this.v - cap) * decay * dt;
      } else {
        if (this.v > cap) this.v -= (this.v - cap) * decay * dt;
        this.v -= (over ? 160 : P.DRAG) * dt;
      }
      this.v -= clamp(T.slopeBack(this.x), -1, 1) * 60 * dt;
      this.v = Math.max(0, this.v);

      // ---- move along terrain ----
      const sb = T.slopeBack(this.x);
      const vz = this.v * clamp(sb, -2, 2);
      const nx = this.x + this.v * dt;
      const hz = T.height(nx);
      if (hz - this.z > 6) { this.crashNow(); return; } // rode into a wall
      const zAir = this.z + vz * dt - 0.5 * P.G * dt * dt;
      this.x = nx;
      if (hz < zAir - 0.3 && this.v > 30) {
        this.air = true;
        this.airTime = 0;
        this.z = zAir;
        this.vz = vz - P.G * dt;
        this.emit('launch');
      } else {
        this.z = hz;
      }

      // ---- wheelie (lean back on the ground) ----
      if (steerOk && inp.left && this.v > 20) this.wheelie += 1.6 * dt;
      else this.wheelie -= 2.4 * dt;
      if (steerOk && inp.right) this.wheelie -= 2 * dt;
      this.wheelie = clamp(this.wheelie, 0, 2);
      if (this.wheelie > 1.05) { this.crashNow(); return; } // looped out
      if (!this.air) this.pitch = Math.atan(clamp(T.slopeBack(this.x), -1.5, 1.5)) + this.wheelie;
    } else {
      // ---- airborne ----
      this.airTime += dt;
      this.x += this.v * dt;
      this.vz -= P.G * dt;
      this.z += this.vz * dt;
      const rot = 3.0;
      if (steerOk && inp.left) this.pitch += rot * dt;
      else if (steerOk && inp.right) this.pitch -= rot * dt;
      else {
        const tgt = Math.atan2(this.vz, Math.max(this.v, 1)) * 0.6;
        this.pitch += clamp(tgt - this.pitch, -1.2 * dt, 1.2 * dt);
      }
      this.pitch = clamp(this.pitch, -1.3, 1.3);
      const hz = T.height(this.x);
      if (hz - this.z > 6) { this.crashNow(); return; } // hit the face of a ramp
      if (this.z <= hz) this.land(hz);
    }
  }

  land(hz) {
    const T = this.track;
    const gs = Math.atan(clamp(T.slopeFwd(this.x), -3, 3));
    const diff = this.pitch - gs;
    const hard = this.airTime > 0.3;
    const impact = -this.vz;
    this.air = false;
    this.z = hz;
    this.vz = 0;
    this.airTime = 0;
    if (hard && Math.abs(diff) > 0.75) { this.crashNow(); return; }
    if (hard && Math.abs(diff) > 0.38) {
      this.v *= 0.55;
      this.emit('bobble');
    } else if (hard && gs < -0.12 && Math.abs(diff) < 0.2) {
      this.v = Math.min(this.v * 1.08 + 10, P.V_PAD);
      this.emit('perfect');
    } else {
      this.emit('land', { impact });
    }
    this.wheelie = clamp(diff, 0, 0.4);
    this.pitch = gs + this.wheelie;
  }
}

// ---- Computer riders ----
export function makeAI(rng) {
  return {
    think: 0,
    target: null,
    hot: 55 + rng() * 25,
    cooling: false,
    sloppy: rng() * 0.12,
  };
}

export function aiInput(b, T, bikes, dt) {
  const ai = b.ai;
  const inp = { go: true, turbo: false, up: false, down: false, left: false, right: false, goPressed: 0 };
  if (b.state === 'crash') { inp.goPressed = Math.random() < dt * 6 ? 1 : 0; return inp; }

  // turbo with hysteresis so the CPU never overheats
  if (b.heat > ai.hot) ai.cooling = true;
  if (b.heat < 15) ai.cooling = false;
  inp.turbo = !ai.cooling;

  if (!b.air) {
    ai.think -= dt;
    if (ai.think <= 0 || ai.target == null) {
      ai.think = 0.25 + Math.random() * 0.2;
      const cur = Math.round(b.lane);
      let best = cur, bestCost = Infinity;
      for (let l = Math.max(0, cur - 1); l <= Math.min(3, cur + 1); l++) {
        let cost = Math.abs(l - cur) * 0.4 + Math.random() * 0.3;
        for (let dx = 15; dx < 150; dx += 15) {
          const d = T.decalAt(b.x + dx, l);
          if (!d) continue;
          if (d.t === 'mud') cost += 1.2;
          else if (d.t === 'arrow' && b.heat > 35) cost -= 0.8;
          else if (d.t === 'boost') cost -= 0.4;
        }
        for (const o of bikes) {
          if (o === b) continue;
          if (Math.abs(o.lane - l) < 0.7) {
            const dx = o.x - b.x;
            if (dx > -6 && dx < 60 && (o.v < b.v + 10 || o.state !== 'ride')) cost += 2.5;
          }
        }
        if (cost < bestCost) { bestCost = cost; best = l; }
      }
      ai.target = best;
    }
    if (ai.target > b.lane + 0.08) inp.up = true;
    else if (ai.target < b.lane - 0.08) inp.down = true;
    // wheelie through mud
    const dm = T.decalAt(b.x + 10, Math.round(b.lane));
    if (dm && dm.t === 'mud' && b.wheelie < 0.45) inp.left = true;
  } else {
    // line the bike up with where it's going to land
    let tgt = Math.atan2(b.vz, b.v) * 0.6;
    if (b.vz < 0) {
      const tLand = Math.max(0.05, (b.z - T.height(b.x + b.v * 0.15)) / Math.max(40, -b.vz));
      const lx = b.x + b.v * Math.min(tLand, 0.4);
      tgt = Math.atan(clamp(T.slopeFwd(lx), -1.5, 1.5)) + ai.sloppy;
    }
    if (b.pitch < tgt - 0.06) inp.left = true;
    else if (b.pitch > tgt + 0.06) inp.right = true;
  }
  return inp;
}
