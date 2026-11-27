/**
 * The 8086 DOS bench: where an assembled .COM or .EXE actually runs.
 *
 * WHY THIS EXISTS AT ALL. `createDebugTarget('i8086')` builds HARDWARE — a
 * drawn board or the XT BIOS ROM, real 8259/8254/8255, interrupts through a
 * real vector table. `debug-runner.js` refused a .COM by name on that path
 * and was right to: a .COM loaded as a ROM at F0000 executes nothing, and a
 * machine that executes nothing looks on screen exactly like one that failed
 * to start. The refusal named the missing half — "the DOS service layer,
 * which is a different machine and is not wired to this tab yet". This is
 * that half.
 *
 * IT IS A DIFFERENT MACHINE, NOT A FLAG ON THE OLD ONE. No chips, no BIOS
 * ROM, 768K of RAM, and INT 21h answered behind a trap page at D000 (see
 * `i8086-dos.js` for why D000 and not F000). Keeping it a separate
 * constructor is what stops the trap page from ever being mapped on top of
 * a BIOS that is trying to boot.
 *
 * THE ONE PIECE OF GLUE. `createI8086DebugTarget` owns the stepping loop, but
 * accepts an explicit adapter step for a service layer that has work to do at
 * an instruction boundary. The DOS layer supplies one that looks at CS:IP
 * and services a trap BEFORE the hardware machine steps. `dos.service()` is
 * idempotent (every vector points at a `jmp $` that cannot move IP, which is
 * that module's central trick), so servicing there is safe no matter how the
 * caller schedules it. The target still receives the real machine directly;
 * its hot time and state reads therefore stay ordinary property accesses.
 *
 * AND WHY THE TERMINATED PROGRAM IS HALTED RATHER THAN LEFT SPINNING. When
 * INT 21h/4Ch has run, CS:IP sits on the trap page's `jmp $`. Returning zero
 * cycles forever would hang the caller's execution-deadline loop with a
 * browser tab that never returns; letting it execute the jump
 * forever would burn every frame and look exactly like a program still
 * working. Halting the CPU does neither: `_wakeHorizon()` guarantees time
 * still advances, nothing executes, and `onExit` fires once so the panel can
 * say the program finished and with what code.
 *
 * NOT DONE, and named rather than left as a surprise:
 *   - Keyboard: `keys` seeds the queue INT 16h and INT 21h drink from, and
 *     `sendKeys()` pushes onto it while the machine is RUNNING, so a program
 *     blocked on AH=01h wakes on the next service call. It is ASCII rather
 *     than scancodes because this config has no PIC and therefore no IRQ1.
 *     WAS: the tab passed nothing, so a program that waited for a keystroke
 *     dead. That is why no shipped example asks for one.
 *   - No pins and no board. A DOS program has no hardware to wire, so the
 *     designer's board is not attached and the PINS panel stays empty. The
 *     drawn-board bench is the other branch, and it is unchanged.
 *
 * @module
 */

/**
 * Boot an assembled DOS program on a fresh machine.
 *
 * @param {{bytes: Uint8Array, format: 'com'|'exe', keys?: number[],
 *          onChar?: (ch: string) => void, onExit?: (code: number) => void}} opts
 * @returns {Promise<{machine: object, dos: object, target: object,
 *                    screenText: () => string[], report: () => object}>}
 */
import {withI8086MemoryPreference} from '../bw-i8086-preferences.js';
import {i8086Execution} from '../bw-i8086-execution.js';

export async function createI8086DosBench (opts) {
    return i8086Execution.construct({context: 'dos', family: opts.variant || '8086', signal: opts.executionSignal},
        () => createI8086DosBenchSelected(opts));
}

async function createI8086DosBenchSelected (opts) {
    const {bytes, format, keys, onChar, onExit, variant, chips, files, onPortAccess} = opts;
    if (!bytes || !bytes.length) throw new Error('the DOS bench was handed an empty image');

    // The DOS disk: a Map<name, Uint8Array> that INT 21h create/open/read/write
    // use (i8086-dos.js). Mounting input files here — and reading back the files
    // a program WROTE — is what lets a DOS compiler toolchain run in the browser:
    // inject SOURCE.PAS, run the compiler .EXE, read the OUTPUT.COM it produced.
    // A caller that passes no Map gets a fresh one, still exposed on the return.
    const diskFiles = (files instanceof Map) ? files : new Map();

    const [{I8086Machine}, dosMod, dbgMod] = await Promise.all([
        import(/* webpackChunkName: "bw-debug-i8086" */ 'bw-board/i8086-machine.js'),
        import(/* webpackChunkName: "bw-debug-i8086" */ 'bw-board/i8086-dos.js'),
        import(/* webpackChunkName: "bw-debug-i8086" */ 'bw-board/i8086-debug.js')
    ]);
    const {createDos8086, DOSBOX8086_XT} = dosMod;
    const {createI8086DebugTarget} = dbgMod;

    // The XT variant, not the bare one: it adds an 8255, an 8254 and the PC
    // speaker and nothing else. Twenty-four programs in the corpus poke port
    // 61h expecting a real PC; on the bare config those writes land nowhere
    // and the beep is silently absent. There is deliberately no PIC, so
    // enabling interrupts cannot start delivering INT 8.
    // WHICH CHIP, and it defaults to the 8086 rather than the superset.
    //
    // A C program NEEDS the 186: SmallerC puts LEAVE in every function
    // epilogue and reaches for PUSH imm and the three-operand IMUL from
    // ordinary C. On an 8086 those are undefined opcodes -- the program runs,
    // does something else, and returns a wrong answer rather than failing.
    // That is exactly how this was found: a C program that computes 140
    // terminated cleanly and exited 0.
    //
    // It is NOT the default, because the 186 is not a pure superset in one
    // place that matters: it MASKS shift counts to five bits. `shl ax, cl`
    // with CL=33 shifts 33 times on an 8086 and once on a 186. Corpus
    // programs are 8086 programs, and silently running them on a different
    // chip is the kind of change that alters a result without altering a
    // test.
    // CHIPS A PROGRAM'S DECLARATIONS ADD. `PIN pot = P1.3 ANALOG` needs a
    // converter, and requiring the learner to list one before reading a
    // voltage would be the tool failing them -- the 8255 already appears the
    // same way. What must NOT happen is appearing invisibly: the build warns
    // by name and port for every chip it adds, so it is a fact to check
    // rather than a coincidence to infer when the ports do not match a board.
    const base = variant ? {...DOSBOX8086_XT, variant} : DOSBOX8086_XT;
    // MERGE BY NAME, NOT BY APPENDING. A scheduled program asks for a `pit1`
    // wired to IRQ0, and the preset already has a `pit1` without one -- two
    // chips of the same name at the same port is not a board, it is a bug.
    // A requested chip REPLACES the preset's entry of that name.
    let cfg = base;
    if (chips && chips.length) {
        // A LOOPBACK LINK CANNOT TRAVEL THROUGH A CustomEvent -- it is a live
        // object and the detail is plain data. So a requested NE2000 says
        // `loopback: true` and the link is constructed HERE, at the only
        // place that has the chip module in scope.
        // ONE SHARED HUB for every card that asked for one, built here because
        // a link is a live object and an event detail is plain data. The hub
        // is a REPEATER: every card hears every frame except its own, and the
        // MAC filter decides what is theirs. A switch would do that filtering
        // in the wire and hide the lesson.
        let hub = null;
        for (const c of chips) {
            if (c.kind !== 'ne2000' || c.link) continue;
            if (c.loopback) {
                c.link = {send: (frame, from) => from.deliver(frame)};
            } else if (c.hub) {
                if (!hub) hub = {cards: [], send(frame, from) {
                    for (const card of this.cards) if (card !== from) card.deliver(frame);
                }};
                c.link = hub;
                c._joinHub = hub;
            }
        }
        const merged = base.chips.filter(
            (c) => !chips.some((x) => x.name === c.name));
        cfg = {...base, chips: [...merged, ...chips]};
    }
    const machine = new I8086Machine(withI8086MemoryPreference(cfg));
    // Observe every port OUT/IN (i8086-machine.js fires this.hooks.onPortAccess
    // with {dir, port, value}). A DOS Forth `pin!` does an OUT to 0x378+pin, so
    // the Code-tab run path taps this to drive an 8-pin GPIO strip widget. The
    // bench normally leaves hooks empty, so existing callers are unaffected.
    if (typeof onPortAccess === 'function') {
        machine.hooks = machine.hooks || {};
        machine.hooks.onPortAccess = onPortAccess;
    }
    // The hub holds CHIPS, and they do not exist until the machine is built.
    for (const c of (chips || [])) {
        if (c._joinHub && machine.chips[c.name]) c._joinHub.cards.push(machine.chips[c.name]);
    }
    const dos = createDos8086(machine, {
        files: diskFiles,
        onChar: onChar || null,
        keys: keys || [],
        // format 'disk' boots a REAL MS-DOS 2.0 kernel from a FAT12 image (the
        // 360K MIT boot disk with a code-tab program injected) rather than
        // loading a .COM onto the service layer: the boot sector loads IO.SYS ->
        // MSDOS.SYS -> COMMAND.COM and the program's INT 21h is served by the
        // real kernel. 9 sectors/track, 2 heads is the released 360K geometry.
        ...(format === 'disk' ? {disk: bytes, geometry: {sectors: 9, heads: 2}} : {}),
        // A PERSON is at this keyboard. Without blocking, a program that asks
        // for a key is handed NUL immediately and runs on -- so the user types
        // into a program that already decided nobody was there. The corpus
        // harness wants the opposite default (525 unattended programs, where a
        // blocking read is a hang), which is why this is an option and not a
        // change of behaviour.
        blockOnKey: true
    }).install();

    if (format === 'disk') dos.loadBoot(bytes.subarray(0, 512), 0);
    else if (format === 'exe') dos.loadExe(bytes, {args: opts.args});
    else dos.loadCom(bytes, {args: opts.args});

    let exitAnnounced = false;
    const realStep = machine.step.bind(machine);
    const dosStep = () => {
        if (dos.terminated) {
            // See the header: halt, do not spin and do not stall.
            machine.cpu.halted = true;
            return realStep();
        }
        // Idempotent by construction; safe before OR after an instruction.
        const cycles = dos.step();
        if (dos.terminated && !exitAnnounced) {
            exitAnnounced = true;
            if (onExit) onExit(dos.exitCode);
        }
        return cycles;
    };

    const target = createI8086DebugTarget({machine, step: dosStep}, {
        // Which video mode the program BELIEVES it is in. Without this the
        // renderer assumes the power-on text mode, which is right for these
        // programs and wrong for any that sets a mode — and being wrong here
        // draws a plausible picture of the wrong memory.
        videoModeLog: () => dos.videoModeLog()
    });

    return {
        machine, dos, target,
        format,
        // The DOS disk (Map<name, Uint8Array>): a caller reads back the files the
        // program wrote (a compiler's output .COM), and mounts inputs by passing
        // this same Map shape in `opts.files`.
        files: diskFiles,
        /**
         * THE SERVICED STEP, and it is exposed because its absence was a trap.
         * `machine` above is the RAW machine: stepping it runs instructions
         * without ever servicing DOS, so an INT 21h lands on the trap page's
         * `jmp $` and the program spins forever having printed nothing. That
         * looks exactly like a hung emulator, and it is simply the wrong step
         * function -- the serviced one is injected into the target adapter
         * and otherwise reachable only here.
         *
         * Found by writing a probe against this bench and watching a
         * print-one-character program produce no output.
         */
        step: dosStep,
        /**
         * TYPE INTO THE PROGRAM. `dos.type()` pushes ASCII onto the queue INT
         * 16h and INT 21h drink from, and it works on a LIVE machine, so a
         * program already blocked in AH=01h wakes on the next service call.
         *
         * ASCII, NOT SCANCODES, and the difference is the machine rather than
         * a preference. This bench runs DOSBOX8086_XT, which deliberately has
         * NO PIC -- so there is no IRQ1 to raise and the hardware keyboard
         * path cannot exist here. A board with a PIC takes set-1 scancodes
         * through machine.keyIn(); this one takes characters through the
         * service layer, because that IS its keyboard. Offering the scancode
         * path on a machine that cannot deliver an interrupt would be a widget
         * that silently does nothing.
         */
        sendKeys: (text) => dos.type(text),
        screenText: () => dos.screenText(),
        report: () => dos.report(),
        get terminated () { return dos.terminated; },
        get exitCode () { return dos.exitCode; }
    };
}

export default createI8086DosBench;
