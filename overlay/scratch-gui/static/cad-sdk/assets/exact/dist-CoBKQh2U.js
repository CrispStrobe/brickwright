var fn = Object.defineProperty;
var un = (e, t, n) => t in e ? fn(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var pe = (e, t, n) => un(e, typeof t != "symbol" ? t + "" : t, n);
import { c as Wt, C as dn, s as hn, a as pn, t as _, E as mn, M as gn, b as yn, e as xn, d as dt, f as wn, g as ht, S as vn, h as Mn, i as bn, r as En, j as Sn, k as me, l as An, m as Tn, n as $n, o as Pn, p as In, q as Cn, u as _n, v as pt, w as zn, x as Nn, y as Bn, z as On, A as Fn, B as Qe, D as Rn, F as Ln, G as Dn } from "../geometry.worker-BSM4YJe5.js";
var E = class extends Error {
  constructor(t, n, o) {
    super(n, o);
    pe(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, I = (e) => {
  throw new E("invalid-input", e);
};
function X(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && I(`${e} must be finite numbers (got ${String(n)}).`);
}
function K(e, ...t) {
  X(e, ...t);
  for (const n of t) n > 0 || I(`${e} must be positive (got ${n}).`);
}
function je(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return I(`${e} must be a 3-vector.`);
  X(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || I(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function kn(e) {
  const t = e.map((o) => [...o]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let o = 0; o < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); o++)
    for (const [a, s] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[a][s]) < 1e-300) continue;
      const i = (t[s][s] - t[a][a]) / (2 * t[a][s]), f = Math.sign(i || 1) / (Math.abs(i) + Math.sqrt(i * i + 1)), c = 1 / Math.sqrt(f * f + 1), u = f * c;
      for (let l = 0; l < 3; l++) {
        const d = t[l][a], g = t[l][s];
        t[l][a] = c * d - u * g, t[l][s] = u * d + c * g;
      }
      for (let l = 0; l < 3; l++) {
        const d = t[a][l], g = t[s][l];
        t[a][l] = c * d - u * g, t[s][l] = u * d + c * g;
      }
      for (let l = 0; l < 3; l++) {
        const d = n[l][a], g = n[l][s];
        n[l][a] = c * d - u * g, n[l][s] = u * d + c * g;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((o) => [n[0][o], n[1][o], n[2][o]]) };
}
function Xn(e, t) {
  const n = new Float64Array(e.length);
  for (let o = 0; o < t.length; o += 3) {
    const r = t[o] * 3, a = t[o + 1] * 3, s = t[o + 2] * 3, i = e[a] - e[r], f = e[a + 1] - e[r + 1], c = e[a + 2] - e[r + 2], u = e[s] - e[r], l = e[s + 1] - e[r + 1], d = e[s + 2] - e[r + 2], g = f * d - c * l, x = c * u - i * d, y = i * l - f * u;
    for (const p of [r, a, s])
      n[p] += g, n[p + 1] += x, n[p + 2] += y;
  }
  for (let o = 0; o < n.length; o += 3) {
    const r = Math.hypot(n[o], n[o + 1], n[o + 2]);
    r > 0 && (n[o] /= r, n[o + 1] /= r, n[o + 2] /= r);
  }
  return n;
}
var fe = (e) => ({ part: e, dispose: () => e.dispose() }), H = (e, t, n) => ({ sketch: e, outline: t, polygon: n, dispose: () => {
  e.dispose(), t?.dispose();
} }), z = (e) => e?.part ?? I("Not a solid of this kernel."), k = (e) => e?.sketch ?? I("Not a profile of this kernel."), Ge = (e) => e?.outline, mt = (e) => e?.polygon, te = (e) => [e[0], e[1], e[2]];
function P(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof E) throw n;
    const o = n instanceof Error ? n.message : String(n);
    throw new E("kernel-failure", `SMLib ${e} failed: ${o}`, { cause: n });
  }
}
function jn(e) {
  return { sm: e, solid: (o, r) => {
    if (!(r instanceof e.Part)) throw new E("kernel-failure", `SMLib ${o} did not produce a solid (got ${r?.constructor?.name ?? typeof r}).`);
    return fe(r);
  }, face: (o, r) => {
    const { faceNormal: a, outermost: s } = Array.isArray(r) ? { faceNormal: r, outermost: !1 } : r, i = je("Face normal", a), f = (u) => {
      const l = u.center();
      return l.x * i[0] + l.y * i[1] + l.z * i[2];
    }, c = [...o.faces()].filter((u) => {
      if (!u.isPlanar) return !1;
      const l = u.normalAt();
      return l.x * i[0] + l.y * i[1] + l.z * i[2] > 1 - 1e-9;
    });
    return s && c.length ? c.sort((u, l) => f(l) - f(u))[0] : (c.length !== 1 && I(`Expected exactly one planar face with outward normal [${i.join(", ")}], found ${c.length}.`), c[0]);
  } };
}
var Oe = 1e-7, gt = 0.1, W = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], Y = (e, t) => [e[0] + t[0], e[1] + t[1], e[2] + t[2]], G = (e, t) => [e[0] * t, e[1] * t, e[2] * t], j = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Gt = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], He = (e) => Math.sqrt(j(e, e)), J = (e, t) => He(W(e, t)), lt = (e) => G(e, 1 / He(e));
function Un(e, t, n, o) {
  const r = W(e, t), a = Math.cos(o), s = Math.sin(o);
  return Y(t, Y(Y(G(r, a), G(Gt(n, r), s)), G(n, j(n, r) * (1 - a))));
}
function Ht(e) {
  let t = 0, n = [0, 0, 0], o = [0, 0, 0];
  for (let r = 0; r < e.length; r++) {
    const a = e[r], s = e[(r + 1) % e.length], i = J(a, s);
    t += i, n = Y(n, G(Y(a, s), i / 2)), o = Y(o, [(a[1] - s[1]) * (a[2] + s[2]), (a[2] - s[2]) * (a[0] + s[0]), (a[0] - s[0]) * (a[1] + s[1])]);
  }
  return { pos: G(n, 1 / t), axis: lt(o) };
}
function yt(e, t, n) {
  let o = Y(e, W(n.pos, t.pos)), r = t.axis, a = n.axis;
  const s = Math.acos(Math.max(-1, Math.min(1, j(r, a))));
  if (s <= 1e-4 || s >= Math.PI - 1e-4) return o;
  const i = W(n.pos, t.pos);
  j(i, r) < -1e-7 && (r = G(r, -1)), j(i, a) < 1e-7 && (a = G(a, -1));
  const f = Gt(r, a), c = Y(G(a, j(i, r)), G(r, -j(i, a))), u = j(c, r), l = j(c, a), d = u * l > 0 && Math.abs(u) > 1e-4 && Math.abs(l) > 1e-4 ? -1 : 1, g = Math.acos(Math.max(-1, Math.min(1, j(r, a) / (He(r) * He(a)))));
  return o = Un(o, n.pos, lt(f), g * d), o;
}
function Wn(e, t, n, o) {
  const r = W(t, e), a = W(o, n), s = W(e, n), i = j(r, r), f = j(r, a), c = j(a, a), u = j(r, s), l = j(a, s), d = i * c - f * f;
  if (!(d <= 1e-24 * i * c))
    return { s: (f * l - c * u) / d, t: (i * l - f * u) / d };
}
function xt(e, t, n) {
  const o = W(n, t);
  return j(W(e, t), o) / j(o, o);
}
function Gn(e, t, n) {
  const o = [1 / 0, 1 / 0, 1 / 0], r = [-1 / 0, -1 / 0, -1 / 0];
  for (const { p: l } of e) for (let d = 0; d < 3; d++)
    o[d] = Math.min(o[d], l[d]), r[d] = Math.max(r[d], l[d]);
  const a = Math.hypot(r[0] - o[0], r[1] - o[1], r[2] - o[2]), s = Y(t, G(lt(W(n, t)), a)), i = [], f = (l) => l > 0 && l < 1;
  for (const l of e) for (const d of [t, s]) i.push({ vertex: l, p: l.p, d: J(d, l.p) });
  for (let l = 0; l < e.length; l++) {
    const d = e[l].p, g = e[(l + 1) % e.length].p;
    for (const x of [t, s]) {
      const y = xt(x, d, g);
      if (f(y)) {
        const p = Y(d, G(W(g, d), y));
        i.push({ edge: l, t: y, p, d: J(x, p) });
      }
    }
  }
  for (const l of e) {
    const d = xt(l.p, t, s);
    f(d) && i.push({ vertex: l, p: l.p, d: J(l.p, Y(t, G(W(s, t), d))) });
  }
  for (let l = 0; l < e.length; l++) {
    const d = e[l].p, g = e[(l + 1) % e.length].p, x = Wn(t, s, d, g);
    if (!x || !f(x.s) || !f(x.t)) continue;
    const y = Y(d, G(W(g, d), x.t));
    i.push({ edge: l, t: x.t, p: y, d: J(y, Y(t, G(W(s, t), x.s))) });
  }
  if (!i.length) return;
  const c = Math.min(...i.map((l) => l.d));
  let u;
  for (const l of i) l.d <= c + Oe && (!u || J(n, l.p) < J(n, u.p)) && (u = l);
  return u;
}
function wt(e, t, n, o, r) {
  const a = Gn(e, t, n);
  if (!a) return;
  if (a.vertex) return a.vertex;
  const s = a.edge, i = e[s], f = e[(s + 1) % e.length], c = a.t;
  let u;
  if (c < gt ? u = i : 1 - c < gt && (u = f), u && !o(u)) return u;
  const l = J(i.p, f.p);
  if (c * l < Oe || (1 - c) * l < Oe) return u;
  const d = { id: r(), p: a.p };
  return e.splice(s + 1, 0, d), d;
}
function Hn(e, t = "authored") {
  const n = e.length;
  if (n < 2) return e.map((p) => [...p]);
  if (e.every((p) => p.length === e[0].length)) return t === "closest" ? Kn(e) : e.map((p) => [...p]);
  let o = 0;
  const r = () => o++, a = e.map((p) => p.map((h) => ({ id: r(), p: h }))), s = e.map(Ht), i = e.reduce((p, h) => p + h.length, 0), f = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Set();
  for (let p = n - 1; p > 0; p--) {
    const h = [...a[p]];
    if (h.length > i) return;
    for (const m of h) {
      const M = yt(m.p, s[p], s[p - 1]);
      if (J(M, s[p - 1].pos) <= Oe) continue;
      const T = wt(a[p - 1], s[p - 1].pos, M, (v) => c.has(v.id), r);
      if (!T) return;
      f.set(m.id, T.id), c.add(T.id);
    }
  }
  const u = /* @__PURE__ */ new Map();
  for (const [p, h] of f) u.has(h) || u.set(h, p);
  const l = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  for (const p of a[0]) {
    const h = [p.id];
    d.set(p.id, p.id);
    let m = p.id;
    for (; h.length < n && u.has(m) && (m = u.get(m), m !== p.id); )
      h.push(m), d.set(m, p.id);
    l.set(p.id, h);
  }
  const g = a[0].length;
  for (let p = 0; p < n - 1; p++) {
    const h = [...a[p]];
    if (h.length > i || h.length > g) return;
    for (const m of h) {
      const M = d.get(m.id);
      if (M === void 0) return;
      const T = l.get(M), v = new Set(a[p + 1].map((w) => w.id));
      if (T.some((w) => v.has(w))) continue;
      const S = yt(m.p, s[p], s[p + 1]);
      if (J(S, s[p + 1].pos) <= Oe) continue;
      const $ = wt(a[p + 1], s[p + 1].pos, S, (w) => d.has(w.id), r);
      if (!$) return;
      T.push($.id), d.set($.id, M);
    }
  }
  const x = a[0], y = [x.map((p) => p.p)];
  for (let p = 1; p < n; p++) {
    const h = a[p];
    if (h.length !== x.length) return;
    const m = l.get(x[0].id)?.[p], M = l.get(x[1].id)?.[p], T = h.findIndex((w) => w.id === m), v = h.findIndex((w) => w.id === M);
    if (T < 0 || v < 0) return;
    const S = h.length, $ = (T + 1) % S === v ? 1 : (v + 1) % S === T ? -1 : 0;
    if (!$) return;
    y.push(Array.from({ length: S }, (w, b) => h[((T + $ * b) % S + S) % S].p));
  }
  return y;
}
function Kn(e) {
  return Yt(e).map((t, n) => Kt(e[n], t));
}
var Kt = (e, { start: t, forward: n }) => Array.from({ length: e.length }, (o, r) => e[n ? (t + r) % e.length : ((t - r) % e.length + e.length) % e.length]);
function Yt(e, t = e.map(Ht)) {
  const n = t[0], o = [{ start: 0, forward: !0 }];
  let r = e[0], a = n.pos;
  for (let s = 1; s < e.length; s++) {
    const i = e[s], f = i.length;
    let c = t[s].pos;
    const u = W(c, a);
    c = W(c, G(n.axis, j(u, n.axis)));
    const l = W(a, c);
    let d = 1 / 0, g = 0, x = !0;
    const y = (h) => {
      let m = 0;
      for (let M = 0; M < f; M++) m += J(r[M], Y(i[h(M)], l));
      return m;
    };
    for (let h = 0; h < f; h++) {
      const m = y((T) => (h + T) % f);
      m < d && (d = m, g = h, x = !0);
      const M = y((T) => ((h - T) % f + f) % f);
      M < d && (d = M, g = h, x = !1);
    }
    const p = { start: g, forward: x };
    o.push(p), r = Kt(i, p), a = c;
  }
  return o;
}
var ft = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], nt = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], oe = (e) => [e.x, e.y, e.z], Fe = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return t > 1e-15 ? [e[0] / t, e[1] / t, e[2] / t] : null;
}, ce = (e, ...t) => {
  const n = [e[0], e[1], e[2]];
  for (const [o, r] of t)
    n[0] += o * r[0], n[1] += o * r[1], n[2] += o * r[2];
  return n;
};
function Yn(e) {
  const t = e.bbox(), n = Math.max(1, t.diagonal), o = 1e-7 * n, r = { min: [1 / 0, 1 / 0, 1 / 0], max: [-1 / 0, -1 / 0, -1 / 0], tol: o };
  for (const a of e.vertices()) ne(r, [a.x, a.y, a.z]);
  for (const a of e.edges({ seams: !0 })) Vn(a, r);
  for (const a of e.faces()) Jn(a, r);
  return Number.isFinite(r.min[0]) ? { min: r.min, max: r.max } : { min: [t.min.x, t.min.y, t.min.z], max: [t.max.x, t.max.y, t.max.z] };
}
function ne(e, t) {
  for (let n = 0; n < 3; n++)
    t[n] < e.min[n] && (e.min[n] = t[n]), t[n] > e.max[n] && (e.max[n] = t[n]);
}
var Le = (e, t) => t.some((n, o) => n < e.min[o] - e.tol || n > e.max[o] + e.tol), Vt = (e, t) => t.some((n) => Le(e, [n.x, n.y, n.z]));
function Vn(e, t) {
  ne(t, oe(e.start)), ne(t, oe(e.end));
  const n = e.geomType;
  if (n === "line" || n === "circle" && Zn(e, t)) return;
  let o = null;
  try {
    if (o = e.nurbs(), !Vt(t, o.points)) return;
  } catch {
  }
  vt(n === "bspline" && o ? Qn(o) : { t0: 0, t1: 1, spans: 1, at: (r) => oe(e.pointAt(r)) }, t);
}
function Zn(e, t) {
  const n = oe(e.arcCenter), o = Fe(oe(e.normal)), r = e.radius;
  if (!o) return !1;
  for (const a of ft) {
    const s = Fe(ce(a, [-nt(a, o), o]));
    if (s)
      for (const i of [1, -1]) {
        const f = ce(n, [i * r, s]);
        Le(t, f) && (e.isClosed || e.distanceTo(f) <= t.tol) && ne(t, f);
      }
  }
  return !0;
}
function vt(e, t) {
  const n = Math.min(1024, Math.max(64, 8 * e.spans)), o = (e.t1 - e.t0) / n, r = [], a = (s) => s === n ? e.t1 : e.t0 + s * o;
  for (let s = 0; s <= n; s++) {
    const i = e.at(a(s));
    r.push(i), ne(t, i);
  }
  for (let s = 0; s < 3; s++) for (const i of [1, -1]) {
    let f = 0;
    for (let u = 1; u <= n; u++) i * r[u][s] > i * r[f][s] && (f = u);
    qn((u) => {
      const l = e.at(u);
      return ne(t, l), i * l[s];
    }, a(Math.max(0, f - 1)), a(Math.min(n, f + 1)));
  }
}
function qn(e, t, n) {
  const o = (Math.sqrt(5) - 1) / 2, r = 1e-12 * Math.max(1, Math.abs(t), Math.abs(n));
  let a = n - o * (n - t), s = t + o * (n - t), i = e(a), f = e(s);
  for (let c = 0; c < 60 && n - t > r; c++)
    i < f ? (t = a, a = s, i = f, s = t + o * (n - t), f = e(s)) : (n = s, s = a, f = i, a = n - o * (n - t), i = e(a));
}
function Qn(e) {
  const t = e.degree, n = e.knots, o = e.points.length - 1, r = e.weights, a = e.points.map((l, d) => {
    const g = r ? r[d] : 1;
    return [l.x * g, l.y * g, l.z * g, g];
  }), s = n[t], i = n[o + 1];
  let f = 0;
  for (let l = t; l <= o; l++) n[l + 1] > n[l] && f++;
  const c = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]), u = (l) => {
    l = Math.min(i, Math.max(s, l));
    let d = t;
    for (; d < o && n[d + 1] <= l; ) d++;
    for (let x = 0; x <= t; x++) for (let y = 0; y < 4; y++) c[x][y] = a[x + d - t][y];
    for (let x = 1; x <= t; x++) for (let y = t; y >= x; y--) {
      const p = n[y + d - t], h = n[y + 1 + d - x] - p, m = h > 0 ? (l - p) / h : 0;
      for (let M = 0; M < 4; M++) c[y][M] = (1 - m) * c[y - 1][M] + m * c[y][M];
    }
    const g = c[t];
    return [g[0] / g[3], g[1] / g[3], g[2] / g[3]];
  };
  return { t0: s, t1: i, spans: Math.max(1, f), at: u };
}
function Jn(e, t) {
  const n = e.geomType;
  if (n === "plane" || n === "cylinder" || n === "cone" || n === "extrusion") return;
  const o = (r) => Le(t, r) && e.distanceTo(r) <= t.tol;
  if (n === "sphere") return eo(e, t, o);
  if (!(n === "torus" && to(e, t, o)) && !e.isPlanar) {
    try {
      const r = e.nurbs();
      if (r.degrees[0] === 1 || r.degrees[1] === 1 || !Vt(t, r.points.flat())) return;
    } catch {
    }
    oo(e, t);
  }
}
function eo(e, t, n) {
  const o = oe(e.axis.origin), r = e.radius;
  for (const a of ft) for (const s of [1, -1]) {
    const i = ce(o, [s * r, a]);
    n(i) && ne(t, i);
  }
}
function to(e, t, n) {
  const o = e.axis, r = oe(o.origin), a = Fe(oe(o.direction)), s = e.majorRadius, i = e.radius;
  if (!a) return !1;
  for (const f of ft) {
    const c = Fe(ce(f, [-nt(f, a), a]));
    if (c && Math.abs(nt(f, a)) < 1 - 1e-12)
      for (const u of [1, -1]) for (const l of [1, -1]) {
        const d = ce(r, [u * s, c], [l * i, f]);
        n(d) && ne(t, d);
      }
    else no(r, a, s, i, t, n);
  }
  return !0;
}
function no(e, t, n, o, r, a) {
  const s = Fe(Math.abs(t[0]) < 0.9 ? ce([1, 0, 0], [-t[0], t]) : ce([0, 1, 0], [-t[1], t])), i = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
  for (const f of [1, -1])
    if (Le(r, ce(e, [f * o, t])))
      for (let c = 0; c < 72; c++) {
        const u = 2 * Math.PI * c / 72, l = ce(e, [n * Math.cos(u), s], [n * Math.sin(u), i], [f * o, t]);
        if (a(l)) {
          ne(r, l);
          break;
        }
      }
}
function oo(e, t) {
  const o = [];
  for (let r = 0; r <= 24; r++) for (let a = 0; a <= 24; a++) o.push({ u: r / 24, v: a / 24, p: oe(e.positionAt(r / 24, a / 24)) });
  for (let r = 0; r < 3; r++) for (const a of [1, -1]) {
    const i = o.filter((c) => Le(t, c.p)).sort((c, u) => a * u.p[r] - a * c.p[r]).find((c) => e.distanceTo(c.p) <= t.tol);
    if (!i) continue;
    ne(t, i.p);
    const f = ro(e, i, r, a, 1 / 24);
    e.distanceTo(f) <= t.tol && ne(t, f);
  }
}
function ro(e, t, n, o, r) {
  let { u: a, v: s } = t, i = o * t.p[n], f = t.p;
  for (let c = r; c > 1e-9; c /= 2)
    for (let u = !0, l = 0; u && l < 64; l++) {
      u = !1;
      for (const [d, g] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = Math.min(1, Math.max(0, a + d * c)), y = Math.min(1, Math.max(0, s + g * c)), p = oe(e.positionAt(x, y));
        o * p[n] > i && (a = x, s = y, i = o * p[n], f = p, u = !0);
      }
    }
  return f;
}
var Mt = 1024, le = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], V = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Ke = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function Zt(e) {
  const n = 1e-9 * Math.max(1, ...e.flatMap((a) => a.map(Math.abs))), o = so(e, n);
  if (o.length > Mt) throw new E("unsupported", `Hull of ${o.length} distinct vertices exceeds the exact hull budget (${Mt}).`);
  if (o.length < 4) throw new E("invalid-input", "A hull needs at least four non-coplanar points.");
  const r = ao(o, n);
  return io(o, r, Math.min(n, 1e-9));
}
function so(e, t) {
  const n = Math.max(t * 4, 1e-300), o = /* @__PURE__ */ new Map(), r = [];
  for (const a of e) {
    const s = a.map((c) => Math.floor(c / n));
    let i = !1;
    for (let c = -1; c <= 1 && !i; c++) for (let u = -1; u <= 1 && !i; u++) for (let l = -1; l <= 1 && !i; l++)
      for (const d of o.get(`${s[0] + c},${s[1] + u},${s[2] + l}`) ?? []) if (Math.hypot(...le(a, d)) <= t) {
        i = !0;
        break;
      }
    if (i) continue;
    const f = s.join(",");
    (o.get(f) ?? o.set(f, []).get(f)).push(a), r.push(a);
  }
  return r;
}
function bt(e, t, n, o) {
  const r = Ke(le(e[n], e[t]), le(e[o], e[t])), a = Math.hypot(...r), s = a > 0 ? [r[0] / a, r[1] / a, r[2] / a] : [0, 0, 0], i = [(e[t][0] + e[n][0] + e[o][0]) / 3, (e[t][1] + e[n][1] + e[o][1]) / 3, (e[t][2] + e[n][2] + e[o][2]) / 3];
  return { v: [t, n, o], n: s, d: V(s, i), area: a / 2, alive: !0 };
}
function ao(e, t) {
  const n = e.length;
  let o = 0;
  for (let h = 1; h < n; h++) e[h][0] < e[o][0] && (o = h);
  let r = -1, a = -1;
  for (let h = 0; h < n; h++) {
    const m = Math.hypot(...le(e[h], e[o]));
    m > a && (a = m, r = h);
  }
  let s = -1;
  a = -1;
  const i = le(e[r], e[o]);
  for (let h = 0; h < n; h++) {
    const m = Math.hypot(...Ke(i, le(e[h], e[o])));
    m > a && (a = m, s = h);
  }
  if (!(a > t * Math.hypot(...i))) throw new E("invalid-input", "The hull is flat (all points collinear).");
  const f = bt(e, o, r, s);
  let c = -1;
  a = -1;
  for (let h = 0; h < n; h++) {
    const m = Math.abs(V(f.n, e[h]) - f.d);
    m > a && (a = m, c = h);
  }
  if (!(a > t)) throw new E("invalid-input", "The hull is flat (all points coplanar).");
  const u = [], l = /* @__PURE__ */ new Map(), d = (h, m, M) => {
    const T = bt(e, h, m, M), v = u.length;
    return u.push(T), l.set(h * n + m, v), l.set(m * n + M, v), l.set(M * n + h, v), v;
  }, g = (h) => {
    const m = u[h];
    m.alive = !1;
    const [M, T, v] = m.v;
    for (const S of [M * n + T, T * n + v, v * n + M]) l.get(S) === h && l.delete(S);
  };
  V(f.n, e[c]) - f.d > 0 ? (d(o, s, r), d(o, r, c), d(r, s, c), d(s, o, c)) : (d(o, r, s), d(o, c, r), d(r, c, s), d(s, c, o));
  const x = /* @__PURE__ */ new Set([o, r, s, c]), y = e.reduce((h, m) => [h[0] + m[0] / n, h[1] + m[1] / n, h[2] + m[2] / n], [0, 0, 0]), p = [...e.keys()].filter((h) => !x.has(h)).sort((h, m) => Math.hypot(...le(e[m], y)) - Math.hypot(...le(e[h], y)));
  for (const h of p) {
    const m = e[h];
    let M = -1, T = t;
    for (let w = 0; w < u.length; w++) {
      const b = u[w];
      if (!b.alive) continue;
      const A = V(b.n, m) - b.d;
      A > T && (T = A, M = w);
    }
    if (M < 0) continue;
    const v = /* @__PURE__ */ new Set([M]), S = [M];
    for (; S.length; ) {
      const w = S.pop(), [b, A, C] = u[w].v;
      for (const [L, N] of [[b, A], [A, C], [C, b]]) {
        const O = l.get(N * n + L);
        O === void 0 || v.has(O) || V(u[O].n, m) - u[O].d > t && (v.add(O), S.push(O));
      }
    }
    const $ = [];
    for (const w of v) {
      const [b, A, C] = u[w].v;
      for (const [L, N] of [[b, A], [A, C], [C, b]]) {
        const O = l.get(N * n + L);
        (O === void 0 || !v.has(O)) && $.push([L, N]);
      }
    }
    for (const w of v) g(w);
    for (const [w, b] of $) d(w, b, h);
  }
  return u.filter((h) => h.alive);
}
function io(e, t, n) {
  const o = e.length, r = /* @__PURE__ */ new Map();
  t.forEach((d, g) => {
    const [x, y, p] = d.v;
    r.set(x * o + y, g), r.set(y * o + p, g), r.set(p * o + x, g);
  });
  const a = new Array(t.length).fill(-1), s = [], i = [...t.keys()].sort((d, g) => t[g].area - t[d].area);
  for (const d of i) {
    if (a[d] >= 0) continue;
    const { n: g, d: x } = t[d], y = s.length, p = [d];
    a[d] = y;
    for (let m = 0; m < p.length; m++) {
      const [M, T, v] = t[p[m]].v;
      for (const [S, $] of [[M, T], [T, v], [v, M]]) {
        const w = r.get($ * o + S);
        if (w === void 0 || a[w] >= 0) continue;
        const b = t[w];
        V(b.n, g) < 1 - 1e-6 || b.v.some((A) => Math.abs(V(g, e[A]) - x) > n) || (a[w] = y, p.push(w));
      }
    }
    const h = p.length > 1 ? co(p.map((m) => t[m].v), o) : t[d].v.slice();
    if (h) s.push(h);
    else {
      a[d] = y, s.push(t[d].v.slice());
      for (const m of p.slice(1))
        a[m] = s.length, s.push(t[m].v.slice());
    }
  }
  const f = /* @__PURE__ */ new Map();
  for (const d of s) for (const g of d) f.set(g, (f.get(g) ?? 0) + 1);
  const c = s.map((d) => {
    const g = d.filter((x) => (f.get(x) ?? 0) > 2);
    return g.length >= 3 ? g : d;
  }), u = [...new Set(c.flat())].sort((d, g) => d - g), l = new Map(u.map((d, g) => [d, g]));
  return { points: u.map((d) => e[d]), faces: c.map((d) => d.map((g) => l.get(g))) };
}
function co(e, t) {
  const n = /* @__PURE__ */ new Set();
  for (const [s, i, f] of e) for (const [c, u] of [[s, i], [i, f], [f, s]]) n.add(c * t + u);
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
function lo(e, t, n = 1e-9) {
  const o = [];
  for (const r of t) {
    const a = fo(e, r);
    if (r.length === 3 || !a) {
      o.push([...r]);
      continue;
    }
    const s = r.reduce((i, f) => i + V(a, e[f]), 0) / r.length;
    if (r.every((i) => Math.abs(V(a, e[i]) - s) <= n)) {
      o.push([...r]);
      continue;
    }
    o.push(...uo(e, r, a));
  }
  return o;
}
function fo(e, t) {
  const n = [0, 0, 0];
  for (let r = 0; r < t.length; r++) {
    const a = e[t[r]], s = e[t[(r + 1) % t.length]];
    n[0] += (a[1] - s[1]) * (a[2] + s[2]), n[1] += (a[2] - s[2]) * (a[0] + s[0]), n[2] += (a[0] - s[0]) * (a[1] + s[1]);
  }
  const o = Math.hypot(...n);
  return o > 0 ? [n[0] / o, n[1] / o, n[2] / o] : null;
}
function uo(e, t, n) {
  const o = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], r = Ke(n, o), a = Math.hypot(...r), s = [r[0] / a, r[1] / a, r[2] / a], i = Ke(n, s), f = new Map(t.map((x) => [x, [V(e[x], s), V(e[x], i)]])), c = (x, y, p) => {
    const [h, m] = f.get(x), [M, T] = f.get(y), [v, S] = f.get(p);
    return (M - h) * (S - m) - (T - m) * (v - h);
  }, u = (x, y, p, h) => c(y, p, x) >= 0 && c(p, h, x) >= 0 && c(h, y, x) >= 0, l = [...t], d = [];
  let g = 0;
  for (; l.length > 3 && g++ < 10 * t.length * t.length; ) {
    let x = !1;
    for (let y = 0; y < l.length; y++) {
      const p = l[(y + l.length - 1) % l.length], h = l[y], m = l[(y + 1) % l.length];
      if (!(c(p, h, m) <= 0) && !l.some((M) => M !== p && M !== h && M !== m && u(M, p, h, m))) {
        d.push([p, h, m]), l.splice(y, 1), x = !0;
        break;
      }
    }
    if (!x) break;
  }
  if (l.length > 3)
    for (let x = 1; x + 1 < l.length; x++) d.push([l[0], l[x], l[x + 1]]);
  else d.push(l);
  return d;
}
function ho(e, t) {
  const n = Math.max(1, ...e.flatMap((r) => r.map(Math.abs))), o = 1e-9 * n;
  for (const r of t) {
    const a = [0, 0, 0];
    for (let c = 0; c < r.length; c++) {
      const u = e[r[c]], l = e[r[(c + 1) % r.length]];
      a[0] += (u[1] - l[1]) * (u[2] + l[2]), a[1] += (u[2] - l[2]) * (u[0] + l[0]), a[2] += (u[0] - l[0]) * (u[1] + l[1]);
    }
    const s = Math.hypot(...a);
    if (!(s > 0)) return !1;
    const i = [a[0] / s, a[1] / s, a[2] / s], f = V(i, e[r[0]]);
    if (r.some((c) => Math.abs(V(i, e[c]) - f) > o) || e.some((c) => V(i, c) - f > o)) return !1;
  }
  return !0;
}
function po(e) {
  const t = e.length;
  if (t < 4) return null;
  let n = 1;
  for (const r of e) n = Math.max(n, Math.abs(r[0]), Math.abs(r[1]));
  const o = mo(e, 1e-9 * n);
  for (let r = 0; r < t; r++) {
    for (let a = r + 2; a < t; a++) {
      const s = r === 0 && a === t - 1 ? null : o.edgesCross(r, a);
      if (s) return { edges: [r, a], at: s };
    }
    for (let a = 0; a < t; a++) if (o.passesThrough(r, a)) return { edges: [r, (a - 1 + t) % t], at: [e[a][0], e[a][1]] };
  }
  return null;
}
function mo(e, t) {
  const n = e.length, o = (i) => e[(i % n + n) % n], r = (i, f, c) => {
    const u = Math.hypot(f[0] - i[0], f[1] - i[1]), l = u <= t ? 0 : ((f[0] - i[0]) * (c[1] - i[1]) - (f[1] - i[1]) * (c[0] - i[0])) / u;
    return Math.abs(l) <= t ? 0 : Math.sign(l);
  }, a = (i, f, c) => {
    const u = Math.hypot(f[0] - i[0], f[1] - i[1]), l = ((c[0] - i[0]) * (f[0] - i[0]) + (c[1] - i[1]) * (f[1] - i[1])) / u;
    return l > t && l < u - t;
  }, s = (i, f, c, u) => {
    for (let l = 1; l < n; l++) {
      const d = r(i, f, o(c + u * l));
      if (d) return d;
    }
    return 0;
  };
  return {
    /** Where edges i and j cross in their interiors, or null. */
    edgesCross(i, f) {
      const c = o(i), u = o(i + 1), l = o(f), d = o(f + 1);
      if (r(c, u, l) * r(c, u, d) >= 0 || r(l, d, c) * r(l, d, u) >= 0) return null;
      const g = (u[0] - c[0]) * (d[1] - l[1]) - (u[1] - c[1]) * (d[0] - l[0]), x = ((l[0] - c[0]) * (d[1] - l[1]) - (l[1] - c[1]) * (d[0] - l[0])) / g;
      return [c[0] + x * (u[0] - c[0]), c[1] + x * (u[1] - c[1])];
    },
    /** Whether vertex k lies inside edge i and the outline passes there from one side to the other. */
    passesThrough(i, f) {
      if (f === i || f === (i + 1) % n) return !1;
      const c = o(i), u = o(i + 1), l = o(f);
      return r(c, u, l) !== 0 || !a(c, u, l) ? !1 : s(c, u, f, -1) * s(c, u, f, 1) < 0;
    }
  };
}
var Z = (e) => [e[0], e[1], 0];
function go(e, t, n) {
  let o = t;
  const r = [], a = (s, i) => ((!Array.isArray(i) || i.length !== 2) && I(`${s} must be a 2D point.`), X(s, i[0], i[1]), i);
  for (const s of n) {
    const i = s.kind === "spline" ? a("Spline point", s.through.at(-1) ?? I("A spline needs at least one point.")) : a("Path point", s.to);
    s.kind === "line" ? r.push(e.Line(Z(o), Z(i))) : s.kind === "arc" ? r.push(e.ThreePointArc(Z(o), Z(a("Arc point", s.via)), Z(i))) : s.kind === "radiusArc" ? (X("Arc radius", s.radius), r.push(e.RadiusArc(Z(o), Z(i), s.radius))) : s.kind === "sagittaArc" ? (X("Arc sagitta", s.sagitta), r.push(e.SagittaArc(Z(o), Z(i), s.sagitta))) : s.kind === "spline" ? r.push(e.Spline(Z(o), ...s.through.map((f) => Z(a("Spline point", f))))) : I(`Unknown path segment kind '${s.kind}'.`), o = i;
  }
  return Math.hypot(o[0] - t[0], o[1] - t[1]) > 1e-9 && r.push(e.Line(Z(o), Z(t))), r;
}
function Et(e, t) {
  const n = po(t);
  if (!n) return;
  const [o, r] = n.at.map((a) => +a.toPrecision(6));
  I(`The ${e} crosses itself at (${o}, ${r}), so it bounds no region. Reorder its points so no edges cross, or give each region its own contour.`);
}
function yo(e) {
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
function xo(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && I("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && I("Each polygon contour needs at least three points.");
        for (const o of n) X("Polygon points", o[0], o[1]);
        Et("polygon contour", n);
      }
      return P("Polygon", () => {
        const n = t.map((r) => e.Polygon(r.map((a) => [a[0], a[1]]))).sort((r, a) => a.area - r.area), o = t.length === 1 ? t[0].filter((r, a, s) => a < s.length - 1 || r[0] !== s[0][0] || r[1] !== s[0][1]) : void 0;
        return H(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)), void 0, o?.map((r) => [r[0], r[1], 0]));
      });
    },
    circle(t) {
      return K("Circle radius", t), P("Circle", () => H(e.Circle(t)));
    },
    rectangle(t, n, o) {
      return K("Rectangle size", t, n), P("Rectangle", () => H(o ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, o) {
      return K("Rounded rectangle size and radius", t, n, o), o >= Math.min(t, n) / 2 && I("The corner radius must be below half the short side."), P("RoundedRectangle", () => H(e.RoundedRectangle(t, n, o)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && I("A path profile needs at least one segment."), X("Path start", ...Array.isArray(t) ? t : [NaN]), P("path", () => {
        const o = go(e, t, n), r = yo(o);
        Et("path outline", r);
        const a = r.length === o.length ? r.map(([s, i]) => [s, i, 0]) : void 0;
        return H(e.makeFace(new e.Wire(o)), new e.Wire(o), a);
      });
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && I("Text must be a non-empty string."), K("Text size", n);
      try {
        return H(e.Text(t, n));
      } catch (o) {
        if (o instanceof e.FontError) throw new E("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${o.message}`, { cause: o });
        return P("Text", () => {
          throw o;
        });
      }
    },
    union: (t, ...n) => P("fuse (2D)", () => H(n.length ? e.fuse(k(t), ...n.map(k)) : k(t))),
    subtract: (t, ...n) => P("cut (2D)", () => H(n.length ? e.cut(k(t), ...n.map(k)) : k(t))),
    intersect: (t, ...n) => P("intersect (2D)", () => H(n.length ? e.intersect(k(t), ...n.map(k)) : k(t))),
    hull: (...t) => (t.length || I("A hull needs at least one profile."), P("Hull (2D)", () => H(e.Hull(...t.map(k))))),
    translate: (t, [n, o]) => (X("Profile offset", n, o), P("translate (2D)", () => H(k(t).translate([n, o, 0])))),
    rotate: (t, n) => (X("Profile angle", n), P("rotate (2D)", () => H(k(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, o]) => (X("Profile scale", n, o), (n === 0 || o === 0) && I("A zero profile scale flattens the profile."), P("scale (2D)", () => H(k(t).scale([n, o, 1])))),
    offset: (t, n, o) => (X("Profile offset distance", n), P("offset (2D)", () => H(e.offset(k(t), n, { corners: o ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = k(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => P("area (2D)", () => k(t).area)
  };
}
var ie = (e) => [e.x, e.y, e.z], St = (e) => e._identity(), At = 48;
function wo(e) {
  const t = e.degree, n = e.knots, o = e.points.length - 1, r = e.weights, a = e.points.map((c, u) => {
    const l = r ? r[u] : 1;
    return [c.x * l, c.y * l, c.z * l, l];
  }), s = n[t], i = n[o + 1], f = Array.from({ length: t + 1 }, () => [0, 0, 0, 0]);
  return (c) => {
    const u = Math.min(i, Math.max(s, s + c * (i - s)));
    let l = t;
    for (; l < o && n[l + 1] <= u; ) l++;
    for (let g = 0; g <= t; g++) for (let x = 0; x < 4; x++) f[g][x] = a[g + l - t][x];
    for (let g = 1; g <= t; g++) for (let x = t; x >= g; x--) {
      const y = n[x + l - t], p = n[x + 1 + l - g] - y, h = p > 0 ? (u - y) / p : 0;
      for (let m = 0; m < 4; m++) f[x][m] = (1 - h) * f[x - 1][m] + h * f[x][m];
    }
    const d = f[t];
    return [d[0] / d[3], d[1] / d[3], d[2] / d[3]];
  };
}
function vo(e, t) {
  const n = ie(e.start), o = ie(e.end);
  if (t === "line") return [n, o];
  let r = (i) => ie(e.pointAt(i)), a = 16;
  if (t === "circle") {
    const i = e.length / (2 * Math.PI * Math.max(e.radius, 1e-12));
    a = Math.max(4, Math.min(At, Math.ceil(48 * i)));
  } else if (t === "bspline")
    try {
      const i = e.nurbs(), f = wo(i), c = f(0), u = (l, d) => Math.hypot(l[0] - d[0], l[1] - d[1], l[2] - d[2]);
      r = u(c, n) <= u(c, o) ? f : (l) => f(1 - l), a = Math.max(8, Math.min(At, 4 * (i.points.length - i.degree)));
    } catch {
    }
  const s = [n];
  for (let i = 1; i < a; i++) s.push(r(i / a));
  return s.push(o), s;
}
function Mo(e) {
  const t = [...e.faces()], n = /* @__PURE__ */ new Map(), o = t.map((a, s) => {
    n.set(St(a), s);
    const i = a.geomType, f = a.interiorPoint(), c = { index: s, name: a.name, surface: i, area: a.area, point: ie(f), normal: ie(a.normalAt(f)) };
    if (i === "cylinder" || i === "cone" || i === "sphere" || i === "torus") {
      const u = a.axis;
      return { ...c, radius: a.radius, axis: { origin: ie(u.origin), direction: ie(u.direction) } };
    }
    return c;
  }), r = [...e.edges()].map((a, s) => {
    const i = a.geomType, f = vo(a, i), c = [...a.faces()].map((l) => n.get(St(l))).filter((l) => l !== void 0), u = { index: s, curve: i, faces: c, length: a.length, closed: a.isClosed, points: f };
    return i === "circle" ? { ...u, radius: a.radius, center: ie(a.arcCenter), axis: ie(a.normal) } : u;
  });
  return { faces: o, edges: r };
}
function bo(e, t) {
  const n = [...e.faces()];
  if (t.length !== n.length) throw new RangeError(`nameFaces: ${t.length} names for ${n.length} faces.`);
  let o = e;
  return t.forEach((r, a) => {
    r !== null && (o = o.named(r === "" ? null : r, { faces: [n[a]] }));
  }), o;
}
function Eo(e, t) {
  const n = [...e.edges()];
  if (!t.length) throw new RangeError("Select at least one edge.");
  if (new Set(t).size !== t.length) throw new RangeError("Each edge may be selected once.");
  return t.map((o) => {
    if (!Number.isInteger(o) || o < 0 || o >= n.length) throw new RangeError(`Edge index ${o} is not an edge of this solid (it has ${n.length}).`);
    return n[o];
  });
}
var So = 0.01, Ao = 10, To = "MIT AND Apache-2.0", xe = 65536, ot, Se, $o = () => new URL("" + new URL("smlibwasm-Bw7fxXQ_.wasm", import.meta.url).href, import.meta.url);
async function Po(e) {
  if (e.wasmModule) return e.wasmModule;
  if (e.wasmBinary) return e.wasmBinary;
  const t = $o(), n = e.locateFile ? e.locateFile("smlibwasm.wasm", new URL(".", t).href) : t.href, o = !!globalThis.process?.versions?.node;
  if (n.startsWith("file:") || o && !/^[a-z]+:/i.test(n)) {
    const { readFile: a } = await import("../geometry.worker-BSM4YJe5.js").then(function(i) {
      return i._;
    }), { fileURLToPath: s } = await import("../geometry.worker-BSM4YJe5.js").then(function(i) {
      return i._;
    });
    return a(n.startsWith("file:") ? s(n) : n);
  }
  const r = await fetch(n);
  if (!r.ok) throw new Error(`fetching ${n}: ${r.status} ${r.statusText}`);
  return new Uint8Array(await r.arrayBuffer());
}
var se = { module: "a", name: "D" };
function Io(e, t, n) {
  const o = Math.floor(t / xe);
  return (r, a) => {
    let s;
    const i = r[se.module], f = i?.[se.name];
    return i && typeof f == "function" && (i[se.name] = (c) => {
      s = c >>> 0;
      try {
        return f(c);
      } finally {
        s = void 0;
      }
    }), (async () => {
      if (!i || typeof f != "function") throw new Error(`the loader has no heap-resize import ${se.module}.${se.name} to hold the memory ceiling with`);
      const c = await Po(e), u = c instanceof WebAssembly.Module ? c : await WebAssembly.compile(c);
      if (!WebAssembly.Module.imports(u).some((x) => x.module === se.module && x.name === se.name && x.kind === "function"))
        throw new Error(`the module imports no function ${se.module}.${se.name}: it is not the pinned smlibwasm build`);
      const l = await WebAssembly.instantiate(u, r), d = Object.values(l.exports).find((x) => x instanceof WebAssembly.Memory);
      if (!d) throw new Error("the module exports no memory");
      if (d.buffer.byteLength > o * xe) throw new Error(`the memory ceiling ${t} bytes is below the module's initial ${d.buffer.byteLength} bytes`);
      const g = d.grow.bind(d);
      Object.defineProperty(d, "grow", {
        configurable: !0,
        value: (x) => {
          const y = d.buffer.byteLength / xe;
          if (s === void 0 || Math.ceil(s / xe) > o || y >= o) throw new RangeError(`WebAssembly memory ceiling of ${o * xe} bytes reached`);
          return g(Math.min(x, o - y));
        }
      }), a(l);
    })().catch((c) => n(c instanceof Error ? c : new Error(String(c)))), {};
  };
}
async function Co(e) {
  const { init: t } = await import("./chunk-WNM5TYC5-DPBFlphI.js").then(function(a) {
    return a.c;
  }), { maxMemoryBytes: n, ...o } = e, r = { ...o };
  delete r.guardSeconds;
  try {
    if (n === void 0) return await t(r);
    (!(n > 0) || !Number.isFinite(n)) && I("maxMemoryBytes must be a positive number of bytes.");
    const a = Math.floor(n / xe) * xe;
    if (Se)
      return a !== Se.bytes && I(`The kernel was loaded with a memory ceiling of ${Se.bytes} bytes; it loads once per process or worker.`), await Se.loaded;
    let s = () => {
    };
    const i = new Promise((c, u) => {
      s = u;
    }), f = Promise.race([t({ instantiateWasm: Io(r, n, s) }), i]);
    Se = { bytes: a, loaded: f };
    try {
      const c = await f;
      return ot = a, c;
    } catch (c) {
      throw Se = void 0, c;
    }
  } catch (a) {
    throw a instanceof E ? a : new E("invalid-input", `Could not load SMLib: ${a instanceof Error ? a.message : String(a)}`, { cause: a });
  }
}
var Tt = (e) => {
  const t = e.tolerance ?? So, n = e.angleDeg ?? Ao;
  return K("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function _o({ sm: e, solid: t }) {
  return {
    box(n) {
      return K("Box size", ...n), P("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, o) {
      return K("Cylinder radius and height", n, o), P("Cylinder", () => t("Cylinder", e.Cylinder(n, o)));
    },
    cone(n, o, r) {
      return X("Cone radii", n, o), K("Cone height", r), (n < 0 || o < 0 || !(n > 0 || o > 0)) && I("Cone radii must be non-negative and not both zero."), P("Cone", () => t("Cone", n === o ? e.Cylinder(n, r) : e.Cone(n, o, r)));
    },
    sphere(n) {
      return K("Sphere radius", n), P("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, o) {
      return K("Torus radii", n, o), o >= n && I("The tube radius must be smaller than the major radius."), P("Torus", () => t("Torus", e.Torus(n, o)));
    },
    polyhedron(n, o) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(o) || o.length < 4) && I("A polyhedron needs at least four points and four faces.");
      for (const r of n) X("Polyhedron points", r[0], r[1], r[2]);
      for (const r of o) (!Array.isArray(r) || r.length < 3 || r.some((a) => !Number.isInteger(a) || a < 0 || a >= n.length)) && I("Polyhedron faces must index at least three existing points.");
      return P("stitch (polyhedron)", () => e.scope(() => {
        const r = lo(n, o).map((s) => {
          const i = s.map((f) => te(n[f]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), a = e.stitch(...r);
        return (!(a instanceof e.Part) || !a.isValid()) && I("The polyhedron faces do not close around a valid solid."), fe(a);
      }));
    }
  };
}
function qt(e, t, n) {
  return (Hn(t, n) ?? I("The loft sections cannot be matched vertex to vertex.")).map((r) => new e.Wire(r.map((a, s) => e.Line(te(a), te(r[(s + 1) % r.length])))));
}
var zo = 1e-6, ge = (e) => [e.x, e.y, e.z];
function No(e, t) {
  const n = t.map((i, f) => Bo(i, f));
  if (n.every((i) => i.every((f) => f.geomType === "line")))
    return qt(e, n.map((i) => i.map((f) => ge(f.start))), "closest");
  if (n.some((i) => i.length !== n[0].length))
    throw new E("unsupported", `Loft pairing 'closest' matches sections with different edge counts (${n.map((i) => i.length).join(", ")}) only when every edge is straight; these have curved edges. Use pairing 'authored', or give the sections equal edge counts.`);
  const o = (i) => i.some((f, c) => {
    const u = i[(c + i.length - 1) % i.length].tangentAt(1), l = f.tangentAt(0);
    return Math.acos(Math.max(-1, Math.min(1, u.x * l.x + u.y * l.y + u.z * l.z))) > zo;
  });
  if (!n.some(o)) return;
  const r = n.map((i) => ({ pos: Oo(i), axis: [0, 0, 1] })), a = Yt(n.map((i) => i.map((f) => ge(f.start))), r), s = t.map((i) => !!Ge(i.profile));
  return n.map((i, f) => {
    const { start: c, forward: u } = a[f], l = i.length, d = Array.from({ length: l }, (g, x) => u ? i[(c + x) % l] : i[((c - 1 - x) % l + l) % l]);
    return new e.Wire(d.map((g) => {
      const [x, y] = u ? [g.start, g.end] : [g.end, g.start];
      if (g.geomType === "line") return e.Line(ge(x), ge(y));
      if (g.geomType === "circle") return e.ThreePointArc(ge(x), ge(g.pointAt(0.5)), ge(y));
      if (u && s[f]) return g;
      throw new E("unsupported", `Loft pairing 'closest' would run section ${f + 1} ${u ? "from another vertex" : "the other way round"}, and it has a ${g.geomType} edge, which this kernel re-starts only as drawn in a path profile; it re-starts lines and circular arcs. Use pairing 'authored', or draw the section from the vertex and in the direction it pairs with.`);
    }));
  });
}
function Bo(e, t) {
  const n = (s) => {
    throw new E("unsupported", `Loft pairing 'closest' needs single-outline sections; section ${t + 1} ${s}. Use pairing 'authored' for it.`);
  };
  let o = Ge(e.profile);
  if (!o) {
    const s = [...k(e.profile).faces()];
    s.length !== 1 && n(`has ${s.length} regions`), [...s[0].innerWires()].length && n("has holes"), o = s[0].outerWire();
  }
  const r = [...o.translate(te(e.at)).edges()], a = (s, i) => Math.hypot(s.x - i.x, s.y - i.y, s.z - i.z) <= 1e-7;
  for (let s = 0; s < r.length; s++) {
    const i = r[s], f = r[(s + 1) % r.length];
    a(i.end, f.start) || n("is not one closed chain of edges"), i.isClosed && r.length > 1 && n("has a closed edge among others");
  }
  return r;
}
function Oo(e) {
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
function Fo({ sm: e, solid: t }) {
  return {
    extrude(n, o) {
      return K("Extrusion height", o), P("extrude", () => t("extrude", e.extrude(k(n), o)));
    },
    revolve(n, o) {
      return X("Revolution angle", o), (o === 0 || Math.abs(o) > 360) && I("Revolution angle must be in (0, 360] degrees in magnitude."), P("revolve", () => e.scope(() => {
        const r = k(n).rotate(e.Axis.X, 90), a = e.revolve(r, e.Axis.Z, Math.abs(o));
        return t("revolve", o < 0 ? a.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : a);
      }));
    },
    loft(n, o = {}) {
      (!Array.isArray(n) || n.length < 2) && I("A loft needs at least two sections.");
      for (const a of n) X("Loft section position", ...a.at);
      const r = o.pairing ?? "authored";
      return r !== "authored" && r !== "closest" && I(`Unknown loft pairing '${String(r)}' (authored or closest).`), P("loft", () => e.scope(() => {
        const a = !!o.ruled, s = n.map((u) => mt(u.profile)?.length), i = s.some((u) => u !== s[0]);
        if (s.every((u) => u !== void 0) && (i || r === "closest"))
          return t("loft", e.loft(qt(e, n.map((u) => mt(u.profile).map((l) => [l[0] + u.at[0], l[1] + u.at[1], l[2] + u.at[2]])), r), { ruled: a }));
        if (r === "closest") {
          const u = No(e, n);
          if (u) return t("loft", e.loft(u, { ruled: a }));
        }
        const c = (n.every((u) => Ge(u.profile)) ? n.map((u) => Ge(u.profile).translate(te(u.at))) : void 0) ?? n.map((u) => k(u.profile).translate(te(u.at)));
        return t("loft", e.loft(c, { ruled: a }));
      }));
    },
    sweep(n, o) {
      (!Array.isArray(o) || o.length < 2) && I("A sweep rail needs at least two points.");
      for (const r of o) X("Sweep rail points", ...r);
      return P("sweep", () => e.scope(() => {
        const r = o.map(te), a = r.length === 2 ? e.Line(r[0], r[1]) : e.Polyline(r);
        return t("sweep", e.sweep(k(n), a));
      }));
    }
  };
}
function Ro({ sm: e, solid: t }) {
  return {
    union: (n, ...o) => P("fuse", () => t("fuse", o.length ? e.fuse(z(n), ...o.map(z)) : z(n))),
    subtract: (n, ...o) => P("cut", () => t("cut", o.length ? e.cut(z(n), ...o.map(z)) : z(n))),
    intersect: (n, ...o) => P("intersect", () => t("intersect", o.length ? e.intersect(z(n), ...o.map(z)) : z(n))),
    splitByPlane: (n, o, r) => {
      const a = je("Split normal", o);
      return X("Split offset", r), P("split", () => {
        const [s, i] = e.split(z(n), new e.Plane([a[0] * r, a[1] * r, a[2] * r], void 0, a), "both");
        return [t("split", s), t("split", i)];
      });
    },
    translate: (n, o) => (X("Translation", ...o), P("translate", () => fe(z(n).translate(te(o))))),
    rotate: (n, o, r, a = [0, 0, 0]) => {
      const s = je("Rotation axis", o);
      return X("Rotation angle and pivot", r, ...a), P("rotate", () => fe(z(n).rotate(new e.Axis(te(a), s), r)));
    },
    mirror: (n, o, r = [0, 0, 0]) => {
      const a = je("Mirror normal", o);
      return X("Mirror origin", ...r), P("mirror", () => fe(z(n).mirror(new e.Plane(te(r), void 0, a))));
    },
    scale: (n, o) => (X("Scale factors", ...o), o.some((r) => r === 0) && I("A zero scale factor flattens the solid."), P("scale", () => fe(z(n).scale(te(o), [0, 0, 0]))))
  };
}
function Lo(e) {
  const { sm: t, solid: n, face: o } = e, r = (s, i) => {
    if (i === "all") return s.edges();
    if (i && typeof i == "object" && "edgeIndices" in i) {
      Array.isArray(i.edgeIndices) || I("edgeIndices must be an array of edge indices.");
      try {
        return Eo(s, i.edgeIndices);
      } catch (f) {
        throw f instanceof RangeError && I(f.message), f;
      }
    }
    return o(s, i).edges();
  }, a = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, i, f = "all") => (K("Fillet radius", i), P("fillet", () => n("fillet", t.fillet(r(z(s), f), i)))),
    chamfer: (s, i, f = "all") => (K("Chamfer distance", i), P("chamfer", () => n("chamfer", t.chamfer(r(z(s), f), i)))),
    topology: (s) => P("topology", () => t.scope(() => Mo(z(s)))),
    nameFaces: (s, i) => ((!Array.isArray(i) || i.some((f) => f !== null && typeof f != "string")) && I("Face names must be strings or null."), P("named", () => {
      try {
        return n("named", bo(z(s), i));
      } catch (f) {
        throw f instanceof RangeError && I(f.message), f;
      }
    })),
    shell: (s, i, f) => {
      K("Shell thickness", i);
      const c = f === void 0 ? [] : a(f) ? [f] : [...f];
      return P("shell", () => {
        const u = z(s), l = c.map((d) => o(u, d));
        return n("shell", t.shell(u, -i, l.length ? l : null));
      });
    }
  };
}
function Do({ sm: e }) {
  return {
    volume: (t) => P("volume", () => z(t).volume),
    area: (t) => P("area", () => z(t).area),
    // Not SMLib's bbox(): it misses interior extremes of some rotated spheres (see bbox.ts).
    bbox: (t) => P("bbox", () => Yn(z(t))),
    massProperties: (t) => P("massProperties", () => {
      const n = z(t).massProperties(1), o = n.inertia, r = (f, c) => (o[f][c] + o[c][f]) / 2, a = [[o[0][0], r(0, 1), r(0, 2)], [r(0, 1), o[1][1], r(1, 2)], [r(0, 2), r(1, 2), o[2][2]]], { values: s, vectors: i } = kn(a);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: a, principalMoments: s, principalAxes: i };
    }),
    isValid: (t) => P("isValid", () => z(t).isValid()),
    solidCount: (t) => P("solids", () => e.scope(() => z(t).solids().length)),
    components: (t) => P("solids", () => [...z(t).solids()].map(fe))
  };
}
var Qt = () => {
}, ko = 1e3, Xo = "ISO-10303-21", jo = /END-ISO-10303-21;\s*$/;
function Uo(e) {
  let t = e.length;
  for (; t > 0 && (e.charCodeAt(t - 1) === 0 || e.charCodeAt(t - 1) === 26); ) t--;
  return e.slice(0, t);
}
function Wo(e) {
  if (typeof e == "string") return e;
  if (e instanceof Uint8Array) {
    let t = "";
    for (let n = 0; n < e.length; n += 32768) t += String.fromCharCode(...e.subarray(n, n + 32768));
    return t;
  }
  return I("STEP input must be text or bytes (a Uint8Array).");
}
function Go(e, t, n) {
  const o = Wo(t);
  o.length || I("STEP input must not be empty."), o.replace(/^\uFEFF|^\xEF\xBB\xBF/, "").trimStart().startsWith(Xo) || I("This is not a STEP file: it does not start with ISO-10303-21."), jo.test(Uo(o)) || I("The STEP file is incomplete: it does not end with END-ISO-10303-21; (was it cut short?).");
  const r = [];
  let a;
  e.setWarningHandler((c) => {
    r.push(String(c));
  });
  try {
    a = e.fromStep(o, { strict: !0 });
  } catch (c) {
    const u = c instanceof Error ? c.message : String(c);
    throw c instanceof e.KernelError ? new E("kernel-failure", `SMLib fromStep failed: ${u}`, { cause: c }) : c instanceof e.ModelingError ? new E("unsupported", /holds no B-rep/.test(u) ? "The STEP file holds no solid (no B-rep body)." : `The STEP file cannot be read exactly: ${u.replace(/^import STEP: /, "")}`, { cause: c }) : new E("invalid-input", `The STEP file is malformed: ${u}`, { cause: c });
  } finally {
    e.setWarningHandler(Qt);
  }
  const s = Array.isArray(a) ? [...a] : [a], i = () => s.forEach((c) => c?.dispose?.());
  try {
    if (!s.length) throw new E("unsupported", "The STEP file holds no solid (no B-rep body).");
    if (s.length > n) throw new E("unsupported", `The STEP file holds ${s.length} bodies; at most ${n} can be imported.`);
    const c = (u, l) => u.name ? `body ${l + 1} ('${u.name}')` : `body ${l + 1}`;
    s.forEach((u, l) => {
      if (!(u instanceof e.Part)) {
        const x = u instanceof e.Shell ? "an open surface (a sheet), not a closed solid" : `not a solid (${u?.constructor?.name ?? typeof u})`;
        throw new E("unsupported", `The STEP file's ${c(u, l)} is ${x}.`);
      }
      const d = P("isValid", () => u.isValid()), g = d ? P("volume", () => u.volume) : 0;
      if (!d || !(g > 0)) throw new E("unsupported", `The STEP file's ${c(u, l)} is not a valid closed solid, even after repair.`);
    });
  } catch (c) {
    throw i(), c;
  }
  return { bodies: s.map((c) => {
    const u = c.color;
    return { solid: fe(c), name: typeof c.name == "string" && c.name ? c.name : null, color: u ? [Number(u[0]), Number(u[1]), Number(u[2])] : null };
  }), notes: r };
}
var $t = 1e3;
function Pt(e, t) {
  if (e !== void 0)
    return (typeof e != "string" || !e.length || e.length > $t || [...e].some((n) => n.charCodeAt(0) < 32 || n.charCodeAt(0) === 127)) && I(`${t} must be a non-empty string of at most ${$t} characters without control characters.`), e;
}
function Ho(e, t, n) {
  (!n || typeof n != "object") && I("exportStep options must be an object.");
  const o = Pt(n.product, "The STEP product name");
  if (!Array.isArray(t)) {
    const s = z(t);
    return P("toStep", () => e.toStep(s, o === void 0 ? {} : { name: o }));
  }
  const r = t;
  r.length || I("exportStep needs at least one body.");
  const a = r.map((s, i) => {
    (!s || typeof s != "object") && I(`exportStep body ${i + 1} must be { solid, name?, color? }.`);
    const f = z(s.solid), c = Pt(s.name, `The name of STEP body ${i + 1}`), u = s.color;
    return u !== void 0 && (!Array.isArray(u) || u.length !== 3 || u.some((l) => typeof l != "number" || !(l >= 0 && l <= 1))) && I(`The colour of STEP body ${i + 1} must be [r, g, b] with each from 0 to 1.`), { part: f, name: c, color: u };
  });
  return P("toStep", () => e.scope(() => {
    const s = a.map(({ part: f, name: c, color: u }) => {
      let l = c === void 0 ? f : f.named(c);
      return u !== void 0 && (l = l.colored([u[0], u[1], u[2]])), l;
    }), i = o ?? (a.length === 1 ? a[0].name : void 0);
    return e.toStep(s, i === void 0 ? {} : { name: i });
  }));
}
function Ko({ sm: e, solid: t }) {
  return {
    tessellate: (n, o = {}) => {
      const { tolerance: r, angle: a } = Tt(o);
      return P("mesh", () => e.scope(() => {
        const s = z(n).mesh(r, a), i = Float64Array.from(s.vertices), f = Uint32Array.from(s.triangles);
        return { positions: i, normals: Xn(i, f), indices: f };
      }));
    },
    exportStl: (n, o = {}) => {
      const { tolerance: r, angle: a } = Tt(o);
      return P("toStl", () => e.toStl(z(n), { tolerance: r, angle: a }));
    },
    exportStep: (n, o = {}) => Ho(e, n, o),
    importStep: (n) => ((typeof n != "string" || !n.length) && I("STEP input must be non-empty text."), P("fromStep", () => {
      const o = e.fromStep(n);
      if (Array.isArray(o) && o.length && o.every((r) => r instanceof e.Part)) {
        const r = o;
        return t("fromStep", r.length === 1 ? r[0] : e.fuse(r[0], ...r.slice(1)));
      }
      return t("fromStep", o);
    })),
    importStepBodies: (n, o = {}) => {
      const r = o.maxBodies ?? ko;
      return (!Number.isInteger(r) || r < 1) && I("maxBodies must be a positive whole number."), Go(e, n, r);
    }
  };
}
async function Yo(e = {}) {
  const t = await Co(e);
  e.guardSeconds !== void 0 && (e.guardSeconds >= 0 || I("guardSeconds must be 0 or more."), t.setGuardSeconds(e.guardSeconds)), t.setWarningHandler(Qt);
  const n = jn(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: To,
    profile: xo(t),
    ..._o(n),
    ...Fo(n),
    ...Ro(n),
    ...Lo(n),
    ...Do(n),
    ...Ko(n),
    memory: () => {
      const o = t.memoryUsage();
      return { used: o.used, heap: o.heap, handles: o.handles };
    },
    scope: (o) => t.scope(o),
    setGuardSeconds: (o) => (Number(o) >= 0 || I("The guard must be 0 or more seconds."), t.setGuardSeconds(o)),
    guardSeconds: () => t.GUARD_SECONDS,
    ...ot !== void 0 ? { maxMemoryBytes: ot } : {}
  };
}
const Vo = "@crispcad/exact-kernel", Zo = "0.1.10", qo = "smlib", Qo = Object.freeze({ id: qo, package: Vo, version: Zo }), It = 16, Ct = 2048, U = (e) => {
  throw new E("unsupported", e);
}, Me = (e) => {
  throw new E("invalid-input", e);
};
function we(e, t) {
  t < It && U(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${It}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const Jo = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], rt = (e, t) => {
  const n = [];
  for (let o = 0; o < 3; o++)
    for (let r = 0; r < 4; r++)
      n.push(e[o * 4] * t[r] + e[o * 4 + 1] * t[4 + r] + e[o * 4 + 2] * t[8 + r] + (r === 3 ? e[o * 4 + 3] : 0));
  return n;
}, Ae = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), _t = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], er = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function Ue(e, t) {
  const n = Math.hypot(...e);
  n > 0 || Me("Rotation axis must be non-zero.");
  const [o, r, a] = e.map((u) => u / n), s = t * Math.PI / 180, i = Math.cos(s), f = Math.sin(s), c = 1 - i;
  return [c * o * o + i, c * o * r - f * a, c * o * a + f * r, 0, c * o * r + f * a, c * r * r + i, c * r * a - f * o, 0, c * o * a - f * r, c * r * a + f * o, c * a * a + i, 0];
}
const tr = (e) => rt(Ue([0, 0, 1], e[2]), rt(Ue([0, 1, 0], e[1]), Ue([1, 0, 0], e[0])));
function nr(e) {
  const t = Math.hypot(...e);
  t > 0 || Me("Mirror normal must be non-zero.");
  const [n, o, r] = e.map((a) => a / t);
  return [1 - 2 * n * n, -2 * n * o, -2 * n * r, 0, -2 * n * o, 1 - 2 * o * o, -2 * o * r, 0, -2 * n * r, -2 * o * r, 1 - 2 * r * r, 0];
}
function or(e) {
  const [t, n, o, , r, a, s, , i, f, c] = e, u = Math.max(-1, Math.min(1, (t + a + c - 1) / 2)), l = Math.acos(u);
  if (l < 1e-15)
    return null;
  let d = [f - s, o - i, r - n];
  return Math.hypot(...d) < 1e-9 && (d = [[t + 1, r, i], [n, a + 1, f], [o, s, c + 1]].reduce((x, y) => Math.hypot(...y) > Math.hypot(...x) ? y : x)), { axis: d, degrees: l * 180 / Math.PI };
}
function rr(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && Me("Affine matrix is singular.");
  for (const [s, i] of [[0, 1], [0, 2], [1, 2]]) {
    const f = t[s][0] * t[i][0] + t[s][1] * t[i][1] + t[s][2] * t[i][2];
    Math.abs(f) > 1e-9 * n[s] * n[i] && U("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const o = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), r = [n[0], n[1], o < 0 ? -n[2] : n[2]], a = [0, 1, 2].flatMap((s) => [e[s * 4] / r[0], e[s * 4 + 1] / r[1], e[s * 4 + 2] / r[2], 0]);
  return { scale: r, rotation: a, translate: [e[3], e[7], e[11]] };
}
function Jt(e, t, n, o) {
  const r = e.map((s, i) => {
    if (!s)
      return 0;
    const f = o[i] - n[i];
    return f < 1e-12 && Me("Cannot resize a degenerate shape."), s / f;
  }), a = Math.max(...r) || 1;
  return r.map((s, i) => e[i] ? s : t?.[i] ? a : 1);
}
function ae(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return we("circle2d", t.segments), e.profile.circle(t.radius);
    case "rectangle":
      return e.profile.rectangle(t.size[0], t.size[1], t.center);
    case "move": {
      const n = ae(e, t.profile);
      return n && e.profile.translate(n, t.vector);
    }
    case "rotate": {
      const n = ae(e, t.profile);
      return n && e.profile.rotate(n, t.angle);
    }
    case "scale": {
      const n = ae(e, t.profile);
      return n && e.profile.scale(n, t.vector);
    }
    case "affine": {
      const n = ae(e, t.profile);
      if (!n)
        return null;
      const [o, r, a, s, i, f] = t.matrix, c = Math.hypot(o, s), u = Math.hypot(r, i);
      c > 1e-12 && u > 1e-12 || Me("2D affine matrix is singular."), Math.abs(o * r + s * i) > 1e-9 * c * u && U("2D affine transforms with shear have no exact lowering here.");
      const l = o * i - r * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [c, l < 0 ? -u : u]), Math.atan2(s, o) * 180 / Math.PI), [a, f]);
    }
    case "resize": {
      const n = ae(e, t.profile);
      if (!n)
        return null;
      const o = e.profile.bounds(n), r = Jt(t.size, t.auto, o.min, o.max);
      return e.profile.scale(n, [r[0], r[1]]);
    }
    case "offset": {
      t.round && we("offset2d", t.segments);
      const n = ae(e, t.profile);
      return n && e.profile.offset(n, t.distance, t.round);
    }
    case "text":
      return U("text2d needs a font outline path, and the exact kernel package ships no font.");
    case "minkowski":
      return U("minkowski2d has no exact lowering (planar Minkowski sums of curved profiles are not exposed by this kernel adapter).");
    case "union":
    case "subtract":
    case "intersect":
    case "hull": {
      const n = t.profiles.map((a) => ae(e, a)), o = n.filter((a) => a !== null);
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
      return U(`Profile '${t.kind}' has no exact lowering.`);
  }
}
function $e(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, o = e.center ? -t / 2 : 0, r = e.center ? -n / 2 : 0;
      return [[o, r], [o + t, r], [o + t, r + n], [o, r + n]];
    }
    case "move":
      return $e(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return $e(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), o = Math.sin(t);
      return $e(e.profile).map(([r, a]) => [n * r - o * a, o * r + n * a]);
    }
    case "affine": {
      const t = e.matrix;
      return $e(e.profile).map(([n, o]) => [t[0] * n + t[1] * o + t[2], t[3] * n + t[4] * o + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap($e);
    case "empty":
      return [];
    default:
      return U(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function st(e, t, n) {
  const o = (r, a) => st(a, rt(t, r), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const r of e.shapes)
        st(r, t, n);
      return;
    case "move":
      return o(_t(e.vector), e.shape);
    case "rotate":
      return o(tr(e.vector), e.shape);
    case "scale":
      return o(er(e.vector), e.shape);
    case "mirror":
      return o(nr(e.vector), e.shape);
    case "axisRotate":
      return o(Ue(e.vector, e.angle), e.shape);
    case "affine":
      return o(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let r = 0; r < e.count; r++)
        o(_t(e.step.map((a) => a * r)), e.shape);
      return;
    case "box": {
      const [r, a, s] = e.size.map((i) => i / 2);
      for (const i of [-r, r])
        for (const f of [-a, a])
          for (const c of [-s, s])
            n.points.push(Ae(t, [i, f, c]));
      return;
    }
    case "polyhedron":
      for (const r of e.points)
        n.points.push(Ae(t, r));
      return;
    case "extrude":
      for (const [r, a] of e.points)
        for (const s of [0, e.height])
          n.points.push(Ae(t, [r, a, s]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && U("hull of a twisted extrusion has no exact lowering.");
      for (const [r, a] of $e(e.profile))
        n.points.push(Ae(t, [r, a, 0])), n.points.push(Ae(t, [r * e.scaleTop[0], a * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      we("sphere", e.segments);
      const r = [0, 1, 2].map((a) => Math.hypot(t[a], t[4 + a], t[8 + a]));
      Math.max(...r) - Math.min(...r) > 1e-12 * Math.max(...r) && U("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: Ae(t, [0, 0, 0]), radius: e.radius * r[0] });
      return;
    }
    default:
      U(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function sr(e, t) {
  const n = { points: [], spheres: [] };
  for (const d of t)
    st(d, Jo, n);
  if (n.points.length && n.spheres.length && U("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const d = Zt(n.points);
    return e.polyhedron(d.points, d.faces);
  }
  if (!n.spheres.length)
    return null;
  const o = n.spheres[0].radius;
  n.spheres.some((d) => Math.abs(d.radius - o) > 1e-12 * o) && U("hull of spheres with different radii has no exact lowering.");
  const r = n.spheres.map((d) => d.centre), a = [0, 1, 2].map((d) => Math.min(...r.map((g) => g[d]))), s = [0, 1, 2].map((d) => Math.max(...r.map((g) => g[d]))), i = s.map((d, g) => d - a[g]), f = 1e-9 * Math.max(1, ...i);
  if (i.every((d) => d <= f))
    return e.translate(e.sphere(o), a);
  const c = (d) => [d & 1 ? s[0] : a[0], d & 2 ? s[1] : a[1], d & 4 ? s[2] : a[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((d) => r.some((g) => g.every((x, y) => Math.abs(x - c(d)[y]) <= f))) || i.some((d) => d <= f)) && U("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const l = e.box(i.map((d) => d + 2 * o));
  return e.translate(e.fillet(l, o, "all"), a.map((d, g) => d + i[g] / 2));
}
function en(e, t, n) {
  const o = e.profile.bounds(t), r = o.max[0] <= 0;
  o.min[0] < -1e-8 && !r && Me("Revolved profiles must stay on one side of the radial axis.");
  const a = Math.abs(n);
  a > 360 && Me("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(r ? e.profile.scale(t, [-1, 1]) : t, n);
  return r && a !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function ar(e, t, n) {
  const { scale: o, rotation: r, translate: a } = rr(n);
  let s = o.every((f) => Math.abs(f - 1) < 1e-15) ? t : e.scale(t, o);
  const i = or(r);
  return i && (s = e.rotate(s, i.axis, i.degrees)), a.some((f) => f !== 0) ? e.translate(s, a) : s;
}
function ut(e, t) {
  const n = (o) => ut(e, o);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return we("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return we("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return we("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && U("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && U("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const o = ae(e, t.profile);
      return o && e.extrude(o, t.height);
    }
    case "revolve": {
      if (we("revolve", t.segments), t.angle === 0)
        return null;
      const o = ae(e, t.profile);
      return o && en(e, o, t.angle);
    }
    case "polyhedron": {
      if (t.smooth)
        return lr(e, t.smooth, t.closest);
      if (t.ruled)
        return cr(e, t.closest ?? t.ruled, t.points, t.faces, t.closest ? "closest" : "authored");
      if (t.faces.length > Ct && U(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${Ct} faces).`), ho(t.points, t.faces)) {
        const o = Zt(t.points);
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
      return sr(e, t.shapes);
    case "minkowski":
      return U("minkowski has no exact lowering (a general Minkowski sum is not a B-rep operation of this adapter; use fillet/offset intent instead).");
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
      return o && ar(e, o, t.matrix.slice(0, 12));
    }
    case "resize": {
      const o = n(t.shape);
      if (!o)
        return null;
      const r = e.bbox(o);
      return e.scale(o, Jt(t.vector, t.auto, r.min, r.max));
    }
    case "repeat": {
      const o = t.count >= 1 ? n(t.shape) : null;
      if (!o)
        return null;
      const r = Array.from({ length: t.count }, (a, s) => s === 0 ? o : e.translate(o, t.step.map((i) => i * s)));
      return r.length > 1 ? e.union(r[0], ...r.slice(1)) : r[0];
    }
    default:
      return U(`CAD Script '${t.kind}' has no exact lowering.`);
  }
}
function ir(e, t) {
  let n = 0;
  for (const o of t)
    for (let r = 1; r + 1 < o.length; r++) {
      const a = e[o[0]], s = e[o[r]], i = e[o[r + 1]];
      n += a[0] * (s[1] * i[2] - s[2] * i[1]) - a[1] * (s[0] * i[2] - s[2] * i[0]) + a[2] * (s[0] * i[1] - s[1] * i[0]);
    }
  return n / 6;
}
function cr(e, t, n, o, r = "authored") {
  const a = e.loft(t.map((f) => ({ profile: e.profile.polygon([f.map((c) => [c[0], c[1]])]), at: [0, 0, f[0][2]] })), r === "closest" ? { ruled: !0, pairing: r } : { ruled: !0 }), s = ir(n, o), i = e.volume(a);
  if (!(Math.abs(i - s) <= 1e-7 * Math.abs(s)))
    throw a.dispose(), new E("kernel-failure", `The ruled loft's volume ${i} differs from its faceted volume ${s}; the kernel did not keep the vertex correspondence.`);
  return a;
}
function lr(e, t, n) {
  const o = e.loft((n ?? t).map((s) => ({ profile: e.profile.polygon([s.map((i) => [i[0], i[1]])]), at: [0, 0, s[0][2]] })), n ? { ruled: !1, pairing: "closest" } : { ruled: !1 }), r = hn(pn(t)), a = e.volume(o);
  if (!(Math.abs(a - r) <= 1e-7 * Math.abs(r)))
    throw o.dispose(), new E("kernel-failure", `The smooth loft's volume ${a} differs from the volume ${r} of the surface CAD Script defines; the kernel built another surface.`);
  return o;
}
function ts(e, t) {
  let n;
  try {
    n = Wt(t).shape;
  } catch (r) {
    throw r instanceof dn ? new E("invalid-input", `CAD Script: ${r.message}`, { cause: r }) : r;
  }
  const o = e.scope(() => ut(e, n));
  if (!o)
    throw new E("invalid-input", "The program produces no solid.");
  if (!(e.volume(o) > 0))
    throw o.dispose(), new E("kernel-failure", "The exact result has no positive volume.");
  return o;
}
const ns = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} }), Ce = 1048576, tn = 4, fr = Object.freeze({ maxFeatureEdges: 400, maxShellFaces: 160, maxMemoryBytes: 512 * Ce, recycleAboveBytes: 192 * Ce, requestTimeoutMs: 6e4, maxStepImportBytes: 4 * Ce }), os = Object.freeze({ maxFeatureEdges: 1e3, maxShellFaces: 500, maxMemoryBytes: 2048 * Ce, recycleAboveBytes: 512 * Ce, requestTimeoutMs: 12e4, maxStepImportBytes: 16 * Ce }), rs = Object.freeze({ maxFeatureEdges: 1 / 0, maxShellFaces: 1 / 0, maxMemoryBytes: 1 / 0, recycleAboveBytes: 1 / 0, requestTimeoutMs: 1 / 0, maxStepImportBytes: 1 / 0 });
function ss(e, t = fr) {
  const n = { ...t };
  for (const o of Object.keys(t)) {
    const r = e?.[o];
    typeof r == "number" && r > 0 && (n[o] = r);
  }
  return Object.freeze(n);
}
function ur(e) {
  const t = e.requestTimeoutMs;
  return Number.isFinite(t) && t > 0 ? Math.max(1, Math.floor(t / 2e3)) : void 0;
}
function dr(e) {
  const t = ur(e);
  return { ...Number.isFinite(e.maxMemoryBytes) && e.maxMemoryBytes > 0 ? { maxMemoryBytes: e.maxMemoryBytes } : {}, ...t !== void 0 ? { guardSeconds: t } : {} };
}
const hr = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
};
function pr(e, t) {
  const [n, o, r] = t.faceNormal, a = Math.hypot(n, o, r);
  if (!(a > 0))
    return;
  const s = [n / a, o / a, r / a], i = e.filter((c) => {
    if (c.isPlanar === !1 || c.isPlanar === void 0 && c.geomType !== "plane")
      return !1;
    const u = c.normalAt();
    return u.x * s[0] + u.y * s[1] + u.z * s[2] > 1 - 1e-9;
  });
  if (!t.outermost)
    return i.length === 1 ? i[0] : void 0;
  const f = (c) => {
    const u = c.center?.();
    return u ? u.x * s[0] + u.y * s[1] + u.z * s[2] : 0;
  };
  return i.sort((c, u) => f(u) - f(c))[0];
}
function mr(e, t, n = "all") {
  const o = hr(e);
  if (!o)
    return;
  const r = [...o.faces()];
  let a;
  if (t !== "shell" && n !== "all" && "edgeIndices" in n) {
    if (!o.edges)
      return;
    const f = [...o.edges()];
    a = n.edgeIndices.map((c) => f[c]).filter(Boolean);
  } else if (t !== "shell" && n !== "all") {
    const f = pr(r, n);
    if (!f)
      return { edges: 0, curvedEdges: 0, faces: r.length, weightedEdges: 0 };
    a = f.edges();
  } else if (o.edges)
    a = o.edges();
  else {
    const f = /* @__PURE__ */ new Map();
    let c = 0;
    for (const u of r)
      for (const l of u.edges())
        f.set(l._identity?.() ?? String(c++), l);
    a = f.values();
  }
  let s = 0, i = 0;
  for (const f of a)
    s++, f.geomType !== "line" && i++;
  return { edges: s, curvedEdges: i, faces: r.length, weightedEdges: s - i + tn * i };
}
function gr(e, t, n, o) {
  if (!Number.isFinite(o.maxFeatureEdges) && !Number.isFinite(o.maxShellFaces))
    return;
  const r = mr(e, t, n);
  if (r) {
    if (t === "shell") {
      if (r.faces > o.maxShellFaces)
        throw new E("unsupported", _`Shelling a body with ${r.faces} faces is too much for the exact kernel on this device, which allows ${o.maxShellFaces}. Shell a simpler body, or add the holes after shelling.`);
    } else if (r.weightedEdges > o.maxFeatureEdges) {
      const a = Math.floor(o.maxFeatureEdges / tn), s = o.maxFeatureEdges;
      throw new E("unsupported", t === "fillet" ? _`Rounding ${r.edges} edges (${r.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${a} curved or ${s} straight edges per feature. Choose a face with fewer edges.` : _`Beveling ${r.edges} edges (${r.curvedEdges} of them curved) at once is too much for the exact kernel on this device, which allows about ${a} curved or ${s} straight edges per feature. Choose a face with fewer edges.`);
    }
    return r;
  }
}
const yr = 8, ee = (e, t, n) => (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x), Ne = (e, t) => e.x === t.x && e.y === t.y;
function xr(e, t) {
  let n = 0;
  for (let o = 0, r = t.length - 1; o < t.length; r = o++)
    n += e[2 * t[r]] * e[2 * t[o] + 1] - e[2 * t[o]] * e[2 * t[r] + 1];
  return n / 2;
}
function zt(e, t, n) {
  let o, r;
  for (const a of t) {
    const s = { i: a, x: e[2 * a], y: e[2 * a + 1], removed: !1 };
    o ? (r.next = s, s.prev = r) : o = s, r = s, n.push(s);
  }
  return r.next = o, o.prev = r, o;
}
function Je(e, t) {
  const n = e.prev, o = e.next;
  return ee(n, e, o) >= 0 ? ee(e, o, t) > 0 && ee(e, t, n) > 0 : !(ee(e, n, t) > 0 && ee(e, t, o) > 0);
}
function nn(e, t, n, o, r) {
  const a = ee(e, t, o), s = ee(t, n, o), i = ee(n, e, o);
  return r ? a > 0 && s > 0 && i > 0 : a >= 0 && s >= 0 && i >= 0;
}
function wr(e, t, n) {
  const o = { ...e }, r = { ...t }, a = e.next, s = t.prev;
  e.next = t, t.prev = e, o.next = a, a.prev = o, r.next = o, o.prev = r, s.next = r, r.prev = s, n.push(o, r);
}
function vr(e, t) {
  let n, o = 1 / 0, r = t;
  do {
    const c = r.next;
    if (r.y <= e.y && e.y < c.y || c.y <= e.y && e.y < r.y) {
      const u = r.y === e.y ? r.x : c.y === e.y ? c.x : r.x + (e.y - r.y) * (c.x - r.x) / (c.y - r.y);
      if (u === e.x)
        return;
      u > e.x && u < o && (o = u, n = r.y === e.y ? r : c.y === e.y ? c : r.x > c.x ? r : c);
    }
    r = c;
  } while (r !== t);
  if (!n)
    return;
  const a = { x: o, y: e.y };
  let s = n, i = -1 / 0, f = 1 / 0;
  if (n.x !== o || n.y !== e.y) {
    i = (n.x - e.x) / Math.hypot(n.x - e.x, n.y - e.y), f = Math.hypot(n.x - e.x, n.y - e.y);
    const [c, u, l] = ee(e, a, n) > 0 ? [e, a, n] : [e, n, a];
    r = t;
    do {
      if (r !== n && !Ne(r, n) && nn(c, u, l, r, !1) && !(r.x === e.x && r.y === e.y)) {
        const d = Math.hypot(r.x - e.x, r.y - e.y), g = (r.x - e.x) / d;
        (g > i || g === i && d < f) && Je(r, e) && (s = r, i = g, f = d);
      }
      r = r.next;
    } while (r !== t);
  }
  if (!Je(s, e)) {
    r = t;
    do {
      if (Ne(r, s) && Je(r, e))
        return r;
      r = r.next;
    } while (r !== t);
    return;
  }
  return s;
}
function Mr(e, t) {
  if (!t.length || t.some((w) => w.length < 3))
    return null;
  const n = [], o = t.map((w) => xr(e, w));
  if (!(Math.abs(o[0]) > 0))
    return null;
  const r = t.map((w, b) => b === 0 == o[b] > 0 ? w : [...w].reverse()), a = zt(e, r[0], n), s = r.slice(1).map((w) => {
    const b = zt(e, w, n);
    let A = b, C = b.next;
    for (; C !== b; )
      (C.x > A.x || C.x === A.x && C.y > A.y) && (A = C), C = C.next;
    return A;
  });
  s.sort((w, b) => b.x - w.x || b.y - w.y);
  for (const w of s) {
    const b = vr(w, a);
    if (!b)
      return null;
    wr(b, w, n);
  }
  let i = 1 / 0, f = 1 / 0, c = -1 / 0, u = -1 / 0;
  for (const w of n)
    w.x < i && (i = w.x), w.y < f && (f = w.y), w.x > c && (c = w.x), w.y > u && (u = w.y);
  const l = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(n.length / 2)))), d = (c - i) / l || 1, g = (u - f) / l || 1, x = (w, b, A) => Math.min(l - 1, Math.max(0, Math.floor((w - b) / A))), y = Array.from({ length: l * l }, () => []);
  for (const w of n)
    y[x(w.y, f, g) * l + x(w.x, i, d)].push(w);
  const p = (w, b) => {
    const A = w.prev, C = w.next, L = ee(A, w, C);
    if (b ? L < 0 : L <= 0)
      return !1;
    const N = x(Math.min(A.x, w.x, C.x), i, d), O = x(Math.max(A.x, w.x, C.x), i, d), B = x(Math.min(A.y, w.y, C.y), f, g), q = x(Math.max(A.y, w.y, C.y), f, g);
    for (let D = B; D <= q; D++)
      for (let R = N; R <= O; R++)
        for (const F of y[D * l + R])
          if (!(F.removed || F === A || F === w || F === C || Ne(F, A) || Ne(F, w) || Ne(F, C)) && nn(A, w, C, F, !1))
            return !1;
    return !0;
  }, h = [];
  let m = a, M = m, T = !1, v = 0;
  {
    let w = a;
    do
      v++, w = w.next;
    while (w !== a);
  }
  for (; v > 3; ) {
    if (p(m, T)) {
      h.push(m.prev.i, m.i, m.next.i), m.removed = !0, m.prev.next = m.next, m.next.prev = m.prev, v--, m = m.next, M = m, T = !1;
      continue;
    }
    if (m = m.next, m === M) {
      if (T)
        return null;
      T = !0;
    }
  }
  if (ee(m.prev, m, m.next) < 0)
    return null;
  h.push(m.prev.i, m.i, m.next.i);
  const S = o.reduce((w, b, A) => w + (A === 0 ? Math.abs(b) : -Math.abs(b)), 0);
  let $ = 0;
  for (let w = 0; w < h.length; w += 3) {
    const b = h[w], A = h[w + 1], C = h[w + 2];
    $ += ((e[2 * A] - e[2 * b]) * (e[2 * C + 1] - e[2 * b + 1]) - (e[2 * A + 1] - e[2 * b + 1]) * (e[2 * C] - e[2 * b])) / 2;
  }
  return Math.abs($ - S) <= 1e-9 * Math.abs(o[0]) + 1e-12 ? h : null;
}
const on = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
};
class Re {
  constructor() {
    pe(this, "buckets", /* @__PURE__ */ new Map());
  }
  static hash(t, n, o) {
    return Math.imul(t | 0, 73856093) ^ Math.imul(n | 0, 19349663) ^ Math.imul(o | 0, 83492791) ^ Math.imul(Math.floor(t / 4294967296) | 0, 2654435761);
  }
  get(t, n, o) {
    const r = this.buckets.get(Re.hash(t, n, o));
    if (r) {
      for (let a = 0; a < r.length; a += 4)
        if (r[a] === t && r[a + 1] === n && r[a + 2] === o)
          return r[a + 3];
    }
  }
  set(t, n, o, r) {
    const a = Re.hash(t, n, o), s = this.buckets.get(a);
    s ? s.push(t, n, o, r) : this.buckets.set(a, [t, n, o, r]);
  }
}
const ue = (e, t) => e * 67108864 + t, Ye = class Ye {
  constructor() {
    pe(this, "positions", []);
    pe(this, "cells", new Re());
  }
  add(t, n, o) {
    const r = Ye.Q, a = Math.round(t / r), s = Math.round(n / r), i = Math.round(o / r);
    let f = this.cells.get(a, s, i);
    if (f !== void 0)
      return f;
    const c = t / r - a, u = n / r - s, l = o / r - i, d = Math.abs(c) > 0.4 ? Math.sign(c) : 0, g = Math.abs(u) > 0.4 ? Math.sign(u) : 0, x = Math.abs(l) > 0.4 ? Math.sign(l) : 0;
    if (d || g || x) {
      for (const y of d ? [0, d] : [0])
        for (const p of g ? [0, g] : [0])
          for (const h of x ? [0, x] : [0])
            if (f = this.cells.get(a + y, s + p, i + h), f !== void 0)
              return this.cells.set(a, s, i, f), f;
    }
    return f = this.positions.length / 3, this.positions.push(t, n, o), this.cells.set(a, s, i, f), f;
  }
};
pe(Ye, "Q", 1e-6);
let at = Ye;
function br(e) {
  const t = on(e);
  if (!t)
    return !1;
  for (const n of t.faces())
    if (n.geomType === "plane" && n.wires().length >= yr)
      return !0;
  return !1;
}
function it(e, t, n) {
  const o = on(t);
  if (!o)
    return;
  const r = [...o.faces()], a = new at(), s = [], i = n.faces ? [] : void 0, f = i ? new Map(r.map((h, m) => [h._identity(), m])) : void 0;
  let c = 0;
  const u = (h) => {
    if (i && f)
      for (c = f.get(h._identity()); i.length < s.length / 3; )
        i.push(c);
  }, l = /* @__PURE__ */ new Map(), d = (h) => {
    const m = new Uint32Array(h.vertices.length / 3);
    for (let v = 0; v < m.length; v++)
      m[v] = a.add(h.vertices[3 * v], h.vertices[3 * v + 1], h.vertices[3 * v + 2]);
    const M = /* @__PURE__ */ new Set(), T = [];
    for (let v = 0; v < h.triangles.length; v += 3) {
      const S = m[h.triangles[v]], $ = m[h.triangles[v + 1]], w = m[h.triangles[v + 2]];
      S === $ || $ === w || w === S || (s.push(S, $, w), M.add(ue(S, $)), M.add(ue($, w)), M.add(ue(w, S)));
    }
    for (const v of M) {
      const S = Math.floor(v / 67108864), $ = v - S * 67108864;
      M.has(ue($, S)) || T.push([S, $]);
    }
    return T;
  }, g = [], x = n.bands !== !1 ? Sr(r, n) : /* @__PURE__ */ new Map();
  for (const h of r) {
    if (h.geomType === "plane") {
      g.push(h);
      continue;
    }
    l.set(h._identity(), d(x.get(h._identity()) ?? h.mesh(n.tolerance, n.angleDeg))), u(h);
  }
  const y = x.size;
  let p = 0;
  for (const h of g) {
    const m = Tr(h, a, l), M = h.normalAt(), T = [M.x, M.y, M.z], v = Math.abs(T[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], S = Ve(ve(v, T)), $ = ve(T, S);
    let w = null;
    if (m && m.length === h.wires().length) {
      const b = [...new Set(m.flat())], A = new Map(b.map((N, O) => [N, O])), C = new Float64Array(2 * b.length);
      b.forEach((N, O) => {
        const B = a.positions;
        C[2 * O] = B[3 * N] * S[0] + B[3 * N + 1] * S[1] + B[3 * N + 2] * S[2], C[2 * O + 1] = B[3 * N] * $[0] + B[3 * N + 1] * $[1] + B[3 * N + 2] * $[2];
      });
      const L = Mr(C, m.map((N) => N.map((O) => A.get(O))));
      L && (w = L.map((N) => b[N]));
    }
    w ? s.push(...w) : (p++, d(h.mesh(n.tolerance, n.angleDeg))), u(h);
  }
  return { positions: a.positions, indices: s, planar: g.length - p, planarFallbacks: p, bands: y, ...i ? { faceOf: i } : {} };
}
const Er = (e, t) => `${Math.round(e.x * 1e6)},${Math.round(e.y * 1e6)},${Math.round(e.z * 1e6)},${Math.round(t * 1e6)}`, ye = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Te = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]];
function Sr(e, t) {
  const n = /* @__PURE__ */ new Map();
  for (const r of e) {
    const a = r.geomType;
    if (a !== "cylinder" && a !== "cone" && a !== "torus" && a !== "revolution")
      continue;
    const s = [...r.edges()], i = r._identity();
    if (s.length !== 2)
      continue;
    const f = [], c = [], u = [];
    for (const d of s) {
      if (d.geomType !== "circle" || !d.isClosed)
        break;
      const g = [...d.faces()].filter((h) => h._identity() !== i);
      if (g.length !== 1)
        break;
      const x = d.arcCenter, y = d.normal, p = d.radius;
      if (!(p > 0))
        break;
      f.push({ center: [x.x, x.y, x.z], radius: p, normal: Ve([y.x, y.y, y.z]) }), c.push(Er(x, p)), u.push(g[0]);
    }
    if (f.length !== 2 || c[0] === c[1] || Math.abs(ye(f[0].normal, f[1].normal)) < 1 - 1e-9)
      continue;
    let l;
    try {
      l = [0.5, 0.1, 0.25, 0.4, 0.6, 0.75, 0.9].map((d) => {
        const g = r.positionAt(d, d);
        return [g.x, g.y, g.z];
      });
    } catch {
      continue;
    }
    n.set(i, { face: r, id: i, keys: c, others: u, circles: f, samples: l });
  }
  const o = /* @__PURE__ */ new Map();
  for (; ; ) {
    for (let f = !0; f; ) {
      f = !1;
      for (const [c, u] of n)
        u.others.some((l) => l.geomType !== "plane" && !n.has(l._identity())) && (n.delete(c), f = !0);
    }
    const r = /* @__PURE__ */ new Map(), a = (f) => {
      let c = r.get(f) ?? f;
      for (; c !== (r.get(c) ?? c); )
        c = r.get(c);
      return r.set(f, c), c;
    };
    for (const f of n.values()) {
      const c = a(f.keys[0]), u = a(f.keys[1]);
      c !== u && r.set(c, u);
    }
    const s = /* @__PURE__ */ new Map();
    for (const f of n.values()) {
      const c = a(f.keys[0]), u = s.get(c);
      u ? u.push(f) : s.set(c, [f]);
    }
    const i = [];
    o.clear();
    for (const f of s.values()) {
      const c = Ar(f, t);
      if (c)
        for (const [u, l] of c)
          o.set(u, l);
      else
        i.push(...f.map((u) => u.id));
    }
    if (!i.length)
      return o;
    for (const f of i)
      n.delete(f);
  }
}
function Ar(e, t) {
  const n = e[0].circles[0].center, o = e[0].circles[0].normal, r = Math.max(1, ...e.flatMap((p) => p.circles.map((h) => h.radius))), a = (p) => {
    const h = Te(p, n), m = ye(h, o);
    return [Math.hypot(h[0] - m * o[0], h[1] - m * o[1], h[2] - m * o[2]), m];
  }, s = t.angleDeg * Math.PI / 180, i = /* @__PURE__ */ new Map();
  for (const p of e) {
    for (const D of p.circles) {
      if (Math.abs(ye(D.normal, o)) < 1 - 1e-9)
        return;
      const R = Te(D.center, n), F = ye(R, o);
      if (Math.hypot(R[0] - F * o[0], R[1] - F * o[1], R[2] - F * o[2]) > 1e-7 * r)
        return;
    }
    const [h, m] = [p.circles[0].radius, ye(Te(p.circles[0].center, n), o)], [M, T] = [p.circles[1].radius, ye(Te(p.circles[1].center, n), o)], v = 1e-6 * r, S = p.samples.map(a), [$, w] = S[0];
    let b;
    const A = M - h, C = T - m, L = $ - h, N = w - m, O = 2 * (A * N - C * L), B = Math.hypot(A, C);
    if (!(B > v))
      return;
    const q = Math.abs(O) / B <= 2 * v;
    if (q || p.face.geomType === "cylinder" || p.face.geomType === "cone") {
      if (!q)
        return;
      for (const [D, R] of S)
        if (Math.abs((D - h) * C - (R - m) * A) / B > v)
          return;
      if (p.face.geomType === "cylinder" && (Math.abs(h - M) > v || Math.abs(p.face.radius - h) > v))
        return;
      b = [[h, m], [M, T]];
    } else {
      const D = A * A + C * C, R = L * L + N * N, F = (N * D - C * R) / O, de = (A * R - L * D) / O, Ze = h + F, qe = m + de, be = Math.hypot(F, de);
      if (!(be > v) || !Number.isFinite(be))
        return;
      for (const [re, Q] of S)
        if (Math.abs(Math.hypot(re - Ze, Q - qe) - be) > v)
          return;
      const _e = (re, Q) => Math.atan2(Q - qe, re - Ze), De = (re) => (re % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), Ee = _e(h, m);
      let he = De(_e(M, T) - Ee);
      De(_e($, w) - Ee) > he && (he -= 2 * Math.PI);
      for (const [re, Q] of S)
        if ((he > 0 ? De(_e(re, Q) - Ee) : De(Ee - _e(re, Q))) > Math.abs(he) + 1e-9)
          return;
      const ln = Math.min(s, 2 * Math.acos(Math.max(-1, 1 - t.tolerance / be))), ke = Math.max(1, Math.ceil(Math.abs(he) / ln - 1e-9));
      b = Array.from({ length: ke + 1 }, (re, Q) => Q === 0 ? [h, m] : Q === ke ? [M, T] : [Ze + be * Math.cos(Ee + he * Q / ke), qe + be * Math.sin(Ee + he * Q / ke)]);
    }
    if (b.some(([D]) => !(D > v)))
      return;
    i.set(p.id, b);
  }
  const f = [...i.values()].flat().map(([p]) => p), c = Math.max(8, Math.ceil(360 / t.angleDeg - 1e-9), ...f.map((p) => Math.ceil(Math.PI / Math.max(Math.acos(Math.max(-1, 1 - t.tolerance / p)), 1e-9))));
  if (c > 4096)
    return;
  const u = Math.abs(o[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], l = Ve(ve(u, o)), d = ve(o, l), g = Array.from({ length: c }, (p, h) => Math.cos(2 * Math.PI * h / c)), x = Array.from({ length: c }, (p, h) => Math.sin(2 * Math.PI * h / c)), y = /* @__PURE__ */ new Map();
  for (const p of e) {
    const h = i.get(p.id), m = new Float64Array(3 * c * h.length);
    h.forEach(([B, q], D) => {
      for (let R = 0; R < c; R++)
        for (let F = 0; F < 3; F++)
          m[3 * (D * c + R) + F] = n[F] + q * o[F] + B * (g[R] * l[F] + x[R] * d[F]);
    });
    const M = Math.floor((h.length - 1) / 2), T = M * c, v = T + 1, S = T + c + 1, $ = (B) => [m[3 * B], m[3 * B + 1], m[3 * B + 2]], w = $(T), b = $(v), A = $(S), C = [0, 1, 2].map((B) => (w[B] + b[B] + A[B]) / 3);
    let L;
    try {
      L = p.face.normalAt(C);
    } catch {
      return;
    }
    const N = ye(ve(Te(b, w), Te(A, w)), [L.x, L.y, L.z]);
    if (!N)
      return;
    const O = new Uint32Array(6 * c * (h.length - 1));
    for (let B = 0; B + 1 < h.length; B++)
      for (let q = 0; q < c; q++) {
        const D = B * c + q, R = B * c + (q + 1) % c, F = D + c, de = R + c;
        O.set(N > 0 ? [D, R, de, D, de, F] : [D, de, R, D, F, de], 6 * (B * c + q));
      }
    y.set(p.id, { vertices: m, triangles: O });
  }
  return y;
}
const ve = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], Ve = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return e.map((n) => n / t);
};
function Tr(e, t, n) {
  const o = e._identity(), r = e.normalAt(), a = /* @__PURE__ */ new Set(), s = t.positions;
  let i;
  const f = /* @__PURE__ */ new Set();
  for (const v of e.edges()) {
    const S = [...v.faces()].filter((w) => w._identity() !== o);
    if (S.length !== 1)
      return;
    const $ = S[0];
    if ($.geomType === "plane") {
      if (!(v._isStraight ? v._isStraight() : v.geomType === "line"))
        return;
      const w = v.start, b = v.end, A = t.add(w.x, w.y, w.z), C = t.add(b.x, b.y, b.z);
      i ?? (i = r.x * w.x + r.y * w.y + r.z * w.z), A !== C && a.add(A < C ? `${A},${C}` : `${C},${A}`);
    } else if (f.add($._identity()), i === void 0) {
      const w = v.start;
      i = r.x * w.x + r.y * w.y + r.z * w.z;
    }
  }
  if (i === void 0)
    return;
  const c = 2e-5 + 1e-9 * Math.abs(i), u = (v) => Math.abs(r.x * s[3 * v] + r.y * s[3 * v + 1] + r.z * s[3 * v + 2] - i) <= c;
  for (const v of f) {
    const S = n.get(v);
    if (!S)
      return;
    for (const [$, w] of S)
      u($) && u(w) && a.add($ < w ? `${$},${w}` : `${w},${$}`);
  }
  const l = /* @__PURE__ */ new Map();
  for (const v of a) {
    const [S, $] = v.split(",").map(Number);
    for (const [w, b] of [[S, $], [$, S]]) {
      const A = l.get(w);
      A ? A.push(b) : l.set(w, [b]);
    }
  }
  for (const v of l.values())
    if (v.length !== 2)
      return;
  const d = [], g = /* @__PURE__ */ new Set();
  for (const v of l.keys()) {
    if (g.has(v))
      continue;
    const S = [v];
    g.add(v);
    let $ = v, w = l.get(v)[0];
    for (; w !== v; ) {
      if (g.has(w))
        return;
      S.push(w), g.add(w);
      const [b, A] = l.get(w), C = b === $ ? A : b;
      $ = w, w = C;
    }
    if (S.length < 3)
      return;
    d.push(S);
  }
  const x = Math.abs(r.x) < 0.9 ? [1, 0, 0] : [0, 1, 0], y = [r.x, r.y, r.z], p = Ve(ve(x, y)), h = ve(y, p), m = (v) => {
    let S = 0;
    for (let $ = 0, w = v.length - 1; $ < v.length; w = $++) {
      const b = v[w], A = v[$], C = s[3 * b] * p[0] + s[3 * b + 1] * p[1] + s[3 * b + 2] * p[2], L = s[3 * b] * h[0] + s[3 * b + 1] * h[1] + s[3 * b + 2] * h[2], N = s[3 * A] * p[0] + s[3 * A + 1] * p[1] + s[3 * A + 2] * p[2], O = s[3 * A] * h[0] + s[3 * A + 1] * h[1] + s[3 * A + 2] * h[2];
      S += C * O - N * L;
    }
    return Math.abs(S);
  }, M = d.map(m), T = M.indexOf(Math.max(...M));
  return [d[T], ...d.filter((v, S) => S !== T)];
}
const et = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function Nt(e, t) {
  const n = [], o = [], r = new Re(), a = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < a.length; i++) {
    const f = Math.round(e.positions[3 * i] * 1e6), c = Math.round(e.positions[3 * i + 1] * 1e6), u = Math.round(e.positions[3 * i + 2] * 1e6);
    let l = r.get(f, c, u);
    l === void 0 && (l = n.length / 3, r.set(f, c, u, l), n.push(et(e.positions[3 * i]), et(e.positions[3 * i + 1]), et(e.positions[3 * i + 2]))), a[i] = l;
  }
  const s = /* @__PURE__ */ new Map();
  for (let i = 0; i < e.indices.length; i += 3) {
    const f = a[e.indices[i]], c = a[e.indices[i + 1]], u = a[e.indices[i + 2]];
    if (!(f === c || c === u || u === f)) {
      o.push(f, c, u);
      for (const l of [ue(f, c), ue(c, u), ue(u, f)])
        s.set(l, (s.get(l) ?? 0) + 1);
    }
  }
  for (const [i, f] of s) {
    const c = Math.floor(i / 67108864), u = i - c * 67108864;
    if (f !== 1 || s.get(ue(u, c)) !== 1)
      throw new E("kernel-failure", _`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > gn || o.length > yn)
    throw new E("unsupported", _`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (o.length < 12)
    throw new E("kernel-failure", _`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: o };
}
function rn(e, t, n, o = mn) {
  if (br(t))
    for (const r of [!0, !1])
      try {
        const a = it(e, t, { ...o, bands: r });
        if (!a)
          break;
        if (a.bands && a.planarFallbacks)
          continue;
        return Nt(a, n);
      } catch (a) {
        if (a instanceof E && a.code === "unsupported")
          throw a;
      }
  return Nt(e.tessellate(t, o), n);
}
function $r(e, t, n, o = {}) {
  const r = t.nodes[n];
  if (r?.kind !== "exact-feature")
    throw new E("invalid-input", _`${n} is not an exact feature`);
  const a = cn(e, t, n, { local: !0, limits: o.limits, breps: o.breps });
  if (!e.isValid(a))
    throw new E("kernel-failure", _`${r.name}: the exact result is not a valid closed solid.`);
  const s = rn(e, a, r.name);
  return { display: { sourceKey: xn(t, n), ...s }, volume: e.volume(a) };
}
const Bt = 1e-7, Ot = 1e-6, Pr = (e) => e && e.length === 3 && e.every((t) => Number.isFinite(t)) ? "#" + e.map((t) => Math.round(Math.min(1, Math.max(0, t)) * 255).toString(16).padStart(2, "0")).join("") : null, Ft = (e, t) => Math.abs(e - t) / Math.max(Math.abs(t), 1e-12), Rt = (e) => [e[0], e[1], e[2]], Ir = (e) => e?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "";
function Cr(e) {
  if (!(e instanceof E))
    return e;
  const t = e.message;
  let n, o;
  return /^This is not a STEP file/.test(t) ? o = _("This is not a STEP file: it does not start with ISO-10303-21.") : /^The STEP file is incomplete/.test(t) ? o = _("The STEP file is incomplete: it does not end with END-ISO-10303-21; (was it cut short?).") : /^STEP input must not be empty/.test(t) ? o = _("The STEP file is empty.") : /^The STEP file holds no solid/.test(t) ? o = _("The STEP file holds no solid (no B-rep body).") : (n = /^The STEP file is malformed: ([\s\S]*)$/.exec(t)) ? o = _`The STEP file is malformed: ${n[1]}` : (n = /^The STEP file cannot be read exactly: ([\s\S]*)$/.exec(t)) ? o = _`The STEP file cannot be read exactly, so nothing was imported: ${n[1]}` : (n = /^The STEP file's (.*) is an open surface \(a sheet\), not a closed solid\.$/.exec(t)) ? o = _`The STEP file's ${n[1]} is an open surface (a sheet), not a closed solid, so nothing was imported.` : (n = /^The STEP file's (.*) is not a valid closed solid, even after repair\.$/.exec(t)) ? o = _`The STEP file's ${n[1]} is not a valid closed solid, even after repair, so nothing was imported.` : (n = /^The STEP file holds (\d+) bodies; at most (\d+) can be imported\.$/.exec(t)) && (o = _`The STEP file holds ${n[1]} bodies; at most ${n[2]} can be imported at once.`), o ? new E(e.code, o, { cause: e }) : e;
}
function _r(e, t, n) {
  if (!(t instanceof Uint8Array) || !t.byteLength)
    throw new E("invalid-input", _("The STEP file is empty."));
  if (t.byteLength > dt)
    throw new E("unsupported", _`The STEP file is larger than ${dt / 1048576} MiB.`);
  let o;
  try {
    o = e.importStepBodies(t, { maxBodies: wn });
  } catch (s) {
    throw Cr(s);
  }
  const r = n.replace(/\.(step|stp)$/i, "") || "STEP body";
  return { bodies: o.bodies.map(({ solid: s, name: i, color: f }, c) => {
    const u = Ir(i) || (o.bodies.length > 1 ? `${r} ${c + 1}` : r);
    return { name: u, color: Pr(f), body: zr(e, s, u) };
  }), notes: o.notes };
}
function zr(e, t, n) {
  const o = e.volume(t), r = e.area(t), a = e.bbox(t), s = e.exportStep(t);
  if (s.length > ht)
    throw new E("unsupported", _`${n}: its exact B-rep is larger than ${ht / 1048576} MiB as STEP, so it cannot be stored in the model.`);
  return { brep: { format: "step", text: s }, measures: { volume: o, area: r, min: Rt(a.min), max: Rt(a.max) }, display: rn(e, t, n, vn) };
}
function Nr(e, t, n) {
  const o = e.importStepBodies(t.brep.text, { maxBodies: 1 });
  if (o.bodies.length !== 1)
    throw new E("kernel-failure", _`${n}: the stored exact B-rep does not hold exactly one solid.`);
  const r = o.bodies[0].solid, a = e.bbox(r), s = t.measures;
  if (Ft(e.volume(r), s.volume) > Bt || Ft(e.area(r), s.area) > Bt || [0, 1, 2].some((i) => Math.abs(a.min[i] - s.min[i]) > Ot || Math.abs(a.max[i] - s.max[i]) > Ot))
    throw r.dispose(), new E("kernel-failure", _`${n}: its stored exact B-rep does not read back as it was imported (volume, area or box differ), so exact work on it is refused. Import the STEP file again.`);
  return r;
}
function sn(e, t = 16) {
  const n = /* @__PURE__ */ new Map(), o = (a, s) => Nr(e, a, s), r = (a) => `${Mn(a)}|${JSON.stringify(a.measures)}`;
  return {
    /** Read every exact body of `nodes` that is not cached yet. Call outside `k.scope`. The bodies of
     * this request are all kept (a 58-body STEP board measured with only 16 kept read 42 of them
     * twice); older ones are dropped down to `capacity`. */
    warm(a) {
      const s = /* @__PURE__ */ new Set();
      for (const i of a) {
        if (i.kind !== "exact-body")
          continue;
        const f = i, c = r(f), u = n.get(c);
        if (s.add(c), u) {
          n.delete(c), n.set(c, u);
          continue;
        }
        n.set(c, o(f, f.name));
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
class We extends E {
  constructor(n, o) {
    super(n.code, n.message, o);
    pe(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const Be = (e) => {
  throw new E("unsupported", e);
};
function Lt(e, t, n) {
  if (!n?.some((r) => r !== 0))
    return pt([...t]), e.profile.polygon([t]);
  pt([...t], [...n]);
  const o = t.map((r, a) => {
    const s = t[(a + 1) % t.length], i = n[a] ?? 0;
    return i ? { kind: "arc", via: zn(r, s, i), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], o);
}
const Dt = (e, t, n) => {
  const o = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(o, [t[0], t[1]]) : o;
};
function kt(e, t, n) {
  const o = t.profile;
  switch (o.kind) {
    case "rectangle":
      return e.profile.rectangle(me(o.width, n), me(o.depth, n), !0);
    case "circle":
      return Dt(e, o.center ?? [0, 0], me(o.radius, n));
    case "outline":
      return Lt(e, o.points, o.bulges);
    case "region": {
      Sn(o.loops, (s) => me(s, n));
      const r = (s) => s.kind === "circle" ? Dt(e, [me(s.center[0], n), me(s.center[1], n)], me(s.radius, n)) : Lt(e, s.points, s.bulges), a = o.loops.map(r).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, i) => i.area - s.area);
      return e.profile.subtract(a[0].profile, ...a.slice(1).map((s) => s.profile));
    }
    case "path":
      return Be("Close the sketch path before creating a solid.");
    default:
      return Be(`Sketch profile '${o.kind}' has no exact lowering.`);
  }
}
function ze(e, t, n) {
  let o = t;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((r, a) => {
    n[a] && (o = e.rotate(o, r, n[a]));
  }), o;
}
const Br = /* @__PURE__ */ new Set(["box", "cylinder", "sphere", "code", "extrusion", "revolution", "exact-body"]), Or = (e, t, n) => e.nameFaces(t, e.topology(t).faces.map((o) => On(n, o.index))), Fr = (e, t, n, o) => e.nameFaces(t, e.topology(t).faces.map((r) => Nn(r.name) ? Bn(n, o, r.name) : null));
function Rr(e, t) {
  try {
    const { copies: n, node: o, face: r } = bn(t), a = _`${e.nodes[o]?.name ?? o} face ${r + 1}`;
    return n.length ? a + " (" + n.map(({ pattern: s, copy: i }) => _`copy ${i + 1} of ${e.nodes[s]?.name ?? s}`).join(", ") + ")" : a;
  } catch {
    return t;
  }
}
function Lr(e, t, n, o) {
  return En(e.topology(n), o, (r) => Rr(t, r));
}
function Pe(e, t, n, o, r, a, s = !1, i) {
  const f = s ? "named:" + n : n, c = r.get(f);
  if (c)
    return c;
  const u = t.nodes[n];
  let l;
  try {
    switch (u.kind) {
      case "box":
        l = e.box(u.size);
        break;
      case "cylinder":
        l = e.cylinder(u.radius, u.height);
        break;
      case "sphere":
        l = e.sphere(u.radius);
        break;
      case "code": {
        const y = ut(e, Wt(u.program).shape);
        if (!y)
          throw new E("invalid-input", "Code produces no printable solid.");
        l = y;
        break;
      }
      case "extrusion": {
        const { distance: y, start: p, plane: h } = Cn(u, t);
        l = e.extrude(kt(e, t.sketches[u.sketchId], t), y), p && (l = e.translate(l, [0, 0, p])), h === "XZ" ? l = ze(e, l, [90, 0, 0]) : h === "YZ" && (l = ze(e, l, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: y, angle: p, axisOffset: h } = In(u, t);
        let m = kt(e, t.sketches[u.sketchId], t);
        h && (m = e.profile.translate(m, [-h, 0])), l = en(e, m, p), y === "XY" ? l = ze(e, l, [-90, 0, 0]) : y === "YZ" && (l = ze(e, l, [0, 0, 90])), h && (l = e.translate(l, y === "YZ" ? [0, h, 0] : [h, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: y, offset: p } = Pn(u, t), h = [0, 0, 0];
        if (h[y] = 1, l = e.mirror(Pe(e, t, u.source, o, r, a, s, i), h), p) {
          const m = [0, 0, 0];
          m[y] = 2 * p, l = e.translate(l, m);
        }
        break;
      }
      case "pattern": {
        const y = $n(u, t), p = Pe(e, t, u.source, o, r, a, s, i), h = [p];
        if (y.mode === "linear")
          for (let m = 1; m < y.count; m++) {
            const M = [0, 0, 0];
            M[y.axis] = m * y.spacing, h.push(e.translate(p, M));
          }
        else {
          const m = y.sweep / (Math.abs(y.sweep) === 360 ? y.count : y.count - 1), M = [0, 0, 0];
          M[y.axis] = 1;
          for (let T = 1; T < y.count; T++)
            h.push(e.rotate(p, M, T * m, y.center));
        }
        s && h.forEach((m, M) => {
          h[M] = Fr(e, m, n, M);
        }), l = e.union(h[0], ...h.slice(1));
        break;
      }
      case "boolean": {
        const y = u.inputs.map((p) => Pe(e, t, p, o, r, a, s, i));
        if (u.useHoleRoles) {
          const p = y.filter((M, T) => t.nodes[u.inputs[T]].role !== "hole"), h = y.filter((M, T) => t.nodes[u.inputs[T]].role === "hole");
          p.length || Be("A combination of holes only has no solid to export.");
          const m = p.length > 1 ? e.union(p[0], ...p.slice(1)) : p[0];
          l = h.length ? e.subtract(m, ...h) : m;
        } else
          l = u.operation === "union" ? e.union(y[0], ...y.slice(1)) : u.operation === "subtract" ? e.subtract(y[0], ...y.slice(1)) : e.intersect(y[0], ...y.slice(1));
        break;
      }
      case "exact-feature": {
        const y = An(u, t), p = Tn(y.edges) ? y.edges.references : void 0, h = Pe(e, t, u.source, o, r, a, s || !!p, i), m = p ? { edgeIndices: Lr(e, t, h, p) } : y.edges;
        a && gr(h, y.operation, m, a), l = y.operation === "fillet" ? e.fillet(h, y.size, m) : y.operation === "chamfer" ? e.chamfer(h, y.size, m) : e.shell(h, y.size, y.openFaces);
        break;
      }
      case "exact-body":
        l = i ? i.solid(u) : sn(e, 0).solid(u);
        break;
      case "mesh":
        return Be(u.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return Be(`'${u.kind}' has no exact lowering.`);
    }
    s && Br.has(u.kind) && (l = Or(e, l, n));
    const { scale: d, rotation: g, position: x } = u.transform;
    d.some((y) => y !== 1) && (l = e.scale(l, d)), l = ze(e, l, g), x.some((y) => y !== 0) && (l = e.translate(l, x));
  } catch (d) {
    if (d instanceof We)
      throw d;
    const g = d instanceof E ? d.code : "invalid-input";
    if (d instanceof _n)
      throw new We({ code: "invalid-input", bodyId: o, nodeId: n, feature: u.kind, reason: d.code, message: `${u.name}: ${d.message}` }, { cause: d });
    let x = d instanceof Error ? d.message : String(d);
    const y = /the kernel did not finish within ([\d.]+) s/.exec(x);
    throw y && (x = _`The exact kernel stopped this step at its own ${y[1]} s limit, so it was not built. The model was not changed. Try a simpler body.`), new We({ code: g, bodyId: o, nodeId: n, feature: u.kind, message: `${u.name} (${u.kind}): ${x}` }, { cause: d });
  }
  return r.set(f, l), l;
}
function an(e, t, n, o = {}) {
  if (!t.roots.includes(n))
    throw new E("invalid-input", `${n} is not a top-level body.`);
  return Pe(e, t, n, n, /* @__PURE__ */ new Map(), o.limits, !1, o.breps);
}
function cn(e, t, n, o = {}) {
  const r = t.nodes[n];
  if (!r)
    throw new E("invalid-input", `${n} is not a node of this model.`);
  const a = o.local ? { ...t, nodes: { ...t.nodes, [n]: { ...r, transform: Fn() } } } : t, s = t.roots.find((i) => i === n) ?? n;
  return Pe(e, a, n, s, /* @__PURE__ */ new Map(), o.limits, o.named, o.breps);
}
const Xt = 2e3, jt = 6e3, ct = 4e5;
function Dr(e) {
  const t = Math.hypot(...e.max.map((n, o) => n - e.min[o]));
  return Math.min(0.05, Math.max(0.01, t * 2e-4));
}
const kr = (e) => e.flatMap((t) => [t[0], t[1], t[2]]);
function Xr(e, t, n, o, r = { triangles: ct }) {
  const a = e.topology(t);
  if (a.faces.length > Xt || a.edges.length > jt)
    throw new E("unsupported", _`${o} has ${a.faces.length} faces and ${a.edges.length} edges, more than an exact drawing takes (${Xt} and ${jt}).`);
  const s = e.bbox(t), i = { min: [...s.min], max: [...s.max] }, f = Dr(i);
  let c = it(e, t, { tolerance: f, angleDeg: 10, faces: !0 });
  if (c?.bands && c.planarFallbacks && (c = it(e, t, { tolerance: f, angleDeg: 10, bands: !1, faces: !0 })), !c?.faceOf)
    throw new E("unsupported", _`${o}: the exact kernel did not mesh the body face by face.`);
  const u = c.indices.length / 3;
  if (u > r.triangles)
    throw new E("unsupported", _`${o}: the exact drawing would need more than ${ct} triangles.`);
  return r.triangles -= u, {
    id: n,
    name: o,
    tolerance: f,
    bounds: i,
    faces: a.faces.map((l) => ({
      surface: l.surface,
      point: [...l.point],
      normal: [...l.normal],
      ...l.radius !== void 0 ? { radius: l.radius } : {},
      ...l.axis ? { axis: { origin: [...l.axis.origin], direction: [...l.axis.direction] } } : {}
    })),
    edges: a.edges.map((l) => ({
      curve: l.curve,
      faces: [...l.faces],
      points: kr(l.points),
      closed: l.closed,
      length: l.length,
      ...l.curve === "circle" && l.radius !== void 0 && l.center && l.axis ? { circle: { center: [...l.center], radius: l.radius, axis: [...l.axis] } } : {}
    })),
    mesh: { positions: Float64Array.from(c.positions), indices: Uint32Array.from(c.indices), faceOf: Uint32Array.from(c.faceOf) }
  };
}
function jr(e, t, n, o) {
  const r = [], a = [], s = { triangles: ct };
  for (const i of n) {
    const f = t.nodes[i].name;
    try {
      r.push(e.scope(() => {
        const c = an(e, t, i, { limits: o.limits, breps: o.breps });
        if (!e.isValid(c))
          throw new E("kernel-failure", _`${f}: the exact result is not a valid closed solid.`);
        return Xr(e, c, i, f, s);
      }));
    } catch (c) {
      if (o.fatal(c))
        throw c;
      const u = c instanceof We ? c.diagnostic.code : c instanceof E ? c.code : "kernel-failure";
      a.push({ id: i, name: f, code: u, message: c instanceof Error ? c.message : String(c) });
    }
  }
  return { bodies: r, failures: a };
}
const Ie = 64, Ur = 64 * 1024 * 1024, Ut = 5e3;
function Wr(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const o of n) {
      if (!e.roots.includes(o))
        throw new E("invalid-input", _`Unknown object id: ${o}`);
      const r = e.nodes[o];
      if (r.reference)
        throw new E("invalid-input", _`${r.name} is a reference body and is never exported or measured.`);
      if (r.role === "hole")
        throw new E("invalid-input", _`${r.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((o) => !e.nodes[o].reference && e.nodes[o].role !== "hole");
  if (!n.length)
    throw new E("invalid-input", _("The design has no solid bodies to export"));
  if (n.length > Ie)
    throw new E("invalid-input", _`Exact commands are limited to ${Ie} bodies.`);
  return n;
}
function tt(e, t) {
  const n = /* @__PURE__ */ new Set(), o = (r) => {
    n.has(r) || (n.add(r), Dn(e.nodes[r]).forEach(o));
  };
  return t.forEach(o), [...n].map((r) => e.nodes[r]);
}
const Gr = (e) => [1, 3, 5].map((t) => parseInt(e.slice(t, t + 2), 16) / 255), Hr = (e) => e.length > 0 && e.length <= 1e3 && ![...e].some((t) => t.charCodeAt(0) < 32 || t.charCodeAt(0) === 127);
function Kr(e, t = e.maxMemoryBytes) {
  const n = Object.freeze({ ...Qo, smlib: e.version, licence: e.licence }), o = sn(e), r = (s, i) => {
    const f = Qe(s), c = Wr(f, i);
    return o.warm(tt(f, c)), { doc: f, targets: c };
  }, a = ({ doc: s, targets: i }, f = {}) => ({ doc: s, targets: i, solids: i.map((c) => {
    const u = an(e, s, c, { ...f, breps: o });
    if (!e.isValid(u))
      throw new E("kernel-failure", _`${s.nodes[c].name}: the exact result is not a valid closed solid.`);
    return u;
  }) });
  return {
    kernel: e,
    info: n,
    ...t ? { memoryCapBytes: t } : {},
    measure(s, i, f) {
      const c = r(s, i);
      return e.scope(() => {
        const { doc: u, targets: l, solids: d } = a(c, f);
        return { kernel: n, bodies: d.map((g, x) => {
          const y = e.bbox(g), p = e.massProperties(g);
          return { id: l[x], name: u.nodes[l[x]].name, volume: e.volume(g), area: e.area(g), bounds: { min: [...y.min], max: [...y.max] }, centroid: [...p.centroid], solids: e.solidCount(g) };
        }) };
      });
    },
    edges(s, i, f = {}) {
      const c = Qe(s), u = [...new Set(i)];
      if (!u.length)
        throw new E("invalid-input", _("Name or select the bodies whose edges to list."));
      if (u.length > Ie)
        throw new E("invalid-input", _`Exact commands are limited to ${Ie} bodies.`);
      for (const l of u)
        if (!c.nodes[l] || !c.roots.includes(l) && !Object.values(c.nodes).some((d) => d.kind === "exact-feature" && d.source === l))
          throw new E("invalid-input", _`Unknown object id: ${l}`);
      return o.warm(tt(c, u)), { kernel: n, bodies: u.map((l) => e.scope(() => {
        const d = cn(e, c, l, { named: !0, limits: f.limits, breps: o }), g = e.topology(d);
        if (g.edges.length > Ut)
          throw new E("unsupported", _`${c.nodes[l].name} has ${g.edges.length} edges, more than ${Ut} can be listed. Fillet every edge or a face instead.`);
        const x = Ln(g);
        return { id: l, name: c.nodes[l].name, edges: g.edges.map((y, p) => {
          const h = x[p];
          return { number: p + 1, curve: y.curve, length: y.length, points: y.points.map((m) => [...m]), ...h.reference ? { reference: h.reference } : { unreferable: h.reason } };
        }) };
      })) };
    },
    featureDisplays(s, i, f = {}) {
      const c = Qe(s), u = i?.length ? [...new Set(i)] : Rn(c);
      if (u.length > Ie)
        throw new E("invalid-input", _`Exact commands are limited to ${Ie} bodies.`);
      for (const l of u)
        if (c.nodes[l]?.kind !== "exact-feature")
          throw new E("invalid-input", _`${l} is not an exact feature`);
      return o.warm(tt(c, u)), { kernel: n, features: u.map((l) => e.scope(() => ({ id: l, name: c.nodes[l].name, ...$r(e, c, l, { ...f, breps: o }) }))) };
    },
    drawing(s, i, f = {}) {
      const { doc: c, targets: u } = r(s, i);
      return { kernel: n, ...jr(e, c, u, { limits: f.limits, breps: o, fatal: Vr }) };
    },
    importStep(s, i, f = {}) {
      const c = f.limits?.maxStepImportBytes;
      if (c !== void 0 && s.byteLength > c)
        throw new E("unsupported", _`${i} is ${(s.byteLength / 1048576).toFixed(1)} MiB; this device imports STEP files of up to ${Math.round(c / 1048576)} MiB. Import it on a computer, or split the assembly.`);
      return { kernel: n, ...e.scope(() => _r(e, s, i)) };
    },
    exportStep(s, i, f) {
      const c = r(s, i);
      return e.scope(() => {
        const { doc: u, targets: l, solids: d } = a(c, f);
        if (d.length > 1) {
          const y = d.reduce((h, m) => h + e.solidCount(m), 0), p = e.union(d[0], ...d.slice(1));
          if (e.solidCount(p) !== y) {
            for (let h = 0; h < d.length; h++)
              for (let m = h + 1; m < d.length; m++)
                if (e.solidCount(e.union(d[h], d[m])) < e.solidCount(d[h]) + e.solidCount(d[m]))
                  throw new E("unsupported", _`${u.nodes[l[h]].name} and ${u.nodes[l[m]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new E("unsupported", _("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const g = e.exportStep(l.map((y, p) => ({ solid: d[p], name: u.nodes[y].name, color: Gr(u.nodes[y].color) })), l.length > 1 && Hr(u.title) ? { product: u.title } : {}), x = new TextEncoder().encode(g).byteLength;
        if (x > Ur)
          throw new E("unsupported", _("The STEP file exceeds 64 MiB."));
        return { kernel: n, bodies: l.map((y) => ({ id: y, name: u.nodes[y].name })), step: g, bytes: x };
      });
    }
  };
}
let Xe;
function Yr(e = {}) {
  return Xe ?? (Xe = Yo(e).then((t) => Kr(t), (t) => {
    throw Xe = void 0, t;
  })), Xe;
}
function Vr(e) {
  for (let t = e, n = 0; t && n < 8; t = t.cause, n++) {
    if (typeof WebAssembly < "u" && t instanceof WebAssembly.RuntimeError || t instanceof RangeError && /memory|allocat/i.test(t.message))
      return !0;
    const o = t instanceof Error ? t.message : typeof t == "string" ? t : "";
    if (/\bAborted\(|out of memory|memory access out of bounds|bad_alloc|Cannot enlarge memory|memory may be damaged|kernel crashed/i.test(o))
      return !0;
  }
  return !1;
}
const Zr = (e) => {
  const t = e.step?.bytes;
  if (t instanceof Uint8Array)
    return t;
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t);
  throw new E("invalid-input", _("Give the STEP file to import."));
};
function qr(e, t, n = 0, o = {}) {
  const r = performance.now();
  return { ...t.operation === "measure" ? { operation: "measure", ...e.measure(t.document, t.bodies, o) } : t.operation === "feature-display" ? { operation: "feature-display", ...e.featureDisplays(t.document, t.bodies, o) } : t.operation === "edges" ? { operation: "edges", ...e.edges(t.document, t.bodies, o) } : t.operation === "drawing" ? { operation: "drawing", ...e.drawing(t.document, t.bodies, o) } : t.operation === "import-step" ? { operation: "import-step", ...e.importStep(Zr(t), t.step.name, o) } : { operation: "export-step", ...e.exportStep(t.document, t.bodies, o) }, timing: { loadMs: n, runMs: performance.now() - r, memoryBytes: e.kernel.memory().heap } };
}
function as(e = {}) {
  const { limits: t, ...n } = e, o = { ...t && typeof t.maxMemoryBytes == "number" && typeof t.requestTimeoutMs == "number" ? dr(t) : {}, ...n }, r = () => new Error(_("Request cancelled"));
  return {
    async run(a, s) {
      if (s?.aborted)
        throw r();
      const i = performance.now(), f = await Yr(o), c = performance.now();
      if (s?.aborted || (await new Promise((l) => setTimeout(l, 0)), s?.aborted))
        throw r();
      const u = qr(f, a, c - i, { limits: t });
      if (s?.aborted)
        throw r();
      return u;
    }
  };
}
export {
  tn as CURVED_EDGE_WEIGHT,
  qo as EXACT_KERNEL_ID,
  Vo as EXACT_KERNEL_PACKAGE,
  Zo as EXACT_KERNEL_VERSION,
  os as EXACT_LIMITS_DESKTOP,
  rs as EXACT_LIMITS_NONE,
  fr as EXACT_LIMITS_TABLET,
  E as ExactKernelError,
  We as ExactLoweringError,
  yr as MANY_LOOPS,
  jt as MAX_DRAWING_EDGES,
  Xt as MAX_DRAWING_FACES,
  ct as MAX_DRAWING_TRIANGLES,
  Ie as MAX_EXACT_BODIES,
  Ut as MAX_LISTED_EDGES,
  Ct as MAX_POLYHEDRON_FACES,
  Ur as MAX_STEP_BYTES,
  It as MIN_EXACT_SEGMENTS,
  ns as cadScript,
  gr as checkExactFeatureCost,
  sn as createBrepCache,
  Yr as createExactBackend,
  Kr as createExactBackendFromKernel,
  as as createInThreadExactHost,
  Rr as describeExactFace,
  Nt as displayMesh,
  rn as displayTessellation,
  Dr as drawingMeshTolerance,
  ts as evaluateCadScript,
  Xr as exactDrawingBody,
  jr as exactDrawingData,
  mr as exactFeatureCost,
  $r as exactFeatureDisplay,
  ur as exactGuardSeconds,
  Qo as exactKernelIdentity,
  dr as exactKernelOptions,
  Wr as exactTargets,
  it as facewiseMesh,
  _r as importStepBodies,
  Vr as isFatalExactError,
  ut as lowerCodeShape,
  an as lowerDocumentBody,
  cn as lowerDocumentNode,
  Nr as readStoredBody,
  ss as resolveExactLimits,
  Lr as resolveFeatureEdges,
  en as revolveProfile,
  qr as runExactRequest,
  kt as sketchProfile,
  zr as storedBody,
  Mr as triangulatePolygon
};
