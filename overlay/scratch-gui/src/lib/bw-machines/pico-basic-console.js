import {createTerminalOutput} from '../bw-debug/terminal-output.js';
import {picoBasicConsoleSpec, picoBasicAtPrompt} from './pico-basic-source.js';

let nextSession = 0;

/** One serial reader owns startup, prompt pacing and interactive output. */
export function createPicoBasicConsole ({transport, cursor, dialect, openingMessage, onError, bootTimeout = 45000, promptTimeout = 5000}) {
    const spec = picoBasicConsoleSpec(dialect);
    const output = createTerminalOutput();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    if (openingMessage) {
        const bytes = encoder.encode(openingMessage + '\r\n');
        for (const byte of bytes) output.push(byte);
        output.deliver();
        cursor.write(bytes);
    }
    let waiting, closed, failure;
    let sawBanner = false;
    let wakeSent = false;
    let line = '';
    let lines = 0;
    let parsedLines = 0;
    let uploading = false;

    function close () {
        if (!closed) {
            waiting?.finish(failure || new Error('Pico serial connection closed.'));
            closed = Promise.resolve().then(() => transport.close()).finally(() => cursor.dispose());
        }
        return closed;
    }

    function fail (error) {
        if (closed) return;
        failure = error;
        close().catch(() => {});
        onError?.(error);
    }

    const write = text => transport.write(text);
    cursor.onData(reply => {
        if (!closed && /^\x1b\[\d+;\d+R$/.test(reply)) write(reply).catch(fail);
    });

    const atPrompt = () => sawBanner && picoBasicAtPrompt(cursor.buffer.active, spec);
    function waitFor (condition, duration, message) {
        if (closed) return Promise.reject(failure || new Error('Pico serial connection closed.'));
        if (condition()) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const finish = error => {
                clearTimeout(timeout);
                waiting = null;
                if (error) reject(error);
                else resolve();
            };
            waiting = {condition, finish};
            const timeout = setTimeout(() => finish(new Error(message)), duration);
        });
    }

    async function readLoop () {
        while (!closed) {
            const chunk = await transport.read();
            if (closed) return;
            if (!chunk) continue;
            for (const ch of chunk) {
                if (ch === '\n') {
                    lines++;
                    if (line.includes(spec.banner)) sawBanner = true;
                    if (spec.wake && !sawBanner && !wakeSent && line.trim() === 'Waiting for connection') {
                        wakeSent = true;
                        await write('\r');
                    }
                    line = '';
                } else if (ch !== '\r') line = (line + ch).slice(-512);
            }
            const bytes = encoder.encode(chunk);
            for (const byte of bytes) output.push(byte);
            output.deliver();
            await new Promise(resolve => cursor.write(bytes, resolve));
            parsedLines = lines;
            if (waiting?.condition()) waiting.finish();
        }
    }
    readLoop().catch(fail);

    return {
        terminal: {id: `pico-serial-${++nextSession}`, kind: 'pico', rows: 24, cols: 80,
            subscribe: output.subscribe,
            send: bytes => {
                if (closed || uploading) return false;
                write(decoder.decode(Uint8Array.from(bytes))).catch(fail);
                return true;
            }},
        async run (commands) {
            if (uploading) throw new Error('A BASIC listing is already being sent.');
            uploading = true;
            try {
                await waitFor(atPrompt, bootTimeout, 'No matching Pico BASIC prompt. Check the firmware, baud rate and UART wiring, then reset the Pico.');
                for (const command of ['NEW', ...commands.slice(0, -1)]) {
                    const before = parsedLines;
                    const commandText = command + '\r';
                    // Keep the Pico UART FIFO draining during long lines.
                    for (let i = 0; i < commandText.length; i += 16) {
                        if (closed) throw failure || new Error('Pico serial connection closed.');
                        await write(commandText.slice(i, i + 16));
                        if (i + 16 < commandText.length) await new Promise(resolve => setTimeout(resolve, 4));
                    }
                    await waitFor(() => parsedLines > before && atPrompt(), promptTimeout, 'The Pico did not acknowledge a BASIC line.');
                }
                await write(commands.at(-1) + '\r');
            } finally {
                uploading = false;
            }
        },
        close
    };
}
