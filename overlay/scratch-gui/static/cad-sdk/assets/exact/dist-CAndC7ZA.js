var Le = Object.defineProperty;
var Oe = (e, t, n) => t in e ? Le(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var fe = (e, t, n) => Oe(e, typeof t != "symbol" ? t + "" : t, n);
import { c as Ne, C as Xe, e as Be, f as Y, a as Fe, b as je, d as He, g as Ke, h as Ye, s as ye, i as qe, j as Ve, t as P, M as Ue, k as Ze, E as ke, l as Ge, v as we, m as We } from "../geometry.worker-C0tQ3NWa.js";
var v = class extends Error {
  constructor(t, n, r) {
    super(n, r);
    fe(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, A = (e) => {
  throw new v("invalid-input", e);
};
function E(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && A(`${e} must be finite numbers (got ${String(n)}).`);
}
function R(e, ...t) {
  E(e, ...t);
  for (const n of t) n > 0 || A(`${e} must be positive (got ${n}).`);
}
function ie(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return A(`${e} must be a 3-vector.`);
  E(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || A(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function Je(e) {
  const t = e.map((r) => [...r]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let r = 0; r < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); r++)
    for (const [a, s] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[a][s]) < 1e-300) continue;
      const i = (t[s][s] - t[a][a]) / (2 * t[a][s]), c = Math.sign(i || 1) / (Math.abs(i) + Math.sqrt(i * i + 1)), f = 1 / Math.sqrt(c * c + 1), h = c * f;
      for (let l = 0; l < 3; l++) {
        const u = t[l][a], d = t[l][s];
        t[l][a] = f * u - h * d, t[l][s] = h * u + f * d;
      }
      for (let l = 0; l < 3; l++) {
        const u = t[a][l], d = t[s][l];
        t[a][l] = f * u - h * d, t[s][l] = h * u + f * d;
      }
      for (let l = 0; l < 3; l++) {
        const u = n[l][a], d = n[l][s];
        n[l][a] = f * u - h * d, n[l][s] = h * u + f * d;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((r) => [n[0][r], n[1][r], n[2][r]]) };
}
function Qe(e, t) {
  const n = new Float64Array(e.length);
  for (let r = 0; r < t.length; r += 3) {
    const o = t[r] * 3, a = t[r + 1] * 3, s = t[r + 2] * 3, i = e[a] - e[o], c = e[a + 1] - e[o + 1], f = e[a + 2] - e[o + 2], h = e[s] - e[o], l = e[s + 1] - e[o + 1], u = e[s + 2] - e[o + 2], d = c * u - f * l, p = f * h - i * u, g = i * l - c * h;
    for (const w of [o, a, s])
      n[w] += d, n[w + 1] += p, n[w + 2] += g;
  }
  for (let r = 0; r < n.length; r += 3) {
    const o = Math.hypot(n[r], n[r + 1], n[r + 2]);
    o > 0 && (n[r] /= o, n[r + 1] /= o, n[r + 2] /= o);
  }
  return n;
}
var q = (e) => ({ part: e, dispose: () => e.dispose() }), N = (e) => ({ sketch: e, dispose: () => e.dispose() }), b = (e) => e?.part ?? A("Not a solid of this kernel."), S = (e) => e?.sketch ?? A("Not a profile of this kernel."), V = (e) => [e[0], e[1], e[2]];
function x(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof v) throw n;
    const r = n instanceof Error ? n.message : String(n);
    throw new v("kernel-failure", `SMLib ${e} failed: ${r}`, { cause: n });
  }
}
function et(e) {
  return { sm: e, solid: (r, o) => {
    if (!(o instanceof e.Part)) throw new v("kernel-failure", `SMLib ${r} did not produce a solid (got ${o?.constructor?.name ?? typeof o}).`);
    return q(o);
  }, face: (r, o) => {
    const { faceNormal: a, outermost: s } = Array.isArray(o) ? { faceNormal: o, outermost: !1 } : o, i = ie("Face normal", a), c = (h) => {
      const l = h.center();
      return l.x * i[0] + l.y * i[1] + l.z * i[2];
    }, f = [...r.faces()].filter((h) => {
      if (!h.isPlanar) return !1;
      const l = h.normalAt();
      return l.x * i[0] + l.y * i[1] + l.z * i[2] > 1 - 1e-9;
    });
    return s && f.length ? f.sort((h, l) => c(l) - c(h))[0] : (f.length !== 1 && A(`Expected exactly one planar face with outward normal [${i.join(", ")}], found ${f.length}.`), f[0]);
  } };
}
var ge = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], de = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], B = (e) => [e.x, e.y, e.z], te = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return t > 1e-15 ? [e[0] / t, e[1] / t, e[2] / t] : null;
}, H = (e, ...t) => {
  const n = [e[0], e[1], e[2]];
  for (const [r, o] of t)
    n[0] += r * o[0], n[1] += r * o[1], n[2] += r * o[2];
  return n;
};
function tt(e) {
  const t = e.bbox(), n = Math.max(1, t.diagonal), r = 1e-7 * n, o = { min: [1 / 0, 1 / 0, 1 / 0], max: [-1 / 0, -1 / 0, -1 / 0], tol: r };
  for (const a of e.vertices()) L(o, [a.x, a.y, a.z]);
  for (const a of e.edges({ seams: !0 })) nt(a, o);
  for (const a of e.faces()) at(a, o);
  return Number.isFinite(o.min[0]) ? { min: o.min, max: o.max } : { min: [t.min.x, t.min.y, t.min.z], max: [t.max.x, t.max.y, t.max.z] };
}
function L(e, t) {
  for (let n = 0; n < 3; n++)
    t[n] < e.min[n] && (e.min[n] = t[n]), t[n] > e.max[n] && (e.max[n] = t[n]);
}
var ne = (e, t) => t.some((n, r) => n < e.min[r] - e.tol || n > e.max[r] + e.tol), Re = (e, t) => t.some((n) => ne(e, [n.x, n.y, n.z]));
function nt(e, t) {
  L(t, B(e.start)), L(t, B(e.end));
  const n = e.geomType;
  if (n === "line" || n === "circle" && rt(e, t)) return;
  let r = null;
  try {
    if (r = e.nurbs(), !Re(t, r.points)) return;
  } catch {
  }
  ve(n === "bspline" && r ? st(r) : { t0: 0, t1: 1, spans: 1, at: (o) => B(e.pointAt(o)) }, t);
}
function rt(e, t) {
  const n = B(e.arcCenter), r = te(B(e.normal)), o = e.radius;
  if (!r) return !1;
  for (const a of ge) {
    const s = te(H(a, [-de(a, r), r]));
    if (s)
      for (const i of [1, -1]) {
        const c = H(n, [i * o, s]);
        ne(t, c) && (e.isClosed || e.distanceTo(c) <= t.tol) && L(t, c);
      }
  }
  return !0;
}
function ve(e, t) {
  const n = Math.min(1024, Math.max(64, 8 * e.spans)), r = (e.t1 - e.t0) / n, o = [], a = (s) => s === n ? e.t1 : e.t0 + s * r;
  for (let s = 0; s <= n; s++) {
    const i = e.at(a(s));
    o.push(i), L(t, i);
  }
  for (let s = 0; s < 3; s++) for (const i of [1, -1]) {
    let c = 0;
    for (let h = 1; h <= n; h++) i * o[h][s] > i * o[c][s] && (c = h);
    ot((h) => {
      const l = e.at(h);
      return L(t, l), i * l[s];
    }, a(Math.max(0, c - 1)), a(Math.min(n, c + 1)));
  }
}
function ot(e, t, n) {
  const r = (Math.sqrt(5) - 1) / 2, o = 1e-12 * Math.max(1, Math.abs(t), Math.abs(n));
  let a = n - r * (n - t), s = t + r * (n - t), i = e(a), c = e(s);
  for (let f = 0; f < 60 && n - t > o; f++)
    i < c ? (t = a, a = s, i = c, s = t + r * (n - t), c = e(s)) : (n = s, s = a, c = i, a = n - r * (n - t), i = e(a));
}
function st(e) {
  const t = e.degree, n = e.knots, r = e.points.length - 1, o = e.weights, a = e.points.map((l, u) => {
    const d = o ? o[u] : 1;
    return [l.x * d, l.y * d, l.z * d, d];
  }), s = n[t], i = n[r + 1];
  let c = 0;
  for (let l = t; l <= r; l++) n[l + 1] > n[l] && c++;
  const f = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]), h = (l) => {
    l = Math.min(i, Math.max(s, l));
    let u = t;
    for (; u < r && n[u + 1] <= l; ) u++;
    for (let p = 0; p <= t; p++) for (let g = 0; g < 4; g++) f[p][g] = a[p + u - t][g];
    for (let p = 1; p <= t; p++) for (let g = t; g >= p; g--) {
      const w = n[g + u - t], m = n[g + 1 + u - p] - w, y = m > 0 ? (l - w) / m : 0;
      for (let M = 0; M < 4; M++) f[g][M] = (1 - y) * f[g - 1][M] + y * f[g][M];
    }
    const d = f[t];
    return [d[0] / d[3], d[1] / d[3], d[2] / d[3]];
  };
  return { t0: s, t1: i, spans: Math.max(1, c), at: h };
}
function at(e, t) {
  const n = e.geomType;
  if (n === "plane" || n === "cylinder" || n === "cone" || n === "extrusion") return;
  const r = (o) => ne(t, o) && e.distanceTo(o) <= t.tol;
  if (n === "sphere") return it(e, t, r);
  if (!(n === "torus" && lt(e, t, r)) && !e.isPlanar) {
    try {
      const o = e.nurbs();
      if (o.degrees[0] === 1 || o.degrees[1] === 1 || !Re(t, o.points.flat())) return;
    } catch {
    }
    ut(e, t);
  }
}
function it(e, t, n) {
  const r = B(e.axis.origin), o = e.radius;
  for (const a of ge) for (const s of [1, -1]) {
    const i = H(r, [s * o, a]);
    n(i) && L(t, i);
  }
}
function lt(e, t, n) {
  const r = e.axis, o = B(r.origin), a = te(B(r.direction)), s = e.majorRadius, i = e.radius;
  if (!a) return !1;
  for (const c of ge) {
    const f = te(H(c, [-de(c, a), a]));
    if (f && Math.abs(de(c, a)) < 1 - 1e-12)
      for (const h of [1, -1]) for (const l of [1, -1]) {
        const u = H(o, [h * s, f], [l * i, c]);
        n(u) && L(t, u);
      }
    else ct(o, a, s, i, t, n);
  }
  return !0;
}
function ct(e, t, n, r, o, a) {
  const s = te(Math.abs(t[0]) < 0.9 ? H([1, 0, 0], [-t[0], t]) : H([0, 1, 0], [-t[1], t])), i = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
  for (const c of [1, -1])
    if (ne(o, H(e, [c * r, t])))
      for (let f = 0; f < 72; f++) {
        const h = 2 * Math.PI * f / 72, l = H(e, [n * Math.cos(h), s], [n * Math.sin(h), i], [c * r, t]);
        if (a(l)) {
          L(o, l);
          break;
        }
      }
}
function ut(e, t) {
  const r = [];
  for (let o = 0; o <= 24; o++) for (let a = 0; a <= 24; a++) r.push({ u: o / 24, v: a / 24, p: B(e.positionAt(o / 24, a / 24)) });
  for (let o = 0; o < 3; o++) for (const a of [1, -1]) {
    const i = r.filter((f) => ne(t, f.p)).sort((f, h) => a * h.p[o] - a * f.p[o]).find((f) => e.distanceTo(f.p) <= t.tol);
    if (!i) continue;
    L(t, i.p);
    const c = ft(e, i, o, a, 1 / 24);
    e.distanceTo(c) <= t.tol && L(t, c);
  }
}
function ft(e, t, n, r, o) {
  let { u: a, v: s } = t, i = r * t.p[n], c = t.p;
  for (let f = o; f > 1e-9; f /= 2)
    for (let h = !0, l = 0; h && l < 64; l++) {
      h = !1;
      for (const [u, d] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const p = Math.min(1, Math.max(0, a + u * f)), g = Math.min(1, Math.max(0, s + d * f)), w = B(e.positionAt(p, g));
        r * w[n] > i && (a = p, s = g, i = r * w[n], c = w, h = !0);
      }
    }
  return c;
}
var Me = 1024, K = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], _ = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], ce = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function _e(e) {
  const n = 1e-9 * Math.max(1, ...e.flatMap((a) => a.map(Math.abs))), r = ht(e, n);
  if (r.length > Me) throw new v("unsupported", `Hull of ${r.length} distinct vertices exceeds the exact hull budget (${Me}).`);
  if (r.length < 4) throw new v("invalid-input", "A hull needs at least four non-coplanar points.");
  const o = dt(r, n);
  return pt(r, o, Math.min(n, 1e-9));
}
function ht(e, t) {
  const n = Math.max(t * 4, 1e-300), r = /* @__PURE__ */ new Map(), o = [];
  for (const a of e) {
    const s = a.map((f) => Math.floor(f / n));
    let i = !1;
    for (let f = -1; f <= 1 && !i; f++) for (let h = -1; h <= 1 && !i; h++) for (let l = -1; l <= 1 && !i; l++)
      for (const u of r.get(`${s[0] + f},${s[1] + h},${s[2] + l}`) ?? []) if (Math.hypot(...K(a, u)) <= t) {
        i = !0;
        break;
      }
    if (i) continue;
    const c = s.join(",");
    (r.get(c) ?? r.set(c, []).get(c)).push(a), o.push(a);
  }
  return o;
}
function be(e, t, n, r) {
  const o = ce(K(e[n], e[t]), K(e[r], e[t])), a = Math.hypot(...o), s = a > 0 ? [o[0] / a, o[1] / a, o[2] / a] : [0, 0, 0], i = [(e[t][0] + e[n][0] + e[r][0]) / 3, (e[t][1] + e[n][1] + e[r][1]) / 3, (e[t][2] + e[n][2] + e[r][2]) / 3];
  return { v: [t, n, r], n: s, d: _(s, i), area: a / 2, alive: !0 };
}
function dt(e, t) {
  const n = e.length;
  let r = 0;
  for (let m = 1; m < n; m++) e[m][0] < e[r][0] && (r = m);
  let o = -1, a = -1;
  for (let m = 0; m < n; m++) {
    const y = Math.hypot(...K(e[m], e[r]));
    y > a && (a = y, o = m);
  }
  let s = -1;
  a = -1;
  const i = K(e[o], e[r]);
  for (let m = 0; m < n; m++) {
    const y = Math.hypot(...ce(i, K(e[m], e[r])));
    y > a && (a = y, s = m);
  }
  if (!(a > t * Math.hypot(...i))) throw new v("invalid-input", "The hull is flat (all points collinear).");
  const c = be(e, r, o, s);
  let f = -1;
  a = -1;
  for (let m = 0; m < n; m++) {
    const y = Math.abs(_(c.n, e[m]) - c.d);
    y > a && (a = y, f = m);
  }
  if (!(a > t)) throw new v("invalid-input", "The hull is flat (all points coplanar).");
  const h = [], l = /* @__PURE__ */ new Map(), u = (m, y, M) => {
    const I = be(e, m, y, M), $ = h.length;
    return h.push(I), l.set(m * n + y, $), l.set(y * n + M, $), l.set(M * n + m, $), $;
  }, d = (m) => {
    const y = h[m];
    y.alive = !1;
    const [M, I, $] = y.v;
    for (const O of [M * n + I, I * n + $, $ * n + M]) l.get(O) === m && l.delete(O);
  };
  _(c.n, e[f]) - c.d > 0 ? (u(r, s, o), u(r, o, f), u(o, s, f), u(s, r, f)) : (u(r, o, s), u(r, f, o), u(o, f, s), u(s, f, r));
  const p = /* @__PURE__ */ new Set([r, o, s, f]), g = e.reduce((m, y) => [m[0] + y[0] / n, m[1] + y[1] / n, m[2] + y[2] / n], [0, 0, 0]), w = [...e.keys()].filter((m) => !p.has(m)).sort((m, y) => Math.hypot(...K(e[y], g)) - Math.hypot(...K(e[m], g)));
  for (const m of w) {
    const y = e[m];
    let M = -1, I = t;
    for (let C = 0; C < h.length; C++) {
      const z = h[C];
      if (!z.alive) continue;
      const X = _(z.n, y) - z.d;
      X > I && (I = X, M = C);
    }
    if (M < 0) continue;
    const $ = /* @__PURE__ */ new Set([M]), O = [M];
    for (; O.length; ) {
      const C = O.pop(), [z, X, J] = h[C].v;
      for (const [oe, se] of [[z, X], [X, J], [J, z]]) {
        const F = l.get(se * n + oe);
        F === void 0 || $.has(F) || _(h[F].n, y) - h[F].d > t && ($.add(F), O.push(F));
      }
    }
    const re = [];
    for (const C of $) {
      const [z, X, J] = h[C].v;
      for (const [oe, se] of [[z, X], [X, J], [J, z]]) {
        const F = l.get(se * n + oe);
        (F === void 0 || !$.has(F)) && re.push([oe, se]);
      }
    }
    for (const C of $) d(C);
    for (const [C, z] of re) u(C, z, m);
  }
  return h.filter((m) => m.alive);
}
function pt(e, t, n) {
  const r = e.length, o = /* @__PURE__ */ new Map();
  t.forEach((u, d) => {
    const [p, g, w] = u.v;
    o.set(p * r + g, d), o.set(g * r + w, d), o.set(w * r + p, d);
  });
  const a = new Array(t.length).fill(-1), s = [], i = [...t.keys()].sort((u, d) => t[d].area - t[u].area);
  for (const u of i) {
    if (a[u] >= 0) continue;
    const { n: d, d: p } = t[u], g = s.length, w = [u];
    a[u] = g;
    for (let y = 0; y < w.length; y++) {
      const [M, I, $] = t[w[y]].v;
      for (const [O, re] of [[M, I], [I, $], [$, M]]) {
        const C = o.get(re * r + O);
        if (C === void 0 || a[C] >= 0) continue;
        const z = t[C];
        _(z.n, d) < 1 - 1e-6 || z.v.some((X) => Math.abs(_(d, e[X]) - p) > n) || (a[C] = g, w.push(C));
      }
    }
    const m = w.length > 1 ? mt(w.map((y) => t[y].v), r) : t[u].v.slice();
    if (m) s.push(m);
    else {
      a[u] = g, s.push(t[u].v.slice());
      for (const y of w.slice(1))
        a[y] = s.length, s.push(t[y].v.slice());
    }
  }
  const c = /* @__PURE__ */ new Map();
  for (const u of s) for (const d of u) c.set(d, (c.get(d) ?? 0) + 1);
  const f = s.map((u) => {
    const d = u.filter((p) => (c.get(p) ?? 0) > 2);
    return d.length >= 3 ? d : u;
  }), h = [...new Set(f.flat())].sort((u, d) => u - d), l = new Map(h.map((u, d) => [u, d]));
  return { points: h.map((u) => e[u]), faces: f.map((u) => u.map((d) => l.get(d))) };
}
function mt(e, t) {
  const n = /* @__PURE__ */ new Set();
  for (const [s, i, c] of e) for (const [f, h] of [[s, i], [i, c], [c, s]]) n.add(f * t + h);
  const r = /* @__PURE__ */ new Map();
  for (const s of n) {
    const i = Math.floor(s / t), c = s % t;
    if (!n.has(c * t + i)) {
      if (r.has(i)) return null;
      r.set(i, c);
    }
  }
  const o = r.keys().next().value, a = [o];
  for (let s = r.get(o); s !== o; s = r.get(s)) {
    if (s === void 0 || a.length > r.size) return null;
    a.push(s);
  }
  return a.length === r.size ? a : null;
}
function gt(e, t, n = 1e-9) {
  const r = [];
  for (const o of t) {
    const a = xt(e, o);
    if (o.length === 3 || !a) {
      r.push([...o]);
      continue;
    }
    const s = o.reduce((i, c) => i + _(a, e[c]), 0) / o.length;
    if (o.every((i) => Math.abs(_(a, e[i]) - s) <= n)) {
      r.push([...o]);
      continue;
    }
    r.push(...yt(e, o, a));
  }
  return r;
}
function xt(e, t) {
  const n = [0, 0, 0];
  for (let o = 0; o < t.length; o++) {
    const a = e[t[o]], s = e[t[(o + 1) % t.length]];
    n[0] += (a[1] - s[1]) * (a[2] + s[2]), n[1] += (a[2] - s[2]) * (a[0] + s[0]), n[2] += (a[0] - s[0]) * (a[1] + s[1]);
  }
  const r = Math.hypot(...n);
  return r > 0 ? [n[0] / r, n[1] / r, n[2] / r] : null;
}
function yt(e, t, n) {
  const r = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], o = ce(n, r), a = Math.hypot(...o), s = [o[0] / a, o[1] / a, o[2] / a], i = ce(n, s), c = new Map(t.map((p) => [p, [_(e[p], s), _(e[p], i)]])), f = (p, g, w) => {
    const [m, y] = c.get(p), [M, I] = c.get(g), [$, O] = c.get(w);
    return (M - m) * (O - y) - (I - y) * ($ - m);
  }, h = (p, g, w, m) => f(g, w, p) >= 0 && f(w, m, p) >= 0 && f(m, g, p) >= 0, l = [...t], u = [];
  let d = 0;
  for (; l.length > 3 && d++ < 10 * t.length * t.length; ) {
    let p = !1;
    for (let g = 0; g < l.length; g++) {
      const w = l[(g + l.length - 1) % l.length], m = l[g], y = l[(g + 1) % l.length];
      if (!(f(w, m, y) <= 0) && !l.some((M) => M !== w && M !== m && M !== y && h(M, w, m, y))) {
        u.push([w, m, y]), l.splice(g, 1), p = !0;
        break;
      }
    }
    if (!p) break;
  }
  if (l.length > 3)
    for (let p = 1; p + 1 < l.length; p++) u.push([l[0], l[p], l[p + 1]]);
  else u.push(l);
  return u;
}
function wt(e, t) {
  const n = Math.max(1, ...e.flatMap((o) => o.map(Math.abs))), r = 1e-9 * n;
  for (const o of t) {
    const a = [0, 0, 0];
    for (let f = 0; f < o.length; f++) {
      const h = e[o[f]], l = e[o[(f + 1) % o.length]];
      a[0] += (h[1] - l[1]) * (h[2] + l[2]), a[1] += (h[2] - l[2]) * (h[0] + l[0]), a[2] += (h[0] - l[0]) * (h[1] + l[1]);
    }
    const s = Math.hypot(...a);
    if (!(s > 0)) return !1;
    const i = [a[0] / s, a[1] / s, a[2] / s], c = _(i, e[o[0]]);
    if (o.some((f) => Math.abs(_(i, e[f]) - c) > r) || e.some((f) => _(i, f) - c > r)) return !1;
  }
  return !0;
}
var D = (e) => [e[0], e[1], 0];
function vt(e, t, n) {
  let r = t;
  const o = [], a = (s, i) => ((!Array.isArray(i) || i.length !== 2) && A(`${s} must be a 2D point.`), E(s, i[0], i[1]), i);
  for (const s of n) {
    const i = s.kind === "spline" ? a("Spline point", s.through.at(-1) ?? A("A spline needs at least one point.")) : a("Path point", s.to);
    s.kind === "line" ? o.push(e.Line(D(r), D(i))) : s.kind === "arc" ? o.push(e.ThreePointArc(D(r), D(a("Arc point", s.via)), D(i))) : s.kind === "radiusArc" ? (E("Arc radius", s.radius), o.push(e.RadiusArc(D(r), D(i), s.radius))) : s.kind === "sagittaArc" ? (E("Arc sagitta", s.sagitta), o.push(e.SagittaArc(D(r), D(i), s.sagitta))) : s.kind === "spline" ? o.push(e.Spline(D(r), ...s.through.map((c) => D(a("Spline point", c))))) : A(`Unknown path segment kind '${s.kind}'.`), r = i;
  }
  return Math.hypot(r[0] - t[0], r[1] - t[1]) > 1e-9 && o.push(e.Line(D(r), D(t))), o;
}
function Mt(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && A("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && A("Each polygon contour needs at least three points.");
        for (const r of n) E("Polygon points", r[0], r[1]);
      }
      return x("Polygon", () => {
        const n = t.map((r) => e.Polygon(r.map((o) => [o[0], o[1]]))).sort((r, o) => o.area - r.area);
        return N(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)));
      });
    },
    circle(t) {
      return R("Circle radius", t), x("Circle", () => N(e.Circle(t)));
    },
    rectangle(t, n, r) {
      return R("Rectangle size", t, n), x("Rectangle", () => N(r ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, r) {
      return R("Rounded rectangle size and radius", t, n, r), r >= Math.min(t, n) / 2 && A("The corner radius must be below half the short side."), x("RoundedRectangle", () => N(e.RoundedRectangle(t, n, r)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && A("A path profile needs at least one segment."), E("Path start", ...Array.isArray(t) ? t : [NaN]), x("path", () => N(e.makeFace(new e.Wire(vt(e, t, n)))));
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && A("Text must be a non-empty string."), R("Text size", n);
      try {
        return N(e.Text(t, n));
      } catch (r) {
        if (r instanceof e.FontError) throw new v("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${r.message}`, { cause: r });
        return x("Text", () => {
          throw r;
        });
      }
    },
    union: (t, ...n) => x("fuse (2D)", () => N(n.length ? e.fuse(S(t), ...n.map(S)) : S(t))),
    subtract: (t, ...n) => x("cut (2D)", () => N(n.length ? e.cut(S(t), ...n.map(S)) : S(t))),
    intersect: (t, ...n) => x("intersect (2D)", () => N(n.length ? e.intersect(S(t), ...n.map(S)) : S(t))),
    hull: (...t) => (t.length || A("A hull needs at least one profile."), x("Hull (2D)", () => N(e.Hull(...t.map(S))))),
    translate: (t, [n, r]) => (E("Profile offset", n, r), x("translate (2D)", () => N(S(t).translate([n, r, 0])))),
    rotate: (t, n) => (E("Profile angle", n), x("rotate (2D)", () => N(S(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, r]) => (E("Profile scale", n, r), (n === 0 || r === 0) && A("A zero profile scale flattens the profile."), x("scale (2D)", () => N(S(t).scale([n, r, 1])))),
    offset: (t, n, r) => (E("Profile offset distance", n), x("offset (2D)", () => N(e.offset(S(t), n, { corners: r ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = S(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => x("area (2D)", () => S(t).area)
  };
}
var bt = 0.01, At = 10, Et = "MIT AND Apache-2.0";
async function St(e) {
  const { init: t } = await import("./chunk-WNM5TYC5-DPBFlphI.js").then(function(n) {
    return n.c;
  });
  try {
    return await t(e);
  } catch (n) {
    throw new v("invalid-input", `Could not load SMLib: ${n instanceof Error ? n.message : String(n)}`, { cause: n });
  }
}
var Ae = (e) => {
  const t = e.tolerance ?? bt, n = e.angleDeg ?? At;
  return R("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function $t({ sm: e, solid: t }) {
  return {
    box(n) {
      return R("Box size", ...n), x("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, r) {
      return R("Cylinder radius and height", n, r), x("Cylinder", () => t("Cylinder", e.Cylinder(n, r)));
    },
    cone(n, r, o) {
      return E("Cone radii", n, r), R("Cone height", o), (n < 0 || r < 0 || !(n > 0 || r > 0)) && A("Cone radii must be non-negative and not both zero."), x("Cone", () => t("Cone", n === r ? e.Cylinder(n, o) : e.Cone(n, r, o)));
    },
    sphere(n) {
      return R("Sphere radius", n), x("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, r) {
      return R("Torus radii", n, r), r >= n && A("The tube radius must be smaller than the major radius."), x("Torus", () => t("Torus", e.Torus(n, r)));
    },
    polyhedron(n, r) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(r) || r.length < 4) && A("A polyhedron needs at least four points and four faces.");
      for (const o of n) E("Polyhedron points", o[0], o[1], o[2]);
      for (const o of r) (!Array.isArray(o) || o.length < 3 || o.some((a) => !Number.isInteger(a) || a < 0 || a >= n.length)) && A("Polyhedron faces must index at least three existing points.");
      return x("stitch (polyhedron)", () => e.scope(() => {
        const o = gt(n, r).map((s) => {
          const i = s.map((c) => V(n[c]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), a = e.stitch(...o);
        return (!(a instanceof e.Part) || !a.isValid()) && A("The polyhedron faces do not close around a valid solid."), q(a);
      }));
    }
  };
}
function Ct({ sm: e, solid: t }) {
  return {
    extrude(n, r) {
      return R("Extrusion height", r), x("extrude", () => t("extrude", e.extrude(S(n), r)));
    },
    revolve(n, r) {
      return E("Revolution angle", r), (r === 0 || Math.abs(r) > 360) && A("Revolution angle must be in (0, 360] degrees in magnitude."), x("revolve", () => e.scope(() => {
        const o = S(n).rotate(e.Axis.X, 90), a = e.revolve(o, e.Axis.Z, Math.abs(r));
        return t("revolve", r < 0 ? a.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : a);
      }));
    },
    loft(n, r = {}) {
      (!Array.isArray(n) || n.length < 2) && A("A loft needs at least two sections.");
      for (const o of n) E("Loft section position", ...o.at);
      return x("loft", () => e.scope(() => t("loft", e.loft(n.map((o) => S(o.profile).translate(V(o.at))), { ruled: !!r.ruled }))));
    },
    sweep(n, r) {
      (!Array.isArray(r) || r.length < 2) && A("A sweep rail needs at least two points.");
      for (const o of r) E("Sweep rail points", ...o);
      return x("sweep", () => e.scope(() => {
        const o = r.map(V), a = o.length === 2 ? e.Line(o[0], o[1]) : e.Polyline(o);
        return t("sweep", e.sweep(S(n), a));
      }));
    }
  };
}
function Tt({ sm: e, solid: t }) {
  return {
    union: (n, ...r) => x("fuse", () => t("fuse", r.length ? e.fuse(b(n), ...r.map(b)) : b(n))),
    subtract: (n, ...r) => x("cut", () => t("cut", r.length ? e.cut(b(n), ...r.map(b)) : b(n))),
    intersect: (n, ...r) => x("intersect", () => t("intersect", r.length ? e.intersect(b(n), ...r.map(b)) : b(n))),
    splitByPlane: (n, r, o) => {
      const a = ie("Split normal", r);
      return E("Split offset", o), x("split", () => {
        const [s, i] = e.split(b(n), new e.Plane([a[0] * o, a[1] * o, a[2] * o], void 0, a), "both");
        return [t("split", s), t("split", i)];
      });
    },
    translate: (n, r) => (E("Translation", ...r), x("translate", () => q(b(n).translate(V(r))))),
    rotate: (n, r, o, a = [0, 0, 0]) => {
      const s = ie("Rotation axis", r);
      return E("Rotation angle and pivot", o, ...a), x("rotate", () => q(b(n).rotate(new e.Axis(V(a), s), o)));
    },
    mirror: (n, r, o = [0, 0, 0]) => {
      const a = ie("Mirror normal", r);
      return E("Mirror origin", ...o), x("mirror", () => q(b(n).mirror(new e.Plane(V(o), void 0, a))));
    },
    scale: (n, r) => (E("Scale factors", ...r), r.some((o) => o === 0) && A("A zero scale factor flattens the solid."), x("scale", () => q(b(n).scale(V(r), [0, 0, 0]))))
  };
}
function Pt(e) {
  const { sm: t, solid: n, face: r } = e, o = (s, i) => i === "all" ? s.edges() : r(s, i).edges(), a = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, i, c = "all") => (R("Fillet radius", i), x("fillet", () => n("fillet", t.fillet(o(b(s), c), i)))),
    chamfer: (s, i, c = "all") => (R("Chamfer distance", i), x("chamfer", () => n("chamfer", t.chamfer(o(b(s), c), i)))),
    shell: (s, i, c) => {
      R("Shell thickness", i);
      const f = c === void 0 ? [] : a(c) ? [c] : [...c];
      return x("shell", () => {
        const h = b(s), l = f.map((u) => r(h, u));
        return n("shell", t.shell(h, -i, l.length ? l : null));
      });
    }
  };
}
function zt({ sm: e }) {
  return {
    volume: (t) => x("volume", () => b(t).volume),
    area: (t) => x("area", () => b(t).area),
    // Not SMLib's bbox(): it misses interior extremes of some rotated spheres (see bbox.ts).
    bbox: (t) => x("bbox", () => tt(b(t))),
    massProperties: (t) => x("massProperties", () => {
      const n = b(t).massProperties(1), r = n.inertia, o = (c, f) => (r[c][f] + r[f][c]) / 2, a = [[r[0][0], o(0, 1), o(0, 2)], [o(0, 1), r[1][1], o(1, 2)], [o(0, 2), o(1, 2), r[2][2]]], { values: s, vectors: i } = Je(a);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: a, principalMoments: s, principalAxes: i };
    }),
    isValid: (t) => x("isValid", () => b(t).isValid()),
    solidCount: (t) => x("solids", () => e.scope(() => b(t).solids().length)),
    components: (t) => x("solids", () => [...b(t).solids()].map(q))
  };
}
function Nt({ sm: e, solid: t }) {
  return {
    tessellate: (n, r = {}) => {
      const { tolerance: o, angle: a } = Ae(r);
      return x("mesh", () => e.scope(() => {
        const s = b(n).mesh(o, a), i = Float64Array.from(s.vertices), c = Uint32Array.from(s.triangles);
        return { positions: i, normals: Qe(i, c), indices: c };
      }));
    },
    exportStl: (n, r = {}) => {
      const { tolerance: o, angle: a } = Ae(r);
      return x("toStl", () => e.toStl(b(n), { tolerance: o, angle: a }));
    },
    exportStep: (n) => x("toStep", () => e.toStep(b(n))),
    importStep: (n) => ((typeof n != "string" || !n.length) && A("STEP input must be non-empty text."), x("fromStep", () => {
      const r = e.fromStep(n);
      if (Array.isArray(r) && r.length && r.every((o) => o instanceof e.Part)) {
        const o = r;
        return t("fromStep", o.length === 1 ? o[0] : e.fuse(o[0], ...o.slice(1)));
      }
      return t("fromStep", r);
    }))
  };
}
async function Rt(e = {}) {
  const t = await St(e);
  t.setWarningHandler(() => {
  });
  const n = et(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: Et,
    profile: Mt(t),
    ...$t(n),
    ...Ct(n),
    ...Tt(n),
    ...Pt(n),
    ...zt(n),
    ...Nt(n),
    memory: () => {
      const r = t.memoryUsage();
      return { used: r.used, heap: r.heap, handles: r.handles };
    },
    scope: (r) => t.scope(r)
  };
}
const _t = "@crispcad/exact-kernel", Dt = "0.1.2", It = "smlib", Lt = Object.freeze({ id: It, package: _t, version: Dt }), Ee = 16, Se = 2048, T = (e) => {
  throw new v("unsupported", e);
}, Z = (e) => {
  throw new v("invalid-input", e);
};
function U(e, t) {
  t < Ee && T(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${Ee}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const Ot = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], pe = (e, t) => {
  const n = [];
  for (let r = 0; r < 3; r++)
    for (let o = 0; o < 4; o++)
      n.push(e[r * 4] * t[o] + e[r * 4 + 1] * t[4 + o] + e[r * 4 + 2] * t[8 + o] + (o === 3 ? e[r * 4 + 3] : 0));
  return n;
}, k = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), $e = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], Xt = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function le(e, t) {
  const n = Math.hypot(...e);
  n > 0 || Z("Rotation axis must be non-zero.");
  const [r, o, a] = e.map((h) => h / n), s = t * Math.PI / 180, i = Math.cos(s), c = Math.sin(s), f = 1 - i;
  return [f * r * r + i, f * r * o - c * a, f * r * a + c * o, 0, f * r * o + c * a, f * o * o + i, f * o * a - c * r, 0, f * r * a - c * o, f * o * a + c * r, f * a * a + i, 0];
}
const Bt = (e) => pe(le([0, 0, 1], e[2]), pe(le([0, 1, 0], e[1]), le([1, 0, 0], e[0])));
function Ft(e) {
  const t = Math.hypot(...e);
  t > 0 || Z("Mirror normal must be non-zero.");
  const [n, r, o] = e.map((a) => a / t);
  return [1 - 2 * n * n, -2 * n * r, -2 * n * o, 0, -2 * n * r, 1 - 2 * r * r, -2 * r * o, 0, -2 * n * o, -2 * r * o, 1 - 2 * o * o, 0];
}
function jt(e) {
  const [t, n, r, , o, a, s, , i, c, f] = e, h = Math.max(-1, Math.min(1, (t + a + f - 1) / 2)), l = Math.acos(h);
  if (l < 1e-15)
    return null;
  let u = [c - s, r - i, o - n];
  return Math.hypot(...u) < 1e-9 && (u = [[t + 1, o, i], [n, a + 1, c], [r, s, f + 1]].reduce((p, g) => Math.hypot(...g) > Math.hypot(...p) ? g : p)), { axis: u, degrees: l * 180 / Math.PI };
}
function Ht(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && Z("Affine matrix is singular.");
  for (const [s, i] of [[0, 1], [0, 2], [1, 2]]) {
    const c = t[s][0] * t[i][0] + t[s][1] * t[i][1] + t[s][2] * t[i][2];
    Math.abs(c) > 1e-9 * n[s] * n[i] && T("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const r = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), o = [n[0], n[1], r < 0 ? -n[2] : n[2]], a = [0, 1, 2].flatMap((s) => [e[s * 4] / o[0], e[s * 4 + 1] / o[1], e[s * 4 + 2] / o[2], 0]);
  return { scale: o, rotation: a, translate: [e[3], e[7], e[11]] };
}
function De(e, t, n, r) {
  const o = e.map((s, i) => {
    if (!s)
      return 0;
    const c = r[i] - n[i];
    return c < 1e-12 && Z("Cannot resize a degenerate shape."), s / c;
  }), a = Math.max(...o) || 1;
  return o.map((s, i) => e[i] ? s : t?.[i] ? a : 1);
}
function j(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return U("circle2d", t.segments), e.profile.circle(t.radius);
    case "rectangle":
      return e.profile.rectangle(t.size[0], t.size[1], t.center);
    case "move": {
      const n = j(e, t.profile);
      return n && e.profile.translate(n, t.vector);
    }
    case "rotate": {
      const n = j(e, t.profile);
      return n && e.profile.rotate(n, t.angle);
    }
    case "scale": {
      const n = j(e, t.profile);
      return n && e.profile.scale(n, t.vector);
    }
    case "affine": {
      const n = j(e, t.profile);
      if (!n)
        return null;
      const [r, o, a, s, i, c] = t.matrix, f = Math.hypot(r, s), h = Math.hypot(o, i);
      f > 1e-12 && h > 1e-12 || Z("2D affine matrix is singular."), Math.abs(r * o + s * i) > 1e-9 * f * h && T("2D affine transforms with shear have no exact lowering here.");
      const l = r * i - o * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [f, l < 0 ? -h : h]), Math.atan2(s, r) * 180 / Math.PI), [a, c]);
    }
    case "resize": {
      const n = j(e, t.profile);
      if (!n)
        return null;
      const r = e.profile.bounds(n), o = De(t.size, t.auto, r.min, r.max);
      return e.profile.scale(n, [o[0], o[1]]);
    }
    case "offset": {
      t.round && U("offset2d", t.segments);
      const n = j(e, t.profile);
      return n && e.profile.offset(n, t.distance, t.round);
    }
    case "text":
      return T("text2d needs a font outline path, and the exact kernel package ships no font.");
    case "minkowski":
      return T("minkowski2d has no exact lowering (planar Minkowski sums of curved profiles are not exposed by this kernel adapter).");
    case "union":
    case "subtract":
    case "intersect":
    case "hull": {
      const n = t.profiles.map((a) => j(e, a)), r = n.filter((a) => a !== null);
      if (t.kind === "union")
        return r.length ? e.profile.union(r[0], ...r.slice(1)) : null;
      if (t.kind === "hull")
        return r.length ? e.profile.hull(...r) : null;
      if (t.kind === "intersect")
        return n.some((a) => a === null) || !r.length ? null : e.profile.intersect(r[0], ...r.slice(1));
      if (!n[0])
        return null;
      const o = n.slice(1).filter((a) => a !== null);
      return o.length ? e.profile.subtract(n[0], ...o) : n[0];
    }
    default:
      return T(`Profile '${t.kind}' has no exact lowering.`);
  }
}
function G(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, r = e.center ? -t / 2 : 0, o = e.center ? -n / 2 : 0;
      return [[r, o], [r + t, o], [r + t, o + n], [r, o + n]];
    }
    case "move":
      return G(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return G(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), r = Math.sin(t);
      return G(e.profile).map(([o, a]) => [n * o - r * a, r * o + n * a]);
    }
    case "affine": {
      const t = e.matrix;
      return G(e.profile).map(([n, r]) => [t[0] * n + t[1] * r + t[2], t[3] * n + t[4] * r + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(G);
    case "empty":
      return [];
    default:
      return T(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function me(e, t, n) {
  const r = (o, a) => me(a, pe(t, o), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const o of e.shapes)
        me(o, t, n);
      return;
    case "move":
      return r($e(e.vector), e.shape);
    case "rotate":
      return r(Bt(e.vector), e.shape);
    case "scale":
      return r(Xt(e.vector), e.shape);
    case "mirror":
      return r(Ft(e.vector), e.shape);
    case "axisRotate":
      return r(le(e.vector, e.angle), e.shape);
    case "affine":
      return r(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let o = 0; o < e.count; o++)
        r($e(e.step.map((a) => a * o)), e.shape);
      return;
    case "box": {
      const [o, a, s] = e.size.map((i) => i / 2);
      for (const i of [-o, o])
        for (const c of [-a, a])
          for (const f of [-s, s])
            n.points.push(k(t, [i, c, f]));
      return;
    }
    case "polyhedron":
      for (const o of e.points)
        n.points.push(k(t, o));
      return;
    case "extrude":
      for (const [o, a] of e.points)
        for (const s of [0, e.height])
          n.points.push(k(t, [o, a, s]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && T("hull of a twisted extrusion has no exact lowering.");
      for (const [o, a] of G(e.profile))
        n.points.push(k(t, [o, a, 0])), n.points.push(k(t, [o * e.scaleTop[0], a * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      U("sphere", e.segments);
      const o = [0, 1, 2].map((a) => Math.hypot(t[a], t[4 + a], t[8 + a]));
      Math.max(...o) - Math.min(...o) > 1e-12 * Math.max(...o) && T("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: k(t, [0, 0, 0]), radius: e.radius * o[0] });
      return;
    }
    default:
      T(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function Kt(e, t) {
  const n = { points: [], spheres: [] };
  for (const u of t)
    me(u, Ot, n);
  if (n.points.length && n.spheres.length && T("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const u = _e(n.points);
    return e.polyhedron(u.points, u.faces);
  }
  if (!n.spheres.length)
    return null;
  const r = n.spheres[0].radius;
  n.spheres.some((u) => Math.abs(u.radius - r) > 1e-12 * r) && T("hull of spheres with different radii has no exact lowering.");
  const o = n.spheres.map((u) => u.centre), a = [0, 1, 2].map((u) => Math.min(...o.map((d) => d[u]))), s = [0, 1, 2].map((u) => Math.max(...o.map((d) => d[u]))), i = s.map((u, d) => u - a[d]), c = 1e-9 * Math.max(1, ...i);
  if (i.every((u) => u <= c))
    return e.translate(e.sphere(r), a);
  const f = (u) => [u & 1 ? s[0] : a[0], u & 2 ? s[1] : a[1], u & 4 ? s[2] : a[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((u) => o.some((d) => d.every((p, g) => Math.abs(p - f(u)[g]) <= c))) || i.some((u) => u <= c)) && T("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const l = e.box(i.map((u) => u + 2 * r));
  return e.translate(e.fillet(l, r, "all"), a.map((u, d) => u + i[d] / 2));
}
function Ie(e, t, n) {
  const r = e.profile.bounds(t), o = r.max[0] <= 0;
  r.min[0] < -1e-8 && !o && Z("Revolved profiles must stay on one side of the radial axis.");
  const a = Math.abs(n);
  a > 360 && Z("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(o ? e.profile.scale(t, [-1, 1]) : t, n);
  return o && a !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function Yt(e, t, n) {
  const { scale: r, rotation: o, translate: a } = Ht(n);
  let s = r.every((c) => Math.abs(c - 1) < 1e-15) ? t : e.scale(t, r);
  const i = jt(o);
  return i && (s = e.rotate(s, i.axis, i.degrees)), a.some((c) => c !== 0) ? e.translate(s, a) : s;
}
function xe(e, t) {
  const n = (r) => xe(e, r);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return U("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return U("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return U("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && T("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && T("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const r = j(e, t.profile);
      return r && e.extrude(r, t.height);
    }
    case "revolve": {
      if (U("revolve", t.segments), t.angle === 0)
        return null;
      const r = j(e, t.profile);
      return r && Ie(e, r, t.angle);
    }
    case "polyhedron": {
      if (t.faces.length > Se && T(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${Se} faces).`), wt(t.points, t.faces)) {
        const r = _e(t.points);
        return e.polyhedron(r.points, r.faces);
      }
      return e.polyhedron(t.points, t.faces);
    }
    case "union":
    case "subtract":
    case "intersect": {
      const r = (c) => c.kind === "union" ? c.shapes.flatMap(r) : [c], a = (t.kind === "subtract" ? [t.shapes[0], ...t.shapes.slice(1).flatMap(r)] : t.shapes).map(n), s = a.filter((c) => c !== null);
      if (t.kind === "union")
        return s.length ? e.union(s[0], ...s.slice(1)) : null;
      if (t.kind === "intersect")
        return a.some((c) => c === null) || !s.length ? null : e.intersect(s[0], ...s.slice(1));
      if (!a[0])
        return null;
      const i = a.slice(1).filter((c) => c !== null);
      return i.length ? e.subtract(a[0], ...i) : a[0];
    }
    case "hull":
      return Kt(e, t.shapes);
    case "minkowski":
      return T("minkowski has no exact lowering (a general Minkowski sum is not a B-rep operation of this adapter; use fillet/offset intent instead).");
    case "move": {
      const r = n(t.shape);
      return r && e.translate(r, t.vector);
    }
    case "rotate": {
      const r = n(t.shape);
      if (!r)
        return null;
      let o = r;
      for (const [a, s] of [[[1, 0, 0], t.vector[0]], [[0, 1, 0], t.vector[1]], [[0, 0, 1], t.vector[2]]])
        s && (o = e.rotate(o, a, s));
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
      return r && Yt(e, r, t.matrix.slice(0, 12));
    }
    case "resize": {
      const r = n(t.shape);
      if (!r)
        return null;
      const o = e.bbox(r);
      return e.scale(r, De(t.vector, t.auto, o.min, o.max));
    }
    case "repeat": {
      const r = t.count >= 1 ? n(t.shape) : null;
      if (!r)
        return null;
      const o = Array.from({ length: t.count }, (a, s) => s === 0 ? r : e.translate(r, t.step.map((i) => i * s)));
      return o.length > 1 ? e.union(o[0], ...o.slice(1)) : o[0];
    }
    default:
      return T(`CAD Script '${t.kind}' has no exact lowering.`);
  }
}
function en(e, t) {
  let n;
  try {
    n = Ne(t).shape;
  } catch (o) {
    throw o instanceof Xe ? new v("invalid-input", `CAD Script: ${o.message}`, { cause: o }) : o;
  }
  const r = e.scope(() => xe(e, n));
  if (!r)
    throw new v("invalid-input", "The program produces no solid.");
  if (!(e.volume(r) > 0))
    throw r.dispose(), new v("kernel-failure", "The exact result has no positive volume.");
  return r;
}
const tn = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} });
class Ce extends v {
  constructor(n, r) {
    super(n.code, n.message, r);
    fe(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const ee = (e) => {
  throw new v("unsupported", e);
};
function Te(e, t, n) {
  if (!n?.some((o) => o !== 0))
    return ye([...t]), e.profile.polygon([t]);
  ye([...t], [...n]);
  const r = t.map((o, a) => {
    const s = t[(a + 1) % t.length], i = n[a] ?? 0;
    return i ? { kind: "arc", via: qe(o, s, i), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], r);
}
const Pe = (e, t, n) => {
  const r = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(r, [t[0], t[1]]) : r;
};
function ze(e, t, n) {
  const r = t.profile;
  switch (r.kind) {
    case "rectangle":
      return e.profile.rectangle(Y(r.width, n), Y(r.depth, n), !0);
    case "circle":
      return Pe(e, r.center ?? [0, 0], Y(r.radius, n));
    case "outline":
      return Te(e, r.points, r.bulges);
    case "region": {
      Be(r.loops, (s) => Y(s, n));
      const o = (s) => s.kind === "circle" ? Pe(e, [Y(s.center[0], n), Y(s.center[1], n)], Y(s.radius, n)) : Te(e, s.points, s.bulges), a = r.loops.map(o).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, i) => i.area - s.area);
      return e.profile.subtract(a[0].profile, ...a.slice(1).map((s) => s.profile));
    }
    case "path":
      return ee("Close the sketch path before creating a solid.");
    default:
      return ee(`Sketch profile '${r.kind}' has no exact lowering.`);
  }
}
function Q(e, t, n) {
  let r = t;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((o, a) => {
    n[a] && (r = e.rotate(r, o, n[a]));
  }), r;
}
function W(e, t, n, r, o) {
  const a = o.get(n);
  if (a)
    return a;
  const s = t.nodes[n];
  let i;
  try {
    switch (s.kind) {
      case "box":
        i = e.box(s.size);
        break;
      case "cylinder":
        i = e.cylinder(s.radius, s.height);
        break;
      case "sphere":
        i = e.sphere(s.radius);
        break;
      case "code": {
        const l = xe(e, Ne(s.program).shape);
        if (!l)
          throw new v("invalid-input", "Code produces no printable solid.");
        i = l;
        break;
      }
      case "extrusion": {
        const { distance: l, start: u, plane: d } = Ye(s, t);
        i = e.extrude(ze(e, t.sketches[s.sketchId], t), l), u && (i = e.translate(i, [0, 0, u])), d === "XZ" ? i = Q(e, i, [90, 0, 0]) : d === "YZ" && (i = Q(e, i, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: l, angle: u, axisOffset: d } = Ke(s, t);
        let p = ze(e, t.sketches[s.sketchId], t);
        d && (p = e.profile.translate(p, [-d, 0])), i = Ie(e, p, u), l === "XY" ? i = Q(e, i, [-90, 0, 0]) : l === "YZ" && (i = Q(e, i, [0, 0, 90])), d && (i = e.translate(i, l === "YZ" ? [0, d, 0] : [d, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: l, offset: u } = He(s, t), d = [0, 0, 0];
        if (d[l] = 1, i = e.mirror(W(e, t, s.source, r, o), d), u) {
          const p = [0, 0, 0];
          p[l] = 2 * u, i = e.translate(i, p);
        }
        break;
      }
      case "pattern": {
        const l = je(s, t), u = W(e, t, s.source, r, o), d = [u];
        if (l.mode === "linear")
          for (let p = 1; p < l.count; p++) {
            const g = [0, 0, 0];
            g[l.axis] = p * l.spacing, d.push(e.translate(u, g));
          }
        else {
          const p = l.sweep / (Math.abs(l.sweep) === 360 ? l.count : l.count - 1), g = [0, 0, 0];
          g[l.axis] = 1;
          for (let w = 1; w < l.count; w++)
            d.push(e.rotate(u, g, w * p, l.center));
        }
        i = e.union(d[0], ...d.slice(1));
        break;
      }
      case "boolean": {
        const l = s.inputs.map((u) => W(e, t, u, r, o));
        if (s.useHoleRoles) {
          const u = l.filter((g, w) => t.nodes[s.inputs[w]].role !== "hole"), d = l.filter((g, w) => t.nodes[s.inputs[w]].role === "hole");
          u.length || ee("A combination of holes only has no solid to export.");
          const p = u.length > 1 ? e.union(u[0], ...u.slice(1)) : u[0];
          i = d.length ? e.subtract(p, ...d) : p;
        } else
          i = s.operation === "union" ? e.union(l[0], ...l.slice(1)) : s.operation === "subtract" ? e.subtract(l[0], ...l.slice(1)) : e.intersect(l[0], ...l.slice(1));
        break;
      }
      case "exact-feature": {
        const l = Fe(s, t), u = W(e, t, s.source, r, o);
        i = l.operation === "fillet" ? e.fillet(u, l.size, l.edges) : l.operation === "chamfer" ? e.chamfer(u, l.size, l.edges) : e.shell(u, l.size, l.openFaces);
        break;
      }
      case "mesh":
        return ee(s.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return ee(`'${s.kind}' has no exact lowering.`);
    }
    const { scale: c, rotation: f, position: h } = s.transform;
    c.some((l) => l !== 1) && (i = e.scale(i, c)), i = Q(e, i, f), h.some((l) => l !== 0) && (i = e.translate(i, h));
  } catch (c) {
    if (c instanceof Ce)
      throw c;
    const f = c instanceof v ? c.code : "invalid-input", h = c instanceof Error ? c.message : String(c);
    throw new Ce({ code: f, bodyId: r, nodeId: n, feature: s.kind, message: `${s.name} (${s.kind}): ${h}` }, { cause: c });
  }
  return o.set(n, i), i;
}
function qt(e, t, n) {
  if (!t.roots.includes(n))
    throw new v("invalid-input", `${n} is not a top-level body.`);
  return W(e, t, n, n, /* @__PURE__ */ new Map());
}
function Vt(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (!o)
    throw new v("invalid-input", `${n} is not a node of this model.`);
  const a = r.local ? { ...t, nodes: { ...t.nodes, [n]: { ...o, transform: Ve() } } } : t, s = t.roots.find((i) => i === n) ?? n;
  return W(e, a, n, s, /* @__PURE__ */ new Map());
}
const he = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function Ut(e, t) {
  const n = [], r = [], o = /* @__PURE__ */ new Map(), a = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < a.length; i++) {
    const c = he(e.positions[3 * i]), f = he(e.positions[3 * i + 1]), h = he(e.positions[3 * i + 2]), l = `${c},${f},${h}`;
    let u = o.get(l);
    u === void 0 && (u = n.length / 3, o.set(l, u), n.push(c, f, h)), a[i] = u;
  }
  const s = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.indices.length; i += 3) {
    const c = a[e.indices[i]], f = a[e.indices[i + 1]], h = a[e.indices[i + 2]];
    if (!(c === f || f === h || h === c)) {
      r.push(c, f, h);
      for (const [l, u] of [[c, f], [f, h], [h, c]])
        s.set(`${l},${u}`, (s.get(`${l},${u}`) ?? 0) + 1);
    }
  }
  for (const [i, c] of s) {
    const [f, h] = i.split(",");
    if (c !== 1 || s.get(`${h},${f}`) !== 1)
      throw new v("kernel-failure", P`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > Ue || r.length > Ze)
    throw new v("unsupported", P`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (r.length < 12)
    throw new v("kernel-failure", P`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: r };
}
function Zt(e, t, n) {
  const r = t.nodes[n];
  if (r?.kind !== "exact-feature")
    throw new v("invalid-input", P`${n} is not an exact feature`);
  const o = Vt(e, t, n, { local: !0 });
  if (!e.isValid(o))
    throw new v("kernel-failure", P`${r.name}: the exact result is not a valid closed solid.`);
  const a = Ut(e.tessellate(o, ke), r.name);
  return { display: { sourceKey: Ge(t, n), ...a }, volume: e.volume(o) };
}
const ue = 64, kt = 64 * 1024 * 1024;
function Gt(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const r of n) {
      if (!e.roots.includes(r))
        throw new v("invalid-input", P`Unknown object id: ${r}`);
      const o = e.nodes[r];
      if (o.reference)
        throw new v("invalid-input", P`${o.name} is a reference body and is never exported or measured.`);
      if (o.role === "hole")
        throw new v("invalid-input", P`${o.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((r) => !e.nodes[r].reference && e.nodes[r].role !== "hole");
  if (!n.length)
    throw new v("invalid-input", P("The design has no solid bodies to export"));
  if (n.length > ue)
    throw new v("invalid-input", P`Exact commands are limited to ${ue} bodies.`);
  return n;
}
function Wt(e) {
  const t = Object.freeze({ ...Lt, smlib: e.version, licence: e.licence }), n = (r, o) => {
    const a = we(r), s = Gt(a, o);
    return { doc: a, targets: s, solids: s.map((i) => {
      const c = qt(e, a, i);
      if (!e.isValid(c))
        throw new v("kernel-failure", P`${a.nodes[i].name}: the exact result is not a valid closed solid.`);
      return c;
    }) };
  };
  return {
    kernel: e,
    info: t,
    measure(r, o) {
      return e.scope(() => {
        const { doc: a, targets: s, solids: i } = n(r, o);
        return { kernel: t, bodies: i.map((c, f) => {
          const h = e.bbox(c), l = e.massProperties(c);
          return { id: s[f], name: a.nodes[s[f]].name, volume: e.volume(c), area: e.area(c), bounds: { min: [...h.min], max: [...h.max] }, centroid: [...l.centroid], solids: e.solidCount(c) };
        }) };
      });
    },
    featureDisplays(r, o) {
      const a = we(r), s = o?.length ? [...new Set(o)] : We(a);
      if (s.length > ue)
        throw new v("invalid-input", P`Exact commands are limited to ${ue} bodies.`);
      for (const i of s)
        if (a.nodes[i]?.kind !== "exact-feature")
          throw new v("invalid-input", P`${i} is not an exact feature`);
      return { kernel: t, features: s.map((i) => e.scope(() => ({ id: i, name: a.nodes[i].name, ...Zt(e, a, i) }))) };
    },
    exportStep(r, o) {
      return e.scope(() => {
        const { doc: a, targets: s, solids: i } = n(r, o);
        let c = i[0];
        if (i.length > 1) {
          const l = i.reduce((u, d) => u + e.solidCount(d), 0);
          if (c = e.union(i[0], ...i.slice(1)), e.solidCount(c) !== l) {
            for (let u = 0; u < i.length; u++)
              for (let d = u + 1; d < i.length; d++)
                if (e.solidCount(e.union(i[u], i[d])) < e.solidCount(i[u]) + e.solidCount(i[d]))
                  throw new v("unsupported", P`${a.nodes[s[u]].name} and ${a.nodes[s[d]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new v("unsupported", P("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const f = e.exportStep(c), h = new TextEncoder().encode(f).byteLength;
        if (h > kt)
          throw new v("unsupported", P("The STEP file exceeds 64 MiB."));
        return { kernel: t, bodies: s.map((l) => ({ id: l, name: a.nodes[l].name })), step: f, bytes: h };
      });
    }
  };
}
let ae;
function nn(e = {}) {
  return ae ?? (ae = Rt(e).then(Wt, (t) => {
    throw ae = void 0, t;
  })), ae;
}
export {
  It as EXACT_KERNEL_ID,
  _t as EXACT_KERNEL_PACKAGE,
  Dt as EXACT_KERNEL_VERSION,
  v as ExactKernelError,
  Ce as ExactLoweringError,
  ue as MAX_EXACT_BODIES,
  Se as MAX_POLYHEDRON_FACES,
  kt as MAX_STEP_BYTES,
  Ee as MIN_EXACT_SEGMENTS,
  tn as cadScript,
  nn as createExactBackend,
  Wt as createExactBackendFromKernel,
  Ut as displayMesh,
  en as evaluateCadScript,
  Zt as exactFeatureDisplay,
  Lt as exactKernelIdentity,
  Gt as exactTargets,
  xe as lowerCodeShape,
  qt as lowerDocumentBody,
  Vt as lowerDocumentNode,
  Ie as revolveProfile,
  ze as sketchProfile
};
