/** Animation playback state for one skeleton instance: a base track
 *  (idle/swim/fast_swim) with crossfade blending between switches, plus an
 *  optional one-shot override track (eat/attack/hurt) layered on top, and a
 *  procedural secondary-motion pass (tail wave, fin flutter).
 *
 *  Pose model (Spine-like):
 *   1. skeleton starts at setup pose
 *   2. base track timelines replace channels, crossfaded (weights normalize)
 *   3. override track blends only the channels it animates, from the current
 *      pose toward its own values, by its current weight
 *   4. procedural layer adds continuous offsets (phase never resets, so
 *      clip switches never hitch the tail wave)
 */

import { EASE_LINEAR, EASE_SINE_IN_OUT, EASE_SINE_IN, EASE_SINE_OUT } from './SkeletonData.js';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const CH_ROTATE = 0;
const CH_TRANSLATE = 1;
const CH_SCALE = 2;

function ease(p, code) {
  switch (code) {
    case EASE_SINE_IN_OUT: return (1 - Math.cos(p * Math.PI)) / 2;
    case EASE_SINE_IN: return 1 - Math.cos(p * Math.PI / 2);
    case EASE_SINE_OUT: return Math.sin(p * Math.PI / 2);
    default: return p;
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

class TrackEntry {
  constructor(anim, loop, mix, override) {
    this.anim = anim;
    this.time = 0;
    this.loop = loop;
    this.mix = mix;
    this.override = override;
    this.alpha = override ? 0 : 1;
    this.done = false;
  }
}

export class AnimationState {
  constructor(data) {
    this.data = data;
    this.base = null;      // incoming base entry
    this.fading = null;    // outgoing base entry (crossfade)
    this.override = null;  // one-shot layered on top
    /** Game-facing knobs: speed 0..1 drives procedural tail freq/amplitude. */
    this.params = { speed: 0, waveScale: 1 };
    this.wavePhase = 0; // integrates frequency so speed changes stay smooth
    this.flutterTime = 0;
    const n = data.boneCount;
    this._accRot = new Float32Array(n);
    this._accDX = new Float32Array(n);
    this._accDY = new Float32Array(n);
    this._accSX = new Float32Array(n);
    this._accSY = new Float32Array(n);
    this._accW = new Float32Array(n * 3); // per bone×channel weight sums
    this._tmp = { a: 0, b: 0 };
  }

  get currentName() {
    return this.base ? this.base.anim.name : null;
  }

  get overrideName() {
    return this.override ? this.override.anim.name : null;
  }

  /** Switches the base animation, crossfading from the current pose over
   *  `mix` seconds. Calling with the current name is a no-op. */
  setAnimation(name, { loop = true, mix = 0.15 } = {}) {
    const anim = this.data.getAnimation(name);
    if (!anim) return false;
    if (this.base && this.base.anim === anim && !this.base.done) return true;
    if (this.base && !this.base.done) {
      this.fading = this.base;
    }
    this.base = new TrackEntry(anim, loop, mix, false);
    return true;
  }

  /** Plays a one-shot on top of the base (eat lunge, attack thrust, hurt
   *  knock). Fades in over `mix`, holds, fades out over `mix` at the end. */
  setOverride(name, { mix = 0.08 } = {}) {
    const anim = this.data.getAnimation(name);
    if (!anim) return false;
    this.override = new TrackEntry(anim, false, mix, true);
    return true;
  }

  clearOverride() {
    this.override = null;
  }

  update(dt) {
    this._advance(this.base, dt);
    this._advance(this.fading, dt);
    this._advance(this.override, dt);
    // Looping base entries never set `done` (and their alpha stays at the
    // constructor value), so the fade is complete once the incoming entry
    // has consumed its mix duration.
    if (this.fading && (this.fading.done || this.base.time >= this.base.mix)) this.fading = null;
    if (this.override && this.override.done) this.override = null;

    // Procedural clocks. Tail wave integrates current frequency so a
    // speed change bends the wave smoothly instead of jumping phase.
    const proc = this.data.procedural;
    if (proc) {
      const speed = clamp01(this.params.speed);
      const freq = (proc.tailFreqIdle ?? 0.8) + ((proc.tailFreqSwim ?? 2) - (proc.tailFreqIdle ?? 0.8)) * speed;
      this.wavePhase += dt * freq;
      this.flutterTime += dt;
    }
  }

  _advance(entry, dt) {
    if (!entry || entry.done) return;
    entry.time += dt;
    const dur = entry.anim.duration;
    if (entry.loop) {
      if (dur > 0) entry.time %= dur;
      if (entry.override) entry.alpha = clamp01(entry.time / Math.max(entry.mix, 1e-4));
    } else {
      if (entry.time >= dur) {
        entry.time = dur;
        entry.done = true;
      }
      // one-shot envelope: fade in, hold, fade out
      const remaining = dur - entry.time;
      entry.alpha = clamp01(Math.min(entry.time, remaining) / Math.max(entry.mix, 1e-4));
      if (entry.done) entry.alpha = 0;
    }
  }

  /** Samples one timeline at the entry's time into this._tmp {a, b}. */
  _sample(tl, entry) {
    const times = tl.times;
    const n = times.length;
    const out = this._tmp;
    let t = entry.time;
    if (entry.loop && entry.anim.duration > 0) t = entry.time % entry.anim.duration;
    if (n === 0) { out.a = 0; out.b = 0; return; }
    if (t <= times[0] || n === 1) {
      out.a = tl.valuesA[0];
      out.b = tl.valuesB ? tl.valuesB[0] : 0;
      return;
    }
    if (t >= times[n - 1]) {
      if (entry.loop && entry.anim.duration > times[n - 1]) {
        // Looping clip without a closing key: interpolate across the loop
        // seam toward key 0 instead of holding the last key.
        const span = entry.anim.duration - times[n - 1] + times[0];
        const p = span > 0 ? ease((t - times[n - 1]) / span, tl.ease[n - 1]) : 0;
        const a0 = tl.valuesA[n - 1];
        const a1 = tl.valuesA[0];
        if (tl.channel === 'rotate') {
          const d = ((a1 - a0 + 540) % 360) - 180;
          out.a = a0 + d * p;
          out.b = 0;
        } else {
          out.a = a0 + (a1 - a0) * p;
          out.b = tl.valuesB ? tl.valuesB[n - 1] + (tl.valuesB[0] - tl.valuesB[n - 1]) * p : 0;
        }
        return;
      }
      out.a = tl.valuesA[n - 1];
      out.b = tl.valuesB ? tl.valuesB[n - 1] : 0;
      return;
    }
    let i = 1;
    while (i < n && times[i] < t) i++;
    const t0 = times[i - 1];
    const span = times[i] - t0;
    const p = span > 0 ? ease((t - t0) / span, tl.ease[i - 1]) : 0;
    let a0 = tl.valuesA[i - 1];
    const a1 = tl.valuesA[i];
    if (tl.channel === 'rotate') {
      // shortest-arc interpolation in degrees
      const d = ((a1 - a0 + 540) % 360) - 180;
      out.a = a0 + d * p;
      out.b = 0;
    } else {
      out.a = a0 + (a1 - a0) * p;
      out.b = tl.valuesB ? tl.valuesB[i - 1] + (tl.valuesB[i] - tl.valuesB[i - 1]) * p : 0;
    }
  }

  /** Accumulates an entry's timeline deltas weighted by `weight` into the
   *  per-bone accumulators. */
  _accumulate(entry, weight) {
    if (!entry || weight <= 0) return;
    for (const tl of entry.anim.timelines) {
      this._sample(tl, entry);
      const bi = tl.boneIndex;
      const ch = tl.channel === 'rotate' ? CH_ROTATE : tl.channel === 'translate' ? CH_TRANSLATE : CH_SCALE;
      this._accW[bi * 3 + ch] += weight;
      if (ch === CH_ROTATE) {
        this._accRot[bi] += weight * this._tmp.a;
      } else if (ch === CH_TRANSLATE) {
        this._accDX[bi] += weight * this._tmp.a;
        this._accDY[bi] += weight * this._tmp.b;
      } else {
        this._accSX[bi] += weight * this._tmp.a;
        this._accSY[bi] += weight * this._tmp.b;
      }
    }
  }

  /** Applies the full pose (base crossfade + override layer + procedural)
   *  to the skeleton. Call skeleton.updateWorldTransform(scale) after. */
  apply(skeleton) {
    const n = this.data.boneCount;
    skeleton.setToSetupPose();
    this._accRot.fill(0);
    this._accDX.fill(0);
    this._accDY.fill(0);
    this._accSX.fill(0);
    this._accSY.fill(0);
    this._accW.fill(0);

    // Base crossfade: outgoing weight (1-p), incoming weight p.
    let inW = 1;
    if (this.base && this.fading) {
      inW = this.base.mix > 0 ? clamp01(this.base.time / this.base.mix) : 1;
    }
    if (this.fading) this._accumulate(this.fading, 1 - inW);
    if (this.base) this._accumulate(this.base, this.base ? inW : 1);

    // Write base deltas unnormalized: the accumulated weights already
    // encode the crossfade. A channel animated only by the outgoing clip
    // drains toward setup pose as its weight fades; a channel animated
    // only by the incoming clip fades in from setup pose (missing weight
    // blends with setup). Dividing by the per-channel weight sum would
    // cancel the fade weights and snap asymmetric channel sets.
    for (let bi = 0; bi < n; bi++) {
      if (this._accW[bi * 3 + CH_ROTATE] > 0) {
        skeleton.localRot[bi] += this._accRot[bi] * DEG;
      }
      if (this._accW[bi * 3 + CH_TRANSLATE] > 0) {
        skeleton.localX[bi] += this._accDX[bi];
        skeleton.localY[bi] += this._accDY[bi];
      }
      const ws = this._accW[bi * 3 + CH_SCALE];
      if (ws > 0) {
        // scale's neutral is 1.0 — missing weight blends toward it
        skeleton.localSX[bi] *= this._accSX[bi] + (1 - ws);
        skeleton.localSY[bi] *= this._accSY[bi] + (1 - ws);
      }
    }

    // Override layer: blend only channels the override animates, from the
    // current pose toward setup+override-delta.
    if (this.override && this.override.alpha > 0) {
      const alpha = this.override.alpha;
      this._accRot.fill(0);
      this._accDX.fill(0);
      this._accDY.fill(0);
      this._accSX.fill(0);
      this._accSY.fill(0);
      this._accW.fill(0);
      this._accumulate(this.override, 1);
      for (const tl of this.override.anim.timelines) {
        const bi = tl.boneIndex;
        const ch = tl.channel === 'rotate' ? CH_ROTATE : tl.channel === 'translate' ? CH_TRANSLATE : CH_SCALE;
        if (this._accW[bi * 3 + ch] <= 0) continue;
        if (ch === CH_ROTATE) {
          const target = this.data.setupRot[bi] + (this._accRot[bi] / this._accW[bi * 3]) * DEG;
          const d = ((target - skeleton.localRot[bi] + Math.PI * 3) % TWO_PI) - Math.PI;
          skeleton.localRot[bi] += d * alpha;
        } else if (ch === CH_TRANSLATE) {
          const tx = this.data.setupX[bi] + this._accDX[bi] / this._accW[bi * 3 + CH_TRANSLATE];
          const ty = this.data.setupY[bi] + this._accDY[bi] / this._accW[bi * 3 + CH_TRANSLATE];
          skeleton.localX[bi] += (tx - skeleton.localX[bi]) * alpha;
          skeleton.localY[bi] += (ty - skeleton.localY[bi]) * alpha;
        } else {
          const sx = this._accSX[bi] / this._accW[bi * 3 + CH_SCALE];
          const sy = this._accSY[bi] / this._accW[bi * 3 + CH_SCALE];
          skeleton.localSX[bi] *= 1 + (sx - 1) * alpha;
          skeleton.localSY[bi] *= 1 + (sy - 1) * alpha;
        }
      }
    }

    this._applyProcedural(skeleton);
  }

  _applyProcedural(skeleton) {
    const proc = this.data.procedural;
    if (!proc) return;
    const speed = clamp01(this.params.speed);
    // One-shot overrides can clamp the wave (hurt: the tail stiffens) —
    // blend toward the override's waveScale by its current weight.
    let waveScale = this.params.waveScale;
    if (this.override && this.override.alpha > 0 && this.override.anim.waveScale != null) {
      waveScale *= 1 + (this.override.anim.waveScale - 1) * this.override.alpha;
    }
    const ampScale = ((proc.tailAmpIdle ?? 0.35) + (1 - (proc.tailAmpIdle ?? 0.35)) * speed) * waveScale;
    if (proc.tail) {
      for (const entry of proc.tail) {
        const bi = this.data.boneIndex(entry.bone);
        if (bi === undefined) continue;
        skeleton.localRot[bi] += entry.amp * ampScale * Math.sin(TWO_PI * this.wavePhase - entry.phase) * DEG;
      }
    }
    if (proc.fins) {
      for (const entry of proc.fins) {
        const bi = this.data.boneIndex(entry.bone);
        if (bi === undefined) continue;
        skeleton.localRot[bi] += entry.amp * Math.sin(TWO_PI * (entry.freq ?? 1.2) * this.flutterTime + (entry.phase ?? 0)) * DEG;
      }
    }
    if (proc.dorsal) {
      const bi = this.data.boneIndex(proc.dorsal.bone);
      if (bi !== undefined) {
        skeleton.localRot[bi] += proc.dorsal.amp * Math.sin(TWO_PI * (proc.dorsal.freq ?? 1) * this.flutterTime) * DEG;
      }
    }
  }
}
