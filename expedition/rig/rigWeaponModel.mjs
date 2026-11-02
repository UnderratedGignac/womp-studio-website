/** Which held rig attachments are melee — i.e. allowed to swing.
 *
 *  The question cannot be answered from ballistics: `gunCatalog.gunClass` routes
 *  every one of the rig's ~55 weapon sprites onto a projectile class, so even
 *  the katana technically fires bolts. It IS answerable from what the art shows,
 *  which is what the player reads: a blade, pole or tool you physically swing
 *  should travel with the arm holding it, while a firearm should sit still in
 *  the fist and let the pleco aim by turning.
 *
 *  That distinction matters most on the `punch` rig clip, which `PlecoFighter`
 *  plays as the recoil beat of every gunshot: it rotates the `hand` bone -55
 *  degrees on the wind-up and +20 on the follow-through. A sword swinging
 *  through that is the animation working as intended; a minigun whipping 75
 *  degrees on every round is a gun being used like a club.
 *
 *  Membership is by what the sprite IS, never by the ballistic class it rides —
 *  the class table gets retuned for balance, and a katana would stop looking
 *  like a katana if its motion followed the numbers.
 */

/** Rig slot names a held attachment is drawn through. `SkeletonData` resolves
 *  the grip bone from them; `SkelRenderer` keeps its own copies because that
 *  file is inlined (imports stripped) into the standalone viewer pages. */
export const WEAPON_SLOT_FRONT = 'weapon_front';
export const WEAPON_SLOT_BACK = 'weapon_back';

/** Every held weapon is drawn this much larger than the size its catalogue row
 *  was authored at.
 *
 *  Why one global knob instead of retuning 63 `scale` numbers: the per-weapon
 *  rows record each sprite's ASPECT against its own 512px sheet, and nothing
 *  about them records how big the gun should LOOK next to a pleco — that number
 *  was never a per-weapon fact, so keeping it per-weapon is how the whole
 *  catalogue ended up reading undersized. One constant is also the only place a
 *  future "make the guns bigger" pass has to look, and it keeps the ratio
 *  between a pistol and a railgun exactly as authored.
 *
 *  1.35 is measured, not guessed: at 1.0 the longest barrel (trident, 82u) was
 *  already two-thirds of the whole fish and the rifle read as a stick held at
 *  arm's length; at 1.35 the rifle is 100u — as long as the pleco is nose to
 *  tail — which is what makes the fish look like it is carrying the gun rather
 *  than being stuck to it. It is held at the gun's ANCHOR, so a bigger gun grows
 *  away from the fist in both directions and never shifts the grip.
 *
 *  Anything that must fit this inside a fixed box reads
 *  `SkeletonData.heldWeaponBox` (the Armory preview pane does) rather than
 *  guessing: the scale is applied once, here, so a surface that sizes itself off
 *  `bindWidth` alone would silently clip the barrel. */
export const HELD_WEAPON_SCALE = 1.35;

/** Rig weapon ids carried as hand weapons: they ride the live grip bone and
 *  swing with it. Everything else in the catalogue is drawn on the steady mount
 *  (see `Skeleton._updateWeaponMount`). */
export const MELEE_RIG_WEAPON_IDS = Object.freeze([
  'katana',          // sword
  'dagger',          // knife
  'bladefan',        // a hand-held fan of blades, swung
  'orbitalblades',   // a blade cluster carried in the fist
  'trident',         // polearm
  'voltspear',       // spear — despite the `volt` keyword routing it onto energy ballistics
  'hammer',          // blunt, two-handed
  'chainsaw',        // held tool that cuts by contact
  'whip',            // flailed; it never leaves the hand
  'swordfishblade',  // sword (a swordfish bill for a blade)
  'sharkaxe',        // axe on a wooden haft
  'coralmace',       // mace — blunt head on a handle
  'marlinrapier',    // rapier
  'hammerheadmaul',  // two-handed maul
  'kelpscythe',      // scythe on a haft
  'barracudasaber',  // saber
  'anglerflail',     // flail — ball on a chain, never thrown
  'urchinclub',      // spiked club
  'sawfishblade',    // greatsword
  'stingerdagger',   // dagger
  'tuskspear',       // spear
  'bonecleaver',// cleaver
  'cutlass',         // sword
  'anchorhalberd',   // polearm
  'pearlwarhammer',  // warhammer
  'crabpincer',      // a claw on a handle, snapped shut by hand
  'eelwhip',         // whip
]);

const MELEE_IDS = new Set(MELEE_RIG_WEAPON_IDS);

/** True when a rig weapon id is a hand weapon whose swing should be animated. */
export function isMeleeRigWeapon(id) {
  return MELEE_IDS.has(String(id || ''));
}

/** True when a rig weapon id is drawn on the steady mount — every sprite that
 *  fires something, and every id this module has not been told is a blade.
 *  Unknown ids default to steady: a new gun joining the catalogue is far more
 *  likely than a new sword, and the wrong guess costs a still weapon, not a
 *  gun that swings like a club. */
export function isSteadyRigWeapon(id) {
  return !isMeleeRigWeapon(id);
}

/** The world-space box a held weapon paints, in rig units, at the setup pose.
 *
 *  A weapon sprite is authored as a rectangle and its grip is somewhere inside
 *  it, so the painted area is `[hand - anchor·s, hand + (size - anchor)·s]` on
 *  each axis — which is how `SkelRenderer._drawWeapon` composes its transform.
 *  Rotation is deliberately not applied: the swing clips are live-animated and a
 *  melee blade sweeps a wider arc than its bind box, so this reports the rest
 *  pose, which is what a surface has to reserve room for.
 *
 *  `handX/handY` are the GRIP's world point (the caller owns it, because the
 *  per-skin `handBySkin` correction moves it). */
/** How big a held weapon may be next to the pleco, in rig units at the drawn
 *  size (row scale × HELD_WEAPON_SCALE). The fish is 100 × 48u.
 *
 *  Measured off the weapons that already read as CARRIED rather than worn:
 *  the pistol is 23u tall, the minigun 25u, the rifle 100u long at ~2240u².
 *  Past these the gun stops being in the fist and starts being on top of the
 *  fish — a 40u-tall cannon covers the face, and a grip at a weapon's top edge
 *  hangs the whole thing 50u under the belly. `reachAbove`/`reachBelow` are
 *  the paint above and below the fist itself, which is what covers the face
 *  or drags under the body. Polearms get a longer `lengthMelee`: a spear or a
 *  halberd is long on purpose, and a swung head (a hammer, an axe) is raised
 *  above the fist by design, so hand weapons get `heightMelee` /
 *  `reachAboveMelee` too. `tools/fit_held_weapons.mjs` shrinks any row
 *  that breaks a limit; tests/pleco/held-weapon-fit.test.js holds every row
 *  to them.
 *
 *  The first cut (26u tall, 18u either side, 2300u²) pinned every compact,
 *  tall weapon — a glue gun, an anchor, a sea mine, a sunfish cannon — at
 *  toy size next to a 48u pistol, and the player asked for them bigger. The
 *  gun limits were loosened to what still keeps a weapon off the face; no
 *  weapon grows from a limit alone (the fit tool only ever shrinks). */
export const HELD_WEAPON_LIMITS = Object.freeze({
  height: 30,
  heightMelee: 32,
  reachAbove: 21,
  reachAboveMelee: 24,
  reachBelow: 21,
  area: 2700,
  length: 100,
  lengthMelee: 110,
});

/** A held weapon's drawn extent around the fist, in rig units, with its own
 *  `angle` applied the way SkelRenderer applies it (rotate, then scale, about
 *  the anchor). `w`/`h` are the rotated bounding box; `above`/`below` are how
 *  far paint reaches above and below the grip.
 *
 *  `paint` (optional) is a list of [x, y] sprite pixels that carry art. Without
 *  it the sprite's rectangle stands in, which is exact for the level weapons
 *  (their art is cropped to its own edges) but overstates a TILTED one: a
 *  hammer drawn on a diagonal has empty corners that rotate out past the fish.
 *  The fit tool and the fit test both pass the real paint. */
export function heldWeaponExtent(row, paint = null) {
  const s = row.scale * HELD_WEAPON_SCALE;
  const a = ((row.angle || 0) * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const pts = paint && paint.length
    ? paint : [[0, 0], [row.width, 0], [0, row.height], [row.width, row.height]];
  for (const [px, py] of pts) {
    const dx = (px - row.anchorX) * s, dy = (py - row.anchorY) * s;
    const x = cos * dx - sin * dy, y = sin * dx + cos * dy;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { w: x1 - x0, h: y1 - y0, above: -y0, below: y1 };
}

/** The factor (≤ 1) a row's scale must be multiplied by to sit inside
 *  HELD_WEAPON_LIMITS. 1 means it already fits. */
export function heldWeaponFitFactor(row, melee = false, paint = null) {
  const e = heldWeaponExtent(row, paint);
  const L = HELD_WEAPON_LIMITS;
  return Math.min(1,
    (melee ? L.heightMelee : L.height) / e.h,
    (melee ? L.reachAboveMelee : L.reachAbove) / Math.max(e.above, 1e-6),
    L.reachBelow / Math.max(e.below, 1e-6),
    Math.sqrt(L.area / (e.w * e.h)),
    (melee ? L.lengthMelee : L.length) / e.w);
}

export function heldWeaponBox(weapon, handX, handY) {
  if (!weapon) return null;
  const s = weapon.scale;
  return {
    x0: handX - weapon.anchorX * s,
    x1: handX + (weapon.width - weapon.anchorX) * s,
    y0: handY - weapon.anchorY * s,
    y1: handY + (weapon.height - weapon.anchorY) * s,
  };
}
