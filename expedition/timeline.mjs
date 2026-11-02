import {heroPose,introState,battleBeat} from './choreography.mjs';
export const CHAPTERS = ['surface', 'coral', 'wreck', 'crystal', 'volcanic', 'abyss'];
export function sample(progress) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const phase = p * 6;
  const chapter = Math.min(5, Math.floor(phase));
  const local = p === 1 ? 1 : phase - chapter;
  const dive = Math.max(0,Math.min(1,(local-(chapter===0?.85:.90))/(chapter===0?.15:.10)));
  const weapon = [0,0,1,2,3,4][chapter];
  const pose=heroPose(local*14,chapter,1,1);
  const intro=chapter===0?introState(local):{introStage:'combat',cardOpacity:0,cardRotation:180,heroOpacity:1,waterEntry:1,splash:1,splashActive:false,equip:1,combatTime:local*14,combatReady:true};
  return { ...intro,...battleBeat(local,chapter), progress:p, chapter, index:chapter, local, time:local*14, depth:Math.round(p * 2400), weapon,
    heroX:pose.x, heroY:pose.y,
    rotation:pose.bank, transition:dive*dive*(3-2*dive),
    attack:local < .88,
    shot:((local * (chapter === 2 ? 15 : 9)) % 1), boss:chapter === 5 };
}
