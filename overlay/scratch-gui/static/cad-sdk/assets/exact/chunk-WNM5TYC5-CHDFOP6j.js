var b = Object.defineProperty, c = (e, n) => b(e, "name", { value: n, configurable: !0 }), r = null, y = !1;
function w(e) {
  if (y)
    throw new Error("init(): the kernel was loaded already, so its options come too late; call init before anything imports @classcad/smlibwasm, and take the package from its promise");
  const n = e, t = Object.keys(n);
  if (r !== null && !(t.length === Object.keys(r).length && t.every((a) => n[a] === r[a])))
    throw new Error("init(): called again with other options; the kernel loads once");
  r = { ...e };
}
c(w, "_give");
function h(e) {
  y = !0;
  const n = r ?? {}, t = {};
  let a = null;
  n.locateFile && (t.locateFile = n.locateFile), n.instantiateWasm && (t.instantiateWasm = n.instantiateWasm);
  const o = n.wasmModule ?? n.wasmBinary;
  if (o != null) {
    let f = /* @__PURE__ */ c(() => {
    }, "fail");
    a = new Promise((s, l) => {
      f = l;
    }), t.instantiateWasm = (s, l) => ((o instanceof WebAssembly.Module ? WebAssembly.instantiate(o, s) : WebAssembly.instantiate(o, s).then((i) => i.instance)).then(l, (i) => f(new Error(`the kernel could not be instantiated (${i instanceof Error ? i.message : i})`, { cause: i }))), {});
  }
  const u = e(t);
  return a === null ? u : Promise.race([u, a]);
}
c(h, "_createModule");
var p = Object.defineProperty, _ = (e, n) => p(e, "name", { value: n, configurable: !0 }), m = ["locateFile", "wasmBinary", "wasmModule", "instantiateWasm"];
function d(e = {}) {
  if (e === null || typeof e != "object" || Array.isArray(e))
    throw new TypeError(`init(): the options must be an object, not ${e === null ? "null" : typeof e}`);
  const n = Object.keys(e);
  for (const a of n)
    if (!m.includes(a))
      throw new TypeError(`init() got an unexpected option '${a}' (its options: ${m.join(", ")})`);
  const t = e;
  for (const a of ["locateFile", "instantiateWasm"])
    if (t[a] != null && typeof t[a] != "function")
      throw new TypeError(`init(): ${a} must be a function, not ${typeof t[a]}`);
  if (t.wasmBinary != null && !(t.wasmBinary instanceof ArrayBuffer || ArrayBuffer.isView(t.wasmBinary)))
    throw new TypeError("init(): wasmBinary must be an ArrayBuffer or a Uint8Array");
  if (t.wasmModule != null && !(t.wasmModule instanceof WebAssembly.Module))
    throw new TypeError("init(): wasmModule must be a WebAssembly.Module (WebAssembly.compile)");
  if (["wasmBinary", "wasmModule", "instantiateWasm"].filter((a) => t[a] != null).length > 1)
    throw new TypeError("init(): give one of wasmBinary, wasmModule and instantiateWasm");
  return n.length && w(e), import("./chunk-IYXHJQNO-DWyS83ju.js");
}
_(d, "init");
var W = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  init: d
});
export {
  h as _,
  W as c
};
