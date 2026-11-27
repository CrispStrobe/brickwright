var St = Object.defineProperty;
var Tt = (e, t, n) => t in e ? St(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var le = (e, t, n) => Tt(e, typeof t != "symbol" ? t + "" : t, n);
import { c as ut, C as Ct, s as zt, a as Pt, t as N, e as It, f as re, b as _t, d as Nt, g as Ot, h as Lt, i as Rt, j as Ue, k as Ft, l as Bt, M as Dt, m as kt, E as We, n as jt, v as He, o as Xt } from "../geometry.worker-DDf57Ovz.js";
var T = class extends Error {
  constructor(t, n, r) {
    super(n, r);
    le(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, P = (e) => {
  throw new T("invalid-input", e);
};
function O(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && P(`${e} must be finite numbers (got ${String(n)}).`);
}
function k(e, ...t) {
  O(e, ...t);
  for (const n of t) n > 0 || P(`${e} must be positive (got ${n}).`);
}
function be(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return P(`${e} must be a 3-vector.`);
  O(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || P(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function Ut(e) {
  const t = e.map((r) => [...r]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let r = 0; r < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); r++)
    for (const [a, s] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[a][s]) < 1e-300) continue;
      const i = (t[s][s] - t[a][a]) / (2 * t[a][s]), c = Math.sign(i || 1) / (Math.abs(i) + Math.sqrt(i * i + 1)), f = 1 / Math.sqrt(c * c + 1), d = c * f;
      for (let u = 0; u < 3; u++) {
        const l = t[u][a], h = t[u][s];
        t[u][a] = f * l - d * h, t[u][s] = d * l + f * h;
      }
      for (let u = 0; u < 3; u++) {
        const l = t[a][u], h = t[s][u];
        t[a][u] = f * l - d * h, t[s][u] = d * l + f * h;
      }
      for (let u = 0; u < 3; u++) {
        const l = n[u][a], h = n[u][s];
        n[u][a] = f * l - d * h, n[u][s] = d * l + f * h;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((r) => [n[0][r], n[1][r], n[2][r]]) };
}
function Wt(e, t) {
  const n = new Float64Array(e.length);
  for (let r = 0; r < t.length; r += 3) {
    const o = t[r] * 3, a = t[r + 1] * 3, s = t[r + 2] * 3, i = e[a] - e[o], c = e[a + 1] - e[o + 1], f = e[a + 2] - e[o + 2], d = e[s] - e[o], u = e[s + 1] - e[o + 1], l = e[s + 2] - e[o + 2], h = c * l - f * u, p = f * d - i * l, w = i * u - c * d;
    for (const y of [o, a, s])
      n[y] += h, n[y + 1] += p, n[y + 2] += w;
  }
  for (let r = 0; r < n.length; r += 3) {
    const o = Math.hypot(n[r], n[r + 1], n[r + 2]);
    o > 0 && (n[r] /= o, n[r + 1] /= o, n[r + 2] /= o);
  }
  return n;
}
var ae = (e) => ({ part: e, dispose: () => e.dispose() }), D = (e, t, n) => ({ sketch: e, outline: t, polygon: n, dispose: () => {
  e.dispose(), t?.dispose();
} }), I = (e) => e?.part ?? P("Not a solid of this kernel."), _ = (e) => e?.sketch ?? P("Not a profile of this kernel."), Ee = (e) => e?.outline, qe = (e) => e?.polygon, K = (e) => [e[0], e[1], e[2]];
function S(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof T) throw n;
    const r = n instanceof Error ? n.message : String(n);
    throw new T("kernel-failure", `SMLib ${e} failed: ${r}`, { cause: n });
  }
}
function Ht(e) {
  return { sm: e, solid: (r, o) => {
    if (!(o instanceof e.Part)) throw new T("kernel-failure", `SMLib ${r} did not produce a solid (got ${o?.constructor?.name ?? typeof o}).`);
    return ae(o);
  }, face: (r, o) => {
    const { faceNormal: a, outermost: s } = Array.isArray(o) ? { faceNormal: o, outermost: !1 } : o, i = be("Face normal", a), c = (d) => {
      const u = d.center();
      return u.x * i[0] + u.y * i[1] + u.z * i[2];
    }, f = [...r.faces()].filter((d) => {
      if (!d.isPlanar) return !1;
      const u = d.normalAt();
      return u.x * i[0] + u.y * i[1] + u.z * i[2] > 1 - 1e-9;
    });
    return s && f.length ? f.sort((d, u) => c(u) - c(d))[0] : (f.length !== 1 && P(`Expected exactly one planar face with outward normal [${i.join(", ")}], found ${f.length}.`), f[0]);
  } };
}
var xe = 1e-7, Ke = 0.1, F = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], j = (e, t) => [e[0] + t[0], e[1] + t[1], e[2] + t[2]], B = (e, t) => [e[0] * t, e[1] * t, e[2] * t], L = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], dt = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], $e = (e) => Math.sqrt(L(e, e)), H = (e, t) => $e(F(e, t)), De = (e) => B(e, 1 / $e(e));
function qt(e, t, n, r) {
  const o = F(e, t), a = Math.cos(r), s = Math.sin(r);
  return j(t, j(j(B(o, a), B(dt(n, o), s)), B(n, L(n, o) * (1 - a))));
}
function ht(e) {
  let t = 0, n = [0, 0, 0], r = [0, 0, 0];
  for (let o = 0; o < e.length; o++) {
    const a = e[o], s = e[(o + 1) % e.length], i = H(a, s);
    t += i, n = j(n, B(j(a, s), i / 2)), r = j(r, [(a[1] - s[1]) * (a[2] + s[2]), (a[2] - s[2]) * (a[0] + s[0]), (a[0] - s[0]) * (a[1] + s[1])]);
  }
  return { pos: B(n, 1 / t), axis: De(r) };
}
function Ve(e, t, n) {
  let r = j(e, F(n.pos, t.pos)), o = t.axis, a = n.axis;
  const s = Math.acos(Math.max(-1, Math.min(1, L(o, a))));
  if (s <= 1e-4 || s >= Math.PI - 1e-4) return r;
  const i = F(n.pos, t.pos);
  L(i, o) < -1e-7 && (o = B(o, -1)), L(i, a) < 1e-7 && (a = B(a, -1));
  const c = dt(o, a), f = j(B(a, L(i, o)), B(o, -L(i, a))), d = L(f, o), u = L(f, a), l = d * u > 0 && Math.abs(d) > 1e-4 && Math.abs(u) > 1e-4 ? -1 : 1, h = Math.acos(Math.max(-1, Math.min(1, L(o, a) / ($e(o) * $e(a)))));
  return r = qt(r, n.pos, De(c), h * l), r;
}
function Kt(e, t, n, r) {
  const o = F(t, e), a = F(r, n), s = F(e, n), i = L(o, o), c = L(o, a), f = L(a, a), d = L(o, s), u = L(a, s), l = i * f - c * c;
  if (!(l <= 1e-24 * i * f))
    return { s: (c * u - f * d) / l, t: (i * u - c * d) / l };
}
function Ye(e, t, n) {
  const r = F(n, t);
  return L(F(e, t), r) / L(r, r);
}
function Vt(e, t, n) {
  const r = [1 / 0, 1 / 0, 1 / 0], o = [-1 / 0, -1 / 0, -1 / 0];
  for (const { p: u } of e) for (let l = 0; l < 3; l++)
    r[l] = Math.min(r[l], u[l]), o[l] = Math.max(o[l], u[l]);
  const a = Math.hypot(o[0] - r[0], o[1] - r[1], o[2] - r[2]), s = j(t, B(De(F(n, t)), a)), i = [], c = (u) => u > 0 && u < 1;
  for (const u of e) for (const l of [t, s]) i.push({ vertex: u, p: u.p, d: H(l, u.p) });
  for (let u = 0; u < e.length; u++) {
    const l = e[u].p, h = e[(u + 1) % e.length].p;
    for (const p of [t, s]) {
      const w = Ye(p, l, h);
      if (c(w)) {
        const y = j(l, B(F(h, l), w));
        i.push({ edge: u, t: w, p: y, d: H(p, y) });
      }
    }
  }
  for (const u of e) {
    const l = Ye(u.p, t, s);
    c(l) && i.push({ vertex: u, p: u.p, d: H(u.p, j(t, B(F(s, t), l))) });
  }
  for (let u = 0; u < e.length; u++) {
    const l = e[u].p, h = e[(u + 1) % e.length].p, p = Kt(t, s, l, h);
    if (!p || !c(p.s) || !c(p.t)) continue;
    const w = j(l, B(F(h, l), p.t));
    i.push({ edge: u, t: p.t, p: w, d: H(w, j(t, B(F(s, t), p.s))) });
  }
  if (!i.length) return;
  const f = Math.min(...i.map((u) => u.d));
  let d;
  for (const u of i) u.d <= f + xe && (!d || H(n, u.p) < H(n, d.p)) && (d = u);
  return d;
}
function Ge(e, t, n, r, o) {
  const a = Vt(e, t, n);
  if (!a) return;
  if (a.vertex) return a.vertex;
  const s = a.edge, i = e[s], c = e[(s + 1) % e.length], f = a.t;
  let d;
  if (f < Ke ? d = i : 1 - f < Ke && (d = c), d && !r(d)) return d;
  const u = H(i.p, c.p);
  if (f * u < xe || (1 - f) * u < xe) return d;
  const l = { id: o(), p: a.p };
  return e.splice(s + 1, 0, l), l;
}
function Yt(e, t = "authored") {
  const n = e.length;
  if (n < 2) return e.map((y) => [...y]);
  if (e.every((y) => y.length === e[0].length)) return t === "closest" ? Gt(e) : e.map((y) => [...y]);
  let r = 0;
  const o = () => r++, a = e.map((y) => y.map((g) => ({ id: o(), p: g }))), s = e.map(ht), i = e.reduce((y, g) => y + g.length, 0), c = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Set();
  for (let y = n - 1; y > 0; y--) {
    const g = [...a[y]];
    if (g.length > i) return;
    for (const x of g) {
      const b = Ve(x.p, s[y], s[y - 1]);
      if (H(b, s[y - 1].pos) <= xe) continue;
      const A = Ge(a[y - 1], s[y - 1].pos, b, (v) => f.has(v.id), o);
      if (!A) return;
      c.set(x.id, A.id), f.add(A.id);
    }
  }
  const d = /* @__PURE__ */ new Map();
  for (const [y, g] of c) d.has(g) || d.set(g, y);
  const u = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map();
  for (const y of a[0]) {
    const g = [y.id];
    l.set(y.id, y.id);
    let x = y.id;
    for (; g.length < n && d.has(x) && (x = d.get(x), x !== y.id); )
      g.push(x), l.set(x, y.id);
    u.set(y.id, g);
  }
  const h = a[0].length;
  for (let y = 0; y < n - 1; y++) {
    const g = [...a[y]];
    if (g.length > i || g.length > h) return;
    for (const x of g) {
      const b = l.get(x.id);
      if (b === void 0) return;
      const A = u.get(b), v = new Set(a[y + 1].map((m) => m.id));
      if (A.some((m) => v.has(m))) continue;
      const $ = Ve(x.p, s[y], s[y + 1]);
      if (H($, s[y + 1].pos) <= xe) continue;
      const C = Ge(a[y + 1], s[y + 1].pos, $, (m) => l.has(m.id), o);
      if (!C) return;
      A.push(C.id), l.set(C.id, b);
    }
  }
  const p = a[0], w = [p.map((y) => y.p)];
  for (let y = 1; y < n; y++) {
    const g = a[y];
    if (g.length !== p.length) return;
    const x = u.get(p[0].id)?.[y], b = u.get(p[1].id)?.[y], A = g.findIndex((m) => m.id === x), v = g.findIndex((m) => m.id === b);
    if (A < 0 || v < 0) return;
    const $ = g.length, C = (A + 1) % $ === v ? 1 : (v + 1) % $ === A ? -1 : 0;
    if (!C) return;
    w.push(Array.from({ length: $ }, (m, M) => g[((A + C * M) % $ + $) % $].p));
  }
  return w;
}
function Gt(e) {
  return mt(e).map((t, n) => pt(e[n], t));
}
var pt = (e, { start: t, forward: n }) => Array.from({ length: e.length }, (r, o) => e[n ? (t + o) % e.length : ((t - o) % e.length + e.length) % e.length]);
function mt(e, t = e.map(ht)) {
  const n = t[0], r = [{ start: 0, forward: !0 }];
  let o = e[0], a = n.pos;
  for (let s = 1; s < e.length; s++) {
    const i = e[s], c = i.length;
    let f = t[s].pos;
    const d = F(f, a);
    f = F(f, B(n.axis, L(d, n.axis)));
    const u = F(a, f);
    let l = 1 / 0, h = 0, p = !0;
    const w = (g) => {
      let x = 0;
      for (let b = 0; b < c; b++) x += H(o[b], j(i[g(b)], u));
      return x;
    };
    for (let g = 0; g < c; g++) {
      const x = w((A) => (g + A) % c);
      x < l && (l = x, h = g, p = !0);
      const b = w((A) => ((g - A) % c + c) % c);
      b < l && (l = b, h = g, p = !1);
    }
    const y = { start: h, forward: p };
    r.push(y), o = pt(i, y), a = f;
  }
  return r;
}
var ke = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], Oe = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Y = (e) => [e.x, e.y, e.z], we = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return t > 1e-15 ? [e[0] / t, e[1] / t, e[2] / t] : null;
}, J = (e, ...t) => {
  const n = [e[0], e[1], e[2]];
  for (const [r, o] of t)
    n[0] += r * o[0], n[1] += r * o[1], n[2] += r * o[2];
  return n;
};
function Zt(e) {
  const t = e.bbox(), n = Math.max(1, t.diagonal), r = 1e-7 * n, o = { min: [1 / 0, 1 / 0, 1 / 0], max: [-1 / 0, -1 / 0, -1 / 0], tol: r };
  for (const a of e.vertices()) V(o, [a.x, a.y, a.z]);
  for (const a of e.edges({ seams: !0 })) Qt(a, o);
  for (const a of e.faces()) nn(a, o);
  return Number.isFinite(o.min[0]) ? { min: o.min, max: o.max } : { min: [t.min.x, t.min.y, t.min.z], max: [t.max.x, t.max.y, t.max.z] };
}
function V(e, t) {
  for (let n = 0; n < 3; n++)
    t[n] < e.min[n] && (e.min[n] = t[n]), t[n] > e.max[n] && (e.max[n] = t[n]);
}
var ve = (e, t) => t.some((n, r) => n < e.min[r] - e.tol || n > e.max[r] + e.tol), gt = (e, t) => t.some((n) => ve(e, [n.x, n.y, n.z]));
function Qt(e, t) {
  V(t, Y(e.start)), V(t, Y(e.end));
  const n = e.geomType;
  if (n === "line" || n === "circle" && Jt(e, t)) return;
  let r = null;
  try {
    if (r = e.nurbs(), !gt(t, r.points)) return;
  } catch {
  }
  Ze(n === "bspline" && r ? tn(r) : { t0: 0, t1: 1, spans: 1, at: (o) => Y(e.pointAt(o)) }, t);
}
function Jt(e, t) {
  const n = Y(e.arcCenter), r = we(Y(e.normal)), o = e.radius;
  if (!r) return !1;
  for (const a of ke) {
    const s = we(J(a, [-Oe(a, r), r]));
    if (s)
      for (const i of [1, -1]) {
        const c = J(n, [i * o, s]);
        ve(t, c) && (e.isClosed || e.distanceTo(c) <= t.tol) && V(t, c);
      }
  }
  return !0;
}
function Ze(e, t) {
  const n = Math.min(1024, Math.max(64, 8 * e.spans)), r = (e.t1 - e.t0) / n, o = [], a = (s) => s === n ? e.t1 : e.t0 + s * r;
  for (let s = 0; s <= n; s++) {
    const i = e.at(a(s));
    o.push(i), V(t, i);
  }
  for (let s = 0; s < 3; s++) for (const i of [1, -1]) {
    let c = 0;
    for (let d = 1; d <= n; d++) i * o[d][s] > i * o[c][s] && (c = d);
    en((d) => {
      const u = e.at(d);
      return V(t, u), i * u[s];
    }, a(Math.max(0, c - 1)), a(Math.min(n, c + 1)));
  }
}
function en(e, t, n) {
  const r = (Math.sqrt(5) - 1) / 2, o = 1e-12 * Math.max(1, Math.abs(t), Math.abs(n));
  let a = n - r * (n - t), s = t + r * (n - t), i = e(a), c = e(s);
  for (let f = 0; f < 60 && n - t > o; f++)
    i < c ? (t = a, a = s, i = c, s = t + r * (n - t), c = e(s)) : (n = s, s = a, c = i, a = n - r * (n - t), i = e(a));
}
function tn(e) {
  const t = e.degree, n = e.knots, r = e.points.length - 1, o = e.weights, a = e.points.map((u, l) => {
    const h = o ? o[l] : 1;
    return [u.x * h, u.y * h, u.z * h, h];
  }), s = n[t], i = n[r + 1];
  let c = 0;
  for (let u = t; u <= r; u++) n[u + 1] > n[u] && c++;
  const f = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]), d = (u) => {
    u = Math.min(i, Math.max(s, u));
    let l = t;
    for (; l < r && n[l + 1] <= u; ) l++;
    for (let p = 0; p <= t; p++) for (let w = 0; w < 4; w++) f[p][w] = a[p + l - t][w];
    for (let p = 1; p <= t; p++) for (let w = t; w >= p; w--) {
      const y = n[w + l - t], g = n[w + 1 + l - p] - y, x = g > 0 ? (u - y) / g : 0;
      for (let b = 0; b < 4; b++) f[w][b] = (1 - x) * f[w - 1][b] + x * f[w][b];
    }
    const h = f[t];
    return [h[0] / h[3], h[1] / h[3], h[2] / h[3]];
  };
  return { t0: s, t1: i, spans: Math.max(1, c), at: d };
}
function nn(e, t) {
  const n = e.geomType;
  if (n === "plane" || n === "cylinder" || n === "cone" || n === "extrusion") return;
  const r = (o) => ve(t, o) && e.distanceTo(o) <= t.tol;
  if (n === "sphere") return rn(e, t, r);
  if (!(n === "torus" && on(e, t, r)) && !e.isPlanar) {
    try {
      const o = e.nurbs();
      if (o.degrees[0] === 1 || o.degrees[1] === 1 || !gt(t, o.points.flat())) return;
    } catch {
    }
    an(e, t);
  }
}
function rn(e, t, n) {
  const r = Y(e.axis.origin), o = e.radius;
  for (const a of ke) for (const s of [1, -1]) {
    const i = J(r, [s * o, a]);
    n(i) && V(t, i);
  }
}
function on(e, t, n) {
  const r = e.axis, o = Y(r.origin), a = we(Y(r.direction)), s = e.majorRadius, i = e.radius;
  if (!a) return !1;
  for (const c of ke) {
    const f = we(J(c, [-Oe(c, a), a]));
    if (f && Math.abs(Oe(c, a)) < 1 - 1e-12)
      for (const d of [1, -1]) for (const u of [1, -1]) {
        const l = J(o, [d * s, f], [u * i, c]);
        n(l) && V(t, l);
      }
    else sn(o, a, s, i, t, n);
  }
  return !0;
}
function sn(e, t, n, r, o, a) {
  const s = we(Math.abs(t[0]) < 0.9 ? J([1, 0, 0], [-t[0], t]) : J([0, 1, 0], [-t[1], t])), i = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
  for (const c of [1, -1])
    if (ve(o, J(e, [c * r, t])))
      for (let f = 0; f < 72; f++) {
        const d = 2 * Math.PI * f / 72, u = J(e, [n * Math.cos(d), s], [n * Math.sin(d), i], [c * r, t]);
        if (a(u)) {
          V(o, u);
          break;
        }
      }
}
function an(e, t) {
  const r = [];
  for (let o = 0; o <= 24; o++) for (let a = 0; a <= 24; a++) r.push({ u: o / 24, v: a / 24, p: Y(e.positionAt(o / 24, a / 24)) });
  for (let o = 0; o < 3; o++) for (const a of [1, -1]) {
    const i = r.filter((f) => ve(t, f.p)).sort((f, d) => a * d.p[o] - a * f.p[o]).find((f) => e.distanceTo(f.p) <= t.tol);
    if (!i) continue;
    V(t, i.p);
    const c = cn(e, i, o, a, 1 / 24);
    e.distanceTo(c) <= t.tol && V(t, c);
  }
}
function cn(e, t, n, r, o) {
  let { u: a, v: s } = t, i = r * t.p[n], c = t.p;
  for (let f = o; f > 1e-9; f /= 2)
    for (let d = !0, u = 0; d && u < 64; u++) {
      d = !1;
      for (const [l, h] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const p = Math.min(1, Math.max(0, a + l * f)), w = Math.min(1, Math.max(0, s + h * f)), y = Y(e.positionAt(p, w));
        r * y[n] > i && (a = p, s = w, i = r * y[n], c = y, d = !0);
      }
    }
  return c;
}
var Qe = 1024, ne = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], X = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Se = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function yt(e) {
  const n = 1e-9 * Math.max(1, ...e.flatMap((a) => a.map(Math.abs))), r = ln(e, n);
  if (r.length > Qe) throw new T("unsupported", `Hull of ${r.length} distinct vertices exceeds the exact hull budget (${Qe}).`);
  if (r.length < 4) throw new T("invalid-input", "A hull needs at least four non-coplanar points.");
  const o = fn(r, n);
  return un(r, o, Math.min(n, 1e-9));
}
function ln(e, t) {
  const n = Math.max(t * 4, 1e-300), r = /* @__PURE__ */ new Map(), o = [];
  for (const a of e) {
    const s = a.map((f) => Math.floor(f / n));
    let i = !1;
    for (let f = -1; f <= 1 && !i; f++) for (let d = -1; d <= 1 && !i; d++) for (let u = -1; u <= 1 && !i; u++)
      for (const l of r.get(`${s[0] + f},${s[1] + d},${s[2] + u}`) ?? []) if (Math.hypot(...ne(a, l)) <= t) {
        i = !0;
        break;
      }
    if (i) continue;
    const c = s.join(",");
    (r.get(c) ?? r.set(c, []).get(c)).push(a), o.push(a);
  }
  return o;
}
function Je(e, t, n, r) {
  const o = Se(ne(e[n], e[t]), ne(e[r], e[t])), a = Math.hypot(...o), s = a > 0 ? [o[0] / a, o[1] / a, o[2] / a] : [0, 0, 0], i = [(e[t][0] + e[n][0] + e[r][0]) / 3, (e[t][1] + e[n][1] + e[r][1]) / 3, (e[t][2] + e[n][2] + e[r][2]) / 3];
  return { v: [t, n, r], n: s, d: X(s, i), area: a / 2, alive: !0 };
}
function fn(e, t) {
  const n = e.length;
  let r = 0;
  for (let g = 1; g < n; g++) e[g][0] < e[r][0] && (r = g);
  let o = -1, a = -1;
  for (let g = 0; g < n; g++) {
    const x = Math.hypot(...ne(e[g], e[r]));
    x > a && (a = x, o = g);
  }
  let s = -1;
  a = -1;
  const i = ne(e[o], e[r]);
  for (let g = 0; g < n; g++) {
    const x = Math.hypot(...Se(i, ne(e[g], e[r])));
    x > a && (a = x, s = g);
  }
  if (!(a > t * Math.hypot(...i))) throw new T("invalid-input", "The hull is flat (all points collinear).");
  const c = Je(e, r, o, s);
  let f = -1;
  a = -1;
  for (let g = 0; g < n; g++) {
    const x = Math.abs(X(c.n, e[g]) - c.d);
    x > a && (a = x, f = g);
  }
  if (!(a > t)) throw new T("invalid-input", "The hull is flat (all points coplanar).");
  const d = [], u = /* @__PURE__ */ new Map(), l = (g, x, b) => {
    const A = Je(e, g, x, b), v = d.length;
    return d.push(A), u.set(g * n + x, v), u.set(x * n + b, v), u.set(b * n + g, v), v;
  }, h = (g) => {
    const x = d[g];
    x.alive = !1;
    const [b, A, v] = x.v;
    for (const $ of [b * n + A, A * n + v, v * n + b]) u.get($) === g && u.delete($);
  };
  X(c.n, e[f]) - c.d > 0 ? (l(r, s, o), l(r, o, f), l(o, s, f), l(s, r, f)) : (l(r, o, s), l(r, f, o), l(o, f, s), l(s, f, r));
  const p = /* @__PURE__ */ new Set([r, o, s, f]), w = e.reduce((g, x) => [g[0] + x[0] / n, g[1] + x[1] / n, g[2] + x[2] / n], [0, 0, 0]), y = [...e.keys()].filter((g) => !p.has(g)).sort((g, x) => Math.hypot(...ne(e[x], w)) - Math.hypot(...ne(e[g], w)));
  for (const g of y) {
    const x = e[g];
    let b = -1, A = t;
    for (let m = 0; m < d.length; m++) {
      const M = d[m];
      if (!M.alive) continue;
      const E = X(M.n, x) - M.d;
      E > A && (A = E, b = m);
    }
    if (b < 0) continue;
    const v = /* @__PURE__ */ new Set([b]), $ = [b];
    for (; $.length; ) {
      const m = $.pop(), [M, E, z] = d[m].v;
      for (const [G, ee] of [[M, E], [E, z], [z, M]]) {
        const U = u.get(ee * n + G);
        U === void 0 || v.has(U) || X(d[U].n, x) - d[U].d > t && (v.add(U), $.push(U));
      }
    }
    const C = [];
    for (const m of v) {
      const [M, E, z] = d[m].v;
      for (const [G, ee] of [[M, E], [E, z], [z, M]]) {
        const U = u.get(ee * n + G);
        (U === void 0 || !v.has(U)) && C.push([G, ee]);
      }
    }
    for (const m of v) h(m);
    for (const [m, M] of C) l(m, M, g);
  }
  return d.filter((g) => g.alive);
}
function un(e, t, n) {
  const r = e.length, o = /* @__PURE__ */ new Map();
  t.forEach((l, h) => {
    const [p, w, y] = l.v;
    o.set(p * r + w, h), o.set(w * r + y, h), o.set(y * r + p, h);
  });
  const a = new Array(t.length).fill(-1), s = [], i = [...t.keys()].sort((l, h) => t[h].area - t[l].area);
  for (const l of i) {
    if (a[l] >= 0) continue;
    const { n: h, d: p } = t[l], w = s.length, y = [l];
    a[l] = w;
    for (let x = 0; x < y.length; x++) {
      const [b, A, v] = t[y[x]].v;
      for (const [$, C] of [[b, A], [A, v], [v, b]]) {
        const m = o.get(C * r + $);
        if (m === void 0 || a[m] >= 0) continue;
        const M = t[m];
        X(M.n, h) < 1 - 1e-6 || M.v.some((E) => Math.abs(X(h, e[E]) - p) > n) || (a[m] = w, y.push(m));
      }
    }
    const g = y.length > 1 ? dn(y.map((x) => t[x].v), r) : t[l].v.slice();
    if (g) s.push(g);
    else {
      a[l] = w, s.push(t[l].v.slice());
      for (const x of y.slice(1))
        a[x] = s.length, s.push(t[x].v.slice());
    }
  }
  const c = /* @__PURE__ */ new Map();
  for (const l of s) for (const h of l) c.set(h, (c.get(h) ?? 0) + 1);
  const f = s.map((l) => {
    const h = l.filter((p) => (c.get(p) ?? 0) > 2);
    return h.length >= 3 ? h : l;
  }), d = [...new Set(f.flat())].sort((l, h) => l - h), u = new Map(d.map((l, h) => [l, h]));
  return { points: d.map((l) => e[l]), faces: f.map((l) => l.map((h) => u.get(h))) };
}
function dn(e, t) {
  const n = /* @__PURE__ */ new Set();
  for (const [s, i, c] of e) for (const [f, d] of [[s, i], [i, c], [c, s]]) n.add(f * t + d);
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
function hn(e, t, n = 1e-9) {
  const r = [];
  for (const o of t) {
    const a = pn(e, o);
    if (o.length === 3 || !a) {
      r.push([...o]);
      continue;
    }
    const s = o.reduce((i, c) => i + X(a, e[c]), 0) / o.length;
    if (o.every((i) => Math.abs(X(a, e[i]) - s) <= n)) {
      r.push([...o]);
      continue;
    }
    r.push(...mn(e, o, a));
  }
  return r;
}
function pn(e, t) {
  const n = [0, 0, 0];
  for (let o = 0; o < t.length; o++) {
    const a = e[t[o]], s = e[t[(o + 1) % t.length]];
    n[0] += (a[1] - s[1]) * (a[2] + s[2]), n[1] += (a[2] - s[2]) * (a[0] + s[0]), n[2] += (a[0] - s[0]) * (a[1] + s[1]);
  }
  const r = Math.hypot(...n);
  return r > 0 ? [n[0] / r, n[1] / r, n[2] / r] : null;
}
function mn(e, t, n) {
  const r = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], o = Se(n, r), a = Math.hypot(...o), s = [o[0] / a, o[1] / a, o[2] / a], i = Se(n, s), c = new Map(t.map((p) => [p, [X(e[p], s), X(e[p], i)]])), f = (p, w, y) => {
    const [g, x] = c.get(p), [b, A] = c.get(w), [v, $] = c.get(y);
    return (b - g) * ($ - x) - (A - x) * (v - g);
  }, d = (p, w, y, g) => f(w, y, p) >= 0 && f(y, g, p) >= 0 && f(g, w, p) >= 0, u = [...t], l = [];
  let h = 0;
  for (; u.length > 3 && h++ < 10 * t.length * t.length; ) {
    let p = !1;
    for (let w = 0; w < u.length; w++) {
      const y = u[(w + u.length - 1) % u.length], g = u[w], x = u[(w + 1) % u.length];
      if (!(f(y, g, x) <= 0) && !u.some((b) => b !== y && b !== g && b !== x && d(b, y, g, x))) {
        l.push([y, g, x]), u.splice(w, 1), p = !0;
        break;
      }
    }
    if (!p) break;
  }
  if (u.length > 3)
    for (let p = 1; p + 1 < u.length; p++) l.push([u[0], u[p], u[p + 1]]);
  else l.push(u);
  return l;
}
function gn(e, t) {
  const n = Math.max(1, ...e.flatMap((o) => o.map(Math.abs))), r = 1e-9 * n;
  for (const o of t) {
    const a = [0, 0, 0];
    for (let f = 0; f < o.length; f++) {
      const d = e[o[f]], u = e[o[(f + 1) % o.length]];
      a[0] += (d[1] - u[1]) * (d[2] + u[2]), a[1] += (d[2] - u[2]) * (d[0] + u[0]), a[2] += (d[0] - u[0]) * (d[1] + u[1]);
    }
    const s = Math.hypot(...a);
    if (!(s > 0)) return !1;
    const i = [a[0] / s, a[1] / s, a[2] / s], c = X(i, e[o[0]]);
    if (o.some((f) => Math.abs(X(i, e[f]) - c) > r) || e.some((f) => X(i, f) - c > r)) return !1;
  }
  return !0;
}
function yn(e) {
  const t = e.length;
  if (t < 4) return null;
  let n = 1;
  for (const o of e) n = Math.max(n, Math.abs(o[0]), Math.abs(o[1]));
  const r = xn(e, 1e-9 * n);
  for (let o = 0; o < t; o++) {
    for (let a = o + 2; a < t; a++) {
      const s = o === 0 && a === t - 1 ? null : r.edgesCross(o, a);
      if (s) return { edges: [o, a], at: s };
    }
    for (let a = 0; a < t; a++) if (r.passesThrough(o, a)) return { edges: [o, (a - 1 + t) % t], at: [e[a][0], e[a][1]] };
  }
  return null;
}
function xn(e, t) {
  const n = e.length, r = (i) => e[(i % n + n) % n], o = (i, c, f) => {
    const d = Math.hypot(c[0] - i[0], c[1] - i[1]), u = d <= t ? 0 : ((c[0] - i[0]) * (f[1] - i[1]) - (c[1] - i[1]) * (f[0] - i[0])) / d;
    return Math.abs(u) <= t ? 0 : Math.sign(u);
  }, a = (i, c, f) => {
    const d = Math.hypot(c[0] - i[0], c[1] - i[1]), u = ((f[0] - i[0]) * (c[0] - i[0]) + (f[1] - i[1]) * (c[1] - i[1])) / d;
    return u > t && u < d - t;
  }, s = (i, c, f, d) => {
    for (let u = 1; u < n; u++) {
      const l = o(i, c, r(f + d * u));
      if (l) return l;
    }
    return 0;
  };
  return {
    /** Where edges i and j cross in their interiors, or null. */
    edgesCross(i, c) {
      const f = r(i), d = r(i + 1), u = r(c), l = r(c + 1);
      if (o(f, d, u) * o(f, d, l) >= 0 || o(u, l, f) * o(u, l, d) >= 0) return null;
      const h = (d[0] - f[0]) * (l[1] - u[1]) - (d[1] - f[1]) * (l[0] - u[0]), p = ((u[0] - f[0]) * (l[1] - u[1]) - (u[1] - f[1]) * (l[0] - u[0])) / h;
      return [f[0] + p * (d[0] - f[0]), f[1] + p * (d[1] - f[1])];
    },
    /** Whether vertex k lies inside edge i and the outline passes there from one side to the other. */
    passesThrough(i, c) {
      if (c === i || c === (i + 1) % n) return !1;
      const f = r(i), d = r(i + 1), u = r(c);
      return o(f, d, u) !== 0 || !a(f, d, u) ? !1 : s(f, d, c, -1) * s(f, d, c, 1) < 0;
    }
  };
}
var W = (e) => [e[0], e[1], 0];
function wn(e, t, n) {
  let r = t;
  const o = [], a = (s, i) => ((!Array.isArray(i) || i.length !== 2) && P(`${s} must be a 2D point.`), O(s, i[0], i[1]), i);
  for (const s of n) {
    const i = s.kind === "spline" ? a("Spline point", s.through.at(-1) ?? P("A spline needs at least one point.")) : a("Path point", s.to);
    s.kind === "line" ? o.push(e.Line(W(r), W(i))) : s.kind === "arc" ? o.push(e.ThreePointArc(W(r), W(a("Arc point", s.via)), W(i))) : s.kind === "radiusArc" ? (O("Arc radius", s.radius), o.push(e.RadiusArc(W(r), W(i), s.radius))) : s.kind === "sagittaArc" ? (O("Arc sagitta", s.sagitta), o.push(e.SagittaArc(W(r), W(i), s.sagitta))) : s.kind === "spline" ? o.push(e.Spline(W(r), ...s.through.map((c) => W(a("Spline point", c))))) : P(`Unknown path segment kind '${s.kind}'.`), r = i;
  }
  return Math.hypot(r[0] - t[0], r[1] - t[1]) > 1e-9 && o.push(e.Line(W(r), W(t))), o;
}
function et(e, t) {
  const n = yn(t);
  if (!n) return;
  const [r, o] = n.at.map((a) => +a.toPrecision(6));
  P(`The ${e} crosses itself at (${r}, ${o}), so it bounds no region. Reorder its points so no edges cross, or give each region its own contour.`);
}
function vn(e) {
  const t = [];
  for (const n of e) {
    const r = n.pointAt(0), o = n.pointAt(1), s = Math.abs(n.length - Math.hypot(o.x - r.x, o.y - r.y)) <= 1e-9 * Math.max(1, n.length) ? 1 : 32;
    for (let i = 0; i < s; i++) {
      const c = i ? n.pointAt(i / s) : r;
      t.push([c.x, c.y]);
    }
  }
  return t;
}
function Mn(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && P("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && P("Each polygon contour needs at least three points.");
        for (const r of n) O("Polygon points", r[0], r[1]);
        et("polygon contour", n);
      }
      return S("Polygon", () => {
        const n = t.map((o) => e.Polygon(o.map((a) => [a[0], a[1]]))).sort((o, a) => a.area - o.area), r = t.length === 1 ? t[0].filter((o, a, s) => a < s.length - 1 || o[0] !== s[0][0] || o[1] !== s[0][1]) : void 0;
        return D(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)), void 0, r?.map((o) => [o[0], o[1], 0]));
      });
    },
    circle(t) {
      return k("Circle radius", t), S("Circle", () => D(e.Circle(t)));
    },
    rectangle(t, n, r) {
      return k("Rectangle size", t, n), S("Rectangle", () => D(r ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, r) {
      return k("Rounded rectangle size and radius", t, n, r), r >= Math.min(t, n) / 2 && P("The corner radius must be below half the short side."), S("RoundedRectangle", () => D(e.RoundedRectangle(t, n, r)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && P("A path profile needs at least one segment."), O("Path start", ...Array.isArray(t) ? t : [NaN]), S("path", () => {
        const r = wn(e, t, n), o = vn(r);
        et("path outline", o);
        const a = o.length === r.length ? o.map(([s, i]) => [s, i, 0]) : void 0;
        return D(e.makeFace(new e.Wire(r)), new e.Wire(r), a);
      });
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && P("Text must be a non-empty string."), k("Text size", n);
      try {
        return D(e.Text(t, n));
      } catch (r) {
        if (r instanceof e.FontError) throw new T("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${r.message}`, { cause: r });
        return S("Text", () => {
          throw r;
        });
      }
    },
    union: (t, ...n) => S("fuse (2D)", () => D(n.length ? e.fuse(_(t), ...n.map(_)) : _(t))),
    subtract: (t, ...n) => S("cut (2D)", () => D(n.length ? e.cut(_(t), ...n.map(_)) : _(t))),
    intersect: (t, ...n) => S("intersect (2D)", () => D(n.length ? e.intersect(_(t), ...n.map(_)) : _(t))),
    hull: (...t) => (t.length || P("A hull needs at least one profile."), S("Hull (2D)", () => D(e.Hull(...t.map(_))))),
    translate: (t, [n, r]) => (O("Profile offset", n, r), S("translate (2D)", () => D(_(t).translate([n, r, 0])))),
    rotate: (t, n) => (O("Profile angle", n), S("rotate (2D)", () => D(_(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, r]) => (O("Profile scale", n, r), (n === 0 || r === 0) && P("A zero profile scale flattens the profile."), S("scale (2D)", () => D(_(t).scale([n, r, 1])))),
    offset: (t, n, r) => (O("Profile offset distance", n), S("offset (2D)", () => D(e.offset(_(t), n, { corners: r ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = _(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => S("area (2D)", () => _(t).area)
  };
}
var bn = 0.01, An = 10, En = "MIT AND Apache-2.0", se = 65536, Le, fe, $n = () => new URL("" + new URL("smlibwasm-Bw7fxXQ_.wasm", import.meta.url).href, import.meta.url);
async function Sn(e) {
  if (e.wasmModule) return e.wasmModule;
  if (e.wasmBinary) return e.wasmBinary;
  const t = $n(), n = e.locateFile ? e.locateFile("smlibwasm.wasm", new URL(".", t).href) : t.href, r = !!globalThis.process?.versions?.node;
  if (n.startsWith("file:") || r && !/^[a-z]+:/i.test(n)) {
    const { readFile: a } = await import("../geometry.worker-DDf57Ovz.js").then(function(i) {
      return i._;
    }), { fileURLToPath: s } = await import("../geometry.worker-DDf57Ovz.js").then(function(i) {
      return i._;
    });
    return a(n.startsWith("file:") ? s(n) : n);
  }
  const o = await fetch(n);
  if (!o.ok) throw new Error(`fetching ${n}: ${o.status} ${o.statusText}`);
  return new Uint8Array(await o.arrayBuffer());
}
var Z = { module: "a", name: "D" };
function Tn(e, t, n) {
  const r = Math.floor(t / se);
  return (o, a) => {
    let s;
    const i = o[Z.module], c = i?.[Z.name];
    return i && typeof c == "function" && (i[Z.name] = (f) => {
      s = f >>> 0;
      try {
        return c(f);
      } finally {
        s = void 0;
      }
    }), (async () => {
      if (!i || typeof c != "function") throw new Error(`the loader has no heap-resize import ${Z.module}.${Z.name} to hold the memory ceiling with`);
      const f = await Sn(e), d = f instanceof WebAssembly.Module ? f : await WebAssembly.compile(f);
      if (!WebAssembly.Module.imports(d).some((p) => p.module === Z.module && p.name === Z.name && p.kind === "function"))
        throw new Error(`the module imports no function ${Z.module}.${Z.name}: it is not the pinned smlibwasm build`);
      const u = await WebAssembly.instantiate(d, o), l = Object.values(u.exports).find((p) => p instanceof WebAssembly.Memory);
      if (!l) throw new Error("the module exports no memory");
      if (l.buffer.byteLength > r * se) throw new Error(`the memory ceiling ${t} bytes is below the module's initial ${l.buffer.byteLength} bytes`);
      const h = l.grow.bind(l);
      Object.defineProperty(l, "grow", {
        configurable: !0,
        value: (p) => {
          const w = l.buffer.byteLength / se;
          if (s === void 0 || Math.ceil(s / se) > r || w >= r) throw new RangeError(`WebAssembly memory ceiling of ${r * se} bytes reached`);
          return h(Math.min(p, r - w));
        }
      }), a(u);
    })().catch((f) => n(f instanceof Error ? f : new Error(String(f)))), {};
  };
}
async function Cn(e) {
  const { init: t } = await import("./chunk-WNM5TYC5-DPBFlphI.js").then(function(a) {
    return a.c;
  }), { maxMemoryBytes: n, ...r } = e, o = { ...r };
  delete o.guardSeconds;
  try {
    if (n === void 0) return await t(o);
    (!(n > 0) || !Number.isFinite(n)) && P("maxMemoryBytes must be a positive number of bytes.");
    const a = Math.floor(n / se) * se;
    if (fe)
      return a !== fe.bytes && P(`The kernel was loaded with a memory ceiling of ${fe.bytes} bytes; it loads once per process or worker.`), await fe.loaded;
    let s = () => {
    };
    const i = new Promise((f, d) => {
      s = d;
    }), c = Promise.race([t({ instantiateWasm: Tn(o, n, s) }), i]);
    fe = { bytes: a, loaded: c };
    try {
      const f = await c;
      return Le = a, f;
    } catch (f) {
      throw fe = void 0, f;
    }
  } catch (a) {
    throw a instanceof T ? a : new T("invalid-input", `Could not load SMLib: ${a instanceof Error ? a.message : String(a)}`, { cause: a });
  }
}
var tt = (e) => {
  const t = e.tolerance ?? bn, n = e.angleDeg ?? An;
  return k("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function zn({ sm: e, solid: t }) {
  return {
    box(n) {
      return k("Box size", ...n), S("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, r) {
      return k("Cylinder radius and height", n, r), S("Cylinder", () => t("Cylinder", e.Cylinder(n, r)));
    },
    cone(n, r, o) {
      return O("Cone radii", n, r), k("Cone height", o), (n < 0 || r < 0 || !(n > 0 || r > 0)) && P("Cone radii must be non-negative and not both zero."), S("Cone", () => t("Cone", n === r ? e.Cylinder(n, o) : e.Cone(n, r, o)));
    },
    sphere(n) {
      return k("Sphere radius", n), S("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, r) {
      return k("Torus radii", n, r), r >= n && P("The tube radius must be smaller than the major radius."), S("Torus", () => t("Torus", e.Torus(n, r)));
    },
    polyhedron(n, r) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(r) || r.length < 4) && P("A polyhedron needs at least four points and four faces.");
      for (const o of n) O("Polyhedron points", o[0], o[1], o[2]);
      for (const o of r) (!Array.isArray(o) || o.length < 3 || o.some((a) => !Number.isInteger(a) || a < 0 || a >= n.length)) && P("Polyhedron faces must index at least three existing points.");
      return S("stitch (polyhedron)", () => e.scope(() => {
        const o = hn(n, r).map((s) => {
          const i = s.map((c) => K(n[c]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), a = e.stitch(...o);
        return (!(a instanceof e.Part) || !a.isValid()) && P("The polyhedron faces do not close around a valid solid."), ae(a);
      }));
    }
  };
}
function xt(e, t, n) {
  return (Yt(t, n) ?? P("The loft sections cannot be matched vertex to vertex.")).map((o) => new e.Wire(o.map((a, s) => e.Line(K(a), K(o[(s + 1) % o.length])))));
}
var Pn = 1e-6, oe = (e) => [e.x, e.y, e.z];
function In(e, t) {
  const n = t.map((i, c) => _n(i, c));
  if (n.every((i) => i.every((c) => c.geomType === "line")))
    return xt(e, n.map((i) => i.map((c) => oe(c.start))), "closest");
  if (n.some((i) => i.length !== n[0].length))
    throw new T("unsupported", `Loft pairing 'closest' matches sections with different edge counts (${n.map((i) => i.length).join(", ")}) only when every edge is straight; these have curved edges. Use pairing 'authored', or give the sections equal edge counts.`);
  const r = (i) => i.some((c, f) => {
    const d = i[(f + i.length - 1) % i.length].tangentAt(1), u = c.tangentAt(0);
    return Math.acos(Math.max(-1, Math.min(1, d.x * u.x + d.y * u.y + d.z * u.z))) > Pn;
  });
  if (!n.some(r)) return;
  const o = n.map((i) => ({ pos: Nn(i), axis: [0, 0, 1] })), a = mt(n.map((i) => i.map((c) => oe(c.start))), o), s = t.map((i) => !!Ee(i.profile));
  return n.map((i, c) => {
    const { start: f, forward: d } = a[c], u = i.length, l = Array.from({ length: u }, (h, p) => d ? i[(f + p) % u] : i[((f - 1 - p) % u + u) % u]);
    return new e.Wire(l.map((h) => {
      const [p, w] = d ? [h.start, h.end] : [h.end, h.start];
      if (h.geomType === "line") return e.Line(oe(p), oe(w));
      if (h.geomType === "circle") return e.ThreePointArc(oe(p), oe(h.pointAt(0.5)), oe(w));
      if (d && s[c]) return h;
      throw new T("unsupported", `Loft pairing 'closest' would run section ${c + 1} ${d ? "from another vertex" : "the other way round"}, and it has a ${h.geomType} edge, which this kernel re-starts only as drawn in a path profile; it re-starts lines and circular arcs. Use pairing 'authored', or draw the section from the vertex and in the direction it pairs with.`);
    }));
  });
}
function _n(e, t) {
  const n = (s) => {
    throw new T("unsupported", `Loft pairing 'closest' needs single-outline sections; section ${t + 1} ${s}. Use pairing 'authored' for it.`);
  };
  let r = Ee(e.profile);
  if (!r) {
    const s = [..._(e.profile).faces()];
    s.length !== 1 && n(`has ${s.length} regions`), [...s[0].innerWires()].length && n("has holes"), r = s[0].outerWire();
  }
  const o = [...r.translate(K(e.at)).edges()], a = (s, i) => Math.hypot(s.x - i.x, s.y - i.y, s.z - i.z) <= 1e-7;
  for (let s = 0; s < o.length; s++) {
    const i = o[s], c = o[(s + 1) % o.length];
    a(i.end, c.start) || n("is not one closed chain of edges"), i.isClosed && o.length > 1 && n("has a closed edge among others");
  }
  return o;
}
function Nn(e) {
  let n = 0;
  const r = [0, 0, 0];
  for (const o of e) {
    const a = o.length;
    for (let s = 0; s <= 64; s++) {
      const i = (s === 0 || s === 64 ? 1 : s % 2 ? 4 : 2) * a / 192, c = o.pointAt(s / 64);
      r[0] += i * c.x, r[1] += i * c.y, r[2] += i * c.z;
    }
    n += a;
  }
  return [r[0] / n, r[1] / n, r[2] / n];
}
function On({ sm: e, solid: t }) {
  return {
    extrude(n, r) {
      return k("Extrusion height", r), S("extrude", () => t("extrude", e.extrude(_(n), r)));
    },
    revolve(n, r) {
      return O("Revolution angle", r), (r === 0 || Math.abs(r) > 360) && P("Revolution angle must be in (0, 360] degrees in magnitude."), S("revolve", () => e.scope(() => {
        const o = _(n).rotate(e.Axis.X, 90), a = e.revolve(o, e.Axis.Z, Math.abs(r));
        return t("revolve", r < 0 ? a.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : a);
      }));
    },
    loft(n, r = {}) {
      (!Array.isArray(n) || n.length < 2) && P("A loft needs at least two sections.");
      for (const a of n) O("Loft section position", ...a.at);
      const o = r.pairing ?? "authored";
      return o !== "authored" && o !== "closest" && P(`Unknown loft pairing '${String(o)}' (authored or closest).`), S("loft", () => e.scope(() => {
        const a = !!r.ruled, s = n.map((d) => qe(d.profile)?.length), i = s.some((d) => d !== s[0]);
        if (s.every((d) => d !== void 0) && (i || o === "closest"))
          return t("loft", e.loft(xt(e, n.map((d) => qe(d.profile).map((u) => [u[0] + d.at[0], u[1] + d.at[1], u[2] + d.at[2]])), o), { ruled: a }));
        if (o === "closest") {
          const d = In(e, n);
          if (d) return t("loft", e.loft(d, { ruled: a }));
        }
        const f = (n.every((d) => Ee(d.profile)) ? n.map((d) => Ee(d.profile).translate(K(d.at))) : void 0) ?? n.map((d) => _(d.profile).translate(K(d.at)));
        return t("loft", e.loft(f, { ruled: a }));
      }));
    },
    sweep(n, r) {
      (!Array.isArray(r) || r.length < 2) && P("A sweep rail needs at least two points.");
      for (const o of r) O("Sweep rail points", ...o);
      return S("sweep", () => e.scope(() => {
        const o = r.map(K), a = o.length === 2 ? e.Line(o[0], o[1]) : e.Polyline(o);
        return t("sweep", e.sweep(_(n), a));
      }));
    }
  };
}
function Ln({ sm: e, solid: t }) {
  return {
    union: (n, ...r) => S("fuse", () => t("fuse", r.length ? e.fuse(I(n), ...r.map(I)) : I(n))),
    subtract: (n, ...r) => S("cut", () => t("cut", r.length ? e.cut(I(n), ...r.map(I)) : I(n))),
    intersect: (n, ...r) => S("intersect", () => t("intersect", r.length ? e.intersect(I(n), ...r.map(I)) : I(n))),
    splitByPlane: (n, r, o) => {
      const a = be("Split normal", r);
      return O("Split offset", o), S("split", () => {
        const [s, i] = e.split(I(n), new e.Plane([a[0] * o, a[1] * o, a[2] * o], void 0, a), "both");
        return [t("split", s), t("split", i)];
      });
    },
    translate: (n, r) => (O("Translation", ...r), S("translate", () => ae(I(n).translate(K(r))))),
    rotate: (n, r, o, a = [0, 0, 0]) => {
      const s = be("Rotation axis", r);
      return O("Rotation angle and pivot", o, ...a), S("rotate", () => ae(I(n).rotate(new e.Axis(K(a), s), o)));
    },
    mirror: (n, r, o = [0, 0, 0]) => {
      const a = be("Mirror normal", r);
      return O("Mirror origin", ...o), S("mirror", () => ae(I(n).mirror(new e.Plane(K(o), void 0, a))));
    },
    scale: (n, r) => (O("Scale factors", ...r), r.some((o) => o === 0) && P("A zero scale factor flattens the solid."), S("scale", () => ae(I(n).scale(K(r), [0, 0, 0]))))
  };
}
function Rn(e) {
  const { sm: t, solid: n, face: r } = e, o = (s, i) => i === "all" ? s.edges() : r(s, i).edges(), a = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, i, c = "all") => (k("Fillet radius", i), S("fillet", () => n("fillet", t.fillet(o(I(s), c), i)))),
    chamfer: (s, i, c = "all") => (k("Chamfer distance", i), S("chamfer", () => n("chamfer", t.chamfer(o(I(s), c), i)))),
    shell: (s, i, c) => {
      k("Shell thickness", i);
      const f = c === void 0 ? [] : a(c) ? [c] : [...c];
      return S("shell", () => {
        const d = I(s), u = f.map((l) => r(d, l));
        return n("shell", t.shell(d, -i, u.length ? u : null));
      });
    }
  };
}
function Fn({ sm: e }) {
  return {
    volume: (t) => S("volume", () => I(t).volume),
    area: (t) => S("area", () => I(t).area),
    // Not SMLib's bbox(): it misses interior extremes of some rotated spheres (see bbox.ts).
    bbox: (t) => S("bbox", () => Zt(I(t))),
    massProperties: (t) => S("massProperties", () => {
      const n = I(t).massProperties(1), r = n.inertia, o = (c, f) => (r[c][f] + r[f][c]) / 2, a = [[r[0][0], o(0, 1), o(0, 2)], [o(0, 1), r[1][1], o(1, 2)], [o(0, 2), o(1, 2), r[2][2]]], { values: s, vectors: i } = Ut(a);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: a, principalMoments: s, principalAxes: i };
    }),
    isValid: (t) => S("isValid", () => I(t).isValid()),
    solidCount: (t) => S("solids", () => e.scope(() => I(t).solids().length)),
    components: (t) => S("solids", () => [...I(t).solids()].map(ae))
  };
}
function Bn({ sm: e, solid: t }) {
  return {
    tessellate: (n, r = {}) => {
      const { tolerance: o, angle: a } = tt(r);
      return S("mesh", () => e.scope(() => {
        const s = I(n).mesh(o, a), i = Float64Array.from(s.vertices), c = Uint32Array.from(s.triangles);
        return { positions: i, normals: Wt(i, c), indices: c };
      }));
    },
    exportStl: (n, r = {}) => {
      const { tolerance: o, angle: a } = tt(r);
      return S("toStl", () => e.toStl(I(n), { tolerance: o, angle: a }));
    },
    exportStep: (n) => S("toStep", () => e.toStep(I(n))),
    importStep: (n) => ((typeof n != "string" || !n.length) && P("STEP input must be non-empty text."), S("fromStep", () => {
      const r = e.fromStep(n);
      if (Array.isArray(r) && r.length && r.every((o) => o instanceof e.Part)) {
        const o = r;
        return t("fromStep", o.length === 1 ? o[0] : e.fuse(o[0], ...o.slice(1)));
      }
      return t("fromStep", r);
    }))
  };
}
async function Dn(e = {}) {
  const t = await Cn(e);
  e.guardSeconds !== void 0 && (e.guardSeconds >= 0 || P("guardSeconds must be 0 or more."), t.setGuardSeconds(e.guardSeconds)), t.setWarningHandler(() => {
  });
  const n = Ht(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: En,
    profile: Mn(t),
    ...zn(n),
    ...On(n),
    ...Ln(n),
    ...Rn(n),
    ...Fn(n),
    ...Bn(n),
    memory: () => {
      const r = t.memoryUsage();
      return { used: r.used, heap: r.heap, handles: r.handles };
    },
    scope: (r) => t.scope(r),
    setGuardSeconds: (r) => (Number(r) >= 0 || P("The guard must be 0 or more seconds."), t.setGuardSeconds(r)),
    guardSeconds: () => t.GUARD_SECONDS,
    ...Le !== void 0 ? { maxMemoryBytes: Le } : {}
  };
}
const kn = "@crispcad/exact-kernel", jn = "0.1.7", Xn = "smlib", Un = Object.freeze({ id: Xn, package: kn, version: jn }), nt = 16, rt = 2048, R = (e) => {
  throw new T("unsupported", e);
}, ce = (e) => {
  throw new T("invalid-input", e);
};
function ie(e, t) {
  t < nt && R(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${nt}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const Wn = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], Re = (e, t) => {
  const n = [];
  for (let r = 0; r < 3; r++)
    for (let o = 0; o < 4; o++)
      n.push(e[r * 4] * t[o] + e[r * 4 + 1] * t[4 + o] + e[r * 4 + 2] * t[8 + o] + (o === 3 ? e[r * 4 + 3] : 0));
  return n;
}, ue = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), ot = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], Hn = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function Ae(e, t) {
  const n = Math.hypot(...e);
  n > 0 || ce("Rotation axis must be non-zero.");
  const [r, o, a] = e.map((d) => d / n), s = t * Math.PI / 180, i = Math.cos(s), c = Math.sin(s), f = 1 - i;
  return [f * r * r + i, f * r * o - c * a, f * r * a + c * o, 0, f * r * o + c * a, f * o * o + i, f * o * a - c * r, 0, f * r * a - c * o, f * o * a + c * r, f * a * a + i, 0];
}
const qn = (e) => Re(Ae([0, 0, 1], e[2]), Re(Ae([0, 1, 0], e[1]), Ae([1, 0, 0], e[0])));
function Kn(e) {
  const t = Math.hypot(...e);
  t > 0 || ce("Mirror normal must be non-zero.");
  const [n, r, o] = e.map((a) => a / t);
  return [1 - 2 * n * n, -2 * n * r, -2 * n * o, 0, -2 * n * r, 1 - 2 * r * r, -2 * r * o, 0, -2 * n * o, -2 * r * o, 1 - 2 * o * o, 0];
}
function Vn(e) {
  const [t, n, r, , o, a, s, , i, c, f] = e, d = Math.max(-1, Math.min(1, (t + a + f - 1) / 2)), u = Math.acos(d);
  if (u < 1e-15)
    return null;
  let l = [c - s, r - i, o - n];
  return Math.hypot(...l) < 1e-9 && (l = [[t + 1, o, i], [n, a + 1, c], [r, s, f + 1]].reduce((p, w) => Math.hypot(...w) > Math.hypot(...p) ? w : p)), { axis: l, degrees: u * 180 / Math.PI };
}
function Yn(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && ce("Affine matrix is singular.");
  for (const [s, i] of [[0, 1], [0, 2], [1, 2]]) {
    const c = t[s][0] * t[i][0] + t[s][1] * t[i][1] + t[s][2] * t[i][2];
    Math.abs(c) > 1e-9 * n[s] * n[i] && R("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const r = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), o = [n[0], n[1], r < 0 ? -n[2] : n[2]], a = [0, 1, 2].flatMap((s) => [e[s * 4] / o[0], e[s * 4 + 1] / o[1], e[s * 4 + 2] / o[2], 0]);
  return { scale: o, rotation: a, translate: [e[3], e[7], e[11]] };
}
function wt(e, t, n, r) {
  const o = e.map((s, i) => {
    if (!s)
      return 0;
    const c = r[i] - n[i];
    return c < 1e-12 && ce("Cannot resize a degenerate shape."), s / c;
  }), a = Math.max(...o) || 1;
  return o.map((s, i) => e[i] ? s : t?.[i] ? a : 1);
}
function Q(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return ie("circle2d", t.segments), e.profile.circle(t.radius);
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
      const [r, o, a, s, i, c] = t.matrix, f = Math.hypot(r, s), d = Math.hypot(o, i);
      f > 1e-12 && d > 1e-12 || ce("2D affine matrix is singular."), Math.abs(r * o + s * i) > 1e-9 * f * d && R("2D affine transforms with shear have no exact lowering here.");
      const u = r * i - o * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [f, u < 0 ? -d : d]), Math.atan2(s, r) * 180 / Math.PI), [a, c]);
    }
    case "resize": {
      const n = Q(e, t.profile);
      if (!n)
        return null;
      const r = e.profile.bounds(n), o = wt(t.size, t.auto, r.min, r.max);
      return e.profile.scale(n, [o[0], o[1]]);
    }
    case "offset": {
      t.round && ie("offset2d", t.segments);
      const n = Q(e, t.profile);
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
      const n = t.profiles.map((a) => Q(e, a)), r = n.filter((a) => a !== null);
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
function de(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, r = e.center ? -t / 2 : 0, o = e.center ? -n / 2 : 0;
      return [[r, o], [r + t, o], [r + t, o + n], [r, o + n]];
    }
    case "move":
      return de(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return de(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), r = Math.sin(t);
      return de(e.profile).map(([o, a]) => [n * o - r * a, r * o + n * a]);
    }
    case "affine": {
      const t = e.matrix;
      return de(e.profile).map(([n, r]) => [t[0] * n + t[1] * r + t[2], t[3] * n + t[4] * r + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(de);
    case "empty":
      return [];
    default:
      return R(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function Fe(e, t, n) {
  const r = (o, a) => Fe(a, Re(t, o), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const o of e.shapes)
        Fe(o, t, n);
      return;
    case "move":
      return r(ot(e.vector), e.shape);
    case "rotate":
      return r(qn(e.vector), e.shape);
    case "scale":
      return r(Hn(e.vector), e.shape);
    case "mirror":
      return r(Kn(e.vector), e.shape);
    case "axisRotate":
      return r(Ae(e.vector, e.angle), e.shape);
    case "affine":
      return r(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let o = 0; o < e.count; o++)
        r(ot(e.step.map((a) => a * o)), e.shape);
      return;
    case "box": {
      const [o, a, s] = e.size.map((i) => i / 2);
      for (const i of [-o, o])
        for (const c of [-a, a])
          for (const f of [-s, s])
            n.points.push(ue(t, [i, c, f]));
      return;
    }
    case "polyhedron":
      for (const o of e.points)
        n.points.push(ue(t, o));
      return;
    case "extrude":
      for (const [o, a] of e.points)
        for (const s of [0, e.height])
          n.points.push(ue(t, [o, a, s]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && R("hull of a twisted extrusion has no exact lowering.");
      for (const [o, a] of de(e.profile))
        n.points.push(ue(t, [o, a, 0])), n.points.push(ue(t, [o * e.scaleTop[0], a * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      ie("sphere", e.segments);
      const o = [0, 1, 2].map((a) => Math.hypot(t[a], t[4 + a], t[8 + a]));
      Math.max(...o) - Math.min(...o) > 1e-12 * Math.max(...o) && R("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: ue(t, [0, 0, 0]), radius: e.radius * o[0] });
      return;
    }
    default:
      R(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function Gn(e, t) {
  const n = { points: [], spheres: [] };
  for (const l of t)
    Fe(l, Wn, n);
  if (n.points.length && n.spheres.length && R("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const l = yt(n.points);
    return e.polyhedron(l.points, l.faces);
  }
  if (!n.spheres.length)
    return null;
  const r = n.spheres[0].radius;
  n.spheres.some((l) => Math.abs(l.radius - r) > 1e-12 * r) && R("hull of spheres with different radii has no exact lowering.");
  const o = n.spheres.map((l) => l.centre), a = [0, 1, 2].map((l) => Math.min(...o.map((h) => h[l]))), s = [0, 1, 2].map((l) => Math.max(...o.map((h) => h[l]))), i = s.map((l, h) => l - a[h]), c = 1e-9 * Math.max(1, ...i);
  if (i.every((l) => l <= c))
    return e.translate(e.sphere(r), a);
  const f = (l) => [l & 1 ? s[0] : a[0], l & 2 ? s[1] : a[1], l & 4 ? s[2] : a[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((l) => o.some((h) => h.every((p, w) => Math.abs(p - f(l)[w]) <= c))) || i.some((l) => l <= c)) && R("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const u = e.box(i.map((l) => l + 2 * r));
  return e.translate(e.fillet(u, r, "all"), a.map((l, h) => l + i[h] / 2));
}
function vt(e, t, n) {
  const r = e.profile.bounds(t), o = r.max[0] <= 0;
  r.min[0] < -1e-8 && !o && ce("Revolved profiles must stay on one side of the radial axis.");
  const a = Math.abs(n);
  a > 360 && ce("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(o ? e.profile.scale(t, [-1, 1]) : t, n);
  return o && a !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function Zn(e, t, n) {
  const { scale: r, rotation: o, translate: a } = Yn(n);
  let s = r.every((c) => Math.abs(c - 1) < 1e-15) ? t : e.scale(t, r);
  const i = Vn(o);
  return i && (s = e.rotate(s, i.axis, i.degrees)), a.some((c) => c !== 0) ? e.translate(s, a) : s;
}
function je(e, t) {
  const n = (r) => je(e, r);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return ie("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return ie("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return ie("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && R("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && R("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const r = Q(e, t.profile);
      return r && e.extrude(r, t.height);
    }
    case "revolve": {
      if (ie("revolve", t.segments), t.angle === 0)
        return null;
      const r = Q(e, t.profile);
      return r && vt(e, r, t.angle);
    }
    case "polyhedron": {
      if (t.smooth)
        return er(e, t.smooth);
      if (t.ruled)
        return Jn(e, t.ruled, t.points, t.faces);
      if (t.faces.length > rt && R(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${rt} faces).`), gn(t.points, t.faces)) {
        const r = yt(t.points);
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
      return Gn(e, t.shapes);
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
      return r && Zn(e, r, t.matrix.slice(0, 12));
    }
    case "resize": {
      const r = n(t.shape);
      if (!r)
        return null;
      const o = e.bbox(r);
      return e.scale(r, wt(t.vector, t.auto, o.min, o.max));
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
function Qn(e, t) {
  let n = 0;
  for (const r of t)
    for (let o = 1; o + 1 < r.length; o++) {
      const a = e[r[0]], s = e[r[o]], i = e[r[o + 1]];
      n += a[0] * (s[1] * i[2] - s[2] * i[1]) - a[1] * (s[0] * i[2] - s[2] * i[0]) + a[2] * (s[0] * i[1] - s[1] * i[0]);
    }
  return n / 6;
}
function Jn(e, t, n, r) {
  const o = e.loft(t.map((i) => ({ profile: e.profile.polygon([i.map((c) => [c[0], c[1]])]), at: [0, 0, i[0][2]] })), { ruled: !0 }), a = Qn(n, r), s = e.volume(o);
  if (!(Math.abs(s - a) <= 1e-7 * Math.abs(a)))
    throw o.dispose(), new T("kernel-failure", `The ruled loft's volume ${s} differs from its faceted volume ${a}; the kernel did not keep the vertex correspondence.`);
  return o;
}
function er(e, t) {
  const n = e.loft(t.map((a) => ({ profile: e.profile.polygon([a.map((s) => [s[0], s[1]])]), at: [0, 0, a[0][2]] })), { ruled: !1 }), r = zt(Pt(t)), o = e.volume(n);
  if (!(Math.abs(o - r) <= 1e-7 * Math.abs(r)))
    throw n.dispose(), new T("kernel-failure", `The smooth loft's volume ${o} differs from the volume ${r} of the surface CAD Script defines; the kernel built another surface.`);
  return n;
}
function Cr(e, t) {
  let n;
  try {
    n = ut(t).shape;
  } catch (o) {
    throw o instanceof Ct ? new T("invalid-input", `CAD Script: ${o.message}`, { cause: o }) : o;
  }
  const r = e.scope(() => je(e, n));
  if (!r)
    throw new T("invalid-input", "The program produces no solid.");
  if (!(e.volume(r) > 0))
    throw r.dispose(), new T("kernel-failure", "The exact result has no positive volume.");
  return r;
}
const zr = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} }), Te = 1048576, Mt = 4, tr = Object.freeze({ maxFeatureEdges: 400, maxShellFaces: 160, maxMemoryBytes: 512 * Te, recycleAboveBytes: 192 * Te, requestTimeoutMs: 6e4 }), Pr = Object.freeze({ maxFeatureEdges: 1e3, maxShellFaces: 500, maxMemoryBytes: 2048 * Te, recycleAboveBytes: 512 * Te, requestTimeoutMs: 12e4 }), Ir = Object.freeze({ maxFeatureEdges: 1 / 0, maxShellFaces: 1 / 0, maxMemoryBytes: 1 / 0, recycleAboveBytes: 1 / 0, requestTimeoutMs: 1 / 0 });
function _r(e, t = tr) {
  const n = { ...t };
  for (const r of Object.keys(t)) {
    const o = e?.[r];
    typeof o == "number" && o > 0 && (n[r] = o);
  }
  return Object.freeze(n);
}
function nr(e) {
  const t = e.requestTimeoutMs;
  return Number.isFinite(t) && t > 0 ? Math.max(1, Math.floor(t / 2e3)) : void 0;
}
function rr(e) {
  const t = nr(e);
  return { ...Number.isFinite(e.maxMemoryBytes) && e.maxMemoryBytes > 0 ? { maxMemoryBytes: e.maxMemoryBytes } : {}, ...t !== void 0 ? { guardSeconds: t } : {} };
}
const or = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
};
function sr(e, t) {
  const [n, r, o] = t.faceNormal, a = Math.hypot(n, r, o);
  if (!(a > 0))
    return;
  const s = [n / a, r / a, o / a], i = e.filter((f) => {
    if (f.isPlanar === !1 || f.isPlanar === void 0 && f.geomType !== "plane")
      return !1;
    const d = f.normalAt();
    return d.x * s[0] + d.y * s[1] + d.z * s[2] > 1 - 1e-9;
  });
  if (!t.outermost)
    return i.length === 1 ? i[0] : void 0;
  const c = (f) => {
    const d = f.center?.();
    return d ? d.x * s[0] + d.y * s[1] + d.z * s[2] : 0;
  };
  return i.sort((f, d) => c(d) - c(f))[0];
}
function ar(e, t, n = "all") {
  const r = or(e);
  if (!r)
    return;
  const o = [...r.faces()];
  let a;
  if (t !== "shell" && n !== "all") {
    const c = sr(o, n);
    if (!c)
      return { edges: 0, curvedEdges: 0, faces: o.length, weightedEdges: 0 };
    a = c.edges();
  } else if (r.edges)
    a = r.edges();
  else {
    const c = /* @__PURE__ */ new Map();
    let f = 0;
    for (const d of o)
      for (const u of d.edges())
        c.set(u._identity?.() ?? String(f++), u);
    a = c.values();
  }
  let s = 0, i = 0;
  for (const c of a)
    s++, c.geomType !== "line" && i++;
  return { edges: s, curvedEdges: i, faces: o.length, weightedEdges: s - i + Mt * i };
}
function ir(e, t, n, r) {
  if (!Number.isFinite(r.maxFeatureEdges) && !Number.isFinite(r.maxShellFaces))
    return;
  const o = ar(e, t, n);
  if (o) {
    if (t === "shell") {
      if (o.faces > r.maxShellFaces)
        throw new T("unsupported", N`Shelling a body with ${o.faces} faces is too much for the exact kernel on this device, which allows ${r.maxShellFaces}. Shell a simpler body, or add the holes after shelling.`);
    } else if (o.weightedEdges > r.maxFeatureEdges) {
      const a = Math.floor(r.maxFeatureEdges / Mt), s = r.maxFeatureEdges;
      throw new T("unsupported", t === "fillet" ? N`Rounding ${o.edges} edges (${o.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${a} curved or ${s} straight edges per feature. Choose a face with fewer edges.` : N`Beveling ${o.edges} edges (${o.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${a} curved or ${s} straight edges per feature. Choose a face with fewer edges.`);
    }
    return o;
  }
}
class st extends T {
  constructor(n, r) {
    super(n.code, n.message, r);
    le(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const ge = (e) => {
  throw new T("unsupported", e);
};
function at(e, t, n) {
  if (!n?.some((o) => o !== 0))
    return Ue([...t]), e.profile.polygon([t]);
  Ue([...t], [...n]);
  const r = t.map((o, a) => {
    const s = t[(a + 1) % t.length], i = n[a] ?? 0;
    return i ? { kind: "arc", via: Ft(o, s, i), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], r);
}
const it = (e, t, n) => {
  const r = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(r, [t[0], t[1]]) : r;
};
function ct(e, t, n) {
  const r = t.profile;
  switch (r.kind) {
    case "rectangle":
      return e.profile.rectangle(re(r.width, n), re(r.depth, n), !0);
    case "circle":
      return it(e, r.center ?? [0, 0], re(r.radius, n));
    case "outline":
      return at(e, r.points, r.bulges);
    case "region": {
      It(r.loops, (s) => re(s, n));
      const o = (s) => s.kind === "circle" ? it(e, [re(s.center[0], n), re(s.center[1], n)], re(s.radius, n)) : at(e, s.points, s.bulges), a = r.loops.map(o).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, i) => i.area - s.area);
      return e.profile.subtract(a[0].profile, ...a.slice(1).map((s) => s.profile));
    }
    case "path":
      return ge("Close the sketch path before creating a solid.");
    default:
      return ge(`Sketch profile '${r.kind}' has no exact lowering.`);
  }
}
function me(e, t, n) {
  let r = t;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((o, a) => {
    n[a] && (r = e.rotate(r, o, n[a]));
  }), r;
}
function he(e, t, n, r, o, a) {
  const s = o.get(n);
  if (s)
    return s;
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
        const l = je(e, ut(i.program).shape);
        if (!l)
          throw new T("invalid-input", "Code produces no printable solid.");
        c = l;
        break;
      }
      case "extrusion": {
        const { distance: l, start: h, plane: p } = Rt(i, t);
        c = e.extrude(ct(e, t.sketches[i.sketchId], t), l), h && (c = e.translate(c, [0, 0, h])), p === "XZ" ? c = me(e, c, [90, 0, 0]) : p === "YZ" && (c = me(e, c, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: l, angle: h, axisOffset: p } = Lt(i, t);
        let w = ct(e, t.sketches[i.sketchId], t);
        p && (w = e.profile.translate(w, [-p, 0])), c = vt(e, w, h), l === "XY" ? c = me(e, c, [-90, 0, 0]) : l === "YZ" && (c = me(e, c, [0, 0, 90])), p && (c = e.translate(c, l === "YZ" ? [0, p, 0] : [p, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: l, offset: h } = Ot(i, t), p = [0, 0, 0];
        if (p[l] = 1, c = e.mirror(he(e, t, i.source, r, o, a), p), h) {
          const w = [0, 0, 0];
          w[l] = 2 * h, c = e.translate(c, w);
        }
        break;
      }
      case "pattern": {
        const l = Nt(i, t), h = he(e, t, i.source, r, o, a), p = [h];
        if (l.mode === "linear")
          for (let w = 1; w < l.count; w++) {
            const y = [0, 0, 0];
            y[l.axis] = w * l.spacing, p.push(e.translate(h, y));
          }
        else {
          const w = l.sweep / (Math.abs(l.sweep) === 360 ? l.count : l.count - 1), y = [0, 0, 0];
          y[l.axis] = 1;
          for (let g = 1; g < l.count; g++)
            p.push(e.rotate(h, y, g * w, l.center));
        }
        c = e.union(p[0], ...p.slice(1));
        break;
      }
      case "boolean": {
        const l = i.inputs.map((h) => he(e, t, h, r, o, a));
        if (i.useHoleRoles) {
          const h = l.filter((y, g) => t.nodes[i.inputs[g]].role !== "hole"), p = l.filter((y, g) => t.nodes[i.inputs[g]].role === "hole");
          h.length || ge("A combination of holes only has no solid to export.");
          const w = h.length > 1 ? e.union(h[0], ...h.slice(1)) : h[0];
          c = p.length ? e.subtract(w, ...p) : w;
        } else
          c = i.operation === "union" ? e.union(l[0], ...l.slice(1)) : i.operation === "subtract" ? e.subtract(l[0], ...l.slice(1)) : e.intersect(l[0], ...l.slice(1));
        break;
      }
      case "exact-feature": {
        const l = _t(i, t), h = he(e, t, i.source, r, o, a);
        a && ir(h, l.operation, l.edges, a), c = l.operation === "fillet" ? e.fillet(h, l.size, l.edges) : l.operation === "chamfer" ? e.chamfer(h, l.size, l.edges) : e.shell(h, l.size, l.openFaces);
        break;
      }
      case "mesh":
        return ge(i.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return ge(`'${i.kind}' has no exact lowering.`);
    }
    const { scale: f, rotation: d, position: u } = i.transform;
    f.some((l) => l !== 1) && (c = e.scale(c, f)), c = me(e, c, d), u.some((l) => l !== 0) && (c = e.translate(c, u));
  } catch (f) {
    if (f instanceof st)
      throw f;
    const d = f instanceof T ? f.code : "invalid-input";
    let u = f instanceof Error ? f.message : String(f);
    const l = /the kernel did not finish within ([\d.]+) s/.exec(u);
    throw l && (u = N`The exact kernel stopped this step at its own ${l[1]} s limit, so it was not built. The model was not changed. Try a simpler body.`), new st({ code: d, bodyId: r, nodeId: n, feature: i.kind, message: `${i.name} (${i.kind}): ${u}` }, { cause: f });
  }
  return o.set(n, c), c;
}
function cr(e, t, n, r = {}) {
  if (!t.roots.includes(n))
    throw new T("invalid-input", `${n} is not a top-level body.`);
  return he(e, t, n, n, /* @__PURE__ */ new Map(), r.limits);
}
function lr(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (!o)
    throw new T("invalid-input", `${n} is not a node of this model.`);
  const a = r.local ? { ...t, nodes: { ...t.nodes, [n]: { ...o, transform: Bt() } } } : t, s = t.roots.find((i) => i === n) ?? n;
  return he(e, a, n, s, /* @__PURE__ */ new Map(), r.limits);
}
const fr = 8, q = (e, t, n) => (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x), ye = (e, t) => e.x === t.x && e.y === t.y;
function ur(e, t) {
  let n = 0;
  for (let r = 0, o = t.length - 1; r < t.length; o = r++)
    n += e[2 * t[o]] * e[2 * t[r] + 1] - e[2 * t[r]] * e[2 * t[o] + 1];
  return n / 2;
}
function lt(e, t, n) {
  let r, o;
  for (const a of t) {
    const s = { i: a, x: e[2 * a], y: e[2 * a + 1], removed: !1 };
    r ? (o.next = s, s.prev = o) : r = s, o = s, n.push(s);
  }
  return o.next = r, r.prev = o, r;
}
function _e(e, t) {
  const n = e.prev, r = e.next;
  return q(n, e, r) >= 0 ? q(e, r, t) > 0 && q(e, t, n) > 0 : !(q(e, n, t) > 0 && q(e, t, r) > 0);
}
function bt(e, t, n, r, o) {
  const a = q(e, t, r), s = q(t, n, r), i = q(n, e, r);
  return o ? a > 0 && s > 0 && i > 0 : a >= 0 && s >= 0 && i >= 0;
}
function dr(e, t, n) {
  const r = { ...e }, o = { ...t }, a = e.next, s = t.prev;
  e.next = t, t.prev = e, r.next = a, a.prev = r, o.next = r, r.prev = o, s.next = o, o.prev = s, n.push(r, o);
}
function hr(e, t) {
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
  const a = { x: r, y: e.y };
  let s = n, i = -1 / 0, c = 1 / 0;
  if (n.x !== r || n.y !== e.y) {
    i = (n.x - e.x) / Math.hypot(n.x - e.x, n.y - e.y), c = Math.hypot(n.x - e.x, n.y - e.y);
    const [f, d, u] = q(e, a, n) > 0 ? [e, a, n] : [e, n, a];
    o = t;
    do {
      if (o !== n && !ye(o, n) && bt(f, d, u, o, !1) && !(o.x === e.x && o.y === e.y)) {
        const l = Math.hypot(o.x - e.x, o.y - e.y), h = (o.x - e.x) / l;
        (h > i || h === i && l < c) && _e(o, e) && (s = o, i = h, c = l);
      }
      o = o.next;
    } while (o !== t);
  }
  if (!_e(s, e)) {
    o = t;
    do {
      if (ye(o, s) && _e(o, e))
        return o;
      o = o.next;
    } while (o !== t);
    return;
  }
  return s;
}
function pr(e, t) {
  if (!t.length || t.some((m) => m.length < 3))
    return null;
  const n = [], r = t.map((m) => ur(e, m));
  if (!(Math.abs(r[0]) > 0))
    return null;
  const o = t.map((m, M) => M === 0 == r[M] > 0 ? m : [...m].reverse()), a = lt(e, o[0], n), s = o.slice(1).map((m) => {
    const M = lt(e, m, n);
    let E = M, z = M.next;
    for (; z !== M; )
      (z.x > E.x || z.x === E.x && z.y > E.y) && (E = z), z = z.next;
    return E;
  });
  s.sort((m, M) => M.x - m.x || M.y - m.y);
  for (const m of s) {
    const M = hr(m, a);
    if (!M)
      return null;
    dr(M, m, n);
  }
  let i = 1 / 0, c = 1 / 0, f = -1 / 0, d = -1 / 0;
  for (const m of n)
    m.x < i && (i = m.x), m.y < c && (c = m.y), m.x > f && (f = m.x), m.y > d && (d = m.y);
  const u = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(n.length / 2)))), l = (f - i) / u || 1, h = (d - c) / u || 1, p = (m, M, E) => Math.min(u - 1, Math.max(0, Math.floor((m - M) / E))), w = Array.from({ length: u * u }, () => []);
  for (const m of n)
    w[p(m.y, c, h) * u + p(m.x, i, l)].push(m);
  const y = (m, M) => {
    const E = m.prev, z = m.next, G = q(E, m, z);
    if (M ? G < 0 : G <= 0)
      return !1;
    const ee = p(Math.min(E.x, m.x, z.x), i, l), U = p(Math.max(E.x, m.x, z.x), i, l), Et = p(Math.min(E.y, m.y, z.y), c, h), $t = p(Math.max(E.y, m.y, z.y), c, h);
    for (let Pe = Et; Pe <= $t; Pe++)
      for (let Ie = ee; Ie <= U; Ie++)
        for (const te of w[Pe * u + Ie])
          if (!(te.removed || te === E || te === m || te === z || ye(te, E) || ye(te, m) || ye(te, z)) && bt(E, m, z, te, !1))
            return !1;
    return !0;
  }, g = [];
  let x = a, b = x, A = !1, v = 0;
  {
    let m = a;
    do
      v++, m = m.next;
    while (m !== a);
  }
  for (; v > 3; ) {
    if (y(x, A)) {
      g.push(x.prev.i, x.i, x.next.i), x.removed = !0, x.prev.next = x.next, x.next.prev = x.prev, v--, x = x.next, b = x, A = !1;
      continue;
    }
    if (x = x.next, x === b) {
      if (A)
        return null;
      A = !0;
    }
  }
  if (q(x.prev, x, x.next) < 0)
    return null;
  g.push(x.prev.i, x.i, x.next.i);
  const $ = r.reduce((m, M, E) => m + (E === 0 ? Math.abs(M) : -Math.abs(M)), 0);
  let C = 0;
  for (let m = 0; m < g.length; m += 3) {
    const M = g[m], E = g[m + 1], z = g[m + 2];
    C += ((e[2 * E] - e[2 * M]) * (e[2 * z + 1] - e[2 * M + 1]) - (e[2 * E + 1] - e[2 * M + 1]) * (e[2 * z] - e[2 * M])) / 2;
  }
  return Math.abs(C - $) <= 1e-9 * Math.abs(r[0]) + 1e-12 ? g : null;
}
const At = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
}, ze = class ze {
  constructor() {
    le(this, "positions", []);
    le(this, "cells", /* @__PURE__ */ new Map());
  }
  add(t, n, r) {
    const o = ze.Q, a = Math.round(t / o), s = Math.round(n / o), i = Math.round(r / o);
    let c = this.cells.get(`${a},${s},${i}`);
    if (c !== void 0)
      return c;
    const f = t / o - a, d = n / o - s, u = r / o - i, l = Math.abs(f) > 0.4 ? Math.sign(f) : 0, h = Math.abs(d) > 0.4 ? Math.sign(d) : 0, p = Math.abs(u) > 0.4 ? Math.sign(u) : 0;
    if (l || h || p) {
      for (const w of l ? [0, l] : [0])
        for (const y of h ? [0, h] : [0])
          for (const g of p ? [0, p] : [0])
            if (c = this.cells.get(`${a + w},${s + y},${i + g}`), c !== void 0)
              return this.cells.set(`${a},${s},${i}`, c), c;
    }
    return c = this.positions.length / 3, this.positions.push(t, n, r), this.cells.set(`${a},${s},${i}`, c), c;
  }
};
le(ze, "Q", 1e-6);
let Be = ze;
function mr(e) {
  const t = At(e);
  if (!t)
    return !1;
  for (const n of t.faces())
    if (n.geomType === "plane" && n.wires().length >= fr)
      return !0;
  return !1;
}
function gr(e, t, n) {
  const r = At(t);
  if (!r)
    return;
  const o = [...r.faces()], a = new Be(), s = [], i = /* @__PURE__ */ new Map(), c = (l) => {
    const h = new Uint32Array(l.vertices.length / 3);
    for (let y = 0; y < h.length; y++)
      h[y] = a.add(l.vertices[3 * y], l.vertices[3 * y + 1], l.vertices[3 * y + 2]);
    const p = /* @__PURE__ */ new Set(), w = [];
    for (let y = 0; y < l.triangles.length; y += 3) {
      const g = h[l.triangles[y]], x = h[l.triangles[y + 1]], b = h[l.triangles[y + 2]];
      g === x || x === b || b === g || (s.push(g, x, b), p.add(`${g},${x}`), p.add(`${x},${b}`), p.add(`${b},${g}`));
    }
    for (const y of p) {
      const [g, x] = y.split(",").map(Number);
      p.has(`${x},${g}`) || w.push([g, x]);
    }
    return w;
  }, f = [];
  let d = 0;
  for (const l of o) {
    if (l.geomType === "plane") {
      f.push(l);
      continue;
    }
    const h = n.bands !== !1 ? yr(l, n) : void 0;
    h && d++, i.set(l._identity(), c(h ?? l.mesh(n.tolerance, n.angleDeg)));
  }
  let u = 0;
  for (const l of f) {
    const h = xr(l, a, i), p = l.normalAt(), w = [p.x, p.y, p.z], y = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], g = Xe(pe(y, w)), x = pe(w, g);
    let b = null;
    if (h && h.length === l.wires().length) {
      const A = [...new Set(h.flat())], v = new Map(A.map((m, M) => [m, M])), $ = new Float64Array(2 * A.length);
      A.forEach((m, M) => {
        const E = a.positions;
        $[2 * M] = E[3 * m] * g[0] + E[3 * m + 1] * g[1] + E[3 * m + 2] * g[2], $[2 * M + 1] = E[3 * m] * x[0] + E[3 * m + 1] * x[1] + E[3 * m + 2] * x[2];
      });
      const C = pr($, h.map((m) => m.map((M) => v.get(M))));
      C && (b = C.map((m) => A[m]));
    }
    b ? s.push(...b) : (u++, c(l.mesh(n.tolerance, n.angleDeg)));
  }
  return { positions: a.positions, indices: s, planar: f.length - u, planarFallbacks: u, bands: d };
}
function yr(e, t) {
  if (e.geomType !== "cylinder")
    return;
  const n = [...e.edges()];
  if (n.length !== 2)
    return;
  for (const A of n)
    if (A.geomType !== "circle" || !A.isClosed || ![...A.faces()].every((v) => v.geomType === "plane" || v._identity() === e._identity()))
      return;
  const r = n[0].radius, o = n[0].arcCenter, a = n[1].arcCenter;
  if (!(r > 0) || Math.abs(n[1].radius - r) > 1e-9 * Math.max(1, r) || Math.abs(e.radius - r) > 1e-7 * Math.max(1, r))
    return;
  const s = [a.x - o.x, a.y - o.y, a.z - o.z], i = Math.hypot(s[0], s[1], s[2]);
  if (!(i > 0))
    return;
  const c = s.map((A) => A / i);
  for (const A of n) {
    const v = A.normal;
    if (Math.abs(v.x * c[0] + v.y * c[1] + v.z * c[2]) < 1 - 1e-9)
      return;
  }
  const f = Math.acos(Math.max(-1, 1 - t.tolerance / r)), d = Math.max(8, Math.ceil(360 / t.angleDeg), Math.ceil(Math.PI / Math.max(f, 1e-9)));
  if (d > 4096)
    return;
  const u = Math.abs(c[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], l = Xe(pe(u, c)), h = pe(c, l), p = new Float64Array(6 * d), w = new Uint32Array(6 * d);
  for (let A = 0; A < d; A++) {
    const v = 2 * Math.PI * A / d, $ = Math.cos(v), C = Math.sin(v);
    for (let m = 0; m < 3; m++) {
      const M = r * ($ * l[m] + C * h[m]);
      p[3 * A + m] = [o.x, o.y, o.z][m] + M, p[3 * (d + A) + m] = [a.x, a.y, a.z][m] + M;
    }
  }
  const y = [p[0], p[1], p[2]], g = e.normalAt(y), x = [y[0] - o.x, y[1] - o.y, y[2] - o.z], b = g.x * x[0] + g.y * x[1] + g.z * x[2] > 0;
  for (let A = 0; A < d; A++) {
    const v = A, $ = (A + 1) % d, C = d + v, m = d + $;
    b ? w.set([v, $, m, v, m, C], 6 * A) : w.set([v, m, $, v, C, m], 6 * A);
  }
  return { vertices: p, triangles: w };
}
const pe = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], Xe = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return e.map((n) => n / t);
};
function xr(e, t, n) {
  const r = e._identity(), o = e.normalAt(), a = /* @__PURE__ */ new Set(), s = t.positions;
  let i;
  const c = /* @__PURE__ */ new Set();
  for (const v of e.edges()) {
    const $ = [...v.faces()].filter((m) => m._identity() !== r);
    if ($.length !== 1)
      return;
    const C = $[0];
    if (C.geomType === "plane") {
      if (!(v._isStraight ? v._isStraight() : v.geomType === "line"))
        return;
      const m = v.start, M = v.end, E = t.add(m.x, m.y, m.z), z = t.add(M.x, M.y, M.z);
      i ?? (i = o.x * m.x + o.y * m.y + o.z * m.z), E !== z && a.add(E < z ? `${E},${z}` : `${z},${E}`);
    } else if (c.add(C._identity()), i === void 0) {
      const m = v.start;
      i = o.x * m.x + o.y * m.y + o.z * m.z;
    }
  }
  if (i === void 0)
    return;
  const f = 2e-5 + 1e-9 * Math.abs(i), d = (v) => Math.abs(o.x * s[3 * v] + o.y * s[3 * v + 1] + o.z * s[3 * v + 2] - i) <= f;
  for (const v of c) {
    const $ = n.get(v);
    if (!$)
      return;
    for (const [C, m] of $)
      d(C) && d(m) && a.add(C < m ? `${C},${m}` : `${m},${C}`);
  }
  const u = /* @__PURE__ */ new Map();
  for (const v of a) {
    const [$, C] = v.split(",").map(Number);
    for (const [m, M] of [[$, C], [C, $]]) {
      const E = u.get(m);
      E ? E.push(M) : u.set(m, [M]);
    }
  }
  for (const v of u.values())
    if (v.length !== 2)
      return;
  const l = [], h = /* @__PURE__ */ new Set();
  for (const v of u.keys()) {
    if (h.has(v))
      continue;
    const $ = [v];
    h.add(v);
    let C = v, m = u.get(v)[0];
    for (; m !== v; ) {
      if (h.has(m))
        return;
      $.push(m), h.add(m);
      const [M, E] = u.get(m), z = M === C ? E : M;
      C = m, m = z;
    }
    if ($.length < 3)
      return;
    l.push($);
  }
  const p = Math.abs(o.x) < 0.9 ? [1, 0, 0] : [0, 1, 0], w = [o.x, o.y, o.z], y = Xe(pe(p, w)), g = pe(w, y), x = (v) => {
    let $ = 0;
    for (let C = 0, m = v.length - 1; C < v.length; m = C++) {
      const M = v[m], E = v[C], z = s[3 * M] * y[0] + s[3 * M + 1] * y[1] + s[3 * M + 2] * y[2], G = s[3 * M] * g[0] + s[3 * M + 1] * g[1] + s[3 * M + 2] * g[2], ee = s[3 * E] * y[0] + s[3 * E + 1] * y[1] + s[3 * E + 2] * y[2], U = s[3 * E] * g[0] + s[3 * E + 1] * g[1] + s[3 * E + 2] * g[2];
      $ += z * U - ee * G;
    }
    return Math.abs($);
  }, b = l.map(x), A = b.indexOf(Math.max(...b));
  return [l[A], ...l.filter((v, $) => $ !== A)];
}
const Ne = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function ft(e, t) {
  const n = [], r = [], o = /* @__PURE__ */ new Map(), a = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < a.length; i++) {
    const c = Ne(e.positions[3 * i]), f = Ne(e.positions[3 * i + 1]), d = Ne(e.positions[3 * i + 2]), u = `${c},${f},${d}`;
    let l = o.get(u);
    l === void 0 && (l = n.length / 3, o.set(u, l), n.push(c, f, d)), a[i] = l;
  }
  const s = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.indices.length; i += 3) {
    const c = a[e.indices[i]], f = a[e.indices[i + 1]], d = a[e.indices[i + 2]];
    if (!(c === f || f === d || d === c)) {
      r.push(c, f, d);
      for (const [u, l] of [[c, f], [f, d], [d, c]])
        s.set(`${u},${l}`, (s.get(`${u},${l}`) ?? 0) + 1);
    }
  }
  for (const [i, c] of s) {
    const [f, d] = i.split(",");
    if (c !== 1 || s.get(`${d},${f}`) !== 1)
      throw new T("kernel-failure", N`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > Dt || r.length > kt)
    throw new T("unsupported", N`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (r.length < 12)
    throw new T("kernel-failure", N`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: r };
}
function wr(e, t, n) {
  if (mr(t))
    for (const r of [!0, !1])
      try {
        const o = gr(e, t, { ...We, bands: r });
        if (!o)
          break;
        if (o.bands && o.planarFallbacks)
          continue;
        return ft(o, n);
      } catch (o) {
        if (o instanceof T && o.code === "unsupported")
          throw o;
      }
  return ft(e.tessellate(t, We), n);
}
function vr(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (o?.kind !== "exact-feature")
    throw new T("invalid-input", N`${n} is not an exact feature`);
  const a = lr(e, t, n, { local: !0, limits: r.limits });
  if (!e.isValid(a))
    throw new T("kernel-failure", N`${o.name}: the exact result is not a valid closed solid.`);
  const s = wr(e, a, o.name);
  return { display: { sourceKey: jt(t, n), ...s }, volume: e.volume(a) };
}
const Ce = 64, Mr = 64 * 1024 * 1024;
function br(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const r of n) {
      if (!e.roots.includes(r))
        throw new T("invalid-input", N`Unknown object id: ${r}`);
      const o = e.nodes[r];
      if (o.reference)
        throw new T("invalid-input", N`${o.name} is a reference body and is never exported or measured.`);
      if (o.role === "hole")
        throw new T("invalid-input", N`${o.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((r) => !e.nodes[r].reference && e.nodes[r].role !== "hole");
  if (!n.length)
    throw new T("invalid-input", N("The design has no solid bodies to export"));
  if (n.length > Ce)
    throw new T("invalid-input", N`Exact commands are limited to ${Ce} bodies.`);
  return n;
}
function Ar(e, t = e.maxMemoryBytes) {
  const n = Object.freeze({ ...Un, smlib: e.version, licence: e.licence }), r = (o, a, s = {}) => {
    const i = He(o), c = br(i, a);
    return { doc: i, targets: c, solids: c.map((f) => {
      const d = cr(e, i, f, s);
      if (!e.isValid(d))
        throw new T("kernel-failure", N`${i.nodes[f].name}: the exact result is not a valid closed solid.`);
      return d;
    }) };
  };
  return {
    kernel: e,
    info: n,
    ...t ? { memoryCapBytes: t } : {},
    measure(o, a, s) {
      return e.scope(() => {
        const { doc: i, targets: c, solids: f } = r(o, a, s);
        return { kernel: n, bodies: f.map((d, u) => {
          const l = e.bbox(d), h = e.massProperties(d);
          return { id: c[u], name: i.nodes[c[u]].name, volume: e.volume(d), area: e.area(d), bounds: { min: [...l.min], max: [...l.max] }, centroid: [...h.centroid], solids: e.solidCount(d) };
        }) };
      });
    },
    featureDisplays(o, a, s = {}) {
      const i = He(o), c = a?.length ? [...new Set(a)] : Xt(i);
      if (c.length > Ce)
        throw new T("invalid-input", N`Exact commands are limited to ${Ce} bodies.`);
      for (const f of c)
        if (i.nodes[f]?.kind !== "exact-feature")
          throw new T("invalid-input", N`${f} is not an exact feature`);
      return { kernel: n, features: c.map((f) => e.scope(() => ({ id: f, name: i.nodes[f].name, ...vr(e, i, f, s) }))) };
    },
    exportStep(o, a, s) {
      return e.scope(() => {
        const { doc: i, targets: c, solids: f } = r(o, a, s);
        let d = f[0];
        if (f.length > 1) {
          const h = f.reduce((p, w) => p + e.solidCount(w), 0);
          if (d = e.union(f[0], ...f.slice(1)), e.solidCount(d) !== h) {
            for (let p = 0; p < f.length; p++)
              for (let w = p + 1; w < f.length; w++)
                if (e.solidCount(e.union(f[p], f[w])) < e.solidCount(f[p]) + e.solidCount(f[w]))
                  throw new T("unsupported", N`${i.nodes[c[p]].name} and ${i.nodes[c[w]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new T("unsupported", N("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const u = e.exportStep(d), l = new TextEncoder().encode(u).byteLength;
        if (l > Mr)
          throw new T("unsupported", N("The STEP file exceeds 64 MiB."));
        return { kernel: n, bodies: c.map((h) => ({ id: h, name: i.nodes[h].name })), step: u, bytes: l };
      });
    }
  };
}
let Me;
function Er(e = {}) {
  return Me ?? (Me = Dn(e).then((t) => Ar(t), (t) => {
    throw Me = void 0, t;
  })), Me;
}
function Nr(e) {
  for (let t = e, n = 0; t && n < 8; t = t.cause, n++) {
    if (typeof WebAssembly < "u" && t instanceof WebAssembly.RuntimeError || t instanceof RangeError && /memory|allocat/i.test(t.message))
      return !0;
    const r = t instanceof Error ? t.message : typeof t == "string" ? t : "";
    if (/\bAborted\(|out of memory|memory access out of bounds|bad_alloc|Cannot enlarge memory|memory may be damaged|kernel crashed/i.test(r))
      return !0;
  }
  return !1;
}
function $r(e, t, n = 0, r = {}) {
  const o = performance.now();
  return { ...t.operation === "measure" ? { operation: "measure", ...e.measure(t.document, t.bodies, r) } : t.operation === "feature-display" ? { operation: "feature-display", ...e.featureDisplays(t.document, t.bodies, r) } : { operation: "export-step", ...e.exportStep(t.document, t.bodies, r) }, timing: { loadMs: n, runMs: performance.now() - o, memoryBytes: e.kernel.memory().heap } };
}
function Or(e = {}) {
  const { limits: t, ...n } = e, r = { ...t && typeof t.maxMemoryBytes == "number" && typeof t.requestTimeoutMs == "number" ? rr(t) : {}, ...n }, o = () => new Error(N("Request cancelled"));
  return {
    async run(a, s) {
      if (s?.aborted)
        throw o();
      const i = performance.now(), c = await Er(r), f = performance.now();
      if (s?.aborted || (await new Promise((u) => setTimeout(u, 0)), s?.aborted))
        throw o();
      const d = $r(c, a, f - i, { limits: t });
      if (s?.aborted)
        throw o();
      return d;
    }
  };
}
export {
  Mt as CURVED_EDGE_WEIGHT,
  Xn as EXACT_KERNEL_ID,
  kn as EXACT_KERNEL_PACKAGE,
  jn as EXACT_KERNEL_VERSION,
  Pr as EXACT_LIMITS_DESKTOP,
  Ir as EXACT_LIMITS_NONE,
  tr as EXACT_LIMITS_TABLET,
  T as ExactKernelError,
  st as ExactLoweringError,
  fr as MANY_LOOPS,
  Ce as MAX_EXACT_BODIES,
  rt as MAX_POLYHEDRON_FACES,
  Mr as MAX_STEP_BYTES,
  nt as MIN_EXACT_SEGMENTS,
  zr as cadScript,
  ir as checkExactFeatureCost,
  Er as createExactBackend,
  Ar as createExactBackendFromKernel,
  Or as createInThreadExactHost,
  ft as displayMesh,
  wr as displayTessellation,
  Cr as evaluateCadScript,
  ar as exactFeatureCost,
  vr as exactFeatureDisplay,
  nr as exactGuardSeconds,
  Un as exactKernelIdentity,
  rr as exactKernelOptions,
  br as exactTargets,
  gr as facewiseMesh,
  Nr as isFatalExactError,
  je as lowerCodeShape,
  cr as lowerDocumentBody,
  lr as lowerDocumentNode,
  _r as resolveExactLimits,
  vt as revolveProfile,
  $r as runExactRequest,
  ct as sketchProfile,
  pr as triangulatePolygon
};
