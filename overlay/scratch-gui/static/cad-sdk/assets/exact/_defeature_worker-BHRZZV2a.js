var I = Object.defineProperty;
var K = (a, e, n) => e in a ? I(a, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : a[e] = n;
var _ = (a, e, n) => K(a, typeof e != "symbol" ? e + "" : e, n);
var M = class extends Error {
  constructor(a) {
    super(a), this.name = "ModelingError";
  }
}, q = class extends M {
  constructor(e, n, r = null, o = null) {
    let t = `${e} failed`;
    r && (t += ` (${r})`), o && (t += `: ${o}`);
    super(t);
    _(this, "operation");
    _(this, "status");
    _(this, "detail");
    _(this, "hint");
    /** Where the kernel gave up (see the class); set by `kernelCall`. */
    _(this, "trace", []);
    this.name = "KernelError", this.operation = e, this.status = r, this.detail = n, this.hint = o;
  }
};
function Q(a, e) {
  return a.trace = Object.freeze([...e]), a;
}
var U = {
  count: 0,
  last: null,
  // (what the last one said: "function signature mismatch")
  next: "load the module again (reload the page) before relying on what it computes, or run the modeling in a KernelWorker, which starts a new kernel after a crash"
};
U.next = null;
var J = import("./chunk-T3BBAX2G-CmWqW0-f.js"), z = 1, B = 2, E = 3, v = 4, C = 5;
function x({ k: a, module: e }, n) {
  const r = "/tmp/smlibwasm-probe.smb";
  e.FS.writeFile(r, n);
  try {
    return a.read_brep_from_file(r, null, !1);
  } finally {
    e.FS.unlink(r);
  }
}
function P(a, e) {
  const { ext: n, k: r } = a, o = [];
  let t = 0;
  try {
    for (const l of e.bodies)
      o.push(x(a, l));
    const c = (l, u) => {
      const f = r.brep_faces(l);
      return u.map((d) => f[d]);
    };
    if (e.op === "defeature")
      t = r.defeature.defeature(o[0], e.groups.map((l) => c(o[0], l)), e.rebuild).brep ?? 0;
    else if (e.op === "remove_fillet_faces")
      t = r.defeature.remove_fillet_faces(o[0], c(o[0], e.faces)).brep ?? 0;
    else if (e.op === "surface_fillet") {
      const [l, u] = o.map((f) => r.face_surface(c(f, [0])[0]));
      t = r.surface_surface_fillet(l, u, e.options) ?? 0;
    } else
      throw new TypeError(`no kernel step ${e.op}`);
  } finally {
    for (const c of t ? [t, ...o] : o)
      n.delete_brep(c);
  }
}
function G({ ext: a, k: e }, n, [r, o]) {
  const t = e.brep_faces(n);
  if (t.length !== r.length || t.length !== o.length)
    return;
  let c = r.flatMap((l, u) => l != null && l.length === 3 ? [u] : []);
  c.length && a.set_face_colors(n, c.map((l) => t[l]), c.map((l) => Array.from(r[l], Number))), c = o.flatMap((l, u) => l ? [u] : []), c.length && a.set_face_names(n, c.map((l) => t[l]), c.map((l) => String(o[l])));
}
function H(a, e) {
  const { ext: n, k: r, module: o } = a, t = [], c = [], l = [], u = (f) => f ? (c.includes(f) || c.push(f), { $body: c.indexOf(f) }) : null;
  try {
    e.bodies.forEach((s, i) => {
      t.push(x(a, s));
      const p = e.tags?.[i];
      p && n.set_topology_tags(t[i], p[0], p[1]), p?.[2] && G(a, t[i], p[2]);
    });
    const f = (s, i, p) => {
      const m = r[`brep_${i}`](s);
      return p.map((g) => m[g]);
    };
    let d;
    if (e.op === "shell_brep")
      d = u(r.shell_brep(t[0], e.distance, { ...e.options, faces_to_shell: f(t[0], "faces", e.faces) }));
    else if (e.op === "offset_brep")
      d = u(r.offset_brep(t[0], e.distance, e.options));
    else if (e.op === "defeature") {
      const s = r.defeature.defeature(t[0], e.groups.map((i) => f(t[0], "faces", i)), e.rebuild);
      d = { added: s.added, applied: s.applied, brep: u(s.brep) };
    } else if (e.op === "remove_fillet_faces") {
      const s = r.defeature.remove_fillet_faces(t[0], f(t[0], "faces", e.faces));
      d = { brep: u(s.brep), removed: Array.from(s.removed, Boolean) };
    } else if (e.op === "surface_fillet") {
      const [s, i] = t.map((p) => r.face_surface(f(p, "faces", [0])[0]));
      d = u(r.surface_surface_fillet(s, i, e.options));
    } else if (e.op === "fillet_preview") {
      const s = r.fillet_preview(t[0], f(t[0], "edges", e.edges), { radius: e.distance });
      try {
        d = s.map((i) => u(n.face_from_surface(i)));
      } finally {
        for (const i of s)
          n.delete_surface(i);
      }
    } else if (e.op === "region_shells")
      d = n.region_shells(t[0]).map((s) => s.map((i) => u(i)));
    else if (e.op === "boolean") {
      let s = r.brep_copy(t[0]);
      l.push(s);
      for (const i of t.slice(1)) {
        const p = r.brep_copy(i);
        let m;
        try {
          m = n.boolean(s, p, e.operation, e.nonManifold);
        } catch (g) {
          throw n.delete_brep(p), g;
        }
        m !== s && (l.splice(l.indexOf(s), 1, m), s = m);
      }
      d = u(s);
    } else if (e.op === "round_edges") {
      const [s, i, p, m, g, F, $, N, O, T, R, W, D] = e.args;
      n.clear_kernel_trace();
      const A = n.round_edges(t[0], f(t[0], "edges", e.edges), s, i, p, f(t[0], "faces", m), g, F, $, N, O, T ?? [], R ?? [], W ?? [], D ?? 0);
      d = { brep: u(t[0]), record: A.status == null ? A : { ...A, trace: n.kernel_trace()[0] } };
    } else
      throw new TypeError(`no kernel step ${e.op}`);
    const w = c.map((s, i) => {
      const p = `/tmp/smlibwasm-probe-result-${i}.smb`;
      r.brep_write_to_file(s, p, !1);
      try {
        return o.FS.readFile(p);
      } finally {
        o.FS.unlink(p);
      }
    }), S = c.map((s) => [...n.topology_tags(s), n.face_attrs(s)]), h = new TextEncoder().encode(JSON.stringify({ value: d, sizes: w.map((s) => s.length), marks: S })), y = new Uint8Array(4 + h.length + w.reduce((s, i) => s + i.length, 0));
    return new DataView(y.buffer).setUint32(0, h.length, !0), y.set(h, 4), w.reduce((s, i) => (y.set(i, s), s + i.length), 4 + h.length), y;
  } finally {
    for (const f of /* @__PURE__ */ new Set([...c, ...t, ...l]))
      n.delete_brep(f);
  }
}
function L(a, e, n) {
  for (let r = 0; r < n.length; r += e.length) {
    const o = n.subarray(r, r + e.length);
    e.set(o), Atomics.store(a, 1, o.length), Atomics.store(a, 0, v), Atomics.notify(a, 0), Atomics.wait(a, 0, v);
  }
}
async function b(a) {
  const e = await J, n = new Int32Array(a.state);
  Atomics.store(n, 0, z), Atomics.notify(n, 0);
  let r = B;
  if (a.data) {
    let o = null;
    try {
      o = H(e, a);
    } catch (t) {
      if (typeof WebAssembly < "u" && t instanceof WebAssembly.RuntimeError)
        r = E;
      else {
        r = C;
        const c = t instanceof Error ? { name: t.name, message: t.message } : { name: "Error", message: String(t) }, l = t?.trace;
        t instanceof Error && Array.isArray(l) ? c.trace = l : t instanceof Error && t.constructor === Error && (c.trace = e.ext.kernel_trace()[0]), o = new TextEncoder().encode(JSON.stringify(c));
      }
    }
    o !== null && L(n, new Uint8Array(a.data), o);
  } else
    try {
      P(e, a);
    } catch (o) {
      typeof WebAssembly < "u" && o instanceof WebAssembly.RuntimeError && (r = E);
    }
  Atomics.store(n, 0, r), Atomics.notify(n, 0);
}
var k = globalThis.process?.getBuiltinModule?.("node:worker_threads")?.parentPort;
k ? k.on("message", b) : globalThis.onmessage = (a) => b(a.data);
export {
  q as K,
  M,
  U as _,
  Q as a
};
