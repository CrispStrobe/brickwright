// SPDX-License-Identifier: BSD-3-Clause
// Shared real-solver bench for Node and Chromium integration qualification.
import {BoardImpl} from 'bw-board/board.js';
import {registerBoardKinds} from 'bw-board/devices/board-kinds.js';

registerBoardKinds();

export function createCrispBasicCircuitFixture () {
    const board = new BoardImpl(5);
    board.setNetlist([
        {id: 'uno', kind: 'arduino_uno', terminals: ['d13', 'd2', 'gnd']},
        {id: 'resistor', kind: 'resistor', params: {ohms: 220}, terminals: ['a', 'b']},
        {id: 'led', kind: 'led', params: {color: 'red'}, terminals: ['anode', 'cathode']},
        {id: 'button', kind: 'button', terminals: ['a', 'b']}
    ], [
        {id: 'drive', terminals: [{part: 'uno', terminal: 'd13'}, {part: 'resistor', terminal: 'a'}]},
        {id: 'led-anode', terminals: [{part: 'resistor', terminal: 'b'}, {part: 'led', terminal: 'anode'}]},
        {id: 'sense', terminals: [{part: 'uno', terminal: 'd2'}, {part: 'button', terminal: 'a'}]},
        {id: 'ground', terminals: [{part: 'uno', terminal: 'gnd'}, {part: 'led', terminal: 'cathode'},
            {part: 'button', terminal: 'b'}]}
    ]);
    board.setPower(false);
    const listeners = new Map();
    const runtime = {
        circuitBoard: board, circuitModel: {netlistError: null}, threads: [],
        on (type, listener) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(listener);
        },
        off (type, listener) { listeners.get(type)?.delete(listener); },
        emit (type, ...args) { for (const listener of [...(listeners.get(type) || [])]) listener(...args); }
    };
    return {board, runtime};
}
