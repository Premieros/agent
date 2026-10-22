/** Copyright-free ambient soundtrack synthesized on the user's device.
 * No external media, libraries, API calls or database interactions.
 */
export function startAmbientSoundtrack(
 context:AudioContext,destination:AudioNode,durationSeconds:number,startAt=context.currentTime
):OscillatorNode[]{
 const duration=Math.max(1,Math.min(900,durationSeconds));
 const start=Math.max(context.currentTime,startAt);
 const voices=[{hz:110,gain:.014},{hz:164.81,gain:.009},{hz:220,gain:.006}];
 return voices.map(({hz,gain:level},i)=>{
  const oscillator=context.createOscillator();
  oscillator.type="sine";
  const envelope=context.createGain();
  envelope.gain.setValueAtTime(0,start);
  envelope.gain.linearRampToValueAtTime(level,start+Math.min(1,duration/5));
  envelope.gain.setValueAtTime(level,Math.max(start+1,start+duration-1.1));
  envelope.gain.linearRampToValueAtTime(0,start+duration);
  for(let sec=8;sec<duration;sec+=8){
   const shift=(i===0?1:i===1?1.06:.96);
   oscillator.frequency.setTargetAtTime(hz*shift,start+sec,.8);
   oscillator.frequency.setTargetAtTime(hz,start+sec+4,.8);
  }
  oscillator.frequency.setValueAtTime(hz,start);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(start);
  oscillator.stop(start+duration+.15);
  return oscillator;
 });
}
