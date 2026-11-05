// How much of a phone's screen to draw. Frames are capped at the display's rate, so a steady 60 fps cannot show what is to spare, and a hitch says nothing: only a run of frames the viewer sees moving counts.
// A slow run: one step down, and on down until the frames come quicker. If they never do, pixels were not what held them back (a phone saving power runs everything at 30), so it goes back to the top and leaves it alone for a while.
// New buffers cost a stutter, so a step up waits for a still moment. One that proves slow steps back down, and the next try waits twice as long.
const WINDOW = 40, SLOW = 0.021, FAST = 0.0185, GAIN = 0.92, WAIT = 30, LONG = 300;

export class Resolution {
  constructor(max, min = 1, step = 0.25) { Object.assign(this, { max, min, step, now: max, times: [], clock: 0, from: 0, fast: false, trying: false, wait: WAIT, up: WAIT, leave: 0 }); }
  go(to) { this.now = to; this.times.length = 0; this.fast = false; return to; }
  // one frame: its length in seconds, and whether anything on screen is moving. Returns the pixel ratio to change to, or nothing
  frame(dt, moving) {
    this.clock += dt;
    if (!moving) { if (this.fast && this.now < this.max && this.clock > this.up) { this.trying = true; return this.go(this.now + this.step); } return; }
    this.times.push(dt); if (this.times.length < WINDOW) return;
    const t = this.times.sort((a, b) => a - b).slice(0, WINDOW * 0.9), a = t.reduce((x, y) => x + y, 0) / t.length; this.times.length = 0; this.fast = a < FAST; // the slowest few are hitches, not a pace
    if (this.trying) { this.trying = false; this.wait = a > SLOW ? Math.min(LONG, this.wait * 2) : WAIT; this.up = this.clock + this.wait; if (a > SLOW) return this.go(this.now - this.step); }
    if (a <= SLOW) { this.from = 0; return; }
    if (this.clock < this.leave) return;
    this.from ||= a; this.up = this.clock + this.wait;
    if (this.now > this.min) return this.go(this.now - this.step);
    if (a > this.from * GAIN) { this.from = 0; this.leave = this.clock + LONG; return this.go(this.max); }
  }
}
