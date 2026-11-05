// One free camera, built for feel: everything the user does moves a goal; the camera eases toward its goal every frame.
// Drag = orbit, right-drag / shift-drag / two fingers = move, wheel / pinch = come closer toward the point under the cursor.
// Limits act on the goals, so the smoothing never fights a clamp and the camera can't be lost under the desk. It orbits without end; the wall shortens the radius on the bearings that would pass through it.
// A view may bring its own lens, eased like everything else; the hand always gets the everyday one back. A stroke the app claims (canSwipe) goes to onSwipe instead of the orbit.
import * as THREE from 'three';

const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI)); // the same bearing, the short way round
const lens = fov => Math.tan(THREE.MathUtils.degToRad(fov / 2));

export class CameraRig {
  constructor(camera, dom, { pick, limits }) {
    this.cam = camera; this.dom = dom; this.pick = pick;
    this.L = Object.assign({ rMin: 10, rMax: 240, phiMin: 0.05, phiMax: 1.5, wall: -39, room: 39, box: new THREE.Box3(new THREE.Vector3(-80, -1, -44), new THREE.Vector3(80, 70, 40)) }, limits);
    this.t = new THREE.Vector3(); this.tg = new THREE.Vector3();
    const k = lens(camera.fov); this.s = { r: 70, th: 0, ph: 1.4, k }; this.g = { r: 70, th: 0, ph: 1.4, k }; this.k0 = k; // k: the lens, as the tangent of half its view
    this.vel = { th: 0, ph: 0, x: 0, y: 0 }; // inertia after release (per second)
    this.speed = 1; // eases back to 1 after a fly-to
    this.ptrs = new Map(); this.drag = null; this.onTap = null; this.onStart = null; this.onMove = null; this.canSwipe = null; this.onSwipe = null; this.enabled = true;
    this._v = new THREE.Vector3(); this._r = new THREE.Vector3(); this._u = new THREE.Vector3();
    this.bind();
  }
  set(target, { r, th, ph, fov }, instant = true) {
    this.tg.copy(target); Object.assign(this.g, { r, th: this.s.th + wrap(th - this.s.th), ph, k: fov ? lens(fov) : this.g.k }); this.limit();
    if (instant) { this.t.copy(this.tg); Object.assign(this.s, this.g); this.vel = { th: 0, ph: 0, x: 0, y: 0 }; this.apply(); }
    else this.speed = 0.38;
  }
  // derive spherical state from a camera position and target (used by ?cam=)
  lookFrom(pos, target, instant = true) {
    const d = pos.clone().sub(target), r = d.length();
    this.set(target, { r, th: Math.atan2(d.x, d.z), ph: Math.acos(clamp(d.y / r, -1, 1)) }, instant);
  }
  limit() {
    const L = this.L, g = this.g;
    this.tg.clamp(L.box.min, L.box.max);
    const low = L.floor === undefined ? L.phiMax : Math.max(L.phiMax, Math.acos(clamp((L.floor - this.tg.y) / g.r, -1, 1))); // a view that looks level or up says how low the eye may go instead
    g.r = clamp(g.r, L.rMin, L.rMax); // the eye goes all the way round. With its back to the wall there is only the dark room ahead, so the more it turns that way the more it looks down on the desk
    const back = Math.max(0, -Math.cos(g.th));
    g.ph = clamp(g.ph, L.phiMin, low - 0.35 * back);
    this.tg.z = Math.max(this.tg.z, L.box.min.z + (L.wall + L.room - L.box.min.z) * back); this.tg.y = Math.min(this.tg.y, 70 - 66 * back);
  }
  // how far back the eye can stand on this bearing before the wall stops it: the distance asked for comes back when the bearing lets it
  reach({ th, ph }, z) { const back = -Math.sin(ph) * Math.cos(th); return back > 1e-3 ? Math.max(2, (z - this.L.wall) / back) : Infinity; }
  // the hand takes over from a view's lens: back to the everyday one, the picture staying the same size
  free() { const g = this.g; g.r *= g.k / this.k0; g.k = this.k0; this.limit(); }
  apply() {
    const { th, ph, k } = this.s, r = Math.min(this.s.r, this.reach(this.s, this.t.z)), sp = Math.sin(ph), cam = this.cam;
    cam.position.set(this.t.x + r * sp * Math.sin(th), this.t.y + r * Math.cos(ph), Math.max(this.L.wall, this.t.z + r * sp * Math.cos(th)));
    cam.lookAt(this.t);
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(k)), near = Math.max(2, Math.min(r / 2, 2 * this.k0 / k)); // a long lens looks from far off: depth has to last the distance
    if (fov !== cam.fov || near !== cam.near) { cam.fov = fov; cam.near = near; cam.updateProjectionMatrix(); }
  }
  update(dt) {
    const v = this.vel, k = Math.exp(-5.5 * dt);
    if (!this.drag && (Math.abs(v.th) + Math.abs(v.ph) + Math.abs(v.x) + Math.abs(v.y) > 1e-4)) {
      this.g.th += v.th * dt; this.g.ph += v.ph * dt; this.panBy(v.x * dt, v.y * dt); v.th *= k; v.ph *= k; v.x *= k; v.y *= k; this.limit();
    }
    this.speed = damp(this.speed, 1, 1.2, dt);
    const lr = 11 * this.speed, lz = 9 * this.speed;
    this.s.th = damp(this.s.th, this.g.th, lr, dt); this.s.ph = damp(this.s.ph, this.g.ph, lr, dt);
    this.s.r = Math.exp(damp(Math.log(this.s.r), Math.log(this.g.r), lz, dt)); this.s.k = Math.exp(damp(Math.log(this.s.k), Math.log(this.g.k), lz, dt));
    this.t.x = damp(this.t.x, this.tg.x, lz, dt); this.t.y = damp(this.t.y, this.tg.y, lz, dt); this.t.z = damp(this.t.z, this.tg.z, lz, dt);
    this.apply();
  }
  get moving() { const s = this.s, g = this.g; return Math.abs(s.r - g.r) / g.r + Math.abs(s.th - g.th) + Math.abs(s.ph - g.ph) + this.t.distanceTo(this.tg) / this.g.r > 1e-3; }
  // move the target in the camera's screen plane by (dx, dy) in units of the visible height
  panBy(dx, dy) {
    const h = 2 * Math.min(this.g.r, this.reach(this.g, this.tg.z)) * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    this.cam.updateMatrixWorld();
    this._r.setFromMatrixColumn(this.cam.matrixWorld, 0); this._u.setFromMatrixColumn(this.cam.matrixWorld, 1);
    this.tg.addScaledVector(this._r, -dx * h).addScaledVector(this._u, dy * h);
  }
  zoom(f, cx, cy) { // f < 1 comes closer; aims toward the point under (cx, cy)
    const r0 = Math.min(this.g.r, this.reach(this.g, this.tg.z)), r1 = clamp(r0 * f, this.L.rMin, this.L.rMax); if (Math.abs(r1 - r0) < 1e-6 || f > 1 && r0 < this.g.r) return; // against the wall, closer starts from where the eye stands, and there is no further back
    if (r1 < r0) { const hit = cx !== undefined && this.pick ? this.pick(cx, cy) : null; if (hit) this.tg.lerp(hit, 1 - r1 / r0); }
    else if (this.home) this.tg.lerp(this.home, Math.min(1, (1 - r0 / r1) * 1.6)); // pulling back drifts toward the view's own centre
    this.g.r = r1; this.limit(); this.speed = Math.max(this.speed, 0.85);
  }
  bind() {
    const el = this.dom, H = () => el.clientHeight || innerHeight;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (!this.enabled) return; el.setPointerCapture(e.pointerId);
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      this.vel = { th: 0, ph: 0, x: 0, y: 0 }; this.speed = 1;
      const pan = e.button === 2 || e.button === 1 || e.shiftKey || this.ptrs.size >= 2;
      this.drag = { pan, moved: 0, last: performance.now(), pinch: this.ptrs.size >= 2 ? this.pinchState() : null };
      this.onStart?.();
    });
    el.addEventListener('pointermove', e => {
      const p = this.ptrs.get(e.pointerId); if (!p || !this.drag) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      const now = performance.now(), dt = Math.max(1, now - this.drag.last) / 1000; this.drag.last = now;
      this.drag.moved = Math.max(this.drag.moved, Math.hypot(e.clientX - p.x0, e.clientY - p.y0));
      if (this.ptrs.size >= 2) { // pinch to zoom, two-finger drag to move
        this.onMove?.(); const st = this.pinchState(), pr = this.drag.pinch; this.drag.pinch = st;
        if (pr) { this.zoom(pr.d / st.d, st.cx, st.cy); this.panBy((st.cx - pr.cx) / H() / 2, (st.cy - pr.cy) / H() / 2); }
        return;
      }
      const d = this.drag;
      if (d.swipe === undefined && !d.pan && !d.wasPinch && this.canSwipe?.()) { // a stroke's first few pixels say whether it is a swipe or a drag
        if (d.moved < 8) return;
        d.swipe = Math.abs(e.clientX - p.x0) > 1.2 * Math.abs(e.clientY - p.y0); d.sx = e.clientX; d.vx = 0;
      }
      if (d.swipe) { d.vx = d.vx * 0.5 + dx / dt / 2; this.onSwipe(e.clientX - d.sx); return; }
      if (d.moved >= 6) this.onMove?.();
      if (this.drag.pan) { this.panBy(dx / H(), dy / H()); const k = 0.35; this.vel.x = this.vel.x * k + (dx / H() / dt) * (1 - k); this.vel.y = this.vel.y * k + (dy / H() / dt) * (1 - k); }
      else {
        const a = 2.0 / H(); this.g.th -= dx * a; this.g.ph -= dy * a;
        const k = 0.35; this.vel.th = this.vel.th * k + (-dx * a / dt) * (1 - k); this.vel.ph = this.vel.ph * k + (-dy * a / dt) * (1 - k);
      }
      this.limit();
    });
    const up = e => {
      const p = this.ptrs.get(e.pointerId); if (!p) return; this.ptrs.delete(e.pointerId);
      const tap = this.drag && this.drag.moved < 6 && performance.now() - p.t0 < 450 && this.ptrs.size === 0 && !this.drag.pinch && !this.drag.wasPinch && e.type === 'pointerup' && e.button === 0;
      if (this.drag && performance.now() - this.drag.last > 90) this.vel = { th: 0, ph: 0, x: 0, y: 0 }; // released after holding still
      if (this.drag?.swipe) { const d = this.drag, done = e.type === 'pointerup'; this.onSwipe(done ? e.clientX - d.sx : 0, done && performance.now() - d.last < 90 ? d.vx : 0); } // a speed means it's over; a cancelled stroke goes nowhere
      if (this.ptrs.size === 0) this.drag = null;
      else if (this.ptrs.size === 1) { this.drag = { pan: false, moved: 99, last: performance.now(), pinch: null, wasPinch: true }; this.vel = { th: 0, ph: 0, x: 0, y: 0 }; } // one finger left: carry on orbiting from here
      else if (this.drag) this.drag.pinch = this.pinchState();
      if (tap) { this.vel = { th: 0, ph: 0, x: 0, y: 0 }; this.onTap?.(e); }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => {
      if (!this.enabled) return; e.preventDefault(); this.onMove?.();
      const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 400 : 1;
      let dy = e.deltaY * unit, dx = e.deltaX * unit;
      if (e.ctrlKey) { this.zoom(Math.exp(dy * 0.012), e.clientX, e.clientY); } // trackpad pinch
      else {
        this.zoom(Math.exp(clamp(dy, -120, 120) * 0.0016), e.clientX, e.clientY);
        if (Math.abs(dx) > Math.abs(dy) * 0.6) { this.g.th -= dx * 0.0022; this.limit(); } // sideways swipe orbits
      }
    }, { passive: false });
  }
  pinchState() {
    const [a, b] = [...this.ptrs.values()]; if (!b) return null; return { d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
}
