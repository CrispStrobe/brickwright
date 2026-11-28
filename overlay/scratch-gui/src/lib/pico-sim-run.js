import {createFreshPicoEpoch, createPicoByteChannel} from './pico-sim-epoch.js';

/**
 * Run a MicroPython program on the Pico IN THE SIMULATOR (N3c).
 *
 * The Pico ▶ Run boots the pinned MicroPython firmware in rp2040js and runs the
 * program over the SAME createPicoRepl deployment the silicon path uses:
 * write main.py, trigger machine.reset(), preserve flash, and boot a fresh SoC.
 * Every later watchdog reset repeats that whole-controller replacement; the
 * external circuit board is the only live host object retained between epochs.
 *
 * DRIVE MODEL. One driver: a requestAnimationFrame pump advances the emulator
 * each frame (adapter.advanceNs, which also pushes board time and fires the
 * GPIO→board→ledBrightness chain). The createPicoRepl transport does NOT drive
 * the CPU itself — its reads await bytes the pump produces — so there is no
 * double-stepping race. Deployment returns when its reset is queued; the Run
 * waits for a replacement epoch and USB enumeration before reporting running.
 * Stop sends Ctrl-C and cancels the pump. Sleeps are cheap: MicroPython's
 * time.sleep parks the core in WFE and advanceNs fast-forwards the clock to the
 * next alarm instead of executing idle instructions.
 *
 * The boot cost is the emulator's: MicroPython v1.22.2 reaches its REPL in
 * ~1.3M instructions (~1–2.6 s wall on a shared box, measured 2026-09-06); the
 * pump absorbs it after a "booting" status, and the createPicoRepl timeout is
 * set well above it.
 *
 * @module
 */

const CTRL_C = '\x03';

/** Pico core clock and the ADC reference — a 3.3 V, 125 MHz part. */
const CLOCK_HZ = 125_000_000;
const VCC = 3.3;

/** Sim time advanced per animation frame. Sleeps fast-forward through this via
 *  WFE, so a sleepy program (the usual blink) paces near real time; a busy loop
 *  runs slower than real time, which is acceptable for a teaching simulator. */
const SLICE_NS = 8_000_000; // 8 ms of sim time per frame

/**
 * Boot MicroPython, install `py`, and reboot it as main.py while driving the
 * board's GPIO. The caller has already refused an absent firmware image.
 *
 * @param {object}   opts
 * @param {Uint8Array} opts.image  flat flash image (loadPicoFirmware().image)
 * @param {object}   opts.vm       the scratch-vm (for the RUN board + circuit)
 * @param {object}   opts.stc      the project's STC descriptor (pins, device)
 * @param {string}   opts.py       the MicroPython program
 * @param {(s: string) => void} [opts.onStatus]  user-facing status
 * @param {(e: Error) => void}  [opts.onError]   a runtime traceback from the program
 * @param {AbortSignal} [opts.signal] cancels startup or a running simulator
 * @returns {Promise<{stop: () => void}>}  resolves once the program is running;
 *          call stop() to interrupt it and tear the run down. Throws before that
 *          if the circuit on the canvas was rejected (resolveNetlist refuses a
 *          phantom bench by name) — the caller shows the message.
 */
export async function startPicoSimRun (options) {
    const runtime = options.vm?.runtime;
    if (runtime?.bwCrispBasicSimulation) throw new Error('Stop BASIC before starting the Pico simulator');
    if (runtime?.bwCircuitRunPreparing) throw new Error('Another circuit run is preparing');
    const preparation = {};
    if (runtime) runtime.bwCircuitRunPreparing = preparation;
    try { return await startPicoSimRunOwned(options); }
    finally { if (runtime?.bwCircuitRunPreparing === preparation) delete runtime.bwCircuitRunPreparing; }
}

async function startPicoSimRunOwned ({image, vm, stc, py, onStatus, onError, signal}) {
    const status = onStatus || (() => {});
    // Code-tab source/target replacement can happen before the asynchronous
    // startup returns its handle. Retain the existing Pico route while giving
    // that caller a cancellation boundary throughout boot and deployment.
    let board = null;
    let channel = null;
    let interrupt = null;
    let observation = null;
    let rafId = null;
    let stopped = false;
    const cancelled = new Error('the Pico simulator was stopped');
    cancelled.name = 'AbortError';
    const cancelRaf = typeof cancelAnimationFrame === 'function' ?
        cancelAnimationFrame : clearTimeout;
    const requireActive = () => {
        if (stopped || signal?.aborted) throw cancelled;
    };
    let rejectAbort;
    const aborted = signal ? new Promise((resolve, reject) => {
        rejectAbort = reject;
    }) : null;
    let abort = null;

    const teardown = () => {
        if (stopped) return;
        stopped = true;
        if (signal) signal.removeEventListener('abort', abort);
        if (rafId !== null) {
            cancelRaf(rafId);
            rafId = null;
        }
        // Interrupt only this run's transport, including an in-flight deploy.
        try {
            if (interrupt) interrupt();
        } catch { /* teardown remains idempotent */ }
        if (channel) channel.fail(cancelled);
        // An older startup may settle after its successor published a board.
        // It owns neither the successor's canvas binding nor its observation.
        if (board && vm && vm.runtime && vm.runtime.bwRunBoard === board) {
            delete vm.runtime.bwRunBoard;
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));
        }
        if (observation && typeof window !== 'undefined' && window.__bwPicoSim === observation) {
            try {
                delete window.__bwPicoSim;
            } catch { /* read-only observation may be unavailable */ }
        }
    };
    abort = () => {
        teardown();
        rejectAbort(cancelled);
    };

    requireActive();
    if (signal) signal.addEventListener('abort', abort, {once: true});
    const starting = (async () => {
        status('starting the Pico simulator…');
        requireActive();

        // Heavy deps behind dynamic import — its own chunk, off the entry bundle,
        // the labwired-engine.js discipline. rp2040js carries USBCDC (the RPI_PICO
        // REPL is on USB, not UART0).
        const {BoardImpl, inferNetlist} = await import(
            /* webpackChunkName: "bw-board" */ 'bw-board');
        requireActive();
        const {createRp2040jsAdapter} = await import(
            /* webpackChunkName: "bw-board" */ 'bw-board/rp2040js-adapter');
        requireActive();
        const {resolveNetlist} = await import(
            /* webpackChunkName: "bw-board" */ './bw-debug/resolve-netlist.js');
        requireActive();
        const {createPicoRepl} = await import('./pico-repl.js');
        requireActive();
        const {USBCDC} = await import('rp2040js');
        requireActive();

        // One board, one truth — the SAME resolution the debugger uses (designer's
        // live circuit, else inferred; a rejected circuit refuses here by name).
        const netlist = await resolveNetlist(vm, stc, inferNetlist);
        if (vm?.runtime?.bwCrispBasicSimulation) throw new Error('Stop BASIC before starting the Pico simulator');
        requireActive();
        board = new BoardImpl(VCC);
        board.setNetlist(netlist.parts, netlist.nets);
        board.setPower(true);
        let adapter = null;
        let cdc = null;
        let usbConnected = false;

        // Device-side RX counter: tx counts bytes the HOST queued; this counts bytes
        // the FIRMWARE actually pulled from that queue (the OUT-endpoint read drains
        // the CDC txFIFO). rx << tx names a host→device delivery loss; rx == tx with
        // no OK names the firmware's handling. Wraps the handler and calls through —
        // read-only. Guarded, so an rp2040js internal rename degrades to rx=-1.
        let rxBytes = 0;
        channel = createPicoByteChannel();
        let usb = '';                         // every CDC byte, kept for diagnostics
        let resetGeneration = 0;

        // Every SoC epoch gets a fresh USB host binding. The transport below reads
        // the mutable `cdc`, so pending deploy calls cross the watchdog boundary
        // onto the replacement controller without retaining the old peripheral.
        function bindUsbEpoch () {
            usbConnected = false;
            channel.clear();
            cdc = new USBCDC(adapter.rp2040.usbCtrl);
            cdc.onDeviceConnected = () => { usbConnected = true; };
            cdc.onSerialData = (buf) => {
                let text = '';
                for (const b of buf) text += String.fromCharCode(b);
                usb += text;
                channel.append(text);
            };
            try {
                const epochCdc = cdc;
                const usbCtrl = adapter.rp2040.usbCtrl;
                const origRead = usbCtrl.onEndpointRead;
                usbCtrl.onEndpointRead = (endpoint, size) => {
                    const before = (epochCdc.txFIFO && typeof epochCdc.txFIFO.itemCount === 'number') ?
                        epochCdc.txFIFO.itemCount : 0;
                    if (origRead) origRead(endpoint, size);
                    if (endpoint === epochCdc.outEndpoint && epochCdc.txFIFO) {
                        rxBytes += Math.max(0, before - epochCdc.txFIFO.itemCount);
                    }
                };
            } catch { rxBytes = -1; }
        }

        const adapterOptions = {clockHz: CLOCK_HZ, vcc: VCC};
        adapter = createFreshPicoEpoch({image, board, createAdapter: createRp2040jsAdapter, adapterOptions});
        bindUsbEpoch();
        requireActive();
        // Publish only after the complete initial controller/USB epoch exists. A
        // constructor failure must not leave a dead run board on the canvas.
        if (vm && vm.runtime) vm.runtime.bwRunBoard = board;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-board-ready'));
        requireActive();

        // Read-only observability for the browser gate — it reads this to localize a
        // stall: which handshake sub-phase, how many host→device bytes have left, and
        // whether the writes resolved. Changes NO run behavior.
        let frames = 0;
        let phase = 'booting';
        let subPhase = 'init';
        let lastError = null;
        let pumpError = null;
        let txBytes = 0;
        let txWrites = 0;
        let txDone = 0;
        if (typeof window !== 'undefined') {
            observation = {
                usbConnected: () => usbConnected,
                usbTail: () => usb.slice(-240),
                frames: () => frames,
                simMs: () => { try { return Math.round(adapter.rp2040.clock.nanos / 1e6); } catch { return -1; } },
                replReady: () => usb.includes('>>> ') || usb.includes('raw REPL'),
                phase: () => phase,
                subPhase: () => subPhase,
                tx: () => `bytes=${txBytes} writes=${txWrites} done=${txDone}`,
                rx: () => rxBytes,
                resetGeneration: () => resetGeneration,
                lastError: () => lastError
            };
            window.__bwPicoSim = observation;
        }
        interrupt = () => {
            for (const ch of CTRL_C + CTRL_C) cdc.sendSerialByte(ch.charCodeAt(0));
        };
        const transport = {
            async write (text) {
                requireActive();
                txWrites++;
                for (const ch of text) { cdc.sendSerialByte(ch.charCodeAt(0) & 0xff); txBytes++; }
                txDone++;
            },
            async read () {
                return channel.read();
            },
            // Let the pump run one frame so the device drains the packet just written
            // before the next arrives — a condition wait on the frame counter, not a
            // fixed sleep. The node oracle's transport has no drain and does not need
            // one; the chunking still exercises there.
            drain () {
                return new Promise(resolve => {
                    const start = frames;
                    const t = () => (frames > start || stopped ? resolve() : setTimeout(t, 4));
                    t();
                });
            }
        };

        // The single driver. Each frame advances the emulator; advanceNs pushes
        // board time and fires publishPin → board.setPin, so LEDs update live.
        const raf = (typeof requestAnimationFrame === 'function')
            ? requestAnimationFrame
            : (cb) => setTimeout(() => cb(Date.now()), 16);
        function pump () {
            rafId = null;
            if (stopped) return;
            try {
                adapter.advanceNs(SLICE_NS);
                if (stopped) return;
                frames++;
                if (adapter.takeResetRequest()) {
                    phase = 'rebooting';
                    adapter = createFreshPicoEpoch({
                        previous: adapter,
                        board,
                        createAdapter: createRp2040jsAdapter,
                        adapterOptions
                    });
                    bindUsbEpoch();
                    resetGeneration++;
                }
            } catch (e) {
                phase = 'error';
                lastError = e && e.message ? e.message : String(e);
                pumpError = e instanceof Error ? e : new Error(lastError);
                channel.fail(pumpError);
                status(`the Pico simulator stopped: ${lastError}`);
                return;                       // a faulted core: stop pumping
            }
            // Any read waiting on bytes the CPU just produced is woken by
            // onSerialData already; nothing to do here but re-arm.
            if (!stopped) rafId = raf(pump);
        }
        rafId = raf(pump);

        // Wait for the emulated host to enumerate USB before talking to the REPL:
        // MicroPython drops stdout until CDC reports DTR, so a knock before then is
        // simply lost (the probe learned this the hard way).
        status('booting MicroPython…');
        requireActive();
        try {
            await waitFor(() => usbConnected, () => stopped, 20_000, () => pumpError);
        } catch (e) {
            requireActive();
            phase = 'error';
            lastError = e && e.message ? e.message : String(e);
            teardown();
            throw e;
        }
        requireActive();
        phase = 'enumerated';

        // Install main.py through the SAME deploy path used for silicon. Its final
        // machine.reset() asks the host to replace the complete SoC; only after the
        // replacement enumerates USB do we report the standalone program running.
        try {
            const beforeReset = resetGeneration;
            subPhase = 'installing-main.py';
            await createPicoRepl(transport, {timeoutMs: 60_000}).deployMainPy(py);
            requireActive();
            subPhase = 'waiting-for-reset';
            await waitFor(() => resetGeneration > beforeReset, () => stopped, 20_000, () => pumpError);
            requireActive();
            subPhase = 'waiting-for-reboot';
            await waitFor(() => usbConnected, () => stopped, 20_000, () => pumpError);
        } catch (e) {
            requireActive();
            phase = 'error';
            lastError = e && e.message ? e.message : String(e);
            const failure = new Error(`the Pico simulator did not install and reboot the program: ${lastError}`);
            if (onError) onError(failure);
            teardown();
            throw failure;
        }
        requireActive();
        phase = 'running';
        status('running');

        return {stop: teardown};
    })();
    try {
        return await (aborted ? Promise.race([starting, aborted]) : starting);
    } catch (error) {
        teardown();
        throw error;
    }
}

/**
 * Resolve when `cond()` is true or `abort()` is, polling on macrotasks so the
 * rAF pump keeps running between checks. Rejects on timeout.
 */
export function waitFor (cond, abort, timeoutMs, failure) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const tick = () => {
            const error = failure && failure();
            if (error) return reject(error);
            if (abort && abort()) return resolve();
            if (cond()) return resolve();
            if (Date.now() > deadline) {
                return reject(new Error('the Pico simulator did not reach its REPL in time'));
            }
            setTimeout(tick, 16);
        };
        tick();
    });
}
