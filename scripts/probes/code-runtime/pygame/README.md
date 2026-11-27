# Deterministic pygame backend and packaging probe

This is an original hand-authored fixture, not generated Brickwright output.
It tests asset loading, scripted sprite movement, rectangle collision, scoring,
state restart, and equality of all 24 rendered frame hashes between source and
a PyInstaller one-directory bundle. It uses dummy SDL video and audio drivers.

## Run on Linux

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --no-cache-dir -r requirements.txt
.venv/bin/python run_probe.py
```

`make_asset.py` generates the original PNG. `run_probe.py` writes its exact
commands, dependencies, environment, source/asset hashes, build size and result
to `results/report.json`. It preserves the build log and complete bundle file
inventory in that directory. Source and packaged executions run with an empty
PATH and cleared Python environment. The bundle must report a frozen runtime
and load its Python shared library and pygame from the bundle. The Linux
`/proc/self/maps` view verifies the actual loaded Python library, and every
Python module search path must be inside the bundle. The probe does not remove
the host's installed Python; it shows this execution resolves its interpreter
and modules from the bundle. The native OS loader and libraries are still used.

`results-record.json` preserves the reviewed observation, all 24 frame/state
records, exact package versions, hashes and validation outcomes. Absolute local
paths and local build logs are omitted from that public record; the runner keeps
them in its local `results` directory for diagnosis.

Only these small source files and that reviewed record belong in the repository. Do not commit `.venv`,
`build`, `dist`, generated assets, or the raw local results. A reviewed result
summary can be copied into the runtime evaluation document separately.

The probe does not qualify the Brickwright transpiler, Arcade semantics,
interactive GUI, real audio, devices, other OSes, older glibc, mobile, signing,
or a complete distribution-license inventory. Build hashes are observations,
not a claim of reproducible binary builds. The packaged game is LGPL-dependent
through pygame-ce; it is not part of Brickwright's default application runtime.
