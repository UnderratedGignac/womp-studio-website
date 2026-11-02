import test from 'node:test';
import assert from 'node:assert/strict';
import {heroPose,actorPose} from './choreography.mjs';

// Stage joins used to rotate abruptly at the leap apex and equip handoff.
test('intro path and pitch remain continuous across authored stage joins',()=>{
 for(const local of [.26,.30,.32,.45,.58,.66,.69,.75,.78,.85]){
  const before=heroPose((local-.000001)*14,0,1280,720),after=heroPose((local+.000001)*14,0,1280,720);
  assert.ok(Math.abs(after.x-before.x)<.1,'x at '+local);
  assert.ok(Math.abs(after.y-before.y)<.1,'y at '+local);
  assert.ok(Math.abs(after.bank-before.bank)<.001,'pitch at '+local);
 }
});
test('world transitions carry the same downward direction beyond visible edges',()=>{
 for(let chapter=0;chapter<5;chapter++){
  const exit=heroPose(14,chapter,1280,720),entry=heroPose(0,chapter+1,1280,720);
  assert.ok(exit.y>720+exit.width/2);assert.ok(entry.y< -entry.width/2);
  assert.equal(exit.x,entry.x);assert.ok(Math.abs(exit.bank-entry.bank)<.001);
 }
});
test('melee approaches are continuous and enemy loop resets are offscreen',()=>{
 for(let chapter=0;chapter<6;chapter++){
  for(const [index,joins]of [[1,[4,5.5]],[2,[5.5,7]]])for(const t of joins){
   const a=actorPose(t-.000001,chapter,index,1280,720),b=actorPose(t+.000001,chapter,index,1280,720);
   assert.ok(Math.abs(a.x-b.x)<.1);assert.ok(Math.abs(a.y-b.y)<.1);
  }
  for(let index=1;index<4;index++){
   const t=index*.23+9.6;
   for(const at of [t-.000001,t+.000001]){const p=actorPose(at,chapter,index,1280,720);assert.ok(p.x-p.width/2>1280);}
  }
 }
});
