# CrispBASIC simulation host contract, version 1

`src/simulation-host.mjs` defines a deterministic JavaScript reference host for
logical digital pins. It is an executable contract for the next circuit and
physical-computing integration. It does **not** connect BASIC programs to the
Brickwright circuit canvas or a physical board. No electrical network, voltage,
current, contention, analog signal, PWM, interrupt, or peripheral is simulated.

The WASM interpreter keeps its restricted host profile. This module adds no
`SYS`, `OSCLI`, raw memory, JavaScript evaluation, file, or network capability.
Its capability record explicitly reports `basicBridge: false`, `hardware:
false`, and `circuitPhysics: false`. BASIC's existing `TIME` and `WAIT` behavior
is unchanged; these operations are not redirected to the reference clock.

## JavaScript API

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

There is deliberately no instruction-to-time conversion. An eventual circuit
adapter must define how the board solver advances between host requests. The
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
`time-limit`, or `disposed`. Resource-limit errors are host outcomes; a future
interpreter bridge must preserve parent ownership of execution budgets.

## Planned BASIC library boundary

These are proposed ordinary procedures and functions, **not installed BASIC
definitions, new keywords, or a working interpreter bridge**:

| Proposed BASIC call | Host operation |
| --- | --- |
| `PROCpinMode(pin%, mode$)` | `pinMode(pin, mode)` using the three mode strings above |
| `PROCdigitalWrite(pin%, value%)` | `digitalWrite(pin, value)` |
| `FNdigitalRead(pin%)` | `digitalRead(pin)` returning `0` or `1` |
| `PROCdelay(milliseconds%)` | `delay(milliseconds)` in simulated milliseconds |
| `FNmillis` | `millis()` |

Applications must check the relevant host capabilities before enabling these
operations. The existing BASIC generator's commented hardware stubs are not
implementations of this contract and must not be presented as successful
hardware execution.

The future interpreter bridge needs a dedicated bounded, versioned request
and response channel, explicit operation allowlisting, per-run ownership,
typed error mapping, cancellation, and tests proving complete C-stack
preservation across replies. It must not encode control requests in ordinary
VDU output or expand `SYS`/pointer access as a shortcut. A Brickwright circuit
adapter must explicitly map logical IDs to the active board, drive/sense it at
the agreed simulation times, and refuse unknown or unavailable features.

PicoBB and other physical targets remain future work. Comparable traces need
independent target evidence before claiming equivalence with this reference.

## Validation

From this package directory, run:

```sh
node --test tests/simulation-host.test.mjs
```

Tests use fixed expected pin/time traces and cover floating inputs, pull-ups,
output latches, timestamp ties, explicit zero-delay ordering, atomic budget
failures, invalid values, reset determinism, immutable snapshots, independent
instances and final disposal. They do not require Emscripten or GUI packages.
