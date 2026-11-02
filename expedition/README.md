# Scroll expedition

This independent marketing experience uses authentic Fish Aquarium art. It does not load or change the game simulation, saves, economy, quality ladder, or renderer.

Native page scroll scrubs a deterministic six-world timeline. Reverse scrolling and scrollbar jumps reconstruct combat from progress instead of replaying side effects. Keyboard scrolling and chapter anchors remain native. Reduced-motion devices receive restrained, scroll-position-based scenes.

Run locally from the parent womp-studio directory with `python -m http.server 4173` and visit `/expedition/`.

Run the asset and reversible timeline checks with `node --test expedition/verify.cjs` from the parent directory.

The original studio page is retained as `/studio.html` when this expedition becomes the homepage. No game behavior changes are made, so GAME_GUIDE.md does not require changes.

## Combat correction

The hero now uses the current game skeletal runtime and `pleco_rig/cleaner` mesh, rather than legacy pleco sprite strips. Downward scroll queues visible bursts. Pooled projectiles follow the seekable scroll clock, hit four varied enemies, lower health, and produce recoil, muzzle flashes, hit sparks, deaths and kill count. The exact rig muzzle is the firing origin. Five weapons appear across six regions.

Run `node --test expedition/verify.cjs expedition/combat.test.mjs` from the parent directory. Game source and behavior are unchanged.

## Scroll-scrub combat

The expedition now uses a seekable combat clock. Downward scrolling advances shots, projectiles and impacts; upward scrolling restores prior bullets, enemy health, deaths and kills; stopping freezes combat. The native scrollbar and accessible depth slider both seek the same timeline. Projectile appearance, motion profiles, weapon spread, speed, pellet count and reload data come from the current game; only random seeds are fixed to make replay reversible. Website encounter staging remains a presentation sequence, independent of game saves and simulation.

## Moving squad and encounter roster

Five distinct lead plecos across six worlds use class-compatible guns, accompanied by two smaller rigged squadmates. Seven rig skins are available. All creature movement follows scroll time: lead swimming paths, banking, dives, enemy entrances/charges, boss arrivals, friendly fish schools, and sprite animation. Shared choreography supplies both bullet collision simulation and visible actor positions. Each world uses authentic animated enemies and boss sheets. HUD identifies the current pleco and boss with boss health. Rewinding restores moving poses as well as combat. Native Canvas raster checks cover six worlds and landscape 844x390/568x320; no browser automation or game changes.

## Card-to-ocean opening and advanced arsenal

The first chapter is a longer, fully reversible sequence: collectible card, flip/reveal, unarmed pleco entering the water, splash crown/droplets/rings, visible weapon pickup into the rig grip, inbound enemy battle, and descent. Combat is gated until equipment completes. Intro scene time maps to the same canonical projectile simulation; moving enemy positions and shot origins stay synchronized. The weapon roster now uses Snapper Pistol, Kraken Shotgun, Reef Minigun, Narwhal Rail, and Clam Cannon, with original game fitting metadata, silhouettes, and class motion. All effects remain scroll-driven and freeze at rest. Original game files remain unchanged.

## Surface, melee and fighter handoffs

The opening now separates sky and water with a cached sky painting, distant shoreline, wave lip and surface reflections. The surface rises out of view as the pleco dives; ambient fish and bubbles stay below it. Every encounter has a ranged assault, a scroll-length tactical pause, a brawler handoff, authentic bite and punch attacks, another recovery/rearm pause, final assault, and descent. Cow and Classic Plecos use the actual game bite/punch sheets, including frame holds and unit scales. Melee hits reduce enemy health and rewind on the same cached combat clock. No guns fire during the melee interlude, and pause spans hold combat time. Longer sections, fighter portraits and a battle-phase HUD make the sequence readable. No game behavior or quality-system files changed.

## Studio polish and continuous motion

The shell uses a coherent ocean/pearl visual system, readable editorial typography, a restrained HUD, responsive collectible cards, accessible chapter navigation and a light studio finale. A bounded, frame-rate-independent scroll driver smooths pointer/touch scrolling and settles exactly; keyboard, range and anchor navigation use direct seeking. The render loop stops after settling and the complete scene remains reversible. Reduced motion bypasses scroll lag and decorative movement.

World changes now follow a continuous downward journey: the hero exits below the frame, the next fighter enters from above, and the next backdrop blends during descent. Enemy approaches ease into melee and retreat offscreen before looping. Fighter swaps have eased entrances/exits, genuine armed portraits and a continuous crossing path. Existing bullets complete their canonical paths across pauses; companions join with a short fade. The water surface uses baked sky/island art and narrow animated reflections.

Backdrops, wreck overlay and readability tint are composited once per resize/load, eliminating the recurring full-screen tint pass. `rig.measure()` computes the exact same muzzle and grip as `rig.draw()` without rasterizing hidden geometry during trajectory compilation. The canonical game runtime and projectile source files remain unchanged.

Validation: `node --test expedition/verify.cjs expedition/combat.test.mjs expedition/scroll-driver.test.mjs expedition/choreography.test.mjs`. Native Canvas raster checks verify settled-frame equality, rewind equality, six worlds and small landscape surfaces. These checks do not render the HTML/CSS in a browser; browser automation remains disabled per repository instructions. Deployment is separate from the local preview.
