# Fish Aquarium expedition assets

All artwork copied from the existing Fish Aquarium game, without modifying source assets.

- hero.png: first 666x384 frame of public/assets/pleco/idle.webp, facing right. Hand grip approximately 70.6% x 82.8% of frame.
- enemy.png: first 313x234 frame of public/assets/sprites/enemy_piranha_sprite.webp, facing right.
- boss.png: first 466x222 frame of public/assets/sprites/enemy_boss_abyssal_sprite.webp, facing right.
- pistol, shotgun, minigun, railgun, launcher: original transparent 512px-wide images from public/assets/pleco_rig/weapons/.
- surface, coral, wreck, crystal, volcanic, abyss: original 1280x720 public/assets/backdrops/tank_classic, tank_coral, tank_ruins, tank_crystal, tank_volcanic, tank_abyss WebP images.
- wreck-overlay.webp: original public/assets/pirate/wreck_a.webp.

Hero, enemy, and boss are transparent atlas-frame extractions. Keep image smoothing disabled on the pixel-art characters if enlarged. Backgrounds and weapons can retain smoothing.

Animated expansion: manifest.encounters references untouched four-frame enemy and boss strips from public/assets/sprites/ (same frame count as AssetLoader ENEMY_SPRITES). Bosses: coral golem, phantom, glass ray, obsidian fish, abyssal angler. Ambient schools use astro_angelfish, disco_dory and frostfin_angelfish swim sheets and their exact C40_LAYOUTS counts (4, 5, 4) at 8 fps. No sheet is cropped or repainted.
