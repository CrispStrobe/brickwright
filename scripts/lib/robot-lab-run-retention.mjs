// SPDX-License-Identifier: BSD-3-Clause
import {openSync,writeFileSync,closeSync} from 'node:fs';
export function retainFrame(track,frame,retain=true){if(retain)track.push(frame);else track[0]=frame;}
export function createMotorSummary(){return {samples:0,finite:true,min:Infinity,max:-Infinity,commanded:false,modes:new Set()};}
export function observeMotorSummary(s,v){s.samples++;s.finite&&=Number.isFinite(v.position);s.min=Math.min(s.min,v.position);s.max=Math.max(s.max,v.position);s.commanded ||= v.nonzeroDrive===true;s.modes.add(v.mode);}
export function finishMotorSummary(s){const finite=s.samples>1&&s.finite,travelDeg=finite?s.max-s.min:null,moved=finite&&travelDeg>=0.1;return {samples:s.samples,commanded:s.commanded,modes:[...s.modes],travelDeg,moved,status:!finite?'NONFINITE_OR_NO_OBSERVATIONS':moved?(s.commanded?'MOVED':'UNCOMMANDED_MOVED'):s.commanded?'COMMANDED_STATIONARY':'UNCOMMANDED_STATIONARY'};}
export function createMeasurementWriter(path,metadata){
    const fd=openSync(path,'wx');let closed=false,count=0;
    try{writeFileSync(fd,JSON.stringify(metadata).slice(0,-1)+',"samples":[');}catch(error){closeSync(fd);throw error;}
    return {append(value){if(closed)throw Error('Measurement stream closed');const text=JSON.stringify(value);writeFileSync(fd,(count?',':'')+text);count++;},finish(){if(closed)return;try{writeFileSync(fd,']}\n');}finally{closed=true;closeSync(fd);}},abort(){if(!closed){closed=true;closeSync(fd);}},get count(){return count;}};
}
