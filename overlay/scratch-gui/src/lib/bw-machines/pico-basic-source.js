// Feed the UART editor one source line per BBC BASIC prompt. Number an
// unnumbered listing so even multi-line constructs are entered before RUN.
export function picoBasicCommands (source) {
    const lines = source.split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error('Enter a BASIC program first.');
    const numbered = lines.filter(line => /^\d+(?:\s|[A-Za-z])/.test(line)).length;
    if (numbered && numbered !== lines.length) {
        throw new Error('Use line numbers on every BASIC source line, or leave them all out.');
    }
    if (lines.length > 3276 || lines.some(line => /[^\x20-\x7e]/.test(line) || line.length > 240)) {
        throw new Error('PicoBB source must use printable ASCII, with up to 3,276 lines of 240 characters.');
    }
    return [...(numbered ? lines : lines.map((line, index) => `${(index + 1) * 10} ${line}`)), 'RUN'];
}
