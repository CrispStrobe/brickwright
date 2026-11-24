var mt = Object.defineProperty;
var Mt = (f, t, o) => t in f ? mt(f, t, { enumerable: !0, configurable: !0, writable: !0, value: o }) : f[t] = o;
var _ = (f, t, o) => Mt(f, typeof t != "symbol" ? t + "" : t, o);
import { t as ht } from "./geometry.worker-CtjAoIMH.js";
const j = (f, t) => f[0] * t[0] + f[1] * t[1] + f[2] * t[2], $ = (f, t) => [f[0] - t[0], f[1] - t[1], f[2] - t[2]], G = (f, t) => j($(f, t), $(f, t));
function W(f, t, o, r) {
  const e = $(o, t), n = $(r, t), s = $(f, t), i = e[1] * n[2] - e[2] * n[1], c = e[2] * n[0] - e[0] * n[2], l = e[0] * n[1] - e[1] * n[0], a = i * i + c * c + l * l;
  if (a > 0) {
    const h = ((s[1] * n[2] - s[2] * n[1]) * i + (s[2] * n[0] - s[0] * n[2]) * c + (s[0] * n[1] - s[1] * n[0]) * l) / a, M = ((e[1] * s[2] - e[2] * s[1]) * i + (e[2] * s[0] - e[0] * s[2]) * c + (e[0] * s[1] - e[1] * s[0]) * l) / a;
    if (h >= 0 && M >= 0 && h + M <= 1)
      return [t[0] + h * e[0] + M * n[0], t[1] + h * e[1] + M * n[1], t[2] + h * e[2] + M * n[2]];
  }
  let u = t, d = 1 / 0;
  for (const [h, M] of [[t, o], [o, r], [r, t]]) {
    const m = $(M, h), g = j(m, m), y = g > 0 ? Math.max(0, Math.min(1, j($(f, h), m) / g)) : 0, x = [h[0] + y * m[0], h[1] + y * m[1], h[2] + y * m[2]], b = G(f, x);
    b < d && (u = x, d = b);
  }
  return u;
}
function gt(f, t, o, r) {
  const e = [t[0] - f[0], t[1] - f[1], t[2] - f[2]], n = [r[0] - o[0], r[1] - o[1], r[2] - o[2]], s = [f[0] - o[0], f[1] - o[1], f[2] - o[2]], i = e[0] ** 2 + e[1] ** 2 + e[2] ** 2, c = n[0] ** 2 + n[1] ** 2 + n[2] ** 2, l = n[0] * s[0] + n[1] * s[1] + n[2] * s[2];
  let a = 0, u = 0;
  if (i <= 1e-30 && c <= 1e-30)
    return [f, o];
  if (i <= 1e-30)
    u = Math.max(0, Math.min(1, l / c));
  else {
    const d = e[0] * s[0] + e[1] * s[1] + e[2] * s[2];
    if (c <= 1e-30)
      a = Math.max(0, Math.min(1, -d / i));
    else {
      const h = e[0] * n[0] + e[1] * n[1] + e[2] * n[2], M = i * c - h * h;
      M !== 0 && (a = Math.max(0, Math.min(1, (h * l - d * c) / M))), u = (h * a + l) / c, u < 0 ? (u = 0, a = Math.max(0, Math.min(1, -d / i))) : u > 1 && (u = 1, a = Math.max(0, Math.min(1, (h - d) / i)));
    }
  }
  return [
    [f[0] + e[0] * a, f[1] + e[1] * a, f[2] + e[2] * a],
    [o[0] + n[0] * u, o[1] + n[1] * u, o[2] + n[2] * u]
  ];
}
function et(f, t, o, r, e) {
  const n = [t[0] - f[0], t[1] - f[1], t[2] - f[2]], s = [r[0] - o[0], r[1] - o[1], r[2] - o[2]], i = [e[0] - o[0], e[1] - o[1], e[2] - o[2]], c = [n[1] * i[2] - n[2] * i[1], n[2] * i[0] - n[0] * i[2], n[0] * i[1] - n[1] * i[0]], l = s[0] * c[0] + s[1] * c[1] + s[2] * c[2], a = Math.hypot(...s), u = Math.hypot(...i), d = Math.hypot(...n);
  if (Math.abs(l) <= Number.EPSILON * 16 * a * u * d)
    return null;
  const h = 1 / l, M = [f[0] - o[0], f[1] - o[1], f[2] - o[2]], m = (M[0] * c[0] + M[1] * c[1] + M[2] * c[2]) * h;
  if (m < 0 || m > 1)
    return null;
  const g = [M[1] * s[2] - M[2] * s[1], M[2] * s[0] - M[0] * s[2], M[0] * s[1] - M[1] * s[0]], y = (n[0] * g[0] + n[1] * g[1] + n[2] * g[2]) * h, x = (i[0] * g[0] + i[1] * g[1] + i[2] * g[2]) * h;
  return y < 0 || m + y > 1 || x < 0 || x > 1 ? null : [f[0] + x * n[0], f[1] + x * n[1], f[2] + x * n[2]];
}
const st = 1e-12, yt = 1e-12, Y = 1e-9, xt = 1e-9, Z = 1e-7, bt = [
  [1, Math.SQRT2 - 1, (Math.sqrt(5) - 1) / 2],
  [(Math.sqrt(5) - 1) / 2, 1, Math.sqrt(3) - 1],
  [Math.SQRT2 - 1, Math.sqrt(3) - 1, 1]
], pt = 8;
function It(f, t, o) {
  return f >= t ? f >= o ? 0 : 2 : t >= o ? 1 : 2;
}
class dt {
  constructor(t, o) {
    /** Number of non-degenerate triangles indexed by the BVH. */
    _(this, "triangleCount");
    // Packed triangle vertices: 9 doubles per valid triangle (v0 v1 v2),
    // ordered by build slot. Cache-friendly at intersection time.
    _(this, "triVerts");
    // Build slot -> original triangle index in mesh.triangles.
    _(this, "srcIndex");
    // Permutation of build slots; leaves reference contiguous ranges of it.
    _(this, "triOrder");
    // Flat node storage. Node n: bounds[6n..6n+5] = minX minY minZ maxX maxY
    // maxZ; count[n] > 0 marks a leaf holding triOrder[start[n] ..
    // start[n]+count[n]); internal nodes have count 0, left child at n+1,
    // right child at rightChild[n].
    _(this, "bounds");
    _(this, "start");
    _(this, "count");
    _(this, "rightChild");
    _(this, "nodeCount", 0);
    // Reusable traversal stack shared by raycast/allHits. Queries are
    // synchronous and non-reentrant (pointInside -> allHits is sequential,
    // never nested), so a single per-instance buffer is safe and avoids a
    // fresh Int32Array allocation per query. Depth 128 covers any tree this
    // layout can produce (worst-case depth ~ 2*log2(n) << 128).
    _(this, "traversalStack", new Int32Array(128));
    // Set by intersectTri when a forward hit lies on a triangle edge or vertex.
    _(this, "grazed", !1);
    // Parallel stack of node ENTRY t (raycast only): lets a popped node be
    // discarded with one comparison when bestT shrank below its entry after
    // it was pushed.
    _(this, "traversalTStack", new Float64Array(128));
    _(this, "consumeBuildWork");
    this.consumeBuildWork = o ?? (() => {
    });
    const { vertices: r, triangles: e } = t, n = e.length / 3 | 0;
    o?.(n * 3);
    const s = new Float64Array(n * 9), i = new Int32Array(n);
    let c = 0;
    for (let d = 0; d < n; d++) {
      const h = e[3 * d] * 3, M = e[3 * d + 1] * 3, m = e[3 * d + 2] * 3, g = r[h], y = r[h + 1], x = r[h + 2], b = r[M], p = r[M + 1], I = r[M + 2], z = r[m], A = r[m + 1], T = r[m + 2], k = b - g, O = p - y, C = I - x, v = z - g, B = A - y, P = T - x, E = O * P - C * B, w = C * v - k * P, L = k * B - O * v;
      if (!(0.5 * Math.sqrt(E * E + w * w + L * L) >= yt))
        continue;
      const S = c * 9;
      s[S] = g, s[S + 1] = y, s[S + 2] = x, s[S + 3] = b, s[S + 4] = p, s[S + 5] = I, s[S + 6] = z, s[S + 7] = A, s[S + 8] = T, i[c] = d, c++;
    }
    this.triangleCount = c, this.triVerts = s.subarray(0, c * 9), this.srcIndex = i.subarray(0, c);
    const l = new Float64Array(c * 3);
    for (let d = 0; d < c; d++) {
      const h = d * 9;
      l[3 * d] = (s[h] + s[h + 3] + s[h + 6]) / 3, l[3 * d + 1] = (s[h + 1] + s[h + 4] + s[h + 7]) / 3, l[3 * d + 2] = (s[h + 2] + s[h + 5] + s[h + 8]) / 3;
    }
    const a = new Int32Array(c);
    for (let d = 0; d < c; d++)
      a[d] = d;
    this.triOrder = a;
    const u = Math.max(1, 2 * c);
    this.bounds = new Float64Array(u * 6), this.start = new Int32Array(u), this.count = new Int32Array(u), this.rightChild = new Int32Array(u), c > 0 ? this.buildNode(0, c, l) : (this.nodeCount = 1, this.bounds.set([1 / 0, 1 / 0, 1 / 0, -1 / 0, -1 / 0, -1 / 0], 0), this.count[0] = 0);
  }
  /** Vertex bounds and centroid bounds over triOrder[lo, hi). */
  computeNodeBounds(t, o, r) {
    let e = 1 / 0, n = 1 / 0, s = 1 / 0, i = -1 / 0, c = -1 / 0, l = -1 / 0, a = 1 / 0, u = 1 / 0, d = 1 / 0, h = -1 / 0, M = -1 / 0, m = -1 / 0;
    for (let g = t; g < o; g++) {
      this.consumeBuildWork();
      const y = this.triOrder[g], x = y * 9;
      for (let z = 0; z < 9; z += 3) {
        const A = this.triVerts[x + z], T = this.triVerts[x + z + 1], k = this.triVerts[x + z + 2];
        A < e && (e = A), A > i && (i = A), T < n && (n = T), T > c && (c = T), k < s && (s = k), k > l && (l = k);
      }
      const b = r[3 * y], p = r[3 * y + 1], I = r[3 * y + 2];
      b < a && (a = b), b > h && (h = b), p < u && (u = p), p > M && (M = p), I < d && (d = I), I > m && (m = I);
    }
    return { minX: e, minY: n, minZ: s, maxX: i, maxY: c, maxZ: l, cMinX: a, cMinY: u, cMinZ: d, cMaxX: h, cMaxY: M, cMaxZ: m };
  }
  /** Allocate and fill the subtree over triOrder[lo, hi). Returns the node
   *  index. Recursive at build time only (depth ~ log2(n / leafSize)). */
  buildNode(t, o, r) {
    this.consumeBuildWork();
    const e = this.nodeCount++, n = this.bounds, s = e * 6, i = this.computeNodeBounds(t, o, r);
    n[s] = i.minX, n[s + 1] = i.minY, n[s + 2] = i.minZ, n[s + 3] = i.maxX, n[s + 4] = i.maxY, n[s + 5] = i.maxZ;
    const c = o - t, l = i.cMaxX - i.cMinX, a = i.cMaxY - i.cMinY, u = i.cMaxZ - i.cMinZ;
    if (c <= pt || l <= 0 && a <= 0 && u <= 0)
      return this.start[e] = t, this.count[e] = c, e;
    const d = It(l, a, u), h = t + (c >> 1);
    return this.selectNth(t, o, h, d, r), this.count[e] = 0, this.buildNode(t, h, r), this.rightChild[e] = this.buildNode(h, o, r), e;
  }
  /** Hoare quickselect: partition triOrder[lo, hi) so the element at `nth`
   *  is in sorted position by centroid[axis]. O(n) expected per call. */
  selectNth(t, o, r, e, n) {
    const s = this.triOrder, i = (a) => (this.consumeBuildWork(), n[3 * s[a] + e]);
    let c = t, l = o - 1;
    for (; c < l; ) {
      const a = c + l >> 1, u = i(c), d = i(a), h = i(l), M = u < d ? d < h ? d : u < h ? h : u : u < h ? u : d < h ? h : d;
      let m = c, g = l;
      for (; m <= g; ) {
        for (; i(m) < M; )
          m++;
        for (; i(g) > M; )
          g--;
        if (m <= g) {
          const y = s[m];
          s[m] = s[g], s[g] = y, m++, g--;
        }
      }
      if (r <= g)
        l = g;
      else if (r >= m)
        c = m;
      else
        break;
    }
  }
  /** Möller–Trumbore against the packed triangle at build slot `s`.
   *  Returns t, or NaN on miss. Inclusive barycentric bounds (±1e-9) so
   *  exact edge/vertex piercings register. */
  intersectTri(t, o, r, e, n, s, i) {
    const c = this.triVerts, l = t * 9, a = c[l], u = c[l + 1], d = c[l + 2], h = c[l + 3] - a, M = c[l + 4] - u, m = c[l + 5] - d, g = c[l + 6] - a, y = c[l + 7] - u, x = c[l + 8] - d, b = s * x - i * y, p = i * g - n * x, I = n * y - s * g, z = h * b + M * p + m * I;
    if (z > -st && z < st)
      return NaN;
    const A = 1 / z, T = o - a, k = r - u, O = e - d, C = (T * b + k * p + O * I) * A;
    if (C < -Y || C > 1 + Y)
      return NaN;
    const v = k * m - O * M, B = O * h - T * m, P = T * M - k * h, E = (n * v + s * B + i * P) * A;
    if (E < -Y || C + E > 1 + Y)
      return NaN;
    const w = (g * v + y * B + x * P) * A;
    return w > 0 && (C < Z || E < Z || C + E > 1 - Z) && (this.grazed = !0), w;
  }
  /** Ray/AABB slab test for node `node` over the t interval [tMin, tMax].
   *  Returns the clipped ENTRY t (>= tMin) on overlap, Infinity on miss.
   *  NaN lanes (origin exactly on a slab plane with zero direction) drop
   *  out of the comparisons, which is conservative-correct. */
  nodeEnterT(t, o, r, e, n, s, i, c, l) {
    const a = this.bounds, u = t * 6;
    let d = c, h = l, M = (a[u] - o) * n, m = (a[u + 3] - o) * n;
    if (M > m) {
      const g = M;
      M = m, m = g;
    }
    if (M > d && (d = M), m < h && (h = m), d > h)
      return 1 / 0;
    if (M = (a[u + 1] - r) * s, m = (a[u + 4] - r) * s, M > m) {
      const g = M;
      M = m, m = g;
    }
    if (M > d && (d = M), m < h && (h = m), d > h)
      return 1 / 0;
    if (M = (a[u + 2] - e) * i, m = (a[u + 5] - e) * i, M > m) {
      const g = M;
      M = m, m = g;
    }
    return M > d && (d = M), m < h && (h = m), d <= h ? d : 1 / 0;
  }
  /** Tighten (bestT, bestTri) over the triangles of leaf `node`. */
  scanLeaf(t, o, r, e, n, s, i, c, l, a, u) {
    const d = this.start[t], h = this.count[t];
    for (let M = d; M < d + h; M++) {
      const m = this.triOrder[M];
      if (this.srcIndex[m] === u)
        continue;
      const g = this.intersectTri(m, o, r, e, n, s, i);
      g > c && g < l && (l = g, a = this.srcIndex[m]);
    }
    return { bestT: l, bestTri: a };
  }
  /** Push the two children of internal `node` with the FARTHER child first
   *  (so it is popped last) and return the updated stack pointer. */
  pushNodeChildren(t, o, r, e, n, s, i, c, l, a) {
    const u = this.traversalStack, d = this.traversalTStack;
    let h = t + 1, M = this.rightChild[t], m = this.nodeEnterT(h, o, r, e, n, s, i, c, l), g = this.nodeEnterT(M, o, r, e, n, s, i, c, l);
    if (g < m) {
      const y = h;
      h = M, M = y;
      const x = m;
      m = g, g = x;
    }
    return g < 1 / 0 && (u[a] = M, d[a] = g, a++), m < 1 / 0 && (u[a] = h, d[a] = m, a++), a;
  }
  /** Nearest hit with t > tMin (default 0), optionally skipping one source
   *  triangle (original-mesh index, e.g. the triangle a sample ray was
   *  launched from). Direction need not be normalized; t is in units of
   *  |dir|.
   *
   *  Traversal is near-child-first: at each internal node both children's
   *  entry t is computed and the FARTHER child is pushed first, so the
   *  nearer subtree is explored before the farther one and bestT shrinks as
   *  early as possible. Each stack slot carries its node's entry t; a
   *  popped node whose entry is already >= bestT is discarded with one
   *  comparison. */
  raycast(t, o, r) {
    if (this.triangleCount === 0)
      return null;
    const e = r?.tMin ?? 0, n = r?.skipTri ?? -1, [s, i, c] = t, [l, a, u] = o, d = 1 / l, h = 1 / a, M = 1 / u;
    let m = 1 / 0, g = -1;
    const y = this.traversalStack, x = this.traversalTStack;
    let b = 0;
    const p = this.nodeEnterT(0, s, i, c, d, h, M, e, 1 / 0);
    for (p < 1 / 0 && (y[0] = 0, x[0] = p, b = 1); b > 0; ) {
      if (b--, x[b] >= m)
        continue;
      const I = y[b];
      if (this.count[I] > 0) {
        const z = this.scanLeaf(I, s, i, c, l, a, u, e, m, g, n);
        m = z.bestT, g = z.bestTri;
      } else
        b = this.pushNodeChildren(I, s, i, c, d, h, M, e, m, b);
    }
    return g >= 0 ? { t: m, triIndex: g } : null;
  }
  /** Every hit along the ray with t > tMin, ascending t. Slab traversal
   *  with no early-out — every intersected leaf is visited. */
  allHits(t, o, r = 0) {
    if (this.triangleCount === 0)
      return [];
    const [e, n, s] = t, [i, c, l] = o, a = 1 / i, u = 1 / c, d = 1 / l, h = [], M = this.traversalStack;
    let m = 0;
    for (M[m++] = 0; m > 0; ) {
      const g = M[--m];
      if (this.nodeEnterT(g, e, n, s, a, u, d, r, 1 / 0) === 1 / 0)
        continue;
      const y = this.count[g];
      if (y > 0) {
        const x = this.start[g];
        for (let b = x; b < x + y; b++) {
          const p = this.triOrder[b], I = this.intersectTri(p, e, n, s, i, c, l);
          I > r && h.push({ t: I, triIndex: this.srcIndex[p] });
        }
      } else
        M[m++] = g + 1, M[m++] = this.rightChild[g];
    }
    return h.sort((g, y) => g.t - y.t), h;
  }
  /** Visit triangles intersecting an AABB, using the existing spatial tree.
   * Charge every visited node and leaf triangle, including rejected bounds.
   * Yield lazily so a collision caller can stop at its first blocker. */
  *overlappingTriangles(t, o) {
    if (this.triangleCount === 0)
      return;
    const r = [0];
    for (; r.length; ) {
      o();
      const e = r.pop(), n = e * 6;
      let s = !0;
      for (let i = 0; i < 3; i++)
        (this.bounds[n + i] > t.max[i] || this.bounds[n + i + 3] < t.min[i]) && (s = !1);
      if (s) {
        if (this.count[e] === 0) {
          r.push(e + 1, this.rightChild[e]);
          continue;
        }
        for (let i = this.start[e]; i < this.start[e] + this.count[e]; i++) {
          o();
          const c = this.triOrder[i], l = c * 9;
          let a = !0;
          for (let u = 0; u < 3; u++) {
            const d = this.triVerts[l + u], h = this.triVerts[l + 3 + u], M = this.triVerts[l + 6 + u];
            (Math.min(d, h, M) > t.max[u] || Math.max(d, h, M) < t.min[u]) && (a = !1);
          }
          a && (yield this.srcIndex[c]);
        }
      }
    }
  }
  /** Nearest point on any indexed triangle, pruned by point/AABB distance.
   * Empty/degenerate trees have no closest point. Ties use original index. */
  closestPoint(t) {
    if (!t.every(Number.isFinite))
      throw new Error("Closest-point query must be finite.");
    if (this.triangleCount === 0)
      return null;
    let o = 1 / 0, r = null;
    const e = this.traversalStack;
    let n = 0;
    for (e[n++] = 0; n > 0; ) {
      const s = e[--n];
      if (!(this.nodeDistanceSquared(s, t) > o))
        if (this.count[s] > 0) {
          const i = this.start[s] + this.count[s];
          for (let c = this.start[s]; c < i; c++) {
            const l = this.triOrder[c], a = l * 9, u = this.triVerts, d = W(t, [u[a], u[a + 1], u[a + 2]], [u[a + 3], u[a + 4], u[a + 5]], [u[a + 6], u[a + 7], u[a + 8]]), h = G(t, d);
            (h < o || h === o && this.srcIndex[l] < r.triIndex) && (o = h, r = { point: d, distance: Math.sqrt(h), triIndex: this.srcIndex[l] });
          }
        } else {
          const i = s + 1, c = this.rightChild[s], l = this.nodeDistanceSquared(i, t), a = this.nodeDistanceSquared(c, t), u = l <= a ? i : c, d = l <= a ? c : i;
          Math.max(l, a) <= o && (e[n++] = d), Math.min(l, a) <= o && (e[n++] = u);
        }
    }
    return r;
  }
  /** Closest surface points between two meshes, using node-pair AABB
   *  distance to prune triangle-pair work. */
  closestPoints(t) {
    if (this.triangleCount === 0 || t.triangleCount === 0)
      return null;
    const o = { best2: 1 / 0, best: null }, r = [[0, 0]];
    for (; r.length; ) {
      const [e, n] = r.pop();
      if (this.nodePairDistanceSquared(e, t, n) > o.best2)
        continue;
      const s = this.count[e] > 0, i = t.count[n] > 0;
      if (s && i) {
        if (this.refineClosestFromLeaves(t, e, n, o))
          return o.best;
      } else !s && (i || this.nodeExtentSquared(e) >= t.nodeExtentSquared(n)) ? r.push([e + 1, n], [this.rightChild[e], n]) : r.push([e, n + 1], [e, t.rightChild[n]]);
    }
    return o.best;
  }
  refineClosestFromLeaves(t, o, r, e) {
    const n = this.start[o] + this.count[o], s = t.start[r] + t.count[r];
    for (let i = this.start[o]; i < n; i++) {
      const c = this.triOrder[i], l = c * 9, a = [
        [this.triVerts[l], this.triVerts[l + 1], this.triVerts[l + 2]],
        [this.triVerts[l + 3], this.triVerts[l + 4], this.triVerts[l + 5]],
        [this.triVerts[l + 6], this.triVerts[l + 7], this.triVerts[l + 8]]
      ];
      for (let u = t.start[r]; u < s; u++) {
        const d = t.triOrder[u], h = d * 9, M = [
          [t.triVerts[h], t.triVerts[h + 1], t.triVerts[h + 2]],
          [t.triVerts[h + 3], t.triVerts[h + 4], t.triVerts[h + 5]],
          [t.triVerts[h + 6], t.triVerts[h + 7], t.triVerts[h + 8]]
        ];
        if (this.considerClosestTrianglePair(t, a, M, c, d, e))
          return !0;
      }
    }
    return !1;
  }
  considerClosestTrianglePair(t, o, r, e, n, s) {
    const i = (c, l) => {
      const a = G(c, l);
      a < s.best2 && (s.best2 = a, s.best = {
        pointA: c,
        pointB: l,
        distance: Math.sqrt(a),
        triIndexA: this.srcIndex[e],
        triIndexB: t.srcIndex[n]
      });
    };
    for (const c of o)
      i(c, W(c, r[0], r[1], r[2]));
    if (s.best2 === 0)
      return !0;
    for (const c of r)
      i(W(c, o[0], o[1], o[2]), c);
    if (s.best2 === 0)
      return !0;
    for (let c = 0; c < 3; c++)
      for (let l = 0; l < 3; l++) {
        const a = gt(o[c], o[(c + 1) % 3], r[l], r[(l + 1) % 3]);
        if (i(a[0], a[1]), s.best2 === 0)
          return !0;
      }
    for (let c = 0; c < 3; c++) {
      const l = et(o[c], o[(c + 1) % 3], r[0], r[1], r[2]);
      if (l && i(l, l), s.best2 === 0)
        return !0;
      const a = et(r[c], r[(c + 1) % 3], o[0], o[1], o[2]);
      if (a && i(a, a), s.best2 === 0)
        return !0;
    }
    return !1;
  }
  nodePairDistanceSquared(t, o, r) {
    let e = 0;
    for (let n = 0; n < 3; n++) {
      const s = Math.max(this.bounds[6 * t + n] - o.bounds[6 * r + n + 3], 0, o.bounds[6 * r + n] - this.bounds[6 * t + n + 3]);
      e += s * s;
    }
    return e;
  }
  nodeExtentSquared(t) {
    const o = t * 6, r = this.bounds[o + 3] - this.bounds[o], e = this.bounds[o + 4] - this.bounds[o + 1], n = this.bounds[o + 5] - this.bounds[o + 2];
    return r * r + e * e + n * n;
  }
  nodeDistanceSquared(t, o) {
    let r = 0;
    for (let e = 0; e < 3; e++) {
      const n = Math.max(this.bounds[6 * t + e] - o[e], 0, o[e] - this.bounds[6 * t + e + 3]);
      r += n * n;
    }
    return r;
  }
  /** Ray-parity inside test: odd number of surface crossings along the
   *  parity axis ⇒ inside. Welded watertight input (meshShapeForExport)
   *  makes parity reliable; grazing hits through shared edges/vertices are
   *  deduplicated by t (within 1e-9) before counting, since every incident
   *  triangle reports the same crossing.
   *
   *  The parity ray runs along the root-bounds axis with the SMALLEST
   *  extent (ties prefer x, then y): the infinite ray then pierces the
   *  fewest tree cells — a thin slab is probed through its thickness in a
   *  point-location-style descent instead of swept across its span. Axis
   *  choice is per-mesh deterministic, and parity is axis-invariant on
   *  watertight input.
   *
   *  A ray that meets a triangle on an edge or vertex gives no reliable
   *  parity: a ray in a face plane touches the neighbour faces on their
   *  shared edges and counts them as crossings. Such a query is repeated
   *  along the tilted PARITY_RETRY_DIRS and the first ray with no graze
   *  decides. If every ray grazes, the majority decides and a tie keeps the
   *  axis-ray answer. */
  pointInside(t) {
    if (this.triangleCount === 0)
      return !1;
    const o = this.bounds, r = o[3] - o[0], e = o[4] - o[1], n = o[5] - o[2], s = r <= e ? r <= n ? [1, 0, 0] : [0, 0, 1] : e <= n ? [0, 1, 0] : [0, 0, 1], i = this.rayParityInside(t, s);
    if (!this.grazed)
      return i;
    let c = i ? 1 : -1;
    for (const l of bt) {
      const a = this.rayParityInside(t, l);
      if (!this.grazed)
        return a;
      c += a ? 1 : -1;
    }
    return c === 0 ? i : c > 0;
  }
  /** Odd number of distinct forward crossings along `dir`. Leaves
   *  `this.grazed` set when a crossing lies on a triangle edge or vertex. */
  rayParityInside(t, o) {
    this.grazed = !1;
    const r = this.allHits(t, o, 0);
    let e = 0, n = -1 / 0;
    for (const s of r)
      s.t - n > xt && e++, n = s.t;
    return (e & 1) === 1;
  }
}
const X = 1e-4, it = 15e4, ot = 10, zt = 1e-12;
function wt(f, t, o, r, e, n) {
  const s = t[3 * o] * 3, i = t[3 * o + 1] * 3, c = t[3 * o + 2] * 3, l = f[i] - f[s], a = f[i + 1] - f[s + 1], u = f[i + 2] - f[s + 2], d = f[c] - f[s], h = f[c + 1] - f[s + 1], M = f[c + 2] - f[s + 2], m = a * M - u * h, g = u * d - l * M, y = l * h - a * d, x = Math.sqrt(m * m + g * g + y * y);
  return x > 0 ? (m * r + g * e + y * n) / x : 0;
}
function At(f, t, o) {
  const r = t[3 * o], e = t[3 * o + 1], n = t[3 * o + 2], s = r * 3, i = e * 3, c = n * 3, l = f[s], a = f[s + 1], u = f[s + 2], d = f[i] - l, h = f[i + 1] - a, M = f[i + 2] - u, m = f[c] - l, g = f[c + 1] - a, y = f[c + 2] - u;
  let x = h * y - M * g, b = M * m - d * y, p = d * g - h * m;
  const I = Math.sqrt(x * x + b * b + p * p);
  if (!(I / 2 >= zt))
    return;
  x /= I, b /= I, p /= I;
  const z = (l + f[i] + f[c]) / 3, A = (a + f[i + 1] + f[c + 1]) / 3, T = (u + f[i + 2] + f[c + 2]) / 3;
  return { va: r, vb: e, vc: n, nx: x, ny: b, nz: p, cx: z, cy: A, cz: T };
}
function St(f, t, o, r, e, n, s, i, c) {
  const l = f.t;
  if (l < o || l < e) {
    if (r !== void 0 && -wt(n, s, f.triIndex, t.nx, t.ny, t.nz) < r)
      return e;
    const a = X + l / 2, u = [t.cx - t.nx * a, t.cy - t.ny * a, t.cz - t.nz * a];
    if (!i.pointInside(u))
      return e;
    if (l < o && c.push({ t: l, location: [t.cx, t.cy, t.cz], va: t.va, vb: t.vb, vc: t.vc }), l < e)
      return l;
  }
  return e;
}
function Ct(f, t, o) {
  const r = o?.bvh ?? new dt(f), { vertices: e, triangles: n } = f, s = n.length / 3 | 0, i = s > it ? Math.ceil(s / it) : 1, c = o?.maxWedgeDeg !== void 0 ? Math.cos(o.maxWedgeDeg * Math.PI / 180) : void 0;
  let l = 0, a = 1 / 0;
  const u = [];
  for (let M = 0; M < s; M += i) {
    const m = At(e, n, M);
    if (m === void 0)
      continue;
    l++;
    const g = [
      m.cx - m.nx * X,
      m.cy - m.ny * X,
      m.cz - m.nz * X
    ], y = [-m.nx, -m.ny, -m.nz], x = r.raycast(g, y, { skipTri: M, tMin: X });
    x !== null && (a = St(x, m, t, c, a, e, n, r, u));
  }
  const { clusters: d, truncated: h } = Tt(u, t);
  return {
    violations: d,
    truncated: h,
    sampleCount: l,
    thinnestMm: a
  };
}
function Tt(f, t) {
  f.sort((l, a) => l.t - a.t);
  const o = 2 * t, r = o * o, e = [], n = [], s = (l) => {
    for (; n[l] !== l; )
      n[l] = n[n[l]], l = n[l];
    return l;
  }, i = /* @__PURE__ */ new Map();
  for (const l of f) {
    let a = -1;
    for (const u of [l.va, l.vb, l.vc]) {
      const d = i.get(u);
      if (d === void 0)
        continue;
      const h = s(d);
      if (a === -1 || h === a) {
        a = h;
        continue;
      }
      const M = Math.min(h, a), m = Math.max(h, a);
      n[m] = M, e[m].thicknessMm < e[M].thicknessMm && (e[M].thicknessMm = e[m].thicknessMm, e[M].location = e[m].location), e[M].sampleCount += e[m].sampleCount, a = M;
    }
    if (a === -1)
      for (let u = 0; u < e.length; u++) {
        const d = e[u].location, h = l.location[0] - d[0], M = l.location[1] - d[1], m = l.location[2] - d[2];
        if (h * h + M * M + m * m <= r) {
          a = s(u);
          break;
        }
      }
    a === -1 && (a = e.length, n.push(a), e.push({ thicknessMm: l.t, location: l.location, sampleCount: 0 })), e[a].sampleCount++, i.has(l.va) || i.set(l.va, a), i.has(l.vb) || i.set(l.vb, a), i.has(l.vc) || i.set(l.vc, a);
  }
  const c = e.filter((l, a) => s(a) === a);
  return {
    clusters: c.slice(0, ot),
    truncated: c.length > ot
  };
}
const kt = 0.1, Et = 8, Rt = 0.01;
function rt(f, t) {
  return Math.abs(f - t) <= Math.max(1, 0.01 * Math.max(f, t));
}
function _t(f, t) {
  return Math.abs(f - t) <= Math.max(0.1, 5e-3 * Math.max(f, t));
}
const Pt = Math.cos(0.5 * Math.PI / 180), Nt = Math.cos(1 * Math.PI / 180), K = 1e-12, U = 1e-9, Ot = 1e-9, vt = 256, ct = 36, Bt = 8, J = {
  "+z": { dir: [0, 0, 1], rows: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], rotation: { axis: [0, 0, 1], deg: 0, apply: "" } },
  "-z": { dir: [0, 0, -1], rows: [[1, 0, 0], [0, -1, 0], [0, 0, -1]], rotation: { axis: [1, 0, 0], deg: 180, apply: ".rotateX(180)" } },
  "+x": { dir: [1, 0, 0], rows: [[0, 0, -1], [0, 1, 0], [1, 0, 0]], rotation: { axis: [0, 1, 0], deg: -90, apply: ".rotateY(-90)" } },
  "-x": { dir: [-1, 0, 0], rows: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], rotation: { axis: [0, 1, 0], deg: 90, apply: ".rotateY(90)" } },
  "+y": { dir: [0, 1, 0], rows: [[1, 0, 0], [0, 0, -1], [0, 1, 0]], rotation: { axis: [1, 0, 0], deg: 90, apply: ".rotateX(90)" } },
  "-y": { dir: [0, -1, 0], rows: [[1, 0, 0], [0, 0, 1], [0, -1, 0]], rotation: { axis: [1, 0, 0], deg: -90, apply: ".rotateX(-90)" } }
}, Q = ["+z", "-z", "+x", "-x", "+y", "-y"];
function Dt(f) {
  for (const t of Q) {
    const o = J[t].dir;
    if (Math.abs(f[0] - o[0]) < 1e-9 && Math.abs(f[1] - o[1]) < 1e-9 && Math.abs(f[2] - o[2]) < 1e-9)
      return t;
  }
}
function Lt(f) {
  const t = Dt(f);
  if (t !== void 0) {
    const u = J[t];
    return { rows: u.rows, rotation: u.rotation, label: t };
  }
  const o = f[1], r = -f[0], e = Math.hypot(o, r), n = f[2], s = o / e, i = r / e, c = 1 - n, l = [
    [c * s * s + n, c * s * i, e * i],
    [c * s * i, c * i * i + n, -e * s],
    [-e * i, e * s, n]
  ], a = Math.atan2(e, n) * 180 / Math.PI;
  return {
    rows: l,
    rotation: { axis: [s, i, 0], deg: a, apply: `.rotate([${H(s)}, ${H(i)}, 0], ${H(a)})` }
  };
}
function H(f) {
  return Math.round(f * 1e6) / 1e6 + 0;
}
function Vt(f) {
  const { vertices: t, triangles: o } = f, r = o.length / 3 | 0, e = t.length / 3 | 0, n = new Float64Array(r * 3), s = new Float64Array(r);
  for (let a = 0; a < r; a++) {
    const u = o[3 * a] * 3, d = o[3 * a + 1] * 3, h = o[3 * a + 2] * 3, M = t[d] - t[u], m = t[d + 1] - t[u + 1], g = t[d + 2] - t[u + 2], y = t[h] - t[u], x = t[h + 1] - t[u + 1], b = t[h + 2] - t[u + 2], p = m * b - g * x, I = g * y - M * b, z = M * x - m * y, A = Math.hypot(p, I, z);
    s[a] = A / 2, A / 2 > K && (n[3 * a] = p / A, n[3 * a + 1] = I / A, n[3 * a + 2] = z / A);
  }
  const i = /* @__PURE__ */ new Map(), c = (a, u) => a < u ? a * e + u : u * e + a;
  for (let a = 0; a < r; a++)
    for (let u = 0; u < 3; u++) {
      const d = c(o[3 * a + u], o[3 * a + (u + 1) % 3]), h = i.get(d);
      h === void 0 ? i.set(d, [a]) : h.push(a);
    }
  const l = new Int32Array(r * 3).fill(-1);
  for (let a = 0; a < r; a++)
    for (let u = 0; u < 3; u++) {
      const d = i.get(c(o[3 * a + u], o[3 * a + (u + 1) % 3]));
      d.length === 2 && (l[3 * a + u] = d[0] === a ? d[1] : d[0]);
    }
  return { mesh: f, triCount: r, normals: n, areas: s, neighbors: l };
}
function Ft(f, t, o, r, e) {
  const n = new Float64Array(t), s = new Float64Array(t), i = new Float64Array(t);
  let c = 1 / 0, l = -1 / 0, a = 1 / 0, u = -1 / 0, d = 1 / 0, h = -1 / 0;
  for (let m = 0; m < t; m++) {
    const g = f[3 * m], y = f[3 * m + 1], x = f[3 * m + 2], b = o[0] * g + o[1] * y + o[2] * x, p = r[0] * g + r[1] * y + r[2] * x, I = e[0] * g + e[1] * y + e[2] * x;
    n[m] = b, s[m] = p, i[m] = I, b < c && (c = b), b > l && (l = b), p < a && (a = p), p > u && (u = p), I < d && (d = I), I > h && (h = I);
  }
  t === 0 && (c = l = a = u = d = h = 0);
  const M = { x: l - c, y: u - a, z: h - d };
  return { pu: n, pv: s, pw: i, wMin: d, sizeMm: M };
}
function $t(f, t, o, r, e, n, s, i) {
  const c = new Uint8Array(t), l = new Uint8Array(t);
  let a = 0;
  const u = [];
  for (let d = 0; d < t; d++) {
    if (o[d] <= K)
      continue;
    const h = n(d), M = f[3 * d], m = f[3 * d + 1], g = f[3 * d + 2];
    if (h > Pt && s(M) && s(m) && s(g)) {
      c[d] = 1, a += o[d], u.push(r[M], e[M], r[m], e[m], r[g], e[g]);
      continue;
    }
    h > i && (l[d] = 1);
  }
  return { isBed: c, isSteep: l, contactArea: a, contactPts: u };
}
function Xt(f, t, o, r, e, n) {
  const s = new Array(o * 2);
  for (let h = 0; h < o; h++)
    s[2 * h] = f[h], s[2 * h + 1] = t[h];
  const i = Jt(ft(s)), c = ft(e), l = r > 0 ? tn(c) : 0, a = i > K ? r / i : 0, u = l > 0 ? n / l : 1 / 0;
  return { bedContact: { areaMm2: r, footprintMm2: i, ratio: a, minBaseMm: l, heightMm: n, tipRatio: u }, ratio: a, tipRatio: u };
}
function Yt(f, t, o, r, e) {
  let n = 0;
  for (let s = 0; s < f; s++) {
    if (!t[s] || r[s] !== -1)
      continue;
    const i = [s];
    r[s] = n;
    for (let c = 0; c < i.length; c++) {
      const l = i[c];
      for (let a = 0; a < 3; a++) {
        const u = o[3 * l + a];
        u >= 0 && t[u] && r[u] === -1 && (r[u] = n, i.push(u));
      }
    }
    e(i, n), n++;
  }
}
function qt(f, t, o, r) {
  const { T: e, V: n, rw: s, isBed: i, onBed: c } = f;
  if (c(t) && c(o))
    return !0;
  if (r < 0)
    return !1;
  if (i[r])
    return !0;
  const l = e[3 * r], a = e[3 * r + 1], u = e[3 * r + 2], d = l !== t && l !== o ? l : a !== t && a !== o ? a : u, h = n[3 * o] - n[3 * t], M = n[3 * o + 1] - n[3 * t + 1], m = n[3 * o + 2] - n[3 * t + 2], g = Math.hypot(h, M, m);
  if (g <= 0)
    return !1;
  const y = n[3 * d] - n[3 * t], x = n[3 * d + 1] - n[3 * t + 1], b = n[3 * d + 2] - n[3 * t + 2], p = (y * h + x * M + b * m) / (g * g), I = y - p * h, z = x - p * M, A = b - p * m, T = Math.hypot(I, z, A), k = I * s[0] + z * s[1] + A * s[2];
  return T > 0 && k < -1e-3 * T;
}
function Wt(f, t, o) {
  const { mesh: r, T: e, V: n, areas: s, pu: i, pv: c, pw: l, wMin: a, neighbors: u, regionOf: d, settings: h, downOf: M } = f;
  let m = 0, g = 0, y = 0, x = !0;
  const b = /* @__PURE__ */ new Map(), p = [1 / 0, 1 / 0, 1 / 0], I = [-1 / 0, -1 / 0, -1 / 0], z = [], A = [], T = Math.max(1, Math.ceil(t.length * 4 / vt));
  t.forEach((w, L) => {
    m += s[w];
    const V = M(w);
    V > g && (g = V), V < Nt && (x = !1);
    const S = r.faceOfTri[w];
    b.set(S, (b.get(S) ?? 0) + s[w]);
    const R = [e[3 * w], e[3 * w + 1], e[3 * w + 2]];
    for (const N of R) {
      l[N] - a > y && (y = l[N] - a);
      for (let D = 0; D < 3; D++) {
        const F = n[3 * N + D];
        F < p[D] && (p[D] = F), F > I[D] && (I[D] = F);
      }
    }
    const tt = (i[R[0]] + i[R[1]] + i[R[2]]) / 3, nt = (c[R[0]] + c[R[1]] + c[R[2]]) / 3;
    if (L % T === 0) {
      A.push(tt, nt);
      for (const N of R)
        A.push(0.75 * i[N] + 0.25 * tt, 0.75 * c[N] + 0.25 * nt);
    }
    for (let N = 0; N < 3; N++) {
      const D = u[3 * w + N];
      if (D >= 0 && d[D] === o)
        continue;
      const F = R[N], q = R[(N + 1) % 3];
      z.push({ ax: i[F], ay: c[F], bx: i[q], by: c[q], anchored: qt(f, F, q, D) });
    }
  });
  let k, O = -1;
  for (const [w, L] of [...b.entries()].sort((V, S) => V[0] - S[0]))
    L > O && (O = L, k = r.faceRefs[w]);
  const C = {
    status: "unsupported",
    areaMm2: m,
    maxOverhangDeg: Math.asin(Math.min(1, g)) * 180 / Math.PI,
    horizontal: x,
    bboxMin: p,
    bboxMax: I,
    ...k !== void 0 ? { faceRef: k } : {}
  }, v = z.filter((w) => w.anchored);
  if (v.length === 0)
    return C.reachMm = 1 / 0, C;
  if (y <= h.nozzleMm + U)
    return C.status = "first-layer", C;
  const B = jt(A, z, v);
  if (Number.isFinite(B))
    return C.spanMm = B, C.status = B <= h.maxBridgeMm + Ot ? "bridged" : "unsupported", C;
  const P = A.slice();
  for (const w of z)
    w.anchored || P.push(w.ax, w.ay, w.bx, w.by);
  let E = 0;
  for (let w = 0; w < P.length; w += 2)
    E = Math.max(E, Kt(P[w], P[w + 1], v));
  return C.reachMm = E, C.status = E <= h.nozzleMm + U ? "short-reach" : "unsupported", C;
}
function Zt(f, t, o) {
  const { mesh: r, triCount: e, normals: n, areas: s, neighbors: i } = f, c = r.vertices, l = r.triangles, a = c.length / 3 | 0, u = Lt(t), [d, h, M] = u.rows, { pu: m, pv: g, pw: y, wMin: x, sizeMm: b } = Ft(c, a, d, h, M), p = (S) => y[S] - x <= Rt, I = Math.sin(o.maxOverhangDeg * Math.PI / 180) + U, z = (S) => -(n[3 * S] * M[0] + n[3 * S + 1] * M[1] + n[3 * S + 2] * M[2]), { isBed: A, isSteep: T, contactArea: k, contactPts: O } = $t(l, e, s, m, g, z, p, I), { bedContact: C, ratio: v, tipRatio: B } = Xt(m, g, a, k, O, b.z), P = new Int32Array(e).fill(-1), E = [], w = {
    mesh: r,
    T: l,
    V: c,
    areas: s,
    pu: m,
    pv: g,
    pw: y,
    wMin: x,
    neighbors: i,
    regionOf: P,
    rw: M,
    isBed: A,
    settings: o,
    downOf: z,
    onBed: p
  };
  Yt(e, T, i, P, (S, R) => {
    E.push(Wt(w, S, R));
  }), E.sort((S, R) => R.areaMm2 - S.areaMm2);
  const L = E.filter((S) => S.status === "unsupported").reduce((S, R) => S + R.areaMm2, 0), V = !(b.x > o.bedSizeMm.x || b.y > o.bedSizeMm.y || b.z > o.bedSizeMm.z);
  return {
    buildDirection: [...t],
    ...u.label !== void 0 ? { label: u.label } : {},
    rotation: u.rotation,
    sizeMm: b,
    fitsBed: V,
    unsupportedAreaMm2: L,
    overhangs: E,
    bedContact: C,
    bedContactLow: v < kt,
    tipRisk: k > 0 && B > Et
  };
}
function Ht(f, t) {
  const o = Q.map((e) => Zt(f, J[e].dir, t)), r = new Map(Q.map((e, n) => [e, n]));
  return o.slice().sort((e, n) => {
    if (e.fitsBed !== n.fitsBed)
      return e.fitsBed ? -1 : 1;
    const s = e.unsupportedAreaMm2, i = n.unsupportedAreaMm2;
    return rt(s, i) ? e.bedContactLow !== n.bedContactLow ? e.bedContactLow ? 1 : -1 : _t(e.sizeMm.z, n.sizeMm.z) ? rt(e.bedContact.areaMm2, n.bedContact.areaMm2) ? r.get(e.label) - r.get(n.label) : n.bedContact.areaMm2 - e.bedContact.areaMm2 : e.sizeMm.z - n.sizeMm.z : s - i;
  });
}
function jt(f, t, o) {
  const r = [];
  for (let i = 0; i < ct; i++)
    r.push(i * Math.PI / ct);
  const e = o.map((i) => ({ s: i, len: Math.hypot(i.bx - i.ax, i.by - i.ay) })).sort((i, c) => c.len - i.len).slice(0, Bt);
  for (const { s: i } of e) {
    let c = Math.atan2(i.by - i.ay, i.bx - i.ax) + Math.PI / 2;
    c = (c % Math.PI + Math.PI) % Math.PI, r.push(c);
  }
  const n = [...new Set(r.map((i) => Math.round(i * 1e9) / 1e9))].sort((i, c) => i - c);
  let s = 1 / 0;
  for (const i of n) {
    const c = Math.cos(i), l = Math.sin(i);
    let a = 0, u = !0;
    for (let d = 0; d < f.length && u; d += 2) {
      const h = Qt(f[d], f[d + 1], c, l, t);
      h === void 0 ? u = !1 : h > a && (a = h, a >= s && (u = !1));
    }
    u && (s = a);
  }
  return s;
}
function Gt(f, t, o, r, e) {
  const n = [];
  for (const s of e) {
    const i = s.bx - s.ax, c = s.by - s.ay, l = o * c - r * i;
    if (Math.abs(l) < 1e-12)
      continue;
    const a = s.ax - f, u = s.ay - t, d = (a * c - u * i) / l, h = (a * r - u * o) / l;
    h < -1e-9 || h > 1 + 1e-9 || n.push({ t: d, anchored: s.anchored });
  }
  return n;
}
function at(f, t, o) {
  return f === void 0 || t < f.t - 1e-7 ? { t, anchored: o } : t <= f.t + 1e-7 ? { t: f.t, anchored: f.anchored && o } : f;
}
function Ut(f) {
  let t, o;
  for (const r of f)
    r.t > 1e-9 ? t = at(t, r.t, r.anchored) : r.t < -1e-9 && (o = at(o, -r.t, r.anchored));
  return { fwd: t, back: o };
}
function Qt(f, t, o, r, e) {
  const n = Gt(f, t, o, r, e), { fwd: s, back: i } = Ut(n);
  if (!(s === void 0 || i === void 0) && !(!s.anchored || !i.anchored))
    return s.t + i.t;
}
function Kt(f, t, o) {
  let r = 1 / 0;
  for (const e of o) {
    const n = e.bx - e.ax, s = e.by - e.ay, i = n * n + s * s;
    let c = i > 0 ? ((f - e.ax) * n + (t - e.ay) * s) / i : 0;
    c = Math.max(0, Math.min(1, c));
    const l = Math.hypot(f - (e.ax + c * n), t - (e.ay + c * s));
    l < r && (r = l);
  }
  return r;
}
function ft(f) {
  const t = [];
  for (let n = 0; n + 1 < f.length; n += 2)
    t.push([f[n], f[n + 1]]);
  if (t.sort((n, s) => n[0] - s[0] || n[1] - s[1]), t.length < 3)
    return t.flat();
  const o = (n, s, i) => (s[0] - n[0]) * (i[1] - n[1]) - (s[1] - n[1]) * (i[0] - n[0]), r = [];
  for (const n of t) {
    for (; r.length >= 2 && o(r[r.length - 2], r[r.length - 1], n) <= 1e-12; )
      r.pop();
    r.push(n);
  }
  const e = [];
  for (let n = t.length - 1; n >= 0; n--) {
    const s = t[n];
    for (; e.length >= 2 && o(e[e.length - 2], e[e.length - 1], s) <= 1e-12; )
      e.pop();
    e.push(s);
  }
  return [...r.slice(0, -1), ...e.slice(0, -1)].flat();
}
function Jt(f) {
  let t = 0;
  const o = f.length / 2;
  for (let r = 0; r < o; r++) {
    const e = (r + 1) % o;
    t += f[2 * r] * f[2 * e + 1] - f[2 * e] * f[2 * r + 1];
  }
  return Math.abs(t) / 2;
}
function tn(f) {
  const t = f.length / 2;
  if (t < 3)
    return 0;
  let o = 1 / 0;
  for (let r = 0; r < t; r++) {
    const e = (r + 1) % t, n = f[2 * e] - f[2 * r], s = f[2 * e + 1] - f[2 * r + 1], i = Math.hypot(n, s);
    if (i <= 0)
      continue;
    let c = 0;
    for (let l = 0; l < t; l++) {
      const a = Math.abs((f[2 * l] - f[2 * r]) * s - (f[2 * l + 1] - f[2 * r + 1]) * n) / i;
      a > c && (c = a);
    }
    c < o && (o = c);
  }
  return Number.isFinite(o) ? o : 0;
}
const nn = 1, lt = Object.freeze({
  nozzleMm: 0.4,
  maxOverhangDeg: 45,
  maxBridgeMm: 10,
  minWallMm: 0.8,
  bedSizeMm: Object.freeze({ x: 220, y: 220, z: 250 })
}), ut = 5e5, en = 10;
function sn(f) {
  const t = /* @__PURE__ */ new Map(), o = new Int32Array(f.positions.length / 3), r = [];
  for (let e = 0; e < o.length; e++) {
    const n = f.positions[3 * e], s = f.positions[3 * e + 1], i = f.positions[3 * e + 2], c = `${n},${s},${i}`;
    let l = t.get(c);
    l === void 0 && (l = r.length / 3, r.push(n, s, i), t.set(c, l)), o[e] = l;
  }
  return { vertices: r, triangles: Array.from(f.indices, (e) => o[e]) };
}
function on(f) {
  const t = /* @__PURE__ */ new Map();
  let o = 0;
  for (let n = 0; n < f.triangles.length; n += 3) {
    const s = [f.triangles[n], f.triangles[n + 1], f.triangles[n + 2]];
    if (s[0] === s[1] || s[1] === s[2] || s[2] === s[0]) {
      o++;
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const c = s[i], l = s[(i + 1) % 3], a = c < l ? `${c},${l}` : `${l},${c}`, u = t.get(a) ?? [0, 0];
      u[c < l ? 0 : 1]++, t.set(a, u);
    }
  }
  let r = 0, e = 0;
  for (const [n, s] of t.values())
    n + s === 1 ? r++ : (n !== 1 || s !== 1) && e++;
  return { watertight: r === 0 && e === 0 && o === 0, openEdges: r, nonManifoldEdges: e, degenerateTriangles: o };
}
function rn(f) {
  return {
    ...f.label !== void 0 ? { label: f.label } : {},
    buildDirection: f.buildDirection,
    rotation: { axis: f.rotation.axis, deg: f.rotation.deg },
    sizeMm: f.sizeMm,
    fitsBed: f.fitsBed,
    unsupportedAreaMm2: f.unsupportedAreaMm2,
    overhangRegions: f.overhangs.length,
    overhangs: f.overhangs.slice(0, en).map(({ status: t, areaMm2: o, maxOverhangDeg: r, spanMm: e, reachMm: n, bboxMin: s, bboxMax: i }) => ({ status: t, areaMm2: o, maxOverhangDeg: r, ...e !== void 0 ? { spanMm: e } : {}, ...n !== void 0 && Number.isFinite(n) ? { reachMm: n } : {}, bboxMin: s, bboxMax: i })),
    bedContactMm2: f.bedContact.areaMm2,
    bedContactLow: f.bedContactLow,
    tipRisk: f.tipRisk
  };
}
function cn(f) {
  const t = { ...lt, ...f, bedSizeMm: { ...lt.bedSizeMm, ...f.bedSizeMm } };
  if ([t.nozzleMm, t.maxBridgeMm, t.minWallMm, t.bedSizeMm.x, t.bedSizeMm.y, t.bedSizeMm.z].some((r) => !Number.isFinite(r) || r <= 0 || r > 1e5) || !Number.isFinite(t.maxOverhangDeg) || t.maxOverhangDeg <= 0 || t.maxOverhangDeg >= 90)
    throw new RangeError(ht("Printability settings must be finite positive millimetres and an overhang angle between 0 and 90 degrees"));
  return t;
}
function ln(f, t = {}) {
  const o = cn(t), r = f.filter((i) => !i.reference && !i.hole && i.indices.length > 0), e = r.reduce((i, c) => i + c.indices.length / 3, 0);
  if (e > ut)
    throw new RangeError(ht`Printability check is limited to ${ut} triangles; the design has ${e}`);
  const n = [], s = r.map((i) => {
    const c = sn(i), l = on(c), a = Ct(c, o.minWallMm, { bvh: new dt(c) }), u = {
      id: i.id,
      name: i.name,
      triangles: c.triangles.length / 3,
      topology: l,
      minWall: { thresholdMm: o.minWallMm, thinnestMm: Number.isFinite(a.thinnestMm) ? a.thinnestMm : null, violations: a.violations, truncated: a.truncated, sampleCount: a.sampleCount }
    };
    if (!l.watertight)
      n.push(`${i.name}: mesh is not watertight (${l.openEdges} open, ${l.nonManifoldEdges} non-manifold edges)`);
    else {
      const d = c.triangles.length / 3, h = Vt({ vertices: c.vertices, triangles: c.triangles, faceOfTri: Array.from({ length: d }, (g, y) => y), faceRefs: [] }), M = Ht(h, o).map(rn);
      u.orientations = M, u.current = M.find((g) => g.label === "+z");
      const m = M[0];
      m.fitsBed ? m.unsupportedAreaMm2 > 0 && n.push(`${i.name}: needs support in every axis orientation (best ${m.label}: ${m.unsupportedAreaMm2.toFixed(1)} mm² unsupported)`) : n.push(`${i.name}: does not fit the ${o.bedSizeMm.x}×${o.bedSizeMm.y}×${o.bedSizeMm.z} mm bed in any axis orientation`), u.current && m.label !== "+z" && u.current.unsupportedAreaMm2 > m.unsupportedAreaMm2 && n.push(`${i.name}: printing with ${m.label} up reduces unsupported area`);
    }
    return a.violations.length && n.push(`${i.name}: walls thinner than ${o.minWallMm} mm (thinnest ${a.thinnestMm.toFixed(2)} mm)`), u;
  });
  return { version: nn, settings: o, bodies: s, issues: n, disclaimer: "Sampled engineering screening of the tessellated mesh, not a guarantee of a successful print." };
}
export {
  lt as DEFAULT_PRINTABILITY_SETTINGS,
  nn as PRINTABILITY_CHECK_VERSION,
  on as checkMeshTopology,
  ln as checkPrintability
};
