const HALF_LIFE_MS=85;
const MAX_STEP_MS=64;
const SNAP_DISTANCE=.0001;
const clamp=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;

/** Presentation-only scroll smoothing. Physics still seeks a pure timeline at
 * the returned position; an idle driver schedules no work of its own.
 *
 * step(nowMs) returns a number. Read .settled to decide whether to request
 * another animation frame. Use target(value,{immediate:true}) for reduced
 * motion, range controls, and deliberate keyboard/navigation jumps.
 */
export function createScrollDriver(initial=0){
 let current=clamp(initial,0),destination=current,lastTime=null;
 function target(value,{immediate=false}={}){
  const next=clamp(value,destination);
  if(immediate){current=destination=next;lastTime=null;return current;}
  if(next===destination)return current;
  const wasSettled=current===destination;
  destination=next;
  if(wasSettled)lastTime=null;
  if(Math.abs(destination-current)<=SNAP_DISTANCE)current=destination;
  return current;
 }
 function step(nowMs){
  if(!Number.isFinite(nowMs))return current;
  if(current===destination){lastTime=null;return current;}
  if(lastTime===null){lastTime=nowMs;return current;}
  const elapsed=Math.min(MAX_STEP_MS,Math.max(0,nowMs-lastTime));
  lastTime=nowMs;
  const weight=1-Math.exp(-Math.LN2*elapsed/HALF_LIFE_MS);
  current+=(destination-current)*weight;
  if(Math.abs(destination-current)<=SNAP_DISTANCE)current=destination;
  return current;
 }
 return {target,step,get current(){return current;},get destination(){return destination;},get settled(){return current===destination;}};
}
