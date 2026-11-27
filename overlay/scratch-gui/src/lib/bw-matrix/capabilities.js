/**
 * The language x device matrix — one table, read by the GUI and the docs.
 *
 * For a language L and a device D the cell says two independent things:
 *
 *   native   L itself runs on D. The artefact is L's own program: a `.py`
 *            for MicroPython, BASIC typed into a ROM interpreter, a `.hex`
 *            from a C or assembler toolchain. Where the toolchain runs
 *            (`local` in the browser, `hosted` on stc-compiler, `none`
 *            because the chip interprets the language) is a fact here too.
 *   lowered  L is read into the dialect AST and re-emitted as something D
 *            runs natively. The learner's text does not run; its meaning
 *            does. `via` names the language it lands in, and the reach of a
 *            lowered path IS the reach of that native cell.
 *
 * A cell is native, lowered, or both. There is no refused cell: where a
 * native half is physically out, it is `null` with a `reason` from the closed
 * REASONS set and a `cite` carrying the number the claim rests on.
 *
 * Reach (simulator / silicon) is never a boolean stored per cell. It is
 * computed: an artefact reaches the simulator if some shipped engine of the
 * device runs that artefact kind, and reaches silicon if some shipped
 * transport accepts it. So a transport added to a device lights up every
 * cell that produces what it accepts, and nothing has to be edited twice.
 *
 * Evidence: `checked` means test/bw-matrix-conformance.test.mjs reads the
 * source this fact describes and would go red if it changed; `declared`
 * means the table says so and nothing here proves it. The GUI and the
 * generated doc render the difference. Facts about the hosted service are
 * checked against docs/generated/hosted-targets.json, a pinned snapshot.
 *
 * Plan and task ids (N1, L2, ...): docs/LANGUAGE-DEVICE-MATRIX-PLAN.md.
 * @module
 */

import {CENSUS_ROWS} from './census-snapshot.js';

export const SCHEMA_VERSION = 2;

export const EVIDENCE = Object.freeze({CHECKED: 'checked', DECLARED: 'declared'});
export const STATUS = Object.freeze({SHIPPED: 'shipped', OPEN: 'open'});

/**
 * How well a capability is KNOWN, as distinct from whether this table agrees
 * with the code (`evidence`). The vocabulary is bw-board's VERIFICATION.md.
 * `needs` on a fact names the external oracles its tier rests on, BY THEIR bw-board
 * CENSUS ROW ID (docs/generated/bw-board-census.json, T6) so the join is measured; a fact whose
 * oracle is absent from CI is "recorded", not "standing" — that derivation
 * belongs to the generated doc, never to a typed column.
 */
export const TIERS = Object.freeze({
    '1': 'measured on real silicon, or read from the datasheet',
    '2a': 'agrees with an independent implementation or an independently produced vector set',
    '2b': 'agrees with a second reading of the same source',
    '2c': 'a single implementation asserting about itself (its own tests)',
    '3': 'asserted, unverified',
    '4': 'known not to be modelled'
});

/** Why a native half is null. Closed set; the schema test refuses others. */
export const REASONS = Object.freeze({
    'is-ast': {
        en: 'Pseudocode is the dialect every other language is read into; it has no runtime of its own.',
        de: 'Pseudocode ist der Dialekt, in den jede andere Sprache gelesen wird; er hat keine eigene Laufzeit.'
    },
    'ram': {
        en: 'the interpreter needs more RAM than this chip has',
        de: 'der Interpreter braucht mehr RAM, als dieser Chip hat'
    },
    'flash': {
        en: 'the interpreter needs more flash than this chip has',
        de: 'der Interpreter braucht mehr Flash, als dieser Chip hat'
    },
    'no-port': {
        en: 'no port of this language\'s runtime exists for this CPU',
        de: 'für diese CPU gibt es keine Portierung der Laufzeit dieser Sprache'
    },
    'licence': {
        en: 'the only runtimes found are not permissively licensed',
        de: 'die einzigen gefundenen Laufzeiten sind nicht permissiv lizenziert'
    },
    'no-reader': {
        en: 'nothing reads this language into the dialect yet',
        de: 'noch nichts liest diese Sprache in den Dialekt'
    }
});

/** Artefact kinds. A device's engines and transports name what they take. */
export const ARTEFACTS = Object.freeze([
    'hex', // Intel HEX or a raw firmware image for an MCU
    'bin', // raw binary image (ROM, ARM flash)
    'uf2', // RP2040 / SAMD UF2 container
    'py', // MicroPython / CircuitPython source
    'bas', // BASIC text typed into a ROM interpreter
    'com', // DOS .COM program
    'cpm', // CP/M-80 (Z80) .COM program, run on the CP/M BDOS service layer
    'elf', // RISC-V ELF object/executable, loaded + relocated by the rv32 ELF loader
    'img', // bootable 1.44M floppy image (a .COM wrapped in a boot sector)
    'ts' // MakeCode (PXT) TypeScript, compiled hosted
]);

export const LANGUAGES = Object.freeze([
    {id: 'pseudocode', label: 'Pseudocode', reader: 'SB3Creator.parse', emitter: null},
    {id: 'python', label: 'Python', reader: 'sb3-creator-python.js', emitter: 'generatePython'},
    {id: 'javascript', label: 'JavaScript', reader: 'sb3-creator-javascript.js', emitter: 'generateJavaScript'},
    {id: 'c', label: 'C', reader: 'sb3-creator-c.js', emitter: 'generateC'},
    {id: 'basic', label: 'BASIC', reader: 'sb3-creator-basic.js', emitter: 'generateBASIC'},
    // The reader lifts the 8086 emitter's own shapes and refuses the rest by
    // name (plan task L1); 8051/6502/Z80/AVR assembly is still one-way.
    {
        id: 'asm',
        label: 'ASM',
        reader: 'bw-asm/asm-8086-to-pseudocode.js',
        readerNote: '8086 only: lifts what the ▶ button lowered, refuses hand-written assembly by name',
        readerTask: 'L1',
        emitter: 'pseudocode-8086.js (8086); compiler listings elsewhere'
    },
    {id: 'micropython', label: 'MicroPython', reader: 'sb3-creator-micropython.js', emitter: 'generateMicroPython'}
]);

/**
 * A simulator engine entry for a device.
 * @param {string} engine name, matching the picker's `emulator` where one exists
 * @param {string[]} runs artefact kinds it executes
 * @param {object} [extra] overrides (status, evidence, tier, needs, note)
 * @returns {object} the engine fact
 */
const eng = function (engine, runs, extra = {}) {
    return {
        engine,
        runs,
        status: STATUS.SHIPPED,
        evidence: EVIDENCE.CHECKED,
        tier: '2c',
        needs: [],
        ...extra
    };
};

/**
 * A silicon transport entry for a device.
 * @param {string} transport name
 * @param {string[]} accepts artefact kinds it flashes or loads
 * @param {?string} flashFamily the branch `flashFamily()` returns for it, or null
 * @param {object} [extra] overrides (status, task, evidence, tier, needs, note)
 * @returns {object} the transport fact
 */
const tx = function (transport, accepts, flashFamily, extra = {}) {
    return {
        transport,
        accepts,
        flashFamily,
        status: STATUS.SHIPPED,
        evidence: EVIDENCE.CHECKED,
        tier: '2c',
        needs: [],
        ...extra
    };
};

const OPEN_DECLARED = {status: STATUS.OPEN, evidence: EVIDENCE.DECLARED};

/**
 * One device in the picker's order.
 * @param {string} id the DEVICE id
 * @param {string} label the picker label
 * @param {string} group the picker group
 * @param {string} family the CELLS family
 * @param {object} rest pickerCompile, pickerEmulator, sim, silicon, programmable, overrides
 * @returns {object} the device
 */
const dev = function (id, label, group, family, rest) {
    return {id, label, group, family, ...rest};
};

const STC_IDS = ['stc12c5a60s2', 'stc12c5a16s2', 'stc15f2k60s2', 'stc15w408as', 'stc89c52rc', 'stc89c52'];
const AVR = 'Arduino (AVR)';
const ARCADE = 'Arcade & SAMD51';
const avr8 = {pickerCompile: true, pickerEmulator: 'avr8js', sim: [eng('avr8js', ['hex'])]};

/**
 * Devices in Code-tab picker order. `pickerCompile` / `pickerEmulator` describe
 * that surface; DEVICE_GROUPS is generated from these rows below. The truth
 * about what compiles is in the cells.
 */
/**
 * The runtime device CORE for each picker group.
 *
 * NOT the same fact as `family`, and the difference is load-bearing. `family`
 * keys the matrix `CELLS` table; `core` is what reaches
 * `vm.runtime.bwDeviceCore` and drives pin naming and the compile target.
 * They differ for most groups: Arduino (AVR) is `arduino` not `avr`, STM32
 * (ARM) is `arm` not `stm32`, MicroPython is `micropython` not `microbit`,
 * Raspberry Pi is `rp2040`, and 6502 is `w65c02`.
 *
 * Recorded here because the first attempt at deriving the Code-tab picker from
 * this table used `family` as the core and changed all three silently: the
 * device lists matched exactly, so nothing in the diff looked wrong. The
 * equivalence check against the old literal is what caught it.
 */
export const DEVICE_GROUP_CORE = Object.freeze({
    'STC12 (8051)': '8051',
    'Arduino (AVR)': 'arduino',
    'Raspberry Pi': 'rp2040',
    'STM32 (ARM)': 'arm',
    'ESP8266': 'esp8266',
    '6502': 'w65c02',
    'Z80': 'z80',
    'RISC-V': 'riscv32',
    '8086': 'i8086',
    'MicroPython': 'micropython',
    'Arcade & SAMD51': 'samd51'
});

export const DEVICES = Object.freeze([
    ...STC_IDS.map(id => dev(id, id.toUpperCase(), 'STC12 (8051)', '8051', {
        pickerCompile: true,
        pickerEmulator: 'emu8051',
        sim: [eng('emu8051', ['hex'], {tier: '2a', needs: ['emu8051']})],
        silicon: [tx('stc-isp-webserial', ['hex'], 'stc', {note: 'answers only after a cold power-on'})],
        // sdcc-wasm links five of the six STC parts locally; the STC89C52 is
        // not in its LOCAL_TARGETS, so its C still goes to the hosted SDCC.
        // Found by the conformance gate, not by reading.
        ...(id === 'stc89c52' ?
            {overrides: {c: {where: 'hosted', note: 'not in sdcc-wasm LOCAL_TARGETS; compiled by the hosted SDCC'}}} :
            {})
    })),
    dev('arduino-uno', 'Arduino Uno', AVR, 'avr', {...avr8, silicon: [tx('stk500v1-webserial', ['hex'], 'avr')]}),
    dev('arduino-nano', 'Arduino Nano', AVR, 'avr', {...avr8, silicon: [tx('stk500v1-webserial', ['hex'], 'avr')]}),
    dev('arduino-mega', 'Arduino Mega', AVR, 'avr', {
        ...avr8,
        silicon: [tx('stk500v2-webserial', ['hex'], 'avr-mega')]
    }),
    dev('atmega328p', 'ATmega328P (bare)', AVR, 'avr', {...avr8, silicon: [tx('stk500v1-webserial', ['hex'], 'avr')]}),
    dev('atmega168p', 'ATmega168P (bare)', AVR, 'avr', {...avr8, silicon: [tx('stk500v1-webserial', ['hex'], 'avr')]}),
    dev('attiny88', 'ATtiny88 (bare)', AVR, 'avr', {
        pickerCompile: true,
        pickerEmulator: 'attiny88',
        sim: [eng('attiny88', ['hex'])],
        silicon: [tx('usbasp-webusb', ['hex'], 'isp')]
    }),
    dev('attiny85', 'ATtiny85', AVR, 'avr', {
        pickerCompile: true,
        pickerEmulator: 'attiny85',
        sim: [eng('attiny85', ['hex'])],
        silicon: [tx('usbasp-webusb', ['hex'], 'isp')]
    }),
    // A console: it runs a .hex somebody else built. No language cells.
    // Moved here from DEVICE_GROUPS in pseudocode-importer.jsx (T7): the picker is
    // derived from this table now, so the reason a flag is what it is belongs
    // beside the flag.
    // An ATmega32U4 console. `compile: false` because BLOCKS have no path to an Arduboy binary
    // (no emitter writes Arduboy2 code). What it does take is an existing .hex, or an Arduboy2
    // SKETCH from the C tab, compiled as C++ by the hosted service (avr-gcc is GPL and runs
    // there, never here) and run on this console.
    dev('arduboy', 'Arduboy', AVR, 'arduboy', {
        programmable: false,
        pickerCompile: false,
        pickerEmulator: 'arduboy',
        sim: [eng('arduboy', ['hex'])],
        silicon: []
    }),
    dev('pico', 'Raspberry Pi Pico', 'Raspberry Pi', 'rp2040', {
        pickerCompile: true,
        pickerEmulator: 'rp2040js',
        // 'py' runs in the sim (N3c): MicroPython boots in rp2040js and the Pico
        // ▶ Run drives the program LIVE over createPicoRepl (repl.exec), so its
        // GPIO reaches the board. It does NOT install-and-reboot in the sim —
        // machine.reset() does not reboot the emulator yet (finding N3c-1,
        // docs/PICO-SIM-RUN-FINDINGS.md); that half stays silicon-only below.
        sim: [eng('rp2040js', ['hex', 'bin', 'uf2', 'py', 'bas'])],
        silicon: [
            tx('micropython-raw-repl', ['py'], 'micropython'),
            tx('uf2-bootsel-download', ['uf2'], null, {
                task: 'L2',
                // The route is checked (the contract test reads the handler);
                // the silicon claim is not: the image is the SRAM-linked bin
                // (origin 0x20000000, ENTRY(main), no vector table) that
                // rp2040js runs, and no Pico has booted it from a UF2 yet.
                tier: '3',
                note: 'C compiles to an rp2040 bin (hosted /compile), /uf2 wraps it, deployPicoUf2() offers ' +
                    'firmware.uf2 for BOOTSEL; flashFamily null because the deploy handler branches on artefact ' +
                    'kind. UNMEASURED on hardware: a RAM-resident image without a vector table'
            })
        ]
    }),
    dev('stm32f030', 'STM32F030', 'STM32 (ARM)', 'stm32', {
        pickerCompile: true,
        pickerEmulator: 'stm32f0',
        sim: [eng('stm32f0', ['bin', 'hex'], {
            tier: '2a',
            needs: ['labwired-wasm'],
            note: 'light tier; labwired heavy tier optional, see CHOOSING-HARDWARE'
        })],
        silicon: [
            tx('stm32-uart-bootloader-webserial', ['bin', 'hex'], 'stm32'),
            tx('cmsis-dap-swd-webusb', ['bin'], 'stm32')
        ]
    }),
    // The ESP8266 (Tensilica LX106): C from sb3-creator's DEVICE ESP8266 back
    // end against the blob-free esp8266js runtime API, compiled by the hosted
    // service's esp8266 target (in the pinned snapshot since stc-compiler
    // e21b64c, plan N13) and run in bw-board's `esp8266` debug kind.
    dev('esp8266', 'ESP8266', 'ESP8266', 'esp8266', {
        pickerCompile: true,
        pickerEmulator: 'esp8266',
        sim: [eng('esp8266', ['bin'], {
            note: 'bw-board esp8266 kind over the esp8266js fork; SDK-free firmware only, GPIO and serial'
        })],
        silicon: []
    }),
    dev('eater6502', 'Eater 6502', '6502', 'w65c02', {
        pickerCompile: true,
        pickerEmulator: 'eater6502',
        sim: [eng('eater6502', ['hex', 'bin', 'bas'], {
            tier: '2a',
            needs: ['65c02-vectors'],
            note: 'chosen by seating the part; BASIC typed into the MS BASIC ROM over the ACIA'
        })],
        silicon: [tx('eeprom-programmer-webserial', ['hex', 'bin'], 'eeprom')]
    }),
    dev('z80', 'Z80 bench', 'Z80', 'z80', {
        pickerCompile: true,
        pickerEmulator: 'z80',
        sim: [
            eng('z80', ['hex', 'bin', 'bas'], {
                tier: '2a',
                needs: ['z80-vectors'],
                note: 'BBC BASIC on the bench'
            }),
            // The CP/M-80 BDOS service layer (lib/bw-debug/cpm-z80.js): a Z80
            // CP/M .COM runs at 0x0100 with BDOS emulated behind the 0x0005
            // trap — the Z80 twin of the 8086 DOS service layer, and the
            // runtime that lets a host cross-compiler's Z80 output (ACK's
            // z80/cpm backend, SDCC) run here. Proven on a real SDCC-compiled
            // .COM in test/cpm-z80.test.mjs (checked, no browser emulator pane
            // of its own, like microbit-sim).
            eng('cpm-z80', ['cpm'], {
                note: 'CP/M-80 BDOS service layer; runs a real Z80 CP/M .COM (test/cpm-z80.test.mjs)'
            })
        ],
        silicon: [tx('eeprom-programmer-webserial', ['hex', 'bin'], 'eeprom')]
    }),
    // The RISC-V RV32IMA console bench (bw-board src/riscv32*.js): a full
    // standard SoC — RV32IMA + M-mode CSRs/interrupts + CLINT + PLIC + NS16550
    // UART — that boots real programs. It ships a clang "Hello" and two real
    // RTOSes, FreeRTOS and RT-Thread Nano, which boot and multitask preemptively
    // in the console (see lib/bw-debug/riscv-programs.js). It is now programmable
    // from ASSEMBLY in-app: bw-board/riscv-asm.js is a LOCAL RV32IM assembler
    // (assemble-route.js has riscv32 in LOCAL_ASM_TARGETS), so a learner writes
    // assembly and it runs on this core with no network — the same road the 8086
    // takes. C now compiles IN THE BROWSER TOO: bw-board/riscv-cc-wasm.js runs
    // shecc (compiled to wasm) and returns the same loadable image, so
    // `requestRiscvCBuild` builds C → rv32 with NO server (the ▶ Run C on RISC-V
    // button). A hosted service (client lib/bw-debug/riscv-compile.js, reference
    // server services/riscv-cc/, default stc-compiler) is only a fallback for a
    // build where the in-browser compiler cannot load — so C is LOCAL, not
    // hosted-pending-endpoint, and never faked.
    dev('riscv32', 'RISC-V (RV32IMA)', 'RISC-V', 'riscv32', {
        // TWO local build roads, no network: the RV32IM assembler
        // (asmRouteFor('riscv32') === 'local') AND the shecc-wasm C compiler
        // (requestRiscvCBuild compiles in-browser). Plus running a pre-linked
        // demo or a dropped ELF. `pickerCompile` stays false because that flag
        // means the HOSTED sb3/stc C road, which is not this device's path.
        // Programmable (its own matrix column) since 2026-09-25: it was marked a
        // console while both roads shipped, so the matrix had no RISC-V column.
        programmable: true,
        pickerCompile: false,
        pickerEmulator: 'riscv32',
        sim: [eng('riscv32', ['elf', 'bin'], {
            note: 'RV32IMA SoC (CLINT+PLIC+UART); boots clang ELF, real FreeRTOS + RT-Thread, in-browser assembly, and in-browser C (shecc→wasm) (bw-board riscv32*.test.mjs, riscv-cc-wasm.test.mjs)'
        })],
        silicon: []
    }),
    // Moved here from DEVICE_GROUPS in pseudocode-importer.jsx (T7): the picker is
    // derived from this table now, so the reason a flag is what it is belongs
    // beside the flag.
    // `compile: false` STILL MEANS WHAT IT SAYS, and it is not a leftover. It is read as "the
    // hosted C compiler can build this", and it cannot: sb3-creator has no 8086 device profile and
    // stc-compiler has no 8086 back end, so `generateC` + POST is a road that ends in "unknown
    // device: i8086" three clicks later. What changed is that there is now a SECOND road —
    // `lib/bw-asm/pseudocode-8086.js` lowers the blocks to 8086 assembly in the browser and
    // `requestAssembly` assembles them here, with no network and no toolchain — and
    // `runPseudocodeOn8086` is the ▶ button for it. The two flags are about different roads, so
    // the device is offered as compilable-by-neither and runnable anyway.  It is in the picker
    // because it is the BOARDLESS way to reach the 8086 — a DOS bench with no drawn circuit at
    // all, which is what most 8086 coursework wants. It is no longer the ONLY way: this comment
    // used to say "the circuit palette has no 8086 part yet", which was true when written and is
    // now false. The DIP drawings (i8086, i8088, i8251, i8254, i8255, i8259, i8284) and the device
    // registrations both landed, so "seat one on the board" — how the 6502 and Z80 benches are
    // usually chosen — works. circuit-tab.jsx detects the part and publishes bwDeviceCore =
    // 'i8086', and this entry keeps working unchanged, as it was written to.
    dev('i8086', 'Intel 8086 (DOS bench)', '8086', 'i8086', {
        pickerCompile: false,
        pickerEmulator: 'i8086',
        sim: [eng('i8086', ['com', 'bin'], {
            tier: '2a',
            // 8086-vectors is standing (bw-board CI grinds all 646,000 per push). elks-image is
            // recorded: a third-party OS written against real PC/XT hardware boots on this board
            // and mounts its root filesystem (bw-board 824d301, 8064729) — independent-source
            // agreement about the BOARD, not just the CPU — but GPL-2 keeps it out of CI.
            needs: ['8086-vectors', 'elks-image']
        })],
        silicon: [tx('export', ['com', 'img'], null, {
            task: 'N10',
            tier: '2c',
            note: 'export, not a flash transport: the assembled .COM (org 100h, the assembler\'s ' +
                'exact bytes) and a bootable 1.44M floppy .img whose boot sector installs a minimal ' +
                'INT 21h over the BIOS and loads the .COM at CS:0100 — carry it to real hardware or ' +
                'another emulator. Boots in lite\'s own vendored 8086 + committed BIOS ' +
                '(test/i8086-export.test.mjs); a second, INDEPENDENT emulator is declared, not measured.'
        })]
    }),
    // Moved here from DEVICE_GROUPS in pseudocode-importer.jsx (T7): the picker is derived
    // from this table now, so the reason two ids share one path belongs beside them.
    // The Calliope runs the micro:bit's API on different hardware, so it shares the
    // vocabulary, the simulator and the whole MicroPython path. It is listed separately
    // because a program written for one says so — a Calliope import that claimed
    // DEVICE MICROBIT told the reader their board was a micro:bit.
    ...[['microbit', 'micro:bit'], ['calliopemini', 'Calliope mini']].map(([id, label]) =>
        dev(id, label, 'MicroPython', 'microbit', {
            pickerCompile: false,
            pickerEmulator: null,
            sim: [eng('microbit-sim', ['py'], {
                tier: '2a',
                note: 'the real MicroPython firmware built for the browser, in its own pane'
            })],
            silicon: [
                tx('hex-append-download', ['py'], null, {
                    tier: '2b',
                    note: 'uflash format: runtime + script, drag onto the board; our reader accepts our writer'
                }),
                // Direct WebUSB flashing targets the nRF52833 (micro:bit V2); the
                // flasher reads FICR.INFO.PART and refuses any other silicon by
                // name, so the Calliope mini — a different SoC — does not claim it.
                ...(id === 'microbit' ?
                    [tx('daplink-webusb', ['hex'], null, {
                        tier: '3',
                        task: 'N9',
                        note: 'CMSIS-DAP over WebUSB into the nRF52833 NVMC; declared on hardware, measured on a ' +
                            'mock DAP that captures the exact erase/program sequence — micro:bit V2 only'
                    })] :
                    [])
            ]
        })
    ),
    ...[['arcade', 'MakeCode Arcade (160×120)'], ['pybadge', 'Adafruit PyBadge'], ['pybadge-lc', 'Adafruit PyBadge LC']]
        .map(([id, label]) => dev(id, label, ARCADE, 'samd51', {
            pickerCompile: false,
            pickerEmulator: 'arcade',
            sim: [eng('arcade', ['ts'], {
                evidence: EVIDENCE.DECLARED,
                tier: '3',
                note: 'the Arcade console runs PXT output; no SAMD51 instruction emulator'
            })],
            silicon: [
                tx('circuitpython-copy', ['py'], null, {
                    ...OPEN_DECLARED, note: 'manual today: copy code.py onto the CIRCUITPY drive'
                }),
                tx('uf2-bootsel-download', ['uf2'], null, {...OPEN_DECLARED, task: 'L4'})
            ]
        })),
    dev('samd51', 'ATSAMD51J19 (generic)', ARCADE, 'samd51', {
        pickerCompile: false,
        pickerEmulator: null,
        sim: [],
        silicon: [tx('circuitpython-copy', ['py'], null, OPEN_DECLARED)]
    })
]);

/**
 * Build the Code-tab picker's ordered groups from capability rows. Keeping
 * this transform beside DEVICES lets tests mutate the input table without
 * parsing the component that renders it.
 *
 * @param {Array<object>} devices capability rows in picker order
 * @returns {Array<object>} picker groups in first-seen group order
 */
export const deviceGroupsFor = function (devices) {
    const byGroup = new Map();
    const groups = [];
    for (const device of devices) {
        let group = byGroup.get(device.group);
        if (!group) {
            group = {label: device.group, core: DEVICE_GROUP_CORE[device.group], devices: []};
            byGroup.set(device.group, group);
            groups.push(group);
        }
        group.devices.push({
            id: device.id,
            label: device.label,
            compile: Boolean(device.pickerCompile),
            emulator: device.pickerEmulator ?? null
        });
    }
    return groups;
};

export const DEVICE_GROUPS = Object.freeze(deviceGroupsFor(DEVICES));

// ---- cells, by family ------------------------------------------------------

const AST = {reason: 'is-ast', cite: 'the intermediate form itself'};

/**
 * A null native half with its reason and the number it rests on.
 * @param {string} reason a REASONS key
 * @param {string} cite the measurement
 * @returns {object} the null-native object
 */
const no = function (reason, cite) {
    return {reason, cite};
};

/**
 * A shipped native fact.
 * @param {string} artefact an ARTEFACTS kind
 * @param {string} toolchain what produces it
 * @param {string} where 'local' | 'hosted' | 'none'
 * @param {object} [extra] note, contradiction, evidence, tier, needs
 * @returns {object} the fact
 */
const shipped = function (artefact, toolchain, where, extra = {}) {
    return {
        artefact,
        toolchain,
        where,
        status: STATUS.SHIPPED,
        evidence: EVIDENCE.CHECKED,
        tier: '2c',
        needs: [],
        ...extra
    };
};

/**
 * An open native fact: a path that does not exist yet, with the task that adds it.
 * @param {string} artefact an ARTEFACTS kind
 * @param {string} toolchain what would produce it
 * @param {string} where 'local' | 'hosted' | 'none'
 * @param {?string} task plan task id, or null with a note
 * @param {object} [extra] note
 * @returns {object} the fact
 */
const open = function (artefact, toolchain, where, task, extra = {}) {
    return {artefact, toolchain, where, task, ...OPEN_DECLARED, ...extra};
};

/**
 * A shipped lowered path landing in the named language's native cell.
 * @param {string} lang the landing language id
 * @param {object} [extra] note, form, evidence
 * @returns {object} the path
 */
const via = function (lang, extra = {}) {
    return {via: lang, status: STATUS.SHIPPED, evidence: EVIDENCE.CHECKED, ...extra};
};

/**
 * An open lowered path.
 * @param {string} lang the landing language id
 * @param {string} task plan task id
 * @param {object} [extra] note, form
 * @returns {object} the path
 */
const viaOpen = function (lang, task, extra = {}) {
    return {via: lang, task, ...OPEN_DECLARED, ...extra};
};

/** The ASM row's lowered half: assembly as the listing of compiled C. */
const LISTING = via('c', {form: 'listing'});

const MPY_MIN = 'MicroPython needs roughly 256 KB flash and 16 KB RAM (its smallest official ports)';
const JS_MIN = 'Kaluma and Espruino need a Cortex-M with 64 KB RAM or more';
const STC_RAM = `STC12C5A60S2: 1,280 B RAM; ${MPY_MIN}`;
const AVR_RAM = `ATmega328P: 2 KB RAM; ${MPY_MIN}`;
const F030 = 'STM32F030: 16–32 KB flash, 4 KB RAM';
const ESP_SDK = 'the MicroPython and NodeMCU ESP8266 ports link Espressif\'s closed SDK, which this simulator does not run';
const MPY = shipped('py', 'MicroPython', 'none', {
    tier: '2a',
    note: 'the real interpreter; what is asserted is only the deploy protocol'
});
const CPY = shipped('py', 'CircuitPython', 'none', {evidence: EVIDENCE.DECLARED, tier: '3'});
const TS = via('ts', {evidence: EVIDENCE.DECLARED});
/** ESP8266 lowering lands on its C cell, hosted since stc-compiler e21b64c (plan N13). */
const ESP_C = via('c');

/**
 * cells[family][language] = { native, lowered[] }.
 * `native` is a fact object or a null-reason object; `lowered` is a list,
 * possibly empty, of {via} entries whose reach is the landing cell's.
 */
export const CELLS = Object.freeze({
    8051: {
        pseudocode: {native: AST, lowered: [via('c')]},
        python: {native: no('ram', STC_RAM), lowered: [via('c')]},
        javascript: {native: no('ram', `STC12C5A60S2: 1,280 B RAM; ${JS_MIN}`), lowered: [via('c')]},
        c: {
            native: shipped('hex', 'SDCC mcs51', 'local', {
                tier: '2a',
                needs: ['emu8051'],
                note: 'SDCC 4.5.0 as four WASM stages; the hosted service is the same compiler'
            }),
            lowered: [via('c')]
        },
        basic: {
            native: open('bas', 'BASIC-52', 'none', 'N8', {note: 'investigation: RAM fit and licence'}),
            lowered: [via('c')]
        },
        asm: {native: shipped('hex', 'sdas8051', 'hosted'), lowered: [LISTING]},
        micropython: {native: no('ram', STC_RAM), lowered: [via('c')]}
    },
    avr: {
        pseudocode: {native: AST, lowered: [via('c')]},
        python: {native: no('ram', AVR_RAM), lowered: [via('c')]},
        javascript: {native: no('ram', `ATmega328P: 2 KB RAM; ${JS_MIN}`), lowered: [via('c')]},
        // DEVICE_GROUPS says `compile: false` for every AVR while the C tab
        // compiles through the hosted avr-gcc. Plan task T5 reconciles; until
        // then the conformance test carries this as a KNOWN contradiction.
        c: {
            native: shipped('hex', 'avr-gcc', 'hosted', {
                note: 'plain C, and Arduino sketches as real C++ (Serial, String, classes, ' +
                    'the core libraries) via the C tab\'s ▶ Run sketch on Uno/Nano/Mega/168P/ATtiny'
            }),
            lowered: [via('c')]
        },
        basic: {native: open('bas', 'Tiny BASIC (MIT)', 'none', 'N8'), lowered: [via('c')]},
        asm: {native: shipped('hex', 'avr-gcc (as)', 'hosted'), lowered: [LISTING]},
        micropython: {native: no('ram', AVR_RAM), lowered: [via('c')]}
    },
    rp2040: {
        pseudocode: {native: AST, lowered: [via('micropython'), via('c')]},
        python: {native: MPY, lowered: [via('micropython'), via('c')]},
        javascript: {
            native: open('js', 'Kaluma (Apache-2.0) or Espruino (MPL-2.0)', 'none', 'N5'),
            lowered: [via('micropython'), via('c')]
        },
        c: {
            native: shipped('uf2', 'arm-none-eabi-gcc bare-metal', 'hosted', {
                note: 'runs in rp2040js today; the UF2 download for BOOTSEL is task L2'
            }),
            lowered: [via('c')]
        },
        basic: {
            native: shipped('bas', 'PicoBB BBC BASIC (Zlib) and PiccoloBASIC (BSD-3-Clause)', 'none', {
                note: 'Code runs either pinned firmware through UART in rp2040js. PiccoloBASIC uses unnumbered source and labels.'
            }),
            lowered: [via('micropython'), via('c')]
        },
        asm: {native: shipped('hex', 'arm-none-eabi-as', 'hosted', {note: 'runs on rp2040js (N4)'}), lowered: [LISTING]},
        micropython: {native: MPY, lowered: [via('micropython')]}
    },
    stm32: {
        pseudocode: {native: AST, lowered: [via('c')]},
        python: {native: no('flash', `${F030}; ${MPY_MIN}`), lowered: [via('c')]},
        javascript: {native: no('flash', `${F030}; ${JS_MIN}`), lowered: [via('c')]},
        c: {native: shipped('bin', 'arm-none-eabi-gcc bare-metal', 'hosted'), lowered: [via('c')]},
        basic: {native: no('flash', `${F030}; no BASIC fits beside a program`), lowered: [via('c')]},
        asm: {native: shipped('hex', 'arm-none-eabi-as', 'hosted', {note: 'runs on the STM32F030 light tier (N4)'}), lowered: [LISTING]},
        micropython: {native: no('flash', `${F030}; ${MPY_MIN}`), lowered: [via('c')]}
    },
    esp8266: {
        pseudocode: {native: AST, lowered: [ESP_C]},
        python: {native: no('licence', ESP_SDK), lowered: [ESP_C]},
        javascript: {native: no('licence', `${ESP_SDK} (Espruino's ESP8266 port links it too)`), lowered: [ESP_C]},
        c: {
            native: shipped('bin', 'xtensa-lx106-elf-gcc + bw8266 runtime', 'hosted', {
                note: 'the image runs in bw-board\'s esp8266 kind (esp8266js fork, SDK-free firmware only)'
            }),
            lowered: [ESP_C]
        },
        basic: {native: no('no-port', 'no permissively licensed BASIC for the ESP8266 without the SDK found'), lowered: [ESP_C]},
        asm: {
            native: open('bin', 'xtensa-lx106-elf-as', 'hosted', null, {note: 'no LX106 assembler route in the ASM tab yet'}),
            lowered: []
        },
        micropython: {native: no('licence', ESP_SDK), lowered: [ESP_C]}
    },
    microbit: {
        pseudocode: {native: AST, lowered: [via('micropython')]},
        python: {native: MPY, lowered: [via('micropython')]},
        javascript: {native: open('ts', 'PXT static TypeScript (MIT)', 'hosted', 'N5'), lowered: [via('micropython')]},
        c: {
            native: open('hex', 'arm-none-eabi-gcc bare-metal', 'hosted', 'N7', {
                note: 'the hosted service has the nrf52833 linker script but no C target yet'
            }),
            lowered: [via('micropython')]
        },
        basic: {native: no('no-port', 'no BASIC interpreter for the nRF52833 found'), lowered: [via('micropython')]},
        // N4: asmTargetForDevice maps microbit/calliopemini to the hosted
        // nrf52833 target.
        asm: {
            native: shipped('hex', 'arm-none-eabi-as', 'hosted', {
                note: 'assembles for nrf52833 (N4); nothing runs ARM code here -- the '
                    + 'micro:bit simulator runs MicroPython -- so the .hex is for the board'
            }),
            lowered: []
        },
        micropython: {native: MPY, lowered: [via('micropython')]}
    },
    w65c02: {
        pseudocode: {native: AST, lowered: [via('c'), via('basic')]},
        python: {
            native: no('no-port', 'no MicroPython or other Python for the 6502'),
            lowered: [via('c'), via('basic')]
        },
        javascript: {native: no('no-port', 'no JavaScript engine for the 6502'), lowered: [via('c'), via('basic')]},
        c: {native: shipped('bin', 'cc65', 'hosted'), lowered: [via('c')]},
        basic: {
            native: shipped('bas', 'MS BASIC ROM (`ms` profile)', 'none', {
                note: 'typed into the emulated ROM; no serial-typing transport to real hardware yet'
            }),
            lowered: [via('basic')]
        },
        asm: {native: shipped('bin', 'ca65 + ld65', 'hosted'), lowered: [LISTING]},
        micropython: {native: no('no-port', 'no MicroPython for the 6502'), lowered: [via('c'), via('basic')]}
    },
    z80: {
        pseudocode: {native: AST, lowered: [via('basic'), via('c')]},
        python: {
            native: no('no-port', 'no MicroPython or other Python for the Z80'),
            lowered: [via('basic'), via('c')]
        },
        javascript: {
            native: no('no-port', 'no JavaScript engine for the Z80'),
            lowered: [via('basic'), via('c')]
        },
        c: {
            // N1 (2026-09-25): the BENCH route ships -- the hosted service runs
            // `sdcc -mz80` for the bench's measured map (ROM $0000-$7FFF, RAM
            // $8000-$FFFF) and the C tab's ▶ Run C on Z80 boots the ROM
            // (test/z80-c-bench.test.mjs: the z80-pd-bench program, emitted as
            // C and compiled, walks its light across latch1). A separate,
            // still-open route is a CP/M .COM for the CP/M-80 service layer.
            native: shipped('bin', 'SDCC -mz80 (bench ROM)', 'hosted', {
                note: 'bench ROM via /compile target z80; a CP/M .COM route (sdcc/ACK -mcpm) '
                    + 'is still open -- the CP/M-80 runtime is proven (test/cpm-z80.test.mjs)'
            }),
            lowered: [via('c')]
        },
        basic: {native: shipped('bas', 'BBC BASIC (`bbc` profile)', 'none'), lowered: [via('basic')]},
        asm: {native: shipped('hex', 'sdasz80 + sdldz80', 'hosted'), lowered: [viaOpen('c', 'N1', {form: 'listing'})]},
        micropython: {native: no('no-port', 'no MicroPython for the Z80'), lowered: [via('basic'), via('c')]}
    },
    i8086: {
        pseudocode: {
            native: AST,
            lowered: [via('asm', {note: 'pseudocode-8086.js lowers in the browser'}), via('c')]
        },
        python: {native: no('no-port', 'no MicroPython or other Python for the 8086'), lowered: [via('asm'), via('c')]},
        javascript: {native: no('no-port', 'no JavaScript engine for the 8086'), lowered: [via('asm'), via('c')]},
        // SmallerC (WASM) emits NASM; the local assembler's NASM front end reads
        // it: 5 of 5 corpus programs, measured by test/smallerc-to-i8086-asm.
        // `float` is one named edge. The other was `long` (N2b): the tiny (.COM)
        // model has no 32-bit type, so since 2026-09-07 generateC types an 8086
        // number as a 16-bit int and REFUSES a literal outside -32768..32767 by
        // name (test/i8086-c-long-ceiling). The ASM route keeps 32 bits; the two
        // agree on every value that fits 16 and the differential names the rest
        // (test/numeric-i8086-differential).
        c: {
            native: shipped('com', 'SmallerC (WASM) + i8086-asm.js', 'local', {
                note: 'no libc; float does not link (soft-float helper); numbers are a 16-bit int '
                    + '(-32768..32767) — a literal outside it is refused by name, run-time overflow wraps '
                    + 'at 16 bits, while the ASM route keeps 32 (N2b); a literal single-script wait uses '
                    + 'the same INT 15h/86h DOS machine-time service as ASM, with a 65535 ms ceiling; '
                    + 'computed waits refuse rather than overflow (N2c)'
            }),
            lowered: [via('c')]
        },
        // GW-BASIC-from-MIT-source stays out (N6, 2026-09-05: 0 of 35 sources
        // assemble; they need full MASM + linker + the unreleased OEM layer, and
        // Microsoft ships no binary). What DOES ship is a DIFFERENT libre BASIC:
        // uBASIC (Adam Dunkels; Danyil Bohdan fork, BSD-3-Clause), cross-compiled
        // with ia16-elf-gcc to a 16-bit MS-DOS .EXE. It is DOS-native — the
        // interpreter itself runs on the 8086 DOS service bench, reads the
        // program from PROG.BAS via INT 21h and prints. Verified end-to-end in
        // test/dos-compile.test.mjs (`10 print 6*7` -> `42`).
        basic: {
            native: shipped('bas', 'uBASIC (BSD-3-Clause) via ia16-elf-gcc, on the DOS bench', 'local', {
                note: 'DOS-native interpreter: media-lab ubasic-dos, shipped as static/roms/ubasic.exe; '
                    + 'mounts the program as PROG.BAS and runs UBASIC.EXE on the 8086 DOS service bench '
                    + '(INT 21h file I/O), verified in test/dos-compile (10 print 6*7 -> 42). '
                    + 'GW-BASIC-from-MIT-source remains infeasible (N6): no assembling toolchain, no binary'
            }),
            lowered: [via('asm')]
        },
        asm: {
            native: shipped('com', 'i8086-asm.js (MASM and NASM dialects)', 'local', {
                tier: '2a',
                needs: ['nasm', 'retro-corpus-8086']
            }),
            lowered: [via('asm')]
        },
        micropython: {native: no('no-port', 'no MicroPython for the 8086'), lowered: [via('asm'), via('c')]}
    },
    // RISC-V: two local roads, both measured in bw-board (riscv-asm.test.mjs
    // runs assembled programs on the core; riscv-cc-wasm.test.mjs compiles C
    // with shecc in wasm and runs it), no network. Nothing lowers to it YET:
    // sb3-creator's generateC has no RISC-V core, so the dialect (and every
    // language read into it) has no road here. N12 is that road -- a RISC-V
    // console profile in generateC whose C the same shecc compiles.
    riscv32: {
        pseudocode: {native: AST, lowered: [viaOpen('c', 'N12')]},
        python: {native: no('no-port', 'no Python port wired for this RV32IMA SoC'), lowered: [viaOpen('c', 'N12')]},
        javascript: {native: no('no-port', 'no JavaScript engine wired for this RV32IMA SoC'), lowered: [viaOpen('c', 'N12')]},
        c: {
            native: shipped('elf', 'shecc (wasm) in the browser; hosted gcc fallback', 'local', {
                note: 'shecc (BSD-2-Clause) compiles the C subset it supports, straight to an RV32IM '
                    + 'ELF over the write/exit syscalls this SoC services; the ▶ Run C on RISC-V button, '
                    + 'bw-board riscv-cc-wasm.test.mjs'
            }),
            lowered: []
        },
        basic: {native: no('no-port', 'no BASIC interpreter wired for this RV32IMA SoC'), lowered: [viaOpen('c', 'N12')]},
        asm: {
            native: shipped('elf', 'riscv-asm.js (RV32IM, local)', 'local', {
                note: 'bw-board riscv-asm.test.mjs checks encodings against the ISA layout and runs programs'
            }),
            lowered: []
        },
        micropython: {native: no('no-port', 'no MicroPython port wired for this RV32IMA SoC'), lowered: [viaOpen('c', 'N12')]}
    },
    samd51: {
        pseudocode: {
            native: AST,
            lowered: [via('ts', {
                evidence: EVIDENCE.DECLARED,
                note: 'bw_arcade.py on the hosted service; UF2 open (L4)'
            })]
        },
        python: {native: {...CPY, note: 'silicon by manual copy; no simulator'}, lowered: [TS]},
        javascript: {native: open('ts', 'PXT (MakeCode) static TypeScript', 'hosted', 'L4'), lowered: [TS]},
        c: {
            native: open('uf2', 'arm-none-eabi-gcc bare-metal', 'hosted', null, {
                note: 'silicon only; no SAMD51 instruction emulator. Low priority, no task id.'
            }),
            lowered: [TS]
        },
        basic: {native: no('no-port', 'no permissively licensed BASIC for the SAMD51 found'), lowered: [TS]},
        asm: {
            native: open('uf2', 'arm-none-eabi-as', 'hosted', null, {note: 'silicon only; no emulator'}),
            lowered: []
        },
        micropython: {native: CPY, lowered: [TS]},
        // Not a Code-tab language: the landing cell the TS lowerings above
        // reach. Its artefact runs in the Arcade simulator, so Arcade and
        // PyBadge read "lowered via ts · sim"; UF2 to silicon stays open (L4).
        ts: {
            native: shipped('ts', 'PXT (MakeCode) static TypeScript', 'hosted',
                {evidence: EVIDENCE.DECLARED, tier: '3'}),
            lowered: []
        }
    }
});

// ---- lookups ---------------------------------------------------------------

const DEVICE_BY_ID = new Map(DEVICES.map(d => [d.id, d]));
const LANGUAGE_BY_ID = new Map(LANGUAGES.map(l => [l.id, l]));

/**
 * @param {string} id a device id, any case
 * @returns {?object} the device, or null
 */
export const deviceById = function (id) {
    return DEVICE_BY_ID.get(String(id || '').toLowerCase()) || null;
};

/**
 * @param {string} id a language id, any case
 * @returns {?object} the language, or null
 */
export const languageById = function (id) {
    return LANGUAGE_BY_ID.get(String(id || '').toLowerCase()) || null;
};

/**
 * @param {?object} native a cell's native half
 * @returns {boolean} true when it is a null-with-reason rather than a fact
 */
export const isNativeNull = function (native) {
    return !native || typeof native.reason === 'string';
};

const NO_REACH = {sim: false, silicon: false};

/**
 * Reach of one native fact on one device, shipped paths only.
 * @param {?object} native the fact (or null-reason)
 * @param {object} device the device
 * @returns {{sim: boolean, silicon: boolean}} where the artefact can go
 */
export const reachOf = function (native, device) {
    if (isNativeNull(native) || native.status !== STATUS.SHIPPED) return NO_REACH;
    const a = native.artefact;
    return {
        sim: device.sim.some(e => e.status === STATUS.SHIPPED && e.runs.includes(a)),
        silicon: device.silicon.some(t => t.status === STATUS.SHIPPED && t.accepts.includes(a))
    };
};

/**
 * The resolved cell for (language, device): native with its reach, every
 * lowered path with the reach of the cell it lands in, and `kind`.
 * @param {string} langId a language id
 * @param {string} deviceId a device id
 * @returns {?object} {language, device, native, lowered, kind} or null for an
 *   unknown pair or a non-programmable device
 */
export const cell = function (langId, deviceId) {
    const lang = languageById(langId);
    const device = deviceById(deviceId);
    if (!lang || !device || device.programmable === false) return null;
    const fam = CELLS[device.family];
    const raw = fam && fam[lang.id];
    if (!raw) return null;
    // A device may override facts of its family's cell (e.g. one STC part
    // whose C compiles hosted rather than locally). Reach is computed after.
    const override = (device.overrides && device.overrides[lang.id]) || null;
    const native = isNativeNull(raw.native) ?
        {...raw.native, ...NO_REACH} :
        {...raw.native, ...override, ...reachOf(raw.native, device)};
    const lowered = raw.lowered.map(l => {
        const landing = fam[l.via] && fam[l.via].native;
        const reach = l.status === STATUS.SHIPPED ? reachOf(landing, device) : NO_REACH;
        return {...l, landing: isNativeNull(landing) ? null : landing, ...reach};
    });
    const hasNative = !isNativeNull(native) && native.status === STATUS.SHIPPED;
    const hasLowered = lowered.some(l => l.status === STATUS.SHIPPED);
    let kind = 'none';
    if (hasNative && hasLowered) kind = 'both';
    else if (hasNative) kind = 'native';
    else if (hasLowered) kind = 'lowered';
    return {language: lang, device, native, lowered, kind};
};

/**
 * Every programmable device x every language, for the overall view.
 * @returns {Array<{device: object, cells: object[]}>} one row per device
 */
export const overall = function () {
    return DEVICES.filter(d => d.programmable !== false)
        .map(d => ({device: d, cells: LANGUAGES.map(l => cell(l.id, d.id))}));
};

const T = {
    en: {
        native: 'native',
        lowered: 'lowered',
        via: 'via',
        simOnly: 'simulator only',
        siliconOnly: 'silicon only',
        simAndSilicon: 'simulator and silicon',
        neither: 'not runnable yet',
        open: 'open',
        task: 'task',
        nativeNo: 'no native path',
        on: 'on',
        unknown: 'no entry for this language and device',
        local: 'in the browser',
        hosted: 'hosted compiler',
        tier: 'tier',
        standing: 'standing in bw-board CI',
        recorded: 'recorded once',
        absent: 'oracle absent',
        reachability: 'service, reachability only',
        unknown_oracle: 'no census row',
        declared: 'declared, not checked',
        simulator: 'simulator:',
        none: 'runs the language itself'
    },
    de: {
        native: 'nativ',
        lowered: 'übersetzt',
        via: 'über',
        simOnly: 'nur Simulator',
        siliconOnly: 'nur Hardware',
        simAndSilicon: 'Simulator und Hardware',
        neither: 'noch nicht lauffähig',
        open: 'offen',
        task: 'Aufgabe',
        nativeNo: 'kein nativer Weg',
        on: 'auf',
        unknown: 'kein Eintrag für diese Sprache und dieses Gerät',
        local: 'im Browser',
        hosted: 'gehosteter Compiler',
        tier: 'Stufe',
        standing: 'in der bw-board-CI laufend',
        recorded: 'einmal gemessen',
        absent: 'Orakel fehlt',
        reachability: 'Dienst, nur Erreichbarkeit',
        unknown_oracle: 'keine Zensus-Zeile',
        declared: 'deklariert, nicht geprüft',
        simulator: 'Simulator:',
        none: 'führt die Sprache selbst aus'
    }
};

/**
 * @param {object} t a T locale table
 * @param {{sim: boolean, silicon: boolean}} r a reach
 * @returns {string} the phrase for it
 */
const reachWord = function (t, r) {
    if (r.sim && r.silicon) return t.simAndSilicon;
    if (r.sim) return t.simOnly;
    if (r.silicon) return t.siliconOnly;
    return t.neither;
};

/**
 * @param {string} id a language id
 * @returns {string} its label, or the id when unknown (e.g. 'ts')
 */
const labelOf = function (id) {
    const l = languageById(id);
    return l ? l.label : id;
};

/**
 * One line for the badge's title, e.g.
 *   "Python on Raspberry Pi Pico: native (MicroPython) · silicon only ·
 *    lowered via MicroPython, C · simulator and silicon"
 * @param {string} langId a language id
 * @param {string} deviceId a device id
 * @param {string} [locale] 'en' or 'de'
 * @returns {string} the sentence
 */
/**
 * How an oracle named in `needs` stands in bw-board's census at the pinned sha
 * (T6/T8): 'standing' — bw-board's CI runs it on every push; 'recorded' —
 * present where the census was read, measured once; 'absent' — not even that;
 * 'reachability' — a service row, never probed; 'unknown' — no census row (the
 * conformance gate refuses that in CI, so a user should never see it).
 * @param {string} id census row id
 * @returns {string} the status word key
 */
export const oracleStatus = function (id) {
    const r = CENSUS_ROWS.find(x => x.id === id);
    if (!r) return 'unknown';
    if (r.kind === 'service') return r.ciAvailable ? 'standing' : 'reachability';
    if (r.ciAvailable) return 'standing';
    return r.present ? 'recorded' : 'absent';
};

/**
 * The verification clause for a shipped fact: its tier, then each oracle it
 * rests on with its census status, then "declared" when the fact was read from
 * a table rather than checked against code. Empty for a fact with no tier.
 * @param {object} t locale strings
 * @param {object} f a native/engine/transport fact
 * @returns {string} e.g. " · tier 2a (emu8051: standing)"
 */
const verificationClause = function (t, f) {
    if (!f || !f.tier) return '';
    const needs = (f.needs || []).map(id => `${id}: ${t[oracleStatus(id)] || oracleStatus(id)}`);
    const declared = f.evidence === EVIDENCE.DECLARED ? ` · ${t.declared}` : '';
    return ` · ${t.tier} ${f.tier}${needs.length ? ` (${needs.join(', ')})` : ''}${declared}`;
};

export const explain = function (langId, deviceId, locale = 'en') {
    const t = T[locale] || T.en;
    const c = cell(langId, deviceId);
    if (!c) return t.unknown;
    const parts = [];
    if (isNativeNull(c.native)) {
        const r = REASONS[c.native.reason] || {};
        parts.push(`${t.nativeNo} (${r[locale] || r.en || c.native.reason})`);
    } else if (c.native.status === STATUS.SHIPPED) {
        const where = t[c.native.where] || c.native.where;
        parts.push(`${t.native} (${c.native.toolchain}, ${where}) · ${reachWord(t, c.native)}${verificationClause(t, c.native)}`);
    } else {
        const task = c.native.task ? ` · ${t.task} ${c.native.task}` : '';
        parts.push(`${t.native} (${c.native.toolchain}): ${t.open}${task}`);
    }
    const shippedLowered = c.lowered.filter(l => l.status === STATUS.SHIPPED);
    if (shippedLowered.length) {
        const vias = [...new Set(shippedLowered.map(l => labelOf(l.via)))].join(', ');
        const reach = {sim: shippedLowered.some(l => l.sim), silicon: shippedLowered.some(l => l.silicon)};
        parts.push(`${t.lowered} ${t.via} ${vias} · ${reachWord(t, reach)}`);
    }
    for (const l of c.lowered.filter(x => x.status === STATUS.OPEN)) {
        parts.push(`${t.lowered} ${t.via} ${labelOf(l.via)}: ${t.open} · ${t.task} ${l.task}`);
    }
    const sims = (c.device.sim || []).filter(e => e.status === STATUS.SHIPPED && e.tier);
    if (sims.length) parts.push(`${t.simulator} ${sims.map(e => `${e.engine}${verificationClause(t, e)}`).join('; ')}`);
    return `${c.language.label} ${t.on} ${c.device.label}: ${parts.join(' · ')}`;
};

const S = {
    en: {
        native: 'native',
        lowered: 'lowered',
        both: 'native + lowered',
        open: 'open',
        via: 'via',
        sim: 'sim',
        silicon: 'silicon',
        none: 'no path yet'
    },
    de: {
        native: 'nativ',
        lowered: 'übersetzt',
        both: 'nativ + übersetzt',
        open: 'offen',
        via: 'über',
        sim: 'Sim',
        silicon: 'Hardware',
        none: 'noch kein Weg'
    }
};

/**
 * The compact badge: "native · sim + silicon", "lowered via C · sim",
 * "open · N1". `explain()` is its title text.
 * @param {string} langId a language id
 * @param {string} deviceId a device id
 * @param {string} [locale] 'en' or 'de'
 * @returns {string} the badge text, '' for an unknown pair
 */
export const summarize = function (langId, deviceId, locale = 'en') {
    const s = S[locale] || S.en;
    const c = cell(langId, deviceId);
    if (!c) return '';
    const reach = r => [r.sim && s.sim, r.silicon && s.silicon].filter(Boolean).join(' + ') || s.none;
    if (c.kind === 'none') {
        const tasks = [c.native, ...c.lowered]
            .filter(x => x && x.status === STATUS.OPEN && x.task)
            .map(x => x.task);
        return tasks.length ? `${s.open} · ${[...new Set(tasks)].join(', ')}` : s.none;
    }
    const shippedLowered = c.lowered.filter(l => l.status === STATUS.SHIPPED);
    const lowReach = {sim: shippedLowered.some(l => l.sim), silicon: shippedLowered.some(l => l.silicon)};
    if (c.kind === 'native') return `${s.native} · ${reach(c.native)}`;
    const vias = [...new Set(shippedLowered.map(l => labelOf(l.via)))].join(', ');
    if (c.kind === 'lowered') return `${s.lowered} ${s.via} ${vias} · ${reach(lowReach)}`;
    return `${s.both} · ${reach({sim: c.native.sim || lowReach.sim, silicon: c.native.silicon || lowReach.silicon})}`;
};
