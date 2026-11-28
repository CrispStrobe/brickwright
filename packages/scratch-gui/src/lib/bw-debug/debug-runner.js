/**
 * The debug runner — everything between "a project" and "a glowing block".
 *
 * Design: `sb3-creator/reference/debugger-ui.md`. This is the host side of it:
 * bw-board owns the target and the session (both framework-free and tested in
 * Node), and this file owns the four things only a browser can do — route the
 * compiler, instantiate the WASM, drive a frame loop, and light
 * up a block in the editor.
 *
 *     project  --generateC({debug:true})-->  C + @bw yield map
 *              --local/hosted compile------> .hex + symbol table
 *              --emu8051 + bw-board------->  a running, breakable program
 *              --why.tasks + yields[].block->  vm.runtime.glowBlock
 *
 * ## Why the symbol table has to come from the linker
 *
 * The yield map alone is not enough: it says WHICH BLOCK each `(task, state)`
 * is, but not where `<task>_state` lives in RAM or what code address a yield
 * sits at. Only the linker knows that. Supported 8051 devices run SDCC and the
 * CDB parser locally in four WASM stages; other families use the hosted
 * compiler. Either route returns image and symbols together, joined here by
 * `(task, state)`, the one key that survives the whole chain.
 *
 * ## Debug builds are not release builds, twice over
 *
 * `generateC({debug: true})` forces the cooperative scheduler even for a single
 * script (straight-line code in `main()` has no position to report), and
 * `--debug` makes SDCC stop tail-merging returns so line records map cleanly —
 * measured at 8 of 39 hex records different on a two-task program. The program
 * behaves the same; it is not the same bytes. So the image and the symbol table
 * must always come from the SAME request, and a debug image is never the thing
 * to flash.
 *
 * @module
 */

import {createBasicStartup, isBundledMicrosoftBasic, microsoftBasicLine} from './basic-startup.js';
import {loadCp1Monitor} from '../cp1-monitor.js';
import {
    listBreakpoints, subscribeBreakpoints, toggleBreakpoint,
    setCondition, conditionOf, allConditions
} from './breakpoints.js';
import { parseCondition } from './condition.js';
import {createLinuxConsole, TERMINAL_COLS, TERMINAL_ROWS} from './linux-console.js';
import {capturePublishedFramebuffer, createGrayFramebufferVideo, grayFramebufferSpec} from '../bw-machines/gray-framebuffer.js';
import {createReadyGatedInput} from './ready-gated-input.js';
import {createTerminalOutput} from './terminal-output.js';
import {picoBasicAtPrompt, picoBasicConsoleSpec} from '../bw-machines/pico-basic-source.js';
import {mountPicoFlashStorage} from '../bw-machines/pico-basic-flash.js';
import {createEngineeringInputRoute} from './engineering-input-route.js';
import {cpmFileName} from './cpm-z80.js';
import { canRecordDebugInput } from 'bw-board/debug-replay-contract.js';
import { createTrace, IO_SFRS, TIMER_SFRS } from './trace.js';
import {createDebugFoundation, subscribeDebugTargetEvents} from './debug-foundation.js';
import {createRecordingSession, subscribeDebugTargetInputs} from './recording-session.js';
import {withI8086MemoryPreference} from '../bw-i8086-preferences.js';
import {i8086Execution} from '../bw-i8086-execution.js';
import {createInstructionReplayController} from './instruction-replay.js';
import {createCycleReplayController} from './cycle-replay.js';
import {createHistoricalOutputGate} from './timed-replay-io.js';
import {createReverseContinueCoordinator} from './reverse-continue.js';
import {createEventBreakpointDispatcher} from './event-breakpoint-dispatcher.js';
import {createSelectedEventSeekCoordinator} from './selected-event-seek.js';
import {createDebugRecorder} from './recorder.js';
// The run board is resolved the same way for the debugger and the MicroPython
// simulator Run — one copy of the phantom-inferred-bench rejection.
import {resolveNetlist} from './resolve-netlist.js';
import {logicalTimeDomain} from 'bw-board/instruction-debug-events.js';
import {createHaltOccurrenceLedger} from './halt-occurrence-ledger.js';
import {createForkRecordingStore} from './fork-recording-store.js';
import {createBranchCursor} from './fork-history.js';
import {createHistoryAnnotationStore} from './history-annotations.js';
import {chipRefusalLines} from './chip-refusal-lines.js';
import {createRunToCoordinator} from './run-to.js';
import {createSelectedEventInspectionStore} from './selected-event-inspection.js';
import {createTimingWaveform} from './timing-waveform.js';
import {createDebuggerSessionBundle, importDebuggerSessionBundle} from './session-bundle.js';
import {DEBUG_SESSION_SNAPSHOT_CODEC, structuredSessionSnapshotCodec} from './session-snapshot-codec.js';
import {createDivergenceBisection} from './divergence-bisection.js';
import {createCorrelatedDebugger} from './correlated-debug.js';
import {negotiateCycleProvider} from './cycle-provider.js';
import { setValueResolver } from './hover-values.js';
import { instructionLength } from './opcodes.js';
import {
    LOCAL_8051_TARGETS, compileTargetFor, compileFormatFor,
    shippedImageFor, provenanceSentence
} from './shipped-images.js';
import { t as statusT } from './runner-status-l10n.js';
import {createCp1LessonBatch} from '../cp1-lesson-observation.js';

/**
 * The document language, for everything this module says in words.
 *
 * Module scope, not the createDebugRunner closure it used to live in: the very
 * first status string (the 8051 compiler loader) is written from a function
 * ABOVE that closure, so a locale reachable only from inside it would have left
 * that one English forever.
 */
function uiLang () {
    try {
        const html = typeof document !== 'undefined' && document.documentElement;
        const lang = (html && html.lang) ||
            (typeof navigator !== 'undefined' && navigator.language) || 'en';
        return /^de/i.test(lang) ? 'de' : 'en';
    } catch { return 'en'; }
}

/** Status text in the reader's language. `S('boot.media', {name})`. */
const S = (key, vars) => statusT(uiLang(), key, vars);
import { localCompilerRequest, localToolchainEnabled } from '../sdcc-wasm/toolchain-source.js';
import {i80386FloppyCmos, withI80386MouseCmos} from '../bw-machines/i80386-cmos.js';

/**
 * How many suppressed breakpoint hits one frame will absorb before yielding to
 * the browser. A yield breakpoint on a `wait` re-fires every pass of the
 * dispatch loop, so this is routinely in the thousands.
 */
const SKIP_BUDGET = 20000;

/**
 * Live debugger data is human-facing, not a video signal. Four snapshots per
 * second keep counters, serial output and board state visibly live while
 * avoiding a full snapshot allocation on every animation frame.
 */
export const DEBUG_LIVE_SNAPSHOT_MS = 250;

/**
 * Pair a captured checkpoint with host state for the reverse-execution paths,
 * BUT propagate a returned refusal unwrapped. The bisection and cycle-replay
 * guards call rejected() on this value, and a refusal hidden inside `{target}`
 * is falsy there -- so a refused capture would slip past the guard, caught only
 * if the target THREW. This keeps those paths uniformly return-convention
 * rather than relying on a throw to abort a failed capture. `captureHost` is a
 * thunk so host state is not captured when the checkpoint refused. Exported so
 * the guarantee is testable without standing up a whole runner.
 */
export const wrapSourceState = (checkpoint, captureHost) =>
    (checkpoint == null || checkpoint === false ||
        checkpoint.accepted === false || checkpoint.refused)
        ? checkpoint
        : {target: checkpoint, host: captureHost()};

/**
 * Read a short code listing without inventing an address space in the host.
 *
 * The target owns both initial address normalization and instruction advance:
 * 8051/6502/Z80 wrap at 16 bits, while i8086 advances IP inside its current
 * segment and retains a 20-bit physical address. Missing or malformed
 * capability answers fail the whole listing closed; a partial list would still
 * expose clickable rows whose address semantics the target did not validate.
 */
export function codeListingRows (target, addr, count = 16) {
    if (!target || typeof target.disasm !== 'function' ||
        typeof target.nextCodeAddress !== 'function' ||
        !Number.isSafeInteger(count) || count < 1) return [];

    const advanced = (from, length, initial = false) => {
        const next = target.nextCodeAddress(from, length);
        if (!Number.isSafeInteger(next) || next < 0 || (!initial && next === from)) return null;
        return next;
    };

    try {
        let current = advanced(addr, 0, true);
        if (current === null) return [];
        const rows = [];
        for (let i = 0; i < count; i++) {
            const decoded = target.disasm(current);
            let bytes;
            let text;
            let length;
            if (decoded && typeof decoded === 'object') {
                if (!Array.isArray(decoded.bytes) || !Number.isSafeInteger(decoded.length) ||
                    decoded.length < 1) return [];
                bytes = decoded.bytes.slice();
                text = String(decoded.text ?? '');
                length = decoded.length;
            } else {
                if (typeof target.readMem !== 'function') return [];
                const head = target.readMem('code', current, 1);
                if (!head || typeof head[Symbol.iterator] !== 'function' || head.length < 1) return [];
                // The TARGET's length when it knows its architecture (Thumb 2/4,
                // RISC-V, Xtensa 2/3...); the table is 8-bit-opcode lore.
                length = typeof target.instructionLength === 'function'
                    ? target.instructionLength(current) : instructionLength(head[0]);
                if (!Number.isSafeInteger(length) || length < 1) return [];
                const read = target.readMem('code', current, length);
                if (!read || typeof read[Symbol.iterator] !== 'function') return [];
                bytes = [...read];
                text = String(decoded ?? '');
            }
            const next = advanced(current, length);
            if (next === null) return [];
            rows.push({addr: current, bytes, text});
            current = next;
        }
        return rows;
    } catch {
        return [];
    }
}

/**
 * Admit interior event breakpoints only when the producer names the safe
 * boundary that follows them. Event kinds alone do not prove a halt point.
 */
export function dispatchEventBreakpointAtBoundary ({capabilities, dispatcher, event, options}) {
    if (!dispatcher || capabilities?.extensions?.eventBreakpointBoundary !== 'instruction-retire') {
        return null;
    }
    return dispatcher.dispatch(event, options);
}

/** A replay halt ledger is truthful only for a target that both names the
 * replay-addressable retire boundary and can checkpoint/restore that history. */
export function canRecordEventBreakpointHalt (capabilities) {
    return capabilities?.extensions?.eventBreakpointBoundary === 'instruction-retire' &&
        Array.isArray(capabilities.recording) &&
        capabilities.recording.includes('checkpoint') && capabilities.recording.includes('restore');
}

export function eventBreakpointHaltOccurrence ({capabilities, result, boundaryCursor, generation}) {
    if (!canRecordEventBreakpointHalt(capabilities) || !result?.outcome?.halted) return null;
    return {
        boundaryCursor,
        triggerEventSeq: result.triggerEventSeqs?.[0] ?? null,
        matchingIds: result.outcome.matchingIds,
        generation,
        stopSide: 'after',
        source: 'breakpoint-engine'
    };
}

/**
 * Put the rate limit BEFORE snapshot construction.
 *
 * The circuit tab already declines most 60 Hz React updates, but doing that
 * after `snapshot()` still pays for session state, breakpoint lists,
 * Object.fromEntries and copied arrays. `live()` checks the clock first and
 * never calls `snapshot` for a suppressed frame. `immediate()` is deliberately
 * unthrottled for pauses, breakpoint hits, errors and user commands.
 *
 * Exported as a small dependency-free seam for the regression test and the
 * benchmark; normal callers use the instance inside createDebugRunner.
 */
export function createDebugSnapshotEmitter({
    snapshot,
    onChange,
    now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    measureNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    minIntervalMs = DEBUG_LIVE_SNAPSHOT_MS
}) {
    let lastAt = -Infinity;
    const counters = {attempted: 0, emitted: 0, suppressed: 0, snapshotBuildMs: 0};

    function publish(at) {
        const started = measureNow();
        const value = snapshot();
        counters.snapshotBuildMs += Math.max(0, measureNow() - started);
        counters.emitted++;
        lastAt = at;
        onChange(value);
        return value;
    }

    return {
        /** State transition, error, halt, or explicit user action. */
        immediate() {
            counters.attempted++;
            return publish(now());
        },
        /** Progress-only animation-frame refresh. */
        live() {
            counters.attempted++;
            const at = now();
            if (at >= lastAt && at - lastAt < minIntervalMs) {
                counters.suppressed++;
                return undefined;
            }
            return publish(at);
        },
        /** Benchmark/diagnostic hook; a copy so observers cannot corrupt it. */
        stats: () => ({...counters, minIntervalMs})
    };
}

/**
 * Atomic recorder-before-application gate for replayable external inputs.
 *
 * THE MANUAL APPEND IS A WORKAROUND FOR A TARGET THAT CANNOT RECORD, and it is
 * skipped for one that can. Three of the four targets here publish their own
 * host-input facts through `onDebugInput`, which the recorder subscribes to;
 * the 8086 did not, which is why this gate exists and why its only caller was
 * gated on `targetKind === 'i8086'`. Now that the 8086 records too, appending
 * here as well would put EVERY input in the log twice -- once from this gate
 * and once from the target -- and a replay of that log would apply each input
 * twice.
 *
 * The condition is `canRecordDebugInput`, not the target's name: a target that
 * loses or gains the record half changes which path logs it, and nothing has to
 * remember to update a list. It is deliberately not a silent fallback -- if
 * neither path logs, that is visible as an empty log rather than as a shim
 * quietly covering for it.
 */
export function applyRecordedTargetInput ({target, recordingSession, producer, payload, apply}) {
    const input = {producer, payload};
    if (typeof target?.canApplyReplayInput === 'function' && !target.canApplyReplayInput(input)) return false;
    if (!recordingSession.status().active) return apply();
    if (canRecordDebugInput(target)) return apply();
    let logged;
    try {
        logged = recordingSession.appendInput({...input, time: target.debugTime()});
    } catch (error) {
        return false;
    }
    if (!logged.accepted) return false;
    return apply();
}

/**
 * Install target-aware compilation routing before the debugger builds.
 *
 * It lives here rather than in the circuit tab because the intercept patches
 * `globalThis.fetch` and only matters at the moment something compiles. Wired
 * to tab visibility, pressing Run without first visiting Circuit would skip
 * local routing and behave differently based on navigation history.
 *
 * The chunk remains lazy: users who never build firmware do not download it.
 * Once loaded, the router handles supported 8051 targets locally and leaves
 * AVR, RP2040, STM32 and retro targets on the hosted service.
 *
 * @param {(phase: string, detail: string) => void} setStatus
 */
/* ── compile cache ─────────────────────────────────────────────────────
 * A tiny localStorage LRU of successful compile responses, keyed by the
 * FULL (code, target, format) tuple — exact string match, so a stale or
 * colliding image is impossible; only the service itself changing output
 * for identical input could go stale, which the version suffix below
 * exists to flush. Failures are never cached (they may be transient).
 * Size discipline: few entries, and a quota error evicts before retry —
 * a cache must never be the reason a Run fails. */
const COMPILE_CACHE_KEY = 'bw-compile-cache-v1';
const COMPILE_CACHE_MAX = 6;
// Exported for the unit test only — nothing else imports these.
export function compileCacheLoad () {
    try {
        const raw = localStorage.getItem(COMPILE_CACHE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch { return []; }
}
export function compileCacheGet (key) {
    const list = compileCacheLoad();
    const i = list.findIndex(e => e && e.key === key);
    if (i < 0) return null;
    // refresh recency
    const [entry] = list.splice(i, 1);
    list.unshift(entry);
    try { localStorage.setItem(COMPILE_CACHE_KEY, JSON.stringify(list)); } catch { /* recency is optional */ }
    return entry.out;
}
export function compileCachePut (key, out) {
    try {
        let list = compileCacheLoad().filter(e => e && e.key !== key);
        list.unshift({ key, out, at: Date.now() });
        list = list.slice(0, COMPILE_CACHE_MAX);
        for (;;) {
            try {
                localStorage.setItem(COMPILE_CACHE_KEY, JSON.stringify(list));
                return;
            } catch (e) {
                if (list.length === 0) return; // quota gone entirely: give up quietly
                list.pop(); // evict the oldest and retry
            }
        }
    } catch { /* private browsing: no cache, no harm */ }
}

/**
 * Has the user explicitly asked NOT to use the in-page 8051 compiler?
 *
 * SUPERSEDED AS A ROUTING DECISION, 2026-09-07. Kept because an explicit `off`
 * is still a request that must win, but the routing now asks
 * `localToolchainEnabled` (sdcc-wasm/toolchain-source.js), which folds this in.
 * Two predicates with opposite defaults produced a SILENT FALLBACK: this one
 * said "not opted out", so the routing installed the intercept and announced
 * nothing; the intercept then declined the request because the toolchain was off
 * by the other setting, and the compile reached the network in silence — the one
 * thing this mechanism exists to prevent.
 *
 * The escape hatch D-SMOKE1(3) named and did not build. `LOCAL_TARGETS` in
 * `sdcc-wasm/compiler.js` is a frozen allowlist of five STC parts which until 2026-09-07 had no flag,
 * so for exactly those five a broken or half-cached toolchain could not be
 * bypassed AT ALL: the local compile fails, and `intercept.js`'s header
 * forbids falling back on its own — rightly, because a local failure quietly
 * becoming a network round trip is the thing an offline learner must never
 * get. That left a stuck user with nothing to try.
 *
 * This does not reverse that decision, because it is not silent: the fallback
 * only happens when the user ASKS for it, and the status line says so. Of the
 * two shapes the defect record allows — a loud automatic fallback, or an
 * explicit opt-out — this is the second, chosen because it leaves the default
 * behaviour and the header's promise exactly as they were.
 *
 *   ?localCompiler=off          on the URL, for a user who is stuck right now
 *   localStorage.bwLocalCompiler = 'off'   to make it persist
 *
 * Takes the window rather than reaching for it, so the rule is testable
 * without a browser — the D-EMU-BP2 lesson about predicates that can only be
 * reached through a live session.
 */
export function localCompilerOptedOut (win = typeof window === 'undefined' ? undefined : window) {
    if (!win) return false;
    try {
        const asked = localCompilerRequest(win);
        if (asked !== null) return /^(off|0|false|no)$/i.test(asked);
        return Boolean(win.localStorage) &&
            win.localStorage.getItem('bwLocalCompiler') === 'off';
    } catch {
        // No location, no storage, private browsing: keep the default, which is
        // the in-page compiler. An unreadable preference is not a request.
        return false;
    }
}

let wasmCompilerInstalled = false;
async function installWasmCompilerRouting (setStatus) {
    if (wasmCompilerInstalled) return;
    try {
        const m = await import(
            /* webpackChunkName: "sdcc-wasm" */ '../sdcc-wasm/intercept.js');
        m.installWasmCompilerIntercept();
        wasmCompilerInstalled = true;
    } catch (e) {
        // A missing chunk here is usually a stale build, which the page can fix.
        const recovering = typeof window !== 'undefined' &&
            window.__bwRecoverFromStaleBuild &&
            window.__bwRecoverFromStaleBuild(e && e.message);
        if (!recovering) {
            setStatus('building', S('compile.no8051'));
            console.warn('[brickwright] local 8051 compiler failed to load:', e);
        }
        throw new Error(`local 8051 compiler unavailable: ${e && e.message ? e.message : e}`);
    }
}

/**
 * @param {object} opts
 * @param {object} opts.vm the scratch-vm instance (for toJSON and glowBlock)
 * @param {string} [opts.compilerUrl] the stc-compiler service
 * @param {(state: object) => void} [opts.onChange] UI state changed
 */
/**
 * Choose a faithful execution backend when the user has not explicitly
 * requested a different transport. Arduino boards are ATmega328P targets;
 * routing them through the STC emulator would make every result plausible
 * but wrong. Pico routes to the rp2040js target (the code below has
 * done so since the hosted compile chain closed) — an earlier version
 * of this comment claimed Pico was unavailable long after it wasn't,
 * and the stale claim was believed over the code (2026-08-17).
 *
 * @param {string} device project device identifier
 * @param {string} requested target picker selection
 * @returns {string}
 */
/**
 * Board time minus target time when a run (re)starts: the offset that keeps a
 * board's clock moving forward from where it is while the target's restarts at
 * zero. Never negative — a board behind its target simply catches up.
 */
export function boardTimeBase (board, target) {
    if (!board || !target || typeof target.timeNs !== 'function') return 0n;
    const boardNs = typeof board.timeNs === 'bigint' ? board.timeNs : 0n;
    const targetNs = target.timeNs();
    const base = boardNs - (typeof targetNs === 'bigint' ? targetNs : BigInt(Math.round(Number(targetNs) || 0)));
    return base > 0n ? base : 0n;
}

/**
 * Does this runner compile and run the project's OWN blocks? The same split
 * start() makes when it picks `built` (null for an interpreter or boot-media
 * machine, the user's firmware, else build()): kept beside it, and compared
 * against it by test/b8-one-board-per-run.test.mjs.
 *
 * When it does, the Scratch VM is already running that very program on the
 * designer's board, so the green flag must not start a second copy here
 * (task B8: one board per run, one author per board).
 */
export function runnerCompilesProjectBlocks ({selectedKind, bootMedia = null, userFirmware = null}) {
    if (selectedKind === 'cp1' || selectedKind === 'cardiac') return false;
    if (selectedKind === 'z80' || selectedKind === 'eater6502' || selectedKind === 'riscv32') return false;
    if (selectedKind === 'i8086' || selectedKind === 'i80286' || selectedKind === 'i80386') return false;
    // An rp2040 .uf2 media bundle boots prebuilt firmware from flash; it does
    // not compile the project's blocks (a bare rp2040js/pico firmware run still does).
    if (selectedKind === 'rp2040js' && bootMedia) return false;
    return !userFirmware;
}

export function selectDebugTargetKind(device, requested = 'emulator') {
    if (requested !== 'emulator') return requested;
    const normalized = String(device || '').toLowerCase();
    if (normalized === 'cardiac') return 'cardiac';
    if (['cp1', 'kosmos-cp1', '8049'].includes(normalized)) return 'cp1';
    if (['arduino-uno', 'arduino-nano', 'atmega328p', 'atmega168p'].includes(normalized)) return 'avr8js';
    if (['arduino-mega', 'atmega2560'].includes(normalized)) return 'atmega2560';
    // Chip-specific AVR kinds — the coarse avr8js kind is an ATmega328P
    // memory map, which is NOT where an ATtiny's ports live. Falling
    // through to the 8051 emulator here fed AVR opcodes to an 8051 core
    // (the pendant's frozen 2433 ms, every pin off — owner report).
    if (normalized === 'attiny88') return 'attiny88';
    if (normalized === 'attiny85') return 'attiny85';
    if (normalized === 'pico') return 'rp2040js';
    if (normalized === 'stm32f030') return 'stm32f0';
    if (normalized === 'stm32g030' || normalized === 'stm32g0') return 'stm32g0';
    if (normalized === 'esp8266') return 'esp8266';
    if (['eater6502', '6502', 'w65c02'].includes(normalized)) return 'eater6502';
    if (['z80', 'zx48', 'zx128'].includes(normalized)) return 'z80';
    if (['i8086', '8086', 'i8088', '8088'].includes(normalized)) return 'i8086';
    if (normalized === 'riscv32') return 'riscv32';
    return requested;
}

/** Convert avr8js's word-addressed Intel-HEX result to flat AVR flash bytes. */
export function avrWordsToFlashBytes(words) {
    if (!(words instanceof Uint16Array)) throw new TypeError('AVR flash words must be Uint16Array');
    const bytes = new Uint8Array(words.length * 2);
    for (let i = 0; i < words.length; i++) {
        bytes[i * 2] = words[i] & 0xff;
        bytes[i * 2 + 1] = words[i] >>> 8;
    }
    return bytes;
}

/**
 * Apply one write-watchpoint toggle without changing the target's address.
 *
 * The runner owns only the host-input shape. Each engine owns the bounds of
 * its write address space and returns its own refusal sentence. Keeping those
 * decisions separate lets a 20-bit target accept 0x1f000 without teaching the
 * browser about one particular CPU's memory map.
 *
 * @param {object} options toggle inputs
 * @param {object} options.target active debug target
 * @param {Map<string, number>} options.watchBps accepted watchpoint handles
 * @param {string} options.space target memory-space name
 * @param {number} options.addr address supplied by the UI
 * @returns {object} added, removed, or refused result
 */
export function toggleTargetWriteWatchpoint ({target, watchBps, space, addr}) {
    if (!Number.isSafeInteger(addr) || addr < 0) {
        return {refused: 'write watchpoint address must be a non-negative safe integer'};
    }
    const key = `${space}:${addr}`;
    if (watchBps.has(key)) {
        target.clearBreakpoint(watchBps.get(key));
        watchBps.delete(key);
        return {removed: true, space, addr};
    }
    const handle = target.setBreakpoint({kind: 'write', space, addr});
    if (typeof handle !== 'number') {
        // The target's own sentence, not a paraphrase of it.
        return {refused: (handle && handle.unsupported) || 'the engine refused it'};
    }
    watchBps.set(key, handle);
    return {added: true, space, addr, handle};
}

/**
 * Apply one code-breakpoint toggle without changing the target's address.
 *
 * The runner validates only the host-input shape. The target owns its address
 * bounds and its refusal sentence, so a 20-bit engine can receive 0x1f000
 * unchanged. Numeric handles remain the success contract. LabWired conforms
 * from bw-board 676d9e893: installation returns its opaque numeric handle,
 * while a refusal remains an object. Never guess a nonnumeric result was a
 * success or this map cannot make the breakpoint visible and clearable.
 *
 * @param {object} options toggle inputs
 * @param {object} options.target active debug target
 * @param {Map<number, number>} options.addrBps accepted breakpoint handles
 * @param {number} options.addr address supplied by the caller
 * @returns {object} added, removed, or refused result
 */
export function toggleTargetCodeBreakpoint ({target, addrBps, addr}) {
    if (!Number.isSafeInteger(addr) || addr < 0) {
        return {refused: 'code breakpoint address must be a non-negative safe integer'};
    }
    if (addrBps.has(addr)) {
        target.clearBreakpoint(addrBps.get(addr));
        addrBps.delete(addr);
        return {removed: true, addr};
    }
    const handle = target.setBreakpoint({kind: 'code', addr});
    if (typeof handle !== 'number') {
        // The target's own sentence, not a paraphrase of it.
        return {refused: (handle && handle.unsupported) || 'the engine refused it'};
    }
    addrBps.set(addr, handle);
    return {added: true, addr, handle};
}

/**
 * @param {object} [opts.machineConfig] wired-extractor {regions, chips} from
 *   Build Machine (bw-machine-extracted) — threads into createDebugTarget
 *   so the bench boots the machine the user wired, not a hardcoded preset.
 * @param {object} [opts.bootMedia] {slot, bytes, profile, name, romAt} from the
 *   Machine Loader / ASM tab — the image the machine boots WITH, so the
 *   reset vector is read from real bytes. profile 'py65mon'/'eater'/'cpm'
 *   names the machine shape a preset image was built for; absent, the
 *   extracted config (or the target's default map) is used.
 */
export function isEsp32S040Target (selection) {
    return selection === 'board:esp32-4848s040' || selection === 'firmware:esp32-4848s040-merged-flash';
}

/** Select an actual placed board without inferring a replacement circuit. */
export function selectEsp32S040Circuit (sourceBoard, model, mcuId = null) {
    if (mcuId !== null && (typeof mcuId !== 'string' || !mcuId)) {
        throw new Error('ESP32-4848S040: select an existing circuit part');
    }
    const candidates = (sourceBoard?.parts || []).filter(part => part.kind === 'esp32_4848s040');
    const drawn = (model?.parts || []).some(part => part.kind === 'esp32_4848s040');
    if (!candidates.length && !drawn && mcuId === null) return null;
    if (model?.netlistError) {
        throw new Error(`ESP32-4848S040: the circuit was rejected: ${String(model.netlistError).split('\n')[0]}`);
    }
    if (typeof sourceBoard?.getNets !== 'function' || !candidates.length) {
        throw new Error('ESP32-4848S040: the placed circuit board is not ready');
    }
    const selected = mcuId === null ? candidates : candidates.filter(part => part.id === mcuId);
    if (selected.length !== 1) {
        throw new Error('ESP32-4848S040: select exactly one existing S040 circuit part');
    }
    return {sourceBoard, mcuId: selected[0].id};
}

let picoTerminalSequence = 0;

export function createDebugRunner({ vm, compilerUrl = 'https://stc-compiler.vercel.app', targetKind = 'emulator', machineConfig = null, bootMedia = null, labwiredChip = null, labwiredBoardVariant = null, esp32S040McuId = null, esp32s3Console = 'uart0', onChange = () => {} }) {
    let session = null;
    // Invalidate stop/start even when target and session references are reused.
    let hddSnapshotOwner = {};
    let target = null;
    let cardiacInitialSnapshot = null;
    let cp1LessonBatch = null;
    let cp1RunKeyUntil = null;
    let cp2Recording = null;
    const cancelCp2Recording = () => {
        cp2Recording?.cancel();
        cp2Recording = null;
    };
    let unsubscribeCp1Lessons = null;
    let releaseEsp32S040Target = null;
    let i8086ExecutionResult = null;
    const i8086ExecutionLifetime = new AbortController();
    let runToTarget = null;
    let runToController = null;
    let activeRunTo = null;
    /** capabilities() builds a fresh literal per call, and snapshot() runs on
     *  every change event — consumers that guard their setState on capability
     *  IDENTITY (circuit-tab's debugState stamp) then re-render at the event
     *  rate, ~60 Hz during a live session. Capabilities are static per target
     *  by design, so hand out one object per attached target. */
    let capsFor = null;
    let capsOf = null;
    let cycleProviderOf = null;
    let board = null;
    let xtKeyboard = null;
    let pcSerialInput = null;
    let cpmAutoRun = null;
    /**
     * Board time minus target time, fixed at each (re)start (boardTimeBase).
     * The target's clock restarts at zero on every run; a board that has
     * already lived (the designer's, attached by a machine bench, or this
     * runner's own board after a stop) does not, and advanceTo ignores a time
     * behind it — so without the base the board froze for as long as the
     * previous run had lasted (task B8, measured: 3 s of a frozen display at
     * the start of the third run).
     */
    let boardBaseNs = 0n;
    let symbols = null;
    /** `${task}/${state}` -> block id, joined from the two halves. */
    let blockOf = new Map();
    /** block id -> `${task}/${state}`, for setting a breakpoint by block. */
    let yieldOf = new Map();
    /** Block ids currently lit. Several, because several tasks are somewhere. */
    let glowing = new Set();
    let rafId = null;
    let status = { phase: 'idle', message: '' };
    /**
     * block id -> the target's handle. Mirrors the shared store (breakpoints.js),
     * which is where the USER's breakpoints live: they are set by right-clicking a
     * block long before a target exists, and they outlive every stop.
     */
    const bps = new Map();
    let unsubscribeBps = null;
    /** The execution history the drawer renders. See trace.js. */
    const debugFoundation = createDebugFoundation({eventCapacity: 4096});
    const debugTimingWaveform = createTimingWaveform({capacity: 4096, maxLanes: 64});
    const eventStream = debugFoundation.events;
    const selectedInspectionStore = createSelectedEventInspectionStore();
    let selectedInspectionKey = null;
    let selectedInspectionView = null;
    // IMPORTED, NOT WRITTEN OUT AGAIN. This was `/-reset-\d+$/` — and three of
    // the four cores lite ships stamp `rewind`, not `reset`:
    //
    //     avr8js-adapter.js  rewindLabel: 'reset'
    //     z80-debug.js       rewindLabel: 'rewind'
    //     m6502-debug.js     rewindLabel: 'rewind'
    //     i8086-debug.js     rewindLabel: 'rewind'
    //
    // So after ANY restore, a replayed event carried `z80-cycles-rewind-1` while
    // the recorded one carried `z80-cycles`, the two compared unequal, and the
    // reverse step refused with `replayed event stream diverged` — a symptom
    // three layers from a regex. That is what the debug-history browser proof
    // had been failing on.
    //
    // `logicalTimeDomain` is declared in the vendored module that WRITES the
    // suffix, and that module now refuses a label the parser cannot strip. One
    // authority, so this cannot drift again: a fifth core updates REWIND_LABELS
    // there and this follows for free.
    const replayClockDomain = logicalTimeDomain;
    const normalizeReplayEvent = event => {
        const {schema, seq, inputCursor, ...fact} = event;
        return {...fact, time: {...fact.time, domain: replayClockDomain(fact.time.domain)}};
    };
    const captureHostState = () => ({
            schema: 1,
            breakpoints: debugFoundation.exportBreakpointState(),
            counters: [...eventBreakpointCounters].map(([name, value]) => [name, value]),
            breakpointGeneration
        });
    const prepareHostRestore = snapshot => {
            if (!snapshot || snapshot.schema !== 1 || !Array.isArray(snapshot.counters) ||
                !Number.isSafeInteger(snapshot.breakpointGeneration) || snapshot.breakpointGeneration < 0) {
                throw new TypeError('Unsupported debugger-host checkpoint');
            }
            const seen = new Set();
            const counters = snapshot.counters.map(entry => {
                if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' ||
                    seen.has(entry[0]) || !Number.isFinite(entry[1])) {
                    throw new TypeError('Invalid debugger-host counter state');
                }
                seen.add(entry[0]);
                return [entry[0], entry[1]];
            });
            const preparedBreakpoints = debugFoundation.prepareBreakpointState(snapshot.breakpoints);
            return {preparedBreakpoints, counters, breakpointGeneration: snapshot.breakpointGeneration};
        };
    const commitHostRestore = prepared => {
            const committed = prepared.preparedBreakpoints.commit();
            if (!committed.committed) throw new Error(`Breakpoint restore failed: ${committed.code}`);
            eventBreakpointCounters.clear();
            for (const [name, value] of prepared.counters) eventBreakpointCounters.set(name, value);
            breakpointGeneration = prepared.breakpointGeneration;
            eventBreakpointDispatcher?.clear();
            replayBreakpointDispatcher?.clear();
            return true;
        };
    const createBranchPayload = (recorder, haltOccurrences) => {
        const branchSession = createRecordingSession({recorder, eventStream, getTarget: () => target,
            captureInspection: currentTarget => ({registers:
                typeof currentTarget.regs === 'function' ? currentTarget.regs() : {}}),
            captureHostState, prepareHostRestore, commitHostRestore});
        const replay = createInstructionReplayController({
            recorder,
            getTarget: () => target,
            restoreCheckpoint: checkpoint => branchSession.restore(checkpoint.eventCursor),
            subscribeEvents: listener => eventStream.onEvent(listener),
            replayHostEvent: event => {
                const result = replayBreakpointDispatcher.dispatch(event, {
                    context: {event, counts: Object.fromEntries(eventBreakpointCounters)}
                });
                if (result.failure) throw new Error(result.failure.code);
                if (result.outcome?.failures?.length) {
                    throw new Error(result.outcome.failures[0].code || 'replay-host-action-failed');
                }
                return true;
            },
            normalizeTimeDomain: replayClockDomain,
            normalizeEvent: normalizeReplayEvent
        });
        const cycleReplay = createCycleReplayController({
            recorder,
            getTarget: () => target,
            restoreCheckpoint: checkpoint => branchSession.restore(checkpoint.eventCursor),
            captureSourceState: currentTarget =>
                wrapSourceState(currentTarget.captureCheckpoint(), captureHostState),
            restoreSourceState: (source, currentTarget) => {
                currentTarget.restoreCheckpoint(source.target);
                return commitHostRestore(prepareHostRestore(source.host));
            },
            subscribeEvents: listener => eventStream.onEvent(listener),
            replayHostEvent: event => {
                const result = replayBreakpointDispatcher.dispatch(event, {
                    context: {event, counts: Object.fromEntries(eventBreakpointCounters)}
                });
                if (result.failure) throw new Error(result.failure.code);
                if (result.outcome?.failures?.length) {
                    throw new Error(result.outcome.failures[0].code || 'replay-host-action-failed');
                }
                return true;
            },
            normalizeTimeDomain: replayClockDomain,
            normalizeEvent: normalizeReplayEvent
        });
        return {recorder, recordingSession: branchSession, instructionReplay: replay,
            cycleReplay, haltOccurrences};
    };
    let activeBranchPayload = createBranchPayload(debugFoundation.recorder,
        debugFoundation.haltOccurrences);
    let forkRecordingStore = createForkRecordingStore({rootRecording: activeBranchPayload});
    const historyStoreFor = (recordingStore, initialEntries = []) => createHistoryAnnotationStore({
        initialEntries, resolveCheckpoint: cursor => {
        const retained = recordingStore.recordingFor(cursor.branchId);
        if (!retained.accepted) return null;
        return retained.recording.recorder.checkpoints().find(checkpoint =>
            checkpoint.eventCursor === cursor.eventCursor) || null;
    }});
    let historyAnnotations = historyStoreFor(forkRecordingStore);
    const recordingSession = Object.fromEntries([
        'start', 'appendBatch', 'appendInput', 'checkpoint', 'restore', 'suspend', 'resume', 'stop', 'status'
    ].map(name => [name, (...args) => activeBranchPayload.recordingSession[name](...args)]));
    const instructionReplay = {
        canReverse: (...args) => activeBranchPayload.instructionReplay.canReverse(...args),
        reverseToEvent: (...args) => activeBranchPayload.instructionReplay.reverseToEvent(...args)
    };
    const cycleReplay = {
        canReverse: (...args) => activeBranchPayload.cycleReplay.canReverse(...args),
        reverseToCycle: (...args) => activeBranchPayload.cycleReplay.reverseToCycle(...args)
    };
    const sessionCodecs = Object.freeze({[DEBUG_SESSION_SNAPSHOT_CODEC]: structuredSessionSnapshotCodec});
    const unsubscribeRecordingEvents = eventStream.onEvent(event =>
        activeBranchPayload.recordingSession.appendBatch([event]));
    let unsubscribeDebugEvents = null;
    let debugEventsTarget = null;
    let unsubscribeDebugInputs = null;
    let replayingDebugHistory = false;
    let eventBreakpointFailures = [];
    let eventBreakpointLog = [];
    const eventBreakpointCounters = new Map();
    // Cursor of the last successful UI reverse; null means the retained live end.
    let reverseCursor = null;
    let bisectionEndpoints = {good: null, bad: null};
    let bisectionRun = {phase: 'idle', probes: 0, maxProbes: 64, result: null};
    let bisectionGeneration = 0;
    let correlatedDebugger = null;
    let correlatedSelectedTarget = null;
    let correlatedSelectedCursor = null;
    let correlatedCheckpoint = null;
    let correlatedStatus = null;
    let correlatedTriggerId = 1;

    const ensureCorrelatedDebugger = event => {
        if (correlatedDebugger) return correlatedDebugger;
        let descriptors = typeof target?.correlatedDebugTargets === 'function' ?
            target.correlatedDebugTargets() : null;
        if (!descriptors || !Object.keys(descriptors).length) {
            if (!target?.captureCheckpoint || !target?.restoreCheckpoint || !event) return null;
            descriptors = {[event.cpuId]: {
                clockDomain: event.time.domain,
                captureCheckpoint: () => target.captureCheckpoint(),
                prepareRestore: snapshot => structuredClone(snapshot),
                restoreCheckpoint: snapshot => target.restoreCheckpoint(snapshot)
            }};
        }
        correlatedDebugger = createCorrelatedDebugger({targets: descriptors, capacity: 8192, maxBranches: 64});
        correlatedSelectedTarget = Object.keys(descriptors)[0];
        return correlatedDebugger;
    };
    // Halt occurrence is a separate order because several native stops may
    // share one instruction boundary. It is advanced only after verified replay.
    let breakpointGeneration = 0;
    let haltLedgerRefusal = null;
    let reverseHistoryRefusal = null;
    let nextForkBranchId = 1;
    const trace = createTrace({eventStream});
    /** The user's own variables: {name, space, addr, size}. From the symbol table. */
    let variableTable = [];
    /** The project's declared pins, for the physical view. */
    let pinTable = [];
    /** Conditions that failed to parse, surfaced rather than silently ignored. */
    let conditionErrors = {};
    /** Serial output buffer — bytes received from adapter.onSerial, decoded as UTF-8. */
    let serialLines = [];
    let basicStartup = null;
    /**
     * The serial face is a TERMINAL, not a log: set for a booted Linux, whose
     * shell edits its own line — backspace-space-backspace to erase, ANSI CSI
     * sequences (`ESC [ … final`) to clear and move — which the plain line
     * buffer would print as `^H` litter and `[J` fragments. Off for every
     * other bench, whose output keeps exactly the bytes it always showed.
     */
    let serialTerminal = false;
    let serialEsc = 0;                 // 0 text, 1 after ESC, 2 inside CSI
    /**
     * The RAW byte stream for a terminal emulator (the Linux lesson's xterm),
     * or null. The line buffer above flattens escape sequences away; a real
     * terminal needs every byte — cursor moves, erases, colours — to draw
     * `vi`, `top` and ash's line editing. Delivered once per frame.
     */
    let terminalOutput = null;
    /** Per-frame boot-progress hook for the Linux lesson, or null. */
    let terminalFrame = null;
    let disposeTerminal = null;
    /**
     * Set by destroy(). A runner destroyed while its start() is still awaiting
     * attach() must not come back to life when attach resolves: before this,
     * start() went on to session.start() + schedule() and the destroyed runner
     * pumped forever beside its replacement — two machines, one console, and
     * input sent to the one whose output was not on screen (the Linux-lesson
     * gate's ~1-in-10 "uname never answered"). Checked after the await and in
     * schedule()/pumpFrame().
     */
    let destroyed = false;
    /**
     * What the ATTACHED engine cannot carry, in the user's words.
     *
     * bw-board's createDebugTarget returns a `refusals` ledger for exactly this:
     * a pad the heavy tier cannot honestly drive is named, with a reason, so the
     * panel can say WHY a knob is dead instead of showing a live-looking control
     * that moves nothing. Dropping the ledger on the floor — which is what this
     * runner did until now — is the failure the ledger exists to prevent.
     */
    /**
     * The attached machine's refusal collector, or null when it has none.
     *
     * A FUNCTION AND NOT A SNAPSHOT. Refusals accumulate while the program runs
     * — the 8237 records a bit the first time a driver sets it and counts every
     * time after — so a list captured at attach would show an empty bench
     * forever. The panel asks at render, which is also what makes "on each new
     * refusal during a run" free rather than a subscription.
     *
     * Only i8086 has one today. z80 and 6502 machines do not, and the null is
     * the honest answer for them: no rows, rather than an empty list that reads
     * as "this bench refused nothing".
     */
    let chipRefusalsOf = null;
    let engineNotes = [];
    /**
     * Where the image the session is running came from, when that is not "the
     * compiler just built it".
     *
     * Deliberately NOT folded into `engineNotes`: those are amber refusals —
     * things the engine cannot do — and a prebuilt image is not a limitation,
     * it is a fact about provenance. Rendering it as a warning would teach the
     * learner to read a working bench as a broken one. It gets its own neutral
     * line, and it stays on screen for the whole session rather than flashing
     * past in the build status, because "why did this not need the network?" is
     * a question asked after the program is running, not during the build.
     */
    let imageProvenance = null;
    /** See `savePoints` in the snapshot. */
    function savePointsNow () {
        if (!target || typeof target.snapshotUnavailable !== 'function') return undefined;
        if (typeof target.state === 'function' && target.state() === 'running') return undefined;
        let unavailable;
        try { unavailable = target.snapshotUnavailable(); } catch (e) { unavailable = String(e.message || e); }
        if (unavailable) return {unavailable, points: []};
        let points = [];
        try { points = target.listSnapshots() || []; } catch (e) { points = []; }
        return {unavailable: null, points};
    }
    /** See `engineDiagnostics` in the snapshot. */
    function engineDiagnosticsNow () {
        if (!target || typeof target.diagnostics !== 'function') return undefined;
        if (typeof target.state === 'function' && target.state() === 'running') return undefined;
        let d;
        try { d = target.diagnostics(); } catch (e) { return undefined; }
        const fault = d && d.fault && d.fault.summary ? {summary: String(d.fault.summary)} : null;
        const gaps = d && Array.isArray(d.fidelityGaps) ? d.fidelityGaps : [];
        const consoleMismatch = d && typeof d.consoleMismatch === 'string' && d.consoleMismatch
            ? d.consoleMismatch : null;
        if (!fault && !gaps.length && !consoleMismatch) return undefined;
        return {fault, fidelityGaps: gaps.slice(0, 20), fidelityGapCount: gaps.length, consoleMismatch};
    }
    /** How many conditional hits were skipped, so the UI can show it happened. */
    let skipped = 0;
    /** Set by the halt handler when a stop should not be shown; read by pumpFrame. */
    let skipRequested = false;
    /** Address breakpoints, which the drawer sets by number rather than by block. */
    const addrBps = new Map();
    /**
     * Write watchpoints, keyed "<space>:<addr>" because iram and sfr overlap
     * at 0x80+ and an address alone does not name a byte on this architecture.
     */
    const watchBps = new Map();

    /**
     * The capability object for the CURRENT target, through the same memo the
     * snapshot uses so consumers keep comparing by identity. `capsOf` is the
     * memoised VALUE, not a function — reading it directly is the bug this
     * helper exists to stop anyone repeating.
     */
    function capsNow() {
        if (!target) return null;
        if (capsFor !== target) {
            capsFor = target;
            capsOf = target.capabilities();
            cycleProviderOf = negotiateCycleProvider(target);
            correlatedDebugger = null;
            correlatedSelectedTarget = correlatedSelectedCursor = correlatedCheckpoint = null;
            correlatedStatus = null;
            debugFoundation.attachCapabilities(capsOf);
            eventBreakpointDispatcher?.clear();
        }
        return capsOf;
    }

    /** Attach one target-owned fact stream to the runner-owned total order. */
    function bindDebugEvents() {
        if (unsubscribeDebugEvents) {
            unsubscribeDebugEvents();
            unsubscribeDebugEvents = null;
            debugEventsTarget = null;
        }
        eventBreakpointDispatcher?.clear();
        unsubscribeDebugEvents = subscribeDebugTargetEvents(target, eventStream,
            event => dispatchPublishedEvent(event));
        debugEventsTarget = target;
        if (unsubscribeDebugInputs) {
            unsubscribeDebugInputs();
            unsubscribeDebugInputs = null;
        }
        unsubscribeDebugInputs = subscribeDebugTargetInputs(target, recordingSession);
    }

    // Per-instruction capture is intentionally opt-in. Merely opening a bench
    // or reading capabilities must leave the CPU's zero-listener fast path in
    // place; a timeline consumer or event breakpoint activates production.
    function ensureDebugEvents() {
        if (!unsubscribeDebugEvents || debugEventsTarget !== target) bindDebugEvents();
    }

    function resetEventBreakpointRuntime() {
        eventBreakpointDispatcher?.clear();
        eventBreakpointFailures = [];
        eventBreakpointLog = [];
        eventBreakpointCounters.clear();
    }

    function circuitMutationRefusal() {
        if (!vm?.runtime?.bwCrispBasicSimulation) return null;
        const message = 'Stop BASIC before changing or stepping the circuit debugger';
        return {accepted: false, code: 'circuit-owned', reason: message, unsupported: message, refused: message};
    }

    function beginForwardBranch(requestedBranchId = null) {
        const denied = circuitMutationRefusal();
        if (denied) return denied;
        if (reverseCursor === null) return {accepted: true, forked: false};
        const parent = forkRecordingStore.active();
        let branchId = requestedBranchId;
        if (branchId === null) do { branchId = `branch-${nextForkBranchId++}`; } while (
            forkRecordingStore.recordingFor(branchId).accepted);
        const prepared = forkRecordingStore.prepareFork({branchId,
            parentBranchId: parent.branch.branchId,
            forkCursor: createBranchCursor(parent.branch.branchId, reverseCursor)});
        if (!prepared.accepted) return prepared;
        const suspended = parent.recording.recordingSession.suspend();
        if (!suspended.accepted) { prepared.reservation.abort(); return suspended; }
        const child = createBranchPayload(createDebugRecorder(), createHaltOccurrenceLedger());
        const rooted = child.recordingSession.start();
        if (!rooted.accepted) {
            prepared.reservation.abort();
            const resumed = parent.recording.recordingSession.resume();
            return resumed.accepted ? rooted : {accepted: false, code: 'fork-rollback-failed',
                reason: resumed.reason || resumed.code};
        }
        const committed = prepared.reservation.commit(child);
        if (!committed.accepted) {
            child.recordingSession.stop();
            const resumed = parent.recording.recordingSession.resume();
            return resumed.accepted ? committed : {accepted: false, code: 'fork-rollback-failed',
                reason: resumed.reason || resumed.code};
        }
        const activated = forkRecordingStore.activate(branchId);
        if (!activated.accepted) return activated;
        activeBranchPayload = activated.recording;
        reverseHistoryRefusal = null;
        haltLedgerRefusal = null;
        reverseContinue.reset();
        return {accepted: true, forked: true, branch: activated.branch,
            checkpoint: rooted.checkpoint};
    }

    function addressRunTo() {
        if (!target) return null;
        if (runToTarget === target && runToController) return runToController;
        runToTarget = target;
        runToController = createRunToCoordinator({target: {
            capabilities: () => debugFoundation.capabilities(),
            setBreakpoint: spec => target.setBreakpoint(spec),
            clearBreakpoint: id => target.clearBreakpoint(id),
            onHalt: listener => target.onHalt(listener),
            // Keep the debug session's intent coherent while the coordinator
            // owns the target's bounded execution slices.
            run: () => session.resume(),
            runFor: budget => target.runFor(budget),
            state: () => target.state(),
            halt: () => target.halt(),
            regs: () => target.regs()
        }});
        return runToController;
    }

    const breakpointIdsForHandle = handle => {
        const ids = [];
        for (const [blockId, candidate] of bps) if (candidate === handle) ids.push(`block:${blockId}`);
        for (const [address, candidate] of addrBps) if (candidate === handle) ids.push(`address:${address}`);
        for (const [key, candidate] of watchBps) if (candidate === handle) ids.push(`watch:${key}`);
        return ids.length ? ids : [`native:${String(handle)}`];
    };

    /** Record only proven, replay-addressable forward breakpoint stops. */
    function recordNativeHaltOccurrence(why) {
        if (targetKind !== 'i8086' || !recordingSession.status().active || !why) return null;
        if (!['breakpoint', 'watchpoint', 'port', 'interrupt'].includes(why.cause)) return null;
        if (why.bp === undefined || why.bp === null) return null;
        const checkpoints = activeBranchPayload.recorder.checkpointSummary();
        if (!checkpoints.length) return null;
        activeBranchPayload.haltOccurrences.evictBeforeCheckpoint(checkpoints[0].eventCursor);
        try {
            return activeBranchPayload.haltOccurrences.append({
                boundaryCursor: eventStream.nextSequence(),
                triggerEventSeq: null,
                matchingIds: breakpointIdsForHandle(why.bp),
                generation: breakpointGeneration,
                stopSide: why.cause === 'breakpoint' ? 'before' : 'after',
                source: 'i8086-native'
            });
        } catch (error) {
            haltLedgerRefusal = {accepted: false, code: 'halt-history-capacity',
                reason: error?.message || String(error)};
            return null;
        }
    }

    function recordEventBreakpointHalt(result) {
        if (!recordingSession.status().active) return;
        const checkpoints = activeBranchPayload.recorder.checkpointSummary();
        if (!checkpoints.length) return;
        const occurrence = eventBreakpointHaltOccurrence({capabilities: capsNow(), result,
            boundaryCursor: eventStream.nextSequence(), generation: breakpointGeneration});
        if (!occurrence) return;
        activeBranchPayload.haltOccurrences.evictBeforeCheckpoint(checkpoints[0].eventCursor);
        try {
            activeBranchPayload.haltOccurrences.append(occurrence);
        } catch (error) {
            haltLedgerRefusal = {accepted: false, code: 'halt-history-capacity',
                reason: error?.message || String(error)};
        }
    }

    function dispatchPublishedEvent(event) {
        try {
            const correlated = ensureCorrelatedDebugger(event);
            if (correlated) {
                const ids = correlated.view().targets.map(item => item.id);
                const targetId = ids.includes(event.cpuId) ? event.cpuId :
                    (ids.length === 1 ? ids[0] : null);
                if (targetId) {
                    const appended = correlated.append('main', {targetId, kind: event.kind,
                        time: event.time, ...(event.cause ? {cause: event.cause} : {})});
                    correlatedSelectedCursor = appended.event.cursor;
                    if (appended.triggers.length) correlatedStatus = {accepted: true,
                        message: `${appended.triggers.length} cross-CPU trigger(s) matched`};
                }
            }
        } catch (error) {
            correlatedStatus = {accepted: false, code: 'correlated-event-refused',
                reason: error?.message || String(error)};
        }
        // Event kinds do not imply a safe halt point. The target must explicitly
        // promise that interior facts are followed by an instruction retire.
        if (!eventBreakpointDispatcher) return null;
        const failuresBefore = eventBreakpointFailures.length;
        let result;
        try {
            result = dispatchEventBreakpointAtBoundary({capabilities: capsNow(),
                dispatcher: eventBreakpointDispatcher, event, options: {
                replay: replayingDebugHistory,
                context: {event, counts: Object.fromEntries(eventBreakpointCounters)}
            }});
        } catch (error) {
            result = {failure: {code: 'event-breakpoint-dispatch-failed',
                message: error?.message || String(error)}};
        }
        if (!result) return null;
        if (result.failure) {
            eventBreakpointFailures.push(result.failure);
            if (eventBreakpointFailures.length > 64) eventBreakpointFailures.shift();
            eventBreakpointDispatcher.clear();
            if (session) session.pause();
            unschedule();
            setStatus('paused', result.failure.code);
            return result;
        }
        recordEventBreakpointHalt(result);
        if (eventBreakpointFailures.length !== failuresBefore && !result?.outcome?.halted) emit();
        return result;
    }

    /** Log an 8086 external mutation before allowing it to reach the machine. */
    function applyI8086Input(producer, payload, apply) {
        if (targetKind !== 'i8086') return apply();
        return applyRecordedTargetInput({target, recordingSession, producer, payload, apply});
    }

    function setStatus(phase, message = '') {
        status = { phase, message };
        emit();
    }

    /**
     * What the UI renders.
     *
     * `phase` is DERIVED from the session whenever there is one, never stored
     * alongside it. Keeping a second copy here was the first version, and it
     * drifted immediately: a breakpoint halt reached the session but the
     * runner still said "running", so the panel showed a running program that
     * was not moving. `status.phase` now only covers the states the session
     * cannot know about — before it exists, and when the build failed.
     */
    function snapshot() {
        const sess = session ? session.state() : null;
        const breakpointList = listBreakpoints();
        let phase = status.phase;
        if (sess && phase !== 'error') {
            phase = sess.intent === 'paused' ? 'paused'
                : sess.intent === 'running' ? (sess.stepping ? 'stepping' : 'running')
                    : 'idle';
        }
        return {
            phase,
            message: status.message,
            session: sess,
            capabilities: target
                ? capsNow()
                : null,
            /** Versioned, conservative capabilities for the event/replay debugger. */
            debugCapabilities: target ? debugFoundation.capabilities() : null,
            /** Native cycle boundary provenance, or null for instruction-only engines. */
            cycleProvider: target ? cycleProviderOf : null,
            breakpoints: breakpointList,
            /** Marked blocks the current build has no yield point for. */
            unreachableBreakpoints: breakpointList.filter((id) => yieldOf.size && !yieldOf.has(id)),
            /**
             * The cooperative scheduler's millisecond tick, straight from RAM.
             *
             * bw-bundle's DebugStatus panel destructures this and showed "—"
             * because the runner held the target privately and never published
             * it. Sixth instance of the producer/consumer pattern, and the
             * second where I am the producer — the consumer was written
             * correctly against a value that did not exist.
             *
             * undefined before a symbol table exists, which is honest: without
             * one there is no `bw_ms` address to read and a zero would be a
             * fabrication.
             */
            // Machine-bench targets (z80/6502 debug) have no scheduler
            // tick — bwMs is an 8051/AVR concept. Guard by capability,
            // not by kind (snapshot() must never take the panel down).
            bwMs: target && typeof target.bwMs === 'function' ? target.bwMs() : undefined,
            conditions: allConditions(),
            conditionErrors,
            skippedHits: skipped,
            /** `<task>/<state>` -> block id, so a consumer can name a position. */
            blockOfTask: Object.fromEntries(blockOf),
            /** block id -> `wait` / `forever` / … so a list can name them, not hash them. */
            yieldKinds: Object.fromEntries(
                [...yieldOf].map(([id, y]) => [id, y.kind])
            ),
            glowing: [...glowing],
            yieldBlocks: [...yieldOf.keys()],
            /** Serial output lines from the AVR USART (print statements). */
            serialOutput: serialLines.length ? [...serialLines] : undefined,
            /**
             * Named limits of the ATTACHED engine — the refusal ledger, plus any
             * caveat that only becomes true once a particular engine is running.
             * undefined when the engine carried everything, so a panel renders
             * nothing rather than an empty warning box.
             */
            engineNotes: engineNotes.length ? [...engineNotes] : undefined,
            /**
             * What the engine knows that the run does not show (targets that
             * offer `diagnostics()`, i.e. LabWired): the fault verdict — why
             * and where the firmware faulted, one sentence — and the
             * instructions it silently skipped or addresses nothing claimed.
             * Read only while stopped, so a running frame costs nothing.
             * undefined when there is nothing to say.
             */
            engineDiagnostics: engineDiagnosticsNow(),
            /**
             * Engine save points (LabWired, firmware-only): `unavailable` is the
             * reason when there are none to offer (a bench cannot rewind its
             * circuit), else `points` oldest first. Read only while stopped.
             */
            savePoints: savePointsNow(),
            /**
             * The prebuilt-image sentence, or undefined when the image was
             * compiled for this session. See `imageProvenance` above.
             */
            imageProvenance: imageProvenance
                ? {...imageProvenance, sentence: provenanceSentence(imageProvenance, uiLang())}
                : undefined
        };
    }

    const snapshotEmitter = createDebugSnapshotEmitter({snapshot, onChange});
    const replayOutputGate = createHistoricalOutputGate({publishState: state => onChange(state)});

    function publishCp1Observations() {
        if (!cp1LessonBatch || typeof window === 'undefined') return;
        for (const item of cp1LessonBatch.take()) {
            window.dispatchEvent(new CustomEvent(`bw-${item.event}`, {detail: item.detail}));
        }
    }

    /** Immediate by default: every existing call is a semantic event. */
    function emit() {
        // A destroyed runner has been replaced; a status it reaches on the way
        // out of an attach await (attaching/ready) describes nothing on screen.
        if (destroyed) return undefined;
        if (replayingDebugHistory) return replayOutputGate.emit(null);
        publishCp1Observations();
        snapshotEmitter.immediate();
    }

    /** Animation-frame progress only; safe to coalesce before snapshot work. */
    function emitLive() {
        if (destroyed) return undefined;
        if (replayingDebugHistory) return replayOutputGate.emit(null);
        publishCp1Observations();
        snapshotEmitter.live();
    }

    // ─── glow ────────────────────────────────────────────────────────────

    /**
     * Light up the block the program is sitting on.
     *
     * Level 1 is yield-to-yield, so this marks the block whose yield we are AT,
     * not necessarily the statement about to run — `debugger-ui.md` §2.2. The
     * UI must not imply more precision than that.
     */
    function glow(tasks) {
        // EVERY task, not one. A cooperative scheduler really does have several
        // scripts each sitting somewhere, and Scratch itself glows every running
        // script rather than choosing between them. Picking "the first task that
        // resolves" was the first version of this, and it lit the other script's
        // hat when a breakpoint stopped task 1 — confidently pointing at the
        // wrong block, which is worse than pointing at none.
        // A finished task (state 0xFFFF) has no block and simply drops out.
        const next = new Set(
            (tasks || [])
                .map((t) => blockOf.get(`${t.task}/${t.state}`))
                .filter(Boolean)
        );
        for (const id of glowing) if (!next.has(id)) safeGlow(id, false);
        for (const id of next) if (!glowing.has(id)) safeGlow(id, true);
        glowing = next;
    }

    function clearGlow() {
        for (const id of glowing) safeGlow(id, false);
        glowing = new Set();
    }

    function safeGlow(blockId, on) {
        try {
            vm.runtime.glowBlock(blockId, on);
        } catch {
            // A block id from a stale build is not worth throwing over; the
            // worst case is a block that does not light up.
        }
    }

    // ─── build ───────────────────────────────────────────────────────────

    /**
     * The project's own hardware declarations.
     *
     * NOT from `vm.toJSON().stc`, which is always undefined: scratch-vm's sb3
     * serializer emits targets/monitors/extensions/meta and drops every other
     * top-level key, so the `stc` block SB3Creator writes into the .sb3 never
     * comes back out. The runtime keeps it instead. Reading the serialised copy
     * is why the circuit designer opened empty for every project, and it would
     * have sent every debug build to the HOST C target — `generateC` picks
     * device-vs-host on `project.stc.pins`, so a missing table does not fail
     * loudly, it silently compiles a different program.
     */
    function projectStc(project) {
        if (vm && vm.runtime && vm.runtime.stc) return vm.runtime.stc;
        return (project && project.stc) || null;
    }

    /** The project as the emitter needs it: serialised, with the runtime's stc put back. */
    function projectForEmit() {
        const project = JSON.parse(vm.toJSON());
        const stc = projectStc(project);
        if (stc) project.stc = stc;
        return project;
    }

    /**
     * blocks -> C -> .hex + symbol table. Returns everything the attach step
     * needs, or throws with a message meant to be shown to a person.
     */
    async function build() {
        setStatus('building', S('compile.reading'));
        const project = projectForEmit();
        const stc = project.stc;
        if (!stc || !(stc.pins || []).length) {
            throw new Error(
                'This project declares no pins, so there is no hardware to debug. ' +
                'Add DEVICE / PIN declarations in the Code tab first.'
            );
        }

        // Through the registering door. A game program can reach the debug runner
        // without the importer having mounted, and an unregistered registry parses
        // `SHAPE art …` as `Unknown SHAPE "art"` — the failure this door removes.
        const { default: SB3Creator } = await import(
            /* webpackChunkName: "sb3-creator" */ '../sb3-creator-register-art.js');
        const { readYieldMap } = await import(
            /* webpackChunkName: "sb3-creator-c" */ '../sb3-creator-c.js');

        const creator = new SB3Creator();
        const c = creator.generateC(project, { debug: true });
        const yields = readYieldMap(c);
        if (!yields.length) {
            throw new Error(
                'This project has no green-flag script, so there is nothing to run.'
            );
        }

        setStatus('building', S('compile.compiling'));
        // The compiler accepts chip names (atmega328p, stc12c5a60s2), not board
        // names (arduino-nano). The map lives in shipped-images.js so the build
        // script that produces the prebuilt images and the runner that looks
        // them up cannot drift apart — two copies of it is exactly how an image
        // built for `atmega328p` would stop matching a runner asking for
        // `arduino-nano`.
        const deviceLower = (stc.device || 'stc12c5a60s2').toLowerCase();
        const compileTarget = compileTargetFor(deviceLower);
        // 'bin' — the service's name for the raw SRAM image. It refuses
        // 'uf2' outright ("format must be ihx, hex or bin"), which made
        // every Pico compile fail with status stuck on the stale RUNNING
        // label (found by the production probe).
        const compileFormat = compileFormatFor(deviceLower);

        // ── the prebuilt lesson image (D2, second half) ──────────────────
        //
        // Asked FIRST, and before any network or WASM chunk, because when it
        // hits nothing else is needed: it is this exact program, already built,
        // with the symbol table from the same request. The match is on the
        // generated C character for character (see shipped-images.js), so a
        // user EDIT changes the C, misses here, and falls through to the
        // ordinary route below — local SDCC for the five supported 8051 parts,
        // the hosted service otherwise, with the hosted route's existing honest
        // failure when there is no network.
        //
        // 8051 programs are deliberately NOT shipped: they compile in the
        // browser already, and a shipped image for a build the app can do would
        // be a second source of truth that can go stale unnoticed.
        let out = LOCAL_8051_TARGETS.has(compileTarget)
            ? null
            : await shippedImageFor(c, compileTarget, compileFormat);
        if (out) {
            imageProvenance = out.provenance;
            setStatus('building', provenanceSentence(out.provenance, uiLang()));
        } else {
            imageProvenance = null;
            // Loading failure is fatal only for a target promised as local. Other
            // families deliberately retain the hosted fetch below and never need
            // the WASM chunk.
            if (LOCAL_8051_TARGETS.has(compileTarget)) {
                // ONE PREDICATE, and the announcement is about WHAT HAPPENED rather
                // than which key was read. Three states where there were two: asked
                // off, on and available, or off by default because the toolchain is
                // not part of this app any more.
                if (localToolchainEnabled()) {
                    await installWasmCompilerRouting(setStatus);
                } else if (localCompilerOptedOut()) {
                    // Said out loud, because the header's objection is to a SILENT
                    // fallback, not to this one.
                    setStatus('building', S('compile.inpageOff'));
                } else {
                    // The 2026-09-07 default. SDCC is GPL-2+ and no longer ships inside
                    // this BSD-3 app, so the in-page compiler is opt-in. Name the route
                    // AND the way back: without both this is a failure with no
                    // explanation and no exit.
                    setStatus('building', S('compile.inpageMissing'));
                }
            }
            // The compile is a pure function of (code, target, format), and the
            // edit-run-edit loop mostly re-runs UNCHANGED programs — while a
            // serverless cold start costs seconds per Run. Successful responses
            // live in a small localStorage LRU keyed by the FULL request (exact
            // match, no hash collisions), so a repeat Run skips the network.
            const cacheKey = JSON.stringify([c, compileTarget, compileFormat]);
            out = compileCacheGet(cacheKey);
            if (out) {
                setStatus('building', S('compile.cached'));
            } else {
                let res;
                try {
                    res = await fetch(`${compilerUrl}/compile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code: c,
                            language: 'c',
                            target: compileTarget,
                            format: compileFormat,
                            // Both, from the SAME request — see the header.
                            symbols: true
                        })
                    });
                } catch (e) {
                    // THE HONEST RESIDUE OF D2, in the one place a learner meets
                    // it. A dead network here surfaced as the browser's own
                    // "Failed to fetch", which says nothing about what was being
                    // attempted, and nothing about why the SAME bench started a
                    // minute earlier without a connection. Say what was tried,
                    // why it is not in the page, and what would work instead.
                    //
                    // Deliberately branched on the family rather than written
                    // once: an 8051 target only reaches here when its in-page
                    // router is not answering — AN INVARIANT THAT STOPPED BEING
                    // TRUE on 2026-09-07, when the in-page compiler became
                    // opt-in. An 8051 target now arrives here routinely with the
                    // compiler never asked, which is why the branch below splits
                    // again on whether it was enabled.
                    const reason = e && e.message ? e.message : String(e);
                    throw new Error(LOCAL_8051_TARGETS.has(compileTarget)
                        ? (localToolchainEnabled()
                            ? `the in-page ${compileTarget} compiler did not answer and the ` +
                              `service at ${compilerUrl} could not be reached either (${reason})`
                            : `${compileTarget} programs CAN compile in this page, but the ` +
                              `in-page compiler is not installed, so this build needed the ` +
                              `service at ${compilerUrl}, which could not be reached ` +
                              `(${reason}). That compiler is GPL-licensed and is downloaded ` +
                              `only when you ask for it. Open Menu → Settings → C Compiler, ` +
                              `choose Build in this page, then Download compiler and retry.`)
                        : `${compileTarget} programs are built by the compiler service at ` +
                          `${compilerUrl}, which could not be reached (${reason}). Its ` +
                          `compiler cannot run in a browser, so it is not in the page. Some ` +
                          `lesson benches on this family ship their program already built and ` +
                          `start with no connection — but an edited program is not one of ` +
                          `them, because nobody has compiled it yet. Undo back to the lesson's ` +
                          `own program to run offline again, reconnect to build this one, or ` +
                          `switch to an 8051 device, whose compiler CAN run in the page — ` +
                          `open Menu → Settings → C Compiler, choose Build in this page, then ` +
                          `Download compiler, since it is not shipped with the app.`
                    );
                }
                out = await res.json();
                if (out.success) compileCachePut(cacheKey, out);
            }
        }
        if (!out.success) throw new Error(out.error || 'the compiler refused this program');
        const isPico = String(stc.device || '').toLowerCase() === 'pico';
        const isStm32 = deviceLower === 'stm32f030' || deviceLower === 'stm32g030' || deviceLower === 'stm32f103';
        // The ESP8266 target returns a flash image (0xE9 boot header) and no
        // symbol table: the esp8266 debug kind runs it without one.
        const isEsp8266 = deviceLower === 'esp8266';
        const isRawImage = isPico || isStm32 || isEsp8266;
        if (!out.symbols && !isRawImage) {
            throw new Error(
                `the image built but carries no symbol table, so the debugger cannot ` +
                `say where it is: ${out.symbols_error || 'no reason given'}`
            );
        }

        // The join. The emitter knows (task, state) -> block; the linker knows
        // (task, state) -> address. Neither knows the other, and (task, state)
        // is the only key both speak.
        blockOf = new Map();
        yieldOf = new Map();
        for (const y of yields) {
            blockOf.set(`${y.task}/${y.state}`, y.block);
            // A block can hold only one yield, so this direction is 1:1.
            yieldOf.set(y.block, { task: y.task, state: y.state, kind: y.kind });
        }

        // For Pico the compile response is a raw SRAM binary, not Intel HEX.
        // Convert base64 → Uint8Array → Uint16Array (little-endian halfwords).
        // The STM32F030 image is also a raw binary, but a REAL flash image
        // (vectors first: word 0 = SP, word 1 = reset) — it stays BYTES,
        // because the F0 machine boots it the way the silicon would.
        let image = null;
        if (isPico) {
            const bytes = Uint8Array.from(atob(out.base64), c => c.charCodeAt(0));
            // Pad to even length if needed
            const padded = bytes.length & 1
                ? new Uint8Array([...bytes, 0])
                : bytes;
            image = new Uint16Array(padded.buffer, padded.byteOffset, padded.length / 2);
        } else if (isStm32 || isEsp8266) {
            image = Uint8Array.from(atob(out.base64), c => c.charCodeAt(0));
        }

        return {
            hex: isRawImage ? null : atob(out.base64),
            image,
            symbols: out.symbols,
            c,
            bytes: out.bytes,
            f_cpu: out.f_cpu || out.fcpu || out.clockHz,
            format: out.format || (isRawImage ? 'bin' : 'ihx'),
        };
    }

    // ─── attach ──────────────────────────────────────────────────────────

    async function attach(built) {
        hddSnapshotOwner = {};
        // Per-engine, so it cannot outlive the engine that produced it: a
        // labwired refusal still shown after the user switched back to the
        // light tier would be a warning about a limit that no longer applies.
        engineNotes = [];
        serialTerminal = false;
        serialEsc = 0;
        terminalOutput = null;
        disposeTerminal?.();
        disposeTerminal = null;
        delete runner.terminal;
        terminalFrame = null;
        const device = String(built?.device || projectStc(null)?.device || '').toLowerCase();
        const selectedTargetKind = selectDebugTargetKind(device, targetKind);
        // The picker offers two targets and only one of them can be honoured
        // here yet. Refusing with the reason is the house rule: silently
        // running the emulator when the user picked "Live board" would be the
        // worst outcome available — they would debug a simulation believing it
        // was their board, and every reading would be plausible and wrong.
        if (selectedTargetKind === 'serial') {
            throw new Error(
                'Live board debugging needs a serial connection, and this build has no ' +
                'transport wired up yet. The target itself is implemented and tested ' +
                '(bw-board serial-debug.js, driven through the real firmware inside the ' +
                'emulator) — what is missing is Web Serial port selection in the browser, ' +
                'which cannot be written blind. Choose "Simulated (emu8051)" for now.'
            );
        }

        if (selectedTargetKind === 'z80') {
            return attachZ80();
        }

        if (selectedTargetKind === 'cardiac') return attachCardiac();
        if (selectedTargetKind === 'cp1') return attachCp1();

        if (selectedTargetKind === 'riscv32') {
            if (bootMedia && bootMedia.profile === 'linux') return attachRiscV32Linux();
            return attachRiscV32();
        }

        if (selectedTargetKind === 'eater6502') {
            return attachEater6502();
        }

        if (selectedTargetKind === 'i8086' || selectedTargetKind === 'i80286') {
            return attachI8086(selectedTargetKind === 'i80286' ? '80286' : bootMedia?.x86Variant);
        }

        if (selectedTargetKind === 'i80386') {
            return attachI80386();
        }

        if (selectedTargetKind === 'stm32f0' || selectedTargetKind === 'stm32g0') {
            return attachStm32F0Target(built);
        }

        if (selectedTargetKind === 'esp8266') {
            return attachEsp8266Target(built);
        }

        // The heavy tier. Only offered when its engine actually loaded (the
        // picker probes first), and it runs the SAME flash image as the light
        // tier above — only the engine underneath differs.
        if (selectedTargetKind === 'labwired') {
            return attachLabwiredTarget(built);
        }

        if (selectedTargetKind === 'rp2040js') {
            // A media bundle (a pico-sdk .uf2 in a `flash` slot) boots from
            // flash the way silicon does, not as a raw Thumb image in SRAM —
            // the RP2040 analogue of the riscv32 Linux split above.
            if (bootMedia && (bootMedia.profile === 'uf2' || bootMedia.slot === 'flash')) {
                return attachRp2040jsBundle();
            }
            return attachRp2040js(built);
        }

        // All AVR-family kinds share one attach path; the kind picks the
        // chip in the factory (memory map, ports, timers). Listing only
        // 'avr8js' here made every chip-specific kind — including a
        // user's explicit picker choice of ATtiny88/85 or ATmega2560 —
        // fall through to the 8051 emulator below, which then ran the
        // AVR image as 8051 opcodes on an inferred STC bench. The picker
        // said ATtiny88, the run was an 8051: plausible and wrong, twice.
        if (selectedTargetKind === 'avr8js' || selectedTargetKind === 'atmega2560' ||
            selectedTargetKind === 'attiny85' || selectedTargetKind === 'attiny88') {
            return attachAvr8js(built, selectedTargetKind);
        }

        setStatus('attaching', S('attach.emulator'));
        const [{ createEmu8051DebugTarget, createDebugSession, createEmu8051Adapter,
            BoardImpl, inferNetlist }, createEmu8051] = await Promise.all([
            import(/* webpackChunkName: "bw-board" */ 'bw-board'),
            import(/* webpackChunkName: "emu8051" */ '../emu8051/emu8051.js').then((m) => m.default || m)
        ]);

        // Emscripten resolves the .wasm relative to the script that loaded it,
        // which for a lazy chunk is `chunks/` — where the file is not. Webpack
        // copies it to `static/` (see the CopyWebpackPlugin entry), and
        // document.baseURI keeps this correct under GitHub Pages, where the app
        // is served from a subpath rather than the root.
        const wasm = await createEmu8051({
            locateFile: (file) => new URL(`static/${file}`, document.baseURI).href
        });
        const stc = projectStc(null) || {};
        const fosc = Number(stc.clock) || 11059200;

        // ORDER MATTERS, and getting it wrong fails silently.
        //
        // `emu_init` frees and re-callocs code memory and re-runs dbg_init. The
        // adapter's constructor calls it. So the adapter must come BEFORE the
        // image, or the image is wiped — and the symptom is not an error: the
        // CPU NOP-sleds through 64 KB of zeroes, reaches whatever address a
        // breakpoint sits at, and halts there with every task still at state 0.
        // It looks like a working debugger pointing at the wrong block. The
        // assertion below is what makes it loud instead.
        //
        //   1. adapter  — inits the emulator, sets the clock and Vcc
        //   2. board    — attached before anything runs, so no edge is missed
        //   3. image    — after the last emu_init
        //   4. target   — symbols last; nothing may re-init behind it
        // part: DEVICE STC15F2K60S2 must reach the emulator or console
        // firmware loses P5 silently (adapter warns until the wasm ships
        // _emu_set_part — the ABI is documented at the adapter).
        // ALL ports. The adapter's default is [1, 3] — a relic that meant
        // ports 0, 2, 4 and 5 were NEVER published to the board: the I2C
        // bus on P2 sat silent (sda/scl 'off forever', blank LCD while the
        // program visibly counted), P0 display buses never lit, the STC15
        // buzzer on P5 never sounded. Push mode is callback-driven, so
        // unused ports cost nothing. (First application of this fix was
        // reverted by a concurrent reset --hard before it was committed.)
        const adapter = createEmu8051Adapter(wasm, { fosc, ports: [0, 1, 2, 3, 4, 5],
            part: String(built.device || stc.device || '').toLowerCase() });

        // The board, so the LEDs light and the buzzer sounds while debugging.
        // It is driven by the emulator through boundary A and knows nothing
        // about the debugger: a halted MCU simply stops calling advanceTo.
        //
        // ONE BOARD, ONE TRUTH: the netlist comes from the DESIGNER's solved
        // board when there is one — the canvas's actual part ids and the
        // breadboard's merged strip nets. Building from the abstract pin
        // inference here is how Blink stopped blinking (2026-08-10): the
        // designer showed a seated bench whose LED id the runner's private
        // board had never heard of, so every brightness lookup returned 0
        // while the emulator dutifully toggled a phantom LED. The inference
        // remains only as the fallback for a project that never opened the
        // Circuit tab's designer.
        const netlist = await resolveNetlist(vm, stc, inferNetlist);
        board = new BoardImpl();
        board.setNetlist(netlist.parts, netlist.nets);
        board.setPower(true);
        // Publish the RUN board: the Widgets panel binds to whatever board
        // the GUI resolves, and during a run the DESIGNER's board is the
        // wrong one — its OLED never sees the emulator's I2C, so a
        // part-bound display widget stayed dark and a widget key press
        // reached a board nobody was executing against (owner report,
        // 2026-08-25). Cleared in stop(), announced so the epoch bumps.
        if (vm && vm.runtime) vm.runtime.bwRunBoard = board;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));
        adapter.attachBoard(board);

        // Serial, both ways, as on the AVR (task B11). The 8051 path had
        // neither: a `print` reached no serial monitor, and an `ask ... and
        // wait` could never be answered. The adapter's onSerial/sendSerial are
        // bw-board #409; the emulator's receive FIFO (emu8051-stc #2) hands a
        // typed line over byte by byte as the program takes it.
        if (typeof adapter.onSerial === 'function') {
            let lineBuf = '';
            serialLines = [];
            adapter.onSerial((byte) => {
                const ch = String.fromCharCode(byte);
                if (ch === '\n') {
                    serialLines.push(lineBuf);
                    lineBuf = '';
                    if (serialLines.length > 200) serialLines.shift();
                } else if (ch !== '\r') {
                    lineBuf += ch;
                }
            });
        }
        if (typeof adapter.sendSerial === 'function') {
            runner.sendSerial = (data) => adapter.sendSerial(typeof data === 'number'
                ? [data & 0xff]
                : Array.from(String(data), ch => ch.charCodeAt(0) & 0xff));
        }

        // ccall marshals the string itself. Nothing here may touch a heap view:
        // no emu8051 build exports one (debugger-ui.md §7b).
        wasm.ccall('emu_load_hex', 'number', ['string', 'number'],
            [built.hex, built.hex.length]);

        // A real 8051 image begins with a jump over the interrupt vectors, so
        // all-zero code at the reset vector means nothing was loaded.
        if (!wasm._emu_get_code(0) && !wasm._emu_get_code(1) && !wasm._emu_get_code(2)) {
            throw new Error(
                'the image did not reach the emulator — code memory is empty at the ' +
                'reset vector. Something re-initialised the emulator after the load.'
            );
        }

        // The block editor asks for hover values through this, because the
        // workspace and the runner are in different component trees.
        setValueResolver((blockId) => runner.valuesAtBlock(blockId));

        // The condition editor (block-menu.js) offers a list of variable names
        // to pick from. It falls back to the stage's Scratch variables, which
        // are CLOSE but not the same list: this one is what the current build
        // actually located, so a variable the linker dropped is absent rather
        // than offered. Offering a name that is not in the build produces a
        // condition that parses, never fires, and looks like a broken pause
        // point — the exact failure setCondition() warns about.
        if (vm && vm.runtime) vm.runtime._bwDebugVariables = () => runner.variables();
        symbols = built.symbols;
        variableTable = (symbols?.variables || []).filter((v) => v.space);
        pinTable = stc.pins || [];
        // `instructionLength` IS INJECTED, not imported by the vendored file.
        // Upstream's emu8051-debug.js used to `import '../bw-debug/opcodes.js'` --
        // a reach OUT of the vendored root, one of three, and the one whose table
        // is GENERATED from a source in neither repo. It now reads `opts`, so the
        // table stays lite's and the caller hands it over. Without this the fact
        // payload loses `bytes` and `length`; the trace pane is unaffected because
        // it computes lengths from its own import of the same function.
        target = createEmu8051DebugTarget(wasm, {symbols, clockHz: fosc, instructionLength});
        session = createDebugSession(target, {
            onChange: (st) => {
                if (st.halted) {
                    // A conditional pause point whose condition is false is not
                    // a stop at all: resume before anything observes it, so the
                    // glow does not flicker, the trace is not polluted with
                    // hits the user asked not to see, and the UI never shows a
                    // pause that immediately un-pauses.
                    // Not resumed here: the frame loop does it, so that many
                    // skips can be absorbed inside ONE frame. Resuming from
                    // here cost a whole frame per skipped hit, and since a
                    // yield breakpoint re-fires within microseconds the program
                    // advanced by microseconds per frame — 1765 skips and the
                    // wait had barely started.
                    if (shouldSkip(st)) { skipped++; skipRequested = true; return; }
                    glow(st.tasks);
                    // One row per stop, always. The drawer's trace pane is the
                    // TUI's history ring; this is the cheap half of filling it.
                    trace.record(target, st.why ? st.why.cause : 'halt',
                        { variables: runner.variables(), tasks: st.tasks });
                } else clearGlow();
                emit();
            }
        });

        setStatus('ready', S('built.plain', {bytes: built.bytes, points: blockOf.size}));
        return session;
    }

    // ── AVR attach path ─────────────────────────────────────────────────
    // avr8js is pure JS — no WASM, no callback-pointer gymnastics. The
    // adapter drives the board through the same boundary A as emu8051.
    // Boundary D currently supports run/pause/resume and instruction stepping.
    // It does not claim block-level positions until AVR symbols are mapped.
    async function attachAvr8js(built, avrKind = 'avr8js') {
        setStatus('attaching', S('attach.avr'));
        const { createDebugTarget, createDebugSession, BoardImpl, inferNetlist } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');

        // A compiled sketch can run in a project that declares no pins at all
        // (nothing in the C tab writes PIN lines), and inferNetlist reads
        // `stc.pins` unguarded. An empty declaration is the honest input: the
        // inferred bench is then the bare MCU, and the pins panel still shows
        // every level the sketch drives.
        const declared = projectStc(null);
        const stc = {...(declared || {}), pins: (declared && declared.pins) || []};

        // F_CPU from the compile response, never hard-coded. The compile
        // endpoint owns the clock and echoes it so the simulator does not
        // guess — this project already documents that failure mode for 1T
        // versus 12T cores.
        const clockHz = built.f_cpu || built.clockHz || 16_000_000;

        // Board — same one-board-one-truth rule as emu8051.
        const netlist = await resolveNetlist(vm, stc, inferNetlist);
        board = new BoardImpl();
        board.setNetlist(netlist.parts, netlist.nets);
        board.setPower(true);
        // Publish the RUN board: the Widgets panel binds to whatever board
        // the GUI resolves, and during a run the DESIGNER's board is the
        // wrong one — its OLED never sees the emulator's I2C, so a
        // part-bound display widget stayed dark and a widget key press
        // reached a board nobody was executing against (owner report,
        // 2026-08-25). Cleared in stop(), announced so the epoch bumps.
        if (vm && vm.runtime) vm.runtime.bwRunBoard = board;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));

        // The factory creates the adapter, attaches the board, parses the
        // Intel HEX into Uint16Array words, loads the program, and — if
        // symbols are present — creates the boundary-D debug target with
        // yield breakpoints and block-level position reporting.
        const {target: avrTarget, adapter: avrAdapter} = await createDebugTarget(avrKind, {
            board, hex: built.hex, symbols: built.symbols, clockHz,
            chip: (built.device || stc.device)?.toLowerCase() === 'atmega168p' ? 'atmega168p' : undefined,
        });

        // Wire serial output: each byte from the AVR's USART0 (print
        // statements) accumulates into lines. The snapshot exposes them
        // so the UI can show a serial monitor.
        if (avrAdapter && avrAdapter.onSerial) {
            let lineBuf = '';
            serialLines = [];
            avrAdapter.onSerial((byte) => {
                const ch = String.fromCharCode(byte);
                if (ch === '\n') {
                    serialLines.push(lineBuf);
                    lineBuf = '';
                    // Cap at 200 lines to avoid unbounded growth
                    if (serialLines.length > 200) serialLines.shift();
                } else if (ch !== '\r') {
                    lineBuf += ch;
                }
            });
        }

        // RX into the program: what the serial console types reaches
        // Serial.read(). Only where the chip HAS a USART -- an ATtiny gets no
        // input line rather than a dead one (the panel asks for sendSerial as
        // a capability). A string (a typed line, CR-terminated) or a single
        // byte, the two shapes the console produces.
        if (avrAdapter && typeof avrAdapter.sendSerial === 'function' &&
            avrAdapter.chip && avrAdapter.chip.usart) {
            runner.sendSerial = (data) => avrAdapter.sendSerial(typeof data === 'number'
                ? [data & 0xff]
                : Array.from(String(data), ch => ch.charCodeAt(0) & 0xff));
        }

        // The real Blinkenrocket receives messages as audio on PA0/ADC6, not
        // through a UART. Keep the modem encoder lazy with the AVR engine and
        // expose it only when the loaded circuit contains the named PCM source.
        // The firmware itself remains user-supplied; this is merely the MIT
        // waveform encoder feeding our permissively licensed circuit engine.
        const modemSource = avrKind === 'attiny88' &&
            board.getParts().find(part => part.id === 'modemIn' &&
                part.kind === 'vsource' && part.params?.wave === 'pcm');
        if (modemSource) {
            runner.sendBlinkenrocket = async (text) => {
                const {encodeTextMessage, MODEM_RATE} = await import(
                    /* webpackChunkName: "bw-blinkenrocket-modem" */
                    'bw-board/blinkenrocket-modem.js');
                const samples = encodeTextMessage(String(text), {sync: 200});
                const start = (Number(board.getTime()) / 1e9) + 0.002;
                board.setPartParam('modemIn', 'rate', MODEM_RATE);
                board.setPartParam('modemIn', 'gain', 2);
                board.setPartParam('modemIn', 'offset', 2.5);
                board.setPartParam('modemIn', 'start', start);
                // Set samples last: that single update makes a repeated message
                // observable immediately with the new board-time start.
                board.setPartParam('modemIn', 'samples', samples);
                return {accepted: true, samples: samples.length,
                    durationSeconds: samples.length / MODEM_RATE};
            };
        }

        // Same value-resolver and variable wiring as the emu8051 path.
        setValueResolver((blockId) => runner.valuesAtBlock(blockId));
        if (vm && vm.runtime) vm.runtime._bwDebugVariables = () => runner.variables();
        // Firmware with no symbol table (a picked .hex, a compiled sketch) and
        // a project with no pin declarations are both legitimate here: the
        // image runs, pins/board/serial/stepping work, and only the
        // block-level views have nothing to say. `symbols.variables` on a
        // null table threw before the first instruction ran.
        symbols = built.symbols;
        variableTable = (symbols && symbols.variables || []).filter((v) => v.space);
        pinTable = (stc && stc.pins) || [];

        target = avrTarget;
        session = createDebugSession(target, {
            onChange: (st) => {
                if (st.halted) {
                    if (shouldSkip(st)) { skipped++; skipRequested = true; return; }
                    glow(st.tasks);
                    trace.record(target, st.why ? st.why.cause : 'halt',
                        { variables: runner.variables(), tasks: st.tasks });
                } else clearGlow();
                emit();
            }
        });

        setStatus('ready', S('built.device', {bytes: built.bytes, device: 'AVR', points: blockOf.size}));

        return session;
    }

    // ── Pico attach path ──────────────────────────────────────────────
    // rp2040js is pure JS — same pattern as avr8js. The program is raw
    // Thumb halfwords into SRAM, not Intel HEX or UF2.
    async function attachRp2040js(built) {
        setStatus('attaching', S('attach.pico'));
        const { createDebugTarget, createDebugSession, BoardImpl, inferNetlist } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');

        // Firmware (a hosted ARM assembly result) can run in a project that
        // declares no pins; inferNetlist and the pin table read stc.pins.
        const declared = projectStc(null);
        const stc = {...(declared || {}), pins: (declared && declared.pins) || []};
        const clockHz = built.f_cpu || built.clockHz || 125_000_000;

        // Board — one-board-one-truth, same as AVR.
        const netlist = await resolveNetlist(vm, stc, inferNetlist);
        board = new BoardImpl(3.3);
        board.setNetlist(netlist.parts, netlist.nets);
        board.setPower(true);
        // Publish the RUN board: the Widgets panel binds to whatever board
        // the GUI resolves, and during a run the DESIGNER's board is the
        // wrong one — its OLED never sees the emulator's I2C, so a
        // part-bound display widget stayed dark and a widget key press
        // reached a board nobody was executing against (owner report,
        // 2026-08-25). Cleared in stop(), announced so the epoch bumps.
        if (vm && vm.runtime) vm.runtime.bwRunBoard = board;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));

        // Convert raw binary to Uint16Array halfwords (Thumb).
        // The compile response returns base64 of the raw SRAM image.
        const program = built.image instanceof Uint16Array ? built.image : null;

        const { target: picoTarget, adapter: picoAdapter } = await createDebugTarget('rp2040js', {
            board, program, symbols: built.symbols, clockHz,
        });

        // Wire serial output — same accumulator pattern as AVR.
        if (picoAdapter && picoAdapter.onSerial) {
            let lineBuf = '';
            serialLines = [];
            picoAdapter.onSerial((byte) => {
                const ch = String.fromCharCode(byte);
                if (ch === '\n') {
                    serialLines.push(lineBuf);
                    lineBuf = '';
                    if (serialLines.length > 200) serialLines.shift();
                } else if (ch !== '\r') {
                    lineBuf += ch;
                }
            });
        }

        // RX into the program (task B11): UART0's receive FIFO, the same
        // both-shapes contract as the AVR and STM32 paths (bw-board #409).
        if (picoAdapter && typeof picoAdapter.sendSerial === 'function') {
            runner.sendSerial = (data) => picoAdapter.sendSerial(typeof data === 'number'
                ? [data & 0xff]
                : Array.from(String(data), ch => ch.charCodeAt(0) & 0xff));
        }

        // Value resolver and variable wiring — same as AVR.
        setValueResolver((blockId) => runner.valuesAtBlock(blockId));
        if (vm && vm.runtime) vm.runtime._bwDebugVariables = () => runner.variables();
        symbols = built.symbols;
        variableTable = (symbols && symbols.variables || []).filter((v) => v.space);
        pinTable = stc.pins || [];

        target = picoTarget;
        session = createDebugSession(target, {
            onChange: (st) => {
                if (st.halted) {
                    if (shouldSkip(st)) { skipped++; skipRequested = true; return; }
                    glow(st.tasks);
                    trace.record(target, st.why ? st.why.cause : 'halt',
                        { variables: runner.variables(), tasks: st.tasks });
                } else clearGlow();
                emit();
            }
        });

        setStatus('ready', S('built.device', {bytes: built.bytes, device: 'Pico', points: blockOf.size}));
        return session;
    }

    /** RP2040 MEDIA BUNDLE — a pico-sdk .uf2 booted from flash the way silicon
     *  does, the RP2040 analogue of attachRiscV32Linux. Where attachRp2040js
     *  drops a raw Thumb image into SRAM (the compile route), a real Pico image
     *  (PicoBB — BBC BASIC for the Pico) begins with an SDK stage-2 boot at
     *  flash base, so it must be flattened from UF2 and entered through
     *  bootFromFlash. The console is UART0; its REPL reaches the serial panel's
     *  terminal, and what the user types reaches it through runner.sendSerial —
     *  the input half attachRp2040js never wired. The firmware is supplied as
     *  media bytes (never compiled here); bw-board owns the boot primitives. */
    async function attachRp2040jsBundle() {
        setStatus('attaching', S('attach.pico'));
        const image = bootMedia && bootMedia.bytes;
        if (!(image instanceof Uint8Array) || !image.length) {
            throw new Error('rp2040 media bundle: the flash slot carried no bytes');
        }
        const [
            { createDebugSession, BoardImpl, inferNetlist },
            { createRp2040jsAdapter },
            { parseUF2, FLASH_BASE },
            { createRp2040jsDebugTarget },
            { Terminal }
        ] = await Promise.all([
            import(/* webpackChunkName: "bw-board" */ 'bw-board'),
            import(/* webpackChunkName: "bw-board" */ 'bw-board/rp2040js-adapter.js'),
            import(/* webpackChunkName: "bw-board" */ 'bw-board/uf2.js'),
            import(/* webpackChunkName: "bw-board" */ 'bw-board/rp2040js-debug.js'),
            import(/* webpackChunkName: "bw-xterm" */ '@xterm/xterm')
        ]);
        if (destroyed) return null;

        // Flatten the UF2 to a flat flash image (byte 0 at FLASH_BASE). Refuse
        // by name on a bad image rather than booting an empty flash into a NOP
        // flood (the failure mode bw-board's bootrom note warns about).
        let flash;
        try {
            const parsed = parseUF2(image);
            if (parsed.base !== FLASH_BASE) {
                throw new Error(`UF2 base 0x${parsed.base.toString(16)} != FLASH_BASE`);
            }
            flash = parsed.image;
        } catch (e) {
            throw new Error(`rp2040 media bundle is not a bootable pico-sdk UF2: ${e.message}`);
        }

        // One board, one truth — same as attachRp2040js. A pin-less project is
        // fine; the firmware drives UART0, not the project's pins.
        const declared = projectStc(null);
        const stc = {...(declared || {}), pins: (declared && declared.pins) || []};
        const clockHz = 125_000_000;
        const netlist = await resolveNetlist(vm, stc, inferNetlist);
        board = new BoardImpl(3.3);
        board.setNetlist(netlist.parts, netlist.nets);
        board.setPower(true);
        if (vm && vm.runtime) vm.runtime.bwRunBoard = board;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));

        // Boot from flash: stage 2 first, exactly as silicon does. resetToProgram
        // restores THIS entry (bootFromFlash sets entryPC = FLASH_BASE), so the
        // panel's Reset re-boots the image rather than jumping into SRAM.
        const adapter = createRp2040jsAdapter({ clockHz, vcc: 3.3 });
        adapter.attachBoard(board);
        adapter.bootFromFlash(flash);
        const project = vm?.runtime?.getTargetForStage?.();
        const flashStorage = mountPicoFlashStorage(project, adapter.rp2040.flash, flash.length,
            bootMedia.picoFlashStorage, () => {
                if (vm.runtime.getTargetForStage() === project) vm.runtime.emitProjectChanged?.();
            });

        const uart = adapter.rp2040.uart[0];
        const feedByte = byte => uart.feedByte(byte & 0xff);
        const output = createTerminalOutput();
        const input = createReadyGatedInput({isReady: () => true, send: feedByte,
            canAccept: () => uart.rxFIFO.empty, burst: 32});
        // PicoBB probes for the current position, then the right edge, and
        // restores the position it was given. Keep the parser alive offscreen
        // so queries work with the Controller hidden or after it remounts.
        const cursor = new Terminal({cols: TERMINAL_COLS, rows: TERMINAL_ROWS, scrollback: 0});
        cursor.onData(reply => {
            if (/^\x1b\[\d+;\d+R$/.test(reply)) input.write(new TextEncoder().encode(reply));
        });
        const commands = bootMedia.picoBasicCommands || [];
        const consoleSpec = picoBasicConsoleSpec(bootMedia.picoBasicConsole || 'bbc');
        const encoder = new TextEncoder();
        let nextCommand = 0;
        let sawBanner = false;
        const unsubscribeCursor = output.subscribe(bytes => cursor.write(bytes, () => {
            if (!sawBanner || nextCommand >= commands.length || input.pending()) return;
            if (picoBasicAtPrompt(cursor.buffer.active, consoleSpec)) {
                input.write(encoder.encode(commands[nextCommand++] + '\r'));
            }
        }));
        disposeTerminal = () => {
            flashStorage?.dispose();
            unsubscribeCursor();
            cursor.dispose();
        };
        let lineBuf = '';
        let wakeOnPrompt = bootMedia.picoWakeOnPrompt === true;

        adapter.onSerial(byte => {
            const ch = String.fromCharCode(byte);
            if (wakeOnPrompt || (commands.length && !sawBanner)) {
                if (ch === '\n') {
                    if (lineBuf.includes(consoleSpec.banner)) sawBanner = true;
                    if (wakeOnPrompt && lineBuf.trim() === 'Waiting for connection') {
                        wakeOnPrompt = false;
                        feedByte(13);
                    }
                    lineBuf = '';
                } else if (ch !== '\r') lineBuf = (lineBuf + ch).slice(-512);
            }
            output.push(byte);
        });

        runner.sendSerial = data => input.write(typeof data === 'number' ? [data] :
            typeof data === 'string' ? new TextEncoder().encode(data) : data);
        runner.terminal = {id: `pico-uart-${++picoTerminalSequence}`, kind: 'pico',
            rows: TERMINAL_ROWS, cols: TERMINAL_COLS, subscribe: output.subscribe, send: input.write};
        terminalFrame = () => {
            output.deliver();
            input.flush();
            flashStorage?.tick(performance.now());
        };

        setValueResolver((blockId) => runner.valuesAtBlock(blockId));
        if (vm && vm.runtime) vm.runtime._bwDebugVariables = () => runner.variables();
        symbols = null;
        variableTable = [];
        pinTable = stc.pins || [];

        target = createRp2040jsDebugTarget(adapter, { symbols: undefined, clockHz });
        session = createDebugSession(target, {
            onChange: (st) => {
                if (st.halted) {
                    if (shouldSkip(st)) { skipped++; skipRequested = true; return; }
                    glow(st.tasks);
                    trace.record(target, st.why ? st.why.cause : 'halt',
                        { variables: runner.variables(), tasks: st.tasks });
                } else clearGlow();
                emit();
            }
        });

        setStatus('ready', S('built.device', {bytes: image.length, device: 'Pico', points: blockOf.size}));
        return session;
    }

    /** Native firmware on the HEAVY tier (labwired-wasm).
     *
     *  STM32F030 uses the same raw flash image as attachStm32F0Target. AVR
     *  compiler output is Intel HEX, converted below to little-endian flash
     *  bytes; the bw-board adapter wraps either architecture in the matching
     *  ELF container before handing it to LabWired.
     *
     *  Two things this path does that the light one does not:
     *
     *  1. It fetches the optional engine on first use. `loadLabwired()` returns null
     *     rather than throwing when the artifact was never deployed, so the
     *     failure here is a clear message, not a broken panel — and the picker
     *     should not have offered the kind at all in that case.
     *  2. It wraps the flash image in an ELF. LabWired ends in
     *     `load_elf_bytes`; the adapter supplies the architecture-correct
     *     container. The cost is symbols:
     *     there are none in a .bin, so no source lines and no yield points.
     */
    async function attachLabwiredTarget (built) {
        if (destroyed) return null;
        setStatus('attaching', S('attach.labwired'));
        if (destroyed) return null;
        const { createDebugTarget, createDebugSession, BoardImpl, inferNetlist,
            STM32F0, LABWIRED_CHIPS, parseIntelHex } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');
        if (destroyed) return null;
        const { loadLabwired } = await import(
            /* webpackChunkName: "labwired-probe" */ '../labwired-engine.js');
        if (destroyed) return null;

        const wasm = await loadLabwired();
        if (destroyed) return null;
        if (!wasm) {
            throw new Error('the labwired engine is not available in this build' +
                (loadLabwired.lastError ? ` (${loadLabwired.lastError})` : '') +
                '. Run `npm run sync:labwiredwasm` and rebuild, or pick another engine.');
        }

        if (isEsp32S040Target(labwiredChip)) {
            if (labwiredBoardVariant !== null) {
                throw new Error('ESP32-4848S040 uses its exact board profile, not a replacement circuit variant');
            }
            return attachEsp32S040(built, wasm, createDebugTarget, createDebugSession, BoardImpl);
        }

        // A chip picked in the panel means "my firmware on that chip", with no
        // circuit — whatever the project's own device is.
        if (labwiredChip === 'firmware:esp32s3-merged-flash') {
            if (labwiredBoardVariant !== null) {
                throw new Error('ESP32-S3 merged-flash boot cannot replace a selected circuit variant');
            }
            return attachEsp32S3MergedFlash(built, wasm, createDebugTarget, createDebugSession);
        }
        if (labwiredChip === 'software:samd51-no-asf-simulation') {
            if (labwiredBoardVariant !== null) {
                throw new Error('the SAMD software profile cannot replace a selected circuit variant');
            }
            return attachSamdSoftwareProfile(built, wasm, createDebugTarget, createDebugSession);
        }
        if (labwiredChip) {
            if (labwiredBoardVariant !== null) {
                throw new Error('a selected on-module variant needs a circuit-derived board, not a catalog override');
            }
            return attachLabwiredFirmwareOnly(built, wasm, createDebugTarget, createDebugSession);
        }

        const stc = projectStc(null);
        const device = String(stc?.device || '').toLowerCase();
        const isAvr = ['arduino-uno', 'arduino-nano', 'atmega328p'].includes(device);
        const chipKind = isAvr ? 'arduino_uno'
            : device === 'stm32f030' ? 'stm32f030'
                : device === 'microbit' || device === 'microbit-v2' ? 'microbit_v2'
                    : ['pybadge', 'pybadge-lc', 'samd51', 'arcade'].includes(device) ? 'pybadge' : null;
        if (!chipKind) {
            throw new Error(`LabWired has no admitted board model for '${device || 'this project'}'. `
                + 'ATtiny85/88 stay on avr8js.');
        }
        const chip = chipKind === 'stm32f030' ? STM32F0 : LABWIRED_CHIPS[chipKind];
        if (!chip) throw new Error(`this bw-board build does not carry the LabWired '${chipKind}' model`);
        if (labwiredBoardVariant !== null && (typeof labwiredBoardVariant !== 'string' ||
            !Object.hasOwn(chip.onBoardVariants ?? {}, labwiredBoardVariant))) {
            throw new Error(`this bw-board build has no selected '${labwiredBoardVariant}' variant for '${chipKind}'`);
        }
        const clockHz = built.f_cpu || built.clockHz || chip.clockHz;

        const netlist = await resolveNetlist(vm, stc, inferNetlist);
        board = new BoardImpl(isAvr ? 5.0 : 3.3);
        board.setNetlist(netlist.parts, netlist.nets);
        board.setPower(true);
        if (vm && vm.runtime) vm.runtime.bwRunBoard = board;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));

        const program = isAvr
            ? (typeof built.hex === 'string'
                ? avrWordsToFlashBytes(parseIntelHex(built.hex, 32 * 1024))
                : null)
            : (built.image instanceof Uint8Array ? built.image : null);
        if (!program) throw new Error(isAvr
            ? 'the ATmega328P build produced no Intel HEX image'
            : 'the STM32F030 build produced no flash image');

        // NO `pins`, and NO `chipYaml`. This is the documented mistake, and it
        // was made here: handing the factory a header map alongside the board
        // means two descriptions of one bench, and nothing checks that they
        // agree — the exact divergence one-board-one-truth forbids. Worse, it
        // also SKIPS the derivation entirely, so `refusals` came back empty on
        // every bench: a pot that the heavy tier cannot read looked carried.
        // The factory derives all four from the board's own netlist when they
        // are absent (LABWIRED-BRIDGE.md §0, "THE PAD IS THE BOUNDARY"), which
        // is why `chipKind` — a fact the netlist genuinely cannot carry, since
        // the canonical loader rewrites every controller to `mcu` — is the one
        // thing still passed.
        let lwTarget, lwAdapter, refusals;
        try {
            ({ target: lwTarget, adapter: lwAdapter, refusals } = await createDebugTarget('labwired', {
                wasm, board, firmware: program, firmwareAddress: built.firmwareAddress,
                // An nRF .hex's UICR words, loaded beside the image: the MBR
                // reads them at reset (labwired-firmware.js).
                extraSegments: built.extraSegments,
                chipKind, clockHz, boardVariant: labwiredBoardVariant,
            }));
        } catch (e) {
            // The bridge throws with a `refusals` array when the bench cannot be
            // carried at all (an unmapped pin, no MCU, two MCUs). Its message
            // already names each one; re-raise it as-is rather than replacing it
            // with a generic failure that loses the reasons.
            if (e && e.refusals) {
                engineNotes = e.refusals.map(r => `${r.subject}: ${r.reason}`);
                emit();
            }
            throw e;
        }

        // The tier's two standing caveats, stated on every attach because both
        // are properties of the ENGINE, not of this bench — see
        // bw-board/LABWIRED-BRIDGE.md §4 and §4c, each measured against the
        // light tier as its control.
        engineNotes = [
            // The 2x-clock caveat that used to sit beside this one RETIRED on
            // 2026-08-30: the vendored engine (labwired-core 0c0cd0ec) drops a
            // level-pended timer interrupt when its source deasserts inside the
            // handler, measured 0.97 entries per update event on both tiers —
            // the same instrument that ledgered 1.95.
            ...(chipKind === 'stm32f030' ? ['Analog inputs are not injected on this tier: the engine now EXPORTS a '
            + 'per-channel ADC entry point, but this adapter does not feed it yet, so a '
            + 'pot or LDR still reads the engine\'s own counter instead of the voltage '
            + 'this board solves. Use the light tier (Simulated STM32F030) for analog work.'] : []),
            ...(built.omittedFirmwareBytes ? [
                `${built.omittedFirmwareBytes} non-flash configuration byte(s) were omitted from the image`
            ] : []),
            ...(refusals || []).map(r => `${r.subject}: ${r.reason}`)
        ];

        return finishLabwiredAttach(lwTarget, lwAdapter, program.length, stc.pins || [], createDebugSession);
    }


    /** The user's own ELF on a labwired catalog chip, with no circuit.
     *
     *  No netlist, so no board, no pins and no bench refusals: the Circuit tab
     *  is not told a board is ready, because there is none. The panel offers
     *  the chip list (bw-board/labwired-catalog.js, the engine's own chip
     *  descriptors at the wasm build pin) only on the LabWired engine. */
    async function attachLabwiredFirmwareOnly (built, wasm, createDebugTarget, createDebugSession) {
        const { LABWIRED_CATALOG, LABWIRED_BOARDS } = await import(
            /* webpackChunkName: "labwired-catalog" */ 'bw-board/labwired-catalog.js');
        // `board:<name>` is a labwired BOARD — its chip plus the devices its
        // manifest wires, a display among them; a bare name is just the chip.
        const labBoard = labwiredChip.startsWith('board:')
            ? (LABWIRED_BOARDS || {})[labwiredChip.slice(6)] : null;
        if (labwiredChip.startsWith('board:') && !labBoard) {
            throw new Error(`'${labwiredChip.slice(6)}' is not a board the LabWired engine offers`);
        }
        const chip = LABWIRED_CATALOG[labBoard ? labBoard.chip : labwiredChip];
        if (!chip) throw new Error(`'${labwiredChip}' is not a chip the LabWired engine offers`);
        // A .hex only for an S110 board (the SoftDevice-emulated app region).
        const formats = labBoard && labBoard.softdevice === 's110' ? ['elf', 'uf2', 'hex'] : ['elf', 'uf2'];
        if (!built || !formats.includes(built.format) || !(built.image instanceof Uint8Array)) {
            throw new Error(`the ${chip.name} runs your own firmware: load an .elf or .uf2 with Firmware… first ` +
                '(a block project compiles for its own device, not for this chip)');
        }
        const { target: lwTarget, adapter: lwAdapter } = await createDebugTarget('labwired', {
            wasm, chip, firmware: built.image, labwiredBoard: labBoard || undefined,
        });
        board = null;
        engineNotes = [
            labBoard && labBoard.softdevice
                ? `Your ${labBoard.name} application on the ${chip.name}, with the Nordic ` +
                  `${labBoard.softdevice.toUpperCase()} SoftDevice EMULATED (only the application region of the ` +
                  'image is loaded — no Nordic byte). Serial console and buttons A/B work; there is no circuit.'
                : labBoard
                ? `Your firmware on the ${labBoard.name} board (${chip.name}, ${chip.arch}), with its ` +
                  `${labBoard.displays.map(d => d.type).join(', ')} display shown in Widgets; other pins ` +
                  'are not wired to a circuit here.'
                : `Your firmware on the ${chip.name} (${chip.arch}, ${chip.clockHz / 1e6} MHz), with no circuit: ` +
                  'pins are not wired to anything here, so this is for stepping, breakpoints, registers, ' +
                  'memory and the serial console.'
        ];
        emit();
        return finishLabwiredAttach(lwTarget, lwAdapter, built.image.length, [], createDebugSession);
    }

    async function attachEsp32S3MergedFlash (built, wasm, createDebugTarget, createDebugSession) {
        if (!built || built.format !== 'esp32s3-merged-flash' || !(built.image instanceof Uint8Array)) {
            throw new Error('ESP32-S3 ROM boot needs a merged .bin at flash offset zero, including the ' +
                'bootloader, partition table and application; load it with Firmware… first');
        }
        const {target: lwTarget, adapter: lwAdapter} = await createDebugTarget('labwired', {
            wasm, firmware: built.image,
            firmwareBoot: await esp32S3BootOptions()
        });
        board = null;
        engineNotes = [
            'ESP32-S3 ROM boot of your merged flash image. This firmware-only target has no circuit, ' +
            '4848S040 display or touch panel.',
            `Console output: ${esp32s3Console === 'uart0' ? 'UART0' :
                esp32s3Console === 'usb_serial_jtag' ? 'USB Serial/JTAG' : 'both (messages can interleave)'}. ` +
            'Console selection filters output; serial input is delivered to the engine’s serial receivers.'
        ];
        emit();
        return finishLabwiredAttach(lwTarget, lwAdapter, built.image.length, [], createDebugSession);
    }

    async function esp32S3BootOptions (isCurrent = () => true) {
        if (!isCurrent()) return null;
        const {ESP32S3_FLASH_BOOT_KIND} = await import(
            /* webpackChunkName: "labwired-firmware-boot" */ 'bw-board/labwired-firmware-boot.js');
        if (!isCurrent()) return null;
        const {loadEsp32S3Roms} = await import(
            /* webpackChunkName: "esp32s3-firmware" */ './esp32s3-firmware.js');
        if (!isCurrent()) return null;
        const base = (typeof document !== 'undefined' && document.baseURI) || null;
        const {irom, drom} = await loadEsp32S3Roms({base});
        if (!isCurrent()) return null;
        return {kind: ESP32S3_FLASH_BOOT_KIND, irom, drom, console: esp32s3Console};
    }

    async function attachEsp32S040 (built, wasm, createDebugTarget, createDebugSession, BoardImpl) {
        if (destroyed) return null;
        if (!built || !['elf', 'esp32s3-merged-flash'].includes(built.format) ||
            !(built.image instanceof Uint8Array)) {
            throw new Error('ESP32-4848S040 needs addressed Xtensa ELF or explicitly selected merged flash');
        }
        const binding = selectEsp32S040Circuit(vm?.runtime?.circuitBoard,
            vm?.runtime?.circuitModel, esp32S040McuId);
        // Keep this board private until its target is admitted. A teardown
        // while ROMs or the factory are pending must leave the replacement's
        // board and debugger callbacks untouched.
        const attachedBoard = binding ? new BoardImpl(3.3) : null;
        const circuitOptions = {};
        if (binding) {
            attachedBoard.setNetlist(binding.sourceBoard.parts, binding.sourceBoard.getNets());
            attachedBoard.setPower(true);
            circuitOptions.board = attachedBoard;
            circuitOptions.mcuId = binding.mcuId;
        }
        const firmwareBoot = built.format === 'esp32s3-merged-flash'
            ? await esp32S3BootOptions(() => !destroyed) : null;
        if (destroyed) return null;
        const {target: lwTarget, adapter: lwAdapter, refusals} = await createDebugTarget('labwired', {
            wasm, firmware: built.image, labwiredBoardId: 'esp32-4848s040', ...circuitOptions,
            ...(firmwareBoot ? {firmwareBoot} : {})
        });
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            try {
                if (typeof lwTarget.destroy === 'function') lwTarget.destroy();
            } finally {
                // target.destroy releases pads/listeners, not the WASM machine.
                // Reset replaces adapter.sim, so free its current instance.
                if (typeof lwAdapter?.sim?.free === 'function') lwAdapter.sim.free();
            }
        };
        if (destroyed) {
            release();
            return null;
        }
        releaseEsp32S040Target = release;
        board = attachedBoard;
        // Use the supplier's confirmed owner, never every matching circuit part.
        runner.esp32S040PartId = lwAdapter.labwiredBoard.mcuId;
        if (board && vm?.runtime) vm.runtime.bwRunBoard = board;
        if (board && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));
        // A board-ready listener can synchronously tear the runner down too;
        // the target has not yet been transferred to finishLabwiredAttach.
        if (destroyed) {
            release();
            return null;
        }
        engineNotes = [
            'ESP32-4848S040 functional software model: firmware drives the RGB display and GT911 touch. ' +
            (binding ? `Circuit owner: ${binding.mcuId}; only its external H1 GPIOs are connected.` :
                'No S040 circuit part is attached; the screen is available in Widgets.'),
            'Physical board timing, arbitrary Arduino/LVGL compatibility, radio and hardware upload are not qualified.',
            ...(refusals || []).map(refusal => `${refusal.subject}: ${refusal.reason}`)
        ];
        return finishLabwiredAttach(lwTarget, lwAdapter, built.image.length, [], createDebugSession, true);
    }

    async function attachSamdSoftwareProfile (built, wasm, createDebugTarget, createDebugSession) {
        if (!built || !['elf', 'uf2'].includes(built.format) || !(built.image instanceof Uint8Array)) {
            throw new Error('the SAMD software profile needs addressed .elf or .uf2 firmware');
        }
        const {loadSamdSoftwareProfile} = await import(
            /* webpackChunkName: "samd-software-profile" */ './samd-software-profile.js');
        const base = (typeof document !== 'undefined' && document.baseURI) || null;
        const {profile, inputs} = await loadSamdSoftwareProfile({base});
        const {target: lwTarget, adapter: lwAdapter} = await createDebugTarget('labwired', {
            wasm, firmware: built.image, softwareProfile: {
                name: profile.profile, kind: profile.kind, physicalCapture: profile.physical_capture,
                chipYaml: profile.chip_yaml, systemYaml: profile.system_yaml,
                blobs: inputs, clockHz: 120_000_000, displays: [{id: 'controller_memory'}]
            }
        });
        board = null;
        engineNotes = ['Authored SAMD software simulation with controller-memory display; no physical panel or circuit is represented.'];
        emit();
        return finishLabwiredAttach(lwTarget, lwAdapter, built.image.length, [], createDebugSession, true);
    }

    /** What every labwired attach does once it has a target: the console (out
     *  AND in), the runner's target/session, and the ready line. Shared by the
     *  bench attach and the firmware-only one so the two cannot drift. */
    function finishLabwiredAttach (lwTarget, lwAdapter, programBytes, pins, createDebugSession, allowPendingVideo = false) {
        if (lwAdapter && lwAdapter.onSerial) {
            let lineBuf = '';
            serialLines = [];
            lwAdapter.onSerial((byte) => {
                const ch = String.fromCharCode(byte);
                if (ch === '\n') {
                    serialLines.push(lineBuf);
                    lineBuf = '';
                    if (serialLines.length > 200) serialLines.shift();
                } else if (ch !== '\r') {
                    lineBuf += ch;
                }
            });
        }

        // RTT / semihosting / ITM: other ways firmware prints. Same console,
        // one line buffer per channel, each line labelled so a reader knows
        // which stream said it (a UART line has no label, as before).
        if (lwAdapter && typeof lwAdapter.onTrace === 'function') {
            const partial = new Map();
            lwAdapter.onTrace((channel, bytes) => {
                let buf = partial.get(channel) || '';
                for (const byte of bytes) {
                    const ch = String.fromCharCode(byte);
                    if (ch === '\n') {
                        serialLines.push(`[${channel}] ${buf}`);
                        buf = '';
                        if (serialLines.length > 200) serialLines.shift();
                    } else if (ch !== '\r') {
                        buf += ch;
                    }
                }
                partial.set(channel, buf);
            });
        }

        // RX into the program, the half the other tiers already had: without a
        // `sendSerial` the panel hides its input line (it asks for the
        // capability), so on this tier the console was output-only even though
        // the adapter feeds the engine's UART. A string (a typed line) or one
        // byte, the two shapes the console produces; the adapter takes a byte
        // at a time. Deleted when absent so an earlier attach's input line
        // cannot outlive it and type into a different engine.
        if (lwAdapter && typeof lwAdapter.feedSerial === 'function') {
            // Through the TARGET when it offers feedSerial: it records each byte
            // as an input fact on the instruction clock, which is what lets a
            // reverse replay put the byte back at the same instruction.
            const feed = lwTarget && typeof lwTarget.feedSerial === 'function'
                ? b => lwTarget.feedSerial(b)
                : b => lwAdapter.feedSerial(b);
            runner.sendSerial = (data) => {
                const bytes = typeof data === 'number'
                    ? [data & 0xff]
                    : Array.from(String(data), ch => ch.charCodeAt(0) & 0xff);
                for (const b of bytes) feed(b);
            };
        } else {
            delete runner.sendSerial;
        }

        // The board's display (a labwired board picked with its display): the
        // Widgets mirror polls this. Deleted otherwise, so an earlier machine's
        // screen cannot outlive it.
        if (lwTarget && typeof lwTarget.video === 'function' && (allowPendingVideo || lwTarget.video() !== null)) {
            runner.video = () => lwTarget.video();
        } else {
            delete runner.video;
        }

        // `target` and `session` are the RUNNER's, not locals. Declaring them
        // with const here shadowed the outer pair, so attach() returned a live
        // session while the runner's stayed null and start() died on
        // `session.start()` — the one thing no unit test could catch, because
        // the target itself was fine. Every other attach path assigns these.
        target = lwTarget;
        // A raw image carries no symbols. Clearing them matters: left over from
        // a previous stm32f0 run they would populate the variables pane with
        // names this run cannot resolve — readings that look right and are not.
        symbols = null;
        variableTable = [];
        pinTable = pins;
        if (vm && vm.runtime) vm.runtime._bwDebugVariables = () => runner.variables();

        session = createDebugSession(target, {
            // No symbols means no glow and no variable trace — the block/yield
            // machinery the other tiers use has nothing to work from. The panel
            // still has to follow the target, so emit on every change.
            onChange: () => emit()
        });
        // Said in the status line rather than left for the user to infer from a
        // greyed-out button.
        setStatus('ready', S('built.labwired', {bytes: programBytes}));
        return session;
    }

    /** STM32F030 — same shape as the Pico attach, three differences: the
     *  program is a raw flash image in BYTES (vectors first — the F0
     *  machine boots it like the silicon), the core clock follows the
     *  firmware's own RCC setup (bw-board refuses a `clockHz` for STM32
     *  targets), and the target kind is 'stm32f0'. The debug target
     *  underneath is the SAME rp2040js one, driven through the F0
     *  adapter's facade. */
    async function attachStm32F0Target(built) {
        setStatus('attaching', S('attach.stm32'));
        const { createDebugTarget, createDebugSession, BoardImpl, inferNetlist } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');

        // Firmware (a hosted ARM assembly result) can run in a project that
        // declares no pins; inferNetlist and the pin table read stc.pins.
        const declared = projectStc(null);
        const stc = {...(declared || {}), pins: (declared && declared.pins) || []};
        const targetKind = (built && built.kind) || selectedTargetKind || 'stm32f0';

        const netlist = await resolveNetlist(vm, stc, inferNetlist);
        board = new BoardImpl(3.3);
        board.setNetlist(netlist.parts, netlist.nets);
        board.setPower(true);
        // Publish the RUN board — same one-board-one-truth rule as the
        // Pico path above (widget panel binds to the executing board).
        if (vm && vm.runtime) vm.runtime.bwRunBoard = board;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));

        const program = built.image instanceof Uint8Array ? built.image : null;
        if (!program) throw new Error(`the ${targetKind} build produced no flash image`);

        const { target: f0Target, adapter: f0Adapter } = await createDebugTarget(targetKind, {
            board, program, symbols: built.symbols,
        });

        if (f0Adapter && f0Adapter.onSerial) {
            let lineBuf = '';
            serialLines = [];
            f0Adapter.onSerial((byte) => {
                const ch = String.fromCharCode(byte);
                if (ch === '\n') {
                    serialLines.push(lineBuf);
                    lineBuf = '';
                    if (serialLines.length > 200) serialLines.shift();
                } else if (ch !== '\r') {
                    lineBuf += ch;
                }
            });
        }

        // RX into the machine — same both-shapes contract as the 8051
        // path (a typed line arrives as a string, the SerialConsole
        // sends single keycodes as numbers). USART1's RXNE/RDR model
        // pops the queue; a WFI-parked poll loop sees RXNE on its next
        // millisecond tick.
        if (f0Adapter && f0Adapter.feedSerial) {
            runner.sendSerial = (data) => {
                if (typeof data === 'number') {
                    f0Adapter.feedSerial(data & 0xff);
                    return;
                }
                const text = String(data);
                for (let i = 0; i < text.length; i++) {
                    f0Adapter.feedSerial(text.charCodeAt(i));
                }
            };
        }

        setValueResolver((blockId) => runner.valuesAtBlock(blockId));
        if (vm && vm.runtime) vm.runtime._bwDebugVariables = () => runner.variables();
        symbols = built.symbols;
        variableTable = (symbols && symbols.variables || []).filter((v) => v.space);
        pinTable = stc.pins || [];

        target = f0Target;
        session = createDebugSession(target, {
            onChange: (st) => {
                if (st.halted) {
                    if (shouldSkip(st)) { skipped++; skipRequested = true; return; }
                    glow(st.tasks);
                    trace.record(target, st.why ? st.why.cause : 'halt',
                        { variables: runner.variables(), tasks: st.tasks });
                } else clearGlow();
                emit();
            }
        });

        setStatus('ready', S('built.device', {bytes: built.bytes, device: 'STM32F030', points: blockOf.size}));
        return session;
    }

    /** ESP8266 — bw-board's `esp8266` kind over the esp8266js fork. The
     *  program is the compiler's flash image in BYTES (0xE9 header); the
     *  factory loads the engine lazily, attaches the board and returns a
     *  debug target that runs, pauses, steps and takes code breakpoints.
     *  No symbol table comes back from this target, so block glow has no
     *  (task, state) addresses to join: the board and serial are the
     *  surface. */
    async function attachEsp8266Target(built) {
        setStatus('attaching', S('attach.esp8266'));
        const { createDebugTarget, createDebugSession, BoardImpl, inferNetlist } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');

        const declared = projectStc(null);
        const stc = {...(declared || {}), pins: (declared && declared.pins) || []};

        const netlist = await resolveNetlist(vm, stc, inferNetlist);
        board = new BoardImpl(3.3);
        board.setNetlist(netlist.parts, netlist.nets);
        board.setPower(true);
        if (vm && vm.runtime) vm.runtime.bwRunBoard = board;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));

        const image = built.image instanceof Uint8Array ? built.image : null;
        if (!image) throw new Error('the ESP8266 build produced no flash image');

        const { target: espTarget, adapter: espAdapter } = await createDebugTarget('esp8266', { board, image });

        if (espAdapter && espAdapter.onSerial) {
            let lineBuf = '';
            serialLines = [];
            espAdapter.onSerial((byte) => {
                const ch = String.fromCharCode(byte);
                if (ch === '\n') {
                    serialLines.push(lineBuf);
                    lineBuf = '';
                    if (serialLines.length > 200) serialLines.shift();
                } else if (ch !== '\r') {
                    lineBuf += ch;
                }
            });
        }
        // RX: the adapter takes a byte or a byte list (a typed line arrives
        // as a string, the SerialConsole sends single keycodes as numbers).
        if (espAdapter && espAdapter.sendSerial) {
            runner.sendSerial = (data) => {
                if (typeof data === 'number') {
                    espAdapter.sendSerial(data & 0xff);
                    return;
                }
                espAdapter.sendSerial(Array.from(String(data), ch => ch.charCodeAt(0) & 0xff));
            };
        }

        setValueResolver((blockId) => runner.valuesAtBlock(blockId));
        if (vm && vm.runtime) vm.runtime._bwDebugVariables = () => runner.variables();
        symbols = built.symbols || null;
        variableTable = (symbols && symbols.variables || []).filter((v) => v.space);
        pinTable = stc.pins || [];

        target = espTarget;
        session = createDebugSession(target, {
            onChange: (st) => {
                if (st.halted) {
                    if (shouldSkip(st)) { skipped++; skipRequested = true; return; }
                    glow(st.tasks);
                    trace.record(target, st.why ? st.why.cause : 'halt',
                        { variables: runner.variables(), tasks: st.tasks });
                } else clearGlow();
                emit();
            }
        });

        setStatus('ready', S('built.device', {bytes: built.bytes, device: 'ESP8266', points: blockOf.size}));
        return session;
    }

    /** The extractors publish {regions, chips|ports} but no clock — the
     *  machines require one (M6502Machine/Z80Machine read config.clockHz
     *  with no default). 1 MHz / 4 MHz are the canonical bench clocks. */
    const benchConfig6502 = () => ({ clockHz: 1_000_000, chips: [], ...machineConfig });
    const benchConfigZ80 = () => ({ clockHz: 4_000_000, ...machineConfig });
    // 4.772727 MHz is not a round number by accident: the IBM XT divided a
    // 14.31818 MHz colour-burst crystal by three, and the BIOS's 18.2 Hz tick
    // is that clock through the 8254's 65536 divisor. A tidy 5 MHz here would
    // leave every timing loop in a period-correct ROM running 4.8% fast.
    const benchConfigI8086 = () => ({ clockHz: 4_772_727, chips: [], ...machineConfig });

    /** Boot media as {bytes, origin}: Intel HEX text (file picker accepts
     *  .hex/.ihx and hands over raw file bytes) is parsed; binaries pass
     *  through with no origin, so the machine's own ROM base applies. */
    async function resolveMediaImage(media) {
        const bytes = media.bytes;
        if (bytes.length > 1 && bytes[0] === 0x3a) { // ':' — Intel HEX text
            const { parseIhex } = await import(
                /* webpackChunkName: "bw-board" */ 'bw-board/machine-media.js');
            const parsed = parseIhex(new TextDecoder().decode(bytes));
            return { bytes: parsed.bytes, origin: parsed.origin };
        }
        return { bytes, origin: null };
    }

    /** Shared wiring for the machine benches: serial face, session,
     *  keyboard input, video face (when the machine's chips include one),
     *  and a hot loadRom for media applied to a live machine. */
    function wireMachineBench(result, createDebugSession) {
        cancelCp2Recording();
        if (unsubscribeCp1Lessons) unsubscribeCp1Lessons();
        unsubscribeCp1Lessons = null;
        cp1LessonBatch?.clear();
        cp1LessonBatch = null;
        target = result.target;
        const adapter = result.adapter || result;
        if (target.kind === 'cp1' && typeof target.onEvent === 'function') {
            cp1LessonBatch = createCp1LessonBatch(machineConfig?.partId);
            unsubscribeCp1Lessons = target.onEvent(event => cp1LessonBatch.accept(event));
        }

        // THE ONLY PATH FROM THE PANEL TO A CHIP, and deliberately the collector
        // rather than the chips. chipRefusals() finds any field whose NAME says
        // it records a refusal, so a chip added to the board later reaches the
        // panel with no edit here or there. Reaching into adapter.machine.chips
        // would work today and would quietly stop being the whole story.
        // AN EXPLICIT COLLECTOR WINS OVER THE ADAPTER'S MACHINE, because one
        // bench has no adapter on purpose. The DOS bench passes `adapter: {}` —
        // deliberately, so wireMachineBench cannot offer a loadRom that writes
        // into the wrong place — and its machine is reachable only on the bench
        // object. Looking solely at adapter.machine therefore reported "this
        // bench has no collector" for the one bench most programs actually run
        // on, while it had three chips and a working ledger the whole time.
        // Found by the panel's own state attribute reading 'none' in CI.
        chipRefusalsOf = typeof result.chipRefusals === 'function' ? result.chipRefusals
            : typeof adapter.machine?.chipRefusals === 'function'
                ? () => adapter.machine.chipRefusals()
                : null;

        if (adapter.onSerial) {
            // LINE-buffer the byte stream: one array entry per byte rendered
            // "B\nB\nC\n…" in the console. CR is display noise; LF ends a line.
            adapter.onSerial((byte) => {
                if (terminalOutput) terminalOutput.push(byte);
                const ch = String.fromCharCode(byte & 0x7f);
                if (serialTerminal) {
                    // ESC [ params final — swallowed whole (the final byte is
                    // @..~). A lone ESC followed by anything else drops both.
                    if (serialEsc === 1) { serialEsc = ch === '[' ? 2 : 0; return; }
                    if (serialEsc === 2) { if (byte >= 0x40 && byte <= 0x7e) serialEsc = 0; return; }
                    if (byte === 0x1b) { serialEsc = 1; return; }
                    if (byte === 0x08 || byte === 0x7f) {
                        if (serialLines.length) {
                            const last = serialLines.length - 1;
                            serialLines[last] = serialLines[last].slice(0, -1);
                        }
                        return;
                    }
                    if (byte === 0x07) return;          // BEL
                }
                if (ch === '\r') return;
                if (ch === '\n' || serialLines.length === 0) serialLines.push('');
                if (ch !== '\n') serialLines[serialLines.length - 1] += ch;
                if (serialLines.length > 500) serialLines.splice(0, serialLines.length - 500);
            });
        }

        let benchHalted = false;
        session = createDebugSession(target, {
            // Bound the 8086's work inside one browser callback. The session
            // carries unspent PROGRAM time forward, so this protects input and
            // paint latency without changing timer/wait semantics.
            ...(targetKind === 'i8086' ? {wallBudgetMs: 8, maxQuantumNs: 1_000_000,
                ...(bootMedia?.dosFastStart ? {speed: 16} : {})} : {}),
            // createDebugSession reports through onChange ONLY. This bench
            // once passed onHalt/onRun, which the session never calls: a
            // breakpoint hit halted the target and stopped the pump, but no
            // snapshot was published, so the panel kept saying "running" until
            // some unrelated click re-rendered it. Publish on the transition.
            onChange: (st) => {
                if (st.halted && !benchHalted) {
                    benchHalted = true;
                    recordNativeHaltOccurrence(st.why);
                    const pc = Number(target.regs?.()?.pc);
                    setStatus('paused', Number.isSafeInteger(pc)
                        ? S('run.pc', {pc: pc.toString(16).padStart(4, '0')}) : '');
                } else if (!st.halted && benchHalted) {
                    benchHalted = false;
                    setStatus('running');
                } else emit();
            },
        });

        // RX into the machine. Accepts a STRING (a typed line) or a single
        // BYTE — bw-circuit-ui's SerialConsole calls its sendSerialFn one
        // keycode at a time, and a number reaching the string branch used to
        // send nothing at all (`(5).length` is undefined, the loop never runs,
        // no error). Same producer/consumer shape mismatch this codebase keeps
        // paying for, so both shapes are honoured rather than assumed.
        runner.sendSerial = (data) => {
            if (!adapter.sendSerial) return;
            if (typeof data === 'number') {
                const byte = data & 0xff;
                return applyI8086Input('i8086.serial', {byte}, () => adapter.sendSerial(byte));
            }
            const text = String(data);
            for (let i = 0; i < text.length; i++) {
                const byte = text.charCodeAt(i) & 0xff;
                if (applyI8086Input('i8086.serial', {byte}, () => adapter.sendSerial(byte)) === false) {
                    return false;
                }
            }
            return true;
        };

        // Diagnosis hook, same stance as window.__activeBoard: production
        // incidents get measured, not guessed at. The bench target carries
        // regs/readMem/video — everything a probe needs to say what the
        // machine is actually doing.
        if (typeof window !== 'undefined') window.__benchTarget = target;

        // Video face: lazy — the VDP chip may not initialise until after ROM
        // injection boots the machine. A static check at build time deleted
        // runner.video before the ROM ever ran, keeping VdpScreen dark
        // (root-caused 2026-08-17). The getter re-evaluates on every frame
        // so the component mounts as soon as target.video() returns a
        // framebuffer. Only exposed when the target declares a video method
        // at all — serial-only machines (no VDP) shouldn't show NO SIGNAL.
        if (target && typeof target.video === 'function') {
            runner.video = () => target.video();
        } else {
            delete runner.video;
        }

        // Audio face, on the same terms as the video one: exposed only when the
        // TARGET has one, so a machine with no sound chip never gets a speaker.
        // audio() returns an array of {hz, on} voices (beeper / PC speaker / PSG)
        // that the Widgets-pane speaker plays through Web Audio (design §4.5).
        if (target && typeof target.audio === 'function') {
            runner.audio = () => target.audio();
        } else {
            delete runner.audio;
        }

        // Keyboard face, on the same terms as the video one and for the same
        // reason: exposed only when the TARGET says the machine can take a
        // key. `capabilities().keys` reports ['scancode'] when there is a PPI
        // to latch it and a PIC to raise IRQ1 on, and [] otherwise — so a
        // board with no keyboard hardware never gets a keyboard widget, and a
        // user never types into something that cannot hear them. That is the
        // failure this guards: a key swallowed silently looks exactly like a
        // program ignoring input.
        const caps = target && typeof target.capabilities === 'function' ? target.capabilities() : null;
        if (target && typeof target.keyIn === 'function'
            && caps && Array.isArray(caps.keys) && caps.keys.includes('scancode')) {
            runner.keyIn = (scancode) => {
                const byte = scancode & 0xff;
                return applyI8086Input('i8086.key', {scancode: byte}, () => target.keyIn(byte));
            };
        } else {
            delete runner.keyIn;
        }

        // THE WORLD, not just the keyboard. `capabilities().inputs` lists the
        // switch and sensor points a machine actually has -- the 8255's ports,
        // where a breadboard hangs its switches -- and is EMPTY when there is
        // no such hardware. Exposed on the same terms as video and keyIn, so a
        // switch control appears exactly when something can read it.
        //
        // A control that does nothing is indistinguishable from a program
        // ignoring the user, which is why this is gated rather than always
        // present. `inputs` is also the list a code block needs: "set switch 3
        // on" has to know which switches exist before it can refuse a
        // fourth one by name.
        if (target && typeof target.setInput === 'function'
            && caps && Array.isArray(caps.inputs) && caps.inputs.length) {
            runner.inputs = caps.inputs;
            runner.setInput = (chip, port, bit, level) => {
                const value = level ? 1 : 0;
                return applyI8086Input('i8086.gpio', {chip, port, bit, level: value},
                    () => target.setInput(chip, port, bit, value));
            };
        } else {
            delete runner.inputs;
            delete runner.setInput;
        }

        // WHAT THE PORTS ARE DOING, asked per frame rather than captured.
        // `capabilities().outputs` is the shape and does not change;
        // `target.outputs()` is the state and changes every instruction, so
        // this is exposed as a FUNCTION. Half the corpus's device programs --
        // traffic lights, a stepper, a bargraph -- produce no screen output at
        // all, and were invisible while working perfectly.
        if (target && typeof target.outputs === 'function'
            && caps && Array.isArray(caps.outputs) && caps.outputs.length) {
            runner.outputs = () => target.outputs();
        } else {
            delete runner.outputs;
        }

        // Media applied to a LIVE machine (loader while running). A boot
        // image should arrive via bootMedia instead — recreating the
        // runner is what makes the reset vector come from the real bytes.
        runner.loadRom = (bytes, at) => {
            const image = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            if (targetKind === 'i8086' && typeof target?.applyReplayInput === 'function') {
                return applyI8086Input('i8086.rom', {bytes: image, at},
                    () => target.applyReplayInput({producer: 'i8086.rom', payload: {bytes: image, at}}).accepted);
            }
            if (target?.kind === 'cp1') {
                // A new ROM ends the old observation/step lifetime. Pause the
                // session before resetting its target so an armed step cannot
                // survive as stale UI intent or publish an old lesson event.
                cancelCp2Recording();
                target.machine.stopCassette?.();
                cp1LessonBatch?.clear();
                session.pause();
                unschedule();
                target.releaseKeys();
            }
            const load = adapter.loadRom || adapter.load;
            if (load) load.call(adapter, image, at);
            if (target && target.reset) target.reset();
            if (target?.kind === 'cp1') setStatus('paused');
        };

        if (targetKind === 'i8086' && typeof target.nmi === 'function') {
            runner.nmi = () => applyI8086Input('i8086.nmi', {}, () => target.nmi());
        } else {
            delete runner.nmi;
        }

        return adapter;
    }

    // The designer's own board, when it holds real parts: machine boots
    // attach it so VIA/port edges (chip-qualified pin ids, engine
    // 26efcbd5c) light whatever the bench wires to them — the Eater
    // build's HD44780 above all. No board, or an empty one, keeps the
    // proven board-less stub: never boot against a phantom.
    function designerBoard() {
        const b = vm && vm.runtime && vm.runtime.circuitBoard;
        let board = null;
        let why = 'no designer board';
        if (b && typeof b.setPin === 'function' && typeof b.advanceTo === 'function') {
            try {
                const parts = typeof b.getParts === 'function' ? b.getParts() : b.parts;
                if (parts && parts.length) {
                    board = b;
                    why = `designer board attached (${parts.length} parts)`;
                } else {
                    why = 'designer board empty';
                }
            } catch (e) {
                why = `designer board unreadable: ${e && e.message}`;
            }
        }
        // Truth hook: the decision is invisible from outside otherwise —
        // probes and bug reports read this instead of guessing.
        if (typeof window !== 'undefined') window.__bwMachineBoard = { why, board };
        return { board, why };
    }

    // ── 6502 machine bench ──────────────────────────────────────────────
    async function attachCardiac() {
        const {createDebugTarget, createDebugSession} =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');
        const selected = machineConfig?.partId ? designerBoard().board : null;
        if (machineConfig?.partId && !selected) throw new Error('The CARDIAC circuit is not ready. Open the circuit and try again.');
        if (selected) board = selected;
        const result = await createDebugTarget('cardiac', {
            ...(selected ? {board: selected, partId: machineConfig.partId} : {}),
            ...(!selected && machineConfig?.program ? {program: machineConfig.program} : {})
        });
        wireMachineBench(result, createDebugSession);
        // The circuit may already have executed. The first session start must
        // adopt that state, including queued cards, rather than reset it.
        cardiacInitialSnapshot = selected ? target.snapshot() : null;
        delete runner.sendSerial;
        setStatus('ready', 'CARDIAC · decimal instruction stepping');
        return session;
    }

    // 6502 media uses its library map, the extracted circuit, or the
    // preset's default map. BASIC can use the extracted circuit when
    // the serial ACIA is at its expected address.
    async function attachCp1() {
        const media = bootMedia || await loadCp1Monitor();
        const {createDebugTarget, createDebugSession} =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');
        // Every byte is a CPU opcode, including 0x3A. Never sniff raw CP1 ROM as Intel HEX text.
        const bytes = media.bytes;
        if (!(bytes instanceof Uint8Array) || bytes.length !== 2048) {
            throw new Error('CP1 firmware must contain exactly 2048 raw bytes.');
        }
        const db = designerBoard();
        if (db.board) board = db.board;
        const options = {rom: bytes, expansion: machineConfig?.expansion === true,
            partId: machineConfig?.partId,
            clockHz: machineConfig?.clockHz || 6000000, ...(board ? {board} : {})};
        const result = await createDebugTarget('cp1', options);
        wireMachineBench(result, createDebugSession);
        delete runner.sendSerial;
        setStatus('ready', S('ready.cp1', {name: media.name || S('noun.userRom')}));
        return session;
    }

    async function attachEater6502() {
        const { createDebugTarget, createDebugSession } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');

        const targetOpts = {};
        const blink = bootMedia?.asmBlink;
        const declaredMachine = bootMedia?.machineConfig6502 || blink?.config;
        let readyMsg;
        if (bootMedia) {
            setStatus('attaching', S('boot.media', {name: bootMedia.name || S('noun.image')}));
            const img = await resolveMediaImage(bootMedia);
            targetOpts.rom = img.bytes;
            if (img.origin != null) targetOpts.romAt = img.origin;
            if (bootMedia.profile === 'py65mon') {
                targetOpts.py65mon = true;
                readyMsg = S('ready.py65mon', {name: bootMedia.name || S('noun.image')});
            } else if (bootMedia.profile === 'gpascal' && !declaredMachine) {
                targetOpts.gpascal = true;
                readyMsg = S('ready.eater', {name: bootMedia.name || 'G-Pascal'});
            } else if (declaredMachine) {
                targetOpts.config = {clockHz: 1_000_000, chips: [], ...declaredMachine};
                readyMsg = S('ready.eater', {name: bootMedia.name || S('noun.image')});
            } else if (!blink && machineConfig && (bootMedia.profile !== 'eater' ||
                (machineConfig.chips || []).some(chip => chip.kind === 'acia' && chip.at === 0x5000))) {
                targetOpts.config = benchConfig6502();
                readyMsg = S('ready.extracted', {
                    name: bootMedia.name || S('noun.image'),
                    chips: (machineConfig.chips || []).map(c => c.kind).join(', ') || S('noun.ramRom')
                });
            } else {
                readyMsg = S('ready.eater', {name: bootMedia.name || S('noun.image')});
            }
        } else if (machineConfig) {
            setStatus('attaching', S('boot.extracted6502'));
            targetOpts.config = benchConfig6502();
            readyMsg = S('ready.emptyRom');
        } else {
            setStatus('attaching', S('boot.tali'));
            const res = await fetch(new URL('static/roms/taliforth-py65mon.bin', document.baseURI).href);
            if (!res.ok) throw new Error(`Failed to load taliforth-py65mon.bin: HTTP ${res.status}`);
            targetOpts.rom = new Uint8Array(await res.arrayBuffer());
            targetOpts.py65mon = true;
            readyMsg = S('ready.tali');
        }

        const db = blink ? {board: blink.board, why: blink.board ? 'wired Blink circuit' : 'virtual Blink machine'} :
            declaredMachine ? {board: null, why: 'library machine map'} : designerBoard();
        if (db.board) {
            targetOpts.board = db.board;
            // Machine targets drive the designer's real board rather than a
            // private BoardImpl, but it is still the runner's active board.
            // Keep the shared runner.board() contract so CircuitTab can bind
            // its displays, keyboard and diagnostic hook to that instance.
            board = db.board;
        }
        readyMsg += ` — ${db.why}`;
        // THE PROVIDER BOUNDARY IS INJECTED, not imported by the factory.
        //
        // `w65c02-cycle-provider.js` used to be imported by the vendored
        // `debug-target-factory.js`, which made a vendored file reach out to
        // `../bw-debug/conditional-cycle-provider.js` — the last of three such
        // reaches. bw-board now takes an optional `providerBoundary`, so the
        // factory needs no knowledge of JSMoo and lite supplies the boundary it
        // already owns. Absent this option the factory behaves exactly as before.
        //
        // The file this imports also carries the JSMOO W65C02 REJECTION — a
        // qualification verdict about a candidate UPSTREAM NEVER EVALUATED.
        // Upstream does not need somebody else's rejection record; it needs the
        // hook. So the record stays here and the seam went up.
        const {createW65C02ProviderBoundary} =
            await import('./w65c02-cycle-provider.js');
        targetOpts.providerBoundary = createW65C02ProviderBoundary;

        const result = await createDebugTarget('eater6502', targetOpts);
        wireMachineBench(result, createDebugSession);
        if (blink && !blink.led) {
            const via = Object.values(result.adapter.machine.chips).find(chip => Number.isInteger(chip.orb));
            if (!via) throw new Error('Blink requires a 65C22 VIA');
            runner.asmBlinkValue = () => via.orb & via.ddrb & 1;
        }
        if (declaredMachine?.grayFramebuffer) {
            const spec = grayFramebufferSpec(declaredMachine.chips, declaredMachine.grayFramebuffer);
            const machine = result.adapter.machine;
            const source = machine.chips[spec.chip];
            runner.video = spec.publishAt === undefined ? createGrayFramebufferVideo(source, spec) :
                capturePublishedFramebuffer(machine, source, spec);
            const acia = machine.chips[declaredMachine.pacedConsole];
            if (typeof acia?.rdrf === 'boolean') {
                const input = createReadyGatedInput({isReady: () => serialLines.some(line => line.length),
                    send: runner.sendSerial, canAccept: () => !acia.rdrf, burst: 1});
                runner.sendSerial = data => typeof data === 'number' ? input.push(data) :
                    input.write(Uint8Array.from(String(data), ch => ch.charCodeAt(0)));
                terminalFrame = input.flush;
            } else if (spec.publishAt !== undefined) {
                delete runner.sendSerial;
            }
        }
        if (targetOpts.py65mon) runner.console6502Source = 'py65mon';
        if ((bootMedia?.profile === 'eater' && bootMedia.name === 'basic.rom') ||
            (declaredMachine && await isBundledMicrosoftBasic(targetOpts.rom))) {
            const {MS_PROFILE} = await import('bw-board/basic-machine-runner.js');
            basicStartup = createBasicStartup(MS_PROFILE.bootPrompts);
            runner.sendBasicLine = line => runner.sendSerial(microsoftBasicLine(line));
            runner.console6502Source = 'ACIA';
        }
        setStatus('ready', readyMsg);
        return session;
    }

    // ── Z80 machine bench ───────────────────────────────────────────────
    // A CP/M .COM (BBC BASIC — slot 'com' / profile 'cpm') boots over the
    // BDOS shim regardless of the wiring: the shim IS its machine. A raw
    // ROM boots the extracted config (or the default Searle map). With no
    // media at all, the default remains BBC BASIC.
    async function attachZ80() {
        cpmAutoRun = null;
        const { createDebugTarget, createDebugSession } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');

        const targetOpts = {};
        let readyMsg;
        // A machine whose profile is 'cpm-system' boots the REAL CP/M 2.2 (DRI's
        // CCP+BDOS on our MIT BIOS + a RAM-disk, an A> prompt) rather than the
        // per-.COM BDOS shim below. The boot lives in bw-board (createCpmSystem
        // via the z80 adapter's cpmSystem option); here we just fetch the two
        // redistributable ROMs and stock drive A: with BBC BASIC (+ any program
        // in the com slot).
        const isCpmSystem = bootMedia && bootMedia.profile === 'cpm-system';
        const isCom = !isCpmSystem && bootMedia && (bootMedia.slot === 'com' || bootMedia.profile === 'cpm');
        const spectrum = bootMedia?.spectrum;
        const blink = bootMedia?.asmBlink;
        if (spectrum) {
            targetOpts.config = spectrum.kind === 'zx128' ? {clockHz: 3_546_900, zx128: true}
                : {clockHz: 3_500_000, regions: [{kind: 'rom', start: 0, end: 0x3fff}], ula: true};
            readyMsg = bootMedia.name;
        } else if (isCpmSystem) {
            setStatus('attaching', S('cpm-system.booting'));
            const fetchRom = async (p) => {
                const r = await fetch(new URL(p, document.baseURI).href);
                if (!r.ok) throw new Error(`Failed to load ${p}: HTTP ${r.status}`);
                return new Uint8Array(await r.arrayBuffer());
            };
            const vdpConsole = bootMedia.machinePreset === 'CPM64K_TMS9918';
            const [ccpBdos, bios] = await Promise.all([
                fetchRom('static/roms/cpm22-64k.bin'),
                fetchRom(vdpConsole ? 'static/roms/cpm-bios-vdp.bin' : 'static/roms/cpm-bios.bin')
            ]);
            if (vdpConsole) {
                const {CPM64K} = await import('bw-board/z80-machine.js');
                targetOpts.config = {...CPM64K,
                    ports: [...CPM64K.ports, {kind: 'vdp', name: 'vdp1', at: 0x98}]};
            }
            const files = {...bootMedia.cpmFiles};
            const bbc = await fetchRom('static/roms/bbcbasic.com').catch(() => null);
            if (bbc) files['BBCBASIC.COM'] = bbc;
            if (bootMedia.bytes || bootMedia.url) {
                // 8.3, uppercase, no path — CP/M's own name shape. The
                // derivation lives in cpm-z80.js beside the FCB reader that has
                // to match it; doing it inline here produced `CPM2.2LI.COM`
                // from the title "CP/M 2.2 live" — two dots, rejected by the
                // boot, and the machine never started.
                files[cpmFileName(bootMedia.name)] = (await resolveMediaImage(bootMedia)).bytes;
            }
            targetOpts.cpmSystem = { ccpBdos, bios, files };
            cpmAutoRun = bootMedia.cpmLaunch || null;
            readyMsg = S('cpm-system.ready') +
                (files['BBCBASIC.COM'] ? S('cpm-system.ready.bbcbasic') : '');
        } else if (isCom) {
            setStatus('attaching', S('boot.cpmShim', {name: bootMedia.name || S('noun.com')}));
            targetOpts.cpm = { com: (await resolveMediaImage(bootMedia)).bytes };
            readyMsg = S('ready.cpmShim', {name: bootMedia.name || S('noun.cpmProgram')});
        } else if (bootMedia) {
            setStatus('attaching', S('boot.media', {name: bootMedia.name || S('noun.rom')}));
            const img = await resolveMediaImage(bootMedia);
            targetOpts.rom = img.bytes;
            if (img.origin != null) targetOpts.romAt = img.origin;
            if (blink) {
                const {SEARLE} = await import('bw-board/z80-machine.js');
                targetOpts.config = blink.config || {...SEARLE,
                    ports: [...SEARLE.ports, {kind: 'latch', name: 'blink', at: 1}]};
            } else if (machineConfig) targetOpts.config = benchConfigZ80();
            readyMsg = S('ready.romOnMap', {
                name: bootMedia.name || S('noun.rom'),
                map: S(machineConfig ? 'map.extracted' : 'map.searle')
            });
        } else if (machineConfig) {
            setStatus('attaching', S('boot.extractedZ80'));
            targetOpts.config = benchConfigZ80();
            readyMsg = S('ready.emptyRom');
        } else {
            setStatus('attaching', S('boot.bbcbasic'));
            const res = await fetch(new URL('static/roms/bbcbasic.com', document.baseURI).href);
            if (!res.ok) throw new Error(`Failed to load bbcbasic.com: HTTP ${res.status}`);
            targetOpts.cpm = { com: new Uint8Array(await res.arrayBuffer()) };
            readyMsg = S('ready.bbcbasic');
        }

        const db = blink ? {board: blink.board, why: blink.board ? 'wired Blink circuit' : 'virtual Blink machine'} :
            designerBoard();
        if (db.board) {
            targetOpts.board = db.board;
            board = db.board;
        }
        readyMsg += ` — ${db.why}`;
        // The latch emits pin edges even with no external circuit. Its value
        // is read directly by the virtual indicator.
        if (blink && !targetOpts.board) targetOpts.board = {advanceTo () {}, setPin () {}};
        const result = await createDebugTarget('z80', targetOpts);
        if (spectrum) {
            const {applyMedia} = await import('bw-board/machine-media.js');
            const {errors} = applyMedia(result, spectrum.entries, {kind: spectrum.kind});
            if (errors.length) throw new Error(errors.map(({slot, error}) => `${slot}: ${error}`).join(', '));
        }
        wireMachineBench(result, createDebugSession);
        if (blink) {
            const port = targetOpts.config.ports.find(device => device.kind === 'latch' && device.at === 1);
            const latch = result.adapter.machine.chips[port.name];
            runner.asmBlinkValue = () => latch.value & 1;
        }
        if (spectrum) runner.setSpectrumKeys = names => result.target.setKeys(names);
        setStatus('ready', readyMsg);
        return session;
    }

    // The RISC-V RV32IMA console bench. bw-board's createDebugTarget('riscv32',
    // {image, config}) builds a RiscV32Machine (RV32IMA + CLINT + PLIC + UART);
    // its ecall/UART output reaches the serial console through the adapter, the
    // way the z80 bench's does. There is no in-browser linker/compile route yet,
    // so it boots one of a set of pre-linked images (see ./riscv-programs.js):
    // a clang "Hello", and two real RTOSes — FreeRTOS and RT-Thread Nano — that
    // boot and multitask preemptively on the emulated SoC. The default is a real
    // FreeRTOS so the console shows an OS running, not just a hello. A preset can
    // pick another via `bootMedia.riscvProgram`. `config.ecallTraps` selects the
    // machine's ECALL semantics per image (FreeRTOS yields via ecall; RT-Thread
    // does not).
    async function attachRiscV32() {
        const [{ createDebugTarget, createDebugSession }, { riscvProgram, DEFAULT_RISCV_PROGRAM }] =
            await Promise.all([
                import(/* webpackChunkName: "bw-board" */ 'bw-board'),
                import(/* webpackChunkName: "bw-debug-riscv" */ './riscv-programs.js')
            ]);
        // A program the learner assembled IN THE CODE TAB takes priority over the
        // shipped set: the local RV32IM assembler (bw-asm) hands debug-panel a
        // `riscvImage` ({entry, segments}) on bootMedia, and it boots on the same
        // core, through the same ECALL console. Absent that, boot one of the
        // pre-linked images (the default FreeRTOS, or bootMedia.riscvProgram).
        let image, ecallTraps, label;
        if (bootMedia && bootMedia.riscvImage) {
            image = bootMedia.riscvImage;
            ecallTraps = bootMedia.riscvEcallTraps ?? false;
            label = bootMedia.name || 'your program';
        } else {
            const prog = riscvProgram((bootMedia && bootMedia.riscvProgram) || DEFAULT_RISCV_PROGRAM);
            image = { entry: prog.entry, segments: prog.segments };
            ecallTraps = prog.ecallTraps;
            label = prog.label;
        }
        setStatus('attaching', S('boot.riscv', {label}));
        const result = await createDebugTarget('riscv32', { image, config: { ecallTraps } });
        wireMachineBench(result, createDebugSession);
        setStatus('ready', S('ready.riscv', {label}));
        return session;
    }

    // LINUX ON RISC-V — the Machine Manager's lesson. bootMedia.bytes is the
    // kernel Image and bootMedia.linuxInitrd the initramfs, both fetched from
    // brickwright-media-lab and sha256-checked by activateConfig before they
    // got here (a mismatch is refused there, by slot name, and never boots).
    // bw-board's `linux` option builds the 64 MiB virt-style machine, hands off
    // like firmware, and time-slices each frame: a busy boot runs up to ~10 ms
    // of wall per frame, an idle shell only as long as the kernel has work. The
    // serial console becomes a terminal (backspace, ANSI) and its input line
    // feeds the 16550A, which is where the shell reads. Progress is read off
    // the target every frame and written to the status line.
    async function attachRiscV32Linux() {
        const { createDebugTarget, createDebugSession } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');
        const kernel = bootMedia.bytes;
        if (!(kernel instanceof Uint8Array) || !kernel.length) throw new Error(S('linux.noKernel'));
        const initrd = bootMedia.linuxInitrd || undefined;
        // THE LESSON'S DEFAULT RUN OPENS AT THE PROMPT: bw-board restores the
        // post-boot snapshot on top of these exact kernel + initramfs bytes
        // (it refuses a snapshot of other media by name, code snapshot-*).
        // A refusal is not the end of the lesson: it boots from scratch and
        // says why. "Boot from scratch" sends no snapshot at all.
        const snapshot = bootMedia.linuxSnapshot instanceof Uint8Array && bootMedia.linuxSnapshot.length
            ? bootMedia.linuxSnapshot : null;
        setStatus('attaching', S(snapshot ? 'linux.restoring' : 'linux.starting'));
        let result;
        try {
            result = await createDebugTarget('riscv32', {linux: {kernel, initrd, snapshot: snapshot || undefined}});
        } catch (e) {
            if (!snapshot || !/^snapshot-/.test((e && e.code) || '')) throw e;
            // eslint-disable-next-line no-console
            console.warn('[bw-debug] Linux snapshot refused, booting from scratch:', e.message);
            setStatus('attaching', S('linux.snapshotRefused', {reason: e.message}));
            result = await createDebugTarget('riscv32', {linux: {kernel, initrd}});
        }
        serialTerminal = true;
        serialEsc = 0;
        // THE CONSOLE IS A TERMINAL (linux-console.js — the same module the
        // Node test boots Linux under). Input: raw key bytes, HELD until the
        // shell is listening (bytes sent while the kernel boots are dropped:
        // the 8250 driver clears the receive FIFO at port start-up), then fed
        // to the 16550A a FIFO's worth at a time as the guest drains it.
        // Output: the raw byte stream, for the panel's terminal emulator.
        // BUILT BEFORE THE BENCH IS WIRED: a machine restored from the
        // snapshot hands its boot log (the prompt included) to the FIRST
        // serial listener, which wireMachineBench registers — terminalOutput
        // must already be there, or the terminal opens blank.
        const linuxConsole = createLinuxConsole({target: result.target, adapter: result.adapter || result});
        terminalOutput = linuxConsole.output;
        wireMachineBench(result, createDebugSession);
        runner.sendSerial = data => linuxConsole.send(data);
        runner.terminal = {
            id: linuxConsole.id,
            cols: linuxConsole.cols,
            rows: linuxConsole.rows,
            subscribe: sink => linuxConsole.output.subscribe(sink),
            send: data => linuxConsole.send(data)
        };
        let shown = '';
        terminalFrame = () => {
            const p = target && typeof target.linuxProgress === 'function' ? target.linuxProgress() : null;
            if (!p) return;
            linuxConsole.frame();
            const key = `${p.phase}:${p.percent}`;
            if (key === shown) return;
            shown = key;
            const phaseText = S(`linux.phase.${p.phase}`);
            const line = p.ready ? S('linux.ready') : S('linux.booting', {phase: phaseText, percent: p.percent});
            setStatus('running', line);
        };
        return session;
    }

    // ── 8086 machine bench ──────────────────────────────────────────────
    // TWO DIFFERENT MACHINES WEAR THIS KIND, and conflating them is the
    // failure this branch is shaped to prevent:
    //
    //   HARDWARE — a drawn board, or the BIOS ROM. Real 8259/8254/8255/CGA,
    //              interrupts through the real vector table, and the BIOS
    //              OWNS vectors 08h/09h/10h/13h/16h/19h because it installs
    //              them itself at power-on.
    //   DOS      — no hardware at all. INT 21h is answered by a service
    //              layer reached through a trap page mapped over F000.
    //
    // The trap page is the whole difference and it is not a detail: mapped
    // into the first kind it lands ON TOP OF the BIOS ROM and fights the code
    // trying to boot. `createDebugTarget('i8086')` builds a plain machine from
    // {config, rom, romAt} and adds no trap page, so this path stays hardware
    // by construction rather than by remembering to pass a flag.
    //
    // A DOS program is therefore REFUSED BY NAME below rather than started as
    // a ROM. A .COM loaded at F0000 executes nothing, and a machine that
    // executes nothing is indistinguishable on screen from one that failed to
    // start — the exact shape of failure this codebase keeps paying for.
    async function attachI8086(requestedVariant) {
        // The functional 8088 shares the 8086 instruction core.
        const variant = requestedVariant === '8088' ? '8086' : requestedVariant;
        const targetOpts = {};
        let readyMsg;
        const isDosProgram = bootMedia &&
            (bootMedia.slot === 'com' || bootMedia.slot === 'exe' || bootMedia.profile === 'dos');

        // THE DOS BENCH IS THE OTHER MACHINE, and it is now wired. This
        // branch used to be a refusal that named exactly what was missing —
        // "a .COM or .EXE needs the DOS service layer instead, which is a
        // different machine (no chips, INT 21h answered behind a trap page)
        // and is not wired to this tab yet". It is a different machine still:
        // `createI8086DosBench` builds its own, so the trap page can never
        // land on top of a BIOS that is trying to boot, and the hardware
        // branch below is untouched. What arrives here is what the ASM tab's
        // local 8086 assembler emits, and what a preset could hand over.
        if (isDosProgram) {
            setStatus('attaching', S('boot.dosBench', {name: bootMedia.name || S('noun.theProgram')}));
            // Do not import bw-board's barrel for this path. It re-exports the
            // circuit solver, device catalogue, controllers and every other
            // CPU family, while a DOS program needs only the session and its
            // deliberately small bench. Load those two independent modules in
            // parallel, after publishing the attaching state so a cold chunk
            // fetch never looks like a dead Run button.
            const [{createDebugSession}, {createI8086DosBench}] = await Promise.all([
                import(/* webpackChunkName: "bw-debug-i8086" */ 'bw-board/debug-session.js'),
                import(/* webpackChunkName: "bw-debug-i8086" */ './i8086-dos-bench.js')
            ]);
            const img = await resolveMediaImage(bootMedia);
            // The slot is authoritative when the loader named one; the MZ
            // signature decides otherwise. Guessing 'com' for an .EXE would
            // execute its header, which disassembles as garbage and looks
            // like a broken CPU rather than a misread file.
            const format = bootMedia.slot === 'disk' ? 'disk'
                : bootMedia.slot === 'exe' ? 'exe'
                    : bootMedia.slot === 'com' ? 'com'
                        : (img.bytes[0] === 0x4d && img.bytes[1] === 0x5a) ? 'exe' : 'com';
            let exited = null;
            const bench = await createI8086DosBench({
                executionSignal: i8086ExecutionLifetime.signal,
                bytes: img.bytes, format, args: bootMedia.dosArgs, variant: variant || bootMedia.dosVariant,
                files: bootMedia.dosFiles ? new Map(bootMedia.dosFiles) : undefined,
                // Hardware the program asked for. `createI8086DosBench`
                // merges these onto the preset BY NAME, so a scheduled
                // program's IRQ0-wired timer replaces the preset's plain one
                // rather than sitting beside it at the same port.
                chips: bootMedia.chips || undefined,
                // INT 21h's character output, line-buffered into the same
                // console the serial machines use. The CGA text page is the
                // primary surface (video() reads it), but a program whose
                // output has scrolled off is still readable here.
                onChar: (ch) => {
                    if (ch === '\r') return;
                    if (ch === '\n' || serialLines.length === 0) serialLines.push('');
                    if (ch !== '\n') serialLines[serialLines.length - 1] += ch;
                    if (serialLines.length > 500) serialLines.splice(0, serialLines.length - 500);
                },
                // A DOS program ENDS, unlike every other bench here, and
                // saying so is the difference between "finished" and "hung".
                onExit: (code) => {
                    exited = code;
                    setStatus('ready', S('run.exited', {code}));
                }
            });
            i8086ExecutionResult = bench;
            if (i8086ExecutionLifetime.signal.aborted) throw new Error('8086 attachment was disposed');
            // No adapter: a DOS program has no pins, no serial UART and no
            // board to drive, so there is nothing for one to bridge. Passing
            // an empty one rather than the bench object is deliberate —
            // wireMachineBench would otherwise offer a `loadRom` that writes
            // into a machine whose program is already resident.
            wireMachineBench({target: bench.target, adapter: {},
                // The one thing from the bench object that IS safe to hand over:
                // a read-only view of what its chips refused. Not the machine,
                // for the reason above.
                chipRefusals: () => bench.machine.chipRefusals()}, createDebugSession);
            // TYPING INTO A DOS PROGRAM. wireMachineBench installs a
            // sendSerial that calls adapter.sendSerial, and this bench has no
            // adapter — so without this override the console accepts what a
            // user types and drops it, which is worse than refusing: the text
            // appears in the box and the program never sees it.
            //
            // The DOS key queue IS this machine's keyboard. It has no PIC and
            // therefore no IRQ1, so the hardware scancode path cannot exist
            // here; a program blocked in INT 21h/AH=01h wakes on the next
            // service call. Both shapes are honoured for the same reason the
            // serial path honours both: SerialConsole sends one keycode at a
            // time and a typed line arrives as a string.
            runner.sendSerial = (data) => {
                bench.sendKeys(typeof data === 'number'
                    ? String.fromCharCode(data & 0xff) : String(data));
            };
            runner.i8086MediaIo = {
                serial: true,
                terminalName: 'DOS Console',
                ...(bootMedia.i8086Assembly ? {display: 'cga', dosKeyboard: true, gpio: 'A'} : {})
            };
            runner.dosScreenText = bench.screenText;
            if (exited === null) {
                setStatus('ready', S('ready.dosBench', {
                    name: bootMedia.name || S('noun.program'), format
                }));
            }
            return session;
        }

        // A BOOTABLE FLOPPY OS (ELKS, Minix, …) — the media-lab path. Unlike a
        // ROM, the image goes into the µPD765, not F0000h: the machine boots
        // the XT BIOS, sizes the disk and hands off to the OS, and the user
        // then STEERS it — video() is the CGA screen, keyIn() the keyboard. So
        // this only PREPARES the target (the PCXT config — fdc + dma + pic +
        // cga, because the default 8086 map is a bare breadboard with no disk —
        // plus the XT BIOS) and stashes the image; the SINGLE i8086 target call
        // below builds it, and the floppy + the AT drive-type quirk are applied
        // to the machine afterwards. Routing through the one call site keeps the
        // memory-preference guard's "exactly one createDebugTarget('i8086')"
        // true. (The quirk: the XT BIOS never sets the floppy DRIVE TYPE in
        // INT 13h AH=08h BL, and ELKS indexes fd_types[BL-1], so BL=0 mis-sizes
        // every sector; supplied as an opt-in onInterrupt hook, no vendored
        // change, exactly as bw-board's own ELKS scripts do it.)
        let floppyBoot = null;
        const virtualHardware = bootMedia?.i8086Hardware === 'virtual' || (!bootMedia && !machineConfig);
        if (bootMedia && (bootMedia.slot === 'floppy' || bootMedia.profile === 'floppy-os')) {
            setStatus('attaching', S('boot.media', {name: bootMedia.name || S('noun.floppy')}));
            const { PCXT8086 } =
                await import(/* webpackChunkName: "bw-board" */ 'bw-board/i8086-machine.js');
            const img = await resolveMediaImage(bootMedia);
            const res = await fetch(new URL('static/roms/i8086-bios.bin', document.baseURI).href);
            if (!res.ok) throw new Error(`Failed to load i8086-bios.bin: HTTP ${res.status}`);
            const bios = new Uint8Array(await res.arrayBuffer());
            targetOpts.config = PCXT8086;
            targetOpts.rom = bios;
            targetOpts.romAt = 0x100000 - bios.length;
            floppyBoot = { bytes: img.bytes,
                geom: bootMedia.geometry || { cylinders: 80, heads: 2, sectors: 18, bytesPerSector: 512 } };
            readyMsg = S('ready.floppyBoot', {name: bootMedia.name || S('noun.floppy')});
        }

        // Hardware machines still use the target factory. Keep its broad
        // registry out of the overwhelmingly common assembled-DOS startup.
        const { createDebugTarget, createDebugSession } =
            await import(/* webpackChunkName: "bw-board" */ 'bw-board');

        if (floppyBoot) {
            // targetOpts.config/rom/romAt and readyMsg were set above; a floppy
            // is not a ROM, so skip the ROM-as-image branches entirely.
        } else if (bootMedia) {
            setStatus('attaching', S('boot.media', {name: bootMedia.name || S('noun.rom')}));
            const img = await resolveMediaImage(bootMedia);
            targetOpts.rom = img.bytes;
            // Three sources for the load address, most specific first. Intel
            // HEX states its own origin; the Machine Loader computes one from
            // the image length so the reset vector at FFFF0h falls inside it;
            // otherwise the machine's own ROM region decides. An 8086 image
            // that is not exactly 64K and gets none of the first two starts
            // executing open bus, which on screen is indistinguishable from a
            // machine that never started.
            if (img.origin != null) targetOpts.romAt = img.origin;
            else targetOpts.romAt = bootMedia.romAt ?? (0x100000 - img.bytes.length);
            if (virtualHardware) {
                const {i8086VirtualHardware} = await import('./i8086-media-hardware.js');
                targetOpts.config = bootMedia.machineConfig8086
                    ? {clockHz: 4_772_727, chips: [], ...bootMedia.machineConfig8086}
                    : i8086VirtualHardware(bootMedia.profile);
            } else if (machineConfig) {
                targetOpts.config = benchConfigI8086();
            }
            readyMsg = S('ready.romOnMap', {
                name: bootMedia.name || S('noun.rom'),
                map: S(!virtualHardware && machineConfig ? 'map.extracted' : 'map.default8086')
            });
        } else if (machineConfig) {
            setStatus('attaching', S('boot.extracted8086'));
            targetOpts.config = benchConfigI8086();
            readyMsg = S('ready.emptyRom');
        } else {
            // The shipped BIOS is a 64K image whose RESET VECTOR is its last
            // sixteen bytes. `romAt` is the LOAD address, so it is 0xF0000 and
            // the 8086 begins at F000:FFF0 inside it. Passing 0xFFFF0 here —
            // the address of the vector rather than of the image — puts the
            // ROM 64K high, and the machine then executes open bus from the
            // first instruction while reporting that it started fine.
            setStatus('attaching', S('boot.xtBios'));
            // THIS FILENAME WAS WRONG AND NOTHING NOTICED. It read
            // `bios8086.bin`, which has never existed in static/roms, so the
            // no-media path 404ed on every run since it was written. Nothing
            // caught it because nothing REACHED it: the tests build a machine
            // directly and the Machine Loader always supplies media, so this
            // fallback is a path only a user takes. test/rom-paths-exist.test.mjs
            // now checks every static/roms string against the filesystem,
            // because what was wrong here was a STRING, and no unit test of
            // this branch would have found it -- the branch is correct.
            const res = await fetch(new URL('static/roms/i8086-bios.bin', document.baseURI).href);
            if (!res.ok) throw new Error(`Failed to load i8086-bios.bin: HTTP ${res.status}`);
            targetOpts.rom = new Uint8Array(await res.arrayBuffer());
            // 64K, so it maps at F0000h and the reset vector at FFFF0h falls in
            // its last sixteen bytes. `0x100000 - length` is the rule the
            // Machine Loader uses; it gives the same answer here and the right
            // one for the 32K demo ROMs beside it.
            targetOpts.romAt = 0x100000 - targetOpts.rom.length;
            const {PCXT8086} = await import('bw-board/i8086-machine.js');
            targetOpts.config = PCXT8086;
            // No serial console on this ROM, and saying so is the point: its
            // INT 14h is a stub and the BIOS equipment word reports no COM
            // port, because the XT config has no 8250. Output is the CGA text
            // page at B800:0000, which reaches the screen through video().
            readyMsg = S('ready.xtBios');
        }

        const db = virtualHardware || floppyBoot ? {board: null, why: 'virtual PC'} : designerBoard();
        if (typeof window !== 'undefined') window.__bwMachineBoard = db;
        if (db.board) {
            targetOpts.board = db.board;
            board = db.board;
        }
        readyMsg += ` — ${db.why}`;

        // THE MEMORY-MODE PREFERENCE IS RESOLVED HERE, not inside the vendored
        // adapter. `bw-board/i8086-adapter.js` currently does
        // `withI8086MemoryPreference(opts.config ?? BREADBOARD8086)`, which makes a
        // VENDORED file import `../bw-i8086-preferences.js` -- a reach OUT of the
        // vendored root, and one of only three in that tree. bw-board is a headless
        // emulator library; a `globalThis.localStorage` read has no business in it,
        // and this is the one of the three that needs NO upstream change at all.
        //
        // THE DEFAULT IS RESOLVED HERE ON PURPOSE. The preference AMENDS a config,
        // and there is not always one to amend: `targetOpts.config` is set on two
        // branches above and left unset on the rest, where the adapter's own
        // `?? BREADBOARD8086` supplies it. Move the call without the default and in
        // `reference` mode you pass `{...undefined, fastWords: false}` --
        // `{fastWords: false}` -- which REPLACES the breadboard map rather than
        // amending it. The machine then boots on an empty config and the failure
        // reads as a board problem.
        //
        // Idempotent, so this is safe while the adapter still applies it too: the
        // adapter's copy leaves with the next bw-board pin bump. Provider before
        // consumer, so there is no moment where the preference is unapplied.
        const {BREADBOARD8086} = await import('bw-board/i8086-machine.js');
        targetOpts.config = withI8086MemoryPreference(targetOpts.config ?? BREADBOARD8086);
        if (variant) targetOpts.config = {...targetOpts.config, variant};

        const result = await i8086Execution.construct({context: 'hardware',
            family: targetOpts.config.variant || '8086', signal: i8086ExecutionLifetime.signal},
        async () => await createDebugTarget('i8086', targetOpts));
        i8086ExecutionResult = result;
        if (i8086ExecutionLifetime.signal.aborted) throw new Error('8086 attachment was disposed');
        if (floppyBoot) {
            // The machine is built; a floppy is not a ROM, so drop the image
            // into the µPD765 and supply the AT drive-type at INT-13h entry
            // (before wireMachineBench, so video()/keyIn() bind the running
            // machine). Then the XT BIOS boots it.
            const machine = result.adapter?.machine || result.target?.machine;
            if (!machine || !machine.chips?.fdc1) {
                throw new Error('a floppy-boot OS needs the PCXT machine with a µPD765 — none was built');
            }
            const priorInt = machine.hooks.onInterrupt;
            machine.hooks.onInterrupt = (ev) => {
                if (ev.vector === 0x13 && ev.source === 'int') {
                    const c = machine.cpu;
                    if (c.ah === 0x08 && c.dl < 0x80) {
                        const g = machine.chips.fdc1?.drives?.[c.dl & 3]?.geom;
                        if (g) {
                            const cy = g.cylinders | 0, sp = g.sectors | 0;
                            c.bl = cy <= 40 ? 1 : sp >= 36 ? 5 : sp >= 18 ? 4 : sp >= 15 ? 2 : 3;
                        }
                    }
                }
                if (priorInt) priorInt(ev);
            };
            machine.chips.fdc1.insert(0, floppyBoot.bytes, floppyBoot.geom);
            machine.reset();
        }
        wireMachineBench(result, createDebugSession);
        const machine = result.adapter?.machine || result.target?.machine;
        const chips = targetOpts.config.chips || [];
        runner.i8086MediaIo = {
            display: chips.find(chip => ['cga', 'vga', 'ega', 'hercules'].includes(chip.kind))?.kind,
            serial: chips.some(chip => ['uart16550', 'acia6850', 'usart8251'].includes(chip.kind)),
            gpio: bootMedia?.profile === 'blink'
        };
        const {createPcInputQueue} = await import('../bw-machines/pc-input-queue.js');
        const pic = machine?.chips?.[chips.find(chip => chip.kind === 'pic')?.name];
        if (runner.keyIn && pic && chips.some(chip => chip.kind === 'ppi') && !targetOpts.config.a20) {
            xtKeyboard = createPcInputQueue(runner.keyIn, () => !!((pic.irr | pic.isr) & 2));
            runner.keyIn = byte => xtKeyboard.enqueue(byte);
        }
        const uart = machine?.chips?.[chips.find(chip => chip.kind === 'uart16550')?.name];
        if (uart) {
            pcSerialInput = createPcInputQueue(runner.sendSerial, () => uart.rxFifo.length > 0);
            runner.sendSerial = data => pcSerialInput.enqueue(data);
        }
        if (machine?.canTakeMouse?.()) runner.mouseIn = event => machine.mouseIn(event);
        setStatus('ready', readyMsg);
        return session;
    }

    /**
     * THE FULLY-FREE 386. The experimental 80386 AT machine, booted on ONLY
     * redistributable firmware — the LGPL Bochs legacy BIOS and the LGPL VGABios,
     * vendored as static/roms/free-386-bochs-bios.rom + free-386-vgabios-lgpl.bin
     * — with NO proprietary IBM 5170 ROM anywhere in the path. This mirrors
     * bw-board's own reproducible qualification
     * (scripts/run-i80386-free-bios-freedos.mjs): the same machine config, the
     * same two firmware images at the same load addresses, the same FreeDOS boot
     * media in the µPD765 / ATA16. What differs is only the surface — here
     * video() is the Widgets-pane screen and keyIn() steers it, exactly as the
     * i8086 floppy-OS path does, instead of the CLI's B8000 text scrape.
     *
     * Like the i8086 floppy branch, this PREPARES the config and stashes the
     * image, routes the build through the SINGLE createDebugTarget('i80386')
     * call below, then applies the firmware + floppy to the machine afterwards.
     * The firmware is a same-origin static fetch (like the XT BIOS), never a
     * network clone and never the private $AT_BIOS_ROM.
     */
    async function attachI80386() {
        if (bootMedia?.machinePreset === 'freedos-vga') {
            return attachI80386FreedosVgaProfile();
        }
        setStatus('attaching', bootMedia && bootMedia.name
            ? S('boot.free386Named', {name: bootMedia.name})
            : S('boot.free386'));

        // The 386 core + AT-device catalogue via the barrel's factory, and the
        // machine module directly for the FreeDOS-VGA config the qualification uses.
        const { createDebugTarget, createDebugSession } =
            await import(/* webpackChunkName: "bw-board-i80386" */ 'bw-board');
        const { PCAT80386_EXPERIMENTAL_4M_HDD_FREEDOS_VGA } =
            await import(/* webpackChunkName: "bw-board-i80386" */ 'bw-board/experimental/i80386-at-machine.js');

        // Vendored LGPL firmware. The Bochs legacy BIOS is a 64K image whose
        // reset vector is its last sixteen bytes; it is mapped at BOTH F0000h
        // (real-mode reset alias) and FF0000h (the AT 16M reset alias the 386
        // decoder honours). The LGPL VGABios is the C000h option ROM.
        const biosUrl = new URL('static/roms/free-386-bochs-bios.rom', document.baseURI).href;
        const vgaUrl = new URL('static/roms/free-386-vgabios-lgpl.bin', document.baseURI).href;
        const biosBoot = bootMedia?.slot === 'bios' || bootMedia?.slot === 'rom';
        const dosBios = biosBoot ? await resolveMediaImage(bootMedia) : null;
        const companionBios = bootMedia?.i80386Media?.bios;
        const companionVga = bootMedia?.i80386Media?.['vga-rom'];
        const fallback = async (url, label) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load ${label}: HTTP ${response.status}`);
            return new Uint8Array(await response.arrayBuffer());
        };
        const [bios, vga] = await Promise.all([
            dosBios?.bytes ?? companionBios ?? fallback(biosUrl, 'the free-386 BIOS'),
            companionVga ?? fallback(vgaUrl, 'the free-386 VGA BIOS')
        ]);
        const biosAddress = dosBios?.origin ?? (biosBoot ? bootMedia.romAt : null) ?? (0x100000 - bios.length);
        if (biosAddress < 0xf0000 || biosAddress + bios.length !== 0x100000 || bios.length < 16) {
            throw new Error('The 386 BIOS must fit the 64 KiB ROM window through FFFFFh.');
        }
        if (vga.length > 0xa000) throw new Error('The VGA option ROM exceeds its 40 KiB window.');

        const isFloppy = bootMedia?.slot === 'floppy' || bootMedia?.profile === 'floppy-os';
        const isHdd = ['hdd', 'disk', 'hd'].includes(bootMedia?.slot);
        if (bootMedia && !biosBoot && !isFloppy && !isHdd) {
            throw new Error('Choose a 386 BIOS, a boot floppy or a hard disk image.');
        }
        const bootImg = isFloppy || isHdd ? await resolveMediaImage(bootMedia) : null;
        const floppyGeom = bootMedia?.geometry || {cylinders: 80, heads: 2, sectors: 15, bytesPerSector: 512};

        // The FreeDOS-VGA preset carves a 32K option-ROM window at C0000h; the
        // LGPL VGABios is 38400 bytes, so widen that one region to C0000-C9FFF
        // (40K) exactly as the CLI qualification does, leaving every other
        // region untouched. functionalInstructionCycles matches the receipt.
        const base = PCAT80386_EXPERIMENTAL_4M_HDD_FREEDOS_VGA;
        const hdGeom = (bootMedia && bootMedia.geometry) ||
            { cylinders: 306, heads: 4, sectors: 17 };
        // Type-47 CMOS drive-C geometry, byte-for-byte as the CLI qualification
        // sets it, so the Bochs BIOS builds a real FDPT for drive 0 and FreeDOS
        // mounts the partition as C:. Only applied for a hard-disk boot; a
        // floppy boot instead selects the floppy and its drive density.
        const hdCmos = isHdd ? (g => [
            [0x19, 47],
            [0x1b, g.cylinders & 0xff], [0x1c, (g.cylinders >> 8) & 0xff],
            [0x1d, g.heads & 0xff],
            [0x1e, 0xff], [0x1f, 0xff],
            [0x20, g.heads > 8 ? 0xc8 : 0xc0],
            [0x21, g.cylinders & 0xff], [0x22, (g.cylinders >> 8) & 0xff],
            [0x23, g.sectors & 0xff],
            [0x39, 0x00],
        ])(hdGeom) : [];
        const config = {
            ...base,
            a20: {...base.a20, mouse: true},
            functionalInstructionCycles: 6,
            regions: [
                ...base.regions.filter(r => !(r.kind === 'rom' && r.start === 0xc0000)),
                { kind: 'rom', start: 0xc0000, end: 0xc9fff },
            ],
            chips: withI80386MouseCmos(base.chips,
                isHdd ? [[0x3d, 0x21], [0x12, 0xf0], ...hdCmos] : isFloppy ? i80386FloppyCmos(floppyGeom) : []),
        };

        const targetOpts = { config };
        if (bootMedia?.nativeBlocks === true) targetOpts.nativeBlocks = true;
        // A hard-disk boot attaches its image as the ATA16 drive at construction
        // (the adapter reads opts.ataImage/ataGeometry). A floppy is inserted
        // into the µPD765 after construction, below.
        if (isHdd) {
            targetOpts.ataImage = bootImg.bytes;
            targetOpts.ataGeometry = hdGeom;
        }
        const db = designerBoard();
        if (db.board) {
            targetOpts.board = db.board;
            board = db.board;
        }

        // THE SINGLE i80386 TARGET CALL. No ROM is passed: the firmware and any
        // floppy are applied to the live machine below, so the reset vector
        // reads real BIOS bytes on the final reset.
        const result = await createDebugTarget('i80386', targetOpts);
        i8086ExecutionResult = result;
        if (i8086ExecutionLifetime.signal.aborted) throw new Error('80386 attachment was disposed');

        const machine = result.adapter?.machine || result.target?.machine;
        if (!machine || typeof machine.loadRom !== 'function') {
            throw new Error('the free-386 needs the experimental 80386 AT machine — none was built');
        }
        // Firmware at its three aliases (F0000h, FF0000h, C0000h), before the
        // media so the BIOS is resident when the machine boots the disk.
        machine.loadRom(bios, biosAddress);
        machine.loadRom(bios, 0xf00000 + biosAddress);
        machine.loadRom(vga, 0xc0000);

        let readyMsg = S('ready.free386NoMedia');
        if (isFloppy) {
            // A bootable OS floppy (FreeDOS, …) goes into the µPD765, not a ROM
            // region. The FreeDOS-VGA fdc accepts a 1.2MB image (80/2/15); the
            // manifest may state its own geometry.
            const fdc = machine.chips && machine.chips.fdc1;
            if (!fdc || typeof fdc.insert !== 'function') {
                throw new Error('the free-386 FreeDOS floppy profile needs a µPD765 (fdc1) — none was built');
            }
            fdc.insert(0, bootImg.bytes, floppyGeom);
            readyMsg = S('ready.free386Floppy', {name: bootMedia.name || S('noun.floppy')});
        } else if (isHdd) {
            readyMsg = S('ready.free386Disk', {name: bootMedia.name || S('noun.hardDisk')});
        }
        machine.reset();

        wireMachineBench(result, createDebugSession);
        // The optional PS/2 auxiliary port is present only on this 386 AT
        // profile. Keep pointer input on the same live adapter as VGA and keys.
        if (typeof result.adapter?.mouseIn === 'function' &&
            machine.canTakeMouse?.()) {
            runner.mouseIn = event => result.adapter.mouseIn(event);
        }
        setStatus('ready', readyMsg);
        return session;
    }

    // The named board profile owns the AT/VGA/CMOS map. Keep all four media
    // slots on bw-board's loader so this browser path matches the board API.
    async function attachI80386FreedosVgaProfile() {
        const {createDebugTarget, createDebugSession, applyMedia} =
            await import(/* webpackChunkName: "bw-board-i80386" */ 'bw-board');
        const biosUrl = new URL('static/roms/free-386-bochs-bios.rom', document.baseURI).href;
        const vgaUrl = new URL('static/roms/free-386-vgabios-lgpl.bin', document.baseURI).href;
        const fallback = async (url, label) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load ${label}: HTTP ${response.status}`);
            return new Uint8Array(await response.arrayBuffer());
        };
        const entries = {...bootMedia.i80386Media};
        entries.bios ||= await fallback(biosUrl, 'the free-386 BIOS');
        entries['vga-rom'] ||= await fallback(vgaUrl, 'the free-386 VGABios');
        if (bootMedia?.slot === 'hdd' || bootMedia?.slot === 'floppy') {
            entries[bootMedia.slot] = (await resolveMediaImage(bootMedia)).bytes;
        } else if (bootMedia?.slot) {
            throw new Error(`the FreeDOS VGA profile cannot boot ${bootMedia.slot} media`);
        }
        const targetOpts = {profile: 'freedos-vga'};
        if (bootMedia?.nativeBlocks === true) targetOpts.nativeBlocks = true;
        const db = designerBoard();
        if (db.board) { targetOpts.board = db.board; board = db.board; }
        const result = await createDebugTarget('i80386', targetOpts);
        i8086ExecutionResult = result;
        if (i8086ExecutionLifetime.signal.aborted) throw new Error('80386 attachment was disposed');
        const machine = result.adapter?.machine;
        if (!machine) throw new Error('the FreeDOS VGA profile did not build an AT machine');
        const applied = applyMedia({kind: 'i80386', adapter: result.adapter, machine}, entries);
        if (applied.errors.length) {
            throw new Error(applied.errors.map(item => `${item.slot}: ${item.error}`).join('; '));
        }
        machine.reset();
        wireMachineBench(result, createDebugSession);
        if (typeof result.adapter?.mouseIn === 'function' && machine.canTakeMouse?.()) {
            runner.mouseIn = event => result.adapter.mouseIn(event);
        }
        const name = bootMedia.name || S('noun.floppy');
        const readyMsg = bootMedia.slot === 'floppy'
            ? S('ready.free386Floppy', {name})
            : S('ready.free386Disk', {name});
        setStatus('ready', readyMsg);
        return session;
    }

    /**
     * Should this halt be swallowed?
     *
     * Only for a breakpoint hit on a block carrying a condition that evaluates
     * false. Everything else — a step, a pause, an unconditional breakpoint, a
     * condition that will not parse — stops. Erring towards stopping is
     * deliberate: a pause point that silently never fires looks exactly like a
     * broken debugger, while one that fires too often is merely annoying and
     * is visibly the user's own condition.
     */
    function shouldSkip(st) {
        const why = st.why;
        if (!why || why.cause !== 'breakpoint' || why.bp === undefined) return false;

        // A yield breakpoint is a code address at a `case` label, and the
        // scheduler re-enters that label on EVERY pass of the dispatch loop
        // while the task sits in it. A pause point on a `wait 0.3 seconds`
        // therefore fires thousands of times during that one wait — measured
        // at 1749 hits before this — so "resume" appears to do nothing and a
        // condition never gets the chance to become true.
        //
        // The task itself already knows the difference: while it is waiting,
        // `<task>_until` is in the future, and the C's own test is a
        // wraparound-safe 16-bit compare. Reuse it. One stop per visit, on the
        // pass where the wait is over — which is also the moment the user means
        // by "pause here".
        const blockId = [...bps].find(([, handle]) => handle === why.bp)?.[0];

        if (stillWaiting(why, blockId)) return true;

        if (!blockId) return false;
        const source = conditionOf(blockId);
        if (!source) return false;
        const parsed = parseCondition(source);
        if (parsed.error) return false;          // reported in the snapshot, and it stops
        const vars = Object.fromEntries(runner.variables().map((v) => [v.name, v.value]));
        try {
            return !parsed.test(vars);
        } catch {
            return false;                        // never let a condition trap the debugger
        }
    }

    /**
     * Is the task we stopped in still counting down a wait?
     *
     * Mirrors the generated C exactly: `(int)(bw_now() - <task>_until) < 0`,
     * a 16-bit wraparound-safe compare. A task with no deadline (`until`
     * absent, which is how the target reports a task that is not waiting or
     * has finished) is never "still waiting".
     */
    function stillWaiting(why, blockId) {
        if (!target || typeof target.bwMs !== 'function') return false;
        return waitStillPending({
            why,
            blockYield: blockId ? yieldOf.get(blockId) : undefined,
            bwMs: target.bwMs()
        });
    }

    // ─── the frame loop ──────────────────────────────────────────────────

    function pumpFrame() {
        rafId = null;
        if (!session || destroyed) return;
        if (activeRunTo) {
            const result = runToController.pump();
            if (board) board.advanceTo(target.timeNs() + boardBaseNs);
            if (result.accepted && result.reason === 'running') {
                schedule();
                emitLive();
                return;
            }
            activeRunTo = null;
            setStatus('paused', result.accepted
                ? S('run.reached', {address: result.address.toString(16)})
                : result.reason);
            return;
        }
        // Opt-in production-bundle telemetry for the browser/mobile benchmark.
        // The global is absent in normal use, so this is one property read and
        // no allocation on the regular pump path.
        const perfProbe = typeof window !== 'undefined' ? window.__BW_I8086_PERF__ : null;
        const perfWallStart = perfProbe ? performance.now() : 0;
        const perfSimStart = perfProbe ? target.timeNs() : 0n;
        xtKeyboard?.pump();
        pcSerialInput?.pump();
        let outcome = session.pump();
        if (outcome === 'ran') {
            const lastLine = serialLines.at(-1);
            basicStartup?.answer(lastLine, runner.sendSerial);
            if (cpmAutoRun && lastLine === 'A>') {
                const command = cpmAutoRun;
                cpmAutoRun = null;
                runner.sendSerial(`${command}\r`);
            }
        }
        if (cp1RunKeyUntil !== null && (target.timeNs() >= cp1RunKeyUntil || outcome !== 'ran')) {
            releaseCp1RunKey();
        }
        if (terminalFrame) terminalFrame();

        // Absorb skipped hits in this frame rather than one per frame. Bounded,
        // because a pause point inside a tight loop with a condition that never
        // becomes true would otherwise never hand the browser back: at the cap
        // we simply return and try again next frame, which is slow but alive.
        for (let n = 0; skipRequested && n < SKIP_BUDGET; n++) {
            skipRequested = false;
            session.resume();
            outcome = session.pump();
        }
        if (skipRequested) { skipRequested = false; session.resume(); schedule(); return; }
        const perfRunEnd = perfProbe ? performance.now() : 0;
        // Boundary A's clock. The emulator pushes PIN CHANGES to the board by
        // itself (emu_set_board_callbacks), but nothing pushes TIME: the debug
        // run path never calls on_advance, and the board integrates time to get
        // LED brightness and buzzer frequency. Without this the pins toggle
        // correctly and the LED never changes, which looks like a dead board.
        //
        // Doing it HERE, only when the pump actually ran, is also what makes
        // DEBUG-CONTROL-MODEL §3.1 fall out for free: a halted MCU stops
        // pumping, so board time stops with program time, and resume continues
        // from where it stopped rather than catching up on wall-clock.
        if (board && outcome !== 'idle') board.advanceTo(target.timeNs() + boardBaseNs);
        const perfBoardEnd = perfProbe ? performance.now() : 0;
        // Keep going while there is anything to do. A halted session stops
        // asking for frames entirely, which is what makes a paused program cost
        // nothing rather than spin.
        if (outcome === 'ran') schedule();
        const perfSnapshotBefore = perfProbe ? snapshotEmitter.stats() : null;
        emitLive();
        if (perfProbe && perfProbe.samples.length < (perfProbe.limit || 4000)) {
            // Measure THROUGH snapshot publication. The old receipt stopped
            // before emitLive(), exactly where the allocations and React
            // handoff under investigation begin, so its pump time could not
            // explain its own long-task count.
            const perfWallEnd = performance.now();
            const perfSnapshotAfter = snapshotEmitter.stats();
            const perfSimEnd = target.timeNs();
            perfProbe.samples.push({
                at: perfWallStart,
                wallMs: perfWallEnd - perfWallStart,
                simNs: Number(perfSimEnd - perfSimStart),
                outcome,
                phases: {
                    runMs: perfRunEnd - perfWallStart,
                    boardMs: perfBoardEnd - perfRunEnd,
                    publishMs: perfWallEnd - perfBoardEnd
                },
                snapshotBuilt: perfSnapshotAfter.emitted > perfSnapshotBefore.emitted,
                snapshotBuildMs: perfSnapshotAfter.snapshotBuildMs - perfSnapshotBefore.snapshotBuildMs
            });
        }
    }

    function schedule() {
        if (destroyed) return;
        if (rafId === null && typeof requestAnimationFrame === 'function') {
            rafId = requestAnimationFrame(pumpFrame);
        }
    }

    function releaseCp1RunKey() {
        if (cp1RunKeyUntil === null) return;
        cp1RunKeyUntil = null;
        target?.releaseKeys?.();
    }

    function unschedule() {
        releaseCp1RunKey();
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }

    // ─── the verbs ───────────────────────────────────────────────────────

    // ── arbitrary firmware ───────────────────────────────────────────
    // A user-supplied image replaces the compile step entirely: the
    // emulator runs THEIR bytes. No symbol table exists, so block glow,
    // yield breakpoints and the variables view honestly disappear —
    // run/pause/step-insn, pins, board and serial all still work.
    let userFirmware = null; // {name, bytes: Uint8Array|null, text: string|null}

    async function builtFromUserFirmware(kind) {
        const fw = userFirmware;
        blockOf = new Map();
        yieldOf = new Map();
        const isHexKind = ['emulator', 'avr8js', 'atmega2560', 'attiny85', 'attiny88'].includes(kind);
        if (isHexKind) {
            const text = fw.text || (fw.bytes ? new TextDecoder().decode(fw.bytes) : '');
            if (!/^\s*:/.test(text)) {
                throw new Error(`${fw.name}: this engine takes Intel HEX (a text file of ':' records) — ` +
                    'a raw .bin cannot say where its bytes live');
            }
            // f_cpu from the firmware when it says (a compiled sketch knows
            // its board's crystal: 8 MHz on the ATtinys), else the engine's
            // default. A picked .hex file says nothing and keeps the default.
            // symbols when the firmware brought its own (a compiled sketch's
            // table, built WITH this image); a picked .hex has none.
            return { hex: text, image: null, symbols: fw.symbols || null, c: null,
                bytes: text.length, f_cpu: fw.fCpu || null, device: fw.device, format: 'ihx' };
        }
        if (kind === 'rp2040js' || kind === 'stm32f0' || kind === 'stm32g0') {
            const bytes = fw.bytes || new TextEncoder().encode(fw.text || '');
            if (!bytes.length) throw new Error(`${fw.name}: empty firmware file`);
            if (kind === 'rp2040js') {
                const padded = bytes.length & 1 ? Uint8Array.of(...bytes, 0) : bytes;
                return { hex: null, image: new Uint16Array(padded.buffer, padded.byteOffset, padded.length / 2),
                    symbols: null, c: null, bytes: bytes.length, f_cpu: null, format: 'bin' };
            }
            // stm32f0: a REAL flash image — sanity-check the boot words so
            // a wrong file fails with a sentence, not a silent HardFault.
            if (bytes.length >= 8) {
                const sp = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
                if ((sp >>> 24) !== 0x20) {
                    throw new Error(`${fw.name}: word 0 is 0x${(sp >>> 0).toString(16)} — not an SRAM ` +
                        'stack pointer, so this is not an STM32 flash image (vectors must come first)');
                }
            }
            return { hex: null, image: bytes, symbols: null, c: null,
                bytes: bytes.length, f_cpu: null, format: 'bin' };
        }
        if (kind === 'esp8266') {
            // An ESP8266 flash image: the boot header's first byte is 0xE9,
            // checked so a wrong file fails with a sentence.
            const bytes = fw.bytes || new Uint8Array(0);
            if (!bytes.length || bytes[0] !== 0xe9) {
                throw new Error(`${fw.name}: not an ESP8266 flash image (it must start with the 0xE9 boot header)`);
            }
            return { hex: null, image: bytes, symbols: null, c: null,
                bytes: bytes.length, f_cpu: null, format: 'bin' };
        }
        if (kind === 'labwired') {
            // Only this explicit selector admits a flash-at-zero .bin. The
            // upstream validator reads chip identity and partition placement;
            // ordinary catalog chips still require addressed ELF/UF2 images.
            if (labwiredChip === 'firmware:esp32s3-merged-flash' ||
                labwiredChip === 'firmware:esp32-4848s040-merged-flash') {
                const {validateEsp32S3MergedFlash, ESP32S3_FLASH_BOOT_KIND} = await import(
                    /* webpackChunkName: "labwired-firmware-boot" */ 'bw-board/labwired-firmware-boot.js');
                const bytes = Uint8Array.from(fw.bytes || []);
                validateEsp32S3MergedFlash(bytes);
                return {hex: null, image: bytes, symbols: null, c: null,
                    bytes: bytes.length, f_cpu: null, format: ESP32S3_FLASH_BOOT_KIND};
            }
            // A chip or board picked in the Debug panel: the user's own image on a
            // catalog chip, no circuit (attachLabwiredFirmwareOnly).
            if (labwiredChip) {
                // The heavy tier runs the user's image on a catalog chip (see
                // attachLabwiredFirmwareOnly). ELF only: it says where every byte
                // loads, which a raw .bin cannot, and the chips differ (STM32 flash
                // at 0x0800_0000, nRF at 0, RP2040 XIP at 0x1000_0000).
                const bytes = fw.bytes || new Uint8Array(0);
                const isElf = bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 &&
                    bytes[2] === 0x4c && bytes[3] === 0x46;
                // UF2 (a Pico's drag-and-drop image): every block names its flash
                // address, so bw-board converts it without guessing an origin.
                const isUf2 = bytes.length >= 8 && bytes[0] === 0x55 && bytes[1] === 0x46 &&
                    bytes[2] === 0x32 && bytes[3] === 0x0a;
                if (isEsp32S040Target(labwiredChip) && !isElf) {
                    throw new Error('ESP32-4848S040: load an addressed Xtensa .elf, or choose the S040 merged-flash target for a merged .bin; Cortex-M UF2 is not supported');
                }
                // A .hex is taken for an S110 board (micro:bit V1 / Calliope): bw-board
                // keeps only its application window and the engine emulates the
                // SoftDevice. For any other chip a .hex is refused as before.
                const hexText = fw.text || (!isElf && !isUf2 && bytes.length && bytes[0] === 0x3a
                    ? new TextDecoder().decode(bytes) : null);
                if (hexText && String(labwiredChip || '').startsWith('board:')) {
                    return { hex: hexText, image: new TextEncoder().encode(hexText), symbols: null, c: null,
                        bytes: hexText.length, f_cpu: null, format: 'hex' };
                }
                if (!isElf && !isUf2) {
                    throw new Error(`${fw.name}: the LabWired engine takes an ELF (.elf) or a UF2 (.uf2) — ` +
                        'a raw .bin or .hex does not say where its bytes load on this chip ' +
                        '(a micro:bit V1 / Calliope .hex runs on the micro:bit V1 board)');
                }
                return { hex: null, image: bytes, symbols: null, c: null,
                    bytes: bytes.length, f_cpu: null, format: isElf ? 'elf' : 'uf2' };
            }
            // Otherwise the project's own device on its bench.
            const device = String(projectStc(null)?.device || '').toLowerCase();
            const chipKind = device === 'microbit' || device === 'microbit-v2' ? 'microbit_v2'
                : ['pybadge', 'pybadge-lc', 'samd51', 'arcade'].includes(device) ? 'pybadge'
                    : device === 'stm32f030' ? 'stm32f030'
                        : ['arduino-uno', 'arduino-nano', 'atmega328p'].includes(device) ? 'arduino_uno' : null;
            if (!chipKind) throw new Error(`LabWired cannot identify the chip for '${device || fw.name}'`);
            // AVR remains on the long-standing Intel-HEX path above. ARM
            // containers retain their own address here: a PyBadge UF2 starts
            // at the bootloader's application offset, not at flash zero.
            if (chipKind === 'arduino_uno') {
                const text = fw.text || (fw.bytes ? new TextDecoder().decode(fw.bytes) : '');
                if (!/^\s*:/.test(text)) throw new Error(`${fw.name}: the ATmega328P LabWired target takes Intel HEX`);
                return {hex: text, image: null, symbols: null, c: null,
                    bytes: text.length, f_cpu: fw.fCpu || null, format: 'ihx'};
            }
            const {labwiredFirmwareImage} = await import(
                /* webpackChunkName: "labwired-firmware" */ './labwired-firmware.js');
            const parsed = labwiredFirmwareImage(fw, chipKind);
            return {hex: null, image: parsed.image, symbols: null, c: null,
                bytes: parsed.image.length, f_cpu: fw.fCpu || null, format: parsed.format,
                firmwareAddress: parsed.address, omittedFirmwareBytes: parsed.omitted,
                extraSegments: parsed.extraSegments};
        }
        throw new Error(`arbitrary firmware is not wired for the '${kind}' engine yet`);
    }

    const engineeringInputs = createEngineeringInputRoute({
        getTarget: () => target,
        beforeWrite: () => {
            const forked = beginForwardBranch();
            if (forked.accepted) {
                reverseCursor = null;
                reverseContinue.reset();
            }
            return forked;
        },
        onApplied: () => emit()
    });
    let reverseContinue;
    let eventBreakpointDispatcher;
    let replayBreakpointDispatcher;
    let selectedEventSeek;
    let cp1BreakpointTarget = null;
    const cp1BreakpointHandles = new Map();
    const cp1BreakpointCells = () => {
        if (cp1BreakpointTarget !== target) {
            cp1BreakpointHandles.clear();
            cp1BreakpointTarget = target;
        }
        return [...cp1BreakpointHandles.keys()].sort((a, b) => a - b);
    };
    function publishBasicSerial(active) {
        const runtime = vm?.runtime;
        const send = runner.sendBasicLine;
        if (!runtime || !send) return;
        if (active && board && runtime.bwRunBoard === board) {
            runtime.bwBasicSerial = send;
        } else if (runtime.bwBasicSerial === send) {
            delete runtime.bwBasicSerial;
        } else {
            return;
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));
    }
    const runner = {
        cardiacSnapshot() {
            if (target?.kind !== 'cardiac') return null;
            const observed = target.snapshot();
            return observed.cardiac || observed;
        },
        cardiacControl(verb, value) {
            if (target?.kind !== 'cardiac' || typeof target.control !== 'function') {
                throw new Error('Open the CARDIAC machine before using its controls.');
            }
            // Deliberate input may be queued while running. Editing the image
            // or single-stepping always owns the shared session's pause.
            if (!['enqueueInput', 'sampleInput', 'toggleBreakpoint'].includes(verb)) {
                session.pause();
                unschedule();
            }
            target.control(verb, value);
            const observed = runner.cardiacSnapshot();
            if (verb === 'loadProgram' && machineConfig?.partId && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bw-cardiac-program-loaded', {detail: {
                    partId: machineConfig.partId, program: observed.program
                }}));
            }
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-cardiac-observation', {
                detail: {partId: machineConfig?.partId || null, ...observed}
            }));
            setStatus(observed.running ? 'running' : 'paused', observed.error || '');
            return observed;
        },
        cp1Snapshot() {
            if (target?.kind !== 'cp1') return null;
            const observed = target.snapshot();
            return {...observed, cp1: {...observed.cp1, breakpoints: cp1BreakpointCells()},
                cp2Recording: cp2Recording ? (cp2Recording.finished ? 'ready' : 'recording') : null};
        },
        cp1Cassette(action, bytes) {
            const machine = target?.kind === 'cp1' && target.machine;
            if (!machine?.playCassetteWave) return {unsupported: 'CP2 cassette transport is unavailable.'};
            if (action === 'play') {
                machine.playCassetteWave(bytes);
                cancelCp2Recording();
            } else if (action === 'eject') {
                machine.stopCassette();
            } else if (action === 'record') {
                cancelCp2Recording();
                cp2Recording = machine.recordCassetteWave();
                machine.stopCassette();
            } else if (action === 'cancel') {
                cancelCp2Recording();
            } else if (action === 'save') {
                if (!cp2Recording?.finished) return {refused: 'Complete a CAS transfer before saving.'};
                try { return cp2Recording.save(); }
                finally { cp2Recording = null; emit(); }
            } else {
                throw new RangeError('Unknown CP2 cassette operation');
            }
            emit();
        },
        cp1ToggleBreakpoint(address) {
            if (target?.kind !== 'cp1') throw new Error('Load CP1 firmware before setting a command breakpoint.');
            cp1BreakpointCells();
            if (cp1BreakpointHandles.has(address)) {
                target.clearBreakpoint(cp1BreakpointHandles.get(address));
                cp1BreakpointHandles.delete(address);
            } else {
                const result = target.setBreakpoint({kind: 'cp1', space: 'program', addr: address, stopSide: 'before'});
                if (!Number.isSafeInteger(result)) throw new Error(result?.unsupported || 'The CP1 breakpoint was refused.');
                cp1BreakpointHandles.set(address, result);
            }
            emit();
            return {address, enabled: cp1BreakpointHandles.has(address)};
        },
        cp1Key(key, down) {
            if (target?.kind !== 'cp1') return false;
            target.setKey(key, down);
            return true;
        },
        cp1ReleaseKeys() { if (target?.kind === 'cp1') target.releaseKeys(); },
        cp1InputMode: () => target?.adapter?.unloggedBoardInputs?.() ? 'circuit' : 'manual',
        cp1SetInput(port, value) {
            if (target?.kind !== 'cp1') return false;
            if (target.adapter?.unloggedBoardInputs?.()) {
                throw new Error('Use the attached circuit switches to drive CP1 inputs.');
            }
            target.machine.setPortInput(port, value);
            emit();
            return true;
        },
        cp1LoadProgram(assembly) {
            if (target?.kind !== 'cp1') throw new Error('Load CP1 firmware before a program.');
            if (assembly?.ok !== true || !(assembly.bytes instanceof Uint8Array) || !Array.isArray(assembly.words)) {
                throw new Error('Fix CP1 source errors before loading.');
            }
            const bytes = assembly.bytes;
            if (bytes.length !== target.machine.capacity * 2) {
                throw new Error(`CP1 program image must contain exactly ${target.machine.capacity * 2} bytes for this machine.`);
            }
            cp1LessonBatch?.clear();
            session.pause();
            target.releaseKeys();
            const cells = Array.from({length: bytes.length / 2}, (_, index) =>
                ({opcode: bytes[index * 2], operand: bytes[index * 2 + 1]}));
            target.machine.loadProgram(cells, {clear: true});
            emit();
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-cp1-program-loaded',
                {detail: {cells: assembly.words.length, expansion: target.machine.expansion}}));
        },
        cp1RunProgram(assembly) {
            if (target?.kind !== 'cp1') throw new Error('CP1 is unavailable.');
            const forked = beginForwardBranch();
            if (!forked.accepted) throw new Error(forked.reason || forked.code);
            runner.pause();
            runner.cp1Reset();
            const adapter = target.adapter;
            // Let the real monitor finish initialization before writing the program.
            // The adapter advances the same clock and board used by the debugger.
            adapter.advanceNs(300_000_000);
            runner.cp1LoadProgram(assembly);
            const entry = assembly.words.find(word => word.opcode !== 0)?.address || 0;
            // Address zero is the monitor's reset PC. For an ORG elsewhere, enter
            // the address with the physical keypad before pressing RUN.
            if (entry) {
                for (const key of [...String(entry).padStart(3, '0'), 'PC']) {
                    target.setKey(key, true);
                    adapter.advanceNs(40_000_000);
                    target.setKey(key, false);
                    adapter.advanceNs(40_000_000);
                }
            }
            target.setKey('RUN', true);
            cp1RunKeyUntil = target.timeNs() + 40_000_000n;
            runner.resume();
        },
        cp1WriteCell(index, cell) {
            if (target?.kind !== 'cp1') return false;
            cp1LessonBatch?.clear();
            session.pause();
            target.machine.writeCell(index, cell.opcode, cell.operand);
            emit();
            return true;
        },
        cp1Reset() {
            if (target?.kind !== 'cp1') return false;
            cancelCp2Recording();
            cp1LessonBatch?.clear();
            session.pause();
            target.reset();
            emit();
            return true;
        },
        /** Use this image instead of compiling the blocks. */
        setFirmware(fw) { userFirmware = fw || null; },
        // Compile the same blocks/pseudocode image without attaching another clock.
        async compileForCoSimulation() {
            if (destroyed || session || target || vm?.runtime?.bwRunBoard) throw new Error('Stop the circuit debugger before compiling a coupled simulation');
            const device = String(projectStc(null)?.device || '').toLowerCase();
            if (!['uno', 'arduino_uno', 'arduino-uno', 'atmega328p'].includes(device)) throw new Error('Circuit–CAD firmware currently requires Arduino Uno / ATmega328P');
            return userFirmware ? builtFromUserFirmware('avr8js') : build();
        },
        /** Engineering-unit channels and one atomic pose on the live target. */
        discoverInputs: () => engineeringInputs.discoverInputs(),
        setInputs: sets => engineeringInputs.setInputs(sets),
        clearFirmware() { userFirmware = null; },
        get firmwareName() { return userFirmware ? userFirmware.name : null; },

        state: snapshot,

        /** Counts snapshot attempts/builds without enabling global telemetry. */
        snapshotPerformance: snapshotEmitter.stats,

        /** Build, attach, and run. The ⚑ of the debug world. */
        async start({paused = false} = {}) {
            if (vm?.runtime?.bwCrispBasicSimulation) {
                throw new Error('Stop BASIC before starting the circuit debugger');
            }
            if (vm?.runtime?.bwCircuitRunPreparing) throw new Error('Another circuit run is preparing');
            if (['preparing','compiling','running'].includes(vm?.runtime?.cadCircuitSimulation?.state().phase)) {
                throw new Error('Stop the circuit–CAD simulation before starting the debugger');
            }
            const forked = beginForwardBranch();
            if (!forked.accepted) { setStatus('paused', forked.reason || forked.code); return forked; }
            reverseCursor = null;
            reverseContinue.reset();
            if (!session) resetEventBreakpointRuntime();
            const preparation = {};
            if (vm?.runtime) vm.runtime.bwCircuitRunPreparing = preparation;
            try {
                if (!session) {
                    // Clear it HERE and not in build(): the ROM and
                    // user-firmware routes never reach build(), so a stale
                    // "prebuilt for this lesson" line would survive a switch
                    // from an AVR lesson to a machine bench and describe an
                    // image that is not running.
                    imageProvenance = null;
                    const device = String(userFirmware?.device || projectStc(null)?.device || '').toLowerCase();
                    const selectedKind = selectDebugTargetKind(device, targetKind);
                    // This selector consumes an existing merged flash image.
                    // Refuse before build() so an empty picker cannot compile
                    // or send an unrelated blocks program to the compiler.
                    if (selectedKind === 'labwired' && (labwiredChip === 'firmware:esp32s3-merged-flash' ||
                        isEsp32S040Target(labwiredChip)) &&
                        !userFirmware) {
                        throw new Error(isEsp32S040Target(labwiredChip)
                            ? 'ESP32-4848S040: load firmware before starting; blocks compilation is not supported'
                            : 'ESP32-S3: load a merged .bin firmware file before starting ROM boot');
                    }
                    const built = runnerCompilesProjectBlocks({selectedKind, bootMedia})
                        ? (userFirmware ? await builtFromUserFirmware(selectedKind) : await build())
                        : null;
                    await attach(built);
                    if (destroyed) {
                        // Torn down while attaching: release what attach built
                        // and stay dead (see `destroyed`).
                        if (session) session.destroy();
                        session = target = null;
                        return {accepted: false, code: 'destroyed'};
                    }
                    // The user's breakpoints only became SETTABLE now: until a
                    // target exists there is nothing to set them on, and until
                    // this build exists nothing knows which (task, state) a
                    // block is. Subscribing rather than reading once keeps a
                    // right-click during a run working.
                    unsubscribeBps = subscribeBreakpoints(syncBreakpoints);
                }
                session.start();
                if (cardiacInitialSnapshot) {
                    const saved = cardiacInitialSnapshot.cardiac || cardiacInitialSnapshot;
                    target.control('restore', {...saved, running: false});
                    cardiacInitialSnapshot = null;
                    if (!paused) target.run();
                }
                if (paused) session.pause();
                boardBaseNs = boardTimeBase(board, target);
                if (destroyed) return {accepted: false, code: 'destroyed'};
                // Stop returns the board to the designer, but a restart reuses
                // this session. Restore its publication for Widgets as well as
                // the designer's direct runner.board() binding.
                if (board && vm?.runtime && vm.runtime.bwRunBoard !== board) {
                    vm.runtime.bwRunBoard = board;
                    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));
                }
                if (destroyed) return {accepted: false, code: 'destroyed'};
                publishBasicSerial(true);
                setStatus(paused ? 'paused' : 'running');
                if (paused) unschedule(); else schedule();
            } catch (e) {
                unschedule();
                i8086Execution.release(i8086ExecutionResult);
                i8086ExecutionResult = null;
                // A failed lazy chunk (emu8051, bw-board) inside this try is
                // exactly the caught-import blind spot the page recovery
                // documents: the rejection is handled here, so the global
                // unhandledrejection listener never sees it, and the user got
                // 'Loading chunk 344 failed' as a dead debugger (owner report,
                // 2026-08-16). Ask the recovery first; only show the error if
                // this is not a stale build.
                const recovering = typeof window !== 'undefined' &&
                    window.__bwRecoverFromStaleBuild &&
                    window.__bwRecoverFromStaleBuild(e && e.message);
                if (recovering) setStatus('attaching', S('app.updated'));
                else setStatus('error', e.message);
            } finally {
                if (vm?.runtime?.bwCircuitRunPreparing === preparation) delete vm.runtime.bwCircuitRunPreparing;
            }
        },

        pause() {
            if (!session) return;
            if (activeRunTo) {
                runToController.cancel();
                activeRunTo = null;
            }
            session.pause();
            unschedule();
            setStatus('paused');
        },

        resume() {
            if (!session) return;
            const forked = beginForwardBranch();
            if (!forked.accepted) { setStatus('paused', forked.reason || forked.code); return forked; }
            reverseCursor = null;
            reverseContinue.reset();
            session.resume();
            setStatus('running');
            schedule();
            return forked;
        },

        /** One block by default — the granularity every target supports. */
        step(kind = 'block') {
            if (!session) return { unsupported: 'nothing is running yet' };
            const forked = beginForwardBranch();
            if (!forked.accepted) { setStatus('paused', forked.reason || forked.code); return forked; }
            reverseCursor = null;
            reverseContinue.reset();
            const refusal = session.step(kind);
            if (refusal) { setStatus('paused', refusal.unsupported); return refusal; }
            setStatus('stepping');
            schedule();
            return undefined;
        },

        stop() {
            xtKeyboard?.clear();
            pcSerialInput?.clear();
            publishBasicSerial(false);
            cancelCp2Recording();
            cp1LessonBatch?.clear();
            hddSnapshotOwner = {};
            unschedule();
            if (activeRunTo) {
                runToController.cancel();
                activeRunTo = null;
            }
            if (session) session.stop();
            if (basicStartup) {
                basicStartup.reset();
                serialLines = [];
            }
            clearGlow();
            // The run board dies with the run — fall back to the designer's.
            if (vm && vm.runtime && vm.runtime.bwRunBoard) {
                delete vm.runtime.bwRunBoard;
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));
            }
            setStatus('idle');
        },

        setSpeed(x) { if (session) session.setSpeed(x); },

        /**
         * Is this block a place the program can be stopped at?
         *
         * The user cannot see which blocks are yield points, so a UI should ask
         * before offering "Pause here" — and where the answer is no, snap to
         * the next one rather than refusing (debugger-ui.md §3).
         */
        isYieldBlock: (blockId) => yieldOf.has(blockId),

        /** What a halt at this block would be called: `wait`, `forever`, … */
        yieldKind: (blockId) => (yieldOf.get(blockId) || {}).kind,

        /**
         * Mark or unmark a block. Delegates to the shared store, so the change
         * is visible to the editor's context menu and survives a stop — the
         * subscription above pushes it into the target when there is one.
         */
        toggleBreakpoint(blockId) {
            const now = toggleBreakpoint(blockId);
            emit();
            return now;
        },

        /**
         * "Pause here when counter > 10".
         *
         * Validated on the way in, so a typo is reported where it was typed
         * rather than becoming a pause point that mysteriously never fires.
         * Returns the parse error, or undefined on success.
         */
        setCondition(blockId, source) {
            if (source) {
                const parsed = parseCondition(source);
                if (parsed.error) {
                    conditionErrors = { ...conditionErrors, [blockId]: parsed.error };
                    emit();
                    return { error: parsed.error };
                }
                // A name the build does not have is not fatal — the variable may
                // appear after an edit — but it IS worth saying, because the
                // commonest condition that never fires is a misspelt name.
                //
                // `variables()` returns [] in two different situations: before
                // the first build, when we genuinely cannot judge a name, and
                // after a build of a program that declares none. Gating the
                // warning on the set being non-empty conflated them, so a
                // condition in a variable-less program silently never fired —
                // the exact shape of bug this file is supposed to prevent. The
                // distinguisher is whether we have BUILT, not whether the set
                // happens to have anything in it.
                const known = new Set(runner.variables().map((v) => v.name));
                const unknown = parsed.names.filter((n) => !known.has(n));
                conditionErrors = { ...conditionErrors };
                delete conditionErrors[blockId];
                if (unknown.length && target) {
                    conditionErrors[blockId] = known.size
                        ? `no variable named ${unknown.join(', ')}`
                        : 'this program has no variables, so this can never be true';
                }
            } else {
                conditionErrors = { ...conditionErrors };
                delete conditionErrors[blockId];
            }
            setCondition(blockId, source);
            breakpointGeneration++;
            emit();
            return undefined;
        },

        conditionOf,

        // ─── the engineer's view ─────────────────────────────────────
        //
        // Everything below exists so the drawer can show what emu8051's TUI
        // shows. It is deliberately a thin pass-through: the target already
        // implements boundary D, and a second layer of interpretation here
        // would be a second place for the two to disagree.

        /** Registers, the SFRs the TUI names, and the stack — one sample. */
        inspect() {
            if (!target) return null;
            const regs = target.regs();
            // The SFR window and the 0x08..SP stack walk below are 8051
            // anatomy. A machine target (6502, Z80) answers a different regs
            // shape — on the Z80, `r` is the REFRESH register, a number, and
            // mapping over it crashed the drawer. The 8051 shape is the one
            // with the bank-register array; anything else inspects as
            // 'generic' with no sfr/stack, and the drawer renders what the
            // target actually has instead of what an 8051 would have.
            if (!Array.isArray(regs.r)) {
                return { regs, sfr: null, stack: null, pc: regs.pc, tNs: target.timeNs(), flavor: 'generic' };
            }
            const sfr = {};
            for (const { name, addr } of [...IO_SFRS, ...TIMER_SFRS]) {
                sfr[name] = target.readMem('sfr', addr, 1)[0];
            }
            // The stack grows UP on an 8051 and SP points at the last byte
            // pushed, so the live entries are 0x08..SP — 0x07 is where SP sits
            // after a reset, below the first push.
            const stack = [];
            for (let a = 0x08; a <= regs.sp && a <= 0xFF; a++) {
                stack.push({ addr: a, value: target.readMem('iram', a, 1)[0] });
            }
            return { regs, sfr, stack, pc: regs.pc, tNs: target.timeNs(), flavor: '8051' };
        },

        /** Raw bytes, for the hex view. Returns [] rather than throwing. */
        /**
         * Opt the engine into reverse (LabWired): every instruction is then
         * single-stepped so it can be announced, so the run is much slower.
         * Once on, the Record / Reverse controls appear (they read the target's
         * capabilities afresh). undefined or {unsupported}.
         */
        setEngineRecording(on) {
            if (!target || typeof target.setRecording !== 'function') {
                return {unsupported: 'this engine has no opt-in reverse'};
            }
            const r = target.setRecording(!!on);
            emit();
            return r;
        },
        get engineRecording() {
            return !!(target && typeof target.isRecording === 'function' && target.isRecording());
        },

        /** Save the engine's current point (LabWired). {id,label,cycles} or {unsupported}. */
        saveSnapshot(label) {
            if (!target || typeof target.saveSnapshot !== 'function') {
                return {unsupported: 'this engine has no save points'};
            }
            const r = target.saveSnapshot(label);
            emit();
            return r;
        },

        /** Return to a save point; the target halts first. undefined or {unsupported}. */
        restoreSnapshot(id) {
            if (!target || typeof target.restoreSnapshot !== 'function') {
                return {unsupported: 'this engine has no save points'};
            }
            const r = target.restoreSnapshot(id);
            if (!r) setStatus('paused');
            emit();
            return r;
        },

        readMem(space, addr, len) {
            if (!target) return [];
            const out = target.readMem(space, addr, len);
            return out instanceof Uint8Array ? [...out] : [];
        },

        /** Edit one byte. `code` is writable here, as it is in the TUI. */
        writeMem(space, addr, value) {
            if (!target) return { refused: 'nothing is loaded' };
            return target.writeMem(space, addr, Uint8Array.from([value & 0xFF]));
        },

        /** The instruction at an address, as text. Capability, not assumption:
         * only the 8051 targets carry a disassembler; an AVR/RP2040 target
         * without one must yield '' — calling through unconditionally crashed
         * the whole app from "under the hood" on the pendant (owner report,
         * 2026-08-16). */
        disasm(addr) { return (target && typeof target.disasm === 'function') ? target.disasm(addr) : ''; },

        /** Whether the attached target can write a register (LabWired with a newer engine). */
        canWriteRegs() { return !!(target && typeof target.writeReg === 'function'); },

        /** Write register `name` (the target's own name). undefined or {unsupported}. */
        writeReg(name, value) {
            if (!target || typeof target.writeReg !== 'function') {
                return {unsupported: 'this engine cannot write registers'};
            }
            const r = target.writeReg(name, value);
            emit();
            return r;
        },

        /**
         * A short listing from `addr`, walking with the opcode length table.
         * The TUI has no such pane — its code window is the trace — but a
         * listing around the PC is what a GUI reader expects, and the length
         * table makes it free.
         */
        listing(addr, count = 16) {
            return codeListingRows(target, addr, count);
        },

        /** Does the attached target implement `name` at all? Only the 8051
         *  target has setPc/wipe; every Cortex one (labwired, rp2040js,
         *  stm32f0) and the AVRs do not, and the drawer used to offer both
         *  buttons unconditionally — so pressing them threw a TypeError
         *  instead of doing nothing or explaining itself.
         *  @param {string} name a DebugTarget method.
         *  @returns {boolean} true when it can be called. */
        supports(name) { return !!(target && typeof target[name] === 'function'); },

        /** Detached copy at the supplier's settled boundary, not a paused lease. */
        async snapshotAtaMaster() {
            const refused = (code, reason) => ({refused: {code, reason}});
            if (destroyed || i8086ExecutionLifetime.signal.aborted || !target || !session) {
                return refused('snapshot-no-session', 'No active machine session');
            }
            if (session.state().intent !== 'paused' || target.state() !== 'halted') {
                return refused('snapshot-not-paused', 'Pause the current machine before copying its disk');
            }
            const capture = target.snapshotAtaMaster;
            if (typeof capture !== 'function') {
                return refused('snapshot-unsupported', 'This target has no master-disk snapshot API');
            }
            const owner = hddSnapshotOwner;
            const originalTarget = target;
            const originalSession = session;
            const current = () => !destroyed && !i8086ExecutionLifetime.signal.aborted && owner === hddSnapshotOwner &&
                originalTarget === target && originalSession === session;
            try {
                const result = await capture.call(originalTarget);
                if (!current()) return refused('snapshot-stale-session', 'The machine session changed during the copy');
                return result;
            } catch (error) {
                if (!current()) return refused('snapshot-stale-session', 'The machine session changed during the copy');
                throw error;
            }
        },

        /** Move the PC. The TUI's `g`. */
        setPc(addr) {
            if (!target) return { refused: 'nothing is loaded' };
            if (typeof target.setPc !== 'function') {
                return { refused: 'this engine cannot move the program counter' };
            }
            return target.setPc(addr);
        },

        /** Reset registers only, or reset and clear RAM. The TUI's R) and W). */
        resetCpu() { if (target) { target.reset(); trace.record(target, 'reset', {variables: runner.variables()}); emit(); } },
        wipe() {
            if (!target || typeof target.wipe !== 'function') return { refused: 'this engine cannot wipe memory' };
            target.wipe();
            trace.record(target, 'reset', {variables: runner.variables()});
            emit();
            return true;
        },

        /** A breakpoint at a code ADDRESS, which blocks cannot express. */
        addressBreakpoints: () => [...addrBps.keys()],
        toggleAddressBreakpoint(addr) {
            if (!target) return false;
            const result = toggleTargetCodeBreakpoint({target, addrBps, addr});
            if (!result.added && !result.removed) return false;
            breakpointGeneration++;
            emit();
            return addrBps.has(addr);
        },

        /**
         * Write watchpoints — "stop when this byte changes".
         *
         * Kept here rather than in the block-breakpoint store because a
         * watchpoint is about an ADDRESS, and blocks cannot express one. The
         * key carries the space: iram 0x90 and sfr 0x90 are different bytes.
         *
         * Every refusal comes back as a REASON, never as a silent false: a
         * watchpoint that looks armed and is not is the failure the whole
         * feature exists to avoid.
         */
        watchpoints: () => [...watchBps.entries()].map(([key, handle]) => {
            const [space, addr] = key.split(':');
            return { space, addr: Number(addr), handle };
        }),

        toggleWatchpoint(space, addr) {
            if (!target) return { refused: 'nothing is running yet' };
            const caps = capsNow();
            if (!caps || !(caps.breakpoints || []).includes('write')) {
                return { refused:
                    'this engine has no write watchpoints. Read the value between blocks ' +
                    'instead — and call that sampling, because it is.' };
            }
            const result = toggleTargetWriteWatchpoint({target, watchBps, space, addr});
            if (result.added || result.removed) {
                breakpointGeneration++;
                emit();
            }
            return result;
        },

        /**
         * One CPU cycle, where that means anything.
         *
         * Deliberately separate from stepInstruction rather than a parameter
         * on it: they are different units, and only one target has the finer
         * one. Refuses with the ENGINE's reason so the person reading it
         * learns why a core cannot do this, rather than assuming a missing
         * button.
         */
        stepCycle(count = 1) {
            if (!target) return { unsupported: 'nothing is running yet' };
            const caps = capsNow();
            if (caps && !(caps.steps || []).includes('cycle')) {
                const refusal = target.step('cycle', 1);
                return refusal || { unsupported: 'this engine has no cycle step' };
            }
            for (let i = 0; i < count; i++) {
                const refusal = target.step('cycle', 1);
                if (refusal) return refusal;
                // A cycle is one clock; the pump budget only has to be big
                // enough to contain it, and 1 us contains one at any clock
                // this app runs.
                for (let n = 0; n < 4096 && target.state() === 'running'; n++) {
                    target.runFor(1000);
                }
            }
            emit();
            return undefined;
        },

        /** The execution history. Newest last. */
        trace: () => trace.rows(),
        traceDropped: () => trace.dropped(),
        /** Canonical compatibility events, bulk-drained by future timeline consumers. */
        enableDebugEvents() { ensureDebugEvents(); return true; },
        drainDebugEvents: (max) => {
            ensureDebugEvents();
            const batch = eventStream.drain(max);
            debugFoundation.ingestTimeline(batch);
            debugTimingWaveform.append(batch.filter(event => event.kind !== 'gap'));
            return batch;
        },
        debugEventStats: () => {
            ensureDebugEvents();
            return {queued: eventStream.size(), dropped: eventStream.dropped()};
        },
        addEventBreakpoint: spec => {
            ensureDebugEvents();
            const result = debugFoundation.addBreakpoint(spec);
            if (result.ok) breakpointGeneration++;
            return result;
        },
        eventBreakpoints: () => debugFoundation.listBreakpoints(),
        removeEventBreakpoint: (id, generation) => {
            const changed = debugFoundation.removeBreakpoint(id, generation);
            if (changed) breakpointGeneration++;
            return changed;
        },
        enableEventBreakpoint: (id, generation) => {
            const changed = debugFoundation.enableBreakpoint(id, generation);
            if (changed) breakpointGeneration++;
            return changed;
        },
        disableEventBreakpoint: (id, generation) => {
            const changed = debugFoundation.disableBreakpoint(id, generation);
            if (changed) breakpointGeneration++;
            return changed;
        },
        clearEventBreakpoints: () => {
            const removed = debugFoundation.clearBreakpoints();
            if (removed) breakpointGeneration++;
            eventBreakpointDispatcher.clear();
            return removed;
        },
        evaluateEventBreakpoints: (event, context) => debugFoundation.evaluateBreakpoints(event, context),
        eventBreakpointActionStatus: () => ({
            failures: eventBreakpointFailures.map(item => ({...item})),
            log: eventBreakpointLog.map(item => ({...item})),
            counters: Object.fromEntries(eventBreakpointCounters)
        }),
        clearEventBreakpointActionStatus: () => {
            resetEventBreakpointRuntime();
            emit();
        },
        debugRecorder: () => activeBranchPayload.recorder,
        debugBranchSummaries: () => forkRecordingStore.summaries().map(branch => {
            const payload = forkRecordingStore.recordingFor(branch.branchId).recording;
            return {...branch, recording: payload.recordingSession.status(),
                checkpoints: payload.recorder.checkpointSummary()};
        }),
        // NULL AND [] MEAN DIFFERENT THINGS, and collapsing them cost a CI cycle.
        // null: this bench has no collector, so it CANNOT report refusals.
        // []:   it has one and nothing has been refused.
        // Rendered identically — no block either way — but a diagnostic that
        // cannot tell them apart sends the reader to the panel when the answer
        // is the machine config, which is exactly what happened on run
        // 34063599364.
        debugChipRefusals: () => (chipRefusalsOf ? chipRefusalLines(chipRefusalsOf()) : null),
        // CPU timing models (E8, bw-board riscv32-debug.js): a pipeline, caches
        // and a branch predictor fed by the retired instructions. Only a target
        // that offers them says so; the pane (debug-pipeline.jsx) shows nothing
        // otherwise. Read at render, like the refusals above.
        debugTimingSupported: () => !!(target && typeof target.setTiming === 'function'),
        setDebugTiming: cfg => (target && typeof target.setTiming === 'function'
            ? target.setTiming(cfg) : {unsupported: 'this target has no timing models'}),
        debugTiming: lastCycles => (target && typeof target.timing === 'function' ? target.timing(lastCycles) : null),
        debugHistoryAnnotations: () => historyAnnotations.list(),
        addDebugBookmark: request => historyAnnotations.addBookmark(request),
        addDebugAnnotation: request => historyAnnotations.addAnnotation(request),
        updateDebugHistoryAnnotation: (id, changes) => historyAnnotations.update(id, changes),
        removeDebugHistoryAnnotation: id => historyAnnotations.remove(id),
        compareDebugCheckpoints: (left, right) => historyAnnotations.compareCheckpoints(left, right),
        async exportDebugSession () {
            const branches = forkRecordingStore.summaries();
            const activeBranchId = forkRecordingStore.active().branch.branchId;
            const recordings = branches.map(branch => {
                const recorder = forkRecordingStore.recordingFor(branch.branchId).recording.recorder;
                const summaries = recorder.checkpointSummary();
                return {branchId: branch.branchId,
                    trace: summaries.length ? recorder.eventsFrom(summaries[0].eventCursor) : [],
                    inputs: recorder.inputsFrom(recorder.retention().inputBaseCursor),
                    checkpoints: recorder.checkpoints().map(checkpoint => ({
                        id: checkpoint.id, eventCursor: checkpoint.eventCursor,
                        inputCursor: checkpoint.inputCursor, time: checkpoint.time,
                        codec: DEBUG_SESSION_SNAPSHOT_CODEC,
                        snapshot: {target: checkpoint.snapshot,
                            ...(Object.hasOwn(checkpoint, 'hostSnapshot') ?
                                {host: checkpoint.hostSnapshot} : {})},
                        inspection: checkpoint.inspection ?? null
                    }))};
            });
            if (recordings.some(recording => !recording.checkpoints.length)) return {accepted: false, code: 'session-export-empty',
                reason: 'Start recording and capture a checkpoint before exporting a session'};
            try {
                const bundle = await createDebuggerSessionBundle({
                    firmware: bootMedia?.bytes || new Uint8Array(), source: '',
                    branches: branches.map(branch => ({...branch,
                        active: branch.branchId === activeBranchId})),
                    recordings,
                    bookmarks: historyAnnotations.list().filter(entry => entry.kind === 'bookmark').map(entry => ({
                        id: entry.id, branchId: entry.cursor.branchId, eventCursor: entry.cursor.eventCursor,
                        label: entry.label, annotation: entry.annotation
                    })),
                    annotations: historyAnnotations.list().filter(entry => entry.kind === 'annotation').map(entry => ({
                        id: entry.id, branchId: entry.cursor.branchId, eventCursor: entry.cursor.eventCursor,
                        text: entry.annotation
                    })), codecs: sessionCodecs
                });
                return {accepted: true, text: JSON.stringify(bundle), filename: 'debug-session.bwdebug'};
            } catch (error) {
                return {accepted: false, code: error?.code || 'session-export-failed',
                    reason: error?.message || String(error)};
            }
        },
        async importDebugSession (text) {
            if (recordingSession.status().active) return {accepted: false,
                code: 'session-import-recording-active',
                reason: 'Stop the active recording before importing a session'};
            if (typeof text !== 'string' || text.length > 48 * 1024 * 1024) return {accepted: false,
                code: 'session-import-size', reason: 'Session file exceeds the browser import limit'};
            let bundle;
            try { bundle = JSON.parse(text); } catch (error) {
                return {accepted: false, code: 'session-import-json',
                    reason: `Session file is not valid JSON (${error?.message || String(error)})`};
            }
            try {
                const imported = await importDebuggerSessionBundle({bundle, codecs: sessionCodecs,
                    commit: staged => {
                        const payloads = new Map();
                        for (const recording of staged.recordings) {
                            const firstInput = recording.inputs[0]?.cursor ??
                                recording.checkpoints[0]?.inputCursor ?? 0;
                            const importedRecorder = createDebugRecorder({initialInputCursor: firstInput});
                            for (const input of recording.inputs) {
                                const appended = importedRecorder.appendInput(input);
                                if (appended.cursor !== input.cursor) throw Object.assign(
                                    new Error('Imported input cursors are not contiguous'),
                                    {code: 'session-import-input-order'});
                            }
                            let eventIndex = 0;
                            for (const checkpoint of recording.checkpoints) {
                                while (eventIndex < recording.trace.length &&
                                    recording.trace[eventIndex].seq < checkpoint.eventCursor) {
                                    importedRecorder.appendEvent(recording.trace[eventIndex++]);
                                }
                                const decoded = checkpoint.snapshot;
                                if (!decoded || !Object.hasOwn(decoded, 'target')) throw Object.assign(
                                    new Error('Checkpoint snapshot has no target state'),
                                    {code: 'session-import-checkpoint-invalid'});
                                importedRecorder.createCheckpoint({schema: 1, id: checkpoint.id,
                                    eventCursor: checkpoint.eventCursor, inputCursor: checkpoint.inputCursor,
                                    time: checkpoint.time, snapshot: decoded.target,
                                    inspection: checkpoint.inspection ?? null,
                                    ...(Object.hasOwn(decoded, 'host') ? {hostSnapshot: decoded.host} : {})});
                            }
                            while (eventIndex < recording.trace.length) {
                                importedRecorder.appendEvent(recording.trace[eventIndex++]);
                            }
                            payloads.set(recording.branchId, createBranchPayload(importedRecorder,
                                createHaltOccurrenceLedger()));
                        }
                        const branchIdOf = branch => branch.branchId ?? branch.id;
                        const parentIdOf = branch => branch.parentBranchId ?? branch.parentId ?? null;
                        const root = staged.branches.find(branch => parentIdOf(branch) === null);
                        const rootId = root && branchIdOf(root);
                        if (!root || !payloads.has(rootId)) throw Object.assign(
                            new Error('Imported session has no root recording'),
                            {code: 'session-import-root-missing'});
                        const importedStore = createForkRecordingStore({rootBranchId: rootId,
                            rootRecording: payloads.get(rootId)});
                        for (const branch of staged.branches.filter(item => parentIdOf(item) !== null)) {
                            const id = branchIdOf(branch); const parentId = parentIdOf(branch);
                            const added = importedStore.fork({branchId: id, parentBranchId: parentId,
                                forkCursor: branch.forkCursor ||
                                    {branchId: parentId, eventCursor: branch.eventCursor},
                                recording: payloads.get(id)});
                            if (!added.accepted) throw Object.assign(new Error(added.reason || added.code),
                                {code: added.code});
                        }
                        const wantedActive = branchIdOf(staged.branches.find(branch => branch.active) || root);
                        const activated = importedStore.activate(wantedActive);
                        if (!activated.accepted) throw Object.assign(new Error(activated.reason || activated.code),
                            {code: activated.code});
                        const importedAnnotations = historyStoreFor(importedStore, [
                            ...staged.bookmarks.map(entry => ({id: entry.id, kind: 'bookmark',
                                cursor: {branchId: entry.branchId, eventCursor: entry.eventCursor},
                                label: entry.label, annotation: entry.annotation ?? ''})),
                            ...staged.annotations.map(entry => ({id: entry.id, kind: 'annotation',
                                cursor: {branchId: entry.branchId, eventCursor: entry.eventCursor},
                                annotation: entry.text}))
                        ].sort((left, right) => left.id - right.id));
                        // Commit is deliberately the first mutation: decoding,
                        // hashing and recorder reconstruction all completed above.
                        activeBranchPayload = activated.recording;
                        forkRecordingStore = importedStore;
                        historyAnnotations = importedAnnotations;
                        debugFoundation.timeline.clear();
                        debugTimingWaveform.clear();
                        reverseCursor = null;
                        reverseContinue.reset();
                        selectedInspectionKey = null;
                        selectedInspectionView = null;
                        return {traceEvents: staged.recordings.reduce((sum, item) => sum + item.trace.length, 0),
                            checkpoints: staged.checkpoints.length};
                    }});
                // Rendering is not part of the transaction: a consumer error
                // cannot turn a committed, validated import into a false refusal.
                try { emit(); } catch { /* the next UI refresh can recover */ }
                return imported;
            } catch (error) {
                return {accepted: false, code: error?.code || 'session-import-failed',
                    reason: error?.message || String(error)};
            }
        },
        debugBisectionStatus: () => ({...bisectionRun, ...bisectionEndpoints}),
        markDebugBisectionEndpoint (which) {
            if (!['good', 'bad'].includes(which)) return {accepted: false,
                code: 'invalid-bisection-endpoint', reason: 'Endpoint must be good or bad'};
            if (bisectionRun.phase === 'running') return {accepted: false,
                code: 'bisection-running', reason: 'Cancel the active bisection before changing endpoints'};
            const selected = debugFoundation.timeline.state().selectedEvent;
            if (!selected || !Number.isSafeInteger(selected.seq) || selected.seq === Number.MAX_SAFE_INTEGER) {
                return {accepted: false, code: 'bisection-selection-missing',
                    reason: 'Select a retained timeline event first'};
            }
            const cursor = createBranchCursor(forkRecordingStore.active().branch.branchId, selected.seq + 1);
            bisectionEndpoints = {...bisectionEndpoints, [which]: cursor};
            bisectionRun = {...bisectionRun, phase: 'idle', result: null};
            emit();
            return {accepted: true, cursor};
        },
        cancelDebugBisection () {
            if (bisectionRun.phase !== 'running') return {accepted: false,
                code: 'bisection-not-running', reason: 'No divergence search is running'};
            bisectionGeneration++;
            bisectionRun = {...bisectionRun, phase: 'cancelling'};
            emit();
            return {accepted: true};
        },
        async startDebugBisection () {
            if (bisectionRun.phase === 'running' || bisectionRun.phase === 'cancelling') {
                return {accepted: false, code: 'bisection-running', reason: 'A divergence search is already running'};
            }
            if (!bisectionEndpoints.good || !bisectionEndpoints.bad) return {accepted: false,
                code: 'bisection-endpoints-missing', reason: 'Mark known-good and bad timeline events first'};
            const branch = forkRecordingStore.recordingFor(bisectionEndpoints.good.branchId);
            if (!branch.accepted || bisectionEndpoints.bad.branchId !== bisectionEndpoints.good.branchId) {
                return {accepted: false, code: 'bisection-branch-mismatch',
                    reason: 'Good and bad events must belong to one retained branch'};
            }
            const replay = branch.recording.cycleReplay;
            const capability = replay.canReverse();
            if (!capability.accepted) return {accepted: false, code: 'bisection-cycle-replay-required',
                reason: 'Divergence bisection currently requires recorded resumable cycle replay'};
            recordingSession.stop();
            if (session) session.pause();
            unschedule();
            const output = replayOutputGate.begin();
            if (!output.accepted) return output;
            const generation = ++bisectionGeneration;
            bisectionRun = {phase: 'running', probes: 0, maxProbes: 64, result: null};
            emit();
            const capture = () => wrapSourceState(target.captureCheckpoint(), captureHostState);
            const restore = source => {
                target.restoreCheckpoint(source.target);
                return commitHostRestore(prepareHostRestore(source.host));
            };
            const coordinator = createDivergenceBisection({maxProbes: 64,
                captureSource: capture, restoreSource: restore,
                probe: async cursor => {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    if (generation !== bisectionGeneration) return {accepted: false,
                        reason: 'Divergence search cancelled'};
                    bisectionRun = {...bisectionRun, probes: bisectionRun.probes + 1};
                    emit();
                    replayingDebugHistory = true;
                    let result;
                    try { result = replay.reverseToCycle(cursor.eventCursor); } finally {
                        replayingDebugHistory = false;
                        eventBreakpointDispatcher?.clear();
                        replayBreakpointDispatcher?.clear();
                    }
                    if (!result.accepted && result.code !== 'REPLAY_DIVERGED') return result;
                    return {accepted: true, matches: result.accepted, passive: true,
                        deterministic: true, externalEffects: 0};
                }});
            let result;
            try {
                result = await coordinator.bisect(bisectionEndpoints);
                if (generation !== bisectionGeneration) result = {accepted: false,
                    code: 'bisection-cancelled', reason: 'Divergence search cancelled'};
            } catch (error) {
                result = {accepted: false, code: error?.code || 'bisection-failed',
                    reason: error?.message || String(error)};
            }
            // The coordinator restored the captured source after every probe.
            // Publish exactly one complete output view after leaving history.
            const synchronized = replayOutputGate.resynchronize(snapshot());
            if (!synchronized.accepted && result.accepted) result = synchronized;
            bisectionRun = {...bisectionRun, phase: result.code === 'bisection-cancelled' ?
                'cancelled' : 'complete', result};
            emit();
            return result;
        },
        correlatedDebugView () {
            const raw = correlatedDebugger?.view();
            if (!raw) return null;
            const selectedEvent = raw.events.find(event => correlatedSelectedCursor &&
                event.cursor.branchId === correlatedSelectedCursor.branchId &&
                event.cursor.eventCursor === correlatedSelectedCursor.eventCursor) || null;
            return {...raw, selectedEvent, lastCheckpoint: correlatedCheckpoint,
                lanes: raw.targets.map(item => ({targetId: item.id, clockDomain: item.clockDomain,
                    events: raw.events.filter(event => event.targetId === item.id)}))};
        },
        correlatedDebugStatus: () => correlatedStatus,
        selectCorrelatedDebugTarget (targetId) {
            const ids = correlatedDebugger?.view().targets.map(item => item.id) || [];
            if (!ids.includes(targetId)) return {accepted: false, code: 'correlated-target-unknown',
                reason: 'Selected CPU is not retained'};
            correlatedSelectedTarget = targetId;
            correlatedStatus = null;
            emit();
            return {accepted: true, targetId};
        },
        selectedCorrelatedDebugTarget: () => correlatedSelectedTarget,
        selectCorrelatedDebugEvent (cursor) {
            const view = correlatedDebugger?.view();
            const event = view?.events.find(item => item.cursor.branchId === cursor?.branchId &&
                item.cursor.eventCursor === cursor?.eventCursor);
            if (!event) return {accepted: false, code: 'causal-cursor-not-retained',
                reason: 'The correlated event is no longer retained'};
            correlatedSelectedCursor = event.cursor;
            correlatedSelectedTarget = event.targetId;
            correlatedStatus = null;
            emit();
            return {accepted: true, cursor: event.cursor, targetId: event.targetId};
        },
        addCorrelatedDebugTrigger () {
            const view = correlatedDebugger?.view();
            const selected = view?.events.find(event => correlatedSelectedCursor &&
                event.cursor.branchId === correlatedSelectedCursor.branchId &&
                event.cursor.eventCursor === correlatedSelectedCursor.eventCursor);
            const destination = view?.targets.find(item => item.id !== selected?.targetId)?.id;
            if (!selected || !destination) return {accepted: false, code: 'cross-core-trigger-unavailable',
                reason: 'Select an event in a session with at least two CPUs'};
            const result = correlatedDebugger.addTrigger({id: `cross-${correlatedTriggerId++}`,
                sourceTarget: selected.targetId, targetId: destination, kind: selected.kind});
            correlatedStatus = result;
            emit();
            return result;
        },
        followCorrelatedDebugCause () {
            const view = correlatedDebugger?.view();
            const selected = view?.events.find(event => correlatedSelectedCursor &&
                event.cursor.branchId === correlatedSelectedCursor.branchId &&
                event.cursor.eventCursor === correlatedSelectedCursor.eventCursor);
            const cause = selected?.cause;
            const source = cause && view.events.find(event => event.cursor.branchId === cause.branchId &&
                event.cursor.eventCursor === cause.eventCursor);
            if (!source) return {accepted: false, code: 'causal-link-unavailable',
                reason: 'The selected event has no retained causal source'};
            correlatedSelectedCursor = source.cursor;
            correlatedSelectedTarget = source.targetId;
            correlatedStatus = null;
            emit();
            return {accepted: true, cursor: source.cursor, targetId: source.targetId};
        },
        async checkpointCorrelatedDebugTargets () {
            if (!correlatedDebugger) return {accepted: false, code: 'correlated-debug-unavailable',
                reason: 'No correlated CPU session is active'};
            const result = await correlatedDebugger.captureCheckpoint('main');
            if (result.accepted) correlatedCheckpoint = result.checkpoint;
            correlatedStatus = result;
            emit();
            return result;
        },
        async restoreCorrelatedDebugTargets () {
            if (!correlatedDebugger || !correlatedCheckpoint) return {accepted: false,
                code: 'correlated-checkpoint-unavailable', reason: 'Capture an all-CPU checkpoint first'};
            if (session) session.pause();
            unschedule();
            const result = await correlatedDebugger.restoreCheckpoint(correlatedCheckpoint);
            correlatedStatus = result;
            if (result.accepted) status = {phase: 'paused', message: ''};
            emit();
            return result;
        },
        activeDebugBranch: () => forkRecordingStore.active().branch,
        forkDebugHistory(branchId) {
            if (reverseCursor === null) return {accepted: false, code: 'fork-cursor-unavailable',
                reason: 'restore or seek to a recorded instruction boundary before forking'};
            if (typeof branchId !== 'string' || !branchId) return {accepted: false,
                code: 'invalid-branch-id', reason: 'branch id must be a non-empty string'};
            const result = beginForwardBranch(branchId);
            if (result.accepted) {
                // The child root is now the active live end. Leaving the
                // parent's restored cursor selected would make the next
                // forward command create an accidental second child.
                reverseCursor = null;
                reverseContinue.reset();
                emit();
            }
            return result;
        },
        activateDebugBranch(cursor) {
            if (!cursor || typeof cursor !== 'object') return {accepted: false,
                code: 'branch-cursor-required', reason: 'branch activation requires a branch-qualified cursor'};
            const destination = forkRecordingStore.recordingFor(cursor.branchId);
            if (!destination.accepted) return destination;
            if (recordingSession.status().active) return {accepted: false,
                code: 'branch-switch-recording-active',
                reason: 'stop or suspend active recording before switching branches'};
            if (session) session.pause();
            unschedule();
            const prior = forkRecordingStore.active();
            const priorRetention = prior.recording.recorder.retention();
            const priorCursor = reverseCursor ?? (priorRetention.lastEventSeq === null ?
                prior.recording.recorder.checkpointSummary().at(-1)?.eventCursor :
                priorRetention.lastEventSeq + 1);
            replayingDebugHistory = true;
            let result;
            try {
                const destinationCycle = destination.recording.cycleReplay.canReverse().accepted;
                result = destinationCycle ?
                    destination.recording.cycleReplay.reverseToCycle(cursor.eventCursor) :
                    destination.recording.instructionReplay.reverseToEvent(cursor.eventCursor);
                if (!result.accepted) {
                    const priorCycle = prior.recording.cycleReplay.canReverse().accepted;
                    const rollback = priorCursor === undefined ? null : priorCycle ?
                        prior.recording.cycleReplay.reverseToCycle(priorCursor) :
                        prior.recording.instructionReplay.reverseToEvent(priorCursor);
                    if (rollback && !rollback.accepted) return {accepted: false,
                        code: 'branch-switch-rollback-failed', reason: rollback.reason || rollback.code};
                    return result;
                }
            } finally {
                replayingDebugHistory = false;
                eventBreakpointDispatcher?.clear();
                replayBreakpointDispatcher?.clear();
            }
            const activated = forkRecordingStore.activate(cursor.branchId);
            if (!activated.accepted) return activated;
            activeBranchPayload = activated.recording;
            reverseCursor = cursor.eventCursor;
            reverseContinue.reset();
            emit();
            return {...result, branch: activated.branch};
        },
        debugTimeline: () => debugFoundation.timeline,
        debugTimingWaveform: () => debugTimingWaveform,
        selectedEventInspection() {
            const selectedEvent = debugFoundation.timeline.state().selectedEvent;
            if (!selectedEvent) return {accepted: false, code: 'inspection-selection-missing',
                reason: 'select a recorded timeline event'};
            const recorder = activeBranchPayload.recorder;
            const checkpoints = recorder.checkpointSummary();
            if (!checkpoints.length) return {accepted: false, code: 'inspection-unavailable',
                reason: 'the active branch has no retained checkpoint'};
            const retention = recorder.retention();
            const branchId = forkRecordingStore.active().branch.branchId;
            const key = `${branchId}:${selectedEvent.seq}:${retention.firstEventSeq}:${retention.lastEventSeq}:` +
                `${checkpoints[0].id}:${checkpoints.at(-1).id}`;
            if (key === selectedInspectionKey) return selectedInspectionView;
            try {
                selectedInspectionStore.load({
                    events: recorder.eventsFrom(checkpoints[0].eventCursor),
                    checkpoints
                });
                selectedInspectionView = selectedInspectionStore.select(selectedEvent.seq + 1);
            } catch (error) {
                selectedInspectionView = {accepted: false, code: 'inspection-unavailable',
                    reason: error?.message || String(error)};
            }
            selectedInspectionKey = key;
            return selectedInspectionView;
        },
        startDebugRecording() {
            activeBranchPayload.haltOccurrences.clear();
            haltLedgerRefusal = null;
            reverseHistoryRefusal = null;
            ensureDebugEvents();
            const previousStore = forkRecordingStore;
            const result = recordingSession.start();
            if (!result.accepted) return result;
            // Starting is an explicit new recording epoch. The active payload
            // was just cleared by start(); retaining its former ancestry would
            // leave branch metadata pointing into a history that no longer
            // exists. Release every other payload only after the new root
            // checkpoint succeeds.
            for (const branch of previousStore.summaries()) {
                const payload = previousStore.recordingFor(branch.branchId).recording;
                if (payload === activeBranchPayload) continue;
                payload.recordingSession.stop();
                payload.recorder.clear();
                payload.haltOccurrences.clear();
            }
            forkRecordingStore = createForkRecordingStore({rootRecording: activeBranchPayload});
            historyAnnotations = historyStoreFor(forkRecordingStore);
            nextForkBranchId = 1;
            selectedInspectionKey = null;
            selectedInspectionView = null;
            reverseCursor = null;
            reverseContinue.reset();
            return result;
        },
        stopDebugRecording: () => recordingSession.stop(),
        checkpointDebugRecording: () => recordingSession.checkpoint(),
        restoreDebugCheckpoint: eventCursor => {
            const result = recordingSession.restore(eventCursor);
            if (result.accepted) {
                reverseCursor = eventCursor;
                reverseContinue.reset();
                emit();
            }
            return result;
        },
        recordDebugInput: input => recordingSession.appendInput(input),
        debugRecordingStatus: () => recordingSession.status(),
        reverseDebugToEvent: eventCursor => {
            // Replayed events must be observed and compared, never appended to
            // the recording they are being checked against.
            recordingSession.stop();
            if (session) session.pause();
            unschedule();
            const outputTransaction = replayOutputGate.begin();
            if (!outputTransaction.accepted) return outputTransaction;
            replayingDebugHistory = true;
            let result;
            try {
                result = instructionReplay.reverseToEvent(eventCursor);
            } finally {
                replayingDebugHistory = false;
                eventBreakpointDispatcher?.clear();
            }
            if (result.accepted) {
                reverseCursor = eventCursor;
                status = {phase: 'paused', message: ''};
            }
            // The replay is synchronous: no historical intermediate state may
            // escape, and both success and rollback publish one complete view
            // of the machine that is now live.
            const synchronized = replayOutputGate.resynchronize(snapshot());
            if (!synchronized.accepted && result.accepted) return synchronized;
            return result;
        },
        reverseDebugToCycle: eventCursor => {
            recordingSession.stop();
            if (session) session.pause();
            unschedule();
            const outputTransaction = replayOutputGate.begin();
            if (!outputTransaction.accepted) return outputTransaction;
            replayingDebugHistory = true;
            let result;
            try {
                result = cycleReplay.reverseToCycle(eventCursor);
            } finally {
                replayingDebugHistory = false;
                eventBreakpointDispatcher?.clear();
            }
            if (result.accepted) {
                reverseCursor = eventCursor;
                status = {phase: 'paused', message: ''};
            }
            const synchronized = replayOutputGate.resynchronize(snapshot());
            if (!synchronized.accepted && result.accepted) return synchronized;
            return result;
        },
        canReverseDebug: () => instructionReplay.canReverse(),
        canReverseCycleDebug: () => cycleReplay.canReverse(),
        reverseStepDebugCycleStatus() {
            if (reverseHistoryRefusal) return reverseHistoryRefusal;
            const capability = cycleReplay.canReverse();
            if (!capability.accepted) return capability;
            const retained = activeBranchPayload.recorder.retention();
            const before = reverseCursor ??
                (retained.lastEventSeq === null ? 0 : retained.lastEventSeq + 1);
            let previous;
            try {
                previous = activeBranchPayload.recorder.previousCycleBoundaryCursor(before);
            } catch (error) {
                return {accepted: false, code: 'reverse-cycle-history-unavailable',
                    reason: error?.message || String(error)};
            }
            return previous === null ? {accepted: false, code: 'no-previous-cycle',
                reason: 'No earlier recorded cycle boundary is retained'} :
                {accepted: true, beforeCursor: before, eventCursor: previous};
        },
        reverseStepDebugCycle() {
            const state = this.reverseStepDebugCycleStatus();
            if (!state.accepted) return state;
            const result = this.reverseDebugToCycle(state.eventCursor);
            if (result.accepted) reverseContinue.reset();
            return result;
        },
        reverseStepDebugStatus() {
            if (reverseHistoryRefusal) return reverseHistoryRefusal;
            const capability = instructionReplay.canReverse();
            if (!capability.accepted) return capability;
            const retained = activeBranchPayload.recorder.retention();
            const before = reverseCursor ??
                (retained.lastEventSeq === null ? 0 : retained.lastEventSeq + 1);
            let previous;
            try {
                previous = activeBranchPayload.recorder.previousInstructionBoundaryCursor(before);
            } catch (error) {
                return {accepted: false, code: 'reverse-history-unavailable',
                    reason: error?.message || String(error)};
            }
            return previous === null
                ? {accepted: false, code: 'no-previous-instruction',
                    reason: 'No earlier recorded instruction boundary is retained'}
                : {accepted: true, beforeCursor: before, eventCursor: previous};
        },
        reverseStepDebugInstruction() {
            const status = this.reverseStepDebugStatus();
            if (!status.accepted) return status;
            const result = this.reverseDebugToEvent(status.eventCursor);
            if (result.accepted) reverseContinue.reset();
            return result;
        },
        reverseContinueDebugStatus() {
            const retained = activeBranchPayload.recorder.retention();
            const before = reverseCursor ??
                (retained.lastEventSeq === null ? 0 : retained.lastEventSeq + 1);
            return reverseContinue.status(before);
        },
        reverseContinueDebug() {
            const retained = activeBranchPayload.recorder.retention();
            const before = reverseCursor ??
                (retained.lastEventSeq === null ? 0 : retained.lastEventSeq + 1);
            return reverseContinue.reverse(before);
        },
        seekSelectedDebugStatus() {
            return selectedEventSeek.status(debugFoundation.timeline.state().selectedEvent);
        },
        seekSelectedDebugEventStatus() {
            return this.seekSelectedDebugStatus();
        },
        seekSelectedDebugEvent() {
            return selectedEventSeek.seek(debugFoundation.timeline.state().selectedEvent);
        },
        clearTrace() { trace.clear(); emit(); },

        /**
         * One instruction, synchronously. The TUI's space bar.
         *
         * Each step ends in a halt, and the halt handler records a trace row —
         * so stepping IS how an instruction-by-instruction trace gets built,
         * and nothing extra is recorded here. An earlier version recorded again
         * from this loop and produced two rows per step.
         *
         * A free run does NOT trace every instruction, and cannot: a row is
         * about thirty WASM calls, against eleven million instructions a second.
         * emu8051's TUI has the same limit from the other side — it records per
         * instruction because its loop single-steps, and at speed it stops
         * keeping up too. The trace pane says which it is showing rather than
         * presenting the gap as a complete history.
         */
        stepInstruction(count = 1) {
            if (!target) return { unsupported: 'nothing is running yet' };
            const forked = beginForwardBranch();
            if (!forked.accepted) return forked;
            reverseCursor = null;
            reverseContinue.reset();
            for (let i = 0; i < count; i++) {
                const refusal = target.step('insn', 1);
                if (refusal) return refusal;
                // Pump until the step lands. One instruction is a handful of
                // cycles, so this is bounded and fast.
                for (let n = 0; n < 4096 && target.state() === 'running'; n++) {
                    target.runFor(1000);
                }
            }
            emit();
            return undefined;
        },

        /** `over` and `out`, which the target defines in terms of SP. */
        stepOver() {
            const forked = beginForwardBranch();
            if (!forked.accepted) return forked;
            reverseCursor = null;
            reverseContinue.reset();
            return session ? session.step('over') : { unsupported: 'not running' };
        },
        stepOut() {
            const forked = beginForwardBranch();
            if (!forked.accepted) return forked;
            reverseCursor = null;
            reverseContinue.reset();
            return session ? session.step('out') : { unsupported: 'not running' };
        },

        runToAddress(address) {
            if (!target || !session) return {accepted: false, code: 'run-to-unavailable',
                reason: 'nothing is running yet'};
            const forked = beginForwardBranch();
            if (!forked.accepted) return forked;
            const coordinator = addressRunTo();
            const result = coordinator.startAddress(address);
            if (!result.accepted) {
                setStatus('paused', result.reason);
                return result;
            }
            activeRunTo = {generation: result.generation, address};
            reverseCursor = null;
            reverseContinue.reset();
            setStatus('running', S('run.runningTo', {address: address.toString(16)}));
            schedule();
            return result;
        },

        /**
         * The user's OWN variables, by the name they typed.
         *
         * This is the pane a debugger for this audience should lead with. Not
         * A/B/DPTR — `counter`, with the value in it. Every one is a 16-bit
         * signed int because that is what generateC emits, and SDCC stores
         * them little-endian.
         */
        variables() {
            if (!target) return [];
            return variableTable.map((v) => {
                // READ THE DECLARED WIDTH, not always two bytes. This read was
                // hard-coded at 2, so every variable the symbol table declares
                // narrower than that had its NEIGHBOUR spliced into the high
                // byte and the result reported with full confidence. Found on
                // 2026-08-31 in this lane's own browser screenshot, which showed
                // `bw_calm` as 2561 in one run and -11775 in another; measured
                // at node level against the shipped nano03-two-tasks image, the
                // byte is size 1 and holds 0 while the 2-byte read gives 59136.
                //
                // Two is still the FALLBACK, because the pane exists for the
                // user's own variables and `generateC` emits those as 16-bit
                // ints — an 8051 symbol table that omits `size` must keep
                // behaving exactly as before.
                const size = v.size > 0 ? v.size : 2;
                const bytes = target.readMem(v.space, v.addr, size);
                let raw = 0;
                for (let i = size - 1; i >= 0; i--) raw = (raw * 256) + (bytes[i] || 0);
                // Scratch's numbers are signed; at the emitter's own 16-bit
                // width 0xFFFF is -1, not 65535. Applied ONLY at that width:
                // nothing in the symbol table declares a sign, so reading a
                // one-byte counter as signed would turn 255 into -1 on exactly
                // the variables this fix exists to stop guessing about.
                return {
                    name: v.name,
                    sprite: v.sprite || null,
                    value: (size === 2 && raw > 0x7FFF) ? raw - 0x10000 : raw,
                    where: `${v.space} 0x${v.addr.toString(16).toUpperCase()}`
                };
            });
        },

        /**
         * Each declared pin as a PHYSICAL fact, not a register bit.
         *
         * The board is the authority: it knows the resolved level and what is
         * wired there, and it already applies the active-low inversion. An
         * ANALOG pin reports volts, because that is what the part does — the
         * conversion to counts is the MCU's business (boundary A).
         */
        pins() {
            if (!board) return [];
            return pinTable.map((p) => {
                const id = p.where ? p.where.toLowerCase() : `P${p.port}.${p.bit}`;
                const out = { name: p.name, pin: id, direction: p.direction,
                    activeLow: !!p.activeLow };
                try {
                    if (p.direction === 'analog') {
                        out.volts = board.readAnalog(id);
                    } else {
                        const level = board.readPin(id);
                        out.level = level;
                        // What the USER called it: an active-low LED driven
                        // low is ON, and saying "0" here would teach the
                        // opposite of the thing this board exists to teach.
                        out.on = p.activeLow ? level === 0 : level === 1;
                    }
                } catch { /* a pin with nothing wired to it has no reading */ }
                return out;
            });
        },

        /** LED brightnesses by part id, so the panel can show them lit. */
        leds() {
            if (!board) return [];
            return board.getLeds().map((id) => ({ id, brightness: board.ledBrightness(id) }));
        },

        /**
         * What the program looked like the last time it was AT this block.
         *
         * The debugger's answer to "what was `counter` here?", which is the
         * question a learner actually has and the one a live-values pane
         * cannot answer: by the time you look, the program has moved on.
         * Every recorded stop already carries a full variable snapshot and the
         * position it was taken at, so this is a lookup, not new machinery.
         *
         * Returns null when this block has never been stopped at — which is
         * the honest answer, and different from "all its variables were zero".
         *
         * @param {string} blockId
         * @returns {{variables: Array, tNs: bigint, agoMs: number, why: string} | null}
         */
        valuesAtBlock(blockId) {
            const y = yieldOf.get(blockId);
            if (!y) return null;
            const rows = trace.rows();
            for (let i = rows.length - 1; i >= 0; i--) {
                const row = rows[i];
                if (!row.variables || !row.tasks) continue;
                // The row was taken while this task sat in this state — which
                // is exactly "the program was at this block".
                const here = row.tasks.some((t) => t.task === y.task && t.state === y.state);
                if (!here) continue;
                const now = target ? target.timeNs() : row.tNs;
                return {
                    variables: row.variables,
                    tNs: row.tNs,
                    // Clamped: when the program is paused AT this block, now
                    // and the row are the same instant, and `-0 ms ago` is a
                    // JS artefact rather than a fact about the program.
                    agoMs: Math.max(0, Number(now - row.tNs) / 1e6),
                    why: row.why,
                    kind: y.kind
                };
            }
            return null;
        },

        /** Program time, in ms, or null before anything has run. */
        timeMs: () => (target ? Number(target.timeNs()) / 1e6 : null),

        /** The board, so a circuit panel can render what the program is doing. */
        board: () => board,

        symbols: () => symbols,

        destroy({preserveRuntime = false} = {}) {
            publishBasicSerial(false);
            i8086ExecutionLifetime.abort();
            i8086Execution.release(i8086ExecutionResult);
            // The aborted lifetime fences reentry even if release throws.
            hddSnapshotOwner = {};
            i8086ExecutionResult = null;
            destroyed = true;
            disposeTerminal?.();
            disposeTerminal = null;
            terminalFrame = null;
            if (!preserveRuntime) {setValueResolver(null);
                if (vm && vm.runtime) delete vm.runtime._bwDebugVariables;}
            unschedule();
            if (activeRunTo) {
                runToController.cancel();
                activeRunTo = null;
            }
            if (unsubscribeBps) { unsubscribeBps(); unsubscribeBps = null; }
            if (unsubscribeDebugEvents) { unsubscribeDebugEvents(); unsubscribeDebugEvents = null; }
            debugEventsTarget = null;
            if (unsubscribeDebugInputs) { unsubscribeDebugInputs(); unsubscribeDebugInputs = null; }
            if (unsubscribeCp1Lessons) { unsubscribeCp1Lessons(); unsubscribeCp1Lessons = null; }
            cancelCp2Recording();
            cp1LessonBatch?.clear();
            cp1LessonBatch = null;
            unsubscribeRecordingEvents();
            if (!preserveRuntime) clearGlow();
            const cleanupErrors = [];
            try { if (session) session.destroy(); }
            catch (error) { cleanupErrors.push(error); }
            // Machine-bench targets carry no destroy (nothing to free — the
            // machine is plain JS); the 8051 target's tears down WASM state.
            const releaseS040 = releaseEsp32S040Target;
            releaseEsp32S040Target = null;
            try {
                if (releaseS040) releaseS040();
                else if (target && typeof target.destroy === 'function') target.destroy();
            } catch (error) { cleanupErrors.push(error); }
            // The run board dies with the runner too, as in stop(): a destroyed
            // runner's board left published was still what Widgets resolved.
            if (vm && vm.runtime && board && vm.runtime.bwRunBoard === board) {
                delete vm.runtime.bwRunBoard;
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));
            }
            session = target = board = symbols = null;
            delete runner.esp32S040PartId;
            delete runner.video;
            runToTarget = runToController = null;
            for (const branch of forkRecordingStore.summaries()) {
                const payload = forkRecordingStore.recordingFor(branch.branchId).recording;
                payload.recordingSession.stop();
                payload.recorder.clear();
                payload.haltOccurrences.clear();
            }
            debugFoundation.clear();
            resetEventBreakpointRuntime();
            if (cleanupErrors.length === 1) throw cleanupErrors[0];
            if (cleanupErrors.length > 1) throw new AggregateError(cleanupErrors, 'Debugger cleanup failed');
        }
    };

    /**
     * Bring the target's breakpoints in line with the user's.
     *
     * Called on every change to the shared store, and once when a target first
     * exists. A marked block with no yield point in THIS build is left
     * unresolved rather than dropped: the store is the user's intent, and a
     * later build may well give it an address (`unreachableBreakpoints` in the
     * snapshot is what a UI shows for those).
     */
    function syncBreakpoints(ids) {
        if (!target) return;
        const wanted = new Set(ids);
        let changed = false;
        for (const [blockId, handle] of [...bps]) {
            if (wanted.has(blockId)) continue;
            if (handle !== null) target.clearBreakpoint(handle);
            bps.delete(blockId);
            changed = true;
        }
        for (const blockId of wanted) {
            if (bps.has(blockId)) continue;
            const y = yieldOf.get(blockId);
            if (!y) continue;                      // no yield point in this build
            const handle = target.setBreakpoint({ kind: 'yield', task: y.task, state: y.state });
            bps.set(blockId, typeof handle === 'number' ? handle : null);
            changed = true;
        }
        if (changed) breakpointGeneration++;
    }

    reverseContinue = createReverseContinueCoordinator({
        canReverse: () => reverseHistoryRefusal || haltLedgerRefusal ||
            (cycleReplay.canReverse().accepted ? cycleReplay.canReverse() : instructionReplay.canReverse()),
        haltOccurrences: {
            previousBeforeBoundary: cursor =>
                activeBranchPayload.haltOccurrences.previousBeforeBoundary(cursor),
            previousByOccurrenceCursor: cursor =>
                activeBranchPayload.haltOccurrences.previousByOccurrenceCursor(cursor)
        },
        reverseToEvent: eventCursor => cycleReplay.canReverse().accepted ?
            runner.reverseDebugToCycle(eventCursor) : runner.reverseDebugToEvent(eventCursor)
    });
    eventBreakpointDispatcher = createEventBreakpointDispatcher({
        engine: {evaluate: (event, context) => debugFoundation.evaluateBreakpoints(event, context)},
        recordingSession,
        handlers: {
            log: (action, context) => {
                eventBreakpointLog.push({breakpointId: action.breakpointId,
                    eventSeq: context.triggerEventSeqs?.[0] ?? context.event?.seq ?? null});
                if (eventBreakpointLog.length > 256) eventBreakpointLog.shift();
            },
            counter: action => {
                const name = String(action.name || action.counter || action.breakpointId);
                const value = (eventBreakpointCounters.get(name) || 0) + (Number(action.delta) || 1);
                eventBreakpointCounters.set(name, value);
                return value;
            },
            halt: () => {
                if (session) session.pause();
                unschedule();
            },
            onActionError: failure => {
                eventBreakpointFailures.push(failure);
                if (eventBreakpointFailures.length > 64) eventBreakpointFailures.shift();
            }
        }
    });
    replayBreakpointDispatcher = createEventBreakpointDispatcher({
        engine: {evaluate: (event, context) => debugFoundation.evaluateBreakpoints(event, context)},
        suppressedActions: ['log', 'checkpoint', 'capture', 'write', 'halt', 'script-safe-expression'],
        handlers: {
            // Counter actions are debugger-host state and may feed later
            // count predicates. External log/checkpoint/write/halt actions
            // remain suppressed while the recorded prefix is reconstructed.
            counter: action => {
                const name = String(action.name || action.counter || action.breakpointId);
                const value = (eventBreakpointCounters.get(name) || 0) + (Number(action.delta) || 1);
                eventBreakpointCounters.set(name, value);
                return value;
            }
        }
    });
    selectedEventSeek = createSelectedEventSeekCoordinator({
        canReverse: () => reverseHistoryRefusal || instructionReplay.canReverse(),
        reverseToEvent: eventCursor => runner.reverseDebugToEvent(eventCursor),
        onAccepted: () => reverseContinue.reset()
    });
    // Stop retains a loaded target for inspection, so direct register/reset
    // and cycle commands also need the same canvas ownership gate as Run.
    for (const name of ['resetCpu', 'wipe', 'stepCycle', 'restoreSnapshot', 'writeMem', 'writeReg', 'setPc',
        'cp1Reset', 'cp1LoadProgram', 'cp1RunProgram', 'cp1WriteCell', 'cp1SetInput', 'cp1Key']) {
        const mutate = runner[name];
        runner[name] = function (...args) {
            return circuitMutationRefusal() || mutate.apply(this, args);
        };
    }
    return runner;
}

/**
 * Is the pause point we halted on a `wait` that has not finished waiting?
 *
 * Pure, and exported, because the defect it encodes (D-EMU-BP2) was a
 * SEMANTICS error rather than a wiring one: the old version asked "is ANY task
 * still waiting?" while its doc comment said "the task we stopped in". With
 * two scripts running, one sitting in a `wait 1 seconds` swallowed every
 * breakpoint in the project for as long as it waited — including a mark on a
 * `repeat` loop top, which has no deadline of its own and halts correctly on
 * the very first pass. The breakpoint fired, the halt was announced, and this
 * predicate threw it away, so the run continued and the mark looked dead.
 *
 * A closure-private version could only be tested through a live session, and
 * the only gate that drove one is skipped in CI for want of SDCC — so the fix
 * would have had no gate at all. It takes its inputs instead of reaching for
 * them.
 *
 * Two conditions, both necessary:
 *   1. the halt is on a block whose yield IS a `wait` — nothing else is
 *      re-entered by the dispatch loop on every pass, which is the only thing
 *      this suppression exists to absorb; and
 *   2. THAT block's own task is still counting down.
 *
 * The comparison mirrors the generated C exactly: `(int)(bw_now() - until) < 0`,
 * a wraparound-safe 16-bit compare. A task with no deadline (`until` absent,
 * which is how the target reports a task that is not waiting or has finished)
 * is never still waiting.
 *
 * @param {{why: object, blockYield: {task: string, kind: string}|undefined,
 *          bwMs: number|undefined}} arg
 * @returns {boolean} true if this halt should be swallowed
 */
export function waitStillPending({why, blockYield, bwMs}) {
    if (!why || !why.tasks || !blockYield) return false;
    if (blockYield.kind !== 'wait') return false;
    if (bwMs === undefined) return false;
    const t = why.tasks.find((entry) => entry.task === blockYield.task);
    if (!t || t.until === undefined) return false;
    const delta = (bwMs - t.until) & 0xFFFF;
    const signed = delta > 0x7FFF ? delta - 0x10000 : delta;
    return signed < 0;
}
