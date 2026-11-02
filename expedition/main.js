import {makeSky,drawSurface,waterLevel} from './water-surface.mjs';
import {sample} from './timeline.mjs';
import {createCombat,CHAPTER_SECONDS} from './combat.mjs';
import {drawProjectile,weaponIds} from './projectiles/index.mjs';
import {loadRig} from './rig/rig-hero.mjs';
import {heroPose,companionPose,schoolPose,combatToSceneTime} from './choreography.mjs';
import {createScrollDriver} from './scroll-driver.mjs';
const combat=createCombat();
let rig=null,previousScroll=scrollY,pauseTimer=0;
const canvas=document.querySelector('#expedition');
const ctx=canvas.getContext('2d',{alpha:false});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollDriver=createScrollDriver();
let immediateSeek=false,directInput=false;
const chapterElements=Array.from(document.querySelectorAll('.chapter'));
const worldLinks=Array.from(document.querySelectorAll('.world-nav a'));
const copyElements=chapterElements.map(el=>el.querySelector?.('.copy'));
let activeChapter=-1;
const ui=new Map();
function node(id){if(!ui.has(id))ui.set(id,document.getElementById(id));return ui.get(id);}
const ease=value=>{const q=Math.max(0,Math.min(1,value));return q*q*(3-2*q);};
const labels=['The surface','Coral Gardens','Galleon Graveyard','Crystal Caverns','Volcanic Vents','The Abyss'];
const guns=['Snapper Pistol','Kraken Shotgun','Reef Minigun','Narwhal Rail','Clam Cannon'];
const squadSkins=['cleaner','golden_pleco'];
let sky=null,width=innerWidth,height=innerHeight,dpr=1,images=null,raf=0,backgrounds=[],last=0,chapterBounds=[];
const dots=Array.from({length:28},(_,i)=>({x:((i*73+19)%101)/101,y:((i*43+7)%97)/97,r:1+(i%3),speed:8+i%9}));
function resize(){
 chapterBounds=Array.from(document.querySelectorAll('.chapter'),el=>({top:el.offsetTop,height:el.offsetHeight}));
 width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.75);
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';
 sky=makeSky(width,height,()=>document.createElement('canvas'));ctx.setTransform(dpr,0,0,dpr,0,0);
 bakeBackdrops();scrollDriver.target(scrollProgress(),{immediate:true});request();
}
function bakeBackdrops(){
 backgrounds=labels.map((_,i)=>{
  const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d'),im=images?.worlds[i];
  x.fillStyle=['#124e64','#075871','#143a48','#173a57','#422d32','#03131e'][i];x.fillRect(0,0,width,height);
  if(im){const k=Math.max(width/im.width,height/im.height);x.drawImage(im,(width-im.width*k)/2,(height-im.height*k)/2,im.width*k,im.height*k);}
  if(i===2&&images?.wreckOverlay){const art=images.wreckOverlay,w=Math.min(width*.8,1100),h=w*art.height/art.width;x.save();x.globalAlpha=.65;x.translate(width*.76,height*.79);x.rotate(-.06);x.drawImage(art,-w/2,-h/2,w,h);x.restore();}
  const shade=x.createLinearGradient(0,0,width,0);shade.addColorStop(0,'rgba(1,15,26,.84)');shade.addColorStop(.37,'rgba(1,19,30,.52)');shade.addColorStop(.63,'rgba(1,20,30,.08)');shade.addColorStop(1,'rgba(1,17,27,.18)');x.fillStyle=shade;x.fillRect(0,0,width,height);
  return c;
 });
}
const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Could not load '+src));im.src=new URL(src,import.meta.url).href;});
function cover(im,alpha=1,pan=0){if(!im)return;const scale=Math.max(width/im.width,height/im.height)*1.1;ctx.globalAlpha=alpha;ctx.drawImage(im,(width-im.width*scale)/2+Math.sin(pan*.6)*width*.018,(height-im.height*scale)/2+Math.cos(pan*.4)*height*.018,im.width*scale,im.height*scale);ctx.globalAlpha=1;}
function sprite(im,x,y,w,rotation=0,flip=false){if(!im)return;const h=w*im.height/im.width;ctx.save();ctx.translate(x,y);ctx.rotate(rotation);if(flip)ctx.scale(-1,1);ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore();}
function stripSprite(descriptor,x,y,w,frame,rotation=0,flip=true){if(!descriptor?.image)return;const im=descriptor.image,frames=descriptor.frames||4,fw=im.width/frames,h=w*im.height/fw;ctx.save();ctx.translate(x,y);ctx.rotate(rotation);if(flip)ctx.scale(-1,1);ctx.drawImage(im,(frame%frames)*fw,0,fw,im.height,-w/2,-h/2,w,h);ctx.restore();}

function strAlpha(q){return String(Math.max(0,Math.sin(q*Math.PI)*.7));}
function updateIntro(s){
 document.body.dataset.introStage=s.chapter===0?s.introStage:'complete';
 const card=node('reveal-card');
 if(card){card.style.opacity=String(s.cardOpacity);card.style.transform='translateY('+(-s.cardRotation*.13)+'px) rotateY('+(reduced?0:s.cardRotation)+'deg) rotate('+(-5+s.cardRotation*.035)+'deg)';}
 const waterMarker=node('surface-marker');if(waterMarker){const level=waterLevel(s.local,s.chapter);waterMarker.style.transform='translate3d(0,'+(level*height-20)+'px,0)';waterMarker.style.opacity=s.chapter===0&&level>.05?'1':'0';}
 const stage=node('card-stage');if(stage)stage.setAttribute('aria-hidden',s.cardOpacity===0?'true':'false');
 const interlude=node('handoff-panel');
 if(interlude){const visible=s.handoff||s.battlePhase==='briefing'&&s.chapter>0;const envelope=visible?ease(s.swapProgress/.20)*(1-ease((s.swapProgress-.80)/.20)):0;interlude.style.opacity=String(envelope);interlude.style.transform='translate(-50%,calc(-50% + '+((1-envelope)*16)+'px)) scale('+(reduced?1:.97+.03*envelope)+')';interlude.setAttribute('aria-hidden',s.handoff||s.battlePhase==='briefing'&&s.chapter>0?'false':'true');}
 const next=node('handoff-name');if(next)next.textContent=s.battlePhase==='change-to-brawler'?'Brawler entering':'Gunner returning';
 const battleMode=node('battle-mode');if(battleMode)battleMode.textContent=({ranged:'Ranged assault','change-to-brawler':'Regroup / change fighter',bite:'Close combat / bite',punch:'Close combat / punch','change-to-gunner':'Recover / rearm','final-assault':'Final assault',descent:'Dive deeper',briefing:'Next fighter'})[s.battlePhase]||'Awaken your fighter';
 document.body.dataset.battlePhase=s.battlePhase;
 const label=node('intro-stage');if(label)label.textContent=({card:'Choose your fighter',reveal:'Meet your pleco',dive:'Into the water',equip:'Gear up',combat:'Hold the reef',descent:'Dive deeper'})[s.introStage]||'Explore the depths';
}

function updateStory(s){
 for(let i=0;i<copyElements.length;i++){
  const copy=copyElements[i];if(!copy)continue;
  const local=i===s.chapter?s.local:i<s.chapter?1:0;
  const retreat=ease((local-(i===0?.30:.22))/.22);
  copy.style.opacity=String(1-retreat*.60);
  copy.style.transform=reduced?'none':'translate3d(0,'+(-retreat*12)+'px,0)';
 }
 if(activeChapter!==s.chapter){
  activeChapter=s.chapter;
  worldLinks.forEach((link,i)=>{link.classList?.toggle('active',i===s.chapter);if(i===s.chapter)link.setAttribute?.('aria-current','step');else link.removeAttribute?.('aria-current');});
 }
 const end=chapterBounds[5];document.body.dataset.studio=String(!!end&&scrollY>end.top+end.height-height*.35);
}

function drawSplash(s){
 if(s.local<.34||s.local>.58)return;
 const age=s.splash,x=width*.67,y=height*waterLevel(s.local,s.chapter);
 ctx.save();ctx.strokeStyle='rgba(178,239,247,'+(.65*(1-age))+')';ctx.lineWidth=2;
 for(let ring=0;ring<3;ring++){const r=heroRing(age,ring);ctx.beginPath();ctx.ellipse(x,y,r*width*.11,r*height*.035,0,0,Math.PI*2);ctx.stroke();}
 if(s.splashActive){
 if(!reduced){const power=Math.sin(age*Math.PI)*(1-age);ctx.strokeStyle='rgba(216,252,255,'+(power*.8)+')';ctx.lineWidth=Math.max(1,width*.0017);for(let i=0;i<9;i++){const side=i%2?1:-1,reach=width*(.025+(i%5)*.016)*power,lift=height*(.04+(i%4)*.017)*power;ctx.beginPath();ctx.moveTo(x+side*reach*.2,y+3);ctx.quadraticCurveTo(x+side*reach*.5,y-lift*1.4,x+side*reach,y-lift*.7);ctx.stroke();}}
 for(let i=0;i<(reduced?12:34);i++){
  const side=i%2?1:-1,speed=.045+((i*17)%31)*.004,flight=age;
  const dx=side*width*speed*flight,dy=height*(-(.19+((i*13)%19)*.012)*flight+.45*flight*flight);
  const r=Math.max(1,Math.min(width,height)*(.002+(i%3)*.0008))*(1-flight*.45);
  ctx.globalAlpha=Math.max(0,1-flight);ctx.fillStyle=i%3?'#a6e7f0':'#f1ffff';ctx.beginPath();ctx.ellipse(x+dx,y+dy,r,r*(1.4+flight),side*flight*.7,0,Math.PI*2);ctx.fill();
 }}ctx.restore();
}
function heroRing(age,index){return Math.max(.05,age*1.4-index*.14);}

function scrollProgress(){if(chapterBounds.length!==6)return scrollY/Math.max(1,document.documentElement.scrollHeight-height);let index=0;for(let i=1;i<6;i++)if(scrollY>=chapterBounds[i].top)index=i;const start=chapterBounds[index].top,end=index<5?chapterBounds[index+1].top:start+chapterBounds[index].height;return Math.min(1,(index+Math.max(0,Math.min(1,(scrollY-start)/Math.max(1,end-start))))/6);}
function frame(t){raf=0;if(document.hidden)return;
 scrollDriver.target(scrollProgress(),{immediate:reduced||immediateSeek||directInput});immediateSeek=false;
 const s=sample(scrollDriver.step(t));updateIntro(s);updateStory(s);
 cover(backgrounds[s.chapter],1,s.progress*84);
 if(s.chapter<5&&s.transition)cover(backgrounds[s.chapter+1],s.transition,s.progress*84);
if(s.chapter===0&&sky)drawSurface(ctx,sky,s,width,height);
const ambient=reduced?0:s.progress*84;
ctx.strokeStyle='rgba(178,235,225,.2)';ctx.lineWidth=1;
for(const dot of dots){const x=dot.x*width+Math.sin(ambient*.3+dot.y*9)*6,y=((dot.y*height-ambient*dot.speed-s.progress*height*.5)%height+height)%height;if(s.chapter===0&&y<waterLevel(s.local,0)*height)continue;ctx.beginPath();ctx.arc(x,y,dot.r,0,Math.PI*2);ctx.stroke();}
const sceneTime=s.local*CHAPTER_SECONDS;
if(images&&rig){
 const pose=heroPose(sceneTime,s.chapter,width,height),heroW=pose.width;
 let hx=pose.x,hy=pose.y;
 const encounter=images.encounters?.[s.chapter];
 const baseSkin=encounter?.skin||'cleaner';
 const brawler=s.melee||s.handoff&&(s.battlePhase==='change-to-brawler'?s.swapProgress>=.5:s.swapProgress<.5);
 const skin=brawler?s.meleeSkin:baseSkin;
 const handoffOpacity=s.handoff?ease(Math.abs(s.swapProgress*2-1)):1;
 const nextBrawler=s.battlePhase==='change-to-brawler';
 const nextName=node('handoff-name');if(nextName)nextName.textContent=nextBrawler?(s.meleeSkin==='cow_pleco'?'Cow Pleco':'Classic Pleco'):(baseSkin==='cleaner'?'Classic Pleco':baseSkin.replaceAll('_',' '));
 const role=node('handoff-role');if(role)role.textContent=nextBrawler?'Brawler / bite + punch':'Gunner / rearm and return';
 const portrait=node('handoff-image');if(portrait){const path=nextBrawler?(s.meleeSkin==='cow_pleco'?'./assets/cow_pleco-card.png':'./assets/intro-card.png'):encounter.portrait||images.weaponLoadouts[s.weapon].path;if(portrait.getAttribute('src')!==path)portrait.setAttribute('src',path);}

 if(s.handoff)pose.x+=width*.08*Math.sin(s.swapProgress*Math.PI*2);
 if(s.melee)pose.x+=Math.sin(s.actionProgress*Math.PI)*width*.045;

 hx=pose.x;hy=pose.y;
 combat.layout(width,height,s.chapter,{muzzleAt:(time,target)=>{
   const firingPose=heroPose(combatToSceneTime(time,s.chapter),s.chapter,width,height),x=firingPose.x,y=firingPose.y;
   const aimAngle=Math.atan2(target.y-y,target.x-x)+firingPose.bank*.35;
   const point=rig.measure({x,y,width:firingPose.width,weapon:weaponIds[s.weapon],angle:aimAngle,time:s.chapter*CHAPTER_SECONDS+time,recoil:1,skin:baseSkin,facing:1});
   return {...point,aimAngle};
 }});
 combat.seek(s.combatTime,s.weapon);
 // Small authentic fish schools establish depth behind the combat lane.
 ctx.save();if(s.chapter===0){ctx.beginPath();ctx.rect(0,Math.max(0,waterLevel(s.local,0)*height),width,height);ctx.clip();}
 if(images.ambientFish)for(let i=0;i<9;i++){const fish=schoolPose(s.progress*84,i,width,height),descriptor=images.ambientFish[i%images.ambientFish.length];ctx.globalAlpha=.25+(i%3)*.12;stripSprite(descriptor,fish.x,fish.y,fish.width,Math.floor(sceneTime*descriptor.fps+i)%descriptor.frames,0,fish.flip);}ctx.restore();ctx.globalAlpha=1;
 for(const target of combat.targets){
   if(!s.combatReady)continue;
   if(!target.visible)continue;
   const boss=target.index===0,death=target.hp<=0;
   if(death&&target.dead<.5)continue;
   ctx.globalAlpha=target.alpha*(1-ease((s.combatTime-11)/1.2))*(death?Math.max(0,(target.dead-.5)/.35):1);
   const kick=target.hit*75,enemyW=target.width;
   const descriptor=boss?encounter?.boss:encounter?.enemies[(target.index-1)%encounter.enemies.length];
   if(descriptor)stripSprite(descriptor,target.x+kick,target.y,enemyW,target.hit>0?3:target.frame,target.rotation+(death?.3:0),target.facing!==1);
   else sprite(boss?images.boss:images.enemies[target.index%images.enemies.length],target.x+kick,target.y,enemyW,target.rotation,true);
   if(!death&&target.hit>0){const barW=enemyW*.45;ctx.globalAlpha*=Math.min(1,target.hit*12);ctx.fillStyle='rgba(0,8,16,.6)';ctx.fillRect(target.x-barW/2,target.y-enemyW*.38,barW,3);ctx.fillStyle='#c7eee1';ctx.fillRect(target.x-barW/2,target.y-enemyW*.38,barW*Math.max(0,target.hp/target.maxHp),3);}
   ctx.globalAlpha=1;
 }
 // Two smaller rigged squadmates swim above and below the leading pleco.
 for(let i=0;i<(s.combatReady?2:0);i++){const mate=companionPose(sceneTime,s.chapter,i,width,height),member=encounter?.companions?.[i];ctx.globalAlpha=.82*ease(s.combatTime/.55);rig.draw(ctx,{x:mate.x,y:mate.y,width:mate.width,weapon:member?.weapon||weaponIds[(s.weapon+i+1)%5],armed:member?.armed??true,angle:mate.bank,time:s.progress*84+i*.6,recoil:0,skin:member?.skin||squadSkins[i],facing:1});}ctx.globalAlpha=1;
 const heroAngle=s.battlePhase==='descent'?pose.bank:s.melee||s.handoff?pose.bank*.3:s.combatReady?(combat.aimAngle||pose.bank):pose.bank;
 ctx.globalAlpha=(pose.opacity??1)*handoffOpacity;
 let muzzle={muzzleX:hx+heroW*.4,muzzleY:hy};
 const meleeSheet=images.meleeAnimations?.[skin]?.[s.action];
 if(s.melee&&meleeSheet){
  const tick=Math.min(meleeSheet.ticks-1,Math.floor(s.actionProgress*meleeSheet.ticks));let cumulative=0,frameIndex=0;
  for(let i=0;i<meleeSheet.holds.length;i++){cumulative+=meleeSheet.holds[i];if(tick<cumulative){frameIndex=i;break;}}
  stripSprite(meleeSheet,hx,hy,heroW*meleeSheet.unitScale,frameIndex,heroAngle,false);
 }else muzzle=rig.draw(ctx,{x:hx,y:hy,width:heroW,weapon:weaponIds[s.weapon],armed:s.equip>=1&&!brawler,angle:heroAngle,time:s.progress*84,recoil:s.gunfire?combat.recoil:0,skin,facing:1});
 ctx.globalAlpha=1;
 if(s.chapter===0&&s.introStage==='equip'&&images.weaponLoadouts){
  const equipment=images.weaponLoadouts[s.weapon],q=s.equip;
  const mount=rig.measure({x:hx,y:hy,width:heroW,weapon:weaponIds[s.weapon],angle:heroAngle,time:s.progress*84,skin,facing:1});
  const gx=mount.weaponGripX??hx+heroW*.1,gy=mount.weaponGripY??hy+heroW*.15;
  const scale=Math.hypot(mount.muzzleX-gx,mount.muzzleY-gy)/Math.max(1,Math.hypot(equipment.muzzleX-equipment.anchorX,equipment.muzzleY-equipment.anchorY));
  ctx.save();ctx.translate(gx+(1-q)*width*.3,gy-(1-q)*height*.3);ctx.rotate(heroAngle-(1-q)*1.8);ctx.globalAlpha=Math.min(1,q*6);
  ctx.drawImage(equipment.image,-equipment.anchorX*scale,-equipment.anchorY*scale,equipment.width*scale,equipment.height*scale);ctx.restore();
  ctx.strokeStyle='rgba(181,246,240,'+strAlpha(q)+')';ctx.lineWidth=1;ctx.beginPath();ctx.arc(gx,gy,heroW*.14*(1-q)+5,0,Math.PI*2);ctx.stroke();
 }
 if(s.chapter===0){drawSplash(s);if(sky)drawSurface(ctx,sky,s,width,height,true);}
 if(s.melee){const hit=Math.max(0,1-Math.abs(s.actionProgress-.62)*8),target=combat.targets[s.action==='bite'?1:2];if(hit>0){ctx.strokeStyle='rgba(255,241,178,'+hit+')';ctx.lineWidth=s.action==='punch'?3:2;for(let i=0;i<9;i++){const a=i*Math.PI*2/9;ctx.beginPath();ctx.moveTo(target.x+Math.cos(a)*10,target.y+Math.sin(a)*10);ctx.lineTo(target.x+Math.cos(a)*(14+hit*26),target.y+Math.sin(a)*(14+hit*26));ctx.stroke();}}}

 const plecoName=node('pleco-name');if(plecoName)plecoName.textContent=skin.replaceAll('_',' ').replace('pleco','Pleco');
 const bossName=node('boss-name');if(bossName)bossName.textContent=encounter?.boss?.name||'Depth Guardian';
 const bossTarget=combat.targets[0],bossRatio=Math.max(0,bossTarget.hp/bossTarget.maxHp);
 const bossHealth=node('boss-health');if(bossHealth){bossHealth.hidden=!s.combatReady||!bossTarget.visible||s.battlePhase==='descent';bossHealth.setAttribute('aria-valuenow',Math.round(bossRatio*100));}
 const bossFill=node('boss-health-fill');if(bossFill)bossFill.style.transform='scaleX('+bossRatio+')';
 for(const bullet of combat.bullets)if(s.combatReady&&bullet.active)drawProjectile(ctx,bullet,s.progress*84);
 if(s.gunfire&&combat.flash>0){const r=8+combat.recoil*13;ctx.fillStyle='#fff0a8';ctx.beginPath();ctx.moveTo(muzzle.muzzleX+r,muzzle.muzzleY);for(let i=1;i<12;i++){const a=i*Math.PI/6,rr=i%2?r*.35:r;ctx.lineTo(muzzle.muzzleX+Math.cos(a)*rr,muzzle.muzzleY+Math.sin(a)*rr);}ctx.closePath();ctx.fill();}
 if(s.combatReady&&!reduced)for(const spark of combat.sparks){if(!spark.active)continue;ctx.globalAlpha=1-spark.age/.45;ctx.fillStyle='#ffbc66';ctx.fillRect(spark.x,spark.y,3,3);}ctx.globalAlpha=1;
 const kill=node('kill-count');if(kill)kill.textContent=String(s.combatReady?combat.kills:0).padStart(2,'0');
}
const depth=node('depth-readout');if(depth)depth.textContent=String(s.depth).padStart(4,'0')+' M';const chapter=node('chapter-name');if(chapter)chapter.textContent=labels[s.chapter];const progress=node('progress-fill');if(progress)progress.style.transform='scaleY('+s.progress+')';const weapon=node('weapon-name');if(weapon)weapon.textContent=s.melee?'BITE + PUNCH':s.handoff?'Changing fighter':s.chapter===0&&s.equip<1?'Preparing to dive':guns[s.weapon];document.body.dataset.chapter=String(s.chapter);last=t;
const scrubber=node('combat-scrubber');if(scrubber)scrubber.value=Math.round(s.progress*1000);if(!scrollDriver.settled)request();else if(!pauseTimer)direction('paused');}
function request(){if(!raf)raf=requestAnimationFrame(frame);}
function direction(value){document.body.dataset.scrollDirection=value;const readout=node('scroll-direction');if(readout)readout.textContent=value==='rewind'?'Rewinding':value==='advance'?'Advancing':'Paused';}
addEventListener('scroll',()=>{const delta=scrollY-previousScroll;previousScroll=scrollY;direction(delta<0?'rewind':'advance');clearTimeout(pauseTimer);pauseTimer=setTimeout(()=>{pauseTimer=0;directInput=false;if(scrollDriver.settled)direction('paused');},160);request();},{passive:true});
const scrubber=node('combat-scrubber');if(scrubber)scrubber.addEventListener('input',()=>{immediateSeek=true;directInput=true;const phase=Math.min(5.999999,Number(scrubber.value)/1000*6),index=Math.floor(phase),local=phase-index;const bounds=chapterBounds[index];if(bounds)window.scrollTo({top:bounds.top+local*bounds.height,behavior:'instant'});request();});
addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))directInput=true;});
addEventListener('wheel',()=>{directInput=false;},{passive:true});
addEventListener('touchstart',()=>{directInput=false;},{passive:true});
document.addEventListener('click',event=>{if(event.target.closest?.('a[href^="#"]'))directInput=true;});
addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else request();});
resize();
Promise.all([
 fetch(new URL('./assets/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Asset manifest unavailable');return r.json();}).then(async m=>{const [worlds,enemy,boss,wreckOverlay,enemies]=await Promise.all([Promise.all(m.worlds.map(load)),load(m.enemy),load(m.boss),m.wreckOverlay?load(m.wreckOverlay):null,m.enemies?Promise.all(m.enemies.map(load)):null]);const encounters=m.encounters?await Promise.all(m.encounters.map(async encounter=>({...encounter,portraitImage:encounter.portrait?await load(encounter.portrait):null,enemies:await Promise.all(encounter.enemies.map(async descriptor=>({...descriptor,image:await load(descriptor.path)}))),boss:{...encounter.boss,image:await load(encounter.boss.path)}}))):null;const ambientFish=m.ambientFish?await Promise.all(m.ambientFish.map(async descriptor=>({...descriptor,image:await load(descriptor.path)}))):null;const weaponLoadouts=await Promise.all(m.weaponLoadouts.map(async entry=>({...entry,image:await load(entry.path)})));const meleeAnimations={};await Promise.all(Object.entries(m.meleeAnimations).map(async([skin,states])=>{meleeAnimations[skin]={};await Promise.all(Object.entries(states).map(async([action,entry])=>{meleeAnimations[skin][action]={...entry,image:await load(entry.path),ticks:entry.holds.reduce((a,b)=>a+b,0)};}));}));images={worlds,enemy,boss,wreckOverlay,enemies,encounters,ambientFish,weaponLoadouts,meleeAnimations};}),
 loadRig().then(value=>{rig=value;})
]).then(()=>{document.body.dataset.assets='ready';bakeBackdrops();request();}).catch(error=>{document.body.dataset.assets='error';const status=document.createElement('p');status.className='asset-error';status.textContent='The expedition artwork could not load. Please refresh to try again.';status.setAttribute('role','status');document.body.append(status);console.error(error);request();});
