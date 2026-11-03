// PROTOTYPE live search toy: BFS vs A* (Manhattan) on a 4-connected grid, unit step cost.
export function mountSearchToy(host, { theme = 'dark' } = {}) {
  const C = 24, R = 15, cell = 18;
  const wrap = document.createElement('div');
  wrap.className = 'toy toy-' + theme;
  wrap.innerHTML = `
    <canvas width="${C * cell}" height="${R * cell}"></canvas>
    <div class="toy-bar">
      <button data-a="bfs">Run BFS</button><button data-a="astar">Run A*</button><button data-a="clear">Clear walls</button>
      <span class="toy-out">Click or drag to draw walls.</span>
    </div>`;
  host.appendChild(wrap);
  const cv = wrap.querySelector('canvas'), g = cv.getContext('2d'), out = wrap.querySelector('.toy-out');
  const S = [2, 7], G = [21, 7];
  const wall = new Uint8Array(C * R);
  for (let y = 2; y < 13; y++) wall[y * C + 11] = 1; wall[7 * C + 11] = 0; // default wall with a gap
  for (let x = 6; x < 11; x++) wall[3 * C + x] = 1;
  let vis = new Uint8Array(C * R), path = [], timer = null;
  const col = theme === 'paper'
    ? { bg: '#efe6d2', grid: '#d8ccb0', wall: '#3b3326', vis: 'rgba(176,120,40,.35)', front: '#b0782a', path: '#1d6f8a', s: '#1d6f8a', g: '#9a3b20' }
    : { bg: '#0b1120', grid: '#16203a', wall: '#c9b48a', vis: 'rgba(242,196,107,.28)', front: '#f2c46b', path: '#7fe3ff', s: '#7fe3ff', g: '#ff8a5c' };
  function draw() {
    g.fillStyle = col.bg; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < C * R; i++) {
      const x = (i % C) * cell, y = Math.floor(i / C) * cell;
      g.fillStyle = wall[i] ? col.wall : vis[i] ? col.vis : col.bg; g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      g.strokeStyle = col.grid; g.strokeRect(x + .5, y + .5, cell - 1, cell - 1);
    }
    g.strokeStyle = col.path; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath();
    path.forEach((i, k) => { const x = (i % C) * cell + cell / 2, y = Math.floor(i / C) * cell + cell / 2; k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.lineWidth = 1;
    dot(S, col.s); dot(G, col.g);
  }
  function dot([x, y], c) { g.fillStyle = c; g.beginPath(); g.arc(x * cell + cell / 2, y * cell + cell / 2, cell * .36, 0, 7); g.fill(); }
  const idx = ([x, y]) => y * C + x;
  function* search(kind) {
    const s = idx(S), goal = idx(G), gc = new Map([[s, 0]]), prev = new Map([[s, -1]]);
    const h = i => Math.abs((i % C) - G[0]) + Math.abs(Math.floor(i / C) - G[1]);
    let frontier = [s], expanded = 0, closed = new Set();
    while (frontier.length) {
      let u;
      if (kind === 'bfs') u = frontier.shift();
      else { let b = 0; for (let k = 1; k < frontier.length; k++) { const fa = gc.get(frontier[k]) + h(frontier[k]), fb = gc.get(frontier[b]) + h(frontier[b]); if (fa < fb || (fa === fb && h(frontier[k]) < h(frontier[b]))) b = k; } u = frontier.splice(b, 1)[0]; }
      if (closed.has(u)) continue; closed.add(u); expanded++; vis[u] = 1;
      if (u === goal) { const p = []; for (let v = u; v !== -1; v = prev.get(v)) p.push(v); return { expanded, path: p.reverse() }; }
      const x = u % C, y = Math.floor(u / C);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
        const v = ny * C + nx; if (wall[v] || closed.has(v)) continue;
        const ng = gc.get(u) + 1;
        if (!gc.has(v) || ng < gc.get(v)) { gc.set(v, ng); prev.set(v, u); frontier.push(v); }
      }
      yield expanded;
    }
    return { expanded, path: [] };
  }
  const results = {};
  function run(kind) {
    clearInterval(timer); vis = new Uint8Array(C * R); path = [];
    const it = search(kind);
    timer = setInterval(() => {
      for (let k = 0; k < 4; k++) {
        const r = it.next();
        if (r.done) {
          clearInterval(timer); path = r.value.path; results[kind] = r.value;
          const fmt = k => results[k] ? `${k === 'bfs' ? 'BFS' : 'A*'}: ${results[k].expanded} expanded, path ${results[k].path.length - 1}` : '';
          out.textContent = [fmt('bfs'), fmt('astar')].filter(Boolean).join('   ·   ') || 'No path.';
          break;
        }
        out.textContent = `${kind === 'bfs' ? 'BFS' : 'A*'} expanding… ${r.value}`;
      }
      draw();
    }, 16);
  }
  let painting = -1;
  const cellAt = e => { const r = cv.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / r.width * C), y = Math.floor((e.clientY - r.top) / r.height * R); return y * C + x; };
  cv.addEventListener('pointerdown', e => { const i = cellAt(e); if (i === idx(S) || i === idx(G)) return; painting = wall[i] ? 0 : 1; wall[i] = painting; vis.fill(0); path = []; draw(); });
  cv.addEventListener('pointermove', e => { if (painting < 0) return; const i = cellAt(e); if (i !== idx(S) && i !== idx(G)) { wall[i] = painting; draw(); } });
  addEventListener('pointerup', () => painting = -1);
  wrap.querySelector('.toy-bar').addEventListener('click', e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'clear') { wall.fill(0); vis.fill(0); path = []; clearInterval(timer); draw(); return; }
    run(a);
  });
  draw();
  return wrap;
}
