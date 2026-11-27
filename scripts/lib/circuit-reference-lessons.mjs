// SPDX-License-Identifier: BSD-3-Clause
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function checkReferenceLesson (bench, circuit, examples) {
    const {id} = bench;
    const {board} = circuit;
    const checks = [];
    function check (name, expected, observed) {
        checks.push({check: name, expected, observed, ok: JSON.stringify(observed) === JSON.stringify(expected)});
    }
    if (id === '72-soldered-key') {
        const {runPcbDrc} = await import('bw-circuit-ui/model/pcb-drc.js');
        const {importEasyEdaPcb} = await import('bw-circuit-ui/importers/easyeda-pcb.js');
        const pcb = importEasyEdaPcb(await readFile(join(examples, id, 'board.pcb.json'), 'utf8'));
        check('PCB finds exactly the expected mechanical short',
            ['terminal-short/danger'], runPcbDrc(pcb).map(({rule, severity}) => `${rule}/${severity}`));
        const lit = () => Math.abs(board.branchCurrent('led_4', 'anode')) > 0.001;
        const states = [];
        for (const pressed of [0, 1, 0]) {
            circuit.setControl('button_5', pressed);
            circuit.advanceTo(board.getTime() + 10_000_000n);
            states.push(lit());
        }
        check('original schematic controls the light normally', [false, true, false], states);
    } else if (id === 'logic-74c922-keypad') {
        const data = () => board.getDeviceState('enc1')?.encoder;
        const observed = [];
        for (let index = 0; index < 16; index++) {
            circuit.setPartParam('kp1', 'pressed', index);
            circuit.advanceTo(board.getTime() + 30_000_000n);
            const held = data();
            const mask = ['a', 'b', 'c', 'd'].reduce((value, bit, position) =>
                Math.abs(board.branchCurrent('led_' + bit, 'anode')) > 0.0005 ? value | (1 << position) : value, 0);
            const daLed = Math.abs(board.branchCurrent('led_da', 'anode')) > 0.0005;
            const entry = {code: held?.code ?? null, held: held?.registered ?? null, mask, daLed};
            circuit.setPartParam('kp1', 'pressed', -1);
            circuit.advanceTo(board.getTime() + 30_000_000n);
            entry.released = data()?.da === 0 && data()?.registered === null;
            observed.push(entry);
        }
        check('sixteen physical keys publish the exact code on wired DA/A–D LEDs and release DA',
            Array.from({length: 16}, (_, index) => ({code: index, held: index, mask: index, daLed: true, released: true})),
            observed);
    } else if (id === 'board-prechin-a2-learning-board') {
        check('static board reference preserves its authored part and wire count', [29, 123],
            [circuit.parts.length, circuit.wires.length]);
        const onSameNet = terms => board.nets.some(net => terms.every(([part, terminal]) =>
            net.terminals.some(term => term.part === part && term.terminal.toLowerCase() === terminal.toLowerCase())));
        check('P0.4–P0.7 stay shared by the matrix and parallel LCD', [true, true, true, true],
            Array.from({length: 4}, (_, bit) => onSameNet([
                ['mcu', `P0.${bit + 4}`], ['matrix', `col${3 - bit}`], ['lcd', `d${bit + 4}`]
            ])));
        check('P2.5 stays shared by LED row, buzzer and LCD RW', true,
            onSameNet([['mcu', 'P2.5'], ['leds', 'd5'], ['buz', 'a'], ['lcd', 'rw']]));
        check('J24 still controls the shared shift-register OE line', true, onSameNet([['j24', 'com'], ['sr1', 'oe']]));
        return {scope: 'static-wiring-reference', status: checks.every(result => result.ok) ? 'pass' : 'fail', checks};
    } else {
        return null;
    }
    return {status: checks.every(result => result.ok) ? 'pass' : 'fail', checks};
}
