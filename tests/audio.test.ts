import test from 'node:test';
import assert from 'node:assert/strict';
import {proximityGain,billboardDistance,AUDIO_RADIUS} from '../src/lib/billboard-audio';
import {SLOTS} from '../src/lib/registry';
test('billboard audio is silent outside radius and fades monotonically near the ground projection',()=>{
 assert.equal(proximityGain(AUDIO_RADIUS),0);assert.equal(proximityGain(Infinity),0);
 assert.equal(proximityGain(0),0.7);assert.ok(proximityGain(6)>proximityGain(15));
 const slot=SLOTS[0],s=slot.segments[0];
 const front:[number,number,number]=[s.position[0]+5*Math.sin(s.rotation),1.72,s.position[2]+5*Math.cos(s.rotation)];
 assert.ok(Math.abs(billboardDistance(slot,front)-5)<0.001);
 assert.equal(billboardDistance(slot,[s.position[0]-5*Math.sin(s.rotation),1.72,s.position[2]-5*Math.cos(s.rotation)]),Infinity);
});
