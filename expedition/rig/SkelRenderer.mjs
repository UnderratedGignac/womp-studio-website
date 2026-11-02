/** Canvas2D draw backend for the skeletal runtime.
 *
 * Renders slots in rig draw order: region attachments via composed bone
 * transforms, weighted meshes as textured triangles (per-triangle affine +
 * clip — the standard Canvas2D mesh technique). Allocation-free in the draw
 * loop: skinned-vertex scratch lives on the Skeleton, keyed per mesh.
 *
 * The caller owns the outer transform (entity translate, flip mirror, tilt
 * rotate) and globalAlpha; this renderer composes onto whatever transform
 * the ctx currently holds, so camera + flip work exactly as for strips.
 */

const WEAPON_SLOT_BACK = 'weapon_back';
const WEAPON_SLOT_FRONT = 'weapon_front';
const SEAM_INFLATE_PX = 0.4; // grow each triangle slightly to hide hairline seams
// Device px kept around the cap's box so an antialiased cap edge never loses a
// triangle that could still tint it.
const HAND_CAP_CULL_MARGIN_PX = 2;

export class SkelRenderer {
  /** @param {import('./SkeletonData.mjs').SkeletonData} data
   *  @param {(path:string)=>({width:number,height:number,complete?:boolean}|null)} getImage */
  constructor(data, getImage) {
    this.data = data;
    this.getImage = getImage;
    /* Opacity applied to the weapon slot only (body parts always compose onto
       the caller's globalAlpha). The Armory uses this to preview a LOCKED gun
       dimmed in the pleco's maw without fading the pleco itself. */
    this.weaponAlpha = 1;
    /* The hand cap re-renders the whole body mesh under an ellipse clip to
       mask the gun handle. On mobile WebViews this breaks hardware batching
       and causes massive GPU pipeline flushes. Default to false so equipped
       weapons never drop FPS. */
    this.disableHandCap = false;
    this.cullHandCap = true;
    this._capCull = { x0: 0, y0: 0, x1: 0, y1: 0 };
    this._bodyAlpha = 1; // caller's globalAlpha at last draw(); set there
    this._imageCache = new Map(); // path -> image|null (resolved once)
    this._weaponSlotIndex = new Map();
    for (let i = 0; i < data.slots.length; i++) {
      this._weaponSlotIndex.set(data.slots[i].name, i);
    }
  }

  /* Only a USABLE image is cached. Caching the miss (which this did, keyed on
     `has`) made a texture that merely had not finished loading yet look
     permanently absent: the null was remembered for the life of the renderer,
     the slot never drew again, and because ui/skinPortrait.js keeps ONE
     module-level renderer for every portrait, a single early miss in the main
     menu blanked that part for the rest of the session. Re-asking on a miss
     costs one Map lookup plus the caller's own getImage, and lets the rig
     start drawing the moment the asset lands. */
  _image(path) {
    const cached = this._imageCache.get(path);
    if (cached) return cached;
    const img = this.getImage(path);
    if (!img || img.complete === false) return null;
    this._imageCache.set(path, img);
    return img;
  }

  /** Draws the skeleton centered on the current ctx origin, scaled so the
   *  rig's bind width maps to `width` px in the current transform space.
   *
   *  Returns the number of BODY slots actually painted, so a caller can tell
   *  "drew the fish" from "drew nothing because the textures are not loaded
   *  yet". Every slot silently returns early on a missing image, so without
   *  this the two are indistinguishable — which is how the menu skin picker
   *  ended up drawing 33 empty circles and reporting success. */
  draw(ctx, skeleton, width) {
    const data = this.data;
    let painted = 0;
    // Remember the caller's alpha so the weapon-only dim (weaponAlpha) can
    // compose against it and the hand cap can keep drawing fully opaque.
    this._bodyAlpha = ctx.globalAlpha;
    const scale = width / data.bindWidth;
    skeleton.updateWorldTransform(scale);

    const base = ctx.getTransform ? ctx.getTransform() : null;
    const ba = base ? base.a : 1, bb = base ? base.b : 0;
    const bc = base ? base.c : 0, bd = base ? base.d : 1;
    const be = base ? base.e : 0, bf = base ? base.f : 0;

    const w = skeleton.world;
    for (const slot of data.slots) {
      if (slot.name === WEAPON_SLOT_BACK || slot.name === WEAPON_SLOT_FRONT) {
        this._drawWeapon(ctx, skeleton, slot, slot.name === WEAPON_SLOT_BACK ? 'behind' : 'front');
        if (slot.name === WEAPON_SLOT_FRONT && !this.disableHandCap) {
          this._drawHandCap(ctx, skeleton, scale, ba, bb, bc, bd, be, bf);
        }
        continue;
      }
      if (this._drawSlot(ctx, skeleton, slot, w, ba, bb, bc, bd, be, bf)) painted++;
    }
    return painted;
  }

  /** Draws ONLY the equipped weapon on the current skeleton pose — the body
   *  slots stay untouched. A defender that swaps its rig body for a bite/eat/
   *  punch sprite strip for a beat would otherwise drop the gun for the length
   *  of the clip (the strip replaces the whole rig, mount included). The gun is
   *  a rig attachment, not strip art, so it rides the live bone/mount matrices
   *  and stays pinned to the pleco through the swap. No weapon equipped (a
   *  bare-fist fighter) → no-op. */
  drawWeaponOnly(ctx, skeleton, width) {
    if (!skeleton.weapon) return;
    skeleton.updateWorldTransform(width / this.data.bindWidth);
    const back = this._weaponSlotIndex.get(WEAPON_SLOT_BACK);
    const front = this._weaponSlotIndex.get(WEAPON_SLOT_FRONT);
    if (back !== undefined) this._drawWeapon(ctx, skeleton, this.data.slots[back], 'behind');
    if (front !== undefined) this._drawWeapon(ctx, skeleton, this.data.slots[front], 'front');
  }

  /** @returns {boolean} whether this slot actually put pixels on the ctx. */
  _drawSlot(ctx, skeleton, slot, w, ba, bb, bc, bd, be, bf, cull = null) {
    const att = skeleton.getAttachment(slot);
    if (!att) return false;
    const img = this._image(att.image);
    if (!img) return false;
    const o = slot.boneIndex * 6;
    if (att.type === 'region') {
      this._drawRegion(ctx, img, att, w[o], w[o + 1], w[o + 2], w[o + 3], w[o + 4], w[o + 5]);
    } else {
      this._drawMesh(ctx, img, att, skeleton.skinMesh(att), ba, bb, bc, bd, be, bf, cull);
    }
    return true;
  }

  /** Re-draws the body art clipped to a small ellipse at the hand bone, on
   *  top of the just-drawn weapon: the handle disappears behind the pleco's
   *  fist, so the weapon reads as GRIPPED rather than pasted over the body.
   *  Same trick as a shoulder cap in a paper-doll rig — no extra art, and it
   *  tracks the animation because it re-uses the live skinned meshes.
   *  Only meaningful for front-carried weapons; a 'behind' weapon is already
   *  occluded by the body pass. */
  _drawHandCap(ctx, skeleton, scale, ba, bb, bc, bd, be, bf) {
    const cap = this.data.handCap;
    if (!cap) return;
    const weapon = skeleton.weapon;
    if (!weapon || weapon.z !== 'front') return;
    // The cap exists to hide a weapon's grip, so it is pointless when the grip
    // was never drawn: a weapon whose art is still decoding would buy a
    // clipped body re-paint every frame for zero visible difference.
    if (!this._image(weapon.image)) return;
    const w = skeleton.world;
    const o = cap.boneIndex * 6;
    ctx.save();
    // The cap is body art — it stays as opaque as the body even when the
    // weapon it occludes is a dimmed locked preview.
    ctx.globalAlpha = this._bodyAlpha;
    // Path is traced under the caller's transform, so bone world coords and
    // unit radii scale/flip/rotate with the fish for free.
    const cx = w[o + 4], cy = w[o + 5];
    const rx = cap.rx * scale, ry = cap.ry * scale;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    // The re-paint walks every body and head triangle, but the clip only lets
    // the few around the fist through. The ellipse's exact device-space box
    // (an axis-aligned ellipse under the base affine) rejects the rest before
    // they pay a clip + drawImage of their own: same pixels, a fraction of the
    // raster work, per armed pleco per frame.
    let cull = null;
    if (this.cullHandCap) {
      const dcx = ba * cx + bc * cy + be;
      const dcy = bb * cx + bd * cy + bf;
      const barx = ba * rx, bcry = bc * ry;
      const bbrx = bb * rx, bdry = bd * ry;
      const hx = Math.sqrt(barx * barx + bcry * bcry) + HAND_CAP_CULL_MARGIN_PX;
      const hy = Math.sqrt(bbrx * bbrx + bdry * bdry) + HAND_CAP_CULL_MARGIN_PX;
      cull = this._capCull;
      cull.x0 = dcx - hx; cull.x1 = dcx + hx;
      cull.y0 = dcy - hy; cull.y1 = dcy + hy;
    }
    for (const slotIndex of cap.slots) {
      this._drawSlot(ctx, skeleton, this.data.slots[slotIndex], w, ba, bb, bc, bd, be, bf, cull);
    }
    ctx.restore();
  }

  _drawWeapon(ctx, skeleton, slot, z) {
    const weapon = skeleton.weapon;
    if (!weapon || weapon.z !== z) return;
    const img = this._image(weapon.image);
    if (!img) return;
    const o = slot.boneIndex * 6;
    const bw = skeleton.world;
    /* A steady weapon (anything that fires) rides `weaponMount` — the grip bone
       at its setup pose — so the swim wag, the armed stance, and above all the
       `punch` clip that cues every gunshot leave the barrel alone. Melee art
       (`steady === false`) keeps the live bone: the swing IS its animation. A
       skeleton with no mount (a test stub, an old inlined viewer) falls back to
       the live transform, i.e. the pre-existing behaviour. */
    const mount = weapon.steady === false || !skeleton.hasWeaponMount
      ? null : skeleton.weaponMount;
    const ma = mount ? mount[0] : bw[o];
    const mb = mount ? mount[1] : bw[o + 1];
    const mc = mount ? mount[2] : bw[o + 2];
    const md = mount ? mount[3] : bw[o + 3];
    const mx = mount ? mount[4] : bw[o + 4];
    const my = mount ? mount[5] : bw[o + 5];
    // Weapon local transform: grip (anchor px) onto the bone, per-weapon
    // rotation and scale. local = T(-R·S·anchor) · R · S
    const cos = Math.cos(weapon.rotation);
    const sin = Math.sin(weapon.rotation);
    const s = weapon.scale;
    const la = cos * s, lb = sin * s, lc = -sin * s, ld = cos * s;
    const lx = -(la * weapon.anchorX + lc * weapon.anchorY);
    const ly = -(lb * weapon.anchorX + ld * weapon.anchorY);
    const ra = ma * la + mc * lb;
    const rb = mb * la + md * lb;
    const rc = ma * lc + mc * ld;
    const rd = mb * lc + md * ld;
    const rx = ma * lx + mc * ly + mx;
    const ry = mb * lx + md * ly + my;
    ctx.save();
    // A locked-weapon preview dims the gun alone; the body
    // pass keeps the caller's alpha untouched.
    if (this.weaponAlpha !== 1) ctx.globalAlpha *= this.weaponAlpha;
    ctx.transform(ra, rb, rc, rd, rx, ry);
    // No shadow under the weapon: the cue it gave (a dark ellipse under the
    // gun) was removed at the player's request, everywhere the rig draws.
    ctx.drawImage(img, 0, 0, weapon.width, weapon.height);
    ctx.restore();
  }

  _drawRegion(ctx, img, att, wa, wb, wc, wd, wx, wy) {
    // region local: T(x,y) · R(rotation); draw centered on the origin
    const cos = Math.cos(att.rotation);
    const sin = Math.sin(att.rotation);
    const ra = wa * cos + wc * sin;
    const rb = wb * cos + wd * sin;
    const rc = -wa * sin + wc * cos;
    const rd = -wb * sin + wd * cos;
    const rx = wa * att.x + wc * att.y + wx;
    const ry = wb * att.x + wd * att.y + wy;
    ctx.save();
    ctx.transform(ra, rb, rc, rd, rx, ry);
    ctx.drawImage(img, -att.width / 2, -att.height / 2, att.width, att.height);
    ctx.restore();
  }

  _drawMesh(ctx, img, mesh, skinned, ba, bb, bc, bd, be, bf, cull = null) {
    const tris = mesh.triangles;
    const uv = mesh.uvs;
    const iw = mesh.width;
    const ih = mesh.height;
    for (let t = 0; t < tris.length; t += 3) {
      const i0 = tris[t] * 2, i1 = tris[t + 1] * 2, i2 = tris[t + 2] * 2;
      // screen positions = base ctx transform · skinned vertex
      let x0 = ba * skinned[i0] + bc * skinned[i0 + 1] + be;
      let y0 = bb * skinned[i0] + bd * skinned[i0 + 1] + bf;
      let x1 = ba * skinned[i1] + bc * skinned[i1 + 1] + be;
      let y1 = bb * skinned[i1] + bd * skinned[i1 + 1] + bf;
      let x2 = ba * skinned[i2] + bc * skinned[i2 + 1] + be;
      let y2 = bb * skinned[i2] + bd * skinned[i2 + 1] + bf;

      // image-space triangle (px)
      const X0 = uv[i0] * iw, Y0 = uv[i0 + 1] * ih;
      const X1 = uv[i1] * iw, Y1 = uv[i1 + 1] * ih;
      const X2 = uv[i2] * iw, Y2 = uv[i2 + 1] * ih;
      const D = (X1 - X0) * (Y2 - Y0) - (X2 - X0) * (Y1 - Y0);
      if (Math.abs(D) < 1e-6) continue;

      // inflate toward centroid to hide hairline seams between neighbors
      const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
      x0 += Math.sign(x0 - cx) * SEAM_INFLATE_PX;
      y0 += Math.sign(y0 - cy) * SEAM_INFLATE_PX;
      x1 += Math.sign(x1 - cx) * SEAM_INFLATE_PX;
      y1 += Math.sign(y1 - cy) * SEAM_INFLATE_PX;
      x2 += Math.sign(x2 - cx) * SEAM_INFLATE_PX;
      y2 += Math.sign(y2 - cy) * SEAM_INFLATE_PX;

      if (cull
          && (Math.max(x0, x1, x2) < cull.x0 || Math.min(x0, x1, x2) > cull.x1
            || Math.max(y0, y1, y2) < cull.y0 || Math.min(y0, y1, y2) > cull.y1)) {
        continue;
      }

      // affine mapping image px -> screen, solved from the 3 point pairs
      const a = ((x1 - x0) * (Y2 - Y0) - (x2 - x0) * (Y1 - Y0)) / D;
      const b = ((y1 - y0) * (Y2 - Y0) - (y2 - y0) * (Y1 - Y0)) / D;
      const c = ((x2 - x0) * (X1 - X0) - (x1 - x0) * (X2 - X0)) / D;
      const d = ((y2 - y0) * (X1 - X0) - (y1 - y0) * (X2 - X0)) / D;
      const e = x0 - a * X0 - c * Y0;
      const f = y0 - b * X0 - d * Y0;

      ctx.save();
      // x0…y2 are already in device space (base · skinned, base folded in
      // above). Reset the CTM before tracing the clip path so clip() doesn't
      // apply the caller's base transform a SECOND time — otherwise the clip
      // region lands one base-transform away from the image (drawn at the
      // absolute setTransform below) and every triangle is clipped out. This
      // only bites when draw() runs under a non-identity transform (always:
      // the game translates to the pleco, the viewer centers the canvas);
      // region/weapon paths use relative ctx.transform and are unaffected.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.clip();
      ctx.setTransform(a, b, c, d, e, f);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
  }
}
