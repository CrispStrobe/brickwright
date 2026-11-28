/**
 * Real-mode DOS programs on the actual experimental 80386 core.
 *
 * Two explicit entries share the same fixed real-mode hardware. The service
 * entry loads COM/MZ programs directly; the boot entry starts a 360 KiB DOS
 * disk whose real kernel loads programs and owns INT 21h. BIOS services are
 * supplied by the adapter; neither entry executes a ROM BIOS or emulates a
 * hardware disk controller. Protected-mode DOS extenders, native-block
 * dispatch and architectural replay remain unavailable. Service register
 * writes update the 386's segment caches and FLAGS; every guest instruction
 * executes on ExperimentalI80386.
 */
export async function createI80386DosBench (opts = {}) {
    if (!['com', 'exe'].includes(opts.format)) {
        throw new Error('the 386 DOS service accepts COM or MZ EXE programs');
    }
    return createI80386DosMachine(opts, false);
}

export async function createI80386DosBootBench (opts = {}) {
    if (opts.format !== 'disk' || !(opts.bytes instanceof Uint8Array) || opts.bytes.length !== 368640) {
        throw new Error('the 386 DOS boot bench requires a 360 KiB disk image');
    }
    return createI80386DosMachine(opts, true);
}

async function createI80386DosMachine (opts, diskBoot) {
    const {bytes, format, onChar, onExit} = opts;
    if (!(bytes instanceof Uint8Array) || !bytes.length) {
        throw new Error('the 386 DOS bench needs a nonempty byte image');
    }
    if (opts.variant !== undefined && opts.variant !== '80386') throw new Error('the 386 DOS bench needs the 80386 CPU');
    if (opts.nativeBlocks || opts.chips || opts.config) {
        throw new Error('the 386 DOS service has a fixed ordinary real-mode machine');
    }
    if (opts.executionSignal?.aborted) throw new Error('386 DOS attachment was cancelled');
    const [{ExperimentalI80386ATMachine}, {createDos8086, DOSBOX8086_XT},
        {createI80386DebugTarget}, {renderMode, likelyMode}] = await Promise.all([
        import(/* webpackChunkName: "bw-debug-i80386-dos" */ 'bw-board/experimental/i80386-at-machine.js'),
        import(/* webpackChunkName: "bw-debug-i80386-dos" */ 'bw-board/i8086-dos.js'),
        import(/* webpackChunkName: "bw-debug-i80386-dos" */ 'bw-board/i80386-debug.js'),
        import(/* webpackChunkName: "bw-debug-i80386-dos" */ 'bw-board/i8086-cga.js')
    ]);
    if (opts.executionSignal?.aborted) throw new Error('386 DOS attachment was cancelled');
    const machine = new ExperimentalI80386ATMachine({
        ...DOSBOX8086_XT,
        variant: '80386', cpuBackend: 'i80386-experimental',
        clockHz: 16_000_000,
        // A deterministic device-scheduling charge, not measured 386 timing.
        functionalInstructionCycles: 6
    });
    const cpu = machine.cpu;
    const segments = ['es', 'cs', 'ss', 'ds', 'fs', 'gs'];
    const ensureRealMode = () => {
        if (cpu.protectedMode || cpu.virtual8086 || (cpu.cr0 & 0x80000000) ||
            Object.values(cpu.segmentCaches).some(cache => cache.default32 || cache.limit !== 0xffff)) {
            throw new Error('the 386 DOS machine supports ordinary 16-bit real mode only');
        }
    };
    // A plain visible CS write is insufficient on the 386: execution reads
    // the cached base. Keep the service facade private so the debugger sees
    // the real 32-bit core and its architectural registers, never a proxy.
    const serviceCpu = new Proxy(cpu, {
        get (target, property) {
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
        set (target, property, value) {
            const segment = segments.indexOf(property);
            if (segment !== -1) {
                ensureRealMode();
                target._loadSeg(segment, value & 0xffff);
            } else if (property === 'flags') {
                // createDos8086 restores 8086 reserved FLAGS bits as F000h.
                // On a 386 these are architectural IOPL/NT bits. DOS changes
                // arithmetic status only; retain the actual caller's high
                // FLAGS rather than inventing the older CPU's reserved ones.
                target.flags = (target.flags & 0xf000) | (value & 0x0fff);
            } else {
                Reflect.set(target, property, value, target);
            }
            return true;
        }
    });
    const serviceMachine = {
        cpu: serviceCpu, config: machine.config, clockHz: machine.clockHz,
        get cycles () { return machine.cycles; },
        set cycles (value) { machine.cycles = value; },
        get tMs () { return machine.tMs; },
        // Go through the 386 physical write path to invalidate its caches.
        _read: address => machine._read386(address),
        _write: (address, value) => machine._write386(address, value),
        _out: (port, value) => machine._out(port, value),
        hasHardwareTimerIrq: () => machine.hasHardwareTimerIrq(),
        step: () => machine.step()
    };
    const files = opts.files instanceof Map ? opts.files : new Map();
    // Guest writes belong to this machine's fresh disk, never the caller's
    // validated media. The kernel replaces the service INT 21h vector while
    // booting; BIOS disk and console traps remain active.
    const disk = diskBoot ? bytes.slice() : null;
    const dos = createDos8086(serviceMachine, {files, onChar: onChar || null,
        ...(diskBoot ? {disk, geometry: {sectors: 9, heads: 2}} : {}),
        keys: opts.keys || [], blockOnKey: true}).install();
    if (diskBoot) dos.loadBoot(disk.subarray(0, 512), 0);
    else if (format === 'exe') dos.loadExe(bytes, {args: opts.args});
    else dos.loadCom(bytes, {args: opts.args});
    ensureRealMode();
    let announced = false;
    const step = () => {
        ensureRealMode();
        if (dos.terminated) {
            cpu.halted = true;
            return machine.step();
        }
        const cycles = dos.step();
        if (dos.terminated && !announced) {
            announced = true;
            onExit?.(dos.exitCode);
        }
        return cycles;
    };
    const target = createI80386DebugTarget({machine, step});
    // The generic 386 target has no DOS mode-log option. Render the service's
    // actual selected mode and memory, including the mode-3 80x25 text page.
    let videoKey = null, videoFrame = null;
    target.video = () => {
        const seen = dos.videoModeLog();
        const mode = likelyMode(seen);
        if (!mode.supported) return {unsupported: `mode ${mode.mode.toString(16)}h: ${mode.reason}`};
        const key = `${machine.displayRevision || 0}:${mode.mode}:${seen.join(',')}`;
        if (key !== videoKey) {
            videoFrame = {...renderMode(mode.mode, address => machine._read386(address)),
                frame: machine.displayRevision || 0, mode: mode.mode, why: mode.reason};
            videoKey = key;
        }
        return videoFrame;
    };
    return {
        machine, dos, target, format, files, step,
        sendKeys: text => dos.type(text),
        screenText: () => dos.screenText(), report: () => dos.report(),
        get terminated () { return dos.terminated; },
        get exitCode () { return dos.exitCode; }
    };
}

export default createI80386DosBench;
