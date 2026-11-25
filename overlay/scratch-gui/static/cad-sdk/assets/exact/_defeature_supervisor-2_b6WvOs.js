var u = {}, i;
function f() {
  if (i) return u;
  i = 1;
  var o = globalThis.process?.getBuiltinModule?.("node:worker_threads"), r = null;
  function l() {
    let e;
    if (o) {
      const t = import.meta.url;
      e = new o.Worker(new URL(t.endsWith(".ts") ? "./_defeature_worker.ts" : "./_defeature_worker.js", t)), e.on("error", () => n(e)), e.on("exit", () => n(e));
    } else
      e = new Worker(new URL(
        /* @vite-ignore */
        "" + new URL("_defeature_worker-CsKCd8rD.js", import.meta.url).href,
        import.meta.url
      ), { type: "module", name: "smlibwasm-probe" }), e.onerror = () => n(e);
    return e;
  }
  function n(e) {
    r === e && (r = null);
  }
  function s(e) {
    if (e.kill) {
      const t = r;
      r = null, t?.terminate();
      return;
    }
    r ?? (r = l()), r.postMessage(e, e.bodies.map((t) => t.buffer));
  }
  var a = o?.parentPort;
  return a ? a.on("message", s) : globalThis.onmessage = (e) => s(e.data), u;
}
f();
