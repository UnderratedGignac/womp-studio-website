import {profiles} from './profiles.mjs';
import {MOTION_PROFILES,stepMotion,MAX_MOTION_STEP} from './projectileMotion.mjs';
import {drawGunRound} from './gunRoundBodies.mjs';
export {profiles};
export const weaponIds = ['snapperpistol','krakenshotgun','reefminigun','narwhalrail','clamcannon'];
export {MOTION_PROFILES,stepMotion,sweptHit,bounceWalls} from './projectileMotion.mjs';

/** Actual unupgraded Classic Pleco volley. Inject a seeded random function
 * to make the game's random spread and wobble reversible on a scroll timeline.
 */
export function createVolley(weapon,{x=0,y=0,angle=0,target=null,random=Math.random,damage=10,speedMul=1}={}) {
  const w=profiles[weapon];if(!w)return [];
  const bolts=[];
  for(let i=0;i<w.pellets;i++) {
    const spreadOff=w.spread>0?(random()-.5)*2*w.spread:0;
    const heading=angle+spreadOff;
    const speed=w.boltSpeed*speedMul;
    const wobblePhase=w.weaponType==='smg'?random()*Math.PI*2:0;
    const seed=random();
    bolts.push({gunId:weapon,weaponType:w.weaponType,x,y,prevX:x,prevY:y,vx:Math.cos(heading)*speed,vy:Math.sin(heading)*speed,angle:heading,
      size:w.bulletSize*w.appearance.size,radius:w.bulletSize*w.appearance.size*.5,color:w.appearance.color,
      profile:{shape:w.appearance.shape,body:weapon},motion:w.motion,
      life:w.life,maxLife:w.life,ttl:w.life,dead:false,
      damage:Math.max(1,Math.round(damage*w.dmgMul/w.pellets)),pierce:w.pierce,splash:w.splash,splashMul:w.splashMul??.5,
      homingTarget:w.homing?target:null,seed,spin:0,bounces:0,maxBounces:['cannon','sniper'].includes(w.weaponType)?0:1,
      wobblePhase,pellet:i});
  }
  return bolts;
}

/** Canonical bridge update order: expire, SMG wobble, water physics,
 * locked-target homing at 16 rad/s, integrate position. Mutates the bolt.
 * Caller owns collision, damage and optional tank-wall bounce.
 */
export function stepProjectile(b,dt,target=b.homingTarget) {
  if(b.dead)return false;
  b.life-=dt;
  if(b.life<=0){b.dead=true;return false;}
  if(b.weaponType==='smg') {
    const wobbleMag=30*dt;
    const perpAngle=b.angle+Math.PI*.5;
    const wobble=Math.sin((2-b.life)*40+b.wobblePhase)*wobbleMag;
    b.vx+=Math.cos(perpAngle)*wobble;b.vy+=Math.sin(perpAngle)*wobble;
  }
  if(MOTION_PROFILES[b.motion]&&MOTION_PROFILES[b.motion]!==MOTION_PROFILES.flat) {
    const span=typeof dt==='number'&&Number.isFinite(dt)&&dt>0?Math.min(dt,MAX_MOTION_STEP):0;
    stepMotion(b,span,{spin:true});
  }
  if(b.homingTarget&&target&&!target.dead) {
    const ta=Math.atan2(target.y-b.y,target.x-b.x);
    let diff=ta-b.angle;
    while(diff<-Math.PI)diff+=Math.PI*2;
    while(diff>Math.PI)diff-=Math.PI*2;
    const maxTurn=16*dt;
    if(Math.abs(diff)<=maxTurn)b.angle=ta;else b.angle+=Math.sign(diff)*maxTurn;
    const spd=Math.hypot(b.vx,b.vy);
    b.vx=Math.cos(b.angle)*spd;b.vy=Math.sin(b.angle)*spd;
  }
  b.prevX=b.x;b.prevY=b.y;
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.homingTarget)b.angle=Math.atan2(b.vy,b.vx);
  return true;
}

/** Uses the very same per-gun silhouettes as PlecoAbilityBridge. No random
 * drawing, gradients, sprite substitutes or generic website bullet shapes.
 */
export function drawProjectile(ctx,b,time=0) {
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);
  const painted=drawGunRound(ctx,b,time);
  ctx.restore();return painted;
}
