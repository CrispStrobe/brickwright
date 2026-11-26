// SPDX-License-Identifier: BSD-3-Clause
export const CONSOLE_6502_CHANGED = 'BW_6502_CONSOLE_CHANGED';

export const isConsoleMonitor = widget =>
    widget?.type === 'simplevga' && widget.binding?.target === 'part';

export function sendConsoleLine(runner, line) {
    if (typeof runner?.sendSerial !== 'function') return false;
    if (runner.sendBasicLine) return runner.sendBasicLine(line) !== false;
    return runner.sendSerial(`${line}\r`) !== false;
}
