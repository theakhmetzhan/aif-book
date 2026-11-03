// Canvas typesetting for book pages. All measures are in page units (page = 14 x 20); `S` = px per unit.
export const INK = '#2a2219', INK2 = '#5b4f40', ACCENT = '#a8482a', INDIGO = '#2c3a63', RULE = 'rgba(42,34,25,.35)';
export const SERIF = '"EB Garamond", Georgia, serif', DISPLAY = '"Cormorant Garamond", "EB Garamond", serif';

// rich text: *italic*  **bold**  `mono`
function runs(text) {
  const out = []; const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), s: '' });
    const x = m[0];
    if (x.startsWith('**')) out.push({ t: x.slice(2, -2), s: 'b' });
    else if (x.startsWith('*')) out.push({ t: x.slice(1, -1), s: 'i' });
    else out.push({ t: x.slice(1, -1), s: 'm' });
    last = m.index + x.length;
  }
  if (last < text.length) out.push({ t: text.slice(last), s: '' });
  for (const r of out) r.t = r.t.replace(/§/g, '*');
  return out;
}
const fontFor = (s, size, S, fam = SERIF) => s === 'b' ? `600 ${size * S}px ${fam}` : s === 'i' ? `italic 400 ${size * S}px ${fam}` : s === 'm' ? `500 ${size * S * 0.86}px "JetBrains Mono", monospace` : `400 ${size * S}px ${fam}`;

export class Page {
  constructor(ctx, S, { left = 1.55, right = 1.55, top = 1.7, bottom = 2.0 } = {}) {
    this.c = ctx; this.S = S; this.x0 = left; this.x1 = 14 - right; this.y = top; this.yMax = 20 - bottom;
  }
  get w() { return this.x1 - this.x0; }
  font(f) { this.c.font = f; }
  text(str, x, y, { font, color = INK, align = 'left', spacing = 0, baseline = 'alphabetic' } = {}) {
    const c = this.c, S = this.S; c.font = font; c.fillStyle = color; c.textBaseline = baseline;
    if (spacing) {
      c.letterSpacing = spacing * S + 'px';
      const w = c.measureText(str).width - spacing * S;
      const sx = align === 'center' ? x * S - w / 2 : align === 'right' ? x * S - w : x * S;
      c.textAlign = 'left'; c.fillText(str, sx, y * S); c.letterSpacing = '0px'; return;
    }
    c.textAlign = align; c.fillText(str, x * S, y * S);
  }
  // justified paragraph with rich runs; returns height used
  para(text, { size = 0.4, lead = 0.585, indent = 0, justify = true, color = INK, x0 = this.x0, x1 = this.x1, dropcap = false, fam = SERIF, after = 0.12 } = {}) {
    const c = this.c, S = this.S;
    // tokenise into words carrying style
    const words = [];
    for (const r of runs(text)) {
      const parts = r.t.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        if (/^\s+$/.test(p)) { words.push({ space: true }); continue; }
        // glue to previous word if no space between (e.g. "word*italic*")
        const prev = words[words.length - 1];
        if (prev && !prev.space && words.length) prev.parts.push({ t: p, s: r.s });
        else words.push({ parts: [{ t: p, s: r.s }] });
      }
    }
    const W = words.filter(w => !w.space);
    for (const w of W) w.w = w.parts.reduce((a, p) => { c.font = fontFor(p.s, size, S, fam); return a + c.measureText(p.t).width / S; }, 0);
    c.font = fontFor('', size, S, fam); const sp = c.measureText(' ').width / S;
    let dc = null;
    if (dropcap) {
      const first = W[0]; const ch = first.parts[0].t[0]; first.parts[0] = { ...first.parts[0], t: first.parts[0].t.slice(1) };
      c.font = fontFor(first.parts[0].s, size, S, fam); first.w = first.parts.reduce((a, p) => { c.font = fontFor(p.s, size, S, fam); return a + c.measureText(p.t).width / S; }, 0);
      const dsize = lead * 2 + size * 0.72; c.font = `500 ${dsize * S}px ${DISPLAY}`;
      dc = { ch, size: dsize, w: c.measureText(ch).width / S + 0.12 };
    }
    let y = this.y + size * 0.92, i = 0, line = 0;
    while (i < W.length) {
      const lx0 = x0 + (line === 0 ? indent : 0) + (dc && line < 2 ? dc.w : 0);
      const avail = x1 - lx0; let wsum = 0, j = i;
      while (j < W.length && wsum + W[j].w + (j > i ? sp : 0) <= avail + 1e-6) { wsum += W[j].w + (j > i ? sp : 0); j++; }
      if (j === i) j = i + 1;
      const last = j >= W.length, n = j - i;
      const gap = justify && !last && n > 1 ? (avail - (wsum - sp * (n - 1))) / (n - 1) : sp;
      let x = lx0;
      for (let k = i; k < j; k++) {
        for (const p of W[k].parts) { c.font = fontFor(p.s, size, S, fam); c.fillStyle = color; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(p.t, x * S, y * S); x += c.measureText(p.t).width / S; }
        x += gap;
      }
      i = j; line++; y += lead;
    }
    if (dc) { c.font = `500 ${dc.size * S}px ${DISPLAY}`; c.fillStyle = ACCENT; c.textAlign = 'left'; c.fillText(dc.ch, x0 * S, (this.y + size * 0.92 + lead * 1.02) * S); }
    const h = Math.max(line, dc ? 2 : 0) * lead + after;
    this.y += h; this.overflow = this.y > this.yMax; return h;
  }
  gap(h) { this.y += h; }
  rule(y = this.y, { x0 = this.x0, x1 = this.x1, color = RULE, w = 0.018 } = {}) { const c = this.c, S = this.S; c.strokeStyle = color; c.lineWidth = w * S; c.beginPath(); c.moveTo(x0 * S, y * S); c.lineTo(x1 * S, y * S); c.stroke(); }
  kicker(str, color = ACCENT) { this.text(str.toUpperCase(), this.x0, this.y + 0.2, { font: `600 ${0.24 * this.S}px ${SERIF}`, color, spacing: 0.06 }); this.y += 0.5; }
  // boxed aside with a label
  aside(label, body, { size = 0.34, lead = 0.5, color = INDIGO } = {}) {
    const top = this.y; const c = this.c, S = this.S;
    this.y += 0.18;
    this.text(label.toUpperCase(), this.x0 + 0.35, this.y + 0.2, { font: `600 ${0.2 * S}px ${SERIF}`, color, spacing: 0.05 }); this.y += 0.38;
    const save = this.y; this.para(body, { size, lead, x0: this.x0 + 0.35, x1: this.x1 - 0.2, justify: true, after: 0 });
    this.y += 0.12;
    c.fillStyle = color; c.fillRect(this.x0 * S, top * S, 0.06 * S, (this.y - top) * S);
    this.y += 0.25; return save;
  }
  // simple table: rows = [[cells]], first row header; widths in units
  table(rows, widths, { size = 0.33, lead = 0.46, head = INK2, zebra = 'rgba(168,72,42,.07)', align = [] } = {}) {
    const c = this.c, S = this.S; let y = this.y;
    this.rule(y, { color: INK, w: 0.025 });
    rows.forEach((r, ri) => {
      const isH = ri === 0; let x = this.x0;
      // wrap cells
      const cellLines = r.map((cell, ci) => wrapRich(c, String(cell), widths[ci] - 0.2, size, S, isH));
      const nl = Math.max(...cellLines.map(l => l.length)); const h = nl * lead + 0.16;
      if (!isH && zebra && ri % 2 === 0) { c.fillStyle = zebra; c.fillRect(this.x0 * S, y * S, (this.x1 - this.x0) * S, h * S); }
      cellLines.forEach((lines, ci) => {
        lines.forEach((ln, li) => {
          const al = align[ci] || 'left'; const tx = al === 'right' ? x + widths[ci] - 0.1 : al === 'center' ? x + widths[ci] / 2 : x + 0.1;
          const up = t => isH && !t.startsWith('~') ? t.toUpperCase() : t.replace(/^~/, '');
          let cx = tx; const total = ln.reduce((a, p) => { c.font = isH ? (p.s === 'i' ? fontFor('i', size * 0.95, S) : `600 ${size * 0.82 * S}px ${SERIF}`) : fontFor(p.s, size, S); c.letterSpacing = isH ? 0.02 * S + 'px' : '0px'; const w = c.measureText(up(p.t)).width / S; c.letterSpacing = '0px'; return a + w; }, 0);
          if (al === 'right') cx = tx - total; else if (al === 'center') cx = tx - total / 2;
          for (const p of ln) { c.font = isH ? (p.s === 'i' ? fontFor('i', size * 0.95, S) : `600 ${size * 0.82 * S}px ${SERIF}`) : fontFor(p.s, size, S); c.fillStyle = isH ? head : INK; c.textAlign = 'left'; c.letterSpacing = isH ? 0.02 * S + 'px' : '0px'; c.fillText(up(p.t), cx * S, (y + 0.08 + lead * (li + 0.78)) * S); cx += c.measureText(up(p.t)).width / S; c.letterSpacing = '0px'; }
        });
        x += widths[ci];
      });
      y += h;
      if (isH) this.rule(y, { color: INK, w: 0.012 });
    });
    this.rule(y, { color: INK, w: 0.025 });
    this.y = y + 0.3;
  }
}
function wrapRich(c, text, maxW, size, S, isH) {
  const words = []; for (const r of runs(text)) for (const p of r.t.split(/(\s+)/)) { if (!p) continue; words.push({ t: p, s: r.s }); }
  const lines = [[]]; let w = 0;
  for (const wd of words) {
    c.font = isH ? `600 ${size * 0.82 * S}px ${SERIF}` : fontFor(wd.s, size, S);
    const ww = c.measureText(isH ? wd.t.toUpperCase() : wd.t).width / S;
    if (w + ww > maxW && w > 0 && !/^\s+$/.test(wd.t)) { lines.push([]); w = 0; }
    if (w === 0 && /^\s+$/.test(wd.t)) continue;
    lines[lines.length - 1].push(wd); w += ww;
  }
  return lines;
}
