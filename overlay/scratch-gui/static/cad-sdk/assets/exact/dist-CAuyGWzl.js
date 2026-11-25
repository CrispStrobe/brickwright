var we = Object.defineProperty;
var ve = (e, t, n) => t in e ? we(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var W = (e, t, n) => ve(e, typeof t != "symbol" ? t + "" : t, n);
import { c as de, C as be, e as Me, f as D, a as Ae, b as Ee, d as Se, g as $e, h as Ce, s as re, i as Pe, j as Te, t as E, M as ze, k as Re, E as _e, l as De, v as oe, m as Ne } from "../geometry.worker-vmZ1spj-.js";
var m = class extends Error {
  constructor(t, n, r) {
    super(n, r);
    W(this, "code");
    this.name = "ExactKernelError", this.code = t;
  }
}, y = (e) => {
  throw new m("invalid-input", e);
};
function v(e, ...t) {
  for (const n of t) (typeof n != "number" || !Number.isFinite(n)) && y(`${e} must be finite numbers (got ${String(n)}).`);
}
function P(e, ...t) {
  v(e, ...t);
  for (const n of t) n > 0 || y(`${e} must be positive (got ${n}).`);
}
function Z(e, t) {
  if (!Array.isArray(t) || t.length !== 3) return y(`${e} must be a 3-vector.`);
  v(e, ...t);
  const n = Math.hypot(t[0], t[1], t[2]);
  return n > 1e-12 || y(`${e} must be a non-zero vector.`), [t[0] / n, t[1] / n, t[2] / n];
}
function Le(e) {
  const t = e.map((r) => [...r]), n = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let r = 0; r < 64 && !(Math.abs(t[0][1]) + Math.abs(t[0][2]) + Math.abs(t[1][2]) < 1e-30); r++)
    for (const [i, s] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(t[i][s]) < 1e-300) continue;
      const a = (t[s][s] - t[i][i]) / (2 * t[i][s]), c = Math.sign(a || 1) / (Math.abs(a) + Math.sqrt(a * a + 1)), f = 1 / Math.sqrt(c * c + 1), p = c * f;
      for (let l = 0; l < 3; l++) {
        const u = t[l][i], h = t[l][s];
        t[l][i] = f * u - p * h, t[l][s] = p * u + f * h;
      }
      for (let l = 0; l < 3; l++) {
        const u = t[i][l], h = t[s][l];
        t[i][l] = f * u - p * h, t[s][l] = p * u + f * h;
      }
      for (let l = 0; l < 3; l++) {
        const u = n[l][i], h = n[l][s];
        n[l][i] = f * u - p * h, n[l][s] = p * u + f * h;
      }
    }
  return { values: [t[0][0], t[1][1], t[2][2]], vectors: [0, 1, 2].map((r) => [n[0][r], n[1][r], n[2][r]]) };
}
function Ie(e, t) {
  const n = new Float64Array(e.length);
  for (let r = 0; r < t.length; r += 3) {
    const o = t[r] * 3, i = t[r + 1] * 3, s = t[r + 2] * 3, a = e[i] - e[o], c = e[i + 1] - e[o + 1], f = e[i + 2] - e[o + 2], p = e[s] - e[o], l = e[s + 1] - e[o + 1], u = e[s + 2] - e[o + 2], h = c * u - f * l, g = f * p - a * u, w = a * l - c * p;
    for (const M of [o, i, s])
      n[M] += h, n[M + 1] += g, n[M + 2] += w;
  }
  for (let r = 0; r < n.length; r += 3) {
    const o = Math.hypot(n[r], n[r + 1], n[r + 2]);
    o > 0 && (n[r] /= o, n[r + 1] /= o, n[r + 2] /= o);
  }
  return n;
}
var N = (e) => ({ part: e, dispose: () => e.dispose() }), C = (e) => ({ sketch: e, dispose: () => e.dispose() }), x = (e) => e?.part ?? y("Not a solid of this kernel."), b = (e) => e?.sketch ?? y("Not a profile of this kernel."), L = (e) => [e[0], e[1], e[2]];
function d(e, t) {
  try {
    return t();
  } catch (n) {
    if (n instanceof m) throw n;
    const r = n instanceof Error ? n.message : String(n);
    throw new m("kernel-failure", `SMLib ${e} failed: ${r}`, { cause: n });
  }
}
function Oe(e) {
  return { sm: e, solid: (r, o) => {
    if (!(o instanceof e.Part)) throw new m("kernel-failure", `SMLib ${r} did not produce a solid (got ${o?.constructor?.name ?? typeof o}).`);
    return N(o);
  }, face: (r, o) => {
    const { faceNormal: i, outermost: s } = Array.isArray(o) ? { faceNormal: o, outermost: !1 } : o, a = Z("Face normal", i), c = (p) => {
      const l = p.center();
      return l.x * a[0] + l.y * a[1] + l.z * a[2];
    }, f = [...r.faces()].filter((p) => {
      if (!p.isPlanar) return !1;
      const l = p.normalAt();
      return l.x * a[0] + l.y * a[1] + l.z * a[2] > 1 - 1e-9;
    });
    return s && f.length ? f.sort((p, l) => c(l) - c(p))[0] : (f.length !== 1 && y(`Expected exactly one planar face with outward normal [${a.join(", ")}], found ${f.length}.`), f[0]);
  } };
}
var T = (e) => [e[0], e[1], 0];
function Xe(e, t, n) {
  let r = t;
  const o = [], i = (s, a) => ((!Array.isArray(a) || a.length !== 2) && y(`${s} must be a 2D point.`), v(s, a[0], a[1]), a);
  for (const s of n) {
    const a = s.kind === "spline" ? i("Spline point", s.through.at(-1) ?? y("A spline needs at least one point.")) : i("Path point", s.to);
    s.kind === "line" ? o.push(e.Line(T(r), T(a))) : s.kind === "arc" ? o.push(e.ThreePointArc(T(r), T(i("Arc point", s.via)), T(a))) : s.kind === "radiusArc" ? (v("Arc radius", s.radius), o.push(e.RadiusArc(T(r), T(a), s.radius))) : s.kind === "sagittaArc" ? (v("Arc sagitta", s.sagitta), o.push(e.SagittaArc(T(r), T(a), s.sagitta))) : s.kind === "spline" ? o.push(e.Spline(T(r), ...s.through.map((c) => T(i("Spline point", c))))) : y(`Unknown path segment kind '${s.kind}'.`), r = a;
  }
  return Math.hypot(r[0] - t[0], r[1] - t[1]) > 1e-9 && o.push(e.Line(T(r), T(t))), o;
}
function Be(e) {
  return {
    polygon(t) {
      (!Array.isArray(t) || !t.length) && y("A polygon profile needs at least one contour.");
      for (const n of t) {
        (!Array.isArray(n) || n.length < 3) && y("Each polygon contour needs at least three points.");
        for (const r of n) v("Polygon points", r[0], r[1]);
      }
      return d("Polygon", () => {
        const n = t.map((r) => e.Polygon(r.map((o) => [o[0], o[1]])));
        return C(n.length === 1 ? n[0] : e.xor(n[0], ...n.slice(1)));
      });
    },
    circle(t) {
      return P("Circle radius", t), d("Circle", () => C(e.Circle(t)));
    },
    rectangle(t, n, r) {
      return P("Rectangle size", t, n), d("Rectangle", () => C(r ? e.Rectangle(t, n) : e.Rectangle(t, n, { align: "min" })));
    },
    roundedRectangle(t, n, r) {
      return P("Rounded rectangle size and radius", t, n, r), r >= Math.min(t, n) / 2 && y("The corner radius must be below half the short side."), d("RoundedRectangle", () => C(e.RoundedRectangle(t, n, r)));
    },
    path(t, n) {
      return (!Array.isArray(n) || !n.length) && y("A path profile needs at least one segment."), v("Path start", ...Array.isArray(t) ? t : [NaN]), d("path", () => C(e.makeFace(new e.Wire(Xe(e, t, n)))));
    },
    text(t, n) {
      (typeof t != "string" || !t.length) && y("Text must be a non-empty string."), P("Text size", n);
      try {
        return C(e.Text(t, n));
      } catch (r) {
        if (r instanceof e.FontError) throw new m("unsupported", `Text needs a font, and this package ships none (the upstream default font is left out): ${r.message}`, { cause: r });
        return d("Text", () => {
          throw r;
        });
      }
    },
    union: (t, ...n) => d("fuse (2D)", () => C(n.length ? e.fuse(b(t), ...n.map(b)) : b(t))),
    subtract: (t, ...n) => d("cut (2D)", () => C(n.length ? e.cut(b(t), ...n.map(b)) : b(t))),
    intersect: (t, ...n) => d("intersect (2D)", () => C(n.length ? e.intersect(b(t), ...n.map(b)) : b(t))),
    hull: (...t) => (t.length || y("A hull needs at least one profile."), d("Hull (2D)", () => C(e.Hull(...t.map(b))))),
    translate: (t, [n, r]) => (v("Profile offset", n, r), d("translate (2D)", () => C(b(t).translate([n, r, 0])))),
    rotate: (t, n) => (v("Profile angle", n), d("rotate (2D)", () => C(b(t).rotate(e.Axis.Z, n)))),
    scale: (t, [n, r]) => (v("Profile scale", n, r), (n === 0 || r === 0) && y("A zero profile scale flattens the profile."), d("scale (2D)", () => C(b(t).scale([n, r, 1])))),
    offset: (t, n, r) => (v("Profile offset distance", n), d("offset (2D)", () => C(e.offset(b(t), n, { corners: r ? "round" : "sharp" })))),
    bounds: (t) => {
      const n = b(t).bbox();
      return { min: [n.min.x, n.min.y], max: [n.max.x, n.max.y] };
    },
    area: (t) => d("area (2D)", () => b(t).area)
  };
}
var Fe = 0.01, He = 10, Ke = "MIT AND Apache-2.0";
async function Ye(e) {
  const { init: t } = await import("./chunk-AJV3MJKC-CG0S4ukQ.js").then(function(n) {
    return n.c;
  });
  try {
    return await t(e);
  } catch (n) {
    throw new m("invalid-input", `Could not load SMLib: ${n instanceof Error ? n.message : String(n)}`, { cause: n });
  }
}
var se = (e) => {
  const t = e.tolerance ?? Fe, n = e.angleDeg ?? He;
  return P("Tessellation tolerance and angle", t, n), { tolerance: t, angle: n };
};
function qe({ sm: e, solid: t }) {
  return {
    box(n) {
      return P("Box size", ...n), d("Box", () => t("Box", e.Box(n[0], n[1], n[2])));
    },
    cylinder(n, r) {
      return P("Cylinder radius and height", n, r), d("Cylinder", () => t("Cylinder", e.Cylinder(n, r)));
    },
    cone(n, r, o) {
      return v("Cone radii", n, r), P("Cone height", o), (n < 0 || r < 0 || !(n > 0 || r > 0)) && y("Cone radii must be non-negative and not both zero."), d("Cone", () => t("Cone", n === r ? e.Cylinder(n, o) : e.Cone(n, r, o)));
    },
    sphere(n) {
      return P("Sphere radius", n), d("Sphere", () => t("Sphere", e.Sphere(n)));
    },
    torus(n, r) {
      return P("Torus radii", n, r), r >= n && y("The tube radius must be smaller than the major radius."), d("Torus", () => t("Torus", e.Torus(n, r)));
    },
    polyhedron(n, r) {
      (!Array.isArray(n) || n.length < 4 || !Array.isArray(r) || r.length < 4) && y("A polyhedron needs at least four points and four faces.");
      for (const o of n) v("Polyhedron points", o[0], o[1], o[2]);
      for (const o of r) (!Array.isArray(o) || o.length < 3 || o.some((i) => !Number.isInteger(i) || i < 0 || i >= n.length)) && y("Polyhedron faces must index at least three existing points.");
      return d("stitch (polyhedron)", () => e.scope(() => {
        const o = r.map((s) => {
          const a = s.map((c) => L(n[c]));
          return e.makeFace(e.Polyline(...a, a[0]));
        }), i = e.stitch(...o);
        return (!(i instanceof e.Part) || !i.isValid()) && y("The polyhedron faces do not close around a valid solid."), N(i);
      }));
    }
  };
}
function Ve({ sm: e, solid: t }) {
  return {
    extrude(n, r) {
      return P("Extrusion height", r), d("extrude", () => t("extrude", e.extrude(b(n), r)));
    },
    revolve(n, r) {
      return v("Revolution angle", r), (r === 0 || Math.abs(r) > 360) && y("Revolution angle must be in (0, 360] degrees in magnitude."), d("revolve", () => e.scope(() => {
        const o = b(n).rotate(e.Axis.X, 90), i = e.revolve(o, e.Axis.Z, Math.abs(r));
        return t("revolve", r < 0 ? i.mirror(new e.Plane([0, 0, 0], void 0, [0, 1, 0])) : i);
      }));
    },
    loft(n, r = {}) {
      (!Array.isArray(n) || n.length < 2) && y("A loft needs at least two sections.");
      for (const o of n) v("Loft section position", ...o.at);
      return d("loft", () => e.scope(() => t("loft", e.loft(n.map((o) => b(o.profile).translate(L(o.at))), { ruled: !!r.ruled }))));
    },
    sweep(n, r) {
      (!Array.isArray(r) || r.length < 2) && y("A sweep rail needs at least two points.");
      for (const o of r) v("Sweep rail points", ...o);
      return d("sweep", () => e.scope(() => {
        const o = r.map(L), i = o.length === 2 ? e.Line(o[0], o[1]) : e.Polyline(o);
        return t("sweep", e.sweep(b(n), i));
      }));
    }
  };
}
function je({ sm: e, solid: t }) {
  return {
    union: (n, ...r) => d("fuse", () => t("fuse", r.length ? e.fuse(x(n), ...r.map(x)) : x(n))),
    subtract: (n, ...r) => d("cut", () => t("cut", r.length ? e.cut(x(n), ...r.map(x)) : x(n))),
    intersect: (n, ...r) => d("intersect", () => t("intersect", r.length ? e.intersect(x(n), ...r.map(x)) : x(n))),
    splitByPlane: (n, r, o) => {
      const i = Z("Split normal", r);
      return v("Split offset", o), d("split", () => {
        const [s, a] = e.split(x(n), new e.Plane([i[0] * o, i[1] * o, i[2] * o], void 0, i), "both");
        return [t("split", s), t("split", a)];
      });
    },
    translate: (n, r) => (v("Translation", ...r), d("translate", () => N(x(n).translate(L(r))))),
    rotate: (n, r, o, i = [0, 0, 0]) => {
      const s = Z("Rotation axis", r);
      return v("Rotation angle and pivot", o, ...i), d("rotate", () => N(x(n).rotate(new e.Axis(L(i), s), o)));
    },
    mirror: (n, r, o = [0, 0, 0]) => {
      const i = Z("Mirror normal", r);
      return v("Mirror origin", ...o), d("mirror", () => N(x(n).mirror(new e.Plane(L(o), void 0, i))));
    },
    scale: (n, r) => (v("Scale factors", ...r), r.some((o) => o === 0) && y("A zero scale factor flattens the solid."), d("scale", () => N(x(n).scale(L(r), [0, 0, 0]))))
  };
}
function Ze(e) {
  const { sm: t, solid: n, face: r } = e, o = (s, a) => a === "all" ? s.edges() : r(s, a).edges(), i = (s) => Array.isArray(s) && typeof s[0] == "number" || !!s && typeof s == "object" && "faceNormal" in s;
  return {
    fillet: (s, a, c = "all") => (P("Fillet radius", a), d("fillet", () => n("fillet", t.fillet(o(x(s), c), a)))),
    chamfer: (s, a, c = "all") => (P("Chamfer distance", a), d("chamfer", () => n("chamfer", t.chamfer(o(x(s), c), a)))),
    shell: (s, a, c) => {
      P("Shell thickness", a);
      const f = c === void 0 ? [] : i(c) ? [c] : [...c];
      return d("shell", () => {
        const p = x(s), l = f.map((u) => r(p, u));
        return n("shell", t.shell(p, -a, l.length ? l : null));
      });
    }
  };
}
function Ue({ sm: e }) {
  return {
    volume: (t) => d("volume", () => x(t).volume),
    area: (t) => d("area", () => x(t).area),
    bbox: (t) => d("bbox", () => {
      const n = x(t).bbox();
      return { min: [n.min.x, n.min.y, n.min.z], max: [n.max.x, n.max.y, n.max.z] };
    }),
    massProperties: (t) => d("massProperties", () => {
      const n = x(t).massProperties(1), r = n.inertia, o = (c, f) => (r[c][f] + r[f][c]) / 2, i = [[r[0][0], o(0, 1), o(0, 2)], [o(0, 1), r[1][1], o(1, 2)], [o(0, 2), o(1, 2), r[2][2]]], { values: s, vectors: a } = Le(i);
      return { volume: n.volume, centroid: [n.center.x, n.center.y, n.center.z], inertia: i, principalMoments: s, principalAxes: a };
    }),
    isValid: (t) => d("isValid", () => x(t).isValid()),
    solidCount: (t) => d("solids", () => e.scope(() => x(t).solids().length)),
    components: (t) => d("solids", () => [...x(t).solids()].map(N))
  };
}
function Ge({ sm: e, solid: t }) {
  return {
    tessellate: (n, r = {}) => {
      const { tolerance: o, angle: i } = se(r);
      return d("mesh", () => e.scope(() => {
        const s = x(n).mesh(o, i), a = Float64Array.from(s.vertices), c = Uint32Array.from(s.triangles);
        return { positions: a, normals: Ie(a, c), indices: c };
      }));
    },
    exportStl: (n, r = {}) => {
      const { tolerance: o, angle: i } = se(r);
      return d("toStl", () => e.toStl(x(n), { tolerance: o, angle: i }));
    },
    exportStep: (n) => d("toStep", () => e.toStep(x(n))),
    importStep: (n) => ((typeof n != "string" || !n.length) && y("STEP input must be non-empty text."), d("fromStep", () => {
      const r = e.fromStep(n);
      if (Array.isArray(r) && r.length && r.every((o) => o instanceof e.Part)) {
        const o = r;
        return t("fromStep", o.length === 1 ? o[0] : e.fuse(o[0], ...o.slice(1)));
      }
      return t("fromStep", r);
    }))
  };
}
async function We(e = {}) {
  const t = await Ye(e);
  t.setWarningHandler(() => {
  });
  const n = Oe(t);
  return {
    name: "@classcad/smlibwasm",
    version: t.version,
    licence: Ke,
    profile: Be(t),
    ...qe(n),
    ...Ve(n),
    ...je(n),
    ...Ze(n),
    ...Ue(n),
    ...Ge(n),
    memory: () => {
      const r = t.memoryUsage();
      return { used: r.used, heap: r.heap, handles: r.handles };
    },
    scope: (r) => t.scope(r)
  };
}
var ae = 64, J = (e, t) => [e[0] - t[0], e[1] - t[1], e[2] - t[2]], _ = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], Q = (e, t) => [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
function me(e) {
  const t = [], n = Math.max(1, ...e.flatMap((f) => f.map(Math.abs))), r = 1e-9 * n;
  for (const f of e) t.some((p) => Math.hypot(...J(f, p)) <= r) || t.push(f);
  if (t.length > ae) throw new m("unsupported", `Hull of ${t.length} distinct vertices exceeds the exact hull budget (${ae}).`);
  if (t.length < 4) throw new m("invalid-input", "A hull needs at least four non-coplanar points.");
  const o = [], i = t.length;
  for (let f = 0; f < i; f++) for (let p = f + 1; p < i; p++) for (let l = p + 1; l < i; l++) {
    const u = Q(J(t[p], t[f]), J(t[l], t[f])), h = Math.hypot(...u);
    if (h <= r * n) continue;
    let g = [u[0] / h, u[1] / h, u[2] / h], w = _(g, t[f]), M = 0, K = 0;
    for (const z of t) {
      const X = _(g, z) - w;
      X > r ? M++ : X < -r && K++;
    }
    M && K || !M && !K || (M && (g = [-g[0], -g[1], -g[2]], w = -w), !o.some((z) => _(z.n, g) > 1 - 1e-12 && Math.abs(z.d - w) <= r) && o.push({ n: g, d: w, members: t.map((z, X) => Math.abs(_(g, z) - w) <= r ? X : -1).filter((z) => z >= 0) }));
  }
  if (o.length < 4) throw new m("invalid-input", "The hull is flat (all points coplanar).");
  const s = o.map(({ n: f, members: p }) => {
    const l = Math.abs(f[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = Q(f, l), h = Math.hypot(...u), g = [u[0] / h, u[1] / h, u[2] / h], w = Q(f, g), M = p.map((S) => ({ idx: S, x: _(t[S], g), y: _(t[S], w) })).sort((S, $) => S.x - $.x || S.y - $.y), K = (S, $, Y) => ($.x - S.x) * (Y.y - S.y) - ($.y - S.y) * (Y.x - S.x), z = (S) => {
      const $ = [];
      for (const Y of S) {
        for (; $.length >= 2 && K($[$.length - 2], $[$.length - 1], Y) <= r * n; ) $.pop();
        $.push(Y);
      }
      return $;
    }, X = z(M), ye = z([...M].reverse());
    return [...X.slice(0, -1), ...ye.slice(0, -1)].map((S) => S.idx);
  }), a = [...new Set(s.flat())].sort((f, p) => f - p), c = new Map(a.map((f, p) => [f, p]));
  return { points: a.map((f) => t[f]), faces: s.map((f) => f.map((p) => c.get(p))) };
}
function Je(e, t) {
  const n = Math.max(1, ...e.flatMap((o) => o.map(Math.abs))), r = 1e-9 * n;
  for (const o of t) {
    const i = [0, 0, 0];
    for (let f = 0; f < o.length; f++) {
      const p = e[o[f]], l = e[o[(f + 1) % o.length]];
      i[0] += (p[1] - l[1]) * (p[2] + l[2]), i[1] += (p[2] - l[2]) * (p[0] + l[0]), i[2] += (p[0] - l[0]) * (p[1] + l[1]);
    }
    const s = Math.hypot(...i);
    if (!(s > 0)) return !1;
    const a = [i[0] / s, i[1] / s, i[2] / s], c = _(a, e[o[0]]);
    if (o.some((f) => Math.abs(_(a, e[f]) - c) > r) || e.some((f) => _(a, f) - c > r)) return !1;
  }
  return !0;
}
const Qe = "@crispcad/exact-kernel", ke = "0.1.0", et = "smlib", tt = Object.freeze({ id: et, package: Qe, version: ke }), ie = 16, le = 256, A = (e) => {
  throw new m("unsupported", e);
}, O = (e) => {
  throw new m("invalid-input", e);
};
function I(e, t) {
  t < ie && A(`${e} with ${t} segments is ambiguous for an exact kernel (a polygon or a circle?); use ${ie}+ segments for a true circle, or polygon2d/polyhedron for a polygonal shape.`);
}
const nt = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], ee = (e, t) => {
  const n = [];
  for (let r = 0; r < 3; r++)
    for (let o = 0; o < 4; o++)
      n.push(e[r * 4] * t[o] + e[r * 4 + 1] * t[4 + o] + e[r * 4 + 2] * t[8 + o] + (o === 3 ? e[r * 4 + 3] : 0));
  return n;
}, B = (e, t) => [0, 1, 2].map((n) => e[n * 4] * t[0] + e[n * 4 + 1] * t[1] + e[n * 4 + 2] * t[2] + e[n * 4 + 3]), ce = (e) => [1, 0, 0, e[0], 0, 1, 0, e[1], 0, 0, 1, e[2]], rt = (e) => [e[0], 0, 0, 0, 0, e[1], 0, 0, 0, 0, e[2], 0];
function U(e, t) {
  const n = Math.hypot(...e);
  n > 0 || O("Rotation axis must be non-zero.");
  const [r, o, i] = e.map((p) => p / n), s = t * Math.PI / 180, a = Math.cos(s), c = Math.sin(s), f = 1 - a;
  return [f * r * r + a, f * r * o - c * i, f * r * i + c * o, 0, f * r * o + c * i, f * o * o + a, f * o * i - c * r, 0, f * r * i - c * o, f * o * i + c * r, f * i * i + a, 0];
}
const ot = (e) => ee(U([0, 0, 1], e[2]), ee(U([0, 1, 0], e[1]), U([1, 0, 0], e[0])));
function st(e) {
  const t = Math.hypot(...e);
  t > 0 || O("Mirror normal must be non-zero.");
  const [n, r, o] = e.map((i) => i / t);
  return [1 - 2 * n * n, -2 * n * r, -2 * n * o, 0, -2 * n * r, 1 - 2 * r * r, -2 * r * o, 0, -2 * n * o, -2 * r * o, 1 - 2 * o * o, 0];
}
function at(e) {
  const [t, n, r, , o, i, s, , a, c, f] = e, p = Math.max(-1, Math.min(1, (t + i + f - 1) / 2)), l = Math.acos(p);
  if (l < 1e-15)
    return null;
  let u = [c - s, r - a, o - n];
  return Math.hypot(...u) < 1e-9 && (u = [[t + 1, o, a], [n, i + 1, c], [r, s, f + 1]].reduce((g, w) => Math.hypot(...w) > Math.hypot(...g) ? w : g)), { axis: u, degrees: l * 180 / Math.PI };
}
function it(e) {
  const t = [0, 1, 2].map((s) => [e[s], e[4 + s], e[8 + s]]), n = t.map((s) => Math.hypot(...s));
  n.some((s) => !(s > 1e-12)) && O("Affine matrix is singular.");
  for (const [s, a] of [[0, 1], [0, 2], [1, 2]]) {
    const c = t[s][0] * t[a][0] + t[s][1] * t[a][1] + t[s][2] * t[a][2];
    Math.abs(c) > 1e-9 * n[s] * n[a] && A("Affine transforms with shear (non-orthogonal columns) have no exact B-rep lowering here.");
  }
  const r = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[1][0] * (t[0][1] * t[2][2] - t[0][2] * t[2][1]) + t[2][0] * (t[0][1] * t[1][2] - t[0][2] * t[1][1]), o = [n[0], n[1], r < 0 ? -n[2] : n[2]], i = [0, 1, 2].flatMap((s) => [e[s * 4] / o[0], e[s * 4 + 1] / o[1], e[s * 4 + 2] / o[2], 0]);
  return { scale: o, rotation: i, translate: [e[3], e[7], e[11]] };
}
function ge(e, t, n, r) {
  const o = e.map((s, a) => {
    if (!s)
      return 0;
    const c = r[a] - n[a];
    return c < 1e-12 && O("Cannot resize a degenerate shape."), s / c;
  }), i = Math.max(...o) || 1;
  return o.map((s, a) => e[a] ? s : t?.[a] ? i : 1);
}
function R(e, t) {
  switch (t.kind) {
    case "empty":
      return null;
    case "polygon":
      return e.profile.polygon(t.contours);
    case "circle":
      return I("circle2d", t.segments), e.profile.circle(t.radius);
    case "rectangle":
      return e.profile.rectangle(t.size[0], t.size[1], t.center);
    case "move": {
      const n = R(e, t.profile);
      return n && e.profile.translate(n, t.vector);
    }
    case "rotate": {
      const n = R(e, t.profile);
      return n && e.profile.rotate(n, t.angle);
    }
    case "scale": {
      const n = R(e, t.profile);
      return n && e.profile.scale(n, t.vector);
    }
    case "affine": {
      const n = R(e, t.profile);
      if (!n)
        return null;
      const [r, o, i, s, a, c] = t.matrix, f = Math.hypot(r, s), p = Math.hypot(o, a);
      f > 1e-12 && p > 1e-12 || O("2D affine matrix is singular."), Math.abs(r * o + s * a) > 1e-9 * f * p && A("2D affine transforms with shear have no exact lowering here.");
      const l = r * a - o * s;
      return e.profile.translate(e.profile.rotate(e.profile.scale(n, [f, l < 0 ? -p : p]), Math.atan2(s, r) * 180 / Math.PI), [i, c]);
    }
    case "resize": {
      const n = R(e, t.profile);
      if (!n)
        return null;
      const r = e.profile.bounds(n), o = ge(t.size, t.auto, r.min, r.max);
      return e.profile.scale(n, [o[0], o[1]]);
    }
    case "offset": {
      t.round && I("offset2d", t.segments);
      const n = R(e, t.profile);
      return n && e.profile.offset(n, t.distance, t.round);
    }
    case "text":
      return A("text2d needs a font outline path, and the exact kernel package ships no font.");
    case "minkowski":
      return A("minkowski2d has no exact lowering (planar Minkowski sums of curved profiles are not exposed by this kernel adapter).");
    case "union":
    case "subtract":
    case "intersect":
    case "hull": {
      const n = t.profiles.map((i) => R(e, i)), r = n.filter((i) => i !== null);
      if (t.kind === "union")
        return r.length ? e.profile.union(r[0], ...r.slice(1)) : null;
      if (t.kind === "hull")
        return r.length ? e.profile.hull(...r) : null;
      if (t.kind === "intersect")
        return n.some((i) => i === null) || !r.length ? null : e.profile.intersect(r[0], ...r.slice(1));
      if (!n[0])
        return null;
      const o = n.slice(1).filter((i) => i !== null);
      return o.length ? e.profile.subtract(n[0], ...o) : n[0];
    }
    default:
      return A(`Profile '${t.kind}' has no exact lowering.`);
  }
}
function F(e) {
  switch (e.kind) {
    case "polygon":
      return e.contours.flat();
    case "rectangle": {
      const [t, n] = e.size, r = e.center ? -t / 2 : 0, o = e.center ? -n / 2 : 0;
      return [[r, o], [r + t, o], [r + t, o + n], [r, o + n]];
    }
    case "move":
      return F(e.profile).map(([t, n]) => [t + e.vector[0], n + e.vector[1]]);
    case "scale":
      return F(e.profile).map(([t, n]) => [t * e.vector[0], n * e.vector[1]]);
    case "rotate": {
      const t = e.angle * Math.PI / 180, n = Math.cos(t), r = Math.sin(t);
      return F(e.profile).map(([o, i]) => [n * o - r * i, r * o + n * i]);
    }
    case "affine": {
      const t = e.matrix;
      return F(e.profile).map(([n, r]) => [t[0] * n + t[1] * r + t[2], t[3] * n + t[4] * r + t[5]]);
    }
    case "union":
    case "hull":
      return e.profiles.flatMap(F);
    case "empty":
      return [];
    default:
      return A(`hull of an extruded '${e.kind}' profile has no exact lowering (only straight-edged profiles).`);
  }
}
function te(e, t, n) {
  const r = (o, i) => te(i, ee(t, o), n);
  switch (e.kind) {
    case "empty":
      return;
    case "union":
    case "hull":
      for (const o of e.shapes)
        te(o, t, n);
      return;
    case "move":
      return r(ce(e.vector), e.shape);
    case "rotate":
      return r(ot(e.vector), e.shape);
    case "scale":
      return r(rt(e.vector), e.shape);
    case "mirror":
      return r(st(e.vector), e.shape);
    case "axisRotate":
      return r(U(e.vector, e.angle), e.shape);
    case "affine":
      return r(e.matrix.slice(0, 12), e.shape);
    case "repeat":
      for (let o = 0; o < e.count; o++)
        r(ce(e.step.map((i) => i * o)), e.shape);
      return;
    case "box": {
      const [o, i, s] = e.size.map((a) => a / 2);
      for (const a of [-o, o])
        for (const c of [-i, i])
          for (const f of [-s, s])
            n.points.push(B(t, [a, c, f]));
      return;
    }
    case "polyhedron":
      for (const o of e.points)
        n.points.push(B(t, o));
      return;
    case "extrude":
      for (const [o, i] of e.points)
        for (const s of [0, e.height])
          n.points.push(B(t, [o, i, s]));
      return;
    case "profile-extrude": {
      e.twist !== 0 && A("hull of a twisted extrusion has no exact lowering.");
      for (const [o, i] of F(e.profile))
        n.points.push(B(t, [o, i, 0])), n.points.push(B(t, [o * e.scaleTop[0], i * e.scaleTop[1], e.height]));
      return;
    }
    case "sphere": {
      I("sphere", e.segments);
      const o = [0, 1, 2].map((i) => Math.hypot(t[i], t[4 + i], t[8 + i]));
      Math.max(...o) - Math.min(...o) > 1e-12 * Math.max(...o) && A("hull of a non-uniformly scaled sphere (an ellipsoid) has no exact lowering."), n.spheres.push({ centre: B(t, [0, 0, 0]), radius: e.radius * o[0] });
      return;
    }
    default:
      A(`hull of '${e.kind}' has no exact lowering (supported: polyhedral solids, or equal spheres at the corners of a box).`);
  }
}
function lt(e, t) {
  const n = { points: [], spheres: [] };
  for (const u of t)
    te(u, nt, n);
  if (n.points.length && n.spheres.length && A("hull mixing spheres and polyhedral solids has no exact lowering."), n.points.length) {
    const u = me(n.points);
    return e.polyhedron(u.points, u.faces);
  }
  if (!n.spheres.length)
    return null;
  const r = n.spheres[0].radius;
  n.spheres.some((u) => Math.abs(u.radius - r) > 1e-12 * r) && A("hull of spheres with different radii has no exact lowering.");
  const o = n.spheres.map((u) => u.centre), i = [0, 1, 2].map((u) => Math.min(...o.map((h) => h[u]))), s = [0, 1, 2].map((u) => Math.max(...o.map((h) => h[u]))), a = s.map((u, h) => u - i[h]), c = 1e-9 * Math.max(1, ...a);
  if (a.every((u) => u <= c))
    return e.translate(e.sphere(r), i);
  const f = (u) => [u & 1 ? s[0] : i[0], u & 2 ? s[1] : i[1], u & 4 ? s[2] : i[2]];
  (![0, 1, 2, 3, 4, 5, 6, 7].every((u) => o.some((h) => h.every((g, w) => Math.abs(g - f(u)[w]) <= c))) || a.some((u) => u <= c)) && A("hull of spheres is lowered exactly only when the centres span an axis-aligned box (an all-edge fillet).");
  const l = e.box(a.map((u) => u + 2 * r));
  return e.translate(e.fillet(l, r, "all"), i.map((u, h) => u + a[h] / 2));
}
function xe(e, t, n) {
  const r = e.profile.bounds(t), o = r.max[0] <= 0;
  r.min[0] < -1e-8 && !o && O("Revolved profiles must stay on one side of the radial axis.");
  const i = Math.abs(n);
  i > 360 && O("Revolution angle exceeds 360 degrees.");
  let s = e.revolve(o ? e.profile.scale(t, [-1, 1]) : t, n);
  return o && i !== 360 && (s = e.rotate(s, [0, 0, 1], 180)), s;
}
function ct(e, t, n) {
  const { scale: r, rotation: o, translate: i } = it(n);
  let s = r.every((c) => Math.abs(c - 1) < 1e-15) ? t : e.scale(t, r);
  const a = at(o);
  return a && (s = e.rotate(s, a.axis, a.degrees)), i.some((c) => c !== 0) ? e.translate(s, i) : s;
}
function ne(e, t) {
  const n = (r) => ne(e, r);
  switch (t.kind) {
    case "empty":
      return null;
    case "box":
      return e.box(t.size);
    case "cylinder":
      return I("cylinder", t.segments), e.cylinder(t.radius, t.height);
    case "frustum":
      return I("frustum", t.segments), e.cone(t.bottom, t.top, t.height);
    case "sphere":
      return I("sphere", t.segments), e.sphere(t.radius);
    case "extrude":
      return e.extrude(e.profile.polygon([t.points]), t.height);
    case "profile-extrude": {
      t.twist !== 0 && A("Twisted extrusions (extrudeProfile twist) have no exact lowering yet (would need a helical sweep)."), (t.scaleTop[0] !== 1 || t.scaleTop[1] !== 1) && A("Tapered extrusions (extrudeProfile top scale) have no exact lowering yet (would need a ruled loft).");
      const r = R(e, t.profile);
      return r && e.extrude(r, t.height);
    }
    case "revolve": {
      if (I("revolve", t.segments), t.angle === 0)
        return null;
      const r = R(e, t.profile);
      return r && xe(e, r, t.angle);
    }
    case "polyhedron": {
      if (t.faces.length > le && A(`A polyhedron of ${t.faces.length} faces exceeds the exact faceted-solid budget (${le}); tessellated constructors (ellipsoid, ellipticFrustum, roundedCylinder, many-section loft) have no exact lowering yet.`), Je(t.points, t.faces)) {
        const r = me(t.points);
        return e.polyhedron(r.points, r.faces);
      }
      return e.polyhedron(t.points, t.faces);
    }
    case "union":
    case "subtract":
    case "intersect": {
      const r = (c) => c.kind === "union" ? c.shapes.flatMap(r) : [c], i = (t.kind === "subtract" ? [t.shapes[0], ...t.shapes.slice(1).flatMap(r)] : t.shapes).map(n), s = i.filter((c) => c !== null);
      if (t.kind === "union")
        return s.length ? e.union(s[0], ...s.slice(1)) : null;
      if (t.kind === "intersect")
        return i.some((c) => c === null) || !s.length ? null : e.intersect(s[0], ...s.slice(1));
      if (!i[0])
        return null;
      const a = i.slice(1).filter((c) => c !== null);
      return a.length ? e.subtract(i[0], ...a) : i[0];
    }
    case "hull":
      return lt(e, t.shapes);
    case "minkowski":
      return A("minkowski has no exact lowering (a general Minkowski sum is not a B-rep operation of this adapter; use fillet/offset intent instead).");
    case "move": {
      const r = n(t.shape);
      return r && e.translate(r, t.vector);
    }
    case "rotate": {
      const r = n(t.shape);
      if (!r)
        return null;
      let o = r;
      for (const [i, s] of [[[1, 0, 0], t.vector[0]], [[0, 1, 0], t.vector[1]], [[0, 0, 1], t.vector[2]]])
        s && (o = e.rotate(o, i, s));
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
      return r && ct(e, r, t.matrix.slice(0, 12));
    }
    case "resize": {
      const r = n(t.shape);
      if (!r)
        return null;
      const o = e.bbox(r);
      return e.scale(r, ge(t.vector, t.auto, o.min, o.max));
    }
    case "repeat": {
      const r = t.count >= 1 ? n(t.shape) : null;
      if (!r)
        return null;
      const o = Array.from({ length: t.count }, (i, s) => s === 0 ? r : e.translate(r, t.step.map((a) => a * s)));
      return o.length > 1 ? e.union(o[0], ...o.slice(1)) : o[0];
    }
    default:
      return A(`CAD Script '${t.kind}' has no exact lowering.`);
  }
}
function wt(e, t) {
  let n;
  try {
    n = de(t).shape;
  } catch (o) {
    throw o instanceof be ? new m("invalid-input", `CAD Script: ${o.message}`, { cause: o }) : o;
  }
  const r = e.scope(() => ne(e, n));
  if (!r)
    throw new m("invalid-input", "The program produces no solid.");
  if (!(e.volume(r) > 0))
    throw r.dispose(), new m("kernel-failure", "The exact result has no positive volume.");
  return r;
}
const vt = (e) => ({ version: 1, language: "brickwright-cad-script", source: e, parameters: {} });
class ue extends m {
  constructor(n, r) {
    super(n.code, n.message, r);
    W(this, "diagnostic");
    this.diagnostic = n, this.name = "ExactLoweringError";
  }
}
const V = (e) => {
  throw new m("unsupported", e);
};
function fe(e, t, n) {
  if (!n?.some((o) => o !== 0))
    return re([...t]), e.profile.polygon([t]);
  re([...t], [...n]);
  const r = t.map((o, i) => {
    const s = t[(i + 1) % t.length], a = n[i] ?? 0;
    return a ? { kind: "arc", via: Pe(o, s, a), to: s } : { kind: "line", to: s };
  });
  return e.profile.path(t[0], r);
}
const pe = (e, t, n) => {
  const r = e.profile.circle(n);
  return t[0] || t[1] ? e.profile.translate(r, [t[0], t[1]]) : r;
};
function he(e, t, n) {
  const r = t.profile;
  switch (r.kind) {
    case "rectangle":
      return e.profile.rectangle(D(r.width, n), D(r.depth, n), !0);
    case "circle":
      return pe(e, r.center ?? [0, 0], D(r.radius, n));
    case "outline":
      return fe(e, r.points, r.bulges);
    case "region": {
      Me(r.loops, (s) => D(s, n));
      const o = (s) => s.kind === "circle" ? pe(e, [D(s.center[0], n), D(s.center[1], n)], D(s.radius, n)) : fe(e, s.points, s.bulges), i = r.loops.map(o).map((s) => ({ profile: s, area: e.profile.area(s) })).sort((s, a) => a.area - s.area);
      return e.profile.subtract(i[0].profile, ...i.slice(1).map((s) => s.profile));
    }
    case "path":
      return V("Close the sketch path before creating a solid.");
    default:
      return V(`Sketch profile '${r.kind}' has no exact lowering.`);
  }
}
function q(e, t, n) {
  let r = t;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((o, i) => {
    n[i] && (r = e.rotate(r, o, n[i]));
  }), r;
}
function H(e, t, n, r, o) {
  const i = o.get(n);
  if (i)
    return i;
  const s = t.nodes[n];
  let a;
  try {
    switch (s.kind) {
      case "box":
        a = e.box(s.size);
        break;
      case "cylinder":
        a = e.cylinder(s.radius, s.height);
        break;
      case "sphere":
        a = e.sphere(s.radius);
        break;
      case "code": {
        const l = ne(e, de(s.program).shape);
        if (!l)
          throw new m("invalid-input", "Code produces no printable solid.");
        a = l;
        break;
      }
      case "extrusion": {
        const { distance: l, start: u, plane: h } = Ce(s, t);
        a = e.extrude(he(e, t.sketches[s.sketchId], t), l), u && (a = e.translate(a, [0, 0, u])), h === "XZ" ? a = q(e, a, [90, 0, 0]) : h === "YZ" && (a = q(e, a, [90, 0, 90]));
        break;
      }
      case "revolution": {
        const { plane: l, angle: u, axisOffset: h } = $e(s, t);
        let g = he(e, t.sketches[s.sketchId], t);
        h && (g = e.profile.translate(g, [-h, 0])), a = xe(e, g, u), l === "XY" ? a = q(e, a, [-90, 0, 0]) : l === "YZ" && (a = q(e, a, [0, 0, 90])), h && (a = e.translate(a, l === "YZ" ? [0, h, 0] : [h, 0, 0]));
        break;
      }
      case "mirror": {
        const { axis: l, offset: u } = Se(s, t), h = [0, 0, 0];
        if (h[l] = 1, a = e.mirror(H(e, t, s.source, r, o), h), u) {
          const g = [0, 0, 0];
          g[l] = 2 * u, a = e.translate(a, g);
        }
        break;
      }
      case "pattern": {
        const l = Ee(s, t), u = H(e, t, s.source, r, o), h = [u];
        if (l.mode === "linear")
          for (let g = 1; g < l.count; g++) {
            const w = [0, 0, 0];
            w[l.axis] = g * l.spacing, h.push(e.translate(u, w));
          }
        else {
          const g = l.sweep / (Math.abs(l.sweep) === 360 ? l.count : l.count - 1), w = [0, 0, 0];
          w[l.axis] = 1;
          for (let M = 1; M < l.count; M++)
            h.push(e.rotate(u, w, M * g, l.center));
        }
        a = e.union(h[0], ...h.slice(1));
        break;
      }
      case "boolean": {
        const l = s.inputs.map((u) => H(e, t, u, r, o));
        if (s.useHoleRoles) {
          const u = l.filter((w, M) => t.nodes[s.inputs[M]].role !== "hole"), h = l.filter((w, M) => t.nodes[s.inputs[M]].role === "hole");
          u.length || V("A combination of holes only has no solid to export.");
          const g = u.length > 1 ? e.union(u[0], ...u.slice(1)) : u[0];
          a = h.length ? e.subtract(g, ...h) : g;
        } else
          a = s.operation === "union" ? e.union(l[0], ...l.slice(1)) : s.operation === "subtract" ? e.subtract(l[0], ...l.slice(1)) : e.intersect(l[0], ...l.slice(1));
        break;
      }
      case "exact-feature": {
        const l = Ae(s, t), u = H(e, t, s.source, r, o);
        a = l.operation === "fillet" ? e.fillet(u, l.size, l.edges) : l.operation === "chamfer" ? e.chamfer(u, l.size, l.edges) : e.shell(u, l.size, l.openFaces);
        break;
      }
      case "mesh":
        return V(s.surface ? "Reference surfaces have no exact solid." : "Imported meshes have no exact B-rep; only bodies built from primitives, sketches, features and CAD Script can be exported or measured exactly.");
      default:
        return V(`'${s.kind}' has no exact lowering.`);
    }
    const { scale: c, rotation: f, position: p } = s.transform;
    c.some((l) => l !== 1) && (a = e.scale(a, c)), a = q(e, a, f), p.some((l) => l !== 0) && (a = e.translate(a, p));
  } catch (c) {
    if (c instanceof ue)
      throw c;
    const f = c instanceof m ? c.code : "invalid-input", p = c instanceof Error ? c.message : String(c);
    throw new ue({ code: f, bodyId: r, nodeId: n, feature: s.kind, message: `${s.name} (${s.kind}): ${p}` }, { cause: c });
  }
  return o.set(n, a), a;
}
function ut(e, t, n) {
  if (!t.roots.includes(n))
    throw new m("invalid-input", `${n} is not a top-level body.`);
  return H(e, t, n, n, /* @__PURE__ */ new Map());
}
function ft(e, t, n, r = {}) {
  const o = t.nodes[n];
  if (!o)
    throw new m("invalid-input", `${n} is not a node of this model.`);
  const i = r.local ? { ...t, nodes: { ...t.nodes, [n]: { ...o, transform: Te() } } } : t, s = t.roots.find((a) => a === n) ?? n;
  return H(e, i, n, s, /* @__PURE__ */ new Map());
}
const k = (e) => {
  const t = Math.round(e * 1e6) / 1e6;
  return Object.is(t, -0) ? 0 : t;
};
function pt(e, t) {
  const n = [], r = [], o = /* @__PURE__ */ new Map(), i = new Uint32Array(e.positions.length / 3);
  for (let a = 0; a < i.length; a++) {
    const c = k(e.positions[3 * a]), f = k(e.positions[3 * a + 1]), p = k(e.positions[3 * a + 2]), l = `${c},${f},${p}`;
    let u = o.get(l);
    u === void 0 && (u = n.length / 3, o.set(l, u), n.push(c, f, p)), i[a] = u;
  }
  const s = /* @__PURE__ */ new Map();
  for (let a = 0; a < e.indices.length; a += 3) {
    const c = i[e.indices[a]], f = i[e.indices[a + 1]], p = i[e.indices[a + 2]];
    if (!(c === f || f === p || p === c)) {
      r.push(c, f, p);
      for (const [l, u] of [[c, f], [f, p], [p, c]])
        s.set(`${l},${u}`, (s.get(`${l},${u}`) ?? 0) + 1);
    }
  }
  for (const [a, c] of s) {
    const [f, p] = a.split(",");
    if (c !== 1 || s.get(`${p},${f}`) !== 1)
      throw new m("kernel-failure", E`${t}: the exact tessellation is not a closed surface, so it cannot be displayed.`);
  }
  if (n.length > ze || r.length > Re)
    throw new m("unsupported", E`${t}: the exact display mesh exceeds 250000 vertices or 500000 triangles.`);
  if (r.length < 12)
    throw new m("kernel-failure", E`${t}: the exact result has no displayable solid.`);
  return { positions: n, indices: r };
}
function ht(e, t, n) {
  const r = t.nodes[n];
  if (r?.kind !== "exact-feature")
    throw new m("invalid-input", E`${n} is not an exact feature`);
  const o = ft(e, t, n, { local: !0 });
  if (!e.isValid(o))
    throw new m("kernel-failure", E`${r.name}: the exact result is not a valid closed solid.`);
  const i = pt(e.tessellate(o, _e), r.name);
  return { display: { sourceKey: De(t, n), ...i }, volume: e.volume(o) };
}
const G = 64, dt = 64 * 1024 * 1024;
function mt(e, t) {
  let n;
  if (t?.length) {
    n = [...new Set(t)];
    for (const r of n) {
      if (!e.roots.includes(r))
        throw new m("invalid-input", E`Unknown object id: ${r}`);
      const o = e.nodes[r];
      if (o.reference)
        throw new m("invalid-input", E`${o.name} is a reference body and is never exported or measured.`);
      if (o.role === "hole")
        throw new m("invalid-input", E`${o.name} is a hole body; combine it with a solid first.`);
    }
  } else
    n = e.roots.filter((r) => !e.nodes[r].reference && e.nodes[r].role !== "hole");
  if (!n.length)
    throw new m("invalid-input", E("The design has no solid bodies to export"));
  if (n.length > G)
    throw new m("invalid-input", E`Exact commands are limited to ${G} bodies.`);
  return n;
}
function gt(e) {
  const t = Object.freeze({ ...tt, smlib: e.version, licence: e.licence }), n = (r, o) => {
    const i = oe(r), s = mt(i, o);
    return { doc: i, targets: s, solids: s.map((a) => {
      const c = ut(e, i, a);
      if (!e.isValid(c))
        throw new m("kernel-failure", E`${i.nodes[a].name}: the exact result is not a valid closed solid.`);
      return c;
    }) };
  };
  return {
    kernel: e,
    info: t,
    measure(r, o) {
      return e.scope(() => {
        const { doc: i, targets: s, solids: a } = n(r, o);
        return { kernel: t, bodies: a.map((c, f) => {
          const p = e.bbox(c), l = e.massProperties(c);
          return { id: s[f], name: i.nodes[s[f]].name, volume: e.volume(c), area: e.area(c), bounds: { min: [...p.min], max: [...p.max] }, centroid: [...l.centroid], solids: e.solidCount(c) };
        }) };
      });
    },
    featureDisplays(r, o) {
      const i = oe(r), s = o?.length ? [...new Set(o)] : Ne(i);
      if (s.length > G)
        throw new m("invalid-input", E`Exact commands are limited to ${G} bodies.`);
      for (const a of s)
        if (i.nodes[a]?.kind !== "exact-feature")
          throw new m("invalid-input", E`${a} is not an exact feature`);
      return { kernel: t, features: s.map((a) => e.scope(() => ({ id: a, name: i.nodes[a].name, ...ht(e, i, a) }))) };
    },
    exportStep(r, o) {
      return e.scope(() => {
        const { doc: i, targets: s, solids: a } = n(r, o);
        let c = a[0];
        if (a.length > 1) {
          const l = a.reduce((u, h) => u + e.solidCount(h), 0);
          if (c = e.union(a[0], ...a.slice(1)), e.solidCount(c) !== l) {
            for (let u = 0; u < a.length; u++)
              for (let h = u + 1; h < a.length; h++)
                if (e.solidCount(e.union(a[u], a[h])) < e.solidCount(a[u]) + e.solidCount(a[h]))
                  throw new m("unsupported", E`${i.nodes[s[u]].name} and ${i.nodes[s[h]].name} touch or overlap, so one STEP file would merge them. Export them separately or combine them first.`);
            throw new m("unsupported", E("Selected bodies touch or overlap, so one STEP file would merge them. Export them separately or combine them first."));
          }
        }
        const f = e.exportStep(c), p = new TextEncoder().encode(f).byteLength;
        if (p > dt)
          throw new m("unsupported", E("The STEP file exceeds 64 MiB."));
        return { kernel: t, bodies: s.map((l) => ({ id: l, name: i.nodes[l].name })), step: f, bytes: p };
      });
    }
  };
}
let j;
function bt(e = {}) {
  return j ?? (j = We(e).then(gt, (t) => {
    throw j = void 0, t;
  })), j;
}
export {
  et as EXACT_KERNEL_ID,
  Qe as EXACT_KERNEL_PACKAGE,
  ke as EXACT_KERNEL_VERSION,
  m as ExactKernelError,
  ue as ExactLoweringError,
  G as MAX_EXACT_BODIES,
  le as MAX_POLYHEDRON_FACES,
  dt as MAX_STEP_BYTES,
  ie as MIN_EXACT_SEGMENTS,
  vt as cadScript,
  bt as createExactBackend,
  gt as createExactBackendFromKernel,
  pt as displayMesh,
  wt as evaluateCadScript,
  ht as exactFeatureDisplay,
  tt as exactKernelIdentity,
  mt as exactTargets,
  ne as lowerCodeShape,
  ut as lowerDocumentBody,
  ft as lowerDocumentNode,
  xe as revolveProfile,
  he as sketchProfile
};
