/**
 * Brickwright About dialog — structured acknowledgement data.
 *
 * Each group is {title, titleDe, entries[]}.
 * Each entry is {name, url, license, licenseUrl?, role, note?}.
 *
 * Maintained as a data file so the JSX never needs per-row edits.
 * When adding an entry, put it in the right group and keep the
 * arrays alphabetical within each group.
 */

const REPO = 'https://github.com/CrispStrobe/brickwright-lite';

const ABOUT_GROUPS = [
    // ── Emulation engines ───────────────────────────────────────
    {
        title: 'Emulation engines',
        titleDe: 'Emulations-Engines',
        entries: [
            {
                name: 'avr8js',
                url: 'https://github.com/wokwi/avr8js',
                license: 'MIT',
                licenseUrl: 'https://github.com/wokwi/avr8js/blob/master/LICENSE',
                role: 'ATmega328P instruction-level emulation (Arduino)'
            },
            {
                name: 'emu8051-stc',
                url: 'https://github.com/CrispStrobe/emu8051-stc',
                license: 'MIT',
                licenseUrl: 'https://github.com/CrispStrobe/emu8051-stc/blob/main/LICENSE',
                role: '8051/STC12 emulator core',
                note: 'Fork of emu8051 by Jari Komppa (MIT)'
            },
            {
                name: 'Espressif ESP32-S3 ROM',
                url: 'https://github.com/espressif/esp-rom-elfs',
                license: 'Apache-2.0',
                licenseUrl: 'static/licenses/esp32s3-rom.Apache-2.0.txt',
                role: 'Mask ROM windows for ESP32-S3 firmware boot'
            },
            {
                name: 'micropython-microbit-v2-simulator',
                url: 'https://github.com/microbit-foundation/micropython-microbit-v2-simulator',
                license: 'MIT',
                licenseUrl: 'https://github.com/microbit-foundation/micropython-microbit-v2-simulator/blob/main/LICENSE',
                role: 'micro:bit v2 MicroPython simulator (WASM)',
                note: 'By the Micro:bit Educational Foundation'
            },
            {
                name: 'rp2040js',
                url: 'https://github.com/wokwi/rp2040js',
                license: 'MIT',
                licenseUrl: 'https://github.com/wokwi/rp2040js/blob/main/LICENSE',
                role: 'RP2040 (Raspberry Pi Pico) emulation'
            },
            {
                name: 'W65C02 + Z80 cores',
                url: REPO,
                license: 'BSD-3-Clause',
                licenseUrl: `${REPO}/blob/main/LICENSE`,
                role: 'Own CPU cores and composable machine definitions'
            }
        ]
    },

    // ── Interpreters and OS ─────────────────────────────────────
    {
        title: 'Interpreters and OS',
        titleDe: 'Interpreter und Betriebssysteme',
        entries: [
            {
                name: 'BBC BASIC (Z80) / BBCSDL',
                url: 'https://github.com/rtrussell/BBCSDL',
                license: 'zlib',
                licenseUrl: 'https://github.com/rtrussell/BBCSDL/blob/master/licence.txt',
                role: 'BBC BASIC interpreter by R.T. Russell; shipped unmodified',
                note: 'The name BBC BASIC is used by permission of the BBC, granted to R.T. Russell'
            },
            {
                name: 'basic-m6502-bw',
                url: 'https://github.com/microsoft/BASIC-M6502',
                license: 'MIT',
                licenseUrl: 'https://github.com/microsoft/BASIC-M6502/blob/main/LICENSE',
                role: 'Derived from Microsoft BASIC for 6502; our port for the Eater 6502'
            },
            {
                name: 'CP/M 2.2',
                url: 'https://www.cpm.z80.de/',
                license: 'DRDOS grant',
                role: 'CCP+BDOS binary (orig. Digital Research); see PROVENANCE in bw-board'
            },
            {
                name: 'Bochs BIOS + LGPL VGABios',
                url: 'static/licenses/free-386-firmware.sources.json',
                license: 'LGPL-2.1-or-later',
                licenseUrl: 'static/licenses/free-386-firmware.LGPL-2.1.txt',
                role: 'Unmodified redistributable firmware for the fully-free 80386 machine; ' +
                    'exact source URLs and archive hashes are recorded offline in this entry'
            },
            {
                name: 'PicoBB',
                url: 'https://github.com/Memotech-Bill/PicoBB',
                license: 'zlib',
                licenseUrl: 'https://github.com/Memotech-Bill/PicoBB/blob/main/LICENCE.txt',
                role: 'BBC BASIC C/Pico port by Memotech-Bill'
            }
        ]
    },

    // ── Toolchains (hosted service) ─────────────────────────────
    {
        title: 'Toolchains (hosted service)',
        titleDe: 'Toolchains (gehosteter Dienst)',
        entries: [
            {
                name: 'avr-gcc + arm-none-eabi-gcc',
                url: 'https://gcc.gnu.org/',
                license: 'GPL (service-side)',
                role: 'Cross-compilers for AVR and ARM targets; run server-side, not bundled'
            },
            {
                name: 'cc65',
                url: 'https://github.com/cc65/cc65',
                license: 'zlib',
                licenseUrl: 'https://github.com/cc65/cc65/blob/master/LICENSE',
                role: '6502/65C02 C compiler and assembler'
            },
            {
                name: 'SDCC',
                url: 'https://sdcc.sourceforge.net/',
                license: 'GPL-2.0+ (service-side)',
                role: 'Small Device C Compiler for 8051; runs server-side or as opt-in WASM download'
            },
            {
                name: 'SmallerC',
                url: 'https://github.com/alexfru/SmallerC',
                license: 'BSD-2-Clause (with ucpp, © Thomas Pornin)',
                role: 'C to 16-bit NASM assembly for the 8086; bundled as WASM and runs offline'
            },
            {
                name: 'NQC (Not Quite C)',
                url: 'https://github.com/jverne/nqc/tree/21c24ec1e520c736ce78e33e4c0dafca887fc2b7',
                license: 'MPL-2.0',
                licenseUrl: 'static/licenses/nqc.MPL-2.0.txt',
                role: 'Bundled WebAssembly compiler for LEGO Mindstorms RCX bytecode'
            }
        ]
    },

    // ── Verification and test data ──────────────────────────────
    {
        title: 'Verification and test data (acknowledgements)',
        titleDe: 'Verifikation und Testdaten (Danksagungen)',
        entries: [
            {
                name: 'Klaus Dormann 6502/65C02 tests',
                url: 'https://github.com/Klaus2m5/6502_65C02_functional_tests',
                license: 'GPL-3.0 (CI only)',
                role: 'CPU functional test suites; CI verification only, not shipped'
            },
            {
                name: 'labwired-core',
                url: 'https://github.com/w1ne/labwired-core',
                license: 'MIT',
                licenseUrl: 'https://github.com/w1ne/labwired-core/blob/main/LICENSE',
                // NOT an MNA solver — that was this row's first, wrong wording,
                // and it survived a rename of the whole heavy tier. labwired is
                // a FIRMWARE SIMULATION ENGINE: Cortex-M/RISC-V/Xtensa cores
                // with modelled peripherals, compiled to wasm and shipped as
                // the optional heavy simulation tier (STM32-PATH.md's two-tier
                // ruling). The circuit itself is still solved by our own MNA
                // code — labwired never touches it; the pad is the boundary.
                //
                // The URL stays on w1ne/labwired-core deliberately. The fleet
                // builds its artifact from CrispStrobe/labwired-core, but that
                // is a mirror of this project and this is whose licence and
                // authorship the notice is about.
                role: 'Firmware simulation engine (Cortex-M / RISC-V / Xtensa cores and '
                    + 'peripherals) — the optional heavy simulation tier, and the '
                    + 'differential oracle our own STM32 core is checked against'
            },
            {
                name: 'MAME 6522/6551 device models',
                url: 'https://github.com/mamedev/mame',
                license: 'BSD-3-Clause',
                licenseUrl: 'https://github.com/mamedev/mame/blob/master/LICENSE.md',
                role: 'VIA/ACIA device model reference'
            },
            {
                name: 'perfect6502',
                url: 'https://github.com/mist64/perfect6502',
                license: 'BSD',
                licenseUrl: 'https://github.com/mist64/perfect6502/blob/master/LICENSE',
                role: 'Transistor-level 6502 simulation reference'
            },
            {
                name: 'simavr',
                url: 'https://github.com/buserror/simavr',
                license: 'LGPL (CI only)',
                role: 'AVR simulator; CI oracle only, not shipped'
            },
            {
                name: 'SingleStepTests 65x02 + Z80',
                url: 'https://github.com/SingleStepTests',
                license: 'MIT',
                role: 'Per-instruction CPU test vectors'
            },
            {
                name: 'ucsim',
                url: 'https://sourceforge.net/projects/sdcc/files/',
                license: 'GPL (CI only)',
                role: '8051 simulator; CI oracle only, not shipped'
            },
            {
                name: 'vrEmu6502',
                url: 'https://github.com/visrealm/vrEmu6502',
                license: 'MIT',
                licenseUrl: 'https://github.com/visrealm/vrEmu6502/blob/main/LICENSE',
                role: '6502 emulator by visrealm; cross-check reference'
            }
        ]
    },

    // ── Design references ───────────────────────────────────────
    {
        title: 'Design references',
        titleDe: 'Design-Referenzen',
        entries: [
            {
                name: 'Ben Eater 6502 computer',
                url: 'https://eater.net/6502',
                license: 'architecture facts',
                role: 'Reference breadboard 6502 design'
            },
            {
                name: 'Grant Searle Z80 designs',
                url: 'http://searle.wales/',
                license: 'architecture facts',
                role: 'Minimal Z80 computer architecture reference'
            },
            {
                name: 'mike42/6502-computer',
                url: 'https://github.com/mike42/6502-computer',
                license: 'CC-BY-4.0',
                licenseUrl: 'https://github.com/mike42/6502-computer/blob/main/LICENSE.md',
                role: 'HB6502 preset design facts'
            },
            {
                name: 'WDC W65C02S / W65C22 / W65C51N datasheets',
                url: 'https://www.westerndesigncenter.com/wdc/',
                license: 'datasheets',
                role: 'CPU, VIA, and ACIA specifications'
            },
            {
                name: 'Motorola MC6850 + Hitachi HD44780U datasheets',
                url: 'https://en.wikipedia.org/wiki/MC6850',
                license: 'datasheets',
                role: 'ACIA and LCD controller specifications'
            }
        ]
    },

    // ── Example corpus ──────────────────────────────────────────
    {
        title: 'Example corpus',
        titleDe: 'Beispielsammlung',
        entries: [
            {
                name: 'blinkenrocket firmware',
                url: 'https://github.com/blinkenrocket/firmware',
                license: 'LGPL-3.0 OR BSD-3-Clause (per-file)',
                role: 'AVR LED badge firmware examples'
            },
            {
                name: 'Bread80/Couch-To-64k',
                url: 'https://github.com/Bread80/Couch-To-64k',
                license: 'MIT',
                licenseUrl: 'https://github.com/Bread80/Couch-To-64k/blob/main/LICENSE',
                role: 'Z80 tutorial code'
            },
            {
                name: 'chelsea6502/BeebEater',
                url: 'https://github.com/chelsea6502/BeebEater',
                license: 'MIT',
                licenseUrl: 'https://github.com/chelsea6502/BeebEater/blob/main/LICENSE',
                role: 'Machine lineage reference; Acorn ROM is NOT shipped'
            },
            {
                name: 'cute-os',
                url: 'https://github.com/makaram99/cute-os',
                license: 'MIT',
                licenseUrl: 'static/licenses/cute-os.MIT.txt',
                role: 'Optional SDCC Timer0 scheduler lesson',
                note: 'Mahmoud Karam; explicitly adapted guest, not the host scheduler'
            },
            {
                name: 'ElectronicHourGlassKit',
                url: 'https://github.com/mgoblin/ElectronicHourGlassKit',
                license: 'MIT',
                licenseUrl: 'static/firmware/bw8051-1/ElectronicHourGlassKit.LICENSE.txt',
                role: 'Early high-impedance LED scanning firmware',
                note: 'Michael Golovanov; unchanged stage 2 on a simplified circuit'
            },
            {
                name: 'JimKnowler/BreadboardZ80',
                url: 'https://github.com/JimKnowler/BreadboardZ80',
                license: 'MIT',
                licenseUrl: 'https://github.com/JimKnowler/BreadboardZ80/blob/main/LICENSE',
                role: 'Z80 breadboard computer examples'
            },
            {
                name: 'learnagon/bbc-basic-by-example',
                url: 'https://github.com/learnagon/bbc-basic-by-example',
                license: 'CC0',
                role: 'BBC BASIC example programs'
            },
            {
                name: 'losinggeneration/sdsc_print',
                url: 'https://github.com/losinggeneration/sdsc_print',
                license: 'MIT',
                licenseUrl: 'https://github.com/losinggeneration/sdsc_print/blob/master/LICENSE',
                role: 'Z80 SDSC debug print examples'
            },
            {
                name: 'McHogardty/z80',
                url: 'https://github.com/McHogardty/z80',
                license: 'MIT',
                licenseUrl: 'https://github.com/McHogardty/z80/blob/master/LICENCE',
                role: 'Z80 assembly examples'
            },
            {
                name: 'MicroController-Lab',
                url: 'https://github.com/AshrithSagar/MicroController-Lab',
                license: 'MIT',
                licenseUrl: 'static/licenses/ashrith-sagar-microcontroller-lab.MIT.txt',
                role: 'Six reproducible 8051 assembly lessons',
                note: 'Ashrith Sagar; SDAS syntax and explicit observations added'
            },
            {
                name: 'newell-paul/caterpillar-assembler',
                url: 'https://github.com/newell-paul/caterpillar-assembler',
                license: 'MIT',
                licenseUrl: 'https://github.com/newell-paul/caterpillar-assembler/blob/main/LICENSE',
                role: '6502 assembler examples'
            },
            {
                name: 'PainfulDiodes/BeanZeeBytes + z80-breadboard-computer',
                url: 'https://github.com/PainfulDiodes',
                license: 'MIT',
                role: 'Z80 breadboard examples'
            },
            {
                name: 'STC15lib',
                url: 'https://github.com/mgoblin/STC15lib',
                license: 'Apache-2.0',
                licenseUrl: 'static/firmware/bw8051-1/STC15lib.LICENSE.txt',
                role: 'Selected guest-firmware HAL headers',
                note: 'Michael Golovanov (mgoblin), v0.18.0'
            },
            {
                name: 'stc_diyclock',
                url: 'https://github.com/orangetrialtruck/stc_diyclock',
                license: 'MIT',
                licenseUrl: 'static/firmware/bw8051-1/stc_diyclock.LICENSE.txt',
                role: 'Four-digit DS1302 clock firmware and teaching circuit',
                note: 'Jens Jensen; six documented repairs, NMEA disabled'
            },
            {
                name: 'trevor-makes/avr-z80',
                url: 'https://github.com/trevor-makes/avr-z80',
                license: 'MIT',
                licenseUrl: 'https://github.com/trevor-makes/avr-z80/blob/main/LICENSE',
                role: 'AVR-hosted Z80 emulator examples'
            },
            {
                name: 'visrealm/hbc-56',
                url: 'https://github.com/visrealm/hbc-56',
                license: 'MIT',
                licenseUrl: 'https://github.com/visrealm/hbc-56/blob/main/LICENSE',
                role: '6502 homebrew computer examples by visrealm'
            }
        ]
    },

    // ── Editor platform (Scratch stack) ─────────────────────────
    {
        title: 'Editor platform (frozen Scratch stack)',
        titleDe: 'Editor-Plattform (eingefrorener Scratch-Stack)',
        entries: [
            {
                name: 'scratch-gui 4.1.7',
                url: 'https://github.com/scratchfoundation/scratch-gui',
                license: 'BSD-3-Clause',
                licenseUrl: 'https://github.com/scratchfoundation/scratch-gui/blob/develop/LICENSE',
                role: 'Editor UI (pre-relicense pin)'
            },
            {
                name: 'scratch-vm 4.8.115',
                url: 'https://github.com/scratchfoundation/scratch-vm',
                license: 'BSD-3-Clause',
                licenseUrl: 'https://github.com/scratchfoundation/scratch-vm/blob/develop/LICENSE',
                role: 'Block execution engine'
            },
            {
                name: 'scratch-blocks 1.3.0',
                url: 'https://github.com/scratchfoundation/scratch-blocks',
                license: 'Apache-2.0',
                licenseUrl: 'https://github.com/scratchfoundation/scratch-blocks/blob/develop/LICENSE',
                role: 'Block editor (Blockly fork)'
            },
            {
                name: 'scratch-paint 2.2.518',
                url: 'https://github.com/scratchfoundation/scratch-paint',
                license: 'BSD-3-Clause',
                licenseUrl: 'https://github.com/scratchfoundation/scratch-paint/blob/develop/LICENSE',
                role: 'Costume/backdrop editor'
            },
            {
                name: 'scratch-render 1.2.126',
                url: 'https://github.com/scratchfoundation/scratch-render',
                license: 'BSD-3-Clause',
                role: 'WebGL stage renderer'
            },
            {
                name: 'scratch-audio 1.0.332',
                url: 'https://github.com/scratchfoundation/scratch-audio',
                license: 'BSD-3-Clause',
                role: 'Web Audio engine'
            },
            {
                name: 'scratch-storage 2.3.284',
                url: 'https://github.com/scratchfoundation/scratch-storage',
                license: 'BSD-3-Clause',
                role: 'Asset storage layer'
            },
            {
                name: 'scratch-svg-renderer 2.5.46',
                url: 'https://github.com/scratchfoundation/scratch-svg-renderer',
                license: 'BSD-3-Clause',
                role: 'SVG rendering for costumes'
            },
            {
                name: 'scratch-l10n',
                url: 'https://github.com/scratchfoundation/scratch-l10n',
                license: 'BSD-3-Clause',
                role: 'Localisation strings'
            }
        ]
    },

    // ── BrickWright own modules ─────────────────────────────────
    {
        title: 'BrickWright modules',
        titleDe: 'BrickWright-Module',
        entries: [
            {
                name: 'sb3-creator (transpiler)',
                url: 'https://github.com/CrispStrobe',
                license: 'MPL-2.0',
                licenseUrl: `${REPO}/blob/main/overlay/scratch-gui/src/lib/sb3-creator-LICENSE`,
                role: 'Blocks-to-code transpiler (C, Python, JS, BASIC)'
            },
            {
                name: 'bw-board (simulation engine)',
                url: 'https://github.com/CrispStrobe/bw-board',
                license: 'MIT',
                licenseUrl: 'static/licenses/bw-board.MIT.txt',
                role: 'Netlist inference, MNA solver, device drivers, emulator adapters'
            },
            {
                name: 'bw-circuit-ui (circuit designer)',
                url: 'https://github.com/CrispStrobe/bw-circuit-ui',
                license: 'MPL-2.0',
                licenseUrl: 'static/licenses/bw-circuit-ui.MPL-2.0.txt',
                role: 'Board canvas, schematic view, part models, wokwi element wrappers'
            },
            {
                name: 'CrispFXR (SoundFX)',
                url: 'https://github.com/CrispStrobe/CrispFXR-web',
                license: 'BSD-3-Clause',
                role: 'Sound effect generator'
            },
            {
                name: 'wokwi-elements (part artwork)',
                url: 'https://github.com/wokwi/wokwi-elements',
                license: 'MIT',
                licenseUrl: 'https://github.com/wokwi/wokwi-elements/blob/master/LICENSE',
                role: 'Web-component renderings of electronic parts (LED, resistor, etc.)'
            }
        ]
    },

    // ── Key runtime dependencies ────────────────────────────────
    {
        title: 'Key runtime dependencies',
        titleDe: 'Wichtige Laufzeit-Abhangigkeiten',
        entries: [
            {
                name: 'CodeMirror 6',
                url: 'https://codemirror.net/',
                license: 'MIT',
                licenseUrl: 'https://github.com/codemirror/dev/blob/main/LICENSE',
                role: 'Code editor (view, state, language, commands, search, lang-cpp, lang-python, lang-javascript)'
            },
            {
                name: 'xterm.js',
                url: 'https://github.com/xtermjs/xterm.js',
                license: 'MIT',
                licenseUrl: 'https://github.com/xtermjs/xterm.js/blob/master/LICENSE',
                role: 'Terminal emulator for the Linux-on-RISC-V lesson console'
            },
            {
                name: 'LDraw Parts Library',
                url: 'https://library.ldraw.org',
                license: 'CC BY 4.0 (some files CC BY 2.0 and CC BY 4.0)',
                licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
                role: 'Part geometry for the Sim Lab (unmodified official parts; credit: The LDraw Parts Library). Parts added from the whole catalogue are fetched unmodified from the ldraw-stl mirror (https://github.com/CrispStrobe/ldraw-stl); their authors are named in each file and in the palette\'s catalogue view'
            },
            {
                name: 'Jolt Physics (JoltPhysics.js, Brickwright fork)',
                url: 'https://github.com/CrispStrobe/JoltPhysics.js',
                license: 'MIT',
                licenseUrl: 'https://github.com/CrispStrobe/JoltPhysics.js/blob/brickwright/gear-mesh/LICENSE',
                role: 'The Sim Lab physics engine (rigid bodies, hinges, motors, gear meshes)'
            },
            {
                name: 'three.js',
                url: 'https://github.com/mrdoob/three.js',
                license: 'MIT',
                licenseUrl: 'https://github.com/mrdoob/three.js/blob/dev/LICENSE',
                role: 'The SPIKE arena\'s 3D view (renderer, scene, orbit camera)'
            },
            {
                name: 'React + ReactDOM',
                url: 'https://github.com/facebook/react',
                license: 'MIT',
                role: 'UI framework'
            },
            {
                name: 'Redux + react-redux',
                url: 'https://github.com/reduxjs/redux',
                license: 'MIT',
                role: 'State management'
            },
            {
                name: 'Skulpt',
                url: 'https://github.com/skulpt/skulpt',
                license: 'MIT',
                licenseUrl: 'https://github.com/skulpt/skulpt/blob/master/LICENSE',
                role: 'In-browser Python interpreter for code preview'
            },
            {
                name: 'Webpack',
                url: 'https://github.com/webpack/webpack',
                license: 'MIT',
                role: 'Module bundler (build-time)'
            },
            {
                name: 'Babel',
                url: 'https://github.com/babel/babel',
                license: 'MIT',
                role: 'JavaScript transpiler (build-time)'
            }
        ]
    },

    // ── Desktop app (Tauri) ─────────────────────────────────────
    {
        title: 'Desktop app (Tauri)',
        titleDe: 'Desktop-App (Tauri)',
        entries: [
            {
                name: 'Tauri',
                url: 'https://github.com/tauri-apps/tauri',
                license: 'Apache-2.0 OR MIT',
                licenseUrl: 'https://github.com/tauri-apps/tauri/blob/dev/LICENSE_MIT',
                role: 'Desktop/mobile app shell'
            },
            {
                name: 'Rust crate dependencies',
                url: `${REPO}/blob/main/THIRD-PARTY-NOTICES.md#rust-appstaurisrc-tauri`,
                license: 'MIT / Apache-2.0 / BSD / etc.',
                role: '600+ crates listed in THIRD-PARTY-NOTICES.md'
            }
        ]
    }
];

export default ABOUT_GROUPS;
