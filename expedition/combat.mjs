import {profiles,createVolley,stepProjectile,sweptHit,weaponIds} from './projectiles/index.mjs';
import {actorPose} from './choreography.mjs';
export const CHAPTER_SECONDS=14;
export const WEAPONS=weaponIds;
const STEP=1/120;
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
// Cache event histories and canonical flight paths, never rendered frames.
export function createCombat(){
 const bullets=Array.from({length:48},()=>({active:false}));
 const sparks=Array.from({length:64},()=>({active:false,x:0,y:0,age:0}));
 const targets=Array.from({length:4},(_,index)=>({index,x:0,y:0,hp:30,maxHp:30,dead:0,hit:0}));
 const caches=new Map();let width=1280,height=720,chapter=0,muzzleAt=null,cache=null,flash=0,kills=0,aimAngle=0,muzzle={muzzleX:900,muzzleY:400};
 function layout(w,h,c,options={}){if(w!==width||h!==height){caches.clear();width=w;height=h;}chapter=c;muzzleAt=options.muzzleAt||null;}
 function compile(weapon){const key=chapter+':'+weapon;if(caches.has(key))return caches.get(key);const profile=profiles[WEAPONS[weapon]],random=seeded(chapter*7321+weapon*179+43);
  const actors=targets.map((_,i)=>({...actorPose(0,chapter,i,width,height,weapon),hp:i===0?90:30,maxHp:i===0?90:30,dead:false,revive:0}));
  const tracks=[],events=[],shots=[],active=[];let nextShot=.06,shotCount=0,cursor=0;
  for(let tick=0;tick<=CHAPTER_SECONDS/STEP;tick++){const time=tick*STEP;
   for(const actor of actors)Object.assign(actor,actorPose(time,chapter,actor.index,width,height,weapon));
   for(const target of actors)if(target.dead&&time>=target.revive){target.dead=false;target.hp=target.maxHp;events.push({time,index:target.index,hp:target.hp,kind:'respawn',x:target.x,y:target.y});}
   if(time+1e-9>=nextShot&&(time<4-1e-6||time>=7.1&&time<11)){let target=null;for(let j=0;j<4;j++){const targetCandidate=actors[(cursor+j)%4];if(!targetCandidate.dead&&targetCandidate.visible){target=targetCandidate;cursor=(target.index+1)%4;break;}}
    if(target){const origin=muzzleAt?muzzleAt(time,target):{muzzleX:width*.7,muzzleY:height*.55,aimAngle:Math.atan2(target.y-height*.55,target.x-width*.57)};const angle=Math.atan2(target.y-origin.muzzleY,target.x-origin.muzzleX);shots.push({time,muzzleX:origin.muzzleX,muzzleY:origin.muzzleY,aimAngle:origin.aimAngle??angle});
     for(const bolt of createVolley(WEAPONS[weapon],{x:origin.muzzleX,y:origin.muzzleY,angle,target,random})){const track={start:time,end:time+bolt.life,base:{...bolt,homingTarget:null},targetIndex:target.index,path:[],hit:null};tracks.push(track);active.push({bolt,track,hitIds:new Set()});}
    }shotCount++;nextShot=time+1/profile.fireRate;if(shotCount%profile.burstSize===0)nextShot+=profile.reloadTime*profile.reloadMul;
   }
   // A deliberate close-combat interlude replaces gunfire. Events are cached
   // on the same seekable clock as shots, so damage and animation rewind together.
   for(const [at,index,attack,damage] of [[4.5,1,'bite',18],[5.2,1,'bite',18],[6,2,'punch',28],[6.65,2,'punch',28]]){
    if(Math.abs(time-at)>STEP*.4)continue;const victim=actors[index];if(victim.dead)continue;
    victim.hp=Math.max(0,victim.hp-damage);const event={time,index,hp:victim.hp,kind:'hit',attack,x:victim.x,y:victim.y};
    if(victim.hp===0){victim.dead=true;victim.revive=time+1.1;event.kind='death';}events.push(event);
   }
   for(let i=active.length-1;i>=0;i--){const {bolt,track,hitIds}=active[i];track.path.push(bolt.x,bolt.y,bolt.angle,bolt.vx,bolt.vy,bolt.life,bolt.spin||0);if(!stepProjectile(bolt,STEP)){track.end=time;active.splice(i,1);continue;}const target=sweptHit(bolt,bolt.prevX,bolt.prevY,actors.filter(target=>target.visible&&!hitIds.has(target.index)),bolt.radius);
    if(target){
     function damageTarget(victim,amount){victim.hp=Math.max(0,victim.hp-amount);const event={time:time+STEP,index:victim.index,hp:victim.hp,kind:'hit',x:victim.x,y:victim.y};events.push(event);if(!track.hit)track.hit=event;if(victim.hp===0){victim.dead=true;victim.revive=time+1.1;event.kind='death';}}
     damageTarget(target,bolt.damage);hitIds.add(target.index);
     if(bolt.splash>0)for(const other of actors){if(other===target||other.dead||!other.visible)continue;const dx=other.x-target.x,dy=other.y-target.y;if(dx*dx+dy*dy<=bolt.splash*bolt.splash)damageTarget(other,Math.max(1,Math.round(bolt.damage*bolt.splashMul)));}
     if(bolt.pierce>0)bolt.pierce--;else{track.path.push(bolt.x,bolt.y,bolt.angle,bolt.vx,bolt.vy,bolt.life,bolt.spin||0);track.end=time+STEP;active.splice(i,1);}
    }
   }
  }
  for(const track of tracks)track.path=new Float32Array(track.path);
  events.sort((a,b)=>a.time-b.time);const result={actors,tracks,events,shots,weapon};caches.set(key,result);return result;
 }
 function seek(seconds,weapon=0){const time=Math.max(0,Math.min(CHAPTER_SECONDS,Number.isFinite(seconds)?seconds:0));cache=compile(weapon);flash=0;kills=0;aimAngle=0;for(const bullet of bullets)bullet.active=false;for(const spark of sparks)spark.active=false;
  for(let i=0;i<4;i++)Object.assign(targets[i],actorPose(time,chapter,i,width,height,weapon),{hp:cache.actors[i].maxHp,maxHp:cache.actors[i].maxHp,dead:0,hit:0});
  let sparkIndex=0;
  for(const event of cache.events){if(event.time>time)break;const target=targets[event.index];target.hp=event.hp;if(event.kind==='respawn'){target.dead=0;continue;}const age=time-event.time;target.hit=Math.max(0,.2-age);if(event.kind==='death'){kills++;target.dead=Math.max(0,1.1-age);}if(age<.45)for(let i=0;i<8&&sparkIndex<sparks.length;i++){const a=i*Math.PI/4;Object.assign(sparks[sparkIndex++],{active:true,x:event.x+Math.cos(a)*85*age,y:event.y+Math.sin(a)*85*age,age});}}
  for(const shot of cache.shots){if(shot.time>time)break;const age=time-shot.time;aimAngle=shot.aimAngle;muzzle=shot;flash=Math.max(0,.095-age);}
  let count=0;for(const track of cache.tracks){if(track.start>time||track.end<=time||count>=bullets.length)continue;const sample=(time-track.start)/STEP,index=Math.min(Math.floor(sample),track.path.length/7-1),next=Math.min(index+1,track.path.length/7-1),mix=sample-index;const a=index*7,b=next*7,path=track.path;Object.assign(bullets[count++],track.base,{active:true,x:path[a]+(path[b]-path[a])*mix,y:path[a+1]+(path[b+1]-path[a+1])*mix,angle:path[a+2]+(path[b+2]-path[a+2])*mix,vx:path[a+3],vy:path[a+4],life:path[a+5]-(mix*STEP),spin:path[a+6],age:time-track.start,weapon});}
  return api;
 }
 const api={bullets,sparks,targets,layout,seek,get flash(){return flash;},get recoil(){return flash/.095;},get kills(){return kills;},get aimAngle(){return aimAngle;},get muzzle(){return muzzle;},get cache(){return cache;},get cacheSize(){return caches.size;}};return api;
}
