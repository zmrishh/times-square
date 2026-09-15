import type { Slot,Vec3 } from './registry';
export const AUDIO_RADIUS=24;
export function proximityGain(distance:number) {
  if(!Number.isFinite(distance)||distance>=AUDIO_RADIUS) return 0;
  const t=Math.max(0,Math.min(1,(AUDIO_RADIUS-distance)/(AUDIO_RADIUS-5)));
  return 0.7*t*t*(3-2*t);
}
/** Distance to the ground projection of a screen, rather than its high centre. */
export function billboardDistance(slot:Slot,position:Vec3) {
  return Math.min(...slot.segments.map(s=>{
    const dx=position[0]-s.position[0],dz=position[2]-s.position[2];
    const normal=dx*Math.sin(s.rotation)+dz*Math.cos(s.rotation);
    if(normal<=0)return Infinity;
    const tangent=dx*Math.cos(s.rotation)-dz*Math.sin(s.rotation);
    return Math.hypot(normal,Math.max(0,Math.abs(tangent)-s.width/2));
  }));
}
let context:AudioContext|null=null;
let requested = false;
export const billboardAudioContext=()=>context;
export async function setBillboardAudio(enabled:boolean) {
  requested = enabled;
  if(enabled){
    if (!context || context.state === 'closed') context = new AudioContext();
    const current = context;
    await current.resume();
    if (context !== current || current.state === 'closed') return false;
    if (!requested) { await current.suspend(); return false; }
    return current.state === 'running';
  }
  await context?.suspend();return false;
}
export async function closeBillboardAudio(){const current=context;context=null;requested=false;await current?.close();}
