/**
 * gunRoundBodies — one hand-drawn body per gun, drawn from the gun's name.
 *
 * `gunProjectile.js` answers WHAT a gun throws (`shape`, `color`, `size`) and
 * `SHAPES` stays a set of 15 shared looks. This module answers the other half:
 * 58 distinct SILHOUETTES, one per firing gun id, so a bolt in flight reads as
 * the weapon that fired it before the player ever sees whose pleco it came
 * from. An anchor round has flukes and a stock cross-bar; a sonarchime round is
 * chevrons racing outward; a mawengine round is a spiral throat. Two guns can
 * share a colour and still never share a body.
 *
 * Rules this file is built to (mobile draw loop, ~60 fps, dozens of bolts):
 *   - PURE PATHS. No `shadowBlur`, no gradients, no filters, no images, no
 *     text. Glow is layered low-alpha fills plus one hot near-white note, the
 *     same trick the bridge's `_drawGun*Bolt` family uses.
 *   - NO PER-FRAME ALLOCATION in the hot path: literal numbers, locals and
 *     loops only. Every colour is a module constant, so no string is built
 *     while a bolt is on screen.
 *   - 2 or 3 path groups per body, sized to stay readable from s ≈ 3 (a phone
 *     at arm's length) up to s ≈ 10. Nothing spindly, nothing that needs a
 *     gradient to be seen.
 *   - SELF-CONTAINED: no imports, so the bridge can pull this in without an
 *     import cycle, and a stub context in a test can too.
 *
 * The frame arrives already translated to the bolt and rotated onto its flight
 * angle, so local +X is FORWARD for every body here and every trail streams
 * back toward -X. Bodies never read or write the bolt.
 */

/** Full turn. Local, so the file stays import-free. */
const TAU = Math.PI * 2;

/** The hot near-white note every body puts on its brightest face — the same
 *  `#fff8e0` the bridge's bolt painters use for a core, so these bodies and
 *  the shared-shape fallback sit in the same light. */
const HOT = '#fff8e0';

/** Used when a bolt arrives with no colour of its own (a bare fist never gets
 *  this far, but a stubbed or half-built bolt can). */
const DEFAULT_COLOR = '#9fe8ff';

/**
 * Every gun id with a body of its own, sorted. This is exactly the key set of
 * `GUN_PROJECTILES`: a future gun has to arrive with BOTH its projectile
 * profile and a silhouette to draw it with, and a renamed gun cannot quietly
 * fall back to somebody else's body.
 */
export const GUN_ROUND_IDS = Object.freeze([
  'abyssalchoir', 'abyssbeam', 'acidsprayer', 'anchor', 'anglereel',
  'bilgepump', 'blinklance', 'bolas', 'boomerang', 'brinelance',
  'bubblecannon', 'cannon', 'chum', 'clamcannon', 'conchsonar',
  'coralboomerang', 'coralclaw', 'coralturret', 'crossbow', 'cryo',
  'depthcharge', 'dolphinsonar', 'eelvoltgun', 'foambell', 'fractalfang',
  'geyserlauncher', 'glacierlance', 'glaive', 'gluegun', 'goldfishpistol',
  'grapple', 'harpoongun', 'harpoonrifle', 'hermitcannon', 'icefishcryo',
  'inkbomb', 'jellyburst', 'jellylauncher', 'krakenshotgun', 'krakenwrath',
  'krillsprayer', 'lanternplasma', 'launcher', 'leviathanmaw', 'lobsterbomb',
  'lobsterclaw', 'magmacore', 'magnetgun', 'mantarail', 'mawengine',
  'minigun', 'moraytesla', 'narwhalrail', 'netgun', 'nudizapper', 'nullwave',
  'octoblaster', 'orcaplasma', 'pearlrifle', 'piranhapod', 'pistol',
  'plasmacutter', 'pufferlauncher', 'railgun', 'reefminigun', 'reeftorpedo',
  'rifle', 'scallopshotgun', 'seamine', 'shardstorm', 'sharkrifle',
  'shellring', 'shotgun', 'shrimppistol', 'singularity', 'siphon', 'sling',
  'snapperpistol', 'sonarchime', 'sporelauncher', 'squidsling',
  'squidsprayer', 'starchakram', 'stingraytesla', 'stormcaller', 'stormreel',
  'sunfishcannon', 'sunlance', 'teslacoral', 'thermalblaster', 'tidesniper',
  'torpedo', 'turret', 'turtlecrossbow', 'urchinshotgun', 'voidripper',
  'walrusshotgun', 'whirlpool', 'zapper',
]);

/**
 * The bodies themselves: `(ctx, s, color, time)` each, keyed by gun id. `s` is
 * already clamped by the dispatcher, so geometry is plain arithmetic off `s`.
 * Anything that spins does its own save/rotate/restore, so a tumbling body
 * never leaves the next bolt rotated.
 */
const GUN_ROUND_BODIES = Object.freeze({
  /** Abyssal choir — the mouth at the floor of the trench: five fat gill
   *  petals ringing a hollow throat, turning as slowly as something breathing. */
  abyssalchoir(ctx, s, color, time) {
    const spin = time * 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, s * 0.34);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = spin + i * (TAU / 5);
      ctx.arc(0, 0, s * 0.85, a - 0.62, a + 0.62);
    }
    ctx.stroke();
    // The thin outer gill ring: the sound travelling out of it.
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.55, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.34, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Acid sprayer — four teardrops leaving the nozzle as a fan, already
   *  beading where the run-off drips off them. */
  acidsprayer(ctx, s, color, time) {
    const wob = Math.sin(time * 14) * 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      const a = i * 0.42 + wob;
      const dx = Math.cos(a), dy = Math.sin(a);
      const px = -dy, py = dx;
      ctx.moveTo(dx * s * 1.9, dy * s * 1.9);
      ctx.quadraticCurveTo(dx * s * 0.6 + px * s * 0.5, dy * s * 0.6 + py * s * 0.5,
        -dx * s * 1.2, -dy * s * 1.2);
      ctx.quadraticCurveTo(dx * s * 0.6 - px * s * 0.5, dy * s * 0.6 - py * s * 0.5,
        dx * s * 1.9, dy * s * 1.9);
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(-s * 1.9, s * 0.15, Math.max(0.7, s * 0.16), 0, TAU);
    ctx.arc(-s * 2.7, -s * 0.2, Math.max(0.5, s * 0.11), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Anchor — a real one: shank and ring forward, two flukes swept back, and
   *  the stock cross-bar that stops it turning end over end. Sways as it flies. */
  anchor(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(Math.sin(time * 4) * 0.22);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.3, s * 0.3);
    ctx.beginPath();
    ctx.moveTo(s * 1.75, 0);
    ctx.arc(s * 1.75, 0, s * 0.36, 0, TAU);
    ctx.moveTo(s * 1.75, 0);
    ctx.lineTo(-s * 1.45, 0);
    ctx.moveTo(-s * 1.4, 0);
    ctx.quadraticCurveTo(-s * 1.05, s * 1.25, s * 0.15, s * 0.95);
    ctx.moveTo(-s * 1.4, 0);
    ctx.quadraticCurveTo(-s * 1.05, -s * 1.25, s * 0.15, -s * 0.95);
    ctx.stroke();
    // Stock.
    ctx.lineWidth = Math.max(1.2, s * 0.26);
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.9);
    ctx.lineTo(-s * 0.55, s * 0.9);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.1, s * 0.95, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.arc(s * 0.1, -s * 0.95, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Angle reel — a snagged hook. Line down the top, a J bend, one barb, and a
   *  bright bead where the line meets the eye of the hook. */
  anglereel(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(Math.sin(time * 6) * 0.2);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.26);
    ctx.beginPath();
    ctx.moveTo(s * 1.4, -s * 1.7);
    ctx.lineTo(s * 1.4, s * 0.1);
    ctx.arc(s * 0.55, s * 0.1, s * 0.85, 0, Math.PI * 1.15);
    ctx.moveTo(s * 1.05, -s * 0.33);
    ctx.lineTo(-s * 0.75, s * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.4, -s * 1.5, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.arc(-s * 0.2, -s * 0.28, Math.max(0.6, s * 0.2), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Bilge pump — a reciprocating pump head: valve slab forward, twin pistons
   *  shoving from behind, the stroke legible as the rods pump in and out. */
  bilgepump(ctx, s, color, time) {
    const push = Math.abs(Math.sin(time * 8)) * s * 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(s * 0.45, -s * 0.95, s * 1.35, s * 1.9);
    ctx.rect(-s * 1.65 + push, -s * 0.44, s * 2.1 - push, s * 0.34);
    ctx.rect(-s * 1.65 + push, s * 0.1, s * 2.1 - push, s * 0.34);
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 0.95);
    ctx.lineTo(s * 0.5, s * 0.95);
    ctx.moveTo(s * 1.8, 0);
    ctx.lineTo(s * 2.35, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Blink lance — caught mid-teleport: the rear of the bolt is still phasing
   *  in as a thin outline, the leading edge has already landed as a hot bar. */
  blinklance(ctx, s, color, time) {
    const ph = 0.5 + 0.5 * Math.sin(time * 10);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.3, s * 0.28);
    ctx.globalAlpha = 0.35 + 0.4 * ph;
    ctx.beginPath();
    ctx.rect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4);
    ctx.stroke();
    // The edge that arrived first.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(s * 1.2, -s * 1.2);
    ctx.lineTo(s * 1.2, s * 1.2);
    ctx.moveTo(s * 1.35, 0);
    ctx.lineTo(s * 2.4, 0);
    ctx.stroke();
  },

  /** Bolas — two weighted balls on cords off one point, the pair swinging
   *  round each other as the throw spins up. */
  bolas(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(Math.sin(time * 7) * 0.3);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(s * 1.7, 0);
    ctx.quadraticCurveTo(0, s * 0.7, -s * 1.1, s * 1.1);
    ctx.moveTo(s * 1.7, 0);
    ctx.quadraticCurveTo(0, -s * 0.7, -s * 1.1, -s * 1.1);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-s * 1.3, s * 1.3, s * 0.55, 0, TAU);
    ctx.arc(-s * 1.3, -s * 1.3, s * 0.55, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.6, 0, Math.max(0.9, s * 0.26), 0, TAU);
    ctx.arc(-s * 1.3, s * 1.3, Math.max(0.5, s * 0.15), 0, TAU);
    ctx.arc(-s * 1.3, -s * 1.3, Math.max(0.5, s * 0.15), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Boomerang — the lunate curve, spinning flat about the flight axis the way
   *  the returning throw actually tumbles. */
  boomerang(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 9);
    ctx.fillStyle = color;
    ctx.beginPath();
    // Two mirrored arms sweeping off a forward point.
    for (let i = 0; i < 2; i++) {
      const y = i === 0 ? 1 : -1;
      ctx.moveTo(s * 2.1, 0);
      ctx.quadraticCurveTo(s * 0.3, y * s * 0.55, -s * 1.55, y * s * 1.5);
      ctx.lineTo(-s * 1.0, y * s * 0.72);
      ctx.quadraticCurveTo(s * 0.35, y * s * 0.02, s * 1.5, 0);
      ctx.closePath();
    }
    ctx.fill();
    // Hot along the leading nose and the two tips.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 2.0, 0, Math.max(0.8, s * 0.24), 0, TAU);
    ctx.arc(-s * 1.5, s * 1.45, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.arc(-s * 1.5, -s * 1.45, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Brine lance — a salt crystal: a six-face bipyramid with its facet seams
   *  showing, rocking slightly as it flies. */
  brinelance(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(Math.sin(time * 5) * 0.18);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.2, 0);
    ctx.lineTo(s * 0.5, s * 0.62);
    ctx.lineTo(-s * 1.1, s * 0.4);
    ctx.lineTo(-s * 1.1, -s * 0.4);
    ctx.lineTo(s * 0.5, -s * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.9, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(s * 2.2, 0);
    ctx.lineTo(-s * 1.1, s * 0.4);
    ctx.moveTo(s * 2.2, 0);
    ctx.lineTo(-s * 1.1, -s * 0.4);
    ctx.moveTo(s * 0.5, s * 0.62);
    ctx.lineTo(s * 0.5, -s * 0.62);
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(-s * 1.6, -s * 0.9, Math.max(0.5, s * 0.13), 0, TAU);
    ctx.arc(-s * 1.7, s * 0.95, Math.max(0.5, s * 0.13), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Bubble cannon — a cluster of blown bubbles, the big one still the
   *  brightest: a translucent body, a hot meniscus glint, two satellites. */
  bubblecannon(ctx, s, color, time) {
    const wob = Math.sin(time * 6) * s * 0.12;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.1, s * 0.22);
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15, 0, TAU);
    ctx.arc(s * 1.35 + wob, -s * 0.75, s * 0.6, 0, TAU);
    ctx.arc(s * 1.2, s * 0.95, s * 0.45, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15, 0, TAU);
    ctx.fill();
    // Glints: light sits where light sits, on the upper-left of a bubble.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(-s * 0.42, -s * 0.42, Math.max(0.7, s * 0.2), 0, TAU);
    ctx.arc(s * 1.35 + wob, -s * 0.75, Math.max(0.5, s * 0.13), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Cannon — a solid shot, not a spark: an ogive body with two driving bands
   *  cut into it and a hot nose point. */
  cannon(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.3, 0);
    ctx.quadraticCurveTo(s * 1.4, -s * 0.95, -s * 0.6, -s * 0.95);
    ctx.lineTo(-s * 1.1, -s * 0.7);
    ctx.lineTo(-s * 1.1, s * 0.7);
    ctx.lineTo(-s * 0.6, s * 0.95);
    ctx.quadraticCurveTo(s * 1.4, s * 0.95, s * 2.3, 0);
    ctx.closePath();
    ctx.fill();
    // Driving bands.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.rect(s * 0.35, -s * 0.95, s * 0.34, s * 1.9);
    ctx.rect(-s * 0.15, -s * 0.9, s * 0.28, s * 1.8);
    ctx.fill();
    // Nose.
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(s * 1.75, 0, Math.max(0.8, s * 0.24), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Chum — a bait cloud off the stern: four overlapping lumps plus the
   *  flecks already shed astern. Nothing sharp about it on purpose. */
  chum(ctx, s, color, time) {
    const g = Math.sin(time * 5);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-s * 0.9, s * 0.35 + g * s * 0.12, s * 0.85, 0, TAU);
    ctx.arc(s * 0.5, -s * 0.5 - g * s * 0.1, s * 0.95, 0, TAU);
    ctx.arc(s * 0.3, s * 0.9, s * 0.7, 0, TAU);
    ctx.arc(s * 1.4, s * 0.1, s * 0.55, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(-s * 2.0, -s * 0.6, Math.max(0.6, s * 0.16), 0, TAU);
    ctx.arc(-s * 2.4, s * 0.7, Math.max(0.5, s * 0.13), 0, TAU);
    ctx.arc(-s * 1.6, -s * 1.35, Math.max(0.5, s * 0.12), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Coral claw — a growing coral tip: three prongs forking off one stem,
   *  each ending in a lit polyp, swaying with the current. */
  coralclaw(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(Math.sin(time * 4) * 0.16);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.3, s * 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 1.6, 0);
    ctx.lineTo(s * 0.2, 0);
    ctx.moveTo(s * 0.1, 0);
    ctx.quadraticCurveTo(s * 1.2, s * 0.2, s * 1.9, s * 1.2);
    ctx.moveTo(s * 0.1, 0);
    ctx.quadraticCurveTo(s * 1.2, -s * 0.2, s * 1.9, -s * 1.2);
    ctx.moveTo(s * 0.9, s * 0.42);
    ctx.quadraticCurveTo(s * 1.5, s * 0.3, s * 2.15, s * 0.1);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.9, s * 1.2, Math.max(0.7, s * 0.2), 0, TAU);
    ctx.arc(s * 1.9, -s * 1.2, Math.max(0.7, s * 0.2), 0, TAU);
    ctx.arc(s * 2.2, s * 0.1, Math.max(0.6, s * 0.16), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Crossbow — the prod and its string: two limbs sweeping forward, the
   *  string cocked back and flicking, the stock a hot bar along the axis. */
  crossbow(ctx, s, color, time) {
    const cock = 0.25 + 0.2 * Math.sin(time * 9);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.3, s * 0.28);
    ctx.beginPath();
    ctx.moveTo(s * 1.5, -s * 1.35);
    ctx.quadraticCurveTo(s * 1.75, 0, s * 1.5, s * 1.35);
    ctx.moveTo(s * 1.5, -s * 1.35);
    ctx.quadraticCurveTo(s * 0.1, -s * 0.9 + cock * s, -s * 0.3, -s * 0.2);
    ctx.moveTo(s * 1.5, s * 1.35);
    ctx.quadraticCurveTo(s * 0.1, s * 0.9 - cock * s, -s * 0.3, s * 0.2);
    ctx.stroke();
    // Stock and the bolt riding it.
    ctx.strokeStyle = HOT;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-s * 1.6, 0);
    ctx.lineTo(s * 0.5, 0);
    ctx.moveTo(-s * 1.6, -s * 0.22);
    ctx.lineTo(-s * 1.6, s * 0.22);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Cryo — a six-arm flake with a barb pair on every arm, drifting over on
   *  its slow spin. The barbs are what make it snow and not a cog. */
  cryo(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 2.4);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.24);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * (TAU / 6);
      const cx = Math.cos(a), cy = Math.sin(a);
      const bx = -Math.sin(a), by = Math.cos(a);
      ctx.moveTo(0, 0);
      ctx.lineTo(cx * s * 1.9, cy * s * 1.9);
      const mx = cx * s * 1.1, my = cy * s * 1.1;
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + (cx * 0.6 + bx * 0.8) * s, my + (cy * 0.6 + by * 0.8) * s);
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + (cx * 0.6 - bx * 0.8) * s, my + (cy * 0.6 - by * 0.8) * s);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.34, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Depth charge — a contact mine: six spikes radiating off a solid drum,
   *  one fore and five aft, spinning slowly as it sinks. */
  depthcharge(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 1.6);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * (TAU / 6);
      const cx = Math.cos(a), cy = Math.sin(a);
      const bx = -Math.sin(a), by = Math.cos(a);
      ctx.moveTo(cx * s * 0.85 - bx * s * 0.24, cy * s * 0.85 - by * s * 0.24);
      ctx.lineTo(cx * s * 1.9, cy * s * 1.9);
      ctx.lineTo(cx * s * 0.85 + bx * s * 0.24, cy * s * 0.85 + by * s * 0.24);
      ctx.closePath();
    }
    ctx.moveTo(s * 1.05, 0);
    ctx.arc(0, 0, s * 1.05, 0, TAU);
    ctx.fill();
    // Fuze ring and the horn that trips it.
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.18);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, TAU);
    ctx.moveTo(0, -s * 1.05);
    ctx.lineTo(0, -s * 1.75);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Foam bell — a jellyfish of foam: a pulsing dome over a flared skirt,
   *  with the clapper showing through under the rim. */
  foambell(ctx, s, color, time) {
    const pulse = 1 + 0.12 * Math.sin(time * 4.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15 * pulse, Math.PI, 0);
    ctx.lineTo(s * 1.55, s * 0.9);
    ctx.quadraticCurveTo(0, s * 1.35, -s * 1.55, s * 0.9);
    ctx.closePath();
    ctx.fill();
    // Rim light plus the clapper line under it.
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.18);
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, s * 0.85);
    ctx.quadraticCurveTo(0, s * 1.28, s * 1.5, s * 0.85);
    ctx.moveTo(0, s * 0.15);
    ctx.lineTo(0, s * 0.9);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Fractal fang — the pattern that names it: a lightning spine with the
   *  same kink repeated one scale down on every branch. */
  fractalfang(ctx, s, color, time) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.26);
    ctx.beginPath();
    ctx.moveTo(-s * 1.9, s * 0.5);
    ctx.lineTo(-s * 0.7, -s * 0.15);
    ctx.lineTo(s * 0.4, s * 0.55);
    ctx.lineTo(s * 1.9, -s * 0.35);
    // Children, same two-kink shape, smaller.
    ctx.moveTo(-s * 0.7, -s * 0.15);
    ctx.lineTo(-s * 0.95, -s * 0.7);
    ctx.lineTo(-s * 0.4, -s * 1.25);
    ctx.moveTo(s * 0.4, s * 0.55);
    ctx.lineTo(s * 0.15, s * 1.1);
    ctx.lineTo(s * 0.75, s * 1.5);
    ctx.moveTo(-s * 0.7, -s * 0.15);
    ctx.lineTo(s * 0.05, -s * 0.75);
    ctx.moveTo(s * 0.4, s * 0.55);
    ctx.lineTo(-s * 0.35, s * 1.0);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.9, -s * 0.35, Math.max(0.8, s * 0.24), 0, TAU);
    ctx.arc(s * 0.4, s * 0.55, Math.max(0.6, s * 0.16), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Glacier lance — a calved wedge of ice, not a needle: a broad blade with a
   *  splayed shoulder and the melt facets running back through it. */
  glacierlance(ctx, s, color, time) {
    const grind = 1 + Math.sin(time * 8) * 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.4, 0);
    ctx.lineTo(-s * 0.4, -s * grind);
    ctx.lineTo(-s * 1.5, -s * 0.45);
    ctx.lineTo(-s * 1.5, s * 0.45);
    ctx.lineTo(-s * 0.4, s * grind);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.9, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(s * 2.4, 0);
    ctx.lineTo(-s * 1.5, -s * 0.45);
    ctx.moveTo(s * 2.4, 0);
    ctx.lineTo(-s * 1.5, s * 0.45);
    ctx.moveTo(-s * 0.2, -s * 0.75);
    ctx.lineTo(-s * 0.2, s * 0.75);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Glaive — a double-edged leaf blade, mid-tumble: the lobe narrows and
   *  widens as it turns so the rotation is seen, not just implied. */
  glaive(ctx, s, color, time) {
    const turn = 0.35 + 0.65 * Math.abs(Math.cos(time * 5.5));
    ctx.save();
    ctx.rotate(time * 11);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.3, 0);
    ctx.quadraticCurveTo(0, s * 1.05 * turn, -s * 1.6, 0);
    ctx.quadraticCurveTo(0, -s * 1.05 * turn, s * 2.3, 0);
    ctx.closePath();
    ctx.fill();
    // Midrib.
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, 0);
    ctx.lineTo(s * 2.2, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // The counterweight the blade is balanced on.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-s * 1.8, 0, s * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /** Glue gun — the round sticks: a lumpy amoeba of a blob with one long
   *  stringy tail trailing off it, and a tacky highlight on the lump. */
  gluegun(ctx, s, color, time) {
    const w = 0.85 + 0.15 * Math.sin(time * 7);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(s * 0.55 * w, 0, s * 0.85 * w, 0, TAU);
    ctx.arc(-s * 0.35, -s * 0.7 * w, s * 0.6 * w, 0, TAU);
    ctx.arc(-s * 0.35, s * 0.75 * w, s * 0.65 * w, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, s * 0.1);
    ctx.quadraticCurveTo(-s * 1.8, -s * 0.5, -s * 2.5, s * 0.2);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.6, -s * 0.3, Math.max(0.6, s * 0.22), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Grapple — four tines off one shank, thrown not fired: the prongs splay
   *  and close as the line goes taut, tips lit so the count is legible. */
  grapple(ctx, s, color, time) {
    const spread = 0.5 + 0.14 * Math.sin(time * 6);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.3, s * 0.28);
    ctx.beginPath();
    ctx.moveTo(-s * 2.1, 0);
    ctx.lineTo(s * 1.1, 0);
    for (let i = -1; i <= 1; i++) {
      const a = i * spread;
      ctx.moveTo(s * 1.0, 0);
      ctx.quadraticCurveTo(s * 1.9, Math.sin(a) * s * 1.0, s * 1.6,
        Math.sin(a * 1.7) * s * 1.7);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.6, Math.sin(spread * 1.7) * s * 1.7, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.arc(s * 1.6, -Math.sin(spread * 1.7) * s * 1.7, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.arc(s * 1.6, 0, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Harpoon gun — a barbed head, not a needle: broad shoulders, two reverse
   *  barbs that flare on the bite, and the line still running off the tail. */
  harpoongun(ctx, s, color, time) {
    const flare = 0.5 + 0.28 * Math.abs(Math.sin(time * 10));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.4, 0);
    ctx.lineTo(s * 0.4, s * 0.55);
    ctx.lineTo(-s * 0.9, s * 0.3);
    ctx.lineTo(-s * 0.9, -s * 0.3);
    ctx.lineTo(s * 0.4, -s * 0.55);
    ctx.closePath();
    // Reverse barbs.
    ctx.moveTo(-s * 0.8, s * 0.25);
    ctx.lineTo(-s * 1.9 * flare, s * 1.05);
    ctx.lineTo(-s * 0.45, s * 0.08);
    ctx.closePath();
    ctx.moveTo(-s * 0.8, -s * 0.25);
    ctx.lineTo(-s * 1.9 * flare, -s * 1.05);
    ctx.lineTo(-s * 0.45, -s * 0.08);
    ctx.closePath();
    ctx.fill();
    // Point.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(s * 2.4, 0);
    ctx.lineTo(s * 1.15, s * 0.3);
    ctx.lineTo(s * 1.15, -s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Ink bomb — a blot going off in the water: a lumpy nucleus, two tendrils
   *  squirting astern, one clean hot point at the centre. */
  inkbomb(ctx, s, color, time) {
    const p = Math.sin(time * 3.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15, 0, TAU);
    ctx.arc(-s * 1.15, s * 0.7, s * 0.7, 0, TAU);
    ctx.arc(-s * 0.9, -s * 0.85, s * 0.55, 0, TAU);
    ctx.arc(s * 0.9, -s * 0.5, s * 0.45, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(-s * 1.4, s * 0.2);
    ctx.quadraticCurveTo(-s * 2.3, s * 0.2 + p * s * 0.4, -s * 3.0, -s * 0.2 + p * s * 0.6);
    ctx.moveTo(-s * 1.2, -s * 0.5);
    ctx.quadraticCurveTo(-s * 2.0, -s * 1.1 - p * s * 0.3, -s * 2.6, -s * 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.35, 0, Math.max(0.7, s * 0.26), 0, TAU);
    ctx.fill();
  },

  /** Jellyburst — a jellyfish thrown ahead of itself: a pulsing bell over
   *  four waving tentacles, with the bell rim picked out hot. */
  jellyburst(ctx, s, color, time) {
    const pulse = 0.85 + 0.2 * Math.sin(time * 6);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.1, s * 0.22);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5) * s * 0.75;
      ctx.moveTo(o, s * 0.3);
      ctx.quadraticCurveTo(o + Math.sin(time * 5 + i) * s * 0.4, s * 1.3, o, s * 2.1);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 1.3, s * 0.2);
    ctx.arc(0, s * 0.2, s * 1.3 * pulse, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.9, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(-s * 1.3, s * 0.2);
    ctx.arc(0, s * 0.2, s * 1.3 * pulse, Math.PI, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Kraken wrath — one arm thrown as a round: a thick stroke curling back
   *  into a hook, a row of suckers along it, the hot tip on the strike. */
  krakenwrath(ctx, s, color, time) {
    const curl = Math.sin(time * 3.2);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, s * 0.36);
    ctx.beginPath();
    ctx.moveTo(-s * 2.0, s * 0.8);
    ctx.quadraticCurveTo(s * 0.6, s * 0.9 + curl * s * 0.5, s * 1.6, -s * 0.2);
    ctx.quadraticCurveTo(s * 2.3, -s * 1.35, s * 0.8, -s * 1.1);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-s * 0.9, s * 0.75, s * 0.26, 0, TAU);
    ctx.arc(0, s * 0.6, s * 0.26, 0, TAU);
    ctx.arc(s * 0.9, s * 0.2, s * 0.26, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.8, -s * 1.1, Math.max(0.7, s * 0.24), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Launcher — a stubby tube round: cylindrical body, three fins swept hard
   *  back, exhaust bloom flaring behind the nozzle. */
  launcher(ctx, s, color, time) {
    const blow = 0.8 + 0.2 * Math.sin(time * 18);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 1.9, 0);
    ctx.quadraticCurveTo(s * 1.3, -s * 0.85, -s * 0.5, -s * 0.85);
    ctx.lineTo(-s * 0.5, s * 0.85);
    ctx.quadraticCurveTo(s * 1.3, s * 0.85, s * 1.9, 0);
    ctx.closePath();
    // Fins: two outboard, one edge-on on the axis.
    ctx.moveTo(-s * 0.35, -s * 0.75);
    ctx.lineTo(-s * 2.0, -s * 1.5);
    ctx.lineTo(-s * 1.35, -s * 0.45);
    ctx.closePath();
    ctx.moveTo(-s * 0.35, s * 0.75);
    ctx.lineTo(-s * 2.0, s * 1.5);
    ctx.lineTo(-s * 1.35, s * 0.45);
    ctx.closePath();
    ctx.moveTo(-s * 0.5, -s * 0.3);
    ctx.lineTo(-s * 1.7, 0);
    ctx.lineTo(-s * 0.5, s * 0.3);
    ctx.closePath();
    ctx.fill();
    // Exhaust.
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.6 * blow);
    ctx.lineTo(-s * 2.6 * blow, 0);
    ctx.lineTo(-s * 0.6, s * 0.6 * blow);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Leviathan maw — the round IS a bite: two wedge jaws hinging open and
   *  shut, with a hot throat down the middle showing it has already struck. */
  leviathanmaw(ctx, s, color, time) {
    const gape = 0.35 + 0.3 * Math.abs(Math.sin(time * 4));
    ctx.fillStyle = color;
    // Upper jaw, drawn as a toothed wedge: three points on the leading edge.
    ctx.beginPath();
    ctx.moveTo(s * 2.3, 0);
    for (let i = 0; i < 3; i++) {
      const x = s * (1.5 - i * 1.0);
      const h = s * (0.55 + i * 0.25) * gape;
      ctx.lineTo(x - s * 0.35, -h);
      ctx.lineTo(x - s * 0.85, -h * 0.55);
    }
    ctx.lineTo(-s * 1.6, s * 0.2);
    ctx.closePath();
    ctx.fill();
    // Lower jaw, mirrored.
    ctx.beginPath();
    ctx.moveTo(s * 2.3, 0);
    for (let i = 0; i < 3; i++) {
      const x = s * (1.5 - i * 1.0);
      const h = s * (0.55 + i * 0.25) * gape;
      ctx.lineTo(x - s * 0.35, h);
      ctx.lineTo(x - s * 0.85, h * 0.55);
    }
    ctx.lineTo(-s * 1.6, -s * 0.2);
    ctx.closePath();
    ctx.fill();
    // Throat.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.7, 0, s * 0.32, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Magma core — a crust that is already cracking: an irregular seven-sided
   *  shell with seam cracks cut through it and a molten heart breathing. */
  magmacore(ctx, s, color, time) {
    const heat = 0.6 + 0.4 * Math.abs(Math.sin(time * 5));
    ctx.save();
    ctx.rotate(time * 1.2);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = i * (TAU / 7);
      const r = s * (1.15 + 0.18 * Math.sin(i * 2.3));
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    // Cracks.
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 1.15, s * 0.35);
    ctx.lineTo(-s * 0.25, 0);
    ctx.lineTo(s * 0.85, s * 0.5);
    ctx.moveTo(s * 0.1, -s * 1.05);
    ctx.lineTo(s * 0.15, -s * 0.25);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55 * heat, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /** Magnet gun — a horseshoe with its pole faces forward and the field
   *  arcing between them, the arc brightening as the shot loads. */
  magnetgun(ctx, s, color, time) {
    const load = 0.5 + 0.5 * Math.sin(time * 7);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.3, s * 0.3);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    // The shoe: an open-back arc, pole faces at top and bottom.
    ctx.arc(0, 0, s * 1.15, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(0, 0, s * 0.62, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.closePath();
    ctx.stroke();
    // The field between the poles, bowing forward.
    ctx.globalAlpha = 0.45 + 0.45 * load;
    ctx.lineWidth = Math.max(1, s * 0.18);
    ctx.beginPath();
    ctx.moveTo(s * 0.6, -s * 1.05);
    ctx.quadraticCurveTo(s * 2.1, 0, s * 0.6, s * 1.05);
    ctx.moveTo(s * 0.25, -s * 0.85);
    ctx.quadraticCurveTo(s * 1.4, 0, s * 0.25, s * 0.85);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.6, -s * 1.05, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.arc(s * 0.6, s * 1.05, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Maw engine — a gravity throat: two logarithmic arms winding inward
   *  toward a hot vanishing point. Drawn as segments, not a curve. */
  mawengine(ctx, s, color, time) {
    const spin = time * 4.5;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.3, s * 0.26);
    ctx.beginPath();
    for (let arm = 0; arm < 2; arm++) {
      let x = 0, y = 0;
      let a = spin + arm * Math.PI;
      for (let k = 0; k < 16; k++) {
        const step = s * 0.2;
        const nx = x + Math.cos(a) * step;
        const ny = y + Math.sin(a) * step;
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        x = nx;
        y = ny;
        a += 0.45;
      }
    }
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.4, 0, TAU);
    ctx.fill();
  },

  /** Minigun — the barrel cluster, seen end-on from the side as a spinning
   *  drum of six stubs with a round leaving the top of the arc. */
  minigun(ctx, s, color, time) {
    const spin = time * 26;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = spin + i * (TAU / 6);
      const cx = Math.cos(a), cy = Math.sin(a);
      // Each barrel is a small stub square, so the cluster stays bold.
      ctx.moveTo(cx * s * 0.5, cy * s * 0.5);
      ctx.lineTo(cx * s * 1.5 - cy * s * 0.16, cy * s * 1.5 + cx * s * 0.16);
      ctx.lineTo(cx * s * 1.5 + cy * s * 0.16, cy * s * 1.5 - cx * s * 0.16);
      ctx.closePath();
    }
    ctx.moveTo(s * 0.62, 0);
    ctx.arc(0, 0, s * 0.62, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, TAU);
    ctx.arc(s * 1.35, 0, s * 0.22, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Net gun — the mesh itself, not a knot: a diamond frame with a lattice
   *  of crossing chords strung across it, weighted at the crossing. */
  netgun(ctx, s, color, time) {
    const r = s * 1.5;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.18);
    ctx.beginPath();
    // Frame.
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 1.3, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 1.3, 0);
    ctx.closePath();
    // Lattice: three chords each way, so it reads as mesh at phone size.
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(i * r * 0.55, -r * 0.78);
      ctx.lineTo(i * r * 0.55 + r * 0.5, r * 0.78);
      ctx.moveTo(i * r * 0.55, r * 0.78);
      ctx.lineTo(i * r * 0.55 + r * 0.5, -r * 0.78);
    }
    ctx.stroke();
    // The weight in the middle.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.7, s * 0.24), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Null wave — an absence arriving: a lens of nothing with the water
   *  around it still ringing, the wiped slot brightening as it passes. */
  nullwave(ctx, s, color, time) {
    const wipe = 0.4 + 0.6 * Math.abs(Math.sin(time * 3));
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.3, s * 0.3);
    ctx.beginPath();
    // Two arcs meeting at nose and tail.
    ctx.moveTo(s * 2.4, 0);
    ctx.quadraticCurveTo(0, -s * 1.5, -s * 2.4, 0);
    ctx.moveTo(-s * 2.4, 0);
    ctx.quadraticCurveTo(0, s * 1.5, s * 2.4, 0);
    ctx.stroke();
    // The wipe down the middle.
    ctx.globalAlpha = 0.4 + 0.5 * wipe;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1.1, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, 0);
    ctx.lineTo(s * 1.7, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Piranha pod — the toothy version of a claw: a filled wedge whose
   *  trailing edge is a serrated bite-mark rather than a point. */
  piranhapod(ctx, s, color, time) {
    const bite = 0.5 + 0.5 * Math.abs(Math.sin(time * 12));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.3, 0);
    ctx.lineTo(s * 0.2, -s * 0.85);
    // Saw edge: four tooth notches marching back along the flank.
    for (let i = 0; i < 4; i++) {
      const x = s * (0.2 - (i + 0.5) * 0.62);
      ctx.lineTo(x - s * 0.16, s * 0.85 * (i % 2 ? 1 : 0.5));
      ctx.lineTo(x - s * 0.31, -s * 0.85 * (i % 2 ? 0.45 : 1));
    }
    ctx.lineTo(-s * 1.5, 0);
    ctx.closePath();
    ctx.fill();
    // Maw glow.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(s * 2.3, 0);
    ctx.lineTo(s * 1.3, -s * 0.35 * bite);
    ctx.lineTo(s * 1.3, s * 0.35 * bite);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Plasma cutter — the beam that cuts: a solid wedge with the scoring edge
   *  collapsing and reopening as it travels through armour. */
  plasmacutter(ctx, s, color, time) {
    const cut = 0.7 + 0.3 * Math.sin(time * 17);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.5, 0);
    ctx.lineTo(s * 0.4, -s * 0.6);
    ctx.lineTo(-s * 1.7, -s * 0.3 * cut);
    ctx.lineTo(-s * 1.7, s * 0.3 * cut);
    ctx.lineTo(s * 0.4, s * 0.6);
    ctx.closePath();
    ctx.fill();
    // Hot cutting edge along the top of the wedge.
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1.1, s * 0.2);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 2.4, 0);
    ctx.lineTo(s * 0.45, -s * 0.52);
    ctx.lineTo(-s * 1.6, -s * 0.26 * cut);
    ctx.stroke();
    // The hot line where it is currently cutting.
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(-s * 1.65, -s * 0.3 * cut);
    ctx.lineTo(-s * 1.65, s * 0.3 * cut);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Pistol — the plainest round in the rack on purpose: a stubby lead slug
   *  with a rounded nose, a case rim behind and nothing else. */
  pistol(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.0, 0);
    ctx.quadraticCurveTo(s * 1.0, -s * 0.9, -s * 0.7, -s * 0.9);
    ctx.lineTo(-s * 0.7, s * 0.9);
    ctx.quadraticCurveTo(s * 1.0, s * 0.9, s * 2.0, 0);
    ctx.closePath();
    ctx.fill();
    // Case rim: the one detail that says "this was loaded".
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.rect(-s * 0.7, -s * 0.9, s * 0.3, s * 1.8);
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(s * 1.35, 0, Math.max(0.8, s * 0.26), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Rail gun — the round is a needle riding its own shock: a long taper with
   *  two speed bars and the ionised trail collapsing astern. */
  railgun(ctx, s, color, time) {
    const streak = 0.8 + 0.2 * Math.sin(time * 24);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 3.0, 0);
    ctx.lineTo(s * 0.9, -s * 0.28);
    ctx.lineTo(-s * 2.0, -s * 0.28 * streak);
    ctx.lineTo(-s * 2.0, s * 0.28 * streak);
    ctx.lineTo(s * 0.9, s * 0.28);
    ctx.closePath();
    ctx.fill();
    // Shock chevrons astern.
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 2.2, -s * 0.7);
    ctx.lineTo(-s * 1.5, 0);
    ctx.lineTo(-s * 2.2, s * 0.7);
    ctx.moveTo(-s * 2.9, -s * 0.5);
    ctx.lineTo(-s * 2.4, 0);
    ctx.lineTo(-s * 2.9, s * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Rifle — an ogive that shows its business: a long pointed bullet with two
   *  cannelure grooves and a hot tip, rolling slowly along its axis. */
  rifle(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 6);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.3, 0);
    ctx.quadraticCurveTo(s * 1.1, -s * 0.75, -s * 1.2, -s * 0.75);
    ctx.lineTo(-s * 1.2, s * 0.75);
    ctx.quadraticCurveTo(s * 1.1, s * 0.75, s * 2.3, 0);
    ctx.closePath();
    ctx.fill();
    // Cannelures: the grooves a real service round carries.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(s * 0.9, -s * 0.74);
    ctx.lineTo(s * 0.9, s * 0.74);
    ctx.moveTo(s * 0.1, -s * 0.78);
    ctx.lineTo(s * 0.1, s * 0.78);
    ctx.moveTo(-s * 0.7, -s * 0.77);
    ctx.lineTo(-s * 0.7, s * 0.77);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.75, 0, Math.max(0.7, s * 0.22), 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /** Sea mine — a hull with three contact horns forward and a mooring cable
   *  dragging astern, wallowing as it is towed through the water. */
  seamine(ctx, s, color, time) {
    const wallow = Math.sin(time * 4) * 0.12;
    ctx.save();
    ctx.rotate(wallow);
    ctx.fillStyle = color;
    ctx.beginPath();
    // Hull.
    ctx.moveTo(s * 1.5, 0);
    ctx.quadraticCurveTo(s * 0.7, -s * 1.15, -s * 0.5, -s * 0.85);
    ctx.quadraticCurveTo(-s * 1.5, 0, -s * 0.5, s * 0.85);
    ctx.quadraticCurveTo(s * 0.7, s * 1.15, s * 1.5, 0);
    ctx.closePath();
    // Three horns on the nose.
    ctx.moveTo(s * 1.2, -s * 0.5);
    ctx.lineTo(s * 2.1, -s * 0.75);
    ctx.lineTo(s * 1.1, -s * 0.1);
    ctx.closePath();
    ctx.moveTo(s * 1.45, 0);
    ctx.lineTo(s * 2.4, 0);
    ctx.lineTo(s * 1.1, s * 0.15);
    ctx.closePath();
    ctx.moveTo(s * 1.2, s * 0.5);
    ctx.lineTo(s * 2.1, s * 0.75);
    ctx.lineTo(s * 1.1, s * 0.1);
    ctx.closePath();
    ctx.fill();
    // Mooring cable.
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 1.1, s * 0.4);
    ctx.quadraticCurveTo(-s * 2.0, -s * 0.2, -s * 2.8, s * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 2.2, 0, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Shard storm — four splinters still rotating about their common centre,
   *  a thrown handful rather than one blade. */
  shardstorm(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 7);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * (TAU / 4);
      const cx = Math.cos(a), cy = Math.sin(a);
      // Each splinter is a slim asymmetric wedge, wider at the trailing end.
      ctx.moveTo(cx * s * 2.1, cy * s * 2.1);
      ctx.lineTo(cx * s * 0.7 - cy * s * 0.45, cy * s * 0.7 + cx * s * 0.45);
      ctx.lineTo(cx * s * 0.35, cy * s * 0.35);
      ctx.lineTo(cx * s * 0.7 + cy * s * 0.45, cy * s * 0.7 - cx * s * 0.45);
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Shell ring — a shot that comes as a necklace: five shells strung round
   *  the bore, rotating as the whole ring spins onto its axis. */
  shellring(ctx, s, color, time) {
    const spin = time * 3.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = spin + i * (TAU / 5);
      const cx = Math.cos(a) * s * 1.3;
      const cy = Math.sin(a) * s * 1.3;
      // Each shell is a small nose-out capsule.
      ctx.moveTo(cx * 1.45, cy * 1.45);
      ctx.lineTo(cx * 1.15 - cy * 0.3, cy * 1.15 + cx * 0.3);
      ctx.lineTo(cx * 0.85 - cy * 0.3, cy * 0.85 + cx * 0.3);
      ctx.lineTo(cx * 0.85 + cy * 0.3, cy * 0.85 - cx * 0.3);
      ctx.lineTo(cx * 1.15 + cy * 0.3, cy * 1.15 - cx * 0.3);
      ctx.closePath();
    }
    ctx.fill();
    // Hot cord strung through them.
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.3, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Shotgun — the spread made visible: a broad cone outline with the three
   *  pellets still grouped inside it and a hot muzzle flare at the apex. */
  shotgun(ctx, s, color, time) {
    const spread = 0.9 + 0.1 * Math.sin(time * 14);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.3, s * 0.3);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 1.6, -s * 1.3 * spread);
    ctx.lineTo(s * 2.2, 0);
    ctx.lineTo(s * 1.6, s * 1.3 * spread);
    ctx.stroke();
    // The three pellets riding inside the cone.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(s * 1.15, 0, s * 0.42, 0, TAU);
    ctx.arc(s * 0.35, s * 0.62 * spread, s * 0.34, 0, TAU);
    ctx.arc(s * 0.35, -s * 0.62 * spread, s * 0.34, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 2.15, 0, Math.max(0.8, s * 0.24), 0, TAU);
    ctx.arc(s * 1.15, 0, Math.max(0.6, s * 0.16), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Singularity — the round is a hole: a dark core with a hot photon ring
   *  and the light falling in along four spokes. Drawn flat, no gradient. */
  singularity(ctx, s, color, time) {
    const spin = time * 5;
    ctx.save();
    ctx.rotate(spin);
    // The void: the one genuinely dark shape in the whole file.
    ctx.fillStyle = '#100a1c';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.95, 0, TAU);
    ctx.fill();
    // Photon ring.
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.4, s * 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.2, 0, TAU);
    ctx.stroke();
    // Infalling spokes, off-axis so they read as motion.
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * (TAU / 4) + 0.35;
      const cx = Math.cos(a), cy = Math.sin(a);
      ctx.moveTo(cx * s * 1.35, cy * s * 1.35);
      ctx.lineTo(cx * s * 1.9, cy * s * 1.9);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    // The hot point at the centre.
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, s * 0.16), 0, TAU);
    ctx.fill();
  },

  /** Siphon — a funnel drinking the water ahead of it: a flared mouth with
   *  the throat drawn as two curved intake lines running aft. */
  siphon(ctx, s, color, time) {
    const draw = 0.5 + 0.5 * Math.sin(time * 5);
    ctx.fillStyle = color;
    ctx.beginPath();
    // The funnel: a wide mouth narrowing to a tail.
    ctx.moveTo(s * 2.5, -s * 1.1);
    ctx.quadraticCurveTo(s * 0.7, -s * 0.45, -s * 1.7, -s * 0.2);
    ctx.lineTo(-s * 1.7, s * 0.2);
    ctx.quadraticCurveTo(s * 0.7, s * 0.45, s * 2.5, s * 1.1);
    ctx.closePath();
    ctx.fill();
    // Intake lines.
    ctx.globalAlpha = 0.6 + 0.35 * draw;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 2.4, -s * 0.95);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.3, -s * 1.5, -s * 0.12);
    ctx.moveTo(s * 2.4, s * 0.95);
    ctx.quadraticCurveTo(s * 0.9, s * 0.3, -s * 1.5, s * 0.12);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Sling — a stone still in the pouch: the two straps of leather round a
   *  four-sided pebble, the pouch cracking open as it is released. */
  sling(ctx, s, color, time) {
    const release = 0.35 + 0.3 * Math.abs(Math.sin(time * 5));
    ctx.save();
    ctx.rotate(time * 2.4);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.24);
    ctx.beginPath();
    // Straps: a V that opens as the stone leaves.
    ctx.moveTo(s * 0.9, -s * 1.15);
    ctx.lineTo(s * 0.4, 0);
    ctx.lineTo(s * 0.9, s * 1.15);
    ctx.moveTo(-s * 0.9, -s * 1.05);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.3 * release, s * 0.9, -s * 1.15);
    ctx.moveTo(-s * 0.9, s * 1.05);
    ctx.quadraticCurveTo(s * 0.2, s * 0.3 * release, s * 0.9, s * 1.15);
    ctx.stroke();
    ctx.restore();
    // The stone: an irregular quad, deliberately not a circle.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.0, 0);
    ctx.lineTo(s * 0.85, s * 0.8);
    ctx.lineTo(s * 0.35, 0);
    ctx.lineTo(s * 0.85, -s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(s * 2.0, 0);
    ctx.lineTo(s * 1.3, -s * 0.28);
    ctx.lineTo(s * 1.3, s * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Sonar chime — sound made solid: three chevrons racing outward from a
   *  fixed pinger, fading as they spread. Nothing here is centred on the
   *  bolt's middle, which is exactly what reads as "emitted". */
  sonarchime(ctx, s, color, time) {
    const phase = (time * 1.6) % 1;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.24);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const d = (phase + i * 0.33) % 1;
      const ax = s * (0.2 + d * 2.6);
      const half = s * (0.35 + d * 1.15);
      ctx.moveTo(ax, -half);
      ctx.lineTo(ax + s * 0.5, 0);
      ctx.lineTo(ax, half);
    }
    ctx.stroke();
    // The pinger itself, still hot where it was struck.
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(-s * 1.1, 0, Math.max(0.8, s * 0.26), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Spore launcher — a seed pod splitting as it flies: an oval capsule with
   *  a seam, three spores puffing out behind it on the drift. */
  sporelauncher(ctx, s, color, time) {
    const puff = 0.4 + 0.6 * Math.abs(Math.sin(time * 6));
    ctx.fillStyle = color;
    ctx.beginPath();
    // Pod.
    ctx.moveTo(s * 1.9, 0);
    ctx.quadraticCurveTo(s * 1.0, -s * 0.95, -s * 0.2, -s * 0.8);
    ctx.quadraticCurveTo(-s * 1.2, 0, -s * 0.2, s * 0.8);
    ctx.quadraticCurveTo(s * 1.0, s * 0.95, s * 1.9, 0);
    ctx.closePath();
    // Seam crack up the spine.
    ctx.moveTo(s * 1.5, -s * 0.15);
    ctx.lineTo(s * 0.1, -s * 0.5);
    ctx.lineTo(s * 0.1, s * 0.5);
    ctx.lineTo(s * 1.5, s * 0.15);
    ctx.closePath();
    ctx.fill();
    // Spores drifting aft, spread by the pulse.
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(-s * 1.4, s * 0.55 * puff, s * 0.3, 0, TAU);
    ctx.arc(-s * 1.9, -s * 0.5 * puff, s * 0.24, 0, TAU);
    ctx.arc(-s * 2.4, s * 0.15 * puff, s * 0.18, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.5, 0, Math.max(0.6, s * 0.2), 0, TAU);
    ctx.fill();
  },

  /** Storm caller — the strike itself, held mid-fork: a bolt zigzag with a
   *  hot node at the branch point and a second lead running beside it. */
  stormcaller(ctx, s, color, time) {
    const flick = 0.7 + 0.3 * Math.abs(Math.sin(time * 20));
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.26);
    ctx.beginPath();
    // Main channel: four hard kinks.
    ctx.moveTo(s * 2.5 * flick, -s * 0.2);
    ctx.lineTo(s * 0.9, s * 0.55);
    ctx.lineTo(s * 0.2, -s * 0.7);
    ctx.lineTo(-s * 1.0, s * 0.4);
    ctx.lineTo(-s * 1.8, -s * 0.1);
    ctx.stroke();
    // The return channel, offset so the bolt reads as two forked leads.
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(s * 2.2 * flick, -s * 0.75);
    ctx.lineTo(s * 0.9, s * 0.15);
    ctx.lineTo(s * 0.2, -s * 1.1);
    ctx.lineTo(-s * 1.0, s * 0.05);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.9, s * 0.55, Math.max(0.7, s * 0.24), 0, TAU);
    ctx.arc(s * 2.3 * flick, -s * 0.2, Math.max(0.6, s * 0.18), 0, TAU);
    ctx.fill();
  },

  /** Sun lance — a spear of light: a hard spike forward with eight rays off
   *  the shoulder and a corona behind them, whole thing turning. */
  sunlance(ctx, s, color, time) {
    const heat = 0.85 + 0.15 * Math.sin(time * 9);
    ctx.save();
    ctx.rotate(time * 2.6);
    ctx.fillStyle = color;
    ctx.beginPath();
    // The lance itself.
    ctx.moveTo(s * 2.6, 0);
    ctx.lineTo(s * 0.4, -s * 0.42);
    ctx.lineTo(s * 0.4, s * 0.42);
    ctx.closePath();
    // Eight rays, each a thin wedge out of the shoulder.
    for (let i = 0; i < 8; i++) {
      const a = i * (TAU / 8);
      const cx = Math.cos(a), cy = Math.sin(a);
      const px = -cy, py = cx;
      ctx.moveTo(cx * s * 0.55 - px * s * 0.14, cy * s * 0.55 - py * s * 0.14);
      ctx.lineTo(cx * s * 1.5, cy * s * 1.5);
      ctx.lineTo(cx * s * 0.55 + px * s * 0.14, cy * s * 0.55 + py * s * 0.14);
      ctx.closePath();
    }
    ctx.fill();
    // Corona, layered low-alpha rather than a gradient.
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5 * heat, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Tesla coral — a living coil: a stack of arcs down the axis with the
   *  discharge jumping the gap, buzzing at a rate you can see. */
  teslacoral(ctx, s, color, time) {
    const buzz = 0.5 + 0.5 * Math.abs(Math.sin(time * 22));
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.1, s * 0.2);
    ctx.beginPath();
    // Four coil turns as paired arcs, so it reads as wound wire.
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.9 + i * s * 0.55;
      ctx.arc(x, 0, s * 0.42, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.moveTo(x + s * 0.42, -s * 0.42);
      ctx.lineTo(x + s * 0.55, -s * 0.42);
    }
    ctx.stroke();
    // The discharge jumping between the coil and the bolt.
    ctx.globalAlpha = 0.55 + 0.45 * buzz;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1.1, s * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.4, -s * 1.15);
    ctx.lineTo(s * 0.95, -s * 0.55);
    ctx.lineTo(s * 1.5, -s * 1.2);
    ctx.lineTo(s * 2.1, -s * 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Thermal blaster — a jet of flame with three tongues: an outer body that
   *  breathes, a hot inner tongue, and cinders still falling off astern. */
  thermalblaster(ctx, s, color, time) {
    const roar = 0.85 + 0.15 * Math.sin(time * 12);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.4, 0);
    ctx.quadraticCurveTo(s * 0.9, -s * 1.05 * roar, -s * 1.0, -s * 0.5 * roar);
    ctx.quadraticCurveTo(-s * 0.2, 0, -s * 1.0, s * 0.5 * roar);
    ctx.quadraticCurveTo(s * 0.9, s * 1.05 * roar, s * 2.4, 0);
    ctx.closePath();
    ctx.fill();
    // Inner tongue.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(s * 2.0, 0);
    ctx.quadraticCurveTo(s * 0.7, -s * 0.45 * roar, -s * 0.2, 0);
    ctx.quadraticCurveTo(s * 0.7, s * 0.45 * roar, s * 2.0, 0);
    ctx.closePath();
    ctx.fill();
    // Cinders.
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(-s * 1.6, -s * 0.5 * roar, Math.max(0.5, s * 0.14), 0, TAU);
    ctx.arc(-s * 2.2, s * 0.2, Math.max(0.45, s * 0.11), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Torpedo — long and slim with a cruciform tail and a wake of bubble
   *  dashes trailing it, running nose-down as it goes. */
  torpedo(ctx, s, color, time) {
    const run = Math.sin(time * 3);
    ctx.save();
    ctx.rotate(run * 0.1);
    ctx.fillStyle = color;
    ctx.beginPath();
    // Hull.
    ctx.moveTo(s * 2.9, 0);
    ctx.quadraticCurveTo(s * 1.6, -s * 0.55, -s * 0.3, -s * 0.55);
    ctx.lineTo(-s * 1.1, -s * 0.7);
    ctx.lineTo(-s * 1.1, s * 0.7);
    ctx.lineTo(-s * 0.3, s * 0.55);
    ctx.quadraticCurveTo(s * 1.6, s * 0.55, s * 2.9, 0);
    ctx.closePath();
    // Cruciform fins at the tail.
    ctx.moveTo(-s * 0.2, -s * 0.5);
    ctx.lineTo(-s * 0.95, -s * 1.5);
    ctx.lineTo(-s * 1.0, -s * 0.35);
    ctx.closePath();
    ctx.moveTo(-s * 0.2, s * 0.5);
    ctx.lineTo(-s * 0.95, s * 1.5);
    ctx.lineTo(-s * 1.0, s * 0.35);
    ctx.closePath();
    ctx.moveTo(-s * 0.5, -s * 0.15);
    ctx.lineTo(-s * 1.0, 0);
    ctx.lineTo(-s * 0.5, s * 0.15);
    ctx.closePath();
    ctx.fill();
    // Wake dashes and the hot seeker.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, -s * 0.35);
    ctx.lineTo(-s * 1.85, -s * 0.35);
    ctx.moveTo(-s * 1.9, s * 0.3);
    ctx.lineTo(-s * 2.25, s * 0.3);
    ctx.moveTo(-s * 2.35, -s * 0.25);
    ctx.lineTo(-s * 2.7, -s * 0.25);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 2.2, 0, Math.max(0.7, s * 0.22), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Turret — a whole gun bolted to the round: hex base, barrel forward,
   *  tread blocks astern, all of it tracking slowly to its aim. */
  turret(ctx, s, color, time) {
    const aim = Math.sin(time * 3) * 0.2;
    ctx.save();
    ctx.rotate(aim);
    ctx.fillStyle = color;
    ctx.beginPath();
    // Hex base.
    for (let i = 0; i < 6; i++) {
      const a = i * (TAU / 6) + 0.5;
      const x = Math.cos(a) * s * 1.15;
      const y = Math.sin(a) * s * 1.15;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    // Barrel.
    ctx.rect(s * 0.3, -s * 0.28, s * 2.0, s * 0.56);
    // Treads.
    ctx.rect(-s * 1.6, -s * 0.95, s * 0.7, s * 0.38);
    ctx.rect(-s * 1.6, s * 0.57, s * 0.7, s * 0.38);
    ctx.fill();
    // Mantlet ring and the muzzle glow.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.15, 0, s * 0.42, 0, TAU);
    ctx.rect(s * 2.0, -s * 0.18, s * 0.4, s * 0.36);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Void ripper — a sawblade that fell in from nowhere: twelve teeth on a
   *  spinning disc with the hot cut-slot still glowing across its face. */
  voidripper(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 14);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = i * (TAU / 12);
      const cx = Math.cos(a), cy = Math.sin(a);
      const px = -cy, py = cx;
      // Root then tooth then root, so the rim is a proper saw.
      ctx.lineTo(cx * s * 0.85 - px * s * 0.22, cy * s * 0.85 - py * s * 0.22);
      ctx.lineTo(cx * s * 1.65, cy * s * 1.65);
      ctx.lineTo(cx * s * 0.85 + px * s * 0.22, cy * s * 0.85 + py * s * 0.22);
    }
    ctx.closePath();
    ctx.fill();
    // Hub.
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, TAU);
    ctx.fill();
    // The slot the blade is currently cutting.
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 1.9, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Whirlpool — three swept arms dragging round a fixed centre, with the
   *  outer rim drawn faint so the arms look like they are inside it. */
  whirlpool(ctx, s, color, time) {
    const spin = time * 6;
    ctx.save();
    ctx.rotate(spin);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.3, s * 0.3);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = i * (TAU / 3);
      const cx = Math.cos(a), cy = Math.sin(a);
      const nx = Math.cos(a + 0.85), ny = Math.sin(a + 0.85);
      const ex = Math.cos(a + 1.8), ey = Math.sin(a + 1.8);
      // Each arm is a swept band from the rim in to the eye.
      ctx.moveTo(cx * s * 1.7, cy * s * 1.7);
      ctx.quadraticCurveTo(nx * s * 1.35, ny * s * 1.35, ex * s * 0.42, ey * s * 0.42);
    }
    ctx.stroke();
    // Faint rim, then the hot eye.
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.8, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.38, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /** Zapper — a hard T of charge with two forks reaching forward, the gap
   *  between them blown out hot where the arc jumps. */
  zapper(ctx, s, color, time) {
    const gap = 0.55 + 0.45 * Math.abs(Math.sin(time * 20));
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.28);
    ctx.beginPath();
    // Cross bar astern.
    ctx.moveTo(-s * 2.2, 0);
    ctx.lineTo(s * 0.2, 0);
    ctx.moveTo(-s * 2.2, -s * 0.75);
    ctx.lineTo(-s * 2.2, s * 0.75);
    // Two forks forward, splayed.
    ctx.moveTo(s * 0.2, 0);
    ctx.quadraticCurveTo(s * 1.5, -s * 0.35, s * 2.4, -s * 1.0);
    ctx.moveTo(s * 0.2, 0);
    ctx.quadraticCurveTo(s * 1.5, s * 0.35, s * 2.4, s * 1.0);
    ctx.stroke();
    // The blown-out gap between the fork tips.
    ctx.globalAlpha = 0.5 + 0.5 * gap;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1.1, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(s * 2.3, -s * 0.95);
    ctx.lineTo(s * 2.3, s * 0.95);
    ctx.moveTo(-s * 2.1, -s * 0.6);
    ctx.lineTo(-s * 2.1, s * 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /* ── The Sea Arsenal ─────────────────────────────────────────────────── */

  /** Eel volt gun — a crooked bolt of current with the eel's body still in
   *  it: a zigzag that re-kinks every few frames, a bright head at the front. */
  eelvoltgun(ctx, s, color, time) {
    const k = ((time * 18) | 0) & 1 ? 1 : -1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, s * 0.32);
    ctx.beginPath();
    ctx.moveTo(-s * 2.4, 0);
    ctx.lineTo(-s * 1.5, s * 0.7 * k);
    ctx.lineTo(-s * 0.5, -s * 0.6 * k);
    ctx.lineTo(s * 0.5, s * 0.55 * k);
    ctx.lineTo(s * 1.5, 0);
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.ellipse(s * 1.6, 0, s * 0.62, s * 0.42, 0, 0, TAU);
    ctx.fill();
  },

  /** Narwhal rail — a spiralled tusk in flight: a long ivory needle with the
   *  spiral grooves running down it, a cold glow trailing off the base. */
  narwhalrail(ctx, s, color, time) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-s * 1.4, 0, s * 1.6, s * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(s * 3.0, 0);
    ctx.lineTo(-s * 0.9, s * 0.4);
    ctx.lineTo(-s * 0.9, -s * 0.4);
    ctx.closePath();
    ctx.fill();
    // The spiral grooves, sliding back along the shaft as it spins.
    const off = (time * 6) % 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, s * 0.12);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.6 + (i + off) * s * 0.8;
      const h = s * 0.4 * (1 - (x + s * 0.9) / (s * 3.9));
      ctx.moveTo(x - s * 0.15, -h);
      ctx.lineTo(x + s * 0.15, h);
    }
    ctx.stroke();
  },

  /** Pearl rifle — a pearl: a lustrous ball with a crescent of sheen that
   *  rolls around it, and a soft nacre halo. */
  pearlrifle(ctx, s, color, time) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.35, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.95, 0, TAU);
    ctx.fill();
    const a = time * 5;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35 - s * 0.2, s * 0.32, 0, TAU);
    ctx.fill();
  },

  /** Puffer launcher — the pufferfish warhead, puffed: a round body ringed
   *  with spines that bristle in and out, a stubby tail fin behind. */
  pufferlauncher(ctx, s, color, time) {
    const puff = 1 + Math.sin(time * 10) * 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 1.1, 0);
    ctx.lineTo(-s * 2.0, -s * 0.7);
    ctx.lineTo(-s * 2.0, s * 0.7);
    ctx.closePath();
    ctx.arc(0, 0, s * 1.1 * puff, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.18);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = i * (TAU / 9);
      const c = Math.cos(a), d = Math.sin(a);
      ctx.moveTo(c * s * 1.0 * puff, d * s * 1.0 * puff);
      ctx.lineTo(c * s * 1.6 * puff, d * s * 1.6 * puff);
    }
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.45, -s * 0.3, s * 0.24, 0, TAU);
    ctx.fill();
  },

  /** Snapper pistol — a slug with a hooked beak on its nose, the turtle's
   *  bite riding the bullet. */
  snapperpistol(ctx, s, color, time) {
    const snap = Math.abs(Math.sin(time * 12)) * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, 0, s * 1.2, s * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(s * 0.7, -s * 0.15);
    ctx.quadraticCurveTo(s * 1.5, -s * (0.75 + snap), s * 1.75, s * 0.1);
    ctx.lineTo(s * 1.2, -s * 0.05);
    ctx.closePath();
    ctx.moveTo(s * 0.7, s * 0.15);
    ctx.quadraticCurveTo(s * 1.4, s * (0.6 + snap), s * 1.55, s * 0.2);
    ctx.closePath();
    ctx.fill();
  },

  /** Squid sprayer — a squirt of ink: a dark teardrop trailing a wavy
   *  tentacle of droplets. */
  squidsprayer(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 1.4, 0);
    ctx.quadraticCurveTo(s * 0.2, s * 0.85, -s * 0.6, 0);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.85, s * 1.4, 0);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 1; i <= 3; i++) {
      const x = -s * (0.6 + i * 0.7);
      const y = Math.sin(time * 16 + i * 1.7) * s * 0.4;
      ctx.moveTo(x + s * 0.3, y);
      ctx.arc(x, y, s * (0.34 - i * 0.06), 0, TAU);
    }
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.65, -s * 0.18, s * 0.16, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Starfish chakram — the star itself, thrown: five soft arms spinning
   *  around a bright centre. */
  starchakram(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 14);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = i * (TAU / 5);
      const b = a + TAU / 10;
      const op = i === 0 ? 'moveTo' : 'lineTo';
      ctx[op](Math.cos(a) * s * 1.7, Math.sin(a) * s * 1.7);
      ctx.lineTo(Math.cos(b) * s * 0.6, Math.sin(b) * s * 0.6);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.32, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /** Stingray tesla — a flat diamond of charge with its tail whipping
   *  behind, crackling at the wingtips. */
  stingraytesla(ctx, s, color, time) {
    const flap = Math.sin(time * 9) * 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 1.3, 0);
    ctx.lineTo(-s * 0.1, -s * (1.2 + flap));
    ctx.lineTo(-s * 0.7, 0);
    ctx.lineTo(-s * 0.1, s * (1.2 + flap));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.9, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.quadraticCurveTo(-s * 1.6, Math.sin(time * 15) * s * 0.6, -s * 2.6, 0);
    ctx.stroke();
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.8, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * (1.2 + flap));
    ctx.lineTo(s * 0.2, -s * (1.55 + flap));
    ctx.moveTo(-s * 0.1, s * (1.2 + flap));
    ctx.lineTo(s * 0.2, s * (1.55 + flap));
    ctx.stroke();
  },

  /** Urchin shotgun — one urchin pellet of the spread: a small dark ball
   *  bristling with fine spines, tumbling. */
  urchinshotgun(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 8);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.7, s * 0.1);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = i * (TAU / 12);
      const r = i & 1 ? 1.25 : 1.55;
      ctx.moveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6);
      ctx.lineTo(Math.cos(a) * s * r, Math.sin(a) * s * r);
    }
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 0.2, s * 0.18, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /** Barnacle minigun — a crusted slug: a short round with three barnacle
   *  cones riding its back, fired too fast to shed them. */
  reefminigun(ctx, s, color, time) {
    const j = Math.sin(time * 30) * s * 0.05;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, j, s * 1.0, s * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = -s * 0.55 + i * s * 0.5;
      ctx.moveTo(x - s * 0.18, j - s * 0.3);
      ctx.lineTo(x, j - s * 0.62);
      ctx.lineTo(x + s * 0.18, j - s * 0.3);
      ctx.closePath();
    }
    ctx.fill();
  },

  /** Clam cannon — a clam thrown shut: two ribbed half-shells clapping as it
   *  flies, a pearl glint showing in the gap. */
  clamcannon(ctx, s, color, time) {
    const gap = (Math.sin(time * 8) * 0.5 + 0.5) * s * 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, -gap, s * 1.2, s * 0.65, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.ellipse(0, gap, s * 1.2, s * 0.65, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.7, s * 0.09);
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(i * s * 0.12, -gap);
      ctx.lineTo(i * s * 0.42, -gap - s * 0.55);
    }
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.35, 0, Math.max(0.6, s * 0.2), 0, TAU);
    ctx.fill();
  },

  /** Conch sonar — the shell's note: three nested arcs opening forward from
   *  a spiral mouth, each a beat behind the last. */
  conchsonar(ctx, s, color, time) {
    const t = (time * 3) % 1;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const r = s * (0.6 + (i + t) * 0.55);
      ctx.globalAlpha = 1 - (i + t) / 3.2;
      ctx.lineWidth = Math.max(1, s * 0.22);
      ctx.beginPath();
      ctx.arc(-s * 0.8, 0, r, -0.9, 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(-s * 0.8, 0, s * 0.3, 0, TAU);
    ctx.fill();
  },

  /** Coral boomerang — a pink branching V, tumbling end over end, with a
   *  stub of coral growing off each arm. */
  coralboomerang(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(-time * 13);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.4, s * 0.42);
    ctx.beginPath();
    ctx.moveTo(-s * 1.3, -s * 1.1);
    ctx.lineTo(0, 0);
    ctx.lineTo(s * 1.3, -s * 1.1);
    ctx.moveTo(-s * 0.7, -s * 0.6);
    ctx.lineTo(-s * 1.1, -s * 0.2);
    ctx.moveTo(s * 0.7, -s * 0.6);
    ctx.lineTo(s * 1.1, -s * 0.2);
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.24, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /** Harpoon rifle — a barbed harpoon trailing its line: a long shaft, a
   *  two-barb head, and a slack rope that ripples behind. */
  harpoonrifle(ctx, s, color, time) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(-s * 1.6, 0);
    ctx.lineTo(s * 1.6, 0);
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.moveTo(s * 2.4, 0);
    ctx.lineTo(s * 1.4, -s * 0.5);
    ctx.lineTo(s * 1.6, 0);
    ctx.lineTo(s * 1.4, s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = Math.max(0.7, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(-s * 1.6, 0);
    ctx.quadraticCurveTo(-s * 2.3, Math.sin(time * 12) * s * 0.7, -s * 3.0, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Jelly launcher — a little jellyfish: a pulsing bell up front with four
   *  tentacles streaming back. */
  jellylauncher(ctx, s, color, time) {
    const p = 1 + Math.sin(time * 11) * 0.15;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(s * 0.4, 0, s * 0.7, s * 0.85 * p, 0, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.7, s * 0.12);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = (i - 1.5) * s * 0.4 * p;
      ctx.moveTo(s * 0.4, y);
      ctx.quadraticCurveTo(-s * 0.6, y + Math.sin(time * 14 + i) * s * 0.35, -s * 1.7, y * 0.8);
    }
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.7, 0, s * 0.22, 0, TAU);
    ctx.fill();
  },

  /** Kraken shotgun — a sucker pellet: a ring of suckers round a dark core,
   *  a curled tentacle tip hooking off the back. */
  krakenshotgun(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.9, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, 0);
    ctx.quadraticCurveTo(-s * 1.6, -s * 0.2, -s * 1.5, s * (0.5 + Math.sin(time * 10) * 0.2));
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = time * 4 + i * (TAU / 5);
      const x = Math.cos(a) * s * 0.48, y = Math.sin(a) * s * 0.48;
      ctx.moveTo(x + s * 0.14, y);
      ctx.arc(x, y, s * 0.14, 0, TAU);
    }
    ctx.fill();
  },

  /** Lanternfish plasma — a string of photophores: a bright lead orb with
   *  a dotted line of smaller lights strung out behind it. */
  lanternplasma(ctx, s, color, time) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(s * 0.6, 0, s * 1.1, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = -s * (0.4 + i * 0.6);
      const r = s * (0.32 - i * 0.05) * (1 + Math.sin(time * 9 + i) * 0.2);
      ctx.moveTo(x + r, 0);
      ctx.arc(x, 0, r, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.6, 0, s * 0.55, 0, TAU);
    ctx.fill();
  },

  /** Reef torpedo — a stubby yellow torpedo: rounded nose, cross fins, a
   *  spinning prop wash behind. */
  reeftorpedo(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 1.2, -s * 0.45);
    ctx.lineTo(s * 0.8, -s * 0.45);
    ctx.arc(s * 0.8, 0, s * 0.45, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-s * 1.2, s * 0.45);
    ctx.closePath();
    ctx.moveTo(-s * 0.9, -s * 0.4);
    ctx.lineTo(-s * 1.5, -s * 0.95);
    ctx.lineTo(-s * 1.4, -s * 0.4);
    ctx.moveTo(-s * 0.9, s * 0.4);
    ctx.lineTo(-s * 1.5, s * 0.95);
    ctx.lineTo(-s * 1.4, s * 0.4);
    ctx.fill();
    const w = Math.sin(time * 40) * s * 0.35;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.8, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(-s * 1.55, -w);
    ctx.lineTo(-s * 1.55, w);
    ctx.stroke();
  },

  /** Shrimp pistol — the mantis shrimp's punch: a club-shaped slug with a
   *  shockwave ring cavitating off its face. */
  shrimppistol(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 1.3, -s * 0.25);
    ctx.lineTo(s * 0.3, -s * 0.4);
    ctx.arc(s * 0.6, 0, s * 0.55, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-s * 1.3, s * 0.25);
    ctx.closePath();
    ctx.fill();
    const k = (time * 7) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.8, s * 0.16);
    ctx.beginPath();
    ctx.ellipse(s * (1.2 + k * 0.6), 0, s * 0.3, s * (0.6 + k * 0.6), 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Storm reel — the cast: a glowing hook out front on a jagged line of
   *  lightning that re-forks every few frames. */
  stormreel(ctx, s, color, time) {
    const k = ((time * 20) | 0) % 3 - 1;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(-s * 2.6, 0);
    ctx.lineTo(-s * 1.8, s * 0.5 * k);
    ctx.lineTo(-s * 0.9, -s * 0.45);
    ctx.lineTo(0, s * 0.35);
    ctx.lineTo(s * 0.6, 0);
    ctx.stroke();
    ctx.strokeStyle = HOT;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.1, s * 0.26);
    ctx.beginPath();
    ctx.moveTo(s * 0.6, 0);
    ctx.lineTo(s * 1.5, 0);
    ctx.arc(s * 1.5, s * 0.45, s * 0.45, -Math.PI / 2, Math.PI * 0.75);
    ctx.stroke();
  },

  /** Tide sniper — a wave-crest round: a long blue streak with a curling
   *  crest breaking over its nose. */
  tidesniper(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 1.4, 0);
    ctx.lineTo(-s * 2.6, -s * 0.2);
    ctx.lineTo(-s * 2.6, s * 0.2);
    ctx.closePath();
    ctx.fill();
    const c = Math.sin(time * 10) * s * 0.1;
    ctx.strokeStyle = HOT;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.15);
    ctx.quadraticCurveTo(s * 0.6, -s * 1.0 - c, s * 1.2, -s * 0.5);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.2, s * 0.6, -s * 0.45 - c);
    ctx.stroke();
  },

  /* ── The Sea Arsenal, wave three ─────────────────────────────────────── */

  /** Abyss beam — a lance of trench-dark light with the angler's lure
   *  bobbing on a thread just ahead of it. */
  abyssbeam(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 1.0, 0);
    ctx.lineTo(-s * 2.8, -s * 0.28);
    ctx.lineTo(-s * 2.8, s * 0.28);
    ctx.closePath();
    ctx.fill();
    const bob = Math.sin(time * 7) * s * 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(s * 0.4, -s * 0.15);
    ctx.quadraticCurveTo(s * 1.3, -s * 1.1, s * 1.9, -s * 0.4 + bob);
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.9, -s * 0.3 + bob, s * 0.3, 0, TAU);
    ctx.fill();
  },

  /** Coral turret — a stubby coral tube spinning end over end, polyps
   *  dotting its rim. */
  coralturret(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 16);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(-s * 0.8, -s * 0.38, s * 1.6, s * 0.76);
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(s * 0.8 + s * 0.13, i * s * 0.24);
      ctx.arc(s * 0.8, i * s * 0.24, s * 0.13, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  },

  /** Dolphin sonar — clicks: a run of short bright dashes stepping forward
   *  inside a pair of widening sound fronts. */
  dolphinsonar(ctx, s, color, time) {
    const t = (time * 5) % 1;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.9, s * 0.18);
    ctx.beginPath();
    ctx.arc(-s * 1.4, 0, s * (1.0 + t * 0.6), -0.7, 0.7);
    ctx.moveTo(-s * 1.4 + s * (1.8 + t * 0.6) * Math.cos(-0.6), s * (1.8 + t * 0.6) * Math.sin(-0.6));
    ctx.arc(-s * 1.4, 0, s * (1.8 + t * 0.6), -0.6, 0.6);
    ctx.stroke();
    ctx.strokeStyle = HOT;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = -s * 0.4 + i * s * 0.6;
      ctx.moveTo(x, -s * 0.25);
      ctx.lineTo(x, s * 0.25);
    }
    ctx.stroke();
  },

  /** Geyser launcher — a scalding bolus of vent water: a hot core inside a
   *  ragged steam plume that boils off behind it. */
  geyserlauncher(ctx, s, color, time) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = -s * (0.9 + i * 0.55);
      const y = Math.sin(time * 9 + i * 2.1) * s * 0.35;
      const r = s * (0.55 - i * 0.08);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, TAU);
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.2, -s * 0.15, s * 0.38, 0, TAU);
    ctx.fill();
  },

  /** Goldfish pistol — a gilt slug with a fancy-goldfish tail fanning out
   *  behind it, the fins rippling. */
  goldfishpistol(ctx, s, color, time) {
    const f = Math.sin(time * 12) * 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(s * 0.3, 0, s * 0.85, s * 0.5, 0, 0, TAU);
    ctx.moveTo(-s * 0.4, 0);
    ctx.quadraticCurveTo(-s * 1.4, -s * (1.0 + f), -s * 2.0, -s * 0.7);
    ctx.quadraticCurveTo(-s * 1.4, 0, -s * 2.0, s * 0.7);
    ctx.quadraticCurveTo(-s * 1.4, s * (1.0 - f), -s * 0.4, 0);
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.65, -s * 0.12, s * 0.16, 0, TAU);
    ctx.fill();
  },

  /** Hermit cannon — a spiral shell lobbed like a shot, its whorl turning
   *  as it tumbles. */
  hermitcannon(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(time * 6);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.05, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.8, s * 0.16);
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = i * 0.55;
      const r = s * 0.12 + i * s * 0.052;
      const op = i === 0 ? 'moveTo' : 'lineTo';
      ctx[op](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.restore();
  },

  /** Icefish cryo — a translucent fish-shaped icicle: a long tapering spike
   *  with a ridge of frost spines along its back. */
  icefishcryo(ctx, s, color, time) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 1.9, 0);
    ctx.lineTo(-s * 0.4, -s * 0.5);
    ctx.lineTo(-s * 1.6, 0);
    ctx.lineTo(-s * 0.4, s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    const k = Math.sin(time * 10) * s * 0.06;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.7, s * 0.1);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.9 + i * s * 0.6;
      ctx.moveTo(x, -s * 0.3);
      ctx.lineTo(x - s * 0.2, -s * 0.75 - k);
    }
    ctx.stroke();
  },

  /** Krill sprayer — a swarm: half a dozen tiny curled krill streaming in a
   *  loose wavy cloud. */
  krillsprayer(ctx, s, color, time) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, s * 0.18);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = s * 1.0 - i * s * 0.55;
      const y = Math.sin(time * 13 + i * 1.3) * s * 0.55;
      ctx.moveTo(x + s * 0.25, y);
      ctx.arc(x, y, s * 0.25, 0, Math.PI * 1.3);
    }
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 1.15, Math.sin(time * 13) * s * 0.55, s * 0.1, 0, TAU);
    ctx.fill();
  },

  /** Lobster bomb — a round bomb gripped in two little claws, the fuse
   *  fizzing at its back. */
  lobsterbomb(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.95, 0, TAU);
    ctx.moveTo(s * 0.6, -s * 0.6);
    ctx.lineTo(s * 1.5, -s * 0.9);
    ctx.lineTo(s * 1.1, -s * 0.35);
    ctx.closePath();
    ctx.moveTo(s * 0.6, s * 0.6);
    ctx.lineTo(s * 1.5, s * 0.9);
    ctx.lineTo(s * 1.1, s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(time * 20));
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(-s * 1.25, 0, s * 0.3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /** Lobster claw — the whole claw thrown and spinning, both fingers of the
   *  pincer snapping open and shut. */
  lobsterclaw(ctx, s, color, time) {
    const open = 0.25 + Math.abs(Math.sin(time * 9)) * 0.35;
    ctx.save();
    ctx.rotate(time * 12);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-s * 0.5, 0, s * 0.85, s * 0.6, 0, 0, TAU);
    ctx.moveTo(0, -s * 0.2);
    ctx.quadraticCurveTo(s * 1.0, -s * (0.4 + open * 2), s * 1.6, -s * open);
    ctx.lineTo(s * 0.2, -s * 0.05);
    ctx.closePath();
    ctx.moveTo(0, s * 0.2);
    ctx.quadraticCurveTo(s * 1.0, s * (0.4 + open * 2), s * 1.6, s * open);
    ctx.lineTo(s * 0.2, s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  /** Manta rail — a manta glide: a broad flat chevron of wing, flexing,
   *  with a bright rail-glow down its spine. */
  mantarail(ctx, s, color, time) {
    const flex = Math.sin(time * 8) * s * 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 1.6, 0);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.5, -s * 0.8, -s * 1.5 - flex);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.8, s * 1.5 + flex);
    ctx.quadraticCurveTo(s * 0.2, s * 0.5, s * 1.6, 0);
    ctx.fill();
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.9, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(s * 1.5, 0);
    ctx.lineTo(-s * 2.2, 0);
    ctx.stroke();
  },

  /** Moray tesla — the eel's open jaw lunging forward with a forked spark
   *  between its teeth. */
  moraytesla(ctx, s, color, time) {
    const gape = 0.3 + Math.abs(Math.sin(time * 10)) * 0.4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 1.4, -s * 0.3);
    ctx.lineTo(s * 1.2, -s * gape);
    ctx.lineTo(s * 0.4, 0);
    ctx.lineTo(s * 1.2, s * gape);
    ctx.lineTo(-s * 1.4, s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.8, s * 0.12);
    ctx.beginPath();
    ctx.moveTo(s * 0.5, 0);
    ctx.lineTo(s * 1.1, -s * 0.15);
    ctx.lineTo(s * 1.4, s * 0.1);
    ctx.lineTo(s * 1.9, -s * 0.05);
    ctx.stroke();
  },

  /** Nudi zapper — a frilled sea-slug spark: a soft oval body with a crown
   *  of rippling gill tips. */
  nudizapper(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = HOT;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.7, s * 0.12);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = -s * 0.7 + i * s * 0.35;
      const w = Math.sin(time * 15 + i) * s * 0.15;
      ctx.moveTo(x, -s * 0.35);
      ctx.lineTo(x + w, -s * 0.85);
      ctx.moveTo(x, s * 0.35);
      ctx.lineTo(x - w, s * 0.85);
    }
    ctx.stroke();
  },

  /** Octo blaster — an ink blot with four curling arms trailing behind it. */
  octoblaster(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(s * 0.4, 0, s * 0.75, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.9, s * 0.2);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = (i - 1.5) * s * 0.3;
      const c = Math.sin(time * 11 + i * 1.4) * s * 0.5;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(-s * 0.8, y + c, -s * 1.3, y - c, -s * 1.8, y + c * 0.5);
    }
    ctx.stroke();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.65, -s * 0.2, s * 0.17, 0, TAU);
    ctx.fill();
  },

  /** Orca plasma — a black-and-white charge: a dark teardrop of plasma with
   *  the orca's white eye-patch flash riding its flank. */
  orcaplasma(ctx, s, color, time) {
    const p = 1 + Math.sin(time * 14) * 0.08;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.3 * p, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#10141c';
    ctx.beginPath();
    ctx.moveTo(s * 1.2, 0);
    ctx.quadraticCurveTo(0, -s * 0.95, -s * 1.1, 0);
    ctx.quadraticCurveTo(0, s * 0.95, s * 1.2, 0);
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.ellipse(s * 0.3, -s * 0.2, s * 0.35, s * 0.16, -0.3, 0, TAU);
    ctx.fill();
  },

  /** Scallop shotgun — a little fan-shell pellet, ribs radiating from its
   *  hinge, flipping as it flies. */
  scallopshotgun(ctx, s, color, time) {
    ctx.save();
    ctx.rotate(Math.sin(time * 12) * 0.6);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, 0);
    ctx.arc(-s * 0.6, 0, s * 1.3, -0.75, 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.6, s * 0.08);
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.3;
      ctx.moveTo(-s * 0.5, 0);
      ctx.lineTo(-s * 0.6 + Math.cos(a) * s * 1.2, Math.sin(a) * s * 1.2);
    }
    ctx.stroke();
    ctx.restore();
  },

  /** Shark rifle — a dart with a dorsal fin standing up off it, slicing
   *  through the water like the fin it is. */
  sharkrifle(ctx, s, color, time) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 2.0, 0);
    ctx.lineTo(-s * 1.6, -s * 0.3);
    ctx.lineTo(-s * 1.6, s * 0.3);
    ctx.closePath();
    ctx.moveTo(s * 0.3, -s * 0.15);
    ctx.lineTo(-s * 0.4, -s * (1.0 + Math.sin(time * 9) * 0.1));
    ctx.lineTo(-s * 0.7, -s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(0.6, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.25);
    ctx.lineTo(-s * 2.4, -s * 0.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Squid sling — a slung river stone, its wet sheen sliding round as it
   *  spins, a smear of ink behind. */
  squidsling(ctx, s, color, time) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#2a1e3a';
    ctx.beginPath();
    ctx.ellipse(-s * 1.0, 0, s * 0.9, s * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.65, time * 4, 0, TAU);
    ctx.fill();
    const a = time * 6;
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.25, s * 0.15, 0, TAU);
    ctx.fill();
  },

  /** Sunfish cannon — a heavy flat disc of a round with the mola's two
   *  stubby fins sticking up and down off its back edge. */
  sunfishcannon(ctx, s, color, time) {
    const w = Math.sin(time * 6) * 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.0, s * 0.9, 0, 0, TAU);
    ctx.moveTo(-s * 0.5, -s * 0.6);
    ctx.lineTo(-s * (0.9 + w), -s * 1.6);
    ctx.lineTo(-s * 0.1, -s * 0.8);
    ctx.moveTo(-s * 0.5, s * 0.6);
    ctx.lineTo(-s * (0.9 - w), s * 1.6);
    ctx.lineTo(-s * 0.1, s * 0.8);
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.55, -s * 0.15, s * 0.2, 0, TAU);
    ctx.fill();
  },

  /** Turtle crossbow — a bolt with a tiny shell-plate head: a hexagon of
   *  scute riding the tip of a fletched shaft. */
  turtlecrossbow(ctx, s, color, time) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.9, s * 0.18);
    ctx.beginPath();
    ctx.moveTo(-s * 1.8, 0);
    ctx.lineTo(s * 0.8, 0);
    ctx.moveTo(-s * 1.8, 0);
    ctx.lineTo(-s * 2.3, -s * 0.45);
    ctx.moveTo(-s * 1.8, 0);
    ctx.lineTo(-s * 2.3, s * 0.45);
    ctx.stroke();
    ctx.save();
    ctx.translate(s * 1.2, 0);
    ctx.rotate(time * 3);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * (TAU / 6);
      const op = i === 0 ? 'moveTo' : 'lineTo';
      ctx[op](Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /** Walrus shotgun — a fat ivory slug with two tusk-points flaring back
   *  off its nose. */
  walrusshotgun(ctx, s, color, time) {
    const j = Math.sin(time * 18) * s * 0.05;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, j, s * 0.75, s * 0.6, 0, 0, TAU);
    ctx.moveTo(s * 0.4, j - s * 0.3);
    ctx.lineTo(-s * 1.3, j - s * 0.75);
    ctx.lineTo(s * 0.0, j - s * 0.05);
    ctx.moveTo(s * 0.4, j + s * 0.3);
    ctx.lineTo(-s * 1.3, j + s * 0.75);
    ctx.lineTo(s * 0.0, j + s * 0.05);
    ctx.fill();
    ctx.fillStyle = HOT;
    ctx.beginPath();
    ctx.arc(s * 0.3, j - s * 0.15, s * 0.16, 0, TAU);
    ctx.fill();
  },
});

/**
 * Does this gun have a body of its own? Case-insensitive; false for the bare
 * fist, for every melee id on the rig's swing list, and for anything unknown,
 * so the caller can fall back to its shared-shape painter without guessing.
 */
export function hasGunRound(gunId) {
  const id = String(gunId == null ? '' : gunId).toLowerCase();
  return id !== '' && Object.prototype.hasOwnProperty.call(GUN_ROUND_BODIES, id);
}

/**
 * Draw the gun's round body at the bolt's position. The caller has ALREADY
 * translated `ctx` to the bolt and rotated it onto the travel angle, so every
 * body here draws with local +X forward.
 *
 * `b` is the live bolt and is READ-ONLY here: this reads `b.size` (px radius,
 * clamped to at least 2) and `b.color` (hex string, coerced with a sane
 * fallback), and takes the gun id off `b.gunId` or, when only the projectile
 * profile is attached, `b.profile.body` — both accepted. `time` is in seconds
 * and drives every spin and pulse in the file.
 *
 * Returns true when a body was drawn. False means there is no body for that
 * bolt — fist, melee, an unknown id, or a context that cannot path — and that
 * is the caller's cue to paint the shared shape instead of drawing nothing.
 * Every body's `globalAlpha`, `lineWidth`, `lineCap`, `lineJoin` and style
 * writes happen inside this one save/restore pair, so nothing leaks back into
 * the bolt batch.
 */
export function drawGunRound(ctx, b, time) {
  if (!ctx || typeof ctx.beginPath !== 'function' || !b) return false;
  const raw = b.gunId || (b.profile && b.profile.body) || '';
  const id = String(raw).toLowerCase();
  // Own-property lookup only: a hostile/odd id ('constructor', 'toString')
  // must never resolve to an inherited function and get called as a body.
  const body = id !== '' && Object.prototype.hasOwnProperty.call(GUN_ROUND_BODIES, id)
    ? GUN_ROUND_BODIES[id]
    : undefined;
  if (typeof body !== 'function') return false;
  const s = Math.max(2, Number(b.size) || 3);
  const color = typeof b.color === 'string' && b.color.length > 0
    ? b.color
    : DEFAULT_COLOR;
  ctx.save();
  body(ctx, s, color, Number(time) || 0);
  ctx.restore();
  return true;
}