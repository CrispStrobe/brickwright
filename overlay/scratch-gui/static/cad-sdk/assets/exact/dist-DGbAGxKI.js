var Ie = Object.defineProperty;
var Le = (e, t, n) => t in e ? Ie(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var fe = (e, t, n) => Le(e, typeof t != "symbol" ? t + "" : t, n);
import { c as ze, C as Oe, e as Xe, f as j, a as Be, b as Fe, d as He, g as Ke, h as Ye, s as ye, i as je, j as qe, t as P, M as Ve, k as Ze, E as Ue, l as Ge, v as ve, m as ke } from "../geometry.worker-DcSxf_wm.js";
var w = class extends Error {
  constructor(t, n, r) {
    super(n, r);
    fe(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, b = (e) => {
  throw new w("invalid-input", e);
};
function E(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && b(`${e} must be finite numbers (got ${String(n)}).`);
}
function R(e, ...t) {
  E(e, ...t);
  for (const n of t) n > 0 || b(`${e} must be positive (got ${n}).`);
}
function ie(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return b(`${e} must be a 3-vector.`);
  E(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || b(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function We(e) {
  const t = e.map((r) => [...r]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let r = 0; r < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); r++)
    for (const [a, s] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[a][s]) < 1e-300) continue;
      const i = (t[s][s] - t[a][a]) / (2 * t[a][s]), l = Math.sign(i || 1) / (Math.abs(i) + Math.sqrt(i * i + 1)), f = 1 / Math.sqrt(l * l + 1), h = l * f;
      for (let c = 0; c < 3; c++) {
        const u = t[c][a], d = t[c][s];
        t[c][a] = f * u - h * d, t[c][s] = h * u + f * d;
      }
      for (let c = 0; c < 3; c++) {
        const u = t[a][c], d = t[s][c];
        t[a][c] = f * u - h * d, t[s][c] = h * u + f * d;
      }
      for (let c = 0; c < 3; c++) {
        const u = n[c][a], d = n[c][s];
        n[c][a] = f * u - h * d, n[c][s] = h * u + f * d;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((r) => [n[0][r], n[1][r], n[2][r]]) };
}
function Je(e, t) {
  const n = new Float64Array(e.length);
  for (let r = 0; r < t.length; r += 3) {
    const o = t[r] * 3, a = t[r + 1] * 3, s = t[r + 2] * 3, i = e[a] - e[o], l = e[a + 1] - e[o + 1], f = e[a + 2] - e[o + 2], h = e[s] - e[o], c = e[s + 1] - e[o + 1], u = e[s + 2] - e[o + 2], d = l * u - f * c, m = f * h - i * u, y = i * c - l * h;
    for (const v of [o, a, s])
      n[v] += d, n[v + 1] += m, n[v + 2] += y;
  }
  for (let r = 0; r < n.length; r += 3) {
    const o = Math.hypot(n[r], n[r + 1], n[r + 2]);
    o > 0 && (n[r] /= o, n[r + 1] /= o, n[r + 2] /= o);
  }
  return n;
}
var q = (e) => ({ part: e, dispose: () => e.dispose() }), N = (e) => ({ sketch: e, dispose: () => e.dispose() }), M = (e) => e?.part ?? b("Not a solid of this kernel."), S = (e) => e?.sketch ?? b("Not a profile of this kernel."), V = (e) => [e[0], e[1], e[2]];
function g(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof w) throw n;
    const r = n instanceof Error ? n.message : String(n);
    throw new w("kernel-failure", `SMLib ${e} failed: ${r}`, { cause: n });
  }
}
function Qe(e) {
  return { sm: e, solid: (r, o) => {
    if (!(o instanceof e.Part)) throw new w("kernel-failure", `SMLib ${r} did not produce a solid (got ${o?.constructor?.name ?? typeof o}).`);
    return q(o);
  }, face: (r, o) => {
    const { faceNormal: a, outermost: s } = Array.isArray(o) ? { faceNormal: o, outermost: !1 } : o, i = ie("Face normal", a), l = (h) => {
      const c = h.center();
      return c.x * i[0] + c.y * i[1] + c.z * i[2];
    }, f = [...r.faces()].filter((h) => {
      if (!h.isPlanar) return !1;
      const c = h.normalAt();
      return c.x * i[0] + c.y * i[1] + c.z * i[2] > 1 - 1e-9;
    });
    return s && f.length ? f.sort((h, c) => l(c) - l(h))[0] : (f.length !== 1 && b(`Expected exactly one planar face with outward normal [${i.join(", ")}], found ${f.length}.`), f[0]);
  } };
}
var ge = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], de = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], L = (e) => [e.x, e.y, e.z], te = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return t > 1e-15 ? [e[0] / t, e[1] / t, e[2] / t] : null;
}, K = (e, ...t) => {
  const n = [e[0], e[1], e[2]];
  for (const [r, o] of t)
    n[0] += r * o[0], n[1] += r * o[1], n[2] += r * o[2];
  return n;
};
function et(e) {
  const t = e.bbox(), n = Math.max(1, t.diagonal), r = 1e-7 * n, o = { min: [1 / 0, 1 / 0, 1 / 0], max: [-1 / 0, -1 / 0, -1 / 0], tol: r };
  for (const a of e.vertices()) O(o, [a.x, a.y, a.z]);
  for (const a of e.edges({ seams: !0 })) tt(a, o);
  for (const a of e.faces()) st(a, o);
  return Number.isFinite(o.min[0]) ? { min: o.min, max: o.max } : { min: [t.min.x, t.min.y, t.min.z], max: [t.max.x, t.max.y, t.max.z] };
}
function O(e, t) {
  for (let n = 0; n < 3; n++)
    t[n] < e.min[n] && (e.min[n] = t[n]), t[n] > e.max[n] && (e.max[n] = t[n]);
}
var ne = (e, t) => t.some((n, r) => n < e.min[r] - e.tol || n > e.max[r] + e.tol), Ne = (e, t) => t.some((n) => ne(e, [n.x, n.y, n.z]));
function tt(e, t) {
  O(t, L(e.start)), O(t, L(e.end));
  const n = e.geomType;
  if (n !== "line" && !(n === "circle" && nt(e, t))) {
    try {
      if (!Ne(t, e.nurbs().points)) return;
    } catch {
    }
    rt(e, t);
  }
}
function nt(e, t) {
  const n = L(e.arcCenter), r = te(L(e.normal)), o = e.radius;
  if (!r) return !1;
  for (const a of ge) {
    const s = te(K(a, [-de(a, r), r]));
    if (s)
      for (const i of [1, -1]) {
        const l = K(n, [i * o, s]);
        ne(t, l) && (e.isClosed || e.distanceTo(l) <= t.tol) && O(t, l);
      }
  }
  return !0;
}
function rt(e, t) {
  const r = [];
  for (let o = 0; o <= 64; o++) {
    const a = L(e.pointAt(o / 64));
    r.push(a), O(t, a);
  }
  for (let o = 0; o < 3; o++) for (const a of [1, -1]) {
    let s = 0;
    for (let l = 1; l <= 64; l++) a * r[l][o] > a * r[s][o] && (s = l);
    ot((l) => {
      const f = L(e.pointAt(l));
      return O(t, f), a * f[o];
    }, Math.max(0, (s - 1) / 64), Math.min(1, (s + 1) / 64));
  }
}
function ot(e, t, n) {
  const r = (Math.sqrt(5) - 1) / 2;
  let o = n - r * (n - t), a = t + r * (n - t), s = e(o), i = e(a);
  for (let l = 0; l < 60 && n - t > 1e-12; l++)
    s < i ? (t = o, o = a, s = i, a = t + r * (n - t), i = e(a)) : (n = a, a = o, i = s, o = n - r * (n - t), s = e(o));
}
function st(e, t) {
  const n = e.geomType;
  if (n === "plane" || n === "cylinder" || n === "cone" || n === "extrusion") return;
  const r = (o) => ne(t, o) && e.distanceTo(o) <= t.tol;
  if (n === "sphere") return at(e, t, r);
  if (!(n === "torus" && it(e, t, r)) && !e.isPlanar) {
    try {
      const o = e.nurbs();
      if (o.degrees[0] === 1 || o.degrees[1] === 1 || !Ne(t, o.points.flat())) return;
    } catch {
    }
    ct(e, t);
  }
}
function at(e, t, n) {
  const r = L(e.axis.origin), o = e.radius;
  for (const a of ge) for (const s of [1, -1]) {
    const i = K(r, [s * o, a]);
    n(i) && O(t, i);
  }
}
function it(e, t, n) {
  const r = e.axis, o = L(r.origin), a = te(L(r.direction)), s = e.majorRadius, i = e.radius;
  if (!a) return !1;
  for (const l of ge) {
    const f = te(K(l, [-de(l, a), a]));
    if (f && Math.abs(de(l, a)) < 1 - 1e-12)
      for (const h of [1, -1]) for (const c of [1, -1]) {
        const u = K(o, [h * s, f], [c * i, l]);
        n(u) && O(t, u);
      }
    else lt(o, a, s, i, t, n);
  }
  return !0;
}
function lt(e, t, n, r, o, a) {
  const s = te(Math.abs(t[0]) < 0.9 ? K([1, 0, 0], [-t[0], t]) : K([0, 1, 0], [-t[1], t])), i = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
  for (const l of [1, -1])
    if (ne(o, K(e, [l * r, t])))
      for (let f = 0; f < 72; f++) {
        const h = 2 * Math.PI * f / 72, c = K(e, [n * Math.cos(h), s], [n * Math.sin(h), i], [l * r, t]);
        if (a(c)) {
          O(o, c);
          break;
        }
      }
}
function ct(e, t) {
  const r = [];
  for (let o = 0; o <= 24; o++) for (let a = 0; a <= 24; a++) r.push({ u: o / 24, v: a / 24, p: L(e.positionAt(o / 24, a / 24)) });
  for (let o = 0; o < 3; o++) for (const a of [1, -1]) {
    const i = r.filter((f) => ne(t, f.p)).sort((f, h) => a * h.p[o] - a * f.p[o]).find((f) => e.distanceTo(f.p) <= t.tol);
    if (!i) continue;
    O(t, i.p);
    const l = ut(e, i, o, a, 1 / 24);
    e.distanceTo(l) <= t.tol && O(t, l);
  }
}
function ut(e, t, n, r, o) {
  let { u: a, v: s } = t, i = r * t.p[n], l = t.p;
  for (let f = o; f > 1e-9; f /= 2)
    for (let h = !0, c = 0; h && c < 64; c++) {
      h = !1;
      for (const [u, d] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const m = Math.min(1, Math.max(0, a + u * f)), y = Math.min(1, Math.max(0, s + d * f)), v = L(e.positionAt(m, y));
        r * v[n] > i && (a = m, s = y, i = r * v[n], l = v, h = !0);
      }
    }
  return l;
}
var we = 1024, Y = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], _ = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], ce = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function Re(e) {
  const n = 1e-9 * Math.max(1, ...e.flatMap((a) => a.map(Math.abs))), r = ft(e, n);
  if (r.length > we) throw new w("unsupported", `Hull of ${r.length} distinct vertices exceeds the exact hull budget (${we}).`);
  if (r.length < 4) throw new w("invalid-input", "A hull needs at least four non-coplanar points.");
  const o = ht(r, n);
  return dt(r, o, Math.min(n, 1e-9));
}
function ft(e, t) {
  const n = Math.max(t * 4, 1e-300), r = /* @__PURE__ */ new Map(), o = [];
  for (const a of e) {
    const s = a.map((f) => Math.floor(f / n));
    let i = !1;
    for (let f = -1; f <= 1 && !i; f++) for (let h = -1; h <= 1 && !i; h++) for (let c = -1; c <= 1 && !i; c++)
      for (const u of r.get(`${s[0] + f},${s[1] + h},${s[2] + c}`) ?? []) if (Math.hypot(...Y(a, u)) <= t) {
        i = !0;
        break;
      }
    if (i) continue;
    const l = s.join(",");
    (r.get(l) ?? r.set(l, []).get(l)).push(a), o.push(a);
  }
  return o;
}
function Me(e, t, n, r) {
  const o = ce(Y(e[n], e[t]), Y(e[r], e[t])), a = Math.hypot(...o), s = a > 0 ? [o[0] / a, o[1] / a, o[2] / a] : [0, 0, 0], i = [(e[t][0] + e[n][0] + e[r][0]) / 3, (e[t][1] + e[n][1] + e[r][1]) / 3, (e[t][2] + e[n][2] + e[r][2]) / 3];
  return { v: [t, n, r], n: s, d: _(s, i), area: a / 2, alive: !0 };
}
function ht(e, t) {
  const n = e.length;
  let r = 0;
  for (let p = 1; p < n; p++) e[p][0] < e[r][0] && (r = p);
  let o = -1, a = -1;
  for (let p = 0; p < n; p++) {
    const x = Math.hypot(...Y(e[p], e[r]));
    x > a && (a = x, o = p);
  }
  let s = -1;
  a = -1;
  const i = Y(e[o], e[r]);
  for (let p = 0; p < n; p++) {
    const x = Math.hypot(...ce(i, Y(e[p], e[r])));
    x > a && (a = x, s = p);
  }
  if (!(a > t * Math.hypot(...i))) throw new w("invalid-input", "The hull is flat (all points collinear).");
  const l = Me(e, r, o, s);
  let f = -1;
  a = -1;
  for (let p = 0; p < n; p++) {
    const x = Math.abs(_(l.n, e[p]) - l.d);
    x > a && (a = x, f = p);
  }
  if (!(a > t)) throw new w("invalid-input", "The hull is flat (all points coplanar).");
  const h = [], c = /* @__PURE__ */ new Map(), u = (p, x, A) => {
    const I = Me(e, p, x, A), $ = h.length;
    return h.push(I), c.set(p * n + x, $), c.set(x * n + A, $), c.set(A * n + p, $), $;
  }, d = (p) => {
    const x = h[p];
    x.alive = !1;
    const [A, I, $] = x.v;
    for (const X of [A * n + I, I * n + $, $ * n + A]) c.get(X) === p && c.delete(X);
  };
  _(l.n, e[f]) - l.d > 0 ? (u(r, s, o), u(r, o, f), u(o, s, f), u(s, r, f)) : (u(r, o, s), u(r, f, o), u(o, f, s), u(s, f, r));
  const m = /* @__PURE__ */ new Set([r, o, s, f]), y = e.reduce((p, x) => [p[0] + x[0] / n, p[1] + x[1] / n, p[2] + x[2] / n], [0, 0, 0]), v = [...e.keys()].filter((p) => !m.has(p)).sort((p, x) => Math.hypot(...Y(e[x], y)) - Math.hypot(...Y(e[p], y)));
  for (const p of v) {
    const x = e[p];
    let A = -1, I = t;
    for (let C = 0; C < h.length; C++) {
      const z = h[C];
      if (!z.alive) continue;
      const B = _(z.n, x) - z.d;
      B > I && (I = B, A = C);
    }
    if (A < 0) continue;
    const $ = /* @__PURE__ */ new Set([A]), X = [A];
    for (; X.length; ) {
      const C = X.pop(), [z, B, J] = h[C].v;
      for (const [oe, se] of [[z, B], [B, J], [J, z]]) {
        const F = c.get(se * n + oe);
        F === void 0 || $.has(F) || _(h[F].n, x) - h[F].d > t && ($.add(F), X.push(F));
      }
    }
    const re = [];
    for (const C of $) {
      const [z, B, J] = h[C].v;
      for (const [oe, se] of [[z, B], [B, J], [J, z]]) {
        const F = c.get(se * n + oe);
        (F === void 0 || !$.has(F)) && re.push([oe, se]);
      }
    }
    for (const C of $) d(C);
    for (const [C, z] of re) u(C, z, p);
  }
  return h.filter((p) => p.alive);
}
function dt(e, t, n) {
  const r = e.length, o = /* @__PURE__ */ new Map();
  t.forEach((u, d) => {
    const [m, y, v] = u.v;
    o.set(m * r + y, d), o.set(y * r + v, d), o.set(v * r + m, d);
  });
  const a = new Array(t.length).fill(-1), s = [], i = [...t.keys()].sort((u, d) => t[d].area - t[u].area);
  for (const u of i) {
    if (a[u] >= 0) continue;
    const { n: d, d: m } = t[u], y = s.length, v = [u];
    a[u] = y;
    for (let x = 0; x < v.length; x++) {
      const [A, I, $] = t[v[x]].v;
      for (const [X, re] of [[A, I], [I, $], [$, A]]) {
        const C = o.get(re * r + X);
        if (C === void 0 || a[C] >= 0) continue;
        const z = t[C];
        _(z.n, d) < 1 - 1e-6 || z.v.some((B) => Math.abs(_(d, e[B]) - m) > n) || (a[C] = y, v.push(C));
      }
    }
    const p = v.length > 1 ? pt(v.map((x) => t[x].v), r) : t[u].v.slice();
    if (p) s.push(p);
    else {
      a[u] = y, s.push(t[u].v.slice());
      for (const x of v.slice(1))
        a[x] = s.length, s.push(t[x].v.slice());
    }
  }
  const l = /* @__PURE__ */ new Map();
  for (const u of s) for (const d of u) l.set(d, (l.get(d) ?? 0) + 1);
  const f = s.map((u) => {
    const d = u.filter((m) => (l.get(m) ?? 0) > 2);
    return d.length >= 3 ? d : u;
  }), h = [...new Set(f.flat())].sort((u, d) => u - d), c = new Map(h.map((u, d) => [u, d]));
  return { points: h.map((u) => e[u]), faces: f.map((u) => u.map((d) => c.get(d))) };
}
function pt(e, t) {
  const n = /* @__PURE__ */ new Set();
  for (const [s, i, l] of e) for (const [f, h] of [[s, i], [i, l], [l, s]]) n.add(f * t + h);
  const r = /* @__PURE__ */ new Map();
  for (const s of n) {
    const i = Math.floor(s / t), l = s % t;
    if (!n.has(l * t + i)) {
      if (r.has(i)) return null;
      r.set(i, l);
    }
  }
  const o = r.keys().next().value, a = [o];
  for (let s = r.get(o); s !== o; s = r.get(s)) {
    if (s === void 0 || a.length > r.size) return null;
    a.push(s);
  }
  return a.length === r.size ? a : null;
}
function mt(e, t, n = 1e-9) {
  const r = [];
  for (const o of t) {
    const a = gt(e, o);
    if (o.length === 3 || !a) {
      r.push([...o]);
      continue;
    }
    const s = o.reduce((i, l) => i + _(a, e[l]), 0) / o.length;
    if (o.every((i) => Math.abs(_(a, e[i]) - s) <= n)) {
      r.push([...o]);
      continue;
    }
    r.push(...xt(e, o, a));
  }
  return r;
}
function gt(e, t) {
  const n = [0, 0, 0];
  for (let o = 0; o < t.length; o++) {
    const a = e[t[o]], s = e[t[(o + 1) % t.length]];
    n[0] += (a[1] - s[1]) * (a[2] + s[2]), n[1] += (a[2] - s[2]) * (a[0] + s[0]), n[2] += (a[0] - s[0]) * (a[1] + s[1]);
  }
  const r = Math.hypot(...n);
  return r > 0 ? [n[0] / r, n[1] / r, n[2] / r] : null;
}
function xt(e, t, n) {
  const r = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], o = ce(n, r), a = Math.hypot(...o), s = [o[0] / a, o[1] / a, o[2] / a], i = ce(n, s), l = new Map(t.map((m) => [m, [_(e[m], s), _(e[m], i)]])), f = (m, y, v) => {
    const [p, x] = l.get(m), [A, I] = l.get(y), [$, X] = l.get(v);
    return (A - p) * (X - x) - (I - x) * ($ - p);
  }, h = (m, y, v, p) => f(y, v, m) >= 0 && f(v, p, m) >= 0 && f(p, y, m) >= 0, c = [...t], u = [];
  let d = 0;
  for (; c.length > 3 && d++ < 10 * t.length * t.length; ) {
    let m = !1;
    for (let y = 0; y < c.length; y++) {
      const v = c[(y + c.length - 1) % c.length], p = c[y], x = c[(y + 1) % c.length];
      if (!(f(v, p, x) <= 0) && !c.some((A) => A !== v && A !== p && A !== x && h(A, v, p, x))) {
        u.push([v, p, x]), c.splice(y, 1), m = !0;
        break;
      }
    }
    if (!m) break;
  }
  if (c.length > 3)
    for (let m = 1; m + 1 < c.length; m++) u.push([c[0], c[m], c[m + 1]]);
  else u.push(c);
  return u;
}
function yt(e, t) {
  const n = Math.max(1, ...e.flatMap((o) => o.map(Math.abs))), r = 1e-9 * n;
  for (const o of t) {
    const a = [0, 0, 0];
    for (let f = 0; f < o.length; f++) {
      const h = e[o[f]], c = e[o[(f + 1) % o.length]];
      a[0] += (h[1] - c[1]) * (h[2] + c[2]), a[1] += (h[2] - c[2]) * (h[0] + c[0]), a[2] += (h[0] - c[0]) * (h[1] + c[1]);
    }
    const s = Math.hypot(...a);
    if (!(s > 0)) return !1;
    const i = [a[0] / s, a[1] / s, a[2] / s], l = _(i, e[o[0]]);
    if (o.some((f) => Math.abs(_(i, e[f]) - l) > r) || e.some((f) => _(i, f) - l > r)) return !1;
  }
  return !0;
}
var D = (e) => [e[0], e[1], 0];
function vt(e, t, n) {
  let r = t;
  const o = [], a = (s, i) => ((!Array.isArray(i) || i.length !== 2) && b(`${s} must be a 2D point.`), E(s, i[0], i[1]), i);
  for (const s of n) {
    const i = s.kind === "spline" ? a("Spline point", s.through.at(-1) ?? b("A spline needs at least one point.")) : a("Path point", s.to);
    s.kind === "line" ? o.push(e.Line(D(r), D(i))) : s.kind === "arc" ? o.push(e.ThreePointArc(D(r), D(a("Arc point", s.via)), D(i))) : s.kind === "radiusArc" ? (E("Arc radius", s.radius), o.push(e.RadiusArc(D(r), D(i), s.radius))) : s.kind === "sagittaArc" ? (E("Arc sagitta", s.sagitta), o.push(e.SagittaArc(D(r), D(i), s.sagitta))) : s.kind === "spline" ? o.push(e.Spline(D(r), ...s.through.map((l) => D(a("Spline point", l))))) : b(`Unknown path segment kind '${s.kind}'.`), r = i;
  }
  return Math.hypot(r[0] - t[0], r[1] - t[1]) > 1e-9 && o.push(e.Line(D(r), D(t))), o;
}
function wt(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && b("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && b("Each polygon contour needs at least three points.");
        for (const r of n) E("Polygon points", r[0], r[1]);
      }
      return g("Polygon", () => {
        const n = t.map((r) => e.Polygon(r.map((o) => [o[0], o[1]]))).sort((r, o) => o.area - r.area);
        return N(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)));
      });
    },
    circle(t) {
      return R("Circle radius", t), g("Circle", () => N(e.Circle(t)));
    },
    rectangle(t, n, r) {
      return R("Rectangle size", t, n), g("Rectangle", () => N(r ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, r) {
      return R("Rounded rectangle size and radius", t, n, r), r >= Math.min(t, n) / 2 && b("The corner radius must be below half the short side."), g("RoundedRectangle", () => N(e.RoundedRectangle(t, n, r)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && b("A path profile needs at least one segment."), E("Path start", ...Array.isArray(t) ? t : [NaN]), g("path", () => N(e.makeFace(new e.Wire(vt(e, t, n)))));
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && b("Text must be a non-empty string."), R("Text size", n);
      try {
        return N(e.Text(t, n));
      } catch (r) {
        if (r instanceof e.FontError) throw new w("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${r.message}`, { cause: r });
        return g("Text", () => {
          throw r;
        });
      }
    },
    union: (t, ...n) => g("fuse (2D)", () => N(n.length ? e.fuse(S(t), ...n.map(S)) : S(t))),
    subtract: (t, ...n) => g("cut (2D)", () => N(n.length ? e.cut(S(t), ...n.map(S)) : S(t))),
    intersect: (t, ...n) => g("intersect (2D)", () => N(n.length ? e.intersect(S(t), ...n.map(S)) : S(t))),
    hull: (...t) => (t.length || b("A hull needs at least one profile."), g("Hull (2D)", () => N(e.Hull(...t.map(S))))),
    translate: (t, [n, r]) => (E("Profile offset", n, r), g("translate (2D)", () => N(S(t).translate([n, r, 0])))),
    rotate: (t, n) => (E("Profile angle", n), g("rotate (2D)", () => N(S(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, r]) => (E("Profile scale", n, r), (n === 0 || r === 0) && b("A zero profile scale flattens the profile."), g("scale (2D)", () => N(S(t).scale([n, r, 1])))),
    offset: (t, n, r) => (E("Profile offset distance", n), g("offset (2D)", () => N(e.offset(S(t), n, { corners: r ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = S(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => g("area (2D)", () => S(t).area)
  };
}
var Mt = 0.01, bt = 10, At = "MIT AND Apache-2.0";
async function Et(e) {
  const { init: t } = await import("./chunk-AJV3MJKC-eTtNTT3-.js").then(function(n) {
    return n.c;
  });
  try {
    return await t(e);
  } catch (n) {
    throw new w("invalid-input", `Could not load SMLib: ${n instanceof Error ? n.message : String(n)}`, { cause: n });
  }
}
var be = (e) => {
  const t = e.tolerance ?? Mt, n = e.angleDeg ?? bt;
  return R("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function St({ sm: e, solid: t }) {
  return {
    box(n) {
      return R("Box size", ...n), g("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, r) {
      return R("Cylinder radius and height", n, r), g("Cylinder", () => t("Cylinder", e.Cylinder(n, r)));
    },
    cone(n, r, o) {
      return E("Cone radii", n, r), R("Cone height", o), (n < 0 || r < 0 || !(n > 0 || r > 0)) && b("Cone radii must be non-negative and not both zero."), g("Cone", () => t("Cone", n === r ? e.Cylinder(n, o) : e.Cone(n, r, o)));
    },
    sphere(n) {
      return R("Sphere radius", n), g("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, r) {
      return R("Torus radii", n, r), r >= n && b("The tube radius must be smaller than the major radius."), g("Torus", () => t("Torus", e.Torus(n, r)));
    },
    polyhedron(n, r) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(r) || r.length < 4) && b("A polyhedron needs at least four points and four faces.");
      for (const o of n) E("Polyhedron points", o[0], o[1], o[2]);
      for (const o of r) (!Array.isArray(o) || o.length < 3 || o.some((a) => !Number.isInteger(a) || a < 0 || a >= n.length)) && b("Polyhedron faces must index at least three existing points.");
      return g("stitch (polyhedron)", () => e.scope(() => {
        const o = mt(n, r).map((s) => {
          const i = s.map((l) => V(n[l]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), a = e.stitch(...o);
        return (!(a instanceof e.Part) || !a.isValid()) && b("The polyhedron faces do not close around a valid solid."), q(a);
      }));
    }
  };
}
function $t({ sm: e, solid: t }) {
  return {
    extrude(n, r) {
      return R("Extrusion height", r), g("extrude", () => t("extrude", e.extrude(S(n), r)));
    },
    revolve(n, r) {
      return E("Revolution angle", r), (r === 0 || Math.abs(r) > 360) && b("Revolution angle must be in (0, 360] degrees in magnitude."), g("revolve", () => e.scope(() => {
        const o = S(n).rotate(e.Axis.X, 90), a = e.revolve(o, e.Axis.Z, Math.abs(r));
        return t("revolve", r < 0 ? a.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : a);
      }));
    },
    loft(n, r = {}) {
      (!Array.isArray(n) || n.length < 2) && b("A loft needs at least two sections.");
      for (const o of n) E("Loft section position", ...o.at);
      return g("loft", () => e.scope(() => t("loft", e.loft(n.map((o) => S(o.profile).translate(V(o.at))), { ruled: !!r.ruled }))));
    },
    sweep(n, r) {
      (!Array.isArray(r) || r.length < 2) && b("A sweep rail needs at least two points.");
      for (const o of r) E("Sweep rail points", ...o);
      return g("sweep", () => e.scope(() => {
        const o = r.map(V), a = o.length === 2 ? e.Line(o[0], o[1]) : e.Polyline(o);
        return t("sweep", e.sweep(S(n), a));
      }));
    }
  };
}
function Ct({ sm: e, solid: t }) {
  return {
    union: (n, ...r) => g("fuse", () => t("fuse", r.length ? e.fuse(M(n), ...r.map(M)) : M(n))),
    subtract: (n, ...r) => g("cut", () => t("cut", r.length ? e.cut(M(n), ...r.map(M)) : M(n))),
    intersect: (n, ...r) => g("intersect", () => t("intersect", r.length ? e.intersect(M(n), ...r.map(M)) : M(n))),
    splitByPlane: (n, r, o) => {
      const a = ie("Split normal", r);
      return E("Split offset", o), g("split", () => {
        const [s, i] = e.split(M(n), new e.Plane([a[0] * o, a[1] * o, a[2] * o], void 0, a), "both");
        return [t("split", s), t("split", i)];
      });
    },
    translate: (n, r) => (E("Translation", ...r), g("translate", () => q(M(n).translate(V(r))))),
    rotate: (n, r, o, a = [0, 0, 0]) => {
      const s = ie("Rotation axis", r);
      return E("Rotation angle and pivot", o, ...a), g("rotate", () => q(M(n).rotate(new e.Axis(V(a), s), o)));
    },
    mirror: (n, r, o = [0, 0, 0]) => {
      const a = ie("Mirror normal", r);
      return E("Mirror origin", ...o), g("mirror", () => q(M(n).mirror(new e.Plane(V(o), void 0, a))));
    },
    scale: (n, r) => (E("Scale factors", ...r), r.some((o) => o === 0) && b("A zero scale factor flattens the solid."), g("scale", () => q(M(n).scale(V(r), [0, 0, 0]))))
  };
}
function Tt(e) {
  const { sm: t, solid: n, face: r } = e, o = (s, i) => i === "all" ? s.edges() : r(s, i).edges(), a = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, i, l = "all") => (R("Fillet radius", i), g("fillet", () => n("fillet", t.fillet(o(M(s), l), i)))),
    chamfer: (s, i, l = "all") => (R("Chamfer distance", i), g("chamfer", () => n("chamfer", t.chamfer(o(M(s), l), i)))),
    shell: (s, i, l) => {
      R("Shell thickness", i);
      const f = l === void 0 ? [] : a(l) ? [l] : [...l];
      return g("shell", () => {
        const h = M(s), c = f.map((u) => r(h, u));
        return n("shell", t.shell(h, -i, c.length ? c : null));
      });
    }
  };
}
function Pt({ sm: e }) {
  return {
    volume: (t) => g("volume", () => M(t).volume),
    area: (t) => g("area", () => M(t).area),
    // Not SMLib's bbox(): it misses interior extremes of some rotated spheres (see bbox.ts).
    bbox: (t) => g("bbox", () => et(M(t))),
    massProperties: (t) => g("massProperties", () => {
      const n = M(t).massProperties(1), r = n.inertia, o = (l, f) => (r[l][f] + r[f][l]) / 2, a = [[r[0][0], o(0, 1), o(0, 2)], [o(0, 1), r[1][1], o(1, 2)], [o(0, 2), o(1, 2), r[2][2]]], { values: s, vectors: i } = We(a);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: a, principalMoments: s, principalAxes: i };
    }),
    isValid: (t) => g("isValid", () => M(t).isValid()),
    solidCount: (t) => g("solids", () => e.scope(() => M(t).solids().length)),
    components: (t) => g("solids", () => [...M(t).solids()].map(q))
  };
}
function zt({ sm: e, solid: t }) {
  return {
    tessellate: (n, r = {}) => {
      const { tolerance: o, angle: a } = be(r);
      return g("mesh", () => e.scope(() => {
        const s = M(n).mesh(o, a), i = Float64Array.from(s.vertices), l = Uint32Array.from(s.triangles);
        return { positions: i, normals: Je(i, l), indices: l };
      }));
    },
    exportStl: (n, r = {}) => {
      const { tolerance: o, angle: a } = be(r);
      return g("toStl", () => e.toStl(M(n), { tolerance: o, angle: a }));
    },
    exportStep: (n) => g("toStep", () => e.toStep(M(n))),
    importStep: (n) => ((typeof n != "string" || !n.length) && b("STEP input must be non-empty text."), g("fromStep", () => {
      const r = e.fromStep(n);
      if (Array.isArray(r) && r.length && r.every((o) => o instanceof e.Part)) {
        const o = r;
        return t("fromStep", o.length === 1 ? o[0] : e.fuse(o[0], ...o.slice(1)));
      }
      return t("fromStep", r);
    }))
  };
}
async function Nt(e = {}) {
  const t = await Et(e);
  t.setWarningHandler(() => {
  });
  const n = Qe(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: At,
    profile: wt(t),
    ...St(n),
    ...$t(n),
    ...Ct(n),
    ...Tt(n),
    ...Pt(n),
    ...zt(n),
    memory: () => {
      const r = t.memoryUsage();
      return { used: r.used, heap: r.heap, handles: r.handles };
    },
    scope: (r) => t.scope(r)
  };
}
const Rt = "@crispcad/exact-kernel", _t = "0.1.1", Dt = "smlib", It = Object.freeze({ id: Dt, package: Rt, version: _t }), Ae = 16, Ee = 256, T = (e) => {
  throw new w("unsupported", e);
}, U = (e) => {
  throw new w("invalid-input", e);
};
function Z(e, t) {
  t < Ae && T(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${Ae}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const Lt = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], pe = (e, t) => {
  const n = [];
  for (let r = 0; r < 3; r++)
    for (let o = 0; o < 4; o++)
      n.push(e[r * 4] * t[o] + e[r * 4 + 1] * t[4 + o] + e[r * 4 + 2] * t[8 + o] + (o === 3 ? e[r * 4 + 3] : 0));
  return n;
}, G = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), Se = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], Ot = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function le(e, t) {
  const n = Math.hypot(...e);
  n > 0 || U("Rotation axis must be non-zero.");
  const [r, o, a] = e.map((h) => h / n), s = t * Math.PI / 180, i = Math.cos(s), l = Math.sin(s), f = 1 - i;
  return [f * r * r + i, f * r * o - l * a, f * r * a + l * o, 0, f * r * o + l * a, f * o * o + i, f * o * a - l * r, 0, f * r * a - l * o, f * o * a + l * r, f * a * a + i, 0];
}
const Xt = (e) => pe(le([0, 0, 1], e[2]), pe(le([0, 1, 0], e[1]), le([1, 0, 0], e[0])));
function Bt(e) {
  const t = Math.hypot(...e);
  t > 0 || U("Mirror normal must be non-zero.");
  const [n, r, o] = e.map((a) => a / t);
  return [1 - 2 * n * n, -2 * n * r, -2 * n * o, 0, -2 * n * r, 1 - 2 * r * r, -2 * r * o, 0, -2 * n * o, -2 * r * o, 1 - 2 * o * o, 0];
}
function Ft(e) {
  const [t, n, r, , o, a, s, , i, l, f] = e, h = Math.max(-1, Math.min(1, (t + a + f - 1) / 2)), c = Math.acos(h);
  if (c < 1e-15)
    return null;
  let u = [l - s, r - i, o - n];
  return Math.hypot(...u) < 1e-9 && (u = [[t + 1, o, i], [n, a + 1, l], [r, s, f + 1]].reduce((m, y) => Math.hypot(...y) > Math.hypot(...m) ? y : m)), { axis: u, degrees: c * 180 / Math.PI };
}
function Ht(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && U("Affine matrix is singular.");
  for (const [s, i] of [[0, 1], [0, 2], [1, 2]]) {
    const l = t[s][0] * t[i][0] + t[s][1] * t[i][1] + t[s][2] * t[i][2];
    Math.abs(l) > 1e-9 * n[s] * n[i] && T("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const r = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), o = [n[0], n[1], r < 0 ? -n[2] : n[2]], a = [0, 1, 2].flatMap((s) => [e[s * 4] / o[0], e[s * 4 + 1] / o[1], e[s * 4 + 2] / o[2], 0]);
  return { scale: o, rotation: a, translate: [e[3], e[7], e[11]] };
}
function _e(e, t, n, r) {
  const o = e.map((s, i) => {
    if (!s)
      return 0;
    const l = r[i] - n[i];
    return l < 1e-12 && U("Cannot resize a degenerate shape."), s / l;
  }), a = Math.max(...o) || 1;
  return o.map((s, i) => e[i] ? s : t?.[i] ? a : 1);
}
function H(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return Z("circle2d", t.segments), e.profile.circle(t.radius);
    case "rectangle":
      return e.profile.rectangle(t.size[0], t.size[1], t.center);
    case "move": {
      const n = H(e, t.profile);
      return n && e.profile.translate(n, t.vector);
    }
    case "rotate": {
      const n = H(e, t.profile);
      return n && e.profile.rotate(n, t.angle);
    }
    case "scale": {
      const n = H(e, t.profile);
      return n && e.profile.scale(n, t.vector);
    }
    case "affine": {
      const n = H(e, t.profile);
      if (!n)
        return null;
      const [r, o, a, s, i, l] = t.matrix, f = Math.hypot(r, s), h = Math.hypot(o, i);
      f > 1e-12 && h > 1e-12 || U("2D affine matrix is singular."), Math.abs(r * o + s * i) > 1e-9 * f * h && T("2D affine transforms with shear have no exact lowering here.");
      const c = r * i - o * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [f, c < 0 ? -h : h]), Math.atan2(s, r) * 180 / Math.PI), [a, l]);
    }
    case "resize": {
      const n = H(e, t.profile);
      if (!n)
        return null;
      const r = e.profile.bounds(n), o = _e(t.size, t.auto, r.min, r.max);
      return e.profile.scale(n, [o[0], o[1]]);
    }
    case "offset": {
      t.round && Z("offset2d", t.segments);
      const n = H(e, t.profile);
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
      const n = t.profiles.map((a) => H(e, a)), r = n.filter((a) => a !== null);
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
function k(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, r = e.center ? -t / 2 : 0, o = e.center ? -n / 2 : 0;
      return [[r, o], [r + t, o], [r + t, o + n], [r, o + n]];
    }
    case "move":
      return k(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return k(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), r = Math.sin(t);
      return k(e.profile).map(([o, a]) => [n * o - r * a, r * o + n * a]);
    }
    case "affine": {
      const t = e.matrix;
      return k(e.profile).map(([n, r]) => [t[0] * n + t[1] * r + t[2], t[3] * n + t[4] * r + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(k);
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
      return r(Se(e.vector), e.shape);
    case "rotate":
      return r(Xt(e.vector), e.shape);
    case "scale":
      return r(Ot(e.vector), e.shape);
    case "mirror":
      return r(Bt(e.vector), e.shape);
    case "axisRotate":
      return r(le(e.vector, e.angle), e.shape);
    case "affine":
      return r(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let o = 0; o < e.count; o++)
        r(Se(e.step.map((a) => a * o)), e.shape);
      return;
    case "box": {
      const [o, a, s] = e.size.map((i) => i / 2);
      for (const i of [-o, o])
        for (const l of [-a, a])
          for (const f of [-s, s])
            n.points.push(G(t, [i, l, f]));
      return;
    }
    case "polyhedron":
      for (const o of e.points)
        n.points.push(G(t, o));
      return;
    case "extrude":
      for (const [o, a] of e.points)
        for (const s of [0, e.height])
          n.points.push(G(t, [o, a, s]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && T("hull of a twisted extrusion has no exact lowering.");
      for (const [o, a] of k(e.profile))
        n.points.push(G(t, [o, a, 0])), n.points.push(G(t, [o * e.scaleTop[0], a * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      Z("sphere", e.segments);
      const o = [0, 1, 2].map((a) => Math.hypot(t[a], t[4 + a], t[8 + a]));
      Math.max(...o) - Math.min(...o) > 1e-12 * Math.max(...o) && T("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: G(t, [0, 0, 0]), radius: e.radius * o[0] });
      return;
    }
    default:
      T(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function Kt(e, t) {
  const n = { points: [], spheres: [] };
  for (const u of t)
    me(u, Lt, n);
  if (n.points.length && n.spheres.length && T("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const u = Re(n.points);
    return e.polyhedron(u.points, u.faces);
  }
  if (!n.spheres.length)
    return null;
  const r = n.spheres[0].radius;
  n.spheres.some((u) => Math.abs(u.radius - r) > 1e-12 * r) && T("hull of spheres with different radii has no exact lowering.");
  const o = n.spheres.map((u) => u.centre), a = [0, 1, 2].map((u) => Math.min(...o.map((d) => d[u]))), s = [0, 1, 2].map((u) => Math.max(...o.map((d) => d[u]))), i = s.map((u, d) => u - a[d]), l = 1e-9 * Math.max(1, ...i);
  if (i.every((u) => u <= l))
    return e.translate(e.sphere(r), a);
  const f = (u) => [u & 1 ? s[0] : a[0], u & 2 ? s[1] : a[1], u & 4 ? s[2] : a[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((u) => o.some((d) => d.every((m, y) => Math.abs(m - f(u)[y]) <= l))) || i.some((u) => u <= l)) && T("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const c = e.box(i.map((u) => u + 2 * r));
  return e.translate(e.fillet(c, r, "all"), a.map((u, d) => u + i[d] / 2));
}
function De(e, t, n) {
  const r = e.profile.bounds(t), o = r.max[0] <= 0;
  r.min[0] < -1e-8 && !o && U("Revolved profiles must stay on one side of the radial axis.");
  const a = Math.abs(n);
  a > 360 && U("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(o ? e.profile.scale(t, [-1, 1]) : t, n);
  return o && a !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function Yt(e, t, n) {
  const { scale: r, rotation: o, translate: a } = Ht(n);
  let s = r.every((l) => Math.abs(l - 1) < 1e-15) ? t : e.scale(t, r);
  const i = Ft(o);
  return i && (s = e.rotate(s, i.axis, i.degrees)), a.some((l) => l !== 0) ? e.translate(s, a) : s;
}
function xe(e, t) {
  const n = (r) => xe(e, r);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return Z("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return Z("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return Z("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && T("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && T("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const r = H(e, t.profile);
      return r && e.extrude(r, t.height);
    }
    case "revolve": {
      if (Z("revolve", t.segments), t.angle === 0)
        return null;
      const r = H(e, t.profile);
      return r && De(e, r, t.angle);
    }
    case "polyhedron": {
      if (t.faces.length > Ee && T(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${Ee}); tessellated constructors (ellipsoid, ellipticFrustum, roundedCylinder, many-section loft) have no exact lowering yet.`), yt(t.points, t.faces)) {
        const r = Re(t.points);
        return e.polyhedron(r.points, r.faces);
      }
      return e.polyhedron(t.points, t.faces);
    }
    case "union":
    case "subtract":
    case "intersect": {
      const r = (l) => l.kind === "union" ? l.shapes.flatMap(r) : [l], a = (t.kind === "subtract" ? [t.shapes[0], ...t.shapes.slice(1).flatMap(r)] : t.shapes).map(n), s = a.filter((l) => l !== null);
      if (t.kind === "union")
        return s.length ? e.union(s[0], ...s.slice(1)) : null;
      if (t.kind === "intersect")
        return a.some((l) => l === null) || !s.length ? null : e.intersect(s[0], ...s.slice(1));
      if (!a[0])
        return null;
      const i = a.slice(1).filter((l) => l !== null);
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
      return e.scale(r, _e(t.vector, t.auto, o.min, o.max));
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
function Qt(e, t) {
  let n;
  try {
    n = ze(t).shape;
  } catch (o) {
    throw o instanceof Oe ? new w("invalid-input", `CAD Script: ${o.message}`, { cause: o }) : o;
  }
  const r = e.scope(() => xe(e, n));
  if (!r)
    throw new w("invalid-input", "The program produces no solid.");
  if (!(e.volume(r) > 0))
    throw r.dispose(), new w("kernel-failure", "The exact result has no positive volume.");
  return r;
}
const en = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} });
class $e extends w {
  constructor(n, r) {
    super(n.code, n.message, r);
    fe(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const ee = (e) => {
  throw new w("unsupported", e);
};
function Ce(e, t, n) {
  if (!n?.some((o) => o !== 0))
    return ye([...t]), e.profile.polygon([t]);
  ye([...t], [...n]);
  const r = t.map((o, a) => {
    const s = t[(a + 1) % t.length], i = n[a] ?? 0;
    return i ? { kind: "arc", via: je(o, s, i), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], r);
}
const Te = (e, t, n) => {
  const r = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(r, [t[0], t[1]]) : r;
};
function Pe(e, t, n) {
  const r = t.profile;
  switch (r.kind) {
    case "rectangle":
      return e.profile.rectangle(j(r.width, n), j(r.depth, n), !0);
    case "circle":
      return Te(e, r.center ?? [0, 0], j(r.radius, n));
    case "outline":
      return Ce(e, r.points, r.bulges);
    case "region": {
      Xe(r.loops, (s) => j(s, n));
      const o = (s) => s.kind === "circle" ? Te(e, [j(s.center[0], n), j(s.center[1], n)], j(s.radius, n)) : Ce(e, s.points, s.bulges), a = r.loops.map(o).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, i) => i.area - s.area);
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
        const c = xe(e, ze(s.program).shape);
        if (!c)
          throw new w("invalid-input", "Code produces no printable solid.");
        i = c;
        break;
      }
      case "extrusion": {
        const { distance: c, start: u, plane: d } = Ye(s, t);
        i = e.extrude(Pe(e, t.sketches[s.sketchId], t), c), u && (i = e.translate(i, [0, 0, u])), d === "XZ" ? i = Q(e, i, [90, 0, 0]) : d === "YZ" && (i = Q(e, i, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: c, angle: u, axisOffset: d } = Ke(s, t);
        let m = Pe(e, t.sketches[s.sketchId], t);
        d && (m = e.profile.translate(m, [-d, 0])), i = De(e, m, u), c === "XY" ? i = Q(e, i, [-90, 0, 0]) : c === "YZ" && (i = Q(e, i, [0, 0, 90])), d && (i = e.translate(i, c === "YZ" ? [0, d, 0] : [d, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: c, offset: u } = He(s, t), d = [0, 0, 0];
        if (d[c] = 1, i = e.mirror(W(e, t, s.source, r, o), d), u) {
          const m = [0, 0, 0];
          m[c] = 2 * u, i = e.translate(i, m);
        }
        break;
      }
      case "pattern": {
        const c = Fe(s, t), u = W(e, t, s.source, r, o), d = [u];
        if (c.mode === "linear")
          for (let m = 1; m < c.count; m++) {
            const y = [0, 0, 0];
            y[c.axis] = m * c.spacing, d.push(e.translate(u, y));
          }
        else {
          const m = c.sweep / (Math.abs(c.sweep) === 360 ? c.count : c.count - 1), y = [0, 0, 0];
          y[c.axis] = 1;
          for (let v = 1; v < c.count; v++)
            d.push(e.rotate(u, y, v * m, c.center));
        }
        i = e.union(d[0], ...d.slice(1));
        break;
      }
      case "boolean": {
        const c = s.inputs.map((u) => W(e, t, u, r, o));
        if (s.useHoleRoles) {
          const u = c.filter((y, v) => t.nodes[s.inputs[v]].role !== "hole"), d = c.filter((y, v) => t.nodes[s.inputs[v]].role === "hole");
          u.length || ee("A combination of holes only has no solid to export.");
          const m = u.length > 1 ? e.union(u[0], ...u.slice(1)) : u[0];
          i = d.length ? e.subtract(m, ...d) : m;
        } else
          i = s.operation === "union" ? e.union(c[0], ...c.slice(1)) : s.operation === "subtract" ? e.subtract(c[0], ...c.slice(1)) : e.intersect(c[0], ...c.slice(1));
        break;
      }
      case "exact-feature": {
        const c = Be(s, t), u = W(e, t, s.source, r, o);
        i = c.operation === "fillet" ? e.fillet(u, c.size, c.edges) : c.operation === "chamfer" ? e.chamfer(u, c.size, c.edges) : e.shell(u, c.size, c.openFaces);
        break;
      }
      case "mesh":
        return ee(s.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return ee(`'${s.kind}' has no exact lowering.`);
    }
    const { scale: l, rotation: f, position: h } = s.transform;
    l.some((c) => c !== 1) && (i = e.scale(i, l)), i = Q(e, i, f), h.some((c) => c !== 0) && (i = e.translate(i, h));
  } catch (l) {
    if (l instanceof $e)
      throw l;
    const f = l instanceof w ? l.code : "invalid-input", h = l instanceof Error ? l.message : String(l);
    throw new $e({ code: f, bodyId: r, nodeId: n, feature: s.kind, message: `${s.name} (${s.kind}): ${h}` }, { cause: l });
  }
  return o.set(n, i), i;
}
function jt(e, t, n) {
  if (!t.roots.includes(n))
    throw new w("invalid-input", `${n} is not a top-level body.`);
  return W(e, t, n, n, /* @__PURE__ */ new Map());
}
function qt(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (!o)
    throw new w("invalid-input", `${n} is not a node of this model.`);
  const a = r.local ? { ...t, nodes: { ...t.nodes, [n]: { ...o, transform: qe() } } } : t, s = t.roots.find((i) => i === n) ?? n;
  return W(e, a, n, s, /* @__PURE__ */ new Map());
}
const he = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function Vt(e, t) {
  const n = [], r = [], o = /* @__PURE__ */ new Map(), a = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < a.length; i++) {
    const l = he(e.positions[3 * i]), f = he(e.positions[3 * i + 1]), h = he(e.positions[3 * i + 2]), c = `${l},${f},${h}`;
    let u = o.get(c);
    u === void 0 && (u = n.length / 3, o.set(c, u), n.push(l, f, h)), a[i] = u;
  }
  const s = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.indices.length; i += 3) {
    const l = a[e.indices[i]], f = a[e.indices[i + 1]], h = a[e.indices[i + 2]];
    if (!(l === f || f === h || h === l)) {
      r.push(l, f, h);
      for (const [c, u] of [[l, f], [f, h], [h, l]])
        s.set(`${c},${u}`, (s.get(`${c},${u}`) ?? 0) + 1);
    }
  }
  for (const [i, l] of s) {
    const [f, h] = i.split(",");
    if (l !== 1 || s.get(`${h},${f}`) !== 1)
      throw new w("kernel-failure", P`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > Ve || r.length > Ze)
    throw new w("unsupported", P`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (r.length < 12)
    throw new w("kernel-failure", P`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: r };
}
function Zt(e, t, n) {
  const r = t.nodes[n];
  if (r?.kind !== "exact-feature")
    throw new w("invalid-input", P`${n} is not an exact feature`);
  const o = qt(e, t, n, { local: !0 });
  if (!e.isValid(o))
    throw new w("kernel-failure", P`${r.name}: the exact result is not a valid closed solid.`);
  const a = Vt(e.tessellate(o, Ue), r.name);
  return { display: { sourceKey: Ge(t, n), ...a }, volume: e.volume(o) };
}
const ue = 64, Ut = 64 * 1024 * 1024;
function Gt(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const r of n) {
      if (!e.roots.includes(r))
        throw new w("invalid-input", P`Unknown object id: ${r}`);
      const o = e.nodes[r];
      if (o.reference)
        throw new w("invalid-input", P`${o.name} is a reference body and is never exported or measured.`);
      if (o.role === "hole")
        throw new w("invalid-input", P`${o.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((r) => !e.nodes[r].reference && e.nodes[r].role !== "hole");
  if (!n.length)
    throw new w("invalid-input", P("The design has no solid bodies to export"));
  if (n.length > ue)
    throw new w("invalid-input", P`Exact commands are limited to ${ue} bodies.`);
  return n;
}
function kt(e) {
  const t = Object.freeze({ ...It, smlib: e.version, licence: e.licence }), n = (r, o) => {
    const a = ve(r), s = Gt(a, o);
    return { doc: a, targets: s, solids: s.map((i) => {
      const l = jt(e, a, i);
      if (!e.isValid(l))
        throw new w("kernel-failure", P`${a.nodes[i].name}: the exact result is not a valid closed solid.`);
      return l;
    }) };
  };
  return {
    kernel: e,
    info: t,
    measure(r, o) {
      return e.scope(() => {
        const { doc: a, targets: s, solids: i } = n(r, o);
        return { kernel: t, bodies: i.map((l, f) => {
          const h = e.bbox(l), c = e.massProperties(l);
          return { id: s[f], name: a.nodes[s[f]].name, volume: e.volume(l), area: e.area(l), bounds: { min: [...h.min], max: [...h.max] }, centroid: [...c.centroid], solids: e.solidCount(l) };
        }) };
      });
    },
    featureDisplays(r, o) {
      const a = ve(r), s = o?.length ? [...new Set(o)] : ke(a);
      if (s.length > ue)
        throw new w("invalid-input", P`Exact commands are limited to ${ue} bodies.`);
      for (const i of s)
        if (a.nodes[i]?.kind !== "exact-feature")
          throw new w("invalid-input", P`${i} is not an exact feature`);
      return { kernel: t, features: s.map((i) => e.scope(() => ({ id: i, name: a.nodes[i].name, ...Zt(e, a, i) }))) };
    },
    exportStep(r, o) {
      return e.scope(() => {
        const { doc: a, targets: s, solids: i } = n(r, o);
        let l = i[0];
        if (i.length > 1) {
          const c = i.reduce((u, d) => u + e.solidCount(d), 0);
          if (l = e.union(i[0], ...i.slice(1)), e.solidCount(l) !== c) {
            for (let u = 0; u < i.length; u++)
              for (let d = u + 1; d < i.length; d++)
                if (e.solidCount(e.union(i[u], i[d])) < e.solidCount(i[u]) + e.solidCount(i[d]))
                  throw new w("unsupported", P`${a.nodes[s[u]].name} and ${a.nodes[s[d]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new w("unsupported", P("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const f = e.exportStep(l), h = new TextEncoder().encode(f).byteLength;
        if (h > Ut)
          throw new w("unsupported", P("The STEP file exceeds 64 MiB."));
        return { kernel: t, bodies: s.map((c) => ({ id: c, name: a.nodes[c].name })), step: f, bytes: h };
      });
    }
  };
}
let ae;
function tn(e = {}) {
  return ae ?? (ae = Nt(e).then(kt, (t) => {
    throw ae = void 0, t;
  })), ae;
}
export {
  Dt as EXACT_KERNEL_ID,
  Rt as EXACT_KERNEL_PACKAGE,
  _t as EXACT_KERNEL_VERSION,
  w as ExactKernelError,
  $e as ExactLoweringError,
  ue as MAX_EXACT_BODIES,
  Ee as MAX_POLYHEDRON_FACES,
  Ut as MAX_STEP_BYTES,
  Ae as MIN_EXACT_SEGMENTS,
  en as cadScript,
  tn as createExactBackend,
  kt as createExactBackendFromKernel,
  Vt as displayMesh,
  Qt as evaluateCadScript,
  Zt as exactFeatureDisplay,
  It as exactKernelIdentity,
  Gt as exactTargets,
  xe as lowerCodeShape,
  jt as lowerDocumentBody,
  qt as lowerDocumentNode,
  De as revolveProfile,
  Pe as sketchProfile
};
