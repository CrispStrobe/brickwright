/**
 * Which assembler the ▶ button uses, and why one tab now has two.
 *
 * THE INCONSISTENCY IS REAL AND IT IS ARGUED FOR, NOT APOLOGISED FOR.
 * Until now every ▶ Assemble & Run posted the editor's text to the hosted
 * service (stc-compiler /assemble — sdas8051, ca65+ld65, sdasz80, avr-gcc).
 * One route, one error surface, one thing to explain. The 8086 breaks that,
 * and the reason is not that nobody got round to it: NEITHER ca65 NOR
 * sdasz80 KNOWS THE 8086. There is no 8086 back end behind that URL, so the
 * choice was never "one route or two" — it was "two routes, or the 8086 has
 * no ASM tab at all". ROADMAP §4.4 recorded that as a decision owed rather
 * than a task pending, and this file is the decision.
 *
 * The case FOR, beyond necessity: where the local route applies it is
 * strictly better. It needs no network, so the button works on a train and
 * in a school that blocks the domain; it is the same assembler the 8086
 * corpus harness runs, differentially checked against MASM 1.10 across 404
 * programs and round-trip-verified against a disassembler that agrees with
 * 646,000 hardware vectors; and it returns a loadable image rather than a
 * base64 round trip.
 *
 * The case AGAINST is the one worth taking seriously: two routes mean two
 * error surfaces and two sets of behaviour to learn. A syntax error from
 * ca65 reads nothing like an `AsmError` from i8086-asm.js, and a user who
 * has learned one has not learned the other. That cost is paid, not dodged.
 * What is bought with it is that the SAME learner can write 8086 assembly at
 * all.
 *
 * THREE RULES KEEP THE COST BOUNDED, and each is asserted by
 * `test/asm-assemble-route.test.mjs`:
 *
 *   1. ONE function decides. `asmTargetForDevice` is the only place a device
 *      becomes a target and `asmRouteFor` the only place a target becomes a
 *      route. The call site does not get a vote, so the tab cannot pick
 *      differently in two places.
 *   2. NEITHER ROUTE CAN LEAK INTO THE OTHER. An 8086 program is never
 *      posted anywhere — the gate injects a `hostedFetch` that throws and
 *      requires it untouched — and a 6502/Z80/8051 program never reaches the
 *      local assembler, which would refuse its syntax with a message about
 *      the wrong architecture.
 *   3. THE RESULT SAYS WHICH ROUTE RAN. `route` comes back on every result
 *      and the tab puts it in the status line, because "it assembled" is a
 *      different sentence from "it assembled here, without the network".
 *      Silence about which of two things happened is the failure mode this
 *      whole codebase keeps paying for.
 *
 * NOT DONE, deliberately: moving the 6502/Z80/8051 targets local as well.
 * That is the change that would REMOVE the inconsistency, and it is much
 * larger — ca65, sdasz80 and sdas8051 are C programs, and lite already
 * carries one Emscripten toolchain (`lib/sdcc-wasm`) whose size is a
 * standing complaint. Recording it as the alternative that was weighed is
 * more honest than pretending two routes were the only shape available.
 *
 * @module
 */

/** The hosted assembler, verbatim from the call site it replaced. */
export const HOSTED_ASSEMBLER = 'https://stc-compiler.vercel.app/assemble';

// DOS toolchain routes (Pascal via ACK, GW-BASIC): a compiler .EXE runs on the
// browser DOS bench and its output is read back (see bw-debug/dos-compile.js).
// Re-exported here, beside the other code-tab routes, so the code tab reaches
// them from one place. The routes are experimental (verified:false) until each
// toolchain's command sequence is confirmed against its real binaries.
export {DOS_TOOLCHAINS, HOSTED_TOOLCHAINS, runDosToolchain,
    runHostedToolchain, hostedToolchainReady, hostedEndpointFor} from '../bw-debug/dos-toolchain-routes.js';

// CP/M-80 (Z80) toolchain routes: a host cross-compiler (ACK's z80+cpm backend,
// or SDCC) emits a Z80 CP/M .COM that runs on the browser CP/M service layer
// (bw-debug/cpm-z80.js). Re-exported here beside the DOS routes so the code tab
// reaches every code-run route from one place.
export {CPM_TOOLCHAINS, runCpmToolchain} from '../bw-debug/dos-toolchain-routes.js';

/**
 * Targets assembled IN THE BROWSER. One entry, and it is a whitelist rather
 * than a "not hosted" fallback on purpose: a device this file has never
 * heard of must go to the hosted service, which knows about devices this
 * file does not, rather than to an 8086 assembler that would read its 8051
 * source as garbage.
 */
export const LOCAL_ASM_TARGETS = new Set(['i8086', 'riscv32']);

/**
 * A refusal with its route attached, so the tab can say WHERE a program was
 * refused as well as why. `reason` separates a program the assembler read
 * and rejected ('source' — the user's problem, and the message names the
 * line) from a route that could not run at all ('transport' — the network,
 * or a missing module).
 */
export class AsmRouteError extends Error {
    constructor (message, {route, target, reason} = {}) {
        super(message);
        this.name = 'AsmRouteError';
        this.route = route;
        this.target = target;
        this.reason = reason || 'transport';
    }
}

/**
 * Device id → assembler target.
 *
 * The 8086 family is tested FIRST and by whole-string match. `i8088` and
 * `8088` answer to it because the 8088 is an 8086 with an eight-bit bus:
 * same instruction set, same encodings, so the same assembler emits the
 * same bytes — the difference is bus timing, which no assembler expresses.
 * Refusing the 8088 by name would refuse a machine we can in fact assemble
 * for, which is the reading `circuit-tab.jsx` already takes for the debug
 * core.
 */
export function asmTargetForDevice (device) {
    const d = String(device || '').toLowerCase();
    if (/^(i8086|8086|i8088|8088)$/.test(d)) return 'i8086';
    // The RV32IMA console: a LOCAL assembler (bw-board/riscv-asm.js), like the
    // 8086, so a learner can write RISC-V assembly with no network and no chip
    // service that knows the syntax (stc-compiler's /assemble does not).
    if (/^riscv(32)?$/.test(d) || /rv32/.test(d)) return 'riscv32';
    if (/6502|eater/.test(d)) return 'eater6502';
    if (/^(z80|zx48|zx128)$/.test(d)) return 'z80';
    // N4: the ARM devices /assemble serves. The Pico's chip is the
    // rp2040 and the micro:bit's the nrf52833 (the Calliope mini carries the
    // same); the STM32F030/G030/F103 already are their own chip ids.
    if (d === 'pico' || d === 'rp2040') return 'rp2040';
    if (/^(microbit|micro-bit|calliopemini)$/.test(d)) return 'nrf52833';
    if (/^(stm32g0|stm32g030)$/.test(d)) return 'stm32g030';
    if (/^(stm32f1|stm32f103|bluepill|blue-pill)$/.test(d)) return 'stm32f103';
    // Arduino boards are not MCU ids; /assemble knows the chip. Mirror the C
    // tab's COMPILE_TARGET (bw-debug/shipped-images.js): uno/nano -> atmega328p,
    // mega -> atmega2560. Without this the ASM tab posted 'arduino-uno' and the
    // service, which knows only chip ids, could not route it.
    if (d === 'arduino-uno' || d === 'arduino-nano') return 'atmega328p';
    if (d === 'arduino-mega') return 'atmega2560';
    // /assemble takes 8051 and AVR device ids directly (stc*, atmega*,
    // attiny*), so an unrecognised id is passed through rather than mapped.
    return d || 'stc12c5a60s2';
}

/** 'local' or 'hosted', for a device id. The tab shows this to the user. */
export function asmRouteFor (device) {
    return LOCAL_ASM_TARGETS.has(asmTargetForDevice(device)) ? 'local' : 'hosted';
}

/**
 * Targets whose **C** is compiled IN THE BROWSER, by SmallerC rather than by
 * `stc-compiler /compile`.
 *
 * A separate set from `LOCAL_ASM_TARGETS` even though today they hold the
 * same one id, because they answer different questions and will diverge: the
 * 8051 has a local C compiler (`sdcc-wasm`) and a HOSTED assembler, which is
 * the exact opposite pairing. Deriving one from the other would encode a
 * coincidence.
 *
 * The 8086 is here because the hosted service has no 8086 C back end at all
 * (ROADMAP §3.8.2b, door 1 — `ia16-elf-gcc` is not deployed), so this is not
 * "local instead of hosted", it is "local or nothing".
 */
export const LOCAL_C_TARGETS = new Set(['i8086']);

/** 'local' or 'hosted', for a C build on a device id. The tab shows this. */
export function cRouteFor (device) {
    return LOCAL_C_TARGETS.has(asmTargetForDevice(device)) ? 'local' : 'hosted';
}

/**
 * Targets whose **BASIC** compiles IN THE BROWSER, by bw-board's basicToAsm
 * (BASIC -> 8086 asm) rather than running on a 6502/Z80 ROM interpreter.
 *
 * A separate set from LOCAL_C_TARGETS on the same principle as that one is
 * separate from LOCAL_ASM_TARGETS: the 8086 is the only chip with a BASIC->asm
 * compiler, while 6502/Z80 run BASIC as a ROM interpreter (pseudocode-importer
 * `runBasic`) and have no native BASIC image. Deriving one set from another
 * would encode a coincidence.
 */
export const LOCAL_BASIC_TARGETS = new Set(['i8086']);

/** 'local' (compile to an 8086 .COM) or 'rom' (run on a 6502/Z80 interpreter). */
export function basicRouteFor (device) {
    return LOCAL_BASIC_TARGETS.has(asmTargetForDevice(device)) ? 'local' : 'rom';
}

/**
 * The in-browser 8086 assembler, loaded on demand.
 *
 * THE COMPONENT AND THE GATE BOTH REACH IT THROUGH THIS FUNCTION, and that
 * is the point of it existing rather than being inlined at the call site.
 * The recurring defect in this repo is "a test that supplied a precondition
 * production code never supplies"; a gate that imported `i8086-asm.js`
 * itself would prove the assembler works and prove nothing about the button.
 * `requestAssembly` DEFAULTS to this, the tab passes no override, and the
 * gate passes none either — so there is exactly one local path and both run
 * it.
 *
 * The chunk is ~90 KB of JavaScript and is not in the main bundle: nobody
 * who is not writing 8086 assembly pays for it.
 */
export const ASM_DIALECTS = Object.freeze(['auto', 'masm', 'nasm']);

export async function assembleLocal8086 (source, opts = {}) {
    const mod = await import(/* webpackChunkName: "i8086-asm" */ 'bw-board/i8086-asm.js');
    const assemble = mod.assemble || mod.default;
    if (typeof assemble !== 'function') {
        throw new AsmRouteError(
            'the local 8086 assembler loaded but exports no assemble()',
            {route: 'local', target: 'i8086', reason: 'transport'});
    }
    // longJumps stays OFF. The module's header explains why at length: the
    // programs it rescues cannot assemble under MASM either, so promoting
    // them silently would hand a learner a program that works here and fails
    // on the lab machine with nothing to say why. A refusal that names the
    // line is the better teacher.
    //
    // `dialect` is the learner's choice from the ASM tab: 'auto' lets the
    // assembler read the source's own signals (and REFUSE when both dialects'
    // signals are present), 'masm' or 'nasm' settles it. Anything else is
    // refused here by name rather than defaulted, the assembler's own rule.
    const dialect = opts.dialect || 'auto';
    if (!ASM_DIALECTS.includes(dialect)) {
        throw new AsmRouteError(`dialect "${dialect}" — only auto, masm and nasm exist`,
            {route: 'local', target: 'i8086', reason: 'source'});
    }
    return assemble(source, {dialect});
}

/**
 * The local RV32IM assembler — the twin of assembleLocal8086 for the riscv32
 * console. Loads bw-board's `riscv-asm.js` (its own webpack chunk, not in the
 * main bundle) and returns the loadable image the bench boots:
 * `{entry, segments:[{addr,bytes}]}`. RISC-V has ONE syntax, so there is no
 * dialect to choose. The program talks to the console through the machine's
 * ECALL ABI (a7=64 write, a7=93 exit).
 */
/**
 * Webpack substitutes this property with the build's configured endpoint.
 * The browser and desktop webview do not need a Node process object.
 */
export const RISCV_CC_ENDPOINT = process.env.BW_RISCV_CC_ENDPOINT || null;

/**
 * The RISC-V C route for the Code tab. Compiles C to the shared loadable
 * {entry, segments} image — the SAME shape assembleLocalRiscv returns, so
 * debug-panel/debug-runner boot it through the identical riscvImage path.
 *
 * PRIMARY: in-browser, no server. bw-board's `riscv-cc-wasm.js` runs shecc
 * (compiled to wasm) and returns the image — the whole C → rv32 path in the tab,
 * with no endpoint. A compile error is the PROGRAM's: it is surfaced, never
 * retried on a service that would give the same error.
 *
 * FALLBACK: the hosted service (`lib/bw-debug/riscv-compile.js`), used only when
 * the in-browser compiler cannot LOAD (never when it rejects a program) and an
 * endpoint is configured, or when `preferHosted` is set. It speaks the v1
 * /compile contract (`services/riscv-cc/`) and tolerates the stc-compiler shape.
 * Each path is loaded on demand so a build that never compiles RISC-V C pays
 * nothing.
 */
export async function requestRiscvCBuild ({source, endpoint = RISCV_CC_ENDPOINT,
    fetchImpl = null, route = 'browser', hostedTarget = 'riscv32-gcc',
    preferHosted = false} = {}) {
    // The user CHOOSES the path (a subset that runs with no server, or the full
    // compiler on the service). 'browser' = in-browser shecc.wasm (a C subset,
    // no server); 'server' = the hosted service — full C via native gcc+picolibc
    // (`hostedTarget` 'riscv32-gcc'), or shecc hosted ('riscv32'). `preferHosted`
    // stays as an alias for 'server'.
    const wantServer = preferHosted || route === 'server';
    if (!wantServer) {
        try {
            const {compileRiscvC} = await import(
                /* webpackChunkName: "riscv-cc-wasm" */ 'bw-board/riscv-cc-wasm.js');
            const r = await compileRiscvC(source);
            return riscvImageResult('local-wasm', r.image, r.log);
        } catch (e) {
            // A compile error is the program's — surface it, do not fall through
            // to a service that would reject the same source identically.
            if (e && e.name === 'RiscvCcError' && e.reason === 'compile') {
                throw new AsmRouteError(e.log || e.message,
                    {route: 'local-wasm', target: 'riscv32', reason: 'source'});
            }
            // The in-browser compiler could not load/run (transport). Fall back
            // to a configured hosted service; with none, refuse by name.
            if (!endpoint) {
                throw new AsmRouteError(
                    'the in-browser RISC-V C compiler could not load'
                        + (e && e.message ? `: ${e.message}` : ''),
                    {route: 'local-wasm', target: 'riscv32', reason: 'transport'});
            }
        }
    }
    const {compileRiscvC} = await import(/* webpackChunkName: "riscv-compile" */ '../bw-debug/riscv-compile.js');
    const r = await compileRiscvC({source, endpoint, target: hostedTarget, fetchImpl});
    if (!r.ok) {
        throw new AsmRouteError(r.reason || 'the RISC-V C compiler refused this program',
            {route: 'hosted', target: hostedTarget,
                reason: r.code === 'no-compile-service' || r.code === 'service-unreachable'
                    || r.code === 'service-error' || r.code === 'no-fetch' ? 'transport' : 'source'});
    }
    return riscvImageResult('hosted', r.image, r.log);
}

// The shared riscv image shape both routes return (and assembleLocalRiscv's
// branch mirrors), so the boot path never learns which compiler produced it.
function riscvImageResult (route, image, log) {
    return {target: 'riscv32', route, format: 'riscv',
        image, entry: image.entry, slotId: 'riscv', profile: 'riscv',
        bytes: null, org: null, dialect: null, warnings: [], listing: log ? [log] : []};
}

export async function assembleLocalRiscv (source) {
    const mod = await import(/* webpackChunkName: "riscv-asm" */ 'bw-board/riscv-asm.js');
    const assemble = mod.assembleRiscv || mod.default;
    if (typeof assemble !== 'function') {
        throw new AsmRouteError(
            'the local RISC-V assembler loaded but exports no assembleRiscv()',
            {route: 'local', target: 'riscv32', reason: 'transport'});
    }
    return assemble(source);   // {ok, image:{entry,segments}, entry, symbols, bytes}
}

/**
 * The C runtime startup a `.COM` needs around a C `main`.
 *
 * SMALLERC EMITS A MODULE, NOT A PROGRAM. `_main` is a function and nothing
 * calls it -- normally SmallerC's own linker supplies this, and we do not ship
 * the linker because our assembler produces the flat image directly.
 *
 * Without it the machine executes the compiler's data and epilogue as though
 * they were an entry point, terminates in single-digit steps and exits 0. A
 * program that exits immediately looks exactly like one that ran, which is why
 * this is six lines of assembly with a paragraph in front of it. Two probes
 * were written and believed before the missing startup was the answer.
 *
 * SmallerC's convention is cdecl with the result in AX, so INT 21h/AH=4Ch
 * carries `main`'s return value out as the DOS exit code.
 */
const C_STARTUP = [
    'bits 16',
    'org 100h',
    'section .text',
    // ARGC AND ARGV ARE PUSHED, and they were not. SmallerC is cdecl, so a
    // program declaring `main(int argc, char **argv)` reads argc from [bp+4]
    // and argv from [bp+6]. With nothing pushed those are whatever the stack
    // held below a .COM's SP -- measured: argc came out 0 by luck and argv
    // came out NON-NULL, so a program testing `argv == 0` took the wrong
    // branch. `int main(void)` never looks, which is why every earlier test
    // passed and this stayed invisible.
    //
    // It does not crash. It produces a program that walks arguments that do
    // not exist, which on this bench reads as the learner's own bug.
    //
    // Right-to-left, so argc lands nearest the return address; the caller
    // cleans, which is cdecl. A real DOS startup would parse the PSP command
    // tail into a real argv -- this hands over the honest empty case rather
    // than inventing one.
    '    xor ax, ax',
    '    push ax',          // argv = NULL
    '    push ax',          // argc = 0
    '    call _main',
    '    add sp, 4',        // cdecl: the caller cleans
    '    mov ah, 4Ch',
    '    int 21h',
].join('\n') + '\n';

/**
 * Machine-service primitives for compiled C. SmallerC has no inline asm, so a
 * C program declares these `extern` and CALLS them. Their bodies use the SAME
 * idioms pseudocode-8086.js emits for the ASM route: OUT/IN for the 8255 and
 * INT 15h/AH=86h for a single-script wait.
 *
 * The contract is cdecl, matching SmallerC's 16-bit output: arguments are
 * 16-bit words pushed right to left (so the first argument sits at [bp+4]), the
 * caller cleans the stack, and a result comes back in AX. This is the API the
 * C tab's 8086 note documents.
 *
 * `bw_outb(port, value)` — write `value` (low byte) to I/O `port`.
 * `bw_inb(port)`         — read a byte from I/O `port`, zero-extended.
 * `bw_delay_ms(ms)`      — wait through BIOS INT 15h/86h; the DOS bench
 *                          advances exact machine time for that service.
 * `bw_print_num(n)`      — print one signed-16 decimal through DOS character
 *                          output, followed by CR then LF.
 * `bw_print(text)`       — print a zero-terminated direct literal through the
 *                          same DOS character-output door, then CR/LF.
 * `bw_random(from, to)`  — deterministic inclusive signed-16 random with
 *                          reversed/equal/full-span bounds and unbiased
 *                          16x16 multiply-high rejection.
 *
 * Injected by compileC8086 ONLY when the compiled body references the symbol
 * (see below), so every program that calls none of these helpers is
 * byte-for-byte unchanged.
 */
const C_ROUTE_HELPERS = {
    bw_outb: [
        '_bw_outb:',            // void bw_outb(unsigned port, unsigned value)
        '    push bp',
        '    mov bp, sp',
        '    mov dx, [bp+4]',   // port  (first arg, pushed last)
        '    mov ax, [bp+6]',   // value (second arg)
        '    out dx, al',       // same idiom as pseudocode-8086.js: OUT DX, AL
        '    pop bp',
        '    ret'
    ].join('\n') + '\n',
    bw_inb: [
        '_bw_inb:',             // unsigned bw_inb(unsigned port)  -> AX
        '    push bp',
        '    mov bp, sp',
        '    mov dx, [bp+4]',   // port
        '    in al, dx',        // same idiom as pseudocode-8086.js: IN AL, DX
        '    xor ah, ah',       // zero-extend the byte to a 16-bit unsigned
        '    pop bp',
        '    ret'
    ].join('\n') + '\n',
    bw_delay_ms: [
        '_bw_delay_ms:',         // void bw_delay_ms(unsigned ms)
        '    push bp',
        '    mov bp, sp',
        '    push bx',           // cdecl: BX is callee-saved
        '    mov ax, [bp+4]',    // unsigned milliseconds (0..65535)
        '    mov bx, 03E8h',     // 1000 microseconds per millisecond
        '    mul bx',            // DX:AX = ms * 1000 (fits in 32 bits)
        '    mov cx, dx',
        '    mov dx, ax',
        '    mov ah, 86h',
        '    int 15h',           // same blocking DOS-proxy door as the ASM route
        '    pop bx',
        '    pop bp',
        '    ret'
    ].join('\n') + '\n',
    bw_print_num: [
        '_bw_print_num:',        // void bw_print_num(int n)
        '    push bp',
        '    mov bp, sp',
        '    push bx',           // cdecl: BX is callee-saved
        '    push cx',
        '    push dx',
        '    mov ax, [bp+4]',    // signed 16-bit argument
        '    or ax, ax',
        '    jns BW_CPN_MAG',
        '    mov dl, 2Dh',       // '-'
        '    mov ah, 02h',
        '    int 21h',           // same DOS character-output door as BW_PRINTN
        '    mov ax, [bp+4]',    // AH was consumed by the DOS call
        '    neg ax',            // unsigned magnitude; 8000h safely stays 8000h
        'BW_CPN_MAG:',
        '    xor cx, cx',
        '    mov bx, 10',
        'BW_CPN_DIV:',
        '    xor dx, dx',
        '    div bx',
        '    push dx',           // remainder; reverse the digit order
        '    inc cx',
        '    or ax, ax',
        '    jnz BW_CPN_DIV',
        'BW_CPN_DIGIT:',
        '    pop dx',
        '    add dl, 30h',       // '0'
        '    mov ah, 02h',
        '    int 21h',
        '    loop BW_CPN_DIGIT',
        '    mov dl, 0Dh',
        '    mov ah, 02h',
        '    int 21h',
        '    mov dl, 0Ah',
        '    mov ah, 02h',
        '    int 21h',
        '    pop dx',
        '    pop cx',
        '    pop bx',
        '    pop bp',
        '    ret'
    ].join('\n') + '\n',
    bw_print: [
        '_bw_print:',            // void bw_print(const char *text)
        '    push bp',
        '    mov bp, sp',
        '    push si',           // cdecl: SI is callee-saved
        '    push dx',
        '    mov si, [bp+4]',    // zero-terminated literal in the .COM image
        'BW_CPT_CHAR:',
        '    lodsb',
        '    or al, al',
        '    jz BW_CPT_CRLF',
        '    mov dl, al',
        '    mov ah, 02h',
        '    int 21h',
        '    jmp BW_CPT_CHAR',
        'BW_CPT_CRLF:',
        '    mov dl, 0Dh',
        '    mov ah, 02h',
        '    int 21h',
        '    mov dl, 0Ah',
        '    mov ah, 02h',
        '    int 21h',
        '    pop dx',
        '    pop si',
        '    pop bp',
        '    ret'
    ].join('\n') + '\n',
    bw_random: [
        '_bw_random:',           // int bw_random(int from, int to) -> AX
        '    push bp',
        '    mov bp, sp',
        '    push bx',           // cdecl: BX, SI and DI are callee-saved
        '    push si',
        '    push di',
        '    mov ax, [bp+4]',    // signed lower candidate
        '    mov dx, [bp+6]',    // signed upper candidate
        '    cmp ax, dx',
        '    jle BW_CR_ORDERED',
        '    xchg ax, dx',       // Scratch accepts reversed bounds
        'BW_CR_ORDERED:',
        '    mov si, ax',        // normalized signed minimum
        '    mov bx, dx',
        '    sub bx, ax',
        '    inc bx',            // inclusive unsigned span; zero means 65536
        '    jz BW_CR_FULL',
        '    mov ax, bx',
        '    neg ax',            // 2^16 - span in one 16-bit word
        '    xor dx, dx',
        '    div bx',            // DX = (2^16 - span) % span, rejection floor
        '    mov di, dx',
        'BW_CR_RETRY:',
        '    mov ax, [_bw_random_state]',
        '    mov cx, 25173',
        '    mul cx',            // low word advances the full-period 16-bit LCG
        '    add ax, 13849',
        '    mov [_bw_random_state], ax',
        '    mul bx',            // DX:AX = random16 * span
        '    cmp ax, di',         // reject the biased low interval
        '    jb BW_CR_RETRY',
        '    mov ax, dx',         // multiply-high is the unbiased offset
        '    jmp BW_CR_RESULT',
        'BW_CR_FULL:',
        '    mov ax, [_bw_random_state]',
        '    mov cx, 25173',
        '    mul cx',
        '    add ax, 13849',
        '    mov [_bw_random_state], ax',
        'BW_CR_RESULT:',
        '    add ax, si',         // map the unsigned offset onto signed minimum
        '    pop di',
        '    pop si',
        '    pop bx',
        '    pop bp',
        '    ret',
        '_bw_random_state:',
        '    dw 04D3Dh'          // fixed, reviewed seed
    ].join('\n') + '\n'
};

/**
 * C -> 8086 image, entirely in the browser: SmallerC (BSD-2, compiled to
 * WASM) emits NASM `bits 16`, and our own assembler turns that into a .COM.
 *
 * WHY 80186 AND NOT 8086. SmallerC reaches for `LEAVE` in every function
 * epilogue and for `PUSH imm` and the three-operand `IMUL` from ordinary C --
 * all 80186 instructions. Assembling as an 8086 refuses the compiler's own
 * output at the first function, which is not a fact about the learner's
 * program. The 186 is a strict superset here and every board this runs on
 * declares `variant: '80186'` when it needs to.
 *
 * @param {string} cSource
 * @param {{compileC?: Function, assembleLocal?: Function}} [seams]
 */
/**
 * SmallerC's tiny (.COM) model has NO `long`, but generateC types every Scratch
 * number as `static long`. So a program that stores a number reaches the
 * compiler and fails with a raw "Unexpected token long" from deep inside it.
 * Detect it here and refuse with a sentence a learner can act on, BEFORE the
 * compiler runs (N2b). Comments, strings and chars are stripped first so a
 * comment that merely mentions "long" does not trip it.
 *
 * TRAP the sweep must not fall into: a numeric VARIABLE emits `long`, but
 * `set x to 5` does NOT — `x`/`y` are sprite COORDINATES (motion blocks), not
 * variables, so they emit no `long`. This detector keys on the emitted `long`
 * type, not on the pseudocode, so it fires on real stored numbers only.
 */
/**
 * The emitter's whole-program refusal, if `cSource` is one: generateC returns a
 * comment-only source starting "No C emitted for DEVICE …" whose body says why.
 * Returns that body as one sentence (comment furniture stripped), else null.
 */
export const emitterRefusal = (src) => {
    const m = /^\s*\/\*\s*No C emitted for DEVICE\s+(\S+)\.\s*\n([\s\S]*?)\*\//.exec(src);
    if (!m) return null;
    const body = m[2].split('\n')
        .map(l => l.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ');
    return `the emitter produced no C for ${m[1]}: ${body}`;
};

/** generateC's host-C header: "blocks → C (host)" — a desktop program, not device C. */
export const isHostC = (src) => /^\s*\/\*[^\n]*blocks → C \(host\)/.test(src);

export const cUsesLong = (src) => /\blong\b/.test(src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, ' '));

export async function compileC8086 (cSource, seams = {}) {
    const {compileC, assembleLocal} = seams;
    const compile = compileC || (await import(
        /* webpackChunkName: "smallerc" */ '../smallerc-wasm/compiler.js')).compile;

    // generateC refuses a program it will not emit for this board with a
    // comment-only source ("No C emitted for DEVICE I8086" — a verb with no
    // i8086 branch, or a number outside the 16-bit model, N2b). Compiling that
    // yields no assembly and a message about the compiler; the emitter's own
    // sentence is the learner-actionable one, so carry it through by name.
    const refused = emitterRefusal(cSource);
    if (refused) {
        throw new AsmRouteError(refused, {route: 'local', target: 'i8086', reason: 'source'});
    }

    // A program with no hardware declarations gets HOST C from generateC (a
    // desktop program over libc: snprintf, clock_gettime, long long) whatever
    // its DEVICE line says. That is not 8086 code and never will be; say so
    // rather than let the `long` guard below blame the emitter.
    if (isHostC(cSource)) {
        throw new AsmRouteError(
            'this program declares no pins or parts, so the C tab shows HOST C (a desktop program '
            + 'over libc), which the 8086 route does not compile. Add a PIN or PART line to get '
            + 'device C for the 8086.',
            {route: 'local', target: 'i8086', reason: 'source'});
    }

    // Defence in depth for the numeric model: since N2b the emitter types 8086
    // numbers as 16-bit `int` and no `long` should reach here. If one does (a
    // helper the emitter grew without an i8086 branch), refuse by name rather
    // than let SmallerC's raw "Unexpected token long" through.
    if (cUsesLong(cSource)) {
        throw new AsmRouteError(
            'this C uses `long`, and SmallerC’s tiny (.COM) model has no 32-bit type: the 8086 '
            + 'numeric model is a 16-bit int (N2b). The emitter should not have produced this; '
            + 'the line that did is the finding.',
            {route: 'local', target: 'i8086', reason: 'source'});
    }

    const out = await compile(cSource, {target: 'i8086'});
    if (!out || typeof out.asm !== 'string' || !out.asm.trim()) {
        throw new AsmRouteError(
            'the C compiler produced no assembly. Its diagnostics are in `warnings`.',
            {route: 'local', target: 'i8086', reason: 'source',
                detail: (out && out.warnings) || []});
    }

    // The compiler's own `bits 16` is dropped because the startup carries one;
    // two would be a duplicate directive rather than a harmless repeat.
    const body = out.asm.replace(/^\s*bits\s+16\s*$/im, '');

    // Conditional machine-helper injection: if the compiled body CALLS one of
    // the helpers (it will have emitted `call _bw_outb`, `call _bw_delay_ms`,
    // `call _bw_print_num`, `call _bw_print`, `call _bw_random`,
    // etc. and an `extern` for it), define the helper in this same image and
    // strip the extern. Only referenced helpers are added, so an unrelated
    // program assembles to exactly what it did before.
    let helpers = '';
    let cleaned = body;
    for (const [sym, asmDef] of Object.entries(C_ROUTE_HELPERS)) {
        // Inject the body ONLY when the helper is actually CALLED, so a program
        // that does no port I/O is unchanged. Strip the `extern` whenever it is
        // present — a call needs it gone (the symbol is now local), and a bare
        // declaration with no call would otherwise leave a dangling external.
        if (new RegExp(`\\bcall\\s+_${sym}\\b`).test(body)) helpers += asmDef;
        cleaned = cleaned.replace(new RegExp(`^\\s*extern\\s+_${sym}\\s*$`, 'im'), '');
    }
    const asm = C_STARTUP + helpers + cleaned;

    const assemble = assembleLocal || (async (src) => {
        const mod = await import(/* webpackChunkName: "i8086-asm" */ 'bw-board/i8086-asm.js');
        // `setcc: true` IS FOR COMPILER OUTPUT ONLY, and the assembler's
        // default is off for a reason worth repeating here. SmallerC lowers a
        // comparison used as a VALUE -- `return a >= 1;`, `int b = (a > 1);`,
        // any ternary -- to SETcc, which is an 80386 instruction, so those
        // programs did not build at all while `if (a >= 1)` did. SmallerC has
        // no 8086 mode to ask for; its codegen emits SETcc unconditionally.
        //
        // The assembler synthesises it from MOV/Jcc/MOV and warns per site.
        // A learner hand-writing `setge al` in the ASM tab is still refused BY
        // NAME, because that instruction really is absent from the chip and a
        // silent substitution would hand them a program that works here and
        // fails on the lab machine. Nobody carries COMPILER output to a lab
        // machine, and the learner wrote `a >= 1`, not `setge`.
        return (mod.assemble || mod.default)(src, {variant: '80186', setcc: true});
    });
    const image = await assemble(asm);
    return {
        bytes: image.bytes || image,
        format: image.format || 'com',
        target: 'i8086', route: 'local', org: image.org ?? 0x100,
        asm,
        symbols: image.symbols,
        warnings: [...(out.warnings || []), ...(image.warnings || [])],
    };
}

/**
 * Build the C editor's buffer for a device, and return the SAME shape
 * `requestAssembly` returns, so the ▶ handler that boots an assembly program
 * boots a C one with no second code path.
 *
 * WHY THIS EXISTS RATHER THAN THE COMPONENT CALLING `compileC8086`. Rule 1 of
 * this module's header — one function decides the route — was written about
 * assembly and applies unchanged to C. `compileC8086` is the local PIPELINE;
 * it does not know what a device is and must not learn. This is where a
 * device becomes a decision, and it is the only such place for C.
 *
 * NO FALLBACK TO THE NETWORK, and that is a rule and not an omission. The
 * `sdcc-wasm/intercept.js` header states it for the 8051: "a supported request
 * never silently falls back after a local failure: that would turn
 * offline/debug failures into surprising network traffic". Here it is stronger
 * still, because there is nothing to fall back TO: the hosted service has no
 * 8086 C target, so a fallback would trade a message naming the learner's
 * construct for `unknown compile target 'i8086'`.
 *
 * A NON-LOCAL DEVICE IS REFUSED BY NAME rather than quietly posted, for the
 * same reason `requestAssembly` whitelists: the STC12's C already has a route
 * (hosted `/compile`, with `sdcc-wasm` intercepting it) and sending it here
 * would hand an 8051 program to a compiler that emits 8086.
 *
 * @param {{source: string, device: string}} req
 * @param {{compileC?: Function, assembleLocal?: Function}} [seams] passed
 *   straight to `compileC8086`; the tab injects neither.
 */
export async function requestCBuild ({source, device}, seams = {}) {
    const target = asmTargetForDevice(device);
    if (!LOCAL_C_TARGETS.has(target)) {
        throw new AsmRouteError(
            `${target} has no local C route — its C goes to the hosted compiler`,
            {route: 'hosted', target, reason: 'transport'});
    }
    if (typeof source !== 'string' || !source.trim()) {
        throw new AsmRouteError('there is no C to compile',
            {route: 'local', target, reason: 'source'});
    }
    let built;
    try {
        built = await compileC8086(source, seams);
    } catch (e) {
        // Both stages already name what they refused -- smlrc names the token
        // and the line, the assembler names the instruction or the symbol --
        // so re-wrapping the text would only bury it. What is added is the
        // route, because "the compiler in your browser refused this" and "the
        // service refused this" are different sentences.
        if (e instanceof AsmRouteError) throw e;
        throw new AsmRouteError(e.message, {route: 'local', target, reason: 'source'});
    }
    if (!built.bytes || !built.bytes.length) {
        throw new AsmRouteError('the local C route produced no image',
            {route: 'local', target, reason: 'source'});
    }
    // .COM, not ROM -- the same distinction requestAssembly draws, and for the
    // same reason: a .COM loaded as a ROM at F0000 executes nothing, and a
    // machine that executes nothing looks exactly like one that failed.
    const format = built.format === 'exe' ? 'exe' : 'com';
    return {
        bytes: built.bytes, target, route: 'local', format,
        slotId: format, profile: 'dos',
        org: built.org ?? null,
        asm: built.asm,
        warnings: (built.warnings || []).map(w => (typeof w === 'string' ?
            w : `${w.line ? `L${w.line}: ` : ''}${w.message}`)),
        listing: null
    };
}

/**
 * Compile BASIC to an 8086 `.COM` IN THE BROWSER and return an image the DOS
 * bench can boot — the BASIC counterpart of requestCBuild.
 *
 * BASIC on the 8086 is genuinely new: the BASIC tab otherwise runs a 6502 or
 * Z80 ROM interpreter (pseudocode-importer `runBasic`), which cannot target the
 * 8086 at all. bw-board's `basicToAsm` turns integer BASIC into MASM-dialect
 * asm, and the same in-browser assembler the ASM and C routes use assembles it
 * to a flat `.COM`. Both stages are loaded on demand (same chunk as the C
 * route's assembler), so no one who is not running BASIC pays for them.
 *
 * @param {{source: string, device: string}} req
 * @param {{basicToAsm?: Function, assemble?: Function}} [seams] test-only overrides
 * @returns {Promise<{bytes: Uint8Array, target: string, route: 'local',
 *   format: 'com', slotId: 'com', profile: 'dos', org: number, asm: string,
 *   warnings: string[], listing: null}>}
 */
export async function requestBasicBuild ({source, device}, seams = {}) {
    const target = asmTargetForDevice(device);
    if (!LOCAL_BASIC_TARGETS.has(target)) {
        throw new AsmRouteError(
            `${target} has no BASIC->asm route — it runs BASIC on a ROM interpreter, not the 8086`,
            {route: 'rom', target, reason: 'transport'});
    }
    if (typeof source !== 'string' || !source.trim()) {
        throw new AsmRouteError('there is no BASIC to compile',
            {route: 'local', target, reason: 'source'});
    }
    let bytes, asm;
    try {
        let basicToAsm = seams.basicToAsm;
        if (!basicToAsm) {
            const bmod = await import(/* webpackChunkName: "basic-to-asm" */ 'bw-board/basic-to-asm.js');
            basicToAsm = bmod.basicToAsm || bmod.default;
        }
        if (typeof basicToAsm !== 'function') {
            throw new AsmRouteError('the BASIC compiler loaded but exports no basicToAsm()',
                {route: 'local', target, reason: 'transport'});
        }
        asm = basicToAsm(source);
        let assemble = seams.assemble;
        if (!assemble) {
            const amod = await import(/* webpackChunkName: "i8086-asm" */ 'bw-board/i8086-asm.js');
            assemble = amod.assemble || amod.default;
        }
        if (typeof assemble !== 'function') {
            throw new AsmRouteError('the local 8086 assembler loaded but exports no assemble()',
                {route: 'local', target, reason: 'transport'});
        }
        // basicToAsm emits MASM-dialect, .COM-shaped asm; assemble it to a flat
        // 100h image, the same format the C route produces.
        bytes = assemble(asm, {format: 'com'}).bytes;
    } catch (e) {
        // basicToAsm names the BASIC line it refused; the assembler names the
        // instruction. Both are the learner's to fix, so keep the message and
        // add only the route.
        if (e instanceof AsmRouteError) throw e;
        throw new AsmRouteError(e.message, {route: 'local', target, reason: 'source'});
    }
    if (!bytes || !bytes.length) {
        throw new AsmRouteError('the local BASIC route produced no image',
            {route: 'local', target, reason: 'source'});
    }
    return {
        bytes, target, route: 'local', format: 'com',
        slotId: 'com', profile: 'dos', org: 0x100, asm, warnings: [], listing: null
    };
}

/**
 * Assemble the ASM editor's buffer for a device, by whichever route that
 * device's target demands, and return an image the machine bench can boot.
 *
 * @param {{source: string, device: string}} req
 * @param {{assembleLocal?: Function, hostedFetch?: Function}} [seams]
 *   Only the NETWORK is normally injected (the gate replaces it with a spy
 *   that throws, to prove an 8086 never reaches it). `assembleLocal`
 *   defaults to the same function the tab uses — see `assembleLocal8086`.
 * @returns {Promise<{bytes: Uint8Array, target: string, route: 'local'|'hosted',
 *   format: 'rom'|'com'|'exe', slotId: string, profile: string|null,
 *   org: number|null, warnings: string[], listing: any}>}
 */
export async function requestAssembly ({source, device, dialect = 'auto'}, seams = {}) {
    const {assembleLocal = assembleLocal8086, hostedFetch = globalThis.fetch} = seams;
    const target = asmTargetForDevice(device);
    // A dialect choice is an 8086 thing: sdas8051, ca65, sdasz80 and avr-as
    // each read one syntax. Asking a hosted target for NASM is refused by
    // name rather than silently ignored.
    if (dialect !== 'auto' && !LOCAL_ASM_TARGETS.has(target)) {
        throw new AsmRouteError(`the ${dialect.toUpperCase()} dialect applies to the 8086 only; ${target} has one syntax`,
            {route: 'hosted', target, reason: 'source'});
    }

    if (target === 'riscv32') {
        // A loadable RV32IM image, not a byte blob: the bench boots {entry,
        // segments} through createDebugTarget('riscv32', {image}). Carried on
        // `image` (not `bytes`), with slotId/profile 'riscv' so the importer and
        // debug-runner route it to the RISC-V bench rather than a ROM slot.
        let out;
        try {
            out = await assembleLocalRiscv(source);
        } catch (e) {
            throw new AsmRouteError(e.message, {route: 'local', target, reason: 'source'});
        }
        if (!out || !out.image || !out.image.segments || !out.image.segments.length) {
            throw new AsmRouteError('the local RISC-V assembler produced no image',
                {route: 'local', target, reason: 'source'});
        }
        return {
            target, route: 'local', format: 'riscv',
            image: out.image, entry: out.entry,
            slotId: 'riscv', profile: 'riscv',
            bytes: null, org: null, dialect: null, warnings: [], listing: null
        };
    }

    if (LOCAL_ASM_TARGETS.has(target)) {
        let out;
        try {
            out = await assembleLocal(source, {target, dialect});
        } catch (e) {
            // AsmError already names the line and the construct; re-wrapping
            // it would only bury that. `reason: 'source'` tells the tab this
            // is the user's program, not a broken toolchain.
            throw new AsmRouteError(e.message, {route: 'local', target, reason: 'source'});
        }
        if (!out || !out.bytes || !out.bytes.length) {
            throw new AsmRouteError(
                'the local 8086 assembler produced no image',
                {route: 'local', target, reason: 'source'});
        }
        // .COM and .EXE are DOS executables, not ROM images, and the bench
        // must be told so — a .COM loaded as a ROM at F0000 executes nothing
        // and a machine that executes nothing looks exactly like one that
        // failed to start. slotId/profile carry that to debug-runner.js.
        const format = out.format === 'exe' ? 'exe' : 'com';
        return {
            bytes: out.bytes, target, route: 'local', format,
            slotId: format, profile: 'dos',
            org: out.org ?? null,
            // The dialect the assembler actually used — under 'auto' that is
            // what it detected, and the tab shows it so a learner learns which
            // syntax they wrote.
            dialect: out.dialect || null,
            // Every give the assembler made (an expanded 80186 shift, a
            // synthesised segment override) is recorded rather than silent,
            // so the tab can show it.
            warnings: (out.warnings || []).map(w => (w.line ? `L${w.line}: ` : '') + w.message),
            listing: null
        };
    }

    let res;
    try {
        res = await hostedFetch(HOSTED_ASSEMBLER, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({asm: source, target})
        });
    } catch (e) {
        throw new AsmRouteError(e.message, {route: 'hosted', target, reason: 'transport'});
    }
    if (!res.ok) {
        throw new AsmRouteError(`Assembler HTTP ${res.status}`,
            {route: 'hosted', target, reason: 'transport'});
    }
    const result = await res.json();
    if (!result.success) {
        const msgs = (result.errors || []).map(e => (e.line ? `L${e.line}: ` : '') + e.message);
        throw new AsmRouteError(msgs.join('; ') || result.error || 'assembly failed',
            {route: 'hosted', target, reason: 'source'});
    }
    if (!result.base64) {
        throw new AsmRouteError('Assembler returned no image',
            {route: 'hosted', target, reason: 'transport'});
    }
    return {
        bytes: Uint8Array.from(atob(result.base64), c => c.charCodeAt(0)),
        target, route: 'hosted', format: 'rom', slotId: 'rom', profile: null,
        org: null, dialect: null, warnings: [], listing: result.listing || null
    };
}

export default requestAssembly;
