// The Book Presentation Card: one 16:9 slide for the virtual book exhibition (and the printed card on the evidence board).
// drawCard() paints into any 16:9 canvas; makeCardCanvas() builds the QR and the cover and returns a finished canvas.
// Layout is designed on a 1920×1080 grid and scaled; the QR is redrawn module by module on whole device pixels.
import QRCode from 'qrcode';
import { FACES, BOOK_URL, TITLE_TXT, SUB_TXT, AUTHOR } from './pages.js';
import { grainTile, rng } from './paper.js';

// ---------- text (edit here) ----------
export const CARD_TEXT = {
  title: TITLE_TXT, // EVIDENCE
  subtitle: SUB_TXT, // A Casebook of Artificial Intelligence
  author: AUTHOR,
  team: 'Individual project',
  course: 'AI Fundamentals (AIF1303) · QAIRU · 2026',
  annotation: 'Every AI system works a case: it gathers evidence, follows leads and acts on the best explanation it has. In ten cases, from agents and search to probability, learning and language models, paper exhibits stand up from the pages of a casebook on a detective’s desk at night; lean over the book to read the full explanation.',
  cta: 'Scan to open the casebook',
  url: BOOK_URL,
};
export const teamLine = () => `${CARD_TEXT.author} · ${CARD_TEXT.team}`;

// ---------- look ----------
const F = { display: '"Special Elite", "Courier Prime", monospace', body: '"Courier Prime", "Courier New", monospace', title: '"Playfair Display", Georgia, serif' };
export const CARD_FONTS = ['400 40px "Special Elite"', '400 40px "Courier Prime"', '700 40px "Courier Prime"', '400 40px "Playfair Display"', '700 40px "Playfair Display"'];
const C = { paper: '#ebdfc3', tag: '#f8f3e6', ink: '#1f1711', ink2: '#54432f', red: '#a3271d', qr: '#000000' };
const COVER_ASPECT = 14.5 / 20.8; // board BW × BH

// 1920×1080 design grid
const G = {
  W: 1920, H: 1080,
  cover: { x: 96, y: 105, h: 870 },
  col: 766, // text column left edge
  right: 1824, // right margin
  top: 105, bottom: 975,
  qr: 396, // QR side without quiet zone (33 modules × 12 px at 1080p)
  pad: 60, // tag padding = quiet zone (5 modules; the frame line sits outside 4 modules)
  gutter: 44, // text column → tag
};

export async function loadCardFonts() {
  await Promise.all(CARD_FONTS.map(f => document.fonts.load(f, 'EVIDENCE Aa·’—')));
  await document.fonts.ready;
  const missing = CARD_FONTS.filter(f => !document.fonts.check(f));
  if (missing.length) console.warn('card: fonts not loaded', missing);
  return missing;
}

// ---------- QR: read the module matrix from any qrcode canvas (margin 0, any scale) ----------
function qrMatrix(src) {
  let c = src;
  if (!(src instanceof HTMLCanvasElement) || !src.getContext) { c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); }
  const w = c.width, h = c.height, d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const dark = (x, y) => { const i = (y * w + x) * 4; return d[i + 3] > 127 && d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 128; };
  // bounding box of dark pixels (tolerates a margin)
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dark(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  // top-left finder pattern: first dark run on the top row is 7 modules wide
  let run = 0; while (x0 + run <= x1 && dark(x0 + run, y0)) run++;
  const m = run / 7, n = Math.round((x1 - x0 + 1) / m);
  const M = []; for (let j = 0; j < n; j++) { const row = []; for (let i = 0; i < n; i++) row.push(dark(Math.min(w - 1, Math.floor(x0 + (i + 0.5) * m)), Math.min(h - 1, Math.floor(y0 + (j + 0.5) * m)))); M.push(row); }
  return M;
}
// draw the modules at device pixels: every edge on a whole pixel, horizontal runs merged (no seams)
function drawModules(ctx, M, X, Y, side, color) {
  const n = M.length, e = k => Math.round(k * side / n);
  ctx.fillStyle = color;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!M[j][i]) continue; let k = i; while (k + 1 < n && M[j][k + 1]) k++;
    ctx.fillRect(Math.round(X) + e(i), Math.round(Y) + e(j), e(k + 1) - e(i), e(j + 1) - e(j)); i = k;
  }
}

// ---------- helpers (design units) ----------
function text(g, str, x, y, { font, color = C.ink, align = 'left', track = 0, baseline = 'alphabetic' }) {
  g.font = font; g.fillStyle = color; g.textBaseline = baseline; g.letterSpacing = track + 'px';
  const w = g.measureText(str).width - track; // letterSpacing adds one trailing space
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  g.textAlign = 'left'; g.fillText(str, x0, y); g.letterSpacing = '0px';
  return w;
}
function wrap(g, str, font, width) {
  g.font = font; const lines = []; let line = '';
  for (const word of str.split(/\s+/)) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > width && line) { lines.push(line); line = word; } else line = t; }
  if (line) lines.push(line); return lines;
}
function paper(g, W, H, s) {
  g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
  // grain at a fixed design scale
  const pat = g.createPattern(grainTile(512, 7), 'repeat'); pat.setTransform(new DOMMatrix().scale(Math.max(1, s)));
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5; g.fillStyle = pat; g.fillRect(0, 0, W, H); g.restore();
  // lamp: warm light from the upper left, aged edges
  const lamp = g.createRadialGradient(W * 0.3, H * 0.18, 0, W * 0.3, H * 0.18, W * 0.75);
  lamp.addColorStop(0, 'rgba(255,246,222,.32)'); lamp.addColorStop(1, 'rgba(255,246,222,0)');
  g.fillStyle = lamp; g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(96,58,22,0)'); v.addColorStop(1, 'rgba(96,58,22,.30)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  // foxing
  const r = rng(1303);
  for (let k = 0; k < 90; k++) {
    const x = r() * W, y = r() * H, rad = (1.5 + r() * r() * 9) * s, a = 0.04 + r() * 0.08;
    const sp = g.createRadialGradient(x, y, 0, x, y, rad); sp.addColorStop(0, `rgba(122,74,30,${a})`); sp.addColorStop(1, 'rgba(122,74,30,0)');
    g.fillStyle = sp; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}
function coffeeRing(g, x, y, R) {
  g.save();
  g.strokeStyle = 'rgba(120,76,34,.10)'; g.lineWidth = 7; g.beginPath(); g.arc(x, y, R, 0.2, 5.6); g.stroke();
  g.strokeStyle = 'rgba(120,76,34,.07)'; g.lineWidth = 2.5; g.beginPath(); g.arc(x + 3, y - 2, R - 9, 0.9, 6.0); g.stroke();
  g.fillStyle = 'rgba(120,76,34,.035)'; g.beginPath(); g.arc(x, y, R - 4, 0, 7); g.fill();
  g.restore();
}
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const resampled = new WeakMap();
function resample(img, dw, dh) {
  if (img.width === dw && img.height === dh) return img;
  const key = dw + 'x' + dh, hit = resampled.get(img); if (hit && hit.key === key) return hit.c;
  let src = img, w = img.width, h = img.height;
  while (w > dw * 2 && h > dh * 2) { const c = canvasOf(Math.ceil(w / 2), Math.ceil(h / 2)), cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(src, 0, 0, c.width, c.height); src = c; w = c.width; h = c.height; }
  const c = canvasOf(dw, dh), cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(src, 0, 0, dw, dh);
  resampled.set(img, { key, c }); return c;
}
let linen = null;
function linenTile(N = 256) {
  if (linen) return linen;
  const c = canvasOf(N, N), g = c.getContext('2d'), r = rng(77);
  const id = g.createImageData(N, N), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = 128 + (r() - 0.5) * 22; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  for (let k = 0; k < 1400; k++) { // short warp/weft slubs
    const hz = r() < 0.5, x = Math.floor(r() * N), y = Math.floor(r() * N), l = 3 + r() * 16;
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.1})` : `rgba(0,0,0,${0.05 + r() * 0.12})`;
    if (hz) { g.fillRect(x, y, l, 1); if (x + l > N) g.fillRect(x - N, y, l, 1); } else { g.fillRect(x, y, 1, l); if (y + l > N) g.fillRect(x, y - N, 1, l); }
  }
  return (linen = c);
}
// the closed hardcover, photographed flat: contact + ambient shadow, hinge groove, lamp falloff
function bookCover(g, img, x, y, w, h) {
  const rr = 5;
  g.save();
  g.fillStyle = '#2a120e';
  g.shadowColor = 'rgba(38,20,6,.42)'; g.shadowBlur = 46; g.shadowOffsetX = 14; g.shadowOffsetY = 22;
  g.beginPath(); g.roundRect(x, y, w, h, rr); g.fill();
  g.shadowColor = 'rgba(30,14,4,.55)'; g.shadowBlur = 7; g.shadowOffsetX = 2; g.shadowOffsetY = 4; g.fill();
  g.restore();
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, rr); g.clip();
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  // cover on whole device pixels: resampled once (halving steps) so the cloth threads average out instead of aliasing
  const t = g.getTransform(), dx = Math.round(t.a * x + t.e), dy = Math.round(t.d * y + t.f), dw = Math.round(t.a * w), dh = Math.round(t.d * h);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (img) g.drawImage(resample(img, dw, dh), dx, dy);
  // linen: fibre slubs + fine noise at device resolution
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55; g.fillStyle = g.createPattern(linenTile(), 'repeat'); g.fillRect(dx, dy, dw, dh);
  g.restore();
  // hinge groove near the spine
  const hx = x + w * 0.052;
  let gr = g.createLinearGradient(hx - 10, 0, hx + 14, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(0,0,0,.42)'); gr.addColorStop(0.62, 'rgba(255,225,200,.10)'); gr.addColorStop(1, 'rgba(255,225,200,0)');
  g.fillStyle = gr; g.fillRect(hx - 10, y, 24, h);
  // spine-side roll and lamp falloff across the board
  gr = g.createLinearGradient(x, 0, x + w * 0.05, 0); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x, y, w * 0.05, h);
  gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, 'rgba(255,236,205,.10)'); gr.addColorStop(0.5, 'rgba(255,236,205,0)'); gr.addColorStop(1, 'rgba(0,0,0,.20)');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  // board edges: lit top, shaded bottom/right
  g.fillStyle = 'rgba(255,228,200,.16)'; g.fillRect(x, y, w, 2);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y + h - 2.5, w, 2.5); g.fillRect(x + w - 2, y, 2, h);
  g.restore();
}

// ---------- the card ----------
export function drawCard(ctx, W, H, { qr, cover } = {}) {
  const s = Math.min(W / G.W, H / G.H), ox = (W - G.W * s) / 2, oy = (H - G.H * s) / 2;
  const g = ctx; g.save();
  g.setTransform(1, 0, 0, 1, 0, 0); paper(g, W, H, s);
  g.setTransform(s, 0, 0, s, ox, oy);
  coffeeRing(g, 1872, 46, 112);

  // cover
  const cv = G.cover, ch = cv.h, cw = ch * COVER_ASPECT;
  bookCover(g, cover, cv.x, cv.y, cw, ch);

  // title block (spans the text column and the QR column)
  const X = G.col, R = G.right;
  const kick = text(g, CARD_TEXT.course.toUpperCase(), X, G.top + 17, { font: `400 24px ${F.display}`, color: C.red, track: 3.6 });
  g.fillStyle = C.ink2; g.globalAlpha = 0.5; g.fillRect(X + kick + 26, G.top + 8, R - (X + kick + 26), 1.5); g.globalAlpha = 1;
  // EVIDENCE: fit the column width
  const track = 0.085; let size = 168;
  g.font = `700 ${size}px ${F.title}`; g.letterSpacing = size * track + 'px';
  const tw = g.measureText(CARD_TEXT.title).width - size * track; g.letterSpacing = '0px';
  size = Math.min(size, size * (R - X + 4) / tw);
  const titleBase = G.top + 17 + 32 + size * 0.708;
  text(g, CARD_TEXT.title, X - size * 0.02, titleBase, { font: `700 ${size}px ${F.title}`, color: C.ink, track: size * track });
  const subBase = titleBase + 60;
  text(g, CARD_TEXT.subtitle, X, subBase, { font: `400 46px ${F.title}`, color: C.ink2 });

  // QR tag (the quiet zone is the tag itself)
  const M = qr ? qrMatrix(qr) : null, n = M ? M.length : 33;
  const tagW = G.qr + 2 * G.pad, tagX = R - tagW;
  const ctaSize = 27, urlSize = 22;
  const tagB = G.bottom, urlBase = tagB - 30, ctaBase = urlBase - 38;
  const qrY = ctaBase - ctaSize * 0.72 - Math.max(52, 4.3 * G.qr / n) - G.qr, tagY = qrY - G.pad;
  g.save(); g.fillStyle = C.tag; g.shadowColor = 'rgba(50,28,8,.30)'; g.shadowBlur = 22; g.shadowOffsetY = 8; g.shadowOffsetX = 4;
  g.fillRect(tagX, tagY, tagW, tagB - tagY); g.restore();
  g.strokeStyle = 'rgba(84,67,47,.35)'; g.lineWidth = 1.5; g.strokeRect(tagX + 9, tagY + 9, tagW - 18, tagB - tagY - 18);
  text(g, CARD_TEXT.cta.toUpperCase(), tagX + tagW / 2, ctaBase, { font: `400 ${ctaSize}px ${F.display}`, color: C.ink, align: 'center', track: 1.6 });
  text(g, CARD_TEXT.url.replace(/^https:\/\//, '').replace(/\/$/, ''), tagX + tagW / 2, urlBase, { font: `400 ${urlSize}px ${F.body}`, color: C.ink2, align: 'center' });
  if (M) {
    const qx = tagX + G.pad, X0 = ox + qx * s, Y0 = oy + qrY * s, side = Math.round(G.qr * s);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#ffffff';
    drawModules(g, M, X0, Y0, side, C.qr); g.restore();
  }

  // text column: rule, annotation, filed-by
  const colR = tagX - G.gutter;
  g.fillStyle = C.red; g.fillRect(X, tagY, 110, 4);
  const bodyFont = `400 24px ${F.body}`, lead = 34.5;
  const lines = wrap(g, CARD_TEXT.annotation, bodyFont, colR - X);
  let y = qrY + 17;
  for (const l of lines) { text(g, l, X, y, { font: bodyFont, color: C.ink }); y += lead; }
  const lastBody = y - lead;
  // filed by: baselines match the CTA and URL lines on the tag
  text(g, 'FILED BY', X, ctaBase, { font: `400 22px ${F.display}`, color: C.red, track: 3.3 });
  text(g, teamLine(), X, urlBase, { font: `700 20px ${F.body}`, color: C.ink });
  if (lastBody + 18 > ctaBase - 22) console.warn('card: annotation runs into the filed-by block', { lines: lines.length });
  g.restore();
  return { s, qrModules: n, qrPx: Math.round(G.qr * s), quietPx: Math.round(G.pad * s), lines: lines.length };
}

// ---------- cover render (colour pass + foil relief from the gold mask) ----------
export function renderCover(width = 1200) {
  const S = width / 14.5, w = Math.round(width), h = Math.round(20.8 * S);
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const c = mk(), g = c.getContext('2d');
  FACES.cover.draw(g, S, w, h);
  if (!FACES.cover.gold) return c;
  // foil mask → alpha
  const m = mk(), mg = m.getContext('2d', { willReadFrequently: true }); FACES.cover.gold(mg, S, w, h);
  const id = mg.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const a = d[i + 1]; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a; }
  mg.putImageData(id, 0, 0);
  const layer = (fill, dx, dy) => { // mask minus mask shifted by (dx,dy), filled
    const t = mk(), tg = t.getContext('2d'); tg.drawImage(m, 0, 0);
    if (dx || dy) { tg.globalCompositeOperation = 'destination-out'; tg.drawImage(m, dx, dy); }
    tg.globalCompositeOperation = 'source-in'; tg.fillStyle = fill; tg.fillRect(0, 0, w, h); return t;
  };
  const k = Math.max(1, Math.round(S * 0.024));
  // pressed foil: shadow on the upper-left inner edge, light on the lower-right
  g.globalAlpha = 0.55; g.drawImage(layer('#2b1606', k, k), 0, 0);
  g.globalAlpha = 0.45; g.drawImage(layer('#fff4cf', -k, -k), 0, 0);
  // sheen band across the foil
  const sh = g.createLinearGradient(0, 0, w, h);
  sh.addColorStop(0, 'rgba(255,240,200,0)'); sh.addColorStop(0.3, 'rgba(255,240,200,.38)'); sh.addColorStop(0.42, 'rgba(255,240,200,0)'); sh.addColorStop(1, 'rgba(255,240,200,0)');
  g.globalAlpha = 1; g.globalCompositeOperation = 'screen'; g.drawImage(layer(sh, 0, 0), 0, 0); g.globalCompositeOperation = 'source-over';
  return c;
}

// one pixel per module; drawCard redraws the modules itself, so any qrcode canvas (margin 0, any width/colours) also works
export async function makeQR(url = CARD_TEXT.url, opts = {}) {
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { margin: 0, scale: 1, errorCorrectionLevel: 'Q', color: { dark: '#000000', light: '#ffffff' }, ...opts });
  return qr;
}

// fonts → QR (v4-Q, 33 modules) → cover with foil relief → card. Returns the canvas; .info holds QR size/quiet zone.
export async function makeCardCanvas(W = 1920, H = 1080) {
  await loadCardFonts();
  const s = Math.min(W / G.W, H / G.H);
  const [qr, cover] = [await makeQR(), renderCover(Math.min(4200, Math.round(G.cover.h * COVER_ASPECT * s * 3)))]; // 3× supersampled; drawCard resamples
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.info = drawCard(c.getContext('2d'), W, H, { qr, cover });
  return c;
}
