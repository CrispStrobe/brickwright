var Xt = Object.defineProperty;
var Ut = (e, t, n) => t in e ? Xt(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var fe = (e, t, n) => Ut(e, typeof t != "symbol" ? t + "" : t, n);
import { c as bt, C as kt, s as Wt, a as Ht, t as P, M as Gt, b as Kt, E as Ke, e as Vt, d as Ve, f as Ye, g as Yt, h as qe, i as qt, r as Zt, j as Qt, k as se, l as Jt, m as en, n as tn, o as nn, p as on, q as rn, u as sn, v as Ze, w as an, x as cn, y as ln, z as fn, A as un, B as Be, D as dn, F as hn, G as pn } from "../geometry.worker-DGrpKw5I.js";
var S = class extends Error {
  constructor(t, n, o) {
    super(n, o);
    fe(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, C = (e) => {
  throw new S("invalid-input", e);
};
function N(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && C(`${e} must be finite numbers (got ${String(n)}).`);
}
function j(e, ...t) {
  N(e, ...t);
  for (const n of t) n > 0 || C(`${e} must be positive (got ${n}).`);
}
function Te(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return C(`${e} must be a 3-vector.`);
  N(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || C(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function mn(e) {
  const t = e.map((o) => [...o]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let o = 0; o < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); o++)
    for (const [a, s] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[a][s]) < 1e-300) continue;
      const i = (t[s][s] - t[a][a]) / (2 * t[a][s]), l = Math.sign(i || 1) / (Math.abs(i) + Math.sqrt(i * i + 1)), u = 1 / Math.sqrt(l * l + 1), f = l * u;
      for (let c = 0; c < 3; c++) {
        const d = t[c][a], m = t[c][s];
        t[c][a] = u * d - f * m, t[c][s] = f * d + u * m;
      }
      for (let c = 0; c < 3; c++) {
        const d = t[a][c], m = t[s][c];
        t[a][c] = u * d - f * m, t[s][c] = f * d + u * m;
      }
      for (let c = 0; c < 3; c++) {
        const d = n[c][a], m = n[c][s];
        n[c][a] = u * d - f * m, n[c][s] = f * d + u * m;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((o) => [n[0][o], n[1][o], n[2][o]]) };
}
function gn(e, t) {
  const n = new Float64Array(e.length);
  for (let o = 0; o < t.length; o += 3) {
    const r = t[o] * 3, a = t[o + 1] * 3, s = t[o + 2] * 3, i = e[a] - e[r], l = e[a + 1] - e[r + 1], u = e[a + 2] - e[r + 2], f = e[s] - e[r], c = e[s + 1] - e[r + 1], d = e[s + 2] - e[r + 2], m = l * d - u * c, x = u * f - i * d, g = i * c - l * f;
    for (const p of [r, a, s])
      n[p] += m, n[p + 1] += x, n[p + 2] += g;
  }
  for (let o = 0; o < n.length; o += 3) {
    const r = Math.hypot(n[o], n[o + 1], n[o + 2]);
    r > 0 && (n[o] /= r, n[o + 1] /= r, n[o + 2] /= r);
  }
  return n;
}
var re = (e) => ({ part: e, dispose: () => e.dispose() }), D = (e, t, n) => ({ sketch: e, outline: t, polygon: n, dispose: () => {
  e.dispose(), t?.dispose();
} }), _ = (e) => e?.part ?? C("Not a solid of this kernel."), B = (e) => e?.sketch ?? C("Not a profile of this kernel."), Ae = (e) => e?.outline, Qe = (e) => e?.polygon, K = (e) => [e[0], e[1], e[2]];
function $(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof S) throw n;
    const o = n instanceof Error ? n.message : String(n);
    throw new S("kernel-failure", `SMLib ${e} failed: ${o}`, { cause: n });
  }
}
function yn(e) {
  return { sm: e, solid: (o, r) => {
    if (!(r instanceof e.Part)) throw new S("kernel-failure", `SMLib ${o} did not produce a solid (got ${r?.constructor?.name ?? typeof r}).`);
    return re(r);
  }, face: (o, r) => {
    const { faceNormal: a, outermost: s } = Array.isArray(r) ? { faceNormal: r, outermost: !1 } : r, i = Te("Face normal", a), l = (f) => {
      const c = f.center();
      return c.x * i[0] + c.y * i[1] + c.z * i[2];
    }, u = [...o.faces()].filter((f) => {
      if (!f.isPlanar) return !1;
      const c = f.normalAt();
      return c.x * i[0] + c.y * i[1] + c.z * i[2] > 1 - 1e-9;
    });
    return s && u.length ? u.sort((f, c) => l(c) - l(f))[0] : (u.length !== 1 && C(`Expected exactly one planar face with outward normal [${i.join(", ")}], found ${u.length}.`), u[0]);
  } };
}
var Me = 1e-7, Je = 0.1, R = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], X = (e, t) => [e[0] + t[0], e[1] + t[1], e[2] + t[2]], L = (e, t) => [e[0] * t, e[1] * t, e[2] * t], F = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Et = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], Pe = (e) => Math.sqrt(F(e, e)), H = (e, t) => Pe(R(e, t)), ke = (e) => L(e, 1 / Pe(e));
function xn(e, t, n, o) {
  const r = R(e, t), a = Math.cos(o), s = Math.sin(o);
  return X(t, X(X(L(r, a), L(Et(n, r), s)), L(n, F(n, r) * (1 - a))));
}
function St(e) {
  let t = 0, n = [0, 0, 0], o = [0, 0, 0];
  for (let r = 0; r < e.length; r++) {
    const a = e[r], s = e[(r + 1) % e.length], i = H(a, s);
    t += i, n = X(n, L(X(a, s), i / 2)), o = X(o, [(a[1] - s[1]) * (a[2] + s[2]), (a[2] - s[2]) * (a[0] + s[0]), (a[0] - s[0]) * (a[1] + s[1])]);
  }
  return { pos: L(n, 1 / t), axis: ke(o) };
}
function et(e, t, n) {
  let o = X(e, R(n.pos, t.pos)), r = t.axis, a = n.axis;
  const s = Math.acos(Math.max(-1, Math.min(1, F(r, a))));
  if (s <= 1e-4 || s >= Math.PI - 1e-4) return o;
  const i = R(n.pos, t.pos);
  F(i, r) < -1e-7 && (r = L(r, -1)), F(i, a) < 1e-7 && (a = L(a, -1));
  const l = Et(r, a), u = X(L(a, F(i, r)), L(r, -F(i, a))), f = F(u, r), c = F(u, a), d = f * c > 0 && Math.abs(f) > 1e-4 && Math.abs(c) > 1e-4 ? -1 : 1, m = Math.acos(Math.max(-1, Math.min(1, F(r, a) / (Pe(r) * Pe(a)))));
  return o = xn(o, n.pos, ke(l), m * d), o;
}
function wn(e, t, n, o) {
  const r = R(t, e), a = R(o, n), s = R(e, n), i = F(r, r), l = F(r, a), u = F(a, a), f = F(r, s), c = F(a, s), d = i * u - l * l;
  if (!(d <= 1e-24 * i * u))
    return { s: (l * c - u * f) / d, t: (i * c - l * f) / d };
}
function tt(e, t, n) {
  const o = R(n, t);
  return F(R(e, t), o) / F(o, o);
}
function vn(e, t, n) {
  const o = [1 / 0, 1 / 0, 1 / 0], r = [-1 / 0, -1 / 0, -1 / 0];
  for (const { p: c } of e) for (let d = 0; d < 3; d++)
    o[d] = Math.min(o[d], c[d]), r[d] = Math.max(r[d], c[d]);
  const a = Math.hypot(r[0] - o[0], r[1] - o[1], r[2] - o[2]), s = X(t, L(ke(R(n, t)), a)), i = [], l = (c) => c > 0 && c < 1;
  for (const c of e) for (const d of [t, s]) i.push({ vertex: c, p: c.p, d: H(d, c.p) });
  for (let c = 0; c < e.length; c++) {
    const d = e[c].p, m = e[(c + 1) % e.length].p;
    for (const x of [t, s]) {
      const g = tt(x, d, m);
      if (l(g)) {
        const p = X(d, L(R(m, d), g));
        i.push({ edge: c, t: g, p, d: H(x, p) });
      }
    }
  }
  for (const c of e) {
    const d = tt(c.p, t, s);
    l(d) && i.push({ vertex: c, p: c.p, d: H(c.p, X(t, L(R(s, t), d))) });
  }
  for (let c = 0; c < e.length; c++) {
    const d = e[c].p, m = e[(c + 1) % e.length].p, x = wn(t, s, d, m);
    if (!x || !l(x.s) || !l(x.t)) continue;
    const g = X(d, L(R(m, d), x.t));
    i.push({ edge: c, t: x.t, p: g, d: H(g, X(t, L(R(s, t), x.s))) });
  }
  if (!i.length) return;
  const u = Math.min(...i.map((c) => c.d));
  let f;
  for (const c of i) c.d <= u + Me && (!f || H(n, c.p) < H(n, f.p)) && (f = c);
  return f;
}
function nt(e, t, n, o, r) {
  const a = vn(e, t, n);
  if (!a) return;
  if (a.vertex) return a.vertex;
  const s = a.edge, i = e[s], l = e[(s + 1) % e.length], u = a.t;
  let f;
  if (u < Je ? f = i : 1 - u < Je && (f = l), f && !o(f)) return f;
  const c = H(i.p, l.p);
  if (u * c < Me || (1 - u) * c < Me) return f;
  const d = { id: r(), p: a.p };
  return e.splice(s + 1, 0, d), d;
}
function Mn(e, t = "authored") {
  const n = e.length;
  if (n < 2) return e.map((p) => [...p]);
  if (e.every((p) => p.length === e[0].length)) return t === "closest" ? bn(e) : e.map((p) => [...p]);
  let o = 0;
  const r = () => o++, a = e.map((p) => p.map((h) => ({ id: r(), p: h }))), s = e.map(St), i = e.reduce((p, h) => p + h.length, 0), l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Set();
  for (let p = n - 1; p > 0; p--) {
    const h = [...a[p]];
    if (h.length > i) return;
    for (const y of h) {
      const M = et(y.p, s[p], s[p - 1]);
      if (H(M, s[p - 1].pos) <= Me) continue;
      const b = nt(a[p - 1], s[p - 1].pos, M, (v) => u.has(v.id), r);
      if (!b) return;
      l.set(y.id, b.id), u.add(b.id);
    }
  }
  const f = /* @__PURE__ */ new Map();
  for (const [p, h] of l) f.has(h) || f.set(h, p);
  const c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  for (const p of a[0]) {
    const h = [p.id];
    d.set(p.id, p.id);
    let y = p.id;
    for (; h.length < n && f.has(y) && (y = f.get(y), y !== p.id); )
      h.push(y), d.set(y, p.id);
    c.set(p.id, h);
  }
  const m = a[0].length;
  for (let p = 0; p < n - 1; p++) {
    const h = [...a[p]];
    if (h.length > i || h.length > m) return;
    for (const y of h) {
      const M = d.get(y.id);
      if (M === void 0) return;
      const b = c.get(M), v = new Set(a[p + 1].map((w) => w.id));
      if (b.some((w) => v.has(w))) continue;
      const A = et(y.p, s[p], s[p + 1]);
      if (H(A, s[p + 1].pos) <= Me) continue;
      const I = nt(a[p + 1], s[p + 1].pos, A, (w) => d.has(w.id), r);
      if (!I) return;
      b.push(I.id), d.set(I.id, M);
    }
  }
  const x = a[0], g = [x.map((p) => p.p)];
  for (let p = 1; p < n; p++) {
    const h = a[p];
    if (h.length !== x.length) return;
    const y = c.get(x[0].id)?.[p], M = c.get(x[1].id)?.[p], b = h.findIndex((w) => w.id === y), v = h.findIndex((w) => w.id === M);
    if (b < 0 || v < 0) return;
    const A = h.length, I = (b + 1) % A === v ? 1 : (v + 1) % A === b ? -1 : 0;
    if (!I) return;
    g.push(Array.from({ length: A }, (w, E) => h[((b + I * E) % A + A) % A].p));
  }
  return g;
}
function bn(e) {
  return $t(e).map((t, n) => Tt(e[n], t));
}
var Tt = (e, { start: t, forward: n }) => Array.from({ length: e.length }, (o, r) => e[n ? (t + r) % e.length : ((t - r) % e.length + e.length) % e.length]);
function $t(e, t = e.map(St)) {
  const n = t[0], o = [{ start: 0, forward: !0 }];
  let r = e[0], a = n.pos;
  for (let s = 1; s < e.length; s++) {
    const i = e[s], l = i.length;
    let u = t[s].pos;
    const f = R(u, a);
    u = R(u, L(n.axis, F(f, n.axis)));
    const c = R(a, u);
    let d = 1 / 0, m = 0, x = !0;
    const g = (h) => {
      let y = 0;
      for (let M = 0; M < l; M++) y += H(r[M], X(i[h(M)], c));
      return y;
    };
    for (let h = 0; h < l; h++) {
      const y = g((b) => (h + b) % l);
      y < d && (d = y, m = h, x = !0);
      const M = g((b) => ((h - b) % l + l) % l);
      M < d && (d = M, m = h, x = !1);
    }
    const p = { start: m, forward: x };
    o.push(p), r = Tt(i, p), a = u;
  }
  return o;
}
var We = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], Le = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Y = (e) => [e.x, e.y, e.z], be = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return t > 1e-15 ? [e[0] / t, e[1] / t, e[2] / t] : null;
}, ee = (e, ...t) => {
  const n = [e[0], e[1], e[2]];
  for (const [o, r] of t)
    n[0] += o * r[0], n[1] += o * r[1], n[2] += o * r[2];
  return n;
};
function En(e) {
  const t = e.bbox(), n = Math.max(1, t.diagonal), o = 1e-7 * n, r = { min: [1 / 0, 1 / 0, 1 / 0], max: [-1 / 0, -1 / 0, -1 / 0], tol: o };
  for (const a of e.vertices()) V(r, [a.x, a.y, a.z]);
  for (const a of e.edges({ seams: !0 })) Sn(a, r);
  for (const a of e.faces()) Pn(a, r);
  return Number.isFinite(r.min[0]) ? { min: r.min, max: r.max } : { min: [t.min.x, t.min.y, t.min.z], max: [t.max.x, t.max.y, t.max.z] };
}
function V(e, t) {
  for (let n = 0; n < 3; n++)
    t[n] < e.min[n] && (e.min[n] = t[n]), t[n] > e.max[n] && (e.max[n] = t[n]);
}
var Ee = (e, t) => t.some((n, o) => n < e.min[o] - e.tol || n > e.max[o] + e.tol), At = (e, t) => t.some((n) => Ee(e, [n.x, n.y, n.z]));
function Sn(e, t) {
  V(t, Y(e.start)), V(t, Y(e.end));
  const n = e.geomType;
  if (n === "line" || n === "circle" && Tn(e, t)) return;
  let o = null;
  try {
    if (o = e.nurbs(), !At(t, o.points)) return;
  } catch {
  }
  ot(n === "bspline" && o ? An(o) : { t0: 0, t1: 1, spans: 1, at: (r) => Y(e.pointAt(r)) }, t);
}
function Tn(e, t) {
  const n = Y(e.arcCenter), o = be(Y(e.normal)), r = e.radius;
  if (!o) return !1;
  for (const a of We) {
    const s = be(ee(a, [-Le(a, o), o]));
    if (s)
      for (const i of [1, -1]) {
        const l = ee(n, [i * r, s]);
        Ee(t, l) && (e.isClosed || e.distanceTo(l) <= t.tol) && V(t, l);
      }
  }
  return !0;
}
function ot(e, t) {
  const n = Math.min(1024, Math.max(64, 8 * e.spans)), o = (e.t1 - e.t0) / n, r = [], a = (s) => s === n ? e.t1 : e.t0 + s * o;
  for (let s = 0; s <= n; s++) {
    const i = e.at(a(s));
    r.push(i), V(t, i);
  }
  for (let s = 0; s < 3; s++) for (const i of [1, -1]) {
    let l = 0;
    for (let f = 1; f <= n; f++) i * r[f][s] > i * r[l][s] && (l = f);
    $n((f) => {
      const c = e.at(f);
      return V(t, c), i * c[s];
    }, a(Math.max(0, l - 1)), a(Math.min(n, l + 1)));
  }
}
function $n(e, t, n) {
  const o = (Math.sqrt(5) - 1) / 2, r = 1e-12 * Math.max(1, Math.abs(t), Math.abs(n));
  let a = n - o * (n - t), s = t + o * (n - t), i = e(a), l = e(s);
  for (let u = 0; u < 60 && n - t > r; u++)
    i < l ? (t = a, a = s, i = l, s = t + o * (n - t), l = e(s)) : (n = s, s = a, l = i, a = n - o * (n - t), i = e(a));
}
function An(e) {
  const t = e.degree, n = e.knots, o = e.points.length - 1, r = e.weights, a = e.points.map((c, d) => {
    const m = r ? r[d] : 1;
    return [c.x * m, c.y * m, c.z * m, m];
  }), s = n[t], i = n[o + 1];
  let l = 0;
  for (let c = t; c <= o; c++) n[c + 1] > n[c] && l++;
  const u = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]), f = (c) => {
    c = Math.min(i, Math.max(s, c));
    let d = t;
    for (; d < o && n[d + 1] <= c; ) d++;
    for (let x = 0; x <= t; x++) for (let g = 0; g < 4; g++) u[x][g] = a[x + d - t][g];
    for (let x = 1; x <= t; x++) for (let g = t; g >= x; g--) {
      const p = n[g + d - t], h = n[g + 1 + d - x] - p, y = h > 0 ? (c - p) / h : 0;
      for (let M = 0; M < 4; M++) u[g][M] = (1 - y) * u[g - 1][M] + y * u[g][M];
    }
    const m = u[t];
    return [m[0] / m[3], m[1] / m[3], m[2] / m[3]];
  };
  return { t0: s, t1: i, spans: Math.max(1, l), at: f };
}
function Pn(e, t) {
  const n = e.geomType;
  if (n === "plane" || n === "cylinder" || n === "cone" || n === "extrusion") return;
  const o = (r) => Ee(t, r) && e.distanceTo(r) <= t.tol;
  if (n === "sphere") return Cn(e, t, o);
  if (!(n === "torus" && In(e, t, o)) && !e.isPlanar) {
    try {
      const r = e.nurbs();
      if (r.degrees[0] === 1 || r.degrees[1] === 1 || !At(t, r.points.flat())) return;
    } catch {
    }
    _n(e, t);
  }
}
function Cn(e, t, n) {
  const o = Y(e.axis.origin), r = e.radius;
  for (const a of We) for (const s of [1, -1]) {
    const i = ee(o, [s * r, a]);
    n(i) && V(t, i);
  }
}
function In(e, t, n) {
  const o = e.axis, r = Y(o.origin), a = be(Y(o.direction)), s = e.majorRadius, i = e.radius;
  if (!a) return !1;
  for (const l of We) {
    const u = be(ee(l, [-Le(l, a), a]));
    if (u && Math.abs(Le(l, a)) < 1 - 1e-12)
      for (const f of [1, -1]) for (const c of [1, -1]) {
        const d = ee(r, [f * s, u], [c * i, l]);
        n(d) && V(t, d);
      }
    else zn(r, a, s, i, t, n);
  }
  return !0;
}
function zn(e, t, n, o, r, a) {
  const s = be(Math.abs(t[0]) < 0.9 ? ee([1, 0, 0], [-t[0], t]) : ee([0, 1, 0], [-t[1], t])), i = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
  for (const l of [1, -1])
    if (Ee(r, ee(e, [l * o, t])))
      for (let u = 0; u < 72; u++) {
        const f = 2 * Math.PI * u / 72, c = ee(e, [n * Math.cos(f), s], [n * Math.sin(f), i], [l * o, t]);
        if (a(c)) {
          V(r, c);
          break;
        }
      }
}
function _n(e, t) {
  const o = [];
  for (let r = 0; r <= 24; r++) for (let a = 0; a <= 24; a++) o.push({ u: r / 24, v: a / 24, p: Y(e.positionAt(r / 24, a / 24)) });
  for (let r = 0; r < 3; r++) for (const a of [1, -1]) {
    const i = o.filter((u) => Ee(t, u.p)).sort((u, f) => a * f.p[r] - a * u.p[r]).find((u) => e.distanceTo(u.p) <= t.tol);
    if (!i) continue;
    V(t, i.p);
    const l = Bn(e, i, r, a, 1 / 24);
    e.distanceTo(l) <= t.tol && V(t, l);
  }
}
function Bn(e, t, n, o, r) {
  let { u: a, v: s } = t, i = o * t.p[n], l = t.p;
  for (let u = r; u > 1e-9; u /= 2)
    for (let f = !0, c = 0; f && c < 64; c++) {
      f = !1;
      for (const [d, m] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = Math.min(1, Math.max(0, a + d * u)), g = Math.min(1, Math.max(0, s + m * u)), p = Y(e.positionAt(x, g));
        o * p[n] > i && (a = x, s = g, i = o * p[n], l = p, f = !0);
      }
    }
  return l;
}
var rt = 1024, oe = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], U = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Ce = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function Pt(e) {
  const n = 1e-9 * Math.max(1, ...e.flatMap((a) => a.map(Math.abs))), o = Nn(e, n);
  if (o.length > rt) throw new S("unsupported", `Hull of ${o.length} distinct vertices exceeds the exact hull budget (${rt}).`);
  if (o.length < 4) throw new S("invalid-input", "A hull needs at least four non-coplanar points.");
  const r = Fn(o, n);
  return On(o, r, Math.min(n, 1e-9));
}
function Nn(e, t) {
  const n = Math.max(t * 4, 1e-300), o = /* @__PURE__ */ new Map(), r = [];
  for (const a of e) {
    const s = a.map((u) => Math.floor(u / n));
    let i = !1;
    for (let u = -1; u <= 1 && !i; u++) for (let f = -1; f <= 1 && !i; f++) for (let c = -1; c <= 1 && !i; c++)
      for (const d of o.get(`${s[0] + u},${s[1] + f},${s[2] + c}`) ?? []) if (Math.hypot(...oe(a, d)) <= t) {
        i = !0;
        break;
      }
    if (i) continue;
    const l = s.join(",");
    (o.get(l) ?? o.set(l, []).get(l)).push(a), r.push(a);
  }
  return r;
}
function st(e, t, n, o) {
  const r = Ce(oe(e[n], e[t]), oe(e[o], e[t])), a = Math.hypot(...r), s = a > 0 ? [r[0] / a, r[1] / a, r[2] / a] : [0, 0, 0], i = [(e[t][0] + e[n][0] + e[o][0]) / 3, (e[t][1] + e[n][1] + e[o][1]) / 3, (e[t][2] + e[n][2] + e[o][2]) / 3];
  return { v: [t, n, o], n: s, d: U(s, i), area: a / 2, alive: !0 };
}
function Fn(e, t) {
  const n = e.length;
  let o = 0;
  for (let h = 1; h < n; h++) e[h][0] < e[o][0] && (o = h);
  let r = -1, a = -1;
  for (let h = 0; h < n; h++) {
    const y = Math.hypot(...oe(e[h], e[o]));
    y > a && (a = y, r = h);
  }
  let s = -1;
  a = -1;
  const i = oe(e[r], e[o]);
  for (let h = 0; h < n; h++) {
    const y = Math.hypot(...Ce(i, oe(e[h], e[o])));
    y > a && (a = y, s = h);
  }
  if (!(a > t * Math.hypot(...i))) throw new S("invalid-input", "The hull is flat (all points collinear).");
  const l = st(e, o, r, s);
  let u = -1;
  a = -1;
  for (let h = 0; h < n; h++) {
    const y = Math.abs(U(l.n, e[h]) - l.d);
    y > a && (a = y, u = h);
  }
  if (!(a > t)) throw new S("invalid-input", "The hull is flat (all points coplanar).");
  const f = [], c = /* @__PURE__ */ new Map(), d = (h, y, M) => {
    const b = st(e, h, y, M), v = f.length;
    return f.push(b), c.set(h * n + y, v), c.set(y * n + M, v), c.set(M * n + h, v), v;
  }, m = (h) => {
    const y = f[h];
    y.alive = !1;
    const [M, b, v] = y.v;
    for (const A of [M * n + b, b * n + v, v * n + M]) c.get(A) === h && c.delete(A);
  };
  U(l.n, e[u]) - l.d > 0 ? (d(o, s, r), d(o, r, u), d(r, s, u), d(s, o, u)) : (d(o, r, s), d(o, u, r), d(r, u, s), d(s, u, o));
  const x = /* @__PURE__ */ new Set([o, r, s, u]), g = e.reduce((h, y) => [h[0] + y[0] / n, h[1] + y[1] / n, h[2] + y[2] / n], [0, 0, 0]), p = [...e.keys()].filter((h) => !x.has(h)).sort((h, y) => Math.hypot(...oe(e[y], g)) - Math.hypot(...oe(e[h], g)));
  for (const h of p) {
    const y = e[h];
    let M = -1, b = t;
    for (let w = 0; w < f.length; w++) {
      const E = f[w];
      if (!E.alive) continue;
      const T = U(E.n, y) - E.d;
      T > b && (b = T, M = w);
    }
    if (M < 0) continue;
    const v = /* @__PURE__ */ new Set([M]), A = [M];
    for (; A.length; ) {
      const w = A.pop(), [E, T, z] = f[w].v;
      for (const [q, te] of [[E, T], [T, z], [z, E]]) {
        const k = c.get(te * n + q);
        k === void 0 || v.has(k) || U(f[k].n, y) - f[k].d > t && (v.add(k), A.push(k));
      }
    }
    const I = [];
    for (const w of v) {
      const [E, T, z] = f[w].v;
      for (const [q, te] of [[E, T], [T, z], [z, E]]) {
        const k = c.get(te * n + q);
        (k === void 0 || !v.has(k)) && I.push([q, te]);
      }
    }
    for (const w of v) m(w);
    for (const [w, E] of I) d(w, E, h);
  }
  return f.filter((h) => h.alive);
}
function On(e, t, n) {
  const o = e.length, r = /* @__PURE__ */ new Map();
  t.forEach((d, m) => {
    const [x, g, p] = d.v;
    r.set(x * o + g, m), r.set(g * o + p, m), r.set(p * o + x, m);
  });
  const a = new Array(t.length).fill(-1), s = [], i = [...t.keys()].sort((d, m) => t[m].area - t[d].area);
  for (const d of i) {
    if (a[d] >= 0) continue;
    const { n: m, d: x } = t[d], g = s.length, p = [d];
    a[d] = g;
    for (let y = 0; y < p.length; y++) {
      const [M, b, v] = t[p[y]].v;
      for (const [A, I] of [[M, b], [b, v], [v, M]]) {
        const w = r.get(I * o + A);
        if (w === void 0 || a[w] >= 0) continue;
        const E = t[w];
        U(E.n, m) < 1 - 1e-6 || E.v.some((T) => Math.abs(U(m, e[T]) - x) > n) || (a[w] = g, p.push(w));
      }
    }
    const h = p.length > 1 ? Rn(p.map((y) => t[y].v), o) : t[d].v.slice();
    if (h) s.push(h);
    else {
      a[d] = g, s.push(t[d].v.slice());
      for (const y of p.slice(1))
        a[y] = s.length, s.push(t[y].v.slice());
    }
  }
  const l = /* @__PURE__ */ new Map();
  for (const d of s) for (const m of d) l.set(m, (l.get(m) ?? 0) + 1);
  const u = s.map((d) => {
    const m = d.filter((x) => (l.get(x) ?? 0) > 2);
    return m.length >= 3 ? m : d;
  }), f = [...new Set(u.flat())].sort((d, m) => d - m), c = new Map(f.map((d, m) => [d, m]));
  return { points: f.map((d) => e[d]), faces: u.map((d) => d.map((m) => c.get(m))) };
}
function Rn(e, t) {
  const n = /* @__PURE__ */ new Set();
  for (const [s, i, l] of e) for (const [u, f] of [[s, i], [i, l], [l, s]]) n.add(u * t + f);
  const o = /* @__PURE__ */ new Map();
  for (const s of n) {
    const i = Math.floor(s / t), l = s % t;
    if (!n.has(l * t + i)) {
      if (o.has(i)) return null;
      o.set(i, l);
    }
  }
  const r = o.keys().next().value, a = [r];
  for (let s = o.get(r); s !== r; s = o.get(s)) {
    if (s === void 0 || a.length > o.size) return null;
    a.push(s);
  }
  return a.length === o.size ? a : null;
}
function Ln(e, t, n = 1e-9) {
  const o = [];
  for (const r of t) {
    const a = Dn(e, r);
    if (r.length === 3 || !a) {
      o.push([...r]);
      continue;
    }
    const s = r.reduce((i, l) => i + U(a, e[l]), 0) / r.length;
    if (r.every((i) => Math.abs(U(a, e[i]) - s) <= n)) {
      o.push([...r]);
      continue;
    }
    o.push(...jn(e, r, a));
  }
  return o;
}
function Dn(e, t) {
  const n = [0, 0, 0];
  for (let r = 0; r < t.length; r++) {
    const a = e[t[r]], s = e[t[(r + 1) % t.length]];
    n[0] += (a[1] - s[1]) * (a[2] + s[2]), n[1] += (a[2] - s[2]) * (a[0] + s[0]), n[2] += (a[0] - s[0]) * (a[1] + s[1]);
  }
  const o = Math.hypot(...n);
  return o > 0 ? [n[0] / o, n[1] / o, n[2] / o] : null;
}
function jn(e, t, n) {
  const o = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], r = Ce(n, o), a = Math.hypot(...r), s = [r[0] / a, r[1] / a, r[2] / a], i = Ce(n, s), l = new Map(t.map((x) => [x, [U(e[x], s), U(e[x], i)]])), u = (x, g, p) => {
    const [h, y] = l.get(x), [M, b] = l.get(g), [v, A] = l.get(p);
    return (M - h) * (A - y) - (b - y) * (v - h);
  }, f = (x, g, p, h) => u(g, p, x) >= 0 && u(p, h, x) >= 0 && u(h, g, x) >= 0, c = [...t], d = [];
  let m = 0;
  for (; c.length > 3 && m++ < 10 * t.length * t.length; ) {
    let x = !1;
    for (let g = 0; g < c.length; g++) {
      const p = c[(g + c.length - 1) % c.length], h = c[g], y = c[(g + 1) % c.length];
      if (!(u(p, h, y) <= 0) && !c.some((M) => M !== p && M !== h && M !== y && f(M, p, h, y))) {
        d.push([p, h, y]), c.splice(g, 1), x = !0;
        break;
      }
    }
    if (!x) break;
  }
  if (c.length > 3)
    for (let x = 1; x + 1 < c.length; x++) d.push([c[0], c[x], c[x + 1]]);
  else d.push(c);
  return d;
}
function Xn(e, t) {
  const n = Math.max(1, ...e.flatMap((r) => r.map(Math.abs))), o = 1e-9 * n;
  for (const r of t) {
    const a = [0, 0, 0];
    for (let u = 0; u < r.length; u++) {
      const f = e[r[u]], c = e[r[(u + 1) % r.length]];
      a[0] += (f[1] - c[1]) * (f[2] + c[2]), a[1] += (f[2] - c[2]) * (f[0] + c[0]), a[2] += (f[0] - c[0]) * (f[1] + c[1]);
    }
    const s = Math.hypot(...a);
    if (!(s > 0)) return !1;
    const i = [a[0] / s, a[1] / s, a[2] / s], l = U(i, e[r[0]]);
    if (r.some((u) => Math.abs(U(i, e[u]) - l) > o) || e.some((u) => U(i, u) - l > o)) return !1;
  }
  return !0;
}
function Un(e) {
  const t = e.length;
  if (t < 4) return null;
  let n = 1;
  for (const r of e) n = Math.max(n, Math.abs(r[0]), Math.abs(r[1]));
  const o = kn(e, 1e-9 * n);
  for (let r = 0; r < t; r++) {
    for (let a = r + 2; a < t; a++) {
      const s = r === 0 && a === t - 1 ? null : o.edgesCross(r, a);
      if (s) return { edges: [r, a], at: s };
    }
    for (let a = 0; a < t; a++) if (o.passesThrough(r, a)) return { edges: [r, (a - 1 + t) % t], at: [e[a][0], e[a][1]] };
  }
  return null;
}
function kn(e, t) {
  const n = e.length, o = (i) => e[(i % n + n) % n], r = (i, l, u) => {
    const f = Math.hypot(l[0] - i[0], l[1] - i[1]), c = f <= t ? 0 : ((l[0] - i[0]) * (u[1] - i[1]) - (l[1] - i[1]) * (u[0] - i[0])) / f;
    return Math.abs(c) <= t ? 0 : Math.sign(c);
  }, a = (i, l, u) => {
    const f = Math.hypot(l[0] - i[0], l[1] - i[1]), c = ((u[0] - i[0]) * (l[0] - i[0]) + (u[1] - i[1]) * (l[1] - i[1])) / f;
    return c > t && c < f - t;
  }, s = (i, l, u, f) => {
    for (let c = 1; c < n; c++) {
      const d = r(i, l, o(u + f * c));
      if (d) return d;
    }
    return 0;
  };
  return {
    /** Where edges i and j cross in their interiors, or null. */
    edgesCross(i, l) {
      const u = o(i), f = o(i + 1), c = o(l), d = o(l + 1);
      if (r(u, f, c) * r(u, f, d) >= 0 || r(c, d, u) * r(c, d, f) >= 0) return null;
      const m = (f[0] - u[0]) * (d[1] - c[1]) - (f[1] - u[1]) * (d[0] - c[0]), x = ((c[0] - u[0]) * (d[1] - c[1]) - (c[1] - u[1]) * (d[0] - c[0])) / m;
      return [u[0] + x * (f[0] - u[0]), u[1] + x * (f[1] - u[1])];
    },
    /** Whether vertex k lies inside edge i and the outline passes there from one side to the other. */
    passesThrough(i, l) {
      if (l === i || l === (i + 1) % n) return !1;
      const u = o(i), f = o(i + 1), c = o(l);
      return r(u, f, c) !== 0 || !a(u, f, c) ? !1 : s(u, f, l, -1) * s(u, f, l, 1) < 0;
    }
  };
}
var W = (e) => [e[0], e[1], 0];
function Wn(e, t, n) {
  let o = t;
  const r = [], a = (s, i) => ((!Array.isArray(i) || i.length !== 2) && C(`${s} must be a 2D point.`), N(s, i[0], i[1]), i);
  for (const s of n) {
    const i = s.kind === "spline" ? a("Spline point", s.through.at(-1) ?? C("A spline needs at least one point.")) : a("Path point", s.to);
    s.kind === "line" ? r.push(e.Line(W(o), W(i))) : s.kind === "arc" ? r.push(e.ThreePointArc(W(o), W(a("Arc point", s.via)), W(i))) : s.kind === "radiusArc" ? (N("Arc radius", s.radius), r.push(e.RadiusArc(W(o), W(i), s.radius))) : s.kind === "sagittaArc" ? (N("Arc sagitta", s.sagitta), r.push(e.SagittaArc(W(o), W(i), s.sagitta))) : s.kind === "spline" ? r.push(e.Spline(W(o), ...s.through.map((l) => W(a("Spline point", l))))) : C(`Unknown path segment kind '${s.kind}'.`), o = i;
  }
  return Math.hypot(o[0] - t[0], o[1] - t[1]) > 1e-9 && r.push(e.Line(W(o), W(t))), r;
}
function at(e, t) {
  const n = Un(t);
  if (!n) return;
  const [o, r] = n.at.map((a) => +a.toPrecision(6));
  C(`The ${e} crosses itself at (${o}, ${r}), so it bounds no region. Reorder its points so no edges cross, or give each region its own contour.`);
}
function Hn(e) {
  const t = [];
  for (const n of e) {
    const o = n.pointAt(0), r = n.pointAt(1), s = Math.abs(n.length - Math.hypot(r.x - o.x, r.y - o.y)) <= 1e-9 * Math.max(1, n.length) ? 1 : 32;
    for (let i = 0; i < s; i++) {
      const l = i ? n.pointAt(i / s) : o;
      t.push([l.x, l.y]);
    }
  }
  return t;
}
function Gn(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && C("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && C("Each polygon contour needs at least three points.");
        for (const o of n) N("Polygon points", o[0], o[1]);
        at("polygon contour", n);
      }
      return $("Polygon", () => {
        const n = t.map((r) => e.Polygon(r.map((a) => [a[0], a[1]]))).sort((r, a) => a.area - r.area), o = t.length === 1 ? t[0].filter((r, a, s) => a < s.length - 1 || r[0] !== s[0][0] || r[1] !== s[0][1]) : void 0;
        return D(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)), void 0, o?.map((r) => [r[0], r[1], 0]));
      });
    },
    circle(t) {
      return j("Circle radius", t), $("Circle", () => D(e.Circle(t)));
    },
    rectangle(t, n, o) {
      return j("Rectangle size", t, n), $("Rectangle", () => D(o ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, o) {
      return j("Rounded rectangle size and radius", t, n, o), o >= Math.min(t, n) / 2 && C("The corner radius must be below half the short side."), $("RoundedRectangle", () => D(e.RoundedRectangle(t, n, o)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && C("A path profile needs at least one segment."), N("Path start", ...Array.isArray(t) ? t : [NaN]), $("path", () => {
        const o = Wn(e, t, n), r = Hn(o);
        at("path outline", r);
        const a = r.length === o.length ? r.map(([s, i]) => [s, i, 0]) : void 0;
        return D(e.makeFace(new e.Wire(o)), new e.Wire(o), a);
      });
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && C("Text must be a non-empty string."), j("Text size", n);
      try {
        return D(e.Text(t, n));
      } catch (o) {
        if (o instanceof e.FontError) throw new S("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${o.message}`, { cause: o });
        return $("Text", () => {
          throw o;
        });
      }
    },
    union: (t, ...n) => $("fuse (2D)", () => D(n.length ? e.fuse(B(t), ...n.map(B)) : B(t))),
    subtract: (t, ...n) => $("cut (2D)", () => D(n.length ? e.cut(B(t), ...n.map(B)) : B(t))),
    intersect: (t, ...n) => $("intersect (2D)", () => D(n.length ? e.intersect(B(t), ...n.map(B)) : B(t))),
    hull: (...t) => (t.length || C("A hull needs at least one profile."), $("Hull (2D)", () => D(e.Hull(...t.map(B))))),
    translate: (t, [n, o]) => (N("Profile offset", n, o), $("translate (2D)", () => D(B(t).translate([n, o, 0])))),
    rotate: (t, n) => (N("Profile angle", n), $("rotate (2D)", () => D(B(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, o]) => (N("Profile scale", n, o), (n === 0 || o === 0) && C("A zero profile scale flattens the profile."), $("scale (2D)", () => D(B(t).scale([n, o, 1])))),
    offset: (t, n, o) => (N("Profile offset distance", n), $("offset (2D)", () => D(e.offset(B(t), n, { corners: o ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = B(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => $("area (2D)", () => B(t).area)
  };
}
var J = (e) => [e.x, e.y, e.z], it = (e) => e._identity(), ct = 48;
function Kn(e) {
  const t = e.degree, n = e.knots, o = e.points.length - 1, r = e.weights, a = e.points.map((u, f) => {
    const c = r ? r[f] : 1;
    return [u.x * c, u.y * c, u.z * c, c];
  }), s = n[t], i = n[o + 1], l = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]);
  return (u) => {
    const f = Math.min(i, Math.max(s, s + u * (i - s)));
    let c = t;
    for (; c < o && n[c + 1] <= f; ) c++;
    for (let m = 0; m <= t; m++) for (let x = 0; x < 4; x++) l[m][x] = a[m + c - t][x];
    for (let m = 1; m <= t; m++) for (let x = t; x >= m; x--) {
      const g = n[x + c - t], p = n[x + 1 + c - m] - g, h = p > 0 ? (f - g) / p : 0;
      for (let y = 0; y < 4; y++) l[x][y] = (1 - h) * l[x - 1][y] + h * l[x][y];
    }
    const d = l[t];
    return [d[0] / d[3], d[1] / d[3], d[2] / d[3]];
  };
}
function Vn(e, t) {
  const n = J(e.start), o = J(e.end);
  if (t === "line") return [n, o];
  let r = (i) => J(e.pointAt(i)), a = 16;
  if (t === "circle") {
    const i = e.length / (2 * Math.PI * Math.max(e.radius, 1e-12));
    a = Math.max(4, Math.min(ct, Math.ceil(48 * i)));
  } else if (t === "bspline")
    try {
      const i = e.nurbs(), l = Kn(i), u = l(0), f = (c, d) => Math.hypot(c[0] - d[0], c[1] - d[1], c[2] - d[2]);
      r = f(u, n) <= f(u, o) ? l : (c) => l(1 - c), a = Math.max(8, Math.min(ct, 4 * (i.points.length - i.degree)));
    } catch {
    }
  const s = [n];
  for (let i = 1; i < a; i++) s.push(r(i / a));
  return s.push(o), s;
}
function Yn(e) {
  const t = [...e.faces()], n = /* @__PURE__ */ new Map(), o = t.map((a, s) => {
    n.set(it(a), s);
    const i = a.geomType, l = a.interiorPoint(), u = { index: s, name: a.name, surface: i, area: a.area, point: J(l), normal: J(a.normalAt(l)) };
    if (i === "cylinder" || i === "cone" || i === "sphere" || i === "torus") {
      const f = a.axis;
      return { ...u, radius: a.radius, axis: { origin: J(f.origin), direction: J(f.direction) } };
    }
    return u;
  }), r = [...e.edges()].map((a, s) => {
    const i = a.geomType, l = Vn(a, i), u = [...a.faces()].map((c) => n.get(it(c))).filter((c) => c !== void 0), f = { index: s, curve: i, faces: u, length: a.length, closed: a.isClosed, points: l };
    return i === "circle" ? { ...f, radius: a.radius, center: J(a.arcCenter), axis: J(a.normal) } : f;
  });
  return { faces: o, edges: r };
}
function qn(e, t) {
  const n = [...e.faces()];
  if (t.length !== n.length) throw new RangeError(`nameFaces: ${t.length} names for ${n.length} faces.`);
  let o = e;
  return t.forEach((r, a) => {
    r !== null && (o = o.named(r === "" ? null : r, { faces: [n[a]] }));
  }), o;
}
function Zn(e, t) {
  const n = [...e.edges()];
  if (!t.length) throw new RangeError("Select at least one edge.");
  if (new Set(t).size !== t.length) throw new RangeError("Each edge may be selected once.");
  return t.map((o) => {
    if (!Number.isInteger(o) || o < 0 || o >= n.length) throw new RangeError(`Edge index ${o} is not an edge of this solid (it has ${n.length}).`);
    return n[o];
  });
}
var Qn = 0.01, Jn = 10, eo = "MIT AND Apache-2.0", ie = 65536, De, ue, to = () => new URL("" + new URL("smlibwasm-Bw7fxXQ_.wasm", import.meta.url).href, import.meta.url);
async function no(e) {
  if (e.wasmModule) return e.wasmModule;
  if (e.wasmBinary) return e.wasmBinary;
  const t = to(), n = e.locateFile ? e.locateFile("smlibwasm.wasm", new URL(".", t).href) : t.href, o = !!globalThis.process?.versions?.node;
  if (n.startsWith("file:") || o && !/^[a-z]+:/i.test(n)) {
    const { readFile: a } = await import("../geometry.worker-DGrpKw5I.js").then(function(i) {
      return i._;
    }), { fileURLToPath: s } = await import("../geometry.worker-DGrpKw5I.js").then(function(i) {
      return i._;
    });
    return a(n.startsWith("file:") ? s(n) : n);
  }
  const r = await fetch(n);
  if (!r.ok) throw new Error(`fetching ${n}: ${r.status} ${r.statusText}`);
  return new Uint8Array(await r.arrayBuffer());
}
var Z = { module: "a", name: "D" };
function oo(e, t, n) {
  const o = Math.floor(t / ie);
  return (r, a) => {
    let s;
    const i = r[Z.module], l = i?.[Z.name];
    return i && typeof l == "function" && (i[Z.name] = (u) => {
      s = u >>> 0;
      try {
        return l(u);
      } finally {
        s = void 0;
      }
    }), (async () => {
      if (!i || typeof l != "function") throw new Error(`the loader has no heap-resize import ${Z.module}.${Z.name} to hold the memory ceiling with`);
      const u = await no(e), f = u instanceof WebAssembly.Module ? u : await WebAssembly.compile(u);
      if (!WebAssembly.Module.imports(f).some((x) => x.module === Z.module && x.name === Z.name && x.kind === "function"))
        throw new Error(`the module imports no function ${Z.module}.${Z.name}: it is not the pinned smlibwasm build`);
      const c = await WebAssembly.instantiate(f, r), d = Object.values(c.exports).find((x) => x instanceof WebAssembly.Memory);
      if (!d) throw new Error("the module exports no memory");
      if (d.buffer.byteLength > o * ie) throw new Error(`the memory ceiling ${t} bytes is below the module's initial ${d.buffer.byteLength} bytes`);
      const m = d.grow.bind(d);
      Object.defineProperty(d, "grow", {
        configurable: !0,
        value: (x) => {
          const g = d.buffer.byteLength / ie;
          if (s === void 0 || Math.ceil(s / ie) > o || g >= o) throw new RangeError(`WebAssembly memory ceiling of ${o * ie} bytes reached`);
          return m(Math.min(x, o - g));
        }
      }), a(c);
    })().catch((u) => n(u instanceof Error ? u : new Error(String(u)))), {};
  };
}
async function ro(e) {
  const { init: t } = await import("./chunk-WNM5TYC5-DPBFlphI.js").then(function(a) {
    return a.c;
  }), { maxMemoryBytes: n, ...o } = e, r = { ...o };
  delete r.guardSeconds;
  try {
    if (n === void 0) return await t(r);
    (!(n > 0) || !Number.isFinite(n)) && C("maxMemoryBytes must be a positive number of bytes.");
    const a = Math.floor(n / ie) * ie;
    if (ue)
      return a !== ue.bytes && C(`The kernel was loaded with a memory ceiling of ${ue.bytes} bytes; it loads once per process or worker.`), await ue.loaded;
    let s = () => {
    };
    const i = new Promise((u, f) => {
      s = f;
    }), l = Promise.race([t({ instantiateWasm: oo(r, n, s) }), i]);
    ue = { bytes: a, loaded: l };
    try {
      const u = await l;
      return De = a, u;
    } catch (u) {
      throw ue = void 0, u;
    }
  } catch (a) {
    throw a instanceof S ? a : new S("invalid-input", `Could not load SMLib: ${a instanceof Error ? a.message : String(a)}`, { cause: a });
  }
}
var lt = (e) => {
  const t = e.tolerance ?? Qn, n = e.angleDeg ?? Jn;
  return j("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function so({ sm: e, solid: t }) {
  return {
    box(n) {
      return j("Box size", ...n), $("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, o) {
      return j("Cylinder radius and height", n, o), $("Cylinder", () => t("Cylinder", e.Cylinder(n, o)));
    },
    cone(n, o, r) {
      return N("Cone radii", n, o), j("Cone height", r), (n < 0 || o < 0 || !(n > 0 || o > 0)) && C("Cone radii must be non-negative and not both zero."), $("Cone", () => t("Cone", n === o ? e.Cylinder(n, r) : e.Cone(n, o, r)));
    },
    sphere(n) {
      return j("Sphere radius", n), $("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, o) {
      return j("Torus radii", n, o), o >= n && C("The tube radius must be smaller than the major radius."), $("Torus", () => t("Torus", e.Torus(n, o)));
    },
    polyhedron(n, o) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(o) || o.length < 4) && C("A polyhedron needs at least four points and four faces.");
      for (const r of n) N("Polyhedron points", r[0], r[1], r[2]);
      for (const r of o) (!Array.isArray(r) || r.length < 3 || r.some((a) => !Number.isInteger(a) || a < 0 || a >= n.length)) && C("Polyhedron faces must index at least three existing points.");
      return $("stitch (polyhedron)", () => e.scope(() => {
        const r = Ln(n, o).map((s) => {
          const i = s.map((l) => K(n[l]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), a = e.stitch(...r);
        return (!(a instanceof e.Part) || !a.isValid()) && C("The polyhedron faces do not close around a valid solid."), re(a);
      }));
    }
  };
}
function Ct(e, t, n) {
  return (Mn(t, n) ?? C("The loft sections cannot be matched vertex to vertex.")).map((r) => new e.Wire(r.map((a, s) => e.Line(K(a), K(r[(s + 1) % r.length])))));
}
var ao = 1e-6, ae = (e) => [e.x, e.y, e.z];
function io(e, t) {
  const n = t.map((i, l) => co(i, l));
  if (n.every((i) => i.every((l) => l.geomType === "line")))
    return Ct(e, n.map((i) => i.map((l) => ae(l.start))), "closest");
  if (n.some((i) => i.length !== n[0].length))
    throw new S("unsupported", `Loft pairing 'closest' matches sections with different edge counts (${n.map((i) => i.length).join(", ")}) only when every edge is straight; these have curved edges. Use pairing 'authored', or give the sections equal edge counts.`);
  const o = (i) => i.some((l, u) => {
    const f = i[(u + i.length - 1) % i.length].tangentAt(1), c = l.tangentAt(0);
    return Math.acos(Math.max(-1, Math.min(1, f.x * c.x + f.y * c.y + f.z * c.z))) > ao;
  });
  if (!n.some(o)) return;
  const r = n.map((i) => ({ pos: lo(i), axis: [0, 0, 1] })), a = $t(n.map((i) => i.map((l) => ae(l.start))), r), s = t.map((i) => !!Ae(i.profile));
  return n.map((i, l) => {
    const { start: u, forward: f } = a[l], c = i.length, d = Array.from({ length: c }, (m, x) => f ? i[(u + x) % c] : i[((u - 1 - x) % c + c) % c]);
    return new e.Wire(d.map((m) => {
      const [x, g] = f ? [m.start, m.end] : [m.end, m.start];
      if (m.geomType === "line") return e.Line(ae(x), ae(g));
      if (m.geomType === "circle") return e.ThreePointArc(ae(x), ae(m.pointAt(0.5)), ae(g));
      if (f && s[l]) return m;
      throw new S("unsupported", `Loft pairing 'closest' would run section ${l + 1} ${f ? "from another vertex" : "the other way round"}, and it has a ${m.geomType} edge, which this kernel re-starts only as drawn in a path profile; it re-starts lines and circular arcs. Use pairing 'authored', or draw the section from the vertex and in the direction it pairs with.`);
    }));
  });
}
function co(e, t) {
  const n = (s) => {
    throw new S("unsupported", `Loft pairing 'closest' needs single-outline sections; section ${t + 1} ${s}. Use pairing 'authored' for it.`);
  };
  let o = Ae(e.profile);
  if (!o) {
    const s = [...B(e.profile).faces()];
    s.length !== 1 && n(`has ${s.length} regions`), [...s[0].innerWires()].length && n("has holes"), o = s[0].outerWire();
  }
  const r = [...o.translate(K(e.at)).edges()], a = (s, i) => Math.hypot(s.x - i.x, s.y - i.y, s.z - i.z) <= 1e-7;
  for (let s = 0; s < r.length; s++) {
    const i = r[s], l = r[(s + 1) % r.length];
    a(i.end, l.start) || n("is not one closed chain of edges"), i.isClosed && r.length > 1 && n("has a closed edge among others");
  }
  return r;
}
function lo(e) {
  let n = 0;
  const o = [0, 0, 0];
  for (const r of e) {
    const a = r.length;
    for (let s = 0; s <= 64; s++) {
      const i = (s === 0 || s === 64 ? 1 : s % 2 ? 4 : 2) * a / 192, l = r.pointAt(s / 64);
      o[0] += i * l.x, o[1] += i * l.y, o[2] += i * l.z;
    }
    n += a;
  }
  return [o[0] / n, o[1] / n, o[2] / n];
}
function fo({ sm: e, solid: t }) {
  return {
    extrude(n, o) {
      return j("Extrusion height", o), $("extrude", () => t("extrude", e.extrude(B(n), o)));
    },
    revolve(n, o) {
      return N("Revolution angle", o), (o === 0 || Math.abs(o) > 360) && C("Revolution angle must be in (0, 360] degrees in magnitude."), $("revolve", () => e.scope(() => {
        const r = B(n).rotate(e.Axis.X, 90), a = e.revolve(r, e.Axis.Z, Math.abs(o));
        return t("revolve", o < 0 ? a.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : a);
      }));
    },
    loft(n, o = {}) {
      (!Array.isArray(n) || n.length < 2) && C("A loft needs at least two sections.");
      for (const a of n) N("Loft section position", ...a.at);
      const r = o.pairing ?? "authored";
      return r !== "authored" && r !== "closest" && C(`Unknown loft pairing '${String(r)}' (authored or closest).`), $("loft", () => e.scope(() => {
        const a = !!o.ruled, s = n.map((f) => Qe(f.profile)?.length), i = s.some((f) => f !== s[0]);
        if (s.every((f) => f !== void 0) && (i || r === "closest"))
          return t("loft", e.loft(Ct(e, n.map((f) => Qe(f.profile).map((c) => [c[0] + f.at[0], c[1] + f.at[1], c[2] + f.at[2]])), r), { ruled: a }));
        if (r === "closest") {
          const f = io(e, n);
          if (f) return t("loft", e.loft(f, { ruled: a }));
        }
        const u = (n.every((f) => Ae(f.profile)) ? n.map((f) => Ae(f.profile).translate(K(f.at))) : void 0) ?? n.map((f) => B(f.profile).translate(K(f.at)));
        return t("loft", e.loft(u, { ruled: a }));
      }));
    },
    sweep(n, o) {
      (!Array.isArray(o) || o.length < 2) && C("A sweep rail needs at least two points.");
      for (const r of o) N("Sweep rail points", ...r);
      return $("sweep", () => e.scope(() => {
        const r = o.map(K), a = r.length === 2 ? e.Line(r[0], r[1]) : e.Polyline(r);
        return t("sweep", e.sweep(B(n), a));
      }));
    }
  };
}
function uo({ sm: e, solid: t }) {
  return {
    union: (n, ...o) => $("fuse", () => t("fuse", o.length ? e.fuse(_(n), ...o.map(_)) : _(n))),
    subtract: (n, ...o) => $("cut", () => t("cut", o.length ? e.cut(_(n), ...o.map(_)) : _(n))),
    intersect: (n, ...o) => $("intersect", () => t("intersect", o.length ? e.intersect(_(n), ...o.map(_)) : _(n))),
    splitByPlane: (n, o, r) => {
      const a = Te("Split normal", o);
      return N("Split offset", r), $("split", () => {
        const [s, i] = e.split(_(n), new e.Plane([a[0] * r, a[1] * r, a[2] * r], void 0, a), "both");
        return [t("split", s), t("split", i)];
      });
    },
    translate: (n, o) => (N("Translation", ...o), $("translate", () => re(_(n).translate(K(o))))),
    rotate: (n, o, r, a = [0, 0, 0]) => {
      const s = Te("Rotation axis", o);
      return N("Rotation angle and pivot", r, ...a), $("rotate", () => re(_(n).rotate(new e.Axis(K(a), s), r)));
    },
    mirror: (n, o, r = [0, 0, 0]) => {
      const a = Te("Mirror normal", o);
      return N("Mirror origin", ...r), $("mirror", () => re(_(n).mirror(new e.Plane(K(r), void 0, a))));
    },
    scale: (n, o) => (N("Scale factors", ...o), o.some((r) => r === 0) && C("A zero scale factor flattens the solid."), $("scale", () => re(_(n).scale(K(o), [0, 0, 0]))))
  };
}
function ho(e) {
  const { sm: t, solid: n, face: o } = e, r = (s, i) => {
    if (i === "all") return s.edges();
    if (i && typeof i == "object" && "edgeIndices" in i) {
      Array.isArray(i.edgeIndices) || C("edgeIndices must be an array of edge indices.");
      try {
        return Zn(s, i.edgeIndices);
      } catch (l) {
        throw l instanceof RangeError && C(l.message), l;
      }
    }
    return o(s, i).edges();
  }, a = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, i, l = "all") => (j("Fillet radius", i), $("fillet", () => n("fillet", t.fillet(r(_(s), l), i)))),
    chamfer: (s, i, l = "all") => (j("Chamfer distance", i), $("chamfer", () => n("chamfer", t.chamfer(r(_(s), l), i)))),
    topology: (s) => $("topology", () => t.scope(() => Yn(_(s)))),
    nameFaces: (s, i) => ((!Array.isArray(i) || i.some((l) => l !== null && typeof l != "string")) && C("Face names must be strings or null."), $("named", () => {
      try {
        return n("named", qn(_(s), i));
      } catch (l) {
        throw l instanceof RangeError && C(l.message), l;
      }
    })),
    shell: (s, i, l) => {
      j("Shell thickness", i);
      const u = l === void 0 ? [] : a(l) ? [l] : [...l];
      return $("shell", () => {
        const f = _(s), c = u.map((d) => o(f, d));
        return n("shell", t.shell(f, -i, c.length ? c : null));
      });
    }
  };
}
function po({ sm: e }) {
  return {
    volume: (t) => $("volume", () => _(t).volume),
    area: (t) => $("area", () => _(t).area),
    // Not SMLib's bbox(): it misses interior extremes of some rotated spheres (see bbox.ts).
    bbox: (t) => $("bbox", () => En(_(t))),
    massProperties: (t) => $("massProperties", () => {
      const n = _(t).massProperties(1), o = n.inertia, r = (l, u) => (o[l][u] + o[u][l]) / 2, a = [[o[0][0], r(0, 1), r(0, 2)], [r(0, 1), o[1][1], r(1, 2)], [r(0, 2), r(1, 2), o[2][2]]], { values: s, vectors: i } = mn(a);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: a, principalMoments: s, principalAxes: i };
    }),
    isValid: (t) => $("isValid", () => _(t).isValid()),
    solidCount: (t) => $("solids", () => e.scope(() => _(t).solids().length)),
    components: (t) => $("solids", () => [..._(t).solids()].map(re))
  };
}
var It = () => {
}, mo = 1e3, go = "ISO-10303-21", yo = /END-ISO-10303-21;\s*$/;
function xo(e) {
  let t = e.length;
  for (; t > 0 && (e.charCodeAt(t - 1) === 0 || e.charCodeAt(t - 1) === 26); ) t--;
  return e.slice(0, t);
}
function wo(e) {
  if (typeof e == "string") return e;
  if (e instanceof Uint8Array) {
    let t = "";
    for (let n = 0; n < e.length; n += 32768) t += String.fromCharCode(...e.subarray(n, n + 32768));
    return t;
  }
  return C("STEP input must be text or bytes (a Uint8Array).");
}
function vo(e, t, n) {
  const o = wo(t);
  o.length || C("STEP input must not be empty."), o.replace(/^\uFEFF|^\xEF\xBB\xBF/, "").trimStart().startsWith(go) || C("This is not a STEP file: it does not start with ISO-10303-21."), yo.test(xo(o)) || C("The STEP file is incomplete: it does not end with END-ISO-10303-21; (was it cut short?).");
  const r = [];
  let a;
  e.setWarningHandler((u) => {
    r.push(String(u));
  });
  try {
    a = e.fromStep(o, { strict: !0 });
  } catch (u) {
    const f = u instanceof Error ? u.message : String(u);
    throw u instanceof e.KernelError ? new S("kernel-failure", `SMLib fromStep failed: ${f}`, { cause: u }) : u instanceof e.ModelingError ? new S("unsupported", /holds no B-rep/.test(f) ? "The STEP file holds no solid (no B-rep body)." : `The STEP file cannot be read exactly: ${f.replace(/^import STEP: /, "")}`, { cause: u }) : new S("invalid-input", `The STEP file is malformed: ${f}`, { cause: u });
  } finally {
    e.setWarningHandler(It);
  }
  const s = Array.isArray(a) ? [...a] : [a], i = () => s.forEach((u) => u?.dispose?.());
  try {
    if (!s.length) throw new S("unsupported", "The STEP file holds no solid (no B-rep body).");
    if (s.length > n) throw new S("unsupported", `The STEP file holds ${s.length} bodies; at most ${n} can be imported.`);
    const u = (f, c) => f.name ? `body ${c + 1} ('${f.name}')` : `body ${c + 1}`;
    s.forEach((f, c) => {
      if (!(f instanceof e.Part)) {
        const x = f instanceof e.Shell ? "an open surface (a sheet), not a closed solid" : `not a solid (${f?.constructor?.name ?? typeof f})`;
        throw new S("unsupported", `The STEP file's ${u(f, c)} is ${x}.`);
      }
      const d = $("isValid", () => f.isValid()), m = d ? $("volume", () => f.volume) : 0;
      if (!d || !(m > 0)) throw new S("unsupported", `The STEP file's ${u(f, c)} is not a valid closed solid, even after repair.`);
    });
  } catch (u) {
    throw i(), u;
  }
  return { bodies: s.map((u) => {
    const f = u.color;
    return { solid: re(u), name: typeof u.name == "string" && u.name ? u.name : null, color: f ? [Number(f[0]), Number(f[1]), Number(f[2])] : null };
  }), notes: r };
}
function Mo({ sm: e, solid: t }) {
  return {
    tessellate: (n, o = {}) => {
      const { tolerance: r, angle: a } = lt(o);
      return $("mesh", () => e.scope(() => {
        const s = _(n).mesh(r, a), i = Float64Array.from(s.vertices), l = Uint32Array.from(s.triangles);
        return { positions: i, normals: gn(i, l), indices: l };
      }));
    },
    exportStl: (n, o = {}) => {
      const { tolerance: r, angle: a } = lt(o);
      return $("toStl", () => e.toStl(_(n), { tolerance: r, angle: a }));
    },
    exportStep: (n) => $("toStep", () => e.toStep(_(n))),
    importStep: (n) => ((typeof n != "string" || !n.length) && C("STEP input must be non-empty text."), $("fromStep", () => {
      const o = e.fromStep(n);
      if (Array.isArray(o) && o.length && o.every((r) => r instanceof e.Part)) {
        const r = o;
        return t("fromStep", r.length === 1 ? r[0] : e.fuse(r[0], ...r.slice(1)));
      }
      return t("fromStep", o);
    })),
    importStepBodies: (n, o = {}) => {
      const r = o.maxBodies ?? mo;
      return (!Number.isInteger(r) || r < 1) && C("maxBodies must be a positive whole number."), vo(e, n, r);
    }
  };
}
async function bo(e = {}) {
  const t = await ro(e);
  e.guardSeconds !== void 0 && (e.guardSeconds >= 0 || C("guardSeconds must be 0 or more."), t.setGuardSeconds(e.guardSeconds)), t.setWarningHandler(It);
  const n = yn(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: eo,
    profile: Gn(t),
    ...so(n),
    ...fo(n),
    ...uo(n),
    ...ho(n),
    ...po(n),
    ...Mo(n),
    memory: () => {
      const o = t.memoryUsage();
      return { used: o.used, heap: o.heap, handles: o.handles };
    },
    scope: (o) => t.scope(o),
    setGuardSeconds: (o) => (Number(o) >= 0 || C("The guard must be 0 or more seconds."), t.setGuardSeconds(o)),
    guardSeconds: () => t.GUARD_SECONDS,
    ...De !== void 0 ? { maxMemoryBytes: De } : {}
  };
}
const Eo = "@crispcad/exact-kernel", So = "0.1.9", To = "smlib", $o = Object.freeze({ id: To, package: Eo, version: So }), ft = 16, ut = 2048, O = (e) => {
  throw new S("unsupported", e);
}, le = (e) => {
  throw new S("invalid-input", e);
};
function ce(e, t) {
  t < ft && O(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${ft}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const Ao = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], je = (e, t) => {
  const n = [];
  for (let o = 0; o < 3; o++)
    for (let r = 0; r < 4; r++)
      n.push(e[o * 4] * t[r] + e[o * 4 + 1] * t[4 + r] + e[o * 4 + 2] * t[8 + r] + (r === 3 ? e[o * 4 + 3] : 0));
  return n;
}, de = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), dt = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], Po = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function $e(e, t) {
  const n = Math.hypot(...e);
  n > 0 || le("Rotation axis must be non-zero.");
  const [o, r, a] = e.map((f) => f / n), s = t * Math.PI / 180, i = Math.cos(s), l = Math.sin(s), u = 1 - i;
  return [u * o * o + i, u * o * r - l * a, u * o * a + l * r, 0, u * o * r + l * a, u * r * r + i, u * r * a - l * o, 0, u * o * a - l * r, u * r * a + l * o, u * a * a + i, 0];
}
const Co = (e) => je($e([0, 0, 1], e[2]), je($e([0, 1, 0], e[1]), $e([1, 0, 0], e[0])));
function Io(e) {
  const t = Math.hypot(...e);
  t > 0 || le("Mirror normal must be non-zero.");
  const [n, o, r] = e.map((a) => a / t);
  return [1 - 2 * n * n, -2 * n * o, -2 * n * r, 0, -2 * n * o, 1 - 2 * o * o, -2 * o * r, 0, -2 * n * r, -2 * o * r, 1 - 2 * r * r, 0];
}
function zo(e) {
  const [t, n, o, , r, a, s, , i, l, u] = e, f = Math.max(-1, Math.min(1, (t + a + u - 1) / 2)), c = Math.acos(f);
  if (c < 1e-15)
    return null;
  let d = [l - s, o - i, r - n];
  return Math.hypot(...d) < 1e-9 && (d = [[t + 1, r, i], [n, a + 1, l], [o, s, u + 1]].reduce((x, g) => Math.hypot(...g) > Math.hypot(...x) ? g : x)), { axis: d, degrees: c * 180 / Math.PI };
}
function _o(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && le("Affine matrix is singular.");
  for (const [s, i] of [[0, 1], [0, 2], [1, 2]]) {
    const l = t[s][0] * t[i][0] + t[s][1] * t[i][1] + t[s][2] * t[i][2];
    Math.abs(l) > 1e-9 * n[s] * n[i] && O("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const o = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), r = [n[0], n[1], o < 0 ? -n[2] : n[2]], a = [0, 1, 2].flatMap((s) => [e[s * 4] / r[0], e[s * 4 + 1] / r[1], e[s * 4 + 2] / r[2], 0]);
  return { scale: r, rotation: a, translate: [e[3], e[7], e[11]] };
}
function zt(e, t, n, o) {
  const r = e.map((s, i) => {
    if (!s)
      return 0;
    const l = o[i] - n[i];
    return l < 1e-12 && le("Cannot resize a degenerate shape."), s / l;
  }), a = Math.max(...r) || 1;
  return r.map((s, i) => e[i] ? s : t?.[i] ? a : 1);
}
function Q(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return ce("circle2d", t.segments), e.profile.circle(t.radius);
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
      const [o, r, a, s, i, l] = t.matrix, u = Math.hypot(o, s), f = Math.hypot(r, i);
      u > 1e-12 && f > 1e-12 || le("2D affine matrix is singular."), Math.abs(o * r + s * i) > 1e-9 * u * f && O("2D affine transforms with shear have no exact lowering here.");
      const c = o * i - r * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [u, c < 0 ? -f : f]), Math.atan2(s, o) * 180 / Math.PI), [a, l]);
    }
    case "resize": {
      const n = Q(e, t.profile);
      if (!n)
        return null;
      const o = e.profile.bounds(n), r = zt(t.size, t.auto, o.min, o.max);
      return e.profile.scale(n, [r[0], r[1]]);
    }
    case "offset": {
      t.round && ce("offset2d", t.segments);
      const n = Q(e, t.profile);
      return n && e.profile.offset(n, t.distance, t.round);
    }
    case "text":
      return O("text2d needs a font outline path, and the exact kernel package ships no font.");
    case "minkowski":
      return O("minkowski2d has no exact lowering (planar Minkowski sums of curved profiles are not exposed by this kernel adapter).");
    case "union":
    case "subtract":
    case "intersect":
    case "hull": {
      const n = t.profiles.map((a) => Q(e, a)), o = n.filter((a) => a !== null);
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
      return O(`Profile '${t.kind}' has no exact lowering.`);
  }
}
function he(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, o = e.center ? -t / 2 : 0, r = e.center ? -n / 2 : 0;
      return [[o, r], [o + t, r], [o + t, r + n], [o, r + n]];
    }
    case "move":
      return he(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return he(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), o = Math.sin(t);
      return he(e.profile).map(([r, a]) => [n * r - o * a, o * r + n * a]);
    }
    case "affine": {
      const t = e.matrix;
      return he(e.profile).map(([n, o]) => [t[0] * n + t[1] * o + t[2], t[3] * n + t[4] * o + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(he);
    case "empty":
      return [];
    default:
      return O(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function Xe(e, t, n) {
  const o = (r, a) => Xe(a, je(t, r), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const r of e.shapes)
        Xe(r, t, n);
      return;
    case "move":
      return o(dt(e.vector), e.shape);
    case "rotate":
      return o(Co(e.vector), e.shape);
    case "scale":
      return o(Po(e.vector), e.shape);
    case "mirror":
      return o(Io(e.vector), e.shape);
    case "axisRotate":
      return o($e(e.vector, e.angle), e.shape);
    case "affine":
      return o(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let r = 0; r < e.count; r++)
        o(dt(e.step.map((a) => a * r)), e.shape);
      return;
    case "box": {
      const [r, a, s] = e.size.map((i) => i / 2);
      for (const i of [-r, r])
        for (const l of [-a, a])
          for (const u of [-s, s])
            n.points.push(de(t, [i, l, u]));
      return;
    }
    case "polyhedron":
      for (const r of e.points)
        n.points.push(de(t, r));
      return;
    case "extrude":
      for (const [r, a] of e.points)
        for (const s of [0, e.height])
          n.points.push(de(t, [r, a, s]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && O("hull of a twisted extrusion has no exact lowering.");
      for (const [r, a] of he(e.profile))
        n.points.push(de(t, [r, a, 0])), n.points.push(de(t, [r * e.scaleTop[0], a * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      ce("sphere", e.segments);
      const r = [0, 1, 2].map((a) => Math.hypot(t[a], t[4 + a], t[8 + a]));
      Math.max(...r) - Math.min(...r) > 1e-12 * Math.max(...r) && O("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: de(t, [0, 0, 0]), radius: e.radius * r[0] });
      return;
    }
    default:
      O(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function Bo(e, t) {
  const n = { points: [], spheres: [] };
  for (const d of t)
    Xe(d, Ao, n);
  if (n.points.length && n.spheres.length && O("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const d = Pt(n.points);
    return e.polyhedron(d.points, d.faces);
  }
  if (!n.spheres.length)
    return null;
  const o = n.spheres[0].radius;
  n.spheres.some((d) => Math.abs(d.radius - o) > 1e-12 * o) && O("hull of spheres with different radii has no exact lowering.");
  const r = n.spheres.map((d) => d.centre), a = [0, 1, 2].map((d) => Math.min(...r.map((m) => m[d]))), s = [0, 1, 2].map((d) => Math.max(...r.map((m) => m[d]))), i = s.map((d, m) => d - a[m]), l = 1e-9 * Math.max(1, ...i);
  if (i.every((d) => d <= l))
    return e.translate(e.sphere(o), a);
  const u = (d) => [d & 1 ? s[0] : a[0], d & 2 ? s[1] : a[1], d & 4 ? s[2] : a[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((d) => r.some((m) => m.every((x, g) => Math.abs(x - u(d)[g]) <= l))) || i.some((d) => d <= l)) && O("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const c = e.box(i.map((d) => d + 2 * o));
  return e.translate(e.fillet(c, o, "all"), a.map((d, m) => d + i[m] / 2));
}
function _t(e, t, n) {
  const o = e.profile.bounds(t), r = o.max[0] <= 0;
  o.min[0] < -1e-8 && !r && le("Revolved profiles must stay on one side of the radial axis.");
  const a = Math.abs(n);
  a > 360 && le("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(r ? e.profile.scale(t, [-1, 1]) : t, n);
  return r && a !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function No(e, t, n) {
  const { scale: o, rotation: r, translate: a } = _o(n);
  let s = o.every((l) => Math.abs(l - 1) < 1e-15) ? t : e.scale(t, o);
  const i = zo(r);
  return i && (s = e.rotate(s, i.axis, i.degrees)), a.some((l) => l !== 0) ? e.translate(s, a) : s;
}
function He(e, t) {
  const n = (o) => He(e, o);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return ce("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return ce("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return ce("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && O("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && O("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const o = Q(e, t.profile);
      return o && e.extrude(o, t.height);
    }
    case "revolve": {
      if (ce("revolve", t.segments), t.angle === 0)
        return null;
      const o = Q(e, t.profile);
      return o && _t(e, o, t.angle);
    }
    case "polyhedron": {
      if (t.smooth)
        return Ro(e, t.smooth);
      if (t.ruled)
        return Oo(e, t.ruled, t.points, t.faces);
      if (t.faces.length > ut && O(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${ut} faces).`), Xn(t.points, t.faces)) {
        const o = Pt(t.points);
        return e.polyhedron(o.points, o.faces);
      }
      return e.polyhedron(t.points, t.faces);
    }
    case "union":
    case "subtract":
    case "intersect": {
      const o = (l) => l.kind === "union" ? l.shapes.flatMap(o) : [l], a = (t.kind === "subtract" ? [t.shapes[0], ...t.shapes.slice(1).flatMap(o)] : t.shapes).map(n), s = a.filter((l) => l !== null);
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
      return Bo(e, t.shapes);
    case "minkowski":
      return O("minkowski has no exact lowering (a general Minkowski sum is not a B-rep operation of this adapter; use fillet/offset intent instead).");
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
      return o && No(e, o, t.matrix.slice(0, 12));
    }
    case "resize": {
      const o = n(t.shape);
      if (!o)
        return null;
      const r = e.bbox(o);
      return e.scale(o, zt(t.vector, t.auto, r.min, r.max));
    }
    case "repeat": {
      const o = t.count >= 1 ? n(t.shape) : null;
      if (!o)
        return null;
      const r = Array.from({ length: t.count }, (a, s) => s === 0 ? o : e.translate(o, t.step.map((i) => i * s)));
      return r.length > 1 ? e.union(r[0], ...r.slice(1)) : r[0];
    }
    default:
      return O(`CAD Script '${t.kind}' has no exact lowering.`);
  }
}
function Fo(e, t) {
  let n = 0;
  for (const o of t)
    for (let r = 1; r + 1 < o.length; r++) {
      const a = e[o[0]], s = e[o[r]], i = e[o[r + 1]];
      n += a[0] * (s[1] * i[2] - s[2] * i[1]) - a[1] * (s[0] * i[2] - s[2] * i[0]) + a[2] * (s[0] * i[1] - s[1] * i[0]);
    }
  return n / 6;
}
function Oo(e, t, n, o) {
  const r = e.loft(t.map((i) => ({ profile: e.profile.polygon([i.map((l) => [l[0], l[1]])]), at: [0, 0, i[0][2]] })), { ruled: !0 }), a = Fo(n, o), s = e.volume(r);
  if (!(Math.abs(s - a) <= 1e-7 * Math.abs(a)))
    throw r.dispose(), new S("kernel-failure", `The ruled loft's volume ${s} differs from its faceted volume ${a}; the kernel did not keep the vertex correspondence.`);
  return r;
}
function Ro(e, t) {
  const n = e.loft(t.map((a) => ({ profile: e.profile.polygon([a.map((s) => [s[0], s[1]])]), at: [0, 0, a[0][2]] })), { ruled: !1 }), o = Wt(Ht(t)), r = e.volume(n);
  if (!(Math.abs(r - o) <= 1e-7 * Math.abs(o)))
    throw n.dispose(), new S("kernel-failure", `The smooth loft's volume ${r} differs from the volume ${o} of the surface CAD Script defines; the kernel built another surface.`);
  return n;
}
function vr(e, t) {
  let n;
  try {
    n = bt(t).shape;
  } catch (r) {
    throw r instanceof kt ? new S("invalid-input", `CAD Script: ${r.message}`, { cause: r }) : r;
  }
  const o = e.scope(() => He(e, n));
  if (!o)
    throw new S("invalid-input", "The program produces no solid.");
  if (!(e.volume(o) > 0))
    throw o.dispose(), new S("kernel-failure", "The exact result has no positive volume.");
  return o;
}
const Mr = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} }), ge = 1048576, Bt = 4, Lo = Object.freeze({ maxFeatureEdges: 400, maxShellFaces: 160, maxMemoryBytes: 512 * ge, recycleAboveBytes: 192 * ge, requestTimeoutMs: 6e4, maxStepImportBytes: 4 * ge }), br = Object.freeze({ maxFeatureEdges: 1e3, maxShellFaces: 500, maxMemoryBytes: 2048 * ge, recycleAboveBytes: 512 * ge, requestTimeoutMs: 12e4, maxStepImportBytes: 16 * ge }), Er = Object.freeze({ maxFeatureEdges: 1 / 0, maxShellFaces: 1 / 0, maxMemoryBytes: 1 / 0, recycleAboveBytes: 1 / 0, requestTimeoutMs: 1 / 0, maxStepImportBytes: 1 / 0 });
function Sr(e, t = Lo) {
  const n = { ...t };
  for (const o of Object.keys(t)) {
    const r = e?.[o];
    typeof r == "number" && r > 0 && (n[o] = r);
  }
  return Object.freeze(n);
}
function Do(e) {
  const t = e.requestTimeoutMs;
  return Number.isFinite(t) && t > 0 ? Math.max(1, Math.floor(t / 2e3)) : void 0;
}
function jo(e) {
  const t = Do(e);
  return { ...Number.isFinite(e.maxMemoryBytes) && e.maxMemoryBytes > 0 ? { maxMemoryBytes: e.maxMemoryBytes } : {}, ...t !== void 0 ? { guardSeconds: t } : {} };
}
const Xo = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
};
function Uo(e, t) {
  const [n, o, r] = t.faceNormal, a = Math.hypot(n, o, r);
  if (!(a > 0))
    return;
  const s = [n / a, o / a, r / a], i = e.filter((u) => {
    if (u.isPlanar === !1 || u.isPlanar === void 0 && u.geomType !== "plane")
      return !1;
    const f = u.normalAt();
    return f.x * s[0] + f.y * s[1] + f.z * s[2] > 1 - 1e-9;
  });
  if (!t.outermost)
    return i.length === 1 ? i[0] : void 0;
  const l = (u) => {
    const f = u.center?.();
    return f ? f.x * s[0] + f.y * s[1] + f.z * s[2] : 0;
  };
  return i.sort((u, f) => l(f) - l(u))[0];
}
function ko(e, t, n = "all") {
  const o = Xo(e);
  if (!o)
    return;
  const r = [...o.faces()];
  let a;
  if (t !== "shell" && n !== "all" && "edgeIndices" in n) {
    if (!o.edges)
      return;
    const l = [...o.edges()];
    a = n.edgeIndices.map((u) => l[u]).filter(Boolean);
  } else if (t !== "shell" && n !== "all") {
    const l = Uo(r, n);
    if (!l)
      return { edges: 0, curvedEdges: 0, faces: r.length, weightedEdges: 0 };
    a = l.edges();
  } else if (o.edges)
    a = o.edges();
  else {
    const l = /* @__PURE__ */ new Map();
    let u = 0;
    for (const f of r)
      for (const c of f.edges())
        l.set(c._identity?.() ?? String(u++), c);
    a = l.values();
  }
  let s = 0, i = 0;
  for (const l of a)
    s++, l.geomType !== "line" && i++;
  return { edges: s, curvedEdges: i, faces: r.length, weightedEdges: s - i + Bt * i };
}
function Wo(e, t, n, o) {
  if (!Number.isFinite(o.maxFeatureEdges) && !Number.isFinite(o.maxShellFaces))
    return;
  const r = ko(e, t, n);
  if (r) {
    if (t === "shell") {
      if (r.faces > o.maxShellFaces)
        throw new S("unsupported", P`Shelling a body with ${r.faces} faces is too much for the exact kernel on this device, which allows ${o.maxShellFaces}. Shell a simpler body, or add the holes after shelling.`);
    } else if (r.weightedEdges > o.maxFeatureEdges) {
      const a = Math.floor(o.maxFeatureEdges / Bt), s = o.maxFeatureEdges;
      throw new S("unsupported", t === "fillet" ? P`Rounding ${r.edges} edges (${r.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${a} curved or ${s} straight edges per feature. Choose a face with fewer edges.` : P`Beveling ${r.edges} edges (${r.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${a} curved or ${s} straight edges per feature. Choose a face with fewer edges.`);
    }
    return r;
  }
}
const Ho = 8, G = (e, t, n) => (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x), we = (e, t) => e.x === t.x && e.y === t.y;
function Go(e, t) {
  let n = 0;
  for (let o = 0, r = t.length - 1; o < t.length; r = o++)
    n += e[2 * t[r]] * e[2 * t[o] + 1] - e[2 * t[o]] * e[2 * t[r] + 1];
  return n / 2;
}
function ht(e, t, n) {
  let o, r;
  for (const a of t) {
    const s = { i: a, x: e[2 * a], y: e[2 * a + 1], removed: !1 };
    o ? (r.next = s, s.prev = r) : o = s, r = s, n.push(s);
  }
  return r.next = o, o.prev = r, o;
}
function Ne(e, t) {
  const n = e.prev, o = e.next;
  return G(n, e, o) >= 0 ? G(e, o, t) > 0 && G(e, t, n) > 0 : !(G(e, n, t) > 0 && G(e, t, o) > 0);
}
function Nt(e, t, n, o, r) {
  const a = G(e, t, o), s = G(t, n, o), i = G(n, e, o);
  return r ? a > 0 && s > 0 && i > 0 : a >= 0 && s >= 0 && i >= 0;
}
function Ko(e, t, n) {
  const o = { ...e }, r = { ...t }, a = e.next, s = t.prev;
  e.next = t, t.prev = e, o.next = a, a.prev = o, r.next = o, o.prev = r, s.next = r, r.prev = s, n.push(o, r);
}
function Vo(e, t) {
  let n, o = 1 / 0, r = t;
  do {
    const u = r.next;
    if (r.y <= e.y && e.y < u.y || u.y <= e.y && e.y < r.y) {
      const f = r.y === e.y ? r.x : u.y === e.y ? u.x : r.x + (e.y - r.y) * (u.x - r.x) / (u.y - r.y);
      if (f === e.x)
        return;
      f > e.x && f < o && (o = f, n = r.y === e.y ? r : u.y === e.y ? u : r.x > u.x ? r : u);
    }
    r = u;
  } while (r !== t);
  if (!n)
    return;
  const a = { x: o, y: e.y };
  let s = n, i = -1 / 0, l = 1 / 0;
  if (n.x !== o || n.y !== e.y) {
    i = (n.x - e.x) / Math.hypot(n.x - e.x, n.y - e.y), l = Math.hypot(n.x - e.x, n.y - e.y);
    const [u, f, c] = G(e, a, n) > 0 ? [e, a, n] : [e, n, a];
    r = t;
    do {
      if (r !== n && !we(r, n) && Nt(u, f, c, r, !1) && !(r.x === e.x && r.y === e.y)) {
        const d = Math.hypot(r.x - e.x, r.y - e.y), m = (r.x - e.x) / d;
        (m > i || m === i && d < l) && Ne(r, e) && (s = r, i = m, l = d);
      }
      r = r.next;
    } while (r !== t);
  }
  if (!Ne(s, e)) {
    r = t;
    do {
      if (we(r, s) && Ne(r, e))
        return r;
      r = r.next;
    } while (r !== t);
    return;
  }
  return s;
}
function Yo(e, t) {
  if (!t.length || t.some((w) => w.length < 3))
    return null;
  const n = [], o = t.map((w) => Go(e, w));
  if (!(Math.abs(o[0]) > 0))
    return null;
  const r = t.map((w, E) => E === 0 == o[E] > 0 ? w : [...w].reverse()), a = ht(e, r[0], n), s = r.slice(1).map((w) => {
    const E = ht(e, w, n);
    let T = E, z = E.next;
    for (; z !== E; )
      (z.x > T.x || z.x === T.x && z.y > T.y) && (T = z), z = z.next;
    return T;
  });
  s.sort((w, E) => E.x - w.x || E.y - w.y);
  for (const w of s) {
    const E = Vo(w, a);
    if (!E)
      return null;
    Ko(E, w, n);
  }
  let i = 1 / 0, l = 1 / 0, u = -1 / 0, f = -1 / 0;
  for (const w of n)
    w.x < i && (i = w.x), w.y < l && (l = w.y), w.x > u && (u = w.x), w.y > f && (f = w.y);
  const c = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(n.length / 2)))), d = (u - i) / c || 1, m = (f - l) / c || 1, x = (w, E, T) => Math.min(c - 1, Math.max(0, Math.floor((w - E) / T))), g = Array.from({ length: c * c }, () => []);
  for (const w of n)
    g[x(w.y, l, m) * c + x(w.x, i, d)].push(w);
  const p = (w, E) => {
    const T = w.prev, z = w.next, q = G(T, w, z);
    if (E ? q < 0 : q <= 0)
      return !1;
    const te = x(Math.min(T.x, w.x, z.x), i, d), k = x(Math.max(T.x, w.x, z.x), i, d), Dt = x(Math.min(T.y, w.y, z.y), l, m), jt = x(Math.max(T.y, w.y, z.y), l, m);
    for (let ze = Dt; ze <= jt; ze++)
      for (let _e = te; _e <= k; _e++)
        for (const ne of g[ze * c + _e])
          if (!(ne.removed || ne === T || ne === w || ne === z || we(ne, T) || we(ne, w) || we(ne, z)) && Nt(T, w, z, ne, !1))
            return !1;
    return !0;
  }, h = [];
  let y = a, M = y, b = !1, v = 0;
  {
    let w = a;
    do
      v++, w = w.next;
    while (w !== a);
  }
  for (; v > 3; ) {
    if (p(y, b)) {
      h.push(y.prev.i, y.i, y.next.i), y.removed = !0, y.prev.next = y.next, y.next.prev = y.prev, v--, y = y.next, M = y, b = !1;
      continue;
    }
    if (y = y.next, y === M) {
      if (b)
        return null;
      b = !0;
    }
  }
  if (G(y.prev, y, y.next) < 0)
    return null;
  h.push(y.prev.i, y.i, y.next.i);
  const A = o.reduce((w, E, T) => w + (T === 0 ? Math.abs(E) : -Math.abs(E)), 0);
  let I = 0;
  for (let w = 0; w < h.length; w += 3) {
    const E = h[w], T = h[w + 1], z = h[w + 2];
    I += ((e[2 * T] - e[2 * E]) * (e[2 * z + 1] - e[2 * E + 1]) - (e[2 * T + 1] - e[2 * E + 1]) * (e[2 * z] - e[2 * E])) / 2;
  }
  return Math.abs(I - A) <= 1e-9 * Math.abs(o[0]) + 1e-12 ? h : null;
}
const Ft = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
}, Ie = class Ie {
  constructor() {
    fe(this, "positions", []);
    fe(this, "cells", /* @__PURE__ */ new Map());
  }
  add(t, n, o) {
    const r = Ie.Q, a = Math.round(t / r), s = Math.round(n / r), i = Math.round(o / r);
    let l = this.cells.get(`${a},${s},${i}`);
    if (l !== void 0)
      return l;
    const u = t / r - a, f = n / r - s, c = o / r - i, d = Math.abs(u) > 0.4 ? Math.sign(u) : 0, m = Math.abs(f) > 0.4 ? Math.sign(f) : 0, x = Math.abs(c) > 0.4 ? Math.sign(c) : 0;
    if (d || m || x) {
      for (const g of d ? [0, d] : [0])
        for (const p of m ? [0, m] : [0])
          for (const h of x ? [0, x] : [0])
            if (l = this.cells.get(`${a + g},${s + p},${i + h}`), l !== void 0)
              return this.cells.set(`${a},${s},${i}`, l), l;
    }
    return l = this.positions.length / 3, this.positions.push(t, n, o), this.cells.set(`${a},${s},${i}`, l), l;
  }
};
fe(Ie, "Q", 1e-6);
let Ue = Ie;
function qo(e) {
  const t = Ft(e);
  if (!t)
    return !1;
  for (const n of t.faces())
    if (n.geomType === "plane" && n.wires().length >= Ho)
      return !0;
  return !1;
}
function Zo(e, t, n) {
  const o = Ft(t);
  if (!o)
    return;
  const r = [...o.faces()], a = new Ue(), s = [], i = /* @__PURE__ */ new Map(), l = (d) => {
    const m = new Uint32Array(d.vertices.length / 3);
    for (let p = 0; p < m.length; p++)
      m[p] = a.add(d.vertices[3 * p], d.vertices[3 * p + 1], d.vertices[3 * p + 2]);
    const x = /* @__PURE__ */ new Set(), g = [];
    for (let p = 0; p < d.triangles.length; p += 3) {
      const h = m[d.triangles[p]], y = m[d.triangles[p + 1]], M = m[d.triangles[p + 2]];
      h === y || y === M || M === h || (s.push(h, y, M), x.add(`${h},${y}`), x.add(`${y},${M}`), x.add(`${M},${h}`));
    }
    for (const p of x) {
      const [h, y] = p.split(",").map(Number);
      x.has(`${y},${h}`) || g.push([h, y]);
    }
    return g;
  }, u = [];
  let f = 0;
  for (const d of r) {
    if (d.geomType === "plane") {
      u.push(d);
      continue;
    }
    const m = n.bands !== !1 ? Qo(d, n) : void 0;
    m && f++, i.set(d._identity(), l(m ?? d.mesh(n.tolerance, n.angleDeg)));
  }
  let c = 0;
  for (const d of u) {
    const m = Jo(d, a, i), x = d.normalAt(), g = [x.x, x.y, x.z], p = Math.abs(g[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], h = Ge(ye(p, g)), y = ye(g, h);
    let M = null;
    if (m && m.length === d.wires().length) {
      const b = [...new Set(m.flat())], v = new Map(b.map((w, E) => [w, E])), A = new Float64Array(2 * b.length);
      b.forEach((w, E) => {
        const T = a.positions;
        A[2 * E] = T[3 * w] * h[0] + T[3 * w + 1] * h[1] + T[3 * w + 2] * h[2], A[2 * E + 1] = T[3 * w] * y[0] + T[3 * w + 1] * y[1] + T[3 * w + 2] * y[2];
      });
      const I = Yo(A, m.map((w) => w.map((E) => v.get(E))));
      I && (M = I.map((w) => b[w]));
    }
    M ? s.push(...M) : (c++, l(d.mesh(n.tolerance, n.angleDeg)));
  }
  return { positions: a.positions, indices: s, planar: u.length - c, planarFallbacks: c, bands: f };
}
function Qo(e, t) {
  if (e.geomType !== "cylinder")
    return;
  const n = [...e.edges()];
  if (n.length !== 2)
    return;
  for (const b of n)
    if (b.geomType !== "circle" || !b.isClosed || ![...b.faces()].every((v) => v.geomType === "plane" || v._identity() === e._identity()))
      return;
  const o = n[0].radius, r = n[0].arcCenter, a = n[1].arcCenter;
  if (!(o > 0) || Math.abs(n[1].radius - o) > 1e-9 * Math.max(1, o) || Math.abs(e.radius - o) > 1e-7 * Math.max(1, o))
    return;
  const s = [a.x - r.x, a.y - r.y, a.z - r.z], i = Math.hypot(s[0], s[1], s[2]);
  if (!(i > 0))
    return;
  const l = s.map((b) => b / i);
  for (const b of n) {
    const v = b.normal;
    if (Math.abs(v.x * l[0] + v.y * l[1] + v.z * l[2]) < 1 - 1e-9)
      return;
  }
  const u = Math.acos(Math.max(-1, 1 - t.tolerance / o)), f = Math.max(8, Math.ceil(360 / t.angleDeg), Math.ceil(Math.PI / Math.max(u, 1e-9)));
  if (f > 4096)
    return;
  const c = Math.abs(l[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], d = Ge(ye(c, l)), m = ye(l, d), x = new Float64Array(6 * f), g = new Uint32Array(6 * f);
  for (let b = 0; b < f; b++) {
    const v = 2 * Math.PI * b / f, A = Math.cos(v), I = Math.sin(v);
    for (let w = 0; w < 3; w++) {
      const E = o * (A * d[w] + I * m[w]);
      x[3 * b + w] = [r.x, r.y, r.z][w] + E, x[3 * (f + b) + w] = [a.x, a.y, a.z][w] + E;
    }
  }
  const p = [x[0], x[1], x[2]], h = e.normalAt(p), y = [p[0] - r.x, p[1] - r.y, p[2] - r.z], M = h.x * y[0] + h.y * y[1] + h.z * y[2] > 0;
  for (let b = 0; b < f; b++) {
    const v = b, A = (b + 1) % f, I = f + v, w = f + A;
    M ? g.set([v, A, w, v, w, I], 6 * b) : g.set([v, w, A, v, I, w], 6 * b);
  }
  return { vertices: x, triangles: g };
}
const ye = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], Ge = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return e.map((n) => n / t);
};
function Jo(e, t, n) {
  const o = e._identity(), r = e.normalAt(), a = /* @__PURE__ */ new Set(), s = t.positions;
  let i;
  const l = /* @__PURE__ */ new Set();
  for (const v of e.edges()) {
    const A = [...v.faces()].filter((w) => w._identity() !== o);
    if (A.length !== 1)
      return;
    const I = A[0];
    if (I.geomType === "plane") {
      if (!(v._isStraight ? v._isStraight() : v.geomType === "line"))
        return;
      const w = v.start, E = v.end, T = t.add(w.x, w.y, w.z), z = t.add(E.x, E.y, E.z);
      i ?? (i = r.x * w.x + r.y * w.y + r.z * w.z), T !== z && a.add(T < z ? `${T},${z}` : `${z},${T}`);
    } else if (l.add(I._identity()), i === void 0) {
      const w = v.start;
      i = r.x * w.x + r.y * w.y + r.z * w.z;
    }
  }
  if (i === void 0)
    return;
  const u = 2e-5 + 1e-9 * Math.abs(i), f = (v) => Math.abs(r.x * s[3 * v] + r.y * s[3 * v + 1] + r.z * s[3 * v + 2] - i) <= u;
  for (const v of l) {
    const A = n.get(v);
    if (!A)
      return;
    for (const [I, w] of A)
      f(I) && f(w) && a.add(I < w ? `${I},${w}` : `${w},${I}`);
  }
  const c = /* @__PURE__ */ new Map();
  for (const v of a) {
    const [A, I] = v.split(",").map(Number);
    for (const [w, E] of [[A, I], [I, A]]) {
      const T = c.get(w);
      T ? T.push(E) : c.set(w, [E]);
    }
  }
  for (const v of c.values())
    if (v.length !== 2)
      return;
  const d = [], m = /* @__PURE__ */ new Set();
  for (const v of c.keys()) {
    if (m.has(v))
      continue;
    const A = [v];
    m.add(v);
    let I = v, w = c.get(v)[0];
    for (; w !== v; ) {
      if (m.has(w))
        return;
      A.push(w), m.add(w);
      const [E, T] = c.get(w), z = E === I ? T : E;
      I = w, w = z;
    }
    if (A.length < 3)
      return;
    d.push(A);
  }
  const x = Math.abs(r.x) < 0.9 ? [1, 0, 0] : [0, 1, 0], g = [r.x, r.y, r.z], p = Ge(ye(x, g)), h = ye(g, p), y = (v) => {
    let A = 0;
    for (let I = 0, w = v.length - 1; I < v.length; w = I++) {
      const E = v[w], T = v[I], z = s[3 * E] * p[0] + s[3 * E + 1] * p[1] + s[3 * E + 2] * p[2], q = s[3 * E] * h[0] + s[3 * E + 1] * h[1] + s[3 * E + 2] * h[2], te = s[3 * T] * p[0] + s[3 * T + 1] * p[1] + s[3 * T + 2] * p[2], k = s[3 * T] * h[0] + s[3 * T + 1] * h[1] + s[3 * T + 2] * h[2];
      A += z * k - te * q;
    }
    return Math.abs(A);
  }, M = d.map(y), b = M.indexOf(Math.max(...M));
  return [d[b], ...d.filter((v, A) => A !== b)];
}
const Fe = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function pt(e, t) {
  const n = [], o = [], r = /* @__PURE__ */ new Map(), a = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < a.length; i++) {
    const l = Fe(e.positions[3 * i]), u = Fe(e.positions[3 * i + 1]), f = Fe(e.positions[3 * i + 2]), c = `${l},${u},${f}`;
    let d = r.get(c);
    d === void 0 && (d = n.length / 3, r.set(c, d), n.push(l, u, f)), a[i] = d;
  }
  const s = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.indices.length; i += 3) {
    const l = a[e.indices[i]], u = a[e.indices[i + 1]], f = a[e.indices[i + 2]];
    if (!(l === u || u === f || f === l)) {
      o.push(l, u, f);
      for (const [c, d] of [[l, u], [u, f], [f, l]])
        s.set(`${c},${d}`, (s.get(`${c},${d}`) ?? 0) + 1);
    }
  }
  for (const [i, l] of s) {
    const [u, f] = i.split(",");
    if (l !== 1 || s.get(`${f},${u}`) !== 1)
      throw new S("kernel-failure", P`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > Gt || o.length > Kt)
    throw new S("unsupported", P`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (o.length < 12)
    throw new S("kernel-failure", P`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: o };
}
function Ot(e, t, n) {
  if (qo(t))
    for (const o of [!0, !1])
      try {
        const r = Zo(e, t, { ...Ke, bands: o });
        if (!r)
          break;
        if (r.bands && r.planarFallbacks)
          continue;
        return pt(r, n);
      } catch (r) {
        if (r instanceof S && r.code === "unsupported")
          throw r;
      }
  return pt(e.tessellate(t, Ke), n);
}
function er(e, t, n, o = {}) {
  const r = t.nodes[n];
  if (r?.kind !== "exact-feature")
    throw new S("invalid-input", P`${n} is not an exact feature`);
  const a = Lt(e, t, n, { local: !0, limits: o.limits, breps: o.breps });
  if (!e.isValid(a))
    throw new S("kernel-failure", P`${r.name}: the exact result is not a valid closed solid.`);
  const s = Ot(e, a, r.name);
  return { display: { sourceKey: Vt(t, n), ...s }, volume: e.volume(a) };
}
const mt = 1e-7, tr = (e) => e && e.length === 3 && e.every((t) => Number.isFinite(t)) ? "#" + e.map((t) => Math.round(Math.min(1, Math.max(0, t)) * 255).toString(16).padStart(2, "0")).join("") : null, gt = (e, t) => Math.abs(e - t) / Math.max(Math.abs(t), 1e-12), yt = (e) => [e[0], e[1], e[2]], nr = (e) => e?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "";
function or(e) {
  if (!(e instanceof S))
    return e;
  const t = e.message;
  let n, o;
  return /^This is not a STEP file/.test(t) ? o = P("This is not a STEP file: it does not start with ISO-10303-21.") : /^The STEP file is incomplete/.test(t) ? o = P("The STEP file is incomplete: it does not end with END-ISO-10303-21; (was it cut short?).") : /^STEP input must not be empty/.test(t) ? o = P("The STEP file is empty.") : /^The STEP file holds no solid/.test(t) ? o = P("The STEP file holds no solid (no B-rep body).") : (n = /^The STEP file is malformed: ([\s\S]*)$/.exec(t)) ? o = P`The STEP file is malformed: ${n[1]}` : (n = /^The STEP file cannot be read exactly: ([\s\S]*)$/.exec(t)) ? o = P`The STEP file cannot be read exactly, so nothing was imported: ${n[1]}` : (n = /^The STEP file's (.*) is an open surface \(a sheet\), not a closed solid\.$/.exec(t)) ? o = P`The STEP file's ${n[1]} is an open surface (a sheet), not a closed solid, so nothing was imported.` : (n = /^The STEP file's (.*) is not a valid closed solid, even after repair\.$/.exec(t)) ? o = P`The STEP file's ${n[1]} is not a valid closed solid, even after repair, so nothing was imported.` : (n = /^The STEP file holds (\d+) bodies; at most (\d+) can be imported\.$/.exec(t)) && (o = P`The STEP file holds ${n[1]} bodies; at most ${n[2]} can be imported at once.`), o ? new S(e.code, o, { cause: e }) : e;
}
function rr(e, t, n) {
  if (!(t instanceof Uint8Array) || !t.byteLength)
    throw new S("invalid-input", P("The STEP file is empty."));
  if (t.byteLength > Ye)
    throw new S("unsupported", P`The STEP file is larger than ${Ye / 1048576} MiB.`);
  let o;
  try {
    o = e.importStepBodies(t, { maxBodies: Yt });
  } catch (s) {
    throw or(s);
  }
  const r = n.replace(/\.(step|stp)$/i, "") || "STEP body";
  return { bodies: o.bodies.map(({ solid: s, name: i, color: l }, u) => {
    const f = nr(i) || (o.bodies.length > 1 ? `${r} ${u + 1}` : r);
    return { name: f, color: tr(l), body: sr(e, s, f) };
  }), notes: o.notes };
}
function sr(e, t, n) {
  const o = e.volume(t), r = e.area(t), a = e.bbox(t), s = e.exportStep(t);
  if (s.length > qe)
    throw new S("unsupported", P`${n}: its exact B-rep is larger than ${qe / 1048576} MiB as STEP, so it cannot be stored in the model.`);
  const i = e.importStepBodies(s, { maxBodies: 1 }).bodies[0].solid, l = e.bbox(i);
  if (gt(e.volume(i), o) > mt || gt(e.area(i), r) > mt || [0, 1, 2].some((u) => Math.abs(l.min[u] - a.min[u]) > 1e-6 || Math.abs(l.max[u] - a.max[u]) > 1e-6))
    throw new S("kernel-failure", P`${n}: the exact kernel cannot store this body faithfully (its STEP does not read back the same).`);
  return { brep: { format: "step", text: s }, measures: { volume: o, area: r, min: yt(a.min), max: yt(a.max) }, display: Ot(e, t, n) };
}
function Rt(e, t = 16) {
  const n = /* @__PURE__ */ new Map(), o = (r, a) => {
    const s = e.importStepBodies(r.brep.text, { maxBodies: 1 });
    if (s.bodies.length !== 1)
      throw new S("kernel-failure", P`${a}: the stored exact B-rep does not hold exactly one solid.`);
    return s.bodies[0].solid;
  };
  return {
    /** Read every exact body of `nodes` that is not cached yet. Call outside `k.scope`. */
    warm(r) {
      for (const a of r) {
        if (a.kind !== "exact-body")
          continue;
        const s = a, i = Ve(s), l = n.get(i);
        if (l) {
          n.delete(i), n.set(i, l);
          continue;
        }
        for (n.set(i, o(s, s.name)); n.size > t; ) {
          const [u, f] = n.entries().next().value;
          n.delete(u), f.dispose();
        }
      }
    },
    /** The cached solid, or one read now (owned by the caller's scope). */
    solid(r) {
      return n.get(Ve(r)) ?? o(r, r.name);
    },
    get size() {
      return n.size;
    },
    clear() {
      for (const r of n.values())
        r.dispose();
      n.clear();
    }
  };
}
class Oe extends S {
  constructor(n, o) {
    super(n.code, n.message, o);
    fe(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const ve = (e) => {
  throw new S("unsupported", e);
};
function xt(e, t, n) {
  if (!n?.some((r) => r !== 0))
    return Ze([...t]), e.profile.polygon([t]);
  Ze([...t], [...n]);
  const o = t.map((r, a) => {
    const s = t[(a + 1) % t.length], i = n[a] ?? 0;
    return i ? { kind: "arc", via: an(r, s, i), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], o);
}
const wt = (e, t, n) => {
  const o = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(o, [t[0], t[1]]) : o;
};
function vt(e, t, n) {
  const o = t.profile;
  switch (o.kind) {
    case "rectangle":
      return e.profile.rectangle(se(o.width, n), se(o.depth, n), !0);
    case "circle":
      return wt(e, o.center ?? [0, 0], se(o.radius, n));
    case "outline":
      return xt(e, o.points, o.bulges);
    case "region": {
      Qt(o.loops, (s) => se(s, n));
      const r = (s) => s.kind === "circle" ? wt(e, [se(s.center[0], n), se(s.center[1], n)], se(s.radius, n)) : xt(e, s.points, s.bulges), a = o.loops.map(r).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, i) => i.area - s.area);
      return e.profile.subtract(a[0].profile, ...a.slice(1).map((s) => s.profile));
    }
    case "path":
      return ve("Close the sketch path before creating a solid.");
    default:
      return ve(`Sketch profile '${o.kind}' has no exact lowering.`);
  }
}
function xe(e, t, n) {
  let o = t;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((r, a) => {
    n[a] && (o = e.rotate(o, r, n[a]));
  }), o;
}
const ar = /* @__PURE__ */ new Set(["box", "cylinder", "sphere", "code", "extrusion", "revolution", "exact-body"]), ir = (e, t, n) => e.nameFaces(t, e.topology(t).faces.map((o) => fn(n, o.index))), cr = (e, t, n, o) => e.nameFaces(t, e.topology(t).faces.map((r) => cn(r.name) ? ln(n, o, r.name) : null));
function lr(e, t) {
  try {
    const { copies: n, node: o, face: r } = qt(t), a = P`${e.nodes[o]?.name ?? o} face ${r + 1}`;
    return n.length ? a + " (" + n.map(({ pattern: s, copy: i }) => P`copy ${i + 1} of ${e.nodes[s]?.name ?? s}`).join(", ") + ")" : a;
  } catch {
    return t;
  }
}
function fr(e, t, n, o) {
  return Zt(e.topology(n), o, (r) => lr(t, r));
}
function pe(e, t, n, o, r, a, s = !1, i) {
  const l = s ? "named:" + n : n, u = r.get(l);
  if (u)
    return u;
  const f = t.nodes[n];
  let c;
  try {
    switch (f.kind) {
      case "box":
        c = e.box(f.size);
        break;
      case "cylinder":
        c = e.cylinder(f.radius, f.height);
        break;
      case "sphere":
        c = e.sphere(f.radius);
        break;
      case "code": {
        const g = He(e, bt(f.program).shape);
        if (!g)
          throw new S("invalid-input", "Code produces no printable solid.");
        c = g;
        break;
      }
      case "extrusion": {
        const { distance: g, start: p, plane: h } = rn(f, t);
        c = e.extrude(vt(e, t.sketches[f.sketchId], t), g), p && (c = e.translate(c, [0, 0, p])), h === "XZ" ? c = xe(e, c, [90, 0, 0]) : h === "YZ" && (c = xe(e, c, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: g, angle: p, axisOffset: h } = on(f, t);
        let y = vt(e, t.sketches[f.sketchId], t);
        h && (y = e.profile.translate(y, [-h, 0])), c = _t(e, y, p), g === "XY" ? c = xe(e, c, [-90, 0, 0]) : g === "YZ" && (c = xe(e, c, [0, 0, 90])), h && (c = e.translate(c, g === "YZ" ? [0, h, 0] : [h, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: g, offset: p } = nn(f, t), h = [0, 0, 0];
        if (h[g] = 1, c = e.mirror(pe(e, t, f.source, o, r, a, s, i), h), p) {
          const y = [0, 0, 0];
          y[g] = 2 * p, c = e.translate(c, y);
        }
        break;
      }
      case "pattern": {
        const g = tn(f, t), p = pe(e, t, f.source, o, r, a, s, i), h = [p];
        if (g.mode === "linear")
          for (let y = 1; y < g.count; y++) {
            const M = [0, 0, 0];
            M[g.axis] = y * g.spacing, h.push(e.translate(p, M));
          }
        else {
          const y = g.sweep / (Math.abs(g.sweep) === 360 ? g.count : g.count - 1), M = [0, 0, 0];
          M[g.axis] = 1;
          for (let b = 1; b < g.count; b++)
            h.push(e.rotate(p, M, b * y, g.center));
        }
        s && h.forEach((y, M) => {
          h[M] = cr(e, y, n, M);
        }), c = e.union(h[0], ...h.slice(1));
        break;
      }
      case "boolean": {
        const g = f.inputs.map((p) => pe(e, t, p, o, r, a, s, i));
        if (f.useHoleRoles) {
          const p = g.filter((M, b) => t.nodes[f.inputs[b]].role !== "hole"), h = g.filter((M, b) => t.nodes[f.inputs[b]].role === "hole");
          p.length || ve("A combination of holes only has no solid to export.");
          const y = p.length > 1 ? e.union(p[0], ...p.slice(1)) : p[0];
          c = h.length ? e.subtract(y, ...h) : y;
        } else
          c = f.operation === "union" ? e.union(g[0], ...g.slice(1)) : f.operation === "subtract" ? e.subtract(g[0], ...g.slice(1)) : e.intersect(g[0], ...g.slice(1));
        break;
      }
      case "exact-feature": {
        const g = Jt(f, t), p = en(g.edges) ? g.edges.references : void 0, h = pe(e, t, f.source, o, r, a, s || !!p, i), y = p ? { edgeIndices: fr(e, t, h, p) } : g.edges;
        a && Wo(h, g.operation, y, a), c = g.operation === "fillet" ? e.fillet(h, g.size, y) : g.operation === "chamfer" ? e.chamfer(h, g.size, y) : e.shell(h, g.size, g.openFaces);
        break;
      }
      case "exact-body":
        c = i ? i.solid(f) : Rt(e, 0).solid(f);
        break;
      case "mesh":
        return ve(f.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return ve(`'${f.kind}' has no exact lowering.`);
    }
    s && ar.has(f.kind) && (c = ir(e, c, n));
    const { scale: d, rotation: m, position: x } = f.transform;
    d.some((g) => g !== 1) && (c = e.scale(c, d)), c = xe(e, c, m), x.some((g) => g !== 0) && (c = e.translate(c, x));
  } catch (d) {
    if (d instanceof Oe)
      throw d;
    const m = d instanceof S ? d.code : "invalid-input";
    if (d instanceof sn)
      throw new Oe({ code: "invalid-input", bodyId: o, nodeId: n, feature: f.kind, reason: d.code, message: `${f.name}: ${d.message}` }, { cause: d });
    let x = d instanceof Error ? d.message : String(d);
    const g = /the kernel did not finish within ([\d.]+) s/.exec(x);
    throw g && (x = P`The exact kernel stopped this step at its own ${g[1]} s limit, so it was not built. The model was not changed. Try a simpler body.`), new Oe({ code: m, bodyId: o, nodeId: n, feature: f.kind, message: `${f.name} (${f.kind}): ${x}` }, { cause: d });
  }
  return r.set(l, c), c;
}
function ur(e, t, n, o = {}) {
  if (!t.roots.includes(n))
    throw new S("invalid-input", `${n} is not a top-level body.`);
  return pe(e, t, n, n, /* @__PURE__ */ new Map(), o.limits, !1, o.breps);
}
function Lt(e, t, n, o = {}) {
  const r = t.nodes[n];
  if (!r)
    throw new S("invalid-input", `${n} is not a node of this model.`);
  const a = o.local ? { ...t, nodes: { ...t.nodes, [n]: { ...r, transform: un() } } } : t, s = t.roots.find((i) => i === n) ?? n;
  return pe(e, a, n, s, /* @__PURE__ */ new Map(), o.limits, o.named, o.breps);
}
const me = 64, dr = 64 * 1024 * 1024, Mt = 5e3;
function hr(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const o of n) {
      if (!e.roots.includes(o))
        throw new S("invalid-input", P`Unknown object id: ${o}`);
      const r = e.nodes[o];
      if (r.reference)
        throw new S("invalid-input", P`${r.name} is a reference body and is never exported or measured.`);
      if (r.role === "hole")
        throw new S("invalid-input", P`${r.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((o) => !e.nodes[o].reference && e.nodes[o].role !== "hole");
  if (!n.length)
    throw new S("invalid-input", P("The design has no solid bodies to export"));
  if (n.length > me)
    throw new S("invalid-input", P`Exact commands are limited to ${me} bodies.`);
  return n;
}
function Re(e, t) {
  const n = /* @__PURE__ */ new Set(), o = (r) => {
    n.has(r) || (n.add(r), pn(e.nodes[r]).forEach(o));
  };
  return t.forEach(o), [...n].map((r) => e.nodes[r]);
}
function pr(e, t = e.maxMemoryBytes) {
  const n = Object.freeze({ ...$o, smlib: e.version, licence: e.licence }), o = Rt(e), r = (s, i) => {
    const l = Be(s), u = hr(l, i);
    return o.warm(Re(l, u)), { doc: l, targets: u };
  }, a = ({ doc: s, targets: i }, l = {}) => ({ doc: s, targets: i, solids: i.map((u) => {
    const f = ur(e, s, u, { ...l, breps: o });
    if (!e.isValid(f))
      throw new S("kernel-failure", P`${s.nodes[u].name}: the exact result is not a valid closed solid.`);
    return f;
  }) });
  return {
    kernel: e,
    info: n,
    ...t ? { memoryCapBytes: t } : {},
    measure(s, i, l) {
      const u = r(s, i);
      return e.scope(() => {
        const { doc: f, targets: c, solids: d } = a(u, l);
        return { kernel: n, bodies: d.map((m, x) => {
          const g = e.bbox(m), p = e.massProperties(m);
          return { id: c[x], name: f.nodes[c[x]].name, volume: e.volume(m), area: e.area(m), bounds: { min: [...g.min], max: [...g.max] }, centroid: [...p.centroid], solids: e.solidCount(m) };
        }) };
      });
    },
    edges(s, i, l = {}) {
      const u = Be(s), f = [...new Set(i)];
      if (!f.length)
        throw new S("invalid-input", P("Name or select the bodies whose edges to list."));
      if (f.length > me)
        throw new S("invalid-input", P`Exact commands are limited to ${me} bodies.`);
      for (const c of f)
        if (!u.nodes[c] || !u.roots.includes(c) && !Object.values(u.nodes).some((d) => d.kind === "exact-feature" && d.source === c))
          throw new S("invalid-input", P`Unknown object id: ${c}`);
      return o.warm(Re(u, f)), { kernel: n, bodies: f.map((c) => e.scope(() => {
        const d = Lt(e, u, c, { named: !0, limits: l.limits, breps: o }), m = e.topology(d);
        if (m.edges.length > Mt)
          throw new S("unsupported", P`${u.nodes[c].name} has ${m.edges.length} edges, more than ${Mt} can be listed. Fillet every edge or a face instead.`);
        const x = hn(m);
        return { id: c, name: u.nodes[c].name, edges: m.edges.map((g, p) => {
          const h = x[p];
          return { number: p + 1, curve: g.curve, length: g.length, points: g.points.map((y) => [...y]), ...h.reference ? { reference: h.reference } : { unreferable: h.reason } };
        }) };
      })) };
    },
    featureDisplays(s, i, l = {}) {
      const u = Be(s), f = i?.length ? [...new Set(i)] : dn(u);
      if (f.length > me)
        throw new S("invalid-input", P`Exact commands are limited to ${me} bodies.`);
      for (const c of f)
        if (u.nodes[c]?.kind !== "exact-feature")
          throw new S("invalid-input", P`${c} is not an exact feature`);
      return o.warm(Re(u, f)), { kernel: n, features: f.map((c) => e.scope(() => ({ id: c, name: u.nodes[c].name, ...er(e, u, c, { ...l, breps: o }) }))) };
    },
    importStep(s, i, l = {}) {
      const u = l.limits?.maxStepImportBytes;
      if (u !== void 0 && s.byteLength > u)
        throw new S("unsupported", P`${i} is ${(s.byteLength / 1048576).toFixed(1)} MiB; this device imports STEP files of up to ${Math.round(u / 1048576)} MiB. Import it on a computer, or split the assembly.`);
      return { kernel: n, ...e.scope(() => rr(e, s, i)) };
    },
    exportStep(s, i, l) {
      const u = r(s, i);
      return e.scope(() => {
        const { doc: f, targets: c, solids: d } = a(u, l);
        let m = d[0];
        if (d.length > 1) {
          const p = d.reduce((h, y) => h + e.solidCount(y), 0);
          if (m = e.union(d[0], ...d.slice(1)), e.solidCount(m) !== p) {
            for (let h = 0; h < d.length; h++)
              for (let y = h + 1; y < d.length; y++)
                if (e.solidCount(e.union(d[h], d[y])) < e.solidCount(d[h]) + e.solidCount(d[y]))
                  throw new S("unsupported", P`${f.nodes[c[h]].name} and ${f.nodes[c[y]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new S("unsupported", P("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const x = e.exportStep(m), g = new TextEncoder().encode(x).byteLength;
        if (g > dr)
          throw new S("unsupported", P("The STEP file exceeds 64 MiB."));
        return { kernel: n, bodies: c.map((p) => ({ id: p, name: f.nodes[p].name })), step: x, bytes: g };
      });
    }
  };
}
let Se;
function mr(e = {}) {
  return Se ?? (Se = bo(e).then((t) => pr(t), (t) => {
    throw Se = void 0, t;
  })), Se;
}
function Tr(e) {
  for (let t = e, n = 0; t && n < 8; t = t.cause, n++) {
    if (typeof WebAssembly < "u" && t instanceof WebAssembly.RuntimeError || t instanceof RangeError && /memory|allocat/i.test(t.message))
      return !0;
    const o = t instanceof Error ? t.message : typeof t == "string" ? t : "";
    if (/\bAborted\(|out of memory|memory access out of bounds|bad_alloc|Cannot enlarge memory|memory may be damaged|kernel crashed/i.test(o))
      return !0;
  }
  return !1;
}
const gr = (e) => {
  const t = e.step?.bytes;
  if (t instanceof Uint8Array)
    return t;
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t);
  throw new S("invalid-input", P("Give the STEP file to import."));
};
function yr(e, t, n = 0, o = {}) {
  const r = performance.now();
  return { ...t.operation === "measure" ? { operation: "measure", ...e.measure(t.document, t.bodies, o) } : t.operation === "feature-display" ? { operation: "feature-display", ...e.featureDisplays(t.document, t.bodies, o) } : t.operation === "edges" ? { operation: "edges", ...e.edges(t.document, t.bodies, o) } : t.operation === "import-step" ? { operation: "import-step", ...e.importStep(gr(t), t.step.name, o) } : { operation: "export-step", ...e.exportStep(t.document, t.bodies, o) }, timing: { loadMs: n, runMs: performance.now() - r, memoryBytes: e.kernel.memory().heap } };
}
function $r(e = {}) {
  const { limits: t, ...n } = e, o = { ...t && typeof t.maxMemoryBytes == "number" && typeof t.requestTimeoutMs == "number" ? jo(t) : {}, ...n }, r = () => new Error(P("Request cancelled"));
  return {
    async run(a, s) {
      if (s?.aborted)
        throw r();
      const i = performance.now(), l = await mr(o), u = performance.now();
      if (s?.aborted || (await new Promise((c) => setTimeout(c, 0)), s?.aborted))
        throw r();
      const f = yr(l, a, u - i, { limits: t });
      if (s?.aborted)
        throw r();
      return f;
    }
  };
}
export {
  Bt as CURVED_EDGE_WEIGHT,
  To as EXACT_KERNEL_ID,
  Eo as EXACT_KERNEL_PACKAGE,
  So as EXACT_KERNEL_VERSION,
  br as EXACT_LIMITS_DESKTOP,
  Er as EXACT_LIMITS_NONE,
  Lo as EXACT_LIMITS_TABLET,
  S as ExactKernelError,
  Oe as ExactLoweringError,
  Ho as MANY_LOOPS,
  me as MAX_EXACT_BODIES,
  Mt as MAX_LISTED_EDGES,
  ut as MAX_POLYHEDRON_FACES,
  dr as MAX_STEP_BYTES,
  ft as MIN_EXACT_SEGMENTS,
  Mr as cadScript,
  Wo as checkExactFeatureCost,
  Rt as createBrepCache,
  mr as createExactBackend,
  pr as createExactBackendFromKernel,
  $r as createInThreadExactHost,
  lr as describeExactFace,
  pt as displayMesh,
  Ot as displayTessellation,
  vr as evaluateCadScript,
  ko as exactFeatureCost,
  er as exactFeatureDisplay,
  Do as exactGuardSeconds,
  $o as exactKernelIdentity,
  jo as exactKernelOptions,
  hr as exactTargets,
  Zo as facewiseMesh,
  rr as importStepBodies,
  Tr as isFatalExactError,
  He as lowerCodeShape,
  ur as lowerDocumentBody,
  Lt as lowerDocumentNode,
  Sr as resolveExactLimits,
  fr as resolveFeatureEdges,
  _t as revolveProfile,
  yr as runExactRequest,
  vt as sketchProfile,
  sr as storedBody,
  Yo as triangulatePolygon
};
