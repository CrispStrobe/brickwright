// SPDX-License-Identifier: BSD-3-Clause
// CrispBASIC portable physical-computing library (contract 2) for PicoBB on
// the RP2040. This file is mirrored byte-for-byte at
// overlay/scratch-gui/src/lib/bw-machines/crispbasic-picobb-library.js, so it
// has no imports. It contains no PicoBB/BBCSDL code: the library is ordinary
// BBC BASIC that the unmodified, pinned PicoBB interpreter executes, using
// PicoBB's documented SYS access to pico-sdk GPIO and timer functions.
//
// Delivery: the user's program keeps the physical-line numbering CrispBASIC's
// source preparation uses (1..65279); the library occupies the reserved lines
// 65280..65535, starting with END so a program that falls off its last line
// stops exactly as it does in the reference host. User DEF overrides of the
// public names still win, because BBC BASIC finds the first matching DEF.

/** Lines 65280.. are reserved for the library; user lines must be lower. */
export const PICOBB_LIBRARY_FIRST_LINE = 65280;
export const PICOBB_MAX_USER_LINE = 65279;
/** PicoBB's line editor in this console build: printable ASCII only. */
export const PICOBB_MAX_TYPED_LINE = 240;
/** GP0/GP1 carry the UART0 console of the pinned firmware build. */
export const PICOBB_CONSOLE_PINS = Object.freeze([0, 1]);
/** The pi_pico profile's pins minus the two console pins. */
export const PICOBB_CRISPBASIC_PINS = Object.freeze([
    ...Array.from({length: 21}, (_, i) => i + 2), 25, 26, 27, 28]);

export const PICOBB_LIBRARY_LINES = Object.freeze([
    "65280 END:REM CrispBASIC portable library, contract 2, for PicoBB on RP2040",
    "65281 DEF PROCpinMode(_crispPin,_crispMode$):LOCAL _crispM%:IF FN_crispNew THEN PROC_crispBegin",
    "65282 IF _crispPin<0 OR _crispPin>65535 THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65283 IF _crispPin<>INT(_crispPin) THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65284 _crispM%=-1:IF _crispMode$=\"input\" THEN _crispM%=0",
    "65285 IF _crispMode$=\"output\" THEN _crispM%=1",
    "65286 IF _crispMode$=\"input-pullup\" THEN _crispM%=2",
    "65287 IF _crispM%<0 THEN ERROR 202,\"Simulation invalid-mode: expected input, output or input-pullup\"",
    "65288 IF (_crispPin<2 OR _crispPin>22) AND (_crispPin<25 OR _crispPin>28) THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65289 IF _crispM%=1 THEN SYS \"gpio_set_dir\",_crispPin,1:SYS \"gpio_disable_pulls\",_crispPin:ENDPROC",
    "65290 IF _crispM%=2 THEN SYS \"gpio_pull_up\",_crispPin ELSE SYS \"gpio_disable_pulls\",_crispPin",
    "65291 SYS \"gpio_set_dir\",_crispPin,0",
    "65292 ENDPROC",
    "65293 DEF PROCdigitalWrite(_crispPin,_crispValue):LOCAL _crispO%:IF FN_crispNew THEN PROC_crispBegin",
    "65294 IF _crispPin<0 OR _crispPin>65535 THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65295 IF _crispPin<>INT(_crispPin) THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65296 IF _crispValue<>0 AND _crispValue<>1 THEN ERROR 203,\"Simulation invalid-level: expected numeric 0 or 1\"",
    "65297 IF (_crispPin<2 OR _crispPin>22) AND (_crispPin<25 OR _crispPin>28) THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65298 SYS \"gpio_is_dir_out\",_crispPin TO _crispO%:IF (_crispO% AND 1)=0 THEN ERROR 205,\"Simulation pin-not-output: pin is not configured as output\"",
    "65299 SYS \"gpio_put\",_crispPin,_crispValue",
    "65300 ENDPROC",
    "65301 DEF PROCdigitalToggle(_crispPin):LOCAL _crispO%:IF FN_crispNew THEN PROC_crispBegin",
    "65302 IF _crispPin<0 OR _crispPin>65535 THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65303 IF _crispPin<>INT(_crispPin) THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65304 IF (_crispPin<2 OR _crispPin>22) AND (_crispPin<25 OR _crispPin>28) THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65305 SYS \"gpio_is_dir_out\",_crispPin TO _crispO%:IF (_crispO% AND 1)=0 THEN ERROR 205,\"Simulation pin-not-output: pin is not configured as output\"",
    "65306 SYS \"gpio_xor_mask\",1<<_crispPin",
    "65307 ENDPROC",
    "65308 DEF FNdigitalRead(_crispPin):LOCAL _crispV%:IF FN_crispNew THEN PROC_crispBegin",
    "65309 IF _crispPin<0 OR _crispPin>65535 THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65310 IF _crispPin<>INT(_crispPin) THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65311 IF (_crispPin<2 OR _crispPin>22) AND (_crispPin<25 OR _crispPin>28) THEN ERROR 201,\"Simulation invalid-pin: unknown or invalid logical pin\"",
    "65312 SYS \"gpio_get\",_crispPin TO _crispV%",
    "65313 =_crispV% AND 1",
    "65314 DEF PROCdelay(_crispMilliseconds):LOCAL _crispC%,_crispN%,_crispD,_crispS%:IF FN_crispNew THEN PROC_crispBegin",
    "65315 IF _crispMilliseconds<0 OR _crispMilliseconds>2147483647 THEN ERROR 204,\"Simulation invalid-time: expected nonnegative integer milliseconds\"",
    "65316 IF _crispMilliseconds<>INT(_crispMilliseconds) THEN ERROR 204,\"Simulation invalid-time: expected nonnegative integer milliseconds\"",
    "65317 IF _crispMilliseconds>2147483647-_crispMs% THEN PRINT \"Simulation time-limit reached\":END",
    "65318 WHILE _crispMilliseconds>0:_crispC%=_crispMilliseconds:IF _crispC%>1000000 THEN _crispC%=1000000",
    "65319 REPEAT:SYS \"time_us_32\" TO _crispN%:_crispD=_crispN%-_crispT%:IF _crispD<0 THEN _crispD+=2^32",
    "65320 _crispS%=_crispC%*1000-_crispD:IF _crispS%>20000 THEN _crispS%=20000",
    "65321 IF _crispS%>0 THEN SYS \"sleep_us\",_crispS%,0",
    "65322 UNTIL _crispS%<=0",
    "65323 _crispD=_crispT%+_crispC%*1000:IF _crispD>=2^31 THEN _crispD-=2^32",
    "65324 _crispT%=_crispD:_crispMs%+=_crispC%:_crispMilliseconds-=_crispC%:ENDWHILE",
    "65325 ENDPROC",
    "65326 DEF FNmillis:IF FN_crispNew THEN PROC_crispBegin",
    "65327 =_crispMs%",
    "65328 DEF FN_crispNew:LOCAL _crispF%:ON ERROR LOCAL _crispF%=TRUE",
    "65329 IF _crispF%=0 THEN _crispF%=(_crispOn%=0)",
    "65330 =_crispF%",
    "65331 DEF PROC_crispBegin:LOCAL _crispP%:_crispOn%=1:_crispMs%=0",
    "65332 FOR _crispP%=2 TO 28",
    "65333 IF _crispP%<23 OR _crispP%>24 THEN SYS \"gpio_disable_pulls\",_crispP%:SYS \"gpio_set_dir\",_crispP%,0:SYS \"gpio_put\",_crispP%,0:SYS \"gpio_set_function\",_crispP%,5",
    "65334 NEXT",
    "65335 SYS \"time_us_32\" TO _crispT%",
    "65336 ENDPROC"
]);

/** The exact library text whose sha256 is recorded in pico/picobb.lock.json. */
export const PICOBB_LIBRARY_TEXT = PICOBB_LIBRARY_LINES.join('\n') + '\n';

export class PicoBBSourceError extends Error {
    constructor (message, line = null) {
        super(line === null ? message : `line ${line}: ${message}`);
        this.name = 'PicoBBSourceError';
        this.code = 'picobb-source';
        this.line = line;
    }
}

/**
 * Number a CrispBASIC listing exactly as CrispBASIC's prepareSource does
 * (unnumbered: physical line N becomes BASIC line N; numbered: the explicit
 * numbers), then refuse anything the PicoBB UART line editor cannot enter
 * unchanged. Nothing is silently rewritten: tabs, non-ASCII, over-long lines
 * and reserved line numbers are refused with the physical line.
 *
 * @param {string} source
 * @returns {{commands: string[], lines: {line: number, basicLine: number}[],
 *   sourceMap: Object<number, number>}} commands end with the library and RUN;
 *   a hardware sender prepends NEW itself.
 */
export function crispBasicPicoProgram (source) {
    if (typeof source !== 'string') throw new PicoBBSourceError('source must be a string');
    const normalized = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const physical = normalized === '' ? [] : normalized.split('\n');
    if (normalized.endsWith('\n')) physical.pop();
    const records = [];
    let numbered = null;
    physical.forEach((text, index) => {
        const line = index + 1;
        if (/^[ \t]*$/.test(text)) return;
        if (/[^\x20-\x7e]/.test(text)) {
            throw new PicoBBSourceError('the PicoBB console accepts printable ASCII only (no tabs or accented characters)', line);
        }
        const match = /^ *(\d+)(.*)$/.exec(text);
        if (/^ *[+-]\d/.test(text) || (match && /^\.|^[eE][+-]?\d/.test(match[2]))) {
            throw new PicoBBSourceError('line numbers must be unsigned whole decimal integers', line);
        }
        const isNumbered = Boolean(match);
        if (numbered === null) numbered = isNumbered;
        if (numbered !== isNumbered) throw new PicoBBSourceError('numbered and unnumbered source lines cannot be mixed', line);
        const basicLine = isNumbered ? Number(match[1]) : line;
        if (!Number.isSafeInteger(basicLine) || basicLine < 1 || basicLine > PICOBB_MAX_USER_LINE) {
            throw new PicoBBSourceError(`line numbers must be in 1..${PICOBB_MAX_USER_LINE}; ` +
                `${PICOBB_LIBRARY_FIRST_LINE}.. are reserved for the CrispBASIC library`, line);
        }
        if (records.length && basicLine <= records.at(-1).basicLine) {
            throw new PicoBBSourceError('explicit line numbers must be unique and strictly increasing', line);
        }
        const typed = isNumbered ? `${basicLine}${match[2]}` : `${basicLine} ${text}`;
        if (typed.length > PICOBB_MAX_TYPED_LINE) {
            throw new PicoBBSourceError(`a typed PicoBB line may hold ${PICOBB_MAX_TYPED_LINE} characters including its number`, line);
        }
        records.push({line, basicLine, typed});
    });
    if (!records.length) throw new PicoBBSourceError('Enter a BASIC program first.');
    return {
        commands: [...records.map(record => record.typed), ...PICOBB_LIBRARY_LINES, 'RUN'],
        lines: records.map(({line, basicLine}) => ({line, basicLine})),
        sourceMap: Object.fromEntries(records.map(({line, basicLine}) => [basicLine, line]))
    };
}

export const crispBasicPicoCommands = source => crispBasicPicoProgram(source).commands;
