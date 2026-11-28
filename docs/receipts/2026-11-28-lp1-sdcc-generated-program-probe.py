#!/usr/bin/env python3
"""Replay the pinned LP1 canary entirely in memory; emit metadata JSON.

Reads the reviewed historical receipt and exact first-party Node probe from disk.
Fetches only pinned GitHub blob bytes into memory. No third-party payload, generated
object, map or image is written to disk. GITHUB_TOKEN or GH_TOKEN is optional and
is sent only to api.github.com. The recorded experiment used a verified historical
ZIP; this convenience transport fetches byte-identical supplier blobs directly.
This transport wrapper was not executed for the recorded experiment.
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

RECEIPT_SHA256 = "bf526df79ca7e0c3cbe361dec564effbeb178d6f85085b016ed9a28257b390e5"
HARNESS_SHA256 = "72154853c3dfd2e030cceede215c37cfa38f88f3c41001342b60e0369c9c2d60"
RECORDED_MAP_SHA256 = "a50af3689ca2169980f2f76aa56f596d3f0760e93c6111e14d0778695ed33653"
RECORDED_IHX_SHA256 = "84ba3cfebf6f69fd644b4e2cc1c29e81f796d58c89b58b8aaa5b66e03f8a42cb"
SUPPLIER = "CrispStrobe/sdcc-wasm"
PRODUCER = "CrispStrobe/emu8051-stc"
EXPECTED_TOOLS = ["cc1", "sdcc", "sdas8051", "sdld"]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def verify(data, spec, label):
    if len(data) != spec["bytes"] or sha256(data) != spec["sha256"]:
        raise ValueError("Integrity refusal: " + label)
    if spec.get("gitBlob") and git_blob(data) != spec["gitBlob"]:
        raise ValueError("Git blob refusal: " + label)


def read_blob(repository, spec, label, acquisition):
    if repository not in (SUPPLIER, PRODUCER):
        raise ValueError("Unapproved source repository")
    if not re.fullmatch(r"[0-9a-f]{40}", spec["gitBlob"]):
        raise ValueError("Invalid pinned blob identity")
    url = "https://api.github.com/repos/" + repository + "/git/blobs/" + spec["gitBlob"]
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "brickwright-lp1-memory-probe"}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            return None

    # Blob API requests should not redirect. Refuse redirects so credentials
    # cannot be forwarded to another origin.
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(urllib.request.Request(url, headers=headers), timeout=45) as response:
            maximum = 2 * spec["bytes"] + 65536  # Include JSON-escaped base64 wrapping.
            raw = response.read(maximum + 1)
            if len(raw) > maximum:
                raise ValueError("Oversized GitHub blob response: " + label)
    except urllib.error.HTTPError as error:
        raise RuntimeError("GitHub blob HTTP status " + str(error.code) + ": " + label) from None
    except urllib.error.URLError:
        raise RuntimeError("GitHub blob transport failed: " + label) from None
    envelope = json.loads(raw)
    if envelope.get("encoding") != "base64" or envelope.get("sha") != spec["gitBlob"]:
        raise ValueError("GitHub blob envelope refusal: " + label)
    encoded = "".join(envelope["content"].split())
    data = base64.b64decode(encoded, validate=True)
    verify(data, spec, label)
    acquisition.append({"label": label, "url": url, "bytes": len(data), "sha256": sha256(data),
                        "gitBlob": git_blob(data)})
    return data


def require_success(report, node_returncode):
    # The unchanged recorded CJS probe emits structured failures and may itself
    # exit zero. Neither factory resolution nor Node transport exit is success.
    if node_returncode != 0 or report.get("result") != "pipeline-completed-map-captured":
        raise ValueError("Compiler pipeline did not complete successfully")
    stages = report.get("stages", [])
    if [stage.get("tool") for stage in stages] != EXPECTED_TOOLS:
        raise ValueError("Compiler stage order refusal")
    for stage in stages:
        statuses = stage.get("quitStatuses", [])
        errors = stage.get("quitErrors", [])
        if not statuses or any(type(status) is not int or status != 0 for status in statuses):
            raise ValueError("Nonzero or absent compiler exit: " + stage["tool"])
        if len(errors) != len(statuses) or any(
            not isinstance(error, dict) or error.get("name") != "ExitStatus"
            or type(error.get("status")) is not int or error["status"] != 0
            for error in errors
        ):
            raise ValueError("Unexpected compiler exit exception: " + stage["tool"])
    if report.get("externalProcesses") != 0 or report.get("hostPayloadWrites") != 0:
        raise ValueError("Compiler isolation observation refusal")
    if report.get("networkDuringCompilerExecution") is not False:
        raise ValueError("Compiler network observation refusal")


def bind_map(report, historical):
    observed = report["map"]
    tail = observed["libraryTableTailLines"]
    if not tail or not re.fullmatch(r"Libraries Linked\s+\[ object file \]", tail[0]):
        raise ValueError("Actual linker table header refusal")
    rows = []
    closed = False
    for offset, line in enumerate(tail[1:], 1):
        if line.startswith("\f"):
            closed = True
            continue
        if closed:
            if ".lib" in line or ".rel" in line:
                raise ValueError("Unparsed additional linker selection page")
            continue
        if not line.strip():
            continue
        match = re.fullmatch(r"/lib/([A-Za-z0-9_]+\.lib)\s+\[\s+([A-Za-z0-9_]+\.rel)\s+\]", line)
        if not match:
            raise ValueError("Unparsed linker selection row")
        archive_name, member_name = match.groups()
        libraries = [entry for entry in historical["compiledLibraryMembers"]["libraries"]
                     if entry["path"] == "/lib/small/" + archive_name]
        if len(libraries) != 1:
            raise ValueError("Ambiguous selected library")
        library = libraries[0]
        members = [entry for entry in library["members"] if entry["name"] == member_name]
        if len(members) != 1:
            raise ValueError("Ambiguous selected object")
        rows.append({"library": archive_name, "member": member_name,
                     "mapLine": observed["libraryTableStartLine"] + offset,
                     "installedLibraryPath": library["path"],
                     "librarySha256": library["sha256"], "object": members[0]})
    if not rows or len({(row["library"], row["member"]) for row in rows}) != len(rows):
        raise ValueError("Empty or duplicate selected object list")
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--historical-receipt", type=Path, required=True)
    parser.add_argument("--harness", type=Path,
                        default=Path(__file__).with_name("2026-11-28-lp1-sdcc-generated-program-probe.cjs"))
    parser.add_argument("--node", default=os.environ.get("CODEX_PRIMARY_RUNTIME_NODE") or shutil.which("node"))
    args = parser.parse_args()
    if not args.node:
        raise ValueError("Node executable is required")
    receipt_bytes = args.historical_receipt.read_bytes()
    harness_bytes = args.harness.read_bytes()
    if sha256(receipt_bytes) != RECEIPT_SHA256 or sha256(harness_bytes) != HARNESS_SHA256:
        raise ValueError("Historical receipt or exact probe source hash mismatch")
    historical = json.loads(receipt_bytes)
    if historical["supplier"]["repository"] != SUPPLIER:
        raise ValueError("Supplier identity refusal")
    memory = {}
    if Path("/proc/meminfo").exists():
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, value = line.split(":", 1)
            if key in ("MemAvailable", "MemTotal"):
                memory[key] = int(value.split()[0]) * 1024
        if memory.get("MemAvailable", 0) < 768 * 1024 * 1024:
            raise ValueError("At least 768 MiB available host memory is required")

    acquisition = []
    sources = historical["historicalBuild"]["buildSources"]
    driver_spec = next(source for source in sources if source["path"] == "sdcc-wasm/wasm-compile-driver.cjs")
    input_spec = next(source for source in sources if source["path"] == "sdcc-wasm/acceptance/generated-multimeter-idle.c")
    driver = read_blob(PRODUCER, driver_spec, "historical driver", acquisition)
    canary = read_blob(PRODUCER, input_spec, "generated-program canary", acquisition)
    runtime_spec = historical["installedRuntime"]
    runtime = read_blob(SUPPLIER, runtime_spec, "runtime.json", acquisition)
    modules = {}
    suffix = bytes.fromhex(historical["compilerModules"]["javascriptTransformation"]["hex"])
    if len(suffix) != 27:
        raise ValueError("Unexpected documented glue append")
    for item in historical["compilerModules"]["modules"]:
        value = read_blob(SUPPLIER, item["supplier"], item["path"], acquisition)
        name, extension = item["path"].split(".")
        entry = modules.setdefault(name, {})
        if extension == "js":
            if not value.endswith(suffix):
                raise ValueError("Supplier JavaScript append mismatch")
            original = value[:-len(suffix)]
            verify(original, item["historical"], "historical " + item["path"])
            entry["js"] = original.decode("utf-8")
        elif extension == "wasm":
            entry["wasm"] = base64.b64encode(value).decode("ascii")
        else:
            raise ValueError("Unexpected compiler file type")

    packet = {
        "archive": {"downloadedForThisReplay": False,
                    "historicalReceiptArchiveReference": historical["historicalArchive"]["artifactUrl"],
                    "payloadSource": "Direct pinned supplier Git blobs; no expiring ZIP required."},
        "driver": driver.decode("utf-8"), "driverSpec": driver_spec,
        "input": canary.decode("utf-8"), "inputSpec": input_spec,
        "runtimeJson": runtime.decode("utf-8"), "runtimeSpec": runtime_spec,
        "runtimeMemberSpecs": runtime_spec["members"],
        "moduleSpecs": historical["compilerModules"]["modules"],
        "exportAppendHex": suffix.hex(), "modules": modules,
    }
    completed = subprocess.run(
        [args.node, "--max-old-space-size=512", "-e", harness_bytes.decode("utf-8")],
        input=json.dumps(packet).encode("utf-8"), capture_output=True, timeout=60,
    )
    report = json.loads(completed.stdout)
    report["nodeTransportExit"] = completed.returncode
    report["nodeStderrBytes"] = len(completed.stderr)
    report["nodeStderrSha256"] = sha256(completed.stderr)
    report["hostMemoryBeforeLaunch"] = memory
    report["replayTransport"] = {
        "method": "Direct pinned supplier Git blob API fetch; bytes stay in memory.",
        "sources": acquisition, "historicalReceiptSha256": RECEIPT_SHA256,
        "probeSha256": HARNESS_SHA256,
        "completedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    try:
        require_success(report, completed.returncode)
        selected = bind_map(report, historical)
    except Exception as error:
        report["replayTransport"]["qualification"] = "failed"
        report["replayTransport"]["failure"] = str(error)
        print(json.dumps(report, separators=(",", ":")))
        return 1
    report["replayTransport"]["qualification"] = "passed"
    report["selectedObjects"] = selected
    report["matchesRecordedMap"] = report["map"]["sha256"] == RECORDED_MAP_SHA256
    report["matchesRecordedIhx"] = report["ihx"]["sha256"] == RECORDED_IHX_SHA256
    print(json.dumps(report, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        # Do not print tokens, transport URLs with queries, fetched payloads,
        # compiler source or child stderr.
        print(json.dumps({"result": "transport-failed", "errorType": type(error).__name__,
                          "message": str(error) if isinstance(error, (ValueError, RuntimeError))
                          else "Transport or local invocation failed."},
                         separators=(",", ":")))
        raise SystemExit(1)
