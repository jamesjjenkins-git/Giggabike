// Tiny 5x7 bitmap font. Each glyph is 7 rows, each row a base-32 digit (5 bits, MSB = left pixel).
const G = {
  '0': 'ehjlphe', '1': '4c4444e', '2': 'eh1248v', '3': 'v2421he', '4': '26aiv22',
  '5': 'vgu11he', '6': '68guhhe', '7': 'v124888', '8': 'ehhehhe', '9': 'ehhf12c',
  A: 'ehhvhhh', B: 'uhhuhhu', C: 'ehggghe', D: 'sihhhis', E: 'vgguggv', F: 'vgguggg',
  G: 'ehgnhhf', H: 'hhhvhhh', I: 'e44444e', J: '72222ic', K: 'hikokih', L: 'ggggggv',
  M: 'hrllhhh', N: 'hhpljhh', O: 'ehhhhhe', P: 'uhhuggg', Q: 'ehhhlid', R: 'uhhukih',
  S: 'fgge11u', T: 'v444444', U: 'hhhhhhe', V: 'hhhhha4', W: 'hhhllla',
  X: 'hha4ahh', Y: 'hha4444', Z: 'v1248gv',
  ':': '0cc0cc0', '.': '00000cc', '/': '01248g0', '!': '4444404', '-': '000e000',
  '?': 'eh12404', ' ': '0000000', "'": '4480000', '>': '8421248', '<': '248g842', '+': '044v440', '=': '00v0v00', '(': '2488842', ')': '8422248',
};

const CW = 5, CH = 7, ADV = 6;
const chars = Object.keys(G);
const index = new Map(chars.map((c, i) => [c, i]));
let atlas = null;
const tinted = new Map();

function buildAtlas() {
  atlas = document.createElement('canvas');
  atlas.width = chars.length * ADV;
  atlas.height = CH;
  const c = atlas.getContext('2d');
  c.fillStyle = '#fff';
  chars.forEach((ch, i) => {
    const rows = G[ch];
    for (let y = 0; y < CH; y++) {
      const v = parseInt(rows[y] || '0', 32);
      for (let x = 0; x < CW; x++) if (v & (16 >> x)) c.fillRect(i * ADV + x, y, 1, 1);
    }
  });
}

function getTinted(color) {
  if (!atlas) buildAtlas();
  let t = tinted.get(color);
  if (!t) {
    t = document.createElement('canvas');
    t.width = atlas.width; t.height = atlas.height;
    const c = t.getContext('2d');
    c.drawImage(atlas, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, t.width, t.height);
    tinted.set(color, t);
  }
  return t;
}

export function textWidth(s, scale = 1) {
  return String(s).length * ADV * scale - scale;
}

export function drawText(ctx, s, x, y, color = '#fff', scale = 1, align = 'left', shadow = null) {
  s = String(s).toUpperCase();
  const w = textWidth(s, scale);
  if (align === 'center') x -= Math.floor(w / 2);
  else if (align === 'right') x -= w;
  if (shadow) drawText(ctx, s, x + scale, y + scale, shadow, scale, 'left');
  const img = getTinted(color);
  for (let i = 0; i < s.length; i++) {
    const idx = index.get(s[i]);
    if (idx === undefined) continue;
    ctx.drawImage(img, idx * ADV, 0, CW, CH, Math.round(x + i * ADV * scale), Math.round(y), CW * scale, CH * scale);
  }
}
