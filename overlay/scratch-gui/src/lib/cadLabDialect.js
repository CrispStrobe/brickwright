// SPDX-License-Identifier: BSD-3-Clause
// CAD shares the motor vocabulary and argument contracts with Robot Lab.
import {ROBOTLAB_WORDS, robotLabCallToPseudo} from './robotLabDialect.js';
const methods = new Set(['start', 'stop', 'reset', 'setMotorPower', 'setMotorSpeed', 'runMotorDegrees', 'stopMotor', 'motorAngle', 'motorSpeed', 'status']);
export const CADLAB_WORDS = Object.freeze(ROBOTLAB_WORDS.filter(e => methods.has(e.method)).map(e => Object.freeze({
    ...e, op: e.op.replace(/^robotlab_/, 'cadlab_'), menuExtension: 'cadlab',
    words: e.words.replace(/^lab /, 'cad ').replace('brake|coast|hold', 'brake|coast')
})));
export const cadLabWordFor = opcode => CADLAB_WORDS.find(e => e.op === opcode) || null;
export const cadLabWordsOf = kinds => CADLAB_WORDS.filter(e => kinds.includes(e.kind));
export const cadLabCallToPseudo = (method, args) => {
    if (!methods.has(method) || (method === 'stopMotor' && /hold/.test(args[1] || ''))) return null;
    return robotLabCallToPseudo(method, args)?.replace(/^lab /, 'cad ') || null;
};
export const CADLAB_RUNTIME = Object.freeze({runtime: 'cadlab', ops: Object.freeze(Object.fromEntries(CADLAB_WORDS.map(e => [
    e.op.slice(7), Object.freeze({kind: e.kind, method: e.method, args: e.args,
        ...(e.kind === 'reporter' ? {neutral: e.method === 'status' ? '"not-open"' : '0'} : {})})
])))});
