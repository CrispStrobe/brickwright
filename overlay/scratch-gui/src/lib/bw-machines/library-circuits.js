const WIRED_TARGETS = {
    'eater6502-full-build': 'eater6502',
    'i8086-blink': 'i8086',
    'kim1-wired-io': 'kim1',
    'busch-microtronic-wired-io': 'microtronic'
};

export const CIRCUIT_LIBRARY_MACHINES = ['cardiac', 'cp1', 'eater6502', 'i8086', 'kim1', 'microtronic', 'z80'];

export function libraryCircuitPrograms (index) {
    return index.flatMap(example => {
        const files = example.files;
        if (files?.cardiac) return [{id: example.id, title: example.title, machine: 'cardiac', codeOnly: !files.circuit}];
        if (!files?.circuit) return [];
        const machine = WIRED_TARGETS[example.id] || (files.cp1 ? 'cp1' :
            files.rom && /^(eater6502-|aurora65-)/.test(example.id) ? 'eater6502' :
                files.rom && /^z80-/.test(example.id) ? 'z80' : null);
        return machine ? [{id: example.id, title: example.title, machine}] : [];
    });
}
