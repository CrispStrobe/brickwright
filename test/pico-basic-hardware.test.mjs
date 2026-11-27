import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate as tick} from 'node:timers/promises';
import {createRequire} from 'node:module';
import {createPicoBasicConsole} from '../overlay/scratch-gui/src/lib/bw-machines/pico-basic-console.js';
import {picoBasicCommands, picoBasicConsoleSpec} from '../overlay/scratch-gui/src/lib/bw-machines/pico-basic-source.js';
import {basicProfilesFor} from '../overlay/scratch-gui/src/lib/bw-matrix/code-languages.js';
import {loadPicoBasicFirmware} from '../overlay/scratch-gui/src/lib/bw-machines/library-media.js';

const requireGui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const {Terminal} = requireGui('@xterm/xterm');
const cursor = () => new Terminal({cols: 80, rows: 24, scrollback: 0, allowProposedApi: true});

function serialFixture (dialect) {
    const spec = picoBasicConsoleSpec(dialect);
    const prompt = '> '.slice(0, spec.promptWidth);
    const writes = [];
    let received = '';
    let closed = false;
    const readable = [];
    let release;
    const receive = text => {
        if (release) {
            const resolve = release;
            release = null;
            resolve(text);
        } else readable.push(text);
    };
    return {writes, receive, transport: {
        async read () {
            if (readable.length) return readable.shift();
            if (closed) return '';
            return new Promise(resolve => { release = resolve; });
        },
        async write (text) {
            received += text;
            if (!received.endsWith('\r')) return;
            const command = received.slice(0, -1);
            received = '';
            writes.push(command);
            if (command === 'RUN') receive('RUN\r\n? ');
            else if (command === '21') receive('21\r\n42\r\n' + prompt);
            else if (command === '' && spec.wake) receive(spec.banner + '\r\n' + prompt);
            else {
                receive(command + '\r\n');
                queueMicrotask(() => receive(prompt));
            }
        },
        async close () {
            closed = true;
            receive('');
        }
    }, get closed () { return closed; }};
}

for (const dialect of ['bbc', 'piccolo', 'stefan']) {
    test(`${dialect} confirms the runtime, paces listing lines and keeps input interactive`, async () => {
        const fake = serialFixture(dialect);
        const session = createPicoBasicConsole({transport: fake.transport, cursor: cursor(), dialect, bootTimeout: 1000});
        const commands = picoBasicCommands(dialect === 'piccolo' ? 'print "wait"' : '10 INPUT A\n20 PRINT A*2', dialect);
        const output = [];
        session.terminal.subscribe(bytes => output.push(Buffer.from(bytes).toString()));
        try {
            const run = session.run(commands);
            const spec = picoBasicConsoleSpec(dialect);
            if (spec.wake) fake.receive('Waiting for connec');
            else fake.receive(spec.banner.slice(0, 5));
            await tick();
            assert.deepEqual(fake.writes, []);
            if (spec.wake) fake.receive('tion\r\n');
            else fake.receive(spec.banner.slice(5) + '\r\n' + '> '.slice(0, spec.promptWidth));
            await run;
            assert.deepEqual(fake.writes, [...(spec.wake ? [''] : []), 'NEW', ...commands]);
            assert.equal(session.terminal.send(Buffer.from('21\r')), true);
            for (let i = 0; i < 10 && !output.join('').includes('42'); i++) await tick();
            assert.match(output.join(''), /42/);
        } finally {
            await session.close();
        }
        assert.equal(fake.closed, true);
    });
}

test('an unexpected firmware prompt does not erase its listing', async () => {
    const fake = serialFixture('stefan');
    const session = createPicoBasicConsole({transport: fake.transport, cursor: cursor(), dialect: 'stefan', bootTimeout: 30});
    try {
        fake.receive('PiccoloBASIC UART\r\n> ');
        await assert.rejects(session.run(['10 PRINT 42', 'RUN']), /No matching Pico BASIC prompt/);
        assert.deepEqual(fake.writes, []);
    } finally {
        await session.close();
    }
});

test('disconnect releases a pending startup and its transport', async () => {
    const fake = serialFixture('piccolo');
    const session = createPicoBasicConsole({transport: fake.transport, cursor: cursor(), dialect: 'piccolo'});
    const run = assert.rejects(session.run(['print 42', 'RUN']), /Pico serial connection closed/);
    await session.close();
    await run;
    assert.equal(fake.closed, true);
    assert.equal(session.terminal.send(Buffer.from([3])), false);
});

// Optional live proof drives the same host protocol against the actual three UF2s.
// PICO_BASIC_MEDIA_DIR can be an offline fixture directory keyed by profile ID.
const localMedia = process.env.PICO_BASIC_MEDIA_DIR;
for (const profile of basicProfilesFor('pico')) {
    test(`real ${profile.id} UART firmware accepts the host hardware protocol`,
        {skip: !localMedia}, async () => {
            const media = readFileSync(`${localMedia}/${profile.id}.uf2`);
            const [{createRp2040jsAdapter}, {parseUF2}] = await Promise.all([
                import('bw-board/rp2040js-adapter.js'), import('bw-board/uf2.js')
            ]);
            const adapter = createRp2040jsAdapter();
            adapter.bootFromFlash(parseUF2(media).image);
            const uart = adapter.rp2040.uart[0];
            let pending = '';
            let output = '';
            adapter.onSerial(byte => { output += String.fromCharCode(byte); });
            const transport = {
                async write (text) { pending += text; },
                async read () {
                    await tick();
                    if (uart.rxFIFO.empty) {
                        for (const ch of pending.slice(0, 16)) uart.feedByte(ch.charCodeAt(0));
                        pending = pending.slice(16);
                    }
                    adapter.advanceNs(4e6);
                    const chunk = output;
                    output = '';
                    return chunk;
                },
                async close () {}
            };
            const session = createPicoBasicConsole({transport, cursor: cursor(), dialect: profile.dialect});
            let transcript = '';
            session.terminal.subscribe(bytes => { transcript += Buffer.from(bytes).toString(); });
            const source = profile.dialect === 'piccolo' ? 'print "HW-PROOF ";6*7' : '10 PRINT "HW-PROOF ";6*7';
            try {
                await session.run(picoBasicCommands(source, profile.dialect));
                const deadline = Date.now() + 5000;
                const visible = () => transcript.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
                while (!/\nHW-PROOF\s+42/.test(visible()) && Date.now() < deadline) await tick();
                assert.match(visible(), /\nHW-PROOF\s+42/);
            } finally {
                await session.close();
            }
        });
}

test('each hardware firmware download resolves its reviewed hash and dialect',
    {skip: !process.env.BW_TEST_LIVE_PICO_DOWNLOAD}, async () => {
        for (const profile of basicProfilesFor('pico')) assert.ok((await loadPicoBasicFirmware(profile)).length > 0);
    });
