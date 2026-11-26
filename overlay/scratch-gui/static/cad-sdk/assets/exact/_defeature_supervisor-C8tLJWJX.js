var l = {}, f;
function _() {
  if (f) return l;
  f = 1;
  var d = Object.defineProperty, n = (e, r) => d(e, "name", { value: r, configurable: !0 }), a = globalThis.process?.getBuiltinModule?.("node:worker_threads"), t = null;
  function u() {
    let e;
    if (a) {
      const r = import.meta.url;
      e = new a.Worker(new URL(r.endsWith(".ts") ? "./_defeature_worker.ts" : "./_defeature_worker.js", r)), e.on("error", () => o(e)), e.on("exit", () => o(e));
    } else
      e = new Worker(new URL(
        /* @vite-ignore */
        "" + new URL("_defeature_worker-Bl09qDC6.js", import.meta.url).href,
        import.meta.url
      ), { type: "module", name: "smlibwasm-probe" }), e.onerror = () => o(e);
    return e;
  }
  n(u, "start");
  function o(e) {
    t === e && (t = null);
  }
  n(o, "lost");
  function s(e) {
    if (e.kill) {
      const r = t;
      t = null, r?.terminate();
      return;
    }
    t ?? (t = u()), t.postMessage(e, e.bodies.map((r) => r.buffer));
  }
  n(s, "onMessage");
  var i = a?.parentPort;
  return i ? i.on("message", s) : globalThis.onmessage = (e) => s(e.data), l;
}
_();
