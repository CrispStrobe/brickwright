"""Bounded pwasm host probe. This does not measure a browser runtime."""
import hashlib
import importlib.metadata
import json
import platform
import sys
import time
from pathlib import Path

from pwasm.guests import MicroPython
import pwasm.guests


def milliseconds(start):
    return round((time.perf_counter() - start) * 1000, 3)


def execute(guest, source, **options):
    started = time.perf_counter()
    try:
        stdout = guest.exec(source, **options)
        return {"stdout": stdout, "elapsed_ms": milliseconds(started)}
    except Exception as error:
        return {
            "error_type": type(error).__name__,
            "error": str(error),
            "elapsed_ms": milliseconds(started),
        }


report = {
    "scope": "CPython host running pwasm's custom MicroPython guest; not browser qualification",
    "python": platform.python_version(),
    "platform": {"system": platform.system(), "machine": platform.machine(), "libc": platform.libc_ver()},
    "pwasm_version": importlib.metadata.version("pwasm"),
    "mode": "auto",
    "initialization_samples_ms": [],
    "cases": [],
}
guest_file = Path(pwasm.guests.__file__).parent / "micropython.wasm"
guest_bytes = guest_file.read_bytes()
report["guest"] = {"bytes": len(guest_bytes), "sha256": hashlib.sha256(guest_bytes).hexdigest()}

# First sample may compile/cache guest code; later instances reuse that host cache.
for _ in range(3):
    started = time.perf_counter()
    guest = MicroPython(timeout=5, max_memory=32 << 20)
    report["initialization_samples_ms"].append(milliseconds(started))

fixtures = [
    ("arithmetic", "print(7 // 2, -7 // 2, 7 % 2, 1 / 2)", "3 -4 1 0.5\n"),
    ("large_integer", "print(10 ** 30 + 1)", "1000000000000000000000000000001\n"),
    ("class_and_list", "class Counter:\n    def __init__(self, value):\n        self.value = value\n    def add(self, n):\n        self.value += n\nc = Counter(20)\nc.add(22)\nprint(c.value)\nprint([x*x for x in range(5)])", "42\n[0, 1, 4, 9, 16]\n"),
    ("json_stdlib", "import json\nvalue = json.loads('{\"items\": [1, 2, 3]}')\nprint(sum(value['items']))", "6\n"),
    ("f_string", "name = 'Brickwright'\nprint(f'{name}: {3 * 7}')", "Brickwright: 21\n"),
    ("dataclass", "from dataclasses import dataclass\n@dataclass\nclass Point:\n    x: int\n    y: int\np = Point(20, 22)\nprint(p.x + p.y)", "42\n"),
    ("loop_10000", "total = 0\nfor i in range(10000):\n    total += i\nprint(total)", "49995000\n"),
]
for name, source, expected in fixtures:
    guest = MicroPython(timeout=5, max_memory=32 << 20)
    result = execute(guest, source)
    report["cases"].append({"id": name, "source": source, "expected_stdout": expected,
                            "matches_expected": result.get("stdout") == expected, **result})

guest = MicroPython(timeout=5, max_memory=32 << 20)
calls = []
def add(a, b):
    calls.append([a, b])
    return a + b
guest.register("add", add)
result = execute(guest, "import host\nprint(host.call('add', 20, 22))")
report["cases"].append({"id": "registered_host_callback", "calls": calls,
                        "matches_expected": result.get("stdout") == "42\n" and calls == [[20, 22]], **result})
report["cases"].append({"id": "unknown_host_callback", **execute(guest, "host.call('missing')")})
report["cases"].append({"id": "os_import", **execute(guest, "import os")})

# Hard-limit exceptions require discarding the guest, not continuing a REPL.
guest = MicroPython(timeout=5, max_memory=32 << 20)
report["cases"].append({"id": "infinite_loop_timeout_200ms", **execute(guest, "while True:\n    pass", timeout=0.2)})
guest = MicroPython(timeout=5, max_memory=32 << 20)
report["cases"].append({"id": "infinite_loop_fuel", **execute(guest, "while True:\n    pass", fuel=200_000)})
guest = MicroPython(timeout=5, max_memory=32 << 20)
result = execute(guest, "print('fresh after limit')")
report["cases"].append({"id": "fresh_restart", "matches_expected": result.get("stdout") == "fresh after limit\n", **result})

# This intentionally bounded host callback demonstrates the preemption boundary.
guest = MicroPython(timeout=5, max_memory=32 << 20)
guest.register("wait", lambda: (time.sleep(0.15), 42)[1])
report["cases"].append({"id": "host_callback_150ms_with_deadline_10ms",
                        **execute(guest, "import host\nprint(host.call('wait'))", timeout=0.01)})
report["limitations"] = [
    "One host environment, one sample per semantic case, no browser/device qualification.",
    "pwasm initialization samples include host cache effects; not network startup timings.",
    "This custom guest and bridge differ from official MicroPython/WASM and the JS runtime harness.",
    "The host-wait fixture deliberately uses a 150ms callback to locate the deadline boundary.",
    "No memory-growth, adversarial-security or application-simulator qualification.",
]
target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("pwasm-host-rerun.json")
target.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"output": target.name, "version": report["pwasm_version"],
                  "initialization_samples_ms": report["initialization_samples_ms"],
                  "cases": [{k: value for k, value in row.items() if k in
                             ("id", "matches_expected", "error_type", "elapsed_ms")} for row in report["cases"]]}, indent=2))
