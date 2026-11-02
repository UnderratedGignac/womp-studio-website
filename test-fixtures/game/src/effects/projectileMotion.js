import { TAU } from '../utils/math.js';

/**
 * projectileMotion — the physics vocabulary the fish-defense lane fires with.
 *
 * Everything here is pure math: no canvas, no DOM, no engine types, so it runs
 * headless in a test and costs nothing when a scene does not use it. The lane's
 * travel is now described by a MOTION PROFILE (a flat bag of numbers) instead
 * of one hard-coded homing step, so a round's whole personality — does it sag,
 * does it wobble, does it ricochet — is data.
 *
 * The tank is water, and the numbers say so: gravity here is an order of
 * magnitude softer than vacuum-tuned air ballistics, drag is heavy, and
 * buoyancy is a real upward term. A dropped shot sinks slowly and drifts up
 * when it is light enough; nothing in the tank travels like it would in air.
 *
 * Field semantics (all plain numbers, 0 = inert):
 *   gravity      px/s^2 pulled down (+y is down in canvas space)
 *   buoyancy     px/s^2 lifted up (a gas glob rises, a shell sinks faster)
 *   drag         fraction of speed shed per second (water is thick)
 *   lateral      px/s^2 side acceleration, perpendicular to travel
 *   lateralFreq  cycles/s that side acceleration oscillates at
 *   spin         rad/s the body itself rotates (a thrown blade's own spin).
 *                p.spin accumulates that rotation, so an impact kick added by
 *                bounceWalls keeps turning the body for the rest of the flight.
 *   restitution  0..1 speed kept per wall (how hard a round ricochets)
 *   thrustCycle  cycles/s of a thrust swell along the flight path
 *   blinkEvery   seconds between hops (a glob that advances in pulses)
 *   stretch      streak coefficient the draw uses to elongate a fast body
 */
const freeze = (fields) => Object.freeze(fields);

/**
 * The twelve lanes. `flat` is the compatibility profile: every field is 0, so
 * stepMotion() is a true no-op and a flat shot keeps its original
 * straight-line travel. Every other profile is a behaviour, not a tuning
 * branch, and the draw/feel of a round is the profile it was fired with.
 */
export const MOTION_PROFILES = Object.freeze({
  // Compatibility lane: inert by construction (pinned by the homing tests).
  flat: freeze({
    gravity: 0, drag: 0, lateral: 0, lateralFreq: 0, spin: 0,
    restitution: 0, buoyancy: 0, thrustCycle: 0, blinkEvery: 0, stretch: 0.25
  }),
  // Shells and slams: dropped, they sag; with buoyancy they sag slowly.
  ballistic: freeze({
    gravity: 320, drag: 0.18, lateral: 0, lateralFreq: 0, spin: 0,
    restitution: 0.55, buoyancy: 95, thrustCycle: 0, blinkEvery: 0, stretch: 0.4
  }),
  // Pellets and nets: a lot of water resistance, so range is finite.
  drag: freeze({
    gravity: 60, drag: 1.4, lateral: 0, lateralFreq: 0, spin: 0,
    restitution: 0.3, buoyancy: 0, thrustCycle: 0, blinkEvery: 0, stretch: 0.18
  }),
  // Blades: real spin, no wobble. The heading rotates with the body, so the
  // flight path is a spiral at (almost) constant speed.
  corkscrew: freeze({
    gravity: 0, drag: 0.08, lateral: 0, lateralFreq: 0, spin: 13,
    restitution: 0.6, buoyancy: 0, thrustCycle: 0, blinkEvery: 0, stretch: 0.3
  }),
  // Plasma orbs: a smooth weave around the line of fire.
  sine: freeze({
    gravity: 0, drag: 0.35, lateral: 900, lateralFreq: 3, spin: 0,
    restitution: 0.4, buoyancy: 40, thrustCycle: 0, blinkEvery: 0, stretch: 0.3
  }),
  // Rings: a slow, lazy curl that closes back on its own tail.
  curl: freeze({
    gravity: 0, drag: 0.5, lateral: 700, lateralFreq: 1.6, spin: 4,
    restitution: 0.45, buoyancy: 0, thrustCycle: 0, blinkEvery: 0, stretch: 0.28
  }),
  // Sparks: a fast thrust swell, so a bolt stutters forward as it burns.
  pulse: freeze({
    gravity: 0, drag: 0.3, lateral: 0, lateralFreq: 0, spin: 0,
    restitution: 0.3, buoyancy: 0, thrustCycle: 7.5, blinkEvery: 0, stretch: 0.5
  }),
  // Venom globs advance in visible hops instead of gliding.
  blink: freeze({
    gravity: 0, drag: 2.4, lateral: 0, lateralFreq: 0, spin: 0,
    restitution: 0, buoyancy: 0, thrustCycle: 0, blinkEvery: 0.14, stretch: 0.35
  }),
  // Whirlpool rounds are steered by a vortex: a hard, fast inward weave.
  well: freeze({
    gravity: 0, drag: 0.9, lateral: 1500, lateralFreq: 4.5, spin: 9,
    restitution: 0.2, buoyancy: 0, thrustCycle: 0, blinkEvery: 0, stretch: 0.35
  }),
  // Chain zips: a hard fast weave, charged by a quick thrust swell.
  split: freeze({
    gravity: 0, drag: 0.4, lateral: 800, lateralFreq: 6, spin: 0,
    restitution: 0.25, buoyancy: 0, thrustCycle: 12, blinkEvery: 0, stretch: 0.55
  }),
  // A thrown crescent that comes back: a wide, slow turn back on itself.
  boomerang: freeze({
    gravity: 0, drag: 0.6, lateral: 1800, lateralFreq: 0.8, spin: 12,
    restitution: 0.7, buoyancy: 0, thrustCycle: 0, blinkEvery: 0, stretch: 0.25
  }),
  // A gas glob: buoyant, waterlogged, barely holding its heading.
  hover: freeze({
    gravity: 0, drag: 1.1, lateral: 120, lateralFreq: 2.5, spin: 0,
    restitution: 0.1, buoyancy: 200, thrustCycle: 0, blinkEvery: 0, stretch: 0.2
  })
});

/** Archetype wins over shape: a venom_spit is a droplet BODY that travels
 *  like a glob on a hop, and a whirlpool_pull is whatever body it throws. */
const ARCHETYPE_MOTION = Object.freeze({
  whirlpool_pull: 'well',
  chain_zap: 'split',
  venom_spit: 'blink'
});

/** Which lane a body flies on, when the archetype did not already say. */
const SHAPE_MOTION = Object.freeze({
  shell: 'ballistic',
  torpedo: 'ballistic',
  pellet: 'drag',
  net: 'drag',
  shuriken: 'corkscrew',
  shard: 'corkscrew',
  dart: 'corkscrew',
  claw: 'corkscrew',
  crescent: 'corkscrew',
  orb: 'sine',
  ring: 'curl',
  droplet: 'hover',
  spark: 'pulse',
  comet: 'flat',
  bullet: 'flat',
  tracer: 'flat'
});

/** Gun class fallback for a round fired without a shape. */
const WEAPON_TYPE_MOTION = Object.freeze({ boomerang: 'boomerang' });

// A slam is heavy, thrown round by definition (torpedo_slam, heavy_slam, and
// the arch_* twins the crit/archetype ladder adds).
const SLAM = /_slam$/;

/**
 * The MOTION PROFILE NAME a shot should fly on.
 * Anything we have never heard of flies `flat`: an unknown round must never
 * change how today's shots travel.
 */
export function motionFor({ shape, archetype, weaponType } = {}) {
  if (typeof archetype === 'string' && archetype) {
    const named = ARCHETYPE_MOTION[archetype];
    if (named) return named;
    if (SLAM.test(archetype)) return 'ballistic';
  }
  if (typeof shape === 'string' && shape) {
    const byShape = SHAPE_MOTION[shape];
    if (byShape) return byShape;
  }
  if (typeof weaponType === 'string' && weaponType) {
    const byGun = WEAPON_TYPE_MOTION[weaponType];
    if (byGun) return byGun;
  }
  return 'flat';
}

/** The profile object a shot is flying, from a name, a profile, or nothing.
 *  Always answers with a real profile so a caller never has to null-check. */
export function profileFor(p, opts) {
  const given = opts && (opts.profile ?? opts.motion);
  const named = typeof given === 'string' ? MOTION_PROFILES[given] : given;
  if (named && typeof named === 'object') return named;
  const fromShot = p && typeof p === 'object' ? MOTION_PROFILES[p.motion] : null;
  return fromShot || MOTION_PROFILES.flat;
}

// A frame longer than this is a hitch (resume from background), not flight:
// integrating it raw would fling every round out of the tank. Exported so the
// lane can move a shot by exactly the span it just integrated.
export const MAX_MOTION_STEP = 0.25;
// The same turn rate the homing logic uses, so a guided round's velocity
// catches up to its heading at the rate the heading is actually turning.
const STEER_TURN = 16;

/** The per-shot phase a profile oscillates on: a pure integer hash of
 *  p.seed, so two shots fired with the same seed fly identically and
 *  stepMotion never reaches for Math.random. */
function phaseOf(seed) {
  if (!Number.isFinite(seed)) return 0;
  let h = Math.imul(Math.floor(seed * 65536) | 0, 0x27d4eb2d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Shortest signed turn from a to b, in (-PI, PI]. */
function turnTo(a, b) {
  let diff = b - a;
  while (diff < -Math.PI) diff += TAU;
  while (diff > Math.PI) diff -= TAU;
  return diff;
}

/**
 * Advance one shot's velocity, heading and spin by `dt`.
 *
 * Mutates exactly five fields — p.vx, p.vy, p.angle, p.spin, p._motionT — and
 * nothing else, so the caller owns position. A `flat` shot is a true no-op
 * (returns false, touches no field). Bad input is absorbed rather than
 * propagated: a NaN dt is a zero step and a bare shot object is simply
 * integrated from rest.
 *
 * opts.steer   the shot has a live target and its heading owns the direction
 *               (a guided round still tracks; gravity only bends it)
 * opts.spin    false under reduced motion: the profile still flies identically
 *               but no spin is accumulated for anything to read
 * Returns true when the profile actually did work.
 */
export function stepMotion(p, dt, opts) {
  if (!p || typeof p !== 'object') return false;
  const prof = profileFor(p, opts);
  if (!prof || prof === MOTION_PROFILES.flat) return false;

  const step = (typeof dt === 'number' && Number.isFinite(dt) && dt > 0)
    ? (dt > MAX_MOTION_STEP ? MAX_MOTION_STEP : dt)
    : 0;
  const t = (Number.isFinite(p._motionT) ? p._motionT : 0) + step;
  let vx = Number.isFinite(p.vx) ? p.vx : 0;
  let vy = Number.isFinite(p.vy) ? p.vy : 0;
  const ph = phaseOf(p.seed) * TAU;
  const steer = !!(opts && opts.steer);
  const spinOn = !(opts && opts.spin === false);

  // Water: heavy, buoyant, and it sheds speed whether you like it or not.
  if (prof.gravity) vy += prof.gravity * step;
  if (prof.buoyancy) vy -= prof.buoyancy * step;
  if (prof.drag) {
    const keep = 1 - prof.drag * step;
    if (keep > 0) { vx *= keep; vy *= keep; }
    else { vx = 0; vy = 0; }
  }
  // A thrust swell (spark burn, chain charge) rides the flight path.
  if (prof.thrustCycle) {
    const swell = 1 + 0.75 * (0.5 + 0.5 * Math.sin(t * prof.thrustCycle * TAU + ph));
    vx *= swell;
    vy *= swell;
  }
  // A hop lane advances in pulses: the inter-hop drag is exactly cancelled by
  // the impulse, so the shot stutters without changing its average speed.
  if (prof.blinkEvery > 0) {
    const period = prof.blinkEvery;
    const hops = Math.floor(t / period) - Math.floor((t - step) / period);
    if (hops > 0) {
      const keep = Math.max(0.05, 1 - prof.drag * period);
      const hop = 1 / keep;
      vx *= hop;
      vy *= hop;
    }
  }
  // A side push perpendicular to travel: the weave of a plasma orb.
  if (prof.lateral) {
    const sp = Math.hypot(vx, vy);
    const nx = sp > 1e-6 ? -vy / sp : 1;
    const ny = sp > 1e-6 ? vx / sp : 0;
    const push = prof.lateral * Math.sin(t * prof.lateralFreq * TAU + ph) * step;
    vx += nx * push;
    vy += ny * push;
  }
  // A thrown blade's own spin. Accumulated (not a rate) so an impact can add
  // to it and a tumble carries on through the rest of the flight.
  let rotation = 0;
  if (prof.spin) {
    // The heading turns by the spin either way, so reduced motion (which skips
    // only the bookkeeping) never changes how a round travels.
    rotation = prof.spin * step;
    if (spinOn) p.spin = (Number.isFinite(p.spin) ? p.spin : 0) + rotation;
  }
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) { vx = 0; vy = 0; }

  const sp = Math.hypot(vx, vy);
  if (sp > 1e-6) {
    const heading = Math.atan2(vy, vx);
    if (steer) {
      // A guided round's heading wins; the velocity catches up at the homing
      // turn rate, so the round still tracks and still sags under its profile.
      const want = Number.isFinite(p.angle) ? p.angle : heading;
      const diff = turnTo(heading, want);
      const max = STEER_TURN * step;
      const turn = Math.abs(diff) <= max ? diff : Math.sign(diff) * max;
      const na = heading + turn;
      vx = Math.cos(na) * sp;
      vy = Math.sin(na) * sp;
    } else if (rotation) {
      // Unguided: the body tumbles and the flight path turns with it.
      const na = heading + rotation;
      vx = Math.cos(na) * sp;
      vy = Math.sin(na) * sp;
    }
    // A guided lane keeps the heading the homing logic gave it; an unguided
    // one points wherever its velocity points.
    if (!steer) p.angle = Math.atan2(vy, vx);
  }
  if (!Number.isFinite(p.angle)) p.angle = sp > 1e-6 ? Math.atan2(vy, vx) : 0;

  p._motionT = t;
  p.vx = vx;
  p.vy = vy;
  return true;
}

/**
 * The FIRST live enemy whose circle the segment (px,py) -> (p.x,p.y) crosses,
 * closest along the segment first. This is what makes a 4000px/s round
 * tunnel-proof: a per-frame point test misses anything that moved further than
 * its own radius in one step, a swept test cannot.
 *
 * Allocation-free (the hot path runs for every unguided shot every frame) and
 * total: null entries, dead enemies and unresolvable input all answer null.
 */
export function sweptHit(p, px, py, enemies, radiusPad = 0) {
  if (!p || typeof p !== 'object') return null;
  if (!enemies || typeof enemies.length !== 'number' || enemies.length === 0) return null;
  const x0 = Number.isFinite(px) ? px : (Number.isFinite(p.x) ? p.x : 0);
  const y0 = Number.isFinite(py) ? py : (Number.isFinite(p.y) ? p.y : 0);
  const x1 = Number.isFinite(p.x) ? p.x : x0;
  const y1 = Number.isFinite(p.y) ? p.y : y0;
  const pad = Number.isFinite(radiusPad) && radiusPad > 0 ? radiusPad : 0;
  const sx = x1 - x0;
  const sy = y1 - y0;
  const len2 = sx * sx + sy * sy;
  let best = null;
  let bestT = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || e.dead) continue;
    const ex = e.x;
    const ey = e.y;
    if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;
    const r = (Number.isFinite(e.radius) && e.radius > 0 ? e.radius : 0) + pad;
    let t = 0;
    if (len2 > 1e-9) {
      t = ((ex - x0) * sx + (ey - y0) * sy) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }
    const cx = x0 + sx * t - ex;
    const cy = y0 + sy * t - ey;
    if (cx * cx + cy * cy <= r * r && t < bestT) {
      bestT = t;
      best = e;
    }
  }
  return best;
}

// Scratch rect for bounds resolution — bounceWalls never re-enters itself, and
// a ricochet is not worth an array per shot per frame.
const RECT = [0, 0, 0, 0];

// Hoisted out of resolveBounds/isBounds: both run per ricocheting round per
// frame, and a closure allocated there is garbage the hot path can never
// afford.
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Read a play rect as a { left, top, right, bottom } tuple, or null when the
 * input is not a rect at all. Accepts {x,y,w,h} (and width/height) as well as
 * the four named edges, and rejects inverted/NaN rects rather than reflecting
 * a shot into nowhere.
 */
export function resolveBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') return null;
  let left;
  let top;
  let right;
  let bottom;
  if (isFiniteNumber(bounds.left)) {
    left = bounds.left;
    top = bounds.top;
    right = bounds.right;
    bottom = bounds.bottom;
  } else if (isFiniteNumber(bounds.x) && isFiniteNumber(bounds.y)) {
    const w = isFiniteNumber(bounds.w) ? bounds.w : bounds.width;
    const h = isFiniteNumber(bounds.h) ? bounds.h : bounds.height;
    if (!isFiniteNumber(w) || !isFiniteNumber(h)) return null;
    left = bounds.x;
    top = bounds.y;
    right = bounds.x + w;
    bottom = bounds.y + h;
  } else {
    return null;
  }
  if (!(isFiniteNumber(left) && isFiniteNumber(top) && isFiniteNumber(right) && isFiniteNumber(bottom))) return null;
  if (!(right > left && bottom > top)) return null;
  RECT[0] = left;
  RECT[1] = top;
  RECT[2] = right;
  RECT[3] = bottom;
  return RECT;
}

/** Cheap predicate for the caller: can these bounds be bounced off at all? */
export function isBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') return false;
  if (isFiniteNumber(bounds.left)) {
    return isFiniteNumber(bounds.top) && isFiniteNumber(bounds.right) && isFiniteNumber(bounds.bottom)
      && bounds.right > bounds.left && bounds.bottom > bounds.top;
  }
  if (isFiniteNumber(bounds.x) && isFiniteNumber(bounds.y)) {
    const w = isFiniteNumber(bounds.w) ? bounds.w : bounds.width;
    const h = isFiniteNumber(bounds.h) ? bounds.h : bounds.height;
    return isFiniteNumber(w) && isFiniteNumber(h) && w > 0 && h > 0;
  }
  return false;
}

// A ricochet sheds speed twice: once off the wall (restitution) and once to
// the water it just disturbed (tangent loss).
const RICOCHET_LOSS = 0.9;
// A bounce tumbles the body: the heading change is the spin it picks up.
const SPIN_GAIN = 1.6;

/**
 * Reflect a shot off a rect, in place. Damps the speed it keeps, tumbles the
 * body by the heading change, and clamps the position back inside so a shot
 * can never end a frame outside the rect. Returns how many walls it hit this
 * tick — 0 when it hit none, and 0 when the bounds are missing or unusable,
 * because a round in open water must not care.
 *
 * Writes p.nx/p.ny (the surface normal of the last impact, for the ricochet
 * spark) — numbers only, never a reference to anything gameplay owns.
 */
export function bounceWalls(p, bounds, restitution) {
  if (!p || typeof p !== 'object') return 0;
  const rect = resolveBounds(bounds);
  if (!rect) return 0;
  const x0 = Number.isFinite(p.x) ? p.x : NaN;
  const y0 = Number.isFinite(p.y) ? p.y : NaN;
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return 0;
  const left = rect[0];
  const top = rect[1];
  const right = rect[2];
  const bottom = rect[3];
  const preVx = Number.isFinite(p.vx) ? p.vx : 0;
  const preVy = Number.isFinite(p.vy) ? p.vy : 0;
  const r = Number.isFinite(restitution) ? Math.min(1, Math.max(0, restitution)) : 0.6;
  let x = x0;
  let y = y0;
  let vx = preVx;
  let vy = preVy;
  let hits = 0;
  let nx = 0;
  let ny = 0;
  if (x <= left) {
    x = left;
    if (vx < 0) { vx = -vx * r; nx = 1; ny = 0; hits++; }
  } else if (x >= right) {
    x = right;
    if (vx > 0) { vx = -vx * r; nx = -1; ny = 0; hits++; }
  }
  if (y <= top) {
    y = top;
    if (vy < 0) { vy = -vy * r; nx = 0; ny = 1; hits++; }
  } else if (y >= bottom) {
    y = bottom;
    if (vy > 0) { vy = -vy * r; nx = 0; ny = -1; hits++; }
  }
  if (hits === 0) {
    p.nx = 0;
    p.ny = 0;
    return 0;
  }
  vx *= RICOCHET_LOSS;
  vy *= RICOCHET_LOSS;
  const pre = Math.atan2(preVy, preVx);
  const post = Math.atan2(vy, vx);
  p.spin = (Number.isFinite(p.spin) ? p.spin : 0) + turnTo(pre, post) * SPIN_GAIN;
  p.angle = post;
  p.x = Math.min(right, Math.max(left, x));
  p.y = Math.min(bottom, Math.max(top, y));
  p.vx = vx;
  p.vy = vy;
  p.nx = nx;
  p.ny = ny;
  return hits;
}

// Quadratic in speed means a 4000px/s hitch frame reads as a million-tonne
// impact; this is the ceiling that keeps the number usable as an impulse.
const MOMENTUM_MAX = 1e7;

/**
 * How hard this shot is hitting, as energy per unit mass: 0.5 * speed^2 *
 * size, from the velocity when it has one and from p.speed otherwise (a shot
 * mid-aim has a speed but no velocity yet). Clamped to a sane range so a
 * tunneled frame or a big round cannot hand the tank a nonsense impulse.
 */
export function momentumOf(p) {
  if (!p || typeof p !== 'object') return 0;
  const vx = Number.isFinite(p.vx) ? p.vx : 0;
  const vy = Number.isFinite(p.vy) ? p.vy : 0;
  let v2 = vx * vx + vy * vy;
  if (!(v2 > 0)) {
    const sp = Number.isFinite(p.speed) ? p.speed : 0;
    v2 = sp * sp;
  }
  if (!(v2 > 0)) return 0;
  const size = Number.isFinite(p.size) && p.size > 0 ? p.size : 1;
  const m = 0.5 * v2 * size;
  if (!Number.isFinite(m) || m <= 0) return 0;
  return m > MOMENTUM_MAX ? MOMENTUM_MAX : m;
}

// Each in-flight event (a ricochet, a spent pierce charge) costs a round this
// much of its punch, so a shot that has been through the tank is a spent shot.
const FALLOFF_PER_EVENT = 0.1;

/**
 * The damage a shot is still worth after `hitsOrBounces` in-flight losses.
 * Whole numbers, floored at 1 — a shot that has been everywhere still lands
 * *something*, and a shot with no damage data at all is never NaN.
 */
export function terminalFalloff(p, hitsOrBounces) {
  const base = p && typeof p === 'object'
    ? (Number.isFinite(p.baseDamage) ? p.baseDamage
      : (Number.isFinite(p.damage) ? p.damage : 1))
    : 1;
  let events = Number.isFinite(hitsOrBounces) ? hitsOrBounces : 0;
  if (events < 0) events = 0;
  const left = base * Math.pow(1 - FALLOFF_PER_EVENT, events);
  if (!Number.isFinite(left)) return 1;
  return Math.max(1, Math.round(left));
}
