import test from 'node:test';
import assert from 'node:assert/strict';
import {createScrollDriver} from './scroll-driver.mjs';

test('first frame rebases the clock and settled endpoints are exact',()=>{
 const driver=createScrollDriver();assert.equal(driver.settled,true);
 driver.target(1);assert.equal(driver.settled,false);
 assert.equal(driver.step(900000),0);
 assert.ok(driver.step(900016)>0);
 for(let time=900032;!driver.settled&&time<905000;time+=16)driver.step(time);
 assert.equal(driver.current,1);assert.equal(driver.settled,true);
 assert.equal(driver.step(1e9),1);
 driver.target(.25);assert.equal(driver.step(1e9+1000),1);
});

test('exponential response is independent of normal display refresh rate',()=>{
 const run=interval=>{const driver=createScrollDriver();driver.target(1);driver.step(0);for(let t=interval;t<=240;t+=interval)driver.step(t);return driver.current;};
 assert.ok(Math.abs(run(16)-run(8))<1e-12);
 const half=createScrollDriver();half.target(1);half.step(0);half.step(42.5);half.step(85);
 assert.ok(Math.abs(half.current-.5)<1e-12);
});

test('rapid reverse retargeting responds immediately without crossing the goal',()=>{
 const driver=createScrollDriver(.2);driver.target(.9);driver.step(0);driver.step(32);
 const before=driver.current;driver.target(.05);const reversed=driver.step(48);
 assert.ok(reversed<before&&reversed>.05);
 driver.target(.8);assert.ok(driver.step(64)>reversed);
 for(let i=0;i<200;i++){const goal=i%2?.1:.9,previous=driver.current;driver.target(goal);const next=driver.step(80+i*16);assert.ok(next>=Math.min(previous,goal)&&next<=Math.max(previous,goal));}
});

test('immediate targets snap and leave no trailing animation',()=>{
 const driver=createScrollDriver();driver.target(1);driver.step(0);driver.step(16);
 assert.equal(driver.target(.73,{immediate:true}),.73);
 assert.equal(driver.current,.73);assert.equal(driver.destination,.73);assert.equal(driver.settled,true);
 assert.equal(driver.step(5000),.73);
});

test('invalid input, reversed clocks and long stalls remain bounded',()=>{
 const driver=createScrollDriver(NaN);assert.equal(driver.current,0);
 driver.target(Infinity);assert.equal(driver.destination,0);
 driver.target(2);assert.equal(driver.destination,1);driver.step(100);const held=driver.step(NaN);assert.equal(held,0);
 const advanced=driver.step(1e8);assert.ok(advanced>0&&advanced<.5);
 assert.equal(driver.step(0),advanced);
 driver.target(-2,{immediate:true});assert.equal(driver.current,0);
 driver.target(NaN);assert.equal(driver.settled,true);
});
