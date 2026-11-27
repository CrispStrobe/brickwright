import { p as N, a as V, M as y, t as S, j as B, s as $, b as A, m as P, c as R } from "./geometry.worker-BDK-0LR6.js";
function T(s, r) {
  const h = new Float32Array(s.positions.length), i = [1 / 0, 1 / 0, 1 / 0], M = [-1 / 0, -1 / 0, -1 / 0];
  for (let n = 0; n < h.length; n += 3) {
    const l = R(r, [s.positions[n], s.positions[n + 1], s.positions[n + 2]]);
    for (let o = 0; o < 3; o++)
      h[n + o] = l[o], l[o] < i[o] && (i[o] = l[o]), l[o] > M[o] && (M[o] = l[o]);
  }
  return { ...s, positions: h, bounds: { min: i, max: M } };
}
function E(s, r, h, i, M) {
  const n = N(r, i.joint, i.range), l = new Set(V(r)), o = h.bodies.filter((e) => l.has(e.id) && !e.reference && !e.hole && e.indices.length);
  if (o.length > y.maxBodies)
    throw new Error(S`The mechanism check is limited to ${y.maxBodies} bodies`);
  const j = B(r), f = new Map(o.map((e) => [e.id, e.name])), u = /* @__PURE__ */ new Set([...n.moving, ...n.coupled.flatMap((e) => e.moving)]), I = $(n.range, i.steps ?? y.defaultSteps), d = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map();
  let k = 0;
  for (let e = 0; e < o.length; e++)
    for (let m = e + 1; m < o.length; m++)
      j.has(A(o[e].id, o[m].id)) && k++;
  const w = (e, m, b, p) => {
    for (const t of b.interfering) {
      const c = A(t.a, t.b);
      if (j.has(c) || p && !u.has(t.a) && !u.has(t.b))
        continue;
      const a = d.get(c);
      a ? (a.firstAt = Math.min(a.firstAt, e), a.lastAt = Math.max(a.lastAt, e), a.poses++, a.maxVolumeMm3 = Math.max(a.maxVolumeMm3, t.volumeMm3), a.atRest || (a.atRest = m)) : d.set(c, { a: t.a, b: t.b, aName: f.get(t.a) ?? t.a, bName: f.get(t.b) ?? t.b, firstAt: e, lastAt: e, poses: 1, maxVolumeMm3: t.volumeMm3, atRest: m });
    }
    for (const t of b.closerThanClearance) {
      const c = A(t.a, t.b);
      if (j.has(c) || d.has(c) || p && !u.has(t.a) && !u.has(t.b))
        continue;
      const a = g.get(c);
      (!a || t.gapMm < a.gapMm) && g.set(c, { a: t.a, b: t.b, aName: f.get(t.a) ?? t.a, bName: f.get(t.b) ?? t.b, at: e, gapMm: t.gapMm });
    }
  }, x = { minVolumeMm3: i.minVolumeMm3 ?? 1e-3, ...i.clearanceMm ? { clearanceMm: i.clearanceMm } : {} };
  w(0, !0, s(o, x), !1);
  for (const e of I) {
    if (M?.throwIfAborted(), Math.abs(e) < 1e-12)
      continue;
    const m = P(r, n, e), b = o.map((p) => {
      const t = m.get(p.id);
      return t ? T(p, t) : p;
    });
    w(e, !1, s(b, x), !0);
  }
  const v = [...d.values()];
  for (const e of d.keys())
    g.delete(e);
  return {
    joint: n.joint.id,
    jointName: `${n.joint.kind} ${f.get(n.joint.bodyA) ?? n.joint.bodyA} – ${f.get(n.joint.bodyB) ?? n.joint.bodyB}`,
    unit: n.unit,
    range: n.range,
    samples: I.length,
    moving: n.moving,
    coupled: n.coupled.map((e) => ({ joint: e.joint.id, ratio: e.ratio })),
    collisions: v,
    near: [...g.values()],
    skippedPairs: k,
    clear: !v.length
  };
}
export {
  E as checkMechanism
};
