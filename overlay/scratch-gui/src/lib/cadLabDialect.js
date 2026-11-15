// SPDX-License-Identifier: BSD-3-Clause
// CAD shares the motor vocabulary and argument contracts with Robot Lab.
import {ROBOTLAB_WORDS, robotLabCallToPseudo} from './robotLabDialect.js';
const methods = new Set(['start', 'stop', 'reset', 'setMotorPower', 'setMotorSpeed', 'runMotorDegrees', 'stopMotor', 'motorAngle', 'motorSpeed', 'status']);
const slider = '{SLIDER:menu:sliders:A|B|C|D|E|F}';
const linearWords = [
    ['runSliderDistance','command',`cad run slider ${slider} for {DISTANCE} mm at {SPEED} mm per second`,'runSliderDistance',['SLIDER','DISTANCE','SPEED']],
    ['setSliderSpeed','command',`cad run slider ${slider} at {SPEED} mm per second`,'setSliderSpeed',['SLIDER','SPEED']],
    ['stopSlider','command',`cad stop slider ${slider} {ACTION:brake|coast}`,'stopSlider',['SLIDER','ACTION']],
    ['sliderPosition','reporter',`cad slider ${slider} position`,'sliderPosition',['SLIDER']],
    ['sliderSpeed','reporter',`cad slider ${slider} speed`,'sliderSpeed',['SLIDER']]
].map(([op,kind,words,method,args])=>Object.freeze({op:`cadlab_${op}`,kind,words,method,args:Object.freeze(args),menuExtension:'cadlab',literalMenu:true}));
export const CADLAB_WORDS = Object.freeze([...ROBOTLAB_WORDS.filter(e => methods.has(e.method)).map(e => Object.freeze({
    ...e, op: e.op.replace(/^robotlab_/, 'cadlab_'), menuExtension: 'cadlab',
    words: e.words.replace(/^lab /, 'cad ').replace('brake|coast|hold', 'brake|coast')
})),...linearWords]);
export const cadLabWordFor = opcode => CADLAB_WORDS.find(e => e.op === opcode) || null;
export const cadLabWordsOf = kinds => CADLAB_WORDS.filter(e => kinds.includes(e.kind));
export const cadLabCallToPseudo = (method, args) => {
    const linear=linearWords.find(e=>e.method===method);
    if(linear){if(args.length!==linear.args.length||args.some(a=>a===undefined||String(a).trim()===''))return null;
        const term=a=>{const text=String(a).trim();return /^(-?\d+(\.\d+)?|"(?:[^"\\]|\\.)*"|[A-Za-z_]\w*|\(.*\))$/.test(text)?text:`(${text})`;};
        const [s,d,v]=args.map(term);
        if(method==='runSliderDistance')return `cad run slider ${s} for ${d} mm at ${v} mm per second`;
        if(method==='setSliderSpeed')return `cad run slider ${s} at ${d} mm per second`;
        if(method==='stopSlider')return /^['"]?(brake|coast)['"]?$/.test(d)?`cad stop slider ${s} ${d.replace(/['"]/g,'')}`:null;
        return `cad slider ${s} ${method==='sliderPosition'?'position':'speed'}`;
    }
    if (!methods.has(method) || (method === 'stopMotor' && /hold/.test(args[1] || ''))) return null;
    return robotLabCallToPseudo(method, args)?.replace(/^lab /, 'cad ') || null;
};
export const CADLAB_RUNTIME = Object.freeze({runtime: 'cadlab', ops: Object.freeze(Object.fromEntries(CADLAB_WORDS.map(e => [
    e.op.slice(7), Object.freeze({kind: e.kind, method: e.method, args: e.args,
        ...(e.kind === 'reporter' ? {neutral: e.method === 'status' ? '"not-open"' : '0'} : {})})
])))});
