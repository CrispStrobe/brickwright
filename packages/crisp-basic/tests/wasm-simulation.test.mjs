import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {createWasmSession} from '../browser.mjs';
import {createSimulationHost, SimulationError} from '../src/simulation-host.mjs';

const moduleURL = new URL('../.build/wasm/crispbasic.mjs', import.meta.url);
const wasmURL = new URL('../.build/wasm/crispbasic.wasm', import.meta.url);

function sessionFor(t, options = {}) {
    const session = createWasmSession({moduleURL, ...options});
    t.after(() => session.dispose());
    return session;
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}

// Preserve the reference host's private receiver while permitting a genuinely
// asynchronous adapter. The host itself deliberately has no timers or I/O.
function adapterFor(host, overrides = {}) {
    return {
        pinMode: (...args) => host.pinMode(...args),
        digitalWrite: (...args) => host.digitalWrite(...args),
        digitalRead: (...args) => host.digitalRead(...args),
        delay: (...args) => host.delay(...args),
        millis: () => host.millis(),
        dispose: () => host.dispose(),
        ...overrides
    };
}

async function waitForRequest(requested, running) {
    await Promise.race([requested, running.then(result => {
        throw new Error(`BASIC finished before the expected simulation request: ${JSON.stringify(result)}`);
    })]);
}

test('simulation integration requires the actual rebuilt C/WASM module', async () => {
    await access(moduleURL);
    assert.equal(WebAssembly.validate(await readFile(wasmURL)), true);
});

test('ordinary BASIC library calls produce a fixed parent-owned pin and time trace', async t => {
    let host;
    const session = sessionFor(t, {simulation: {createHost() {
        host = createSimulationHost({pins: [0, 1]});
        host.scheduleInput(1, 0, 25);
        return host;
    }}});
    const result = await session.run(`PROCpinMode(0, "output")
PROCpinMode(1, "input-pullup")
PROCdigitalWrite(0, 1)
PRINT STR$(FNdigitalRead(1))
PROCdelay(25)
PRINT STR$(FNdigitalRead(1)) + ":" + STR$(FNmillis)
PROCdigitalWrite(0, 0)
END
`, {filename: 'pins.bas'});
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.deepEqual([...result.output], [...Buffer.from('1\r\n0:25\r\n', 'latin1')]);
    assert.deepEqual(host.trace, [
        {sequence: 1, atMs: 0, type: 'pin-mode', pin: 0, mode: 'output'},
        {sequence: 2, atMs: 0, type: 'pin-mode', pin: 1, mode: 'input-pullup'},
        {sequence: 3, atMs: 0, type: 'digital-write', pin: 0, value: 1},
        {sequence: 4, atMs: 0, type: 'digital-read', pin: 1, value: 1},
        {sequence: 5, atMs: 25, type: 'input', pin: 1, value: 0},
        {sequence: 6, atMs: 25, type: 'delay', fromMs: 0, milliseconds: 25},
        {sequence: 7, atMs: 25, type: 'digital-read', pin: 1, value: 0},
        {sequence: 8, atMs: 25, type: 'digital-write', pin: 0, value: 0}
    ]);
    assert.equal(host.state, 'disposed', 'the run must release its host before resolving');
    assert.equal(session.state, 'idle');
    assert.equal(host.capabilities.basicBridge, false, 'the standalone host still has no interpreter');
    assert.equal(host.capabilities.hardware, false);
    assert.equal(host.capabilities.circuitPhysics, false);
});

test('delayed simulation replies preserve recursive FN locals and enclosing PROC frames', async t => {
    let pending = 0, peak = 0, calls = 0, host;
    const session = sessionFor(t, {simulation: {createHost() {
        host = createSimulationHost();
        const invoke = async (method, ...args) => {
            pending++;
            peak = Math.max(peak, pending);
            calls++;
            try { await delay(3); return host[method](...args); }
            finally { pending--; }
        };
        return adapterFor(host, {
            delay: milliseconds => invoke('delay', milliseconds),
            millis: () => invoke('millis')
        });
    }}});
    const result = await session.run(`PROCouter(7)
PRINT "returned"
END
DEF PROCouter(base%)
LOCAL keep%, answer%
keep% = base% + 90
answer% = FNwalk(4)
PRINT STR$(answer%) + ":" + STR$(keep%)
ENDPROC
DEF FNwalk(depth%)
LOCAL before%, child%
before% = FNmillis
PROCdelay(3)
IF depth% = 0 THEN =FNmillis - before%
child% = FNwalk(depth% - 1)
=child% + FNmillis - before%
`);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '45:97\r\nreturned\r\n');
    assert.equal(calls, 15);
    assert.equal(peak, 1, 'only one request may be outstanding');
    assert.equal(pending, 0);
    assert.equal(host.trace.at(-1).atMs, 15);
});

test('ON ERROR LOCAL survives a rejected asynchronous reply and returns through its PROC', async t => {
    const session = sessionFor(t, {simulation: {createHost() {
        const host = createSimulationHost();
        return adapterFor(host, {async digitalRead(pin) {
            await delay(10);
            return host.digitalRead(pin);
        }});
    }}});
    const result = await session.run(`PROCouter
PRINT "returned"
END
DEF PROCouter
LOCAL saved%
saved% = 73
ON ERROR LOCAL PRINT STR$(ERR) + ":" + STR$(saved%) : ENDPROC
PROCdelay(10)
PRINT STR$(FNdigitalRead(0))
ENDPROC
`);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '206:73\r\nreturned\r\n');
});

test('unhandled simulation errors retain their stable type and BASIC error number', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    const result = await session.run('100 REM caller\n\n450 PRINT STR$(FNdigitalRead(0))\n', {filename: 'floating.bas'});
    assert.equal(result.status, 'error', JSON.stringify(result.error));
    assert.equal(result.error.kind, 'basic');
    assert.equal(result.error.code, 206);
    assert.equal(result.error.simulationCode, 'floating-input');
    assert.equal(result.error.filename, 'floating.bas');
    assert.equal(result.error.basicLine, 450);
    assert.equal(result.error.line, 3);
    assert.match(result.error.message, /floating|input/i);
});

test('nested argument requests cannot replace the outer callsite in a simulation diagnostic', async t => {
    const session = sessionFor(t, {simulation: {createHost() {
        const host = createSimulationHost({pins: [0, 1]});
        host.pinMode(0, 'output');
        host.digitalWrite(0, 1);
        return host;
    }}});
    const result = await session.run(`100 REM outer call follows
200 PROCdigitalWrite(FNpin, 1)
300 END
400 DEF FNpin
450 =FNdigitalRead(0)
`, {filename: 'nested.bas'});
    assert.equal(result.status, 'error', JSON.stringify(result.error));
    assert.equal(result.error.code, 205);
    assert.equal(result.error.simulationCode, 'pin-not-output');
    assert.equal(result.error.basicLine, 200);
    assert.equal(result.error.line, 2);
    assert.equal(result.error.filename, 'nested.bas');
});

test('EVAL simulation errors map simple, sequential and nested expressions to their enclosing source', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    for (const expression of [
        'FNdigitalRead(0)',
        'FNmillis+FNdigitalRead(0)',
        'EVAL("FNdigitalRead(0)")'
    ]) {
        const source = '100 REM EVAL callsite\n\n450 PRINT EVAL("' + expression.replaceAll('"', '""') + '")\n';
        const result = await session.run(source, {filename: 'eval-origin.bas'});
        assert.equal(result.status, 'error', `${expression}: ${JSON.stringify(result.error)}`);
        assert.equal(result.error.code, 206);
        assert.equal(result.error.simulationCode, 'floating-input');
        assert.equal(result.error.basicLine, 450, expression);
        assert.equal(result.error.line, 3, expression);
        assert.equal(result.error.filename, 'eval-origin.bas');
    }
});

test('EVAL origin unwinds through a local error handler before the outer expression fails', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    const result = await session.run(`100 PRINT EVAL("FNcaught+FNdigitalRead(0)")
200 END
400 DEF FNcaught
410 LOCAL saved%
420 saved%=17
430 ON ERROR LOCAL PRINT "caught:"+STR$(ERR)+":"+STR$(saved%):=7
450 PRINT EVAL("EVAL(""FNdigitalRead(1)"")")
460 =0
`, {filename: 'eval-unwind.bas'});
    assert.equal(result.status, 'error', JSON.stringify(result.error));
    assert.equal(result.text, 'caught:206:17\r\n');
    assert.equal(result.error.code, 206);
    assert.equal(result.error.simulationCode, 'floating-input');
    assert.equal(result.error.basicLine, 100, 'the completed nested EVAL must not retain its source origin');
    assert.equal(result.error.line, 1);
    assert.equal(result.error.filename, 'eval-unwind.bas');
});

test('EVAL retains an authored FN body location when the error occurs in that body', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    const result = await session.run('100 PRINT EVAL("FNbad")\n200 END\n400 DEF FNbad\n450 =FNdigitalRead(0)\n', {
        filename: 'eval-body.bas'
    });
    assert.equal(result.status, 'error', JSON.stringify(result.error));
    assert.equal(result.error.code, 206);
    assert.equal(result.error.simulationCode, 'floating-input');
    assert.equal(result.error.basicLine, 450, 'an outer EVAL must not replace a real authored body location');
    assert.equal(result.error.line, 4);
    assert.equal(result.error.filename, 'eval-body.bas');
});

test('EVAL recursive success preserves locals through delayed simulation replies', async t => {
    let calls = 0;
    const session = sessionFor(t, {simulation: {createHost() {
        const host = createSimulationHost();
        return adapterFor(host, {
            async delay(milliseconds) { calls++; await delay(3); host.delay(milliseconds); },
            async millis() { calls++; await delay(3); return host.millis(); }
        });
    }}});
    const result = await session.run(`PRINT STR$(FNwalk(4))
END
DEF FNwalk(depth%)
LOCAL before%, value%
before%=FNmillis
PROCdelay(2)
IF depth%=0 THEN =FNmillis-before%
value%=EVAL("FNwalk(depth%-1)")
=value%+FNmillis-before%
`);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '30\r\n');
    assert.equal(calls, 15);
});

test('EVAL forwards END and QUIT through every nested expression frame', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    for (const [statement, exitCode] of [['END', 0], ['QUIT 17', 17]]) {
        const result = await session.run('PRINT EVAL("EVAL(""FNfinish"")")\nPRINT "unreachable"\nEND\nDEF FNfinish\n' +
            statement + '\n=99\n');
        assert.equal(result.status, 'completed', `${statement}: ${JSON.stringify(result.error)}`);
        assert.equal(result.exitCode, exitCode);
        assert.equal(result.text, '');
    }
});

test('the simulation library is opt-in and does not reserve public BASIC function names', async t => {
    const ordinary = sessionFor(t);
    const unavailable = await ordinary.run('PRINT STR$(FNmillis)\nEND\n');
    assert.equal(unavailable.status, 'error');
    const source = 'PRINT STR$(FNmillis)\nEND\nDEF FNmillis = 123\n';
    assert.equal((await ordinary.run(source)).text, '123\r\n');
    let calls = 0;
    const enabled = sessionFor(t, {simulation: {createHost() {
        const host = createSimulationHost();
        return adapterFor(host, {millis() { calls++; return host.millis(); }});
    }}});
    const result = await enabled.run(source);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '123\r\n');
    assert.equal(calls, 0, 'an authored DEF must retain ordinary BASIC precedence');
});

test('library loading leaves maximum authored line numbers available', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    const result = await session.run('65279 PRINT STR$(FNmillis):END\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '0\r\n');
});

test('CLEAR and RUN retain the installed library without resetting the parent simulation clock', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    const clear = await session.run('PROCdelay(2)\nCLEAR\nPRINT STR$(FNmillis)\nEND\n');
    assert.equal(clear.status, 'completed', JSON.stringify(clear.error));
    assert.equal(clear.text, '2\r\n');
    const run = await session.run('IF FNmillis = 0 THEN PROCdelay(1):RUN\nPRINT STR$(FNmillis)\nEND\n');
    assert.equal(run.status, 'completed', JSON.stringify(run.error));
    assert.equal(run.text, '1\r\n');
});

test('fractional, out-of-range, string and malformed arguments cannot reach host side effects', async t => {
    const cases = [
        'PROCpinMode(0.5, "output")',
        'PROCpinMode(-1, "output")',
        'PROCpinMode(65536, "output")',
        'PROCpinMode(0, "OUTPUT")',
        'PROCpinMode(0, "output" + CHR$(0) + "ignored")',
        'PROCpinMode("0", "output")',
        'PROCdigitalWrite(0, 0.5)',
        'PROCdigitalWrite(0, 2)',
        'PROCdigitalWrite(0, "1")',
        'PRINT STR$(FNdigitalRead(0.5))',
        'PROCdelay(0.5)',
        'PROCdelay(-1)',
        'PROCdelay(2147483648)',
        'PROCdelay("1")',
        'PROCdelay(1, 2)',
        'PROCdelay(1'
    ];
    for (const source of cases) {
        let host;
        const session = sessionFor(t, {simulation: {createHost() {
            host = createSimulationHost();
            return host;
        }}});
        const result = await session.run(source + '\nEND\n');
        assert.equal(result.status, 'error', `${source}: ${JSON.stringify(result.error)}`);
        assert.deepEqual(host.trace, [], `${source} must not mutate pins or time`);
    }
});

test('configured logical IDs and input/output state errors remain catchable and typed', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost({pins: [42]})}});
    for (const [source, code, simulationCode] of [
        ['PROCpinMode(0, "output")', 201, 'invalid-pin'],
        ['PROCdigitalWrite(42, 1)', 205, 'pin-not-output'],
        ['PRINT STR$(FNdigitalRead(42))', 206, 'floating-input']
    ]) {
        const result = await session.run(source + '\nEND\n');
        assert.equal(result.status, 'error', JSON.stringify(result.error));
        assert.equal(result.error.code, code);
        assert.equal(result.error.simulationCode, simulationCode);
    }
});

test('the private intrinsic validates its complete fixed argument list before sending a request', async t => {
    for (const source of [
        'PRINT FN_crispSimulation(0, 0, 0)',
        'PRINT FN_crispSimulation(6, 0, 0)',
        'PRINT FN_crispSimulation(1, 0, "output", 0)',
        'PRINT FN_crispSimulation(1, 0, "output"',
        'PRINT FN_crispSimulation(3, 0, 1)',
        'PRINT FN_crispSimulation(4, 0.5, 0)',
        'PRINT FN_crispSimulation(5, 1, 0)',
        'PRINT FN_crispSimulation("1", 0, "output")'
    ]) {
        let host;
        const session = sessionFor(t, {simulation: {createHost() { host = createSimulationHost(); return host; }}});
        const result = await session.run(source + '\nEND\n');
        assert.equal(result.status, 'error', `${source}: ${JSON.stringify(result.error)}`);
        assert.deepEqual(host.trace, [], source);
    }
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    const similarName = await session.run('PRINT STR$(FN_crispSimulationExtra)\nEND\nDEF FN_crispSimulationExtra = 7\n');
    assert.equal(similarName.status, 'completed', JSON.stringify(similarName.error));
    assert.equal(similarName.text, '7\r\n');
});

test('a cumulative request budget also stops reads that produce no trace', async t => {
    let calls = 0, host;
    const session = sessionFor(t, {simulation: {maxRequests: 3, createHost() {
        host = createSimulationHost();
        return adapterFor(host, {millis() { calls++; return host.millis(); }});
    }}});
    const result = await session.run('ON ERROR PRINT "caught":END\nREPEAT\nvalue% = FNmillis\nUNTIL FALSE\n');
    assert.equal(result.status, 'simulation-limit', JSON.stringify(result.error));
    assert.equal(result.error.kind, 'simulation');
    assert.equal(result.error.code, 'request-limit');
    assert.equal(calls, 3);
    assert.equal(result.text, '');
    assert.deepEqual(host.trace, []);
    assert.equal(host.state, 'disposed');
});

test('simulation trace and time budgets terminate in the parent outside ON ERROR', async t => {
    for (const [options, source, code, expectedTrace] of [
        [{maxTraceEvents: 1}, 'PROCpinMode(0, "output")\nPROCdigitalWrite(0, 1)', 'trace-limit',
            [{sequence: 1, atMs: 0, type: 'pin-mode', pin: 0, mode: 'output'}]],
        [{maxTimeMs: 4}, 'PROCdelay(5)', 'time-limit', []]
    ]) {
        let host;
        const session = sessionFor(t, {simulation: {createHost() {
            host = createSimulationHost(options);
            return host;
        }}});
        const result = await session.run('ON ERROR PRINT "caught":END\n' + source + '\nPRINT "unexpected"\nEND\n');
        assert.equal(result.status, 'simulation-limit', JSON.stringify(result.error));
        assert.equal(result.error.kind, 'simulation');
        assert.equal(result.error.code, code);
        assert.equal(result.text, '');
        assert.deepEqual(host.trace, expectedTrace);
        assert.equal(host.state, 'disposed');
    }
});

test('an adapter input budget rejection is also a parent-owned limit', async t => {
    const session = sessionFor(t, {simulation: {createHost() {
        return adapterFor(createSimulationHost(), {millis() {
            throw new SimulationError('input-limit', 'adapter input budget reached');
        }});
    }}});
    const result = await session.run('ON ERROR PRINT "caught":END\nPRINT STR$(FNmillis)\nEND\n');
    assert.equal(result.status, 'simulation-limit', JSON.stringify(result.error));
    assert.equal(result.error.code, 'input-limit');
    assert.equal(result.text, '');
});

test('cancellation aborts a pending adapter and suppresses its late reply before a fresh run', {timeout: 15000}, async t => {
    const entered = deferred(), reply = deferred();
    const runs = [], terminals = [];
    const session = sessionFor(t, {simulation: {createHost({signal}) {
        const host = createSimulationHost();
        const run = {host, signal, disposed: 0};
        runs.push(run);
        return adapterFor(host, {
            millis() {
                if (runs.length === 1) { entered.resolve(); return reply.promise; }
                return host.millis();
            },
            dispose() { run.disposed++; host.dispose(); }
        });
    }}, onEvent(event) {
        if (event.type === 'result') terminals.push(event.result.status);
    }});
    const pending = session.run('PRINT STR$(FNmillis)\nPRINT "late"\nEND\n');
    await waitForRequest(entered.promise, pending);
    assert.equal(session.cancel(), true);
    const stopped = await pending;
    assert.equal(stopped.status, 'cancelled');
    assert.equal(stopped.text, '');
    assert.equal(runs[0].signal.aborted, true);
    assert.equal(runs[0].disposed, 1);
    const next = session.run('PRINT STR$(FNmillis)\nEND\n');
    reply.resolve(99);
    const result = await next;
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '0\r\n');
    assert.equal(runs.length, 2);
    assert.equal(runs[1].disposed, 1);
    assert.deepEqual(terminals, ['cancelled', 'completed']);
});

test('the deadline includes a never-resolving simulation reply and aborts its host', {timeout: 10000}, async t => {
    let requested = false, signal, disposed = 0;
    const session = sessionFor(t, {timeoutMs: 1500, simulation: {createHost(context) {
        signal = context.signal;
        return adapterFor(createSimulationHost(), {
            millis() { requested = true; return new Promise(() => {}); },
            dispose() { disposed++; }
        });
    }}});
    const started = performance.now();
    const result = await session.run('ON ERROR PRINT "caught":END\nPRINT STR$(FNmillis)\nEND\n');
    assert.equal(result.status, 'timeout', JSON.stringify(result.error));
    assert.equal(requested, true);
    assert.equal(signal.aborted, true);
    assert.equal(disposed, 1);
    assert.equal(result.text, '');
    assert.ok(performance.now() - started < 6000);
});

test('reset and repeated disposal settle runs suspended on simulation before returning', {timeout: 15000}, async t => {
    for (const action of ['reset', 'dispose']) {
        const entered = deferred();
        let signal, disposed = 0;
        const session = sessionFor(t, {simulation: {createHost(context) {
            signal = context.signal;
            return adapterFor(createSimulationHost(), {
                millis() { entered.resolve(); return new Promise(() => {}); },
                dispose() { disposed++; }
            });
        }}});
        let settled = false;
        const pending = session.run('PRINT STR$(FNmillis)\nEND\n').then(result => {
            settled = true;
            return result;
        });
        await waitForRequest(entered.promise, pending);
        await Promise.all([session[action](), session[action]()]);
        assert.equal(settled, true);
        assert.equal((await pending).status, 'cancelled');
        assert.equal(signal.aborted, true);
        assert.equal(disposed, 1);
        assert.equal(session.state, action === 'dispose' ? 'disposed' : 'idle');
    }
});

test('repeated and concurrent sessions own separate hosts, clocks and pin latches', async t => {
    const hosts = [];
    const createHost = () => {
        const host = createSimulationHost();
        hosts.push(host);
        return host;
    };
    const sessions = [sessionFor(t, {simulation: {createHost}}), sessionFor(t, {simulation: {createHost}})];
    const results = await Promise.all(sessions.map((session, index) => session.run(
        `PROCpinMode(0, "output")\nPROCdigitalWrite(0, ${index})\nPROCdelay(${index + 1})\n` +
        'PRINT STR$(FNdigitalRead(0)) + ":" + STR$(FNmillis)\nEND\n')));
    assert.deepEqual(results.map(result => [result.status, result.text]),
        [['completed', '0:1\r\n'], ['completed', '1:2\r\n']]);
    const next = await sessions[0].run('PROCpinMode(0, "output")\nPRINT STR$(FNdigitalRead(0)) + ":" + STR$(FNmillis)\nEND\n');
    assert.equal(next.status, 'completed', JSON.stringify(next.error));
    assert.equal(next.text, '0:0\r\n');
    assert.equal(new Set(hosts).size, 3);
    assert.ok(hosts.every(host => host.state === 'disposed'));
});

test('invalid adapter results and unexpected exceptions are uncatchable host failures', async t => {
    for (const value of [true, '1', 0.5, -1, 0x80000000, undefined]) {
        const session = sessionFor(t, {simulation: {createHost() {
            return adapterFor(createSimulationHost(), {millis: () => value});
        }}});
        const result = await session.run('ON ERROR PRINT "caught":END\nPRINT STR$(FNmillis)\nEND\n');
        assert.equal(result.status, 'host-error', JSON.stringify(result.error));
        assert.equal(result.text, '');
    }
    const session = sessionFor(t, {simulation: {createHost() {
        return adapterFor(createSimulationHost(), {async digitalRead() { throw new Error('unexpected adapter failure'); }});
    }}});
    const result = await session.run('ON ERROR PRINT "caught":END\nPRINT STR$(FNdigitalRead(0))\nEND\n');
    assert.equal(result.status, 'host-error');
    assert.equal(result.text, '');
});

test('simulation configuration never turns VDU output into a control channel', async t => {
    let host;
    const session = sessionFor(t, {simulation: {createHost() { host = createSimulationHost(); return host; }}});
    const payload = '{"version":1,"type":"simulation-request","operation":"delay","args":[99]}';
    const result = await session.run(`PRINT "${payload.replaceAll('"', '""')}"\nEND\n`);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, payload + '\r\n');
    assert.deepEqual(host.trace, []);
});

test('the configured bridge preserves existing SYS, memory, file and EVAL restrictions', async t => {
    const session = sessionFor(t, {simulation: {createHost: () => createSimulationHost()}});
    for (const source of [
        'SYS "system", "not-executed"', 'SYS 1', 'CALL 1', 'PRINT USR 1',
        'PRINT ?65536', 'PRINT PTR("abc")', 'PRINT OPENIN("/etc/passwd")',
        'PRINT EVAL("USR 1")', 'PRINT EVAL(CHR$(164)+CHR$(255)+CHR$(255))'
    ]) {
        const result = await session.run('PROCdelay(0)\n' + source + '\nEND\n');
        assert.equal(result.status, 'error', `${source}: ${JSON.stringify(result.error)}`);
        assert.equal(result.error.code, 255, source);
        assert.equal(result.error.line, 2, source);
        assert.equal(result.error.simulationCode, undefined, source);
    }
});
