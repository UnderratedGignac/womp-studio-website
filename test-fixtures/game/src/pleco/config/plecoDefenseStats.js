/**
 * Per-skin tower-defense stat block for the PlecoFighter entity.
 *
 * The 31 skins ported from `pleco_rampage` each map to one entry here.
 * The stats are the numbers used when a pleco is deployed as a defender
 * on the GameScene grid — NOT the numbers used in `pleco_rampage`'s
 * open-world mode (which are baked into the SkinPowers/ability modules
 * and stay untouched).
 *
 * v1 keeps the tiers coarse (three tiers of damage, two of range, two of
 * fireRate) so the swap ships with balanced-looking defaults without
 * stalling on number-crunching. Phase 5 (`Balance integration`) will
 * retune each row against `FISH_TYPES` from `src/config/Balance.js` so
 * the total DPS-per-coin curve for a given wave matches the pre-swap
 * fish economy.
 *
 * Field meanings (mirroring Fish.js):
 *   `tier`       1..5, roughly a "coin cost bracket" — the shop lists
 *                defenders grouped by tier.
 *   `damage`     HP removed per landed hit at level 1.
 *   `hp`         Optional per-skin max-HP override at level 1. Absent = the
 *                tier formula (`PLECO_BASE_HP + PLECO_HP_PER_TIER*(tier-1)`,
 *                mirrored by `PlecoFighter`). Used to make the base pleco
 *                tankier than its tier without moving every tier-1 skin.
 *   `range`      World units — measured from the fighter's centre to the
 *                target's centre.
 *   `fireRate`   Attacks per second (seconds between = 1 / fireRate).
 *   `element`    Reserved; `pleco_rampage`'s elemental reactions come in
 *                a later phase. Empty string means "no reaction".
 *   `abilityCooldown`  Seconds between signature-ability casts. Only used
 *                if the skin has a `signatureAbility` bound AND its class
 *                casts (sages — see `plecoClass`).
 *   `weapon`     Gun class for the ranged basic attack. Determines bolt
 *                speed, spread, pellet count, splash radius, and pierce.
 *                See WEAPON_CONFIGS below. For tanks and sages this is
 *                `'fist'`: they deploy bare-handed (a tank goes looking for
 *                a blade in the Armory; a sage never holds anything).
 *   `plecoClass` One of `tank` / `sniper` / `gunner` / `sage` — which class
 *                the skin belongs to. The class decides the Armory rail the
 *                pleco may equip from and whether it casts signature
 *                abilities in defense mode (only sages do). Authority lives
 *                in `plecoClasses.js`; every row is asserted valid there.
 *   `abilityPowerMul` Sage-only damage knob on its signature ability
 *                (absent = 1). The fighter folds it into `skinDmgMult`, so
 *                the Luster ability ladder multiplies ON TOP of the class
 *                buff rather than replacing it.
 *   `reloadMul`  Weapon handling — the pleco's personal multiplier on the
 *                gun's reload time. <1 = light hands that run the mag
 *                faster (a SMG-gunner built for volume), >1 = a heavy
 *                skin that slugs a big gun around. The GUN defines the
 *                reload, the PLECO defines how fast it spends it.
 *   `perk`       One combat-support passive every pleco carries, proc'd
 *                by `PlecoFighter` (see its perk hooks):
 *                  `triggerDiscipline` last round in the mag hits +50%
 *                  `killReload`        a kill snaps the reload and fulls the mag
 *                  `secondWind`        under 30% HP, fires 40% faster
 *                  `steadyHands`       +6% flat crit chance
 */

/* ── Weapon classes ───────────────────────────────────────────────────────
 * Each weapon type defines the projectile behaviour when a PlecoFighter
 * fires its basic attack. The fields:
 *   range       px the gun reaches - LONG for guns, short for a bare fist.
 *               A pleco deploys bare-fisted; equipping a gun in the Armory
 *               re-points the fighter combat radius at THIS gun range, so
 *               every gun has its own reach and a gunned pleco fights long.
 *   boltSpeed   px/s the projectile travels
 *   spread      max angular deviation (radians) on each shot
 *   pellets     number of projectiles per trigger pull (shotgun > 1)
 *   splash      radius of AoE damage on impact — since the 2026-10-12 super
 *               pleco shoot pass the club is wider than the cannon: shotgun
 *               (buckshot cone), sniper (hydrostatic shock) and energy (plasma
 *               detonation) carry small rings; fast/precise classes stay 0
 *   splashMul   what share of the round's damage the splash victims take
 *               (bridge default 0.5 for rounds with no row — ability bolts)
 *   pierce      how many extra enemies a bolt passes through (sniper)
 *   bulletSize  visual radius of the projectile
 *   color       hex tint of the projectile glow
 *   critChance  base crit probability (0..1)
 *   critMult    damage multiplier on crit
 *   burstSize   shots before reload kick-in (0 = no reload)
 *   reloadTime  seconds paused after burst (0 = no reload)
 *   fireRateMul The gun class's own trigger speed — multiplies the SKIN's
 *               base fireRate at fire time (see PlecoFighter._effectiveFireRate).
 *               >1 = a spray class (minigun), <1 = a commit class (railgun).
 *   dmgMul      The gun class's per-hit bite — multiplies the wearer's damage
 *               on each pull. Paired with fireRateMul so rate × damage stays
 *               ~1: a minigun is fast and light, a cannon slow and heavy.
 */
export const WEAPON_CONFIGS = {
  pistol:  { range: 240, boltSpeed: 520, spread: 0.04, pellets: 1, splash: 0,  pierce: 0, bulletSize: 4,  color: '#ffe080', critChance: 0.08, critMult: 2.0, burstSize: 12, reloadTime: 0.9, knockback: 15, fireRateMul: 1.0, dmgMul: 1.0 },
  smg:     { range: 220, boltSpeed: 580, spread: 0.14, pellets: 1, splash: 0,  pierce: 0, bulletSize: 3,  color: '#ffec70', critChance: 0.04, critMult: 1.8, burstSize: 20, reloadTime: 0.6, knockback: 7, fireRateMul: 2.8, dmgMul: 0.45 },
  shotgun: { range: 160, boltSpeed: 420, spread: 0.30, pellets: 3, splash: 30, splashMul: 0.35, pierce: 0, bulletSize: 4,  color: '#ffb347', critChance: 0.10, critMult: 2.2, burstSize: 4,  reloadTime: 1.8, knockback: 46, fireRateMul: 0.8, dmgMul: 1.3 },
  rifle:   { range: 320, boltSpeed: 700, spread: 0.02, pellets: 1, splash: 0,  pierce: 1, bulletSize: 3,  color: '#a8f0ff', critChance: 0.15, critMult: 2.5, burstSize: 6,  reloadTime: 1.5, knockback: 18, fireRateMul: 1.5, dmgMul: 0.7 },
  cannon:  { range: 260, boltSpeed: 350, spread: 0.00, pellets: 1, splash: 80, pierce: 0, bulletSize: 7,  color: '#ff6640', critChance: 0.12, critMult: 2.0, burstSize: 3,  reloadTime: 2.2, knockback: 130, fireRateMul: 0.7, dmgMul: 1.5 },
  sniper:  { range: 460, boltSpeed: 900, spread: 0.00, pellets: 1, splash: 36, splashMul: 0.4, pierce: 3, bulletSize: 3,  color: '#80ffe0', critChance: 0.22, critMult: 3.0, burstSize: 5,  reloadTime: 2.2, knockback: 70, fireRateMul: 0.6, dmgMul: 1.8 },
  energy:  { range: 300, boltSpeed: 780, spread: 0.03, pellets: 1, splash: 40, splashMul: 0.45, pierce: 2, bulletSize: 4,  color: '#c58bff', critChance: 0.14, critMult: 2.4, burstSize: 8,  reloadTime: 1.2, knockback: 24, fireRateMul: 1.6, dmgMul: 0.65 },
  // chain: on impact the bolt leaps to nearby enemies at falloff damage — the
  // tesla/anglerfish guns. `chainJumps` extra targets, each within `chainRange`
  // px of the previous hit, carrying `chainFalloff` × the prior bolt's damage.
  chain:   { range: 280, boltSpeed: 620, spread: 0.05, pellets: 1, splash: 0,  pierce: 0, bulletSize: 4,  color: '#8be9ff', critChance: 0.10, critMult: 2.0, burstSize: 6,  reloadTime: 1.4, knockback: 12, chainJumps: 3, chainRange: 130, chainFalloff: 0.6, fireRateMul: 1.4, dmgMul: 0.75 },
  // boomerang: flies out, curves back to the thrower, and cuts every enemy on
  // BOTH passes (a per-bolt hit set lets it re-arm on the return). Huge pierce
  // so no single contact spends it; it dies on `maxLife`, not on hit.
  boomerang:{ range: 300, boltSpeed: 470, spread: 0.00, pellets: 1, splash: 0,  pierce: 999, bulletSize: 6, color: '#7cffcb', critChance: 0.10, critMult: 2.2, burstSize: 3,  reloadTime: 1.6, knockback: 30, boomerang: 1, fireRateMul: 0.8, dmgMul: 1.3 },
  fist:    { range: 90,  boltSpeed: 0,   spread: 0,    pellets: 0, splash: 0,  pierce: 0, bulletSize: 0,  color: '#ffc864', critChance: 0.10, critMult: 2.0, burstSize: 0, reloadTime: 0,   knockback: 50 },

  /* ── The weird six (2026-09) ──────────────────────────────────────────
   * Six classes that do not fit the shoot-a-slug-and-forget ladder. The
   * bridge reads the BEHAVIOUR flags below off `WEAPON_CONFIGS[weaponType]`
   * at fire time and stamps them onto the bolt — they deliberately do NOT
   * come through the bolt spec, because the spec the fighter sends is a
   * fixed vocabulary and growing it would mean editing the fighter. Every
   * row still carries the full ballistic vocabulary above, so a new gun of
   * one of these classes numbers like any other: reach, speed, spread,
   * pellets, splash, pierce, size, colour, crit, burst, reload, knockback. */
  // stinger: a jellyfish bell that fires a barb. It is a LIGHT round — one
  // kiss off the glass is allowed — and it burns in thrust swells, so it
  // closes the gap in little lunges. `pierce: 1` is the whole class: the SAME
  // bolt has to land twice to pay off. `stingDot` is the venom the first
  // contact leaves; on the second contact the same barb re-injects at
  // `stingRamp` × the dot AND tops the fish up for the difference, so a
  // one-hit stinger is a plain poison round and the second hit is the payout
  // the player is lining up.
  stinger: { range: 250, boltSpeed: 560, spread: 0.06, pellets: 1, splash: 0,  pierce: 1,  bulletSize: 4,  color: '#c07de8', critChance: 0.12, critMult: 2.2, burstSize: 5, reloadTime: 1.5, knockback: 22, stinger: 1, stingDot: 4, stingDotDuration: 3, stingRamp: 1.75, fireRateMul: 1.3, dmgMul: 0.8 },
  // phase: a lance that is not there for part of its trip. It flies the hop
  // lane — visible pulses with the water dragging the gaps shut between them —
  // and `pierce: 1` buys the second fish on the way out. Every hop drops an
  // afterimage, so the trail shows the shot vanishing and reappearing instead
  // of one continuous streak. Nothing about the HIT depends on the flicker:
  // under reduced motion the afterimages stop and the lance kills the same.
  phase:   { range: 340, boltSpeed: 760, spread: 0.03, pellets: 1, splash: 0,  pierce: 1,  bulletSize: 3,  color: '#7fe6ff', critChance: 0.16, critMult: 2.6, burstSize: 5, reloadTime: 1.6, knockback: 20, blink: 1, fireRateMul: 1.4, dmgMul: 0.75 },
  // fractal: one shard that has not finished splitting. On contact it throws
  // TWO live child bolts at ±`forkSpread` degrees, each carrying `forkShare` of
  // the parent's damage, and the same rule applies to them for `forkDepth`
  // generations. The share IS the budget, and it is worth stating exactly: a
  // child is `forkShare` (0.25) of its parent, so one shard's whole tree is
  // worth 1 + 2·0.25 = 1.5 clean shards, and the children on their own (0.5)
  // can never add up to more than the shard that threw them. `forkDepth: 2` is
  // the other half of the promise — one child generation and no grandchildren,
  // so a single shot is three live bolts at most however long it flies.
  fractal: { range: 260, boltSpeed: 500, spread: 0.10, pellets: 1, splash: 0,  pierce: 0,  bulletSize: 5,  color: '#7affd8', critChance: 0.12, critMult: 2.2, burstSize: 4, reloadTime: 1.8, knockback: 18, forkDepth: 2, forkShare: 0.25, forkSpread: 26, fireRateMul: 1.1, dmgMul: 0.95 },
  // sonar: there is no travelling slug — the SHOT is the wave. The bolt leaves
  // the chime, then grows `growRate` px/s out to `maxRadius` and bites every
  // fish its rim sweeps through, each AT MOST ONCE (it keeps a hit set, the
  // same trick the boomerang uses to survive its return pass). A contact never
  // spends it, so `pierce: 999` is load-bearing: the wave leaves when its fuse
  // does, not when the tank gets in the way.
  sonar:   { range: 300, boltSpeed: 200, spread: 0.00, pellets: 1, splash: 0,  pierce: 999, bulletSize: 6,  color: '#5fe0ff', critChance: 0.10, critMult: 2.0, burstSize: 4, reloadTime: 2.0, knockback: 8,  ringWave: 1, growRate: 90, maxRadius: 90, fireRateMul: 0.7, dmgMul: 1.5 },
  // well: a hole, not a bullet. While it flies it hauls every fish inside
  // `pullRadius` toward the path it is walking, by pushing their own vx/vy and
  // calling `applyLaunch` ONCE to wake a fish out of whatever it was doing —
  // it never writes a position, so nothing is teleported, and `pullStrength` is
  // an ACCELERATION (px/s²) capped by the bridge, so one hole can never drag a
  // fish further than its own reach. Contact does nothing at all: the payoff
  // is the `implodeSplash` it detonates into when the hole closes on its own
  // fuse, and that lands wherever the haul has herded the fish.
  well:    { range: 240, boltSpeed: 260, spread: 0.05, pellets: 1, splash: 0,  pierce: 0,  bulletSize: 8,  color: '#a35ce0', critChance: 0.14, critMult: 2.4, burstSize: 3, reloadTime: 2.2, knockback: 40, pullRadius: 110, pullStrength: 40, implodeSplash: 70, fireRateMul: 0.7, dmgMul: 1.5 },
  // hover: a bubble bomb that will not go where it was aimed. The water lifts
  // it for the first part of its `fuse`, drag stalls the climb, and it sinks
  // the rest of the way — so it hangs over the tank as a mine. A fish that
  // touches it sets it off early; otherwise the fuse does. Either way it ends
  // as `burstNeedles` live needles, each carrying `needleShare` of the bomb.
  hover:   { range: 220, boltSpeed: 300, spread: 0.12, pellets: 1, splash: 0,  pierce: 0,  bulletSize: 7,  color: '#9be8ff', critChance: 0.12, critMult: 2.2, burstSize: 4, reloadTime: 2.0, knockback: 24, buoyant: 1, fuse: 0.9, burstNeedles: 4, needleShare: 0.35, fireRateMul: 0.8, dmgMul: 1.3 }
};

/* ── Muzzle flavour (2026-09) — per-class, draw-only muzzle flash ───────────
 * Every class used to spit the same thing: GameScene spawns one generic
 * 3-sparkle puff off `env.onPlecoFire`, and the bridge's `muzzleFlash` is a
 * single fixed ring. So a minigun, a railgun and a cannon all reported the
 * same shot from the same fish. This table gives each weapon class its OWN
 * flash silhouette, drawn at the barrel tip by
 * `PlecoFighter._renderMuzzleFlash`.
 *
 * It is STRICTLY COSMETIC: nothing here is read by `_fireWeapon`'s bolt spec,
 * by the pellet loop or by the fire rate, so no DPS, reload, ballistics or bolt
 * number can move because a row here changed. Each row is three numbers:
 *   life   seconds the flash survives (0 = this class never flashes)
 *   len    how far it stretches ALONG the barrel, × the fighter's radius
 *   wide   how thick it reads PERPENDICULAR to the barrel, × the fighter radius
 *
 * They are tuned as SILHOUETTES, not as a scale — a railgun is a long hair-thin
 * needle, a shotgun a short fat cone, a cannon one big round bloom, an SMG a
 * tick so short a burst flickers, and the fist class carries none at all (a
 * knuckle has no barrel to flash). `pistol` is the baseline every other row is
 * read against, and the fallback for a class that has no row yet. */
export const MUZZLE_FLAVOR = {
  // Baseline: a tidy, quick pop.
  pistol:    { life: 0.090, len: 1.15, wide: 0.90 },
  // Minigun: a tick — the shortest-lived and smallest flash, so a burst blinks.
  smg:       { life: 0.055, len: 0.70, wide: 0.65 },
  // Shotgun: short and fat — a wide cone right off the muzzle.
  shotgun:   { life: 0.140, len: 0.90, wide: 1.75 },
  // Rifle: the clean midpoint between the pistol pop and the railgun streak.
  rifle:     { life: 0.110, len: 1.60, wide: 0.75 },
  // Cannon: one big round bloom that hangs longer than anything else fires.
  cannon:    { life: 0.190, len: 1.25, wide: 1.50 },
  // Railgun: long, hair-thin, quick — the streak, never the ball.
  sniper:    { life: 0.160, len: 2.40, wide: 0.50 },
  // Energy: a fat mid-length discharge that lingers between shots.
  energy:    { life: 0.130, len: 1.40, wide: 1.10 },
  // Chain: stubby and broad — a crackle across the muzzle, not a shot.
  chain:     { life: 0.100, len: 0.95, wide: 1.45 },
  // Boomerang: a short broad flick, as if the thrown blade snapped the air.
  boomerang: { life: 0.080, len: 0.60, wide: 1.60 },
  // Bare hands: no barrel, so no flash at all. The row still has to exist (the
  // fighter looks its flavour up by weapon class) with positive geometry so the
  // draw maths can never be handed a zero to multiply through.
  fist:      { life: 0,     len: 0.60, wide: 0.60 },
  // The weird six, read as silhouettes. None of them has a barrel in the
  // ordinary sense, so none of them gets a barrel flash: a stinger is a bell
  // that pops wide, a phase lance is a long thin flicker with holes in it, a
  // fractal shard splits into a fat bloom, a sonar chime is a flat expanding
  // ring, a well opens slowly and wide, and a bubble bomb is a soft round puff
  // that hangs. Draw-only, like every row above: no bolt number can see this.
  stinger:   { life: 0.100, len: 0.85, wide: 1.30 },
  phase:     { life: 0.140, len: 1.85, wide: 0.55 },
  fractal:   { life: 0.120, len: 1.05, wide: 1.55 },
  sonar:     { life: 0.170, len: 0.70, wide: 1.90 },
  well:      { life: 0.200, len: 1.35, wide: 1.70 },
  hover:     { life: 0.150, len: 0.95, wide: 1.20 }
};

/** The muzzle flavour row for a weapon class, falling back to the pistol
 *  baseline for a class with no row (a future gun folded onto a class by the
 *  keyword ladder, or `weaponType: 'melee'`) — same policy as `weaponConfig`,
 *  so an unflashable class is a design choice, never a missing-data crash. */
export function muzzleFlavorFor(weaponType) {
  return MUZZLE_FLAVOR[weaponType] || MUZZLE_FLAVOR.pistol;
}

/* ── Melee (hand-carried) weapons ──────────────────────────────────────────
 * The audit: the rig's swing list (see `pleco/rig/rigWeaponModel.js`) are
 * blades, poles and tools a pleco PHYSICALLY swings — they must only strike
 * while the prey is right against them, and never spawn a bolt. So every row
 * here carries `boltSpeed: 0` / `pellets: 0` (the fighter's melee gate), a
 * `reach` (the contact distance it will strike at, always inside the bare
 * fist's 90px envelope — "so close"), and per-weapon fireRate / knockback
 * flavour: a dagger flickers, a hammer commits. Keyed by gun id; `range` is
 * the combat radius the fighter closes within, `reach` is where the swing
 * actually lands. `dmgMul` is the hand weapon's own bite: a per-weapon
 * multiplier on the wearer's damage stat, applied to each swing. */
export const MELEE_WEAPON_CONFIGS = {
  dagger:         { range: 90, reach: 58, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#e6edf3', dmgMul: 1.15, critChance: 0.12, critMult: 2.0, burstSize: 0, reloadTime: 0, knockback: 10, fireRateMul: 1.55 },
  katana:         { range: 90, reach: 84, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#bfe6ff', dmgMul: 1.30, critChance: 0.22, critMult: 2.6, burstSize: 0, reloadTime: 0, knockback: 23, fireRateMul: 1.20 },
  bladefan:       { range: 90, reach: 76, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#7cf2d8', dmgMul: 1.20, critChance: 0.12, critMult: 2.0, burstSize: 0, reloadTime: 0, knockback: 18, fireRateMul: 1.30 },
  orbitalblades:  { range: 90, reach: 80, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#cfa9ff', dmgMul: 1.25, critChance: 0.14, critMult: 2.2, burstSize: 0, reloadTime: 0, knockback: 25, fireRateMul: 1.10 },
  trident:        { range: 90, reach: 88, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#ffd9a0', dmgMul: 1.45, critChance: 0.18, critMult: 2.6, burstSize: 0, reloadTime: 0, knockback: 33, fireRateMul: 1.00 },
  voltspear:      { range: 90, reach: 86, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#ffee40', dmgMul: 1.30, critChance: 0.16, critMult: 2.4, burstSize: 0, reloadTime: 0, knockback: 28, fireRateMul: 1.10 },
  hammer:         { range: 90, reach: 66, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#a6b3c7', dmgMul: 1.50, critChance: 0.18, critMult: 2.8, burstSize: 0, reloadTime: 0, knockback: 100, fireRateMul: 0.78 },
  chainsaw:       { range: 90, reach: 62, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#ff8a3c', dmgMul: 1.35, critChance: 0.08, critMult: 1.7, burstSize: 0, reloadTime: 0, knockback: 12, fireRateMul: 2.10 },
  whip:           { range: 90, reach: 90, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#ff5fa2', dmgMul: 1.20, critChance: 0.10, critMult: 1.8, burstSize: 0, reloadTime: 0, knockback: 6,  fireRateMul: 1.40 },
  // Sea Arsenal blades, each pitched between two existing rows so none
  // outclasses the line: a bill-sword is a longer, slightly softer katana; the
  // shark axe and coral mace are the hammer's lighter, faster cousins.
  swordfishblade: { range: 90, reach: 86, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#a9d8ff', dmgMul: 1.25, critChance: 0.20, critMult: 2.4, burstSize: 0, reloadTime: 0, knockback: 20, fireRateMul: 1.20 },
  sharkaxe:       { range: 90, reach: 72, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#d8e2ea', dmgMul: 1.45, critChance: 0.20, critMult: 2.5, burstSize: 0, reloadTime: 0, knockback: 60, fireRateMul: 0.88 },
  coralmace:      { range: 90, reach: 68, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#ff6f61', dmgMul: 1.40, critChance: 0.14, critMult: 2.2, burstSize: 0, reloadTime: 0, knockback: 75, fireRateMul: 0.95 },
  // Wave two. Same envelope as the first: light blades trade damage for speed
  // and crits, heavy heads trade speed for damage and shove, and nothing tops
  // the hammer's 1.50 or the chainsaw's 2.10 rate.
  marlinrapier:     { range: 90, reach: 84, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#6fa8ff', dmgMul: 1.10, critChance: 0.24, critMult: 2.4, burstSize: 0, reloadTime: 0, knockback: 8,  fireRateMul: 1.50 },
  hammerheadmaul:   { range: 90, reach: 70, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#9aa7b4', dmgMul: 1.50, critChance: 0.16, critMult: 2.6, burstSize: 0, reloadTime: 0, knockback: 95, fireRateMul: 0.75 },
  kelpscythe:       { range: 90, reach: 88, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#6fd06a', dmgMul: 1.30, critChance: 0.18, critMult: 2.4, burstSize: 0, reloadTime: 0, knockback: 22, fireRateMul: 1.00 },
  barracudasaber:   { range: 90, reach: 80, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#d6e4f0', dmgMul: 1.25, critChance: 0.20, critMult: 2.3, burstSize: 0, reloadTime: 0, knockback: 16, fireRateMul: 1.25 },
  anglerflail:      { range: 90, reach: 82, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#ffe36a', dmgMul: 1.35, critChance: 0.12, critMult: 2.2, burstSize: 0, reloadTime: 0, knockback: 55, fireRateMul: 0.90 },
  urchinclub:       { range: 90, reach: 64, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#a46bd6', dmgMul: 1.35, critChance: 0.15, critMult: 2.2, burstSize: 0, reloadTime: 0, knockback: 70, fireRateMul: 0.95 },
  sawfishblade:     { range: 90, reach: 86, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#c4ccd4', dmgMul: 1.45, critChance: 0.14, critMult: 2.3, burstSize: 0, reloadTime: 0, knockback: 30, fireRateMul: 0.85 },
  stingerdagger:    { range: 90, reach: 56, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#c08a5a', dmgMul: 1.10, critChance: 0.16, critMult: 2.2, burstSize: 0, reloadTime: 0, knockback: 8,  fireRateMul: 1.65 },
  tuskspear:        { range: 90, reach: 90, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#f2ead8', dmgMul: 1.35, critChance: 0.16, critMult: 2.4, burstSize: 0, reloadTime: 0, knockback: 30, fireRateMul: 1.00 },
  bonecleaver: { range: 90, reach: 66, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#efe6d2', dmgMul: 1.40, critChance: 0.18, critMult: 2.5, burstSize: 0, reloadTime: 0, knockback: 40, fireRateMul: 0.95 },
  cutlass:          { range: 90, reach: 78, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#d0d8e0', dmgMul: 1.20, critChance: 0.18, critMult: 2.2, burstSize: 0, reloadTime: 0, knockback: 14, fireRateMul: 1.30 },
  anchorhalberd:    { range: 90, reach: 90, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#7d8fa8', dmgMul: 1.45, critChance: 0.15, critMult: 2.5, burstSize: 0, reloadTime: 0, knockback: 50, fireRateMul: 0.85 },
  pearlwarhammer:   { range: 90, reach: 66, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#fff4e6', dmgMul: 1.45, critChance: 0.17, critMult: 2.6, burstSize: 0, reloadTime: 0, knockback: 85, fireRateMul: 0.82 },
  crabpincer:       { range: 90, reach: 60, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#ff5a3c', dmgMul: 1.30, critChance: 0.14, critMult: 2.0, burstSize: 0, reloadTime: 0, knockback: 35, fireRateMul: 1.20 },
  eelwhip:          { range: 90, reach: 90, boltSpeed: 0, pellets: 0, splash: 0, pierce: 0, bulletSize: 0, color: '#c6ff4a', dmgMul: 1.15, critChance: 0.10, critMult: 1.8, burstSize: 0, reloadTime: 0, knockback: 10, fireRateMul: 1.45 },
};

/** The melee classes — bare hands and every hand-carried weapon. Nothing in
 *  this set fires a projectile; the fighter gates them at contact range. */
export function isMeleeClass(type) {
  return type === 'fist' || type === 'melee';
}

/** The melee stat block a hand-carried weapon fights with. Unknown ids ride
 *  the bare-fist envelope so a new swing weapon added to the rig's melee list
 *  is never left with a zero-damage attack. */
export function meleeWeaponConfig(gunId) {
  return MELEE_WEAPON_CONFIGS[String(gunId || '').toLowerCase()] || WEAPON_CONFIGS.fist;
}

/* ── Element colour overrides ────────────────────────────────────────────
 * When a pleco has an element, its bullets take on the element color
 * instead of the weapon's default. The element also imparts a status
 * effect on hit — giving each element a unique tactical role.
 *   fire   → burn: DoT for 3 seconds
 *   ice    → chill: 40% slow for 2 seconds
 *   poison → venom: DoT stacking to 3 charges
 *   shock  → stun: 0.5s paralysis (rare proc)
 */
export const ELEMENT_COLORS = {
  fire:   '#ff6630',
  ice:    '#7ae8ff',
  poison: '#7dff4a',
  shock:  '#ffee40'
};

/** The status effect definition an element's basic attack applies on hit.
 *  The shape matches Enemy.applyStatusEffect(): rootDuration, slowDuration,
 *  dotDps + dotDuration. Each element has a distinct tactical role. */
export const ELEMENT_STATUS = {
  fire:   { dotDps: 4, dotDuration: 3 },
  ice:    { slowDuration: 2 },
  poison: { dotDps: 3, dotDuration: 4 },
  shock:  { rootDuration: 0.5 }
};

/** Resolve weapon config for a given weapon type key, with element tint.
 *  `type === 'melee'` needs the gun id — a hand weapon's stats belong to the
 *  weapon (see `meleeWeaponConfig`), not to a shared class row. */
export function weaponConfig(type, element = '') {
  if (type === 'melee') return WEAPON_CONFIGS.fist; // generic melee, no specific blade
  const base = WEAPON_CONFIGS[type] || WEAPON_CONFIGS.pistol;
  const color = ELEMENT_COLORS[element] || base.color;
  return color === base.color ? base : { ...base, color };
}

/* ── Rig weapon art ───────────────────────────────────────────────────
 * Which of the 54 weapon attachments in `plecoRigData.json` a fighter's
 * gun CLASS is visually carried as — the pleco_rampage grip mount, pinned
 * forward on the hand bone (the body is the only aiming device there too).
 * A defender with `weapon: 'smg'` fires minigun ballistics and HOLDS the
 * minigun. Unknown classes fall back through pistol, and a class with no
 * art entry simply carries nothing (setWeapon tolerates unknown ids). */
export const RIG_WEAPON_ART = {
  pistol: 'pistol',
  smg: 'minigun',
  shotgun: 'shotgun',
  rifle: 'rifle',
  cannon: 'cannon',
  sniper: 'railgun',
  // The melee class carries NOTHING: the arm and fist are painted into every
  // skin's body art and the hand bone is parked on that fist (`handBySkin`), so
  // a bare-handed pleco already is the picture — no knuckle sprite to paste on.
  fist: null,
  // The weird six carry their own sprite — the class and the gun are one idea
  // each here, so the picture a pleco holds IS the behaviour it fires.
  stinger: 'jellyburst',
  phase: 'blinklance',
  fractal: 'fractalfang',
  sonar: 'sonarchime',
  well: 'mawengine',
  hover: 'foambell'
};

/** The rig weapon-art id a gun class is carried as, or null for none. */
export function rigWeaponArt(type) {
  return RIG_WEAPON_ART[type] ?? null;
}

const TIER_DEFAULT = {
  tier: 1,
  damage: 9,
  range: 130,
  fireRate: 1.0,
  element: '',
  abilityCooldown: 8,
  weapon: 'pistol',
  reloadMul: 1,
  perk: 'steadyHands'
};

/** Row shape (see file header). Ordered to match SKINS in
 *  `pleco_rampage/src/config/Skins.js` so a diff between the two files
 *  reads cleanly. Any skin not listed falls back to TIER_DEFAULT via
 *  `statsFor()` below. */
// 2026-10-12 strength pass: every row damage +15% (and defender HP +10% in plecoCodex.js)
// in plecoCodex.js) -- plecos were losing trades against wave scaling.
export const PLECO_DEFENSE_STATS = {
  // Tier 1 — early-game bread and butter (pistol). The cleaner is all
  // quick little hands; the cow is the roster's first TANK — it charges
  // what it can reach and swats it with whatever blade the Armory offers.
  cleaner:        { tier: 1, damage: 10, hp: 560, range: 110, fireRate: 1.4, element: '',       abilityCooldown: 6,  weapon: 'pistol',  reloadMul: 0.75, perk: 'secondWind', plecoClass: 'gunner' },
  zebra_pleco:    { tier: 1, damage: 9,  range: 130, fireRate: 1.1, element: '',       abilityCooldown: 10, weapon: 'pistol',  reloadMul: 0.9,  perk: 'steadyHands', plecoClass: 'gunner' },
  cow_pleco:      { tier: 1, damage: 16, range: 100, fireRate: 0.9, element: '',       abilityCooldown: 5,  weapon: 'fist',    reloadMul: 1.05, perk: 'killReload', plecoClass: 'tank' },

  // Tier 2 — first unlock spikes (smg / pistol variants).
  golden_pleco:        { tier: 2, damage: 16, range: 140, fireRate: 1.1, element: '',  abilityCooldown: 12, weapon: 'smg',     reloadMul: 0.9,  perk: 'triggerDiscipline', plecoClass: 'gunner' },
  ghost_pleco:         { tier: 2, damage: 14, range: 160, fireRate: 1.0, element: 'ice', abilityCooldown: 10, weapon: 'smg',   reloadMul: 0.85, perk: 'secondWind', plecoClass: 'gunner' },
  royal_pleco:         { tier: 2, damage: 18, range: 130, fireRate: 1.0, element: '',  abilityCooldown: 14, weapon: 'pistol',  reloadMul: 1.0,  perk: 'triggerDiscipline', plecoClass: 'gunner' },
  tiger_pleco:         { tier: 2, damage: 21, range: 120, fireRate: 1.2, element: '',  abilityCooldown: 9,  weapon: 'smg',     reloadMul: 0.8,  perk: 'secondWind', plecoClass: 'gunner' },
  blue_phantom_pleco:  { tier: 2, damage: 17, range: 150, fireRate: 1.1, element: '',  abilityCooldown: 12, weapon: 'smg',     reloadMul: 0.85, perk: 'steadyHands', plecoClass: 'gunner' },

  // Tier 3 — element carriers (shotgun / rifle variants).
  lava_pleco:     { tier: 3, damage: 28, range: 150, fireRate: 1.0, element: 'fire',   abilityCooldown: 8,  weapon: 'shotgun', reloadMul: 0.95, perk: 'triggerDiscipline', plecoClass: 'gunner' },
  cosmic_pleco:   { tier: 3, damage: 30, range: 180, fireRate: 0.9, element: '',       abilityCooldown: 14, weapon: 'rifle',   reloadMul: 1.1,  perk: 'steadyHands', plecoClass: 'sniper' },
  diamond_pleco:  { tier: 3, damage: 25, range: 150, fireRate: 1.2, element: '',       abilityCooldown: 10, weapon: 'smg',     reloadMul: 0.9,  perk: 'secondWind', plecoClass: 'gunner' },
  phoenix_pleco:  { tier: 3, damage: 41, range: 160, fireRate: 0.8, element: 'fire',   abilityCooldown: 10, weapon: 'shotgun', reloadMul: 1.0,  perk: 'triggerDiscipline', plecoClass: 'gunner' },
  void_pleco:     { tier: 3, damage: 46, hp: 840, range: 140, fireRate: 0.7, element: '',       abilityCooldown: 12, weapon: 'fist',    reloadMul: 1.15, perk: 'killReload', plecoClass: 'sage', abilityPowerMul: 1.9 },

  // Tier 4 — mid-run power picks (rifle / cannon variants).
  bounty_pleco:   { tier: 4, damage: 46, range: 170, fireRate: 1.0, element: '',       abilityCooldown: 12, weapon: 'rifle',   reloadMul: 0.95, perk: 'triggerDiscipline', plecoClass: 'sniper' },
  apex_pleco:     { tier: 4, damage: 53, range: 180, fireRate: 1.1, element: '',       abilityCooldown: 10, weapon: 'rifle',   reloadMul: 0.9,  perk: 'steadyHands', plecoClass: 'gunner' },
  toxic_pleco:    { tier: 4, damage: 39, range: 200, fireRate: 1.0, element: 'poison', abilityCooldown: 10, weapon: 'shotgun', reloadMul: 1.0,  perk: 'secondWind', plecoClass: 'gunner' },
  glacier_pleco:  { tier: 4, damage: 41, range: 180, fireRate: 0.9, element: 'ice',    abilityCooldown: 14, weapon: 'cannon',  reloadMul: 1.1,  perk: 'steadyHands', plecoClass: 'gunner' },
  storm_pleco:    { tier: 4, damage: 51, range: 190, fireRate: 1.0, element: 'shock',  abilityCooldown: 10, weapon: 'rifle',   reloadMul: 0.95, perk: 'triggerDiscipline', plecoClass: 'gunner' },
  spartan_pleco:  { tier: 4, damage: 92, hp: 980, range: 100, fireRate: 1.0, element: '',       abilityCooldown: 11, weapon: 'fist',    reloadMul: 0.9,  perk: 'triggerDiscipline', plecoClass: 'sage', abilityPowerMul: 2.0 },

  // Tier 5 — endgame (cannon / rifle / smg variants, plus the sages).
  coral_pleco:    { tier: 5, damage: 63, range: 200, fireRate: 1.0, element: '',       abilityCooldown: 14, weapon: 'cannon',  reloadMul: 1.0,  perk: 'killReload', plecoClass: 'gunner' },
  jade_pleco:     { tier: 5, damage: 69, range: 190, fireRate: 1.1, element: '',       abilityCooldown: 12, weapon: 'rifle',   reloadMul: 0.95, perk: 'steadyHands', plecoClass: 'gunner' },
  rust_pleco:     { tier: 5, damage: 92, hp: 1120, range: 180, fireRate: 1.2, element: '',       abilityCooldown: 15, weapon: 'fist',    reloadMul: 0.9,  perk: 'triggerDiscipline', plecoClass: 'sage', abilityPowerMul: 1.8 },
  neon_pleco:     { tier: 5, damage: 71, range: 210, fireRate: 1.1, element: 'shock',  abilityCooldown: 12, weapon: 'sniper',  reloadMul: 1.0,  perk: 'steadyHands', plecoClass: 'sniper' },
  /* ── The SAGES ───────────────────────────────────────────────────────────
   * Ten plecos carry nothing. Three because their art is not a pleco at all
   * (`ODD_SHAPE_SKINS`): bone's sparse skeleton, venom's elongated serpent,
   * chrome's boxy metal slab. Five more because they DO have a pleco body but
   * ship their own mesh, at their own size, with the arm somewhere the rig's
   * single shared `hand` bone was never authored for (`NO_GUN_MOUNT_SKINS`):
   * spartan, rust, solar, abyss and prism, each measured against the reference
   * in `pleco/config/skins.js`. Jade and titan ship their own mesh too, but the
   * same measurement puts their fist under the jaw already, so they keep their
   * guns. Void and plague are plain canonized plecos turned casters by design,
   * refused a rack by their class alone. The trade every row here makes: no
   * gun, so bare hands plus the signature ability, an `abilityPowerMul` on the
   * cast, and `hp` 40% over the tier formula so the pleco that walks into range
   * and stays there is worth its slot. */
  bone_pleco:     { tier: 5, damage: 83, hp: 1120, range: 120, fireRate: 1.0, element: '',       abilityCooldown: 14, weapon: 'fist',    reloadMul: 1.1,  perk: 'killReload', plecoClass: 'sage', abilityPowerMul: 1.9 },
  plague_pleco:   { tier: 5, damage: 76, hp: 1120, range: 180, fireRate: 1.0, element: 'poison', abilityCooldown: 8,  weapon: 'fist',    reloadMul: 1.05, perk: 'secondWind', plecoClass: 'sage', abilityPowerMul: 1.8 },
  solar_pleco:    { tier: 5, damage: 100, hp: 1120, range: 190, fireRate: 1.0, element: 'fire',   abilityCooldown: 9,  weapon: 'fist',    reloadMul: 1.1,  perk: 'triggerDiscipline', plecoClass: 'sage', abilityPowerMul: 2.0 },
  abyss_pleco:    { tier: 5, damage: 94, hp: 1120, range: 170, fireRate: 0.9, element: '',       abilityCooldown: 12, weapon: 'fist',    reloadMul: 1.15, perk: 'secondWind', plecoClass: 'sage', abilityPowerMul: 2.0 },
  prism_pleco:    { tier: 5, damage: 96, hp: 1120, range: 220, fireRate: 1.0, element: '',       abilityCooldown: 15, weapon: 'fist',    reloadMul: 1.0,  perk: 'triggerDiscipline', plecoClass: 'sage', abilityPowerMul: 1.9 },
  titan_pleco:    { tier: 5, damage: 104, range: 130, fireRate: 0.7, element: '',       abilityCooldown: 20, weapon: 'fist',    reloadMul: 1.3,  perk: 'secondWind', plecoClass: 'tank' },
  venom_pleco:    { tier: 5, damage: 90, hp: 1120, range: 210, fireRate: 1.0, element: 'poison', abilityCooldown: 14, weapon: 'fist',    reloadMul: 1.05, perk: 'triggerDiscipline', plecoClass: 'sage', abilityPowerMul: 1.9 },
  chrome_pleco:   { tier: 5, damage: 98, hp: 1120, range: 200, fireRate: 0.9, element: '',       abilityCooldown: 16, weapon: 'fist',    reloadMul: 1.25, perk: 'killReload', plecoClass: 'sage', abilityPowerMul: 2.0 }
};

/* ── Level-scaling curves (LV 1→100) ──────────────────────────────────────
 * Each level grants a small linear increment on every combat stat so the
 * ladder stays meaningful deep into the run without exploding. The numbers
 * below are per-level multipliers applied as:
 *   stat × (1 + (level - 1) × PER_LEVEL_CONSTANT)
 * so level 100 = ×(1 + 99 × C). Caps are enforced by MAX_LEVEL; the fighter
 * clamps both on deploy and on every in-run meal level-up.
 *
 *   LEVEL_DAMAGE_PER_LEVEL   +5.0 % damage  →  5.95× at LV 100
 *   LEVEL_HP_PER_LEVEL       +2.0 % max HP  →  2.98× at LV 100
 *   LEVEL_SPEED_PER_LEVEL    +0.8 % move    →  1.79× at LV 100
 *   LEVEL_BOLT_SPEED_PER_LEVEL +0.6 % bullet →  1.59× at LV 100
 *   LEVEL_RELOAD_PER_LEVEL   −0.5 % reload →  −49.5 % at LV 100 (floor 30 %)
 *   LEVEL_CRIT_PER_LEVEL     +0.2 % crit   →  +19.8 % at LV 100
 * Reload floor prevents any weapon from becoming instantaneous. */
export const LEVEL_DAMAGE_PER_LEVEL = 0.05;
export const LEVEL_HP_PER_LEVEL = 0.02;
export const LEVEL_SPEED_PER_LEVEL = 0.008;
export const LEVEL_BOLT_SPEED_PER_LEVEL = 0.006;
export const LEVEL_RELOAD_PER_LEVEL = 0.005;
export const LEVEL_RELOAD_FLOOR = 0.30;
export const LEVEL_CRIT_PER_LEVEL = 0.002;
/** Top of the training ladder — also used as PLECO_MAX_LEVEL in plecoSaveSchema. */
export const MAX_LEVEL = 100;

/* ── In-run XP economy (the counter that replaced the free per-meal level) ─
 * A defender no longer climbs a combat level the instant it nips a pellet. Both
 * meals AND enemy kills now pay into ONE run-scoped XP bar, and a level is only
 * claimed when a full `PLECO_XP_PER_LEVEL` has accumulated. Because a single
 * normal enemy is worth well under a full bar, raising a pleco's level off
 * combat alone takes several kills — while a meal is a bigger chunk (and better
 * food a bigger chunk still), so feeding stays the fast path but runs through
 * the SAME counter. Everything here is run-scoped: the fighter forgets its XP
 * when the run ends and re-deploys at the level paid for in the Book of Plecos.
 * The climb still stops at `levelCap` — the ascension wall gates XP just as it
 * gated the old meal ladder (see plecoAscension.js). */
export const PLECO_XP_PER_LEVEL = 100;      // XP that buys one combat level
export const PLECO_XP_PER_KILL = 25;        // a normal enemy — 4 kills fill the bar
export const PLECO_XP_PER_BOSS_KILL = 100;  // a boss is worth a whole bar
/** XP a dropped pellet pays, scaled by how good it is (quality tier 0..3). A
 *  plain flake is a little under a bar (so no single bite is a guaranteed
 *  level-up any more); premium food more than fills one — food "gains more exp"
 *  than a kill by design. */
export function plecoMealXp(quality = 0) {
  return 40 + Math.max(0, quality | 0) * 30;
}

/* ── Ability upgrade ladder ────────────────────────────────────────────
 * Each skin's signature move upgrades LV 1→5 (the level lives in the save —
 * `plecoSaveSchema.abilityLevels` — and the fighter applies the numbers at
 * deploy). The headline buy is FAST RELOAD: every level runs the gun's
 * reload clock 8% faster (floored at 60% of base), on top of a 6%-per-level
 * cooldown trim (floored at 40%) and +10% ability damage per level. From
 * level 3 the cast also racks a fresh magazine — the move pays for the gun. */
export const ABILITY_MAX_LEVEL = 5;
export const ABILITY_RELOAD_PER_LEVEL = 0.08;
export const ABILITY_RELOAD_FLOOR = 0.60;
export const ABILITY_COOLDOWN_PER_LEVEL = 0.06;
export const ABILITY_COOLDOWN_FLOOR = 0.40;
export const ABILITY_DAMAGE_PER_LEVEL = 0.10;
export const ABILITY_REFILL_LEVEL = 3;

/** Look up the stat block for a given skin id, throwing on unknown so a
 *  typo in `PLECO_UNLOCK_ORDER` or a card config fails loudly at load
 *  rather than silently producing a zero-damage defender. */
export function statsFor(skinId) {
  const row = PLECO_DEFENSE_STATS[skinId];
  if (!row) throw new Error(`plecoDefenseStats: no row for skin '${skinId}'`);
  return row;
}

/** Scale base damage by defender level (linear, +LEVEL_DAMAGE_PER_LEVEL per
 *  level above 1). Kept as a pure function so the GameScene integration and
 *  any future "shop preview" render use the same curve. */
export function scaledDamage(skinId, level) {
  const { damage } = statsFor(skinId);
  const lvl = Math.max(1, Math.min(MAX_LEVEL, level | 0));
  return Math.round(damage * (1 + (lvl - 1) * LEVEL_DAMAGE_PER_LEVEL));
}
