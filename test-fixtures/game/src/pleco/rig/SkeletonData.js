/** Shared, immutable skeletal data parsed from rig JSON.
 *
 * One SkeletonData per rigged species; every on-screen instance owns a
 * Skeleton + AnimationState that reference it. The format mirrors the
 * Spine/DragonBones architecture the project plan (docs/SKELETAL_RIG_PLAN.md)
 * adopts: bones, slots, skins, region/mesh attachments, animation timelines.
 *
 * Rig JSON shape (produced by tools/build_pleco_rig.py):
 * {
 *   bindWidth, bindHeight,           // canonical body extent the rig was authored against
 *   bones: [{name, parent, x, y, rotation?}],        // parents before children
 *   slots: [{name, bone, attachment?}],              // draw order
 *   skins: { <skin>: { <slot>: attachmentDef } },
 *   weapons: { <id>: weaponDef },
 *   animations: { <name>: {duration, loop, timelines:[{bone, channel, keys, ease?}] } },
 *   procedural: {...}                // secondary-motion config (tail wave, fin flutter)
 * }
 *
 * attachmentDef:
 *   region: {type:'region', image, width, height, x?, y?, rotation?}
 *   mesh:   {type:'mesh', image, width, height,
 *            vertices:[x,y,...] (bind pose, skeleton space),
 *            uvs:[u,v,...] (0..1), triangles:[i,j,k,...],
 *            bones:[boneName,...], weights:[[boneArrIdx, w], ...] per vertex}
 */

import {
  isSteadyRigWeapon, heldWeaponBox, HELD_WEAPON_SCALE, WEAPON_SLOT_FRONT, WEAPON_SLOT_BACK,
} from './rigWeaponModel.js';

/** Marker a rig row stores when it says `null` for a slot: "this skin paints
 *  nothing here". It has to be a value rather than an absent key, because
 *  `Skeleton.getAttachment` falls back to the `default` skin for any slot the
 *  current skin does not carry — so omitting a slot would silently put the
 *  reference pleco's art on this one. `spartan_pleco` uses it on `dorsal`: its
 *  helmet crest is already part of its own `body` mesh, and the default's
 *  dorsal crop drawn a second copy of it across the fish's back. */
export const SLOT_EMPTY = Object.freeze({ slotEmpty: true });

const DEG = Math.PI / 180;

export const EASE_LINEAR = 0;
export const EASE_SINE_IN_OUT = 1;
export const EASE_SINE_IN = 2;
export const EASE_SINE_OUT = 3;

const EASE_BY_NAME = {
  linear: EASE_LINEAR,
  sine: EASE_SINE_IN_OUT,
  sineIn: EASE_SINE_IN,
  sineOut: EASE_SINE_OUT
};

/** Inverts a 2D affine matrix [a,b,c,d,tx,ty] (canvas column convention:
 *  x' = a*x + c*y + tx, y' = b*x + d*y + ty). */
export function invertMatrix(a, b, c, d, tx, ty, out) {
  const det = a * d - c * b;
  if (Math.abs(det) < 1e-12) {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 1; out[4] = 0; out[5] = 0;
    return out;
  }
  const inv = 1 / det;
  const ia = d * inv;
  const ib = -b * inv;
  const ic = -c * inv;
  const id = a * inv;
  out[0] = ia;
  out[1] = ib;
  out[2] = ic;
  out[3] = id;
  out[4] = -(ia * tx + ic * ty);
  out[5] = -(ib * tx + id * ty);
  return out;
}

class Timeline {
  constructor(boneIndex, channel, keys, ease) {
    this.boneIndex = boneIndex;
    this.channel = channel; // 'rotate' | 'translate' | 'scale'
    this.times = keys.times;
    this.valuesA = keys.valuesA; // rotate: deg; translate: dx; scale: sx
    this.valuesB = keys.valuesB; // translate: dy; scale: sy (null for rotate)
    this.ease = ease;
  }
}

class Animation {
  constructor(name, def, boneIndexByName) {
    this.name = name;
    this.duration = def.duration;
    this.loop = def.loop !== false;
    // Optional procedural-wave clamp while this anim plays as an override
    // (hurt stiffens the tail); null leaves the wave untouched.
    this.waveScale = def.waveScale ?? null;
    this.timelines = [];
    // A bone+channel animated twice in one clip: last timeline wins (Spine
    // semantics) — keeps apply() from double-accumulating the delta.
    const seen = new Map();
    for (const tl of def.timelines || []) {
      const boneIndex = boneIndexByName.get(tl.bone);
      if (boneIndex === undefined) continue;
      const keys = { times: Float32Array.from(tl.keys.map(k => k.t)) };
      if (tl.channel === 'rotate') {
        keys.valuesA = Float32Array.from(tl.keys.map(k => k.v ?? 0));
        keys.valuesB = null;
      } else if (tl.channel === 'translate') {
        keys.valuesA = Float32Array.from(tl.keys.map(k => k.dx ?? 0));
        keys.valuesB = Float32Array.from(tl.keys.map(k => k.dy ?? 0));
      } else if (tl.channel === 'scale') {
        keys.valuesA = Float32Array.from(tl.keys.map(k => k.sx ?? 1));
        keys.valuesB = Float32Array.from(tl.keys.map(k => k.sy ?? k.sx ?? 1));
      } else {
        continue;
      }
      const ease = Uint8Array.from(tl.keys.map(k => EASE_BY_NAME[k.ease] ?? EASE_LINEAR));
      const timeline = new Timeline(boneIndex, tl.channel, keys, ease);
      const key = boneIndex + ':' + tl.channel;
      if (seen.has(key)) this.timelines[seen.get(key)] = timeline;
      else {
        seen.set(key, this.timelines.length);
        this.timelines.push(timeline);
      }
    }
  }
}

class Attachment {
  constructor(def, boneIndexByName) {
    this.type = def.type;
    this.image = def.image;
    this.width = def.width;
    this.height = def.height;
    if (def.type === 'region') {
      this.x = def.x ?? 0;
      this.y = def.y ?? 0;
      this.rotation = (def.rotation ?? 0) * DEG;
    } else if (def.type === 'mesh') {
      this.vertices = Float32Array.from(def.vertices);
      this.uvs = Float32Array.from(def.uvs);
      this.triangles = Uint16Array.from(def.triangles);
      this.bones = (def.bones || []).map(n => boneIndexByName.get(n));
      // per vertex: index into this.bones + weight, flattened pairs
      this.weightCount = new Uint8Array(def.vertices.length / 2);
      const idx = [];
      const val = [];
      for (let v = 0; v < def.weights.length; v++) {
        const ws = def.weights[v];
        this.weightCount[v] = ws.length;
        for (const [bi, w] of ws) {
          idx.push(bi);
          val.push(w);
        }
      }
      this.weightBoneIdx = Uint8Array.from(idx);
      this.weightValues = Float32Array.from(val);
      this.vertexCount = this.vertices.length / 2;
    } else if (def.uvs) {
      // typeless skin override carrying its own uv layout: crops are cut
      // per skin and clamping at the frame edge makes each skin's true
      // uv mapping differ, so overrides may replace the default's uvs
      this.uvs = Float32Array.from(def.uvs);
    }
  }
}

class WeaponDef {
  constructor(id, def) {
    this.id = id;
    this.image = def.image;
    this.width = def.width;
    this.height = def.height;
    this.anchorX = def.anchorX ?? def.width / 2;
    this.anchorY = def.anchorY ?? def.height / 2;
    this.rotation = (def.angle ?? 0) * DEG;
    /* The barrel tip in sprite px — where a shot leaves the gun (measured by
       tools/fit_held_weapons.mjs). A row without one fires from the sprite's
       front edge at grip height. */
    this.muzzleX = def.muzzleX ?? def.width;
    this.muzzleY = def.muzzleY ?? this.anchorY;
    /* The authored size is the sprite's own aspect; `HELD_WEAPON_SCALE` is how
       big a held weapon reads next to a pleco, and it applies to every row at
       once so the catalogue keeps its ratios (see rigWeaponModel.js). */
    this.scale = (def.scale ?? 1) * HELD_WEAPON_SCALE;
    this.z = def.z === 'behind' ? 'behind' : 'front';
    /* Whether the attachment rides the grip bone's LIVE transform. Melee art
       (swords, spears, hammers) swings with the arm; everything that fires is
       drawn on the setup-pose mount instead, so the `punch` clip that cues a
       gunshot cannot whip the barrel around. See rigWeaponModel.js. */
    this.steady = isSteadyRigWeapon(id);
  }
}

export class SkeletonData {
  constructor(json) {
    this.json = json;
    this.bindWidth = json.bindWidth;
    this.bindHeight = json.bindHeight;

    this.boneNames = [];
    this.boneParent = [];
    this.setupX = [];
    this.setupY = [];
    this.setupRot = []; // radians
    this.boneIndexByName = new Map();

    for (const b of json.bones) {
      const index = this.boneNames.length;
      this.boneIndexByName.set(b.name, index);
      this.boneNames.push(b.name);
      this.boneParent.push(b.parent == null ? -1 : this.boneIndexByName.get(b.parent));
      this.setupX.push(b.x ?? 0);
      this.setupY.push(b.y ?? 0);
      this.setupRot.push((b.rotation ?? 0) * DEG);
    }
    this.boneCount = this.boneNames.length;

    // Setup-pose world matrices → per-bone bind inverses for mesh skinning.
    this.bindInverse = new Float32Array(this.boneCount * 6);
    {
      const world = new Float32Array(this.boneCount * 6);
      const tmp = new Float32Array(6);
      for (let i = 0; i < this.boneCount; i++) {
        const cos = Math.cos(this.setupRot[i]);
        const sin = Math.sin(this.setupRot[i]);
        const a = cos, b = sin, c = -sin, d = cos;
        const tx = this.setupX[i], ty = this.setupY[i];
        const p = this.boneParent[i];
        let wa, wb, wc, wd, wx, wy;
        if (p < 0) {
          wa = a; wb = b; wc = c; wd = d; wx = tx; wy = ty;
        } else {
          const o = p * 6;
          wa = world[o] * a + world[o + 2] * b;
          wb = world[o + 1] * a + world[o + 3] * b;
          wc = world[o] * c + world[o + 2] * d;
          wd = world[o + 1] * c + world[o + 3] * d;
          wx = world[o] * tx + world[o + 2] * ty + world[o + 4];
          wy = world[o + 1] * tx + world[o + 3] * ty + world[o + 5];
        }
        const o = i * 6;
        world[o] = wa; world[o + 1] = wb; world[o + 2] = wc;
        world[o + 3] = wd; world[o + 4] = wx; world[o + 5] = wy;
        invertMatrix(wa, wb, wc, wd, wx, wy, tmp);
        this.bindInverse.set(tmp, o);
      }
      /* Kept for the steady weapon mount: the grip a firearm is pinned to IS
         this pose, so nothing has to re-walk the parent chain per frame. */
      this.setupWorld = world;
    }

    this.slots = (json.slots || []).map(s => ({
      name: s.name,
      boneIndex: this.boneIndexByName.get(s.bone),
      attachmentName: s.attachment ?? s.name
    }));

    /* The bone every weapon attachment hangs off — the rig's grip, and the
       bone the steady mount is pinned to. Both weapon slots share it in every
       rig shipped so far, so the first one that resolves a bone decides; a rig
       with no weapon slots leaves it undefined, which simply leaves the mount
       unused. */
    this.weaponBone = undefined;
    for (const s of this.slots) {
      if ((s.name === WEAPON_SLOT_FRONT || s.name === WEAPON_SLOT_BACK)
          && s.boneIndex !== undefined) {
        this.weaponBone = s.boneIndex;
        break;
      }
    }

    this.skins = new Map();
    for (const [skinName, slots] of Object.entries(json.skins || {})) {
      const map = new Map();
      for (const [slotName, def] of Object.entries(slots)) {
        // `null` is the row's explicit "nothing on this slot for this skin" —
        // see SLOT_EMPTY.
        map.set(slotName, def === null ? SLOT_EMPTY : new Attachment(def, this.boneIndexByName));
      }
      this.skins.set(skinName, map);
    }
    // Skin overrides: a slot def without a `type` swaps only the image
    // (and optionally dimensions/uvs) of the default skin's attachment.
    // All pleco skins share one mesh layout — vertices/triangles/weights
    // never vary — but uvs DO vary: each skin's crop is clamped against
    // its own frame edges, so the default's uvs are only exact for the
    // default skin. Overrides carry their own uvs when they differ.
    const defaultSkin = this.skins.get('default');
    if (defaultSkin) {
      for (const [skinName, map] of this.skins) {
        if (skinName === 'default') continue;
        for (const [slotName, att] of map) {
          // Typed attachments and explicit opt-outs both carry no merge work:
          // the first is a full definition, the second is not an override at
          // all (merging the default's art into it would undo the opt-out).
          if (att === SLOT_EMPTY || att.type) continue;
          const base = defaultSkin.get(slotName);
          if (!base || base === SLOT_EMPTY) continue;
          const merged = Object.assign(Object.create(Object.getPrototypeOf(base)), base);
          merged.image = att.image;
          if (att.width) merged.width = att.width;
          if (att.height) merged.height = att.height;
          if (att.uvs) merged.uvs = att.uvs;
          // region offsets may vary per skin (crop centers drift with the
          // source frame's aspect); mesh geometry never does
          if (merged.type === 'region') {
            if (att.x !== undefined) merged.x = att.x;
            if (att.y !== undefined) merged.y = att.y;
          }
          map.set(slotName, merged);
        }
      }
    }

    this.weapons = new Map();
    for (const [id, def] of Object.entries(json.weapons || {})) {
      this.weapons.set(id, new WeaponDef(id, def));
    }

    this.animations = new Map();
    for (const [name, def] of Object.entries(json.animations || {})) {
      this.animations.set(name, new Animation(name, def, this.boneIndexByName));
    }

    this.procedural = json.procedural || null;

    // Hand cap: after the weapon is drawn, these slots are re-drawn clipped
    // to an ellipse around the hand bone, so the grip passes BEHIND the
    // pleco's fist. Without it the weapon sits flat on top of the art and
    // reads as pasted on rather than held. Slot names resolve to indices
    // once here; unknown names are dropped so a rig without them is inert.
    /* Per-skin hand position. The hand bone is authored against the default
       skin, but the skins are separately generated art and their fists do not
       land in the same place: measured with tools/qa_weapon_grip.mjs, 7 of 16
       skins held the weapon with little or no contact with the fist (cow_pleco
       and apex_pleco: essentially zero), so the weapon floated near the chin
       instead of being gripped. These offsets, in skeleton units, move the hand
       bone per skin; Skeleton.setToSetupPose applies them, because
       AnimationState.apply() resets the pose from setup every frame and would
       otherwise wipe a one-off adjustment.

       A SHAPED skin needs the same correction for a different reason, and the
       number is derived rather than eyeballed: the offset reproduces the
       REFERENCE skin's chin-to-grip relationship on a body whose proportions
       are not the reference's. `spartan_pleco` ships its own mesh, 37u tall
       against the reference's 28.7u, so its jaw hangs lower while the shared
       hand bone stayed where the short body put it — the gun sat jammed up
       against the cheek instead of under it (see
       tests/pleco/held-weapon-placement.test.js, which re-derives it from the
       shipped art). */
    this.handBySkin = new Map();
    const handIdx = this.boneIndexByName.get('hand');
    if (handIdx !== undefined) {
      for (const [skin, off] of Object.entries(json.handBySkin || {})) {
        this.handBySkin.set(skin, { dx: off.dx ?? 0, dy: off.dy ?? 0, boneIndex: handIdx });
      }
    }

    /* Combat-ready stance: bone deltas applied on top of the setup pose
       while the pleco is armed, blended by an amount so equipping a weapon
       eases into it instead of snapping. Unknown bones are dropped rather
       than throwing, the same as animation timelines. */
    this.armedStance = (json.armedStance || [])
      .map(s => ({
        boneIndex: this.boneIndexByName.get(s.bone),
        rot: (s.rot ?? 0) * DEG,
        dx: s.dx ?? 0,
        dy: s.dy ?? 0
      }))
      .filter(s => s.boneIndex !== undefined);

    this.handCap = null;
    if (json.handCap && this.boneIndexByName.has(json.handCap.bone)) {
      const slotIndex = new Map(this.slots.map((s, i) => [s.name, i]));
      const capSlots = (json.handCap.slots || [])
        .map(n => slotIndex.get(n))
        .filter(i => i !== undefined);
      if (capSlots.length) {
        this.handCap = {
          boneIndex: this.boneIndexByName.get(json.handCap.bone),
          rx: json.handCap.rx ?? 5,
          ry: json.handCap.ry ?? 5,
          slots: capSlots
        };
      }
    }
  }

  boneIndex(name) {
    return this.boneIndexByName.get(name);
  }

  /** World point the setup pose puts the grip bone at, honouring that skin's
   *  `handBySkin` correction. Shared by the weapon mount (`Skeleton.
   *  _updateWeaponMount` reads the same numbers) and by `heldWeaponBox`, so a
   *  fit calculation can never measure the uncorrected grip. */
  gripPoint(skinName) {
    const bone = this.weaponBone !== undefined ? this.weaponBone : this.boneIndex('hand');
    if (bone === undefined) return null;
    const o = bone * 6;
    const off = this.handBySkin.get(skinName);
    return {
      x: this.setupWorld[o + 4] + (off ? off.dx : 0),
      y: this.setupWorld[o + 5] + (off ? off.dy : 0),
    };
  }

  /** The box a skin would paint with `weaponId` held, in rig units at the
   *  setup pose — the space a surface clipping the rig has to reserve. Null for
   *  an unknown id or a rig with no grip bone.
   *
   *  `HELD_WEAPON_SCALE` makes this the load-bearing number for every
   *  weapon-bearing pane: the fish alone fills `bindWidth` exactly, so anything
   *  past the nose is invisible unless the pane sizes itself off this. */
  heldWeaponBox(weaponId, skinName = 'default') {
    const weapon = this.getWeapon(weaponId);
    const grip = this.gripPoint(skinName);
    if (!weapon || !grip) return null;
    return heldWeaponBox(weapon, grip.x, grip.y);
  }

  getAnimation(name) {
    return this.animations.get(name) || null;
  }

  getSkin(skinName) {
    return this.skins.get(skinName) || null;
  }

  getWeapon(id) {
    return this.weapons.get(id) || null;
  }

  hasSkin(skinName) {
    return this.skins.has(skinName);
  }
}
