// SPDX-License-Identifier: BSD-3-Clause
import {PROGRAM_OUTPUT_CONTRACTS,outputRules} from './robot-lab-program-completion.mjs';
export function programGapErrors(matrix,inventory){
    const errors=[],rows=matrix.models||[],ids=rows.map(r=>r.id),expected=inventory.map(r=>r.id),counts={WORKING:0,PARTIAL:0,BLOCKED:0};
    if(new Set(ids).size!==ids.length)errors.push('duplicate-model-id');
    if(ids.length!==expected.length||expected.some(id=>!ids.includes(id))||ids.some(id=>!expected.includes(id)))errors.push('inventory-coverage');
    for(const row of rows){
        if(!Object.hasOwn(counts,row.status)){errors.push(row.id+':invalid-status');continue;}counts[row.status]++;
        if(row.status==='WORKING'){
            const run=row.latestCompletionRun;
            if(run?.programKind!=='SUPPLIED')errors.push(row.id+':supplied-program-missing');
            if(row.gaps?.length||run?.execution!=='COMPLETED'||!Number.isFinite(run?.finishedAt)||run.finishedAt<=0||run.completion?.status!=='COMPLETE'||run.completion?.failures?.length||run.completion?.gaps?.length)errors.push(row.id+':terminal-success-missing');
            if(!run?.terminalObservation?.sawTransition&&!run?.terminalOutcome?.verified)errors.push(row.id+':terminal-observation-missing');
            if(!/^[0-9a-f]{40}$/.test(run?.sourceHead||'')||!/^[0-9a-f]{64}$/.test(run?.runnerSha256||''))errors.push(row.id+':runner-evidence-missing');
            const outputs=run?.outputMeasurements||[run?.outputMeasurement];
            const contract=PROGRAM_OUTPUT_CONTRACTS[row.id];
            if(contract&&outputs.length!==outputRules(contract).length)errors.push(row.id+':output-channel-count');
            if(!outputs.length||outputs.some(o=>{if(!o||!Number.isInteger(o.samples)||o.samples<2||o.invalid)return true;if(['distance','axis-projection','radial-distance'].includes(o.type))return ![o.initialM,o.minM,o.maxM,o.finalM,o.rangeM].every(Number.isFinite);if(o.type==='air-pressure'){const networks=Object.values(o.networks||{});return !networks.length||networks.some(n=>![n.initialKpa,n.minKpa,n.maxKpa,n.finalKpa].every(Number.isFinite))||!networks.some(n=>n.maxKpa>n.initialKpa);}return !Number.isFinite(o.travelM)||!Number.isFinite(o.rotationDeg??0);}))errors.push(row.id+':valid-output-missing');
        }else if(!row.gaps?.length)errors.push(row.id+':gap-explanation-missing');
    }
    if(matrix.summary?.total!==rows.length||matrix.summary?.working!==counts.WORKING||matrix.summary?.partial!==counts.PARTIAL||matrix.summary?.blocked!==counts.BLOCKED)errors.push('summary-counts');
    return errors;
}
