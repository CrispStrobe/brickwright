var r = null, f = !1;
function y(n) {
  if (f)
    throw new Error("init(): the kernel was loaded already, so its options come too late; call init before anything imports @classcad/smlibwasm, and take the package from its promise");
  const a = n, e = Object.keys(a);
  if (r !== null && !(e.length === Object.keys(r).length && e.every((t) => a[t] === r[t])))
    throw new Error("init(): called again with other options; the kernel loads once");
  r = { ...n };
}
function b(n) {
  f = !0;
  const a = r ?? {}, e = {};
  let t = null;
  a.locateFile && (e.locateFile = a.locateFile), a.instantiateWasm && (e.instantiateWasm = a.instantiateWasm);
  const o = a.wasmModule ?? a.wasmBinary;
  if (o != null) {
    let u = () => {
    };
    t = new Promise((s, l) => {
      u = l;
    }), e.instantiateWasm = (s, l) => ((o instanceof WebAssembly.Module ? WebAssembly.instantiate(o, s) : WebAssembly.instantiate(o, s).then((i) => i.instance)).then(l, (i) => u(new Error(`the kernel could not be instantiated (${i instanceof Error ? i.message : i})`, { cause: i }))), {});
  }
  const c = n(e);
  return t === null ? c : Promise.race([c, t]);
}
var m = ["locateFile", "wasmBinary", "wasmModule", "instantiateWasm"];
function w(n = {}) {
  if (n === null || typeof n != "object" || Array.isArray(n))
    throw new TypeError(`init(): the options must be an object, not ${n === null ? "null" : typeof n}`);
  const a = Object.keys(n);
  for (const t of a)
    if (!m.includes(t))
      throw new TypeError(`init() got an unexpected option '${t}' (its options: ${m.join(", ")})`);
  const e = n;
  for (const t of ["locateFile", "instantiateWasm"])
    if (e[t] != null && typeof e[t] != "function")
      throw new TypeError(`init(): ${t} must be a function, not ${typeof e[t]}`);
  if (e.wasmBinary != null && !(e.wasmBinary instanceof ArrayBuffer || ArrayBuffer.isView(e.wasmBinary)))
    throw new TypeError("init(): wasmBinary must be an ArrayBuffer or a Uint8Array");
  if (e.wasmModule != null && !(e.wasmModule instanceof WebAssembly.Module))
    throw new TypeError("init(): wasmModule must be a WebAssembly.Module (WebAssembly.compile)");
  if (["wasmBinary", "wasmModule", "instantiateWasm"].filter((t) => e[t] != null).length > 1)
    throw new TypeError("init(): give one of wasmBinary, wasmModule and instantiateWasm");
  return a.length && y(n), import("./chunk-MK7NZM5N-Cjg-Lcn-.js");
}
var h = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  init: w
});
export {
  b as _,
  h as c
};
