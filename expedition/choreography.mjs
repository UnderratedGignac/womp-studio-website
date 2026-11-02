const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
export function introState(local){
 const p=clamp(local),flip=smooth((p-.17)/.12),equip=smooth((p-.45)/.13),splash=clamp((p-.40)/.12);
 const introStage=p<.17?'card':p<.30?'reveal':p<.45?'dive':p<.58?'equip':p<.85?'combat':'descent';
 const combatTime=battleClock(p,0);
 return {introStage,cardOpacity:1-smooth((p-.24)/.06),cardRotation:flip*180,heroOpacity:smooth((p-.235)/.035),waterEntry:smooth((p-.30)/.15),splash,splashActive:p>=.40&&p<.52,equip,combatTime,combatReady:p>=.58};
}
const FIRST_BEATS=[[.58,0],[.66,4],[.69,4],[.75,7],[.78,7],[.85,11],[1,14]];
const DEPTH_BEATS=[[0,0],[.12,0],[.40,4],[.48,4],[.72,7],[.80,7],[.90,11],[1,14]];
export function battleClock(local,chapter){
 const points=chapter===0?FIRST_BEATS:DEPTH_BEATS,p=clamp(local);if(p<=points[0][0])return 0;
 for(let i=1;i<points.length;i++)if(p<=points[i][0]){const [a,x]=points[i-1],[b,y]=points[i];return x+(y-x)*(p-a)/(b-a);}
 return 14;
}
export function combatToSceneTime(time,chapter){
 const points=chapter===0?FIRST_BEATS:DEPTH_BEATS,t=Math.max(0,Math.min(14,time));
 for(let i=1;i<points.length;i++){const [a,x]=points[i-1],[b,y]=points[i];if(y>x&&t<=y)return (a+(b-a)*(t-x)/(y-x))*14;}
 return 14;
}
export function battleBeat(local,chapter){
 const t=battleClock(local,chapter),p=clamp(local),first=chapter===0;
 const start=first?.58:.12,swapA=first?.66:.40,meleeStart=first?.69:.48,swapB=first?.75:.72,finalStart=first?.78:.80,end=first?.85:.90;
 let phase=p<start?'briefing':p<swapA?'ranged':p<meleeStart?'change-to-brawler':p<swapB?(t<5.5?'bite':'punch'):p<finalStart?'change-to-gunner':p<end?'final-assault':'descent';
 if(first&&p<.58)phase='intro';
 const handoff=phase==='change-to-brawler'||phase==='change-to-gunner';
 const swapProgress=phase==='change-to-brawler'?(p-swapA)/(meleeStart-swapA):phase==='change-to-gunner'?(p-swapB)/(finalStart-swapB):phase==='briefing'?p/start:0;
 const melee=phase==='bite'||phase==='punch';
 const actionProgress=melee?((t-(phase==='bite'?4:5.5))%.75)/.75:0;
 return {battlePhase:phase,combatTime:t,melee,meleeSkin:chapter%2?'cleaner':'cow_pleco',action:melee?phase:null,actionProgress,handoff,swapProgress:clamp(swapProgress),combatReady:p>=start,gunfire:phase==='ranged'||phase==='final-assault'};
}
/** Creature poses are shared by visible draw, muzzle baking, and collisions. */
export function heroPose(time,chapter,width,height){
 const t=Math.max(0,Math.min(14,time)),p=t/14,dive=smooth((p-(chapter===0?.85:.90))/(chapter===0?.15:.10));
 if(chapter===0){const intro=introState(p);let x=.69,y=.46,bank=-.8;
  if(p<.30){const lift=smooth((p-.235)/.065);y=.46-lift*.61;bank=-1.05+2.2*smooth((p-.26)/.06);}
  else if(p<.45){x=.69-.03*intro.waterEntry;y=-.15+intro.waterEntry*.79;bank=-1.05+2.2*smooth((p-.26)/.06)-intro.waterEntry*.6;}
  else if(p<.58){x=.66-.07*intro.equip;y=.64-.07*intro.equip;bank=.55*(1-intro.equip);}
  else {const clock=Math.min(11,intro.combatTime);x=.59+.045*Math.sin(clock*.72);y=.57+.1*Math.sin(clock*.58);bank=.1*(1-Math.exp(-clock*3))*Math.cos(clock*.58);if(p>.85){x+=(.72-x)*dive;y+=(1.38-y)*dive;bank+=(1.05-bank)*dive;}}
  return {x:width*x,y:height*y,bank,width:Math.min(width*.25,390),facing:1,opacity:intro.heroOpacity};
 }
 const entry=smooth(p/.12),clock=battleClock(p,chapter);
 const cruiseX=.575+.045*Math.sin(clock*.72+chapter*.23),cruiseY=.53+.10*Math.sin(clock*.58+chapter*.41);
 return {x:width*((.72+(cruiseX-.72)*entry)*(1-dive)+.72*dive),
 y:height*((-.34+(cruiseY+.34)*entry)*(1-dive)+1.38*dive),
 bank:(1.05+(.11*Math.cos(clock*.58+chapter*.41)-1.05)*entry)*(1-dive)+1.05*dive,
 width:Math.min(width*.25,390),facing:1,opacity:1};
}
export function actorPose(time,chapter,index,width,height,weapon=0){
 const boss=index===0,phase=time*.8+index*1.73+chapter*.37;
 const launch=boss?2.2:index*.23,age=Math.max(0,time-launch);
 const entrance=smooth(age/(boss?2:1.1));
 const hero=heroPose(combatToSceneTime(time,chapter),chapter,width,height);
 // Enemies keep swimming inbound, attack, peel away, and make another pass.
 const period=4.8,cycle=age%period,inbound=boss?entrance:smooth(cycle/(period*.64));
 const outbound=boss?0:smooth((cycle/period-.68)/.32);
 const startX=boss?1.26:1.21+(index%2)*.08;
 const contactX=hero.x/width+(boss?.23:weapon===1?.13:.18)+(index%2)*.025;
 let x=width*(startX+(contactX-startX)*inbound*(1-outbound));
 const lane=[.27,.34,.64,.78][index];
 let y=height*((lane+(hero.y/height-lane)*inbound*(boss?.22:.55))+Math.sin(phase)*.025);
 // Ease into and out of the close-combat lane instead of teleporting a victim.
 const meleeStart=index===1?4:index===2?5.5:100;
 const meleeEnd=meleeStart+1.5;
 const grapple=smooth((time-meleeStart)/.22)*(1-smooth((time-(meleeEnd-.22))/.22));
 x+=(hero.x+width*.17-x)*grapple;y+=(hero.y+height*.025-y)*grapple;
 const charge=smooth((inbound-.65)/.35);
 return {x,y,index,boss,visible:age>0&&(!boss||entrance>.12),alpha:boss?entrance:Math.min(1,age*3),
 rotation:Math.sin(phase)*.05,facing:outbound>.12&&grapple<.5?1:-1, radius:Math.min(width*(boss?.068:.04),boss?85:48),
 width:Math.min(width*(boss?.255:.115),boss?350:160),frame:charge>.6?2:Math.floor(time*5+index)%2,charge};
}
export function companionPose(time,chapter,index,width,height){
 const hero=heroPose(time,chapter,width,height);
 return {x:Math.max(width*.47,hero.x-width*(.035+index*.095)),y:hero.y+height*(index?.18:-.18)+Math.sin(time*.8+index)*height*.035,
 width:hero.width*.48,bank:Math.sin(time*.7+index)*.12,facing:1};
}
export function schoolPose(time,index,width,height){
 const phase=(time*.025+index*.173)%1;
 return {x:width*(-.12+phase*1.24),y:height*(.16+(index%3)*.3)+Math.sin(time*.7+index)*height*.025,width:width*(.025+(index%3)*.008),flip:true};
}
