# CrispBASIC simulation host and BASIC bridge, version 1

`src/simulation-host.mjs` defines a deterministic JavaScript reference host for
logical digital pins. WASM sessions can now connect BASIC to this host through
an opt-in, bounded request/reply bridge. The same host interface is the boundary
for the GUI-owned [Brickwright board-solver adapter](BOARD-SIMULATION.md).
The Code tab can explicitly connect that adapter to the Circuit canvas. Neither
host drives a physical board. No
electrical network, voltage, current, contention, analog signal, PWM, interrupt,
or peripheral is simulated by the reference host.

The WASM interpreter keeps its restricted host profile. This module adds no
`SYS`, `OSCLI`, raw memory, JavaScript evaluation, file, or network capability.
The standalone reference host's capability record still reports `basicBridge:
false`, `hardware: false`, and `circuitPhysics: false`: the host itself has no
interpreter. A configured WASM session separately advertises
`capabilities.simulation.enabled` and `basicBridge` as true. BASIC's existing
`TIME` and `WAIT` behavior is unchanged; these operations are not redirected to
the reference clock. The native backend has no simulation bridge and explicitly
rejects a supplied `simulation` option.

## JavaScript reference host API

```js
import {createSimulationHost} from './src/simulation-host.mjs';

const host = createSimulationHost({pins: [0, 1]});
host.pinMode(0, 'output');
host.pinMode(1, 'input-pullup');
host.scheduleInput(1, 0, 25);
host.digitalWrite(0, 1);
host.delay(25);
console.assert(host.millis() === 25);
console.assert(host.digitalRead(1) === 0);
host.digitalWrite(0, 0);
console.log(host.trace);
host.dispose();
```

All methods are synchronous. There are no wall-clock reads, sleeping threads,
timers, global state, or runtime dependencies. Independent instances have
independent pins, clocks, queues and traces.

| Operation | Meaning |
| --- | --- |
| `pinMode(pin, mode)` | Set `input`, `output`, or `input-pullup`. |
| `digitalWrite(pin, value)` | Store numeric `0` or `1` in an output latch. Input-mode writes fail. |
| `digitalRead(pin)` | Read the output latch, explicit input stimulus, or released input's pull-up. A floating input fails. |
| `delay(milliseconds)` | Advance simulated integer milliseconds and apply all queued stimuli through the destination time, inclusive. |
| `millis()` | Return elapsed simulated milliseconds. Reading time does not advance it. |
| `setInput(pin, value)` | Apply numeric `0` or `1` immediately; `null` releases the external stimulus. |
| `scheduleInput(pin, value, atMs)` | Queue an external stimulus at an absolute simulated time. |
| `reset()` | Clear elapsed time, trace, input queue, modes, latches and stimuli; retain configured IDs and resource limits. |
| `dispose()` | Finish the instance, discard queued stimuli, retain the final trace for inspection. Idempotent. |

`state` is `ready` or `disposed`. Operations after disposal raise a typed error;
the `state`, `capabilities`, `trace`, and `pendingInputs` getters remain readable.
`pendingInputs` counts queued stimuli. `trace` returns a frozen snapshot with
frozen records; `capabilities` and its nested arrays/limits are also frozen.

### Pins and levels

The default pins are logical IDs `0` through `7`. This matches the small
eight-pin shape already used by Brickwright's GPIO widgets, but makes no
automatic widget or board connection. Applications may supply between 1 and
256 distinct integer IDs in `0..65535`. IDs are logical names; they do not
identify package pins, addresses or MCU registers. Invalid IDs are rejected,
never clamped to another pin.

Every pin starts in `input` mode, with no external stimulus (`null`) and an
output latch initialized to `0`. Input mode reads the external stimulus. A
released `input-pullup` reads `1`; a released plain `input` raises
`floating-input`. External `0` overrides the logical pull-up.

Output mode reads its own latch. Input stimuli and the output latch are stored
separately and retained across mode changes. For example, an external `0`
stored while the pin is output does not change its latch; that input becomes
visible after switching to input mode. This is a logical fixture rule, not a
claim that driving a physical output against an external level is safe or that
the host resolves circuit contention.

Levels must be numbers `0` or `1`. Strings, booleans, non-finite numbers,
fractions and other numeric values are rejected without coercion.

### Deterministic time and input ordering

Time starts at zero and advances only through `delay`. All durations and
timestamps are nonnegative integers in milliseconds. Scheduled timestamps must
be at least the current time. Events apply in chronological order; events at
the same timestamp retain insertion order, so the last stimulus for a pin at
that time determines its input level. A stimulus scheduled for the current
time remains queued until `delay(0)` or another delay explicitly advances the
host. Ordinary pin reads never consume queued events.

The default clock ceiling is `2147483647` milliseconds. Time does not wrap or
borrow the wall clock. A `maxTimeMs` option may reduce the ceiling, including to
zero. Exceeding it raises `time-limit` before changing anything.

There is deliberately no instruction-to-time conversion. The
[circuit adapter](BOARD-SIMULATION.md) defines how its solver advances between
host requests. The
reference host cannot qualify CPU cycle timing or physical-device fidelity.

### Trace and resource bounds

The default bounds are 4096 trace events and 4096 pending input stimuli. The
`maxTraceEvents` and `maxScheduledInputs` options accept integers from 1 to
1000000. Applied events leave the pending queue; the trace never silently
drops or overwrites old records. `reset` starts a new empty trace and queue.

Each trace record has `sequence` (starting at 1), `atMs`, and `type`:

| `type` | Additional fields |
| --- | --- |
| `pin-mode` | `pin`, `mode` |
| `digital-write` | `pin`, `value` |
| `digital-read` | `pin`, `value` |
| `input` | `pin`, `value` (`null` means released) |
| `delay` | `fromMs`, `milliseconds`; `atMs` is the destination time |

Queued stimuli create `input` records when applied. Scheduling alone creates
no trace record. During a delay, input records retain their event timestamps
and precede the final delay record. `millis`, rejected calls, `reset`, and
`dispose` do not append records. Repeated writes and mode selections are
recorded even when the stored value is unchanged.

All argument, time, queue and trace-budget checks happen before modifying
state. A delay reserves enough trace space for **every** due stimulus and its
own record before consuming any of the queue. Failure leaves the prior time,
pins, trace and pending queue intact.

Failures are `SimulationError` objects with stable `code` values:
`invalid-pins`, `invalid-pin`, `invalid-limit`, `invalid-mode`, `invalid-level`,
`invalid-time`, `pin-not-output`, `floating-input`, `trace-limit`, `input-limit`,
`time-limit`, or `disposed`. The bridge treats resource-limit errors as
parent-owned execution outcomes, independently of BASIC error handlers.

## Enabling the BASIC bridge

Enable the bridge explicitly when creating a WASM session. Omit `simulation`
to retain the default disabled profile. `simulation: {}` creates a new reference
host with its default pins and limits for each run. To configure pins, schedule
inputs or inspect the final trace, supply a synchronous factory:

```js
import {createWasmSession, createSimulationHost} from './browser.mjs';

let host;
const session = createWasmSession({
    simulation: {
        maxRequests: 128,
        createHost({signal, runId}) {
            // A new host object for this run. A custom asynchronous adapter
            // would also use signal/runId to own and cancel its deferred work.
            host = createSimulationHost({pins: [0, 1]});
            host.scheduleInput(1, 0, 25);
            return host;
        }
    }
});
try {
    const result = await session.run(`
PROCpinMode(0, "output")
PROCpinMode(1, "input-pullup")
PROCdigitalWrite(0, 1)
PROCdelay(25)
PRINT STR$(FNdigitalRead(1)) + ":" + STR$(FNmillis)
END
`, {filename: 'pins.bas'});
    console.log(result.status, result.text); // completed, "0:25\r\n"
    console.log(host.state, host.trace);     // disposed, immutable final trace
} finally {
    await session.dispose();
}
```

The public calls are ordinary BASIC definitions in a separate, bounded
interpreter library area:

| BASIC call | Host operation |
| --- | --- |
| `PROCpinMode(pin, mode$)` | `pinMode(pin, mode)` using the three mode strings above |
| `PROCdigitalWrite(pin, value)` | `digitalWrite(pin, value)` |
| `FNdigitalRead(pin)` | `digitalRead(pin)` returning `0` or `1` |
| `PROCdelay(milliseconds)` | `delay(milliseconds)` in simulated milliseconds |
| `FNmillis` | `millis()` |

The numeric formal parameters deliberately have no integer suffix: fractions
are rejected, not silently truncated during parameter transfer. Callers can
still use ordinary integer variables such as `pin%`. Pin IDs must be integers
in `0..65535`, digital values must be numeric `0` or `1`, and durations must be
integers in `0..2147483647`. The host can impose narrower pin/time limits.
Modes match the exact strings `input`, `output` and `input-pullup`.

The library is loaded through BBCSDL's existing library mechanism; authored
source is neither appended to nor renumbered. Explicit line `65279`, blank-line
source mapping, and user `DEF` overrides of the public library names retain
their ordinary meanings. A small private `FN_crispSimulation` evaluator hook
serves only these allowlisted operations; it is implementation plumbing, not a
generic native-call facility or a new language keyword. The original evaluator
parses all arguments before a request is sent.

### Host factory and ownership

`simulation` accepts only `createHost` and `maxRequests`. The default factory
returns `createSimulationHost()`. The request budget defaults to 4096 and accepts
integers from 1 to 1000000.

`createHost({signal, runId})` runs synchronously in the parent and must return a
fresh, ready object with `pinMode`, `digitalWrite`, `digitalRead`, `delay`,
`millis`, and `dispose` methods. Returning a Promise is a host error. The
positive run identifier is an ownership token, not simulated time. A WeakSet
tracks host ownership without retaining finished objects: an object used by one
run cannot be handed to any later or concurrent run, even after `reset()` or
when using another session. Create another host instead.

The five operation methods can return immediate values or Promises. Void
operations may return `undefined` or `0`; reads return exactly numeric `0` or
`1`; `millis()` returns a nonnegative integer through `2147483647`. Other values
are host errors. Custom hosts should throw the exported `SimulationError` with
a documented domain or budget code; unrelated exceptions and unrecognized
codes produce `host-error` rather than fabricated BASIC success.

Factories, `dispose()` and synchronous parts of operation methods must return
promptly and must not block the parent event loop. `dispose()` must be
synchronous; a throwing or Promise-returning disposer produces `host-error`.
The session aborts the factory's `signal` before disposal on every completion
path, including normal completion. It terminates the worker and completes
disposal before `run()`, `reset()` or session `dispose()` resolves.

An asynchronous adapter must honor that signal and its own disposed flag before
any deferred side effect, and release listeners/timers in `dispose()`. The
session abandons pending operations and ignores late settlements, so a Promise
that never settles does not delay cancellation or the deadline. Terminating the
worker and ignoring a reply cannot undo arbitrary external effects already
performed by an adapter. The reference host has synchronous, bounded operations
and rejects further mutations after disposal.

`setInput` and `scheduleInput` remain application-side setup/stimulus methods;
they are not exposed as arbitrary BASIC requests. Nor can BASIC reset or
dispose its run's host to escape a budget.

### Requests, cancellation and limits

Requests and replies use separate version-1 worker records with a run ID,
strictly increasing request ID, an allowlisted numeric operation and fixed
scalar arguments/results. There is one outstanding request at a time. Both
ends validate the complete record and reject malformed, duplicate, concurrent,
out-of-order or wrong-run traffic. Ordinary VDU output never carries control
requests. Output buffered before a request is flushed before suspension.

The worker calls an `EM_ASYNC_JS` hook through Asyncify to retain the complete C
stack while awaiting the parent's reply, including recursive FN/PROC and error
handler frames. Cancellation, deadline and output-budget decisions stay in the
parent. The deadline includes host creation, worker/module loading, input waits
and outstanding simulation replies, subject to the custom adapter's requirement
to keep the parent event loop responsive.

Every dispatched request consumes the cumulative `maxRequests` budget,
including `FNmillis` and requests that receive ordinary domain errors. The
request budget therefore bounds programs whose operations create no trace.
The reference host independently enforces its existing atomic trace, scheduled
input and time budgets. A `request-limit`, `trace-limit`, `input-limit`,
`time-limit` or adapter `solver-limit` produces:

```js
{status: 'simulation-limit', error: {kind: 'simulation', code: 'trace-limit', /* message */}}
```

The parent terminates the run without a BASIC reply; `ON ERROR` cannot catch or
reset these budgets. Unknown host failures or invalid replies produce
`host-error`. Existing `timeout`, `cancelled` and `output-limit` outcomes retain
their meanings. A custom host's `input-limit` concerns its simulation stimulus
budget, independently of the runtime's 1 MiB terminal-input limit.

### Typed BASIC errors and source identity

Ordinary domain failures are catchable by BASIC's existing error handlers:

| `ERR` | `error.simulationCode` on an unhandled bridge error |
| --- | --- |
| 201 | `invalid-pin` |
| 202 | `invalid-mode` |
| 203 | `invalid-level` |
| 204 | `invalid-time` |
| 205 | `pin-not-output` |
| 206 | `floating-input` |
| 207 | `disposed` |
| 208 | `unavailable` |
| 209 | `invalid-operation` |

Messages use fixed bounded text beginning `Simulation <code>:`. Unhandled
errors keep `kind: 'basic'`, the original filename, physical editor line and
BASIC line; matching bridge errors additionally expose `simulationCode`.
Wrong argument types may instead raise BBC BASIC's own `ERR6` (type mismatch)
during ordinary parameter transfer, before the bridge runs.

The interpreter records the caller after evaluating its arguments, so a nested
simulation call in an argument cannot replace the outer operation's diagnostic
location. Domain errors in a library wrapper are attributed to its authored
call site. Calls inside `EVAL` retain the enclosing authored expression's
location across multiple replies and nested evaluations. A scoped source
origin is restored on both normal return and error/`END`/`QUIT` unwinding;
an authored function called by `EVAL` still reports its own body location.
An unexpected error in hidden library internals reports
`basicLine: 0` and no editor line instead of falsely identifying a user line
with the same number.

### Build, capabilities and remaining adapters

Simulation requires a rebuilt artifact exporting `crisp_simulation_abi()` with
value `1`. Before enabling the library, the worker checks that marker; an old or
incompatible artifact produces an actionable host error. The C entry point also
receives an explicit 0/1 capability flag. A default session neither installs the
library nor enables the private intrinsic. Inspect
`session.capabilities.simulation` for availability, enabled state, contract
version and request budget.

The GUI-owned [Brickwright board adapter](BOARD-SIMULATION.md) maps logical IDs
to the active Circuit board and uses cooperative solver advancement, electrical
reads and exclusive run ownership. Enable it with the Code tab's **Connect
Circuit** option. Existing generator hardware comments remain comments;
authored library calls are the supported route in this milestone. PicoBB and
other physical targets still need independent execution and pin/timing evidence.

## Validation

From this package directory, run:

```sh
node --test tests/simulation-host.test.mjs
node --test tests/simulation-bridge.test.mjs
# After npm run build:wasm:
node --test tests/wasm-simulation.test.mjs
```

Tests use fixed expected pin/time traces and cover floating inputs, pull-ups,
output latches, timestamp ties, explicit zero-delay ordering, atomic budget
failures, invalid values, reset determinism, immutable snapshots, independent
instances and final disposal. The reference-host and protocol tests do not
require Emscripten or GUI packages. The WASM simulation suite requires the real
rebuilt engine and covers fixed traces, library/source identity, recursive
suspension, typed errors and parent-owned limits. Missing compiled artifacts
are failures, never passing skips. The executed checks and current revision's
qualification status are recorded in [VALIDATION.md](VALIDATION.md); the
existence of a test is not a claim that it passed in the current environment.
