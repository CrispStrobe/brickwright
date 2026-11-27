import { t as f } from "./geometry.worker-BDK-0LR6.js";
import { c as be, T as ke, a as de } from "./printability-DJe_UDPa.js";
const ye = 1, we = Object.freeze(["fdm", "cnc", "laser"]), $e = Object.freeze(["+x", "-x", "+y", "-y", "+z", "-z"]), ve = Object.freeze({
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
  edgeBreak: "none"
}), le = (e, t = 1e5) => typeof e == "number" && Number.isFinite(e) && e > 0 && e <= t;
function Ae(e = {}) {
  const t = ve, n = { ...t, ...Object.fromEntries(Object.entries(e).filter(([, i]) => i !== void 0)), bedSizeMm: { ...t.bedSizeMm, ...e.bedSizeMm } };
  if (!we.includes(n.process))
    throw new RangeError(f("Choose the process fdm, cnc or laser."));
  for (const [i, u] of [["nozzleMm", n.nozzleMm], ["minHoleMm", n.minHoleMm], ["maxBridgeMm", n.maxBridgeMm], ["toolDiameterMm", n.toolDiameterMm], ["bedSizeMm.x", n.bedSizeMm.x], ["bedSizeMm.y", n.bedSizeMm.y], ["bedSizeMm.z", n.bedSizeMm.z]])
    if (!le(u))
      throw new RangeError(f`${i} must be a positive number of millimetres.`);
  for (const [i, u] of [["minWallMm", n.minWallMm], ["minRadiusMm", n.minRadiusMm], ["maxRadiusMm", n.maxRadiusMm]])
    if (u !== void 0 && !le(u))
      throw new RangeError(f`${i} must be a positive number of millimetres.`);
  if (!(typeof n.maxUndercutAreaMm2 == "number" && n.maxUndercutAreaMm2 >= 0 && Number.isFinite(n.maxUndercutAreaMm2)))
    throw new RangeError(f("The tolerated undercut area must be zero or more square millimetres."));
  if (!(n.maxOverhangDeg > 0 && n.maxOverhangDeg < 90))
    throw new RangeError(f("The overhang angle must be between 0 and 90 degrees."));
  if (n.minRadiusMm !== void 0 && n.maxRadiusMm !== void 0 && n.minRadiusMm > n.maxRadiusMm)
    throw new RangeError(f("The minimum radius is larger than the maximum radius."));
  if (!["none", "external", "internal", "all"].includes(n.edgeBreak))
    throw new RangeError(f("Edge breaks are none, external, internal or all."));
  const s = [...new Set(n.approachAxes)];
  if (!s.length || s.some((i) => !$e.includes(i)))
    throw new RangeError(f("Tool approach axes are +x, -x, +y, -y, +z or -z."));
  return Object.freeze({ ...n, exact: n.exact !== !1, approachAxes: Object.freeze(s), bedSizeMm: Object.freeze({ ...n.bedSizeMm }) });
}
const ae = 25, Re = 6e3, ue = 4e4, te = 1e-4, ze = 0.5, Ee = 12, U = 0.98, X = 0.2, V = 1e-6, Se = 0.035, he = Math.PI / 180, k = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], N = (e, t) => [e[0] + t[0], e[1] + t[1], e[2] + t[2]], v = (e, t) => [e[0] * t, e[1] * t, e[2] * t], b = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], L = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], O = (e) => Math.hypot(e[0], e[1], e[2]), S = (e) => {
  const t = O(e);
  return t > 0 ? [e[0] / t, e[1] / t, e[2] / t] : [0, 0, 0];
}, Oe = (e, t) => Math.acos(Math.min(1, Math.max(-1, b(e, t)))), y = (e) => Number(e.toFixed(3)).toLocaleString(void 0, { maximumFractionDigits: 3 }), Ne = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] }, K = (e, t) => [e.positions[3 * t], e.positions[3 * t + 1], e.positions[3 * t + 2]], q = (e, t) => [K(e, e.indices[3 * t]), K(e, e.indices[3 * t + 1]), K(e, e.indices[3 * t + 2])], W = (e, t) => [e.normal[3 * t], e.normal[3 * t + 1], e.normal[3 * t + 2]], G = (e, t) => [e.centroid[3 * t], e.centroid[3 * t + 1], e.centroid[3 * t + 2]];
function me(e, t, n) {
  const s = t.length / 3, i = new Float64Array(3 * s), u = new Float64Array(3 * s), h = new Float64Array(s), l = { positions: e, indices: t };
  let p = 0;
  const m = [1 / 0, 1 / 0, 1 / 0], c = [-1 / 0, -1 / 0, -1 / 0];
  for (let a = 0; a < s; a++) {
    const [r, o, d] = q(l, a), g = L(k(o, r), k(d, r)), x = O(g);
    p += b(r, L(o, d)) / 6;
    for (const w of [r, o, d])
      for (let $ = 0; $ < 3; $++)
        m[$] = Math.min(m[$], w[$]), c[$] = Math.max(c[$], w[$]);
    x > 0 && i.set([g[0] / x, g[1] / x, g[2] / x], 3 * a), u.set([(r[0] + o[0] + d[0]) / 3, (r[1] + o[1] + d[1]) / 3, (r[2] + o[2] + d[2]) / 3], 3 * a), h[a] = x / 2;
  }
  if (p < 0)
    for (let a = 0; a < i.length; a++)
      i[a] = -i[a];
  return { positions: e, indices: t, normal: i, centroid: u, area: h, count: s, bvh: new ke({ vertices: e, triangles: t }), diagonal: s ? O(k(c, m)) : 0, ...n ? { faceOf: n } : {} };
}
function se(e) {
  if (!e.axis)
    return 1;
  const t = S(e.axis.direction), n = k(e.point, e.axis.origin), s = k(n, v(t, b(n, t)));
  return b(e.normal, s) >= 0 ? 1 : -1;
}
function ee(e, t, n) {
  const s = S(t), i = k(n, e);
  return S(k(i, v(s, b(i, s))));
}
function ge(e, t, n) {
  const s = e.faces[t];
  switch (s.surface) {
    case "plane":
      return [...s.normal];
    case "cylinder":
      return s.axis ? v(ee(s.axis.origin, s.axis.direction, n), se(s)) : void 0;
    case "cone": {
      if (!s.axis)
        return;
      const i = S(s.axis.direction), u = ee(s.axis.origin, i, s.point), h = b(s.normal, u), l = b(s.normal, i);
      return S(N(v(ee(s.axis.origin, i, n), h), v(i, l)));
    }
    case "sphere": {
      if (!s.axis)
        return;
      const i = s.axis.origin, u = b(s.normal, k(s.point, i)) >= 0 ? 1 : -1;
      return v(S(k(n, i)), u);
    }
    case "torus": {
      if (!s.axis || s.radius === void 0)
        return;
      const i = s.axis.origin, u = S(s.axis.direction), h = [1, -1].map((r) => ({ s: r, c: k(s.point, v(s.normal, r * s.radius)) })), { s: l, c: p } = h.sort((r, o) => Math.abs(b(k(r.c, i), u)) - Math.abs(b(k(o.c, i), u)))[0], m = k(p, i), c = O(k(m, v(u, b(m, u)))), a = N(i, v(ee(i, u, n), c));
      return v(S(k(n, a)), l);
    }
    default:
      return;
  }
}
function ne(e, t, n) {
  let s = -1, i = 1 / 0;
  for (const u of e.faceTris[t] ?? []) {
    const [h, l, p] = q(e.surface, u), m = de(n, h, l, p), c = O(k(m, n));
    c < i && (i = c, s = u);
  }
  return s;
}
function fe(e, t, n) {
  const s = ge(e.body, t, n);
  if (s && O(s) > 0)
    return { n: s, exact: !0 };
  const i = ne(e, t, n);
  return { n: i >= 0 ? W(e.surface, i) : [...e.body.faces[t].normal], exact: !1 };
}
const Te = (e, t) => {
  const n = Math.max(1, e.radius);
  if (Math.abs(e.radius - t.radius) > 1e-6 * n || O(L(e.direction, t.direction)) > 1e-6)
    return !1;
  const s = k(t.origin, e.origin);
  return O(k(s, v(e.direction, b(s, e.direction)))) < 1e-5 * n;
};
function Ie(e) {
  const t = me(e.mesh.positions, e.mesh.indices, e.mesh.faceOf), n = e.faces.map(() => []), s = e.faces.map(() => 0);
  for (let c = 0; c < t.count; c++) {
    const a = e.mesh.faceOf[c];
    n[a]?.push(c), s[a] += t.area[c];
  }
  const i = e.faces.map(() => []);
  e.edges.forEach((c, a) => new Set(c.faces).forEach((r) => i[r]?.push(a)));
  const u = { body: e, surface: t, faceTris: n }, h = [], l = /* @__PURE__ */ new Map();
  e.faces.forEach((c, a) => {
    if (c.surface !== "cylinder" || !c.axis || c.radius === void 0)
      return;
    const r = { radius: c.radius, origin: [...c.axis.origin], direction: S(c.axis.direction) };
    let o = h.find((d) => Te(d, r) && d.concave === se(c) < 0);
    o || (o = { faces: [], ...r, concave: se(c) < 0, full: !1, hMin: 1 / 0, hMax: -1 / 0 }, h.push(o)), o.faces.push(a), l.set(a, o);
  });
  for (let c = 0; c < h.length; c++) {
    const a = h[c], r = a.direction, o = S(L(Math.abs(r[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], r)), d = L(r, o), g = new Uint8Array(720);
    let x = 1 / 0, w = -1 / 0;
    for (const R of a.faces)
      for (const A of n[R]) {
        const z = q(t, A).map((T) => {
          const I = k(T, a.origin), _ = b(I, r);
          return x = Math.min(x, _), w = Math.max(w, _), (Math.atan2(b(I, d), b(I, o)) + 2 * Math.PI) % (2 * Math.PI);
        }).sort((T, I) => T - I), C = [z[1] - z[0], z[2] - z[1], z[0] + 2 * Math.PI - z[2]], B = C.indexOf(Math.max(...C)), j = z[(B + 1) % 3], P = 2 * Math.PI - C[B];
        for (let T = 0; T < 720; T++)
          ((T + 0.5) * Math.PI / 360 - j + 4 * Math.PI) % (2 * Math.PI) <= P && (g[T] = 1);
      }
    const $ = (720 - g.reduce((R, A) => R + A, 0)) * Math.PI / 360, M = { ...a, full: $ < Se, hMin: x, hMax: w };
    h[c] = M;
    for (const R of M.faces)
      l.set(R, M);
  }
  const p = (c, a) => {
    const r = e.faces[c], o = e.faces[a];
    return l.get(c) && l.get(c) === l.get(a) ? !0 : r.surface === "plane" && o.surface === "plane" ? b(r.normal, o.normal) > 1 - 1e-9 && Math.abs(b(r.normal, k(o.point, r.point))) < 1e-6 : r.surface === o.surface && r.surface !== "plane" && r.axis && o.axis && r.radius !== void 0 && r.radius === o.radius ? O(k(r.axis.origin, o.axis.origin)) < 1e-6 && O(L(S(r.axis.direction), S(o.axis.direction))) < 1e-6 : !1;
  }, m = e.edges.map((c, a) => {
    const r = c.points.length / 3, o = (F) => [c.points[3 * F], c.points[3 * F + 1], c.points[3 * F + 2]], d = Math.floor((r - 1) / 2), g = r === 2 ? v(N(o(0), o(1)), 0.5) : o(d), x = S(k(o(Math.min(d + 1, r - 1)), o(Math.max(d - 1, 0)))), w = k(o(r - 1), o(0)), $ = O(w), M = c.curve === "line" || !c.closed && $ > 1e-9 && Array.from({ length: r }, (F, Q) => Q).every((F) => {
      const Q = k(o(F), o(0));
      return O(k(Q, v(w, b(Q, w) / $ ** 2))) < 1e-6 * Math.max(1, $);
    });
    if (c.faces.length !== 2 || c.faces[0] === c.faces[1])
      return { index: a, kind: "seam", point: g, tangent: x, angleDeg: 0, approximate: !1, line: M };
    const [R, A] = c.faces;
    if (p(R, A))
      return { index: a, kind: "seam", point: g, tangent: x, angleDeg: 0, approximate: !1, line: M };
    const z = fe(u, R, g), C = fe(u, A, g), B = Oe(z.n, C.n) / he, j = !z.exact || !C.exact, P = [z.n, C.n];
    if (B < (j ? Ee : ze))
      return { index: a, kind: "tangent", point: g, tangent: x, normals: P, angleDeg: B, approximate: j, line: M };
    const T = ne(u, R, g), I = ne(u, A, g), _ = (T >= 0 ? b(C.n, k(G(t, T), g)) : 0) + (I >= 0 ? b(z.n, k(G(t, I), g)) : 0);
    return { index: a, kind: _ > 0 ? "concave" : "convex", point: g, tangent: x, normals: P, angleDeg: B, approximate: j, line: M };
  });
  return { body: e, surface: t, faceTris: n, faceArea: s, faceEdges: i, edges: m, cylinders: h, cylinderOf: l };
}
function Z(e, t) {
  const n = [];
  for (const s of t.slice(0, Re))
    for (const i of q(e, s))
      n.push(i[0], i[1], i[2]);
  return n;
}
const oe = (e, t) => Array.from(e.body.edges[t].points);
function H(e, t, n = {}) {
  return { lines: [...[...new Set(t.flatMap((i) => e.faceEdges[i]))].map((i) => oe(e, i)), ...n.lines ?? []], triangles: Z(e.surface, t.flatMap((i) => e.faceTris[i])), points: [...n.points ?? []] };
}
const pe = (e, t) => ({ lines: t.map((n) => oe(e, n)), triangles: [], points: [] }), D = (e) => [e[0], e[1], e[2]];
function Y(e, t) {
  let n = 0;
  const s = [0, 0, 0];
  for (const i of t)
    for (const u of e.faceTris[i]) {
      const h = e.surface.area[u];
      n += h;
      for (let l = 0; l < 3; l++)
        s[l] += h * e.surface.centroid[3 * u + l];
    }
  return n > 0 ? v(s, 1 / n) : [...e.body.faces[t[0]].point];
}
function E(e, t, n, s, i, u = [], h = {}) {
  return { id: e, label: t, status: s, summary: i, geometry: n, ...h, findings: u.slice(0, ae), more: Math.max(0, u.length - ae) };
}
const J = (e, t, n, s) => E(e, t, n, "not-checked", s);
function xe(e, t, n) {
  const s = e.faces[t];
  if (s.surface === "plane")
    return k(n, v(s.normal, b(s.normal, k(n, s.point))));
  if (s.surface === "cylinder" && s.axis && s.radius !== void 0) {
    const i = S(s.axis.direction), u = k(n, s.axis.origin), h = b(u, i), l = k(u, v(i, h));
    return O(l) > 0 ? N(N(s.axis.origin, v(i, h)), v(S(l), s.radius)) : n;
  }
  if (s.surface === "sphere" && s.axis && s.radius !== void 0) {
    const i = k(n, s.axis.origin);
    return O(i) > 0 ? N(s.axis.origin, v(S(i), s.radius)) : n;
  }
  return n;
}
function Ce(e, t, n, s, i) {
  const u = e.faces[t], h = 4 * e.tolerance + 1e-6, l = (m) => {
    const c = m.filter(Number.isFinite).sort((a, r) => Math.abs(a - i) - Math.abs(r - i))[0];
    return c !== void 0 && Math.abs(c - i) <= h ? c : i;
  };
  if (u.surface === "plane") {
    const m = b(u.normal, s);
    return Math.abs(m) < 1e-12 ? i : l([b(u.normal, k(u.point, n)) / m]);
  }
  const p = (m, c, a) => {
    const r = c * c - 4 * m * a;
    if (m < 1e-15 || r < 0)
      return [];
    const o = Math.sqrt(r);
    return [(-c - o) / (2 * m), (-c + o) / (2 * m)];
  };
  if (u.surface === "cylinder" && u.axis && u.radius !== void 0) {
    const m = S(u.axis.direction), c = k(n, u.axis.origin), a = k(s, v(m, b(s, m))), r = k(c, v(m, b(c, m)));
    return l(p(b(a, a), 2 * b(a, r), b(r, r) - u.radius ** 2));
  }
  if (u.surface === "sphere" && u.axis && u.radius !== void 0) {
    const m = k(n, u.axis.origin);
    return l(p(b(s, s), 2 * b(s, m), b(m, m) - u.radius ** 2));
  }
  return i;
}
function Be(e, t, n = {}) {
  const s = [];
  for (let r = 0; r < e.count; r++)
    e.area[r] > 1e-12 && (!n.filter || n.filter(r)) && s.push(r);
  const i = s.map((r) => {
    const [o, d, g] = q(e, r);
    return Math.max(O(k(d, o)), O(k(g, d)), O(k(o, g)));
  });
  let u = Math.max(t, e.diagonal / 200, 1e-3);
  const h = () => i.map((r) => Math.min(12, Math.max(1, Math.ceil(r / u))));
  let l = h();
  for (; l.reduce((r, o) => r + o * (o + 1) / 2, 0) > ue && u < e.diagonal; )
    u *= 1.5, l = h();
  const p = n.model;
  let m = 1 / 0, c = 0;
  const a = [];
  return s.forEach((r, o) => {
    const [d, g, x] = q(e, r), w = l[o], $ = k(g, d), M = k(x, d);
    for (let R = 0; R < w; R++)
      for (let A = 0; R + A < w; A++) {
        if (c >= ue * 1.2)
          return;
        const z = N(d, N(v($, (R + 1 / 3) / w), v(M, (A + 1 / 3) / w))), C = p ? p.body.mesh.faceOf[r] : -1, B = p ? xe(p.body, C, z) : z, j = (p ? ge(p.body, C, B) : void 0) ?? W(e, r), P = v(j, -1), T = k(B, v(j, te));
        c++;
        const I = e.bvh.raycast(T, P, { tMin: te, skipTri: r });
        if (!I)
          continue;
        const _ = p ? Ce(p.body, p.body.mesh.faceOf[I.triIndex], T, P, I.t) : I.t, F = _ + te;
        F >= m && F >= t || e.bvh.pointInside(N(T, v(P, _ / 2))) && (m = Math.min(m, F), F < t - 1e-9 && a.push({ thickness: F, from: B, to: N(T, v(P, _)), tri: r, hitTri: I.triIndex }));
      }
  }), { thinnest: m, samples: c, thin: a };
}
function De(e, t, n, s) {
  const i = e.body.faces[t], u = e.body.faces[n], h = 2 * e.body.tolerance + 1e-6, l = (o, d) => {
    const g = ne(e, o, d);
    if (g < 0)
      return !1;
    const [x, w, $] = q(e.surface, g);
    return O(k(de(d, x, w, $), d)) <= h;
  }, p = (o, d, g) => o > 0 && o <= s.thickness + 1e-6 && l(t, d) && l(n, g) ? { thickness: o, from: d, to: g } : void 0, m = (o) => {
    const d = e.cylinderOf.get(o);
    return d && d.concave ? d : void 0;
  };
  if (i.surface === "plane" && u.surface === "plane") {
    if (b(i.normal, u.normal) > -1 + 1e-9)
      return;
    const o = Math.abs(b(i.normal, k(u.point, i.point))), d = xe(e.body, t, s.from);
    return p(o, d, k(d, v(i.normal, o)));
  }
  const c = (o, d, g) => {
    const x = e.body.faces[o], w = m(d);
    if (!w || Math.abs(b(x.normal, w.direction)) > 1e-9)
      return;
    const $ = g ? s.from : s.to, M = b(k($, w.origin), w.direction), R = N(w.origin, v(w.direction, M)), A = b(x.normal, k(x.point, R)), z = v(x.normal, Math.sign(A)), C = k(R, v(x.normal, b(x.normal, k(R, x.point)))), B = N(R, v(z, w.radius)), j = Math.abs(A) - w.radius;
    return g ? p(j, B, C) : p(j, C, B);
  };
  if (i.surface === "plane" && u.surface === "cylinder")
    return c(t, n, !1);
  if (i.surface === "cylinder" && u.surface === "plane")
    return c(n, t, !0);
  const a = m(t), r = m(n);
  if (a && r && O(L(a.direction, r.direction)) < 1e-9) {
    const o = b(k(s.from, a.origin), a.direction), d = N(a.origin, v(a.direction, o)), g = k(r.origin, d), x = k(r.origin, v(a.direction, b(g, a.direction))), w = S(k(x, d));
    return p(O(k(x, d)) - a.radius - r.radius, N(d, v(w, a.radius)), k(x, v(w, r.radius)));
  }
}
function ie(e, t, n, s, i, u = {}) {
  const h = i ? "exact" : "mesh", l = Be(n, s, { model: i, filter: u.filter }), { samples: p, thin: m } = l;
  let c = l.thinnest;
  if (!p)
    return J(e, t, h, f("No faces to measure."));
  m.sort((g, x) => g.thickness - x.thickness);
  const a = [];
  for (const g of m) {
    const x = i ? [i.body.mesh.faceOf[g.tri], i.body.mesh.faceOf[g.hitTri]].sort(($, M) => $ - M).join("|") : "", w = i ? a.find(($) => $.key === x) : a.find(($) => O(k($.worst.from, g.from)) < 2 * s);
    w ? (w.tris.add(g.tri), w.tris.add(g.hitTri)) : a.push({ key: x, worst: g, tris: /* @__PURE__ */ new Set([g.tri, g.hitTri]) });
  }
  let r = c;
  const o = a.map(({ key: g, worst: x, tris: w }) => {
    const $ = i ? [...new Set(g.split("|").map(Number))] : void 0, M = i ? [i.body.mesh.faceOf[x.tri], i.body.mesh.faceOf[x.hitTri]] : void 0, R = i && M && M[0] !== M[1] ? De(i, M[0], M[1], x) : void 0, A = R ? { ...x, ...R } : x;
    r = Math.min(r, A.thickness);
    const z = { lines: [[...A.from, ...A.to]], points: [...A.from, ...A.to] };
    return {
      text: R ? f`${y(A.thickness)} mm thick (limit ${y(s)} mm), exact between the two faces` : f`${y(A.thickness)} mm thick (limit ${y(s)} mm)`,
      value: A.thickness,
      location: D(A.from),
      ...$ ? { faces: $ } : {},
      mark: i && $ ? H(i, $, z) : { ...z, triangles: Z(n, [...w]) }
    };
  });
  o.sort((g, x) => (g.value ?? 0) - (x.value ?? 0)), c = r;
  const d = u.what ?? f("Walls");
  return Number.isFinite(c) ? o.length ? E(e, t, h, u.status ?? "fail", f`${d} as thin as ${y(c)} mm, below ${y(s)} mm, in ${o.length} places (${p} samples).`, o, { value: c, limit: s, unit: "mm" }) : E(e, t, h, "pass", f`${d} are at least ${y(s)} mm; thinnest ${y(c)} mm (${p} samples).`, [], { value: c, limit: s, unit: "mm" }) : E(e, t, h, "info", f`No opposite wall found within the part (${p} samples).`, [], { limit: s, unit: "mm" });
}
function Fe(e) {
  const { body: t, edges: n } = e, s = [], i = [], u = /* @__PURE__ */ new Set(), h = (c) => e.faceEdges[c].some((a) => n[a].kind === "tangent"), l = /* @__PURE__ */ new Set();
  t.faces.forEach((c, a) => {
    if (l.has(a) || c.radius === void 0 || !["cylinder", "torus", "sphere"].includes(c.surface))
      return;
    const r = e.cylinderOf.get(a);
    if (r?.full)
      return;
    const o = r ? r.faces : [a];
    o.forEach((d) => l.add(d)), o.some(h) && s.push({ faces: o, radius: c.radius, convex: r ? !r.concave : je(t, a), surface: c.surface });
  });
  const p = (c) => n[c].kind === "convex" && n[c].angleDeg >= 10 && n[c].angleDeg <= 80;
  t.faces.forEach((c, a) => {
    const r = e.faceEdges[a];
    if (c.surface === "plane") {
      const o = r.filter((d) => n[d].line && p(d)).sort((d, g) => t.edges[g].length - t.edges[d].length);
      for (let d = 0; d < o.length; d++)
        for (let g = d + 1; g < o.length; g++) {
          const x = n[o[d]], w = n[o[g]];
          if (Math.abs(b(x.tangent, w.tangent)) < 0.999)
            continue;
          const $ = k(w.point, x.point), M = O(k($, v(x.tangent, b($, x.tangent))));
          if (!(M <= 0 || M >= 0.5 * Math.min(t.edges[o[d]].length, t.edges[o[g]].length) || [o[d], o[g]].map((A) => t.edges[A].faces.find((z) => z !== a)).some((A) => e.faceArea[A] <= e.faceArea[a]))) {
            i.push({ face: a, rails: [o[d], o[g]], widthMm: M }), u.add(o[d]), u.add(o[g]);
            return;
          }
        }
    } else if (c.surface === "cone") {
      const o = r.filter((d) => n[d].kind !== "seam");
      o.length && o.every(p) && o.some((d) => t.edges[d].curve === "circle") && (i.push({ face: a, rails: o }), o.forEach((d) => u.add(d)));
    }
  });
  const m = new Set(i.map((c) => c.face));
  return e.edges.forEach((c) => {
    const a = t.edges[c.index].faces;
    a.length === 2 && a.every((r) => m.has(r)) && u.add(c.index);
  }), { blends: s, chamfers: i, broken: u };
}
function je(e, t) {
  const n = e.faces[t];
  if (n.surface === "sphere" && n.axis)
    return b(n.normal, k(n.point, n.axis.origin)) > 0;
  if (n.surface === "torus" && n.axis && n.radius !== void 0) {
    const s = n.axis.origin, i = S(n.axis.direction);
    return [1, -1].map((h) => ({ s: h, c: k(n.point, v(n.normal, h * n.radius)) })).sort((h, l) => Math.abs(b(k(h.c, s), i)) - Math.abs(b(k(l.c, s), i)))[0].s > 0;
  }
  return !0;
}
function Ue(e, t) {
  const n = f("Edge radius"), { blends: s, chamfers: i, broken: u } = Fe(e), h = e.edges.filter((M) => (M.kind === "convex" || M.kind === "concave") && !u.has(M.index)), l = h.filter((M) => M.kind === "convex"), p = h.filter((M) => M.kind === "concave"), m = [], c = (M) => (M.convex ? f("Round") : f("Fillet")) + ` R${y(M.radius)}`;
  for (const M of s)
    t.minRadiusMm !== void 0 && M.radius < t.minRadiusMm - V && m.push({ text: f`${c(M)} below the minimum R${y(t.minRadiusMm)}`, value: M.radius, location: D(Y(e, M.faces)), faces: M.faces, mark: H(e, M.faces) }), t.maxRadiusMm !== void 0 && M.radius > t.maxRadiusMm + V && m.push({ text: f`${c(M)} above the maximum R${y(t.maxRadiusMm)}`, value: M.radius, location: D(Y(e, M.faces)), faces: M.faces, mark: H(e, M.faces) });
  const a = t.edgeBreak === "all" ? h : t.edgeBreak === "external" ? l : t.edgeBreak === "internal" ? p : [];
  for (const M of a)
    m.push({ text: M.kind === "convex" ? f`Sharp external edge, ${y(e.body.edges[M.index].length)} mm long` : f`Sharp internal edge, ${y(e.body.edges[M.index].length)} mm long`, value: 0, location: D(M.point), edges: [M.index], faces: [...e.body.edges[M.index].faces], mark: pe(e, [M.index]) });
  const r = s.map((M) => M.radius), o = y(Math.min(...r)), d = y(Math.max(...r)), g = r.length ? o === d ? `R${o}` : `R${o}–R${d}` : "", x = [
    s.length ? f`${s.length} fillets and rounds (${g})` : f("no fillets or rounds"),
    f`${i.length} chamfers`,
    f`${l.length} sharp external and ${p.length} sharp internal edges`
  ].join(", ") + ".", w = t.minRadiusMm !== void 0 || t.maxRadiusMm !== void 0 || t.edgeBreak !== "none", $ = e.edges.some((M) => M.approximate && M.kind !== "seam") ? " " + f("Edges on cones of revolution or freeform faces were classified at the mesh tolerance.") : "";
  return w ? m.length ? E("edges.radius", n, "exact", "fail", x + $, m, { value: Math.min(...m.map((M) => M.value ?? 0)), ...t.minRadiusMm !== void 0 ? { limit: t.minRadiusMm } : {}, unit: "mm" }) : E("edges.radius", n, "exact", "pass", x + $, [], { ...r.length ? { value: Math.min(...r) } : {}, ...t.minRadiusMm !== void 0 ? { limit: t.minRadiusMm } : {}, unit: "mm" }) : E("edges.radius", n, "exact", "info", x + " " + f("No edge rules set.") + $);
}
const re = (e, t, n) => e.bvh.raycast(t, n, { tMin: 1e-6 }) === null, ce = (e) => e.map((t) => Ne[t]);
function Pe(e, t) {
  const n = f("Internal corner radius"), s = t.toolDiameterMm / 2, i = ce(t.approachAxes), u = [], h = [], l = /* @__PURE__ */ new Map();
  for (const a of e.edges) {
    if (a.kind !== "concave" || !a.line || !a.normals)
      continue;
    const [r, o] = a.normals, d = S(N(r, o)), g = N(a.point, v(d, 1e-3));
    if (i.some((A) => Math.abs(b(a.tangent, A)) < 1 - U && (b(r, A) > U && Math.abs(b(o, A)) < X || b(o, A) > U && Math.abs(b(r, A)) < X) && re(e.surface, g, A)))
      continue;
    const w = i.find((A) => Math.abs(b(a.tangent, A)) > U && Math.abs(b(r, A)) < X && Math.abs(b(o, A)) < X && re(e.surface, g, A));
    if (!w)
      continue;
    const $ = e.body.edges[a.index].length, M = [...k(a.point, v(w, b(a.point, w)))].map((A) => Math.round(A * 1e4)).join(","), R = l.get(M);
    R ? (R.edges.push(a.index), R.length += $) : l.set(M, { edges: [a.index], length: $, point: a.point });
  }
  for (const a of l.values())
    u.push({ text: f`Sharp internal corner (radius 0), ${y(a.length)} mm long; the R${y(s)} tool leaves a radius`, value: 0, location: D(a.point), edges: a.edges, faces: [...new Set(a.edges.flatMap((r) => e.body.edges[r].faces))], mark: pe(e, a.edges) });
  let p = 1 / 0;
  for (const a of e.cylinders) {
    if (!a.concave || a.full || !i.some((d) => Math.abs(b(a.direction, d)) > U))
      continue;
    p = Math.min(p, a.radius);
    const r = a.hMax - a.hMin, o = D(Y(e, a.faces));
    a.radius < s - V ? u.push({ text: f`Corner fillet R${y(a.radius)} below the R${y(s)} tool radius (Ø${y(t.toolDiameterMm)} end mill)`, value: a.radius, location: o, faces: a.faces, mark: H(e, a.faces) }) : a.radius < r / 3 - V && h.push({ text: f`Corner fillet R${y(a.radius)} is ${y(r)} mm deep: below a third of its depth (R${y(r / 3)}), which needs a long, slender tool`, value: a.radius, location: o, faces: a.faces, mark: H(e, a.faces) });
  }
  const m = l.size ? 0 : Number.isFinite(p) ? p : void 0, c = { ...m !== void 0 ? { value: m } : {}, limit: s, unit: "mm" };
  if (u.length) {
    const a = [l.size ? f`${l.size} sharp internal corners (radius 0)` : "", u.length - l.size ? f`${u.length - l.size} corner fillets as small as R${y(p)}` : ""].filter(Boolean).join(f(" and "));
    return E("cnc.internal-corners", n, "exact", "fail", f`${a} below the R${y(s)} tool radius (Ø${y(t.toolDiameterMm)} end mill); add fillets ≥ R${y(s)} or use a smaller tool.`, [...u, ...h], c);
  }
  return h.length ? E("cnc.internal-corners", n, "exact", "warn", f`All internal corners along the tool axes are ≥ R${y(s)}, but ${h.length} are deeper than three times their radius.`, h, c) : E("cnc.internal-corners", n, "exact", "pass", f`All internal corners along the tool axes are ≥ R${y(s)}.`, [], c);
}
function _e(e, t, n) {
  const s = f("Undercuts"), i = n ? "exact" : "mesh", u = ce(t.approachAxes), h = u.map((a) => {
    let r = 1 / 0;
    for (let o = 0; o < e.positions.length; o += 3)
      r = Math.min(r, e.positions[o] * a[0] + e.positions[o + 1] * a[1] + e.positions[o + 2] * a[2]);
    return r;
  }), l = [];
  let p = 0;
  for (let a = 0; a < e.count; a++) {
    if (e.area[a] <= 1e-12)
      continue;
    const r = W(e, a), o = G(e, a);
    u.some((g, x) => {
      const w = b(r, g);
      return w < -U && q(e, a).every(($) => b($, g) - h[x] < 1e-3) ? !0 : w < -1e-3 ? !1 : e.bvh.raycast(N(o, v(r, 1e-3)), g, { tMin: 1e-6, skipTri: a }) === null;
    }) || (l.push(a), p += e.area[a]);
  }
  const m = [];
  if (n) {
    const a = /* @__PURE__ */ new Map();
    for (const r of l) {
      const o = n.body.mesh.faceOf[r];
      a.set(o, [...a.get(o) ?? [], r]);
    }
    for (const [r, o] of a) {
      const d = o.reduce((g, x) => g + e.area[x], 0);
      m.push({ text: f`${y(d)} mm² of this face cannot be reached from ${t.approachAxes.join(", ")}`, value: d, location: D(Y(n, [r])), faces: [r], mark: { lines: n.faceEdges[r].map((g) => oe(n, g)), triangles: Z(e, o), points: [] } });
    }
    m.sort((r, o) => (o.value ?? 0) - (r.value ?? 0));
  } else if (l.length) {
    const a = [...l].sort((r, o) => e.area[o] - e.area[r])[0];
    m.push({ text: f`${y(p)} mm² of surface cannot be reached from ${t.approachAxes.join(", ")}`, value: p, location: D(G(e, a)), mark: { lines: [], triangles: Z(e, l), points: [] } });
  }
  const c = { value: p, limit: t.maxUndercutAreaMm2, unit: "mm2" };
  return p > t.maxUndercutAreaMm2 ? E("cnc.undercuts", s, i, "fail", f`${y(p)} mm² of surface cannot be reached from ${t.approachAxes.join(", ")}; it needs another setup, a 4/5-axis machine or a redesign.`, m, c) : E("cnc.undercuts", s, i, "pass", f`No undercuts: every surface is reachable from ${t.approachAxes.join(", ")}.`, [], c);
}
function We(e, t) {
  const n = f("Internal corner radius"), s = ce(t.approachAxes), i = /* @__PURE__ */ new Map(), u = (p) => [0, 1, 2].map((m) => Math.round(e.positions[3 * p + m] * 1e4)).join(",");
  for (let p = 0; p < e.count; p++)
    for (let m = 0; m < 3; m++) {
      const c = u(e.indices[3 * p + m]), a = u(e.indices[3 * p + (m + 1) % 3]), r = c < a ? c + "|" + a : a + "|" + c;
      i.set(r, [...i.get(r) ?? [], p, e.indices[3 * p + m], e.indices[3 * p + (m + 1) % 3]]);
    }
  const h = [];
  for (const p of i.values()) {
    if (p.length !== 6)
      continue;
    const [m, c, a, r] = p, o = W(e, m), d = W(e, r);
    if (b(o, d) > Math.cos(60 * he))
      continue;
    const g = K(e, c), x = K(e, a), w = S(k(x, g)), $ = v(N(g, x), 0.5);
    if (b(d, k(G(e, m), $)) <= 1e-6)
      continue;
    const M = S(N(o, d)), R = N($, v(M, 1e-3));
    s.find((z) => Math.abs(b(w, z)) > U && Math.abs(b(o, z)) < X && Math.abs(b(d, z)) < X && re(e, R, z)) && h.push({ text: f`Sharp internal corner, ${y(O(k(x, g)))} mm long`, value: 0, location: D($), mark: { lines: [[...g, ...x]], triangles: [], points: [] } });
  }
  const l = f("Fillet radii cannot be measured on a mesh; only creases sharper than 60° were looked for.");
  return h.length ? E("cnc.internal-corners", n, "mesh", "fail", f`${h.length} sharp internal corners (mesh edges) along the tool axes.` + " " + l, h, { value: 0, limit: t.toolDiameterMm / 2, unit: "mm" }) : E("cnc.internal-corners", n, "mesh", "info", f("No sharp internal corners along the tool axes.") + " " + l);
}
function Me(e, t, n, s, i, u) {
  const h = f("Hole size"), l = t.cylinders.filter((a) => a.concave && a.full && (!u || Math.abs(b(a.direction, u)) > U));
  if (!l.length)
    return E(e, h, "exact", "pass", f("No round holes."), [], { limit: n, unit: "mm" });
  const p = l.filter((a) => 2 * a.radius < n - V).sort((a, r) => a.radius - r.radius), m = Math.min(...l.map((a) => 2 * a.radius)), c = p.map((a) => ({ text: f`Hole Ø${y(2 * a.radius)} below Ø${y(n)}`, value: 2 * a.radius, location: D(Y(t, a.faces)), faces: a.faces, mark: H(t, a.faces) }));
  return c.length ? E(e, h, "exact", s, f`${c.length} of ${l.length} round holes below Ø${y(n)} (smallest Ø${y(m)}); ${i}`, c, { value: m, limit: n, unit: "mm" }) : E(e, h, "exact", "pass", f`${l.length} round holes, the smallest Ø${y(m)} (limit Ø${y(n)}).`, [], { value: m, limit: n, unit: "mm" });
}
function qe(e, t) {
  let n;
  if (t)
    t.body.faces.forEach((l, p) => {
      l.surface === "plane" && (!n || t.faceArea[p] > n.area) && (n = { n: [...l.normal], area: t.faceArea[p] });
    });
  else
    for (let l = 0; l < e.count; l++)
      (!n || e.area[l] > n.area) && (n = { n: W(e, l), area: e.area[l] });
  if (!n)
    return { offending: [] };
  const s = n.n, i = [], u = [], h = (l, p, m) => {
    const c = b(l, s);
    if (Math.abs(c) > 1 - 1e-6) {
      const a = b(p, s), r = i.find((o) => Math.abs(o.h - a) < 1e-6);
      r ? r.ids.push(m) : i.push({ h: a, ids: [m] });
      return;
    }
    Math.abs(c) > 1e-6 && u.push(m);
  };
  if (t)
    t.body.faces.forEach((l, p) => {
      l.surface === "plane" ? h([...l.normal], [...l.point], p) : l.surface === "cylinder" && l.axis ? Math.abs(b(S(l.axis.direction), s)) < 1 - 1e-6 && u.push(p) : t.faceTris[p].some((m) => Math.abs(b(W(e, m), s)) > 1e-3) && u.push(p);
    });
  else
    for (let l = 0; l < e.count; l++)
      e.area[l] > 1e-12 && h(W(e, l), G(e, l), l);
  i.sort((l, p) => l.h - p.h);
  for (const l of i.slice(1, -1))
    u.push(...l.ids);
  return i.length < 2 || u.length ? { offending: u } : { sheet: { axis: s, thickness: i[i.length - 1].h - i[0].h }, offending: u };
}
function Le(e, t, n) {
  const s = n ? "exact" : "mesh", i = f("Flat sheet"), { sheet: u, offending: h } = qe(e, n);
  if (!u) {
    const a = n ? h.slice(0, ae * 4).map((o) => ({ text: f`Face not perpendicular to the sheet (${n.body.faces[o].surface})`, location: D(Y(n, [o])), faces: [o], mark: H(n, [o]) })) : h.length ? [{ text: f("Surface not perpendicular to the sheet"), location: D(G(e, h[0])), mark: { lines: [], triangles: Z(e, h), points: [] } }] : [], r = f("Not a flat sheet of one thickness: a laser cuts straight through a sheet, so every face must be one of its two sides or perpendicular to them.");
    return [E("laser.sheet", i, s, "fail", r, a), J("laser.min-web", f("Minimum web"), s, f("Not a flat sheet.")), ...n ? [J("laser.min-hole", f("Hole size"), s, f("Not a flat sheet."))] : []];
  }
  const l = u.axis, p = Math.abs(l[0]) > U ? "X" : Math.abs(l[1]) > U ? "Y" : Math.abs(l[2]) > U ? "Z" : l.map((a) => y(a)).join(", "), m = [E("laser.sheet", i, s, "pass", f`A flat sheet ${y(u.thickness)} mm thick, normal along ${p}.`, [], { value: u.thickness, unit: "mm" })], c = t.minWallMm ?? u.thickness;
  return m.push(ie("laser.min-web", f("Minimum web"), e, c, n, { filter: (a) => Math.abs(b(W(e, a), l)) < 0.5, status: "warn", what: f("Webs between cuts") })), n && m.push(Me("laser.min-hole", n, Math.max(u.thickness, t.minWallMm ?? 0), "warn", f("holes smaller than the sheet thickness cut poorly."), l)), m;
}
function Ge(e, t) {
  const n = [];
  n.push(e.topology.watertight ? E("fdm.watertight", f("Watertight mesh"), "mesh", "pass", f("Closed, manifold mesh.")) : E("fdm.watertight", f("Watertight mesh"), "mesh", "fail", f`${e.topology.openEdges} open, ${e.topology.nonManifoldEdges} non-manifold edges`));
  const s = e.current, i = e.orientations?.[0];
  if (s && i) {
    const u = s.overhangs.map((l) => ({ text: f`${y(l.areaMm2)} mm² overhang up to ${y(l.maxOverhangDeg)}°${l.spanMm !== void 0 ? f` (bridge ${y(l.spanMm)} mm)` : ""}`, value: l.areaMm2, location: D(v(N(l.bboxMin, l.bboxMax), 0.5)), mark: { lines: [He(l.bboxMin, l.bboxMax)], triangles: [], points: [] } }));
    n.push(E("fdm.overhangs", f("Overhangs as modelled"), "mesh", s.unsupportedAreaMm2 > 0 ? "warn" : "pass", s.unsupportedAreaMm2 > 0 ? f`${y(s.unsupportedAreaMm2)} mm² unsupported steeper than ${y(t.maxOverhangDeg)}° in ${s.overhangRegions} regions.` : f`No unsupported overhang steeper than ${y(t.maxOverhangDeg)}°.`, u, { value: s.unsupportedAreaMm2, unit: "mm2" }));
    const h = Math.abs(i.rotation.deg) < 1e-9 ? f("as modelled") : f`rotate ${y(i.rotation.deg)}° about ${i.rotation.axis[0] ? "X" : i.rotation.axis[1] ? "Y" : "Z"}`;
    n.push(E("fdm.orientation", f("Print orientation"), "mesh", i.fitsBed ? i.unsupportedAreaMm2 > 0 ? "warn" : "pass" : "fail", i.fitsBed ? f`Best: ${i.label ?? ""} up (${h}), ${y(i.unsupportedAreaMm2)} mm² unsupported.` : f`Does not fit the ${t.bedSizeMm.x} × ${t.bedSizeMm.y} × ${t.bedSizeMm.z} mm bed in any axis orientation.`)), (i.bedContactLow || i.tipRisk) && n.push(E("fdm.bed-contact", f("Bed adhesion"), "mesh", "warn", i.tipRisk ? f("Tall part on a small base may tip") : f("Small bed contact area")));
  }
  return n;
}
const He = (e, t) => {
  const n = (s, i, u) => [s ? t[0] : e[0], i ? t[1] : e[1], u ? t[2] : e[2]];
  return [n(0, 0, 0), n(1, 0, 0), n(1, 1, 0), n(0, 1, 0), n(0, 0, 0), n(0, 0, 1), n(1, 0, 1), n(1, 1, 1), n(0, 1, 1), n(0, 0, 1)].flat();
};
function Ke(e, t = {}) {
  const n = Ae(t), s = e.meshes.filter((h) => !h.reference && !h.hole && h.indices.length > 0 && (!e.bodies?.length || e.bodies.includes(h.id))), i = e.bodies?.filter((h) => !e.meshes.some((l) => l.id === h)) ?? [];
  if (i.length)
    throw new RangeError(f`Unknown object id: ${i[0]}`);
  const u = s.map((h) => {
    const l = n.exact ? e.exact?.bodies.find((d) => d.id === h.id) : void 0, p = e.exact?.failures.find((d) => d.id === h.id), m = l ? void 0 : n.exact ? p ? f`no exact B-rep: ${p.message}` : e.exactUnavailable ? f`exact kernel unavailable: ${e.exactUnavailable}` : f("no exact B-rep for this body") : f("exact geometry not requested"), c = l ? Ie(l) : void 0, r = c ? c.surface : me(h.positions, h.indices), o = [];
    if (n.process === "fdm") {
      const d = be([h], { nozzleMm: n.nozzleMm, minWallMm: n.minWallMm ?? 2 * n.nozzleMm, maxOverhangDeg: n.maxOverhangDeg, maxBridgeMm: n.maxBridgeMm, bedSizeMm: n.bedSizeMm }).bodies[0], g = n.minWallMm ?? 2 * n.nozzleMm;
      if (c)
        o.push(ie("fdm.min-wall", f("Minimum wall thickness"), r, g, c));
      else {
        const x = d.minWall, w = x.violations.map(($) => ({ text: f`${y($.thicknessMm)} mm thick (limit ${y(g)} mm)`, value: $.thicknessMm, location: $.location, mark: { lines: [], triangles: [], points: [...$.location] } }));
        o.push(x.thinnestMm === null ? E("fdm.min-wall", f("Minimum wall thickness"), "mesh", "info", f("No opposite wall found within the part.")) : E("fdm.min-wall", f("Minimum wall thickness"), "mesh", w.length ? "fail" : "pass", w.length ? f`Walls as thin as ${y(x.thinnestMm)} mm, below ${y(g)} mm (${x.sampleCount} samples).` : f`Walls are at least ${y(g)} mm; thinnest ${y(x.thinnestMm)} mm (${x.sampleCount} samples).`, w, { value: x.thinnestMm, limit: g, unit: "mm" }));
      }
      o.push(c ? Me("fdm.min-hole", c, n.minHoleMm, "fail", f("they print undersized or close up.")) : J("fdm.min-hole", f("Hole size"), "mesh", f("Hole diameters need the exact B-rep."))), o.push(...Ge(d, n));
    } else n.process === "cnc" ? (o.push(c ? Pe(c, n) : We(r, n)), o.push(_e(r, n, c)), o.push(ie("cnc.min-wall", f("Minimum wall thickness"), r, n.minWallMm ?? 0.8, c))) : o.push(...Le(r, n, c));
    return o.push(c ? Ue(c, n) : J("edges.radius", f("Edge radius"), "mesh", f("Fillet radii and sharp edges need the exact B-rep."))), { id: h.id, name: h.name, geometry: c ? "exact" : "mesh", ...m ? { reason: m } : {}, checks: o };
  });
  return {
    version: ye,
    process: n.process,
    settings: n,
    bodies: u,
    ...e.kernel && u.some((h) => h.geometry === "exact") ? { kernel: e.kernel } : {},
    disclaimer: f("Design screening against rules of thumb, not a quote or a guarantee that the part can be made. Wall thickness is sampled; exact checks use the B-rep, mesh checks the tessellation.")
  };
}
export {
  ae as MAX_MANUFACTURING_FINDINGS,
  Ie as buildExactModel,
  Ke as checkManufacturing,
  Fe as edgeBreaks,
  pe as edgeMark,
  Y as faceCentre,
  H as faceMark
};
