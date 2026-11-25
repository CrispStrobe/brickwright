// SPDX-License-Identifier: BSD-3-Clause
// Original test firmware and circuit. This is not a historical CP1 monitor.
export function switchToLedFirmware () {
    const rom = new Uint8Array(2048);
    rom.set([
        0x23, 0xaf, // Select base 8155 I/O; release reset.
        0x3a,       // OUTL P2,A
        0xb8, 0x00, // MOV R0,#command register
        0x23, 0x0f, // Simple PA/PB/PC outputs.
        0x90,       // MOVX @R0,A
        0xb8, 0x02, // MOV R0,#base Port B (CP1 P2)
        0x09,       // IN A,P1: sample the real circuit.
        0x90,       // MOVX @R0,A: drive the actual LED branch.
        0x04, 0x0a  // Repeat the sample/write loop.
    ]);
    return rom;
}

export const circuit = {
    vcc: 5,
    parts: [
        {id: 'trainer', kind: 'kosmos-cp1', x: 260, y: 260,
            params: {expansion: false, clockHz: 6000000}},
        {id: 'input', kind: 'button', x: 570, y: 150, params: {}},
        {id: 'resistor', kind: 'resistor', x: 540, y: 300, params: {ohms: 330}},
        {id: 'led', kind: 'led', x: 650, y: 300, params: {vf: 2, color: 'red'}},
        {id: 'ground', kind: 'gnd', x: 650, y: 430, params: {}}
    ],
    wires: [
        {id: 'input', from: {part: 'trainer', terminal: 'P1.0'}, to: {part: 'input', terminal: 'a'}},
        {id: 'input-ground', from: {part: 'input', terminal: 'b'}, to: {part: 'ground', terminal: 'gnd'}},
        {id: 'output', from: {part: 'trainer', terminal: 'P2.0'}, to: {part: 'resistor', terminal: 'a'}},
        {id: 'led', from: {part: 'resistor', terminal: 'b'}, to: {part: 'led', terminal: 'anode'}},
        {id: 'led-ground', from: {part: 'led', terminal: 'cathode'}, to: {part: 'ground', terminal: 'gnd'}},
        {id: 'machine-ground', from: {part: 'trainer', terminal: 'gnd'}, to: {part: 'ground', terminal: 'gnd'}}
    ],
    holeWires: []
};
