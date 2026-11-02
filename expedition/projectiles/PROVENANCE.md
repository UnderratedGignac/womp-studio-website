# Canonical Fish Aquarium projectile lane

- `projectileMotion.mjs` is the exact `src/effects/projectileMotion.js`, with its one import redirected to the exact copied `src/utils/math.js` (`math.mjs`).
- `gunRoundBodies.mjs` is the exact `src/armory/gunRoundBodies.js`. The current game's bridge tries these unique per-gun path silhouettes before shared raster projectile artwork. Therefore no substitute raster body is used for these five weapons.
- `profiles.json` and `profiles.mjs` mechanically extract `WEAPON_CONFIGS` from `src/pleco/config/plecoDefenseStats.js` and `GUN_PROJECTILES` from `src/armory/gunProjectile.js`. `gunCatalog.gunClass` maps pistol→pistol, shotgun→shotgun, minigun→smg, railgun→sniper, launcher→cannon. Motion names come from `PlecoAbilityBridge.GUN_CLASS_MOTION`.
- The normal, unupgraded Classic Pleco has base fireRate 1.4 and reloadMul .75. Class fireRateMul, burstSize and reloadTime are retained exactly. Temporary buffs, crit rolls, leveling and upgrades are outside the website showcase.
- `index.mjs` isolates the five weapons' exact bridge movement order: decrement life, expire, SMG wobble, canonical water physics, locked-target homing (16 rad/s), position integration. Shotgun lifetime .6s, others 2s. Shotgun/cannon never home. Spread is independent uniform [-spread,+spread] per pellet. A seeded source replaces Math.random solely for reversible replay.
- Swept contacts use the copied `sweptHit(b, previousX, previousY, enemies, b.size*.5)` helper, as the game does. Wall ricochet is available via copied bounceWalls for callers with a physical tank bounds rectangle.

All motion values are game world units per second. Website presentation should scale the whole world consistently rather than altering projectile speed or substituting Bezier trajectories.

Advanced loadout profiles are also mechanically extracted for snapperpistol (pistol), krakenshotgun (shotgun), reefminigun (smg), narwhalrail (sniper), clamcannon (cannon). Their distinct per-gun body and appearance use the same unmodified game round renderer. Legacy profile ids remain available.
