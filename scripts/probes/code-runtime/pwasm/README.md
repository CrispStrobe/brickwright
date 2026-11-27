# Optional pwasm host probe

This runs pwasm 0.2a0's custom MicroPython WASM guest inside CPython. It is a
separate host experiment, not the direct browser MicroPython runtime and not
a browser startup comparison. It does not import application code.

From this directory, with CPython 3.10 or newer:

```sh
python -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements.txt
.venv/bin/python pwasm_host_probe.py pwasm-host-rerun.json
```

On Windows use `.venv\Scripts\python.exe` for the last two commands. The recorded
run used CPython 3.12.14 on Linux x86_64. Installation occurred in an isolated
target directory for that run; `PYTHONPATH=deps` selected those packages.

The script limits guest calls to five seconds (and narrower limits in the
interruption cases). Discard each guest after a hard limit. The deliberate host
callback waits for 150 ms to demonstrate that guest deadlines do not preempt
host work. Run the entire script under an outer process timeout in an automated
environment. The recorded command used `timeout 45s`.

The JSON report preserves successful output, unsupported language/library
fixtures, host callback refusal, timeout/fuel outcomes and fresh restart. A
reported `matches_expected: false` records a compatibility finding, not a harness
crash. Initialization samples include pwasm's host cache effects, and each
semantic fixture has one timed observation. They are not directly comparable to
the JS/browser engine timing table. No memory-stress or adversarial-security
qualification is claimed.

The wheel is pinned by hash in `requirements.txt`; the measured report also
records its size/hash and the bundled guest size/hash. The committed
`pwasm-host-results.json` is the original observation; the default rerun filename
preserves it. No wheel, guest binary,
virtual environment, compiled cache or application dependency change is committed.
