// SPDX-License-Identifier: BSD-3-Clause
import {kim1T} from './kim1-l10n.js';
export async function createKim1Tty ({locale = 'en', setup, boot, bootPrompt, commandPrompt, exportFiles, exportImage, encodeInput = line => line + '\r', title, inputLabel, help}) {
    const {createKim1Machine, controlKim1Machine, stepKim1Machine} =
        await import(/* webpackChunkName: "bw-kim1-tty" */ 'bw-board/kim1-machine.js');
    const machine = createKim1Machine('; KIM-1 expanded RAM\n0200: EA');
    const control = (verb, value) => {
        if (!controlKim1Machine(machine, verb, value)) throw new Error(kim1T(locale, 'ttyRejected', {verb}));
    };
    control('useBrickwrightRom');
    setup(control);
    control('setTty', {enabled: true, baud: 300});

    const listeners = new Set();
    let shown = '';
    let phase = 'monitor';
    let begin = '';
    let lastActivity = 0;
    let pendingLine = null;
    let remaining = 24_000_000;
    let timer = null;
    let closed = false;
    const publish = text => {
        if (shown === text) return;
        shown = text;
        for (const listener of listeners) listener(text);
    };
    const schedule = () => { if (!closed) timer = setTimeout(pump, 0); };
    const beginCommand = line => {
        control('sendTty', encodeInput(line, shown));
        begin = shown;
        lastActivity = machine.cpu.cycles;
        remaining = 80_000_000;
        phase = 'command';
    };
    function pump () {
        timer = null;
        try {
            const until = machine.cpu.cycles + Math.min(remaining, 100_000);
            while (machine.cpu.cycles < until && machine.running && !machine.error) {
                const elapsed = stepKim1Machine(machine);
                if (elapsed <= 0) break;
                remaining -= elapsed;
            }
            const transcript = machine.ttyOutput.replace(/[^\x20-\x7e\r\n\t\b]/g, '');
            if (transcript !== shown) lastActivity = machine.cpu.cycles;
            if (machine.error || !machine.running || remaining <= 0) {
                throw new Error(machine.error || kim1T(locale, 'ttyBudget'));
            }
            if (phase === 'monitor' && /KIM>/.test(transcript)) {
                control('sendTty', boot);
                phase = 'boot';
            } else if (phase === 'boot' && bootPrompt.test(transcript)) {
                phase = 'ready';
            } else if (phase === 'command' &&
                (commandPrompt ? transcript !== begin && commandPrompt.test(transcript) :
                    !machine.frontPanel.incoming.length && machine.cpu.cycles - lastActivity > 700_000)) {
                phase = 'ready';
            }
            if (phase === 'ready' && pendingLine !== null) {
                const line = pendingLine;
                pendingLine = null;
                beginCommand(line);
            }
            if (phase !== 'ready') schedule();
            publish(transcript);
        } catch (error) {
            phase = 'error';
            publish(shown + '\n' + error.message);
        }
    }
    return {
        title, inputLabel, help, focusOnOpen: true,
        exportFiles: exportFiles && (() => exportFiles(machine.corshamDisk.exportFiles())),
        exportImage: exportImage && (() => exportImage(machine.corshamDisk.exportFiles(), () => !closed)),
        start () { if (!closed && timer === null && phase === 'monitor') schedule(); },
        subscribe (listener) {
            listeners.add(listener);
            listener(shown);
            return () => listeners.delete(listener);
        },
        send (line) {
            if (closed || !/^[\x20-\x7e]{0,126}$/.test(line)) return false;
            if (!commandPrompt && phase === 'command' && pendingLine === null) {
                pendingLine = line;
                return true;
            }
            if (phase !== 'ready') return false;
            beginCommand(line);
            schedule();
            return true;
        },
        dispose () {
            closed = true;
            clearTimeout(timer);
            timer = null;
            listeners.clear();
        }
    };
}
