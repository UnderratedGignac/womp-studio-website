import {SkeletonData} from './SkeletonData.mjs';
import {Skeleton} from './Skeleton.mjs';
import {AnimationState} from './AnimationState.mjs';
import {SkelRenderer} from './SkelRenderer.mjs';

/** Authentic Fish Aquarium rig. loadImage receives an absolute URL string.
 * For Node raster QA provide {json, images: Map<game-art-path,image>} instead.
 */
export async function loadRig(loadImage, supplied = {}) {
  const json = supplied.json || await fetch(new URL('./plecoRigData.json',import.meta.url)).then(r=>{
    if(!r.ok) throw new Error('Pleco rig data unavailable');
    return r.json();
  });
  const loader = loadImage || (url=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Pleco art unavailable: '+url));image.src=url;
  }));
  const art=supplied.images || new Map();
  const paths=new Set();
  for(const skin of Object.values(json.skins)) for(const attachment of Object.values(skin)) if(attachment?.image) paths.add(attachment.image);
  for(const weapon of Object.values(json.weapons)) paths.add(weapon.image);
  if(!supplied.images) await Promise.all([...paths].map(async path=>art.set(path,await loader(new URL('./art/'+path,import.meta.url).href))));
  const data=new SkeletonData(json);
  const skeleton=new Skeleton(data,'cleaner');
  const animation=new AnimationState(data);
  animation.setAnimation('swim',{loop:true,mix:0});
  const renderer=new SkelRenderer(data,path=>art.get(path)||null);
  const instances=new Map([['cleaner',{skeleton,animation,renderer}]]);
  function instanceFor(skin) {
    const id=data.getSkin(skin)?skin:'cleaner';
    if(!instances.has(id)) {
      const sk=new Skeleton(data,id),anim=new AnimationState(data);
      anim.setAnimation('swim',{loop:true,mix:0});
      instances.set(id,{skeleton:sk,animation:anim,renderer:new SkelRenderer(data,path=>art.get(path)||null)});
    }
    return instances.get(id);
  }
  const point={x:0,y:0};
  const grip={x:0,y:0};
  return {
    data,skeleton,animation,renderer,instances,
    /** Exact attachment geometry without rasterizing an invisible fish. */
    measure(options){return this.draw(null,options);},
    /** Position/width in caller canvas units; time is seekable seconds.
     * Returns true barrel position in the same units (before camera transform).
     */
    draw(ctx,{x=0,y=0,width=400,size,weapon='pistol',angle=0,aim,time=0,recoil=0,facing=1,speed=.55,armed=true,skin='cleaner'}={}) {
      const {skeleton,animation,renderer}=instanceFor(skin);
      const drawWidth=size??width;
      const rotation=aim??angle;
      skeleton.setWeapon(armed?weapon:null);
      animation.params.speed=speed;
      animation.base.time=((time%animation.base.anim.duration)+animation.base.anim.duration)%animation.base.anim.duration;
      animation.wavePhase=time*(.8+1.2*speed);
      animation.flutterTime=time;
      animation.apply(skeleton);
      if(skeleton.weapon) skeleton.applyArmedStance(1);
      skeleton.aimHand(0);
      const shove=-Math.max(0,recoil)*drawWidth*.015;
      let painted=0;
      if(ctx){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(facing,1);ctx.translate(shove,0);painted=renderer.draw(ctx,skeleton,drawWidth);}
      else skeleton.updateWorldTransform(drawWidth/data.bindWidth);
      const w=skeleton.weapon;
      const muzzle=w?skeleton.weaponPoint(w.muzzleX,w.muzzleY,point):null;
      const mount=w?skeleton.weaponPoint(w.anchorX,w.anchorY,grip):null;
      if(ctx)ctx.restore();
      const px=((muzzle?.x??drawWidth*.5)+shove)*facing,py=muzzle?.y??0;
      const c=Math.cos(rotation),s=Math.sin(rotation);
      const gx=((mount?.x??0)+shove)*facing,gy=mount?.y??0;
      return {muzzleX:x+c*px-s*py,muzzleY:y+s*px+c*py,
        weaponGripX:x+c*gx-s*gy,weaponGripY:y+s*gx+c*gy,painted};
    }
  };
}
