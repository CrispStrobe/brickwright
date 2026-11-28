import { d as h, f as p, t as x } from "./geometry.worker-RK0f-gvM.js";
import { buildExactModel as M, edgeBreaks as k, faceMark as D, faceCentre as E } from "./manufacturing-B4mipg2c.js";
import "./printability-CZ7dAjWG.js";
const v = 1;
function w(e, o) {
  const c = [], d = /* @__PURE__ */ new Set(), t = (i) => {
    if (d.has(i))
      return;
    d.add(i);
    const r = e.nodes[i];
    if (r && (h(r).forEach(t), r.kind === "exact-feature" && (r.operation === "fillet" || r.operation === "chamfer")))
      try {
        c.push({ id: i, name: r.name, operation: r.operation, sizeMm: p(r.size, e) });
      } catch {
      }
  };
  return t(o), c;
}
const b = 0.5, y = /* @__PURE__ */ new Set(["bspline", "revolution", "extrusion", "offset", "other"]), S = Math.PI / 180;
function g(e, o) {
  const c = new Set(o), d = [...new Set(o.flatMap((i) => e.faceEdges[i]))].filter((i) => {
    const r = e.edges[i], n = e.body.edges[i].faces;
    return r.kind !== "seam" && n.some((a) => !c.has(a));
  }), t = d.filter((i) => e.edges[i].kind === "tangent");
  return { edges: d, tangent: t, maxDeviation: t.length ? Math.max(...t.map((i) => e.edges[i].angleDeg)) : void 0, approximate: d.some((i) => e.edges[i].approximate) };
}
const f = (e, o) => e > 0 && o === e ? "G1" : o > 0 ? "partly" : "none", B = (e, o) => o.reduce((c, d) => c + e.faceArea[d], 0);
function R(e, o) {
  const { blends: c, chamfers: d } = k(e), t = [], i = /* @__PURE__ */ new Set(), r = (n) => ({ faces: n, areaMm2: B(e, n), location: [...E(e, n)], ...o ? { mark: D(e, n) } : {} });
  for (const n of c) {
    n.faces.forEach((s) => i.add(s));
    const a = g(e, n.faces);
    t.push({
      kind: n.convex ? "round" : "fillet",
      surface: n.surface,
      radiusMm: n.radius,
      ...r(n.faces),
      boundaryEdges: a.edges.length,
      tangentEdges: a.tangent.length,
      ...a.maxDeviation !== void 0 ? { maxTangentDeviationDeg: a.maxDeviation } : {},
      continuity: f(a.edges.length, a.tangent.length),
      approximate: a.approximate
    });
  }
  for (const n of d) {
    i.add(n.face);
    const a = g(e, [n.face]), s = n.rails.map((l) => e.edges[l].angleDeg), u = n.widthMm !== void 0 && s.length === 2 && Math.abs(s[0] - s[1]) < 0.01 ? n.widthMm / (2 * Math.sin((s[0] + s[1]) * S / 2)) : void 0;
    t.push({
      kind: "chamfer",
      surface: e.body.faces[n.face].surface,
      ...n.widthMm !== void 0 ? { widthMm: n.widthMm } : {},
      anglesDeg: s,
      ...u !== void 0 ? { setbackMm: u } : {},
      ...r([n.face]),
      boundaryEdges: a.edges.length,
      tangentEdges: a.tangent.length,
      ...a.maxDeviation !== void 0 ? { maxTangentDeviationDeg: a.maxDeviation } : {},
      continuity: f(a.edges.length, a.tangent.length),
      approximate: a.approximate
    });
  }
  return e.body.faces.forEach((n, a) => {
    if (i.has(a) || !y.has(n.surface))
      return;
    const s = g(e, [a]);
    s.tangent.length && t.push({
      kind: "freeform",
      surface: n.surface,
      ...r([a]),
      boundaryEdges: s.edges.length,
      tangentEdges: s.tangent.length,
      ...s.maxDeviation !== void 0 ? { maxTangentDeviationDeg: s.maxDeviation } : {},
      continuity: f(s.edges.length, s.tangent.length),
      approximate: s.approximate
    });
  }), t;
}
const m = (e, o) => Math.abs(e - o) <= 1e-5 * Math.max(1, Math.abs(o));
function _(e) {
  const o = e.bodies?.length ? new Set(e.bodies) : void 0, c = e.exact.bodies.filter((t) => !o || o.has(t.id)).map((t) => {
    const i = M(t), r = R(i, !!e.marks), n = e.document.roots.includes(t.id) ? w(e.document, t.id).map((a) => ({
      ...a,
      matched: a.operation === "fillet" ? r.filter((s) => (s.kind === "fillet" || s.kind === "round") && s.radiusMm !== void 0 && m(s.radiusMm, a.sizeMm)).length : r.filter((s) => s.kind === "chamfer" && s.setbackMm !== void 0 && m(s.setbackMm, a.sizeMm)).length
    })) : [];
    return { id: t.id, name: t.name, blends: r, authored: n, faces: t.faces.length, edges: t.edges.length };
  }), d = e.exact.failures.filter((t) => !o || o.has(t.id)).map((t) => ({ id: t.id, name: t.name, message: x`no exact B-rep: ${t.message}` }));
  return { version: v, bodies: c, failures: d, tangentDeg: b, ...e.kernel && c.length ? { kernel: e.kernel } : {} };
}
export {
  _ as inspectSurfaceBlends
};
