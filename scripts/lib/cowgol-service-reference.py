#!/usr/bin/env python3
# SPDX-License-Identifier: BSD-3-Clause
"""Run requests through the compiler service's own build_cowgol.

Usage: cowgol-service-reference.py SERVICE_CHECKOUT BUNDLE_DIR REQUESTS.json OUT.json

REQUESTS.json is a list of {"id", "code", "target", "format"}. Each is passed
to stc-compiler's cowgol_build.build_cowgol exactly as POST /compile would,
with the native bundle named by COWGOL_BUNDLE. No HTTP server, FastAPI or
network is involved; the response dicts are written unchanged.
"""
import json
import os
import sys
from types import SimpleNamespace


def main():
    service, bundle, requests, output = sys.argv[1:5]
    os.environ["COWGOL_BUNDLE"] = os.path.abspath(bundle)
    sys.path.insert(0, os.path.abspath(service))
    import cowgol_build  # noqa: E402  (the pinned service module)
    status = cowgol_build.bundle_status()
    results = {}
    for item in json.load(open(requests)):
        req = SimpleNamespace(language="cowgol", code=item["code"], target=item["target"],
                              format=item["format"], options=[], defines={},
                              disassemble=False, symbols=False)
        results[item["id"]] = cowgol_build.build_cowgol(req)
    json.dump({"bundle_status": status, "results": results}, open(output, "w"), indent=1, sort_keys=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
