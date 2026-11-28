import { t as h } from "./geometry.worker-RK0f-gvM.js";
import { c as De, T as Te, a as we } from "./printability-CZ7dAjWG.js";
const Ie = 1, Ne = Object.freeze(["fdm", "cnc", "laser", "molding"]), ge = Object.freeze(["+x", "-x", "+y", "-y", "+z", "-z"]), Oe = Object.freeze({
  process: "cnc",
  exact: !0,
  nozzleMm: 0.4,
  minHoleMm: 2,
  maxOverhangDeg: 45,
  maxBridgeMm: 10,
  bedSizeMm: Object.freeze({ x: 220, y: 220, z: 250 }),
  toolDiameterMm: 6,
  approachAxes: Object.freeze(["+z"]),
  maxUndercutAreaMm2: 1,
  maxPocketDepthRatio: 4,
  dogbones: !1,
  pullAxis: "+z",
  minDraftDeg: 1,
  wallVariation: 0.4,
  edgeBreak: "none"
}), re = (e, t = 1e5) => typeof e == "number" && Number.isFinite(e) && e > 0 && e <= t;
function Ce(e = {}) {
  const t = Oe, n = { ...t, ...Object.fromEntries(Object.entries(e).filter(([, o]) => o !== void 0)), bedSizeMm: { ...t.bedSizeMm, ...e.bedSizeMm } };
  if (!Ne.includes(n.process))
    throw new RangeError(h("Choose the process fdm, cnc, laser or molding."));
  for (const [o, l] of [["nozzleMm", n.nozzleMm], ["minHoleMm", n.minHoleMm], ["maxBridgeMm", n.maxBridgeMm], ["toolDiameterMm", n.toolDiameterMm], ["bedSizeMm.x", n.bedSizeMm.x], ["bedSizeMm.y", n.bedSizeMm.y], ["bedSizeMm.z", n.bedSizeMm.z]])
    if (!re(l))
      throw new RangeError(h`${o} must be a positive number of millimetres.`);
  for (const [o, l] of [["minWallMm", n.minWallMm], ["maxWallMm", n.maxWallMm], ["minRadiusMm", n.minRadiusMm], ["maxRadiusMm", n.maxRadiusMm]])
    if (l !== void 0 && !re(l))
      throw new RangeError(h`${o} must be a positive number of millimetres.`);
  if (!(typeof n.maxUndercutAreaMm2 == "number" && n.maxUndercutAreaMm2 >= 0 && Number.isFinite(n.maxUndercutAreaMm2)))
    throw new RangeError(h("The tolerated undercut area must be zero or more square millimetres."));
  if (!(n.maxOverhangDeg > 0 && n.maxOverhangDeg < 90))
    throw new RangeError(h("The overhang angle must be between 0 and 90 degrees."));
  if (!re(n.maxPocketDepthRatio, 1e3))
    throw new RangeError(h("The pocket depth ratio must be a positive number of tool diameters."));
  if (!(typeof n.minDraftDeg == "number" && n.minDraftDeg >= 0 && n.minDraftDeg < 45))
    throw new RangeError(h("The draft angle must be from 0 to 45 degrees."));
  if (!(typeof n.wallVariation == "number" && n.wallVariation > 0 && n.wallVariation < 1))
    throw new RangeError(h("The wall variation must be a fraction between 0 and 1."));
  if (!ge.includes(n.pullAxis))
    throw new RangeError(h("The pull direction is +x, -x, +y, -y, +z or -z."));
  if (n.minWallMm !== void 0 && n.maxWallMm !== void 0 && n.minWallMm > n.maxWallMm)
    throw new RangeError(h("The minimum wall is thicker than the maximum wall."));
  if (n.minRadiusMm !== void 0 && n.maxRadiusMm !== void 0 && n.minRadiusMm > n.maxRadiusMm)
    throw new RangeError(h("The minimum radius is larger than the maximum radius."));
  if (!["none", "external", "internal", "all"].includes(n.edgeBreak))
    throw new RangeError(h("Edge breaks are none, external, internal or all."));
  const s = [...new Set(n.approachAxes)];
  if (!s.length || s.some((o) => !ge.includes(o)))
    throw new RangeError(h("Tool approach axes are +x, -x, +y, -y, +z or -z."));
  return Object.freeze({ ...n, exact: n.exact !== !1, dogbones: n.dogbones === !0, approachAxes: Object.freeze(s), bedSizeMm: Object.freeze({ ...n.bedSizeMm }) });
}
const le = 25, Pe = 6e3, $e = 4e4, ce = 1e-4, We = 0.5, Be = 12, F = 0.98, Q = 0.2, Y = 1e-6, Fe = 0.035, ue = Math.PI / 180, y = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], D = (e, t) => [e[0] + t[0], e[1] + t[1], e[2] + t[2]], v = (e, t) => [e[0] * t, e[1] * t, e[2] * t], $ = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], L = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], N = (e) => Math.hypot(e[0], e[1], e[2]), T = (e) => {
  const t = N(e);
  return t > 0 ? [e[0] / t, e[1] / t, e[2] / t] : [0, 0, 0];
}, Ue = (e, t) => Math.acos(Math.min(1, Math.max(-1, $(e, t)))), b = (e) => Number(e.toFixed(3)).toLocaleString(void 0, { maximumFractionDigits: 3 }), ye = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] }, ee = (e, t) => [e.positions[3 * t], e.positions[3 * t + 1], e.positions[3 * t + 2]], X = (e, t) => [ee(e, e.indices[3 * t]), ee(e, e.indices[3 * t + 1]), ee(e, e.indices[3 * t + 2])], G = (e, t) => [e.normal[3 * t], e.normal[3 * t + 1], e.normal[3 * t + 2]], H = (e, t) => [e.centroid[3 * t], e.centroid[3 * t + 1], e.centroid[3 * t + 2]];
function ve(e, t, n) {
  const s = t.length / 3, o = new Float64Array(3 * s), l = new Float64Array(3 * s), g = new Float64Array(s), m = { positions: e, indices: t };
  let k = 0;
  const x = [1 / 0, 1 / 0, 1 / 0], c = [-1 / 0, -1 / 0, -1 / 0];
  for (let a = 0; a < s; a++) {
    const [f, i, u] = X(m, a), r = L(y(i, f), y(u, f)), p = N(r);
    k += $(f, L(i, u)) / 6;
    for (const d of [f, i, u])
      for (let M = 0; M < 3; M++)
        x[M] = Math.min(x[M], d[M]), c[M] = Math.max(c[M], d[M]);
    p > 0 && o.set([r[0] / p, r[1] / p, r[2] / p], 3 * a), l.set([(f[0] + i[0] + u[0]) / 3, (f[1] + i[1] + u[1]) / 3, (f[2] + i[2] + u[2]) / 3], 3 * a), g[a] = p / 2;
  }
  if (k < 0)
    for (let a = 0; a < o.length; a++)
      o[a] = -o[a];
  return { positions: e, indices: t, normal: o, centroid: l, area: g, count: s, bvh: new Te({ vertices: e, triangles: t }), diagonal: s ? N(y(c, x)) : 0, ...n ? { faceOf: n } : {} };
}
function fe(e) {
  if (!e.axis)
    return 1;
  const t = T(e.axis.direction), n = y(e.point, e.axis.origin), s = y(n, v(t, $(n, t)));
  return $(e.normal, s) >= 0 ? 1 : -1;
}
function te(e, t, n) {
  const s = T(t), o = y(n, e);
  return T(y(o, v(s, $(o, s))));
}
function he(e, t, n) {
  const s = e.faces[t];
  switch (s.surface) {
    case "plane":
      return [...s.normal];
    case "cylinder":
      return s.axis ? v(te(s.axis.origin, s.axis.direction, n), fe(s)) : void 0;
    case "cone": {
      if (!s.axis)
        return;
      const o = T(s.axis.direction), l = te(s.axis.origin, o, s.point), g = $(s.normal, l), m = $(s.normal, o);
      return T(D(v(te(s.axis.origin, o, n), g), v(o, m)));
    }
    case "sphere": {
      if (!s.axis)
        return;
      const o = s.axis.origin, l = $(s.normal, y(s.point, o)) >= 0 ? 1 : -1;
      return v(T(y(n, o)), l);
    }
    case "torus": {
      if (!s.axis || s.radius === void 0)
        return;
      const o = s.axis.origin, l = T(s.axis.direction), g = [1, -1].map((f) => ({ s: f, c: y(s.point, v(s.normal, f * s.radius)) })), { s: m, c: k } = g.sort((f, i) => Math.abs($(y(f.c, o), l)) - Math.abs($(y(i.c, o), l)))[0], x = y(k, o), c = N(y(x, v(l, $(x, l)))), a = D(o, v(te(o, l, n), c));
      return v(T(y(n, a)), m);
    }
    default:
      return;
  }
}
function se(e, t, n) {
  let s = -1, o = 1 / 0;
  for (const l of e.faceTris[t] ?? []) {
    const [g, m, k] = X(e.surface, l), x = we(n, g, m, k), c = N(y(x, n));
    c < o && (o = c, s = l);
  }
  return s;
}
function pe(e, t, n) {
  const s = he(e.body, t, n);
  if (s && N(s) > 0)
    return { n: s, exact: !0 };
  const o = se(e, t, n);
  return { n: o >= 0 ? G(e.surface, o) : [...e.body.faces[t].normal], exact: !1 };
}
const je = (e, t) => {
  const n = Math.max(1, e.radius);
  if (Math.abs(e.radius - t.radius) > 1e-6 * n || N(L(e.direction, t.direction)) > 1e-6)
    return !1;
  const s = y(t.origin, e.origin);
  return N(y(s, v(e.direction, $(s, e.direction)))) < 1e-5 * n;
};
function qe(e) {
  const t = ve(e.mesh.positions, e.mesh.indices, e.mesh.faceOf), n = e.faces.map(() => []), s = e.faces.map(() => 0);
  for (let c = 0; c < t.count; c++) {
    const a = e.mesh.faceOf[c];
    n[a]?.push(c), s[a] += t.area[c];
  }
  const o = e.faces.map(() => []);
  e.edges.forEach((c, a) => new Set(c.faces).forEach((f) => o[f]?.push(a)));
  const l = { body: e, surface: t, faceTris: n }, g = [], m = /* @__PURE__ */ new Map();
  e.faces.forEach((c, a) => {
    if (c.surface !== "cylinder" || !c.axis || c.radius === void 0)
      return;
    const f = { radius: c.radius, origin: [...c.axis.origin], direction: T(c.axis.direction) };
    let i = g.find((u) => je(u, f) && u.concave === fe(c) < 0);
    i || (i = { faces: [], ...f, concave: fe(c) < 0, full: !1, hMin: 1 / 0, hMax: -1 / 0, span: 0 }, g.push(i)), i.faces.push(a), m.set(a, i);
  });
  for (let c = 0; c < g.length; c++) {
    const a = g[c], f = a.direction, i = T(L(Math.abs(f[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], f)), u = L(f, i), r = new Uint8Array(720);
    let p = 1 / 0, d = -1 / 0;
    for (const A of a.faces)
      for (const R of n[A]) {
        const E = X(t, R).map((I) => {
          const W = y(I, a.origin), U = $(W, f);
          return p = Math.min(p, U), d = Math.max(d, U), (Math.atan2($(W, u), $(W, i)) + 2 * Math.PI) % (2 * Math.PI);
        }).sort((I, W) => I - W), C = [E[1] - E[0], E[2] - E[1], E[0] + 2 * Math.PI - E[2]], B = C.indexOf(Math.max(...C)), S = E[(B + 1) % 3], P = 2 * Math.PI - C[B];
        for (let I = 0; I < 720; I++)
          ((I + 0.5) * Math.PI / 360 - S + 4 * Math.PI) % (2 * Math.PI) <= P && (r[I] = 1);
      }
    const M = (720 - r.reduce((A, R) => A + R, 0)) * Math.PI / 360, w = { ...a, full: M < Fe, hMin: p, hMax: d, span: 2 * Math.PI - M };
    g[c] = w;
    for (const A of w.faces)
      m.set(A, w);
  }
  const k = (c, a) => {
    const f = e.faces[c], i = e.faces[a];
    return m.get(c) && m.get(c) === m.get(a) ? !0 : f.surface === "plane" && i.surface === "plane" ? $(f.normal, i.normal) > 1 - 1e-9 && Math.abs($(f.normal, y(i.point, f.point))) < 1e-6 : f.surface === i.surface && f.surface !== "plane" && f.axis && i.axis && f.radius !== void 0 && f.radius === i.radius ? N(y(f.axis.origin, i.axis.origin)) < 1e-6 && N(L(T(f.axis.direction), T(i.axis.direction))) < 1e-6 : !1;
  }, x = e.edges.map((c, a) => {
    const f = c.points.length / 3, i = (j) => [c.points[3 * j], c.points[3 * j + 1], c.points[3 * j + 2]], u = Math.floor((f - 1) / 2), r = f === 2 ? v(D(i(0), i(1)), 0.5) : i(u), p = T(y(i(Math.min(u + 1, f - 1)), i(Math.max(u - 1, 0)))), d = y(i(f - 1), i(0)), M = N(d), w = c.curve === "line" || !c.closed && M > 1e-9 && Array.from({ length: f }, (j, q) => q).every((j) => {
      const q = y(i(j), i(0));
      return N(y(q, v(d, $(q, d) / M ** 2))) < 1e-6 * Math.max(1, M);
    });
    if (c.faces.length !== 2 || c.faces[0] === c.faces[1])
      return { index: a, kind: "seam", point: r, tangent: p, angleDeg: 0, approximate: !1, line: w };
    const [A, R] = c.faces;
    if (k(A, R))
      return { index: a, kind: "seam", point: r, tangent: p, angleDeg: 0, approximate: !1, line: w };
    const E = pe(l, A, r), C = pe(l, R, r), B = Ue(E.n, C.n) / ue, S = !E.exact || !C.exact, P = [E.n, C.n];
    if (B < (S ? Be : We))
      return { index: a, kind: "tangent", point: r, tangent: p, normals: P, angleDeg: B, approximate: S, line: w };
    const I = se(l, A, r), W = se(l, R, r), U = (I >= 0 ? $(C.n, y(H(t, I), r)) : 0) + (W >= 0 ? $(E.n, y(H(t, W), r)) : 0);
    return { index: a, kind: U > 0 ? "concave" : "convex", point: r, tangent: p, normals: P, angleDeg: B, approximate: S, line: w };
  });
  return { body: e, surface: t, faceTris: n, faceArea: s, faceEdges: o, edges: x, cylinders: g, cylinderOf: m };
}
function K(e, t) {
  const n = [];
  for (const s of t.slice(0, Pe))
    for (const o of X(e, s))
      n.push(o[0], o[1], o[2]);
  return n;
}
const ne = (e, t) => Array.from(e.body.edges[t].points);
function _(e, t, n = {}) {
  return { lines: [...[...new Set(t.flatMap((o) => e.faceEdges[o]))].map((o) => ne(e, o)), ...n.lines ?? []], triangles: K(e.surface, t.flatMap((o) => e.faceTris[o])), points: [...n.points ?? []] };
}
const Re = (e, t) => ({ lines: t.map((n) => ne(e, n)), triangles: [], points: [] }), O = (e) => [e[0], e[1], e[2]];
function V(e, t) {
  let n = 0;
  const s = [0, 0, 0];
  for (const o of t)
    for (const l of e.faceTris[o]) {
      const g = e.surface.area[l];
      n += g;
      for (let m = 0; m < 3; m++)
        s[m] += g * e.surface.centroid[3 * l + m];
    }
  return n > 0 ? v(s, 1 / n) : [...e.body.faces[t[0]].point];
}
function z(e, t, n, s, o, l = [], g = {}) {
  return { id: e, label: t, status: s, summary: o, geometry: n, ...g, findings: l.slice(0, le), more: Math.max(0, l.length - le) };
}
const Z = (e, t, n, s) => z(e, t, n, "not-checked", s);
function de(e, t, n) {
  const s = e.faces[t];
  if (s.surface === "plane")
    return y(n, v(s.normal, $(s.normal, y(n, s.point))));
  if (s.surface === "cylinder" && s.axis && s.radius !== void 0) {
    const o = T(s.axis.direction), l = y(n, s.axis.origin), g = $(l, o), m = y(l, v(o, g));
    return N(m) > 0 ? D(D(s.axis.origin, v(o, g)), v(T(m), s.radius)) : n;
  }
  if (s.surface === "sphere" && s.axis && s.radius !== void 0) {
    const o = y(n, s.axis.origin);
    return N(o) > 0 ? D(s.axis.origin, v(T(o), s.radius)) : n;
  }
  return n;
}
function Le(e, t, n, s, o) {
  const l = e.faces[t], g = 4 * e.tolerance + 1e-6, m = (x) => {
    const c = x.filter(Number.isFinite).sort((a, f) => Math.abs(a - o) - Math.abs(f - o))[0];
    return c !== void 0 && Math.abs(c - o) <= g ? c : o;
  };
  if (l.surface === "plane") {
    const x = $(l.normal, s);
    return Math.abs(x) < 1e-12 ? o : m([$(l.normal, y(l.point, n)) / x]);
  }
  const k = (x, c, a) => {
    const f = c * c - 4 * x * a;
    if (x < 1e-15 || f < 0)
      return [];
    const i = Math.sqrt(f);
    return [(-c - i) / (2 * x), (-c + i) / (2 * x)];
  };
  if (l.surface === "cylinder" && l.axis && l.radius !== void 0) {
    const x = T(l.axis.direction), c = y(n, l.axis.origin), a = y(s, v(x, $(s, x))), f = y(c, v(x, $(c, x)));
    return m(k($(a, a), 2 * $(a, f), $(f, f) - l.radius ** 2));
  }
  if (l.surface === "sphere" && l.axis && l.radius !== void 0) {
    const x = y(n, l.axis.origin);
    return m(k($(s, s), 2 * $(s, x), $(x, x) - l.radius ** 2));
  }
  return o;
}
function Ae(e, t, n = {}) {
  const s = n.budget ?? $e, o = [];
  for (let i = 0; i < e.count; i++)
    e.area[i] > 1e-12 && (!n.filter || n.filter(i)) && o.push(i);
  const l = o.map((i) => {
    const [u, r, p] = X(e, i);
    return Math.max(N(y(r, u)), N(y(p, r)), N(y(u, p)));
  });
  let g = Math.max(t, e.diagonal / 200, 1e-3);
  const m = () => l.map((i) => Math.min(12, Math.max(1, Math.ceil(i / g))));
  let k = m();
  for (; k.reduce((i, u) => i + u * (u + 1) / 2, 0) > s && g < e.diagonal; )
    g *= 1.5, k = m();
  const x = n.model;
  let c = 1 / 0, a = 0;
  const f = [];
  return o.forEach((i, u) => {
    const [r, p, d] = X(e, i), M = k[u], w = y(p, r), A = y(d, r);
    for (let R = 0; R < M; R++)
      for (let E = 0; R + E < M; E++) {
        if (a >= s * 1.2)
          return;
        const C = D(r, D(v(w, (R + 1 / 3) / M), v(A, (E + 1 / 3) / M))), B = x ? x.body.mesh.faceOf[i] : -1, S = x ? de(x.body, B, C) : C, P = (x ? he(x.body, B, S) : void 0) ?? G(e, i), I = v(P, -1), W = y(S, v(P, ce));
        a++;
        const U = e.bvh.raycast(W, I, { tMin: ce, skipTri: i });
        if (!U)
          continue;
        const j = x ? Le(x.body, x.body.mesh.faceOf[U.triIndex], W, I, U.t) : U.t, q = j + ce;
        if (!n.collect && q >= c && q >= t)
          continue;
        const me = D(W, v(I, j / 2));
        if (e.bvh.pointInside(me)) {
          if (n.collect) {
            const Se = Math.min(q, 2 * (e.bvh.closestPoint(me)?.distance ?? 1 / 0));
            n.collect.push({ thickness: Se, from: S, to: D(W, v(I, j)), tri: i, hitTri: U.triIndex, weight: e.area[i] / (M * (M + 1) / 2) });
          }
          c = Math.min(c, q), q < t - 1e-9 && f.push({ thickness: q, from: S, to: D(W, v(I, j)), tri: i, hitTri: U.triIndex });
        }
      }
  }), { thinnest: c, samples: a, thin: f };
}
function _e(e, t, n, s) {
  const o = e.body.faces[t], l = e.body.faces[n], g = 2 * e.body.tolerance + 1e-6, m = (i, u) => {
    const r = se(e, i, u);
    if (r < 0)
      return !1;
    const [p, d, M] = X(e.surface, r);
    return N(y(we(u, p, d, M), u)) <= g;
  }, k = (i, u, r) => i > 0 && i <= s.thickness + 1e-6 && m(t, u) && m(n, r) ? { thickness: i, from: u, to: r } : void 0, x = (i) => {
    const u = e.cylinderOf.get(i);
    return u && u.concave ? u : void 0;
  };
  if (o.surface === "plane" && l.surface === "plane") {
    if ($(o.normal, l.normal) > -1 + 1e-9)
      return;
    const i = Math.abs($(o.normal, y(l.point, o.point))), u = de(e.body, t, s.from);
    return k(i, u, y(u, v(o.normal, i)));
  }
  const c = (i, u, r) => {
    const p = e.body.faces[i], d = x(u);
    if (!d || Math.abs($(p.normal, d.direction)) > 1e-9)
      return;
    const M = r ? s.from : s.to, w = $(y(M, d.origin), d.direction), A = D(d.origin, v(d.direction, w)), R = $(p.normal, y(p.point, A)), E = v(p.normal, Math.sign(R)), C = y(A, v(p.normal, $(p.normal, y(A, p.point)))), B = D(A, v(E, d.radius)), S = Math.abs(R) - d.radius;
    return r ? k(S, B, C) : k(S, C, B);
  };
  if (o.surface === "plane" && l.surface === "cylinder")
    return c(t, n, !1);
  if (o.surface === "cylinder" && l.surface === "plane")
    return c(n, t, !0);
  const a = x(t), f = x(n);
  if (a && f && N(L(a.direction, f.direction)) < 1e-9) {
    const i = $(y(s.from, a.origin), a.direction), u = D(a.origin, v(a.direction, i)), r = y(f.origin, u), p = y(f.origin, v(a.direction, $(r, a.direction))), d = T(y(p, u));
    return k(N(y(p, u)) - a.radius - f.radius, D(u, v(d, a.radius)), y(p, v(d, f.radius)));
  }
}
function ae(e, t, n, s, o, l = {}) {
  const g = o ? "exact" : "mesh", m = Ae(n, s, { model: o, filter: l.filter }), { samples: k, thin: x } = m;
  let c = m.thinnest;
  if (!k)
    return Z(e, t, g, h("No faces to measure."));
  x.sort((r, p) => r.thickness - p.thickness);
  const a = [];
  for (const r of x) {
    const p = o ? [o.body.mesh.faceOf[r.tri], o.body.mesh.faceOf[r.hitTri]].sort((M, w) => M - w).join("|") : "", d = o ? a.find((M) => M.key === p) : a.find((M) => N(y(M.worst.from, r.from)) < 2 * s);
    d ? (d.tris.add(r.tri), d.tris.add(r.hitTri)) : a.push({ key: p, worst: r, tris: /* @__PURE__ */ new Set([r.tri, r.hitTri]) });
  }
  let f = c;
  const i = a.map(({ key: r, worst: p, tris: d }) => {
    const M = o ? [...new Set(r.split("|").map(Number))] : void 0, w = o ? [o.body.mesh.faceOf[p.tri], o.body.mesh.faceOf[p.hitTri]] : void 0, A = o && w && w[0] !== w[1] ? _e(o, w[0], w[1], p) : void 0, R = A ? { ...p, ...A } : p;
    f = Math.min(f, R.thickness);
    const E = { lines: [[...R.from, ...R.to]], points: [...R.from, ...R.to] };
    return {
      text: A ? h`${b(R.thickness)} mm thick (limit ${b(s)} mm), exact between the two faces` : h`${b(R.thickness)} mm thick (limit ${b(s)} mm)`,
      value: R.thickness,
      location: O(R.from),
      ...M ? { faces: M } : {},
      mark: o && M ? _(o, M, E) : { ...E, triangles: K(n, [...d]) }
    };
  });
  i.sort((r, p) => (r.value ?? 0) - (p.value ?? 0)), c = f;
  const u = l.what ?? h("Walls");
  return Number.isFinite(c) ? i.length ? z(e, t, g, l.status ?? "fail", h`${u} as thin as ${b(c)} mm, below ${b(s)} mm, in ${i.length} places (${k} samples).`, i, { value: c, limit: s, unit: "mm" }) : z(e, t, g, "pass", h`${u} are at least ${b(s)} mm; thinnest ${b(c)} mm (${k} samples).`, [], { value: c, limit: s, unit: "mm" }) : z(e, t, g, "info", h`No opposite wall found within the part (${k} samples).`, [], { limit: s, unit: "mm" });
}
function Ge(e) {
  const { body: t, edges: n } = e, s = [], o = [], l = /* @__PURE__ */ new Set(), g = (c) => e.faceEdges[c].some((a) => n[a].kind === "tangent"), m = /* @__PURE__ */ new Set();
  t.faces.forEach((c, a) => {
    if (m.has(a) || c.radius === void 0 || !["cylinder", "torus", "sphere"].includes(c.surface))
      return;
    const f = e.cylinderOf.get(a);
    if (f?.full)
      return;
    const i = f ? f.faces : [a];
    i.forEach((u) => m.add(u)), i.some(g) && s.push({ faces: i, radius: c.radius, convex: f ? !f.concave : He(t, a), surface: c.surface });
  });
  const k = (c) => n[c].kind === "convex" && n[c].angleDeg >= 10 && n[c].angleDeg <= 80;
  t.faces.forEach((c, a) => {
    const f = e.faceEdges[a];
    if (c.surface === "plane") {
      const i = f.filter((u) => n[u].line && k(u)).sort((u, r) => t.edges[r].length - t.edges[u].length);
      for (let u = 0; u < i.length; u++)
        for (let r = u + 1; r < i.length; r++) {
          const p = n[i[u]], d = n[i[r]];
          if (Math.abs($(p.tangent, d.tangent)) < 0.999)
            continue;
          const M = y(d.point, p.point), w = N(y(M, v(p.tangent, $(M, p.tangent))));
          if (!(w <= 0 || w >= 0.5 * Math.min(t.edges[i[u]].length, t.edges[i[r]].length) || [i[u], i[r]].map((R) => t.edges[R].faces.find((E) => E !== a)).some((R) => e.faceArea[R] <= e.faceArea[a]))) {
            o.push({ face: a, rails: [i[u], i[r]], widthMm: w }), l.add(i[u]), l.add(i[r]);
            return;
          }
        }
    } else if (c.surface === "cone") {
      const i = f.filter((u) => n[u].kind !== "seam");
      i.length && i.every(k) && i.some((u) => t.edges[u].curve === "circle") && (o.push({ face: a, rails: i }), i.forEach((u) => l.add(u)));
    }
  });
  const x = new Set(o.map((c) => c.face));
  return e.edges.forEach((c) => {
    const a = t.edges[c.index].faces;
    a.length === 2 && a.every((f) => x.has(f)) && l.add(c.index);
  }), { blends: s, chamfers: o, broken: l };
}
function He(e, t) {
  const n = e.faces[t];
  if (n.surface === "sphere" && n.axis)
    return $(n.normal, y(n.point, n.axis.origin)) > 0;
  if (n.surface === "torus" && n.axis && n.radius !== void 0) {
    const s = n.axis.origin, o = T(n.axis.direction);
    return [1, -1].map((g) => ({ s: g, c: y(n.point, v(n.normal, g * n.radius)) })).sort((g, m) => Math.abs($(y(g.c, s), o)) - Math.abs($(y(m.c, s), o)))[0].s > 0;
  }
  return !0;
}
function Ve(e, t) {
  const n = h("Edge radius"), { blends: s, chamfers: o, broken: l } = Ge(e), g = e.edges.filter((w) => (w.kind === "convex" || w.kind === "concave") && !l.has(w.index)), m = g.filter((w) => w.kind === "convex"), k = g.filter((w) => w.kind === "concave"), x = [], c = (w) => (w.convex ? h("Round") : h("Fillet")) + ` R${b(w.radius)}`;
  for (const w of s)
    t.minRadiusMm !== void 0 && w.radius < t.minRadiusMm - Y && x.push({ text: h`${c(w)} below the minimum R${b(t.minRadiusMm)}`, value: w.radius, location: O(V(e, w.faces)), faces: w.faces, mark: _(e, w.faces) }), t.maxRadiusMm !== void 0 && w.radius > t.maxRadiusMm + Y && x.push({ text: h`${c(w)} above the maximum R${b(t.maxRadiusMm)}`, value: w.radius, location: O(V(e, w.faces)), faces: w.faces, mark: _(e, w.faces) });
  const a = t.edgeBreak === "all" ? g : t.edgeBreak === "external" ? m : t.edgeBreak === "internal" ? k : [];
  for (const w of a)
    x.push({ text: w.kind === "convex" ? h`Sharp external edge, ${b(e.body.edges[w.index].length)} mm long` : h`Sharp internal edge, ${b(e.body.edges[w.index].length)} mm long`, value: 0, location: O(w.point), edges: [w.index], faces: [...e.body.edges[w.index].faces], mark: Re(e, [w.index]) });
  const f = s.map((w) => w.radius), i = b(Math.min(...f)), u = b(Math.max(...f)), r = f.length ? i === u ? `R${i}` : `R${i}–R${u}` : "", p = [
    s.length ? h`${s.length} fillets and rounds (${r})` : h("no fillets or rounds"),
    h`${o.length} chamfers`,
    h`${m.length} sharp external and ${k.length} sharp internal edges`
  ].join(", ") + ".", d = t.minRadiusMm !== void 0 || t.maxRadiusMm !== void 0 || t.edgeBreak !== "none", M = e.edges.some((w) => w.approximate && w.kind !== "seam") ? " " + h("Edges on cones of revolution or freeform faces were classified at the mesh tolerance.") : "";
  return d ? x.length ? z("edges.radius", n, "exact", "fail", p + M, x, { value: Math.min(...x.map((w) => w.value ?? 0)), ...t.minRadiusMm !== void 0 ? { limit: t.minRadiusMm } : {}, unit: "mm" }) : z("edges.radius", n, "exact", "pass", p + M, [], { ...f.length ? { value: Math.min(...f) } : {}, ...t.minRadiusMm !== void 0 ? { limit: t.minRadiusMm } : {}, unit: "mm" }) : z("edges.radius", n, "exact", "info", p + " " + h("No edge rules set.") + M);
}
const oe = (e, t, n) => e.bvh.raycast(t, n, { tMin: 1e-6 }) === null, ie = (e) => e.map((t) => ye[t]);
function Ee(e, t) {
  const n = ie(t.approachAxes), s = /* @__PURE__ */ new Map();
  for (const l of e.edges) {
    if (l.kind !== "concave" || !l.line || !l.normals)
      continue;
    const [g, m] = l.normals, k = T(D(g, m)), x = D(l.point, v(k, 1e-3));
    if (n.some((M) => Math.abs($(l.tangent, M)) < 1 - F && ($(g, M) > F && Math.abs($(m, M)) < Q || $(m, M) > F && Math.abs($(g, M)) < Q) && oe(e.surface, x, M)))
      continue;
    const a = n.find((M) => Math.abs($(l.tangent, M)) > F && Math.abs($(g, M)) < Q && Math.abs($(m, M)) < Q && oe(e.surface, x, M));
    if (!a)
      continue;
    const f = e.body.edges[l.index].length, i = e.body.edges[l.index].points;
    let u = 1 / 0, r = -1 / 0;
    for (let M = 0; M < i.length; M += 3) {
      const w = i[M] * a[0] + i[M + 1] * a[1] + i[M + 2] * a[2];
      u = Math.min(u, w), r = Math.max(r, w);
    }
    const p = [...y(l.point, v(a, $(l.point, a)))].map((M) => Math.round(M * 1e4)).join(","), d = s.get(p);
    d ? (d.edges.push(l.index), d.length += f, d.lo = Math.min(d.lo, u), d.hi = Math.max(d.hi, r)) : s.set(p, { edges: [l.index], length: f, point: l.point, axis: a, normals: [g, m], lo: u, hi: r });
  }
  const o = e.cylinders.filter((l) => l.concave && !l.full && n.some((g) => Math.abs($(l.direction, g)) > F));
  return { sharp: [...s.values()], fillets: o };
}
function Xe(e, t) {
  const n = h("Internal corner radius"), s = t.toolDiameterMm / 2, o = [], l = [], { sharp: g, fillets: m } = Ee(e, t);
  for (const a of g)
    o.push({ text: h`Sharp internal corner (radius 0), ${b(a.length)} mm long; the R${b(s)} tool leaves a radius`, value: 0, location: O(a.point), edges: a.edges, faces: [...new Set(a.edges.flatMap((f) => e.body.edges[f].faces))], mark: Re(e, a.edges) });
  let k = 1 / 0;
  for (const a of m) {
    k = Math.min(k, a.radius);
    const f = a.hMax - a.hMin, i = O(V(e, a.faces));
    a.radius < s - Y ? o.push({ text: h`Corner fillet R${b(a.radius)} below the R${b(s)} tool radius (Ø${b(t.toolDiameterMm)} end mill)`, value: a.radius, location: i, faces: a.faces, mark: _(e, a.faces) }) : a.radius < f / 3 - Y && l.push({ text: h`Corner fillet R${b(a.radius)} is ${b(f)} mm deep: below a third of its depth (R${b(f / 3)}), which needs a long, slender tool`, value: a.radius, location: i, faces: a.faces, mark: _(e, a.faces) });
  }
  const x = g.length ? 0 : Number.isFinite(k) ? k : void 0, c = { ...x !== void 0 ? { value: x } : {}, limit: s, unit: "mm" };
  if (o.length) {
    const a = [g.length ? h`${g.length} sharp internal corners (radius 0)` : "", o.length - g.length ? h`${o.length - g.length} corner fillets as small as R${b(k)}` : ""].filter(Boolean).join(h(" and "));
    return z("cnc.internal-corners", n, "exact", "fail", h`${a} below the R${b(s)} tool radius (Ø${b(t.toolDiameterMm)} end mill); add fillets ≥ R${b(s)} or use a smaller tool.`, [...o, ...l], c);
  }
  return l.length ? z("cnc.internal-corners", n, "exact", "warn", h`All internal corners along the tool axes are ≥ R${b(s)}, but ${l.length} are deeper than three times their radius.`, l, c) : z("cnc.internal-corners", n, "exact", "pass", h`All internal corners along the tool axes are ≥ R${b(s)}.`, [], c);
}
function xe(e, t, n, s = 32) {
  const o = T(L(Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], t)), l = L(t, o), g = [];
  for (let m = 0; m <= s; m++) {
    const k = 2 * Math.PI * m / s;
    g.push(...D(e, D(v(o, n * Math.cos(k)), v(l, n * Math.sin(k)))));
  }
  return g;
}
const J = (e, t, n) => D(e, v(t, n - $(e, t)));
function Ye(e, t) {
  const n = h("Dogbones"), s = t.toolDiameterMm / 2, { sharp: o, fillets: l } = Ee(e, t), g = [], m = l.filter((a) => a.span > 0.8 * Math.PI && a.radius >= s - Y).length, k = (a, f, i, u, r, p) => {
    const d = D(a, v(f, s)), M = J(d, i, (u + r) / 2);
    return { centre: M, mark: { lines: [...p, xe(J(d, i, u), i, s), xe(J(d, i, r), i, s), [...J(d, i, u), ...J(d, i, r)]], triangles: [], points: [...M] } };
  };
  for (const a of o) {
    const f = D(a.normals[0], a.normals[1]), i = T(y(f, v(a.axis, $(f, a.axis)))), u = a.edges.map((d) => ne(e, d)), r = [...new Set(a.edges.flatMap((d) => e.body.edges[d].faces))], p = J(a.point, a.axis, (a.lo + a.hi) / 2);
    if (t.dogbones) {
      const { centre: d, mark: M } = k(a.point, i, a.axis, a.lo, a.hi, u);
      g.push({ text: h`Sharp internal corner, ${b(a.length)} mm long: dogbone Ø${b(t.toolDiameterMm)} centred at ${Me(d)}`, value: 0, location: O(d), edges: a.edges, faces: r, mark: M });
    } else
      g.push({ text: h`Sharp internal corner, ${b(a.length)} mm long: the tool leaves R${b(s)}, so a square-cornered part does not seat`, value: 0, location: O(p), edges: a.edges, faces: r, mark: { lines: u, triangles: [], points: [] } });
  }
  for (const a of l) {
    if (a.radius >= s - Y)
      continue;
    const f = V(e, a.faces), i = $(y(f, a.origin), a.direction), u = D(a.origin, v(a.direction, i)), r = T(y(f, u)), p = D(u, v(r, a.radius / Math.max(0.1, Math.cos(a.span / 2)))), d = $(a.origin, a.direction) + a.hMin, M = $(a.origin, a.direction) + a.hMax, w = a.direction;
    if (t.dogbones) {
      const { centre: A, mark: R } = k(p, v(r, -1), w, d, M, []), E = _(e, a.faces);
      g.push({ text: h`Corner fillet R${b(a.radius)}, ${b(M - d)} mm deep: dogbone Ø${b(t.toolDiameterMm)} centred at ${Me(A)}`, value: a.radius, location: O(A), faces: a.faces, mark: { lines: [...E.lines, ...R.lines], triangles: E.triangles, points: R.points } });
    } else
      g.push({ text: h`Corner fillet R${b(a.radius)} below the R${b(s)} the tool leaves: a square-cornered part does not seat`, value: a.radius, location: O(f), faces: a.faces, mark: _(e, a.faces) });
  }
  const x = m ? " " + h`${m} corners are already relieved.` : "";
  if (!g.length)
    return z("cnc.dogbones", n, "exact", "pass", (o.length + l.length ? h`No internal corner along the tool axes is tighter than the R${b(s)} tool.` : h("No internal corners along the tool axes.")) + x, [], { limit: s, unit: "mm" });
  const c = t.dogbones ? h`Suggested dogbones are holes of the tool's Ø${b(t.toolDiameterMm)} whose edge passes through the corner.` : h("Turn on Suggest dogbones to list where to put them.");
  return z("cnc.dogbones", n, "exact", "warn", h`${g.length} internal corners need a dogbone where a square-cornered part must fit (the Ø${b(t.toolDiameterMm)} end mill leaves R${b(s)}).` + " " + c + x, g, { value: Math.min(...g.map((a) => a.value ?? 0)), limit: s, unit: "mm" });
}
const Me = (e) => `[${e.map((t) => b(t)).join(", ")}]`;
function Ke(e, t) {
  const n = e.faceEdges[t].filter((u) => e.edges[u].kind !== "seam"), s = (u) => u.map((r) => Math.round(r * 1e5)).join(","), o = /* @__PURE__ */ new Map(), l = (u) => {
    let r = u;
    for (; o.get(r) !== r; )
      r = o.get(r);
    return o.set(u, r), r;
  }, g = n.map((u) => {
    const r = e.body.edges[u].points, p = r.length / 3, d = s([r[0], r[1], r[2]]), M = e.body.edges[u].closed ? d : s([r[3 * p - 3], r[3 * p - 2], r[3 * p - 1]]);
    for (const w of [d, M])
      o.has(w) || o.set(w, w);
    return o.set(l(d), l(M)), d;
  }), m = /* @__PURE__ */ new Map();
  n.forEach((u, r) => {
    const p = l(g[r]);
    m.set(p, [...m.get(p) ?? [], u]);
  });
  const k = [...m.values()], x = e.body.faces[t].normal, c = T(L(Math.abs(x[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], x)), a = L(x, c), f = (u) => {
    let r = 1 / 0, p = -1 / 0, d = 1 / 0, M = -1 / 0;
    for (const w of u) {
      const A = e.body.edges[w].points;
      for (let R = 0; R < A.length; R += 3) {
        const E = [A[R], A[R + 1], A[R + 2]];
        r = Math.min(r, $(E, c)), p = Math.max(p, $(E, c)), d = Math.min(d, $(E, a)), M = Math.max(M, $(E, a));
      }
    }
    return (p - r) * (M - d);
  };
  let i = 0;
  return k.forEach((u, r) => {
    f(u) > f(k[i]) && (i = r);
  }), { loops: k, outer: i };
}
function Ze(e, t) {
  const n = h("Pocket depth"), s = t.toolDiameterMm, o = t.maxPocketDepthRatio * s, l = ie(t.approachAxes), { body: g, edges: m } = e, k = (r, p) => {
    let d = -1 / 0;
    for (const M of r)
      for (const w of e.faceTris[M])
        for (const A of X(e.surface, w))
          d = Math.max(d, $(A, p));
    return d;
  }, x = /* @__PURE__ */ new Map();
  g.faces.forEach((r, p) => {
    if (r.surface !== "plane" || !e.faceTris[p].length)
      return;
    const d = l.find((S) => $(r.normal, S) > F);
    if (!d)
      return;
    const { loops: M, outer: w } = Ke(e, p);
    if (!M.length || M[w].some((S) => m[S].kind !== "concave" && m[S].kind !== "tangent"))
      return;
    const A = [...e.faceTris[p]].sort((S, P) => e.surface.area[P] - e.surface.area[S])[0];
    if (!oe(e.surface, D(H(e.surface, A), v(d, 1e-3)), d))
      return;
    const R = /* @__PURE__ */ new Set(), E = [], C = (S, P) => {
      for (const I of g.edges[S].faces) {
        if (I === p || I === P || R.has(I))
          continue;
        const W = g.faces[I];
        W.surface === "plane" && $(W.normal, d) > F || (R.add(I), E.push(I));
      }
    };
    for (const S of M[w])
      C(S, p);
    for (; E.length && R.size < 500; ) {
      const S = E.pop();
      for (const P of e.faceEdges[S])
        (m[P].kind === "concave" || m[P].kind === "tangent") && C(P, S);
    }
    if (!R.size)
      return;
    const B = k(R, d) - $(r.point, d);
    B > 1e-6 && x.set(p, { floor: p, own: B, walls: [...R], axis: d });
  });
  for (const r of x.values())
    for (const p of r.walls)
      for (const d of e.faceEdges[p]) {
        if (m[d].kind !== "convex")
          continue;
        const M = g.edges[d].faces.find((w) => w !== p && w !== r.floor && x.has(w) && x.get(w).axis === r.axis);
        M !== void 0 && (r.parent = M);
      }
  const c = (r, p = /* @__PURE__ */ new Set()) => {
    const d = x.get(r);
    return d.parent === void 0 || p.has(r) ? d.own : (p.add(r), d.own + c(d.parent, p));
  }, a = [...x.values()].map((r) => ({ ...r, depth: c(r.floor) })), f = { limit: o, unit: "mm" };
  if (!a.length)
    return z("cnc.pocket-depth", n, "exact", "pass", h("No pockets along the tool axes."), [], f);
  const i = Math.max(...a.map((r) => r.depth)), u = a.filter((r) => r.depth > o + Y).sort((r, p) => p.depth - r.depth).map((r) => ({
    text: (r.parent !== void 0 ? h`Pocket ${b(r.depth)} mm deep (${b(r.own)} mm below the pocket around it)` : h`Pocket ${b(r.depth)} mm deep`) + ": " + h`${b(r.depth / s)} × the Ø${b(s)} end mill, beyond ${b(t.maxPocketDepthRatio)} ×`,
    value: r.depth,
    location: O(V(e, [r.floor])),
    faces: [r.floor, ...r.walls],
    mark: _(e, [r.floor])
  }));
  return u.length ? z("cnc.pocket-depth", n, "exact", "fail", h`${u.length} of ${a.length} pockets deeper than ${b(t.maxPocketDepthRatio)} × the Ø${b(s)} end mill (${b(o)} mm), the deepest ${b(i)} mm; use a larger or long-reach tool, or a shallower pocket.`, u, { ...f, value: i }) : z("cnc.pocket-depth", n, "exact", "pass", h`${a.length} pockets, the deepest ${b(i)} mm (limit ${b(t.maxPocketDepthRatio)} × Ø${b(s)} = ${b(o)} mm).`, [], { ...f, value: i });
}
function be(e, t, n, s = !1) {
  const o = h("Undercuts"), l = n ? "exact" : "mesh", g = s ? [t.pullAxis, (t.pullAxis[0] === "+" ? "-" : "+") + t.pullAxis[1]] : t.approachAxes, m = ie(g), k = g.join(", "), x = s ? "mold.undercuts" : "cnc.undercuts", c = m.map((r) => {
    let p = 1 / 0;
    for (let d = 0; d < e.positions.length; d += 3)
      p = Math.min(p, e.positions[d] * r[0] + e.positions[d + 1] * r[1] + e.positions[d + 2] * r[2]);
    return p;
  }), a = [];
  let f = 0;
  for (let r = 0; r < e.count; r++) {
    if (e.area[r] <= 1e-12)
      continue;
    const p = G(e, r), d = H(e, r);
    m.some((w, A) => {
      const R = $(p, w);
      return !s && R < -F && X(e, r).every((E) => $(E, w) - c[A] < 1e-3) ? !0 : R < -1e-3 ? !1 : e.bvh.raycast(D(d, v(p, 1e-3)), w, { tMin: 1e-6, skipTri: r }) === null;
    }) || (a.push(r), f += e.area[r]);
  }
  const i = [];
  if (n) {
    const r = /* @__PURE__ */ new Map();
    for (const p of a) {
      const d = n.body.mesh.faceOf[p];
      r.set(d, [...r.get(d) ?? [], p]);
    }
    for (const [p, d] of r) {
      const M = d.reduce((w, A) => w + e.area[A], 0);
      i.push({ text: s ? h`${b(M)} mm² of this face does not release toward ${k}` : h`${b(M)} mm² of this face cannot be reached from ${k}`, value: M, location: O(V(n, [p])), faces: [p], mark: { lines: n.faceEdges[p].map((w) => ne(n, w)), triangles: K(e, d), points: [] } });
    }
    i.sort((p, d) => (d.value ?? 0) - (p.value ?? 0));
  } else if (a.length) {
    const r = [...a].sort((p, d) => e.area[d] - e.area[p])[0];
    i.push({ text: s ? h`${b(f)} mm² of surface does not release toward ${k}` : h`${b(f)} mm² of surface cannot be reached from ${k}`, value: f, location: O(H(e, r)), mark: { lines: [], triangles: K(e, a), points: [] } });
  }
  const u = { value: f, limit: t.maxUndercutAreaMm2, unit: "mm2" };
  return s ? f > t.maxUndercutAreaMm2 ? z(x, o, l, "fail", h`${b(f)} mm² of surface is locked in the mould opening along ${k}; it needs a side action (slide or lifter), another parting direction or a redesign.`, i, u) : z(x, o, l, "pass", h`No undercuts: every surface releases toward ${k}.`, [], u) : f > t.maxUndercutAreaMm2 ? z(x, o, l, "fail", h`${b(f)} mm² of surface cannot be reached from ${k}; it needs another setup, a 4/5-axis machine or a redesign.`, i, u) : z(x, o, l, "pass", h`No undercuts: every surface is reachable from ${k}.`, [], u);
}
function Je(e, t) {
  const n = h("Internal corner radius"), s = ie(t.approachAxes), o = /* @__PURE__ */ new Map(), l = (k) => [0, 1, 2].map((x) => Math.round(e.positions[3 * k + x] * 1e4)).join(",");
  for (let k = 0; k < e.count; k++)
    for (let x = 0; x < 3; x++) {
      const c = l(e.indices[3 * k + x]), a = l(e.indices[3 * k + (x + 1) % 3]), f = c < a ? c + "|" + a : a + "|" + c;
      o.set(f, [...o.get(f) ?? [], k, e.indices[3 * k + x], e.indices[3 * k + (x + 1) % 3]]);
    }
  const g = [];
  for (const k of o.values()) {
    if (k.length !== 6)
      continue;
    const [x, c, a, f] = k, i = G(e, x), u = G(e, f);
    if ($(i, u) > Math.cos(60 * ue))
      continue;
    const r = ee(e, c), p = ee(e, a), d = T(y(p, r)), M = v(D(r, p), 0.5);
    if ($(u, y(H(e, x), M)) <= 1e-6)
      continue;
    const w = T(D(i, u)), A = D(M, v(w, 1e-3));
    s.find((E) => Math.abs($(d, E)) > F && Math.abs($(i, E)) < Q && Math.abs($(u, E)) < Q && oe(e, A, E)) && g.push({ text: h`Sharp internal corner, ${b(N(y(p, r)))} mm long`, value: 0, location: O(M), mark: { lines: [[...r, ...p]], triangles: [], points: [] } });
  }
  const m = h("Fillet radii cannot be measured on a mesh; only creases sharper than 60° were looked for.");
  return g.length ? z("cnc.internal-corners", n, "mesh", "fail", h`${g.length} sharp internal corners (mesh edges) along the tool axes.` + " " + m, g, { value: 0, limit: t.toolDiameterMm / 2, unit: "mm" }) : z("cnc.internal-corners", n, "mesh", "info", h("No sharp internal corners along the tool axes.") + " " + m);
}
function ze(e, t, n, s, o, l) {
  const g = h("Hole size"), m = t.cylinders.filter((a) => a.concave && a.full && (!l || Math.abs($(a.direction, l)) > F));
  if (!m.length)
    return z(e, g, "exact", "pass", h("No round holes."), [], { limit: n, unit: "mm" });
  const k = m.filter((a) => 2 * a.radius < n - Y).sort((a, f) => a.radius - f.radius), x = Math.min(...m.map((a) => 2 * a.radius)), c = k.map((a) => ({ text: h`Hole Ø${b(2 * a.radius)} below Ø${b(n)}`, value: 2 * a.radius, location: O(V(t, a.faces)), faces: a.faces, mark: _(t, a.faces) }));
  return c.length ? z(e, g, "exact", s, h`${c.length} of ${m.length} round holes below Ø${b(n)} (smallest Ø${b(x)}); ${o}`, c, { value: x, limit: n, unit: "mm" }) : z(e, g, "exact", "pass", h`${m.length} round holes, the smallest Ø${b(x)} (limit Ø${b(n)}).`, [], { value: x, limit: n, unit: "mm" });
}
function Qe(e, t) {
  let n;
  if (t)
    t.body.faces.forEach((m, k) => {
      m.surface === "plane" && (!n || t.faceArea[k] > n.area) && (n = { n: [...m.normal], area: t.faceArea[k] });
    });
  else
    for (let m = 0; m < e.count; m++)
      (!n || e.area[m] > n.area) && (n = { n: G(e, m), area: e.area[m] });
  if (!n)
    return { offending: [] };
  const s = n.n, o = [], l = [], g = (m, k, x) => {
    const c = $(m, s);
    if (Math.abs(c) > 1 - 1e-6) {
      const a = $(k, s), f = o.find((i) => Math.abs(i.h - a) < 1e-6);
      f ? f.ids.push(x) : o.push({ h: a, ids: [x] });
      return;
    }
    Math.abs(c) > 1e-6 && l.push(x);
  };
  if (t)
    t.body.faces.forEach((m, k) => {
      m.surface === "plane" ? g([...m.normal], [...m.point], k) : m.surface === "cylinder" && m.axis ? Math.abs($(T(m.axis.direction), s)) < 1 - 1e-6 && l.push(k) : t.faceTris[k].some((x) => Math.abs($(G(e, x), s)) > 1e-3) && l.push(k);
    });
  else
    for (let m = 0; m < e.count; m++)
      e.area[m] > 1e-12 && g(G(e, m), H(e, m), m);
  o.sort((m, k) => m.h - k.h);
  for (const m of o.slice(1, -1))
    l.push(...m.ids);
  return o.length < 2 || l.length ? { offending: l } : { sheet: { axis: s, thickness: o[o.length - 1].h - o[0].h }, offending: l };
}
function en(e, t, n) {
  const s = n ? "exact" : "mesh", o = h("Flat sheet"), { sheet: l, offending: g } = Qe(e, n);
  if (!l) {
    const a = n ? g.slice(0, le * 4).map((i) => ({ text: h`Face not perpendicular to the sheet (${n.body.faces[i].surface})`, location: O(V(n, [i])), faces: [i], mark: _(n, [i]) })) : g.length ? [{ text: h("Surface not perpendicular to the sheet"), location: O(H(e, g[0])), mark: { lines: [], triangles: K(e, g), points: [] } }] : [], f = h("Not a flat sheet of one thickness: a laser cuts straight through a sheet, so every face must be one of its two sides or perpendicular to them.");
    return [z("laser.sheet", o, s, "fail", f, a), Z("laser.min-web", h("Minimum web"), s, h("Not a flat sheet.")), ...n ? [Z("laser.min-hole", h("Hole size"), s, h("Not a flat sheet."))] : []];
  }
  const m = l.axis, k = Math.abs(m[0]) > F ? "X" : Math.abs(m[1]) > F ? "Y" : Math.abs(m[2]) > F ? "Z" : m.map((a) => b(a)).join(", "), x = [z("laser.sheet", o, s, "pass", h`A flat sheet ${b(l.thickness)} mm thick, normal along ${k}.`, [], { value: l.thickness, unit: "mm" })], c = t.minWallMm ?? l.thickness;
  return x.push(ae("laser.min-web", h("Minimum web"), e, c, n, { filter: (a) => Math.abs($(G(e, a), m)) < 0.5, status: "warn", what: h("Webs between cuts") })), n && x.push(ze("laser.min-hole", n, Math.max(l.thickness, t.minWallMm ?? 0), "warn", h("holes smaller than the sheet thickness cut poorly."), m)), x;
}
function nn(e, t, n) {
  const s = h("Draft angle"), o = n ? "exact" : "mesh", l = ye[t.pullAxis], g = t.minDraftDeg, m = { limit: g, unit: "deg" };
  if (g <= 0)
    return z("mold.draft", s, o, "info", h("No minimum draft set."), [], m);
  const k = /* @__PURE__ */ new Map();
  let x = 0, c = 90, a = 90;
  for (let i = 0; i < e.count; i++) {
    if (e.area[i] <= 1e-12)
      continue;
    const u = n ? n.body.mesh.faceOf[i] : -1, r = H(e, i), p = (n ? he(n.body, u, de(n.body, u, r)) : void 0) ?? G(e, i), d = Math.asin(Math.min(1, Math.abs($(p, l)))) / ue;
    if (a = Math.min(a, d), d >= g - 1e-9)
      continue;
    const M = k.get(u) ?? { tris: [], area: 0, least: 90 };
    M.tris.push(i), M.area += e.area[i], M.least = Math.min(M.least, d), k.set(u, M), x += e.area[i], c = Math.min(c, d);
  }
  const f = [];
  for (const [i, u] of k)
    if (n) {
      if (u.area < 1e-6)
        continue;
      f.push({ text: h`${b(u.area)} mm² of this face (${n.body.faces[i].surface}) has ${b(u.least)}° draft, below ${b(g)}°`, value: u.least, location: O(V(n, [i])), faces: [i], mark: { lines: n.faceEdges[i].map((r) => ne(n, r)), triangles: K(e, u.tris), points: [] } });
    } else
      f.push({ text: h`${b(u.area)} mm² of surface with ${b(u.least)}° draft, below ${b(g)}°`, value: u.least, location: O(H(e, u.tris[0])), mark: { lines: [], triangles: K(e, u.tris), points: [] } });
  return f.sort((i, u) => (i.value ?? 0) - (u.value ?? 0)), f.length ? z("mold.draft", s, o, "fail", h`${b(x)} mm² of surface has less than ${b(g)}° draft along ${t.pullAxis} (as little as ${b(c)}°), in ${f.length} places; add draft so the part ejects.`, f, { ...m, value: c }) : z("mold.draft", s, o, "pass", h`Every face has at least ${b(g)}° draft along ${t.pullAxis}; the least ${b(a)}°.`, [], { ...m, value: a });
}
function ke(e) {
  const t = [...e].sort((o, l) => o.thickness - l.thickness), n = t.reduce((o, l) => o + l.weight, 0);
  let s = 0;
  for (const o of t)
    if (s += o.weight, s >= n / 2)
      return o.thickness;
  return t.length ? t[t.length - 1].thickness : NaN;
}
function tn(e, t, n) {
  const s = h("Wall uniformity"), o = n ? "exact" : "mesh", l = t.wallVariation, g = t.maxWallMm ?? 4, m = [];
  Ae(e, 1 / 0, { model: n, collect: m, budget: $e / 2 });
  const k = m.filter((d) => Number.isFinite(d.thickness) && d.thickness > 0);
  if (!k.length)
    return z("mold.wall-uniformity", s, o, "info", h("No opposite wall found within the part."), [], { unit: "mm" });
  const x = ke(k), c = Math.min(...k.map((d) => d.thickness)), a = Math.max(...k.map((d) => d.thickness)), f = [], i = Math.max(2 * x, e.diagonal / 50);
  for (const d of k) {
    const M = n ? n.body.mesh.faceOf[d.tri] : -1, w = n ? f.find((A) => A.key === M) : f.find((A) => N(y(A.centre, d.from)) < i);
    w ? w.samples.push(d) : f.push({ key: M, samples: [d], centre: d.from });
  }
  const u = [];
  for (const d of f) {
    const M = ke(d.samples), w = M / x - 1, A = M > g + 1e-9, R = Math.abs(w) > l + 1e-9;
    if (!A && !R)
      continue;
    const E = [...d.samples].sort((P, I) => Math.abs(I.thickness - x) - Math.abs(P.thickness - x))[0], C = A ? h`thicker than the ${b(g)} mm maximum` : w > 0 ? h`${b(100 * w)} % thicker than nominal` : h`${b(-100 * w)} % thinner than nominal`, B = h`Wall ${b(M)} mm against ${b(x)} mm nominal: ${C}`, S = { lines: [[...E.from, ...E.to]], points: [...E.from] };
    u.push({
      text: B,
      value: M,
      location: O(n ? V(n, [d.key]) : d.centre),
      ...n ? { faces: [d.key] } : {},
      mark: n ? _(n, [d.key], S) : { ...S, triangles: K(e, [...new Set(d.samples.map((P) => P.tri))]) }
    });
  }
  u.sort((d, M) => Math.abs((M.value ?? x) - x) - Math.abs((d.value ?? x) - x));
  const r = { value: x, unit: "mm" }, p = h`nominal ${b(x)} mm (median of ${k.length} samples), from ${b(c)} to ${b(a)} mm`;
  return u.length ? z("mold.wall-uniformity", s, o, "warn", h`Walls are uneven: ${p}; ${u.length} regions differ by more than ${b(100 * l)} % or exceed ${b(g)} mm, which risks sink marks, voids and warping.`, u, r) : z("mold.wall-uniformity", s, o, "pass", h`Walls are even: ${p}, within ${b(100 * l)} % and at most ${b(g)} mm.`, [], r);
}
function an(e, t) {
  const n = [];
  n.push(e.topology.watertight ? z("fdm.watertight", h("Watertight mesh"), "mesh", "pass", h("Closed, manifold mesh.")) : z("fdm.watertight", h("Watertight mesh"), "mesh", "fail", h`${e.topology.openEdges} open, ${e.topology.nonManifoldEdges} non-manifold edges`));
  const s = e.current, o = e.orientations?.[0];
  if (s && o) {
    const l = s.overhangs.map((m) => ({ text: h`${b(m.areaMm2)} mm² overhang up to ${b(m.maxOverhangDeg)}°${m.spanMm !== void 0 ? h` (bridge ${b(m.spanMm)} mm)` : ""}`, value: m.areaMm2, location: O(v(D(m.bboxMin, m.bboxMax), 0.5)), mark: { lines: [sn(m.bboxMin, m.bboxMax)], triangles: [], points: [] } }));
    n.push(z("fdm.overhangs", h("Overhangs as modelled"), "mesh", s.unsupportedAreaMm2 > 0 ? "warn" : "pass", s.unsupportedAreaMm2 > 0 ? h`${b(s.unsupportedAreaMm2)} mm² unsupported steeper than ${b(t.maxOverhangDeg)}° in ${s.overhangRegions} regions.` : h`No unsupported overhang steeper than ${b(t.maxOverhangDeg)}°.`, l, { value: s.unsupportedAreaMm2, unit: "mm2" }));
    const g = Math.abs(o.rotation.deg) < 1e-9 ? h("as modelled") : h`rotate ${b(o.rotation.deg)}° about ${o.rotation.axis[0] ? "X" : o.rotation.axis[1] ? "Y" : "Z"}`;
    n.push(z("fdm.orientation", h("Print orientation"), "mesh", o.fitsBed ? o.unsupportedAreaMm2 > 0 ? "warn" : "pass" : "fail", o.fitsBed ? h`Best: ${o.label ?? ""} up (${g}), ${b(o.unsupportedAreaMm2)} mm² unsupported.` : h`Does not fit the ${t.bedSizeMm.x} × ${t.bedSizeMm.y} × ${t.bedSizeMm.z} mm bed in any axis orientation.`)), (o.bedContactLow || o.tipRisk) && n.push(z("fdm.bed-contact", h("Bed adhesion"), "mesh", "warn", o.tipRisk ? h("Tall part on a small base may tip") : h("Small bed contact area")));
  }
  return n;
}
const sn = (e, t) => {
  const n = (s, o, l) => [s ? t[0] : e[0], o ? t[1] : e[1], l ? t[2] : e[2]];
  return [n(0, 0, 0), n(1, 0, 0), n(1, 1, 0), n(0, 1, 0), n(0, 0, 0), n(0, 0, 1), n(1, 0, 1), n(1, 1, 1), n(0, 1, 1), n(0, 0, 1)].flat();
};
function cn(e, t = {}) {
  const n = Ce(t), s = e.meshes.filter((g) => !g.reference && !g.hole && g.indices.length > 0 && (!e.bodies?.length || e.bodies.includes(g.id))), o = e.bodies?.filter((g) => !e.meshes.some((m) => m.id === g)) ?? [];
  if (o.length)
    throw new RangeError(h`Unknown object id: ${o[0]}`);
  const l = s.map((g) => {
    const m = n.exact ? e.exact?.bodies.find((u) => u.id === g.id) : void 0, k = e.exact?.failures.find((u) => u.id === g.id), x = m ? void 0 : n.exact ? k ? h`no exact B-rep: ${k.message}` : e.exactUnavailable ? h`exact kernel unavailable: ${e.exactUnavailable}` : h("no exact B-rep for this body") : h("exact geometry not requested"), c = m ? qe(m) : void 0, f = c ? c.surface : ve(g.positions, g.indices), i = [];
    if (n.process === "fdm") {
      const u = De([g], { nozzleMm: n.nozzleMm, minWallMm: n.minWallMm ?? 2 * n.nozzleMm, maxOverhangDeg: n.maxOverhangDeg, maxBridgeMm: n.maxBridgeMm, bedSizeMm: n.bedSizeMm }).bodies[0], r = n.minWallMm ?? 2 * n.nozzleMm;
      if (c)
        i.push(ae("fdm.min-wall", h("Minimum wall thickness"), f, r, c));
      else {
        const p = u.minWall, d = p.violations.map((M) => ({ text: h`${b(M.thicknessMm)} mm thick (limit ${b(r)} mm)`, value: M.thicknessMm, location: M.location, mark: { lines: [], triangles: [], points: [...M.location] } }));
        i.push(p.thinnestMm === null ? z("fdm.min-wall", h("Minimum wall thickness"), "mesh", "info", h("No opposite wall found within the part.")) : z("fdm.min-wall", h("Minimum wall thickness"), "mesh", d.length ? "fail" : "pass", d.length ? h`Walls as thin as ${b(p.thinnestMm)} mm, below ${b(r)} mm (${p.sampleCount} samples).` : h`Walls are at least ${b(r)} mm; thinnest ${b(p.thinnestMm)} mm (${p.sampleCount} samples).`, d, { value: p.thinnestMm, limit: r, unit: "mm" }));
      }
      i.push(c ? ze("fdm.min-hole", c, n.minHoleMm, "fail", h("they print undersized or close up.")) : Z("fdm.min-hole", h("Hole size"), "mesh", h("Hole diameters need the exact B-rep."))), i.push(...an(u, n));
    } else n.process === "cnc" ? (i.push(c ? Xe(c, n) : Je(f, n)), i.push(c ? Ze(c, n) : Z("cnc.pocket-depth", h("Pocket depth"), "mesh", h("Pocket floors and walls need the exact B-rep."))), i.push(c ? Ye(c, n) : Z("cnc.dogbones", h("Dogbones"), "mesh", h("Corner radii need the exact B-rep; the mesh check lists sharp internal corners."))), i.push(be(f, n, c)), i.push(ae("cnc.min-wall", h("Minimum wall thickness"), f, n.minWallMm ?? 0.8, c))) : n.process === "molding" ? (i.push(nn(f, n, c)), i.push(be(f, n, c, !0)), i.push(ae("mold.min-wall", h("Minimum wall thickness"), f, n.minWallMm ?? 0.8, c)), i.push(tn(f, n, c))) : i.push(...en(f, n, c));
    return i.push(c ? Ve(c, n) : Z("edges.radius", h("Edge radius"), "mesh", h("Fillet radii and sharp edges need the exact B-rep."))), { id: g.id, name: g.name, geometry: c ? "exact" : "mesh", ...x ? { reason: x } : {}, checks: i };
  });
  return {
    version: Ie,
    process: n.process,
    settings: n,
    bodies: l,
    ...e.kernel && l.some((g) => g.geometry === "exact") ? { kernel: e.kernel } : {},
    disclaimer: h("Design screening against rules of thumb, not a quote or a guarantee that the part can be made. Wall thickness is sampled; exact checks use the B-rep, mesh checks the tessellation.")
  };
}
export {
  le as MAX_MANUFACTURING_FINDINGS,
  qe as buildExactModel,
  cn as checkManufacturing,
  Ge as edgeBreaks,
  Re as edgeMark,
  V as faceCentre,
  _ as faceMark
};
