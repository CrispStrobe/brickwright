var je = Object.defineProperty;
var Ke = (e, t, n) => t in e ? je(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Z = (e, t, n) => Ke(e, typeof t != "symbol" ? t + "" : t, n);
import { c as Ne, C as Ve, s as qe, a as Ue, e as Ze, f as j, b as Ge, d as Qe, g as We, h as Je, i as ke, j as Me, k as et, l as tt, t as N, M as nt, m as rt, E as be, n as ot, v as Ae, o as st } from "../geometry.worker-7OKQ8aFu.js";
var S = class extends Error {
  constructor(t, n, r) {
    super(n, r);
    Z(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, P = (e) => {
  throw new S("invalid-input", e);
};
function R(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && P(`${e} must be finite numbers (got ${String(n)}).`);
}
function O(e, ...t) {
  R(e, ...t);
  for (const n of t) n > 0 || P(`${e} must be positive (got ${n}).`);
}
function oe(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return P(`${e} must be a 3-vector.`);
  R(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || P(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function at(e) {
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
function it(e, t) {
  const n = new Float64Array(e.length);
  for (let r = 0; r < t.length; r += 3) {
    const o = t[r] * 3, a = t[r + 1] * 3, s = t[r + 2] * 3, i = e[a] - e[o], l = e[a + 1] - e[o + 1], f = e[a + 2] - e[o + 2], h = e[s] - e[o], c = e[s + 1] - e[o + 1], u = e[s + 2] - e[o + 2], p = l * u - f * c, x = f * h - i * u, A = i * c - l * h;
    for (const g of [o, a, s])
      n[g] += p, n[g + 1] += x, n[g + 2] += A;
  }
  for (let r = 0; r < n.length; r += 3) {
    const o = Math.hypot(n[r], n[r + 1], n[r + 2]);
    o > 0 && (n[r] /= o, n[r + 1] /= o, n[r + 2] /= o);
  }
  return n;
}
var K = (e) => ({ part: e, dispose: () => e.dispose() }), L = (e) => ({ sketch: e, dispose: () => e.dispose() }), z = (e) => e?.part ?? P("Not a solid of this kernel."), D = (e) => e?.sketch ?? P("Not a profile of this kernel."), V = (e) => [e[0], e[1], e[2]];
function v(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof S) throw n;
    const r = n instanceof Error ? n.message : String(n);
    throw new S("kernel-failure", `SMLib ${e} failed: ${r}`, { cause: n });
  }
}
function lt(e) {
  return { sm: e, solid: (r, o) => {
    if (!(o instanceof e.Part)) throw new S("kernel-failure", `SMLib ${r} did not produce a solid (got ${o?.constructor?.name ?? typeof o}).`);
    return K(o);
  }, face: (r, o) => {
    const { faceNormal: a, outermost: s } = Array.isArray(o) ? { faceNormal: o, outermost: !1 } : o, i = oe("Face normal", a), l = (h) => {
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
var X = (e) => [e[0], e[1], 0];
function ct(e, t, n) {
  let r = t;
  const o = [], a = (s, i) => ((!Array.isArray(i) || i.length !== 2) && P(`${s} must be a 2D point.`), R(s, i[0], i[1]), i);
  for (const s of n) {
    const i = s.kind === "spline" ? a("Spline point", s.through.at(-1) ?? P("A spline needs at least one point.")) : a("Path point", s.to);
    s.kind === "line" ? o.push(e.Line(X(r), X(i))) : s.kind === "arc" ? o.push(e.ThreePointArc(X(r), X(a("Arc point", s.via)), X(i))) : s.kind === "radiusArc" ? (R("Arc radius", s.radius), o.push(e.RadiusArc(X(r), X(i), s.radius))) : s.kind === "sagittaArc" ? (R("Arc sagitta", s.sagitta), o.push(e.SagittaArc(X(r), X(i), s.sagitta))) : s.kind === "spline" ? o.push(e.Spline(X(r), ...s.through.map((l) => X(a("Spline point", l))))) : P(`Unknown path segment kind '${s.kind}'.`), r = i;
  }
  return Math.hypot(r[0] - t[0], r[1] - t[1]) > 1e-9 && o.push(e.Line(X(r), X(t))), o;
}
function ut(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && P("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && P("Each polygon contour needs at least three points.");
        for (const r of n) R("Polygon points", r[0], r[1]);
      }
      return v("Polygon", () => {
        const n = t.map((r) => e.Polygon(r.map((o) => [o[0], o[1]])));
        return L(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)));
      });
    },
    circle(t) {
      return O("Circle radius", t), v("Circle", () => L(e.Circle(t)));
    },
    rectangle(t, n, r) {
      return O("Rectangle size", t, n), v("Rectangle", () => L(r ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, r) {
      return O("Rounded rectangle size and radius", t, n, r), r >= Math.min(t, n) / 2 && P("The corner radius must be below half the short side."), v("RoundedRectangle", () => L(e.RoundedRectangle(t, n, r)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && P("A path profile needs at least one segment."), R("Path start", ...Array.isArray(t) ? t : [NaN]), v("path", () => L(e.makeFace(new e.Wire(ct(e, t, n)))));
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && P("Text must be a non-empty string."), O("Text size", n);
      try {
        return L(e.Text(t, n));
      } catch (r) {
        if (r instanceof e.FontError) throw new S("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${r.message}`, { cause: r });
        return v("Text", () => {
          throw r;
        });
      }
    },
    union: (t, ...n) => v("fuse (2D)", () => L(n.length ? e.fuse(D(t), ...n.map(D)) : D(t))),
    subtract: (t, ...n) => v("cut (2D)", () => L(n.length ? e.cut(D(t), ...n.map(D)) : D(t))),
    intersect: (t, ...n) => v("intersect (2D)", () => L(n.length ? e.intersect(D(t), ...n.map(D)) : D(t))),
    hull: (...t) => (t.length || P("A hull needs at least one profile."), v("Hull (2D)", () => L(e.Hull(...t.map(D))))),
    translate: (t, [n, r]) => (R("Profile offset", n, r), v("translate (2D)", () => L(D(t).translate([n, r, 0])))),
    rotate: (t, n) => (R("Profile angle", n), v("rotate (2D)", () => L(D(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, r]) => (R("Profile scale", n, r), (n === 0 || r === 0) && P("A zero profile scale flattens the profile."), v("scale (2D)", () => L(D(t).scale([n, r, 1])))),
    offset: (t, n, r) => (R("Profile offset distance", n), v("offset (2D)", () => L(e.offset(D(t), n, { corners: r ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = D(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => v("area (2D)", () => D(t).area)
  };
}
var ft = 0.01, dt = 10, ht = "MIT AND Apache-2.0";
async function pt(e) {
  const { init: t } = await import("./chunk-AJV3MJKC-eTtNTT3-.js").then(function(n) {
    return n.c;
  });
  try {
    return await t(e);
  } catch (n) {
    throw new S("invalid-input", `Could not load SMLib: ${n instanceof Error ? n.message : String(n)}`, { cause: n });
  }
}
var $e = (e) => {
  const t = e.tolerance ?? ft, n = e.angleDeg ?? dt;
  return O("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function mt({ sm: e, solid: t }) {
  return {
    box(n) {
      return O("Box size", ...n), v("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, r) {
      return O("Cylinder radius and height", n, r), v("Cylinder", () => t("Cylinder", e.Cylinder(n, r)));
    },
    cone(n, r, o) {
      return R("Cone radii", n, r), O("Cone height", o), (n < 0 || r < 0 || !(n > 0 || r > 0)) && P("Cone radii must be non-negative and not both zero."), v("Cone", () => t("Cone", n === r ? e.Cylinder(n, o) : e.Cone(n, r, o)));
    },
    sphere(n) {
      return O("Sphere radius", n), v("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, r) {
      return O("Torus radii", n, r), r >= n && P("The tube radius must be smaller than the major radius."), v("Torus", () => t("Torus", e.Torus(n, r)));
    },
    polyhedron(n, r) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(r) || r.length < 4) && P("A polyhedron needs at least four points and four faces.");
      for (const o of n) R("Polyhedron points", o[0], o[1], o[2]);
      for (const o of r) (!Array.isArray(o) || o.length < 3 || o.some((a) => !Number.isInteger(a) || a < 0 || a >= n.length)) && P("Polyhedron faces must index at least three existing points.");
      return v("stitch (polyhedron)", () => e.scope(() => {
        const o = r.map((s) => {
          const i = s.map((l) => V(n[l]));
          return e.makeFace(e.Polyline(...i, i[0]));
        }), a = e.stitch(...o);
        return (!(a instanceof e.Part) || !a.isValid()) && P("The polyhedron faces do not close around a valid solid."), K(a);
      }));
    }
  };
}
function xt({ sm: e, solid: t }) {
  return {
    extrude(n, r) {
      return O("Extrusion height", r), v("extrude", () => t("extrude", e.extrude(D(n), r)));
    },
    revolve(n, r) {
      return R("Revolution angle", r), (r === 0 || Math.abs(r) > 360) && P("Revolution angle must be in (0, 360] degrees in magnitude."), v("revolve", () => e.scope(() => {
        const o = D(n).rotate(e.Axis.X, 90), a = e.revolve(o, e.Axis.Z, Math.abs(r));
        return t("revolve", r < 0 ? a.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : a);
      }));
    },
    loft(n, r = {}) {
      (!Array.isArray(n) || n.length < 2) && P("A loft needs at least two sections.");
      for (const o of n) R("Loft section position", ...o.at);
      return v("loft", () => e.scope(() => t("loft", e.loft(n.map((o) => D(o.profile).translate(V(o.at))), { ruled: !!r.ruled }))));
    },
    sweep(n, r) {
      (!Array.isArray(r) || r.length < 2) && P("A sweep rail needs at least two points.");
      for (const o of r) R("Sweep rail points", ...o);
      return v("sweep", () => e.scope(() => {
        const o = r.map(V), a = o.length === 2 ? e.Line(o[0], o[1]) : e.Polyline(o);
        return t("sweep", e.sweep(D(n), a));
      }));
    }
  };
}
function gt({ sm: e, solid: t }) {
  return {
    union: (n, ...r) => v("fuse", () => t("fuse", r.length ? e.fuse(z(n), ...r.map(z)) : z(n))),
    subtract: (n, ...r) => v("cut", () => t("cut", r.length ? e.cut(z(n), ...r.map(z)) : z(n))),
    intersect: (n, ...r) => v("intersect", () => t("intersect", r.length ? e.intersect(z(n), ...r.map(z)) : z(n))),
    splitByPlane: (n, r, o) => {
      const a = oe("Split normal", r);
      return R("Split offset", o), v("split", () => {
        const [s, i] = e.split(z(n), new e.Plane([a[0] * o, a[1] * o, a[2] * o], void 0, a), "both");
        return [t("split", s), t("split", i)];
      });
    },
    translate: (n, r) => (R("Translation", ...r), v("translate", () => K(z(n).translate(V(r))))),
    rotate: (n, r, o, a = [0, 0, 0]) => {
      const s = oe("Rotation axis", r);
      return R("Rotation angle and pivot", o, ...a), v("rotate", () => K(z(n).rotate(new e.Axis(V(a), s), o)));
    },
    mirror: (n, r, o = [0, 0, 0]) => {
      const a = oe("Mirror normal", r);
      return R("Mirror origin", ...o), v("mirror", () => K(z(n).mirror(new e.Plane(V(o), void 0, a))));
    },
    scale: (n, r) => (R("Scale factors", ...r), r.some((o) => o === 0) && P("A zero scale factor flattens the solid."), v("scale", () => K(z(n).scale(V(r), [0, 0, 0]))))
  };
}
function yt(e) {
  const { sm: t, solid: n, face: r } = e, o = (s, i) => i === "all" ? s.edges() : r(s, i).edges(), a = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, i, l = "all") => (O("Fillet radius", i), v("fillet", () => n("fillet", t.fillet(o(z(s), l), i)))),
    chamfer: (s, i, l = "all") => (O("Chamfer distance", i), v("chamfer", () => n("chamfer", t.chamfer(o(z(s), l), i)))),
    shell: (s, i, l) => {
      O("Shell thickness", i);
      const f = l === void 0 ? [] : a(l) ? [l] : [...l];
      return v("shell", () => {
        const h = z(s), c = f.map((u) => r(h, u));
        return n("shell", t.shell(h, -i, c.length ? c : null));
      });
    }
  };
}
function wt({ sm: e }) {
  return {
    volume: (t) => v("volume", () => z(t).volume),
    area: (t) => v("area", () => z(t).area),
    bbox: (t) => v("bbox", () => {
      const n = z(t).bbox();
      return { min: [n.min.x, n.min.y, n.min.z], max: [n.max.x, n.max.y, n.max.z] };
    }),
    massProperties: (t) => v("massProperties", () => {
      const n = z(t).massProperties(1), r = n.inertia, o = (l, f) => (r[l][f] + r[f][l]) / 2, a = [[r[0][0], o(0, 1), o(0, 2)], [o(0, 1), r[1][1], o(1, 2)], [o(0, 2), o(1, 2), r[2][2]]], { values: s, vectors: i } = at(a);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: a, principalMoments: s, principalAxes: i };
    }),
    isValid: (t) => v("isValid", () => z(t).isValid()),
    solidCount: (t) => v("solids", () => e.scope(() => z(t).solids().length)),
    components: (t) => v("solids", () => [...z(t).solids()].map(K))
  };
}
function vt({ sm: e, solid: t }) {
  return {
    tessellate: (n, r = {}) => {
      const { tolerance: o, angle: a } = $e(r);
      return v("mesh", () => e.scope(() => {
        const s = z(n).mesh(o, a), i = Float64Array.from(s.vertices), l = Uint32Array.from(s.triangles);
        return { positions: i, normals: it(i, l), indices: l };
      }));
    },
    exportStl: (n, r = {}) => {
      const { tolerance: o, angle: a } = $e(r);
      return v("toStl", () => e.toStl(z(n), { tolerance: o, angle: a }));
    },
    exportStep: (n) => v("toStep", () => e.toStep(z(n))),
    importStep: (n) => ((typeof n != "string" || !n.length) && P("STEP input must be non-empty text."), v("fromStep", () => {
      const r = e.fromStep(n);
      if (Array.isArray(r) && r.length && r.every((o) => o instanceof e.Part)) {
        const o = r;
        return t("fromStep", o.length === 1 ? o[0] : e.fuse(o[0], ...o.slice(1)));
      }
      return t("fromStep", r);
    }))
  };
}
async function Mt(e = {}) {
  const t = await pt(e);
  t.setWarningHandler(() => {
  });
  const n = lt(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: ht,
    profile: ut(t),
    ...mt(n),
    ...xt(n),
    ...gt(n),
    ...yt(n),
    ...wt(n),
    ...vt(n),
    memory: () => {
      const r = t.memoryUsage();
      return { used: r.used, heap: r.heap, handles: r.handles };
    },
    scope: (r) => t.scope(r)
  };
}
var Se = 64, de = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], H = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], he = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function Le(e) {
  const t = [], n = Math.max(1, ...e.flatMap((f) => f.map(Math.abs))), r = 1e-9 * n;
  for (const f of e) t.some((h) => Math.hypot(...de(f, h)) <= r) || t.push(f);
  if (t.length > Se) throw new S("unsupported", `Hull of ${t.length} distinct vertices exceeds the exact hull budget (${Se}).`);
  if (t.length < 4) throw new S("invalid-input", "A hull needs at least four non-coplanar points.");
  const o = [], a = t.length;
  for (let f = 0; f < a; f++) for (let h = f + 1; h < a; h++) for (let c = h + 1; c < a; c++) {
    const u = he(de(t[h], t[f]), de(t[c], t[f])), p = Math.hypot(...u);
    if (p <= r * n) continue;
    let x = [u[0] / p, u[1] / p, u[2] / p], A = H(x, t[f]), g = 0, $ = 0;
    for (const y of t) {
      const _ = H(x, y) - A;
      _ > r ? g++ : _ < -r && $++;
    }
    g && $ || !g && !$ || (g && (x = [-x[0], -x[1], -x[2]], A = -A), !o.some((y) => H(y.n, x) > 1 - 1e-12 && Math.abs(y.d - A) <= r) && o.push({ n: x, d: A, members: t.map((y, _) => Math.abs(H(x, y) - A) <= r ? _ : -1).filter((y) => y >= 0) }));
  }
  if (o.length < 4) throw new S("invalid-input", "The hull is flat (all points coplanar).");
  const s = o.map(({ n: f, members: h }) => {
    const c = Math.abs(f[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = he(f, c), p = Math.hypot(...u), x = [u[0] / p, u[1] / p, u[2] / p], A = he(f, x), g = h.map((m) => ({ idx: m, x: H(t[m], x), y: H(t[m], A) })).sort((m, b) => m.x - b.x || m.y - b.y), $ = (m, b, T) => (b.x - m.x) * (T.y - m.y) - (b.y - m.y) * (T.x - m.x), y = (m) => {
      const b = [];
      for (const T of m) {
        for (; b.length >= 2 && $(b[b.length - 2], b[b.length - 1], T) <= r * n; ) b.pop();
        b.push(T);
      }
      return b;
    }, _ = y(g), E = y([...g].reverse());
    return [..._.slice(0, -1), ...E.slice(0, -1)].map((m) => m.idx);
  }), i = [...new Set(s.flat())].sort((f, h) => f - h), l = new Map(i.map((f, h) => [f, h]));
  return { points: i.map((f) => t[f]), faces: s.map((f) => f.map((h) => l.get(h))) };
}
function bt(e, t) {
  const n = Math.max(1, ...e.flatMap((o) => o.map(Math.abs))), r = 1e-9 * n;
  for (const o of t) {
    const a = [0, 0, 0];
    for (let f = 0; f < o.length; f++) {
      const h = e[o[f]], c = e[o[(f + 1) % o.length]];
      a[0] += (h[1] - c[1]) * (h[2] + c[2]), a[1] += (h[2] - c[2]) * (h[0] + c[0]), a[2] += (h[0] - c[0]) * (h[1] + c[1]);
    }
    const s = Math.hypot(...a);
    if (!(s > 0)) return !1;
    const i = [a[0] / s, a[1] / s, a[2] / s], l = H(i, e[o[0]]);
    if (o.some((f) => Math.abs(H(i, e[f]) - l) > r) || e.some((f) => H(i, f) - l > r)) return !1;
  }
  return !0;
}
const At = "@crispcad/exact-kernel", $t = "0.1.4", St = "smlib", Et = Object.freeze({ id: St, package: At, version: $t }), Ee = 16, Te = 2048, I = (e) => {
  throw new S("unsupported", e);
}, U = (e) => {
  throw new S("invalid-input", e);
};
function q(e, t) {
  t < Ee && I(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${Ee}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const Tt = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], xe = (e, t) => {
  const n = [];
  for (let r = 0; r < 3; r++)
    for (let o = 0; o < 4; o++)
      n.push(e[r * 4] * t[o] + e[r * 4 + 1] * t[4 + o] + e[r * 4 + 2] * t[8 + o] + (o === 3 ? e[r * 4 + 3] : 0));
  return n;
}, G = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), Ce = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], Ct = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function se(e, t) {
  const n = Math.hypot(...e);
  n > 0 || U("Rotation axis must be non-zero.");
  const [r, o, a] = e.map((h) => h / n), s = t * Math.PI / 180, i = Math.cos(s), l = Math.sin(s), f = 1 - i;
  return [f * r * r + i, f * r * o - l * a, f * r * a + l * o, 0, f * r * o + l * a, f * o * o + i, f * o * a - l * r, 0, f * r * a - l * o, f * o * a + l * r, f * a * a + i, 0];
}
const zt = (e) => xe(se([0, 0, 1], e[2]), xe(se([0, 1, 0], e[1]), se([1, 0, 0], e[0])));
function Pt(e) {
  const t = Math.hypot(...e);
  t > 0 || U("Mirror normal must be non-zero.");
  const [n, r, o] = e.map((a) => a / t);
  return [1 - 2 * n * n, -2 * n * r, -2 * n * o, 0, -2 * n * r, 1 - 2 * r * r, -2 * r * o, 0, -2 * n * o, -2 * r * o, 1 - 2 * o * o, 0];
}
function _t(e) {
  const [t, n, r, , o, a, s, , i, l, f] = e, h = Math.max(-1, Math.min(1, (t + a + f - 1) / 2)), c = Math.acos(h);
  if (c < 1e-15)
    return null;
  let u = [l - s, r - i, o - n];
  return Math.hypot(...u) < 1e-9 && (u = [[t + 1, o, i], [n, a + 1, l], [r, s, f + 1]].reduce((x, A) => Math.hypot(...A) > Math.hypot(...x) ? A : x)), { axis: u, degrees: c * 180 / Math.PI };
}
function Rt(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && U("Affine matrix is singular.");
  for (const [s, i] of [[0, 1], [0, 2], [1, 2]]) {
    const l = t[s][0] * t[i][0] + t[s][1] * t[i][1] + t[s][2] * t[i][2];
    Math.abs(l) > 1e-9 * n[s] * n[i] && I("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const r = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), o = [n[0], n[1], r < 0 ? -n[2] : n[2]], a = [0, 1, 2].flatMap((s) => [e[s * 4] / o[0], e[s * 4 + 1] / o[1], e[s * 4 + 2] / o[2], 0]);
  return { scale: o, rotation: a, translate: [e[3], e[7], e[11]] };
}
function Oe(e, t, n, r) {
  const o = e.map((s, i) => {
    if (!s)
      return 0;
    const l = r[i] - n[i];
    return l < 1e-12 && U("Cannot resize a degenerate shape."), s / l;
  }), a = Math.max(...o) || 1;
  return o.map((s, i) => e[i] ? s : t?.[i] ? a : 1);
}
function F(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return q("circle2d", t.segments), e.profile.circle(t.radius);
    case "rectangle":
      return e.profile.rectangle(t.size[0], t.size[1], t.center);
    case "move": {
      const n = F(e, t.profile);
      return n && e.profile.translate(n, t.vector);
    }
    case "rotate": {
      const n = F(e, t.profile);
      return n && e.profile.rotate(n, t.angle);
    }
    case "scale": {
      const n = F(e, t.profile);
      return n && e.profile.scale(n, t.vector);
    }
    case "affine": {
      const n = F(e, t.profile);
      if (!n)
        return null;
      const [r, o, a, s, i, l] = t.matrix, f = Math.hypot(r, s), h = Math.hypot(o, i);
      f > 1e-12 && h > 1e-12 || U("2D affine matrix is singular."), Math.abs(r * o + s * i) > 1e-9 * f * h && I("2D affine transforms with shear have no exact lowering here.");
      const c = r * i - o * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [f, c < 0 ? -h : h]), Math.atan2(s, r) * 180 / Math.PI), [a, l]);
    }
    case "resize": {
      const n = F(e, t.profile);
      if (!n)
        return null;
      const r = e.profile.bounds(n), o = Oe(t.size, t.auto, r.min, r.max);
      return e.profile.scale(n, [o[0], o[1]]);
    }
    case "offset": {
      t.round && q("offset2d", t.segments);
      const n = F(e, t.profile);
      return n && e.profile.offset(n, t.distance, t.round);
    }
    case "text":
      return I("text2d needs a font outline path, and the exact kernel package ships no font.");
    case "minkowski":
      return I("minkowski2d has no exact lowering (planar Minkowski sums of curved profiles are not exposed by this kernel adapter).");
    case "union":
    case "subtract":
    case "intersect":
    case "hull": {
      const n = t.profiles.map((a) => F(e, a)), r = n.filter((a) => a !== null);
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
      return I(`Profile '${t.kind}' has no exact lowering.`);
  }
}
function Q(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, r = e.center ? -t / 2 : 0, o = e.center ? -n / 2 : 0;
      return [[r, o], [r + t, o], [r + t, o + n], [r, o + n]];
    }
    case "move":
      return Q(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return Q(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), r = Math.sin(t);
      return Q(e.profile).map(([o, a]) => [n * o - r * a, r * o + n * a]);
    }
    case "affine": {
      const t = e.matrix;
      return Q(e.profile).map(([n, r]) => [t[0] * n + t[1] * r + t[2], t[3] * n + t[4] * r + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(Q);
    case "empty":
      return [];
    default:
      return I(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function ge(e, t, n) {
  const r = (o, a) => ge(a, xe(t, o), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const o of e.shapes)
        ge(o, t, n);
      return;
    case "move":
      return r(Ce(e.vector), e.shape);
    case "rotate":
      return r(zt(e.vector), e.shape);
    case "scale":
      return r(Ct(e.vector), e.shape);
    case "mirror":
      return r(Pt(e.vector), e.shape);
    case "axisRotate":
      return r(se(e.vector, e.angle), e.shape);
    case "affine":
      return r(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let o = 0; o < e.count; o++)
        r(Ce(e.step.map((a) => a * o)), e.shape);
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
      e.twist !== 0 && I("hull of a twisted extrusion has no exact lowering.");
      for (const [o, a] of Q(e.profile))
        n.points.push(G(t, [o, a, 0])), n.points.push(G(t, [o * e.scaleTop[0], a * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      q("sphere", e.segments);
      const o = [0, 1, 2].map((a) => Math.hypot(t[a], t[4 + a], t[8 + a]));
      Math.max(...o) - Math.min(...o) > 1e-12 * Math.max(...o) && I("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: G(t, [0, 0, 0]), radius: e.radius * o[0] });
      return;
    }
    default:
      I(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function Dt(e, t) {
  const n = { points: [], spheres: [] };
  for (const u of t)
    ge(u, Tt, n);
  if (n.points.length && n.spheres.length && I("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const u = Le(n.points);
    return e.polyhedron(u.points, u.faces);
  }
  if (!n.spheres.length)
    return null;
  const r = n.spheres[0].radius;
  n.spheres.some((u) => Math.abs(u.radius - r) > 1e-12 * r) && I("hull of spheres with different radii has no exact lowering.");
  const o = n.spheres.map((u) => u.centre), a = [0, 1, 2].map((u) => Math.min(...o.map((p) => p[u]))), s = [0, 1, 2].map((u) => Math.max(...o.map((p) => p[u]))), i = s.map((u, p) => u - a[p]), l = 1e-9 * Math.max(1, ...i);
  if (i.every((u) => u <= l))
    return e.translate(e.sphere(r), a);
  const f = (u) => [u & 1 ? s[0] : a[0], u & 2 ? s[1] : a[1], u & 4 ? s[2] : a[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((u) => o.some((p) => p.every((x, A) => Math.abs(x - f(u)[A]) <= l))) || i.some((u) => u <= l)) && I("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const c = e.box(i.map((u) => u + 2 * r));
  return e.translate(e.fillet(c, r, "all"), a.map((u, p) => u + i[p] / 2));
}
function Xe(e, t, n) {
  const r = e.profile.bounds(t), o = r.max[0] <= 0;
  r.min[0] < -1e-8 && !o && U("Revolved profiles must stay on one side of the radial axis.");
  const a = Math.abs(n);
  a > 360 && U("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(o ? e.profile.scale(t, [-1, 1]) : t, n);
  return o && a !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function It(e, t, n) {
  const { scale: r, rotation: o, translate: a } = Rt(n);
  let s = r.every((l) => Math.abs(l - 1) < 1e-15) ? t : e.scale(t, r);
  const i = _t(o);
  return i && (s = e.rotate(s, i.axis, i.degrees)), a.some((l) => l !== 0) ? e.translate(s, a) : s;
}
function we(e, t) {
  const n = (r) => we(e, r);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return q("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return q("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return q("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && I("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && I("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const r = F(e, t.profile);
      return r && e.extrude(r, t.height);
    }
    case "revolve": {
      if (q("revolve", t.segments), t.angle === 0)
        return null;
      const r = F(e, t.profile);
      return r && Xe(e, r, t.angle);
    }
    case "polyhedron": {
      if (t.smooth)
        return Ot(e, t.smooth);
      if (t.ruled)
        return Lt(e, t.ruled, t.points, t.faces);
      if (t.faces.length > Te && I(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${Te} faces).`), bt(t.points, t.faces)) {
        const r = Le(t.points);
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
      return Dt(e, t.shapes);
    case "minkowski":
      return I("minkowski has no exact lowering (a general Minkowski sum is not a B-rep operation of this adapter; use fillet/offset intent instead).");
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
      return r && It(e, r, t.matrix.slice(0, 12));
    }
    case "resize": {
      const r = n(t.shape);
      if (!r)
        return null;
      const o = e.bbox(r);
      return e.scale(r, Oe(t.vector, t.auto, o.min, o.max));
    }
    case "repeat": {
      const r = t.count >= 1 ? n(t.shape) : null;
      if (!r)
        return null;
      const o = Array.from({ length: t.count }, (a, s) => s === 0 ? r : e.translate(r, t.step.map((i) => i * s)));
      return o.length > 1 ? e.union(o[0], ...o.slice(1)) : o[0];
    }
    default:
      return I(`CAD Script '${t.kind}' has no exact lowering.`);
  }
}
function Nt(e, t) {
  let n = 0;
  for (const r of t)
    for (let o = 1; o + 1 < r.length; o++) {
      const a = e[r[0]], s = e[r[o]], i = e[r[o + 1]];
      n += a[0] * (s[1] * i[2] - s[2] * i[1]) - a[1] * (s[0] * i[2] - s[2] * i[0]) + a[2] * (s[0] * i[1] - s[1] * i[0]);
    }
  return n / 6;
}
function Lt(e, t, n, r) {
  const o = e.loft(t.map((i) => ({ profile: e.profile.polygon([i.map((l) => [l[0], l[1]])]), at: [0, 0, i[0][2]] })), { ruled: !0 }), a = Nt(n, r), s = e.volume(o);
  if (!(Math.abs(s - a) <= 1e-7 * Math.abs(a)))
    throw o.dispose(), new S("kernel-failure", `The ruled loft's volume ${s} differs from its faceted volume ${a}; the kernel did not keep the vertex correspondence.`);
  return o;
}
function Ot(e, t) {
  const n = e.loft(t.map((a) => ({ profile: e.profile.polygon([a.map((s) => [s[0], s[1]])]), at: [0, 0, a[0][2]] })), { ruled: !1 }), r = qe(Ue(t)), o = e.volume(n);
  if (!(Math.abs(o - r) <= 1e-7 * Math.abs(r)))
    throw n.dispose(), new S("kernel-failure", `The smooth loft's volume ${o} differs from the volume ${r} of the surface CAD Script defines; the kernel built another surface.`);
  return n;
}
function on(e, t) {
  let n;
  try {
    n = Ne(t).shape;
  } catch (o) {
    throw o instanceof Ve ? new S("invalid-input", `CAD Script: ${o.message}`, { cause: o }) : o;
  }
  const r = e.scope(() => we(e, n));
  if (!r)
    throw new S("invalid-input", "The program produces no solid.");
  if (!(e.volume(r) > 0))
    throw r.dispose(), new S("kernel-failure", "The exact result has no positive volume.");
  return r;
}
const sn = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} });
class ze extends S {
  constructor(n, r) {
    super(n.code, n.message, r);
    Z(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const ee = (e) => {
  throw new S("unsupported", e);
};
function Pe(e, t, n) {
  if (!n?.some((o) => o !== 0))
    return Me([...t]), e.profile.polygon([t]);
  Me([...t], [...n]);
  const r = t.map((o, a) => {
    const s = t[(a + 1) % t.length], i = n[a] ?? 0;
    return i ? { kind: "arc", via: et(o, s, i), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], r);
}
const _e = (e, t, n) => {
  const r = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(r, [t[0], t[1]]) : r;
};
function Re(e, t, n) {
  const r = t.profile;
  switch (r.kind) {
    case "rectangle":
      return e.profile.rectangle(j(r.width, n), j(r.depth, n), !0);
    case "circle":
      return _e(e, r.center ?? [0, 0], j(r.radius, n));
    case "outline":
      return Pe(e, r.points, r.bulges);
    case "region": {
      Ze(r.loops, (s) => j(s, n));
      const o = (s) => s.kind === "circle" ? _e(e, [j(s.center[0], n), j(s.center[1], n)], j(s.radius, n)) : Pe(e, s.points, s.bulges), a = r.loops.map(o).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, i) => i.area - s.area);
      return e.profile.subtract(a[0].profile, ...a.slice(1).map((s) => s.profile));
    }
    case "path":
      return ee("Close the sketch path before creating a solid.");
    default:
      return ee(`Sketch profile '${r.kind}' has no exact lowering.`);
  }
}
function k(e, t, n) {
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
        const c = we(e, Ne(s.program).shape);
        if (!c)
          throw new S("invalid-input", "Code produces no printable solid.");
        i = c;
        break;
      }
      case "extrusion": {
        const { distance: c, start: u, plane: p } = ke(s, t);
        i = e.extrude(Re(e, t.sketches[s.sketchId], t), c), u && (i = e.translate(i, [0, 0, u])), p === "XZ" ? i = k(e, i, [90, 0, 0]) : p === "YZ" && (i = k(e, i, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: c, angle: u, axisOffset: p } = Je(s, t);
        let x = Re(e, t.sketches[s.sketchId], t);
        p && (x = e.profile.translate(x, [-p, 0])), i = Xe(e, x, u), c === "XY" ? i = k(e, i, [-90, 0, 0]) : c === "YZ" && (i = k(e, i, [0, 0, 90])), p && (i = e.translate(i, c === "YZ" ? [0, p, 0] : [p, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: c, offset: u } = We(s, t), p = [0, 0, 0];
        if (p[c] = 1, i = e.mirror(W(e, t, s.source, r, o), p), u) {
          const x = [0, 0, 0];
          x[c] = 2 * u, i = e.translate(i, x);
        }
        break;
      }
      case "pattern": {
        const c = Qe(s, t), u = W(e, t, s.source, r, o), p = [u];
        if (c.mode === "linear")
          for (let x = 1; x < c.count; x++) {
            const A = [0, 0, 0];
            A[c.axis] = x * c.spacing, p.push(e.translate(u, A));
          }
        else {
          const x = c.sweep / (Math.abs(c.sweep) === 360 ? c.count : c.count - 1), A = [0, 0, 0];
          A[c.axis] = 1;
          for (let g = 1; g < c.count; g++)
            p.push(e.rotate(u, A, g * x, c.center));
        }
        i = e.union(p[0], ...p.slice(1));
        break;
      }
      case "boolean": {
        const c = s.inputs.map((u) => W(e, t, u, r, o));
        if (s.useHoleRoles) {
          const u = c.filter((A, g) => t.nodes[s.inputs[g]].role !== "hole"), p = c.filter((A, g) => t.nodes[s.inputs[g]].role === "hole");
          u.length || ee("A combination of holes only has no solid to export.");
          const x = u.length > 1 ? e.union(u[0], ...u.slice(1)) : u[0];
          i = p.length ? e.subtract(x, ...p) : x;
        } else
          i = s.operation === "union" ? e.union(c[0], ...c.slice(1)) : s.operation === "subtract" ? e.subtract(c[0], ...c.slice(1)) : e.intersect(c[0], ...c.slice(1));
        break;
      }
      case "exact-feature": {
        const c = Ge(s, t), u = W(e, t, s.source, r, o);
        i = c.operation === "fillet" ? e.fillet(u, c.size, c.edges) : c.operation === "chamfer" ? e.chamfer(u, c.size, c.edges) : e.shell(u, c.size, c.openFaces);
        break;
      }
      case "mesh":
        return ee(s.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return ee(`'${s.kind}' has no exact lowering.`);
    }
    const { scale: l, rotation: f, position: h } = s.transform;
    l.some((c) => c !== 1) && (i = e.scale(i, l)), i = k(e, i, f), h.some((c) => c !== 0) && (i = e.translate(i, h));
  } catch (l) {
    if (l instanceof ze)
      throw l;
    const f = l instanceof S ? l.code : "invalid-input", h = l instanceof Error ? l.message : String(l);
    throw new ze({ code: f, bodyId: r, nodeId: n, feature: s.kind, message: `${s.name} (${s.kind}): ${h}` }, { cause: l });
  }
  return o.set(n, i), i;
}
function Xt(e, t, n) {
  if (!t.roots.includes(n))
    throw new S("invalid-input", `${n} is not a top-level body.`);
  return W(e, t, n, n, /* @__PURE__ */ new Map());
}
function Bt(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (!o)
    throw new S("invalid-input", `${n} is not a node of this model.`);
  const a = r.local ? { ...t, nodes: { ...t.nodes, [n]: { ...o, transform: tt() } } } : t, s = t.roots.find((i) => i === n) ?? n;
  return W(e, a, n, s, /* @__PURE__ */ new Map());
}
const Ft = 8, B = (e, t, n) => (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x), te = (e, t) => e.x === t.x && e.y === t.y;
function Ht(e, t) {
  let n = 0;
  for (let r = 0, o = t.length - 1; r < t.length; o = r++)
    n += e[2 * t[o]] * e[2 * t[r] + 1] - e[2 * t[r]] * e[2 * t[o] + 1];
  return n / 2;
}
function De(e, t, n) {
  let r, o;
  for (const a of t) {
    const s = { i: a, x: e[2 * a], y: e[2 * a + 1], removed: !1 };
    r ? (o.next = s, s.prev = o) : r = s, o = s, n.push(s);
  }
  return o.next = r, r.prev = o, r;
}
function pe(e, t) {
  const n = e.prev, r = e.next;
  return B(n, e, r) >= 0 ? B(e, r, t) > 0 && B(e, t, n) > 0 : !(B(e, n, t) > 0 && B(e, t, r) > 0);
}
function Be(e, t, n, r, o) {
  const a = B(e, t, r), s = B(t, n, r), i = B(n, e, r);
  return o ? a > 0 && s > 0 && i > 0 : a >= 0 && s >= 0 && i >= 0;
}
function Yt(e, t, n) {
  const r = { ...e }, o = { ...t }, a = e.next, s = t.prev;
  e.next = t, t.prev = e, r.next = a, a.prev = r, o.next = r, r.prev = o, s.next = o, o.prev = s, n.push(r, o);
}
function jt(e, t) {
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
    const [f, h, c] = B(e, a, n) > 0 ? [e, a, n] : [e, n, a];
    o = t;
    do {
      if (o !== n && !te(o, n) && Be(f, h, c, o, !1) && !(o.x === e.x && o.y === e.y)) {
        const u = Math.hypot(o.x - e.x, o.y - e.y), p = (o.x - e.x) / u;
        (p > i || p === i && u < l) && pe(o, e) && (s = o, i = p, l = u);
      }
      o = o.next;
    } while (o !== t);
  }
  if (!pe(s, e)) {
    o = t;
    do {
      if (te(o, s) && pe(o, e))
        return o;
      o = o.next;
    } while (o !== t);
    return;
  }
  return s;
}
function Kt(e, t) {
  if (!t.length || t.some((d) => d.length < 3))
    return null;
  const n = [], r = t.map((d) => Ht(e, d));
  if (!(Math.abs(r[0]) > 0))
    return null;
  const o = t.map((d, w) => w === 0 == r[w] > 0 ? d : [...d].reverse()), a = De(e, o[0], n), s = o.slice(1).map((d) => {
    const w = De(e, d, n);
    let M = w, C = w.next;
    for (; C !== w; )
      (C.x > M.x || C.x === M.x && C.y > M.y) && (M = C), C = C.next;
    return M;
  });
  s.sort((d, w) => w.x - d.x || w.y - d.y);
  for (const d of s) {
    const w = jt(d, a);
    if (!w)
      return null;
    Yt(w, d, n);
  }
  let i = 1 / 0, l = 1 / 0, f = -1 / 0, h = -1 / 0;
  for (const d of n)
    d.x < i && (i = d.x), d.y < l && (l = d.y), d.x > f && (f = d.x), d.y > h && (h = d.y);
  const c = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(n.length / 2)))), u = (f - i) / c || 1, p = (h - l) / c || 1, x = (d, w, M) => Math.min(c - 1, Math.max(0, Math.floor((d - w) / M))), A = Array.from({ length: c * c }, () => []);
  for (const d of n)
    A[x(d.y, l, p) * c + x(d.x, i, u)].push(d);
  const g = (d, w) => {
    const M = d.prev, C = d.next, ne = B(M, d, C);
    if (w ? ne < 0 : ne <= 0)
      return !1;
    const le = x(Math.min(M.x, d.x, C.x), i, u), ce = x(Math.max(M.x, d.x, C.x), i, u), He = x(Math.min(M.y, d.y, C.y), l, p), Ye = x(Math.max(M.y, d.y, C.y), l, p);
    for (let ue = He; ue <= Ye; ue++)
      for (let fe = le; fe <= ce; fe++)
        for (const Y of A[ue * c + fe])
          if (!(Y.removed || Y === M || Y === d || Y === C || te(Y, M) || te(Y, d) || te(Y, C)) && Be(M, d, C, Y, !1))
            return !1;
    return !0;
  }, $ = [];
  let y = a, _ = y, E = !1, m = 0;
  {
    let d = a;
    do
      m++, d = d.next;
    while (d !== a);
  }
  for (; m > 3; ) {
    if (g(y, E)) {
      $.push(y.prev.i, y.i, y.next.i), y.removed = !0, y.prev.next = y.next, y.next.prev = y.prev, m--, y = y.next, _ = y, E = !1;
      continue;
    }
    if (y = y.next, y === _) {
      if (E)
        return null;
      E = !0;
    }
  }
  if (B(y.prev, y, y.next) < 0)
    return null;
  $.push(y.prev.i, y.i, y.next.i);
  const b = r.reduce((d, w, M) => d + (M === 0 ? Math.abs(w) : -Math.abs(w)), 0);
  let T = 0;
  for (let d = 0; d < $.length; d += 3) {
    const w = $[d], M = $[d + 1], C = $[d + 2];
    T += ((e[2 * M] - e[2 * w]) * (e[2 * C + 1] - e[2 * w + 1]) - (e[2 * M + 1] - e[2 * w + 1]) * (e[2 * C] - e[2 * w])) / 2;
  }
  return Math.abs(T - b) <= 1e-9 * Math.abs(r[0]) + 1e-12 ? $ : null;
}
const Fe = (e) => {
  const t = e.part;
  return t && typeof t.faces == "function" ? t : void 0;
}, ie = class ie {
  constructor() {
    Z(this, "positions", []);
    Z(this, "cells", /* @__PURE__ */ new Map());
  }
  add(t, n, r) {
    const o = ie.Q, a = Math.round(t / o), s = Math.round(n / o), i = Math.round(r / o);
    let l = this.cells.get(`${a},${s},${i}`);
    if (l !== void 0)
      return l;
    const f = t / o - a, h = n / o - s, c = r / o - i, u = Math.abs(f) > 0.4 ? Math.sign(f) : 0, p = Math.abs(h) > 0.4 ? Math.sign(h) : 0, x = Math.abs(c) > 0.4 ? Math.sign(c) : 0;
    if (u || p || x) {
      for (const A of u ? [0, u] : [0])
        for (const g of p ? [0, p] : [0])
          for (const $ of x ? [0, x] : [0])
            if (l = this.cells.get(`${a + A},${s + g},${i + $}`), l !== void 0)
              return this.cells.set(`${a},${s},${i}`, l), l;
    }
    return l = this.positions.length / 3, this.positions.push(t, n, r), this.cells.set(`${a},${s},${i}`, l), l;
  }
};
Z(ie, "Q", 1e-6);
let ye = ie;
function Vt(e) {
  const t = Fe(e);
  if (!t)
    return !1;
  for (const n of t.faces())
    if (n.geomType === "plane" && n.wires().length >= Ft)
      return !0;
  return !1;
}
function qt(e, t, n) {
  const r = Fe(t);
  if (!r)
    return;
  const o = [...r.faces()], a = new ye(), s = [], i = /* @__PURE__ */ new Map(), l = (u) => {
    const p = new Uint32Array(u.vertices.length / 3);
    for (let g = 0; g < p.length; g++)
      p[g] = a.add(u.vertices[3 * g], u.vertices[3 * g + 1], u.vertices[3 * g + 2]);
    const x = /* @__PURE__ */ new Set(), A = [];
    for (let g = 0; g < u.triangles.length; g += 3) {
      const $ = p[u.triangles[g]], y = p[u.triangles[g + 1]], _ = p[u.triangles[g + 2]];
      $ === y || y === _ || _ === $ || (s.push($, y, _), x.add(`${$},${y}`), x.add(`${y},${_}`), x.add(`${_},${$}`));
    }
    for (const g of x) {
      const [$, y] = g.split(",").map(Number);
      x.has(`${y},${$}`) || A.push([$, y]);
    }
    return A;
  }, f = [];
  let h = 0;
  for (const u of o) {
    if (u.geomType === "plane") {
      f.push(u);
      continue;
    }
    const p = n.bands !== !1 ? Ut(u, n) : void 0;
    p && h++, i.set(u._identity(), l(p ?? u.mesh(n.tolerance, n.angleDeg)));
  }
  let c = 0;
  for (const u of f) {
    const p = Zt(u, a, i), x = u.normalAt(), A = [x.x, x.y, x.z], g = Math.abs(A[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], $ = ve(J(g, A)), y = J(A, $);
    let _ = null;
    if (p && p.length === u.wires().length) {
      const E = [...new Set(p.flat())], m = new Map(E.map((d, w) => [d, w])), b = new Float64Array(2 * E.length);
      E.forEach((d, w) => {
        const M = a.positions;
        b[2 * w] = M[3 * d] * $[0] + M[3 * d + 1] * $[1] + M[3 * d + 2] * $[2], b[2 * w + 1] = M[3 * d] * y[0] + M[3 * d + 1] * y[1] + M[3 * d + 2] * y[2];
      });
      const T = Kt(b, p.map((d) => d.map((w) => m.get(w))));
      T && (_ = T.map((d) => E[d]));
    }
    _ ? s.push(..._) : (c++, l(u.mesh(n.tolerance, n.angleDeg)));
  }
  return { positions: a.positions, indices: s, planar: f.length - c, planarFallbacks: c, bands: h };
}
function Ut(e, t) {
  if (e.geomType !== "cylinder")
    return;
  const n = [...e.edges()];
  if (n.length !== 2)
    return;
  for (const E of n)
    if (E.geomType !== "circle" || !E.isClosed || ![...E.faces()].every((m) => m.geomType === "plane" || m._identity() === e._identity()))
      return;
  const r = n[0].radius, o = n[0].arcCenter, a = n[1].arcCenter;
  if (!(r > 0) || Math.abs(n[1].radius - r) > 1e-9 * Math.max(1, r) || Math.abs(e.radius - r) > 1e-7 * Math.max(1, r))
    return;
  const s = [a.x - o.x, a.y - o.y, a.z - o.z], i = Math.hypot(s[0], s[1], s[2]);
  if (!(i > 0))
    return;
  const l = s.map((E) => E / i);
  for (const E of n) {
    const m = E.normal;
    if (Math.abs(m.x * l[0] + m.y * l[1] + m.z * l[2]) < 1 - 1e-9)
      return;
  }
  const f = Math.acos(Math.max(-1, 1 - t.tolerance / r)), h = Math.max(8, Math.ceil(360 / t.angleDeg), Math.ceil(Math.PI / Math.max(f, 1e-9)));
  if (h > 4096)
    return;
  const c = Math.abs(l[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = ve(J(c, l)), p = J(l, u), x = new Float64Array(6 * h), A = new Uint32Array(6 * h);
  for (let E = 0; E < h; E++) {
    const m = 2 * Math.PI * E / h, b = Math.cos(m), T = Math.sin(m);
    for (let d = 0; d < 3; d++) {
      const w = r * (b * u[d] + T * p[d]);
      x[3 * E + d] = [o.x, o.y, o.z][d] + w, x[3 * (h + E) + d] = [a.x, a.y, a.z][d] + w;
    }
  }
  const g = [x[0], x[1], x[2]], $ = e.normalAt(g), y = [g[0] - o.x, g[1] - o.y, g[2] - o.z], _ = $.x * y[0] + $.y * y[1] + $.z * y[2] > 0;
  for (let E = 0; E < h; E++) {
    const m = E, b = (E + 1) % h, T = h + m, d = h + b;
    _ ? A.set([m, b, d, m, d, T], 6 * E) : A.set([m, d, b, m, T, d], 6 * E);
  }
  return { vertices: x, triangles: A };
}
const J = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]], ve = (e) => {
  const t = Math.hypot(e[0], e[1], e[2]);
  return e.map((n) => n / t);
};
function Zt(e, t, n) {
  const r = e._identity(), o = e.normalAt(), a = /* @__PURE__ */ new Set(), s = t.positions;
  let i;
  const l = /* @__PURE__ */ new Set();
  for (const m of e.edges()) {
    const b = [...m.faces()].filter((d) => d._identity() !== r);
    if (b.length !== 1)
      return;
    const T = b[0];
    if (T.geomType === "plane") {
      if (!(m._isStraight ? m._isStraight() : m.geomType === "line"))
        return;
      const d = m.start, w = m.end, M = t.add(d.x, d.y, d.z), C = t.add(w.x, w.y, w.z);
      i ?? (i = o.x * d.x + o.y * d.y + o.z * d.z), M !== C && a.add(M < C ? `${M},${C}` : `${C},${M}`);
    } else if (l.add(T._identity()), i === void 0) {
      const d = m.start;
      i = o.x * d.x + o.y * d.y + o.z * d.z;
    }
  }
  if (i === void 0)
    return;
  const f = 2e-5 + 1e-9 * Math.abs(i), h = (m) => Math.abs(o.x * s[3 * m] + o.y * s[3 * m + 1] + o.z * s[3 * m + 2] - i) <= f;
  for (const m of l) {
    const b = n.get(m);
    if (!b)
      return;
    for (const [T, d] of b)
      h(T) && h(d) && a.add(T < d ? `${T},${d}` : `${d},${T}`);
  }
  const c = /* @__PURE__ */ new Map();
  for (const m of a) {
    const [b, T] = m.split(",").map(Number);
    for (const [d, w] of [[b, T], [T, b]]) {
      const M = c.get(d);
      M ? M.push(w) : c.set(d, [w]);
    }
  }
  for (const m of c.values())
    if (m.length !== 2)
      return;
  const u = [], p = /* @__PURE__ */ new Set();
  for (const m of c.keys()) {
    if (p.has(m))
      continue;
    const b = [m];
    p.add(m);
    let T = m, d = c.get(m)[0];
    for (; d !== m; ) {
      if (p.has(d))
        return;
      b.push(d), p.add(d);
      const [w, M] = c.get(d), C = w === T ? M : w;
      T = d, d = C;
    }
    if (b.length < 3)
      return;
    u.push(b);
  }
  const x = Math.abs(o.x) < 0.9 ? [1, 0, 0] : [0, 1, 0], A = [o.x, o.y, o.z], g = ve(J(x, A)), $ = J(A, g), y = (m) => {
    let b = 0;
    for (let T = 0, d = m.length - 1; T < m.length; d = T++) {
      const w = m[d], M = m[T], C = s[3 * w] * g[0] + s[3 * w + 1] * g[1] + s[3 * w + 2] * g[2], ne = s[3 * w] * $[0] + s[3 * w + 1] * $[1] + s[3 * w + 2] * $[2], le = s[3 * M] * g[0] + s[3 * M + 1] * g[1] + s[3 * M + 2] * g[2], ce = s[3 * M] * $[0] + s[3 * M + 1] * $[1] + s[3 * M + 2] * $[2];
      b += C * ce - le * ne;
    }
    return Math.abs(b);
  }, _ = u.map(y), E = _.indexOf(Math.max(..._));
  return [u[E], ...u.filter((m, b) => b !== E)];
}
const me = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function Ie(e, t) {
  const n = [], r = [], o = /* @__PURE__ */ new Map(), a = new Uint32Array(e.positions.length / 3);
  for (let i = 0; i < a.length; i++) {
    const l = me(e.positions[3 * i]), f = me(e.positions[3 * i + 1]), h = me(e.positions[3 * i + 2]), c = `${l},${f},${h}`;
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
      throw new S("kernel-failure", N`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > nt || r.length > rt)
    throw new S("unsupported", N`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (r.length < 12)
    throw new S("kernel-failure", N`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: r };
}
function Gt(e, t, n) {
  if (Vt(t))
    for (const r of [!0, !1])
      try {
        const o = qt(e, t, { ...be, bands: r });
        if (!o)
          break;
        if (o.bands && o.planarFallbacks)
          continue;
        return Ie(o, n);
      } catch (o) {
        if (o instanceof S && o.code === "unsupported")
          throw o;
      }
  return Ie(e.tessellate(t, be), n);
}
function Qt(e, t, n) {
  const r = t.nodes[n];
  if (r?.kind !== "exact-feature")
    throw new S("invalid-input", N`${n} is not an exact feature`);
  const o = Bt(e, t, n, { local: !0 });
  if (!e.isValid(o))
    throw new S("kernel-failure", N`${r.name}: the exact result is not a valid closed solid.`);
  const a = Gt(e, o, r.name);
  return { display: { sourceKey: ot(t, n), ...a }, volume: e.volume(o) };
}
const ae = 64, Wt = 64 * 1024 * 1024;
function Jt(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const r of n) {
      if (!e.roots.includes(r))
        throw new S("invalid-input", N`Unknown object id: ${r}`);
      const o = e.nodes[r];
      if (o.reference)
        throw new S("invalid-input", N`${o.name} is a reference body and is never exported or measured.`);
      if (o.role === "hole")
        throw new S("invalid-input", N`${o.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((r) => !e.nodes[r].reference && e.nodes[r].role !== "hole");
  if (!n.length)
    throw new S("invalid-input", N("The design has no solid bodies to export"));
  if (n.length > ae)
    throw new S("invalid-input", N`Exact commands are limited to ${ae} bodies.`);
  return n;
}
function kt(e) {
  const t = Object.freeze({ ...Et, smlib: e.version, licence: e.licence }), n = (r, o) => {
    const a = Ae(r), s = Jt(a, o);
    return { doc: a, targets: s, solids: s.map((i) => {
      const l = Xt(e, a, i);
      if (!e.isValid(l))
        throw new S("kernel-failure", N`${a.nodes[i].name}: the exact result is not a valid closed solid.`);
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
      const a = Ae(r), s = o?.length ? [...new Set(o)] : st(a);
      if (s.length > ae)
        throw new S("invalid-input", N`Exact commands are limited to ${ae} bodies.`);
      for (const i of s)
        if (a.nodes[i]?.kind !== "exact-feature")
          throw new S("invalid-input", N`${i} is not an exact feature`);
      return { kernel: t, features: s.map((i) => e.scope(() => ({ id: i, name: a.nodes[i].name, ...Qt(e, a, i) }))) };
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
                  throw new S("unsupported", N`${a.nodes[s[u]].name} and ${a.nodes[s[p]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new S("unsupported", N("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const f = e.exportStep(l), h = new TextEncoder().encode(f).byteLength;
        if (h > Wt)
          throw new S("unsupported", N("The STEP file exceeds 64 MiB."));
        return { kernel: t, bodies: s.map((c) => ({ id: c, name: a.nodes[c].name })), step: f, bytes: h };
      });
    }
  };
}
let re;
function en(e = {}) {
  return re ?? (re = Mt(e).then(kt, (t) => {
    throw re = void 0, t;
  })), re;
}
function tn(e, t, n = 0) {
  const r = performance.now();
  return { ...t.operation === "measure" ? { operation: "measure", ...e.measure(t.document, t.bodies) } : t.operation === "feature-display" ? { operation: "feature-display", ...e.featureDisplays(t.document, t.bodies) } : { operation: "export-step", ...e.exportStep(t.document, t.bodies) }, timing: { loadMs: n, runMs: performance.now() - r, memoryBytes: e.kernel.memory().heap } };
}
function an(e = {}) {
  const t = () => new Error(N("Request cancelled"));
  return {
    async run(n, r) {
      if (r?.aborted)
        throw t();
      const o = performance.now(), a = await en(e), s = performance.now();
      if (r?.aborted || (await new Promise((l) => setTimeout(l, 0)), r?.aborted))
        throw t();
      const i = tn(a, n, s - o);
      if (r?.aborted)
        throw t();
      return i;
    }
  };
}
export {
  St as EXACT_KERNEL_ID,
  At as EXACT_KERNEL_PACKAGE,
  $t as EXACT_KERNEL_VERSION,
  S as ExactKernelError,
  ze as ExactLoweringError,
  Ft as MANY_LOOPS,
  ae as MAX_EXACT_BODIES,
  Te as MAX_POLYHEDRON_FACES,
  Wt as MAX_STEP_BYTES,
  Ee as MIN_EXACT_SEGMENTS,
  sn as cadScript,
  en as createExactBackend,
  kt as createExactBackendFromKernel,
  an as createInThreadExactHost,
  Ie as displayMesh,
  Gt as displayTessellation,
  on as evaluateCadScript,
  Qt as exactFeatureDisplay,
  Et as exactKernelIdentity,
  Jt as exactTargets,
  qt as facewiseMesh,
  we as lowerCodeShape,
  Xt as lowerDocumentBody,
  Bt as lowerDocumentNode,
  Xe as revolveProfile,
  tn as runExactRequest,
  Re as sketchProfile,
  Kt as triangulatePolygon
};
