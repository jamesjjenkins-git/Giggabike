// Keyboard + multi-touch input. Buttons: up, down, left, right, go, turbo, start, pause.
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'go', KeyJ: 'go', Space: 'go',
  KeyX: 'turbo', KeyK: 'turbo', ShiftLeft: 'turbo', ShiftRight: 'turbo',
  Enter: 'start',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
};

export class Input {
  constructor(canvas, toLogical) {
    this.keys = new Set();
    this.touchBtns = new Set();
    this.presses = {};
    this.taps = [];
    this.isTouch = false;
    this.onFirstGesture = null;

    const press = (name) => { this.presses[name] = (this.presses[name] || 0) + 1; };
    const gesture = () => { if (this.onFirstGesture) this.onFirstGesture(); };

    window.addEventListener('keydown', (e) => {
      const n = KEYMAP[e.code];
      if (!n) return;
      e.preventDefault();
      gesture();
      if (!this.keys.has(e.code)) press(n);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.touchBtns.clear(); });

    // On-screen buttons: recompute which are held from every active touch,
    // so sliding a thumb between buttons works.
    const updateTouches = (e) => {
      const now = new Set();
      for (const t of e.touches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const btn = el && el.closest && el.closest('[data-btn]');
        if (btn) now.add(btn.dataset.btn);
      }
      for (const b of now) if (!this.touchBtns.has(b)) press(b);
      for (const el of document.querySelectorAll('[data-btn]')) el.classList.toggle('held', now.has(el.dataset.btn));
      this.touchBtns = now;
    };
    const onTouch = (e) => {
      if (!this.isTouch) { this.isTouch = true; document.documentElement.classList.add('touch'); }
      gesture();
      const onBtn = [...e.changedTouches].some((t) => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        return el && el.closest && el.closest('[data-btn]');
      });
      if (e.type === 'touchstart' && !onBtn) {
        for (const t of e.changedTouches) {
          const p = toLogical(t.clientX, t.clientY);
          if (p) this.taps.push(p);
        }
      }
      updateTouches(e);
      if (e.cancelable) e.preventDefault();
    };
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      document.addEventListener(ev, onTouch, { passive: false });
    }
    // mouse clicks on the canvas count as taps (desktop menus)
    canvas.addEventListener('mousedown', (e) => {
      gesture();
      const p = toLogical(e.clientX, e.clientY);
      if (p) this.taps.push(p);
    });
  }

  held(name) {
    if (this.touchBtns.has(name)) return true;
    for (const k of this.keys) if (KEYMAP[k] === name) return true;
    return false;
  }

  consume(name) {
    const n = this.presses[name] || 0;
    this.presses[name] = 0;
    return n;
  }

  consumeTaps() {
    const t = this.taps;
    this.taps = [];
    return t;
  }

  clear() {
    this.presses = {};
    this.taps = [];
  }

  state() {
    return {
      up: this.held('up'), down: this.held('down'),
      left: this.held('left'), right: this.held('right'),
      go: this.held('go'), turbo: this.held('turbo'),
    };
  }
}
