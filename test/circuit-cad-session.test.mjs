// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoardImpl} from 'bw-board';
import {registerAllDevices} from 'bw-board/register-all';
import {createAvr8jsAdapter} from 'bw-board/avr8js-adapter.js';
import {createCoupledSession,validateConnections} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';
registerAllDevices();
const connections={version:1,cadDocumentId:'fixture',enabled:true,drives:[{partId:'motor',jointId:'axle'}]};
export function motorBoard(){
 const b=new BoardImpl(5),t=(part,terminal)=>({part,terminal});
 const bridge=['vcc','gnd','en1','in1','in2','out1','out2','en2','in3','in4','out3','out4'];
 b.setNetlist([
  {id:'uno',kind:'mcu',terminals:['D8','D9','D10','D2','D3'],params:{}},
  {id:'v',kind:'vcc',terminals:['vcc'],params:{}},{id:'g',kind:'gnd',terminals:['gnd'],params:{}},
  {id:'bridge',kind:'h_bridge',terminals:bridge,params:{}},
  {id:'motor',kind:'dc_motor_encoder',terminals:['a','b','enc_a','enc_b'],params:{windingR:10,windingH:0,kV:.2,kT:.2,pulsesPerRev:2}}
 ],[
  ['v',t('v','vcc'),t('bridge','vcc')],['g',t('g','gnd'),t('bridge','gnd')],
  ['en',t('uno','D8'),t('bridge','en1')],['in1',t('uno','D9'),t('bridge','in1')],['in2',t('uno','D10'),t('bridge','in2')],
  ['a',t('motor','a'),t('bridge','out1')],['b',t('motor','b'),t('bridge','out2')],
  ['ea',t('motor','enc_a'),t('uno','D2')],['eb',t('motor','enc_b'),t('uno','D3')]
 ].map(([id,...terminals])=>({id,terminals})));b.setPower(true);return b;
}
// Independent Newtonian rotor oracle, I=0.002 kg m², radians internally.
function inertia(){let angle=0,omega=0,time=0,released=false;return{
 snapshot:()=>({time,angles:{axle:angle*180/Math.PI},speeds:{axle:omega*180/Math.PI},linearPositions:{},linearSpeeds:{},poses:[]}),
 async step(impulses){assert.equal(released,false);omega+=impulses[0].impulse/.002;angle+=omega*.005;time+=.005;return this.snapshot();},
 release(){released=true;}
};}
const drive=(b,forward=true)=>{b.setPin('D8','pushpull',true);b.setPin('D9','pushpull',forward);b.setPin('D10','pushpull',!forward);};
test('a real H-bridge/current/back-EMF drives an independently integrated shaft and reverses',async()=>{
 const b=motorBoard(),m=inertia(),s=await createCoupledSession({board:b,mechanics:m,connections});drive(b);
 for(let i=0;i<60;i++){s.tick(10);await s.idle();}
 assert.ok(s.snapshot().angles.axle>10);assert.ok(s.readings()[0].currentA<.16,'motion reduces current below stall current');assert.ok(b.getDeviceState('motor').count>0);
 const before=s.snapshot().angles.axle;drive(b,false);for(let i=0;i<240;i++){s.tick(5);await s.idle();}
 assert.ok(s.snapshot().angles.axle<before);assert.ok(s.readings()[0].velocityRadS<0);assert.equal(Math.round(s.time),1800);s.stop();assert.equal(b.powered,false);assert.throws(()=>b.takeMechanicalShaftImpulse('motor'));
});
test('a real AVR program drives the bridge and stops it when physical encoder A goes low',async()=>{
 const b=motorBoard(),m=inertia();
 // SBI DDRB0/1/2; SBI PORTB0/1; CBI PORTB2; SBIC PIND2;
 // RJMP back to SBIC; CBI PORTB0 (disable bridge); RJMP self.
 const firmware=createAvr8jsAdapter({program:new Uint16Array([0x9a20,0x9a21,0x9a22,0x9a28,0x9a29,0x982a,0x994a,0xcffe,0x9828,0xcfff])});firmware.attachBoard(b);
 const s=await createCoupledSession({board:b,mechanics:m,connections,firmware});
 for(let i=0;i<200 && b.getDeviceState('motor').count<2;i++){s.tick(10);await s.idle();}
 s.tick(10);await s.idle();assert.ok(b.getDeviceState('motor').count>=2);assert.equal(b.readPin('D8'),0,'AVR executes disable after seeing actual mechanical encoder feedback');assert.ok(s.snapshot().angles.axle>=90);s.stop();
});
test('stop during a mechanical reply discards the stale frame and refuses duplicate connections',async()=>{
 assert.throws(()=>validateConnections({...connections,drives:[...connections.drives,...connections.drives]}));
 const b=motorBoard();let resolve;const m=inertia();m.step=()=>new Promise(r=>{resolve=r;});
 const s=await createCoupledSession({board:b,mechanics:m,connections});drive(b);s.tick(5);await Promise.resolve();
 // Return a late already-computed worker reply after the caller releases ownership.
 const next={...m.snapshot(),time:.005};s.stop();resolve(next);await s.idle();
 assert.equal(s.snapshot().time,0);assert.equal(b.powered,false);
});
test('an old session cannot power off or change shafts after a reset and a new owner',async()=>{
 const b=motorBoard(),old=await createCoupledSession({board:b,mechanics:inertia(),connections});
 b.reset();b.setPower(true);const current=await createCoupledSession({board:b,mechanics:inertia(),connections});drive(b);old.stop();assert.equal(b.powered,true);current.tick(5);await current.idle();assert.ok(current.readings()[0].currentA>0);current.stop();
});
