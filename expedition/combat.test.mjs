import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombat,WEAPONS} from './combat.mjs';
import {profiles,stepProjectile} from './projectiles/index.mjs';
import {actorPose,heroPose,companionPose} from './choreography.mjs';
const view=c=>({bullets:c.bullets.filter(b=>b.active).map(b=>({x:b.x,y:b.y,angle:b.angle,life:b.life})),targets:c.targets.map(t=>({...t})),sparks:c.sparks.filter(s=>s.active).map(s=>({...s})),kills:c.kills,flash:c.flash,aimAngle:c.aimAngle});
test('holding scroll time freezes every combat state; rewinding restores HP and kills',()=>{
 const c=createCombat();c.layout(1280,720,0);c.seek(0,0);const start=view(c);c.seek(7,0);assert.ok(c.kills>0);const stopped=view(c);c.seek(7,0);assert.deepEqual(view(c),stopped);c.seek(0,0);assert.deepEqual(view(c),start);
});
for(let weapon=0;weapon<5;weapon++)test(WEAPONS[weapon]+': direct seek equals forward/reverse stepping and uses canonical flight',()=>{
 const c=createCombat();c.layout(1280,720,weapon);c.seek(5.25,weapon);const direct=view(c);
 for(let t=0;t<12;t+=.09)c.seek(t,weapon);c.seek(5.25,weapon);assert.deepEqual(view(c),direct);
 for(let t=12;t>0;t-=.13)c.seek(t,weapon);c.seek(5.25,weapon);assert.deepEqual(view(c),direct);
 const first=c.cache.tracks[0],path=first.path;assert.equal(first.base.gunId,WEAPONS[weapon]);assert.equal(first.base.maxLife,profiles[WEAPONS[weapon]].life);
 const target={...actorPose(first.start,weapon,first.targetIndex,1280,720,weapon),dead:false};const bolt={...first.base,homingTarget:profiles[WEAPONS[weapon]].homing?target:null};stepProjectile(bolt,1/120,target);
 assert.ok(Math.abs(bolt.x-path[7])<.001);assert.ok(Math.abs(bolt.y-path[8])<.001);
 assert.ok(c.cache.events.some(event=>event.kind==='hit'||event.kind==='death'),'canonical rounds collide with staged enemies');
 assert.ok(c.cacheSize<=6);assert.equal(c.bullets.length,48);assert.equal(c.sparks.length,64);
});
test('resize rebuilds cached trajectories and all seeks remain finite',()=>{
 const c=createCombat();c.layout(1280,720,0);c.seek(1,0);c.layout(844,390,0);c.seek(1,0);assert.equal(c.cacheSize,1);
 for(const time of [0,.06,.1,2,7,14,NaN]){c.seek(time,0);for(const b of c.bullets)if(b.active)assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));}
});

test('hero, enemies and companions travel across the action lane with deterministic poses',()=>{
 for(const [w,h] of [[568,320],[844,390],[1280,720]])for(let chapter=0;chapter<6;chapter++){
  const poses=Array.from({length:29},(_,i)=>heroPose(i*.5,chapter,w,h));
  assert.ok(Math.max(...poses.map(p=>p.x))-Math.min(...poses.map(p=>p.x))>w*.07);
  assert.ok(Math.max(...poses.map(p=>p.y))-Math.min(...poses.map(p=>p.y))>h*.2);
  for(const pose of poses)assert.ok(pose.x-pose.width/2>=w*.39);
  const enemyA=actorPose(0,chapter,1,w,h),enemyB=actorPose(5,chapter,1,w,h);
  assert.ok(Math.abs(enemyA.x-enemyB.x)>w*.08);
  assert.deepEqual(heroPose(7,chapter,w,h),heroPose(7,chapter,w,h));
  assert.notDeepEqual(companionPose(1,chapter,0,w,h),companionPose(8,chapter,0,w,h));
 }
});
test('moving actor poses in seek match collision simulation and all chapters hit moving enemies',()=>{
 for(let chapter=0;chapter<6;chapter++){
  const weapon=[0,0,1,2,3,4][chapter],c=createCombat();c.layout(1280,720,chapter);c.seek(6.5,weapon);
  for(const target of c.targets){const pose=actorPose(6.5,chapter,target.index,1280,720,weapon);assert.equal(target.x,pose.x);assert.equal(target.y,pose.y);}
  assert.ok(c.cache.events.some(event=>event.kind==='hit'||event.kind==='death'));
  const checkpoint=view(c);c.seek(12,weapon);c.seek(6.5,weapon);assert.deepEqual(view(c),checkpoint);
  const bossStart=actorPose(0,chapter,0,1280,720,weapon),bossEntered=actorPose(6,chapter,0,1280,720,weapon);assert.equal(bossStart.visible,false);assert.equal(bossEntered.visible,true);assert.ok(bossStart.x-bossEntered.x>1280*.2);
 }
});
