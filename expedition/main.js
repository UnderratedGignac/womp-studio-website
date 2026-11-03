import {makeSky,drawSurface,waterLevel} from './water-surface.mjs';
import {sample} from './timeline.mjs';
import {createCombat,CHAPTER_SECONDS} from './combat.mjs';
import {drawProjectile,weaponIds,profiles,createVolley,stepProjectile} from './projectiles/index.mjs';
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
let cardFoilX=0,cardFoilY=0,autoDive=true,soundEnabled=false,audioCtx=null,lastSoundShotTime=-1;
let userInteractTimer=0,userInteracting=false,diveLoopTimer=0;
function pauseAutoDive(){
 if(!autoDive)return;
 userInteracting=true;
 clearTimeout(userInteractTimer);
 userInteractTimer=setTimeout(()=>{
  userInteracting=false;
  if(autoDive)request();
 },3000);
}

const dots=Array.from({length:42},(_,i)=>({
 x:((i*73+19)%101)/101,
 y:((i*43+7)%97)/97,
 r:1+(i%4)*.85,
 speed:7+i%11,
 phase:(i*1.37)%6.28
}));

const rays=Array.from({length:6},(_,i)=>({
 x:.12+i*.16,
 w:.045+(i%3)*.022,
 skew:.18+(i%2)*.05,
 speed:.35+i*.09,
 phase:i*1.1
}));

function playSynthSfx(kind,weaponIdx=0){
 if(!soundEnabled||typeof AudioContext==='undefined'&&typeof webkitAudioContext==='undefined')return;
 try{
  if(!audioCtx){const Ctx=window.AudioContext||window.webkitAudioContext;audioCtx=new Ctx();}
  if(audioCtx.state==='suspended')audioCtx.resume();
  const now=audioCtx.currentTime;
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  osc.connect(gain);gain.connect(audioCtx.destination);
  if(kind==='shot'){
   const baseFreq=[320,160,440,680,110][weaponIdx]||280;
   osc.type=weaponIdx===3?'sawtooth':weaponIdx===4?'triangle':'sine';
   osc.frequency.setValueAtTime(baseFreq,now);
   osc.frequency.exponentialRampToValueAtTime(48,now+.09);
   gain.gain.setValueAtTime(.045,now);
   gain.gain.exponentialRampToValueAtTime(.001,now+.095);
   osc.start(now);osc.stop(now+.1);
  }else if(kind==='melee'){
   osc.type='triangle';
   osc.frequency.setValueAtTime(140,now);
   osc.frequency.exponentialRampToValueAtTime(38,now+.14);
   gain.gain.setValueAtTime(.07,now);
   gain.gain.exponentialRampToValueAtTime(.001,now+.15);
   osc.start(now);osc.stop(now+.16);
  }else if(kind==='ping'){
   osc.type='sine';
   osc.frequency.setValueAtTime(580,now);
   osc.frequency.exponentialRampToValueAtTime(880,now+.18);
   gain.gain.setValueAtTime(.04,now);
   gain.gain.exponentialRampToValueAtTime(.001,now+.22);
   osc.start(now);osc.stop(now+.24);
  }
 }catch(_){}
}

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
 if(card){
  card.style.opacity=String(s.cardOpacity);
  const tiltX=reduced?0:cardFoilY*-8*(1-s.cardRotation/180);
  const tiltY=reduced?0:(s.cardRotation+cardFoilX*11*(1-s.cardRotation/180));
  card.style.transform='translateY('+(-s.cardRotation*.13)+'px) rotateX('+tiltX+'deg) rotateY('+tiltY+'deg) rotate('+(-5+s.cardRotation*.035)+'deg)';
 }
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
  copy.style.opacity=String(1-retreat*.55);
  copy.style.transform=reduced?'none':'translate3d(0,'+(-retreat*12)+'px,0)';
 }
 if(activeChapter!==s.chapter){
  activeChapter=s.chapter;
  worldLinks.forEach((link,i)=>{link.classList?.toggle('active',i===s.chapter);if(i===s.chapter)link.setAttribute?.('aria-current','step');else link.removeAttribute?.('aria-current');});
 }
 const end=chapterBounds[5];document.body.dataset.studio=String(!!end&&scrollY>end.top+end.height-height*.35);
}

function drawOceanAtmosphere(s,ambient){
 if(reduced)return;
 const ch=s.chapter;
 const topY=ch===0?Math.max(0,waterLevel(s.local,0)*height):0;
 ctx.save();
 // Volumetric sunbeams in upper chapters (0, 1, 2)
 if(ch<=2){
  const rayFade=ch===0?Math.max(0,1-waterLevel(s.local,0)*1.3):ch===1?.85:.42;
  for(const r of rays){
   const sway=Math.sin(ambient*r.speed+r.phase)*width*.03;
   const x0=width*r.x+sway,w0=width*r.w;
   const grad=ctx.createLinearGradient(x0,topY,x0+width*r.skew,height);
   grad.addColorStop(0,'rgba(162,248,238,'+(0.11*rayFade)+')');
   grad.addColorStop(.55,'rgba(88,218,225,'+(0.045*rayFade)+')');
   grad.addColorStop(1,'rgba(12,68,92,0)');
   ctx.fillStyle=grad;
   ctx.beginPath();
   ctx.moveTo(x0,topY);
   ctx.lineTo(x0+w0,topY);
   ctx.lineTo(x0+w0*2.4+width*r.skew,height);
   ctx.lineTo(x0-w0*.4+width*r.skew,height);
   ctx.closePath();
   ctx.fill();
  }
 }
 // Biome-specific particles (crystal glints, volcanic embers, abyssal bioluminescence)
 const biomeColors=['#a6f4e8','#7ef5e1','#8de8c2','#c89eff','#ff9a52','#ff5c8a'];
 const pColor=biomeColors[ch]||'#7ef5e1';
 for(let i=0;i<18;i++){
  const seed=i*37.7+ch*13.1;
  const px=((seed*19.3)%1)*width+Math.sin(ambient*.45+i)*22;
  const py=(((seed*29.1)%1)*height-ambient*(6+(i%5)*3)+height*10)%height;
  if(ch===0&&py<topY+12)continue;
  const pulse=.35+.65*(.5+.5*Math.sin(ambient*1.6+i*1.9));
  ctx.globalAlpha=pulse*.45;
  ctx.fillStyle=pColor;
  ctx.beginPath();
  ctx.arc(px,py,1.5+(i%3)*1.1,0,Math.PI*2);
  ctx.fill();
 }
 ctx.restore();
 ctx.globalAlpha=1;
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
 if(autoDive&&!userInteracting&&!reduced&&chapterBounds.length===6){
  const docHeight=(document.documentElement?.scrollHeight||document.body?.scrollHeight||0);
  const maxScroll=Math.max(chapterBounds[5].top+chapterBounds[5].height,docHeight-height-20);
  if(scrollY<maxScroll){window.scrollBy?.(0,1.0);}
  else{
   if(!diveLoopTimer){
    diveLoopTimer=setTimeout(()=>{
     window.scrollTo?.({top:0,behavior:'smooth'});
     diveLoopTimer=0;
    },3000);
   }
  }
 }
 scrollDriver.target(scrollProgress(),{immediate:reduced||immediateSeek||directInput});immediateSeek=false;
 const s=sample(scrollDriver.step(t));updateIntro(s);updateStory(s);
 cover(backgrounds[s.chapter],1,s.progress*84);
 if(s.chapter<5&&s.transition)cover(backgrounds[s.chapter+1],s.transition,s.progress*84);
 if(s.chapter===0&&sky)drawSurface(ctx,sky,s,width,height);
 const ambient=reduced?0:s.progress*84;
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
  if(s.gunfire&&combat.flash>.07&&Math.abs(s.combatTime-lastSoundShotTime)>.12){lastSoundShotTime=s.combatTime;playSynthSfx('shot',s.weapon);}
  // Small authentic fish schools establish depth behind the combat lane.
  ctx.save();if(s.chapter===0){ctx.beginPath();ctx.rect(0,Math.max(0,waterLevel(s.local,0)*height),width,height);ctx.clip();}
  if(images.ambientFish)for(let i=0;i<9;i++){const fish=schoolPose(s.progress*84,i,width,height),descriptor=images.ambientFish[i%images.ambientFish.length];ctx.globalAlpha=.28+(i%3)*.12;stripSprite(descriptor,fish.x,fish.y,fish.width,Math.floor(sceneTime*(descriptor.fps*0.4)+i)%descriptor.frames,0,fish.flip);}ctx.restore();ctx.globalAlpha=1;
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
    if(!death&&target.hit>0){const barW=enemyW*.48;ctx.globalAlpha*=Math.min(1,target.hit*12);ctx.fillStyle='rgba(0,8,16,.68)';ctx.fillRect(target.x-barW/2,target.y-enemyW*.38,barW,4);ctx.fillStyle='#7ef5e1';ctx.fillRect(target.x-barW/2,target.y-enemyW*.38,barW*Math.max(0,target.hp/target.maxHp),4);}
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
   ctx.strokeStyle='rgba(181,246,240,'+strAlpha(q)+')';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(gx,gy,heroW*.14*(1-q)+5,0,Math.PI*2);ctx.stroke();
  }
  if(s.chapter===0){drawSplash(s);if(sky)drawSurface(ctx,sky,s,width,height,true);}
  if(s.melee){
   const hit=Math.max(0,1-Math.abs(s.actionProgress-.62)*8),target=combat.targets[s.action==='bite'?1:2];
   if(hit>0){
    ctx.save();
    ctx.strokeStyle='rgba(255,241,178,'+hit+')';ctx.lineWidth=s.action==='punch'?3.2:2.2;
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9;ctx.beginPath();ctx.moveTo(target.x+Math.cos(a)*10,target.y+Math.sin(a)*10);ctx.lineTo(target.x+Math.cos(a)*(16+hit*32),target.y+Math.sin(a)*(16+hit*32));ctx.stroke();}
    ctx.beginPath();ctx.arc(target.x,target.y,18+(1-hit)*42,0,Math.PI*2);ctx.stroke();
    ctx.restore();
   }
  }

  const plecoName=node('pleco-name');if(plecoName)plecoName.textContent=skin.replaceAll('_',' ').replace('pleco','Pleco');
  const bossName=node('boss-name');if(bossName)bossName.textContent=encounter?.boss?.name||'Depth Guardian';
  const bossTarget=combat.targets[0],bossRatio=Math.max(0,bossTarget.hp/bossTarget.maxHp);
  const bossHealth=node('boss-health');if(bossHealth){bossHealth.hidden=!s.combatReady||!bossTarget.visible||s.battlePhase==='descent';bossHealth.setAttribute('aria-valuenow',Math.round(bossRatio*100));}
  const bossFill=node('boss-health-fill');if(bossFill)bossFill.style.transform='scaleX('+bossRatio+')';
  for(const bullet of combat.bullets){
   if(!s.combatReady||!bullet.active)continue;
   drawProjectile(ctx,bullet,s.progress*84);
  }
  if(s.gunfire&&combat.flash>0){
   const r=9+combat.recoil*15;
   ctx.fillStyle='#fff0a8';ctx.beginPath();ctx.moveTo(muzzle.muzzleX+r,muzzle.muzzleY);
   for(let i=1;i<12;i++){const a=i*Math.PI/6,rr=i%2?r*.35:r;ctx.lineTo(muzzle.muzzleX+Math.cos(a)*rr,muzzle.muzzleY+Math.sin(a)*rr);}
   ctx.closePath();ctx.fill();
   if(!reduced){
    ctx.save();
    ctx.strokeStyle='rgba(255,230,150,'+(combat.recoil*.55)+')';
    ctx.lineWidth=1.8;
    ctx.beginPath();
    ctx.arc(muzzle.muzzleX,muzzle.muzzleY,r*1.45,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
   }
  }
  if(s.combatReady&&!reduced)for(const spark of combat.sparks){if(!spark.active)continue;ctx.globalAlpha=1-spark.age/.45;ctx.fillStyle='#ffbc66';ctx.fillRect(spark.x,spark.y,3.5,3.5);}ctx.globalAlpha=1;
  const kill=node('kill-count');if(kill)kill.textContent=String(s.combatReady?combat.kills:0).padStart(2,'0');
 }
 const depth=node('depth-readout');if(depth)depth.textContent=String(s.depth).padStart(4,'0')+' M';const chapter=node('chapter-name');if(chapter)chapter.textContent=labels[s.chapter];const progress=node('progress-fill');if(progress)progress.style.transform='scaleY('+s.progress+')';const weapon=node('weapon-name');if(weapon)weapon.textContent=s.melee?'BITE + PUNCH':s.handoff?'Changing fighter':s.chapter===0&&s.equip<1?'Preparing to dive':guns[s.weapon];document.body.dataset.chapter=String(s.chapter);last=t;
 const scrubber=node('combat-scrubber');if(scrubber)scrubber.value=Math.round(s.progress*1000);
 if(!scrollDriver.settled||autoDive)request();else if(!pauseTimer)direction('paused');
}
function request(){if(!raf)raf=requestAnimationFrame(frame);}
function direction(value){document.body.dataset.scrollDirection=value;const readout=node('scroll-direction');if(readout)readout.textContent=value==='rewind'?'Rewinding':value==='advance'?'Advancing':'Paused';}
addEventListener('scroll',()=>{const delta=scrollY-previousScroll;previousScroll=scrollY;direction(delta<0?'rewind':'advance');clearTimeout(pauseTimer);pauseTimer=setTimeout(()=>{pauseTimer=0;directInput=false;if(scrollDriver.settled)direction('paused');},160);request();},{passive:true});
const scrubber=node('combat-scrubber');if(scrubber)scrubber.addEventListener('input',()=>{immediateSeek=true;directInput=true;pauseAutoDive();const phase=Math.min(5.999999,Number(scrubber.value)/1000*6),index=Math.floor(phase),local=phase-index;const bounds=chapterBounds[index];if(bounds)window.scrollTo({top:bounds.top+local*bounds.height,behavior:'instant'});request();});
addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)){directInput=true;pauseAutoDive();}});
addEventListener('wheel',()=>{directInput=false;pauseAutoDive();},{passive:true});
addEventListener('touchstart',()=>{directInput=false;pauseAutoDive();},{passive:true});
document.addEventListener('click',event=>{if(event.target?.closest?.('a[href^="#"]'))directInput=true;});
addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else request();});

// Interactive UI wiring for browser environment (safely guarded for headless test sandboxes)
function bootInteractiveShowcase(){
 const autoBtn=node('auto-dive-btn');
 if(autoBtn?.addEventListener){
  autoBtn.setAttribute('aria-pressed',String(autoDive));
  const lbl=node('auto-dive-label');
  if(lbl)lbl.textContent=autoDive?'Cruising...':'Auto-Dive';
  autoBtn.addEventListener('click',()=>{
   autoDive=!autoDive;
   userInteracting=false;
   autoBtn.setAttribute('aria-pressed',String(autoDive));
   const lbl=node('auto-dive-label');
   if(lbl)lbl.textContent=autoDive?'Cruising...':'Auto-Dive';
   if(autoDive)request();
  });
 }
 const soundBtn=node('sound-toggle-btn');
 if(soundBtn?.addEventListener){
  soundBtn.addEventListener('click',()=>{
   soundEnabled=!soundEnabled;
   soundBtn.setAttribute('aria-pressed',String(soundEnabled));
   const lbl=node('sound-toggle-label');
   if(lbl)lbl.textContent=soundEnabled?'FX On':'Sound FX';
   if(soundEnabled)playSynthSfx('ping');
  });
 }
 // 3D Holographic Card Pointer Tilt & Card Picker
 addEventListener('pointermove',e=>{
  if(reduced||!innerWidth||!innerHeight)return;
  cardFoilX=(e.clientX/innerWidth-.5)*2;
  cardFoilY=(e.clientY/innerHeight-.5)*2;
  const card=node('reveal-card');
  if(card?.style?.setProperty){
   card.style.setProperty('--foil-x',Math.round((cardFoilX*.5+.5)*100)+'%');
   card.style.setProperty('--foil-y',Math.round((cardFoilY*.5+.5)*100)+'%');
   card.style.setProperty('--shimmer-x',Math.round(cardFoilX*45)+'%');
   if(scrollY<height*.4)request();
  }
 },{passive:true});

 const pills=Array.from(document.querySelectorAll('.card-pill'));
 for(const pill of pills){
  if(!pill?.addEventListener)continue;
  pill.addEventListener('click',()=>{
   pills.forEach(p=>p.classList?.remove('active'));
   pill.classList?.add('active');
   const img=node('card-portrait'),num=node('card-number'),cls=node('card-class-badge'),title=node('card-title'),lore=node('card-lore');
   if(img&&pill.dataset?.cardImg)img.setAttribute('src',pill.dataset.cardImg);
   if(num&&pill.dataset?.cardNum)num.textContent=pill.dataset.cardNum;
   if(cls&&pill.dataset?.cardClass)cls.textContent=pill.dataset.cardClass;
   if(title&&pill.dataset?.cardTitle)title.innerHTML=pill.dataset.cardTitle.replace(' ','<br>');
   if(lore&&pill.dataset?.cardLore)lore.innerHTML=pill.dataset.cardLore.replace('. ','.<br>');
   playSynthSfx('ping');
  });
 }

 // Gameplay Screenshot Gallery Filtering & Lightbox
 const shotTabs=Array.from(document.querySelectorAll('[data-shot-filter]'));
 const shotCards=Array.from(document.querySelectorAll('.shot-card'));
 for(const tab of shotTabs){
  if(!tab?.addEventListener)continue;
  tab.addEventListener('click',()=>{
   const filter=tab.dataset?.shotFilter||'all';
   shotTabs.forEach(t=>t.classList?.toggle('active',t===tab));
   shotCards.forEach(card=>{
    const show=filter==='all'||card.dataset?.shotCat===filter;
    card.hidden=!show;
   });
  });
 }
 const lightbox=node('shot-lightbox'),lbImg=node('lightbox-img'),lbTitle=node('lightbox-title'),lbClose=node('lightbox-close-btn');
 for(const card of shotCards){
  if(!card?.addEventListener)continue;
  card.addEventListener('click',()=>{
   if(!lightbox)return;
   if(lbImg)lbImg.setAttribute('src',card.dataset?.shotSrc||'');
   if(lbTitle)lbTitle.textContent=card.dataset?.shotTitle||'Gameplay Capture';
   lightbox.hidden=false;
  });
 }
 if(lbClose?.addEventListener)lbClose.addEventListener('click',()=>{if(lightbox)lightbox.hidden=true;});
 if(lightbox?.addEventListener)lightbox.addEventListener('click',e=>{if(e.target===lightbox)lightbox.hidden=true;});
}

// Interactive Armory & Bestiary Canvases (booted once assets and rig are ready)
function bootCodexCanvases(){
 const armoryCanvas=node('armory-canvas');
 const sanctuaryCanvas=node('sanctuary-canvas');
 const bestiaryGrid=node('bestiary-grid');
 if(!armoryCanvas?.getContext||!images||!rig)return;

 // 1. ARMORY LAB LOOP
 const actx=armoryCanvas.getContext('2d');
 let armorySkin='cleaner',armoryWeaponIdx=0,armoryMode='fire',armoryAim=0;
 const armoryBolts=[];
 let lastBurst=0;

 function spawnArmoryVolley(superBurst=false){
  const wId=weaponIds[armoryWeaponIdx];
  const w=armoryCanvas.width,h=armoryCanvas.height;
  const mount=rig.measure({x:w*.34,y:h*.52,width:250,weapon:wId,angle:armoryAim,time:performance.now()/1000,skin:armorySkin,facing:1});
  const count=superBurst?3:1;
  for(let c=0;c<count;c++){
   const bolts=createVolley(wId,{
    x:mount.muzzleX,y:mount.muzzleY,
    angle:armoryAim+(c-(count-1)/2)*.12,
    target:{x:w*.82,y:h*.5,dead:false}
   });
   armoryBolts.push(...bolts);
  }
  playSynthSfx('shot',armoryWeaponIdx);
 }

 function updateArmoryReadout(){
  const r=node('armory-readout'),st=node('armory-stats-pill');
  const wId=weaponIds[armoryWeaponIdx],prof=profiles[wId];
  const niceSkin=armorySkin.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  if(r)r.textContent=niceSkin+' · '+guns[armoryWeaponIdx];
  if(st&&prof)st.textContent='DMG '+prof.dmgMul+'× · '+prof.fireRate+' RPS · '+prof.pellets+' Pellet'+(prof.pellets>1?'s':'');
 }

 const skinBtns=Array.from(document.querySelectorAll('.skin-btn'));
 for(const b of skinBtns){
  b.addEventListener?.('click',()=>{
   armorySkin=b.dataset.skin||'cleaner';
   skinBtns.forEach(x=>x.classList?.toggle('active',x===b));
   updateArmoryReadout();
   playSynthSfx('ping');
  });
 }
 const weaponBtns=Array.from(document.querySelectorAll('.weapon-pick-btn'));
 for(const b of weaponBtns){
  b.addEventListener?.('click',()=>{
   armoryWeaponIdx=Number(b.dataset.weaponIdx)||0;
   weaponBtns.forEach(x=>x.classList?.toggle('active',x===b));
   if(armoryMode==='swim'){armoryMode='fire';}
   updateArmoryReadout();
   spawnArmoryVolley(false);
  });
 }
 const modeBtns=Array.from(document.querySelectorAll('[data-armory-mode]'));
 for(const b of modeBtns){
  b.addEventListener?.('click',()=>{
   armoryMode=b.dataset.armoryMode||'fire';
   modeBtns.forEach(x=>x.classList?.toggle('active',x===b));
   if(armoryMode==='bite'||armoryMode==='punch')playSynthSfx('melee');
  });
 }
 const burstBtn=node('armory-burst-btn');
 burstBtn?.addEventListener?.('click',()=>{armoryMode='fire';spawnArmoryVolley(true);});
 armoryCanvas.addEventListener?.('pointermove',e=>{
  const rect=armoryCanvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*(armoryCanvas.width/Math.max(1,rect.width));
  const my=(e.clientY-rect.top)*(armoryCanvas.height/Math.max(1,rect.height));
  armoryAim=Math.max(-.55,Math.min(.55,Math.atan2(my-armoryCanvas.height*.52,mx-armoryCanvas.width*.34)));
 });
 armoryCanvas.addEventListener?.('click',()=>spawnArmoryVolley(true));

 // 2. SANCTUARY TANK & BESTIARY DATA
 const sctx=sanctuaryCanvas?.getContext?.('2d');
 let coralBg=null;
 const sanctuaryFish=[];
 const pellets=[];
 const creatureCanvases=[];

 // Load ../img/manifest.json + ../img/backdrop-coral-sm.webp for the Sanctuary Tank & Bestiary
 fetch(new URL('../img/manifest.json',import.meta.url)).then(r=>r.ok?r.json():[]).then(async list=>{
  try{coralBg=await load('../img/backdrop-coral-sm.webp');}catch(_){}
  const loadedSpecies=await Promise.all(list.map(async item=>{
   try{
    const im=await load('../'+item.file);
    return {...item,image:im,kind:'sanctuary',role:'Sanctuary Species'};
   }catch(_){return null;}
  }));
  const validSanctuary=loadedSpecies.filter(Boolean);
  validSanctuary.forEach((sp,idx)=>{
   sanctuaryFish.push({
    descriptor:sp,
    x:80+(idx*77)%1000,
    y:65+(idx*53)%250,
    vx:(idx%2?1:-1)*(sp.speed||60)*.55,
    vy:Math.sin(idx)*12,
    w:Math.max(46,Math.min(110,(sp.radius||15)*4.2)),
    phase:idx*1.3
   });
  });

  // Populate Bestiary Codex Cards (Sanctuary + Hostile Enemies + Bosses)
  if(bestiaryGrid&&bestiaryGrid.appendChild){
   const allCreatures=[...validSanctuary];
   const seenIds=new Set();
   if(images.encounters){
    for(const enc of images.encounters){
     for(const en of enc.enemies||[]){
      if(!seenIds.has(en.id)&&en.image){
       seenIds.add(en.id);
       allCreatures.push({id:en.id,name:en.name,image:en.image,frames:en.frames||4,fps:3.5,kind:'enemy',role:'Hostile Raider'});
      }
     }
     if(enc.boss&&!seenIds.has(enc.boss.id)&&enc.boss.image){
      seenIds.add(enc.boss.id);
      allCreatures.push({id:enc.boss.id,name:enc.boss.name,image:enc.boss.image,frames:enc.boss.frames||4,fps:3,kind:'boss',role:'Abyssal Boss'});
     }
    }
   }
   allCreatures.forEach(cr=>{
    const card=document.createElement('article');
    card.className='creature-card';
    card.dataset.kind=cr.kind;
    const c=document.createElement('canvas');
    c.className='creature-canvas';
    c.width=160;c.height=96;
    const badge=document.createElement('span');
    badge.className='creature-role';
    badge.textContent=cr.role;
    const title=document.createElement('strong');
    title.textContent=cr.name;
    const sub=document.createElement('small');
    sub.textContent=(cr.frames||3)+' Frames · '+(cr.speed?cr.speed+' Swim Spd':'Combat Sheet');
    card.append(c,badge,title,sub);
    bestiaryGrid.appendChild(card);
    creatureCanvases.push({canvas:c,ctx:c.getContext('2d'),cr,card});
   });

   const filterTabs=Array.from(document.querySelectorAll('[data-bestiary-filter]'));
   for(const tab of filterTabs){
    tab.addEventListener?.('click',()=>{
     const f=tab.dataset.bestiaryFilter||'all';
     filterTabs.forEach(t=>t.classList?.toggle('active',t===tab));
     creatureCanvases.forEach(item=>{
      item.card.hidden=!(f==='all'||item.cr.kind===f);
     });
    });
   }
  }
 }).catch(()=>{});

 function dropFeast(cx,cy){
  for(let i=0;i<6;i++){
   pellets.push({x:cx+(Math.random()-.5)*90,y:cy+(Math.random()-.5)*30,r:4,age:0});
  }
  playSynthSfx('ping');
 }
 sanctuaryCanvas?.addEventListener?.('click',e=>{
  const rect=sanctuaryCanvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)*(sanctuaryCanvas.width/Math.max(1,rect.width));
  const y=(e.clientY-rect.top)*(sanctuaryCanvas.height/Math.max(1,rect.height));
  dropFeast(x,y);
 });
 node('drop-food-btn')?.addEventListener?.('click',()=>dropFeast(sanctuaryCanvas.width*.5,60));

 // Unified 60fps animation loop for visible Codex canvases
 let prevNow=performance.now();
 function tickCodex(now){
  const dt=Math.min(.05,(now-prevNow)/1000);
  prevNow=now;
  const sec=now/1000;
  // Only paint when near the bottom / outro section to save GPU during upper dive
  if(scrollY>height*1.5){
   // A) Paint Armory Canvas
   if(actx){
    const w=armoryCanvas.width,h=armoryCanvas.height;
    actx.clearRect(0,0,w,h);
    const g=actx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#082f46');g.addColorStop(1,'#031320');
    actx.fillStyle=g;actx.fillRect(0,0,w,h);
    // Subtle target dummy on the right
    const dummyX=w*.82,dummyY=h*.5+Math.sin(sec*2.2)*18;
    actx.strokeStyle='rgba(126,245,225,0.28)';actx.lineWidth=2;
    actx.beginPath();actx.arc(dummyX,dummyY,38,0,Math.PI*2);actx.stroke();
    actx.beginPath();actx.arc(dummyX,dummyY,20,0,Math.PI*2);actx.stroke();
    const firstBoss=images.encounters?.[activeChapter>=0?activeChapter:0]?.boss;
    if(firstBoss?.image){
     const fw=firstBoss.image.width/(firstBoss.frames||4),bh=110*firstBoss.image.height/fw;
     actx.save();actx.translate(dummyX,dummyY);actx.scale(-1,1);
     actx.drawImage(firstBoss.image,(Math.floor(sec*3)%4)*fw,0,fw,firstBoss.image.height,-55,-bh/2,110,bh);
     actx.restore();
    }
    if(armoryMode==='fire'){
     const wId=weaponIds[armoryWeaponIdx],prof=profiles[wId];
     const interval=1/Math.max(1,prof?.fireRate||2.5);
     if(sec-lastBurst>=interval){lastBurst=sec;spawnArmoryVolley(false);}
    }
    const meleeKey=images.meleeAnimations?.[armorySkin]?armorySkin:'cleaner';
    const mSheet=images.meleeAnimations?.[meleeKey]?.[armoryMode];
    if((armoryMode==='bite'||armoryMode==='punch')&&mSheet?.image){
     const fIdx=Math.floor(sec*5)%mSheet.frames;
     const fw=mSheet.image.width/mSheet.frames, dw=250*mSheet.unitScale, dh=dw*mSheet.image.height/fw;
     actx.save();actx.translate(w*.38,h*.52);
     actx.drawImage(mSheet.image,fIdx*fw,0,fw,mSheet.image.height,-dw/2,-dh/2,dw,dh);
     actx.restore();
    }else{
     const recoil=Math.max(0,1-(sec-lastBurst)*9);
     rig.draw(actx,{
      x:w*.34,y:h*.52+Math.sin(sec*2.4)*8,
      width:250,weapon:weaponIds[armoryWeaponIdx],
      armed:armoryMode!=='swim',
      angle:armoryAim,time:sec*1.4,recoil,skin:armorySkin,facing:1
     });
    }
    for(let i=armoryBolts.length-1;i>=0;i--){
     const b=armoryBolts[i];
     if(!stepProjectile(b,dt,{x:dummyX,y:dummyY,dead:false})||b.x>w+40||Math.hypot(b.x-dummyX,b.y-dummyY)<36){
      armoryBolts.splice(i,1);continue;
     }
     drawProjectile(actx,b,sec*10);
    }
   }

   // B) Paint Sanctuary Coral Tank
   if(sctx&&sanctuaryCanvas){
    const sw=sanctuaryCanvas.width,sh=sanctuaryCanvas.height;
    if(coralBg)sctx.drawImage(coralBg,0,0,sw,sh);
    else{sctx.fillStyle='#073b54';sctx.fillRect(0,0,sw,sh);}
    // Draw pellets
    for(let i=pellets.length-1;i>=0;i--){
     const p=pellets[i];
     p.y+=28*dt;p.age+=dt;
     if(p.y>sh-20||p.age>8){pellets.splice(i,1);continue;}
     sctx.fillStyle='#ffd166';
     sctx.beginPath();sctx.arc(p.x,p.y,p.r,0,Math.PI*2);sctx.fill();
    }
    // Update & draw 14 fish species
    for(const f of sanctuaryFish){
     if(pellets.length){
      const target=pellets[0];
      const dx=target.x-f.x,dy=target.y-f.y,dist=Math.hypot(dx,dy);
      if(dist<22){pellets.shift();}
      else if(dist<320){
       f.vx+=(dx/dist)*180*dt;
       f.vy+=(dy/dist)*180*dt;
      }
     }
     const maxSpd=(f.descriptor.speed||65)*1.15;
     const curSpd=Math.hypot(f.vx,f.vy);
     if(curSpd>maxSpd){f.vx=f.vx/curSpd*maxSpd;f.vy=f.vy/curSpd*maxSpd;}
     f.x+=f.vx*dt;
     f.y+=f.vy*dt+Math.sin(sec*2+f.phase)*10*dt;
     if(f.x<45){f.x=45;f.vx=Math.abs(f.vx);}
     if(f.x>sw-45){f.x=sw-45;f.vx=-Math.abs(f.vx);}
     if(f.y<45){f.y=45;f.vy=Math.abs(f.vy)*.5;}
     if(f.y>sh-45){f.y=sh-45;f.vy=-Math.abs(f.vy)*.5;}
     const im=f.descriptor.image,frames=f.descriptor.frames||3,fw=im.width/frames,fh=im.height;
     const dw=f.w,dh=dw*fh/fw;
     const frameIdx=Math.floor(sec*((f.descriptor.fps||5)*0.4)+f.phase)%frames;
     sctx.save();
     sctx.translate(f.x,f.y);
     if(f.vx<0)sctx.scale(-1,1);
     sctx.drawImage(im,frameIdx*fw,0,fw,fh,-dw/2,-dh/2,dw,dh);
     sctx.restore();
     }
     }

     // C) Paint Bestiary Sprite Cards
     for(const item of creatureCanvases){
     if(item.card.hidden||!item.ctx)continue;
     const cctx=item.ctx,cw=item.canvas.width,ch=item.canvas.height,cr=item.cr,im=cr.image;
     cctx.clearRect(0,0,cw,ch);
     const frames=cr.frames||4,fw=im.width/frames,fh=im.height;
     const scale=Math.min((cw-16)/fw,(ch-12)/fh);
     const dw=fw*scale,dh=fh*scale;
     const fIdx=Math.floor(sec*((cr.fps||6)*0.4))%frames;
    cctx.save();
    cctx.translate(cw/2,ch/2+Math.sin(sec*2.5)*3);
    cctx.drawImage(im,fIdx*fw,0,fw,fh,-dw/2,-dh/2,dw,dh);
    cctx.restore();
   }
  }
  if(!reduced)requestAnimationFrame(tickCodex);
 }
 requestAnimationFrame(tickCodex);
}

resize();
bootInteractiveShowcase();

Promise.all([
 fetch(new URL('./assets/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Asset manifest unavailable');return r.json();}).then(async m=>{const [worlds,enemy,boss,wreckOverlay,enemies]=await Promise.all([Promise.all(m.worlds.map(load)),load(m.enemy),load(m.boss),m.wreckOverlay?load(m.wreckOverlay):null,m.enemies?Promise.all(m.enemies.map(load)):null]);const encounters=m.encounters?await Promise.all(m.encounters.map(async encounter=>({...encounter,portraitImage:encounter.portrait?await load(encounter.portrait):null,enemies:await Promise.all(encounter.enemies.map(async descriptor=>({...descriptor,image:await load(descriptor.path)}))),boss:{...encounter.boss,image:await load(encounter.boss.path)}}))):null;const ambientFish=m.ambientFish?await Promise.all(m.ambientFish.map(async descriptor=>({...descriptor,image:await load(descriptor.path)}))):null;const weaponLoadouts=await Promise.all(m.weaponLoadouts.map(async entry=>({...entry,image:await load(entry.path)})));const meleeAnimations={};await Promise.all(Object.entries(m.meleeAnimations).map(async([skin,states])=>{meleeAnimations[skin]={};await Promise.all(Object.entries(states).map(async([action,entry])=>{meleeAnimations[skin][action]={...entry,image:await load(entry.path),ticks:entry.holds.reduce((a,b)=>a+b,0)};}));}));images={worlds,enemy,boss,wreckOverlay,enemies,encounters,ambientFish,weaponLoadouts,meleeAnimations};}),
 loadRig().then(value=>{rig=value;})
]).then(()=>{document.body.dataset.assets='ready';bakeBackdrops();bootCodexCanvases();request();}).catch(error=>{document.body.dataset.assets='error';const status=document.createElement('p');status.className='asset-error';status.textContent='The expedition artwork could not load. Please refresh to try again.';status.setAttribute('role','status');document.body.append(status);console.error(error);request();});
