// arduino-sketch.js -- a hand-written Arduino sketch, compiled and booted.
//
// The C tab on an AVR board used to have one thing to do with its buffer: read
// it back into blocks. That reader handles the GPIO subset, and it refuses --
// correctly -- what blocks cannot say: `Serial.println`, `String`, a class, a
// template, `#include <Wire.h>`. So a real Arduino sketch had nowhere to go.
//
// stc-compiler's `arduino` language route compiles exactly that: a sketch as
// the Arduino IDE compiles it, real C++ against the vendored ArduinoCore-avr
// (Uno, Nano, Mega) or ATTinyCore (ATtiny85/88), with the IDE's prototype
// generation and the core's bundled libraries. What comes back is an Intel HEX
// image, and the debug panel already runs an Intel HEX image on avr8js: the
// "Load firmware" path. This module is the join between the two, kept free of
// React so the mapping and the failure classes are testable in Node.
//
// avr-gcc is GPL and cannot run in the page, so this route is HOSTED and says
// so; it never falls back to anything local, because there is nothing local
// that compiles C++ for an AVR.

/**
 * Every device the route serves, keyed by the id the Code tab's device picker
 * uses. `target` is what the service's `arduino` route accepts (it takes the
 * board names as well as the chip names, because the Nano's variant is not
 * the Uno's). `kind` is the debug engine that runs the image -- the same
 * device-to-kind choice debug-panel's syncDeviceKind makes, so a sketch lands
 * on the engine a blocks program for the same board would. `clockHz` is the
 * board's crystal, which the image is built for and must be simulated at: the
 * runner defaults to 16 MHz, and an 8 MHz ATtiny run at 16 MHz would keep
 * perfect time in its own terms while every delay() lasted half as long.
 */
export const ARDUINO_SKETCH_BOARDS = Object.freeze({
    'arduino-uno': {target: 'arduino-uno', kind: 'avr8js', clockHz: 16000000},
    'arduino-nano': {target: 'arduino-nano', kind: 'avr8js', clockHz: 16000000},
    atmega328p: {target: 'atmega328p', kind: 'avr8js', clockHz: 16000000},
    atmega168p: {target: 'atmega168p', kind: 'avr8js', clockHz: 16000000},
    // The Mega joined once the pinned bw-board put the ATmega2560's stack
    // inside its data space (bw-board #41: SRAM is 0x200-0x21FF, above the
    // extended I/O; before that every compiled Mega program reset-looped at
    // its first RET).
    'arduino-mega': {target: 'arduino-mega', kind: 'atmega2560', clockHz: 16000000},
    atmega2560: {target: 'atmega2560', kind: 'atmega2560', clockHz: 16000000},
    // The Arduboy's engine is its CONSOLE (bw-arduboy), not the debugger: the
    // image goes where a picked Arduboy .hex goes, with its screen and pad.
    arduboy: {target: 'arduboy', kind: 'arduboy', clockHz: 16000000},
    attiny85: {target: 'attiny85', kind: 'attiny85', clockHz: 8000000},
    attiny88: {target: 'attiny88', kind: 'attiny88', clockHz: 8000000}
});

/** The route's entry for a device, or null when the device is not an AVR the
 *  route serves. Case-insensitive, like every other device lookup here. */
export function sketchBoardFor (device) {
    const d = String(device || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(ARDUINO_SKETCH_BOARDS, d)
        ? ARDUINO_SKETCH_BOARDS[d] : null;
}

/** A build failure, classed the way the status line needs it: 'source' is the
 *  user's program (the message names the sketch line), 'transport' is the
 *  network or the service -- nothing an edit can fix. */
export class SketchBuildError extends Error {
    constructor (message, reason, log) {
        super(message);
        this.name = 'SketchBuildError';
        this.reason = reason;
        this.log = log || '';
    }
}

/**
 * Compile a sketch on the hosted service. `compile` is the caller's ONE hosted
 * compile (pseudocode-importer's hostedCompileC), passed in so this module
 * never holds a URL of its own and the importer's single fetch site stays the
 * only one. It resolves to the service's response and rejects with the
 * service's message when `success` is false.
 *
 * @param {{source: string, device: string, compile: Function}} req
 * @returns {Promise<{hex: string, bytes: number, clockHz: number,
 *   builtForHz: number|null, kind: string,
 *   target: string, prototypes: string[], libraries: string[], log: string,
 *   memory: string, symbols: object|null}>}
 */
export async function requestSketchBuild ({source, device, compile}) {
    const board = sketchBoardFor(device);
    if (!board) {
        throw new SketchBuildError(`no Arduino sketch route for '${device}'`, 'transport');
    }
    let out;
    try {
        // symbols: the sketch's globals, functions and main.ino lines, so the
        // debugger's variables view reads them. The service compiles the
        // sketch without LTO for such a build, so the image and its table
        // always come from the same request -- never pair them otherwise.
        // Not for the Arduboy: its image goes to the console, which has no
        // variables view, and a symbols build (the sketch without LTO) is
        // larger -- on a part with 28 KB for the sketch that is a real cost.
        out = await compile(source, board.target, 'hex', 'arduino',
            board.kind === 'arduboy' ? {} : {symbols: true});
    } catch (e) {
        const message = e && e.message ? e.message : String(e);
        // hostedCompileC throws the SERVICE's message when it refused the
        // program, and fetch's own TypeError when the network did. Only the
        // first is the user's to fix.
        const transport = (e && e.name === 'TypeError') || /failed to fetch|network/i.test(message);
        throw new SketchBuildError(message, transport ? 'transport' : 'source', e && e.log);
    }
    const hex = decodeBase64Text(out.base64);
    if (!/^\s*:/.test(hex)) {
        throw new SketchBuildError('the service returned an image that is not Intel HEX', 'transport');
    }
    return {
        hex,
        bytes: hexImageBytes(hex),
        // The simulated chip runs at the BOARD's crystal, never at the clock
        // the response reports. Simulating at the image's own F_CPU makes a
        // mis-built image self-consistent -- built for 11 MHz, run at 11 MHz,
        // every delay() exact -- which is how stc-compiler's own timing check
        // once stayed green with exactly that bug in place. What the image
        // was built for is kept beside it so a mismatch can be SAID.
        clockHz: board.clockHz,
        builtForHz: Number(out.f_cpu) || null,
        kind: board.kind,
        target: board.target,
        prototypes: Array.isArray(out.prototypes) ? out.prototypes : [],
        libraries: Array.isArray(out.libraries) ? out.libraries : [],
        log: out.log || '',
        memory: out.memory || '',
        // null when the service returned none (an older deployment, or a
        // table it could not build): the image still runs, the variables
        // view just has nothing to show.
        symbols: out.symbols || null
    };
}

/** The firmware object debug-runner's setFirmware takes, for a built sketch. */
export function sketchFirmware (built, name = 'sketch.hex') {
    return {name, bytes: null, text: built.hex, fCpu: built.clockHz,
        symbols: built.symbols || null, device: built.target};
}

/** Bytes of program an Intel HEX text describes (data records only). */
export function hexImageBytes (hex) {
    let n = 0;
    for (const line of String(hex).split(/\r?\n/)) {
        if (line[0] === ':' && line.slice(7, 9) === '00') n += parseInt(line.slice(1, 3), 16);
    }
    return n;
}

function decodeBase64Text (b64) {
    if (typeof atob === 'function') return atob(String(b64 || ''));
    return Buffer.from(String(b64 || ''), 'base64').toString('latin1');
}
