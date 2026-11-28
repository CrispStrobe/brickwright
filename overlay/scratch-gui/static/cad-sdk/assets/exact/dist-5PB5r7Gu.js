var In = Object.defineProperty;
var Pn = (e, t, n) => t in e ? In(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var J = (e, t, n) => Pn(e, typeof t != "symbol" ? t + "" : t, n);
import { e as on, C as Nn, g as $n, h as _n, t as N, E as On, i as Rn, k as Cn, l as Dn, n as Ze, o as rn, q as wt, S as zn, r as Fn, u as Ln, v as Bn, w as Un, f as xe, x as sn, y as Hn, z as Xn, A as Wn, B as kn, D as jn, F as Gn, G as Vn, H as Kn, I as Yn, J as vt, K as Zn, L as an, N as Qn, O as Jn, P as cn, Q as ke, R as qn, T as eo, a as to, U as no } from "../geometry.worker-RK0f-gvM.js";
const oo = 1, rt = 1e-6, je = (e) => [...e.matchAll(/'((?:[^']|'')*)'/g)].map((t) => t[1].replace(/''/g, "'"));
function ro(e) {
  const t = /HEADER\s*;([\s\S]*?)ENDSEC\s*;/i.exec(e.slice(0, 65536))?.[1] ?? "", n = (c) => new RegExp(`${c}\\s*\\(([\\s\\S]*?)\\)\\s*;`, "i").exec(t)?.[1], o = n("FILE_DESCRIPTION"), r = n("FILE_NAME"), a = n("FILE_SCHEMA"), s = r ? je(r) : [], i = o ? je(o) : [], f = (c, d) => d && d.trim() ? { [c]: d.trim().slice(0, 200) } : {}, l = r ? [...r.matchAll(/\(([^()]*)\)/g)].map((c) => c[0]) : [], u = r ? je(r.replace(/\([^()]*\)/g, "")) : [];
  return {
    schema: a ? je(a).map((c) => c.trim()).filter(Boolean) : [],
    ...f("description", i[0]),
    ...f("name", s[0]),
    ...f("timestamp", s[1]),
    ...l.length >= 2 ? { ...f("preprocessor", u[2]), ...f("originatingSystem", u[3]) } : {}
  };
}
var A = class extends Error {
  constructor(t, n, o) {
    super(n, o);
    J(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, ln = class {
  constructor(e) {
    J(this, "id");
    this.id = e;
  }
}, so = class {
  constructor(e) {
    J(this, "name");
    this.name = e;
  }
}, ao = class {
  constructor(e, t) {
    J(this, "type");
    J(this, "value");
    this.type = e, this.value = t;
  }
}, io = /^(PRODUCT|PRODUCT_DEFINITION|PRODUCT_DEFINITION_FORMATION|PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE|PRODUCT_DEFINITION_SHAPE|SHAPE_DEFINITION_REPRESENTATION|NEXT_ASSEMBLY_USAGE_OCCURRENCE|ASSEMBLY_USAGE_OCCURRENCE|PRODUCT_DEFINITION_USAGE|CONTEXT_DEPENDENT_SHAPE_REPRESENTATION|SHAPE_REPRESENTATION_RELATIONSHIP|REPRESENTATION_RELATIONSHIP|CONSTRUCTIVE_GEOMETRY_REPRESENTATION_RELATIONSHIP|MAPPED_ITEM|REPRESENTATION_MAP|MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS|SHELL_BASED_SURFACE_MODEL|[A-Z_]*REPRESENTATION)$/, Mt = ["SHAPE_REPRESENTATION_RELATIONSHIP", "REPRESENTATION_RELATIONSHIP", "CONSTRUCTIVE_GEOMETRY_REPRESENTATION_RELATIONSHIP"], co = /* @__PURE__ */ new Set(["MANIFOLD_SOLID_BREP", "BREP_WITH_VOIDS", "SHELL_BASED_SURFACE_MODEL"]), bt = class {
  constructor(e) {
    J(this, "text");
    J(this, "at", 0);
    this.text = e;
  }
  space() {
    for (; this.at < this.text.length && this.text.charCodeAt(this.at) <= 32; ) this.at++;
  }
  value() {
    this.space();
    const e = this.text[this.at];
    if (e === "$" || e === "*")
      return this.at++, null;
    if (e === "#") {
      const o = /^#(\d+)/.exec(this.text.slice(this.at, this.at + 24));
      if (!o) throw new SyntaxError("bad reference");
      return this.at += o[0].length, new ln(Number(o[1]));
    }
    if (e === "'") return this.string();
    if (e === ".") {
      const o = this.text.indexOf(".", this.at + 1);
      if (o < 0) throw new SyntaxError("bad enumeration");
      const r = this.text.slice(this.at + 1, o);
      return this.at = o + 1, new so(r);
    }
    if (e === "(") return this.list();
    if (e === '"') {
      const o = this.text.indexOf('"', this.at + 1);
      return this.at = o + 1, null;
    }
    const t = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.text.slice(this.at, this.at + 200));
    if (t) {
      if (this.at += t[0].length, this.space(), this.text[this.at] !== "(") throw new SyntaxError("bad typed parameter");
      const o = this.list();
      return new ao(t[0].toUpperCase(), o.length === 1 ? o[0] : o);
    }
    const n = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(this.text.slice(this.at, this.at + 64));
    if (!n) throw new SyntaxError(`unexpected ${JSON.stringify(e)}`);
    return this.at += n[0].length, Number(n[0]);
  }
  string() {
    let e = "";
    for (this.at++; ; ) {
      const t = this.text.indexOf("'", this.at);
      if (t < 0) throw new SyntaxError("unterminated string");
      if (e += this.text.slice(this.at, t), this.at = t + 1, this.text[this.at] === "'") {
        e += "'", this.at++;
        continue;
      }
      return lo(e);
    }
  }
  list() {
    const e = [];
    if (this.at++, this.space(), this.text[this.at] === ")")
      return this.at++, e;
    for (; ; ) {
      e.push(this.value()), this.space();
      const t = this.text[this.at++];
      if (t === ")") return e;
      if (t !== ",") throw new SyntaxError("expected , or )");
    }
  }
};
function lo(e) {
  return e.includes("\\") ? e.replace(/\\X2\\((?:[0-9A-Fa-f]{4})*)\\X0\\/g, (t, n) => String.fromCharCode(...(n.match(/.{4}/g) ?? []).map((o) => parseInt(o, 16)))).replace(/\\X4\\((?:[0-9A-Fa-f]{8})*)\\X0\\/g, (t, n) => String.fromCodePoint(...(n.match(/.{8}/g) ?? []).map((o) => parseInt(o, 16)))).replace(/\\X\\([0-9A-Fa-f]{2})/g, (t, n) => String.fromCharCode(parseInt(n, 16))).replace(/\\S\\(.)/g, (t, n) => String.fromCharCode(n.charCodeAt(0) + 128)).replace(/\\\\/g, "\\") : e;
}
function fo(e) {
  const t = e.replace(/\/\*[\s\S]*?\*\//g, ""), n = t.search(/\bDATA\s*(\([^)]*\))?\s*;/);
  if (n < 0) throw new SyntaxError("no DATA section");
  const o = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
  let a = t.indexOf(";", n) + 1;
  const s = t.length;
  for (; a < s; ) {
    let i = a, f = !1;
    for (; i < s; i++) {
      const p = t.charCodeAt(i);
      if (p === 39) f = !f;
      else if (p === 59 && !f) break;
    }
    const l = t.slice(a, i).trim();
    if (a = i + 1, !l.startsWith("#")) {
      if (/^ENDSEC$/.test(l)) break;
      continue;
    }
    const u = /^#(\d+)\s*=\s*/.exec(l);
    if (!u) continue;
    const c = Number(u[1]), d = l.slice(u[0].length);
    if (d.startsWith("(")) {
      if (!/REPRESENTATION_RELATIONSHIP|REPRESENTATION\s*\(/.test(d)) continue;
      const p = new bt(d);
      p.at = 1;
      const g = /* @__PURE__ */ new Map();
      for (; p.space(), !(d[p.at] === ")" || p.at >= d.length); ) {
        const h = /^[A-Za-z_][A-Za-z0-9_]*/.exec(d.slice(p.at, p.at + 200));
        if (!h) break;
        p.at += h[0].length, p.space(), g.set(h[0].toUpperCase(), p.list());
      }
      r.set(c, g);
      continue;
    }
    const y = /^[A-Za-z_][A-Za-z0-9_]*/.exec(d)?.[0].toUpperCase();
    if (!y || !io.test(y)) continue;
    const w = new bt(d);
    w.at = y.length, w.space(), o.set(c, { type: y, args: w.list() });
  }
  return { simple: o, complex: r };
}
var U = (e) => e instanceof ln ? e.id : void 0, Ie = (e) => typeof e == "string" && e.trim() ? e : void 0;
function uo(e) {
  const { simple: t, complex: n } = fo(e), o = (M) => M === void 0 ? void 0 : t.get(M), r = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), s = (M, E) => {
    if (!Array.isArray(E)) return;
    const x = /* @__PURE__ */ new Set();
    for (const v of E) {
      const T = U(v);
      if (T === void 0) continue;
      x.add(T);
      const I = a.get(T);
      I ? I.push(M) : a.set(T, [M]);
    }
    r.set(M, x);
  };
  for (const [M, E] of t) E.type.endsWith("REPRESENTATION") && E.args.length >= 2 && s(M, E.args[1]);
  for (const [M, E] of n) for (const [x, v] of E) if (x.endsWith("REPRESENTATION") && v.length >= 2 && !r.has(M)) {
    const T = /* @__PURE__ */ new Set();
    for (const I of Array.isArray(v[1]) ? v[1] : []) {
      const D = U(I);
      D !== void 0 && T.add(D);
    }
    r.set(M, T);
  }
  const i = (M) => {
    const E = o(M);
    if (!E || !E.type.includes("PRODUCT_DEFINITION") || E.type.includes("SHAPE")) return null;
    const x = o(U(E.args[2])), v = o(U(x?.args[2]));
    return v ? Ie(v.args[1]) ?? Ie(v.args[0]) ?? null : null;
  }, f = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map();
  for (const [, M] of t) {
    if (M.type !== "SHAPE_DEFINITION_REPRESENTATION") continue;
    const E = o(U(M.args[0])), x = U(M.args[1]);
    if (!E || x === void 0) continue;
    const v = U(E.args[2]), T = o(v);
    if (!T || !T.type.includes("PRODUCT_DEFINITION") || T.type.includes("SHAPE")) continue;
    E.type === "PRODUCT_DEFINITION_SHAPE" && (f.set(v, x), u.set(x, v));
    const I = i(v);
    I && l.set(x, I);
  }
  for (let M = 0; M < 4; M++) {
    let E = !1;
    for (const [, x] of t) {
      if (!Mt.includes(x.type) || x.args.length < 4) continue;
      const v = U(x.args[2]), T = U(x.args[3]);
      if (!(v === void 0 || T === void 0))
        for (const [I, D] of [[v, T], [T, v]]) !l.has(I) && l.has(D) && (l.set(I, l.get(D)), E = !0);
    }
    if (!E) break;
  }
  const c = /* @__PURE__ */ new Map();
  for (const [, M] of t) {
    if (M.type !== "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION") continue;
    const E = U(M.args[0]), x = o(U(M.args[1])), v = o(U(x?.args[2]));
    E !== void 0 && v && (v.type.includes("ASSEMBLY_USAGE_OCCURRENCE") || v.type === "PRODUCT_DEFINITION_USAGE") && c.set(E, v);
  }
  const d = /* @__PURE__ */ new Map(), y = (M, E, x) => {
    const v = d.get(M);
    v ? v.push([E, x]) : d.set(M, [[E, x]]);
  };
  for (const [M, E] of n) {
    const x = E.get("REPRESENTATION_RELATIONSHIP"), v = E.get("REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION");
    if (!x || !v) continue;
    const T = U(x[2]), I = U(x[3]);
    if (T === void 0 || I === void 0) continue;
    const D = o(U(v[0]));
    if (D && D.type !== "ITEM_DEFINED_TRANSFORMATION") continue;
    let R = T, C = I;
    const O = c.get(M);
    if (O) {
      const B = U(O.args[3]), F = U(O.args[4]);
      (B !== void 0 && f.get(B) === T || F !== void 0 && f.get(F) === I) && ([R, C] = [I, T]);
    }
    const W = O ? { product: i(U(O.args[4])) ?? l.get(R) ?? null, instance: Ie(O.args[1]) ?? Ie(O.args[0]) ?? null } : { product: l.get(R) ?? null, instance: null };
    y(R, C, W);
  }
  const w = new Set(f.values());
  for (const [M, E] of t)
    if (Mt.includes(E.type) && E.args.length >= 4) {
      const x = U(E.args[2]), v = U(E.args[3]);
      if (x === void 0 || v === void 0) continue;
      w.has(x) && !w.has(v) ? y(v, x, null) : w.has(v) && !w.has(x) ? y(x, v, null) : y(v, x, null);
    } else if (E.type === "MAPPED_ITEM") {
      const x = o(U(E.args[1])), v = U(x?.args[1]);
      if (v === void 0) continue;
      for (const [T, I] of r) I.has(M) && y(v, T, { product: l.get(v) ?? null, instance: Ie(E.args[0]) ?? null });
    }
  const p = /* @__PURE__ */ new Map(), g = (M, E = 0) => {
    const x = p.get(M);
    if (x) return x;
    const v = d.get(M);
    if (E > 32 || !v) return [[{ product: l.get(M) ?? null, instance: null }]];
    const T = [];
    for (const [D, R] of v) for (const C of g(D, E + 1)) T.push([...C, R]);
    const I = T.length ? T : [[{ product: l.get(M) ?? null, instance: null }]];
    return p.set(M, I), I;
  }, h = /* @__PURE__ */ new Map(), m = (M, E = 0) => {
    if (!h.has(M)) {
      h.set(M, !1);
      let x = w.has(M);
      if (!x && E < 32) {
        for (const [v] of d.get(M) ?? []) if (m(v, E + 1)) {
          x = !0;
          break;
        }
      }
      h.set(M, x);
    }
    return h.get(M);
  }, b = [], P = [];
  let S = !1;
  for (const [M, E] of t) {
    if (!co.has(E.type)) continue;
    const x = a.get(M) ?? [], v = x.filter((O) => m(O)), T = v.length ? v : x;
    let I = "";
    for (const O of T) {
      const W = l.get(O);
      if (W !== void 0) {
        I = W;
        break;
      }
    }
    const D = Ie(E.args[0]) ?? (I || null), R = /* @__PURE__ */ new Set(), C = [];
    for (const O of T) for (const W of g(O)) {
      const B = W.filter((L) => L !== null), F = JSON.stringify(B);
      R.has(F) || (R.add(F), C.push(B));
    }
    C.length || C.push([{ product: I || null, instance: null }]);
    for (const O of C)
      O.length > 1 && (S = !0), b.push(O), P.push(D);
  }
  return { bodies: b, names: P, assembly: S };
}
var _ = (e) => {
  throw new A("invalid-input", e);
};
function X(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && _(`${e} must be finite numbers (got ${String(n)}).`);
}
function Y(e, ...t) {
  X(e, ...t);
  for (const n of t) n > 0 || _(`${e} must be positive (got ${n}).`);
}
function Ke(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return _(`${e} must be a 3-vector.`);
  X(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || _(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function ho(e) {
  const t = e.map((o) => [...o]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let o = 0; o < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); o++)
    for (const [a, s] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[a][s]) < 1e-300) continue;
      const i = (t[s][s] - t[a][a]) / (2 * t[a][s]), f = Math.sign(i || 1) / (Math.abs(i) + Math.sqrt(i * i + 1)), l = 1 / Math.sqrt(f * f + 1), u = f * l;
      for (let c = 0; c < 3; c++) {
        const d = t[c][a], y = t[c][s];
        t[c][a] = l * d - u * y, t[c][s] = u * d + l * y;
      }
      for (let c = 0; c < 3; c++) {
        const d = t[a][c], y = t[s][c];
        t[a][c] = l * d - u * y, t[s][c] = u * d + l * y;
      }
      for (let c = 0; c < 3; c++) {
        const d = n[c][a], y = n[c][s];
        n[c][a] = l * d - u * y, n[c][s] = u * d + l * y;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((o) => [n[0][o], n[1][o], n[2][o]]) };
}
function po(e, t) {
  const n = new Float64Array(e.length);
  for (let o = 0; o < t.length; o += 3) {
    const r = t[o] * 3, a = t[o + 1] * 3, s = t[o + 2] * 3, i = e[a] - e[r], f = e[a + 1] - e[r + 1], l = e[a + 2] - e[r + 2], u = e[s] - e[r], c = e[s + 1] - e[r + 1], d = e[s + 2] - e[r + 2], y = f * d - l * c, w = l * u - i * d, p = i * c - f * u;
    for (const g of [r, a, s])
      n[g] += y, n[g + 1] += w, n[g + 2] += p;
  }
  for (let o = 0; o < n.length; o += 3) {
    const r = Math.hypot(n[o], n[o + 1], n[o + 2]);
    r > 0 && (n[o] /= r, n[o + 1] /= r, n[o + 2] /= r);
  }
  return n;
}
var pe = (e) => ({ part: e, dispose: () => e.dispose() }), K = (e, t, n) => ({ sketch: e, outline: t, polygon: n, dispose: () => {
  e.dispose(), t?.dispose();
} }), z = (e) => e?.part ?? _("Not a solid of this kernel."), H = (e) => e?.sketch ?? _("Not a profile of this kernel."), Qe = (e) => e?.outline, Et = (e) => e?.polygon, oe = (e) => [e[0], e[1], e[2]];
function $(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof A) throw n;
    const o = n instanceof Error ? n.message : String(n);
    throw new A("kernel-failure", `SMLib ${e} failed: ${o}`, { cause: n });
  }
}
function mo(e) {
  return { sm: e, solid: (o, r) => {
    if (!(r instanceof e.Part)) throw new A("kernel-failure", `SMLib ${o} did not produce a solid (got ${r?.constructor?.name ?? typeof r}).`);
    return pe(r);
  }, face: (o, r) => {
    const { faceNormal: a, outermost: s } = Array.isArray(r) ? { faceNormal: r, outermost: !1 } : r, i = Ke("Face normal", a), f = (u) => {
      const c = u.center();
      return c.x * i[0] + c.y * i[1] + c.z * i[2];
    }, l = [...o.faces()].filter((u) => {
      if (!u.isPlanar) return !1;
      const c = u.normalAt();
      return c.x * i[0] + c.y * i[1] + c.z * i[2] > 1 - 1e-9;
    });
    return s && l.length ? l.sort((u, c) => f(c) - f(u))[0] : (l.length !== 1 && _(`Expected exactly one planar face with outward normal [${i.join(", ")}], found ${l.length}.`), l[0]);
  } };
}
var Le = 1e-7, St = 0.1, G = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], Z = (e, t) => [e[0] + t[0], e[1] + t[1], e[2] + t[2]], V = (e, t) => [e[0] * t, e[1] * t, e[2] * t], k = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], fn = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], Je = (e) => Math.sqrt(k(e, e)), te = (e, t) => Je(G(e, t)), mt = (e) => V(e, 1 / Je(e));
function go(e, t, n, o) {
  const r = G(e, t), a = Math.cos(o), s = Math.sin(o);
  return Z(t, Z(Z(V(r, a), V(fn(n, r), s)), V(n, k(n, r) * (1 - a))));
}
function un(e) {
  let t = 0, n = [0, 0, 0], o = [0, 0, 0];
  for (let r = 0; r < e.length; r++) {
    const a = e[r], s = e[(r + 1) % e.length], i = te(a, s);
    t += i, n = Z(n, V(Z(a, s), i / 2)), o = Z(o, [(a[1] - s[1]) * (a[2] + s[2]), (a[2] - s[2]) * (a[0] + s[0]), (a[0] - s[0]) * (a[1] + s[1])]);
  }
  return { pos: V(n, 1 / t), axis: mt(o) };
}
function Tt(e, t, n) {
  let o = Z(e, G(n.pos, t.pos)), r = t.axis, a = n.axis;
  const s = Math.acos(Math.max(-1, Math.min(1, k(r, a))));
  if (s <= 1e-4 || s >= Math.PI - 1e-4) return o;
  const i = G(n.pos, t.pos);
  k(i, r) < -1e-7 && (r = V(r, -1)), k(i, a) < 1e-7 && (a = V(a, -1));
  const f = fn(r, a), l = Z(V(a, k(i, r)), V(r, -k(i, a))), u = k(l, r), c = k(l, a), d = u * c > 0 && Math.abs(u) > 1e-4 && Math.abs(c) > 1e-4 ? -1 : 1, y = Math.acos(Math.max(-1, Math.min(1, k(r, a) / (Je(r) * Je(a)))));
  return o = go(o, n.pos, mt(f), y * d), o;
}
function yo(e, t, n, o) {
  const r = G(t, e), a = G(o, n), s = G(e, n), i = k(r, r), f = k(r, a), l = k(a, a), u = k(r, s), c = k(a, s), d = i * l - f * f;
  if (!(d <= 1e-24 * i * l))
    return { s: (f * c - l * u) / d, t: (i * c - f * u) / d };
}
function At(e, t, n) {
  const o = G(n, t);
  return k(G(e, t), o) / k(o, o);
}
function xo(e, t, n) {
  const o = [1 / 0, 1 / 0, 1 / 0], r = [-1 / 0, -1 / 0, -1 / 0];
  for (const { p: c } of e) for (let d = 0; d < 3; d++)
    o[d] = Math.min(o[d], c[d]), r[d] = Math.max(r[d], c[d]);
  const a = Math.hypot(r[0] - o[0], r[1] - o[1], r[2] - o[2]), s = Z(t, V(mt(G(n, t)), a)), i = [], f = (c) => c > 0 && c < 1;
  for (const c of e) for (const d of [t, s]) i.push({ vertex: c, p: c.p, d: te(d, c.p) });
  for (let c = 0; c < e.length; c++) {
    const d = e[c].p, y = e[(c + 1) % e.length].p;
    for (const w of [t, s]) {
      const p = At(w, d, y);
      if (f(p)) {
        const g = Z(d, V(G(y, d), p));
        i.push({ edge: c, t: p, p: g, d: te(w, g) });
      }
    }
  }
  for (const c of e) {
    const d = At(c.p, t, s);
    f(d) && i.push({ vertex: c, p: c.p, d: te(c.p, Z(t, V(G(s, t), d))) });
  }
  for (let c = 0; c < e.length; c++) {
    const d = e[c].p, y = e[(c + 1) % e.length].p, w = yo(t, s, d, y);
    if (!w || !f(w.s) || !f(w.t)) continue;
    const p = Z(d, V(G(y, d), w.t));
    i.push({ edge: c, t: w.t, p, d: te(p, Z(t, V(G(s, t), w.s))) });
  }
  if (!i.length) return;
  const l = Math.min(...i.map((c) => c.d));
  let u;
  for (const c of i) c.d <= l + Le && (!u || te(n, c.p) < te(n, u.p)) && (u = c);
  return u;
}
function It(e, t, n, o, r) {
  const a = xo(e, t, n);
  if (!a) return;
  if (a.vertex) return a.vertex;
  const s = a.edge, i = e[s], f = e[(s + 1) % e.length], l = a.t;
  let u;
  if (l < St ? u = i : 1 - l < St && (u = f), u && !o(u)) return u;
  const c = te(i.p, f.p);
  if (l * c < Le || (1 - l) * c < Le) return u;
  const d = { id: r(), p: a.p };
  return e.splice(s + 1, 0, d), d;
}
function wo(e, t = "authored") {
  const n = e.length;
  if (n < 2) return e.map((g) => [...g]);
  if (e.every((g) => g.length === e[0].length)) return t === "closest" ? vo(e) : e.map((g) => [...g]);
  let o = 0;
  const r = () => o++, a = e.map((g) => g.map((h) => ({ id: r(), p: h }))), s = e.map(un), i = e.reduce((g, h) => g + h.length, 0), f = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set();
  for (let g = n - 1; g > 0; g--) {
    const h = [...a[g]];
    if (h.length > i) return;
    for (const m of h) {
      const b = Tt(m.p, s[g], s[g - 1]);
      if (te(b, s[g - 1].pos) <= Le) continue;
      const P = It(a[g - 1], s[g - 1].pos, b, (S) => l.has(S.id), r);
      if (!P) return;
      f.set(m.id, P.id), l.add(P.id);
    }
  }
  const u = /* @__PURE__ */ new Map();
  for (const [g, h] of f) u.has(h) || u.set(h, g);
  const c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  for (const g of a[0]) {
    const h = [g.id];
    d.set(g.id, g.id);
    let m = g.id;
    for (; h.length < n && u.has(m) && (m = u.get(m), m !== g.id); )
      h.push(m), d.set(m, g.id);
    c.set(g.id, h);
  }
  const y = a[0].length;
  for (let g = 0; g < n - 1; g++) {
    const h = [...a[g]];
    if (h.length > i || h.length > y) return;
    for (const m of h) {
      const b = d.get(m.id);
      if (b === void 0) return;
      const P = c.get(b), S = new Set(a[g + 1].map((x) => x.id));
      if (P.some((x) => S.has(x))) continue;
      const M = Tt(m.p, s[g], s[g + 1]);
      if (te(M, s[g + 1].pos) <= Le) continue;
      const E = It(a[g + 1], s[g + 1].pos, M, (x) => d.has(x.id), r);
      if (!E) return;
      P.push(E.id), d.set(E.id, b);
    }
  }
  const w = a[0], p = [w.map((g) => g.p)];
  for (let g = 1; g < n; g++) {
    const h = a[g];
    if (h.length !== w.length) return;
    const m = c.get(w[0].id)?.[g], b = c.get(w[1].id)?.[g], P = h.findIndex((x) => x.id === m), S = h.findIndex((x) => x.id === b);
    if (P < 0 || S < 0) return;
    const M = h.length, E = (P + 1) % M === S ? 1 : (S + 1) % M === P ? -1 : 0;
    if (!E) return;
    p.push(Array.from({ length: M }, (x, v) => h[((P + E * v) % M + M) % M].p));
  }
  return p;
}
function vo(e) {
  return hn(e).map((t, n) => dn(e[n], t));
}
var dn = (e, { start: t, forward: n }) => Array.from({ length: e.length }, (o, r) => e[n ? (t + r) % e.length : ((t - r) % e.length + e.length) % e.length]);
function hn(e, t = e.map(un)) {
  const n = t[0], o = [{ start: 0, forward: !0 }];
  let r = e[0], a = n.pos;
  for (let s = 1; s < e.length; s++) {
    const i = e[s], f = i.length;
    let l = t[s].pos;
    const u = G(l, a);
    l = G(l, V(n.axis, k(u, n.axis)));
    const c = G(a, l);
    let d = 1 / 0, y = 0, w = !0;
    const p = (h) => {
      let m = 0;
      for (let b = 0; b < f; b++) m += te(r[b], Z(i[h(b)], c));
      return m;
    };
    for (let h = 0; h < f; h++) {
      const m = p((P) => (h + P) % f);
      m < d && (d = m, y = h, w = !0);
      const b = p((P) => ((h - P) % f + f) % f);
      b < d && (d = b, y = h, w = !1);
    }
    const g = { start: y, forward: w };
    o.push(g), r = dn(i, g), a = l;
  }
  return o;
}
var gt = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], it = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], se = (e) => [e.x, e.y, e.z], Be = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return t > 1e-15 ? [e[0] / t, e[1] / t, e[2] / t] : null;
}, fe = (e, ...t) => {
  const n = [e[0], e[1], e[2]];
  for (const [o, r] of t)
    n[0] += o * r[0], n[1] += o * r[1], n[2] += o * r[2];
  return n;
};
function Mo(e) {
  const t = e.bbox(), n = Math.max(1, t.diagonal), o = 1e-7 * n, r = { min: [1 / 0, 1 / 0, 1 / 0], max: [-1 / 0, -1 / 0, -1 / 0], tol: o };
  for (const a of e.vertices()) re(r, [a.x, a.y, a.z]);
  for (const a of e.edges({ seams: !0 })) bo(a, r);
  for (const a of e.faces()) Ao(a, r);
  return Number.isFinite(r.min[0]) ? { min: r.min, max: r.max } : { min: [t.min.x, t.min.y, t.min.z], max: [t.max.x, t.max.y, t.max.z] };
}
function re(e, t) {
  for (let n = 0; n < 3; n++)
    t[n] < e.min[n] && (e.min[n] = t[n]), t[n] > e.max[n] && (e.max[n] = t[n]);
}
var He = (e, t) => t.some((n, o) => n < e.min[o] - e.tol || n > e.max[o] + e.tol), pn = (e, t) => t.some((n) => He(e, [n.x, n.y, n.z]));
function bo(e, t) {
  re(t, se(e.start)), re(t, se(e.end));
  const n = e.geomType;
  if (n === "line" || n === "circle" && Eo(e, t)) return;
  let o = null;
  try {
    if (o = e.nurbs(), !pn(t, o.points)) return;
  } catch {
  }
  Pt(n === "bspline" && o ? To(o) : { t0: 0, t1: 1, spans: 1, at: (r) => se(e.pointAt(r)) }, t);
}
function Eo(e, t) {
  const n = se(e.arcCenter), o = Be(se(e.normal)), r = e.radius;
  if (!o) return !1;
  for (const a of gt) {
    const s = Be(fe(a, [-it(a, o), o]));
    if (s)
      for (const i of [1, -1]) {
        const f = fe(n, [i * r, s]);
        He(t, f) && (e.isClosed || e.distanceTo(f) <= t.tol) && re(t, f);
      }
  }
  return !0;
}
function Pt(e, t) {
  const n = Math.min(1024, Math.max(64, 8 * e.spans)), o = (e.t1 - e.t0) / n, r = [], a = (s) => s === n ? e.t1 : e.t0 + s * o;
  for (let s = 0; s <= n; s++) {
    const i = e.at(a(s));
    r.push(i), re(t, i);
  }
  for (let s = 0; s < 3; s++) for (const i of [1, -1]) {
    let f = 0;
    for (let u = 1; u <= n; u++) i * r[u][s] > i * r[f][s] && (f = u);
    So((u) => {
      const c = e.at(u);
      return re(t, c), i * c[s];
    }, a(Math.max(0, f - 1)), a(Math.min(n, f + 1)));
  }
}
function So(e, t, n) {
  const o = (Math.sqrt(5) - 1) / 2, r = 1e-12 * Math.max(1, Math.abs(t), Math.abs(n));
  let a = n - o * (n - t), s = t + o * (n - t), i = e(a), f = e(s);
  for (let l = 0; l < 60 && n - t > r; l++)
    i < f ? (t = a, a = s, i = f, s = t + o * (n - t), f = e(s)) : (n = s, s = a, f = i, a = n - o * (n - t), i = e(a));
}
function To(e) {
  const t = e.degree, n = e.knots, o = e.points.length - 1, r = e.weights, a = e.points.map((c, d) => {
    const y = r ? r[d] : 1;
    return [c.x * y, c.y * y, c.z * y, y];
  }), s = n[t], i = n[o + 1];
  let f = 0;
  for (let c = t; c <= o; c++) n[c + 1] > n[c] && f++;
  const l = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]), u = (c) => {
    c = Math.min(i, Math.max(s, c));
    let d = t;
    for (; d < o && n[d + 1] <= c; ) d++;
    for (let w = 0; w <= t; w++) for (let p = 0; p < 4; p++) l[w][p] = a[w + d - t][p];
    for (let w = 1; w <= t; w++) for (let p = t; p >= w; p--) {
      const g = n[p + d - t], h = n[p + 1 + d - w] - g, m = h > 0 ? (c - g) / h : 0;
      for (let b = 0; b < 4; b++) l[p][b] = (1 - m) * l[p - 1][b] + m * l[p][b];
    }
    const y = l[t];
    return [y[0] / y[3], y[1] / y[3], y[2] / y[3]];
  };
  return { t0: s, t1: i, spans: Math.max(1, f), at: u };
}
function Ao(e, t) {
  const n = e.geomType;
  if (n === "plane" || n === "cylinder" || n === "cone" || n === "extrusion") return;
  const o = (r) => He(t, r) && e.distanceTo(r) <= t.tol;
  if (n === "sphere") return Io(e, t, o);
  if (!(n === "torus" && Po(e, t, o)) && !e.isPlanar) {
    try {
      const r = e.nurbs();
      if (r.degrees[0] === 1 || r.degrees[1] === 1 || !pn(t, r.points.flat())) return;
    } catch {
    }
    $o(e, t);
  }
}
function Io(e, t, n) {
  const o = se(e.axis.origin), r = e.radius;
  for (const a of gt) for (const s of [1, -1]) {
    const i = fe(o, [s * r, a]);
    n(i) && re(t, i);
  }
}
function Po(e, t, n) {
  const o = e.axis, r = se(o.origin), a = Be(se(o.direction)), s = e.majorRadius, i = e.radius;
  if (!a) return !1;
  for (const f of gt) {
    const l = Be(fe(f, [-it(f, a), a]));
    if (l && Math.abs(it(f, a)) < 1 - 1e-12)
      for (const u of [1, -1]) for (const c of [1, -1]) {
        const d = fe(r, [u * s, l], [c * i, f]);
        n(d) && re(t, d);
      }
    else No(r, a, s, i, t, n);
  }
  return !0;
}
function No(e, t, n, o, r, a) {
  const s = Be(Math.abs(t[0]) < 0.9 ? fe([1, 0, 0], [-t[0], t]) : fe([0, 1, 0], [-t[1], t])), i = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
  for (const f of [1, -1])
    if (He(r, fe(e, [f * o, t])))
      for (let l = 0; l < 72; l++) {
        const u = 2 * Math.PI * l / 72, c = fe(e, [n * Math.cos(u), s], [n * Math.sin(u), i], [f * o, t]);
        if (a(c)) {
          re(r, c);
          break;
        }
      }
}
function $o(e, t) {
  const o = [];
  for (let r = 0; r <= 24; r++) for (let a = 0; a <= 24; a++) o.push({ u: r / 24, v: a / 24, p: se(e.positionAt(r / 24, a / 24)) });
  for (let r = 0; r < 3; r++) for (const a of [1, -1]) {
    const i = o.filter((l) => He(t, l.p)).sort((l, u) => a * u.p[r] - a * l.p[r]).find((l) => e.distanceTo(l.p) <= t.tol);
    if (!i) continue;
    re(t, i.p);
    const f = _o(e, i, r, a, 1 / 24);
    e.distanceTo(f) <= t.tol && re(t, f);
  }
}
function _o(e, t, n, o, r) {
  let { u: a, v: s } = t, i = o * t.p[n], f = t.p;
  for (let l = r; l > 1e-9; l /= 2)
    for (let u = !0, c = 0; u && c < 64; c++) {
      u = !1;
      for (const [d, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const w = Math.min(1, Math.max(0, a + d * l)), p = Math.min(1, Math.max(0, s + y * l)), g = se(e.positionAt(w, p));
        o * g[n] > i && (a = w, s = p, i = o * g[n], f = g, u = !0);
      }
    }
  return f;
}
var Nt = 1024, he = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], Q = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], qe = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function mn(e) {
  const n = 1e-9 * Math.max(1, ...e.flatMap((a) => a.map(Math.abs))), o = Oo(e, n);
  if (o.length > Nt) throw new A("unsupported", `Hull of ${o.length} distinct vertices exceeds the exact hull budget (${Nt}).`);
  if (o.length < 4) throw new A("invalid-input", "A hull needs at least four non-coplanar points.");
  const r = Ro(o, n);
  return Co(o, r, Math.min(n, 1e-9));
}
function Oo(e, t) {
  const n = Math.max(t * 4, 1e-300), o = /* @__PURE__ */ new Map(), r = [];
  for (const a of e) {
    const s = a.map((l) => Math.floor(l / n));
    let i = !1;
    for (let l = -1; l <= 1 && !i; l++) for (let u = -1; u <= 1 && !i; u++) for (let c = -1; c <= 1 && !i; c++)
      for (const d of o.get(`${s[0] + l},${s[1] + u},${s[2] + c}`) ?? []) if (Math.hypot(...he(a, d)) <= t) {
        i = !0;
        break;
      }
    if (i) continue;
    const f = s.join(",");
    (o.get(f) ?? o.set(f, []).get(f)).push(a), r.push(a);
  }
  return r;
}
function $t(e, t, n, o) {
  const r = qe(he(e[n], e[t]), he(e[o], e[t])), a = Math.hypot(...r), s = a > 0 ? [r[0] / a, r[1] / a, r[2] / a] : [0, 0, 0], i = [(e[t][0] + e[n][0] + e[o][0]) / 3, (e[t][1] + e[n][1] + e[o][1]) / 3, (e[t][2] + e[n][2] + e[o][2]) / 3];
  return { v: [t, n, o], n: s, d: Q(s, i), area: a / 2, alive: !0 };
}
function Ro(e, t) {
  const n = e.length;
  let o = 0;
  for (let h = 1; h < n; h++) e[h][0] < e[o][0] && (o = h);
  let r = -1, a = -1;
  for (let h = 0; h < n; h++) {
    const m = Math.hypot(...he(e[h], e[o]));
    m > a && (a = m, r = h);
  }
  let s = -1;
  a = -1;
  const i = he(e[r], e[o]);
  for (let h = 0; h < n; h++) {
    const m = Math.hypot(...qe(i, he(e[h], e[o])));
    m > a && (a = m, s = h);
  }
  if (!(a > t * Math.hypot(...i))) throw new A("invalid-input", "The hull is flat (all points collinear).");
  const f = $t(e, o, r, s);
  let l = -1;
  a = -1;
  for (let h = 0; h < n; h++) {
    const m = Math.abs(Q(f.n, e[h]) - f.d);
    m > a && (a = m, l = h);
  }
  if (!(a > t)) throw new A("invalid-input", "The hull is flat (all points coplanar).");
  const u = [], c = /* @__PURE__ */ new Map(), d = (h, m, b) => {
    const P = $t(e, h, m, b), S = u.length;
    return u.push(P), c.set(h * n + m, S), c.set(m * n + b, S), c.set(b * n + h, S), S;
  }, y = (h) => {
    const m = u[h];
    m.alive = !1;
    const [b, P, S] = m.v;
    for (const M of [b * n + P, P * n + S, S * n + b]) c.get(M) === h && c.delete(M);
  };
  Q(f.n, e[l]) - f.d > 0 ? (d(o, s, r), d(o, r, l), d(r, s, l), d(s, o, l)) : (d(o, r, s), d(o, l, r), d(r, l, s), d(s, l, o));
  const w = /* @__PURE__ */ new Set([o, r, s, l]), p = e.reduce((h, m) => [h[0] + m[0] / n, h[1] + m[1] / n, h[2] + m[2] / n], [0, 0, 0]), g = [...e.keys()].filter((h) => !w.has(h)).sort((h, m) => Math.hypot(...he(e[m], p)) - Math.hypot(...he(e[h], p)));
  for (const h of g) {
    const m = e[h];
    let b = -1, P = t;
    for (let x = 0; x < u.length; x++) {
      const v = u[x];
      if (!v.alive) continue;
      const T = Q(v.n, m) - v.d;
      T > P && (P = T, b = x);
    }
    if (b < 0) continue;
    const S = /* @__PURE__ */ new Set([b]), M = [b];
    for (; M.length; ) {
      const x = M.pop(), [v, T, I] = u[x].v;
      for (const [D, R] of [[v, T], [T, I], [I, v]]) {
        const C = c.get(R * n + D);
        C === void 0 || S.has(C) || Q(u[C].n, m) - u[C].d > t && (S.add(C), M.push(C));
      }
    }
    const E = [];
    for (const x of S) {
      const [v, T, I] = u[x].v;
      for (const [D, R] of [[v, T], [T, I], [I, v]]) {
        const C = c.get(R * n + D);
        (C === void 0 || !S.has(C)) && E.push([D, R]);
      }
    }
    for (const x of S) y(x);
    for (const [x, v] of E) d(x, v, h);
  }
  return u.filter((h) => h.alive);
}
function Co(e, t, n) {
  const o = e.length, r = /* @__PURE__ */ new Map();
  t.forEach((d, y) => {
    const [w, p, g] = d.v;
    r.set(w * o + p, y), r.set(p * o + g, y), r.set(g * o + w, y);
  });
  const a = new Array(t.length).fill(-1), s = [], i = [...t.keys()].sort((d, y) => t[y].area - t[d].area);
  for (const d of i) {
    if (a[d] >= 0) continue;
    const { n: y, d: w } = t[d], p = s.length, g = [d];
    a[d] = p;
    for (let m = 0; m < g.length; m++) {
      const [b, P, S] = t[g[m]].v;
      for (const [M, E] of [[b, P], [P, S], [S, b]]) {
        const x = r.get(E * o + M);
        if (x === void 0 || a[x] >= 0) continue;
        const v = t[x];
        Q(v.n, y) < 1 - 1e-6 || v.v.some((T) => Math.abs(Q(y, e[T]) - w) > n) || (a[x] = p, g.push(x));
      }
    }
    const h = g.length > 1 ? Do(g.map((m) => t[m].v), o) : t[d].v.slice();
    if (h) s.push(h);
    else {
      a[d] = p, s.push(t[d].v.slice());
      for (const m of g.slice(1))
        a[m] = s.length, s.push(t[m].v.slice());
    }
  }
  const f = /* @__PURE__ */ new Map();
  for (const d of s) for (const y of d) f.set(y, (f.get(y) ?? 0) + 1);
  const l = s.map((d) => {
    const y = d.filter((w) => (f.get(w) ?? 0) > 2);
    return y.length >= 3 ? y : d;
  }), u = [...new Set(l.flat())].sort((d, y) => d - y), c = new Map(u.map((d, y) => [d, y]));
  return { points: u.map((d) => e[d]), faces: l.map((d) => d.map((y) => c.get(y))) };
}
function Do(e, t) {
  const n = /* @__PURE__ */ new Set();
  for (const [s, i, f] of e) for (const [l, u] of [[s, i], [i, f], [f, s]]) n.add(l * t + u);
  const o = /* @__PURE__ */ new Map();
  for (const s of n) {
    const i = Math.floor(s / t), f = s % t;
    if (!n.has(f * t + i)) {
      if (o.has(i)) return null;
      o.set(i, f);
    }
  }
  const r = o.keys().next().value, a = [r];
  for (let s = o.get(r); s !== r; s = o.get(s)) {
    if (s === void 0 || a.length > o.size) return null;
    a.push(s);
  }
  return a.length === o.size ? a : null;
}
function zo(e, t, n = 1e-9) {
  const o = [];
  for (const r of t) {
    const a = Fo(e, r);
    if (r.length === 3 || !a) {
      o.push([...r]);
      continue;
    }
    const s = r.reduce((i, f) => i + Q(a, e[f]), 0) / r.length;
    if (r.every((i) => Math.abs(Q(a, e[i]) - s) <= n)) {
      o.push([...r]);
      continue;
    }
    o.push(...Lo(e, r, a));
  }
  return o;
}
function Fo(e, t) {
  const n = [0, 0, 0];
  for (let r = 0; r < t.length; r++) {
    const a = e[t[r]], s = e[t[(r + 1) % t.length]];
    n[0] += (a[1] - s[1]) * (a[2] + s[2]), n[1] += (a[2] - s[2]) * (a[0] + s[0]), n[2] += (a[0] - s[0]) * (a[1] + s[1]);
  }
  const o = Math.hypot(...n);
  return o > 0 ? [n[0] / o, n[1] / o, n[2] / o] : null;
}
function Lo(e, t, n) {
  const o = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], r = qe(n, o), a = Math.hypot(...r), s = [r[0] / a, r[1] / a, r[2] / a], i = qe(n, s), f = new Map(t.map((w) => [w, [Q(e[w], s), Q(e[w], i)]])), l = (w, p, g) => {
    const [h, m] = f.get(w), [b, P] = f.get(p), [S, M] = f.get(g);
    return (b - h) * (M - m) - (P - m) * (S - h);
  }, u = (w, p, g, h) => l(p, g, w) >= 0 && l(g, h, w) >= 0 && l(h, p, w) >= 0, c = [...t], d = [];
  let y = 0;
  for (; c.length > 3 && y++ < 10 * t.length * t.length; ) {
    let w = !1;
    for (let p = 0; p < c.length; p++) {
      const g = c[(p + c.length - 1) % c.length], h = c[p], m = c[(p + 1) % c.length];
      if (!(l(g, h, m) <= 0) && !c.some((b) => b !== g && b !== h && b !== m && u(b, g, h, m))) {
        d.push([g, h, m]), c.splice(p, 1), w = !0;
        break;
      }
    }
    if (!w) break;
  }
  if (c.length > 3)
    for (let w = 1; w + 1 < c.length; w++) d.push([c[0], c[w], c[w + 1]]);
  else d.push(c);
  return d;
}
function Bo(e, t) {
  const n = Math.max(1, ...e.flatMap((r) => r.map(Math.abs))), o = 1e-9 * n;
  for (const r of t) {
    const a = [0, 0, 0];
    for (let l = 0; l < r.length; l++) {
      const u = e[r[l]], c = e[r[(l + 1) % r.length]];
      a[0] += (u[1] - c[1]) * (u[2] + c[2]), a[1] += (u[2] - c[2]) * (u[0] + c[0]), a[2] += (u[0] - c[0]) * (u[1] + c[1]);
    }
    const s = Math.hypot(...a);
    if (!(s > 0)) return !1;
    const i = [a[0] / s, a[1] / s, a[2] / s], f = Q(i, e[r[0]]);
    if (r.some((l) => Math.abs(Q(i, e[l]) - f) > o) || e.some((l) => Q(i, l) - f > o)) return !1;
  }
  return !0;
}
function Uo(e) {
  const t = e.length;
  if (t < 4) return null;
  let n = 1;
  for (const r of e) n = Math.max(n, Math.abs(r[0]), Math.abs(r[1]));
  const o = Ho(e, 1e-9 * n);
  for (let r = 0; r < t; r++) {
    for (let a = r + 2; a < t; a++) {
      const s = r === 0 && a === t - 1 ? null : o.edgesCross(r, a);
      if (s) return { edges: [r, a], at: s };
    }
    for (let a = 0; a < t; a++) if (o.passesThrough(r, a)) return { edges: [r, (a - 1 + t) % t], at: [e[a][0], e[a][1]] };
  }
  return null;
}
function Ho(e, t) {
  const n = e.length, o = (i) => e[(i % n + n) % n], r = (i, f, l) => {
    const u = Math.hypot(f[0] - i[0], f[1] - i[1]), c = u <= t ? 0 : ((f[0] - i[0]) * (l[1] - i[1]) - (f[1] - i[1]) * (l[0] - i[0])) / u;
    return Math.abs(c) <= t ? 0 : Math.sign(c);
  }, a = (i, f, l) => {
    const u = Math.hypot(f[0] - i[0], f[1] - i[1]), c = ((l[0] - i[0]) * (f[0] - i[0]) + (l[1] - i[1]) * (f[1] - i[1])) / u;
    return c > t && c < u - t;
  }, s = (i, f, l, u) => {
    for (let c = 1; c < n; c++) {
      const d = r(i, f, o(l + u * c));
      if (d) return d;
    }
    return 0;
  };
  return {
    /** Where edges i and j cross in their interiors, or null. */
    edgesCross(i, f) {
      const l = o(i), u = o(i + 1), c = o(f), d = o(f + 1);
      if (r(l, u, c) * r(l, u, d) >= 0 || r(c, d, l) * r(c, d, u) >= 0) return null;
      const y = (u[0] - l[0]) * (d[1] - c[1]) - (u[1] - l[1]) * (d[0] - c[0]), w = ((c[0] - l[0]) * (d[1] - c[1]) - (c[1] - l[1]) * (d[0] - c[0])) / y;
      return [l[0] + w * (u[0] - l[0]), l[1] + w * (u[1] - l[1])];
    },
    /** Whether vertex k lies inside edge i and the outline passes there from one side to the other. */
    passesThrough(i, f) {
      if (f === i || f === (i + 1) % n) return !1;
      const l = o(i), u = o(i + 1), c = o(f);
      return r(l, u, c) !== 0 || !a(l, u, c) ? !1 : s(l, u, f, -1) * s(l, u, f, 1) < 0;
    }
  };
}
var q = (e) => [e[0], e[1], 0];
function Xo(e, t, n) {
  let o = t;
  const r = [], a = (s, i) => ((!Array.isArray(i) || i.length !== 2) && _(`${s} must be a 2D point.`), X(s, i[0], i[1]), i);
  for (const s of n) {
    const i = s.kind === "spline" ? a("Spline point", s.through.at(-1) ?? _("A spline needs at least one point.")) : a("Path point", s.to);
    s.kind === "line" ? r.push(e.Line(q(o), q(i))) : s.kind === "arc" ? r.push(e.ThreePointArc(q(o), q(a("Arc point", s.via)), q(i))) : s.kind === "radiusArc" ? (X("Arc radius", s.radius), r.push(e.RadiusArc(q(o), q(i), s.radius))) : s.kind === "sagittaArc" ? (X("Arc sagitta", s.sagitta), r.push(e.SagittaArc(q(o), q(i), s.sagitta))) : s.kind === "spline" ? r.push(e.Spline(q(o), ...s.through.map((f) => q(a("Spline point", f))))) : _(`Unknown path segment kind '${s.kind}'.`), o = i;
  }
  return Math.hypot(o[0] - t[0], o[1] - t[1]) > 1e-9 && r.push(e.Line(q(o), q(t))), r;
}
function _t(e, t) {
  const n = Uo(t);
  if (!n) return;
  const [o, r] = n.at.map((a) => +a.toPrecision(6));
  _(`The ${e} crosses itself at (${o}, ${r}), so it bounds no region. Reorder its points so no edges cross, or give each region its own contour.`);
}
function Wo(e) {
  const t = [];
  for (const n of e) {
    const o = n.pointAt(0), r = n.pointAt(1), s = Math.abs(n.length - Math.hypot(r.x - o.x, r.y - o.y)) <= 1e-9 * Math.max(1, n.length) ? 1 : 32;
    for (let i = 0; i < s; i++) {
      const f = i ? n.pointAt(i / s) : o;
      t.push([f.x, f.y]);
    }
  }
  return t;
}
function ko(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && _("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && _("Each polygon contour needs at least three points.");
        for (const o of n) X("Polygon points", o[0], o[1]);
        _t("polygon contour", n);
      }
      return $("Polygon", () => {
        const n = t.map((r) => e.Polygon(r.map((a) => [a[0], a[1]]))).sort((r, a) => a.area - r.area), o = t.length === 1 ? t[0].filter((r, a, s) => a < s.length - 1 || r[0] !== s[0][0] || r[1] !== s[0][1]) : void 0;
        return K(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)), void 0, o?.map((r) => [r[0], r[1], 0]));
      });
    },
    circle(t) {
      return Y("Circle radius", t), $("Circle", () => K(e.Circle(t)));
    },
    rectangle(t, n, o) {
      return Y("Rectangle size", t, n), $("Rectangle", () => K(o ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, o) {
      return Y("Rounded rectangle size and radius", t, n, o), o >= Math.min(t, n) / 2 && _("The corner radius must be below half the short side."), $("RoundedRectangle", () => K(e.RoundedRectangle(t, n, o)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && _("A path profile needs at least one segment."), X("Path start", ...Array.isArray(t) ? t : [NaN]), $("path", () => {
        const o = Xo(e, t, n), r = Wo(o);
        _t("path outline", r);
        const a = r.length === o.length ? r.map(([s, i]) => [s, i, 0]) : void 0;
        return K(e.makeFace(new e.Wire(o)), new e.Wire(o), a);
      });
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && _("Text must be a non-empty string."), Y("Text size", n);
      try {
        return K(e.Text(t, n));
      } catch (o) {
        if (o instanceof e.FontError) throw new A("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${o.message}`, { cause: o });
        return $("Text", () => {
          throw o;
        });
      }
    },
    union: (t, ...n) => $("fuse (2D)", () => K(n.length ? e.fuse(H(t), ...n.map(H)) : H(t))),
    subtract: (t, ...n) => $("cut (2D)", () => K(n.length ? e.cut(H(t), ...n.map(H)) : H(t))),
    intersect: (t, ...n) => $("intersect (2D)", () => K(n.length ? e.intersect(H(t), ...n.map(H)) : H(t))),
    hull: (...t) => (t.length || _("A hull needs at least one profile."), $("Hull (2D)", () => K(e.Hull(...t.map(H))))),
    translate: (t, [n, o]) => (X("Profile offset", n, o), $("translate (2D)", () => K(H(t).translate([n, o, 0])))),
    rotate: (t, n) => (X("Profile angle", n), $("rotate (2D)", () => K(H(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, o]) => (X("Profile scale", n, o), (n === 0 || o === 0) && _("A zero profile scale flattens the profile."), $("scale (2D)", () => K(H(t).scale([n, o, 1])))),
    offset: (t, n, o) => (X("Profile offset distance", n), $("offset (2D)", () => K(e.offset(H(t), n, { corners: o ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = H(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => $("area (2D)", () => H(t).area)
  };
}
var le = (e) => [e.x, e.y, e.z], Ot = (e) => e._identity(), Rt = 48;
function jo(e) {
  const t = e.degree, n = e.knots, o = e.points.length - 1, r = e.weights, a = e.points.map((l, u) => {
    const c = r ? r[u] : 1;
    return [l.x * c, l.y * c, l.z * c, c];
  }), s = n[t], i = n[o + 1], f = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]);
  return (l) => {
    const u = Math.min(i, Math.max(s, s + l * (i - s)));
    let c = t;
    for (; c < o && n[c + 1] <= u; ) c++;
    for (let y = 0; y <= t; y++) for (let w = 0; w < 4; w++) f[y][w] = a[y + c - t][w];
    for (let y = 1; y <= t; y++) for (let w = t; w >= y; w--) {
      const p = n[w + c - t], g = n[w + 1 + c - y] - p, h = g > 0 ? (u - p) / g : 0;
      for (let m = 0; m < 4; m++) f[w][m] = (1 - h) * f[w - 1][m] + h * f[w][m];
    }
    const d = f[t];
    return [d[0] / d[3], d[1] / d[3], d[2] / d[3]];
  };
}
function Go(e, t) {
  const n = le(e.start), o = le(e.end);
  if (t === "line") return [n, o];
  let r = (i) => le(e.pointAt(i)), a = 16;
  if (t === "circle") {
    const i = e.length / (2 * Math.PI * Math.max(e.radius, 1e-12));
    a = Math.max(4, Math.min(Rt, Math.ceil(48 * i)));
  } else if (t === "bspline")
    try {
      const i = e.nurbs(), f = jo(i), l = f(0), u = (c, d) => Math.hypot(c[0] - d[0], c[1] - d[1], c[2] - d[2]);
      r = u(l, n) <= u(l, o) ? f : (c) => f(1 - c), a = Math.max(8, Math.min(Rt, 4 * (i.points.length - i.degree)));
    } catch {
    }
  const s = [n];
  for (let i = 1; i < a; i++) s.push(r(i / a));
  return s.push(o), s;
}
function Vo(e) {
  const t = [...e.faces()], n = /* @__PURE__ */ new Map(), o = t.map((a, s) => {
    n.set(Ot(a), s);
    const i = a.geomType, f = a.interiorPoint(), l = { index: s, name: a.name, surface: i, area: a.area, point: le(f), normal: le(a.normalAt(f)) };
    if (i === "cylinder" || i === "cone" || i === "sphere" || i === "torus") {
      const u = a.axis;
      return { ...l, radius: a.radius, axis: { origin: le(u.origin), direction: le(u.direction) } };
    }
    return l;
  }), r = [...e.edges()].map((a, s) => {
    const i = a.geomType, f = Go(a, i), l = [...a.faces()].map((c) => n.get(Ot(c))).filter((c) => c !== void 0), u = { index: s, curve: i, faces: l, length: a.length, closed: a.isClosed, points: f };
    return i === "circle" ? { ...u, radius: a.radius, center: le(a.arcCenter), axis: le(a.normal) } : u;
  });
  return { faces: o, edges: r };
}
function Ko(e, t) {
  const n = [...e.faces()];
  if (t.length !== n.length) throw new RangeError(`nameFaces: ${t.length} names for ${n.length} faces.`);
  let o = e;
  return t.forEach((r, a) => {
    r !== null && (o = o.named(r === "" ? null : r, { faces: [n[a]] }));
  }), o;
}
function Yo(e, t) {
  const n = [...e.edges()];
  if (!t.length) throw new RangeError("Select at least one edge.");
  if (new Set(t).size !== t.length) throw new RangeError("Each edge may be selected once.");
  return t.map((o) => {
    if (!Number.isInteger(o) || o < 0 || o >= n.length) throw new RangeError(`Edge index ${o} is not an edge of this solid (it has ${n.length}).`);
    return n[o];
  });
}
var Zo = 0.01, Qo = 10, Jo = "MIT AND Apache-2.0", Me = 65536, ct, Pe, qo = () => new URL("" + new URL("smlibwasm-Bw7fxXQ_.wasm", import.meta.url).href, import.meta.url);
async function er(e) {
  if (e.wasmModule) return e.wasmModule;
  if (e.wasmBinary) return e.wasmBinary;
  const t = qo(), n = e.locateFile ? e.locateFile("smlibwasm.wasm", new URL(".", t).href) : t.href, o = !!globalThis.process?.versions?.node;
  if (n.startsWith("file:") || o && !/^[a-z]+:/i.test(n)) {
    const { readFile: a } = await import("../geometry.worker-RK0f-gvM.js").then(function(i) {
      return i._;
    }), { fileURLToPath: s } = await import("../geometry.worker-RK0f-gvM.js").then(function(i) {
      return i._;
    });
    return a(n.startsWith("file:") ? s(n) : n);
  }
  const r = await fetch(n);
  if (!r.ok) throw new Error(`fetching ${n}: ${r.status} ${r.statusText}`);
  return new Uint8Array(await r.arrayBuffer());
}
var ie = { module: "a", name: "D" };
function tr(e, t, n) {
  const o = Math.floor(t / Me);
  return (r, a) => {
    let s;
    const i = r[ie.module], f = i?.[ie.name];
    return i && typeof f == "function" && (i[ie.name] = (l) => {
      s = l >>> 0;
      try {
        return f(l);
      } finally {
        s = void 0;
      }
    }), (async () => {
      if (!i || typeof f != "function") throw new Error(`the loader has no heap-resize import ${ie.module}.${ie.name} to hold the memory ceiling with`);
      const l = await er(e), u = l instanceof WebAssembly.Module ? l : await WebAssembly.compile(l);
      if (!WebAssembly.Module.imports(u).some((w) => w.module === ie.module && w.name === ie.name && w.kind === "function"))
        throw new Error(`the module imports no function ${ie.module}.${ie.name}: it is not the pinned smlibwasm build`);
      const c = await WebAssembly.instantiate(u, r), d = Object.values(c.exports).find((w) => w instanceof WebAssembly.Memory);
      if (!d) throw new Error("the module exports no memory");
      if (d.buffer.byteLength > o * Me) throw new Error(`the memory ceiling ${t} bytes is below the module's initial ${d.buffer.byteLength} bytes`);
      const y = d.grow.bind(d);
      Object.defineProperty(d, "grow", {
        configurable: !0,
        value: (w) => {
          const p = d.buffer.byteLength / Me;
          if (s === void 0 || Math.ceil(s / Me) > o || p >= o) throw new RangeError(`WebAssembly memory ceiling of ${o * Me} bytes reached`);
          return y(Math.min(w, o - p));
        }
      }), a(c);
    })().catch((l) => n(l instanceof Error ? l : new Error(String(l)))), {};
  };
}
async function nr(e) {
  const { init: t } = await import("./chunk-WNM5TYC5-DPBFlphI.js").then(function(a) {
    return a.c;
  }), { maxMemoryBytes: n, ...o } = e, r = { ...o };
  delete r.guardSeconds;
  try {
    if (n === void 0) return await t(r);
    (!(n > 0) || !Number.isFinite(n)) && _("maxMemoryBytes must be a positive number of bytes.");
    const a = Math.floor(n / Me) * Me;
    if (Pe)
      return a !== Pe.bytes && _(`The kernel was loaded with a memory ceiling of ${Pe.bytes} bytes; it loads once per process or worker.`), await Pe.loaded;
    let s = () => {
    };
    const i = new Promise((l, u) => {
      s = u;
    }), f = Promise.race([t({ instantiateWasm: tr(r, n, s) }), i]);
    Pe = { bytes: a, loaded: f };
    try {
      const l = await f;
      return ct = a, l;
    } catch (l) {
      throw Pe = void 0, l;
    }
  } catch (a) {
    throw a instanceof A ? a : new A("invalid-input", `Could not load SMLib: ${a instanceof Error ? a.message : String(a)}`, { cause: a });
  }
}
var Ct = (e) => {
  const t = e.tolerance ?? Zo, n = e.angleDeg ?? Qo;
  return Y("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function or({ sm: e, solid: t }) {
  return {
    box(n) {
      return Y("Box size", ...n), $("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, o) {
      return Y("Cylinder radius and height", n, o), $("Cylinder", () => t("Cylinder", e.Cylinder(n, o)));
    },
    cone(n, o, r) {
      return X("Cone radii", n, o), Y("Cone height", r), (n < 0 || o < 0 || !(n > 0 || o > 0)) && _("Cone radii must be non-negative and not both zero."), $("Cone", () => t("Cone", n === o ? e.Cylinder(n, r) : e.Cone(n, o, r)));
    },
    sphere(n) {
      return Y("Sphere radius", n), $("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, o) {
      return Y("Torus radii", n, o), o >= n && _("The tube radius must be smaller than the major radius."), $("Torus", () => t("Torus", e.Torus(n, o)));
    },
    polyhedron(n, o) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(o) || o.length < 4) && _("A polyhedron needs at least four points and four faces.");
      for (const r of n) X("Polyhedron points", r[0], r[1], r[2]);
      for (const r of o) (!Array.isArray(r) || r.length < 3 || r.some((a) => !Number.isInteger(a) || a < 0 || a >= n.length)) && _("Polyhedron faces must index at least three existing points.");
      return $("stitch (polyhedron)", () => e.scope(() => {
        const r = zo(n, o).map((s) => {
          const i = s.map((f) => oe(n[f]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), a = e.stitch(...r);
        return (!(a instanceof e.Part) || !a.isValid()) && _("The polyhedron faces do not close around a valid solid."), pe(a);
      }));
    }
  };
}
function gn(e, t, n) {
  return (wo(t, n) ?? _("The loft sections cannot be matched vertex to vertex.")).map((r) => new e.Wire(r.map((a, s) => e.Line(oe(a), oe(r[(s + 1) % r.length])))));
}
var rr = 1e-6, we = (e) => [e.x, e.y, e.z];
function sr(e, t) {
  const n = t.map((i, f) => ar(i, f));
  if (n.every((i) => i.every((f) => f.geomType === "line")))
    return gn(e, n.map((i) => i.map((f) => we(f.start))), "closest");
  if (n.some((i) => i.length !== n[0].length))
    throw new A("unsupported", `Loft pairing 'closest' matches sections with different edge counts (${n.map((i) => i.length).join(", ")}) only when every edge is straight; these have curved edges. Use pairing 'authored', or give the sections equal edge counts.`);
  const o = (i) => i.some((f, l) => {
    const u = i[(l + i.length - 1) % i.length].tangentAt(1), c = f.tangentAt(0);
    return Math.acos(Math.max(-1, Math.min(1, u.x * c.x + u.y * c.y + u.z * c.z))) > rr;
  });
  if (!n.some(o)) return;
  const r = n.map((i) => ({ pos: ir(i), axis: [0, 0, 1] })), a = hn(n.map((i) => i.map((f) => we(f.start))), r), s = t.map((i) => !!Qe(i.profile));
  return n.map((i, f) => {
    const { start: l, forward: u } = a[f], c = i.length, d = Array.from({ length: c }, (y, w) => u ? i[(l + w) % c] : i[((l - 1 - w) % c + c) % c]);
    return new e.Wire(d.map((y) => {
      const [w, p] = u ? [y.start, y.end] : [y.end, y.start];
      if (y.geomType === "line") return e.Line(we(w), we(p));
      if (y.geomType === "circle") return e.ThreePointArc(we(w), we(y.pointAt(0.5)), we(p));
      if (u && s[f]) return y;
      throw new A("unsupported", `Loft pairing 'closest' would run section ${f + 1} ${u ? "from another vertex" : "the other way round"}, and it has a ${y.geomType} edge, which this kernel re-starts only as drawn in a path profile; it re-starts lines and circular arcs. Use pairing 'authored', or draw the section from the vertex and in the direction it pairs with.`);
    }));
  });
}
function ar(e, t) {
  const n = (s) => {
    throw new A("unsupported", `Loft pairing 'closest' needs single-outline sections; section ${t + 1} ${s}. Use pairing 'authored' for it.`);
  };
  let o = Qe(e.profile);
  if (!o) {
    const s = [...H(e.profile).faces()];
    s.length !== 1 && n(`has ${s.length} regions`), [...s[0].innerWires()].length && n("has holes"), o = s[0].outerWire();
  }
  const r = [...o.translate(oe(e.at)).edges()], a = (s, i) => Math.hypot(s.x - i.x, s.y - i.y, s.z - i.z) <= 1e-7;
  for (let s = 0; s < r.length; s++) {
    const i = r[s], f = r[(s + 1) % r.length];
    a(i.end, f.start) || n("is not one closed chain of edges"), i.isClosed && r.length > 1 && n("has a closed edge among others");
  }
  return r;
}
function ir(e) {
  let n = 0;
  const o = [0, 0, 0];
  for (const r of e) {
    const a = r.length;
    for (let s = 0; s <= 64; s++) {
      const i = (s === 0 || s === 64 ? 1 : s % 2 ? 4 : 2) * a / 192, f = r.pointAt(s / 64);
      o[0] += i * f.x, o[1] += i * f.y, o[2] += i * f.z;
    }
    n += a;
  }
  return [o[0] / n, o[1] / n, o[2] / n];
}
function cr({ sm: e, solid: t }) {
  return {
    extrude(n, o) {
      return Y("Extrusion height", o), $("extrude", () => t("extrude", e.extrude(H(n), o)));
    },
    revolve(n, o) {
      return X("Revolution angle", o), (o === 0 || Math.abs(o) > 360) && _("Revolution angle must be in (0, 360] degrees in magnitude."), $("revolve", () => e.scope(() => {
        const r = H(n).rotate(e.Axis.X, 90), a = e.revolve(r, e.Axis.Z, Math.abs(o));
        return t("revolve", o < 0 ? a.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : a);
      }));
    },
    loft(n, o = {}) {
      (!Array.isArray(n) || n.length < 2) && _("A loft needs at least two sections.");
      for (const a of n) X("Loft section position", ...a.at);
      const r = o.pairing ?? "authored";
      return r !== "authored" && r !== "closest" && _(`Unknown loft pairing '${String(r)}' (authored or closest).`), $("loft", () => e.scope(() => {
        const a = !!o.ruled, s = n.map((u) => Et(u.profile)?.length), i = s.some((u) => u !== s[0]);
        if (s.every((u) => u !== void 0) && (i || r === "closest"))
          return t("loft", e.loft(gn(e, n.map((u) => Et(u.profile).map((c) => [c[0] + u.at[0], c[1] + u.at[1], c[2] + u.at[2]])), r), { ruled: a }));
        if (r === "closest") {
          const u = sr(e, n);
          if (u) return t("loft", e.loft(u, { ruled: a }));
        }
        const l = (n.every((u) => Qe(u.profile)) ? n.map((u) => Qe(u.profile).translate(oe(u.at))) : void 0) ?? n.map((u) => H(u.profile).translate(oe(u.at)));
        return t("loft", e.loft(l, { ruled: a }));
      }));
    },
    sweep(n, o) {
      (!Array.isArray(o) || o.length < 2) && _("A sweep rail needs at least two points.");
      for (const r of o) X("Sweep rail points", ...r);
      return $("sweep", () => e.scope(() => {
        const r = o.map(oe), a = r.length === 2 ? e.Line(r[0], r[1]) : e.Polyline(r);
        return t("sweep", e.sweep(H(n), a));
      }));
    }
  };
}
function lr({ sm: e, solid: t }) {
  return {
    union: (n, ...o) => $("fuse", () => t("fuse", o.length ? e.fuse(z(n), ...o.map(z)) : z(n))),
    subtract: (n, ...o) => $("cut", () => t("cut", o.length ? e.cut(z(n), ...o.map(z)) : z(n))),
    intersect: (n, ...o) => $("intersect", () => t("intersect", o.length ? e.intersect(z(n), ...o.map(z)) : z(n))),
    splitByPlane: (n, o, r) => {
      const a = Ke("Split normal", o);
      return X("Split offset", r), $("split", () => {
        const [s, i] = e.split(z(n), new e.Plane([a[0] * r, a[1] * r, a[2] * r], void 0, a), "both");
        return [t("split", s), t("split", i)];
      });
    },
    translate: (n, o) => (X("Translation", ...o), $("translate", () => pe(z(n).translate(oe(o))))),
    rotate: (n, o, r, a = [0, 0, 0]) => {
      const s = Ke("Rotation axis", o);
      return X("Rotation angle and pivot", r, ...a), $("rotate", () => pe(z(n).rotate(new e.Axis(oe(a), s), r)));
    },
    mirror: (n, o, r = [0, 0, 0]) => {
      const a = Ke("Mirror normal", o);
      return X("Mirror origin", ...r), $("mirror", () => pe(z(n).mirror(new e.Plane(oe(r), void 0, a))));
    },
    scale: (n, o) => (X("Scale factors", ...o), o.some((r) => r === 0) && _("A zero scale factor flattens the solid."), $("scale", () => pe(z(n).scale(oe(o), [0, 0, 0]))))
  };
}
function fr(e) {
  const { sm: t, solid: n, face: o } = e, r = (s, i) => {
    if (i === "all") return s.edges();
    if (i && typeof i == "object" && "edgeIndices" in i) {
      Array.isArray(i.edgeIndices) || _("edgeIndices must be an array of edge indices.");
      try {
        return Yo(s, i.edgeIndices);
      } catch (f) {
        throw f instanceof RangeError && _(f.message), f;
      }
    }
    return o(s, i).edges();
  }, a = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, i, f = "all") => (Y("Fillet radius", i), $("fillet", () => n("fillet", t.fillet(r(z(s), f), i)))),
    chamfer: (s, i, f = "all") => (Y("Chamfer distance", i), $("chamfer", () => n("chamfer", t.chamfer(r(z(s), f), i)))),
    topology: (s) => $("topology", () => t.scope(() => Vo(z(s)))),
    nameFaces: (s, i) => ((!Array.isArray(i) || i.some((f) => f !== null && typeof f != "string")) && _("Face names must be strings or null."), $("named", () => {
      try {
        return n("named", Ko(z(s), i));
      } catch (f) {
        throw f instanceof RangeError && _(f.message), f;
      }
    })),
    shell: (s, i, f) => {
      Y("Shell thickness", i);
      const l = f === void 0 ? [] : a(f) ? [f] : [...f];
      return $("shell", () => {
        const u = z(s), c = l.map((d) => o(u, d));
        return n("shell", t.shell(u, -i, c.length ? c : null));
      });
    }
  };
}
function ur({ sm: e }) {
  return {
    volume: (t) => $("volume", () => z(t).volume),
    area: (t) => $("area", () => z(t).area),
    // Not SMLib's bbox(): it misses interior extremes of some rotated spheres (see bbox.ts).
    bbox: (t) => $("bbox", () => Mo(z(t))),
    massProperties: (t) => $("massProperties", () => {
      const n = z(t).massProperties(1), o = n.inertia, r = (f, l) => (o[f][l] + o[l][f]) / 2, a = [[o[0][0], r(0, 1), r(0, 2)], [r(0, 1), o[1][1], r(1, 2)], [r(0, 2), r(1, 2), o[2][2]]], { values: s, vectors: i } = ho(a);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: a, principalMoments: s, principalAxes: i };
    }),
    isValid: (t) => $("isValid", () => z(t).isValid()),
    solidCount: (t) => $("solids", () => e.scope(() => z(t).solids().length)),
    components: (t) => $("solids", () => [...z(t).solids()].map(pe))
  };
}
var yn = () => {
}, dr = 1e3, hr = "ISO-10303-21", pr = /END-ISO-10303-21;\s*$/;
function mr(e) {
  let t = e.length;
  for (; t > 0 && (e.charCodeAt(t - 1) === 0 || e.charCodeAt(t - 1) === 26); ) t--;
  return e.slice(0, t);
}
function gr(e) {
  if (typeof e == "string") return e;
  if (e instanceof Uint8Array) {
    let t = "";
    for (let n = 0; n < e.length; n += 32768) t += String.fromCharCode(...e.subarray(n, n + 32768));
    return t;
  }
  return _("STEP input must be text or bytes (a Uint8Array).");
}
function yr(e, t, n) {
  const o = gr(t);
  o.length || _("STEP input must not be empty."), o.replace(/^\uFEFF|^\xEF\xBB\xBF/, "").trimStart().startsWith(hr) || _("This is not a STEP file: it does not start with ISO-10303-21."), pr.test(mr(o)) || _("The STEP file is incomplete: it does not end with END-ISO-10303-21; (was it cut short?).");
  const r = [];
  let a;
  e.setWarningHandler((u) => {
    r.push(String(u));
  });
  try {
    a = e.fromStep(o, { strict: !0 });
  } catch (u) {
    const c = u instanceof Error ? u.message : String(u);
    throw u instanceof e.KernelError ? new A("kernel-failure", `SMLib fromStep failed: ${c}`, { cause: u }) : u instanceof e.ModelingError ? new A("unsupported", /holds no B-rep/.test(c) ? "The STEP file holds no solid (no B-rep body)." : `The STEP file cannot be read exactly: ${c.replace(/^import STEP: /, "")}`, { cause: u }) : new A("invalid-input", `The STEP file is malformed: ${c}`, { cause: u });
  } finally {
    e.setWarningHandler(yn);
  }
  const s = Array.isArray(a) ? [...a] : [a], i = () => s.forEach((u) => u?.dispose?.());
  try {
    if (!s.length) throw new A("unsupported", "The STEP file holds no solid (no B-rep body).");
    if (s.length > n) throw new A("unsupported", `The STEP file holds ${s.length} bodies; at most ${n} can be imported.`);
    const u = (c, d) => c.name ? `body ${d + 1} ('${c.name}')` : `body ${d + 1}`;
    s.forEach((c, d) => {
      if (!(c instanceof e.Part)) {
        const p = c instanceof e.Shell ? "an open surface (a sheet), not a closed solid" : `not a solid (${c?.constructor?.name ?? typeof c})`;
        throw new A("unsupported", `The STEP file's ${u(c, d)} is ${p}.`);
      }
      const y = $("isValid", () => c.isValid()), w = y ? $("volume", () => c.volume) : 0;
      if (!y || !(w > 0)) throw new A("unsupported", `The STEP file's ${u(c, d)} is not a valid closed solid, even after repair.`);
    });
  } catch (u) {
    throw i(), u;
  }
  const f = s.map((u) => {
    const c = u.color;
    return { solid: pe(u), name: typeof u.name == "string" && u.name ? u.name : null, color: c ? [Number(c[0]), Number(c[1]), Number(c[2])] : null, occurrence: null };
  });
  let l = "unknown";
  try {
    const u = uo(o);
    u.bodies.length === f.length && u.names.every((c, d) => c === f[d].name) ? (f.forEach((c, d) => {
      c.occurrence = u.bodies[d];
    }), l = u.assembly ? "assembly" : "flat") : r.push(`The product structure was not kept: it lists ${u.bodies.length} bodies where the reader built ${f.length}, or names them differently; the bodies are imported without it.`);
  } catch (u) {
    r.push(`The product structure was not kept: ${u instanceof Error ? u.message : String(u)}.`);
  }
  return { bodies: f, notes: r, structure: l };
}
var Dt = 1e3;
function zt(e, t) {
  if (e !== void 0)
    return (typeof e != "string" || !e.length || e.length > Dt || [...e].some((n) => n.charCodeAt(0) < 32 || n.charCodeAt(0) === 127)) && _(`${t} must be a non-empty string of at most ${Dt} characters without control characters.`), e;
}
function xr(e, t, n) {
  (!n || typeof n != "object") && _("exportStep options must be an object.");
  const o = zt(n.product, "The STEP product name");
  if (!Array.isArray(t)) {
    const s = z(t);
    return $("toStep", () => e.toStep(s, o === void 0 ? {} : { name: o }));
  }
  const r = t;
  r.length || _("exportStep needs at least one body.");
  const a = r.map((s, i) => {
    (!s || typeof s != "object") && _(`exportStep body ${i + 1} must be { solid, name?, color? }.`);
    const f = z(s.solid), l = zt(s.name, `The name of STEP body ${i + 1}`), u = s.color;
    return u !== void 0 && (!Array.isArray(u) || u.length !== 3 || u.some((c) => typeof c != "number" || !(c >= 0 && c <= 1))) && _(`The colour of STEP body ${i + 1} must be [r, g, b] with each from 0 to 1.`), { part: f, name: l, color: u };
  });
  return $("toStep", () => e.scope(() => {
    const s = a.map(({ part: f, name: l, color: u }) => {
      let c = l === void 0 ? f : f.named(l);
      return u !== void 0 && (c = c.colored([u[0], u[1], u[2]])), c;
    }), i = o ?? (a.length === 1 ? a[0].name : void 0);
    return e.toStep(s, i === void 0 ? {} : { name: i });
  }));
}
function wr({ sm: e, solid: t }) {
  return {
    tessellate: (n, o = {}) => {
      const { tolerance: r, angle: a } = Ct(o);
      return $("mesh", () => e.scope(() => {
        const s = z(n).mesh(r, a), i = Float64Array.from(s.vertices), f = Uint32Array.from(s.triangles);
        return { positions: i, normals: po(i, f), indices: f };
      }));
    },
    exportStl: (n, o = {}) => {
      const { tolerance: r, angle: a } = Ct(o);
      return $("toStl", () => e.toStl(z(n), { tolerance: r, angle: a }));
    },
    exportStep: (n, o = {}) => xr(e, n, o),
    importStep: (n) => ((typeof n != "string" || !n.length) && _("STEP input must be non-empty text."), $("fromStep", () => {
      const o = e.fromStep(n);
      if (Array.isArray(o) && o.length && o.every((r) => r instanceof e.Part)) {
        const r = o;
        return t("fromStep", r.length === 1 ? r[0] : e.fuse(r[0], ...r.slice(1)));
      }
      return t("fromStep", o);
    })),
    importStepBodies: (n, o = {}) => {
      const r = o.maxBodies ?? dr;
      return (!Number.isInteger(r) || r < 1) && _("maxBodies must be a positive whole number."), yr(e, n, r);
    }
  };
}
async function vr(e = {}) {
  const t = await nr(e);
  e.guardSeconds !== void 0 && (e.guardSeconds >= 0 || _("guardSeconds must be 0 or more."), t.setGuardSeconds(e.guardSeconds)), t.setWarningHandler(yn);
  const n = mo(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: Jo,
    profile: ko(t),
    ...or(n),
    ...cr(n),
    ...lr(n),
    ...fr(n),
    ...ur(n),
    ...wr(n),
    memory: () => {
      const o = t.memoryUsage();
      return { used: o.used, heap: o.heap, handles: o.handles };
    },
    scope: (o) => t.scope(o),
    setGuardSeconds: (o) => (Number(o) >= 0 || _("The guard must be 0 or more seconds."), t.setGuardSeconds(o)),
    guardSeconds: () => t.GUARD_SECONDS,
    ...ct !== void 0 ? { maxMemoryBytes: ct } : {}
  };
}
const Mr = "@crispcad/exact-kernel", br = "0.1.11", Er = "smlib", Sr = Object.freeze({ id: Er, package: Mr, version: br }), Ft = 16, Lt = 2048, j = (e) => {
  throw new A("unsupported", e);
}, Se = (e) => {
  throw new A("invalid-input", e);
};
function be(e, t) {
  t < Ft && j(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${Ft}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const Tr = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], lt = (e, t) => {
  const n = [];
  for (let o = 0; o < 3; o++)
    for (let r = 0; r < 4; r++)
      n.push(e[o * 4] * t[r] + e[o * 4 + 1] * t[4 + r] + e[o * 4 + 2] * t[8 + r] + (r === 3 ? e[o * 4 + 3] : 0));
  return n;
}, Ne = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), Bt = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], Ar = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function Ye(e, t) {
  const n = Math.hypot(...e);
  n > 0 || Se("Rotation axis must be non-zero.");
  const [o, r, a] = e.map((u) => u / n), s = t * Math.PI / 180, i = Math.cos(s), f = Math.sin(s), l = 1 - i;
  return [l * o * o + i, l * o * r - f * a, l * o * a + f * r, 0, l * o * r + f * a, l * r * r + i, l * r * a - f * o, 0, l * o * a - f * r, l * r * a + f * o, l * a * a + i, 0];
}
const Ir = (e) => lt(Ye([0, 0, 1], e[2]), lt(Ye([0, 1, 0], e[1]), Ye([1, 0, 0], e[0])));
function Pr(e) {
  const t = Math.hypot(...e);
  t > 0 || Se("Mirror normal must be non-zero.");
  const [n, o, r] = e.map((a) => a / t);
  return [1 - 2 * n * n, -2 * n * o, -2 * n * r, 0, -2 * n * o, 1 - 2 * o * o, -2 * o * r, 0, -2 * n * r, -2 * o * r, 1 - 2 * r * r, 0];
}
function Nr(e) {
  const [t, n, o, , r, a, s, , i, f, l] = e, u = Math.max(-1, Math.min(1, (t + a + l - 1) / 2)), c = Math.acos(u);
  if (c < 1e-15)
    return null;
  let d = [f - s, o - i, r - n];
  return Math.hypot(...d) < 1e-9 && (d = [[t + 1, r, i], [n, a + 1, f], [o, s, l + 1]].reduce((w, p) => Math.hypot(...p) > Math.hypot(...w) ? p : w)), { axis: d, degrees: c * 180 / Math.PI };
}
function $r(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && Se("Affine matrix is singular.");
  for (const [s, i] of [[0, 1], [0, 2], [1, 2]]) {
    const f = t[s][0] * t[i][0] + t[s][1] * t[i][1] + t[s][2] * t[i][2];
    Math.abs(f) > 1e-9 * n[s] * n[i] && j("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const o = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), r = [n[0], n[1], o < 0 ? -n[2] : n[2]], a = [0, 1, 2].flatMap((s) => [e[s * 4] / r[0], e[s * 4 + 1] / r[1], e[s * 4 + 2] / r[2], 0]);
  return { scale: r, rotation: a, translate: [e[3], e[7], e[11]] };
}
function xn(e, t, n, o) {
  const r = e.map((s, i) => {
    if (!s)
      return 0;
    const f = o[i] - n[i];
    return f < 1e-12 && Se("Cannot resize a degenerate shape."), s / f;
  }), a = Math.max(...r) || 1;
  return r.map((s, i) => e[i] ? s : t?.[i] ? a : 1);
}
function ce(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return be("circle2d", t.segments), e.profile.circle(t.radius);
    case "rectangle":
      return e.profile.rectangle(t.size[0], t.size[1], t.center);
    case "move": {
      const n = ce(e, t.profile);
      return n && e.profile.translate(n, t.vector);
    }
    case "rotate": {
      const n = ce(e, t.profile);
      return n && e.profile.rotate(n, t.angle);
    }
    case "scale": {
      const n = ce(e, t.profile);
      return n && e.profile.scale(n, t.vector);
    }
    case "affine": {
      const n = ce(e, t.profile);
      if (!n)
        return null;
      const [o, r, a, s, i, f] = t.matrix, l = Math.hypot(o, s), u = Math.hypot(r, i);
      l > 1e-12 && u > 1e-12 || Se("2D affine matrix is singular."), Math.abs(o * r + s * i) > 1e-9 * l * u && j("2D affine transforms with shear have no exact lowering here.");
      const c = o * i - r * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [l, c < 0 ? -u : u]), Math.atan2(s, o) * 180 / Math.PI), [a, f]);
    }
    case "resize": {
      const n = ce(e, t.profile);
      if (!n)
        return null;
      const o = e.profile.bounds(n), r = xn(t.size, t.auto, o.min, o.max);
      return e.profile.scale(n, [r[0], r[1]]);
    }
    case "offset": {
      t.round && be("offset2d", t.segments);
      const n = ce(e, t.profile);
      return n && e.profile.offset(n, t.distance, t.round);
    }
    case "text":
      return j("text2d needs a font outline path, and the exact kernel package ships no font.");
    case "minkowski":
      return j("minkowski2d has no exact lowering (planar Minkowski sums of curved profiles are not exposed by this kernel adapter).");
    case "union":
    case "subtract":
    case "intersect":
    case "hull": {
      const n = t.profiles.map((a) => ce(e, a)), o = n.filter((a) => a !== null);
      if (t.kind === "union")
        return o.length ? e.profile.union(o[0], ...o.slice(1)) : null;
      if (t.kind === "hull")
        return o.length ? e.profile.hull(...o) : null;
      if (t.kind === "intersect")
        return n.some((a) => a === null) || !o.length ? null : e.profile.intersect(o[0], ...o.slice(1));
      if (!n[0])
        return null;
      const r = n.slice(1).filter((a) => a !== null);
      return r.length ? e.profile.subtract(n[0], ...r) : n[0];
    }
    default:
      return j(`Profile '${t.kind}' has no exact lowering.`);
  }
}
function _e(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, o = e.center ? -t / 2 : 0, r = e.center ? -n / 2 : 0;
      return [[o, r], [o + t, r], [o + t, r + n], [o, r + n]];
    }
    case "move":
      return _e(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return _e(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), o = Math.sin(t);
      return _e(e.profile).map(([r, a]) => [n * r - o * a, o * r + n * a]);
    }
    case "affine": {
      const t = e.matrix;
      return _e(e.profile).map(([n, o]) => [t[0] * n + t[1] * o + t[2], t[3] * n + t[4] * o + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(_e);
    case "empty":
      return [];
    default:
      return j(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function ft(e, t, n) {
  const o = (r, a) => ft(a, lt(t, r), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const r of e.shapes)
        ft(r, t, n);
      return;
    case "move":
      return o(Bt(e.vector), e.shape);
    case "rotate":
      return o(Ir(e.vector), e.shape);
    case "scale":
      return o(Ar(e.vector), e.shape);
    case "mirror":
      return o(Pr(e.vector), e.shape);
    case "axisRotate":
      return o(Ye(e.vector, e.angle), e.shape);
    case "affine":
      return o(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let r = 0; r < e.count; r++)
        o(Bt(e.step.map((a) => a * r)), e.shape);
      return;
    case "box": {
      const [r, a, s] = e.size.map((i) => i / 2);
      for (const i of [-r, r])
        for (const f of [-a, a])
          for (const l of [-s, s])
            n.points.push(Ne(t, [i, f, l]));
      return;
    }
    case "polyhedron":
      for (const r of e.points)
        n.points.push(Ne(t, r));
      return;
    case "extrude":
      for (const [r, a] of e.points)
        for (const s of [0, e.height])
          n.points.push(Ne(t, [r, a, s]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && j("hull of a twisted extrusion has no exact lowering.");
      for (const [r, a] of _e(e.profile))
        n.points.push(Ne(t, [r, a, 0])), n.points.push(Ne(t, [r * e.scaleTop[0], a * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      be("sphere", e.segments);
      const r = [0, 1, 2].map((a) => Math.hypot(t[a], t[4 + a], t[8 + a]));
      Math.max(...r) - Math.min(...r) > 1e-12 * Math.max(...r) && j("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: Ne(t, [0, 0, 0]), radius: e.radius * r[0] });
      return;
    }
    default:
      j(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function _r(e, t) {
  const n = { points: [], spheres: [] };
  for (const d of t)
    ft(d, Tr, n);
  if (n.points.length && n.spheres.length && j("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const d = mn(n.points);
    return e.polyhedron(d.points, d.faces);
  }
  if (!n.spheres.length)
    return null;
  const o = n.spheres[0].radius;
  n.spheres.some((d) => Math.abs(d.radius - o) > 1e-12 * o) && j("hull of spheres with different radii has no exact lowering.");
  const r = n.spheres.map((d) => d.centre), a = [0, 1, 2].map((d) => Math.min(...r.map((y) => y[d]))), s = [0, 1, 2].map((d) => Math.max(...r.map((y) => y[d]))), i = s.map((d, y) => d - a[y]), f = 1e-9 * Math.max(1, ...i);
  if (i.every((d) => d <= f))
    return e.translate(e.sphere(o), a);
  const l = (d) => [d & 1 ? s[0] : a[0], d & 2 ? s[1] : a[1], d & 4 ? s[2] : a[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((d) => r.some((y) => y.every((w, p) => Math.abs(w - l(d)[p]) <= f))) || i.some((d) => d <= f)) && j("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const c = e.box(i.map((d) => d + 2 * o));
  return e.translate(e.fillet(c, o, "all"), a.map((d, y) => d + i[y] / 2));
}
function wn(e, t, n) {
  const o = e.profile.bounds(t), r = o.max[0] <= 0;
  o.min[0] < -1e-8 && !r && Se("Revolved profiles must stay on one side of the radial axis.");
  const a = Math.abs(n);
  a > 360 && Se("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(r ? e.profile.scale(t, [-1, 1]) : t, n);
  return r && a !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function Or(e, t, n) {
  const { scale: o, rotation: r, translate: a } = $r(n);
  let s = o.every((f) => Math.abs(f - 1) < 1e-15) ? t : e.scale(t, o);
  const i = Nr(r);
  return i && (s = e.rotate(s, i.axis, i.degrees)), a.some((f) => f !== 0) ? e.translate(s, a) : s;
}
function yt(e, t) {
  const n = (o) => yt(e, o);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return be("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return be("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return be("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && j("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && j("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const o = ce(e, t.profile);
      return o && e.extrude(o, t.height);
    }
    case "revolve": {
      if (be("revolve", t.segments), t.angle === 0)
        return null;
      const o = ce(e, t.profile);
      return o && wn(e, o, t.angle);
    }
    case "polyhedron": {
      if (t.smooth)
        return Dr(e, t.smooth, t.closest);
      if (t.ruled)
        return Cr(e, t.closest ?? t.ruled, t.points, t.faces, t.closest ? "closest" : "authored");
      if (t.faces.length > Lt && j(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${Lt} faces).`), Bo(t.points, t.faces)) {
        const o = mn(t.points);
        return e.polyhedron(o.points, o.faces);
      }
      return e.polyhedron(t.points, t.faces);
    }
    case "union":
    case "subtract":
    case "intersect": {
      const o = (f) => f.kind === "union" ? f.shapes.flatMap(o) : [f], a = (t.kind === "subtract" ? [t.shapes[0], ...t.shapes.slice(1).flatMap(o)] : t.shapes).map(n), s = a.filter((f) => f !== null);
      if (t.kind === "union")
        return s.length ? e.union(s[0], ...s.slice(1)) : null;
      if (t.kind === "intersect")
        return a.some((f) => f === null) || !s.length ? null : e.intersect(s[0], ...s.slice(1));
      if (!a[0])
        return null;
      const i = a.slice(1).filter((f) => f !== null);
      return i.length ? e.subtract(a[0], ...i) : a[0];
    }
    case "hull":
      return _r(e, t.shapes);
    case "minkowski":
      return j("minkowski has no exact lowering (a general Minkowski sum is not a B-rep operation of this adapter; use fillet/offset intent instead).");
    case "move": {
      const o = n(t.shape);
      return o && e.translate(o, t.vector);
    }
    case "rotate": {
      const o = n(t.shape);
      if (!o)
        return null;
      let r = o;
      for (const [a, s] of [[[1, 0, 0], t.vector[0]], [[0, 1, 0], t.vector[1]], [[0, 0, 1], t.vector[2]]])
        s && (r = e.rotate(r, a, s));
      return r;
    }
    case "scale": {
      const o = n(t.shape);
      return o && e.scale(o, t.vector);
    }
    case "mirror": {
      const o = n(t.shape);
      return o && e.mirror(o, t.vector);
    }
    case "axisRotate": {
      const o = n(t.shape);
      return o && (t.angle ? e.rotate(o, t.vector, t.angle) : o);
    }
    case "affine": {
      const o = n(t.shape);
      return o && Or(e, o, t.matrix.slice(0, 12));
    }
    case "resize": {
      const o = n(t.shape);
      if (!o)
        return null;
      const r = e.bbox(o);
      return e.scale(o, xn(t.vector, t.auto, r.min, r.max));
    }
    case "repeat": {
      const o = t.count >= 1 ? n(t.shape) : null;
      if (!o)
        return null;
      const r = Array.from({ length: t.count }, (a, s) => s === 0 ? o : e.translate(o, t.step.map((i) => i * s)));
      return r.length > 1 ? e.union(r[0], ...r.slice(1)) : r[0];
    }
    default:
      return j(`CAD Script '${t.kind}' has no exact lowering.`);
  }
}
function Rr(e, t) {
  let n = 0;
  for (const o of t)
    for (let r = 1; r + 1 < o.length; r++) {
      const a = e[o[0]], s = e[o[r]], i = e[o[r + 1]];
      n += a[0] * (s[1] * i[2] - s[2] * i[1]) - a[1] * (s[0] * i[2] - s[2] * i[0]) + a[2] * (s[0] * i[1] - s[1] * i[0]);
    }
  return n / 6;
}
function Cr(e, t, n, o, r = "authored") {
  const a = e.loft(t.map((f) => ({ profile: e.profile.polygon([f.map((l) => [l[0], l[1]])]), at: [0, 0, f[0][2]] })), r === "closest" ? { ruled: !0, pairing: r } : { ruled: !0 }), s = Rr(n, o), i = e.volume(a);
  if (!(Math.abs(i - s) <= 1e-7 * Math.abs(s)))
    throw a.dispose(), new A("kernel-failure", `The ruled loft's volume ${i} differs from its faceted volume ${s}; the kernel did not keep the vertex correspondence.`);
  return a;
}
function Dr(e, t, n) {
  const o = e.loft((n ?? t).map((s) => ({ profile: e.profile.polygon([s.map((i) => [i[0], i[1]])]), at: [0, 0, s[0][2]] })), n ? { ruled: !1, pairing: "closest" } : { ruled: !1 }), r = $n(_n(t)), a = e.volume(o);
  if (!(Math.abs(a - r) <= 1e-7 * Math.abs(r)))
    throw o.dispose(), new A("kernel-failure", `The smooth loft's volume ${a} differs from the volume ${r} of the surface CAD Script defines; the kernel built another surface.`);
  return o;
}
function $s(e, t) {
  let n;
  try {
    n = on(t).shape;
  } catch (r) {
    throw r instanceof Nn ? new A("invalid-input", `CAD Script: ${r.message}`, { cause: r }) : r;
  }
  const o = e.scope(() => yt(e, n));
  if (!o)
    throw new A("invalid-input", "The program produces no solid.");
  if (!(e.volume(o) > 0))
    throw o.dispose(), new A("kernel-failure", "The exact result has no positive volume.");
  return o;
}
const _s = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} }), Oe = 1048576, vn = 4, zr = Object.freeze({ maxFeatureEdges: 400, maxShellFaces: 160, maxMemoryBytes: 512 * Oe, recycleAboveBytes: 192 * Oe, requestTimeoutMs: 6e4, maxStepImportBytes: 4 * Oe }), Os = Object.freeze({ maxFeatureEdges: 1e3, maxShellFaces: 500, maxMemoryBytes: 2048 * Oe, recycleAboveBytes: 512 * Oe, requestTimeoutMs: 12e4, maxStepImportBytes: 16 * Oe }), Rs = Object.freeze({ maxFeatureEdges: 1 / 0, maxShellFaces: 1 / 0, maxMemoryBytes: 1 / 0, recycleAboveBytes: 1 / 0, requestTimeoutMs: 1 / 0, maxStepImportBytes: 1 / 0 });
function Cs(e, t = zr) {
  const n = { ...t };
  for (const o of Object.keys(t)) {
    const r = e?.[o];
    typeof r == "number" && r > 0 && (n[o] = r);
  }
  return Object.freeze(n);
}
function Fr(e) {
  const t = e.requestTimeoutMs;
  return Number.isFinite(t) && t > 0 ? Math.max(1, Math.floor(t / 2e3)) : void 0;
}
function Lr(e) {
  const t = Fr(e);
  return { ...Number.isFinite(e.maxMemoryBytes) && e.maxMemoryBytes > 0 ? { maxMemoryBytes: e.maxMemoryBytes } : {}, ...t !== void 0 ? { guardSeconds: t } : {} };
}
const Br = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
};
function Ur(e, t) {
  const [n, o, r] = t.faceNormal, a = Math.hypot(n, o, r);
  if (!(a > 0))
    return;
  const s = [n / a, o / a, r / a], i = e.filter((l) => {
    if (l.isPlanar === !1 || l.isPlanar === void 0 && l.geomType !== "plane")
      return !1;
    const u = l.normalAt();
    return u.x * s[0] + u.y * s[1] + u.z * s[2] > 1 - 1e-9;
  });
  if (!t.outermost)
    return i.length === 1 ? i[0] : void 0;
  const f = (l) => {
    const u = l.center?.();
    return u ? u.x * s[0] + u.y * s[1] + u.z * s[2] : 0;
  };
  return i.sort((l, u) => f(u) - f(l))[0];
}
function Hr(e, t, n = "all") {
  const o = Br(e);
  if (!o)
    return;
  const r = [...o.faces()];
  let a;
  if (t !== "shell" && n !== "all" && "edgeIndices" in n) {
    if (!o.edges)
      return;
    const f = [...o.edges()];
    a = n.edgeIndices.map((l) => f[l]).filter(Boolean);
  } else if (t !== "shell" && n !== "all") {
    const f = Ur(r, n);
    if (!f)
      return { edges: 0, curvedEdges: 0, faces: r.length, weightedEdges: 0 };
    a = f.edges();
  } else if (o.edges)
    a = o.edges();
  else {
    const f = /* @__PURE__ */ new Map();
    let l = 0;
    for (const u of r)
      for (const c of u.edges())
        f.set(c._identity?.() ?? String(l++), c);
    a = f.values();
  }
  let s = 0, i = 0;
  for (const f of a)
    s++, f.geomType !== "line" && i++;
  return { edges: s, curvedEdges: i, faces: r.length, weightedEdges: s - i + vn * i };
}
function Xr(e, t, n, o) {
  if (!Number.isFinite(o.maxFeatureEdges) && !Number.isFinite(o.maxShellFaces))
    return;
  const r = Hr(e, t, n);
  if (r) {
    if (t === "shell") {
      if (r.faces > o.maxShellFaces)
        throw new A("unsupported", N`Shelling a body with ${r.faces} faces is too much for the exact kernel on this device, which allows ${o.maxShellFaces}. Shell a simpler body, or add the holes after shelling.`);
    } else if (r.weightedEdges > o.maxFeatureEdges) {
      const a = Math.floor(o.maxFeatureEdges / vn), s = o.maxFeatureEdges;
      throw new A("unsupported", t === "fillet" ? N`Rounding ${r.edges} edges (${r.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${a} curved or ${s} straight edges per feature. Choose a face with fewer edges.` : N`Beveling ${r.edges} edges (${r.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${a} curved or ${s} straight edges per feature. Choose a face with fewer edges.`);
    }
    return r;
  }
}
const Wr = 8, ne = (e, t, n) => (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x), De = (e, t) => e.x === t.x && e.y === t.y;
function kr(e, t) {
  let n = 0;
  for (let o = 0, r = t.length - 1; o < t.length; r = o++)
    n += e[2 * t[r]] * e[2 * t[o] + 1] - e[2 * t[o]] * e[2 * t[r] + 1];
  return n / 2;
}
function Ut(e, t, n) {
  let o, r;
  for (const a of t) {
    const s = { i: a, x: e[2 * a], y: e[2 * a + 1], removed: !1 };
    o ? (r.next = s, s.prev = r) : o = s, r = s, n.push(s);
  }
  return r.next = o, o.prev = r, o;
}
function st(e, t) {
  const n = e.prev, o = e.next;
  return ne(n, e, o) >= 0 ? ne(e, o, t) > 0 && ne(e, t, n) > 0 : !(ne(e, n, t) > 0 && ne(e, t, o) > 0);
}
function Mn(e, t, n, o, r) {
  const a = ne(e, t, o), s = ne(t, n, o), i = ne(n, e, o);
  return r ? a > 0 && s > 0 && i > 0 : a >= 0 && s >= 0 && i >= 0;
}
function jr(e, t, n) {
  const o = { ...e }, r = { ...t }, a = e.next, s = t.prev;
  e.next = t, t.prev = e, o.next = a, a.prev = o, r.next = o, o.prev = r, s.next = r, r.prev = s, n.push(o, r);
}
function Gr(e, t) {
  let n, o = 1 / 0, r = t;
  do {
    const l = r.next;
    if (r.y <= e.y && e.y < l.y || l.y <= e.y && e.y < r.y) {
      const u = r.y === e.y ? r.x : l.y === e.y ? l.x : r.x + (e.y - r.y) * (l.x - r.x) / (l.y - r.y);
      if (u === e.x)
        return;
      u > e.x && u < o && (o = u, n = r.y === e.y ? r : l.y === e.y ? l : r.x > l.x ? r : l);
    }
    r = l;
  } while (r !== t);
  if (!n)
    return;
  const a = { x: o, y: e.y };
  let s = n, i = -1 / 0, f = 1 / 0;
  if (n.x !== o || n.y !== e.y) {
    i = (n.x - e.x) / Math.hypot(n.x - e.x, n.y - e.y), f = Math.hypot(n.x - e.x, n.y - e.y);
    const [l, u, c] = ne(e, a, n) > 0 ? [e, a, n] : [e, n, a];
    r = t;
    do {
      if (r !== n && !De(r, n) && Mn(l, u, c, r, !1) && !(r.x === e.x && r.y === e.y)) {
        const d = Math.hypot(r.x - e.x, r.y - e.y), y = (r.x - e.x) / d;
        (y > i || y === i && d < f) && st(r, e) && (s = r, i = y, f = d);
      }
      r = r.next;
    } while (r !== t);
  }
  if (!st(s, e)) {
    r = t;
    do {
      if (De(r, s) && st(r, e))
        return r;
      r = r.next;
    } while (r !== t);
    return;
  }
  return s;
}
function Vr(e, t) {
  if (!t.length || t.some((x) => x.length < 3))
    return null;
  const n = [], o = t.map((x) => kr(e, x));
  if (!(Math.abs(o[0]) > 0))
    return null;
  const r = t.map((x, v) => v === 0 == o[v] > 0 ? x : [...x].reverse()), a = Ut(e, r[0], n), s = r.slice(1).map((x) => {
    const v = Ut(e, x, n);
    let T = v, I = v.next;
    for (; I !== v; )
      (I.x > T.x || I.x === T.x && I.y > T.y) && (T = I), I = I.next;
    return T;
  });
  s.sort((x, v) => v.x - x.x || v.y - x.y);
  for (const x of s) {
    const v = Gr(x, a);
    if (!v)
      return null;
    jr(v, x, n);
  }
  let i = 1 / 0, f = 1 / 0, l = -1 / 0, u = -1 / 0;
  for (const x of n)
    x.x < i && (i = x.x), x.y < f && (f = x.y), x.x > l && (l = x.x), x.y > u && (u = x.y);
  const c = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(n.length / 2)))), d = (l - i) / c || 1, y = (u - f) / c || 1, w = (x, v, T) => Math.min(c - 1, Math.max(0, Math.floor((x - v) / T))), p = Array.from({ length: c * c }, () => []);
  for (const x of n)
    p[w(x.y, f, y) * c + w(x.x, i, d)].push(x);
  const g = (x, v) => {
    const T = x.prev, I = x.next, D = ne(T, x, I);
    if (v ? D < 0 : D <= 0)
      return !1;
    const R = w(Math.min(T.x, x.x, I.x), i, d), C = w(Math.max(T.x, x.x, I.x), i, d), O = w(Math.min(T.y, x.y, I.y), f, y), W = w(Math.max(T.y, x.y, I.y), f, y);
    for (let B = O; B <= W; B++)
      for (let F = R; F <= C; F++)
        for (const L of p[B * c + F])
          if (!(L.removed || L === T || L === x || L === I || De(L, T) || De(L, x) || De(L, I)) && Mn(T, x, I, L, !1))
            return !1;
    return !0;
  }, h = [];
  let m = a, b = m, P = !1, S = 0;
  {
    let x = a;
    do
      S++, x = x.next;
    while (x !== a);
  }
  for (; S > 3; ) {
    if (g(m, P)) {
      h.push(m.prev.i, m.i, m.next.i), m.removed = !0, m.prev.next = m.next, m.next.prev = m.prev, S--, m = m.next, b = m, P = !1;
      continue;
    }
    if (m = m.next, m === b) {
      if (P)
        return null;
      P = !0;
    }
  }
  if (ne(m.prev, m, m.next) < 0)
    return null;
  h.push(m.prev.i, m.i, m.next.i);
  const M = o.reduce((x, v, T) => x + (T === 0 ? Math.abs(v) : -Math.abs(v)), 0);
  let E = 0;
  for (let x = 0; x < h.length; x += 3) {
    const v = h[x], T = h[x + 1], I = h[x + 2];
    E += ((e[2 * T] - e[2 * v]) * (e[2 * I + 1] - e[2 * v + 1]) - (e[2 * T + 1] - e[2 * v + 1]) * (e[2 * I] - e[2 * v])) / 2;
  }
  return Math.abs(E - M) <= 1e-9 * Math.abs(o[0]) + 1e-12 ? h : null;
}
const bn = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
};
class Ue {
  constructor() {
    J(this, "buckets", /* @__PURE__ */ new Map());
  }
  static hash(t, n, o) {
    return Math.imul(t | 0, 73856093) ^ Math.imul(n | 0, 19349663) ^ Math.imul(o | 0, 83492791) ^ Math.imul(Math.floor(t / 4294967296) | 0, 2654435761);
  }
  get(t, n, o) {
    const r = this.buckets.get(Ue.hash(t, n, o));
    if (r) {
      for (let a = 0; a < r.length; a += 4)
        if (r[a] === t && r[a + 1] === n && r[a + 2] === o)
          return r[a + 3];
    }
  }
  set(t, n, o, r) {
    const a = Ue.hash(t, n, o), s = this.buckets.get(a);
    s ? s.push(t, n, o, r) : this.buckets.set(a, [t, n, o, r]);
  }
}
const me = (e, t) => e * 67108864 + t, et = class et {
  constructor() {
    J(this, "positions", []);
    J(this, "cells", new Ue());
  }
  add(t, n, o) {
    const r = et.Q, a = Math.round(t / r), s = Math.round(n / r), i = Math.round(o / r);
    let f = this.cells.get(a, s, i);
    if (f !== void 0)
      return f;
    const l = t / r - a, u = n / r - s, c = o / r - i, d = Math.abs(l) > 0.4 ? Math.sign(l) : 0, y = Math.abs(u) > 0.4 ? Math.sign(u) : 0, w = Math.abs(c) > 0.4 ? Math.sign(c) : 0;
    if (d || y || w) {
      for (const p of d ? [0, d] : [0])
        for (const g of y ? [0, y] : [0])
          for (const h of w ? [0, w] : [0])
            if (f = this.cells.get(a + p, s + g, i + h), f !== void 0)
              return this.cells.set(a, s, i, f), f;
    }
    return f = this.positions.length / 3, this.positions.push(t, n, o), this.cells.set(a, s, i, f), f;
  }
};
J(et, "Q", 1e-6);
let ut = et;
function Kr(e) {
  const t = bn(e);
  if (!t)
    return !1;
  for (const n of t.faces())
    if (n.geomType === "plane" && n.wires().length >= Wr)
      return !0;
  return !1;
}
function dt(e, t, n) {
  const o = bn(t);
  if (!o)
    return;
  const r = [...o.faces()], a = new ut(), s = [], i = n.faces ? [] : void 0, f = i ? new Map(r.map((h, m) => [h._identity(), m])) : void 0;
  let l = 0;
  const u = (h) => {
    if (i && f)
      for (l = f.get(h._identity()); i.length < s.length / 3; )
        i.push(l);
  }, c = /* @__PURE__ */ new Map(), d = (h) => {
    const m = new Uint32Array(h.vertices.length / 3);
    for (let S = 0; S < m.length; S++)
      m[S] = a.add(h.vertices[3 * S], h.vertices[3 * S + 1], h.vertices[3 * S + 2]);
    const b = /* @__PURE__ */ new Set(), P = [];
    for (let S = 0; S < h.triangles.length; S += 3) {
      const M = m[h.triangles[S]], E = m[h.triangles[S + 1]], x = m[h.triangles[S + 2]];
      M === E || E === x || x === M || (s.push(M, E, x), b.add(me(M, E)), b.add(me(E, x)), b.add(me(x, M)));
    }
    for (const S of b) {
      const M = Math.floor(S / 67108864), E = S - M * 67108864;
      b.has(me(E, M)) || P.push([M, E]);
    }
    return P;
  }, y = [], w = n.bands !== !1 ? Zr(r, n) : /* @__PURE__ */ new Map();
  for (const h of r) {
    if (h.geomType === "plane") {
      y.push(h);
      continue;
    }
    c.set(h._identity(), d(w.get(h._identity()) ?? h.mesh(n.tolerance, n.angleDeg))), u(h);
  }
  const p = w.size;
  let g = 0;
  for (const h of y) {
    const m = Jr(h, a, c), b = h.normalAt(), P = [b.x, b.y, b.z], S = Math.abs(P[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], M = tt(Ee(S, P)), E = Ee(P, M);
    let x = null;
    if (m && m.length === h.wires().length) {
      const v = [...new Set(m.flat())], T = new Map(v.map((R, C) => [R, C])), I = new Float64Array(2 * v.length);
      v.forEach((R, C) => {
        const O = a.positions;
        I[2 * C] = O[3 * R] * M[0] + O[3 * R + 1] * M[1] + O[3 * R + 2] * M[2], I[2 * C + 1] = O[3 * R] * E[0] + O[3 * R + 1] * E[1] + O[3 * R + 2] * E[2];
      });
      const D = Vr(I, m.map((R) => R.map((C) => T.get(C))));
      D && (x = D.map((R) => v[R]));
    }
    x ? s.push(...x) : (g++, d(h.mesh(n.tolerance, n.angleDeg))), u(h);
  }
  return { positions: a.positions, indices: s, planar: y.length - g, planarFallbacks: g, bands: p, ...i ? { faceOf: i } : {} };
}
const Yr = (e, t) => `${Math.round(e.x * 1e6)},${Math.round(e.y * 1e6)},${Math.round(e.z * 1e6)},${Math.round(t * 1e6)}`, ve = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], $e = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]];
function Zr(e, t) {
  const n = /* @__PURE__ */ new Map();
  for (const r of e) {
    const a = r.geomType;
    if (a !== "cylinder" && a !== "cone" && a !== "torus" && a !== "revolution")
      continue;
    const s = [...r.edges()], i = r._identity();
    if (s.length !== 2)
      continue;
    const f = [], l = [], u = [];
    for (const d of s) {
      if (d.geomType !== "circle" || !d.isClosed)
        break;
      const y = [...d.faces()].filter((h) => h._identity() !== i);
      if (y.length !== 1)
        break;
      const w = d.arcCenter, p = d.normal, g = d.radius;
      if (!(g > 0))
        break;
      f.push({ center: [w.x, w.y, w.z], radius: g, normal: tt([p.x, p.y, p.z]) }), l.push(Yr(w, g)), u.push(y[0]);
    }
    if (f.length !== 2 || l[0] === l[1] || Math.abs(ve(f[0].normal, f[1].normal)) < 1 - 1e-9)
      continue;
    let c;
    try {
      c = [0.5, 0.1, 0.25, 0.4, 0.6, 0.75, 0.9].map((d) => {
        const y = r.positionAt(d, d);
        return [y.x, y.y, y.z];
      });
    } catch {
      continue;
    }
    n.set(i, { face: r, id: i, keys: l, others: u, circles: f, samples: c });
  }
  const o = /* @__PURE__ */ new Map();
  for (; ; ) {
    for (let f = !0; f; ) {
      f = !1;
      for (const [l, u] of n)
        u.others.some((c) => c.geomType !== "plane" && !n.has(c._identity())) && (n.delete(l), f = !0);
    }
    const r = /* @__PURE__ */ new Map(), a = (f) => {
      let l = r.get(f) ?? f;
      for (; l !== (r.get(l) ?? l); )
        l = r.get(l);
      return r.set(f, l), l;
    };
    for (const f of n.values()) {
      const l = a(f.keys[0]), u = a(f.keys[1]);
      l !== u && r.set(l, u);
    }
    const s = /* @__PURE__ */ new Map();
    for (const f of n.values()) {
      const l = a(f.keys[0]), u = s.get(l);
      u ? u.push(f) : s.set(l, [f]);
    }
    const i = [];
    o.clear();
    for (const f of s.values()) {
      const l = Qr(f, t);
      if (l)
        for (const [u, c] of l)
          o.set(u, c);
      else
        i.push(...f.map((u) => u.id));
    }
    if (!i.length)
      return o;
    for (const f of i)
      n.delete(f);
  }
}
function Qr(e, t) {
  const n = e[0].circles[0].center, o = e[0].circles[0].normal, r = Math.max(1, ...e.flatMap((g) => g.circles.map((h) => h.radius))), a = (g) => {
    const h = $e(g, n), m = ve(h, o);
    return [Math.hypot(h[0] - m * o[0], h[1] - m * o[1], h[2] - m * o[2]), m];
  }, s = t.angleDeg * Math.PI / 180, i = /* @__PURE__ */ new Map();
  for (const g of e) {
    for (const B of g.circles) {
      if (Math.abs(ve(B.normal, o)) < 1 - 1e-9)
        return;
      const F = $e(B.center, n), L = ve(F, o);
      if (Math.hypot(F[0] - L * o[0], F[1] - L * o[1], F[2] - L * o[2]) > 1e-7 * r)
        return;
    }
    const [h, m] = [g.circles[0].radius, ve($e(g.circles[0].center, n), o)], [b, P] = [g.circles[1].radius, ve($e(g.circles[1].center, n), o)], S = 1e-6 * r, M = g.samples.map(a), [E, x] = M[0];
    let v;
    const T = b - h, I = P - m, D = E - h, R = x - m, C = 2 * (T * R - I * D), O = Math.hypot(T, I);
    if (!(O > S))
      return;
    const W = Math.abs(C) / O <= 2 * S;
    if (W || g.face.geomType === "cylinder" || g.face.geomType === "cone") {
      if (!W)
        return;
      for (const [B, F] of M)
        if (Math.abs((B - h) * I - (F - m) * T) / O > S)
          return;
      if (g.face.geomType === "cylinder" && (Math.abs(h - b) > S || Math.abs(g.face.radius - h) > S))
        return;
      v = [[h, m], [b, P]];
    } else {
      const B = T * T + I * I, F = D * D + R * R, L = (R * B - I * F) / C, ge = (T * F - D * B) / C, nt = h + L, ot = m + ge, Te = Math.hypot(L, ge);
      if (!(Te > S) || !Number.isFinite(Te))
        return;
      for (const [ae, ee] of M)
        if (Math.abs(Math.hypot(ae - nt, ee - ot) - Te) > S)
          return;
      const Re = (ae, ee) => Math.atan2(ee - ot, ae - nt), Xe = (ae) => (ae % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), Ae = Re(h, m);
      let ye = Xe(Re(b, P) - Ae);
      Xe(Re(E, x) - Ae) > ye && (ye -= 2 * Math.PI);
      for (const [ae, ee] of M)
        if ((ye > 0 ? Xe(Re(ae, ee) - Ae) : Xe(Ae - Re(ae, ee))) > Math.abs(ye) + 1e-9)
          return;
      const An = Math.min(s, 2 * Math.acos(Math.max(-1, 1 - t.tolerance / Te))), We = Math.max(1, Math.ceil(Math.abs(ye) / An - 1e-9));
      v = Array.from({ length: We + 1 }, (ae, ee) => ee === 0 ? [h, m] : ee === We ? [b, P] : [nt + Te * Math.cos(Ae + ye * ee / We), ot + Te * Math.sin(Ae + ye * ee / We)]);
    }
    if (v.some(([B]) => !(B > S)))
      return;
    i.set(g.id, v);
  }
  const f = [...i.values()].flat().map(([g]) => g), l = Math.max(8, Math.ceil(360 / t.angleDeg - 1e-9), ...f.map((g) => Math.ceil(Math.PI / Math.max(Math.acos(Math.max(-1, 1 - t.tolerance / g)), 1e-9))));
  if (l > 4096)
    return;
  const u = Math.abs(o[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], c = tt(Ee(u, o)), d = Ee(o, c), y = Array.from({ length: l }, (g, h) => Math.cos(2 * Math.PI * h / l)), w = Array.from({ length: l }, (g, h) => Math.sin(2 * Math.PI * h / l)), p = /* @__PURE__ */ new Map();
  for (const g of e) {
    const h = i.get(g.id), m = new Float64Array(3 * l * h.length);
    h.forEach(([O, W], B) => {
      for (let F = 0; F < l; F++)
        for (let L = 0; L < 3; L++)
          m[3 * (B * l + F) + L] = n[L] + W * o[L] + O * (y[F] * c[L] + w[F] * d[L]);
    });
    const b = Math.floor((h.length - 1) / 2), P = b * l, S = P + 1, M = P + l + 1, E = (O) => [m[3 * O], m[3 * O + 1], m[3 * O + 2]], x = E(P), v = E(S), T = E(M), I = [0, 1, 2].map((O) => (x[O] + v[O] + T[O]) / 3);
    let D;
    try {
      D = g.face.normalAt(I);
    } catch {
      return;
    }
    const R = ve(Ee($e(v, x), $e(T, x)), [D.x, D.y, D.z]);
    if (!R)
      return;
    const C = new Uint32Array(6 * l * (h.length - 1));
    for (let O = 0; O + 1 < h.length; O++)
      for (let W = 0; W < l; W++) {
        const B = O * l + W, F = O * l + (W + 1) % l, L = B + l, ge = F + l;
        C.set(R > 0 ? [B, F, ge, B, ge, L] : [B, ge, F, B, L, ge], 6 * (O * l + W));
      }
    p.set(g.id, { vertices: m, triangles: C });
  }
  return p;
}
const Ee = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], tt = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return e.map((n) => n / t);
};
function Jr(e, t, n) {
  const o = e._identity(), r = e.normalAt(), a = /* @__PURE__ */ new Set(), s = t.positions;
  let i;
  const f = /* @__PURE__ */ new Set();
  for (const S of e.edges()) {
    const M = [...S.faces()].filter((x) => x._identity() !== o);
    if (M.length !== 1)
      return;
    const E = M[0];
    if (E.geomType === "plane") {
      if (!(S._isStraight ? S._isStraight() : S.geomType === "line"))
        return;
      const x = S.start, v = S.end, T = t.add(x.x, x.y, x.z), I = t.add(v.x, v.y, v.z);
      i ?? (i = r.x * x.x + r.y * x.y + r.z * x.z), T !== I && a.add(T < I ? `${T},${I}` : `${I},${T}`);
    } else if (f.add(E._identity()), i === void 0) {
      const x = S.start;
      i = r.x * x.x + r.y * x.y + r.z * x.z;
    }
  }
  if (i === void 0)
    return;
  const l = 2e-5 + 1e-9 * Math.abs(i), u = (S) => Math.abs(r.x * s[3 * S] + r.y * s[3 * S + 1] + r.z * s[3 * S + 2] - i) <= l;
  for (const S of f) {
    const M = n.get(S);
    if (!M)
      return;
    for (const [E, x] of M)
      u(E) && u(x) && a.add(E < x ? `${E},${x}` : `${x},${E}`);
  }
  const c = /* @__PURE__ */ new Map();
  for (const S of a) {
    const [M, E] = S.split(",").map(Number);
    for (const [x, v] of [[M, E], [E, M]]) {
      const T = c.get(x);
      T ? T.push(v) : c.set(x, [v]);
    }
  }
  for (const S of c.values())
    if (S.length !== 2)
      return;
  const d = [], y = /* @__PURE__ */ new Set();
  for (const S of c.keys()) {
    if (y.has(S))
      continue;
    const M = [S];
    y.add(S);
    let E = S, x = c.get(S)[0];
    for (; x !== S; ) {
      if (y.has(x))
        return;
      M.push(x), y.add(x);
      const [v, T] = c.get(x), I = v === E ? T : v;
      E = x, x = I;
    }
    if (M.length < 3)
      return;
    d.push(M);
  }
  const w = Math.abs(r.x) < 0.9 ? [1, 0, 0] : [0, 1, 0], p = [r.x, r.y, r.z], g = tt(Ee(w, p)), h = Ee(p, g), m = (S) => {
    let M = 0;
    for (let E = 0, x = S.length - 1; E < S.length; x = E++) {
      const v = S[x], T = S[E], I = s[3 * v] * g[0] + s[3 * v + 1] * g[1] + s[3 * v + 2] * g[2], D = s[3 * v] * h[0] + s[3 * v + 1] * h[1] + s[3 * v + 2] * h[2], R = s[3 * T] * g[0] + s[3 * T + 1] * g[1] + s[3 * T + 2] * g[2], C = s[3 * T] * h[0] + s[3 * T + 1] * h[1] + s[3 * T + 2] * h[2];
      M += I * C - R * D;
    }
    return Math.abs(M);
  }, b = d.map(m), P = b.indexOf(Math.max(...b));
  return [d[P], ...d.filter((S, M) => M !== P)];
}
const at = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function Ht(e, t) {
  const n = [], o = [], r = new Ue(), a = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < a.length; i++) {
    const f = Math.round(e.positions[3 * i] * 1e6), l = Math.round(e.positions[3 * i + 1] * 1e6), u = Math.round(e.positions[3 * i + 2] * 1e6);
    let c = r.get(f, l, u);
    c === void 0 && (c = n.length / 3, r.set(f, l, u, c), n.push(at(e.positions[3 * i]), at(e.positions[3 * i + 1]), at(e.positions[3 * i + 2]))), a[i] = c;
  }
  const s = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.indices.length; i += 3) {
    const f = a[e.indices[i]], l = a[e.indices[i + 1]], u = a[e.indices[i + 2]];
    if (!(f === l || l === u || u === f)) {
      o.push(f, l, u);
      for (const c of [me(f, l), me(l, u), me(u, f)])
        s.set(c, (s.get(c) ?? 0) + 1);
    }
  }
  for (const [i, f] of s) {
    const l = Math.floor(i / 67108864), u = i - l * 67108864;
    if (f !== 1 || s.get(me(u, l)) !== 1)
      throw new A("kernel-failure", N`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > Rn || o.length > Cn)
    throw new A("unsupported", N`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (o.length < 12)
    throw new A("kernel-failure", N`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: o };
}
function En(e, t, n, o = On) {
  if (Kr(t))
    for (const r of [!0, !1])
      try {
        const a = dt(e, t, { ...o, bands: r });
        if (!a)
          break;
        if (a.bands && a.planarFallbacks)
          continue;
        return Ht(a, n);
      } catch (a) {
        if (a instanceof A && a.code === "unsupported")
          throw a;
      }
  return Ht(e.tessellate(t, o), n);
}
function qr(e, t, n, o = {}) {
  const r = t.nodes[n];
  if (r?.kind !== "exact-feature")
    throw new A("invalid-input", N`${n} is not an exact feature`);
  const a = ht(e, t, n, { local: !0, limits: o.limits, breps: o.breps });
  if (!e.isValid(a))
    throw new A("kernel-failure", N`${r.name}: the exact result is not a valid closed solid.`);
  const s = En(e, a, r.name);
  return { display: { sourceKey: Dn(t, n), ...s }, volume: e.volume(a) };
}
const Xt = 1e-7, Wt = 1e-6, es = (e) => e && e.length === 3 && e.every((t) => Number.isFinite(t)) ? "#" + e.map((t) => Math.round(Math.min(1, Math.max(0, t)) * 255).toString(16).padStart(2, "0")).join("") : null, kt = (e, t) => Math.abs(e - t) / Math.max(Math.abs(t), 1e-12), jt = (e) => [e[0], e[1], e[2]], ts = (e) => e?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "";
function Sn(e) {
  if (!(e instanceof A))
    return e;
  const t = e.message;
  let n, o;
  return /^This is not a STEP file/.test(t) ? o = N("This is not a STEP file: it does not start with ISO-10303-21.") : /^The STEP file is incomplete/.test(t) ? o = N("The STEP file is incomplete: it does not end with END-ISO-10303-21; (was it cut short?).") : /^STEP input must not be empty/.test(t) ? o = N("The STEP file is empty.") : /^The STEP file holds no solid/.test(t) ? o = N("The STEP file holds no solid (no B-rep body).") : (n = /^The STEP file is malformed: ([\s\S]*)$/.exec(t)) ? o = N`The STEP file is malformed: ${n[1]}` : (n = /^The STEP file cannot be read exactly: ([\s\S]*)$/.exec(t)) ? o = N`The STEP file cannot be read exactly, so nothing was imported: ${n[1]}` : (n = /^The STEP file's (.*) is an open surface \(a sheet\), not a closed solid\.$/.exec(t)) ? o = N`The STEP file's ${n[1]} is an open surface (a sheet), not a closed solid, so nothing was imported.` : (n = /^The STEP file's (.*) is not a valid closed solid, even after repair\.$/.exec(t)) ? o = N`The STEP file's ${n[1]} is not a valid closed solid, even after repair, so nothing was imported.` : (n = /^The STEP file holds (\d+) bodies; at most (\d+) can be imported\.$/.exec(t)) && (o = N`The STEP file holds ${n[1]} bodies; at most ${n[2]} can be imported at once.`), o ? new A(e.code, o, { cause: e }) : e;
}
function ns(e, t, n, o) {
  if (!(t instanceof Uint8Array) || !t.byteLength)
    throw new A("invalid-input", N("The STEP file is empty."));
  if (t.byteLength > Ze)
    throw new A("unsupported", N`The STEP file is larger than ${Ze / 1048576} MiB.`);
  let r;
  o?.({ phase: "read", done: 0, total: 1 });
  try {
    r = e.importStepBodies(t, { maxBodies: rn });
  } catch (f) {
    throw Sn(f);
  }
  const a = n.replace(/\.(step|stp)$/i, "") || "STEP body", s = r.bodies.length, i = r.bodies.map(({ solid: f, name: l, color: u, occurrence: c }, d) => {
    o?.({ phase: "body", done: d, total: s });
    const y = ts(l) || (s > 1 ? `${a} ${d + 1}` : a);
    return { name: y, occurrence: c ? c.map((w) => ({ product: w.product, instance: w.instance })) : null, color: es(u), body: os(e, f, y) };
  });
  return o?.({ phase: "body", done: s, total: s }), { bodies: i, notes: r.notes };
}
function os(e, t, n) {
  const o = e.volume(t), r = e.area(t), a = e.bbox(t), s = e.exportStep(t);
  if (s.length > wt)
    throw new A("unsupported", N`${n}: its exact B-rep is larger than ${wt / 1048576} MiB as STEP, so it cannot be stored in the model.`);
  return { brep: { format: "step", text: s }, measures: { volume: o, area: r, min: jt(a.min), max: jt(a.max) }, display: En(e, t, n, zn) };
}
function rs(e, t, n) {
  const o = e.importStepBodies(t.brep.text, { maxBodies: 1 });
  if (o.bodies.length !== 1)
    throw new A("kernel-failure", N`${n}: the stored exact B-rep does not hold exactly one solid.`);
  const r = o.bodies[0].solid, a = e.bbox(r), s = t.measures;
  if (kt(e.volume(r), s.volume) > Xt || kt(e.area(r), s.area) > Xt || [0, 1, 2].some((i) => Math.abs(a.min[i] - s.min[i]) > Wt || Math.abs(a.max[i] - s.max[i]) > Wt))
    throw r.dispose(), new A("kernel-failure", N`${n}: its stored exact B-rep does not read back as it was imported (volume, area or box differ), so exact work on it is refused. Import the STEP file again.`);
  return r;
}
function Tn(e, t = 16) {
  const n = /* @__PURE__ */ new Map(), o = (a, s) => rs(e, a, s), r = (a) => `${Fn(a)}|${JSON.stringify(a.measures)}`;
  return {
    /** Read every exact body of `nodes` that is not cached yet. Call outside `k.scope`. The bodies of
     * this request are all kept (a 58-body STEP board measured with only 16 kept read 42 of them
     * twice); older ones are dropped down to `capacity`. */
    warm(a) {
      const s = /* @__PURE__ */ new Set();
      for (const i of a) {
        if (i.kind !== "exact-body")
          continue;
        const f = i, l = r(f), u = n.get(l);
        if (s.add(l), u) {
          n.delete(l), n.set(l, u);
          continue;
        }
        n.set(l, o(f, f.name));
      }
      for (const [i, f] of n) {
        if (n.size <= Math.max(t, s.size))
          break;
        s.has(i) || (n.delete(i), f.dispose());
      }
    },
    /** The cached solid, or one read now (owned by the caller's scope). */
    solid(a) {
      return n.get(r(a)) ?? o(a, a.name);
    },
    get size() {
      return n.size;
    },
    clear() {
      for (const a of n.values())
        a.dispose();
      n.clear();
    }
  };
}
class ze extends A {
  constructor(n, o) {
    super(n.code, n.message, o);
    J(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const Fe = (e) => {
  throw new A("unsupported", e);
};
function Gt(e, t, n) {
  if (!n?.some((r) => r !== 0))
    return vt([...t]), e.profile.polygon([t]);
  vt([...t], [...n]);
  const o = t.map((r, a) => {
    const s = t[(a + 1) % t.length], i = n[a] ?? 0;
    return i ? { kind: "arc", via: Zn(r, s, i), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], o);
}
const Vt = (e, t, n) => {
  const o = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(o, [t[0], t[1]]) : o;
};
function Kt(e, t, n) {
  const o = t.profile;
  switch (o.kind) {
    case "rectangle":
      return e.profile.rectangle(xe(o.width, n), xe(o.depth, n), !0);
    case "circle":
      return Vt(e, o.center ?? [0, 0], xe(o.radius, n));
    case "outline":
      return Gt(e, o.points, o.bulges);
    case "region": {
      Un(o.loops, (s) => xe(s, n));
      const r = (s) => s.kind === "circle" ? Vt(e, [xe(s.center[0], n), xe(s.center[1], n)], xe(s.radius, n)) : Gt(e, s.points, s.bulges), a = o.loops.map(r).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, i) => i.area - s.area);
      return e.profile.subtract(a[0].profile, ...a.slice(1).map((s) => s.profile));
    }
    case "path":
      return Fe("Close the sketch path before creating a solid.");
    default:
      return Fe(`Sketch profile '${o.kind}' has no exact lowering.`);
  }
}
function Ce(e, t, n) {
  let o = t;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((r, a) => {
    n[a] && (o = e.rotate(o, r, n[a]));
  }), o;
}
const ss = /* @__PURE__ */ new Set(["box", "cylinder", "sphere", "hole", "code", "extrusion", "revolution", "exact-body"]), as = (e, t, n) => e.nameFaces(t, e.topology(t).faces.map((o) => Jn(n, o.index))), is = (e, t, n, o) => e.nameFaces(t, e.topology(t).faces.map((r) => an(r.name) ? Qn(n, o, r.name) : null));
function cs(e, t) {
  try {
    const { copies: n, node: o, face: r } = Ln(t), a = N`${e.nodes[o]?.name ?? o} face ${r + 1}`;
    return n.length ? a + " (" + n.map(({ pattern: s, copy: i }) => N`copy ${i + 1} of ${e.nodes[s]?.name ?? s}`).join(", ") + ")" : a;
  } catch {
    return t;
  }
}
function ls(e, t, n, o) {
  return Bn(e.topology(n), o, (r) => cs(t, r));
}
function ue(e, t, n, o, r, a, s = !1, i) {
  const f = s ? "named:" + n : n, l = r.get(f);
  if (l)
    return l;
  const u = t.nodes[n];
  let c;
  try {
    switch (u.kind) {
      case "box":
        c = e.box(u.size);
        break;
      case "cylinder":
        c = e.cylinder(u.radius, u.height);
        break;
      case "sphere":
        c = e.sphere(u.radius);
        break;
      // A standard hole: the same profile Manifold revolves; SMLib makes its walls true cylinders and cones.
      case "hole":
        c = e.revolve(e.profile.polygon([Kn(u)]), 360);
        break;
      case "code": {
        const p = yt(e, on(u.program).shape);
        if (!p)
          throw new A("invalid-input", "Code produces no printable solid.");
        c = p;
        break;
      }
      case "extrusion": {
        const { distance: p, start: g, plane: h } = Vn(u, t);
        c = e.extrude(Kt(e, t.sketches[u.sketchId], t), p), g && (c = e.translate(c, [0, 0, g])), h === "XZ" ? c = Ce(e, c, [90, 0, 0]) : h === "YZ" && (c = Ce(e, c, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: p, angle: g, axisOffset: h } = Gn(u, t);
        let m = Kt(e, t.sketches[u.sketchId], t);
        h && (m = e.profile.translate(m, [-h, 0])), c = wn(e, m, g), p === "XY" ? c = Ce(e, c, [-90, 0, 0]) : p === "YZ" && (c = Ce(e, c, [0, 0, 90])), h && (c = e.translate(c, p === "YZ" ? [0, h, 0] : [h, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: p, offset: g } = jn(u, t), h = [0, 0, 0];
        if (h[p] = 1, c = e.mirror(ue(e, t, u.source, o, r, a, s, i), h), g) {
          const m = [0, 0, 0];
          m[p] = 2 * g, c = e.translate(c, m);
        }
        break;
      }
      case "split": {
        const { normal: p, offset: g } = kn(u, t), h = ue(e, t, u.source, o, r, a, s, i), m = () => new A("invalid-input", u.side === "positive" ? N("Nothing of the body lies on the + side of the split plane") : N("Nothing of the body lies on the − side of the split plane"));
        let b;
        try {
          b = e.splitByPlane(h, p, g);
        } catch (P) {
          throw P instanceof Error && /nothing of the part lies/i.test(P.message) ? m() : P;
        }
        if (c = u.side === "positive" ? b[0] : b[1], e.solidCount(c) < 1 || !(e.volume(c) > 1e-8))
          throw m();
        break;
      }
      case "pattern": {
        const p = Wn(u, t), g = ue(e, t, u.source, o, r, a, s, i), h = [g];
        if (p.mode === "linear")
          for (let m = 1; m < p.count; m++) {
            const b = [0, 0, 0];
            b[p.axis] = m * p.spacing, h.push(e.translate(g, b));
          }
        else {
          const m = p.sweep / (Math.abs(p.sweep) === 360 ? p.count : p.count - 1), b = [0, 0, 0];
          b[p.axis] = 1;
          for (let P = 1; P < p.count; P++)
            h.push(e.rotate(g, b, P * m, p.center));
        }
        s && h.forEach((m, b) => {
          h[b] = is(e, m, n, b);
        }), c = e.union(h[0], ...h.slice(1));
        break;
      }
      case "boolean": {
        const p = u.inputs.map((g) => ue(e, t, g, o, r, a, s, i));
        if (u.useHoleRoles) {
          const g = p.filter((b, P) => t.nodes[u.inputs[P]].role !== "hole"), h = p.filter((b, P) => t.nodes[u.inputs[P]].role === "hole");
          g.length || Fe("A combination of holes only has no solid to export.");
          const m = g.length > 1 ? e.union(g[0], ...g.slice(1)) : g[0];
          c = h.length ? e.subtract(m, ...h) : m;
        } else
          c = u.operation === "union" ? e.union(p[0], ...p.slice(1)) : u.operation === "subtract" ? e.subtract(p[0], ...p.slice(1)) : e.intersect(p[0], ...p.slice(1));
        break;
      }
      case "exact-feature": {
        const p = Hn(u, t), g = Xn(p.edges) ? p.edges.references : void 0, h = ue(e, t, u.source, o, r, a, s || !!g, i), m = g ? { edgeIndices: ls(e, t, h, g) } : p.edges;
        a && Xr(h, p.operation, m, a), c = p.operation === "fillet" ? e.fillet(h, p.size, m) : p.operation === "chamfer" ? e.chamfer(h, p.size, m) : e.shell(h, p.size, p.openFaces);
        break;
      }
      case "exact-body":
        c = i ? i.solid(u) : Tn(e, 0).solid(u);
        break;
      case "instance": {
        const p = t.nodes[u.source], g = (s ? "named:" : "") + "local:" + u.source;
        let h = r.get(g);
        if (!h) {
          const m = { ...t, nodes: { ...t.nodes, [p.id]: { ...p, transform: { ...sn(), scale: [...p.transform.scale] } } } };
          h = ue(e, m, p.id, o, /* @__PURE__ */ new Map(), a, s, i), r.set(g, h);
        }
        c = h;
        break;
      }
      case "mesh":
        return Fe(u.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return Fe(`'${u.kind}' has no exact lowering.`);
    }
    s && ss.has(u.kind) && (c = as(e, c, n));
    const { scale: d, rotation: y, position: w } = u.transform;
    d.some((p) => p !== 1) && (c = e.scale(c, d)), c = Ce(e, c, y), w.some((p) => p !== 0) && (c = e.translate(c, w));
  } catch (d) {
    if (d instanceof ze)
      throw d;
    const y = d instanceof A ? d.code : "invalid-input";
    if (d instanceof Yn)
      throw new ze({ code: "invalid-input", bodyId: o, nodeId: n, feature: u.kind, reason: d.code, message: `${u.name}: ${d.message}` }, { cause: d });
    let w = d instanceof Error ? d.message : String(d);
    const p = /the kernel did not finish within ([\d.]+) s/.exec(w);
    throw p && (w = N`The exact kernel stopped this step at its own ${p[1]} s limit, so it was not built. The model was not changed. Try a simpler body.`), new ze({ code: y, bodyId: o, nodeId: n, feature: u.kind, message: `${u.name} (${u.kind}): ${w}` }, { cause: d });
  }
  return r.set(f, c), c;
}
function xt(e, t, n, o = {}) {
  if (!t.roots.includes(n))
    throw new A("invalid-input", `${n} is not a top-level body.`);
  return ue(e, t, n, n, /* @__PURE__ */ new Map(), o.limits, !!o.named, o.breps);
}
function ht(e, t, n, o = {}) {
  const r = t.nodes[n];
  if (!r)
    throw new A("invalid-input", `${n} is not a node of this model.`);
  const a = o.local ? { ...t, nodes: { ...t.nodes, [n]: { ...r, transform: sn() } } } : t, s = t.roots.find((i) => i === n) ?? n;
  return ue(e, a, n, s, /* @__PURE__ */ new Map(), o.limits, o.named, o.breps);
}
const Yt = 2e3, Zt = 6e3, pt = 4e5;
function fs(e) {
  const t = Math.hypot(...e.max.map((n, o) => n - e.min[o]));
  return Math.min(0.05, Math.max(0.01, t * 2e-4));
}
const us = (e) => e.flatMap((t) => [t[0], t[1], t[2]]);
function ds(e, t, n, o, r = { triangles: pt }) {
  const a = e.topology(t);
  if (a.faces.length > Yt || a.edges.length > Zt)
    throw new A("unsupported", N`${o} has ${a.faces.length} faces and ${a.edges.length} edges, more than an exact drawing takes (${Yt} and ${Zt}).`);
  const s = e.bbox(t), i = { min: [...s.min], max: [...s.max] }, f = fs(i);
  let l = dt(e, t, { tolerance: f, angleDeg: 10, faces: !0 });
  if (l?.bands && l.planarFallbacks && (l = dt(e, t, { tolerance: f, angleDeg: 10, bands: !1, faces: !0 })), !l?.faceOf)
    throw new A("unsupported", N`${o}: the exact kernel did not mesh the body face by face.`);
  const u = l.indices.length / 3;
  if (u > r.triangles)
    throw new A("unsupported", N`${o}: the exact drawing would need more than ${pt} triangles.`);
  return r.triangles -= u, {
    id: n,
    name: o,
    tolerance: f,
    bounds: i,
    faces: a.faces.map((c) => ({
      surface: c.surface,
      ...c.name ? { name: c.name } : {},
      point: [...c.point],
      normal: [...c.normal],
      ...c.radius !== void 0 ? { radius: c.radius } : {},
      ...c.axis ? { axis: { origin: [...c.axis.origin], direction: [...c.axis.direction] } } : {}
    })),
    edges: a.edges.map((c) => ({
      curve: c.curve,
      faces: [...c.faces],
      points: us(c.points),
      closed: c.closed,
      length: c.length,
      ...c.curve === "circle" && c.radius !== void 0 && c.center && c.axis ? { circle: { center: [...c.center], radius: c.radius, axis: [...c.axis] } } : {}
    })),
    mesh: { positions: Float64Array.from(l.positions), indices: Uint32Array.from(l.indices), faceOf: Uint32Array.from(l.faceOf) }
  };
}
function hs(e, t, n, o) {
  const r = [], a = [], s = { triangles: pt };
  for (const i of n) {
    const f = t.nodes[i].name;
    try {
      r.push(e.scope(() => {
        const l = xt(e, t, i, { limits: o.limits, breps: o.breps, named: !0 });
        if (!e.isValid(l))
          throw new A("kernel-failure", N`${f}: the exact result is not a valid closed solid.`);
        return ds(e, l, i, f, s);
      }));
    } catch (l) {
      if (o.fatal(l))
        throw l;
      const u = l instanceof ze ? l.diagnostic.code : l instanceof A ? l.code : "kernel-failure";
      a.push({ id: i, name: f, code: u, message: l instanceof Error ? l.message : String(l) });
    }
  }
  return { bodies: r, failures: a };
}
const ps = 5, Qt = 4e3, Jt = (e) => ({
  surface: e.surface,
  point: [...e.point],
  normal: [...e.normal],
  ...e.radius !== void 0 ? { radius: e.radius } : {},
  ...e.axis ? { axis: { origin: [...e.axis.origin], direction: [...e.axis.direction] } } : {}
});
function ms(e, t, n, o) {
  const r = e.bbox(t), a = r.max[n] - r.min[n], s = Math.max(1e-9, a * 1e-12);
  if (!(o > r.min[n] + s && o < r.max[n] - s))
    return [];
  const i = [n === 0 ? 1 : 0, n === 1 ? 1 : 0, 0];
  let f;
  try {
    f = e.splitByPlane(t, i, o);
  } catch (d) {
    if (d instanceof A && /nothing of the part lies/.test(d.message))
      return [];
    throw d;
  }
  const l = e.topology(f[0]), u = new Set(l.faces.filter((d) => d.surface === "plane" && d.normal[n] < -1 + 1e-9 && Math.abs(d.point[n] - o) <= Math.max(1e-7, Math.abs(o) * 1e-12)).map((d) => d.index));
  if (!u.size)
    return [];
  const c = l.edges.filter((d) => d.faces.some((y) => u.has(y)) && !d.faces.every((y) => u.has(y)));
  if (c.length > Qt)
    throw new A("unsupported", N`The section's cut face has ${c.length} edges, more than ${Qt}.`);
  return c.map((d) => {
    const y = d.faces.find((g) => u.has(g)), w = d.faces.find((g) => !u.has(g)), p = [Jt(l.faces[y]), ...w !== void 0 ? [Jt(l.faces[w])] : []];
    return {
      curve: d.curve,
      faces: p.map((g, h) => h),
      points: d.points.flatMap((g) => [g[0], g[1], g[2]]),
      closed: d.closed,
      length: d.length,
      surfaces: p,
      ...d.curve === "circle" && d.radius !== void 0 && d.center && d.axis ? { circle: { center: [...d.center], radius: d.radius, axis: [...d.axis] } } : {}
    };
  });
}
function gs(e, t, n, o, r) {
  if (o.axis !== 0 && o.axis !== 1 || !Array.isArray(o.positions) || !o.positions.length || o.positions.length > ps || !o.positions.every((i) => typeof i == "number" && Number.isFinite(i) && Math.abs(i) <= 1e5))
    throw new A("invalid-input", N("Give the section axis and up to five cut positions."));
  const a = [], s = [];
  for (const i of n) {
    const f = t.nodes[i].name;
    try {
      a.push(e.scope(() => {
        const l = xt(e, t, i, { limits: r.limits, breps: r.breps });
        if (!e.isValid(l))
          throw new A("kernel-failure", N`${f}: the exact result is not a valid closed solid.`);
        return { id: i, name: f, legs: o.positions.map((u) => ms(e, l, o.axis, u)) };
      }));
    } catch (l) {
      if (r.fatal(l))
        throw l;
      const u = l instanceof ze ? l.diagnostic.code : l instanceof A ? l.code : "kernel-failure";
      s.push({ id: i, name: f, code: u, message: l instanceof Error ? l.message : String(l) });
    }
  }
  return { axis: o.axis, positions: [...o.positions], bodies: a, failures: s };
}
const ys = (e) => e && e.length === 3 && e.every((t) => Number.isFinite(t)) ? "#" + e.map((t) => Math.round(Math.min(1, Math.max(0, t)) * 255).toString(16).padStart(2, "0")).join("") : null, xs = (e) => e?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "";
function qt(e, t, n) {
  if (!(t instanceof Uint8Array) || !t.byteLength)
    throw new A("invalid-input", N("The STEP file is empty."));
  if (t.byteLength > Ze)
    throw new A("unsupported", N`The STEP file is larger than ${Ze / 1048576} MiB.`);
  let o;
  try {
    o = e.importStepBodies(t, { maxBodies: rn });
  } catch (i) {
    throw Sn(i);
  }
  const r = n.replace(/\.(step|stp)$/i, "") || "STEP body", a = o.bodies.map(({ solid: i, name: f, color: l }, u) => {
    var g, h;
    const c = e.topology(i), d = e.bbox(i), y = e.massProperties(i), w = {}, p = {};
    for (const m of c.faces) {
      const b = w[g = m.surface] ?? (w[g] = { count: 0, areaMm2: 0 });
      b.count++, b.areaMm2 += m.area;
    }
    for (const m of c.edges) {
      const b = p[h = m.curve] ?? (p[h] = { count: 0, lengthMm: 0 });
      b.count++, b.lengthMm += m.length;
    }
    return {
      name: xs(f) || (o.bodies.length > 1 ? `${r} ${u + 1}` : r),
      color: ys(l),
      valid: e.isValid(i),
      solids: e.solidCount(i),
      volumeMm3: e.volume(i),
      areaMm2: e.area(i),
      bounds: { min: [...d.min], max: [...d.max] },
      centroid: [...y.centroid],
      principalMoments: [...y.principalMoments].sort((m, b) => m - b),
      faces: { total: c.faces.length, bySurface: w, smallestMm2: c.faces.length ? Math.min(...c.faces.map((m) => m.area)) : 0 },
      edges: {
        total: c.edges.length,
        byCurve: p,
        closed: c.edges.filter((m) => m.closed).length,
        free: c.edges.filter((m) => m.faces.length !== 2).length,
        shortestMm: c.edges.length ? Math.min(...c.edges.map((m) => m.length)) : 0
      }
    };
  }), s = new TextDecoder("latin1").decode(t.subarray(0, 64 * 1024));
  return {
    version: oo,
    file: { name: n, bytes: t.byteLength, sha256: cn(t), header: ro(s) },
    bodies: a,
    notes: [...o.notes],
    totals: { volumeMm3: a.reduce((i, f) => i + f.volumeMm3, 0), areaMm2: a.reduce((i, f) => i + f.areaMm2, 0), faces: a.reduce((i, f) => i + f.faces.total, 0), edges: a.reduce((i, f) => i + f.edges.total, 0) },
    disclaimer: N("Evidence from the exact kernel’s reading of the file: measures and topology as read, not a certificate of the design or of the exporting system.")
  };
}
const de = 64, ws = 64 * 1024 * 1024, en = 5e3;
function vs(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const o of n) {
      if (!e.roots.includes(o))
        throw new A("invalid-input", N`Unknown object id: ${o}`);
      const r = e.nodes[o];
      if (r.reference)
        throw new A("invalid-input", N`${r.name} is a reference body and is never exported or measured.`);
      if (r.role === "hole")
        throw new A("invalid-input", N`${r.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = to(e).filter((o) => !e.nodes[o].reference && e.nodes[o].role !== "hole");
  if (!n.length)
    throw new A("invalid-input", N("The design has no solid bodies to export"));
  if (n.length > de)
    throw new A("invalid-input", N`Exact commands are limited to ${de} bodies.`);
  return n;
}
function Ge(e, t) {
  const n = /* @__PURE__ */ new Set(), o = (r) => {
    n.has(r) || (n.add(r), no(e.nodes[r]).forEach(o));
  };
  return t.forEach(o), [...n].map((r) => e.nodes[r]);
}
const Ms = (e) => [1, 3, 5].map((t) => parseInt(e.slice(t, t + 2), 16) / 255), bs = (e) => e.length > 0 && e.length <= 1e3 && ![...e].some((t) => t.charCodeAt(0) < 32 || t.charCodeAt(0) === 127);
function Es(e, t = e.maxMemoryBytes) {
  const n = Object.freeze({ ...Sr, smlib: e.version, licence: e.licence }), o = Tn(e), r = (s, i) => {
    const f = ke(s), l = vs(f, i);
    return o.warm(Ge(f, l)), { doc: f, targets: l };
  }, a = ({ doc: s, targets: i }, f = {}) => ({ doc: s, targets: i, solids: i.map((l) => {
    const u = xt(e, s, l, { ...f, breps: o });
    if (!e.isValid(u))
      throw new A("kernel-failure", N`${s.nodes[l].name}: the exact result is not a valid closed solid.`);
    return u;
  }) });
  return {
    kernel: e,
    info: n,
    ...t ? { memoryCapBytes: t } : {},
    measure(s, i, f) {
      const l = r(s, i);
      return e.scope(() => {
        const { doc: u, targets: c, solids: d } = a(l, f);
        return { kernel: n, bodies: d.map((y, w) => {
          const p = e.bbox(y), g = e.massProperties(y);
          return { id: c[w], name: u.nodes[c[w]].name, volume: e.volume(y), area: e.area(y), bounds: { min: [...p.min], max: [...p.max] }, centroid: [...g.centroid], solids: e.solidCount(y) };
        }) };
      });
    },
    edges(s, i, f = {}) {
      const l = ke(s), u = [...new Set(i)];
      if (!u.length)
        throw new A("invalid-input", N("Name or select the bodies whose edges to list."));
      if (u.length > de)
        throw new A("invalid-input", N`Exact commands are limited to ${de} bodies.`);
      for (const c of u)
        if (!l.nodes[c] || !l.roots.includes(c) && !Object.values(l.nodes).some((d) => d.kind === "exact-feature" && d.source === c))
          throw new A("invalid-input", N`Unknown object id: ${c}`);
      return o.warm(Ge(l, u)), { kernel: n, bodies: u.map((c) => e.scope(() => {
        const d = ht(e, l, c, { named: !0, limits: f.limits, breps: o }), y = e.topology(d);
        if (y.edges.length > en)
          throw new A("unsupported", N`${l.nodes[c].name} has ${y.edges.length} edges, more than ${en} can be listed. Fillet every edge or a face instead.`);
        const w = eo(y);
        return { id: c, name: l.nodes[c].name, edges: y.edges.map((p, g) => {
          const h = w[g];
          return { number: g + 1, curve: p.curve, length: p.length, points: p.points.map((m) => [...m]), ...h.reference ? { reference: h.reference } : { unreferable: h.reason } };
        }) };
      })) };
    },
    featureDisplays(s, i, f = {}) {
      const l = ke(s), u = i?.length ? [...new Set(i)] : qn(l);
      if (u.length > de)
        throw new A("invalid-input", N`Exact commands are limited to ${de} bodies.`);
      for (const c of u)
        if (l.nodes[c]?.kind !== "exact-feature")
          throw new A("invalid-input", N`${c} is not an exact feature`);
      return o.warm(Ge(l, u)), { kernel: n, features: u.map((c) => e.scope(() => ({ id: c, name: l.nodes[c].name, ...qr(e, l, c, { ...f, breps: o }) }))) };
    },
    drawing(s, i, f = {}) {
      const { doc: l, targets: u } = r(s, i);
      return { kernel: n, ...hs(e, l, u, { limits: f.limits, breps: o, fatal: tn }) };
    },
    section(s, i, f, l = {}) {
      const { doc: u, targets: c } = r(s, i);
      return { kernel: n, ...gs(e, u, c, f, { limits: l.limits, breps: o, fatal: tn }) };
    },
    faces(s, i, f = {}) {
      const l = ke(s), u = [...new Set(i)];
      if (!u.length)
        throw new A("invalid-input", N("Name or select the bodies whose faces to list."));
      if (u.length > de)
        throw new A("invalid-input", N`Exact commands are limited to ${de} bodies.`);
      for (const c of u)
        if (!l.roots.includes(c))
          throw new A("invalid-input", N`Unknown object id: ${c}`);
      return o.warm(Ge(l, u)), { kernel: n, bodies: u.map((c) => e.scope(() => {
        const d = ht(e, l, c, { named: !0, limits: f.limits, breps: o }), y = /* @__PURE__ */ new Map();
        let w = 0;
        for (const p of e.topology(d).faces) {
          if (!p.name || !an(p.name)) {
            w++;
            continue;
          }
          const g = y.get(p.name), h = { name: p.name, surface: p.surface, area: p.area, point: [...p.point], normal: [...p.normal], ...p.radius !== void 0 ? { radius: p.radius } : {}, ...p.axis ? { axis: { origin: [...p.axis.origin], direction: [...p.axis.direction] } } : {} };
          g ? y.set(p.name, { ...h.area > g.area ? h : g, area: g.area + h.area }) : y.set(p.name, h);
        }
        return { id: c, name: l.nodes[c].name, faces: [...y.values()], unnamed: w };
      })) };
    },
    importStep(s, i, f = {}) {
      const l = f.limits?.maxStepImportBytes;
      if (l !== void 0 && s.byteLength > l)
        throw new A("unsupported", N`${i} is ${(s.byteLength / 1048576).toFixed(1)} MiB; this device imports STEP files of up to ${Math.round(l / 1048576)} MiB. Import it on a computer, or split the assembly.`);
      return { kernel: n, ...e.scope(() => ns(e, s, i, f.progress)) };
    },
    stepEvidence(s, i = {}) {
      if ("bytes" in s) {
        const h = i.limits?.maxStepImportBytes;
        if (h !== void 0 && s.bytes.byteLength > h)
          throw new A("unsupported", N`${s.file} is ${(s.bytes.byteLength / 1048576).toFixed(1)} MiB; this device reads STEP files of up to ${Math.round(h / 1048576)} MiB.`);
        return { kernel: n, evidence: e.scope(() => qt(e, s.bytes, s.file)) };
      }
      const f = this.measure(s.doc, s.ids, i), l = f.bodies.map((h) => {
        const m = this.exportStep(s.doc, [h.id], i).step, b = new TextEncoder().encode(m);
        return { id: h.id, bytes: b, evidence: e.scope(() => qt(e, b, h.name + ".step")) };
      });
      for (const h of l)
        if (h.evidence.bodies.length !== 1)
          throw new A("kernel-failure", N`The STEP file read back with ${h.evidence.bodies.length} bodies instead of ${1}.`);
      const u = (s.doc.title.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "-").trim().slice(0, 230) || "design") + ".step", c = new Uint8Array(l.reduce((h, m) => h + m.bytes.byteLength, 0));
      let d = 0;
      for (const h of l)
        c.set(h.bytes, d), d += h.bytes.byteLength;
      const y = l.map((h) => h.evidence.bodies[0]), w = {
        ...l[0].evidence,
        file: { name: u, bytes: c.byteLength, sha256: cn(c), header: l[0].evidence.file.header },
        bodies: y,
        notes: l.flatMap((h) => h.evidence.notes),
        totals: { volumeMm3: y.reduce((h, m) => h + m.volumeMm3, 0), areaMm2: y.reduce((h, m) => h + m.areaMm2, 0), faces: y.reduce((h, m) => h + m.faces.total, 0), edges: y.reduce((h, m) => h + m.edges.total, 0) }
      }, p = (h, m) => Math.abs(h - m) / Math.max(Math.abs(h), 1e-12), g = f.bodies.map((h, m) => {
        const b = y[m], P = p(h.volume, b.volumeMm3), S = p(h.area, b.areaMm2);
        return { id: h.id, name: h.name, volumeMm3: h.volume, readVolumeMm3: b.volumeMm3, areaMm2: h.area, readAreaMm2: b.areaMm2, volumeDeviation: P, areaDeviation: S, pass: b.valid && P <= rt && S <= rt };
      });
      return { kernel: n, evidence: { ...w, roundTrip: { tolerance: rt, bodies: g, pass: g.every((h) => h.pass) } } };
    },
    exportStep(s, i, f) {
      const l = r(s, i);
      return e.scope(() => {
        const { doc: u, targets: c, solids: d } = a(l, f);
        if (d.length > 1) {
          const p = d.reduce((h, m) => h + e.solidCount(m), 0), g = e.union(d[0], ...d.slice(1));
          if (e.solidCount(g) !== p) {
            for (let h = 0; h < d.length; h++)
              for (let m = h + 1; m < d.length; m++)
                if (e.solidCount(e.union(d[h], d[m])) < e.solidCount(d[h]) + e.solidCount(d[m]))
                  throw new A("unsupported", N`${u.nodes[c[h]].name} and ${u.nodes[c[m]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new A("unsupported", N("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const y = e.exportStep(c.map((p, g) => ({ solid: d[g], name: u.nodes[p].name, color: Ms(u.nodes[p].color) })), c.length > 1 && bs(u.title) ? { product: u.title } : {}), w = new TextEncoder().encode(y).byteLength;
        if (w > ws)
          throw new A("unsupported", N("The STEP file exceeds 64 MiB."));
        return { kernel: n, bodies: c.map((p) => ({ id: p, name: u.nodes[p].name })), step: y, bytes: w };
      });
    }
  };
}
let Ve;
function Ss(e = {}) {
  return Ve ?? (Ve = vr(e).then((t) => Es(t), (t) => {
    throw Ve = void 0, t;
  })), Ve;
}
function tn(e) {
  for (let t = e, n = 0; t && n < 8; t = t.cause, n++) {
    if (typeof WebAssembly < "u" && t instanceof WebAssembly.RuntimeError || t instanceof RangeError && /memory|allocat/i.test(t.message))
      return !0;
    const o = t instanceof Error ? t.message : typeof t == "string" ? t : "";
    if (/\bAborted\(|out of memory|memory access out of bounds|bad_alloc|Cannot enlarge memory|memory may be damaged|kernel crashed/i.test(o))
      return !0;
  }
  return !1;
}
const Ts = (e) => {
  if (!e.section)
    throw new A("invalid-input", N("Give the section axis and up to five cut positions."));
  return e.section;
}, nn = (e) => {
  const t = e.step?.bytes;
  if (t instanceof Uint8Array)
    return t;
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t);
  throw new A("invalid-input", N("Give the STEP file to import."));
};
function As(e, t, n = 0, o = {}) {
  const r = performance.now();
  return { ...t.operation === "measure" ? { operation: "measure", ...e.measure(t.document, t.bodies, o) } : t.operation === "feature-display" ? { operation: "feature-display", ...e.featureDisplays(t.document, t.bodies, o) } : t.operation === "edges" ? { operation: "edges", ...e.edges(t.document, t.bodies, o) } : t.operation === "drawing" ? { operation: "drawing", ...e.drawing(t.document, t.bodies, o) } : t.operation === "section" ? { operation: "section", ...e.section(t.document, t.bodies, Ts(t), o) } : t.operation === "import-step" ? { operation: "import-step", ...e.importStep(nn(t), t.step.name, o) } : t.operation === "faces" ? { operation: "faces", ...e.faces(t.document, t.bodies, o) } : t.operation === "step-evidence" ? { operation: "step-evidence", ...e.stepEvidence(t.step ? { bytes: nn(t), file: t.step.name } : { doc: t.document, ids: t.bodies }, o) } : { operation: "export-step", ...e.exportStep(t.document, t.bodies, o) }, timing: { loadMs: n, runMs: performance.now() - r, memoryBytes: e.kernel.memory().heap } };
}
function Ds(e = {}) {
  const { limits: t, ...n } = e, o = { ...t && typeof t.maxMemoryBytes == "number" && typeof t.requestTimeoutMs == "number" ? Lr(t) : {}, ...n }, r = () => new Error(N("Request cancelled"));
  return {
    async run(a, s) {
      if (s?.aborted)
        throw r();
      const i = performance.now(), f = await Ss(o), l = performance.now();
      if (s?.aborted || (await new Promise((c) => setTimeout(c, 0)), s?.aborted))
        throw r();
      const u = As(f, a, l - i, { limits: t });
      if (s?.aborted)
        throw r();
      return u;
    }
  };
}
export {
  vn as CURVED_EDGE_WEIGHT,
  Er as EXACT_KERNEL_ID,
  Mr as EXACT_KERNEL_PACKAGE,
  br as EXACT_KERNEL_VERSION,
  Os as EXACT_LIMITS_DESKTOP,
  Rs as EXACT_LIMITS_NONE,
  zr as EXACT_LIMITS_TABLET,
  A as ExactKernelError,
  ze as ExactLoweringError,
  Wr as MANY_LOOPS,
  Zt as MAX_DRAWING_EDGES,
  Yt as MAX_DRAWING_FACES,
  pt as MAX_DRAWING_TRIANGLES,
  de as MAX_EXACT_BODIES,
  en as MAX_LISTED_EDGES,
  Lt as MAX_POLYHEDRON_FACES,
  Qt as MAX_SECTION_EDGES,
  ps as MAX_SECTION_PLANES,
  ws as MAX_STEP_BYTES,
  Ft as MIN_EXACT_SEGMENTS,
  _s as cadScript,
  Xr as checkExactFeatureCost,
  Tn as createBrepCache,
  Ss as createExactBackend,
  Es as createExactBackendFromKernel,
  Ds as createInThreadExactHost,
  cs as describeExactFace,
  Ht as displayMesh,
  En as displayTessellation,
  fs as drawingMeshTolerance,
  $s as evaluateCadScript,
  ds as exactDrawingBody,
  hs as exactDrawingData,
  Hr as exactFeatureCost,
  qr as exactFeatureDisplay,
  Fr as exactGuardSeconds,
  Sr as exactKernelIdentity,
  Lr as exactKernelOptions,
  gs as exactSectionData,
  vs as exactTargets,
  dt as facewiseMesh,
  ns as importStepBodies,
  tn as isFatalExactError,
  yt as lowerCodeShape,
  xt as lowerDocumentBody,
  ht as lowerDocumentNode,
  rs as readStoredBody,
  Cs as resolveExactLimits,
  ls as resolveFeatureEdges,
  wn as revolveProfile,
  As as runExactRequest,
  ms as sectionEdges,
  Kt as sketchProfile,
  qt as stepFileEvidence,
  os as storedBody,
  Vr as triangulatePolygon
};
