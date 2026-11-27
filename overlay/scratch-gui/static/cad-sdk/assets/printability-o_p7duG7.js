var gt = Object.defineProperty;
var yt = (l, t, o) => t in l ? gt(l, t, { enumerable: !0, configurable: !0, writable: !0, value: o }) : l[t] = o;
var R = (l, t, o) => yt(l, typeof t != "symbol" ? t + "" : t, o);
import { t as ht } from "./geometry.worker-Diqo6bgU.js";
const j = (l, t) => l[0] * t[0] + l[1] * t[1] + l[2] * t[2], $ = (l, t) => [l[0] - t[0], l[1] - t[1], l[2] - t[2]], G = (l, t) => j($(l, t), $(l, t));
function W(l, t, o, r) {
  const e = $(o, t), n = $(r, t), s = $(l, t), i = e[1] * n[2] - e[2] * n[1], c = e[2] * n[0] - e[0] * n[2], f = e[0] * n[1] - e[1] * n[0], a = i * i + c * c + f * f;
  if (a > 0) {
    const h = ((s[1] * n[2] - s[2] * n[1]) * i + (s[2] * n[0] - s[0] * n[2]) * c + (s[0] * n[1] - s[1] * n[0]) * f) / a, M = ((e[1] * s[2] - e[2] * s[1]) * i + (e[2] * s[0] - e[0] * s[2]) * c + (e[0] * s[1] - e[1] * s[0]) * f) / a;
    if (h >= 0 && M >= 0 && h + M <= 1)
      return [t[0] + h * e[0] + M * n[0], t[1] + h * e[1] + M * n[1], t[2] + h * e[2] + M * n[2]];
  }
  let u = t, d = 1 / 0;
  for (const [h, M] of [[t, o], [o, r], [r, t]]) {
    const m = $(M, h), g = j(m, m), y = g > 0 ? Math.max(0, Math.min(1, j($(l, h), m) / g)) : 0, x = [h[0] + y * m[0], h[1] + y * m[1], h[2] + y * m[2]], b = G(l, x);
    b < d && (u = x, d = b);
  }
  return u;
}
function xt(l, t, o, r) {
  const e = [t[0] - l[0], t[1] - l[1], t[2] - l[2]], n = [r[0] - o[0], r[1] - o[1], r[2] - o[2]], s = [l[0] - o[0], l[1] - o[1], l[2] - o[2]], i = e[0] ** 2 + e[1] ** 2 + e[2] ** 2, c = n[0] ** 2 + n[1] ** 2 + n[2] ** 2, f = n[0] * s[0] + n[1] * s[1] + n[2] * s[2];
  let a = 0, u = 0;
  if (i <= 1e-30 && c <= 1e-30)
    return [l, o];
  if (i <= 1e-30)
    u = Math.max(0, Math.min(1, f / c));
  else {
    const d = e[0] * s[0] + e[1] * s[1] + e[2] * s[2];
    if (c <= 1e-30)
      a = Math.max(0, Math.min(1, -d / i));
    else {
      const h = e[0] * n[0] + e[1] * n[1] + e[2] * n[2], M = i * c - h * h;
      M !== 0 && (a = Math.max(0, Math.min(1, (h * f - d * c) / M))), u = (h * a + f) / c, u < 0 ? (u = 0, a = Math.max(0, Math.min(1, -d / i))) : u > 1 && (u = 1, a = Math.max(0, Math.min(1, (h - d) / i)));
    }
  }
  return [
    [l[0] + e[0] * a, l[1] + e[1] * a, l[2] + e[2] * a],
    [o[0] + n[0] * u, o[1] + n[1] * u, o[2] + n[2] * u]
  ];
}
function st(l, t, o, r, e) {
  const n = [t[0] - l[0], t[1] - l[1], t[2] - l[2]], s = [r[0] - o[0], r[1] - o[1], r[2] - o[2]], i = [e[0] - o[0], e[1] - o[1], e[2] - o[2]], c = [n[1] * i[2] - n[2] * i[1], n[2] * i[0] - n[0] * i[2], n[0] * i[1] - n[1] * i[0]], f = s[0] * c[0] + s[1] * c[1] + s[2] * c[2], a = Math.hypot(...s), u = Math.hypot(...i), d = Math.hypot(...n);
  if (Math.abs(f) <= Number.EPSILON * 16 * a * u * d)
    return null;
  const h = 1 / f, M = [l[0] - o[0], l[1] - o[1], l[2] - o[2]], m = (M[0] * c[0] + M[1] * c[1] + M[2] * c[2]) * h;
  if (m < 0 || m > 1)
    return null;
  const g = [M[1] * s[2] - M[2] * s[1], M[2] * s[0] - M[0] * s[2], M[0] * s[1] - M[1] * s[0]], y = (n[0] * g[0] + n[1] * g[1] + n[2] * g[2]) * h, x = (i[0] * g[0] + i[1] * g[1] + i[2] * g[2]) * h;
  return y < 0 || m + y > 1 || x < 0 || x > 1 ? null : [l[0] + x * n[0], l[1] + x * n[1], l[2] + x * n[2]];
}
const it = 1e-12, bt = 1e-12, Y = 1e-9, It = 1e-9, H = 1e-7, pt = [
  [1, Math.SQRT2 - 1, (Math.sqrt(5) - 1) / 2],
  [(Math.sqrt(5) - 1) / 2, 1, Math.sqrt(3) - 1],
  [Math.SQRT2 - 1, Math.sqrt(3) - 1, 1]
], zt = 8;
function wt(l, t, o) {
  return l >= t ? l >= o ? 0 : 2 : t >= o ? 1 : 2;
}
class dt {
  constructor(t, o) {
    /** Number of non-degenerate triangles indexed by the BVH. */
    R(this, "triangleCount");
    // Packed triangle vertices: 9 doubles per valid triangle (v0 v1 v2),
    // ordered by build slot. Cache-friendly at intersection time.
    R(this, "triVerts");
    // Build slot -> original triangle index in mesh.triangles.
    R(this, "srcIndex");
    // Permutation of build slots; leaves reference contiguous ranges of it.
    R(this, "triOrder");
    // Flat node storage. Node n: bounds[6n..6n+5] = minX minY minZ maxX maxY
    // maxZ; count[n] > 0 marks a leaf holding triOrder[start[n] ..
    // start[n]+count[n]); internal nodes have count 0, left child at n+1,
    // right child at rightChild[n].
    R(this, "bounds");
    R(this, "start");
    R(this, "count");
    R(this, "rightChild");
    R(this, "nodeCount", 0);
    // Reusable traversal stack shared by raycast/allHits. Queries are
    // synchronous and non-reentrant (pointInside -> allHits is sequential,
    // never nested), so a single per-instance buffer is safe and avoids a
    // fresh Int32Array allocation per query. Depth 128 covers any tree this
    // layout can produce (worst-case depth ~ 2*log2(n) << 128).
    R(this, "traversalStack", new Int32Array(128));
    // Set by intersectTri when a forward hit lies on a triangle edge or vertex.
    R(this, "grazed", !1);
    // Parallel stack of node ENTRY t (raycast only): lets a popped node be
    // discarded with one comparison when bestT shrank below its entry after
    // it was pushed.
    R(this, "traversalTStack", new Float64Array(128));
    R(this, "consumeBuildWork");
    this.consumeBuildWork = o ?? (() => {
    });
    const { vertices: r, triangles: e } = t, n = e.length / 3 | 0;
    o?.(n * 3);
    const s = new Float64Array(n * 9), i = new Int32Array(n);
    let c = 0;
    for (let d = 0; d < n; d++) {
      const h = e[3 * d] * 3, M = e[3 * d + 1] * 3, m = e[3 * d + 2] * 3, g = r[h], y = r[h + 1], x = r[h + 2], b = r[M], I = r[M + 1], p = r[M + 2], z = r[m], A = r[m + 1], C = r[m + 2], E = b - g, O = I - y, T = p - x, v = z - g, B = A - y, P = C - x, k = O * P - T * B, w = T * v - E * P, D = E * B - O * v;
      if (!(0.5 * Math.sqrt(k * k + w * w + D * D) >= bt))
        continue;
      const S = c * 9;
      s[S] = g, s[S + 1] = y, s[S + 2] = x, s[S + 3] = b, s[S + 4] = I, s[S + 5] = p, s[S + 6] = z, s[S + 7] = A, s[S + 8] = C, i[c] = d, c++;
    }
    this.triangleCount = c, this.triVerts = s.subarray(0, c * 9), this.srcIndex = i.subarray(0, c);
    const f = new Float64Array(c * 3);
    for (let d = 0; d < c; d++) {
      const h = d * 9;
      f[3 * d] = (s[h] + s[h + 3] + s[h + 6]) / 3, f[3 * d + 1] = (s[h + 1] + s[h + 4] + s[h + 7]) / 3, f[3 * d + 2] = (s[h + 2] + s[h + 5] + s[h + 8]) / 3;
    }
    const a = new Int32Array(c);
    for (let d = 0; d < c; d++)
      a[d] = d;
    this.triOrder = a;
    const u = Math.max(1, 2 * c);
    this.bounds = new Float64Array(u * 6), this.start = new Int32Array(u), this.count = new Int32Array(u), this.rightChild = new Int32Array(u), c > 0 ? this.buildNode(0, c, f) : (this.nodeCount = 1, this.bounds.set([1 / 0, 1 / 0, 1 / 0, -1 / 0, -1 / 0, -1 / 0], 0), this.count[0] = 0);
  }
  /** Vertex bounds and centroid bounds over triOrder[lo, hi). */
  computeNodeBounds(t, o, r) {
    let e = 1 / 0, n = 1 / 0, s = 1 / 0, i = -1 / 0, c = -1 / 0, f = -1 / 0, a = 1 / 0, u = 1 / 0, d = 1 / 0, h = -1 / 0, M = -1 / 0, m = -1 / 0;
    for (let g = t; g < o; g++) {
      this.consumeBuildWork();
      const y = this.triOrder[g], x = y * 9;
      for (let z = 0; z < 9; z += 3) {
        const A = this.triVerts[x + z], C = this.triVerts[x + z + 1], E = this.triVerts[x + z + 2];
        A < e && (e = A), A > i && (i = A), C < n && (n = C), C > c && (c = C), E < s && (s = E), E > f && (f = E);
      }
      const b = r[3 * y], I = r[3 * y + 1], p = r[3 * y + 2];
      b < a && (a = b), b > h && (h = b), I < u && (u = I), I > M && (M = I), p < d && (d = p), p > m && (m = p);
    }
    return { minX: e, minY: n, minZ: s, maxX: i, maxY: c, maxZ: f, cMinX: a, cMinY: u, cMinZ: d, cMaxX: h, cMaxY: M, cMaxZ: m };
  }
  /** Allocate and fill the subtree over triOrder[lo, hi). Returns the node
   *  index. Recursive at build time only (depth ~ log2(n / leafSize)). */
  buildNode(t, o, r) {
    this.consumeBuildWork();
    const e = this.nodeCount++, n = this.bounds, s = e * 6, i = this.computeNodeBounds(t, o, r);
    n[s] = i.minX, n[s + 1] = i.minY, n[s + 2] = i.minZ, n[s + 3] = i.maxX, n[s + 4] = i.maxY, n[s + 5] = i.maxZ;
    const c = o - t, f = i.cMaxX - i.cMinX, a = i.cMaxY - i.cMinY, u = i.cMaxZ - i.cMinZ;
    if (c <= zt || f <= 0 && a <= 0 && u <= 0)
      return this.start[e] = t, this.count[e] = c, e;
    const d = wt(f, a, u), h = t + (c >> 1);
    return this.selectNth(t, o, h, d, r), this.count[e] = 0, this.buildNode(t, h, r), this.rightChild[e] = this.buildNode(h, o, r), e;
  }
  /** Hoare quickselect: partition triOrder[lo, hi) so the element at `nth`
   *  is in sorted position by centroid[axis]. O(n) expected per call. */
  selectNth(t, o, r, e, n) {
    const s = this.triOrder, i = (a) => (this.consumeBuildWork(), n[3 * s[a] + e]);
    let c = t, f = o - 1;
    for (; c < f; ) {
      const a = c + f >> 1, u = i(c), d = i(a), h = i(f), M = u < d ? d < h ? d : u < h ? h : u : u < h ? u : d < h ? h : d;
      let m = c, g = f;
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
        f = g;
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
    const c = this.triVerts, f = t * 9, a = c[f], u = c[f + 1], d = c[f + 2], h = c[f + 3] - a, M = c[f + 4] - u, m = c[f + 5] - d, g = c[f + 6] - a, y = c[f + 7] - u, x = c[f + 8] - d, b = s * x - i * y, I = i * g - n * x, p = n * y - s * g, z = h * b + M * I + m * p;
    if (z > -it && z < it)
      return NaN;
    const A = 1 / z, C = o - a, E = r - u, O = e - d, T = (C * b + E * I + O * p) * A;
    if (T < -Y || T > 1 + Y)
      return NaN;
    const v = E * m - O * M, B = O * h - C * m, P = C * M - E * h, k = (n * v + s * B + i * P) * A;
    if (k < -Y || T + k > 1 + Y)
      return NaN;
    const w = (g * v + y * B + x * P) * A;
    return w > 0 && (T < H || k < H || T + k > 1 - H) && (this.grazed = !0), w;
  }
  /** Ray/AABB slab test for node `node` over the t interval [tMin, tMax].
   *  Returns the clipped ENTRY t (>= tMin) on overlap, Infinity on miss.
   *  NaN lanes (origin exactly on a slab plane with zero direction) drop
   *  out of the comparisons, which is conservative-correct. */
  nodeEnterT(t, o, r, e, n, s, i, c, f) {
    const a = this.bounds, u = t * 6;
    let d = c, h = f, M = (a[u] - o) * n, m = (a[u + 3] - o) * n;
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
  scanLeaf(t, o, r, e, n, s, i, c, f, a, u) {
    const d = this.start[t], h = this.count[t];
    for (let M = d; M < d + h; M++) {
      const m = this.triOrder[M];
      if (this.srcIndex[m] === u)
        continue;
      const g = this.intersectTri(m, o, r, e, n, s, i);
      g > c && g < f && (f = g, a = this.srcIndex[m]);
    }
    return { bestT: f, bestTri: a };
  }
  /** Push the two children of internal `node` with the FARTHER child first
   *  (so it is popped last) and return the updated stack pointer. */
  pushNodeChildren(t, o, r, e, n, s, i, c, f, a) {
    const u = this.traversalStack, d = this.traversalTStack;
    let h = t + 1, M = this.rightChild[t], m = this.nodeEnterT(h, o, r, e, n, s, i, c, f), g = this.nodeEnterT(M, o, r, e, n, s, i, c, f);
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
    const e = r?.tMin ?? 0, n = r?.skipTri ?? -1, [s, i, c] = t, [f, a, u] = o, d = 1 / f, h = 1 / a, M = 1 / u;
    let m = 1 / 0, g = -1;
    const y = this.traversalStack, x = this.traversalTStack;
    let b = 0;
    const I = this.nodeEnterT(0, s, i, c, d, h, M, e, 1 / 0);
    for (I < 1 / 0 && (y[0] = 0, x[0] = I, b = 1); b > 0; ) {
      if (b--, x[b] >= m)
        continue;
      const p = y[b];
      if (this.count[p] > 0) {
        const z = this.scanLeaf(p, s, i, c, f, a, u, e, m, g, n);
        m = z.bestT, g = z.bestTri;
      } else
        b = this.pushNodeChildren(p, s, i, c, d, h, M, e, m, b);
    }
    return g >= 0 ? { t: m, triIndex: g } : null;
  }
  /** Every hit along the ray with t > tMin, ascending t. Slab traversal
   *  with no early-out — every intersected leaf is visited. */
  allHits(t, o, r = 0) {
    if (this.triangleCount === 0)
      return [];
    const [e, n, s] = t, [i, c, f] = o, a = 1 / i, u = 1 / c, d = 1 / f, h = [], M = this.traversalStack;
    let m = 0;
    for (M[m++] = 0; m > 0; ) {
      const g = M[--m];
      if (this.nodeEnterT(g, e, n, s, a, u, d, r, 1 / 0) === 1 / 0)
        continue;
      const y = this.count[g];
      if (y > 0) {
        const x = this.start[g];
        for (let b = x; b < x + y; b++) {
          const I = this.triOrder[b], p = this.intersectTri(I, e, n, s, i, c, f);
          p > r && h.push({ t: p, triIndex: this.srcIndex[I] });
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
          const c = this.triOrder[i], f = c * 9;
          let a = !0;
          for (let u = 0; u < 3; u++) {
            const d = this.triVerts[f + u], h = this.triVerts[f + 3 + u], M = this.triVerts[f + 6 + u];
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
            const f = this.triOrder[c], a = f * 9, u = this.triVerts, d = W(t, [u[a], u[a + 1], u[a + 2]], [u[a + 3], u[a + 4], u[a + 5]], [u[a + 6], u[a + 7], u[a + 8]]), h = G(t, d);
            (h < o || h === o && this.srcIndex[f] < r.triIndex) && (o = h, r = { point: d, distance: Math.sqrt(h), triIndex: this.srcIndex[f] });
          }
        } else {
          const i = s + 1, c = this.rightChild[s], f = this.nodeDistanceSquared(i, t), a = this.nodeDistanceSquared(c, t), u = f <= a ? i : c, d = f <= a ? c : i;
          Math.max(f, a) <= o && (e[n++] = d), Math.min(f, a) <= o && (e[n++] = u);
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
      const c = this.triOrder[i], f = c * 9, a = [
        [this.triVerts[f], this.triVerts[f + 1], this.triVerts[f + 2]],
        [this.triVerts[f + 3], this.triVerts[f + 4], this.triVerts[f + 5]],
        [this.triVerts[f + 6], this.triVerts[f + 7], this.triVerts[f + 8]]
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
    const i = (c, f) => {
      const a = G(c, f);
      a < s.best2 && (s.best2 = a, s.best = {
        pointA: c,
        pointB: f,
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
      for (let f = 0; f < 3; f++) {
        const a = xt(o[c], o[(c + 1) % 3], r[f], r[(f + 1) % 3]);
        if (i(a[0], a[1]), s.best2 === 0)
          return !0;
      }
    for (let c = 0; c < 3; c++) {
      const f = st(o[c], o[(c + 1) % 3], r[0], r[1], r[2]);
      if (f && i(f, f), s.best2 === 0)
        return !0;
      const a = st(r[c], r[(c + 1) % 3], o[0], o[1], o[2]);
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
    for (const f of pt) {
      const a = this.rayParityInside(t, f);
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
      s.t - n > It && e++, n = s.t;
    return (e & 1) === 1;
  }
}
const X = 1e-4, ot = 15e4, rt = 10, At = 1e-12;
function St(l, t, o, r, e, n) {
  const s = t[3 * o] * 3, i = t[3 * o + 1] * 3, c = t[3 * o + 2] * 3, f = l[i] - l[s], a = l[i + 1] - l[s + 1], u = l[i + 2] - l[s + 2], d = l[c] - l[s], h = l[c + 1] - l[s + 1], M = l[c + 2] - l[s + 2], m = a * M - u * h, g = u * d - f * M, y = f * h - a * d, x = Math.sqrt(m * m + g * g + y * y);
  return x > 0 ? (m * r + g * e + y * n) / x : 0;
}
function Tt(l, t, o) {
  const r = t[3 * o], e = t[3 * o + 1], n = t[3 * o + 2], s = r * 3, i = e * 3, c = n * 3, f = l[s], a = l[s + 1], u = l[s + 2], d = l[i] - f, h = l[i + 1] - a, M = l[i + 2] - u, m = l[c] - f, g = l[c + 1] - a, y = l[c + 2] - u;
  let x = h * y - M * g, b = M * m - d * y, I = d * g - h * m;
  const p = Math.sqrt(x * x + b * b + I * I);
  if (!(p / 2 >= At))
    return;
  x /= p, b /= p, I /= p;
  const z = (f + l[i] + l[c]) / 3, A = (a + l[i + 1] + l[c + 1]) / 3, C = (u + l[i + 2] + l[c + 2]) / 3;
  return { va: r, vb: e, vc: n, nx: x, ny: b, nz: I, cx: z, cy: A, cz: C };
}
function Ct(l, t, o, r, e, n, s, i, c) {
  const f = l.t;
  if (f < o || f < e) {
    if (r !== void 0 && -St(n, s, l.triIndex, t.nx, t.ny, t.nz) < r)
      return e;
    const a = X + f / 2, u = [t.cx - t.nx * a, t.cy - t.ny * a, t.cz - t.nz * a];
    if (!i.pointInside(u))
      return e;
    if (f < o && c.push({ t: f, location: [t.cx, t.cy, t.cz], va: t.va, vb: t.vb, vc: t.vc }), f < e)
      return f;
  }
  return e;
}
function Et(l, t, o) {
  const r = o?.bvh ?? new dt(l), { vertices: e, triangles: n } = l, s = n.length / 3 | 0, i = s > ot ? Math.ceil(s / ot) : 1, c = o?.maxWedgeDeg !== void 0 ? Math.cos(o.maxWedgeDeg * Math.PI / 180) : void 0;
  let f = 0, a = 1 / 0;
  const u = [];
  for (let M = 0; M < s; M += i) {
    const m = Tt(e, n, M);
    if (m === void 0)
      continue;
    f++;
    const g = [
      m.cx - m.nx * X,
      m.cy - m.ny * X,
      m.cz - m.nz * X
    ], y = [-m.nx, -m.ny, -m.nz], x = r.raycast(g, y, { skipTri: M, tMin: X });
    x !== null && (a = Ct(x, m, t, c, a, e, n, r, u));
  }
  const { clusters: d, truncated: h } = kt(u, t);
  return {
    violations: d,
    truncated: h,
    sampleCount: f,
    thinnestMm: a
  };
}
function kt(l, t) {
  l.sort((f, a) => f.t - a.t);
  const o = 2 * t, r = o * o, e = [], n = [], s = (f) => {
    for (; n[f] !== f; )
      n[f] = n[n[f]], f = n[f];
    return f;
  }, i = /* @__PURE__ */ new Map();
  for (const f of l) {
    let a = -1;
    for (const u of [f.va, f.vb, f.vc]) {
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
        const d = e[u].location, h = f.location[0] - d[0], M = f.location[1] - d[1], m = f.location[2] - d[2];
        if (h * h + M * M + m * m <= r) {
          a = s(u);
          break;
        }
      }
    a === -1 && (a = e.length, n.push(a), e.push({ thicknessMm: f.t, location: f.location, sampleCount: 0 })), e[a].sampleCount++, i.has(f.va) || i.set(f.va, a), i.has(f.vb) || i.set(f.vb, a), i.has(f.vc) || i.set(f.vc, a);
  }
  const c = e.filter((f, a) => s(a) === a);
  return {
    clusters: c.slice(0, rt),
    truncated: c.length > rt
  };
}
const _t = 0.1, Rt = 8, Pt = 0.01;
function ct(l, t) {
  return Math.abs(l - t) <= Math.max(1, 0.01 * Math.max(l, t));
}
function Nt(l, t) {
  return Math.abs(l - t) <= Math.max(0.1, 5e-3 * Math.max(l, t));
}
const Ot = Math.cos(0.5 * Math.PI / 180), vt = Math.cos(1 * Math.PI / 180), J = 1e-12, U = 1e-9, Bt = 1e-9, Lt = 256, at = 36, Dt = 8, tt = {
  "+z": { dir: [0, 0, 1], rows: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], rotation: { axis: [0, 0, 1], deg: 0, apply: "" } },
  "-z": { dir: [0, 0, -1], rows: [[1, 0, 0], [0, -1, 0], [0, 0, -1]], rotation: { axis: [1, 0, 0], deg: 180, apply: ".rotateX(180)" } },
  "+x": { dir: [1, 0, 0], rows: [[0, 0, -1], [0, 1, 0], [1, 0, 0]], rotation: { axis: [0, 1, 0], deg: -90, apply: ".rotateY(-90)" } },
  "-x": { dir: [-1, 0, 0], rows: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], rotation: { axis: [0, 1, 0], deg: 90, apply: ".rotateY(90)" } },
  "+y": { dir: [0, 1, 0], rows: [[1, 0, 0], [0, 0, -1], [0, 1, 0]], rotation: { axis: [1, 0, 0], deg: 90, apply: ".rotateX(90)" } },
  "-y": { dir: [0, -1, 0], rows: [[1, 0, 0], [0, 0, 1], [0, -1, 0]], rotation: { axis: [1, 0, 0], deg: -90, apply: ".rotateX(-90)" } }
}, K = ["+z", "-z", "+x", "-x", "+y", "-y"];
function Vt(l) {
  for (const t of K) {
    const o = tt[t].dir;
    if (Math.abs(l[0] - o[0]) < 1e-9 && Math.abs(l[1] - o[1]) < 1e-9 && Math.abs(l[2] - o[2]) < 1e-9)
      return t;
  }
}
function Ft(l) {
  const t = Vt(l);
  if (t !== void 0) {
    const u = tt[t];
    return { rows: u.rows, rotation: u.rotation, label: t };
  }
  const o = l[1], r = -l[0], e = Math.hypot(o, r), n = l[2], s = o / e, i = r / e, c = 1 - n, f = [
    [c * s * s + n, c * s * i, e * i],
    [c * s * i, c * i * i + n, -e * s],
    [-e * i, e * s, n]
  ], a = Math.atan2(e, n) * 180 / Math.PI;
  return {
    rows: f,
    rotation: { axis: [s, i, 0], deg: a, apply: `.rotate([${Z(s)}, ${Z(i)}, 0], ${Z(a)})` }
  };
}
function Z(l) {
  return Math.round(l * 1e6) / 1e6 + 0;
}
function $t(l) {
  const { vertices: t, triangles: o } = l, r = o.length / 3 | 0, e = t.length / 3 | 0, n = new Float64Array(r * 3), s = new Float64Array(r);
  for (let a = 0; a < r; a++) {
    const u = o[3 * a] * 3, d = o[3 * a + 1] * 3, h = o[3 * a + 2] * 3, M = t[d] - t[u], m = t[d + 1] - t[u + 1], g = t[d + 2] - t[u + 2], y = t[h] - t[u], x = t[h + 1] - t[u + 1], b = t[h + 2] - t[u + 2], I = m * b - g * x, p = g * y - M * b, z = M * x - m * y, A = Math.hypot(I, p, z);
    s[a] = A / 2, A / 2 > J && (n[3 * a] = I / A, n[3 * a + 1] = p / A, n[3 * a + 2] = z / A);
  }
  const i = /* @__PURE__ */ new Map(), c = (a, u) => a < u ? a * e + u : u * e + a;
  for (let a = 0; a < r; a++)
    for (let u = 0; u < 3; u++) {
      const d = c(o[3 * a + u], o[3 * a + (u + 1) % 3]), h = i.get(d);
      h === void 0 ? i.set(d, [a]) : h.push(a);
    }
  const f = new Int32Array(r * 3).fill(-1);
  for (let a = 0; a < r; a++)
    for (let u = 0; u < 3; u++) {
      const d = i.get(c(o[3 * a + u], o[3 * a + (u + 1) % 3]));
      d.length === 2 && (f[3 * a + u] = d[0] === a ? d[1] : d[0]);
    }
  return { mesh: l, triCount: r, normals: n, areas: s, neighbors: f };
}
function Xt(l, t, o, r, e) {
  const n = new Float64Array(t), s = new Float64Array(t), i = new Float64Array(t);
  let c = 1 / 0, f = -1 / 0, a = 1 / 0, u = -1 / 0, d = 1 / 0, h = -1 / 0;
  for (let m = 0; m < t; m++) {
    const g = l[3 * m], y = l[3 * m + 1], x = l[3 * m + 2], b = o[0] * g + o[1] * y + o[2] * x, I = r[0] * g + r[1] * y + r[2] * x, p = e[0] * g + e[1] * y + e[2] * x;
    n[m] = b, s[m] = I, i[m] = p, b < c && (c = b), b > f && (f = b), I < a && (a = I), I > u && (u = I), p < d && (d = p), p > h && (h = p);
  }
  t === 0 && (c = f = a = u = d = h = 0);
  const M = { x: f - c, y: u - a, z: h - d };
  return { pu: n, pv: s, pw: i, wMin: d, sizeMm: M };
}
function Yt(l, t, o, r, e, n, s, i) {
  const c = new Uint8Array(t), f = new Uint8Array(t);
  let a = 0;
  const u = [];
  for (let d = 0; d < t; d++) {
    if (o[d] <= J)
      continue;
    const h = n(d), M = l[3 * d], m = l[3 * d + 1], g = l[3 * d + 2];
    if (h > Ot && s(M) && s(m) && s(g)) {
      c[d] = 1, a += o[d], u.push(r[M], e[M], r[m], e[m], r[g], e[g]);
      continue;
    }
    h > i && (f[d] = 1);
  }
  return { isBed: c, isSteep: f, contactArea: a, contactPts: u };
}
function qt(l, t, o, r, e, n) {
  const s = new Array(o * 2);
  for (let h = 0; h < o; h++)
    s[2 * h] = l[h], s[2 * h + 1] = t[h];
  const i = nn(ft(s)), c = ft(e), f = r > 0 ? en(c) : 0, a = i > J ? r / i : 0, u = f > 0 ? n / f : 1 / 0;
  return { bedContact: { areaMm2: r, footprintMm2: i, ratio: a, minBaseMm: f, heightMm: n, tipRatio: u }, ratio: a, tipRatio: u };
}
function Wt(l, t, o, r, e) {
  let n = 0;
  for (let s = 0; s < l; s++) {
    if (!t[s] || r[s] !== -1)
      continue;
    const i = [s];
    r[s] = n;
    for (let c = 0; c < i.length; c++) {
      const f = i[c];
      for (let a = 0; a < 3; a++) {
        const u = o[3 * f + a];
        u >= 0 && t[u] && r[u] === -1 && (r[u] = n, i.push(u));
      }
    }
    e(i, n), n++;
  }
}
function Ht(l, t, o, r) {
  const { T: e, V: n, rw: s, isBed: i, onBed: c } = l;
  if (c(t) && c(o))
    return !0;
  if (r < 0)
    return !1;
  if (i[r])
    return !0;
  const f = e[3 * r], a = e[3 * r + 1], u = e[3 * r + 2], d = f !== t && f !== o ? f : a !== t && a !== o ? a : u, h = n[3 * o] - n[3 * t], M = n[3 * o + 1] - n[3 * t + 1], m = n[3 * o + 2] - n[3 * t + 2], g = Math.hypot(h, M, m);
  if (g <= 0)
    return !1;
  const y = n[3 * d] - n[3 * t], x = n[3 * d + 1] - n[3 * t + 1], b = n[3 * d + 2] - n[3 * t + 2], I = (y * h + x * M + b * m) / (g * g), p = y - I * h, z = x - I * M, A = b - I * m, C = Math.hypot(p, z, A), E = p * s[0] + z * s[1] + A * s[2];
  return C > 0 && E < -1e-3 * C;
}
function Zt(l, t, o) {
  const { mesh: r, T: e, V: n, areas: s, pu: i, pv: c, pw: f, wMin: a, neighbors: u, regionOf: d, settings: h, downOf: M } = l;
  let m = 0, g = 0, y = 0, x = !0;
  const b = /* @__PURE__ */ new Map(), I = [1 / 0, 1 / 0, 1 / 0], p = [-1 / 0, -1 / 0, -1 / 0], z = [], A = [], C = Math.max(1, Math.ceil(t.length * 4 / Lt));
  t.forEach((w, D) => {
    m += s[w];
    const V = M(w);
    V > g && (g = V), V < vt && (x = !1);
    const S = r.faceOfTri[w];
    b.set(S, (b.get(S) ?? 0) + s[w]);
    const _ = [e[3 * w], e[3 * w + 1], e[3 * w + 2]];
    for (const N of _) {
      f[N] - a > y && (y = f[N] - a);
      for (let L = 0; L < 3; L++) {
        const F = n[3 * N + L];
        F < I[L] && (I[L] = F), F > p[L] && (p[L] = F);
      }
    }
    const nt = (i[_[0]] + i[_[1]] + i[_[2]]) / 3, et = (c[_[0]] + c[_[1]] + c[_[2]]) / 3;
    if (D % C === 0) {
      A.push(nt, et);
      for (const N of _)
        A.push(0.75 * i[N] + 0.25 * nt, 0.75 * c[N] + 0.25 * et);
    }
    for (let N = 0; N < 3; N++) {
      const L = u[3 * w + N];
      if (L >= 0 && d[L] === o)
        continue;
      const F = _[N], q = _[(N + 1) % 3];
      z.push({ ax: i[F], ay: c[F], bx: i[q], by: c[q], anchored: Ht(l, F, q, L) });
    }
  });
  let E, O = -1;
  for (const [w, D] of [...b.entries()].sort((V, S) => V[0] - S[0]))
    D > O && (O = D, E = r.faceRefs[w]);
  const T = {
    status: "unsupported",
    areaMm2: m,
    maxOverhangDeg: Math.asin(Math.min(1, g)) * 180 / Math.PI,
    horizontal: x,
    bboxMin: I,
    bboxMax: p,
    ...E !== void 0 ? { faceRef: E } : {}
  }, v = z.filter((w) => w.anchored);
  if (v.length === 0)
    return T.reachMm = 1 / 0, T;
  if (y <= h.nozzleMm + U)
    return T.status = "first-layer", T;
  const B = Ut(A, z, v);
  if (Number.isFinite(B))
    return T.spanMm = B, T.status = B <= h.maxBridgeMm + Bt ? "bridged" : "unsupported", T;
  const P = A.slice();
  for (const w of z)
    w.anchored || P.push(w.ax, w.ay, w.bx, w.by);
  let k = 0;
  for (let w = 0; w < P.length; w += 2)
    k = Math.max(k, tn(P[w], P[w + 1], v));
  return T.reachMm = k, T.status = k <= h.nozzleMm + U ? "short-reach" : "unsupported", T;
}
function jt(l, t, o) {
  const { mesh: r, triCount: e, normals: n, areas: s, neighbors: i } = l, c = r.vertices, f = r.triangles, a = c.length / 3 | 0, u = Ft(t), [d, h, M] = u.rows, { pu: m, pv: g, pw: y, wMin: x, sizeMm: b } = Xt(c, a, d, h, M), I = (S) => y[S] - x <= Pt, p = Math.sin(o.maxOverhangDeg * Math.PI / 180) + U, z = (S) => -(n[3 * S] * M[0] + n[3 * S + 1] * M[1] + n[3 * S + 2] * M[2]), { isBed: A, isSteep: C, contactArea: E, contactPts: O } = Yt(f, e, s, m, g, z, I, p), { bedContact: T, ratio: v, tipRatio: B } = qt(m, g, a, E, O, b.z), P = new Int32Array(e).fill(-1), k = [], w = {
    mesh: r,
    T: f,
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
    onBed: I
  };
  Wt(e, C, i, P, (S, _) => {
    k.push(Zt(w, S, _));
  }), k.sort((S, _) => _.areaMm2 - S.areaMm2);
  const D = k.filter((S) => S.status === "unsupported").reduce((S, _) => S + _.areaMm2, 0), V = !(b.x > o.bedSizeMm.x || b.y > o.bedSizeMm.y || b.z > o.bedSizeMm.z);
  return {
    buildDirection: [...t],
    ...u.label !== void 0 ? { label: u.label } : {},
    rotation: u.rotation,
    sizeMm: b,
    fitsBed: V,
    unsupportedAreaMm2: D,
    overhangs: k,
    bedContact: T,
    bedContactLow: v < _t,
    tipRisk: E > 0 && B > Rt
  };
}
function Gt(l, t) {
  const o = K.map((e) => jt(l, tt[e].dir, t)), r = new Map(K.map((e, n) => [e, n]));
  return o.slice().sort((e, n) => {
    if (e.fitsBed !== n.fitsBed)
      return e.fitsBed ? -1 : 1;
    const s = e.unsupportedAreaMm2, i = n.unsupportedAreaMm2;
    return ct(s, i) ? e.bedContactLow !== n.bedContactLow ? e.bedContactLow ? 1 : -1 : Nt(e.sizeMm.z, n.sizeMm.z) ? ct(e.bedContact.areaMm2, n.bedContact.areaMm2) ? r.get(e.label) - r.get(n.label) : n.bedContact.areaMm2 - e.bedContact.areaMm2 : e.sizeMm.z - n.sizeMm.z : s - i;
  });
}
function Ut(l, t, o) {
  const r = [];
  for (let i = 0; i < at; i++)
    r.push(i * Math.PI / at);
  const e = o.map((i) => ({ s: i, len: Math.hypot(i.bx - i.ax, i.by - i.ay) })).sort((i, c) => c.len - i.len).slice(0, Dt);
  for (const { s: i } of e) {
    let c = Math.atan2(i.by - i.ay, i.bx - i.ax) + Math.PI / 2;
    c = (c % Math.PI + Math.PI) % Math.PI, r.push(c);
  }
  const n = [...new Set(r.map((i) => Math.round(i * 1e9) / 1e9))].sort((i, c) => i - c);
  let s = 1 / 0;
  for (const i of n) {
    const c = Math.cos(i), f = Math.sin(i);
    let a = 0, u = !0;
    for (let d = 0; d < l.length && u; d += 2) {
      const h = Jt(l[d], l[d + 1], c, f, t);
      h === void 0 ? u = !1 : h > a && (a = h, a >= s && (u = !1));
    }
    u && (s = a);
  }
  return s;
}
function Kt(l, t, o, r, e) {
  const n = [];
  for (const s of e) {
    const i = s.bx - s.ax, c = s.by - s.ay, f = o * c - r * i;
    if (Math.abs(f) < 1e-12)
      continue;
    const a = s.ax - l, u = s.ay - t, d = (a * c - u * i) / f, h = (a * r - u * o) / f;
    h < -1e-9 || h > 1 + 1e-9 || n.push({ t: d, anchored: s.anchored });
  }
  return n;
}
function lt(l, t, o) {
  return l === void 0 || t < l.t - 1e-7 ? { t, anchored: o } : t <= l.t + 1e-7 ? { t: l.t, anchored: l.anchored && o } : l;
}
function Qt(l) {
  let t, o;
  for (const r of l)
    r.t > 1e-9 ? t = lt(t, r.t, r.anchored) : r.t < -1e-9 && (o = lt(o, -r.t, r.anchored));
  return { fwd: t, back: o };
}
function Jt(l, t, o, r, e) {
  const n = Kt(l, t, o, r, e), { fwd: s, back: i } = Qt(n);
  if (!(s === void 0 || i === void 0) && !(!s.anchored || !i.anchored))
    return s.t + i.t;
}
function tn(l, t, o) {
  let r = 1 / 0;
  for (const e of o) {
    const n = e.bx - e.ax, s = e.by - e.ay, i = n * n + s * s;
    let c = i > 0 ? ((l - e.ax) * n + (t - e.ay) * s) / i : 0;
    c = Math.max(0, Math.min(1, c));
    const f = Math.hypot(l - (e.ax + c * n), t - (e.ay + c * s));
    f < r && (r = f);
  }
  return r;
}
function ft(l) {
  const t = [];
  for (let n = 0; n + 1 < l.length; n += 2)
    t.push([l[n], l[n + 1]]);
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
function nn(l) {
  let t = 0;
  const o = l.length / 2;
  for (let r = 0; r < o; r++) {
    const e = (r + 1) % o;
    t += l[2 * r] * l[2 * e + 1] - l[2 * e] * l[2 * r + 1];
  }
  return Math.abs(t) / 2;
}
function en(l) {
  const t = l.length / 2;
  if (t < 3)
    return 0;
  let o = 1 / 0;
  for (let r = 0; r < t; r++) {
    const e = (r + 1) % t, n = l[2 * e] - l[2 * r], s = l[2 * e + 1] - l[2 * r + 1], i = Math.hypot(n, s);
    if (i <= 0)
      continue;
    let c = 0;
    for (let f = 0; f < t; f++) {
      const a = Math.abs((l[2 * f] - l[2 * r]) * s - (l[2 * f + 1] - l[2 * r + 1]) * n) / i;
      a > c && (c = a);
    }
    c < o && (o = c);
  }
  return Number.isFinite(o) ? o : 0;
}
const mt = 1, Q = Object.freeze({
  nozzleMm: 0.4,
  maxOverhangDeg: 45,
  maxBridgeMm: 10,
  minWallMm: 0.8,
  bedSizeMm: Object.freeze({ x: 220, y: 220, z: 250 })
}), ut = 5e5, sn = 10;
function on(l) {
  const t = /* @__PURE__ */ new Map(), o = new Int32Array(l.positions.length / 3), r = [];
  for (let e = 0; e < o.length; e++) {
    const n = l.positions[3 * e], s = l.positions[3 * e + 1], i = l.positions[3 * e + 2], c = `${n},${s},${i}`;
    let f = t.get(c);
    f === void 0 && (f = r.length / 3, r.push(n, s, i), t.set(c, f)), o[e] = f;
  }
  return { vertices: r, triangles: Array.from(l.indices, (e) => o[e]) };
}
function Mt(l) {
  const t = /* @__PURE__ */ new Map();
  let o = 0;
  for (let n = 0; n < l.triangles.length; n += 3) {
    const s = [l.triangles[n], l.triangles[n + 1], l.triangles[n + 2]];
    if (s[0] === s[1] || s[1] === s[2] || s[2] === s[0]) {
      o++;
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const c = s[i], f = s[(i + 1) % 3], a = c < f ? `${c},${f}` : `${f},${c}`, u = t.get(a) ?? [0, 0];
      u[c < f ? 0 : 1]++, t.set(a, u);
    }
  }
  let r = 0, e = 0;
  for (const [n, s] of t.values())
    n + s === 1 ? r++ : (n !== 1 || s !== 1) && e++;
  return { watertight: r === 0 && e === 0 && o === 0, openEdges: r, nonManifoldEdges: e, degenerateTriangles: o };
}
function rn(l) {
  return {
    ...l.label !== void 0 ? { label: l.label } : {},
    buildDirection: l.buildDirection,
    rotation: { axis: l.rotation.axis, deg: l.rotation.deg },
    sizeMm: l.sizeMm,
    fitsBed: l.fitsBed,
    unsupportedAreaMm2: l.unsupportedAreaMm2,
    overhangRegions: l.overhangs.length,
    overhangs: l.overhangs.slice(0, sn).map(({ status: t, areaMm2: o, maxOverhangDeg: r, spanMm: e, reachMm: n, bboxMin: s, bboxMax: i }) => ({ status: t, areaMm2: o, maxOverhangDeg: r, ...e !== void 0 ? { spanMm: e } : {}, ...n !== void 0 && Number.isFinite(n) ? { reachMm: n } : {}, bboxMin: s, bboxMax: i })),
    bedContactMm2: l.bedContact.areaMm2,
    bedContactLow: l.bedContactLow,
    tipRisk: l.tipRisk
  };
}
function cn(l) {
  const t = { ...Q, ...l, bedSizeMm: { ...Q.bedSizeMm, ...l.bedSizeMm } };
  if ([t.nozzleMm, t.maxBridgeMm, t.minWallMm, t.bedSizeMm.x, t.bedSizeMm.y, t.bedSizeMm.z].some((r) => !Number.isFinite(r) || r <= 0 || r > 1e5) || !Number.isFinite(t.maxOverhangDeg) || t.maxOverhangDeg <= 0 || t.maxOverhangDeg >= 90)
    throw new RangeError(ht("Printability settings must be finite positive millimetres and an overhang angle between 0 and 90 degrees"));
  return t;
}
function an(l, t = {}) {
  const o = cn(t), r = l.filter((i) => !i.reference && !i.hole && i.indices.length > 0), e = r.reduce((i, c) => i + c.indices.length / 3, 0);
  if (e > ut)
    throw new RangeError(ht`Printability check is limited to ${ut} triangles; the design has ${e}`);
  const n = [], s = r.map((i) => {
    const c = on(i), f = Mt(c), a = Et(c, o.minWallMm, { bvh: new dt(c) }), u = {
      id: i.id,
      name: i.name,
      triangles: c.triangles.length / 3,
      topology: f,
      minWall: { thresholdMm: o.minWallMm, thinnestMm: Number.isFinite(a.thinnestMm) ? a.thinnestMm : null, violations: a.violations, truncated: a.truncated, sampleCount: a.sampleCount }
    };
    if (!f.watertight)
      n.push(`${i.name}: mesh is not watertight (${f.openEdges} open, ${f.nonManifoldEdges} non-manifold edges)`);
    else {
      const d = c.triangles.length / 3, h = $t({ vertices: c.vertices, triangles: c.triangles, faceOfTri: Array.from({ length: d }, (g, y) => y), faceRefs: [] }), M = Gt(h, o).map(rn);
      u.orientations = M, u.current = M.find((g) => g.label === "+z");
      const m = M[0];
      m.fitsBed ? m.unsupportedAreaMm2 > 0 && n.push(`${i.name}: needs support in every axis orientation (best ${m.label}: ${m.unsupportedAreaMm2.toFixed(1)} mm² unsupported)`) : n.push(`${i.name}: does not fit the ${o.bedSizeMm.x}×${o.bedSizeMm.y}×${o.bedSizeMm.z} mm bed in any axis orientation`), u.current && m.label !== "+z" && u.current.unsupportedAreaMm2 > m.unsupportedAreaMm2 && n.push(`${i.name}: printing with ${m.label} up reduces unsupported area`);
    }
    return a.violations.length && n.push(`${i.name}: walls thinner than ${o.minWallMm} mm (thinnest ${a.thinnestMm.toFixed(2)} mm)`), u;
  });
  return { version: mt, settings: o, bodies: s, issues: n, disclaimer: "Sampled engineering screening of the tessellated mesh, not a guarantee of a successful print." };
}
var un = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  DEFAULT_PRINTABILITY_SETTINGS: Q,
  PRINTABILITY_CHECK_VERSION: mt,
  checkMeshTopology: Mt,
  checkPrintability: an
});
export {
  dt as T,
  W as a,
  an as c,
  un as p
};
