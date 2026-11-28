# CrispBASIC executables on emulated ARM CPUs

CrispBASIC can build Linux executables for three instruction sets: x86-64,
AArch64 and ARMv7-A hard-float. ARMv7 uses the pinned BBCSDL ARM32 assembler
and 32-bit data layout. It is not the x86 interpreter under a new platform
label. The builder checks the resulting ELF class, byte order, machine ID
and, for ARMv7, the hard-float ABI before recording a successful build.

The new [CPU workflow](../../.github/workflows/crispbasic-cpu-emulation.yml)
cross-builds on x86-64 Linux and executes the actual ARM instructions using
`qemu-arm -cpu cortex-a7` and `qemu-aarch64 -cpu cortex-a53`. The same runtime
and CLI tests used for direct native execution run through those emulators.
It retains each executable, license and SHA-256 build receipt as an artifact.
After downloading an Actions artifact, restore execute permission with
`chmod +x crispbasic-native` before running it; artifact ZIPs do not preserve
Unix executable permissions.
The latest completed qualification and its exact commit are recorded in
[VALIDATION.md](VALIDATION.md).

## Build and run an ARMv7 executable on x86-64 Linux

Install Node 22+, Git, the cross compiler, its development sysroot and QEMU.
For the Ubuntu 24.04 qualification host:

```sh
sudo apt-get install gcc-arm-linux-gnueabihf libc6-dev-armhf-cross qemu-user
```

From `packages/crisp-basic`:

```sh
CC=arm-linux-gnueabihf-gcc CRISP_BASIC_TARGET=linux-armv7 npm run build:native

node bin/crispbasic.mjs \
  --native-executable .build/targets/linux-armv7/crispbasic-native \
  --native-runner qemu-arm \
  --native-runner-arg=-cpu --native-runner-arg=cortex-a7 \
  --native-runner-arg=-L --native-runner-arg=/usr/arm-linux-gnueabihf \
  examples/structured.bas --json
```

Use `--native-runner-arg=VALUE` when a value begins with `-`. Arguments are
passed literally, as separate argv elements, without invoking a shell. A
runner flag requires the native backend, and runner arguments require a
runner. A failed launch is a host error with the existing bounded lifecycle.

Cross builds require an explicit `CC`; the builder will not guess a compiler.
They write into `.build/targets/TARGET/` so they cannot overwrite the direct
host's `.build/crispbasic-native`. Generated object/source workspaces are
separate for every target. The default target follows the Linux build host;
`arm` selects the ARMv7 hard-float port, not ARMv6.

For AArch64 substitute the following values:

| Setting | AArch64 value |
| --- | --- |
| `CRISP_BASIC_TARGET` | `linux-arm64` |
| Compiler | `aarch64-linux-gnu-gcc` |
| Development sysroot package | `libc6-dev-arm64-cross` |
| QEMU command | `qemu-aarch64` |
| CPU used in qualification | `cortex-a53` |
| `-L` sysroot | `/usr/aarch64-linux-gnu` |

## Run on the target computer itself

On a Linux ARMv7-A machine with a hard-float userspace, the default
`npm run build:native` builds directly for that CPU; ordinary CLI execution
then needs no emulator. A suitable 32-bit Raspberry Pi OS on a compatible
ARMv7-or-newer CPU is in this target class. ARMv6-only boards, soft-float
userspaces and bare-metal Raspberry Pi firmware are not covered. A 64-bit
Linux userspace instead uses the separate `linux-arm64` target.

The executable links dynamically to the selected compiler's Linux C library.
Copying a cross-built executable to a target also requires a compatible
dynamic loader and libraries. Build on the destination or with its matching
sysroot when distributing to an older system; an Ubuntu 24.04 build is not a
claim of binary compatibility with every Raspberry Pi OS release.

The standalone C executable accepts an already-numbered Latin-1 BASIC file
as its only argument and emits raw VDU bytes on stdout. Node's CLI additionally
prepares unnumbered/UTF-8 source, maps errors to editor lines, bounds execution
and manages interactive input. The native C executable itself does not
enforce the Node parent's deadline or output budget.

## Embed an emulated session

```js
import {createNativeSession} from './index.mjs';

const session = createNativeSession({
    executable: './.build/targets/linux-armv7/crispbasic-native',
    runner: {
        executable: 'qemu-arm',
        args: ['-cpu', 'cortex-a7', '-L', '/usr/arm-linux-gnueabihf']
    },
    timeoutMs: 5000
});
try {
    const result = await session.run('PRINT "ARM instructions executed"\nEND');
    console.log(result.status, result.text);
} finally {
    await session.dispose();
}
```

`runner` is trusted embedding configuration, not BASIC input. Its argument
array is copied at construction. The process group still belongs to the
session: timeout, cancellation, Reset, Dispose and closed-output handling
terminate the runner and its children before the result resolves. A runner
must preserve stdin/stdout/stderr and descriptor 3, where the interpreter
writes its completion/error protocol. A generic terminal wrapper that closes
descriptor 3 is not compatible.

## What this route does and does not simulate

QEMU **user-mode** executes guest ARM instructions while translating Linux
system calls to the host. It does not boot a guest kernel, emulate a Raspberry
Pi board, simulate physical GPIO, or connect Circuit pins. Native host files,
`SYS`/`CALL`, raw memory and `OSCLI` remain available to trusted programs under
the same native capability contract. QEMU user-mode is not a sandbox.

Brickwright's current Linux machine terminal runs a **RISC-V32** guest. Its
CPU cannot execute these ARM binaries. Wiring CrispBASIC into that terminal
requires a separate RISC-V ABI port, a compatible guest userspace build and
execution tests through that machine's UART. The existing Z80/6502 interpreter
routes are likewise separate runtimes, not CPU ports of this C core.

The native runtime does not have the WASM simulation bridge, and continues
to refuse a simulation option. ARM native execution therefore does not imply
that `PROCpinMode` or `PROCdelay` works on bare-metal microcontrollers. Use
the WASM/Circuit adapter for the qualified host-driven electrical profiles.
