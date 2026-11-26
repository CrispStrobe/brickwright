var tt = Object.defineProperty;
var nt = (e, t, n) => t in e ? tt(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var te = (e, t, n) => nt(e, typeof t != "symbol" ? t + "" : t, n);
import { c as ke, C as rt, s as ot, a as st, e as at, f as W, b as it, d as lt, g as ct, h as ut, i as ft, j as Ce, k as ht, l as dt, t as D, M as pt, m as gt, E as ze, n as mt, v as Pe, o as xt } from "../geometry.worker-4qgsc7be.js";
var T = class extends Error {
  constructor(t, n, r) {
    super(n, r);
    te(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, P = (e) => {
  throw new T("invalid-input", e);
};
function _(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && P(`${e} must be finite numbers (got ${String(n)}).`);
}
function O(e, ...t) {
  _(e, ...t);
  for (const n of t) n > 0 || P(`${e} must be positive (got ${n}).`);
}
function he(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return P(`${e} must be a 3-vector.`);
  _(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || P(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function yt(e) {
  const t = e.map((r) => [...r]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let r = 0; r < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); r++)
    for (const [a, s] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[a][s]) < 1e-300) continue;
      const i = (t[s][s] - t[a][a]) / (2 * t[a][s]), l = Math.sign(i || 1) / (Math.abs(i) + Math.sqrt(i * i + 1)), f = 1 / Math.sqrt(l * l + 1), h = l * f;
      for (let c = 0; c < 3; c++) {
        const u = t[c][a], p = t[c][s];
        t[c][a] = f * u - h * p, t[c][s] = h * u + f * p;
      }
      for (let c = 0; c < 3; c++) {
        const u = t[a][c], p = t[s][c];
        t[a][c] = f * u - h * p, t[s][c] = h * u + f * p;
      }
      for (let c = 0; c < 3; c++) {
        const u = n[c][a], p = n[c][s];
        n[c][a] = f * u - h * p, n[c][s] = h * u + f * p;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((r) => [n[0][r], n[1][r], n[2][r]]) };
}
function wt(e, t) {
  const n = new Float64Array(e.length);
  for (let r = 0; r < t.length; r += 3) {
    const o = t[r] * 3, a = t[r + 1] * 3, s = t[r + 2] * 3, i = e[a] - e[o], l = e[a + 1] - e[o + 1], f = e[a + 2] - e[o + 2], h = e[s] - e[o], c = e[s + 1] - e[o + 1], u = e[s + 2] - e[o + 2], p = l * u - f * c, g = f * h - i * u, w = i * c - l * h;
    for (const y of [o, a, s])
      n[y] += p, n[y + 1] += g, n[y + 2] += w;
  }
  for (let r = 0; r < n.length; r += 3) {
    const o = Math.hypot(n[r], n[r + 1], n[r + 2]);
    o > 0 && (n[r] /= o, n[r + 1] /= o, n[r + 2] /= o);
  }
  return n;
}
var Q = (e) => ({ part: e, dispose: () => e.dispose() }), L = (e, t) => ({ sketch: e, outline: t, dispose: () => {
  e.dispose(), t?.dispose();
} }), N = (e) => e?.part ?? P("Not a solid of this kernel."), I = (e) => e?.sketch ?? P("Not a profile of this kernel."), Ne = (e) => e?.outline, G = (e) => [e[0], e[1], e[2]];
function A(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof T) throw n;
    const r = n instanceof Error ? n.message : String(n);
    throw new T("kernel-failure", `SMLib ${e} failed: ${r}`, { cause: n });
  }
}
function vt(e) {
  return { sm: e, solid: (r, o) => {
    if (!(o instanceof e.Part)) throw new T("kernel-failure", `SMLib ${r} did not produce a solid (got ${o?.constructor?.name ?? typeof o}).`);
    return Q(o);
  }, face: (r, o) => {
    const { faceNormal: a, outermost: s } = Array.isArray(o) ? { faceNormal: o, outermost: !1 } : o, i = he("Face normal", a), l = (h) => {
      const c = h.center();
      return c.x * i[0] + c.y * i[1] + c.z * i[2];
    }, f = [...r.faces()].filter((h) => {
      if (!h.isPlanar) return !1;
      const c = h.normalAt();
      return c.x * i[0] + c.y * i[1] + c.z * i[2] > 1 - 1e-9;
    });
    return s && f.length ? f.sort((h, c) => l(c) - l(h))[0] : (f.length !== 1 && P(`Expected exactly one planar face with outward normal [${i.join(", ")}], found ${f.length}.`), f[0]);
  } };
}
var Se = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], Me = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Y = (e) => [e.x, e.y, e.z], ce = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return t > 1e-15 ? [e[0] / t, e[1] / t, e[2] / t] : null;
}, k = (e, ...t) => {
  const n = [e[0], e[1], e[2]];
  for (const [r, o] of t)
    n[0] += r * o[0], n[1] += r * o[1], n[2] += r * o[2];
  return n;
};
function Mt(e) {
  const t = e.bbox(), n = Math.max(1, t.diagonal), r = 1e-7 * n, o = { min: [1 / 0, 1 / 0, 1 / 0], max: [-1 / 0, -1 / 0, -1 / 0], tol: r };
  for (const a of e.vertices()) H(o, [a.x, a.y, a.z]);
  for (const a of e.edges({ seams: !0 })) bt(a, o);
  for (const a of e.faces()) Et(a, o);
  return Number.isFinite(o.min[0]) ? { min: o.min, max: o.max } : { min: [t.min.x, t.min.y, t.min.z], max: [t.max.x, t.max.y, t.max.z] };
}
function H(e, t) {
  for (let n = 0; n < 3; n++)
    t[n] < e.min[n] && (e.min[n] = t[n]), t[n] > e.max[n] && (e.max[n] = t[n]);
}
var ue = (e, t) => t.some((n, r) => n < e.min[r] - e.tol || n > e.max[r] + e.tol), Ue = (e, t) => t.some((n) => ue(e, [n.x, n.y, n.z]));
function bt(e, t) {
  H(t, Y(e.start)), H(t, Y(e.end));
  const n = e.geomType;
  if (n === "line" || n === "circle" && At(e, t)) return;
  let r = null;
  try {
    if (r = e.nurbs(), !Ue(t, r.points)) return;
  } catch {
  }
  _e(n === "bspline" && r ? St(r) : { t0: 0, t1: 1, spans: 1, at: (o) => Y(e.pointAt(o)) }, t);
}
function At(e, t) {
  const n = Y(e.arcCenter), r = ce(Y(e.normal)), o = e.radius;
  if (!r) return !1;
  for (const a of Se) {
    const s = ce(k(a, [-Me(a, r), r]));
    if (s)
      for (const i of [1, -1]) {
        const l = k(n, [i * o, s]);
        ue(t, l) && (e.isClosed || e.distanceTo(l) <= t.tol) && H(t, l);
      }
  }
  return !0;
}
function _e(e, t) {
  const n = Math.min(1024, Math.max(64, 8 * e.spans)), r = (e.t1 - e.t0) / n, o = [], a = (s) => s === n ? e.t1 : e.t0 + s * r;
  for (let s = 0; s <= n; s++) {
    const i = e.at(a(s));
    o.push(i), H(t, i);
  }
  for (let s = 0; s < 3; s++) for (const i of [1, -1]) {
    let l = 0;
    for (let h = 1; h <= n; h++) i * o[h][s] > i * o[l][s] && (l = h);
    $t((h) => {
      const c = e.at(h);
      return H(t, c), i * c[s];
    }, a(Math.max(0, l - 1)), a(Math.min(n, l + 1)));
  }
}
function $t(e, t, n) {
  const r = (Math.sqrt(5) - 1) / 2, o = 1e-12 * Math.max(1, Math.abs(t), Math.abs(n));
  let a = n - r * (n - t), s = t + r * (n - t), i = e(a), l = e(s);
  for (let f = 0; f < 60 && n - t > o; f++)
    i < l ? (t = a, a = s, i = l, s = t + r * (n - t), l = e(s)) : (n = s, s = a, l = i, a = n - r * (n - t), i = e(a));
}
function St(e) {
  const t = e.degree, n = e.knots, r = e.points.length - 1, o = e.weights, a = e.points.map((c, u) => {
    const p = o ? o[u] : 1;
    return [c.x * p, c.y * p, c.z * p, p];
  }), s = n[t], i = n[r + 1];
  let l = 0;
  for (let c = t; c <= r; c++) n[c + 1] > n[c] && l++;
  const f = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]), h = (c) => {
    c = Math.min(i, Math.max(s, c));
    let u = t;
    for (; u < r && n[u + 1] <= c; ) u++;
    for (let g = 0; g <= t; g++) for (let w = 0; w < 4; w++) f[g][w] = a[g + u - t][w];
    for (let g = 1; g <= t; g++) for (let w = t; w >= g; w--) {
      const y = n[w + u - t], m = n[w + 1 + u - g] - y, x = m > 0 ? (c - y) / m : 0;
      for (let S = 0; S < 4; S++) f[w][S] = (1 - x) * f[w - 1][S] + x * f[w][S];
    }
    const p = f[t];
    return [p[0] / p[3], p[1] / p[3], p[2] / p[3]];
  };
  return { t0: s, t1: i, spans: Math.max(1, l), at: h };
}
function Et(e, t) {
  const n = e.geomType;
  if (n === "plane" || n === "cylinder" || n === "cone" || n === "extrusion") return;
  const r = (o) => ue(t, o) && e.distanceTo(o) <= t.tol;
  if (n === "sphere") return Tt(e, t, r);
  if (!(n === "torus" && Ct(e, t, r)) && !e.isPlanar) {
    try {
      const o = e.nurbs();
      if (o.degrees[0] === 1 || o.degrees[1] === 1 || !Ue(t, o.points.flat())) return;
    } catch {
    }
    Pt(e, t);
  }
}
function Tt(e, t, n) {
  const r = Y(e.axis.origin), o = e.radius;
  for (const a of Se) for (const s of [1, -1]) {
    const i = k(r, [s * o, a]);
    n(i) && H(t, i);
  }
}
function Ct(e, t, n) {
  const r = e.axis, o = Y(r.origin), a = ce(Y(r.direction)), s = e.majorRadius, i = e.radius;
  if (!a) return !1;
  for (const l of Se) {
    const f = ce(k(l, [-Me(l, a), a]));
    if (f && Math.abs(Me(l, a)) < 1 - 1e-12)
      for (const h of [1, -1]) for (const c of [1, -1]) {
        const u = k(o, [h * s, f], [c * i, l]);
        n(u) && H(t, u);
      }
    else zt(o, a, s, i, t, n);
  }
  return !0;
}
function zt(e, t, n, r, o, a) {
  const s = ce(Math.abs(t[0]) < 0.9 ? k([1, 0, 0], [-t[0], t]) : k([0, 1, 0], [-t[1], t])), i = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
  for (const l of [1, -1])
    if (ue(o, k(e, [l * r, t])))
      for (let f = 0; f < 72; f++) {
        const h = 2 * Math.PI * f / 72, c = k(e, [n * Math.cos(h), s], [n * Math.sin(h), i], [l * r, t]);
        if (a(c)) {
          H(o, c);
          break;
        }
      }
}
function Pt(e, t) {
  const r = [];
  for (let o = 0; o <= 24; o++) for (let a = 0; a <= 24; a++) r.push({ u: o / 24, v: a / 24, p: Y(e.positionAt(o / 24, a / 24)) });
  for (let o = 0; o < 3; o++) for (const a of [1, -1]) {
    const i = r.filter((f) => ue(t, f.p)).sort((f, h) => a * h.p[o] - a * f.p[o]).find((f) => e.distanceTo(f.p) <= t.tol);
    if (!i) continue;
    H(t, i.p);
    const l = Nt(e, i, o, a, 1 / 24);
    e.distanceTo(l) <= t.tol && H(t, l);
  }
}
function Nt(e, t, n, r, o) {
  let { u: a, v: s } = t, i = r * t.p[n], l = t.p;
  for (let f = o; f > 1e-9; f /= 2)
    for (let h = !0, c = 0; h && c < 64; c++) {
      h = !1;
      for (const [u, p] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const g = Math.min(1, Math.max(0, a + u * f)), w = Math.min(1, Math.max(0, s + p * f)), y = Y(e.positionAt(g, w));
        r * y[n] > i && (a = g, s = w, i = r * y[n], l = y, h = !0);
      }
    }
  return l;
}
var Ie = 1024, Z = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], B = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], pe = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function qe(e) {
  const n = 1e-9 * Math.max(1, ...e.flatMap((a) => a.map(Math.abs))), r = _t(e, n);
  if (r.length > Ie) throw new T("unsupported", `Hull of ${r.length} distinct vertices exceeds the exact hull budget (${Ie}).`);
  if (r.length < 4) throw new T("invalid-input", "A hull needs at least four non-coplanar points.");
  const o = It(r, n);
  return Rt(r, o, Math.min(n, 1e-9));
}
function _t(e, t) {
  const n = Math.max(t * 4, 1e-300), r = /* @__PURE__ */ new Map(), o = [];
  for (const a of e) {
    const s = a.map((f) => Math.floor(f / n));
    let i = !1;
    for (let f = -1; f <= 1 && !i; f++) for (let h = -1; h <= 1 && !i; h++) for (let c = -1; c <= 1 && !i; c++)
      for (const u of r.get(`${s[0] + f},${s[1] + h},${s[2] + c}`) ?? []) if (Math.hypot(...Z(a, u)) <= t) {
        i = !0;
        break;
      }
    if (i) continue;
    const l = s.join(",");
    (r.get(l) ?? r.set(l, []).get(l)).push(a), o.push(a);
  }
  return o;
}
function Re(e, t, n, r) {
  const o = pe(Z(e[n], e[t]), Z(e[r], e[t])), a = Math.hypot(...o), s = a > 0 ? [o[0] / a, o[1] / a, o[2] / a] : [0, 0, 0], i = [(e[t][0] + e[n][0] + e[r][0]) / 3, (e[t][1] + e[n][1] + e[r][1]) / 3, (e[t][2] + e[n][2] + e[r][2]) / 3];
  return { v: [t, n, r], n: s, d: B(s, i), area: a / 2, alive: !0 };
}
function It(e, t) {
  const n = e.length;
  let r = 0;
  for (let m = 1; m < n; m++) e[m][0] < e[r][0] && (r = m);
  let o = -1, a = -1;
  for (let m = 0; m < n; m++) {
    const x = Math.hypot(...Z(e[m], e[r]));
    x > a && (a = x, o = m);
  }
  let s = -1;
  a = -1;
  const i = Z(e[o], e[r]);
  for (let m = 0; m < n; m++) {
    const x = Math.hypot(...pe(i, Z(e[m], e[r])));
    x > a && (a = x, s = m);
  }
  if (!(a > t * Math.hypot(...i))) throw new T("invalid-input", "The hull is flat (all points collinear).");
  const l = Re(e, r, o, s);
  let f = -1;
  a = -1;
  for (let m = 0; m < n; m++) {
    const x = Math.abs(B(l.n, e[m]) - l.d);
    x > a && (a = x, f = m);
  }
  if (!(a > t)) throw new T("invalid-input", "The hull is flat (all points coplanar).");
  const h = [], c = /* @__PURE__ */ new Map(), u = (m, x, S) => {
    const $ = Re(e, m, x, S), v = h.length;
    return h.push($), c.set(m * n + x, v), c.set(x * n + S, v), c.set(S * n + m, v), v;
  }, p = (m) => {
    const x = h[m];
    x.alive = !1;
    const [S, $, v] = x.v;
    for (const E of [S * n + $, $ * n + v, v * n + S]) c.get(E) === m && c.delete(E);
  };
  B(l.n, e[f]) - l.d > 0 ? (u(r, s, o), u(r, o, f), u(o, s, f), u(s, r, f)) : (u(r, o, s), u(r, f, o), u(o, f, s), u(s, f, r));
  const g = /* @__PURE__ */ new Set([r, o, s, f]), w = e.reduce((m, x) => [m[0] + x[0] / n, m[1] + x[1] / n, m[2] + x[2] / n], [0, 0, 0]), y = [...e.keys()].filter((m) => !g.has(m)).sort((m, x) => Math.hypot(...Z(e[x], w)) - Math.hypot(...Z(e[m], w)));
  for (const m of y) {
    const x = e[m];
    let S = -1, $ = t;
    for (let d = 0; d < h.length; d++) {
      const M = h[d];
      if (!M.alive) continue;
      const b = B(M.n, x) - M.d;
      b > $ && ($ = b, S = d);
    }
    if (S < 0) continue;
    const v = /* @__PURE__ */ new Set([S]), E = [S];
    for (; E.length; ) {
      const d = E.pop(), [M, b, C] = h[d].v;
      for (const [K, U] of [[M, b], [b, C], [C, M]]) {
        const X = c.get(U * n + K);
        X === void 0 || v.has(X) || B(h[X].n, x) - h[X].d > t && (v.add(X), E.push(X));
      }
    }
    const z = [];
    for (const d of v) {
      const [M, b, C] = h[d].v;
      for (const [K, U] of [[M, b], [b, C], [C, M]]) {
        const X = c.get(U * n + K);
        (X === void 0 || !v.has(X)) && z.push([K, U]);
      }
    }
    for (const d of v) p(d);
    for (const [d, M] of z) u(d, M, m);
  }
  return h.filter((m) => m.alive);
}
function Rt(e, t, n) {
  const r = e.length, o = /* @__PURE__ */ new Map();
  t.forEach((u, p) => {
    const [g, w, y] = u.v;
    o.set(g * r + w, p), o.set(w * r + y, p), o.set(y * r + g, p);
  });
  const a = new Array(t.length).fill(-1), s = [], i = [...t.keys()].sort((u, p) => t[p].area - t[u].area);
  for (const u of i) {
    if (a[u] >= 0) continue;
    const { n: p, d: g } = t[u], w = s.length, y = [u];
    a[u] = w;
    for (let x = 0; x < y.length; x++) {
      const [S, $, v] = t[y[x]].v;
      for (const [E, z] of [[S, $], [$, v], [v, S]]) {
        const d = o.get(z * r + E);
        if (d === void 0 || a[d] >= 0) continue;
        const M = t[d];
        B(M.n, p) < 1 - 1e-6 || M.v.some((b) => Math.abs(B(p, e[b]) - g) > n) || (a[d] = w, y.push(d));
      }
    }
    const m = y.length > 1 ? Dt(y.map((x) => t[x].v), r) : t[u].v.slice();
    if (m) s.push(m);
    else {
      a[u] = w, s.push(t[u].v.slice());
      for (const x of y.slice(1))
        a[x] = s.length, s.push(t[x].v.slice());
    }
  }
  const l = /* @__PURE__ */ new Map();
  for (const u of s) for (const p of u) l.set(p, (l.get(p) ?? 0) + 1);
  const f = s.map((u) => {
    const p = u.filter((g) => (l.get(g) ?? 0) > 2);
    return p.length >= 3 ? p : u;
  }), h = [...new Set(f.flat())].sort((u, p) => u - p), c = new Map(h.map((u, p) => [u, p]));
  return { points: h.map((u) => e[u]), faces: f.map((u) => u.map((p) => c.get(p))) };
}
function Dt(e, t) {
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
function Lt(e, t, n = 1e-9) {
  const r = [];
  for (const o of t) {
    const a = Ot(e, o);
    if (o.length === 3 || !a) {
      r.push([...o]);
      continue;
    }
    const s = o.reduce((i, l) => i + B(a, e[l]), 0) / o.length;
    if (o.every((i) => Math.abs(B(a, e[i]) - s) <= n)) {
      r.push([...o]);
      continue;
    }
    r.push(...Bt(e, o, a));
  }
  return r;
}
function Ot(e, t) {
  const n = [0, 0, 0];
  for (let o = 0; o < t.length; o++) {
    const a = e[t[o]], s = e[t[(o + 1) % t.length]];
    n[0] += (a[1] - s[1]) * (a[2] + s[2]), n[1] += (a[2] - s[2]) * (a[0] + s[0]), n[2] += (a[0] - s[0]) * (a[1] + s[1]);
  }
  const r = Math.hypot(...n);
  return r > 0 ? [n[0] / r, n[1] / r, n[2] / r] : null;
}
function Bt(e, t, n) {
  const r = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], o = pe(n, r), a = Math.hypot(...o), s = [o[0] / a, o[1] / a, o[2] / a], i = pe(n, s), l = new Map(t.map((g) => [g, [B(e[g], s), B(e[g], i)]])), f = (g, w, y) => {
    const [m, x] = l.get(g), [S, $] = l.get(w), [v, E] = l.get(y);
    return (S - m) * (E - x) - ($ - x) * (v - m);
  }, h = (g, w, y, m) => f(w, y, g) >= 0 && f(y, m, g) >= 0 && f(m, w, g) >= 0, c = [...t], u = [];
  let p = 0;
  for (; c.length > 3 && p++ < 10 * t.length * t.length; ) {
    let g = !1;
    for (let w = 0; w < c.length; w++) {
      const y = c[(w + c.length - 1) % c.length], m = c[w], x = c[(w + 1) % c.length];
      if (!(f(y, m, x) <= 0) && !c.some((S) => S !== y && S !== m && S !== x && h(S, y, m, x))) {
        u.push([y, m, x]), c.splice(w, 1), g = !0;
        break;
      }
    }
    if (!g) break;
  }
  if (c.length > 3)
    for (let g = 1; g + 1 < c.length; g++) u.push([c[0], c[g], c[g + 1]]);
  else u.push(c);
  return u;
}
function Xt(e, t) {
  const n = Math.max(1, ...e.flatMap((o) => o.map(Math.abs))), r = 1e-9 * n;
  for (const o of t) {
    const a = [0, 0, 0];
    for (let f = 0; f < o.length; f++) {
      const h = e[o[f]], c = e[o[(f + 1) % o.length]];
      a[0] += (h[1] - c[1]) * (h[2] + c[2]), a[1] += (h[2] - c[2]) * (h[0] + c[0]), a[2] += (h[0] - c[0]) * (h[1] + c[1]);
    }
    const s = Math.hypot(...a);
    if (!(s > 0)) return !1;
    const i = [a[0] / s, a[1] / s, a[2] / s], l = B(i, e[o[0]]);
    if (o.some((f) => Math.abs(B(i, e[f]) - l) > r) || e.some((f) => B(i, f) - l > r)) return !1;
  }
  return !0;
}
function Ft(e) {
  const t = e.length;
  if (t < 4) return null;
  let n = 1;
  for (const o of e) n = Math.max(n, Math.abs(o[0]), Math.abs(o[1]));
  const r = jt(e, 1e-9 * n);
  for (let o = 0; o < t; o++) {
    for (let a = o + 2; a < t; a++) {
      const s = o === 0 && a === t - 1 ? null : r.edgesCross(o, a);
      if (s) return { edges: [o, a], at: s };
    }
    for (let a = 0; a < t; a++) if (r.passesThrough(o, a)) return { edges: [o, (a - 1 + t) % t], at: [e[a][0], e[a][1]] };
  }
  return null;
}
function jt(e, t) {
  const n = e.length, r = (i) => e[(i % n + n) % n], o = (i, l, f) => {
    const h = Math.hypot(l[0] - i[0], l[1] - i[1]), c = h <= t ? 0 : ((l[0] - i[0]) * (f[1] - i[1]) - (l[1] - i[1]) * (f[0] - i[0])) / h;
    return Math.abs(c) <= t ? 0 : Math.sign(c);
  }, a = (i, l, f) => {
    const h = Math.hypot(l[0] - i[0], l[1] - i[1]), c = ((f[0] - i[0]) * (l[0] - i[0]) + (f[1] - i[1]) * (l[1] - i[1])) / h;
    return c > t && c < h - t;
  }, s = (i, l, f, h) => {
    for (let c = 1; c < n; c++) {
      const u = o(i, l, r(f + h * c));
      if (u) return u;
    }
    return 0;
  };
  return {
    /** Where edges i and j cross in their interiors, or null. */
    edgesCross(i, l) {
      const f = r(i), h = r(i + 1), c = r(l), u = r(l + 1);
      if (o(f, h, c) * o(f, h, u) >= 0 || o(c, u, f) * o(c, u, h) >= 0) return null;
      const p = (h[0] - f[0]) * (u[1] - c[1]) - (h[1] - f[1]) * (u[0] - c[0]), g = ((c[0] - f[0]) * (u[1] - c[1]) - (c[1] - f[1]) * (u[0] - c[0])) / p;
      return [f[0] + g * (h[0] - f[0]), f[1] + g * (h[1] - f[1])];
    },
    /** Whether vertex k lies inside edge i and the outline passes there from one side to the other. */
    passesThrough(i, l) {
      if (l === i || l === (i + 1) % n) return !1;
      const f = r(i), h = r(i + 1), c = r(l);
      return o(f, h, c) !== 0 || !a(f, h, c) ? !1 : s(f, h, l, -1) * s(f, h, l, 1) < 0;
    }
  };
}
var F = (e) => [e[0], e[1], 0];
function Ht(e, t, n) {
  let r = t;
  const o = [], a = (s, i) => ((!Array.isArray(i) || i.length !== 2) && P(`${s} must be a 2D point.`), _(s, i[0], i[1]), i);
  for (const s of n) {
    const i = s.kind === "spline" ? a("Spline point", s.through.at(-1) ?? P("A spline needs at least one point.")) : a("Path point", s.to);
    s.kind === "line" ? o.push(e.Line(F(r), F(i))) : s.kind === "arc" ? o.push(e.ThreePointArc(F(r), F(a("Arc point", s.via)), F(i))) : s.kind === "radiusArc" ? (_("Arc radius", s.radius), o.push(e.RadiusArc(F(r), F(i), s.radius))) : s.kind === "sagittaArc" ? (_("Arc sagitta", s.sagitta), o.push(e.SagittaArc(F(r), F(i), s.sagitta))) : s.kind === "spline" ? o.push(e.Spline(F(r), ...s.through.map((l) => F(a("Spline point", l))))) : P(`Unknown path segment kind '${s.kind}'.`), r = i;
  }
  return Math.hypot(r[0] - t[0], r[1] - t[1]) > 1e-9 && o.push(e.Line(F(r), F(t))), o;
}
function De(e, t) {
  const n = Ft(t);
  if (!n) return;
  const [r, o] = n.at.map((a) => +a.toPrecision(6));
  P(`The ${e} crosses itself at (${r}, ${o}), so it bounds no region. Reorder its points so no edges cross, or give each region its own contour.`);
}
function Yt(e) {
  const t = [];
  for (const n of e) {
    const r = n.pointAt(0), o = n.pointAt(1), s = Math.abs(n.length - Math.hypot(o.x - r.x, o.y - r.y)) <= 1e-9 * Math.max(1, n.length) ? 1 : 32;
    for (let i = 0; i < s; i++) {
      const l = i ? n.pointAt(i / s) : r;
      t.push([l.x, l.y]);
    }
  }
  return t;
}
function Kt(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && P("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && P("Each polygon contour needs at least three points.");
        for (const r of n) _("Polygon points", r[0], r[1]);
        De("polygon contour", n);
      }
      return A("Polygon", () => {
        const n = t.map((r) => e.Polygon(r.map((o) => [o[0], o[1]]))).sort((r, o) => o.area - r.area);
        return L(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)));
      });
    },
    circle(t) {
      return O("Circle radius", t), A("Circle", () => L(e.Circle(t)));
    },
    rectangle(t, n, r) {
      return O("Rectangle size", t, n), A("Rectangle", () => L(r ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, r) {
      return O("Rounded rectangle size and radius", t, n, r), r >= Math.min(t, n) / 2 && P("The corner radius must be below half the short side."), A("RoundedRectangle", () => L(e.RoundedRectangle(t, n, r)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && P("A path profile needs at least one segment."), _("Path start", ...Array.isArray(t) ? t : [NaN]), A("path", () => {
        const r = Ht(e, t, n);
        return De("path outline", Yt(r)), L(e.makeFace(new e.Wire(r)), new e.Wire(r));
      });
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && P("Text must be a non-empty string."), O("Text size", n);
      try {
        return L(e.Text(t, n));
      } catch (r) {
        if (r instanceof e.FontError) throw new T("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${r.message}`, { cause: r });
        return A("Text", () => {
          throw r;
        });
      }
    },
    union: (t, ...n) => A("fuse (2D)", () => L(n.length ? e.fuse(I(t), ...n.map(I)) : I(t))),
    subtract: (t, ...n) => A("cut (2D)", () => L(n.length ? e.cut(I(t), ...n.map(I)) : I(t))),
    intersect: (t, ...n) => A("intersect (2D)", () => L(n.length ? e.intersect(I(t), ...n.map(I)) : I(t))),
    hull: (...t) => (t.length || P("A hull needs at least one profile."), A("Hull (2D)", () => L(e.Hull(...t.map(I))))),
    translate: (t, [n, r]) => (_("Profile offset", n, r), A("translate (2D)", () => L(I(t).translate([n, r, 0])))),
    rotate: (t, n) => (_("Profile angle", n), A("rotate (2D)", () => L(I(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, r]) => (_("Profile scale", n, r), (n === 0 || r === 0) && P("A zero profile scale flattens the profile."), A("scale (2D)", () => L(I(t).scale([n, r, 1])))),
    offset: (t, n, r) => (_("Profile offset distance", n), A("offset (2D)", () => L(e.offset(I(t), n, { corners: r ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = I(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => A("area (2D)", () => I(t).area)
  };
}
var Vt = 0.01, kt = 10, Ut = "MIT AND Apache-2.0";
async function qt(e) {
  const { init: t } = await import("./chunk-AJV3MJKC-eTtNTT3-.js").then(function(n) {
    return n.c;
  });
  try {
    return await t(e);
  } catch (n) {
    throw new T("invalid-input", `Could not load SMLib: ${n instanceof Error ? n.message : String(n)}`, { cause: n });
  }
}
var Le = (e) => {
  const t = e.tolerance ?? Vt, n = e.angleDeg ?? kt;
  return O("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function Zt({ sm: e, solid: t }) {
  return {
    box(n) {
      return O("Box size", ...n), A("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, r) {
      return O("Cylinder radius and height", n, r), A("Cylinder", () => t("Cylinder", e.Cylinder(n, r)));
    },
    cone(n, r, o) {
      return _("Cone radii", n, r), O("Cone height", o), (n < 0 || r < 0 || !(n > 0 || r > 0)) && P("Cone radii must be non-negative and not both zero."), A("Cone", () => t("Cone", n === r ? e.Cylinder(n, o) : e.Cone(n, r, o)));
    },
    sphere(n) {
      return O("Sphere radius", n), A("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, r) {
      return O("Torus radii", n, r), r >= n && P("The tube radius must be smaller than the major radius."), A("Torus", () => t("Torus", e.Torus(n, r)));
    },
    polyhedron(n, r) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(r) || r.length < 4) && P("A polyhedron needs at least four points and four faces.");
      for (const o of n) _("Polyhedron points", o[0], o[1], o[2]);
      for (const o of r) (!Array.isArray(o) || o.length < 3 || o.some((a) => !Number.isInteger(a) || a < 0 || a >= n.length)) && P("Polyhedron faces must index at least three existing points.");
      return A("stitch (polyhedron)", () => e.scope(() => {
        const o = Lt(n, r).map((s) => {
          const i = s.map((l) => G(n[l]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), a = e.stitch(...o);
        return (!(a instanceof e.Part) || !a.isValid()) && P("The polyhedron faces do not close around a valid solid."), Q(a);
      }));
    }
  };
}
function Gt({ sm: e, solid: t }) {
  return {
    extrude(n, r) {
      return O("Extrusion height", r), A("extrude", () => t("extrude", e.extrude(I(n), r)));
    },
    revolve(n, r) {
      return _("Revolution angle", r), (r === 0 || Math.abs(r) > 360) && P("Revolution angle must be in (0, 360] degrees in magnitude."), A("revolve", () => e.scope(() => {
        const o = I(n).rotate(e.Axis.X, 90), a = e.revolve(o, e.Axis.Z, Math.abs(r));
        return t("revolve", r < 0 ? a.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : a);
      }));
    },
    loft(n, r = {}) {
      (!Array.isArray(n) || n.length < 2) && P("A loft needs at least two sections.");
      for (const o of n) _("Loft section position", ...o.at);
      return A("loft", () => e.scope(() => {
        const a = (n.every((s) => Ne(s.profile)) ? n.map((s) => Ne(s.profile).translate(G(s.at))) : void 0) ?? n.map((s) => I(s.profile).translate(G(s.at)));
        return t("loft", e.loft(a, { ruled: !!r.ruled }));
      }));
    },
    sweep(n, r) {
      (!Array.isArray(r) || r.length < 2) && P("A sweep rail needs at least two points.");
      for (const o of r) _("Sweep rail points", ...o);
      return A("sweep", () => e.scope(() => {
        const o = r.map(G), a = o.length === 2 ? e.Line(o[0], o[1]) : e.Polyline(o);
        return t("sweep", e.sweep(I(n), a));
      }));
    }
  };
}
function Wt({ sm: e, solid: t }) {
  return {
    union: (n, ...r) => A("fuse", () => t("fuse", r.length ? e.fuse(N(n), ...r.map(N)) : N(n))),
    subtract: (n, ...r) => A("cut", () => t("cut", r.length ? e.cut(N(n), ...r.map(N)) : N(n))),
    intersect: (n, ...r) => A("intersect", () => t("intersect", r.length ? e.intersect(N(n), ...r.map(N)) : N(n))),
    splitByPlane: (n, r, o) => {
      const a = he("Split normal", r);
      return _("Split offset", o), A("split", () => {
        const [s, i] = e.split(N(n), new e.Plane([a[0] * o, a[1] * o, a[2] * o], void 0, a), "both");
        return [t("split", s), t("split", i)];
      });
    },
    translate: (n, r) => (_("Translation", ...r), A("translate", () => Q(N(n).translate(G(r))))),
    rotate: (n, r, o, a = [0, 0, 0]) => {
      const s = he("Rotation axis", r);
      return _("Rotation angle and pivot", o, ...a), A("rotate", () => Q(N(n).rotate(new e.Axis(G(a), s), o)));
    },
    mirror: (n, r, o = [0, 0, 0]) => {
      const a = he("Mirror normal", r);
      return _("Mirror origin", ...o), A("mirror", () => Q(N(n).mirror(new e.Plane(G(o), void 0, a))));
    },
    scale: (n, r) => (_("Scale factors", ...r), r.some((o) => o === 0) && P("A zero scale factor flattens the solid."), A("scale", () => Q(N(n).scale(G(r), [0, 0, 0]))))
  };
}
function Qt(e) {
  const { sm: t, solid: n, face: r } = e, o = (s, i) => i === "all" ? s.edges() : r(s, i).edges(), a = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, i, l = "all") => (O("Fillet radius", i), A("fillet", () => n("fillet", t.fillet(o(N(s), l), i)))),
    chamfer: (s, i, l = "all") => (O("Chamfer distance", i), A("chamfer", () => n("chamfer", t.chamfer(o(N(s), l), i)))),
    shell: (s, i, l) => {
      O("Shell thickness", i);
      const f = l === void 0 ? [] : a(l) ? [l] : [...l];
      return A("shell", () => {
        const h = N(s), c = f.map((u) => r(h, u));
        return n("shell", t.shell(h, -i, c.length ? c : null));
      });
    }
  };
}
function Jt({ sm: e }) {
  return {
    volume: (t) => A("volume", () => N(t).volume),
    area: (t) => A("area", () => N(t).area),
    // Not SMLib's bbox(): it misses interior extremes of some rotated spheres (see bbox.ts).
    bbox: (t) => A("bbox", () => Mt(N(t))),
    massProperties: (t) => A("massProperties", () => {
      const n = N(t).massProperties(1), r = n.inertia, o = (l, f) => (r[l][f] + r[f][l]) / 2, a = [[r[0][0], o(0, 1), o(0, 2)], [o(0, 1), r[1][1], o(1, 2)], [o(0, 2), o(1, 2), r[2][2]]], { values: s, vectors: i } = yt(a);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: a, principalMoments: s, principalAxes: i };
    }),
    isValid: (t) => A("isValid", () => N(t).isValid()),
    solidCount: (t) => A("solids", () => e.scope(() => N(t).solids().length)),
    components: (t) => A("solids", () => [...N(t).solids()].map(Q))
  };
}
function en({ sm: e, solid: t }) {
  return {
    tessellate: (n, r = {}) => {
      const { tolerance: o, angle: a } = Le(r);
      return A("mesh", () => e.scope(() => {
        const s = N(n).mesh(o, a), i = Float64Array.from(s.vertices), l = Uint32Array.from(s.triangles);
        return { positions: i, normals: wt(i, l), indices: l };
      }));
    },
    exportStl: (n, r = {}) => {
      const { tolerance: o, angle: a } = Le(r);
      return A("toStl", () => e.toStl(N(n), { tolerance: o, angle: a }));
    },
    exportStep: (n) => A("toStep", () => e.toStep(N(n))),
    importStep: (n) => ((typeof n != "string" || !n.length) && P("STEP input must be non-empty text."), A("fromStep", () => {
      const r = e.fromStep(n);
      if (Array.isArray(r) && r.length && r.every((o) => o instanceof e.Part)) {
        const o = r;
        return t("fromStep", o.length === 1 ? o[0] : e.fuse(o[0], ...o.slice(1)));
      }
      return t("fromStep", r);
    }))
  };
}
async function tn(e = {}) {
  const t = await qt(e);
  t.setWarningHandler(() => {
  });
  const n = vt(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: Ut,
    profile: Kt(t),
    ...Zt(n),
    ...Gt(n),
    ...Wt(n),
    ...Qt(n),
    ...Jt(n),
    ...en(n),
    memory: () => {
      const r = t.memoryUsage();
      return { used: r.used, heap: r.heap, handles: r.handles };
    },
    scope: (r) => t.scope(r)
  };
}
const nn = "@crispcad/exact-kernel", rn = "0.1.4", on = "smlib", sn = Object.freeze({ id: on, package: nn, version: rn }), Oe = 16, Be = 2048, R = (e) => {
  throw new T("unsupported", e);
}, ee = (e) => {
  throw new T("invalid-input", e);
};
function J(e, t) {
  t < Oe && R(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${Oe}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const an = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], be = (e, t) => {
  const n = [];
  for (let r = 0; r < 3; r++)
    for (let o = 0; o < 4; o++)
      n.push(e[r * 4] * t[o] + e[r * 4 + 1] * t[4 + o] + e[r * 4 + 2] * t[8 + o] + (o === 3 ? e[r * 4 + 3] : 0));
  return n;
}, ne = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), Xe = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], ln = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function de(e, t) {
  const n = Math.hypot(...e);
  n > 0 || ee("Rotation axis must be non-zero.");
  const [r, o, a] = e.map((h) => h / n), s = t * Math.PI / 180, i = Math.cos(s), l = Math.sin(s), f = 1 - i;
  return [f * r * r + i, f * r * o - l * a, f * r * a + l * o, 0, f * r * o + l * a, f * o * o + i, f * o * a - l * r, 0, f * r * a - l * o, f * o * a + l * r, f * a * a + i, 0];
}
const cn = (e) => be(de([0, 0, 1], e[2]), be(de([0, 1, 0], e[1]), de([1, 0, 0], e[0])));
function un(e) {
  const t = Math.hypot(...e);
  t > 0 || ee("Mirror normal must be non-zero.");
  const [n, r, o] = e.map((a) => a / t);
  return [1 - 2 * n * n, -2 * n * r, -2 * n * o, 0, -2 * n * r, 1 - 2 * r * r, -2 * r * o, 0, -2 * n * o, -2 * r * o, 1 - 2 * o * o, 0];
}
function fn(e) {
  const [t, n, r, , o, a, s, , i, l, f] = e, h = Math.max(-1, Math.min(1, (t + a + f - 1) / 2)), c = Math.acos(h);
  if (c < 1e-15)
    return null;
  let u = [l - s, r - i, o - n];
  return Math.hypot(...u) < 1e-9 && (u = [[t + 1, o, i], [n, a + 1, l], [r, s, f + 1]].reduce((g, w) => Math.hypot(...w) > Math.hypot(...g) ? w : g)), { axis: u, degrees: c * 180 / Math.PI };
}
function hn(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && ee("Affine matrix is singular.");
  for (const [s, i] of [[0, 1], [0, 2], [1, 2]]) {
    const l = t[s][0] * t[i][0] + t[s][1] * t[i][1] + t[s][2] * t[i][2];
    Math.abs(l) > 1e-9 * n[s] * n[i] && R("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const r = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), o = [n[0], n[1], r < 0 ? -n[2] : n[2]], a = [0, 1, 2].flatMap((s) => [e[s * 4] / o[0], e[s * 4 + 1] / o[1], e[s * 4 + 2] / o[2], 0]);
  return { scale: o, rotation: a, translate: [e[3], e[7], e[11]] };
}
function Ze(e, t, n, r) {
  const o = e.map((s, i) => {
    if (!s)
      return 0;
    const l = r[i] - n[i];
    return l < 1e-12 && ee("Cannot resize a degenerate shape."), s / l;
  }), a = Math.max(...o) || 1;
  return o.map((s, i) => e[i] ? s : t?.[i] ? a : 1);
}
function V(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return J("circle2d", t.segments), e.profile.circle(t.radius);
    case "rectangle":
      return e.profile.rectangle(t.size[0], t.size[1], t.center);
    case "move": {
      const n = V(e, t.profile);
      return n && e.profile.translate(n, t.vector);
    }
    case "rotate": {
      const n = V(e, t.profile);
      return n && e.profile.rotate(n, t.angle);
    }
    case "scale": {
      const n = V(e, t.profile);
      return n && e.profile.scale(n, t.vector);
    }
    case "affine": {
      const n = V(e, t.profile);
      if (!n)
        return null;
      const [r, o, a, s, i, l] = t.matrix, f = Math.hypot(r, s), h = Math.hypot(o, i);
      f > 1e-12 && h > 1e-12 || ee("2D affine matrix is singular."), Math.abs(r * o + s * i) > 1e-9 * f * h && R("2D affine transforms with shear have no exact lowering here.");
      const c = r * i - o * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [f, c < 0 ? -h : h]), Math.atan2(s, r) * 180 / Math.PI), [a, l]);
    }
    case "resize": {
      const n = V(e, t.profile);
      if (!n)
        return null;
      const r = e.profile.bounds(n), o = Ze(t.size, t.auto, r.min, r.max);
      return e.profile.scale(n, [o[0], o[1]]);
    }
    case "offset": {
      t.round && J("offset2d", t.segments);
      const n = V(e, t.profile);
      return n && e.profile.offset(n, t.distance, t.round);
    }
    case "text":
      return R("text2d needs a font outline path, and the exact kernel package ships no font.");
    case "minkowski":
      return R("minkowski2d has no exact lowering (planar Minkowski sums of curved profiles are not exposed by this kernel adapter).");
    case "union":
    case "subtract":
    case "intersect":
    case "hull": {
      const n = t.profiles.map((a) => V(e, a)), r = n.filter((a) => a !== null);
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
      return R(`Profile '${t.kind}' has no exact lowering.`);
  }
}
function re(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, r = e.center ? -t / 2 : 0, o = e.center ? -n / 2 : 0;
      return [[r, o], [r + t, o], [r + t, o + n], [r, o + n]];
    }
    case "move":
      return re(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return re(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), r = Math.sin(t);
      return re(e.profile).map(([o, a]) => [n * o - r * a, r * o + n * a]);
    }
    case "affine": {
      const t = e.matrix;
      return re(e.profile).map(([n, r]) => [t[0] * n + t[1] * r + t[2], t[3] * n + t[4] * r + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(re);
    case "empty":
      return [];
    default:
      return R(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function Ae(e, t, n) {
  const r = (o, a) => Ae(a, be(t, o), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const o of e.shapes)
        Ae(o, t, n);
      return;
    case "move":
      return r(Xe(e.vector), e.shape);
    case "rotate":
      return r(cn(e.vector), e.shape);
    case "scale":
      return r(ln(e.vector), e.shape);
    case "mirror":
      return r(un(e.vector), e.shape);
    case "axisRotate":
      return r(de(e.vector, e.angle), e.shape);
    case "affine":
      return r(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let o = 0; o < e.count; o++)
        r(Xe(e.step.map((a) => a * o)), e.shape);
      return;
    case "box": {
      const [o, a, s] = e.size.map((i) => i / 2);
      for (const i of [-o, o])
        for (const l of [-a, a])
          for (const f of [-s, s])
            n.points.push(ne(t, [i, l, f]));
      return;
    }
    case "polyhedron":
      for (const o of e.points)
        n.points.push(ne(t, o));
      return;
    case "extrude":
      for (const [o, a] of e.points)
        for (const s of [0, e.height])
          n.points.push(ne(t, [o, a, s]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && R("hull of a twisted extrusion has no exact lowering.");
      for (const [o, a] of re(e.profile))
        n.points.push(ne(t, [o, a, 0])), n.points.push(ne(t, [o * e.scaleTop[0], a * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      J("sphere", e.segments);
      const o = [0, 1, 2].map((a) => Math.hypot(t[a], t[4 + a], t[8 + a]));
      Math.max(...o) - Math.min(...o) > 1e-12 * Math.max(...o) && R("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: ne(t, [0, 0, 0]), radius: e.radius * o[0] });
      return;
    }
    default:
      R(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function dn(e, t) {
  const n = { points: [], spheres: [] };
  for (const u of t)
    Ae(u, an, n);
  if (n.points.length && n.spheres.length && R("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const u = qe(n.points);
    return e.polyhedron(u.points, u.faces);
  }
  if (!n.spheres.length)
    return null;
  const r = n.spheres[0].radius;
  n.spheres.some((u) => Math.abs(u.radius - r) > 1e-12 * r) && R("hull of spheres with different radii has no exact lowering.");
  const o = n.spheres.map((u) => u.centre), a = [0, 1, 2].map((u) => Math.min(...o.map((p) => p[u]))), s = [0, 1, 2].map((u) => Math.max(...o.map((p) => p[u]))), i = s.map((u, p) => u - a[p]), l = 1e-9 * Math.max(1, ...i);
  if (i.every((u) => u <= l))
    return e.translate(e.sphere(r), a);
  const f = (u) => [u & 1 ? s[0] : a[0], u & 2 ? s[1] : a[1], u & 4 ? s[2] : a[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((u) => o.some((p) => p.every((g, w) => Math.abs(g - f(u)[w]) <= l))) || i.some((u) => u <= l)) && R("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const c = e.box(i.map((u) => u + 2 * r));
  return e.translate(e.fillet(c, r, "all"), a.map((u, p) => u + i[p] / 2));
}
function Ge(e, t, n) {
  const r = e.profile.bounds(t), o = r.max[0] <= 0;
  r.min[0] < -1e-8 && !o && ee("Revolved profiles must stay on one side of the radial axis.");
  const a = Math.abs(n);
  a > 360 && ee("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(o ? e.profile.scale(t, [-1, 1]) : t, n);
  return o && a !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function pn(e, t, n) {
  const { scale: r, rotation: o, translate: a } = hn(n);
  let s = r.every((l) => Math.abs(l - 1) < 1e-15) ? t : e.scale(t, r);
  const i = fn(o);
  return i && (s = e.rotate(s, i.axis, i.degrees)), a.some((l) => l !== 0) ? e.translate(s, a) : s;
}
function Ee(e, t) {
  const n = (r) => Ee(e, r);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return J("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return J("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return J("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && R("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && R("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const r = V(e, t.profile);
      return r && e.extrude(r, t.height);
    }
    case "revolve": {
      if (J("revolve", t.segments), t.angle === 0)
        return null;
      const r = V(e, t.profile);
      return r && Ge(e, r, t.angle);
    }
    case "polyhedron": {
      if (t.smooth)
        return xn(e, t.smooth);
      if (t.ruled)
        return mn(e, t.ruled, t.points, t.faces);
      if (t.faces.length > Be && R(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${Be} faces).`), Xt(t.points, t.faces)) {
        const r = qe(t.points);
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
      return dn(e, t.shapes);
    case "minkowski":
      return R("minkowski has no exact lowering (a general Minkowski sum is not a B-rep operation of this adapter; use fillet/offset intent instead).");
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
      return r && pn(e, r, t.matrix.slice(0, 12));
    }
    case "resize": {
      const r = n(t.shape);
      if (!r)
        return null;
      const o = e.bbox(r);
      return e.scale(r, Ze(t.vector, t.auto, o.min, o.max));
    }
    case "repeat": {
      const r = t.count >= 1 ? n(t.shape) : null;
      if (!r)
        return null;
      const o = Array.from({ length: t.count }, (a, s) => s === 0 ? r : e.translate(r, t.step.map((i) => i * s)));
      return o.length > 1 ? e.union(o[0], ...o.slice(1)) : o[0];
    }
    default:
      return R(`CAD Script '${t.kind}' has no exact lowering.`);
  }
}
function gn(e, t) {
  let n = 0;
  for (const r of t)
    for (let o = 1; o + 1 < r.length; o++) {
      const a = e[r[0]], s = e[r[o]], i = e[r[o + 1]];
      n += a[0] * (s[1] * i[2] - s[2] * i[1]) - a[1] * (s[0] * i[2] - s[2] * i[0]) + a[2] * (s[0] * i[1] - s[1] * i[0]);
    }
  return n / 6;
}
function mn(e, t, n, r) {
  const o = e.loft(t.map((i) => ({ profile: e.profile.polygon([i.map((l) => [l[0], l[1]])]), at: [0, 0, i[0][2]] })), { ruled: !0 }), a = gn(n, r), s = e.volume(o);
  if (!(Math.abs(s - a) <= 1e-7 * Math.abs(a)))
    throw o.dispose(), new T("kernel-failure", `The ruled loft's volume ${s} differs from its faceted volume ${a}; the kernel did not keep the vertex correspondence.`);
  return o;
}
function xn(e, t) {
  const n = e.loft(t.map((a) => ({ profile: e.profile.polygon([a.map((s) => [s[0], s[1]])]), at: [0, 0, a[0][2]] })), { ruled: !1 }), r = ot(st(t)), o = e.volume(n);
  if (!(Math.abs(o - r) <= 1e-7 * Math.abs(r)))
    throw n.dispose(), new T("kernel-failure", `The smooth loft's volume ${o} differs from the volume ${r} of the surface CAD Script defines; the kernel built another surface.`);
  return n;
}
function Bn(e, t) {
  let n;
  try {
    n = ke(t).shape;
  } catch (o) {
    throw o instanceof rt ? new T("invalid-input", `CAD Script: ${o.message}`, { cause: o }) : o;
  }
  const r = e.scope(() => Ee(e, n));
  if (!r)
    throw new T("invalid-input", "The program produces no solid.");
  if (!(e.volume(r) > 0))
    throw r.dispose(), new T("kernel-failure", "The exact result has no positive volume.");
  return r;
}
const Xn = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} });
class Fe extends T {
  constructor(n, r) {
    super(n.code, n.message, r);
    te(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const ie = (e) => {
  throw new T("unsupported", e);
};
function je(e, t, n) {
  if (!n?.some((o) => o !== 0))
    return Ce([...t]), e.profile.polygon([t]);
  Ce([...t], [...n]);
  const r = t.map((o, a) => {
    const s = t[(a + 1) % t.length], i = n[a] ?? 0;
    return i ? { kind: "arc", via: ht(o, s, i), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], r);
}
const He = (e, t, n) => {
  const r = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(r, [t[0], t[1]]) : r;
};
function Ye(e, t, n) {
  const r = t.profile;
  switch (r.kind) {
    case "rectangle":
      return e.profile.rectangle(W(r.width, n), W(r.depth, n), !0);
    case "circle":
      return He(e, r.center ?? [0, 0], W(r.radius, n));
    case "outline":
      return je(e, r.points, r.bulges);
    case "region": {
      at(r.loops, (s) => W(s, n));
      const o = (s) => s.kind === "circle" ? He(e, [W(s.center[0], n), W(s.center[1], n)], W(s.radius, n)) : je(e, s.points, s.bulges), a = r.loops.map(o).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, i) => i.area - s.area);
      return e.profile.subtract(a[0].profile, ...a.slice(1).map((s) => s.profile));
    }
    case "path":
      return ie("Close the sketch path before creating a solid.");
    default:
      return ie(`Sketch profile '${r.kind}' has no exact lowering.`);
  }
}
function ae(e, t, n) {
  let r = t;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((o, a) => {
    n[a] && (r = e.rotate(r, o, n[a]));
  }), r;
}
function oe(e, t, n, r, o) {
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
        const c = Ee(e, ke(s.program).shape);
        if (!c)
          throw new T("invalid-input", "Code produces no printable solid.");
        i = c;
        break;
      }
      case "extrusion": {
        const { distance: c, start: u, plane: p } = ft(s, t);
        i = e.extrude(Ye(e, t.sketches[s.sketchId], t), c), u && (i = e.translate(i, [0, 0, u])), p === "XZ" ? i = ae(e, i, [90, 0, 0]) : p === "YZ" && (i = ae(e, i, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: c, angle: u, axisOffset: p } = ut(s, t);
        let g = Ye(e, t.sketches[s.sketchId], t);
        p && (g = e.profile.translate(g, [-p, 0])), i = Ge(e, g, u), c === "XY" ? i = ae(e, i, [-90, 0, 0]) : c === "YZ" && (i = ae(e, i, [0, 0, 90])), p && (i = e.translate(i, c === "YZ" ? [0, p, 0] : [p, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: c, offset: u } = ct(s, t), p = [0, 0, 0];
        if (p[c] = 1, i = e.mirror(oe(e, t, s.source, r, o), p), u) {
          const g = [0, 0, 0];
          g[c] = 2 * u, i = e.translate(i, g);
        }
        break;
      }
      case "pattern": {
        const c = lt(s, t), u = oe(e, t, s.source, r, o), p = [u];
        if (c.mode === "linear")
          for (let g = 1; g < c.count; g++) {
            const w = [0, 0, 0];
            w[c.axis] = g * c.spacing, p.push(e.translate(u, w));
          }
        else {
          const g = c.sweep / (Math.abs(c.sweep) === 360 ? c.count : c.count - 1), w = [0, 0, 0];
          w[c.axis] = 1;
          for (let y = 1; y < c.count; y++)
            p.push(e.rotate(u, w, y * g, c.center));
        }
        i = e.union(p[0], ...p.slice(1));
        break;
      }
      case "boolean": {
        const c = s.inputs.map((u) => oe(e, t, u, r, o));
        if (s.useHoleRoles) {
          const u = c.filter((w, y) => t.nodes[s.inputs[y]].role !== "hole"), p = c.filter((w, y) => t.nodes[s.inputs[y]].role === "hole");
          u.length || ie("A combination of holes only has no solid to export.");
          const g = u.length > 1 ? e.union(u[0], ...u.slice(1)) : u[0];
          i = p.length ? e.subtract(g, ...p) : g;
        } else
          i = s.operation === "union" ? e.union(c[0], ...c.slice(1)) : s.operation === "subtract" ? e.subtract(c[0], ...c.slice(1)) : e.intersect(c[0], ...c.slice(1));
        break;
      }
      case "exact-feature": {
        const c = it(s, t), u = oe(e, t, s.source, r, o);
        i = c.operation === "fillet" ? e.fillet(u, c.size, c.edges) : c.operation === "chamfer" ? e.chamfer(u, c.size, c.edges) : e.shell(u, c.size, c.openFaces);
        break;
      }
      case "mesh":
        return ie(s.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return ie(`'${s.kind}' has no exact lowering.`);
    }
    const { scale: l, rotation: f, position: h } = s.transform;
    l.some((c) => c !== 1) && (i = e.scale(i, l)), i = ae(e, i, f), h.some((c) => c !== 0) && (i = e.translate(i, h));
  } catch (l) {
    if (l instanceof Fe)
      throw l;
    const f = l instanceof T ? l.code : "invalid-input", h = l instanceof Error ? l.message : String(l);
    throw new Fe({ code: f, bodyId: r, nodeId: n, feature: s.kind, message: `${s.name} (${s.kind}): ${h}` }, { cause: l });
  }
  return o.set(n, i), i;
}
function yn(e, t, n) {
  if (!t.roots.includes(n))
    throw new T("invalid-input", `${n} is not a top-level body.`);
  return oe(e, t, n, n, /* @__PURE__ */ new Map());
}
function wn(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (!o)
    throw new T("invalid-input", `${n} is not a node of this model.`);
  const a = r.local ? { ...t, nodes: { ...t.nodes, [n]: { ...o, transform: dt() } } } : t, s = t.roots.find((i) => i === n) ?? n;
  return oe(e, a, n, s, /* @__PURE__ */ new Map());
}
const vn = 8, j = (e, t, n) => (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x), le = (e, t) => e.x === t.x && e.y === t.y;
function Mn(e, t) {
  let n = 0;
  for (let r = 0, o = t.length - 1; r < t.length; o = r++)
    n += e[2 * t[o]] * e[2 * t[r] + 1] - e[2 * t[r]] * e[2 * t[o] + 1];
  return n / 2;
}
function Ke(e, t, n) {
  let r, o;
  for (const a of t) {
    const s = { i: a, x: e[2 * a], y: e[2 * a + 1], removed: !1 };
    r ? (o.next = s, s.prev = o) : r = s, o = s, n.push(s);
  }
  return o.next = r, r.prev = o, r;
}
function we(e, t) {
  const n = e.prev, r = e.next;
  return j(n, e, r) >= 0 ? j(e, r, t) > 0 && j(e, t, n) > 0 : !(j(e, n, t) > 0 && j(e, t, r) > 0);
}
function We(e, t, n, r, o) {
  const a = j(e, t, r), s = j(t, n, r), i = j(n, e, r);
  return o ? a > 0 && s > 0 && i > 0 : a >= 0 && s >= 0 && i >= 0;
}
function bn(e, t, n) {
  const r = { ...e }, o = { ...t }, a = e.next, s = t.prev;
  e.next = t, t.prev = e, r.next = a, a.prev = r, o.next = r, r.prev = o, s.next = o, o.prev = s, n.push(r, o);
}
function An(e, t) {
  let n, r = 1 / 0, o = t;
  do {
    const f = o.next;
    if (o.y <= e.y && e.y < f.y || f.y <= e.y && e.y < o.y) {
      const h = o.y === e.y ? o.x : f.y === e.y ? f.x : o.x + (e.y - o.y) * (f.x - o.x) / (f.y - o.y);
      if (h === e.x)
        return;
      h > e.x && h < r && (r = h, n = o.y === e.y ? o : f.y === e.y ? f : o.x > f.x ? o : f);
    }
    o = f;
  } while (o !== t);
  if (!n)
    return;
  const a = { x: r, y: e.y };
  let s = n, i = -1 / 0, l = 1 / 0;
  if (n.x !== r || n.y !== e.y) {
    i = (n.x - e.x) / Math.hypot(n.x - e.x, n.y - e.y), l = Math.hypot(n.x - e.x, n.y - e.y);
    const [f, h, c] = j(e, a, n) > 0 ? [e, a, n] : [e, n, a];
    o = t;
    do {
      if (o !== n && !le(o, n) && We(f, h, c, o, !1) && !(o.x === e.x && o.y === e.y)) {
        const u = Math.hypot(o.x - e.x, o.y - e.y), p = (o.x - e.x) / u;
        (p > i || p === i && u < l) && we(o, e) && (s = o, i = p, l = u);
      }
      o = o.next;
    } while (o !== t);
  }
  if (!we(s, e)) {
    o = t;
    do {
      if (le(o, s) && we(o, e))
        return o;
      o = o.next;
    } while (o !== t);
    return;
  }
  return s;
}
function $n(e, t) {
  if (!t.length || t.some((d) => d.length < 3))
    return null;
  const n = [], r = t.map((d) => Mn(e, d));
  if (!(Math.abs(r[0]) > 0))
    return null;
  const o = t.map((d, M) => M === 0 == r[M] > 0 ? d : [...d].reverse()), a = Ke(e, o[0], n), s = o.slice(1).map((d) => {
    const M = Ke(e, d, n);
    let b = M, C = M.next;
    for (; C !== M; )
      (C.x > b.x || C.x === b.x && C.y > b.y) && (b = C), C = C.next;
    return b;
  });
  s.sort((d, M) => M.x - d.x || M.y - d.y);
  for (const d of s) {
    const M = An(d, a);
    if (!M)
      return null;
    bn(M, d, n);
  }
  let i = 1 / 0, l = 1 / 0, f = -1 / 0, h = -1 / 0;
  for (const d of n)
    d.x < i && (i = d.x), d.y < l && (l = d.y), d.x > f && (f = d.x), d.y > h && (h = d.y);
  const c = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(n.length / 2)))), u = (f - i) / c || 1, p = (h - l) / c || 1, g = (d, M, b) => Math.min(c - 1, Math.max(0, Math.floor((d - M) / b))), w = Array.from({ length: c * c }, () => []);
  for (const d of n)
    w[g(d.y, l, p) * c + g(d.x, i, u)].push(d);
  const y = (d, M) => {
    const b = d.prev, C = d.next, K = j(b, d, C);
    if (M ? K < 0 : K <= 0)
      return !1;
    const U = g(Math.min(b.x, d.x, C.x), i, u), X = g(Math.max(b.x, d.x, C.x), i, u), Je = g(Math.min(b.y, d.y, C.y), l, p), et = g(Math.max(b.y, d.y, C.y), l, p);
    for (let xe = Je; xe <= et; xe++)
      for (let ye = U; ye <= X; ye++)
        for (const q of w[xe * c + ye])
          if (!(q.removed || q === b || q === d || q === C || le(q, b) || le(q, d) || le(q, C)) && We(b, d, C, q, !1))
            return !1;
    return !0;
  }, m = [];
  let x = a, S = x, $ = !1, v = 0;
  {
    let d = a;
    do
      v++, d = d.next;
    while (d !== a);
  }
  for (; v > 3; ) {
    if (y(x, $)) {
      m.push(x.prev.i, x.i, x.next.i), x.removed = !0, x.prev.next = x.next, x.next.prev = x.prev, v--, x = x.next, S = x, $ = !1;
      continue;
    }
    if (x = x.next, x === S) {
      if ($)
        return null;
      $ = !0;
    }
  }
  if (j(x.prev, x, x.next) < 0)
    return null;
  m.push(x.prev.i, x.i, x.next.i);
  const E = r.reduce((d, M, b) => d + (b === 0 ? Math.abs(M) : -Math.abs(M)), 0);
  let z = 0;
  for (let d = 0; d < m.length; d += 3) {
    const M = m[d], b = m[d + 1], C = m[d + 2];
    z += ((e[2 * b] - e[2 * M]) * (e[2 * C + 1] - e[2 * M + 1]) - (e[2 * b + 1] - e[2 * M + 1]) * (e[2 * C] - e[2 * M])) / 2;
  }
  return Math.abs(z - E) <= 1e-9 * Math.abs(r[0]) + 1e-12 ? m : null;
}
const Qe = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
}, me = class me {
  constructor() {
    te(this, "positions", []);
    te(this, "cells", /* @__PURE__ */ new Map());
  }
  add(t, n, r) {
    const o = me.Q, a = Math.round(t / o), s = Math.round(n / o), i = Math.round(r / o);
    let l = this.cells.get(`${a},${s},${i}`);
    if (l !== void 0)
      return l;
    const f = t / o - a, h = n / o - s, c = r / o - i, u = Math.abs(f) > 0.4 ? Math.sign(f) : 0, p = Math.abs(h) > 0.4 ? Math.sign(h) : 0, g = Math.abs(c) > 0.4 ? Math.sign(c) : 0;
    if (u || p || g) {
      for (const w of u ? [0, u] : [0])
        for (const y of p ? [0, p] : [0])
          for (const m of g ? [0, g] : [0])
            if (l = this.cells.get(`${a + w},${s + y},${i + m}`), l !== void 0)
              return this.cells.set(`${a},${s},${i}`, l), l;
    }
    return l = this.positions.length / 3, this.positions.push(t, n, r), this.cells.set(`${a},${s},${i}`, l), l;
  }
};
te(me, "Q", 1e-6);
let $e = me;
function Sn(e) {
  const t = Qe(e);
  if (!t)
    return !1;
  for (const n of t.faces())
    if (n.geomType === "plane" && n.wires().length >= vn)
      return !0;
  return !1;
}
function En(e, t, n) {
  const r = Qe(t);
  if (!r)
    return;
  const o = [...r.faces()], a = new $e(), s = [], i = /* @__PURE__ */ new Map(), l = (u) => {
    const p = new Uint32Array(u.vertices.length / 3);
    for (let y = 0; y < p.length; y++)
      p[y] = a.add(u.vertices[3 * y], u.vertices[3 * y + 1], u.vertices[3 * y + 2]);
    const g = /* @__PURE__ */ new Set(), w = [];
    for (let y = 0; y < u.triangles.length; y += 3) {
      const m = p[u.triangles[y]], x = p[u.triangles[y + 1]], S = p[u.triangles[y + 2]];
      m === x || x === S || S === m || (s.push(m, x, S), g.add(`${m},${x}`), g.add(`${x},${S}`), g.add(`${S},${m}`));
    }
    for (const y of g) {
      const [m, x] = y.split(",").map(Number);
      g.has(`${x},${m}`) || w.push([m, x]);
    }
    return w;
  }, f = [];
  let h = 0;
  for (const u of o) {
    if (u.geomType === "plane") {
      f.push(u);
      continue;
    }
    const p = n.bands !== !1 ? Tn(u, n) : void 0;
    p && h++, i.set(u._identity(), l(p ?? u.mesh(n.tolerance, n.angleDeg)));
  }
  let c = 0;
  for (const u of f) {
    const p = Cn(u, a, i), g = u.normalAt(), w = [g.x, g.y, g.z], y = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], m = Te(se(y, w)), x = se(w, m);
    let S = null;
    if (p && p.length === u.wires().length) {
      const $ = [...new Set(p.flat())], v = new Map($.map((d, M) => [d, M])), E = new Float64Array(2 * $.length);
      $.forEach((d, M) => {
        const b = a.positions;
        E[2 * M] = b[3 * d] * m[0] + b[3 * d + 1] * m[1] + b[3 * d + 2] * m[2], E[2 * M + 1] = b[3 * d] * x[0] + b[3 * d + 1] * x[1] + b[3 * d + 2] * x[2];
      });
      const z = $n(E, p.map((d) => d.map((M) => v.get(M))));
      z && (S = z.map((d) => $[d]));
    }
    S ? s.push(...S) : (c++, l(u.mesh(n.tolerance, n.angleDeg)));
  }
  return { positions: a.positions, indices: s, planar: f.length - c, planarFallbacks: c, bands: h };
}
function Tn(e, t) {
  if (e.geomType !== "cylinder")
    return;
  const n = [...e.edges()];
  if (n.length !== 2)
    return;
  for (const $ of n)
    if ($.geomType !== "circle" || !$.isClosed || ![...$.faces()].every((v) => v.geomType === "plane" || v._identity() === e._identity()))
      return;
  const r = n[0].radius, o = n[0].arcCenter, a = n[1].arcCenter;
  if (!(r > 0) || Math.abs(n[1].radius - r) > 1e-9 * Math.max(1, r) || Math.abs(e.radius - r) > 1e-7 * Math.max(1, r))
    return;
  const s = [a.x - o.x, a.y - o.y, a.z - o.z], i = Math.hypot(s[0], s[1], s[2]);
  if (!(i > 0))
    return;
  const l = s.map(($) => $ / i);
  for (const $ of n) {
    const v = $.normal;
    if (Math.abs(v.x * l[0] + v.y * l[1] + v.z * l[2]) < 1 - 1e-9)
      return;
  }
  const f = Math.acos(Math.max(-1, 1 - t.tolerance / r)), h = Math.max(8, Math.ceil(360 / t.angleDeg), Math.ceil(Math.PI / Math.max(f, 1e-9)));
  if (h > 4096)
    return;
  const c = Math.abs(l[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = Te(se(c, l)), p = se(l, u), g = new Float64Array(6 * h), w = new Uint32Array(6 * h);
  for (let $ = 0; $ < h; $++) {
    const v = 2 * Math.PI * $ / h, E = Math.cos(v), z = Math.sin(v);
    for (let d = 0; d < 3; d++) {
      const M = r * (E * u[d] + z * p[d]);
      g[3 * $ + d] = [o.x, o.y, o.z][d] + M, g[3 * (h + $) + d] = [a.x, a.y, a.z][d] + M;
    }
  }
  const y = [g[0], g[1], g[2]], m = e.normalAt(y), x = [y[0] - o.x, y[1] - o.y, y[2] - o.z], S = m.x * x[0] + m.y * x[1] + m.z * x[2] > 0;
  for (let $ = 0; $ < h; $++) {
    const v = $, E = ($ + 1) % h, z = h + v, d = h + E;
    S ? w.set([v, E, d, v, d, z], 6 * $) : w.set([v, d, E, v, z, d], 6 * $);
  }
  return { vertices: g, triangles: w };
}
const se = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], Te = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return e.map((n) => n / t);
};
function Cn(e, t, n) {
  const r = e._identity(), o = e.normalAt(), a = /* @__PURE__ */ new Set(), s = t.positions;
  let i;
  const l = /* @__PURE__ */ new Set();
  for (const v of e.edges()) {
    const E = [...v.faces()].filter((d) => d._identity() !== r);
    if (E.length !== 1)
      return;
    const z = E[0];
    if (z.geomType === "plane") {
      if (!(v._isStraight ? v._isStraight() : v.geomType === "line"))
        return;
      const d = v.start, M = v.end, b = t.add(d.x, d.y, d.z), C = t.add(M.x, M.y, M.z);
      i ?? (i = o.x * d.x + o.y * d.y + o.z * d.z), b !== C && a.add(b < C ? `${b},${C}` : `${C},${b}`);
    } else if (l.add(z._identity()), i === void 0) {
      const d = v.start;
      i = o.x * d.x + o.y * d.y + o.z * d.z;
    }
  }
  if (i === void 0)
    return;
  const f = 2e-5 + 1e-9 * Math.abs(i), h = (v) => Math.abs(o.x * s[3 * v] + o.y * s[3 * v + 1] + o.z * s[3 * v + 2] - i) <= f;
  for (const v of l) {
    const E = n.get(v);
    if (!E)
      return;
    for (const [z, d] of E)
      h(z) && h(d) && a.add(z < d ? `${z},${d}` : `${d},${z}`);
  }
  const c = /* @__PURE__ */ new Map();
  for (const v of a) {
    const [E, z] = v.split(",").map(Number);
    for (const [d, M] of [[E, z], [z, E]]) {
      const b = c.get(d);
      b ? b.push(M) : c.set(d, [M]);
    }
  }
  for (const v of c.values())
    if (v.length !== 2)
      return;
  const u = [], p = /* @__PURE__ */ new Set();
  for (const v of c.keys()) {
    if (p.has(v))
      continue;
    const E = [v];
    p.add(v);
    let z = v, d = c.get(v)[0];
    for (; d !== v; ) {
      if (p.has(d))
        return;
      E.push(d), p.add(d);
      const [M, b] = c.get(d), C = M === z ? b : M;
      z = d, d = C;
    }
    if (E.length < 3)
      return;
    u.push(E);
  }
  const g = Math.abs(o.x) < 0.9 ? [1, 0, 0] : [0, 1, 0], w = [o.x, o.y, o.z], y = Te(se(g, w)), m = se(w, y), x = (v) => {
    let E = 0;
    for (let z = 0, d = v.length - 1; z < v.length; d = z++) {
      const M = v[d], b = v[z], C = s[3 * M] * y[0] + s[3 * M + 1] * y[1] + s[3 * M + 2] * y[2], K = s[3 * M] * m[0] + s[3 * M + 1] * m[1] + s[3 * M + 2] * m[2], U = s[3 * b] * y[0] + s[3 * b + 1] * y[1] + s[3 * b + 2] * y[2], X = s[3 * b] * m[0] + s[3 * b + 1] * m[1] + s[3 * b + 2] * m[2];
      E += C * X - U * K;
    }
    return Math.abs(E);
  }, S = u.map(x), $ = S.indexOf(Math.max(...S));
  return [u[$], ...u.filter((v, E) => E !== $)];
}
const ve = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function Ve(e, t) {
  const n = [], r = [], o = /* @__PURE__ */ new Map(), a = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < a.length; i++) {
    const l = ve(e.positions[3 * i]), f = ve(e.positions[3 * i + 1]), h = ve(e.positions[3 * i + 2]), c = `${l},${f},${h}`;
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
      throw new T("kernel-failure", D`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > pt || r.length > gt)
    throw new T("unsupported", D`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (r.length < 12)
    throw new T("kernel-failure", D`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: r };
}
function zn(e, t, n) {
  if (Sn(t))
    for (const r of [!0, !1])
      try {
        const o = En(e, t, { ...ze, bands: r });
        if (!o)
          break;
        if (o.bands && o.planarFallbacks)
          continue;
        return Ve(o, n);
      } catch (o) {
        if (o instanceof T && o.code === "unsupported")
          throw o;
      }
  return Ve(e.tessellate(t, ze), n);
}
function Pn(e, t, n) {
  const r = t.nodes[n];
  if (r?.kind !== "exact-feature")
    throw new T("invalid-input", D`${n} is not an exact feature`);
  const o = wn(e, t, n, { local: !0 });
  if (!e.isValid(o))
    throw new T("kernel-failure", D`${r.name}: the exact result is not a valid closed solid.`);
  const a = zn(e, o, r.name);
  return { display: { sourceKey: mt(t, n), ...a }, volume: e.volume(o) };
}
const ge = 64, Nn = 64 * 1024 * 1024;
function _n(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const r of n) {
      if (!e.roots.includes(r))
        throw new T("invalid-input", D`Unknown object id: ${r}`);
      const o = e.nodes[r];
      if (o.reference)
        throw new T("invalid-input", D`${o.name} is a reference body and is never exported or measured.`);
      if (o.role === "hole")
        throw new T("invalid-input", D`${o.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((r) => !e.nodes[r].reference && e.nodes[r].role !== "hole");
  if (!n.length)
    throw new T("invalid-input", D("The design has no solid bodies to export"));
  if (n.length > ge)
    throw new T("invalid-input", D`Exact commands are limited to ${ge} bodies.`);
  return n;
}
function In(e) {
  const t = Object.freeze({ ...sn, smlib: e.version, licence: e.licence }), n = (r, o) => {
    const a = Pe(r), s = _n(a, o);
    return { doc: a, targets: s, solids: s.map((i) => {
      const l = yn(e, a, i);
      if (!e.isValid(l))
        throw new T("kernel-failure", D`${a.nodes[i].name}: the exact result is not a valid closed solid.`);
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
      const a = Pe(r), s = o?.length ? [...new Set(o)] : xt(a);
      if (s.length > ge)
        throw new T("invalid-input", D`Exact commands are limited to ${ge} bodies.`);
      for (const i of s)
        if (a.nodes[i]?.kind !== "exact-feature")
          throw new T("invalid-input", D`${i} is not an exact feature`);
      return { kernel: t, features: s.map((i) => e.scope(() => ({ id: i, name: a.nodes[i].name, ...Pn(e, a, i) }))) };
    },
    exportStep(r, o) {
      return e.scope(() => {
        const { doc: a, targets: s, solids: i } = n(r, o);
        let l = i[0];
        if (i.length > 1) {
          const c = i.reduce((u, p) => u + e.solidCount(p), 0);
          if (l = e.union(i[0], ...i.slice(1)), e.solidCount(l) !== c) {
            for (let u = 0; u < i.length; u++)
              for (let p = u + 1; p < i.length; p++)
                if (e.solidCount(e.union(i[u], i[p])) < e.solidCount(i[u]) + e.solidCount(i[p]))
                  throw new T("unsupported", D`${a.nodes[s[u]].name} and ${a.nodes[s[p]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new T("unsupported", D("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const f = e.exportStep(l), h = new TextEncoder().encode(f).byteLength;
        if (h > Nn)
          throw new T("unsupported", D("The STEP file exceeds 64 MiB."));
        return { kernel: t, bodies: s.map((c) => ({ id: c, name: a.nodes[c].name })), step: f, bytes: h };
      });
    }
  };
}
let fe;
function Rn(e = {}) {
  return fe ?? (fe = tn(e).then(In, (t) => {
    throw fe = void 0, t;
  })), fe;
}
function Dn(e, t, n = 0) {
  const r = performance.now();
  return { ...t.operation === "measure" ? { operation: "measure", ...e.measure(t.document, t.bodies) } : t.operation === "feature-display" ? { operation: "feature-display", ...e.featureDisplays(t.document, t.bodies) } : { operation: "export-step", ...e.exportStep(t.document, t.bodies) }, timing: { loadMs: n, runMs: performance.now() - r, memoryBytes: e.kernel.memory().heap } };
}
function Fn(e = {}) {
  const t = () => new Error(D("Request cancelled"));
  return {
    async run(n, r) {
      if (r?.aborted)
        throw t();
      const o = performance.now(), a = await Rn(e), s = performance.now();
      if (r?.aborted || (await new Promise((l) => setTimeout(l, 0)), r?.aborted))
        throw t();
      const i = Dn(a, n, s - o);
      if (r?.aborted)
        throw t();
      return i;
    }
  };
}
export {
  on as EXACT_KERNEL_ID,
  nn as EXACT_KERNEL_PACKAGE,
  rn as EXACT_KERNEL_VERSION,
  T as ExactKernelError,
  Fe as ExactLoweringError,
  vn as MANY_LOOPS,
  ge as MAX_EXACT_BODIES,
  Be as MAX_POLYHEDRON_FACES,
  Nn as MAX_STEP_BYTES,
  Oe as MIN_EXACT_SEGMENTS,
  Xn as cadScript,
  Rn as createExactBackend,
  In as createExactBackendFromKernel,
  Fn as createInThreadExactHost,
  Ve as displayMesh,
  zn as displayTessellation,
  Bn as evaluateCadScript,
  Pn as exactFeatureDisplay,
  sn as exactKernelIdentity,
  _n as exactTargets,
  En as facewiseMesh,
  Ee as lowerCodeShape,
  yn as lowerDocumentBody,
  wn as lowerDocumentNode,
  Ge as revolveProfile,
  Dn as runExactRequest,
  Ye as sketchProfile,
  $n as triangulatePolygon
};
