/** Per-instance skeleton: bone pose state + world matrices + skin/weapon
 *  resolution. References a shared SkeletonData; holds only per-character
 *  state (§19 of the rig plan: many instances, one data set). */

/* Inlined deliberately: this file is imported by SkeletonRenderer.js, which the
 * standalone viewer pages inline with their module syntax stripped — an import
 * here would become an undefined identifier in the generated page. The value is
 * frozen and exported from SkeletonData.js, so there is exactly one identity. */
/* Inlined deliberately: this file is imported by SkelRenderer.js, which the
 * standalone viewer pages inline with their module syntax stripped — an import
 * here would become an undefined identifier in the generated page. So this is a
 * duck-typed stand-in for `SkeletonData.SLOT_EMPTY`, matched on its shape rather
 * than on object identity. The property name is the contract. */
function isSlotEmpty(att) {
  return Boolean(att) && att.slotEmpty === true;
}

const DEG = Math.PI / 180;

export class Skeleton {
  constructor(data, skinName = null) {
    this.data = data;
    const n = data.boneCount;
    this.localX = new Float32Array(n);
    this.localY = new Float32Array(n);
    this.localRot = new Float32Array(n); // radians
    this.localSX = new Float32Array(n);
    this.localSY = new Float32Array(n);
    /** World matrices, 6 floats per bone [a,b,c,d,tx,ty], parents first. */
    this.world = new Float32Array(n * 6);
    this.skinName = null;
    this.skin = null;
    this.weapon = null; // WeaponDef or null
    /** Grip transform for a STEADY weapon: the mount bone at the setup pose,
     *  refreshed by every `updateWorldTransform`. Read by SkelRenderer in place
     *  of the live bone matrix when `weapon.steady`. */
    this.weaponMount = new Float32Array(6);
    /** Whether `weaponMount` holds this frame's grip. Cleared whenever
     *  nothing steady is equipped, so a stale or never-computed matrix can
     *  never be mistaken for a mount (which would draw the gun at 0,0). */
    this.hasWeaponMount = false;
    /** Lean the armed stance last put on `body`; aimHand() cancels it. */
    this.stanceBodyRot = 0;
    /** Per-mesh skinned-vertex scratch, allocated lazily on first skinning. */
    this._meshScratch = new Map();
    if (skinName) this.setSkin(skinName);
    this.setToSetupPose();
  }

  setSkin(skinName) {
    const skin = this.data.getSkin(skinName);
    if (!skin) return false;
    this.skinName = skinName;
    this.skin = skin;
    return true;
  }

  /** Equips a weapon attachment (by id from rig weapon defs) on the mouth
   *  slot. Pass null to unequip. Unknown ids unequip rather than throw, so
   *  gameplay code never has to know which weapons have rig art — and
   *  `weapon` is always a WeaponDef or a clean null, never `undefined`. */
  setWeapon(weaponId) {
    this.weapon = (weaponId && this.data.getWeapon(weaponId)) || null;
  }

  setToSetupPose() {
    this.localX.set(this.data.setupX);
    this.localY.set(this.data.setupY);
    this.localRot.set(this.data.setupRot);
    this.localSX.fill(1);
    this.localSY.fill(1);
    // Per-skin hand offset is part of THIS skin's setup pose, not a one-off
    // tweak: AnimationState.apply() calls back into here every frame, so an
    // adjustment applied anywhere else is wiped before the first draw.
    const hand = this.data.handBySkin && this.data.handBySkin.get(this.skinName);
    if (hand) {
      this.localX[hand.boneIndex] += hand.dx;
      this.localY[hand.boneIndex] += hand.dy;
    }
  }

  /** Blends the combat-ready stance in on top of the current pose.
   *  `amount` 0 leaves the pose untouched (an unarmed pleco is a calm fish);
   *  1 is the full stance. Additive, so it composes with whatever clip is
   *  playing rather than replacing it.
   *
   *  Records how far it leaned `body`, because `hand` hangs off `body` and
   *  aiming has to cancel that — see aimHand(). */
  applyArmedStance(amount = 1) {
    this.stanceBodyRot = 0;
    if (!amount) return;
    const body = this.data.boneIndex('body');
    for (const s of this.data.armedStance) {
      this.localRot[s.boneIndex] += s.rot * amount;
      this.localX[s.boneIndex] += s.dx * amount;
      this.localY[s.boneIndex] += s.dy * amount;
      if (s.boneIndex === body) this.stanceBodyRot += s.rot * amount;
    }
  }

  /** Points the hand — and the weapon gripped in it — at `angle`, measured
   *  in the body's own space the way the aiming code means it.
   *
   *  The subtraction is the whole point. `hand` is a child of `body`, so the
   *  world rotation of the weapon is body + hand; writing the aim straight
   *  into localRot[hand] therefore adds the stance's lean to every shot's
   *  drawn angle. That defect is silent — bullets leave on the true
   *  aimAngle, so only the picture is off — and it grows with the stance:
   *  the mild 3-degree stance skewed weapons by 3 degrees, the combat stance
   *  would have skewed them by its full lean.
   *
   *  Only melee art follows it: a steady weapon is drawn on the setup-pose
   *  mount (see `_updateWeaponMount`), so aiming a gun means turning the
   *  pleco, not the wrist. */
  aimHand(angle) {
    const hand = this.data.boneIndex('hand');
    if (hand === undefined) return;
    this.localRot[hand] = angle - (this.stanceBodyRot || 0);
  }

  /** Recomputes world matrices from local pose. Bones are stored parents-
   *  before-children, so one forward pass suffices. `scale` uniformly scales
   *  the whole skeleton about the root (the game sizes plecos by radius). */
  updateWorldTransform(scale = 1) {
    const { boneParent, boneCount } = this.data;
    const w = this.world;
    for (let i = 0; i < boneCount; i++) {
      const rot = this.localRot[i];
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const sx = this.localSX[i];
      const sy = this.localSY[i];
      const a = cos * sx, b = sin * sx, c = -sin * sy, d = cos * sy;
      const tx = this.localX[i], ty = this.localY[i];
      const p = boneParent[i];
      const o = i * 6;
      if (p < 0) {
        w[o] = a * scale; w[o + 1] = b * scale; w[o + 2] = c * scale;
        w[o + 3] = d * scale; w[o + 4] = tx * scale; w[o + 5] = ty * scale;
      } else {
        const q = p * 6;
        w[o] = w[q] * a + w[q + 2] * b;
        w[o + 1] = w[q + 1] * a + w[q + 3] * b;
        w[o + 2] = w[q] * c + w[q + 2] * d;
        w[o + 3] = w[q + 1] * c + w[q + 3] * d;
        w[o + 4] = w[q] * tx + w[q + 2] * ty + w[q + 4];
        w[o + 5] = w[q + 1] * tx + w[q + 3] * ty + w[q + 5];
      }
    }
    this._updateWeaponMount(scale);
  }

  /** Where a pixel of the held weapon's sprite (`px`, `py`, sprite px) lands
   *  in skeleton space, composed EXACTLY as SkelRenderer._drawWeapon draws it:
   *  the steady mount for anything that fires (the live grip bone for melee,
   *  or when there is no mount), then the weapon's own rotation, scale and
   *  anchor. Reads the matrices of the last `updateWorldTransform`, so call
   *  that with the draw scale first. Returns null with no weapon held. */
  weaponPoint(px, py, out = { x: 0, y: 0 }) {
    const weapon = this.weapon;
    if (!weapon) return null;
    const bone = this.data.weaponBone;
    const mount = weapon.steady === false || !this.hasWeaponMount ? null : this.weaponMount;
    let ma, mb, mc, md, mx, my;
    if (mount) {
      ma = mount[0]; mb = mount[1]; mc = mount[2]; md = mount[3]; mx = mount[4]; my = mount[5];
    } else {
      if (bone === undefined) return null;
      const w = this.world, o = bone * 6;
      ma = w[o]; mb = w[o + 1]; mc = w[o + 2]; md = w[o + 3]; mx = w[o + 4]; my = w[o + 5];
    }
    const cos = Math.cos(weapon.rotation), sin = Math.sin(weapon.rotation), s = weapon.scale;
    // Weapon-local point: R·S·(p − anchor), then into the mount's frame.
    const dx = px - weapon.anchorX, dy = py - weapon.anchorY;
    const lx = (cos * dx - sin * dy) * s;
    const ly = (sin * dx + cos * dy) * s;
    out.x = ma * lx + mc * ly + mx;
    out.y = mb * lx + md * ly + my;
    return out;
  }

  /** Pins `weaponMount` to the grip bone's SETUP pose: the bind position, with
   *  no clip, stance, or procedural delta on the bone or on any ancestor.
   *
   *  Why a gun is nailed to the bind instead of welded to the fist: the `punch`
   *  clip swings `hand` -55 degrees into its wind-up and +20 through the
   *  follow-through, and `PlecoFighter` plays that clip as the recoil beat of
   *  every gunshot. A sword moving through it is the animation doing its job; a
   *  gun riding it is a pleco batting enemies with a rifle. Melee art never
   *  comes through here — it keeps following the live bone.
   *
   *  Aiming survives the freeze because a pleco aims by TURNING: the entity
   *  mirror and heading tilt are applied by the caller around the whole draw,
   *  mount included. `aimHand` is the exception — it steers the live bone, so
   *  henceforth it moves melee art only. */
  _updateWeaponMount(scale) {
    const data = this.data;
    const bone = data.weaponBone;
    const m = this.weaponMount;
    this.hasWeaponMount = false;
    if (bone === undefined || !this.weapon || this.weapon.steady === false) return;
    const p = data.boneParent[bone];
    let a, b, c, d, px, py;
    if (p < 0) {
      a = 1; b = 0; c = 0; d = 1; px = 0; py = 0;
    } else {
      const sw = data.setupWorld;
      const q = p * 6;
      a = sw[q]; b = sw[q + 1]; c = sw[q + 2]; d = sw[q + 3]; px = sw[q + 4]; py = sw[q + 5];
    }
    const rot = data.setupRot[bone];
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    // The same per-skin grip offset `setToSetupPose` applies, or the mount
    // drifts off the fist on every skin whose grip was corrected.
    const hand = data.handBySkin && data.handBySkin.get(this.skinName);
    const lx = data.setupX[bone] + (hand ? hand.dx : 0);
    const ly = data.setupY[bone] + (hand ? hand.dy : 0);
    const la = cos, lb = sin, lc = -sin, ld = cos;
    // A uniform scale about the root multiplies a composed matrix on all six
    // channels — which is exactly what `updateWorldTransform` does live.
    m[0] = (a * la + c * lb) * scale;
    m[1] = (b * la + d * lb) * scale;
    m[2] = (a * lc + c * ld) * scale;
    m[3] = (b * lc + d * ld) * scale;
    m[4] = (a * lx + c * ly + px) * scale;
    m[5] = (b * lx + d * ly + py) * scale;
    this.hasWeaponMount = true;
  }

  /** World position of a bone (after updateWorldTransform). */
  boneWorldPosition(boneIndex, out) {
    const o = boneIndex * 6;
    out.x = this.world[o + 4];
    out.y = this.world[o + 5];
    return out;
  }

  /** Resolves the attachment currently shown for a slot: current skin first,
   *  falling back to the 'default' skin (lets variant skins override only
   *  some parts). */
  getAttachment(slot) {
    // A skin is Map<slotName, Attachment> holding only Attachment instances
    // (SkeletonData), never a falsy stand-in, so a truthy get() answers the
    // same question as has()+get() in one lookup instead of two.
    if (this.skin) {
      const att = this.skin.get(slot.attachmentName);
      // SLOT_EMPTY is the row's declared "nothing on this slot", and it has to
      // short-circuit the fallback — otherwise a skin that opted out of a slot
      // silently gets the reference pleco's art drawn on it.
      if (isSlotEmpty(att)) return null;
      if (att) return att;
    }
    const fallback = this.data.getSkin('default');
    if (fallback) {
      const att = fallback.get(slot.attachmentName);
      if (att && !isSlotEmpty(att)) return att;
    }
    return null;
  }

  /** Skins a mesh into a reused Float32Array of [x,y,...] world positions.
   *  vertexWorld = Σ wᵢ · (worldBoneᵢ · bindInverseᵢ) · vertexBind */
  skinMesh(mesh) {
    let out = this._meshScratch.get(mesh);
    if (!out || out.length !== mesh.vertices.length) {
      out = new Float32Array(mesh.vertices.length);
      this._meshScratch.set(mesh, out);
    }
    const w = this.world;
    const bi = this.data.bindInverse;
    const verts = mesh.vertices;
    const wIdx = mesh.weightBoneIdx;
    const wVal = mesh.weightValues;
    const wCount = mesh.weightCount;
    let wp = 0;
    for (let v = 0; v < mesh.vertexCount; v++) {
      const px = verts[v * 2];
      const py = verts[v * 2 + 1];
      let x = 0, y = 0;
      const count = wCount[v];
      for (let k = 0; k < count; k++) {
        const weight = wVal[wp];
        const boneIndex = mesh.bones[wIdx[wp]];
        wp++;
        const o = boneIndex * 6;
        // bind-space position: bindInverse · bindPos
        const ia = bi[o], ib = bi[o + 1], ic = bi[o + 2];
        const id = bi[o + 3], itx = bi[o + 4], ity = bi[o + 5];
        const bx = ia * px + ic * py + itx;
        const by = ib * px + id * py + ity;
        x += weight * (w[o] * bx + w[o + 2] * by + w[o + 4]);
        y += weight * (w[o + 1] * bx + w[o + 3] * by + w[o + 5]);
      }
      out[v * 2] = x;
      out[v * 2 + 1] = y;
    }
    return out;
  }
}
