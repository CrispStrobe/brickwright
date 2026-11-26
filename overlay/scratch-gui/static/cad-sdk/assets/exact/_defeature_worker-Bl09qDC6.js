var C = Object.defineProperty;
var G = (t, e, a) => e in t ? C(t, e, { enumerable: !0, configurable: !0, writable: !0, value: a }) : t[e] = a;
var g = (t, e, a) => G(t, typeof e != "symbol" ? e + "" : e, a);
var H = Object.defineProperty, x = (t, e) => H(t, "name", { value: e, configurable: !0 }), h, L = (h = class extends Error {
  constructor(e) {
    super(e), this.name = "ModelingError";
  }
}, x(h, "ModelingError"), h), y, re = (y = class extends L {
  constructor(a, n, o = null, r = null) {
    let l = `${a} failed`;
    o && (l += ` (${o})`), r && (l += `: ${r}`);
    super(l);
    g(this, "operation");
    g(this, "status");
    g(this, "detail");
    g(this, "hint");
    /** Where the kernel gave up (see the class); set by `kernelCall`. */
    g(this, "trace", []);
    this.name = "KernelError", this.operation = a, this.status = o, this.detail = n, this.hint = r;
  }
}, x(y, "KernelError"), y);
function V(t, e) {
  return t.trace = Object.freeze([...e]), t;
}
x(V, "_traced");
var q = {
  count: 0,
  last: null,
  // (what the last one said: "function signature mismatch")
  next: "load the module again (reload the page) before relying on what it computes, or run the modeling in a KernelWorker, which starts a new kernel after a crash"
}, Q = Object.defineProperty, m = (t, e) => Q(t, "name", { value: e, configurable: !0 });
q.next = null;
var X = import("./chunk-T3BBAX2G-RUWmWc5k.js"), Y = 1, Z = 2, S = 3, $ = 4, j = 5;
function F({ k: t, module: e }, a) {
  const n = "/tmp/smlibwasm-probe.smb";
  e.FS.writeFile(n, a);
  try {
    return t.read_brep_from_file(n, null, !1);
  } finally {
    e.FS.unlink(n);
  }
}
m(F, "load");
function N(t, e) {
  const { ext: a, k: n } = t, o = [];
  let r = 0;
  try {
    for (const i of e.bodies)
      o.push(F(t, i));
    const l = /* @__PURE__ */ m((i, d) => {
      const f = n.brep_faces(i);
      return d.map((u) => f[u]);
    }, "faces");
    if (e.op === "defeature")
      r = n.defeature.defeature(o[0], e.groups.map((i) => l(o[0], i)), e.rebuild).brep ?? 0;
    else if (e.op === "remove_fillet_faces")
      r = n.defeature.remove_fillet_faces(o[0], l(o[0], e.faces)).brep ?? 0;
    else if (e.op === "surface_fillet") {
      const [i, d] = o.map((f) => n.face_surface(l(f, [0])[0]));
      r = n.surface_surface_fillet(i, d, e.options) ?? 0;
    } else
      throw new TypeError(`no kernel step ${e.op}`);
  } finally {
    for (const l of r ? [r, ...o] : o)
      a.delete_brep(l);
  }
}
m(N, "run");
function P({ ext: t, k: e }, a, [n, o]) {
  const r = e.brep_faces(a);
  if (r.length !== n.length || r.length !== o.length)
    return;
  let l = n.flatMap((i, d) => i != null && i.length === 3 ? [d] : []);
  l.length && t.set_face_colors(a, l.map((i) => r[i]), l.map((i) => Array.from(n[i], Number))), l = o.flatMap((i, d) => i ? [d] : []), l.length && t.set_face_names(a, l.map((i) => r[i]), l.map((i) => String(o[i])));
}
m(P, "putFaceAttrs");
function T(t, e) {
  const { ext: a, k: n, module: o } = t, r = [], l = [], i = [], d = /* @__PURE__ */ m((f) => f ? (l.includes(f) || l.push(f), { $body: l.indexOf(f) }) : null, "body");
  try {
    e.bodies.forEach((s, c) => {
      r.push(F(t, s));
      const p = e.tags?.[c];
      p && a.set_topology_tags(r[c], p[0], p[1]), p?.[2] && P(t, r[c], p[2]);
    });
    const f = /* @__PURE__ */ m((s, c, p) => {
      const _ = n[`brep_${c}`](s);
      return p.map((w) => _[w]);
    }, "pick");
    let u;
    if (e.op === "shell_brep")
      u = d(n.shell_brep(r[0], e.distance, { ...e.options, faces_to_shell: f(r[0], "faces", e.faces) }));
    else if (e.op === "offset_brep")
      u = d(n.offset_brep(r[0], e.distance, e.options));
    else if (e.op === "defeature") {
      const s = n.defeature.defeature(r[0], e.groups.map((c) => f(r[0], "faces", c)), e.rebuild);
      u = { added: s.added, applied: s.applied, brep: d(s.brep) };
    } else if (e.op === "remove_fillet_faces") {
      const s = n.defeature.remove_fillet_faces(r[0], f(r[0], "faces", e.faces));
      u = { brep: d(s.brep), removed: Array.from(s.removed, Boolean) };
    } else if (e.op === "surface_fillet") {
      const [s, c] = r.map((p) => n.face_surface(f(p, "faces", [0])[0]));
      u = d(n.surface_surface_fillet(s, c, e.options));
    } else if (e.op === "fillet_preview") {
      const s = n.fillet_preview(r[0], f(r[0], "edges", e.edges), { radius: e.distance });
      try {
        u = s.map((c) => d(a.face_from_surface(c)));
      } finally {
        for (const c of s)
          a.delete_surface(c);
      }
    } else if (e.op === "region_shells")
      u = a.region_shells(r[0]).map((s) => s.map((c) => d(c)));
    else if (e.op === "boolean") {
      let s = n.brep_copy(r[0]);
      i.push(s);
      for (const c of r.slice(1)) {
        const p = n.brep_copy(c);
        let _;
        try {
          _ = a.boolean(s, p, e.operation, e.nonManifold);
        } catch (w) {
          throw a.delete_brep(p), w;
        }
        _ !== s && (i.splice(i.indexOf(s), 1, _), s = _);
      }
      u = d(s);
    } else if (e.op === "round_edges") {
      const [s, c, p, _, w, R, W, D, I, J, U, z, B] = e.args;
      a.clear_kernel_trace();
      const b = a.round_edges(r[0], f(r[0], "edges", e.edges), s, c, p, f(r[0], "faces", _), w, R, W, D, I, J ?? [], U ?? [], z ?? [], B ?? 0);
      u = { brep: d(r[0]), record: b.status == null ? b : { ...b, trace: a.kernel_trace()[0] } };
    } else
      throw new TypeError(`no kernel step ${e.op}`);
    const v = l.map((s, c) => {
      const p = `/tmp/smlibwasm-probe-result-${c}.smb`;
      n.brep_write_to_file(s, p, !1);
      try {
        return o.FS.readFile(p);
      } finally {
        o.FS.unlink(p);
      }
    }), M = l.map((s) => [...a.topology_tags(s), a.face_attrs(s)]), A = new TextEncoder().encode(JSON.stringify({ value: u, sizes: v.map((s) => s.length), marks: M })), E = new Uint8Array(4 + A.length + v.reduce((s, c) => s + c.length, 0));
    return new DataView(E.buffer).setUint32(0, A.length, !0), E.set(A, 4), v.reduce((s, c) => (E.set(c, s), s + c.length), 4 + A.length), E;
  } finally {
    for (const f of /* @__PURE__ */ new Set([...l, ...r, ...i]))
      a.delete_brep(f);
  }
}
m(T, "make");
function K(t, e, a) {
  for (let n = 0; n < a.length; n += e.length) {
    const o = a.subarray(n, n + e.length);
    e.set(o), Atomics.store(t, 1, o.length), Atomics.store(t, 0, $), Atomics.notify(t, 0), Atomics.wait(t, 0, $);
  }
}
m(K, "send");
async function k(t) {
  const e = await X, a = new Int32Array(t.state);
  Atomics.store(a, 0, Y), Atomics.notify(a, 0);
  let n = Z;
  if (t.data) {
    let o = null;
    try {
      o = T(e, t);
    } catch (r) {
      if (typeof WebAssembly < "u" && r instanceof WebAssembly.RuntimeError)
        n = S;
      else {
        n = j;
        const l = r instanceof Error ? { name: r.name, message: r.message } : { name: "Error", message: String(r) }, i = r?.trace;
        r instanceof Error && Array.isArray(i) ? l.trace = i : r instanceof Error && r.constructor === Error && (l.trace = e.ext.kernel_trace()[0]), o = new TextEncoder().encode(JSON.stringify(l));
      }
    }
    o !== null && K(a, new Uint8Array(t.data), o);
  } else
    try {
      N(e, t);
    } catch (o) {
      typeof WebAssembly < "u" && o instanceof WebAssembly.RuntimeError && (n = S);
    }
  Atomics.store(a, 0, n), Atomics.notify(a, 0);
}
m(k, "onJob");
var O = globalThis.process?.getBuiltinModule?.("node:worker_threads")?.parentPort;
O ? O.on("message", k) : globalThis.onmessage = (t) => k(t.data);
export {
  re as K,
  L as M,
  q as _,
  V as a
};
