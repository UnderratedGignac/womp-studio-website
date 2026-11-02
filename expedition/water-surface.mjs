const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{const t=clamp(n);return t*t*(3-2*t)};
export function waterLevel(local,chapter){return chapter===0?.44-ease((local-.43)/.17)*.65:-.25;}
export function makeSky(width,height,makeCanvas){
 const sky=makeCanvas();sky.width=width;sky.height=height;const c=sky.getContext('2d');
 // All gradients and distant scenery are baked once, never shaded per frame.
 const ramp=c.createLinearGradient(0,0,0,height*.46);ramp.addColorStop(0,'#071b2c');ramp.addColorStop(.46,'#15475b');ramp.addColorStop(.83,'#548b96');ramp.addColorStop(1,'#acc5b3');c.fillStyle=ramp;c.fillRect(0,0,width,height);
 const sunX=width*.79,sunY=height*.17,r=Math.min(width,height)*.029;
 const halo=c.createRadialGradient(sunX,sunY,r,sunX,sunY,r*6);halo.addColorStop(0,'rgba(241,222,160,.19)');halo.addColorStop(1,'rgba(241,222,160,0)');c.fillStyle=halo;c.fillRect(sunX-r*6,sunY-r*6,r*12,r*12);
 c.fillStyle='#e6e4be';c.beginPath();c.arc(sunX,sunY,r,0,Math.PI*2);c.fill();
 // Low horizontal cloud veils keep the horizon quiet behind the title.
 c.lineCap='round';
 for(let i=0;i<9;i++){
  const x=width*((i*.217+.11)%1),y=height*(.105+(i%4)*.051);
  c.strokeStyle=i%2?'rgba(178,205,194,.075)':'rgba(13,47,63,.16)';c.lineWidth=height*(.003+(i%3)*.002);
  c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+width*.035,y-height*.007,x+width*.09,y+height*.004,x+width*.15,y);c.stroke();
 }
 // Two separated archipelagos: distinct headlands instead of a repeating wave.
 const island=(points,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(points[0][0]*width,height*.443);for(const [x,y] of points)c.lineTo(x*width,y*height);c.lineTo(points[points.length-1][0]*width,height*.443);c.closePath();c.fill();};
 island([[0,.398],[.045,.386],[.079,.363],[.108,.369],[.136,.393],[.18,.405],[.225,.416],[.28,.433]],'#386574');
 island([[.57,.436],[.635,.418],[.67,.386],[.703,.378],[.735,.394],[.768,.403],[.805,.432]],'#416d77');
 island([[.81,.439],[.858,.414],[.89,.414],[.925,.389],[.949,.384],[.974,.401],[1,.405]],'#214958');
 island([[0,.427],[.025,.414],[.053,.411],[.082,.422],[.107,.431],[.16,.439]],'#163d4d');
 // Sparse trees make the near headland read as land without busy detail.
 c.strokeStyle='#163d4d';c.lineWidth=Math.max(1,width*.0012);
 for(let i=0;i<4;i++){
  const x=width*(.022+i*.012),y=height*(.417+i*.0018),h=height*(.014+(i%2)*.009);
  c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+width*.002,y-h*.6,x+width*.001,y-h);c.stroke();
  c.beginPath();c.moveTo(x-width*.008,y-h*.75);c.quadraticCurveTo(x,y-h*1.25,x+width*.009,y-h*.77);c.stroke();
 }
 c.strokeStyle='rgba(211,230,207,.32)';c.lineWidth=1;c.beginPath();c.moveTo(width*.17,height*.441);c.lineTo(width*.84,height*.441);c.stroke();
 return sky;
}
export function drawSurface(ctx,sky,s,width,height,front=false){
 const level=waterLevel(s.local,s.chapter)*height;if(level< -height*.05)return;
 const phase=s.local*18;
 const amplitude=Math.max(1.2,Math.min(3,height*.004));
 const wave=(x,offset=0)=>level+Math.sin(x/width*26+phase)*amplitude+Math.sin(x/width*57-phase*.7)*amplitude*.3+offset;
 ctx.save();
 if(!front){ctx.drawImage(sky,0,0,width,Math.max(1,level),0,0,width,Math.max(1,level));
  // Narrow translucent water lip; no additional full-screen blend surface.
  ctx.fillStyle='rgba(70,164,179,.24)';ctx.beginPath();ctx.moveTo(0,wave(0));for(let i=0;i<=56;i++){const x=width*i/56;ctx.lineTo(x,wave(x));}ctx.lineTo(width,level+height*.035);ctx.lineTo(0,level+height*.035);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(18,66,83,.7)';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<=56;i++){const x=width*i/56;if(i===0)ctx.moveTo(x,wave(x,5));else ctx.lineTo(x,wave(x,5));}ctx.stroke();
 }
 ctx.lineCap='round';ctx.strokeStyle=front?'rgba(213,249,236,.72)':'rgba(118,221,221,.28)';ctx.lineWidth=front?1.6:1;
 ctx.beginPath();for(let i=0;i<=64;i++){const x=width*i/64,y=wave(x,front?0:9);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
 if(!front){
  // Broken reflections get shorter towards the horizon; their motion is
  // entirely scroll-derived, so scrubbing backwards restores every ripple.
  for(let i=0;i<22;i++){
   const row=i%6,x=width*((i*.173+.037*Math.sin(phase*.22+row))%1),y=level+10+row*height*.009;
   ctx.strokeStyle=i%3?'rgba(145,216,211,.15)':'rgba(225,237,202,.27)';ctx.lineWidth=i%3?1:1.4;
   const length=width*(.009+row*.005);
   ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+length*.5,y+Math.sin(phase+i)*1.4,x+length,y);ctx.stroke();
  }
 }else{
  // Discontinuous foam catches the edge rather than outlining it uniformly.
  ctx.strokeStyle='rgba(239,255,232,.6)';ctx.lineWidth=2;
  for(let i=0;i<8;i++){const x=width*((i*.137+.02)%1),length=width*(.008+(i%3)*.005);ctx.beginPath();ctx.moveTo(x,wave(x)-.5);ctx.lineTo(x+length,wave(x+length)-.5);ctx.stroke();}
 }
 ctx.restore();
}
