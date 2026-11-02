const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = __dirname;
test('all authentic expedition assets resolve locally', () => {
 const manifest = JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 assert.equal(manifest.worlds.length,6);
 assert.equal(manifest.weapons.length,5);
 for(const value of [manifest.hero,...manifest.weapons,manifest.enemy,manifest.boss,...manifest.worlds]) {
  const file=path.resolve(root,value);
  assert.ok(file.startsWith(root+path.sep));
  assert.ok(fs.statSync(file).size>1000,value);
 }
});
test('scroll timeline is finite, deterministic and reversible at every percent', async () => {
 const {sample}=await import(pathToFileURL(path.join(root,'timeline.mjs')));
 const forward = Array.from({length:1001},(_,i)=>sample(i/1000));
 for(let i=1000;i>=0;i--){
  const s=sample(i/1000);
  assert.deepEqual(s,forward[i]);
  const inspect=(v)=>{if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(inspect)};
  inspect(s);
  assert.ok(s.chapter>=0&&s.chapter<=5);
  assert.ok(s.local>=0&&s.local<=1);
  if(i)assert.ok(s.depth>=forward[i-1].depth);
 }
 assert.equal(sample(0).chapter,0);
 assert.equal(sample(1).chapter,5);
});

test('canvas renderer boots and paints each chapter without browser APIs beyond canvas', async () => {
 const vm=require('node:vm');
 const {createScrollDriver}=await import(pathToFileURL(path.join(root,'scroll-driver.mjs')));
 const {sample}=await import(pathToFileURL(path.join(root,'timeline.mjs')));
 const {createCombat,CHAPTER_SECONDS}=await import(pathToFileURL(path.join(root,'combat.mjs')));
 const {makeSky,drawSurface,waterLevel}=await import(pathToFileURL(path.join(root,'water-surface.mjs')));
 const {drawProjectile,weaponIds}=await import(pathToFileURL(path.join(root,'projectiles/index.mjs')));
 const {heroPose,companionPose,schoolPose,combatToSceneTime}=await import(pathToFileURL(path.join(root,'choreography.mjs')));
 const loadRig=async()=>({draw:()=>({muzzleX:800,muzzleY:400,painted:7}),measure:()=>({muzzleX:800,muzzleY:400,painted:0})});
 let paints=0;
 const ctx=new Proxy({}, {get:(t,k)=>(k==='createLinearGradient'||k==='createRadialGradient')?()=>({addColorStop(){}}):k==='drawImage'?()=>{paints++}:()=>{},set:(t,k,v)=>{t[k]=v;return true}});
 const canvas={getContext:()=>ctx,style:{}};
 const nodes=Object.fromEntries(['depth-readout','chapter-name','progress-fill','weapon-name','reveal-card','card-stage','intro-stage'].map(k=>[k,{style:{},textContent:'',addEventListener(){},setAttribute(){}}]));
 const sections=Array.from({length:6},(_,i)=>({offsetTop:i*1000,offsetHeight:1000}));
 let frame;
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const sandbox={createScrollDriver,makeSky,drawSurface,waterLevel,sample,createCombat,CHAPTER_SECONDS,drawProjectile,weaponIds,heroPose,companionPose,schoolPose,combatToSceneTime,loadRig,URL,console,innerWidth:1280,innerHeight:720,devicePixelRatio:2,scrollY:0,matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>{frame=fn;return 1},cancelAnimationFrame(){},addEventListener(){},Image:class{constructor(){this.width=666;this.height=384;}set src(v){queueMicrotask(()=>this.onload())}decode(){return Promise.resolve()}},fetch:async()=>({ok:true,json:async()=>manifest}),document:{hidden:false,documentElement:{scrollHeight:6000},querySelector:()=>canvas,querySelectorAll:()=>sections,getElementById:k=>nodes[k],createElement:tag=>tag==='canvas'?{getContext:()=>ctx}:{setAttribute(){},style:{}},addEventListener(){},body:{dataset:{},append(){}}}};
 sandbox.window=sandbox;
 let code=fs.readFileSync(path.join(root,'main.js'),'utf8').replace(/^import[^\n]+\n/gm,'').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(path.join(root,'main.js')).href));
 vm.runInNewContext(code,sandbox);
 await new Promise(r=>setTimeout(r,20));
 assert.equal(sandbox.document.body.dataset.assets,'ready');
 frame(0);assert.equal(nodes['reveal-card'].style.opacity,'1');assert.equal(nodes['intro-stage'].textContent,'Choose your fighter');
 sandbox.scrollY=510;frame(1);assert.equal(nodes['reveal-card'].style.opacity,'0');assert.equal(nodes['intro-stage'].textContent,'Gear up');
 sandbox.scrollY=0;frame(2);assert.equal(nodes['reveal-card'].style.opacity,'1');
 for(let i=0;i<6;i++){sandbox.scrollY=i*1000;frame(i*16);}
 assert.ok(paints>12);
 assert.ok(nodes['depth-readout'].textContent.length>0);
});
test('hero uses the current game rig and weapon geometry instead of legacy sprite strips', () => {
 const data=JSON.parse(fs.readFileSync(path.join(root,'rig/plecoRigData.json'),'utf8'));
 assert.ok(data.skins.cleaner);
 const art=[];
 for(const skin of Object.values(data.skins))for(const a of Object.values(skin))if(a?.image)art.push(a.image);
 for(const gun of Object.values(data.weapons))art.push(gun.image);
 for(const file of art)assert.ok(fs.statSync(path.join(root,'rig/art',file)).size>0,file);
 const main=fs.readFileSync(path.join(root,'main.js'),'utf8');
 assert.ok(main.includes("loadRig"));
 assert.ok(main.includes('combat.seek(s.combatTime,s.weapon)'));
 assert.equal(/heroSwim|heroIdle|images\.hero/.test(main),false);
 for(const name of ['SkeletonData','Skeleton','AnimationState','SkelRenderer','rigWeaponModel']){
  const current=fs.readFileSync(path.resolve(root,'../test-fixtures/game/src/pleco/rig',name+'.js'),'utf8');
  const copy=fs.readFileSync(path.join(root,'rig',name+'.mjs'),'utf8');
  assert.equal(copy.replaceAll('.mjs','.js').replaceAll('\r\n','\n'),current.replaceAll('.mjs','.js').replaceAll('\r\n','\n'),name+' must match game runtime');
 }
});


test('website projectile physics and gun silhouettes retain canonical game source',()=>{
 const normalize=s=>s.replace(/from '\.\/math\.mjs'/g,"from '../utils/math.js'").replaceAll('\r\n','\n');
 for(const [web,game] of [['projectileMotion.mjs','effects/projectileMotion.js'],['gunRoundBodies.mjs','armory/gunRoundBodies.js']]){
  assert.equal(normalize(fs.readFileSync(path.join(root,'projectiles',web),'utf8')),normalize(fs.readFileSync(path.resolve(root,'../test-fixtures/game/src',game),'utf8')),web);
 }
});
test('all five website weapon profiles preserve the game class values',async()=>{
 const source=fs.readFileSync(path.resolve(root,'../test-fixtures/game/src/pleco/config/plecoDefenseStats.js'),'utf8');
 const literal=source.match(/export const WEAPON_CONFIGS = (\{[\s\S]*?\n\});/)[1];
 const canonical=Function('return ('+literal+')')();
 const {profiles}=await import(pathToFileURL(path.join(root,'projectiles/profiles.mjs')));
 for(const p of Object.values(profiles))for(const [field,value] of Object.entries(canonical[p.weaponType]))assert.equal(p[field],value,p.id+'.'+field);
 assert.equal(profiles.shotgun.pellets,3);
 assert.equal(profiles.minigun.motion,'flat');
 assert.equal(profiles.railgun.motion,'ballistic');
});
test('each world has authentic animated enemies, a boss and an available pleco skin',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const rig=JSON.parse(fs.readFileSync(path.join(root,'rig/plecoRigData.json'),'utf8'));
 assert.equal(manifest.encounters.length,6);
 assert.ok(new Set(manifest.encounters.map(e=>e.skin)).size>=5);
 assert.ok(new Set(manifest.encounters.map(e=>e.boss.id)).size>=5);
 for(const encounter of manifest.encounters){assert.ok(rig.skins[encounter.skin]);for(const a of [...encounter.enemies,encounter.boss]){assert.equal(a.frames,4);assert.ok(a.frameWidth>0&&a.frameHeight>0);assert.ok(fs.statSync(path.resolve(root,a.path)).size>1000);}}
 assert.ok(manifest.ambientFish.length>=3);
 for(const a of manifest.ambientFish){assert.ok(a.frames>=4);assert.ok(fs.statSync(path.resolve(root,a.path)).size>1000);}
});
test('showcase plecos carry weapons permitted by their actual game classes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const source=fs.readFileSync(path.resolve(root,'../test-fixtures/game/src/pleco/config/plecoDefenseStats.js'),'utf8');
 const weaponClasses=['pistol','pistol','shotgun','smg','sniper','cannon'];
 manifest.encounters.forEach((e,i)=>{const line=source.split('\n').find(line=>line.trimStart().startsWith(e.skin+':'));assert.ok(line,e.skin);const cls=line.match(/plecoClass:\s*'([^']+)'/)[1];assert.ok(cls==='gunner'||cls==='sniper'&&weaponClasses[i]==='sniper',e.skin+' cannot carry '+weaponClasses[i]);});
});
test('advanced sea arsenal uses actual rig definitions and distinct canonical rounds',async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const rig=JSON.parse(fs.readFileSync(path.join(root,'rig/plecoRigData.json'),'utf8'));
 const full=JSON.parse(fs.readFileSync(path.resolve(root,'../test-fixtures/game/src/pleco/data/plecoRigData.json'),'utf8'));
 const {weaponIds,profiles}=await import(pathToFileURL(path.join(root,'projectiles/index.mjs')));
 assert.equal(weaponIds.length,5);assert.deepEqual(manifest.weaponLoadouts.map(w=>w.id),weaponIds);
 for(const w of manifest.weaponLoadouts){assert.deepEqual(rig.weapons[w.id],full.weapons[w.id]);assert.ok(profiles[w.id]);assert.ok(fs.statSync(path.resolve(root,w.path)).size>1000);assert.ok(w.muzzleX>w.anchorX);}
 assert.ok(fs.statSync(path.resolve(root,manifest.introCard)).size>1000);
});
test('opening stages reveal, enter, splash, equip and fight in a reversible order',async()=>{
 const {introState,heroPose,combatToSceneTime}=await import(pathToFileURL(path.join(root,'choreography.mjs')));
 const stages=[[0,'card'],[.20,'reveal'],[.38,'dive'],[.51,'equip'],[.7,'combat'],[.94,'descent']];
 for(const [p,stage] of stages)assert.equal(introState(p).introStage,stage);
 assert.equal(introState(0).heroOpacity,0);assert.equal(introState(0).cardOpacity,1);
 assert.equal(introState(.31).cardOpacity,0);assert.equal(introState(.44).splashActive,true);
 assert.equal(introState(.51).combatReady,false);assert.equal(introState(.51).combatTime,0);
 assert.equal(introState(.59).equip,1);assert.equal(introState(.59).combatReady,true);
 assert.ok(heroPose(.32*14,0,1280,720).y<heroPose(.44*14,0,1280,720).y);
 const forward=Array.from({length:1001},(_,i)=>introState(i/1000));
 for(let i=1000;i>=0;i--)assert.deepEqual(introState(i/1000),forward[i]);
 for(const t of [0,1,5,10,12,14])assert.ok(Math.abs(introState(combatToSceneTime(t,0)/14).combatTime-t)<.00001);
});
test('water surface precedes the dive and scroll pauses isolate authentic melee attacks',async()=>{
 const {waterLevel}=await import(pathToFileURL(path.join(root,'water-surface.mjs')));
 const {heroPose,battleBeat,battleClock}=await import(pathToFileURL(path.join(root,'choreography.mjs')));
 assert.equal(waterLevel(0,0),.44);assert.ok(waterLevel(.61,0)<0);
 assert.ok(heroPose(.30*14,0,1280,720).y<waterLevel(.30,0)*720);
 assert.ok(heroPose(.42*14,0,1280,720).y>waterLevel(.42,0)*720);
 for(let chapter=0;chapter<6;chapter++){
  const pause=chapter===0?[.665,.685]:[.415,.465];assert.equal(battleClock(pause[0],chapter),4);assert.equal(battleClock(pause[1],chapter),4);
  assert.equal(battleBeat(pause[0],chapter).handoff,true);assert.equal(battleBeat(pause[1],chapter).gunfire,false);
 }
 const {createCombat}=await import(pathToFileURL(path.join(root,'combat.mjs')));const c=createCombat();c.layout(1280,720,0);c.seek(14,0);
 assert.ok(c.cache.shots.every(shot=>shot.time<4||shot.time>=7.1&&shot.time<11));
 assert.ok(c.cache.events.some(e=>e.attack==='bite'));assert.ok(c.cache.events.some(e=>e.attack==='punch'));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const source=JSON.parse(fs.readFileSync(path.resolve(root,'../test-fixtures/game/src/pleco/data/plecoSpriteData.json'),'utf8'));
 for(const [skin,states]of Object.entries(manifest.meleeAnimations))for(const [action,d]of Object.entries(states)){
  const layout=source.layouts['pet_'+skin+'_'+action];assert.equal(d.frames,layout.count);assert.equal(d.fps,layout.fps);assert.equal(d.unitScale,layout.unitScale);assert.ok(fs.statSync(path.resolve(root,d.path)).size>1000);
 }
});
