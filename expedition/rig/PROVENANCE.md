# Current Fish Aquarium skeletal hero

The runtime modules here are copied from `src/pleco/rig/` with only local import extensions changed from `.js` to `.mjs`. Body meshes, weighted skinning, procedural animation, armed stance, steady weapon mounts, grip occlusion and muzzle coordinates use the shipped implementation.

`plecoRigData.json` is the game's `src/pleco/data/plecoRigData.json`, retaining the original default/cleaner, neon, cosmic, lava, chrome, golden and blue-phantom skins, animations, bones and five website weapons. `art/` contains its original referenced PNG files. Each skin has its own cached Skeleton, AnimationState and SkelRenderer.

Class fidelity: neon and cosmic are snipers and carry railguns. Chrome is a sage and appears unarmed. Golden and blue phantom are gunners suitable for minigun/launcher chapters; lava is also a gunner.

Authoritative game path: `PlecoFighter` constructs `Skeleton`, `AnimationState` and `SkelRenderer`; its `drawBody` uses this rig during normal movement and armed combat. `muzzleWorld` uses `Skeleton.weaponPoint` with the weapon's actual muzzle pixel. Classic Pleco is the `cleaner` skin, which falls back to the default rig attachments.

The adapter's seekable timeline only sets the animation clock and outer website placement. No game files or quality settings were changed.

Advanced showcase weapons also retain exact game rows/art: snapperpistol, krakenshotgun, reefminigun, narwhalrail, clamcannon. Adapter returns the true held weapon anchor as weaponGripX/Y for equipment choreography. assets/intro-card.png is a native Canvas render of the unarmed cleaner rig, with transparent background, not alternative character artwork.
