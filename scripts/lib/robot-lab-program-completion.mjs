// SPDX-License-Identifier: BSD-3-Clause
// Completion is stricter than a finite smoke run. Unreviewed output contracts stay gaps.
export const PROGRAM_OUTPUT_CONTRACTS = {
    'toggle-lever': {terminal: 'completed', part: 'jaw_lever', description: 'Passive jaw lever arc and return to saved pose', minTravelM: 0.001, drive: 'commanded-motion', terminalValues: {stage: 4}, message: 'ToggleLever complete: compare the passive lever arc with the link closure.'},
    'cross-ratio': {terminal:'completed',part:'output_beam',relativeTo:'pivot_key_B',description:'Passive crossed-linkage output rotation',minRotationDeg:0.1,drive:'commanded-motion',terminalValues:{stage:10,movingMask:0},message:'Complete: compare the crossed half-angle relation and changing gain. Input A holds at its saved datum.'},
    samebeat: {terminal:'completed',part:'pendulum_ballast',relativeTo:'pendulum_support_axle',description:'Free pendulum swing while input is held',minTravelM:0.001,observeWhen:{stage:2,held:1},drive:'commanded-motion',terminalValues:{stage:2,held:1,targetA:0},message:'Complete. The input holds zero; the pendulum can keep swinging freely.'},
    twistspan: {terminal:'completed',part:'payload_bar',relativeTo:'upper_bar',description:'Passive beam rotation relative to held upper bar',minRotationDeg:0.1,observeWhen:{held:1},drive:'commanded-motion',terminalValues:{stage:2,held:1,targetA:0},message:'Complete. A holds zero; the passive beam is free to keep ringing down.'},
    footfall: {terminal:'done',part:'lower_triangle_h_FG',localPointLdu:[0,0,140],relativeTo:'frame_top_X_AP',referencePointLdu:[0,-20,140],description:'Authored foot G path relative to chassis P',minTravelM:0.001,drive:'commanded-motion',terminalValues:{phase:99,targetA:0},message:'Footfall cycle complete. Compare the traced path and reset before repeating.'},
    phasekeeper: {terminal:'done',part:'output_pointer',relativeTo:'output_bearing_upper',description:'Output pointer rotation relative to bearing',minRotationDeg:0.1,drive:'commanded-motion',terminalValues:{phase:99,targetA:0},message:'Phasekeeper cycle complete. Compare the blue shaft and orange pointer, then reset before repeating.'},
    vectorsum: {terminal:'done',part:'output_pointer_tip',relativeTo:'bench_rail_40_-100',description:'Authored differential output pointer point path',minTravelM:0.001,drive:'commanded-motion',terminalValues:{phase:99,targetA:0,targetB:0},message:'VectorSum cycle complete. Compare the red carrier and orange pointer, then reset before repeating.'},
    pointweaver: {terminal: 'done', part: 'endpoint_marker', relativeTo: 'base_cross_-40', description: 'Five-bar endpoint loop and return to saved pose', minTravelM: 0.001, drive: 'commanded-motion', terminalValues: {phase: 99}, message: 'PointWeaver loop complete. Compare the dashed straight edges with the endpoint path, then reset before repeating.'}
};
// Ask the product API for the authored measurement point. A nearby marker tip can
// rotate about that point, so its path cannot substitute for the named origin.
const conjugate=q=>[-q[0],-q[1],-q[2],q[3]];
const multiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
export const rotatePoint=(q,p)=>multiply(multiply(q,[...p,0]),conjugate(q)).slice(0,3);
export function orientationTravelDeg(a,b) {
    const denominator=Math.hypot(...a)*Math.hypot(...b);
    if(!denominator)return NaN;
    const cosine=Math.min(1,Math.abs(a.reduce((v,x,i)=>v+x*b[i],0))/denominator);
    return cosine>1-1e-15?0:2*Math.acos(cosine)*180/Math.PI;
}
export function readOutputPose(api, contract, placements) {
    const reading=api?.pose(contract.part), reference=contract.relativeTo ? api?.pose(contract.relativeTo) : null;
    const valid=r=>r?.ok && Array.isArray(r.position) && r.position.length===3 && r.position.every(Number.isFinite) && Array.isArray(r.quat) && r.quat.length===4 && r.quat.every(Number.isFinite) && Math.hypot(...r.quat)>0;
    if(!valid(reading) || (contract.relativeTo && !valid(reference))) return null;
    const point=(pose,id,local)=>{
        if(!local)return pose.position;
        const placement=placements?.get(id),m=placement?.rotation;
        if(!m||m.length!==9)return null;
        // Authored part-local LDraw point -> saved world displacement -> current
        // body rotation. pose() already supplies the current part origin.
        const ldu=[0,1,2].map(i=>m[i*3]*local[0]+m[i*3+1]*local[1]+m[i*3+2]*local[2]);
        const offset=rotatePoint(pose.quat,[ldu[0]*0.0004,-ldu[1]*0.0004,-ldu[2]*0.0004]);
        return pose.position.map((v,i)=>v+offset[i]);
    };
    const position=point(reading,contract.part,contract.localPointLdu),origin=reference?point(reference,contract.relativeTo,contract.referencePointLdu):[0,0,0];
    if(!position||!origin)return null;
    // Reference-frame coordinates remove translation AND reference rotation.
    const delta=position.map((v,i)=>v-origin[i]);
    return {...reading,position:reference?rotatePoint(conjugate(reference.quat),delta):delta,quat:reference?multiply(conjugate(reference.quat),reading.quat):reading.quat.slice()};
}
export function observeTerminal(state, variables, name) {
    if (!name) return;
    if (Number(variables[name]) === 0) state.sawZero = true;
    if (state.sawZero && Number(variables[name]) === 1) state.sawTransition = true;
}
export function programCompletion(report, contract) {
    const gaps = [];
    if (!contract) gaps.push('OUTPUT_CONTRACT_UNREVIEWED');
    if (report.execution !== 'COMPLETED') gaps.push('PROGRAM_DID_NOT_EXIT');
    if (contract && (!report.terminalObservation?.sawTransition || Number(report.programVariables?.[contract.terminal]) !== 1)) gaps.push('TERMINAL_FLAG_NOT_REACHED');
    if (contract?.drive === 'commanded-motion' && !Object.values(report.motors || {}).some(m => m.commanded && m.moved)) gaps.push('PRIMARY_DRIVE_MOVEMENT_UNVERIFIED');
    const output = report.outputMeasurement;
    if (contract && (!output || output.samples < 2 || output.invalid || (contract.minTravelM!==undefined&&(!Number.isFinite(output.travelM)||output.travelM<contract.minTravelM)) || (contract.minRotationDeg!==undefined&&(!Number.isFinite(output.rotationDeg)||output.rotationDeg<contract.minRotationDeg)))) gaps.push('MEANINGFUL_OUTPUT_NOT_OBSERVED');
    if (contract?.outputReviewPending) gaps.push('OUTPUT_GEOMETRY_REVIEW_PENDING');
    for (const [name, value] of Object.entries(contract?.terminalValues || {})) if (Number(report.programVariables?.[name]) !== value) gaps.push('TERMINAL_STAGE_NOT_REACHED:' + name);
    if (contract?.message && !report.messages?.includes(contract.message)) gaps.push('TERMINAL_MESSAGE_UNVERIFIED');
    const faults = [...(report.failures || [])];
    return {status: faults.length ? 'FAIL' : gaps.length ? 'PARTIAL' : 'COMPLETE', gaps, failures: faults};
}
