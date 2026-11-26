var dn = Object.defineProperty;
var hn = (e, t, n) => t in e ? dn(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var ce = (e, t, n) => hn(e, typeof t != "symbol" ? t + "" : t, n);
import { c as ht, C as pn, s as mn, a as gn, t as N, e as yn, f as re, b as xn, d as vn, g as wn, h as Mn, i as bn, j as Ye, k as An, l as En, M as Sn, m as $n, E as Ze, n as Tn, v as Qe, o as Cn } from "../geometry.worker-C2GQWGe4.js";
var zn = Object.defineProperty, h = (e, t) => zn(e, "name", { value: t, configurable: !0 }), he, C = (he = class extends Error {
  constructor(n, r, o) {
    super(r, o);
    ce(this, "code");
    this.name = "ExactKernelError", this.code = n;
  }
}, h(he, "ExactKernelError"), he), _ = /* @__PURE__ */ h((e) => {
  throw new C("invalid-input", e);
}, "invalid");
function O(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && _(`${e} must be finite numbers (got ${String(n)}).`);
}
h(O, "finite");
function k(e, ...t) {
  O(e, ...t);
  for (const n of t) n > 0 || _(`${e} must be positive (got ${n}).`);
}
h(k, "positive");
function ge(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return _(`${e} must be a 3-vector.`);
  O(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || _(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
h(ge, "unitVector");
function pt(e) {
  const t = e.map((r) => [...r]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let r = 0; r < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); r++)
    for (const [s, a] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[s][a]) < 1e-300) continue;
      const i = (t[a][a] - t[s][s]) / (2 * t[s][a]), c = Math.sign(i || 1) / (Math.abs(i) + Math.sqrt(i * i + 1)), f = 1 / Math.sqrt(c * c + 1), d = c * f;
      for (let u = 0; u < 3; u++) {
        const l = t[u][s], p = t[u][a];
        t[u][s] = f * l - d * p, t[u][a] = d * l + f * p;
      }
      for (let u = 0; u < 3; u++) {
        const l = t[s][u], p = t[a][u];
        t[s][u] = f * l - d * p, t[a][u] = d * l + f * p;
      }
      for (let u = 0; u < 3; u++) {
        const l = n[u][s], p = n[u][a];
        n[u][s] = f * l - d * p, n[u][a] = d * l + f * p;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((r) => [n[0][r], n[1][r], n[2][r]]) };
}
h(pt, "symmetricEigen");
function mt(e, t) {
  const n = new Float64Array(e.length);
  for (let r = 0; r < t.length; r += 3) {
    const o = t[r] * 3, s = t[r + 1] * 3, a = t[r + 2] * 3, i = e[s] - e[o], c = e[s + 1] - e[o + 1], f = e[s + 2] - e[o + 2], d = e[a] - e[o], u = e[a + 1] - e[o + 1], l = e[a + 2] - e[o + 2], p = c * l - f * u, x = f * d - i * l, v = i * u - c * d;
    for (const g of [o, s, a])
      n[g] += p, n[g + 1] += x, n[g + 2] += v;
  }
  for (let r = 0; r < n.length; r += 3) {
    const o = Math.hypot(n[r], n[r + 1], n[r + 2]);
    o > 0 && (n[r] /= o, n[r + 1] /= o, n[r + 2] /= o);
  }
  return n;
}
h(mt, "vertexNormals");
var se = /* @__PURE__ */ h((e) => ({ part: e, dispose: /* @__PURE__ */ h(() => e.dispose(), "dispose") }), "solidOf"), j = /* @__PURE__ */ h((e, t, n) => ({ sketch: e, outline: t, polygon: n, dispose: /* @__PURE__ */ h(() => {
  e.dispose(), t?.dispose();
}, "dispose") }), "profileOf"), I = /* @__PURE__ */ h((e) => e?.part ?? _("Not a solid of this kernel."), "partOf"), R = /* @__PURE__ */ h((e) => e?.sketch ?? _("Not a profile of this kernel."), "sketchOf"), Je = /* @__PURE__ */ h((e) => e?.outline, "outlineOf"), et = /* @__PURE__ */ h((e) => e?.polygon, "polygonOf"), G = /* @__PURE__ */ h((e) => [e[0], e[1], e[2]], "vec");
function T(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof C) throw n;
    const r = n instanceof Error ? n.message : String(n);
    throw new C("kernel-failure", `SMLib ${e} failed: ${r}`, { cause: n });
  }
}
h(T, "call");
function gt(e) {
  return { sm: e, solid: /* @__PURE__ */ h((r, o) => {
    if (!(o instanceof e.Part)) throw new C("kernel-failure", `SMLib ${r} did not produce a solid (got ${o?.constructor?.name ?? typeof o}).`);
    return se(o);
  }, "solid"), face: /* @__PURE__ */ h((r, o) => {
    const { faceNormal: s, outermost: a } = Array.isArray(o) ? { faceNormal: o, outermost: !1 } : o, i = ge("Face normal", s), c = /* @__PURE__ */ h((d) => {
      const u = d.center();
      return u.x * i[0] + u.y * i[1] + u.z * i[2];
    }, "along"), f = [...r.faces()].filter((d) => {
      if (!d.isPlanar) return !1;
      const u = d.normalAt();
      return u.x * i[0] + u.y * i[1] + u.z * i[2] > 1 - 1e-9;
    });
    return a && f.length ? f.sort((d, u) => c(u) - c(d))[0] : (f.length !== 1 && _(`Expected exactly one planar face with outward normal [${i.join(", ")}], found ${f.length}.`), f[0]);
  }, "face") };
}
h(gt, "createContext");
var ve = 1e-7, tt = 0.1, B = /* @__PURE__ */ h((e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], "sub"), X = /* @__PURE__ */ h((e, t) => [e[0] + t[0], e[1] + t[1], e[2] + t[2]], "add"), D = /* @__PURE__ */ h((e, t) => [e[0] * t, e[1] * t, e[2] * t], "mul"), L = /* @__PURE__ */ h((e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], "dot"), yt = /* @__PURE__ */ h((e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], "cross"), Ee = /* @__PURE__ */ h((e) => Math.sqrt(L(e, e)), "norm"), V = /* @__PURE__ */ h((e, t) => Ee(B(e, t)), "dist"), He = /* @__PURE__ */ h((e) => D(e, 1 / Ee(e)), "unit");
function xt(e, t, n, r) {
  const o = B(e, t), s = Math.cos(r), a = Math.sin(r);
  return X(t, X(X(D(o, s), D(yt(n, o), a)), D(n, L(n, o) * (1 - s))));
}
h(xt, "rotateAbout");
function Se(e) {
  let t = 0, n = [0, 0, 0], r = [0, 0, 0];
  for (let o = 0; o < e.length; o++) {
    const s = e[o], a = e[(o + 1) % e.length], i = V(s, a);
    t += i, n = X(n, D(X(s, a), i / 2)), r = X(r, [(s[1] - a[1]) * (s[2] + a[2]), (s[2] - a[2]) * (s[0] + a[0]), (s[0] - a[0]) * (s[1] + a[1])]);
  }
  return { pos: D(n, 1 / t), axis: He(r) };
}
h(Se, "planeOf");
function Ne(e, t, n) {
  let r = X(e, B(n.pos, t.pos)), o = t.axis, s = n.axis;
  const a = Math.acos(Math.max(-1, Math.min(1, L(o, s))));
  if (a <= 1e-4 || a >= Math.PI - 1e-4) return r;
  const i = B(n.pos, t.pos);
  L(i, o) < -1e-7 && (o = D(o, -1)), L(i, s) < 1e-7 && (s = D(s, -1));
  const c = yt(o, s), f = X(D(s, L(i, o)), D(o, -L(i, s))), d = L(f, o), u = L(f, s), l = d * u > 0 && Math.abs(d) > 1e-4 && Math.abs(u) > 1e-4 ? -1 : 1, p = Math.acos(Math.max(-1, Math.min(1, L(o, s) / (Ee(o) * Ee(s)))));
  return r = xt(r, n.pos, He(c), p * l), r;
}
h(Ne, "transfer");
function vt(e, t, n, r) {
  const o = B(t, e), s = B(r, n), a = B(e, n), i = L(o, o), c = L(o, s), f = L(s, s), d = L(o, a), u = L(s, a), l = i * f - c * c;
  if (!(l <= 1e-24 * i * f))
    return { s: (c * u - f * d) / l, t: (i * u - c * d) / l };
}
h(vt, "lineLine");
function Re(e, t, n) {
  const r = B(n, t);
  return L(B(e, t), r) / L(r, r);
}
h(Re, "pointSegment");
function wt(e, t, n) {
  const r = [1 / 0, 1 / 0, 1 / 0], o = [-1 / 0, -1 / 0, -1 / 0];
  for (const { p: u } of e) for (let l = 0; l < 3; l++)
    r[l] = Math.min(r[l], u[l]), o[l] = Math.max(o[l], u[l]);
  const s = Math.hypot(o[0] - r[0], o[1] - r[1], o[2] - r[2]), a = X(t, D(He(B(n, t)), s)), i = [], c = /* @__PURE__ */ h((u) => u > 0 && u < 1, "onRay");
  for (const u of e) for (const l of [t, a]) i.push({ vertex: u, p: u.p, d: V(l, u.p) });
  for (let u = 0; u < e.length; u++) {
    const l = e[u].p, p = e[(u + 1) % e.length].p;
    for (const x of [t, a]) {
      const v = Re(x, l, p);
      if (c(v)) {
        const g = X(l, D(B(p, l), v));
        i.push({ edge: u, t: v, p: g, d: V(x, g) });
      }
    }
  }
  for (const u of e) {
    const l = Re(u.p, t, a);
    c(l) && i.push({ vertex: u, p: u.p, d: V(u.p, X(t, D(B(a, t), l))) });
  }
  for (let u = 0; u < e.length; u++) {
    const l = e[u].p, p = e[(u + 1) % e.length].p, x = vt(t, a, l, p);
    if (!x || !c(x.s) || !c(x.t)) continue;
    const v = X(l, D(B(p, l), x.t));
    i.push({ edge: u, t: x.t, p: v, d: V(v, X(t, D(B(a, t), x.s))) });
  }
  if (!i.length) return;
  const f = Math.min(...i.map((u) => u.d));
  let d;
  for (const u of i) u.d <= f + ve && (!d || V(n, u.p) < V(n, d.p)) && (d = u);
  return d;
}
h(wt, "hitOnLoop");
function Le(e, t, n, r, o) {
  const s = wt(e, t, n);
  if (!s) return;
  if (s.vertex) return s.vertex;
  const a = s.edge, i = e[a], c = e[(a + 1) % e.length], f = s.t;
  let d;
  if (f < tt ? d = i : 1 - f < tt && (d = c), d && !r(d)) return d;
  const u = V(i.p, c.p);
  if (f * u < ve || (1 - f) * u < ve) return d;
  const l = { id: o(), p: s.p };
  return e.splice(a + 1, 0, l), l;
}
h(Le, "carry");
function Mt(e, t = "authored") {
  const n = e.length;
  if (n < 2) return e.map((g) => [...g]);
  if (e.every((g) => g.length === e[0].length)) return t === "closest" ? bt(e) : e.map((g) => [...g]);
  let r = 0;
  const o = /* @__PURE__ */ h(() => r++, "nextId"), s = e.map((g) => g.map((y) => ({ id: o(), p: y }))), a = e.map(Se), i = e.reduce((g, y) => g + y.length, 0), c = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Set();
  for (let g = n - 1; g > 0; g--) {
    const y = [...s[g]];
    if (y.length > i) return;
    for (const w of y) {
      const S = Ne(w.p, a[g], a[g - 1]);
      if (V(S, a[g - 1].pos) <= ve) continue;
      const A = Le(s[g - 1], a[g - 1].pos, S, (M) => f.has(M.id), o);
      if (!A) return;
      c.set(w.id, A.id), f.add(A.id);
    }
  }
  const d = /* @__PURE__ */ new Map();
  for (const [g, y] of c) d.has(y) || d.set(y, g);
  const u = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map();
  for (const g of s[0]) {
    const y = [g.id];
    l.set(g.id, g.id);
    let w = g.id;
    for (; y.length < n && d.has(w) && (w = d.get(w), w !== g.id); )
      y.push(w), l.set(w, g.id);
    u.set(g.id, y);
  }
  const p = s[0].length;
  for (let g = 0; g < n - 1; g++) {
    const y = [...s[g]];
    if (y.length > i || y.length > p) return;
    for (const w of y) {
      const S = l.get(w.id);
      if (S === void 0) return;
      const A = u.get(S), M = new Set(s[g + 1].map((m) => m.id));
      if (A.some((m) => M.has(m))) continue;
      const $ = Ne(w.p, a[g], a[g + 1]);
      if (V($, a[g + 1].pos) <= ve) continue;
      const z = Le(s[g + 1], a[g + 1].pos, $, (m) => l.has(m.id), o);
      if (!z) return;
      A.push(z.id), l.set(z.id, S);
    }
  }
  const x = s[0], v = [x.map((g) => g.p)];
  for (let g = 1; g < n; g++) {
    const y = s[g];
    if (y.length !== x.length) return;
    const w = u.get(x[0].id)?.[g], S = u.get(x[1].id)?.[g], A = y.findIndex((m) => m.id === w), M = y.findIndex((m) => m.id === S);
    if (A < 0 || M < 0) return;
    const $ = y.length, z = (A + 1) % $ === M ? 1 : (M + 1) % $ === A ? -1 : 0;
    if (!z) return;
    v.push(Array.from({ length: $ }, (m, b) => y[((A + z * b) % $ + $) % $].p));
  }
  return v;
}
h(Mt, "compatibleSections");
function bt(e) {
  const t = Se(e[0]), n = [[...e[0]]];
  let r = t.pos;
  for (let o = 1; o < e.length; o++) {
    const s = e[o], a = s.length, i = n[o - 1];
    let c = Se(s).pos;
    const f = B(c, r);
    c = B(c, D(t.axis, L(f, t.axis)));
    const d = B(r, c);
    let u = 1 / 0, l = 0, p = !0;
    const x = /* @__PURE__ */ h((v) => {
      let g = 0;
      for (let y = 0; y < a; y++) g += V(i[y], X(s[v(y)], d));
      return g;
    }, "sum");
    for (let v = 0; v < a; v++) {
      const g = x((w) => (v + w) % a);
      g < u && (u = g, l = v, p = !0);
      const y = x((w) => ((v - w) % a + a) % a);
      y < u && (u = y, l = v, p = !1);
    }
    n.push(Array.from({ length: a }, (v, g) => s[p ? (l + g) % a : ((l - g) % a + a) % a])), r = c;
  }
  return n;
}
h(bt, "computeOrigin");
var Ke = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], Fe = /* @__PURE__ */ h((e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], "dot3"), Y = /* @__PURE__ */ h((e) => [e.x, e.y, e.z], "p3"), we = /* @__PURE__ */ h((e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return t > 1e-15 ? [e[0] / t, e[1] / t, e[2] / t] : null;
}, "unit2"), J = /* @__PURE__ */ h((e, ...t) => {
  const n = [e[0], e[1], e[2]];
  for (const [r, o] of t)
    n[0] += r * o[0], n[1] += r * o[1], n[2] += r * o[2];
  return n;
}, "at");
function At(e) {
  const t = e.bbox(), n = Math.max(1, t.diagonal), r = 1e-7 * n, o = { min: [1 / 0, 1 / 0, 1 / 0], max: [-1 / 0, -1 / 0, -1 / 0], tol: r };
  for (const s of e.vertices()) K(o, [s.x, s.y, s.z]);
  for (const s of e.edges({ seams: !0 })) St(s, o);
  for (const s of e.faces()) zt(s, o);
  return Number.isFinite(o.min[0]) ? { min: o.min, max: o.max } : { min: [t.min.x, t.min.y, t.min.z], max: [t.max.x, t.max.y, t.max.z] };
}
h(At, "exactBoundingBox");
function K(e, t) {
  for (let n = 0; n < 3; n++)
    t[n] < e.min[n] && (e.min[n] = t[n]), t[n] > e.max[n] && (e.max[n] = t[n]);
}
h(K, "add2");
var Me = /* @__PURE__ */ h((e, t) => t.some((n, r) => n < e.min[r] - e.tol || n > e.max[r] + e.tol), "grows"), Et = /* @__PURE__ */ h((e, t) => t.some((n) => Me(e, [n.x, n.y, n.z])), "netGrows");
function St(e, t) {
  K(t, Y(e.start)), K(t, Y(e.end));
  const n = e.geomType;
  if (n === "line" || n === "circle" && $t(e, t)) return;
  let r = null;
  try {
    if (r = e.nurbs(), !Et(t, r.points)) return;
  } catch {
  }
  Be(n === "bspline" && r ? Ct(r) : { t0: 0, t1: 1, spans: 1, at: /* @__PURE__ */ h((o) => Y(e.pointAt(o)), "at") }, t);
}
h(St, "edgeExtremes");
function $t(e, t) {
  const n = Y(e.arcCenter), r = we(Y(e.normal)), o = e.radius;
  if (!r) return !1;
  for (const s of Ke) {
    const a = we(J(s, [-Fe(s, r), r]));
    if (a)
      for (const i of [1, -1]) {
        const c = J(n, [i * o, a]);
        Me(t, c) && (e.isClosed || e.distanceTo(c) <= t.tol) && K(t, c);
      }
  }
  return !0;
}
h($t, "circleExtremes");
function Be(e, t) {
  const n = Math.min(1024, Math.max(64, 8 * e.spans)), r = (e.t1 - e.t0) / n, o = [], s = /* @__PURE__ */ h((a) => a === n ? e.t1 : e.t0 + a * r, "t");
  for (let a = 0; a <= n; a++) {
    const i = e.at(s(a));
    o.push(i), K(t, i);
  }
  for (let a = 0; a < 3; a++) for (const i of [1, -1]) {
    let c = 0;
    for (let d = 1; d <= n; d++) i * o[d][a] > i * o[c][a] && (c = d);
    Tt(/* @__PURE__ */ h((d) => {
      const u = e.at(d);
      return K(t, u), i * u[a];
    }, "f"), s(Math.max(0, c - 1)), s(Math.min(n, c + 1)));
  }
}
h(Be, "curveExtremes");
function Tt(e, t, n) {
  const r = (Math.sqrt(5) - 1) / 2, o = 1e-12 * Math.max(1, Math.abs(t), Math.abs(n));
  let s = n - r * (n - t), a = t + r * (n - t), i = e(s), c = e(a);
  for (let f = 0; f < 60 && n - t > o; f++)
    i < c ? (t = s, s = a, i = c, a = t + r * (n - t), c = e(a)) : (n = a, a = s, c = i, s = n - r * (n - t), i = e(s));
}
h(Tt, "golden");
function Ct(e) {
  const t = e.degree, n = e.knots, r = e.points.length - 1, o = e.weights, s = e.points.map((u, l) => {
    const p = o ? o[l] : 1;
    return [u.x * p, u.y * p, u.z * p, p];
  }), a = n[t], i = n[r + 1];
  let c = 0;
  for (let u = t; u <= r; u++) n[u + 1] > n[u] && c++;
  const f = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]), d = /* @__PURE__ */ h((u) => {
    u = Math.min(i, Math.max(a, u));
    let l = t;
    for (; l < r && n[l + 1] <= u; ) l++;
    for (let x = 0; x <= t; x++) for (let v = 0; v < 4; v++) f[x][v] = s[x + l - t][v];
    for (let x = 1; x <= t; x++) for (let v = t; v >= x; v--) {
      const g = n[v + l - t], y = n[v + 1 + l - x] - g, w = y > 0 ? (u - g) / y : 0;
      for (let S = 0; S < 4; S++) f[v][S] = (1 - w) * f[v - 1][S] + w * f[v][S];
    }
    const p = f[t];
    return [p[0] / p[3], p[1] / p[3], p[2] / p[3]];
  }, "at2");
  return { t0: a, t1: i, spans: Math.max(1, c), at: d };
}
h(Ct, "nurbsCurve");
function zt(e, t) {
  const n = e.geomType;
  if (n === "plane" || n === "cylinder" || n === "cone" || n === "extrusion") return;
  const r = /* @__PURE__ */ h((o) => Me(t, o) && e.distanceTo(o) <= t.tol, "onFace");
  if (n === "sphere") return Pt(e, t, r);
  if (!(n === "torus" && _t(e, t, r)) && !e.isPlanar) {
    try {
      const o = e.nurbs();
      if (o.degrees[0] === 1 || o.degrees[1] === 1 || !Et(t, o.points.flat())) return;
    } catch {
    }
    Ot(e, t);
  }
}
h(zt, "faceExtremes");
function Pt(e, t, n) {
  const r = Y(e.axis.origin), o = e.radius;
  for (const s of Ke) for (const a of [1, -1]) {
    const i = J(r, [a * o, s]);
    n(i) && K(t, i);
  }
}
h(Pt, "sphereExtremes");
function _t(e, t, n) {
  const r = e.axis, o = Y(r.origin), s = we(Y(r.direction)), a = e.majorRadius, i = e.radius;
  if (!s) return !1;
  for (const c of Ke) {
    const f = we(J(c, [-Fe(c, s), s]));
    if (f && Math.abs(Fe(c, s)) < 1 - 1e-12)
      for (const d of [1, -1]) for (const u of [1, -1]) {
        const l = J(o, [d * a, f], [u * i, c]);
        n(l) && K(t, l);
      }
    else It(o, s, a, i, t, n);
  }
  return !0;
}
h(_t, "torusExtremes");
function It(e, t, n, r, o, s) {
  const a = we(Math.abs(t[0]) < 0.9 ? J([1, 0, 0], [-t[0], t]) : J([0, 1, 0], [-t[1], t])), i = [t[1] * a[2] - t[2] * a[1], t[2] * a[0] - t[0] * a[2], t[0] * a[1] - t[1] * a[0]];
  for (const c of [1, -1])
    if (Me(o, J(e, [c * r, t])))
      for (let f = 0; f < 72; f++) {
        const d = 2 * Math.PI * f / 72, u = J(e, [n * Math.cos(d), a], [n * Math.sin(d), i], [c * r, t]);
        if (s(u)) {
          K(o, u);
          break;
        }
      }
}
h(It, "torusCapCircles");
function Ot(e, t) {
  const r = [];
  for (let o = 0; o <= 24; o++) for (let s = 0; s <= 24; s++) r.push({ u: o / 24, v: s / 24, p: Y(e.positionAt(o / 24, s / 24)) });
  for (let o = 0; o < 3; o++) for (const s of [1, -1]) {
    const i = r.filter((f) => Me(t, f.p)).sort((f, d) => s * d.p[o] - s * f.p[o]).find((f) => e.distanceTo(f.p) <= t.tol);
    if (!i) continue;
    K(t, i.p);
    const c = Nt(e, i, o, s, 1 / 24);
    e.distanceTo(c) <= t.tol && K(t, c);
  }
}
h(Ot, "surfaceExtremes");
function Nt(e, t, n, r, o) {
  let { u: s, v: a } = t, i = r * t.p[n], c = t.p;
  for (let f = o; f > 1e-9; f /= 2)
    for (let d = !0, u = 0; d && u < 64; u++) {
      d = !1;
      for (const [l, p] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = Math.min(1, Math.max(0, s + l * f)), v = Math.min(1, Math.max(0, a + p * f)), g = Y(e.positionAt(x, v));
        r * g[n] > i && (s = x, a = v, i = r * g[n], c = g, d = !0);
      }
    }
  return c;
}
h(Nt, "patternSearch");
var nt = 1024, ne = /* @__PURE__ */ h((e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], "sub2"), U = /* @__PURE__ */ h((e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], "dot2"), $e = /* @__PURE__ */ h((e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], "cross2");
function Ve(e) {
  const n = 1e-9 * Math.max(1, ...e.flatMap((s) => s.map(Math.abs))), r = Rt(e, n);
  if (r.length > nt) throw new C("unsupported", `Hull of ${r.length} distinct vertices exceeds the exact hull budget (${nt}).`);
  if (r.length < 4) throw new C("invalid-input", "A hull needs at least four non-coplanar points.");
  const o = Lt(r, n);
  return Ft(r, o, Math.min(n, 1e-9));
}
h(Ve, "convexHull");
function Rt(e, t) {
  const n = Math.max(t * 4, 1e-300), r = /* @__PURE__ */ new Map(), o = [];
  for (const s of e) {
    const a = s.map((f) => Math.floor(f / n));
    let i = !1;
    for (let f = -1; f <= 1 && !i; f++) for (let d = -1; d <= 1 && !i; d++) for (let u = -1; u <= 1 && !i; u++)
      for (const l of r.get(`${a[0] + f},${a[1] + d},${a[2] + u}`) ?? []) if (Math.hypot(...ne(s, l)) <= t) {
        i = !0;
        break;
      }
    if (i) continue;
    const c = a.join(",");
    (r.get(c) ?? r.set(c, []).get(c)).push(s), o.push(s);
  }
  return o;
}
h(Rt, "dedupe");
function De(e, t, n, r) {
  const o = $e(ne(e[n], e[t]), ne(e[r], e[t])), s = Math.hypot(...o), a = s > 0 ? [o[0] / s, o[1] / s, o[2] / s] : [0, 0, 0], i = [(e[t][0] + e[n][0] + e[r][0]) / 3, (e[t][1] + e[n][1] + e[r][1]) / 3, (e[t][2] + e[n][2] + e[r][2]) / 3];
  return { v: [t, n, r], n: a, d: U(a, i), area: s / 2, alive: !0 };
}
h(De, "makeTri");
function Lt(e, t) {
  const n = e.length;
  let r = 0;
  for (let y = 1; y < n; y++) e[y][0] < e[r][0] && (r = y);
  let o = -1, s = -1;
  for (let y = 0; y < n; y++) {
    const w = Math.hypot(...ne(e[y], e[r]));
    w > s && (s = w, o = y);
  }
  let a = -1;
  s = -1;
  const i = ne(e[o], e[r]);
  for (let y = 0; y < n; y++) {
    const w = Math.hypot(...$e(i, ne(e[y], e[r])));
    w > s && (s = w, a = y);
  }
  if (!(s > t * Math.hypot(...i))) throw new C("invalid-input", "The hull is flat (all points collinear).");
  const c = De(e, r, o, a);
  let f = -1;
  s = -1;
  for (let y = 0; y < n; y++) {
    const w = Math.abs(U(c.n, e[y]) - c.d);
    w > s && (s = w, f = y);
  }
  if (!(s > t)) throw new C("invalid-input", "The hull is flat (all points coplanar).");
  const d = [], u = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ h((y, w, S) => {
    const A = De(e, y, w, S), M = d.length;
    return d.push(A), u.set(y * n + w, M), u.set(w * n + S, M), u.set(S * n + y, M), M;
  }, "add3"), p = /* @__PURE__ */ h((y) => {
    const w = d[y];
    w.alive = !1;
    const [S, A, M] = w.v;
    for (const $ of [S * n + A, A * n + M, M * n + S]) u.get($) === y && u.delete($);
  }, "kill");
  U(c.n, e[f]) - c.d > 0 ? (l(r, a, o), l(r, o, f), l(o, a, f), l(a, r, f)) : (l(r, o, a), l(r, f, o), l(o, f, a), l(a, f, r));
  const x = /* @__PURE__ */ new Set([r, o, a, f]), v = e.reduce((y, w) => [y[0] + w[0] / n, y[1] + w[1] / n, y[2] + w[2] / n], [0, 0, 0]), g = [...e.keys()].filter((y) => !x.has(y)).sort((y, w) => Math.hypot(...ne(e[w], v)) - Math.hypot(...ne(e[y], v)));
  for (const y of g) {
    const w = e[y];
    let S = -1, A = t;
    for (let m = 0; m < d.length; m++) {
      const b = d[m];
      if (!b.alive) continue;
      const E = U(b.n, w) - b.d;
      E > A && (A = E, S = m);
    }
    if (S < 0) continue;
    const M = /* @__PURE__ */ new Set([S]), $ = [S];
    for (; $.length; ) {
      const m = $.pop(), [b, E, P] = d[m].v;
      for (const [Z, ee] of [[b, E], [E, P], [P, b]]) {
        const W = u.get(ee * n + Z);
        W === void 0 || M.has(W) || U(d[W].n, w) - d[W].d > t && (M.add(W), $.push(W));
      }
    }
    const z = [];
    for (const m of M) {
      const [b, E, P] = d[m].v;
      for (const [Z, ee] of [[b, E], [E, P], [P, b]]) {
        const W = u.get(ee * n + Z);
        (W === void 0 || !M.has(W)) && z.push([Z, ee]);
      }
    }
    for (const m of M) p(m);
    for (const [m, b] of z) l(m, b, y);
  }
  return d.filter((y) => y.alive);
}
h(Lt, "hullTriangles");
function Ft(e, t, n) {
  const r = e.length, o = /* @__PURE__ */ new Map();
  t.forEach((l, p) => {
    const [x, v, g] = l.v;
    o.set(x * r + v, p), o.set(v * r + g, p), o.set(g * r + x, p);
  });
  const s = new Array(t.length).fill(-1), a = [], i = [...t.keys()].sort((l, p) => t[p].area - t[l].area);
  for (const l of i) {
    if (s[l] >= 0) continue;
    const { n: p, d: x } = t[l], v = a.length, g = [l];
    s[l] = v;
    for (let w = 0; w < g.length; w++) {
      const [S, A, M] = t[g[w]].v;
      for (const [$, z] of [[S, A], [A, M], [M, S]]) {
        const m = o.get(z * r + $);
        if (m === void 0 || s[m] >= 0) continue;
        const b = t[m];
        U(b.n, p) < 1 - 1e-6 || b.v.some((E) => Math.abs(U(p, e[E]) - x) > n) || (s[m] = v, g.push(m));
      }
    }
    const y = g.length > 1 ? Bt(g.map((w) => t[w].v), r) : t[l].v.slice();
    if (y) a.push(y);
    else {
      s[l] = v, a.push(t[l].v.slice());
      for (const w of g.slice(1))
        s[w] = a.length, a.push(t[w].v.slice());
    }
  }
  const c = /* @__PURE__ */ new Map();
  for (const l of a) for (const p of l) c.set(p, (c.get(p) ?? 0) + 1);
  const f = a.map((l) => {
    const p = l.filter((x) => (c.get(x) ?? 0) > 2);
    return p.length >= 3 ? p : l;
  }), d = [...new Set(f.flat())].sort((l, p) => l - p), u = new Map(d.map((l, p) => [l, p]));
  return { points: d.map((l) => e[l]), faces: f.map((l) => l.map((p) => u.get(p))) };
}
h(Ft, "mergeCoplanar");
function Bt(e, t) {
  const n = /* @__PURE__ */ new Set();
  for (const [a, i, c] of e) for (const [f, d] of [[a, i], [i, c], [c, a]]) n.add(f * t + d);
  const r = /* @__PURE__ */ new Map();
  for (const a of n) {
    const i = Math.floor(a / t), c = a % t;
    if (!n.has(c * t + i)) {
      if (r.has(i)) return null;
      r.set(i, c);
    }
  }
  const o = r.keys().next().value, s = [o];
  for (let a = r.get(o); a !== o; a = r.get(a)) {
    if (a === void 0 || s.length > r.size) return null;
    s.push(a);
  }
  return s.length === r.size ? s : null;
}
h(Bt, "boundaryLoop");
function Dt(e, t, n = 1e-9) {
  const r = [];
  for (const o of t) {
    const s = kt(e, o);
    if (o.length === 3 || !s) {
      r.push([...o]);
      continue;
    }
    const a = o.reduce((i, c) => i + U(s, e[c]), 0) / o.length;
    if (o.every((i) => Math.abs(U(s, e[i]) - a) <= n)) {
      r.push([...o]);
      continue;
    }
    r.push(...jt(e, o, s));
  }
  return r;
}
h(Dt, "planarFaces");
function kt(e, t) {
  const n = [0, 0, 0];
  for (let o = 0; o < t.length; o++) {
    const s = e[t[o]], a = e[t[(o + 1) % t.length]];
    n[0] += (s[1] - a[1]) * (s[2] + a[2]), n[1] += (s[2] - a[2]) * (s[0] + a[0]), n[2] += (s[0] - a[0]) * (s[1] + a[1]);
  }
  const r = Math.hypot(...n);
  return r > 0 ? [n[0] / r, n[1] / r, n[2] / r] : null;
}
h(kt, "newell");
function jt(e, t, n) {
  const r = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], o = $e(n, r), s = Math.hypot(...o), a = [o[0] / s, o[1] / s, o[2] / s], i = $e(n, a), c = new Map(t.map((x) => [x, [U(e[x], a), U(e[x], i)]])), f = /* @__PURE__ */ h((x, v, g) => {
    const [y, w] = c.get(x), [S, A] = c.get(v), [M, $] = c.get(g);
    return (S - y) * ($ - w) - (A - w) * (M - y);
  }, "turn"), d = /* @__PURE__ */ h((x, v, g, y) => f(v, g, x) >= 0 && f(g, y, x) >= 0 && f(y, v, x) >= 0, "inside"), u = [...t], l = [];
  let p = 0;
  for (; u.length > 3 && p++ < 10 * t.length * t.length; ) {
    let x = !1;
    for (let v = 0; v < u.length; v++) {
      const g = u[(v + u.length - 1) % u.length], y = u[v], w = u[(v + 1) % u.length];
      if (!(f(g, y, w) <= 0) && !u.some((S) => S !== g && S !== y && S !== w && d(S, g, y, w))) {
        l.push([g, y, w]), u.splice(v, 1), x = !0;
        break;
      }
    }
    if (!x) break;
  }
  if (u.length > 3)
    for (let x = 1; x + 1 < u.length; x++) l.push([u[0], u[x], u[x + 1]]);
  else l.push(u);
  return l;
}
h(jt, "earClip");
function Xt(e, t) {
  const n = Math.max(1, ...e.flatMap((o) => o.map(Math.abs))), r = 1e-9 * n;
  for (const o of t) {
    const s = [0, 0, 0];
    for (let f = 0; f < o.length; f++) {
      const d = e[o[f]], u = e[o[(f + 1) % o.length]];
      s[0] += (d[1] - u[1]) * (d[2] + u[2]), s[1] += (d[2] - u[2]) * (d[0] + u[0]), s[2] += (d[0] - u[0]) * (d[1] + u[1]);
    }
    const a = Math.hypot(...s);
    if (!(a > 0)) return !1;
    const i = [s[0] / a, s[1] / a, s[2] / a], c = U(i, e[o[0]]);
    if (o.some((f) => Math.abs(U(i, e[f]) - c) > r) || e.some((f) => U(i, f) - c > r)) return !1;
  }
  return !0;
}
h(Xt, "isConvexPolyhedron");
function Ut(e) {
  const t = e.length;
  if (t < 4) return null;
  let n = 1;
  for (const o of e) n = Math.max(n, Math.abs(o[0]), Math.abs(o[1]));
  const r = Wt(e, 1e-9 * n);
  for (let o = 0; o < t; o++) {
    for (let s = o + 2; s < t; s++) {
      const a = o === 0 && s === t - 1 ? null : r.edgesCross(o, s);
      if (a) return { edges: [o, s], at: a };
    }
    for (let s = 0; s < t; s++) if (r.passesThrough(o, s)) return { edges: [o, (s - 1 + t) % t], at: [e[s][0], e[s][1]] };
  }
  return null;
}
h(Ut, "outlineCrossing");
function Wt(e, t) {
  const n = e.length, r = /* @__PURE__ */ h((i) => e[(i % n + n) % n], "pt"), o = /* @__PURE__ */ h((i, c, f) => {
    const d = Math.hypot(c[0] - i[0], c[1] - i[1]), u = d <= t ? 0 : ((c[0] - i[0]) * (f[1] - i[1]) - (c[1] - i[1]) * (f[0] - i[0])) / d;
    return Math.abs(u) <= t ? 0 : Math.sign(u);
  }, "side"), s = /* @__PURE__ */ h((i, c, f) => {
    const d = Math.hypot(c[0] - i[0], c[1] - i[1]), u = ((f[0] - i[0]) * (c[0] - i[0]) + (f[1] - i[1]) * (c[1] - i[1])) / d;
    return u > t && u < d - t;
  }, "inside"), a = /* @__PURE__ */ h((i, c, f, d) => {
    for (let u = 1; u < n; u++) {
      const l = o(i, c, r(f + d * u));
      if (l) return l;
    }
    return 0;
  }, "nextSide");
  return {
    /** Where edges i and j cross in their interiors, or null. */
    edgesCross(i, c) {
      const f = r(i), d = r(i + 1), u = r(c), l = r(c + 1);
      if (o(f, d, u) * o(f, d, l) >= 0 || o(u, l, f) * o(u, l, d) >= 0) return null;
      const p = (d[0] - f[0]) * (l[1] - u[1]) - (d[1] - f[1]) * (l[0] - u[0]), x = ((u[0] - f[0]) * (l[1] - u[1]) - (u[1] - f[1]) * (l[0] - u[0])) / p;
      return [f[0] + x * (d[0] - f[0]), f[1] + x * (d[1] - f[1])];
    },
    /** Whether vertex k lies inside edge i and the outline passes there from one side to the other. */
    passesThrough(i, c) {
      if (c === i || c === (i + 1) % n) return !1;
      const f = r(i), d = r(i + 1), u = r(c);
      return o(f, d, u) !== 0 || !s(f, d, u) ? !1 : a(f, d, c, -1) * a(f, d, c, 1) < 0;
    }
  };
}
h(Wt, "geometry");
var H = /* @__PURE__ */ h((e) => [e[0], e[1], 0], "xyz");
function Ht(e, t, n) {
  let r = t;
  const o = [], s = /* @__PURE__ */ h((a, i) => ((!Array.isArray(i) || i.length !== 2) && _(`${a} must be a 2D point.`), O(a, i[0], i[1]), i), "point");
  for (const a of n) {
    const i = a.kind === "spline" ? s("Spline point", a.through.at(-1) ?? _("A spline needs at least one point.")) : s("Path point", a.to);
    a.kind === "line" ? o.push(e.Line(H(r), H(i))) : a.kind === "arc" ? o.push(e.ThreePointArc(H(r), H(s("Arc point", a.via)), H(i))) : a.kind === "radiusArc" ? (O("Arc radius", a.radius), o.push(e.RadiusArc(H(r), H(i), a.radius))) : a.kind === "sagittaArc" ? (O("Arc sagitta", a.sagitta), o.push(e.SagittaArc(H(r), H(i), a.sagitta))) : a.kind === "spline" ? o.push(e.Spline(H(r), ...a.through.map((c) => H(s("Spline point", c))))) : _(`Unknown path segment kind '${a.kind}'.`), r = i;
  }
  return Math.hypot(r[0] - t[0], r[1] - t[1]) > 1e-9 && o.push(e.Line(H(r), H(t))), o;
}
h(Ht, "pathEdges");
function ke(e, t) {
  const n = Ut(t);
  if (!n) return;
  const [r, o] = n.at.map((s) => +s.toPrecision(6));
  _(`The ${e} crosses itself at (${r}, ${o}), so it bounds no region. Reorder its points so no edges cross, or give each region its own contour.`);
}
h(ke, "refuseCrossing");
function Kt(e) {
  const t = [];
  for (const n of e) {
    const r = n.pointAt(0), o = n.pointAt(1), a = Math.abs(n.length - Math.hypot(o.x - r.x, o.y - r.y)) <= 1e-9 * Math.max(1, n.length) ? 1 : 32;
    for (let i = 0; i < a; i++) {
      const c = i ? n.pointAt(i / a) : r;
      t.push([c.x, c.y]);
    }
  }
  return t;
}
h(Kt, "loopOutline");
function Vt(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && _("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && _("Each polygon contour needs at least three points.");
        for (const r of n) O("Polygon points", r[0], r[1]);
        ke("polygon contour", n);
      }
      return T("Polygon", () => {
        const n = t.map((o) => e.Polygon(o.map((s) => [s[0], s[1]]))).sort((o, s) => s.area - o.area), r = t.length === 1 ? t[0].filter((o, s, a) => s < a.length - 1 || o[0] !== a[0][0] || o[1] !== a[0][1]) : void 0;
        return j(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)), void 0, r?.map((o) => [o[0], o[1], 0]));
      });
    },
    circle(t) {
      return k("Circle radius", t), T("Circle", () => j(e.Circle(t)));
    },
    rectangle(t, n, r) {
      return k("Rectangle size", t, n), T("Rectangle", () => j(r ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, r) {
      return k("Rounded rectangle size and radius", t, n, r), r >= Math.min(t, n) / 2 && _("The corner radius must be below half the short side."), T("RoundedRectangle", () => j(e.RoundedRectangle(t, n, r)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && _("A path profile needs at least one segment."), O("Path start", ...Array.isArray(t) ? t : [NaN]), T("path", () => {
        const r = Ht(e, t, n), o = Kt(r);
        ke("path outline", o);
        const s = o.length === r.length ? o.map(([a, i]) => [a, i, 0]) : void 0;
        return j(e.makeFace(new e.Wire(r)), new e.Wire(r), s);
      });
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && _("Text must be a non-empty string."), k("Text size", n);
      try {
        return j(e.Text(t, n));
      } catch (r) {
        if (r instanceof e.FontError) throw new C("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${r.message}`, { cause: r });
        return T("Text", () => {
          throw r;
        });
      }
    },
    union: /* @__PURE__ */ h((t, ...n) => T("fuse (2D)", () => j(n.length ? e.fuse(R(t), ...n.map(R)) : R(t))), "union"),
    subtract: /* @__PURE__ */ h((t, ...n) => T("cut (2D)", () => j(n.length ? e.cut(R(t), ...n.map(R)) : R(t))), "subtract"),
    intersect: /* @__PURE__ */ h((t, ...n) => T("intersect (2D)", () => j(n.length ? e.intersect(R(t), ...n.map(R)) : R(t))), "intersect"),
    hull: /* @__PURE__ */ h((...t) => (t.length || _("A hull needs at least one profile."), T("Hull (2D)", () => j(e.Hull(...t.map(R))))), "hull"),
    translate: /* @__PURE__ */ h((t, [n, r]) => (O("Profile offset", n, r), T("translate (2D)", () => j(R(t).translate([n, r, 0])))), "translate"),
    rotate: /* @__PURE__ */ h((t, n) => (O("Profile angle", n), T("rotate (2D)", () => j(R(t).rotate(e.Axis.Z, n)))), "rotate"),
    scale: /* @__PURE__ */ h((t, [n, r]) => (O("Profile scale", n, r), (n === 0 || r === 0) && _("A zero profile scale flattens the profile."), T("scale (2D)", () => j(R(t).scale([n, r, 1])))), "scale"),
    offset: /* @__PURE__ */ h((t, n, r) => (O("Profile offset distance", n), T("offset (2D)", () => j(e.offset(R(t), n, { corners: r ? "round" : "sharp" })))), "offset"),
    bounds: /* @__PURE__ */ h((t) => {
      const n = R(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    }, "bounds"),
    area: /* @__PURE__ */ h((t) => T("area (2D)", () => R(t).area), "area")
  };
}
h(Vt, "createProfileOps");
var Pn = 0.01, _n = 10, In = "MIT AND Apache-2.0", oe = 65536, je, le, On = /* @__PURE__ */ h(() => new URL("" + new URL("smlibwasm-Bw7fxXQ_.wasm", import.meta.url).href, import.meta.url), "defaultWasmUrl");
async function qt(e) {
  if (e.wasmModule) return e.wasmModule;
  if (e.wasmBinary) return e.wasmBinary;
  const t = On(), n = e.locateFile ? e.locateFile("smlibwasm.wasm", new URL(".", t).href) : t.href, r = !!globalThis.process?.versions?.node;
  if (n.startsWith("file:") || r && !/^[a-z]+:/i.test(n)) {
    const { readFile: s } = await import("../geometry.worker-C2GQWGe4.js").then(function(i) {
      return i._;
    }), { fileURLToPath: a } = await import("../geometry.worker-C2GQWGe4.js").then(function(i) {
      return i._;
    });
    return s(n.startsWith("file:") ? a(n) : n);
  }
  const o = await fetch(n);
  if (!o.ok) throw new Error(`fetching ${n}: ${o.status} ${o.statusText}`);
  return new Uint8Array(await o.arrayBuffer());
}
h(qt, "wasmSource");
function Gt(e, t, n) {
  const r = Math.floor(t / oe);
  return (o, s) => {
    let a = 0, i = !1;
    for (const c of Object.values(o))
      for (const [f, d] of Object.entries(c))
        typeof d == "function" && d.name === "_emscripten_resize_heap" && (c[f] = (u) => (a = u >>> 0, d(u)), i = !0);
    return (async () => {
      if (!i) throw new Error("the loader has no _emscripten_resize_heap import to hold the memory ceiling with");
      const c = await qt(e), f = c instanceof WebAssembly.Module ? await WebAssembly.instantiate(c, o) : (await WebAssembly.instantiate(c, o)).instance, d = Object.values(f.exports).find((l) => l instanceof WebAssembly.Memory);
      if (!d) throw new Error("the module exports no memory");
      if (d.buffer.byteLength > r * oe) throw new Error(`the memory ceiling ${t} bytes is below the module's initial ${d.buffer.byteLength} bytes`);
      const u = d.grow.bind(d);
      Object.defineProperty(d, "grow", {
        configurable: !0,
        value: /* @__PURE__ */ h((l) => {
          const p = d.buffer.byteLength / oe;
          if (Math.ceil(a / oe) > r || p >= r) throw new RangeError(`WebAssembly memory ceiling of ${r * oe} bytes reached`);
          return u(Math.min(l, r - p));
        }, "value")
      }), s(f);
    })().catch((c) => n(c instanceof Error ? c : new Error(String(c)))), {};
  };
}
h(Gt, "cappedInstantiation");
async function Yt(e) {
  const { init: t } = await import("./chunk-WNM5TYC5-CHDFOP6j.js").then(function(s) {
    return s.c;
  }), { maxMemoryBytes: n, ...r } = e, o = { ...r };
  delete o.guardSeconds;
  try {
    if (n === void 0) return await t(o);
    (!(n > 0) || !Number.isFinite(n)) && _("maxMemoryBytes must be a positive number of bytes.");
    const s = Math.floor(n / oe) * oe;
    if (le)
      return s !== le.bytes && _(`The kernel was loaded with a memory ceiling of ${le.bytes} bytes; it loads once per process or worker.`), await le.loaded;
    let a = /* @__PURE__ */ h(() => {
    }, "fail");
    const i = new Promise((f, d) => {
      a = d;
    }), c = Promise.race([t({ instantiateWasm: Gt(o, n, a) }), i]);
    le = { bytes: s, loaded: c };
    try {
      const f = await c;
      return je = s, f;
    } catch (f) {
      throw le = void 0, f;
    }
  } catch (s) {
    throw s instanceof C ? s : new C("invalid-input", `Could not load SMLib: ${s instanceof Error ? s.message : String(s)}`, { cause: s });
  }
}
h(Yt, "loadSmlib");
var rt = /* @__PURE__ */ h((e) => {
  const t = e.tolerance ?? Pn, n = e.angleDeg ?? _n;
  return k("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
}, "tolerances");
function Zt({ sm: e, solid: t }) {
  return {
    box(n) {
      return k("Box size", ...n), T("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, r) {
      return k("Cylinder radius and height", n, r), T("Cylinder", () => t("Cylinder", e.Cylinder(n, r)));
    },
    cone(n, r, o) {
      return O("Cone radii", n, r), k("Cone height", o), (n < 0 || r < 0 || !(n > 0 || r > 0)) && _("Cone radii must be non-negative and not both zero."), T("Cone", () => t("Cone", n === r ? e.Cylinder(n, o) : e.Cone(n, r, o)));
    },
    sphere(n) {
      return k("Sphere radius", n), T("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, r) {
      return k("Torus radii", n, r), r >= n && _("The tube radius must be smaller than the major radius."), T("Torus", () => t("Torus", e.Torus(n, r)));
    },
    polyhedron(n, r) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(r) || r.length < 4) && _("A polyhedron needs at least four points and four faces.");
      for (const o of n) O("Polyhedron points", o[0], o[1], o[2]);
      for (const o of r) (!Array.isArray(o) || o.length < 3 || o.some((s) => !Number.isInteger(s) || s < 0 || s >= n.length)) && _("Polyhedron faces must index at least three existing points.");
      return T("stitch (polyhedron)", () => e.scope(() => {
        const o = Dt(n, r).map((a) => {
          const i = a.map((c) => G(n[c]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), s = e.stitch(...o);
        return (!(s instanceof e.Part) || !s.isValid()) && _("The polyhedron faces do not close around a valid solid."), se(s);
      }));
    }
  };
}
h(Zt, "primitives");
function Qt({ sm: e, solid: t }) {
  return {
    extrude(n, r) {
      return k("Extrusion height", r), T("extrude", () => t("extrude", e.extrude(R(n), r)));
    },
    revolve(n, r) {
      return O("Revolution angle", r), (r === 0 || Math.abs(r) > 360) && _("Revolution angle must be in (0, 360] degrees in magnitude."), T("revolve", () => e.scope(() => {
        const o = R(n).rotate(e.Axis.X, 90), s = e.revolve(o, e.Axis.Z, Math.abs(r));
        return t("revolve", r < 0 ? s.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : s);
      }));
    },
    loft(n, r = {}) {
      (!Array.isArray(n) || n.length < 2) && _("A loft needs at least two sections.");
      for (const o of n) O("Loft section position", ...o.at);
      return T("loft", () => e.scope(() => {
        const o = r.pairing ?? "authored";
        o !== "authored" && o !== "closest" && _(`Unknown loft pairing '${String(o)}' (authored or closest).`);
        const s = n.map((f) => et(f.profile)?.length), a = s.some((f) => f !== s[0]);
        if (s.every((f) => f !== void 0) && (a || o === "closest")) {
          const d = (Mt(n.map((u) => et(u.profile).map((l) => [l[0] + u.at[0], l[1] + u.at[1], l[2] + u.at[2]])), o) ?? _("The loft sections cannot be matched vertex to vertex.")).map((u) => new e.Wire(u.map((l, p) => e.Line(G(l), G(u[(p + 1) % u.length])))));
          return t("loft", e.loft(d, { ruled: !!r.ruled }));
        }
        const c = (n.every((f) => Je(f.profile)) ? n.map((f) => Je(f.profile).translate(G(f.at))) : void 0) ?? n.map((f) => R(f.profile).translate(G(f.at)));
        return t("loft", e.loft(c, { ruled: !!r.ruled }));
      }));
    },
    sweep(n, r) {
      (!Array.isArray(r) || r.length < 2) && _("A sweep rail needs at least two points.");
      for (const o of r) O("Sweep rail points", ...o);
      return T("sweep", () => e.scope(() => {
        const o = r.map(G), s = o.length === 2 ? e.Line(o[0], o[1]) : e.Polyline(o);
        return t("sweep", e.sweep(R(n), s));
      }));
    }
  };
}
h(Qt, "sweeps");
function Jt({ sm: e, solid: t }) {
  return {
    union: /* @__PURE__ */ h((n, ...r) => T("fuse", () => t("fuse", r.length ? e.fuse(I(n), ...r.map(I)) : I(n))), "union"),
    subtract: /* @__PURE__ */ h((n, ...r) => T("cut", () => t("cut", r.length ? e.cut(I(n), ...r.map(I)) : I(n))), "subtract"),
    intersect: /* @__PURE__ */ h((n, ...r) => T("intersect", () => t("intersect", r.length ? e.intersect(I(n), ...r.map(I)) : I(n))), "intersect"),
    splitByPlane: /* @__PURE__ */ h((n, r, o) => {
      const s = ge("Split normal", r);
      return O("Split offset", o), T("split", () => {
        const [a, i] = e.split(I(n), new e.Plane([s[0] * o, s[1] * o, s[2] * o], void 0, s), "both");
        return [t("split", a), t("split", i)];
      });
    }, "splitByPlane"),
    translate: /* @__PURE__ */ h((n, r) => (O("Translation", ...r), T("translate", () => se(I(n).translate(G(r))))), "translate"),
    rotate: /* @__PURE__ */ h((n, r, o, s = [0, 0, 0]) => {
      const a = ge("Rotation axis", r);
      return O("Rotation angle and pivot", o, ...s), T("rotate", () => se(I(n).rotate(new e.Axis(G(s), a), o)));
    }, "rotate"),
    mirror: /* @__PURE__ */ h((n, r, o = [0, 0, 0]) => {
      const s = ge("Mirror normal", r);
      return O("Mirror origin", ...o), T("mirror", () => se(I(n).mirror(new e.Plane(G(o), void 0, s))));
    }, "mirror"),
    scale: /* @__PURE__ */ h((n, r) => (O("Scale factors", ...r), r.some((o) => o === 0) && _("A zero scale factor flattens the solid."), T("scale", () => se(I(n).scale(G(r), [0, 0, 0])))), "scale")
  };
}
h(Jt, "booleansAndTransforms");
function en(e) {
  const { sm: t, solid: n, face: r } = e, o = /* @__PURE__ */ h((a, i) => i === "all" ? a.edges() : r(a, i).edges(), "edgesOf"), s = /* @__PURE__ */ h((a) => Array.isArray(a) && typeof a[0] == "number" || !!a && typeof a == "object" && "faceNormal" in a, "isSelector");
  return {
    fillet: /* @__PURE__ */ h((a, i, c = "all") => (k("Fillet radius", i), T("fillet", () => n("fillet", t.fillet(o(I(a), c), i)))), "fillet"),
    chamfer: /* @__PURE__ */ h((a, i, c = "all") => (k("Chamfer distance", i), T("chamfer", () => n("chamfer", t.chamfer(o(I(a), c), i)))), "chamfer"),
    shell: /* @__PURE__ */ h((a, i, c) => {
      k("Shell thickness", i);
      const f = c === void 0 ? [] : s(c) ? [c] : [...c];
      return T("shell", () => {
        const d = I(a), u = f.map((l) => r(d, l));
        return n("shell", t.shell(d, -i, u.length ? u : null));
      });
    }, "shell")
  };
}
h(en, "features");
function tn({ sm: e }) {
  return {
    volume: /* @__PURE__ */ h((t) => T("volume", () => I(t).volume), "volume"),
    area: /* @__PURE__ */ h((t) => T("area", () => I(t).area), "area"),
    // Not SMLib's bbox(): it misses interior extremes of some rotated spheres (see bbox.ts).
    bbox: /* @__PURE__ */ h((t) => T("bbox", () => At(I(t))), "bbox"),
    massProperties: /* @__PURE__ */ h((t) => T("massProperties", () => {
      const n = I(t).massProperties(1), r = n.inertia, o = /* @__PURE__ */ h((c, f) => (r[c][f] + r[f][c]) / 2, "sym"), s = [[r[0][0], o(0, 1), o(0, 2)], [o(0, 1), r[1][1], o(1, 2)], [o(0, 2), o(1, 2), r[2][2]]], { values: a, vectors: i } = pt(s);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: s, principalMoments: a, principalAxes: i };
    }), "massProperties"),
    isValid: /* @__PURE__ */ h((t) => T("isValid", () => I(t).isValid()), "isValid"),
    solidCount: /* @__PURE__ */ h((t) => T("solids", () => e.scope(() => I(t).solids().length)), "solidCount"),
    components: /* @__PURE__ */ h((t) => T("solids", () => [...I(t).solids()].map(se)), "components")
  };
}
h(tn, "measures");
function nn({ sm: e, solid: t }) {
  return {
    tessellate: /* @__PURE__ */ h((n, r = {}) => {
      const { tolerance: o, angle: s } = rt(r);
      return T("mesh", () => e.scope(() => {
        const a = I(n).mesh(o, s), i = Float64Array.from(a.vertices), c = Uint32Array.from(a.triangles);
        return { positions: i, normals: mt(i, c), indices: c };
      }));
    }, "tessellate"),
    exportStl: /* @__PURE__ */ h((n, r = {}) => {
      const { tolerance: o, angle: s } = rt(r);
      return T("toStl", () => e.toStl(I(n), { tolerance: o, angle: s }));
    }, "exportStl"),
    exportStep: /* @__PURE__ */ h((n) => T("toStep", () => e.toStep(I(n))), "exportStep"),
    importStep: /* @__PURE__ */ h((n) => ((typeof n != "string" || !n.length) && _("STEP input must be non-empty text."), T("fromStep", () => {
      const r = e.fromStep(n);
      if (Array.isArray(r) && r.length && r.every((o) => o instanceof e.Part)) {
        const o = r;
        return t("fromStep", o.length === 1 ? o[0] : e.fuse(o[0], ...o.slice(1)));
      }
      return t("fromStep", r);
    })), "importStep")
  };
}
h(nn, "exchange");
async function rn(e = {}) {
  const t = await Yt(e);
  e.guardSeconds !== void 0 && (e.guardSeconds >= 0 || _("guardSeconds must be 0 or more."), t.setGuardSeconds(e.guardSeconds)), t.setWarningHandler(() => {
  });
  const n = gt(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: In,
    profile: Vt(t),
    ...Zt(n),
    ...Qt(n),
    ...Jt(n),
    ...en(n),
    ...tn(n),
    ...nn(n),
    memory: /* @__PURE__ */ h(() => {
      const r = t.memoryUsage();
      return { used: r.used, heap: r.heap, handles: r.handles };
    }, "memory"),
    scope: /* @__PURE__ */ h((r) => t.scope(r), "scope"),
    setGuardSeconds: /* @__PURE__ */ h((r) => (Number(r) >= 0 || _("The guard must be 0 or more seconds."), t.setGuardSeconds(r)), "setGuardSeconds"),
    guardSeconds: /* @__PURE__ */ h(() => t.GUARD_SECONDS, "guardSeconds"),
    ...je !== void 0 ? { maxMemoryBytes: je } : {}
  };
}
h(rn, "createSmlibKernel");
const Nn = "@crispcad/exact-kernel", Rn = "0.1.6", Ln = "smlib", Fn = Object.freeze({ id: Ln, package: Nn, version: Rn }), ot = 16, st = 2048, F = (e) => {
  throw new C("unsupported", e);
}, ie = (e) => {
  throw new C("invalid-input", e);
};
function ae(e, t) {
  t < ot && F(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${ot}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const Bn = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], Xe = (e, t) => {
  const n = [];
  for (let r = 0; r < 3; r++)
    for (let o = 0; o < 4; o++)
      n.push(e[r * 4] * t[o] + e[r * 4 + 1] * t[4 + o] + e[r * 4 + 2] * t[8 + o] + (o === 3 ? e[r * 4 + 3] : 0));
  return n;
}, fe = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), at = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], Dn = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function Ae(e, t) {
  const n = Math.hypot(...e);
  n > 0 || ie("Rotation axis must be non-zero.");
  const [r, o, s] = e.map((d) => d / n), a = t * Math.PI / 180, i = Math.cos(a), c = Math.sin(a), f = 1 - i;
  return [f * r * r + i, f * r * o - c * s, f * r * s + c * o, 0, f * r * o + c * s, f * o * o + i, f * o * s - c * r, 0, f * r * s - c * o, f * o * s + c * r, f * s * s + i, 0];
}
const kn = (e) => Xe(Ae([0, 0, 1], e[2]), Xe(Ae([0, 1, 0], e[1]), Ae([1, 0, 0], e[0])));
function jn(e) {
  const t = Math.hypot(...e);
  t > 0 || ie("Mirror normal must be non-zero.");
  const [n, r, o] = e.map((s) => s / t);
  return [1 - 2 * n * n, -2 * n * r, -2 * n * o, 0, -2 * n * r, 1 - 2 * r * r, -2 * r * o, 0, -2 * n * o, -2 * r * o, 1 - 2 * o * o, 0];
}
function Xn(e) {
  const [t, n, r, , o, s, a, , i, c, f] = e, d = Math.max(-1, Math.min(1, (t + s + f - 1) / 2)), u = Math.acos(d);
  if (u < 1e-15)
    return null;
  let l = [c - a, r - i, o - n];
  return Math.hypot(...l) < 1e-9 && (l = [[t + 1, o, i], [n, s + 1, c], [r, a, f + 1]].reduce((x, v) => Math.hypot(...v) > Math.hypot(...x) ? v : x)), { axis: l, degrees: u * 180 / Math.PI };
}
function Un(e) {
  const t = [0, 1, 2].map((a) => [e[a], e[4 + a], e[8 + a]]), n = t.map((a) => Math.hypot(...a));
  n.some((a) => !(a > 1e-12)) && ie("Affine matrix is singular.");
  for (const [a, i] of [[0, 1], [0, 2], [1, 2]]) {
    const c = t[a][0] * t[i][0] + t[a][1] * t[i][1] + t[a][2] * t[i][2];
    Math.abs(c) > 1e-9 * n[a] * n[i] && F("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const r = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), o = [n[0], n[1], r < 0 ? -n[2] : n[2]], s = [0, 1, 2].flatMap((a) => [e[a * 4] / o[0], e[a * 4 + 1] / o[1], e[a * 4 + 2] / o[2], 0]);
  return { scale: o, rotation: s, translate: [e[3], e[7], e[11]] };
}
function on(e, t, n, r) {
  const o = e.map((a, i) => {
    if (!a)
      return 0;
    const c = r[i] - n[i];
    return c < 1e-12 && ie("Cannot resize a degenerate shape."), a / c;
  }), s = Math.max(...o) || 1;
  return o.map((a, i) => e[i] ? a : t?.[i] ? s : 1);
}
function Q(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return ae("circle2d", t.segments), e.profile.circle(t.radius);
    case "rectangle":
      return e.profile.rectangle(t.size[0], t.size[1], t.center);
    case "move": {
      const n = Q(e, t.profile);
      return n && e.profile.translate(n, t.vector);
    }
    case "rotate": {
      const n = Q(e, t.profile);
      return n && e.profile.rotate(n, t.angle);
    }
    case "scale": {
      const n = Q(e, t.profile);
      return n && e.profile.scale(n, t.vector);
    }
    case "affine": {
      const n = Q(e, t.profile);
      if (!n)
        return null;
      const [r, o, s, a, i, c] = t.matrix, f = Math.hypot(r, a), d = Math.hypot(o, i);
      f > 1e-12 && d > 1e-12 || ie("2D affine matrix is singular."), Math.abs(r * o + a * i) > 1e-9 * f * d && F("2D affine transforms with shear have no exact lowering here.");
      const u = r * i - o * a;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [f, u < 0 ? -d : d]), Math.atan2(a, r) * 180 / Math.PI), [s, c]);
    }
    case "resize": {
      const n = Q(e, t.profile);
      if (!n)
        return null;
      const r = e.profile.bounds(n), o = on(t.size, t.auto, r.min, r.max);
      return e.profile.scale(n, [o[0], o[1]]);
    }
    case "offset": {
      t.round && ae("offset2d", t.segments);
      const n = Q(e, t.profile);
      return n && e.profile.offset(n, t.distance, t.round);
    }
    case "text":
      return F("text2d needs a font outline path, and the exact kernel package ships no font.");
    case "minkowski":
      return F("minkowski2d has no exact lowering (planar Minkowski sums of curved profiles are not exposed by this kernel adapter).");
    case "union":
    case "subtract":
    case "intersect":
    case "hull": {
      const n = t.profiles.map((s) => Q(e, s)), r = n.filter((s) => s !== null);
      if (t.kind === "union")
        return r.length ? e.profile.union(r[0], ...r.slice(1)) : null;
      if (t.kind === "hull")
        return r.length ? e.profile.hull(...r) : null;
      if (t.kind === "intersect")
        return n.some((s) => s === null) || !r.length ? null : e.profile.intersect(r[0], ...r.slice(1));
      if (!n[0])
        return null;
      const o = n.slice(1).filter((s) => s !== null);
      return o.length ? e.profile.subtract(n[0], ...o) : n[0];
    }
    default:
      return F(`Profile '${t.kind}' has no exact lowering.`);
  }
}
function ue(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, r = e.center ? -t / 2 : 0, o = e.center ? -n / 2 : 0;
      return [[r, o], [r + t, o], [r + t, o + n], [r, o + n]];
    }
    case "move":
      return ue(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return ue(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), r = Math.sin(t);
      return ue(e.profile).map(([o, s]) => [n * o - r * s, r * o + n * s]);
    }
    case "affine": {
      const t = e.matrix;
      return ue(e.profile).map(([n, r]) => [t[0] * n + t[1] * r + t[2], t[3] * n + t[4] * r + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(ue);
    case "empty":
      return [];
    default:
      return F(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function Ue(e, t, n) {
  const r = (o, s) => Ue(s, Xe(t, o), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const o of e.shapes)
        Ue(o, t, n);
      return;
    case "move":
      return r(at(e.vector), e.shape);
    case "rotate":
      return r(kn(e.vector), e.shape);
    case "scale":
      return r(Dn(e.vector), e.shape);
    case "mirror":
      return r(jn(e.vector), e.shape);
    case "axisRotate":
      return r(Ae(e.vector, e.angle), e.shape);
    case "affine":
      return r(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let o = 0; o < e.count; o++)
        r(at(e.step.map((s) => s * o)), e.shape);
      return;
    case "box": {
      const [o, s, a] = e.size.map((i) => i / 2);
      for (const i of [-o, o])
        for (const c of [-s, s])
          for (const f of [-a, a])
            n.points.push(fe(t, [i, c, f]));
      return;
    }
    case "polyhedron":
      for (const o of e.points)
        n.points.push(fe(t, o));
      return;
    case "extrude":
      for (const [o, s] of e.points)
        for (const a of [0, e.height])
          n.points.push(fe(t, [o, s, a]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && F("hull of a twisted extrusion has no exact lowering.");
      for (const [o, s] of ue(e.profile))
        n.points.push(fe(t, [o, s, 0])), n.points.push(fe(t, [o * e.scaleTop[0], s * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      ae("sphere", e.segments);
      const o = [0, 1, 2].map((s) => Math.hypot(t[s], t[4 + s], t[8 + s]));
      Math.max(...o) - Math.min(...o) > 1e-12 * Math.max(...o) && F("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: fe(t, [0, 0, 0]), radius: e.radius * o[0] });
      return;
    }
    default:
      F(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function Wn(e, t) {
  const n = { points: [], spheres: [] };
  for (const l of t)
    Ue(l, Bn, n);
  if (n.points.length && n.spheres.length && F("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const l = Ve(n.points);
    return e.polyhedron(l.points, l.faces);
  }
  if (!n.spheres.length)
    return null;
  const r = n.spheres[0].radius;
  n.spheres.some((l) => Math.abs(l.radius - r) > 1e-12 * r) && F("hull of spheres with different radii has no exact lowering.");
  const o = n.spheres.map((l) => l.centre), s = [0, 1, 2].map((l) => Math.min(...o.map((p) => p[l]))), a = [0, 1, 2].map((l) => Math.max(...o.map((p) => p[l]))), i = a.map((l, p) => l - s[p]), c = 1e-9 * Math.max(1, ...i);
  if (i.every((l) => l <= c))
    return e.translate(e.sphere(r), s);
  const f = (l) => [l & 1 ? a[0] : s[0], l & 2 ? a[1] : s[1], l & 4 ? a[2] : s[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((l) => o.some((p) => p.every((x, v) => Math.abs(x - f(l)[v]) <= c))) || i.some((l) => l <= c)) && F("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const u = e.box(i.map((l) => l + 2 * r));
  return e.translate(e.fillet(u, r, "all"), s.map((l, p) => l + i[p] / 2));
}
function sn(e, t, n) {
  const r = e.profile.bounds(t), o = r.max[0] <= 0;
  r.min[0] < -1e-8 && !o && ie("Revolved profiles must stay on one side of the radial axis.");
  const s = Math.abs(n);
  s > 360 && ie("Revolution angle exceeds 360 degrees.");
  let a = e.revolve(o ? e.profile.scale(t, [-1, 1]) : t, n);
  return o && s !== 360 && (a = e.rotate(a, [0, 0, 1], 180)), a;
}
function Hn(e, t, n) {
  const { scale: r, rotation: o, translate: s } = Un(n);
  let a = r.every((c) => Math.abs(c - 1) < 1e-15) ? t : e.scale(t, r);
  const i = Xn(o);
  return i && (a = e.rotate(a, i.axis, i.degrees)), s.some((c) => c !== 0) ? e.translate(a, s) : a;
}
function qe(e, t) {
  const n = (r) => qe(e, r);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return ae("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return ae("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return ae("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && F("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && F("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const r = Q(e, t.profile);
      return r && e.extrude(r, t.height);
    }
    case "revolve": {
      if (ae("revolve", t.segments), t.angle === 0)
        return null;
      const r = Q(e, t.profile);
      return r && sn(e, r, t.angle);
    }
    case "polyhedron": {
      if (t.smooth)
        return qn(e, t.smooth);
      if (t.ruled)
        return Vn(e, t.ruled, t.points, t.faces);
      if (t.faces.length > st && F(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${st} faces).`), Xt(t.points, t.faces)) {
        const r = Ve(t.points);
        return e.polyhedron(r.points, r.faces);
      }
      return e.polyhedron(t.points, t.faces);
    }
    case "union":
    case "subtract":
    case "intersect": {
      const r = (c) => c.kind === "union" ? c.shapes.flatMap(r) : [c], s = (t.kind === "subtract" ? [t.shapes[0], ...t.shapes.slice(1).flatMap(r)] : t.shapes).map(n), a = s.filter((c) => c !== null);
      if (t.kind === "union")
        return a.length ? e.union(a[0], ...a.slice(1)) : null;
      if (t.kind === "intersect")
        return s.some((c) => c === null) || !a.length ? null : e.intersect(a[0], ...a.slice(1));
      if (!s[0])
        return null;
      const i = s.slice(1).filter((c) => c !== null);
      return i.length ? e.subtract(s[0], ...i) : s[0];
    }
    case "hull":
      return Wn(e, t.shapes);
    case "minkowski":
      return F("minkowski has no exact lowering (a general Minkowski sum is not a B-rep operation of this adapter; use fillet/offset intent instead).");
    case "move": {
      const r = n(t.shape);
      return r && e.translate(r, t.vector);
    }
    case "rotate": {
      const r = n(t.shape);
      if (!r)
        return null;
      let o = r;
      for (const [s, a] of [[[1, 0, 0], t.vector[0]], [[0, 1, 0], t.vector[1]], [[0, 0, 1], t.vector[2]]])
        a && (o = e.rotate(o, s, a));
      return o;
    }
    case "scale": {
      const r = n(t.shape);
      return r && e.scale(r, t.vector);
    }
    case "mirror": {
      const r = n(t.shape);
      return r && e.mirror(r, t.vector);
    }
    case "axisRotate": {
      const r = n(t.shape);
      return r && (t.angle ? e.rotate(r, t.vector, t.angle) : r);
    }
    case "affine": {
      const r = n(t.shape);
      return r && Hn(e, r, t.matrix.slice(0, 12));
    }
    case "resize": {
      const r = n(t.shape);
      if (!r)
        return null;
      const o = e.bbox(r);
      return e.scale(r, on(t.vector, t.auto, o.min, o.max));
    }
    case "repeat": {
      const r = t.count >= 1 ? n(t.shape) : null;
      if (!r)
        return null;
      const o = Array.from({ length: t.count }, (s, a) => a === 0 ? r : e.translate(r, t.step.map((i) => i * a)));
      return o.length > 1 ? e.union(o[0], ...o.slice(1)) : o[0];
    }
    default:
      return F(`CAD Script '${t.kind}' has no exact lowering.`);
  }
}
function Kn(e, t) {
  let n = 0;
  for (const r of t)
    for (let o = 1; o + 1 < r.length; o++) {
      const s = e[r[0]], a = e[r[o]], i = e[r[o + 1]];
      n += s[0] * (a[1] * i[2] - a[2] * i[1]) - s[1] * (a[0] * i[2] - a[2] * i[0]) + s[2] * (a[0] * i[1] - a[1] * i[0]);
    }
  return n / 6;
}
function Vn(e, t, n, r) {
  const o = e.loft(t.map((i) => ({ profile: e.profile.polygon([i.map((c) => [c[0], c[1]])]), at: [0, 0, i[0][2]] })), { ruled: !0 }), s = Kn(n, r), a = e.volume(o);
  if (!(Math.abs(a - s) <= 1e-7 * Math.abs(s)))
    throw o.dispose(), new C("kernel-failure", `The ruled loft's volume ${a} differs from its faceted volume ${s}; the kernel did not keep the vertex correspondence.`);
  return o;
}
function qn(e, t) {
  const n = e.loft(t.map((s) => ({ profile: e.profile.polygon([s.map((a) => [a[0], a[1]])]), at: [0, 0, s[0][2]] })), { ruled: !1 }), r = mn(gn(t)), o = e.volume(n);
  if (!(Math.abs(o - r) <= 1e-7 * Math.abs(r)))
    throw n.dispose(), new C("kernel-failure", `The smooth loft's volume ${o} differs from the volume ${r} of the surface CAD Script defines; the kernel built another surface.`);
  return n;
}
function br(e, t) {
  let n;
  try {
    n = ht(t).shape;
  } catch (o) {
    throw o instanceof pn ? new C("invalid-input", `CAD Script: ${o.message}`, { cause: o }) : o;
  }
  const r = e.scope(() => qe(e, n));
  if (!r)
    throw new C("invalid-input", "The program produces no solid.");
  if (!(e.volume(r) > 0))
    throw r.dispose(), new C("kernel-failure", "The exact result has no positive volume.");
  return r;
}
const Ar = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} }), Te = 1048576, an = 4, Gn = Object.freeze({ maxFeatureEdges: 400, maxShellFaces: 160, maxMemoryBytes: 512 * Te, recycleAboveBytes: 192 * Te, requestTimeoutMs: 6e4 }), Er = Object.freeze({ maxFeatureEdges: 1e3, maxShellFaces: 500, maxMemoryBytes: 2048 * Te, recycleAboveBytes: 512 * Te, requestTimeoutMs: 12e4 }), Sr = Object.freeze({ maxFeatureEdges: 1 / 0, maxShellFaces: 1 / 0, maxMemoryBytes: 1 / 0, recycleAboveBytes: 1 / 0, requestTimeoutMs: 1 / 0 });
function $r(e, t = Gn) {
  const n = { ...t };
  for (const r of Object.keys(t)) {
    const o = e?.[r];
    typeof o == "number" && o > 0 && (n[r] = o);
  }
  return Object.freeze(n);
}
function Yn(e) {
  const t = e.requestTimeoutMs;
  return Number.isFinite(t) && t > 0 ? Math.max(1, Math.floor(t / 2e3)) : void 0;
}
function Zn(e) {
  const t = Yn(e);
  return { ...Number.isFinite(e.maxMemoryBytes) && e.maxMemoryBytes > 0 ? { maxMemoryBytes: e.maxMemoryBytes } : {}, ...t !== void 0 ? { guardSeconds: t } : {} };
}
const Qn = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
};
function Jn(e, t) {
  const [n, r, o] = t.faceNormal, s = Math.hypot(n, r, o);
  if (!(s > 0))
    return;
  const a = [n / s, r / s, o / s], i = e.filter((f) => {
    if (f.isPlanar === !1 || f.isPlanar === void 0 && f.geomType !== "plane")
      return !1;
    const d = f.normalAt();
    return d.x * a[0] + d.y * a[1] + d.z * a[2] > 1 - 1e-9;
  });
  if (!t.outermost)
    return i.length === 1 ? i[0] : void 0;
  const c = (f) => {
    const d = f.center?.();
    return d ? d.x * a[0] + d.y * a[1] + d.z * a[2] : 0;
  };
  return i.sort((f, d) => c(d) - c(f))[0];
}
function er(e, t, n = "all") {
  const r = Qn(e);
  if (!r)
    return;
  const o = [...r.faces()];
  let s;
  if (t !== "shell" && n !== "all") {
    const c = Jn(o, n);
    if (!c)
      return { edges: 0, curvedEdges: 0, faces: o.length, weightedEdges: 0 };
    s = c.edges();
  } else if (r.edges)
    s = r.edges();
  else {
    const c = /* @__PURE__ */ new Map();
    let f = 0;
    for (const d of o)
      for (const u of d.edges())
        c.set(u._identity?.() ?? String(f++), u);
    s = c.values();
  }
  let a = 0, i = 0;
  for (const c of s)
    a++, c.geomType !== "line" && i++;
  return { edges: a, curvedEdges: i, faces: o.length, weightedEdges: a - i + an * i };
}
function tr(e, t, n, r) {
  if (!Number.isFinite(r.maxFeatureEdges) && !Number.isFinite(r.maxShellFaces))
    return;
  const o = er(e, t, n);
  if (o) {
    if (t === "shell") {
      if (o.faces > r.maxShellFaces)
        throw new C("unsupported", N`Shelling a body with ${o.faces} faces is too much for the exact kernel on this device, which allows ${r.maxShellFaces}. Shell a simpler body, or add the holes after shelling.`);
    } else if (o.weightedEdges > r.maxFeatureEdges) {
      const s = Math.floor(r.maxFeatureEdges / an), a = r.maxFeatureEdges;
      throw new C("unsupported", t === "fillet" ? N`Rounding ${o.edges} edges (${o.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${s} curved or ${a} straight edges per feature. Choose a face with fewer edges.` : N`Beveling ${o.edges} edges (${o.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${s} curved or ${a} straight edges per feature. Choose a face with fewer edges.`);
    }
    return o;
  }
}
class it extends C {
  constructor(n, r) {
    super(n.code, n.message, r);
    ce(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const ye = (e) => {
  throw new C("unsupported", e);
};
function ct(e, t, n) {
  if (!n?.some((o) => o !== 0))
    return Ye([...t]), e.profile.polygon([t]);
  Ye([...t], [...n]);
  const r = t.map((o, s) => {
    const a = t[(s + 1) % t.length], i = n[s] ?? 0;
    return i ? { kind: "arc", via: An(o, a, i), to: a } : { kind: "line", to: a };
  });
  return e.profile.path(t[0], r);
}
const lt = (e, t, n) => {
  const r = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(r, [t[0], t[1]]) : r;
};
function ft(e, t, n) {
  const r = t.profile;
  switch (r.kind) {
    case "rectangle":
      return e.profile.rectangle(re(r.width, n), re(r.depth, n), !0);
    case "circle":
      return lt(e, r.center ?? [0, 0], re(r.radius, n));
    case "outline":
      return ct(e, r.points, r.bulges);
    case "region": {
      yn(r.loops, (a) => re(a, n));
      const o = (a) => a.kind === "circle" ? lt(e, [re(a.center[0], n), re(a.center[1], n)], re(a.radius, n)) : ct(e, a.points, a.bulges), s = r.loops.map(o).map((a) => ({ profile: a, area: e.profile.area(a) })).sort((a, i) => i.area - a.area);
      return e.profile.subtract(s[0].profile, ...s.slice(1).map((a) => a.profile));
    }
    case "path":
      return ye("Close the sketch path before creating a solid.");
    default:
      return ye(`Sketch profile '${r.kind}' has no exact lowering.`);
  }
}
function me(e, t, n) {
  let r = t;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((o, s) => {
    n[s] && (r = e.rotate(r, o, n[s]));
  }), r;
}
function de(e, t, n, r, o, s) {
  const a = o.get(n);
  if (a)
    return a;
  const i = t.nodes[n];
  let c;
  try {
    switch (i.kind) {
      case "box":
        c = e.box(i.size);
        break;
      case "cylinder":
        c = e.cylinder(i.radius, i.height);
        break;
      case "sphere":
        c = e.sphere(i.radius);
        break;
      case "code": {
        const l = qe(e, ht(i.program).shape);
        if (!l)
          throw new C("invalid-input", "Code produces no printable solid.");
        c = l;
        break;
      }
      case "extrusion": {
        const { distance: l, start: p, plane: x } = bn(i, t);
        c = e.extrude(ft(e, t.sketches[i.sketchId], t), l), p && (c = e.translate(c, [0, 0, p])), x === "XZ" ? c = me(e, c, [90, 0, 0]) : x === "YZ" && (c = me(e, c, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: l, angle: p, axisOffset: x } = Mn(i, t);
        let v = ft(e, t.sketches[i.sketchId], t);
        x && (v = e.profile.translate(v, [-x, 0])), c = sn(e, v, p), l === "XY" ? c = me(e, c, [-90, 0, 0]) : l === "YZ" && (c = me(e, c, [0, 0, 90])), x && (c = e.translate(c, l === "YZ" ? [0, x, 0] : [x, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: l, offset: p } = wn(i, t), x = [0, 0, 0];
        if (x[l] = 1, c = e.mirror(de(e, t, i.source, r, o, s), x), p) {
          const v = [0, 0, 0];
          v[l] = 2 * p, c = e.translate(c, v);
        }
        break;
      }
      case "pattern": {
        const l = vn(i, t), p = de(e, t, i.source, r, o, s), x = [p];
        if (l.mode === "linear")
          for (let v = 1; v < l.count; v++) {
            const g = [0, 0, 0];
            g[l.axis] = v * l.spacing, x.push(e.translate(p, g));
          }
        else {
          const v = l.sweep / (Math.abs(l.sweep) === 360 ? l.count : l.count - 1), g = [0, 0, 0];
          g[l.axis] = 1;
          for (let y = 1; y < l.count; y++)
            x.push(e.rotate(p, g, y * v, l.center));
        }
        c = e.union(x[0], ...x.slice(1));
        break;
      }
      case "boolean": {
        const l = i.inputs.map((p) => de(e, t, p, r, o, s));
        if (i.useHoleRoles) {
          const p = l.filter((g, y) => t.nodes[i.inputs[y]].role !== "hole"), x = l.filter((g, y) => t.nodes[i.inputs[y]].role === "hole");
          p.length || ye("A combination of holes only has no solid to export.");
          const v = p.length > 1 ? e.union(p[0], ...p.slice(1)) : p[0];
          c = x.length ? e.subtract(v, ...x) : v;
        } else
          c = i.operation === "union" ? e.union(l[0], ...l.slice(1)) : i.operation === "subtract" ? e.subtract(l[0], ...l.slice(1)) : e.intersect(l[0], ...l.slice(1));
        break;
      }
      case "exact-feature": {
        const l = xn(i, t), p = de(e, t, i.source, r, o, s);
        s && tr(p, l.operation, l.edges, s), c = l.operation === "fillet" ? e.fillet(p, l.size, l.edges) : l.operation === "chamfer" ? e.chamfer(p, l.size, l.edges) : e.shell(p, l.size, l.openFaces);
        break;
      }
      case "mesh":
        return ye(i.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return ye(`'${i.kind}' has no exact lowering.`);
    }
    const { scale: f, rotation: d, position: u } = i.transform;
    f.some((l) => l !== 1) && (c = e.scale(c, f)), c = me(e, c, d), u.some((l) => l !== 0) && (c = e.translate(c, u));
  } catch (f) {
    if (f instanceof it)
      throw f;
    const d = f instanceof C ? f.code : "invalid-input";
    let u = f instanceof Error ? f.message : String(f);
    const l = /the kernel did not finish within ([\d.]+) s/.exec(u);
    throw l && (u = N`The exact kernel stopped this step at its own ${l[1]} s limit, so it was not built. The model was not changed. Try a simpler body.`), new it({ code: d, bodyId: r, nodeId: n, feature: i.kind, message: `${i.name} (${i.kind}): ${u}` }, { cause: f });
  }
  return o.set(n, c), c;
}
function nr(e, t, n, r = {}) {
  if (!t.roots.includes(n))
    throw new C("invalid-input", `${n} is not a top-level body.`);
  return de(e, t, n, n, /* @__PURE__ */ new Map(), r.limits);
}
function rr(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (!o)
    throw new C("invalid-input", `${n} is not a node of this model.`);
  const s = r.local ? { ...t, nodes: { ...t.nodes, [n]: { ...o, transform: En() } } } : t, a = t.roots.find((i) => i === n) ?? n;
  return de(e, s, n, a, /* @__PURE__ */ new Map(), r.limits);
}
const or = 8, q = (e, t, n) => (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x), xe = (e, t) => e.x === t.x && e.y === t.y;
function sr(e, t) {
  let n = 0;
  for (let r = 0, o = t.length - 1; r < t.length; o = r++)
    n += e[2 * t[o]] * e[2 * t[r] + 1] - e[2 * t[r]] * e[2 * t[o] + 1];
  return n / 2;
}
function ut(e, t, n) {
  let r, o;
  for (const s of t) {
    const a = { i: s, x: e[2 * s], y: e[2 * s + 1], removed: !1 };
    r ? (o.next = a, a.prev = o) : r = a, o = a, n.push(a);
  }
  return o.next = r, r.prev = o, r;
}
function Ie(e, t) {
  const n = e.prev, r = e.next;
  return q(n, e, r) >= 0 ? q(e, r, t) > 0 && q(e, t, n) > 0 : !(q(e, n, t) > 0 && q(e, t, r) > 0);
}
function cn(e, t, n, r, o) {
  const s = q(e, t, r), a = q(t, n, r), i = q(n, e, r);
  return o ? s > 0 && a > 0 && i > 0 : s >= 0 && a >= 0 && i >= 0;
}
function ar(e, t, n) {
  const r = { ...e }, o = { ...t }, s = e.next, a = t.prev;
  e.next = t, t.prev = e, r.next = s, s.prev = r, o.next = r, r.prev = o, a.next = o, o.prev = a, n.push(r, o);
}
function ir(e, t) {
  let n, r = 1 / 0, o = t;
  do {
    const f = o.next;
    if (o.y <= e.y && e.y < f.y || f.y <= e.y && e.y < o.y) {
      const d = o.y === e.y ? o.x : f.y === e.y ? f.x : o.x + (e.y - o.y) * (f.x - o.x) / (f.y - o.y);
      if (d === e.x)
        return;
      d > e.x && d < r && (r = d, n = o.y === e.y ? o : f.y === e.y ? f : o.x > f.x ? o : f);
    }
    o = f;
  } while (o !== t);
  if (!n)
    return;
  const s = { x: r, y: e.y };
  let a = n, i = -1 / 0, c = 1 / 0;
  if (n.x !== r || n.y !== e.y) {
    i = (n.x - e.x) / Math.hypot(n.x - e.x, n.y - e.y), c = Math.hypot(n.x - e.x, n.y - e.y);
    const [f, d, u] = q(e, s, n) > 0 ? [e, s, n] : [e, n, s];
    o = t;
    do {
      if (o !== n && !xe(o, n) && cn(f, d, u, o, !1) && !(o.x === e.x && o.y === e.y)) {
        const l = Math.hypot(o.x - e.x, o.y - e.y), p = (o.x - e.x) / l;
        (p > i || p === i && l < c) && Ie(o, e) && (a = o, i = p, c = l);
      }
      o = o.next;
    } while (o !== t);
  }
  if (!Ie(a, e)) {
    o = t;
    do {
      if (xe(o, a) && Ie(o, e))
        return o;
      o = o.next;
    } while (o !== t);
    return;
  }
  return a;
}
function cr(e, t) {
  if (!t.length || t.some((m) => m.length < 3))
    return null;
  const n = [], r = t.map((m) => sr(e, m));
  if (!(Math.abs(r[0]) > 0))
    return null;
  const o = t.map((m, b) => b === 0 == r[b] > 0 ? m : [...m].reverse()), s = ut(e, o[0], n), a = o.slice(1).map((m) => {
    const b = ut(e, m, n);
    let E = b, P = b.next;
    for (; P !== b; )
      (P.x > E.x || P.x === E.x && P.y > E.y) && (E = P), P = P.next;
    return E;
  });
  a.sort((m, b) => b.x - m.x || b.y - m.y);
  for (const m of a) {
    const b = ir(m, s);
    if (!b)
      return null;
    ar(b, m, n);
  }
  let i = 1 / 0, c = 1 / 0, f = -1 / 0, d = -1 / 0;
  for (const m of n)
    m.x < i && (i = m.x), m.y < c && (c = m.y), m.x > f && (f = m.x), m.y > d && (d = m.y);
  const u = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(n.length / 2)))), l = (f - i) / u || 1, p = (d - c) / u || 1, x = (m, b, E) => Math.min(u - 1, Math.max(0, Math.floor((m - b) / E))), v = Array.from({ length: u * u }, () => []);
  for (const m of n)
    v[x(m.y, c, p) * u + x(m.x, i, l)].push(m);
  const g = (m, b) => {
    const E = m.prev, P = m.next, Z = q(E, m, P);
    if (b ? Z < 0 : Z <= 0)
      return !1;
    const ee = x(Math.min(E.x, m.x, P.x), i, l), W = x(Math.max(E.x, m.x, P.x), i, l), fn = x(Math.min(E.y, m.y, P.y), c, p), un = x(Math.max(E.y, m.y, P.y), c, p);
    for (let Pe = fn; Pe <= un; Pe++)
      for (let _e = ee; _e <= W; _e++)
        for (const te of v[Pe * u + _e])
          if (!(te.removed || te === E || te === m || te === P || xe(te, E) || xe(te, m) || xe(te, P)) && cn(E, m, P, te, !1))
            return !1;
    return !0;
  }, y = [];
  let w = s, S = w, A = !1, M = 0;
  {
    let m = s;
    do
      M++, m = m.next;
    while (m !== s);
  }
  for (; M > 3; ) {
    if (g(w, A)) {
      y.push(w.prev.i, w.i, w.next.i), w.removed = !0, w.prev.next = w.next, w.next.prev = w.prev, M--, w = w.next, S = w, A = !1;
      continue;
    }
    if (w = w.next, w === S) {
      if (A)
        return null;
      A = !0;
    }
  }
  if (q(w.prev, w, w.next) < 0)
    return null;
  y.push(w.prev.i, w.i, w.next.i);
  const $ = r.reduce((m, b, E) => m + (E === 0 ? Math.abs(b) : -Math.abs(b)), 0);
  let z = 0;
  for (let m = 0; m < y.length; m += 3) {
    const b = y[m], E = y[m + 1], P = y[m + 2];
    z += ((e[2 * E] - e[2 * b]) * (e[2 * P + 1] - e[2 * b + 1]) - (e[2 * E + 1] - e[2 * b + 1]) * (e[2 * P] - e[2 * b])) / 2;
  }
  return Math.abs(z - $) <= 1e-9 * Math.abs(r[0]) + 1e-12 ? y : null;
}
const ln = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
}, ze = class ze {
  constructor() {
    ce(this, "positions", []);
    ce(this, "cells", /* @__PURE__ */ new Map());
  }
  add(t, n, r) {
    const o = ze.Q, s = Math.round(t / o), a = Math.round(n / o), i = Math.round(r / o);
    let c = this.cells.get(`${s},${a},${i}`);
    if (c !== void 0)
      return c;
    const f = t / o - s, d = n / o - a, u = r / o - i, l = Math.abs(f) > 0.4 ? Math.sign(f) : 0, p = Math.abs(d) > 0.4 ? Math.sign(d) : 0, x = Math.abs(u) > 0.4 ? Math.sign(u) : 0;
    if (l || p || x) {
      for (const v of l ? [0, l] : [0])
        for (const g of p ? [0, p] : [0])
          for (const y of x ? [0, x] : [0])
            if (c = this.cells.get(`${s + v},${a + g},${i + y}`), c !== void 0)
              return this.cells.set(`${s},${a},${i}`, c), c;
    }
    return c = this.positions.length / 3, this.positions.push(t, n, r), this.cells.set(`${s},${a},${i}`, c), c;
  }
};
ce(ze, "Q", 1e-6);
let We = ze;
function lr(e) {
  const t = ln(e);
  if (!t)
    return !1;
  for (const n of t.faces())
    if (n.geomType === "plane" && n.wires().length >= or)
      return !0;
  return !1;
}
function fr(e, t, n) {
  const r = ln(t);
  if (!r)
    return;
  const o = [...r.faces()], s = new We(), a = [], i = /* @__PURE__ */ new Map(), c = (l) => {
    const p = new Uint32Array(l.vertices.length / 3);
    for (let g = 0; g < p.length; g++)
      p[g] = s.add(l.vertices[3 * g], l.vertices[3 * g + 1], l.vertices[3 * g + 2]);
    const x = /* @__PURE__ */ new Set(), v = [];
    for (let g = 0; g < l.triangles.length; g += 3) {
      const y = p[l.triangles[g]], w = p[l.triangles[g + 1]], S = p[l.triangles[g + 2]];
      y === w || w === S || S === y || (a.push(y, w, S), x.add(`${y},${w}`), x.add(`${w},${S}`), x.add(`${S},${y}`));
    }
    for (const g of x) {
      const [y, w] = g.split(",").map(Number);
      x.has(`${w},${y}`) || v.push([y, w]);
    }
    return v;
  }, f = [];
  let d = 0;
  for (const l of o) {
    if (l.geomType === "plane") {
      f.push(l);
      continue;
    }
    const p = n.bands !== !1 ? ur(l, n) : void 0;
    p && d++, i.set(l._identity(), c(p ?? l.mesh(n.tolerance, n.angleDeg)));
  }
  let u = 0;
  for (const l of f) {
    const p = dr(l, s, i), x = l.normalAt(), v = [x.x, x.y, x.z], g = Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], y = Ge(pe(g, v)), w = pe(v, y);
    let S = null;
    if (p && p.length === l.wires().length) {
      const A = [...new Set(p.flat())], M = new Map(A.map((m, b) => [m, b])), $ = new Float64Array(2 * A.length);
      A.forEach((m, b) => {
        const E = s.positions;
        $[2 * b] = E[3 * m] * y[0] + E[3 * m + 1] * y[1] + E[3 * m + 2] * y[2], $[2 * b + 1] = E[3 * m] * w[0] + E[3 * m + 1] * w[1] + E[3 * m + 2] * w[2];
      });
      const z = cr($, p.map((m) => m.map((b) => M.get(b))));
      z && (S = z.map((m) => A[m]));
    }
    S ? a.push(...S) : (u++, c(l.mesh(n.tolerance, n.angleDeg)));
  }
  return { positions: s.positions, indices: a, planar: f.length - u, planarFallbacks: u, bands: d };
}
function ur(e, t) {
  if (e.geomType !== "cylinder")
    return;
  const n = [...e.edges()];
  if (n.length !== 2)
    return;
  for (const A of n)
    if (A.geomType !== "circle" || !A.isClosed || ![...A.faces()].every((M) => M.geomType === "plane" || M._identity() === e._identity()))
      return;
  const r = n[0].radius, o = n[0].arcCenter, s = n[1].arcCenter;
  if (!(r > 0) || Math.abs(n[1].radius - r) > 1e-9 * Math.max(1, r) || Math.abs(e.radius - r) > 1e-7 * Math.max(1, r))
    return;
  const a = [s.x - o.x, s.y - o.y, s.z - o.z], i = Math.hypot(a[0], a[1], a[2]);
  if (!(i > 0))
    return;
  const c = a.map((A) => A / i);
  for (const A of n) {
    const M = A.normal;
    if (Math.abs(M.x * c[0] + M.y * c[1] + M.z * c[2]) < 1 - 1e-9)
      return;
  }
  const f = Math.acos(Math.max(-1, 1 - t.tolerance / r)), d = Math.max(8, Math.ceil(360 / t.angleDeg), Math.ceil(Math.PI / Math.max(f, 1e-9)));
  if (d > 4096)
    return;
  const u = Math.abs(c[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], l = Ge(pe(u, c)), p = pe(c, l), x = new Float64Array(6 * d), v = new Uint32Array(6 * d);
  for (let A = 0; A < d; A++) {
    const M = 2 * Math.PI * A / d, $ = Math.cos(M), z = Math.sin(M);
    for (let m = 0; m < 3; m++) {
      const b = r * ($ * l[m] + z * p[m]);
      x[3 * A + m] = [o.x, o.y, o.z][m] + b, x[3 * (d + A) + m] = [s.x, s.y, s.z][m] + b;
    }
  }
  const g = [x[0], x[1], x[2]], y = e.normalAt(g), w = [g[0] - o.x, g[1] - o.y, g[2] - o.z], S = y.x * w[0] + y.y * w[1] + y.z * w[2] > 0;
  for (let A = 0; A < d; A++) {
    const M = A, $ = (A + 1) % d, z = d + M, m = d + $;
    S ? v.set([M, $, m, M, m, z], 6 * A) : v.set([M, m, $, M, z, m], 6 * A);
  }
  return { vertices: x, triangles: v };
}
const pe = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], Ge = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return e.map((n) => n / t);
};
function dr(e, t, n) {
  const r = e._identity(), o = e.normalAt(), s = /* @__PURE__ */ new Set(), a = t.positions;
  let i;
  const c = /* @__PURE__ */ new Set();
  for (const M of e.edges()) {
    const $ = [...M.faces()].filter((m) => m._identity() !== r);
    if ($.length !== 1)
      return;
    const z = $[0];
    if (z.geomType === "plane") {
      if (!(M._isStraight ? M._isStraight() : M.geomType === "line"))
        return;
      const m = M.start, b = M.end, E = t.add(m.x, m.y, m.z), P = t.add(b.x, b.y, b.z);
      i ?? (i = o.x * m.x + o.y * m.y + o.z * m.z), E !== P && s.add(E < P ? `${E},${P}` : `${P},${E}`);
    } else if (c.add(z._identity()), i === void 0) {
      const m = M.start;
      i = o.x * m.x + o.y * m.y + o.z * m.z;
    }
  }
  if (i === void 0)
    return;
  const f = 2e-5 + 1e-9 * Math.abs(i), d = (M) => Math.abs(o.x * a[3 * M] + o.y * a[3 * M + 1] + o.z * a[3 * M + 2] - i) <= f;
  for (const M of c) {
    const $ = n.get(M);
    if (!$)
      return;
    for (const [z, m] of $)
      d(z) && d(m) && s.add(z < m ? `${z},${m}` : `${m},${z}`);
  }
  const u = /* @__PURE__ */ new Map();
  for (const M of s) {
    const [$, z] = M.split(",").map(Number);
    for (const [m, b] of [[$, z], [z, $]]) {
      const E = u.get(m);
      E ? E.push(b) : u.set(m, [b]);
    }
  }
  for (const M of u.values())
    if (M.length !== 2)
      return;
  const l = [], p = /* @__PURE__ */ new Set();
  for (const M of u.keys()) {
    if (p.has(M))
      continue;
    const $ = [M];
    p.add(M);
    let z = M, m = u.get(M)[0];
    for (; m !== M; ) {
      if (p.has(m))
        return;
      $.push(m), p.add(m);
      const [b, E] = u.get(m), P = b === z ? E : b;
      z = m, m = P;
    }
    if ($.length < 3)
      return;
    l.push($);
  }
  const x = Math.abs(o.x) < 0.9 ? [1, 0, 0] : [0, 1, 0], v = [o.x, o.y, o.z], g = Ge(pe(x, v)), y = pe(v, g), w = (M) => {
    let $ = 0;
    for (let z = 0, m = M.length - 1; z < M.length; m = z++) {
      const b = M[m], E = M[z], P = a[3 * b] * g[0] + a[3 * b + 1] * g[1] + a[3 * b + 2] * g[2], Z = a[3 * b] * y[0] + a[3 * b + 1] * y[1] + a[3 * b + 2] * y[2], ee = a[3 * E] * g[0] + a[3 * E + 1] * g[1] + a[3 * E + 2] * g[2], W = a[3 * E] * y[0] + a[3 * E + 1] * y[1] + a[3 * E + 2] * y[2];
      $ += P * W - ee * Z;
    }
    return Math.abs($);
  }, S = l.map(w), A = S.indexOf(Math.max(...S));
  return [l[A], ...l.filter((M, $) => $ !== A)];
}
const Oe = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function dt(e, t) {
  const n = [], r = [], o = /* @__PURE__ */ new Map(), s = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < s.length; i++) {
    const c = Oe(e.positions[3 * i]), f = Oe(e.positions[3 * i + 1]), d = Oe(e.positions[3 * i + 2]), u = `${c},${f},${d}`;
    let l = o.get(u);
    l === void 0 && (l = n.length / 3, o.set(u, l), n.push(c, f, d)), s[i] = l;
  }
  const a = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.indices.length; i += 3) {
    const c = s[e.indices[i]], f = s[e.indices[i + 1]], d = s[e.indices[i + 2]];
    if (!(c === f || f === d || d === c)) {
      r.push(c, f, d);
      for (const [u, l] of [[c, f], [f, d], [d, c]])
        a.set(`${u},${l}`, (a.get(`${u},${l}`) ?? 0) + 1);
    }
  }
  for (const [i, c] of a) {
    const [f, d] = i.split(",");
    if (c !== 1 || a.get(`${d},${f}`) !== 1)
      throw new C("kernel-failure", N`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > Sn || r.length > $n)
    throw new C("unsupported", N`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (r.length < 12)
    throw new C("kernel-failure", N`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: r };
}
function hr(e, t, n) {
  if (lr(t))
    for (const r of [!0, !1])
      try {
        const o = fr(e, t, { ...Ze, bands: r });
        if (!o)
          break;
        if (o.bands && o.planarFallbacks)
          continue;
        return dt(o, n);
      } catch (o) {
        if (o instanceof C && o.code === "unsupported")
          throw o;
      }
  return dt(e.tessellate(t, Ze), n);
}
function pr(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (o?.kind !== "exact-feature")
    throw new C("invalid-input", N`${n} is not an exact feature`);
  const s = rr(e, t, n, { local: !0, limits: r.limits });
  if (!e.isValid(s))
    throw new C("kernel-failure", N`${o.name}: the exact result is not a valid closed solid.`);
  const a = hr(e, s, o.name);
  return { display: { sourceKey: Tn(t, n), ...a }, volume: e.volume(s) };
}
const Ce = 64, mr = 64 * 1024 * 1024;
function gr(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const r of n) {
      if (!e.roots.includes(r))
        throw new C("invalid-input", N`Unknown object id: ${r}`);
      const o = e.nodes[r];
      if (o.reference)
        throw new C("invalid-input", N`${o.name} is a reference body and is never exported or measured.`);
      if (o.role === "hole")
        throw new C("invalid-input", N`${o.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((r) => !e.nodes[r].reference && e.nodes[r].role !== "hole");
  if (!n.length)
    throw new C("invalid-input", N("The design has no solid bodies to export"));
  if (n.length > Ce)
    throw new C("invalid-input", N`Exact commands are limited to ${Ce} bodies.`);
  return n;
}
function yr(e, t = e.maxMemoryBytes) {
  const n = Object.freeze({ ...Fn, smlib: e.version, licence: e.licence }), r = (o, s, a = {}) => {
    const i = Qe(o), c = gr(i, s);
    return { doc: i, targets: c, solids: c.map((f) => {
      const d = nr(e, i, f, a);
      if (!e.isValid(d))
        throw new C("kernel-failure", N`${i.nodes[f].name}: the exact result is not a valid closed solid.`);
      return d;
    }) };
  };
  return {
    kernel: e,
    info: n,
    ...t ? { memoryCapBytes: t } : {},
    measure(o, s, a) {
      return e.scope(() => {
        const { doc: i, targets: c, solids: f } = r(o, s, a);
        return { kernel: n, bodies: f.map((d, u) => {
          const l = e.bbox(d), p = e.massProperties(d);
          return { id: c[u], name: i.nodes[c[u]].name, volume: e.volume(d), area: e.area(d), bounds: { min: [...l.min], max: [...l.max] }, centroid: [...p.centroid], solids: e.solidCount(d) };
        }) };
      });
    },
    featureDisplays(o, s, a = {}) {
      const i = Qe(o), c = s?.length ? [...new Set(s)] : Cn(i);
      if (c.length > Ce)
        throw new C("invalid-input", N`Exact commands are limited to ${Ce} bodies.`);
      for (const f of c)
        if (i.nodes[f]?.kind !== "exact-feature")
          throw new C("invalid-input", N`${f} is not an exact feature`);
      return { kernel: n, features: c.map((f) => e.scope(() => ({ id: f, name: i.nodes[f].name, ...pr(e, i, f, a) }))) };
    },
    exportStep(o, s, a) {
      return e.scope(() => {
        const { doc: i, targets: c, solids: f } = r(o, s, a);
        let d = f[0];
        if (f.length > 1) {
          const p = f.reduce((x, v) => x + e.solidCount(v), 0);
          if (d = e.union(f[0], ...f.slice(1)), e.solidCount(d) !== p) {
            for (let x = 0; x < f.length; x++)
              for (let v = x + 1; v < f.length; v++)
                if (e.solidCount(e.union(f[x], f[v])) < e.solidCount(f[x]) + e.solidCount(f[v]))
                  throw new C("unsupported", N`${i.nodes[c[x]].name} and ${i.nodes[c[v]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new C("unsupported", N("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const u = e.exportStep(d), l = new TextEncoder().encode(u).byteLength;
        if (l > mr)
          throw new C("unsupported", N("The STEP file exceeds 64 MiB."));
        return { kernel: n, bodies: c.map((p) => ({ id: p, name: i.nodes[p].name })), step: u, bytes: l };
      });
    }
  };
}
let be;
function xr(e = {}) {
  return be ?? (be = rn(e).then((t) => yr(t), (t) => {
    throw be = void 0, t;
  })), be;
}
function Tr(e) {
  for (let t = e, n = 0; t && n < 8; t = t.cause, n++) {
    if (typeof WebAssembly < "u" && t instanceof WebAssembly.RuntimeError || t instanceof RangeError && /memory|allocat/i.test(t.message))
      return !0;
    const r = t instanceof Error ? t.message : typeof t == "string" ? t : "";
    if (/\bAborted\(|out of memory|memory access out of bounds|bad_alloc|Cannot enlarge memory|memory may be damaged|kernel crashed/i.test(r))
      return !0;
  }
  return !1;
}
function vr(e, t, n = 0, r = {}) {
  const o = performance.now();
  return { ...t.operation === "measure" ? { operation: "measure", ...e.measure(t.document, t.bodies, r) } : t.operation === "feature-display" ? { operation: "feature-display", ...e.featureDisplays(t.document, t.bodies, r) } : { operation: "export-step", ...e.exportStep(t.document, t.bodies, r) }, timing: { loadMs: n, runMs: performance.now() - o, memoryBytes: e.kernel.memory().heap } };
}
function Cr(e = {}) {
  const { limits: t, ...n } = e, r = { ...t && typeof t.maxMemoryBytes == "number" && typeof t.requestTimeoutMs == "number" ? Zn(t) : {}, ...n }, o = () => new Error(N("Request cancelled"));
  return {
    async run(s, a) {
      if (a?.aborted)
        throw o();
      const i = performance.now(), c = await xr(r), f = performance.now();
      if (a?.aborted || (await new Promise((u) => setTimeout(u, 0)), a?.aborted))
        throw o();
      const d = vr(c, s, f - i, { limits: t });
      if (a?.aborted)
        throw o();
      return d;
    }
  };
}
export {
  an as CURVED_EDGE_WEIGHT,
  Ln as EXACT_KERNEL_ID,
  Nn as EXACT_KERNEL_PACKAGE,
  Rn as EXACT_KERNEL_VERSION,
  Er as EXACT_LIMITS_DESKTOP,
  Sr as EXACT_LIMITS_NONE,
  Gn as EXACT_LIMITS_TABLET,
  C as ExactKernelError,
  it as ExactLoweringError,
  or as MANY_LOOPS,
  Ce as MAX_EXACT_BODIES,
  st as MAX_POLYHEDRON_FACES,
  mr as MAX_STEP_BYTES,
  ot as MIN_EXACT_SEGMENTS,
  Ar as cadScript,
  tr as checkExactFeatureCost,
  xr as createExactBackend,
  yr as createExactBackendFromKernel,
  Cr as createInThreadExactHost,
  dt as displayMesh,
  hr as displayTessellation,
  br as evaluateCadScript,
  er as exactFeatureCost,
  pr as exactFeatureDisplay,
  Yn as exactGuardSeconds,
  Fn as exactKernelIdentity,
  Zn as exactKernelOptions,
  gr as exactTargets,
  fr as facewiseMesh,
  Tr as isFatalExactError,
  qe as lowerCodeShape,
  nr as lowerDocumentBody,
  rr as lowerDocumentNode,
  $r as resolveExactLimits,
  sn as revolveProfile,
  vr as runExactRequest,
  ft as sketchProfile,
  cr as triangulatePolygon
};
