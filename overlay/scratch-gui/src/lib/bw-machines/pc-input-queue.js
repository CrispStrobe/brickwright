// SPDX-License-Identifier: BSD-3-Clause

// The virtual cable queues host bytes while an XT keyboard latch or UART
// receive register is occupied. Delivery is recorded when it reaches the guest.
export function createPcInputQueue(deliver, occupied) {
    const bytes = [];
    return {
        enqueue(data) {
            const incoming = typeof data === 'number' ? [data] : Array.from(String(data),
                character => character.charCodeAt(0));
            if (bytes.length + incoming.length > 256) return false;
            for (const byte of incoming) bytes.push(byte & 0xff);
            return true;
        },
        pump() {
            if (bytes.length && !occupied() && deliver(bytes[0]) !== false) bytes.shift();
        },
        clear() { bytes.length = 0; }
    };
}
