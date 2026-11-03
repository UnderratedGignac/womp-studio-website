const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{const t=clamp(n);return t*t*(3-2*t)};
export function waterLevel(local,chapter){return chapter===0?.44-ease((local-.43)/.17)*.65:-.25;}
export function makeSky(width,height,makeCanvas){
 const sky=makeCanvas();sky.width=width;sky.height=height;const c=sky.getContext('2d');
 const ramp=c.createLinearGradient(0,0,0,height*.46);
 ramp.addColorStop(0,'#051624');
 ramp.addColorStop(.55,'#0d3549');
 ramp.addColorStop(1,'#1e5b6e');
 c.fillStyle=ramp;
 c.fillRect(0,0,width,height);
 return sky;
}
export function drawSurface(ctx,sky,s,width,height,front=false){
 const level=waterLevel(s.local,s.chapter)*height;if(level< -height*.05)return;
 const phase=s.local*18;
 const amplitude=Math.max(1,Math.min(2.2,height*.003));
 const wave=(x,offset=0)=>level+Math.sin(x/width*22+phase)*amplitude+offset;
 ctx.save();
 if(!front){
  ctx.drawImage(sky,0,0,width,Math.max(1,level),0,0,width,Math.max(1,level));
  ctx.fillStyle='rgba(70,164,179,.18)';
  ctx.beginPath();ctx.moveTo(0,wave(0));
  for(let i=0;i<=56;i++){const x=width*i/56;ctx.lineTo(x,wave(x));}
  ctx.lineTo(width,level+height*.025);ctx.lineTo(0,level+height*.025);ctx.closePath();ctx.fill();
 }
 ctx.lineCap='round';
 ctx.strokeStyle=front?'rgba(213,249,236,.55)':'rgba(118,221,221,.22)';
 ctx.lineWidth=front?1.4:1;
 ctx.beginPath();
 for(let i=0;i<=64;i++){const x=width*i/64,y=wave(x,front?0:5);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
 ctx.stroke();
 ctx.restore();
}
