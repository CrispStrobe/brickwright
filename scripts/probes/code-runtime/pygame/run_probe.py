"""Build and compare source/bundle executions; writes only local probe outputs."""

import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    RESULTS.mkdir(exist_ok=True)
    # No host Python search path, library path, user site, or shell PATH is inherited.
    clean_env = {
        "PATH": "",
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "SDL_VIDEODRIVER": "dummy",
        "SDL_AUDIODRIVER": "dummy",
        "PYGAME_HIDE_SUPPORT_PROMPT": "1",
    }
    asset_cmd = [sys.executable, str(ROOT / "make_asset.py")]
    subprocess.run(asset_cmd, check=True, cwd=ROOT, capture_output=True, text=True)
    source_cmd = [sys.executable, str(ROOT / "game.py")]
    source = subprocess.run(source_cmd, check=True, cwd=RESULTS, env=clean_env,
                            capture_output=True, text=True, timeout=30)
    (RESULTS / "source.stdout.json").write_text(source.stdout)
    (RESULTS / "source.stderr.txt").write_text(source.stderr)

    build_cmd = [
        sys.executable, "-m", "PyInstaller", "--clean", "--noconfirm", "--onedir",
        "--name", "bw-pygame-probe", "--distpath", str(ROOT / "dist"),
        "--workpath", str(ROOT / "build"), "--specpath", str(ROOT / "build"),
        "--add-data", str(ROOT / "assets") + os.pathsep + "assets",
        "--copy-metadata", "pygame-ce", str(ROOT / "game.py"),
    ]
    build_env = dict(os.environ)
    build_env["PYINSTALLER_CONFIG_DIR"] = str(ROOT / "build" / "cache")
    started = time.monotonic()
    build = subprocess.run(build_cmd, cwd=ROOT, env=build_env,
                           capture_output=True, text=True, timeout=240)
    build_seconds = time.monotonic() - started
    (RESULTS / "build.stdout.txt").write_text(build.stdout)
    (RESULTS / "build.stderr.txt").write_text(build.stderr)
    build.check_returncode()

    bundle_dir = ROOT / "dist" / "bw-pygame-probe"
    executable = bundle_dir / "bw-pygame-probe"
    bundle_cmd = [str(executable)]
    bundled = subprocess.run(bundle_cmd, check=True, cwd=RESULTS, env=clean_env,
                             capture_output=True, text=True, timeout=30)
    (RESULTS / "bundle.stdout.json").write_text(bundled.stdout)
    (RESULTS / "bundle.stderr.txt").write_text(bundled.stderr)
    source_data = json.loads(source.stdout)
    bundle_data = json.loads(bundled.stdout)
    assert source_data["result"] == bundle_data["result"], "Source/bundle result differs"
    assert bundle_data["metadata"]["frozen"] is True
    assert bundle_data["metadata"]["path_env"] == ""
    bundle_root = Path(bundle_data["metadata"]["bundle_root"])
    python_paths = bundle_data["metadata"]["python_search_path"]
    assert all(Path(path).is_relative_to(bundle_root) for path in python_paths)
    assert Path(bundle_data["metadata"]["pygame_module"]).is_relative_to(bundle_root)
    mapped_python = bundle_data["metadata"]["mapped_libpython"]
    assert mapped_python and all(Path(path).is_relative_to(bundle_root) for path in mapped_python)
    python_libraries = sorted(str(p.relative_to(bundle_dir)) for p in bundle_dir.rglob("libpython*") if p.is_file())
    assert python_libraries, "No bundled Python shared library found"

    inventory = [
        {"path": str(path.relative_to(bundle_dir)), "bytes": path.stat().st_size,
         "sha256": sha256(path), "symlink": path.is_symlink()}
        for path in sorted(bundle_dir.rglob("*")) if path.is_file()
    ]
    (RESULTS / "bundle-inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
    versions = {dist.metadata["Name"]: dist.version for dist in importlib.metadata.distributions()}
    report = {
        "schema": 1,
        "scope": "hand-authored Linux pygame backend and packaging probe; not Brickwright transpiler qualification",
        "host": {"platform": platform.platform(), "machine": platform.machine(),
                 "python": platform.python_version(), "libc": list(platform.libc_ver())},
        "dependencies": dict(sorted(versions.items())),
        "commands": {"asset": asset_cmd, "source": source_cmd, "build": build_cmd, "bundle": bundle_cmd},
        "execution_environment": clean_env,
        "checks": {"source_equals_bundle": True, "all_24_frame_hashes_match": True,
                   "source_assertions_pass": True, "packaged_frozen_runtime": True,
                   "empty_path": True, "python_search_path_inside_bundle": True,
                   "pygame_loaded_from_bundle": True, "libpython_loaded_from_bundle": True,
                   "bundled_python_shared_library": python_libraries},
        "result": source_data["result"],
        "source_metadata": source_data["metadata"],
        "bundle_metadata": bundle_data["metadata"],
        "build_seconds": round(build_seconds, 3),
        "bundle": {"files_including_symlinks": len(inventory),
                   "regular_file_bytes": sum(item["bytes"] for item in inventory if not item["symlink"]),
                   "logical_file_bytes_including_symlinks": sum(item["bytes"] for item in inventory),
                   "executable_bytes": executable.stat().st_size,
                   "executable_sha256": sha256(executable),
                   "inventory_sha256": sha256(RESULTS / "bundle-inventory.json")},
        "source_files": {name: sha256(ROOT / name) for name in ["game.py", "make_asset.py", "run_probe.py", "requirements.txt", "assets/hero.png"]},
        "limitations": [
            "Original hand-authored fixture, not generated by Brickwright or imported from MakeCode.",
            "Dummy SDL video/audio: no visible GUI, real input, sound, timing or device qualification.",
            "Executed on this Linux x86_64/glibc 2.41 host only; not a clean-distro container, other desktop OS or mobile test.",
            "Empty PATH and bundled libpython demonstrate no Python installation lookup, not independence from host libc/loader.",
            "One-directory standalone bundle; no installer, signing, automatic updater or final distribution-license audit.",
            "Hashes describe this build; byte-for-byte reproducible builds have not been established.",
        ],
    }
    (RESULTS / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"report": str(RESULTS / "report.json"), "checks": report["checks"],
                      "trace_sha256": report["result"]["trace_sha256"],
                      "bundle": report["bundle"], "build_seconds": report["build_seconds"]}, indent=2))


if __name__ == "__main__":
    main()
