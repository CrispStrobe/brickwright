// SPDX-License-Identifier: BSD-3-Clause
// PKWARE APPNOTE §5.3. The caller selects a known ZIP member and its output size.
export function decodeZipImplode (packed, size, flags) {
    const fail = () => { throw new Error('Invalid imploded ZIP member.'); };
    let offset = 0;
    let bits = 0;
    let available = 0;
    const byte = () => {
        if (offset >= packed.length) fail();
        return packed[offset++];
    };
    const read = count => {
        while (available < count) {
            bits |= byte() << available;
            available += 8;
        }
        const value = bits & ((1 << count) - 1);
        bits >>>= count;
        available -= count;
        return value;
    };
    const readTree = symbolCount => {
        const runs = byte() + 1;
        const lengths = [];
        for (let run = 0; run < runs; run++) {
            const entry = byte();
            const length = (entry & 15) + 1;
            const count = (entry >> 4) + 1;
            for (let index = 0; index < count; index++) lengths.push(length);
        }
        if (lengths.length !== symbolCount) fail();

        const ordered = lengths.map((length, symbol) => ({length, symbol}));
        ordered.sort((a, b) => b.length - a.length || b.symbol - a.symbol);
        const symbols = Array.from({length: 17}, () => new Map());
        let code = 0;
        for (const {length, symbol} of ordered) {
            const stride = 1 << (16 - length);
            if (code % stride || code >= 0x10000) fail();
            symbols[length].set(code / stride, symbol);
            code += stride;
        }
        if (code !== 0x10000) fail();

        return () => {
            let prefix = 0;
            for (let length = 1; length <= 16; length++) {
                prefix = (prefix << 1) | read(1);
                const symbol = symbols[length].get(prefix);
                if (symbol !== undefined) return symbol;
            }
            return fail();
        };
    };

    const literal = flags & 4 ? readTree(256) : () => read(8);
    const lengthCode = readTree(64);
    const distanceCode = readTree(64);
    const lowBits = flags & 2 ? 7 : 6;
    const minLength = flags & 4 ? 3 : 2;
    const output = new Uint8Array(size);
    let position = 0;
    while (position < output.length) {
        if (read(1)) {
            output[position++] = literal();
        } else {
            const low = read(lowBits);
            const distance = (distanceCode() << lowBits) + low + 1;
            const code = lengthCode();
            const length = minLength + code + (code === 63 ? read(8) : 0);
            if (position + length > output.length) fail();
            for (let count = 0; count < length; count++) {
                output[position] = position >= distance ? output[position - distance] : 0;
                position++;
            }
        }
    }
    return output;
}
